# Web-SCP

A modern, web-based file transfer application similar to WinSCP but for the browser. Supports both FTP and SFTP protocols with a clean, intuitive interface for managing file transfers between local and remote servers.

## Features

- ✅ **Connection Manager**: Support for FTP and SFTP protocols with connection pooling
- ✅ **File Explorer**: Dual-pane interface for local and remote file management
- ✅ **Transfer System**: Real-time progress tracking via WebSocket
- ✅ **Modern UI**: Clean interface built with React, TypeScript, and Tailwind CSS
- ✅ **Secure**: JWT-based authentication and encrypted connections

## Tech Stack

### Backend (Go)
- Go 1.23 with Go modules
- Fiber framework for HTTP server
- Gorilla WebSocket for real-time communication  
- pkg/sftp for SFTP connections
- jlaffaye/ftp for FTP connections
- golang-jwt/jwt for authentication

### Frontend (React)
- React 18 with TypeScript
- Vite as build tool
- TanStack Query for server state management
- TanStack Router for routing
- Zustand for client state management
- Tailwind CSS for styling
- Shadcn/ui components
- Lucide React for icons

## Project Structure

```
web-scp/
├── backend/
│   ├── main.go                 # Main server entry point
│   ├── go.mod                  # Go module dependencies
│   ├── .env.example           # Environment variables template
│   ├── config/
│   │   └── config.go          # Configuration management
│   ├── handlers/
│   │   ├── auth.go            # Authentication handlers
│   │   ├── connection.go      # Connection management
│   │   ├── transfer.go        # File transfer handlers
│   │   └── websocket.go       # WebSocket handlers
│   ├── services/
│   │   ├── ftp_service.go     # FTP service implementation
│   │   ├── sftp_service.go    # SFTP service implementation
│   │   └── pool_manager.go    # Connection pool management
│   ├── middleware/
│   │   ├── auth.go            # Authentication middleware
│   │   └── cors.go            # CORS middleware
│   ├── models/
│   │   └── types.go           # Type definitions
│   └── utils/
│       └── helpers.go         # Utility functions
├── frontend/
│   ├── src/
│   │   ├── main.tsx           # React entry point
│   │   ├── App.tsx            # Main app component
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API services
│   │   ├── stores/            # Zustand stores
│   │   └── types/             # TypeScript types
│   ├── package.json           # Node.js dependencies
│   ├── vite.config.ts         # Vite configuration
│   └── tailwind.config.js     # Tailwind CSS configuration
├── docker-compose.yml         # Docker development setup
└── README.md                  # This file
```

## Quick Start

### Prerequisites

- Go 1.23 or later
- Node.js 20 or later
- npm or yarn

### Local Development

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd web-scp
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   
   # Copy environment file and configure
   cp .env.example .env
   
   # Install Go dependencies
   go mod download
   
   # Run the backend server
   go run main.go
   ```
   
   The backend will start on `http://localhost:3000`

3. **Frontend Setup:**
   ```bash
   cd frontend
   
   # Install Node.js dependencies
   npm install
   
   # Start the development server
   npm run dev
   ```
   
   The frontend will start on `http://localhost:5173`

### Docker Development

For a complete development environment with a test SFTP server:

```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# Stop services
docker-compose down
```

This will start:
- Backend server on `http://localhost:3000`
- Frontend on `http://localhost:5173`
- Test SFTP server on `localhost:2222` (user: `testuser`, password: `testpass`)

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```env
PORT=3000
JWT_SECRET=your-secret-key-here
MAX_CONNECTIONS_PER_USER=5
CONNECTION_TIMEOUT_MINUTES=15
MAX_UPLOAD_SIZE_MB=5000
CORS_ORIGINS=http://localhost:5173
WS_PATH=/ws
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Create session

### Connections
- `POST /api/connections/test` - Test connection
- `POST /api/connections/connect` - Establish connection
- `DELETE /api/connections/:id` - Disconnect

### File Operations
- `GET /api/files/list` - List directory contents
- `POST /api/files/mkdir` - Create directory
- `DELETE /api/files/delete` - Delete file/folder
- `PUT /api/files/rename` - Rename file/folder

### Transfer Operations
- `POST /api/transfer/upload` - Stream upload
- `GET /api/transfer/download` - Stream download
- `GET /api/transfer/queue` - Get transfer queue
- `DELETE /api/transfer/:id` - Cancel transfer

### WebSocket
- `WS /ws` - Real-time progress updates

## Testing the Application

1. **Start the application** using one of the methods above

2. **Test with the included SFTP server** (if using Docker):
   - Host: `localhost`
   - Port: `2222`
   - Protocol: `SFTP`
   - Username: `testuser`
   - Password: `testpass`

3. **Test with your own server**:
   - Configure your FTP/SFTP server details
   - Use the "Test Connection" button before connecting

## Development Commands

### Backend
```bash
cd backend

# Run the server
go run main.go

# Build the binary
go build -o web-scp main.go

# Run tests
go test ./...

# Format code
go fmt ./...
```

### Frontend
```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Features Implementation Status

### Phase 1 - Basic Setup ✅
- [x] Go Fiber server with basic routes
- [x] React app with Vite and TypeScript
- [x] WebSocket connection
- [x] Basic UI layout with Tailwind and Shadcn/ui

### Phase 2 - Connection Management 🚧
- [ ] SFTP connection service implementation
- [ ] Connection pooling with timeout management
- [x] Frontend connection form with validation
- [ ] Store active connections in backend memory

### Phase 3 - File Operations 🚧
- [ ] List directory contents endpoint
- [x] File explorer UI with dual panes
- [x] Basic navigation (click to enter directories)
- [x] File stats display (size, permissions, modified date)

### Phase 4 - Transfer Implementation 📋
- [ ] Streaming upload endpoint using io.Copy
- [ ] Streaming download endpoint  
- [ ] Progress tracking via WebSocket
- [x] Transfer queue UI component
- [ ] Drag-and-drop file upload

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security Notes

- Always use strong JWT secrets in production
- SFTP connections use SSH key authentication when possible
- All file transfers are streamed without backend storage
- Connection details are not persisted to disk

## Troubleshooting

### Common Issues

1. **Go command not found**
   - Ensure Go is installed and in your PATH
   - Restart your terminal after installation

2. **Port already in use**
   - Change the PORT in `.env` file
   - Kill existing processes using the port

3. **WebSocket connection failed**
   - Check if backend is running
   - Verify CORS_ORIGINS includes your frontend URL

4. **SFTP connection failed**
   - Verify server details and credentials
   - Check if server supports the requested protocol
   - Ensure firewall allows the connection

### Development Tips

- Use the browser developer tools to inspect WebSocket messages
- Check backend logs for detailed error messages
- Use the test SFTP server for development and testing
- Monitor network tab for API request/response debugging

---

**Start by creating a basic SFTP connection test to validate the core functionality.**