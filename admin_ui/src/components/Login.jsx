import React, { useState } from 'react'
import { authClient } from '../api'

export default function Login({ onLogin }) {
  const [userCode, setUserCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authClient.post('/login', { userCode, password })
      const token = res.data.token
      // fetch /me to get payload
      const me = await authClient.get('/me', { headers: { Authorization: `Bearer ${token}` } })
      onLogin(token, me.data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'login_failed')
    } finally { setLoading(false) }
  }

  const devToken = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await authClient.post('/dev/token', { userId: 1, userCode: 42 })
      const token = res.data.token
      const me = await authClient.get('/me', { headers: { Authorization: `Bearer ${token}` } })
      onLogin(token, me.data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'dev_token_failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="login">
      <h2>Admin Login</h2>
      <form onSubmit={submit}>
        <label>
          User Code
          <input value={userCode} onChange={e => setUserCode(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Please wait...' : 'Login'}</button>
        {error && <div className="error">{error}</div>}
      </form>
      <p>Be sure `ADMIN_USER_CODES` contains your `userCode` for admin actions.</p>
      <hr />
      <div>
        <button onClick={devToken} disabled={loading}>Get Dev Token (if available)</button>
        <div style={{fontSize:12, marginTop:6}}>Uses `/dev/token` on the auth API for quick local testing.</div>
      </div>
    </div>
  )
}
