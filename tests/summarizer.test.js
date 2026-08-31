import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFallbackResult,
  extractWordCount,
  validateNotesInput
} from "../src/summarizer.js";
import {
  searchWeb,
  fetchGroundingForTerms,
  researchTopicFromWeb
} from "../src/search.js";

const longNotes =
  "Cellular respiration is the process cells use to release energy from glucose. It usually happens in the mitochondria. During the process, glucose reacts with oxygen to produce carbon dioxide, water, and ATP, which is the usable energy for the cell. This matters because living things need ATP for movement, growth, repair, and other essential functions. Students often compare cellular respiration with photosynthesis because the outputs of one process connect to the inputs of the other.";

test("validateNotesInput rejects short notes", () => {
  const result = validateNotesInput("too short", { minWords: 10, maxChars: 1000 });
  assert.equal(result.valid, false);
});

test("extractWordCount counts words accurately", () => {
  assert.equal(extractWordCount("one two   three"), 3);
});

test("buildFallbackResult returns comprehensive informative sections", () => {
  const result = buildFallbackResult(longNotes);

  assert.ok(result.summary.length > 20);
  assert.ok(Array.isArray(result.keyPoints));
  assert.ok(result.keyPoints.length >= 3);
  assert.ok(result.simpleExplanation.length > 20);
  assert.ok(result.studyTips.length >= 2);
  assert.ok(Array.isArray(result.webGrounding));
  assert.ok(result.webGrounding.length >= 1);
  assert.ok(Array.isArray(result.commonMisconceptions));
  assert.ok(result.commonMisconceptions.length >= 1);
  assert.ok(Array.isArray(result.realWorldApplications));
  assert.ok(result.realWorldApplications.length >= 1);
  assert.ok(Array.isArray(result.keyFactsCheatSheet));
  assert.ok(result.keyFactsCheatSheet.length >= 1);
});

test("searchWeb returns search snippets and google search urls", async () => {
  const results = await searchWeb("Cellular respiration", { limit: 2 });
  assert.ok(Array.isArray(results));
  assert.ok(results.length > 0);
  assert.ok(results[0].title);
  assert.ok(results[0].snippet);
  assert.ok(results[0].googleSearchUrl.includes("google.com/search"));
});

test("fetchGroundingForTerms resolves term fact-checks", async () => {
  const grounding = await fetchGroundingForTerms(["ATP", "Mitochondria"], "Cellular Respiration");
  assert.ok(Array.isArray(grounding));
  assert.ok(grounding.length >= 1);
  assert.ok(grounding[0].term);
  assert.ok(grounding[0].googleSearchUrl);
});

