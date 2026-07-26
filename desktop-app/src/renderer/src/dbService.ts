import { getSupabase } from './supabase'
import { readAndCompressImage } from 'browser-image-resizer'

function logError(context: string, err: unknown): void {
  if (err && typeof err === 'object') {
    const errorObj = err as Record<string, unknown>
    console.error(`[Supabase Error] ${context}:`, {
      message: errorObj.message || 'No message',
      code: errorObj.code || 'No code',
      details: errorObj.details || 'No details',
      hint: errorObj.hint || 'No hint',
      raw: err
    })
  } else {
    console.error(`[Supabase Error] ${context}:`, err)
  }
}

export interface Album {
  id: string
  name: string
  description?: string
  cover_image_url?: string
  created_at: string
  expiry_date?: string | null
  code?: string | null
}

export interface AlbumImage {
  id: string
  album_id: string
  url: string
  thumbnail?: string
  name: string
  size_bytes?: number
  created_at: string
  is_featured?: boolean
}

export interface UserSession {
  email: string
  id: string
}

// ----------------------------------------------------
// Mock Data Store (Fallback)
// ----------------------------------------------------
const MOCK_USER_KEY = 'rn_studio_mock_user'
const MOCK_ALBUMS_KEY = 'rn_studio_mock_albums'
const MOCK_IMAGES_KEY = 'rn_studio_mock_images'
const MOCK_FEATURED_KEY = 'rn_studio_mock_featured'

const DEFAULT_FEATURED: AlbumImage[] = [
  {
    id: 'mock-featured-1',
    album_id: '',
    name: 'featured_wedding.jpg',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&auto=format&fit=crop&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1519741497674-611481863552?w=300&auto=format&fit=crop&q=60',
    size_bytes: 2450000,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'mock-featured-2',
    album_id: '',
    name: 'featured_portrait.jpg',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=60',
    size_bytes: 2200000,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  }
]

// Initial mock data if empty
const DEFAULT_ALBUMS: Album[] = [
  {
    id: 'mock-album-1',
    name: 'Weddings & Celebrations',
    description: 'Beautiful stories of love, weddings, and premium ceremonies by RN Studio.',
    cover_image_url:
      'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=60',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'mock-album-2',
    name: 'Fashion & Portraits',
    description: 'High-end studio photography, modeling portfolios, and fashion shoots.',
    cover_image_url:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=60',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'mock-album-3',
    name: 'Corporate & Products',
    description: 'Professional executive portraits and creative commercial product showcases.',
    cover_image_url:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=60',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString()
  }
]

const DEFAULT_IMAGES: AlbumImage[] = [
  // Wedding images
  {
    id: 'mock-img-1',
    album_id: 'mock-album-1',
    name: 'bride_portrait.jpg',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&auto=format&fit=crop&q=80',
    size_bytes: 2450000,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'mock-img-2',
    album_id: 'mock-album-1',
    name: 'wedding_rings.jpg',
    url: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=1200&auto=format&fit=crop&q=80',
    size_bytes: 1800000,
    created_at: new Date(Date.now() - 86400000 * 4.9).toISOString()
  },
  {
    id: 'mock-img-3',
    album_id: 'mock-album-1',
    name: 'reception_decor.jpg',
    url: 'https://images.unsplash.com/photo-1519225495810-7512c696505a?w=1200&auto=format&fit=crop&q=80',
    size_bytes: 3100000,
    created_at: new Date(Date.now() - 86400000 * 4.8).toISOString()
  },
  // Portrait images
  {
    id: 'mock-img-4',
    album_id: 'mock-album-2',
    name: 'studio_portrait_female.jpg',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80',
    size_bytes: 2200000,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'mock-img-5',
    album_id: 'mock-album-2',
    name: 'male_headshot.jpg',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&auto=format&fit=crop&q=80',
    size_bytes: 1950000,
    created_at: new Date(Date.now() - 86400000 * 2.9).toISOString()
  },
  // Corporate images
  {
    id: 'mock-img-6',
    album_id: 'mock-album-3',
    name: 'office_lifestyle.jpg',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
    size_bytes: 2900000,
    created_at: new Date(Date.now() - 86400000 * 1).toISOString()
  }
]

function getMockAlbums(): Album[] {
  const cached = localStorage.getItem(MOCK_ALBUMS_KEY)
  if (!cached) {
    localStorage.setItem(MOCK_ALBUMS_KEY, JSON.stringify(DEFAULT_ALBUMS))
    return DEFAULT_ALBUMS
  }
  return JSON.parse(cached)
}

function saveMockAlbums(albums: Album[]): void {
  localStorage.setItem(MOCK_ALBUMS_KEY, JSON.stringify(albums))
}

function getMockImages(): AlbumImage[] {
  const cached = localStorage.getItem(MOCK_IMAGES_KEY)
  if (!cached) {
    localStorage.setItem(MOCK_IMAGES_KEY, JSON.stringify(DEFAULT_IMAGES))
    return DEFAULT_IMAGES
  }
  return JSON.parse(cached)
}

function saveMockImages(images: AlbumImage[]): void {
  localStorage.setItem(MOCK_IMAGES_KEY, JSON.stringify(images))
}

function getMockFeatured(): AlbumImage[] {
  const cached = localStorage.getItem(MOCK_FEATURED_KEY)
  if (!cached) {
    localStorage.setItem(MOCK_FEATURED_KEY, JSON.stringify(DEFAULT_FEATURED))
    return DEFAULT_FEATURED
  }
  return JSON.parse(cached)
}

function saveMockFeatured(featured: AlbumImage[]): void {
  localStorage.setItem(MOCK_FEATURED_KEY, JSON.stringify(featured))
}

// ----------------------------------------------------
// Cloudflare R2 Real Uploader
// ----------------------------------------------------
export interface PendingPhoto {
  id: string
  album_id: string
  file_name: string
  public_url: string
  storage_key: string
  thumbnail: string
  size_bytes: number
  is_featured: boolean
  created_at: string
}

let isSyncing = false

function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

function getExpectedCdnUrl(key: string): string {
  if (!key) return ''
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key
  }
  let publicUrl = ''
  if (window.api && typeof window.api.getEnv === 'function') {
    const env = window.api.getEnv()
    if (env && env.CLOUDFLARE_R2_PUBLIC_URL) {
      publicUrl = env.CLOUDFLARE_R2_PUBLIC_URL
    }
  }
  const cleanPublicUrl = publicUrl.replace(/\/$/, '')
  const cleanKey = key.replace(/^\//, '')
  return `${cleanPublicUrl}/${cleanKey}`
}

