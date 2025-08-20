package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port                   string
	JWTSecret              string
	MaxConnectionsPerUser  int
	ConnectionTimeout      time.Duration
	MaxUploadSizeMB        int64
	CORSOrigins            string
	WSPath                 string
}

func Load() *Config {
	return &Config{
		Port:                   getEnv("PORT", "3000"),
		JWTSecret:              getEnv("JWT_SECRET", "default-secret-change-in-production"),
		MaxConnectionsPerUser:  getEnvInt("MAX_CONNECTIONS_PER_USER", 5),
		ConnectionTimeout:      time.Duration(getEnvInt("CONNECTION_TIMEOUT_MINUTES", 15)) * time.Minute,
		MaxUploadSizeMB:        int64(getEnvInt("MAX_UPLOAD_SIZE_MB", 5000)),
		CORSOrigins:            getEnv("CORS_ORIGINS", "http://localhost:5173"),
		WSPath:                 getEnv("WS_PATH", "/ws"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return fallback
}