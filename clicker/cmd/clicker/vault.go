package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/vibium/clicker/internal/paths"
	"github.com/vibium/clicker/internal/vault"
	"golang.org/x/term"
)

// passphraseEnvVar lets scripts and CI provide the vault passphrase
// non-interactively.
const passphraseEnvVar = "VIBIUM_VAULT_PASSPHRASE"

// readPassphrase gets the vault passphrase from the environment or an
// interactive hidden prompt.
func readPassphrase(prompt string) (string, error) {
	if pass := os.Getenv(passphraseEnvVar); pass != "" {
		return pass, nil
	}
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return "", fmt.Errorf("stdin is not a terminal; set %s to provide the passphrase", passphraseEnvVar)
	}
	fmt.Fprint(os.Stderr, prompt)
	pass, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", err
	}
	return string(pass), nil
}

// readSecretValue gets a secret value from stdin. If stdin is a pipe the
// value is read from it (script-friendly, keeps secrets out of shell
// history); otherwise a hidden interactive prompt is shown.
func readSecretValue(name string) (string, error) {
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		reader := bufio.NewReader(os.Stdin)
		value, err := reader.ReadString('\n')
		if err != nil && value == "" {
			return "", fmt.Errorf("reading value from stdin: %w", err)
		}
		value = strings.TrimRight(value, "\r\n")
		if value == "" {
			return "", fmt.Errorf("empty value on stdin")
		}
		return value, nil
	}

	fmt.Fprintf(os.Stderr, "Value for %q (input hidden): ", name)
	value, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", err
	}
	if len(value) == 0 {
		return "", fmt.Errorf("empty value")
	}
	return string(value), nil
}

// openVault opens the vault at the default path, prompting for the passphrase.
func openVault() (*vault.Vault, error) {
	path, err := paths.GetVaultPath()
	if err != nil {
		return nil, err
	}
	passphrase, err := readPassphrase("Vault passphrase: ")
	if err != nil {
		return nil, err
	}
	return vault.Open(path, passphrase)
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}

func newVaultCmd() *cobra.Command {
	vaultCmd := &cobra.Command{
		Use:   "vault",
		Short: "Securely store API keys and other secrets",
		Long: `Manage an encrypted vault for API keys and other secrets.

Secrets are encrypted with AES-256-GCM using a key derived from your
passphrase (Argon2id) and stored in a single file readable only by you.
Nothing ever leaves your machine.

For scripts, set ` + passphraseEnvVar + ` to skip the passphrase prompt.`,
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Help()
		},
	}

	vaultCmd.AddCommand(&cobra.Command{
		Use:   "init",
		Short: "Create a new empty vault",
		Example: `  clicker vault init
  # Choose a passphrase: ********
  # Confirm passphrase:  ********
  # Vault created at ~/.config/vibium/vault.json`,
		Args: cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			path, err := paths.GetVaultPath()
			if err != nil {
				fatalf("Error: %v", err)
			}
			if _, err := os.Stat(path); err == nil {
				fatalf("Error: vault already exists at %s", path)
			}

			passphrase, err := readPassphrase("Choose a passphrase: ")
			if err != nil {
				fatalf("Error: %v", err)
			}
			if passphrase == "" {
				fatalf("Error: passphrase must not be empty")
			}
			// Only confirm when typed interactively; env var needs no confirmation.
			if os.Getenv(passphraseEnvVar) == "" {
				confirm, err := readPassphrase("Confirm passphrase:  ")
				if err != nil {
					fatalf("Error: %v", err)
				}
				if passphrase != confirm {
					fatalf("Error: passphrases do not match")
				}
			}

			if _, err := vault.Create(path, passphrase); err != nil {
				fatalf("Error: %v", err)
			}
			fmt.Printf("Vault created at %s\n", path)
			fmt.Println("\nStore your first key with: clicker vault set <name>")
		},
	})

	vaultCmd.AddCommand(&cobra.Command{
		Use:   "set [name]",
		Short: "Store or update a secret (value read from prompt or stdin, never argv)",
		Example: `  clicker vault set openai
  # Vault passphrase: ********
  # Value for "openai" (input hidden): ********
  # Stored "openai"

  echo -n "sk-..." | VIBIUM_VAULT_PASSPHRASE=... clicker vault set openai
  # Stored "openai"`,
		Args: cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			name := args[0]
			v, err := openVault()
			if err != nil {
				fatalf("Error: %v", err)
			}
			value, err := readSecretValue(name)
			if err != nil {
				fatalf("Error: %v", err)
			}
			v.Set(name, value)
			if err := v.Save(); err != nil {
				fatalf("Error: %v", err)
			}
			fmt.Printf("Stored %q\n", name)
		},
	})

	vaultCmd.AddCommand(&cobra.Command{
		Use:   "get [name]",
		Short: "Print a secret's value to stdout",
		Example: `  clicker vault get openai
  # Vault passphrase: ********
  # sk-...

  export OPENAI_API_KEY=$(VIBIUM_VAULT_PASSPHRASE=... clicker vault get openai)
  # Load a key into the environment without echoing it`,
		Args: cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			v, err := openVault()
			if err != nil {
				fatalf("Error: %v", err)
			}
			value, err := v.Get(args[0])
			if err != nil {
				fatalf("Error: %v", err)
			}
			fmt.Println(value)
		},
	})

	vaultCmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List secret names (values are never shown)",
		Example: `  clicker vault list
  # Vault passphrase: ********
  # NAME      UPDATED
  # openai    2026-07-05 14:03 UTC
  # stripe    2026-07-01 09:41 UTC`,
		Args: cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			v, err := openVault()
			if err != nil {
				fatalf("Error: %v", err)
			}
			entries := v.List()
			if len(entries) == 0 {
				fmt.Println("Vault is empty. Store a key with: clicker vault set <name>")
				return
			}
			w := 4 // len("NAME")
			for _, e := range entries {
				if len(e.Name) > w {
					w = len(e.Name)
				}
			}
			fmt.Printf("%-*s  %s\n", w, "NAME", "UPDATED")
			for _, e := range entries {
				fmt.Printf("%-*s  %s\n", w, e.Name, e.UpdatedAt.Format("2006-01-02 15:04 MST"))
			}
		},
	})

	vaultCmd.AddCommand(&cobra.Command{
		Use:   "rm [name]",
		Short: "Delete a secret from the vault",
		Example: `  clicker vault rm openai
  # Vault passphrase: ********
  # Deleted "openai"`,
		Args: cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			v, err := openVault()
			if err != nil {
				fatalf("Error: %v", err)
			}
			if err := v.Delete(args[0]); err != nil {
				fatalf("Error: %v", err)
			}
			if err := v.Save(); err != nil {
				fatalf("Error: %v", err)
			}
			fmt.Printf("Deleted %q\n", args[0])
		},
	})

	vaultCmd.AddCommand(&cobra.Command{
		Use:   "path",
		Short: "Print the vault file location",
		Example: `  clicker vault path
  # /home/user/.config/vibium/vault.json`,
		Args: cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			path, err := paths.GetVaultPath()
			if err != nil {
				fatalf("Error: %v", err)
			}
			fmt.Println(path)
		},
	})

	return vaultCmd
}
