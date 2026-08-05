# AI Notes Summarizer

A student-first web app that turns long, messy study notes into a complete **revision pack** in seconds. Paste notes or upload a PDF, and get a concise summary, revision bullet points, an easy explanation, glossary terms, flashcards, a quiz, a concept map, sticky-note reminders, and study tips.

Works with the **OpenAI API** when a key is available, and falls back to a fully **offline, deterministic local summarizer** so the app always works — no key required.

---

## Features / Functionality

### Input options
- **Paste notes** directly into the text area (live word / character counters).
- **Upload a PDF** — the server extracts the text server-side and combines it with any pasted text.

### Revision pack output
Every request produces a structured revision pack with:

| Section | Description |
|---|---|
| **Title** | A short topic title generated from the notes. |
| **Quick summary** | A concise narrative you can read in under a minute. |
| **Explain like I'm 10** | The same topic explained in much simpler language. |
| **Key points** | 5–8 revision-ready bullet points. |
| **Key terms** | Glossary entries (term + definition) pulled from the notes. |
| **Flashcards** | Front/back Q&A flip cards for self-testing. |
| **Quiz** | 4-option multiple choice questions with answers and explanations. |
| **Concept map** | A central topic + connected concept nodes (and relation labels). |
| **Sticky notes** | Tiny one-line reminders for a last-minute scan. |
| **Study tips** | Practical active-recall study advice. |

The result page renders every section: title, summary, key points, easy explanation, key terms, flashcards (tap to flip), an interactive quiz, the concept map, sticky-note reminders, study tips, content breakdown, and focus areas.

### Two summarization engines
1. **AI mode** — calls the OpenAI Responses API with a strict JSON schema and a tutor-style prompt. Uses `gpt-5`. If the call fails, it gracefully falls back to local mode.
2. **Local (fallback) mode** — a deterministic, offline summarizer in `src/summarizer.js` that scores sentences, extracts top terms, and builds every section without any external service.

### Result page details
- Insight chips (source words, key points count, study actions, estimated read time).
- Content breakdown (source length, summary length, coverage, difficulty feel).
- Best focus areas — prioritized first-revision targets.

---

## How it works

```
User (index.html)                     Server (server.js)                    Summarizer (src/summarizer.js)
─────────────────────────────────     ────────────────────────              ─────────────────────────────────
1. Paste notes / select a PDF   ──►   POST /api/summarize              
2. Click "Summarize" (app.js)         body: { notes, pdfBase64 }      
                                      │
                                      ├─ PDF present? ──► extract text with pdf-parse
                                      │
                                      ▼
                                      Merge all text, validate
                                      │
                                      ▼
                                      OPENAI_API_KEY set?
                                      │                │
                                      │ yes            │ no
                                      ▼                ▼
                               summarizeWithOpenAI   buildFallbackResult
                               (Responses API,       (offline, deterministic)
                                gpt-5, JSON schema)        │
                                      │                    │
                                      └────► send 200 JSON: revision pack + mode + metadata
                                                        │
                                        result stored in localStorage ──► redirect
                                                        │
                                                        ▼
                                               result.html renders pack
```

1. The user pastes notes and/or picks a PDF on the home page (`index.html`).
2. `public/app.js` reads the PDF as base64, then `POST`s `{ notes, pdfBase64, fileName }` to `/api/summarize`.
3. `server.js` extracts PDF text (if provided), combines it with pasted notes, and either calls OpenAI or the local fallback.
4. The server responds with the full revision pack plus `mode` (`"ai"` or `"fallback"`) and metadata (word count, timestamp).
5. The result is saved to `localStorage` and the browser redirects to `result.html`, which renders the pack.
6. If the app is opened directly at `/result.html` with no saved data, it shows a friendly empty state.

