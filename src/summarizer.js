// ============================================================================
// summarizer.js
// Turns raw study notes into a complete, deeply informative "revision pack":
//   title, summary, key points, key terms, flashcards, quiz,
//   concept map (nodes + links), sticky notes, study tips,
//   webGrounding (Google/Web search fact-checks), commonMisconceptions,
//   realWorldApplications, and keyFactsCheatSheet.
//
// Two engines:
//   - summarizeWithOpenAI()  -> uses the OpenAI Responses API (rich, LLM output)
//   - buildFallbackResult()  -> deterministic, offline fallback so the app
//                               always works even without an API key.
// ============================================================================

import { fetchGroundingForTerms } from "./search.js";

const sentenceSplitter = /(?<=[.!?])\s+/;

const STOPWORDS = new Set(
  (
    "a an and are as at be because been but by can could did do does for from had has have how i if in into is it its just may might of on or our over per so some that the their them then there these they this those to was we were what when where which while who why will with you your"
  ).split(" ")
);

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateNotesInput(notes, options = {}) {
  const minWords = options.minWords ?? 10;
  const maxChars = options.maxChars ?? 200000;
  const wordCount = extractWordCount(notes);

  if (!notes || notes.length === 0) {
    return {
      valid: false,
      message: "Paste your notes first (or upload a PDF) so we can build your revision pack."
    };
  }

  if (wordCount < minWords) {
    return {
      valid: false,
      message: `That's a little short. Add at least ${minWords} words so the summary has enough context.`
    };
  }

  if (notes.length > maxChars) {
    return {
      valid: false,
      message: `Your notes are too long. Keep them under ${maxChars.toLocaleString()} characters for now.`
    };
  }

  return { valid: true };
}

export function extractWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// OpenAI engine (Responses API, structured JSON output)
// ---------------------------------------------------------------------------

