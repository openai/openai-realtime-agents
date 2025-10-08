# FastAPI backend for oartagents

## Setup

1. Create and activate a Python environment (conda or venv).
2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
3. Install deps and run the server.

### Conda (recommended)

```powershell
conda create -y -n oartenv python=3.12 ; conda activate oartenv
pip install -e .[dev]
```

### venv

```powershell
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -e .[dev]
```

### Run

```powershell
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs
