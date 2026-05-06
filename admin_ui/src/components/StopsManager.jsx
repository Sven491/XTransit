import React, { useEffect, useState } from 'react'
import { transitClient } from '../api'

export default function StopsManager({ token, user }) {
  const client = transitClient(token)
  const [stops, setStops] = useState([])
  const [name, setName] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [message, setMessage] = useState(null)
  const [isAdmin] = useState(Boolean(user?.userCode))

  const loadStops = async () => {
    try {
      const res = await client.get('/admin/stops')
      setStops(res.data.stops || [])
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
  }

  useEffect(() => {
    loadStops()
  }, [])

  const createStop = async (e) => {
    e.preventDefault()
    setMessage(null)
    try {
      const res = await client.post('/admin/stops', {
        name,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon)
      })
      setMessage('Stop created: #' + res.data.stop.id)
      setName(''); setLat(''); setLon('')
      await loadStops()
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message
      if (err.response?.status === 401) {
        setMessage('Unauthorized: invalid token')
      } else if (err.response?.status === 403) {
        setMessage('Forbidden: you are not an admin')
      } else {
        setMessage('Error: ' + errMsg)
      }
    }
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Stops</h2>
          <p>Maak herbruikbare haltes aan.</p>
        </div>
        <button className="secondary" onClick={loadStops}>Refresh</button>
      </div>
      <div className="list-grid">
        {stops.map(stop => (
          <article className="mini-card" key={stop.id}>
            <strong>#{stop.id} {stop.name}</strong>
            <div>{stop.latitude}, {stop.longitude}</div>
          </article>
        ))}
      </div>
      {isAdmin ? (
        <form onSubmit={createStop} className="stack-form">
          <div className="form-row">
          <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
          <input placeholder="Latitude" value={lat} onChange={e=>setLat(e.target.value)} />
          <input placeholder="Longitude" value={lon} onChange={e=>setLon(e.target.value)} />
          <button type="submit">Create Stop</button>
          </div>
        </form>
      ) : (
        <div>You must be admin to create stops.</div>
      )}
      
      {message && <div className="message">{message}</div>}
      <p>Note: To view stops per line, use the Bus Line Stops tool below.</p>
    </section>
  )
}