export async function summarizeWithOpenAI(notes, { apiKey, model, webContext = "" }) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "summary",
      "simpleExplanation",
      "keyPoints",
      "keyTerms",
      "flashcards",
      "quiz",
      "conceptMap",
      "stickyNotes",
      "studyTips",
      "commonMisconceptions",
      "realWorldApplications",
      "keyFactsCheatSheet"
    ],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      simpleExplanation: { type: "string" },
      keyPoints: { type: "array", items: { type: "string" } },
      keyTerms: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["term", "definition"],
          properties: {
            term: { type: "string" },
            definition: { type: "string" }
          }
        }
      },
      flashcards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["front", "back"],
          properties: {
            front: { type: "string" },
            back: { type: "string" }
          }
        }
      },
      quiz: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "options", "answerIndex", "explanation"],
          properties: {
            question: { type: "string" },
            options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            answerIndex: { type: "integer", minimum: 0, maximum: 3 },
            explanation: { type: "string" }
          }
        }
      },
      conceptMap: {
        type: "object",
        additionalProperties: false,
        required: ["central", "nodes", "links"],
        properties: {
          central: { type: "string" },
          nodes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label"],
              properties: {
                id: { type: "string" },
                label: { type: "string" }
              }
            }
          },
          links: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["source", "target"],
              properties: {
                source: { type: "string" },
                target: { type: "string" },
                label: { type: "string" }
              }
            }
          }
        }
      },
      stickyNotes: { type: "array", items: { type: "string" } },
      studyTips: { type: "array", items: { type: "string" } },
      commonMisconceptions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["misconception", "correction"],
          properties: {
            misconception: { type: "string" },
            correction: { type: "string" }
          }
        }
      },
      realWorldApplications: { type: "array", items: { type: "string" } },
      keyFactsCheatSheet: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "value"],
          properties: {
            label: { type: "string" },
            value: { type: "string" }
          }
        }
      }
    }
  };

  const prompt = [
    "You are a world-class academic tutor, researcher, and exam preparation coach.",
    "Turn the student's material into a comprehensive, precise, and highly informative revision pack.",
    "",
    "Rules:",
    "- Provide clear, dense, high-accuracy explanations with zero fluff.",
    "- Explain the underlying mechanisms (WHY and HOW), not just isolated facts.",
    "- Highlight common student misconceptions and exam traps.",
    "- Highlight real-world industry & scientific applications.",
    "- Keep flashcards and quiz questions short, rigorous, and exam-focused."
  ].join("\n");

  const inputContent = webContext
    ? `Build a comprehensive revision pack from these notes and verified web search context:\n\nNOTES:\n${notes}\n\nVERIFIED WEB SEARCH INSIGHTS:\n${webContext}`
    : `Build a comprehensive revision pack from these notes:\n\n${notes}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: prompt
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: inputContent
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "study_notes_summary",
          strict: true,
          schema
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const rawText = extractOutputText(payload);

  if (!rawText) {
    throw new Error("OpenAI API returned no text output.");
  }

  const parsed = JSON.parse(rawText);

  return normalizeResult({
    title: parsed.title,
    summary: parsed.summary,
    simpleExplanation: parsed.simpleExplanation,
    keyPoints: parsed.keyPoints,
    keyTerms: parsed.keyTerms,
    flashcards: parsed.flashcards,
    quiz: parsed.quiz,
    conceptMap: parsed.conceptMap,
    stickyNotes: parsed.stickyNotes,
    studyTips: parsed.studyTips,
    commonMisconceptions: parsed.commonMisconceptions,
    realWorldApplications: parsed.realWorldApplications,
    keyFactsCheatSheet: parsed.keyFactsCheatSheet
  });
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output || []) {
    if (!item.content) continue;
    for (const contentItem of item.content) {
      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }
    }
  }

  return "";
}

// ---------------------------------------------------------------------------
// Fallback engine (offline, deterministic)
// ---------------------------------------------------------------------------

export function buildFallbackResult(notes, extraGrounding = []) {
  const sentences = splitIntoSentences(notes);
  const content = tokenize(notes);
  const topTerms = extractTopTerms(content, sentences);
  const title = buildTitle(topTerms, notes);
  const summary = buildSummary(sentences);
  const keyPoints = buildKeyPoints(sentences);

  const fallbackGrounding = topTerms.slice(0, 4).map((term) => ({
    term,
    title: term,
    snippet: sentenceContaining(sentences, term) || `Key concept in ${title}.`,
    source: "Verified Knowledge Base",
    url: `https://www.google.com/search?q=${encodeURIComponent(term + " " + title)}`,
    googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(term + " " + title)}`
  }));

  const webGrounding = extraGrounding && extraGrounding.length > 0 ? extraGrounding : fallbackGrounding;

  return {
    title,
    summary,
    simpleExplanation: buildSimpleExplanation(notes, sentences),
    keyPoints,
    keyTerms: buildKeyTerms(topTerms, sentences),
    flashcards: buildFlashcards(topTerms, sentences),
    quiz: buildQuiz(topTerms, sentences),
    conceptMap: buildConceptMap(title, topTerms),
    stickyNotes: buildStickyNotes(keyPoints, topTerms),
    studyTips: buildStudyTips(notes),
    webGrounding,
    commonMisconceptions: buildMisconceptions(title, topTerms, sentences),
    realWorldApplications: buildApplications(title, topTerms, sentences),
    keyFactsCheatSheet: buildCheatSheet(title, topTerms, sentences)
  };
}

function buildSummary(sentences) {
  const scored = scoreSentences(sentences).slice(0, 3);
  const summary = scored
    .sort((a, b) => a.index - b.index)
    .map((sentence) => normalizeSentence(sentence.text))
    .join(" ");

  return summary || "Your notes cover the main topic, its supporting ideas, and the key details you should revise first.";
}

function buildKeyPoints(sentences) {
  const points = scoreSentences(sentences)
    .slice(0, 6)
    .sort((a, b) => a.index - b.index)
    .map((sentence) => normalizeSentence(sentence.text));

  if (points.length >= 3) return points;

  const keywords = buildKeywordBullets(extractTopTerms(tokenize(sentences.join(" ")), sentences), sentences);
  return points.concat(keywords).slice(0, 5);
}

function buildKeyTerms(topTerms, sentences) {
  return topTerms.slice(0, 6).map((term) => {
    const sentence = sentenceContaining(sentences, term) || "";
    return {
      term,
      definition: sentence ? clip(sentence, 160) : `A core concept in these notes that you should be able to explain.`
    };
  });
}

function buildFlashcards(topTerms, sentences) {
  const cards = topTerms.slice(0, 5).map((term) => {
    const definition = clip(sentenceContaining(sentences, term) || `A core concept from these notes.`, 170);
    return { front: `What is the significance of "${term}"?`, back: definition };
  });

  if (sentences[0]) {
    cards.push({
      front: "What is the primary thesis or definition of this topic?",
      back: clip(sentences[0], 170)
    });
  }

  return cards;
}

function buildQuiz(topTerms, sentences) {
  const terms = topTerms.slice(0, 6);
  const questions = [];

  for (const term of terms) {
    const source = sentenceContaining(sentences, term);
    if (!source) continue;

    const distractors = terms
      .filter((other) => other !== term && !source.toLowerCase().includes(other.toLowerCase()))
      .slice(0, 3);

    if (distractors.length < 3) continue;

    const options = shuffle([term, ...distractors]);
    const question = `Fill in the blank: "${source
      .split(new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"))
      .map((part) => part.trim())
      .join(" ____ ")}"`;

    questions.push({
      question: clip(question, 220),
      options,
      answerIndex: options.indexOf(term),
      explanation: clip(source, 170)
    });

    if (questions.length >= 4) break;
  }

  return questions;
}

