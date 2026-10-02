// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const getComingSaturday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

export default function Header({ selectedDate, setSelectedDate, onMemberRegistered, fetchEvents, events = [] }) {
  const [newDate, setNewDate] = useState(getComingSaturday());
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  // コマンド用モーダル・コピー状態のステート
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const commandText = `添付の画像に含まれるメンバー情報を整理してください。

【出力条件】
- フォーマット：アカウント名/戦力/参戦(控え)
- 戦力：コンマなしの数値のみ
- 並び順：戦力（名前の下の数字）が高い順（降順）
- 表示形式：一括でコピーしやすいよう、テキストボックス（コードブロック）にまとめる`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(commandText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddEventDate = async () => {
    const targetDate = newDate || getComingSaturday();

    // order_index の最大値を取得
    const { data: maxData, error: maxError } = await supabase
      .from('events')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1);

    let nextOrderIndex = 1;
    if (!maxError && maxData && maxData.length > 0) {
      nextOrderIndex = (maxData[0].order_index || 0) + 1;
    }

    // event_date カラムへ保存
    const { error } = await supabase.from('events').insert([
      {
        title: '峡谷合戦',
        event_date: targetDate,
        order_index: nextOrderIndex,
      },
    ]);

    if (!error) {
      alert('イベント日を登録しました！');
      setNewDate(getComingSaturday());
      if (fetchEvents) fetchEvents();
    } else {
      alert('登録エラー: ' + error.message);
    }
  };

  // テキストを手動パースして cc_memberlist に一括登録・上書きする処理
  const handleTextImport = async () => {
    if (!selectedDate) {
      alert('先にヘッダーでイベント日を選択してください。');
      return;
    }
    if (!textInput.trim()) {
      alert('メンバー情報のテキストを入力してください。');
      return;
    }

    setLoading(true);
    try {
      const lines = textInput.trim().split('\n');
      let parsedMembers = [];

      lines.forEach((line, index) => {
        const parts = line.split('/');
        if (parts.length >= 3) {
          const name = parts[0].trim();
          const power = parseInt(parts[1].trim(), 10) || 0;
          const statusText = parts[2].trim();
          const bench = statusText.includes('控え');

          parsedMembers.push({
            name,
            power,
            bench,
            originalIndex: index,
          });
        }
      });

      if (parsedMembers.length === 0) {
        alert('有効な形式のデータが見つかりませんでした。\n「アカウント名/戦力/参戦(控え)」の形式を確認してください。');
        setLoading(false);
        return;
      }

      // 「参戦」を先、「控え」を後にし、それぞれのグループ内で戦力が高い順にソート
      parsedMembers.sort((a, b) => {
        if (a.bench !== b.bench) {
          return a.bench ? 1 : -1;
        }
        if (a.power !== b.power) {
          return b.power - a.power;
        }
        return a.originalIndex - b.originalIndex;
      });

      // 1. 該当する event_date の既存データを削除して二重登録を防ぐ
      const { error: deleteError } = await supabase
        .from('cc_memberlist')
        .delete()
        .eq('eventdate', selectedDate);

      if (deleteError) {
        throw new Error('既存データの削除に失敗しました: ' + deleteError.message);
      }

      let recordsToInsert = [];
      parsedMembers.forEach((m, idx) => {
        const rank = idx + 1;
        recordsToInsert.push({
          eventdate: selectedDate,
          name: m.name,
          power: m.power,
          bench: m.bench,
          order_index: rank,
        });
      });

      // 2. 新規データの一括登録
      const { error: insertError } = await supabase
        .from('cc_memberlist')
        .insert(recordsToInsert);

      if (insertError) {
        alert('登録エラー: ' + insertError.message);
      } else {
        alert(`成功！ ${parsedMembers.length}名のメンバーを登録・上書きしました。`);
        setTextInput('');
        setShowModal(false);
        if (onMemberRegistered) onMemberRegistered();
      }

    } catch (err) {
      console.error(err);
      alert('エラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          🛡️ 峡谷合戦 管理ダッシュボード
        </h1>

        <button
          type="button"
          onClick={() => setShowCommandModal(true)}
          className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
        >
          <span>🤖</span> メンバーリスト作成用コマンド
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
        {/* 日付選択セクション */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">📅 日付選択 (峡谷合戦)</label>
          <select
            className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-cyan-500 outline-none"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            <option value="">日付を選択してください</option>
            {events?.map((ev) => (
              <option key={ev.id} value={ev.event_date}>
                {ev.event_date} {ev.start ? ` (スタート: ${ev.start})` : ''}
              </option>
            ))}
          </select>

          <div className="flex gap-2 pt-2">
            <input
              type="date"
              className="bg-[#0b0f19] border border-slate-700 rounded-xl p-2 text-sm text-white outline-none flex-1"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
            <button
              type="button"
              onClick={handleAddEventDate}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition whitespace-nowrap"
            >
              イベント日追加
            </button>
          </div>
        </div>

        {/* メンバー一括登録セクション */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">👥 メンバー一括登録 (テキスト入力)</label>
          <div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-3 text-center text-xs text-cyan-400 font-bold cursor-pointer transition shadow-sm"
            >
              📝 テキストデータから一括登録を開く
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            ※AIで作成した「名前/戦力/参戦(控え)」のテキストを貼り付けて一括登録できます。
          </p>
        </div>
      </div>

      {/* テキスト入力モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#151c2c] border border-slate-700 rounded-2xl p-6 w-full max-w-xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">📝 メンバーテキスト一括登録</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              以下の形式（<code>アカウント名/戦力/参戦(控え)</code>）で改行区切りで貼り付けてください。再登録時は既存データが上書きされます。
            </p>

            <textarea
              className="w-full h-48 bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-500 font-mono"
              placeholder={`Han J/21103/参戦\nMON/21085/参戦\nぶーたろう@∵/9261/控え`}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleTextImport}
                disabled={loading}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-5 py-2 rounded-xl transition disabled:opacity-50"
              >
                {loading ? '登録中...' : '登録を実行する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メンバーリスト作成用コマンドモーダル */}
      {showCommandModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <span>📋</span> メンバーリスト作成用コマンド
              </h3>
              <button
                onClick={() => setShowCommandModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              作成方法：AIに参戦メンバーのスクショと下記のコマンドを送信してください。
            </p>

            <div className="bg-[#0b0f19] border border-slate-800 p-3 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap select-all leading-relaxed max-h-48 overflow-y-auto">
              {commandText}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleCopyCommand}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg w-full sm:w-auto"
              >
                {copied ? '✨ コピーしました！' : '📋 コマンドをコピーする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}