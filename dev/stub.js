// Dev-only fake `chrome` API so the UI can be previewed without an API key or reddit.com.
import { DEFAULTS, classify, pageFilters, topicId, withBuiltins } from '../lib.js'

const store = {
  sync: { filters: [...DEFAULTS.filters, ...['Sports', 'Trump', 'influencers', 'claude code'].map(label => ({ id: topicId(label), label, on: label !== 'influencers' }))] },
  local: {},
  session: {},
}
const listeners = []
const area = n => ({
  get: async k => k == null ? { ...store[n] } : k in store[n] ? { [k]: store[n][k] } : {},
  set: async o => { Object.assign(store[n], o); listeners.forEach(fn => fn(o, n)) },
})

// Canned Jev answers per post id; everything unlisted answers 0.1.
const CANNED = {
  t3_slop: { 'slop.style': 0.95, 'slop.no_specifics': 0.85, 'slop.bait': 0.9 },
  t3_stealth: { 'stealth.promotes': 0.75, 'stealth.disguised': 0.8, 'stealth.cta': 0.3 },
  t3_sports: { 'topic-sports.match': 0.97 },
  t3_ok2: { 'topic-castles.match': 0.9 },
  // LinkedIn fixture (dev/linkedin.html)
  'urn:li:activity:7002': { 'slop.style': 0.95, 'slop.no_specifics': 0.9, 'slop.bait': 0.95 },
  // X fixture (dev/x.html)
  1002: { 'slop.style': 0.9, 'slop.no_specifics': 0.9, 'slop.bait': 0.8 },
  1003: { 'topic-sports.match': 0.95 },
  1005: { 'topic-sports.match': 0.99 },
}

window.chrome = {
  storage: { sync: area('sync'), local: area('local'), session: area('session'), onChanged: { addListener: fn => listeners.push(fn) } },
  permissions: { request: async () => true },
  runtime: {
    // Same pipeline as background.js; only the transport is canned.
    sendMessage: async msg => {
      const ask = async (post, qs) => Object.fromEntries(Object.keys(qs).map(q => [q, CANNED[msg.id]?.[q] ?? 0.1]))
      const settings = { filters: withBuiltins(store.sync.filters), strictness: 'balanced', matched: store.sync.matched ?? 'blur' }
      if (msg.page) return pageFilters(settings, msg.site)
      return (await classify(msg, settings, { ask })).verdict
    },
  },
}
