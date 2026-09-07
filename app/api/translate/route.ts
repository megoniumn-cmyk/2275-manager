import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function POST(request: Request) {
  let requestBody: any = {};
  try {
    requestBody = await request.json();
    const targetText: string = requestBody.text;
    const lang: string = requestBody.lang || requestBody.targetLang;

    if (!targetText) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!ai || !apiKey || lang === 'ja') {
      return NextResponse.json({ translatedText: targetText });
    }

    const langPrompt = lang === 'en' ? 'English' : 'Japanese';

    // プロンプトをより明確にし、固有名詞（SvS等）のままでも全体の文章をしっかりと英訳させる
    const prompt = `Translate the following Japanese UI text into natural ${langPrompt} for a game alliance management dashboard. 
Rules:
- Translate the text completely into English. Do not leave it in Japanese.
- Keep game-specific terms like "SvS" or dates/numbers intact, but translate the surrounding words (e.g., "参加アンケート" -> "Participation Survey", "未回答" -> "Unanswered").
- Output ONLY the translated text without quotes or extra formatting.

Text: "${targetText}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });

    const translatedText = response.text ? response.text.trim() : targetText;

    console.log(`[Translate Success] "${targetText}" -> "${translatedText}"`);

    return NextResponse.json({ translatedText });
  } catch (error: any) {
    console.error('Translation error details:', error);
    return NextResponse.json({ translatedText: requestBody?.text || '' }, { status: 200 });
  }
}