# Project Origin | AI powered language learning platform

"I wish I could speak to my grandparents in their language."

For those of us who grew up between two cultures, there's a disconnect. We understand fragments but can't fully connect.

Apps like Duolingo teach vocabulary, but knowing "粽子" means "zongzi" doesn't tell you why your grandmother makes them every Dragon Boat Festival. We wanted something that bridges the cultural gap - not just translates words.

## What does it do?
An AR app that translates objects through your camera and teaches you the cultural context behind them.

- Point your camera at something, tap to scan
- Get the Chinese translation, pinyin, and audio pronunciation
- See cultural context explaining WHY this object matters
- 3D models appear for culturally significant items (dragon boats, lion dancers)
- Chat with "Sunny" - an AI assistant for cultural questions
- Spaced repetition tracks what you've learned
- VR mode for Google Cardboard

## Stack: 
Frontend: React Native + Expo, expo-gl + THREE.js for 3D, Expo Camera
Backend: Node.js on Railway, MongoDB, Google Gemini for image analysis, Claude for chat, ElevenLabs for TTS


## Get started
1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```
