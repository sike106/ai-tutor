#!/usr/bin/env python3
import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "4173"))
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_OLLAMA_MODEL = os.environ.get("DEFAULT_OLLAMA_MODEL", "qwen3-coder:480b-cloud")

PYQS = [
    {"id": 1, "subject": "Physics", "year": 2024, "question": "A block slides down an incline of angle θ with friction coefficient μ. Find acceleration."},
    {"id": 2, "subject": "Chemistry", "year": 2023, "question": "Explain why SN1 reactions show racemization with an example."},
    {"id": 3, "subject": "Maths", "year": 2024, "question": "Evaluate ∫(x^2)/(x^3+1) dx and discuss substitution choice."},
    {"id": 4, "subject": "Physics", "year": 2022, "question": "Derive time period of a physical pendulum for small oscillations."},
    {"id": 5, "subject": "Chemistry", "year": 2021, "question": "Compare acidic strength: phenol, ethanol, and p-nitrophenol with reason."},
    {"id": 6, "subject": "Maths", "year": 2023, "question": "Find area enclosed by y=x^2 and y=2x+3."},
]


class AppHandler(SimpleHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/health":
            self._send_json(200, {
                "ok": True,
                "server": "running",
                "ollama_base_url": OLLAMA_BASE_URL,
            })
            return

        if parsed.path == "/api/pyqs":
            params = parse_qs(parsed.query)
            subject = (params.get("subject", [""])[0]).strip().lower()
            year = (params.get("year", [""])[0]).strip()

            data = PYQS
            if subject and subject != "all":
                data = [q for q in data if q["subject"].lower() == subject]
            if year and year != "all":
                try:
                    y = int(year)
                    data = [q for q in data if q["year"] == y]
                except ValueError:
                    self._send_json(400, {"error": "Invalid year"})
                    return

            self._send_json(200, {"items": data})
            return

        if parsed.path == "/api/models":
            req = Request(f"{OLLAMA_BASE_URL}/api/tags", method="GET")
            try:
                with urlopen(req, timeout=20) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))

                models = [item.get("name") for item in resp_data.get("models", []) if item.get("name")]
                self._send_json(200, {"items": models, "default": DEFAULT_OLLAMA_MODEL})
            except HTTPError as exc:
                detail = exc.read().decode("utf-8")
                self._send_json(502, {"error": f"Ollama HTTP error {exc.code}", "detail": detail})
            except URLError as exc:
                self._send_json(502, {
                    "error": "Could not reach local Ollama server. Ensure `ollama serve` is running.",
                    "detail": str(exc),
                })
            except Exception as exc:
                self._send_json(500, {"error": "Unexpected server error", "detail": str(exc)})
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/ask":
            try:
                payload = self._read_json()
            except json.JSONDecodeError:
                self._send_json(400, {"error": "Invalid JSON payload"})
                return

            model = payload.get("model", DEFAULT_OLLAMA_MODEL)
            doubt = (payload.get("doubt") or "").strip()

            if not doubt:
                self._send_json(400, {"error": "Doubt is required"})
                return

            ollama_payload = {
                "model": model,
                "stream": False,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert JEE tutor. Explain step-by-step in Hinglish and include final answer clearly.",
                    },
                    {"role": "user", "content": doubt},
                ],
            }

            req = Request(
                f"{OLLAMA_BASE_URL}/api/chat",
                data=json.dumps(ollama_payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            try:
                with urlopen(req, timeout=120) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                text = resp_data.get("message", {}).get("content") or "No response text received from Ollama model."
                self._send_json(200, {"answer": text, "model": model})
            except HTTPError as exc:
                detail = exc.read().decode("utf-8")
                self._send_json(502, {"error": f"Ollama HTTP error {exc.code}", "detail": detail})
            except URLError as exc:
                self._send_json(502, {
                    "error": "Could not reach local Ollama server. Ensure `ollama serve` is running and model is pulled.",
                    "detail": str(exc),
                })
            except Exception as exc:
                self._send_json(500, {"error": "Unexpected server error", "detail": str(exc)})
            return

        self._send_json(404, {"error": "Not found"})


if __name__ == "__main__":
    httpd = HTTPServer((HOST, PORT), AppHandler)
    print(f"Server running at http://{HOST}:{PORT}")
    print(f"Using local Ollama endpoint: {OLLAMA_BASE_URL}")
    httpd.serve_forever()
