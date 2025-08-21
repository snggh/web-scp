package services

import (
	"context"
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"

	"github.com/user/web-scp/models"
)

type SFTPService struct {
	config *SFTPConfig
}

type SFTPConfig struct {
	ConnectTimeout time.Duration
	KeepAlive      time.Duration
}

type SFTPClient struct {
	sshClient  *ssh.Client
	sftpClient *sftp.Client
	config     models.ConnectionRequest
}

func NewSFTPService(config *SFTPConfig) *SFTPService {
	if config == nil {
		config = &SFTPConfig{
			ConnectTimeout: 30 * time.Second,
			KeepAlive:      30 * time.Second,
		}
	}
	
	return &SFTPService{
		config: config,
	}
}

func (s *SFTPService) Connect(ctx context.Context, config models.ConnectionRequest) (*SFTPClient, error) {
	if config.Protocol != models.SFTP {
		return nil, fmt.Errorf("invalid protocol, expected SFTP")
	}

	// Create SSH client configuration
	sshConfig := &ssh.ClientConfig{
		User:            config.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO: Implement proper host key verification
		Timeout:         s.config.ConnectTimeout,
	}

	// Add authentication method
	if config.KeyFile != "" {
		// SSH key authentication
		key, err := s.loadPrivateKey(config.KeyFile, config.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to load private key: %w", err)
		}
		sshConfig.Auth = []ssh.AuthMethod{ssh.PublicKeys(key)}
	} else if config.Password != "" {
		// Password authentication
		sshConfig.Auth = []ssh.AuthMethod{ssh.Password(config.Password)}
	} else {
		return nil, fmt.Errorf("no authentication method provided")
	}

	// Connect to SSH server
	resolvedHost := s.resolveHost(config.Host)
	address := net.JoinHostPort(resolvedHost, strconv.Itoa(config.Port))
	sshClient, err := ssh.Dial("tcp", address, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to SSH server: %w", err)
	}

	// Create SFTP client
	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		sshClient.Close()
		return nil, fmt.Errorf("failed to create SFTP client: %w", err)
	}

	client := &SFTPClient{
		sshClient:  sshClient,
		sftpClient: sftpClient,
		config:     config,
	}

	return client, nil
}

func (s *SFTPService) TestConnection(ctx context.Context, config models.TestConnectionRequest) error {
	// Convert TestConnectionRequest to ConnectionRequest
	connConfig := models.ConnectionRequest{
		Protocol: config.Protocol,
		Host:     config.Host,
		Port:     config.Port,
		Username: config.Username,
		Password: config.Password,
		KeyFile:  config.KeyFile,
	}

	client, err := s.Connect(ctx, connConfig)
	if err != nil {
		return err
	}
	defer client.Close()

	// Test basic functionality by listing root directory
	_, err = client.sftpClient.ReadDir("/")
	if err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}

	return nil
}

func (c *SFTPClient) ListFiles(path string) ([]models.FileInfo, error) {
	if path == "" {
		path = "/"
	}

	fmt.Printf("SFTP ListFiles called for path: %s\n", path)
	entries, err := c.sftpClient.ReadDir(path)
	if err != nil {
		fmt.Printf("SFTP ListFiles error: %v\n", err)
		return nil, fmt.Errorf("failed to list directory: %w", err)
	}
	fmt.Printf("SFTP ListFiles success, found %d entries\n", len(entries))

	files := make([]models.FileInfo, 0, len(entries))
	for _, entry := range entries {
		fileType := "file"
		if entry.IsDir() {
			fileType = "directory"
		}

		fullPath := filepath.Join(path, entry.Name())
		
		fileInfo := models.FileInfo{
			Name:        entry.Name(),
			Size:        entry.Size(),
			Type:        fileType,
			Permissions: entry.Mode().String(),
			Modified:    entry.ModTime(),
			Path:        fullPath,
		}
		files = append(files, fileInfo)
	}

	return files, nil
}

func (c *SFTPClient) CreateDirectory(path string) error {
	err := c.sftpClient.Mkdir(path)
	if err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	return nil
}

