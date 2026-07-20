# Session handoff — project_origin cleanup

Picking this up on your home computer? Start with **"Next steps"** at the bottom — everything above is what's already done and why.

**Update:** after the section below was originally written, we pivoted the whole backend model — see item #9. The MongoDB/Railway concerns in the original "Next steps" are now moot; skip straight to the new "Next steps" list at the bottom.

## What was done, in order

All commits are on `master` in this repo (frontend repo, now the merged monorepo). Recent history, newest first:

```
4a72a78 Make the app fully local-first: SQLite instead of MongoDB Atlas
a83d478 Replace Gemini with Claude for scan and definition endpoints
a36b540 Add rate limiting to the backend
e250b34 Remove orphaned /api/chat endpoint and Anthropic dependency
f8f305e Clean up merged backend and add missing /api/definition route
66c0fe5 Merge project_origin_backend into backend/
14ad332 Remove 3D models and Sunny chat features
```

### 1. Removed the 3D models feature
Deleted `components/GlOverlay.tsx`, `objects/` (the .glb/.jpg assets), the folklore content/state in `app/(tabs)/index.tsx` and `components/TranslationOverlay.tsx`, and the `expo-gl`/`expo-three` dependencies.

### 2. Removed the Sunny chat feature
Deleted `components/SunnyChat.tsx`. `components/WelcomeOverlay.tsx` no longer opens a chat — the mini logo that appears after the welcome overlay dismisses is now purely decorative (per your call, kept as decoration rather than removed).

