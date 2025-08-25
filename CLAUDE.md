# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web-SCP is a modern, web-based file transfer application similar to WinSCP but for the browser. It supports both FTP and SFTP protocols with real-time progress tracking via WebSocket connections. The application uses streaming file transfers without backend storage for efficient memory usage.

## Architecture

### Backend (Go with Fiber)
- **Entry Point**: `main.go` - Fiber web server with API routes and middleware
- **Configuration**: `config/config.go` - Environment-based configuration loader
- **Models**: `models/types.go` - Shared data structures and API types
- **Connection Management**: `services/pool_manager.go` - Connection pooling with timeout handling and thread-safe operations
- **Protocol Services**: `services/sftp_service.go` and `services/ftp_service.go` - Protocol-specific connection handlers
- **Host Key Management**: `services/hostkey_manager.go` and `handlers/hostkey.go` - SSH host key verification system
- **WebSocket Hub**: `handlers/websocket.go` - Real-time progress updates and transfer notifications
- **State Management**: In-memory connection and transfer tracking (no database)

### Frontend (React + TypeScript)
- **State Management**: Zustand for client state (`stores/connectionStore.ts`) with persistence
- **UI Framework**: React 19 + Tailwind CSS 4 + Shadcn/ui components + Motion for animations
- **Build Tool**: Vite with TypeScript and path aliases (`@/` → `src/`)
- **Key Components**: ConnectionForm, FileExplorer, TransferQueue, ThemeToggle
- **API Integration**: Custom API client (`services/api.ts`) with session management
- **Hooks**: Custom hooks for WebSocket (`useWebSocket.ts`) and keyboard shortcuts (`useKeyboardShortcuts.ts`)

### Key Architectural Patterns
- **Streaming I/O**: File transfers use `io.Copy` to stream data directly between client and remote server without backend storage
- **Connection Pooling**: Multiple concurrent connections managed per user with configurable limits and automatic cleanup
- **Real-time Updates**: WebSocket-based progress tracking for file operations with throttled updates
- **Protocol Abstraction**: Common interface for FTP and SFTP operations with host key verification for SFTP
- **Session Management**: JWT-based authentication with optional middleware for development
- **SSH Authentication**: Support for both password and SSH key authentication (with passphrase support)

## Development Commands

### Backend
```bash
cd backend
go run main.go              # Start development server
go mod download            # Install dependencies
go mod tidy               # Clean up dependencies
go build -o web-scp main.go  # Build binary
go test ./...              # Run tests
go fmt ./...               # Format code
```

### Frontend
```bash
cd frontend
pnpm install               # Install dependencies (prefer pnpm)
pnpm run dev              # Start development server (Vite)
pnpm run build            # Production build
pnpm run lint             # ESLint code checking
pnpm run preview          # Preview production build
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
- JWT-based session management with `X-Session-ID` headers
- Support for password and SSH key authentication (SFTP) with passphrase support
- OptionalAuthMiddleware allows development without strict authentication
- No persistent user storage - session-based connections with automatic cleanup

### Connection Management
- Test connections before establishing via `POST /api/connections/test`
- Pool active connections with automatic cleanup and timeout handling
- Thread-safe connection tracking per user session using sync.RWMutex
- Host key verification for SFTP with trust management endpoints

### File Transfer Protocol
- `POST /api/transfer/upload` - Streaming upload with FormData and progress tracking
- `POST /api/transfer/download` - Streaming download returning blob data
- WebSocket broadcasts at `/ws` for real-time progress updates
- Transfer queue management with client-side state tracking

### Key API Endpoints
- **Connections**: `/api/connections/test`, `/api/connections/connect`, `/api/connections/{id}`
- **Files**: `/api/files/list`, `/api/files/mkdir`, `/api/files/delete`, `/api/files/rename`
- **Transfers**: `/api/transfer/upload`, `/api/transfer/download`
- **Host Keys**: `/api/hostkey/trust`, `/api/hostkey/trusted`
- **WebSocket**: `/ws` for real-time updates

## Data Flow

1. **Connection Establishment**: Frontend → Test API → Host Key Verification → Connection Pool → Remote Server
2. **File Operations**: Frontend → API → Connection Pool → Stream I/O → Remote Server  
3. **Progress Updates**: Backend → WebSocket Hub → Frontend State Updates (Zustand)
4. **State Synchronization**: Zustand (client) + Connection Pool (server) + WebSocket events
5. **Session Management**: API Client manages session IDs in localStorage with automatic restoration

## Development Workflow

When implementing new features:
1. Start with `models/types.go` for shared data structures and validation tags
2. Add backend handlers in `handlers/` following the existing API pattern
3. Update connection pool management in `services/pool_manager.go` if needed
4. Implement frontend components with TypeScript interfaces in `types/index.ts`
5. Use WebSocket hub for real-time updates and progress tracking
6. Update Zustand stores for state management
7. Test with included SFTP server on port 2222 using Docker Compose

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
- **Type Safety**: Define strict TypeScript interfaces for all API responses in `types/index.ts`
- **State Management**: Use Zustand for client state with persistence, custom API client for server communication
- **Component Structure**: Follow Shadcn/ui patterns with proper component composition
- **WebSocket Management**: Use custom `useWebSocket` hook with connection state handling
- **Performance**: Use React.memo and Motion for smooth animations with proper state transitions
- **UI Feedback**: Provide immediate feedback with loading states and progress tracking
- **Keyboard Shortcuts**: Implement global and context-aware keyboard shortcuts with `useKeyboardShortcuts`
- **Theme Support**: Dark/light mode toggle with proper CSS variable management

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
- **Connection Pooling**: `services/pool_manager.go` handles concurrent connections with timeout management and proper cleanup
- **Real-time Progress**: WebSocket broadcasts transfer progress without polling using global hub pattern
- **Protocol Support**: Abstracted FTP/SFTP services for consistent API interface with host key verification
- **Security**: JWT authentication, SSH key support with passphrase, no credential persistence, encrypted connections
- **Host Key Verification**: SFTP connections validate server identity with user trust management
- **Session Persistence**: Frontend maintains connection state across page refreshes using Zustand persistence
- **Development Tools**: Docker Compose includes test SFTP server with pre-configured SSH keys for testing

## Package Manager

This project uses **pnpm** as the package manager. Always use `pnpm` instead of `npm` for frontend dependencies:
- `pnpm install` - Install dependencies
- `pnpm run <script>` - Run package scripts
- `pnpm add <package>` - Add new dependencies

The package.json includes `"packageManager": "pnpm@10.15.0"` to enforce version consistency.