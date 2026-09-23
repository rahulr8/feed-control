import { DEFAULTS, PROVIDERS, STRICTNESS, baseUrlOf, withBuiltins } from './lib.js'

// Settings for the background worker and the popup. Keys (one per provider) live in local, never synced;
// everything else in sync. `baseUrl` stays the raw custom URL; `endpoint` is what requests go to.
export async function loadSettings() {
  const s = { ...DEFAULTS, ...(await chrome.storage.sync.get(null)) }
  s.filters = withBuiltins(s.filters)
  if (!(s.strictness in STRICTNESS)) s.strictness = DEFAULTS.strictness
  if (!['blur', 'remove'].includes(s.matched)) s.matched = DEFAULTS.matched
  if (!(s.provider in PROVIDERS)) s.provider = DEFAULTS.provider
  const { keys = {} } = await chrome.storage.local.get('keys')
  return { ...s, keys, apiKey: keys[s.provider], endpoint: baseUrlOf(s) }
}
