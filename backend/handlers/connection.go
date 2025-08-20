package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/user/web-scp/models"
	"github.com/user/web-scp/services"
)

type ConnectionHandler struct {
	poolManager  *services.PoolManager
	sftpService  *services.SFTPService
	ftpService   *services.FTPService
}

func NewConnectionHandler(poolManager *services.PoolManager, sftpService *services.SFTPService, ftpService *services.FTPService) *ConnectionHandler {
	return &ConnectionHandler{
		poolManager: poolManager,
		sftpService: sftpService,
		ftpService:  ftpService,
	}
}

// TestConnection tests a connection without storing it
func (h *ConnectionHandler) TestConnection(c *fiber.Ctx) error {
	var req models.TestConnectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var err error
	switch req.Protocol {
	case models.SFTP:
		err = h.sftpService.TestConnection(ctx, req)
	case models.FTP:
		err = h.ftpService.TestConnection(ctx, req)
	default:
		err = fmt.Errorf("unsupported protocol: %s", req.Protocol)
	}

	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Connection test failed: %v", err),
		})
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"message": "Connection test successful"},
	})
}

// Connect establishes and stores a connection in the pool
func (h *ConnectionHandler) Connect(c *fiber.Ctx) error {
	var req models.ConnectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}

	// Get user session from JWT token or create temporary one for testing
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		// For testing without authentication, create temporary session
		userSession = "temp-session-" + uuid.New().String()[:8]
	}
	connectionID := uuid.New().String()

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create connection in pool
	pooledConn, err := h.poolManager.CreateConnection(ctx, userSession, connectionID, req)
	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to create connection: %v", err),
		})
	}

	// Create response connection object
	connection := models.Connection{
		ID:           pooledConn.ID,
		Name:         req.Name,
		Protocol:     req.Protocol,
		Host:         req.Host,
		Port:         req.Port,
		Username:     req.Username,
		Status:       "connected",
		CreatedAt:    pooledConn.CreatedAt,
		LastAccessed: pooledConn.LastUsed,
	}

	// Store session in context for future requests
	c.Set("X-Session-ID", userSession)

	return c.JSON(models.APIResponse{
		Success: true,
		Data: fiber.Map{
			"connectionId": connectionID,
			"userSession":  userSession,
			"connection":   connection,
		},
	})
}

// Disconnect removes a connection from the pool
func (h *ConnectionHandler) Disconnect(c *fiber.Ctx) error {
	connectionID := c.Params("id")
	if connectionID == "" {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Connection ID is required",
		})
	}

	// Get user session from JWT token
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	err := h.poolManager.RemoveConnection(userSession, connectionID)
	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to disconnect: %v", err),
		})
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"message": "Connection disconnected successfully"},
	})
}

// ListConnections returns all active connections for the user
func (h *ConnectionHandler) ListConnections(c *fiber.Ctx) error {
	// Get user session from JWT token
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	pooledConnections := h.poolManager.ListConnections(userSession)
	
	connections := make([]models.Connection, 0, len(pooledConnections))
	for _, pc := range pooledConnections {
		connection := models.Connection{
			ID:           pc.ID,
			Name:         pc.Config.Name,
			Protocol:     pc.Protocol,
			Host:         pc.Config.Host,
			Port:         pc.Config.Port,
			Username:     pc.Config.Username,
			Status:       "connected",
			CreatedAt:    pc.CreatedAt,
			LastAccessed: pc.LastUsed,
		}
		connections = append(connections, connection)
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"connections": connections},
	})
}

// GetConnectionStatus returns the status of a specific connection
func (h *ConnectionHandler) GetConnectionStatus(c *fiber.Ctx) error {
	connectionID := c.Params("id")
	if connectionID == "" {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Connection ID is required",
		})
	}

	// Get user session from JWT token
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	pooledConn, err := h.poolManager.GetConnection(userSession, connectionID)
	if err != nil {
		return c.Status(404).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Connection not found: %v", err),
		})
	}

	connection := models.Connection{
		ID:           pooledConn.ID,
		Name:         pooledConn.Config.Name,
		Protocol:     pooledConn.Protocol,
		Host:         pooledConn.Config.Host,
		Port:         pooledConn.Config.Port,
		Username:     pooledConn.Config.Username,
		Status:       "connected",
		CreatedAt:    pooledConn.CreatedAt,
		LastAccessed: pooledConn.LastUsed,
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"connection": connection},
	})
}

// Global connection handler instance
var GlobalConnectionHandler *ConnectionHandler

func InitConnectionHandler(poolManager *services.PoolManager, sftpService *services.SFTPService, ftpService *services.FTPService) {
	GlobalConnectionHandler = NewConnectionHandler(poolManager, sftpService, ftpService)
}