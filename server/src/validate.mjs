// validate.mjs — payload validation for the Hall of Fables API.
// Contract: ai-memory/10-v2-architecture.md §1.4/§1.5.
// Nickname is a WHITELIST (never escaping): ^[A-Za-z0-9 _-]{3,20}$, trim-equal,
// at least one alphanumeric. Scores: finite numbers, >= 0, <= 1e300;
// fastestPublishMs is finite >= 1 OR null. tomes/quills are floored server-side.

export const METRICS = /** @type {const} */ ([
  'lifetimeInspiration',
  'tomesPublished',
  'lifetimeQuillsEarned',
  'fastestPublishMs',
]);

const NICKNAME_RE = /^[A-Za-z0-9 _-]{3,20}$/;
const HAS_ALNUM_RE = /[A-Za-z0-9]/;
export const MAX_SCORE = 1e300;

/** @param {unknown} nickname */
export function isValidNickname(nickname) {
  return (
    typeof nickname === 'string' &&
    nickname.trim() === nickname &&
    NICKNAME_RE.test(nickname) &&
    HAS_ALNUM_RE.test(nickname)
  );
}

/** @param {unknown} v */
function isValidScore(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_SCORE;
}

/**
 * Validates a parsed submit body. Returns the first offending field
 * (best-effort, per contract) or the normalized value on success.
 * Unknown extra keys are ignored (tolerant reader).
 *
 * @param {unknown} body
 * @returns {{ ok: false, field: string } | { ok: true, value: {
 *   nickname: string,
 *   token: string | undefined,
 *   scores: { lifetimeInspiration: number, tomesPublished: number,
 *             lifetimeQuillsEarned: number, fastestPublishMs: number | null }
 * } }}
 */
export function validateSubmitBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, field: 'body' };
  }
  const b = /** @type {Record<string, unknown>} */ (body);

  if (!isValidNickname(b.nickname)) return { ok: false, field: 'nickname' };

  /** @type {string | undefined} */
  let token;
  if (b.token !== undefined && b.token !== null) {
    if (typeof b.token !== 'string' || b.token.length === 0) {
      return { ok: false, field: 'token' };
    }
    token = b.token;
  }

  const s = b.scores;
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    return { ok: false, field: 'scores' };
  }
  const scores = /** @type {Record<string, unknown>} */ (s);
  if (!isValidScore(scores.lifetimeInspiration)) return { ok: false, field: 'lifetimeInspiration' };
  if (!isValidScore(scores.tomesPublished)) return { ok: false, field: 'tomesPublished' };
  if (!isValidScore(scores.lifetimeQuillsEarned)) return { ok: false, field: 'lifetimeQuillsEarned' };

  const fastest = scores.fastestPublishMs;
  const fastestOk =
    fastest === null ||
    (typeof fastest === 'number' && Number.isFinite(fastest) && fastest >= 1 && fastest <= MAX_SCORE);
  if (fastest === undefined || !fastestOk) return { ok: false, field: 'fastestPublishMs' };

  return {
    ok: true,
    value: {
      nickname: /** @type {string} */ (b.nickname),
      token,
      scores: {
        lifetimeInspiration: /** @type {number} */ (scores.lifetimeInspiration),
        tomesPublished: Math.floor(/** @type {number} */ (scores.tomesPublished)),
        lifetimeQuillsEarned: Math.floor(/** @type {number} */ (scores.lifetimeQuillsEarned)),
        fastestPublishMs: /** @type {number | null} */ (fastest),
      },
    },
  };
}
