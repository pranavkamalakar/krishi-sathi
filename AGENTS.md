# Krishi Sathi Agent Guide

## Project purpose

Krishi Sathi is a small, Vercel-ready Community Engagement Project for farmers and home gardeners. It supports crop-photo review, safe plant-care guidance, soil-protection education, and simple crop-care tips.

This is an educational prototype. It must help a user choose a safe next step; it must not claim to confirm a crop disease or replace an agriculture officer, agronomist, KVK, or laboratory soil test.

## Product principles

1. Keep the product simple, quick to demo, and usable on a phone.
2. Preserve the manual symptom flow even if the AI service is unavailable.
3. Use cautious language: “possible,” “visual confidence,” and “verify locally.”
4. Give low-risk actions such as observation, drainage checks, airflow, base watering, compost, mulch, and expert referral.
5. Do not provide pesticide quantities, fertilizer quantities, chemical-mixing instructions, or restricted-chemical advice.
6. Treat crop images and API keys as sensitive. Never log, commit, expose, or reuse them outside the current analysis request.

## Stack

| Layer | Choice | Purpose |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Page rendering, server route, Vercel deployment |
| UI | React 19 | Upload state, AI results, manual guidance, crop tabs |
| Styling | `app/globals.css` | Tokens, desktop/mobile layouts, animations |
| AI | Google Gemini 2.5 Flash | Image-based first-aid review via server-side route |
| Deploy | Vercel | Hosts static page and `/api/analyze` route |

Do not add a database, authentication, analytics, a component library, a state-management library, or a new external service unless the user explicitly changes scope.

## Repository map

```text
app/
  layout.tsx                 Metadata and global stylesheet import
  page.tsx                   Interactive landing page and all client state
  globals.css                Visual design, responsive layout, animations
  api/analyze/route.ts       Server-only Gemini image-analysis endpoint
.env.example                 Environment-variable shape; no secret
README.md                    User setup and Vercel deployment instructions
next.config.ts               Next.js configuration
```

`page.tsx` is intentionally one client component because the prototype is small. When it becomes hard to navigate, extract cohesive units such as `CropChecker`, `SoilCareCards`, or `CropGuide`; retain the client/API contract below.

## Core user flow

1. The user opens the Crop Check section.
2. They provide one `image/*` photo in any of three ways: drag and drop onto the dropzone, the upload button/file picker, or a live camera capture.
3. The client previews it locally, downscales it to a longest edge of 1280 px, and posts `FormData` field `photo` to `POST /api/analyze`.
4. The UI shows the scan overlay and animated loader while the request is in flight.
5. A successful response renders `AI image review · verify locally` and safe guidance.
6. A failed request renders `AI unavailable`, with manual symptom buttons still available.
7. A manual symptom selection clears any previous AI output and uses local deterministic content.

Never silently reuse a previous AI response for a new photo. Never render generic fallback text as though Gemini produced it.

## Gemini image-analysis integration

### Credential handling

The required environment variable is:

```bash
GEMINI_API_KEY=your_google_ai_studio_key
```

Use `.env.local` for local development and Vercel Project Settings → Environment Variables for deployed environments. Keep it server-only: do not prefix it with `NEXT_PUBLIC_`. Do not put a key in tracked files, a client component, a terminal transcript, a screenshot, or documentation.

### Request and response contract

`POST /api/analyze` receives multipart form data:

```text
photo: one image file; MIME type starts with image/; maximum 8 MB
```

On success it returns:

```ts
type Guidance = {
  title: string;
  confidence: string;
  cause: string;
  actions: string[];
  caution: string;
};
```

The client expects `{ guidance: Guidance }`; errors return `{ error: string }`. If this shape changes, update both the client and route in one change and validate a real upload.

### Provider configuration

Keep these choices unless a measured replacement is safer and faster:

- Model: `gemini-2.5-flash`
- Output: `application/json`
- Temperature: `0.2`
- Maximum output tokens: `600`
- Thinking: `thinkingConfig: { thinkingBudget: 0 }`
- Network timeout: 30 seconds

The old `gemini-flash-latest` alias could use a thinking-capable model and exceed the interaction timeout. The pinned model with thinking disabled has been verified with a real leaf image. Do not replace it with an alias merely for novelty.

### Safety boundary

`app/api/analyze/route.ts` deliberately has three safety layers:

1. A prompt that forbids certainty and chemical dosages.
2. A strict `Guidance` JSON shape.
3. `cleanGuidance`, which validates string fields, limits lengths, limits actions, and supplies safe fallback content.

Preserve all layers when editing AI behavior. New agricultural advice must remain safe without knowing the crop, locale, weather, disease severity, regulations, or a field inspection.

## Image capture

`app/page.tsx` owns three capture paths, and all of them end in the same `analysePhoto(file)` call:

- **Drag and drop:** the dropzone handles `dragover`/`dragleave`/`drop` and picks the first `image/*` file. A window-level listener stops the browser from navigating when a file is dropped elsewhere.
- **Upload:** a hidden `input#photo` opened by the dropzone click, Enter/Space, or the upload button. The input value is cleared after each change so the same file can be re-sent.
- **Live camera:** `navigator.mediaDevices.getUserMedia` with `facingMode: { ideal: "environment" }`, previewed in a muted `playsInline` `video`, captured to a canvas, and sent as a JPEG. Tracks are stopped after capture and on unmount.

