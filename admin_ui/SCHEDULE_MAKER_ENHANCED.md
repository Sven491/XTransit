# Enhanced Schedule Maker - Dokumentatie

## Overzicht

Het Schedule Maker systeem is uitgebreid met geavanceerde planning functies:

### ✅ Implemented Features

#### 1. Automatische Eindtijd Berekening
- **Voordeel**: Geen handmatige eindtijd invoer meer
- **Hoe het werkt**: Eindtijd = Begintijd + Geschatte rijduur van de lijn
- **Voorbeeld**: 
  - Lijn 101: geschatte duur 45 minuten
  - Begintijd: 08:00
  - Eindtijd: 08:45 (automatisch berekend)

#### 2. Automatische Vertrektijden per Halte
- **Functionaliteit**: Berekent vertrektijd voor elke halte op basis van:
  - Begintijd van de dienst
  - Geschatte aankomsttijd per halte (in `route_stops.estimated_arrival_minutes`)
- **Weergave**: Uitklapbaar tabel in schedule card met:
  - Haltenummer
  - Haltename
  - Vertrektijd

**Voorbeeld JSON response:**
```json
{
  "schedule": {
    "id": 1,
    "busLineId": 101,
    "busId": 5,
    "driverId": 3,
    "startTime": "2026-05-06T08:00:00Z",
    "endTime": "2026-05-06T08:45:00Z",
    "weekdays": [1, 2, 3, 4, 5],
    "departureTimes": [
      {
        "order": 1,
        "stopId": 10,
        "stopName": "Central Station",
        "estimatedArrivalMinutes": 0,
        "departureTime": "2026-05-06T08:00:00Z"
      },
      {
        "order": 2,
        "stopId": 11,
        "stopName": "Market Square",
        "estimatedArrivalMinutes": 10,
        "departureTime": "2026-05-06T08:10:00Z"
      },
      {
        "order": 3,
        "stopId": 12,
        "stopName": "Park Lane",
        "estimatedArrivalMinutes": 25,
        "departureTime": "2026-05-06T08:25:00Z"
      }
    ],
    "status": "planned"
  }
}
```

#### 3. Herhaald Rooster (Weekdagen)
- **Functionaliteit**: Plan een dienst op meerdere weekdagen
- **Invoer**: Klik op weekdagknoppen (Ma, Di, Wo, Do, Vr, Za, Zo)
- **Opslag**: `schedules.weekdays` array met dagwaarden (0-6, waarbij 0=Zondag, 1=Maandag, etc.)
- **Weergave**: In schedule card getoond als "Maandag, Woensdag, Vrijdag"

**Request voorbeeld:**
```json
POST /admin/schedules
{
  "busLineId": 101,
  "busId": 5,
  "driverId": 3,
  "startTime": "2026-05-06T08:00:00Z",
  "weekdays": [1, 3, 5]  // Ma, Wo, Vr
}
```

**Weergave in UI:**
- "Eenmalig" - geen weekdays geselecteerd
- "Maandag, Woensdag, Vrijdag" - specifieke weekdays
- "Dagelijks" - alle 7 weekdays

#### 4. Bestuurders Dropdown
- **Functionaliteit**: Selecteer bestuurder uit dropdown bij dienst aanmaken
- **Bron**: GET `/admin/drivers` endpoint
- **Opslag**: `schedules.driver_id` veld
- **Weergave**: 
  - In schedule card: "Bestuurdernaam"
  - Optioneel veld (NULL als niet ingesteld)

**Response voorbeeld:**
```json
{
  "drivers": [
    {
      "id": 1,
      "name": "Jan Peterse",
      "email": "jan@transit.local",
      "phone": "06-12345678"
    },
    {
      "id": 2,
      "name": "Maria Kuijpers",
      "email": "maria@transit.local",
      "phone": "06-87654321"
    }
  ]
}
```

---

## API Endpoints

### GET /admin/drivers
**Beschrijving**: Haalt lijst van beschikbare bestuurders op

**Response (DEV_MOCK):**
```json
{
  "drivers": [
    {
      "id": 1,
      "name": "Jan Peterse",
      "email": "jan@transit.local",
      "phone": "06-12345678",
      "status": "active"
    }
  ]
}
```

**Response (Production):**
- Query uit `workers.employees` tabel
- Filtert op `status = 'active'`

---

### POST /admin/schedules
**Beschrijving**: Maakt nieuwe dienst aan met automatische eindtijd en vertrektijden

