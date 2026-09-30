// @ts-nocheck
'use client';

import Link from 'next/link';

export default function StrategyParentPage() {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-6">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">🛡️ 作戦室・戦略ハブ</h1>
          <p className="text-xs text-slate-400">同盟の戦略管理や戦闘データの検証を行う各セクションへアクセスします。</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SvSへ */}
          <Link 
            href="/strategy/svs"
            className="bg-[#151c2c] hover:bg-[#1b253b] border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl shadow-xl transition cursor-pointer space-y-3 group block"
          >
            <div className="text-2xl">⚔️</div>
            <h2 className="text-base font-bold text-white group-hover:text-cyan-400 transition">SvS</h2>
            <p className="text-xs text-slate-400">SvSに関する戦略や準備の管理を行います。</p>
          </Link>

          {/* 霜竜の覇者へ */}
          <Link 
            href="/strategy/ftd"
            className="bg-[#151c2c] hover:bg-[#1b253b] border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl shadow-xl transition cursor-pointer space-y-3 group block"
          >
            <div className="text-2xl">🐉</div>
            <h2 className="text-base font-bold text-white group-hover:text-cyan-400 transition">霜竜の覇者</h2>
            <p className="text-xs text-slate-400">霜竜の覇者に関する戦略や配置を確認します。</p>
          </Link>

          {/* 雪原兵器リーグへ */}
          <Link 
            href="/strategy/tal"
            className="bg-[#151c2c] hover:bg-[#1b253b] border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl shadow-xl transition cursor-pointer space-y-3 group block"
          >
            <div className="text-2xl">🛡️</div>
            <h2 className="text-base font-bold text-white group-hover:text-cyan-400 transition">雪原兵器リーグ</h2>
            <p className="text-xs text-slate-400">雪原兵器リーグの編成や対策を管理します。</p>
          </Link>

          {/* 峡谷合戦へ (新規追加) */}
          <Link 
            href="/strategy/canyon"
            className="bg-[#151c2c] hover:bg-[#1b253b] border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl shadow-xl transition cursor-pointer space-y-3 group block"
          >
            <div className="text-2xl">🏔️</div>
            <h2 className="text-base font-bold text-white group-hover:text-cyan-400 transition">峡谷合戦</h2>
            <p className="text-xs text-slate-400">峡谷合戦の参戦管理や部隊編成、作戦プランの確認を行います。</p>
          </Link>

          {/* 兵器工場戦へ (新規追加) */}
          <Link 
            href="/strategy/armory"
            className="bg-[#151c2c] hover:bg-[#1b253b] border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl shadow-xl transition cursor-pointer space-y-3 group block"
          >
            <div className="text-2xl">🏭</div>
            <h2 className="text-base font-bold text-white group-hover:text-cyan-400 transition">兵器工場戦</h2>
            <p className="text-xs text-slate-400">兵器工場戦の占領スケジュールやチーム割当、戦術の管理。</p>
          </Link>

          {/* イベント履歴・予想へ (新規追加) */}
          <Link 
            href="/strategy/events"
            className="bg-[#151c2c] hover:bg-[#1b253b] border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl shadow-xl transition cursor-pointer space-y-3 group block"
          >
            <div className="text-2xl">📅</div>
            <h2 className="text-base font-bold text-white group-hover:text-cyan-400 transition">イベント履歴・予想</h2>
            <p className="text-xs text-slate-400">過去のイベント履歴の確認や、今後のスケジュール・マッチング予想。</p>
          </Link>

          {/* 検証データへ */}
          <Link 
            href="/strategy/reports"
            className="bg-[#151c2c] hover:bg-[#1b253b] border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl shadow-xl transition cursor-pointer space-y-3 group block sm:col-span-2"
          >
            <div className="text-2xl">📊</div>
            <h2 className="text-base font-bold text-white group-hover:text-cyan-400 transition">検証データ</h2>
            <p className="text-xs text-slate-400">兵種別ステータスや複数兵士アナライザー、戦闘レポートの登録・閲覧。</p>
          </Link>
        </div>
      </div>
    </div>
  );
}