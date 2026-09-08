'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type SurveyMaster = {
  id: string;
  survey_type: string;
  title: string;
  deadline: string;
  event_date?: string;
};

type Member = {
  game_id: string;
  name: string;
  alliance: string | null;
  leader: boolean;
  discord_id: string | null;
  current_power?: string | number | null;
  fc_level?: number | string | null;
  shield_soldier?: string | null;
  spear_soldier?: string | null;
  bow_soldier?: string | null;
  status?: string | null;
};

type SvsResponse = {
  game_id: string;
  survey_id: string;
  survey_type?: string;
  participation_type?: number | string;
  slot_20?: boolean;
  slot_21?: boolean;
  slot_22?: boolean;
  slot_23?: boolean;
  slot_24?: boolean;
  slot_25?: boolean;
  time_slot_memo?: string;
  vc_status?: number | string;
  vc_memo?: string;
  snapshot_fc_level?: string;
  snapshot_power?: string;
  snapshot_shield_soldier?: string;
  snapshot_spear_soldier?: string;
  snapshot_bow_soldier?: string;
  [key: string]: any;
};

type ManualInputType = {
  participation_type: string;
  slot_20: boolean;
  slot_21: boolean;
  slot_22: boolean;
  slot_23: boolean;
  slot_24: boolean;
  slot_25: boolean;
  time_slot_memo: string;
  vc_status: string;
  vc_memo: string;
  snapshot_fc_level: string;
  snapshot_power: string;
  snapshot_shield_soldier: string;
  snapshot_spear_soldier: string;
  snapshot_bow_soldier: string;
};

