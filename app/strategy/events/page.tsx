'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface TimelineRow {
  dateStr: string;
  dateObj: Date;
  serverPhase: string;
  svsStatus: string;
  frostDragon: string;
  snowLeague: string;
  immigration: string;
  isToday: boolean;
}

const PHASE_DEFINITIONS: { name: string; blocks: number }[] = [
  { name: 'Gen1', blocks: 4 },
  { name: 'Gen2', blocks: 1 },
  { name: 'FC3Gen2', blocks: 3 },
  { name: 'FC3Gen3', blocks: 3 },
  { name: 'FC5Gen3', blocks: 2 },
  { name: '領主神話装備', blocks: 1 },
  { name: 'FC5Gen4', blocks: 2 },
  { name: '戦争学園', blocks: 4 },
  { name: 'FC5Gen5', blocks: 3 },
  { name: 'FC8Gen5', blocks: 3 },
  { name: 'FC8Gen6', blocks: 6 },
  { name: 'FC8Gen7', blocks: 3 },
  { name: 'FC10Gen7', blocks: 3 },
  { name: 'FC10Gen8', blocks: 6 },
  { name: 'FC10Gen9', blocks: 6 },
  { name: 'FC10Gen10', blocks: 6 },
  { name: 'FC10Gen11', blocks: 6 },
  { name: 'FC10Gen12', blocks: 6 },
  { name: 'FC10Gen13', blocks: 6 },
  { name: 'FC10Gen14', blocks: 6 },
  { name: 'FC10Gen15', blocks: 6 },
  { name: 'FC10Gen16', blocks: 6 },
  { name: 'FC10Gen17', blocks: 6 },
  { name: 'FC10Gen18', blocks: 6 },
];

// 透け感と落ち着いた上品なトーン（ダーク背景に馴染む薄めの色み）に調整
const getPhaseCellStyle = (phase: string) => {
  switch (phase) {
    case 'Gen1': return 'bg-emerald-950/30 text-emerald-300/90 border-emerald-900/30';
    case 'Gen2': return 'bg-purple-950/30 text-purple-300/90 border-purple-900/30';
    case 'FC3Gen2': return 'bg-pink-950/30 text-pink-300/90 border-pink-900/30';
    case 'FC3Gen3': return 'bg-lime-950/30 text-lime-300/90 border-lime-900/30';
    case 'FC5Gen3': return 'bg-violet-950/30 text-violet-300/90 border-violet-900/30';
    case '領主神話装備': return 'bg-fuchsia-950/30 text-fuchsia-300/90 border-fuchsia-900/30';
    case 'FC5Gen4': return 'bg-green-950/30 text-green-300/90 border-green-900/30';
    case '戦争学園': return 'bg-purple-900/25 text-purple-200/90 border-purple-800/30';
    case 'FC5Gen5': return 'bg-emerald-900/25 text-emerald-200/90 border-emerald-800/30';
    case 'FC8Gen5': return 'bg-pink-900/25 text-pink-200/90 border-pink-800/30';
    case 'FC8Gen6': return 'bg-violet-900/25 text-violet-200/90 border-violet-800/30';
    case 'FC8Gen7': return 'bg-lime-900/25 text-lime-200/90 border-lime-800/30';
    case 'FC10Gen7': return 'bg-fuchsia-900/25 text-fuchsia-200/90 border-fuchsia-800/30';
    case 'FC10Gen8': return 'bg-green-900/25 text-green-200/90 border-green-800/30';
    case 'FC10Gen9': return 'bg-purple-950/35 text-purple-200/90 border-purple-800/30';
    case 'FC10Gen10': return 'bg-emerald-950/35 text-emerald-200/90 border-emerald-800/30';
    case 'FC10Gen11': return 'bg-pink-950/35 text-pink-200/90 border-pink-800/30';
    case 'FC10Gen12': return 'bg-lime-950/35 text-lime-200/90 border-lime-800/30';
    case 'FC10Gen13': return 'bg-violet-950/35 text-violet-200/90 border-violet-800/30';
    case 'FC10Gen14': return 'bg-fuchsia-950/35 text-fuchsia-200/90 border-fuchsia-800/30';
    case 'FC10Gen15': return 'bg-green-900/35 text-green-200/90 border-green-800/30';
    case 'FC10Gen16': return 'bg-purple-900/35 text-purple-200/90 border-purple-800/30';
    case 'FC10Gen17': return 'bg-emerald-900/35 text-emerald-200/90 border-emerald-800/30';
    case 'FC10Gen18': return 'bg-pink-900/35 text-pink-200/90 border-pink-800/30';
    default: return 'bg-slate-900/20 text-slate-400 border-slate-800/30';
  }
};

