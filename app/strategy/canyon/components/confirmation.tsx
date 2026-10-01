// @ts-nocheck
'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function Confirmation({ selectedDate, startPos, members, notes }) {
  // コピー時のフィードバック用状態（どのキーがコピーされたか）
  const [copiedKey, setCopiedKey] = useState(null);
  // チェックされたチーム名のリスト
  const [checkedTeams, setCheckedTeams] = useState([]);

  // クリップボードにコピーする汎用関数
  const handleCopy = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    } catch (err) {
      console.error('コピーに失敗しました', err);
    }
  };

  // スタート位置に応じた6チーム
  const getTeams = () => {
    if (startPos === '左') return ['防衛 S19', '防衛 S28', '中央 S30', '中央 S31', '攻撃 S18', '攻撃 S27'];
    if (startPos === '右') return ['防衛 F19', '防衛 F28', '中央 F30', '中央 F31', '攻撃 F18', '攻撃 F27'];
    if (startPos === '下') return ['防衛 I19', '防衛 I28', '中央 I30', '中央 I31', '攻撃 I18', '攻撃 I27'];
    return [];
  };

  const currentTeams = getTeams();

  // チェックボックスの切り替え
  const handleToggleTeam = (teamName) => {
    if (checkedTeams.includes(teamName)) {
      setCheckedTeams(checkedTeams.filter((t) => t !== teamName));
    } else {
      setCheckedTeams([...checkedTeams, teamName]);
    }
  };

  // 1チーム分のコピーテキストを生成する関数
  const generateSingleTeamText = (teamName, assignedMembers) => {
    const leaders = assignedMembers.filter((m) => m.role === 'リーダー');
    const normalMembers = assignedMembers.filter(
      (m) => m.role !== 'リーダー' && m.role !== '控え' && !m.bench
    );
    const benchMembers = assignedMembers.filter(
      (m) => m.role === '控え' || m.bench
    );

    const leaderLines = leaders.length > 0
      ? leaders.map((l) => `${l.name}【${teamName}】`).join('\n')
      : `（リーダー未設定）【${teamName}】`;

    const memberNamesLine = normalMembers.map((m) => m.name).join('、');
    const benchNamesStr = benchMembers.map((m) => m.name).join('、');
    const benchLine = benchMembers.length > 0 ? `控え：${benchNamesStr}` : '';

    let result = `${teamName}\n${leaderLines}`;
    if (memberNamesLine) {
      result += `\n${memberNamesLine}`;
    }
    if (benchLine) {
      result += `\n${benchLine}`;
    }

    return result;
  };

  // チェックされたチームのテキストをまとめてコピー
  const handleCopyCheckedTeams = () => {
    if (checkedTeams.length === 0) return;

    const texts = checkedTeams.map((teamName) => {
      const assignedMembers = members.filter((m) => m.team === teamName);
      return generateSingleTeamText(teamName, assignedMembers);
    });

    const combinedText = texts.join('\n\n');
    handleCopy(combinedText, 'checked-teams');
  };

  // Excelデータ出力ハンドラー
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. note タブのデータ作成
    // 1列目: 項目名, 2列目: テキスト
    const noteData = [
      ['項目', 'テキスト'],
      ['基本', notes.basic || ''],
      ['フェーズ1', notes.phase1 || ''],
      ['フェーズ2', notes.phase2 || ''],
      ['フェーズ3', notes.phase3 || ''],
    ];
    const wsNote = XLSX.utils.aoa_to_sheet(noteData);
    XLSX.utils.book_append_sheet(wb, wsNote, 'note');

    // 2. member タブのデータ作成
    // 役割の優先順位を定義 (リーダー > サブ > メンバー > 控え)
    const getRolePriority = (role, bench) => {
      if (role === 'リーダー') return 1;
      if (role === 'サブ') return 2;
      if (role === '控え' || bench) return 4;
      return 3; // 通常メンバー等
    };

    // 各チームごとのメンバーリストを整理（役割順 -> 同一役割内はpower降順）
    const teamColumnsData = {};
    let maxRows = 0;

    currentTeams.forEach((teamName) => {
      const assigned = members.filter((m) => m.team === teamName);
      // ソート
      const sorted = [...assigned].sort((a, b) => {
        const pA = getRolePriority(a.role, a.bench);
        const pB = getRolePriority(b.role, b.bench);
        if (pA !== pB) return pA - pB;
        // 同一優先順位なら power の高い順
        return (b.power || 0) - (a.power || 0);
      });

      teamColumnsData[teamName] = sorted.map((m) => m.name);
      if (sorted.length > maxRows) {
        maxRows = sorted.length;
      }
    });

    // 縦持ちのデータをシート用（行方向）に変換
    // 1行目: チーム名
    const memberSheetRows = [currentTeams];

    // 2行目以降: 各チームのメンバー名を並べる
    for (let i = 0; i < maxRows; i++) {
      const row = currentTeams.map((teamName) => {
        return teamColumnsData[teamName][i] || '';
      });
      memberSheetRows.push(row);
    }

    const wsMember = XLSX.utils.aoa_to_sheet(memberSheetRows);
    XLSX.utils.book_append_sheet(wb, wsMember, 'member');

    // ファイル名生成 (例: 作戦データ_2026-10-01.xlsx)
    const fileName = `作戦データ_${selectedDate || 'unnamed'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      {/* 作戦内容確認 */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">📋 作戦概要確認 ({selectedDate})</h2>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl font-semibold transition shadow-lg shadow-emerald-900/30 flex items-center gap-1.5"
          >
            📊 Excelデータ出力
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'basic', label: '📌 基本方針', headerTitle: '【基本方針】' },
            { key: 'phase1', label: '⏱️ フェーズ1作戦', headerTitle: '【フェーズ1作戦】' },
            { key: 'phase2', label: '⏱️ フェーズ2作戦', headerTitle: '【フェーズ2作戦】' },
            { key: 'phase3', label: '⏱️ フェーズ3作戦', headerTitle: '【フェーズ3作戦】' },
          ].map((item) => {
            const content = notes[item.key] || '';
            const isCopied = copiedKey === item.key;
            const copyText = `${item.headerTitle}\n${content}`;

            return (
              <div key={item.key} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-cyan-300">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(copyText, item.key)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] rounded-lg transition flex items-center gap-1 font-semibold"
                    >
                      {isCopied ? '✅ コピー完了' : '📋 コピー'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap min-h-[60px]">
                    {content || '（未入力）'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* チームごとのメンバー・役割一覧 */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">🛡️ チーム別メンバー一覧</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">スタート位置: {startPos || '未設定'}</span>
            <button
              type="button"
              onClick={handleCopyCheckedTeams}
              disabled={checkedTeams.length === 0}
              className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition flex items-center gap-1.5 ${
                checkedTeams.length > 0
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              {copiedKey === 'checked-teams' ? '✅ コピー完了！' : `📋 チェックしたチームをコピー (${checkedTeams.length})`}
            </button>
          </div>
        </div>

        {!startPos ? (
          <div className="p-8 text-center bg-[#0b0f19] rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
            スタート位置が設定されていません。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentTeams.map((teamName) => {
              const assignedMembers = members.filter((m) => m.team === teamName);
              const isChecked = checkedTeams.includes(teamName);

              return (
                <div key={teamName} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTeam(teamName)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/30 focus:ring-offset-slate-900"
                        />
                        <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg">
                          🛡️ {teamName}
                        </span>
                      </label>
                      <span className="text-[10px] text-slate-400">{assignedMembers.length}名</span>
                    </div>

                    <div className="space-y-1.5">
                      {assignedMembers.length === 0 ? (
                        <p className="text-[11px] text-slate-500 py-2 text-center">メンバー未割当</p>
                      ) : (
                        assignedMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex justify-between items-center bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-2 text-xs"
                          >
                            <div>
                              <span className="font-bold text-white">{m.name}</span>
                              <span className="text-[10px] text-slate-400 ml-1.5">({m.power?.toLocaleString()})</span>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                m.role === 'リーダー'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : m.role === 'サブ'
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                  : m.role === '控え' || m.bench
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {m.role || (m.bench ? '控え' : 'メンバー')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}