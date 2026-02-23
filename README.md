# ai-tutor

## Run locally (with backend)

```bash
cd /workspace/ai-tutor
python3 server.py
```

Open: `http://127.0.0.1:4173`

## Local Ollama setup

```bash
ollama serve
ollama pull qwen3-coder:480b-cloud
```

The backend calls local Ollama at `http://127.0.0.1:11434/api/chat`.

## Firebase setup

Update `FIREBASE_CONFIG` in `script.js` with your Firebase project values.
If config is not filled, app still works but Firebase save is skipped.

## Endpoints

- `GET /api/health`
- `GET /api/pyqs?subject=Physics&year=2024`
- `GET /api/models`
- `POST /api/ask` with JSON body `{ "model": "qwen3-coder:480b-cloud", "doubt": "..." }`


You can override default selected model via env:

```bash
DEFAULT_OLLAMA_MODEL=qwen3-coder:480b-cloud python3 server.py
```