`shrinkImage` downscales anything above 1280 px (or above ~1.6 MB) to a quality-0.85 JPEG before upload, which keeps phone photos inside the 8 MB route limit. If `createImageBitmap` fails, the original file is sent unchanged.

A live camera needs a secure context, so it works on `localhost` and on the HTTPS Vercel deployment but not over a plain-HTTP LAN address. When `getUserMedia` is missing or rejects, the UI explains why and offers a `capture="environment"` file input that opens the device camera app instead. Keep every camera failure non-blocking: drag and drop, upload, and the manual symptom buttons must all stay usable.

## Manual guidance and crop content

The `issues` object in `app/page.tsx` is the source of truth for deterministic symptom guidance. It covers yellow leaves, leaf spots, pest damage, and an observation default.

When changing it:

- State observations or possible causes, never certainty.
- Use short, actionable, non-expert-friendly steps.
- Retain the prompt to consult an agriculture officer/KVK for fast-spreading or uncertain issues.
- Avoid chemical treatment names and dosage guidance.

The crop tabs are basic care education, not diagnosis rules. Add a crop only with a brief plain-language care reminder and maintain the existing interaction pattern.

## UI system

### Visual direction

The UI is intentionally warm and simple: cream and sage backgrounds, deep green text, rounded cards, serif display headings, sans-serif body text, and small mono labels. It should feel approachable, not clinical or like an enterprise dashboard.

Reuse tokens defined at the top of `app/globals.css` before introducing colors. Use Playfair Display for primary headings, DM Sans for body copy, and DM Mono for technical labels.

### Required states

The Crop Check panel must distinguish these states:

| State | Required visual/result behavior |
| --- | --- |
| No upload | Empty guidance prompt |
| Dragging a file over the dropzone | `dragActive` border plus a visible drop hint |
| Camera open | Live `video` preview with capture, flip, and close controls |
| Camera unavailable or blocked | Plain-language `captureNote` plus a device-camera file fallback |
| Image selected | Local preview and file name |
| AI running | `photoScan`, animated dots, and “Reading visible leaf patterns…” |
| AI success | Guidance card with verify-locally label |
| AI failure | Clear `AI unavailable` state plus manual path |
| Manual symptom | Deterministic manual guidance card |

### Responsive behavior

- Desktop uses two-column hero and diagnosis layouts.
- At `760px` and below, sections stack into one column.
- Navigation links hide on small screens while the call to action stays visible.
- Crop tabs wrap into a compact grid on mobile.
- Buttons, cards, text, image preview, and result states must remain readable and tap-friendly.

If a task touches visual code, inspect desktop and a narrow mobile viewport before completion.

## Local development

```bash
npm install
cp .env.example .env.local
# Add GEMINI_API_KEY to .env.local
npm run dev
```

Open `http://localhost:3000`. Use a clear, public leaf image to test the Crop Check journey. Do not use another person’s private image for an AI test.

## Validation requirements

Run this for every source-code change:

```bash
npm run build
```

Use the live app to validate UI changes. For `/api/analyze`, test the real contract with a known image and require a valid guidance response:

```bash
curl -sS -X POST \
  -F 'photo=@/absolute/path/to/leaf.jpg;type=image/jpeg' \
  http://localhost:3000/api/analyze
```

Do not record a key in shell history, scripts, repository files, captured command output, or agent messages.

## Image-analysis debugging order

1. Verify `.env.local` exists, `GEMINI_API_KEY` is set, and the dev server was restarted after changing it.
2. Verify the file is an image and at most 8 MB.
3. Reproduce through the local endpoint with `curl -F photo=@...`.
4. Verify provider access with a redacted key/model check in Google AI Studio or an ephemeral local command.
5. Confirm the pinned Gemini model, zero thinking budget, JSON output setting, and timeout are present.
6. Keep displayed error text useful but free of credentials, raw request bodies, image data, and full provider responses.

Do not add production logs containing image bytes, API keys, raw provider payloads, or user identifiers.

## Vercel deployment

1. Run `npm run build` locally.
2. Push the verified commit.
3. Import or deploy the GitHub repository in Vercel.
4. Add `GEMINI_API_KEY` for the intended Vercel environments.
5. Redeploy after adding or rotating the environment variable.
6. Upload a public leaf image on the deployed site and verify AI success.
7. Click a manual symptom button and verify the fallback still works.

The API route executes server-side. A missing Vercel environment variable is a configuration error, not a frontend issue.

## Git discipline

- Inspect `git status --short` before editing and preserve unrelated work.
- Keep commits focused and use factual messages.
- Never stage `.env.local`, uploaded image files, `.next`, `node_modules`, generated provider output, or credentials.
- Update `README.md` when setup, environment variables, endpoint contracts, or deployment steps change.
- Use `git diff --check` before committing documentation or code changes.

## Completion checklist

- [ ] The requested behavior works in the correct UI or API seam.
- [ ] AI output remains an explicitly uncertain image review.
- [ ] Manual symptom guidance remains available without AI.
- [ ] No secret, image bytes, or provider payload entered source control or logs.
- [ ] Desktop and mobile layouts work if UI changed.
- [ ] `npm run build` passes if code changed.
- [ ] README/setup instructions match changed configuration.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
