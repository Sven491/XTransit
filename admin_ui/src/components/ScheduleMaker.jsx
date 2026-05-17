import React, { useEffect, useState } from 'react'
import { transitClient } from '../api'
import TimetableDisplay from './TimetableDisplay'
import FixedScheduleEditor from './FixedScheduleEditor'

export default function ScheduleMaker({ token, user }) {
  const client = transitClient(token)
  const [scheduleTemplates, setScheduleTemplates] = useState([])
  const [busLines, setBusLines] = useState([])
  const [buses, setBuses] = useState([])
  const [drivers, setDrivers] = useState([])
  const [selectedDriverFilter, setSelectedDriverFilter] = useState('')
  const [message, setMessage] = useState(null)
  const [isAdmin] = useState(Boolean(user?.isAdmin))
  const [overviewDate, setOverviewDate] = useState(new Date().toISOString().split('T')[0])

  const loadScheduleTemplates = async () => {
    try {
      const res = await client.get('/admin/schedules?templates=1')
      setScheduleTemplates((res.data.schedules || []).filter(schedule => Array.isArray(schedule.weekdays) && schedule.weekdays.length > 0))
    } catch (err) {
      setMessage('Error loading fixed schedules: ' + (err.response?.data?.error || err.message))
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
    loadScheduleTemplates()
    loadBusLines()
    loadBuses()
    loadDrivers()
  }, [])

  const handleScheduleChange = async () => {
    await loadScheduleTemplates()
  }

  return (
    <div>
      {/* Timetable widget - compact daily view */}
      <TimetableDisplay
        client={client}
        overviewDate={overviewDate}
        setOverviewDate={setOverviewDate}
        selectedDriverFilter={selectedDriverFilter}
        setSelectedDriverFilter={setSelectedDriverFilter}
        drivers={drivers}
      />

      {/* Fixed service editor - separate widget */}
      {isAdmin && (
        <FixedScheduleEditor
          client={client}
          token={token}
          user={user}
          scheduleTemplates={scheduleTemplates}
          busLines={busLines}
          buses={buses}
          drivers={drivers}
          message={message}
          setMessage={setMessage}
          onScheduleChange={handleScheduleChange}
        />
      )}
    </div>
  )
}
