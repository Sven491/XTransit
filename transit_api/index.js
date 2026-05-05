const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const { authMiddleware } = require('./middleware');

const app = express();
app.use(express.json());
app.use(cors());

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

    const result = await db.query(`
      SELECT 
        id,
        stop_order,
        stop_name,
        latitude,
        longitude,
        estimated_arrival_minutes
      FROM route_stops
      WHERE bus_line_id = $1
      ORDER BY stop_order ASC
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
