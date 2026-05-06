import React, { useEffect, useState } from 'react'
import { transitClient } from '../api'

export default function ScheduleMaker({ token, user }) {
  const client = transitClient(token)
  const [schedules, setSchedules] = useState([])
  const [busLines, setBusLines] = useState([])
  const [buses, setBuses] = useState([])
  const [message, setMessage] = useState(null)
  const [isAdmin] = useState(Boolean(user?.userCode))
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Form state
  const [selectedLine, setSelectedLine] = useState('')
  const [selectedBus, setSelectedBus] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [driverId, setDriverId] = useState('')

  const loadSchedules = async () => {
    try {
      const res = await client.get('/admin/schedules')
      setSchedules(res.data.schedules || [])
    } catch (err) {
      setMessage('Error loading schedules: ' + (err.response?.data?.error || err.message))
    }
  }

  const loadBusLines = async () => {
    try {
      const res = await client.get('/admin/bus-lines')
      setBusLines(res.data.busLines || [])
    } catch (err) {
      setMessage('Error loading bus lines: ' + (err.response?.data?.error || err.message))
    }
  }

  const loadBuses = async () => {
    try {
      const res = await client.get('/admin/fleet/buses')
      setBuses(res.data.buses || [])
    } catch (err) {
      setMessage('Error loading buses: ' + (err.response?.data?.error || err.message))
    }
  }

  useEffect(() => {
    loadSchedules()
    loadBusLines()
    loadBuses()
  }, [])

  const createSchedule = async (e) => {
    e.preventDefault()
    setMessage(null)

    if (!selectedLine || !selectedBus || !startTime || !endTime) {
      setMessage('Alle velden zijn verplicht')
      return
    }

    try {
      const startDateTime = `${selectedDate}T${startTime}:00`
      const endDateTime = `${selectedDate}T${endTime}:00`

      const res = await client.post('/admin/schedules', {
        busLineId: Number(selectedLine),
        busId: Number(selectedBus),
        driverId: driverId ? Number(driverId) : null,
        startTime: startDateTime,
        endTime: endDateTime,
      })

      setMessage('Dienst aangemaakt: #' + res.data.schedule.id)
      setSelectedLine('')
      setSelectedBus('')
      setStartTime('08:00')
      setEndTime('17:00')
      setDriverId('')
      await loadSchedules()
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message
      setMessage('Error: ' + errMsg)
    }
  }

  const deleteSchedule = async (scheduleId, lineNumber, busName) => {
    setMessage(null)
    try {
      await client.delete(`/admin/schedules/${scheduleId}`)
      setMessage(`Dienst verwijderd: Lijn ${lineNumber}, ${busName}`)
      setDeleteConfirm(null)
      await loadSchedules()
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message
      setMessage('Error: ' + errMsg)
    }
  }

  // Group schedules by date and time
  const timeSlots = generateTimeSlots()
  const schedulesBySlot = groupSchedulesByTimeSlot(schedules, timeSlots)

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Diensten Inplannen</h2>
          <p>Maak diensten aan en wijs voertuigen en lijnen toe.</p>
        </div>
        <button className="secondary" onClick={loadSchedules}>Refresh</button>
      </div>

      {isAdmin && (
        <form onSubmit={createSchedule} className="stack-form">
          <div className="form-row">
            <select value={selectedLine} onChange={e => setSelectedLine(e.target.value)}>
              <option value="">Kies lijn</option>
              {busLines.map(line => (
                <option key={line.id} value={line.id}>
                  Lijn {line.lineNumber} ({line.startStop} → {line.endStop})
                </option>
              ))}
            </select>
            <select value={selectedBus} onChange={e => setSelectedBus(e.target.value)}>
              <option value="">Kies voertuig</option>
              {buses.map(bus => (
                <option key={bus.id} value={bus.id}>
                  {bus.name} ({bus.licensePlate})
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              placeholder="Start time"
            />
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              placeholder="End time"
            />
            <input
              type="text"
              value={driverId}
              onChange={e => setDriverId(e.target.value)}
              placeholder="Driver ID (optional)"
            />
          </div>
          <div className="form-row">
            <button type="submit">Create Service</button>
          </div>
        </form>
      )}

      <h3 style={{ marginTop: '2rem' }}>Timetable</h3>
      <div className="timetable-container">
        <table className="timetable">
          <thead>
            <tr>
              <th>Tijdvak</th>
              <th>Lijnen en Voertuigen</th>
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot, idx) => (
              <tr key={idx}>
                <td className="time-cell">{slot}</td>
                <td className="schedule-cell">
                  <div className="schedule-items">
                    {schedulesBySlot[slot]?.map(schedule => (
                      <article
                        key={schedule.id}
                        className="schedule-card"
                        draggable
                      >
                        <div className="schedule-header">
                          <strong>Lijn {schedule.lineNumber}</strong>
                          <span className="schedule-time">{formatTime(schedule.startTime)}</span>
                        </div>
                        <div className="schedule-details">
                          <div>{schedule.busName}</div>
                          <div className="schedule-plate">{schedule.licensePlate}</div>
                        </div>
                        {isAdmin && (
                          <button
                            className="danger"
                            style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.85rem', padding: '0.4rem' }}
                            onClick={() => setDeleteConfirm(schedule)}
                          >
                            Delete
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <div className="message">{message}</div>}

      {deleteConfirm && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Delete Service?</h3>
            <p>
              <strong>Lijn {deleteConfirm.lineNumber}</strong> - {deleteConfirm.busName} ({deleteConfirm.licensePlate})
            </p>
            <p style={{ color: '#999', fontSize: '0.9rem' }}>
              {new Date(deleteConfirm.startTime).toLocaleString()}
            </p>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <button className="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="danger"
                onClick={() =>
                  deleteSchedule(deleteConfirm.id, deleteConfirm.lineNumber, deleteConfirm.busName)
                }
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function generateTimeSlots() {
  const slots = []
  for (let hour = 0; hour < 24; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00-${String((hour + 1) % 24).padStart(2, '0')}:00`)
  }
  return slots
}

function groupSchedulesByTimeSlot(schedules, slots) {
  const grouped = {}
  slots.forEach(slot => {
    grouped[slot] = []
  })

  schedules.forEach(schedule => {
    const startHour = new Date(schedule.startTime).getHours()
    const slot = `${String(startHour).padStart(2, '0')}:00-${String((startHour + 1) % 24).padStart(2, '0')}:00`
    if (grouped[slot]) {
      grouped[slot].push(schedule)
    }
  })

  return grouped
}

function formatTime(timeString) {
  const date = new Date(timeString)
  return date.toLocaleTimeString('en-NL', { hour: '2-digit', minute: '2-digit' })
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
