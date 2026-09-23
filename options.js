import { labelOf, topicId } from './lib.js'
import { loadSettings } from './settings.js'

const $ = s => document.querySelector(s)
const s = await loadSettings()
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

// Topic: same switch row, plus × to remove it.
function topicRow(f) {
  const li = clone('#topicRow')
  const box = li.querySelector('input')
  box.checked = f.on
  box.onchange = () => toggle(f, box.checked)
  li.querySelector('span').textContent = f.label
  const rm = li.querySelector('.rm')
  rm.setAttribute('aria-label', `Remove ${f.label}`)
  rm.onclick = () => setFilters(fs => fs.filter(x => x.id !== f.id))
  return li
}

function render() {
  $('#filters').replaceChildren(...s.filters.filter(f => !f.site && !isTopic(f)).map(row))
  const topics = s.filters.filter(isTopic)
  $('#topics').replaceChildren(...topics.map(topicRow))
  $('#topicsEmpty').hidden = topics.length > 0
  $('#linkedin').replaceChildren(...s.filters.filter(f => f.site === 'linkedin').map(row))
  $(`[name=strictness][value=${s.strictness}]`).checked = true
  $(`[name=matched][value=${s.matched}]`).checked = true
  $('#matchedNote').textContent = s.matched === 'remove'
    ? 'Matched posts disappear. Posts Feed Control is unsure about are left alone.'
    : 'Matched posts collapse behind a label; click Show to see them. Posts Feed Control is unsure about are left alone.'
}

// Only real problems show here (e.g. budget used up); there's nothing to set up.
function showStatus(error) {
  $('#warn').textContent = error ?? ''
  $('#warn').hidden = !error
}

$('#add').onsubmit = e => {
  e.preventDefault()
  const label = e.target.topic.value.trim().replace(/\s+/g, ' ')
  const id = topicId(label)
  if (/[\p{L}\p{N}]/u.test(label) && !s.filters.some(f => f.id === id)) setFilters(fs => [...fs, { id, label, on: true }])
  e.target.reset()
}

$('#strictness').onchange = e => save({ strictness: e.target.value })
$('#matched').onchange = e => save({ matched: e.target.value })

showStatus(lastError)
render()
