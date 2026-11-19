import express from 'express';
import { fileURLToPath } from 'node:url';
import { assess, generateItems, hasModel } from './model.js';

const app = express();
const root = fileURLToPath(new URL('./public/', import.meta.url));
app.disable('x-powered-by');
app.use(express.json({ limit: '70kb' }));
app.use(express.static(root));

app.get('/api/status', (_req, res) => res.json({ aiReady: hasModel() }));

app.post('/api/items', async (req, res) => {
  const source = req.body?.source;
  if (typeof source !== 'string' || source.trim().length < 150 || source.length > 40000) {
    return res.status(400).json({ error: 'Provide 150 to 40,000 characters of study material.' });
  }
  try { res.json({ items: await generateItems(source.trim()) }); }
  catch (error) { respondError(res, error); }
});

app.post('/api/assess', async (req, res) => {
  const { item, answer, history = [] } = req.body || {};
  if (!item || typeof item.question !== 'string' || item.question.length > 240 ||
    typeof item.answer !== 'string' || item.answer.length > 300 ||
    typeof item.excerpt !== 'string' || item.excerpt.length > 600 ||
    typeof answer !== 'string' || !answer.trim() || answer.length > 1000 ||
    !Array.isArray(history) || history.length > 5 ||
    history.some(value => typeof value !== 'string' || value.length > 1000)) {
    return res.status(400).json({ error: 'Invalid review attempt.' });
  }
  try { res.json(await assess(item, answer.trim(), history)); }
  catch (error) { respondError(res, error); }
});

function respondError(res, error) {
  const message = error?.message || 'Something went wrong.';
  console.error(message);
  res.status(message.startsWith('Set OPENAI_API_KEY') ? 503 : 502).json({ error: message });
}

app.use((error, _req, res, _next) => {
  res.status(error.status || 400).json({ error: 'The request was too large or invalid.' });
});

export default app;
