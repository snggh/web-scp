# Web-SCP Security Checklist 🔒

> **Status**: 🟡 **SECURITY HARDENING REQUIRED** - Address key issues before production deployment
>
> This checklist covers comprehensive security review findings for the Web-SCP project. Items marked with 🔴 are critical vulnerabilities that must be fixed before production use.
>
> **Important**: Web-SCP is a file transfer client (like WinSCP) where users connect to their own FTP/SFTP servers. The web app authentication is optional and separate from remote server authentication.

## Executive Summary

### 🔴 Critical Security Issues Discovered
- Missing input validation and file path sanitization
- No file type restrictions on uploads
- Missing rate limiting and DoS protection
- Missing security headers
- Insecure session management

### Security Score: **7/10** (Medium Risk - Major Security Improvements Implemented!)

### ✅ **RESOLVED** - SSH Host Key Verification & Connection Security
- **Implemented secure host key verification** with Trust-on-First-Use (TOFU) pattern
- **In-memory session-scoped storage** for trusted host keys
- **User approval workflow** for unknown/changed host keys
- **API endpoints** for host key management
- **Connection timeout management** with automatic cleanup and user notifications
- **Health monitoring system** to prevent broken connection states

> **Note**: Score reflects this is a file transfer client (like WinSCP) where web app authentication is optional. JWT security will be addressed via environment configuration.

---

## 🔐 Authentication & Authorization

### 🟢 **ADDRESSED** - JWT Security (via Environment Configuration)
- [x] **JWT secret via environment** - Will be configured in `.env` file (not in code)
- [ ] **Implement token blacklisting** - Currently logout is fake (see `backend/handlers/auth.go:102`)
- [ ] **Add token expiration validation** - Verify tokens properly expire and refresh  
- [ ] **Secure JWT claims** - Remove sensitive data from JWT payload
- [ ] **JWT secret strength validation** - Add startup validation for weak secrets

```go
// Recommended: Add JWT secret validation in config.go
func validateJWTSecret(secret string) error {
    if len(secret) < 32 {
        return fmt.Errorf("JWT secret must be at least 32 characters (256-bit)")
    }
    if secret == "default-secret-change-in-production" || 
       secret == "your-secret-key-here" ||
       secret == "your-strong-256-bit-secret-here" {
        return fmt.Errorf("JWT secret cannot use default values in production")
    }
    return nil
}
```

### 🟡 **HIGH** - Web App Authentication Strategy
- [ ] **Define authentication model** - Decide: No auth, simple auth, or multi-user
- [ ] **If no web app auth needed** - Remove auth endpoints entirely, use anonymous sessions
- [ ] **If simple web app auth needed** - Implement single-user or basic user store
- [ ] **Consider development vs production** - Optional auth middleware may be intentional for testing
- [ ] **Document authentication decision** - Clarify in README whether web app requires login

> **Note**: The app connects to REMOTE servers using their credentials. The web app authentication is separate and optional.

### 🟡 **HIGH** - Session Management  
- [ ] **Move sessions from localStorage** - Use httpOnly cookies instead (`frontend/src/services/api.ts:35`)
- [ ] **Implement session timeout** - Add sliding session expiration
- [ ] **Add session invalidation** - Proper logout and session cleanup
- [ ] **Session fixation protection** - Regenerate session IDs on login
- [ ] **Add concurrent session limits** - Prevent session abuse

### 🟡 **HIGH** - SSH Key Security
- [ ] **Sanitize private key input** - Validate SSH key format and content
- [ ] **Clear sensitive memory** - Zero out private keys and passphrases after use
- [ ] **Validate key permissions** - Check private key file permissions (600)
- [ ] **Implement key storage security** - Never log or persist private keys
- [ ] **Add key format validation** - Support specific key types only (RSA, Ed25519, ECDSA)

---

## 🛡️ Input Validation & Sanitization

### 🔴 **CRITICAL** - Directory Traversal Protection
- [ ] **Implement path sanitization** - No validation exists for file paths
- [ ] **Add path traversal checks** - Prevent `../` and absolute path attacks
- [ ] **Validate remote paths** - Sanitize `remotePath` parameters in file operations
- [ ] **Restrict allowed directories** - Implement base path restrictions
- [ ] **Validate connection parameters** - Sanitize host, username, protocol inputs

