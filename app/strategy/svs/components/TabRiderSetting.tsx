'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TabRiderSettingProps = {
  selectedDate: string;
};

// 総力パース用
function parsePower(powerStr: string | null | undefined): number {
  if (!powerStr) return 0;
  const str = powerStr.toString().trim().toUpperCase();
  let multiplier = 1;
  if (str.endsWith('B')) {
    multiplier = 1_000_000_000;
  } else if (str.endsWith('M')) {
    multiplier = 1_000_000;
  } else if (str.endsWith('K')) {
    multiplier = 1_000;
  }
  const num = parseFloat(str.replace(/[BMK]/g, ''));
  return isNaN(num) ? 0 : num * multiplier;
}

// 兵士Lvスコア判定用
function getSoldierLevelScore(shield: string | null, spear: string | null, bow: string | null): number {
  const isAll = (check: (s: string | null) => boolean) => check(shield) && check(spear) && check(bow);
  const isAny = (check: (s: string | null) => boolean) => check(shield) || check(spear) || check(bow);

  const isFc10T11 = (s: string | null) => s === 'FC10T11';
  const isFc9Plus = (s: string | null) => ['FC10T11', 'FC9T11'].includes(s || '');
  const isFc8Plus = (s: string | null) => ['FC10T11', 'FC9T11', 'FC8T11'].includes(s || '');
  const isFc7Plus = (s: string | null) => ['FC10T11', 'FC9T11', 'FC8T11', 'FC7T11'].includes(s || '');
  const isT11Plus = (s: string | null) => ['FC10T11', 'FC9T11', 'FC8T11', 'FC7T11', 'FC6T11', 'FC5T11'].includes(s || '');

  if (isAll(isFc10T11)) return 6;
  if (isAll(isFc9Plus)) return 5;
  if (isAll(isFc8Plus)) return 4;
  if (isAll(isFc7Plus)) return 3;
  if (isAll(isT11Plus)) return 2;
  if (isAny(isT11Plus)) return 1;
  return 0;
}

