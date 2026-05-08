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
  const [selectedDriverFilter, setSelectedDriverFilter] = useState('')
  const [message, setMessage] = useState(null)
  const [isAdmin] = useState(Boolean(user?.userCode))
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [expandedSchedule, setExpandedSchedule] = useState(null)
  const [routeStopsByLine, setRouteStopsByLine] = useState({})

  // Form state
  const [selectedLine, setSelectedLine] = useState('')
  const [selectedBus, setSelectedBus] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [overviewDate, setOverviewDate] = useState(new Date().toISOString().split('T')[0])
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
      const normalizedWeekdays = [...selectedWeekdays].sort((a, b) => a - b)

      const res = await client.post('/admin/schedules', {
        busLineId: Number(selectedLine),
        busId: Number(selectedBus),
        driverId: driverId ? Number(driverId) : null,
        startTime: startDateTime,
        weekdays: normalizedWeekdays,
      })

      const dayLabels = normalizedWeekdays.length > 0
        ? normalizedWeekdays.map(d => WEEKDAYS[WEEKDAY_VALUES.indexOf(d)]).join(', ')
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
      .slice()
      .sort((a, b) => a - b)
      .map(w => WEEKDAYS[WEEKDAY_VALUES.indexOf(w)])
    return labels.join(', ')
  }

  const formatTime = (timeString) => {
    const date = new Date(timeString)
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }

  // Fetch route stops for a given line and cache them in state
  const loadRouteStops = async (busLineId) => {
    if (!busLineId) return
    try {
      const res = await client.get(`/admin/bus-lines/${busLineId}/stops`)
      const routeStops = res.data.routeStops || []
      setRouteStopsByLine(prev => ({ ...prev, [busLineId]: routeStops }))
    } catch (err) {
      // ignore silently, message already used elsewhere
    }
  }

  const getCandidateWindow = () => {
    const line = busLines.find(l => String(l.id) === String(selectedLine))
    if (!line || !selectedDate || !startTime) return null

    const start = new Date(`${selectedDate}T${startTime}:00`)
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + (line.estimatedDurationMinutes || 60))
    return { start, end }
  }

  const hasOverlap = (candidate, existing) => {
    if (!candidate || !existing?.startTime || !existing?.endTime) return false

    const cStart = candidate.start.getTime()
    const cEnd = candidate.end.getTime()
    const eStart = new Date(existing.startTime).getTime()
    const eEnd = new Date(existing.endTime).getTime()
    const timeOverlap = cStart < eEnd && cEnd > eStart
    if (!timeOverlap) return false

    const cWeekdays = selectedWeekdays || []
    const eWeekdays = Array.isArray(existing.weekdays) ? existing.weekdays : []

    if (cWeekdays.length === 0 && eWeekdays.length === 0) {
      return candidate.start.toDateString() === new Date(existing.startTime).toDateString()
    }

    if (cWeekdays.length > 0 && eWeekdays.length > 0) {
      return cWeekdays.some(d => eWeekdays.includes(d))
    }

    if (cWeekdays.length > 0 && eWeekdays.length === 0) {
      return cWeekdays.includes(new Date(existing.startTime).getDay())
    }

    return eWeekdays.includes(candidate.start.getDay())
  }

  const candidateWindow = getCandidateWindow()
  const busyDriverIds = new Set(
    schedules
      .filter(s => s.driverId && hasOverlap(candidateWindow, s))
      .map(s => Number(s.driverId))
  )
  const busyBusIds = new Set(
    schedules
      .filter(s => s.busId && hasOverlap(candidateWindow, s))
      .map(s => Number(s.busId))
  )

  const scheduleHasDriverConflict = (schedule) => {
    if (!schedule?.driverId) return false
    return schedules.some(other =>
      other.id !== schedule.id &&
      Number(other.driverId) === Number(schedule.driverId) &&
      hasOverlap({ start: new Date(schedule.startTime), end: new Date(schedule.endTime) }, other)
    )
  }

  const scheduleHasBusConflict = (schedule) => {
    if (!schedule?.busId) return false
    return schedules.some(other =>
      other.id !== schedule.id &&
      Number(other.busId) === Number(schedule.busId) &&
      hasOverlap({ start: new Date(schedule.startTime), end: new Date(schedule.endTime) }, other)
    )
  }

  // Group schedules by date and time (apply driver filter if selected)
  const timeSlots = generateTimeSlots()
  const filteredSchedules = selectedDriverFilter
    ? schedules.filter(s => String(s.driverId) === String(selectedDriverFilter))
    : schedules
  const overviewSchedules = filteredSchedules.filter(schedule => {
    if (!overviewDate) return true
    const scheduleDate = new Date(schedule.startTime)
    const selectedOverview = new Date(`${overviewDate}T00:00:00`)
    return scheduleDate.getFullYear() === selectedOverview.getFullYear()
      && scheduleDate.getMonth() === selectedOverview.getMonth()
      && scheduleDate.getDate() === selectedOverview.getDate()
  })
  const schedulesBySlot = groupSchedulesByTimeSlot(overviewSchedules, timeSlots)

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Diensten Inplannen</h2>
          <p>Maak diensten aan met automatische eindtijd, vertrektijden per halte en herhaald rooster.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="secondary" onClick={loadSchedules}>Refresh</button>
          <select
            value={selectedDriverFilter}
            onChange={e => setSelectedDriverFilter(e.target.value)}
            style={{ padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }}
          >
            <option value="">Alle chauffeurs</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
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
                <option key={bus.id} value={bus.id} disabled={busyBusIds.has(Number(bus.id))}>
                  {bus.name} ({bus.licensePlate}) {busyBusIds.has(Number(bus.id)) ? '- in gebruik' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <select value={driverId} onChange={e => setDriverId(e.target.value)}>
              <option value="">Bestuurder (optioneel)</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id} disabled={busyDriverIds.has(Number(driver.id))}>
                  {driver.name} {busyDriverIds.has(Number(driver.id)) ? '- in gebruik' : ''}
                </option>
              ))}
            </select>
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
      <div className="form-row" style={{ marginBottom: '1rem' }}>
        <input
          type="date"
          value={overviewDate}
          onChange={e => setOverviewDate(e.target.value)}
        />
        <button type="button" onClick={() => setOverviewDate(new Date().toISOString().split('T')[0])}>
          Vandaag
        </button>
      </div>
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
                          {scheduleHasDriverConflict(schedule) && (
                            <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.25rem', fontWeight: 600 }}>
                              Chauffeur in gebruik
                            </div>
                          )}
                          {scheduleHasBusConflict(schedule) && (
                            <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.25rem', fontWeight: 600 }}>
                              Voertuig in gebruik
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
                            {(() => {
                              const lineId = schedule.busLineId
                              const cached = routeStopsByLine[lineId]
                              if (!cached) {
                                // Load and show loading text
                                loadRouteStops(lineId)
                                return <p style={{ fontSize: '0.85rem', color: '#999' }}>Laden haltes...</p>
                              }

                              if (cached.length === 0) {
                                return <p style={{ fontSize: '0.85rem', color: '#999' }}>Geen haltes gekoppeld</p>
                              }

                              // Render editable list of stops with ETA inputs
                              return (
                                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                                  <tbody>
                                    {cached.map(rs => {
                                      const departureDate = new Date(schedule.startTime)
                                      departureDate.setMinutes(departureDate.getMinutes() + (rs.estimatedArrivalMinutes || 0))
                                      return (
                                        <tr key={rs.id}>
                                          <td style={{ paddingRight: '0.5rem' }}><strong>{rs.stopOrder}.</strong></td>
                                          <td style={{ flex: 1 }}>{rs.name}</td>
                                          <td style={{ textAlign: 'right', color: '#666' }}>{formatTime(departureDate.toISOString())}</td>
                                          <td style={{ paddingLeft: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <input
                                                type="range"
                                                min="0"
                                                max="240"
                                                value={Number(rs.estimatedArrivalMinutes ?? 0)}
                                                onChange={e => {
                                                  const val = Number(e.target.value)
                                                  setRouteStopsByLine(prev => ({
                                                    ...prev,
                                                    [lineId]: prev[lineId].map(item => item.id === rs.id ? { ...item, estimatedArrivalMinutes: val } : item)
                                                  }))
                                                }}
                                                style={{ width: '8rem' }}
                                              />
                                              <input
                                                type="number"
                                                value={Number(rs.estimatedArrivalMinutes ?? 0)}
                                                onChange={e => {
                                                  const val = e.target.value === '' ? 0 : Number(e.target.value)
                                                  setRouteStopsByLine(prev => ({
                                                    ...prev,
                                                    [lineId]: prev[lineId].map(item => item.id === rs.id ? { ...item, estimatedArrivalMinutes: val } : item)
                                                  }))
                                                }}
                                                style={{ width: '4.5rem' }}
                                              />
                                            </div>
                                            <button type="button" onClick={async () => {
                                              const newVal = Number((routeStopsByLine[lineId].find(i => i.id === rs.id)?.estimatedArrivalMinutes) || 0)
                                              try {
                                                await client.post(`/admin/bus-lines/${lineId}/stops`, {
                                                  stopId: rs.stopId,
                                                  stopOrder: rs.stopOrder,
                                                  estimatedArrivalMinutes: newVal,
                                                })
                                                setMessage('ETA updated')
                                                await loadRouteStops(lineId)
                                                await loadSchedules()
                                              } catch (err) {
                                                setMessage('Error: ' + (err.response?.data?.error || err.message))
                                              }
                                            }} style={{ marginLeft: '0.5rem' }}>Save</button>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              )
                            })()}
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
