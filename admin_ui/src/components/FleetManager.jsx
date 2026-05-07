import React, { useEffect, useState } from 'react'
import { transitClient } from '../api'

export default function FleetManager({ token, user }) {
  const client = transitClient(token)
  const [buses, setBuses] = useState([])
  const [name, setName] = useState('')
  const [seatCapacity, setSeatCapacity] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [message, setMessage] = useState(null)
  const [canCreateBus, setCanCreateBus] = useState(true)
  const [isAdmin] = useState(Boolean(user?.userCode))
  const [editingBus, setEditingBus] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadBuses = async () => {
    try {
      const res = await client.get('/admin/fleet/buses')
      setBuses(res.data.buses || [])
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
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

  useEffect(() => {
    loadBuses()
  }, [])

  const createBus = async (e) => {
    e.preventDefault()
    setMessage(null)
    try {
      const res = await client.post('/admin/fleet/buses', {
        name,
        seatCapacity: Number(seatCapacity),
        licensePlate,
      })
      setName('')
      setSeatCapacity('')
      setLicensePlate('')
      setMessage('Bus created: #' + (res.data.bus?.id || 'ok'))
      await loadBuses()
    } catch (err) {
      const details = err.response?.data?.details || err.response?.data?.error || err.message
      if (String(details).includes('permission denied') || err.response?.status === 403) {
        setCanCreateBus(false)
        setMessage('Fleet create is read-only on this database user.')
        return
      }
      setMessage('Error: ' + details)
    }
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Fleet</h2>
          <p>Beheer voertuigen voor de vloot.</p>
        </div>
        <button className="secondary" onClick={loadBuses}>Refresh</button>
      </div>

      <div className="list-grid">
        {buses.map(bus => (
          <article className="mini-card" key={bus.id}>
            <strong>#{bus.id} {bus.name}</strong>
            <div>Seats: {bus.seatCapacity}</div>
            <div>Plate: {bus.licensePlate}</div>
            {isAdmin && (
              <>
                <button className="secondary" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => setEditingBus(bus)}>Edit</button>
                <button className="danger" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => setDeleteConfirm(bus)}>Delete</button>
              </>
            )}
          </article>
        ))}
      </div>

      {isAdmin && canCreateBus ? (
        <form onSubmit={createBus} className="stack-form">
          <div className="form-row">
            <input placeholder="Bus name" value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="Seat capacity" value={seatCapacity} onChange={e => setSeatCapacity(e.target.value)} />
            <input placeholder="License plate" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} />
            <button type="submit">Create bus</button>
          </div>
        </form>
      ) : (
        <div className="muted">Fleet create is read-only on this database user.</div>
      )}

      {message && <div className="message">{message}</div>}

      {editingBus && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Edit Bus</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setMessage(null)
              try {
                await client.patch(`/admin/fleet/buses/${editingBus.id}`, {
                  name: editingBus.name,
                  seatCapacity: Number(editingBus.seatCapacity),
                  licensePlate: editingBus.licensePlate,
                })
                setMessage('Bus updated')
                setEditingBus(null)
                await loadBuses()
              } catch (err) {
                setMessage('Error: ' + (err.response?.data?.error || err.message))
              }
            }} className="stack-form">
              <div className="form-row">
                <input value={editingBus.name} onChange={e => setEditingBus({...editingBus, name: e.target.value})} />
                <input value={editingBus.seatCapacity} onChange={e => setEditingBus({...editingBus, seatCapacity: e.target.value})} />
                <input value={editingBus.licensePlate} onChange={e => setEditingBus({...editingBus, licensePlate: e.target.value})} />
              </div>
              <div className="form-row" style={{ marginTop: '1rem' }}>
                <button className="secondary" type="button" onClick={() => setEditingBus(null)}>Cancel</button>
                <button type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Delete Bus?</h3>
            <p><strong>{deleteConfirm.name}</strong></p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="danger" onClick={async () => {
                try {
                  await client.delete(`/admin/fleet/buses/${deleteConfirm.id}`)
                  setMessage('Bus deleted')
                  setDeleteConfirm(null)
                  await loadBuses()
                } catch (err) {
                  setMessage('Error: ' + (err.response?.data?.error || err.message))
                }
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