---

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework), responsive layout.
- **Backend:** Node.js with the built-in `http` module (zero-framework server in `server.js`).
- **AI:** OpenAI Responses API (`https://api.openai.com/v1/responses`) with strict JSON-schema output.
- **PDF parsing:** [`pdf-parse`](https://www.npmjs.com/package/pdf-parse) v2 (`PDFParse` class).
- **Tests:** Node's built-in test runner (`node:test`).

---

## Project Structure

```
AI_Notes_Summarizer/
├── server.js                  # HTTP server: static file serving + /api/summarize endpoint
├── src/
│   └── summarizer.js          # Core logic: validation, word count, OpenAI engine,
│                              #   offline fallback engine, text-analysis helpers
├── public/                    # Frontend (served as static files)
│   ├── index.html             # Home page: input + PDF upload + summarize button
│   ├── result.html            # Result page: renders the revision pack
│   ├── app.js                 # Frontend logic: form handling, PDF→base64, fetch, counters
│   └── styles.css             # All styling (warm, card-based responsive design)
├── tests/
│   └── summarizer.test.js     # Unit tests for validation, word count, fallback output
├── package.json               # Project metadata, scripts, dependencies
├── package-lock.json          # Locked dependency tree
├── .env.example               # Template for environment variables
├── .gitignore                 # Ignores node_modules/, .env, etc.
├── AI-Notes-Summarizer-PRD.md # Product Requirements Document
└── README.md                  # This file
```

---

## Setup

### Prerequisites
- **Node.js 18 or newer** (uses `fetch`, `node:test`, `node --watch`, and lookbehind regex).

### Installation

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd AI_Notes_Summarizer

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port the HTTP server listens on. |
| `OPENAI_API_KEY` | No | — | Enables AI mode. Without it the app runs in local fallback mode. |

`.env.example` also lists `GEMINI_API_KEY`, `GEMINI_MODEL`, `MIN_WORDS`, and `MAX_CHARS` as placeholders — they are **not currently read by the code** (validation defaults live in `src/summarizer.js`).

### Run the app

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

Then open **[http://localhost:3000](http://localhost:3000)**.

### Run the tests

```bash
npm test
```

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Starts the production server (`node server.js`). |
| `npm run dev` | Starts the server in watch mode (`node --watch server.js`). |
| `npm test` | Runs the test suite (`node --test`). |

---

## API Reference

### `POST /api/summarize`

**Request body (JSON):**
```json
{
  "notes": "optional pasted text...",
  "pdfBase64": "optional base64-encoded PDF file",
  "fileName": "optional original PDF file name"
}
```

**Success response (200):**
```json
{
  "title": "Cellular Respiration",
  "summary": "Cellular respiration is the process cells use to release energy from glucose...",
  "simpleExplanation": "Think of this topic like a short lesson from a helpful classmate...",
  "keyPoints": ["..."],
  "keyTerms": [{ "term": "...", "definition": "..." }],
  "flashcards": [{ "front": "...", "back": "..." }],
  "quiz": [{ "question": "...", "options": ["..."], "answerIndex": 0, "explanation": "..." }],
  "conceptMap": { "central": "...", "nodes": [{ "id": "n0", "label": "..." }], "links": [{ "source": "central", "target": "n0", "label": "..." }] },
  "stickyNotes": ["..."],
  "studyTips": ["..."],
  "mode": "ai" | "fallback",
  "metadata": {
    "wordCount": 120,
    "generatedAt": "2026-08-05T00:00:00.000Z"
  }
}
```

**Error responses:**
- `400` — no notes or PDF provided.
- `500` — PDF processing or summarization failure.

### Static routes
- `GET /` → `public/index.html`
- `GET /results.html` → `public/result.html`
- `GET /<file>` → any file in `public/` (CSS, JS, HTML)

---

## Testing

The test suite covers:
- Input validation (`validateNotesInput`).
- Word counting (`extractWordCount`).
- Fallback summarization output shape (`buildFallbackResult`).

```bash
npm test
```

---

## Deployment

- **All-in-one:** Render, Railway, Fly.io, or any Node host — just run `npm start`.
- The server serves both the static frontend and the API, so no separate hosting is needed.

---

## License

MIT
