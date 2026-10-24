# Claude Instructions for Krishi Sathi

## Start here

Read [AGENTS.md](AGENTS.md) completely before changing this repository. It is the canonical source for the product goal, architecture, Gemini contract, agriculture-safety rules, visual system, validation, deployment, and Git discipline. This document adds Claude-specific execution guidance and should stay aligned with `AGENTS.md` rather than duplicating it.

## Project identity

Krishi Sathi is an educational plant-care and soil-protection web prototype for a Community Engagement Project. It uses a server-side Gemini request to provide cautious crop-image review, and it always preserves manual symptom-based guidance.

The desired outcome is a straightforward, attractive, mobile-friendly Vercel app that demonstrates a useful flow honestly. A seemingly sophisticated feature that fabricates certainty is worse than a simple, transparent fallback.

## First-pass workflow

1. Read `AGENTS.md`, `README.md`, and the relevant source files.
2. Run `git status --short` before edits. Treat unrelated changes as the user’s work.
3. Locate the smallest responsible file:

   | Request type | Primary location |
   | --- | --- |
   | Page copy, interactions, upload UI, manual guidance | `app/page.tsx` |
   | Layout, colors, responsive behavior, animation | `app/globals.css` |
   | Gemini request, parsing, validation, errors | `app/api/analyze/route.ts` |
   | Metadata | `app/layout.tsx` |
   | Local/Vercel setup | `README.md`, `.env.example` |

4. State a material safety or scope trade-off before implementing it.
5. Make the smallest coherent change and validate the real behavior, not just compilation.

## Immutable project boundaries

### Privacy and secrets

- `GEMINI_API_KEY` belongs only in `.env.local` locally and Vercel environment variables in production.
- Never use `NEXT_PUBLIC_GEMINI_API_KEY`.
- Never add keys, image bytes, raw Gemini payloads, user filenames, or provider responses to source, commits, docs, screenshots, or logs.
- Uploaded images are used only for the current request. Do not add image storage, public URLs, history, analytics, or tracking without direct user approval.

### Agricultural safety

- Keep every AI result visibly uncertain: it is an image review, not a diagnosis.
- Maintain the KVK/agriculture-officer referral for uncertainty, rapid spread, or serious crop impact.
- Avoid pesticide and fertilizer quantities, chemical mixing, restricted chemicals, or safety-sensitive treatment instructions.
- When adding content, prioritize observation, sanitation, airflow, soil health, drainage, base watering, and specialist referral.

### Scope

Do not introduce accounts, a database, payments, chat, dashboards, ML training, a second AI provider, or a heavyweight UI system unless the user asks for that explicit expansion. This is a deliberately compact student prototype.

## AI request invariants

The browser uses `FormData` field name `photo`; the API route accepts an image up to 8 MB. The route returns either `{ guidance }` or `{ error }`.

Preserve these provider settings unless you have a measured reason to alter them:

```ts
model: "gemini-2.5-flash"
responseMimeType: "application/json"
temperature: 0.2
maxOutputTokens: 600
thinkingConfig: { thinkingBudget: 0 }
timeout: 30 seconds
```

The zero thinking budget is essential to responsiveness. A prior alias-based configuration could time out because reasoning was enabled. Do not casually switch to a `latest` alias.

Treat `cleanGuidance` in the API route as a boundary, not cosmetic cleanup. It caps data and protects the UI from malformed provider output. If the `Guidance` schema changes, update the prompt, parser, server response, TypeScript client expectation, and visible card together.

## UX state machine

The crop checker has distinct states that must stay truthful:

```text
idle ──(drag-drop | upload | camera capture)──> analysing ─→ AI success
                                                         └─→ AI failure → manual symptom option

idle ──> camera live ──(capture)──> analysing
     └─> camera unavailable → note + device-camera fallback (idle stays usable)

idle/manual symptom → manual guidance
```

Required cues:

- `analysing`: image scan overlay, animated dot loader, readable progress copy.
- `AI success`: output labelled `AI image review · verify locally`.
- `AI failure`: visible `AI unavailable` state and manual fallback route.
- `manual guidance`: deterministic advice, never presented as an AI response.
- `camera live`: video preview with capture, flip, and close controls; tracks stopped on capture, close, and unmount.
- `camera unavailable`: a plain-language reason plus the device-camera file fallback, never a dead end.

Do not replace an AI error with the generic observation card; that was a prior source of confusion.

## Style guidance

Honor the existing visual language: earthy cream/sage/green palette, rounded cards, Playfair Display headings, DM Sans copy, DM Mono labels, and thoughtful whitespace. Reuse CSS variables before adding values. For interaction feedback, favor subtle CSS animation over extra dependencies.

At `760px` and below, the application must stack gracefully. If editing UI, check desktop and mobile; avoid clipped crop tabs, hidden result cards, unreadable text, or small tap targets.

## Testing procedure

For any source-code change:

```bash
npm run build
```

For UI changes, use the local browser and verify the changed state.

For Gemini route changes, test the actual endpoint using a clear, public plant image:

```bash
curl -sS -X POST \
  -F 'photo=@/absolute/path/to/leaf.jpg;type=image/jpeg' \
  http://localhost:3000/api/analyze
```

Success means a parseable `guidance` result with title, confidence, cause, actions, and caution. A 200 status alone is insufficient.

For a failure, diagnose in this order: environment variable loaded, valid file/MIME/size, local route request, provider model availability, and provider latency. Preserve redacted output and never print a secret.

## Before a commit

1. Review the diff for unrelated edits.
2. Run `git diff --check`.
3. Perform the affected validation and `npm run build` for code changes.
4. Ensure `.env.local`, `node_modules`, `.next`, test images, and secrets are not staged.
5. Update `README.md` if configuration or deployment behavior changed.
6. Use one concise, factual commit message.

## Deployment reminder

Vercel needs `GEMINI_API_KEY` configured for the target environment. A GitHub push alone does not transfer `.env.local`. When analysis works locally but not in Vercel, verify the Vercel environment variable first, redeploy, then test a public leaf image on the deployed site.