export default function SvsResultPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [responses, setResponses] = useState<SvsResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'result' | 'manual'>('result');

  const [selectedAlliance, setSelectedAlliance] = useState<string>('ALL');
  const [selectedParticipationType, setSelectedParticipationType] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const [manualAllianceFilter, setManualAllianceFilter] = useState<string>('ALL');
  const [manualDiscordFilter, setManualDiscordFilter] = useState<string>('ALL');
  const [manualStatusFilter, setManualStatusFilter] = useState<string>('ALL'); // 追加: 回答済み/未回答フィルタ
  const [manualSearchKeyword, setManualSearchKeyword] = useState<string>('');

  const [editingGameIds, setEditingGameIds] = useState<Record<string, boolean>>({});
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isNotifyingDiscord, setIsNotifyingDiscord] = useState<boolean>(false);

  const [manualInputs, setManualInputs] = useState<Record<string, ManualInputType>>({});
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!surveyId) return;

    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys_master')
        .select('id, survey_type, title, deadline, event_date')
        .eq('id', surveyId)
        .single();
      if (surveyError) throw surveyError;
      setSurvey(surveyData);

      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('game_id, name, alliance, leader, discord_id, current_power, fc_level, shield_soldier, spear_soldier, bow_soldier, status');
      if (memberError) throw memberError;
      if (memberData) setMembers(memberData);

      const { data: responseData, error: responseError } = await supabase
        .from('survey_responses_svs')
        .select('*')
        .eq('survey_id', surveyId);
      if (responseError) throw responseError;
      if (responseData) setResponses(responseData as SvsResponse[]);

    } catch (err) {
      console.error('データ取得エラー詳細:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [surveyId]);

  useEffect(() => {
    const initialInputs: Record<string, ManualInputType> = {};
    members.forEach((m) => {
      if (m.game_id) {
        const existingResp = responses.find((r) => r.game_id === m.game_id);
        
        initialInputs[m.game_id] = {
          participation_type: existingResp ? String(existingResp.participation_type || '') : '',
          slot_20: existingResp ? !!existingResp.slot_20 : false,
          slot_21: existingResp ? !!existingResp.slot_21 : false,
          slot_22: existingResp ? !!existingResp.slot_22 : false,
          slot_23: existingResp ? !!existingResp.slot_23 : false,
          slot_24: existingResp ? !!existingResp.slot_24 : false,
          slot_25: existingResp ? !!existingResp.slot_25 : false,
          time_slot_memo: existingResp?.time_slot_memo ? String(existingResp.time_slot_memo) : '',
          vc_status: existingResp?.vc_status != null ? String(existingResp.vc_status) : '',
          vc_memo: existingResp?.vc_memo ? String(existingResp.vc_memo) : '',
          snapshot_fc_level: existingResp?.snapshot_fc_level ? String(existingResp.snapshot_fc_level) : (m.fc_level ? String(m.fc_level) : 'FC6以下'),
          snapshot_power: existingResp?.snapshot_power ? String(existingResp.snapshot_power) : (m.current_power ? String(m.current_power) : ''),
          snapshot_shield_soldier: existingResp?.snapshot_shield_soldier ? String(existingResp.snapshot_shield_soldier) : (m.shield_soldier ? String(m.shield_soldier) : 'FC6T10以下'),
          snapshot_spear_soldier: existingResp?.snapshot_spear_soldier ? String(existingResp.snapshot_spear_soldier) : (m.spear_soldier ? String(m.spear_soldier) : 'FC6T10以下'),
          snapshot_bow_soldier: existingResp?.snapshot_bow_soldier ? String(existingResp.snapshot_bow_soldier) : (m.bow_soldier ? String(m.bow_soldier) : 'FC6T10以下'),
        };
      }
    });
    setManualInputs(initialInputs);
  }, [members, responses]);

  const hasValidDiscordId = (discordId?: string | null): boolean => {
    if (!discordId) return false;
    const trimmed = discordId.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return false;
    if (trimmed.startsWith('temp_') || trimmed.startsWith('no_discord')) return false;
    return true;
  };

  const getAllianceRank = (allianceName: string | null): number => {
    if (!allianceName) return 999;
    const upper = allianceName.trim().toUpperCase();
    if (upper === 'GOD') return 1;
    if (upper === 'GEN') return 2;
    if (upper === 'WWW') return 3;
    return 100;
  };

  const compareAlliances = (allianceA: string | null, allianceB: string | null): number => {
    const aStr = allianceA ? allianceA.trim() : '';
    const bStr = allianceB ? allianceB.trim() : '';
    const rankA = getAllianceRank(aStr);
    const rankB = getAllianceRank(bStr);
    if (rankA !== rankB) return rankA - rankB;
    return aStr.localeCompare(bStr, 'en', { sensitivity: 'accent', numeric: true });
  };

  const alliances = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.alliance) set.add(m.alliance.trim());
    });
    return Array.from(set).sort((a, b) => compareAlliances(a, b));
  }, [members]);

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

  const parseFcLevel = (fcVal?: string | number | null): number => {
    if (fcVal == null) return 0;
    if (typeof fcVal === 'number') return fcVal;
    const match = fcVal.toString().match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const sortMembers = (a: Member, b: Member) => {
    const allianceCompare = compareAlliances(a.alliance, b.alliance);
    if (allianceCompare !== 0) return allianceCompare;
    const fcA = parseFcLevel(a.fc_level);
    const fcB = parseFcLevel(b.fc_level);
    if (fcA !== fcB) return fcB - fcA;
    const powerA = parsePowerToNumber(a.current_power);
    const powerB = parsePowerToNumber(b.current_power);
    if (powerA !== powerB) return powerB - powerA;
    return (a.name || '').localeCompare(b.name || '', 'ja');
  };

  const answeredGameIds = useMemo(() => new Set(responses.map((r) => r.game_id)), [responses]);

  const { answeredMembers, unvotedMembers } = useMemo(() => {
    const answered: (Member & { response_data?: SvsResponse })[] = [];
    const unvoted: Member[] = [];

    members.forEach((m) => {
      if (m.status && m.status.toLowerCase() === 'left') return;
      const isAnswered = answeredGameIds.has(m.game_id);
      if (isAnswered) {
        const resp = responses.find((r) => r.game_id === m.game_id);
        answered.push({ ...m, response_data: resp });
      } else {
        unvoted.push(m);
      }
    });

    answered.sort(sortMembers);
    unvoted.sort(sortMembers);

    return { answeredMembers: answered, unvotedMembers: unvoted };
  }, [members, answeredGameIds, responses]);

  const typeCounts = useMemo(() => {
    const counts = { '1': 0, '2': 0, '3': 0, '4': 0 };
    answeredMembers.forEach((m) => {
      const type = String(m.response_data?.participation_type || '');
      if (counts[type as keyof typeof counts] !== undefined) {
        counts[type as keyof typeof counts]++;
      }
    });
    return counts;
  }, [answeredMembers]);

  const getParticipationLabel = (type: string | number | undefined) => {
    switch(String(type)) {
      case '1': return '① フル参加(移転込)';
      case '2': return '② フル参加(戦闘のみ)';
      case '3': return '③ 途中参加';
      case '4': return '④ 不参加';
      default: return '未選択';
    }
  };

  const filterList = <T extends { name: string; game_id: string; alliance: string | null; response_data?: SvsResponse }>(
    list: T[],
    allianceFilter: string,
    keywordFilter: string,
    typeFilter?: string
  ) => {
    return list.filter((item) => {
      const matchAlliance = allianceFilter === 'ALL' || item.alliance === allianceFilter;
      
      let matchType = true;
      if (typeFilter && typeFilter !== 'ALL' && 'response_data' in item) {
        matchType = String(item.response_data?.participation_type) === typeFilter;
      }

      // 安全に小文字化して検索（null対策）
      const keyword = (keywordFilter || '').toLowerCase();
      const nameStr = (item.name || '').toLowerCase();
      const idStr = (item.game_id || '').toLowerCase();

      const matchSearch =
        !keyword ||
        nameStr.includes(keyword) ||
        idStr.includes(keyword);

      return matchAlliance && matchType && matchSearch;
    });
  };

  const filteredAnswered = useMemo(() => filterList(answeredMembers, selectedAlliance, searchKeyword, selectedParticipationType), [answeredMembers, selectedAlliance, searchKeyword, selectedParticipationType]);
  const filteredUnvotedTab1 = useMemo(() => filterList(unvotedMembers, selectedAlliance, searchKeyword), [unvotedMembers, selectedAlliance, searchKeyword]);
  
  // 手動登録タブ用のフィルタリング（回答済み/未回答フィルターを追加）
  const filteredManualList = useMemo(() => {
    const allTargetMembers = members.filter((m) => !(m.status && m.status.toLowerCase() === 'left'));
    
    return allTargetMembers.filter((item) => {
      const matchAlliance = manualAllianceFilter === 'ALL' || item.alliance === manualAllianceFilter;
      
      const isValid = hasValidDiscordId(item.discord_id);
      const matchDiscord = 
        manualDiscordFilter === 'ALL' ||
        (manualDiscordFilter === 'HAS_DISCORD' && isValid) ||
        (manualDiscordFilter === 'NO_DISCORD' && !isValid);

      const isAnswered = answeredGameIds.has(item.game_id);
      let matchStatus = true;
      if (manualStatusFilter === 'ANSWERED') {
        matchStatus = isAnswered;
      } else if (manualStatusFilter === 'UNVOTED') {
        matchStatus = !isAnswered;
      }

      // 安全に小文字化して検索（null対策）
      const keyword = (manualSearchKeyword || '').toLowerCase();
      const nameStr = (item.name || '').toLowerCase();
      const idStr = (item.game_id || '').toLowerCase();

      const matchSearch =
        !keyword ||
        nameStr.includes(keyword) ||
        idStr.includes(keyword);

      return matchAlliance && matchDiscord && matchStatus && matchSearch;
    });
  }, [members, manualAllianceFilter, manualDiscordFilter, manualStatusFilter, manualSearchKeyword, answeredGameIds]);

  const handleCopyNames = (type: 'answered' | 'unvoted') => {
    const targetList = type === 'answered' ? filteredAnswered : filteredUnvotedTab1;
    const namesText = targetList.map((m) => m.name).join('\n');
    navigator.clipboard.writeText(namesText).then(() => {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    });
  };

  const getDeadlineStrings = () => {
    if (!survey?.deadline) return { jst: '未定', utc: '未定' };
    try {
      const dateObj = new Date(survey.deadline);
      const jst = dateObj.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false });
      const utc = dateObj.toLocaleString('ja-JP', { timeZone: 'UTC', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false });
      return { jst, utc };
    } catch (e) {
      return { jst: survey.deadline, utc: survey.deadline };
    }
  };

  const getJapaneseNotificationText = () => {
    const { jst, utc } = getDeadlineStrings();
    const answerUrl = `${window.location.origin}/surveys/answer/svs/${surveyId}`;
    return `アンケート「${survey?.title}」がまだ未回答です。回答おねがいします🙇\n回答期日：${jst} (JST) / ${utc} (UTC)\n回答URL：${answerUrl}`;
  };

  const getEnglishNotificationText = () => {
    const { jst, utc } = getDeadlineStrings();
    const answerUrl = `${window.location.origin}/surveys/answer/svs/${surveyId}`;
    return `The survey "${survey?.title}" has not been answered yet. Please submit your response 🙇\nDeadline: ${jst} (JST) / ${utc} (UTC)\nURL: ${answerUrl}`;
  };

  const handleCopyNotification = (lang: 'ja' | 'en') => {
    const text = lang === 'ja' ? getJapaneseNotificationText() : getEnglishNotificationText();
    navigator.clipboard.writeText(text).then(() => {
      alert(`${lang === 'ja' ? '🇯🇵 日本語' : '🇺🇸 英語'}の通知文をコピーしました！`);
    });
  };

  const handleSendDiscordNotifications = async () => {
    const targetsWithDiscord = unvotedMembers.filter((m) => hasValidDiscordId(m.discord_id));
    if (targetsWithDiscord.length === 0) {
      alert('有効なDiscord IDが登録されている未回答者はいません。');
      return;
    }

    if (!confirm(`有効なDiscord IDを持つ未回答者 ${targetsWithDiscord.length}名に対して通知を行いますか？`)) {
      return;
    }

    setIsNotifyingDiscord(true);
    try {
      const res = await fetch('/api/discord/notify-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId,
          surveyTitle: survey?.title,
          deadline: survey?.deadline,
          targets: targetsWithDiscord.map(m => ({ discord_id: m.discord_id, name: m.name })),
          surveyUrl: `${window.location.origin}/surveys/answer/svs/${surveyId}`
        })
      });

      if (!res.ok) throw new Error('通知の送信に失敗しました');
      
      alert('Discord通知の送信リクエストが完了しました！');
    } catch (err) {
      console.error(err);
      alert('Discord APIとの連携部分でエラーが発生しました。');
    } finally {
      setIsNotifyingDiscord(false);
    }
  };

  const handleParticipationTypeChange = (gameId: string, val: string) => {
    let s20 = false, s21 = false, s22 = false, s23 = false, s24 = false, s25 = false;
    if (val === '1') {
      s20 = true; s21 = true; s22 = true; s23 = true; s24 = true; s25 = true;
    } else if (val === '2') {
      s21 = true; s22 = true; s23 = true; s24 = true; s25 = true;
    } else if (val === '3') {
      const current = manualInputs[gameId];
      if (current) {
        s20 = current.slot_20;
        s21 = current.slot_21;
        s22 = current.slot_22;
        s23 = current.slot_23;
        s24 = current.slot_24;
        s25 = current.slot_25;
      }
    }

    setManualInputs((prev) => ({
      ...prev,
      [gameId]: {
        ...(prev[gameId] || {
          participation_type: '',
          slot_20: false,
          slot_21: false,
          slot_22: false,
          slot_23: false,
          slot_24: false,
          slot_25: false,
          time_slot_memo: '',
          vc_status: '',
          vc_memo: '',
          snapshot_fc_level: 'FC6以下',
          snapshot_power: '',
          snapshot_shield_soldier: 'FC6T10以下',
          snapshot_spear_soldier: 'FC6T10以下',
          snapshot_bow_soldier: 'FC6T10以下',
        }),
        participation_type: val,
        slot_20: s20,
        slot_21: s21,
        slot_22: s22,
        slot_23: s23,
        slot_24: s24,
        slot_25: s25,
      },
    }));
  };

  const handleSaveRow = async (gameId: string) => {
    const inputData = manualInputs[gameId];
    if (!inputData) return;

    if (!inputData.participation_type) {
      alert('参加予定時間を選択してください。');
      return;
    }

    setSavingGameId(gameId);
    try {
      const responsePayload = {
        survey_id: surveyId,
        survey_type: 'svs',
        game_id: gameId,
        participation_type: parseInt(inputData.participation_type, 10),
        slot_20: !!inputData.slot_20,
        slot_21: !!inputData.slot_21,
        slot_22: !!inputData.slot_22,
        slot_23: !!inputData.slot_23,
        slot_24: !!inputData.slot_24,
        slot_25: !!inputData.slot_25,
        time_slot_memo: inputData.time_slot_memo || '',
        vc_status: inputData.vc_status ? parseInt(inputData.vc_status, 10) : null,
        vc_memo: inputData.vc_memo || '',
        snapshot_fc_level: inputData.snapshot_fc_level || 'FC6以下',
        snapshot_power: inputData.snapshot_power || '',
        snapshot_shield_soldier: inputData.snapshot_shield_soldier || 'FC6T10以下',
        snapshot_spear_soldier: inputData.snapshot_spear_soldier || 'FC6T10以下',
        snapshot_bow_soldier: inputData.snapshot_bow_soldier || 'FC6T10以下',
      };

      const { error: respError } = await supabase
        .from('survey_responses_svs')
        .upsert(responsePayload, { onConflict: 'survey_id,game_id' });

      if (respError) throw respError;

      const memberUpdatePayload = {
        fc_level: inputData.snapshot_fc_level || 'FC6以下',
        current_power: inputData.snapshot_power || '',
        shield_soldier: inputData.snapshot_shield_soldier || 'FC6T10以下',
        spear_soldier: inputData.snapshot_spear_soldier || 'FC6T10以下',
        bow_soldier: inputData.snapshot_bow_soldier || 'FC6T10以下',
      };

      const { error: memberError } = await supabase
        .from('members')
        .update(memberUpdatePayload)
        .eq('game_id', gameId);

      if (memberError) {
        console.warn('membersテーブルの更新に失敗しました:', memberError);
      }

      const targetMember = members.find((m) => m.game_id === gameId);
      alert(`${targetMember?.name || gameId} さんの回答を保存しました！`);
      
      setEditingGameIds((prev) => ({ ...prev, [gameId]: false }));
      await fetchData();
    } catch (err: any) {
      console.error('保存エラー:', err);
      alert(`保存に失敗しました: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setSavingGameId(null);
    }
  };

  const handleDeleteResponse = async (gameId: string) => {
    const targetMember = members.find((m) => m.game_id === gameId);
    if (!confirm(`${targetMember?.name || gameId} さんの回答データを削除し、未回答の状態に戻しますか？`)) {
      return;
    }

    setDeletingGameId(gameId);
    try {
      const { error } = await supabase
        .from('survey_responses_svs')
        .delete()
        .eq('survey_id', surveyId)
        .eq('game_id', gameId);

      if (error) throw error;

      alert(`${targetMember?.name || gameId} さんの回答を削除しました。`);
      setEditingGameIds((prev) => ({ ...prev, [gameId]: false }));
      await fetchData();
    } catch (err: any) {
      console.error('削除エラー:', err);
      alert(`削除に失敗しました: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setDeletingGameId(null);
    }
  };

  const handleInputChange = (gameId: string, field: keyof ManualInputType, value: any) => {
    setManualInputs((prev) => ({
      ...prev,
      [gameId]: {
        ...(prev[gameId] || {
          participation_type: '',
          slot_20: false,
          slot_21: false,
          slot_22: false,
          slot_23: false,
          slot_24: false,
          slot_25: false,
          time_slot_memo: '',
          vc_status: '',
          vc_memo: '',
          snapshot_fc_level: 'FC6以下',
          snapshot_power: '',
          snapshot_shield_soldier: 'FC6T10以下',
          snapshot_spear_soldier: 'FC6T10以下',
          snapshot_bow_soldier: 'FC6T10以下',
        }),
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">アンケートが見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1400px] mx-auto p-6 w-full space-y-6 flex flex-col">
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded text-xs font-semibold">
                結果確認・回答状況 (SvS参加)
              </span>
            </div>
            <h1 className="text-xl font-bold text-white">{survey.title}</h1>
          </div>
          <Link
            href="/surveys"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
          >
            ← ハブに戻る
          </Link>
        </div>

        <div className="flex border-b border-slate-800 gap-4">
          <button
            onClick={() => setActiveTab('result')}
            className={`pb-3 text-xs font-bold transition border-b-2 px-2 ${
              activeTab === 'result'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 回答結果・状況一覧
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 text-xs font-bold transition border-b-2 px-2 flex items-center gap-1.5 ${
              activeTab === 'manual'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✍️ メンバー回答一括管理・手動登録/編集
            <span className="px-1.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-800/50 rounded text-[10px]">
              未回答 {unvotedMembers.length}名
            </span>
          </button>
        </div>

        {activeTab === 'result' && (
          <div className="space-y-6">
            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 shrink-0">同盟:</span>
                  <select
                    value={selectedAlliance}
                    onChange={(e) => setSelectedAlliance(e.target.value)}
                    className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                  >
                    <option value="ALL">すべて</option>
                    {alliances.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 shrink-0">参加タイプ:</span>
                  <select
                    value={selectedParticipationType}
                    onChange={(e) => setSelectedParticipationType(e.target.value)}
                    className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                  >
                    <option value="ALL">すべて表示</option>
                    <option value="1">① フル(移転時間込)</option>
                    <option value="2">② フル(戦闘時間のみ)</option>
                    <option value="3">③ 途中参加</option>
                    <option value="4">④ 不参加</option>
                  </select>
                </div>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="名前またはゲームIDで検索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500 w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl space-y-1">
                <span className="text-[11px] text-slate-400">総回答者数</span>
                <p className="text-xl font-bold text-cyan-400">{answeredMembers.length} 名</p>
              </div>
              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl space-y-1">
                <span className="text-[11px] text-slate-400">未回答者数</span>
                <p className="text-xl font-bold text-rose-400">{unvotedMembers.length} 名</p>
              </div>
              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl space-y-1">
                <span className="text-[11px] text-slate-400">① フル(移転込)</span>
                <p className="text-xl font-bold text-emerald-400">{typeCounts['1']} 名</p>
              </div>
              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl space-y-1">
                <span className="text-[11px] text-slate-400">② フル(戦闘のみ)</span>
                <p className="text-xl font-bold text-teal-400">{typeCounts['2']} 名</p>
              </div>
              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl space-y-1">
                <span className="text-[11px] text-slate-400">③ 途中参加</span>
                <p className="text-xl font-bold text-amber-400">{typeCounts['3']} 名</p>
              </div>
              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl space-y-1">
                <span className="text-[11px] text-slate-400">④ 不参加</span>
                <p className="text-xl font-bold text-slate-400">{typeCounts['4']} 名</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-cyan-400">
                    ✅ 回答済み ({filteredAnswered.length}件)
                  </h2>
                  <button
                    onClick={() => handleCopyNames('answered')}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                  >
                    {copiedType === 'answered' ? '✨ コピー完了！' : '📋 フィルタ中の名前をコピー'}
                  </button>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredAnswered.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">該当する回答者はいません</p>
                  ) : (
                    filteredAnswered.map((m, index) => (
                      <div key={m.game_id ? `answered-${m.game_id}` : `answered-idx-${index}`} className="bg-[#0b0f19] border border-slate-800 p-3 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-xs">{m.name}</span>
                            {m.alliance && <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">{m.alliance}</span>}
                            {m.leader && <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800/50 rounded text-[10px]">リーダー</span>}
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">ID: {m.game_id}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                          <span className="text-cyan-300 font-medium">
                            {getParticipationLabel(m.response_data?.participation_type)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <h2 className="text-sm font-bold text-rose-400">
                    ⏳ 未回答 ({filteredUnvotedTab1.length}件)
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setActiveTab('manual')}
                      className="px-2.5 py-1 bg-cyan-900/40 hover:bg-cyan-900/70 text-cyan-200 border border-cyan-700/50 rounded text-[10px] font-semibold transition"
                    >
                      ＋ 一覧テーブルで手動登録へ移動
                    </button>
                    <button
                      onClick={() => handleCopyNames('unvoted')}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                    >
                      {copiedType === 'unvoted' ? '✨ コピー完了！' : '📋 名前コピー'}
                    </button>
                  </div>
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-400">一括通知文コピー (JST/UTC併記)</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyNotification('ja')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-[10px] font-medium transition"
                    >
                      🇯🇵 日本語通知文コピー
                    </button>
                    <button
                      onClick={() => handleCopyNotification('en')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 rounded text-[10px] font-medium transition"
                    >
                      🇺🇸 英語通知文コピー
                    </button>
                  </div>
                </div>

                <div className="bg-[#0b0f19] border border-indigo-900/40 p-3 rounded-xl flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-indigo-300 block">Discord通知連動</span>
                    <span className="text-[10px] text-slate-400 block">Discord ID有りの未回答者にサーバー内メンションで通知を送ります</span>
                  </div>
                  <button
                    onClick={handleSendDiscordNotifications}
                    disabled={isNotifyingDiscord}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded-lg text-xs font-medium transition shrink-0"
                  >
                    {isNotifyingDiscord ? '送信中...' : '🤖 Discord通知送信'}
                  </button>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredUnvotedTab1.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">該当する未回答者はいません</p>
                  ) : (
                    filteredUnvotedTab1.map((m, index) => {
                      const isValidDiscord = hasValidDiscordId(m.discord_id);
                      return (
                        <div key={m.game_id ? `unvoted-${m.game_id}` : `unvoted-idx-${index}`} className="bg-[#0b0f19] border border-slate-800 p-3 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-xs">{m.name}</span>
                              {m.alliance && <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">{m.alliance}</span>}
                              {m.leader && <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800/50 rounded text-[10px]">リーダー</span>}
                              {isValidDiscord ? (
                                <span className="px-1.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/50 rounded text-[9px]">
                                  Discord有
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800/50 rounded text-[9px]">
                                  Discord無
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">ID: {m.game_id}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-cyan-400">✍️ メンバー回答一括管理・手動登録/編集</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  未回答者の新規登録はもちろん、すでに回答済み（手動登録含む）のメンバーのデータをここで「編集」または「削除（未回答に戻す）」できます。
                </p>
              </div>
              <span className="text-xs text-slate-300 font-semibold">表示中: {filteredManualList.length} 名</span>
            </div>

            <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 shrink-0">同盟:</span>
                  <select
                    value={manualAllianceFilter}
                    onChange={(e) => setManualAllianceFilter(e.target.value)}
                    className="bg-[#151c2c] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                  >
                    <option value="ALL">すべて表示</option>
                    {alliances.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 shrink-0">Discord:</span>
                  <select
                    value={manualDiscordFilter}
                    onChange={(e) => setManualDiscordFilter(e.target.value)}
                    className="bg-[#151c2c] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                  >
                    <option value="ALL">すべて表示</option>
                    <option value="HAS_DISCORD">登録あり</option>
                    <option value="NO_DISCORD">未登録 (無効含む)</option>
                  </select>
                </div>

                {/* 追加: 回答済み/未回答フィルター */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 shrink-0">回答状態:</span>
                  <select
                    value={manualStatusFilter}
                    onChange={(e) => setManualStatusFilter(e.target.value)}
                    className="bg-[#151c2c] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                  >
                    <option value="ALL">すべて表示</option>
                    <option value="ANSWERED">回答済み</option>
                    <option value="UNVOTED">未回答</option>
                  </select>
                </div>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="ユーザ名またはゲームIDで検索..."
                  value={manualSearchKeyword}
                  onChange={(e) => setManualSearchKeyword(e.target.value)}
                  className="bg-[#151c2c] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500 w-full"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-[#0b0f19]">
                    <th className="p-3 font-semibold w-48">メンバー名 / 同盟 / 状態</th>
                    <th className="p-3 font-semibold w-36">参加予定時間</th>
                    <th className="p-3 font-semibold w-44">参加可能時間(台)</th>
                    <th className="p-3 font-semibold w-36">備考(時間)</th>
                    <th className="p-3 font-semibold w-32">VC参加</th>
                    <th className="p-3 font-semibold w-36">備考(VC)</th>
                    <th className="p-3 font-semibold w-28">溶鉱炉 / FC</th>
                    <th className="p-3 font-semibold w-28">総力</th>
                    <th className="p-3 font-semibold w-36">兵士Lv (盾/槍/弓)</th>
                    <th className="p-3 font-semibold text-center w-36">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredManualList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-500">
                        該当するメンバーはいません
                      </td>
                    </tr>
                  ) : (
                    filteredManualList.map((m, index) => {
                      const rowKey = m.game_id ? `manual-row-${m.game_id}` : `manual-row-idx-${index}`;
                      const isAnswered = answeredGameIds.has(m.game_id);
                      const isEditing = !!editingGameIds[m.game_id];

                      const inputState = manualInputs[m.game_id] || {
                        participation_type: '',
                        slot_20: false,
                        slot_21: false,
                        slot_22: false,
                        slot_23: false,
                        slot_24: false,
                        slot_25: false,
                        time_slot_memo: '',
                        vc_status: '',
                        vc_memo: '',
                        snapshot_fc_level: 'FC6以下',
                        snapshot_power: '',
                        snapshot_shield_soldier: 'FC6T10以下',
                        snapshot_spear_soldier: 'FC6T10以下',
                        snapshot_bow_soldier: 'FC6T10以下',
                      };
                      const isSaving = savingGameId === m.game_id;
                      const isDeleting = deletingGameId === m.game_id;

                      return (
                        <tr key={rowKey} className="hover:bg-slate-900/40 transition align-top">
                          <td className="p-3">
                            <div className="font-bold text-white flex items-center gap-2">
                              {m.name}
                              {isAnswered ? (
                                <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800/50 rounded text-[9px]">
                                  回答済み
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-800/50 rounded text-[9px]">
                                  未回答
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {m.alliance && (
                                <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[10px]">
                                  {m.alliance}
                                </span>
                              )}
                              <span className="font-mono text-[10px] text-slate-400">ID: {m.game_id}</span>
                            </div>
                          </td>

                          <td className="p-3">
                            {isAnswered && !isEditing ? (
                              <div className="py-2 text-cyan-300 font-medium">
                                {getParticipationLabel(inputState.participation_type)}
                              </div>
                            ) : (
                              <select
                                value={inputState.participation_type ?? ''}
                                onChange={(e) => handleParticipationTypeChange(m.game_id, e.target.value)}
                                className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none focus:border-cyan-500 w-full"
                              >
                                <option value="">- (未選択)</option>
                                <option value="1">① フル(移転込)</option>
                                <option value="2">② フル(戦闘のみ)</option>
                                <option value="3">③ 途中参加</option>
                                <option value="4">④ 不参加</option>
                              </select>
                            )}
                          </td>

                          <td className="p-3">
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              {[
                                { key: 'slot_20', label: '20:00台' },
                                { key: 'slot_21', label: '21:00台' },
                                { key: 'slot_22', label: '22:00台' },
                                { key: 'slot_23', label: '23:00台' },
                                { key: 'slot_24', label: '24:00台' },
                                { key: 'slot_25', label: '25:00台' },
                              ].map((slotObj) => {
                                const slotKey = slotObj.key as keyof ManualInputType;
                                const isDisabled = isAnswered && !isEditing;
                                return (
                                  <label key={slotObj.key} className={`flex items-center gap-1 text-slate-300 ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input
                                      type="checkbox"
                                      disabled={isDisabled}
                                      checked={!!inputState[slotKey]}
                                      onChange={(e) => handleInputChange(m.game_id, slotKey, e.target.checked)}
                                      className="rounded border-slate-700 bg-[#0b0f19] text-cyan-500 focus:ring-0"
                                    />
                                    {slotObj.label}
                                  </label>
                                );
                              })}
                            </div>
                          </td>

                          <td className="p-3">
                            <input
                              type="text"
                              disabled={isAnswered && !isEditing}
                              value={inputState.time_slot_memo ?? ''}
                              onChange={(e) => handleInputChange(m.game_id, 'time_slot_memo', e.target.value)}
                              placeholder="例: 12時半から"
                              className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none focus:border-cyan-500 w-full disabled:opacity-70"
                            />
                          </td>

                          <td className="p-3">
                            {isAnswered && !isEditing ? (
                              <div className="py-2 text-slate-300">
                                {inputState.vc_status === '1' ? '① VCフル' : inputState.vc_status === '2' ? '② 一部のみ' : inputState.vc_status === '3' ? '③ 不参加' : '-'}
                              </div>
                            ) : (
                              <select
                                value={inputState.vc_status ?? ''}
                                onChange={(e) => handleInputChange(m.game_id, 'vc_status', e.target.value)}
                                className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none focus:border-cyan-500 w-full"
                              >
                                <option value="">- (未選択)</option>
                                <option value="1">① VCフル</option>
                                <option value="2">② 一部のみ</option>
                                <option value="3">③ VC不参加</option>
                              </select>
                            )}
                          </td>

                          <td className="p-3">
                            <input
                              type="text"
                              disabled={isAnswered && !isEditing}
                              value={inputState.vc_memo ?? ''}
                              onChange={(e) => handleInputChange(m.game_id, 'vc_memo', e.target.value)}
                              placeholder="例: 聞き専"
                              className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none focus:border-cyan-500 w-full disabled:opacity-70"
                            />
                          </td>

                          <td className="p-3">
                            {isAnswered && !isEditing ? (
                              <div className="py-2 text-slate-300">{inputState.snapshot_fc_level}</div>
                            ) : (
                              <select
                                value={inputState.snapshot_fc_level ?? 'FC6以下'}
                                onChange={(e) => handleInputChange(m.game_id, 'snapshot_fc_level', e.target.value)}
                                className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none focus:border-cyan-500 w-full"
                              >
                                <option value="FC6以下">FC6以下</option>
                                <option value="FC7">FC7</option>
                                <option value="FC8">FC8</option>
                                <option value="FC9">FC9</option>
                                <option value="FC10">FC10</option>
                              </select>
                            )}
                          </td>

                          <td className="p-3">
                            <input
                              type="text"
                              disabled={isAnswered && !isEditing}
                              value={inputState.snapshot_power ?? ''}
                              onChange={(e) => handleInputChange(m.game_id, 'snapshot_power', e.target.value)}
                              placeholder="110.9M"
                              className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none focus:border-cyan-500 w-full disabled:opacity-70"
                            />
                          </td>

                          <td className="p-3 space-y-1.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 w-6 shrink-0">盾:</span>
                              <select
                                disabled={isAnswered && !isEditing}
                                value={inputState.snapshot_shield_soldier ?? 'FC6T10以下'}
                                onChange={(e) => handleInputChange(m.game_id, 'snapshot_shield_soldier', e.target.value)}
                                className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-[10px] rounded p-1 outline-none w-full disabled:opacity-70"
                              >
                                <option value="FC10T11">FC10T11</option>
                                <option value="FC9T11">FC9T11</option>
                                <option value="FC8T11">FC8T11</option>
                                <option value="FC7T11">FC7T11</option>
                                <option value="FC6T11">FC6T11</option>
                                <option value="FC5T11">FC5T11</option>
                                <option value="FC10T10">FC10T10</option>
                                <option value="FC9T10">FC9T10</option>
                                <option value="FC8T10">FC8T10</option>
                                <option value="FC7T10">FC7T10</option>
                                <option value="FC6T10以下">FC6T10以下</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 w-6 shrink-0">槍:</span>
                              <select
                                disabled={isAnswered && !isEditing}
                                value={inputState.snapshot_spear_soldier ?? 'FC6T10以下'}
                                onChange={(e) => handleInputChange(m.game_id, 'snapshot_spear_soldier', e.target.value)}
                                className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-[10px] rounded p-1 outline-none w-full disabled:opacity-70"
                              >
                                <option value="FC10T11">FC10T11</option>
                                <option value="FC9T11">FC9T11</option>
                                <option value="FC8T11">FC8T11</option>
                                <option value="FC7T11">FC7T11</option>
                                <option value="FC6T11">FC6T11</option>
                                <option value="FC5T11">FC5T11</option>
                                <option value="FC10T10">FC10T10</option>
                                <option value="FC9T10">FC9T10</option>
                                <option value="FC8T10">FC8T10</option>
                                <option value="FC7T10">FC7T10</option>
                                <option value="FC6T10以下">FC6T10以下</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 w-6 shrink-0">弓:</span>
                              <select
                                disabled={isAnswered && !isEditing}
                                value={inputState.snapshot_bow_soldier ?? 'FC6T10以下'}
                                onChange={(e) => handleInputChange(m.game_id, 'snapshot_bow_soldier', e.target.value)}
                                className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-[10px] rounded p-1 outline-none w-full disabled:opacity-70"
                              >
                                <option value="FC10T11">FC10T11</option>
                                <option value="FC9T11">FC9T11</option>
                                <option value="FC8T11">FC8T11</option>
                                <option value="FC7T11">FC7T11</option>
                                <option value="FC6T11">FC6T11</option>
                                <option value="FC5T11">FC5T11</option>
                                <option value="FC10T10">FC10T10</option>
                                <option value="FC9T10">FC9T10</option>
                                <option value="FC8T10">FC8T10</option>
                                <option value="FC7T10">FC7T10</option>
                                <option value="FC6T10以下">FC6T10以下</option>
                              </select>
                            </div>
                          </td>

                          <td className="p-3 text-center align-middle">
                            {isAnswered && !isEditing ? (
                              <div className="flex flex-col gap-1.5 items-center">
                                <button
                                  type="button"
                                  onClick={() => setEditingGameIds((prev) => ({ ...prev, [m.game_id]: true }))}
                                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-semibold transition w-full"
                                >
                                  ✏️ 編集
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteResponse(m.game_id)}
                                  disabled={isDeleting}
                                  className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/50 rounded text-[11px] font-semibold transition w-full"
                                >
                                  {isDeleting ? '削除中...' : '🗑️ 削除'}
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5 items-center">
                                <button
                                  type="button"
                                  onClick={() => handleSaveRow(m.game_id)}
                                  disabled={isSaving}
                                  className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 text-white rounded-lg font-semibold transition w-full text-xs"
                                >
                                  {isSaving ? '保存中...' : (isEditing ? '更新保存' : '登録')}
                                </button>
                                {isEditing && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingGameIds((prev) => ({ ...prev, [m.game_id]: false }))}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition w-full"
                                  >
                                    キャンセル
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}