import React, { useState } from 'react'
import { Mail, Lock, LogIn } from 'lucide-react'
import { dbService } from '../dbService'

interface LoginProps {
  onLoginSuccess: (user: { email: string; id: string }) => void
  addToast: (message: string, type: 'success' | 'error') => void
}

export default function Login({ onLoginSuccess, addToast }: LoginProps): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please fill in all fields')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const user = await dbService.signIn(email.trim(), password)
      addToast('Welcome back to RN Studio!', 'success')
      onLoginSuccess(user)
    } catch (err) {
      const errorObj = err as Error
      console.error(errorObj)
      setError(errorObj.message || 'Authentication failed. Please verify credentials.')
      addToast(errorObj.message || 'Authentication failed.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-section">
          <div className="logo-icon">RN</div>
          <h2 className="studio-name">RN Studio</h2>
          <p className="studio-tagline">Photo Management Portal</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-banner">
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" />
              <input
                type="email"
                placeholder="email@rnstudio.com"
                className="form-input"
                value={email}
                onChange={(e): void => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                className="form-input"
                value={password}
                onChange={(e): void => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? (
              <span
                className="status-dot animate-fade"
                style={{
                  animation: 'spin 1s infinite linear',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  background: 'transparent',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%'
                }}
              ></span>
            ) : (
              <>
                <LogIn size={16} /> Access Portal
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
