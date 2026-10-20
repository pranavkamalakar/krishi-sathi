# Krishi Sathi

A Vercel-ready Community Engagement Project prototype for plant care and soil protection.

## What it does

- Analyses an uploaded crop photo with Google Gemini and returns cautious first-aid guidance.
- Provides a symptom-led fallback for yellow leaves, leaf spots, and pest damage.
- Explains simple soil-health practices: mature compost, mulch, and soil testing.
- Provides basic care reminders for tomato, chilli, cotton, and rice.

The app deliberately labels all generated responses as **AI image review — verify locally**. It does not prescribe pesticide or fertilizer quantities and tells the user to contact a local agriculture officer or KVK for fast-spreading or uncertain problems.

## Run locally

```bash
npm install
npm run dev
```

Create a `.env.local` file before running the app:

```bash
GEMINI_API_KEY=your_google_ai_studio_key
```

## Deploy on Vercel

1. Push this repository to GitHub.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Add `GEMINI_API_KEY` under **Environment Variables** using your Google AI Studio key.
4. Keep the detected framework as Next.js and click Deploy.

The key is used only by the server route and is not included in the browser bundle.
