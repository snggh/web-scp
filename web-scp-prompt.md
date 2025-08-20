## Prompt for Claude Code:

**Create a new web-based FTP/SFTP client application called "Web-SCP" with the following specifications:**

### Project Overview
Build a modern, web-based file transfer application similar to WinSCP but for the browser. The app should support both FTP and SFTP protocols with a clean, intuitive interface for managing file transfers between local and remote servers.

### Tech Stack Requirements

**Backend (Go):**
- Latest Go with Go modules
- Latest Fiber framework for HTTP server
- Gorilla WebSocket for real-time communication
- pkg/sftp for SFTP connections
- jlaffaye/ftp for FTP connections
- golang-jwt/jwt for authentication
- godotenv for environment configuration
- go-playground/validator for input validation

**Frontend (React):**
- Latest React with TypeScript
- Vite as build tool
- TanStack Query for server state management
- TanStack Router for routing
- Zustand for client state management
- Latest Tailwind CSS for styling
- Shadcn/ui components
- Lucide React for icons
- React Dropzone for file uploads

### Project Structure
```
web-scp/
├── backend/
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   ├── .env.example
│   ├── config/
│   │   └── config.go
│   ├── handlers/
│   │   ├── auth.go
│   │   ├── connection.go
│   │   ├── transfer.go
│   │   └── websocket.go
│   ├── services/
│   │   ├── ftp_service.go
│   │   ├── sftp_service.go
│   │   └── pool_manager.go
│   ├── middleware/
│   │   ├── auth.go
│   │   └── cors.go
│   ├── models/
│   │   └── types.go
│   └── utils/
│       └── helpers.go
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ConnectionForm.tsx
│   │   │   ├── FileExplorer.tsx
│   │   │   ├── TransferQueue.tsx
│   │   │   └── FileUploader.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useFileTransfer.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── stores/
│   │   │   └── connectionStore.ts
│   │   └── types/
│   │       └── index.ts
├── docker-compose.yml
└── README.md
```

### Core Features to Implement

1. **Connection Manager:**
   - Support for FTP and SFTP protocols
   - Connection pooling for multiple simultaneous connections
   - Save connection profiles (in memory for now)
   - Test connection functionality

2. **File Explorer:**
   - Dual-pane interface (local and remote)
   - Directory navigation
   - File/folder operations (create, rename, delete)
   - File preview for text files
   - Sort by name, size, date

3. **Transfer System:**
   - Streaming file upload/download without storing on backend
   - Multiple simultaneous transfers
   - Transfer queue management
   - Real-time progress via WebSocket
   - Pause/resume/cancel transfers
   - Drag-and-drop support

4. **Authentication:**
   - JWT-based session management
   - Support for password and SSH key authentication for SFTP
   - Connection encryption details display

### Initial Implementation Focus

**Phase 1 - Basic Setup:**
1. Create Go Fiber server with basic routes
2. Set up React app with Vite and TypeScript
3. Implement WebSocket connection
4. Create basic UI layout with Tailwind and Shadcn/ui

**Phase 2 - Connection Management:**
1. Implement SFTP connection service in Go
2. Connection pooling with timeout management
3. Frontend connection form with validation
4. Store active connections in backend memory

**Phase 3 - File Operations:**
1. List directory contents endpoint
2. File explorer UI with dual panes
3. Basic navigation (click to enter directories)
4. File stats display (size, permissions, modified date)

**Phase 4 - Transfer Implementation:**
1. Streaming upload endpoint using io.Copy
2. Streaming download endpoint
3. Progress tracking via WebSocket
4. Transfer queue UI component
5. Drag-and-drop file upload

### Key Implementation Details

**Backend Streaming Upload Handler (Go):**
```go
// Stream file directly from HTTP request to SFTP without storing
func StreamUpload(c *fiber.Ctx) error {
    // Get SFTP client from connection pool
    // Stream request body directly to remote server
    // Send progress updates via WebSocket
    // Return success/error response
}
```

**Frontend WebSocket Hook (React):**
```typescript
// Custom hook for WebSocket connection and progress updates
const useWebSocket = () => {
    // Connect to WebSocket
    // Handle progress messages
    // Update transfer queue state
    // Reconnect logic
}
```

**Connection Pool Manager (Go):**
```go
// Manage SFTP/FTP connections efficiently
type PoolManager struct {
    // Map of connection ID to client
    // Mutex for thread safety
    // Connection timeout handling
    // Maximum connections per user
}
```

### Environment Variables (.env.example)
```
PORT=3000
JWT_SECRET=your-secret-key-here
MAX_CONNECTIONS_PER_USER=5
CONNECTION_TIMEOUT_MINUTES=15
MAX_UPLOAD_SIZE_MB=5000
CORS_ORIGINS=http://localhost:5173
WS_PATH=/ws
```

### API Endpoints to Create
```
POST   /api/auth/login          - Create session
POST   /api/connections/test    - Test connection
POST   /api/connections/connect - Establish connection
DELETE /api/connections/:id     - Disconnect

GET    /api/files/list          - List directory contents
POST   /api/files/mkdir         - Create directory
DELETE /api/files/delete        - Delete file/folder
PUT    /api/files/rename        - Rename file/folder

POST   /api/transfer/upload     - Stream upload
GET    /api/transfer/download   - Stream download
GET    /api/transfer/queue      - Get transfer queue
DELETE /api/transfer/:id        - Cancel transfer

WS     /ws                      - WebSocket for progress
```

### Development Commands
```bash
# Backend
cd backend
go mod init github.com/user/web-scp
go get fiber/v2 gorilla/websocket pkg/sftp jlaffaye/ftp
go run main.go

# Frontend  
cd frontend
npm create vite@latest . -- --template react-ts
npm install @tanstack/react-query @tanstack/react-router zustand
npm install -D tailwindcss postcss autoprefixer
npm run dev
```

### Success Criteria
- Clean, modern UI with dual-pane file explorer
- Reliable SFTP connection and file operations
- Real-time transfer progress updates
- Efficient streaming without backend storage
- Proper error handling and user feedback
- Responsive design that works on desktop and tablet

**Start by creating the basic project structure with a working Go Fiber backend and React frontend, then implement a simple SFTP connection test to validate the core functionality.**