function getThumbnailKeyFromStorageKey(storageKey: string): string {
  const parts = storageKey.split('/')
  if (parts.length >= 3 && parts[1] === 'images') {
    const newParts = [...parts]
    newParts[1] = 'thumbnails'
    newParts[2] = 'thumb_' + newParts[2]
    return newParts.join('/')
  }
  return storageKey
}

// -------------------------------------------------------
// Logging helpers (write to terminal + persistent log file)
// -------------------------------------------------------
function writeLog(level: 'info' | 'error' | 'warn', message: string, data?: unknown): void {
  if (window.api && typeof window.api.writeLog === 'function') {
    window.api.writeLog(level, message, data)
  } else {
    if (level === 'error') console.error(`[Supabase Sync Error] ${message}`, data || '')
    else console.log(`[Supabase Sync] ${message}`, data || '')
  }
}

// Sentinel error class for errors that should NOT be retried (remove from queue)
class NonRetryableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NonRetryableError'
  }
}

// PostgreSQL / Supabase error codes that can never succeed on retry
const NON_RETRYABLE_PG_CODES = new Set([
  '23503', // foreign_key_violation  ← our current problem
  '23505', // unique_violation
  '23514', // check_violation
  '42703', // undefined_column
  '42P01' // undefined_table
])

function isNonRetryable(err: unknown): boolean {
  if (err instanceof NonRetryableError) return true
  const code = (err as any)?.code || (err as any)?.cause?.code || ''
  if (NON_RETRYABLE_PG_CODES.has(String(code))) return true
  // IPC wraps the message as a string — detect FK violation text
  const msg: string = (err as any)?.message || ''
  if (msg.includes('foreign key constraint') || msg.includes('violates foreign key')) return true
  return false
}

// -------------------------------------------------------
// Ensure the album row exists in Supabase before inserting photos.
// If the album is missing (e.g. created offline), recreate it from
// localStorage mock data and Supabase using the service key.
// -------------------------------------------------------
async function ensureAlbumExists(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  albumId: string
): Promise<void> {
  // 1. Check if album already exists
  const { data: existing, error: checkErr } = await supabase
    .from('albums')
    .select('id')
    .eq('id', albumId)
    .maybeSingle()

  if (!checkErr && existing) {
    return // Album found — nothing to do
  }

  writeLog(
    'warn',
    `Album ${albumId} not found in Supabase. Attempting to recover from localStorage...`
  )

  // 2. Try to find album details in localStorage
  const mockAlbums: Album[] = JSON.parse(localStorage.getItem(MOCK_ALBUMS_KEY) || '[]')
  const localAlbum = mockAlbums.find((a) => a.id === albumId)

  const albumPayload = {
    id: albumId, // preserve the same UUID so photos FK will match
    name: localAlbum?.name || `Recovered Album (${albumId.slice(0, 8)})`,
    code: localAlbum?.code || generateRandomCode(),
    expiry_date: localAlbum?.expiry_date || null
  }

  // 3. Try inserting via main-process secret key (bypasses RLS INSERT restriction)
  if (window.api && typeof window.api.supabaseInsertPhoto === 'function') {
    try {
      // Reuse the same IPC route but for albums table
      await window.electron.ipcRenderer.invoke('supabase-insert-album', albumPayload)
      writeLog('info', `Album ${albumId} re-created in Supabase via secret key.`)
      return
    } catch (ipcErr: any) {
      writeLog(
        'warn',
        `Secret-key album re-create via IPC failed: ${ipcErr?.message}. Trying anon key...`
      )
    }
  }

  // 4. Fallback: try with anon key (may fail on RLS but worth trying)
  const { error: insertErr } = await supabase.from('albums').insert([albumPayload])
  if (insertErr) {
    writeLog('error', `Could not re-create album ${albumId} in Supabase.`, {
      message: insertErr.message,
      code: insertErr.code
    })
    throw new NonRetryableError(
      `Album ${albumId} does not exist in Supabase and could not be re-created. ` +
        `Photo cannot be inserted (FK constraint). Removing from queue.`
    )
  }

  writeLog('info', `Album ${albumId} re-created in Supabase via anon key.`)
}

// -------------------------------------------------------
// Core helper: insert one photo row into Supabase
// Tries renderer anon key first, then main-process secret key fallback
// -------------------------------------------------------
async function insertPhotoToSupabase(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  payload: {
    album_id: string
    file_name: string
    public_url: string
    storage_key: string
    thumbnail: string
    cdn: string
    is_featured: boolean
    created_at: string
  }
): Promise<Record<string, unknown>> {
  // --- Attempt 1: renderer-side anon key ---
  try {
    const { data, error } = await supabase.from('photos').insert([payload]).select().single()

    if (error) {
      logError('insertPhotoToSupabase (anon key)', error)
      // Detect non-retryable DB errors immediately
      if (NON_RETRYABLE_PG_CODES.has(String((error as any).code))) {
        throw new NonRetryableError(
          `DB error ${(error as any).code} for ${payload.file_name}: ${(error as any).message}`
        )
      }
      writeLog(
        'warn',
        `Anon key insert failed for ${payload.file_name}, trying secret key fallback`,
        {
          code: (error as any).code,
          message: (error as any).message,
          hint: (error as any).hint
        }
      )
      throw error // fall through to attempt 2
    }

    writeLog('info', `Renderer anon-key insert succeeded for ${payload.file_name}`, {
      id: data?.id
    })
    return data as Record<string, unknown>
  } catch (_anonErr) {
    // Re-throw non-retryable errors immediately — don't attempt fallback
    if (_anonErr instanceof NonRetryableError) throw _anonErr

    // --- Attempt 2: main-process secret key via IPC ---
    if (window.api && typeof window.api.supabaseInsertPhoto === 'function') {
      try {
        writeLog('info', `Attempting main-process secret-key insert for ${payload.file_name}`)
        const result = await window.api.supabaseInsertPhoto(payload)
        writeLog('info', `Main-process secret-key insert succeeded for ${payload.file_name}`, {
          id: result?.id
        })
        return result
      } catch (secretErr: any) {
        const errMsg: string = secretErr?.message || ''
        // FK violation from IPC = non-retryable
        if (errMsg.includes('foreign key constraint') || errMsg.includes('violates foreign key')) {
          throw new NonRetryableError(
            `FK constraint violation for ${payload.file_name} (album_id: ${payload.album_id}). ` +
              `Parent album missing in Supabase.`
          )
        }
        writeLog('error', `Main-process secret-key insert also failed for ${payload.file_name}`, {
          message: errMsg,
          payload
        })
        throw new Error(
          `Both anon and secret key inserts failed for ${payload.file_name}: ${errMsg}`
        )
      }
    } else {
      // No fallback available
      writeLog(
        'error',
        `No secret-key fallback available. Supabase insert failed for ${payload.file_name}`,
        { payload }
      )
      throw new Error(
        `Supabase insert failed for ${payload.file_name} and no secret key fallback available`
      )
    }
  }
}

