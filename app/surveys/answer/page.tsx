'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

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
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSurveysAndUser = async () => {
      try {
        const savedGameId = localStorage.getItem('logged_in_game_id');
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUser = session?.user || null;

        let profileData = null;

        // 1. プロファイル情報の取得（ホームページのロジックを踏襲）
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

        // 2. リーダー権限（members テーブルの leader フラグ）の判定
        let isUserLeader = false;
        const { data: memberData } = await supabase
          .from('members')
          .select('leader')
          .eq('game_id', profileData.game_id)
          .maybeSingle();

        if (memberData && memberData.leader === true) {
          isUserLeader = true;
        }

        // 3. 期限前のアンケートをすべて取得
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
          // ▼ 英雄スキルのアンケートで、リーダー（leader === true）の場合は除外
          if (survey.survey_type === 'hero_skill' && isUserLeader) {
            continue;
          }

          // その他の target_restriction によるリーダー除外判定があればここでもケア
          if (survey.target_restriction === 'non_leader_only' && isUserLeader) {
            continue;
          }

          const tableName = getAnswerTableName(survey.survey_type);
          let hasAnswered = false;

          // 回答済みかどうかのチェック
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
        console.error('アンケート一覧の取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSurveysAndUser();
  }, []);

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

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col">
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* ヘッダーセクション */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">アンケート一覧</h1>
            <p className="text-xs text-slate-400 mt-1">回答期限内のアンケート一覧です。回答済み・未回答の確認や再回答が行えます。</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
          >
            ← ホームに戻る
          </Link>
        </div>

        {/* 一覧表示セクション */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">読み込み中...</div>
        ) : surveys.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-[#151c2c]/50 rounded-2xl border border-slate-800">
            現在、回答可能なアンケートはありません。
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
                        回答済み
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/50 rounded-md text-[10px] font-semibold animate-pulse">
                        未回答
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      期限: {formatDeadline(survey.deadline)}
                    </span>
                    {survey.match_time && (
                      <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 rounded-md text-[10px]">
                        対戦時間: {survey.match_time}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-white">{survey.title}</h2>
                </div>

                <Link
                  href={getAnswerUrl(survey.survey_type, survey.id)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition shadow shrink-0 ${
                    survey.hasAnswered
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {survey.hasAnswered ? '回答を変更・確認する →' : '回答する →'}
                </Link>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}