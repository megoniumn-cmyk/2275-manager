'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import FrostDragonView from './components/FrostDragonView';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EventDetailRouter() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [loading, setLoading] = useState(true);
  const [surveyData, setSurveyData] = useState<any>(null);

  useEffect(() => {
    if (eventId) {
      fetchSurveyMaster();
    }
  }, [eventId]);

  const fetchSurveyMaster = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('surveys_master')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      setSurveyData(data);
    } catch (err) {
      console.error('イベント情報取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 text-xs bg-[#0b0f19] min-h-screen">読み込み中...</div>;
  }

  const surveyType = surveyData?.survey_type || 'default';

  return (
    <div className="bg-[#0b0f19] min-h-screen text-slate-100 p-6 space-y-6">
      {/* 共通ヘッダー */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <button 
            onClick={() => router.push('/entry')} 
            className="text-xs text-cyan-400 hover:underline mb-1 block"
          >
            &larr; 一覧に戻る
          </button>
          <h1 className="text-xl font-bold text-white">{surveyData?.title || 'イベント詳細'}</h1>
          <p className="text-xs text-slate-400 mt-1">
            開催日: {surveyData?.event_date || '未設定'} / タイプ: {surveyType}
          </p>
        </div>
      </div>

      {/* イベントタイプに応じた表示切り替え */}
      <div>
        {surveyType === 'frost_dragon' ? (
          <FrostDragonView eventId={eventId} surveyData={surveyData} />
        ) : surveyType === 'weapon_entry' ? (
          <div className="p-6 bg-[#131b2e] rounded-lg border border-slate-800 text-xs text-cyan-400">
            【兵器リーグ (weapon_entry) 用のエントリー画面をここに実装します】
          </div>
        ) : (
          <div className="p-6 bg-[#131b2e] rounded-lg border border-slate-800 text-xs text-slate-400">
            未対応のイベントタイプです (Type: {surveyType})
          </div>
        )}
      </div>
    </div>
  );
}