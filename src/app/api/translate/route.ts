import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { texts, target } = (await request.json()) as { texts?: string[]; target?: string };
  if (!texts?.length || !target) {
    return NextResponse.json({ error: "texts and target are required" }, { status: 400 });
  }

  const apiKey = process.env.TRANSLATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "translation is not configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texts, target, format: "text" }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  const data = await res.json();
  const translations = (data.data?.translations ?? []) as { translatedText: string }[];
  if (translations.length !== texts.length) {
    return NextResponse.json({ error: "unexpected translation response" }, { status: 502 });
  }

  return NextResponse.json({ translations: translations.map((t) => t.translatedText) });
}
