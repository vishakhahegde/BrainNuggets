# Brain Nuggets

**Big lectures, broken into bite-sized nuggets.**

Brain Nuggets is a study app for students with ADHD, dyslexia and other learning differences. Long lecture PDFs and big assignments are where these students most often get stuck. A wall of dense slides is hard to read, and a task like "write a history paper" gives no obvious place to start. Brain Nuggets turns both into small, calm, one-at-a-time steps, using Google Gemini to do the heavy lifting.

---

## Features

### Your Lectures
- **Upload a lecture PDF**, and it is split into short chunks of about 4 minutes each, ordered the way a learner needs them. Chunks appear as soon as each one is ready.
- **Four ways to study each chunk:**
  - **Simple**: the big idea, a few short bullets and an everyday analogy.
  - **Original**: the source text for that part of the lecture.
  - **Mind map**: how the ideas connect.
  - **Quiz**: quick questions, with a gentle re-explanation when an answer is wrong.
- **Figures from the PDF**: diagrams are cropped straight from the lecture, together with their labels, and shown with "look for" pointers.
- **Key terms** are highlighted in the text and explained in a side panel.
- **Stuck?** Ask a question about the current chunk, and the answer comes only from the lecture material.
- **Read aloud** for any chunk.

### Your Assignments
- **Type what the teacher asked and pick a due date.** The assignment is broken into small tasks of about 10 minutes, grouped into steps (for example Understand, Research, Plan, Write, Check).
- **The first task is always a tiny 2–5 minute starter**, so beginning never feels big.
- **Even split to the due date.** The remaining work is shared evenly over the days left and shown as a **Today** plan.
  - An **On track / A bit behind** hint shows progress, and catching up clears it.
  - Missed tasks roll forward on their own.
- **One task at a time.** Each task has a clear **Done when** finish line, a single **Done** button, and a checklist on the side.

### Focus and comfort
- **Focus sprints** (10, 15 or 25 minutes) with a full-screen break screen.
- **Comfort panel**:
  - text size and line spacing
  - background colour, including dark mode
  - read-aloud speed
  - a reading ruler
- **Hideable sidebar** on the lecture and assignment pages, for a quieter screen.
- **Google sign-in.** Every student's lectures and assignments are saved to their own account and available on any device.

### Designed for focus
- Lexend, a typeface designed to make reading easier, is used throughout, along with short sentences and plain words.
- Only one thing is on screen at a time: one chunk, one task.
- Wording is kind and blame-free ("A bit behind", never "Overdue!").
- Timers are always optional, and breaks are encouraged.

---

## How it works

```
Browser (React + Vite)                     Server (Node + Express)            Google
┌────────────────────────────┐   /api    ┌─────────────────────────┐       ┌──────────┐
│ Lectures, Assignments,     │ ────────▶ │ /api/process  (PDF)     │ ────▶ │  Gemini  │
│ study views, comfort prefs │ ◀──────── │ /api/ask      (Stuck?)  │ ◀──── │          │
│ pdf.js figure cropping     │  NDJSON   │ /api/breakdown (tasks)  │       └──────────┘
└─────────────┬──────────────┘           └─────────────────────────┘
              │ Firebase SDK
              ▼
   Firebase Auth (Google) + Firestore (per-user data)
```

- **Lecture pipeline:**
  - Gemini reads the whole PDF once to build a plan: the title, the key concepts and the order to teach them.
  - It then writes each chunk (three at a time), including figure locations.
  - The server streams chunks back as newline-delimited JSON, so the first ones are readable while the rest are still being written.
- **Figures:** the browser renders the page with pdf.js and uses the PDF's text layer to tell paragraphs from labels. It crops just the drawing and its labels, then saves a compressed image with the lesson.
- **Assignments:**
  - Gemini turns the typed brief into steps and tasks, each with a "Done when" line.
  - The day-by-day plan is worked out in the browser, so it always reflects today.
- **Reliability:** if the main Gemini model is busy, the server falls back to the next one and retries badly formatted replies once.
- **Data:** everything is stored under `users/{uid}` in Firestore. `firestore.rules` lets each student read and write only their own data.

### Project layout

```
Dockerfile                 Production image (builds the app and runs the server)
brain-nuggets/
  server/
    index.js               Express API; also serves the built app in production
    gemini.js              Prompts, schemas and model fallback for Gemini
  src/
    components/            React pages and UI (Library, Study, Assignments, ...)
    figures.js             pdf.js rendering and figure cropping
    schedule.js            Even day-by-day split and on-track check for assignments
    data-firestore.js      Firestore reads and writes
    data-local.js          Browser-only stand-in used in local test mode
    landing.js             Picks the landing page design (v1 or v2)
  firestore.rules          Per-user security rules
  .env.example             Server environment variables
```

---

## Run it locally

Requires **Node 22** and a **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
cd brain-nuggets
npm install
cp .env.example .env        # then set GEMINI_API_KEY in .env
npm run dev
```

Open http://localhost:5215.

- `npm run dev` starts the Vite dev server and the API on port 3104 together. Vite forwards `/api` calls to the API.
- **Local test mode:** run `VITE_LOCAL_DB=true npm run dev` to save everything in your browser instead of Firestore. This is handy for trying the app without touching real data. A "Local test mode" badge shows in the top bar.

### Firebase setup (one time)

The app uses the Firebase project `brainnuggets-be6d9` and the Firestore database `brainnuggets-69`.

1. **Authentication → Sign-in method:** enable **Google** and choose a support email.
2. **Authentication → Settings → Authorized domains:** add every domain the app is served from. `localhost` is there by default; add your Cloud Run domain after deploying.
3. **Firestore rules:** deploy `brain-nuggets/firestore.rules`, using the Firebase console or `firebase deploy --only firestore:rules` from inside `brain-nuggets/`.

Anyone who used an earlier anonymous version of the app is upgraded to their Google account the first time they sign in from the same browser, so their saved lessons carry over.

---

## Deploy to Google Cloud Run

The repo-root `Dockerfile` builds the React app and runs the Express server, which serves both the app and `/api` on Cloud Run's `PORT`.

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Store the Gemini key as a secret
printf "YOUR_KEY" | gcloud secrets create gemini-api-key --data-file=-

# Build and deploy from the repo root
gcloud run deploy brain-nuggets --source . --region asia-south1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --memory 1Gi --timeout 900
```

- **Secret access:** the Cloud Run service account needs the **Secret Manager Secret Accessor** role on the secret.
- **Settings:** 1 GiB of memory leaves room for lecture PDFs up to 18 MB. The 15-minute timeout lets long lectures finish streaming.
- **After the first deploy:** add the `*.run.app` domain to Firebase **Authorized domains**, or Google sign-in will close immediately.

---

## Configuration

| Setting | Where | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | `.env` / Cloud Run secret | **Required.** Gemini API key used by the server. |
| `GEMINI_MODEL` | `.env` | Main Gemini model. |
| `GEMINI_FALLBACK_MODELS` | `.env` | Comma-separated models to try when the main one is busy. |
| `PORT` / `API_PORT` | environment | Server port (Cloud Run sets `PORT`; local dev uses 3104). |
| `VITE_LOCAL_DB` | environment | `true` saves data in the browser instead of Firestore (testing only). |
| `LANDING_VERSION` | `brain-nuggets/src/landing.js` | `'v2'` (full painted background) or `'v1'` (original layout). |

---

## Tech stack

React 19 · Vite · Node.js · Express · Google Gemini (`@google/genai`) · pdf.js · Firebase Authentication · Cloud Firestore · Docker · Google Cloud Run
