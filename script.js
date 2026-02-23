const FIREBASE_CONFIG = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
};

const DEFAULT_MODEL = 'qwen3-coder:480b-cloud';

const yearEl = document.getElementById('year');
const statusEl = document.getElementById('ai-status');
const answerEl = document.getElementById('ai-answer');
const solveBtn = document.getElementById('solve-btn');
const pyqListEl = document.getElementById('pyq-list');
const modelSelectEl = document.getElementById('ollama-model');
const modelStatusEl = document.getElementById('model-status');

yearEl.textContent = new Date().getFullYear();

let db = null;
if (window.firebase && FIREBASE_CONFIG.apiKey !== 'REPLACE_ME') {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();
}

async function saveDoubtToFirebase(payload) {
  if (!db) return;
  try {
    await db.collection('doubts').add({
      ...payload,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.warn('Firebase save failed:', error);
  }
}

function setModelOptions(models, preferredModel) {
  const seen = new Set();
  const allModels = [preferredModel, ...models].filter((name) => {
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  modelSelectEl.innerHTML = allModels.map((name) => `<option value="${name}">${name}</option>`).join('');
  modelSelectEl.value = allModels.includes(preferredModel) ? preferredModel : allModels[0];
}

function parseTextErrorPrefix(text) {
  if (!text) return 'No response body';
  const trimmed = text.trim();
  if (!trimmed) return 'Empty response body';
  return trimmed.slice(0, 180);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();

  if (!contentType.includes('application/json')) {
    const bodyPreview = parseTextErrorPrefix(raw);
    throw new Error(`Expected JSON from ${url} but got ${contentType || 'unknown content-type'}: ${bodyPreview}`);
  }

  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Invalid JSON received from ${url}`);
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

async function loadLocalModels() {
  try {
    const data = await requestJson('/api/models');

    const models = Array.isArray(data.items) ? data.items : [];
    const preferredModel = data.default || DEFAULT_MODEL;

    if (!models.length) {
      setModelOptions([], preferredModel);
      modelStatusEl.textContent = 'No local model listed by Ollama. Model name manually type karne ke liye backend default use hoga.';
      return;
    }

    setModelOptions(models, preferredModel);
    modelStatusEl.textContent = `Loaded ${models.length} model(s) from local Ollama.`;
  } catch (error) {
    setModelOptions([], DEFAULT_MODEL);
    modelStatusEl.textContent = `Model auto-load failed: ${error.message}`;
  }
}

async function askLocalOllama() {
  const model = modelSelectEl.value || DEFAULT_MODEL;
  const doubt = document.getElementById('doubt-input').value.trim();
  const studentName = document.getElementById('student-name').value.trim() || 'Anonymous';

  if (!doubt) {
    statusEl.textContent = 'Please enter your doubt first.';
    answerEl.textContent = '';
    return;
  }

  solveBtn.disabled = true;
  statusEl.textContent = `Thinking... asking ${model} from backend.`;
  answerEl.textContent = '';

  try {
    const data = await requestJson('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, doubt }),
    });

    statusEl.textContent = `Solved using local model ${data.model}.`;
    answerEl.textContent = data.answer;

    await saveDoubtToFirebase({ studentName, model, doubt, answer: data.answer });
  } catch (error) {
    statusEl.textContent = 'Could not fetch answer from backend/Ollama.';
    answerEl.textContent = error.message;
  } finally {
    solveBtn.disabled = false;
  }
}

async function loadPyqs() {
  const subject = document.getElementById('pyq-subject').value;
  const year = document.getElementById('pyq-year').value;
  pyqListEl.innerHTML = '<p class="muted">Loading PYQs...</p>';

  try {
    const data = await requestJson(`/api/pyqs?subject=${encodeURIComponent(subject)}&year=${encodeURIComponent(year)}`);

    if (!data.items.length) {
      pyqListEl.innerHTML = '<p class="muted">No PYQs found for selected filter.</p>';
      return;
    }

    pyqListEl.innerHTML = data.items
      .map(
        (item) => `
          <article class="pyq-item">
            <h4>${item.question}</h4>
            <p class="pyq-meta">${item.subject} • ${item.year}</p>
            <button class="btn btn-small" data-q="${encodeURIComponent(item.question)}">Solve with AI</button>
          </article>
        `
      )
      .join('');

    document.querySelectorAll('[data-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('doubt-input').value = decodeURIComponent(btn.dataset.q);
        document.getElementById('ai-tutor').scrollIntoView({ behavior: 'smooth' });
      });
    });
  } catch (error) {
    pyqListEl.innerHTML = `<p class="muted">${error.message}</p>`;
  }
}

solveBtn.addEventListener('click', askLocalOllama);
document.getElementById('load-pyq-btn').addEventListener('click', loadPyqs);

loadLocalModels();
loadPyqs();
