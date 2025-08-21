package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
	
	"github.com/user/web-scp/config"
	"github.com/user/web-scp/handlers"
	"github.com/user/web-scp/services"
)

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize services
	poolConfig := &services.PoolConfig{
		MaxConnectionsPerUser: cfg.MaxConnectionsPerUser,
		ConnectionTimeout:     30 * time.Minute, // Extended for debugging
		CleanupInterval:       2 * time.Minute,  // More frequent cleanup for debugging
	}
	services.InitPoolManager(poolConfig)

	sftpConfig := &services.SFTPConfig{
		ConnectTimeout: 30 * time.Second,
		KeepAlive:      30 * time.Second,
	}
	services.InitSFTPService(sftpConfig)

	ftpConfig := &services.FTPConfig{
		ConnectTimeout: 30 * time.Second,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   30 * time.Second,
	}
	services.InitFTPService(ftpConfig)

	// Initialize handlers
	handlers.InitAuthHandler(cfg)
	handlers.InitConnectionHandler(services.GlobalPoolManager, services.GlobalSFTPService, services.GlobalFTPService)
	handlers.InitFileHandler(services.GlobalPoolManager)

	// Start WebSocket hub
	go handlers.GlobalHub.Run()

	// Create Fiber app
	app := fiber.New(fiber.Config{
		ServerHeader: "Web-SCP",
		AppName:      "Web-SCP v1.0.0",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     getEnv("CORS_ORIGINS", "http://localhost:5173"),
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Session-ID",
		AllowCredentials: true,
	}))

	// Health check route
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "web-scp-backend",
		})
	})

	// API routes
	api := app.Group("/api")
	
	// Auth routes
	auth := api.Group("/auth")
	auth.Post("/login", handlers.GlobalAuthHandler.Login)
	auth.Post("/logout", handlers.GlobalAuthHandler.Logout)
	auth.Get("/me", handlers.GlobalAuthHandler.AuthMiddleware, handlers.GlobalAuthHandler.GetCurrentUser)
	auth.Post("/refresh", handlers.GlobalAuthHandler.AuthMiddleware, handlers.GlobalAuthHandler.RefreshToken)

	// Connection routes (protected)
	connections := api.Group("/connections")
	connections.Use(handlers.GlobalAuthHandler.OptionalAuthMiddleware) // Allow both authenticated and anonymous access for testing
	connections.Post("/test", handlers.GlobalConnectionHandler.TestConnection)
	connections.Post("/connect", handlers.GlobalConnectionHandler.Connect)
	connections.Get("/", handlers.GlobalConnectionHandler.ListConnections)
	connections.Get("/:id", handlers.GlobalConnectionHandler.GetConnectionStatus)
	connections.Delete("/:id", handlers.GlobalConnectionHandler.Disconnect)

	// File routes
	files := api.Group("/files")
	files.Use(handlers.GlobalAuthHandler.OptionalAuthMiddleware) // Allow both authenticated and anonymous access for testing
	files.Get("/list", handlers.GlobalFileHandler.ListFiles)
	files.Post("/mkdir", handlers.GlobalFileHandler.CreateDirectory)
	files.Delete("/delete", handlers.GlobalFileHandler.DeleteFile)
	files.Put("/rename", handlers.GlobalFileHandler.RenameFile)

	// Transfer routes
	transfer := api.Group("/transfer")
	transfer.Post("/upload", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "Transfer upload endpoint"})
	})
	transfer.Get("/download", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "Transfer download endpoint"})
	})
	transfer.Get("/queue", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "Transfer queue endpoint"})
	})
	transfer.Delete("/:id", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "Transfer cancel endpoint"})
	})

	// WebSocket route
	app.Get("/ws", handlers.GlobalHub.HandleWebSocket)

	// Setup graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	
	go func() {
		<-c
		log.Println("Shutting down server...")
		
		// Cleanup connections
		if services.GlobalPoolManager != nil {
			services.GlobalPoolManager.Shutdown()
		}
		
		app.Shutdown()
	}()

	// Start server
	port := getEnv("PORT", "3000")
	log.Printf("Server starting on port %s", port)
	log.Printf("Connection pool initialized with max %d connections per user", cfg.MaxConnectionsPerUser)
	log.Fatal(app.Listen(":" + port))
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}