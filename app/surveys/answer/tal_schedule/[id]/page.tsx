'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';

type SurveyMaster = {
  id: string;
  survey_type: string;
  title: string;
  event_date: string | null;
  match_time: string | null; // 追加: 時刻情報
  deadline: string;
  status: string;
};

type MemberData = {
  game_id: string;
};

// 辞書データ
const t = {
  ja: {
    loading: '読み込み中...',
    notFound: 'アンケートが見つかりませんでした。',
    expiredBadge: '受付終了',
    activeBadge: '受付中',
    respondedBadge: '回答送信完了',
    deadlineLabel: '回答期日',
    successTitle: '✅ 回答が送信されました',
    successDesc: 'ご回答ありがとうございます。以下の内容で登録されています。',
    editButton: '内容を修正する',
    myResponseTitle: 'あなたの回答内容',
    gameIdLabel: '回答ゲームID',
    matchScheduleLabel: '[対戦日] 参加予定',
    vcLabel: 'VC参加(聞き専)について',
    noteLabel: '備考（参加可能時間）',
    currentLoginId: '回答中のゲームID: ',
    cancelToResult: 'キャンセルして結果に戻る',
    matchRequired: '[対戦日] ({date}) の参加予定を教えてください。',
    vcRequired: 'VC参加(聞き専)について教えてください。',
    requiredMark: '*回答必須',
    notePlaceholder: '参加可能時間を入力してください',
    submitting: '保存中...',
    updateButton: '回答を更新する',
    submitButton: '回答を送信する',
    eventNotSet: '日時未設定',
    statusFull: '① フル参加',
    statusPart: '② 途中参加',
    statusNone: '③ 不参加',
    alertExpired: '受付期限が終了しているため、回答・修正はできません。',
    alertNoLogin: 'ログイン中のゲームIDが見つかりません。再度ログインしてください。',
    alertNoId: 'ログイン中のゲームIDが取得できませんでした。',
    alertMatchNote: '対戦日で「途中参加」が選択されていますが、備考欄（参加可能時間）が入力されていません。',
    alertVcNote: 'VC参加で「途中参加」が選択されていますが、備考欄（参加可能時間）が入力されていません。',
    alertSubmitError: (msg: string) => `送信エラー: ${msg}`,
    translateTitle: (title: string) => title,
  },
  en: {
    loading: 'Loading...',
    notFound: 'Survey not found.',
    expiredBadge: 'Closed',
    activeBadge: 'Active',
    respondedBadge: 'Response Submitted',
    deadlineLabel: 'Deadline (UTC)',
    successTitle: '✅ Response Submitted Successfully',
    successDesc: 'Thank you for your response. It has been registered as follows.',
    editButton: 'Edit Response',
    myResponseTitle: 'Your Response',
    gameIdLabel: 'Game ID',
    matchScheduleLabel: '[Match Date] Participation Schedule',
    vcLabel: 'VC Participation (Listen-only)',
    noteLabel: 'Note (Available Time)',
    currentLoginId: 'Logged-in Game ID: ',
    cancelToResult: 'Cancel and Return',
    matchRequired: 'Please let us know your participation schedule for [Match Date] ({date}).',
    vcRequired: 'Please let us know about your VC participation (listen-only).',
    requiredMark: '*Required',
    notePlaceholder: 'Please enter your available time',
    submitting: 'Saving...',
    updateButton: 'Update Response',
    submitButton: 'Submit Response',
    eventNotSet: 'Date not set',
    statusFull: '① Full Participation',
    statusPart: '② Partial Participation',
    statusNone: '③ Not Participating',
    alertExpired: 'The deadline has passed. You cannot submit or edit responses.',
    alertNoLogin: 'Logged-in Game ID not found. Please log in again.',
    alertNoId: 'Could not retrieve the logged-in Game ID.',
    alertMatchNote: 'Partial participation is selected for the match date, but the note (available time) is empty.',
    alertVcNote: 'Partial participation is selected for VC, but the note (available time) is empty.',
    alertSubmitError: (msg: string) => `Submission Error: ${msg}`,
    translateTitle: (title: string) => {
      let translated = title;
      translated = translated.replace(/兵器リーグ参戦予定確認アンケート/g, 'Arms League Participation Schedule Survey');
      translated = translated.replace(/兵器リーグ/g, 'Arms League');
      translated = translated.replace(/参戦予定確認アンケート/g, 'Participation Schedule Survey');
      translated = translated.replace(/アンケート/g, 'Survey');
      return translated;
    },
  },
};

export default function TalScheduleSurveyAnswerPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [lang, setLang] = useState<'ja' | 'en'>('ja');
  const dict = t[lang];

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const [hasResponded, setHasResponded] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [matchStatus, setMatchStatus] = useState<string>('1');
  const [matchNote, setMatchNote] = useState<string>('');

  const [vcStatus, setVcStatus] = useState<string>('1');
  const [vcNote, setVcNote] = useState<string>('');

  const [savedResponse, setSavedResponse] = useState<any>(null);

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
          throw new Error(dict.alertNoLogin);
        }

        const { data: memberData } = await supabase
          .from('members')
          .select('game_id')
          .eq('game_id', currentLoginGameId)
          .single();

        if (memberData) {
          setMember(memberData);
        } else {
          setMember({ game_id: currentLoginGameId });
        }

        const { data: responseData } = await supabase
          .from('survey_responses_tal_schedule')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('game_id', currentLoginGameId)
          .single();

        if (responseData) {
          setHasResponded(true);
          setSavedResponse(responseData);

          if (responseData.match_status) setMatchStatus(responseData.match_status);
          if (responseData.match_note) setMatchNote(responseData.match_note);
          if (responseData.vc_status) setVcStatus(responseData.vc_status);
          if (responseData.vc_note) setVcNote(responseData.vc_note);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExpired) {
      alert(dict.alertExpired);
      return;
    }

    if (!member?.game_id) {
      alert(dict.alertNoId);
      return;
    }

    if (matchStatus === '2' && !matchNote.trim()) {
      alert(dict.alertMatchNote);
      return;
    }

    if (vcStatus === '2' && !vcNote.trim()) {
      alert(dict.alertVcNote);
      return;
    }

    setSubmitting(true);
    try {
      const surveyResponsePayload = {
        survey_id: surveyId,
        game_id: member.game_id,
        match_status: matchStatus,
        match_note: matchStatus === '2' ? matchNote : null,
        vc_status: vcStatus,
        vc_note: vcStatus === '2' ? vcNote : null,
      };

      const { data: upsertData, error: surveyResponseError } = await supabase
        .from('survey_responses_tal_schedule')
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
      alert(dict.alertSubmitError(error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">{dict.loading}</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">{dict.notFound}</p>
      </div>
    );
  }

  // 期限のフォーマット表示（英語表記の時はUTCに変換）
  const formatDeadline = (dateStr: string, isEnglish: boolean) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    if (isEnglish) {
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const min = String(d.getUTCMinutes()).padStart(2, '0');
      return `${mm}/${dd} ${hh}:${min} UTC`;
    } else {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${mm}/${dd} ${hh}:${min}`;
    }
  };

  // イベント日時のフォーマット表示（event_date と match_time を結合し、英語表記の時はUS時刻/UTCに変換）
  const formatEventDateTime = (dateStr: string | null, timeStr: string | null, isEnglish: boolean) => {
    if (!dateStr) return dict.eventNotSet;
    
    // 日付部分のパース
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const utcmm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const utcdd = String(d.getUTCDate()).padStart(2, '0');

    // 時刻が指定されている場合
    if (timeStr) {
      // timeStr は "21:00" などの形式を想定
      const [hoursStr, minutesStr] = timeStr.split(':');
      let h = parseInt(hoursStr, 10);
      const m = minutesStr || '00';

      if (isEnglish) {
        // 日本時間(JST = UTC+9)の時刻と仮定してUTC時刻に変換する場合、あるいは単純にUS時刻(UTC)に換算する場合
        // ※ 通常 JST から -9 時間で UTC を算出します
        const totalMinutes = h * 60 + parseInt(m, 10) - 9 * 60;
        let utcH = Math.floor((totalMinutes + 1440) % 1440 / 60);
        let utcM = Math.abs(totalMinutes % 60);
        const utcHStr = String(utcH).padStart(2, '0');
        const utcMStr = String(utcM).padStart(2, '0');
        return `${utcmm}/${utcdd} ${utcHStr}:${utcMStr} UTC`;
      } else {
        const hStr = String(h).padStart(2, '0');
        return `${mm}/${dd} ${hStr}:${m}`;
      }
    } else {
      // 時刻が未設定の場合は従来通り（またはデフォルト時刻）
      if (isEnglish) {
        return `${utcmm}/${utcdd} 00:00 UTC`;
      } else {
        return `${mm}/${dd} 00:00`;
      }
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case '1': return dict.statusFull;
      case '2': return dict.statusPart;
      case '3': return dict.statusNone;
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1000px] mx-auto p-6 w-full space-y-6 flex flex-col">
        
        {/* 言語切り替えバー */}
        <div className="flex justify-end">
          <div className="bg-[#151c2c] border border-slate-800 rounded-lg p-1 flex gap-1">
            <button
              type="button"
              onClick={() => setLang('ja')}
              className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                lang === 'ja' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              日本語
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                lang === 'en' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* ヘッダー情報 */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                isExpired 
                  ? 'bg-rose-950 text-rose-400 border-rose-800/50' 
                  : 'bg-cyan-950 text-cyan-400 border-cyan-800/50'
              }`}>
                {isExpired ? dict.expiredBadge : dict.activeBadge}
              </span>
              {hasResponded && !isEditing && (
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded-lg text-xs font-semibold">
                  {dict.respondedBadge}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">
              {dict.deadlineLabel}: {formatDeadline(survey.deadline, lang === 'en')}
            </span>
          </div>

          {/* アンケートタイトル */}
          <h1 className="text-2xl font-bold text-white">
            {lang === 'en' && survey.event_date ? (() => {
              const d = new Date(survey.event_date);
              const mm = String(d.getUTCMonth() + 1);
              const dd = String(d.getUTCDate());
              const baseTitle = dict.translateTitle(survey.title);
              return baseTitle.replace(/^\d{1,2}\/\d{1,2}\s*/, `${mm}/${dd} `);
            })() : dict.translateTitle(survey.title)}
          </h1>
        </div>

        {hasResponded && !isEditing ? (
          <div className="space-y-6">
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <span>{dict.successTitle}</span>
                </div>
                <p className="text-xs text-slate-300">
                  {dict.successDesc}
                </p>
              </div>

              {!isExpired && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer"
                >
                  {dict.editButton}
                </button>
              )}
            </div>

            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">
                {dict.myResponseTitle}
              </h2>

              <div className="space-y-4 text-xs">
                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">{dict.gameIdLabel}</span>
                  <p className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</p>
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2">
                  <span className="text-slate-400 block font-semibold">
                    {dict.matchScheduleLabel} ({formatEventDateTime(survey.event_date, survey.match_time, lang === 'en')})
                  </span>
                  <p className="text-white font-medium text-sm">{getStatusLabel(savedResponse?.match_status)}</p>
                  {savedResponse?.match_status === '2' && savedResponse?.match_note && (
                    <p className="text-xs text-slate-300 pt-1 border-t border-slate-800">
                      {dict.noteLabel}: {savedResponse.match_note}
                    </p>
                  )}
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2">
                  <span className="text-slate-400 block font-semibold">{dict.vcLabel}</span>
                  <p className="text-white font-medium text-sm">{getStatusLabel(savedResponse?.vc_status)}</p>
                  {savedResponse?.vc_status === '2' && savedResponse?.vc_note && (
                    <p className="text-xs text-slate-300 pt-1 border-t border-slate-800">
                      {dict.noteLabel}: {savedResponse.vc_note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl bg-[#151c2c] shadow-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <div className="flex items-center justify-between bg-[#0b0f19] border border-slate-800 p-4 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400">{dict.currentLoginId}</span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</span>
                </div>
                {hasResponded && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-slate-400 hover:text-white underline text-xs cursor-pointer"
                  >
                    {dict.cancelToResult}
                  </button>
                )}
              </div>

              {/* [対戦日]の参加予定 */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  {dict.matchRequired.replace('{date}', formatEventDateTime(survey.event_date, survey.match_time, lang === 'en'))} <span className="text-rose-400">{dict.requiredMark}</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: '1', label: dict.statusFull },
                    { id: '2', label: dict.statusPart },
                    { id: '3', label: dict.statusNone },
                  ].map((item) => (
                    <button
                      type="button"
                      disabled={isExpired}
                      key={item.id}
                      onClick={() => setMatchStatus(item.id)}
                      className={`p-3 rounded-xl text-xs font-medium border text-left transition ${
                        isExpired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        matchStatus === item.id
                          ? 'bg-cyan-600 border-cyan-500 text-white'
                          : 'bg-[#0b0f19] border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {matchStatus === '2' && (
                  <div className="space-y-1 pt-2">
                    <label className="block text-[11px] text-slate-400">
                      {dict.noteLabel} <span className="text-rose-400">{dict.requiredMark}</span>
                    </label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={matchNote}
                      onChange={(e) => setMatchNote(e.target.value)}
                      placeholder={dict.notePlaceholder}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                      required
                    />
                  </div>
                )}
              </div>

              {/* VC参加について */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-200">
                  {dict.vcRequired} <span className="text-rose-400">{dict.requiredMark}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: '1', label: dict.statusFull },
                    { id: '2', label: dict.statusPart },
                    { id: '3', label: dict.statusNone },
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
                  <div className="space-y-1 pt-2">
                    <label className="block text-[11px] text-slate-400">
                      {dict.noteLabel} <span className="text-rose-400">{dict.requiredMark}</span>
                    </label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={vcNote}
                      onChange={(e) => setVcNote(e.target.value)}
                      placeholder={dict.notePlaceholder}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                      required
                    />
                  </div>
                )}
              </div>

              {!isExpired && (
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? dict.submitting : (hasResponded ? dict.updateButton : dict.submitButton)}
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