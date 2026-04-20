/**
 * Escape every regex metacharacter in a user-supplied string so it can be
 * safely embedded in a `new RegExp(...)` constructor.
 *
 * Why this matters:
 *  - The public catalog supports `?search=` which feeds directly into a
 *    `RegExp` against `title`, `description`, and `tags`. Without
 *    escaping, a crafted input like `(a+)+$` becomes a catastrophic
 *    backtracking pattern (ReDoS) that pegs the event loop and DoS-es
 *    the whole API for every other request.
 *  - Even non-malicious input (e.g. a user searching for `C++` or
 *    `node.js`) would otherwise hit a regex parse error or match the
 *    wrong things (`.` matches any char, `+` is a quantifier).
 *
 * The character class below is the canonical MDN-recommended set —
 * matches anything that has special meaning inside a JavaScript regex.
 * `\\$&` reinserts the matched character preceded by a backslash.
 *
 * Returns an empty string for non-string / nullish input so callers can
 * pipe it straight into `new RegExp(escapeRegex(input), 'i')` without an
 * extra guard.
 */

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

export const escapeRegex = (input) => {
  if (typeof input !== 'string' || input.length === 0) return '';
  return input.replace(REGEX_SPECIAL_CHARS, '\\$&');
};

export default escapeRegex;