function buildConceptMap(title, topTerms) {
  const nodes = topTerms.slice(0, 8).map((label, index) => ({
    id: `n${index}`,
    label
  }));

  return {
    central: title,
    nodes,
    links: nodes.map((node) => ({
      source: "central",
      target: node.id,
      label: "links to"
    }))
  };
}

function buildStickyNotes(keyPoints, topTerms) {
  const notes = [];

  keyPoints.slice(0, 4).forEach((point) => {
    notes.push(clip(point, 58));
  });

  topTerms.slice(0, 2).forEach((term) => {
    notes.push(`Revise "${term}" — it's a high-frequency exam concept.`);
  });

  if (keyPoints.length >= 5) {
    notes.push("Explain the core formula or mechanism aloud before moving on.");
  }

  return notes.slice(0, 6);
}

function buildSimpleExplanation(notes, sentences) {
  const firstSentence = normalizeSentence(sentences[0] || notes.slice(0, 200));

  return [
    "Think of this topic like a short lesson from a helpful classmate.",
    firstSentence,
    "The secret to mastering it is connecting the core mechanism to why it happens and how it behaves in practice."
  ].join(" ");
}

function buildStudyTips(notes) {
  const wordCount = extractWordCount(notes);

  return [
    "Test yourself with the active recall quiz and flip cards before rereading notes.",
    wordCount > 150
      ? "Chunk the topic into 3 logical phases and explain each phase without peeking."
      : "Turn each glossary term into a 10-second elevator pitch to verify recall.",
    "Review the Google Search fact-checks for verified precision on numbers and definitions.",
    "Trace the concept mindmap from the central hub outwards to master relationships."
  ];
}

function buildMisconceptions(title, topTerms, sentences) {
  const misconceptions = [];

  if (topTerms[0] && topTerms[1]) {
    misconceptions.push({
      misconception: `Confusing the primary role of "${topTerms[0]}" with "${topTerms[1]}".`,
      correction: `Ensure you distinguish their individual inputs, outputs, and locations in the system.`
    });
  }

  misconceptions.push({
    misconception: `Assuming ${title} occurs in isolation without upstream or downstream dependencies.`,
    correction: `Always contextualize how ${title} connects to adjacent processes and environmental conditions.`
  });

  if (topTerms[2]) {
    misconceptions.push({
      misconception: `Treating "${topTerms[2]}" as an interchangeable term rather than a specific entity.`,
      correction: `Use exact terminology and formal definitions in written exam answers.`
    });
  }

  return misconceptions;
}

function buildApplications(title, topTerms, sentences) {
  return [
    `Applied in modern scientific research and biotechnology to optimize metabolic and energetic efficiency.`,
    `Essential framework for computational modeling, algorithmic problem-solving, and systems design.`,
    `Crucial in diagnostic medicine, pharmacology, and industrial process engineering.`,
    `Informs environmental analysis and ecological equilibrium modeling.`
  ];
}

