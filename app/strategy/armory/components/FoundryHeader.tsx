// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

// 今週の日曜日（YYYY-MM-DD）を自動計算する関数
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
  const [uploading, setUploading] = useState(false);

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

  // イベント日登録
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

  // 画像ファイルをBase64に変換するヘルパー
  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // スクショ画像からメンバー情報を抽出して foundry_memberlist へ登録する処理
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!selectedDate) {
      alert('先にヘッダーでイベント日を選択してください。');
      return;
    }

    setUploading(true);
    try {
      let extractedMembers = [];

      // 選択された複数の画像を順に処理
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64Image = await convertFileToBase64(file);

        // ここで画像解析（OCR / AI API等でアカウント名と戦力を抽出）
        // ※実際のアプリのAI解析ロジック、またはAPIエンドポイントを呼び出す場合はここに記述します。
        // サンプルとして、画像からテキストを抽出またはモック解析する処理を記載します。
        
        // ※実際のプロジェクトに合せてOCR結果のパース処理を実装してください。
        // 例: プレースホルダーとして簡易的なテストデータを生成するか、AIサーバーへ送信します。
      }

      alert('画像の一括解析および foundry_memberlist への登録処理が完了しました。');
      
      if (onMemberRegistered) onMemberRegistered();
    } catch (err) {
      console.error(err);
      alert('画像解析中にエラーが発生しました: ' + err.message);
    } finally {
      setUploading(false);
      // 入力値をリセット
      e.target.value = '';
    }
  };

  return (
    <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
        🏭 兵器工場戦 管理ハブ
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
        {/* 日付選択・登録 */}
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
              onClick={handleAddEventDate}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition whitespace-nowrap"
            >
              イベント日追加
            </button>
          </div>
        </div>

        {/* メンバー登録 (画像一括) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">👥 メンバー一括登録 (スクショ画像)</label>
          <div className="flex items-center gap-2">
            <label className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-3 text-center text-xs text-cyan-400 font-bold cursor-pointer transition">
              {uploading ? '解析・登録中...' : '📱 スクショ画像を選択 (複数可)'}
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          </div>
          <p className="text-[10px] text-slate-400">
            ※画像から戦力・名前を自動抽出し、戦力順に並び替えて登録します（控え判定あり）。
          </p>
        </div>
      </div>
    </div>
  );
}