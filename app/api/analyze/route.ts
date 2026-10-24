import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GeminiError = {
  error?: { details?: Array<{ violations?: Array<{ quotaId?: string }> }> };
};

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
};

type Guidance = {
  title: string;
  confidence: string;
  cause: string;
  actions: string[];
  caution: string;
};

const FALLBACK: Guidance = {
  title: "Plant needs observation",
  confidence: "Unable to confirm from this photo",
  cause: "A photo alone cannot confirm a plant disease safely. Crop stage, weather, and soil conditions also matter.",
  actions: [
    "Take a clear photo of both sides of an affected leaf.",
    "Note when the symptoms started and whether nearby plants have the same issue.",
    "Ask a local agriculture officer or KVK to verify a fast-spreading problem.",
  ],
  caution: "Do not use a pesticide or fertilizer only from an AI response. Follow local expert and product-label advice.",
};

function cleanGuidance(value: Partial<Guidance>): Guidance {
  const actions = Array.isArray(value.actions)
    ? value.actions.filter((item): item is string => typeof item === "string").slice(0, 4)
    : [];

  return {
    title: typeof value.title === "string" ? value.title.slice(0, 90) : FALLBACK.title,
    confidence: typeof value.confidence === "string" ? value.confidence.slice(0, 70) : FALLBACK.confidence,
    cause: typeof value.cause === "string" ? value.cause.slice(0, 500) : FALLBACK.cause,
    actions: actions.length ? actions.map((item) => item.slice(0, 220)) : FALLBACK.actions,
    caution: typeof value.caution === "string" ? value.caution.slice(0, 300) : FALLBACK.caution,
  };
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const BUSY_MESSAGE = "The image-analysis service is busy right now. Wait a few seconds and try again.";
const DAILY_LIMIT_MESSAGE = "The free daily limit for AI image review has been used up for today. Manual symptom guidance below still works.";
const UNAVAILABLE_MESSAGE = "The image-analysis service is temporarily unavailable.";
const UNREADABLE_MESSAGE = "Could not analyse this image. Try a clearer crop photo or use manual symptom guidance.";

/** Reads a 429 body only far enough to tell a momentary slowdown from an exhausted daily quota. */
async function isDailyQuotaExhausted(response: Response) {
  try {
    const body = (await response.json()) as GeminiError;
    const violations = body.error?.details?.flatMap((detail) => detail.violations ?? []) ?? [];
    return violations.some((violation) => violation.quotaId?.includes("PerDay"));
  } catch {
    return false;
  }
}

function askGemini(apiKey: string, mimeType: string, imageData: string, prompt: string, timeoutMs: number) {
  return fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageData } }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 600,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI analysis is not configured on this deployment." }, { status: 503 });
  }

  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) {
    return NextResponse.json({ error: "Please upload a valid image file." }, { status: 400 });
  }
  if (photo.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Use an image smaller than 8 MB." }, { status: 413 });
  }

  const imageData = Buffer.from(await photo.arrayBuffer()).toString("base64");
  const prompt = `You are a cautious agricultural first-aid assistant for Indian farmers and home gardeners. Review this crop/plant image. Do not claim certainty and do not prescribe pesticide quantities, fertilizer quantities, or restricted chemicals. Return ONLY valid JSON with exactly this shape:
{
  "title": "short possible condition or observation",
  "confidence": "Low, Medium, or High visual confidence",
  "cause": "brief plain-language explanation of what is visible and uncertainty",
  "actions": ["safe immediate action 1", "safe immediate action 2", "when to contact a local agriculture officer or KVK"],
  "caution": "one concise safety warning"
}
If the photo is not a plant, too unclear, or no visible concern can be identified, say that clearly and give the user safe observation steps.`;

  const startedAt = Date.now();
  let lastError = UNAVAILABLE_MESSAGE;

  // One retry only, for a fast upstream hiccup (rate limit or 5xx). Never retry a slow or timed-out call.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timeoutMs = attempt === 0 ? 30_000 : 15_000;
    try {
      const response = await askGemini(apiKey, photo.type, imageData, prompt, timeoutMs);
      const retryable = RETRYABLE_STATUS.has(response.status);

      if (!response.ok) {
        const dailyQuotaGone = response.status === 429 && (await isDailyQuotaExhausted(response));
        lastError = dailyQuotaGone ? DAILY_LIMIT_MESSAGE : response.status === 429 ? BUSY_MESSAGE : UNAVAILABLE_MESSAGE;
        console.warn(`analyze: provider status ${response.status}${dailyQuotaGone ? " (daily quota exhausted)" : ""}`);
        if (retryable && !dailyQuotaGone && attempt === 0 && Date.now() - startedAt < 10_000) continue;
        return NextResponse.json({ error: lastError }, { status: 502 });
      }

      const payload = (await response.json()) as GeminiPayload;
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      try {
        return NextResponse.json({ guidance: cleanGuidance(JSON.parse(text) as Partial<Guidance>) });
      } catch {
        lastError = UNREADABLE_MESSAGE;
        console.warn(`analyze: unreadable provider output (finishReason: ${payload.candidates?.[0]?.finishReason ?? "unknown"})`);
        if (attempt === 0 && Date.now() - startedAt < 10_000) continue;
        return NextResponse.json({ error: lastError }, { status: 502 });
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "unknown";
      console.warn(`analyze: request failed (${name})`);
      lastError = name === "TimeoutError" ? "The image review took too long. Try again with a smaller or clearer photo." : UNREADABLE_MESSAGE;
      if (attempt === 0 && name !== "TimeoutError" && Date.now() - startedAt < 10_000) continue;
      return NextResponse.json({ error: lastError }, { status: 502 });
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}
