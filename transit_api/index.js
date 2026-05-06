const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const { authMiddleware } = require('./middleware');

const app = express();
app.use(express.json());
app.use(cors());

// Development mock storage when DEV_MOCK=1
const DEV_MOCK = process.env.DEV_MOCK === '1';
const _mock = {
  stops: [],
  routeStops: [],
  busLines: [],
  fleetBuses: [],
  schedules: [],
  drivers: [],
  nextStopId: 1,
  nextRouteStopId: 1,
  nextBusLineId: 1,
  nextFleetBusId: 1,
  nextScheduleId: 1,
  nextDriverId: 1,
};

// Initialize mock drivers
if (DEV_MOCK) {
  _mock.drivers = [
    { id: 1, name: 'Jan Peterse', email: 'jan@transit.local', phone: '06-12345678', status: 'active' },
    { id: 2, name: 'Maria Kuijpers', email: 'maria@transit.local', phone: '06-87654321', status: 'active' },
    { id: 3, name: 'Robert Smits', email: 'robert@transit.local', phone: '06-55555555', status: 'active' },
    { id: 4, name: 'Anja Voorn', email: 'anja@transit.local', phone: '06-44444444', status: 'inactive' },
  ];
  _mock.nextDriverId = 5;
}

const adminUserCodes = new Set(
  (process.env.ADMIN_USER_CODES || '')
    .split(',')
    .map(code => code.trim())
    .filter(Boolean)
    .map(code => Number(code))
    .filter(code => Number.isFinite(code))
);

const adminMiddleware = (req, res, next) => {
  const userCode = Number(req.user?.userCode);
  if (!Number.isFinite(userCode) || !adminUserCodes.has(userCode)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  next();
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate departure times for each stop in a route
 * Returns array of { order, stopName, departureTime }
 */
function calculateDepartureTimes(startTime, busLineId, mock) {
  const startDate = new Date(startTime);
  
  // Get route stops for this bus line
  const routeStops = mock.routeStops
    .filter(rs => rs.busLineId === busLineId)
    .sort((a, b) => a.stopOrder - b.stopOrder);

  return routeStops.map(rs => {
    const departureDate = new Date(startDate);
    // Add estimated arrival minutes to get departure time
    departureDate.setMinutes(departureDate.getMinutes() + (rs.estimatedArrivalMinutes || 0));
    
    const stop = mock.stops.find(s => s.id === rs.stopId);
    return {
      order: rs.stopOrder,
      stopId: rs.stopId,
      stopName: stop?.name || 'Unknown Stop',
      estimatedArrivalMinutes: rs.estimatedArrivalMinutes || 0,
      departureTime: departureDate.toISOString(),
    };
  });
}

function parseWeekdaysValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => Number(v)).filter(v => Number.isFinite(v));

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(v => Number(v)).filter(v => Number.isFinite(v));
      }
    } catch (_) {
      // Fall through to CSV/PG-array parsing.
    }

    // Handles values like "1,2,3" or "{1,2,3}".
    const normalized = trimmed.replace('{', '').replace('}', '');
    return normalized
      .split(',')
      .map(v => Number(v.trim()))
      .filter(v => Number.isFinite(v));
  }

  return [];
}

/**
 * Check if two schedules have date/weekday overlap
 */
function doSchedulesDateOverlap(schedule1Start, schedule1End, schedule1Weekdays, schedule2Start, schedule2End, schedule2Weekdays) {
  const s1Start = new Date(schedule1Start);
  const s1End = new Date(schedule1End);
  const s2Start = new Date(schedule2Start);
  const s2End = new Date(schedule2End);
  
  // Check time overlap
  if (s1End <= s2Start || s2End <= s1Start) {
    return false; // No time overlap
  }
  
  // If both have no weekdays (one-time), check if same day
  if ((!schedule1Weekdays || schedule1Weekdays.length === 0) && 
      (!schedule2Weekdays || schedule2Weekdays.length === 0)) {
    return s1Start.toDateString() === s2Start.toDateString();
  }
  
  // If one has weekdays and other doesn't, check if one-time falls on weekday
  if (schedule1Weekdays && schedule1Weekdays.length > 0 && 
      (!schedule2Weekdays || schedule2Weekdays.length === 0)) {
    const s2Day = s2Start.getDay(); // 0=Sun, 1=Mon, etc.
    const s2Adjusted = s2Day === 0 ? 0 : s2Day; // Normalize to 0-6
    return schedule1Weekdays.includes(s2Adjusted);
  }
  
  if ((!schedule1Weekdays || schedule1Weekdays.length === 0) && 
      schedule2Weekdays && schedule2Weekdays.length > 0) {
    const s1Day = s1Start.getDay();
    const s1Adjusted = s1Day === 0 ? 0 : s1Day;
    return schedule2Weekdays.includes(s1Adjusted);
  }
  
  // Both have weekdays: check if any day overlaps
  if (schedule1Weekdays && schedule2Weekdays) {
    return schedule1Weekdays.some(d => schedule2Weekdays.includes(d));
  }
  
  return false;
}

/**
 * Check if a driver has conflicts with existing schedules
 */
