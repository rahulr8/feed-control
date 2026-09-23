// Scores labeled posts with the extension's own pipeline and reports errors per filter.
// Usage: OPENROUTER_API_KEY=... node eval/run.js   (or TYPESAFE_API_KEY=...)
// Env: EVAL_BASE_URL overrides the endpoint; EVAL_MODEL overrides the pinned model version.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { DEFAULTS, PROVIDERS, STRICTNESS, askJev, classify, fingerprint, questionsFor, score, topicId } from '../lib.js'
import { TOPICS } from './config.js'

const file = name => new URL(name, import.meta.url)
const provider = process.env.OPENROUTER_API_KEY ? 'openrouter' : 'typesafe'
// Pinned, not jev-latest: an alias can move under you and make runs incomparable.
const model = process.env.EVAL_MODEL ?? (provider === 'openrouter' ? 'jev-1.13' : 'jev-1.13.0')
const creds = { apiKey: process.env.OPENROUTER_API_KEY ?? process.env.TYPESAFE_API_KEY, baseUrl: process.env.EVAL_BASE_URL ?? PROVIDERS[provider].baseUrl, model }
if (!creds.apiKey) throw new Error('Set OPENROUTER_API_KEY or TYPESAFE_API_KEY')

// label key in posts.json -> filter
const FILTERS = [
  ['slop', DEFAULTS.filters.find(f => f.id === 'slop')],
  ['promo', DEFAULTS.filters.find(f => f.id === 'stealth')],
  ...TOPICS.map(t => [t, { id: topicId(t), label: t, on: true }]),
]

const posts = JSON.parse(readFileSync(file('posts.json'))).filter(p => p.labels)
if (!posts.length) throw new Error('No labeled posts; label them in eval/label.html first')

// Cache keyed by model + post content + question wording: any change re-asks only what changed.
const cache = existsSync(file('answers.json')) ? JSON.parse(readFileSync(file('answers.json'))) : {}
const hash = q => createHash('sha1').update(JSON.stringify(q)).digest('hex').slice(0, 10)

// Same pipeline as the extension (lib.classify); only the cache differs.
const settings = { filters: FILTERS.map(([, f]) => f), strictness: 'balanced' }
const qs = questionsFor(settings.filters)
const answersFor = async ({ id, labels, ...post }) => {
  const key = q => `${model}:${id}:${fingerprint(post)}:${hash(qs[q])}`
  const cached = Object.fromEntries(Object.keys(qs).filter(q => key(q) in cache).map(q => [q, cache[key(q)]]))
  const { answers } = await classify({ site: 'reddit', post }, settings, { answers: cached, ask: (p, q) => askJev(creds, p, q) })
  for (const [q, v] of Object.entries(answers)) cache[key(q)] = v
  return answers
}

// 6 requests in flight: well under rate limits, fast enough for ~100 posts.
const results = []
for (let i = 0; i < posts.length; i += 6) {
  results.push(...await Promise.all(posts.slice(i, i + 6).map(async p => ({ p, a: await answersFor(p) }))))
  process.stdout.write(`\rscored ${results.length}/${posts.length}`)
}
writeFileSync(file('answers.json'), JSON.stringify(cache, null, 2))
console.log(`\nmodel ${model}, ${posts.length} labeled posts\n`)

const pct = x => Number.isFinite(x) ? `${Math.round(x * 100)}%` : '–'
const short = s => (s.length > 70 ? s.slice(0, 69) + '…' : s)
// One-sided 95% Wilson lower bound: "precision is at least this", honest for small counts.
const lower = (k, n) => {
  if (!n) return NaN
  const z = 1.645, p = k / n
  return (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n)
}
// Fixed half split by id: thresholds are tuned on "tune" and judged only on "test".
const half = p => parseInt(fingerprint(p.id), 36) % 2 ? 'test' : 'tune'

