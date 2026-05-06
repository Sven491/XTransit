import React, { useEffect, useMemo, useState } from 'react'
import { transitClient } from '../api'

export default function LinkStop({ token, user }) {
  const client = transitClient(token)
  const [busLines, setBusLines] = useState([])
  const [availableStops, setAvailableStops] = useState([])
  const [busLineId, setBusLineId] = useState('')
  const [stopId, setStopId] = useState('')
  const [eta, setEta] = useState('')
  const [message, setMessage] = useState(null)
  const [stops, setStops] = useState([])
  const [draggedItem, setDraggedItem] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const isAdmin = Boolean(user?.userCode)

  const nextOrder = useMemo(() => stops.length + 1, [stops])

  const loadBusLines = async () => {
    try {
      const res = await client.get('/admin/bus-lines')
      setBusLines(res.data.busLines || [])
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  const loadStopsForLine = async (lineId = busLineId) => {
    if (!lineId) return
    setMessage(null)
    try {
      const res = await client.get(`/bus-lines/${lineId}/stops`)
      setStops(res.data.stops || [])
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  const loadAvailableStops = async () => {
    try {
      const res = await client.get('/admin/stops')
      setAvailableStops(res.data.stops || [])
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  const refreshBoard = async () => {
    await Promise.all([
      loadBusLines(),
      loadAvailableStops(),
      loadStopsForLine(),
    ])
  }

  useEffect(() => {
    loadBusLines()
    loadAvailableStops()
  }, [])

  useEffect(() => {
    loadStopsForLine()
  }, [busLineId])

  const link = async (e) => {
    e.preventDefault()
    setMessage(null)
    try {
      const res = await client.post(`/admin/bus-lines/${busLineId}/stops`, {
        stopId: parseInt(stopId, 10),
        stopOrder: nextOrder,
        estimatedArrivalMinutes: eta ? parseInt(eta, 10) : null,
      })
      setMessage('Linked: ' + res.data.routeStop.id)
      setStopId('')
      await loadStopsForLine()
    } catch (err) {
      if (err.response?.status === 403) setMessage('Forbidden: not admin')
      else setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  const appendDraggedStop = async (stopToLink) => {
    if (!busLineId) {
      setMessage('Select a bus line first')
      return
    }

    setMessage(null)
    try {
      const res = await client.post(`/admin/bus-lines/${busLineId}/stops`, {
        stopId: Number(stopToLink.id),
        stopOrder: nextOrder,
        estimatedArrivalMinutes: eta ? parseInt(eta, 10) : null,
      })
      setMessage(`Linked: ${stopToLink.name} as stop #${res.data.routeStop.stopOrder}`)
      await loadStopsForLine()
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  const persistOrder = async (orderedStops) => {
    const res = await client.post(`/admin/bus-lines/${busLineId}/stops/reorder`, {
      routeStopIds: orderedStops.map(stop => stop.id),
    })
    setStops(res.data.routeStops || orderedStops)
  }

  const reorderStops = async (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return
    const fromIndex = stops.findIndex(stop => stop.id === fromId)
    const toIndex = stops.findIndex(stop => stop.id === toId)
    if (fromIndex < 0 || toIndex < 0) return

    const nextStops = [...stops]
    const [moved] = nextStops.splice(fromIndex, 1)
    nextStops.splice(toIndex, 0, moved)
    const normalized = nextStops.map((stop, index) => ({ ...stop, order: index + 1 }))
    setStops(normalized)
    setMessage('Saving new route order...')
    try {
      await persistOrder(normalized)
      setMessage('Route order updated')
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
      await loadStopsForLine()
    }
  }

  const moveStop = async (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= stops.length) return
    const nextStops = [...stops]
    const [moved] = nextStops.splice(index, 1)
    nextStops.splice(targetIndex, 0, moved)
    const normalized = nextStops.map((stop, nextIndex) => ({ ...stop, order: nextIndex + 1 }))
    setStops(normalized)
    try {
      await persistOrder(normalized)
      setMessage('Route order updated')
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
      await loadStopsForLine()
    }
  }

  const deleteRouteStop = async (routeStopId, stopName) => {
    setMessage(null)
    try {
      await client.delete(`/admin/bus-lines/${busLineId}/stops/${routeStopId}`)
      setMessage(`Halte "${stopName}" verwijderd uit de lijn`)
      setDeleteConfirm(null)
      await loadStopsForLine()
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message
      setMessage('Error: ' + errMsg)
    }
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Stops per lijn</h2>
          <p>Koppel stops aan lijnen en bekijk de volgorde.</p>
        </div>
        <button className="secondary" onClick={refreshBoard}>Refresh</button>
      </div>

      <div className="form-row">
        <select
          value={busLineId}
          onChange={e => setBusLineId(e.target.value)}
        >
          <option value="">Choose line</option>
          {busLines.map(line => (
            <option key={line.id} value={line.id}>
              #{line.id} lijn {line.lineNumber} - {line.startStop} → {line.endStop}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => loadStopsForLine()} disabled={!busLineId}>Load Stops</button>
      </div>

      <div className="muted" style={{ marginBottom: 10 }}>
        Drag a stop onto the route board to append it to the line. Use the arrows to nudge the order.
      </div>

      <div
        className={`route-stops-board ${draggedItem?.type === 'available' ? 'drop-ready' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (draggedItem?.type === 'available') {
            const stop = availableStops.find(item => Number(item.id) === Number(draggedItem.id))
            if (stop) appendDraggedStop(stop)
          }
          setDraggedItem(null)
        }}
      >
        {stops.map((s, index) => (
          <article
            className={`route-stop-item ${draggedItem?.type === 'route' && Number(draggedItem.id) === Number(s.id) ? 'dragging' : ''}`}
            key={s.id}
            draggable
            onDragStart={() => setDraggedItem({ type: 'route', id: s.id })}
            onDragEnd={() => setDraggedItem(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedItem?.type === 'route') {
                reorderStops(draggedItem.id, s.id)
              }
              if (draggedItem?.type === 'available') {
                const stop = availableStops.find(item => Number(item.id) === Number(draggedItem.id))
                if (stop) appendDraggedStop(stop)
              }
              setDraggedItem(null)
            }}
          >
            <div className="route-stop-handle" aria-hidden="true">⋮⋮</div>
            <div className="route-stop-content">
              <strong>{s.order}. {s.name}</strong>
              <div className="muted">{s.latitude}, {s.longitude}</div>
              {s.estimatedArrivalMinutes !== null && s.estimatedArrivalMinutes !== undefined ? (
                <div className="muted">ETA {s.estimatedArrivalMinutes} min</div>
              ) : null}
            </div>
            <div className="route-stop-actions">
              <button type="button" className="secondary" onClick={() => moveStop(index, -1)} disabled={index === 0}>↑</button>
              <button type="button" className="secondary" onClick={() => moveStop(index, 1)} disabled={index === stops.length - 1}>↓</button>
              {isAdmin && (
                <button type="button" className="danger" onClick={() => setDeleteConfirm({ id: s.id, name: s.name })}>✕</button>
              )}
            </div>
          </article>
        ))}
      </div>

      <h3>Beschikbare haltes</h3>
      <div className="available-stops-grid">
        {availableStops.map(stop => (
          <article
            key={stop.id}
            className={`mini-card available-stop ${draggedItem?.type === 'available' && Number(draggedItem.id) === Number(stop.id) ? 'dragging' : ''}`}
            draggable
            onDragStart={() => setDraggedItem({ type: 'available', id: stop.id })}
            onDragEnd={() => setDraggedItem(null)}
            onClick={() => {
              if (busLineId) {
                setStopId(String(stop.id))
                appendDraggedStop(stop)
              }
            }}
            role="button"
            tabIndex={0}
          >
            <strong>#{stop.id} {stop.name}</strong>
            <div className="muted">{stop.latitude}, {stop.longitude}</div>
            <div className="muted">Sleep of klik om toe te voegen</div>
          </article>
        ))}
      </div>

      <h3>Link a Stop to Line</h3>
      {isAdmin ? (
        <form onSubmit={link} className="stack-form">
          <div className="form-row">
            <select value={stopId} onChange={e=>setStopId(e.target.value)}>
              <option value="">Select stop</option>
              {availableStops.map(stop => (
                <option key={stop.id} value={stop.id}>
                  #{stop.id} {stop.name}
                </option>
              ))}
            </select>
            <input value={`Next order: ${nextOrder}`} readOnly />
            <input placeholder="ETA minutes (optional)" value={eta} onChange={e=>setEta(e.target.value)} />
          </div>
          <div className="form-row">
            <button type="submit">Link Stop</button>
          </div>
        </form>
      ) : (
        <div>You must be admin to link stops.</div>
      )}
      {message && <div className="message">{message}</div>}

      {deleteConfirm && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Remove Stop from Line?</h3>
            <p><strong>{deleteConfirm.name}</strong></p>
            <p style={{ color: '#999', fontSize: '0.9rem' }}>This will remove the stop from the route and re-order the remaining stops.</p>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <button className="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="danger" onClick={() => deleteRouteStop(deleteConfirm.id, deleteConfirm.name)}>
                Remove
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
