import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConnectionStore } from '@/stores/connectionStore'
import { Folder, File, ArrowLeft, RefreshCw, Plus } from 'lucide-react'

export function FileExplorer() {
  const { activeConnection } = useConnectionStore()
  const [currentPath, setCurrentPath] = useState('/')
  const [files] = useState([
    { name: '..', type: 'directory', size: 0, modified: new Date(), permissions: 'drwxr-xr-x', path: '/' },
    { name: 'documents', type: 'directory', size: 4096, modified: new Date(), permissions: 'drwxr-xr-x', path: '/documents' },
    { name: 'photos', type: 'directory', size: 4096, modified: new Date(), permissions: 'drwxr-xr-x', path: '/photos' },
    { name: 'readme.txt', type: 'file', size: 1024, modified: new Date(), permissions: '-rw-r--r--', path: '/readme.txt' },
    { name: 'config.json', type: 'file', size: 512, modified: new Date(), permissions: '-rw-r--r--', path: '/config.json' },
  ])
  const [isLoading] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '-'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleFileClick = (file: any) => {
    if (file.type === 'directory') {
      if (file.name === '..') {
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
        setCurrentPath(parentPath)
      } else {
        setCurrentPath(file.path)
      }
    }
  }

  if (!activeConnection) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No active connection selected
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPath('/')}
          disabled={currentPath === '/'}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          className="font-mono text-sm"
          placeholder="/"
        />
        <Button variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg">
        <div className="grid grid-cols-12 gap-2 p-3 bg-muted text-sm font-medium border-b">
          <div className="col-span-6">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
          <div className="col-span-2">Permissions</div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {files.map((file, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-2 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 text-sm"
              onClick={() => handleFileClick(file)}
            >
              <div className="col-span-6 flex items-center gap-2">
                {file.type === 'directory' ? (
                  <Folder className="h-4 w-4 text-blue-500" />
                ) : (
                  <File className="h-4 w-4 text-gray-500" />
                )}
                <span className={file.name === '..' ? 'text-muted-foreground' : ''}>
                  {file.name}
                </span>
              </div>
              <div className="col-span-2 text-muted-foreground">
                {formatFileSize(file.size)}
              </div>
              <div className="col-span-2 text-muted-foreground">
                {formatDate(file.modified)}
              </div>
              <div className="col-span-2 text-muted-foreground font-mono text-xs">
                {file.permissions}
              </div>
            </div>
          ))}
        </div>

        {files.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            {isLoading ? 'Loading...' : 'No files found'}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Connected to: {activeConnection.name} ({activeConnection.host}:{activeConnection.port})
      </div>
    </div>
  )
}