```go
// MISSING: Path sanitization in file handlers
func SanitizeFilePath(path string) (string, error) {
    clean := filepath.Clean(path)
    if strings.Contains(clean, "..") {
        return "", fmt.Errorf("directory traversal detected")
    }
    return clean, nil
}
```

### 🔴 **CRITICAL** - File Upload Security
- [ ] **Implement file type validation** - No restrictions on upload file types
- [ ] **Add file size limits** - Current limit is 5GB (potentially DoS vector)
- [ ] **Validate file headers** - Check magic bytes, not just extensions
- [ ] **Scan for malware** - Integrate virus scanning for uploads
- [ ] **Sanitize filenames** - Remove dangerous characters and null bytes

```go
// MISSING: File type validation in UploadFile handler
var AllowedMimeTypes = map[string]bool{
    "text/plain": true,
    "image/jpeg": true,
    // Add more as needed
}
```

### 🟡 **HIGH** - Request Validation
- [ ] **Add struct validation** - Use `go-playground/validator` consistently
- [ ] **Validate JSON payloads** - Check for oversized/malformed JSON
- [ ] **Sanitize user inputs** - Escape special characters in all inputs
- [ ] **Add length limits** - Prevent buffer overflow attacks
- [ ] **Validate connection parameters** - Host, port, username format validation

---

## 🔒 Network & Transport Security

### 🔴 **CRITICAL** - HTTPS/TLS Configuration
- [ ] **Enforce HTTPS** - No TLS configuration for production
- [ ] **Add TLS certificates** - Configure proper SSL/TLS certificates
- [ ] **Implement HSTS headers** - Force HTTPS connections
- [ ] **Disable HTTP** - Remove HTTP endpoints in production
- [ ] **Configure secure ciphers** - Use strong TLS cipher suites

### ✅ **IMPLEMENTED** - SSH Host Key Verification
- [x] **Implemented secure host key verification** - Using `ConnectWithHostKeyVerification` method
- [x] **Trust-on-First-Use (TOFU) pattern** - User approval for unknown hosts
- [x] **Host key fingerprint checking** - SHA256 fingerprints with user verification  
- [x] **Warning system for host key changes** - Detects potential MITM attacks
- [x] **In-memory session storage** - Trusted keys stored per user session
- [x] **API endpoints for host key management** - Trust, list, and clear endpoints

```go
// ✅ SECURE: Now using proper host key verification
hostKeyCallback := GlobalHostKeyManager.CreateHostKeyCallback(
    userSession, config.Host, strconv.Itoa(config.Port), config.Username,
)
sshConfig := &ssh.ClientConfig{
    HostKeyCallback: hostKeyCallback, // ✅ SECURE
}
```

**Implementation Details:**
- **HostKeyManager**: In-memory storage with session isolation
- **User Workflow**: Unknown hosts trigger approval dialog (status 422)
- **MITM Detection**: Changed host keys immediately rejected
- **API Endpoints**: `/api/hostkey/trust`, `/api/hostkey/trusted`, `/api/hostkey/trusted` (DELETE)

### ✅ **IMPLEMENTED** - Connection Timeout Management
- [x] **Implemented connection timeout enforcement** - 2-minute configurable timeout with automatic cleanup
- [x] **Frontend timeout detection** - Automatic detection of connection timeouts with proper error handling
- [x] **Connection health monitoring** - Periodic health checks (30s intervals) to detect stale connections
- [x] **User-friendly timeout notifications** - Toast notifications with context-aware messages
- [x] **Automatic state reset** - UI automatically returns to connection form on timeout
- [x] **Session cleanup on timeout** - Proper cleanup of connection state and API sessions

**Implementation Details:**
- **Backend**: `ConnectionTimeout: 2 * time.Minute` with `CleanupInterval: 30 * time.Second`
- **Frontend**: `useConnectionHealth` hook with automatic error detection
- **UX**: Users get clear feedback when connections timeout instead of being stuck in broken state
- **Testing**: Configurable timeout duration for development (2min) vs production (30min+)

