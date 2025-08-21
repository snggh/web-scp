package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/user/web-scp/config"
	"github.com/user/web-scp/models"
)

type AuthHandler struct {
	jwtSecret string
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	Token       string `json:"token"`
	UserSession string `json:"userSession"`
	ExpiresAt   int64  `json:"expiresAt"`
}

type JWTClaims struct {
	UserSession string `json:"userSession"`
	Username    string `json:"username"`
	jwt.RegisteredClaims
}

func NewAuthHandler(jwtSecret string) *AuthHandler {
	return &AuthHandler{
		jwtSecret: jwtSecret,
	}
}

// Login creates a new session and returns JWT token
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}

	// TODO: Implement proper user authentication
	// For now, we'll accept any username/password combination
	// In production, this should validate against a user database
	if req.Username == "" || req.Password == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid credentials",
		})
	}

	// Generate user session ID
	userSession := uuid.New().String()

	// Create JWT token
	expiresAt := time.Now().Add(24 * time.Hour) // 24 hour expiry
	claims := JWTClaims{
		UserSession: userSession,
		Username:    req.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "web-scp",
			Subject:   req.Username,
			ID:        userSession,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return c.Status(500).JSON(models.APIResponse{
			Success: false,
			Error:   "Failed to generate token",
		})
	}

	response := LoginResponse{
		Token:       tokenString,
		UserSession: userSession,
		ExpiresAt:   expiresAt.Unix(),
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// Logout invalidates the current session
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	// TODO: Implement token blacklisting for logout
	// For now, we'll just return success since JWT tokens are stateless
	return c.JSON(models.APIResponse{
		Success: true,
		Data:    fiber.Map{"message": "Logged out successfully"},
	})
}

// ValidateToken extracts and validates JWT token from request
func (h *AuthHandler) ValidateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(h.jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}

	return claims, nil
}

// AuthMiddleware is a middleware function to protect routes
func (h *AuthHandler) AuthMiddleware(c *fiber.Ctx) error {
	// Get token from Authorization header
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "Authorization header required",
		})
	}

	// Extract token (format: "Bearer <token>")
	if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid authorization header format",
		})
	}

	tokenString := authHeader[7:]
	claims, err := h.ValidateToken(tokenString)
	if err != nil {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "Invalid or expired token",
		})
	}

	// Store user session in context for use in handlers
	c.Set("X-Session-ID", claims.UserSession)
	c.Set("X-Username", claims.Username)

	return c.Next()
}

// OptionalAuthMiddleware extracts user session if token is present, but doesn't require it
func (h *AuthHandler) OptionalAuthMiddleware(c *fiber.Ctx) error {
	// First, check for X-Session-ID header (for temporary sessions)
	sessionID := c.Get("X-Session-ID")
	if sessionID != "" {
		c.Set("X-Session-ID", sessionID)
		return c.Next()
	}

	// Fallback to JWT token authentication
	authHeader := c.Get("Authorization")
	if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString := authHeader[7:]
		if claims, err := h.ValidateToken(tokenString); err == nil {
			c.Set("X-Session-ID", claims.UserSession)
			c.Set("X-Username", claims.Username)
		}
	}

	return c.Next()
}

// GetCurrentUser returns the current user's information
func (h *AuthHandler) GetCurrentUser(c *fiber.Ctx) error {
	userSession := c.Get("X-Session-ID")
	username := c.Get("X-Username")

	if userSession == "" || username == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User not authenticated",
		})
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data: fiber.Map{
			"userSession": userSession,
			"username":    username,
		},
	})
}

// RefreshToken generates a new token for the current session
func (h *AuthHandler) RefreshToken(c *fiber.Ctx) error {
	userSession := c.Get("X-Session-ID")
	username := c.Get("X-Username")

	if userSession == "" || username == "" {
		return c.Status(401).JSON(models.APIResponse{
			Success: false,
			Error:   "User not authenticated",
		})
	}

	// Generate new JWT token with extended expiry
	expiresAt := time.Now().Add(24 * time.Hour)
	claims := JWTClaims{
		UserSession: userSession,
		Username:    username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "web-scp",
			Subject:   username,
			ID:        userSession,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return c.Status(500).JSON(models.APIResponse{
			Success: false,
			Error:   "Failed to generate token",
		})
	}

	response := LoginResponse{
		Token:       tokenString,
		UserSession: userSession,
		ExpiresAt:   expiresAt.Unix(),
	}

	return c.JSON(models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// Global auth handler instance
var GlobalAuthHandler *AuthHandler

func InitAuthHandler(cfg *config.Config) {
	GlobalAuthHandler = NewAuthHandler(cfg.JWTSecret)
}