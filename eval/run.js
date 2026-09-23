// Scores labeled posts with the extension's own questions + request code and reports errors per filter.
// Usage: OPENROUTER_API_KEY=... node eval/run.js   (or TYPESAFE_API_KEY=...; EVAL_BASE_URL overrides the endpoint)
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { DEFAULTS, PROVIDERS, STRICTNESS, askJev, classify, questionsFor, score, topicId } from '../lib.js'
import { TOPICS } from './config.js'

const file = name => new URL(name, import.meta.url)
const provider = process.env.OPENROUTER_API_KEY ? 'openrouter' : 'typesafe'
const creds = { apiKey: process.env.OPENROUTER_API_KEY ?? process.env.TYPESAFE_API_KEY, baseUrl: process.env.EVAL_BASE_URL ?? PROVIDERS[provider].baseUrl }
if (!creds.apiKey) throw new Error('Set OPENROUTER_API_KEY or TYPESAFE_API_KEY')

// label key in posts.json -> filter
const FILTERS = [
  ['slop', DEFAULTS.filters.find(f => f.id === 'slop')],
  ['promo', DEFAULTS.filters.find(f => f.id === 'stealth')],
  ...TOPICS.map(t => [t, { id: topicId(t), label: t, on: true }]),
]

const posts = JSON.parse(readFileSync(file('posts.json'))).filter(p => p.labels)
if (!posts.length) throw new Error('No labeled posts; label them in eval/label.html first')

// Cache keyed by question wording, so editing a question in lib.js re-asks only that question.
const cache = existsSync(file('answers.json')) ? JSON.parse(readFileSync(file('answers.json'))) : {}
const hash = q => createHash('sha1').update(JSON.stringify(q)).digest('hex').slice(0, 10)

// Same pipeline as the extension (lib.classify); only the cache differs.
const settings = { filters: FILTERS.map(([, f]) => f), strictness: 'balanced' }
const qs = questionsFor(settings.filters)
const answersFor = async ({ id, labels, ...post }) => {
  const key = q => `${id}:${hash(qs[q])}`
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
console.log('\n')

const pct = x => Number.isNaN(x) ? '  –' : `${Math.round(x * 100)}%`.padStart(4)
const short = s => (s.length > 70 ? s.slice(0, 69) + '…' : s)

for (const [labelKey, f] of FILTERS) {
  const rows = results
    .map(({ p, a }) => ({ p, s: score(f, a), y: !!p.labels[labelKey] }))
    .filter(r => r.s != null)
  const pos = rows.filter(r => r.y).length
  console.log(`## ${f.label}  (${rows.length} posts judged, ${pos} labeled yes)`)
  if (!rows.length) { console.log('  no applicable posts\n'); continue }

  console.log('  strictness   hidden  wrongly-hidden  dimmed  wrongly-dimmed  missed  recall')
  for (const [name, [hide, dim]] of Object.entries(STRICTNESS)) {
    const H = rows.filter(r => r.s >= hide), D = rows.filter(r => r.s >= dim && r.s < hide)
    const missed = rows.filter(r => r.y && r.s < dim).length
    console.log(`  ${name.padEnd(11)} ${String(H.length).padStart(6)} ${String(H.filter(r => !r.y).length).padStart(15)} ${String(D.length).padStart(7)} ${String(D.filter(r => !r.y).length).padStart(15)} ${String(missed).padStart(7)}  ${pct((pos - missed) / pos)}`)
  }

  // Lowest cut-off whose flagged set (3+ posts) is at least 90% (hide) / 75% (dim) correct.
  const cut = target => [...new Set(rows.map(r => r.s))].sort((a, b) => a - b).find(t => {
    const f = rows.filter(r => r.s >= t)
    return f.length >= 3 && f.filter(r => r.y).length / f.length >= target
  })
  const show = t => t == null ? 'n/a' : `${t.toFixed(2)} (catches ${pct(rows.filter(r => r.y && r.s >= t).length / pos).trim()})`
  console.log(`  suggested: hide ≥ ${show(cut(0.9))}, dim ≥ ${show(cut(0.75))}`)

  const [, dim] = STRICTNESS.balanced
  const bad = [
    ...rows.filter(r => !r.y && r.s >= dim).sort((a, b) => b.s - a.s).map(r => `  ✗ flagged ${r.s.toFixed(2)}  ${short(r.p.title)}  [${r.p.subreddit}]`),
    ...rows.filter(r => r.y && r.s < dim).sort((a, b) => a.s - b.s).map(r => `  ○ missed  ${r.s.toFixed(2)}  ${short(r.p.title)}  [${r.p.subreddit}]`),
  ]
  if (bad.length) console.log('  errors at balanced:\n' + bad.slice(0, 12).join('\n'))
  console.log()
}
