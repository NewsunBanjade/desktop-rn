import React, { useState, useEffect, useRef } from 'react'
import { Plus, Search, Folder, Trash2, Image, Star, UploadCloud } from 'lucide-react'
import { dbService, Album, AlbumImage } from '../dbService'
import DeleteConfirmationModal from './DeleteConfirmationModal'

interface DashboardProps {
  onSelectAlbum: (album: Album) => void
  onOpenCreateModal: () => void
  addToast: (message: string, type: 'success' | 'error') => void
  refreshTrigger: number
}

export default function Dashboard({
  onSelectAlbum,
  onOpenCreateModal,
  addToast,
  refreshTrigger
}: DashboardProps): React.JSX.Element {
  const [albums, setAlbums] = useState<Album[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [albumImageCounts, setAlbumImageCounts] = useState<Record<string, number>>({})
  const [featuredImages, setFeaturedImages] = useState<AlbumImage[]>([])
  const featuredFileInputRef = useRef<HTMLInputElement>(null)
  const [albumToDelete, setAlbumToDelete] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    loadAlbums()
    loadFeaturedImages()
  }, [refreshTrigger])

  const loadAlbums = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const fetchedAlbums = await dbService.fetchAlbums()
      setAlbums(fetchedAlbums)

      // Load counts for each album
      const counts: Record<string, number> = {}
      for (const alb of fetchedAlbums) {
        try {
          const imgs = await dbService.fetchImages(alb.id)
          counts[alb.id] = imgs.length
        } catch (e) {
          counts[alb.id] = 0
        }
      }
      setAlbumImageCounts(counts)
    } catch (err: any) {
      console.error(err)
      addToast(err.message || 'Failed to load albums.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const loadFeaturedImages = async (): Promise<void> => {
    try {
      const fetched = await dbService.fetchGlobalFeaturedImages()
      setFeaturedImages(fetched)
    } catch (err: any) {
      console.error('Failed to load global featured images:', err)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string): void => {
    e.stopPropagation() // Prevent selecting the album card
    setAlbumToDelete({ id, name })
  }

  const handleConfirmDeleteAlbum = async (): Promise<void> => {
    if (!albumToDelete) return
    const { id, name } = albumToDelete
    try {
      await dbService.deleteAlbum(id)
      addToast(`Album "${name}" deleted.`, 'success')
      setAlbums((prev) => prev.filter((a) => a.id !== id))
    } catch (err: any) {
      console.error(err)
      addToast(err.message || 'Failed to delete album.', 'error')
      throw err
    }
  }

  const handleRemoveFeatured = async (id: string): Promise<void> => {
    try {
      await dbService.deleteGlobalFeaturedImage(id)
      setFeaturedImages((prev) => prev.filter((img) => img.id !== id))
      addToast('Removed photo from featured list.', 'success')
    } catch (error: any) {
      addToast(error.message || 'Failed to remove featured image.', 'error')
    }
  }

  const handleFeaturedFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (!file.type.startsWith('image/')) {
        addToast('Please upload image files only.', 'error')
        return
      }
      if (featuredImages.length >= 5) {
        addToast('You can upload up to 5 featured images only. Please remove one first.', 'error')
        return
      }

      try {
        addToast(`Uploading featured image "${file.name}"...`, 'success')
        const uploaded = await dbService.uploadFeaturedImage(file)
        setFeaturedImages((prev) => [uploaded, ...prev])
      } catch (err: unknown) {
        console.error(err)
        const errorMsg = err instanceof Error ? err.message : 'Failed to upload featured image.'
        addToast(errorMsg, 'error')
      }
    }
  }

  const filteredAlbums = albums.filter(
    (album) =>
      album.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (album.description && album.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="animate-fade">
      <div className="dashboard-header">
        <div className="section-title-group">
          <h2 className="section-title">Photography Albums</h2>
          <p className="section-subtitle">
            Manage collections and upload high-resolution media resources
          </p>
        </div>

        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={onOpenCreateModal}>
          <Plus size={16} /> New Album
        </button>
      </div>

      {/* Search and filter toolbar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <div className="input-wrapper" style={{ flex: 1 }}>
          <Search className="input-icon" />
          <input
            type="text"
            placeholder="Search albums by name or keywords..."
            className="form-input"
            value={searchQuery}
            onChange={(e): void => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '240px',
            color: 'var(--text-secondary)'
          }}
        >
          <div
            className="status-dot animate-fade"
            style={{
              animation: 'spin 1s infinite linear',
              border: '3px solid var(--accent)',
              borderTopColor: 'transparent',
              background: 'transparent',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              marginBottom: '16px'
            }}
          ></div>
          <span>Synchronizing media database...</span>
        </div>
      ) : (
        <div
          className="dashboard-layout"
          style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}
        >
          <div className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>
            {filteredAlbums.length === 0 ? (
              <div className="albums-grid">
                {searchQuery === '' && (
                  <div className="album-card album-card-create" onClick={onOpenCreateModal}>
                    <div className="create-icon-wrapper">
                      <Plus size={28} />
                    </div>
                    <p className="create-card-title">Create First Album</p>
                    <p className="create-card-subtitle">
                      Set up a new workspace folder to begin organizing studio uploads.
                    </p>
                  </div>
                )}
                {searchQuery !== '' && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      textAlign: 'center',
                      padding: '60px 20px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <Folder size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                      No matching albums found
                    </p>
                    <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
                      Refine search criteria and try again.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="albums-grid">
                {/* Create new album grid item */}
                {searchQuery === '' && (
                  <div className="album-card album-card-create" onClick={onOpenCreateModal}>
                    <div className="create-icon-wrapper">
                      <Plus size={28} />
                    </div>
                    <p className="create-card-title">New Album</p>
                    <p className="create-card-subtitle">Add a new photo shoot collection.</p>
                  </div>
                )}

                {/* List of albums */}
                {filteredAlbums.map((album) => (
                  <div
                    key={album.id}
                    className="album-card"
                    onClick={(): void => onSelectAlbum(album)}
                  >
                    <div className="album-cover-container">
                      {album.cover_image_url ? (
                        <img
                          src={album.cover_image_url}
                          alt={album.name}
                          className="album-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="album-placeholder">
                          <Image size={40} />
                          <span style={{ fontSize: '12px' }}>Empty Album</span>
                        </div>
                      )}
                    </div>
                    <div className="album-info">
                      <span className="album-meta-date">
                        Created {formatDate(album.created_at)}
                      </span>
                      <h4 className="album-name" title={album.name}>
                        {album.name}
                      </h4>
                      <p className="album-description">
                        {album.description || 'No description provided for this collection.'}
                      </p>
                    </div>
                    <div className="album-footer">
                      <span className="album-count">
                        <Folder size={14} />
                        <span>{albumImageCounts[album.id] ?? 0} photos</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          className="album-delete-btn"
                          title="Delete Album"
                          onClick={(e): void => handleDeleteClick(e, album.id, album.name)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Global Sidebar for Featured Images */}
          <aside
            className="dashboard-sidebar"
            style={{
              width: '300px',
              flexShrink: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px'
              }}
            >
              <h4
                style={{
                  fontSize: '15px',
                  fontWeight: '750',
                  margin: 0,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Star
                  size={16}
                  fill="var(--accent-light)"
                  style={{ color: 'var(--accent-light)' }}
                />
                Featured Slider
              </h4>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                {featuredImages.length}/5
              </span>
            </div>

            {/* Featured images list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {featuredImages.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 12px',
                    color: 'var(--text-muted)',
                    border: '1px dashed rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600'
                    }}
                  >
                    No featured images
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      display: 'block',
                      lineHeight: '1.4'
                    }}
                  >
                    These images will be displayed in the app&apos;s home slider.
                  </span>
                </div>
              ) : (
                featuredImages.map((img) => (
                  <div
                    key={img.id}
                    className="featured-sidebar-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={img.thumbnail || img.url}
                      alt={img.name}
                      style={{
                        width: '48px',
                        height: '48px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        background: 'rgba(0,0,0,0.2)'
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: 'white',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={img.name}
                      >
                        {img.name}
                      </span>
                      <button
                        onClick={(): void => {
                          navigator.clipboard.writeText(img.url)
                          addToast('Direct link copied to clipboard!', 'success')
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-light)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          padding: 0,
                          fontWeight: '500'
                        }}
                      >
                        Copy URL
                      </button>
                    </div>
                    <button
                      title="Remove from featured"
                      onClick={(): Promise<void> => handleRemoveFeatured(img.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.2s ease'
                      }}
                    >
                      <Trash2 size={13} style={{ color: 'var(--error)' }} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Action buttons */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}
            >
              <button
                className="btn btn-primary"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '13px'
                }}
                onClick={(): void => featuredFileInputRef.current?.click()}
              >
                <UploadCloud size={14} />
                Upload Featured
              </button>
              <input
                type="file"
                ref={featuredFileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFeaturedFileSelect}
              />
            </div>
          </aside>
        </div>
      )}
      {albumToDelete && (
        <DeleteConfirmationModal
          isOpen={true}
          title="Delete Album"
          message={
            <span>
              Are you sure you want to delete the album <strong>{albumToDelete.name}</strong>? This
              will permanently delete the album and all{' '}
              <strong>{albumImageCounts[albumToDelete.id] ?? 0}</strong> photos inside it. This
              action cannot be undone.
            </span>
          }
          onConfirm={handleConfirmDeleteAlbum}
          onClose={(): void => setAlbumToDelete(null)}
        />
      )}
    </div>
  )
}
