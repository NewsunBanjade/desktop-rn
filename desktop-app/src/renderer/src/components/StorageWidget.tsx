import React from 'react'
import { HardDrive, AlertTriangle } from 'lucide-react'
import { useStorage } from '../StorageContext'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export default function StorageWidget(): React.JSX.Element {
  const { usedBytes, limitBytes, usedPercent, isStorageFull, isLoading } = useStorage()

  const isCritical = usedPercent >= 90
  const isWarning = usedPercent >= 75 && !isCritical

  const barColor = isStorageFull
    ? 'var(--error)'
    : isCritical
      ? '#f97316'
      : isWarning
        ? 'var(--warning)'
        : 'var(--accent-light)'

  return (
    <div
      className={`storage-widget ${isStorageFull ? 'storage-widget-full' : isCritical ? 'storage-widget-critical' : ''}`}
      title={`${formatBytes(usedBytes)} used of ${formatBytes(limitBytes)}`}
    >
      <div className="storage-widget-header">
        {isStorageFull ? (
          <AlertTriangle size={13} className="storage-icon storage-icon-full" />
        ) : (
          <HardDrive size={13} className="storage-icon" />
        )}
        <span className="storage-label">Storage</span>
        {isStorageFull && <span className="storage-full-badge">FULL</span>}
      </div>

      <div className="storage-bar-track">
        {isLoading ? (
          <div className="storage-bar-skeleton" />
        ) : (
          <div
            className={`storage-bar-fill ${isStorageFull ? 'storage-bar-pulse' : ''}`}
            style={{
              width: `${usedPercent}%`,
              background: barColor,
              boxShadow: `0 0 6px ${barColor}55`
            }}
          />
        )}
      </div>

      <div className="storage-meta">
        <span className="storage-used" style={{ color: isStorageFull ? 'var(--error)' : undefined }}>
          {isLoading ? '—' : formatBytes(usedBytes)}
        </span>
        <span className="storage-limit">{formatBytes(limitBytes)}</span>
      </div>
    </div>
  )
}
