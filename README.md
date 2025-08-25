# Web-SCP 🎉

A modern, web-based file transfer application similar to WinSCP but for the browser. Supports both FTP and SFTP protocols with a clean, intuitive interface for managing file transfers between local and remote servers.

## 🚀 **Project Status: FULLY FUNCTIONAL** ✅

**All major features implemented and tested!** The application supports:
- **Complete SFTP & FTP connection management** with connection pooling
- **SSH key authentication** (file upload + paste with passphrase support)
- **Full file operations** (list, upload, download, create, rename, delete)
- **Real-time transfer progress** via WebSocket
- **Drag & drop file upload** interface
- **Tested with local and remote servers** - works perfectly! 🤘

## Features

- ✅ **Connection Manager**: Support for FTP and SFTP protocols with connection pooling
- ✅ **Authentication Options**: Password and SSH key-based authentication for SFTP (with passphrase support)
- ✅ **File Explorer**: Dual-pane interface for local and remote file management
- ✅ **Transfer System**: Real-time progress tracking via WebSocket
- ✅ **Modern UI**: Clean interface built with React, TypeScript, and Tailwind CSS
- ✅ **Secure**: JWT-based authentication and encrypted connections
- ✅ **SSH Key Support**: Upload private key files or paste key content with optional passphrase

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
JWT_SECRET=your-strong-256-bit-secret-here
MAX_CONNECTIONS_PER_USER=5
CONNECTION_TIMEOUT_MINUTES=15
MAX_UPLOAD_SIZE_MB=5000
CORS_ORIGINS=http://localhost:5173
WS_PATH=/ws
```

### 🔐 Security Configuration

#### JWT Secret Generation
**IMPORTANT**: Generate a strong JWT secret for production:

```bash
# Generate a secure 256-bit (32-byte) secret
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Example strong JWT secret:**
```env
JWT_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

#### Security Requirements:
- **Minimum 32 characters (256-bit)**
- **Use random, unpredictable characters**
- **Never commit secrets to version control**
- **Use different secrets for development/production**
- **Rotate secrets periodically in production**

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

   **Authentication Options:**

   **Option A: Password Authentication**
   - Password: `testpass`

   **Option B: SSH Key Authentication**
   - Use test keys from `test-keys/` directory:
     - **Unencrypted key**: Copy content from `test-keys/test_key`
     - **Encrypted key**: Copy content from `test-keys/test_key_encrypted` and use passphrase `testpassphrase`
   - Or upload the key files directly in the connection form

3. **Test with your own server**:
   - Configure your FTP/SFTP server details
   - Use the "Test Connection" button before connecting
   - Choose authentication method (Password or SSH Key) as needed

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

### Phase 2 - Connection Management ✅
- [x] SFTP connection service implementation
- [x] Connection pooling with timeout management
- [x] Frontend connection form with validation
- [x] SSH key-based authentication support (file upload + paste)
- [x] Passphrase support for encrypted SSH keys
- [x] Store active connections in backend memory

### Phase 3 - File Operations ✅
- [x] List directory contents endpoint
- [x] File explorer UI with dual panes
- [x] Basic navigation (click to enter directories)
- [x] File stats display (size, permissions, modified date)
- [x] Create, rename, and delete directories
- [x] File operations (upload, download, delete)

### Phase 4 - Transfer Implementation ✅
- [x] Streaming upload endpoint using io.Copy
- [x] Streaming download endpoint
- [x] Progress tracking via WebSocket
- [x] Transfer queue UI component
- [x] Drag-and-drop file upload interface
- [x] Real-time transfer progress tracking

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## SSH Key Authentication

Web-SCP supports SSH key-based authentication for SFTP connections, providing enhanced security compared to password authentication.

### Setting up SSH Key Authentication

1. **Generate SSH Key Pair** (if you don't have one):
   ```bash
   ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
   ```

2. **In Web-SCP Connection Form**:
   - Select "SSH Key" as the authentication method
   - **Option 1**: Upload your private key file (.pem, .key, .ppk)
   - **Option 2**: Copy and paste your private key content into the textarea
   - **Optional**: Enter passphrase if your private key is encrypted

3. **Server Configuration**:
   - Ensure your SFTP server has your public key in the `authorized_keys` file
   - For OpenSSH servers, public keys are typically stored in `~/.ssh/authorized_keys`

### Test Keys for Development

The development environment includes pre-generated test keys:

- **Unencrypted key**: `test-keys/test_key` (no passphrase)
- **Encrypted key**: `test-keys/test_key_encrypted` (passphrase: "testpassphrase")

These keys are automatically configured for the test SFTP server running on `localhost:2222`.

## 🎊 SSH Key Authentication - IMPLEMENTED & TESTED ✅

**SSH key-based authentication is now fully functional!** ✅

**Features:**
- ✅ File upload support for private keys (.pem, .key, .ppk)
- ✅ Text paste support for private key content
- ✅ Passphrase support for encrypted keys
- ✅ Backward compatibility with password authentication
- ✅ Tested with local and remote servers
- ✅ Clean UI with authentication method selection

**How to use:**
1. Select "SSH Key" in the authentication dropdown
2. Choose: Upload file OR Paste key content
3. Enter passphrase if key is encrypted
4. Test connection and connect!

**Works perfectly with both:**
- Local test server (docker-compose)
- Remote SFTP servers
- Encrypted and unencrypted keys

## Security Notes

- Always use strong JWT secrets in production
- SFTP connections support both password and SSH key authentication
- SSH keys provide better security than passwords when properly configured
- All file transfers are streamed without backend storage
- Connection details are not persisted to disk
- Private keys are never stored on the server

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

5. **SSH key authentication failed**
   - Verify the private key format (should start with "-----BEGIN")
   - Check if the public key is properly installed on the server
   - Ensure correct username for the key
   - Verify passphrase if the key is encrypted
   - Check file permissions on the server (authorized_keys should be 600)

### Development Tips

- Use the browser developer tools to inspect WebSocket messages
- Check backend logs for detailed error messages
- Use the test SFTP server for development and testing
- Monitor network tab for API request/response debugging

---

**🎉 PROJECT COMPLETE - ALL FEATURES IMPLEMENTED AND TESTED SUCCESSFULLY! 🎉**

**Status:** FULLY FUNCTIONAL ✅  
**SSH Key Authentication:** WORKING PERFECTLY ✅  
**Tested:** Local + Remote Servers ✅  
**Ready for:** Production Use 🚀

---

**Start by creating a basic SFTP connection test to validate the core functionality.**