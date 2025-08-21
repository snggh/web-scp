import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useConnectionStore } from '@/stores/connectionStore'
import { apiClient } from '@/services/api'
import { Connection } from '@/types'
import { Loader2, TestTube, Plus, Key, Lock } from 'lucide-react'

type AuthMethod = 'password' | 'key'

export function ConnectionForm() {
  const { addConnection, setActiveConnection } = useConnectionStore()
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')
  const [formData, setFormData] = useState({
    name: '',
    protocol: 'sftp' as 'ftp' | 'sftp',
    host: '',
    port: 22,
    username: '',
    password: '',
    keyFile: '',
    keyContent: '',
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
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setFormData(prev => ({ ...prev, keyContent: content }))
        setTestResult(null)
      }
      reader.readAsText(file)
    }
  }

  const isFormValid = () => {
    const basicFields = formData.name && formData.host && formData.username
    if (!basicFields) return false

    if (authMethod === 'password') {
      return formData.password.length > 0
    } else {
      return formData.keyContent.length > 0
    }
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setTestResult(null)

    try {
      const testData: any = {
        protocol: formData.protocol,
        host: formData.host,
        port: formData.port,
        username: formData.username,
      }

      if (authMethod === 'password') {
        testData.password = formData.password
      } else {
        testData.keyContent = formData.keyContent
        if (formData.passphrase) {
          testData.passphrase = formData.passphrase
        }
      }

      console.log('Test connection data:', testData)
      console.log('Form data keyContent length:', formData.keyContent.length)
      console.log('Auth method:', authMethod)

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
      const connectData: any = {
        name: formData.name,
        protocol: formData.protocol,
        host: formData.host,
        port: formData.port,
        username: formData.username,
      }

      if (authMethod === 'password') {
        connectData.password = formData.password
      } else {
        connectData.keyContent = formData.keyContent
        if (formData.passphrase) {
          connectData.passphrase = formData.passphrase
        }
      }

      const result = await apiClient.connect(connectData)

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
          password: '',
          keyFile: '',
          keyContent: '',
          passphrase: '',
        })
        setAuthMethod('password')
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

      <div className="space-y-2">
        <Label>Authentication Method</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={authMethod === 'password' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAuthMethod('password')}
            className="flex items-center gap-2"
          >
            <Lock className="h-4 w-4" />
            Password
          </Button>
          <Button
            type="button"
            variant={authMethod === 'key' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAuthMethod('key')}
            className="flex items-center gap-2"
          >
            <Key className="h-4 w-4" />
            SSH Key
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => handleInputChange('username', e.target.value)}
          placeholder="username"
        />
      </div>

      {authMethod === 'password' ? (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="password"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="keyFile">SSH Private Key</Label>
            <div className="space-y-2">
              <Input
                id="keyFile"
                type="file"
                accept=".pem,.key,.ppk,*"
                onChange={handleFileUpload}
                className="file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-muted-foreground">
                Upload your private key file (usually id_rsa, id_ed25519, etc.)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyContent">Or paste key content</Label>
            <Textarea
              id="keyContent"
              value={formData.keyContent}
              onChange={(e) => handleInputChange('keyContent', e.target.value)}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passphrase">Passphrase (optional)</Label>
            <Input
              id="passphrase"
              type="password"
              value={formData.passphrase}
              onChange={(e) => handleInputChange('passphrase', e.target.value)}
              placeholder="Enter passphrase if your key is encrypted"
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
          disabled={isTestingConnection || !formData.host || !formData.username || (authMethod === 'key' && !formData.keyContent)}
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
          disabled={isConnecting || !isFormValid()}
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