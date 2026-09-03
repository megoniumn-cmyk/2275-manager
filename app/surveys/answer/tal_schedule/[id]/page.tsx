'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';

type SurveyMaster = {
  id: string;
  survey_type: string;
  title: string;
  event_date: string | null; // アンケート作成画面で設定された試合日・時間
  deadline: string;
  status: string;
};

type MemberData = {
  game_id: string;
};

export default function TalScheduleSurveyAnswerPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const [hasResponded, setHasResponded] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // 1日分の参加予定ステータスと備考
  const [matchStatus, setMatchStatus] = useState<string>('1');
  const [matchNote, setMatchNote] = useState<string>('');

  // VC参加状況
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
          throw new Error('ログイン中のゲームIDが見つかりません。再度ログインしてください。');
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

        // 既存回答の取得
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
      alert('受付期限が終了しているため、回答・修正はできません。');
      return;
    }

    if (!member?.game_id) {
      alert('ログイン中のゲームIDが取得できませんでした。');
      return;
    }

    // バリデーション：対戦日で「②途中参加」を選んでいる場合、備考欄が空でないかチェック
    if (matchStatus === '2' && !matchNote.trim()) {
      alert('対戦日で「途中参加」が選択されていますが、備考欄（参加可能時間）が入力されていません。');
      return;
    }

    // バリデーション：VC参加で「②途中参加」を選んでいる場合、備考欄が空でないかチェック
    if (vcStatus === '2' && !vcNote.trim()) {
      alert('VC参加で「途中参加」が選択されていますが、備考欄（参加可能時間）が入力されていません。');
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

  // 期限のフォーマット表示用 (mm/dd hh:mm)
  const formatDeadline = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  };

  const formatEventDate = (dateStr: string | null) => {
    if (!dateStr) return '日時未設定';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case '1': return '① フル参加';
      case '2': return '② 途中参加';
      case '3': return '③ 不参加';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1000px] mx-auto p-6 w-full space-y-6 flex flex-col">
        
        {/* ヘッダー情報 */}
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
              回答期日: {formatDeadline(survey.deadline)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">{survey.title}</h1>
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

              <div className="space-y-4 text-xs">
                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">回答ゲームID</span>
                  <p className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</p>
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2">
                  <span className="text-slate-400 block font-semibold">[対戦日] 参加予定 ({formatEventDate(survey.event_date)})</span>
                  <p className="text-white font-medium text-sm">{getStatusLabel(savedResponse?.match_status)}</p>
                  {savedResponse?.match_status === '2' && savedResponse?.match_note && (
                    <p className="text-xs text-slate-300 pt-1 border-t border-slate-800">
                      備考（参加可能時間）: {savedResponse.match_note}
                    </p>
                  )}
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2">
                  <span className="text-slate-400 block font-semibold">VC参加(聞き専)について</span>
                  <p className="text-white font-medium text-sm">{getStatusLabel(savedResponse?.vc_status)}</p>
                  {savedResponse?.vc_status === '2' && savedResponse?.vc_note && (
                    <p className="text-xs text-slate-300 pt-1 border-t border-slate-800">
                      備考（参加可能時間）: {savedResponse.vc_note}
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

              {/* [対戦日]の参加予定 */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  [対戦日] ({formatEventDate(survey.event_date)}) の参加予定を教えてください。 <span className="text-rose-400">*回答必須</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: '1', label: '① フル参加' },
                    { id: '2', label: '② 途中参加' },
                    { id: '3', label: '③ 不参加' },
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

                {/* ②途中参加を選んだ場合のみ備考欄を表示 */}
                {matchStatus === '2' && (
                  <div className="space-y-1 pt-2">
                    <label className="block text-[11px] text-slate-400">
                      備考（参加可能時間） <span className="text-rose-400">*回答必須</span>
                    </label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={matchNote}
                      onChange={(e) => setMatchNote(e.target.value)}
                      placeholder="参加可能時間を入力してください"
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                      required
                    />
                  </div>
                )}
              </div>

              {/* VC参加について */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-200">
                  VC参加(聞き専)について教えてください。 <span className="text-rose-400">*回答必須</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: '1', label: '① フル参加' },
                    { id: '2', label: '② 途中参加' },
                    { id: '3', label: '③ 不参加' },
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

                {/* ②途中参加を選んだ場合のみ備考欄を表示 */}
                {vcStatus === '2' && (
                  <div className="space-y-1 pt-2">
                    <label className="block text-[11px] text-slate-400">
                      備考（参加可能時間） <span className="text-rose-400">*回答必須</span>
                    </label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={vcNote}
                      onChange={(e) => setVcNote(e.target.value)}
                      placeholder="参加可能時間を入力してください"
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