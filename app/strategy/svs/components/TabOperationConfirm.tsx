'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx-js-style';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TabOperationConfirmProps = {
  selectedDate: string;
};

const FORMATION_KEYS = [
  { key: 'garrison_spear', label: '駐屯(槍編成)' },
  { key: 'garrison_bow', label: '駐屯(弓編成)' },
  { key: 'garrison_mix', label: '駐屯(混合編成)' },
  { key: 'rally_spear', label: '集結(槍編成)' },
  { key: 'rally_bow', label: '集結(弓編成)' },
  { key: 'rally_mix', label: '集結(混合編成)' },
];

const PET_TIME_SLOTS = [
  { key: 'p_2123', label: '21-23' },
  { key: 'p_2325', label: '23-25' },
  { key: 'p_2426', label: '24-26' },
];

const RIDER_TIME_SLOTS = ['21-23', '23-25', '24-26'];

export default function TabOperationConfirm({ selectedDate }: TabOperationConfirmProps) {
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [surveyMaster, setSurveyMaster] = useState<any>(null);

  const [leaders, setLeaders] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [joiners, setJoiners] = useState<any[]>([]);
  const [formationSettings, setFormationSettings] = useState<{ [key: string]: any }>({});
  const [heroAssignments, setHeroAssignments] = useState<any[]>([]);

  const [mainGarrisonRows, setMainGarrisonRows] = useState<{ id?: string; col1: string; col2: string }[]>([
    { col1: '', col2: '' },
  ]);
  const [enemyGarrisonRows, setEnemyGarrisonRows] = useState<{ id?: string; col1: string; col2: string }[]>([
    { col1: '', col2: '' },
  ]);

  const exportRef1 = useRef<HTMLDivElement>(null);
  const exportRef2 = useRef<HTMLDivElement>(null);
  const exportRef3 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      if (!selectedDate) {
        setSurveyId(null);
        setSurveyMaster(null);
        setIsInitializing(false);
        return;
      }

      setIsInitializing(true);

      const { data: masterData, error: masterError } = await supabase
        .from('surveys_master')
        .select('*')
        .eq('survey_type', 'svs')
        .eq('event_date', selectedDate)
        .limit(1);

      if (masterError || !masterData || masterData.length === 0) {
        setSurveyId(null);
        setSurveyMaster(null);
        setIsInitializing(false);
        return;
      }

      const mId = masterData[0].id;
      setSurveyId(mId);
      setSurveyMaster(masterData[0]);

      const [
        { data: leaderData },
        { data: teamData },
        { data: joinerData },
        { data: formSetData },
        { data: assignData },
        { data: memoData },
      ] = await Promise.all([
        supabase.from('strategy_svs_leader').select('*').eq('survey_id', mId),
        supabase.from('svs_team').select('*').eq('survey_id', mId).order('team', { ascending: true }),
        supabase.from('svs_joiner').select('*').eq('survey_id', mId),
        supabase.from('svs_formation_settings').select('*').eq('survey_id', mId),
        supabase.from('svs_hero_assignments').select('*').eq('survey_id', mId),
        supabase.from('svs_operation_memos').select('*').eq('survey_id', mId).order('created_at', { ascending: true }),
      ]);

      if (leaderData) setLeaders(leaderData);
      if (teamData) setTeams(teamData);
      if (joinerData) setJoiners(joinerData);
      if (assignData) setHeroAssignments(assignData);

      if (memoData) {
        const mains = memoData.filter((m: any) => m.memo_type === 'main');
        const enemies = memoData.filter((m: any) => m.memo_type === 'enemy');
        if (mains.length > 0) {
          setMainGarrisonRows(mains.map((m: any) => ({ id: m.id, col1: m.col1 || '', col2: m.col2 || '' })));
        }
        if (enemies.length > 0) {
          setEnemyGarrisonRows(enemies.map((m: any) => ({ id: m.id, col1: m.col1 || '', col2: m.col2 || '' })));
        }
      }

      if (formSetData) {
        const settingsMap: { [key: string]: any } = {};
        formSetData.forEach((item: any) => {
          settingsMap[item.formation_key] = item;
        });
        setFormationSettings(settingsMap);
      }

      setIsInitializing(false);
    }

    fetchData();
  }, [selectedDate]);

  const addRow = async (type: 'main' | 'enemy') => {
    if (!surveyId) return;
    const { data, error } = await supabase
      .from('svs_operation_memos')
      .insert([{ survey_id: surveyId, memo_type: type, col1: '', col2: '' }])
      .select()
      .single();

    if (!error && data) {
      if (type === 'main') {
        setMainGarrisonRows([...mainGarrisonRows, { id: data.id, col1: '', col2: '' }]);
      } else {
        setEnemyGarrisonRows([...enemyGarrisonRows, { id: data.id, col1: '', col2: '' }]);
      }
    }
  };

  const removeRow = async (type: 'main' | 'enemy', id?: string) => {
    if (id) {
      await supabase.from('svs_operation_memos').delete().eq('id', id);
    }
    if (type === 'main') {
      const updated = mainGarrisonRows.filter((r) => r.id !== id);
      setMainGarrisonRows(updated.length > 0 ? updated : [{ col1: '', col2: '' }]);
    } else {
      const updated = enemyGarrisonRows.filter((r) => r.id !== id);
      setEnemyGarrisonRows(updated.length > 0 ? updated : [{ col1: '', col2: '' }]);
    }
  };

  const updateRow = async (type: 'main' | 'enemy', index: number, field: 'col1' | 'col2', value: string) => {
    if (type === 'main') {
      const updated = [...mainGarrisonRows];
      updated[index][field] = value;
      setMainGarrisonRows(updated);
      const rowId = updated[index].id;
      if (rowId && surveyId) {
        await supabase.from('svs_operation_memos').update({ [field]: value }).eq('id', rowId);
      }
    } else {
      const updated = [...enemyGarrisonRows];
      updated[index][field] = value;
      setEnemyGarrisonRows(updated);
      const rowId = updated[index].id;
      if (rowId && surveyId) {
        await supabase.from('svs_operation_memos').update({ [field]: value }).eq('id', rowId);
      }
    }
  };

  const handleExport = async (targetRef: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!targetRef.current) return;
    try {
      const dataUrl = await toPng(targetRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        style: {
          visibility: 'visible',
          position: 'static',
          left: 'auto',
          top: 'auto',
        },
      });

      const link = document.createElement('a');
      link.download = `${filename}_${selectedDate}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert('画像の書き出しに失敗しました。');
    }
  };

  const handleExcelExport = (sectionType: 'section1' | 'section2' | 'section3') => {
    try {
      const wb = XLSX.utils.book_new();
      let wsData: any[][] = [];
      let sheetName = 'シート';

      const thinBorder = {
        top: { style: "thin", color: { rgb: "CBD5E1" } },
        bottom: { style: "thin", color: { rgb: "CBD5E1" } },
        left: { style: "thin", color: { rgb: "CBD5E1" } },
        right: { style: "thin", color: { rgb: "CBD5E1" } },
      };

      const subHeaderStyle = {
        font: { bold: true, color: { rgb: "0F172A" }, name: "Meiryo", sz: 10 },
        fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
        alignment: { vertical: "center", horizontal: "left", wrapText: true },
        border: thinBorder
      };

      const sectionHeaderStyle = {
        font: { bold: true, color: { rgb: "1E293B" }, name: "Meiryo", sz: 11 },
        alignment: { vertical: "center", horizontal: "left" }
      };

      const defaultCellStyle = {
        font: { name: "Meiryo", sz: 10 },
        border: thinBorder,
        alignment: { vertical: "center", horizontal: "left", wrapText: true }
      };

      const eventInfoText = `イベント日: ${selectedDate}${surveyMaster?.mattching ? ` / 対戦相手: ${surveyMaster.mattching}` : ''}`;

      if (sectionType === 'section1') {
        sheetName = '集結主シート';
        wsData.push([`① 集結主・ラリー確認シート`]);
        wsData.push([eventInfoText]);
        wsData.push([]);
        wsData.push(['■ ペット時間一覧']);
        wsData.push(['時間帯', '人数', '担当者ペット']);
        PET_TIME_SLOTS.forEach((slot) => {
          const matchedLeaders = leaders.filter((l) => l[slot.key] === true);
          wsData.push([slot.label, `${matchedLeaders.length}名`, matchedLeaders.map(l => l.name).join(', ')]);
        });
        wsData.push([]);
        wsData.push(['■ ラリー表 (時間帯別)']);
        wsData.push(['時間帯', '駐屯', 'ゴースト1', 'ゴースト2', 'ゴースト3']);
        const rallySlotsData = [
          { timeLabel: '21-23', rField: 'r_2123', mField: 'm_2123', pCheck: (l: any) => !!l.p_2123 },
          { timeLabel: '23-24', rField: 'r_2325', mField: 'm_2324', pCheck: (l: any) => !!l.p_2325 },
          { timeLabel: '24-25', rField: 'r_2325', mField: 'm_2425', pCheck: (l: any) => !!l.p_2325 || !!l.p_2426 },
          { timeLabel: '25-26', rField: 'r_2526', mField: 'm_2526', pCheck: (l: any) => !!l.p_2426 },
        ];
        rallySlotsData.forEach((slot) => {
          const cols = ['garrison', 'ghost1', 'ghost2', 'ghost3'];
          const rowValues: any[5] = [slot.timeLabel];
          cols.forEach((col) => {
            const matched = leaders.filter((l) => (l[slot.rField] || '').toLowerCase() === col);
            rowValues.push(matched.map(l => `${l.name}${l[slot.mField] ? ` (${l[slot.mField]}s)` : ''}`).join(', '));
          });
          wsData.push(rowValues);
        });
        wsData.push([]);
        wsData.push(['■ 編成表（リーダー）']);
        wsData.push(['編成名', '盾英雄', '槍英雄', '弓英雄', '比率', '備考']);
        FORMATION_KEYS.forEach((form) => {
          const setting = formationSettings[form.key];
          if (setting && setting.enabled === true) {
            wsData.push([
              form.label,
              setting.shield_hero || '-',
              setting.spear_hero || '-',
              setting.bow_hero || '-',
              `${setting.ratio_shield ?? 0}:${setting.ratio_spear ?? 0}:${setting.ratio_bow ?? 0}`,
              setting.memo || ''
            ]);
          }
        });
      } else if (sectionType === 'section2') {
        sheetName = '乗り手チームシート';
        wsData.push([`② 乗り手チーム確認シート`]);
        wsData.push([eventInfoText]);
        wsData.push([]);
        wsData.push(['■ 乗り手チーム編成（ペット時間帯別）']);
        const teamHeaders = ['時間帯', ...teams.map(t => `チーム ${t.team} (${t.alliance || '-'})`)];
        wsData.push(teamHeaders);
        RIDER_TIME_SLOTS.forEach((timeSlot) => {
          const pFieldKey = timeSlot === '21-23' ? 'p_2123' : timeSlot === '23-25' ? 'p_2325' : 'p_2426';
          const rowValues: any[] = [timeSlot];
          teams.forEach((t) => {
            const matched = joiners.filter((j) => j.team === t.team && j[pFieldKey] === true);
            rowValues.push(matched.map(j => j.name).join(', '));
          });
          wsData.push(rowValues);
        });
      } else {
        sheetName = '作戦画面メモシート';
        wsData.push([`③ 作戦画面メモ・指示シート`]);
        wsData.push([eventInfoText]);
        wsData.push([]);
        wsData.push(['■ メイン同盟が駐屯している時', '', '■ 敵同盟が駐屯している時', '']);
        wsData.push(['左側メモ', '右側メモ', '左側メモ', '右側メモ']);
        
        const maxLen = Math.max(mainGarrisonRows.length, enemyGarrisonRows.length);
        for (let i = 0; i < maxLen; i++) {
          const mainR = mainGarrisonRows[i] || { col1: '', col2: '' };
          const enemyR = enemyGarrisonRows[i] || { col1: '', col2: '' };
          wsData.push([mainR.col1, mainR.col2, enemyR.col1, enemyR.col2]);
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const range = XLSX.utils.decode_range(ws['!ref'] || "A1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellAddress];
          if (!cell) continue;

          if (!cell.s) cell.s = {};

          const cellValue = String(cell.v || '');

          if (cellValue.startsWith('■')) {
            cell.s = sectionHeaderStyle;
          } else if (
            cellValue === '時間帯' || cellValue === '編成名' || cellValue === '左側メモ' || cellValue === '右側メモ' ||
            cellValue.includes('チーム ') || cellValue.includes('人数') || cellValue.includes('駐屯') || cellValue.includes('ゴースト')
          ) {
            cell.s = subHeaderStyle;
          } else {
            cell.s = defaultCellStyle;
          }
        }
      }

      ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 15 }, { wch: 35 }];

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${sheetName}_${selectedDate}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Excelの書き出しに失敗しました。');
    }
  };

  if (!selectedDate) {
    return <div className="text-center py-12 text-slate-400">上部の日付を選択してください。</div>;
  }

  if (isInitializing) {
    return <div className="text-center py-12 text-slate-400">読み込み中...</div>;
  }

  const rallySlots = [
    { timeLabel: '21-23', rField: 'r_2123', mField: 'm_2123', pCheck: (l: any) => !!l.p_2123 },
    { timeLabel: '23-24', rField: 'r_2325', mField: 'm_2324', pCheck: (l: any) => !!l.p_2325 },
    { timeLabel: '24-25', rField: 'r_2325', mField: 'm_2425', pCheck: (l: any) => !!l.p_2325 || !!l.p_2426 },
    { timeLabel: '25-26', rField: 'r_2526', mField: 'm_2526', pCheck: (l: any) => !!l.p_2426 },
  ];

  const exportSubtitle = `イベント日: ${selectedDate}${surveyMaster?.mattching ? ` / 対戦相手: ${surveyMaster.mattching}` : ''}`;

  return (
    <div className="space-y-12 pb-12">
      {/* ========================================================================= */}
      {/* ① 集結主 セクション */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h2 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <span>👑</span> ① 集結主
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport(exportRef1, '集結主シート')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>🖼️</span> 画像をExport
            </button>
            <button
              type="button"
              onClick={() => handleExcelExport('section1')}
              className="px-3 py-1 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-700 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>📊</span> ExcelでExport
            </button>
          </div>
        </div>

        <div className="p-4 bg-[#0b0f19] rounded-xl space-y-6">
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-200">■ ペット時間一覧</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PET_TIME_SLOTS.map((slot) => {
                const matchedLeaders = leaders.filter((l) => l[slot.key] === true);
                return (
                  <div key={slot.key} className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-bold text-cyan-300 border-b border-slate-800 pb-1.5 flex justify-between">
                      <span>{slot.label}</span>
                      <span className="text-[10px] text-slate-400">({matchedLeaders.length}名)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedLeaders.length === 0 ? (
                        <span className="text-[11px] text-slate-500">該当者なし</span>
                      ) : (
                        matchedLeaders.map((l, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-800 text-white rounded text-[11px] border border-slate-700">
                            {l.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-200">■ ラリー表 (時間帯別)</h3>
            <div className="space-y-4">
              {rallySlots.map((slot) => {
                const columns = ['garrison', 'ghost1', 'ghost2', 'ghost3'];
                const columnLabels: { [key: string]: string } = {
                  garrison: '駐屯',
                  ghost1: 'ゴースト1',
                  ghost2: 'ゴースト2',
                  ghost3: 'ゴースト3',
                };

                return (
                  <div key={slot.timeLabel} className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-bold text-cyan-300 border-b border-slate-800 pb-1">
                      時間帯: {slot.timeLabel}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            {columns.map((col) => (
                              <th key={col} className="p-2 font-medium">{columnLabels[col]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {columns.map((col) => {
                              const matchedLeaders = leaders.filter((l) => {
                                const rVal = l[slot.rField];
                                if (!rVal) return false;
                                return rVal.toLowerCase() === col.toLowerCase();
                              });

                              return (
                                <td key={col} className="p-2 border-t border-slate-800/50 align-top">
                                  <div className="space-y-1.5">
                                    {matchedLeaders.length === 0 ? (
                                      <span className="text-[10px] text-slate-600">未配置</span>
                                    ) : (
                                      matchedLeaders.map((l, lIdx) => {
                                        const isPetActive = slot.pCheck(l);
                                        const marchTime = l[slot.mField];
                                        return (
                                          <div
                                            key={lIdx}
                                            className={`p-2 rounded text-[11px] border flex flex-col gap-0.5 ${
                                              isPetActive
                                                ? 'bg-amber-950/40 border-amber-800/80 text-amber-300 font-bold'
                                                : 'bg-slate-900 border-slate-800 text-slate-200'
                                            }`}
                                          >
                                            <div className="flex justify-between items-center">
                                              <span>{l.name}</span>
                                              {marchTime && (
                                                <span className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px] border border-slate-700 font-mono">
                                                  行軍: {marchTime}s
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-200">■ 編成表（リーダー）</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FORMATION_KEYS.map((form) => {
                const setting = formationSettings[form.key];
                if (!setting || setting.enabled !== true) return null;

                const shieldHero = setting.shield_hero || '-';
                const spearHero = setting.spear_hero || '-';
                const bowHero = setting.bow_hero || '-';
                const ratioShield = setting.ratio_shield ?? 0;
                const ratioSpear = setting.ratio_spear ?? 0;
                const ratioBow = setting.ratio_bow ?? 0;
                const memoText = setting.memo || '';

                return (
                  <div key={form.key} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-cyan-300 border-b border-slate-800 pb-1.5">
                      {form.label}
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2.5 grid grid-cols-3 text-center gap-2">
                      <div>
                        <div className="text-[10px] text-slate-400 mb-0.5">盾英雄</div>
                        <div className="text-xs text-white font-medium">{shieldHero}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 mb-0.5">槍英雄</div>
                        <div className="text-xs text-white font-medium">{spearHero}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 mb-0.5">弓英雄</div>
                        <div className="text-xs text-white font-medium">{bowHero}</div>
                      </div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-2 flex justify-between items-center text-xs">
                      <span className="text-slate-400 text-[11px]">比率</span>
                      <span className="font-mono font-bold text-cyan-400 w-full text-center">{ratioShield}:{ratioSpear}:{ratioBow}</span>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-2 text-xs">
                      <span className="text-slate-400 text-[11px] block mb-0.5">備考</span>
                      <span className="text-slate-200 text-xs whitespace-pre-wrap">{memoText || '-'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ② 乗り手チーム セクション */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h2 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <span>🛡️</span> ② 乗り手チーム
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport(exportRef2, '乗り手チームシート')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>🖼️</span> 画像をExport
            </button>
            <button
              type="button"
              onClick={() => handleExcelExport('section2')}
              className="px-3 py-1 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-700 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>📊</span> ExcelでExport
            </button>
          </div>
        </div>

        <div className="p-4 bg-[#0b0f19] rounded-xl space-y-6">
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-200">■ 乗り手チーム編成（ペット時間帯別）</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border border-slate-800">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                    <th className="p-2.5 font-medium w-24 border-r border-slate-800">時間帯</th>
                    {teams.map((t) => (
                      <th key={t.team} className="p-2.5 font-medium border-l border-slate-800 text-center">
                        <div className="text-cyan-300 font-bold">チーム {t.team}</div>
                        <div className="text-[10px] text-slate-400 font-normal">({t.alliance || '-'})</div>
                        {t.position && (
                          <div className="text-[10px] text-amber-400 font-semibold mt-0.5">{t.position}</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RIDER_TIME_SLOTS.map((timeSlot) => {
                    const pFieldKey = timeSlot === '21-23' ? 'p_2123' : timeSlot === '23-25' ? 'p_2325' : 'p_2426';
                    return (
                      <tr key={timeSlot} className="border-t border-slate-800">
                        <td className="p-2.5 font-bold text-cyan-300 bg-[#0b0f19] border-r border-slate-800 text-center">{timeSlot}</td>
                        {teams.map((t) => {
                          const matchedJoiners = joiners.filter(
                            (j) => j.team === t.team && j[pFieldKey] === true
                          );
                          return (
                            <td key={t.team} className="p-2.5 border-l border-slate-800 align-top bg-[#0b0f19]/40">
                              <div className="flex flex-wrap gap-1">
                                {matchedJoiners.length === 0 ? (
                                  <span className="text-[11px] text-slate-500">-</span>
                                ) : (
                                  matchedJoiners.map((j, jIdx) => (
                                    <span key={jIdx} className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded text-[11px]">
                                      {j.name}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-200">■ 乗り手指定英雄・構成</h3>
            <div className="space-y-6">
              {FORMATION_KEYS.map((form) => {
                const setting = formationSettings[form.key];
                if (!setting || setting.enabled !== true) return null;

                const isJoinerAssign = !!setting.joiner_assign;
                const joinerHeroes = [
                  setting.joiner_hero_1,
                  setting.joiner_hero_2,
                  setting.joiner_hero_3,
                  setting.joiner_hero_4,
                ].filter(Boolean);

                if (joinerHeroes.length === 0) return null;

                const activeTeams = teams.filter((t) => {
                  const assignRow = heroAssignments.find(
                    (a) => a.survey_id === surveyId && a.formation_key === form.key && a.team === t.team
                  );
                  if (!assignRow) return false;
                  return Object.keys(assignRow).some((k) => k.includes('assign') && assignRow[k]);
                });

                if (isJoinerAssign && activeTeams.length === 0) return null;

                const ratioShield = setting.ratio_shield ?? 0;
                const ratioSpear = setting.ratio_spear ?? 0;
                const ratioBow = setting.ratio_bow ?? 0;

                return (
                  <div key={form.key} className="bg-[#0b0f19] border border-slate-800 rounded-lg p-4 space-y-3">
                    <div className="text-xs font-bold text-cyan-300 border-b border-slate-800 pb-1.5 flex justify-between items-center">
                      <span>{form.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-cyan-400 text-xs">比率: {ratioShield}:{ratioSpear}:{ratioBow}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400">
                          {isJoinerAssign ? '指定英雄設定あり' : '乗り手英雄表示'}
                        </span>
                      </div>
                    </div>

                    {isJoinerAssign ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="p-2 font-medium w-20">チーム</th>
                              <th className="p-2 font-medium w-24 border-l border-slate-800">役割 (順)</th>
                              {joinerHeroes.map((hName, hIdx) => (
                                <th key={hIdx} className="p-2 font-medium border-l border-slate-800 whitespace-nowrap">{hName}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activeTeams.map((t) => {
                              const assignRow = heroAssignments.find(
                                (a) => a.survey_id === surveyId && a.formation_key === form.key && a.team === t.team
                              );

                              const rowsData = [1, 2, 3].map((seq) => {
                                const slots = joinerHeroes.map((_, hIdx) => {
                                  if (hIdx === 0) {
                                    return seq === 1 
                                      ? (assignRow?.hero_1_assign_1 ?? assignRow?.assign_1) 
                                      : seq === 2 
                                      ? assignRow?.hero_1_assign_2 
                                      : assignRow?.hero_1_assign_3;
                                  } else if (hIdx === 1) {
                                    return seq === 1 ? assignRow?.hero_2_assign_1 : seq === 2 ? assignRow?.hero_2_assign_2 : assignRow?.hero_2_assign_3;
                                  } else if (hIdx === 2) {
                                    return seq === 1 ? assignRow?.hero_3_assign_1 : seq === 2 ? assignRow?.hero_3_assign_2 : assignRow?.hero_3_assign_3;
                                  } else if (hIdx === 3) {
                                    return seq === 1 ? assignRow?.hero_4_assign_1 : seq === 2 ? assignRow?.hero_4_assign_2 : assignRow?.hero_4_assign_3;
                                  }
                                  return null;
                                });
                                const roleLabel = String(seq);
                                return { seq, roleLabel, slots };
                              });

                              return rowsData.map((rd, rIdx) => (
                                <tr key={`${t.team}-${rd.seq}`} className={rIdx === 0 ? "border-t border-slate-800" : "border-t border-slate-800/40"}>
                                  {rIdx === 0 && (
                                    <td rowSpan={3} className="p-2 font-bold text-cyan-200 align-middle border-r border-slate-800/60">
                                      チーム {t.team}
                                    </td>
                                  )}
                                  <td className="p-2 text-slate-300 font-medium border-l border-slate-800">
                                    {rd.roleLabel}
                                  </td>
                                  {rd.slots.map((name, hIdx) => (
                                    <td key={hIdx} className="p-2 border-l border-slate-800 align-top">
                                      {name ? (
                                        <div className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-white inline-block whitespace-nowrap">
                                          {name}
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-slate-600">-</span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {joinerHeroes.map((hName, hIdx) => (
                          <div key={hIdx} className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-cyan-400">🔹</span> {hName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ③ 作戦画面メモ・指示 セクション */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h2 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <span>📋</span> ③ 作戦画面メモ・指示
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport(exportRef3, '作戦画面メモシート')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>🖼️</span> 画像をExport
            </button>
            <button
              type="button"
              onClick={() => handleExcelExport('section3')}
              className="px-3 py-1 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-700 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>📊</span> ExcelでExport
            </button>
          </div>
        </div>

        <div className="p-4 bg-[#0b0f19] rounded-xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-200">■ メイン同盟が駐屯している時</h3>
                <button
                  type="button"
                  onClick={() => addRow('main')}
                  className="px-2.5 py-1 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded text-xs font-bold hover:bg-cyan-900 transition-colors cursor-pointer"
                >
                  ＋ 行を追加
                </button>
              </div>
              <div className="space-y-3">
                {mainGarrisonRows.map((row, idx) => (
                  <div key={row.id || idx} className="flex items-start gap-2">
                    <span className="text-[10px] text-slate-500 w-4 pt-2">{idx + 1}</span>
                    <textarea
                      value={row.col1}
                      onChange={(e) => updateRow('main', idx, 'col1', e.target.value)}
                      placeholder="左側を入力（長文可能）"
                      rows={3}
                      className="w-full bg-[#0b0f19] border border-slate-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-y"
                    />
                    <textarea
                      value={row.col2}
                      onChange={(e) => updateRow('main', idx, 'col2', e.target.value)}
                      placeholder="右側を入力（長文可能）"
                      rows={3}
                      className="w-full bg-[#0b0f19] border border-slate-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow('main', row.id)}
                      className="text-rose-400 hover:text-rose-300 px-2.5 py-2 bg-rose-950/40 border border-rose-900/50 rounded text-xs cursor-pointer mt-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-200">■ 敵同盟が駐屯している時</h3>
                <button
                  type="button"
                  onClick={() => addRow('enemy')}
                  className="px-2.5 py-1 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded text-xs font-bold hover:bg-cyan-900 transition-colors cursor-pointer"
                >
                  ＋ 行を追加
                </button>
              </div>
              <div className="space-y-3">
                {enemyGarrisonRows.map((row, idx) => (
                  <div key={row.id || idx} className="flex items-start gap-2">
                    <span className="text-[10px] text-slate-500 w-4 pt-2">{idx + 1}</span>
                    <textarea
                      value={row.col1}
                      onChange={(e) => updateRow('enemy', idx, 'col1', e.target.value)}
                      placeholder="左側を入力（長文可能）"
                      rows={3}
                      className="w-full bg-[#0b0f19] border border-slate-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-y"
                    />
                    <textarea
                      value={row.col2}
                      onChange={(e) => updateRow('enemy', idx, 'col2', e.target.value)}
                      placeholder="右側を入力（長文可能）"
                      rows={3}
                      className="w-full bg-[#0b0f19] border border-slate-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow('enemy', row.id)}
                      className="text-rose-400 hover:text-rose-300 px-2.5 py-2 bg-rose-950/40 border border-rose-900/50 rounded text-xs cursor-pointer mt-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 画面外：セクション①用 Export専用DOM */}
      {/* ========================================================================= */}
      <div className="absolute left-[-9999px] top-[-9999px]" style={{ pointerEvents: 'none' }}>
        <div ref={exportRef1} className="w-[1000px] bg-white text-slate-900 p-8 font-sans space-y-6">
          <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-end">
            <div>
              <h1 className="text-xl font-bold text-slate-900">① 集結主・ラリー確認シート</h1>
              <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line font-medium">
                {exportSubtitle}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-900 border-l-4 border-slate-900 pl-2 mb-2">■ ペット時間一覧</h2>
            <div className="grid grid-cols-3 gap-4">
              {PET_TIME_SLOTS.map((slot) => {
                const matchedLeaders = leaders.filter((l) => l[slot.key] === true);
                return (
                  <div key={slot.key} className="border border-slate-300 rounded p-2.5 bg-slate-50">
                    <div className="text-xs font-bold text-[#2a437e] border-b border-slate-300 pb-1 mb-1.5 flex justify-between">
                      <span>{slot.label}</span>
                      <span className="text-[10px] text-slate-500">({matchedLeaders.length}名)</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {matchedLeaders.length === 0 ? (
                        <span className="text-[10px] text-slate-400">該当者なし</span>
                      ) : (
                        matchedLeaders.map((l, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-white border border-slate-300 text-slate-800 rounded text-[10px]">
                            {l.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-900 border-l-4 border-slate-900 pl-2 mb-2">■ ラリー表 (時間帯別)</h2>
            <table className="w-full text-xs border-collapse border border-slate-400 text-center">
              <thead>
                <tr className="bg-[#2a437e] text-white font-bold">
                  <th className="border border-slate-400 p-1.5 w-20">時間帯</th>
                  <th className="border border-slate-400 p-1.5">駐屯</th>
                  <th className="border border-slate-400 p-1.5">ゴースト1</th>
                  <th className="border border-slate-400 p-1.5">ゴースト2</th>
                  <th className="border border-slate-400 p-1.5">ゴースト3</th>
                </tr>
              </thead>
              <tbody>
                {rallySlots.map((slot) => {
                  const cols = ['garrison', 'ghost1', 'ghost2', 'ghost3'];
                  return (
                    <tr key={slot.timeLabel} className="border-b border-slate-300">
                      <td className="border border-slate-400 p-2 font-bold bg-slate-50">{slot.timeLabel}</td>
                      {cols.map((col) => {
                        const matched = leaders.filter((l) => (l[slot.rField] || '').toLowerCase() === col);
                        return (
                          <td key={col} className="border border-slate-400 p-1.5 align-top text-left">
                            {matched.length === 0 ? (
                              <span className="text-slate-300">-</span>
                            ) : (
                              matched.map((l, i) => {
                                const isPetActive = slot.pCheck(l);
                                return (
                                  <div key={i} className={`text-[11px] ${isPetActive ? 'font-bold text-amber-700' : 'text-slate-800'}`}>
                                    {l.name}
                                    {l[slot.mField] && <span className="text-[9px] text-slate-500 font-normal"> ({l[slot.mField]}s)</span>}
                                  </div>
                                );
                              })
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-900 border-l-4 border-slate-900 pl-2 mb-2">■ 編成表（リーダー）</h2>
            <div className="space-y-2">
              {FORMATION_KEYS.map((form) => {
                const setting = formationSettings[form.key];
                if (!setting || setting.enabled !== true) return null;
                return (
                  <div key={form.key} className="border border-slate-300 rounded p-2.5 bg-slate-50 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <div>
                        <span className="font-bold text-[#2a437e] mr-3">{form.label}</span>
                        <span className="text-slate-700 mr-2">盾：{setting.shield_hero || '-'}</span>
                        <span className="text-slate-700 mr-2">槍：{setting.spear_hero || '-'}</span>
                        <span className="text-slate-700">弓：{setting.bow_hero || '-'}</span>
                      </div>
                      {setting.memo && (
                        <div className="text-slate-600 text-[11px] whitespace-pre-wrap">
                          {setting.memo}
                        </div>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-center shrink-0 ml-4">
                      {setting.ratio_shield ?? 0}:{setting.ratio_spear ?? 0}:{setting.ratio_bow ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 画面外：セクション②用 Export専用DOM */}
      {/* ========================================================================= */}
      <div className="absolute left-[-9999px] top-[-9999px]" style={{ pointerEvents: 'none' }}>
        <div ref={exportRef2} className="w-[1000px] bg-white text-slate-900 p-8 font-sans space-y-6">
          <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-end">
            <div>
              <h1 className="text-xl font-bold text-slate-900">② 乗り手チーム確認シート</h1>
              <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line font-medium">
                {exportSubtitle}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-900 border-l-4 border-slate-900 pl-2 mb-2">■ 乗り手チーム編成（ペット時間帯別）</h2>
            <table className="w-full text-xs border-collapse border border-slate-400">
              <thead>
                <tr className="bg-[#2a437e] text-white text-center">
                  <th className="border border-slate-400 p-2.5 w-24">時間帯</th>
                  {teams.map((t) => (
                    <th key={t.team} className="border border-slate-400 p-2.5">
                      チーム {t.team} <span className="text-[10px] font-normal">({t.alliance || '-'})</span>
                      {t.position && <div className="text-[10px] text-amber-200 mt-0.5">{t.position}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RIDER_TIME_SLOTS.map((timeSlot) => {
                  const pFieldKey = timeSlot === '21-23' ? 'p_2123' : timeSlot === '23-25' ? 'p_2325' : 'p_2426';
                  return (
                    <tr key={timeSlot}>
                      <td className="border border-slate-400 p-2.5 font-bold bg-slate-50 text-center">{timeSlot}</td>
                      {teams.map((t) => {
                        const matched = joiners.filter((j) => j.team === t.team && j[pFieldKey] === true);
                        return (
                          <td key={t.team} className="border border-slate-400 p-2.5 align-top bg-white">
                            <div className="flex flex-wrap gap-1">
                              {matched.length === 0 ? (
                                <span className="text-slate-300">-</span>
                              ) : (
                                matched.map((j, jIdx) => (
                                  <span key={jIdx} className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] text-slate-800">
                                    {j.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-900 border-l-4 border-slate-900 pl-2 mb-2">■ 乗り手指定英雄・構成</h2>
            <div className="space-y-4">
              {FORMATION_KEYS.map((form) => {
                const setting = formationSettings[form.key];
                if (!setting || setting.enabled !== true) return null;

                const isJoinerAssign = !!setting.joiner_assign;
                const joinerHeroes = [
                  setting.joiner_hero_1,
                  setting.joiner_hero_2,
                  setting.joiner_hero_3,
                  setting.joiner_hero_4,
                ].filter(Boolean);

                if (joinerHeroes.length === 0) return null;

                const activeTeams = teams.filter((t) => {
                  const assignRow = heroAssignments.find(
                    (a) => a.survey_id === surveyId && a.formation_key === form.key && a.team === t.team
                  );
                  if (!assignRow) return false;
                  return Object.keys(assignRow).some((k) => k.includes('assign') && assignRow[k]);
                });

                if (isJoinerAssign && activeTeams.length === 0) return null;

                const ratioShield = setting.ratio_shield ?? 0;
                const ratioSpear = setting.ratio_spear ?? 0;
                const ratioBow = setting.ratio_bow ?? 0;

                return (
                  <div key={form.key}>
                    <div className="text-xs font-bold bg-slate-200 px-3 py-1.5 border border-slate-400 border-b-0 rounded-t-md text-[#2a437e] flex justify-between items-center">
                      <span>{form.label}</span>
                      <span className="font-mono text-slate-700">比率: {ratioShield}:{ratioSpear}:{ratioBow}</span>
                    </div>

                    {isJoinerAssign ? (
                      <table className="w-full text-xs border-collapse border border-slate-400 text-center">
                        <thead>
                          <tr className="bg-[#2a437e] text-white">
                            <th className="border border-slate-400 p-2 w-20">チーム</th>
                            <th className="border border-slate-400 p-2 w-20">役割 (順)</th>
                            {joinerHeroes.map((hName, idx) => (
                              <th key={idx} className="border border-slate-400 p-2 whitespace-nowrap">{hName}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeTeams.map((t) => {
                            const assignRow = heroAssignments.find(
                              (a) => a.survey_id === surveyId && a.formation_key === form.key && a.team === t.team
                            );
                            return [1, 2, 3].map((seq, sIdx) => {
                              let names: (string | null)[] = [];
                              if (seq === 1) {
                                names = [
                                  assignRow?.hero_1_assign_1 ?? assignRow?.assign_1,
                                  assignRow?.hero_2_assign_1,
                                  assignRow?.hero_3_assign_1,
                                  assignRow?.hero_4_assign_1,
                                ];
                              } else if (seq === 2) {
                                names = [
                                  assignRow?.hero_1_assign_2,
                                  assignRow?.hero_2_assign_2,
                                  assignRow?.hero_3_assign_2,
                                  assignRow?.hero_4_assign_2,
                                ];
                              } else {
                                names = [
                                  assignRow?.hero_1_assign_3,
                                  assignRow?.hero_2_assign_3,
                                  assignRow?.hero_3_assign_3,
                                  assignRow?.hero_4_assign_3,
                                ];
                              }

                              const roleLabel = String(seq);

                              return (
                                <tr key={`${t.team}-${seq}`}>
                                  {sIdx === 0 && (
                                    <td rowSpan={3} className="border border-slate-400 p-2 font-bold bg-slate-50 align-middle">
                                      チーム {t.team}
                                    </td>
                                  )}
                                  <td className="border border-slate-400 p-2 bg-slate-50 text-slate-700">
                                    {roleLabel}
                                  </td>
                                  {joinerHeroes.map((_, hIdx) => (
                                    <td key={hIdx} className="border border-slate-400 p-2 text-left whitespace-nowrap bg-white">
                                      {names[hIdx] || '-'}
                                    </td>
                                  ))}
                                </tr>
                              );
                            });
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="border border-slate-400 border-t-0 p-3 bg-white flex flex-wrap gap-2 rounded-b-md">
                        {joinerHeroes.map((hName, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-xs text-slate-800 whitespace-nowrap">
                            🔹 {hName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 画面外：セクション③用 Export専用DOM */}
      {/* ========================================================================= */}
      <div className="absolute left-[-9999px] top-[-9999px]" style={{ pointerEvents: 'none' }}>
        <div ref={exportRef3} className="w-[1000px] bg-white text-slate-900 p-8 font-sans space-y-6">
          <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-end">
            <div>
              <h1 className="text-xl font-bold text-slate-900">③ 作戦画面メモ・指示シート</h1>
              <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line font-medium">
                {exportSubtitle}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="border border-slate-400 rounded-md overflow-hidden bg-white shadow-sm">
              <h2 className="text-xs font-bold bg-[#2a437e] text-white px-3 py-2 border-b border-slate-400">
                ■ メイン同盟が駐屯している時
              </h2>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {mainGarrisonRows.map((r, i) => (
                    <tr key={r.id || i} className="border-b border-slate-300 last:border-b-0">
                      <td className="border-r border-slate-300 p-3 w-1/2 align-top whitespace-pre-wrap bg-white">
                        {r.col1 || '-'}
                      </td>
                      <td className="p-3 w-1/2 align-top whitespace-pre-wrap bg-white">
                        {r.col2 || '-'}
                      </td>
                    </tr>
                  ))}
                  {mainGarrisonRows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-slate-400 bg-white">（記載なし）</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border border-slate-400 rounded-md overflow-hidden bg-white shadow-sm">
              <h2 className="text-xs font-bold bg-[#2a437e] text-white px-3 py-2 border-b border-slate-400">
                ■ 敵同盟が駐屯している時
              </h2>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {enemyGarrisonRows.map((r, i) => (
                    <tr key={r.id || i} className="border-b border-slate-300 last:border-b-0">
                      <td className="border-r border-slate-300 p-3 w-1/2 align-top whitespace-pre-wrap bg-white">
                        {r.col1 || '-'}
                      </td>
                      <td className="p-3 w-1/2 align-top whitespace-pre-wrap bg-white">
                        {r.col2 || '-'}
                      </td>
                    </tr>
                  ))}
                  {enemyGarrisonRows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-slate-400 bg-white">（記載なし）</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}