func (c *SFTPClient) DeleteFile(path string) error {
	// Check if it's a directory
	stat, err := c.sftpClient.Stat(path)
	if err != nil {
		return fmt.Errorf("failed to stat file: %w", err)
	}

	if stat.IsDir() {
		// Remove directory (must be empty)
		err = c.sftpClient.RemoveDirectory(path)
	} else {
		// Remove file
		err = c.sftpClient.Remove(path)
	}

	if err != nil {
		return fmt.Errorf("failed to delete: %w", err)
	}
	return nil
}

func (c *SFTPClient) RenameFile(oldPath, newPath string) error {
	err := c.sftpClient.Rename(oldPath, newPath)
	if err != nil {
		return fmt.Errorf("failed to rename file: %w", err)
	}
	return nil
}

func (c *SFTPClient) UploadFile(localPath, remotePath string) error {
	// Open local file
	localFile, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("failed to open local file: %w", err)
	}
	defer localFile.Close()

	// Create remote file
	remoteFile, err := c.sftpClient.Create(remotePath)
	if err != nil {
		return fmt.Errorf("failed to create remote file: %w", err)
	}
	defer remoteFile.Close()

	// Copy data
	_, err = remoteFile.ReadFrom(localFile)
	if err != nil {
		return fmt.Errorf("failed to upload file: %w", err)
	}

	return nil
}

func (c *SFTPClient) DownloadFile(remotePath, localPath string) error {
	// Open remote file
	remoteFile, err := c.sftpClient.Open(remotePath)
	if err != nil {
		return fmt.Errorf("failed to open remote file: %w", err)
	}
	defer remoteFile.Close()

	// Create local file
	localFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file: %w", err)
	}
	defer localFile.Close()

	// Copy data
	_, err = localFile.ReadFrom(remoteFile)
	if err != nil {
		return fmt.Errorf("failed to download file: %w", err)
	}

	return nil
}

func (c *SFTPClient) GetWorkingDirectory() (string, error) {
	return c.sftpClient.Getwd()
}

func (c *SFTPClient) ChangeDirectory(path string) error {
	// SFTP doesn't have a change directory command
	// We'll verify the path exists by trying to list it
	_, err := c.sftpClient.ReadDir(path)
	if err != nil {
		return fmt.Errorf("failed to change directory: %w", err)
	}
	return nil
}

func (c *SFTPClient) Close() error {
	var sftpErr, sshErr error
	
	if c.sftpClient != nil {
		sftpErr = c.sftpClient.Close()
	}
	
	if c.sshClient != nil {
		sshErr = c.sshClient.Close()
	}
	
	if sftpErr != nil {
		return fmt.Errorf("failed to close SFTP client: %w", sftpErr)
	}
	if sshErr != nil {
		return fmt.Errorf("failed to close SSH client: %w", sshErr)
	}
	
	return nil
}

func (s *SFTPService) loadPrivateKey(keyPath, passphrase string) (ssh.Signer, error) {
	key, err := ioutil.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key file: %w", err)
	}

	var signer ssh.Signer
	if passphrase != "" {
		signer, err = ssh.ParsePrivateKeyWithPassphrase(key, []byte(passphrase))
	} else {
		signer, err = ssh.ParsePrivateKey(key)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	return signer, nil
}

// resolveHost translates localhost addresses appropriately for the environment
func (s *SFTPService) resolveHost(host string) string {
	// For local development, keep localhost as-is
	// For Docker environment, translate to host.docker.internal
	// This can be improved with environment detection
	if host == "localhost" || host == "127.0.0.1" || host == "0.0.0.0" {
		// Check if we're in Docker by looking for .dockerenv file
		if _, err := os.Stat("/.dockerenv"); err == nil {
			return "host.docker.internal"
		}
		// Local development - keep localhost
		return host
	}
	return host
}

// Global SFTP service instance
var GlobalSFTPService *SFTPService

func InitSFTPService(config *SFTPConfig) {
	GlobalSFTPService = NewSFTPService(config)
}