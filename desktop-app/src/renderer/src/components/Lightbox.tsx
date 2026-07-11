import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Download, Calendar } from 'lucide-react'
import { AlbumImage } from '../dbService'

interface LightboxProps {
  images: AlbumImage[]
  activeIndex: number
  onClose: () => void
  onChangeIndex: (index: number) => void
}

export default function Lightbox({
  images,
  activeIndex,
  onClose,
  onChangeIndex
}: LightboxProps): React.JSX.Element | null {
  const currentImage = images[activeIndex]

  const handleNext = useCallback((): void => {
    if (images.length > 1) {
      onChangeIndex((activeIndex + 1) % images.length)
    }
  }, [images.length, onChangeIndex, activeIndex])

  const handlePrev = useCallback((): void => {
    if (images.length > 1) {
      onChangeIndex((activeIndex - 1 + images.length) % images.length)
    }
  }, [images.length, onChangeIndex, activeIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'Right') {
        handleNext()
      }
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        handlePrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return (): void => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, images.length, handleNext, handlePrev, onClose])

  if (!currentImage) return null

  const formatSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size'
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-content animate-fade" onClick={(e): void => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>
          <X size={18} /> Close
        </button>

        {images.length > 1 && (
          <>
            <button
              className="photo-btn"
              style={{
                position: 'absolute',
                left: '-60px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '44px',
                height: '44px',
                borderRadius: '50%'
              }}
              onClick={handlePrev}
            >
              <ChevronLeft size={24} />
            </button>
            <button
              className="photo-btn"
              style={{
                position: 'absolute',
                right: '-60px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '44px',
                height: '44px',
                borderRadius: '50%'
              }}
              onClick={handleNext}
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        <img src={currentImage.url} alt={currentImage.name} className="lightbox-img" />

        <div className="lightbox-footer">
          <h4 className="lightbox-title">{currentImage.name}</h4>
          <p
            className="lightbox-desc"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              color: 'var(--text-secondary)'
            }}
          >
            <span>{formatSize(currentImage.size_bytes)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} /> {formatDate(currentImage.created_at)}
            </span>
            <a
              href={currentImage.url}
              download={currentImage.name}
              target="_blank"
              rel="noreferrer"
              className="status-action-link"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              <Download size={12} /> Save Raw Link
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
