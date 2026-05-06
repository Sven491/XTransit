import React, { useEffect, useState } from 'react'

export default function TimetableViewer({ apiBaseUrl = 'http://localhost:5001' }) {
  const [schedules, setSchedules] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedLineId, setSelectedLineId] = useState('')
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch available bus lines
  useEffect(() => {
    const fetchLines = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/admin/bus-lines`)
        const data = await res.json()
        setLines(data.busLines || [])
      } catch (err) {
        console.error('Failed to load lines:', err)
      }
    }
    fetchLines()
  }, [apiBaseUrl])

  // Fetch schedules based on date and line filter
  useEffect(() => {
    const fetchSchedules = async () => {
      setLoading(true)
      setError(null)
      try {
        let url = `${apiBaseUrl}/schedules?date=${selectedDate}`
        if (selectedLineId) {
          url += `&lineId=${selectedLineId}`
        }
        const res = await fetch(url)
        const data = await res.json()
        setSchedules(data.schedules || [])
      } catch (err) {
        setError('Failed to load schedules: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchSchedules()
  }, [selectedDate, selectedLineId, apiBaseUrl])

  const timeSlots = generateTimeSlots()
  const schedulesBySlot = groupSchedulesByTimeSlot(schedules, timeSlots)

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Public Transit Timetable</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        <select
          value={selectedLineId}
          onChange={e => setSelectedLineId(e.target.value)}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', minWidth: '200px' }}
        >
          <option value="">All lines</option>
          {lines.map(line => (
            <option key={line.id} value={line.id}>
              Line {line.lineNumber} ({line.startStop} → {line.endStop})
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Loading schedules...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead style={{ backgroundColor: '#f1f5f9' }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Time</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Line</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Vehicle</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot, idx) => {
            const slotSchedules = schedulesBySlot[slot] || []
            if (slotSchedules.length === 0) return null
            return slotSchedules.map((schedule, sidx) => (
              <tr key={`${idx}-${sidx}`} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>
                  {sidx === 0 ? slot : ''}
                </td>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#4f46e5' }}>
                  Line {schedule.lineNumber}
                </td>
                <td style={{ padding: '12px' }}>
                  {schedule.busName} ({schedule.licensePlate})
                </td>
                <td style={{ padding: '12px' }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: schedule.status === 'active' ? '#dcfce7' : '#f3f4f6',
                      color: schedule.status === 'active' ? '#166534' : '#374151',
                      fontSize: '0.9rem',
                    }}
                  >
                    {schedule.status}
                  </span>
                </td>
              </tr>
            ))
          })}
        </tbody>
      </table>

      {schedules.length === 0 && !loading && (
        <p style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>
          No schedules found for the selected date and line.
        </p>
      )}
    </div>
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
