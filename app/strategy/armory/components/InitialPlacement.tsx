// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

const BUILDINGS_PHASE1 = [
  '未選択',
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

const ROLES = ['未選択', 'Leader', '1', '2', '3', '4', '5', '6', '7', '8', '控え'];

export default function InitialPlacement({ supabase, selectedDate, refreshKey }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (selectedDate) fetchMembers();
  }, [selectedDate, refreshKey]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('foundry_memberlist')
      .select('*')
      .eq('eventdate', selectedDate)
      .eq('phase', 1)
      .order('order_index', { ascending: true });

    if (!error && data) {
      setMembers(data);
    }
  };

  const handleUpdateMember = async (id, field, value) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );

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
              <th className="p-3 text-center">控え</th>
              <th className="p-3">施設</th>
              <th className="p-3">役割</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-800/40">
                <td className="p-3">
                  <input
                    type="text"
                    className="bg-[#0b0f19] border border-slate-700 rounded px-2 py-1.5 text-white font-bold w-full outline-none focus:border-cyan-500"
                    value={m.name || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMembers((prev) =>
                        prev.map((item) => (item.id === m.id ? { ...item, name: val } : item))
                      );
                    }}
                    onBlur={(e) => handleUpdateMember(m.id, 'name', e.target.value)}
                  />
                </td>

                <td className="p-3">
                  <input
                    type="number"
                    className="bg-[#0b0f19] border border-slate-700 rounded px-2 py-1.5 text-cyan-400 font-bold w-28 outline-none focus:border-cyan-500"
                    value={m.power ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setMembers((prev) =>
                        prev.map((item) => (item.id === m.id ? { ...item, power: val } : item))
                      );
                    }}
                    onBlur={(e) => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      handleUpdateMember(m.id, 'power', val);
                    }}
                  />
                </td>

                <td className="p-3 text-center">
                  <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded cursor-pointer transition ${
                    m.bench ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}>
                    <input
                      type="checkbox"
                      className="rounded accent-cyan-500 cursor-pointer"
                      checked={Boolean(m.bench)}
                      onChange={(e) => handleUpdateMember(m.id, 'bench', e.target.checked)}
                    />
                    <span className="font-bold text-[10px]">{m.bench ? '控え' : '参戦'}</span>
                  </label>
                </td>

                <td className="p-3">
                  <select
                    className="bg-[#0b0f19] border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500"
                    value={m.building || '未選択'}
                    onChange={(e) => handleUpdateMember(m.id, 'building', e.target.value)}
                  >
                    {BUILDINGS_PHASE1.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </td>

                <td className="p-3">
                  <select
                    className="bg-[#0b0f19] border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500"
                    value={m.role || '未選択'}
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