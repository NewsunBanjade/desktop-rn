import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { dbService } from './dbService'

const STORAGE_LIMIT_BYTES = 40 * 1024 * 1024 * 1024 // 40 GB
const REFRESH_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

interface StorageContextValue {
  usedBytes: number
  limitBytes: number
  usedPercent: number
  isStorageFull: boolean
  isLoading: boolean
  refresh: () => Promise<void>
}

const StorageContext = createContext<StorageContextValue>({
  usedBytes: 0,
  limitBytes: STORAGE_LIMIT_BYTES,
  usedPercent: 0,
  isStorageFull: false,
  isLoading: true,
  refresh: async () => {}
})

export function useStorage(): StorageContextValue {
  return useContext(StorageContext)
}

export function StorageProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [usedBytes, setUsedBytes] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const bytes = await dbService.getTotalStorageUsed()
      setUsedBytes(bytes)
    } catch (err) {
      console.error('[StorageContext] Failed to fetch storage usage:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS)
    return (): void => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  const usedPercent = Math.min((usedBytes / STORAGE_LIMIT_BYTES) * 100, 100)
  const isStorageFull = usedBytes >= STORAGE_LIMIT_BYTES

  return (
    <StorageContext.Provider
      value={{
        usedBytes,
        limitBytes: STORAGE_LIMIT_BYTES,
        usedPercent,
        isStorageFull,
        isLoading,
        refresh
      }}
    >
      {children}
    </StorageContext.Provider>
  )
}
