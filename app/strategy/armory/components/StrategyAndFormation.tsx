// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

export default function StrategyAndFormation({ supabase, selectedDate }) {
  // ノート・作戦用状態
  const [basicNote, setBasicNote] = useState('');
  const [teleportNote, setTeleportNote] = useState('');
  const [phase2Rows, setPhase2Rows] = useState([]);

  // 英雄リスト（プルダウン用）
  const [shieldHeroes, setShieldHeroes] = useState([]);
  const [spearHeroes, setSpearHeroes] = useState([]);
  const [bowHeroes, setBowHeroes] = useState([]);
  const [joinerHeroes, setJoinerHeroes] = useState([]);

  // 編成リスト（集結・駐屯）
  const [formations, setFormations] = useState([]);

  useEffect(() => {
    if (selectedDate) {
      fetchNotes();
      fetchFormations();
      fetchHeroes();
    }
  }, [selectedDate]);

  // heroesテーブルから各種英雄を取得 (実際のテーブル名: heroes)
  const fetchHeroes = async () => {
    const { data, error } = await supabase.from('heroes').select('*').order('display_order', { ascending: true });
    if (data && !error) {
      setShieldHeroes(data.filter((h) => h.troop_type === 'shield'));
      setSpearHeroes(data.filter((h) => h.troop_type === 'spear'));
      setBowHeroes(data.filter((h) => h.troop_type === 'bow'));
      setJoinerHeroes(data.filter((h) => h.joiner_setting === true));
    }
  };

  // foundry_noteから作戦データを取得
  const fetchNotes = async () => {
    const { data } = await supabase
      .from('foundry_note')
      .select('*')
      .eq('eventdate', selectedDate);

    if (data) {
      const basic = data.find((d) => d.pattern === '基本');
      const teleport = data.find((d) => d.pattern === 'teleport');
      const p2 = data
        .filter((d) => d.pattern === 'phase2' || d.pattern === 'phese2')
        .sort((a, b) => (a.row || 0) - (b.row || 0));

      setBasicNote(basic?.note || '');
      setTeleportNote(teleport?.note || '');
      setPhase2Rows(p2);
    }
  };

  // foundry_heroから編成データを取得
  const fetchFormations = async () => {
    const { data } = await supabase
      .from('foundry_hero')
      .select('*')
      .eq('eventdate', selectedDate);
    if (data) {
      const sorted = data.sort((a, b) => {
        if (a.type === b.type) return (a.no || 1) - (b.no || 1);
        return a.type === 'rally' ? -1 : 1;
      });
      setFormations(sorted);
    }
  };

  // ノート保存共通（基本・移転）
  const saveNote = async (pattern, noteText) => {
    const { error } = await supabase.from('foundry_note').upsert(
      { eventdate: selectedDate, pattern, note: noteText },
      { onConflict: 'eventdate,pattern' }
    );
    if (!error) {
      alert(`${pattern === '基本' ? '基本方針' : '移転スケジュール'}を保存しました！`);
    } else {
      alert('保存エラー: ' + error.message);
    }
  };

  // フェーズ2テーブル行追加
  const handleAddPhase2Row = () => {
    setPhase2Rows((prev) => [
      ...prev,
      { row: prev.length + 1, jst: '', team: '', note: '', pattern: 'phase2', eventdate: selectedDate },
    ]);
  };

  // フェーズ2テーブル一括保存
  const handleSavePhase2Table = async () => {
    await supabase.from('foundry_note').delete().eq('eventdate', selectedDate).eq('pattern', 'phase2');
    await supabase.from('foundry_note').delete().eq('eventdate', selectedDate).eq('pattern', 'phese2');
    
    const rowsToInsert = phase2Rows.map((r, idx) => ({
      eventdate: selectedDate,
      pattern: 'phase2',
      row: idx + 1,
      jst: r.jst || '',
      team: r.team || '',
      note: r.note || '',
    }));

    if (rowsToInsert.length > 0) {
      const { error } = await supabase.from('foundry_note').insert(rowsToInsert);
      if (error) {
        alert('フェーズ2保存エラー: ' + error.message);
        return;
      }
    }
    alert('フェーズ2作戦テーブルを保存しました！');
  };

  // 編成（集結・駐屯）追加
  const handleAddFormation = async (type) => {
    const sameTypeItems = formations.filter((f) => f.type === type);
    const nextNo = sameTypeItems.length > 0 ? Math.max(...sameTypeItems.map((f) => f.no || 1)) + 1 : 1;

    const newRecord = {
      eventdate: selectedDate,
      type: type,
      no: nextNo,
      shield: '',
      spear: '',
      bow: '',
      shield_ratio: 50,
      spear_rasio: 0,
      bow_ratio: 50,
      joiner1: '',
      joiner2: '',
      joiner3: '',
      joiner4: '',
    };

    const { data, error } = await supabase.from('foundry_hero').insert([newRecord]).select();
    if (!error && data) {
      setFormations((prev) => [...prev, data[0]]);
    } else {
      alert('編成追加エラー: ' + error?.message);
    }
  };

  // 編成データ更新（比率の合計が100%を超える場合の制御含む）
  const handleUpdateFormation = async (id, field, value) => {
    let updatedFormations = formations.map((f) => {
      if (f.id === id) {
        let updated = { ...f, [field]: value };
        // 比率フィールドの場合の合計チェック (100%超え防止)
        if (field === 'shield_ratio' || field === 'spear_rasio' || field === 'bow_ratio') {
          const s = field === 'shield_ratio' ? Number(value) : Number(f.shield_ratio ?? 0);
          const sp = field === 'spear_rasio' ? Number(value) : Number(f.spear_rasio ?? 0);
          const b = field === 'bow_ratio' ? Number(value) : Number(f.bow_ratio ?? 0);
          if (s + sp + b > 100) {
            alert('比率の合計は100%を超えることはできません。');
            return f; // 変更をキャンセル
          }
        }
        return updated;
      }
      return f;
    });

    setFormations(updatedFormations);

    const targetItem = updatedFormations.find((f) => f.id === id);
    if (targetItem) {
      await supabase
        .from('foundry_hero')
        .update({ [field]: targetItem[field] })
        .eq('id', id);
    }
  };

  // 編成削除
  const handleDeleteFormation = async (id) => {
    if (!confirm('この編成を削除しますか？')) return;
    const { error } = await supabase.from('foundry_hero').delete().eq('id', id);
    if (!error) {
      setFormations((prev) => prev.filter((f) => f.id !== id));
    } else {
      alert('削除エラー: ' + error.message);
    }
  };

  if (!selectedDate) return null;

  const rallyList = formations.filter((f) => f.type === 'rally');
  const garrisonList = formations.filter((f) => f.type === 'garrison');

  return (
    <div className="space-y-6">
      {/* 1. 作戦・指示編集エリア */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-white">📝 作戦・指示編集</h2>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-cyan-400">【基本】方針・指示</label>
            <textarea
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none h-24"
              value={basicNote}
              onChange={(e) => setBasicNote(e.target.value)}
            />
            <button
              onClick={() => saveNote('基本', basicNote)}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              基本を保存
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-cyan-400">【移転】スケジュール・指示</label>
            <textarea
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none h-24"
              value={teleportNote}
              onChange={(e) => setTeleportNote(e.target.value)}
            />
            <button
              onClick={() => saveNote('teleport', teleportNote)}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              移転を保存
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-cyan-400">【フェーズ2】詳細タイムライン作戦</label>
              <div className="flex gap-2">
                <button
                  onClick={handleAddPhase2Row}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                >
                  ＋ 行追加
                </button>
                <button
                  onClick={handleSavePhase2Table}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                >
                  一括保存
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0b0f19] text-slate-400">
                  <tr>
                    <th className="p-2 w-28">1列目: JST</th>
                    <th className="p-2 w-36">2列目: チーム</th>
                    <th className="p-2">3行目: 指示内容</th>
                    <th className="p-2 w-16">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {phase2Rows.map((r, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <input
                          type="text"
                          className="bg-[#0b0f19] border border-slate-700 rounded p-1 text-white w-full outline-none"
                          value={r.jst || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPhase2Rows((prev) => prev.map((item, i) => i === idx ? { ...item, jst: val } : item));
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="bg-[#0b0f19] border border-slate-700 rounded p-1 text-white w-full outline-none"
                          value={r.team || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPhase2Rows((prev) => prev.map((item, i) => i === idx ? { ...item, team: val } : item));
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="bg-[#0b0f19] border border-slate-700 rounded p-1 text-white w-full outline-none"
                          value={r.note || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPhase2Rows((prev) => prev.map((item, i) => i === idx ? { ...item, note: val } : item));
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => setPhase2Rows((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-300 font-bold px-2 py-1"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 編成登録エリア (集結・駐屯) */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <h2 className="text-lg font-bold text-white">⚔️ 部隊編成登録 (集結・駐屯)</h2>

        {/* 【集結】セクション */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-cyan-400">⚔️ 集結編成一覧</h3>
            <button
              onClick={() => handleAddFormation('rally')}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              ＋ 集結を追加
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {rallyList.map((item, idx) => (
              <div key={item.id || idx} className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-cyan-300">集結 ({item.no || idx + 1})</span>
                  <button
                    onClick={() => handleDeleteFormation(item.id)}
                    className="text-rose-400 hover:text-rose-300 text-xs font-bold"
                  >
                    削除
                  </button>
                </div>

                {/* ① リーダー (盾・槍・弓) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">リーダー: 盾</label>
                    <select
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-xs text-white outline-none"
                      value={item.shield || ''}
                      onChange={(e) => handleUpdateFormation(item.id, 'shield', e.target.value)}
                    >
                      <option value="">選択してください</option>
                      {shieldHeroes.map((h) => (
                        <option key={h.id || h.name} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">リーダー: 槍</label>
                    <select
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-xs text-white outline-none"
                      value={item.spear || ''}
                      onChange={(e) => handleUpdateFormation(item.id, 'spear', e.target.value)}
                    >
                      <option value="">選択してください</option>
                      {spearHeroes.map((h) => (
                        <option key={h.id || h.name} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">リーダー: 弓</label>
                    <select
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-xs text-white outline-none"
                      value={item.bow || ''}
                      onChange={(e) => handleUpdateFormation(item.id, 'bow', e.target.value)}
                    >
                      <option value="">選択してください</option>
                      {bowHeroes.map((h) => (
                        <option key={h.id || h.name} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ② 比率 (合計100%上限) */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">盾比率 (%)</label>
                    <input
                      type="number"
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-1.5 text-xs text-cyan-400 outline-none"
                      value={item.shield_ratio ?? 50}
                      onChange={(e) => handleUpdateFormation(item.id, 'shield_ratio', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">槍比率 (%)</label>
                    <input
                      type="number"
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-1.5 text-xs text-cyan-400 outline-none"
                      value={item.spear_rasio ?? 0}
                      onChange={(e) => handleUpdateFormation(item.id, 'spear_rasio', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">弓比率 (%)</label>
                    <input
                      type="number"
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-1.5 text-xs text-cyan-400 outline-none"
                      value={item.bow_ratio ?? 50}
                      onChange={(e) => handleUpdateFormation(item.id, 'bow_ratio', Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* ③ 乗り英雄 (4つ) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <div key={num}>
                      <label className="text-[10px] text-slate-400">乗り英雄 {num}</label>
                      <select
                        className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-xs text-white outline-none"
                        value={item[`joiner${num}`] || ''}
                        onChange={(e) => handleUpdateFormation(item.id, `joiner${num}`, e.target.value)}
                      >
                        <option value="">なし</option>
                        {joinerHeroes.map((h) => (
                          <option key={h.id || h.name} value={h.name}>{h.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {rallyList.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-3">集結編成が登録されていません。</p>
            )}
          </div>
        </div>

        {/* 【駐屯】セクション */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-emerald-400">🛡️ 駐屯編成一覧</h3>
            <button
              onClick={() => handleAddFormation('garrison')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              ＋ 駐屯を追加
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {garrisonList.map((item, idx) => (
              <div key={item.id || idx} className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-300">駐屯 ({item.no || idx + 1})</span>
                  <button
                    onClick={() => handleDeleteFormation(item.id)}
                    className="text-rose-400 hover:text-rose-300 text-xs font-bold"
                  >
                    削除
                  </button>
                </div>

                {/* 盾・槍・弓 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">盾</label>
                    <select
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-xs text-white outline-none"
                      value={item.shield || ''}
                      onChange={(e) => handleUpdateFormation(item.id, 'shield', e.target.value)}
                    >
                      <option value="">選択してください</option>
                      {shieldHeroes.map((h) => (
                        <option key={h.id || h.name} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">槍</label>
                    <select
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-xs text-white outline-none"
                      value={item.spear || ''}
                      onChange={(e) => handleUpdateFormation(item.id, 'spear', e.target.value)}
                    >
                      <option value="">選択してください</option>
                      {spearHeroes.map((h) => (
                        <option key={h.id || h.name} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">弓</label>
                    <select
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-xs text-white outline-none"
                      value={item.bow || ''}
                      onChange={(e) => handleUpdateFormation(item.id, 'bow', e.target.value)}
                    >
                      <option value="">選択してください</option>
                      {bowHeroes.map((h) => (
                        <option key={h.id || h.name} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 比率 */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">盾比率 (%)</label>
                    <input
                      type="number"
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-1.5 text-xs text-emerald-400 outline-none"
                      value={item.shield_ratio ?? 50}
                      onChange={(e) => handleUpdateFormation(item.id, 'shield_ratio', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">槍比率 (%)</label>
                    <input
                      type="number"
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-1.5 text-xs text-emerald-400 outline-none"
                      value={item.spear_rasio ?? 0}
                      onChange={(e) => handleUpdateFormation(item.id, 'spear_rasio', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">弓比率 (%)</label>
                    <input
                      type="number"
                      className="w-full bg-[#151c2c] border border-slate-700 rounded p-1.5 text-xs text-emerald-400 outline-none"
                      value={item.bow_ratio ?? 50}
                      onChange={(e) => handleUpdateFormation(item.id, 'bow_ratio', Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* 指定英雄 (4つ) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <div key={num}>
                      <label className="text-[10px] text-slate-400">指定英雄 {num}</label>
                      <select
                        className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-xs text-white outline-none"
                        value={item[`joiner${num}`] || ''}
                        onChange={(e) => handleUpdateFormation(item.id, `joiner${num}`, e.target.value)}
                      >
                        <option value="">なし</option>
                        {joinerHeroes.map((h) => (
                          <option key={h.id || h.name} value={h.name}>{h.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {garrisonList.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-3">駐屯編成が登録されていません。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}