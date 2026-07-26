import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft,
  UploadCloud,
  Trash2,
  Maximize2,
  Copy,
  FileSpreadsheet,
  Image as ImageIcon,
  Calendar,
  Download,
  AlertTriangle
} from 'lucide-react'
import { dbService, Album, AlbumImage } from '../dbService'
import QRCode from 'qrcode'
import DeleteConfirmationModal from './DeleteConfirmationModal'

interface AlbumDetailProps {
  album: Album
  onBack: () => void
  onOpenLightbox: (images: AlbumImage[], index: number) => void
  addToast: (message: string, type: 'success' | 'error') => void
  onUpload: (
    files: File[],
    onSingleSuccess?: (img: AlbumImage) => void,
    isFeatured?: boolean
  ) => void
  refreshTrigger: number
  isStorageFull: boolean
}

export default function AlbumDetail({
  album,
  onBack,
  onOpenLightbox,
  addToast,
  onUpload,
  refreshTrigger,
  isStorageFull
}: AlbumDetailProps): React.JSX.Element {
  const [images, setImages] = useState<AlbumImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (album.code) {
      QRCode.toDataURL(album.id, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error('Failed to generate QR code:', err))
    }
  }, [album.code, album.id])

  const downloadQrCode = (): void => {
    if (!qrCodeUrl) return
    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `qr-${album.name.replace(/[^a-zA-Z0-9]/g, '_')}-${album.code}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    addToast('QR Code image downloaded!', 'success')
  }

  const loadImages = useCallback(
    async (isInitial = false): Promise<void> => {
      if (isInitial) {
        setIsLoading(true)
      } else {
        if (isLoadingMore) return
        setIsLoadingMore(true)
      }
      try {
        const currentLimit = isInitial ? 15 : 20
        const currentOffset = isInitial ? 0 : offset
        const fetchedImages = await dbService.fetchImages(album.id, currentLimit, currentOffset)

        if (isInitial) {
          setImages(fetchedImages)
          setOffset(fetchedImages.length)
          setHasMore(fetchedImages.length === currentLimit)
        } else {
          setImages((prev) => {
            const combined = [...prev]
            for (const img of fetchedImages) {
              if (!combined.some((x) => x.id === img.id)) {
                combined.push(img)
              }
            }
            return combined
          })
          setOffset((prev) => prev + fetchedImages.length)
          setHasMore(fetchedImages.length === currentLimit)
        }
      } catch (err) {
        const error = err as Error
        console.error(error)
        addToast(error.message || 'Failed to load album images.', 'error')
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [album.id, offset, isLoadingMore, addToast]
  )

  useEffect(() => {
    loadImages(true)
  }, [album.id, refreshTrigger])

  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadImages(false)
        }
      },
      { threshold: 0.1 }
    )

    const currentSentinel = sentinelRef.current
    if (currentSentinel) {
      observer.observe(currentSentinel)
    }

    return (): void => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel)
      }
    }
  }, [hasMore, isLoading, isLoadingMore, loadImages])

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (): void => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
  }

  const handleSingleUploadSuccess = useCallback((newImg: AlbumImage) => {
    setImages((prev) => {
      if (prev.some((img) => img.id === newImg.id)) return prev
      return [newImg, ...prev]
    })
    setOffset((prev) => prev + 1)
  }, [])

  const processFiles = (fileList: FileList): void => {
    if (isStorageFull) {
      addToast('Storage limit reached (40 GB). Delete some photos to free space.', 'error')
      return
    }
    const filesArray = Array.from(fileList)
    // Filter for images only
    const imageFiles = filesArray.filter((file) => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      addToast('Please upload image files only (PNG, JPG, WEBP, etc.).', 'error')
      return
    }

    if (imageFiles.length < filesArray.length) {
      addToast('Skipped non-image files.', 'error')
    }

    onUpload(imageFiles, handleSingleUploadSuccess)
  }

  const handleDeleteAlbum = async (): Promise<void> => {
    try {
      await dbService.deleteAlbum(album.id)
      addToast(`Album "${album.name}" deleted successfully.`, 'success')
      onBack()
    } catch (err: any) {
      console.error(err)
      addToast(err.message || 'Failed to delete album.', 'error')
      throw err
    }
  }

  const handleDeleteImage = async (
    e: React.MouseEvent,
    id: string,
    url: string,
    name: string
  ): Promise<void> => {
    e.stopPropagation()
    const confirmDelete = window.confirm(`Delete the photo "${name}"?`)
    if (!confirmDelete) return

    try {
      await dbService.deleteImage(id, url)
      setImages(images.filter((img) => img.id !== id))
      addToast('Photo deleted successfully.', 'success')
    } catch (err) {
      const error = err as Error
      console.error(error)
      addToast(error.message || 'Failed to delete photo.', 'error')
    }
  }

  const copyUrlToClipboard = (e: React.MouseEvent, url: string): void => {
    e.stopPropagation()
    navigator.clipboard.writeText(url)
    addToast('Direct link copied to clipboard!', 'success')
  }

  const formatSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  // Calculate total album storage size
  const totalAlbumSize = images.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0)

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="animate-fade">
      <div
        className="back-btn-row"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <button className="btn-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Albums
        </button>
        <button
          className="btn btn-secondary btn-danger-hover"
          style={{
            width: 'auto',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onClick={(): void => setIsDeleteModalOpen(true)}
        >
          <Trash2 size={15} style={{ color: 'var(--error)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Delete Album</span>
        </button>
      </div>

      <div className="album-detail-header-card">
        {album.cover_image_url ? (
          <img src={album.cover_image_url} alt={album.name} className="album-detail-cover" />
        ) : (
          <div
            className="album-detail-cover"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <ImageIcon size={36} />
          </div>
        )}
        <div className="album-detail-meta">
          <div className="album-detail-title-group">
            <h2 className="album-detail-title">{album.name}</h2>
            <p className="album-detail-desc">
              {album.description || 'Manage studio photographs for this session.'}
            </p>
          </div>
          <div className="album-detail-stats">
            <div className="stat-item">
              <ImageIcon size={14} style={{ color: 'var(--accent-light)' }} />
              <span>{images.length} photos</span>
            </div>
            <div className="stat-item">
              <FileSpreadsheet size={14} style={{ color: 'var(--accent-light)' }} />
              <span>Total size: {formatSize(totalAlbumSize)}</span>
            </div>
            <div className="stat-item">
              <Calendar size={14} style={{ color: 'var(--accent-light)' }} />
              <span>Created: {formatDate(album.created_at)}</span>
            </div>
          </div>
        </div>

        {album.code && qrCodeUrl && (
          <div className="album-detail-qr-section">
            <img
              src={qrCodeUrl}
              alt="Album QR Code"
              className="qr-code-img"
              title="Scan to download album"
            />
            <div className="qr-code-text">
              <span>Code: {album.code}</span>
              <button
                className="copy-btn-inline"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-light)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={(e): void => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(album.code || '')
                  addToast('Access code copied to clipboard!', 'success')
                }}
                title="Copy Access Code"
              >
                <Copy size={12} style={{ marginLeft: '4px' }} />
              </button>
            </div>
            <div className="qr-btn-group">
              <button className="qr-btn" onClick={downloadQrCode}>
                <Download size={12} />
                <span>Download QR</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: left side has upload + photos, right side has featured sidebar */}
      <div
        className="album-detail-layout"
        style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', marginTop: '32px' }}
      >
        <div className="album-detail-main" style={{ flex: 1, minWidth: 0 }}>
          {/* Drag & Drop Upload Zone */}
          {isStorageFull ? (
            <div className="storage-full-banner">
              <AlertTriangle size={22} className="storage-full-banner-icon" />
              <div>
                <p className="storage-full-banner-title">Storage Limit Reached</p>
                <p className="storage-full-banner-sub">
                  You&apos;ve used your full 40 GB. Delete existing photos to upload more.
                </p>
              </div>
            </div>
          ) : (
            <div
              className={`uploader-box ${isDragOver ? 'uploader-box-dragover' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={(): void => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="uploader-file-input"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
              />
              <div className="uploader-content">
                <UploadCloud className="uploader-icon" />
                <p className="uploader-title">Drag &amp; Drop photos here, or click to browse</p>
                <p className="uploader-subtitle">
                  Supports PNG, JPEG, GIF, WEBP, and TIFF up to 25MB each
                </p>
              </div>
            </div>
          )}

          {/* Images Grid */}
          <h3 style={{ fontSize: '18px', fontWeight: '750', marginBottom: '18px', color: 'white' }}>
            Album Photos
          </h3>

          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div
                className="status-dot animate-fade"
                style={{
                  animation: 'spin 1s infinite linear',
                  border: '3px solid var(--accent)',
                  borderTopColor: 'transparent',
                  background: 'transparent',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%'
                }}
              ></div>
            </div>
          ) : images.length === 0 ? (
            <div className="photos-empty">
              <ImageIcon className="photos-empty-icon" />
              <p style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>This album is empty</p>
              <p style={{ fontSize: '12px', margin: 0 }}>
                Drag some beautiful photos here or use the selector to start uploading files.
              </p>
            </div>
          ) : (
            <>
              <div className="photos-grid">
                {images.map((img, index) => (
                  <div
                    key={img.id}
                    className="photo-card"
                    onClick={(): void => onOpenLightbox(images, index)}
                    style={{ position: 'relative' }}
                  >
                    <img
                      src={img.thumbnail || img.url}
                      alt={img.name}
                      className="photo-thumb"
                      loading="lazy"
                    />
                    <div className="photo-overlay">
                      <div className="photo-actions-top">
                        <button
                          className="photo-btn"
                          title="Copy Image URL"
                          onClick={(e): void => copyUrlToClipboard(e, img.url)}
                        >
                          <Copy size={13} />
                        </button>

                        <button
                          className="photo-btn"
                          title="View Fullscreen"
                          onClick={(e): void => {
                            e.stopPropagation()
                            onOpenLightbox(images, index)
                          }}
                        >
                          <Maximize2 size={13} />
                        </button>
                        <button
                          className="photo-btn photo-btn-danger"
                          title="Delete Photo"
                          onClick={(e): Promise<void> =>
                            handleDeleteImage(e, img.id, img.url, img.name)
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="photo-details-bottom">
                        <span className="photo-name" title={img.name}>
                          {img.name}
                        </span>
                        <span className="photo-meta">
                          {formatSize(img.size_bytes)} • {formatDate(img.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Infinite Scroll Sentinel */}
              <div ref={sentinelRef} style={{ height: '20px', margin: '20px 0' }} />

              {isLoadingMore && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '24px 0',
                    gap: '8px',
                    alignItems: 'center'
                  }}
                >
                  <span
                    className="btn-spinner"
                    style={{ borderColor: 'var(--text-muted)', borderTopColor: 'var(--accent)' }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Loading more...
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {isDeleteModalOpen && (
        <DeleteConfirmationModal
          isOpen={true}
          title="Delete Album"
          message={
            <span>
              Are you sure you want to delete the album <strong>{album.name}</strong>? This will
              permanently delete the album and all <strong>{images.length}</strong> photos inside
              it. This action cannot be undone.
            </span>
          }
          onConfirm={handleDeleteAlbum}
          onClose={(): void => setIsDeleteModalOpen(false)}
        />
      )}
    </div>
  )
}
