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
  nextStopId: 1,
  nextRouteStopId: 1,
  nextBusLineId: 1,
  nextFleetBusId: 1,
};

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
      return res.json({ buses: _mock.fleetBuses.slice().sort((a, b) => a.id - b.id) });
    }

    const result = await db.query(`
      SELECT id, name, seat_capacity, license_plate
      FROM fleet.bus
      ORDER BY id ASC
    `);

    res.json({
      buses: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        seatCapacity: row.seat_capacity,
        licensePlate: row.license_plate,
      })),
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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Transit API listening on ${PORT}`));

module.exports = app;
