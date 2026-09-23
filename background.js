import { askJev, classify } from './lib.js'
import { loadSettings } from './settings.js'

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // Plain tab, not openOptionsPage(): Arc and some Chromium forks reject that call.
  if (reason === 'install') chrome.tabs.create({ url: 'options.html' })
  if (reason !== 'install' && reason !== 'update') return
  // Install/update orphans scripts in already-open Reddit/X tabs; attach fresh ones.
  const { content_scripts: [cs] } = chrome.runtime.getManifest()
  for (const tab of await chrome.tabs.query({ url: cs.matches })) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: cs.js }).catch(() => {})
  }
})

chrome.runtime.onMessage.addListener((msg, _, reply) => {
  serial(`${msg.site}:${msg.id}`, () => handle(msg)).then(reply, e => {
    chrome.storage.session.set({ lastError: e.message })
    reply({ error: e.message })
  })
  return true
})

// One classification per post at a time, so a repeat call hits the cache instead of the API.
const queues = new Map()
function serial(id, fn) {
  const p = (queues.get(id) ?? Promise.resolve()).then(fn, fn)
  queues.set(id, p)
  p.finally(() => queues.get(id) === p && queues.delete(id))
  return p
}

// Raw answers cached per post in session storage.
// ponytail: 10MB, cleared on browser restart; wiped if it ever fills.
async function handle(msg) {
  const s = await loadSettings()
  const key = `a:${msg.site}:${msg.id}`
  const cached = (await chrome.storage.session.get(key))[key]
  const ask = s.apiKey && ((post, qs) => askJev({ apiKey: s.apiKey, baseUrl: s.endpoint }, post, qs))
  const { verdict, answers, asked } = await classify(msg, s, { answers: cached, ask })
  if (asked) await chrome.storage.session.set({ [key]: answers, lastError: '' }).catch(() => chrome.storage.session.clear())
  console.log('[feed-control]', msg.site, msg.post.title || msg.post.body.slice(0, 80), answers, verdict)
  return verdict
}
