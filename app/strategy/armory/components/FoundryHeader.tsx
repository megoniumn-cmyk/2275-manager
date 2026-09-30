// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

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

  const fileToGenerativePart = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64String,
            mimeType: file.type,
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!selectedDate) {
      alert('先にヘッダーでイベント日を選択してください。');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        alert('APIキーが設定されていません。');
        setUploading(false);
        e.target.value = '';
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      let allExtractedMembers = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imagePart = await fileToGenerativePart(file);

        const prompt = 'Extract all players name (string), power (integer), and bench (boolean) from this screenshot. Return strictly as a JSON array format like [{"name":"abc","power":123,"bench":false}] with no markdown.';

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [prompt, imagePart],
        });

        const textResponse = response.text ? response.text.trim() : '';
        const cleanJsonText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const parsedMembers = JSON.parse(cleanJsonText);
        if (Array.isArray(parsedMembers)) {
          allExtractedMembers = [...allExtractedMembers, ...parsedMembers];
        }
      }

      if (allExtractedMembers.length === 0) {
        alert('メンバー情報を検出できませんでした。');
        setUploading(false);
        e.target.value = '';
        return;
      }

      allExtractedMembers.sort((a, b) => (b.power || 0) - (a.power || 0));

      await supabase.from('foundry_memberlist').delete().eq('eventdate', selectedDate);

      let recordsToInsert = [];
      allExtractedMembers.forEach((m, idx) => {
        const rank = idx + 1;
        recordsToInsert.push({
          eventdate: selectedDate,
          name: m.name,
          power: m.power,
          bench: m.bench || false,
          order_index: rank,
          phase: 1,
          building: '',
          role: '',
        });
        recordsToInsert.push({
          eventdate: selectedDate,
          name: m.name,
          power: m.power,
          bench: m.bench || false,
          order_index: rank,
          phase: 2,
          building: '',
          role: '',
        });
      });

      const { error: insertError } = await supabase.from('foundry_memberlist').insert(recordsToInsert);

      if (insertError) {
        alert('登録エラー: ' + insertError.message);
      } else {
        alert('メンバーの解析と登録が完了しました！');
        if (onMemberRegistered) onMemberRegistered();
      }

    } catch (err) {
      console.error(err);
      alert('エラーが発生しました: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
        🏭 兵器工場戦 管理ハブ
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
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

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">👥 メンバー一括登録 (スクショ画像)</label>
          <div className="flex items-center gap-2">
            <label className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-3 text-center text-xs text-cyan-400 font-bold cursor-pointer transition">
              {uploading ? '🤖 AI解析・登録中...' : '📱 スクショ画像を選択 (複数可)'}
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