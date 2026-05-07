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
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [editingStop, setEditingStop] = useState(null)


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

  const deleteStop = async (stopId, stopName) => {
    setMessage(null)
    try {
      await client.delete(`/admin/stops/${stopId}`)
      setMessage(`Halte "${stopName}" verwijderd`)
      setDeleteConfirm(null)
      await loadStops()
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message
      setMessage('Error: ' + errMsg)
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
            {isAdmin && (
              <button 
                className="danger" 
                onClick={() => setDeleteConfirm(stop)}
                style={{ marginTop: '0.5rem', width: '100%' }}
              >
                Delete
              </button>
            )}
            {isAdmin && (
              <button
                className="secondary"
                onClick={() => setEditingStop(stop)}
                style={{ marginTop: '0.5rem', width: '100%' }}
              >
                Edit
              </button>
            )}
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

      {deleteConfirm && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Delete Stop?</h3>
            <p><strong>{deleteConfirm.name}</strong></p>
            <p style={{ color: '#999', fontSize: '0.9rem' }}>This cannot be undone.</p>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <button className="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="danger" onClick={() => deleteStop(deleteConfirm.id, deleteConfirm.name)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {editingStop && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Edit Stop</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setMessage(null)
              try {
                const res = await client.patch(`/admin/stops/${editingStop.id}`, {
                  name: editingStop.name,
                  latitude: parseFloat(editingStop.latitude),
                  longitude: parseFloat(editingStop.longitude),
                })
                setMessage('Stop updated')
                setEditingStop(null)
                await loadStops()
              } catch (err) {
                setMessage('Error: ' + (err.response?.data?.error || err.message))
              }
            }} className="stack-form">
              <div className="form-row">
                <input value={editingStop.name} onChange={e => setEditingStop({...editingStop, name: e.target.value})} />
                <input value={editingStop.latitude} onChange={e => setEditingStop({...editingStop, latitude: e.target.value})} />
                <input value={editingStop.longitude} onChange={e => setEditingStop({...editingStop, longitude: e.target.value})} />
              </div>
              <div className="form-row" style={{ marginTop: '1rem' }}>
                <button className="secondary" type="button" onClick={() => setEditingStop(null)}>Cancel</button>
                <button type="submit">Save</button>
              </div>
            </form>
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
