import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConnectionForm } from '@/components/ConnectionForm'
import { FileExplorer } from '@/components/FileExplorer'
import { TransferQueue } from '@/components/TransferQueue'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useConnectionStore } from '@/stores/connectionStore'
import { apiClient } from '@/services/api'
import { Toaster } from '@/components/ui/toaster'
import { useConnectionHealth } from '@/hooks/useConnectionHealth'
import { useGlobalKeyboardShortcuts, useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Server, HardDrive, LogOut, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

function App() {
  const [activeTab, setActiveTab] = useState<'connect' | 'explorer'>('connect')
  const { connections, activeConnection, removeConnection, setActiveConnection } = useConnectionStore()
  const hasConnections = connections.length > 0

  // Monitor connection health and handle timeouts
  useConnectionHealth({
    checkInterval: 30 * 1000, // Check every 30 seconds for faster timeout detection
    enabled: !!activeConnection
  })

  // Auto-switch to explorer when a connection is made
  useEffect(() => {
    if (activeConnection && activeTab === 'connect') {
      setActiveTab('explorer')
    }
  }, [activeConnection, activeTab])

  // Global keyboard shortcuts
  useGlobalKeyboardShortcuts()

  // App-specific keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+1': () => hasConnections ? setActiveTab('connect') : null,
    'ctrl+2': () => hasConnections ? setActiveTab('explorer') : null,
    'ctrl+d': () => activeConnection ? handleDisconnect() : null,
  })

  const handleDisconnect = async () => {
    if (activeConnection) {
      try {
        await apiClient.disconnect(activeConnection.id)
        removeConnection(activeConnection.id)
        setActiveConnection(null)
        apiClient.clearSession()
        setActiveTab('connect')
      } catch (error) {
        console.error('Failed to disconnect:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-3"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="relative">
                <HardDrive className="h-7 w-7 text-primary" />
                <motion.div
                  className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500"
                  animate={activeConnection ? { scale: [1, 1.2, 1] } : { scale: 0 }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Web-SCP
              </h1>
            </motion.div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              
              <AnimatePresence>
                {activeConnection && (
                  <motion.div 
                    className="hidden sm:flex items-center gap-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{activeConnection.name}</span>
                      <span className="text-xs block sm:inline sm:ml-1">
                        {activeConnection.host}:{activeConnection.port}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnect}
                      className="flex items-center gap-2 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">Disconnect</span>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <motion.main 
        className="container mx-auto px-4 py-6 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {/* Navigation Tabs */}
        <motion.div 
          className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
          layout
        >
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={activeTab === 'connect' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('connect')}
              className={`flex items-center gap-2 transition-all duration-200 ${
                activeTab === 'connect' ? 'shadow-sm' : 'hover:bg-background'
              }`}
              disabled={activeConnection !== null}
            >
              <Server className="h-4 w-4" />
              {activeConnection ? 'Connected' : 'Connect'}
            </Button>
            <Button
              variant={activeTab === 'explorer' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('explorer')}
              disabled={!hasConnections}
              className={`flex items-center gap-2 transition-all duration-200 ${
                activeTab === 'explorer' ? 'shadow-sm' : 'hover:bg-background'
              }`}
            >
              <FileText className="h-4 w-4" />
              File Explorer
            </Button>
          </div>

          {/* Mobile connection status */}
          <AnimatePresence>
            {activeConnection && (
              <motion.div 
                className="sm:hidden flex items-center justify-between p-3 bg-muted rounded-lg"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-sm">
                  <span className="font-medium">{activeConnection.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {activeConnection.host}:{activeConnection.port}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Content Grid */}
        <div className={`grid grid-cols-1 gap-6 ${activeConnection ? 'xl:grid-cols-4' : ''}`}>
          {/* Main Content Area */}
          <motion.div 
            className={`space-y-6 ${activeConnection ? 'xl:col-span-3' : ''}`}
            layout
          >
            <AnimatePresence mode="wait">
              {activeTab === 'connect' && (
                <motion.div
                  key="connect"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden">
                    <CardHeader className="bg-muted/30">
                      <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Server Connection
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <ConnectionForm />
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeTab === 'explorer' && hasConnections && (
                <motion.div
                  key="explorer"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden">
                    <CardHeader className="bg-muted/30">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        File Explorer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <FileExplorer />
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeTab === 'explorer' && !hasConnections && (
                <motion.div
                  key="no-connection"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card>
                    <CardContent className="text-center py-16">
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="space-y-4"
                      >
                        <HardDrive className="h-16 w-16 mx-auto text-muted-foreground/50" />
                        <div className="space-y-2">
                          <h3 className="text-lg font-medium">No Active Connections</h3>
                          <p className="text-muted-foreground">
                            Connect to a server to start managing files
                          </p>
                        </div>
                        <Button 
                          onClick={() => setActiveTab('connect')}
                          className="mt-4"
                        >
                          <Server className="h-4 w-4 mr-2" />
                          Connect to Server
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Sidebar - Transfer Queue */}
          <AnimatePresence>
            {activeConnection && (
              <motion.div 
                className="xl:col-span-1"
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Card className="sticky top-24">
                  <CardHeader className="bg-muted/30">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      >
                        <HardDrive className="h-4 w-4" />
                      </motion.div>
                      Transfer Queue
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <TransferQueue />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.main>
      
      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}

export default App