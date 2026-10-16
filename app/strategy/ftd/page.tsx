'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function FtdStrategyPage() {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [members, setMembers] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [allianceMaster, setAllianceMaster] = useState<any[]>([]);
  const [selectedAlliances, setSelectedAlliances] = useState<string[]>([]);
  const [memberTeams, setMemberTeams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [savingEntry, setSavingEntry] = useState<boolean>(false);

  // 1. survey_masterからsurvey_typeがfrost_dragonのアンケート一覧を取得
  useEffect(() => {
    async function fetchMaster() {
      try {
        const { data, error } = await supabase
          .from('surveys_master')
          .select('id, title, event_date, survey_type')
          .eq('survey_type', 'frost_dragon')
          .order('event_date', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          setSurveys(data);
          setSelectedSurveyId(data[0].id);
        }
      } catch (err) {
        console.error('マスター取得エラー:', err);
      }
    }
    fetchMaster();
  }, []);

  // メンバーおよび同盟マスタデータの取得
  useEffect(() => {
    async function fetchBaseData() {
      try {
        const { data: memData } = await supabase
          .from('members')
          .select('*');
        if (memData) setMembers(memData);

        const { data: alliData } = await supabase
          .from('alliance_list')
          .select('*')
          .order('display_order', { ascending: true });
        if (alliData) setAllianceMaster(alliData);
      } catch (err) {
        console.error('基本データ取得エラー:', err);
      }
    }
    fetchBaseData();
  }, []);

  // 選択された surveyId に応じた回答データ、エントリー同盟、チーム割当データの取得
  useEffect(() => {
    if (!selectedSurveyId) {
      setLoading(false);
      return;
    }

    async function fetchSurveyData() {
      setLoading(true);
      try {
        const { data: respData, error: respError } = await supabase
          .from('survey_responses_ftd')
          .select('*')
          .eq('survey_id', selectedSurveyId);

        if (respError) throw respError;
        setResponses(respData || []);

        const { data: entryData, error: entryError } = await supabase
          .from('entry_ftd_alliance')
          .select('*')
          .eq('ftd_surver', selectedSurveyId);

        if (entryError) throw entryError;
        const currentAlliances = (entryData || []).map((e: any) => e.alliance);
        setSelectedAlliances(currentAlliances);

        // メンバーチーム割当データの取得
        const { data: teamData, error: teamError } = await supabase
          .from('ftd_member_teams')
          .select('*')
          .eq('survey_id', selectedSurveyId);

        if (teamError) throw teamError;
        const teamMap: Record<string, string> = {};
        (teamData || []).forEach((t: any) => {
          teamMap[t.game_id] = t.team_alliance;
        });
        setMemberTeams(teamMap);

      } catch (err) {
        console.error('サーベイデータ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSurveyData();
  }, [selectedSurveyId]);

  // エントリー同盟のチェックボックス変更ハンドラ
  const handleAllianceCheckboxChange = (allianceName: string) => {
    setSelectedAlliances((prev) => {
      if (prev.includes(allianceName)) {
        return prev.filter((a) => a !== allianceName);
      } else {
        return [...prev, allianceName];
      }
    });
  };

  // エントリー同盟の保存処理
  const handleSaveEntryAlliances = async () => {
    if (!selectedSurveyId) return;
    setSavingEntry(true);
    try {
      const { error: deleteError } = await supabase
        .from('entry_ftd_alliance')
        .delete()
        .eq('ftd_surver', selectedSurveyId);

      if (deleteError) throw deleteError;

      if (selectedAlliances.length > 0) {
        const insertPayload = selectedAlliances.map((alli) => ({
          alliance: alli,
          ftd_surver: selectedSurveyId,
        }));

        const { error: insertError } = await supabase
          .from('entry_ftd_alliance')
          .insert(insertPayload);

        if (insertError) throw insertError;
      }

      alert('エントリー同盟を保存しました！');
    } catch (err: any) {
      console.error('エントリー同盟保存エラー:', err);
      alert(`保存に失敗しました: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setSavingEntry(false);
    }
  };

  // チーム選択変更時に自動でデータベースへ保存する処理
  const handleTeamChange = async (gameId: string, teamValue: string) => {
    setMemberTeams((prev) => ({
      ...prev,
      [gameId]: teamValue,
    }));

    if (!selectedSurveyId) return;

    try {
      if (!teamValue) {
        await supabase
          .from('ftd_member_teams')
          .delete()
          .eq('survey_id', selectedSurveyId)
          .eq('game_id', gameId);
      } else {
        const { data: existing, error: selErr } = await supabase
          .from('ftd_member_teams')
          .select('id')
          .eq('survey_id', selectedSurveyId)
          .eq('game_id', gameId)
          .maybeSingle();

        if (selErr) throw selErr;

        if (existing) {
          await supabase
            .from('ftd_member_teams')
            .update({ team_alliance: teamValue })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('ftd_member_teams')
            .insert({
              survey_id: selectedSurveyId,
              game_id: gameId,
              team_alliance: teamValue,
            });
        }
      }
    } catch (err: any) {
      console.error('チーム保存エラー詳細:', err?.message || err);
    }
  };

  // ヘッダー用：参加人数集計
  const participationCounts = useMemo(() => {
    const counts = { fullMove: 0, fullFight: 0, midway: 0 };
    responses.forEach((r: any) => {
      const type = String(r.participation_type);
      if (type === '1') counts.fullMove++;
      else if (type === '2') counts.fullFight++;
      else if (type === '3') counts.midway++;
    });
    return counts;
  }, [responses]);

  // アライアンスの表示順位マップを作成
  const allianceOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    allianceMaster.forEach((a: any) => {
      if (a.alliance) {
        map.set(a.alliance.trim().toUpperCase(), a.display_order ?? 999);
      }
    });
    return map;
  }, [allianceMaster]);

  // 総力文字列を数値に変換
  const parsePowerToNumber = (powerVal?: string | number | null): number => {
    if (powerVal == null) return 0;
    if (typeof powerVal === 'number') return powerVal;
    const str = powerVal.toString().trim().toUpperCase();
    const num = parseFloat(str);
    if (isNaN(num)) return 0;
    if (str.includes('B')) return num * 1_000_000_000;
    if (str.includes('M')) return num * 1_000_000;
    if (str.includes('K')) return num * 1_000;
    return num;
  };

  // 兵士Lvランク判定スコア化
  const getSoldierRankScore = (shield?: string | null, spear?: string | null, bow?: string | null) => {
    const s = shield || '';
    const sp = spear || '';
    const b = bow || '';
    const arr = [s, sp, b];
    const isMatch = (val: string, target: string) => val.includes(target);

    if (arr.every(val => isMatch(val, 'FC10') && isMatch(val, 'T11'))) return 7;
    if (arr.every(val => (isMatch(val, 'FC10') || isMatch(val, 'FC9')) && isMatch(val, 'T11'))) return 6;
    if (arr.every(val => (isMatch(val, 'FC10') || isMatch(val, 'FC9') || isMatch(val, 'FC8')) && isMatch(val, 'T11'))) return 5;
    if (arr.every(val => (isMatch(val, 'FC10') || isMatch(val, 'FC9') || isMatch(val, 'FC8') || isMatch(val, 'FC7')) && isMatch(val, 'T11'))) return 4;
    if (arr.every(val => isMatch(val, 'T11'))) return 3;
    if (arr.some(val => isMatch(val, 'T11'))) return 2;
    return 1;
  };

  // メンバー並び替えロジック
  const sortMemberList = (list: any[]) => {
    return [...list].sort((a, b) => {
      const scoreA = getSoldierRankScore(a.shield_soldier, a.spear_soldier, a.bow_soldier);
      const scoreB = getSoldierRankScore(b.shield_soldier, b.spear_soldier, b.bow_soldier);
      if (scoreA !== scoreB) return scoreB - scoreA;

      const alliA = (a.alliance || '').trim().toUpperCase();
      const alliB = (b.alliance || '').trim().toUpperCase();
      const orderA = allianceOrderMap.get(alliA) ?? 999;
      const orderB = allianceOrderMap.get(alliB) ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      if (alliA !== alliB) return alliA.localeCompare(alliB);

      const powerA = parsePowerToNumber(a.current_power);
      const powerB = parsePowerToNumber(b.current_power);
      return powerB - powerA;
    });
  };

  // 各カテゴリごとのメンバー抽出
  const { fullMembers, midwayMembers, absentMembers, unvotedMembers, allSortedMembers } = useMemo(() => {
    const answeredMap = new Map();
    responses.forEach((r: any) => answeredMap.set(r.game_id, r));

    const full: any[] = [];
    const midway: any[] = [];
    const absent: any[] = [];
    const unvoted: any[] = [];

    members.forEach((m: any) => {
      if (m.status && m.status.toLowerCase() === 'left') return;

      const resp = answeredMap.get(m.game_id);
      const merged = {
        ...m,
        response_data: resp,
        snapshot_fc_level: resp?.snapshot_fc_level || m.fc_level,
        snapshot_power: resp?.snapshot_power || m.current_power,
        snapshot_shield_soldier: resp?.snapshot_shield_soldier || m.shield_soldier,
        snapshot_spear_soldier: resp?.snapshot_spear_soldier || m.spear_soldier,
        snapshot_bow_soldier: resp?.snapshot_bow_soldier || m.bow_soldier,
        // 英雄データのスナップショット（回答データがあればそちらを優先、なければメンバーマスタ）
        snapshot_hero_fred: resp?.snapshot_hero_fred ?? m.hero_fred,
        snapshot_hero_hendrik: resp?.snapshot_hero_hendrik ?? m.hero_hendrik,
        snapshot_hero_gatto: resp?.snapshot_hero_gatto ?? m.hero_gatto,
        snapshot_hero_gordon: resp?.snapshot_hero_gordon ?? m.hero_gordon,
        snapshot_hero_muming: resp?.snapshot_hero_muming ?? m.hero_muming,
        snapshot_hero_renee: resp?.snapshot_hero_renee ?? m.hero_renee,
        snapshot_hero_norah: resp?.snapshot_hero_norah ?? m.hero_norah,
        snapshot_hero_mia: resp?.snapshot_hero_mia ?? m.hero_mia,
        snapshot_hero_phily: resp?.snapshot_hero_phily ?? m.hero_phily,
      };

      if (resp) {
        const type = String(resp.participation_type);
        if (type === '1' || type === '2') {
          full.push(merged);
        } else if (type === '3') {
          midway.push(merged);
        } else if (type === '4') {
          absent.push(merged);
        }
      } else {
        unvoted.push(merged);
      }
    });

    const sortedFull = sortMemberList(full);
    const sortedMidway = sortMemberList(midway);
    const sortedAbsent = sortMemberList(absent);
    const sortedUnvoted = sortMemberList(unvoted);

    const combinedAll = [...sortedFull, ...sortedMidway, ...sortedAbsent, ...sortedUnvoted];

    return {
      fullMembers: sortedFull,
      midwayMembers: sortedMidway,
      absentMembers: sortedAbsent,
      unvotedMembers: sortedUnvoted,
      allSortedMembers: combinedAll,
    };
  }, [members, responses, allianceOrderMap]);

  // 各チームごとの人数・内訳集計
  const teamStats = useMemo(() => {
    const stats: Record<string, { total: number; full: number; midway: number }> = {};
    selectedAlliances.forEach((alli) => {
      stats[alli] = { total: 0, full: 0, midway: 0 };
    });

    allSortedMembers.forEach((m: any) => {
      const assignedTeam = memberTeams[m.game_id];
      if (assignedTeam && stats[assignedTeam]) {
        stats[assignedTeam].total++;
        const pType = String(m.response_data?.participation_type || '');
        if (pType === '1' || pType === '2') {
          stats[assignedTeam].full++;
        } else if (pType === '3') {
          stats[assignedTeam].midway++;
        }
      }
    });

    return stats;
  }, [selectedAlliances, allSortedMembers, memberTeams]);

  // CSVエクスポート処理（ご指定の順序に準拠）
  const handleExportCSV = () => {
    if (allSortedMembers.length === 0) {
      alert('エクスポートするデータがありません');
      return;
    }

    const headers = [
      'リーダー',
      '同盟',
      'アカウント名',
      '総力',
      'FC',
      '盾兵',
      '槍兵',
      '弓兵',
      '参加予定時間',
      '時間備考',
      'VC',
      'VC備考',
      'Discord',
      'エントリー',
      'フレッド',
      'ヘンドリック',
      'ガト',
      'ゴードン',
      '無名',
      'レネ',
      'ノラ',
      'ミア',
      'フレンダー'
    ];

    const csvRows = [headers.join(',')];

    allSortedMembers.forEach((m: any) => {
      const resp = m.response_data || {};

      let partTypeStr = '';
      const pType = String(resp.participation_type || '');
      if (pType === '1') partTypeStr = '① フル(移転込)';
      else if (pType === '2') partTypeStr = '② フル(戦闘のみ)';
      else if (pType === '3') partTypeStr = '③ 途中参加';
      else if (pType === '4') partTypeStr = '④ 不参加';
      else partTypeStr = '未回答';

      let vcStr = '';
      const vStat = String(resp.vc_status || '');
      if (vStat === '1') vcStr = '① フル';
      else if (vStat === '2') vcStr = '② 途中';
      else if (vStat === '3' || !resp.vc_status) vcStr = '③ 不参加';

      const discordStr = String(m.is_in_2275).toLowerCase() === 'true' ? '⚪︎' : '×';
      const selectedTeam = memberTeams[m.game_id] || '';

      const rowData = [
        m.leader || '',
        m.alliance || '',
        m.name || '',
        m.snapshot_power || '',
        m.snapshot_fc_level || '',
        m.snapshot_shield_soldier || '',
        m.snapshot_spear_soldier || '',
        m.snapshot_bow_soldier || '',
        partTypeStr,
        resp.time_slot_memo || '',
        vcStr,
        resp.vc_memo || '',
        discordStr,
        selectedTeam,
        m.snapshot_hero_fred ?? '',
        m.snapshot_hero_hendrik ?? '',
        m.snapshot_hero_gatto ?? '',
        m.snapshot_hero_gordon ?? '',
        m.snapshot_hero_muming ?? '',
        m.snapshot_hero_renee ?? '',
        m.snapshot_hero_norah ?? '',
        m.snapshot_hero_mia ?? '',
        m.snapshot_hero_phily ?? ''
      ];

      const escapedLine = rowData.map((val) => {
        const strVal = String(val ?? '');
        const escaped = strVal.replace(/"/g, '""');
        return `"${escaped}"`;
      });

      csvRows.push(escapedLine.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const currentSurvey = surveys.find((s) => s.id === selectedSurveyId);
    const dateStr = currentSurvey?.event_date || 'ftd';
    link.setAttribute('download', `ftd_strategy_result_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ヘルパー：VC参加のラベル変換
  const getVcLabel = (vcStatus: any) => {
    const s = String(vcStatus);
    if (s === '1') return '① フル';
    if (s === '2') return '② 途中';
    return '③ 不参加';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1500px] mx-auto p-6 w-full space-y-6 flex flex-col">
        {/* ヘッダーエリア */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded text-xs font-semibold">
                  霜竜の覇者 (FTD) アンケート結果
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-400">イベント日程選択:</span>
                <select
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                >
                  {surveys.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.event_date ? s.event_date : s.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 参加人数表示 ＆ エクスポートボタン */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-[#0b0f19] border border-slate-800 rounded-xl px-4 py-2 text-center">
                <span className="text-[10px] text-slate-400 block">① フル参加(移転込)</span>
                <span className="text-base font-bold text-emerald-400">{participationCounts.fullMove} 名</span>
              </div>
              <div className="bg-[#0b0f19] border border-slate-800 rounded-xl px-4 py-2 text-center">
                <span className="text-[10px] text-slate-400 block">② フル参加(戦闘のみ)</span>
                <span className="text-base font-bold text-teal-400">{participationCounts.fullFight} 名</span>
              </div>
              <div className="bg-[#0b0f19] border border-slate-800 rounded-xl px-4 py-2 text-center">
                <span className="text-[10px] text-slate-400 block">③ 途中参加</span>
                <span className="text-base font-bold text-amber-400">{participationCounts.midway} 名</span>
              </div>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-medium transition shadow flex items-center gap-1.5 cursor-pointer ml-2"
              >
                📥 CSV出力
              </button>
              <Link
                href="/strategy"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                ← 戦略ハブに戻る
              </Link>
            </div>
          </div>

          {/* エントリー同盟登録セクション */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300">エントリー同盟登録 (display_order順)</span>
              <button
                onClick={handleSaveEntryAlliances}
                disabled={savingEntry}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 text-white rounded-lg text-xs font-semibold transition shadow"
              >
                {savingEntry ? '保存中...' : '💾 エントリー同盟を保存'}
              </button>
            </div>
            <div className="flex items-center gap-3 flex-wrap bg-[#0b0f19] p-3 rounded-xl border border-slate-800">
              {allianceMaster.map((a: any) => {
                const isChecked = selectedAlliances.includes(a.alliance);
                return (
                  <label key={`alli-chk-${a.id}`} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleAllianceCheckboxChange(a.alliance)}
                      className="rounded bg-[#151c2c] border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    {a.alliance}
                  </label>
                );
              })}
            </div>
          </div>

          {/* チームごとの割り当て人数・内訳表示エリア */}
          {selectedAlliances.length > 0 && (
            <div className="pt-3 border-t border-slate-800/60 flex items-center gap-3 flex-wrap">
              <span className="text-[11px] text-slate-400 font-semibold">チーム割当状況:</span>
              {selectedAlliances.map((alli) => {
                const stat = teamStats[alli] || { total: 0, full: 0, midway: 0 };
                return (
                  <div key={`stat-${alli}`} className="bg-[#0b0f19] border border-slate-800 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2">
                    <span className="font-bold text-cyan-400">{alli}</span>
                    <span className="text-white font-semibold">{stat.total}名</span>
                    <span className="text-[10px] text-slate-400">
                      (フル:{stat.full} / 途中:{stat.midway})
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* テーブル表示セクション */}
        <div className="space-y-8">
          
          {/* ③ フル参加 (participation_type: 1, 2) */}
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-emerald-400">
              フル参加 ({fullMembers.length}名)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-[#0b0f19]">
                    <th className="p-3 font-semibold">アカウント名</th>
                    <th className="p-3 font-semibold">Game ID</th>
                    <th className="p-3 font-semibold">同盟</th>
                    <th className="p-3 font-semibold">FC</th>
                    <th className="p-3 font-semibold">総力</th>
                    <th className="p-3 font-semibold">盾</th>
                    <th className="p-3 font-semibold">槍</th>
                    <th className="p-3 font-semibold">弓</th>
                    <th className="p-3 font-semibold">参加時間</th>
                    <th className="p-3 font-semibold">VC参加</th>
                    <th className="p-3 font-semibold">VC備考</th>
                    <th className="p-3 font-semibold">Discord</th>
                    <th className="p-3 font-semibold">チーム</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fullMembers.length === 0 ? (
                    <tr><td colSpan={13} className="text-center py-6 text-slate-500">該当メンバーなし</td></tr>
                  ) : (
                    fullMembers.map((m, idx) => (
                      <tr key={`full-${m.game_id || idx}`} className="hover:bg-slate-900/40 transition">
                        <td className="p-3 font-bold text-white">{m.name}</td>
                        <td className="p-3 font-mono text-slate-400">{m.game_id}</td>
                        <td className="p-3">{m.alliance || '-'}</td>
                        <td className="p-3">{m.snapshot_fc_level || '-'}</td>
                        <td className="p-3">{m.snapshot_power || '-'}</td>
                        <td className="p-3">{m.snapshot_shield_soldier || '-'}</td>
                        <td className="p-3">{m.snapshot_spear_soldier || '-'}</td>
                        <td className="p-3">{m.snapshot_bow_soldier || '-'}</td>
                        <td className="p-3 text-cyan-300">
                          {String(m.response_data?.participation_type) === '1' ? '① フル(移転込み)' : '② フル(戦闘時間のみ)'}
                        </td>
                        <td className="p-3">{getVcLabel(m.response_data?.vc_status)}</td>
                        <td className="p-3 text-slate-300">{m.response_data?.vc_memo || '-'}</td>
                        <td className="p-3 text-center">{String(m.is_in_2275).toLowerCase() === 'true' ? '⚪︎' : '×'}</td>
                        <td className="p-3">
                          <select
                            value={memberTeams[m.game_id] || ''}
                            onChange={(e) => handleTeamChange(m.game_id, e.target.value)}
                            className="bg-[#0b0f19] border border-slate-700 text-slate-300 rounded px-2 py-1 text-[11px]"
                          >
                            <option value="">未設定</option>
                            {selectedAlliances.map((alli) => (
                              <option key={`team-full-${alli}`} value={alli}>{alli}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ④ 途中参加 (participation_type: 3) */}
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-amber-400">
              途中参加 ({midwayMembers.length}名)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-[#0b0f19]">
                    <th className="p-3 font-semibold">アカウント名</th>
                    <th className="p-3 font-semibold">Game ID</th>
                    <th className="p-3 font-semibold">同盟</th>
                    <th className="p-3 font-semibold">FC</th>
                    <th className="p-3 font-semibold">総力</th>
                    <th className="p-3 font-semibold">盾</th>
                    <th className="p-3 font-semibold">槍</th>
                    <th className="p-3 font-semibold">弓</th>
                    <th className="p-3 font-semibold text-center">20時台</th>
                    <th className="p-3 font-semibold text-center">21時台</th>
                    <th className="p-3 font-semibold text-center">22時台</th>
                    <th className="p-3 font-semibold text-center">23時台</th>
                    <th className="p-3 font-semibold text-center">24時台</th>
                    <th className="p-3 font-semibold text-center">25時台</th>
                    <th className="p-3 font-semibold">時間備考</th>
                    <th className="p-3 font-semibold">VC参加</th>
                    <th className="p-3 font-semibold">VC備考</th>
                    <th className="p-3 font-semibold">Discord</th>
                    <th className="p-3 font-semibold">チーム</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {midwayMembers.length === 0 ? (
                    <tr><td colSpan={19} className="text-center py-6 text-slate-500">該当メンバーなし</td></tr>
                  ) : (
                    midwayMembers.map((m, idx) => {
                      const resp = m.response_data || {};
                      return (
                        <tr key={`midway-${m.game_id || idx}`} className="hover:bg-slate-900/40 transition">
                          <td className="p-3 font-bold text-white">{m.name}</td>
                          <td className="p-3 font-mono text-slate-400">{m.game_id}</td>
                          <td className="p-3">{m.alliance || '-'}</td>
                          <td className="p-3">{m.snapshot_fc_level || '-'}</td>
                          <td className="p-3">{m.snapshot_power || '-'}</td>
                          <td className="p-3">{m.snapshot_shield_soldier || '-'}</td>
                          <td className="p-3">{m.snapshot_spear_soldier || '-'}</td>
                          <td className="p-3">{m.snapshot_bow_soldier || '-'}</td>
                          <td className="p-3 text-center"><input type="checkbox" disabled checked={!!resp.slot_20} className="rounded bg-[#0b0f19] border-slate-700 text-cyan-500" /></td>
                          <td className="p-3 text-center"><input type="checkbox" disabled checked={!!resp.slot_21} className="rounded bg-[#0b0f19] border-slate-700 text-cyan-500" /></td>
                          <td className="p-3 text-center"><input type="checkbox" disabled checked={!!resp.slot_22} className="rounded bg-[#0b0f19] border-slate-700 text-cyan-500" /></td>
                          <td className="p-3 text-center"><input type="checkbox" disabled checked={!!resp.slot_23} className="rounded bg-[#0b0f19] border-slate-700 text-cyan-500" /></td>
                          <td className="p-3 text-center"><input type="checkbox" disabled checked={!!resp.slot_24} className="rounded bg-[#0b0f19] border-slate-700 text-cyan-500" /></td>
                          <td className="p-3 text-center"><input type="checkbox" disabled checked={!!resp.slot_25} className="rounded bg-[#0b0f19] border-slate-700 text-cyan-500" /></td>
                          <td className="p-3 text-slate-300">{resp.time_slot_memo || '-'}</td>
                          <td className="p-3">{getVcLabel(resp.vc_status)}</td>
                          <td className="p-3 text-slate-300">{resp.vc_memo || '-'}</td>
                          <td className="p-3 text-center">{String(m.is_in_2275).toLowerCase() === 'true' ? '⚪︎' : '×'}</td>
                          <td className="p-3">
                            <select
                              value={memberTeams[m.game_id] || ''}
                              onChange={(e) => handleTeamChange(m.game_id, e.target.value)}
                              className="bg-[#0b0f19] border border-slate-700 text-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="">未設定</option>
                              {selectedAlliances.map((alli) => (
                                <option key={`team-midway-${alli}`} value={alli}>{alli}</option>
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

          {/* ⑤ 不参加 (participation_type: 4) */}
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-slate-400">
              不参加 ({absentMembers.length}名)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-[#0b0f19]">
                    <th className="p-3 font-semibold">アカウント名</th>
                    <th className="p-3 font-semibold">Game ID</th>
                    <th className="p-3 font-semibold">同盟</th>
                    <th className="p-3 font-semibold">FC</th>
                    <th className="p-3 font-semibold">総力</th>
                    <th className="p-3 font-semibold">盾</th>
                    <th className="p-3 font-semibold">槍</th>
                    <th className="p-3 font-semibold">弓</th>
                    <th className="p-3 font-semibold">Discord</th>
                    <th className="p-3 font-semibold">チーム</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {absentMembers.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-6 text-slate-500">該当メンバーなし</td></tr>
                  ) : (
                    absentMembers.map((m, idx) => (
                      <tr key={`absent-${m.game_id || idx}`} className="hover:bg-slate-900/40 transition">
                        <td className="p-3 font-bold text-white">{m.name}</td>
                        <td className="p-3 font-mono text-slate-400">{m.game_id}</td>
                        <td className="p-3">{m.alliance || '-'}</td>
                        <td className="p-3">{m.snapshot_fc_level || '-'}</td>
                        <td className="p-3">{m.snapshot_power || '-'}</td>
                        <td className="p-3">{m.snapshot_shield_soldier || '-'}</td>
                        <td className="p-3">{m.snapshot_spear_soldier || '-'}</td>
                        <td className="p-3">{m.snapshot_bow_soldier || '-'}</td>
                        <td className="p-3 text-center">{String(m.is_in_2275).toLowerCase() === 'true' ? '⚪︎' : '×'}</td>
                        <td className="p-3">
                          <select
                            value={memberTeams[m.game_id] || ''}
                            onChange={(e) => handleTeamChange(m.game_id, e.target.value)}
                            className="bg-[#0b0f19] border border-slate-700 text-slate-300 rounded px-2 py-1 text-[11px]"
                          >
                            <option value="">未設定</option>
                            {selectedAlliances.map((alli) => (
                              <option key={`team-absent-${alli}`} value={alli}>{alli}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 未回答 (アンケート未回答かつ status !== 'left') */}
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-rose-400">
              未回答 ({unvotedMembers.length}名)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-[#0b0f19]">
                    <th className="p-3 font-semibold">アカウント名</th>
                    <th className="p-3 font-semibold">Game ID</th>
                    <th className="p-3 font-semibold">同盟</th>
                    <th className="p-3 font-semibold">FC</th>
                    <th className="p-3 font-semibold">総力</th>
                    <th className="p-3 font-semibold">盾</th>
                    <th className="p-3 font-semibold">槍</th>
                    <th className="p-3 font-semibold">弓</th>
                    <th className="p-3 font-semibold">Discord</th>
                    <th className="p-3 font-semibold">チーム</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {unvotedMembers.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-6 text-slate-500">未回答者はいません</td></tr>
                  ) : (
                    unvotedMembers.map((m, idx) => (
                      <tr key={`unvoted-${m.game_id || idx}`} className="hover:bg-slate-900/40 transition">
                        <td className="p-3 font-bold text-white">{m.name}</td>
                        <td className="p-3 font-mono text-slate-400">{m.game_id}</td>
                        <td className="p-3">{m.alliance || '-'}</td>
                        <td className="p-3">{m.fc_level || '-'}</td>
                        <td className="p-3">{m.current_power || '-'}</td>
                        <td className="p-3">{m.shield_soldier || '-'}</td>
                        <td className="p-3">{m.spear_soldier || '-'}</td>
                        <td className="p-3">{m.bow_soldier || '-'}</td>
                        <td className="p-3 text-center">{String(m.is_in_2275).toLowerCase() === 'true' ? '⚪︎' : '×'}</td>
                        <td className="p-3">
                          <select
                            value={memberTeams[m.game_id] || ''}
                            onChange={(e) => handleTeamChange(m.game_id, e.target.value)}
                            className="bg-[#0b0f19] border border-slate-700 text-slate-300 rounded px-2 py-1 text-[11px]"
                          >
                            <option value="">未設定</option>
                            {selectedAlliances.map((alli) => (
                              <option key={`team-unvoted-${alli}`} value={alli}>{alli}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}