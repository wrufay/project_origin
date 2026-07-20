# Session handoff — project_origin cleanup

Picking this up on your home computer? Start with **"Next steps"** at the bottom — everything above is what's already done and why.

## What was done, in order

All commits are on `master` in this repo (frontend repo, now the merged monorepo). Recent history, newest first:

```
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
`services/srs.ts` is a correct SM-2 implementation but **dead code** — nothing in the app calls it, despite `services/README.md` claiming full integration. The *real* spaced-repetition bookkeeping lives server-side in `backend/server.js` (`Word.timesSeenCount` / `Word.nextReview` in MongoDB), but the frontend never calls `/api/vocabulary/:userId` or `/api/review/:userId` to surface due words — so there's no review flow anywhere in the running app today. Left as-is per your call; worth deciding later whether to wire either path up or delete `services/srs.ts`.

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
Per your request ("use claude to do the parsing and whatnot instead"): `/api/scan` (image → cultural context JSON) and `/api/definition` now call `claude-opus-4-8` via `@anthropic-ai/sdk` instead of Gemini. `@google/generative-ai` and `GEMINI_API_KEY` are fully gone from the codebase. `ANTHROPIC_API_KEY` is back in `.env.example`.

## API key status (as of this session)

| Key | Status |
|---|---|
| **Gemini** | No longer used — removed from the codebase entirely (see #8). |
| **ElevenLabs** | Valid, but hit `402 payment_required — Free users cannot use library voices via the API`. The free ElevenLabs plan cannot do TTS over the API with the configured voice. You'll need either a paid ElevenLabs plan, or to swap to a voice/approach the free tier allows, or drop TTS. |
| **Anthropic** | Not yet tested. `backend/.env` had a placeholder value (`ANTHROPIC_API_KEY=your_anthropic_api_key_here`) as of when this doc was written — you said you'd fill in the real key on your home computer. |
| **MongoDB** | Inconclusive. The Atlas Network Access list already has `0.0.0.0/0` (allow from anywhere), so it's not a whitelist problem. But **this network blocks outbound port 27017** — confirmed via raw TCP test (443 to the same Atlas host works, 27017 doesn't), so the connection never gets far enough to test the password either. This is a local-network restriction, not an Atlas config problem — cloud hosts like Railway don't usually block arbitrary outbound ports, so it will very likely just work once deployed. Test again on a different network (e.g. mobile hotspot, or your home network) to actually confirm the credentials before deploying. |

## Next steps

1. **Fill in `ANTHROPIC_API_KEY`** in `backend/.env` with your real key.
2. **Test locally**: `cd backend && npm run dev` (use `PORT=<something free>` if 3000 is taken — check with `lsof -i :3000` first). Watch for `Connected to MongoDB` vs a connection error. If it connects now, the earlier failures really were just this network's port-27017 block.
3. **Hit the endpoints** with curl to confirm Claude actually works for `/api/scan` and `/api/definition` (a screenshot/photo → base64 → POST works for `/api/scan`; a plain word for `/api/definition`).
4. **Decide on ElevenLabs**: upgrade to a paid plan, switch voices, or drop the TTS feature if it's not worth it.
5. **Redeploy the backend.** The live Railway URL (`identitybackend-production-ebf0.up.railway.app`) currently 404s on every route — "Application not found" — meaning the whole deployment is gone, not just misconfigured. You'll need to either relink Railway to this repo's `backend/` folder (it now lives inside `project_origin`, not the old standalone `project_origin_backend` repo) or redeploy from scratch, and set `ANTHROPIC_API_KEY` / `ELEVENLABS_API_KEY` / `MONGODB_URI` in Railway's dashboard env vars (same values as your local `.env`).
6. **Update the frontend's `API_URL`** if the redeployed backend gets a new URL — it's hardcoded in `app/(tabs)/index.tsx` and `components/TranslationOverlay.tsx` (both currently point at the dead Railway URL).
7. **Push this repo to GitHub** when you're happy with it — all the work above is committed locally on `master` but hasn't been pushed anywhere yet.

## Loose ends / FYI, not blocking

- `app/(tabs)/index.tsx.bak` — a stray, tracked, pre-3D/pre-VR backup file sitting in the repo. Untouched this session since it wasn't part of what you asked for; delete it whenever if it's just clutter.
- `.claude/` in the repo root is this Claude Code session's local state directory — untracked, not part of the app, safe to ignore or gitignore.
- The original `~/Desktop/projects/project_origin_backend` standalone repo still exists on disk, untouched. Once you're confident `backend/` in this repo is the one true copy, you can archive/delete that directory — but no rush.
