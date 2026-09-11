'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TabFormationSettingProps = {
  selectedDate: string;
};

type TeamRow = {
  id: string;
  team: string;
  assigns: { [heroIdx: number]: string[] }; // { 0: [s1, s2, s3], 1: [s1, s2, s3], ... }
  flags: { [heroIdx: number]: boolean };    // { 0: true/false, 1: ... }
  memos: { [heroIdx: number]: string };     // { 0: 'memo', 1: ... }
};

const FORMATION_KEYS = [
  { key: 'garrison_spear', label: '駐屯(槍編成)', type: 'garrison' },
  { key: 'garrison_bow', label: '駐屯(弓編成)', type: 'garrison' },
  { key: 'garrison_mix', label: '駐屯(混合編成)', type: 'garrison' },
  { key: 'rally_spear', label: '集結(槍編成)', type: 'rally' },
  { key: 'rally_bow', label: '集結(弓編成)', type: 'rally' },
  { key: 'rally_mix', label: '集結(混合編成)', type: 'rally' },
];

export default function TabFormationSetting({ selectedDate }: TabFormationSettingProps) {
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // マスタデータ
  const [shieldHeroes, setShieldHeroes] = useState<any[]>([]);
  const [spearHeroes, setSpearHeroes] = useState<any[]>([]);
  const [bowHeroes, setBowHeroes] = useState<any[]>([]);
  const [joinerHeroes, setJoinerHeroes] = useState<any[]>([]);
  const [allJoinerHeroes, setAllJoinerHeroes] = useState<any[]>([]);

  // チーム一覧・メンバーリスト
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [joiners, setJoiners] = useState<any[]>([]);
  const [membersMap, setMembersMap] = useState<{ [gameId: string]: any }>({});

  // 編成設定の状態
  const [formationSettings, setFormationSettings] = useState<{ [key: string]: any }>({});
  const [heroAssignments, setHeroAssignments] = useState<{ [formKey: string]: TeamRow[] }>({});

  // 1. 英雄マスタおよび基本データを取得
  useEffect(() => {
    async function fetchMasterData() {
      const { data: sData } = await supabase.from('heroes').select('*').eq('troop_type', 'shield').order('display_order', { ascending: false });
      if (sData) setShieldHeroes(sData);

      const { data: spData } = await supabase.from('heroes').select('*').eq('troop_type', 'spear').order('display_order', { ascending: false });
      if (spData) setSpearHeroes(spData);

      const { data: bData } = await supabase.from('heroes').select('*').eq('troop_type', 'bow').order('display_order', { ascending: false });
      if (bData) setBowHeroes(bData);

      const { data: jSettingData } = await supabase.from('heroes').select('*').eq('troop_type', 'joiner').eq('joiner_setting', true).order('display_order', { ascending: true });
      if (jSettingData) setJoinerHeroes(jSettingData);

      const { data: jAllData } = await supabase.from('heroes').select('*').eq('troop_type', 'joiner');
      if (jAllData) setAllJoinerHeroes(jAllData);
    }
    fetchMasterData();
  }, []);

  // 2. 選択日(selectedDate)から survey_id を特定し、各データを取得
  useEffect(() => {
    async function fetchSurveySpecificData() {
      if (!selectedDate) {
        setSurveyId(null);
        setIsInitializing(false);
        return;
      }

      setIsInitializing(true);

      const { data: masterData, error: masterError } = await supabase
        .from('surveys_master')
        .select('id')
        .eq('survey_type', 'svs')
        .eq('event_date', selectedDate)
        .limit(1);

      if (masterError || !masterData || masterData.length === 0) {
        setSurveyId(null);
        setIsInitializing(false);
        return;
      }

      const mId = masterData[0].id;
      setSurveyId(mId);

      const { data: teamData } = await supabase.from('svs_team').select('team').eq('survey_id', mId).order('team', { ascending: true });
      const loadedTeams = teamData ? teamData.map((t) => t.team).filter(Boolean) : [];
      setAvailableTeams(loadedTeams);

      const { data: joinerData } = await supabase.from('svs_joiner').select('game_id, name, team').eq('survey_id', mId);
      if (joinerData) setJoiners(joinerData);

      const { data: membersData } = await supabase.from('members').select('*');
      if (membersData) {
        const mObj: { [gameId: string]: any } = {};
        membersData.forEach((m) => {
          if (m.game_id) mObj[String(m.game_id)] = m;
        });
        setMembersMap(mObj);
      }

      const { data: formSetData } = await supabase.from('svs_formation_settings').select('*').eq('survey_id', mId);

      const loadedSettings: { [key: string]: any } = {};
      FORMATION_KEYS.forEach((f) => {
        loadedSettings[f.key] = {
          enabled: false,
          joiner_assign: false,
          shield_hero: '',
          spear_hero: '',
          bow_hero: '',
          ratio_shield: 0,
          ratio_spear: 0,
          ratio_bow: 0,
          joiner_hero_1: '',
          joiner_hero_2: '',
          joiner_hero_3: '',
          joiner_hero_4: '',
          memo: '',
        };
      });

      if (formSetData) {
        formSetData.forEach((item) => {
          if (loadedSettings[item.formation_key]) {
            loadedSettings[item.formation_key] = {
              enabled: !!item.enabled,
              joiner_assign: !!item.joiner_assign,
              shield_hero: item.shield_hero || '',
              spear_hero: item.spear_hero || '',
              bow_hero: item.bow_hero || '',
              ratio_shield: item.ratio_shield ?? 0,
              ratio_spear: item.ratio_spear ?? 0,
              ratio_bow: item.ratio_bow ?? 0,
              joiner_hero_1: item.joiner_hero_1 || '',
              joiner_hero_2: item.joiner_hero_2 || '',
              joiner_hero_3: item.joiner_hero_3 || '',
              joiner_hero_4: item.joiner_hero_4 || '',
              memo: item.memo || '',
            };
          }
        });
      }
      setFormationSettings(loadedSettings);

      const { data: heroAssignData } = await supabase.from('svs_hero_assignments').select('*').eq('survey_id', mId);

      const loadedAssignments: { [key: string]: TeamRow[] } = {};
      FORMATION_KEYS.forEach((f) => {
        loadedAssignments[f.key] = [];
      });

      if (heroAssignData) {
        heroAssignData.forEach((item, idx) => {
          const fKey = item.formation_key;
          const tName = item.team || 'A';

          if (!loadedAssignments[fKey]) loadedAssignments[fKey] = [];

          // 各英雄ごとのカラムから復元 (hero_1_assign_1〜3, hero_2_assign_1〜3 など)
          const assigns: { [k: number]: string[] } = {
            0: [item.hero_1_assign_1 || '', item.hero_1_assign_2 || '', item.hero_1_assign_3 || ''],
            1: [item.hero_2_assign_1 || '', item.hero_2_assign_2 || '', item.hero_2_assign_3 || ''],
            2: [item.hero_3_assign_1 || '', item.hero_3_assign_2 || '', item.hero_3_assign_3 || ''],
            3: [item.hero_4_assign_1 || '', item.hero_4_assign_2 || '', item.hero_4_assign_3 || ''],
          };

          const flags: { [k: number]: boolean } = {
            0: !!item.hero_assignfalg1,
            1: !!item.hero_assignfalg2,
            2: !!item.hero_assignfalg3,
            3: !!item.hero_assignfalg4,
          };

          const memos: { [k: number]: string } = {
            0: item.hero_memo1 || '',
            1: item.hero_memo2 || '',
            2: item.hero_memo3 || '',
            3: item.hero_memo4 || '',
          };

          loadedAssignments[fKey].push({
            id: item.id ? String(item.id) : `row_${fKey}_${tName}_${idx}`,
            team: tName,
            assigns,
            flags,
            memos,
          });
        });
      }
      setHeroAssignments(loadedAssignments);
      setIsInitializing(false);
    }

    fetchSurveySpecificData();
  }, [selectedDate]);

  const getFilteredJoinersForHero = (heroName: string, rowTeam: string) => {
    const teamJoiners = joiners.filter((j) => j.team === rowTeam);
    if (!heroName) return teamJoiners;
    const heroObj = allJoinerHeroes.find((h) => h.name === heroName);
    if (!heroObj || !heroObj.joiner_skill_survey) return teamJoiners;

    const memberColumn = heroObj.members;
    if (!memberColumn) return teamJoiners;

    return teamJoiners.filter((j) => {
      const mData = membersMap[String(j.game_id)];
      if (!mData) return false;
      const val = mData[memberColumn];
      return val === true || val === 'true';
    });
  };

  const handleRatioChange = (formKey: string, targetField: 'ratio_shield' | 'ratio_spear' | 'ratio_bow', rawValue: string) => {
    if (rawValue === '') {
      handleSettingChange(formKey, targetField, 0);
      return;
    }
    const numValue = Number(rawValue);
    if (isNaN(numValue)) return;

    const current = formationSettings[formKey] || {};
    const shield = targetField === 'ratio_shield' ? numValue : (Number(current.ratio_shield) || 0);
    const spear = targetField === 'ratio_spear' ? numValue : (Number(current.ratio_spear) || 0);
    const bow = targetField === 'ratio_bow' ? numValue : (Number(current.ratio_bow) || 0);

    let otherSum = 0;
    if (targetField === 'ratio_shield') otherSum = spear + bow;
    if (targetField === 'ratio_spear') otherSum = shield + bow;
    if (targetField === 'ratio_bow') otherSum = shield + spear;

    if (numValue + otherSum > 100 || numValue > 100) {
      const maxAllowed = Math.max(0, 100 - otherSum);
      handleSettingChange(formKey, targetField, maxAllowed);
      return;
    }
    handleSettingChange(formKey, targetField, numValue);
  };

  const handleSettingChange = async (formKey: string, field: string, value: any) => {
    const updated = {
      ...formationSettings,
      [formKey]: {
        ...formationSettings[formKey],
        [field]: value,
      },
    };
    setFormationSettings(updated);

    if (surveyId) {
      setSaveStatus('saving');
      const currentVal = updated[formKey];
      const { error } = await supabase.from('svs_formation_settings').upsert({
        survey_id: surveyId,
        formation_key: formKey,
        enabled: currentVal.enabled,
        joiner_assign: currentVal.joiner_assign,
        shield_hero: currentVal.shield_hero,
        spear_hero: currentVal.spear_hero,
        bow_hero: currentVal.bow_hero,
        ratio_shield: Number(currentVal.ratio_shield) || 0,
        ratio_spear: Number(currentVal.ratio_spear) || 0,
        ratio_bow: Number(currentVal.ratio_bow) || 0,
        joiner_hero_1: currentVal.joiner_hero_1,
        joiner_hero_2: currentVal.joiner_hero_2,
        joiner_hero_3: currentVal.joiner_hero_3,
        joiner_hero_4: currentVal.joiner_hero_4,
        memo: currentVal.memo,
      }, { onConflict: 'survey_id,formation_key' });

      if (error) {
        console.error('Failed to save formation setting:', error.message || error);
        setSaveStatus('unsaved');
      } else {
        setSaveStatus('saved');
      }
    }
  };

  const handleAddTeamRow = (formKey: string) => {
    const currentRows = heroAssignments[formKey] || [];
    const defaultTeam = availableTeams[0] || 'A';

    const newRow: TeamRow = {
      id: `temp_${Date.now()}_${Math.random()}`,
      team: defaultTeam,
      assigns: { 0: ['', '', ''], 1: ['', '', ''], 2: ['', '', ''], 3: ['', '', ''] },
      flags: { 0: false, 1: false, 2: false, 3: false },
      memos: { 0: '', 1: '', 2: '', 3: '' },
    };

    setHeroAssignments({
      ...heroAssignments,
      [formKey]: [...currentRows, newRow],
    });
  };

  const handleRemoveTeamRow = async (formKey: string, rowId: string) => {
    const currentRows = heroAssignments[formKey] || [];
    const targetRow = currentRows.find((r) => r.id === rowId);
    
    const updatedRows = currentRows.filter((r) => r.id !== rowId);
    setHeroAssignments({
      ...heroAssignments,
      [formKey]: updatedRows,
    });

    if (surveyId && targetRow && !targetRow.id.startsWith('temp_')) {
      await supabase
        .from('svs_hero_assignments')
        .delete()
        .eq('id', targetRow.id);
    }
  };

  const saveRowToSupabase = async (formKey: string, targetRow: TeamRow) => {
    if (!surveyId) return;
    setSaveStatus('saving');

    const a0 = targetRow.assigns[0] || ['', '', ''];
    const a1 = targetRow.assigns[1] || ['', '', ''];
    const a2 = targetRow.assigns[2] || ['', '', ''];
    const a3 = targetRow.assigns[3] || ['', '', ''];

    const payload: any = {
      survey_id: surveyId,
      formation_key: formKey,
      team: targetRow.team,
      // 英雄1
      hero_1_assign_1: a0[0] || null,
      hero_1_assign_2: a0[1] || null,
      hero_1_assign_3: a0[2] || null,
      hero_assignfalg1: !!targetRow.flags[0],
      hero_memo1: targetRow.memos[0] || '',
      // 英雄2
      hero_2_assign_1: a1[0] || null,
      hero_2_assign_2: a1[1] || null,
      hero_2_assign_3: a1[2] || null,
      hero_assignfalg2: !!targetRow.flags[1],
      hero_memo2: targetRow.memos[1] || '',
      // 英雄3
      hero_3_assign_1: a2[0] || null,
      hero_3_assign_2: a2[1] || null,
      hero_3_assign_3: a2[2] || null,
      hero_assignfalg3: !!targetRow.flags[2],
      hero_memo3: targetRow.memos[2] || '',
      // 英雄4
      hero_4_assign_1: a3[0] || null,
      hero_4_assign_2: a3[1] || null,
      hero_4_assign_3: a3[2] || null,
      hero_assignfalg4: !!targetRow.flags[3],
      hero_memo4: targetRow.memos[3] || '',
    };

    if (!targetRow.id.startsWith('temp_')) {
      payload.id = targetRow.id;
    }

    const { data, error } = await supabase
      .from('svs_hero_assignments')
      .upsert(payload)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to save assignment row:', error.message || error);
      setSaveStatus('unsaved');
    } else {
      setSaveStatus('saved');
      if (data && data.id && targetRow.id.startsWith('temp_')) {
        targetRow.id = String(data.id);
      }
    }
  };

  const handleAssignmentChange = async (formKey: string, rowId: string, heroIdx: number, slotIndex: number, memberName: string) => {
    const currentRows = heroAssignments[formKey] || [];
    const targetRow = currentRows.find((r) => r.id === rowId);
    if (!targetRow) return;

    const updatedRows = currentRows.map((row) => {
      if (row.id === rowId) {
        const heroAssigns = [...(row.assigns[heroIdx] || ['', '', ''])];
        heroAssigns[slotIndex] = memberName;
        return {
          ...row,
          assigns: {
            ...row.assigns,
            [heroIdx]: heroAssigns,
          },
        };
      }
      return row;
    });

    setHeroAssignments({
      ...heroAssignments,
      [formKey]: updatedRows,
    });

    const newTargetRow = updatedRows.find((r) => r.id === rowId);
    if (newTargetRow) {
      await saveRowToSupabase(formKey, newTargetRow);
    }
  };

  const handleHeroFlagChange = async (formKey: string, rowId: string, heroIdx: number, checked: boolean) => {
    const currentRows = heroAssignments[formKey] || [];
    const updatedRows = currentRows.map((row) => {
      if (row.id === rowId) {
        return {
          ...row,
          flags: {
            ...row.flags,
            [heroIdx]: checked,
          },
        };
      }
      return row;
    });

    setHeroAssignments({
      ...heroAssignments,
      [formKey]: updatedRows,
    });

    const newTargetRow = updatedRows.find((r) => r.id === rowId);
    if (newTargetRow) {
      await saveRowToSupabase(formKey, newTargetRow);
    }
  };

  const handleHeroMemoChange = async (formKey: string, rowId: string, heroIdx: number, memoValue: string) => {
    const currentRows = heroAssignments[formKey] || [];
    const updatedRows = currentRows.map((row) => {
      if (row.id === rowId) {
        return {
          ...row,
          memos: {
            ...row.memos,
            [heroIdx]: memoValue,
          },
        };
      }
      return row;
    });

    setHeroAssignments({
      ...heroAssignments,
      [formKey]: updatedRows,
    });

    const newTargetRow = updatedRows.find((r) => r.id === rowId);
    if (newTargetRow) {
      await saveRowToSupabase(formKey, newTargetRow);
    }
  };

  const enabledFormations = useMemo(() => {
    return FORMATION_KEYS.filter((f) => {
      const setting = formationSettings[f.key];
      return setting?.enabled;
    });
  }, [formationSettings]);

  if (!selectedDate) {
    return <div className="text-center py-12 text-slate-400">上部の日付を選択してください。</div>;
  }

  if (isInitializing) {
    return <div className="text-center py-12 text-slate-400">読み込み中...</div>;
  }

  return (
    <div className="space-y-10 relative">
      <div className="flex justify-end items-center gap-2">
        <span className="text-xs text-slate-400">ステータス:</span>
        {saveStatus === 'saved' && <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg text-xs font-bold shadow-sm">保存済み</span>}
        {saveStatus === 'saving' && <span className="px-2.5 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-lg text-xs font-bold shadow-sm animate-pulse">保存中...</span>}
        {saveStatus === 'unsaved' && <span className="px-2.5 py-1 bg-rose-950 text-rose-400 border border-rose-800 rounded-lg text-xs font-bold shadow-sm">未保存の変更</span>}
      </div>

      {/* 1. 編成・比率設定セクション */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
          <span>🛡️</span> 編成・比率設定
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 駐屯 */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-300 bg-[#151c2c] px-3 py-1.5 rounded-lg border border-slate-800">駐屯編成</div>
            {FORMATION_KEYS.filter((f) => f.type === 'garrison').map((item) => {
              const setting = formationSettings[item.key] || {};
              const totalRatio = (Number(setting.ratio_shield) || 0) + (Number(setting.ratio_spear) || 0) + (Number(setting.ratio_bow) || 0);

              return (
                <div key={item.key} className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!setting.enabled}
                        onChange={(e) => handleSettingChange(item.key, 'enabled', e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-4 h-4 accent-cyan-400 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white">{item.label}</span>
                    </label>
                  </div>

                  {setting.enabled && (
                    <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                      {/* 主英雄 */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold">主英雄</label>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500">盾</span>
                            <select
                              value={setting.shield_hero}
                              onChange={(e) => handleSettingChange(item.key, 'shield_hero', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            >
                              <option value="">選択</option>
                              {shieldHeroes.map((h) => (<option key={h.id || h.name} value={h.name}>{h.name}</option>))}
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500">槍</span>
                            <select
                              value={setting.spear_hero}
                              onChange={(e) => handleSettingChange(item.key, 'spear_hero', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            >
                              <option value="">選択</option>
                              {spearHeroes.map((h) => (<option key={h.id || h.name} value={h.name}>{h.name}</option>))}
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500">弓</span>
                            <select
                              value={setting.bow_hero}
                              onChange={(e) => handleSettingChange(item.key, 'bow_hero', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            >
                              <option value="">選択</option>
                              {bowHeroes.map((h) => (<option key={h.id || h.name} value={h.name}>{h.name}</option>))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* 比率 */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-slate-400 font-bold">比率 (%) ※3つの合計100%以下</label>
                          <span className="text-[10px] font-bold text-slate-400">合計: {totalRatio}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">盾</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={setting.ratio_shield}
                              onChange={(e) => handleRatioChange(item.key, 'ratio_shield', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-[10px] text-slate-500">%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">槍</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={setting.ratio_spear}
                              onChange={(e) => handleRatioChange(item.key, 'ratio_spear', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-[10px] text-slate-500">%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">弓</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={setting.ratio_bow}
                              onChange={(e) => handleRatioChange(item.key, 'ratio_bow', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-[10px] text-slate-500">%</span>
                          </div>
                        </div>
                      </div>

                      {/* 乗り英雄 */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold">乗り英雄</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[1, 2, 3, 4].map((num) => (
                            <select
                              key={num}
                              value={setting[`joiner_hero_${num}`] || ''}
                              onChange={(e) => handleSettingChange(item.key, `joiner_hero_${num}`, e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500 text-[11px]"
                            >
                              <option value="">未選択</option>
                              {joinerHeroes.map((jh) => (<option key={jh.id || jh.name} value={jh.name}>{jh.name}</option>))}
                            </select>
                          ))}
                        </div>
                      </div>

                      {/* 備考 */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold">備考</label>
                        <input
                          type="text"
                          value={setting.memo || ''}
                          onChange={(e) => handleSettingChange(item.key, 'memo', e.target.value)}
                          placeholder="備考を入力"
                          className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 集結 */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-300 bg-[#151c2c] px-3 py-1.5 rounded-lg border border-slate-800">集結編成</div>
            {FORMATION_KEYS.filter((f) => f.type === 'rally').map((item) => {
              const setting = formationSettings[item.key] || {};
              const totalRatio = (Number(setting.ratio_shield) || 0) + (Number(setting.ratio_spear) || 0) + (Number(setting.ratio_bow) || 0);

              return (
                <div key={item.key} className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!setting.enabled}
                        onChange={(e) => handleSettingChange(item.key, 'enabled', e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-4 h-4 accent-cyan-400 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white">{item.label}</span>
                    </label>
                  </div>

                  {setting.enabled && (
                    <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                      {/* 主英雄 */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold">主英雄</label>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500">盾</span>
                            <select
                              value={setting.shield_hero}
                              onChange={(e) => handleSettingChange(item.key, 'shield_hero', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            >
                              <option value="">選択</option>
                              {shieldHeroes.map((h) => (<option key={h.id || h.name} value={h.name}>{h.name}</option>))}
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500">槍</span>
                            <select
                              value={setting.spear_hero}
                              onChange={(e) => handleSettingChange(item.key, 'spear_hero', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            >
                              <option value="">選択</option>
                              {spearHeroes.map((h) => (<option key={h.id || h.name} value={h.name}>{h.name}</option>))}
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500">弓</span>
                            <select
                              value={setting.bow_hero}
                              onChange={(e) => handleSettingChange(item.key, 'bow_hero', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            >
                              <option value="">選択</option>
                              {bowHeroes.map((h) => (<option key={h.id || h.name} value={h.name}>{h.name}</option>))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* 比率 */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-slate-400 font-bold">比率 (%) ※3つの合計100%以下</label>
                          <span className="text-[10px] font-bold text-slate-400">合計: {totalRatio}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">盾</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={setting.ratio_shield}
                              onChange={(e) => handleRatioChange(item.key, 'ratio_shield', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-[10px] text-slate-500">%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">槍</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={setting.ratio_spear}
                              onChange={(e) => handleRatioChange(item.key, 'ratio_spear', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-[10px] text-slate-500">%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">弓</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={setting.ratio_bow}
                              onChange={(e) => handleRatioChange(item.key, 'ratio_bow', e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-[10px] text-slate-500">%</span>
                          </div>
                        </div>
                      </div>

                      {/* 乗り英雄 */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold">乗り英雄</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[1, 2, 3, 4].map((num) => (
                            <select
                              key={num}
                              value={setting[`joiner_hero_${num}`] || ''}
                              onChange={(e) => handleSettingChange(item.key, `joiner_hero_${num}`, e.target.value)}
                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500 text-[11px]"
                            >
                              <option value="">未選択</option>
                              {joinerHeroes.map((jh) => (<option key={jh.id || jh.name} value={jh.name}>{jh.name}</option>))}
                            </select>
                          ))}
                        </div>
                      </div>

                      {/* 備考 */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold">備考</label>
                        <input
                          type="text"
                          value={setting.memo || ''}
                          onChange={(e) => handleSettingChange(item.key, 'memo', e.target.value)}
                          placeholder="備考を入力"
                          className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. 指定英雄設定セクション */}
      <div className="space-y-4 pt-6 border-t border-slate-800">
        <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
          <span>👥</span> 指定英雄設定
        </h3>

        {enabledFormations.length === 0 ? (
          <div className="text-xs text-slate-500 bg-[#151c2c] border border-slate-800 rounded-xl p-6 text-center">
            上の「編成・比率設定」で編成を有効にするとここに表示されます。
          </div>
        ) : (
          <div className="space-y-6">
            {enabledFormations.map((form) => {
              const setting = formationSettings[form.key] || {};
              const activeJoinerHeroes: string[] = [
                setting.joiner_hero_1,
                setting.joiner_hero_2,
                setting.joiner_hero_3,
                setting.joiner_hero_4,
              ].filter(Boolean) as string[];

              const rows = heroAssignments[form.key] || [];

              return (
                <div key={form.key} className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <span className="text-xs font-bold text-cyan-300">{form.label}</span>
                    <div className="flex items-center gap-4">
                      {activeJoinerHeroes.length > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer bg-[#0b0f19] px-3 py-1.5 rounded-lg border border-slate-800">
                          <input
                            type="checkbox"
                            checked={!!setting.joiner_assign}
                            onChange={(e) => handleSettingChange(form.key, 'joiner_assign', e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-4 h-4 accent-cyan-400 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-white">指定英雄設定を行う</span>
                        </label>
                      )}

                      {activeJoinerHeroes.length > 0 && setting.joiner_assign && (
                        <button
                          type="button"
                          onClick={() => handleAddTeamRow(form.key)}
                          className="px-3 py-1.5 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-lg text-xs font-bold hover:bg-cyan-900 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                        >
                          <span>＋</span> チームを追加
                        </button>
                      )}
                    </div>
                  </div>

                  {activeJoinerHeroes.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3 text-center">
                      ℹ️ この編成には乗り英雄が選択されていないため、指定英雄設定は利用できません。
                    </div>
                  ) : setting.joiner_assign && (
                    <div className="space-y-3 pt-2">
                      {rows.length === 0 ? (
                        <div className="text-xs text-slate-500 py-4 text-center">
                          「チームを追加」ボタンを押してチームを設定してください。
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {rows.map((row) => {
                            const rAssigns = row.assigns || {};
                            const rFlags = row.flags || {};
                            const rMemos = row.memos || {};

                            return (
                              <div key={row.id} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 font-bold">チーム:</span>
                                    <select
                                      value={row.team}
                                      onChange={async (e) => {
                                        const newTeam = e.target.value;
                                        const updated = rows.map((r) => (r.id === row.id ? { ...r, team: newTeam } : r));
                                        setHeroAssignments({ ...heroAssignments, [form.key]: updated });
                                        const target = updated.find((r) => r.id === row.id);
                                        if (target) {
                                          await saveRowToSupabase(form.key, target);
                                        }
                                      }}
                                      className="bg-[#151c2c] border border-slate-800 rounded px-2 py-1 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                                    >
                                      {availableTeams.length === 0 ? (
                                        <option value="A">チーム A</option>
                                      ) : (
                                        availableTeams.map((t) => (<option key={t} value={t}>チーム {t}</option>))
                                      )}
                                    </select>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTeamRow(form.key, row.id)}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 px-2 py-1 bg-rose-950/40 border border-rose-900/50 rounded cursor-pointer"
                                  >
                                    削除
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                  {activeJoinerHeroes.map((heroName: string, heroIdx: number) => {
                                    const heroAssigns = rAssigns[heroIdx] || ['', '', ''];
                                    const isNoAssign = !!rFlags[heroIdx];
                                    const memoVal = rMemos[heroIdx] || '';
                                    const filteredJoiners = getFilteredJoinersForHero(heroName, row.team);

                                    return (
                                      <div key={`${heroName}-${heroIdx}`} className="bg-[#151c2c] border border-slate-800/80 rounded-lg p-2.5 space-y-2">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                                          <div className="text-[11px] font-bold text-cyan-200">
                                            {heroName} <span className="text-[9px] text-slate-500">#{heroIdx + 1}</span>
                                          </div>
                                          <label className="flex items-center gap-1 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isNoAssign}
                                              onChange={(e) => handleHeroFlagChange(form.key, row.id, heroIdx, e.target.checked)}
                                              className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-3 h-3 accent-cyan-400 cursor-pointer"
                                            />
                                            <span className="text-[9px] text-slate-400">指定しない</span>
                                          </label>
                                        </div>

                                        {isNoAssign ? (
                                          <div className="space-y-1 pt-1">
                                            <label className="text-[10px] text-slate-400 font-bold">備考</label>
                                            <input
                                              type="text"
                                              value={memoVal}
                                              onChange={(e) => handleHeroMemoChange(form.key, row.id, heroIdx, e.target.value)}
                                              placeholder="別途指示を入力"
                                              className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-cyan-500"
                                            />
                                          </div>
                                        ) : (
                                          <div className="space-y-1.5">
                                            {[0, 1, 2].map((slotIdx) => {
                                              const currentSelectedVal = heroAssigns[slotIdx] || '';
                                              return (
                                                <div key={slotIdx} className="flex items-center gap-1">
                                                  <span className="text-[10px] text-slate-500 w-4">{slotIdx + 1}</span>
                                                  <select
                                                    value={currentSelectedVal}
                                                    onChange={(e) => handleAssignmentChange(form.key, row.id, heroIdx, slotIdx, e.target.value)}
                                                    className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-cyan-500"
                                                  >
                                                    <option value="">未割当</option>
                                                    {filteredJoiners.map((j) => {
                                                      const isAlreadyInSameHero = heroAssigns.some((val, idx) => idx !== slotIdx && val === j.name);
                                                      const isAlreadyInSameSlot = Object.entries(rAssigns).some(([hIdxStr, assigns]) => {
                                                        return Number(hIdxStr) !== heroIdx && (assigns as string[])[slotIdx] === j.name;
                                                      });

                                                      if ((isAlreadyInSameHero || isAlreadyInSameSlot) && currentSelectedVal !== j.name) {
                                                        return null;
                                                      }

                                                      return (
                                                        <option key={j.game_id || j.name} value={j.name}>{j.name}</option>
                                                      );
                                                    })}
                                                  </select>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}