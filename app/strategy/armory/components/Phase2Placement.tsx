// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

const BUILDINGS_PHASE2 = [
  '未選択',
  'スチームボイラー',
  '第1武器試験所',
  '第2武器試験所',
  '第1武器修理工場',
  '第2武器修理工場',
  '第3武器修理工場',
  '第4武器修理工場',
  '中継所',
  '王室兵器工場',
  '兵器倉庫',
  '野営地',
  'フリー',
  '武器工房(左上)',
  '武器工房(左下)',
  '武器工房(右上)',
  '武器工房(右下)',
];

const ROLES_PHASE2 = ['未選択', 'Leader', '武器工房', '1', '2', '3', '4', '5', '6', '7', '8', '控え'];

export default function Phase2Placement({ supabase, selectedDate, refreshKey }) {
  const [phase2Members, setPhase2Members] = useState([]);

  useEffect(() => {
    if (selectedDate) fetchPhase2Members();
  }, [selectedDate, refreshKey]);

  const fetchPhase2Members = async () => {
    const { data, error } = await supabase
      .from('foundry_memberlist')
      .select('*')
      .eq('eventdate', selectedDate)
      .eq('phase', 2)
      .order('order_index', { ascending: true });

    if (!error && data) {
      setPhase2Members(data);
    }
  };

  const handleImportPhase1 = async () => {
    if (!confirm('フェーズ1の配置データを読み込んでフェーズ2用データを生成しますか？')) return;

    const { data: phase1Data, error: err1 } = await supabase
      .from('foundry_memberlist')
      .select('*')
      .eq('eventdate', selectedDate)
      .eq('phase', 1);

    if (err1 || !phase1Data || phase1Data.length === 0) {
      alert('読み込み元のフェーズ1データが存在しません。');
      return;
    }

    await supabase
      .from('foundry_memberlist')
      .delete()
      .eq('eventdate', selectedDate)
      .eq('phase', 2);

    const newPhase2Rows = phase1Data.map((item) => {
      const { id, ...rest } = item;
      return {
        ...rest,
        phase: 2,
      };
    });

    const { error: err2 } = await supabase.from('foundry_memberlist').insert(newPhase2Rows);

    if (!err2) {
      alert('フェーズ1のデータをフェーズ2に引き継ぎました！');
      fetchPhase2Members();
    } else {
      alert('エラー: ' + err2.message);
    }
  };

  const handleUpdateMember = async (id, field, value) => {
    setPhase2Members((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );

    await supabase
      .from('foundry_memberlist')
      .update({ [field]: value })
      .eq('id', id);
  };

  if (!selectedDate) return null;

  return (
    <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg font-bold text-white">⚙️ フェーズ2以降 配置管理</h2>
        <button
          onClick={handleImportPhase1}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg w-full sm:w-auto"
        >
          📥 フェーズ1の配置を読み込む
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 min-w-[500px]">
          <thead className="bg-[#0b0f19] text-slate-400 uppercase">
            <tr>
              <th className="p-3 w-36 sm:w-auto">アカウント名</th>
              <th className="p-3">部隊戦力</th>
              <th className="p-3 text-center">控え</th>
              <th className="p-3">施設</th>
              <th className="p-3">役割</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {phase2Members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-800/40">
                <td className="p-3">
                  <input
                    type="text"
                    className="bg-[#0b0f19] border border-slate-700 rounded px-2 py-1.5 text-white font-bold w-32 sm:w-full outline-none focus:border-cyan-500"
                    value={m.name || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPhase2Members((prev) =>
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
                      setPhase2Members((prev) =>
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
                    {BUILDINGS_PHASE2.map((b) => (
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
                    {ROLES_PHASE2.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {phase2Members.length === 0 && (
              <tr>
                <td colSpan="5" className="p-6 text-center text-slate-500">
                  フェーズ2のデータがありません。「フェーズ1の配置を読み込む」を押してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}