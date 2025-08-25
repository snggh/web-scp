package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"

	"github.com/user/web-scp/models"
	"github.com/user/web-scp/services"
)

type HostKeyHandler struct{}

func NewHostKeyHandler() *HostKeyHandler {
	return &HostKeyHandler{}
}

// TrustHostKey handles user's decision to trust or reject a host key
func (h *HostKeyHandler) TrustHostKey(c *fiber.Ctx) error {
	var req models.TrustHostKeyRequest
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

	// Verify the user session matches the request
	if userSession != req.UserSession {
		return c.Status(403).JSON(models.APIResponse{
			Success: false,
			Error:   "Session mismatch",
		})
	}

	if !req.Trust {
		// User rejected the host key - return error
		return c.Status(403).JSON(models.APIResponse{
			Success: false,
			Error:   "Host key verification rejected by user",
		})
	}

	// User decided to trust the host key - approve the pending key
	err := services.GlobalHostKeyManager.TrustPendingHostKey(
		userSession,
		req.Host,
		req.Port,
		req.Username,
		req.Fingerprint,
	)
	if err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to trust host key: %v", err),
		})
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data: fiber.Map{
			"message":     "Host key trusted successfully",
			"fingerprint": req.Fingerprint,
			"hostId":      req.Username + "@" + req.Host + ":" + req.Port,
		},
	})
}

// GetTrustedHosts returns the list of trusted hosts for the current session
func (h *HostKeyHandler) GetTrustedHosts(c *fiber.Ctx) error {
	// Get user session
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	trustedHosts := services.GlobalHostKeyManager.GetTrustedHosts(userSession)

	return c.JSON(models.APIResponse{
		Success: true,
		Data: fiber.Map{
			"trustedHosts": trustedHosts,
			"count":        len(trustedHosts),
		},
	})
}

// ClearTrustedHosts clears all trusted hosts for the current session
func (h *HostKeyHandler) ClearTrustedHosts(c *fiber.Ctx) error {
	// Get user session
	userSession := c.Get("X-Session-ID")
	if userSession == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User session not found",
		})
	}

	services.GlobalHostKeyManager.ClearSession(userSession)

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"message": "All trusted hosts cleared for session"},
	})
}

// Global host key handler instance
var GlobalHostKeyHandler *HostKeyHandler

func InitHostKeyHandler() {
	GlobalHostKeyHandler = NewHostKeyHandler()
}
