'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EntryListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);

      // surveys_master から取得（frost_dragon と weapon_entry のみを確実に抽出）
      const { data, error } = await supabase
        .from('surveys_master')
        .select('*')
        .or('survey_type.eq.frost_dragon,survey_type.eq.weapon_entry')
        .order('event_date', { ascending: false });

      if (error) throw error;

      // 各アイテムの survey_id として自身の id をマッピング
      const formatted = (data || []).map((item) => ({
        ...item,
        survey_id: item.id,
      }));

      setEvents(formatted);
    } catch (err) {
      console.error('一覧データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // 現在の日付と比較して未来/過去を判定
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredItems = events.filter((item) => {
    const eventDate = item.event_date || '2099-12-31';
    if (showPast) {
      return eventDate < todayStr;
    } else {
      return eventDate >= todayStr;
    }
  });

  if (loading) {
    return <div className="p-8 text-slate-400 text-xs bg-[#0b0f19] min-h-screen">読み込み中...</div>;
  }

  return (
    <div className="p-6 space-y-6 bg-[#0b0f19] min-h-screen text-slate-100">
      {/* ヘッダー・タブ切替 */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">イベントエントリー一覧</h1>
          <p className="text-xs text-slate-400 mt-1">霜竜の覇者 と 兵器リーグのエントリー管理</p>
        </div>
        <div className="flex bg-[#131b2e] p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setShowPast(false)}
            className={`px-3 py-1.5 rounded text-xs transition ${
              !showPast ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            受付中・予定
          </button>
          <button
            onClick={() => setShowPast(true)}
            className={`px-3 py-1.5 rounded text-xs transition ${
              showPast ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            過去のイベント
          </button>
        </div>
      </div>

      {/* グリッド一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 text-xs bg-[#131b2e]/40 rounded-lg border border-slate-800">
            該当するイベントはありません。
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.survey_id}
              onClick={() => router.push(`/entry/${item.survey_id}`)}
              className="bg-[#131b2e] border border-slate-800 hover:border-cyan-500/50 cursor-pointer p-4 rounded-lg transition-all duration-200 flex flex-col justify-between space-y-3 shadow-md"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded border bg-cyan-950 text-cyan-400 border-cyan-800">
                    {item.survey_type === 'frost_dragon' ? '霜竜の覇者' : '兵器リーグ'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{item.event_date || '日付未定'}</span>
                </div>
                <h2 className="text-sm font-bold text-white line-clamp-2">{item.title}</h2>
              </div>
              <div className="flex justify-end items-center pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-cyan-400 font-medium hover:underline">エントリー画面へ &rarr;</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}