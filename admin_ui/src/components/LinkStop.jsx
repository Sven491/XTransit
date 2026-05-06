import React, { useEffect, useState } from 'react'
import { transitClient } from '../api'

export default function LinkStop({ token, user }) {
  const client = transitClient(token)
  const [busLines, setBusLines] = useState([])
  const [busLineId, setBusLineId] = useState('')
  const [stopId, setStopId] = useState('')
  const [order, setOrder] = useState('')
  const [eta, setEta] = useState('')
  const [message, setMessage] = useState(null)
  const [stops, setStops] = useState([])

  const isAdmin = Boolean(user?.userCode)

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

  useEffect(() => {
    loadBusLines()
  }, [])

  const link = async (e) => {
    e.preventDefault()
    setMessage(null)
    try {
      const res = await client.post(`/admin/bus-lines/${busLineId}/stops`, {
        stopId: parseInt(stopId,10),
        stopOrder: parseInt(order,10),
        estimatedArrivalMinutes: eta ? parseInt(eta,10) : null
      })
      setMessage('Linked: ' + res.data.routeStop.id)
      await loadStopsForLine()
    } catch (err) {
      if (err.response?.status === 403) setMessage('Forbidden: not admin')
      else setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Stops per lijn</h2>
          <p>Koppel stops aan lijnen en bekijk de volgorde.</p>
        </div>
        <button className="secondary" onClick={() => loadStopsForLine()}>Refresh</button>
      </div>

      <div className="form-row">
        <input
          placeholder="Bus line ID"
          value={busLineId}
          onChange={e => {
            setBusLineId(e.target.value)
          }}
        />
        <button type="button" onClick={() => loadStopsForLine()}>Load Stops</button>
      </div>

      {busLines.length > 0 && (
        <div className="muted" style={{ marginBottom: 10 }}>
          Known lines: {busLines.map(line => `#${line.id} (lijn ${line.lineNumber})`).join(', ')}
        </div>
      )}

      <ul>
        {stops.map(s => (
          <li key={s.id}>{s.order}. {s.name} ({s.latitude}, {s.longitude})</li>
        ))}
      </ul>

      <h3>Link a Stop to Line</h3>
      {isAdmin ? (
        <form onSubmit={link} className="form-row">
          <input placeholder="Stop ID" value={stopId} onChange={e=>setStopId(e.target.value)} />
          <input placeholder="Stop Order" value={order} onChange={e=>setOrder(e.target.value)} />
          <input placeholder="ETA minutes (optional)" value={eta} onChange={e=>setEta(e.target.value)} />
          <button type="submit">Link Stop</button>
        </form>
      ) : (
        <div>You must be admin to link stops.</div>
      )}
      {message && <div className="message">{message}</div>}
    </section>
  )
}
