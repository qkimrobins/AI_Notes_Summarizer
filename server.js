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

import {
  searchWeb,
  fetchGroundingForTerms,
  researchTopicFromWeb
} from "./src/search.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

loadEnv();

const PORT = process.env.PORT || 3000;

// ================= SERVER =================

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // 🔥 API ROUTE: Summarize notes & PDF
  if (req.method === "POST" && url.pathname === "/api/summarize") {
    await handleSummarize(req, res);
    return;
  }

  // 🔍 API ROUTE: Live Web / Google Search
  if (req.method === "GET" && url.pathname === "/api/search") {
    await handleSearch(req, res, url);
    return;
  }

  // 🌐 API ROUTE: Direct Topic Research
  if (req.method === "POST" && url.pathname === "/api/research") {
    await handleResearch(req, res);
    return;
  }

  // 🏠 Home page
  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/") {
    return serveStaticFile("index.html", res, req.method);
  }

  if ((req.method === "GET" || req.method === "HEAD") && (url.pathname === "/results.html" || url.pathname === "/result.html")) {
    return serveStaticFile("result.html", res, req.method);
  }

  // 📁 Static files (CSS, JS, HTML, Images)
  if (req.method === "GET" || req.method === "HEAD") {
    return serveStaticFile(url.pathname, res, req.method);
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

// ================= API HANDLERS =================

async function handleSummarize(req, res) {
  try {
    const body = await parseJsonBody(req);
    let notes = await resolveNotesInput(body);

    if (!notes && !body.topic) {
      return sendJson(res, 400, {
        error: "No input",
        message: "Please provide notes, a topic, or a PDF file."
      });
    }

    let webGrounding = [];

    // If research mode or topic only
    if (body.topicOnly || (body.topic && !notes)) {
      const research = await researchTopicFromWeb(body.topic || notes);
      notes = research.notes;
      webGrounding = research.searchResults.map((r) => ({
        term: r.title,
        title: r.title,
        snippet: r.snippet,
        source: r.source,
        url: r.url,
        googleSearchUrl: r.googleSearchUrl
      }));
    } else {
      // Extract top terms and fetch web grounding for verified precision
      try {
        const previewResult = buildFallbackResult(notes);
        const topTerms = (previewResult.keyTerms || []).map((t) => t.term).slice(0, 4);
        webGrounding = await fetchGroundingForTerms(topTerms, previewResult.title);
      } catch (groundErr) {
        console.warn("Grounding retrieval notice:", groundErr.message);
      }
    }

    let result;
    let mode = "fallback";

    // 🤖 AI mode (if OpenAI key exists)
    if (process.env.OPENAI_API_KEY) {
      try {
        const webContext = (webGrounding || [])
          .map((g) => `${g.term || g.title}: ${g.snippet}`)
          .join("\n");

        result = await summarizeWithOpenAI(notes, {
          apiKey: process.env.OPENAI_API_KEY,
          model: "gpt-5",
          webContext
        });
        mode = "ai";
      } catch (err) {
        console.error("OpenAI summarization failed, falling back to local summarizer:", err);
        result = buildFallbackResult(notes, webGrounding);
      }
    } else {
      result = buildFallbackResult(notes, webGrounding);
    }

    sendJson(res, 200, {
      ...result,
      webGrounding: result.webGrounding && result.webGrounding.length > 0 ? result.webGrounding : webGrounding,
      mode,
      metadata: {
        wordCount: extractWordCount(notes),
        groundedSourcesCount: webGrounding.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error("Summarize handler error:", err);
    sendJson(res, 500, {
      error: "Server error",
      message: err.message || "Something went wrong"
    });
  }
}

async function handleSearch(req, res, url) {
  try {
    const q = url.searchParams.get("q") || "";
    if (!q.trim()) {
      return sendJson(res, 400, { error: "Missing query parameter 'q'" });
    }

    const results = await searchWeb(q.trim(), { limit: 5 });
    sendJson(res, 200, {
      query: q.trim(),
      results,
      googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`
    });
  } catch (err) {
    console.error("Search handler error:", err);
    sendJson(res, 500, { error: "Search failed", message: err.message });
  }
}

async function handleResearch(req, res) {
  try {
    const body = await parseJsonBody(req);
    const topic = (body.topic || "").trim();

    if (!topic) {
      return sendJson(res, 400, { error: "Missing topic in request body" });
    }

    const research = await researchTopicFromWeb(topic);
    const result = buildFallbackResult(research.notes, research.searchResults.map((r) => ({
      term: r.title,
      title: r.title,
      snippet: r.snippet,
      source: r.source,
      url: r.url,
      googleSearchUrl: r.googleSearchUrl
    })));

    sendJson(res, 200, {
      ...result,
      mode: "research",
      metadata: {
        topic,
        sourcesCount: research.searchResults.length,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Research handler error:", err);
    sendJson(res, 500, { error: "Research failed", message: err.message });
  }
}

// ================= HELPERS =================

function serveStaticFile(filePath, res, reqMethod = "GET") {
  const relativePath = filePath.replace(/^\/+/, "");
  let safePath = path.join(publicDir, relativePath);

  if (!existsSync(safePath)) {
    if (existsSync(safePath + ".jpeg")) {
      safePath = safePath + ".jpeg";
    } else if (existsSync(safePath + ".jpg")) {
      safePath = safePath + ".jpg";
    } else if (existsSync(safePath + ".html")) {
      safePath = safePath + ".html";
    } else {
      return sendJson(res, 404, {
        error: "Not found"
      });
    }
  }

  const ext = path.extname(safePath).toLowerCase();

  const mime = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon"
  };

  let contentType = mime[ext];
  if (!contentType && (relativePath === "ssr" || relativePath.startsWith("ssr"))) {
    contentType = "image/jpeg";
  }

  res.writeHead(200, {
    "Content-Type": contentType || "application/octet-stream"
  });

  if (reqMethod === "HEAD") {
    res.end();
    return;
  }

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

