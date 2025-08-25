package services

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net"
	"sync"

	"golang.org/x/crypto/ssh"
)

// HostKeyManager manages trusted SSH host keys per user session
type HostKeyManager struct {
	// sessionKeys maps userSession -> hostIdentifier -> hostKey
	sessionKeys map[string]map[string]ssh.PublicKey
	// pendingKeys stores keys that are awaiting user approval
	// maps userSession -> hostIdentifier -> hostKey
	pendingKeys map[string]map[string]ssh.PublicKey
	mutex       sync.RWMutex
}

// HostKeyError represents different types of host key verification errors
type HostKeyError struct {
	Type        HostKeyErrorType
	Message     string
	Fingerprint string
	Host        string
	Port        string
}

type HostKeyErrorType string

const (
	HostKeyUnknown HostKeyErrorType = "unknown"    // First time seeing this host
	HostKeyChanged HostKeyErrorType = "changed"    // Host key has changed (potential MITM)
	HostKeyInvalid HostKeyErrorType = "invalid"    // Invalid key format
)

func (e *HostKeyError) Error() string {
	return e.Message
}

// NewHostKeyManager creates a new host key manager
func NewHostKeyManager() *HostKeyManager {
	return &HostKeyManager{
		sessionKeys: make(map[string]map[string]ssh.PublicKey),
		pendingKeys: make(map[string]map[string]ssh.PublicKey),
	}
}

// getHostIdentifier creates a unique identifier for a host
func (hkm *HostKeyManager) getHostIdentifier(host string, port string, username string) string {
	return fmt.Sprintf("%s@%s:%s", username, host, port)
}

// GetHostKeyFingerprint returns the SHA256 fingerprint of a public key
func (hkm *HostKeyManager) GetHostKeyFingerprint(key ssh.PublicKey) string {
	hash := sha256.Sum256(key.Marshal())
	return "SHA256:" + base64.StdEncoding.EncodeToString(hash[:])
}

// VerifyHostKey verifies if a host key is trusted for a given session
func (hkm *HostKeyManager) VerifyHostKey(userSession, host, port, username string, key ssh.PublicKey) error {
	hkm.mutex.Lock() // Use write lock to allow storing pending keys
	defer hkm.mutex.Unlock()

	hostID := hkm.getHostIdentifier(host, port, username)
	
	// Check if we have any keys for this session
	sessionKeys, sessionExists := hkm.sessionKeys[userSession]
	if !sessionExists {
		// Store this key as pending approval (first connection for this session)
		hkm.storePendingKey(userSession, hostID, key)
		
		// No keys stored for this session - this is the first host they're connecting to
		return &HostKeyError{
			Type:        HostKeyUnknown,
			Message:     fmt.Sprintf("Host key for %s is not cached", hostID),
			Fingerprint: hkm.GetHostKeyFingerprint(key),
			Host:        host,
			Port:        port,
		}
	}

	// Check if we have a key for this specific host
	storedKey, hostExists := sessionKeys[hostID]
	if !hostExists {
		// Store this key as pending approval
		hkm.storePendingKey(userSession, hostID, key)
		
		// First time connecting to this host in this session
		return &HostKeyError{
			Type:        HostKeyUnknown,
			Message:     fmt.Sprintf("Host key for %s is not cached", hostID),
			Fingerprint: hkm.GetHostKeyFingerprint(key),
			Host:        host,
			Port:        port,
		}
	}

	// Compare the stored key with the presented key by comparing their marshaled bytes
	if !keysEqual(storedKey, key) {
		// Host key has changed - potential MITM attack!
		return &HostKeyError{
			Type:        HostKeyChanged,
			Message:     fmt.Sprintf("WARNING: Host key for %s has CHANGED! This could indicate a Man-in-the-Middle attack!", hostID),
			Fingerprint: hkm.GetHostKeyFingerprint(key),
			Host:        host,
			Port:        port,
		}
	}

	// Key matches - connection is trusted
	return nil
}

