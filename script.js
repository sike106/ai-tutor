const yearEl = document.getElementById('year');
const statusEl = document.getElementById('ai-status');
const answerEl = document.getElementById('ai-answer');
const solveBtn = document.getElementById('solve-btn');

yearEl.textContent = new Date().getFullYear();

async function askOllamaCloud() {
  const apiKey = document.getElementById('ollama-api-key').value.trim();
  const model = document.getElementById('ollama-model').value;
  const doubt = document.getElementById('doubt-input').value.trim();

  if (!apiKey) {
    statusEl.textContent = 'Please add your Ollama Cloud API key.';
    answerEl.textContent = '';
    return;
  }

  if (!doubt) {
    statusEl.textContent = 'Please enter your doubt first.';
    answerEl.textContent = '';
    return;
  }

  solveBtn.disabled = true;
  statusEl.textContent = 'Thinking... contacting Ollama Cloud model.';
  answerEl.textContent = '';

  try {
    const response = await fetch('https://ollama.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert JEE tutor. Explain step-by-step in simple Hinglish and include final answer clearly.'
          },
          {
            role: 'user',
            content: doubt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data?.message?.content || 'No response text received from model.';
    statusEl.textContent = `Solved using ${model}.`;
    answerEl.textContent = text;
  } catch (error) {
    statusEl.textContent = 'Could not fetch answer from Ollama Cloud.';
    answerEl.textContent = error.message;
  } finally {
    solveBtn.disabled = false;
  }
}

solveBtn.addEventListener('click', askOllamaCloud);
