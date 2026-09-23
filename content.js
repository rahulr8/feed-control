// Scoped so a re-injection after an extension update can't collide with the orphaned copy.
(() => {
  const text = el => el?.textContent.replace(/\s+/g, ' ').trim() ?? ''
  // Bodies keep their line structure (lists, short punchy lines): slop cues live there.
  const tidy = s => s.replace(/[ \t]+/g, ' ').replace(/ *\n[\n ]*/g, '\n').trim()
  const lines = el => el ? tidy(el.innerText) : ''
  // Emoji are <img alt> on X; keep them, they're a slop signal.
  const richText = el => {
    if (!el) return ''
    const out = []
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) out.push(n.nodeValue)
      else if (n.localName === 'img') out.push(n.alt)
    }
    return tidy(out.join(''))
  }

  const LI_ITEM = '[componentkey="container-update-list_mainFeed-lazy-container"] > div[data-lazy-mount-id] > div[data-display-contents="true"] > div'
  const LI_BODY = '[data-testid="expandable-text-box"], [data-view-name="feed-commentary"], .update-components-text'
  // Why LinkedIn shows a post ("Suggested", "Jane likes this"): the header, or failing that the text above the body.
  const liHeader = el => {
    const h = text(el.querySelector('[data-view-name="feed-header-text"]'))
    if (h) return h
    const all = text(el), body = text(el.querySelector(LI_BODY))
    return (body ? all.slice(0, Math.max(0, all.indexOf(body.slice(0, 40)))) : all).slice(0, 200)
  }

  // Per-site DOM knowledge. Everything else (classification, UI) is shared.
  const SITES = {
    reddit: {
      sel: 'shreddit-post, shreddit-ad-post',
      id: el => el.id || el.getAttribute('post-id'),
      host: el => el.closest('article') ?? el.parentElement,
      // Never hide the post the user deliberately opened.
      eligible: el => el.getAttribute('view-context') !== 'CommentsPage',
      facts: el => el.localName === 'shreddit-ad-post' ? ['promoted'] : [],
      read: el => ({
        title: el.getAttribute('post-title') ?? '',
        body: lines(el.querySelector('[slot="text-body"]')).slice(0, 1500),
        subreddit: el.getAttribute('subreddit-prefixed-name') ?? '',
        flair: text(el.querySelector('shreddit-post-flair')),
        link_domain: el.getAttribute('domain') ?? '',
      }),
    },
    // X: React app, only data-testid attributes are stable (selectors as in insin/control-panel-for-twitter).
    x: {
      sel: 'article[data-testid="tweet"]',
      id: el => el.querySelector('a[href*="/status/"] time')?.closest('a').pathname.match(/status\/(\d+)/)?.[1],
      host: el => el.closest('[data-testid="cellInnerDiv"]') ?? el.parentElement,
      // The tweet opened on its own page has tabIndex -1; replies below it are fair game.
      eligible: el => el.tabIndex !== -1,
      facts: el => el.closest('[data-testid="placementTracking"]') ? ['promoted'] : [],
      read: el => {
        // ponytail: quoted tweet = tweetText inside a nested role=link card; revisit if X changes quote markup.
        const texts = [...el.querySelectorAll('[data-testid="tweetText"]')]
        const main = texts.find(t => !t.closest('div[role="link"]'))
        const quoted = texts.find(t => t !== main)
        return {
          author: '@' + (el.querySelector('[data-testid="User-Name"] a')?.pathname.slice(1) ?? ''),
          body: richText(main).slice(0, 1500),
          ...(quoted && { quoted: richText(quoted).slice(0, 500) }),
          ...(el.querySelector('[data-testid="card.wrapper"]') && { link_card: text(el.querySelector('[data-testid="card.wrapper"]')).slice(0, 200) }),
        }
      },
    },
    // LinkedIn: hashed classes, no data-urn; only componentkey / data-view-name / data-testid are stable.
    // Selectors as verified live by LinkOff (2026-09-18) and Slop Mop (2026-09-18); legacy ones kept as fallbacks.
    // ponytail: module/header detection matches English copy only.
    linkedin: {
      // Every feed item, including non-post modules like "Jobs recommended for you".
      sel: `${LI_ITEM}, [role="listitem"][componentkey^="update-card"], div[data-urn^="urn:li:activity:"]`,
      id: el => {
        const key = (el.matches('[componentkey^="update-card"]') ? el : el.querySelector('[componentkey^="update-card"]'))?.getAttribute('componentkey')
        // Posts render up to 3x (base + "expanded…FeedType_…" variants): normalise to the base id.
        return key?.replace(/^update-card(-focus)?/, '').replace(/^expanded/, '').replace(/FeedType_.*$/, '')
          ?? el.getAttribute('data-urn') ?? el.parentElement?.parentElement?.getAttribute('data-lazy-mount-id')
      },
      host: el => el,
      // Skip a permalink page (you opened that post) and post roots nested in a feed item we already handle.
      eligible: el => !location.pathname.startsWith('/feed/update/') && !el.parentElement?.closest(LI_ITEM),
      facts: el => {
        const header = liHeader(el), isPost = !!el.querySelector(LI_BODY)
        const out = []
        const ad = [...el.querySelectorAll('[aria-label]')].some(n => /\b(sponsored|promoted)\b/i.test(n.getAttribute('aria-label')))
          || [...el.querySelectorAll('span, p, a')].some(n => /^\s*(promoted|sponsored)\s*$/i.test(n.childElementCount ? '' : n.textContent))
        if (ad) out.push('promoted')
        if (/^\s*suggested\b/i.test(header) || el.querySelector('[data-view-name*="suggest"]')) out.push('suggested')
        if (/\b(likes?|loves|celebrates|supports|finds this (insightful|funny)|is curious about|commented on|reposted) this\b/i.test(header)) out.push('activity')
        // Modules (no post text) only, so a post that says "…recommended for you" isn't caught.
        if (!isPost && /jobs recommended for you|recommended for you|people you may know|add to your feed/i.test(text(el).slice(0, 300))) out.push('recommendations')
        return out
      },
      read: el => {
        const author = text(el.querySelector('[data-view-name="feed-author-name"]'))
          || el.querySelector('[aria-label^="Open control menu for post by "]')?.getAttribute('aria-label').slice(30) || ''
        const box = el.querySelector(LI_BODY)
        return { author, body: box ? tidy(box.innerText.replace(/[\s…]*\bmore\s*$/i, '')).slice(0, 1500) : '' }
      },
    },
  }
  // FEED_CONTROL_SITE: dev fixtures only; real pages can't set it (content scripts run in an isolated world).
  const siteKey = globalThis.FEED_CONTROL_SITE
    ?? (/(^|\.)(x|twitter)\.com$/.test(location.hostname) ? 'x' : /(^|\.)linkedin\.com$/.test(location.hostname) ? 'linkedin' : 'reddit')
  const site = SITES[siteKey]

  const revealed = new Set()
  const verdicts = new Map() // id -> last verdict, re-applied instantly when X re-mounts a tweet
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c5 0 9 4.5 10 8a13 13 0 0 1-2.2 3.6M6.6 6.6A13 13 0 0 0 2 12c1 3.5 5 8 10 8a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20"/></svg>'

  let generation = 0 // bumped on settings change; responses from older settings are dropped
  async function classify(el) {
    const id = site.id(el), gen = generation
    try {
      const v = await chrome.runtime.sendMessage({ site: siteKey, id, facts: site.facts(el), post: site.read(el) })
      if (v?.error || gen !== generation || !el.isConnected || site.id(el) !== id || revealed.has(id)) return
      verdicts.set(id, v)
      apply(el, v)
    } catch {
      // Extension reloaded or updated; this tab's script is orphaned until refresh.
    }
  }

  const apply = (el, v) => v?.tier ? mark(el, v) : unmark(el)

  function mark(el, { label, score, tier }) {
    const host = site.host(el)
    unmark(el)
    host.dataset.feedControl = tier
    if (tier === 'remove') return

    const pill = document.createElement('button')
    pill.type = 'button'
    pill.className = 'feed-control-pill'
    pill.setAttribute('aria-label', `${label}. Show post`)
    if (score != null) pill.title = `${Math.round(score * 100)}% match · click to show`
    const chip = pill.appendChild(document.createElement('span'))
    if (tier === 'hide') chip.innerHTML = EYE_OFF
    chip.append(label)
    if (tier === 'hide') chip.appendChild(document.createElement('i')).textContent = 'Show'
    // Sites act on pointerdown/mousedown too (LinkedIn ad tracking, X navigation): keep all of them to ourselves.
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) pill.addEventListener(type, e => e.stopPropagation())
    pill.onclick = e => {
      e.preventDefault()
      e.stopPropagation()
      reveal(site.id(el))
    }
    host.prepend(pill)
    setInert(host, tier === 'hide')
  }

  // Reveal every rendering of the post: LinkedIn keeps up to 3 copies and swaps them on interaction,
  // so revealing only the clicked one made the post "disappear" behind a still-hidden copy.
  function reveal(id) {
    revealed.add(id)
    for (const e of document.querySelectorAll(site.sel)) {
      if (site.id(e) !== id) continue
      const host = site.host(e)
      if (!host.dataset.feedControl) continue
      host.dataset.feedControl = 'shown'
      host.querySelector(':scope > .feed-control-pill')?.remove()
      setInert(host, false)
    }
  }

  function unmark(el) {
    const host = site.host(el)
    if (host.dataset.feedControl !== 'shown') delete host.dataset.feedControl
    host.querySelector(':scope > .feed-control-pill')?.remove()
    setInert(host, false)
  }

  // Hidden content is out of the tab order; the pill stays reachable.
  const setInert = (host, on) => { for (const c of host.children) if (!c.classList.contains('feed-control-pill')) c.inert = on }

  // Only classify posts about to scroll into view.
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); classify(e.target) }
  }, { rootMargin: '600px 0px' })

  // A post nested inside another matched post is handled by its outer one (never marked twice).
  const eligible = el => site.id(el) && site.eligible(el) && !el.parentElement?.closest(site.sel)
  const seen = new WeakSet()
  const scan = () => document.querySelectorAll(site.sel).forEach(el => {
    if (seen.has(el) || !eligible(el)) return
    seen.add(el)
    const id = site.id(el)
    if (revealed.has(id)) return
    if (verdicts.has(id)) apply(el, verdicts.get(id))
    else io.observe(el)
  })

  // Page-level filters (e.g. LinkedIn sidebar clutter) are pure CSS keyed off an <html> attribute.
  const applyPage = () => chrome.runtime.sendMessage({ site: siteKey, page: true })
    .then(ids => { document.documentElement.dataset.feedControlPage = ids.join(' ') }).catch(() => {})
  applyPage()

  let queued = 0
  new MutationObserver(() => queued ||= requestAnimationFrame(() => { queued = 0; scan() }))
    .observe(document.body, { childList: true, subtree: true })
  scan()

  // Settings changed: re-check in place, no flicker (cached answers make this near-free
  // unless a new filter was added). Off-screen posts get re-checked when scrolled to.
  chrome.storage.onChanged.addListener((_, area) => {
    if (area === 'session') return
    applyPage()
    generation++
    verdicts.clear()
    document.querySelectorAll(site.sel).forEach(el => {
      if (!eligible(el) || revealed.has(site.id(el))) return
      // Removed posts have no box, so IntersectionObserver never reports them: re-check directly (cached, no API call).
      if (site.host(el).dataset.feedControl === 'remove') classify(el)
      else io.observe(el)
    })
  })
})()
