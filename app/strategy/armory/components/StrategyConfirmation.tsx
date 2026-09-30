// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

export default function StrategyViewer({ supabase, selectedDate }) {
  const [basicNote, setBasicNote] = useState('');
  const [teleportNote, setTeleportNote] = useState('');
  const [phase2Notes, setPhase2Notes] = useState([]);
  
  const [memberList, setMemberList] = useState([]);
  const [formations, setFormations] = useState([]);
  const [heroesMap, setHeroesMap] = useState({});

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

    // 3. 編成データの取得 (foundry_hero)
    const { data: heroData } = await supabase
      .from('foundry_hero')
      .select('*')
      .eq('eventdate', selectedDate);

    if (heroData) {
      const sorted = heroData.sort((a, b) => {
        if (a.type === b.type) return (a.no || 1) - (b.no || 1);
        return a.type === 'rally' ? -1 : 1;
      });
      setFormations(sorted);
    }

    // 4. 英雄マスタ・英訳データの取得 (heroes)
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

  // 施設リスト
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
    '武器工房(左上)',
    '武器工房(左下)',
    '武器工房(右上)',
    '武器工房(右下)',
  ];

  const weaponWorkshopBuildings = [
    '武器工房(左上)',
    '武器工房(左下)',
    '武器工房(右上)',
    '武器工房(右下)',
  ];

  const phase1RoleOrder = ['Leader', '武器工房', '1', '2', '3', '4', '5', '6', '7', '8'];
  const phase2RoleOrder = ['Leader', '武器工房', '1', '2', '3', '4', '5', '6', '7', '8'];

  // --- コピー関数群 ---

  const copyToClipboard = (text, message = 'コピーしました！') => {
    navigator.clipboard.writeText(text).then(() => {
      alert(message);
    }).catch(err => {
      console.error('コピーに失敗しました', err);
    });
  };

  const handleCopyBasic = () => {
    const content = `【基本】\n${basicNote}`;
    copyToClipboard(content, '【基本】の方針をコピーしました！');
  };

  const handleCopyTeleport = () => {
    const content = `【移転】\n${teleportNote}`;
    copyToClipboard(content, '【移転】の方針をコピーしました！');
  };

  // ④ フェーズ2詳細タイムライン作戦のテキストコピー修正版
  const handleCopyPhase2Timeline = () => {
    let formattedBlocks = phase2Notes.map((r) => {
      const jst = r.jst || '';
      const team = r.team || '';
      const note = r.note || '';
      
      let block = `【${jst}】\n`;
      const noteLines = note.split('\n');
      noteLines.forEach((l) => {
        if (jst) block += `${jst}\n`;
        block += `●${team}：${l}\n`;
      });
      return block.trim();
    }).join('\n\n');

    copyToClipboard(formattedBlocks, 'フェーズ2詳細タイムライン作戦をコピーしました！');
  };

  // 英訳コピーボタン（編成用）
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

  // ⑤ 部隊編成 (集結・駐屯) のテキストコピー
  const handleCopyFormationsText = () => {
    let output = '';
    formations.forEach((item) => {
      const isRally = item.type === 'rally';
      const icon = isRally ? '集結' : '駐屯';
      const shieldRatio = item.shield_ratio ?? 50;
      const spearRatio = item.spear_rasio ?? 0;
      const bowRatio = item.bow_ratio ?? 50;

      const shield = item.shield || '';
      const spear = item.spear || '';
      const bow = item.bow || '';
      const leaders = [shield, spear, bow].filter(Boolean).join('・');

      const joiners = [item.joiner1, item.joiner2, item.joiner3, item.joiner4].filter(Boolean).join('・');

      output += `${icon} — 比率 ${shieldRatio}:${spearRatio}:${bowRatio}\n`;
      output += `集結主：${leaders}\n`;
      output += `指定英雄： ${joiners}\n\n`;
    });

    copyToClipboard(output.trim(), '部隊編成テキストをコピーしました！');
  };

  // フェーズ1配置一覧のテキストコピー
  const handleCopyPhase1Config = () => {
    let output = '';
    phase1Buildings.forEach((bName) => {
      const targetMembers = memberList.filter(
        (m) => Number(m.phase) === 1 && m.building === bName
      );
      if (targetMembers.length === 0) return;

      const sorted = targetMembers.sort((a, b) => {
        const idxA = phase1RoleOrder.indexOf(a.role);
        const idxB = phase1RoleOrder.indexOf(b.role);
        if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        if (a.role === 'Leader') return (b.power || 0) - (a.power || 0);
        return 0;
      });

      output += `${bName}\n`;
      sorted.forEach((m) => {
        output += `${m.role} ${m.name || ''}\n`;
      });
      output += '\n';
    });

    copyToClipboard(output.trim(), 'フェーズ1配置一覧をコピーしました！');
  };

  // フェーズ2配置一覧のテキストコピー
  const handleCopyPhase2Config = () => {
    let output = '';
    phase2Buildings.forEach((bName) => {
      const targetMembers = memberList.filter(
        (m) => Number(m.phase) === 2 && m.building === bName
      );
      if (targetMembers.length === 0) return;

      const sorted = targetMembers.sort((a, b) => {
        const idxA = phase2RoleOrder.indexOf(a.role);
        const idxB = phase2RoleOrder.indexOf(b.role);
        if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        if (a.role === 'Leader') return (b.power || 0) - (a.power || 0);
        return 0;
      });

      output += `${bName}\n`;
      sorted.forEach((m) => {
        output += `${m.role} ${m.name || ''}\n`;
      });
      output += '\n';
    });

    copyToClipboard(output.trim(), 'フェーズ2配置一覧をコピーしました！');
  };

  // ⑥ 武器工房のテキストコピー
  const handleCopyWorkshopText = () => {
    const getNames = (bName) => {
      const target = memberList.filter((m) => Number(m.phase) === 2 && m.building === bName);
      return target.map((m) => m.name).filter(Boolean).join('、');
    };

    const tl = getNames('武器工房(左上)');
    const bl = getNames('武器工房(左下)');
    const tr = getNames('武器工房(右上)');
    const br = getNames('武器工房(右下)');

    const content = `【武器工房】\n左上：${tl}\n左下：${bl}\n右上：${tr}\n右下：${br}`;
    copyToClipboard(content, '武器工房のテキストをコピーしました！');
  };

  // ② マルチタブExcel出力 (.xls形式でタブ分割)
  const exportMultiTabExcel = () => {
    const escXML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<?mso-application progid="Excel.Sheet"?>\n`;
    xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n`;
    xml += ` xmlns:o="urn:schemas-microsoft-com:office:office"\n`;
    xml += ` xmlns:x="urn:schemas-microsoft-com:office:excel"\n`;
    xml += ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n`;
    xml += ` xmlns:html="http://www.w3.org/TR/REC-html40">\n`;

    // 1. 初期配置タブ
    xml += `<Worksheet ss:Name="初期配置">\n<Table>\n`;
    xml += `<Row><Cell><Data ss:Type="String">施設名</Data></Cell><Cell><Data ss:Type="String">役割</Data></Cell><Cell><Data ss:Type="String">アカウント名</Data></Cell></Row>\n`;
    phase1Buildings.forEach((bName) => {
      const targetMembers = memberList.filter((m) => Number(m.phase) === 1 && m.building === bName);
      const sorted = targetMembers.sort((a, b) => {
        const idxA = phase1RoleOrder.indexOf(a.role);
        const idxB = phase1RoleOrder.indexOf(b.role);
        if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        if (a.role === 'Leader') return (b.power || 0) - (a.power || 0);
        return 0;
      });
      sorted.forEach((m) => {
        const roleVal = m.role === 'Leader' ? 'L' : m.role;
        xml += `<Row><Cell><Data ss:Type="String">${escXML(bName)}</Data></Cell><Cell><Data ss:Type="String">${escXML(roleVal)}</Data></Cell><Cell><Data ss:Type="String">${escXML(m.name)}</Data></Cell></Row>\n`;
      });
    });
    xml += `</Table>\n</Worksheet>\n`;

    // 2. フェーズ2タブ
    xml += `<Worksheet ss:Name="フェーズ2">\n<Table>\n`;
    xml += `<Row><Cell><Data ss:Type="String">施設名</Data></Cell><Cell><Data ss:Type="String">役割</Data></Cell><Cell><Data ss:Type="String">アカウント名</Data></Cell></Row>\n`;
    phase2Buildings.forEach((bName) => {
      const targetMembers = memberList.filter((m) => Number(m.phase) === 2 && m.building === bName);
      const sorted = targetMembers.sort((a, b) => {
        const idxA = phase2RoleOrder.indexOf(a.role);
        const idxB = phase2RoleOrder.indexOf(b.role);
        if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        if (a.role === 'Leader') return (b.power || 0) - (a.power || 0);
        return 0;
      });
      sorted.forEach((m) => {
        const roleVal = m.role === 'Leader' ? 'L' : m.role;
        xml += `<Row><Cell><Data ss:Type="String">${escXML(bName)}</Data></Cell><Cell><Data ss:Type="String">${escXML(roleVal)}</Data></Cell><Cell><Data ss:Type="String">${escXML(m.name)}</Data></Cell></Row>\n`;
      });
    });
    xml += `</Table>\n</Worksheet>\n`;

    // 3. 作戦タブ (①改行コードを保持)
    xml += `<Worksheet ss:Name="作戦">\n<Table>\n`;
    xml += `<Row><Cell><Data ss:Type="String">pattern</Data></Cell><Cell><Data ss:Type="String">jst</Data></Cell><Cell><Data ss:Type="String">team</Data></Cell><Cell><Data ss:Type="String">note</Data></Cell></Row>\n`;
    xml += `<Row><Cell><Data ss:Type="String">基本</Data></Cell><Cell><Data ss:Type="String"></Data></Cell><Cell><Data ss:Type="String"></Data></Cell><Cell><Data ss:Type="String">${escXML(basicNote)}</Data></Cell></Row>\n`;
    xml += `<Row><Cell><Data ss:Type="String">teleport</Data></Cell><Cell><Data ss:Type="String"></Data></Cell><Cell><Data ss:Type="String"></Data></Cell><Cell><Data ss:Type="String">${escXML(teleportNote)}</Data></Cell></Row>\n`;
    phase2Notes.forEach((r) => {
      xml += `<Row><Cell><Data ss:Type="String">${escXML(r.pattern || 'phase2')}</Data></Cell><Cell><Data ss:Type="String">${escXML(r.jst)}</Data></Cell><Cell><Data ss:Type="String">${escXML(r.team)}</Data></Cell><Cell><Data ss:Type="String">${escXML(r.note)}</Data></Cell></Row>\n`;
    });
    xml += `</Table>\n</Worksheet>\n`;

    // 4. 編成タブ
    xml += `<Worksheet ss:Name="編成">\n<Table>\n`;
    xml += `<Row><Cell><Data ss:Type="String">集結/駐屯</Data></Cell><Cell><Data ss:Type="String">盾</Data></Cell><Cell><Data ss:Type="String">槍</Data></Cell><Cell><Data ss:Type="String">弓</Data></Cell><Cell><Data ss:Type="String">比率</Data></Cell><Cell><Data ss:Type="String">指定英雄1</Data></Cell><Cell><Data ss:Type="String">指定英雄2</Data></Cell><Cell><Data ss:Type="String">指定英雄3</Data></Cell><Cell><Data ss:Type="String">指定英雄4</Data></Cell></Row>\n`;
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

      xml += `<Row><Cell><Data ss:Type="String">${escXML(typeStr)}</Data></Cell><Cell><Data ss:Type="String">${escXML(shield)}</Data></Cell><Cell><Data ss:Type="String">${escXML(spear)}</Data></Cell><Cell><Data ss:Type="String">${escXML(bow)}</Data></Cell><Cell><Data ss:Type="String">${escXML(ratio)}</Data></Cell><Cell><Data ss:Type="String">${escXML(j1)}</Data></Cell><Cell><Data ss:Type="String">${escXML(j2)}</Data></Cell><Cell><Data ss:Type="String">${escXML(j3)}</Data></Cell><Cell><Data ss:Type="String">${escXML(j4)}</Data></Cell></Row>\n`;
    });
    xml += `</Table>\n</Worksheet>\n`;

    xml += `</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `foundry_all_data_${selectedDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 描画ヘルパー ---

  const renderBuildingMembers = (phaseNum, buildingName) => {
    const targetMembers = memberList.filter(
      (m) => Number(m.phase) === phaseNum && m.building === buildingName
    );

    if (targetMembers.length === 0) return null;

    const roleOrder = phaseNum === 1 ? phase1RoleOrder : phase2RoleOrder;

    const sorted = targetMembers.sort((a, b) => {
      const idxA = roleOrder.indexOf(a.role);
      const idxB = roleOrder.indexOf(b.role);
      if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      if (a.role === 'Leader') return (b.power || 0) - (a.power || 0);
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
      {/* 統合データ出力ボタン (マルチタブ) */}
      <div className="flex flex-wrap gap-2 justify-end bg-[#151c2c] p-3 rounded-xl border border-slate-800">
        <button onClick={exportMultiTabExcel} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition flex items-center gap-1">
          📥 エクセル出力（全タブ統合ファイル）
        </button>
      </div>

      {/* 1. 作戦画面（基本・移転・フェーズ2テーブル） */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">📋 作戦方針・スケジュール</h2>

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
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-white flex items-center gap-2">⚔️ 部隊編成 (集結・駐屯)</h2>
          <div className="flex gap-2">
            <button onClick={handleCopyFormationsText} className="text-[10px] bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 px-2.5 py-1.5 rounded transition font-medium">
              📋 テキストコピー
            </button>
            <button onClick={handleCopyEnglishFormations} className="text-[10px] bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 px-2.5 py-1.5 rounded transition font-medium">
              🌐 英訳コピー
            </button>
          </div>
        </div>
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
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-white flex items-center gap-2">🛡️ フェーズ1 配置一覧</h2>
          <button onClick={handleCopyPhase1Config} className="text-[10px] bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 px-2.5 py-1.5 rounded transition font-medium">
            📋 テキストコピー
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {phase1Buildings.map((building) => renderBuildingMembers(1, building))}
        </div>
      </div>

      {/* 4. フェーズ2 配置・武器工房一覧 */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-white flex items-center gap-2">⚙️ フェーズ2 配置・武器工房一覧</h2>
          <button onClick={handleCopyPhase2Config} className="text-[10px] bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 px-2.5 py-1.5 rounded transition font-medium">
            📋 配置テキストコピー
          </button>
        </div>
        
        {/* 通常施設 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {phase2Buildings.filter(b => !b.startsWith('武器工房')).map((building) => renderBuildingMembers(2, building))}
        </div>

        {/* 武器工房個別セクション */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-amber-400">🏭 武器工房 個別配置</h3>
            <button onClick={handleCopyWorkshopText} className="text-[10px] bg-amber-900/60 hover:bg-amber-800 text-amber-200 px-2.5 py-1.5 rounded transition font-medium">
              📋 武器工房テキストコピー
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {weaponWorkshopBuildings.map((bName) => renderWorkshopMember(bName))}
          </div>
        </div>
      </div>
    </div>
  );
}