import React, { useEffect, useState } from 'react'
import { transitClient } from '../api'

export default function BusLinesManager({ token, user }) {
  const client = transitClient(token)
  const [busLines, setBusLines] = useState([])
  const [stops, setStops] = useState([])
  const [lineNumber, setLineNumber] = useState('')
  const [startStop, setStartStop] = useState('')
  const [endStop, setEndStop] = useState('')
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState(null)
  const [isAdmin] = useState(Boolean(user?.isAdmin))
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [editingLine, setEditingLine] = useState(null)

  const loadBusLines = async () => {
    try {
      const res = await client.get('/admin/bus-lines')
      setBusLines(res.data.busLines || [])
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  const loadStops = async () => {
    try {
      const res = await client.get('/admin/stops')
      setStops(res.data.stops || [])
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  useEffect(() => {
    loadBusLines()
    loadStops()
  }, [])

  const createBusLine = async (e) => {
    e.preventDefault()
    setMessage(null)
    try {
      // Map selected stop ids to names (server currently stores names)
      const startStopName = stops.find(s => String(s.id) === String(startStop))?.name || startStop
      const endStopName = stops.find(s => String(s.id) === String(endStop))?.name || endStop

      const res = await client.post('/admin/bus-lines', {
        lineNumber: Number(lineNumber),
        startStop: startStopName,
        endStop: endStopName,
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

  const deleteBusLine = async (lineId, lineNumber) => {
    setMessage(null)
    try {
      await client.delete(`/admin/bus-lines/${lineId}`)
      setMessage(`Buslijn ${lineNumber} verwijderd`)
      setDeleteConfirm(null)
      await loadBusLines()
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message
      setMessage('Error: ' + errMsg)
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
            {isAdmin && (
              <>
                <button 
                  className="danger" 
                  onClick={() => setDeleteConfirm(line)}
                  style={{ marginTop: '0.5rem', width: '100%' }}
                >
                  Delete
                </button>
                <button
                  className="secondary"
                  onClick={() => setEditingLine({
                    id: line.id,
                    lineNumber: line.lineNumber,
                    startStop: (stops.find(s => s.name === line.startStop) || {}).id || line.startStop,
                    endStop: (stops.find(s => s.name === line.endStop) || {}).id || line.endStop,
                    estimatedDurationMinutes: line.estimatedDurationMinutes,
                    description: line.description || '',
                  })}
                  style={{ marginTop: '0.5rem', width: '100%' }}
                >
                  Edit
                </button>
              </>
            )}
          </article>
        ))}
      </div>

      {isAdmin ? (
        <form onSubmit={createBusLine} className="stack-form">
          <div className="form-row">
            <input placeholder="Line number" value={lineNumber} onChange={e => setLineNumber(e.target.value)} />
            <select value={startStop} onChange={e => setStartStop(e.target.value)}>
              <option value="">Start stop</option>
              {stops.map(stop => (
                <option key={stop.id} value={stop.id}>#{stop.id} {stop.name}</option>
              ))}
            </select>
            <select value={endStop} onChange={e => setEndStop(e.target.value)}>
              <option value="">End stop</option>
              {stops.map(stop => (
                <option key={stop.id} value={stop.id}>#{stop.id} {stop.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <input placeholder="Duration in minutes" value={estimatedDurationMinutes} onChange={e => setEstimatedDurationMinutes(e.target.value)} />
            <input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
            <button type="submit">Create bus line</button>
          </div>
        </form>
      ) : <div>You must be admin to create bus lines.</div>}

      {message && <div className="message">{message}</div>}

      {editingLine && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Edit Bus Line</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setMessage(null)
              try {
                const startStopName = stops.find(s => String(s.id) === String(editingLine.startStop))?.name || editingLine.startStop
                const endStopName = stops.find(s => String(s.id) === String(editingLine.endStop))?.name || editingLine.endStop

                await client.patch(`/admin/bus-lines/${editingLine.id}`, {
                  lineNumber: Number(editingLine.lineNumber),
                  startStop: startStopName,
                  endStop: endStopName,
                  estimatedDurationMinutes: Number(editingLine.estimatedDurationMinutes),
                  description: editingLine.description,
                })

                setMessage('Bus line updated')
                setEditingLine(null)
                await loadBusLines()
              } catch (err) {
                setMessage('Error: ' + (err.response?.data?.error || err.message))
              }
            }} className="stack-form">
              <div className="form-row">
                <input value={editingLine.lineNumber} onChange={e => setEditingLine({...editingLine, lineNumber: e.target.value})} />
                <select value={editingLine.startStop} onChange={e => setEditingLine({...editingLine, startStop: e.target.value})}>
                  <option value="">Start stop</option>
                  {stops.map(stop => (
                    <option key={stop.id} value={stop.id}>#{stop.id} {stop.name}</option>
                  ))}
                </select>
                <select value={editingLine.endStop} onChange={e => setEditingLine({...editingLine, endStop: e.target.value})}>
                  <option value="">End stop</option>
                  {stops.map(stop => (
                    <option key={stop.id} value={stop.id}>#{stop.id} {stop.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <input value={editingLine.estimatedDurationMinutes} onChange={e => setEditingLine({...editingLine, estimatedDurationMinutes: e.target.value})} />
                <input value={editingLine.description} onChange={e => setEditingLine({...editingLine, description: e.target.value})} />
              </div>
              <div className="form-row" style={{ marginTop: '1rem' }}>
                <button className="secondary" type="button" onClick={() => setEditingLine(null)}>Cancel</button>
                <button type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Delete Bus Line?</h3>
            <p><strong>Lijn {deleteConfirm.lineNumber}</strong> ({deleteConfirm.startStop} → {deleteConfirm.endStop})</p>
            <p style={{ color: '#999', fontSize: '0.9rem' }}>This will also delete all stops on this line. Cannot be undone.</p>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <button className="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="danger" onClick={() => deleteBusLine(deleteConfirm.id, deleteConfirm.lineNumber)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const overlay = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modal = {
  backgroundColor: '#fff',
  padding: '2rem',
  borderRadius: '8px',
  maxWidth: '400px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
}
