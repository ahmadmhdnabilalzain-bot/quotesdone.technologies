// Copy rules from docs/website/copy-v1.md §1 (rules 6 to 9) and structure-v1 §6.4.
// Shared by tests/unit/content.test.ts and scripts/check-content.mjs. Plain JS so Node runs it as is.

/** @type {Array<{ id: string, pattern: RegExp, why: string }>} */
export const CONTENT_RULES = [
  {
    id: 'banned-word',
    pattern:
      /\b(revolutionary|cutting-edge|seamless(ly)?|unlock|empower|leverage|elevate|transform(s|ing|ative)?|magic(al)?|journey|effortless(ly)?|perfect|ideal|world-class|innovative|innovation|solutions?)\b/gi,
    why: 'copy deck §1 rule 6',
  },
  {
    id: 'unprovable-claim',
    pattern: /\b((the|our|uae'?s) (first|only|best|leading)|best|leading|trusted by|thousands of|award-winning|compliant|certified)\b/gi,
    why: 'copy deck §1 rule 7',
  },
  { id: 'ai-selling-word', pattern: /\bAI\b/g, why: 'copy deck §1 rule 8' },
  { id: 'exclamation', pattern: /!(?=\s|$)/g, why: 'copy deck §1 rule 8' },
  { id: 'em-dash', pattern: /\u2014/g, why: 'copy deck §1 rule 8' },
  { id: 'wrong-legal-form', pattern: /\bL\.?\s?L\.?\s?C\b\.?|\bHoldings\b/gi, why: 'copy deck §1 rule 9: Sole Establishment, never L.L.C.' },
  { id: 'placeholder', pattern: /\[OWNER TO CONFIRM[^\]]*\]|\bTODO\b|\bTBD\b|lorem ipsum/gi, why: 'structure-v1 §6.4' },
];

/** @returns {Array<{ rule: string, match: string, why: string }>} */
export function findContentViolations(text) {
  const found = [];
  for (const rule of CONTENT_RULES) {
    for (const match of text.matchAll(rule.pattern)) found.push({ rule: rule.id, match: match[0], why: rule.why });
  }
  return found;
}

/** Visible text of an HTML page: drops scripts, styles, inline SVG paths and comments; keeps meta title/description. */
export function visibleText(html) {
  const meta = [...html.matchAll(/<(title)>([\s\S]*?)<\/title>|<meta name="description" content="([^"]*)"/g)]
    .map((m) => m[2] ?? m[3] ?? '')
    .join('\n');
  const body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
  return `${meta}\n${body}`.replace(/\s+/g, ' ');
}
