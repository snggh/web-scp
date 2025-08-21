import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConnectionStore } from '@/stores/connectionStore'
import { apiClient } from '@/services/api'
import { FileItem } from '@/types'
import { Folder, File, ArrowLeft, RefreshCw, Plus, Trash2, Edit, MoreVertical } from 'lucide-react'

export function FileExplorer() {
  const { activeConnection } = useConnectionStore()
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // File operation states
  const [isOperating, setIsOperating] = useState(false)
  
  // Calculate default path based on connection without useEffect
  const getDefaultPath = (connection: typeof activeConnection) => {
    if (!connection) return '/'
    // Check for test server by host and port (regardless of connectionId status)
    const isTestServer = (connection.host === 'localhost' || connection.host === '0.0.0.0') && connection.port === 2222
    return isTestServer ? '/upload/' : `/home/${connection.username}/`
  }

  const [currentPath, setCurrentPath] = useState(() => getDefaultPath(activeConnection))

  const loadFiles = async (path: string) => {
    console.log('loadFiles called with activeConnection:', activeConnection)
    if (!activeConnection?.id) {
      console.warn('No active connection or connection ID missing:', activeConnection)
      return
    }

    console.log('Loading files:', { connectionId: activeConnection.id, path })
    setIsLoading(true)
    try {
      const response = await apiClient.listFiles(activeConnection.id, path)
      if (response.success && response.data) {
        // Handle double-nested response structure
        const actualData = response.data.data || response.data
        const fileItems: FileItem[] = actualData.files.map((file: any) => ({
          name: file.name,
          size: file.size,
          type: file.type as 'file' | 'directory',
          permissions: file.permissions,
          modified: new Date(file.modified),
          path: file.path,
        }))

        // Add parent directory entry if not at root
        const filesWithParent: FileItem[] = path !== '/' 
          ? [{
              name: '..',
              size: 0,
              type: 'directory' as const,
              permissions: 'drwxr-xr-x',
              modified: new Date(),
              path: path.split('/').slice(0, -1).join('/') || '/',
            }, ...fileItems]
          : fileItems

        setFiles(filesWithParent)
      }
    } catch (error) {
      console.error('Failed to load files:', error)
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  // Single useEffect that handles both connection changes and path changes
  useEffect(() => {
    if (activeConnection?.id) {
      // Update path when connection changes
      const newDefaultPath = getDefaultPath(activeConnection)
      if (currentPath === '/' || !activeConnection) {
        setCurrentPath(newDefaultPath)
        loadFiles(newDefaultPath)
      } else {
        loadFiles(currentPath)
      }
    } else {
      setFiles([])
    }
  }, [activeConnection?.id, currentPath])

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

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'directory') {
      const newPath = file.name === '..' 
        ? currentPath.split('/').slice(0, -1).join('/') || '/'
        : file.path
      
      if (newPath !== currentPath) {
        setCurrentPath(newPath)
      }
    }
  }

  const handlePathChange = (newPath: string) => {
    if (newPath !== currentPath) {
      setCurrentPath(newPath)
    }
  }

  const handleRefresh = () => {
    if (activeConnection?.id) {
      loadFiles(currentPath)
    }
  }

  const handleCreateDirectory = async (name: string) => {
    if (!activeConnection?.id || !name.trim()) return
    
    setIsOperating(true)
    try {
      const dirPath = currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name
      const response = await apiClient.createDirectory(activeConnection.id, dirPath)
      
      if (response.success) {
        loadFiles(currentPath) // Refresh the file list
      } else {
        console.error('Failed to create directory:', response.error)
        alert('Failed to create directory: ' + response.error)
      }
    } catch (error) {
      console.error('Error creating directory:', error)
      alert('Error creating directory')
    } finally {
      setIsOperating(false)
    }
  }

  const handleDeleteFile = async (file: FileItem) => {
    if (!activeConnection?.id) return
    
    const confirmed = confirm(`Are you sure you want to delete "${file.name}"?`)
    if (!confirmed) return
    
    setIsOperating(true)
    try {
      const response = await apiClient.deleteFile(activeConnection.id, file.path)
      
      if (response.success) {
        loadFiles(currentPath) // Refresh the file list
      } else {
        console.error('Failed to delete file:', response.error)
        alert('Failed to delete file: ' + response.error)
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Error deleting file')
    } finally {
      setIsOperating(false)
    }
  }

  const handleRenameFile = async (file: FileItem, newName: string) => {
    if (!activeConnection?.id || !newName.trim()) return
    
    setIsOperating(true)
    try {
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/'))
      const newPath = parentPath + '/' + newName
      
      const response = await apiClient.renameFile(activeConnection.id, file.path, newPath)
      
      if (response.success) {
        loadFiles(currentPath) // Refresh the file list
      } else {
        console.error('Failed to rename file:', response.error)
        alert('Failed to rename file: ' + response.error)
      }
    } catch (error) {
      console.error('Error renaming file:', error)
      alert('Error renaming file')
    } finally {
      setIsOperating(false)
    }
  }

  const openRenameDialog = (file: FileItem) => {
    const newName = prompt('Enter new name:', file.name)
    if (newName?.trim() && newName !== file.name) {
      handleRenameFile(file, newName.trim())
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
          onChange={(e) => handlePathChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleRefresh()
            }
          }}
          className="font-mono text-sm"
          placeholder="/"
        />
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isLoading}
          onClick={handleRefresh}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            const name = prompt('Enter directory name:')
            if (name?.trim()) {
              handleCreateDirectory(name.trim())
            }
          }}
          disabled={isLoading || isOperating}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg">
        <div className="grid grid-cols-12 gap-2 p-3 bg-muted text-sm font-medium border-b">
          <div className="col-span-5">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
          <div className="col-span-2">Permissions</div>
          <div className="col-span-1">Actions</div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {files.map((file, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-2 p-3 hover:bg-muted/50 border-b last:border-b-0 text-sm"
            >
              <div 
                className="col-span-5 flex items-center gap-2 cursor-pointer"
                onClick={() => handleFileClick(file)}
              >
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
              <div className="col-span-1 flex items-center gap-1">
                {file.name !== '..' && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        openRenameDialog(file)
                      }}
                      disabled={isOperating}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteFile(file)
                      }}
                      disabled={isOperating}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
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