import React, { useState } from 'react'
import { AlertTriangle, X, Trash2 } from 'lucide-react'

interface DeleteConfirmationModalProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm: () => Promise<void>
  onClose: () => void
}

export default function DeleteConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onClose
}: DeleteConfirmationModalProps): React.JSX.Element | null {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleConfirm = async (): Promise<void> => {
    setIsSubmitting(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err: unknown) {
      console.error(err)
      const errorMsg = err instanceof Error ? err.message : 'Operation failed. Please try again.'
      setError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card animate-slide-up"
        onClick={(e): void => e.stopPropagation()}
        style={{ maxWidth: '440px' }}
      >
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle style={{ color: 'var(--error)', width: '22px', height: '22px' }} />
            <h3 className="modal-title" style={{ fontSize: '18px' }}>
              {title}
            </h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            lineHeight: '1.6',
            marginBottom: '24px'
          }}
        >
          {message}
          {error && (
            <div className="error-banner" style={{ marginTop: '16px', marginBottom: 0 }}>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ marginTop: 0, gap: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '10px 18px' }}
            onClick={onClose}
            disabled={isSubmitting}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            style={{ width: 'auto', padding: '10px 18px' }}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="btn-spinner" />
            ) : (
              <>
                <Trash2 size={15} />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
