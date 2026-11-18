# Ascend

A private life-coaching loop: adaptive check-ins, statistics-first insights, goals with SMART actions, and layered memory.

Each signed-in account only sees its own data. Sign up or sign in at `/login` (email and password). On Cursor’s private host you are already signed in with Cursor.

Insights are computed in code, then narrated. If `ANTHROPIC_API_KEY` is unset, narration uses deterministic templates that still pass the number validator.

## Run locally

```bash
npm ci
npm test
npm run dev
```

Open http://127.0.0.1:3000/login to create an account. `/api/state` is private per account.

## GitHub

- **CI** runs tests, typecheck and build on every pull request.
- **GitHub Pages** publishes the static landing in `github-pages/` (Pages cannot host the Next.js API). Enable Pages: Settings → Pages → Source: GitHub Actions.
- **GHCR** publishes `ghcr.io/<owner>/ascend` from `main`. Run with `docker run -p 3000:3000 -e DATABASE_URL=... ghcr.io/<owner>/ascend`.

The live hosted app is at https://ascend.apps.grok.bot.