export async function syncPendingPhotos(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) {
    writeLog('warn', 'syncPendingPhotos: Supabase not configured, skipping.')
    return
  }
  if (isSyncing) {
    writeLog('info', 'syncPendingPhotos: Already syncing, skipping duplicate call.')
    return
  }
  isSyncing = true

  try {
    const pending: PendingPhoto[] = JSON.parse(
      localStorage.getItem('rn_pending_supabase_photos') || '[]'
    )

    // Write current pending status to file for debugging
    if (window.api && typeof window.api.writePendingStatus === 'function') {
      window.api.writePendingStatus(pending)
    }

    if (pending.length === 0) {
      writeLog('info', 'syncPendingPhotos: No pending photos to sync.')
      return
    }

    writeLog('info', `syncPendingPhotos: Starting sync of ${pending.length} pending photo(s).`)

    for (const item of [...pending]) {
      if (!isValidUuid(item.album_id)) {
        writeLog('warn', `Skipping item — album_id "${item.album_id}" is not a valid UUID.`, {
          file_name: item.file_name
        })
        // Remove invalid item so we don't retry forever
        const current: PendingPhoto[] = JSON.parse(
          localStorage.getItem('rn_pending_supabase_photos') || '[]'
        )
        localStorage.setItem(
          'rn_pending_supabase_photos',
          JSON.stringify(current.filter((p) => p.id !== item.id))
        )
        continue
      }

      const payload = {
        album_id: item.album_id,
        file_name: item.file_name,
        public_url:
          item.public_url.startsWith('http://') || item.public_url.startsWith('https://')
            ? item.public_url
            : getExpectedCdnUrl(item.storage_key),
        storage_key: item.storage_key,
        thumbnail:
          item.thumbnail &&
          (item.thumbnail.startsWith('http://') || item.thumbnail.startsWith('https://'))
            ? item.thumbnail
            : getExpectedCdnUrl(getThumbnailKeyFromStorageKey(item.storage_key)),
        cdn:
          item.public_url.startsWith('http://') || item.public_url.startsWith('https://')
            ? item.public_url
            : getExpectedCdnUrl(item.storage_key),
        is_featured: item.is_featured,
        created_at: item.created_at
      }

      try {
        // Pre-check: ensure parent album exists before inserting photo (prevents FK violation)
        await ensureAlbumExists(supabase, item.album_id)
        const insertedRow = await insertPhotoToSupabase(supabase, payload)

        // Auto-set cover image removed: is_featured is always false on insert.
        // Use the explicit setFeaturedImage() to mark a photo as featured.

        // Remove from pending list only after confirmed success
        const updated: PendingPhoto[] = JSON.parse(
          localStorage.getItem('rn_pending_supabase_photos') || '[]'
        )
        const filtered = updated.filter((p) => p.id !== item.id)
        localStorage.setItem('rn_pending_supabase_photos', JSON.stringify(filtered))

        writeLog('info', `Sync queue: Successfully synced ${item.file_name} to Supabase.`, {
          id: insertedRow?.id
        })
      } catch (err: any) {
        if (isNonRetryable(err)) {
          // This item can never succeed — remove from queue and log
          writeLog(
            'error',
            `NON-RETRYABLE: Removing "${item.file_name}" from sync queue permanently. Reason: ${err?.message}`,
            { album_id: item.album_id, file_name: item.file_name, public_url: item.public_url }
          )
          const current: PendingPhoto[] = JSON.parse(
            localStorage.getItem('rn_pending_supabase_photos') || '[]'
          )
          localStorage.setItem(
            'rn_pending_supabase_photos',
            JSON.stringify(current.filter((p) => p.id !== item.id))
          )
        } else {
          writeLog(
            'error',
            `Sync queue: Failed to sync ${item.file_name}. Will retry next cycle.`,
            {
              message: err?.message
            }
          )
        }
        // Don't break — try the rest of the pending items
      }
    }
  } finally {
    isSyncing = false
  }
}

// Start a periodic sync loop (call once on app startup / login)
let _periodicSyncInterval: ReturnType<typeof setInterval> | null = null
export function startPeriodicSync(): void {
  if (_periodicSyncInterval) return // already running
  _periodicSyncInterval = setInterval(() => {
    const pending: PendingPhoto[] = JSON.parse(
      localStorage.getItem('rn_pending_supabase_photos') || '[]'
    )
    if (pending.length > 0) {
      writeLog('info', `Periodic sync: ${pending.length} pending photo(s) found, starting sync...`)
      syncPendingPhotos().catch((err) => {
        writeLog('error', 'Periodic sync threw an unhandled error.', { message: err?.message })
      })
    }
  }, 30_000) // every 30 seconds
  writeLog('info', 'Periodic Supabase sync started (interval: 30s).')
}

export function stopPeriodicSync(): void {
  if (_periodicSyncInterval) {
    clearInterval(_periodicSyncInterval)
    _periodicSyncInterval = null
    writeLog('info', 'Periodic Supabase sync stopped.')
  }
}

