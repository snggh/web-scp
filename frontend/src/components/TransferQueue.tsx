import { useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TransferItem, TransferProgress } from '@/types'
import { Upload, Download, Pause, Play, X, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useConnectionStore } from '@/stores/connectionStore'
import { motion, AnimatePresence } from 'motion/react'

export function TransferQueue() {
  const { transfers, updateTransferProgress, removeTransfer } = useConnectionStore()

  // Only establish WebSocket connection if there are active transfers
  const hasActiveTransfers = useMemo(() => {
    return transfers.some(t => t.status === 'transferring' || t.status === 'pending')
  }, [transfers])

  const { lastMessage, isConnected } = useWebSocket(hasActiveTransfers ? '/ws' : null)

  // Listen for WebSocket messages and update transfers
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'transfer_progress') {
      const progress: TransferProgress = lastMessage.data
      updateTransferProgress(progress)
    }
  }, [lastMessage, updateTransferProgress])

  // Remove completed or failed transfers after a delay
  useEffect(() => {
    const completedTransfers = transfers.filter(t => t.status === 'completed' || t.status === 'error')

    if (completedTransfers.length > 0) {
      const timer = setTimeout(() => {
        completedTransfers.forEach(transfer => removeTransfer(transfer.id))
      }, 5000) // Remove after 5 seconds

      return () => clearTimeout(timer)
    }
  }, [transfers, removeTransfer])

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return ''
    const k = 1024
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const getStatusIcon = (status: TransferItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'transferring':
        return <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
    }
  }

  const getActionButton = (transfer: TransferItem) => {
    if (transfer.status === 'transferring') {
      return (
        <Button variant="outline" size="sm">
          <Pause className="h-3 w-3" />
        </Button>
      )
    }
    if (transfer.status === 'paused' || transfer.status === 'error') {
      return (
        <Button variant="outline" size="sm">
          <Play className="h-3 w-3" />
        </Button>
      )
    }
    return null
  }

  const activeTransfers = transfers.filter(t => t.status === 'transferring' || t.status === 'pending')
  const completedTransfers = transfers.filter(t => t.status === 'completed')
  const failedTransfers = transfers.filter(t => t.status === 'error')

  if (transfers.length === 0) {
    return (
      <motion.div 
        className="text-center py-12"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-3"
        >
          <div className="relative mx-auto w-16 h-16">
            <motion.div 
              className="absolute inset-0 border-4 border-muted rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-2 bg-muted rounded-full flex items-center justify-center">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground">No Active Transfers</h3>
            <p className="text-xs text-muted-foreground/70">File transfers will appear here</p>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="space-y-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Transfer Stats */}
      <motion.div 
        className="grid grid-cols-3 gap-2 text-xs"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="font-medium text-blue-600 dark:text-blue-400">{activeTransfers.length}</div>
          <div className="text-blue-500 dark:text-blue-300">Active</div>
        </div>
        <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded-lg">
          <div className="font-medium text-green-600 dark:text-green-400">{completedTransfers.length}</div>
          <div className="text-green-500 dark:text-green-300">Done</div>
        </div>
        <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded-lg">
          <div className="font-medium text-red-600 dark:text-red-400">{failedTransfers.length}</div>
          <div className="text-red-500 dark:text-red-300">Failed</div>
        </div>
      </motion.div>

      {/* Transfer List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {transfers.map((transfer, index) => (
            <motion.div
              key={transfer.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ 
                duration: 0.3, 
                delay: index * 0.05,
                layout: { duration: 0.3 }
              }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-3">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {transfer.type === 'upload' ? (
                        <Upload className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Download className="h-4 w-4 text-green-500" />
                      )}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" title={transfer.fileName}>
                        {transfer.fileName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transfer.type === 'upload' ? 'Uploading' : 'Downloading'}
                      </div>
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                    >
                      {getStatusIcon(transfer.status)}
                    </motion.div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="relative w-full bg-muted rounded-full h-2 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full transition-colors duration-300 ${
                          transfer.status === 'completed'
                            ? 'bg-green-500'
                            : transfer.status === 'error'
                            ? 'bg-red-500'
                            : transfer.status === 'transferring'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-400'
                            : 'bg-gray-400'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${transfer.progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                      {transfer.status === 'transferring' && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            repeatType: "loop",
                            ease: "linear"
                          }}
                        />
                      )}
                    </div>

                    {/* Transfer Info */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-medium">{transfer.progress}%</span>
                        {transfer.speed && transfer.status === 'transferring' && (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {formatSpeed(transfer.speed)}
                          </span>
                        )}
                      </div>
                      {transfer.remainingTime && transfer.status === 'transferring' && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(transfer.remainingTime)}
                        </span>
                      )}
                    </div>

                    {/* Error Message */}
                    <AnimatePresence>
                      {transfer.error && (
                        <motion.div 
                          className="text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded border-l-2 border-red-500"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                            <span>{transfer.error}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-1 pt-1">
                      <AnimatePresence>
                        {getActionButton(transfer) && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                          >
                            {getActionButton(transfer)}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTransfer(transfer.id)}
                        className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950"
                        aria-label="Remove transfer"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Connection Status */}
      <motion.div 
        className="flex items-center justify-center gap-2 pt-2 text-xs border-t"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <motion.div 
          className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          animate={isConnected ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-muted-foreground">
          WebSocket {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        {activeTransfers.length > 0 && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-primary font-medium">
              {activeTransfers.length} active
            </span>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}