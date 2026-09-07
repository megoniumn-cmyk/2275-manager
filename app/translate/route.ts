// app/api/translate/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  let requestBody: any = {};
  try {
    requestBody = await request.json();
    const targetText: string = requestBody.text;
    const lang: string = requestBody.lang;

    if (!targetText || lang === 'ja') {
      return NextResponse.json({ translatedText: targetText });
    }

    // 1. translation_dictionary テーブルから既存の翻訳を検索
    const { data: dictData } = await supabase
      .from('translation_dictionary')
      .select('english')
      .eq('japanese', targetText)
      .maybeSingle();

    if (dictData && dictData.english) {
      return NextResponse.json({ translatedText: dictData.english });
    }

    // 2. 辞書にない場合：Google AI (Gemini) で自動翻訳を実行
    let translatedText = targetText;
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (apiKey) {
      try {
        const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `Translate the following Japanese text used in a game alliance management system into natural English. Return ONLY the translated English text, nothing else:\n\n${targetText}` }]
            }]
          })
        });
        const aiJson = await aiRes.json();
        const generated = aiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (generated) {
          translatedText = generated;
          // 次回から優先されるよう、自動的にテーブルに保存
          await supabase
            .from('translation_dictionary')
            .insert([{ japanese: targetText, english: generated }])
            .select();
        }
      } catch (aiErr) {
        console.error('Google AI翻訳エラー:', aiErr);
      }
    }

    return NextResponse.json({ translatedText });
  } catch (err: any) {
    console.error('翻訳APIエラー:', err);
    return NextResponse.json({ translatedText: requestBody?.text || '' }, { status: 500 });
  }
}