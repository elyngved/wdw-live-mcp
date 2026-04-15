# WDW MCP Server — Cursor Rules

## What This Is
A Model Context Protocol (MCP) server exposing Walt Disney World theme park data as Claude-friendly tools. TypeScript, official MCP SDK, ThemeParks.wiki public API.

---

## ThemeParks.wiki API

Base URL: `https://api.themeparks.wiki/v1`

Endpoints:
- `GET /destinations` — all destinations and child parks with UUIDs
- `GET /entity/{uuid}` — entity metadata (name, type, location, parentId)
- `GET /entity/{uuid}/live` — live wait times, show schedules, dining availability
- `GET /entity/{uuid}/schedule` — park hours, ticketed events, Lightning Lane purchases

---

## WDW UUIDs (always use these constants, never magic strings)

```typescript
const WDW_DESTINATION_ID = "e957da41-3552-4cf6-b636-5babc5cbc4e5"

const PARK_IDS = {
  magic:     "75ea578a-adc8-4116-a54d-dccb60765ef9", // Magic Kingdom
  epcot:     "47f90d2c-e191-4239-a466-5892ef59a88b", // EPCOT
  hollywood: "288747d1-8b4f-4a64-867e-ea7c9b27bad8", // Hollywood Studios
  animal:    "1c84a229-8862-4648-9c71-378ddd2c7693", // Animal Kingdom
  typhoon:   "b070cbc5-feaa-4b87-a8c1-f94cca037a18", // Typhoon Lagoon
  blizzard:  "ead53ea5-22e5-4095-9a83-8c29300d7c63", // Blizzard Beach
}
```

Park tools accept these exact keys as input. Claude maps natural language to them via enum.

---

## Live Data Shape (`/entity/{uuid}/live`)

```typescript
interface LiveEntity {
  id: string
  name: string
  entityType: "ATTRACTION" | "SHOW" | "RESTAURANT" | "PARK"
  parkId: string | null
  status: "OPERATING" | "DOWN" | "CLOSED" | "REFURBISHMENT"
  lastUpdated: string

  queue?: {
    STANDBY?: { waitTime: number | null }
    RETURN_TIME?: {           // Lightning Lane Multi Pass (free with LLMP purchase)
      state: "AVAILABLE" | "FINISHED"
      returnStart: string | null
      returnEnd: string | null
    }
    PAID_RETURN_TIME?: {      // Lightning Lane Single Pass (paid per-ride)
      state: "AVAILABLE" | "FINISHED"
      returnStart: string | null
      returnEnd: string | null
      price: { amount: number; currency: string; formatted: string }
    }
  }

  forecast?: Array<{
    time: string        // ISO datetime on the hour
    waitTime: number
    percentage: number  // 0-100 crowd level
  }>

  operatingHours?: Array<{
    type: "Operating" | "Early Entry" | "Extended Evening"
    startTime: string
    endTime: string
  }>

  showtimes?: Array<{
    type: "Performance Time" | "Operating"
    startTime: string
    endTime: string
  }>

  diningAvailability?: Array<{
    waitTime: number
    partySize: number
  }>
}
```

---

## Schedule Shape (`/entity/{uuid}/schedule`)

```typescript
interface ScheduleEntry {
  date: string         // "YYYY-MM-DD"
  type: "OPERATING" | "TICKETED_EVENT"
  openingTime: string
  closingTime: string
  description?: string // "Early Entry" | "Extended Evening" | "Special Ticketed Event"

  purchases?: Array<{  // Only on OPERATING entries
    id: string
    name: string
    type: "PACKAGE" | "ATTRACTION"
    price: { amount: number; currency: string; formatted: string }
    available: boolean
  }>
}
```

---

## Disney Terminology

| Raw API value | Display as |
|---|---|
| `RETURN_TIME` | Lightning Lane Multi Pass (LLMP) |
| `PAID_RETURN_TIME` | Lightning Lane Single Pass (LLSP) |
| `purchases` type `"PACKAGE"` | Lightning Lane Multi Pass |
| `purchases` type `"ATTRACTION"` | Lightning Lane Single Pass |
| status `"DOWN"` | Temporarily unavailable |
| status `"REFURBISHMENT"` | Closed for refurbishment |
| `TICKETED_EVENT` "Special Ticketed Event" | Special Ticketed Event — park closes early for regular guests |

Prices are in cents (`1300` = `$13.00`). Always display the `formatted` field.

---

## Caching TTLs

| Data | TTL |
|---|---|
| Live wait times | 5 min |
| Park schedules | 60 min |
| Static entity data | 24 hr |

Cache keys: `{dataType}:{uuid}` — e.g. `live:75ea578a-...`

---

## Known Gotchas

- `waitTime: null` means queue system isn't reporting — not the same as zero
- `RETURN_TIME state: "FINISHED"` means no return times available right now (may reopen)
- `PAID_RETURN_TIME state: "FINISHED"` means sold out for the day
- The park entity itself appears in `liveData[]` with `entityType: "PARK"` — filter it out of attraction lists
- Special Ticketed Events cause early park closure for regular guests — flag this in schedule responses
- Multiple `TICKETED_EVENT` entries can exist on the same date (e.g. Early Entry + Extended Evening)
