// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';

export default function StrategyViewer({ supabase, selectedDate }) {
  const [basicNote, setBasicNote] = useState('');
  const [teleportNote, setTeleportNote] = useState('');
  const [phase2Notes, setPhase2Notes] = useState([]);
  
  const [memberList, setMemberList] = useState([]);
  const [formations, setFormations] = useState([]);

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
      // phase2 またはスペル違いの phese2 を取得
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
      // rally優先、同じtypeならnoが小さい順
      const sorted = heroData.sort((a, b) => {
        if (a.type === b.type) return (a.no || 1) - (b.no || 1);
        return a.type === 'rally' ? -1 : 1;
      });
      setFormations(sorted);
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
  const phase1RoleOrder = ['Leader', '1', '2', '3', '4', '5', '6', '7', '8'];
  // 役割の優先順位 (フェーズ2)
  const phase2RoleOrder = ['Leader', '武器工房', '1', '2', '3', '4', '5', '6', '7', '8'];

  // メンバーリストを指定フェーズ・建物でフィルタ・ソートして描画するヘルパー
  const renderBuildingMembers = (phaseNum, buildingName) => {
    const targetMembers = memberList.filter(
      (m) => Number(m.phase) === phaseNum && m.building === buildingName
    );

    if (targetMembers.length === 0) return null;

    const roleOrder = phaseNum === 1 ? phase1RoleOrder : phase2RoleOrder;

    // ロール順、同ロールならLeaderはパワー大きい順
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

  // 武器工房個別を描画するヘルパー
  const renderWorkshopMember = (buildingName) => {
    const targetMembers = memberList.filter(
      (m) => Number(m.phase) === 2 && m.building === buildingName
    );

    // powerが大きい順にソート
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
      {/* 1. 作戦画面（基本・移転・フェーズ2テーブル） */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">📋 作戦方針・スケジュール</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-bold text-cyan-400">📌 【基本】方針・指示</h3>
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{basicNote || '設定なし'}</p>
          </div>
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-bold text-cyan-400">🚀 【移転】スケジュール・指示</h3>
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{teleportNote || '設定なし'}</p>
          </div>
        </div>

        {/* フェーズ2 タイムライン作戦テーブル */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-xs font-bold text-cyan-400">⏱️ 【フェーズ2】詳細タイムライン作戦</h3>
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
                      <td className="p-2 text-slate-300">{r.note}</td>
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