import { app, shell, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { join, dirname } from 'path'
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Try to load local .env variables at runtime (especially useful in packaged production build)
function loadLocalEnv(): void {
  const paths = [
    join(process.cwd(), '.env'),
    join(app.getAppPath(), '.env'),
    join(app.getPath('userData'), '.env'),
    join(dirname(process.execPath), '.env')
  ]
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8')
        content.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) return
          const index = trimmed.indexOf('=')
          if (index > 0) {
            const key = trimmed.substring(0, index).trim()
            const val = trimmed
              .substring(index + 1)
              .trim()
              .replace(/^['"]|['"]$/g, '')
            // Always set — do not skip keys that already exist so .env takes precedence
            // over default empty process.env entries injected by the build tool.
            process.env[key] = val
          }
        })
        break
      } catch (err) {
        console.error('Failed to load env file from:', p, err)
      }
    }
  }
}

interface SecureConfig {
  CLOUDFLARE_R2_ACCOUNT_ID?: string
  CLOUDFLARE_R2_ACCESS_KEY_ID_ENC?: string
  CLOUDFLARE_R2_SECRET_ACCESS_KEY_ENC?: string
  CLOUDFLARE_R2_BUCKET_NAME?: string
  CLOUDFLARE_R2_PUBLIC_URL?: string
  CLOUDFLARE_API_TOKEN_ENC?: string
  SUPABASE_SECRET_KEY_ENC?: string
}

function decryptField(encryptedBase64: string | undefined): string {
  if (!encryptedBase64) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encryptedBase64, 'base64')
      return safeStorage.decryptString(buffer)
    } else {
      return Buffer.from(encryptedBase64, 'base64').toString('utf-8')
    }
  } catch (e) {
    console.error('[Secure Config] Failed to decrypt field:', e)
    return ''
  }
}

function encryptField(plainText: string): string {
  if (!plainText) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(plainText)
      return buffer.toString('base64')
    } else {
      return Buffer.from(plainText, 'utf-8').toString('base64')
    }
  } catch (e) {
    console.error('[Secure Config] Failed to encrypt field:', e)
    return ''
  }
}

