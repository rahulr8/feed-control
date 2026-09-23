// Pulls real Reddit posts into eval/posts.json, in the same shape content.js sends.
// Re-running adds new posts and keeps existing labels. Usage: node eval/fetch.js
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const OUT = new URL('posts.json', import.meta.url)
const PER_SOURCE = 10
const SOURCES = [
  'feeds/popular-feed?sort=hot',
  ...['SaaS', 'Entrepreneur', 'sidehustle', 'ChatGPT', 'productivity', 'politics',
    'technology', 'aww', 'dogs', 'AskReddit', 'personalfinance', 'LocalLLaMA']
    .map(name => `community-more-posts/hot/?name=${name}`),
]
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

const decode = s => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const text = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const attr = (tag, name) => decode(tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? '')

// ponytail: regex over server-rendered HTML; breaks if Reddit changes markup, fine for a dev tool.
function parse(html) {
  return [...html.matchAll(/<shreddit-post\s[^>]*>/g)].map(({ 0: tag, index }) => {
    const id = attr(tag, 'id')
    const rest = html.slice(index, html.indexOf('</shreddit-post>', index))
    const body = rest.match(new RegExp(`id="${id}-post-rtjson-content"[^>]*>([\\s\\S]*?)</div>`))?.[1] ?? ''
    const flair = rest.match(/<shreddit-post-flair[^>]*>([\s\S]*?)<\/shreddit-post-flair>/)?.[1] ?? ''
    return {
      id,
      title: attr(tag, 'post-title'),
      body: text(body).slice(0, 1500),
      subreddit: attr(tag, 'subreddit-prefixed-name'),
      flair: text(flair),
      link_domain: attr(tag, 'domain'),
    }
  }).filter(p => p.id && p.title)
}

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT)) : []
const byId = new Map(existing.map(p => [p.id, p]))

for (const src of SOURCES) {
  const res = await fetch(`https://www.reddit.com/svc/shreddit/${src}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) { console.warn(`skip ${src}: ${res.status}`); continue }
  const posts = parse(await res.text()).filter(p => !byId.has(p.id)).slice(0, PER_SOURCE)
  for (const p of posts) byId.set(p.id, { ...p, labels: null })
  console.log(`${src}: +${posts.length}`)
}

writeFileSync(OUT, JSON.stringify([...byId.values()], null, 2))
console.log(`${byId.size} posts in eval/posts.json`)
