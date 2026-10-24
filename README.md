# Krishi Sathi

A Vercel-ready Community Engagement Project prototype for plant care and soil protection.

## What it does

- Accepts a crop photo three ways: drag and drop, file upload, or a live camera capture in the browser.
- Analyses that photo with Google Gemini and returns cautious first-aid guidance.
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

## Camera notes

The live camera uses the browser camera API, which browsers only allow on a secure origin. It works on `http://localhost:3000` and on the HTTPS Vercel URL, but not when the dev server is opened through a plain-HTTP LAN address such as `http://192.168.x.x:3000`. The first use asks for camera permission.

If the live camera is unavailable or blocked, the app says so and offers the device camera app instead; drag and drop, upload, and the manual symptom buttons keep working. Large photos are downscaled in the browser before upload.

## AI quota

The Google AI Studio free tier allows only a small number of Gemini image reviews per key per day (currently 20 for `gemini-2.5-flash`). When that is used up, the app says the free daily limit is reached, keeps the manual symptom guidance working, and resumes automatically when the quota resets. Enable billing on the Google Cloud project behind the key, or use another key, for a higher limit.

## Deploy on Vercel

1. Push this repository to GitHub.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Add `GEMINI_API_KEY` under **Environment Variables** using your Google AI Studio key.
4. Keep the detected framework as Next.js and click Deploy.

The key is used only by the server route and is not included in the browser bundle.
