# FleetMind v2 — AI Fleet Management Copilot

> *"The fleet manager that never sleeps."*

**Geotab Vibe Coding Challenge 2026** — Full-stack AI fleet management copilot + autonomous monitoring agent built entirely through vibe coding with AI assistance.

> **📖 [Read the Vibecoding Story](vibecoding-story.md)** — A behind-the-scenes look at every prompt used to build FleetMind, from an empty directory to a fully deployed app. No code was hand-written — just iterative AI conversations.

---

## What It Does

FleetMind is a conversational AI copilot for fleet managers. Instead of clicking through dashboards, managers ask questions in plain English and get instant, data-backed answers with actionable recommendations.

### Current Status / Known Notes

- Live GPS and breadcrumbs come from `LogRecord`; the mini replay is a lightweight SVG polyline. If no points exist for the selected window, the GPS card shows an empty-state message.
- Alerts are deduped (10-min window per device+rule) and capped at 100; info-level noise older than 24h is pruned, but warning/critical always persist.
- Geofence list is filtered to the accessible company group — only user-created zones appear, preventing delete errors on system zones.
- Geofence delete returns `{ success: true }` on success (Geotab's Remove API returns undefined which is not JSON-serializable).
- Driver safety/DNA/DVIR all use `User` with `isDriver: true` (Geotab rejects the `Driver` type on this server).
- MultiCall is attempted first; falls back to sequential individual calls if the server returns a MultiCall-not-found error.

### Core Features

| Feature | Description |
|---|---|
| **AI Morning Briefing** | Executive-level fleet summary with 3 prioritized action items |
| **Driver Safety Intelligence** | Ranked driver list with event-based coaching notes (no mock text) |
| **Fuel Anomaly Detection** | Outlier identification with dollar waste estimates |
| **Maintenance Prioritization** | Priority queue with CRITICAL / DUE / UPCOMING urgency |
| **Live Fleet Status** | Real-time sidebar — Active / Stopped / Idling / Offline, 60s refresh + GetFeed polling |
| **Live GPS Replay** | Breadcrumb fetch via LogRecord with mini SVG replay per vehicle |
| **Geofences** | Create/delete zones (auto-grouped), list existing, raise entry/exit alerts |
| **DVIR Snapshot** | Latest inspections, defects open/critical |
| **Driver DNA Profiles** | Spotify Wrapped-style personality cards with radar charts & archetype names |
| **Voice Input** | Hands-free fleet queries via Web Speech API |
| **PDF Export** | One-click downloadable fleet report with DNA profiles |
| **Smart Alerts** | Auto-generated fleet alerts from real-time anomaly detection |
| **MyGeotab Add-In** | Native integration as embeddable morning briefing page |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│           FLEETMIND v2 ARCHITECTURE              │
├─────────────────────────────────────────────────┤
│                                                  │
│  FRONTEND (Next.js 16 + React 19)                │
│  ├── Chat UI (Vercel AI SDK useChat)             │
│  ├── Voice Input (Web Speech API)                │
│  ├── Driver DNA Cards (Recharts + Framer Motion) │
│  ├── Live Fleet Sidebar (Zustand)                │
│  └── PDF Export (jsPDF)                          │
│                                                  │
|  AI BACKEND (Next.js API Routes)                 │
|  ├── /api/chat — streamText + tools              │
|  ├── /api/fleet-status — live vehicle counts     │
|  ├── /api/gps-traces — LogRecord breadcrumbs     │
|  ├── /api/geofence — Zone CRUD (JSON-RPC)        │
|  ├── /api/dvir — DVIRLog summary                 │
|  └── /api/feed — GetFeed(Exception/Status/Logs)  │
│                                                  │
|  AI ENGINE                                       │
|  ├── Google Gemini 2.0 Flash (@ai-sdk/google)    │
|  └── Tools: fleet_status, driver_safety,         │
|      fuel_analysis, maintenance_alerts,          │
|      morning_briefing, driver_dna, gps_traces,   │
|      geofence, dvir, ace_analytics                │
│                                                  │
|  DATA LAYER                                      │
|  ├── Geotab JSON-RPC API (direct fetch)          │
|  ├── Session caching + auto-retry                │
|  └── MultiCall with fallback to sequential calls  │
│                                                  │
│  DEPLOYMENT                                      │
│  └── Firebase App Hosting (Cloud Run + Node 20)  │
│                                                  │
│  MYGEOTAB ADD-IN                                 │
│  └── Standalone HTML briefing page               │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router + Turbopack) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 |
| AI Model | Google Gemini 2.0 Flash |
| AI SDK | Vercel AI SDK v4 (streamText + tool calling) |
| State | Zustand v5 |
| Charts | Recharts v2 |
| Animations | Framer Motion v12 |
| PDF | jsPDF + html2canvas |
| Voice | Web Speech API (native) |
| Fleet API | Geotab JSON-RPC (direct fetch) |
| MCP | @modelcontextprotocol/sdk v1 |
| Icons | Lucide React |

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Geotab demo account credentials
- Google AI Studio API key (free)

### Setup

```bash
# Clone the repository
git clone https://github.com/AryanSaxenaa/fleetmind.git
cd fleetmind

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development server
pnpm dev
```

### Environment Variables

Create `.env.local` in the project root:

```env
# Google AI
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# Geotab
GEOTAB_DATABASE=your_database
GEOTAB_USERNAME=your_email
GEOTAB_PASSWORD=your_password
GEOTAB_SERVER=my.geotab.com
```

