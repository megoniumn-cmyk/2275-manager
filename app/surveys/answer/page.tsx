// app/surveys/answer/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { fetchDictionary } from '@/lib/translation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SurveyItem {
  id: string;
  survey_type: string;
  title: string;
  deadline: string;
  match_time?: string;
  target_restriction?: string;
  hasAnswered: boolean;
}

export default function SurveyAnswerListPage() {
  const [lang, setLang] = useState<'ja' | 'en'>('ja');
  const [dict, setDict] = useState<Record<string, string>>({});
  const [dynamicTranslations, setDynamicTranslations] = useState<Record<string, string>>({});
  
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. 初期ロード時（辞書データの取得）
  useEffect(() => {
    const savedLang = localStorage.getItem('preferred_lang') as 'ja' | 'en';
    if (savedLang) setLang(savedLang);

    fetchDictionary().then((loadedDict) => {
      setDict(loadedDict);
    });

    const fetchSurveysAndUser = async () => {
      try {
        const savedGameId = localStorage.getItem('logged_in_game_id');
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUser = session?.user || null;

        let profileData = null;

        if (savedGameId) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('game_id', savedGameId)
            .single();
          profileData = data;
        } else if (supabaseUser) {
          const providerId = supabaseUser.user_metadata?.sub || supabaseUser.identities?.[0]?.id;
          if (providerId) {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('discord_id', String(providerId))
              .single();
            profileData = data;
          }
          if (!profileData) {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', supabaseUser.id)
              .single();
            profileData = data;
          }
        }

        if (!profileData || !profileData.game_id) {
          setLoading(false);
          return;
        }

        let isUserLeader = false;
        const { data: memberData } = await supabase
          .from('members')
          .select('leader')
          .eq('game_id', profileData.game_id)
          .maybeSingle();

        if (memberData && memberData.leader === true) {
          isUserLeader = true;
        }

        const nowISO = new Date().toISOString();
        const { data: surveysData, error: surveysError } = await supabase
          .from('surveys_master')
          .select('*')
          .gt('deadline', nowISO)
          .order('deadline', { ascending: true });

        if (surveysError || !surveysData) {
          setLoading(false);
          return;
        }

        const processedSurveys: SurveyItem[] = [];

        for (const survey of surveysData) {
          if (survey.survey_type === 'hero_skill' && isUserLeader) {
            continue;
          }

          if (survey.target_restriction === 'non_leader_only' && isUserLeader) {
            continue;
          }

          const tableName = getAnswerTableName(survey.survey_type);
          let hasAnswered = false;

          if (tableName) {
            const { data: ansData, error: err } = await supabase
              .from(tableName)
              .select('survey_id')
              .eq('survey_id', survey.id)
              .eq('game_id', profileData.game_id)
              .maybeSingle();

            if (!err && ansData) {
              hasAnswered = true;
            }
          }

          processedSurveys.push({
            ...survey,
            hasAnswered,
          });
        }

        setSurveys(processedSurveys);
      } catch (err) {
        console.error('アンケート一覧取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSurveysAndUser();
  }, []);

  // 2. 一括翻訳処理（自動翻訳が必要な項目の補完）
  useEffect(() => {
    if (lang === 'ja') return;

    const baseTexts = [
      "アンケート一覧",
      "回答期限内のアンケート一覧です。回答済み・未回答の確認や再回答が行えます。",
      "← ホームに戻る",
      "読み込み中...",
      "現在、回答可能なアンケートはありません。",
      "回答済み",
      "未回答",
      "期限: ",
      "対戦時間: ",
      "回答する →",
      "回答を変更・確認する →"
    ];

    const surveyTitles = surveys.map(s => s.title).filter(Boolean);
    const textsToTranslate = Array.from(new Set([...baseTexts, ...surveyTitles]));

    let isMounted = true;

    const translateBatch = async () => {
      const newMap: Record<string, string> = { ...dynamicTranslations };
      let hasNew = false;

      for (const text of textsToTranslate) {
        if (!text) continue;

        if (dict[text]) {
          newMap[text] = dict[text];
          hasNew = true;
          continue;
        }

        if (newMap[text]) continue;

        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, lang }),
          });
          const data = await res.json();
          if (data.translatedText) {
            newMap[text] = data.translatedText;
            hasNew = true;
          }
        } catch (e) {
          console.error('Translation error:', e);
        }
      }

      if (isMounted && hasNew) {
        setDynamicTranslations({ ...newMap });
      }
    };

    if (textsToTranslate.length > 0) {
      translateBatch();
    }

    return () => {
      isMounted = false;
    };
  }, [lang, dict, surveys]);

  const changeLang = (newLang: 'ja' | 'en') => {
    setLang(newLang);
    localStorage.setItem('preferred_lang', newLang);
  };

  const getAnswerTableName = (surveyType: string) => {
    switch (surveyType) {
      case 'weapon_schedule': return 'survey_responses_tal_schedule';
      case 'weapon_entry': return 'survey_responses_tal_entry';
      case 'svs': return 'survey_responses_svs';
      case 'frost_dragon': return 'survey_responses_ftd';
      case 'hero_skill': return 'survey_responses_hero_skill';
      default: return null;
    }
  };

  const getAnswerUrl = (surveyType: string, surveyId: string) => {
    switch (surveyType) {
      case 'weapon_schedule': return `/surveys/answer/tal_schedule/${surveyId}`;
      case 'weapon_entry': return `/surveys/answer/tal_entry/${surveyId}`;
      case 'svs': return `/surveys/answer/svs/${surveyId}`;
      case 'frost_dragon': return `/surveys/answer/ftd/${surveyId}`;
      case 'hero_skill': return `/surveys/answer/hero_skill/${surveyId}`;
      default: return `/surveys/answer/${surveyId}`;
    }
  };

  const formatDeadline = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  };

  // 翻訳関数（1. 翻訳テーブル優先 -> 2. 個別ハードコード -> 3. 自動翻訳）
  const t = (text: string | null | undefined) => {
    if (!text) return '';
    if (lang === 'ja') return text;

    if (lang === 'en') {
      // 1. 翻訳テーブル（dict）に登録があれば最優先で採用
      if (dict[text]) {
        return dict[text];
      }

      // 2. 個別のハードコードフォールバック
      if (text === "アンケート一覧") return "Survey List";
      if (text === "回答期限内のアンケート一覧です。回答済み・未回答の確認や再回答が行えます。") return "List of active surveys within the response deadline. You can check your status or update answers.";
      if (text === "← ホームに戻る") return "← Back to Home";
      if (text === "読み込み中...") return "Loading...";
      if (text === "現在、回答可能なアンケートはありません。") return "There are no active surveys available at the moment.";
      if (text === "回答済み") return "Answered";
      if (text === "未回答") return "Unanswered";
      if (text === "期限: ") return "Deadline: ";
      if (text === "対戦時間: ") return "Match Time: ";
      if (text === "回答する →") return "Answer →";
      if (text === "回答を変更・確認する →") return "Edit / Review →";

      // アンケートタイトルのフォールバック例
      if (text.includes('SvS参加アンケート')) return text.replace('SvS参加アンケート', 'SvS Participation Survey');
      if (text.includes('英雄スキルLv5アンケート')) return text.replace('英雄スキルLv5アンケート', 'Hero Skill Lv5 Survey');
    }

    // 3. テーブルになければ自動翻訳結果（dynamicTranslations）、それもなければ元のテキスト
    return dynamicTranslations[text] || text;
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col">
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* ヘッダー＆言語切替 */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">{t("アンケート一覧")}</h1>
            <p className="text-xs text-slate-400 mt-1">{t("回答期限内のアンケート一覧です。回答済み・未回答の確認や再回答が行えます。")}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* カプセル型の言語切替トグルスイッチ */}
            <div className="flex bg-[#151c2c] border border-slate-800 rounded-xl p-1 shadow">
              <button
                onClick={() => changeLang('ja')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  lang === 'ja'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                日本語
              </button>
              <button
                onClick={() => changeLang('en')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  lang === 'en'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                English
              </button>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              {t("← ホームに戻る")}
            </Link>
          </div>
        </div>

        {/* 一覧セクション */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">{t("読み込み中...")}</div>
        ) : surveys.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-[#151c2c]/50 rounded-2xl border border-slate-800">
            {t("現在、回答可能なアンケートはありません。")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {surveys.map((survey) => (
              <div
                key={survey.id}
                className={`bg-[#151c2c] border rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition ${
                  survey.hasAnswered ? 'border-slate-800 opacity-80' : 'border-amber-500/40 shadow-lg'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {survey.hasAnswered ? (
                      <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded-md text-[10px] font-semibold">
                        {t("回答済み")}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/50 rounded-md text-[10px] font-semibold animate-pulse">
                        {t("未回答")}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {t("期限: ")}{formatDeadline(survey.deadline)}
                    </span>
                    {survey.match_time && (
                      <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 rounded-md text-[10px]">
                        {t("対戦時間: ")}{survey.match_time}
                      </span>
                    )}
                  </div>
                  {/* タイトルに t() を適用 */}
                  <h2 className="text-base font-bold text-white">{t(survey.title)}</h2>
                </div>

                <Link
                  href={getAnswerUrl(survey.survey_type, survey.id)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition shadow shrink-0 ${
                    survey.hasAnswered
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {survey.hasAnswered ? t("回答を変更・確認する →") : t("回答する →")}
                </Link>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}