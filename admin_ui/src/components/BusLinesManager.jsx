import React, { useEffect, useState } from 'react'
import { transitClient } from '../api'

export default function BusLinesManager({ token, user }) {
  const client = transitClient(token)
  const [busLines, setBusLines] = useState([])
  const [lineNumber, setLineNumber] = useState('')
  const [startStop, setStartStop] = useState('')
  const [endStop, setEndStop] = useState('')
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState(null)
  const [isAdmin] = useState(Boolean(user?.userCode))

  const loadBusLines = async () => {
    try {
      const res = await client.get('/admin/bus-lines')
      setBusLines(res.data.busLines || [])
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  useEffect(() => {
    loadBusLines()
  }, [])

  const createBusLine = async (e) => {
    e.preventDefault()
    setMessage(null)
    try {
      const res = await client.post('/admin/bus-lines', {
        lineNumber: Number(lineNumber),
        startStop,
        endStop,
        estimatedDurationMinutes: Number(estimatedDurationMinutes),
        description,
      })
      setLineNumber('')
      setStartStop('')
      setEndStop('')
      setEstimatedDurationMinutes('')
      setDescription('')
      setMessage('Bus line created: #' + (res.data.busLine?.id || 'ok'))
      await loadBusLines()
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Buslijnen</h2>
          <p>Maak en bewerk buslijnen.</p>
        </div>
        <button className="secondary" onClick={loadBusLines}>Refresh</button>
      </div>

      <div className="list-grid">
        {busLines.map(line => (
          <article className="mini-card" key={line.id}>
            <strong>#{line.id} Lijn {line.lineNumber}</strong>
            <div>{line.startStop} → {line.endStop}</div>
            <div>{line.estimatedDurationMinutes} min</div>
            {line.description ? <div className="muted">{line.description}</div> : null}
          </article>
        ))}
      </div>

      {isAdmin ? (
        <form onSubmit={createBusLine} className="stack-form">
          <div className="form-row">
            <input placeholder="Line number" value={lineNumber} onChange={e => setLineNumber(e.target.value)} />
            <input placeholder="Start stop" value={startStop} onChange={e => setStartStop(e.target.value)} />
            <input placeholder="End stop" value={endStop} onChange={e => setEndStop(e.target.value)} />
          </div>
          <div className="form-row">
            <input placeholder="Duration in minutes" value={estimatedDurationMinutes} onChange={e => setEstimatedDurationMinutes(e.target.value)} />
            <input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
            <button type="submit">Create bus line</button>
          </div>
        </form>
      ) : <div>You must be admin to create bus lines.</div>}

      {message && <div className="message">{message}</div>}
    </section>
  )
}
