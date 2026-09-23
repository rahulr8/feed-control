// Pure logic: which Jev questions to ask and how to turn answers into a verdict.

// Both serve TypeSafe's System One API (POST {baseUrl}/v1/systemone); custom is e.g. a company proxy.
export const PROVIDERS = {
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api', keyUrl: 'https://openrouter.ai/settings/keys' },
  typesafe: { label: 'TypeSafe', baseUrl: 'https://api.typesafe.ai', keyUrl: 'https://console.typesafe.ai/keys' },
  custom: { label: 'Custom' },
}

export const baseUrlOf = s => PROVIDERS[s.provider]?.baseUrl ?? s.baseUrl

export const DEFAULTS = {
  provider: 'openrouter',
  baseUrl: '',
  strictness: 'balanced',
  filters: [
    { id: 'promoted', label: 'Promoted', on: true },
    { id: 'slop', label: 'AI slop', on: true },
    { id: 'stealth', label: 'Ads & self-promo', on: true },
  ],
}

// Built-in labels come from code so renames reach users whose filters are already saved.
export const labelOf = f => DEFAULTS.filters.find(d => d.id === f.id)?.label ?? f.label

// [hide, dim] thresholds on a filter's 0–1 score
export const STRICTNESS = { relaxed: [0.85, 0.7], balanced: [0.75, 0.55], strict: [0.6, 0.45] }

const noul = (instructions, criteria) => ({ type: 'noul', instructions, ...(criteria && { criteria }) })

// Composite scoring: independent atomic Nouls, combined in code (docs.typesafe.ai/patterns/composite-scoring).
// [weight, question]; weights feed the default weighted mean.
const BUILTIN = {
  slop: {
    style: [2, noul('Is `post.body` written in the style of unedited chatbot output, such as bolded section headers, emoji bullet points, or stock phrases like "In conclusion", "Here\'s the thing", or "Let\'s dive in"?', {
      true: 'Reads like text pasted from a chatbot',
      false: 'Reads like a person wrote it, including well-organized human guides and non-native English',
    })],
    no_specifics: [1.5, noul('Is `post.body` generic, lacking concrete first-hand details such as names, numbers, places, or specific events?', {
      true: 'Vague and generic; could have been written by anyone',
      false: 'Contains specific personal or factual details',
    })],
    bait: [0.5, noul('Does `post` end with a generic question meant to farm comments, such as "What do you think?" or "Thoughts?"')],
  },
  stealth: {
    promotes: [1, noul('Does `post` push readers toward a specific named product, service, app, or brand?', {
      true: 'Advertises or recommends a specific product or brand to readers',
      false: 'Mentions products only in passing, asks for neutral advice, or names none',
    })],
    disguised: [1, noul('Is `post` framed as a personal story, question, or recommendation request while steering readers toward a specific product?')],
    cta: [1, noul('Does `post` ask readers to visit a link, use a discount code, sign up, or DM the author?')],
  },
}

// Filters whose signals aren't interchangeable get their own rule instead of the weighted mean.
const COMBINE = {
  // Gate: nothing is an ad unless it promotes something. Open promotion scores 0.8x; disguise or a CTA lifts it to 1x.
  stealth: a => a.promotes * Math.max(a.disguised, a.cta, 0.8),
}

// Slop is judged on writing; title-only posts (images, links, video) give it nothing to judge.
// Tweets are short by design and have no title, so the bar is lower there.
export const MIN_SLOP_BODY = { reddit: 120, x: 60 }
export const applies = (f, post, site = 'reddit') => f.id !== 'slop' || post.body.length >= MIN_SLOP_BODY[site]

// Topic passed as data, not spliced into a sentence, so any phrasing works ("Trump", "AI-related", "sports").
const topic = label => ({
  match: [1, noul({
    topic: label,
    question: 'Is `post` mainly about `topic` or something that falls under it, such as related news, discussion, products, people, or opinions?',
  }, {
    true: `The post's main subject falls under "${label}"`,
    false: `The post is about something else; "${label}" is absent or only mentioned in passing`,
  })],
})

