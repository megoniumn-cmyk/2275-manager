import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let dictionaryCache: Record<string, string> | null = null;

/**
 * 翻訳辞書データをSupabaseから取得してキャッシュする関数
 */
export async function fetchDictionary(): Promise<Record<string, string>> {
  if (dictionaryCache) {
    return dictionaryCache;
  }

  try {
    const { data, error } = await supabase
      .from('translation_dictionary')
      .select('japanese, english');

    if (!error && data) {
      const map: Record<string, string> = {};
      data.forEach((row) => {
        if (row.japanese && row.english) {
          map[row.japanese] = row.english;
        }
      });
      dictionaryCache = map;
      return map;
    }
  } catch (err) {
    console.error('翻訳辞書の取得に失敗しました:', err);
  }

  return {};
}

// 二重リクエストを防ぐためのセット
const fetchingSet = new Set<string>();

/**
 * 翻訳関数（辞書最優先、なければ自動翻訳APIを呼んで動的マップを更新）
 */
export function getTranslatedText(
  text: string | null | undefined,
  lang: 'ja' | 'en',
  dict: Record<string, string>,
  dynamicMap: Record<string, string>,
  setDynamicMap: React.Dispatch<React.SetStateAction<Record<string, string>>>
): string {
  if (!text) return '';
  if (lang === 'ja') return text;

  // 1. Supabaseの辞書データ（ゲーム用語等）にあれば最優先で使用
  if (dict[text]) return dict[text];

  // 2. すでに動的翻訳済みのキャッシュにあればそれを使用
  if (dynamicMap[text]) return dynamicMap[text];

  // 3. どちらにもない場合は、自動翻訳APIを非同期で叩いて取得する
  if (!fetchingSet.has(text)) {
    fetchingSet.add(text);

    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    })
      .then(async (res) => {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        } else {
          throw new Error('Server did not return JSON');
        }
      })
      .then((data) => {
        if (data.translatedText && data.translatedText !== text) {
          setDynamicMap((prev) => ({ ...prev, [text]: data.translatedText }));
        }
      })
      .catch((err) => {
        console.warn('自動翻訳スキップ:', err.message);
      })
      .finally(() => {
        fetchingSet.delete(text);
      });
  }

  // 初回検知時は原文を返しつつ、API完了後に自動再描画されて英語に切り替わります
  return text;
}