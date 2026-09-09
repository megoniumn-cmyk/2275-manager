'use client';

import Link from 'next/link';

export default function UnderConstructionPage({ title = "このページ" }: { title?: string }) {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-6 space-y-4">
      <div className="max-w-7xl mx-auto">
        <Link 
          href="/strategy"
          className="inline-block px-4 py-2 bg-[#151c2c] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition shadow"
        >
          ← 作戦室メニューに戻る
        </Link>
      </div>
      <div className="max-w-7xl mx-auto">
        <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-16 text-center shadow-xl space-y-3">
          <div className="text-4xl">🚧</div>
          <h2 className="text-xl font-bold text-white">現在工事中です</h2>
          <p className="text-xs text-slate-400">実装まで今しばらくお待ちください。</p>
        </div>
      </div>
    </div>
  );
}