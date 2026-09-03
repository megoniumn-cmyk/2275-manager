'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FrostDragonView({ eventId, surveyData }: { eventId: string; surveyData: any }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  // エントリー同盟一覧
  const [allianceOptions, setAllianceOptions] = useState<string[]>([]);
  const [selectedAllianceFilter, setSelectedAllianceFilter] = useState<string>('ALL');
  const [searchName, setSearchName] = useState<string>('');

  // モーダルの開閉管理
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalAlliance, setModalAlliance] = useState<string>('GOD');
  const [modalEntryType, setModalEntryType] = useState<string>('軍1');
  const [modalError, setModalError] = useState<string>('');

  // 過去イベント表示切り替えフラグ
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [participationsMap, setParticipationsMap] = useState<{ [key: string]: string }>({});

  // コピー完了通知用
  const [copyStatus, setCopyStatus] = useState<string>('');

  // eventIdが変わるたびにデータを再取得
  useEffect(() => {
    if (eventId) {
      setAllianceOptions([]);
      fetchData();
    }
  }, [eventId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. members 取得
      const { data: members, error: memberErr } = await supabase
        .from('members')
        .select('*')
        .neq('status', 'left');

      if (memberErr) throw memberErr;

      // 2. survey_responses_ftd 取得 (アンケート回答などの補助データ)
      const { data: responses, error: respErr } = await supabase
        .from('survey_responses_ftd')
        .select('*')
        .eq('survey_id', eventId);

      if (respErr) {
        console.warn('survey_responses_ftd の取得に失敗:', respErr);
      }

      // 3. events 取得
      const { data: eventsData, error: eventsErr } = await supabase
        .from('events')
        .select('*')
        .order('order_index', { ascending: true });

      if (eventsErr) {
        console.warn('events の取得に失敗:', eventsErr);
      } else {
        setEventsList(eventsData || []);
      }

      // 4. event_participations 取得 (エントリー・参加状態の主データ)
      const { data: partsData, error: partsErr } = await supabase
        .from('event_participations')
        .select('*')
        .eq('event_id', eventId);

      const partMap: { [key: string]: string } = {};
      if (partsErr) {
        console.warn('event_participations の取得に失敗:', partsErr);
      } else {
        (partsData || []).forEach((p) => {
          if (p.member_game_id) {
            partMap[p.member_game_id] = p.status || '未選択';
          }
        });
        setParticipationsMap(partMap);
      }

      // 5. event_alliance_configs 取得 (イベントごとのエントリー同盟設定)
      const { data: configData, error: configErr } = await supabase
        .from('event_alliance_configs')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

      if (configErr) {
        console.warn('event_alliance_configs の取得に失敗:', configErr);
      }

      if (configData && configData.alliance_options) {
        if (Array.isArray(configData.alliance_options)) {
          setAllianceOptions(configData.alliance_options);
        } else {
          setAllianceOptions([]);
        }
      } else {
        setAllianceOptions([]);
      }

      // 6. データ結合 (event_participationsのstatusを優先してエントリー同盟に反映)
      const merged = (members || []).map((m) => {
        const resp = (responses || []).find((r) => r.game_id === m.game_id && r.survey_id === eventId);
        
        // event_participationsに保存されているステータスがあれば最優先、なければ未選択
        const savedEntryAlliance = partMap[m.game_id] || '未選択';

        const isDiscordTrue = 
          m.is_in_2275 === true || 
          m.is_in_2275 === 'true' || 
          m.is_in_2275 == 1 || 
          m.is_discord === true || 
          m.is_discord === 'true';

        const isLeader = m.leader === true || m.leader === 'true' || m.leader == 1 || m.leader === '1';

        return {
          id: m.id,
          game_id: m.game_id || '',
          name: m.name || '名無し',
          alliance: m.alliance || '-',
          fc_level: m.fc_level || '-',
          current_power: m.current_power !== undefined && m.current_power !== null ? m.current_power : '-',
          shield_soldier: m.shield_soldier || '',
          spear_soldier: m.spear_soldier || '',
          bow_soldier: m.bow_soldier || '',
          leader: isLeader,
          is_discord: isDiscordTrue,
          
          entry_alliance: savedEntryAlliance,
          participation_type: resp?.participation_type !== undefined && resp?.participation_type !== null ? String(resp.participation_type) : '',
          time_slot_memo: resp?.time_slot_memo || '',
          vc_status: resp?.vc_status !== undefined && resp?.vc_status !== null ? String(resp.vc_status) : '',
          vc_memo: resp?.vc_memo || '',
          checked: false,
        };
      });

      setRows(merged);
    } catch (err) {
      console.error('データ読み込みエラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveAllianceOptionsToSupabase = async (newOptions: string[]) => {
    try {
      const { error } = await supabase
        .from('event_alliance_configs')
        .upsert({
          event_id: eventId,
          alliance_options: newOptions
        }, { onConflict: 'event_id' });

      if (error) {
        console.error('event_alliance_configs 保存エラー:', error);
      }
    } catch (e) {
      console.error('エントリー同盟設定の保存例外:', e);
    }
  };

  const handleChangeField = async (indexOriginal: number, field: string, value: any) => {
    const targetRow = filteredAndSortedRows[indexOriginal];
    const realIndex = rows.findIndex((r) => r.game_id === targetRow.game_id);
    if (realIndex !== -1) {
      const updated = [...rows];
      updated[realIndex][field] = value;
      setRows(updated);

      if (field === 'entry_alliance') {
        const gameId = targetRow.game_id;
        // マップ側も即時反映
        setParticipationsMap(prev => ({ ...prev, [gameId]: value }));

        try {
          // upsert を利用して保存（event_id と member_game_id の複合ユニーク制約が必要）
          const { error: upsertErr } = await supabase
            .from('event_participations')
            .upsert({
              event_id: eventId,
              member_game_id: gameId,
              status: value,
              created_at: new Date().toISOString()
            }, {
              onConflict: 'event_id,member_game_id'
            });

          if (upsertErr) {
            console.error('event_participations 保存エラー詳細:', {
              message: upsertErr.message,
              details: upsertErr.details,
              hint: upsertErr.hint,
              code: upsertErr.code
            });
          }
        } catch (e) {
          console.error('event_participations 保存例外:', e);
        }
      }
    }
  };

  const handleAddAllianceFromModal = () => {
    setModalError('');
    
    const isTypeAlreadyUsed = allianceOptions.some(opt => {
      const parts = opt.split(' ');
      const typePart = parts.slice(1).join(' ');
      return typePart === modalEntryType;
    });

    if (isTypeAlreadyUsed) {
      setModalError(`「${modalEntryType}」はすでに他の同盟で選択されています。軍1を選べる同盟は1つのみです。`);
      return;
    }

    const newName = `${modalAlliance} ${modalEntryType}`;
    if (allianceOptions.includes(newName)) {
      setModalError('すでに同じ組み合わせが登録されています。');
      return;
    }

    const updatedOptions = [...allianceOptions, newName];
    setAllianceOptions(updatedOptions);
    saveAllianceOptionsToSupabase(updatedOptions);
    setIsModalOpen(false);
  };

  const handleRemoveAlliance = async (optToRemove: string) => {
    const updatedOptions = allianceOptions.filter(opt => opt !== optToRemove);
    setAllianceOptions(updatedOptions);
    saveAllianceOptionsToSupabase(updatedOptions);

    // 該当する同盟を選択していたメンバーのステータスを「未選択」にリセット
    const affectedMembers = rows.filter(r => r.entry_alliance === optToRemove);
    setRows(prevRows => 
      prevRows.map(r => {
        if (r.entry_alliance === optToRemove) {
          return { ...r, entry_alliance: '未選択' };
        }
        return r;
      })
    );

    for (const m of affectedMembers) {
      try {
        await supabase
          .from('event_participations')
          .upsert({
            event_id: eventId,
            member_game_id: m.game_id,
            status: '未選択',
            created_at: new Date().toISOString()
          }, {
            onConflict: 'event_id,member_game_id'
          });
      } catch (e) {
        console.error('ステータスリセットエラー:', e);
      }
    }
  };

  const parsePowerToNumber = (powerStr: any) => {
    if (!powerStr || powerStr === '-') return 0;
    const str = String(powerStr).trim().toUpperCase();
    let multiplier = 1;
    if (str.endsWith('B')) multiplier = 1000000000;
    else if (str.endsWith('M')) multiplier = 1000000;
    else if (str.endsWith('K')) multiplier = 1000;
    const num = parseFloat(str.replace(/[BMK]/g, ''));
    return isNaN(num) ? 0 : num * multiplier;
  };

  const compareAlliances = (allianceA: string, allianceB: string) => {
    const getOrderWeight = (alg: string) => {
      const upper = String(alg || '').trim().toUpperCase();
      if (upper === 'GOD') return 1;
      if (upper === 'GEN') return 2;
      if (upper === 'WWW') return 3;
      return 10;
    };
    const weightA = getOrderWeight(allianceA);
    const weightB = getOrderWeight(allianceB);
    if (weightA !== weightB) return weightA - weightB;
    return String(allianceA).localeCompare(String(allianceB));
  };

  const T11_ALL = ['FC10T11', 'FC9T11', 'FC8T11', 'FC7T11', 'FC6T11', 'FC5T11'];
  const SET_FC10 = ['FC10T11'];
  const SET_FC10_9 = ['FC10T11', 'FC9T11'];
  const SET_FC10_8 = ['FC10T11', 'FC9T11', 'FC8T11'];
  const SET_FC10_7 = ['FC10T11', 'FC9T11', 'FC8T11', 'FC7T11'];
  const SET_FC10_5 = ['FC10T11', 'FC9T11', 'FC8T11', 'FC7T11', 'FC6T11', 'FC5T11'];

  const getSoldierCategoryIndex = (row: any) => {
    const s1 = String(row.shield_soldier || '').trim();
    const s2 = String(row.spear_soldier || '').trim();
    const s3 = String(row.bow_soldier || '').trim();
    const sList = [s1, s2, s3];

    if (s1 === 'FC10T11' && s2 === 'FC10T11' && s3 === 'FC10T11') return 2;
    if (sList.every(x => SET_FC10_9.includes(x)) && sList.some(x => SET_FC10.includes(x))) return 3;
    if (sList.every(x => SET_FC10_8.includes(x)) && sList.some(x => x === 'FC8T11')) return 4;
    if (sList.every(x => SET_FC10_7.includes(x)) && sList.some(x => x === 'FC7T11')) return 5;
    if (sList.every(x => SET_FC10_5.includes(x)) && sList.some(x => x === 'FC6T11' || x === 'FC5T11')) return 6;
    if (sList.some(x => T11_ALL.includes(x))) return 6; 
    return 7; 
  };

  const compareMembersCustom = (a: any, b: any) => {
    if (a.leader !== b.leader) return a.leader ? -1 : 1;
    if (a.leader && b.leader) {
      const algCmp = compareAlliances(a.alliance, b.alliance);
      if (algCmp !== 0) return algCmp;
    }

    const algCmp = compareAlliances(a.alliance, b.alliance);
    if (algCmp !== 0) return algCmp;

    const soldierCmp = getSoldierCategoryIndex(a) - getSoldierCategoryIndex(b);
    if (soldierCmp !== 0) return soldierCmp;

    return parsePowerToNumber(b.current_power) - parsePowerToNumber(a.current_power);
  };

  const getMasterPriorityGroup = (row: any) => {
    const partType = String(row.participation_type || '').trim();

    if (partType === '3') return 8;
    if (partType === '4') return 9;
    if (!['1', '2', '3', '4'].includes(partType)) return 10;
    if (row.leader) return 1;

    return getSoldierCategoryIndex(row);
  };

  const groupLabels: { [key: number]: string } = {
    1: '① リーダー',
    2: '② 全種FC10T11',
    3: '③ FC10〜9 T11',
    4: '④ FC10〜8 T11',
    5: '⑤ FC10〜7 T11',
    6: '⑥ FC10〜5 T11 / T11解放',
    7: '⑦ T11未解放',
    8: '⑧ 途中参加 (3)',
    9: '⑨ 不参加 (4)',
    10: '⑩ 未回答',
  };

  const categoryOrderNames = [
    'リーダー',
    '全種FC10T11',
    '全種FC9T11以上',
    '全種FC8T11以上',
    '全種FC7T11以上',
    '全種T11以上',
    'T11解放済み',
    'T11未解放'
  ];

  const filteredAndSortedRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (selectedAllianceFilter !== 'ALL' && r.alliance !== selectedAllianceFilter) return false;
      if (searchName.trim() !== '') {
        const query = searchName.trim().toLowerCase();
        const nameMatch = r.name.toLowerCase().includes(query);
        const idMatch = String(r.game_id).toLowerCase().includes(query);
        if (!nameMatch && !idMatch) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const groupA = getMasterPriorityGroup(a);
      const groupB = getMasterPriorityGroup(b);

      if (groupA !== groupB) return groupA - groupB;

      const algCmp = compareAlliances(a.alliance, b.alliance);
      if (algCmp !== 0) return algCmp;

      const soldierCmp = getSoldierCategoryIndex(a) - getSoldierCategoryIndex(b);
      if (soldierCmp !== 0) return soldierCmp;

      return parsePowerToNumber(b.current_power) - parsePowerToNumber(a.current_power);
    });
  }, [rows, selectedAllianceFilter, searchName]);

  const summaryStats = useMemo(() => {
    const participationColumns = [
      { key: '1', label: 'フル参加(移転含む)' },
      { key: '2', label: 'フル参加(戦闘のみ)' },
      { key: '3', label: '途中参加' },
      { key: '4', label: '不参加' },
      { key: 'unanswered', label: '未回答' },
    ];

    const matrix: { [cat: string]: { [colKey: string]: number } } = {};
    categoryOrderNames.forEach(cat => {
      matrix[cat] = {};
      participationColumns.forEach(col => { matrix[cat][col.key] = 0; });
    });

    rows.forEach(r => {
      let cat = 'T11未解放';
      if (r.leader) {
        cat = 'リーダー';
      } else {
        const subIdx = getSoldierCategoryIndex(r);
        if (subIdx === 2) cat = '全種FC10T11';
        else if (subIdx === 3) cat = '全種FC9T11以上';
        else if (subIdx === 4) cat = '全種FC8T11以上';
        else if (subIdx === 5) cat = '全種FC7T11以上';
        else if (subIdx === 6) cat = '全種T11以上';
        else if (subIdx === 7) cat = 'T11解放済み';
      }

      let colKey = String(r.participation_type || '').trim();
      if (!['1', '2', '3', '4'].includes(colKey)) {
        colKey = 'unanswered';
      }

      if (matrix[cat] && matrix[cat][colKey] !== undefined) {
        matrix[cat][colKey]++;
      }
    });

    const activeEntries = allianceOptions;
    const entryDetails: { [entry: string]: any[] } = {};
    activeEntries.forEach(entry => {
      const matched = rows.filter(r => r.entry_alliance === entry);
      matched.sort(compareMembersCustom);
      entryDetails[entry] = matched;
    });

    return { participationColumns, matrix, activeEntries, entryDetails };
  }, [rows, allianceOptions]);

  const handleCopyDiscordText = () => {
    let text = `**霜竜の覇者 エントリー集計結果**\n\n`;

    Object.entries(summaryStats.entryDetails).forEach(([entryName, members]) => {
      if (members.length === 0) return;
      text += `━━━━━━━━━━━━━━━\n`;
      text += `**${entryName} (${members.length}名)**\n`;
      text += `━━━━━━━━━━━━━━━\n`;
      
      const byAlliance: { [alg: string]: string[] } = {};
      members.forEach((m: any) => {
        if (!byAlliance[m.alliance]) byAlliance[m.alliance] = [];
        byAlliance[m.alliance].push(m.name);
      });

      Object.entries(byAlliance).forEach(([alg, names]) => {
        text += `> **${alg} (${names.length}名):**\n`;
        text += `> ${names.map((n) => `${n}`).join(' ')}\n\n`;
      });
    });

    navigator.clipboard.writeText(text);
    setCopyStatus('Discord用テキストをコピーしました！');
    setTimeout(() => setCopyStatus(''), 3000);
  };

  const renderParticipationLabel = (val: string) => {
    switch (val) {
      case '1': return 'フル参加(移転含む)';
      case '2': return 'フル参加(戦闘のみ)';
      case '3': return '途中参加';
      case '4': return '不参加';
      default: return '未回答';
    }
  };

  const renderVcLabel = (val: string) => {
    switch (val) {
      case '1': return 'フル参加';
      case '2': return '途中参加';
      case '3': return '不参加';
      default: return '-';
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 text-xs">データ読込中...</div>;
  }

  const allKnownAlliances = Array.from(new Set(rows.map((r) => r.alliance))).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-[#131b2e] p-4 rounded-lg border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-1.5 flex-wrap">
            <span className="text-xs text-slate-300 font-bold mr-2">同盟フィルター:</span>
            <button
              onClick={() => setSelectedAllianceFilter('ALL')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                selectedAllianceFilter === 'ALL' ? 'bg-cyan-600 text-white' : 'bg-[#0b0f19] text-slate-300 hover:bg-slate-800 border border-slate-700'
              }`}
            >
              すべて
            </button>
            {allKnownAlliances.map((alg) => (
              <button
                key={alg}
                onClick={() => setSelectedAllianceFilter(alg)}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  selectedAllianceFilter === alg ? 'bg-cyan-600 text-white' : 'bg-[#0b0f19] text-slate-300 hover:bg-slate-800 border border-slate-700'
                }`}
              >
                {alg}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3 flex-wrap">
            <button
              onClick={handleCopyDiscordText}
              className="px-3 py-1 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow"
            >
              📋 Discord用テキストをコピー
            </button>
            {copyStatus && <span className="text-xs text-emerald-400 font-bold">{copyStatus}</span>}

            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3 py-1 rounded text-xs font-medium transition border ${
                showHistory ? 'bg-amber-600 border-amber-500 text-white' : 'bg-[#0b0f19] border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {showHistory ? '過去イベント実績を非表示' : '過去イベント実績を表示'}
            </button>

            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="名前/IDで検索..."
              className="bg-[#0b0f19] border border-slate-700 rounded px-3 py-1 text-xs text-slate-100 w-36 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* エントリー同盟追加ボタン & 一覧エリア */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-xs text-slate-300 font-bold">エントリー同盟管理:</span>
              <button
                onClick={() => {
                  setModalError('');
                  setIsModalOpen(true);
                }}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded text-xs font-medium transition shadow"
              >
                + エントリー同盟追加
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-wrap pt-1">
            <span className="text-[11px] text-slate-400">登録中の一覧:</span>
            {allianceOptions.map((opt) => (
              <span key={opt} className="inline-flex items-center bg-[#0b0f19] border border-slate-700 rounded px-2.5 py-1 text-xs text-cyan-200">
                {opt}
                <button 
                  onClick={() => handleRemoveAlliance(opt)}
                  className="ml-2 text-red-400 hover:text-red-300 font-bold text-xs"
                  title="削除"
                >
                  ×
                </button>
              </span>
            ))}
            {allianceOptions.length === 0 && (
              <span className="text-[11px] text-slate-500">（登録されていません。「+ エントリー同盟追加」から追加してください）</span>
            )}
          </div>
        </div>
      </div>

      {/* エントリー同盟追加用オーバーレイ（モーダル） */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#131b2e] border border-slate-700 rounded-lg p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-sm font-bold text-white">新規エントリー同盟追加</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {modalError && (
                <div className="bg-red-950/80 border border-red-700 text-red-300 text-xs p-2.5 rounded">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">同盟選択 (GODが上)</label>
                <select
                  value={modalAlliance}
                  onChange={(e) => setModalAlliance(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="GOD">GOD</option>
                  <option value="GEN">GEN</option>
                  <option value="www">www</option>
                  <option value="RPN">RPN</option>
                  <option value="MSO">MSO</option>
                  <option value="NPT">NPT</option>
                  <option value="JvA">JvA</option>
                  <option value="ABU">ABU</option>
                  <option value="HUN">HUN</option>
                  <option value="ARK">ARK</option>
                  <option value="UTP">UTP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">エントリー選択 (※軍1などを選択できるのは1つのみ)</label>
                <select
                  value={modalEntryType}
                  onChange={(e) => setModalEntryType(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="軍1">軍1</option>
                  <option value="軍2">軍2</option>
                  <option value="軍3">軍3</option>
                  <option value="軍4">軍4</option>
                  <option value="軍1(控え)">軍1(控え)</option>
                  <option value="軍2(控え)">軍2(控え)</option>
                  <option value="軍3(控え)">軍3(控え)</option>
                  <option value="参加">参加</option>
                  <option value="控え">控え</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-700">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddAllianceFromModal}
                className="px-4 py-2 rounded text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow"
              >
                追加する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 集計表エリア（左右） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 左側：参加状態別のアンケート回答集計表 */}
        <div className="bg-[#131b2e] p-4 rounded-lg border border-slate-800 shadow-lg">
          <div className="text-xs font-bold text-cyan-400 mb-3 flex items-center">
            <span>📊 エントリー状態別 集計表（参加状態）</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-[#0b0f19] text-slate-400">
                  <th className="p-2">区分 / 参加状態</th>
                  {summaryStats.participationColumns.map(col => (
                    <th key={col.key} className="p-2 text-center">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {categoryOrderNames.map(cat => (
                  <tr key={cat} className="hover:bg-slate-800/40">
                    <td className="p-2 font-medium text-cyan-300">{cat}</td>
                    {summaryStats.participationColumns.map(col => (
                      <td key={col.key} className="p-2 text-center font-mono">
                        {summaryStats.matrix[cat]?.[col.key] || 0}人
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右側：割り振り人数・メンバー一覧 (エントリー別) */}
        <div className="bg-[#131b2e] p-4 rounded-lg border border-slate-800 shadow-lg flex flex-col">
          <div className="text-xs font-bold text-cyan-400 mb-3 flex items-center justify-between">
            <span>📋 割り振り人数・メンバー一覧 (エントリー別)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {summaryStats.activeEntries.length === 0 ? (
              <div className="col-span-full text-center text-slate-500 py-6 text-xs">
                エントリー同盟が登録されていません
              </div>
            ) : (
              summaryStats.activeEntries.map(entry => {
                const list = summaryStats.entryDetails[entry] || [];
                return (
                  <div key={entry} className="bg-[#0b0f19] p-3 rounded border border-slate-800 flex flex-col">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1 mb-2 font-bold text-white text-xs">
                      <span>{entry}</span>
                      <span className="text-cyan-400 font-mono">{list.length}名</span>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto space-y-1 text-[11px] text-slate-300 pr-1">
                      {list.map((m: any, idx: number) => (
                        <div key={m.game_id || idx} className="flex justify-between items-center px-1.5 py-0.5 hover:bg-slate-800/50 rounded">
                          <span className="truncate pr-2">{idx + 1}. {m.name}</span>
                          <span className="text-slate-400 font-mono shrink-0">({m.alliance})</span>
                        </div>
                      ))}
                      {list.length === 0 && <div className="text-slate-600 text-center py-2">メンバーなし</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* メインのメンバー一覧テーブル */}
      <div className="bg-[#131b2e] rounded-lg border border-slate-800 overflow-x-auto max-h-[70vh] shadow-xl">
        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-30">
            <tr className="border-b border-slate-700 bg-[#0b0f19] text-slate-400">
              <th className="p-3 w-12 text-center sticky left-0 z-30 bg-[#0b0f19]">作業</th>
              <th className="p-3 w-[110px] sticky left-12 z-30 bg-[#0b0f19]">名前</th>
              <th className="p-3 w-28 sticky left-[158px] z-30 bg-[#0b0f19]">ID</th>
              <th className="p-3 w-16 sticky left-[246px] z-30 bg-[#0b0f19] border-r border-slate-700">同盟</th>
              
              <th className="p-3 w-16">FC</th>
              <th className="p-3 w-24">総力</th>
              <th className="p-3 w-20">盾兵</th>
              <th className="p-3 w-20">槍兵</th>
              <th className="p-3 w-20">弓兵</th>
              <th className="p-3 w-36">エントリー（割り振り先）</th>
              <th className="p-3 w-16 text-center">Discord</th>
              <th className="p-3 w-36">参加時間</th>
              <th className="p-3 w-28">参加時間備考</th>
              <th className="p-3 w-28">VC</th>
              <th className="p-3 w-28">VC備考</th>

              {showHistory && eventsList.map((ev) => (
                <th key={ev.id} className="p-3 bg-[#1e1b18] text-amber-400 text-center border-l border-slate-700 min-w-[120px]">
                  <div className="font-bold">{ev.title}</div>
                  <div className="text-[10px] text-slate-400">{ev.event_date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filteredAndSortedRows.length === 0 ? (
              <tr>
                <td colSpan={15 + (showHistory ? eventsList.length : 0)} className="p-8 text-center text-slate-500">
                  該当するデータがありません
                </td>
              </tr>
            ) : (
              filteredAndSortedRows.map((row, index) => {
                const currentGroup = getMasterPriorityGroup(row);
                const prevRow = index > 0 ? filteredAndSortedRows[index - 1] : null;
                const prevGroup = prevRow ? getMasterPriorityGroup(prevRow) : null;
                const showGroupHeader = currentGroup !== prevGroup;

                return (
                  <React.Fragment key={`row-frag-${row.game_id || index}`}>
                    {showGroupHeader && (
                      <tr key={`group-header-${currentGroup}`} className="bg-[#0f172a] text-cyan-400 font-bold border-t border-b border-slate-700">
                        <td colSpan={15 + (showHistory ? eventsList.length : 0)} className="py-2 px-4 text-xs tracking-wide">
                          {groupLabels[currentGroup]}
                        </td>
                      </tr>
                    )}
                    <tr key={`${row.game_id}-${index}`} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 text-center sticky left-0 z-10 bg-[#131b2e]">
                        <input
                          type="checkbox"
                          checked={row.checked}
                          onChange={(e) => handleChangeField(index, 'checked', e.target.checked)}
                          className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                        />
                      </td>
                      <td className="p-3 w-[110px] sticky left-12 z-10 bg-[#131b2e] truncate font-medium text-white">
                        {row.name}
                      </td>
                      <td className="p-3 w-28 sticky left-[158px] z-10 bg-[#131b2e] text-[11px] text-slate-400 font-mono">
                        {row.game_id}
                      </td>
                      <td className="p-3 w-16 text-slate-300 sticky left-[246px] z-10 bg-[#131b2e] border-r border-slate-700/80">
                        {row.alliance}
                      </td>
                      
                      <td className="p-3 text-cyan-400 font-mono">{row.fc_level}</td>
                      <td className="p-3 text-slate-300 font-mono">{row.current_power}</td>
                      <td className="p-3 text-slate-300 font-mono">{row.shield_soldier}</td>
                      <td className="p-3 text-slate-300 font-mono">{row.spear_soldier}</td>
                      <td className="p-3 text-slate-300 font-mono">{row.bow_soldier}</td>
                      
                      <td className="p-3">
                        <select
                          value={row.entry_alliance}
                          onChange={(e) => handleChangeField(index, 'entry_alliance', e.target.value)}
                          className="bg-[#0b0f19] border border-cyan-700/60 rounded px-2 py-1 text-xs text-cyan-200 font-bold w-full"
                        >
                          <option value="未選択">未選択</option>
                          {allianceOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3 text-center">
                        {row.is_discord ? <span className="text-emerald-400 font-bold text-sm">〇</span> : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="p-3 text-slate-300">{renderParticipationLabel(row.participation_type)}</td>
                      <td className="p-3 text-slate-400 text-[11px]">{row.time_slot_memo || '-'}</td>
                      <td className="p-3 text-slate-300">{renderVcLabel(row.vc_status)}</td>
                      <td className="p-3 text-slate-400 text-[11px]">{row.vc_memo || '-'}</td>

                      {showHistory && eventsList.map((ev) => {
                        const statusVal = participationsMap[row.game_id] || '未設定';
                        return (
                          <td key={ev.id} className="p-3 text-center border-l border-slate-800">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                              {statusVal}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}