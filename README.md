# ProjectOrigin

Point your phone's camera at an everyday object and get its Chinese name, pronunciation, and a short cultural note — powered by Claude. It's meant to make picking up Mandarin part of just looking around, not sitting down to study flashcards.

## What it does

- **Scan anything** — Claude looks at the photo, identifies the object, and gives you the Chinese translation, pinyin pronunciation, and a short cultural note about it.
- **Hear it spoken** — tap the word to hear it read aloud, using your phone's own built-in text-to-speech (no internet needed for this part).
- **Adjusts to you** — mark a word "familiar" or "unfamiliar" and future descriptions shift how much Chinese vs. English they use. During onboarding you also pick a proficiency level and a learning goal (travel, business, conversation, etc.), which shapes how Claude explains things.
- **Remembers what you've scanned** — your word history is saved locally on your machine (nothing leaves it except the calls to Claude needed to identify objects).

## How to run it

Everything runs on your own machine — there's no shared server or account to set up beyond your own Anthropic API key.

### 1. Backend (handles the Claude calls + your local word history)

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env` and fill in your own `ANTHROPIC_API_KEY` (get one at [console.anthropic.com](https://console.anthropic.com)). Then start it:

```bash
npm run dev
```

This runs the backend on port 3000 and creates `backend/data.sqlite` automatically on first run — a local file for your word history, no database to set up.

### 2. The app

In a separate terminal, from the repo root:

```bash
npm install
npx expo start
```

Then open it in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), an [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/), an [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/), or [Expo Go](https://expo.dev/go) — whichever the `npx expo start` output offers you.

The app finds your local backend automatically as long as both are running on the same machine/network — no manual configuration needed.
