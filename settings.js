import { DEFAULTS, STRICTNESS, withBuiltins } from './lib.js'

// Settings for the background worker and the popup (Chrome sync storage).
export async function loadSettings() {
  const s = { ...DEFAULTS, ...(await chrome.storage.sync.get(null)) }
  s.filters = withBuiltins(s.filters)
  if (!(s.strictness in STRICTNESS)) s.strictness = DEFAULTS.strictness
  if (!['blur', 'remove'].includes(s.matched)) s.matched = DEFAULTS.matched
  return s
}
