// app/surveys/answer/hero_skill/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { fetchDictionary } from '@/lib/translation';

type SurveyMaster = {
  id: string;
  survey_type: string;
  title: string;
  event_date: string | null;
  deadline: string;
  status: string;
};

type MemberData = {
  game_id: string;
  [key: string]: any;
};

// 英雄リストとmembersテーブルの対応マッピング（英語名も定義）
const HERO_CONFIG: { name: string; enName: string; column: string }[] = [
  { name: 'ヘンドリック', enName: 'Hendrik', column: 'hero_hendrik' },
  { name: 'ガト', enName: 'Gatto', column: 'hero_gatto' },
  { name: 'ゴードン', enName: 'Gordon', column: 'hero_gordon' },
  { name: '無名', enName: 'Muming', column: 'hero_muming' },
  { name: 'レネ', enName: 'Renee', column: 'hero_renee' },
  { name: 'ノラ', enName: 'Norah', column: 'hero_norah' },
  { name: 'ミア', enName: 'Mia', column: 'hero_mia' },
  { name: 'フレンダー', enName: 'Phily', column: 'hero_phily' },
  { name: 'ジンマン', enName: 'Zinman', column: 'hero_zinman' },
  { name: 'フレッド', enName: 'Fred', column: 'hero_fred' },
];

export default function HeroSkillSurveyAnswerPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [lang, setLang] = useState<'ja' | 'en'>('ja');
  const [dict, setDict] = useState<Record<string, string>>({});
  const [dynamicTranslations, setDynamicTranslations] = useState<Record<string, string>>({});

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const [hasResponded, setHasResponded] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // 選択された英雄名の配列
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [savedResponse, setSavedResponse] = useState<any>(null);

  // 1. 初期ロード時（言語・辞書データ・アンケートデータの取得）
  useEffect(() => {
    const savedLang = localStorage.getItem('preferred_lang') as 'ja' | 'en';
    if (savedLang) setLang(savedLang);

    fetchDictionary().then((loadedDict) => {
      setDict(loadedDict);
    });

    async function initData() {
      if (!surveyId) return;

      try {
        const { data: surveyData, error: surveyError } = await supabase
          .from('surveys_master')
          .select('*')
          .eq('id', surveyId)
          .single();

        if (surveyError) throw surveyError;
        setSurvey(surveyData);

        const currentLoginGameId = localStorage.getItem('logged_in_game_id');
        if (!currentLoginGameId) {
          throw new Error('ログイン中のゲームIDが見つかりません。再度ログインしてください。');
        }

        // members テーブルから該当ユーザーのデータを取得
        const { data: memberData } = await supabase
          .from('members')
          .select('*')
          .eq('game_id', currentLoginGameId)
          .single();

        if (memberData) {
          setMember(memberData);
        } else {
          setMember({ game_id: currentLoginGameId });
        }

        // 既存回答の取得
        const { data: responseData } = await supabase
          .from('survey_responses_hero_skill')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('game_id', currentLoginGameId)
          .single();

        if (responseData) {
          setHasResponded(true);
          setSavedResponse(responseData);

          if (responseData.selected_heroes && Array.isArray(responseData.selected_heroes)) {
            setSelectedHeroes(responseData.selected_heroes);
          }
        } else {
          if (memberData) {
            const initialSelected: string[] = [];
            HERO_CONFIG.forEach((hero) => {
              const val = memberData[hero.column];
              if (val === true || val === 'true') {
                initialSelected.push(hero.name);
              }
            });
            setSelectedHeroes(initialSelected);
          }
        }

      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [surveyId]);

  // 2. 一括翻訳処理（自動翻訳の補完）
  useEffect(() => {
    if (lang === 'ja') return;

    const baseTexts = [
      "読み込み中...",
      "アンケートが見つかりませんでした。",
      "受付終了",
      "受付中",
      "回答送信完了",
      "回答期日: ",
      "英雄スキルLv5アンケート",
      "✅ 回答が送信されました",
      "ご回答ありがとうございます。以下の内容で登録され、メンバー情報にも反映されました。",
      "内容を修正する",
      "あなたの回答内容",
      "回答ゲームID",
      "遠征第1スキルがLv5の英雄",
      "選択なし（該当なし）",
      "回答中のゲームID: ",
      "キャンセルして結果に戻る",
      "遠征第1スキルがLv5の英雄を選択してください（複数選択可）",
      "*回答必須",
      "保存中...",
      "回答を更新する",
      "回答を送信する",
      "受付期限が終了しているため、回答・修正はできません。",
      "ログイン中のゲームIDが取得できませんでした。",
      "メンバー情報の更新に失敗しました: "
    ];

    const surveyTitle = survey?.title ? [survey.title] : [];
    const heroNames = HERO_CONFIG.map(h => h.name);
    const textsToTranslate = Array.from(new Set([...baseTexts, ...surveyTitle, ...heroNames]));

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
  }, [lang, dict, survey]);

  const changeLang = (newLang: 'ja' | 'en') => {
    setLang(newLang);
    localStorage.setItem('preferred_lang', newLang);
  };

  const isExpired = survey ? new Date() > new Date(survey.deadline) : false;

  const handleCheckboxChange = (heroName: string) => {
    if (selectedHeroes.includes(heroName)) {
      setSelectedHeroes(selectedHeroes.filter((h) => h !== heroName));
    } else {
      setSelectedHeroes([...selectedHeroes, heroName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExpired) {
      alert(lang === 'en' ? 'The deadline has passed, so you cannot answer or edit.' : '受付期限が終了しているため、回答・修正はできません。');
      return;
    }

    if (!member?.game_id) {
      alert(lang === 'en' ? 'Logged-in game ID could not be retrieved.' : 'ログイン中のゲームIDが取得できませんでした。');
      return;
    }

    setSubmitting(true);
    try {
      const surveyResponsePayload = {
        survey_id: surveyId,
        game_id: member.game_id,
        selected_heroes: selectedHeroes,
      };

      const { data: upsertData, error: surveyResponseError } = await supabase
        .from('survey_responses_hero_skill')
        .upsert([surveyResponsePayload], { onConflict: 'survey_id,game_id' })
        .select()
        .single();

      if (surveyResponseError) throw surveyResponseError;

      const memberUpdatePayload: Record<string, any> = {};
      HERO_CONFIG.forEach((hero) => {
        const isSelected = selectedHeroes.includes(hero.name);
        memberUpdatePayload[hero.column] = isSelected; 
      });

      const { error: memberUpdateError } = await supabase
        .from('members')
        .update(memberUpdatePayload)
        .eq('game_id', member.game_id);

      if (memberUpdateError) {
        console.error('membersテーブルの更新に失敗しました:', memberUpdateError);
        throw new Error(`メンバー情報の更新に失敗しました: ${memberUpdateError.message}`);
      }

      setSavedResponse(upsertData || surveyResponsePayload);
      setHasResponded(true);
      setIsEditing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error: any) {
      console.error(error);
      alert(`送信エラー: ${error.message || '不明なエラー'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 翻訳関数
  const t = (text: string | null | undefined) => {
    if (!text) return '';
    if (lang === 'ja') return text;

    if (lang === 'en') {
      if (dict[text]) return dict[text];

      // 英雄名の個別フォールバック
      const foundHero = HERO_CONFIG.find(h => h.name === text);
      if (foundHero) return foundHero.enName;

      if (text === "英雄スキルLv5アンケート") return "Hero Skill Lv5 Survey";
      if (text === "受付終了") return "Closed";
      if (text === "受付中") return "Active";
      if (text === "回答送信完了") return "Submitted";
      if (text === "回答期日: ") return "Deadline: ";
      if (text === "✅ 回答が送信されました") return "✅ Response submitted successfully";
      if (text === "ご回答ありがとうございます。以下の内容で登録され、メンバー情報にも反映されました。") return "Thank you for your response. It has been registered and reflected in your member profile.";
      if (text === "内容を修正する") return "Edit Response";
      if (text === "あなたの回答内容") return "Your Response";
      if (text === "回答ゲームID") return "Game ID";
      if (text === "遠征第1スキルがLv5の英雄") return "Heroes with Lv5 Expedition 1st Skill";
      if (text === "選択なし（該当なし）") return "None selected";
      if (text === "回答中のゲームID: ") return "Responding Game ID: ";
      if (text === "キャンセルして結果に戻る") return "Cancel and Return";
      if (text === "遠征第1スキルがLv5の英雄を選択してください（複数選択可）") return "Select heroes with Lv5 Expedition 1st skill (multiple choices allowed)";
      if (text === "*回答必須") return "*Required";
      if (text === "保存中...") return "Saving...";
      if (text === "回答を更新する") return "Update Response";
      if (text === "回答を送信する") return "Submit Response";
    }

    return dynamicTranslations[text] || text;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">{t("読み込み中...")}</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">{t("アンケートが見つかりませんでした。")}</p>
      </div>
    );
  }

  // 英語表示のときはUTC時刻に変換してフォーマットする
  const formatDeadline = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    if (lang === 'en') {
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const min = String(d.getUTCMinutes()).padStart(2, '0');
      return `${mm}/${dd} ${hh}:${min} UTC`;
    } else {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${mm}/${dd} ${hh}:${min}`;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1000px] mx-auto p-6 w-full space-y-6 flex flex-col">
        
        {/* 言語切替タブ */}
        <div className="flex justify-end">
          <div className="inline-flex bg-[#121826] border border-slate-800 rounded-xl p-1 shadow-md">
            <button
              type="button"
              onClick={() => changeLang('ja')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'ja'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              日本語
            </button>
            <button
              type="button"
              onClick={() => changeLang('en')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'en'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* ヘッダー情報 */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                isExpired 
                  ? 'bg-rose-950 text-rose-400 border-rose-800/50' 
                  : 'bg-cyan-950 text-cyan-400 border-cyan-800/50'
              }`}>
                {isExpired ? t("受付終了") : t("受付中")}
              </span>
              {hasResponded && !isEditing && (
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded-lg text-xs font-semibold">
                  {t("回答送信完了")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {t("回答期日: ")}{formatDeadline(survey.deadline)}
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">{t(survey.title) || t('英雄スキルLv5アンケート')}</h1>
        </div>

        {hasResponded && !isEditing ? (
          <div className="space-y-6">
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <span>{t("✅ 回答が送信されました")}</span>
                </div>
                <p className="text-xs text-slate-300">
                  {t("ご回答ありがとうございます。以下の内容で登録され、メンバー情報にも反映されました。")}
                </p>
              </div>

              {!isExpired && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer"
                >
                  {t("内容を修正する")}
                </button>
              )}
            </div>

            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">
                {t("あなたの回答内容")}
              </h2>

              <div className="space-y-4 text-xs">
                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">{t("回答ゲームID")}</span>
                  <p className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</p>
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2">
                  <span className="text-slate-400 block font-semibold">{t("遠征第1スキルがLv5の英雄")}</span>
                  {savedResponse?.selected_heroes && savedResponse.selected_heroes.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {savedResponse.selected_heroes.map((hero: string) => (
                        <span key={hero} className="px-3 py-1.5 bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded-lg text-xs font-medium">
                          {t(hero)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">{t("選択なし（該当なし）")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl bg-[#151c2c] shadow-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <div className="flex items-center justify-between bg-[#0b0f19] border border-slate-800 p-4 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400">{t("回答中のゲームID: ")}</span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</span>
                </div>
                {hasResponded && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-slate-400 hover:text-white underline text-xs cursor-pointer"
                  >
                    {t("キャンセルして結果に戻る")}
                  </button>
                )}
              </div>

              {/* 英雄選択セクション */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  {t("遠征第1スキルがLv5の英雄を選択してください（複数選択可）")} <span className="text-rose-400">{t("*回答必須")}</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0b0f19] p-4 rounded-xl border border-slate-800">
                  {HERO_CONFIG.map((hero) => {
                    const isChecked = selectedHeroes.includes(hero.name);
                    return (
                      <button
                        type="button"
                        disabled={isExpired}
                        key={hero.name}
                        onClick={() => handleCheckboxChange(hero.name)}
                        className={`p-3 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition ${
                          isExpired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          isChecked
                            ? 'bg-cyan-600 border-cyan-500 text-white shadow-md'
                            : 'bg-[#151c2c] border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span>{t(hero.name)}</span>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                          isChecked ? 'bg-white text-cyan-700 border-white font-bold' : 'border-slate-500 bg-transparent'
                        }`}>
                          {isChecked ? '✓' : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!isExpired && (
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? t('保存中...') : (hasResponded ? t('回答を更新する') : t('回答を送信する'))}
                  </button>
                </div>
              )}

            </form>
          </div>
        )}

      </main>
    </div>
  );
}