package vault

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func testVaultPath(t *testing.T) string {
	t.Helper()
	return filepath.Join(t.TempDir(), "vault.json")
}

func TestCreateAndReopen(t *testing.T) {
	path := testVaultPath(t)

	v, err := Create(path, "correct horse battery staple")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	v.Set("openai", "sk-test-123")
	v.Set("stripe", "sk_live_456")
	if err := v.Save(); err != nil {
		t.Fatalf("Save: %v", err)
	}

	reopened, err := Open(path, "correct horse battery staple")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	got, err := reopened.Get("openai")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "sk-test-123" {
		t.Errorf("Get(openai) = %q, want %q", got, "sk-test-123")
	}

	names := reopened.List()
	if len(names) != 2 || names[0].Name != "openai" || names[1].Name != "stripe" {
		t.Errorf("List() = %+v, want sorted [openai stripe]", names)
	}
}

func TestWrongPassphrase(t *testing.T) {
	path := testVaultPath(t)
	if _, err := Create(path, "right"); err != nil {
		t.Fatalf("Create: %v", err)
	}

	_, err := Open(path, "wrong")
	if !errors.Is(err, ErrWrongPassphrase) {
		t.Errorf("Open with wrong passphrase: got %v, want ErrWrongPassphrase", err)
	}
}

func TestCreateExisting(t *testing.T) {
	path := testVaultPath(t)
	if _, err := Create(path, "pw"); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := Create(path, "pw"); !errors.Is(err, ErrVaultExists) {
		t.Errorf("second Create: got %v, want ErrVaultExists", err)
	}
}

func TestOpenMissing(t *testing.T) {
	if _, err := Open(testVaultPath(t), "pw"); !errors.Is(err, ErrNoVault) {
		t.Errorf("Open missing vault: got %v, want ErrNoVault", err)
	}
}

func TestGetMissingAndDelete(t *testing.T) {
	path := testVaultPath(t)
	v, err := Create(path, "pw")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if _, err := v.Get("nope"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get missing: got %v, want ErrNotFound", err)
	}
	if err := v.Delete("nope"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Delete missing: got %v, want ErrNotFound", err)
	}

	v.Set("key", "value")
	if err := v.Delete("key"); err != nil {
		t.Errorf("Delete existing: %v", err)
	}
	if _, err := v.Get("key"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get after delete: got %v, want ErrNotFound", err)
	}
}

func TestSetUpdatesValue(t *testing.T) {
	path := testVaultPath(t)
	v, err := Create(path, "pw")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	v.Set("key", "old")
	v.Set("key", "new")

	got, err := v.Get("key")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "new" {
		t.Errorf("Get = %q, want %q", got, "new")
	}
	if len(v.List()) != 1 {
		t.Errorf("List has %d entries, want 1", len(v.List()))
	}
}

func TestTamperedCiphertextRejected(t *testing.T) {
	path := testVaultPath(t)
	v, err := Create(path, "pw")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	v.Set("key", "value")
	if err := v.Save(); err != nil {
		t.Fatalf("Save: %v", err)
	}

	// Flip a byte in the ciphertext.
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var env fileEnvelope
	if err := json.Unmarshal(data, &env); err != nil {
		t.Fatal(err)
	}
	raw, err := base64.StdEncoding.DecodeString(env.Ciphertext)
	if err != nil {
		t.Fatal(err)
	}
	raw[0] ^= 0xff
	env.Ciphertext = base64.StdEncoding.EncodeToString(raw)
	tampered, err := json.Marshal(env)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, tampered, 0600); err != nil {
		t.Fatal(err)
	}

	if _, err := Open(path, "pw"); !errors.Is(err, ErrWrongPassphrase) {
		t.Errorf("Open tampered vault: got %v, want ErrWrongPassphrase", err)
	}
}

func TestPlaintextNotOnDisk(t *testing.T) {
	path := testVaultPath(t)
	v, err := Create(path, "pw")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	secret := "sk-super-secret-value-abc123"
	v.Set("openai", secret)
	if err := v.Save(); err != nil {
		t.Fatalf("Save: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(data, []byte(secret)) {
		t.Error("secret value appears in plaintext in vault file")
	}
	if bytes.Contains(data, []byte("openai")) {
		t.Error("secret name appears in plaintext in vault file")
	}
}

func TestFilePermissions(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix permissions not enforced on windows")
	}
	path := testVaultPath(t)
	if _, err := Create(path, "pw"); err != nil {
		t.Fatalf("Create: %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Errorf("vault file permissions = %o, want 0600", perm)
	}
}
