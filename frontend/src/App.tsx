import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConnectionForm } from '@/components/ConnectionForm'
import { FileExplorer } from '@/components/FileExplorer'
import { TransferQueue } from '@/components/TransferQueue'
import { useConnectionStore } from '@/stores/connectionStore'
import { Server, HardDrive } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState<'connect' | 'explorer'>('connect')
  const { connections } = useConnectionStore()
  const hasConnections = connections.length > 0

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <HardDrive className="h-6 w-6" />
            <h1 className="text-xl font-bold">Web-SCP</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'connect' ? 'default' : 'outline'}
            onClick={() => setActiveTab('connect')}
            className="flex items-center gap-2"
          >
            <Server className="h-4 w-4" />
            Connect
          </Button>
          <Button
            variant={activeTab === 'explorer' ? 'default' : 'outline'}
            onClick={() => setActiveTab('explorer')}
            disabled={!hasConnections}
            className="flex items-center gap-2"
          >
            <HardDrive className="h-4 w-4" />
            File Explorer
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {activeTab === 'connect' && (
              <Card>
                <CardHeader>
                  <CardTitle>Server Connection</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConnectionForm />
                </CardContent>
              </Card>
            )}

            {activeTab === 'explorer' && hasConnections && (
              <Card>
                <CardHeader>
                  <CardTitle>File Explorer</CardTitle>
                </CardHeader>
                <CardContent>
                  <FileExplorer />
                </CardContent>
              </Card>
            )}

            {activeTab === 'explorer' && !hasConnections && (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground">
                    No active connections. Please connect to a server first.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Transfer Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <TransferQueue />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App