// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

export default function StrategyViewer({ supabase, selectedDate }) {
  const [basicNote, setBasicNote] = useState('');
  const [teleportNote, setTeleportNote] = useState('');
  const [phase2Notes, setPhase2Notes] = useState([]);
  
  const [memberList, setMemberList] = useState([]);
  const [formations, setFormations] = useState([]);
  const [heroesMap, setHeroesMap] = useState({}); // 英雄の日本語名 -> 英語名

  useEffect(() => {
    if (selectedDate) {
      fetchData();
    }
  }, [selectedDate]);

  const fetchData = async () => {
    // 1. ノートデータの取得 (foundry_note)
    const { data: notesData } = await supabase
      .from('foundry_note')
      .select('*')
      .eq('eventdate', selectedDate);

    if (notesData) {
      const basic = notesData.find((d) => d.pattern === '基本');
      const teleport = notesData.find((d) => d.pattern === 'teleport');
      // phase2 またはスペル違いの phese2 を取得 (row順にソート)
      const p2Notes = notesData
        .filter((d) => d.pattern === 'phase2' || d.pattern === 'phese2')
        .sort((a, b) => (a.row || 0) - (b.row || 0));

      setBasicNote(basic?.note || '');
      setTeleportNote(teleport?.note || '');
      setPhase2Notes(p2Notes);
    }

    // 2. メンバー配置データの取得 (foundry_memberlist)
    const { data: membersData } = await supabase
      .from('foundry_memberlist')
      .select('*')
      .eq('eventdate', selectedDate);

    if (membersData) {
      setMemberList(membersData);
    }

    // 3. 英雄マスタ・英訳データの取得 (foundry_hero または heroes テーブル)
    // ここではご指定の foundry_hero と heroes テーブルから英訳マップを作成します
    const { data: heroData } = await supabase
      .from('foundry_hero')
      .select('*')
      .eq('eventdate', selectedDate);

    if (heroData) {
      // rally優先、同じtypeならnoが小さい順
      const sorted = heroData.sort((a, b) => {
        if (a.type === b.type) return (a.no || 1) - (b.no || 1);
        return a.type === 'rally' ? -1 : 1;
      });
      setFormations(sorted);
    }

    // heroesテーブルから英訳データを取得
    const { data: heroesMaster } = await supabase
      .from('heroes')
      .select('name, name_en');

    if (heroesMaster) {
      const map = {};
      heroesMaster.forEach((h) => {
        if (h.name) map[h.name] = h.name_en || h.name;
      });
      setHeroesMap(map);
    }
  };

  if (!selectedDate) return null;

  // フェーズ1の施設リスト
  const phase1Buildings = [
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

  // フェーズ2の施設リスト
  const phase2Buildings = [
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
  ];

  // 武器工房の個別施設リスト
  const weaponWorkshopBuildings = [
    '武器工房(左上)',
    '武器工房(左下)',
    '武器工房(右上)',
    '武器工房(右下)',
  ];

  // 役割の優先順位 (フェーズ1)
  const phase1RoleOrder = ['Leader', '武器工房', '1', '2', '3', '4', '5', '6', '7', '8'];
  // 役割の優先順位 (フェーズ2)
  const phase2RoleOrder = ['Leader', '武器工房', '1', '2', '3', '4', '5', '6', '7', '8'];

  // --- コピー・出力用ヘルパー関数 ---

  // クリップボードにコピー
  const copyToClipboard = (text, message = 'コピーしました！') => {
    navigator.clipboard.writeText(text).then(() => {
      alert(message);
    }).catch(err => {
      console.error('コピーに失敗しました', err);
    });
  };

  // ① 【基本】テキストコピー
  const handleCopyBasic = () => {
    const content = `【基本】\n${basicNote}`;
    copyToClipboard(content, '【基本】の方針をコピーしました！');
  };

  // ② 【移転】テキストコピー
  const handleCopyTeleport = () => {
    const content = `【移転】\n${teleportNote}`;
    copyToClipboard(content, '【移転】の方針をコピーしました！');
  };

  // ③ 【フェーズ2】詳細タイムライン作戦 テキストコピー
  const handleCopyPhase2Timeline = () => {
    let resultLines = [];
    phase2Notes.forEach((r) => {
      const jstText = r.jst ? r.jst : '';
      const teamText = r.team ? r.team : '';
      const noteText = r.note ? r.note : '';

      // noteが複数行ある場合を考慮しつつ、フォーマットに組み立て
      resultLines.push(`【${jstText}】`);
      if (teamText) {
        // teamとnoteの組み合わせ、あるいはnoteの複数行展開
        const noteLines = noteText.split('\n');
        noteLines.forEach((line) => {
          resultLines.push(`${jstText}\n⚫︎${teamText}：${line}`);
        });
      } else {
        const noteLines = noteText.split('\n');
        noteLines.forEach((line) => {
          if (jstText) resultLines.push(jstText);
          resultLines.push(`⚫︎${line}`);
        });
      }
    });

    // 指定されたフォーマット例に基づく構築
    // 【21:10~21:15】\n jst \n ⚫︎team：note
    let formattedBlocks = phase2Notes.map((r) => {
      const jst = r.jst || '';
      const team = r.team || '';
      const note = r.note || '';
      
      let block = `【${jst}】\n`;
      const noteLines = note.split('\n');
      noteLines.forEach((l) => {
        if (jst) block += `${jst}\n`;
        block += `⚫︎${team}：${l}\n`;
      });
      return block.trim();
    }).join('\n\n');

    copyToClipboard(formattedBlocks, 'フェーズ2詳細タイムライン作戦をコピーしました！');
  };

  // ④ 英訳コピーボタン（部隊編成用）
  const handleCopyEnglishFormations = () => {
    let output = '';
    formations.forEach((item) => {
      const isRally = item.type === 'rally';
      const typeStr = isRally ? 'Rally' : 'Garrison';
      const shieldRatio = item.shield_ratio ?? 50;
      const spearRatio = item.spear_rasio ?? 0;
      const bowRatio = item.bow_ratio ?? 50;

      const getEn = (name) => (name ? (heroesMap[name] || name) : '');

      const sh = getEn(item.shield);
      const sp = getEn(item.spear);
      const bo = getEn(item.bow);
      const leaders = [sh, sp, bo].filter(Boolean).join('・');

      const j1 = getEn(item.joiner1);
      const j2 = getEn(item.joiner2);
      const j3 = getEn(item.joiner3);
      const j4 = getEn(item.joiner4);
      const joiners = [j1, j2, j3, j4].filter(Boolean).join('・');

      output += `${typeStr}— Ratio ${shieldRatio}:${spearRatio}:${bowRatio}\n`;
      output += `Leader：${leaders}\n`;
      output += `Joiner： ${joiners}\n\n`;
    });

    copyToClipboard(output.trim(), '英訳した部隊編成をコピーしました！');
  };

  // CSV出力機能
  const exportCSV = (type) => {
    let csvContent = '\uFEFF'; // BOM for Excel / Powerpoint UTF-8
    let filename = `foundry_${type}_${selectedDate}.csv`;

    if (type === 'initial' || type === 'phase2') {
      const phaseNum = type === 'initial' ? 1 : 2;
      const buildings = type === 'initial' ? phase1Buildings : phase2Buildings;
      const roleOrder = type === 'initial' ? phase1RoleOrder : phase2RoleOrder;

      // ヘッダー
      csvContent += '施設名,役割,アカウント名\n';

      buildings.forEach((bName) => {
        const targetMembers = memberList.filter(
          (m) => Number(m.phase) === phaseNum && m.building === bName
        );

        const sorted = targetMembers.sort((a, b) => {
          const idxA = roleOrder.indexOf(a.role);
          const idxB = roleOrder.indexOf(b.role);
          if (idxA !== idxB) {
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
          }
          if (a.role === 'Leader') {
            return (b.power || 0) - (a.power || 0);
          }
          return 0;
        });

        sorted.forEach((m) => {
          const roleVal = m.role === 'Leader' ? 'L' : m.role;
          csvContent += `"${bName}","${roleVal}","${m.name || ''}"\n`;
        });
      });
    } else if (type === 'strategy') {
      csvContent += 'pattern,jst,team,note\n';
      // 1行目: 基本, 2行目: teleport, 3行目以降: phase2
      csvContent += `"基本","","","${basicNote.replace(/"/g, '""').replace(/\n/g, '\\n')}"\n`;
      csvContent += `"teleport","","","${teleportNote.replace(/"/g, '""').replace(/\n/g, '\\n')}"\n`;
      phase2Notes.forEach((r) => {
        const pat = r.pattern || 'phase2';
        const jst = r.jst || '';
        const team = r.team || '';
        const note = (r.note || '').replace(/"/g, '""').replace(/\n/g, '\\n');
        csvContent += `"${pat}","${jst}","${team}","${note}"\n`;
      });
    } else if (type === 'formation') {
      csvContent += '集結/駐屯,盾,槍,弓,比率,指定英雄1,指定英雄2,指定英雄3,指定英雄4\n';
      formations.forEach((item) => {
        const typeStr = item.type === 'rally' ? '集結' : '駐屯';
        const formatName = (jpName) => {
          if (!jpName) return '';
          const enName = heroesMap[jpName] || jpName;
          return `${jpName}\n${enName}`;
        };

        const shield = formatName(item.shield);
        const spear = formatName(item.spear);
        const bow = formatName(item.bow);
        const ratio = `${item.shield_ratio ?? 50}:${item.spear_rasio ?? 0}:${item.bow_ratio ?? 50}`;
        const j1 = formatName(item.joiner1);
        const j2 = formatName(item.joiner2);
        const j3 = formatName(item.joiner3);
        const j4 = formatName(item.joiner4);

        csvContent += `"${typeStr}","${shield}","${spear}","${bow}","${ratio}","${j1}","${j2}","${j3}","${j4}"\n`;
      });
    }

    // ダウンロード実行
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 描画用ヘルパー ---

  const renderBuildingMembers = (phaseNum, buildingName) => {
    const targetMembers = memberList.filter(
      (m) => Number(m.phase) === phaseNum && m.building === buildingName
    );

    if (targetMembers.length === 0) return null;

    const roleOrder = phaseNum === 1 ? phase1RoleOrder : phase2RoleOrder;

    const sorted = targetMembers.sort((a, b) => {
      const idxA = roleOrder.indexOf(a.role);
      const idxB = roleOrder.indexOf(b.role);
      if (idxA !== idxB) {
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      }
      if (a.role === 'Leader') {
        return (b.power || 0) - (a.power || 0);
      }
      return 0;
    });

    return (
      <div key={buildingName} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 space-y-2">
        <h4 className="text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1">🔥 {buildingName}</h4>
        <div className="space-y-1">
          {sorted.map((m, idx) => (
            <div key={m.id || idx} className="flex justify-between items-center text-xs text-slate-300">
              <span className="text-slate-400 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
                {m.role}
              </span>
              <span className="font-medium text-white">{m.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWorkshopMember = (buildingName) => {
    const targetMembers = memberList.filter(
      (m) => Number(m.phase) === 2 && m.building === buildingName
    );

    const sorted = targetMembers.sort((a, b) => (b.power || 0) - (a.power || 0));

    return (
      <div key={buildingName} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 space-y-2">
        <h4 className="text-xs font-bold text-amber-400 border-b border-slate-800 pb-1">🏭 {buildingName}</h4>
        {sorted.length > 0 ? (
          <div className="space-y-1">
            {sorted.map((m, idx) => (
              <div key={m.id || idx} className="flex justify-between items-center text-xs text-slate-300">
                <span className="font-medium text-white">{m.name}</span>
                {m.power && <span className="text-[10px] text-slate-500">P: {m.power}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">空いてる人(1軍)※移転しない</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 操作パネル（CSV出力・英訳コピーなど） */}
      <div className="flex flex-wrap gap-2 justify-end bg-[#151c2c] p-3 rounded-xl border border-slate-800">
        <button onClick={handleCopyEnglishFormations} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg font-bold transition">
          🌐 英訳コピー（編成）
        </button>
        <button onClick={() => exportCSV('initial')} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded-lg font-medium transition">
          📥 CSV(初期配置)
        </button>
        <button onClick={() => exportCSV('phase2')} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded-lg font-medium transition">
          📥 CSV(フェーズ2)
        </button>
        <button onClick={() => exportCSV('strategy')} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded-lg font-medium transition">
          📥 CSV(作戦)
        </button>
        <button onClick={() => exportCSV('formation')} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded-lg font-medium transition">
          📥 CSV(編成)
        </button>
      </div>

      {/* 1. 作戦画面（基本・移転・フェーズ2テーブル） */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-white flex items-center gap-2">📋 作戦方針・スケジュール</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 space-y-2 relative">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-cyan-400">📌 【基本】方針・指示</h3>
              <button onClick={handleCopyBasic} className="text-[10px] bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 px-2 py-1 rounded transition">
                📋 テキストコピー
              </button>
            </div>
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{basicNote || '設定なし'}</p>
          </div>

          <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 space-y-2 relative">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-cyan-400">🚀 【移転】スケジュール・指示</h3>
              <button onClick={handleCopyTeleport} className="text-[10px] bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 px-2 py-1 rounded transition">
                📋 テキストコピー
              </button>
            </div>
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{teleportNote || '設定なし'}</p>
          </div>
        </div>

        {/* フェーズ2 タイムライン作戦テーブル */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-cyan-400">⏱️ 【フェーズ2】詳細タイムライン作戦</h3>
            <button onClick={handleCopyPhase2Timeline} className="text-[10px] bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 px-2 py-1 rounded transition">
              📋 テキストコピー
            </button>
          </div>
          {phase2Notes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0b0f19] text-slate-400">
                  <tr>
                    <th className="p-2 w-28">1列目: JST</th>
                    <th className="p-2 w-36">2列目: チーム</th>
                    <th className="p-2">3行目: 指示内容</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {phase2Notes.map((r, idx) => (
                    <tr key={idx}>
                      <td className="p-2 text-cyan-300 font-mono">{r.jst}</td>
                      <td className="p-2 text-slate-200">{r.team}</td>
                      {/* 修正箇所: 改行を正しく反映させるために whitespace-pre-wrap を適用 */}
                      <td className="p-2 text-slate-300 whitespace-pre-wrap">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500">フェーズ2のタイムライン作戦は登録されていません。</p>
          )}
        </div>
      </div>

      {/* 2. 編成 (集結・駐屯) */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">⚔️ 部隊編成 (集結・駐屯)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {formations.map((item, idx) => {
            const isRally = item.type === 'rally';
            const icon = isRally ? '⚔️ 集結' : '🛡️ 駐屯';
            const shieldRatio = item.shield_ratio ?? 50;
            const spearRatio = item.spear_rasio ?? 0;
            const bowRatio = item.bow_ratio ?? 50;

            return (
              <div key={item.id || idx} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1">
                  <span>{icon} — 比率 {shieldRatio}:{spearRatio}:{bowRatio}</span>
                  <span className="text-[10px] text-slate-500">No.{item.no || 1}</span>
                </div>
                <div className="text-xs space-y-1 text-slate-300">
                  <p><span className="text-slate-400">集結主：</span>{[item.shield, item.spear, item.bow].filter(Boolean).join('・') || '未設定'}</p>
                  <p><span className="text-slate-400">指定英雄：</span>{[item.joiner1, item.joiner2, item.joiner3, item.joiner4].filter(Boolean).join('・') || 'なし'}</p>
                </div>
              </div>
            );
          })}
          {formations.length === 0 && (
            <p className="text-xs text-slate-500">編成データが登録されていません。</p>
          )}
        </div>
      </div>

      {/* 3. フェーズ1 配置一覧 */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">🛡️ フェーズ1 配置一覧</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {phase1Buildings.map((building) => renderBuildingMembers(1, building))}
        </div>
      </div>

      {/* 4. フェーズ2 配置・武器工房一覧 */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">⚙️ フェーズ2 配置・武器工房一覧</h2>
        
        {/* 通常施設 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {phase2Buildings.map((building) => renderBuildingMembers(2, building))}
        </div>

        {/* 武器工房個別セクション */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-amber-400">🏭 武器工房 個別配置</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {weaponWorkshopBuildings.map((bName) => renderWorkshopMember(bName))}
          </div>
        </div>
      </div>
    </div>
  );
}