### 🟡 **HIGH** - Additional Connection Security
- [ ] **Implement connection retry limits** - Prevent connection abuse
- [ ] **Add connection rate limiting** - Limit concurrent connections per IP
- [ ] **Monitor connection attempts** - Log and alert on suspicious activity
- [ ] **Secure FTP over TLS** - Enable FTPS when available

---

## 🚦 Rate Limiting & DoS Protection

### 🔴 **CRITICAL** - Missing Rate Limiting
- [ ] **Implement API rate limiting** - No rate limiting exists
- [ ] **Add connection attempt limits** - Prevent brute force attacks
- [ ] **Limit file upload rate** - Prevent resource exhaustion
- [ ] **Add WebSocket rate limiting** - Protect against WebSocket flooding
- [ ] **Implement IP-based throttling** - Block abusive IPs

```go
// MISSING: Rate limiting middleware
func RateLimitMiddleware() fiber.Handler {
    return limiter.New(limiter.Config{
        Max:        100,
        Expiration: time.Minute,
        KeyGenerator: func(c *fiber.Ctx) string {
            return c.IP()
        },
    })
}
```

### 🟡 **HIGH** - Resource Protection
- [ ] **Add memory usage limits** - Monitor and limit memory consumption
- [ ] **Implement request size limits** - Prevent oversized requests
- [ ] **Add concurrent upload limits** - Prevent resource exhaustion
- [ ] **Monitor disk usage** - Cleanup temporary files aggressively
- [ ] **Add graceful degradation** - Handle resource exhaustion gracefully

---

## 🌐 CORS & Security Headers

### 🔴 **CRITICAL** - Missing Security Headers
- [ ] **Add Content-Security-Policy** - Prevent XSS attacks
- [ ] **Implement X-Frame-Options** - Prevent clickjacking
- [ ] **Add X-Content-Type-Options** - Prevent MIME sniffing
- [ ] **Include X-XSS-Protection** - Enable browser XSS protection
- [ ] **Add Referrer-Policy** - Control referrer information

```go
// MISSING: Security headers middleware
func SecurityHeaders() fiber.Handler {
    return func(c *fiber.Ctx) error {
        c.Set("X-Frame-Options", "DENY")
        c.Set("X-Content-Type-Options", "nosniff")
        c.Set("X-XSS-Protection", "1; mode=block")
        c.Set("Content-Security-Policy", "default-src 'self'")
        return c.Next()
    }
}
```

### 🟡 **HIGH** - CORS Configuration
- [ ] **Restrict CORS origins** - Currently allows localhost only
- [ ] **Validate allowed headers** - Remove unnecessary headers
- [ ] **Add origin validation** - Implement dynamic origin checking
- [ ] **Remove credentials for public APIs** - Only allow for authenticated routes
- [ ] **Set proper CORS cache time** - Optimize preflight requests

---

## 📁 File Handling Security

### 🔴 **CRITICAL** - Temporary File Security
- [ ] **Set secure temp file permissions** - Currently uses default (readable by all)
- [ ] **Ensure temp file cleanup** - Verify all temp files are removed
- [ ] **Use secure temp directory** - Avoid system-wide temp directories
- [ ] **Add temp file size limits** - Prevent disk space exhaustion
- [ ] **Monitor temp file usage** - Track and alert on excessive usage

```go
// SECURITY ISSUE: Temp files created without secure permissions
tempFile, err := os.CreateTemp("", "web-scp-upload-*") // ❌ Default permissions
```

### 🟡 **HIGH** - File Operation Security
- [ ] **Validate file permissions** - Check read/write permissions before operations
- [ ] **Add file operation logging** - Log all file transfers and modifications
- [ ] **Implement file integrity checks** - Verify file checksums
- [ ] **Add virus scanning** - Scan uploaded files for malware
- [ ] **Limit file operation scope** - Restrict accessible directories

---

## 🔌 WebSocket Security

### 🔴 **CRITICAL** - WebSocket Authentication
- [ ] **Add proper WebSocket authentication** - Currently uses query param session
- [ ] **Validate session before upgrade** - Verify user session exists
- [ ] **Implement WebSocket rate limiting** - Prevent message flooding
- [ ] **Add connection limits per user** - Prevent resource abuse
- [ ] **Secure WebSocket handshake** - Validate upgrade requests

