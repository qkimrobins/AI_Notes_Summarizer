import { createServer } from "node:http";
import { readFileSync, existsSync, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

import {
  buildFallbackResult,
  extractWordCount,
  summarizeWithOpenAI
} from "./src/summarizer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

loadEnv();

const PORT = process.env.PORT || 3000;

// ================= SERVER =================

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // 🔥 API ROUTE (MATCHES app.js)
  if (req.method === "POST" && url.pathname === "/api/summarize") {
    await handleSummarize(req, res);
    return;
  }

  // 🏠 Home page
  if (req.method === "GET" && url.pathname === "/") {
    return serveStaticFile("index.html", res);
  }

  if (req.method === "GET" && url.pathname === "/results.html") {
    return serveStaticFile("result.html", res);
  }

  // 📁 Static files (CSS, JS, HTML)
  if (req.method === "GET") {
    return serveStaticFile(url.pathname, res);
  }

  sendJson(res, 404, {
    error: "Not found",
    message: "The requested resource does not exist."
  });
});

// 🚀 START SERVER
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// ================= API HANDLER =================

async function handleSummarize(req, res) {
  try {
    const body = await parseJsonBody(req);
    const notes = await resolveNotesInput(body);

    if (!notes) {
      return sendJson(res, 400, {
        error: "No input",
        message: "Provide notes or PDF"
      });
    }

    let result;
    let mode = "fallback";

    // 🤖 AI mode (if API key exists)
    if (process.env.OPENAI_API_KEY) {
      try {
        result = await summarizeWithOpenAI(notes, {
          apiKey: process.env.OPENAI_API_KEY,
          model: "gpt-5"
        });
        mode = "ai";
      } catch (err) {
        console.error("OpenAI summarization failed, falling back to local summarizer:", err);
        result = buildFallbackResult(notes);
      }
    } else {
      result = buildFallbackResult(notes);
    }

    sendJson(res, 200, {
      ...result,
      mode,
      metadata: {
        wordCount: extractWordCount(notes),
        generatedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error(err);
    sendJson(res, 500, {
      error: "Server error",
      message: "Something went wrong"
    });
  }
}

// ================= HELPERS =================

function serveStaticFile(filePath, res) {
  const safePath = path.join(publicDir, filePath);

  if (!existsSync(safePath)) {
    return sendJson(res, 404, {
      error: "Not found"
    });
  }

  const ext = path.extname(safePath);

  const mime = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript"
  };

  res.writeHead(200, {
    "Content-Type": mime[ext] || "text/plain"
  });

  createReadStream(safePath).pipe(res);
}

async function parseJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  return JSON.parse(Buffer.concat(chunks).toString());
}
async function resolveNotesInput(body) {
  let text = body.notes || "";

  if (body.pdfBase64) {
    let parser;
    try {
      const buffer = Buffer.from(body.pdfBase64, "base64");
      parser = new PDFParse({ data: buffer });
      const data = await parser.getText();

      if (!data || !data.text) {
        throw new Error("No text extracted from PDF");
      }

      text += "\n" + data.text;

    } catch (err) {
      console.error("PDF ERROR:", err);

      // 🔥 IMPORTANT: don't crash server
      throw new Error("PDF processing failed. Try another file.");
    } finally {
      if (parser) {
        await parser.destroy();
      }
    }
  }

  return text.trim();
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json"
  });
  res.end(JSON.stringify(data));
}

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf-8").split("\n");

  lines.forEach(line => {
    const [key, value] = line.split("=");
    if (key && value) process.env[key.trim()] = value.trim();
  });
}
