# Schedule Maker & Public Timetable API

## Features

The Transit API now includes a comprehensive schedule management system with both admin and public endpoints.

### Admin Endpoints (requires authentication + admin privileges)

#### Get all schedules
```
GET /admin/schedules
Response: { schedules: [...] }
```

#### Create a schedule
```
POST /admin/schedules
Body: {
  busLineId: number,
  busId: number,
  driverId: number (optional),
  startTime: "2026-05-06T08:00:00",
  endTime: "2026-05-06T17:00:00"
}
Response: { schedule: {...} }
```

#### Delete a schedule
```
DELETE /admin/schedules/:scheduleId
Response: { success: true, schedule: {...} }
```

### Public Endpoints (no authentication required)

#### Get schedules (with optional filters)
```
GET /schedules?date=2026-05-06&lineId=1
Query params:
  - date: YYYY-MM-DD (optional)
  - lineId: number (optional)
Response: { schedules: [...] }
```

#### Get schedule detail
```
GET /schedules/:scheduleId
Response: { schedule: {...} }
```

#### Get stops for a schedule's line
```
GET /schedules/:scheduleId/stops
Response: { stops: [...] }
Shows all stops on the bus line with order, location, and ETA.
```

## Admin UI Features

The ScheduleMaker component provides:

1. **Service Creation Form**
   - Select bus line, vehicle, date, and time
   - Optional driver ID assignment
   - Submit to create schedule
   - Admin-only access

2. **Timetable View**
   - 24-hour time slots (hourly grouping)
   - Services displayed in corresponding time slots
   - Shows line number, vehicle name, and license plate
   - Delete button for each service (admin only)
   - Color-coded schedule cards with gradient styling

3. **Drag-and-Drop Ready**
   - Schedule cards are draggable (extensible for drag-to-reorder)
   - Follows existing UI/UX patterns from LinkStop component

4. **Confirmation Modals**
   - Delete confirmation before removing schedules
   - Shows service details in confirmation
   - Prevents accidental deletions

## Public Timetable Viewer

The TimetableViewer component provides a public-facing schedule display:

```jsx
import TimetableViewer from './components/TimetableViewer'

<TimetableViewer apiBaseUrl="http://api.transit.local:5001" />
```

Features:
- Filter by date and bus line
- Real-time loading state
- Error handling
- Status badges (planned/active)
- Responsive table layout
- No authentication required

## Development Mode

With `DEV_MOCK=1`, all schedule operations work in-memory without a database.

Example:
```bash
ADMIN_USER_CODES=42 DEV_MOCK=1 JWT_SECRET=devsecret npm --prefix ./transit_api start
```

## Database Schema (Production)

```sql
CREATE TABLE transit.schedules (
  id BIGINT PRIMARY KEY,
  bus_line_id BIGINT REFERENCES transit.bus_lines(id),
  bus_id BIGINT REFERENCES fleet.bus(id),
  driver_id INTEGER,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Styling & UX

The schedule manager uses:

### Admin Timetable Styling
- Responsive table with hourly time slots
- Gradient schedule cards (blue/indigo theme)
- Hover effects and smooth transitions
- Grab cursor on draggable items
- Danger buttons for delete actions (red)
- Confirmation modals with semi-transparent overlay

### Public Timetable Styling
- Clean, simple table layout
- Status badges (green for active, gray for planned)
- Mobile-responsive with scrolling
- Consistent with existing design language

## Integration Points

1. **Admin Dashboard**: ScheduleMaker appears at the bottom of Admin Control Center
2. **Public API**: Available via public `/schedules` endpoints without authentication
3. **Flutter App**: TimetableViewer can be embedded or used as reference for mobile implementation
4. **Frontend Flexibility**: TimetableViewer component is reusable for any public-facing website

## Example Usage

### Create a schedule (Admin)
```bash
curl -X POST http://localhost:5001/admin/schedules \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "busLineId": 1,
    "busId": 5,
    "driverId": 101,
    "startTime": "2026-05-06T08:00:00",
    "endTime": "2026-05-06T17:00:00"
  }'
```

### Get today's schedules (Public)
```bash
curl http://localhost:5001/schedules?date=$(date +%Y-%m-%d)
```

### Get schedules for specific line (Public)
```bash
curl http://localhost:5001/schedules?lineId=3
```

## Future Enhancements

- Bulk schedule import from CSV
- Recurring schedule templates (weekly, daily patterns)
- Driver shift assignment with time tracking
- Real-time schedule updates and notifications
- Schedule conflict detection
- Integration with GPS tracking for actual vs scheduled times
- Historical schedule analytics

