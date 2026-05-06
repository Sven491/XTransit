import React, { useEffect, useState } from 'react'
import { transitClient } from '../api'

const WEEKDAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0] // 0=Sun, 1=Mon...

export default function ScheduleMaker({ token, user }) {
  const client = transitClient(token)
  const [schedules, setSchedules] = useState([])
  const [busLines, setBusLines] = useState([])
  const [buses, setBuses] = useState([])
  const [drivers, setDrivers] = useState([])
  const [message, setMessage] = useState(null)
  const [isAdmin] = useState(Boolean(user?.userCode))
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [expandedSchedule, setExpandedSchedule] = useState(null)

  // Form state
  const [selectedLine, setSelectedLine] = useState('')
  const [selectedBus, setSelectedBus] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('08:00')
  const [driverId, setDriverId] = useState('')
  const [selectedWeekdays, setSelectedWeekdays] = useState([])

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

  const loadDrivers = async () => {
    try {
      const res = await client.get('/admin/drivers')
      setDrivers(res.data.drivers || [])
    } catch (err) {
      setMessage('Error loading drivers: ' + (err.response?.data?.error || err.message))
    }
  }

  useEffect(() => {
    loadSchedules()
    loadBusLines()
    loadBuses()
    loadDrivers()
  }, [])

  const createSchedule = async (e) => {
    e.preventDefault()
    setMessage(null)

    if (!selectedLine || !selectedBus || !startTime) {
      setMessage('Lijn, voertuig en start-tijd zijn verplicht')
      return
    }

    try {
      const startDateTime = `${selectedDate}T${startTime}:00`

      const res = await client.post('/admin/schedules', {
        busLineId: Number(selectedLine),
        busId: Number(selectedBus),
        driverId: driverId ? Number(driverId) : null,
        startTime: startDateTime,
        weekdays: selectedWeekdays,
      })

      const dayLabels = selectedWeekdays.length > 0
        ? selectedWeekdays.map(d => WEEKDAYS[WEEKDAY_VALUES.indexOf(d)]).join(', ')
        : 'eenmalig'
      setMessage(`Dienst aangemaakt: #${res.data.schedule.id} (${dayLabels})`)
      setSelectedLine('')
      setSelectedBus('')
      setStartTime('08:00')
      setDriverId('')
      setSelectedWeekdays([])
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

  const toggleWeekday = (dayValue) => {
    setSelectedWeekdays(prev =>
      prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue]
    )
  }

  const getWeekdayLabel = (weekdayValues) => {
    if (!weekdayValues || weekdayValues.length === 0) return 'Eenmalig'
    if (weekdayValues.length === 7) return 'Dagelijks'
    const labels = weekdayValues
      .sort()
      .map(w => WEEKDAYS[WEEKDAY_VALUES.indexOf(w)])
    return labels.join(', ')
  }

  const formatTime = (timeString) => {
    const date = new Date(timeString)
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }

  // Group schedules by date and time
  const timeSlots = generateTimeSlots()
  const schedulesBySlot = groupSchedulesByTimeSlot(schedules, timeSlots)

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Diensten Inplannen</h2>
          <p>Maak diensten aan met automatische eindtijd, vertrektijden per halte en herhaald rooster.</p>
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
            <select value={driverId} onChange={e => setDriverId(e.target.value)}>
              <option value="">Bestuurder (optioneel)</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
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
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Herhaal op weekdagen (optioneel):
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {WEEKDAYS.map((day, idx) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeekday(WEEKDAY_VALUES[idx])}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: selectedWeekdays.includes(WEEKDAY_VALUES[idx]) ? '#1D4ED8' : '#e0e0e0',
                    color: selectedWeekdays.includes(WEEKDAY_VALUES[idx]) ? '#fff' : '#000',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <button type="submit">Dienst Aanmaken</button>
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
                        style={{ position: 'relative' }}
                      >
                        <div className="schedule-header">
                          <strong>Lijn {schedule.lineNumber}</strong>
                          <span className="schedule-time">
                            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                          </span>
                        </div>
                        <div className="schedule-details">
                          <div>{schedule.busName}</div>
                          <div className="schedule-plate">{schedule.licensePlate}</div>
                          {schedule.driverName && (
                            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                              {schedule.driverName}
                            </div>
                          )}
                          {schedule.weekdays && schedule.weekdays.length > 0 && (
                            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                              {getWeekdayLabel(schedule.weekdays)}
                            </div>
                          )}
                        </div>

                        {/* Expandable stops list */}
                        <button
                          type="button"
                          onClick={() => setExpandedSchedule(expandedSchedule === schedule.id ? null : schedule.id)}
                          style={{
                            marginTop: '0.5rem',
                            width: '100%',
                            padding: '0.4rem',
                            fontSize: '0.85rem',
                            backgroundColor: '#f0f0f0',
                            border: '1px solid #ddd',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                        >
                          {expandedSchedule === schedule.id ? '▼' : '▶'} Haltes ({schedule.departureTimes?.length || 0})
                        </button>

                        {expandedSchedule === schedule.id && (
                          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #eee' }}>
                            {schedule.departureTimes && schedule.departureTimes.length > 0 ? (
                              <table style={{ width: '100%', fontSize: '0.8rem' }}>
                                <tbody>
                                  {schedule.departureTimes.map(stop => (
                                    <tr key={stop.stopId}>
                                      <td style={{ paddingRight: '0.5rem' }}>
                                        <strong>{stop.order}.</strong>
                                      </td>
                                      <td style={{ flex: 1 }}>{stop.stopName}</td>
                                      <td style={{ textAlign: 'right', color: '#666' }}>
                                        {formatTime(stop.departureTime)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ fontSize: '0.85rem', color: '#999' }}>Geen haltes gekoppeld</p>
                            )}
                          </div>
                        )}

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
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
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
