import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useConnectionStore } from '@/stores/connectionStore'
import { apiClient } from '@/services/api'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useTimeoutHandler } from '@/hooks/useTimeoutHandler'
import { FileItem } from '@/types'
import { 
  Folder, 
  File, 
  ArrowLeft, 
  RefreshCw, 
  Trash2, 
  Edit, 
  Upload, 
  Download,
  Home,
  FolderPlus,
  FileText,
  Image,
  Music,
  Video,
  Archive,
  Code
} from 'lucide-react'


export function FileExplorer() {
  const { activeConnection } = useConnectionStore()
  const { wrapApiCall } = useTimeoutHandler()
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // File operation states
  const [isOperating, setIsOperating] = useState(false)

  // Drag and drop states
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // UI states
  const [selectedFiles] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get file icon based on file type and extension
  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return <Folder className="h-4 w-4 text-blue-500" />
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    
    // Image files
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'heic'].includes(extension || '')) {
      return <Image className="h-4 w-4 text-green-500" />
    }
    
    // Video files
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension || '')) {
      return <Video className="h-4 w-4 text-red-500" />
    }
    
    // Audio files
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(extension || '')) {
      return <Music className="h-4 w-4 text-purple-500" />
    }
    
    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(extension || '')) {
      return <Archive className="h-4 w-4 text-orange-500" />
    }
    
    // Code files
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs', 'swift'].includes(extension || '')) {
      return <Code className="h-4 w-4 text-cyan-500" />
    }
    
    // Text files
    if (['txt', 'md', 'csv', 'json', 'xml', 'yml', 'yaml'].includes(extension || '')) {
      return <FileText className="h-4 w-4 text-gray-500" />
    }
    
    // Default file icon
    return <File className="h-4 w-4 text-gray-500" />
  }
  
  // Calculate default path based on connection without useEffect
  const getDefaultPath = (connection: typeof activeConnection) => {
    if (!connection) return '/'
    // Check for test server by host and port (regardless of connectionId status)
    const isTestServer = (connection.host === 'localhost' || connection.host === '0.0.0.0') && connection.port === 2222
    return isTestServer ? '/upload/' : `/home/${connection.username}/`
  }

  const [currentPath, setCurrentPath] = useState(() => getDefaultPath(activeConnection))

  // File Explorer keyboard shortcuts
  useKeyboardShortcuts({
    'f5': () => handleRefresh(),
    'ctrl+r': () => handleRefresh(),
    'ctrl+shift+n': () => {
      const name = prompt('Enter directory name:')
      if (name?.trim()) {
        handleCreateDirectory(name.trim())
      }
    },
    'ctrl+u': () => fileInputRef.current?.click(),
    'backspace': () => {
      if (currentPath !== '/') {
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
        setCurrentPath(parentPath)
      }
    },
    'alt+up': () => {
      if (currentPath !== '/') {
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
        setCurrentPath(parentPath)
      }
    },
    'ctrl+home': () => setCurrentPath('/'),
  }, !!activeConnection)

  const loadFiles = async (path: string) => {
    if (!activeConnection?.id) {
      return
    }
    setIsLoading(true)
    try {
      const response = await wrapApiCall(
        () => apiClient.listFiles(activeConnection.id, path),
        'loading files'
      )
      
      if (!response) {
        // Timeout occurred, component state will be reset by timeout handler
        return
      }
      
      if (response.success && response.data) {
        // Handle response structure
        const actualData = (response.data as any).data || response.data
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

  // File upload handlers
  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || !activeConnection?.id) return

    const filesArray = Array.from(selectedFiles)
    handleFilesUpload(filesArray)
  }

  const handleFilesUpload = async (files: File[]) => {
    if (!activeConnection?.id || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of files) {
        const remotePath = currentPath.endsWith('/') ? currentPath + file.name : currentPath + '/' + file.name

        const response = await apiClient.uploadFile(activeConnection.id, file, remotePath)
        if (response.success) {
          console.log('File uploaded successfully:', file.name)
        } else {
          console.error('Failed to upload file:', file.name, response.error)
          alert('Failed to upload file: ' + response.error)
        }
      }

      // Refresh file list after all uploads complete
      loadFiles(currentPath)
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Error uploading files')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadFile = async (file: FileItem) => {
    if (!activeConnection?.id) return

    try {
      const response = await apiClient.downloadFile(activeConnection.id, file.path)

      if (response.success && response.data) {
        // Create download link using the blob from response
        const url = window.URL.createObjectURL(response.data)
        const a = document.createElement('a')
        a.href = url
        a.download = response.fileName || file.name
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error('Failed to download file:', response.error)
        alert('Failed to download file: ' + response.error)
      }
    } catch (error) {
      console.error('Error downloading file:', error)
      alert('Error downloading file')
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files)
    }
  }

  if (!activeConnection) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No active connection selected
      </div>
    )
  }

  // Sort files
  const sortedFiles = [...files].sort((a, b) => {
    let aValue: string | number
    let bValue: string | number
    
    if (sortBy === 'modified') {
      aValue = a.modified.getTime()
      bValue = b.modified.getTime()
    } else if (sortBy === 'size') {
      aValue = a.size
      bValue = b.size
    } else {
      aValue = a.name.toLowerCase()
      bValue = b.name.toLowerCase()
    }
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    return sortOrder === 'asc' ? comparison : -comparison
  })

  return (
    <div className="space-y-4">
      {/* Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Path Navigation */}
        <div className="flex items-center gap-2 flex-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPath('/')}
            disabled={currentPath === '/' || isLoading}
            aria-label="Go to root directory"
          >
            <Home className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
              setCurrentPath(parentPath)
            }}
            disabled={currentPath === '/' || isLoading}
            aria-label="Go back"
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
            className="font-mono text-sm flex-1 min-w-0"
            placeholder="/"
            aria-label="Current path"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={isLoading}
            onClick={handleRefresh}
            aria-label="Refresh directory"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading || isOperating}
                aria-label="Create new directory"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Directory</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Directory name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement
                      if (target.value.trim()) {
                        handleCreateDirectory(target.value.trim())
                        target.value = ''
                      }
                    }
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isUploading}
            aria-label="Upload files"
          >
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e.target.files)}
        aria-label="File upload input"
      />

      {/* File List */}
      <div
        className={`border rounded-lg transition-all duration-200 ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 rounded-lg backdrop-blur-sm">
            <div className="text-center text-primary">
              <Upload className="h-12 w-12 mx-auto mb-2" />
              <p className="font-medium">Drop files here to upload</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="grid grid-cols-12 gap-3 p-4 bg-muted/50 text-sm font-medium border-b">
          <div className="col-span-5 flex items-center gap-2">
            <button
              onClick={() => {
                if (sortBy === 'name') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                } else {
                  setSortBy('name')
                  setSortOrder('asc')
                }
              }}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              Name
              {sortBy === 'name' && (
                <span className={`transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}>
                  ↑
                </span>
              )}
            </button>
          </div>
          <div className="col-span-2">
            <button
              onClick={() => {
                if (sortBy === 'size') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                } else {
                  setSortBy('size')
                  setSortOrder('desc')
                }
              }}
              className="hover:text-primary transition-colors"
            >
              Size
            </button>
          </div>
          <div className="col-span-2">
            <button
              onClick={() => {
                if (sortBy === 'modified') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                } else {
                  setSortBy('modified')
                  setSortOrder('desc')
                }
              }}
              className="hover:text-primary transition-colors"
            >
              Modified
            </button>
          </div>
          <div className="col-span-2">Permissions</div>
          <div className="col-span-1">Actions</div>
        </div>

        {/* File List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {sortedFiles.map((file) => (
            <div
              key={`${file.path}-${file.name}`}
              className={`group grid grid-cols-12 gap-3 p-3 hover:bg-muted/50 border-b last:border-b-0 text-sm transition-colors cursor-pointer ${
                selectedFiles.includes(file.path) ? 'bg-primary/10' : ''
              }`}
              onClick={() => handleFileClick(file)}
              onDoubleClick={() => {
                if (file.type === 'directory') {
                  handleFileClick(file)
                } else {
                  handleDownloadFile(file)
                }
              }}
            >
              <div className="col-span-5 flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0">
                  {getFileIcon(file)}
                </div>
                <span 
                  className={`truncate ${
                    file.name === '..' ? 'text-muted-foreground font-medium' : ''
                  }`}
                  title={file.name}
                >
                  {file.name}
                </span>
              </div>
              <div className="col-span-2 text-muted-foreground tabular-nums">
                {formatFileSize(file.size)}
              </div>
              <div className="col-span-2 text-muted-foreground text-xs">
                {formatDate(file.modified)}
              </div>
              <div className="col-span-2 text-muted-foreground font-mono text-xs">
                {file.permissions}
              </div>
              <div className="col-span-1 flex items-center justify-center">
                {file.name !== '..' && (
                  <div className="flex items-center gap-1 transition-opacity">
                    {file.type === 'file' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadFile(file)
                        }}
                        disabled={isOperating}
                        title="Download file"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900"
                      onClick={(e) => {
                        e.stopPropagation()
                        openRenameDialog(file)
                      }}
                      disabled={isOperating}
                      title="Rename"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteFile(file)
                      }}
                      disabled={isOperating}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {files.length === 0 && !isLoading && !isUploading && (
          <div className="p-16 text-center text-muted-foreground">
            <Folder className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Directory is empty</h3>
            <p className="text-sm">Upload files or create directories to get started</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="p-16 text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 text-primary animate-spin" />
            <p className="text-muted-foreground">Loading directory contents...</p>
          </div>
        )}

        {/* Upload State */}
        {isUploading && (
          <div className="p-16 text-center text-primary">
            <Upload className="h-12 w-12 mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-medium mb-2">Uploading files...</h3>
            <p className="text-sm text-muted-foreground">Please wait while files are being uploaded</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            {files.length > 0 ? `${files.length} item${files.length !== 1 ? 's' : ''}` : 'Empty directory'}
          </span>
          {selectedFiles.length > 0 && (
            <span className="text-primary">
              {selectedFiles.length} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>Connected to:</span>
          <span className="font-medium text-foreground">{activeConnection.name}</span>
          <span>({activeConnection.host}:{activeConnection.port})</span>
        </div>
      </div>
    </div>
  )
}