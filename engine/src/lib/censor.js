/**
 * Profanity Censorship Engine
 * Replaces letters after the first with asterisks (e.g. "p***", "f***", "s***")
 * Preserves punctuation, casing, and sentence structure.
 */

// Common strong English profanities and variations
export const PROFANITY_LIST = [
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckers', 'fucks',
  'shit', 'shits', 'shitting', 'bullshit',
  'bitch', 'bitches', 'bitching',
  'asshole', 'assholes',
  'cunt', 'cunts',
  'dick', 'dicks',
  'pussy', 'pussies',
  'bastard', 'bastards',
  'cock', 'cocks', 'cocksucker',
  'motherfucker', 'motherfuckers', 'motherfucking',
  'nigger', 'nigga', 'niggers', 'niggas',
  'faggot', 'faggots', 'fag', 'fags',
  'slut', 'sluts',
  'whore', 'whores'
];

/**
 * Creates regex matching exact profanities with word boundaries
 */
function buildProfanityRegex(wordList = PROFANITY_LIST) {
  // Sort longest words first so compound words match before stems
  const sorted = [...wordList].sort((a, b) => b.length - a.length);
  const pattern = `\\b(${sorted.join('|')})\\b`;
  return new RegExp(pattern, 'gi');
}

const DEFAULT_REGEX = buildProfanityRegex();

/**
 * Censors a single profane token, keeping the first character and replacing remainder with asterisks
 * @param {string} word
 * @returns {string}
 */
export function maskWord(word) {
  if (!word || word.length <= 1) return word;
  const first = word[0];
  const asterisks = '*'.repeat(word.length - 1);
  return first + asterisks;
}

/**
 * Checks whether text contains any strong profanity
 * @param {string} text
 * @returns {boolean}
 */
export function isProfane(text) {
  if (!text || typeof text !== 'string') return false;
  return DEFAULT_REGEX.test(text);
}

/**
 * Censors text by masking profane words with asterisks
 * @param {string} text
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true]
 * @param {string[]} [options.customList]
 * @returns {string}
 */
export function censorText(text, options = {}) {
  const enabled = options.enabled !== false;
  if (!enabled || !text || typeof text !== 'string') return text;

  const regex = options.customList ? buildProfanityRegex(options.customList) : DEFAULT_REGEX;

  return text.replace(regex, (match) => {
    return maskWord(match);
  });
}