function checkDriverConflict(driverId, startTime, endTime, weekdays, allSchedules, excludeScheduleId = null) {
  if (!driverId) return false; // No conflict if no driver specified
  
  return allSchedules.some(s => {
    if (excludeScheduleId && s.id === excludeScheduleId) return false;
    const sDriverId = s.driverId ?? s.driver_id;
    if (Number(sDriverId) !== Number(driverId)) return false;
    
    const sWeekdays = parseWeekdaysValue(s.weekdays);
    const wkdays = weekdays || [];
    const sStart = s.startTime ?? s.start_time;
    const sEnd = s.endTime ?? s.end_time;
    
    return doSchedulesDateOverlap(startTime, endTime, wkdays, sStart, sEnd, sWeekdays);
  });
}

/**
 * Check if a bus has conflicts with existing schedules
 */
function checkBusConflict(busId, startTime, endTime, weekdays, allSchedules, excludeScheduleId = null) {
  if (!busId) return false;
  
  return allSchedules.some(s => {
    if (excludeScheduleId && s.id === excludeScheduleId) return false;
    const sBusId = s.busId ?? s.bus_id;
    if (Number(sBusId) !== Number(busId)) return false;
    
    const sWeekdays = parseWeekdaysValue(s.weekdays);
    const wkdays = weekdays || [];
    const sStart = s.startTime ?? s.start_time;
    const sEnd = s.endTime ?? s.end_time;
    
    return doSchedulesDateOverlap(startTime, endTime, wkdays, sStart, sEnd, sWeekdays);
  });
}

