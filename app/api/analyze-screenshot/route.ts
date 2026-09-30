import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: '画像データがありません' }, { status: 400 });
    }

    // data:image/png;base64, のようなプレフィックスを分離
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    } else {
      base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    }

    const prompt = 'Extract all players name (string), power (integer), and bench (boolean) from this screenshot. Return strictly as a JSON array format like [{"name":"abc","power":123,"bench":false}] with no markdown.';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
      ],
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました' }, { status: 500 });
  }
}