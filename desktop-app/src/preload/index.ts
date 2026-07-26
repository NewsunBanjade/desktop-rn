import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getEnv: () => ipcRenderer.sendSync('get-env'),
  uploadToR2: (
    fileName: string,
    fileBuffer: ArrayBuffer | null,
    contentType: string,
    filePath?: string
  ) => ipcRenderer.invoke('upload-to-r2', { fileName, fileBuffer, contentType, filePath }),
  deleteFromR2: (key: string) => ipcRenderer.invoke('delete-from-r2', { key }),
  generateThumbnail: (args: { filePath: string; fileBuffer: ArrayBuffer | null }) =>
    ipcRenderer.invoke('generate-thumbnail', args),
  // Get total R2 bucket storage usage via native Cloudflare REST API
  getR2BucketUsage: () =>
    ipcRenderer.invoke('r2-get-bucket-usage') as Promise<{
      payloadSize: number
      objectCount: number
      configured?: boolean
      error?: string
    }>,
  // Log errors to a file in userData for persistent debugging
  writeLog: (level: 'info' | 'error' | 'warn', message: string, data?: unknown) =>
    ipcRenderer.send('write-log', { level, message, data }),
  // Write current pending upload status to a JSON file in userData
  writePendingStatus: (pendingList: unknown) =>
    ipcRenderer.send('write-pending-status', pendingList),
  // Insert a photo row into Supabase using the main-process secret key (fallback)
  supabaseInsertPhoto: (photoPayload: unknown) =>
    ipcRenderer.invoke('supabase-insert-photo', photoPayload),
  // Save secure R2 and Supabase Secret key credentials
  saveR2Config: (config: unknown) => ipcRenderer.invoke('save-r2-config', config),
  // Retrieve safe R2 config status (masked secrets)
  getR2Config: () => ipcRenderer.invoke('get-r2-config')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
