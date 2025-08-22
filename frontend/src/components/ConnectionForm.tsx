import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useConnectionStore } from '@/stores/connectionStore'
import { apiClient } from '@/services/api'
import { Connection } from '@/types'
import { Loader2, TestTube, Plus, Key, Lock } from 'lucide-react'

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

  const handleConnect = async () => {
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
        // The response is double-nested: result.data.data contains the actual connection data
        const actualData = result.data.data || result.data

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
        setTestResult(`❌ Connection failed: ${result.error}`)
      }
    } catch (error) {
      setTestResult(`❌ Connection failed: ${error}`)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Connection Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="My Server"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="protocol">Protocol</Label>
          <select
            id="protocol"
            value={formData.protocol}
            onChange={(e) => handleInputChange('protocol', e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="sftp">SFTP</option>
            <option value="ftp">FTP</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            placeholder="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="authMethod">Authentication Method</Label>
          <select
            id="authMethod"
            value={formData.authMethod}
            onChange={(e) => handleAuthMethodChange(e.target.value as 'password' | 'key')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="password">Password</option>
            <option value="key">SSH Key</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="host">Host</Label>
          <Input
            id="host"
            value={formData.host}
            onChange={(e) => handleInputChange('host', e.target.value)}
            placeholder="example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            value={formData.port}
            onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 22)}
          />
        </div>
      </div>

      {/* Authentication Fields */}
      {formData.authMethod === 'password' && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="Enter password"
          />
        </div>
      )}

      {formData.authMethod === 'key' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Private Key</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pem,.key,.ppk"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">or</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, privateKeyFile: null }))
                  }}
                  className="flex items-center gap-1"
                >
                  <Key className="h-4 w-4" />
                  Paste Key
                </Button>
              </div>

              {formData.privateKeyFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {formData.privateKeyFile.name}
                </p>
              )}

              {!formData.privateKeyFile && (
                <textarea
                  value={formData.privateKey}
                  onChange={(e) => handleKeyTextChange(e.target.value)}
                  placeholder="Paste your private key here..."
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="passphrase">Passphrase (Optional)</Label>
            <Input
              id="passphrase"
              type="password"
              value={formData.passphrase}
              onChange={(e) => handleInputChange('passphrase', e.target.value)}
              placeholder="Enter passphrase if key is encrypted"
            />
          </div>
        </div>
      )}

      {testResult && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm">{testResult}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
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
          className="flex items-center gap-2"
        >
          {isTestingConnection ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4" />
          )}
          Test Connection
        </Button>

        <Button
          onClick={handleConnect}
          disabled={
            isConnecting ||
            !formData.name ||
            !formData.host ||
            !formData.username ||
            (formData.authMethod === 'password' && !formData.password) ||
            (formData.authMethod === 'key' && !formData.privateKey && !formData.privateKeyFile)
          }
          className="flex items-center gap-2"
        >
          {isConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Connect
        </Button>
      </div>
    </div>
  )
}