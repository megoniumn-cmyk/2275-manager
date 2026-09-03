'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';

type SurveyMaster = {
  id: string;
  survey_type: string;
  title: string;
  event_date: string | null;
  deadline: string;
  status: string;
};

type MemberData = {
  game_id: string;
  fc_level?: string;
  current_power?: string;
  shield_soldier?: string;
  spear_soldier?: string;
  bow_soldier?: string;
};

export default function TalSurveyAnswerPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const [hasResponded, setHasResponded] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [entryStatus, setEntryStatus] = useState<string>('yes');
  const [fcLevel, setFcLevel] = useState<string>('FC9');
  const [combatPower, setCombatPower] = useState<string>('');
  const [powerNum, setPowerNum] = useState<string>('');
  const [powerUnit, setPowerUnit] = useState<string>('B');
  const [shieldSoldier, setShieldSoldier] = useState<string>('FC10T11');
  const [spearSoldier, setSpearSoldier] = useState<string>('FC10T11');
  const [bowSoldier, setBowSoldier] = useState<string>('FC10T11');
  const [vcStatus, setVcStatus] = useState<string>('1');

  // 日付ごとの参加予定 (7回分: 初戦日, +2, +4, +6, +8, +10, +12)
  const [scheduleAnswers, setScheduleAnswers] = useState<Record<number, string>>({
    0: '1', 1: '1', 2: '1', 3: '1', 4: '1', 5: '1', 6: '1'
  });

  const [savedResponse, setSavedResponse] = useState<any>(null);

  const getTargetDates = (baseDateStr: string | null) => {
    const dates: string[] = [];
    const base = baseDateStr ? new Date(baseDateStr) : new Date();
    if (isNaN(base.getTime())) {
      base.setTime(new Date().getTime());
    }
    for (let i = 0; i <= 12; i += 2) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
    return dates;
  };

  const targetDates = getTargetDates(survey?.event_date || null);

  useEffect(() => {
    async function initData() {
      if (!surveyId) return;

      try {
        const { data: surveyData, error: surveyError } = await supabase
          .from('surveys_master')
          .select('*')
          .eq('id', surveyId)
          .single();

        if (surveyError) throw surveyError;
        setSurvey(surveyData);

        const currentLoginGameId = localStorage.getItem('logged_in_game_id');
        if (!currentLoginGameId) {
          throw new Error('ログイン中のゲームIDが見つかりません。再度ログインしてください。');
        }

        const { data: memberData } = await supabase
          .from('members')
          .select('*')
          .eq('game_id', currentLoginGameId)
          .single();

        if (memberData) {
          setMember(memberData);
          if (memberData.fc_level) setFcLevel(memberData.fc_level);
          if (memberData.shield_soldier) setShieldSoldier(memberData.shield_soldier);
          if (memberData.spear_soldier) setSpearSoldier(memberData.spear_soldier);
          if (memberData.bow_soldier) setBowSoldier(memberData.bow_soldier);
          
          if (memberData.current_power) {
            const match = memberData.current_power.match(/^([0-9.]+)([BM]?)$/i);
            if (match) {
              setPowerNum(match[1]);
              if (match[2]) setPowerUnit(match[2].toUpperCase());
            } else {
              setPowerNum(memberData.current_power);
            }
          }
        } else {
          setMember({ game_id: currentLoginGameId });
        }

        const { data: responseData } = await supabase
          .from('survey_responses_tal_entry')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('game_id', currentLoginGameId)
          .single();

        if (responseData) {
          setHasResponded(true);
          setSavedResponse(responseData);

          if (responseData.entry_status) setEntryStatus(responseData.entry_status);
          if (responseData.fc_level) setFcLevel(responseData.fc_level);
          if (responseData.combat_power) setCombatPower(responseData.combat_power);
          if (responseData.vc_status) setVcStatus(responseData.vc_status);
          if (responseData.shield_soldier) setShieldSoldier(responseData.shield_soldier);
          if (responseData.spear_soldier) setSpearSoldier(responseData.spear_soldier);
          if (responseData.bow_soldier) setBowSoldier(responseData.bow_soldier);
          if (responseData.schedule_answers) setScheduleAnswers(responseData.schedule_answers);

          if (responseData.current_power) {
            const match = responseData.current_power.match(/^([0-9.]+)([BM]?)$/i);
            if (match) {
              setPowerNum(match[1]);
              if (match[2]) setPowerUnit(match[2].toUpperCase());
            } else {
              setPowerNum(responseData.current_power);
            }
          }
        }

      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [surveyId]);

  const isExpired = survey ? new Date() > new Date(survey.deadline) : false;

  // 3種すべてが FC10T11 かどうかを判定するフラグ
  const isAllFc10T11 = shieldSoldier === 'FC10T11' && spearSoldier === 'FC10T11' && bowSoldier === 'FC10T11';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExpired) {
      alert('受付期限が終了しているため、回答・修正はできません。');
      return;
    }

    if (!member?.game_id) {
      alert('ログイン中のゲームIDが取得できませんでした。');
      return;
    }

    setSubmitting(true);
    try {
      const fullPower = powerNum ? `${powerNum}${powerUnit}` : null;

      const finalFcLevel = member?.fc_level === 'FC10' ? 'FC10' : fcLevel;
      const finalPower = fullPower || member?.current_power || null;
      
      const finalShield = isAllFc10T11 ? 'FC10T11' : shieldSoldier;
      const finalSpear = isAllFc10T11 ? 'FC10T11' : spearSoldier;
      const finalBow = isAllFc10T11 ? 'FC10T11' : bowSoldier;

      if (entryStatus === 'yes') {
        const memberUpdatePayload: any = {
          fc_level: finalFcLevel,
          shield_soldier: finalShield,
          spear_soldier: finalSpear,
          bow_soldier: finalBow,
        };
        if (finalPower) {
          memberUpdatePayload.current_power = finalPower;
        }

        const { error: memberError } = await supabase
          .from('members')
          .update(memberUpdatePayload)
          .eq('game_id', member.game_id);

        if (memberError) throw memberError;
      }

      const surveyResponsePayload: any = {
        survey_id: surveyId,
        game_id: member.game_id,
        entry_status: entryStatus,
        fc_level: entryStatus === 'yes' ? finalFcLevel : null,
        combat_power: entryStatus === 'yes' ? combatPower : null,
        schedule_answers: entryStatus === 'yes' ? scheduleAnswers : null,
        vc_status: entryStatus === 'yes' ? vcStatus : null,
        shield_soldier: entryStatus === 'yes' ? finalShield : null,
        spear_soldier: entryStatus === 'yes' ? finalSpear : null,
        bow_soldier: entryStatus === 'yes' ? finalBow : null,
        current_power: entryStatus === 'yes' ? finalPower : null,
      };

      const { data: upsertData, error: surveyResponseError } = await supabase
        .from('survey_responses_tal_entry')
        .upsert([surveyResponsePayload], { onConflict: 'survey_id,game_id' })
        .select()
        .single();

      if (surveyResponseError) throw surveyResponseError;

      setSavedResponse(upsertData || surveyResponsePayload);
      setHasResponded(true);
      setIsEditing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error: any) {
      console.error(error);
      alert(`送信エラー: ${error.message || '不明なエラー'}`);
    } finally {
      setSubmitting(false);
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

  const getScheduleLabel = (val: string) => {
    switch(val) {
      case '1': return '① 21/23時フル参加';
      case '2': return '② 21時のみフル参加';
      case '3': return '③ 23時のみフル参加';
      case '4': return '④ 途中参加';
      case '5': return '⑤ 不参加';
      default: return val;
    }
  };

  const getVcLabel = (status: string) => {
    switch(status) {
      case '1': return '① 全部VC参加可能';
      case '2': return '② 一部VC参加不可';
      case '3': return '③ VC参加不可';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1000px] mx-auto p-6 w-full space-y-6 flex flex-col">
        
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                isExpired 
                  ? 'bg-rose-950 text-rose-400 border-rose-800/50' 
                  : 'bg-cyan-950 text-cyan-400 border-cyan-800/50'
              }`}>
                {isExpired ? '受付終了' : '受付中'}
              </span>
              {hasResponded && !isEditing && (
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded-lg text-xs font-semibold">
                  回答送信完了
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">
              回答期限: {survey.deadline}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">{survey.title}</h1>
          {survey.event_date && (
            <p className="text-xs text-cyan-400">初戦の日付: {new Date(survey.event_date).toLocaleDateString('ja-JP')}</p>
          )}
        </div>

        {hasResponded && !isEditing ? (
          <div className="space-y-6">
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <span>✅ 回答が送信されました</span>
                </div>
                <p className="text-xs text-slate-300">
                  ご回答ありがとうございます。以下の内容で登録されています。
                </p>
              </div>

              {!isExpired && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer"
                >
                  内容を修正する
                </button>
              )}
            </div>

            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">
                あなたの回答内容
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">回答ゲームID</span>
                  <p className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</p>
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">エントリー希望</span>
                  <p className="font-semibold text-white">
                    {savedResponse?.entry_status === 'yes' ? '①希望する' : '②希望しない'}
                  </p>
                </div>

                {savedResponse?.entry_status === 'yes' && (
                  <>
                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">溶鉱炉Lv</span>
                      <p className="font-semibold text-white">{savedResponse?.fc_level || 'FC10 (自動)'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">部隊戦闘力</span>
                      <p className="font-mono font-semibold text-white">{savedResponse?.combat_power || '-'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">総力</span>
                      <p className="font-mono font-semibold text-white">{savedResponse?.current_power || '-'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">VC参加状況</span>
                      <p className="font-semibold text-white">{getVcLabel(savedResponse?.vc_status)}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2 md:col-span-2">
                      <span className="text-slate-400">各日程の参加予定</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-white">
                        {targetDates.map((dateStr, idx) => (
                          <div key={dateStr} className="bg-[#151c2c] p-2 rounded border border-slate-700 text-[11px]">
                            <span className="text-cyan-400 font-semibold">{dateStr}: </span>
                            <span>{getScheduleLabel(savedResponse?.schedule_answers?.[idx])}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {!(savedResponse?.shield_soldier === 'FC10T11' && savedResponse?.spear_soldier === 'FC10T11' && savedResponse?.bow_soldier === 'FC10T11') && (
                      <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2 md:col-span-2">
                        <span className="text-slate-400">兵士Lv</span>
                        <div className="grid grid-cols-3 gap-2 text-white">
                          <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">盾兵</span>
                            <span className="font-semibold">{savedResponse?.shield_soldier || '-'}</span>
                          </div>
                          <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">槍兵</span>
                            <span className="font-semibold">{savedResponse?.spear_soldier || '-'}</span>
                          </div>
                          <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">弓兵</span>
                            <span className="font-semibold">{savedResponse?.bow_soldier || '-'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl bg-[#151c2c] shadow-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <div className="flex items-center justify-between bg-[#0b0f19] border border-slate-800 p-4 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400">回答中のゲームID: </span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</span>
                </div>
                {hasResponded && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-slate-400 hover:text-white underline text-xs cursor-pointer"
                  >
                    キャンセルして結果に戻る
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  エントリー希望しますか <span className="text-rose-400">*回答必須</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'yes', label: '① 希望する' },
                    { id: 'no', label: '② 希望しない' },
                  ].map((item) => (
                    <button
                      type="button"
                      disabled={isExpired}
                      key={item.id}
                      onClick={() => setEntryStatus(item.id)}
                      className={`p-3 rounded-xl text-xs font-medium border text-left transition ${
                        isExpired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        entryStatus === item.id
                          ? 'bg-cyan-600 border-cyan-500 text-white'
                          : 'bg-[#0b0f19] border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {entryStatus === 'yes' && (
                <>
                  {member?.fc_level !== 'FC10' && (
                    <div className="space-y-2 pt-4 border-t border-slate-800">
                      <label className="block text-xs font-semibold text-slate-200">
                        溶鉱炉Lvを回答してください。 <span className="text-rose-400">*回答必須</span>
                        <span className="block text-[11px] text-slate-400 font-normal">過去の回答でFC10を選択している場合、設問は表示されません。</span>
                      </label>
                      <div className="relative">
                        <select
                          disabled={isExpired}
                          value={fcLevel}
                          onChange={(e) => setFcLevel(e.target.value)}
                          className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 appearance-none disabled:opacity-60"
                          required
                        >
                          <option value="FC10">FC10</option>
                          <option value="FC9">FC9</option>
                          <option value="FC8">FC8</option>
                          <option value="FC7">FC7</option>
                          <option value="FC6以下">FC6以下</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      部隊戦闘力を入力してください。 <span className="text-rose-400">*回答必須</span>
                    </label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={combatPower}
                      onChange={(e) => setCombatPower(e.target.value)}
                      placeholder="例: 13000"
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-60"
                      required
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      それぞれの参加予定について回答してください。 <span className="text-rose-400">*回答必須</span>
                    </label>
                    <div className="space-y-3 bg-[#0b0f19] p-4 rounded-xl border border-slate-800">
                      {targetDates.map((dateStr, idx) => (
                        <div key={dateStr} className="space-y-1.5 pb-3 border-b border-slate-800/60 last:border-0 last:pb-0">
                          <span className="text-xs font-semibold text-cyan-400">{dateStr} の予定</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {[
                              { id: '1', label: '① 21/23時フル' },
                              { id: '2', label: '② 21時のみ' },
                              { id: '3', label: '③ 23時のみ' },
                              { id: '4', label: '④ 途中参加' },
                              { id: '5', label: '⑤ 不参加' },
                            ].map((opt) => (
                              <button
                                type="button"
                                key={opt.id}
                                disabled={isExpired}
                                onClick={() => setScheduleAnswers({ ...scheduleAnswers, [idx]: opt.id })}
                                className={`p-2 rounded-lg text-xs font-medium border text-left transition ${
                                  isExpired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                } ${
                                  scheduleAnswers[idx] === opt.id
                                    ? 'bg-cyan-600 border-cyan-500 text-white'
                                    : 'bg-[#151c2c] border-slate-700 text-slate-300 hover:border-slate-500'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      VC参加(聞き専含む)について回答してください。 <span className="text-rose-400">*回答必須</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { id: '1', label: '① 全部VC参加可能' },
                        { id: '2', label: '② 一部VC参加不可' },
                        { id: '3', label: '③ VC参加不可' },
                      ].map((item) => (
                        <button
                          type="button"
                          disabled={isExpired}
                          key={item.id}
                          onClick={() => setVcStatus(item.id)}
                          className={`p-3 rounded-xl text-xs font-medium border text-left transition ${
                            isExpired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            vcStatus === item.id
                              ? 'bg-cyan-600 border-cyan-500 text-white'
                              : 'bg-[#0b0f19] border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      総力を入力してください。 <span className="text-rose-400">*回答必須</span>
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        disabled={isExpired}
                        value={powerNum}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          setPowerNum(val);
                        }}
                        placeholder="例: 1.1"
                        className="flex-1 bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-60"
                        required
                      />
                      <div className="relative w-36">
                        <select
                          disabled={isExpired}
                          value={powerUnit}
                          onChange={(e) => setPowerUnit(e.target.value)}
                          className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold appearance-none disabled:opacity-60"
                        >
                          <option value="B">B</option>
                          <option value="M">M</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                      </div>
                    </div>
                  </div>

                  {/* 盾・槍・弓すべてが FC10T11 でない場合のみ兵士Lvを表示 */}
                  {!isAllFc10T11 && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      <p className="text-xs font-semibold text-slate-200">
                        兵士Lvを回答してください（SvS当日までに解放する場合は、解放予定後の兵士Lvで回答） <span className="text-rose-400">*回答必須</span>
                      </p>

                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-400">・盾兵 <span className="text-rose-400">*</span></label>
                        <div className="relative">
                          <select
                            disabled={isExpired}
                            value={shieldSoldier}
                            onChange={(e) => setShieldSoldier(e.target.value)}
                            className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 appearance-none disabled:opacity-60"
                            required
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
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-400">・槍兵 <span className="text-rose-400">*</span></label>
                        <div className="relative">
                          <select
                            disabled={isExpired}
                            value={spearSoldier}
                            onChange={(e) => setSpearSoldier(e.target.value)}
                            className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 appearance-none disabled:opacity-60"
                            required
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
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-400">・弓兵 <span className="text-rose-400">*</span></label>
                        <div className="relative">
                          <select
                            disabled={isExpired}
                            value={bowSoldier}
                            onChange={(e) => setBowSoldier(e.target.value)}
                            className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 appearance-none disabled:opacity-60"
                            required
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
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!isExpired && (
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? '保存中...' : (hasResponded ? '回答を更新する' : '回答を送信する')}
                  </button>
                </div>
              )}

            </form>
          </div>
        )}

      </main>
    </div>
  );
}