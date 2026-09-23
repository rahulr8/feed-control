# Feed Control privacy policy

_Last updated: 2026-09-22_

Feed Control is a browser extension that hides posts you don't want to see on Reddit, X and LinkedIn. This page explains exactly what data it handles.

## What leaves your browser

To decide whether a post matches your filters, Feed Control sends the text of posts you scroll past to the AI provider **you choose** in the extension's settings: OpenRouter, TypeSafe, or a custom endpoint you enter. For each post that is:

- **Reddit:** title, body text (first 1,500 characters), subreddit, flair, link domain
- **X:** author handle, tweet text, quoted tweet text, link-preview text
- **LinkedIn:** author name, post text

Only posts near your screen are sent, and each is sent at most once per browser session. Your filter questions (built-in filters and the topics you type) are sent with them. Promoted posts, and LinkedIn's suggested posts, activity posts, recommendation modules and sidebar, are detected from the page itself and are **not** sent anywhere.

The provider's own privacy policy governs what it does with that data:
- OpenRouter: https://openrouter.ai/privacy
- TypeSafe: https://docs.typesafe.ai/legal

## What stays on your device

- **Your API key** is stored in your browser's local extension storage. It is never synced and never sent anywhere except to the provider you chose, as the request's authorization header.
- **Classification results** are cached in session storage and cleared when you close the browser.

## What is synced

Your settings (which filters are on, your topics, strictness, and the provider you picked, but not your key) use Chrome's built-in extension sync. If you're signed into Chrome with sync on, Google stores them with your other Chrome data.

## What Feed Control does not do

- No analytics, tracking, or telemetry.
- No servers of its own: the extension talks only to the provider you chose.
- It does not read or send your messages, profile, browsing history, or anything outside the Reddit, X and LinkedIn feeds.
- It does not sell or share data with anyone.

## Contact

Questions: open an issue at https://github.com/rahulr8/feed-control/issues
