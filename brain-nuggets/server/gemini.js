import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const SYSTEM = `You are a study coach for students with dyslexia, ADHD and other learning differences.
Write in plain, warm, everyday language. Short sentences (under 20 words). One idea per sentence.
Explain jargon the first time it appears. Never invent facts that are not in the source material.`;

const str = { type: 'string' };
const strArr = { type: 'array', items: str };

const CONTEXT_SCHEMA = {
  type: 'object',
  properties: {
    title: str,
    subject: str,
    summary: { ...str, description: 'Two plain sentences on what this lecture is about.' },
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: str, description: str, dependsOn: strArr },
        required: ['name', 'description'],
      },
    },
    plan: {
      type: 'array',
      description: 'The chunks to teach, in learning order.',
      items: {
        type: 'object',
        properties: {
          title: str,
          focus: { ...str, description: 'The single big idea this chunk teaches.' },
          pages: { type: 'array', items: { type: 'integer' } },
          minutes: { type: 'integer' },
        },
        required: ['title', 'focus', 'pages', 'minutes'],
      },
    },
  },
  required: ['title', 'subject', 'summary', 'concepts', 'plan'],
};

const EXPLANATION_PROPS = {
  bigIdea: { ...str, description: 'The one big idea, in one or two short sentences.' },
  bullets: { ...strArr, description: 'Exactly 3 short supporting points.' },
  analogy: { ...str, description: 'An everyday analogy that makes the idea click.' },
};

const CHUNK_SCHEMA = {
  type: 'object',
  properties: {
    title: str,
    ...EXPLANATION_PROPS,
    keyTerms: {
      type: 'array',
      items: {
        type: 'object',
        properties: { term: str, definition: str },
        required: ['term', 'definition'],
      },
    },
    original: { ...str, description: 'The source passage this chunk covers, copied verbatim from the PDF. Use blank lines between paragraphs.' },
    mindMap: {
      type: 'object',
      properties: {
        center: str,
        branches: {
          type: 'array',
          items: {
            type: 'object',
            properties: { label: str, children: strArr },
            required: ['label', 'children'],
          },
        },
      },
      required: ['center', 'branches'],
    },
    figures: {
      type: 'array',
      description: 'Up to 2 figures from the PDF that help explain the big idea, most important first. Empty if none help.',
      items: {
        type: 'object',
        properties: {
          page: { type: 'integer', description: '1-based PDF page the figure is on.' },
          box: { type: 'array', items: { type: 'integer' }, description: 'Tight box around just the figure: the drawing plus its labels, leader lines, legend and axis labels. Exclude surrounding paragraphs, the figure caption and page headers. [ymin, xmin, ymax, xmax], each 0-1000 relative to the page.' },
          caption: { ...str, description: 'What the picture shows, in one plain sentence.' },
          lookFor: { ...strArr, description: '2 or 3 very short pointers on where to look first (under 10 words each).' },
          description: { ...str, description: 'A full plain description of the picture for someone who cannot see it.' },
        },
        required: ['page', 'box', 'caption', 'lookFor', 'description'],
      },
    },
    quiz: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: str,
          options: strArr,
          answerIndex: { type: 'integer' },
          why: { ...str, description: 'One or two sentences on why the answer is right.' },
          reteach: { ...str, description: 'A gentle, different re-explanation for a student who chose wrong. No blame.' },
        },
        required: ['question', 'options', 'answerIndex', 'why', 'reteach'],
      },
    },
  },
  required: ['title', 'bigIdea', 'bullets', 'analogy', 'keyTerms', 'original', 'mindMap', 'quiz'],
};

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: str,
    found: { type: 'boolean', description: 'False if the material does not cover the question.' },
  },
  required: ['answer', 'found'],
};

// Primary model first; when one is overloaded, fall back to the next and
// skip the busy one for a few minutes so every call doesn't wait on it.
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS || '').split(',').map((m) => m.trim()).filter(Boolean);
const MODELS = [...new Set([MODEL, ...FALLBACKS])];
const BUSY = new Set([429, 500, 503, 'TIMEOUT']);
const COOLDOWN_MS = 3 * 60 * 1000;
const CALL_TIMEOUT_MS = 120 * 1000;
const busyUntil = new Map();

// The schema goes in the prompt rather than responseJsonSchema: strict constrained
// decoding was ~4x slower for the same output. We validate required keys ourselves.
async function callModel(model, parts, schema) {
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [...parts, { text: `Respond with JSON only, matching this JSON Schema:\n${JSON.stringify(schema)}` }] }],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    },
  }).catch((err) => {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') err.status = 'TIMEOUT';
    throw err;
  });
  const data = JSON.parse(res.text);
  const missing = schema.required?.filter((k) => data[k] === undefined) ?? [];
  if (missing.length) throw new Error(`Gemini response was missing ${missing.join(', ')}`);
  return data;
}

async function generate(parts, schema) {
  const now = Date.now();
  const ready = MODELS.filter((m) => (busyUntil.get(m) ?? 0) < now);
  const order = ready.length ? ready : MODELS;
  let lastErr;
  for (const model of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callModel(model, parts, schema);
      } catch (err) {
        lastErr = err;
        const status = err.status ?? err.code;
        if (BUSY.has(status)) {
          busyUntil.set(model, Date.now() + COOLDOWN_MS);
          console.warn(`[gemini] ${model} unavailable (${status}), trying next model`);
          break;
        }
        // Malformed JSON or missing keys: retry once on the same model.
        if (status !== undefined || attempt === 1) throw err;
        console.warn(`[gemini] ${model} bad response (${err.message}), retrying`);
      }
    }
  }
  throw lastErr;
}

