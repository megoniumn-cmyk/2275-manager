// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

const BUILDINGS_PHASE1 = [
  'スチームボイラー',
  '第1武器試験所',
  '第2武器試験所',
  '第1武器修理工場',
  '第2武器修理工場',
  '第3武器修理工場',
  '第4武器修理工場',
  '中継所',
  'フリー',
];

const ROLES = ['Leader', '1', '2', '3', '4', '5', '6', '7', '8'];

export default function InitialPlacement({ supabase, selectedDate }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (selectedDate) fetchMembers();
  }, [selectedDate]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('foundry_memberlist')
      .select('*')
      .eq('eventdate', selectedDate)
      .order('order_index', { ascending: true });

    if (!error && data) {
      setMembers(data);
    }
  };

  const handleUpdateMember = async (id, field, value) => {
    // ローカル状態を即時更新
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );

    // Supabaseに上書き保存
    await supabase
      .from('foundry_memberlist')
      .update({ [field]: value })
      .eq('id', id);
  };

  if (!selectedDate) {
    return <div className="text-slate-400 text-xs text-center p-4">ヘッダーでイベント日を選択してください。</div>;
  }

  return (
    <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      <h2 className="text-lg font-bold text-white">🪖 初期配置 (フェーズ1)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#0b0f19] text-slate-400 uppercase">
            <tr>
              <th className="p-3">名前</th>
              <th className="p-3">戦力</th>
              <th className="p-3">控え</th>
              <th className="p-3">施設</th>
              <th className="p-3">役割</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-800/40">
                <td className="p-3 font-bold text-white">{m.name}</td>
                <td className="p-3 text-cyan-400">{m.power?.toLocaleString()}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${m.bench ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {m.bench ? '控え' : '参戦'}
                  </span>
                </td>
                <td className="p-3">
                  <select
                    className="bg-[#0b0f19] border border-slate-700 rounded p-2 text-white outline-none"
                    value={m.building || 'フリー'}
                    onChange={(e) => handleUpdateMember(m.id, 'building', e.target.value)}
                  >
                    {BUILDINGS_PHASE1.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <select
                    className="bg-[#0b0f19] border border-slate-700 rounded p-2 text-white outline-none"
                    value={m.role || '1'}
                    onChange={(e) => handleUpdateMember(m.id, 'role', e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}