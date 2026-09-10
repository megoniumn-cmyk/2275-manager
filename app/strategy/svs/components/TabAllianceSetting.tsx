'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TabAllianceSettingProps = {
  selectedDate: string;
};

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

export default function TabAllianceSetting({ selectedDate }: TabAllianceSettingProps) {
  const [allianceList, setAllianceList] = useState<{ alliance: string; display_order: number }[]>([]);
  const [garrisonAlliance, setGarrisonAlliance] = useState<string>('');
  const [ghostAlliance, setGhostAlliance] = useState<string>('');

  const [members, setMembers] = useState<any[]>([]);
  const [surveyMasterId, setSurveyMasterId] = useState<string | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);

  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const [petSettings, setPetSettings] = useState<{ [key: string]: any }>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [manuallyAddedGameIds, setManuallyAddedGameIds] = useState<string[]>([]);
  const [excludedGameIds, setExcludedGameIds] = useState<string[]>([]);

  const [rallyAssignments, setRallyAssignments] = useState<{ [slot: string]: { [pos: string]: string[] } }>({
    '21-23': { garrison: [], ghost1: [], ghost2: [], ghost3: [] },
    '23-25': { garrison: [], ghost1: [], ghost2: [], ghost3: [] },
    '25-26': { garrison: [], ghost1: [], ghost2: [], ghost3: [] },
  });
  const [newLeaderInput, setNewLeaderInput] = useState<{ slot: string; pos: string; gameId: string }>({
    slot: '21-23',
    pos: 'garrison',
    gameId: '',
  });

  const [saveStatus, setSaveStatus] = useState<string>('保存済み');

  useEffect(() => {
    async function fetchAlliances() {
      const { data, error } = await supabase
        .from('alliance_list')
        .select('alliance, display_order')
        .order('display_order', { ascending: true });
      if (!error && data) {
        setAllianceList(data);
      }
    }
    fetchAlliances();
  }, []);

  useEffect(() => {
    async function fetchData() {
      setIsInitializing(true);
      const { data: memData, error: memError } = await supabase
        .from('members')
        .select('*')
        .not('status', 'eq', 'left');

      if (memError || !memData) {
        setIsInitializing(false);
        return;
      }
      setMembers(memData);

      if (!selectedDate) {
        setSurveyMasterId(null);
        setSurveyResponses([]);
        setIsInitializing(false);
        return;
      }

      let mId: string | null = null;
      const { data: masterData, error: masterError } = await supabase
        .from('surveys_master')
        .select('id')
        .eq('survey_type', 'svs')
        .eq('event_date', selectedDate)
        .limit(1);

      if (!masterError && masterData && masterData.length > 0) {
        mId = masterData[0].id;
      } else {
        const { data: newMasterData, error: newMasterError } = await supabase
          .from('surveys_master')
          .insert({
            survey_type: 'svs',
            event_date: selectedDate,
          })
          .select('id')
          .single();

        if (!newMasterError && newMasterData) {
          mId = newMasterData.id;
        }
      }

      if (!mId) {
        setSurveyMasterId(null);
        setSurveyResponses([]);
        setIsInitializing(false);
        return;
      }

      setSurveyMasterId(mId);

      const { data: infoData } = await supabase
        .from('strategy_svs_info')
        .select('*')
        .eq('survey_id', mId)
        .single();

      if (infoData) {
        setGarrisonAlliance(infoData.main || '');
        setGhostAlliance(infoData.gost_1 || '');
      } else {
        setGarrisonAlliance('');
        setGhostAlliance('');
      }

      const { data: leaderData } = await supabase
        .from('strategy_svs_leader')
        .select('*')
        .eq('survey_id', mId);

      if (leaderData && leaderData.length > 0) {
        const loadedPetSettings: { [key: string]: any } = {};
        const loadedExclusions: string[] = [];
        const loadedManuals: string[] = [];
        const loadedRally: { [slot: string]: { [pos: string]: string[] } } = {
          '21-23': { garrison: [], ghost1: [], ghost2: [], ghost3: [] },
          '23-25': { garrison: [], ghost1: [], ghost2: [], ghost3: [] },
          '25-26': { garrison: [], ghost1: [], ghost2: [], ghost3: [] },
        };

        leaderData.forEach((item) => {
          const gId = item.game_id;
          if (item.delate) {
            loadedExclusions.push(gId);
          } else {
            const mem = memData.find((m) => m.game_id === gId);
            if (mem && !mem.leader) {
              loadedManuals.push(gId);
            }
          }

          loadedPetSettings[gId] = {
            pet21_23: item.p_2123 || false,
            pet23_25: item.p_2325 || false,
            pet24_26: item.p_2426 || false,
            march21_23: item.m_2123 || '',
            march23_24: item.m_2324 || '',
            march24_25: item.m_2425 || '',
            march25_26: item.m_2526 || '',
          };

          ['21-23', '23-25', '25-26'].forEach((slot) => {
            const val = 
              slot === '21-23' ? item.r_2123 : 
              slot === '23-25' ? item.r_2325 : 
              item.r_2526;
            if (val) {
              if (loadedRally[slot] && loadedRally[slot][val]) {
                if (!loadedRally[slot][val].includes(gId)) {
                  loadedRally[slot][val].push(gId);
                }
              }
            }
          });
        });

        setPetSettings(loadedPetSettings);
        setExcludedGameIds(loadedExclusions);
        setManuallyAddedGameIds(loadedManuals);
        setRallyAssignments(loadedRally);
      } else {
        setPetSettings({});
        setExcludedGameIds([]);
        setManuallyAddedGameIds([]);
        setRallyAssignments({
          '21-23': { garrison: [], ghost1: [], ghost2: [], ghost3: [] },
          '23-25': { garrison: [], ghost1: [], ghost2: [], ghost3: [] },
          '25-26': { garrison: [], ghost1: [], ghost2: [], ghost3: [] },
        });
      }

      const { data: respData, error: respError } = await supabase
        .from('survey_responses_svs')
        .select('*')
        .eq('survey_id', mId);

      if (!respError && respData) {
        setSurveyResponses(respData);
      }

      setIsInitializing(false);
    }

    fetchData();
  }, [selectedDate]);

  const memberMap = useMemo(() => {
    const map = new Map();
    members.forEach((m) => map.set(m.game_id, m));
    return map;
  }, [members]);

  const responseMap = useMemo(() => {
    const map = new Map();
    surveyResponses.forEach((r) => map.set(r.game_id, r));
    return map;
  }, [surveyResponses]);

  const activeLeaders = useMemo(() => {
    return members.filter((m) => {
      if (excludedGameIds.includes(m.game_id)) return false;
      if (m.leader === true) return true;
      if (manuallyAddedGameIds.includes(m.game_id)) return true;
      return false;
    });
  }, [members, manuallyAddedGameIds, excludedGameIds]);

  const summaryMembers = useMemo(() => {
    const allianceOrderMap = new Map();
    allianceList.forEach((a) => allianceOrderMap.set(a.alliance, a.display_order));

    return [...activeLeaders].sort((a, b) => {
      const isManualA = manuallyAddedGameIds.includes(a.game_id);
      const isManualB = manuallyAddedGameIds.includes(b.game_id);

      if (isManualA && !isManualB) return 1;
      if (!isManualA && isManualB) return -1;

      const respA = responseMap.get(a.game_id);
      const respB = responseMap.get(b.game_id);

      const getPTypeScore = (resp: any) => {
        if (!resp || resp.participation_type == null) return 5;
        const val = Number(resp.participation_type);
        return [1, 2, 3, 4].includes(val) ? val : 5;
      };
      const scoreA = getPTypeScore(respA);
      const scoreB = getPTypeScore(respB);
      if (scoreA !== scoreB) return scoreA - scoreB;

      const orderA = allianceOrderMap.get(a.alliance) ?? 999;
      const orderB = allianceOrderMap.get(b.alliance) ?? 999;
      if (orderA !== orderB) return orderA - orderB;

      const powerA = parsePower(a.current_power);
      const powerB = parsePower(b.current_power);
      return powerB - powerA;
    });
  }, [activeLeaders, responseMap, allianceList, manuallyAddedGameIds]);

  const saveInfoToSupabase = useCallback(async (mainVal: string, gostVal: string) => {
    if (isInitializing || !surveyMasterId || !selectedDate) return;
    setSaveStatus('保存中...');
    
    const { error } = await supabase
      .from('strategy_svs_info')
      .upsert({
        survey_id: surveyMasterId,
        event_date: selectedDate,
        main: mainVal,
        gost_1: gostVal,
      }, { onConflict: 'survey_id' });

    if (error) {
      console.error(error);
      setSaveStatus('保存失敗');
    } else {
      setSaveStatus('保存済み');
    }
  }, [isInitializing, surveyMasterId, selectedDate]);

  const saveLeaderToSupabase = useCallback(async (
    gameId: string, 
    overrides: {
      petSettingsMap?: any;
      rallyMap?: any;
      exclusions?: string[];
      manuals?: string[];
    } = {}
  ) => {
    if (isInitializing || !surveyMasterId || !selectedDate) return;
    const mem = memberMap.get(gameId);
    if (!mem) return;

    const currentPets = overrides.petSettingsMap || petSettings;
    const currentRally = overrides.rallyMap || rallyAssignments;
    const currentExclusions = overrides.exclusions || excludedGameIds;

    const setting = currentPets[gameId] || {};
    const isDelated = currentExclusions.includes(gameId);

    let r2123 = null;
    let r2325 = null;
    let r2526 = null;

    ['garrison', 'ghost1', 'ghost2', 'ghost3'].forEach((pos) => {
      if (currentRally['21-23']?.[pos]?.includes(gameId)) r2123 = pos;
      if (currentRally['23-25']?.[pos]?.includes(gameId)) r2325 = pos;
      if (currentRally['25-26']?.[pos]?.includes(gameId)) r2526 = pos;
    });

    setSaveStatus('保存中...');
    const { error } = await supabase
      .from('strategy_svs_leader')
      .upsert({
        survey_id: surveyMasterId,
        event_date: selectedDate,
        game_id: gameId,
        name: mem.name,
        r_2123: r2123,
        r_2325: r2325,
        r_2526: r2526,
        p_2123: !!setting.pet21_23,
        p_2325: !!setting.pet23_25,
        p_2426: !!setting.pet24_26,
        m_2123: setting.march21_23 || null,
        m_2324: setting.march23_24 || null,
        m_2425: setting.march24_25 || null,
        m_2526: setting.march25_26 || null,
        delate: isDelated,
      }, { onConflict: 'survey_id,game_id' });

    if (error) {
      console.error(error);
      setSaveStatus('保存失敗');
    } else {
      setSaveStatus('保存済み');
    }
  }, [isInitializing, surveyMasterId, selectedDate, memberMap, petSettings, rallyAssignments, excludedGameIds]);

  const handleGarrisonChange = (val: string) => {
    setGarrisonAlliance(val);
    saveInfoToSupabase(val, ghostAlliance);
  };

  const handleGhostChange = (val: string) => {
    setGhostAlliance(val);
    saveInfoToSupabase(garrisonAlliance, val);
  };

  // 💡 ペット時間の排他制御（1つのアカウントにつき1つだけチェック可能にする）
  const handlePetSettingChange = (gameId: string, field: string, checked: boolean) => {
    const currentSetting = petSettings[gameId] || {};
    
    // チェックをオンにする場合は、他のペット時間を全て false にリセットする
    const updatedSetting = {
      ...currentSetting,
      pet21_23: field === 'pet21_23' ? checked : false,
      pet23_25: field === 'pet23_25' ? checked : false,
      pet24_26: field === 'pet24_26' ? checked : false,
    };

    const updated = {
      ...petSettings,
      [gameId]: updatedSetting,
    };

    setPetSettings(updated);
    saveLeaderToSupabase(gameId, { petSettingsMap: updated });
  };

  const handleRemoveMember = (gameId: string) => {
    const newExclusions = [...excludedGameIds, gameId];
    const newManuals = manuallyAddedGameIds.filter((id) => id !== gameId);
    setExcludedGameIds(newExclusions);
    setManuallyAddedGameIds(newManuals);
    saveLeaderToSupabase(gameId, { exclusions: newExclusions, manuals: newManuals });
  };

  const handleAddRallyMember = () => {
    const { slot, pos, gameId } = newLeaderInput;
    if (!gameId) return;
    const updatedRally = {
      ...rallyAssignments,
      [slot]: {
        ...rallyAssignments[slot],
        [pos]: [...(rallyAssignments[slot]?.[pos] || []), gameId],
      },
    };
    setRallyAssignments(updatedRally);
    setNewLeaderInput((prev) => ({ ...prev, gameId: '' }));
    saveLeaderToSupabase(gameId, { rallyMap: updatedRally });
  };

  const handleRemoveRallyMember = (slot: string, pos: string, gameId: string) => {
    const updatedRally = {
      ...rallyAssignments,
      [slot]: {
        ...rallyAssignments[slot],
        [pos]: (rallyAssignments[slot]?.[pos] || []).filter((id) => id !== gameId),
      },
    };
    setRallyAssignments(updatedRally);
    saveLeaderToSupabase(gameId, { rallyMap: updatedRally });
  };

  const isLeaderPetChecked = (gameId: string, slot: string) => {
    const setting = petSettings[gameId];
    if (!setting) return false;
    if (slot === '21-23') return !!setting.pet21_23;
    if (slot === '23-25') return !!setting.pet23_25;
    if (slot === '25-26') return !!setting.pet24_26;
    return false;
  };

  // 💡 ラリー設定で、現在選択中の時間枠（slot）にすでに配置されているアカウントIDのリストを取得
  const assignedGameIdsInCurrentSlot = useMemo(() => {
    const slotData = rallyAssignments[newLeaderInput.slot] || {};
    const ids: string[] = [];
    ['garrison', 'ghost1', 'ghost2', 'ghost3'].forEach((pos) => {
      if (slotData[pos]) {
        ids.push(...slotData[pos]);
      }
    });
    return ids;
  }, [rallyAssignments, newLeaderInput.slot]);

  // 💡 既に同じ時間枠に配置されているリーダーをプルダウンの選択肢から除外
  const availableLeadersForRally = useMemo(() => {
    return activeLeaders.filter((m) => !assignedGameIdsInCurrentSlot.includes(m.game_id));
  }, [activeLeaders, assignedGameIdsInCurrentSlot]);

  const filteredCandidatesForAdd = useMemo(() => {
    return members.filter((m) => {
      if (activeLeaders.some((al) => al.game_id === m.game_id)) return false;
      if (!searchQuery) return true;
      return (
        m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.game_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.alliance?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [members, activeLeaders, searchQuery]);

  const handleManualAddMember = (gameId: string) => {
    const newExclusions = excludedGameIds.filter((id) => id !== gameId);
    const newManuals = manuallyAddedGameIds.includes(gameId) ? manuallyAddedGameIds : [...manuallyAddedGameIds, gameId];
    setExcludedGameIds(newExclusions);
    setManuallyAddedGameIds(newManuals);
    saveLeaderToSupabase(gameId, { exclusions: newExclusions, manuals: newManuals });
    setIsAddModalOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end items-center gap-2">
        <span className="text-[11px] text-slate-400">ステータス:</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${saveStatus === '保存済み' ? 'bg-emerald-500/20 text-emerald-300' : saveStatus === '保存中...' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'}`}>
          {saveStatus}
        </span>
      </div>

      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 space-y-4 shadow-inner">
        <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
          <span>🏛️</span> 同盟設定
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">駐屯同盟</label>
            <select
              value={garrisonAlliance}
              onChange={(e) => handleGarrisonChange(e.target.value)}
              className="w-full bg-[#151c2c] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">選択してください</option>
              {allianceList.map((item) => (
                <option key={item.alliance} value={item.alliance}>
                  {item.alliance}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">ゴースト同盟</label>
            <select
              value={ghostAlliance}
              onChange={(e) => handleGhostChange(e.target.value)}
              className="w-full bg-[#151c2c] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">選択してください</option>
              {allianceList.map((item) => (
                <option key={item.alliance} value={item.alliance}>
                  {item.alliance}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 space-y-4 shadow-inner">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <span>🐾</span> ペット時間・行軍時間設定
          </h3>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow"
          >
            <span>＋</span> リーダー以外を追加
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-[#151c2c]/50">
                <th className="p-3">アカウント名</th>
                <th className="p-3">同盟</th>
                <th className="p-3 text-center">ペット (21-23)</th>
                <th className="p-3 text-center">ペット (23-25)</th>
                <th className="p-3 text-center">ペット (24-26)</th>
                <th className="p-3 text-center">行軍 (21-23)</th>
                <th className="p-3 text-center">行軍 (23-24)</th>
                <th className="p-3 text-center">行軍 (24-25)</th>
                <th className="p-3 text-center">行軍 (25-26)</th>
                <th className="p-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {activeLeaders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-6 text-slate-500">
                    該当するリーダーまたは追加されたメンバーがいません
                  </td>
                </tr>
              ) : (
                activeLeaders.map((m, idx) => {
                  const setting = petSettings[m.game_id] || {};
                  return (
                    <tr key={m.game_id || idx} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-medium text-white">{m.name}</td>
                      <td className="p-3 text-slate-300">{m.alliance}</td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!setting.pet21_23}
                          onChange={(e) => handlePetSettingChange(m.game_id, 'pet21_23', e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!setting.pet23_25}
                          onChange={(e) => handlePetSettingChange(m.game_id, 'pet23_25', e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!setting.pet24_26}
                          onChange={(e) => handlePetSettingChange(m.game_id, 'pet24_26', e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="text"
                          value={setting.march21_23 || ''}
                          onChange={(e) => {
                            const updated = { ...petSettings, [m.game_id]: { ...(petSettings[m.game_id] || {}), march21_23: e.target.value } };
                            setPetSettings(updated);
                            saveLeaderToSupabase(m.game_id, { petSettingsMap: updated });
                          }}
                          placeholder="行軍時間"
                          className="w-20 bg-[#151c2c] border border-slate-800 rounded px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="text"
                          value={setting.march23_24 || ''}
                          onChange={(e) => {
                            const updated = { ...petSettings, [m.game_id]: { ...(petSettings[m.game_id] || {}), march23_24: e.target.value } };
                            setPetSettings(updated);
                            saveLeaderToSupabase(m.game_id, { petSettingsMap: updated });
                          }}
                          placeholder="行軍時間"
                          className="w-20 bg-[#151c2c] border border-slate-800 rounded px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="text"
                          value={setting.march24_25 || ''}
                          onChange={(e) => {
                            const updated = { ...petSettings, [m.game_id]: { ...(petSettings[m.game_id] || {}), march24_25: e.target.value } };
                            setPetSettings(updated);
                            saveLeaderToSupabase(m.game_id, { petSettingsMap: updated });
                          }}
                          placeholder="行軍時間"
                          className="w-20 bg-[#151c2c] border border-slate-800 rounded px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="text"
                          value={setting.march25_26 || ''}
                          onChange={(e) => {
                            const updated = { ...petSettings, [m.game_id]: { ...(petSettings[m.game_id] || {}), march25_26: e.target.value } };
                            setPetSettings(updated);
                            saveLeaderToSupabase(m.game_id, { petSettingsMap: updated });
                          }}
                          placeholder="行軍時間"
                          className="w-20 bg-[#151c2c] border border-slate-800 rounded px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-cyan-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleRemoveMember(m.game_id)}
                          className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded text-[10px] font-bold transition cursor-pointer"
                          title="この行を削除（非表示にする）"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 space-y-4 shadow-inner">
        <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
          <span>⚔️</span> ラリー設定
        </h3>

        <div className="flex flex-wrap items-center gap-3 bg-[#151c2c] p-3 rounded-xl border border-slate-800">
          <div className="text-xs font-bold text-slate-300">追加配置:</div>
          <select
            value={newLeaderInput.slot}
            onChange={(e) => setNewLeaderInput({ ...newLeaderInput, slot: e.target.value, gameId: '' })}
            className="bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-xs text-white"
          >
            <option value="21-23">21-23</option>
            <option value="23-25">23-25</option>
            <option value="25-26">25-26</option>
          </select>
          <select
            value={newLeaderInput.pos}
            onChange={(e) => setNewLeaderInput({ ...newLeaderInput, pos: e.target.value })}
            className="bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-xs text-white"
          >
            <option value="garrison">駐屯</option>
            <option value="ghost1">ゴースト1</option>
            <option value="ghost2">ゴースト2</option>
            <option value="ghost3">ゴースト3</option>
          </select>
          <select
            value={newLeaderInput.gameId}
            onChange={(e) => setNewLeaderInput({ ...newLeaderInput, gameId: e.target.value })}
            className="bg-[#0b0f19] border border-slate-800 rounded px-2 py-1 text-xs text-white flex-1 min-w-[150px]"
          >
            <option value="">リーダーを選択</option>
            {availableLeadersForRally.map((m) => (
              <option key={m.game_id} value={m.game_id}>{m.name} ({m.alliance})</option>
            ))}
          </select>
          <button
            onClick={handleAddRallyMember}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold transition cursor-pointer"
          >
            配置する
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-[#151c2c]/50">
                <th className="p-3 w-28">時間枠</th>
                <th className="p-3">駐屯</th>
                <th className="p-3">ゴースト1</th>
                <th className="p-3">ゴースト2</th>
                <th className="p-3">ゴースト3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {['21-23', '23-25', '25-26'].map((slot) => {
                const slotAssigns = rallyAssignments[slot] || {};
                return (
                  <tr key={slot} className="hover:bg-slate-800/20">
                    <td className="p-3 font-bold text-cyan-300">{slot}</td>
                    {(['garrison', 'ghost1', 'ghost2', 'ghost3'] as const).map((pos) => {
                      const assignedIds = slotAssigns[pos] || [];
                      return (
                        <td key={pos} className="p-3 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {assignedIds.map((gId) => {
                              const mem = memberMap.get(gId);
                              const hasPet = isLeaderPetChecked(gId, slot);
                              return (
                                <span
                                  key={gId}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border shadow-sm ${
                                    hasPet
                                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold ring-1 ring-amber-500/50'
                                      : 'bg-[#151c2c] border-slate-700 text-slate-200'
                                  }`}
                                  title={hasPet ? 'ペット時間と一致（強調表示）' : ''}
                                >
                                  {mem ? mem.name : gId}
                                  <button
                                    onClick={() => handleRemoveRallyMember(slot, pos, gId)}
                                    className="text-slate-400 hover:text-rose-400 font-bold ml-1 cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                            {assignedIds.length === 0 && (
                              <span className="text-slate-600 text-[10px] italic">未配置</span>
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

      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 space-y-4 shadow-inner">
        <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
          <span>📊</span> 集結主参加集計
          <span className="text-xs text-slate-400 font-normal">（対象：リーダー等 / ソート：参加時間 ➔ 同盟順 ➔ 戦力順 ※追加リーダーは一番下）</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-[#151c2c]/50">
                <th className="p-3">アカウント名</th>
                <th className="p-3">同盟</th>
                <th className="p-3">参加時間</th>
                <th className="p-3 text-center">20時台</th>
                <th className="p-3 text-center">21時台</th>
                <th className="p-3 text-center">22時台</th>
                <th className="p-3 text-center">23時台</th>
                <th className="p-3 text-center">24時台</th>
                <th className="p-3 text-center">25時台</th>
                <th className="p-3">時間備考</th>
                <th className="p-3 text-center">VC参加</th>
                <th className="p-3">VC備考</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summaryMembers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-6 text-slate-500">
                    登録されているリーダーメンバーがいません
                  </td>
                </tr>
              ) : (
                summaryMembers.map((m, idx) => {
                  const resp = responseMap.get(m.game_id);
                  let pTypeLabel = '⑤未回答';
                  let pTypeVal = resp ? Number(resp.participation_type) : null;
                  if (pTypeVal === 1) pTypeLabel = '①フル参加(移転込み)';
                  else if (pTypeVal === 2) pTypeLabel = '②フル参加(戦闘時間のみ)';
                  else if (pTypeVal === 3) pTypeLabel = '③途中参加';
                  else if (pTypeVal === 4) pTypeLabel = '④不参加';

                  let vcLabel = '';
                  let vcVal = resp ? Number(resp.vc_status) : null;
                  if (vcVal === 1) vcLabel = '①フル参加';
                  else if (vcVal === 2) vcLabel = '②途中参加';
                  else if (vcVal === 3 || vcVal === null) vcLabel = resp ? '③不参加' : '';

                  return (
                    <tr key={m.game_id || idx} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-medium text-white">{m.name}</td>
                      <td className="p-3 text-slate-300">{m.alliance}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pTypeVal === 1
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : pTypeVal === 2
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : pTypeVal === 3
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {pTypeLabel}
                        </span>
                      </td>
                      {[
                        resp?.slot_20,
                        resp?.slot_21,
                        resp?.slot_22,
                        resp?.slot_23,
                        resp?.slot_24,
                        resp?.slot_25,
                      ].map((isChecked, i) => (
                        <td key={i} className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!isChecked}
                            disabled
                            className={`rounded w-4 h-4 transition ${
                              isChecked
                                ? 'bg-cyan-600 border-cyan-500 text-cyan-500 accent-cyan-500 opacity-100 cursor-not-allowed'
                                : 'bg-slate-900 border-slate-700 text-slate-600 opacity-40 cursor-not-allowed'
                            }`}
                          />
                        </td>
                      ))}
                      <td className="p-3 text-slate-300 text-[11px] truncate max-w-[120px]" title={resp?.time_memo || ''}>
                        {resp?.time_memo || ''}
                      </td>
                      <td className="p-3 text-center text-slate-300 text-[11px]">{vcLabel}</td>
                      <td className="p-3 text-slate-300 text-[11px] truncate max-w-[120px]" title={resp?.vc_memo || ''}>
                        {resp?.vc_memo || ''}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-cyan-400">リーダー以外を追加</h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSearchQuery('');
                }}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              placeholder="名前やゲームID、同盟で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-800/40">
              {filteredCandidatesForAdd.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-xs">追加可能なメンバーがいません</div>
              ) : (
                filteredCandidatesForAdd.map((m) => (
                  <div key={m.game_id} className="flex items-center justify-between py-2 px-2 hover:bg-slate-800/40 rounded">
                    <div>
                      <div className="text-xs font-bold text-white">{m.name}</div>
                      <div className="text-[10px] text-slate-400">同盟: {m.alliance} / ID: {m.game_id}</div>
                    </div>
                    <button
                      onClick={() => handleManualAddMember(m.game_id)}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold transition cursor-pointer"
                    >
                      追加
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}