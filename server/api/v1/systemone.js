// Shared-key proxy so extension users need no API key.
// Forwards only requests shaped exactly like the extension's to Jev on OpenRouter, with the owner's key
// (OPENROUTER_API_KEY env var). Abuse limits: this validation, a per-IP Vercel Firewall rate limit,
// and a spending cap set on the OpenRouter key itself. Post text is never logged.

const UPSTREAM = 'https://openrouter.ai/api/v1/systemone'
const MAX_STATE = 8_000 // chars of JSON; the extension sends ≤ ~2k
const MAX_QUESTIONS = 24 // 7 built-in + topics
const MAX_QUESTIONS_JSON = 16_000

const bad = (status, error) => Response.json({ error }, { status })

// Returns an error message, or null if the body is a legitimate extension request.
export function invalid(body) {
  if (!body || typeof body !== 'object') return 'body must be a JSON object'
  const { state, questions } = body
  if (!state || typeof state.post !== 'object') return 'state.post required'
  if (JSON.stringify(state).length > MAX_STATE) return 'state too large'
  const qs = questions && typeof questions === 'object' ? Object.values(questions) : []
  if (!qs.length || qs.length > MAX_QUESTIONS) return `1–${MAX_QUESTIONS} questions required`
  if (qs.some(q => q?.type !== 'noul')) return 'only noul questions are allowed'
  if (JSON.stringify(questions).length > MAX_QUESTIONS_JSON) return 'questions too large'
  return null
}

export async function POST(request) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return bad(503, 'proxy not configured')

  let body
  try { body = await request.json() } catch { return bad(400, 'invalid JSON') }
  const problem = invalid(body)
  if (problem) return bad(400, problem)

  // Model is forced: this key only ever buys Jev.
  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/rahulr8/feed-control',
      'X-Title': 'Feed Control',
    },
    body: JSON.stringify({ model: 'jev-latest', state: body.state, questions: body.questions }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  if (!upstream) return bad(504, 'upstream timeout')

  // Pass status through (402 = shared budget spent, 429 = upstream busy) so the extension can explain it.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', ...(upstream.headers.get('retry-after') && { 'Retry-After': upstream.headers.get('retry-after') }) },
  })
}
