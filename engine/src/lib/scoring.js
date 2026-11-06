/**
 * Podcast Scoring & Virality Heuristic Engine
 * Evaluates candidate clips across four distinct sub-scores (0-25 each, totaling 0-100):
 * 1. Hook (0-25): Immediate grab in first 3 seconds
 * 2. Standalone Clarity (0-25): Complete idea, penalizing "as I said earlier" / dangling context
 * 3. Emotion & Payoff (0-25): Intellectual or emotional punchline
 * 4. Retention (0-25): Ends on a strong beat, compelling loop
 */

/**
 * Computes deterministic total score from four 0-25 sub-scores
 * @param {{
 *   hook?: number,
 *   standaloneClarity?: number,
 *   emotionPayoff?: number,
 *   retentionLoop?: number
 * }} subScores
 * @returns {{
 *   total: number,
 *   hook: number,
 *   standaloneClarity: number,
 *   emotionPayoff: number,
 *   retentionLoop: number
 * }}
 */
export function calculateTotalScore(subScores = {}) {
  const clampSub = (val) => {
    const num = Number(val);
    if (isNaN(num)) return 0;
    return Math.max(0, Math.min(25, Math.round(num)));
  };

  const hook = clampSub(subScores.hook);
  const standaloneClarity = clampSub(subScores.standaloneClarity);
  const emotionPayoff = clampSub(subScores.emotionPayoff);
  const retentionLoop = clampSub(subScores.retentionLoop);

  const total = hook + standaloneClarity + emotionPayoff + retentionLoop;

  return {
    total: Math.max(0, Math.min(100, total)),
    hook,
    standaloneClarity,
    emotionPayoff,
    retentionLoop
  };
}

/**
 * Fast in-code heuristic pre-ranking score for transcript windows
 * Evaluates speech density, hook openers, curiosity questions, and penalizes filler/sponsors.
 *
 * @param {string} text
 * @param {number} durationSec
 * @returns {number}
 */
export function scoreWindowHeuristic(text, durationSec) {
  if (!text || typeof text !== 'string' || durationSec <= 0) return 0;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 12) return 0;

  let score = 0;

  // 1. Words per second (sweet spot: 2.1 to 3.4 wps)
  const wps = words.length / durationSec;
  if (wps >= 2.0 && wps <= 3.5) {
    score += 25;
  } else if (wps >= 1.5 && wps < 2.0) {
    score += 15;
  } else if (wps > 3.5 && wps <= 4.5) {
    score += 18;
  } else {
    score += 5;
  }

  // 2. Curiosity hooks & questions
  const questionCount = (text.match(/\?/g) || []).length;
  score += Math.min(15, questionCount * 5);

  // 3. Energy / exclamations
  const exclamationCount = (text.match(/!/g) || []).length;
  score += Math.min(10, exclamationCount * 3);

  // 4. Strong Viral Hook & Storytelling Openers (Huge bonus for meaningful beats)
  const viralHookPatterns = /\b(the truth is|the secret to|the biggest mistake|nobody talks about|what people don't realize|the moment that changed|here is why|i will never forget|the real reason|the brutal reality|stop doing|if you want to|the 1 thing|this is how|the rule is|i realized that|my whole life changed|the darkest moment|the greatest lesson)\b/gi;
  const hookMatches = (text.match(viralHookPatterns) || []).length;
  score += hookMatches * 15;

  // 5. High-retention topics: Mindset, psychology, discipline, wealth, life lessons
  const coreConceptTokens = /\b(discipline|success|mindset|focus|habit|money|wealth|failure|psychology|relationship|dopamine|regret|decision|sacrifice|courage|truth|lesson|power|ambition|fear|death|time|future|brain|life)\b/gi;
  const conceptHits = (text.match(coreConceptTokens) || []).length;
  score += Math.min(30, conceptHits * 4);

  // 6. Immediate emotional cues
  const emotionalTokens = /\b(why|how|secret|truth|never|always|insane|crazy|mistake|shocking|unbelievable|huge|warning|stop|wait|watch|lesson|remember|advice|listen)\b/gi;
  const emoMatches = (text.match(emotionalTokens) || []).length;
  score += Math.min(20, emoMatches * 3);

  // 7. PENALTIES: Housekeeping, sponsor reads, technical checks, dangling references
  const junkPatterns = /\b(welcome back|sponsor|brought to you by|our sponsor|check the link|promo code|discount code|subscribe to the channel|hit the bell|leave a review|can you hear me|mic check|give me a second|pull up my notes|thanks for having me on|see you next time|take a quick break|cut to commercial|as i said earlier|like i mentioned before)\b/gi;
  const junkHits = (text.match(junkPatterns) || []).length;
  if (junkHits > 0) {
    score -= junkHits * 30;
  }

  return Math.max(0, score);
}

