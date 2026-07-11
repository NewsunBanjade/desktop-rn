import React, { useState, useEffect } from 'react'
import { LogOut, CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { dbService, Album, AlbumImage, UserSession, startPeriodicSync, stopPeriodicSync } from './dbService'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AlbumDetail from './components/AlbumDetail'
import CreateAlbumModal from './components/CreateAlbumModal'
import Lightbox from './components/Lightbox'
import Versions from './components/Versions'
import StorageWidget from './components/StorageWidget'
import { StorageProvider, useStorage } from './StorageContext'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error'
}

interface GlobalUploadItem {
  id: string
  name: string
  progress: number
  size: number
  status: 'uploading' | 'completed' | 'queued' | 'error'
  error?: string
}

const formatSize = (bytes?: number): string => {
  if (!bytes) return '0 KB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function AppInner(): React.JSX.Element {
  const [user, setUser] = useState<UserSession | null>(null)
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null)

  // Modals & triggers
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState<AlbumImage[] | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Global upload widget state
  const [globalUploads, setGlobalUploads] = useState<GlobalUploadItem[]>([])
  const [isUploadWidgetMinimized, setIsUploadWidgetMinimized] = useState(false)
  const [isUploadWidgetVisible, setIsUploadWidgetVisible] = useState(false)

  // Sync auth state on mount
  useEffect(() => {
    dbService
      .getCurrentUser()
      .then((sessionUser) => {
        setUser(sessionUser)
        if (sessionUser) {
          startPeriodicSync()
        }
      })
      .catch((err) => {
        console.error('Error fetching user session:', err)
      })

    const unsubscribe = dbService.onAuthStateChange((sessionUser) => {
      setUser(sessionUser)
      if (sessionUser) {
        startPeriodicSync()
      } else {
        setCurrentAlbum(null)
        stopPeriodicSync()
      }
    })
    return (): void => {
      unsubscribe()
      stopPeriodicSync()
    }
  }, [])

  const addToast = (message: string, type: 'success' | 'error' = 'success'): void => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  const handleLogout = async (): Promise<void> => {
    try {
      await dbService.signOut()
      setUser(null)
      setCurrentAlbum(null)
      addToast('Sign out completed.', 'success')
    } catch (err) {
      const error = err as Error
      addToast(error.message || 'Logout failed.', 'error')
    }
  }

  const { isStorageFull, refresh: refreshStorage } = useStorage()

  const handleCreateAlbum = async (
    name: string,
    description: string,
    code: string,
    expiryDate: string | null
  ): Promise<void> => {
    if (isStorageFull) {
      addToast('Storage limit reached (40 GB). Delete some photos to free space.', 'error')
      return
    }
    try {
      const newAlbum = await dbService.createAlbum(name, description, code, expiryDate)
      addToast(`Album "${name}" created with code ${code}.`, 'success')
      setCurrentAlbum(newAlbum)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      const error = err as Error
      console.error(error)
      addToast(error.message || 'Failed to create album.', 'error')
    }
  }

  const handleUploadFiles = (files: File[], isFeatured: boolean = false): void => {
    if (isStorageFull) {
      addToast('Storage limit reached (40 GB). Delete some photos to free space.', 'error')
      return
    }
    if (!currentAlbum) return
    setIsUploadWidgetVisible(true)
    setIsUploadWidgetMinimized(false)

    const albumId = currentAlbum.id

    files.forEach(async (file) => {
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const newUpload: GlobalUploadItem = {
        id: uploadId,
        name: file.name,
        progress: 0,
        size: file.size,
        status: 'uploading'
      }

      setGlobalUploads((prev) => [newUpload, ...prev])

      try {
        const uploadedImg = await dbService.uploadImage(
          albumId,
          file,
          (progress) => {
            setGlobalUploads((prev) =>
              prev.map((item) => (item.id === uploadId ? { ...item, progress } : item))
            )
          },
          isFeatured
        )

        // Both R2 and Supabase succeeded
        setGlobalUploads((prev) =>
          prev.map((item) =>
            item.id === uploadId ? { ...item, status: 'completed', progress: 100 } : item
          )
        )

        if (isFeatured && currentAlbum) {
          setCurrentAlbum((prev) => {
            if (!prev) return null
            return { ...prev, cover_image_url: uploadedImg.thumbnail || uploadedImg.url }
          })
        }

        setRefreshTrigger((prev) => prev + 1)
        refreshStorage()
        addToast(`"${file.name}" uploaded successfully.`, 'success')
      } catch (err) {
        const error = err as Error
        console.error('[Upload] Error:', error)

        // Distinguish: R2 failed vs Supabase failed (queued for retry)
        const isQueuedForRetry =
          error.message?.includes('queued for retry') ||
          error.message?.includes('Supabase insert failed')

        if (isQueuedForRetry) {
          // R2 succeeded, Supabase is pending — show as queued
          setGlobalUploads((prev) =>
            prev.map((item) =>
              item.id === uploadId
                ? {
                    ...item,
                    status: 'queued',
                    progress: 100,
                    error: 'Saved to R2. Supabase sync pending (auto-retry every 30s).'
                  }
                : item
            )
          )
          setRefreshTrigger((prev) => prev + 1)
          addToast(
            `"${file.name}" uploaded to R2. Supabase sync will retry automatically.`,
            'error'
          )
        } else {
          // Total failure
          setGlobalUploads((prev) =>
            prev.map((item) =>
              item.id === uploadId
                ? { ...item, status: 'error', error: error.message || 'Upload failed' }
                : item
            )
          )
          addToast(`Upload failed for ${file.name}`, 'error')
        }
      }
    })
  }

  // Render Login page if not authenticated
  if (!user) {
    return (
      <>
        <Login onLoginSuccess={(sessionUser): void => setUser(sessionUser)} addToast={addToast} />

        {/* Dynamic Toast Alerts */}
        <div className="toast-container">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              ) : (
                <AlertCircle size={16} style={{ color: 'var(--error)' }} />
              )}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="app-container">
      {/* Premium navigation bar */}
      <header className="navbar">
        <div className="nav-brand" onClick={(): void => setCurrentAlbum(null)}>
          <div className="nav-logo">RN</div>
          <div className="nav-title-group">
            <h1 className="nav-title">RN Studio</h1>
            <span className="nav-subtitle">Management Console</span>
          </div>
        </div>

        <div className="nav-actions">
          {/* Storage Widget */}
          <StorageWidget />

          {/* User profile identifier */}
          <div className="nav-user">
            <div className="nav-user-avatar">{user.email.substring(0, 2).toUpperCase()}</div>
            <span>{user.email}</span>
          </div>

          {/* Logout button */}
          <button onClick={handleLogout} className="icon-btn icon-btn-danger" title="Log Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main content grid */}
      <main className="main-content">
        {currentAlbum ? (
          <AlbumDetail
            album={currentAlbum}
            onBack={(): void => {
              setCurrentAlbum(null)
              setRefreshTrigger((prev) => prev + 1) // Refresh album images count on dashboard
            }}
            onOpenLightbox={(images, index): void => {
              setLightboxImages(images)
              setLightboxIndex(index)
            }}
            addToast={addToast}
            onUpload={handleUploadFiles}
            refreshTrigger={refreshTrigger}
            isStorageFull={isStorageFull}
          />
        ) : (
          <Dashboard
            onSelectAlbum={(album): void => setCurrentAlbum(album)}
            onOpenCreateModal={(): void => {
              if (isStorageFull) {
                addToast('Storage limit reached (40 GB). Delete some photos to free space.', 'error')
                return
              }
              setIsCreateAlbumOpen(true)
            }}
            addToast={addToast}
            refreshTrigger={refreshTrigger}
          />
        )}
      </main>

      {/* Footer system details */}
      <Versions />

      {/* Modals & Dialogs */}
      {isCreateAlbumOpen && (
        <CreateAlbumModal
          onClose={(): void => setIsCreateAlbumOpen(false)}
          onSave={handleCreateAlbum}
        />
      )}

      {lightboxImages && (
        <Lightbox
          images={lightboxImages}
          activeIndex={lightboxIndex}
          onChangeIndex={(index): void => setLightboxIndex(index)}
          onClose={(): void => setLightboxImages(null)}
        />
      )}

      {/* Dynamic Toast Alerts */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
            ) : (
              <AlertCircle size={16} style={{ color: 'var(--error)' }} />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Google Drive-Style Upload Widget */}
      {isUploadWidgetVisible && globalUploads.length > 0 && (
        <div
          className={`upload-widget ${isUploadWidgetMinimized ? 'upload-widget-minimized' : ''}`}
        >
          <div className="upload-widget-header">
            <h4 className="upload-widget-title">
              {globalUploads.filter((u) => u.status === 'uploading').length > 0 ? (
                <>
                  <span
                    className="upload-widget-circle-loader"
                    style={{ marginRight: '6px' }}
                  ></span>
                  Uploading {globalUploads.filter((u) => u.status === 'uploading').length}{' '}
                  {globalUploads.filter((u) => u.status === 'uploading').length === 1
                    ? 'item'
                    : 'items'}
                  ...
                </>
              ) : globalUploads.some((u) => u.status === 'queued') ? (
                <>
                  <Clock size={16} style={{ color: 'var(--warning, #f59e0b)', marginRight: '6px' }} />
                  {globalUploads.filter((u) => u.status === 'completed').length} complete,{' '}
                  {globalUploads.filter((u) => u.status === 'queued').length} syncing...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} style={{ color: 'var(--success)', marginRight: '6px' }} />
                  {globalUploads.filter((u) => u.status === 'completed').length} uploads complete
                </>
              )}
            </h4>
            <div className="upload-widget-actions">
              <button
                className="upload-widget-btn"
                onClick={(): void => setIsUploadWidgetMinimized(!isUploadWidgetMinimized)}
                title={isUploadWidgetMinimized ? 'Expand' : 'Minimize'}
              >
                {isUploadWidgetMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button
                className="upload-widget-btn"
                onClick={(): void => {
                  setIsUploadWidgetVisible(false)
                  setGlobalUploads([])
                }}
                title="Close Panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="upload-widget-body">
            {globalUploads.map((upload) => (
              <div key={upload.id} className="upload-widget-item">
                <div className="upload-widget-item-info">
                  <div className="upload-widget-item-name" title={upload.name}>
                    {upload.name}
                  </div>
                  <div className="upload-widget-item-meta">
                    {upload.status === 'uploading' && (
                      <span>
                        {Math.round(upload.progress)}% • {formatSize(upload.size)}
                      </span>
                    )}
                    {upload.status === 'completed' && (
                      <span style={{ color: 'var(--success)' }}>
                        Completed • {formatSize(upload.size)}
                      </span>
                    )}
                    {upload.status === 'queued' && (
                      <span style={{ color: 'var(--warning, #f59e0b)' }} title={upload.error}>
                        R2 ✓ — Supabase syncing...
                      </span>
                    )}
                    {upload.status === 'error' && (
                      <span style={{ color: 'var(--error)' }} title={upload.error}>
                        Failed
                      </span>
                    )}
                  </div>
                </div>
                <div className="upload-widget-item-status">
                  {upload.status === 'uploading' && (
                    <span className="upload-widget-circle-loader"></span>
                  )}
                  {upload.status === 'completed' && (
                    <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                  )}
                  {upload.status === 'queued' && (
                    <Clock size={16} style={{ color: 'var(--warning, #f59e0b)' }} />
                  )}
                  {upload.status === 'error' && (
                    <AlertCircle size={16} style={{ color: 'var(--error)' }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function App(): React.JSX.Element {
  return (
    <StorageProvider>
      <AppInner />
    </StorageProvider>
  )
}
