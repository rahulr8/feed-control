import { PROVIDERS, labelOf, topicId } from './lib.js'
import { loadSettings } from './settings.js'

const $ = s => document.querySelector(s)
const s = await loadSettings()
let { keys } = s
const { lastError } = await chrome.storage.session.get('lastError')

const save = patch => { Object.assign(s, patch); chrome.storage.sync.set(patch); render() }
const setFilters = fn => save({ filters: fn(s.filters) })

const clone = id => $(id).content.firstElementChild.cloneNode(true)
const toggle = (f, on) => setFilters(fs => fs.map(x => x.id === f.id ? { ...x, on } : x))
const isTopic = f => f.id.startsWith('topic-')

// Built-in filter: label + switch.
function row(f) {
  const li = clone('#row')
  const box = li.querySelector('input')
  box.checked = f.on
  box.onchange = () => toggle(f, box.checked)
  li.querySelector('span').textContent = labelOf(f)
  return li
}

// Topic: a chip; click toggles it on/off, × removes it.
function chip(f) {
  const li = clone('#chip')
  const [btn, rm] = li.querySelectorAll('button')
  li.classList.toggle('off', !f.on)
  btn.textContent = f.label
  btn.title = f.on ? 'Click to pause this topic' : 'Paused: click to resume'
  btn.setAttribute('aria-pressed', f.on)
  btn.onclick = () => toggle(f, !f.on)
  rm.setAttribute('aria-label', `Remove ${f.label}`)
  rm.onclick = () => setFilters(fs => fs.filter(x => x.id !== f.id))
  return li
}

function render() {
  $('#filters').replaceChildren(...s.filters.filter(f => !f.site && !isTopic(f)).map(row))
  $('#topics').replaceChildren(...s.filters.filter(isTopic).map(chip))
  $('#linkedin').replaceChildren(...s.filters.filter(f => f.site === 'linkedin').map(row))
  $(`[name=strictness][value=${s.strictness}]`).checked = true
  $(`[name=matched][value=${s.matched}]`).checked = true
  $('#matchedNote').textContent = s.matched === 'remove'
    ? 'Matched posts disappear. Posts Feed Control is unsure about are left alone.'
    : 'Matched posts collapse behind a label; click Show to see them. Posts Feed Control is unsure about are left alone.'
}

function showStatus(error) {
  const missing = !PROVIDERS[s.provider].shared && !keys[s.provider]
  const msg = missing ? `Add ${a(PROVIDERS[s.provider].label)} API key to start →` : error
  $('#warn').textContent = msg ?? ''
  $('#warn').hidden = !msg
  $('#warn').classList.toggle('action', missing)
  $('#warn').tabIndex = missing ? 0 : -1
}

// The "add a key" banner jumps straight to the key field.
$('#warn').onclick = () => {
  if (!$('#warn').classList.contains('action')) return
  $('#api').open = true
  form.key.focus()
}
$('#warn').onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), $('#warn').click())

$('#add').onsubmit = e => {
  e.preventDefault()
  const label = e.target.topic.value.trim().replace(/\s+/g, ' ')
  const id = topicId(label)
  if (/[\p{L}\p{N}]/u.test(label) && !s.filters.some(f => f.id === id)) setFilters(fs => [...fs, { id, label, on: true }])
  e.target.reset()
}

$('#strictness').onchange = e => save({ strictness: e.target.value })
$('#matched').onchange = e => save({ matched: e.target.value })

const a = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w

// Explicit Save: popups close without firing `change`, and permissions.request needs a click.
// Picking a provider only updates the form; Save commits it.
const form = $('#apiForm')
function showProvider(p) {
  const { label, keyUrl, shared } = PROVIDERS[p]
  form.provider.value = p
  $('#freeNote').hidden = !shared
  $('#keyRow').hidden = shared
  form.key.disabled = shared
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
  if (!PROVIDERS[provider].shared) keys = { ...keys, [provider]: form.key.value.trim() }
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
$('#api').open = !PROVIDERS[s.provider].shared && !keys[s.provider]
showStatus(lastError)
render()
