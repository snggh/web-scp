import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useConnectionStore } from '@/stores/connectionStore'
import { apiClient } from '@/services/api'
import { Connection, HostKeyVerificationError } from '@/types'
import { HostKeyVerificationDialog } from '@/components/HostKeyVerificationDialog'
import { Loader2, TestTube, Plus, Key, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

export function ConnectionForm() {
  const { addConnection, setActiveConnection } = useConnectionStore()
  const [formData, setFormData] = useState({
    name: '',
    protocol: 'sftp' as 'ftp' | 'sftp',
    host: '',
    port: 22,
    username: '',
    authMethod: 'password' as 'password' | 'key',
    password: '',
    privateKey: '',
    privateKeyFile: null as File | null,
    passphrase: '',
  })
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [hostKeyError, setHostKeyError] = useState<HostKeyVerificationError | null>(null)
  const [showHostKeyDialog, setShowHostKeyDialog] = useState(false)
  const [hostKeyLoading, setHostKeyLoading] = useState(false)
  
  // Refs for form navigation
  const nameRef = useRef<HTMLInputElement>(null)
  const hostRef = useRef<HTMLInputElement>(null)
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setTestResult(null)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setFormData(prev => ({ ...prev, privateKeyFile: file, privateKey: '' }))
      setTestResult(null)
    }
  }

  const handleKeyTextChange = (value: string) => {
    setFormData(prev => ({ ...prev, privateKey: value, privateKeyFile: null }))
    setTestResult(null)
  }

  const handleAuthMethodChange = (method: 'password' | 'key') => {
    setFormData(prev => ({
      ...prev,
      authMethod: method,
      password: method === 'password' ? prev.password : '',
      privateKey: method === 'key' ? prev.privateKey : '',
      privateKeyFile: method === 'key' ? prev.privateKeyFile : null,
      passphrase: method === 'key' ? prev.passphrase : '',
    }))
    setTestResult(null)
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement | null>) => {
    if (e.key === 'Enter' && nextRef?.current) {
      e.preventDefault()
      nextRef.current.focus()
    }
  }

  // Auto-focus on mount
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setTestResult(null)

    try {
      // Prepare test connection data
      const testData: any = {
        protocol: formData.protocol,
        host: formData.host,
        port: formData.port,
        username: formData.username,
        authMethod: formData.authMethod,
      }

      if (formData.authMethod === 'password') {
        testData.password = formData.password
      } else {
        testData.passphrase = formData.passphrase
        if (formData.privateKey) {
          testData.privateKey = formData.privateKey
        } else if (formData.privateKeyFile) {
          // Read file content for test
          const fileContent = await formData.privateKeyFile.text()
          testData.privateKey = fileContent
        }
      }

      const result = await apiClient.testConnection(testData)

      if (result.success) {
        setTestResult('✅ Connection test successful!')
      } else {
        setTestResult(`❌ Connection failed: ${result.error}`)
      }
    } catch (error) {
      setTestResult(`❌ Connection failed: ${error}`)
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleConnect = async (skipHostKeyCheck: boolean = false) => {
    setIsConnecting(true)

    try {
      // Prepare connection data
      const connectionData: any = {
        name: formData.name,
        protocol: formData.protocol,
        host: formData.host,
        port: formData.port,
        username: formData.username,
        authMethod: formData.authMethod,
      }

      if (formData.authMethod === 'password') {
        connectionData.password = formData.password
      } else {
        connectionData.passphrase = formData.passphrase
        if (formData.privateKey) {
          connectionData.privateKey = formData.privateKey
        } else if (formData.privateKeyFile) {
          // For connection, we'll use the file path approach
          // In a real implementation, you might upload the file first
          const fileContent = await formData.privateKeyFile.text()
          connectionData.privateKey = fileContent
        }
      }

      const result = await apiClient.connect(connectionData)

      if (result.success && result.data) {
        // The response might be nested: handle both cases
        const actualData = (result.data as any).data || result.data

        const connection: Connection = {
          id: actualData.connectionId,
          name: formData.name,
          protocol: formData.protocol,
          host: formData.host,
          port: formData.port,
          username: formData.username,
          status: 'connected',
          lastConnected: new Date(),
        }

        addConnection(connection)
        setActiveConnection(connection)
        setTestResult('✅ Connected successfully!')

        // Reset form
        setFormData({
          name: '',
          protocol: 'sftp',
          host: '',
          port: 22,
          username: '',
          authMethod: 'password',
          password: '',
          privateKey: '',
          privateKeyFile: null,
          passphrase: '',
        })
      } else {
        // Check if this is a host key verification error
        const errorMessage = result.error || ''
        if (!skipHostKeyCheck && apiClient.isHostKeyError(errorMessage)) {
          // First try to parse from the structured response data
          let parsedError = apiClient.parseHostKeyErrorFromResponse(result)
          
          // Fallback to parsing from error message
          if (!parsedError) {
            parsedError = apiClient.parseHostKeyError(errorMessage)
          }
          
          if (parsedError) {
            // Use the form data for host/port if not found in error message
            const hostKeyVerificationError: HostKeyVerificationError = {
              type: parsedError.type,
              message: parsedError.message,
              fingerprint: parsedError.fingerprint,
              host: parsedError.host || formData.host,
              port: parsedError.port || formData.port.toString(),
              hostId: `${formData.username}@${parsedError.host || formData.host}:${parsedError.port || formData.port}`
            }
            
            setHostKeyError(hostKeyVerificationError)
            setShowHostKeyDialog(true)
            return
          }
        }
        setTestResult(`❌ Connection failed: ${result.error}`)
      }
    } catch (error) {
      setTestResult(`❌ Connection failed: ${error}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleTrustHostKey = async () => {
    if (!hostKeyError) return

    setHostKeyLoading(true)
    try {
      const sessionId = apiClient.getSessionId()
      if (!sessionId) {
        setTestResult('❌ No session found')
        setShowHostKeyDialog(false)
        return
      }

      const trustResult = await apiClient.trustHostKey({
        userSession: sessionId,
        host: hostKeyError.host,
        port: hostKeyError.port,
        username: formData.username,
        fingerprint: hostKeyError.fingerprint,
        trust: true
      })

      if (trustResult.success) {
        // Host key trusted, now retry the connection
        setShowHostKeyDialog(false)
        setHostKeyError(null)
        
        // Retry connection with host key check skipped
        await handleConnect(true)
      } else {
        setTestResult(`❌ Failed to trust host key: ${trustResult.error}`)
        setShowHostKeyDialog(false)
      }
    } catch (error) {
      setTestResult(`❌ Failed to trust host key: ${error}`)
      setShowHostKeyDialog(false)
    } finally {
      setHostKeyLoading(false)
    }
  }

  const handleRejectHostKey = () => {
    setShowHostKeyDialog(false)
    setHostKeyError(null)
    setTestResult('❌ Connection cancelled: Host key verification rejected')
  }

  const isFormValid = !!(
    formData.name &&
    formData.host &&
    formData.username &&
    (formData.authMethod === 'password' ? formData.password : (formData.privateKey || formData.privateKeyFile))
  )

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >

      {/* Basic Information */}
      <motion.div 
        className="space-y-4"
        layout
      >
        <h3 className="text-lg font-medium">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Label htmlFor="name">Connection Name *</Label>
            <Input
              ref={nameRef}
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, hostRef)}
              placeholder="My Server"
              className="transition-all duration-200"
              required
            />
          </motion.div>

          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Label htmlFor="protocol">Protocol</Label>
            <Select value={formData.protocol} onValueChange={(value) => handleInputChange('protocol', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sftp">SFTP (Secure)</SelectItem>
                <SelectItem value="ftp">FTP</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div 
            className="md:col-span-2 space-y-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Label htmlFor="host">Host *</Label>
            <Input
              ref={hostRef}
              id="host"
              value={formData.host}
              onChange={(e) => handleInputChange('host', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, usernameRef)}
              placeholder="example.com or 192.168.1.100"
              className="transition-all duration-200"
              required
            />
          </motion.div>

          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              value={formData.port}
              onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 22)}
              className="transition-all duration-200"
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Authentication */}
      <motion.div 
        className="space-y-4"
        layout
      >
        <h3 className="text-lg font-medium">Authentication</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Label htmlFor="username">Username *</Label>
            <Input
              ref={usernameRef}
              id="username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, passwordRef)}
              placeholder="username"
              className="transition-all duration-200"
              required
            />
          </motion.div>

          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Label>Authentication Method</Label>
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="auth-password"
                  name="authMethod"
                  value="password"
                  checked={formData.authMethod === 'password'}
                  onChange={(e) => handleAuthMethodChange(e.target.value as 'password' | 'key')}
                  className="w-4 h-4 text-primary bg-background border-border focus:ring-primary focus:ring-2"
                />
                <Label htmlFor="auth-password" className="flex items-center gap-2 font-normal cursor-pointer">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="auth-key"
                  name="authMethod"
                  value="key"
                  checked={formData.authMethod === 'key'}
                  onChange={(e) => handleAuthMethodChange(e.target.value as 'password' | 'key')}
                  className="w-4 h-4 text-primary bg-background border-border focus:ring-primary focus:ring-2"
                />
                <Label htmlFor="auth-key" className="flex items-center gap-2 font-normal cursor-pointer">
                  <Key className="h-4 w-4" />
                  SSH Key
                </Label>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Authentication Fields */}
        <AnimatePresence mode="wait">
          {formData.authMethod === 'password' && (
            <motion.div 
              key="password"
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Enter password"
                  className="pr-10 transition-all duration-200"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {formData.authMethod === 'key' && (
            <motion.div 
              key="ssh-key"
              className="space-y-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-2">
                <Label>Private Key *</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pem,.key,.ppk"
                        onChange={handleFileUpload}
                        className="sr-only"
                        id="key-file-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full justify-start gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        {formData.privateKeyFile ? formData.privateKeyFile.name : 'Choose Key File'}
                      </Button>
                    </div>
                    <span className="text-sm text-muted-foreground">or</span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, privateKeyFile: null }))
                      }}
                      className="flex items-center gap-2"
                    >
                      <Key className="h-4 w-4" />
                      Paste Key
                    </Button>
                  </div>

                  <AnimatePresence>
                    {!formData.privateKeyFile && (
                      <motion.textarea
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 120 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        value={formData.privateKey}
                        onChange={(e) => handleKeyTextChange(e.target.value)}
                        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;Paste your private key here...&#10;-----END OPENSSH PRIVATE KEY-----"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-none"
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passphrase">Passphrase (Optional)</Label>
                <div className="relative">
                  <Input
                    id="passphrase"
                    type={showPassphrase ? 'text' : 'password'}
                    value={formData.passphrase}
                    onChange={(e) => handleInputChange('passphrase', e.target.value)}
                    placeholder="Enter passphrase if key is encrypted"
                    className="pr-10 transition-all duration-200"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                  >
                    {showPassphrase ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Test Result */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={`border-l-4 ${
              testResult.includes('✅') 
                ? 'border-l-green-500 bg-green-50 dark:bg-green-950' 
                : 'border-l-red-500 bg-red-50 dark:bg-red-950'
            }`}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  {testResult.includes('✅') ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <p className="text-sm font-medium">{testResult}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <motion.div 
        className="flex flex-col sm:flex-row gap-3 pt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
      >
        <Button
          onClick={handleTestConnection}
          disabled={
            isTestingConnection ||
            !formData.host ||
            !formData.username ||
            (formData.authMethod === 'password' && !formData.password) ||
            (formData.authMethod === 'key' && !formData.privateKey && !formData.privateKeyFile)
          }
          variant="outline"
          className="flex-1 flex items-center justify-center gap-2 h-11"
        >
          {isTestingConnection ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-4 w-4" />
            </motion.div>
          ) : (
            <TestTube className="h-4 w-4" />
          )}
          Test Connection
        </Button>

        <Button
          onClick={() => handleConnect()}
          disabled={!isFormValid || isConnecting}
          className="flex-1 flex items-center justify-center gap-2 h-11"
        >
          {isConnecting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-4 w-4" />
            </motion.div>
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Connect
        </Button>
      </motion.div>

      {/* Host Key Verification Dialog */}
      <HostKeyVerificationDialog
        isOpen={showHostKeyDialog}
        error={hostKeyError}
        onAccept={handleTrustHostKey}
        onReject={handleRejectHostKey}
        loading={hostKeyLoading}
      />
    </motion.div>
  )
}