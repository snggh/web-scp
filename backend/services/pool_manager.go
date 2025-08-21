package services

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/user/web-scp/models"
)

type ConnectionPool struct {
	connections map[string]*PooledConnection
	mutex       sync.RWMutex
	maxConns    int
	timeout     time.Duration
	id          string // Debug ID to track pool instances
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
	pm.mutex.Lock()
	defer pm.mutex.Unlock()
	
	// Clean the session ID to prevent corruption
	cleanSession := strings.TrimSpace(userSession)
	
	// Debug: Print entire pools map contents
	fmt.Printf("GetPool - DEBUG: Requested session '%s' (cleaned: '%s'), Total pools: %d\n", userSession, cleanSession, len(pm.pools))
	for sess, p := range pm.pools {
		fmt.Printf("  MAP['%s'] = PoolID: %s, PoolAddr: %p, Size: %d\n", sess, p.id, p, len(p.connections))
	}
	
	pool, exists := pm.pools[cleanSession]
	
	if !exists {
		poolID := fmt.Sprintf("pool-%d", time.Now().UnixNano())
		fmt.Printf("GetPool - Creating new pool for session: '%s', ID: %s\n", cleanSession, poolID)
		pool = &ConnectionPool{
			connections: make(map[string]*PooledConnection),
			maxConns:    pm.config.MaxConnectionsPerUser,
			timeout:     pm.config.ConnectionTimeout,
			id:          poolID,
		}
		pm.pools[cleanSession] = pool
		fmt.Printf("GetPool - New pool created for session: '%s', ID: %s, PoolAddr: %p\n", cleanSession, poolID, pool)
	} else {
		fmt.Printf("GetPool - Using existing pool for session: '%s', ID: %s, PoolAddr: %p, PoolSize: %d\n", cleanSession, pool.id, pool, len(pool.connections))
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
	fmt.Printf("Creating %s connection for Session: %s, ConnID: %s\n", config.Protocol, userSession, connID)
	
	switch config.Protocol {
	case models.SFTP:
		pooledConn.Client, err = pm.createSFTPConnection(ctx, config)
	case models.FTP:
		pooledConn.Client, err = pm.createFTPConnection(ctx, config)
	default:
		return nil, fmt.Errorf("unsupported protocol: %s", config.Protocol)
	}
	
	if err != nil {
		fmt.Printf("Failed to create %s connection: %v\n", config.Protocol, err)
		return nil, fmt.Errorf("failed to create %s connection: %w", config.Protocol, err)
	}
	
		pooledConn.IsActive = true
	pool.connections[connID] = pooledConn

	fmt.Printf("Created connection - Session: %s, ConnID: %s, Active: %v, Stored in pool, PoolSize: %d, PoolID: %s, PoolAddr: %p\n",
		userSession, connID, pooledConn.IsActive, len(pool.connections), pool.id, pool)
	
	return pooledConn, nil
}

func (pm *PoolManager) GetConnection(userSession, connID string) (*PooledConnection, error) {
	pool := pm.GetPool(userSession)
	
	pool.mutex.RLock()
	conn, exists := pool.connections[connID]
	poolSize := len(pool.connections)
	
	// Debug: List all connections in this pool
	fmt.Printf("Pool contents for session %s (PoolID: %s, PoolAddr: %p):\n", userSession, pool.id, pool)
	for id, c := range pool.connections {
		fmt.Printf("  - ConnID: %s, Active: %v\n", id, c.IsActive)
	}
	
	pool.mutex.RUnlock()
	
	if !exists || !conn.IsActive {
		fmt.Printf("Connection lookup failed - Session: %s, ConnID: %s, Exists: %v, Active: %v, PoolSize: %d\n", 
			userSession, connID, exists, exists && conn.IsActive, poolSize)
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
		fmt.Printf("RemoveConnection called but connection not found - Session: %s, ConnID: %s\n", userSession, connID)
		return fmt.Errorf("connection not found")
	}
	
	fmt.Printf("RemoveConnection called - Session: %s, ConnID: %s\n", userSession, connID)
	
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
				fmt.Printf("Cleaning up expired connection - Session: %s, ConnID: %s, LastUsed: %v ago\n", 
					session, connID, time.Since(conn.LastUsed))
				pm.closeConnection(conn)
				delete(pool.connections, connID)
			}
		}
		
		// Remove empty pools
		if len(pool.connections) == 0 {
			fmt.Printf("Cleanup removing empty pool - Session: %s, PoolAddr: %p\n", session, pool)
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
	// TEMPORARILY DISABLED FOR DEBUGGING
	fmt.Printf("Pool cleanup temporarily disabled for debugging\n")
	<-pm.cleanup
	
	// ticker := time.NewTicker(pm.config.CleanupInterval)
	// defer ticker.Stop()
	
	// for {
	// 	select {
	// 	case <-ticker.C:
	// 		pm.CleanupExpiredConnections()
	// 	case <-pm.cleanup:
	// 		return
	// 	}
	// }
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
			fmt.Printf("Closing SFTP connection: %s\n", conn.ID)
			return sftpClient.Close()
		} else {
			fmt.Printf("SFTP type assertion failed for connection: %s, Type: %T\n", conn.ID, conn.Client)
		}
	case models.FTP:
		// Note: FTPClient type needs to be implemented in ftp_service.go
		if closer, ok := conn.Client.(interface{ Close() error }); ok {
			return closer.Close()
		}
	}
	
	return nil
}

// Global pool manager instance
var GlobalPoolManager *PoolManager

func InitPoolManager(config *PoolConfig) {
	GlobalPoolManager = NewPoolManager(config)
}