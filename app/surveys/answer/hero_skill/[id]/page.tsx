'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';

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

// 英雄リストとmembersテーブルの対応マッピング
const HERO_CONFIG: { name: string; column: string }[] = [
  { name: 'ヘンドリック', column: 'hero_hendrik' },
  { name: 'ガト', column: 'hero_gatto' },
  { name: 'ゴードン', column: 'hero_gordon' },
  { name: '無名', column: 'hero_muming' },
  { name: 'レネ', column: 'hero_renee' },
  { name: 'ノラ', column: 'hero_norah' },
  { name: 'ミア', column: 'hero_mia' },
  { name: 'フレンダー', column: 'hero_phily' },
  { name: 'ジンマン', column: 'hero_zinman' },
  { name: 'フレッド', column: 'hero_fred' },
];

export default function HeroSkillSurveyAnswerPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const [hasResponded, setHasResponded] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // 選択された英雄名の配列
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [savedResponse, setSavedResponse] = useState<any>(null);

  useEffect(() => {
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

        // 既存回答の取得（survey_responses_hero_skill からスナップショットを取得）
        const { data: responseData } = await supabase
          .from('survey_responses_hero_skill')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('game_id', currentLoginGameId)
          .single();

        if (responseData) {
          // 2回目以降（すでに回答済みの場合）
          setHasResponded(true);
          setSavedResponse(responseData);

          if (responseData.selected_heroes && Array.isArray(responseData.selected_heroes)) {
            setSelectedHeroes(responseData.selected_heroes);
          }
        } else {
          // 初回回答の場合：membersテーブルのカラムが true または 'true' になっている英雄を初期選択にする
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
      alert('受付期限が終了しているため、回答・修正はできません。');
      return;
    }

    if (!member?.game_id) {
      alert('ログイン中のゲームIDが取得できませんでした。');
      return;
    }

    setSubmitting(true);
    try {
      // 1. survey_responses_hero_skill へスナップショットとして保存（UPSERT）
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

      // 2. members テーブルの対応する英雄カラムへ反映（text型に合わせて文字列の 'true' / 'false' または boolean で保存）
      const memberUpdatePayload: Record<string, any> = {};
      HERO_CONFIG.forEach((hero) => {
        const isSelected = selectedHeroes.includes(hero.name);
        // DBがtext型の場合は文字列で入れるか、booleanで入れても動くよう設定
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">アンケートが見つかりませんでした。</p>
      </div>
    );
  }

  // 期限のフォーマット表示用 (mm/dd hh:mm)
  const formatDeadline = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1000px] mx-auto p-6 w-full space-y-6 flex flex-col">
        
        {/* ヘッダー情報 */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                isExpired 
                  ? 'bg-rose-950 text-rose-400 border-rose-800/50' 
                  : 'bg-cyan-950 text-cyan-400 border-cyan-800/50'
              }`}>
                {isExpired ? '受付終了' : '受付中'}
              </span>
              {hasResponded && !isEditing && (
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded-lg text-xs font-semibold">
                  回答送信完了
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">
              回答期日: {formatDeadline(survey.deadline)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">{survey.title || '英雄スキルLv5アンケート'}</h1>
        </div>

        {hasResponded && !isEditing ? (
          <div className="space-y-6">
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <span>✅ 回答が送信されました</span>
                </div>
                <p className="text-xs text-slate-300">
                  ご回答ありがとうございます。以下の内容で登録され、メンバー情報にも反映されました。
                </p>
              </div>

              {!isExpired && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer"
                >
                  内容を修正する
                </button>
              )}
            </div>

            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">
                あなたの回答内容
              </h2>

              <div className="space-y-4 text-xs">
                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">回答ゲームID</span>
                  <p className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</p>
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2">
                  <span className="text-slate-400 block font-semibold">遠征第1スキルがLv5の英雄</span>
                  {savedResponse?.selected_heroes && savedResponse.selected_heroes.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {savedResponse.selected_heroes.map((hero: string) => (
                        <span key={hero} className="px-3 py-1.5 bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded-lg text-xs font-medium">
                          {hero}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">選択なし（該当なし）</p>
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
                  <span className="text-slate-400">回答中のゲームID: </span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</span>
                </div>
                {hasResponded && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-slate-400 hover:text-white underline text-xs cursor-pointer"
                  >
                    キャンセルして結果に戻る
                  </button>
                )}
              </div>

              {/* 英雄選択セクション */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  遠征第1スキルがLv5の英雄を選択してください（複数選択可） <span className="text-rose-400">*回答必須</span>
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
                        <span>{hero.name}</span>
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
                    {submitting ? '保存中...' : (hasResponded ? '回答を更新する' : '回答を送信する')}
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