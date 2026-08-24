'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface EventItem {
  id: string | number;
  title: string;
  event_date: string;
  order_index?: number;
  description?: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [description, setDescription] = useState('');
  const [orderIndex, setOrderIndex] = useState<number>(0);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('order_index', { ascending: true, nullsFirst: false });

      if (error) throw error;
      if (data) setEvents(data);
    } catch (err) {
      console.error('イベント取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const { error } = await supabase.from('events').insert([
        {
          title,
          event_date: eventDate,
          description,
          order_index: Number(orderIndex) || 0,
        },
      ]);

      if (error) throw error;

      setTitle('');
      setEventDate('');
      setDescription('');
      setOrderIndex(0);
      fetchEvents();
    } catch (err) {
      console.error('イベント作成エラー:', err);
      alert('イベントの作成に失敗しました');
    }
  };

  const handleDeleteEvent = async (id: string | number) => {
    if (!window.confirm('このイベントを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      fetchEvents();
    } catch (err) {
      console.error('イベント削除エラー:', err);
      alert('イベントの削除に失敗しました');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">イベント管理</h1>
          <p className="text-xs text-slate-400 mt-1">
            過去イベントや今後のイベントの追加・削除を行います。
          </p>
        </div>

        {/* イベント新規作成フォーム */}
        <form onSubmit={handleCreateEvent} className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            ➕ 新規イベント追加
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">イベント名</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: KvK 第1回戦"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">開催日 (文字列可)</label>
              <input
                type="text"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                placeholder="例: 2026/04/01"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">並び順 (数値)</label>
              <input
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow"
              >
                追加する
              </button>
            </div>
          </div>
        </form>

        {/* イベント一覧テーブル */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 font-bold text-sm text-white">
            登録済みイベント一覧
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#1e293b] text-slate-300">
                  <th className="px-4 py-3 border-b border-slate-700 w-16 text-center">順序</th>
                  <th className="px-4 py-3 border-b border-slate-700">イベント名</th>
                  <th className="px-4 py-3 border-b border-slate-700">開催日</th>
                  <th className="px-4 py-3 border-b border-slate-700 text-center w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500">
                      読み込み中...
                    </td>
                  </tr>
                ) : events.length > 0 ? (
                  events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 text-center text-slate-400">{ev.order_index ?? 0}</td>
                      <td className="px-4 py-3 font-medium text-white">{ev.title}</td>
                      <td className="px-4 py-3 text-slate-300">{ev.event_date || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="px-3 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-[11px] transition"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500">
                      イベントが登録されていません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}