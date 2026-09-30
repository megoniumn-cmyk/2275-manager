import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 混雑時（503等）に徐々に待ち時間を延ばしながら最大4回リトライする関数
async function generateWithSmartRetry(model: string, contents: any, retries = 4, delay = 3000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} with model ${model}...`);
      return await ai.models.generateContent({ model, contents });
    } catch (error: any) {
      const errorMsg = error?.message || JSON.stringify(error);
      const isOverloaded = errorMsg.includes('503') || errorMsg.includes('429') || errorMsg.includes('UNAVAILABLE') || error?.status === 503 || error?.status === 429;
      
      if (isOverloaded && i < retries - 1) {
        console.warn(`Attempt ${i + 1} overloaded (503/429). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // 試行ごとに待機時間を倍増（3秒 -> 6秒 -> 12秒）
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

    // 指定された gemini-3.8-flash を使い、混雑時は待機時間を挟んで自動リトライ
    const response = await generateWithSmartRetry('gemini-3.8-flash', [
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