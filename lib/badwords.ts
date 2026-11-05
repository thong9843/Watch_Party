// Profanity and toxic words dictionary (Vietnamese & English)
const BAD_WORDS: string[] = [
  'dm',
  'dcm',
  'đm',
  'đcm',
  'vcl',
  'vl',
  'vkl',
  'cl',
  'đụ',
  'du me',
  'đụ má',
  'đụ mẹ',
  'cặc',
  'lồn',
  'buồi',
  'đĩ',
  'chó đẻ',
  'óc chó',
  'ngu lol',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'dick',
  'pussy',
];

// Regex matching whole words or common abbreviations
const BAD_WORDS_REGEX = new RegExp(
  `\\b(${BAD_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

/**
 * Filters out toxic/bad words from chat text, replacing them with asterisks ***
 */
export function filterBadWords(text: string): string {
  if (!text) return text;
  return text.replace(BAD_WORDS_REGEX, (match) => '*'.repeat(match.length));
}

