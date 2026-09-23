# Chrome Web Store listing: copy-paste answers

Upload: `npm run zip` → `feed-control.zip`. Images: `store/screenshot-*.png` (1280×800), `store/promo-tile.png` (440×280), `icons/128.png`.

## Store listing tab

**Name:** Feed Control

**Summary** (≤132 chars):
> Hide AI slop, ads & any topic you choose on Reddit, X and LinkedIn. Blurred behind a label, one click to show.

**Category:** Productivity · **Language:** English

**Description:**
> Take back your feed. Feed Control hides the posts you don't want to see on Reddit, X (Twitter) and LinkedIn: blurred behind a small label (one click to show) or removed entirely.
>
> WHAT IT HIDES
> • AI slop: formulaic, low-information, chatbot-written posts
> • Ads & self-promo: promoted posts, undisclosed advertising, "DM me for the link" pitches
> • Any topic you type: "politics", "crypto", "Trump", "sports", "AI-related"… in plain words
> • On LinkedIn: suggested posts, jobs & people recommendations, sidebar news and Premium upsells, and (optionally) posts shown because someone in your network liked them
>
> WHEN UNSURE, IT DOES NOTHING
> Posts are only hidden when the model is confident. Choose Relaxed, Balanced or Strict to decide how confident.
>
> HOW IT WORKS
> Posts are classified by Jev, TypeSafe's fast decision model, through your own OpenRouter or TypeSafe API key. It costs about 3 cents per thousand posts. Promoted posts and LinkedIn modules are detected from the page itself, with no API call.
>
> PRIVATE BY DESIGN
> No account, no servers, no tracking. Your API key stays on your device. Post text goes only to the provider you choose. Open source: https://github.com/rahulr8/feed-control
>
> SETUP (1 minute)
> 1. Get an API key at https://openrouter.ai/settings/keys
> 2. Click the Feed Control icon → API → paste the key → Save
> 3. Browse Reddit, X or LinkedIn as usual

## Privacy practices tab

**Single purpose:**
> Hide unwanted posts (AI-generated filler, advertising, and user-chosen topics) from Reddit, X and LinkedIn feeds.

**Permission justifications:**
- **storage:** Saves the user's filter settings, topics and API key, and caches classification results for the session.
- **scripting:** After the extension is installed or updated, re-attaches its content script to Reddit/X/LinkedIn tabs that were already open, so filtering works without reloading them.
- **Host permission: reddit.com, x.com, twitter.com, linkedin.com:** Reads post text in the feed and hides matching posts. These are the only sites the extension runs on.
- **Host permission: openrouter.ai, api.typesafe.ai:** Sends post text to the user's chosen AI provider to classify it.
- **Optional host permission (https://\*/\*):** Only requested, with a browser prompt, if the user enters a custom API endpoint (e.g. their company's proxy); limited to that one origin.

**Remote code:** No, I am not using remote code.

**Data usage:** tick **Website content** (post text is sent to the user's chosen AI provider to classify it). Certify all three: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

**Privacy policy URL:** https://github.com/rahulr8/feed-control/blob/main/PRIVACY.md

## Distribution tab

**Visibility:** Unlisted (share the store link with friends), or Public later.