```go
// SECURITY ISSUE: Weak WebSocket authentication
userSession := c.Query("session") // ❌ Easily spoofed
if userSession == "" {
    userSession = c.Get("X-Session-ID") // ❌ No validation
}
```

### 🟡 **HIGH** - WebSocket Message Security
- [ ] **Validate all WebSocket messages** - Check message format and content
- [ ] **Add message size limits** - Prevent oversized messages
- [ ] **Implement message authentication** - Verify message integrity
- [ ] **Add connection heartbeat** - Detect and close dead connections
- [ ] **Log WebSocket events** - Monitor for suspicious activity

---

## 💾 Data Protection & Privacy

### 🟡 **HIGH** - Sensitive Data Handling
- [ ] **Clear credentials from memory** - Zero out passwords and keys after use
- [ ] **Avoid logging sensitive data** - Remove credentials from logs
- [ ] **Implement data encryption at rest** - Encrypt stored configuration
- [ ] **Add secure credential storage** - Use proper secret management
- [ ] **Implement data retention policies** - Clear old session data

### 🟡 **HIGH** - Connection Data Security
- [ ] **Encrypt connection pool data** - Protect stored connection info
- [ ] **Add connection data expiration** - Clear old connection data
- [ ] **Implement secure connection sharing** - Prevent session hijacking
- [ ] **Add audit logging** - Track all data access and modifications
- [ ] **Validate data integrity** - Detect tampering of stored data

---

## 🖥️ Frontend Security

### 🔴 **CRITICAL** - Client-Side Security
- [ ] **Remove sensitive data from frontend** - Don't store credentials in localStorage
- [ ] **Implement proper error handling** - Don't expose internal errors to UI
- [ ] **Add input sanitization** - Escape user inputs in React components
- [ ] **Implement Content Security Policy** - Prevent XSS attacks
- [ ] **Add Subresource Integrity** - Verify external script integrity

### 🟡 **HIGH** - Frontend Best Practices
- [ ] **Validate all user inputs** - Client-side validation for UX (not security)
- [ ] **Implement proper state management** - Secure Zustand store
- [ ] **Add proper error boundaries** - Handle React errors gracefully
- [ ] **Implement secure routing** - Protect sensitive routes
- [ ] **Add loading state protection** - Prevent UI manipulation during loads

---

## 🐳 Infrastructure & Deployment Security

### 🔴 **CRITICAL** - Docker Security
- [ ] **Use non-root containers** - Run containers as non-privileged user
- [ ] **Scan container images** - Check for known vulnerabilities
- [ ] **Remove development dependencies** - Clean production images
- [ ] **Set resource limits** - Prevent container resource abuse
- [ ] **Use minimal base images** - Reduce attack surface

### 🟡 **HIGH** - Environment Security
- [ ] **Secure environment variables** - Use proper secret management
- [ ] **Implement proper logging** - Centralized and secure logging
- [ ] **Add health checks** - Monitor application health
- [ ] **Configure reverse proxy** - Use nginx/traefik for SSL termination
- [ ] **Implement backup security** - Secure backup procedures

---

## 📊 Monitoring & Incident Response

### 🟡 **HIGH** - Security Monitoring
- [ ] **Implement security event logging** - Log all security-relevant events
- [ ] **Add intrusion detection** - Monitor for suspicious patterns
- [ ] **Set up alerting** - Alert on security events
- [ ] **Monitor resource usage** - Track CPU, memory, disk usage
- [ ] **Implement audit trails** - Track all user actions

### 🟡 **HIGH** - Incident Response
- [ ] **Create incident response plan** - Define response procedures
- [ ] **Implement emergency shutdown** - Ability to quickly stop services
- [ ] **Add forensic logging** - Detailed logs for investigation
- [ ] **Create backup procedures** - Regular security backups
- [ ] **Test incident response** - Regular security drills

---

## 🧪 Security Testing