export default function EventTimeline() {
  const [serverNumber, setServerNumber] = useState<number>(2275);
  const [timelineData, setTimelineData] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const generateTimelineDates = () => {
    const dates: { dateStr: string; dateObj: Date }[] = [];
    const startDate = new Date('2025-10-06');
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 140);
    endDate.setHours(0, 0, 0, 0);

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      
      dates.push({
        dateStr: `${year}/${month}/${day}`,
        dateObj: new Date(currentDate)
      });
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
    return dates;
  };

  const calculatePhaseAtDate = (groupData: any, targetDate: Date) => {
    if (!groupData) return '';

    let effectiveBaselineDate = new Date('2025-09-29');
    effectiveBaselineDate.setHours(0, 0, 0, 0);

    let basePhaseName = groupData.current_phase_name;
    let basePhaseIndex = Number(groupData.phase_index) || 1;

    if (groupData.gen1) {
      const gen1Date = new Date(groupData.gen1);
      gen1Date.setHours(0, 0, 0, 0);
      
      if (targetDate < gen1Date) {
        return '';
      }
      effectiveBaselineDate = gen1Date;
      basePhaseName = 'Gen1';
      basePhaseIndex = 1;
    }

    const diffTime = targetDate.getTime() - effectiveBaselineDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffTwoWeekSteps = Math.floor(diffDays / 14);

    const baseDefIndex = PHASE_DEFINITIONS.findIndex(p => p.name === basePhaseName);
    if (baseDefIndex === -1) return basePhaseName || '';

    let totalBaselineBlocks = 0;
    for (let i = 0; i < baseDefIndex; i++) {
      totalBaselineBlocks += PHASE_DEFINITIONS[i].blocks;
    }
    totalBaselineBlocks += (basePhaseIndex - 1);

    const targetTotalBlocks = totalBaselineBlocks + diffTwoWeekSteps;
    if (targetTotalBlocks < 0) return '';

    let accumulated = 0;
    for (let i = 0; i < PHASE_DEFINITIONS.length; i++) {
      const phase = PHASE_DEFINITIONS[i];
      if (targetTotalBlocks < accumulated + phase.blocks) {
        return phase.name;
      }
      accumulated += phase.blocks;
    }

    return 'FC10Gen18以降';
  };

  const fetchAndBuildTimeline = async () => {
    setLoading(true);
    const rawDates = generateTimelineDates();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const { data: groupData } = await supabase
        .from('server_groups')
        .select('*')
        .lte('min_server', serverNumber)
        .gte('max_server', serverNumber)
        .maybeSingle();

      const { data: immigrations } = await supabase
        .from('immigration_schedules')
        .select('*');

      const { data: allFrostEvents } = await supabase
        .from('frost_dragon_events')
        .select('*');

      const { data: allFrostBlocks } = await supabase
        .from('frost_dragon_blocks')
        .select('*');

      const { data: allSnowSeasons } = await supabase
        .from('snow_league_seasons')
        .select('*');

      const { data: allSnowBlocks } = await supabase
        .from('snow_league_blocks')
        .select('*');

      const rows: TimelineRow[] = rawDates.map(({ dateStr, dateObj }) => {
        const serverPhase = calculatePhaseAtDate(groupData, dateObj);

        const nextWeekDate = new Date(dateObj);
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);

        const isToday = today >= dateObj && today < nextWeekDate;

        const baseSvsDate = new Date('2025-10-11');
        baseSvsDate.setHours(0, 0, 0, 0);
        
        const saturday = new Date(dateObj);
        saturday.setDate(saturday.getDate() + 5);
        const satMonth = String(saturday.getMonth() + 1).padStart(2, '0');
        const satDay = String(saturday.getDate()).padStart(2, '0');
        const satDateStr = `${satMonth}/${satDay}`;

        const diffTime = saturday.getTime() - baseSvsDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let svsStatus = '';
        if (diffDays >= 0 && diffDays % 28 === 0) {
          svsStatus = `SvS (${satDateStr})`;
        }

        let frostDragon = '';
        const matchedFrostEvent = allFrostEvents?.find((ev: any) => {
          if (!ev.battle_date) return false;
          const bDate = new Date(ev.battle_date);
          bDate.setHours(0, 0, 0, 0);
          return bDate >= dateObj && bDate < nextWeekDate;
        });

        if (matchedFrostEvent) {
          const bDate = new Date(matchedFrostEvent.battle_date);
          const bMonth = String(bDate.getMonth() + 1).padStart(2, '0');
          const bDay = String(bDate.getDate()).padStart(2, '0');

          const blockMatch = allFrostBlocks?.find((b: any) => 
            b.event_id === matchedFrostEvent.id &&
            b.min_server <= serverNumber &&
            b.max_server >= serverNumber
          );
          const rangeStr = blockMatch ? `[${blockMatch.min_server}-${blockMatch.max_server}]` : '未開催';
          frostDragon = `戦闘日:${bMonth}/${bDay} ${rangeStr}`.trim();
        } else {
          const activeTermEvent = allFrostEvents?.find((ev: any) => {
            if (!ev.battle_date) return false;
            const bDate = new Date(ev.battle_date);
            const termStart = new Date(bDate);
            termStart.setDate(termStart.getDate() + 1);
            termStart.setHours(0, 0, 0, 0);

            const termEnd = new Date(termStart);
            termEnd.setDate(termEnd.getDate() + 29);
            termEnd.setHours(23, 59, 59, 999);

            return dateObj <= termEnd && nextWeekDate > termStart;
          });

          if (activeTermEvent) {
            const bDate = new Date(activeTermEvent.battle_date);
            const termStart = new Date(bDate);
            termStart.setDate(termStart.getDate() + 1);
            const termEnd = new Date(termStart);
            termEnd.setDate(termEnd.getDate() + 29);

            if (termEnd >= dateObj && termEnd < nextWeekDate) {
              const endM = String(termEnd.getMonth() + 1).padStart(2, '0');
              const endD = String(termEnd.getDate()).padStart(2, '0');
              frostDragon = `任命中(〜${endM}/${endD})`;
            } else {
              frostDragon = `任命中`;
            }
          }
        }

        let snowLeague = '';
        if (allSnowSeasons) {
          for (const s of allSnowSeasons) {
            if (!s.start_date || !s.end_date) continue;
            
            const sDate = new Date(s.start_date);
            sDate.setHours(0, 0, 0, 0);
            const eDate = new Date(s.end_date);
            eDate.setHours(0, 0, 0, 0);

            const entryWeekStart = new Date(sDate);
            entryWeekStart.setDate(entryWeekStart.getDate() - 7);
            entryWeekStart.setHours(0, 0, 0, 0);

            const isEntryWeek = dateObj.getTime() === entryWeekStart.getTime();
            const isStartWeek = sDate >= dateObj && sDate < nextWeekDate;
            const isEndWeek = eDate >= dateObj && eDate < nextWeekDate;

            if (isEntryWeek || isStartWeek || isEndWeek) {
              const blockMatch = allSnowBlocks?.find((b: any) =>
                b.season_id === s.id &&
                b.min_server <= serverNumber &&
                b.max_server >= serverNumber
              );
              const rangeStr = blockMatch ? ` [${blockMatch.min_server}-${blockMatch.max_server}]` : ' [未開催]';

              if (isEntryWeek) {
                snowLeague = `エントリー:10/08〜10/10${rangeStr}`;
                break;
              } else if (isStartWeek) {
                snowLeague = `トーナメント (${s.season_name})`;
                break;
              } else if (isEndWeek) {
                snowLeague = `争覇戦 (${s.season_name})`;
                break;
              }
            }
          }
        }

        const matchedImmig = immigrations?.find((imm: any) => {
          const immDate = new Date(imm.date);
          immDate.setHours(0, 0, 0, 0);
          return immDate >= dateObj && immDate < nextWeekDate;
        });

        let immigration = '';
        if (matchedImmig) {
          const label = matchedImmig.type === 'merger' ? '合併' : '移民';
          const desc = matchedImmig.description ? ` (${matchedImmig.description})` : '';
          immigration = `${label}${desc}`;
        }

        return {
          dateStr,
          dateObj,
          serverPhase,
          svsStatus,
          frostDragon,
          snowLeague,
          immigration,
          isToday
        };
      });

      setTimelineData(rows);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndBuildTimeline();
  }, [serverNumber]);

  const calculatePhaseSpans = (data: TimelineRow[]) => {
    const spans: number[] = new Array(data.length).fill(1);
    let i = 0;
    while (i < data.length) {
      const val = data[i].serverPhase;
      if (!val || val === '') {
        spans[i] = 1;
        i++;
        continue;
      }
      let j = i + 1;
      while (j < data.length && data[j].serverPhase === val) {
        j++;
      }
      const count = j - i;
      spans[i] = count;
      for (let k = i + 1; k < j; k++) {
        spans[k] = 0;
      }
      i = j;
    }
    return spans;
  };

  const calculateFrostSpans = (data: TimelineRow[]) => {
    const spans: number[] = new Array(data.length).fill(1);
    let i = 0;
    while (i < data.length) {
      const val = data[i].frostDragon;
      if (!val || !val.includes('任命中')) {
        spans[i] = 1;
        i++;
        continue;
      }
      let j = i + 1;
      while (j < data.length && data[j].frostDragon === val) {
        j++;
      }
      const count = j - i;
      spans[i] = count;
      for (let k = i + 1; k < j; k++) {
        spans[k] = 0;
      }
      i = j;
    }
    return spans;
  };

  const phaseSpans = calculatePhaseSpans(timelineData);
  const frostDragonSpans = calculateFrostSpans(timelineData);

  return (
    <div className="min-h-screen bg-[#070b14] text-gray-100 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white tracking-wide border-b border-gray-800 pb-3">
          サーバー・イベントスケジュール
        </h1>
        
        <div className="mb-6 bg-[#0f172a] p-3 sm:p-4 rounded-xl border border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-xl">
          <label className="font-medium text-gray-300 text-sm">サーバー番号入力:</label>
          <input
            type="number"
            value={serverNumber}
            onChange={(e) => setServerNumber(Number(e.target.value))}
            className="bg-[#070b14] border border-gray-700 text-white px-3 py-1.5 rounded-lg w-full sm:w-36 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 2275"
          />
          <span className="text-gray-400 text-xs">※入力したサーバーの所属グループと対戦エリアを自動判定します</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
        ) : (
          <div className="overflow-x-auto border border-gray-800/80 rounded-xl shadow-2xl bg-[#0f172a]">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead className="bg-[#0b1329] text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="p-2.5 sm:p-4 border-r border-gray-800/85 font-semibold whitespace-nowrap">Date</th>
                  <th className="p-2.5 sm:p-4 border-r border-gray-800/85 font-semibold whitespace-nowrap">サーバー進行度</th>
                  <th className="p-2.5 sm:p-4 border-r border-gray-800/85 font-semibold whitespace-nowrap">SvS戦闘日</th>
                  <th className="p-2.5 sm:p-4 border-r border-gray-800/85 font-semibold whitespace-nowrap">霜竜の覇者</th>
                  <th className="p-2.5 sm:p-4 border-r border-gray-800/85 font-semibold whitespace-nowrap">雪原兵器リーグ</th>
                  <th className="p-2.5 sm:p-4 font-semibold whitespace-nowrap">王国移民・合併</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {timelineData.map((row, index) => {
                  const phaseSpan = phaseSpans[index];
                  const frostSpan = frostDragonSpans[index];

                  const phaseStyle = getPhaseCellStyle(row.serverPhase);

                  // 各イベントの透け感ある落ち着いたトーンのスタイル
                  let svsStyle = 'text-gray-500/60';
                  if (row.svsStatus) {
                    svsStyle = 'bg-amber-950/25 text-amber-300/90 font-medium border-amber-900/20';
                  }

                  let frostStyle = 'text-gray-500/60';
                  if (row.frostDragon.startsWith('戦闘日')) {
                    frostStyle = 'bg-rose-950/35 text-rose-200/95 font-semibold border-rose-900/30';
                  } else if (row.frostDragon.includes('任命中')) {
                    frostStyle = 'bg-rose-950/20 text-rose-300/80 border-rose-900/20';
                  }

                  let snowStyle = 'text-gray-500/60';
                  if (row.snowLeague.startsWith('エントリー')) {
                    snowStyle = 'bg-slate-900/20 text-slate-400/80 border-slate-800/20';
                  } else if (row.snowLeague.startsWith('トーナメント')) {
                    snowStyle = 'bg-cyan-950/30 text-cyan-300/90 border-cyan-900/30';
                  } else if (row.snowLeague.startsWith('争覇戦')) {
                    snowStyle = 'bg-amber-900/35 text-amber-200 font-bold border-amber-800/30';
                  }

                  let immigrationStyle = 'text-gray-500/60';
                  if (row.immigration.startsWith('移民')) {
                    immigrationStyle = 'bg-emerald-950/30 text-emerald-300/90 border-emerald-900/30';
                  } else if (row.immigration.startsWith('合併')) {
                    immigrationStyle = 'bg-purple-950/30 text-purple-300/90 border-purple-900/30';
                  }

                  return (
                    <tr 
                      key={index} 
                      className={`transition-colors ${
                        row.isToday 
                          ? 'bg-blue-600/20 ring-2 ring-blue-500/80 relative z-10' 
                          : 'hover:bg-blue-600/5'
                      }`}
                    >
                      <td className="p-2.5 sm:p-4 border-r border-gray-800/85 font-medium text-gray-300 whitespace-nowrap">
                        <span className={row.isToday ? 'text-blue-200 font-bold underline decoration-blue-400 underline-offset-4' : ''}>
                          {row.dateStr}
                        </span>
                      </td>
                      
                      {phaseSpan > 0 ? (
                        <td className={`p-2.5 sm:p-4 border-r border-gray-800/85 align-middle whitespace-nowrap border-b border-gray-800/40 ${phaseStyle}`} rowSpan={phaseSpan}>
                          {row.serverPhase}
                        </td>
                      ) : null}

                      <td className={`p-2.5 sm:p-4 border-r border-gray-800/85 whitespace-nowrap border-b border-gray-800/40 ${svsStyle}`}>
                        {row.svsStatus}
                      </td>

                      {frostSpan > 0 ? (
                        <td className={`p-2.5 sm:p-4 border-r border-gray-800/85 align-middle whitespace-nowrap border-b border-gray-800/40 ${frostStyle}`} rowSpan={frostSpan}>
                          {row.frostDragon}
                        </td>
                      ) : null}

                      <td className={`p-2.5 sm:p-4 border-r border-gray-800/85 whitespace-nowrap border-b border-gray-800/40 ${snowStyle}`}>
                        {row.snowLeague}
                      </td>
                      
                      <td className={`p-2.5 sm:p-4 whitespace-nowrap border-b border-gray-800/40 ${immigrationStyle}`}>
                        {row.immigration}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}