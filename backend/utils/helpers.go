package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/user/web-scp/models"
)

// GenerateID generates a random ID string
func GenerateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// RespondSuccess sends a successful API response
func RespondSuccess(c *fiber.Ctx, data interface{}) error {
	return c.JSON(models.APIResponse{
		Success: true,
		Data:    data,
	})
}

// RespondError sends an error API response
func RespondError(c *fiber.Ctx, statusCode int, message string) error {
	return c.Status(statusCode).JSON(models.APIResponse{
		Success: false,
		Error:   message,
	})
}

// FormatFileSize formats bytes to human readable string
func FormatFileSize(bytes int64) string {
	if bytes == 0 {
		return "0 B"
	}
	
	const unit = 1024
	sizes := []string{"B", "KB", "MB", "GB", "TB"}
	
	if bytes < unit {
		return fmt.Sprintf("%d %s", bytes, sizes[0])
	}
	
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	
	return fmt.Sprintf("%.1f %s", float64(bytes)/float64(div), sizes[exp+1])
}

// CalculateProgress calculates transfer progress percentage
func CalculateProgress(current, total int64) float64 {
	if total == 0 {
		return 0
	}
	return float64(current) / float64(total) * 100
}

// CalculateSpeed calculates transfer speed in bytes per second
func CalculateSpeed(bytes int64, duration time.Duration) int64 {
	if duration.Seconds() == 0 {
		return 0
	}
	return int64(float64(bytes) / duration.Seconds())
}

// EstimateRemainingTime estimates remaining transfer time in seconds
func EstimateRemainingTime(current, total int64, speed int64) int64 {
	if speed == 0 || current >= total {
		return 0
	}
	remaining := total - current
	return remaining / speed
}