// ============================================
// ROUTES - Get daily schedule
// ============================================
app.get('/schedule/daily', authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user.userId;

    if (!date) {
      return res.status(400).json({ error: 'date query parameter required' });
    }

    const result = await db.query(`
      SELECT 
        r.id,
        r.start_time,
        r.end_time,
        r.status,
        bl.id as line_id,
        bl.line_number,
        bl.start_stop,
        bl.end_stop,
        bl.estimated_duration_minutes,
        bl.description,
        bt.id as bus_type_id,
        bt.name as bus_type,
        bt.seat_capacity,
        bt.license_plate
      FROM transit.routes r
      JOIN transit.bus_lines bl ON r.bus_line_id = bl.id
      JOIN fleet.bus bt ON r.bus_type_id = bt.id
      WHERE r.user_id = $1 AND DATE(r.start_time) = $2
      ORDER BY r.start_time ASC
    `, [userId, date]);

    const routes = result.rows.map(row => ({
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      busLine: {
        id: row.line_id,
        lineNumber: row.line_number,
        startStop: row.start_stop,
        endStop: row.end_stop,
        estimatedDuration: row.estimated_duration_minutes,
        description: row.description,
      },
      busType: {
        id: row.bus_type_id,
        name: row.bus_type,
        seatCapacity: row.seat_capacity,
        licensePlate: row.license_plate,
      },
    }));

    res.json({ date, routes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ROUTES - Get single route details
// ============================================
app.get('/routes/:routeId', authMiddleware, async (req, res) => {
  try {
    const { routeId } = req.params;
    const userId = req.user.userId;

    const result = await db.query(`
      SELECT 
        r.id,
        r.start_time,
        r.end_time,
        r.status,
        bl.id as line_id,
        bl.line_number,
        bl.start_stop,
        bl.end_stop,
        bl.estimated_duration_minutes,
        bl.description,
        bt.id as bus_type_id,
        bt.name as bus_type,
        bt.seat_capacity,
        bt.license_plate
      FROM routes r
      JOIN bus_lines bl ON r.bus_line_id = bl.id
      JOIN bus_types bt ON r.bus_type_id = bt.id
      WHERE r.id = $1 AND r.user_id = $2
    `, [routeId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'route_not_found' });
    }

    const row = result.rows[0];
    const route = {
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      busLine: {
        id: row.line_id,
        lineNumber: row.line_number,
        startStop: row.start_stop,
        endStop: row.end_stop,
        estimatedDuration: row.estimated_duration_minutes,
        description: row.description,
      },
      busType: {
        id: row.bus_type_id,
        name: row.bus_type,
        seatCapacity: row.seat_capacity,
        licensePlate: row.license_plate,
      },
    };

    res.json({ route });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ROUTES - Get stops for a bus line
// ============================================
app.get('/bus-lines/:busLineId/stops', authMiddleware, async (req, res) => {
  try {
    const { busLineId } = req.params;
    if (DEV_MOCK) {
      const stops = _mock.routeStops
        .filter(rs => String(rs.busLineId) === String(busLineId))
        .sort((a,b) => a.stopOrder - b.stopOrder)
        .map(rs => ({
          id: rs.id,
          order: rs.stopOrder,
          name: rs.name,
          latitude: rs.latitude,
          longitude: rs.longitude,
          estimatedArrivalMinutes: rs.estimatedArrivalMinutes,
        }));
      return res.json({ stops });
    }

    const result = await db.query(`
      SELECT
        rs.id,
        rs.stop_order,
        s.name as stop_name,
        s.latitude,
        s.longitude,
        rs.estimated_arrival_minutes
      FROM transit.route_stops rs
      JOIN transit.stops s ON s.id = rs.stop_id
      WHERE rs.bus_line_id = $1
      ORDER BY rs.stop_order ASC
    `, [busLineId]);

    const stops = result.rows.map(row => ({
      id: row.id,
      order: row.stop_order,
      name: row.stop_name,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      estimatedArrivalMinutes: row.estimated_arrival_minutes,
    }));

    res.json({ stops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ADMIN - Create reusable stop
// ============================================
app.get('/admin/stops', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (DEV_MOCK) {
      return res.json({ stops: _mock.stops.slice().sort((a, b) => a.id - b.id) });
    }

    const result = await db.query(`
      SELECT id, name, latitude, longitude, created_at, updated_at
      FROM transit.stops
      ORDER BY id ASC
    `);

    res.json({
      stops: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.post('/admin/stops', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, latitude, longitude } = req.body;

    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }

    if (DEV_MOCK) {
      const stop = {
        id: _mock.nextStopId++,
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      _mock.stops.push(stop);
      return res.status(201).json({ stop });
    }

    const result = await db.query(`
      WITH next_id AS (
        SELECT COALESCE(MAX(id), 0) + 1 AS id FROM transit.stops
      )
      INSERT INTO transit.stops (id, name, latitude, longitude)
      SELECT next_id.id, $1, $2, $3
      FROM next_id
      RETURNING id, name, latitude, longitude, created_at, updated_at
    `, [name, latitude, longitude]);

    const stop = result.rows[0];
    res.status(201).json({
      stop: {
        id: stop.id,
        name: stop.name,
        latitude: parseFloat(stop.latitude),
        longitude: parseFloat(stop.longitude),
        createdAt: stop.created_at,
        updatedAt: stop.updated_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ADMIN - Manage bus lines
// ============================================
app.get('/admin/bus-lines', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (DEV_MOCK) {
      return res.json({ busLines: _mock.busLines.slice().sort((a, b) => a.lineNumber - b.lineNumber) });
    }

    const result = await db.query(`
      SELECT id, line_number, start_stop, end_stop, estimated_duration_minutes, description
      FROM transit.bus_lines
      ORDER BY line_number ASC, id ASC
    `);

    res.json({
      busLines: result.rows.map(row => ({
        id: row.id,
        lineNumber: row.line_number,
        startStop: row.start_stop,
        endStop: row.end_stop,
        estimatedDurationMinutes: row.estimated_duration_minutes,
        description: row.description,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.post('/admin/bus-lines', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { lineNumber, startStop, endStop, estimatedDurationMinutes, description } = req.body;

    if (lineNumber === undefined || !startStop || !endStop || estimatedDurationMinutes === undefined) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }

    if (DEV_MOCK) {
      const busLine = {
        id: _mock.nextBusLineId++,
        lineNumber: Number(lineNumber),
        startStop,
        endStop,
        estimatedDurationMinutes: Number(estimatedDurationMinutes),
        description: description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      _mock.busLines.push(busLine);
      return res.status(201).json({ busLine });
    }

    const result = await db.query(`
      WITH next_id AS (
        SELECT COALESCE(MAX(id), 0) + 1 AS id FROM transit.bus_lines
      )
      INSERT INTO transit.bus_lines (id, line_number, start_stop, end_stop, estimated_duration_minutes, description)
      SELECT next_id.id, $1, $2, $3, $4, $5
      FROM next_id
      RETURNING id, line_number, start_stop, end_stop, estimated_duration_minutes, description
    `, [lineNumber, startStop, endStop, estimatedDurationMinutes, description || null]);

    const busLine = result.rows[0];
    res.status(201).json({
      busLine: {
        id: busLine.id,
        lineNumber: busLine.line_number,
        startStop: busLine.start_stop,
        endStop: busLine.end_stop,
        estimatedDurationMinutes: busLine.estimated_duration_minutes,
        description: busLine.description,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.patch('/admin/bus-lines/:busLineId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { busLineId } = req.params;
    const { lineNumber, startStop, endStop, estimatedDurationMinutes, description } = req.body;

    if (DEV_MOCK) {
      const existing = _mock.busLines.find(line => String(line.id) === String(busLineId));
      if (!existing) return res.status(404).json({ error: 'bus_line_not_found' });
      if (lineNumber !== undefined) existing.lineNumber = Number(lineNumber);
      if (startStop !== undefined) existing.startStop = startStop;
      if (endStop !== undefined) existing.endStop = endStop;
      if (estimatedDurationMinutes !== undefined) existing.estimatedDurationMinutes = Number(estimatedDurationMinutes);
      if (description !== undefined) existing.description = description;
      existing.updatedAt = new Date().toISOString();
      return res.json({ busLine: existing });
    }

    const result = await db.query(`
      UPDATE transit.bus_lines
      SET
        line_number = COALESCE($1, line_number),
        start_stop = COALESCE($2, start_stop),
        end_stop = COALESCE($3, end_stop),
        estimated_duration_minutes = COALESCE($4, estimated_duration_minutes),
        description = COALESCE($5, description)
      WHERE id = $6
      RETURNING id, line_number, start_stop, end_stop, estimated_duration_minutes, description
    `, [lineNumber ?? null, startStop ?? null, endStop ?? null, estimatedDurationMinutes ?? null, description ?? null, busLineId]);

    if (!result.rows[0]) return res.status(404).json({ error: 'bus_line_not_found' });

    const busLine = result.rows[0];
    res.json({
      busLine: {
        id: busLine.id,
        lineNumber: busLine.line_number,
        startStop: busLine.start_stop,
        endStop: busLine.end_stop,
        estimatedDurationMinutes: busLine.estimated_duration_minutes,
        description: busLine.description,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ADMIN - Manage fleet buses
// ============================================
app.get('/admin/fleet/buses', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (DEV_MOCK) {
      const buses = _mock.fleetBuses.slice().sort((a, b) => a.id - b.id);
      return res.json({ 
        buses: buses.map(b => ({
          ...b,
          available: !checkBusConflict(b.id, new Date().toISOString(), new Date(Date.now() + 24*60*60*1000).toISOString(), [], _mock.schedules || [])
        }))
      });
    }

    const result = await db.query(`
      SELECT id, name, seat_capacity, license_plate
      FROM fleet.bus
      ORDER BY id ASC
    `);

    // Get all schedules to check for conflicts
    const schedulesResult = await db.query(`SELECT * FROM transit.schedules WHERE status IN ('planned', 'active')`);
    const schedules = schedulesResult.rows.map(row => ({
      ...row,
      weekdays: parseWeekdaysValue(row.weekdays),
    }));

    res.json({
      buses: result.rows.map(row => {
        const busId = row.id;
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isAvailable = !checkBusConflict(busId, now.toISOString(), tomorrow.toISOString(), [], schedules);
        
        return {
          id: row.id,
          name: row.name,
          seatCapacity: row.seat_capacity,
          licensePlate: row.license_plate,
          available: isAvailable,
        };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.post('/admin/fleet/buses', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, seatCapacity, licensePlate } = req.body;

    if (!name || seatCapacity === undefined || !licensePlate) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }

    if (DEV_MOCK) {
      const bus = {
        id: _mock.nextFleetBusId++,
        name,
        seatCapacity: Number(seatCapacity),
        licensePlate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      _mock.fleetBuses.push(bus);
      return res.status(201).json({ bus });
    }

    const result = await db.query(`
      WITH next_id AS (
        SELECT COALESCE(MAX(id), 0) + 1 AS id FROM fleet.bus
      )
      INSERT INTO fleet.bus (id, name, seat_capacity, license_plate)
      SELECT next_id.id, $1, $2, $3
      FROM next_id
      RETURNING id, name, seat_capacity, license_plate
    `, [name, seatCapacity, licensePlate]);

    const bus = result.rows[0];
    res.status(201).json({
      bus: {
        id: bus.id,
        name: bus.name,
        seatCapacity: bus.seat_capacity,
        licensePlate: bus.license_plate,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ADMIN - Link stop to bus line
// ============================================
app.post('/admin/bus-lines/:busLineId/stops', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { busLineId } = req.params;
    const { stopId, stopOrder, estimatedArrivalMinutes } = req.body;

    if (!stopId || stopOrder === undefined) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }

    if (DEV_MOCK) {
      const stop = _mock.stops.find(s => String(s.id) === String(stopId));
      const routeStop = {
        id: _mock.nextRouteStopId++,
        busLineId: Number(busLineId),
        stopId: Number(stopId),
        stopOrder: Number(stopOrder),
        estimatedArrivalMinutes: estimatedArrivalMinutes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: stop ? stop.name : `stop-${stopId}`,
        latitude: stop ? stop.latitude : 0,
        longitude: stop ? stop.longitude : 0,
      };
      // remove existing with same busLineId & stopOrder
      _mock.routeStops = _mock.routeStops.filter(rs => !(rs.busLineId === routeStop.busLineId && rs.stopOrder === routeStop.stopOrder));
      _mock.routeStops.push(routeStop);
      return res.status(201).json({ routeStop });
    }

    const result = await db.query(`
      WITH next_id AS (
        SELECT COALESCE(MAX(id), 0) + 1 AS id FROM transit.route_stops
      )
      INSERT INTO transit.route_stops (id, bus_line_id, stop_id, stop_order, estimated_arrival_minutes)
      SELECT next_id.id, $1, $2, $3, $4
      FROM next_id
      ON CONFLICT (bus_line_id, stop_order) DO UPDATE SET
        stop_id = EXCLUDED.stop_id,
        estimated_arrival_minutes = EXCLUDED.estimated_arrival_minutes,
        updated_at = NOW()
      RETURNING id, bus_line_id, stop_id, stop_order, estimated_arrival_minutes, created_at, updated_at
    `, [busLineId, stopId, stopOrder, estimatedArrivalMinutes ?? null]);

    const link = result.rows[0];
    res.status(201).json({
      routeStop: {
        id: link.id,
        busLineId: link.bus_line_id,
        stopId: link.stop_id,
        stopOrder: link.stop_order,
        estimatedArrivalMinutes: link.estimated_arrival_minutes,
        createdAt: link.created_at,
        updatedAt: link.updated_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.post('/admin/bus-lines/:busLineId/stops/reorder', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { busLineId } = req.params;
    const { routeStopIds } = req.body || {};

    if (!Array.isArray(routeStopIds) || routeStopIds.length === 0) {
      return res.status(400).json({ error: 'routeStopIds array required' });
    }

    const normalizedIds = routeStopIds.map(id => Number(id)).filter(id => Number.isFinite(id));
    if (normalizedIds.length !== routeStopIds.length) {
      return res.status(400).json({ error: 'routeStopIds must contain only numeric ids' });
    }

    if (DEV_MOCK) {
      const busLineStops = _mock.routeStops
        .filter(rs => String(rs.busLineId) === String(busLineId))
        .sort((a, b) => a.stopOrder - b.stopOrder);

      const idSet = new Set(busLineStops.map(rs => Number(rs.id)));
      const sameCount = busLineStops.length === normalizedIds.length;
      const sameIds = sameCount && normalizedIds.every(id => idSet.has(id));
      if (!sameIds) {
        return res.status(400).json({ error: 'routeStopIds must match current bus line stops' });
      }

      const updated = normalizedIds.map((routeStopId, index) => {
        const stop = _mock.routeStops.find(rs => Number(rs.id) === routeStopId && String(rs.busLineId) === String(busLineId));
        if (!stop) return null;
        stop.stopOrder = index + 1;
        stop.updatedAt = new Date().toISOString();
        return stop;
      });

      if (updated.some(item => !item)) {
        return res.status(400).json({ error: 'routeStopIds must match current bus line stops' });
      }

      _mock.routeStops = _mock.routeStops.map(routeStop => {
        const reordered = updated.find(item => item.id === routeStop.id);
        return reordered || routeStop;
      });

      return res.json({
        routeStops: updated,
      });
    }

    const current = await client.query(
      `SELECT id FROM transit.route_stops WHERE bus_line_id = $1 ORDER BY stop_order ASC`,
      [busLineId]
    );

    const currentIds = current.rows.map(row => Number(row.id));
    const sameCount = currentIds.length === normalizedIds.length;
    const sameIds = sameCount && normalizedIds.every(id => currentIds.includes(id));

    if (!sameIds) {
      return res.status(400).json({ error: 'routeStopIds must match current bus line stops' });
    }

    await client.query('BEGIN');

    for (let index = 0; index < normalizedIds.length; index += 1) {
      await client.query(
        `UPDATE transit.route_stops
         SET stop_order = $1, updated_at = NOW()
         WHERE id = $2 AND bus_line_id = $3`,
        [-(index + 1), normalizedIds[index], busLineId]
      );
    }

    for (let index = 0; index < normalizedIds.length; index += 1) {
      await client.query(
        `UPDATE transit.route_stops
         SET stop_order = $1, updated_at = NOW()
         WHERE id = $2 AND bus_line_id = $3`,
        [index + 1, normalizedIds[index], busLineId]
      );
    }

    const result = await client.query(
      `SELECT
         rs.id,
         rs.stop_order,
         s.name as stop_name,
         s.latitude,
         s.longitude,
         rs.estimated_arrival_minutes
       FROM transit.route_stops rs
       JOIN transit.stops s ON s.id = rs.stop_id
       WHERE rs.bus_line_id = $1
       ORDER BY rs.stop_order ASC`,
      [busLineId]
    );

    await client.query('COMMIT');

    res.json({
      routeStops: result.rows.map(row => ({
        id: row.id,
        order: row.stop_order,
        name: row.stop_name,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        estimatedArrivalMinutes: row.estimated_arrival_minutes,
      })),
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// ADMIN - Delete a stop
// ============================================
app.delete('/admin/stops/:stopId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { stopId } = req.params;

    if (!stopId || !Number.isFinite(Number(stopId))) {
      return res.status(400).json({ error: 'invalid_stop_id' });
    }

    if (DEV_MOCK) {
      const index = _mock.stops.findIndex(s => Number(s.id) === Number(stopId));
      if (index === -1) {
        return res.status(404).json({ error: 'stop_not_found' });
      }
      const deletedStop = _mock.stops.splice(index, 1)[0];
      return res.json({ success: true, stop: deletedStop });
    }

    const result = await db.query(
      `DELETE FROM transit.stops WHERE id = $1 RETURNING id, name`,
      [stopId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'stop_not_found' });
    }

    res.json({ success: true, stop: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(409).json({ error: 'foreign_key_violation', message: 'This stop is referenced by route_stops' });
    }
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ADMIN - Delete a bus line
// ============================================
app.delete('/admin/bus-lines/:busLineId', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { busLineId } = req.params;

    if (!busLineId || !Number.isFinite(Number(busLineId))) {
      return res.status(400).json({ error: 'invalid_bus_line_id' });
    }

    if (DEV_MOCK) {
      const lineIndex = _mock.busLines.findIndex(bl => Number(bl.id) === Number(busLineId));
      if (lineIndex === -1) {
        return res.status(404).json({ error: 'bus_line_not_found' });
      }
      const deletedLine = _mock.busLines.splice(lineIndex, 1)[0];
      // Also delete route_stops for this line
      _mock.routeStops = _mock.routeStops.filter(rs => String(rs.busLineId) !== String(busLineId));
      return res.json({ success: true, busLine: deletedLine });
    }

    await client.query('BEGIN');

    // Delete associated route_stops first
    await client.query(
      `DELETE FROM transit.route_stops WHERE bus_line_id = $1`,
      [busLineId]
    );

    // Delete the bus line
    const result = await client.query(
      `DELETE FROM transit.bus_lines WHERE id = $1 RETURNING id, line_number`,
      [busLineId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'bus_line_not_found' });
    }

    await client.query('COMMIT');
    res.json({ success: true, busLine: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// ADMIN - Delete a route_stop from bus line
// ============================================
app.delete('/admin/bus-lines/:busLineId/stops/:routeStopId', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { busLineId, routeStopId } = req.params;

    if (!busLineId || !Number.isFinite(Number(busLineId))) {
      return res.status(400).json({ error: 'invalid_bus_line_id' });
    }

    if (!routeStopId || !Number.isFinite(Number(routeStopId))) {
      return res.status(400).json({ error: 'invalid_route_stop_id' });
    }

    if (DEV_MOCK) {
      const index = _mock.routeStops.findIndex(
        rs => Number(rs.id) === Number(routeStopId) && String(rs.busLineId) === String(busLineId)
      );
      if (index === -1) {
        return res.status(404).json({ error: 'route_stop_not_found' });
      }
      const deletedRouteStop = _mock.routeStops.splice(index, 1)[0];
      return res.json({ success: true, routeStop: deletedRouteStop });
    }

    await client.query('BEGIN');

    // Find and delete the route_stop
    const result = await client.query(
      `DELETE FROM transit.route_stops 
       WHERE id = $1 AND bus_line_id = $2
       RETURNING id, stop_order`,
      [routeStopId, busLineId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'route_stop_not_found' });
    }

    const deletedOrder = result.rows[0].stop_order;

    // Re-order remaining stops
    await client.query(
      `UPDATE transit.route_stops
       SET stop_order = stop_order - 1, updated_at = NOW()
       WHERE bus_line_id = $1 AND stop_order > $2`,
      [busLineId, deletedOrder]
    );

    await client.query('COMMIT');
    res.json({ success: true, routeStop: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// NAVIGATION - Save calculated route
// ============================================
app.post('/navigation/route', authMiddleware, async (req, res) => {
  try {
    const {
      routeId,
      startLat,
      startLon,
      endLat,
      endLon,
      totalDistance,
      totalDuration,
      geojson,
    } = req.body;

    if (!routeId || !startLat || !startLon || !endLat || !endLon || !totalDistance || !totalDuration) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }

    const result = await db.query(`
      INSERT INTO navigation_routes 
      (route_id, start_lat, start_lon, end_lat, end_lon, 
       total_distance_meters, total_duration_seconds, polyline_geojson)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (route_id) DO UPDATE SET
        start_lat = $2,
        start_lon = $3,
        end_lat = $4,
        end_lon = $5,
        total_distance_meters = $6,
        total_duration_seconds = $7,
        polyline_geojson = $8
      RETURNING *
    `, [
      routeId,
      startLat,
      startLon,
      endLat,
      endLon,
      totalDistance,
      totalDuration,
      JSON.stringify(geojson),
    ]);

    res.json({ route: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// GPS TRACKING - Record current position
// ============================================
app.post('/gps/track', authMiddleware, async (req, res) => {
  try {
    const { routeId, latitude, longitude, speed, heading, accuracy } = req.body;

    if (!routeId || !latitude || !longitude) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }

    await db.query(`
      INSERT INTO gps_tracking 
      (route_id, latitude, longitude, speed_kmh, heading, accuracy, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [routeId, latitude, longitude, speed || null, heading || null, accuracy || null]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// GPS TRACKING - Get route history
// ============================================
app.get('/gps/route/:routeId', authMiddleware, async (req, res) => {
  try {
    const { routeId } = req.params;
    const userId = req.user.userId;

    // Verify user owns this route
    const routeCheck = await db.query(
      'SELECT id FROM routes WHERE id = $1 AND user_id = $2',
      [routeId, userId]
    );

    if (routeCheck.rows.length === 0) {
      return res.status(403).json({ error: 'unauthorized' });
    }

    const result = await db.query(`
      SELECT 
        id,
        latitude,
        longitude,
        speed_kmh,
        heading,
        accuracy,
        recorded_at
      FROM gps_tracking
      WHERE route_id = $1
      ORDER BY recorded_at ASC
    `, [routeId]);

    const positions = result.rows.map(row => ({
      id: row.id,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      speed: row.speed_kmh,
      heading: row.heading,
      accuracy: row.accuracy,
      recordedAt: row.recorded_at,
    }));

    res.json({ positions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ROUTES - Update route status
// ============================================
app.patch('/routes/:routeId/status', authMiddleware, async (req, res) => {
  try {
    const { routeId } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;

    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const result = await db.query(`
      UPDATE transit.routes 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `, [status, routeId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'route_not_found' });
    }

    res.json({ route: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ADMIN - Get drivers for scheduling
// ============================================
app.get('/admin/drivers', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (DEV_MOCK) {
      const drivers = _mock.drivers.slice().filter(d => d.status === 'active');
      return res.json({ 
        drivers: drivers.map(d => ({
          ...d,
          available: !checkDriverConflict(d.id, new Date().toISOString(), new Date(Date.now() + 24*60*60*1000).toISOString(), [], _mock.schedules || [])
        }))
      });
    }

    const result = await db.query(`
      SELECT id, firstname, lastname, email, phone, job, joined, status
      FROM workers.employees
      WHERE status = 'active'
      ORDER BY firstname, lastname ASC
    `);

    // Get all schedules to check for conflicts
    const schedulesResult = await db.query(`SELECT * FROM transit.schedules WHERE status IN ('planned', 'active')`);
    const schedules = schedulesResult.rows.map(row => ({
      ...row,
      weekdays: parseWeekdaysValue(row.weekdays),
    }));

    res.json({
      drivers: result.rows.map(row => {
        const driverId = row.id;
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isAvailable = !checkDriverConflict(driverId, now.toISOString(), tomorrow.toISOString(), [], schedules);
        
        return {
          id: row.id,
          name: (String(row.firstname || '') + ' ' + String(row.lastname || '')).trim(),
          email: row.email,
          phone: row.phone,
          job: row.job,
          joined: row.joined,
          status: row.status,
          available: isAvailable,
        };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// ADMIN - Manage schedules (timetable)
// ============================================
app.get('/admin/schedules', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (DEV_MOCK) {
      const schedules = (_mock.schedules || []).map(s => ({
        ...s,
        departureTimes: calculateDepartureTimes(s.startTime, s.busLineId, _mock),
      }));
      return res.json({ schedules });
    }

    const hasWeekdaysColumn = await db.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='transit' AND table_name='schedules' AND column_name='weekdays'
    `);

    const baseSelect = `
      SELECT 
        s.id,
        s.bus_line_id,
        s.bus_id,
        s.driver_id,
        s.start_time,
        s.end_time,
        s.status,
        s.created_at,
        bl.line_number,
        bl.estimated_duration_minutes,
        b.name as bus_name,
        b.license_plate,
        TRIM(COALESCE(e.firstname, '') || ' ' || COALESCE(e.lastname, '')) as driver_name`;

    const result = hasWeekdaysColumn.rows.length > 0
      ? await db.query(`${baseSelect}, s.weekdays as weekdays
          FROM transit.schedules s
          LEFT JOIN transit.bus_lines bl ON s.bus_line_id = bl.id
          LEFT JOIN fleet.bus b ON s.bus_id = b.id
          LEFT JOIN workers.employees e ON s.driver_id = e.id
          ORDER BY s.start_time DESC`)
      : await db.query(`${baseSelect}, NULL as weekdays
          FROM transit.schedules s
          LEFT JOIN transit.bus_lines bl ON s.bus_line_id = bl.id
          LEFT JOIN fleet.bus b ON s.bus_id = b.id
          LEFT JOIN workers.employees e ON s.driver_id = e.id
          ORDER BY s.start_time DESC`);

    const schedules = result.rows.map(row => {
      const departureTimes = calculateDepartureTimes(row.start_time, row.bus_line_id, _mock);
      
      const weekdays = parseWeekdaysValue(row.weekdays);
      
      return {
        id: row.id,
        busLineId: row.bus_line_id,
        busId: row.bus_id,
        driverId: row.driver_id,
        driverName: row.driver_name || null,
        startTime: row.start_time,
        endTime: row.end_time,
        weekdays: weekdays,
        departureTimes,
        status: row.status,
        lineNumber: row.line_number,
        busName: row.bus_name,
        licensePlate: row.license_plate,
        createdAt: row.created_at,
      };
    });

    res.json({ schedules });
  } catch (err) {
    console.error('GET /admin/schedules error:', err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.post('/admin/schedules', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { busLineId, busId, driverId, startTime, weekdays } = req.body;

    if (!busLineId || !busId || !startTime) {
      return res.status(400).json({ error: 'missing_required_fields: busLineId, busId, startTime required' });
    }

    // Validate weekdays - should be array of day numbers (0-6) or empty for single schedule
    const scheduleWeekdays = Array.isArray(weekdays) && weekdays.length > 0 
      ? weekdays.map(w => Number(w)).filter(w => w >= 0 && w <= 6)
      : [];

    if (DEV_MOCK) {
      if (!_mock.schedules) _mock.schedules = [];
      
      // Find the bus line to get duration
      const busLine = _mock.busLines.find(bl => bl.id == busLineId);
      if (!busLine) {
        return res.status(404).json({ error: 'bus_line_not_found' });
      }

      const startDate = new Date(startTime);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + (busLine.estimatedDurationMinutes || 60));

      // Calculate departure times for stops
      const departureTimes = calculateDepartureTimes(startTime, Number(busLineId), _mock);

      const schedule = {
        id: (_mock.nextScheduleId || 1),
        busLineId,
        busId,
        driverId: driverId ? Number(driverId) : null,
        startTime,
        endTime: endDate.toISOString(),
        weekdays: scheduleWeekdays,
        departureTimes,
        status: 'planned',
        createdAt: new Date().toISOString(),
      };
      _mock.nextScheduleId = ((_mock.nextScheduleId || 1) + 1);
      _mock.schedules.push(schedule);
      return res.status(201).json({ schedule });
    }

    // Database mode (production)
    const busLine = await db.query('SELECT estimated_duration_minutes FROM transit.bus_lines WHERE id = $1', [busLineId]);
    if (!busLine.rows[0]) {
      return res.status(404).json({ error: 'bus_line_not_found' });
    }

    const startDate = new Date(startTime);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + (busLine.rows[0].estimated_duration_minutes || 60));

    // Check if weekdays column exists before including it in INSERT
    const hasWeekdaysColumn = await db.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='transit' AND table_name='schedules' AND column_name='weekdays'
    `);
    
    let result;
    if (hasWeekdaysColumn.rows.length > 0) {
      result = await db.query(`
        WITH next_id AS (
          SELECT COALESCE(MAX(id), 0) + 1 AS id FROM transit.schedules
        )
        INSERT INTO transit.schedules (id, bus_line_id, bus_id, driver_id, start_time, end_time, status, weekdays)
        SELECT next_id.id, $1, $2, $3, $4, $5, 'planned', $6
        FROM next_id
        RETURNING id, bus_line_id, bus_id, driver_id, start_time, end_time, status, weekdays, created_at
      `, [busLineId, busId, driverId || null, startTime, endDate.toISOString(), JSON.stringify(scheduleWeekdays)]);
    } else {
      result = await db.query(`
        WITH next_id AS (
          SELECT COALESCE(MAX(id), 0) + 1 AS id FROM transit.schedules
        )
        INSERT INTO transit.schedules (id, bus_line_id, bus_id, driver_id, start_time, end_time, status)
        SELECT next_id.id, $1, $2, $3, $4, $5, 'planned'
        FROM next_id
        RETURNING id, bus_line_id, bus_id, driver_id, start_time, end_time, status, created_at
      `, [busLineId, busId, driverId || null, startTime, endDate.toISOString()]);
    }

    const schedule = result.rows[0];
    const departureTimes = calculateDepartureTimes(startTime, busLineId, _mock);

    const weekdaysResult = parseWeekdaysValue(schedule.weekdays);

    res.status(201).json({
      schedule: {
        id: schedule.id,
        busLineId: schedule.bus_line_id,
        busId: schedule.bus_id,
        driverId: schedule.driver_id,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        weekdays: weekdaysResult,
        departureTimes,
        status: schedule.status,
        createdAt: schedule.created_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.delete('/admin/schedules/:scheduleId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { scheduleId } = req.params;

    if (!scheduleId || !Number.isFinite(Number(scheduleId))) {
      return res.status(400).json({ error: 'invalid_schedule_id' });
    }

    if (DEV_MOCK) {
      if (!_mock.schedules) _mock.schedules = [];
      const index = _mock.schedules.findIndex(s => Number(s.id) === Number(scheduleId));
      if (index === -1) {
        return res.status(404).json({ error: 'schedule_not_found' });
      }
      const deleted = _mock.schedules.splice(index, 1)[0];
      return res.json({ success: true, schedule: deleted });
    }

    const result = await db.query(
      `DELETE FROM transit.schedules WHERE id = $1 RETURNING id`,
      [scheduleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'schedule_not_found' });
    }

    res.json({ success: true, schedule: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// PUBLIC - Get schedules (for public timetable)
// ============================================
app.get('/schedules', async (req, res) => {
  try {
    const { date, lineId } = req.query;

    if (DEV_MOCK) {
      return res.json({ schedules: _mock.schedules || [] });
    }

    let query = `
      SELECT 
        s.id,
        s.bus_line_id,
        s.bus_id,
        s.start_time,
        s.end_time,
        s.weekdays,
        s.status,
        bl.line_number,
        b.name as bus_name
      FROM transit.schedules s
      LEFT JOIN transit.bus_lines bl ON s.bus_line_id = bl.id
      LEFT JOIN fleet.bus b ON s.bus_id = b.id
      WHERE s.status IN ('planned', 'active')
    `;

    const params = [];

    if (date) {
      query += ` AND DATE(s.start_time) = $${params.length + 1}`;
      params.push(date);
    }

    if (lineId) {
      query += ` AND s.bus_line_id = $${params.length + 1}`;
      params.push(lineId);
    }

    query += ` ORDER BY s.start_time ASC`;

    const result = await db.query(query, params);

    res.json({
      schedules: result.rows.map(row => ({
        id: row.id,
        busLineId: row.bus_line_id,
        busId: row.bus_id,
        startTime: row.start_time,
        endTime: row.end_time,
        weekdays: row.weekdays ? (typeof row.weekdays === 'string' ? JSON.parse(row.weekdays) : row.weekdays) : [],
        status: row.status,
        lineNumber: row.line_number,
        busName: row.bus_name,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

app.get('/schedules/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;

    if (DEV_MOCK) {
      const schedule = (_mock.schedules || []).find(s => Number(s.id) === Number(scheduleId));
      if (!schedule) {
        return res.status(404).json({ error: 'schedule_not_found' });
      }
      return res.json({ schedule });
    }

    const result = await db.query(`
      SELECT 
        s.id,
        s.bus_line_id,
        s.bus_id,
        s.start_time,
        s.end_time,
        s.status,
        bl.line_number,
        bl.start_stop,
        bl.end_stop,
        b.name as bus_name,
        b.license_plate
      FROM transit.schedules s
      LEFT JOIN transit.bus_lines bl ON s.bus_line_id = bl.id
      LEFT JOIN fleet.bus b ON s.bus_id = b.id
      WHERE s.id = $1
    `, [scheduleId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'schedule_not_found' });
    }

    const row = result.rows[0];
    res.json({
      schedule: {
        id: row.id,
        busLineId: row.bus_line_id,
        busId: row.bus_id,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        lineNumber: row.line_number,
        startStop: row.start_stop,
        endStop: row.end_stop,
        busName: row.bus_name,
        licensePlate: row.license_plate,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// ============================================
// PUBLIC - Get stops for a schedule's line
// ============================================
app.get('/schedules/:scheduleId/stops', async (req, res) => {
  try {
    const { scheduleId } = req.params;

    if (DEV_MOCK) {
      const schedule = (_mock.schedules || []).find(s => Number(s.id) === Number(scheduleId));
      if (!schedule) {
        return res.status(404).json({ error: 'schedule_not_found' });
      }
      const routeStops = (_mock.routeStops || [])
        .filter(rs => Number(rs.busLineId) === Number(schedule.busLineId))
        .sort((a, b) => a.stopOrder - b.stopOrder);
      return res.json({ stops: routeStops });
    }

    const scheduleResult = await db.query(
      `SELECT bus_line_id FROM transit.schedules WHERE id = $1`,
      [scheduleId]
    );

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'schedule_not_found' });
    }

    const busLineId = scheduleResult.rows[0].bus_line_id;

    const stopsResult = await db.query(`
      SELECT 
        rs.id,
        rs.stop_order,
        s.name,
        s.latitude,
        s.longitude,
        rs.estimated_arrival_minutes
      FROM transit.route_stops rs
      JOIN transit.stops s ON s.id = rs.stop_id
      WHERE rs.bus_line_id = $1
      ORDER BY rs.stop_order ASC
    `, [busLineId]);

    res.json({
      stops: stopsResult.rows.map(row => ({
        id: row.id,
        order: row.stop_order,
        name: row.name,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        estimatedArrivalMinutes: row.estimated_arrival_minutes,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Transit API listening on ${PORT}`));

module.exports = app;
