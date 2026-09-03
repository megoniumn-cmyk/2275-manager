import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { image } = data; // Base64形式の画像データ

    if (!image) {
      return NextResponse.json({ error: '画像が見つかりません' }, { status: 400 });
    }

    // Base64からデータ部分とMimeTypeを抽出
    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: '画像データの形式が不正です' }, { status: 400 });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const prompt = `
これはモバイルゲーム「ホワイトアウト・サバイバル」の戦闘レポートのスクリーンショットです。
この画像から以下の情報を抽出し、必ず指定されたJSONフォーマットのみで返してください。余計な文字列やマークダウンのバッククォート（\`\`\`json 等）は含めず、純粋なJSON文字列だけを返してください。

抽出項目:
1. result: "win" または "loss"
2. opponent_name: 相手のプレイヤー名
3. attacker_stats: 攻撃側の兵種別ステータс ({ infantry: {atk, def, health, lethality}, lancers: {...}, marksmen: {...} }) ※パーセンテージの数値のみ
4. defender_stats: 防御側の兵種別ステータス ({ infantry: {atk, def, health, lethality}, lancers: {...}, marksmen: {...} })
5. attacker_heroes: 攻撃側のリーダー英雄名 ({ infantry: "英雄名", lancers: "英雄名", marksmen: "英雄名" })
6. defender_heroes: 防御側のリーダー英雄名 ({ infantry: "英雄名", lancers: "英雄名", marksmen: "英雄名" })
7. attacker_skill_counts: 攻撃側のリーダー英雄スキル発動回数 ({ 英雄名: { skill1: 数値, skill2: 数値, skill3: 数値 } })
8. defender_skill_counts: 防御側のリーダー英雄スキル発動回数 ({ 英雄名: { skill1: 数値, skill2: 数値, skill3: 数値 } })

JSONフォーマット例:
{
  "result": "win",
  "opponent_name": "炎炎梵天",
  "attacker_stats": {
    "infantry": { "atk": 2783.0, "def": 2787.8, "health": 2952.7, "lethality": 3307.6 },
    "lancers": { "atk": 2783.0, "def": 2787.8, "health": 2952.7, "lethality": 3307.6 },
    "marksmen": { "atk": 2625.8, "def": 2630.6, "health": 2900.6, "lethality": 3256.5 }
  },
  "defender_stats": {
    "infantry": { "atk": 2690.1, "def": 2187.5, "health": 2642.8, "lethality": 2665.7 },
    "lancers": { "atk": 2690.1, "def": 2187.5, "health": 2642.8, "lethality": 2665.7 },
    "marksmen": { "atk": 2690.1, "def": 2187.5, "health": 2642.8, "lethality": 2665.7 }
  },
  "attacker_heroes": { "infantry": "ガト", "lancers": "ソニア", "marksmen": "ブラッドリー" },
  "defender_heroes": { "infantry": "ガト", "lancers": "ソニア", "marksmen": "ヘンドリック" },
  "attacker_skill_counts": {
    "ガト": { "skill1": 1, "skill2": 13, "skill3": 1 }
  },
  "defender_skill_counts": {
    "ガト": { "skill1": 1, "skill2": 9, "skill3": 1 }
  }
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        prompt,
      ],
    });

    const text = response.text ? response.text.trim() : '';
    // クリーニング（もしマークダウンが含まれていたら除去）
    const cleanedText = text.replace(/^```json\s*|^```\s*|\s*```$/g, '').trim();
    const parsedData = JSON.parse(cleanedText);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (err: any) {
    console.error('OCR解析エラー:', err);
    return NextResponse.json({ error: err.message || '解析に失敗しました' }, { status: 500 });
  }
}