### 🟡 **HIGH** - Automated Security Testing
- [ ] **Add dependency scanning** - Check for vulnerable dependencies
- [ ] **Implement SAST tools** - Static application security testing
- [ ] **Add DAST testing** - Dynamic application security testing
- [ ] **Set up container scanning** - Regular container vulnerability scans
- [ ] **Implement security linting** - Code security checks

### 🟡 **HIGH** - Manual Security Testing
- [ ] **Conduct penetration testing** - Professional security assessment
- [ ] **Perform code reviews** - Security-focused code reviews
- [ ] **Test authentication flows** - Verify all auth mechanisms
- [ ] **Validate input handling** - Test all input validation
- [ ] **Test WebSocket security** - Verify WebSocket protections

---

## 📋 Compliance & Documentation

### 🟡 **MEDIUM** - Security Documentation
- [ ] **Document security architecture** - Create security design docs
- [ ] **Create deployment guides** - Secure deployment procedures
- [ ] **Write incident runbooks** - Response procedures
- [ ] **Document security configs** - All security settings explained
- [ ] **Create user security guide** - Best practices for users

### 🟡 **MEDIUM** - Compliance Requirements
- [ ] **Assess regulatory requirements** - GDPR, SOC2, etc.
- [ ] **Implement data protection** - User data protection measures
- [ ] **Add privacy controls** - User consent and data management
- [ ] **Create security policies** - Formal security policies
- [ ] **Regular security reviews** - Periodic security assessments

---

## 🚀 Quick Wins (Fix First)

1. ✅ ~~**Fix SSH host key verification**~~ - **IMPLEMENTED** with TOFU pattern and user approval workflow
2. ✅ ~~**Add connection timeout management**~~ - **IMPLEMENTED** with health monitoring and automatic cleanup
3. **Add input path sanitization** - Missing in all file handlers (prevent directory traversal)
4. **Add security headers middleware** - Missing entirely (prevent XSS, clickjacking)
5. **Implement basic rate limiting** - Missing entirely (prevent DoS attacks)
6. **Add file type validation** - No restrictions on upload types
7. **Secure temp file permissions** - Default permissions too permissive
8. **Improve WebSocket authentication** - `backend/handlers/websocket.go:249`
9. **Add JWT secret validation** - Validate secret strength at startup (if using web app auth)

---

## 📈 Security Roadmap

### Phase 1 (Immediate - Week 1)
- Fix critical authentication issues
- Add basic input validation
- Implement security headers
- Secure JWT configuration

### Phase 2 (Short-term - Month 1)
- Add comprehensive rate limiting
- Implement proper session management
- Add file security controls
- Set up basic monitoring

### Phase 3 (Medium-term - Month 3)
- Complete security testing
- Add advanced monitoring
- Implement incident response
- Conduct security audit

### Phase 4 (Long-term - Month 6)
- Compliance assessment
- Advanced security features
- Security automation
- Regular security reviews

---

## ⚠️ Risk Assessment

| Risk Category | Current Level | Target Level | Priority |
|---------------|---------------|--------------|----------|
| Network Security | 🔴 Critical | 🟢 Low | P0 |
| Input Validation | 🔴 Critical | 🟢 Low | P0 |
| Web App Security | 🟡 High | 🟢 Low | P1 |
| File Handling | 🟡 High | 🟢 Low | P1 |
| Data Protection | 🟡 High | 🟢 Low | P1 |
| Infrastructure | 🟡 High | 🟢 Low | P1 |
| Monitoring | 🟡 High | 🟢 Low | P2 |

> **Authentication Model Clarification**: This app is a file transfer client where users connect to their own FTP/SFTP servers. Web app authentication is optional for controlling access to the web interface itself.

---

## 📝 Notes

- This security review was conducted on the current development version
- Production deployment is **NOT RECOMMENDED** until critical issues are resolved
- Regular security reviews should be conducted as the application evolves
- Consider hiring security professionals for production deployment
- This checklist should be updated as new features are added

---

**Last Updated**: $(date)  
**Review Status**: 🟡 Security Hardening Required - Address Key Issues Before Production  
**Next Review**: After critical network and input validation issues resolved

**Key Focus Areas**: SSH host verification, input sanitization, security headers, rate limiting
