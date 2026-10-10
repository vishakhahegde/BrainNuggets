import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { buildContext, buildChunk, askTutor } from './gemini.js';

// Cloud Run sets PORT; locally the Vite dev server proxies /api to 3104.
const PORT = process.env.PORT || process.env.API_PORT || 3104;
const MAX_MB = 18; // Gemini inline request limit is ~20MB
const CONCURRENCY = 3;

const app = express();
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MB * 1024 * 1024 } });

function friendlyError(err) {
  const status = err.status ?? err.code;
  if (status === 402) return 'The Gemini API key has run out of credits. Top it up in AI Studio.';
  if (status === 429) return 'Gemini is rate-limiting requests. Wait a minute and try again.';
  if (status === 401 || status === 403) return 'The Gemini API key was rejected.';
  return err.message || 'Something went wrong talking to Gemini.';
}

// Streams NDJSON: one "context" event, then one "chunk" event per chunk as each finishes.
app.post('/api/process', upload.single('pdf'), async (req, res) => {
  if (!req.file || req.file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'Upload a PDF file.' });
  }
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  const send = (event) => res.write(JSON.stringify(event) + '\n');

  let aborted = false;
  res.on('close', () => { aborted = !res.writableFinished; });

  try {
    const pdf = req.file.buffer.toString('base64');
    const context = await buildContext(pdf);
    send({ type: 'context', context });

    let next = 0;
    const worker = async () => {
      while (next < context.plan.length && !aborted) {
        const index = next++;
        const chunk = await buildChunk(pdf, context, index);
        send({ type: 'chunk', index, chunk });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    send({ type: 'done' });
  } catch (err) {
    console.error('[process]', err);
    send({ type: 'error', message: friendlyError(err) });
  }
  res.end();
});

app.post('/api/ask', async (req, res) => {
  const { question, chunk, context } = req.body;
  if (!question?.trim() || !chunk) return res.status(400).json({ error: 'Bad request' });
  try {
    res.json(await askTutor(question.trim(), chunk, context));
  } catch (err) {
    console.error('[ask]', err);
    res.status(502).json({ error: friendlyError(err) });
  }
});

// In production the built React app is served from here too (one Cloud Run service).
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('/{*splat}', (req, res, next) => (req.path.startsWith('/api') ? next() : res.sendFile('index.html', { root: DIST })));
}

app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `PDFs must be under ${MAX_MB}MB.` });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
