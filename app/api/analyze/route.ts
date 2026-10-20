import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
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

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: photo.type, data: imageData } }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 600,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json({ error: "The image-analysis service is temporarily unavailable." }, { status: 502 });
    }

    const payload = (await response.json()) as GeminiPayload;
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const guidance = cleanGuidance(JSON.parse(text) as Partial<Guidance>);
    return NextResponse.json({ guidance });
  } catch {
    return NextResponse.json({ error: "Could not analyse this image. Try a clearer crop photo or use manual symptom guidance." }, { status: 502 });
  }
}
