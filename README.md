# QuitGuard – Project Setup Guide

Comprehensive instructions to set up and run the QuitGuard project, including backend (chat model), frontend (PWA), and database (Supabase).

## Overview
- Backend: Python 3.11.0 RAG chatbot with PDF ingestion and an intent classifier.
- Frontend: Vite + React PWA, integrates with Supabase for user data.
- Database: Supabase project and migrations under `frontend/supabase/`.

## Prerequisites
- Windows, macOS, or Linux.
- Python `3.11.0` (Windows: `py -3.11.0 --version`).
- Node.js `>= 18` and npm.
- Supabase account and CLI (`npm i -g supabase`), optional for local dev.

## Backend Setup (Python 3.11.0)
1. Navigate to backend directory:
   - `cd backend/chat_model`
2. Create and activate a virtual environment (Windows PowerShell):
   - Create: `py -3.11.0 -m venv .venv`
   - Activate: `.\.venv\Scripts\Activate.ps1`
3. Install dependencies:
   - `python -m pip install -r requirements.txt`
   - If torch fails on Windows, install CPU wheel:
     - `python -m pip install --index-url https://download.pytorch.org/whl/cpu torch==2.4.1`
4. Verify imports:
   - `python -c "import transformers, sentence_transformers, faiss, fitz, datasets, evaluate, sklearn, torch; print('IMPORTS_OK')"`

### Ingest PDFs (Build Vector Store)
1. Place PDF resources into `backend/chat_model/data/`.
2. Run ingestion (append mode by default):
   - `python -m pipeline.ingest_data --data-dir data`
   - Overwrite existing vector store: `python -m pipeline.ingest_data --data-dir data --overwrite`
3. Artifacts:
   - FAISS index: `backend/chat_model/vectors/`
   - Keyword components: `backend/chat_model/models/`

### Run the Chatbot
- Interactive menu: `python main.py`
- Modes:
  - Ingest PDFs, Chat, Train Intent Classifier, Test Classifier, System Status.

### Train Intent Classifier (optional)
- Prepare `data/training_data.csv` with columns `text,intent`.
- Train: `python -m pipeline.intent_classifier train --data data/training_data.csv`
- Test interactively: `python -m pipeline.intent_classifier`

## Frontend Setup (Vite + React PWA)
1. Navigate to frontend:
   - `cd frontend`
2. Install dependencies:
   - `npm install`
3. Configure environment variables (create `.env.local`):
   - `VITE_SUPABASE_URL=https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<your-anon-key>`
4. Run dev server:
   - `npm run dev`
5. Build for production:
   - `npm run build`

## Database Setup (Supabase)
Option A — Use existing hosted Supabase:
- Create a Supabase project and copy `URL` and `anon` key.
- Set values in `frontend/.env.local` as above.

Option B — Local Supabase (CLI):
1. Install CLI: `npm i -g supabase`
2. From project root or `frontend/supabase`, start services:
   - `supabase start`
3. Apply migrations (if using the migrations folder):
   - `supabase migration up`
4. Update frontend `.env.local` to point to the local Supabase URL and key provided by the CLI.

## Environment Files & Secrets
- Frontend:
  - `.env.local`: project URL and anon key.
  - Production values live in `.env.production` (do not commit secrets).
- Backend:
  - No secrets required for local operation unless extended to use external APIs.

## Development Workflow
- Backend:
  - Edit code under `backend/chat_model/pipeline` and run `main.py` for menu-driven actions.
  - Re-ingest PDFs when data changes.
- Frontend:
  - Update components under `frontend/src/`.
  - Use `npm run dev` for hot reload.
- Database:
  - Maintain SQL/schema via `frontend/supabase/migrations/`.

## Common Issues
- Torch DLL initialization on Windows:
  - Install from CPU wheel index: `python -m pip install --index-url https://download.pytorch.org/whl/cpu torch==2.4.1`.
- Tokenizer conflicts:
  - We avoid `chromadb` and similar packages to prevent incompatible `tokenizers` pins.
- FAISS not found:
  - Ensure `faiss-cpu` is installed, not `faiss-gpu`.

## Package Versions
- Backend (Python):
  - `numpy` 2.3.4
  - `pandas` 2.3.3
  - `scikit-learn` 1.7.2
  - `tqdm` 4.67.1
  - `PyMuPDF` 1.26.5
  - `langchain-text-splitters` 1.0.0
  - `sentence-transformers` 5.1.2
  - `transformers` 4.57.1
  - `faiss-cpu` 1.12.0
  - `datasets` 4.4.0
  - `evaluate` 0.4.6
  - `torch` 2.4.1+cpu (install via CPU wheel index)
- Frontend (Node):
  - `react` 18.3.1
  - `react-dom` 18.3.1
  - `vite` 5.4.19
  - `typescript` 5.8.3
  - `tailwindcss` 3.4.17
  - `@supabase/supabase-js` 2.75.0
  - `@tanstack/react-query` 5.83.0

## What Not to Commit (Handled by .gitignore)
- `backend/chat_model/.venv/`, caches, logs.
- Large artifacts: `backend/chat_model/models/`, `backend/chat_model/vectors/`.
- Raw data: `backend/chat_model/data/` (except `training_data.csv`).
- Frontend build outputs and local env files.

## Project Structure
```
QuitGuard/
├── backend/chat_model/         # Python backend (RAG + classifier)
│   ├── pipeline/               # Ingest, utils, classifier, chatbot
│   ├── data/                   # Place PDFs here (ignored)
│   ├── vectors/                # FAISS index (ignored)
│   ├── models/                 # Keyword/model artifacts (ignored)
│   └── requirements.txt        # Backend dependencies
├── frontend/                   # React PWA
│   ├── src/                    # App code
│   ├── public/                 # Static assets
│   └── supabase/               # Config and migrations
└── docs/Project_Report.md      # Project documentation
```

## Next Steps
- Add PDFs to `backend/chat_model/data/` and ingest.
- Configure frontend `.env.local` with Supabase keys.
- Run backend `main.py` and frontend `npm run dev` side-by-side.



cd 'd:\FYP\QG\QuitGuard\backend\chat_model'

 .\.venv_311\Scripts\activate.ps1; uvicorn server:app --reload --host 0.0.0.0 --port 8000