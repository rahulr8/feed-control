import assert from 'node:assert/strict'
import { invalid } from './api/v1/systemone.js'
import { DEFAULTS, questionsFor, topicId } from '../lib.js'

// A real extension request passes.
const filters = [...DEFAULTS.filters, ...Array.from({ length: 10 }, (_, i) => ({ id: topicId(`topic ${i}`), label: `topic ${i}`, on: true }))]
const questions = Object.fromEntries(Object.values(questionsFor(filters)).map((q, i) => [`q${i}`, q]))
const post = { title: 't', body: 'x'.repeat(1500), subreddit: 'r/x', flair: '', link_domain: '' }
assert.equal(invalid({ state: { post }, questions }), null, 'max-size extension request is valid')

// Anything else is refused.
assert.ok(invalid(null))
assert.ok(invalid({ state: { post }, questions: {} }), 'no questions')
assert.ok(invalid({ state: 'hi', questions }), 'state must carry a post')
assert.ok(invalid({ state: { post: { body: 'x'.repeat(9000) } }, questions }), 'oversized state')
assert.ok(invalid({ state: { post }, questions: { q0: { type: 'choice', instructions: 'x', criteria: { a: 1 } } } }), 'only nouls')
assert.ok(invalid({ state: { post }, questions: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`q${i}`, { type: 'noul', instructions: 'x' }])) }), 'too many questions')

console.log('ok')
