import express from 'express';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Busboy from 'busboy';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { assess, generateItems, hasModel } from './model.js';

async function extractPdf(buf) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false, isEvalSupported: false }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n');
}

const app = express();
const distRoot   = fileURLToPath(new URL('./dist/',   import.meta.url));
const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
const staticRoot = existsSync(distRoot) ? distRoot : publicRoot;
app.disable('x-powered-by');
app.use(express.json({ limit: '70kb' }));
app.use(express.static(staticRoot));

app.get('/api/status', (_req, res) =>
  res.json({ aiReady: hasModel(), realtimeReady: Boolean(process.env.OPENAI_REALTIME_KEY) })
);

// Proxy the WebRTC SDP exchange — keeps the real key server-side
app.post('/api/realtime-sdp', express.text({ type: ['application/sdp', 'text/plain'], limit: '64kb' }), async (req, res) => {
  const key = process.env.OPENAI_REALTIME_KEY;
  if (!key) return res.status(503).send('Realtime API key not configured.');
  try {
    const fd = new FormData();
    fd.set('sdp', req.body);
    fd.set('session', JSON.stringify({ type: 'realtime', model: 'gpt-realtime-2.1', audio: { output: { voice: 'marin' } } }));
    const r = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    const sdp = await r.text();
    res.set('Content-Type', r.ok ? 'application/sdp' : (r.headers.get('Content-Type') ?? 'text/plain'));
    const location = r.headers.get('Location');
    if (location) res.set('Location', location);
    res.status(r.status).send(sdp);
  } catch (err) {
    console.error('SDP proxy threw:', err.message);
    res.status(502).send(err.message);
  }
});

app.post('/api/extract', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Expected a file upload.' });
  }
  const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
  let handled = false;

  bb.on('file', async (fieldname, stream, info) => {
    const { filename, mimeType } = info;
    const ext = filename.split('.').pop().toLowerCase();
    const chunks = [];
    stream.on('data', d => chunks.push(d));
    stream.on('limit', () => {
      if (!handled) { handled = true; res.status(400).json({ error: 'File too large. Maximum is 10 MiB.' }); }
    });
    stream.on('end', async () => {
      if (handled) return;
      handled = true;
      const buf = Buffer.concat(chunks);
      try {
        let text = '';
        if (ext === 'pdf' || mimeType === 'application/pdf') {
          text = await extractPdf(buf);
        } else if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const result = await mammoth.extractRawText({ buffer: buf });
          text = result.value;
        } else if (ext === 'txt' || ext === 'md') {
          text = buf.toString('utf8');
        } else {
          return res.status(400).json({ error: 'Unsupported file type. Use PDF, DOCX, TXT, or MD.' });
        }
        text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 40000);
        if (text.length < 50) return res.status(400).json({ error: 'Could not extract enough text from the file.' });
        res.json({ text });
      } catch (err) {
        console.error('Extract error:', err.message);
        res.status(502).json({ error: 'Failed to extract text from the file.' });
      }
    });
  });

  bb.on('error', () => {
    if (!handled) { handled = true; res.status(400).json({ error: 'Upload failed.' }); }
  });

  req.pipe(bb);
});

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
  console.error('respondError:', message, error?.cause?.message ?? '');
  res.status(message.startsWith('Set OPENAI_API_KEY') ? 503 : 502).json({ error: message });
}

app.use((error, _req, res, _next) => {
  res.status(error.status || 400).json({ error: 'The request was too large or invalid.' });
});

export default app;
