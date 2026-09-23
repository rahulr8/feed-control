import { PROVIDERS, labelOf, topicId } from './lib.js'
import { loadSettings } from './settings.js'

const $ = s => document.querySelector(s)
const s = await loadSettings()
let { keys } = s
const { lastError } = await chrome.storage.session.get('lastError')

const save = patch => { Object.assign(s, patch); chrome.storage.sync.set(patch); render() }
const setFilters = fn => save({ filters: fn(s.filters) })

function render() {
  $('#filters').replaceChildren(...s.filters.map(f => {
    const li = $('#row').content.firstElementChild.cloneNode(true)
    const box = li.querySelector('input')
    box.checked = f.on
    box.onchange = () => setFilters(fs => fs.map(x => x.id === f.id ? { ...x, on: box.checked } : x))
    li.querySelector('span').textContent = labelOf(f)
    const rm = li.querySelector('.rm')
    if (f.id.startsWith('topic-')) {
      rm.setAttribute('aria-label', `Remove ${f.label}`)
      rm.onclick = () => setFilters(fs => fs.filter(x => x.id !== f.id))
    } else rm.remove()
    return li
  }))
  $(`[name=strictness][value=${s.strictness}]`).checked = true
}

function showStatus(error) {
  const msg = !keys[s.provider] ? `Add ${a(PROVIDERS[s.provider].label)} API key below to start filtering.` : error
  $('#warn').textContent = msg ?? ''
  $('#warn').hidden = !msg
}

$('#add').onsubmit = e => {
  e.preventDefault()
  const label = e.target.topic.value.trim().replace(/\s+/g, ' ')
  const id = topicId(label)
  if (/[\p{L}\p{N}]/u.test(label) && !s.filters.some(f => f.id === id)) setFilters(fs => [...fs, { id, label, on: true }])
  e.target.reset()
}

$('#strictness').onchange = e => save({ strictness: e.target.value })

const a = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w

// Explicit Save: popups close without firing `change`, and permissions.request needs a click.
// Picking a provider only updates the form; Save commits it.
const form = $('#apiForm')
function showProvider(p) {
  const { label, keyUrl } = PROVIDERS[p]
  form.provider.value = p
  form.key.value = keys[p] ?? ''
  $('#keyLabel').textContent = p === 'custom' ? 'API key' : `${label} API key`
  $('#keyLink').hidden = !keyUrl
  if (keyUrl) $('#keyLink').href = keyUrl
  $('#baseRow').hidden = p !== 'custom'
  form.base.disabled = p !== 'custom' // disabled fields skip validation
}
form.onchange = e => e.target.name === 'provider' && showProvider(e.target.value)
form.base.value = s.baseUrl
form.onsubmit = async e => {
  e.preventDefault()
  const provider = form.provider.value
  const baseUrl = provider === 'custom' ? form.base.value.trim().replace(/\/+$/, '') : s.baseUrl
  if (provider === 'custom' && !await chrome.permissions.request({ origins: [new URL(baseUrl).origin + '/*'] })) {
    return void ($('#saved').textContent = 'Permission denied')
  }
  keys = { ...keys, [provider]: form.key.value.trim() }
  await chrome.storage.session.set({ lastError: '' })
  await chrome.storage.local.set({ keys })
  save({ provider, baseUrl })
  $('#current').textContent = PROVIDERS[provider].label
  showStatus()
  $('#saved').textContent = 'Saved'
  setTimeout(() => $('#saved').textContent = '', 1500)
}

showProvider(s.provider)
$('#current').textContent = PROVIDERS[s.provider].label
$('#api').open = !keys[s.provider]
showStatus(lastError)
render()
