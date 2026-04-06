const sentenceSplitter = /(?<=[.!?])\s+/;

export function validateNotesInput(notes, options = {}) {
  const minWords = options.minWords ?? 50;
  const maxChars = options.maxChars ?? 12000;
  const wordCount = extractWordCount(notes);

  if (!notes) {
    return {
      valid: false,
      message: "Paste your notes first so we can turn them into a study-friendly summary."
    };
  }

  if (wordCount < minWords) {
    return {
      valid: false,
      message: `Please enter at least ${minWords} words so the summary has enough context.`
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

export function buildFallbackResult(notes) {
  const sentences = splitIntoSentences(notes);
  const scored = scoreSentences(sentences);
  const summarySource = scored.slice(0, 3);
  const keyPoints = scored.slice(0, 5).map((sentence) => normalizeSentence(sentence.text));
  const summary = summarySource
    .sort((a, b) => a.index - b.index)
    .map((sentence) => normalizeSentence(sentence.text))
    .join(" ");

  return {
    summary: summary || "These notes cover the main topic, its supporting ideas, and the core details you should revise first.",
    keyPoints: keyPoints.length > 0 ? keyPoints : buildKeywordBullets(notes),
    simpleExplanation: buildSimpleExplanation(notes, sentences),
    studyTips: buildStudyTips(notes)
  };
}

export async function summarizeWithOpenAI(notes, { apiKey, model }) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "keyPoints", "simpleExplanation", "studyTips"],
    properties: {
      summary: { type: "string" },
      keyPoints: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 6
      },
      simpleExplanation: { type: "string" },
      studyTips: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4
      }
    }
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: [
                "You are an expert academic tutor and study coach.",
  "Transform the user's notes into a high-quality revision pack that actually teaches the topic.",
  "",
  "Rules:",
  "- Explain the WHY and HOW behind concepts, not just facts.",
  "- Provide context and connect ideas (big picture understanding).",
  "- Use simple analogies where helpful.",
  "- Do NOT make up information. Only use the provided notes.",
  "",
  "Output Structure:",
  "- summary: A clear, well-explained narrative (not just bullet points).",
  "- keyPoints: Detailed and meaningful bullet points (not one-liners).",
  "- simpleExplanation: Explain like the student is 10 years old.",
  "- studyTips: Practical, actionable tips for revision and recall."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Summarize these notes:\n\n${notes}`
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

  return {
    summary: parsed.summary,
    keyPoints: parsed.keyPoints,
    simpleExplanation: parsed.simpleExplanation,
    studyTips: parsed.studyTips
  };
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output || []) {
    if (!item.content) {
      continue;
    }

    for (const contentItem of item.content) {
      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }
    }
  }

  return "";
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
    "concept"
  ]);

  return sentences
    .map((text, index) => {
      const normalized = text.toLowerCase();
      const wordCount = extractWordCount(text);
      const keywordBoost = Array.from(keywords).reduce(
        (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
        0
      );
      const lengthScore = wordCount >= 8 && wordCount <= 28 ? 2 : 0;
      const positionScore = index === 0 || index === 1 ? 1 : 0;

      return {
        index,
        text,
        score: keywordBoost + lengthScore + positionScore
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function buildSimpleExplanation(notes, sentences) {
  const firstSentence = normalizeSentence(sentences[0] || notes.slice(0, 200));

  return [
    "Think of this topic like a quick lesson from a helpful classmate.",
    firstSentence,
    "The main idea is to remember what it is, why it matters, and the few details that usually show up in exams."
  ].join(" ");
}

function buildKeywordBullets(notes) {
  const words = notes
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 5);

  const counts = new Map();
  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => `Focus on how "${word}" connects to the overall topic.`);
}

function buildStudyTips(notes) {
  const wordCount = extractWordCount(notes);

  return [
    "Revise the key points out loud once before rereading the full notes.",
    wordCount > 180
      ? "Break the topic into 3 small chunks and test yourself after each chunk."
      : "Turn each key point into a flashcard question for faster recall.",
    "Use the simple explanation when you need a last-minute exam recap."
  ];
}

function normalizeSentence(sentence) {
  return sentence.replace(/\s+/g, " ").trim();
}
