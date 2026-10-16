'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ReportFormProps {
  initialData?: {
    id?: string;
    rawText: string;
    reportDate: string;
    bluePlayerName: string;
    redPlayerName: string;
  };
  isEdit?: boolean;
}

export default function ReportForm({ initialData, isEdit = false }: ReportFormProps) {
  const router = useRouter();
  const [rawText, setRawText] = useState(initialData?.rawText || '');
  const [reportDate, setReportDate] = useState(initialData?.reportDate || '');
  const [bluePlayerName, setBluePlayerName] = useState(initialData?.bluePlayerName || '');
  const [redPlayerName, setRedPlayerName] = useState(initialData?.redPlayerName || '');

  // 簡易パース機能（テキストエリアに入力された内容からプレイヤー名や日付をざっくり抽出する例）
  const handleParseText = (text: string) => {
    setRawText(text);
    // サンプルとして簡易的な自動抽出ロジック（必要に応じてフォーマットに合わせて調整可能）
    const dateMatch = text.match(/-レポート日時：([^\n]+)/);
    if (dateMatch) setReportDate(dateMatch[1].trim());

    const blueMatch = text.match(/- 左側プレイヤー（青陣営）[\s\S]*?- アカウント名:\s*([^\n]+)/);
    if (blueMatch) setBluePlayerName(blueMatch[1].trim());

    const redMatch = text.match(/- 右側プレイヤー（赤陣営）[\s\S]*?- アカウント名:\s*([^\n]+)/);
    if (redMatch) setRedPlayerName(redMatch[1].trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reports = JSON.parse(localStorage.getItem('temp_reports') || '[]');

    if (isEdit && initialData?.id) {
      // 編集保存
      const updatedReports = reports.map((rep: any) => 
        rep.id === initialData.id 
          ? { ...rep, rawText, reportDate, bluePlayerName, redPlayerName, updatedAt: new Date().toISOString() }
          : rep
      );
      localStorage.setItem('temp_reports', JSON.stringify(updatedReports));
      alert('レポートを更新しました！');
    } else {
      // 新規登録・一時保存
      const newReport = {
        id: Date.now().toString(),
        rawText,
        reportDate: reportDate || new Date().toISOString().split('T')[0],
        bluePlayerName: bluePlayerName || '左側プレイヤー',
        redPlayerName: redPlayerName || '右側プレイヤー',
        createdAt: new Date().toISOString(),
      };
      reports.push(newReport);
      localStorage.setItem('temp_reports', JSON.stringify(reports));
      alert('レポートを一時保存しました！');
    }

    router.push('/strategy/reports');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* スクショ自動解析・テキスト一括貼付エリア */}
      <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
        <h2 className="text-sm font-semibold mb-2 text-cyan-400">スクショ自動解析 / テキスト一括貼付</h2>
        <p className="text-xs text-gray-400 mb-2">
          指定されたプロンプトで出力されたコードブロック内のテキストを以下に貼り付けてください。
        </p>
        <textarea
          className="w-full h-48 bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-cyan-500"
          placeholder="【出力フォーマット】に沿ったテキストをここに貼り付け..."
          value={rawText}
          onChange={(e) => handleParseText(e.target.value)}
          required
        />
      </div>

      {/* 解析・抽出されたデータの確認・修正プレビューエリア */}
      <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">レポート日時</label>
          <input
            type="text"
            className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-200"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            placeholder="例: 2026-10-05 12:00"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-blue-400 mb-1">左側プレイヤー（青陣営）</label>
          <input
            type="text"
            className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-200"
            value={bluePlayerName}
            onChange={(e) => setBluePlayerName(e.target.value)}
            placeholder="アカウント名"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-red-400 mb-1">右側プレイヤー（赤陣営）</label>
          <input
            type="text"
            className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-200"
            value={redPlayerName}
            onChange={(e) => setRedPlayerName(e.target.value)}
            placeholder="アカウント名"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded text-sm font-medium transition"
        >
          {isEdit ? '変更を保存する' : '一時保存して一覧へ'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/strategy/reports')}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded text-sm transition"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}