export const topicId = label => 'topic-' + label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')

const specs = f => BUILTIN[f.id] ?? (f.id.startsWith('topic-') ? topic(f.label) : {})

export function questionsFor(filters) {
  const qs = {}
  for (const f of filters) for (const [q, [, ask]] of Object.entries(specs(f))) qs[`${f.id}.${q}`] = ask
  return qs
}

// Filter score in 0–1; null if any answer is missing (filter then never triggers).
export function score(f, answers) {
  const spec = Object.entries(specs(f))
  const a = Object.fromEntries(spec.map(([q]) => [q, answers[`${f.id}.${q}`]]))
  if (!spec.length || Object.values(a).some(v => v == null)) return null
  if (COMBINE[f.id]) return COMBINE[f.id](a)
  const weight = spec.reduce((s, [, [w]]) => s + w, 0)
  return spec.reduce((s, [q, [w]]) => s + w * a[q], 0) / weight
}

// What the user sees on a hidden post: [confident, borderline].
const PHRASES = {
  promoted: ['Promoted post'],
  slop: ['Likely AI slop', 'Possibly AI slop'],
  stealth: ['Likely promotional', 'Possibly promotional'],
}
export const describe = (f, tier) =>
  PHRASES[f.id]?.[tier === 'hide' ? 0 : 1] ?? `${tier === 'hide' ? 'About' : 'Possibly about'} ${f.label}`

// Highest-scoring enabled filter wins; tier from strictness thresholds.
export function verdict(answers, filters, strictness = 'balanced') {
  const [hide, dim] = STRICTNESS[strictness] ?? STRICTNESS.balanced
  let best = null
  for (const f of filters) {
    const s = f.on ? score(f, answers) : null
    if (s != null && (!best || s > best.score)) best = { f, score: s }
  }
  if (!best || best.score < dim) return null
  const tier = best.score >= hide ? 'hide' : 'dim'
  return { label: describe(best.f, tier), score: best.score, tier }
}

// The whole decision for one post, shared by the extension, eval/run.js and the dev stub.
// Callers own caching and transport: pass cached `answers` and an `ask(post, questions)` (omit to never ask).
// Returns the verdict plus the merged answers; `asked` says whether new answers need caching.
export async function classify({ site, promoted, post }, { filters, strictness }, { answers = {}, ask } = {}) {
  const active = filters.filter(f => f.on && applies(f, post, site))
  if (promoted) {
    const f = active.find(f => f.id === 'promoted')
    return { verdict: f ? { label: describe(f, 'hide'), tier: 'hide' } : null, answers, asked: false }
  }
  // Only questions not answered yet, e.g. a newly added topic.
  const missing = Object.entries(questionsFor(active)).filter(([q]) => !(q in answers))
  const asked = missing.length > 0 && !!ask
  if (asked) answers = { ...answers, ...await ask(post, Object.fromEntries(missing)) }
  return { verdict: verdict(answers, active, strictness), answers, asked } // unanswered filters score null
}

const ERRORS = { 401: 'Invalid API key', 402: 'Out of credits', 403: 'API key not allowed', 429: 'Rate limited, slow down' }
const RETRY = [429, 500, 502, 503, 524, 529]

// One request per post, every question fanned out in it (docs.typesafe.ai/patterns/fan-out).
export async function askJev({ apiKey, baseUrl }, post, questions) {
  const ids = Object.keys(questions) // sent as q0, q1…: plain keys every API accepts
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'jev-latest', state: { post }, questions: Object.fromEntries(ids.map((q, i) => [`q${i}`, questions[q]])) }),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const { answers } = await res.json()
      return Object.fromEntries(ids
        .map((q, i) => [q, answers[`q${i}`]?.noul])
        .filter(([, a]) => typeof a === 'number'))
    }
    if (attempt === 2 || !RETRY.includes(res.status)) throw new Error(ERRORS[res.status] ?? `API error ${res.status}`)
    const wait = Number(res.headers.get('retry-after')) || 2 ** attempt
    await new Promise(r => setTimeout(r, Math.min(wait, 10) * 1000))
  }
}