const pdfPart = (base64) => ({ inlineData: { mimeType: 'application/pdf', data: base64 } });

// Agent 1: read the whole PDF once and produce the shared context + teaching plan.
export function buildContext(pdfBase64) {
  return generate(
    [
      pdfPart(pdfBase64),
      {
        text: `Read this lecture PDF, including diagrams, tables and equations.
Build a structured understanding of it: the title, subject, a two-sentence summary, the key concepts and how they depend on each other.
Then plan how to teach it as a sequence of small chunks.
- Each chunk teaches exactly one big idea and takes about 4 minutes for a student who reads slowly.
- Follow the order a learner needs (foundations first), not necessarily page order.
- Cover everything examinable. Skip course logistics, reading lists and admin.`,
      },
    ],
    CONTEXT_SCHEMA,
  );
}

const arr = (v) => (Array.isArray(v) ? v : []);

// Models tend to put the right answer first; shuffle so position gives nothing away.
function shuffleOptions(q) {
  const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { ...q, options: order.map((i) => q.options[i]), answerIndex: order.indexOf(q.answerIndex) };
}

const clamp = (n) => Math.min(1000, Math.max(0, Math.round(Number(n) || 0)));

// Keeps only figures we can crop: a real page and a box with some area.
function normalizeFigures(figures, pages) {
  return arr(figures)
    .filter((f) => Number.isInteger(f?.page) && f.page >= 1 && f.caption && arr(f.box).length === 4)
    .map((f) => {
      const [y0, x0, y1, x1] = f.box.map(clamp);
      return {
        page: f.page,
        box: [Math.min(y0, y1), Math.min(x0, x1), Math.max(y0, y1), Math.max(x0, x1)],
        caption: f.caption,
        lookFor: arr(f.lookFor).filter(Boolean).slice(0, 3),
        description: f.description || f.caption,
      };
    })
    .filter((f) => f.box[2] - f.box[0] > 20 && f.box[3] - f.box[1] > 20)
    .sort((a, b) => (pages.includes(b.page) ? 1 : 0) - (pages.includes(a.page) ? 1 : 0))
    .slice(0, 2);
}

// Keeps the UI safe from slightly-off model output.
function normalizeChunk(c, pages = []) {
  return {
    ...c,
    bullets: arr(c.bullets).slice(0, 3),
    keyTerms: arr(c.keyTerms).filter((t) => t?.term && t?.definition),
    figures: normalizeFigures(c.figures, pages),
    mindMap: { center: c.mindMap?.center ?? c.title, branches: arr(c.mindMap?.branches).map((b) => ({ label: b.label, children: arr(b.children) })) },
    quiz: arr(c.quiz)
      .filter((q) => arr(q.options).length >= 2 && q.answerIndex >= 0 && q.answerIndex < q.options.length)
      .map(shuffleOptions),
  };
}

// Agents 2-4: simplify one chunk, map it, and write low-stakes quiz questions.
export async function buildChunk(pdfBase64, context, index) {
  const item = context.plan[index];
  return normalizeChunk(await generate(
    [
      pdfPart(pdfBase64),
      {
        text: `Lecture context:
${JSON.stringify({ title: context.title, summary: context.summary, concepts: context.concepts })}

Full teaching plan (you are writing chunk ${index + 1} of ${context.plan.length}):
${context.plan.map((p, i) => `${i + 1}. ${p.title} — ${p.focus}`).join('\n')}

Write chunk ${index + 1}: "${item.title}" (pages ${item.pages.join(', ')}). Big idea: ${item.focus}
- bigIdea: the one idea in plain words.
- bullets: exactly 3 short points that support it.
- analogy: one everyday comparison.
- keyTerms: 2 to 5 subject-specific terms a struggling student might not know (never everyday words like "cells" or "energy"). Each must appear word-for-word in bigIdea or bullets. Give a one-line plain definition.
- original: the matching source text copied verbatim from the PDF.
- mindMap: the big idea at the center, 2 to 4 branches, each with 1 to 3 very short children (under 6 words).
- figures: 0 to 2 diagrams, charts, tables or photos from pages ${item.pages.join(', ')} that genuinely help a student grasp the big idea, most important first. Skip logos, decorations and slide backgrounds. Give a tight box around just the figure: the drawing with its labels, leader lines and legend, but none of the surrounding paragraphs, the caption line or page headers, a one-sentence caption, 2 to 3 short "look for" pointers, and a plain description someone could follow without seeing it. Use an empty list if no figure helps.
- quiz: 2 multiple-choice questions with 3 options each. Test understanding, not memorised wording. Keep the tone low-stakes.
Do not repeat material that belongs to other chunks.`,
      },
    ],
    CHUNK_SCHEMA,
  ), item.pages);
}

// Plain-text version of a chunk's figures so text-only prompts can refer to them.
const figureText = (chunk) =>
  arr(chunk.figures).map((f, i) => `Figure ${i + 1} (page ${f.page}): ${f.caption} ${f.description}`).join('\n');

export function askTutor(question, chunk, context) {
  return generate(
    [
      {
        text: `Answer the student's question using ONLY the study material below.
If the material does not cover it, set found to false and say so kindly in one sentence.
Answer in 2 to 4 short sentences.

Lecture: ${context?.title ?? ''}
Concepts: ${JSON.stringify(context?.concepts ?? [])}

Current chunk "${chunk.title}" (pages ${(chunk.pages ?? []).join(', ')}):
${chunk.original}

Simplified version:
${chunk.bigIdea}
${(chunk.bullets ?? []).join('\n')}
${figureText(chunk) && `\nFigures shown to the student:\n${figureText(chunk)}\n`}
Question: ${question}`,
      },
    ],
    ANSWER_SCHEMA,
  );
}