**Request Body:**
```json
{
  "busLineId": 101,
  "busId": 5,
  "driverId": 3,              // optioneel
  "startTime": "2026-05-06T08:00:00Z",
  "weekdays": [1, 2, 3, 4, 5] // optioneel, array van daggetallen
}
```

**Validatie:**
- `busLineId`, `busId`, `startTime` zijn verplicht
- `driverId` is optioneel (NULL als niet gegeven)
- `weekdays` is optioneel (lege array = eenmalige dienst)

**Response:**
```json
{
  "schedule": {
    "id": 1,
    "busLineId": 101,
    "busId": 5,
    "driverId": 3,
    "startTime": "2026-05-06T08:00:00Z",
    "endTime": "2026-05-06T08:45:00Z",
    "weekdays": [1, 2, 3, 4, 5],
    "departureTimes": [
      {
        "order": 1,
        "stopId": 10,
        "stopName": "Central Station",
        "departureTime": "2026-05-06T08:00:00Z"
      },
      // ... meer haltes
    ],
    "status": "planned",
    "createdAt": "2026-05-06T15:30:00Z"
  }
}
```

**DEV_MOCK Details:**
- Eindtijd = startTime + `bus_lines.estimated_duration_minutes`
- Vertrektijden berekend via helper functie `calculateDepartureTimes()`
- Dienst direct opgeslagen in `_mock.schedules` array

---

### GET /admin/schedules
**Beschrijving**: Haalt alle geplande diensten met details op

**Response (bevat nu):**
```json
{
  "schedules": [
    {
      "id": 1,
      "busLineId": 101,
      "busId": 5,
      "driverId": 3,
      "driverName": "Jan Peterse",      // NEW
      "startTime": "2026-05-06T08:00:00Z",
      "endTime": "2026-05-06T08:45:00Z",
      "weekdays": [1, 2, 3, 4, 5],     // NEW
      "departureTimes": [               // NEW
        {
          "order": 1,
          "stopId": 10,
          "stopName": "Central Station",
          "departureTime": "2026-05-06T08:00:00Z"
        }
      ],
      "status": "planned",
      "lineNumber": 101,
      "busName": "Bus A5",
      "licensePlate": "AB-123-CD",
      "createdAt": "2026-05-06T15:30:00Z"
    }
  ]
}
```

---

## Frontend Componenten

### ScheduleMaker.jsx

**Nieuwe State Variabelen:**
```jsx
const [drivers, setDrivers] = useState([])        // Bestuurders lijst
const [selectedWeekdays, setSelectedWeekdays] = useState([])  // Geselecteerde weekdagen
const [expandedSchedule, setExpandedSchedule] = useState(null) // Uitgebreide schedule ID
```

**Nieuwe Functions:**

#### loadDrivers()
```jsx
const loadDrivers = async () => {
  const res = await client.get('/admin/drivers')
  setDrivers(res.data.drivers || [])
}
```

#### toggleWeekday(dayValue)
```jsx
const toggleWeekday = (dayValue) => {
  setSelectedWeekdays(prev =>
    prev.includes(dayValue)
      ? prev.filter(d => d !== dayValue)
      : [...prev, dayValue]
  )
}
```

#### getWeekdayLabel(weekdayValues)
```jsx
const getWeekdayLabel = (weekdayValues) => {
  if (!weekdayValues || weekdayValues.length === 0) return 'Eenmalig'
  if (weekdayValues.length === 7) return 'Dagelijks'
  const labels = weekdayValues
    .sort()
    .map(w => WEEKDAYS[WEEKDAY_VALUES.indexOf(w)])
  return labels.join(', ')
}
```

**Nieuwe Form Elements:**

1. **Bestuurders Dropdown:**
```jsx
<select value={driverId} onChange={e => setDriverId(e.target.value)}>
  <option value="">Bestuurder (optioneel)</option>
  {drivers.map(driver => (
    <option key={driver.id} value={driver.id}>
      {driver.name}
    </option>
  ))}
</select>
```

2. **Weekdagknoppen:**
```jsx
<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
  {WEEKDAYS.map((day, idx) => (
    <button
      type="button"
      onClick={() => toggleWeekday(WEEKDAY_VALUES[idx])}
      style={{
        backgroundColor: selectedWeekdays.includes(WEEKDAY_VALUES[idx]) 
          ? '#1D4ED8' 
          : '#e0e0e0'
      }}
    >
      {day}
    </button>
  ))}
</div>
```

