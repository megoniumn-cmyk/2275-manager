'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function FtdResultPage() {
  const params = useParams();
  const id = params?.id;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-8 shadow-xl max-w-md w-full text-center space-y-4">
        <h1 className="text-lg font-bold text-white">FTD結果画面 (準備中)</h1>
        <p className="text-xs text-slate-400">ID: {id}</p>
        <p className="text-xs text-slate-400">このページの機能は現在実装中です。</p>
        <div className="pt-2">
          <Link
            href="/surveys"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition inline-block"
          >
            ← ハブに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}