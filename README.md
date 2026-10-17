# BreathFresh

**AI-powered smoking cessation companion** — track cravings, follow a personalized quit plan, visualize organ recovery, and get firm, supportive coaching when urges hit.

Built for demo / competition evaluation. Clone, sign in with the demo account, or use the live links below.

---

## Live demo

| Service | URL |
|--------|-----|
| **Web app (frontend)** | https://breathfresh.vercel.app |
| **Chat / plan API** | https://breathfresh-production.up.railway.app/api |
| **API health** | https://breathfresh-production.up.railway.app/api/health |
| **Source** | https://github.com/Alyy7o/BreathFresh |

> If Cloudflare Workers is also configured: `https://breathfresh.metadors.dev`

---

## Demo login (judges / evaluators)

Use this account for a full walkthrough without registering:

| Field | Value |
|-------|--------|
| **Email** | `demo@gmail.com` |
| **Password** | `demo@1234` |

After login you can explore Dashboard, Progress, Organ Health, Quit Plan, Chat, Resources, Craving Log, and Profile.

---

## What BreathFresh does

- **Quit coaching chat** — Groq-powered AI that refuses “just one cigarette” and redirects to coping actions (breathing, delay, water, gum).
- **7-day quit plan** — personalized plan generation via the backend API.
- **Progress & craving log** — track smoke-free days, triggers, and urge intensity.
- **Organ health visualization** — see recovery-focused health visuals as you quit.
- **Resources hub** — articles, YouTube videos (Watch opens the real link), and success stories.
- **Professional consultations & alternatives** — specialists and healthier substitutions.
- **PWA-ready UI** — installable mobile-friendly React app with bottom nav + sidebar.
- **Admin content tools** — manage resources and specialists (admin role).

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Auth & DB | Supabase (Auth, Postgres, RLS) |
| AI chat / plans | FastAPI + **Groq** (`openai/gpt-oss-120b`) |
| Hosting | Frontend → **Vercel**; API → **Railway** (Docker) |
| FAQ assist | Lightweight keyword context (no heavy local models on Railway) |

---

## Architecture (high level)

```
Browser (Vercel SPA)
    │
    ├── Supabase  →  auth, profiles, progress, resources, chat history
    │
    └── /api/*    →  Railway FastAPI
                        ├── POST /api/chat
                        ├── POST /api/generate-plan
                        └── GET  /api/health
                              └── Groq LLM + FAQ keywords
```

---

## Quick start (local)

### Prerequisites

- Node.js **18+**
- Python **3.11+**
- Supabase project (or use the existing hosted one via env vars)
- Groq API key ([console.groq.com](https://console.groq.com))

### 1. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` (or copy from your secrets store):

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_API_BASE_URL=https://breathfresh-production.up.railway.app/api
```

For local API instead:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

```bash
npm run dev
```

App: http://localhost:5173  
Login with **`demo@gmail.com` / `demo@1234`**.

### 2. Backend (optional if using Railway)

```bash
cd backend/chat_model
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/chat_model/.env`:

```env
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=openai/gpt-oss-120b
```

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Health check: http://127.0.0.1:8000/api/health

---

## Competition walkthrough (suggested)

1. Open the **live web app** → sign in with demo credentials above.
2. **Dashboard** — smoke-free overview and entry points.
3. **Chat** — ask: *“should I try a cigarette?”* → expect a clear **No** + coping steps.
4. **Quit Plan** — generate / view a structured plan.
5. **Organ Health** — explore recovery visuals.
6. **Resources → Videos** — tap **Watch** to open real YouTube links.
7. **Craving Log / Progress** — log an urge and review trends.

---

## Environment variables

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon / publishable key |
| `VITE_API_BASE_URL` | Chat API base (…`/api`) |

### Backend (`backend/chat_model/.env`)

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Groq API key (required for chat & plans) |
| `GROQ_MODEL` | Defaults to `openai/gpt-oss-120b` |

Do **not** commit real API keys. Demo email/password above are intentional for evaluators.

---

## Project structure

```
BreathFresh/
├── backend/chat_model/          # FastAPI + Groq chatbot & quit-plan API
│   ├── pipeline/                # chatbot, groq_client, FAQ helpers, plan generator
│   ├── server.py                # HTTP routes
│   ├── Dockerfile               # Railway image
│   └── requirements.txt
├── frontend/                    # React PWA (Vercel)
│   ├── src/pages/               # Dashboard, Chat, Progress, Resources, …
│   ├── src/integrations/        # Supabase + chat API clients
│   ├── supabase/migrations/     # Schema & RLS
│   └── vercel.json              # SPA rewrites + /api proxy to Railway
├── vercel.json                  # Root rewrites (monorepo deploy)
└── README.md
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness + provider |
| `GET` | `/api/status` | Chatbot status |
| `POST` | `/api/chat` | Body: `{ "message": "..." }` |
| `POST` | `/api/generate-plan` | Quit-plan generation |

Example:

```bash
curl -X POST https://breathfresh-production.up.railway.app/api/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"I have a strong craving right now\"}"
```

---

## Deploy notes

- **Frontend:** push to `main` → Vercel builds `frontend/`. SPA fallback + `/api/*` rewrite to Railway are in `vercel.json`.
- **Backend:** Railway Root Directory = `backend/chat_model`, Dockerfile deploy. Set `GROQ_API_KEY` and `GROQ_MODEL` in Railway variables.
- **Supabase Auth URLs:** add production site URL(s) under Authentication → URL configuration (e.g. `https://breathfresh.vercel.app/**`).

---

## Team / academic context

BreathFresh is a Final Year Project (FYP) focused on digital support for smoking cessation — combining behavior tracking, educational resources, and preventive AI coaching in one product experience.

---

## License

All rights reserved for academic / competition submission unless otherwise stated by the authors.
