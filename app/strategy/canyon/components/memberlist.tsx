// @ts-nocheck
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const TEAM_CONFIGS = {
  左: [
    { name: '防衛 S19', type: '防衛' },
    { name: '防衛 S28', type: '防衛' },
    { name: '中央 S30', type: '中央' },
    { name: '中央 S31', type: '中央' },
    { name: '攻撃 S18', type: '攻撃' },
    { name: '攻撃 S27', type: '攻撃' },
  ],
  右: [
    { name: '防衛 F19', type: '防衛' },
    { name: '防衛 F28', type: '防衛' },
    { name: '中央 F30', type: '中央' },
    { name: '中央 F31', type: '中央' },
    { name: '攻撃 F18', type: '攻撃' },
    { name: '攻撃 F27', type: '攻撃' },
  ],
  下: [
    { name: '防衛 I19', type: '防衛' },
    { name: '防衛 I28', type: '防衛' },
    { name: '中央 I30', type: '中央' },
    { name: '中央 I31', type: '中央' },
    { name: '攻撃 I18', type: '攻撃' },
    { name: '攻撃 I27', type: '攻撃' },
  ],
};

export default function MemberList({
  selectedDate,
  startPos,
  setStartPos,
  members,
  fetchMembers,
  notes,
  handleSaveNote,
}) {
  const [activeModalTeam, setActiveModalTeam] = useState(null); // 開いているチーム名
  const [selectedMemberIds, setSelectedMemberIds] = useState([]); // モーダル内で選択中のメンバーID

  const handleSaveStart = async (val) => {
    setStartPos(val);
    if (!selectedDate) return;

    await supabase
      .from('events')
      .update({ start: val })
      .eq('event_date', selectedDate);
  };

  const handleToggleBench = async (id, currentBench) => {
    const newBench = !currentBench;
    const { error } = await supabase
      .from('cc_memberlist')
      .update({ bench: newBench })
      .eq('id', id);

    if (!error && fetchMembers) {
      fetchMembers();
    }
  };

  // チームからメンバーを外す（teamをNULLにする）
  const handleRemoveFromTeam = async (id) => {
    const { error } = await supabase
      .from('cc_memberlist')
      .update({ team: null, role: null })
      .eq('id', id);

    if (!error && fetchMembers) {
      fetchMembers();
    }
  };

  // 役割（role）の更新
  const handleUpdateRole = async (id, newRole) => {
    const { error } = await supabase
      .from('cc_memberlist')
      .update({ role: newRole })
      .eq('id', id);

    if (!error && fetchMembers) {
      fetchMembers();
    }
  };

  // アカウント名（name）の更新
  const handleUpdateName = async (id, newName) => {
    if (!newName.trim()) return;
    const { error } = await supabase
      .from('cc_memberlist')
      .update({ name: newName.trim() })
      .eq('id', id);

    if (!error && fetchMembers) {
      fetchMembers();
    }
  };

  // モーダルを開く
  const openAddModal = (teamName) => {
    setActiveModalTeam(teamName);
    setSelectedMemberIds([]);
  };

  // モーダル内でのメンバー選択切り替え
  const toggleSelectMember = (id) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // 選択したメンバーをチームに追加
  const handleAddSelectedMembers = async () => {
    if (!activeModalTeam || selectedMemberIds.length === 0) return;

    for (const id of selectedMemberIds) {
      const targetMember = members.find((m) => m.id === id);
      const defaultRole = targetMember?.bench ? '控え' : 'メンバー';

      await supabase
        .from('cc_memberlist')
        .update({ team: activeModalTeam, role: defaultRole })
        .eq('id', id);
    }

    if (fetchMembers) {
      fetchMembers();
    }
    setActiveModalTeam(null);
    setSelectedMemberIds([]);
  };

  const currentStartKey = ['左', '右', '下'].includes(startPos) ? startPos : '左';
  const activeTeams = TEAM_CONFIGS[currentStartKey] || TEAM_CONFIGS['左'];

  // まだどのチームにも所属していないメンバーを抽出
  const availableMembers = members
    .filter((m) => !m.team)
    .sort((a, b) => {
      if (a.bench !== b.bench) {
        return a.bench ? 1 : -1;
      }
      return (b.power || 0) - (a.power || 0);
    });

  return (
    <div className="space-y-6">
      {/* スタート位置設定 */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-3">
        <h2 className="text-sm font-extrabold text-cyan-400 flex items-center gap-2">
          <span>🏁</span> スタート位置の設定
        </h2>
        <div>
          <select
            value={currentStartKey}
            onChange={(e) => handleSaveStart(e.target.value)}
            className="w-full bg-[#0b0f19] border border-slate-700 text-xs text-white rounded-xl px-3 py-2.5 outline-none font-semibold focus:border-cyan-500 transition"
          >
            <option value="左">スタート 左</option>
            <option value="右">スタート 右</option>
            <option value="下">スタート 下</option>
          </select>
        </div>
      </div>

      {/* チーム編成セクション */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
          <span>🛡</span> チーム編成 & 役割設定 ({currentStartKey}スタート)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTeams.map((team) => {
            const teamMembers = members.filter((m) => m.team === team.name);

            return (
              <div
                key={team.name}
                className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-cyan-400">
                      {team.name}
                    </span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      {team.type}
                    </span>
                  </div>

                  {/* 所属メンバー一覧 */}
                  <div className="space-y-2">
                    {teamMembers.map((m) => (
                      <div
                        key={m.id}
                        className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 space-y-1.5"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 truncate">
                            <input
                              type="text"
                              defaultValue={m.name}
                              onBlur={(e) => handleUpdateName(m.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                }
                              }}
                              className="text-xs font-bold text-white bg-transparent border-b border-transparent hover:border-slate-600 focus:border-cyan-500 outline-none truncate max-w-[110px]"
                            />
                            {m.bench && (
                              <span className="text-[9px] bg-amber-950/80 text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/30">
                                控え
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromTeam(m.id)}
                            className="text-slate-500 hover:text-red-400 text-xs font-bold px-1"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] text-slate-400">
                            戦力: {m.power?.toLocaleString() || '-'}
                          </span>
                          <select
                            value={m.role || (m.bench ? '控え' : 'メンバー')}
                            onChange={(e) =>
                              handleUpdateRole(m.id, e.target.value)
                            }
                            className="bg-slate-800 border border-slate-700 text-[10px] text-cyan-300 rounded px-1.5 py-1 outline-none font-semibold"
                          >
                            <option value="リーダー">リーダー</option>
                            <option value="サブ">サブ</option>
                            <option value="メンバー">メンバー</option>
                            <option value="控え">控え</option>
                          </select>
                        </div>
                      </div>
                    ))}

                    {teamMembers.length === 0 && (
                      <div className="py-3 text-center text-[10px] text-slate-600">
                        メンバーが未選択です
                      </div>
                    )}
                  </div>
                </div>

                {/* メンバー追加ボタン */}
                <div className="pt-2 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => openAddModal(team.name)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-cyan-400 font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <span>＋</span> メンバーを追加
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* メンバー追加モーダル（複数選択対応） */}
      {activeModalTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#151c2c] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <span>➕</span> {activeModalTeam} へメンバー追加
              </h3>
              <button
                type="button"
                onClick={() => setActiveModalTeam(null)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {availableMembers.map((m) => {
                const isSelected = selectedMemberIds.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleSelectMember(m.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer flex justify-between items-center transition ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-white'
                        : 'bg-[#0b0f19] border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // 親divのonClickで制御
                        className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">{m.name}</div>
                        <div className="text-[10px] text-slate-400">
                          戦力: {m.power?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        m.bench
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {m.bench ? '控え' : '参戦'}
                    </span>
                  </div>
                );
              })}

              {availableMembers.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">
                  追加できるメンバーがいません（全員割り当て済み）
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModalTeam(null)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAddSelectedMembers}
                disabled={selectedMemberIds.length === 0}
                className="py-2 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-bold transition"
              >
                選択したメンバーを追加 ({selectedMemberIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 参戦メンバー一覧・参戦管理 */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <span>👥</span> 参戦メンバー一覧 ({members.length}名)
          </h2>
          <span className="text-xs text-slate-400">※クリックで参戦/控えを切り替え、名前を直接編集可能</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
          {members.map((m) => (
            <div
              key={m.id}
              className={`p-3 rounded-xl border flex justify-between items-center transition ${
                m.bench
                  ? 'bg-[#0b0f19]/40 border-slate-800/60 opacity-50'
                  : 'bg-[#0b0f19] border-slate-800 shadow-sm'
              }`}
            >
              <div className="space-y-1">
                <input
                  type="text"
                  defaultValue={m.name}
                  onBlur={(e) => handleUpdateName(m.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.target.blur();
                    }
                  }}
                  className="text-xs font-bold text-white bg-transparent border-b border-transparent hover:border-slate-600 focus:border-cyan-500 outline-none truncate max-w-[130px]"
                />
                <div
                  className="text-[10px] text-slate-400 cursor-pointer"
                  onClick={() => handleToggleBench(m.id, m.bench)}
                >
                  戦力: {m.power?.toLocaleString()}
                </div>
              </div>
              <span
                onClick={() => handleToggleBench(m.id, m.bench)}
                className={`text-[10px] px-2 py-1 rounded-lg font-bold cursor-pointer ${
                  m.bench
                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-900'
                }`}
              >
                {m.bench ? '控え' : '参戦'}
              </span>
            </div>
          ))}
          {members.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-slate-500">
              メンバーが登録されていません。
            </div>
          )}
        </div>
      </div>

      {/* 作戦メモ・指示入力セクション */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
          <span>📝</span> 作戦・指示メモ入力
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              📌 基本方針・全体指示
            </label>
            <textarea
              className="w-full h-24 bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-500"
              placeholder="全体の動きや作戦の方針を入力..."
              value={notes.basic || ''}
              onChange={(e) => handleSaveNote('basic', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                ⏱️ フェーズ1
              </label>
              <textarea
                className="w-full h-24 bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-500"
                value={notes.phase1 || ''}
                onChange={(e) => handleSaveNote('phase1', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                ⏱️ フェーズ2
              </label>
              <textarea
                className="w-full h-24 bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-500"
                value={notes.phase2 || ''}
                onChange={(e) => handleSaveNote('phase2', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                ⏱ フェーズ3
              </label>
              <textarea
                className="w-full h-24 bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-500"
                value={notes.phase3 || ''}
                onChange={(e) => handleSaveNote('phase3', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}