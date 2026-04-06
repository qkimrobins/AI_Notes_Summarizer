import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFallbackResult,
  extractWordCount,
  validateNotesInput
} from "../src/summarizer.js";

const longNotes =
  "Cellular respiration is the process cells use to release energy from glucose. It usually happens in the mitochondria. During the process, glucose reacts with oxygen to produce carbon dioxide, water, and ATP, which is the usable energy for the cell. This matters because living things need ATP for movement, growth, repair, and other essential functions. Students often compare cellular respiration with photosynthesis because the outputs of one process connect to the inputs of the other.";

test("validateNotesInput rejects short notes", () => {
  const result = validateNotesInput("too short", { minWords: 10, maxChars: 1000 });
  assert.equal(result.valid, false);
});

test("extractWordCount counts words accurately", () => {
  assert.equal(extractWordCount("one two   three"), 3);
});

test("buildFallbackResult returns study-friendly sections", () => {
  const result = buildFallbackResult(longNotes);

  assert.ok(result.summary.length > 20);
  assert.ok(Array.isArray(result.keyPoints));
  assert.ok(result.keyPoints.length >= 3);
  assert.ok(result.simpleExplanation.includes("main idea"));
  assert.ok(result.studyTips.length >= 2);
});
