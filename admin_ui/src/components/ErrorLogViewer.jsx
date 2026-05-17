import React, { useEffect, useMemo, useState } from 'react'
import { errorLogClient } from '../api'

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch (_) {
    return String(value)
  }
}

export default function ErrorLogViewer({ token }) {
  const client = useMemo(() => errorLogClient(token), [token])
  const [logs, setLogs] = useState([])
  const [service, setService] = useState('')
  const [partOfService, setPartOfService] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const loadLogs = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const params = { limit: 100 }
      if (service) params.service = service
      if (partOfService) params.partOfService = partOfService
      const res = await client.get('/error_log', { params })
      setLogs(res.data.errors || [])
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Kon fouten niet laden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [service, partOfService])

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Error log</h2>
          <p>Laatste foutmeldingen uit de centrale logging service.</p>
        </div>
        <button className="secondary" onClick={loadLogs} disabled={loading}>
          {loading ? 'Laden...' : 'Ververs'}
        </button>
      </div>

      <div className="form-row">
        <input placeholder="Service filter" value={service} onChange={e => setService(e.target.value)} />
        <input placeholder="Part of service filter" value={partOfService} onChange={e => setPartOfService(e.target.value)} />
      </div>

      {message && <div className="message">{message}</div>}

      <div className="list-grid">
        {logs.map(log => (
          <article className="mini-card" key={log.id}>
            <strong>{log.service}</strong>
            <div>{formatDate(log.date)}</div>
            <div className="muted" style={{ marginTop: 6 }}>{log.partOfService || '—'}</div>
            <div style={{ marginTop: 8 }}>{log.error}</div>
          </article>
        ))}
      </div>

      {!logs.length && !message && <div className="muted">Nog geen foutmeldingen gevonden.</div>}
    </section>
  )
}
