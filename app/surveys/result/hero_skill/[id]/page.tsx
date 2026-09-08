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
};

type Member = {
  game_id: string;
  name: string;
  alliance: string | null;
  leader: boolean;
  discord_id: string | null;
  current_power?: string | number | null;
  fc_level?: number | string | null;
  status?: string | null;
  hero_hendrik?: any;
  hero_gatto?: any;
  hero_gordon?: any;
  hero_muming?: any;
  hero_renee?: any;
  hero_norah?: any;
  hero_mia?: any;
  hero_phily?: any;
  hero_zinman?: any;
  hero_fred?: any;
};

type HeroResponse = {
  game_id: string;
  selected_heroes: string[];
};

const HERO_LIST = [
  'ヘンドリック', 'ガト', 'ゴードン', '無名', 'レネ', 
  'ノラ', 'ミア', 'フレンダー', 'ジンマン', 'フレッド'
];

const HERO_COLUMN_MAP: Record<string, string> = {
  'ヘンドリック': 'hero_hendrik',
  'ガト': 'hero_gatto',
  'ゴードン': 'hero_gordon',
  '無名': 'hero_muming',
  'レネ': 'hero_renee',
  'ノラ': 'hero_norah',
  'ミア': 'hero_mia',
  'フレンダー': 'hero_phily',
  'ジンマン': 'hero_zinman',
  'フレッド': 'hero_fred',
};

// boolean型または文字列の "true" を安全に真偽値として判定するヘルパー
const isTrueValue = (val: any): boolean => {
  if (val === true) return true;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    return lower === 'true' || lower === '1';
  }
  return false;
};

// 未回答者の場合は members テーブルのマスタ値（true的模型）をデフォルト選択状態にする
const getInitialHeroesForMember = (m: Member, responseHeroes?: string[], hasResponse?: boolean): string[] => {
  if (hasResponse && responseHeroes && responseHeroes.length > 0) {
    return [...responseHeroes];
  }
  const defaults: string[] = [];
  HERO_LIST.forEach(hero => {
    const col = HERO_COLUMN_MAP[hero];
    if (col && isTrueValue((m as any)[col])) {
      defaults.push(hero);
    }
  });
  return defaults;
};

