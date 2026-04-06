# AI Notes Summarizer

AI Notes Summarizer is a student-first web app that turns long notes into fast revision material. It creates a short summary, extracts key points, explains the topic in simpler language, and gives a few study tips so students can revise faster before exams.

## Features

- Paste long notes and generate a concise study summary
- Upload PDF notes and extract text automatically
- Extract key bullet points for quick revision
- Use an "Explain Like I'm 10" mode for easier understanding
- Copy or download the generated revision pack
- Works with OpenAI when an API key is available
- Falls back to a local summarization flow when no API key is configured
- Responsive UI built for desktop and mobile

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js HTTP server
- AI Integration: OpenAI Responses API

## Getting Started

1. Install Node.js 18 or newer.
2. Create a `.env` file based on `.env.example`.
3. Add your `OPENAI_API_KEY` if you want live AI responses.
4. Start the app:

```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_MODEL`: Model name to use for summarization, default is `gpt-5`
- `PORT`: Local port, default is `3000`
- `MIN_WORDS`: Minimum words required, default is `50`
- `MAX_CHARS`: Maximum input length, default is `12000`

## Scripts

- `npm start`: Run the production server
- `npm run dev`: Run the server with watch mode
- `npm test`: Run the tests

## Testing

The test suite covers:

- Input validation
- Word counting
- Fallback summarization output shape

Run:

```bash
npm test
```

## Student Problem Solved

Students often waste time reading full notes repeatedly before exams. This app reduces that overload by converting long text into:

- A fast summary
- Revision-ready bullet points
- A simple explanation for better understanding
- Short study tips for smarter recall
- Support for pasted notes or PDF study material

## Deployment

- Frontend + backend together: Render, Railway, or any Node host
- Static frontend can also be split later if you move the API into a separate service
