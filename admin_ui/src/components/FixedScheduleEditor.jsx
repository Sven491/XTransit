import React, { useEffect, useMemo, useState } from 'react'

const WEEKDAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0] // 0=Sun, 1=Mon...

const QUICK_PRESETS = [
  { label: 'Werkdag', weekdays: [1, 2, 3, 4, 5] },
  { label: 'Weekend', weekdays: [0, 6] },
  { label: 'Dagelijks', weekdays: [0, 1, 2, 3, 4, 5, 6] },
]

const SERVICE_PRESETS = [
  { label: 'Ochtendspits', start: '06:00', end: '09:00', intervalMinutes: 15 },
  { label: 'Middagslag', start: '12:00', end: '16:00', intervalMinutes: 30 },
  { label: 'Avondspits', start: '16:00', end: '20:00', intervalMinutes: 20 },
]

const getPresetStorageKey = (user) => `transit.fixedSchedulePresets.${user?.userCode || 'guest'}`

const toInputDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString().split('T')[0]
  return date.toISOString().split('T')[0]
}

const toInputTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '08:00'
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

const normalizeTime = (value) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':')
    return `${String(Number(hours)).padStart(2, '0')}:${minutes}`
  }
  return ''
}

const parseTimeToMinutes = (time) => {
  const normalized = normalizeTime(time)
  if (!normalized) return null
  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

const addMinutesToTime = (time, minutesToAdd) => {
  const normalized = normalizeTime(time)
  if (!normalized || !Number.isFinite(Number(minutesToAdd))) return null
  const mins = parseTimeToMinutes(normalized)
  if (mins === null) return null
  const total = (mins + Number(minutesToAdd))
  const hours = Math.floor((total % (24 * 60)) / 60)
  const minutes = (total % 60 + 60) % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const buildTimeRange = (start, end, intervalMinutes, allowWrap = false) => {
  const normalizedStart = normalizeTime(start)
  const normalizedEnd = normalizeTime(end)
  const step = Number(intervalMinutes)

  if (!normalizedStart || !normalizedEnd || !Number.isFinite(step) || step <= 0) {
    return []
  }

  const startMinutes = parseTimeToMinutes(normalizedStart)
  let endMinutes = parseTimeToMinutes(normalizedEnd)
  if (startMinutes === null || endMinutes === null) return []

  if (endMinutes < startMinutes) {
    if (!allowWrap) return []
    // wrap end to next day
    endMinutes += 24 * 60
  }

  const times = []
  for (let minute = startMinutes; minute <= endMinutes; minute += step) {
    const m = minute % (24 * 60)
    const hours = Math.floor(m / 60)
    const minutes = m % 60
    times.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
  }

  return times
}

const addDaysToDate = (isoDate, days) => {
  try {
    const d = new Date(isoDate + 'T00:00:00')
    d.setUTCDate(d.getUTCDate() + Number(days))
    return d.toISOString().split('T')[0]
  } catch {
    return isoDate
  }
}

const buildCountRange = (start, intervalMinutes, count) => {
  const normalizedStart = normalizeTime(start)
  const step = Number(intervalMinutes)
  const total = Number(count)

  if (!normalizedStart || !Number.isFinite(step) || step <= 0 || !Number.isFinite(total) || total <= 0) {
    return []
  }

  const startMinutes = parseTimeToMinutes(normalizedStart)
  if (startMinutes === null) return []

  const times = []
  for (let index = 0; index < total; index += 1) {
    const minute = startMinutes + (index * step)
    const hours = Math.floor(minute / 60) % 24
    const minutes = minute % 60
    times.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
  }

  return times
}

const dedupeTimes = (times) => {
  const seen = new Set()
  return times
    .map(normalizeTime)
    .filter(Boolean)
    .filter(time => {
      if (seen.has(time)) return false
      seen.add(time)
      return true
    })
    .sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b))
}