export async function realR2Upload(
  key: string,
  fileBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  console.log(`[R2 Upload] Starting real upload to Cloudflare R2 bucket`)
  console.log(`[R2 Upload] Key: ${key}`)
  console.log(`[R2 Upload] File Size: ${fileBlob.size} bytes`)

  if (onProgress) onProgress(10)

  if (window.api && typeof window.api.uploadToR2 === 'function') {
    const arrayBuffer = await fileBlob.arrayBuffer()
    const maxAttempts = 3
    let lastError: any = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          console.warn(
            `[R2 Upload] Retrying upload for ${key} (Attempt ${attempt}/${maxAttempts})...`
          )
          // Delay of 1.5 seconds before retry
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
        if (onProgress) onProgress(40 + (attempt - 1) * 10)
        const fileUrl = await window.api.uploadToR2(key, arrayBuffer, fileBlob.type || 'image/jpeg')
        if (onProgress) onProgress(100)
        console.log(`[R2 Upload] Completed! Public URL: ${fileUrl}`)
        return fileUrl
      } catch (err) {
        lastError = err
        console.error(`[R2 Upload] Attempt ${attempt} failed:`, err)
      }
    }
    throw lastError || new Error(`Failed to upload to Cloudflare R2 after ${maxAttempts} attempts`)
  } else {
    throw new Error('window.api.uploadToR2 is not available')
  }
}

export async function realR2Delete(key: string): Promise<boolean> {
  console.log(`[R2 Delete] Deleting key: ${key}`)
  if (window.api && typeof window.api.deleteFromR2 === 'function') {
    return await window.api.deleteFromR2(key)
  } else {
    console.warn('[R2 Delete] window.api.deleteFromR2 is not available')
    return false
  }
}

