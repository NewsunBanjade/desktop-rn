import React, { useState, useEffect } from 'react'
import { X, Copy, Check, Database, Settings, ShieldAlert } from 'lucide-react'
import { getSavedConfig, saveConfig, clearConfig, getSupabase } from '../supabase'

interface SettingsModalProps {
  onClose: () => void
  onSave: () => void
  addToast: (message: string, type: 'success' | 'error') => void
}

export default function SettingsModal({
  onClose,
  onSave,
  addToast
}: SettingsModalProps): React.JSX.Element {
  const currentConfig = getSavedConfig()
  const [url, setUrl] = useState(currentConfig.url)
  const [publishableKey, setPublishableKey] = useState(currentConfig.publishableKey)
  const [activeTab, setActiveTab] = useState<'config' | 'r2' | 'sql'>('config')
  const [isTesting, setIsTesting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const [envInfo, setEnvInfo] = useState<{
    IS_PACKAGED?: boolean
    USER_DATA_PATH?: string
    EXE_DIR_PATH?: string
  } | null>(null)

  const [r2AccountId, setR2AccountId] = useState('')
  const [r2BucketName, setR2BucketName] = useState('')
  const [r2PublicUrl, setR2PublicUrl] = useState('')
  const [r2AccessKeyId, setR2AccessKeyId] = useState('')
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('')
  const [r2ApiToken, setR2ApiToken] = useState('')
  const [supabaseSecretKey, setSupabaseSecretKey] = useState('')
  const [r2ConfiguredStatus, setR2ConfiguredStatus] = useState<any>(null)
  const [isSavingR2, setIsSavingR2] = useState(false)

  useEffect(() => {
    if (window.api && typeof window.api.getEnv === 'function') {
      try {
        const env = window.api.getEnv()
        setEnvInfo({
          IS_PACKAGED: env.IS_PACKAGED,
          USER_DATA_PATH: env.USER_DATA_PATH,
          EXE_DIR_PATH: env.EXE_DIR_PATH
        })
      } catch (e) {
        console.error('Failed to load env info:', e)
      }
    }

    if (window.api && typeof (window.api as any).getR2Config === 'function') {
      ;(window.api as any)
        .getR2Config()
        .then((config) => {
          if (config && config.configured) {
            setR2AccountId(config.accountId || '')
            setR2BucketName(config.bucketName || '')
            setR2PublicUrl(config.publicUrl || '')
            setR2ConfiguredStatus(config)
          }
        })
        .catch((err) => console.error('Failed to load R2 config:', err))
    }
  }, [])

  const handleSaveR2 = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!window.api || typeof (window.api as any).saveR2Config !== 'function') {
      addToast('Secure configuration is not supported in this environment.', 'error')
      return
    }

    setIsSavingR2(true)
    try {
      const res = await (window.api as any).saveR2Config({
        accountId: r2AccountId.trim(),
        bucketName: r2BucketName.trim(),
        publicUrl: r2PublicUrl.trim(),
        accessKeyId: r2AccessKeyId.trim(),
        secretAccessKey: r2SecretAccessKey.trim(),
        apiToken: r2ApiToken.trim(),
        supabaseSecretKey: supabaseSecretKey.trim()
      })
      if (res && res.success) {
        addToast('R2 and secret configuration saved securely!', 'success')
        // Clear password inputs
        setR2AccessKeyId('')
        setR2SecretAccessKey('')
        setR2ApiToken('')
        setSupabaseSecretKey('')

        // Reload status
        const config = await (window.api as any).getR2Config()
        setR2ConfiguredStatus(config)
      }
    } catch (err: any) {
      addToast(`Failed to save secure configuration: ${err.message}`, 'error')
    } finally {
      setIsSavingR2(false)
    }
  }

  const handleSave = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!url || !publishableKey) {
      addToast('Both URL and Publishable Key are required for Supabase.', 'error')
      return
    }
    saveConfig(url, publishableKey)
    addToast('Supabase configuration saved successfully!', 'success')
    onSave()
    onClose()
  }

  const handleClear = (): void => {
    clearConfig()
    setUrl('')
    setPublishableKey('')
    addToast('Supabase configuration cleared. Running in Demo Mode.', 'success')
    onSave()
    onClose()
  }

  const testConnection = async (): Promise<void> => {
    if (!url || !publishableKey) {
      addToast('Please provide both URL and Publishable Key to test.', 'error')
      return
    }
    setIsTesting(true)
    // Temporarily save to test
    const origUrl = localStorage.getItem('rn_supabase_url')
    const origKey =
      localStorage.getItem('rn_supabase_publishable_key') ||
      localStorage.getItem('rn_supabase_anon_key')

    try {
      localStorage.setItem('rn_supabase_url', url.trim())
      localStorage.setItem('rn_supabase_publishable_key', publishableKey.trim())

      // Force recreate client and call a simple request
      const testClient = getSupabase()
      if (!testClient) {
        throw new Error('Could not create client. Check URL format.')
      }

      // Try fetching from the albums table (even if it's empty, it shouldn't throw a network error if keys are valid)
      const { error } = await testClient.from('albums').select('id').limit(1)

      if (error && error.code !== 'PGRST116' && error.message.includes('Fetch')) {
        throw new Error(error.message)
      }

      addToast('Successfully connected to Supabase!', 'success')
    } catch (err) {
      const errorObj = err as Error
      console.error(errorObj)
      addToast(`Connection failed: ${errorObj.message || 'Check your keys or RLS rules'}`, 'error')

      // Revert if failed
      if (origUrl) localStorage.setItem('rn_supabase_url', origUrl)
      else localStorage.removeItem('rn_supabase_url')
      if (origKey) localStorage.setItem('rn_supabase_publishable_key', origKey)
      else localStorage.removeItem('rn_supabase_publishable_key')
    } finally {
      setIsTesting(false)
    }
  }

  const sqlCode = `-- SQL Schema setup for RN Studio Photo Upload App
-- Copy and paste this into your Supabase SQL Editor

-- 1. Enable UUID generator extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the albums table
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    code TEXT UNIQUE,
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create the photos table (maps uploaded photos to albums)
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    public_url TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    thumbnail TEXT,
    size_bytes BIGINT,
    is_featured BOOLEAN DEFAULT false,
    cdn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Allow authenticated users full access
CREATE POLICY "Allow authenticated users full access on albums" 
ON public.albums FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access on photos" 
ON public.photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow public read access to display images/albums
CREATE POLICY "Allow public read access on albums" 
ON public.albums FOR SELECT TO public USING (true);

CREATE POLICY "Allow public read access on photos" 
ON public.photos FOR SELECT TO public USING (true);`

  const copySql = (): void => {
    navigator.clipboard.writeText(sqlCode)
    setIsCopied(true)
    addToast('SQL schema copied to clipboard!', 'success')
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-card-lg animate-slide-up">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings style={{ color: 'var(--accent-light)', width: '22px', height: '22px' }} />
            <h3 className="modal-title">Supabase Integrations</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'config' ? 'settings-tab-active' : ''}`}
            onClick={(): void => setActiveTab('config')}
          >
            Supabase Client Connection
          </button>
          <button
            className={`settings-tab ${activeTab === 'r2' ? 'settings-tab-active' : ''}`}
            onClick={(): void => setActiveTab('r2')}
          >
            Cloudflare R2 &amp; Secrets
          </button>
          <button
            className={`settings-tab ${activeTab === 'sql' ? 'settings-tab-active' : ''}`}
            onClick={(): void => setActiveTab('sql')}
          >
            Required SQL Schema
          </button>
        </div>

        {activeTab === 'config' && (
          <form onSubmit={handleSave}>
            <div className="status-bar" style={{ marginBottom: '20px' }}>
              <div className="status-indicator">
                <Database size={16} style={{ color: 'var(--warning)' }} />
                <span>
                  By default, the app runs in <strong>Demo Mode</strong> with local storage,
                  enabling you to test features immediately without any setup.
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Supabase Project URL</label>
              <input
                type="text"
                placeholder="https://your-project-id.supabase.co"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                value={url}
                onChange={(e): void => setUrl(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Supabase Publishable Key</label>
              <textarea
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZi..."
                className="form-input"
                style={{
                  paddingLeft: '14px',
                  height: '90px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  resize: 'none'
                }}
                value={publishableKey}
                onChange={(e): void => setPublishableKey(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto', flex: 1 }}
                onClick={testConnection}
                disabled={isTesting}
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
              {currentConfig.url && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    width: 'auto',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}
                  onClick={handleClear}
                >
                  Clear Config
                </button>
              )}
            </div>

            <div
              className="modal-footer"
              style={{
                marginTop: '24px',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '16px'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100px' }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ width: '150px' }}>
                Save & Apply
              </button>
            </div>
          </form>
        )}

        {activeTab === 'r2' && (
          <form onSubmit={handleSaveR2}>
            <div className="status-bar status-bar-supabase" style={{ marginBottom: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div className="status-indicator">
                <Database size={16} style={{ color: 'var(--accent-light)' }} />
                <span style={{ fontSize: '12px' }}>
                  These administrative credentials are <strong>encrypted locally</strong> using Electron's native OS-level encryption keychains (Keychain / DPAPI). They are never exposed to the frontend browser context.
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Cloudflare R2 Account ID</label>
                <input
                  type="text"
                  placeholder="e.g. 5d57b2..."
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  value={r2AccountId}
                  onChange={(e): void => setR2AccountId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">R2 Bucket Name</label>
                <input
                  type="text"
                  placeholder="e.g. imagecdn"
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  value={r2BucketName}
                  onChange={(e): void => setR2BucketName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">R2 Public Bucket URL (CDN)</label>
              <input
                type="text"
                placeholder="https://pub-xxxxxx.r2.dev or https://cdn.yourdomain.com"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                value={r2PublicUrl}
                onChange={(e): void => setR2PublicUrl(e.target.value)}
                required
              />
            </div>

            <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  R2 Access Key ID{' '}
                  {r2ConfiguredStatus?.hasAccessKeyId && (
                    <span style={{ color: 'var(--success)', fontSize: '11px' }}> (Saved)</span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={r2ConfiguredStatus?.hasAccessKeyId ? '••••••••••••••••••••' : 'Enter access key id'}
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  value={r2AccessKeyId}
                  onChange={(e): void => setR2AccessKeyId(e.target.value)}
                  required={!r2ConfiguredStatus?.hasAccessKeyId}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  R2 Secret Access Key{' '}
                  {r2ConfiguredStatus?.hasSecretAccessKey && (
                    <span style={{ color: 'var(--success)', fontSize: '11px' }}> (Saved)</span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={r2ConfiguredStatus?.hasSecretAccessKey ? '••••••••••••••••••••' : 'Enter secret access key'}
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  value={r2SecretAccessKey}
                  onChange={(e): void => setR2SecretAccessKey(e.target.value)}
                  required={!r2ConfiguredStatus?.hasSecretAccessKey}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Cloudflare API Token{' '}
                  {r2ConfiguredStatus?.hasApiToken && (
                    <span style={{ color: 'var(--success)', fontSize: '11px' }}> (Saved)</span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={r2ConfiguredStatus?.hasApiToken ? '••••••••••••••••••••' : 'Enter API token'}
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  value={r2ApiToken}
                  onChange={(e): void => setR2ApiToken(e.target.value)}
                  required={!r2ConfiguredStatus?.hasApiToken}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Supabase Service Role/Secret Key{' '}
                  {r2ConfiguredStatus?.hasSupabaseSecretKey && (
                    <span style={{ color: 'var(--success)', fontSize: '11px' }}> (Saved)</span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={r2ConfiguredStatus?.hasSupabaseSecretKey ? '••••••••••••••••••••' : 'Enter service role key'}
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  value={supabaseSecretKey}
                  onChange={(e): void => setSupabaseSecretKey(e.target.value)}
                  required={!r2ConfiguredStatus?.hasSupabaseSecretKey}
                />
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                marginTop: '20px',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '16px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100px' }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ width: '150px' }} disabled={isSavingR2}>
                {isSavingR2 ? 'Saving...' : 'Save R2 Config'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'sql' && (
          <div>
            <div className="status-bar status-bar-supabase" style={{ marginBottom: '20px' }}>
              <div className="status-indicator">
                <ShieldAlert size={16} style={{ color: 'var(--success)' }} />
                <span>
                  Please execute this SQL script in your{' '}
                  <strong>Supabase Dashboard &gt; SQL Editor</strong> to construct the tables with
                  cascade-delete capability.
                </span>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <button className="copy-badge" onClick={copySql}>
                {isCopied ? (
                  <>
                    <Check size={10} style={{ marginRight: '4px', display: 'inline' }} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={10} style={{ marginRight: '4px', display: 'inline' }} /> Copy Code
                  </>
                )}
              </button>
              <pre className="sql-code-block">{sqlCode}</pre>
            </div>

            <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <strong>Cloudflare R2 &amp; Supabase Environment Setup:</strong>
              <ol style={{ paddingLeft: '20px', marginTop: '6px', lineHeight: '1.6' }}>
                <li>
                  Configure the environment variables (e.g. in your <code>.env</code> file) with
                  your Cloudflare R2 account ID, credentials, bucket name, and public URL.
                  {envInfo && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <strong style={{ color: 'var(--text-primary)' }}>
                        Active searches for <code>.env</code>:
                      </strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0, listStyleType: 'disc' }}>
                        {envInfo.IS_PACKAGED ? (
                          <>
                            <li style={{ marginTop: '2px' }}>
                              Next to App Executable (Recommended):{' '}
                              <code style={{ color: 'var(--accent-light)', wordBreak: 'break-all' }}>
                                {envInfo.EXE_DIR_PATH}/.env
                              </code>
                            </li>
                            <li style={{ marginTop: '2px' }}>
                              User Application Data folder:{' '}
                              <code style={{ color: 'var(--accent-light)', wordBreak: 'break-all' }}>
                                {envInfo.USER_DATA_PATH}/.env
                              </code>
                            </li>
                          </>
                        ) : (
                          <li>
                            Project Root Directory (Development):{' '}
                            <code style={{ color: 'var(--accent-light)' }}>.env</code>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </li>
                <li>
                  Make sure the <code>featured_photo</code> table is created in Supabase using the
                  SQL script above.
                </li>
                <li>
                  Images will be automatically resized to 300x300 thumbnails on upload, uploaded to
                  R2, and logged in the <code>featured_photo</code> table.
                </li>
              </ol>
            </div>

            <div
              className="modal-footer"
              style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}
            >
              <button className="btn btn-secondary" style={{ width: '100px' }} onClick={onClose}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
