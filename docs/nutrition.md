# Nutrition tracking

Voice- and text-based meal logging with AI calorie/macro estimates, daily progress, trends, and CSV export.

## Overview

Open **Nutrition** in the Cortex nav to:

1. Tap the microphone (or type) to describe a meal
2. Review the AI estimate and edit values before saving
3. Track daily calories, protein, carbs, fat, and fiber against your targets
4. View a 7-day trend and export your log as CSV (Excel-compatible)

All nutrition APIs require Cortex authentication (JWT + PIN). AI keys stay on the server.

## Environment variables

Add to `backend/.env` or homelab `deploy/homelab/env/api.env`:

```env
# Provider: openai | anthropic | mock
NUTRITION_AI_PROVIDER=openai
NUTRITION_AI_MODEL=
NUTRITION_AI_API_KEY=

# Dev / homelab without paid API calls:
NUTRITION_AI_MOCK=true

# Optional — falls back to OPENAI_API_KEY or ANTHROPIC_API_KEY
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=...

# Request timeout (ms, default 45000)
NUTRITION_AI_TIMEOUT_MS=45000
```

| Variable | Description |
|----------|-------------|
| `NUTRITION_AI_PROVIDER` | `openai`, `anthropic`, or `mock` |
| `NUTRITION_AI_MODEL` | Override model (defaults: `OPENAI_MODEL` / `ANTHROPIC_MODEL`) |
| `NUTRITION_AI_API_KEY` | Dedicated key; otherwise uses provider default env key |
| `NUTRITION_AI_MOCK` | `true` — sample estimates, no API cost |
| `NUTRITION_AI_TIMEOUT_MS` | AI request timeout |

## Select AI provider

- **OpenAI (default):** `NUTRITION_AI_PROVIDER=openai` + `OPENAI_API_KEY` or `NUTRITION_AI_API_KEY`
- **Anthropic:** `NUTRITION_AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` or `NUTRITION_AI_API_KEY`
- **Mock (dev):** `NUTRITION_AI_MOCK=true` or `NUTRITION_AI_PROVIDER=mock`

Health: `GET /api/health` includes `nutrition_ai` status; `GET /api/nutrition/status` when authenticated.

## Database migration

```bash
npm run db:migrate
```

Creates the `NutritionEntry` table. Homelab production runs migrations automatically on API startup.

## Mock mode

Set `NUTRITION_AI_MOCK=true` (or `NUTRITION_AI_PROVIDER=mock`) to return deterministic sample data — useful for local dev and tests without billing.

## Testing

```bash
cd backend && npm test -- src/tests/nutrition.test.ts
cd backend && npm run lint
cd frontend && npm run typecheck
```

## Voice logging on iPhone

1. Open Cortex in **Safari** over your Tailscale URL (or add to Home Screen as a PWA).
2. Go to **Nutrition** → tap the **microphone** button (explicit tap required).
3. Allow microphone access when Safari prompts.
4. Speak your meal; the transcript appears in the text field — edit if needed.
5. Tap **Estimate nutrition** — review before saving.

Speech uses the browser Web Speech API (`webkitSpeechRecognition` on Safari). Unsupported browsers show a type-only fallback.

## Daily macro targets

On the Nutrition page, use **Daily targets** to set calorie and macro goals manually. Values are stored in `UserSettings.extraJson.nutritionTargets` (synced per user).

## Export

**Export nutrition log** downloads a CSV for the current week range. Open in Excel or Google Sheets.

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/nutrition/estimate` | AI estimate (no DB write) |
| POST | `/api/nutrition/entries` | Save reviewed entry |
| GET | `/api/nutrition/entries?from=&to=` | List by date range |
| GET/PATCH/DELETE | `/api/nutrition/entries/:id` | CRUD |
| GET | `/api/nutrition/totals/today` | Today's totals |
| GET | `/api/nutrition/totals?date=` | Date totals |
| GET | `/api/nutrition/totals/weekly` | 7-day view + averages |
| GET/PATCH | `/api/nutrition/targets` | Daily targets |
| GET | `/api/nutrition/export?from=&to=` | CSV download |

## Limitations (v1)

- Estimates are approximate — not medical advice
- CSV export only (Excel opens CSV natively)
- Weekly totals use UTC date boundaries
- Speech recognition quality varies by browser/device
- Anthropic provider does not use structured output mode (JSON parsed server-side)

## Suggested next steps

- Barcode / photo meal logging
- Timezone-aware daily totals
- Native `.xlsx` export
- Nutrition widget on the home canvas
