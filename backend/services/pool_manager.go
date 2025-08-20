package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/user/web-scp/models"
)

type ConnectionPool struct {
	connections map[string]*PooledConnection
	mutex       sync.RWMutex
	maxConns    int
	timeout     time.Duration
}

type PooledConnection struct {
	ID          string
	UserSession string
	Protocol    models.Protocol
	Config      models.ConnectionRequest
	Client      interface{} // Will be *sftp.Client or *ftp.ServerConn
	CreatedAt   time.Time
	LastUsed    time.Time
	IsActive    bool
	mutex       sync.RWMutex
}

type PoolManager struct {
	pools   map[string]*ConnectionPool // userSession -> pool
	mutex   sync.RWMutex
	config  *PoolConfig
	cleanup chan struct{}
}

type PoolConfig struct {
	MaxConnectionsPerUser int
	ConnectionTimeout     time.Duration
	CleanupInterval       time.Duration
}

func NewPoolManager(config *PoolConfig) *PoolManager {
	pm := &PoolManager{
		pools:   make(map[string]*ConnectionPool),
		config:  config,
		cleanup: make(chan struct{}),
	}
	
	// Start cleanup routine
	go pm.startCleanup()
	
	return pm
}

func (pm *PoolManager) GetPool(userSession string) *ConnectionPool {
	pm.mutex.RLock()
	pool, exists := pm.pools[userSession]
	pm.mutex.RUnlock()
	
	if !exists {
		pm.mutex.Lock()
		// Double-check pattern
		if pool, exists = pm.pools[userSession]; !exists {
			pool = &ConnectionPool{
				connections: make(map[string]*PooledConnection),
				maxConns:    pm.config.MaxConnectionsPerUser,
				timeout:     pm.config.ConnectionTimeout,
			}
			pm.pools[userSession] = pool
		}
		pm.mutex.Unlock()
	}
	
	return pool
}

func (pm *PoolManager) CreateConnection(ctx context.Context, userSession, connID string, config models.ConnectionRequest) (*PooledConnection, error) {
	pool := pm.GetPool(userSession)
	
	pool.mutex.Lock()
	defer pool.mutex.Unlock()
	
	// Check if connection already exists
	if conn, exists := pool.connections[connID]; exists {
		if conn.IsActive {
			conn.LastUsed = time.Now()
			return conn, nil
		}
		// Remove inactive connection
		delete(pool.connections, connID)
	}
	
	// Check pool limits
	if len(pool.connections) >= pool.maxConns {
		return nil, fmt.Errorf("maximum connections reached for user session")
	}
	
	// Create new connection
	pooledConn := &PooledConnection{
		ID:          connID,
		UserSession: userSession,
		Protocol:    config.Protocol,
		Config:      config,
		CreatedAt:   time.Now(),
		LastUsed:    time.Now(),
		IsActive:    false,
	}
	
	// Establish actual connection based on protocol
	var err error
	switch config.Protocol {
	case models.SFTP:
		pooledConn.Client, err = pm.createSFTPConnection(ctx, config)
	case models.FTP:
		pooledConn.Client, err = pm.createFTPConnection(ctx, config)
	default:
		return nil, fmt.Errorf("unsupported protocol: %s", config.Protocol)
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to create %s connection: %w", config.Protocol, err)
	}
	
	pooledConn.IsActive = true
	pool.connections[connID] = pooledConn
	
	return pooledConn, nil
}

func (pm *PoolManager) GetConnection(userSession, connID string) (*PooledConnection, error) {
	pool := pm.GetPool(userSession)
	
	pool.mutex.RLock()
	conn, exists := pool.connections[connID]
	pool.mutex.RUnlock()
	
	if !exists || !conn.IsActive {
		return nil, fmt.Errorf("connection not found or inactive")
	}
	
	conn.mutex.Lock()
	conn.LastUsed = time.Now()
	conn.mutex.Unlock()
	
	return conn, nil
}

func (pm *PoolManager) RemoveConnection(userSession, connID string) error {
	pool := pm.GetPool(userSession)
	
	pool.mutex.Lock()
	defer pool.mutex.Unlock()
	
	conn, exists := pool.connections[connID]
	if !exists {
		return fmt.Errorf("connection not found")
	}
	
	// Close the actual connection
	if err := pm.closeConnection(conn); err != nil {
		return fmt.Errorf("failed to close connection: %w", err)
	}
	
	delete(pool.connections, connID)
	return nil
}

func (pm *PoolManager) ListConnections(userSession string) []*PooledConnection {
	pool := pm.GetPool(userSession)
	
	pool.mutex.RLock()
	defer pool.mutex.RUnlock()
	
	connections := make([]*PooledConnection, 0, len(pool.connections))
	for _, conn := range pool.connections {
		if conn.IsActive {
			connections = append(connections, conn)
		}
	}
	
	return connections
}

func (pm *PoolManager) CleanupExpiredConnections() {
	pm.mutex.RLock()
	userSessions := make([]string, 0, len(pm.pools))
	for session := range pm.pools {
		userSessions = append(userSessions, session)
	}
	pm.mutex.RUnlock()
	
	for _, session := range userSessions {
		pool := pm.GetPool(session)
		
		pool.mutex.Lock()
		for connID, conn := range pool.connections {
			if time.Since(conn.LastUsed) > pm.config.ConnectionTimeout {
				pm.closeConnection(conn)
				delete(pool.connections, connID)
			}
		}
		
		// Remove empty pools
		if len(pool.connections) == 0 {
			pm.mutex.Lock()
			delete(pm.pools, session)
			pm.mutex.Unlock()
		}
		pool.mutex.Unlock()
	}
}

func (pm *PoolManager) Shutdown() {
	close(pm.cleanup)
	
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()
	
	for _, pool := range pm.pools {
		pool.mutex.Lock()
		for _, conn := range pool.connections {
			pm.closeConnection(conn)
		}
		pool.mutex.Unlock()
	}
}

func (pm *PoolManager) startCleanup() {
	ticker := time.NewTicker(pm.config.CleanupInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			pm.CleanupExpiredConnections()
		case <-pm.cleanup:
			return
		}
	}
}

func (pm *PoolManager) createSFTPConnection(ctx context.Context, config models.ConnectionRequest) (interface{}, error) {
	if GlobalSFTPService == nil {
		return nil, fmt.Errorf("SFTP service not initialized")
	}
	
	client, err := GlobalSFTPService.Connect(ctx, config)
	if err != nil {
		return nil, err
	}
	
	return client, nil
}

func (pm *PoolManager) createFTPConnection(ctx context.Context, config models.ConnectionRequest) (interface{}, error) {
	if GlobalFTPService == nil {
		return nil, fmt.Errorf("FTP service not initialized")
	}
	
	client, err := GlobalFTPService.Connect(ctx, config)
	if err != nil {
		return nil, err
	}
	
	return client, nil
}

func (pm *PoolManager) closeConnection(conn *PooledConnection) error {
	conn.IsActive = false
	
	if conn.Client == nil {
		return nil
	}
	
	switch conn.Protocol {
	case models.SFTP:
		if sftpClient, ok := conn.Client.(*SFTPClient); ok {
			return sftpClient.Close()
		}
	case models.FTP:
		if ftpClient, ok := conn.Client.(*FTPClient); ok {
			return ftpClient.Close()
		}
	}
	
	return nil
}

// Global pool manager instance
var GlobalPoolManager *PoolManager

func InitPoolManager(config *PoolConfig) {
	GlobalPoolManager = NewPoolManager(config)
}