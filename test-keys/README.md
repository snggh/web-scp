# Test SSH Keys for Web-SCP

This directory contains SSH keys for testing SSH key-based authentication with the Web-SCP application.

## Available Test Keys

### 1. Unencrypted Key
- **Private Key**: `test_key` (no passphrase)
- **Public Key**: `test_key.pub`
- **Usage**: For testing SSH key authentication without passphrase

### 2. Encrypted Key
- **Private Key**: `test_key_encrypted` (passphrase: "testpassphrase")
- **Public Key**: `test_key_encrypted.pub`
- **Usage**: For testing SSH key authentication with passphrase

### 3. Authorized Keys
- **File**: `authorized_keys`
- **Usage**: Contains both public keys for the SFTP server

## Testing Instructions

### Using Password Authentication
- Host: `localhost`
- Port: `2222`
- Username: `testuser`
- Password: `testpass`

### Using SSH Key Authentication

#### Option 1: Upload the private key file
1. Copy the content of `test_key` (or `test_key_encrypted`)
2. In the Web-SCP connection form:
   - Select "SSH Key" as authentication method
   - Upload the private key file
   - If using `test_key_encrypted`, enter "testpassphrase" as the passphrase

#### Option 2: Paste the private key content
1. Open `test_key` (or `test_key_encrypted`) in a text editor
2. Copy the entire content
3. In the Web-SCP connection form:
   - Select "SSH Key" as authentication method
   - Click "Paste Key" button
   - Paste the private key content
   - If using `test_key_encrypted`, enter "testpassphrase" as the passphrase

### Connection Details
- Host: `localhost`
- Port: `2222`
- Username: `testuser`
- Authentication: SSH Key (see above)

## Security Note
These keys are for testing purposes only and should never be used in production environments.
