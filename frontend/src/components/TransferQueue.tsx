import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TransferItem } from '@/types'
import { Upload, Download, Pause, Play, X, CheckCircle, AlertCircle } from 'lucide-react'

export function TransferQueue() {
  const [transfers] = useState<TransferItem[]>([
    {
      id: '1',
      type: 'upload',
      fileName: 'document.pdf',
      progress: 75,
      status: 'transferring',
      speed: 1024 * 1024 * 2, // 2 MB/s
      remainingTime: 30,
    },
    {
      id: '2',
      type: 'download',
      fileName: 'image.jpg',
      progress: 100,
      status: 'completed',
    },
    {
      id: '3',
      type: 'upload',
      fileName: 'video.mp4',
      progress: 0,
      status: 'pending',
    },
    {
      id: '4',
      type: 'download',
      fileName: 'archive.zip',
      progress: 45,
      status: 'error',
      error: 'Connection lost',
    },
  ])

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

  if (transfers.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No active transfers
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {transfers.map((transfer) => (
        <Card key={transfer.id}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              {transfer.type === 'upload' ? (
                <Upload className="h-4 w-4 text-blue-500" />
              ) : (
                <Download className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-medium flex-1 truncate">
                {transfer.fileName}
              </span>
              {getStatusIcon(transfer.status)}
            </div>

            <div className="space-y-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    transfer.status === 'completed'
                      ? 'bg-green-500'
                      : transfer.status === 'error'
                      ? 'bg-red-500'
                      : transfer.status === 'transferring'
                      ? 'bg-blue-500'
                      : 'bg-gray-400'
                  }`}
                  style={{ width: `${transfer.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{transfer.progress}%</span>
                {transfer.speed && transfer.status === 'transferring' && (
                  <span>{formatSpeed(transfer.speed)}</span>
                )}
                {transfer.remainingTime && transfer.status === 'transferring' && (
                  <span>{formatTime(transfer.remainingTime)} left</span>
                )}
              </div>

              {transfer.error && (
                <div className="text-xs text-red-500">{transfer.error}</div>
              )}

              <div className="flex items-center gap-1 pt-1">
                {getActionButton(transfer)}
                <Button variant="outline" size="sm">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="text-xs text-muted-foreground text-center pt-2">
        {transfers.filter(t => t.status === 'transferring').length} active transfers
      </div>
    </div>
  )
}