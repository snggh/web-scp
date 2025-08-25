import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HostKeyVerificationError } from '@/types'
import { Shield, AlertTriangle, Server, Eye, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

interface HostKeyVerificationDialogProps {
  isOpen: boolean
  error: HostKeyVerificationError | null
  onAccept: () => void
  onReject: () => void
  loading?: boolean
}

export function HostKeyVerificationDialog({
  isOpen,
  error,
  onAccept,
  onReject,
  loading = false
}: HostKeyVerificationDialogProps) {
  const [copied, setCopied] = useState(false)

  if (!error) return null

  const copyFingerprint = async () => {
    try {
      await navigator.clipboard.writeText(error.fingerprint)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy fingerprint:', err)
    }
  }

  const isUnknownHost = error.type === 'unknown'
  const isHostKeyChanged = error.type === 'changed'

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${
              isHostKeyChanged ? 'bg-red-100 dark:bg-red-950' : 'bg-yellow-100 dark:bg-yellow-950'
            }`}>
              {isHostKeyChanged ? (
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : (
                <Shield className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl">
                {isHostKeyChanged ? 'Host Key Changed' : 'Unknown Host Key'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Server identity verification required
              </p>
            </div>
          </div>
        </DialogHeader>

        <motion.div 
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Alert Message */}
          <Alert className={`${
            isHostKeyChanged 
              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' 
              : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
          }`}>
            <AlertDescription className="text-sm leading-relaxed">
              {error.message}
            </AlertDescription>
          </Alert>

          {/* Server Information */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4" />
              Server Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Host:</span>
                <div className="font-mono bg-background rounded px-2 py-1 mt-1">
                  {error.host}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Port:</span>
                <div className="font-mono bg-background rounded px-2 py-1 mt-1">
                  {error.port}
                </div>
              </div>
            </div>
          </div>

          {/* Host Key Fingerprint */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4" />
              Host Key Fingerprint
            </div>
            <div className="relative">
              <div className="font-mono text-xs bg-muted rounded-lg p-3 border-l-4 border-l-blue-500">
                <div className="break-all">
                  {error.fingerprint}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copyFingerprint}
                className="absolute top-2 right-2 h-7 w-7 p-0"
                disabled={loading}
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Copy className="h-3 w-3" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </div>

          {/* Security Warning */}
          <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950 p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm space-y-2">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  Security Notice
                </p>
                <div className="text-orange-700 dark:text-orange-300 space-y-1">
                  <p>
                    {isHostKeyChanged ? (
                      'This could indicate a security issue. Only proceed if you trust this server and expect the key to have changed.'
                    ) : (
                      'This is the first time connecting to this server. Verify the fingerprint matches what you expect before proceeding.'
                    )}
                  </p>
                  <p>
                    You should verify this fingerprint with your server administrator or through a trusted channel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-6">
          <Button
            onClick={onReject}
            variant="outline"
            disabled={loading}
            className="sm:flex-1"
          >
            Reject & Cancel
          </Button>
          <Button
            onClick={onAccept}
            disabled={loading}
            className={`sm:flex-1 ${
              isHostKeyChanged 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                : 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
            }`}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="mr-2"
              >
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              </motion.div>
            ) : null}
            Trust & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}