// @ts-nocheck
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// 分割したコンポーネントのインポート（パスは実際のプロジェクト構造に合わせて調整してください）
import FoundryHeader from './components/FoundryHeader';
import InitialPlacement from './components/InitialPlacement';
import Phase2Placement from './components/Phase2Placement';
import StrategyAndFormation from './components/StrategyAndFormation';
import StrategyConfirmation from './components/StrategyConfirmation';

// Supabaseクライアントの初期化（環境変数を使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function FoundryArmoryPage() {
  // ヘッダーで選択されているイベント日付を全体で共有
  const [selectedDate, setSelectedDate] = useState('');
  
  // スマホなどでの表示切り替え用タブ (placement1, placement2, strategy, confirmation)
  const [activeTab, setActiveTab] = useState('placement1');

  return (
    <main className="min-h-screen bg-[#0b0f19] text-slate-100 p-3 sm:p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 1. ヘッダーセクション（常に上部に表示） */}
        <FoundryHeader
          supabase={supabase}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />

        {/* 日付が未選択の場合のガイド */}
        {!selectedDate ? (
          <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
            <p className="text-sm font-bold text-cyan-400">⚠️ まず最初にヘッダーから日付を選択するか、イベント日を追加してください。</p>
            <p className="text-xs">日付を選択すると、各フェーズの配置や作戦を設定・確認できるようになります。</p>
          </div>
        ) : (
          <>
            {/* スマホ・PC共通のタブ切り替えメニュー */}
            <div className="flex bg-[#151c2c] border border-slate-800 p-1.5 rounded-2xl overflow-x-auto gap-1">
              <button
                onClick={() => setActiveTab('placement1')}
                className={`flex-1 min-w-[100px] py-2.5 px-3 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                  activeTab === 'placement1' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                🪖 初期配置(P1)
              </button>
              <button
                onClick={() => setActiveTab('placement2')}
                className={`flex-1 min-w-[100px] py-2.5 px-3 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                  activeTab === 'placement2' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚙️ フェーズ2以降
              </button>
              <button
                onClick={() => setActiveTab('strategy')}
                className={`flex-1 min-w-[100px] py-2.5 px-3 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                  activeTab === 'strategy' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                📝 編成・作戦編集
              </button>
              <button
                onClick={() => setActiveTab('confirmation')}
                className={`flex-1 min-w-[100px] py-2.5 px-3 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                  activeTab === 'confirmation' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                👁️ 作戦確認
              </button>
            </div>

            {/* タブに応じたコンポーネントの表示 */}
            <div className="space-y-6">
              {activeTab === 'placement1' && (
                <InitialPlacement supabase={supabase} selectedDate={selectedDate} />
              )}

              {activeTab === 'placement2' && (
                <Phase2Placement supabase={supabase} selectedDate={selectedDate} />
              )}

              {activeTab === 'strategy' && (
                <StrategyAndFormation supabase={supabase} selectedDate={selectedDate} />
              )}

              {activeTab === 'confirmation' && (
                <StrategyConfirmation supabase={supabase} selectedDate={selectedDate} />
              )}
            </div>
          </>
        )}

      </div>
    </main>
  );
}