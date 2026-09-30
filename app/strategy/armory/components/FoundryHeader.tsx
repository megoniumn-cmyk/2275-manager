// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

const getComingSunday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

export default function FoundryHeader({ supabase, selectedDate, setSelectedDate, onMemberRegistered }) {
  const [eventDates, setEventDates] = useState([]);
  const [newDate, setNewDate] = useState(getComingSunday());
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchEventDates();
  }, []);

  const fetchEventDates = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('title', '兵器工場戦')
      .order('order_index', { ascending: true });

    if (!error && data) {
      setEventDates(data);
      if (data.length > 0 && !selectedDate) {
        setSelectedDate(data[0].event_date);
      }
    }
  };

  const handleAddEventDate = async () => {
    const targetDate = newDate || getComingSunday();

    const { data: maxData, error: maxError } = await supabase
      .from('events')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1);

    let nextOrderIndex = 1;
    if (!maxError && maxData && maxData.length > 0) {
      nextOrderIndex = (maxData[0].order_index || 0) + 1;
    }

    const { error } = await supabase.from('events').insert([
      {
        title: '兵器工場戦',
        event_date: targetDate,
        order_index: nextOrderIndex,
      },
    ]);

    if (!error) {
      alert('イベント日を登録しました！');
      setNewDate(getComingSunday());
      fetchEventDates();
    } else {
      alert('登録エラー: ' + error.message);
    }
  };

  // テキストを手動パースしてDBに一括登録・上書きする処理
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
            originalIndex: index, // 同値の際の順序保持用
          });
        }
      });

      if (parsedMembers.length === 0) {
        alert('有効な形式のデータが見つかりませんでした。\n「アカウント名/戦力/参戦(控え)」の形式を確認してください。');
        setLoading(false);
        return;
      }

      // 戦力が高い順にソート。戦力が同じ場合は元の行が上のものを優先 (originalIndexが小さい方)
      parsedMembers.sort((a, b) => {
        if (b.power !== a.power) {
          return b.power - a.power;
        }
        return a.originalIndex - b.originalIndex;
      });

      // 1. まず該当する eventdate の既存データを確実に削除して二重登録を防ぐ
      const { error: deleteError } = await supabase
        .from('foundry_memberlist')
        .delete()
        .eq('eventdate', selectedDate);

      if (deleteError) {
        throw new Error('既存データの削除に失敗しました: ' + deleteError.message);
      }

      let recordsToInsert = [];
      parsedMembers.forEach((m, idx) => {
        const rank = idx + 1;
        // フェーズ1とフェーズ2の2レコードを作成
        recordsToInsert.push({
          eventdate: selectedDate,
          name: m.name,
          power: m.power,
          bench: m.bench,
          order_index: rank,
          phase: 1,
          building: '',
          role: '',
        });
        recordsToInsert.push({
          eventdate: selectedDate,
          name: m.name,
          power: m.power,
          bench: m.bench,
          order_index: rank,
          phase: 2,
          building: '',
          role: '',
        });
      });

      // 2. 新規データの一括登録（必要に応じて onConflict を指定してアップサート化）
      const { error: insertError } = await supabase
        .from('foundry_memberlist')
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
      <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
        🏭 兵器工場戦 管理ハブ
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
        {/* 日付選択セクション */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">📅 日付選択 (フェーズ・作戦共通)</label>
          <select
            className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-cyan-500 outline-none"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            <option value="">日付を選択してください</option>
            {eventDates.map((ev) => (
              <option key={ev.id} value={ev.event_date}>
                {ev.event_date}
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

        {/* メンバー一括登録（テキスト手動入力型）セクション */}
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
    </div>
  );
}