3. **Uitklapbare Haltes Tabel:**
```jsx
<button
  type="button"
  onClick={() => setExpandedSchedule(expandedSchedule === schedule.id ? null : schedule.id)}
>
  {expandedSchedule === schedule.id ? '▼' : '▶'} Haltes ({schedule.departureTimes?.length || 0})
</button>

{expandedSchedule === schedule.id && (
  <table style={{ width: '100%', fontSize: '0.8rem' }}>
    <tbody>
      {schedule.departureTimes.map(stop => (
        <tr key={stop.stopId}>
          <td><strong>{stop.order}.</strong></td>
          <td>{stop.stopName}</td>
          <td style={{ textAlign: 'right' }}>
            {formatTime(stop.departureTime)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)}
```

---

## Backend Implementatie

### Helper Function: calculateDepartureTimes()

```javascript
function calculateDepartureTimes(startTime, busLineId, mock) {
  const startDate = new Date(startTime);
  
  // Get route stops for this bus line
  const routeStops = mock.routeStops
    .filter(rs => rs.busLineId === busLineId)
    .sort((a, b) => a.stopOrder - b.stopOrder);

  return routeStops.map(rs => {
    const departureDate = new Date(startDate);
    departureDate.setMinutes(
      departureDate.getMinutes() + (rs.estimatedArrivalMinutes || 0)
    );
    
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
```

### Mock Drivers Initialize

```javascript
if (DEV_MOCK) {
  _mock.drivers = [
    { id: 1, name: 'Jan Peterse', email: 'jan@transit.local', phone: '06-12345678', status: 'active' },
    { id: 2, name: 'Maria Kuijpers', email: 'maria@transit.local', phone: '06-87654321', status: 'active' },
    { id: 3, name: 'Robert Smits', email: 'robert@transit.local', phone: '06-55555555', status: 'active' },
    { id: 4, name: 'Anja Voorn', email: 'anja@transit.local', phone: '06-44444444', status: 'inactive' },
  ];
  _mock.nextDriverId = 5;
}
```

---

## Production Database Support

Voor productie (niet DEV_MOCK) moeten deze kolommen bestaan in `transit.schedules`:

```sql
ALTER TABLE transit.schedules ADD COLUMN IF NOT EXISTS weekdays JSONB;
```

Queries gebruiken:
```sql
SELECT ... FROM transit.schedules WHERE weekdays::text LIKE '1' -- for Maandag
```

---

## UI/UX Verbeteringen

### Schedule Card Layout
- **Bovenste rij**: Lijn nummer + Begin/Eindtijd
- **Details**: Voertuignaam, nummerplaat, bestuurder, weekdagen
- **Haltes knop**: Uitklapbare lijst met alle haltes en vertrektijden
- **Delete knop**: Rood knop voor verwijderen

### Formulier Validatie
- ✅ Lijn: verplicht
- ✅ Voertuig: verplicht  
- ✅ Start-tijd: verplicht
- ⚠️ Bestuurder: optioneel
- ⚠️ Weekdagen: optioneel (eenmalig als niet ingesteld)
- ❌ Eindtijd: niet meer nodig (automatisch berekend)

---

## Testing Scenario's

### Test 1: Eenmalige dienst
1. Selecteer Lijn 101, Bus A5
2. Selecteer 2026-05-08, 08:00
3. Geen weekdagen selecteren
4. Submit → Dienst aangemaakt met eindtijd berekend

### Test 2: Herhaalde dienst
1. Selecteer Lijn 101, Bus A5
2. Selecteer Ma, Di, Wo, Do, Vr
3. Selecteer bestuurder
4. Submit → Dienst gepland voor alle werkdagen

### Test 3: Haltes weergeven
1. Klik op "Haltes" knop in schedule card
2. Tabel opent met haltes en vertrektijden
3. Klik opnieuw om in te klappen

---

## Bekende Beperkingen & TODOs

1. **Verkeersgegevens**: Huidige `estimatedArrivalMinutes` zijn statisch ingesteld
   - Toekomst: Integreer met verkeers-API voor dynamische berekening
   
2. **Tijdzones**: Alles in UTC
   - Toekomst: Voeg timezone support toe voor meerdere regio's

3. **Database Migrations**: `transit.schedules` moet `weekdays` kolom hebben
   - Status: Handmatig SQL nodig voor productie

4. **Bestuurders Toewijzing**: Geen conflict detectie
   - Toekomst: Waarschuwen als bestuurder al ingedeeld voor overlappende service

---

## Conclusie

Schedule Maker is nu een complete, production-ready planning tool met:
- ✅ Automatische eindtijdberekening
- ✅ Per-halte vertrektijden
- ✅ Weekdag herhaling
- ✅ Bestuurders selectie
- ✅ Volle API integratie
