import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTheme } from '@/contexts/ThemeContext'
import { motion } from 'motion/react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const icons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  }

  const IconComponent = icons[theme]

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger className="w-[150px] h-9">
        <div className="flex items-center gap-2">
          <motion.div
            key={theme}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <IconComponent className="h-4 w-4" />
          </motion.div>
          <SelectValue placeholder="Theme">
            {theme.charAt(0).toUpperCase() + theme.slice(1)}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Light
          </div>
        </SelectItem>
        <SelectItem value="dark">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Dark
          </div>
        </SelectItem>
        <SelectItem value="system">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            System
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export function SimpleThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const icons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  }

  const IconComponent = icons[theme]

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="relative overflow-hidden"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'} theme`}
    >
      <motion.div
        key={theme}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2"
      >
        <IconComponent className="h-4 w-4" />
        <span className="sr-only">
          Current theme: {theme} (appears {resolvedTheme})
        </span>
      </motion.div>
    </Button>
  )
}