for (const [labelKey, f] of FILTERS) {
  // Posts a filter can't judge (e.g. slop on a title-only post) count as misses if labeled yes.
  const all = results.map(({ p, a }) => ({ p, s: score(f, a), y: !!p.labels[labelKey] }))
  const rows = all.filter(r => r.s != null)
  const pos = all.filter(r => r.y).length
  const skipped = all.filter(r => r.y && r.s == null).length
  console.log(`## ${f.label}  (${rows.length} judged, ${all.length - rows.length} not applicable, ${pos} labeled yes)`)
  if (!pos) { console.log('  no positive labels, nothing to measure\n'); continue }

  console.log('  preset      hidden  wrong  precision (≥95% sure)   dimmed  wrong  missed  recall')
  for (const [name, [hide, dim]] of Object.entries(STRICTNESS)) {
    const H = rows.filter(r => r.s >= hide), D = rows.filter(r => r.s >= dim && r.s < hide)
    const hitsH = H.filter(r => r.y).length
    const missed = rows.filter(r => r.y && r.s < dim).length + skipped
    const left = `  ${name.padEnd(10)} ${String(H.length).padStart(6)} ${String(H.length - hitsH).padStart(6)}  ${pct(hitsH / H.length).padStart(5)} (≥${pct(lower(hitsH, H.length))})`
    console.log(`${left.padEnd(50)}${String(D.length).padStart(6)} ${String(D.filter(r => !r.y).length).padStart(6)} ${String(missed).padStart(7)}  ${pct((pos - missed) / pos).padStart(5)}`)
  }

  // Lowest cut-off on the tune half whose flagged set (3+) is ≥90% / ≥75% correct, then checked on the test half.
  const cut = (set, target) => [...new Set(set.map(r => r.s))].sort((a, b) => a - b).find(t => {
    const fl = set.filter(r => r.s >= t)
    return fl.length >= 3 && fl.filter(r => r.y).length / fl.length >= target
  })
  const check = t => {
    if (t == null) return 'n/a (not enough data on tune half)'
    const fl = rows.filter(r => half(r.p) === 'test' && r.s >= t), k = fl.filter(r => r.y).length
    return `${t.toFixed(2)} → on held-out half: ${fl.length} flagged, precision ${pct(k / fl.length)} (≥${pct(lower(k, fl.length))})`
  }
  const tune = rows.filter(r => half(r.p) === 'tune')
  console.log(`  suggested hide ${check(cut(tune, 0.9))}`)
  console.log(`  suggested dim  ${check(cut(tune, 0.75))}`)

  const [, dim] = STRICTNESS.balanced
  const bad = [
    ...rows.filter(r => !r.y && r.s >= dim).sort((a, b) => b.s - a.s).map(r => `  ✗ flagged ${r.s.toFixed(2)}  ${short(r.p.title)}  [${r.p.subreddit}]`),
    ...rows.filter(r => r.y && r.s < dim).sort((a, b) => a.s - b.s).map(r => `  ○ missed  ${r.s.toFixed(2)}  ${short(r.p.title)}  [${r.p.subreddit}]`),
    ...all.filter(r => r.y && r.s == null).map(r => `  ○ skipped (filter can't judge it)  ${short(r.p.title)}`),
  ]
  if (bad.length) console.log('  errors at balanced:\n' + bad.slice(0, 12).join('\n'))
  console.log()
}

// What the user actually experiences: a post is hidden if ANY enabled filter hides it.
const [hide] = STRICTNESS.balanced
const wanted = p => FILTERS.some(([k]) => p.labels[k])
const hidden = results.filter(({ a }) => FILTERS.some(([, f]) => (score(f, a) ?? 0) >= hide))
const wrong = hidden.filter(({ p }) => !wanted(p))
const legit = results.length - results.filter(({ p }) => wanted(p)).length
console.log('## All filters together (balanced)')
console.log(`  hidden ${hidden.length}, wrongly hidden ${wrong.length} = ${legit ? Math.round(1000 * wrong.length / legit) : '–'} per 1,000 posts you'd want to see`)
for (const { p } of wrong.slice(0, 8)) console.log(`  ✗ ${short(p.title)}  [${p.subreddit}]`)
