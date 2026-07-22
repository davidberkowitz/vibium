// Package vault provides an encrypted store for API keys and other secrets.
//
// Secrets are stored in a single JSON file encrypted with AES-256-GCM.
// The encryption key is derived from a user passphrase with Argon2id.
// The file is written atomically with 0600 permissions.
package vault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"golang.org/x/crypto/argon2"
)

const fileVersion = 1

// Argon2id parameters (OWASP-recommended baseline).
const (
	kdfTime    = 3
	kdfMemory  = 64 * 1024 // KiB (64 MiB)
	kdfThreads = 4
	keyLen     = 32 // AES-256
	saltLen    = 16
)

// ErrWrongPassphrase is returned when decryption fails, which means the
// passphrase is incorrect or the vault file has been tampered with.
var ErrWrongPassphrase = errors.New("wrong passphrase or corrupted vault")

// ErrNotFound is returned when a named secret does not exist.
var ErrNotFound = errors.New("secret not found")

// ErrVaultExists is returned by Create when the vault file already exists.
var ErrVaultExists = errors.New("vault already exists")

// ErrNoVault is returned by Open when the vault file does not exist.
var ErrNoVault = errors.New("vault not found (run 'clicker vault init' first)")

// Entry is a single stored secret.
type Entry struct {
	Value     string    `json:"value"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// EntryInfo is metadata about a secret, without its value.
type EntryInfo struct {
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// kdfParams records how the encryption key was derived, so files remain
// readable if defaults change in a future version.
type kdfParams struct {
	Name      string `json:"name"`
	Time      uint32 `json:"time"`
	MemoryKiB uint32 `json:"memory_kib"`
	Threads   uint8  `json:"threads"`
}

// fileEnvelope is the on-disk format. Only Ciphertext is secret-bearing.
type fileEnvelope struct {
	Version    int       `json:"version"`
	KDF        kdfParams `json:"kdf"`
	Salt       string    `json:"salt"`
	Nonce      string    `json:"nonce"`
	Ciphertext string    `json:"ciphertext"`
}

// Vault is an open (decrypted, in-memory) secret store.
type Vault struct {
	path    string
	key     []byte
	salt    []byte
	kdf     kdfParams
	entries map[string]Entry
}

// Create initializes a new empty vault file at path, encrypted with passphrase.
func Create(path, passphrase string) (*Vault, error) {
	if _, err := os.Stat(path); err == nil {
		return nil, ErrVaultExists
	}

	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("generating salt: %w", err)
	}

	kdf := kdfParams{Name: "argon2id", Time: kdfTime, MemoryKiB: kdfMemory, Threads: kdfThreads}
	v := &Vault{
		path:    path,
		key:     deriveKey(passphrase, salt, kdf),
		salt:    salt,
		kdf:     kdf,
		entries: map[string]Entry{},
	}

	if err := v.Save(); err != nil {
		return nil, err
	}
	return v, nil
}

// Open reads and decrypts the vault file at path.
func Open(path, passphrase string) (*Vault, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNoVault
	}
	if err != nil {
		return nil, err
	}

	var env fileEnvelope
	if err := json.Unmarshal(data, &env); err != nil {
		return nil, fmt.Errorf("reading vault file: %w", err)
	}
	if env.Version != fileVersion {
		return nil, fmt.Errorf("unsupported vault version %d", env.Version)
	}
	if env.KDF.Name != "argon2id" {
		return nil, fmt.Errorf("unsupported KDF %q", env.KDF.Name)
	}

	salt, err := base64.StdEncoding.DecodeString(env.Salt)
	if err != nil {
		return nil, fmt.Errorf("reading vault file: %w", err)
	}
	nonce, err := base64.StdEncoding.DecodeString(env.Nonce)
	if err != nil {
		return nil, fmt.Errorf("reading vault file: %w", err)
	}
	ciphertext, err := base64.StdEncoding.DecodeString(env.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("reading vault file: %w", err)
	}

	key := deriveKey(passphrase, salt, env.KDF)

	aead, err := newAEAD(key)
	if err != nil {
		return nil, err
	}
	plaintext, err := aead.Open(nil, nonce, ciphertext, additionalData(env.Version, salt))
	if err != nil {
		return nil, ErrWrongPassphrase
	}

	entries := map[string]Entry{}
	if err := json.Unmarshal(plaintext, &entries); err != nil {
		return nil, fmt.Errorf("reading vault contents: %w", err)
	}

	return &Vault{path: path, key: key, salt: salt, kdf: env.KDF, entries: entries}, nil
}

// Set stores or updates a secret. Call Save to persist.
func (v *Vault) Set(name, value string) {
	now := time.Now().UTC()
	entry := Entry{Value: value, CreatedAt: now, UpdatedAt: now}
	if existing, ok := v.entries[name]; ok {
		entry.CreatedAt = existing.CreatedAt
	}
	v.entries[name] = entry
}

// Get returns the value of a secret.
func (v *Vault) Get(name string) (string, error) {
	entry, ok := v.entries[name]
	if !ok {
		return "", fmt.Errorf("%w: %q", ErrNotFound, name)
	}
	return entry.Value, nil
}

// Delete removes a secret. Call Save to persist.
func (v *Vault) Delete(name string) error {
	if _, ok := v.entries[name]; !ok {
		return fmt.Errorf("%w: %q", ErrNotFound, name)
	}
	delete(v.entries, name)
	return nil
}

// List returns metadata for all secrets, sorted by name. Values are not included.
func (v *Vault) List() []EntryInfo {
	infos := make([]EntryInfo, 0, len(v.entries))
	for name, e := range v.entries {
		infos = append(infos, EntryInfo{Name: name, CreatedAt: e.CreatedAt, UpdatedAt: e.UpdatedAt})
	}
	sort.Slice(infos, func(i, j int) bool { return infos[i].Name < infos[j].Name })
	return infos
}

// Save encrypts the entries and atomically writes the vault file with 0600
// permissions. A fresh random nonce is generated on every save.
func (v *Vault) Save() error {
	plaintext, err := json.Marshal(v.entries)
	if err != nil {
		return err
	}

	aead, err := newAEAD(v.key)
	if err != nil {
		return err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return fmt.Errorf("generating nonce: %w", err)
	}
	ciphertext := aead.Seal(nil, nonce, plaintext, additionalData(fileVersion, v.salt))

	env := fileEnvelope{
		Version:    fileVersion,
		KDF:        v.kdf,
		Salt:       base64.StdEncoding.EncodeToString(v.salt),
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
	}
	data, err := json.MarshalIndent(env, "", "  ")
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(v.path), 0700); err != nil {
		return err
	}

	// Write to a temp file in the same directory, then rename, so a crash
	// mid-write can never leave a truncated vault.
	tmp, err := os.CreateTemp(filepath.Dir(v.path), ".vault-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if err := tmp.Chmod(0600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, v.path)
}

// deriveKey stretches the passphrase into an AES-256 key with Argon2id.
func deriveKey(passphrase string, salt []byte, kdf kdfParams) []byte {
	return argon2.IDKey([]byte(passphrase), salt, kdf.Time, kdf.MemoryKiB, kdf.Threads, keyLen)
}

func newAEAD(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// additionalData binds the file header to the ciphertext so the version and
// salt cannot be swapped without failing authentication.
func additionalData(version int, salt []byte) []byte {
	return append([]byte(fmt.Sprintf("vibium-vault-v%d:", version)), salt...)
}
