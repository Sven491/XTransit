# Transit API

Transit API voor het beheren van busroutes, navigatie en GPS tracking voor busbestuurders.

## Project Structuur

```
transit_api/
├── index.js           # Main API endpoints
├── middleware.js      # JWT authentication middleware
├── db.js             # PostgreSQL connection
├── schema.sql        # Database schema setup
├── package.json      # Dependencies
└── .env              # Environment variables
```

## Setup

### 1. Dependencies installeren

```bash
npm install
```

### 2. Database Schema opzetten

Voer het volgende uit in PostgreSQL:

```bash
# Via psql command line
psql -U your_user -d your_database -f schema.sql
```

Of kopieer-plak de SQL queries rechtstreeks in pgAdmin.

### 3. Environment variabelen (.env)

```
PG_HOST=localhost
PG_PORT=5432
PG_USER=your_user
PG_PASS=your_password
PG_DB=your_database
JWT_SECRET=your_jwt_secret
PORT=5001
```

### 4. API starten

```bash
npm start
```

API draait op `http://localhost:5001`

## API Endpoints

Alle endpoints vereisen een `Authorization: Bearer {token}` header.

### Schedule

**GET** `/schedule/daily?date=2024-05-05`
- Ophalen van dagplanning voor chauffeur
- Response:
```json
{
  "date": "2024-05-05",
  "routes": [
    {
      "id": 1,
      "startTime": "2024-05-05T08:00:00Z",
      "status": "scheduled",
      "busLine": {
        "lineNumber": 1,
        "startStop": "Central Station",
        "endStop": "Airport"
      },
      "busType": {
        "name": "Standard Bus",
        "seatCapacity": 50,
        "licensePlate": "BUS-001"
      }
    }
  ]
}
```

**GET** `/routes/:routeId`
- Details van een specifieke route
- Response: `{ "route": {...} }`

### Navigation

**POST** `/navigation/route`
- Opslaan van berekende route van OSRM
- Body:
```json
{
  "routeId": 1,
  "startLat": 52.5200,
  "startLon": 13.4050,
  "endLat": 52.5300,
  "endLon": 13.4150,
  "totalDistance": 15000,
  "totalDuration": 900,
  "geojson": {
    "type": "LineString",
    "coordinates": [[13.4050, 52.5200], ...]
  }
}
```

**GET** `/bus-lines/:busLineId/stops`
- Alle stops van een buslijn (voor navigatie waypoints)
- Response:
```json
{
  "stops": [
    {
      "id": 1,
      "order": 1,
      "name": "Central Station",
      "latitude": 52.5200,
      "longitude": 13.4050
    }
  ]
}
```

### GPS Tracking

**POST** `/gps/track`
- Real-time positie opslaan
- Body:
```json
{
  "routeId": 1,
  "latitude": 52.5210,
  "longitude": 13.4060,
  "speed": 45.5,
  "heading": 180,
  "accuracy": 5.0
}
```

**GET** `/gps/route/:routeId`
- Alle opgeslagen positie punten van een route
- Response:
```json
{
  "positions": [
    {
      "id": 1,
      "latitude": 52.5210,
      "longitude": 13.4060,
      "speed": 45.5,
      "heading": 180,
      "recordedAt": "2024-05-05T08:15:00Z"
    }
  ]
}
```

### Route Status

**PATCH** `/routes/:routeId/status`
- Update route status
- Body: `{ "status": "in_progress" }`
- Valid statuses: `scheduled`, `in_progress`, `completed`, `cancelled`

## Database Schema

### bus_types
- `id` - Primary key
- `name` - Bus type name (Standard Bus, etc.)
- `seat_capacity` - Number of seats
- `license_plate` - Unique license plate

### bus_lines
- `id` - Primary key
- `line_number` - Unique line number (1, 5, 12, etc.)
- `start_stop` - Start stop name
- `end_stop` - End stop name
- `estimated_duration_minutes` - Expected route duration

### routes
- `id` - Primary key
- `user_id` - Chauffeur (references workers.users)
- `bus_line_id` - Which line (references bus_lines)
- `bus_type_id` - Which bus (references bus_types)
- `start_time` - Scheduled start
- `status` - scheduled/in_progress/completed/cancelled

### navigation_routes
- `id` - Primary key
- `route_id` - Link to route (unique)
- `polyline_geojson` - GeoJSON LineString van de route
- `total_distance_meters` - Route distance
- `total_duration_seconds` - Estimated duration

### gps_tracking
- `id` - Primary key
- `route_id` - Which route
- `latitude`, `longitude` - Current position
- `speed_kmh` - Current speed
- `recorded_at` - Timestamp

## Integration met Flutter App

```dart
// In schedule_service.dart

// Save navigation route
await scheduleService.saveNavigationRoute(
  routeId: 1,
  navRoute: navigationRoute,
);

// Track GPS
await scheduleService.trackGPS(
  routeId: 1,
  currentPos: navigationPoint,
  speed: 45.5,
  heading: 180,
);

// Update route status
await scheduleService.updateRouteStatus(1, 'in_progress');
```

## Error Handling

Alle endpoints retourneren error responses:
```json
{
  "error": "error_code",
  "details": "More information"
}
```

Common errors:
- `missing_token` - No Authorization header
- `invalid_token` - Token verification failed
- `missing_required_fields` - Required data missing
- `invalid_status` - Invalid status value
- `route_not_found` - Route not found
- `unauthorized` - User doesn't own this resource
