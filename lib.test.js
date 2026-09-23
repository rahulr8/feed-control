import assert from 'node:assert/strict'
import { DEFAULTS, FACTS, applies, classify, fingerprint, labelOf, pageFilters, questionsFor, score, verdict, topicId, withBuiltins } from './lib.js'

const sports = { id: topicId('Sports'), label: 'Sports', on: true }
const filters = [...DEFAULTS.filters, sports]
const qs = questionsFor(filters)

assert.equal(qs['topic-sports.match'].type, 'noul')
assert.ok(!Object.keys(qs).some(q => q.startsWith('promoted.')), 'promoted is code-only, never asks Jev')

const all = v => Object.fromEntries(Object.keys(qs).map(q => [q, v]))
assert.equal(verdict(all(0.1), filters), null)
assert.equal(verdict({ ...all(0.1), 'topic-sports.match': 0.9 }, filters).label, 'About Sports')
assert.equal(verdict({ ...all(0.1), 'slop.style': 1, 'slop.no_specifics': 1, 'slop.bait': 1 }, filters).label, 'Likely AI slop')
assert.equal(verdict({ ...all(0.1), 'topic-sports.match': 0.6 }, filters), null, 'unsure: left untouched')
assert.equal(verdict({ ...all(0.1), 'topic-sports.match': 0.6 }, filters, 'strict').tier, 'hide', 'strict acts on less certainty')
assert.equal(verdict({ ...all(0.1), 'topic-sports.match': 0.6 }, filters, 'relaxed'), null)
assert.equal(verdict({ ...all(0.9), 'topic-sports.match': 0.1 }, filters.map(f => ({ ...f, on: false }))), null)
assert.equal(verdict({ 'slop.style': 0.9 }, filters), null, 'partial answers never trigger')

// Ads: a pitch plus affiliation, disguise, or a sales ask. A happy customer's pitch alone never hides.
const stealth = { id: 'stealth' }
const ad = (promotes, affiliated, disguised, cta) => score(stealth, { 'stealth.promotes': promotes, 'stealth.affiliated': affiliated, 'stealth.disguised': disguised, 'stealth.cta': cta })
assert.ok(ad(0.95, 0.1, 0.1, 0.9) >= 0.75, 'pitch + sales ask hides at balanced')
assert.ok(ad(0.95, 0.9, 0.1, 0.1) >= 0.75, 'founder self-promo hides')
assert.ok(ad(0.95, 0.1, 0.1, 0.1) < 0.45, 'customer recommendation is not flagged, even at strict')
assert.ok(ad(0.05, 0.9, 0.9, 0.9) < 0.1, 'no pitch, no ad')

// Slop only judged on posts with real body text.
assert.equal(applies({ id: 'slop' }, { body: 'short' }), false)
assert.equal(applies({ id: 'slop' }, { body: 'x'.repeat(200) }), true)
assert.equal(applies({ id: 'topic-x' }, { body: '' }), true)
assert.equal(applies({ id: 'slop' }, { body: 'x'.repeat(80) }, 'x'), true, 'tweets have a lower bar')
assert.equal(applies({ id: 'slop' }, { body: 'x'.repeat(80) }, 'reddit'), false)

assert.equal(labelOf({ id: 'stealth', label: 'Stealth ad' }), 'Ads & self-promo', 'built-in renames reach saved filters')

assert.equal(topicId(' US  Politics '), 'topic-us politics')
assert.equal(topicId('Fußball'), 'topic-fußball')
assert.notEqual(topicId('C++'), topicId('C#'), 'punctuation is meaningful')

assert.equal(fingerprint({ a: 1 }), fingerprint({ a: 1 }))
assert.notEqual(fingerprint({ body: 'hi' }), fingerprint({ body: 'hi!' }), 'edited post = new cache entry')

// classify(): the shared pipeline
const settings = { filters, strictness: 'balanced' }
const post = { title: 'Lakers win', body: '' }
let calls = []
const ask = async (_, q) => { calls.push(Object.keys(q)); return Object.fromEntries(Object.keys(q).map(k => [k, k === 'topic-sports.match' ? 0.9 : 0.1])) }

let r = await classify({ site: 'reddit', facts: ['promoted'], post }, settings, { ask })
assert.equal(r.verdict.label, 'Promoted post'); assert.equal(calls.length, 0, 'ads never hit the API')

r = await classify({ site: 'reddit', post }, settings, { ask })
assert.equal(r.verdict.label, 'About Sports'); assert.ok(r.asked)
assert.ok(!calls[0].some(q => q.startsWith('slop.')), 'no slop questions for a bodiless post')

calls = []
r = await classify({ site: 'reddit', post }, settings, { answers: r.answers, ask })
assert.equal(calls.length, 0, 'fully cached: no request'); assert.equal(r.asked, false)

const withTopic = { ...settings, filters: [...filters, { id: topicId('Cats'), label: 'Cats', on: true }] }
r = await classify({ site: 'reddit', post }, withTopic, { answers: r.answers, ask })
assert.deepEqual(calls[0], ['topic-cats.match'], 'new topic asks only its own question')

r = await classify({ site: 'reddit', post }, withTopic, {})
assert.equal(r.verdict, null); assert.equal(r.asked, false, 'no key: nothing asked, nothing hidden')

// matched: 'remove' upgrades hides to removal; unsure posts stay untouched.
const sportsAsk = v => async (_, q) => Object.fromEntries(Object.keys(q).map(k => [k, k === 'topic-sports.match' ? v : 0.1]))
const removeMode = { filters, strictness: 'balanced', matched: 'remove' }
assert.equal((await classify({ site: 'reddit', post }, removeMode, { ask: sportsAsk(0.9) })).verdict.tier, 'remove')
assert.equal((await classify({ site: 'reddit', post }, removeMode, { ask: sportsAsk(0.6) })).verdict, null, 'unsure posts untouched in remove mode too')
assert.equal((await classify({ site: 'reddit', facts: ['promoted'], post }, removeMode)).verdict.tier, 'remove')
assert.equal((await classify({ site: 'reddit', post }, settings, { ask: sportsAsk(0.9) })).verdict.tier, 'hide', 'blur is the default')

// Fact filters (LinkedIn): decided by markup, never by Jev, and only on their own site.
calls = []
const li = (facts, p = post) => classify({ site: 'linkedin', facts, post: p }, settings, { ask })
assert.equal((await li(['suggested'])).verdict.label, 'Suggested post'); assert.equal(calls.length, 0)
assert.equal((await li(['activity'])).verdict.label, 'About Sports', 'activity filter is off by default, so the post goes to Jev as usual')
assert.equal((await li(['recommendations'], { body: '' })).verdict.label, 'LinkedIn recommendation', 'modules with no text still hide')
assert.equal((await classify({ site: 'reddit', facts: ['suggested'], post }, settings, { ask })).verdict.label, 'About Sports', 'LinkedIn-only filter ignored on Reddit')
calls = []
assert.equal((await li([], { body: '' })).verdict, null); assert.equal(calls.length, 0, 'nothing to judge: no API call')
assert.ok(FACTS.includes('promoted'))

// Page-level filters and built-in migration.
assert.deepEqual(pageFilters(settings, 'linkedin'), ['sidebar'])
assert.deepEqual(pageFilters(settings, 'reddit'), [])
const old = [{ id: 'promoted', label: 'Promoted', on: false }, { id: 'topic-x', label: 'x', on: true }]
const merged = withBuiltins(old)
assert.equal(merged[0].on, false, 'user choice kept'); assert.ok(merged.some(f => f.id === 'recommendations'), 'new built-in added')

console.log('ok')
