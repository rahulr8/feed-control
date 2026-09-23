import assert from 'node:assert/strict'
import { DEFAULTS, applies, classify, labelOf, questionsFor, score, verdict, topicId } from './lib.js'

const sports = { id: topicId('Sports'), label: 'Sports', on: true }
const filters = [...DEFAULTS.filters, sports]
const qs = questionsFor(filters)

assert.equal(qs['topic-sports.match'].type, 'noul')
assert.ok(!Object.keys(qs).some(q => q.startsWith('promoted.')), 'promoted is code-only, never asks Jev')

const all = v => Object.fromEntries(Object.keys(qs).map(q => [q, v]))
assert.equal(verdict(all(0.1), filters), null)
assert.equal(verdict({ ...all(0.1), 'topic-sports.match': 0.9 }, filters).label, 'About Sports')
assert.equal(verdict({ ...all(0.1), 'topic-sports.match': 0.6 }, filters).label, 'Possibly about Sports')
assert.equal(verdict({ ...all(0.1), 'slop.style': 1, 'slop.no_specifics': 1, 'slop.bait': 1 }, filters).label, 'Likely AI slop')
assert.equal(verdict({ ...all(0.1), 'topic-sports.match': 0.6 }, filters).tier, 'dim')
assert.equal(verdict({ ...all(0.1), 'topic-sports.match': 0.6 }, filters, 'relaxed'), null)
assert.equal(verdict({ ...all(0.9), 'topic-sports.match': 0.1 }, filters.map(f => ({ ...f, on: false }))), null)
assert.equal(verdict({ 'slop.style': 0.9 }, filters), null, 'partial answers never trigger')

// Stealth is gated on `promotes`: open ads still hide, CTAs/disguise alone never do.
const stealth = { id: 'stealth' }
const ad = (promotes, disguised, cta) => score(stealth, { 'stealth.promotes': promotes, 'stealth.disguised': disguised, 'stealth.cta': cta })
assert.ok(ad(0.95, 0.1, 0.1) >= 0.75, 'blatant ad hides at balanced')
assert.equal(ad(0.05, 0.9, 0.9) < 0.1, true, 'CTA without a product is not an ad')
assert.ok(ad(0.9, 0.9, 0.1) > ad(0.9, 0.1, 0.1), 'disguise raises the score')

// Slop only judged on posts with real body text.
assert.equal(applies({ id: 'slop' }, { body: 'short' }), false)
assert.equal(applies({ id: 'slop' }, { body: 'x'.repeat(200) }), true)
assert.equal(applies({ id: 'topic-x' }, { body: '' }), true)
assert.equal(applies({ id: 'slop' }, { body: 'x'.repeat(80) }, 'x'), true, 'tweets have a lower bar')
assert.equal(applies({ id: 'slop' }, { body: 'x'.repeat(80) }, 'reddit'), false)

assert.equal(labelOf({ id: 'stealth', label: 'Stealth ad' }), 'Ads & self-promo', 'built-in renames reach saved filters')

assert.equal(topicId('US  Politics!'), 'topic-us-politics-')
assert.equal(topicId('Fußball'), 'topic-fußball')

// classify(): the shared pipeline
const settings = { filters, strictness: 'balanced' }
const post = { title: 'Lakers win', body: '' }
let calls = []
const ask = async (_, q) => { calls.push(Object.keys(q)); return Object.fromEntries(Object.keys(q).map(k => [k, k === 'topic-sports.match' ? 0.9 : 0.1])) }

let r = await classify({ site: 'reddit', promoted: true, post }, settings, { ask })
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

console.log('ok')
