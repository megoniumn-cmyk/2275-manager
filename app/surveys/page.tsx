'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type SurveyMaster = {
  id: string;
  survey_type: string;
  title: string;
  event_date: string | null;
  deadline: string;
  status: string;
  match_time?: string;
  created_at?: string;
};

export default function SurveysHubPage() {
  const [surveys, setSurveys] = useState<SurveyMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPastSurveys, setShowPastSurveys] = useState<boolean>(false);

  // 登録されているアンケート一覧を取得（作成日時の降順）
  useEffect(() => {
    async function fetchSurveys() {
      try {
        const { data, error } = await supabase
          .from('surveys_master')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) setSurveys(data);
      } catch (err) {
        console.error('アンケート一覧の取得に失敗しました:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSurveys();
  }, []);

  const formatDeadline = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  };

  // アンケートの種類に応じて適切な回答画面のパスを返す関数
  const getAnswerUrl = (surveyType: string, surveyId: string) => {
    switch (surveyType) {
      case 'weapon_schedule':
        return `/surveys/answer/tal_schedule/${surveyId}`;
      case 'weapon_entry':
        return `/surveys/answer/tal_entry/${surveyId}`;
      case 'svs':
        return `/surveys/answer/svs/${surveyId}`;
      case 'frost_dragon':
        return `/surveys/answer/ftd/${surveyId}`;
      case 'hero_skill':
        return `/surveys/answer/hero_skill/${surveyId}`;
      default:
        return `/surveys/answer/${surveyId}`;
    }
  };

  // アンケートの種類に応じて適切な結果確認画面のパスを返す関数
  const getResultUrl = (surveyType: string, surveyId: string) => {
    switch (surveyType) {
      case 'weapon_schedule':
        return `/surveys/result/tal_schedule/${surveyId}`;
      case 'weapon_entry':
        return `/surveys/result/tal_entry/${surveyId}`;
      case 'svs':
        return `/surveys/result/svs/${surveyId}`;
      case 'frost_dragon':
        return `/surveys/result/ftd/${surveyId}`;
      case 'hero_skill':
        return `/surveys/result/hero_skill/${surveyId}`;
      default:
        return `/surveys/result/${surveyId}`;
    }
  };

  // 現在日時
  const now = new Date();

  // --- 英雄アンケート（hero_skill）の中で最新のものを特定する ---
  const heroSurveys = surveys.filter((s) => s.survey_type === 'hero_skill');
  const latestHeroSurveyId = heroSurveys.length > 0 ? heroSurveys[0].id : null;

  // 各アンケートを表示すべきかどうかを判定
  const filteredSurveys = surveys.filter((survey) => {
    if (survey.survey_type === 'hero_skill') {
      if (survey.id === latestHeroSurveyId) {
        return true;
      } else {
        return showPastSurveys;
      }
    }

    if (!survey.event_date) return true;
    const eventDate = new Date(survey.event_date);
    const isFuture = eventDate >= now;

    if (isFuture) {
      return true;
    } else {
      return showPastSurveys;
    }
  });

  const pastSurveysCount = surveys.filter((survey) => {
    if (survey.survey_type === 'hero_skill') {
      return survey.id !== latestHeroSurveyId;
    } else {
      if (!survey.event_date) return false;
      return new Date(survey.event_date) < now;
    }
  }).length;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1200px] mx-auto p-6 w-full space-y-6 flex flex-col">
        
        {/* ヘッダーカード */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">📊 アンケート管理ハブ</h1>
            <p className="text-sm text-slate-400 mt-1">新規アンケートの作成や、各アンケートの結果確認を行えます。</p>
          </div>
          <Link
            href="/surveys/new"
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition shadow cursor-pointer flex items-center gap-2"
          >
            <span>➕ 新規アンケート作成</span>
          </Link>
        </div>

        {/* 作成済みアンケート一覧セクション */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-200">
              📋 作成済みアンケート一覧（結果確認）
            </h2>

            {pastSurveysCount > 0 && (
              <button
                type="button"
                onClick={() => setShowPastSurveys(!showPastSurveys)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                <span>{showPastSurveys ? '📁 過去分の表示を隠す' : `📁 過去分を表示する (${pastSurveysCount}件)`}</span>
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 py-6 text-center">読み込み中...</p>
          ) : filteredSurveys.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-xs text-slate-400">
                {surveys.length === 0 ? '作成されたアンケートはまだありません。' : '条件に一致するアンケートはありません。'}
              </p>
              {surveys.length === 0 && (
                <Link
                  href="/surveys/new"
                  className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-medium transition"
                >
                  最初のアンケートを作成する
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredSurveys.map((survey) => {
                const isExpired = new Date() > new Date(survey.deadline);
                const answerUrl = getAnswerUrl(survey.survey_type, survey.id);
                const resultUrl = getResultUrl(survey.survey_type, survey.id); // ← 追加・修正

                return (
                  <div
                    key={survey.id}
                    className="bg-[#0b0f19] border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          isExpired 
                            ? 'bg-rose-950 text-rose-400 border-rose-800/50' 
                            : 'bg-cyan-950 text-cyan-400 border-cyan-800/50'
                        }`}>
                          {isExpired ? '受付終了' : '受付中'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          期日: {formatDeadline(survey.deadline)}
                        </span>
                        {survey.event_date && (
                          <span className="text-[11px] text-slate-400">
                            イベント日: {survey.event_date.split('T')[0]}
                          </span>
                        )}
                        {survey.match_time && (
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                            対戦時間: {survey.match_time}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white">{survey.title}</h3>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {/* 種類別のフォルダ構成に合わせた回答画面へのリンク */}
                      <Link
                        href={answerUrl}
                        target="_blank"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                      >
                        回答画面 🔗
                      </Link>
                      
                      {/* 種類別のフォルダ構成に合わせた結果確認画面へのリンク */}
                      <Link
                        href={resultUrl}
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
                      >
                        結果を確認する
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}