import React, { useState, useEffect } from 'react'

const TimetableDisplay = ({ client, overviewDate, setOverviewDate, selectedDriverFilter, setSelectedDriverFilter, drivers }) => {
  const [overviewSchedules, setOverviewSchedules] = useState([])
  const [message, setMessage] = useState(null)
  const [expandedSchedule, setExpandedSchedule] = useState(null)
  const [routeStopsByLine, setRouteStopsByLine] = useState({})

  const loadOverviewSchedules = async () => {
    try {
      const params = new URLSearchParams({ date: overviewDate })
      if (selectedDriverFilter) {
        params.set('driverId', selectedDriverFilter)
      }

      const res = await client.get(`/schedules/overview?${params.toString()}`)
      setOverviewSchedules(res.data.schedules || [])
    } catch (err) {
      setMessage('Error loading timetable: ' + (err.response?.data?.error || err.message))
    }
  }

  useEffect(() => {
    loadOverviewSchedules()
  }, [overviewDate, selectedDriverFilter])

  const formatTime = (timeString) => {
    const date = new Date(timeString)
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }

  const loadRouteStops = async (busLineId) => {
    if (!busLineId) return
    try {
      const res = await client.get(`/admin/bus-lines/${busLineId}/stops`)
      const routeStops = res.data.routeStops || []
      setRouteStopsByLine(prev => ({ ...prev, [busLineId]: routeStops }))
    } catch (err) {
      // ignore silently
    }
  }

  const getWeekdayLabel = (weekdayValues) => {
    const WEEKDAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
    const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0]
    if (!weekdayValues || weekdayValues.length === 0) return 'Eenmalig'
    if (weekdayValues.length === 7) return 'Dagelijks'
    const labels = weekdayValues
      .slice()
      .sort((a, b) => a - b)
      .map(w => WEEKDAYS[WEEKDAY_VALUES.indexOf(w)])
    return labels.join(', ')
  }

  const timeSlots = (() => {
    const slots = []
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00-${String((hour + 1) % 24).padStart(2, '0')}:00`)
    }
    return slots
  })()

  const schedulesBySlot = (() => {
    const grouped = {}
    timeSlots.forEach(slot => {
      grouped[slot] = []
    })

    overviewSchedules.forEach(schedule => {
      const startHour = new Date(schedule.startTime).getHours()
      const slot = `${String(startHour).padStart(2, '0')}:00-${String((startHour + 1) % 24).padStart(2, '0')}:00`
      if (grouped[slot]) {
        grouped[slot].push(schedule)
      }
    })

    return grouped
  })()

  return (
    <section className="card" style={{ marginTop: '2rem' }}>
      <div className="section-header">
        <div>
          <h3>Dagelijks Overzicht</h3>
          <p>Alle geplande diensten voor de geselecteerde dag</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="date"
            value={overviewDate}
            onChange={e => setOverviewDate(e.target.value)}
          />
          <button type="button" onClick={() => setOverviewDate(new Date().toISOString().split('T')[0])}>
            Vandaag
          </button>
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
                          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                            {schedule.recurrenceLabel || getWeekdayLabel(schedule.weekdays)}
                          </div>
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
                                loadRouteStops(lineId)
                                return <p style={{ fontSize: '0.85rem', color: '#999' }}>Laden haltes...</p>
                              }

                              if (cached.length === 0) {
                                return <p style={{ fontSize: '0.85rem', color: '#999' }}>Geen haltes gekoppeld</p>
                              }

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
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              )
                            })()}
                          </div>
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
    </section>
  )
}

export default TimetableDisplay