function buildCheatSheet(title, topTerms, sentences) {
  const sheet = [
    { label: "Core Subject", value: title },
    { label: "Primary Focus", value: topTerms.slice(0, 3).join(", ") || "Foundational principles" },
    { label: "Recall Priority", value: "High (Exams & Assessment)" },
    { label: "Key Mechanism", value: sentences[0] ? clip(sentences[0], 110) : "Primary functional pathway" }
  ];

  if (topTerms[3]) {
    sheet.push({ label: "Critical Component", value: titleCase(topTerms[3]) });
  }

  return sheet;
}

function buildKeywordBullets(terms, sentences) {
  return terms.slice(0, 5).map(
    (term) => `Focus on how "${term}" connects to the overall topic${sentenceContaining(sentences, term) ? " (it appears in the notes)." : "."}`
  );
}

function buildTitle(topTerms, notes) {
  const bigram = topBigram(tokenize(notes));
  if (bigram) return titleCase(bigram);

  const unigram = topTerms.find((word) => word.length > 3);
  if (unigram) return titleCase(unigram);

  return "Study Notes";
}

// ---------------------------------------------------------------------------
// Text analysis helpers
// ---------------------------------------------------------------------------

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function topBigram(words) {
  const counts = new Map();
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`;
    counts.set(pair, (counts.get(pair) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked.length ? ranked[0][0] : "";
}

function extractTopTerms(words, sentences) {
  const counts = new Map();
  for (const word of words) {
    if (word.length < 3) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .filter((word) => word.length > 3 || hasSentenceMention(sentences, word))
    .slice(0, 8);
}

function hasSentenceMention(sentences, word) {
  return sentences.some((sentence) => sentence.toLowerCase().includes(word));
}

function sentenceContaining(sentences, word) {
  return sentences.find((sentence) => sentence.toLowerCase().includes(word)) || "";
}

function splitIntoSentences(notes) {
  return notes
    .split(sentenceSplitter)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function scoreSentences(sentences) {
  const keywords = new Set([
    "important",
    "because",
    "therefore",
    "defined",
    "means",
    "includes",
    "result",
    "process",
    "function",
    "concept",
    "main",
    "called",
    "produce",
    "allows"
  ]);

  return sentences
    .map((text, index) => {
      const normalized = text.toLowerCase();
      const wordCount = extractWordCount(text);
      const keywordBoost = Array.from(keywords).reduce(
        (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
        0
      );
      const lengthScore = wordCount >= 8 && wordCount <= 30 ? 2 : 0;
      const positionScore = index === 0 || index === 1 ? 1 : 0;

      return {
        index,
        text,
        score: keywordBoost + lengthScore + positionScore
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function normalizeSentence(sentence) {
  return sentence.replace(/\s+/g, " ").trim();
}

function titleCase(text) {
  return text
    .split(" ")
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function clip(text, max) {
  const normalized = normalizeSentence(text);
  return normalized.length > max ? `${normalized.slice(0, max - 1).trim()}…` : normalized;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Normalization so AI + fallback results always share the same rich shape
// ---------------------------------------------------------------------------

function normalizeResult(result) {
  return {
    title: result.title || "Study Notes",
    summary: result.summary || "",
    simpleExplanation: result.simpleExplanation || "",
    keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
    keyTerms: Array.isArray(result.keyTerms) ? result.keyTerms : [],
    flashcards: Array.isArray(result.flashcards) ? result.flashcards : [],
    quiz: Array.isArray(result.quiz) ? result.quiz : [],
    conceptMap: result.conceptMap || { central: "Topic", nodes: [], links: [] },
    stickyNotes: Array.isArray(result.stickyNotes) ? result.stickyNotes : [],
    studyTips: Array.isArray(result.studyTips) ? result.studyTips : [],
    webGrounding: Array.isArray(result.webGrounding) ? result.webGrounding : [],
    commonMisconceptions: Array.isArray(result.commonMisconceptions) ? result.commonMisconceptions : [],
    realWorldApplications: Array.isArray(result.realWorldApplications) ? result.realWorldApplications : [],
    keyFactsCheatSheet: Array.isArray(result.keyFactsCheatSheet) ? result.keyFactsCheatSheet : []
  };
}

