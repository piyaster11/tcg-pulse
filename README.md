# Piyaster TCG Pulse

A TCG-styled dashboard for **Pokémon**, **One Piece Card Game**, **Magic: The Gathering**, **Disney Lorcana**, and **Yu-Gi-Oh!** — same general template as the [Piyaster market dashboard](https://piyaster11.github.io/piyaster-market-dashboard/): highlights at the top, a Fear & Greed gauge, per-game cards, and sourced numbers that are never invented.

**Live:** https://piyaster11.github.io/tcg-pulse/

## What’s real vs a proxy

- **Headlines** — public Google News RSS plus official/sourced articles (Konami, Wizards, GempireCards, TCG Meta, PokeWallet, **SNKRDUNK (JP)**, etc.), with links. Japanese SNKRDUNK titles are translated into English.
- **Category price momentum** — GempireCards November 2026 market snapshot (published 14 Nov 2026): Yu-Gi-Oh! +16%, MTG +1%, One Piece −3%, Lorcana −4%, Pokémon −8% over the past month.
- **Live MTG singles** — Scryfall USD for the Star Trek set, fetched with the snapshot.
- **Dated chase / sealed prices** — cited to PokeWallet, DexHaul, Kontora, TCG Meta, with the date of the read.
- **Search interest** — **Google Trends** (worldwide, last ~90 days, five queries compared on one 0–100 scale — not absolute search volume). The chart defaults to Trends. English Wikipedia daily pageviews stay available as a labeled fallback via a Wiki Views toggle (those lines are indexed to each game’s own 90-day peak).
- **Sentiment** — a simple headline lexicon (positive/negative word counts, shrunk toward 50 when there are few hits). Explained in the on-page tooltip. Not a neural model, not Reddit/X scoring.
- **Fear & Greed** — computed, never invented. Equal-weight average of the five game scores. Each game: trend momentum 30% (7-day vs 30-day average of the Google Trends series), headline sentiment 25%, 14-day news volume 20%, monthly category price momentum 25%.

## Repo layout

The GitHub Pages site is served from `docs/` on `main`.

```
docs/index.html          # page
docs/styles.css
docs/app.js
docs/data/dashboard.json # snapshot the page loads
scripts/fetch_data.py    # rebuilds the JSON (wiki, news, Scryfall, index)
```

A weekly GitHub Action can refresh `docs/data/dashboard.json`. Curated dated prices stay until they are edited, and keep their source dates.

This repo does not modify the market dashboard or the NVIDIA Erection Index.

## Theme

Dark foil card-frame layout. Inter for body and data; Cinzel only on the main wordmark.
