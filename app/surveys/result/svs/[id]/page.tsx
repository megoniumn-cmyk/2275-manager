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
};

type SvsResponse = {
  game_id: string;
  survey_id: string;
  participation_type?: string | number;
  [key: string]: any;
};

export default function SvsResultPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [responses, setResponses] = useState<SvsResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedAlliance, setSelectedAlliance] = useState<string>('ALL');
  const [selectedParticipationType, setSelectedParticipationType] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isNotifyingDiscord, setIsNotifyingDiscord] = useState<boolean>(false);

  useEffect(() => {
    async function fetchData() {
      if (!surveyId) return;

      try {
        // 1. アンケートマスター情報の取得
        const { data: surveyData, error: surveyError } = await supabase
          .from('surveys_master')
          .select('id, survey_type, title, deadline')
          .eq('id', surveyId)
          .single();
        if (surveyError) throw surveyError;
        setSurvey(surveyData);

        // 2. メンバーマスタの取得
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('game_id, name, alliance, leader, discord_id, current_power, fc_level, status');
        if (memberError) throw memberError;
        if (memberData) setMembers(memberData);

        // 3. 回答データの取得 (survey_responses_svs)
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
    }

    fetchData();
  }, [surveyId]);

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
    return a.name.localeCompare(b.name, 'ja');
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
      case '1': return '① フル参加(移転時間込)';
      case '2': return '② フル参加(戦闘時間のみ)';
      case '3': return '③ 途中参加';
      case '4': return '④ 不参加';
      default: return '未分類';
    }
  };

  const filterList = <T extends { name: string; game_id: string; alliance: string | null; response_data?: SvsResponse }>(list: T[]) => {
    return list.filter((item) => {
      const matchAlliance = selectedAlliance === 'ALL' || item.alliance === selectedAlliance;
      
      let matchType = true;
      if (selectedParticipationType !== 'ALL' && 'response_data' in item) {
        matchType = String(item.response_data?.participation_type) === selectedParticipationType;
      }

      const keyword = searchKeyword.toLowerCase();
      const matchSearch =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.game_id.toLowerCase().includes(keyword);

      return matchAlliance && matchType && matchSearch;
    });
  };

  const filteredAnswered = useMemo(() => filterList(answeredMembers), [answeredMembers, selectedAlliance, selectedParticipationType, searchKeyword]);
  const filteredUnvoted = useMemo(() => filterList(unvotedMembers), [unvotedMembers, selectedAlliance, searchKeyword]);

  const handleCopyNames = (type: 'answered' | 'unvoted') => {
    const targetList = type === 'answered' ? filteredAnswered : filteredUnvoted;
    const namesText = targetList.map((m) => m.name).join('\n');
    navigator.clipboard.writeText(namesText).then(() => {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    });
  };

  const getCommonNotificationText = () => {
    let deadlineStr = '未定';
    if (survey?.deadline) {
      try {
        const dateObj = new Date(survey.deadline);
        const jst = dateObj.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false });
        const utc = dateObj.toLocaleString('ja-JP', { timeZone: 'UTC', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false });
        deadlineStr = `${jst} (JST) / ${utc} (UTC)`;
      } catch (e) {
        deadlineStr = survey.deadline;
      }
    }
    const answerUrl = `${window.location.origin}/surveys/answer/svs/${surveyId}`;
    return `アンケート「${survey?.title}」がまだ未回答です。回答おねがいします🙇\n回答期日：${deadlineStr}\n回答URL：${answerUrl}`;
  };

  const handleCopyAllUnvotedWithoutDiscord = () => {
    const targets = filteredUnvoted.filter((m) => !hasValidDiscordId(m.discord_id));
    if (targets.length === 0) {
      alert('対象となるDiscord未登録の未回答者はいません。');
      return;
    }
    const commonText = getCommonNotificationText();
    navigator.clipboard.writeText(commonText).then(() => {
      alert(`Discord未登録の未回答者向け通知文（共通）をコピーしました！`);
    });
  };

  // Discord通知送信ハンドラー
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
          surveyUrl: `${window.location.origin}/surveys/answer/svs/${surveyId}`
        })
      });

      if (!res.ok) throw new Error('通知の送信に失敗しました');
      
      alert('Discord通知の送信リクエストが完了しました！');
    } catch (err) {
      console.error(err);
      alert('Discord APIとの連携部分でエラーが発生しました。バックエンドのルートを確認してください。');
    } finally {
      setIsNotifyingDiscord(false);
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
      <main className="flex-1 max-w-[1200px] mx-auto p-6 w-full space-y-6 flex flex-col">
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

        {/* フィルター＆検索バー */}
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
                <option value="1">① フル参加(移転時間込)</option>
                <option value="2">② フル参加(戦闘時間のみ)</option>
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

        {/* 集計カード */}
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

        {/* リスト表示 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 回答済みリスト */}
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
                  <div key={`${m.game_id}-${index}`} className="bg-[#0b0f19] border border-slate-800 p-3 rounded-xl space-y-2">
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

          {/* 未回答リスト */}
          <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-rose-400">
                ⏳ 未回答 ({filteredUnvoted.length}件)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAllUnvotedWithoutDiscord}
                  className="px-2.5 py-1 bg-amber-900/40 hover:bg-amber-900/70 text-amber-200 border border-amber-700/50 rounded text-[10px] transition"
                  title="共通の通知文をコピーします"
                >
                  💬 共通通知文をコピー
                </button>
                <button
                  onClick={() => handleCopyNames('unvoted')}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                >
                  {copiedType === 'unvoted' ? '✨ コピー完了！' : '📋 名前コピー'}
                </button>
              </div>
            </div>

            {/* Discord通知一括トリガーバー */}
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
                    <div key={`${m.game_id}-${index}`} className="bg-[#0b0f19] border border-slate-800 p-3 rounded-xl space-y-2">
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
                              Discord無 (要ゲーム内通知)
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">ID: {m.game_id}</span>
                      </div>

                      {!isValidDiscord && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                          <span className="text-[10px] text-slate-400">ゲーム内通知用テキスト（共通文面）</span>
                          <button
                            onClick={() => {
                              const textToCopy = getCommonNotificationText();
                              navigator.clipboard.writeText(textToCopy);
                              alert(`${m.name} さんの通知文をコピーしました！`);
                            }}
                            className="px-2 py-1 bg-amber-900/40 hover:bg-amber-900/70 text-amber-200 border border-amber-700/50 rounded text-[10px] transition"
                          >
                            💬 通知文をコピー
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}