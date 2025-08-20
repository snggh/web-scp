# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web-SCP is a modern, web-based file transfer application similar to WinSCP but for the browser. It supports both FTP and SFTP protocols with real-time progress tracking via WebSocket connections. The application uses streaming file transfers without backend storage for efficient memory usage.

## Architecture

### Backend (Go with Fiber)
- **Entry Point**: `main.go` - Fiber web server with API routes and middleware
- **Configuration**: `config/config.go` - Environment-based configuration loader
- **Models**: `models/types.go` - Shared data structures and API types
- **Connection Management**: Connection pooling for FTP/SFTP sessions with timeout handling
- **WebSocket Hub**: `handlers/websocket.go` - Placeholder for real-time progress updates
- **State Management**: In-memory connection and transfer tracking (no database)

### Frontend (React + TypeScript)
- **State Management**: Zustand for client state (`stores/connectionStore.ts`)
- **UI Framework**: React + Tailwind CSS + Shadcn/ui components
- **Build Tool**: Vite with TypeScript
- **Key Components**: ConnectionForm, FileExplorer (dual-pane), TransferQueue
- **API Integration**: TanStack Query for server state management

### Key Architectural Patterns
- **Streaming I/O**: File transfers use `io.Copy` to stream data directly between client and remote server without backend storage
- **Connection Pooling**: Multiple concurrent connections managed per user with configurable limits
- **Real-time Updates**: WebSocket-based progress tracking for file operations
- **Protocol Abstraction**: Common interface for FTP and SFTP operations

## Development Commands

### Backend
```bash
cd backend
go run main.go              # Start development server
go mod download            # Install dependencies
go mod tidy               # Clean up dependencies
go build -o web-scp main.go  # Build binary
```

### Frontend
```bash
cd frontend
npm run dev               # Start development server (Vite)
npm run build            # Production build
npm run lint             # ESLint code checking
npm run preview          # Preview production build
```

### Docker Development
```bash
# Full environment with test SFTP server
docker-compose up         # Start all services
docker-compose up -d      # Start in background
docker-compose down       # Stop services
```

### Test SFTP Server (Docker)
- Host: `localhost:2222`
- Credentials: `testuser:testpass`
- Upload directory: `./test-data`

## Environment Configuration

Backend uses environment variables loaded via godotenv:
- `PORT=3000` - Backend server port
- `JWT_SECRET` - Authentication secret
- `MAX_CONNECTIONS_PER_USER=5` - Connection pool limit
- `CONNECTION_TIMEOUT_MINUTES=15` - Idle connection timeout
- `MAX_UPLOAD_SIZE_MB=5000` - File size limit
- `CORS_ORIGINS=http://localhost:5173` - Frontend URL
- `WS_PATH=/ws` - WebSocket endpoint path

## API Architecture

### Authentication Flow
- JWT-based session management
- Support for password and SSH key authentication (SFTP)
- No persistent user storage - session-based connections

### Connection Management
- Test connections before establishing
- Pool active connections with automatic cleanup
- Thread-safe connection tracking per user session

### File Transfer Protocol
- `POST /api/transfer/upload` - Streaming upload with progress tracking
- `GET /api/transfer/download` - Streaming download
- WebSocket broadcasts for real-time progress updates
- Transfer queue management with pause/cancel support

## Data Flow

1. **Connection Establishment**: Frontend → Test API → Connection Pool → Remote Server
2. **File Operations**: Frontend → API → Connection Pool → Stream I/O → Remote Server  
3. **Progress Updates**: Backend → WebSocket Hub → Frontend State Updates
4. **State Synchronization**: Zustand (client) + Connection Pool (server) + WebSocket events

## Development Workflow

When implementing new features:
1. Start with `models/types.go` for shared data structures
2. Add backend handlers following the existing API pattern
3. Update connection pool management if needed
4. Implement frontend components with TypeScript interfaces
5. Use WebSocket hub for real-time updates
6. Test with included SFTP server on port 2222

## Development Best Practices

### Backend Development (Go)
- **Error Handling**: Always return structured `APIResponse` with success/error fields
- **Resource Management**: Use `defer` for connection cleanup and file closing
- **Concurrency**: Implement proper mutex locking for connection pool management
- **Streaming**: Use `io.Copy` and `io.Pipe` for memory-efficient file transfers
- **Context**: Use `context.Context` for request cancellation and timeouts
- **Validation**: Use `go-playground/validator` for input validation on all API endpoints
- **Logging**: Use structured logging with operation context (connection ID, transfer ID)

### Frontend Development (React + TypeScript)
- **Type Safety**: Define strict TypeScript interfaces for all API responses
- **State Management**: Use Zustand for client state, TanStack Query for server state
- **Error Boundaries**: Implement error boundaries for file transfer components
- **WebSocket Management**: Always handle connection state and implement reconnection logic
- **Performance**: Use React.memo for expensive file list components
- **UI Feedback**: Provide immediate feedback for all user actions with loading states
- **File Handling**: Use FileReader API for client-side file preview and validation

### File Transfer Patterns
- **Chunked Processing**: Process large files in chunks for progress tracking
- **Stream Handling**: Never store entire files in memory - use streaming
- **Progress Tracking**: Update progress via WebSocket with throttling (max 10 updates/sec)
- **Error Recovery**: Implement retry logic for network interruptions
- **Cancellation**: Support transfer cancellation with proper cleanup
- **Security**: Validate file types and sizes before transfer

### Connection Management
- **Pool Lifecycle**: Implement connection timeout and cleanup routines
- **Thread Safety**: Use sync.RWMutex for connection pool read/write operations
- **Resource Limits**: Enforce max connections per user and global limits
- **Health Checks**: Ping connections periodically to detect stale connections
- **Graceful Shutdown**: Properly close all connections on application shutdown

### Testing Strategy
- **Unit Tests**: Test connection pooling, file operations, and state management
- **Integration Tests**: Test with real SFTP server (use Docker test server)
- **WebSocket Tests**: Mock WebSocket connections for frontend components
- **Error Scenarios**: Test connection failures, network interruptions, large files
- **Performance Tests**: Verify memory usage during large file transfers

## Key Implementation Details

- **Streaming Transfers**: All file operations use streaming I/O to avoid memory issues with large files
- **Connection Pooling**: `services/pool_manager.go` handles concurrent connections with timeout management  
- **Real-time Progress**: WebSocket broadcasts transfer progress without polling
- **Protocol Support**: Abstracted FTP/SFTP services for consistent API interface
- **Security**: JWT authentication, no credential persistence, encrypted connections