function loadSecureConfig(): void {
  const configPath = join(app.getPath('userData'), 'secure_r2_config.json')
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8')
      const config: SecureConfig = JSON.parse(raw)

      if (config.CLOUDFLARE_R2_ACCOUNT_ID) {
        process.env.CLOUDFLARE_R2_ACCOUNT_ID = config.CLOUDFLARE_R2_ACCOUNT_ID
      }
      if (config.CLOUDFLARE_R2_BUCKET_NAME) {
        process.env.CLOUDFLARE_R2_BUCKET_NAME = config.CLOUDFLARE_R2_BUCKET_NAME
      }
      if (config.CLOUDFLARE_R2_PUBLIC_URL) {
        process.env.CLOUDFLARE_R2_PUBLIC_URL = config.CLOUDFLARE_R2_PUBLIC_URL
      }

      const accessKeyId = decryptField(config.CLOUDFLARE_R2_ACCESS_KEY_ID_ENC)
      if (accessKeyId) process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = accessKeyId

      const secretAccessKey = decryptField(config.CLOUDFLARE_R2_SECRET_ACCESS_KEY_ENC)
      if (secretAccessKey) process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = secretAccessKey

      const apiToken = decryptField(config.CLOUDFLARE_API_TOKEN_ENC)
      if (apiToken) process.env.CLOUDFLARE_API_TOKEN = apiToken

      const supabaseSecretKey = decryptField(config.SUPABASE_SECRET_KEY_ENC)
      if (supabaseSecretKey) {
        process.env.SUPABASE_SECRET_KEY = supabaseSecretKey
        process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseSecretKey
      }

      console.log('[Secure Config] Loaded and decrypted secure configuration from disk')
    } catch (e) {
      console.error('[Secure Config] Failed to load secure config:', e)
    }
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Load env variables
  loadLocalEnv()
  // Load secure configs from encrypted disk file
  loadSecureConfig()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Cached S3 Client credentials and instance
  let cachedS3Client: any = null
  let cachedAccessKeyId = ''
  let cachedSecretAccessKey = ''
  let cachedAccountId = ''

  async function getS3Client(): Promise<any> {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || ''
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || ''
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ''

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Cloudflare R2 credentials are not configured in main process environment')
    }

    if (
      cachedS3Client &&
      cachedAccessKeyId === accessKeyId &&
      cachedSecretAccessKey === secretAccessKey &&
      cachedAccountId === accountId
    ) {
      return cachedS3Client
    }

    const { S3Client } = await import('@aws-sdk/client-s3')
    cachedS3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    })
    cachedAccessKeyId = accessKeyId
    cachedSecretAccessKey = secretAccessKey
    cachedAccountId = accountId

    return cachedS3Client
  }

  // IPC handler to return public env variables safely to renderer process (omitting secrets)
  ipcMain.on('get-env', (event) => {
    event.returnValue = {
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      SUPABASE_PUBLISHABLE_KEY:
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        '',
      CLOUDFLARE_R2_PUBLIC_URL:
        process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || '',
      IS_PACKAGED: app.isPackaged,
      USER_DATA_PATH: app.getPath('userData'),
      EXE_DIR_PATH: dirname(process.execPath)
    }
  })

  // IPC handler to save secure config credentials (uses Electron's safeStorage API)
  ipcMain.handle('save-r2-config', async (_event, config) => {
    try {
      const configPath = join(app.getPath('userData'), 'secure_r2_config.json')
      let existing: SecureConfig = {}
      if (existsSync(configPath)) {
        try {
          existing = JSON.parse(readFileSync(configPath, 'utf-8'))
        } catch {}
      }

      const secureConfig: SecureConfig = {
        CLOUDFLARE_R2_ACCOUNT_ID: config.accountId,
        CLOUDFLARE_R2_BUCKET_NAME: config.bucketName,
        CLOUDFLARE_R2_PUBLIC_URL: config.publicUrl,
        CLOUDFLARE_R2_ACCESS_KEY_ID_ENC: config.accessKeyId
          ? encryptField(config.accessKeyId)
          : existing.CLOUDFLARE_R2_ACCESS_KEY_ID_ENC || '',
        CLOUDFLARE_R2_SECRET_ACCESS_KEY_ENC: config.secretAccessKey
          ? encryptField(config.secretAccessKey)
          : existing.CLOUDFLARE_R2_SECRET_ACCESS_KEY_ENC || '',
        CLOUDFLARE_API_TOKEN_ENC: config.apiToken
          ? encryptField(config.apiToken)
          : existing.CLOUDFLARE_API_TOKEN_ENC || '',
        SUPABASE_SECRET_KEY_ENC: config.supabaseSecretKey
          ? encryptField(config.supabaseSecretKey)
          : existing.SUPABASE_SECRET_KEY_ENC || ''
      }

      writeFileSync(configPath, JSON.stringify(secureConfig, null, 2), 'utf-8')

      // Reload credentials into environment variables for immediate use
      loadSecureConfig()

      return { success: true }
    } catch (error: any) {
      console.error('[Secure Config] Save failed:', error)
      throw new Error(error.message || 'Failed to save secure configuration')
    }
  })

  // IPC handler to return masked secure configuration status (without returning secret keys)
  ipcMain.handle('get-r2-config', async () => {
    try {
      const configPath = join(app.getPath('userData'), 'secure_r2_config.json')
      if (!existsSync(configPath)) {
        return { configured: false }
      }
      const raw = readFileSync(configPath, 'utf-8')
      const config: SecureConfig = JSON.parse(raw)

      const accessKeyId = decryptField(config.CLOUDFLARE_R2_ACCESS_KEY_ID_ENC)
      const secretAccessKey = decryptField(config.CLOUDFLARE_R2_SECRET_ACCESS_KEY_ENC)
      const apiToken = decryptField(config.CLOUDFLARE_API_TOKEN_ENC)
      const supabaseSecretKey = decryptField(config.SUPABASE_SECRET_KEY_ENC)

      return {
        configured: true,
        accountId: config.CLOUDFLARE_R2_ACCOUNT_ID || '',
        bucketName: config.CLOUDFLARE_R2_BUCKET_NAME || '',
        publicUrl: config.CLOUDFLARE_R2_PUBLIC_URL || '',
        hasAccessKeyId: !!accessKeyId,
        hasSecretAccessKey: !!secretAccessKey,
        hasApiToken: !!apiToken,
        hasSupabaseSecretKey: !!supabaseSecretKey
      }
    } catch (e) {
      console.error('[Secure Config] Get status failed:', e)
      return { configured: false }
    }
  })

  // IPC handler to upload files to Cloudflare R2 bucket (accepts fileBuffer or filePath)
  ipcMain.handle('upload-to-r2', async (_event, { fileName, fileBuffer, filePath, contentType }) => {
    try {
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'imagecdn'
      const s3Client = await getS3Client()

      let body: Buffer | import('fs').ReadStream
      if (filePath) {
        const { createReadStream } = await import('fs')
        body = createReadStream(filePath)
      } else {
        body = Buffer.from(fileBuffer)
      }

      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: body,
          ContentType: contentType
        })
      )

      const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || ''
      const fileUrl = `${publicUrl.replace(/\/$/, '')}/${fileName}`
      console.log(`[Main Process] R2 Upload Success: ${fileUrl}`)
      return fileUrl
    } catch (error: any) {
      console.error('[Main Process] R2 Upload Error:', error)
      throw new Error(error.message || 'Failed to upload to Cloudflare R2')
    }
  })

  // IPC handler to delete file from Cloudflare R2 bucket
  ipcMain.handle('delete-from-r2', async (_event, { key }) => {
    try {
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'imagecdn'
      const s3Client = await getS3Client()

      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key
        })
      )

      console.log(`[Main Process] R2 Delete Success: ${key}`)
      return true
    } catch (error: any) {
      console.error('[Main Process] R2 Delete Error:', error)
      throw new Error(error.message || 'Failed to delete from Cloudflare R2')
    }
  })

  // IPC handler to generate a thumbnail buffer natively from a file path or buffer using Electron's nativeImage
  ipcMain.handle('generate-thumbnail', async (_event, { filePath, fileBuffer }) => {
    try {
      const { nativeImage } = require('electron')
      const img = filePath
        ? nativeImage.createFromPath(filePath)
        : nativeImage.createFromBuffer(Buffer.from(fileBuffer))

      if (img.isEmpty()) {
        throw new Error('Failed to load image for thumbnail generation')
      }

      // Resize the image natively to 200x200
      const resized = img.resize({ width: 200, height: 200, quality: 'better' })
      return resized.toJPEG(85)
    } catch (error: any) {
      console.error('[Main Process] Thumbnail Generation Error:', error)
      throw new Error(error.message || 'Failed to generate thumbnail')
    }
  })

  // IPC handler to fetch R2 bucket storage usage via the native Cloudflare REST API
  // GET /accounts/{account_id}/r2/buckets/{bucket_name}/usage
  // NEVER throws — returns { payloadSize, objectCount, configured } so the renderer
  // can fall back gracefully without Electron logging "Error occurred in handler".
  ipcMain.handle('r2-get-bucket-usage', async () => {
    const accountId =
      process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID || ''
    const bucketName =
      process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || ''
    const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.VITE_CLOUDFLARE_API_TOKEN || ''

    // Return unconfigured sentinel — renderer will fall back to Supabase sum
    if (!accountId || !bucketName || !apiToken) {
      const missing = [
        !accountId && 'CLOUDFLARE_R2_ACCOUNT_ID',
        !bucketName && 'CLOUDFLARE_R2_BUCKET_NAME',
        !apiToken && 'CLOUDFLARE_API_TOKEN'
      ]
        .filter(Boolean)
        .join(', ')
      console.warn(
        `[Main Process] r2-get-bucket-usage: missing env vars (${missing}). Add CLOUDFLARE_API_TOKEN to .env with R2:Read permission.`
      )
      return { payloadSize: 0, objectCount: 0, configured: false }
    }

    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/usage`
      console.log(`[Main Process] Fetching R2 bucket usage: ${url}`)

      const { net } = await import('electron')
      const response = await net.fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`[Main Process] R2 usage API HTTP ${response.status}:`, errText)
        return {
          payloadSize: 0,
          objectCount: 0,
          configured: true,
          error: `HTTP ${response.status}`
        }
      }

      const json = (await response.json()) as {
        success: boolean
        errors: Array<{ message: string }>
        result: {
          payloadSize: number
          metadataSize: number
          objectCount: number
          uploadCount: number
        }
      }

      if (!json.success) {
        const errMsg =
          json.errors?.map((e) => e.message).join(', ') || 'Unknown Cloudflare API error'
        console.error('[Main Process] Cloudflare API error:', errMsg)
        return { payloadSize: 0, objectCount: 0, configured: true, error: errMsg }
      }

      const payloadSize = json.result?.payloadSize ?? 0
      const objectCount = json.result?.objectCount ?? 0
      console.log(`[Main Process] R2 bucket usage: ${payloadSize} bytes | ${objectCount} objects`)
      return { payloadSize, objectCount, configured: true }
    } catch (err: any) {
      console.error('[Main Process] r2-get-bucket-usage fetch error:', err?.message || err)
      return { payloadSize: 0, objectCount: 0, configured: true, error: err?.message }
    }
  })

  // IPC handler to write error logs to a persistent log file
  ipcMain.on('write-log', (_event, { level, message, data }) => {
    const logPath = join(app.getPath('userData'), 'supabase_upload_errors.log')
    const timestamp = new Date().toISOString()
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}\n`
    try {
      appendFileSync(logPath, logLine, 'utf-8')
      console.log(`[Log Writer] Written to ${logPath}`)
    } catch (err) {
      console.error('[Log Writer] Failed to write log:', err)
    }
    // Always print to terminal too
    if (level === 'error') {
      console.error(`[Supabase Sync Error] ${message}`, data || '')
    } else {
      console.log(`[Supabase Sync] ${message}`, data || '')
    }
  })

  // IPC handler to insert photo into Supabase using the secret/service key
  // This is a fallback when the renderer-side anon key insert fails
  ipcMain.handle('supabase-insert-photo', async (_event, photoPayload) => {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
      const secretKey =
        process.env.SUPABASE_SECRET_KEY ||
        process.env.VITE_SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        ''

      if (!supabaseUrl || !secretKey) {
        throw new Error('Supabase URL or secret key not configured in main process environment')
      }

      console.log(
        `[Main Supabase] Inserting photo into Supabase photos table: ${photoPayload.file_name}`
      )

      // Use dynamic import to avoid bundling issues
      const { createClient } = await import('@supabase/supabase-js')
      const adminClient = createClient(supabaseUrl, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })

      const { data, error } = await adminClient
        .from('photos')
        .insert([photoPayload])
        .select()
        .single()

      if (error) {
        const logPath = join(app.getPath('userData'), 'supabase_upload_errors.log')
        const timestamp = new Date().toISOString()
        const logLine = `[${timestamp}] [ERROR] Main-process Supabase insert failed for ${photoPayload.file_name} | ${JSON.stringify({ message: error.message, code: error.code, details: error.details, hint: error.hint })}\n`
        try {
          appendFileSync(logPath, logLine, 'utf-8')
        } catch {}
        console.error('[Main Supabase] Insert error:', error)
        throw new Error(error.message || 'Supabase insert failed')
      }

      console.log(
        `[Main Supabase] Successfully inserted photo: ${photoPayload.file_name} (id: ${data?.id})`
      )
      return data
    } catch (error: any) {
      console.error('[Main Supabase] supabase-insert-photo error:', error)
      throw new Error(error.message || 'Failed to insert photo in Supabase')
    }
  })

  // IPC handler to write a status file listing pending photos for debugging
  ipcMain.on('write-pending-status', (_event, pendingList) => {
    try {
      const statusPath = join(app.getPath('userData'), 'pending_uploads_status.json')
      writeFileSync(statusPath, JSON.stringify(pendingList, null, 2), 'utf-8')
      console.log(`[Status Writer] Pending uploads written to ${statusPath}`)
    } catch (err) {
      console.error('[Status Writer] Failed to write status file:', err)
    }
  })

  // IPC handler to insert/upsert an album row into Supabase using the secret/service key.
  // Used by ensureAlbumExists() to recover missing parent albums before photo insert.
  ipcMain.handle('supabase-insert-album', async (_event, albumPayload) => {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
      const secretKey =
        process.env.SUPABASE_SECRET_KEY ||
        process.env.VITE_SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        ''

      if (!supabaseUrl || !secretKey) {
        throw new Error('Supabase URL or secret key not configured in main process environment')
      }

      console.log(
        `[Main Supabase] Ensuring album exists in Supabase: id=${albumPayload.id}, name="${albumPayload.name}"`
      )

      const { createClient } = await import('@supabase/supabase-js')
      const adminClient = createClient(supabaseUrl, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })

      // Use upsert so we don't fail if album already exists
      const { data, error } = await adminClient
        .from('albums')
        .upsert([albumPayload], { onConflict: 'id' })
        .select()
        .single()

      if (error) {
        const logPath = join(app.getPath('userData'), 'supabase_upload_errors.log')
        const timestamp = new Date().toISOString()
        const logLine = `[${timestamp}] [ERROR] Album upsert failed for ${albumPayload.id} | ${JSON.stringify({ message: error.message, code: error.code, hint: error.hint })}\n`
        try {
          appendFileSync(logPath, logLine, 'utf-8')
        } catch {}
        console.error('[Main Supabase] Album upsert error:', error)
        throw new Error(error.message || 'Album upsert failed')
      }

      console.log(`[Main Supabase] Album ensured: id=${data?.id}`)
      return data
    } catch (error: any) {
      console.error('[Main Supabase] supabase-insert-album error:', error)
      throw new Error(error.message || 'Failed to upsert album in Supabase')
    }
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
