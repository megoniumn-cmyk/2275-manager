import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// サーバー側で安全にAPIキーを読み込む
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { imageBase64, prompt } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: '画像データがありません' }, { status: 400 });
    }

    // Base64データからプレフィックス（data:image/...;base64,）を外す
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Gemini APIをサーバー側から呼び出し（安定性が増します）
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // 安定性の高いモデルを指定
      contents: [
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg', // または image/png
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