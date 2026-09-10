'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// コンポーネントのインポート
import SvSHeader from './components/SvSHeader';
import TabAllianceSetting from './components/TabAllianceSetting';
import TabRiderSetting from './components/TabRiderSetting';
import TabFormationSetting from './components/TabFormationSetting';
import TabOperationConfirm from './components/TabOperationConfirm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type SvSTabType = 'alliance' | 'rider' | 'formation' | 'confirm';

export default function SvSStrategyPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [opponent, setOpponent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<SvSTabType>('alliance');
  
  // データベース関連の状態
  const [eventDates, setEventDates] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // 参加人数サマリー用
  const [summaryCounts, setSummaryCounts] = useState({
    type1: 0, // フル参加(移転込み)
    type2: 0, // フル参加(戦闘時間のみ)
    type3: 0, // 途中参加
  });

  // 1. 初回ロード時に surveys_master から survey_type = 'svs' の event_date を取得
  useEffect(() => {
    async function fetchEventDates() {
      try {
        const { data, error } = await supabase
          .from('surveys_master')
          .select('event_date')
          .eq('survey_type', 'svs')
          .order('event_date', { ascending: true });

        if (error) {
          console.error('Error fetching event dates:', error);
          return;
        }

        if (data) {
          const dates = Array.from(
            new Set(data.map((item: any) => item.event_date).filter(Boolean))
          ) as string[];
          setEventDates(dates);
        }
      } catch (err) {
        console.error('Failed to fetch event dates:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchEventDates();
  }, []);

  // 2. イベント日程を選択したときの処理（mattchingの取得 & 参加人数の集計）
  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    if (!date) {
      setOpponent('');
      setSummaryCounts({ type1: 0, type2: 0, type3: 0 });
      return;
    }

    try {
      const { data: masterDataList, error: masterError } = await supabase
        .from('surveys_master')
        .select('id, mattching')
        .eq('survey_type', 'svs')
        .eq('event_date', date);

      if (masterError) {
        console.error('Error fetching master data:', masterError);
        return;
      }

      if (masterDataList && masterDataList.length > 0) {
        const masterData = masterDataList[0];
        setOpponent(masterData.mattching || '');

        const { data: respData, error: respError } = await supabase
          .from('survey_responses_svs')
          .select('participation_type, survey_id')
          .eq('survey_id', masterData.id);

        if (respError) {
          console.error('Error fetching responses:', respError);
          return;
        }

        if (respData && respData.length > 0) {
          let t1 = 0, t2 = 0, t3 = 0;
          respData.forEach((row: any) => {
            const pType = Number(row.participation_type);
            if (pType === 1) t1++;
            if (pType === 2) t2++;
            if (pType === 3) t3++;
          });
          setSummaryCounts({ type1: t1, type2: t2, type3: t3 });
        } else {
          setSummaryCounts({ type1: 0, type2: 0, type3: 0 });
        }
      }
    } catch (err) {
      console.error('Failed to load event details:', err);
    }
  };

  // 3. 対戦相手（mattching）が変更されたときに surveys_master を更新する処理
  const handleOpponentChange = async (value: string) => {
    setOpponent(value);

    if (!selectedDate) return;

    try {
      const { error } = await supabase
        .from('surveys_master')
        .update({ mattching: value })
        .eq('survey_type', 'svs')
        .eq('event_date', selectedDate);

      if (error) {
        console.error('Failed to update mattching:', error);
      }
    } catch (err) {
      console.error('Failed to update mattching:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-6 space-y-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link 
          href="/strategy"
          className="px-4 py-2 bg-[#151c2c] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition shadow"
        >
          ← 作戦室メニューに戻る
        </Link>
        <h1 className="text-xl font-extrabold text-white tracking-tight">⚔️ SvS 作戦室管理</h1>
      </div>

      {/* --- 1. ヘッダーセクション（コンポーネント化） --- */}
      <SvSHeader
        eventDates={eventDates}
        selectedDate={selectedDate}
        opponent={opponent}
        loading={loading}
        summaryCounts={summaryCounts}
        onDateChange={handleDateChange}
        onOpponentChange={handleOpponentChange}
      />

      {/* --- 2. ボディセクション（タブ切り替え） --- */}
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-2 flex gap-2 overflow-x-auto shadow-xl">
          <button
            onClick={() => setActiveTab('alliance')}
            className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
              activeTab === 'alliance' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            📋 タブ1：ラリー・同盟設定
          </button>
          <button
            onClick={() => setActiveTab('rider')}
            className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
              activeTab === 'rider' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            🐎 タブ2：乗り手チーム設定
          </button>
          <button
            onClick={() => setActiveTab('formation')}
            className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
              activeTab === 'formation' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            🛡️ タブ3：編成設定
          </button>
          <button
            onClick={() => setActiveTab('confirm')}
            className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
              activeTab === 'confirm' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            📊 タブ4：作戦確認
          </button>
        </div>

        <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[400px]">
          {activeTab === 'alliance' && <TabAllianceSetting selectedDate={selectedDate} />}
          {activeTab === 'rider' && <TabRiderSetting selectedDate={selectedDate} />}
          {activeTab === 'formation' && <TabFormationSetting selectedDate={selectedDate} />}
          {activeTab === 'confirm' && <TabOperationConfirm selectedDate={selectedDate} />}
        </div>
      </div>
    </div>
  );
}