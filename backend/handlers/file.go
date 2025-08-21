package handlers

import (
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/user/web-scp/models"
	"github.com/user/web-scp/services"
	"github.com/user/web-scp/transfer"
)

type FileHandler struct {
	poolManager *services.PoolManager
}

func NewFileHandler(poolManager *services.PoolManager) *FileHandler {
	return &FileHandler{
		poolManager: poolManager,
	}
}

// ListFiles lists files and directories in the specified path
func (h *FileHandler) ListFiles(c *fiber.Ctx) error {
	connectionID := c.Query("connectionId")
	if connectionID == "" {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Connection ID is required",
		})
	}

	path := c.Query("path", "/")
	
	// URL decode the path in case it contains special characters
	decodedPath, err := url.QueryUnescape(path)
	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid path format",
		})
	}

		// Get user session
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}



	// Get connection from pool
	pooledConn, err := h.poolManager.GetConnection(userSession, connectionID)
	if err != nil {
		return c.Status(404).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Connection not found: %v", err),
		})
	}

	var files []models.FileInfo

	// List files based on protocol
	switch pooledConn.Protocol {
	case models.SFTP:
		sftpClient, ok := pooledConn.Client.(*services.SFTPClient)
		if !ok {
			return c.Status(500).JSON(models.APIResponse{
				Success: false,
				Error:   "Invalid SFTP client",
			})
		}
		files, err = sftpClient.ListFiles(decodedPath)
	case models.FTP:
		ftpClient, ok := pooledConn.Client.(*services.FTPClient)
		if !ok {
			return c.Status(500).JSON(models.APIResponse{
				Success: false,
				Error:   "Invalid FTP client",
			})
		}
		files, err = ftpClient.ListFiles(decodedPath)
	default:
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Unsupported protocol",
		})
	}

	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to list files: %v", err),
		})
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data: fiber.Map{
			"files":      files,
			"path":       decodedPath,
			"connection": connectionID,
		},
	})
}

// CreateDirectory creates a new directory
func (h *FileHandler) CreateDirectory(c *fiber.Ctx) error {
	var req struct {
		ConnectionID string `json:"connectionId" validate:"required"`
		Path         string `json:"path" validate:"required"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}

	// Get user session
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	// Get connection from pool
	pooledConn, err := h.poolManager.GetConnection(userSession, req.ConnectionID)
	if err != nil {
		return c.Status(404).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Connection not found: %v", err),
		})
	}

	// Create directory based on protocol
	switch pooledConn.Protocol {
	case models.SFTP:
		sftpClient, ok := pooledConn.Client.(*services.SFTPClient)
		if !ok {
			return c.Status(500).JSON(models.APIResponse{
				Success: false,
				Error:   "Invalid SFTP client",
			})
		}
		err = sftpClient.CreateDirectory(req.Path)
	case models.FTP:
		ftpClient, ok := pooledConn.Client.(*services.FTPClient)
		if !ok {
			return c.Status(500).JSON(models.APIResponse{
				Success: false,
				Error:   "Invalid FTP client",
			})
		}
		err = ftpClient.CreateDirectory(req.Path)
	default:
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Unsupported protocol",
		})
	}

	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to create directory: %v", err),
		})
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"message": "Directory created successfully"},
	})
}

// DeleteFile deletes a file or directory
func (h *FileHandler) DeleteFile(c *fiber.Ctx) error {
	var req struct {
		ConnectionID string `json:"connectionId" validate:"required"`
		Path         string `json:"path" validate:"required"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}

	// Get user session
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	// Get connection from pool
	pooledConn, err := h.poolManager.GetConnection(userSession, req.ConnectionID)
	if err != nil {
		return c.Status(404).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Connection not found: %v", err),
		})
	}

	// Delete file based on protocol
	switch pooledConn.Protocol {
	case models.SFTP:
		sftpClient, ok := pooledConn.Client.(*services.SFTPClient)
		if !ok {
			return c.Status(500).JSON(models.APIResponse{
				Success: false,
				Error:   "Invalid SFTP client",
			})
		}
		err = sftpClient.DeleteFile(req.Path)
	case models.FTP:
		ftpClient, ok := pooledConn.Client.(*services.FTPClient)
		if !ok {
			return c.Status(500).JSON(models.APIResponse{
				Success: false,
				Error:   "Invalid FTP client",
			})
		}
		err = ftpClient.DeleteFile(req.Path)
	default:
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Unsupported protocol",
		})
	}

	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to delete file: %v", err),
		})
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"message": "File deleted successfully"},
	})
}