// storePendingKey stores a key that's awaiting user approval (internal method)
func (hkm *HostKeyManager) storePendingKey(userSession, hostID string, key ssh.PublicKey) {
	// Note: mutex should already be held by caller
	if hkm.pendingKeys[userSession] == nil {
		hkm.pendingKeys[userSession] = make(map[string]ssh.PublicKey)
	}
	hkm.pendingKeys[userSession][hostID] = key
}

// TrustHostKey adds a host key to the trusted list for a session
func (hkm *HostKeyManager) TrustHostKey(userSession, host, port, username string, key ssh.PublicKey) error {
	hkm.mutex.Lock()
	defer hkm.mutex.Unlock()

	hostID := hkm.getHostIdentifier(host, port, username)

	// Initialize session map if it doesn't exist
	if hkm.sessionKeys[userSession] == nil {
		hkm.sessionKeys[userSession] = make(map[string]ssh.PublicKey)
	}

	// Store the key
	hkm.sessionKeys[userSession][hostID] = key

	// Remove from pending keys if it exists
	if hkm.pendingKeys[userSession] != nil {
		delete(hkm.pendingKeys[userSession], hostID)
	}

	return nil
}

// TrustPendingHostKey moves a pending host key to trusted (used when user approves)
func (hkm *HostKeyManager) TrustPendingHostKey(userSession, host, port, username, fingerprint string) error {
	hkm.mutex.Lock()
	defer hkm.mutex.Unlock()

	hostID := hkm.getHostIdentifier(host, port, username)

	// Check if we have a pending key for this host
	if hkm.pendingKeys[userSession] == nil {
		return fmt.Errorf("no pending keys for session")
	}

	pendingKey, exists := hkm.pendingKeys[userSession][hostID]
	if !exists {
		return fmt.Errorf("no pending key for host %s", hostID)
	}

	// Verify the fingerprint matches
	if hkm.GetHostKeyFingerprint(pendingKey) != fingerprint {
		return fmt.Errorf("fingerprint mismatch")
	}

	// Move to trusted keys
	if hkm.sessionKeys[userSession] == nil {
		hkm.sessionKeys[userSession] = make(map[string]ssh.PublicKey)
	}
	hkm.sessionKeys[userSession][hostID] = pendingKey

	// Remove from pending
	delete(hkm.pendingKeys[userSession], hostID)

	return nil
}

// ClearSession removes all trusted and pending keys for a session
func (hkm *HostKeyManager) ClearSession(userSession string) {
	hkm.mutex.Lock()
	defer hkm.mutex.Unlock()

	delete(hkm.sessionKeys, userSession)
	delete(hkm.pendingKeys, userSession)
}

// CreateHostKeyCallback creates a SSH HostKeyCallback function for a specific session
func (hkm *HostKeyManager) CreateHostKeyCallback(userSession, host, port, username string) ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		return hkm.VerifyHostKey(userSession, host, port, username, key)
	}
}

// GetTrustedHosts returns a list of trusted hosts for a session (for debugging/display)
func (hkm *HostKeyManager) GetTrustedHosts(userSession string) map[string]string {
	hkm.mutex.RLock()
	defer hkm.mutex.RUnlock()

	result := make(map[string]string)
	if sessionKeys, exists := hkm.sessionKeys[userSession]; exists {
		for hostID, key := range sessionKeys {
			result[hostID] = hkm.GetHostKeyFingerprint(key)
		}
	}
	return result
}

// keysEqual compares two SSH public keys for equality
func keysEqual(a, b ssh.PublicKey) bool {
	return bytes.Equal(a.Marshal(), b.Marshal())
}

// Global host key manager instance
var GlobalHostKeyManager *HostKeyManager

func InitHostKeyManager() {
	GlobalHostKeyManager = NewHostKeyManager()
}
