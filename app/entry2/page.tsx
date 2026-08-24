'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの初期化（環境変数を使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface EventItem {
  id: string | number;
  title: string;
  event_date: string;
  order_index?: number;
}

interface MemberEntryData {
  id: string; // 表示用のユニークID
  originalId: any; // 紐付け用ID（game_idや主キーなど）
  game_id: string;
  name: string;
  alliance: string;
  fc_level: string;
  current_power: number;
  shield_soldier: number;
  spear_soldier: number;
  bow_soldier: number;
  leader: boolean;
  is_in_2275: boolean;
  
  // vote 関連（この画面で編集可能）
  note: string;
  entry_status: string;
  is_checked: boolean;

  // day1〜day7 の各日ごとの参加ステータス
  day1: string;
  day2: string;
  day3: string;
  day4: string;
  day5: string;
  day6: string;
  day7: string;

  // イベント参加状況（eventIdをキーにしたマップ）
  pastEventsMap?: { [eventId: string]: string };
}

export default function EntryPage() {
  const [showHistoryMode, setShowHistoryMode] = useState(true);
  const [onlyVoted, setOnlyVoted] = useState(false);

  const [membersData, setMembersData] = useState<MemberEntryData[]>([]);
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);

  const [sortField, setSortField] = useState<keyof MemberEntryData | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 複数選択フィルターの状態管理
  const [filters, setFilters] = useState<{ [key in keyof MemberEntryData]?: Set<any> }>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<keyof MemberEntryData | null>(null);

  // 自動保存用のタイマー管理
  const saveTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Supabaseからデータ取得
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const { data: membersRes, error: membersError } = await supabase
          .from('members')
          .select('*')
          .not('game_id', 'is', null);

        if (membersError) throw membersError;

        const { data: voteRes, error: voteError } = await supabase
          .from('vote')
          .select('*');

        if (voteError) {
          console.warn('voteテーブルの取得に失敗したか、まだデータがありません:', voteError.message);
        }

        const { data: eventsRes, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .order('order_index', { ascending: true, nullsFirst: false });

        if (eventsError) {
          console.warn('eventsテーブルの取得に失敗しました:', eventsError.message);
        }

        const { data: partsRes, error: partsError } = await supabase
          .from('event_participations')
          .select('*');

        if (partsError) {
          console.warn('event_participationsテーブルの取得に失敗しました:', partsError.message);
        }

        if (eventsRes) {
          setEventsList(eventsRes);
        }

        const voteMap = new Map();
        if (voteRes) {
          voteRes.forEach((v: any) => {
            const key = v.member_id || v.id;
            if (key !== undefined && key !== null) {
              voteMap.set(String(key), v);
            }
          });
        }

        const participationsMap = new Map<string, { [eventId: string]: string }>();
        if (partsRes) {
          partsRes.forEach((p: any) => {
            const gameIdStr = String(p.member_game_id || '');
            const eventIdStr = String(p.event_id || '');
            const statusValue = p.status || p.participation_status || p.result || '参加';

            if (gameIdStr && eventIdStr) {
              if (!participationsMap.has(gameIdStr)) {
                participationsMap.set(gameIdStr, {});
              }
              const userEvents = participationsMap.get(gameIdStr)!;
              userEvents[eventIdStr] = statusValue;
            }
          });
        }

        if (membersRes) {
          const formatted: MemberEntryData[] = membersRes.map((m: any, index: number) => {
            const linkKey = m.game_id || m.id || m.member_id;
            const vData = voteMap.get(String(linkKey)) || {};
            const userPastEvents = participationsMap.get(String(m.game_id)) || {};

            return {
              id: linkKey !== undefined ? `${linkKey}-${index}` : `fallback-${index}`,
              originalId: linkKey,
              game_id: m.game_id,
              name: m.name || '',
              alliance: m.alliance || '',
              fc_level: m.fc_level || '',
              current_power: m.current_power || 0,
              shield_soldier: m.shield_soldier || 0,
              spear_soldier: m.spear_soldier || 0,
              bow_soldier: m.bow_soldier || 0,
              leader: !!m.leader,
              is_in_2275: !!m.is_in_2275,
              
              note: vData.note || '',
              entry_status: vData.entry_status || '',
              is_checked: vData.is_checked ?? false,

              day1: vData.day1 || '',
              day2: vData.day2 || '',
              day3: vData.day3 || '',
              day4: vData.day4 || '',
              day5: vData.day5 || '',
              day6: vData.day6 || '',
              day7: vData.day7 || '',

              pastEventsMap: userPastEvents,
            };
          });

          setMembersData(formatted);
        }
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // 1行分の保存処理
  const saveRowToSupabase = async (row: MemberEntryData) => {
    if (row.originalId === undefined || row.originalId === null || row.originalId === '') {
      console.error('保存エラー: 紐付け用IDが空です', row);
      setSaveStatus('error');
      return;
    }

    try {
      setSaveStatus('saving');

      const payload = {
        member_id: row.originalId,
        note: row.note,
        entry_status: row.entry_status,
        is_checked: row.is_checked,
        day1: row.day1,
        day2: row.day2,
        day3: row.day3,
        day4: row.day4,
        day5: row.day5,
        day6: row.day6,
        day7: row.day7,
        updated_at: new Date().toISOString(),
      };

      const { data: existingData, error: selectError } = await supabase
        .from('vote')
        .select('member_id')
        .eq('member_id', row.originalId)
        .maybeSingle();

      if (selectError) {
        console.error('Select確認エラー:', selectError.message);
      }

      let error = null;
      if (existingData) {
        const res = await supabase
          .from('vote')
          .update(payload)
          .eq('member_id', row.originalId);
        error = res.error;
      } else {
        const res = await supabase
          .from('vote')
          .insert([payload]);
        error = res.error;
      }

      if (error) throw error;

      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus((current) => (current === 'saved' ? null : current));
      }, 2500);
    } catch (err: any) {
      console.error('保存エラー:', err);
      setSaveStatus('error');
    }
  };

  const handleResetVotes = async () => {
    const confirmed = window.confirm(
      '本当にすべての投票結果をリセットして削除してもよろしいですか？この操作は元に戻せません。'
    );
    if (!confirmed) return;

    try {
      setSaveStatus('saving');

      const updatePromises = membersData.map(async (row) => {
        if (!row.originalId) return;
        const payload = {
          member_id: row.originalId,
          note: '',
          entry_status: '',
          day1: '',
          day2: '',
          day3: '',
          day4: '',
          day5: '',
          day6: '',
          day7: '',
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from('vote')
          .update(payload)
          .eq('member_id', row.originalId);
      });

      await Promise.all(updatePromises);

      setMembersData((prev) =>
        prev.map((row) => ({
          ...row,
          note: '',
          entry_status: '',
          day1: '',
          day2: '',
          day3: '',
          day4: '',
          day5: '',
          day6: '',
          day7: '',
        }))
      );

      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus((current) => (current === 'saved' ? null : current));
      }, 2500);
    } catch (err) {
      console.error('リセットエラー:', err);
      setSaveStatus('error');
    }
  };

  const handleFieldChange = (id: string, field: keyof MemberEntryData, value: any) => {
    setMembersData((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        let updatedRow = { ...row, [field]: value };

        if (saveTimeouts.current[id]) {
          clearTimeout(saveTimeouts.current[id]);
        }
        saveTimeouts.current[id] = setTimeout(() => {
          saveRowToSupabase(updatedRow);
        }, 500);

        return updatedRow;
      })
    );
  };

  const processedData = useMemo(() => {
    let result = membersData.filter(
      (item) => item.game_id !== null && item.game_id !== undefined && String(item.game_id).trim() !== ''
    );

    if (onlyVoted) {
      result = result.filter(
        (item) =>
          (item.entry_status && String(item.entry_status).trim() !== '') ||
          ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'].some(
            (d) => item[d as keyof MemberEntryData] && String(item[d as keyof MemberEntryData]).trim() !== ''
          )
      );
    }

    Object.entries(filters).forEach(([field, selectedValues]) => {
      if (selectedValues && selectedValues.size > 0) {
        result = result.filter((item) => {
          const val = item[field as keyof MemberEntryData];
          return selectedValues.has(val);
        });
      }
    });

    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal === bVal) return 0;
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDirection === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    return result;
  }, [membersData, onlyVoted, filters, sortField, sortDirection]);

  const handleSort = (field: keyof MemberEntryData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getUniqueColumnValues = (field: keyof MemberEntryData) => {
    const valuesSet = new Set<any>();
    membersData.forEach((m) => {
      valuesSet.add(m[field]);
    });
    return Array.from(valuesSet).sort((a, b) => {
      if (typeof a === 'boolean' && typeof b === 'boolean') {
        return (a === b) ? 0 : a ? -1 : 1;
      }
      return String(a).localeCompare(String(b));
    });
  };

  const handleFilterToggle = (field: keyof MemberEntryData, val: any) => {
    setFilters((prev) => {
      const currentSet = new Set(prev[field] || []);
      if (currentSet.has(val)) {
        currentSet.delete(val);
      } else {
        currentSet.add(val);
      }
      return { ...prev, [field]: currentSet };
    });
  };

  const clearColumnFilter = (field: keyof MemberEntryData, e: React.MouseEvent) => {
    e.stopPropagation();
    setFilters((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  // 兵士Lv分類ロジック
  const getSoldierCategory = (shield: number, spear: number, bow: number) => {
    const vals = [shield, spear, bow];

    if (vals.every(v => v === 1011)) return '全種FC10T11';
    if (vals.every(v => v === 1011 || v === 911)) return '全種FC9T11以上';
    if (vals.every(v => v === 1011 || v === 911 || v === 811)) return '全種FC8T11以上';
    if (vals.every(v => v === 1011 || v === 911 || v === 811 || v === 711)) return '全種FC7T11以上';
    if (vals.every(v => v >= 511 && v <= 1011)) return '全種T11以上';
    if (vals.some(v => v >= 511 && v <= 1011)) return 'T11解放済み';
    return 'T11未解放';
  };

  // 試合時間が「ほぼ23時」であることを考慮したポイント換算ロジック（0.0〜1.0）
  const getDayWeight = (status: string) => {
    switch (status) {
      case 'フル参加':
        return 1.0; 
      case '23時のみフル参加':
        return 0.8;
      case '21時のみフル参加':
      case '途中参加・途中離脱':
        return 0.3;
      case '不参加':
        return 0.0;
      case '':
      case '-':
      default:
        return null; // 未回答（-）は集計対象外として扱うため null を返す
    }
  };

  // 左集計表：兵士Lv別・20%刻みの参加率分布集計（未回答を除外して算出）
  const summaryTableLeft = useMemo(() => {
    const categories = [
      '集結主',
      '全種FC10T11',
      '全種FC9T11以上',
      '全種FC8T11以上',
      '全種FC7T11以上',
      '全種T11以上',
      'T11解放済み',
      'T11未解放',
    ];

    const bins = [
      { label: '80〜100%', min: 0.8, max: 1.0001 },
      { label: '60〜80%', min: 0.6, max: 0.8 },
      { label: '40〜60%', min: 0.4, max: 0.6 },
      { label: '20〜40%', min: 0.2, max: 0.4 },
      { label: '0〜20%', min: 0.0, max: 0.2 },
    ];

    const statsData: { 
      [cat: string]: { 
        totalMembers: number; 
        binCounts: { [label: string]: number };
        averageRate: number;     
        dailyAverageScore: number; 
      } 
    } = {};

    categories.forEach((cat) => {
      const counts: { [label: string]: number } = {};
      bins.forEach((b) => { counts[b.label] = 0; });
      statsData[cat] = { totalMembers: 0, binCounts: counts, averageRate: 0, dailyAverageScore: 0 };
    });

    const rawData: { [cat: string]: { memberCount: number; totalRateSum: number; totalScoreSum: number; totalAnsweredDaysSum: number } } = {};
    categories.forEach((cat) => {
      rawData[cat] = { memberCount: 0, totalRateSum: 0, totalScoreSum: 0, totalAnsweredDaysSum: 0 };
    });

    membersData.forEach((m) => {
      if (!m.game_id) return;
      const cat = getSoldierCategory(m.shield_soldier, m.spear_soldier, m.bow_soldier);

      const dayFields = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'] as const;

      const processMember = (targetCat: string) => {
        let memberScoreSum = 0;
        let answeredDaysCount = 0;

        dayFields.forEach((dayKey) => {
          const val = m[dayKey];
          const weight = getDayWeight(val);
          if (weight !== null) {
            memberScoreSum += weight;
            answeredDaysCount++;
          }
        });

        // 有効な回答が1日でもある場合のみ集計対象とする
        if (answeredDaysCount > 0) {
          const rate = memberScoreSum / answeredDaysCount; // 回答があった日数ベースでの参加率

          rawData[targetCat].memberCount++;
          rawData[targetCat].totalRateSum += rate;
          rawData[targetCat].totalScoreSum += memberScoreSum;
          rawData[targetCat].totalAnsweredDaysSum += answeredDaysCount;

          let assigned = false;
          for (const b of bins) {
            if (b.label === '80〜100%') {
              if (rate >= b.min && rate <= b.max) {
                assigned = true;
                break;
              }
            } else {
              if (rate >= b.min && rate < b.max) {
                assigned = true;
                break;
              }
            }
          }
          // ビンへの割り当て（必要に応じてカウント）
          for (const b of bins) {
            let matches = false;
            if (b.label === '80〜100%') {
              matches = rate >= b.min && rate <= b.max;
            } else {
              matches = rate >= b.min && rate < b.max;
            }
            if (matches || (rate === 0 && b.label === '0〜20%')) {
              // 重複防止のため一度だけ追加
              // ※簡潔に判定するためループの外で処理
            }
          }
        }
      };

      // ビンカウントを正確に行うための別ループ用の一時保持または直接計算
      if (rawData[cat]) {
        processMember(cat);
      }
      if (m.leader && rawData['集結主']) {
        processMember('集結主');
      }
    });

    // 正確なビンごとのカウントを再計算するために個別に処理
    categories.forEach((cat) => {
      const counts: { [label: string]: number } = {};
      bins.forEach((b) => { counts[b.label] = 0; });
      let memberCount = 0;
      let totalRateSum = 0;
      let totalScoreSum = 0;
      let totalAnsweredDays = 0;

      membersData.forEach((m) => {
        if (!m.game_id) return;
        const isTargetCat = getSoldierCategory(m.shield_soldier, m.spear_soldier, m.bow_soldier) === cat;
        const isTargetLeader = cat === '集結主' && m.leader;

        if (isTargetCat || isTargetLeader) {
          let memberScoreSum = 0;
          let answeredDaysCount = 0;

          const dayFields = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'] as const;
          dayFields.forEach((dayKey) => {
            const weight = getDayWeight(m[dayKey]);
            if (weight !== null) {
              memberScoreSum += weight;
              answeredDaysCount++;
            }
          });

          if (answeredDaysCount > 0) {
            const rate = memberScoreSum / answeredDaysCount;
            memberCount++;
            totalRateSum += rate;
            totalScoreSum += memberScoreSum;
            totalAnsweredDays += answeredDaysCount;

            let assigned = false;
            for (const b of bins) {
              if (b.label === '80〜100%') {
                if (rate >= b.min && rate <= b.max) {
                  counts[b.label]++;
                  assigned = true;
                  break;
                }
              } else {
                if (rate >= b.min && rate < b.max) {
                  counts[b.label]++;
                  assigned = true;
                  break;
                }
              }
            }
            if (!assigned && rate === 0) {
              counts['0〜20%']++;
            }
          }
        }
      });

      const avgRate = memberCount > 0 ? (totalRateSum / memberCount) * 100 : 0;
      const dailyAvg = totalAnsweredDays > 0 ? totalScoreSum / totalAnsweredDays : 0; // 回答があった日ベースでの1日平均稼働人数

      statsData[cat] = {
        totalMembers: memberCount,
        binCounts: counts,
        averageRate: Number(avgRate.toFixed(1)),
        dailyAverageScore: Number(dailyAvg.toFixed(1)),
      };
    });

    return { categories, bins, statsData };
  }, [membersData]);

  // 右集計表（兵士Lv別 × エントリー状態別 集計表）
  const summaryTableRight = useMemo(() => {
    const categories = [
      '集結主',
      '全種FC10T11',
      '全種FC9T11以上',
      '全種FC8T11以上',
      '全種FC7T11以上',
      '全種T11以上',
      'T11解放済み',
      'T11未解放',
    ];
    const entryCols = [
      '軍1参加',
      '軍1(控え)',
      '軍2参加',
      '軍2(控え)',
    ];

    const matrix: { [cat: string]: { [entry: string]: number } } = {};
    categories.forEach((cat) => {
      matrix[cat] = {};
      entryCols.forEach((e) => {
        matrix[cat][e] = 0;
      });
    });

    membersData.forEach((m) => {
      if (!m.game_id) return;
      const entryVal = m.entry_status;

      if (m.leader) {
        if (entryVal && matrix['集結主'] && matrix['集結主'][entryVal] !== undefined) {
          matrix['集結主'][entryVal]++;
        }
      }

      const cat = getSoldierCategory(m.shield_soldier, m.spear_soldier, m.bow_soldier);
      if (entryVal && matrix[cat] && matrix[cat][entryVal] !== undefined) {
        matrix[cat][entryVal]++;
      }
    });

    return { categories, entryCols, matrix };
  }, [membersData]);

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case '参加':
      case '軍1参加':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60';
      case '軍1(控え)':
      case '軍2参加':
        return 'bg-blue-950/60 text-blue-300 border-blue-700/60';
      case '不参加':
        return 'bg-rose-950/40 text-rose-300 border-rose-800/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const totalColSpan = 14 + 7 + (showHistoryMode ? eventsList.length : 0);

  const renderHeaderCell = (field: keyof MemberEntryData, label: string, stickyClass?: string) => {
    const isFiltered = filters[field] && filters[field]!.size > 0;
    const isOpen = openFilterColumn === field;

    return (
      <th className={`px-4 py-3 border-b border-slate-700 relative select-none ${stickyClass || ''} bg-[#1e293b]`}>
        <div className="flex items-center justify-between gap-1">
          <span 
            onClick={() => handleSort(field)} 
            className="cursor-pointer hover:text-white flex items-center gap-1"
          >
            {label} {sortField === field && (sortDirection === 'asc' ? '▲' : '▼')}
          </span>
          <div className="flex items-center gap-1">
            {isFiltered && (
              <button 
                onClick={(e) => clearColumnFilter(field, e)}
                className="text-[10px] bg-blue-600 text-white px-1 rounded hover:bg-blue-500"
              >
                ✕
              </button>
            )}
            <button
              onClick={() => setOpenFilterColumn(isOpen ? null : field)}
              className={`text-xs p-1 rounded hover:bg-slate-700 ${isFiltered ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
            >
              🔍
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="absolute left-0 top-full mt-1 bg-[#1e293b] border border-slate-700 rounded-lg shadow-2xl p-3 z-50 min-w-[180px] max-h-60 overflow-y-auto text-slate-200 font-normal">
            <div className="text-[11px] font-semibold text-slate-400 mb-2 border-b border-slate-700 pb-1">
              {label} でフィルター
            </div>
            <div className="space-y-1.5">
              {getUniqueColumnValues(field).map((val, idx) => {
                const checked = Boolean(filters[field]?.has(val));
                const displayVal = typeof val === 'boolean' ? (val ? '〇' : '-') : (val !== null && val !== '' ? String(val) : '(未設定)');
                return (
                  <label key={idx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-800 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleFilterToggle(field, val)}
                      className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="truncate">{displayVal}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </th>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100">

      <div className="max-w-[1920px] mx-auto px-6 py-6 space-y-6">
        {/* ヘッダー・操作ボタン */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">兵器リーグ事前アンケートエントリー画面</h1>
            <p className="text-xs text-slate-400 mt-1">
              game_idが登録されているメンバーが自動登録され、プルダウンや選択変更時に自動で保存されます。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {saveStatus === 'saving' && <span className="text-xs text-amber-400 bg-amber-950/50 px-3 py-1.5 rounded-lg">💾 保存中...</span>}
            {saveStatus === 'saved' && <span className="text-xs text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-lg">✨ 保存完了</span>}
            {saveStatus === 'error' && <span className="text-xs text-rose-400 bg-rose-950/50 px-3 py-1.5 rounded-lg">⚠️ 保存失敗</span>}

            <button
              onClick={handleResetVotes}
              className="px-4 py-2 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 rounded-lg text-xs font-semibold transition shadow"
            >
              🗑️ 投票結果リセット
            </button>

            <button
              onClick={() => setShowHistoryMode(!showHistoryMode)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                showHistoryMode ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {showHistoryMode ? '📂 イベント履歴モード: ON' : '📂 イベント履歴モード: OFF'}
            </button>

            <button
              onClick={() => setOnlyVoted(!onlyVoted)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                onlyVoted ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {onlyVoted ? '✓ 回答者のみ表示中' : '全メンバー表示中'}
            </button>
          </div>
        </div>

        {/* ページ上部：2つの集計表エリア */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* 左側の集計表：兵士Lv別・参加率20%刻み分布集計 */}
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              📊 兵士Lv別・参加率分布（20%刻み集計）
            </h2>
            <p className="text-[11px] text-slate-400 mb-3">
              ※未回答（「-」）の日は集計対象外（分母から除外）とし、回答があった日をベースに平均参加率・1日平均稼働人数を算出しています。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-[#1e293b] text-slate-300">
                    <th className="px-3 py-2 border border-slate-700">区分</th>
                    <th className="px-3 py-2 border border-slate-700 text-center">人数</th>
                    {summaryTableLeft.bins.map((b) => (
                      <th key={b.label} className="px-3 py-2 border border-slate-700 text-center">{b.label}</th>
                    ))}
                    <th className="px-3 py-2 border border-slate-700 text-center">平均参加率</th>
                    <th className="px-3 py-2 border border-slate-700 text-center bg-blue-950/40 text-blue-300">1日平均稼働</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {summaryTableLeft.categories.map((cat) => {
                    const rowData = summaryTableLeft.statsData[cat];
                    const isLeader = cat === '集結主';
                    return (
                      <tr key={cat} className={`hover:bg-slate-800/30 ${isLeader ? 'bg-emerald-950/20 font-semibold text-emerald-300' : ''}`}>
                        <td className={`px-3 py-2 border border-slate-800 font-medium ${isLeader ? 'text-emerald-300 bg-emerald-950/40' : 'text-slate-200 bg-[#1e293b]/40'}`}>
                          {cat}
                        </td>
                        <td className="px-3 py-2 border border-slate-800 text-center text-slate-300">
                          {rowData.totalMembers}
                        </td>
                        {summaryTableLeft.bins.map((b) => (
                          <td key={b.label} className="px-3 py-2 border border-slate-800 text-center text-slate-300">
                            {rowData.binCounts[b.label] || 0}人
                          </td>
                        ))}
                        <td className="px-3 py-2 border border-slate-800 text-center text-slate-300 font-semibold">
                          {rowData.averageRate}%
                        </td>
                        <td className="px-3 py-2 border border-slate-800 text-center text-blue-300 bg-blue-950/20 font-bold">
                          約 {rowData.dailyAverageScore} 人
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 右側の集計表：兵士Lv別 × エントリー状態別 集計表 */}
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              📊 エントリー状態別 集計表
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-[#1e293b] text-slate-300">
                    <th className="px-3 py-2 border border-slate-700">区分 / エントリー</th>
                    {summaryTableRight.entryCols.map((col) => (
                      <th key={col} className="px-3 py-2 border border-slate-700 text-center">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {summaryTableRight.categories.map((cat) => (
                    <tr key={cat} className={`hover:bg-slate-800/30 ${cat === '集結主' ? 'bg-emerald-950/20 font-semibold text-emerald-300' : ''}`}>
                      <td className={`px-3 py-2 border border-slate-800 font-medium ${cat === '集結主' ? 'text-emerald-300 bg-emerald-950/40' : 'text-slate-200 bg-[#1e293b]/40'}`}>
                        {cat}
                      </td>
                      {summaryTableRight.entryCols.map((col) => (
                        <td key={col} className="px-3 py-2 border border-slate-800 text-center text-slate-300">
                          {summaryTableRight.matrix[cat][col] || 0}人
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* テーブルコンテナ */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[72vh]">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="bg-[#1e293b] text-slate-300 sticky top-0 z-30 shadow-sm">
                <tr>
                  <th className="sticky left-0 z-40 bg-[#1e293b] px-3 py-3 border-b border-r border-slate-700 text-center w-12">作業</th>
                  <th className="sticky left-[48px] z-40 bg-[#1e293b] px-4 py-3 border-b border-r border-slate-700">名前</th>
                  {renderHeaderCell('alliance', '同盟', 'sticky left-[148px] z-40 border-r')}
                  
                  {renderHeaderCell('fc_level', 'FC')}
                  {renderHeaderCell('current_power', '総力')}
                  {renderHeaderCell('shield_soldier', '盾兵')}
                  {renderHeaderCell('spear_soldier', '槍兵')}
                  {renderHeaderCell('bow_soldier', '弓兵')}
                  {renderHeaderCell('leader', 'リーダー')}
                  {renderHeaderCell('is_in_2275', 'Discord')}
                  
                  {renderHeaderCell('entry_status', 'エントリー')}

                  {/* day1〜day7 の列 */}
                  {renderHeaderCell('day1', 'day1')}
                  {renderHeaderCell('day2', 'day2')}
                  {renderHeaderCell('day3', 'day3')}
                  {renderHeaderCell('day4', 'day4')}
                  {renderHeaderCell('day5', 'day5')}
                  {renderHeaderCell('day6', 'day6')}
                  {renderHeaderCell('day7', 'day7')}

                  <th className="px-4 py-3 border-b border-slate-700 bg-blue-950/30 text-blue-300">備考欄</th>

                  {showHistoryMode && eventsList.map((ev) => (
                    <th key={ev.id} className="px-4 py-3 border-b border-l border-slate-700 bg-amber-950/60 text-amber-300 text-center">
                      <div className="font-bold">{ev.title}</div>
                      {ev.event_date && <div className="text-[10px] text-amber-400/80 font-normal">{ev.event_date}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={totalColSpan} className="text-center py-8 text-slate-500">読み込み中...</td>
                  </tr>
                ) : processedData.length > 0 ? (
                  processedData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition">
                      <td className="sticky left-0 z-20 bg-[#151c2c] px-3 py-2.5 text-center border-r border-slate-800">
                        <input
                          type="checkbox"
                          checked={Boolean(row.is_checked)}
                          onChange={(e) => handleFieldChange(row.id, 'is_checked', e.target.checked)}
                          className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="sticky left-[48px] z-20 bg-[#151c2c] px-4 py-2.5 font-medium text-white border-r border-slate-800">
                        {row.name || '-'}
                      </td>
                      <td className="sticky left-[148px] z-20 bg-[#151c2c] px-4 py-2.5 text-slate-300 border-r border-slate-800">
                        {row.alliance || '-'}
                      </td>

                      <td className="px-4 py-2.5 text-slate-300">{row.fc_level || '-'}</td>
                      <td className="px-4 py-2.5 text-slate-300">{row.current_power?.toLocaleString() || '0'}</td>
                      <td className="px-4 py-2.5 text-slate-300">{row.shield_soldier?.toLocaleString() || '0'}</td>
                      <td className="px-4 py-2.5 text-slate-300">{row.spear_soldier?.toLocaleString() || '0'}</td>
                      <td className="px-4 py-2.5 text-slate-300">{row.bow_soldier?.toLocaleString() || '0'}</td>
                      <td className="px-4 py-2.5 text-center">
                        {row.leader ? <span className="text-emerald-400 font-bold">〇</span> : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.is_in_2275 ? <span className="text-emerald-400 font-bold">〇</span> : <span className="text-slate-600">-</span>}
                      </td>

                      {/* エントリープルダウン */}
                      <td className="px-3 py-2 bg-emerald-950/10">
                        <select
                          value={row.entry_status || ''}
                          onChange={(e) => handleFieldChange(row.id, 'entry_status', e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">未選択</option>
                          <option value="軍1参加">軍1参加</option>
                          <option value="軍1(控え)">軍1(控え)</option>
                          <option value="軍2参加">軍2参加</option>
                          <option value="軍2(控え)">軍2(控え)</option>
                        </select>
                      </td>

                      {/* day1〜day7のプルダウン */}
                      {(['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'] as const).map((dayField) => (
                        <td key={dayField} className="px-2 py-2 bg-blue-950/10">
                          <select
                            value={row[dayField] || ''}
                            onChange={(e) => handleFieldChange(row.id, dayField, e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                          >
                            <option value="">-</option>
                            <option value="フル参加">フル参加</option>
                            <option value="21時のみフル参加">21時のみフル参加</option>
                            <option value="23時のみフル参加">23時のみフル参加</option>
                            <option value="途中参加・途中離脱">途中参加・途中離脱</option>
                            <option value="不参加">不参加</option>
                          </select>
                        </td>
                      ))}

                      <td className="px-3 py-2 bg-blue-950/10">
                        <input
                          type="text"
                          value={row.note || ''}
                          onChange={(e) => handleFieldChange(row.id, 'note', e.target.value)}
                          placeholder="備考を入力..."
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs w-32 focus:outline-none focus:border-blue-500"
                        />
                      </td>

                      {showHistoryMode && eventsList.map((ev) => {
                        const status = row.pastEventsMap?.[String(ev.id)] || '未設定';
                        return (
                          <td key={ev.id} className="px-4 py-2.5 text-center border-l border-slate-800">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${getStatusBadgeStyle(status)}`}>
                              {status}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={totalColSpan} className="text-center py-8 text-slate-500">条件に一致するメンバーがいません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}