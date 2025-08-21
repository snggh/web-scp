package transfer

import (
	"sync"

	"github.com/user/web-scp/models"
)

// ProgressCallback is a function type for progress updates
type ProgressCallback func(userSession string, progress models.TransferProgress)

// TransferManager manages file transfers and progress updates
type TransferManager struct {
	mu              sync.RWMutex
	progressCallback ProgressCallback
	activeTransfers map[string]*models.TransferProgress
}

// NewTransferManager creates a new transfer manager
func NewTransferManager() *TransferManager {
	return &TransferManager{
		activeTransfers: make(map[string]*models.TransferProgress),
	}
}

// SetProgressCallback sets the callback function for progress updates
func (tm *TransferManager) SetProgressCallback(callback ProgressCallback) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.progressCallback = callback
}

// SendProgressUpdate sends a progress update using the configured callback
func (tm *TransferManager) SendProgressUpdate(userSession string, progress models.TransferProgress) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	// Store the transfer progress
	tm.activeTransfers[progress.ID] = &progress

	// Call the progress callback if set
	if tm.progressCallback != nil {
		tm.progressCallback(userSession, progress)
	}
}

// GetActiveTransfers returns a copy of all active transfers
func (tm *TransferManager) GetActiveTransfers() map[string]*models.TransferProgress {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	result := make(map[string]*models.TransferProgress)
	for id, progress := range tm.activeTransfers {
		// Create a copy to avoid race conditions
		progressCopy := *progress
		result[id] = &progressCopy
	}
	return result
}

// RemoveTransfer removes a completed or failed transfer
func (tm *TransferManager) RemoveTransfer(transferID string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	delete(tm.activeTransfers, transferID)
}

// Global transfer manager instance
var GlobalTransferManager = NewTransferManager()