### 3. SRS ("spaced repetition") algorithm — reported, not touched
`services/srs.ts` is a correct SM-2 implementation but **dead code** — nothing in the app calls it, despite `services/README.md` claiming full integration. The *real* spaced-repetition bookkeeping lives server-side in `backend/server.js` (now SQLite, see #9 — `timesSeenCount` / `nextReview` per word), but the frontend never calls `/api/vocabulary/:userId` or `/api/review/:userId` to surface due words — so there's no review flow anywhere in the running app today. Left as-is per your call; worth deciding later whether to wire either path up or delete `services/srs.ts`.

### 4. Merged `project_origin_backend` into this repo as `backend/`
Used `git subtree add --prefix=backend` — the backend's original 15 commits are preserved in history (visible via `git log --graph --all -- backend/` or similar). The original `~/Desktop/projects/project_origin_backend` standalone repo was left untouched — nothing there was deleted or modified, so it's still there as a backup/reference if you ever want it, but the merged copy in `backend/` is now the one to develop on.

Also cleaned out two stray scratch files that came in with the merge (`server.js.tmp`, `temp_update.txt` — an old duplicate server file and a raw prompt fragment, not meant to be committed).

### 5. Added the missing `/api/definition` route
The frontend (`components/TranslationOverlay.tsx`, tap-to-define on the English word) has been calling `POST /api/definition` since it was written, but the backend never implemented it — always 404'd, silently. Now implemented in `backend/server.js`.

### 6. Removed `/api/chat` and the Anthropic dependency (later re-added, see #8)
Since Sunny chat was gone from the frontend, `/api/chat` (the only caller) was dead code — removed along with `@anthropic-ai/sdk` and `ANTHROPIC_API_KEY` from `.env.example`.

### 7. Added rate limiting
None of the backend routes have auth, so anyone with the URL could hammer `/api/scan` / `/api/tts` / `/api/definition` and run up the AI API bill. Added `express-rate-limit`: 100 req/15min per IP on all `/api/` routes, plus a tighter 20 req/15min cap specifically on the three AI-calling routes. Tested locally — confirmed 429s kick in after 20 requests.

### 8. Replaced Gemini with Claude
Per your request ("use claude to do the parsing and whatnot instead"): `/api/scan` (image → cultural context JSON) and `/api/definition` now call `claude-opus-4-8` via `@anthropic-ai/sdk` instead of Gemini. `@google/generative-ai` and `GEMINI_API_KEY` are fully gone from the codebase. **Confirmed working end-to-end** later this session (see API key status below).

### 9. Pivoted to a fully local-first architecture (MongoDB → SQLite, auto-detected backend URL)
Since this got posted on LinkedIn, a few strangers might clone it. Rather than maintain a shared hosted backend (and fight MongoDB Atlas/Railway, as items 1–8 above spent a lot of time doing), the model is now: **everyone runs the backend on their own machine with their own API keys.**

- `backend/server.js`: MongoDB Atlas → a local `better-sqlite3` file, `backend/data.sqlite` (gitignored, auto-created on first run, zero setup). Same schema/behavior as before (`timesSeenCount`, `nextReview`, etc.), just no account/network/whitelist to fight.
- New `constants/api.ts`: `API_URL` auto-detects the backend via Expo's dev-server host (`Constants.expoConfig.hostUri`) instead of a hardcoded URL — works for physical devices, simulators, and web without any manual config, as long as the backend and `npx expo start` run on the same machine. `EXPO_PUBLIC_API_URL` env var overrides it for edge cases (tunnel mode, pointing at a different machine).
- `README.md` now has a "Running this locally" section covering both halves.
- **Verified end-to-end locally**: scan → Claude vision → SQLite write → rescanning the same word correctly bumps `timesSeenCount` and flips `isReview: true`.

## API key status (as of this session)

| Key | Status |
|---|---|
| **Gemini** | No longer used — removed from the codebase entirely (see #8). |
| **ElevenLabs** | Valid, but hit `402 payment_required — Free users cannot use library voices via the API`. The free ElevenLabs plan cannot do TTS over the API with the configured voice. You'll need either a paid ElevenLabs plan, or to swap to a voice/approach the free tier allows, or drop TTS. **Still unresolved — this is the one real open item.** |
| **Anthropic** | ✅ **Confirmed working.** First attempt hit `401 invalid x-api-key` (a bad paste), you fixed it, and a retest got a clean 200 with a real Claude-generated definition, plus a full `/api/scan` round trip (image → correct identification → SQLite write). |
| **MongoDB** | No longer relevant — removed entirely in favor of local SQLite (see #9). All the earlier whitelist/port-27017 debugging was real (confirmed via raw TCP test that this network blocks outbound 27017) but is now moot since there's no MongoDB to connect to. |

## Next steps

1. **Decide on ElevenLabs** — the only unresolved key/service. Upgrade to a paid plan, switch to a voice the free tier allows, or drop the TTS feature (tap-to-hear-pronunciation) if it's not worth it.
2. **Try it on a physical device via Expo Go** to confirm the auto-detected `API_URL` (in `constants/api.ts`) actually reaches your machine's backend over your LAN — this wasn't tested on real hardware this session, only via `curl` against `localhost`.
3. **Push this repo to GitHub** — everything above is committed locally on `master` but hasn't been pushed. You'll need to authenticate (this sandboxed environment had no stored GitHub credentials, so the push had to be deferred to you) — from a terminal where you're already logged into GitHub: `git push origin master`.
4. If you still want other people to be able to just install an app without running their own backend, that's a different, bigger project (a real hosted deployment with your own keys, rate-limited/metered somehow) — worth a separate conversation if you want to go there later. The current state optimizes for "cloneable side project," not "app store distribution."

## Loose ends / FYI, not blocking

- `app/(tabs)/index.tsx.bak` — a stray, tracked, pre-3D/pre-VR backup file sitting in the repo. Untouched this session since it wasn't part of what you asked for; delete it whenever if it's just clutter.
- `.claude/` in the repo root is this Claude Code session's local state directory — untracked, not part of the app, safe to ignore or gitignore.
- The original `~/Desktop/projects/project_origin_backend` standalone repo still exists on disk, untouched. It's now fully superseded by `backend/` in this repo (which also has its own local SQLite storage instead of that repo's MongoDB code) — safe to archive/delete whenever, no rush.
