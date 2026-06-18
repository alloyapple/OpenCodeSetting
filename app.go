package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// App struct
type App struct {
	ctx context.Context
}

// Config represents the OpenCode configuration structure
type Config map[string]interface{}

// BackupInfo represents a backup file info
type BackupInfo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Created string `json:"created"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetConfigPath returns the path to the OpenCode config file
func (a *App) GetConfigPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(homeDir, ".config", "opencode", "opencode.json")
}

// GetConfigDir returns the directory containing the OpenCode config
func (a *App) GetConfigDir() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(homeDir, ".config", "opencode")
}

// GetConfig reads and returns the current OpenCode configuration
func (a *App) GetConfig() (Config, error) {
	configPath := a.GetConfigPath()
	
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty config if file doesn't exist
			return Config{}, nil
		}
		return nil, fmt.Errorf("failed to read config: %w", err)
	}
	
	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}
	
	return config, nil
}

// ValidateConfig validates if the given JSON is valid
func (a *App) ValidateConfig(configJSON string) error {
	var config Config
	if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	return nil
}

// SaveConfig saves the configuration with automatic backup
func (a *App) SaveConfig(configJSON string) error {
	// Validate first
	var config Config
	if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	
	configPath := a.GetConfigPath()
	configDir := a.GetConfigDir()
	
	// Ensure config directory exists
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}
	
	// Create backup if config file exists
	if _, err := os.Stat(configPath); err == nil {
		if err := a.createBackup(configPath); err != nil {
			return fmt.Errorf("failed to create backup: %w", err)
		}
	}
	
	// Format the JSON nicely
	var formattedJSON bytes.Buffer
	if err := json.Indent(&formattedJSON, []byte(configJSON), "", "\t"); err != nil {
		// If formatting fails, write as-is
		formattedJSON.WriteString(configJSON)
	}
	
	// Write the new config
	if err := os.WriteFile(configPath, formattedJSON.Bytes(), 0644); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}
	
	return nil
}

// createBackup creates a backup of the config file, keeping only last 2 backups
func (a *App) createBackup(configPath string) error {
	configDir := a.GetConfigDir()
	
	// Read current config
	data, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}
	
	// Create backup filename with timestamp
	timestamp := time.Now().Format("20060102-150405")
	backupName := fmt.Sprintf("opencode.json.backup.%s", timestamp)
	backupPath := filepath.Join(configDir, backupName)
	
	// Write backup
	if err := os.WriteFile(backupPath, data, 0644); err != nil {
		return err
	}
	
	// Clean up old backups (keep only last 2)
	if err := a.cleanupOldBackups(); err != nil {
		// Log but don't fail if cleanup fails
		fmt.Printf("Warning: failed to cleanup old backups: %v\n", err)
	}
	
	return nil
}

// cleanupOldBackups keeps only the last 2 backup files
func (a *App) cleanupOldBackups() error {
	configDir := a.GetConfigDir()
	
	entries, err := os.ReadDir(configDir)
	if err != nil {
		return err
	}
	
	// Find all backup files
	var backups []os.DirEntry
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "opencode.json.backup.") && !entry.IsDir() {
			backups = append(backups, entry)
		}
	}
	
	// Sort by modification time (newest first)
	sort.Slice(backups, func(i, j int) bool {
		infoI, _ := backups[i].Info()
		infoJ, _ := backups[j].Info()
		return infoI.ModTime().After(infoJ.ModTime())
	})
	
	// Remove old backups (keep last 2)
	if len(backups) > 2 {
		for _, backup := range backups[2:] {
			backupPath := filepath.Join(configDir, backup.Name())
			if err := os.Remove(backupPath); err != nil {
				fmt.Printf("Warning: failed to remove old backup %s: %v\n", backup.Name(), err)
			}
		}
	}
	
	return nil
}

// ListBackups returns a list of available backup files
func (a *App) ListBackups() ([]BackupInfo, error) {
	configDir := a.GetConfigDir()
	
	entries, err := os.ReadDir(configDir)
	if err != nil {
		return nil, err
	}
	
	var backups []BackupInfo
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "opencode.json.backup.") && !entry.IsDir() {
			info, err := entry.Info()
			if err != nil {
				continue
			}
			
			backups = append(backups, BackupInfo{
				Name:    entry.Name(),
				Path:    filepath.Join(configDir, entry.Name()),
				Created: info.ModTime().Format("2006-01-02 15:04:05"),
			})
		}
	}
	
	// Sort by created time (newest first)
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].Created > backups[j].Created
	})
	
	return backups, nil
}

// RestoreBackup restores config from a backup file
func (a *App) RestoreBackup(backupPath string) error {
	configPath := a.GetConfigPath()
	
	// Verify backup exists
	if _, err := os.Stat(backupPath); err != nil {
		return fmt.Errorf("backup file not found: %w", err)
	}
	
	// Read backup data
	data, err := os.ReadFile(backupPath)
	if err != nil {
		return fmt.Errorf("failed to read backup: %w", err)
	}
	
	// Validate it's valid JSON
	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("backup file contains invalid JSON: %w", err)
	}
	
	// Write to main config
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to restore backup: %w", err)
	}
	
	return nil
}

// GetDefaultConfig returns a default configuration template
func (a *App) GetDefaultConfig() Config {
	return Config{
		"$schema": "https://opencode.ai/config.json",
		"command": map[string]interface{}{},
		"mcp":     map[string]interface{}{},
		"permission": map[string]string{
			"bash":      "allow",
			"edit":      "allow",
			"glob":      "allow",
			"grep":      "allow",
			"list":      "allow",
			"patch":     "allow",
			"question":  "allow",
			"read":      "allow",
			"skill":     "allow",
			"task":      "allow",
			"todoread":  "allow",
			"todowrite": "allow",
			"webfetch":  "allow",
			"write":     "allow",
		},
		"plugin":  []string{},
		"provider": map[string]interface{}{},
		"tools": map[string]bool{
			"bash":      true,
			"edit":      true,
			"glob":      true,
			"grep":      true,
			"list":      true,
			"patch":     true,
			"question":  true,
			"read":      true,
			"skill":     true,
			"task":      true,
			"todoread":  true,
			"todowrite": true,
			"webfetch":  true,
			"write":     true,
		},
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