---

## Project Structure

```
fleetmind/
├── app/
│   ├── api/
│   │   ├── chat/route.ts        # AI chat endpoint (6 tools)
│   │   ├── driver-dna/route.ts  # DNA profile endpoint
│   │   └── fleet-status/route.ts# Live fleet counts
│   ├── dna/page.tsx             # Driver DNA page
│   ├── page.tsx                 # Main chat + sidebar
│   ├── layout.tsx               # Root layout (dark theme)
│   └── globals.css              # Tailwind v4 theme
├── components/
│   ├── chat/
│   │   ├── ChatPanel.tsx        # AI chat interface
│   │   ├── MessageBubble.tsx    # Markdown renderer (bold, tables, lists)
│   │   ├── QuickActions.tsx     # 5 quick action buttons
│   │   └── VoiceInput.tsx       # Web Speech API mic
│   ├── dna/
│   │   ├── DriverDNACard.tsx    # Spotify Wrapped-style card
│   │   ├── DriverDNAGrid.tsx    # Responsive card grid
│   │   └── RadarChart.tsx       # 5-axis Recharts radar
│   ├── export/
│   │   └── ExportButton.tsx     # PDF report generator
│   └── fleet/
│       └── FleetSidebar.tsx     # Live status + alert feed
├── lib/
│   ├── geotab.ts                # Direct JSON-RPC client
│   ├── utils.ts                 # Shared utilities
│   └── tools/
│       ├── fleet-status.ts      # Fleet status tool
│       ├── driver-safety.ts     # Driver safety tool
│       ├── fuel-analysis.ts     # Fuel analysis tool
│       ├── maintenance-alerts.ts# Maintenance tool
│       ├── morning-briefing.ts  # Morning briefing tool
│       └── driver-dna.ts        # Driver DNA tool
├── store/
│   └── fleet-store.ts           # Zustand state + alerts
├── mcp/
│   └── server.ts                # Standalone MCP server
├── addin/
│   ├── fleetmind-briefing.html  # MyGeotab Add-In page
│   └── fleetmind-briefing-config.json
└── types/
    └── global.d.ts              # TypeScript declarations
```

---

## Demo Flow

1. **Open FleetMind** — see time-aware greeting + live fleet sidebar
2. **"Morning briefing"** — AI generates executive summary with 3 action items
3. **"Who needs coaching?"** — ranked driver safety with personalized coaching
4. **"Show Driver DNA"** — animated Spotify Wrapped-style personality cards
5. **"Any fuel waste?"** — anomaly detection with dollar estimates  
6. **Click Export** — download professional PDF report
7. **Use voice** — hands-free fleet queries via microphone
8. **MyGeotab Add-In** — import config for native integration

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Direct JSON-RPC instead of mg-api-js | mg-api-js failed in Next.js server runtime; direct fetch is more reliable |
| Vercel AI SDK tool() instead of MCP client | Simpler integration, no stdio transport overhead in serverless |
| Tailwind v4 @theme inline | Future-proof, no separate config file |
| Zustand over Context | Shared state across sidebar + chat + DNA without prop drilling |
| Engine hours for maintenance | Demo database has engine hours but no odometer data |
| Index-based DNA gradients | Ensures visual variety regardless of archetype name |

---

## Google Tools Integration

- **Google Gemini 2.0 Flash** — Powers all AI reasoning via @ai-sdk/google
- **Google AI Studio** — API key management (free tier)
- **Vercel AI SDK** — Google-native streaming and tool calling
- **Firebase App Hosting** — Production deployment on Cloud Run (Node 20, auto-deploy from GitHub `main`)

---

## Vibe Coding Approach

This entire project was built through conversational AI assistance — every component, route, tool, and style was generated through natural language prompts. The AI agent:

1. Read the Geotab Vibe Guide documentation
2. Scaffolded the project structure
3. Implemented each feature end-to-end following the steering guide
4. Fixed bugs by reading error output and iterating
5. Applied UI polish based on the design system spec

No code was hand-written — it's pure vibe coding from spec to ship.

---

## Deployment (Firebase App Hosting)

FleetMind is deployed on **Firebase App Hosting** (Cloud Run, Node 20) with continuous deployment from the `main` branch.

### Required secrets (set once via Firebase CLI)

```bash
firebase apphosting:secrets:set GOOGLE_GENERATIVE_AI_API_KEY
firebase apphosting:secrets:set GEOTAB_DATABASE
firebase apphosting:secrets:set GEOTAB_USERNAME
firebase apphosting:secrets:set GEOTAB_PASSWORD
```

### Grant backend access

```bash
firebase apphosting:secrets:grantaccess GOOGLE_GENERATIVE_AI_API_KEY --backend fleetmind
firebase apphosting:secrets:grantaccess GEOTAB_DATABASE --backend fleetmind
firebase apphosting:secrets:grantaccess GEOTAB_USERNAME --backend fleetmind
firebase apphosting:secrets:grantaccess GEOTAB_PASSWORD --backend fleetmind
```

### Deploy

Every `git push` to `main` triggers an automatic build and deploy. No manual steps needed after initial setup.

```bash
git push
```

Monitor builds at: `https://console.firebase.google.com/project/geotab-65dad/apphosting`

---

## License

MIT

---

*FleetMind v2 — From data to decision, in one conversation.*