const FixedScheduleEditor = ({
  client,
  user,
  scheduleTemplates,
  busLines,
  buses,
  drivers,
  message,
  setMessage,
  onScheduleChange,
}) => {
  const [editingScheduleId, setEditingScheduleId] = useState(null)
  const [scheduleMode, setScheduleMode] = useState('single')
  const [selectedLine, setSelectedLine] = useState('')
  const [selectedBus, setSelectedBus] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [driverId, setDriverId] = useState('')
  const [selectedWeekdays, setSelectedWeekdays] = useState([])
  const [singleTime, setSingleTime] = useState('08:00')
  const [batchStartTime, setBatchStartTime] = useState('06:00')
  const [batchEndTime, setBatchEndTime] = useState('09:00')
  const [batchInterval, setBatchInterval] = useState(15)
  const [batchCount, setBatchCount] = useState(6)
  const [batchTimes, setBatchTimes] = useState(['08:00'])
  const [newBatchTime, setNewBatchTime] = useState('')
  const [batchWrap, setBatchWrap] = useState(false)
  const [appendMode, setAppendMode] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(true)
  const [batchOpen, setBatchOpen] = useState(true)
  const [templatesOpen, setTemplatesOpen] = useState(true)
  const [presetName, setPresetName] = useState('')
  const [savedPresets, setSavedPresets] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const isAdmin = Boolean(user?.userCode)

  const resetForm = () => {
    setEditingScheduleId(null)
    setScheduleMode('single')
    setSelectedLine('')
    setSelectedBus('')
    setSelectedDate(new Date().toISOString().split('T')[0])
    setDriverId('')
    setSelectedWeekdays([])
    setSingleTime('08:00')
    setBatchStartTime('06:00')
    setBatchEndTime('09:00')
    setBatchInterval(15)
    setBatchCount(6)
    setBatchTimes(['08:00'])
    setNewBatchTime('')
    setPresetName('')
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getPresetStorageKey(user))
      if (!raw) {
        setSavedPresets([])
        return
      }

      const parsed = JSON.parse(raw)
      setSavedPresets(Array.isArray(parsed) ? parsed : [])
    } catch {
      setSavedPresets([])
    }
  }, [user])

  const persistPresets = (nextPresets) => {
    setSavedPresets(nextPresets)
    try {
      localStorage.setItem(getPresetStorageKey(user), JSON.stringify(nextPresets))
    } catch {
      // ignore storage failures
    }
  }

  const toggleWeekday = (dayValue) => {
    setSelectedWeekdays(prev =>
      prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue]
    )
  }

  const setWeekdaysPreset = (weekdays) => {
    setSelectedWeekdays([...weekdays].sort((a, b) => a - b))
  }

  const formatTime = (timeString) => {
    const date = new Date(timeString)
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
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

  const startEditingSchedule = (schedule) => {
    setMessage(null)
    setEditingScheduleId(schedule.id)
    setScheduleMode('single')
    setSelectedLine(String(schedule.busLineId))
    setSelectedBus(String(schedule.busId))
    setDriverId(schedule.driverId ? String(schedule.driverId) : '')
    setSelectedDate(toInputDate(schedule.startTime))
    setSingleTime(toInputTime(schedule.startTime))
    setSelectedWeekdays(Array.isArray(schedule.weekdays) ? [...schedule.weekdays] : [])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addBatchTime = () => {
    const normalized = normalizeTime(newBatchTime)
    if (!normalized) return
    setBatchTimes(prev => dedupeTimes([...prev, normalized]))
    setNewBatchTime('')
  }

  const removeBatchTime = (time) => {
    setBatchTimes(prev => prev.filter(item => item !== time))
  }

  const generateBatchTimes = () => {
    const generated = buildTimeRange(batchStartTime, batchEndTime, batchInterval, batchWrap)
    if (appendMode) {
      setBatchTimes(prev => dedupeTimes([...prev, ...generated]))
    } else {
      setBatchTimes(dedupeTimes(generated))
    }
  }

  const generateBatchTimesByCount = () => {
    const generated = buildCountRange(batchStartTime, batchInterval, batchCount)
    if (appendMode) {
      setBatchTimes(prev => dedupeTimes([...prev, ...generated]))
    } else {
      setBatchTimes(dedupeTimes(generated))
    }
  }

  const applyPreset = (preset) => {
    setBatchStartTime(preset.start)
    setBatchEndTime(preset.end)
    setBatchInterval(preset.intervalMinutes)
    // infer wrap when end < start if preset does not explicitly set wrap
    const inferredWrap = preset.batchWrap ?? (parseTimeToMinutes(preset.end) < parseTimeToMinutes(preset.start))
    setBatchWrap(Boolean(inferredWrap))
    setBatchTimes(buildTimeRange(preset.start, preset.end, preset.intervalMinutes, Boolean(inferredWrap)))
    setScheduleMode('batch')
  }

  const saveCurrentPreset = () => {
    const name = presetName.trim()
    if (!name) {
      setMessage('Geef een naam op voor het preset')
      return
    }

    const nextPreset = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      scheduleMode,
      selectedLine,
      selectedBus,
      driverId,
      selectedWeekdays,
      singleTime,
      batchStartTime,
      batchEndTime,
      batchInterval,
      batchCount,
      batchTimes,
    }

    persistPresets([nextPreset, ...savedPresets].slice(0, 12))
    setPresetName('')
    setMessage(`Preset opgeslagen: ${name}`)
  }

  const loadPreset = (preset) => {
    setScheduleMode(preset.scheduleMode || 'single')
    setSelectedLine(preset.selectedLine || '')
    setSelectedBus(preset.selectedBus || '')
    setDriverId(preset.driverId || '')
    setSelectedWeekdays(Array.isArray(preset.selectedWeekdays) ? [...preset.selectedWeekdays] : [])
    setSingleTime(preset.singleTime || '08:00')
    setBatchStartTime(preset.batchStartTime || '06:00')
    setBatchEndTime(preset.batchEndTime || '09:00')
    setBatchInterval(Number(preset.batchInterval) || 15)
    const inferredWrap = preset.batchWrap ?? (parseTimeToMinutes(preset.batchEndTime) < parseTimeToMinutes(preset.batchStartTime))
    setBatchWrap(Boolean(inferredWrap))
    setBatchCount(Number(preset.batchCount) || 6)
    setBatchTimes(dedupeTimes(Array.isArray(preset.batchTimes) && preset.batchTimes.length > 0 ? preset.batchTimes : [preset.singleTime || '08:00']))
    setMessage(`Preset geladen: ${preset.name}`)
  }

  const removePreset = (presetId) => {
    persistPresets(savedPresets.filter(preset => preset.id !== presetId))
  }

  const cloneTemplateIntoForm = (schedule) => {
    setMessage(`Dienst gekopieerd naar het formulier: lijn ${schedule.lineNumber}`)
    setEditingScheduleId(null)
    setScheduleMode(Array.isArray(schedule.weekdays) && schedule.weekdays.length > 0 ? 'batch' : 'single')
    setSelectedLine(String(schedule.busLineId))
    setSelectedBus(String(schedule.busId))
    setDriverId(schedule.driverId ? String(schedule.driverId) : '')
    setSelectedDate(toInputDate(schedule.startTime))
    setSingleTime(toInputTime(schedule.startTime))
    setSelectedWeekdays(Array.isArray(schedule.weekdays) ? [...schedule.weekdays] : [])
    const startT = toInputTime(schedule.startTime)
    const endT = toInputTime(schedule.endTime)
    setBatchStartTime(startT)
    setBatchEndTime(addMinutesToTime(startT, 120) || endT || '09:00')
    // if template end is earlier than start, assume it wraps to next day
    const inferredWrap = parseTimeToMinutes(endT) < parseTimeToMinutes(startT)
    setBatchWrap(Boolean(inferredWrap))
    setBatchTimes([startT])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectedWeekdayLabel = useMemo(() => getWeekdayLabel(selectedWeekdays), [selectedWeekdays])

  const submitSingleSchedule = async () => {
    const startDateTime = `${selectedDate}T${singleTime}:00`
    const normalizedWeekdays = [...selectedWeekdays].sort((a, b) => a - b)
    const payload = {
      busLineId: Number(selectedLine),
      busId: Number(selectedBus),
      driverId: driverId ? Number(driverId) : null,
      startTime: startDateTime,
      weekdays: normalizedWeekdays,
    }

    const res = editingScheduleId
      ? await client.put(`/admin/schedules/${editingScheduleId}`, payload)
      : await client.post('/admin/schedules', payload)

    const dayLabels = normalizedWeekdays.length > 0 ? selectedWeekdayLabel : 'eenmalig'
    setMessage(editingScheduleId
      ? `Dienst bijgewerkt: #${res.data.schedule.id} (${dayLabels})`
      : `Dienst aangemaakt: #${res.data.schedule.id} (${dayLabels})`)
  }

  const submitBatchSchedules = async () => {
    const normalizedWeekdays = [...selectedWeekdays].sort((a, b) => a - b)
    const uniqueTimes = dedupeTimes(batchTimes)

    if (uniqueTimes.length === 0) {
      throw new Error('Voeg minstens één vertrektijd toe voor de reeks')
    }

    const startBaseMinutes = parseTimeToMinutes(batchStartTime)

    const schedules = uniqueTimes.map(time => {
      const tmins = parseTimeToMinutes(time)
      let dateForTime = selectedDate
      if (batchWrap && startBaseMinutes !== null && tmins !== null && tmins < startBaseMinutes) {
        dateForTime = addDaysToDate(selectedDate, 1)
      }
      return {
        busLineId: Number(selectedLine),
        busId: Number(selectedBus),
        driverId: driverId ? Number(driverId) : null,
        startTime: `${dateForTime}T${time}:00`,
        weekdays: normalizedWeekdays,
      }
    })

    const payload = { schedules }

    const res = await client.post('/admin/schedules/bulk', payload)
    return {
      count: res.data.createdCount ?? res.data.schedules?.length ?? uniqueTimes.length,
      times: uniqueTimes,
      dayLabels: normalizedWeekdays.length > 0 ? getWeekdayLabel(normalizedWeekdays) : 'eenmalig',
    }
  }

  const submitSchedule = async (e) => {
    e.preventDefault()
    setMessage(null)

    if (!selectedLine || !selectedBus) {
      setMessage('Lijn en voertuig zijn verplicht')
      return
    }

    if (editingScheduleId) {
      try {
        await submitSingleSchedule()
        resetForm()
        onScheduleChange?.()
      } catch (err) {
        const errMsg = err.response?.data?.error || err.message
        setMessage('Error: ' + errMsg)
      }
      return
    }

    if (scheduleMode === 'batch') {
      try {
        const result = await submitBatchSchedules()
        setMessage(`Reeks aangemaakt: ${result.count} diensten op ${result.times.join(', ')} (${result.dayLabels})`)
        resetForm()
        onScheduleChange?.()
      } catch (err) {
        const errMsg = err.response?.data?.error || err.message
        setMessage('Error: ' + errMsg)
      }
      return
    }

    if (!singleTime) {
      setMessage('Start-tijd is verplicht')
      return
    }

    try {
      await submitSingleSchedule()
      resetForm()
      onScheduleChange?.()
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
      if (editingScheduleId === scheduleId) {
        resetForm()
      }
      onScheduleChange?.()
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message
      setMessage('Error: ' + errMsg)
    }
  }

  const previewBatchTimes = useMemo(() => dedupeTimes(batchTimes), [batchTimes])

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h3>Vaste Diensten Beheren</h3>
          <p>Maak, wijzig of verwijder vaste diensten en herhaalde routeschema's</p>
        </div>
      </div>

      {isAdmin && (
        <form onSubmit={submitSchedule} className="stack-form">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ margin: 0 }}>{editingScheduleId ? 'Vaste dienst bewerken' : 'Nieuwe vaste dienst'}</h4>
              <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
                {editingScheduleId
                  ? 'Wijzig één bestaande dienst.'
                  : 'Maak één rit of meteen een complete dienstenreeks met meerdere vertrektijden.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {editingScheduleId ? (
                <button type="button" className="secondary" onClick={resetForm}>
                  Bewerken annuleren
                </button>
              ) : (
                <>
                  <button type="button" className={scheduleMode === 'single' ? '' : 'secondary'} onClick={() => setScheduleMode('single')}>
                    Enkele rit
                  </button>
                  <button type="button" className={scheduleMode === 'batch' ? '' : 'secondary'} onClick={() => setScheduleMode('batch')}>
                    Dienstenreeks
                  </button>
                </>
              )}
            </div>
          </div>

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
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
            {editingScheduleId || scheduleMode === 'single' ? (
              <input
                type="time"
                value={singleTime}
                onChange={e => setSingleTime(e.target.value)}
                placeholder="Start time"
              />
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                {SERVICE_PRESETS.map(preset => (
                  <button key={preset.label} type="button" className="secondary" onClick={() => applyPreset(preset)}>
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'block', fontWeight: 500 }}>
                Herhaal op weekdagen
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {QUICK_PRESETS.map(preset => (
                  <button key={preset.label} type="button" className="secondary" onClick={() => setWeekdaysPreset(preset.weekdays)}>
                    {preset.label}
                  </button>
                ))}
                <button type="button" className="secondary" onClick={() => setSelectedWeekdays([])}>
                  Wissen
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {WEEKDAYS.map((day, idx) => {
                const dayValue = WEEKDAY_VALUES[idx]
                const active = selectedWeekdays.includes(dayValue)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(dayValue)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: active ? '#1D4ED8' : '#e0e0e0',
                      color: active ? '#fff' : '#000',
                      border: 'none',
                      borderRadius: '999px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {!editingScheduleId && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={() => setPresetsOpen(p => !p)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                  {presetsOpen ? '▾' : '▸'} Reusable presets
                </button>
                <span style={{ color: '#666', fontSize: '0.9rem' }}>Sla huidige configuratie op en hergebruik hem later</span>
              </div>
              {presetsOpen && (
                <div style={{ marginTop: '0.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fbfdff' }}>
                  <div className="form-row" style={{ marginTop: '0.25rem' }}>
                    <input
                      type="text"
                      value={presetName}
                      onChange={e => setPresetName(e.target.value)}
                      placeholder="Preset naam, bijvoorbeeld schooldag-ochtend"
                    />
                    <button type="button" className="secondary" onClick={saveCurrentPreset}>
                      Bewaar preset
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    {savedPresets.length === 0 ? (
                      <span style={{ color: '#999', fontSize: '0.9rem' }}>Nog geen presets opgeslagen</span>
                    ) : savedPresets.map(preset => (
                      <span
                        key={preset.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.45rem 0.7rem',
                          background: '#eef2ff',
                          borderRadius: '999px',
                          border: '1px solid #c7d2fe',
                        }}
                      >
                        <button type="button" className="secondary" onClick={() => loadPreset(preset)}>
                          {preset.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePreset(preset.id)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                          aria-label={`Verwijder preset ${preset.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!editingScheduleId && scheduleMode === 'batch' && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={() => setBatchOpen(b => !b)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                  {batchOpen ? '▾' : '▸'} Dienstenreeks opties
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={appendMode} onChange={e => setAppendMode(e.target.checked)} /> Voeg toe
                  </label>
                </div>
              </div>
              {batchOpen && (
                <div style={{ marginTop: '0.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fafafa' }}>
              <div className="form-row" style={{ alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Van</label>
                  <input type="time" value={batchStartTime} onChange={e => setBatchStartTime(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Tot</label>
                  <input type="time" value={batchEndTime} onChange={e => setBatchEndTime(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={batchWrap} onChange={e => setBatchWrap(e.target.checked)} /> Over middernacht
                  </label>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Interval</label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={batchInterval}
                    onChange={e => setBatchInterval(Number(e.target.value) || 15)}
                  />
                </div>
                <button type="button" onClick={generateBatchTimes}>
                  Genereer tijden
                </button>
              </div>

              <div className="form-row" style={{ alignItems: 'end', marginTop: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Aantal ritten</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={batchCount}
                    onChange={e => setBatchCount(Number(e.target.value) || 1)}
                  />
                </div>
                <button type="button" onClick={generateBatchTimesByCount}>
                  Genereer vanaf eerste tijd
                </button>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Extra tijd toevoegen</label>
                <div className="form-row">
                  <input type="time" value={newBatchTime} onChange={e => setNewBatchTime(e.target.value)} />
                  <button type="button" className="secondary" onClick={addBatchTime}>
                    Voeg toe
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>Preview</strong>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>{previewBatchTimes.length} ritten</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {previewBatchTimes.length === 0 ? (
                    <span style={{ color: '#999', fontSize: '0.9rem' }}>Nog geen tijden toegevoegd</span>
                  ) : previewBatchTimes.map(time => (
                    <span
                      key={time}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.45rem 0.7rem',
                        background: '#eaf2ff',
                        borderRadius: '999px',
                        border: '1px solid #c7dcff',
                      }}
                    >
                      {time}
                      <button
                        type="button"
                        onClick={() => removeBatchTime(time)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                        aria-label={`Verwijder ${time}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            )}

            </div>
            )}

            <div className="form-row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>
              {editingScheduleId
                ? 'Je past één bestaande dienst aan.'
                : scheduleMode === 'batch'
                  ? `Reeks wordt aangemaakt voor ${previewBatchTimes.length} vertrektijden.`
                  : 'Maak één dienst aan met optionele herhaling.'}
            </div>
            <button type="submit">
              {editingScheduleId
                ? 'Dienst bijwerken'
                : scheduleMode === 'batch'
                  ? `Reeks aanmaken (${previewBatchTimes.length})`
                  : 'Dienst aanmaken'}
            </button>
          </div>
        </form>
      )}

      <h4 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>Bestaande vaste diensten</h4>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" onClick={() => setTemplatesOpen(t => !t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
          {templatesOpen ? '▾' : '▸'} Bestaande vaste diensten
        </button>
        <div style={{ color: '#666', fontSize: '0.9rem' }}>Bewerk of verwijder bestaande diensten</div>
      </div>
      {templatesOpen && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {scheduleTemplates.length === 0 ? (
            <div className="message">Nog geen vaste diensten gevonden.</div>
          ) : (
            scheduleTemplates.slice()
              .sort((a, b) => a.lineNumber - b.lineNumber || new Date(a.startTime) - new Date(b.startTime))
              .map(schedule => {
                return (
                  <article key={`template-${schedule.id}`} className="schedule-card" style={{ position: 'relative' }}>
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

                    {isAdmin && (
                      <div className="form-row" style={{ marginTop: '0.75rem', gap: '0.5rem' }}>
                        <button type="button" className="secondary" onClick={() => startEditingSchedule(schedule)} style={{ flex: 1 }}>
                          Bewerken
                        </button>
                        <button type="button" className="secondary" onClick={() => cloneTemplateIntoForm(schedule)} style={{ flex: 1 }}>
                          Klonen
                        </button>
                        <button type="button" className="danger" onClick={() => setDeleteConfirm(schedule)} style={{ flex: 1 }}>
                          Verwijderen
                        </button>
                      </div>
                    )}
                  </article>
                )
              })
          )}
        </div>
      )}

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
              <button className="secondary" type="button" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="danger"
                type="button"
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

export default FixedScheduleEditor
