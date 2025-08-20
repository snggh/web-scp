package models

import "time"

type Protocol string

const (
	FTP  Protocol = "ftp"
	SFTP Protocol = "sftp"
)

type ConnectionRequest struct {
	Name     string   `json:"name" validate:"required"`
	Protocol Protocol `json:"protocol" validate:"required,oneof=ftp sftp"`
	Host     string   `json:"host" validate:"required"`
	Port     int      `json:"port" validate:"required,min=1,max=65535"`
	Username string   `json:"username" validate:"required"`
	Password string   `json:"password"`
	KeyFile  string   `json:"keyFile"`
}

type TestConnectionRequest struct {
	Protocol Protocol `json:"protocol" validate:"required,oneof=ftp sftp"`
	Host     string   `json:"host" validate:"required"`
	Port     int      `json:"port" validate:"required,min=1,max=65535"`
	Username string   `json:"username" validate:"required"`
	Password string   `json:"password"`
	KeyFile  string   `json:"keyFile"`
}

type Connection struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Protocol     Protocol  `json:"protocol"`
	Host         string    `json:"host"`
	Port         int       `json:"port"`
	Username     string    `json:"username"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	LastAccessed time.Time `json:"lastAccessed"`
}

type FileInfo struct {
	Name        string    `json:"name"`
	Size        int64     `json:"size"`
	Type        string    `json:"type"`
	Permissions string    `json:"permissions"`
	Modified    time.Time `json:"modified"`
	Path        string    `json:"path"`
}

type TransferProgress struct {
	ID           string  `json:"id"`
	Type         string  `json:"type"`
	FileName     string  `json:"fileName"`
	Progress     float64 `json:"progress"`
	Speed        int64   `json:"speed"`
	RemainingTime int64  `json:"remainingTime"`
	Status       string  `json:"status"`
	Error        string  `json:"error,omitempty"`
}

type WSMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}