export function generateRandomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// ----------------------------------------------------
// DB Service Interface Implementation
// ----------------------------------------------------
export const dbService = {
  // Check if Supabase client is connected / active
  isSupabaseConfigured(): boolean {
    return getSupabase() !== null
  },

  // Storage Operations — fetch real bucket usage from Cloudflare R2 REST API
  // Falls back to summing size_bytes from Supabase, then to mock data.
  async getTotalStorageUsed(): Promise<number> {
    // Primary: native Cloudflare R2 REST API via main-process IPC
    if (window.api && typeof window.api.getR2BucketUsage === 'function') {
      const result = await window.api.getR2BucketUsage()
      if (result.configured === false) {
        // Token not set — silently fall through to Supabase sum
      } else if (result.error) {
        console.warn(
          '[Storage] R2 REST API returned an error, falling back to Supabase sum:',
          result.error
        )
      } else {
        console.log(`[Storage] R2 REST API payloadSize: ${result.payloadSize} bytes`)
        return result.payloadSize
      }
    }

    // Fallback 1: sum size_bytes from Supabase photos table
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.from('photos').select('size_bytes')

      if (error) {
        console.error('[getTotalStorageUsed] Supabase error:', error)
        return 0
      }
      return (data || []).reduce(
        (acc: number, row: { size_bytes: number | null }) => acc + (row.size_bytes || 0),
        0
      )
    }

    // Fallback 2: mock data
    const imgs = getMockImages()
    return imgs.reduce((acc, img) => acc + (img.size_bytes || 0), 0)
  },

  // Auth Operations
  async signIn(email: string, password: string): Promise<UserSession> {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.user) throw new Error('Sign in returned empty user')
      return {
        email: data.user.email || email,
        id: data.user.id
      }
    } else {
      return this.signInMock(email, password)
    }
  },

  signInMock(email: string, password: string): UserSession {
    if (!email.includes('@') || password.length < 6) {
      throw new Error('Invalid email or password (min 6 characters).')
    }
    const sessionUser = { email, id: 'mock-user-uuid' }
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(sessionUser))
    return sessionUser
  },

  async signUp(email: string, password: string): Promise<UserSession> {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      if (!data.user) throw new Error('Sign up returned empty user')
      return {
        email: data.user.email || email,
        id: data.user.id
      }
    } else {
      return this.signUpMock(email, password)
    }
  },

  signUpMock(email: string, password: string): UserSession {
    if (!email.includes('@') || password.length < 6) {
      throw new Error('Invalid email format or password too short (min 6 chars).')
    }
    const sessionUser = { email, id: 'mock-user-uuid' }
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(sessionUser))
    return sessionUser
  },

  async signOut(): Promise<void> {
    const supabase = getSupabase()
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      localStorage.removeItem(MOCK_USER_KEY)
    } else {
      localStorage.removeItem(MOCK_USER_KEY)
    }
  },

  async getCurrentUser(): Promise<UserSession | null> {
    const supabase = getSupabase()
    if (supabase) {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession()
      if (error || !session || !session.user) return null

      // Trigger background sync
      setTimeout(() => {
        syncPendingPhotos().catch(console.error)
      }, 1000)

      return {
        email: session.user.email || '',
        id: session.user.id
      }
    } else {
      const cached = localStorage.getItem(MOCK_USER_KEY)
      return cached ? JSON.parse(cached) : null
    }
  },

  onAuthStateChange(callback: (user: UserSession | null) => void): () => void {
    const supabase = getSupabase()
    if (supabase) {
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          // Trigger background sync
          setTimeout(() => {
            syncPendingPhotos().catch(console.error)
          }, 1000)

          callback({
            email: session.user.email || '',
            id: session.user.id
          })
        } else {
          callback(null)
        }
      })
      return () => {
        subscription.unsubscribe()
      }
    } else {
      // Simple mock interval to check session changes (e.g. logouts in other places)
      let prevUser = localStorage.getItem(MOCK_USER_KEY)
      const interval = setInterval(() => {
        const currentUser = localStorage.getItem(MOCK_USER_KEY)
        if (currentUser !== prevUser) {
          prevUser = currentUser
          callback(currentUser ? JSON.parse(currentUser) : null)
        }
      }, 1000)
      return () => clearInterval(interval)
    }
  },

  async seedSupabaseDatabase(): Promise<void> {
    const supabase = getSupabase()
    if (!supabase) return

    console.log('[Database Seeder] Supabase tables are empty. Seeding default albums and photos...')

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const generatedAlbums: Array<{ mockId: string; dbId: string; code: string }> = []

    for (const defAlb of DEFAULT_ALBUMS) {
      let code = ''
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      const d = new Date()
      d.setDate(d.getDate() + 15)
      const expiryDate = d.toISOString()

      const { data: newAlb, error: albErr } = await supabase
        .from('albums')
        .insert([
          {
            name: defAlb.name,
            description: defAlb.description,
            code: code,
            expiry_date: expiryDate
          }
        ])
        .select()
        .single()

      if (albErr) {
        console.error('[Database Seeder] Error seeding album:', albErr)
        continue
      }

      if (newAlb) {
        generatedAlbums.push({
          mockId: defAlb.id,
          dbId: newAlb.id,
          code: code
        })
      }
    }

    const photosToInsert: Array<{
      album_id: string
      file_name: string
      public_url: string
      storage_key: string
      thumbnail: string
      cdn: string
      is_featured: boolean
      created_at: string
    }> = []
    const getDbId = (mockId: string): string | null => {
      const found = generatedAlbums.find((x) => x.mockId === mockId)
      return found ? found.dbId : null
    }

    for (const defImg of DEFAULT_IMAGES) {
      const dbAlbumId = getDbId(defImg.album_id)
      if (!dbAlbumId) continue

      photosToInsert.push({
        album_id: dbAlbumId,
        file_name: defImg.name,
        public_url: defImg.url,
        storage_key: `${dbAlbumId}/images/${Date.now()}_${defImg.name}`,
        thumbnail: defImg.url.replace('w=1200', 'w=300'),
        cdn: defImg.url,
        is_featured: defImg.is_featured || false,
        created_at: defImg.created_at
      })
    }

    if (photosToInsert.length > 0) {
      const { error: photosErr } = await supabase.from('photos').insert(photosToInsert)

      if (photosErr) {
        console.error('[Database Seeder] Error seeding photos:', photosErr)
      } else {
        console.log('[Database Seeder] Successfully seeded photos!')
      }
    }
  },

  // Album Operations
  async fetchAlbums(): Promise<Album[]> {
    const supabase = getSupabase()
    if (supabase) {
      let albumsData: Array<{
        id: string
        name: string
        created_at: string
        expiry_date: string | null
        code: string | null
      }> | null = null
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      albumsData = data

      if (!albumsData || albumsData.length === 0) {
        await this.seedSupabaseDatabase()
        const { data: reFetched, error: reFetchErr } = await supabase
          .from('albums')
          .select('*')
          .order('created_at', { ascending: false })
        if (reFetchErr) throw reFetchErr
        albumsData = reFetched || []
      }

      if (!albumsData || albumsData.length === 0) return []

      const albumIds = albumsData.map((a) => a.id)
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('album_id, public_url, thumbnail, is_featured')
        .in('album_id', albumIds)

      if (photosError) {
        console.error('Error fetching photos for cover images:', photosError)
      }

      const coverMap = new Map<string, string>()
      if (photosData) {
        const photosByAlbum = new Map<string, typeof photosData>()
        for (const photo of photosData) {
          if (!photosByAlbum.has(photo.album_id)) {
            photosByAlbum.set(photo.album_id, [])
          }
          photosByAlbum.get(photo.album_id)!.push(photo)
        }

        for (const [albId, albumPhotos] of photosByAlbum.entries()) {
          const featured = albumPhotos.find((p) => p.is_featured)
          if (featured) {
            // Prefer thumbnail for the cover; fall back to full-size public_url
            coverMap.set(albId, featured.thumbnail || featured.public_url)
          } else if (albumPhotos.length > 0) {
            coverMap.set(albId, albumPhotos[0].thumbnail || albumPhotos[0].public_url)
          }
        }
      }

      return albumsData.map((row) => ({
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        expiry_date: row.expiry_date,
        code: row.code,
        description: row.code ? `Code: ${row.code}` : '',
        cover_image_url: coverMap.get(row.id) || ''
      }))
    } else {
      return getMockAlbums()
    }
  },

  async createAlbum(
    name: string,
    description?: string,
    code?: string,
    expiryDate?: string | null
  ): Promise<Album> {
    const generatedCode = code || generateRandomCode()
    const supabase = getSupabase()
    if (supabase) {
      // Omit description and cover_image_url as they are not in the Supabase schema
      const { data, error } = await supabase
        .from('albums')
        .insert([
          {
            name,
            code: generatedCode,
            expiry_date: expiryDate || null
          }
        ])
        .select()
        .single()
      if (error) throw error

      return {
        id: data.id,
        name: data.name,
        created_at: data.created_at,
        expiry_date: data.expiry_date,
        code: data.code,
        description: data.code ? `Code: ${data.code}` : '',
        cover_image_url: ''
      }
    } else {
      return this.createAlbumMock(name, description, generatedCode, expiryDate)
    }
  },

  createAlbumMock(
    name: string,
    description?: string,
    code?: string,
    expiryDate?: string | null
  ): Album {
    const newAlbum: Album = {
      id: `mock-album-${Date.now()}`,
      name,
      description: description || '',
      code: code || generateRandomCode(),
      cover_image_url: '',
      created_at: new Date().toISOString(),
      expiry_date: expiryDate || null
    }
    const albums = getMockAlbums()
    const updated = [newAlbum, ...albums]
    saveMockAlbums(updated)
    return newAlbum
  },

  async deleteAlbum(id: string): Promise<void> {
    // Always purge any pending (unsynced) photos for this album from localStorage first.
    // This prevents FK errors on the next sync cycle and keeps the queue clean.
    try {
      const pending: PendingPhoto[] = JSON.parse(
        localStorage.getItem('rn_pending_supabase_photos') || '[]'
      )
      const remaining = pending.filter((p) => p.album_id !== id)
      if (remaining.length !== pending.length) {
        localStorage.setItem('rn_pending_supabase_photos', JSON.stringify(remaining))
        writeLog(
          'info',
          `deleteAlbum: Removed ${pending.length - remaining.length} pending photo(s) from localStorage queue for album ${id}.`
        )
      }
    } catch (err) {
      console.error('[deleteAlbum] Failed to clean pending queue for album:', id, err)
    }

    const supabase = getSupabase()
    if (supabase) {
      const { error } = await supabase.from('albums').delete().eq('id', id)
      if (error) throw error
    } else {
      this.deleteAlbumMock(id)
    }
  },

  deleteAlbumMock(id: string): void {
    const albums = getMockAlbums().filter((a) => a.id !== id)
    saveMockAlbums(albums)
    const images = getMockImages().filter((i) => i.album_id !== id)
    saveMockImages(images)
  },

  async fetchImages(albumId: string, limit?: number, offset?: number): Promise<AlbumImage[]> {
    const supabase = getSupabase()
    if (supabase && isValidUuid(albumId)) {
      let query = supabase
        .from('photos')
        .select('*')
        .eq('album_id', albumId)
        .order('created_at', { ascending: false })

      if (limit !== undefined) {
        const start = offset || 0
        const end = start + limit - 1
        query = query.range(start, end)
      }

      const { data, error } = await query
      if (error) throw error

      // Map DB rows directly — thumbnails come from the photos table's thumbnail column.
      // Do NOT merge pending localStorage entries here; localStorage is strictly a
      // retry queue for Supabase sync and must not be used for UI display.
      const images = (data || []).map((row) => ({
        id: row.id,
        album_id: row.album_id,
        url: row.public_url,
        thumbnail: row.thumbnail || row.public_url,
        name: row.file_name,
        size_bytes: row.size_bytes || 0,
        is_featured: row.is_featured || false,
        created_at: row.created_at
      }))

      return images
    } else {
      let imgs = getMockImages().filter((img) => img.album_id === albumId)
      if (limit !== undefined) {
        const start = offset || 0
        imgs = imgs.slice(start, start + limit)
      }
      return imgs
    }
  },

  async uploadImage(
    albumId: string,
    file: File,
    onProgress?: (progress: number) => void,
    isFeatured: boolean = false
  ): Promise<AlbumImage> {
    // 1. Image Resizing (300x300 for thumbnail)
    let thumbnailBlob: Blob | null = null
    let r2ThumbnailUrl = ''
    let r2OriginalUrl = ''

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const timestamp = Date.now()
    const originalKey = `${albumId}/images/${timestamp}_${cleanFileName}`
    const thumbnailKey = `${albumId}/thumbnails/thumb_${timestamp}_${cleanFileName}`

    if (onProgress) onProgress(10)

    if (file.type.startsWith('image/')) {
      try {
        console.log(`[Image Resizer] Resizing "${file.name}" to 200x200 thumbnail...`)
        const config = {
          quality: 0.85,
          maxWidth: 200,
          maxHeight: 200,
          autoRotate: true,
          mimeType: 'image/jpeg'
        }
        thumbnailBlob = await readAndCompressImage(file, config)
        console.log(`[Image Resizer] Success! Resized size: ${thumbnailBlob.size} bytes.`)

        if (onProgress) onProgress(30)
        // Upload thumbnail to Cloudflare R2
        r2ThumbnailUrl = await realR2Upload(thumbnailKey, thumbnailBlob)
      } catch (err) {
        console.error('[Image Resizer] Resizing or R2 thumbnail upload failed:', err)
      }
    }

    if (onProgress) onProgress(50)

    // 2. Upload original image to Cloudflare R2
    r2OriginalUrl = await realR2Upload(originalKey, file)

    if (onProgress) onProgress(80)

    // 3. Create the pending photo record
    const tempId = `pending-img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newImage: PendingPhoto = {
      id: tempId,
      album_id: albumId,
      file_name: file.name,
      public_url: r2OriginalUrl,
      storage_key: originalKey,
      thumbnail: r2ThumbnailUrl || r2OriginalUrl,
      size_bytes: file.size,
      is_featured: isFeatured,
      created_at: new Date().toISOString()
    }

    const supabase = getSupabase()
    const isSupabase = supabase && isValidUuid(albumId)

    if (isSupabase) {
      // Step 3a: Save to localStorage queue FIRST so we never lose the record
      const pending: PendingPhoto[] = JSON.parse(
        localStorage.getItem('rn_pending_supabase_photos') || '[]'
      )
      // Avoid duplicates
      if (!pending.some((p) => p.id === newImage.id)) {
        pending.push(newImage)
        localStorage.setItem('rn_pending_supabase_photos', JSON.stringify(pending))
        writeLog('info', `Saved photo to local queue before Supabase sync: ${newImage.file_name}`, {
          id: newImage.id,
          album_id: newImage.album_id
        })
      }

      if (onProgress) onProgress(90)

      // Step 3b: Attempt immediate Supabase insert
      const payload = {
        album_id: newImage.album_id,
        file_name: newImage.file_name,
        public_url:
          newImage.public_url.startsWith('http://') || newImage.public_url.startsWith('https://')
            ? newImage.public_url
            : getExpectedCdnUrl(newImage.storage_key),
        storage_key: newImage.storage_key,
        thumbnail:
          newImage.thumbnail.startsWith('http://') || newImage.thumbnail.startsWith('https://')
            ? newImage.thumbnail
            : getExpectedCdnUrl(thumbnailKey),
        cdn:
          newImage.public_url.startsWith('http://') || newImage.public_url.startsWith('https://')
            ? newImage.public_url
            : getExpectedCdnUrl(newImage.storage_key),
        is_featured: newImage.is_featured,
        created_at: newImage.created_at
      }

      writeLog('info', `Attempting immediate Supabase insert for ${newImage.file_name}...`)

      let insertedRow: Record<string, unknown> | null = null
      let supabaseError: Error | null = null

      try {
        // Pre-check: ensure parent album exists before inserting photo (prevents FK violation)
        await ensureAlbumExists(supabase, albumId)
        insertedRow = await insertPhotoToSupabase(supabase, payload)
      } catch (err: any) {
        supabaseError = err
        if (isNonRetryable(err)) {
          // Non-retryable (e.g. FK violation, album missing) — remove from queue right away
          writeLog(
            'error',
            `NON-RETRYABLE upload error for ${newImage.file_name}: ${err?.message}. Removing from queue.`,
            { album_id: albumId }
          )
          const current: PendingPhoto[] = JSON.parse(
            localStorage.getItem('rn_pending_supabase_photos') || '[]'
          )
          localStorage.setItem(
            'rn_pending_supabase_photos',
            JSON.stringify(current.filter((p) => p.id !== newImage.id))
          )
        } else {
          writeLog(
            'error',
            `Immediate Supabase insert failed for ${newImage.file_name}. Photo stays in queue for retry.`,
            {
              message: err?.message
            }
          )
        }
      }

      if (insertedRow) {
        // Auto-set cover image removed: is_featured is always false on insert.
        // Use the explicit setFeaturedImage() to mark a photo as featured.

        // Remove from pending list since it's confirmed synced
        const updated: PendingPhoto[] = JSON.parse(
          localStorage.getItem('rn_pending_supabase_photos') || '[]'
        )
        const filtered = updated.filter((p) => p.id !== newImage.id)
        localStorage.setItem('rn_pending_supabase_photos', JSON.stringify(filtered))

        writeLog('info', `Upload fully complete (R2 + Supabase): ${newImage.file_name}`, {
          id: insertedRow.id
        })

        if (onProgress) onProgress(100)
        return {
          id: (insertedRow.id as string) || newImage.id,
          album_id: newImage.album_id,
          url: newImage.public_url,
          thumbnail: newImage.thumbnail,
          name: newImage.file_name,
          size_bytes: newImage.size_bytes,
          is_featured: (insertedRow.is_featured as boolean) ?? newImage.is_featured,
          created_at: (insertedRow.created_at as string) || newImage.created_at
        }
      } else {
        // Supabase failed — check if it's non-retryable or can be queued
        if (supabaseError && isNonRetryable(supabaseError)) {
          // Album missing / FK error — can never succeed, don't say "queued for retry"
          throw supabaseError
        }
        // Retryable failure — photo is in localStorage queue for periodic retry
        throw (
          supabaseError ||
          new Error(`Supabase insert failed for ${newImage.file_name}. Photo queued for retry.`)
        )
      }
    } else {
      // In Mock Mode, save to local mock storage
      const mockImages = getMockImages()
      const mappedToMock: AlbumImage = {
        id: newImage.id,
        album_id: newImage.album_id,
        url: newImage.public_url,
        thumbnail: newImage.thumbnail,
        name: newImage.file_name,
        size_bytes: newImage.size_bytes,
        is_featured: newImage.is_featured,
        created_at: newImage.created_at
      }
      saveMockImages([mappedToMock, ...mockImages])

      // In Mock Mode, update local cover image if album doesn't have one
      const albums = getMockAlbums()
      const albumIdx = albums.findIndex((a) => a.id === albumId)
      if (albumIdx !== -1 && !albums[albumIdx].cover_image_url) {
        albums[albumIdx].cover_image_url = newImage.thumbnail
        saveMockAlbums(albums)
      }
      if (onProgress) onProgress(100)
      return mappedToMock
    }
  },

  async uploadImageMock(
    albumId: string,
    file: File,
    _r2OriginalUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<AlbumImage> {
    // Deprecated in favor of the unified uploadImage implementation above.
    return this.uploadImage(albumId, file, onProgress)
  },

  async deleteImage(id: string, url: string): Promise<void> {
    const supabase = getSupabase()
    if (supabase) {
      // 1. Check if the image is in the local pending list (not yet synced to Supabase)
      const pending: PendingPhoto[] = JSON.parse(
        localStorage.getItem('rn_pending_supabase_photos') || '[]'
      )
      const foundPending = pending.find((p) => p.id === id)

      if (foundPending) {
        console.log(
          `[Delete Image] Deleting pending unsynced photo locally: ${foundPending.file_name}`
        )
        // Delete original from R2
        if (foundPending.storage_key) {
          try {
            await realR2Delete(foundPending.storage_key)
          } catch (e) {
            console.error('[Delete Image] Failed to delete original from R2:', e)
          }
        }
        // Delete thumbnail from R2
        if (foundPending.thumbnail) {
          let thumbKey = ''
          let publicUrl = ''
          if (window.api && typeof window.api.getEnv === 'function') {
            const env = window.api.getEnv()
            if (env.CLOUDFLARE_R2_PUBLIC_URL) publicUrl = env.CLOUDFLARE_R2_PUBLIC_URL
          }
          const cleanPublicUrl = publicUrl.replace(/\/$/, '') + '/'
          if (foundPending.thumbnail.startsWith(cleanPublicUrl)) {
            thumbKey = foundPending.thumbnail.substring(cleanPublicUrl.length)
          }
          if (thumbKey) {
            try {
              await realR2Delete(thumbKey)
            } catch (e) {
              console.error('[Delete Image] Failed to delete thumbnail from R2:', e)
            }
          }
        }

        // Remove from pending list in local storage
        const updated = pending.filter((p) => p.id !== id)
        localStorage.setItem('rn_pending_supabase_photos', JSON.stringify(updated))
        return
      }

      // 2. Otherwise, delete from Supabase
      try {
        // Fetch file information (storage_key and thumbnail path) before deleting the metadata row
        const { data: photoData, error: fetchError } = await supabase
          .from('photos')
          .select('storage_key, thumbnail')
          .eq('id', id)
          .single()

        if (!fetchError && photoData) {
          // Delete from Cloudflare R2 original key
          if (photoData.storage_key) {
            try {
              await realR2Delete(photoData.storage_key)
            } catch (err) {
              console.error('[R2 Delete] Failed to delete original file from R2:', err)
            }
          }

          // Delete from Cloudflare R2 thumbnail key
          if (photoData.thumbnail) {
            let thumbKey = ''
            let publicUrl = ''
            if (window.api && typeof window.api.getEnv === 'function') {
              const env = window.api.getEnv()
              if (env.CLOUDFLARE_R2_PUBLIC_URL) publicUrl = env.CLOUDFLARE_R2_PUBLIC_URL
            }
            const cleanPublicUrl = publicUrl.replace(/\/$/, '') + '/'
            if (photoData.thumbnail.startsWith(cleanPublicUrl)) {
              thumbKey = photoData.thumbnail.substring(cleanPublicUrl.length)
            }
            if (thumbKey) {
              try {
                await realR2Delete(thumbKey)
              } catch (err) {
                console.error('[R2 Delete] Failed to delete thumbnail file from R2:', err)
              }
            }
          }

          // Keep Supabase Storage backup delete just in case
          if (photoData.storage_key) {
            try {
              await supabase.storage.from('rn-studio-photos').remove([photoData.storage_key])
            } catch (err) {
              console.error('[Supabase Storage Delete] Failed:', err)
            }
          }
        }
      } catch (err) {
        console.error('Error pre-deleting storage files:', err)
      }

      // Delete database row
      const { error } = await supabase.from('photos').delete().eq('id', id)
      if (error) throw error
    } else {
      // 1. Remove from mock_images immediately so UI updates instantly
      this.deleteImageMock(id)

      // If we are in mock mode and couldn't find the photo in pending, we can try to extract and delete from R2 if url is provided
      if (url) {
        const cleanUrl = url
        let publicUrl = ''
        if (window.api && typeof window.api.getEnv === 'function') {
          const env = window.api.getEnv()
          if (env.CLOUDFLARE_R2_PUBLIC_URL) publicUrl = env.CLOUDFLARE_R2_PUBLIC_URL
        }
        const cleanPublicUrl = publicUrl.replace(/\/$/, '') + '/'
        if (cleanUrl.startsWith(cleanPublicUrl)) {
          const key = cleanUrl.substring(cleanPublicUrl.length)
          try {
            await realR2Delete(key)
          } catch (err) {
            console.error('[R2 Delete Mock] Failed:', err)
          }
        }
      }
    }
  },

  deleteImageMock(id: string): void {
    const images = getMockImages().filter((img) => img.id !== id)
    saveMockImages(images)
  },

  async setFeaturedImage(albumId: string, photoId: string, photoUrl: string): Promise<void> {
    const supabase = getSupabase()
    if (supabase) {
      // 1. Reset featured status of all other photos in the album
      const { error: resetError } = await supabase
        .from('photos')
        .update({ is_featured: false })
        .eq('album_id', albumId)
      if (resetError) throw resetError

      // 2. Set this photo as featured
      const { error: setPhotoError } = await supabase
        .from('photos')
        .update({ is_featured: true })
        .eq('id', photoId)
      if (setPhotoError) throw setPhotoError
    } else {
      this.setFeaturedImageMock(albumId, photoId, photoUrl)
    }
  },

  setFeaturedImageMock(albumId: string, photoId: string, photoUrl: string): void {
    const images = getMockImages().map((img) => {
      if (img.album_id === albumId) {
        return { ...img, is_featured: img.id === photoId }
      }
      return img
    })
    saveMockImages(images)

    const albums = getMockAlbums().map((alb) => {
      if (alb.id === albumId) {
        return { ...alb, cover_image_url: photoUrl }
      }
      return alb
    })
    saveMockAlbums(albums)
  },

  async setFeaturedImages(albumId: string, photoIds: string[]): Promise<void> {
    const supabase = getSupabase()
    if (supabase) {
      // 1. Reset all photos in this album to not featured
      const { error: resetError } = await supabase
        .from('photos')
        .update({ is_featured: false })
        .eq('album_id', albumId)
      if (resetError) throw resetError

      // 2. Set the selected photos to featured
      if (photoIds.length > 0) {
        const { error: setError } = await supabase
          .from('photos')
          .update({ is_featured: true })
          .in('id', photoIds)
        if (setError) throw setError
      }
    } else {
      this.setFeaturedImagesMock(albumId, photoIds)
    }
  },

  setFeaturedImagesMock(albumId: string, photoIds: string[]): void {
    const images = getMockImages().map((img) => {
      if (img.album_id === albumId) {
        return { ...img, is_featured: photoIds.includes(img.id) }
      }
      return img
    })
    saveMockImages(images)
  },

  async fetchGlobalFeaturedImages(): Promise<AlbumImage[]> {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase
        .from('featured_photos')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error

      return (data || []).map((row) => ({
        id: row.id,
        album_id: '',
        url: row.public_url,
        thumbnail: row.public_url, // No thumbnail column, use public_url
        name: row.file_name,
        size_bytes: 0, // No size_bytes column
        created_at: row.created_at
      }))
    } else {
      return getMockFeatured()
    }
  },

  async uploadFeaturedImage(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<AlbumImage> {
    let r2OriginalUrl = ''

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const timestamp = Date.now()
    const originalKey = `featured/images/${timestamp}_${cleanFileName}`

    if (onProgress) onProgress(10)

    if (onProgress) onProgress(30)
    r2OriginalUrl = await realR2Upload(originalKey, file)

    if (onProgress) onProgress(80)

    const tempId = `pending-feat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newFeatured: AlbumImage = {
      id: tempId,
      album_id: '',
      url: r2OriginalUrl,
      thumbnail: r2OriginalUrl, // No thumbnail, use original url
      name: file.name,
      size_bytes: file.size,
      created_at: new Date().toISOString()
    }

    const supabase = getSupabase()
    if (supabase) {
      if (onProgress) onProgress(90)
      const { data, error } = await supabase
        .from('featured_photos')
        .insert([
          {
            file_name: newFeatured.name,
            public_url:
              newFeatured.url.startsWith('http://') || newFeatured.url.startsWith('https://')
                ? newFeatured.url
                : getExpectedCdnUrl(originalKey),
            storage_key: originalKey
          }
        ])
        .select()
        .single()

      if (error) throw error
      if (onProgress) onProgress(100)

      return {
        id: data.id,
        album_id: '',
        url: data.public_url,
        thumbnail: data.public_url, // No thumbnail column, use public_url
        name: data.file_name,
        size_bytes: 0, // No size_bytes column
        created_at: data.created_at
      }
    } else {
      // Save to local mock store
      const mockFeatured = getMockFeatured()
      saveMockFeatured([newFeatured, ...mockFeatured])
      if (onProgress) onProgress(100)
      return newFeatured
    }
  },

  async deleteGlobalFeaturedImage(id: string): Promise<void> {
    const supabase = getSupabase()
    let storageKeyToDelete: string | null = null

    if (supabase) {
      // 1. Delete from Supabase and retrieve the storage key
      const { data, error } = await supabase
        .from('featured_photos')
        .delete()
        .eq('id', id)
        .select('storage_key')
        .single()

      if (error) {
        console.error('[deleteGlobalFeaturedImage] Supabase delete failed:', error)
      } else if (data && data.storage_key) {
        storageKeyToDelete = data.storage_key
      }
    } else {
      // Mock fallback: try to extract from mock storage url
      const found = getMockFeatured().find((img) => img.id === id)
      if (found && found.url) {
        const match = found.url.match(/featured\/images\/[^?]+/)
        if (match) {
          storageKeyToDelete = match[0]
        }
      }
      // Update local mock cache
      const mockFeatured = getMockFeatured().filter((img) => img.id !== id)
      saveMockFeatured(mockFeatured)
    }

    // 2. Delete from Cloudflare R2
    if (storageKeyToDelete) {
      try {
        await realR2Delete(storageKeyToDelete)
        console.log(
          `[deleteGlobalFeaturedImage] Successfully deleted from Cloudflare R2: ${storageKeyToDelete}`
        )
      } catch (err) {
        console.error('[deleteGlobalFeaturedImage] Failed to delete from R2:', err)
      }
    }
  }
}
