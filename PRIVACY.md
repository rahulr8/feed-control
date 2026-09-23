# Feed Control privacy policy

_Last updated: 2026-09-22_

Feed Control is a browser extension that hides posts you don't want to see on Reddit, X and LinkedIn. This page explains exactly what data it handles.

## What leaves your browser

To decide whether a post matches your filters, Feed Control sends the text of posts you scroll past to its server (`feed-control-api.vercel.app`, hosted on Vercel). The server passes it to an AI model (TypeSafe's Jev, via OpenRouter) and returns the result. The server does not store or log post text. Vercel's standard request logs (such as IP address, time, and path, but not request bodies) may be kept briefly for operations and abuse prevention.

For each post that is:

- **Reddit:** title, body text (first 1,500 characters), subreddit, flair, link domain
- **X:** author handle, tweet text, quoted tweet text, link-preview text
- **LinkedIn:** author name, post text

Only posts near your screen are sent, and each is sent at most once per browser session. Your filter questions (built-in filters and the topics you type) are sent with them. Promoted posts, and LinkedIn's suggested posts, activity posts, recommendation modules and sidebar, are detected from the page itself and are **not** sent anywhere.

OpenRouter's and TypeSafe's privacy policies govern how the model provider handles requests:
- OpenRouter: https://openrouter.ai/privacy
- TypeSafe: https://docs.typesafe.ai/legal

## What stays on your device

- **Classification results** are cached in session storage and cleared when you close the browser.

## What is synced

Your settings (which filters are on, your topics, strictness) use Chrome's built-in extension sync. If you're signed into Chrome with sync on, Google stores them with your other Chrome data.

## What Feed Control does not do

- No analytics, tracking, or telemetry.
- Its only server is the one described above, which relays requests and keeps nothing. No account is needed.
- It does not read or send your messages, profile, browsing history, or anything outside the Reddit, X and LinkedIn feeds.
- It does not sell or share data with anyone.

## Contact

Questions: open an issue at https://github.com/rahulr8/feed-control/issues
