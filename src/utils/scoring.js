/**
 * Deterministic Scoring and Financial Calculation Module
 * All total virality scores (0-100) and campaign earnings calculations
 * are strictly computed in deterministic code, never hallucinated by LLMs.
 */

/**
 * Computes the composite AI virality estimate from four distinct sub-scores (0-25 each).
 * Final score is strictly 0 to 100.
 *
 * @param {{
 *   hook?: number,
 *   standaloneClarity?: number,
 *   emotionPayoff?: number,
 *   campaignFit?: number
 * }} subScores
 * @returns {{
 *   total: number,
 *   hook: number,
 *   standaloneClarity: number,
 *   emotionPayoff: number,
 *   campaignFit: number
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
  const retentionLoop = clampSub(subScores.retentionLoop ?? subScores.campaignFit);

  const total = hook + standaloneClarity + emotionPayoff + retentionLoop;

  return {
    total: Math.max(0, Math.min(100, total)),
    hook,
    standaloneClarity,
    emotionPayoff,
    retentionLoop,
    campaignFit: retentionLoop
  };
}

/**
 * Calculates earnings for a clip based on view count and campaign CPM terms,
 * capped at the campaign's per-clip maximum payout.
 *
 * @param {number|string} views
 * @param {number|string} cpmRate
 * @param {number|string} perClipMax
 * @returns {number} Estimated earnings in USD (rounded to 2 decimal places)
 */
export function calculateEarnings(views, cpmRate, perClipMax) {
  const v = Math.max(0, Math.floor(Number(views) || 0));
  const rate = Math.max(0, Number(cpmRate) || 0);
  const cap = Math.max(0, Number(perClipMax) || 0);

  if (v <= 0 || rate <= 0) return 0.00;

  const rawEarnings = (v / 1000) * rate;
  const capped = cap > 0 ? Math.min(cap, rawEarnings) : rawEarnings;

  return Math.round(capped * 100) / 100;
}

/**
 * Computes overall tracking summary for a campaign's clips
 * @param {Array<Object>} clips
 * @param {Object} campaign
 * @returns {{
 *   totalClips: number,
 *   totalViews: number,
 *   totalEarnings: number,
 *   maxPotentialEarnings: number,
 *   byStatus: Record<string, number>
 * }}
 */
export function calculateCampaignSummary(clips = [], campaign = {}) {
  const byStatus = {
    found: 0,
    editing: 0,
    posted: 0,
    submitted: 0,
    rejected: 0
  };

  let totalViews = 0;
  let totalEarnings = 0;

  const cpmRate = Number(campaign.cpmRate) || 0;
  const perClipMax = Number(campaign.perClipMax) || 0;

  for (const clip of clips) {
    const st = (clip.status || 'found').toLowerCase();
    if (byStatus[st] !== undefined) {
      byStatus[st]++;
    } else {
      byStatus.found++;
    }

    const views = Number(clip.views) || 0;
    if (views > 0) {
      totalViews += views;
      totalEarnings += calculateEarnings(views, cpmRate, perClipMax);
    }
  }

  const maxPotentialEarnings = clips.length * perClipMax;

  return {
    totalClips: clips.length,
    totalViews,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    maxPotentialEarnings: Math.round(maxPotentialEarnings * 100) / 100,
    byStatus
  };
}

/**
 * Cheap heuristic pre-ranking score for transcript windows
 * Evaluates speech pacing, questions, emotional peaks, and campaign keyword matches.
 * Used to filter ~100+ windows down to top ~25 before LLM evaluation.
 *
 * @param {string} windowText
 * @param {number} durationSec
 * @param {Object} [campaign]
 * @returns {number} Heuristic score
 */
export function scoreWindowHeuristic(windowText, durationSec, campaign = {}) {
  if (!windowText || typeof windowText !== 'string' || durationSec <= 0) return 0;

  const words = windowText.split(/\s+/).filter(Boolean);
  if (words.length < 10) return 0;

  let score = 0;

  // 1. Words per second (sweet spot: 2.0 to 3.5 words/sec)
  const wps = words.length / durationSec;
  if (wps >= 2.0 && wps <= 3.5) {
    score += 25;
  } else if (wps >= 1.4 && wps < 2.0) {
    score += 15;
  } else if (wps > 3.5 && wps <= 4.5) {
    score += 18;
  } else {
    score += 5;
  }

  // 2. Question marks (hooks, curiosity gaps)
  const questionMatches = (windowText.match(/\?/g) || []).length;
  score += Math.min(15, questionMatches * 5);

  // 3. Exclamations (energy, excitement)
  const exclamationMatches = (windowText.match(/!/g) || []).length;
  score += Math.min(10, exclamationMatches * 3);

  // 4. Strong Viral Hook & Storytelling Openers (Huge bonus for meaningful beats)
  const viralHookPatterns = /\b(the truth is|the secret to|the biggest mistake|nobody talks about|what people don't realize|the moment that changed|here is why|i will never forget|the real reason|the brutal reality|stop doing|if you want to|the 1 thing|this is how|the rule is|i realized that|my whole life changed|the darkest moment|the greatest lesson)\b/gi;
  const hookPatternHits = (windowText.match(viralHookPatterns) || []).length;
  score += hookPatternHits * 15;

  // 5. Meaningful Insight & Philosophy Keywords
  const meaningfulConceptTokens = /\b(discipline|success|mindset|focus|habit|money|wealth|failure|psychology|relationship|dopamine|regret|decision|sacrifice|courage|truth|lesson|power|ambition|fear|death|time|future|brain|life)\b/gi;
  const conceptHits = (windowText.match(meaningfulConceptTokens) || []).length;
  score += Math.min(30, conceptHits * 4);

  // 6. Emotional & reaction cues
  const emotionalTokens = /\b(why|how|secret|truth|never|always|insane|crazy|mistake|shocking|unbelievable|huge|warning|stop|wait|watch|lesson|remember|advice|listen)\b/gi;
  const tokenMatches = (windowText.match(emotionalTokens) || []).length;
  score += Math.min(20, tokenMatches * 3);

  // 7. PENALTY: Heavily downgrade conversational filler, housekeeping, and sponsor reads
  const junkTokens = /\b(welcome back|sponsor|brought to you by|our sponsor|check the link|promo code|discount code|subscribe to the channel|hit the bell|leave a review|can you hear me|mic check|give me a second|pull up my notes|thanks for having me on|see you next time|take a quick break|cut to commercial)\b/gi;
  const junkHits = (windowText.match(junkTokens) || []).length;
  if (junkHits > 0) {
    score -= junkHits * 35;
  }

  // 8. Campaign / user topic keywords match
  if (campaign) {
    const campaignTokens = [];
    if (campaign.name) campaignTokens.push(...campaign.name.toLowerCase().split(/\s+/));
    if (campaign.rules) campaignTokens.push(...campaign.rules.toLowerCase().split(/\s+/));
    if (Array.isArray(campaign.requiredHashtags)) {
      campaignTokens.push(...campaign.requiredHashtags.map(t => t.replace('#', '').toLowerCase()));
    }

    const uniqueCampaignKeywords = Array.from(new Set(campaignTokens.filter(t => t.length > 3)));
    let keywordHits = 0;
    const lowerText = windowText.toLowerCase();

    for (const kw of uniqueCampaignKeywords) {
      if (lowerText.includes(kw)) {
        keywordHits++;
      }
    }
    score += Math.min(25, keywordHits * 5);
  }

  return Math.max(0, score);
}
