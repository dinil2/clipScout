/**
 * Campaign Rules & Compliance Validator
 * Evaluates whether a candidate clip satisfies all campaign constraints:
 * duration limits, required hashtags, required mentions, and banned words.
 */

/**
 * Normalizes hashtag string for comparison (lowercased, stripping '#' prefix)
 * @param {string} tag
 * @returns {string}
 */
function normalizeTag(tag) {
  if (!tag) return '';
  return tag.trim().toLowerCase().replace(/^#/, '');
}

/**
 * Normalizes mention string for comparison (lowercased, stripping '@' prefix)
 * @param {string} mention
 * @returns {string}
 */
function normalizeMention(mention) {
  if (!mention) return '';
  return mention.trim().toLowerCase().replace(/^@/, '');
}

/**
 * Validates a clip against an active campaign's compliance rules
 *
 * @param {Object} clip
 * @param {Object} campaign
 * @returns {{
 *   passed: boolean,
 *   checks: {
 *     duration: { pass: boolean, currentSec: number, minSec: number, maxSec: number, message: string },
 *     hashtags: { pass: boolean, required: string[], missing: string[] },
 *     mentions: { pass: boolean, required: string[], missing: string[] },
 *     bannedWords: { pass: boolean, banned: string[], violations: string[] }
 *   }
 * }}
 */
export function validateClipAgainstRules(clip = {}, campaign = {}) {
  const minSec = Number(campaign.minClipSec) || 15;
  const maxSec = Number(campaign.maxClipSec) || 58;
  const durationSec = Number(clip.durationSeconds) || 0;

  // 1. Duration Check
  const durationPass = durationSec >= minSec && durationSec <= maxSec;
  const durationCheck = {
    pass: durationPass,
    currentSec: durationSec,
    minSec,
    maxSec,
    message: durationPass 
      ? `${durationSec}s is within ${minSec}–${maxSec}s limit`
      : `${durationSec}s violates ${minSec}–${maxSec}s limit`
  };

  // 2. Required Hashtags Check
  const reqHashtags = Array.isArray(campaign.requiredHashtags)
    ? campaign.requiredHashtags.filter(Boolean)
    : (typeof campaign.requiredHashtags === 'string' ? campaign.requiredHashtags.split(/[,\s]+/).filter(Boolean) : []);

  const clipTags = Array.isArray(clip.hashtags)
    ? clip.hashtags.map(normalizeTag)
    : [];

  const fullText = `${clip.title || ''} ${clip.description || ''}`.toLowerCase();
  const missingTags = [];

  for (const reqTag of reqHashtags) {
    const normReq = normalizeTag(reqTag);
    const presentInTags = clipTags.includes(normReq);
    const tagRegex = new RegExp(`#${normReq}\\b`, 'i');
    const presentInText = tagRegex.test(fullText);
    if (!presentInTags && !presentInText) {
      missingTags.push(reqTag);
    }
  }

  const hashtagsCheck = {
    pass: missingTags.length === 0,
    required: reqHashtags,
    missing: missingTags
  };

  // 3. Required Mentions Check
  const reqMentions = Array.isArray(campaign.requiredMentions)
    ? campaign.requiredMentions.filter(Boolean)
    : (typeof campaign.requiredMentions === 'string' ? campaign.requiredMentions.split(/[,\s]+/).filter(Boolean) : []);

  const missingMentions = [];
  for (const reqMention of reqMentions) {
    const normMention = normalizeMention(reqMention);
    const mentionRegex = new RegExp(`@${normMention}\\b`, 'i');
    const hasMention = mentionRegex.test(fullText);
    if (!hasMention) {
      missingMentions.push(reqMention);
    }
  }

  const mentionsCheck = {
    pass: missingMentions.length === 0,
    required: reqMentions,
    missing: missingMentions
  };

  // 4. Banned Words Check
  const bannedWords = Array.isArray(campaign.bannedWords)
    ? campaign.bannedWords.filter(Boolean)
    : (typeof campaign.bannedWords === 'string' ? campaign.bannedWords.split(/[,\n]+/).map(s => s.trim()).filter(Boolean) : []);

  const combinedContent = `${clip.title || ''} ${clip.hookText || ''} ${clip.description || ''} ${(clip.hashtags || []).join(' ')}`.toLowerCase();
  const violations = [];

  for (const word of bannedWords) {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) continue;
    // Word boundary match
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(combinedContent)) {
      violations.push(word);
    }
  }

  const bannedWordsCheck = {
    pass: violations.length === 0,
    banned: bannedWords,
    violations
  };

  const overallPass = durationCheck.pass && hashtagsCheck.pass && mentionsCheck.pass && bannedWordsCheck.pass;

  return {
    passed: overallPass,
    checks: {
      duration: durationCheck,
      hashtags: hashtagsCheck,
      mentions: mentionsCheck,
      bannedWords: bannedWordsCheck
    }
  };
}
