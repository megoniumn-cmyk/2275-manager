import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// リトライ処理用のヘルパー関数
async function generateWithRetry(model: string, contents: any, retries = 3, delay = 2000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent({ model, contents });
    } catch (error: any) {
      // 503 (Unavailable) または 429 (Too Many Requests) の場合のみリトライ
      const isOverloaded = error?.message?.includes('503') || error?.message?.includes('429') || error?.status === 503 || error?.status === 429;
      if (isOverloaded && i < retries - 1) {
        console.warn(`Attempt ${i + 1} failed due to high demand. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // バックオフ（待機時間を増やす）
      } else {
        throw error;
      }
    }
  }
}

export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: '画像データがありません' }, { status: 400 });
    }

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

    // 指定された gemini-3.8-flash を使用し、混雑時は自動リトライ
    const response = await generateWithRetry('gemini-3.8-flash', [
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      },
    ]);

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました' }, { status: 500 });
  }
}