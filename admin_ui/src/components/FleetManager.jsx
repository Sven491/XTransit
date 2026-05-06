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

  const loadBuses = async () => {
    try {
      const res = await client.get('/admin/fleet/buses')
      setBuses(res.data.buses || [])
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message))
    }
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
    </section>
  )
}
