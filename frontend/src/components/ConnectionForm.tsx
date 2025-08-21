import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useConnectionStore } from '@/stores/connectionStore'
import { apiClient } from '@/services/api'
import { Connection } from '@/types'
import { Loader2, TestTube, Plus } from 'lucide-react'

export function ConnectionForm() {
  const { addConnection, setActiveConnection } = useConnectionStore()
  const [formData, setFormData] = useState({
    name: '',
    protocol: 'sftp' as 'ftp' | 'sftp',
    host: '',
    port: 22,
    username: '',
    password: '',
  })
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setTestResult(null)
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setTestResult(null)

    try {
      const result = await apiClient.testConnection({
        protocol: formData.protocol,
        host: formData.host,
        port: formData.port,
        username: formData.username,
        password: formData.password,
      })

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
      const result = await apiClient.connect(formData)

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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="password"
          />
        </div>
      </div>

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
          disabled={isTestingConnection || !formData.host || !formData.username}
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
          disabled={isConnecting || !formData.name || !formData.host || !formData.username}
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