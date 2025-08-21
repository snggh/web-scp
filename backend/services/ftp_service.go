package services

import (
	"context"
	"fmt"
	"io"
	"net"
	"strconv"
	"time"

	"github.com/jlaffaye/ftp"

	"github.com/user/web-scp/models"
)

type FTPService struct {
	config *FTPConfig
}

type FTPConfig struct {
	ConnectTimeout time.Duration
	ReadTimeout    time.Duration
	WriteTimeout   time.Duration
}

type FTPClient struct {
	ftpClient *ftp.ServerConn
	config    models.ConnectionRequest
}

func NewFTPService(config *FTPConfig) *FTPService {
	if config == nil {
		config = &FTPConfig{
			ConnectTimeout: 30 * time.Second,
			ReadTimeout:    30 * time.Second,
			WriteTimeout:   30 * time.Second,
		}
	}

	return &FTPService{
		config: config,
	}
}

func (s *FTPService) Connect(ctx context.Context, config models.ConnectionRequest) (*FTPClient, error) {
	if config.Protocol != models.FTP {
		return nil, fmt.Errorf("invalid protocol, expected FTP")
	}

	// Create FTP connection
	resolvedHost := s.resolveHost(config.Host)
	address := net.JoinHostPort(resolvedHost, strconv.Itoa(config.Port))
	
	conn, err := ftp.Dial(address, ftp.DialWithTimeout(s.config.ConnectTimeout))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to FTP server: %w", err)
	}

	// Login to FTP server
	err = conn.Login(config.Username, config.Password)
	if err != nil {
		conn.Quit()
		return nil, fmt.Errorf("failed to login to FTP server: %w", err)
	}

	client := &FTPClient{
		ftpClient: conn,
		config:    config,
	}

	return client, nil
}

func (s *FTPService) TestConnection(ctx context.Context, config models.TestConnectionRequest) error {
	// Convert TestConnectionRequest to ConnectionRequest
	connConfig := models.ConnectionRequest{
		Protocol: config.Protocol,
		Host:     config.Host,
		Port:     config.Port,
		Username: config.Username,
		Password: config.Password,
	}

	client, err := s.Connect(ctx, connConfig)
	if err != nil {
		return err
	}
	defer client.Close()

	// Test basic functionality by listing current directory
	_, err = client.ftpClient.List("/")
	if err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}

	return nil
}

func (c *FTPClient) ListFiles(path string) ([]models.FileInfo, error) {
	if path == "" {
		path = "/"
	}

	// Change to the specified directory
	if path != "/" {
		err := c.ftpClient.ChangeDir(path)
		if err != nil {
			return nil, fmt.Errorf("failed to change directory: %w", err)
		}
		defer c.ftpClient.ChangeDir("/") // Return to root
	}

	entries, err := c.ftpClient.List(".")
	if err != nil {
		return nil, fmt.Errorf("failed to list directory: %w", err)
	}

	files := make([]models.FileInfo, 0, len(entries))
	for _, entry := range entries {
		fileType := "file"
		if entry.Type == ftp.EntryTypeFolder {
			fileType = "directory"
		}

		// Build full path
		fullPath := path
		if path != "/" {
			fullPath += "/"
		}
		fullPath += entry.Name

		fileInfo := models.FileInfo{
			Name:        entry.Name,
			Size:        int64(entry.Size),
			Type:        fileType,
			Permissions: "", // FTP doesn't typically provide Unix-style permissions
			Modified:    entry.Time,
			Path:        fullPath,
		}
		files = append(files, fileInfo)
	}

	return files, nil
}

func (c *FTPClient) CreateDirectory(path string) error {
	err := c.ftpClient.MakeDir(path)
	if err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	return nil
}

func (c *FTPClient) DeleteFile(path string) error {
	// Try to delete as file first
	err := c.ftpClient.Delete(path)
	if err != nil {
		// If file deletion fails, try to remove as directory
		err = c.ftpClient.RemoveDir(path)
		if err != nil {
			return fmt.Errorf("failed to delete: %w", err)
		}
	}
	return nil
}

func (c *FTPClient) RenameFile(oldPath, newPath string) error {
	err := c.ftpClient.Rename(oldPath, newPath)
	if err != nil {
		return fmt.Errorf("failed to rename file: %w", err)
	}
	return nil
}

func (c *FTPClient) UploadFile(reader io.Reader, remotePath string) error {
	err := c.ftpClient.Stor(remotePath, reader)
	if err != nil {
		return fmt.Errorf("failed to upload file: %w", err)
	}
	return nil
}

func (c *FTPClient) DownloadFile(remotePath string, writer io.Writer) error {
	response, err := c.ftpClient.Retr(remotePath)
	if err != nil {
		return fmt.Errorf("failed to start download: %w", err)
	}
	defer response.Close()

	_, err = io.Copy(writer, response)
	if err != nil {
		return fmt.Errorf("failed to download file: %w", err)
	}

	return nil
}

func (c *FTPClient) GetWorkingDirectory() (string, error) {
	path, err := c.ftpClient.CurrentDir()
	if err != nil {
		return "", fmt.Errorf("failed to get working directory: %w", err)
	}
	return path, nil
}

func (c *FTPClient) ChangeDirectory(path string) error {
	err := c.ftpClient.ChangeDir(path)
	if err != nil {
		return fmt.Errorf("failed to change directory: %w", err)
	}
	return nil
}

func (c *FTPClient) Close() error {
	if c.ftpClient != nil {
		err := c.ftpClient.Quit()
		if err != nil {
			return fmt.Errorf("failed to close FTP connection: %w", err)
		}
	}
	return nil
}

// resolveHost translates localhost addresses to work within Docker containers
func (s *FTPService) resolveHost(host string) string {
	// When running in Docker, localhost/127.0.0.1 refers to the container itself
	// We need to use host.docker.internal to reach the host machine
	if host == "localhost" || host == "127.0.0.1" || host == "0.0.0.0" {
		return "host.docker.internal"
	}
	return host
}

// Global FTP service instance
var GlobalFTPService *FTPService

func InitFTPService(config *FTPConfig) {
	GlobalFTPService = NewFTPService(config)
}