export default function HeroSkillResultPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [responses, setResponses] = useState<HeroResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'result' | 'manage'>('result');

  const [selectedAlliance, setSelectedAlliance] = useState<string>('ALL');
  const [discordFilter, setDiscordFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isNotifyingDiscord, setIsNotifyingDiscord] = useState<boolean>(false);

  const [editStates, setEditStates] = useState<Record<string, string[]>>({});
  const [savingGameIds, setSavingGameIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchData() {
      if (!surveyId) return;

      try {
        const { data: surveyData, error: surveyError } = await supabase
          .from('surveys_master')
          .select('id, survey_type, title, deadline')
          .eq('id', surveyId)
          .single();
        if (surveyError) throw surveyError;
        setSurvey(surveyData);

        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('game_id, name, alliance, leader, discord_id, current_power, fc_level, status, hero_hendrik, hero_gatto, hero_gordon, hero_muming, hero_renee, hero_norah, hero_mia, hero_phily, hero_zinman, hero_fred');
        if (memberError) throw memberError;

        const { data: responseData, error: responseError } = await supabase
          .from('survey_responses_hero_skill')
          .select('game_id, selected_heroes')
          .eq('survey_id', surveyId);
        if (responseError) throw responseError;
        
        let fetchedResponses: HeroResponse[] = [];
        if (responseData) {
          fetchedResponses = responseData;
          setResponses(responseData);
        }

        if (memberData) {
          setMembers(memberData);
          
          const initialMap: Record<string, string[]> = {};
          const answeredIds = new Set(fetchedResponses.map(r => r.game_id));

          memberData.forEach(m => {
            if (!m.game_id) return;
            const hasResp = answeredIds.has(m.game_id);
            const resp = fetchedResponses.find(r => r.game_id === m.game_id);
            initialMap[m.game_id] = getInitialHeroesForMember(m, resp?.selected_heroes, hasResp);
          });
          setEditStates(initialMap);
        }

      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [surveyId]);

  const hasValidDiscordId = (discordId?: string | null): boolean => {
    if (!discordId) return false;
    const trimmed = discordId.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return false;
    if (trimmed.startsWith('temp_') || trimmed.startsWith('no_discord') || trimmed.includes('no_discord')) return false;
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
      if (m.alliance && m.alliance.trim() !== '') {
        set.add(m.alliance.trim());
      }
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
    return a.name.localeCompare(b.name, 'ja');
  };

  const answeredGameIds = useMemo(() => new Set(responses.map((r) => r.game_id)), [responses]);

  const { answeredMembers, unvotedMembers, allActiveMembers } = useMemo(() => {
    const answered: (Member & { selected_heroes?: string[] })[] = [];
    const unvoted: Member[] = [];
    const active: (Member & { selected_heroes?: string[]; isAnswered: boolean })[] = [];

    members.forEach((m) => {
      if (!m.game_id) return;
      if (m.status && m.status.toLowerCase() === 'left') return;
      const isAnswered = answeredGameIds.has(m.game_id);
      const resp = responses.find((r) => r.game_id === m.game_id);
      
      const currentSelected = editStates[m.game_id] !== undefined
        ? editStates[m.game_id]
        : getInitialHeroesForMember(m, resp?.selected_heroes, isAnswered);

      active.push({ ...m, selected_heroes: currentSelected, isAnswered });

      if (isAnswered) {
        answered.push({ ...m, selected_heroes: currentSelected });
      } else {
        if (!m.leader) {
          unvoted.push(m);
        }
      }
    });

    answered.sort(sortMembers);
    unvoted.sort(sortMembers);
    active.sort(sortMembers);

    return { answeredMembers: answered, unvotedMembers: unvoted, allActiveMembers: active };
  }, [members, answeredGameIds, responses, editStates]);

  const filteredAllActive = useMemo(() => {
    return allActiveMembers.filter((item) => {
      const matchAlliance = selectedAlliance === 'ALL' || item.alliance === selectedAlliance;
      
      const isValidDiscord = hasValidDiscordId(item.discord_id);
      let matchDiscord = true;
      if (discordFilter === 'has_discord') matchDiscord = isValidDiscord;
      if (discordFilter === 'no_discord') matchDiscord = !isValidDiscord;

      let matchStatus = true;
      if (statusFilter === 'answered') matchStatus = item.isAnswered;
      if (statusFilter === 'unvoted') matchStatus = !item.isAnswered;

      const keyword = (searchKeyword || '').toLowerCase();
      const itemName = String(item.name ?? '').toLowerCase();
      const itemGameId = String(item.game_id ?? '').toLowerCase();
      const matchSearch = !keyword || itemName.includes(keyword) || itemGameId.includes(keyword);

      return matchAlliance && matchDiscord && matchStatus && matchSearch;
    });
  }, [allActiveMembers, selectedAlliance, discordFilter, statusFilter, searchKeyword]);

  const filterList = <T extends { name?: string | null; game_id?: string | null; alliance?: string | null }>(list: T[]) => {
    return list.filter((item) => {
      const matchAlliance = selectedAlliance === 'ALL' || item.alliance === selectedAlliance;
      const keyword = (searchKeyword || '').toLowerCase();
      const itemName = String(item.name ?? '').toLowerCase();
      const itemGameId = String(item.game_id ?? '').toLowerCase();
      const matchSearch = !keyword || itemName.includes(keyword) || itemGameId.includes(keyword);
      return matchAlliance && matchSearch;
    });
  };

  const filteredAnswered = useMemo(() => filterList(answeredMembers), [answeredMembers, selectedAlliance, searchKeyword]);
  const filteredUnvoted = useMemo(() => filterList(unvotedMembers), [unvotedMembers, selectedAlliance, searchKeyword]);

  const heroCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    HERO_LIST.forEach((hero) => { counts[hero] = 0; });
    responses.forEach((res) => {
      if (Array.isArray(res.selected_heroes)) {
        res.selected_heroes.forEach((hero) => {
          if (counts[hero] !== undefined) counts[hero] += 1;
        });
      }
    });
    return counts;
  }, [responses]);

  const handleCopyNames = (type: 'answered' | 'unvoted') => {
    const targetList = type === 'answered' ? filteredAnswered : filteredUnvoted;
    const namesText = targetList.map((m) => m.name).join('\n');
    navigator.clipboard.writeText(namesText).then(() => {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    });
  };

  const getFormattedDeadline = () => {
    if (!survey?.deadline) return '未定 / TBD';
    try {
      const dateObj = new Date(survey.deadline);
      const jst = dateObj.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false });
      const utc = dateObj.toLocaleString('ja-JP', { timeZone: 'UTC', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false });
      return `${jst} (JST) / ${utc} (UTC)`;
    } catch (e) {
      return survey.deadline;
    }
  };

  const getNotificationTextJP = () => {
    const deadlineStr = getFormattedDeadline();
    const answerUrl = `${window.location.origin}/surveys/answer/hero_skill/${surveyId}`;
    return `アンケート「${survey?.title}」がまだ未回答です。回答おねがいします🙇\n回答期日：${deadlineStr}\n回答URL：${answerUrl}`;
  };

  const getNotificationTextEN = () => {
    const deadlineStr = getFormattedDeadline();
    const answerUrl = `${window.location.origin}/surveys/answer/hero_skill/${surveyId}`;
    return `Survey "${survey?.title}" has not been answered yet. Please submit your response 🙇\nDeadline: ${deadlineStr}\nURL: ${answerUrl}`;
  };

  const handleCopyNotification = (lang: 'jp' | 'en') => {
    const text = lang === 'jp' ? getNotificationTextJP() : getNotificationTextEN();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedType(`notification_${lang}`);
      setTimeout(() => setCopiedType(null), 2000);
    });
  };

  const handleSendDiscordNotifications = async () => {
    const targetsWithDiscord = filteredUnvoted.filter((m) => hasValidDiscordId(m.discord_id));
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
          surveyUrl: `${window.location.origin}/surveys/answer/hero_skill/${surveyId}`,
          messageJp: getNotificationTextJP(),
          messageEn: getNotificationTextEN()
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

  const handleTableCheckboxChange = (gameId: string, hero: string) => {
    setEditStates(prev => {
      const member = members.find(m => m.game_id === gameId);
      const isAnswered = answeredGameIds.has(gameId);
      const resp = responses.find(r => r.game_id === gameId);
      
      const currentSelected = prev[gameId] || (member ? getInitialHeroesForMember(member, resp?.selected_heroes, isAnswered) : []);
      
      const updated = currentSelected.includes(hero)
        ? currentSelected.filter(h => h !== hero)
        : [...currentSelected, hero];
      return { ...prev, [gameId]: updated };
    });
  };

  const handleSaveRow = async (member: Member) => {
    const isAnswered = answeredGameIds.has(member.game_id);
    const resp = responses.find(r => r.game_id === member.game_id);
    const selectedHeroes = editStates[member.game_id] || getInitialHeroesForMember(member, resp?.selected_heroes, isAnswered);
    
    setSavingGameIds(prev => ({ ...prev, [member.game_id]: true }));

    try {
      const { error: upsertError } = await supabase
        .from('survey_responses_hero_skill')
        .upsert({
          survey_id: surveyId,
          game_id: member.game_id,
          selected_heroes: selectedHeroes,
          updated_at: new Date().toISOString()
        }, { onConflict: 'survey_id,game_id' });

      if (upsertError) throw upsertError;

      const memberUpdatePayload: Record<string, any> = {};
      HERO_LIST.forEach(hero => {
        const colName = HERO_COLUMN_MAP[hero];
        if (colName) {
          memberUpdatePayload[colName] = selectedHeroes.includes(hero) ? true : null;
        }
      });

      const { error: memberError } = await supabase
        .from('members')
        .update(memberUpdatePayload)
        .eq('game_id', member.game_id);

      if (memberError) {
        console.error('Members table update error:', memberError);
      }

      setResponses(prev => {
        const filtered = prev.filter(r => r.game_id !== member.game_id);
        if (selectedHeroes.length === 0) {
          return filtered;
        }
        return [...filtered, { game_id: member.game_id, selected_heroes: selectedHeroes }];
      });

      alert(`${member.name} のデータを反映しました！`);
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存中にエラーが発生しました。');
    } finally {
      setSavingGameIds(prev => ({ ...prev, [member.game_id]: false }));
    }
  };

  const handleDeleteResponse = async (gameId: string) => {
    if (!confirm('この回答データを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('survey_responses_hero_skill')
        .delete()
        .eq('survey_id', surveyId)
        .eq('game_id', gameId);

      if (error) throw error;

      const memberClearPayload: Record<string, any> = {};
      HERO_LIST.forEach(hero => {
        const colName = HERO_COLUMN_MAP[hero];
        if (colName) memberClearPayload[colName] = null;
      });

      await supabase
        .from('members')
        .update(memberClearPayload)
        .eq('game_id', gameId);

      setResponses(prev => prev.filter(r => r.game_id !== gameId));
      
      const targetMember = members.find(m => m.game_id === gameId);
      setEditStates(prev => {
        const nextState = { ...prev };
        if (targetMember) {
          nextState[gameId] = getInitialHeroesForMember(targetMember, undefined, false);
        } else {
          delete nextState[gameId];
        }
        return nextState;
      });

      alert('回答を削除しました。');
    } catch (err) {
      console.error('削除エラー:', err);
      alert('削除に失敗しました。');
    }
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
        
        {/* ヘッダーカード */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded text-xs font-semibold">
                結果確認・回答状況
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

        {/* タブ切り替えボタン */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('result')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'result'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40'
                : 'bg-[#151c2c] text-slate-400 hover:bg-slate-800'
            }`}
          >
            📊 回答結果・状況一覧
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'manage'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40'
                : 'bg-[#151c2c] text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span>✍️ メンバー回答一括管理・手動登録/編集</span>
            <span className="px-1.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-800/50 rounded-full text-[10px]">
              未回答 {unvotedMembers.length}名
            </span>
          </button>
        </div>

        {activeTab === 'result' && (
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400 shrink-0">同盟フィルター:</span>
              <select
                value={selectedAlliance}
                onChange={(e) => setSelectedAlliance(e.target.value)}
                className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500 w-full sm:w-auto"
              >
                <option value="ALL">すべて表示</option>
                {alliances.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
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
        )}

        {/* ================= タブ1: 回答結果・状況一覧 ================= */}
        {activeTab === 'result' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 shadow-xl space-y-1">
                <span className="text-xs text-slate-400">総回答者数</span>
                <p className="text-2xl font-bold text-cyan-400">{answeredMembers.length} 名</p>
              </div>
              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-5 shadow-xl space-y-1">
                <span className="text-xs text-slate-400">未回答者数（リーダー除外）</span>
                <p className="text-2xl font-bold text-rose-400">{unvotedMembers.length} 名</p>
              </div>
            </div>

            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">
                🏆 英雄別 Lv5 保持状況 集計
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {HERO_LIST.map((hero) => (
                  <div key={hero} className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl flex flex-col justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300">{hero}</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-white">{heroCounts[hero]}</span>
                      <span className="text-[10px] text-slate-400">人が選択</span>
                    </div>
                  </div>
                ))}
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
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{m.name}</span>
                            {m.alliance && (
                              <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                                {m.alliance}
                              </span>
                            )}
                            {m.fc_level != null && (
                              <span className="px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800/50 rounded text-[10px]">
                                {typeof m.fc_level === 'string' && m.fc_level.toUpperCase().startsWith('FC') ? m.fc_level : `FC.${m.fc_level}`}
                              </span>
                            )}
                            {m.current_power != null && (
                              <span className="text-[10px] text-slate-400">
                                戦力: {m.current_power}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-400">ID: {m.game_id}</span>
                            <button
                              onClick={() => handleDeleteResponse(m.game_id)}
                              className="px-2 py-0.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[10px] rounded transition"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {m.selected_heroes && m.selected_heroes.length > 0 ? (
                            m.selected_heroes.map((hero) => (
                              <span key={hero} className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800/50 rounded text-[10px]">
                                {hero}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500">選択なし</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-rose-400">
                    ⏳ 未回答 ({filteredUnvoted.length}件)
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyNames('unvoted')}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                    >
                      {copiedType === 'unvoted' ? '✨ コピー完了！' : '📋 名前コピー'}
                    </button>
                  </div>
                </div>

                {/* 日本語・英語の通知文コピーボタンエリア */}
                <div className="bg-[#0b0f19] border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-xs text-slate-300 font-medium">一括通知文コピー (JST/UTC併記)</span>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleCopyNotification('jp')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <span>🇯🇵</span>
                      <span>{copiedType === 'notification_jp' ? 'コピー完了！' : '日本語通知文コピー'}</span>
                    </button>
                    <button
                      onClick={() => handleCopyNotification('en')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <span>🇺🇸</span>
                      <span>{copiedType === 'notification_en' ? 'コピー完了！' : '英語通知文コピー'}</span>
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

                <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                  {filteredUnvoted.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">該当する未回答者はいません</p>
                  ) : (
                    filteredUnvoted.map((m, index) => {
                      const isValidDiscord = hasValidDiscordId(m.discord_id);
                      return (
                        <div key={m.game_id ? `unvoted-${m.game_id}` : `unvoted-idx-${index}`} className="bg-[#0b0f19] border border-slate-800 p-3 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{m.name}</span>
                              {m.alliance && (
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                                  {m.alliance}
                                </span>
                              )}
                              {m.fc_level != null && (
                                <span className="px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800/50 rounded text-[10px]">
                                  {typeof m.fc_level === 'string' && m.fc_level.toUpperCase().startsWith('FC') ? m.fc_level : `FC.${m.fc_level}`}
                                </span>
                              )}
                              {m.current_power != null && (
                                <span className="text-[10px] text-slate-400">
                                  戦力: {m.current_power}
                                </span>
                              )}
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

        {/* ================= タブ2: メンバー回答一括管理・手動登録/編集 ================= */}
        {activeTab === 'manage' && (
          <div className="space-y-4">
            
            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 shrink-0">同盟:</span>
                <select
                  value={selectedAlliance}
                  onChange={(e) => setSelectedAlliance(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
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
                  value={discordFilter}
                  onChange={(e) => setDiscordFilter(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                >
                  <option value="ALL">すべて表示</option>
                  <option value="has_discord">登録あり</option>
                  <option value="no_discord">未登録 (無効含む)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 shrink-0">回答状態:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                >
                  <option value="ALL">すべて表示</option>
                  <option value="answered">回答済み</option>
                  <option value="unvoted">未回答</option>
                </select>
              </div>

              <div className="flex-1 min-w-[220px]">
                <input
                  type="text"
                  placeholder="ユーザ名またはゲームIDで検索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500 w-full"
                />
              </div>

              <div className="text-xs text-slate-400 shrink-0 ml-auto">
                表示中: <span className="text-cyan-400 font-bold">{filteredAllActive.length}</span> 名
              </div>
            </div>

            {/* テーブル本体 */}
            <div className="bg-[#151c2c] border border-slate-800 rounded-xl shadow-xl max-h-[650px] overflow-auto relative">
              <table className="w-full text-left border-collapse min-w-[1300px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0b0f19] text-[11px] text-slate-400 sticky top-0 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                    <th className="p-3 font-semibold w-60 sticky left-0 bg-[#0b0f19] z-40 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      メンバー名 / 同盟 / 状態
                    </th>
                    {HERO_LIST.map((hero) => (
                      <th key={hero} className="p-2 font-semibold text-center whitespace-nowrap">{hero}</th>
                    ))}
                    <th className="p-3 font-semibold text-center w-32 sticky right-0 bg-[#0b0f19] z-40 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredAllActive.length === 0 ? (
                    <tr>
                      <td colSpan={HERO_LIST.length + 2} className="text-center py-12 text-slate-500">
                        該当するメンバーはいません
                      </td>
                    </tr>
                  ) : (
                    filteredAllActive.map((m, index) => {
                      const isSaving = savingGameIds[m.game_id] || false;
                      const isAnswered = answeredGameIds.has(m.game_id);
                      const resp = responses.find(r => r.game_id === m.game_id);
                      const currentSelected = editStates[m.game_id] || getInitialHeroesForMember(m, resp?.selected_heroes, isAnswered);

                      return (
                        <tr key={m.game_id ? `manage-${m.game_id}` : `manage-idx-${index}`} className="hover:bg-slate-800/30 transition">
                          {/* 左固定列：メンバー名等 */}
                          <td className="p-3 space-y-1 sticky left-0 bg-[#151c2c] z-20 shadow-[2px_0_5px_rgba(0,0,0,0.3)] w-60">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white truncate max-w-[130px]" title={m.name}>{m.name}</span>
                              {m.isAnswered ? (
                                <span className="px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800/50 rounded text-[9px] font-semibold shrink-0">
                                  回答済
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-rose-950/60 text-rose-300 border border-rose-900/50 rounded text-[9px] font-semibold shrink-0">
                                  未回答
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              {m.alliance && <span className="text-slate-300 font-medium">[{m.alliance}]</span>}
                              <span className="font-mono">ID: {m.game_id}</span>
                            </div>
                          </td>

                          {HERO_LIST.map((hero) => {
                            const isChecked = currentSelected.includes(hero);
                            return (
                              <td key={hero} className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTableCheckboxChange(m.game_id, hero)}
                                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                                />
                              </td>
                            );
                          })}

                          {/* 右固定列：操作ボタン */}
                          <td className="p-2 text-center sticky right-0 bg-[#151c2c] z-20 shadow-[-2px_0_5px_rgba(0,0,0,0.3)] w-32">
                            {m.isAnswered ? (
                              <div className="flex flex-col gap-1.5 items-center justify-center">
                                <button
                                  onClick={() => handleSaveRow(m)}
                                  disabled={isSaving}
                                  className="w-20 py-1 bg-[#475569] hover:bg-[#64748b] disabled:bg-slate-800 text-white rounded text-[11px] font-medium transition shadow flex items-center justify-center gap-1"
                                >
                                  <span>✏️</span> 編集
                                </button>
                                <button
                                  onClick={() => handleDeleteResponse(m.game_id)}
                                  className="w-20 py-1 bg-[#881337] hover:bg-[#9f1239] text-rose-100 rounded text-[11px] font-medium transition shadow flex items-center justify-center gap-1 border border-rose-800/40"
                                >
                                  <span>🗑️</span> 削除
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={() => handleSaveRow(m)}
                                  disabled={isSaving}
                                  className="w-20 py-1.5 bg-[#0891b2] hover:bg-[#06b6d4] disabled:bg-cyan-900 text-white rounded text-xs font-bold transition shadow"
                                >
                                  {isSaving ? '保存中' : '登録'}
                                </button>
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