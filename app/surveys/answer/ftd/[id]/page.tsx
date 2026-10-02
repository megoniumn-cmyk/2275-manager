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
  main_game_id?: string;
  name?: string;
};

export default function FtdSurveyAnswerPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [member, setMember] = useState<MemberData | null>(null);
  const [accounts, setAccounts] = useState<MemberData[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // 言語切替用ステート ('ja' or 'en')
  const [lang, setLang] = useState<'ja' | 'en'>('ja');
  
  // リザルト画面表示フラグ ＆ 修正モードフラグ
  const [hasResponded, setHasResponded] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // フォームの状態
  const [participationType, setParticipationType] = useState<string>('1');
  const [slot20, setSlot20] = useState<boolean>(false);
  const [slot21, setSlot21] = useState<boolean>(false);
  const [slot22, setSlot22] = useState<boolean>(false);
  const [slot23, setSlot23] = useState<boolean>(false);
  const [slot24, setSlot24] = useState<boolean>(false);
  const [slot25, setSlot25] = useState<boolean>(false);

  const [timeSlotMemo, setTimeSlotMemo] = useState<string>('');
  const [vcStatus, setVcStatus] = useState<string>('1');
  const [vcMemo, setVcMemo] = useState<string>('');

  const [fcLevel, setFcLevel] = useState<string>('FC10');
  const [powerNum, setPowerNum] = useState<string>('');
  const [powerUnit, setPowerUnit] = useState<string>('B');
  const [shieldSoldier, setShieldSoldier] = useState<string>('FC10T11');
  const [spearSoldier, setSpearSoldier] = useState<string>('FC10T11');
  const [bowSoldier, setBowSoldier] = useState<string>('FC10T11');

  // 保存されたデータのスナップショット
  const [savedResponse, setSavedResponse] = useState<any>(null);

  // 初回マウント時：アンケート情報の取得とアカウント一覧の構築
  useEffect(() => {
    async function initMaster() {
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
          throw new Error(lang === 'en' ? 'Logged-in Game ID not found. Please log in again.' : 'ログイン中のゲームIDが見つかりません。再度ログインしてください。');
        }

        // 1. 自身のメンバー情報を取得
        const { data: myMember, error: myMemberError } = await supabase
          .from('members')
          .select('*')
          .eq('game_id', currentLoginGameId)
          .single();

        if (myMemberError && myMemberError.code !== 'PGRST116') throw myMemberError;

        const mainId = myMember?.main_game_id || currentLoginGameId;

        // 2. メインアカウントが共通する（main_game_id が一致する）アカウント一覧を取得
        const { data: accountsData, error: accountsError } = await supabase
          .from('members')
          .select('*')
          .or(`game_id.eq.${mainId},main_game_id.eq.${mainId}`);

        if (accountsError) throw accountsError;

        const fetchedAccounts = accountsData || [];
        setAccounts(fetchedAccounts);

        // 初期選択IDの設定（未選択ならログイン中のID）
        if (fetchedAccounts.some(acc => acc.game_id === currentLoginGameId)) {
          setSelectedGameId(currentLoginGameId);
        } else if (fetchedAccounts.length > 0) {
          setSelectedGameId(fetchedAccounts[0].game_id);
        } else {
          setSelectedGameId(currentLoginGameId);
        }

      } catch (error: any) {
        console.error(error);
        alert(error.message || (lang === 'en' ? 'Failed to fetch data.' : 'データの取得に失敗しました。'));
      } finally {
        setLoading(false);
      }
    }

    initMaster();
  }, [surveyId, lang]);

  // selectedGameId が変更されるたびに、該当アカウントのメンバー情報および回答状況を再取得・反映
  useEffect(() => {
    async function fetchAccountData() {
      if (!surveyId || !selectedGameId) return;

      setLoading(true);
      try {
        const { data: memberData } = await supabase
          .from('members')
          .select('*')
          .eq('game_id', selectedGameId)
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
          setMember({ game_id: selectedGameId });
        }

        const { data: responseData } = await supabase
          .from('survey_responses_ftd')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('game_id', selectedGameId)
          .single();

        if (responseData) {
          setHasResponded(true);
          setSavedResponse(responseData);

          if (responseData.participation_type) setParticipationType(responseData.participation_type);
          setSlot20(!!responseData.slot_20);
          setSlot21(!!responseData.slot_21);
          setSlot22(!!responseData.slot_22);
          setSlot23(!!responseData.slot_23);
          setSlot24(!!responseData.slot_24);
          setSlot25(!!responseData.slot_25);
          if (responseData.time_slot_memo) setTimeSlotMemo(responseData.time_slot_memo);
          if (responseData.vc_status) setVcStatus(responseData.vc_status);
          if (responseData.vc_memo) setVcMemo(responseData.vc_memo);

          if (responseData.snapshot_fc_level) setFcLevel(responseData.snapshot_fc_level);
          if (responseData.snapshot_power) {
            const match = responseData.snapshot_power.match(/^([0-9.]+)([BM]?)$/i);
            if (match) {
              setPowerNum(match[1]);
              if (match[2]) setPowerUnit(match[2].toUpperCase());
            } else {
              setPowerNum(responseData.snapshot_power);
            }
          }
          if (responseData.snapshot_shield_soldier) setShieldSoldier(responseData.snapshot_shield_soldier);
          if (responseData.snapshot_spear_soldier) setSpearSoldier(responseData.snapshot_spear_soldier);
          if (responseData.snapshot_bow_soldier) setBowSoldier(responseData.snapshot_bow_soldier);
        } else {
          setHasResponded(false);
          setSavedResponse(null);
          // 未回答時のフォーム初期値リセットが必要であればここで調整
          setParticipationType('1');
          setSlot20(false);
          setSlot21(false);
          setSlot22(false);
          setSlot23(false);
          setSlot24(false);
          setSlot25(false);
          setTimeSlotMemo('');
          setVcStatus('1');
          setVcMemo('');
        }

      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchAccountData();
  }, [selectedGameId, surveyId]);

  const isExpired = survey ? new Date() > new Date(survey.deadline) : false;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExpired) {
      alert(lang === 'en' ? 'The deadline has passed. You cannot submit or edit.' : '受付期限が終了しているため、回答・修正はできません。');
      return;
    }

    if (participationType === '3') {
      const hasSlotSelected = slot20 || slot21 || slot22 || slot23 || slot24 || slot25;
      if (!hasSlotSelected) {
        alert(lang === 'en' ? 'Please select at least one time slot.' : '「参加可能時間を選択してください」の項目で、少なくとも1つの時間帯を選択してください。');
        return;
      }
    }

    if (!member?.game_id) {
      alert(lang === 'en' ? 'Selected Game ID could not be retrieved.' : '選択中のゲームIDが取得できませんでした。');
      return;
    }

    setSubmitting(true);
    try {
      const fullPower = powerNum ? `${powerNum}${powerUnit}` : null;

      const finalFcLevel = member?.fc_level === 'FC10' ? 'FC10' : fcLevel;
      const finalPower = fullPower || member?.current_power || null;
      
      const finalShield = member?.shield_soldier === 'FC10T11' ? 'FC10T11' : shieldSoldier;
      const finalSpear = member?.spear_soldier === 'FC10T11' ? 'FC10T11' : spearSoldier;
      const finalBow = member?.bow_soldier === 'FC10T11' ? 'FC10T11' : bowSoldier;

      // 参加タイプに応じたスロットの自動設定ロジック
      let s20 = false, s21 = false, s22 = false, s23 = false, s24 = false, s25 = false;
      if (participationType === '1') {
        s20 = true; s21 = true; s22 = true; s23 = true; s24 = true; s25 = true;
      } else if (participationType === '2') {
        s20 = false; s21 = true; s22 = true; s23 = true; s24 = true; s25 = true;
      } else if (participationType === '3') {
        s20 = slot20; s21 = slot21; s22 = slot22; s23 = slot23; s24 = slot24; s25 = slot25;
      } else if (participationType === '4') {
        s20 = false; s21 = false; s22 = false; s23 = false; s24 = false; s25 = false;
      }

      if (participationType !== '4') {
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
        survey_type: survey?.survey_type || 'ftd',
        event_date: survey?.event_date || null,
        participation_type: participationType,
        
        slot_20: s20,
        slot_21: s21,
        slot_22: s22,
        slot_23: s23,
        slot_24: s24,
        slot_25: s25,

        time_slot_memo: participationType === '3' ? timeSlotMemo : null,
        vc_status: participationType !== '4' ? vcStatus : null,
        vc_memo: (participationType !== '4' && vcStatus === '2') ? vcMemo : null,

        snapshot_fc_level: finalFcLevel,
        snapshot_power: finalPower,
        snapshot_shield_soldier: finalShield,
        snapshot_spear_soldier: finalSpear,
        snapshot_bow_soldier: finalBow,
      };

      const { data: upsertData, error: surveyResponseError } = await supabase
        .from('survey_responses_ftd')
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
      alert(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !survey) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">{lang === 'en' ? 'Loading...' : '読み込み中...'}</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">{lang === 'en' ? 'Survey not found.' : 'アンケートが見つかりませんでした。'}</p>
      </div>
    );
  }

  const getTranslatedTitle = (title: string) => {
    if (lang === 'en') {
      let translated = title;
      translated = translated.replace(/霜竜の覇者参加アンケート/g, 'Frostdragon Tyrant Participation Survey');
      translated = translated.replace(/霜竜の覇者/g, 'Frostdragon Tyrant');
      translated = translated.replace(/参加アンケート/g, 'Participation Survey');
      translated = translated.replace(/アンケート/g, 'Survey');
      return translated;
    }
    return title;
  };

  const getParticipationLabel = (type: string) => {
    if (lang === 'en') {
      switch(type) {
        case '1': return '① Full participation (including relocation time)';
        case '2': return '② Full participation (combat time only)';
        case '3': return '③ Partial participation';
        case '4': return '④ Non-participation';
        default: return type;
      }
    } else {
      switch(type) {
        case '1': return '① フル参加(移転予定時間含む)';
        case '2': return '② フル参加(戦闘時間のみ)';
        case '3': return '③ 途中参加';
        case '4': return '④ 不参加';
        default: return type;
      }
    }
  };

  const getVcLabel = (status: string) => {
    if (lang === 'en') {
      switch(status) {
        case '1': return '① Full VC participation';
        case '2': return '② Participate during specific hours only';
        case '3': return '③ No VC participation';
        default: return status;
      }
    } else {
      switch(status) {
        case '1': return '① VCフル参加';
        case '2': return '② 一部の時間のみ参加';
        case '3': return '③ VC不参加';
        default: return status;
      }
    }
  };

  const allSoldiersMax = 
    member?.shield_soldier === 'FC10T11' && 
    member?.spear_soldier === 'FC10T11' && 
    member?.bow_soldier === 'FC10T11';

  const formattedDeadline = lang === 'en' 
    ? new Date(survey.deadline).toUTCString() 
    : new Date(survey.deadline).toLocaleString('ja-JP');

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1000px] mx-auto p-6 w-full space-y-6 flex flex-col">
        
        {/* 言語切替ボタン */}
        <div className="flex justify-end">
          <div className="bg-[#151c2c] border border-slate-800 rounded-lg p-1 flex gap-1">
            <button
              type="button"
              onClick={() => setLang('ja')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${lang === 'ja' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              日本語
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${lang === 'en' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              English
            </button>
          </div>
        </div>

        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                isExpired 
                  ? 'bg-rose-950 text-rose-400 border-rose-800/50' 
                  : 'bg-cyan-950 text-cyan-400 border-cyan-800/50'
              }`}>
                {isExpired ? (lang === 'en' ? 'Closed' : '受付終了') : (lang === 'en' ? 'Open' : '受付中')}
              </span>
              {hasResponded && !isEditing && (
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded-lg text-xs font-semibold">
                  {lang === 'en' ? 'Submitted' : '回答送信完了'}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">
              {lang === 'en' ? 'Deadline (UTC): ' : '回答期限: '}{formattedDeadline}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">{getTranslatedTitle(survey.title)}</h1>

          {/* アカウント切替UI（セレクトボックス） */}
          {accounts.length > 0 && (
            <div className="pt-3 border-t border-slate-800/80 flex items-center gap-3 flex-wrap">
              <label className="text-xs font-semibold text-slate-300">
                {lang === 'en' ? 'Select Account:' : 'アカウント切り替え:'}
              </label>
              <select
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                className="bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.game_id} value={acc.game_id}>
                    {acc.name ? `${acc.name} (${acc.game_id})` : acc.game_id}
                    {acc.game_id === localStorage.getItem('logged_in_game_id') ? (lang === 'en' ? ' [Main]' : ' [メイン]') : (lang === 'en' ? ' [Sub]' : ' [サブ]')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {hasResponded && !isEditing ? (
          <div className="space-y-6">
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <span>{lang === 'en' ? '✅ Response submitted successfully' : '✅ 回答が送信されました'}</span>
                </div>
                <p className="text-xs text-slate-300">
                  {lang === 'en' ? 'Thank you for your response. Registered with the following contents.' : 'ご回答ありがとうございます。以下の内容で登録されています。'}
                </p>
              </div>

              {!isExpired && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer"
                >
                  {lang === 'en' ? 'Edit Response' : '内容を修正する'}
                </button>
              )}
            </div>

            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">
                {lang === 'en' ? 'Your Response' : 'あなたの回答内容'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">{lang === 'en' ? 'Game ID' : '回答ゲームID'}</span>
                  <p className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</p>
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">{lang === 'en' ? 'Scheduled Participation' : '参加予定時間'}</span>
                  <p className="font-semibold text-white">
                    {getParticipationLabel(savedResponse?.participation_type)}
                  </p>
                </div>

                {savedResponse?.participation_type === '3' && (
                  <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2 md:col-span-2">
                    <span className="text-slate-400">{lang === 'en' ? 'Selected Time Slots' : '選択した時間帯'}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {savedResponse?.slot_20 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '11:00 range' : '20時台'}</span>}
                      {savedResponse?.slot_21 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '12:00 range' : '21時台'}</span>}
                      {savedResponse?.slot_22 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '13:00 range' : '22時台'}</span>}
                      {savedResponse?.slot_23 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '14:00 range' : '23時台'}</span>}
                      {savedResponse?.slot_24 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '15:00 range' : '24時台'}</span>}
                      {savedResponse?.slot_25 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '16:00 range' : '25時台'}</span>}
                    </div>
                    {savedResponse?.time_slot_memo && (
                      <p className="text-slate-300 mt-2 text-[11px]">{lang === 'en' ? 'Memo: ' : '備考: '}{savedResponse.time_slot_memo}</p>
                    )}
                  </div>
                )}

                {savedResponse?.participation_type !== '4' && (
                  <>
                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{lang === 'en' ? 'VC Participation Status' : 'VC参加状況'}</span>
                      <p className="font-semibold text-white">
                        {getVcLabel(savedResponse?.vc_status)}
                      </p>
                      {savedResponse?.vc_memo && (
                        <p className="text-slate-300 text-[11px]">{lang === 'en' ? 'Note: ' : '補足: '}{savedResponse.vc_memo}</p>
                      )}
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{lang === 'en' ? 'Furnace Level' : '溶鉱炉Lv'}</span>
                      <p className="font-semibold text-white">{savedResponse?.snapshot_fc_level || '-'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{lang === 'en' ? 'Power' : '総力'}</span>
                      <p className="font-mono font-semibold text-white">{savedResponse?.snapshot_power || '-'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2 md:col-span-2">
                      <span className="text-slate-400">{lang === 'en' ? 'Soldier Level' : '兵士Lv'}</span>
                      <div className="grid grid-cols-3 gap-2 text-white">
                        <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">{lang === 'en' ? 'Shield' : '盾兵'}</span>
                          <span className="font-semibold">{savedResponse?.snapshot_shield_soldier || '-'}</span>
                        </div>
                        <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">{lang === 'en' ? 'Spear' : '槍兵'}</span>
                          <span className="font-semibold">{savedResponse?.snapshot_spear_soldier || '-'}</span>
                        </div>
                        <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">{lang === 'en' ? 'Bow' : '弓兵'}</span>
                          <span className="font-semibold">{savedResponse?.snapshot_bow_soldier || '-'}</span>
                        </div>
                      </div>
                    </div>
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
                  <span className="text-slate-400">{lang === 'en' ? 'Answering Game ID: ' : '回答中のゲームID: '}</span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</span>
                </div>
                {hasResponded && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-slate-400 hover:text-white underline text-xs cursor-pointer"
                  >
                    {lang === 'en' ? 'Cancel and return to results' : 'キャンセルして結果に戻る'}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  {lang === 'en' ? 'Please let us know your planned participation schedule.' : '参加予定時間を教えてください。'} <span className="text-rose-400">{lang === 'en' ? '*Required' : '*回答必須'}</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: '1', label: lang === 'en' ? '① Full participation (including relocation time)' : '① フル参加(移転予定時間含む)' },
                    { id: '2', label: lang === 'en' ? '② Full participation (combat time only)' : '② フル参加(戦闘時間のみ)' },
                    { id: '3', label: lang === 'en' ? '③ Partial participation' : '③ 途中参加' },
                    { id: '4', label: lang === 'en' ? '④ Non-participation' : '④ 不参加' },
                  ].map((item) => (
                    <button
                      type="button"
                      disabled={isExpired}
                      key={item.id}
                      onClick={() => setParticipationType(item.id)}
                      className={`p-3 rounded-xl text-xs font-medium border text-left transition ${
                        isExpired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        participationType === item.id
                          ? 'bg-cyan-600 border-cyan-500 text-white'
                          : 'bg-[#0b0f19] border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {participationType === '3' && (
                <div className="bg-[#0b0f19] border border-cyan-900/40 p-5 rounded-xl space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-cyan-300 mb-2">
                      {lang === 'en' ? 'Select available time slots (multiple choices allowed)' : '参加可能時間を選択してください（複数選択可）'} <span className="text-rose-400">{lang === 'en' ? '*Required' : '*回答必須'}</span>
                    </label>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {[
                        { label: lang === 'en' ? '11:00 range' : '20時台', val: slot20, set: setSlot20 },
                        { label: lang === 'en' ? '12:00 range' : '21時台', val: slot21, set: setSlot21 },
                        { label: '13:00 range', val: slot22, set: setSlot22 },
                        { label: '14:00 range', val: slot23, set: setSlot23 },
                        { label: '15:00 range', val: slot24, set: setSlot24 },
                        { label: '16:00 range', val: slot25, set: setSlot25 },
                      ].map((item, idx) => {
                        const displayLabel = lang === 'en' ? item.label : (['20時台', '21時台', '22時台', '23時台', '24時台', '25時台'][idx]);
                        return (
                          <label key={displayLabel} className={`flex items-center gap-2 bg-[#151c2c] border border-slate-700 p-2.5 rounded-lg text-xs ${isExpired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-slate-500'}`}>
                            <input
                              type="checkbox"
                              disabled={isExpired}
                              checked={item.val}
                              onChange={(e) => item.set(e.target.checked)}
                              className="accent-cyan-500"
                            />
                            {displayLabel}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {lang === 'en' ? 'Memo (Additional info about participation time)' : '備考欄（参加時間について補足）'} <span className="text-slate-500 font-normal">{lang === 'en' ? '(Optional)' : '（任意）'}</span>
                    </label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={timeSlotMemo}
                      onChange={(e) => setTimeSlotMemo(e.target.value)}
                      placeholder={lang === 'en' ? 'e.g., Can join around 12:30 UTC' : '例: 21時半頃から入れます'}
                      className="w-full bg-[#151c2c] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              {participationType !== '4' && (
                <>
                  <div className="space-y-3 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      {lang === 'en' ? 'Can you participate in VC for all scheduled times above? (Including listen-only)' : '上で回答した参加予定時間、全時間でVC参加可能ですか。(聞き専含む)'} <span className="text-rose-400">{lang === 'en' ? '*Required' : '*回答必須'}</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { id: '1', label: lang === 'en' ? '① Full VC participation' : '① VCフル参加' },
                        { id: '2', label: lang === 'en' ? '② Participate during specific hours only' : '② 一部の時間のみ参加' },
                        { id: '3', label: lang === 'en' ? '③ No VC participation' : '③ VC不参加' },
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

                    {vcStatus === '2' && (
                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-cyan-300 mb-1">
                          {lang === 'en' ? 'Please enter available hours' : '参加可能時間を入力してください'} <span className="text-rose-400">{lang === 'en' ? '*Required' : '*回答必須'}</span>
                        </label>
                        <input
                          type="text"
                          disabled={isExpired}
                          value={vcMemo}
                          onChange={(e) => setVcMemo(e.target.value)}
                          placeholder={lang === 'en' ? 'e.g., Available from 12:00 to 14:00 UTC' : '例: 21時〜23時のみ参加可能'}
                          className="w-full bg-[#0b0f19] border border-cyan-900/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {member?.fc_level !== 'FC10' && (
                    <div className="space-y-2 pt-4 border-t border-slate-800">
                      <label className="block text-xs font-semibold text-slate-200">
                        {lang === 'en' ? 'Please enter your Furnace Level.' : '溶鉱炉Lvを回答してください。'} <span className="text-rose-400">{lang === 'en' ? '*Required' : '*回答必須'}</span>
                        <span className="block text-[11px] text-slate-400 font-normal mt-0.5">
                        {lang === 'en' ? 'If you selected FC10 in previous answers, this question will not be shown.' : '過去の回答でFC10を選択している場合、設問は表示されません。'}
                      </span>
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
                      {lang === 'en' ? 'Please enter your Power.' : '総力を入力してください。'} <span className="text-rose-400">{lang === 'en' ? '*Required' : '*回答必須'}</span>
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

                  {!allSoldiersMax && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      <p className="text-xs font-semibold text-slate-200">
                        {lang === 'en' ? 'Please enter your Soldier Level (if unlocking before the event, enter the expected level)' : '兵士Lvを回答してください（霜竜の覇者当日までに解放する場合は、解放予定後の兵士Lvで回答）'} <span className="text-rose-400">{lang === 'en' ? '*Required' : '*回答必須'}</span>
                        <span className="block text-[11px] text-slate-400 font-normal mt-0.5">
                        {lang === 'en' ? 'If you selected FC10T11 in previous answers, this question will not be shown.' : '過去の回答でFC10T11を選択している場合、設問は表示されません。'}
                      </span>
                      </p>

                      {member?.shield_soldier !== 'FC10T11' && (
                        <div className="space-y-1">
                          <label className="block text-[11px] text-slate-400">{lang === 'en' ? '・Shield Soldier ' : '・盾兵 '}<span className="text-rose-400">*</span></label>
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
                      )}

                      {member?.spear_soldier !== 'FC10T11' && (
                        <div className="space-y-1">
                          <label className="block text-[11px] text-slate-400">{lang === 'en' ? '・Spear Soldier ' : '・槍兵 '}<span className="text-rose-400">*</span></label>
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
                      )}

                      {member?.bow_soldier !== 'FC10T11' && (
                        <div className="space-y-1">
                          <label className="block text-[11px] text-slate-400">{lang === 'en' ? '・Bow Soldier ' : '・弓兵 '}<span className="text-rose-400">*</span></label>
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
                      )}
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
                    {submitting 
                      ? (lang === 'en' ? 'Saving...' : '保存中...') 
                      : (hasResponded 
                          ? (lang === 'en' ? 'Update Response' : '回答を更新する') 
                          : (lang === 'en' ? 'Submit Response' : '回答を送信する'))}
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