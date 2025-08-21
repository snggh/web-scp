package handlers

import (
	"fmt"
	"net/url"

	"github.com/gofiber/fiber/v2"

	"github.com/user/web-scp/models"
	"github.com/user/web-scp/services"
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

// Global file handler instance
var GlobalFileHandler *FileHandler

func InitFileHandler(poolManager *services.PoolManager) {
	GlobalFileHandler = NewFileHandler(poolManager)
}