// RenameFile renames a file or directory
func (h *FileHandler) RenameFile(c *fiber.Ctx) error {
	var req struct {
		ConnectionID string `json:"connectionId" validate:"required"`
		OldPath      string `json:"oldPath" validate:"required"`
		NewPath      string `json:"newPath" validate:"required"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}

	// Get user session
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	// Get connection from pool
	pooledConn, err := h.poolManager.GetConnection(userSession, req.ConnectionID)
	if err != nil {
		return c.Status(404).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Connection not found: %v", err),
		})
	}

	// Rename file based on protocol
	switch pooledConn.Protocol {
	case models.SFTP:
		sftpClient, ok := pooledConn.Client.(*services.SFTPClient)
		if !ok {
			return c.Status(500).JSON(models.APIResponse{
				Success: false,
				Error:   "Invalid SFTP client",
			})
		}
		err = sftpClient.RenameFile(req.OldPath, req.NewPath)
	case models.FTP:
		ftpClient, ok := pooledConn.Client.(*services.FTPClient)
		if !ok {
			return c.Status(500).JSON(models.APIResponse{
				Success: false,
				Error:   "Invalid FTP client",
			})
		}
		err = ftpClient.RenameFile(req.OldPath, req.NewPath)
	default:
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Unsupported protocol",
		})
	}

	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to rename file: %v", err),
		})
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"message": "File renamed successfully"},
	})
}

// UploadFile handles file upload with progress tracking
func (h *FileHandler) UploadFile(c *fiber.Ctx) error {
	// Get form data
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "No file provided",
		})
	}

	connectionID := c.FormValue("connectionId")
	if connectionID == "" {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Connection ID is required",
		})
	}

	remotePath := c.FormValue("remotePath", "/")
	if remotePath == "" {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Remote path is required",
		})
	}

	// Get user session
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	// Get connection from pool
	pooledConn, err := h.poolManager.GetConnection(userSession, connectionID)
	if err != nil {
		return c.Status(404).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Connection not found: %v", err),
		})
	}

	// Open uploaded file
	src, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to open uploaded file: %v", err),
		})
	}
	defer src.Close()

	// Create temporary file for streaming
	tempFile, err := os.CreateTemp("", "web-scp-upload-*")
	if err != nil {
		return c.Status(500).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to create temporary file: %v", err),
		})
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	// Start progress tracking goroutine
	transferID := fmt.Sprintf("upload-%d", time.Now().Unix())
	done := make(chan error, 1)

	go func() {
		defer close(done)

		// Copy to temp file with progress tracking
		buffer := make([]byte, 64*1024) // 64KB buffer
		totalSize := file.Size
		var uploaded int64

		for {
			n, readErr := src.Read(buffer)
			if n > 0 {
				_, writeErr := tempFile.Write(buffer[:n])
				if writeErr != nil {
					done <- fmt.Errorf("failed to write to temp file: %w", writeErr)
					return
				}
				uploaded += int64(n)

				// Send progress update
				progress := float64(uploaded) / float64(totalSize) * 100
				h.sendProgressUpdate(userSession, models.TransferProgress{
					ID:       transferID,
					Type:     "upload",
					FileName: file.Filename,
					Progress: progress,
					Status:   "transferring",
				})
			}

			if readErr != nil {
				if readErr == io.EOF {
					break
				}
				done <- fmt.Errorf("failed to read uploaded file: %w", readErr)
				return
			}
		}

		// Upload to remote server
		switch pooledConn.Protocol {
		case models.SFTP:
			sftpClient, ok := pooledConn.Client.(*services.SFTPClient)
			if !ok {
				done <- fmt.Errorf("invalid SFTP client")
				return
			}

			// Reset temp file for reading
			tempFile.Seek(0, 0)
			err = sftpClient.UploadFile(tempFile.Name(), remotePath)
		case models.FTP:
			ftpClient, ok := pooledConn.Client.(*services.FTPClient)
			if !ok {
				done <- fmt.Errorf("invalid FTP client")
				return
			}

			// Reset temp file for reading
			tempFile.Seek(0, 0)
			err = ftpClient.UploadFile(tempFile, remotePath)
		default:
			done <- fmt.Errorf("unsupported protocol")
			return
		}

		if err != nil {
			done <- fmt.Errorf("failed to upload file: %w", err)
			return
		}

		done <- nil
	}()

	// Wait for completion or error
	if err := <-done; err != nil {
		h.sendProgressUpdate(userSession, models.TransferProgress{
			ID:       transferID,
			Type:     "upload",
			FileName: file.Filename,
			Status:   "error",
			Error:    err.Error(),
		})
		return c.Status(500).JSON(models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	// Send completion update
	h.sendProgressUpdate(userSession, models.TransferProgress{
		ID:       transferID,
		Type:     "upload",
		FileName: file.Filename,
		Progress: 100,
		Status:   "completed",
	})

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"message": "File uploaded successfully", "transferId": transferID},
	})
}

// DownloadFile handles file download with progress tracking
func (h *FileHandler) DownloadFile(c *fiber.Ctx) error {
	var req struct {
		ConnectionID string `json:"connectionId" validate:"required"`
		RemotePath   string `json:"remotePath" validate:"required"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}

	// Get user session
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	// Get connection from pool
	pooledConn, err := h.poolManager.GetConnection(userSession, req.ConnectionID)
	if err != nil {
		return c.Status(404).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Connection not found: %v", err),
		})
	}

	// Create temporary file for download
	tempFile, err := os.CreateTemp("", "web-scp-download-*")
	if err != nil {
		return c.Status(500).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to create temporary file: %v", err),
		})
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	// Start progress tracking goroutine
	transferID := fmt.Sprintf("download-%d", time.Now().Unix())
	fileName := filepath.Base(req.RemotePath)
	done := make(chan error, 1)

	go func() {
		defer close(done)

		var fileSize int64
		var downloadErr error

		// Get file size first for progress tracking
		switch pooledConn.Protocol {
		case models.SFTP:
			sftpClient, ok := pooledConn.Client.(*services.SFTPClient)
			if !ok {
				done <- fmt.Errorf("invalid SFTP client")
				return
			}

			stat, err := sftpClient.GetFileStat(req.RemotePath)
			if err != nil {
				done <- fmt.Errorf("failed to stat remote file: %w", err)
				return
			}
			fileSize = stat.Size()

			downloadErr = sftpClient.DownloadFile(req.RemotePath, tempFile.Name())
		case models.FTP:
			ftpClient, ok := pooledConn.Client.(*services.FTPClient)
			if !ok {
				done <- fmt.Errorf("invalid FTP client")
				return
			}

			// For FTP, we'll track progress during download
			downloadErr = ftpClient.DownloadFile(req.RemotePath, tempFile)
		default:
			done <- fmt.Errorf("unsupported protocol")
			return
		}

		if downloadErr != nil {
			done <- fmt.Errorf("failed to download file: %w", downloadErr)
			return
		}

		// If we couldn't get file size, just report completion
		if fileSize == 0 {
			h.sendProgressUpdate(userSession, models.TransferProgress{
				ID:       transferID,
				Type:     "download",
				FileName: fileName,
				Progress: 100,
				Status:   "completed",
			})
			done <- nil
			return
		}

		// Track download progress
		buffer := make([]byte, 64*1024) // 64KB buffer
		tempFile.Seek(0, 0)
		var downloaded int64
		startTime := time.Now()

		for {
			n, readErr := tempFile.Read(buffer)
			if n > 0 {
				downloaded += int64(n)

				// Calculate progress and speed
				progress := float64(downloaded) / float64(fileSize) * 100
				elapsed := time.Since(startTime).Seconds()
				if elapsed > 0 {
					speed := int64(float64(downloaded) / elapsed)
					remainingBytes := fileSize - downloaded
					remainingTime := int64(float64(remainingBytes) / float64(speed))

					h.sendProgressUpdate(userSession, models.TransferProgress{
						ID:           transferID,
						Type:         "download",
						FileName:     fileName,
						Progress:     progress,
						Speed:        speed,
						RemainingTime: remainingTime,
						Status:       "transferring",
					})
				}
			}

			if readErr != nil {
				if readErr == io.EOF {
					break
				}
				done <- fmt.Errorf("failed to read downloaded file: %w", readErr)
				return
			}
		}

		done <- nil
	}()

	// Wait for completion or error
	if err := <-done; err != nil {
		h.sendProgressUpdate(userSession, models.TransferProgress{
			ID:       transferID,
			Type:     "download",
			FileName: fileName,
			Status:   "error",
			Error:    err.Error(),
		})
		return c.Status(500).JSON(models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	// Send completion update
	h.sendProgressUpdate(userSession, models.TransferProgress{
		ID:       transferID,
		Type:     "download",
		FileName: fileName,
		Progress: 100,
		Status:   "completed",
	})

	// Read the downloaded file and return it
	tempFile.Seek(0, 0)
	fileData, err := io.ReadAll(tempFile)
	if err != nil {
		return c.Status(500).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to read downloaded file: %v", err),
		})
	}

	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	c.Set("Content-Type", "application/octet-stream")

	return c.Send(fileData)
}

// Helper method to send progress updates via transfer manager
func (h *FileHandler) sendProgressUpdate(userSession string, progress models.TransferProgress) {
	// Use the transfer manager to send progress updates
	// This will automatically broadcast to the correct WebSocket clients
	transfer.GlobalTransferManager.SendProgressUpdate(userSession, progress)
}

// Global file handler instance
var GlobalFileHandler *FileHandler

func InitFileHandler(poolManager *services.PoolManager) {
	GlobalFileHandler = NewFileHandler(poolManager)
}