export default function TabRiderSetting({ selectedDate }: TabRiderSettingProps) {
  const [allianceList, setAllianceList] = useState<{ alliance: string; display_order: number }[]>([]);
  const [strategyInfo, setStrategyInfo] = useState<{ main: string; gost_1: string }>({ main: '', gost_1: '' });
  const [members, setMembers] = useState<any[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [surveyId, setSurveyId] = useState<string | null>(null);

  // 保存ステータス ('saved' | 'saving' | 'unsaved')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // 乗り手リスト用の同盟フィルター
  const [selectedAllianceFilter, setSelectedAllianceFilter] = useState<string>('ALL');

  // チーム設定 (デフォルト A〜F)
  const [teamKeys, setTeamKeys] = useState<string[]>(['A', 'B', 'C', 'D', 'E', 'F']);
  const [teamSettings, setTeamSettings] = useState<{ [key: string]: { alliance: string; role: string } }>({
    A: { alliance: '', role: '' },
    B: { alliance: '', role: '' },
    C: { alliance: '', role: '' },
    D: { alliance: '', role: '' },
    E: { alliance: '', role: '' },
    F: { alliance: '', role: '' },
  });

  const [riderAssignments, setRiderAssignments] = useState<{ [gameId: string]: string }>({});
  const [riderPets, setRiderPets] = useState<{ [gameId: string]: { p21_23: boolean; p23_25: boolean; p24_26: boolean } }>({});

  const isInitialMount = useRef(true);

  // 1. アライアンス一覧・メンバー取得
  useEffect(() => {
    async function fetchBaseData() {
      const { data: aData } = await supabase
        .from('alliance_list')
        .select('alliance, display_order')
        .order('display_order', { ascending: true });
      if (aData) setAllianceList(aData);

      const { data: mData } = await supabase
        .from('members')
        .select('*')
        .not('status', 'eq', 'left');
      if (mData) setMembers(mData);
    }
    fetchBaseData();
  }, []);

  // 2. 選択日付・SVSデータ取得
  useEffect(() => {
    async function fetchSurveyData() {
      isInitialMount.current = true;
      if (!selectedDate) {
        setSurveyId(null);
        setSurveyResponses([]);
        setStrategyInfo({ main: '', gost_1: '' });
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
        setStrategyInfo({ main: '', gost_1: '' });
        setSurveyResponses([]);
        setIsInitializing(false);
        return;
      }

      const mId = masterData[0].id;
      setSurveyId(mId);

      const { data: infoData, error: infoError } = await supabase
        .from('strategy_svs_info')
        .select('main, gost_1')
        .eq('survey_id', mId)
        .maybeSingle();

      if (!infoError && infoData) {
        setStrategyInfo({
          main: infoData.main || '',
          gost_1: infoData.gost_1 || '',
        });
      } else {
        setStrategyInfo({ main: '', gost_1: '' });
      }

      const { data: respData } = await supabase
        .from('survey_responses_svs')
        .select('*')
        .eq('survey_id', mId);

      if (respData) setSurveyResponses(respData);

      // 既存の svs_team データの読み込み
      const { data: teamData } = await supabase
        .from('svs_team')
        .select('*')
        .eq('survey_id', mId);

      if (teamData && teamData.length > 0) {
        const loadedKeys: string[] = [];
        const loadedSettings: { [key: string]: { alliance: string; role: string } } = {};
        teamData.forEach((item) => {
          if (item.team) {
            loadedKeys.push(item.team);
            loadedSettings[item.team] = {
              alliance: item.alliance || '',
              role: item.position || '',
            };
          }
        });
        if (loadedKeys.length > 0) {
          setTeamKeys(loadedKeys);
          setTeamSettings(loadedSettings);
        }
      }

      // 既存の svs_joiner データの読み込み
      const { data: joinerData } = await supabase
        .from('svs_joiner')
        .select('*')
        .eq('survey_id', mId);

      if (joinerData && joinerData.length > 0) {
        const loadedAssignments: { [k: string]: string } = {};
        const loadedPets: { [k: string]: any } = {};

        joinerData.forEach((item) => {
          if (item.game_id) {
            const gIdStr = String(item.game_id);
            loadedAssignments[gIdStr] = item.team || '';
            loadedPets[gIdStr] = {
              p21_23: !!item.p_2123,
              p23_25: !!item.p_2325,
              p24_26: !!item.p_2426,
            };
          }
        });
        setRiderAssignments(loadedAssignments);
        setRiderPets(loadedPets);
      } else {
        setRiderAssignments({});
        setRiderPets({});
      }

      setIsInitializing(false);
      setTimeout(() => {
        isInitialMount.current = false;
      }, 500);
    }

    fetchSurveyData();
  }, [selectedDate]);

  const memberMap = useMemo(() => {
    const map = new Map();
    members.forEach((m) => {
      if (m.game_id != null) map.set(String(m.game_id), m);
    });
    return map;
  }, [members]);

  const responseMap = useMemo(() => {
    const map = new Map();
    surveyResponses.forEach((r) => {
      if (r.game_id != null) map.set(String(r.game_id), r);
    });
    return map;
  }, [surveyResponses]);

  const allianceOrderMap = useMemo(() => {
    const map = new Map();
    allianceList.forEach((a) => map.set(a.alliance, a.display_order));
    return map;
  }, [allianceList]);

  const filterableAllianceNames = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.alliance) set.add(m.alliance);
    });
    return allianceList
      .map((a) => a.alliance)
      .filter((name) => set.has(name));
  }, [allianceList, members]);

  const availableAlliances = useMemo(() => {
    const list: string[] = [];
    if (strategyInfo.main) list.push(strategyInfo.main);
    if (strategyInfo.gost_1 && strategyInfo.gost_1 !== strategyInfo.main) {
      list.push(strategyInfo.gost_1);
    }
    return list;
  }, [strategyInfo]);

  // チーム追加
  const handleAddTeamSlot = async () => {
    const lastChar = teamKeys[teamKeys.length - 1] || 'F';
    const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
    const newKeys = [...teamKeys, nextChar];
    const newSettings = {
      ...teamSettings,
      [nextChar]: { alliance: '', role: '' },
    };
    setTeamKeys(newKeys);
    setTeamSettings(newSettings);

    if (surveyId) {
      setSaveStatus('saving');
      const { error } = await supabase.from('svs_team').upsert({
        survey_id: surveyId,
        event_date: selectedDate,
        team: nextChar,
        alliance: '',
        position: '',
      }, { onConflict: 'survey_id,team' });

      if (error) setSaveStatus('unsaved');
      else setSaveStatus('saved');
    }
  };

  // チーム削除
  const handleRemoveTeamSlot = async (keyToRemove: string) => {
    const newKeys = teamKeys.filter((k) => k !== keyToRemove);
    setTeamKeys(newKeys);
    const newSettings = { ...teamSettings };
    delete newSettings[keyToRemove];
    setTeamSettings(newSettings);

    const updatedAssignments = { ...riderAssignments };
    Object.keys(updatedAssignments).forEach((gId) => {
      if (updatedAssignments[gId] === keyToRemove) delete updatedAssignments[gId];
    });
    setRiderAssignments(updatedAssignments);

    if (surveyId) {
      setSaveStatus('saving');
      await supabase
        .from('svs_team')
        .delete()
        .eq('survey_id', surveyId)
        .eq('team', keyToRemove);

      await supabase
        .from('svs_joiner')
        .update({ team: null })
        .eq('survey_id', surveyId)
        .eq('team', keyToRemove);

      setSaveStatus('saved');
    }
  };

  // チーム設定変更 (同盟・役割)
  const handleTeamSettingChange = async (teamKey: string, field: 'alliance' | 'role', value: string) => {
    const updatedSettings = {
      ...teamSettings,
      [teamKey]: {
        ...teamSettings[teamKey],
        [field]: value,
      },
    };
    setTeamSettings(updatedSettings);

    if (surveyId) {
      setSaveStatus('saving');
      const s = updatedSettings[teamKey];
      const { error } = await supabase.from('svs_team').upsert({
        survey_id: surveyId,
        event_date: selectedDate,
        team: teamKey,
        alliance: s.alliance || '',
        position: s.role || '',
      }, { onConflict: 'survey_id,team' });

      if (error) setSaveStatus('unsaved');
      else setSaveStatus('saved');
    }
  };

  // チーム割り当て変更
  const handleAssignmentChange = async (gameId: string, teamKey: string) => {
    const gIdStr = String(gameId);
    const updatedAssignments = { ...riderAssignments, [gIdStr]: teamKey };
    setRiderAssignments(updatedAssignments);

    if (surveyId) {
      setSaveStatus('saving');
      const mem = memberMap.get(gIdStr);
      const pets = riderPets[gIdStr] || { p21_23: false, p23_25: false, p24_26: false };
      const assignedTeam = teamKey === '' ? null : teamKey;

      const { error } = await supabase.from('svs_joiner').upsert(
        {
          survey_id: surveyId,
          event_date: selectedDate,
          game_id: gIdStr,
          name: mem ? mem.name : null,
          team: assignedTeam,
          p_2123: pets.p21_23,
          p_2325: pets.p23_25,
          p_2426: pets.p24_26,
        },
        { onConflict: 'survey_id,game_id' }
      );

      if (error) {
        console.error('Failed to save assignment:', error);
        setSaveStatus('unsaved');
      } else {
        setSaveStatus('saved');
      }
    }
  };

  // ペットチェックボックス変更
  const handlePetCheckChange = async (gameId: string, field: 'p21_23' | 'p23_25' | 'p24_26', checked: boolean) => {
    const gIdStr = String(gameId);
    const current = riderPets[gIdStr] || { p21_23: false, p23_25: false, p24_26: false };
    const updatedPets = { ...current, [field]: checked };
    const newRiderPets = { ...riderPets, [gIdStr]: updatedPets };
    setRiderPets(newRiderPets);

    if (surveyId) {
      setSaveStatus('saving');
      const mem = memberMap.get(gIdStr);
      const assignedTeam = riderAssignments[gIdStr] || null;

      const { error } = await supabase.from('svs_joiner').upsert(
        {
          survey_id: surveyId,
          event_date: selectedDate,
          game_id: gIdStr,
          name: mem ? mem.name : null,
          team: assignedTeam === '' ? null : assignedTeam,
          p_2123: updatedPets.p21_23,
          p_2325: updatedPets.p23_25,
          p_2426: updatedPets.p24_26,
        },
        { onConflict: 'survey_id,game_id' }
      );

      if (error) {
        console.error('Failed to save pets:', error);
        setSaveStatus('unsaved');
      } else {
        setSaveStatus('saved');
      }
    }
  };

  const validTeams = useMemo(() => {
    return teamKeys.filter((key) => {
      const s = teamSettings[key];
      return s && s.alliance && s.alliance.trim() !== '' && s.role && s.role.trim() !== '';
    });
  }, [teamKeys, teamSettings]);

  const teamAssignedMembersMap = useMemo(() => {
    const map = new Map<string, string[]>();
    validTeams.forEach((k) => map.set(k, []));
    Object.entries(riderAssignments).forEach(([gId, tKey]) => {
      if (map.has(tKey)) map.get(tKey)?.push(gId);
    });
    return map;
  }, [riderAssignments, validTeams]);

  const categorizedRiders = useMemo(() => {
    const nonLeaders = members.filter((m) => m.leader !== true && m.status !== 'left');
    const fullParticipation: any[] = [];
    const midParticipation: any[] = [];
    const noParticipation: any[] = [];
    const noResponse: any[] = [];

    nonLeaders.forEach((m) => {
      const gIdStr = String(m.game_id);
      const resp = responseMap.get(gIdStr);

      if (!resp || resp.participation_type === null || resp.participation_type === undefined || resp.participation_type === '') {
        noResponse.push(m);
      } else {
        const pType = Number(resp.participation_type);
        if (pType === 1 || pType === 2) fullParticipation.push(m);
        else if (pType === 3) midParticipation.push(m);
        else if (pType === 4) noParticipation.push(m);
        else noResponse.push(m);
      }
    });

    const sortMembers = (list: any[], isUnanswered: boolean = false) => {
      return [...list].sort((a, b) => {
        const respA = responseMap.get(String(a.game_id));
        const respB = responseMap.get(String(b.game_id));

        const shieldA = isUnanswered ? a.shield_soldier : respA?.snapshot_shield_soldier;
        const shieldB = isUnanswered ? b.shield_soldier : respB?.snapshot_shield_soldier;
        const spearA = isUnanswered ? a.spear_soldier : respA?.snapshot_spear_soldier;
        const spearB = isUnanswered ? b.spear_soldier : respB?.snapshot_spear_soldier;
        const bowA = isUnanswered ? a.bow_soldier : respA?.snapshot_bow_soldier;
        const bowB = isUnanswered ? b.bow_soldier : respB?.snapshot_bow_soldier;

        const scoreA = getSoldierLevelScore(shieldA, spearA, bowA);
        const scoreB = getSoldierLevelScore(shieldB, spearB, bowB);
        if (scoreA !== scoreB) return scoreB - scoreA;

        const orderA = allianceOrderMap.get(a.alliance) ?? 999;
        const orderB = allianceOrderMap.get(b.alliance) ?? 999;
        if (orderA !== orderB) return orderA - orderB;

        const powerA = parsePower(isUnanswered ? a.current_power : respA?.snapshot_power);
        const powerB = parsePower(isUnanswered ? b.current_power : respB?.snapshot_power);
        return powerB - powerA;
      });
    };

    const applyAllianceFilter = (list: any[]) => {
      if (selectedAllianceFilter === 'ALL') return list;
      return list.filter((m) => m.alliance === selectedAllianceFilter);
    };

    return {
      full: applyAllianceFilter(sortMembers(fullParticipation)),
      mid: applyAllianceFilter(sortMembers(midParticipation)),
      noPart: applyAllianceFilter(sortMembers(noParticipation)),
      unanswered: applyAllianceFilter(sortMembers(noResponse, true)),
    };
  }, [members, responseMap, allianceOrderMap, selectedAllianceFilter]);

  const mainAllianceName = strategyInfo.main;
  const gostAllianceName = strategyInfo.gost_1;

  const mainAllianceTeams = useMemo(() => {
    return validTeams.filter((k) => teamSettings[k]?.alliance === mainAllianceName);
  }, [validTeams, teamSettings, mainAllianceName]);

  const gostAllianceTeams = useMemo(() => {
    return validTeams.filter((k) => teamSettings[k]?.alliance === gostAllianceName);
  }, [validTeams, teamSettings, gostAllianceName]);

  if (isInitializing) {
    return <div className="text-center py-12 text-slate-400">読み込み中...</div>;
  }

  return (
    <div className="space-y-8 relative">
      {/* ステータス表示バッジ */}
      <div className="flex justify-end items-center gap-2">
        <span className="text-xs text-slate-400">ステータス:</span>
        {saveStatus === 'saved' && (
          <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg text-xs font-bold shadow-sm">
            保存済み
          </span>
        )}
        {saveStatus === 'saving' && (
          <span className="px-2.5 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-lg text-xs font-bold shadow-sm animate-pulse">
            保存中...
          </span>
        )}
        {saveStatus === 'unsaved' && (
          <span className="px-2.5 py-1 bg-rose-950 text-rose-400 border border-rose-800 rounded-lg text-xs font-bold shadow-sm">
            未保存の変更
          </span>
        )}
      </div>

      {/* チーム設定セクション */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 space-y-4 shadow-inner">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <span>🛡️</span> チーム設定
          </h3>
          <button
            onClick={handleAddTeamSlot}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow"
          >
            <span>＋</span> チームを追加
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {teamKeys.map((key) => {
            const setting = teamSettings[key] || { alliance: '', role: '' };
            return (
              <div key={key} className="bg-[#151c2c] border border-slate-800 rounded-xl p-3 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-cyan-300">チーム {key}</div>
                  {teamKeys.length > 1 && (
                    <button
                      onClick={() => handleRemoveTeamSlot(key)}
                      className="text-slate-500 hover:text-rose-400 text-[10px] px-1.5 py-0.5 rounded transition cursor-pointer"
                    >
                      ✕ 削除
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">同盟</label>
                  <select
                    value={setting.alliance}
                    onChange={(e) => handleTeamSettingChange(key, 'alliance', e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">選択してください</option>
                    {availableAlliances.map((allName) => (
                      <option key={allName} value={allName}>
                        {allName} {allName === strategyInfo.main ? '(駐屯)' : allName === strategyInfo.gost_1 ? '(ゴースト)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">役割</label>
                  <input
                    type="text"
                    value={setting.role}
                    onChange={(e) => handleTeamSettingChange(key, 'role', e.target.value)}
                    placeholder="役割を入力"
                    className="w-full bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 乗り手チーム一覧セクション */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 space-y-6 shadow-inner">
        <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
          <span>🐎</span> 乗り手チーム一覧
        </h3>

        {/* 駐屯同盟マトリクス */}
        {mainAllianceName && mainAllianceTeams.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300">
              駐屯同盟 (GOD): <span className="text-cyan-300">{mainAllianceName}</span>
            </div>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#151c2c] text-slate-400">
                    <th className="p-3 w-32 font-bold text-slate-300">同盟 / 役割</th>
                    {mainAllianceTeams.map((k) => {
                      const count = (teamAssignedMembersMap.get(k) || []).length;
                      return (
                        <th key={k} className="p-3 text-center border-l border-slate-800">
                          <div className="text-cyan-400 font-bold flex items-center justify-center gap-1">
                            <span>チーム {k}</span>
                            <span className="text-[11px] font-normal text-slate-300">({count}人)</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{teamSettings[k]?.role}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#0b0f19]">
                  <tr>
                    <td className="p-3 font-bold text-slate-300 bg-[#151c2c]">メンバー</td>
                    {mainAllianceTeams.map((k) => {
                      const assignedIds = teamAssignedMembersMap.get(k) || [];
                      return (
                        <td key={k} className="p-3 align-top border-l border-slate-800 bg-[#0b0f19]">
                          <div className="space-y-2">
                            {assignedIds.map((gId, index) => {
                              const mem = memberMap.get(gId);
                              const pets = riderPets[gId] || { p21_23: false, p23_25: false, p24_26: false };
                              return (
                                <div key={`${gId}-${index}`} className="bg-[#151c2c] border border-slate-800 rounded-lg p-2 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 shadow-sm">
                                  <div className="font-bold text-white text-xs">{mem ? mem.name : gId}</div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-300 pt-1 xl:pt-0 border-t xl:border-t-0 border-slate-800">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={pets.p21_23} onChange={(e) => handlePetCheckChange(gId, 'p21_23', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-3.5 h-3.5 accent-cyan-400" />
                                      21-23
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={pets.p23_25} onChange={(e) => handlePetCheckChange(gId, 'p23_25', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-3.5 h-3.5 accent-cyan-400" />
                                      23-25
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={pets.p24_26} onChange={(e) => handlePetCheckChange(gId, 'p24_26', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-3.5 h-3.5 accent-cyan-400" />
                                      24-26
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                            {assignedIds.length === 0 && <div className="text-slate-600 text-[10px] italic text-center py-2">未配属</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ゴースト同盟マトリクス */}
        {gostAllianceName && gostAllianceTeams.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300">
              ゴースト同盟 (GEN): <span className="text-cyan-300">{gostAllianceName}</span>
            </div>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#151c2c] text-slate-400">
                    <th className="p-3 w-32 font-bold text-slate-300">同盟 / 役割</th>
                    {gostAllianceTeams.map((k) => {
                      const count = (teamAssignedMembersMap.get(k) || []).length;
                      return (
                        <th key={k} className="p-3 text-center border-l border-slate-800">
                          <div className="text-cyan-400 font-bold flex items-center justify-center gap-1">
                            <span>チーム {k}</span>
                            <span className="text-[11px] font-normal text-slate-300">({count}人)</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{teamSettings[k]?.role}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#0b0f19]">
                  <tr>
                    <td className="p-3 font-bold text-slate-300 bg-[#151c2c]">メンバー</td>
                    {gostAllianceTeams.map((k) => {
                      const assignedIds = teamAssignedMembersMap.get(k) || [];
                      return (
                        <td key={k} className="p-3 align-top border-l border-slate-800 bg-[#0b0f19]">
                          <div className="space-y-2">
                            {assignedIds.map((gId, index) => {
                              const mem = memberMap.get(gId);
                              const pets = riderPets[gId] || { p21_23: false, p23_25: false, p24_26: false };
                              return (
                                <div key={`${gId}-${index}`} className="bg-[#151c2c] border border-slate-800 rounded-lg p-2 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 shadow-sm">
                                  <div className="font-bold text-white text-xs">{mem ? mem.name : gId}</div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-300 pt-1 xl:pt-0 border-t xl:border-t-0 border-slate-800">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={pets.p21_23} onChange={(e) => handlePetCheckChange(gId, 'p21_23', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-3.5 h-3.5 accent-cyan-400" />
                                      21-23
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={pets.p23_25} onChange={(e) => handlePetCheckChange(gId, 'p23_25', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-3.5 h-3.5 accent-cyan-400" />
                                      23-25
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={pets.p24_26} onChange={(e) => handlePetCheckChange(gId, 'p24_26', e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-cyan-400 w-3.5 h-3.5 accent-cyan-400" />
                                      24-26
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                            {assignedIds.length === 0 && <div className="text-slate-600 text-[10px] italic text-center py-2">未配属</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 乗り手リストセクション */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 space-y-6 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <span>📋</span> 乗り手リスト
          </h3>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">同盟フィルター:</span>
            <select
              value={selectedAllianceFilter}
              onChange={(e) => setSelectedAllianceFilter(e.target.value)}
              className="bg-[#151c2c] border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">すべての同盟</option>
              {filterableAllianceNames.map((allName) => (
                <option key={allName} value={allName}>
                  {allName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 1. フル参加 */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-cyan-300 bg-[#151c2c] px-3 py-1.5 rounded-lg border border-slate-800">
            フル参加
          </div>
          <div className="overflow-x-auto max-h-[400px] border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse relative whitespace-nowrap">
              <thead className="sticky top-0 z-20 bg-[#151c2c] text-slate-300 shadow">
                <tr className="border-b border-slate-800">
                  <th className="p-3 min-w-[130px] bg-[#151c2c] sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">アカウント名</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c] sticky left-[130px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">Game ID</th>
                  <th className="p-3 min-w-[100px] bg-[#151c2c] sticky left-[240px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">同盟</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">FC</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">総力</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">盾</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">槍</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">弓</th>
                  <th className="p-3 min-w-[130px] bg-[#151c2c]">参加時間</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">VC参加</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c]">VC備考</th>
                  <th className="p-3 min-w-[80px] bg-[#151c2c]">Discord</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c]">チーム割当</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#0b0f19]">
                {categorizedRiders.full.length === 0 ? (
                  <tr><td colSpan={13} className="text-center py-4 text-slate-500 bg-[#0b0f19]">該当メンバーなし</td></tr>
                ) : (
                  categorizedRiders.full.map((m, index) => {
                    const resp = responseMap.get(String(m.game_id)) || {};
                    const pVal = Number(resp.participation_type);
                    
                    let pLabel = '-';
                    let pBadgeStyle = 'bg-slate-800 text-slate-400 border-slate-700';
                    if (pVal === 1) {
                      pLabel = '移転込み';
                      pBadgeStyle = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
                    } else if (pVal === 2) {
                      pLabel = '戦闘時間のみ';
                      pBadgeStyle = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
                    }

                    const vcVal = Number(resp.vc_status);
                    const vcLabel = vcVal === 1 ? '①フル参加' : vcVal === 2 ? '②途中参加' : '③不参加';
                    const discordLabel = m.is_in_2275 === true || m.is_in_2275 === 'true' || m.is_in_2275 === '⚪︎' ? '⚪︎' : '×';

                    return (
                      <tr key={`${m.game_id}-${index}`} className="hover:bg-slate-800/30">
                        <td className="p-3 font-medium text-white bg-[#0b0f19] sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.name}</td>
                        <td className="p-3 text-slate-400 bg-[#0b0f19] sticky left-[130px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.game_id}</td>
                        <td className="p-3 text-slate-300 bg-[#0b0f19] sticky left-[240px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.alliance}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_fc_level || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_power || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_shield_soldier || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_spear_soldier || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_bow_soldier || '-'}</td>
                        <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] border ${pBadgeStyle}`}>{pLabel}</span></td>
                        <td className="p-3 text-slate-300">{vcLabel}</td>
                        <td className="p-3 text-slate-300 truncate max-w-[100px]">{resp.vc_memo || ''}</td>
                        <td className="p-3 text-center font-bold text-cyan-300">{discordLabel}</td>
                        <td className="p-3">
                          <select
                            value={riderAssignments[String(m.game_id)] || ''}
                            onChange={(e) => handleAssignmentChange(m.game_id, e.target.value)}
                            className="bg-[#151c2c] border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 w-24"
                          >
                            <option value="">未割当</option>
                            {validTeams.map((k) => (
                              <option key={k} value={k}>チーム {k}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. 途中参加 */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-amber-300 bg-[#151c2c] px-3 py-1.5 rounded-lg border border-slate-800">
            途中参加
          </div>
          <div className="overflow-x-auto max-h-[400px] border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse relative whitespace-nowrap">
              <thead className="sticky top-0 z-20 bg-[#151c2c] text-slate-300 shadow">
                <tr className="border-b border-slate-800">
                  <th className="p-3 min-w-[130px] bg-[#151c2c] sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">アカウント名</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c] sticky left-[130px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">Game ID</th>
                  <th className="p-3 min-w-[100px] bg-[#151c2c] sticky left-[240px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">同盟</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">FC</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">総力</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">盾</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">槍</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">弓</th>
                  <th className="p-3 text-center bg-[#151c2c]">20時</th>
                  <th className="p-3 text-center bg-[#151c2c]">21時</th>
                  <th className="p-3 text-center bg-[#151c2c]">22時</th>
                  <th className="p-3 text-center bg-[#151c2c]">23時</th>
                  <th className="p-3 text-center bg-[#151c2c]">24時</th>
                  <th className="p-3 text-center bg-[#151c2c]">25時</th>
                  <th className="p-3 min-w-[100px] bg-[#151c2c]">時間備考</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">VC参加</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c]">VC備考</th>
                  <th className="p-3 min-w-[80px] bg-[#151c2c]">Discord</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c]">チーム割当</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#0b0f19]">
                {categorizedRiders.mid.length === 0 ? (
                  <tr><td colSpan={19} className="text-center py-4 text-slate-500 bg-[#0b0f19]">該当メンバーなし</td></tr>
                ) : (
                  categorizedRiders.mid.map((m, index) => {
                    const resp = responseMap.get(String(m.game_id)) || {};
                    const vcVal = Number(resp.vc_status);
                    const vcLabel = vcVal === 1 ? '①フル参加' : vcVal === 2 ? '②途中参加' : '③不参加';
                    const discordLabel = m.is_in_2275 === true || m.is_in_2275 === 'true' || m.is_in_2275 === '⚪︎' ? '⚪︎' : '×';

                    return (
                      <tr key={`${m.game_id}-${index}`} className="hover:bg-slate-800/30">
                        <td className="p-3 font-medium text-white bg-[#0b0f19] sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.name}</td>
                        <td className="p-3 text-slate-400 bg-[#0b0f19] sticky left-[130px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.game_id}</td>
                        <td className="p-3 text-slate-300 bg-[#0b0f19] sticky left-[240px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.alliance}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_fc_level || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_power || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_shield_soldier || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_spear_soldier || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_bow_soldier || '-'}</td>
                        {[resp.slot_20, resp.slot_21, resp.slot_22, resp.slot_23, resp.slot_24, resp.slot_25].map((isChecked, i) => (
                          <td key={i} className="p-3 text-center">
                            <input 
                              type="checkbox" 
                              checked={!!isChecked} 
                              disabled 
                              className={`rounded w-4 h-4 border ${isChecked ? 'bg-cyan-950 border-cyan-400 text-cyan-400 opacity-100' : 'bg-slate-900 border-slate-700 opacity-50'} cursor-not-allowed accent-cyan-400`} 
                            />
                          </td>
                        ))}
                        <td className="p-3 text-slate-300 truncate max-w-[100px]">{resp.time_memo || ''}</td>
                        <td className="p-3 text-slate-300">{vcLabel}</td>
                        <td className="p-3 text-slate-300 truncate max-w-[100px]">{resp.vc_memo || ''}</td>
                        <td className="p-3 text-center font-bold text-cyan-300">{discordLabel}</td>
                        <td className="p-3">
                          <select
                            value={riderAssignments[String(m.game_id)] || ''}
                            onChange={(e) => handleAssignmentChange(m.game_id, e.target.value)}
                            className="bg-[#151c2c] border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 w-24"
                          >
                            <option value="">未割当</option>
                            {validTeams.map((k) => (
                              <option key={k} value={k}>チーム {k}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. 不参加 */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-rose-300 bg-[#151c2c] px-3 py-1.5 rounded-lg border border-slate-800">
            不参加
          </div>
          <div className="overflow-x-auto max-h-[400px] border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse relative whitespace-nowrap">
              <thead className="sticky top-0 z-20 bg-[#151c2c] text-slate-300 shadow">
                <tr className="border-b border-slate-800">
                  <th className="p-3 min-w-[130px] bg-[#151c2c] sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">アカウント名</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c] sticky left-[130px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">Game ID</th>
                  <th className="p-3 min-w-[100px] bg-[#151c2c] sticky left-[240px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">同盟</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">FC</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">総力</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">盾</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">槍</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">弓</th>
                  <th className="p-3 min-w-[130px] bg-[#151c2c]">参加時間</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">VC参加</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c]">VC備考</th>
                  <th className="p-3 min-w-[80px] bg-[#151c2c]">Discord</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c]">チーム割当</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#0b0f19]">
                {categorizedRiders.noPart.length === 0 ? (
                  <tr><td colSpan={13} className="text-center py-4 text-slate-500 bg-[#0b0f19]">該当メンバーなし</td></tr>
                ) : (
                  categorizedRiders.noPart.map((m, index) => {
                    const resp = responseMap.get(String(m.game_id)) || {};
                    const vcVal = Number(resp.vc_status);
                    const vcLabel = vcVal === 1 ? '①フル参加' : vcVal === 2 ? '②途中参加' : '③不参加';
                    const discordLabel = m.is_in_2275 === true || m.is_in_2275 === 'true' || m.is_in_2275 === '⚪︎' ? '⚪︎' : '×';

                    return (
                      <tr key={`${m.game_id}-${index}`} className="hover:bg-slate-800/30">
                        <td className="p-3 font-medium text-white bg-[#0b0f19] sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.name}</td>
                        <td className="p-3 text-slate-400 bg-[#0b0f19] sticky left-[130px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.game_id}</td>
                        <td className="p-3 text-slate-300 bg-[#0b0f19] sticky left-[240px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.alliance}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_fc_level || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_power || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_shield_soldier || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_spear_soldier || '-'}</td>
                        <td className="p-3 text-slate-300">{resp.snapshot_bow_soldier || '-'}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">不参加</span></td>
                        <td className="p-3 text-slate-300">{vcLabel}</td>
                        <td className="p-3 text-slate-300 truncate max-w-[100px]">{resp.vc_memo || ''}</td>
                        <td className="p-3 text-center font-bold text-cyan-300">{discordLabel}</td>
                        <td className="p-3 text-slate-500 text-center">-</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. 未回答 */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-400 bg-[#151c2c] px-3 py-1.5 rounded-lg border border-slate-800">
            未回答
          </div>
          <div className="overflow-x-auto max-h-[400px] border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse relative whitespace-nowrap">
              <thead className="sticky top-0 z-20 bg-[#151c2c] text-slate-300 shadow">
                <tr className="border-b border-slate-800">
                  <th className="p-3 min-w-[130px] bg-[#151c2c] sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">アカウント名</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c] sticky left-[130px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">Game ID</th>
                  <th className="p-3 min-w-[100px] bg-[#151c2c] sticky left-[240px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">同盟</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">FC</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">総力</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">盾</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">槍</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">弓</th>
                  <th className="p-3 min-w-[130px] bg-[#151c2c]">参加時間</th>
                  <th className="p-3 min-w-[90px] bg-[#151c2c]">VC参加</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c]">VC備考</th>
                  <th className="p-3 min-w-[80px] bg-[#151c2c]">Discord</th>
                  <th className="p-3 min-w-[110px] bg-[#151c2c]">チーム割当</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#0b0f19]">
                {categorizedRiders.unanswered.length === 0 ? (
                  <tr><td colSpan={13} className="text-center py-4 text-slate-500 bg-[#0b0f19]">該当メンバーなし</td></tr>
                ) : (
                  categorizedRiders.unanswered.map((m, index) => {
                    const discordLabel = m.is_in_2275 === true || m.is_in_2275 === 'true' || m.is_in_2275 === '⚪︎' ? '⚪︎' : '×';

                    return (
                      <tr key={`${m.game_id}-${index}`} className="hover:bg-slate-800/30">
                        <td className="p-3 font-medium text-white bg-[#0b0f19] sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.name}</td>
                        <td className="p-3 text-slate-400 bg-[#0b0f19] sticky left-[130px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.game_id}</td>
                        <td className="p-3 text-slate-300 bg-[#0b0f19] sticky left-[240px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{m.alliance}</td>
                        <td className="p-3 text-slate-300">{m.fc_level || '-'}</td>
                        <td className="p-3 text-slate-300">{m.current_power || '-'}</td>
                        <td className="p-3 text-slate-300">{m.shield_soldier || '-'}</td>
                        <td className="p-3 text-slate-300">{m.spear_soldier || '-'}</td>
                        <td className="p-3 text-slate-300">{m.bow_soldier || '-'}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">未回答</span></td>
                        <td className="p-3 text-slate-300">-</td>
                        <td className="p-3 text-slate-300">-</td>
                        <td className="p-3 text-center font-bold text-cyan-300">{discordLabel}</td>
                        <td className="p-3">
                          <select
                            value={riderAssignments[String(m.game_id)] || ''}
                            onChange={(e) => handleAssignmentChange(m.game_id, e.target.value)}
                            className="bg-[#151c2c] border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 w-24"
                          >
                            <option value="">未割当</option>
                            {validTeams.map((k) => (
                              <option key={k} value={k}>チーム {k}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}