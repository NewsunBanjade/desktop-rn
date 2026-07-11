import React, { useState, useEffect } from 'react'
import { X, FolderPlus, RefreshCw } from 'lucide-react'

interface CreateAlbumModalProps {
  onClose: () => void
  onSave: (
    name: string,
    description: string,
    code: string,
    expiryDate: string | null
  ) => Promise<void>
}

export default function CreateAlbumModal({
  onClose,
  onSave
}: CreateAlbumModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [expiryDate, setExpiryDate] = useState((): string => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return d.toISOString().split('T')[0]
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const generateRandomCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  useEffect(() => {
    setCode(generateRandomCode())
  }, [])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Album name is required')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const formattedExpiry = expiryDate ? new Date(expiryDate + 'T23:59:59Z').toISOString() : null
      await onSave(name.trim(), description.trim(), code, formattedExpiry)
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to create album. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card animate-slide-up">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderPlus style={{ color: 'var(--accent-light)', width: '22px', height: '22px' }} />
            <h3 className="modal-title">Create Album</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-banner">
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Album Name</label>
            <input
              type="text"
              placeholder="e.g. Wedding Shoot - John & Jane"
              className="form-input"
              style={{ paddingLeft: '14px' }}
              value={name}
              onChange={(e): void => setName(e.target.value)}
              required
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Access Code (Generated)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                style={{
                  paddingLeft: '14px',
                  fontFamily: 'monospace',
                  letterSpacing: '2px',
                  fontWeight: 'bold'
                }}
                value={code}
                readOnly
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  width: '46px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={(): void => setCode(generateRandomCode())}
                disabled={isSubmitting}
                title="Regenerate Code"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Expiry Date</label>
            <input
              type="date"
              className="form-input"
              style={{ paddingLeft: '14px' }}
              value={expiryDate}
              onChange={(e): void => setExpiryDate(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              placeholder="Provide a brief summary of the photo session..."
              className="form-input"
              style={{ paddingLeft: '14px', height: '100px', resize: 'none' }}
              value={description}
              onChange={(e): void => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div
            className="modal-footer"
            style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100px' }}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '140px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Album'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
