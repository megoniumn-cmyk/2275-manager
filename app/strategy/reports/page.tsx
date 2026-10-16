'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Report {
  id: string;
  reportDate: string;
  bluePlayerName: string;
  redPlayerName: string;
  rawText: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('temp_reports');
    if (saved) {
      setReports(JSON.parse(saved));
    }
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('このレポートを削除しますか？')) {
      const filtered = reports.filter((r) => r.id !== id);
      setReports(filtered);
      localStorage.setItem('temp_reports', JSON.stringify(filtered));
    }
  };

  return (
    <div className="p-6 text-white bg-gray-950 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">兵種別ステータス・複数兵士アナライザー</h1>
          <p className="text-xs text-gray-400 mt-1">ホーム / 戦闘レポート管理</p>
        </div>
        <Link
          href="/strategy/reports/new"
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-sm font-medium transition"
        >
          ＋ レポートを新規登録
        </Link>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h2 className="text-sm font-semibold mb-4 text-gray-300">登録済み戦闘レポート一覧</h2>
        {reports.length === 0 ? (
          <p className="text-xs text-gray-500 py-8 text-center">登録されたレポートはありません。</p>
        ) : (
          <div className="space-y-3">
            {reports.map((rep) => (
              <div key={rep.id} className="p-4 bg-gray-950 rounded border border-gray-800 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 text-xs text-cyan-400 mb-1">
                    <span>日時: {rep.reportDate || '未設定'}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-200">
                    <span className="text-blue-400">{rep.bluePlayerName || '青陣営'}</span>
                    <span className="mx-2 text-gray-500">vs</span>
                    <span className="text-red-400">{rep.redPlayerName || '赤陣営'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/strategy/reports/${rep.id}/edit`}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded text-xs transition"
                  >
                    修正
                  </Link>
                  <button
                    onClick={() => handleDelete(rep.id)}
                    className="bg-red-950/50 hover:bg-red-900/60 text-red-400 px-3 py-1.5 rounded text-xs transition border border-red-900/50"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}