// app/surveys/answer/svs/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { fetchDictionary } from '@/lib/translation';

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

export default function SurveyAnswerPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [lang, setLang] = useState<'ja' | 'en'>('ja');
  const [dict, setDict] = useState<Record<string, string>>({});
  const [dynamicTranslations, setDynamicTranslations] = useState<Record<string, string>>({});

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
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

  const [savedResponse, setSavedResponse] = useState<any>(null);

  // 1. 初期ロード（言語設定・辞書データ・アンケート＆回答データ取得）
  useEffect(() => {
    const savedLang = localStorage.getItem('preferred_lang') as 'ja' | 'en';
    if (savedLang) setLang(savedLang);

    fetchDictionary().then((loadedDict) => {
      setDict(loadedDict);
    });

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
          .from('survey_responses_svs')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('game_id', currentLoginGameId)
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
        }

      } catch (error: any) {
        console.error(error);
        alert(error.message || 'データの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [surveyId]);

  // 2. 動的翻訳の補完処理
  useEffect(() => {
    if (lang === 'ja') return;

    const baseTexts = [
      "読み込み中...",
      "アンケートが見つかりませんでした。",
      "受付終了",
      "受付中",
      "回答送信完了",
      "回答期限: ",
      "✅ 回答が送信されました",
      "ご回答ありがとうございます。以下の内容で登録されています。",
      "内容を修正する",
      "あなたの回答内容",
      "回答ゲームID",
      "参加予定時間",
      "選択した時間帯",
      "備考: ",
      "VC参加状況",
      "補足: ",
      "溶鉱炉Lv",
      "総力",
      "兵士Lv",
      "盾兵",
      "槍兵",
      "弓兵",
      "キャンセルして結果に戻る",
      "参加予定時間を教えてください。",
      "*回答必須",
      "① フル参加(移転予定時間含む)",
      "② フル参加(戦闘時間のみ)",
      "③ 途中参加",
      "④ 不参加",
      "参加可能時間を選択してください（複数選択可）",
      "備考欄（参加時間について補足）",
      "（任意）",
      "例: 12時半頃から入れます",
      "上で回答した参加予定時間、全時間でVC参加可能ですか。(聞き専含む)",
      "① VCフル参加",
      "② 一部の時間のみ参加",
      "③ VC不参加",
      "参加可能時間を入力してください",
      "例: 12時〜14時のみ参加可能",
      "溶鉱炉Lvを回答してください。",
      "過去の回答でFC10を選択している場合、設問は表示されません。",
      "総力を入力してください。",
      "例: 1.1",
      "兵士Lvを回答してください（SvS当日までに解放する場合は解放予定後で回答）",
      "過去の回答でFC10T11を選択している場合、設問は表示されません。",
      "・盾兵", "・槍兵", "・弓兵",
      "保存中...",
      "回答を更新する",
      "回答を送信する",
      "受付期限が終了しているため、回答・修正はできません。",
      "ログイン中のゲームIDが取得できませんでした。",
      "「参加可能時間を選択してください」の項目で、少なくとも1つの時間帯を選択してください。"
    ];

    const surveyTitle = survey?.title ? [survey.title] : [];
    const textsToTranslate = Array.from(new Set([...baseTexts, ...surveyTitle]));

    let isMounted = true;

    const translateBatch = async () => {
      const newMap: Record<string, string> = { ...dynamicTranslations };
      let hasNew = false;

      for (const text of textsToTranslate) {
        if (!text) continue;

        if (dict[text]) {
          newMap[text] = dict[text];
          hasNew = true;
          continue;
        }

        if (newMap[text]) continue;

        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, lang }),
          });
          const data = await res.json();
          if (data.translatedText) {
            newMap[text] = data.translatedText;
            hasNew = true;
          }
        } catch (e) {
          console.error('Translation error:', e);
        }
      }

      if (isMounted && hasNew) {
        setDynamicTranslations({ ...newMap });
      }
    };

    if (textsToTranslate.length > 0) {
      translateBatch();
    }

    return () => {
      isMounted = false;
    };
  }, [lang, dict, survey]);

  const isExpired = survey ? new Date() > new Date(survey.deadline) : false;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExpired) {
      alert(lang === 'en' ? 'The deadline has passed, so you cannot answer or edit.' : '受付期限が終了しているため、回答・修正はできません。');
      return;
    }

    if (participationType === '3') {
      const hasSlotSelected = slot20 || slot21 || slot22 || slot23 || slot24 || slot25;
      if (!hasSlotSelected) {
        alert(lang === 'en' ? 'Please select at least one time slot in "Select available time slots".' : '「参加可能時間を選択してください」の項目で、少なくとも1つの時間帯を選択してください。');
        return;
      }
    }

    if (!member?.game_id) {
      alert(lang === 'en' ? 'Logged-in game ID could not be retrieved.' : 'ログイン中のゲームIDが取得できませんでした。');
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

      // 参加タイプに応じたスロットのON/OFF判定
      let s20 = false;
      let s21 = false;
      let s22 = false;
      let s23 = false;
      let s24 = false;
      let s25 = false;

      if (participationType === '1') {
        s20 = true;
        s21 = true;
        s22 = true;
        s23 = true;
        s24 = true;
        s25 = true;
      } else if (participationType === '2') {
        s20 = false;
        s21 = true;
        s22 = true;
        s23 = true;
        s24 = true;
        s25 = true;
      } else if (participationType === '3') {
        s20 = slot20;
        s21 = slot21;
        s22 = slot22;
        s23 = slot23;
        s24 = slot24;
        s25 = slot25;
      } else {
        s20 = false;
        s21 = false;
        s22 = false;
        s23 = false;
        s24 = false;
        s25 = false;
      }

      const surveyResponsePayload: any = {
        survey_id: surveyId,
        game_id: member.game_id,
        survey_type: survey?.survey_type || 'svs',
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
        .from('survey_responses_svs')
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

  // 翻訳用ヘルパー関数
  const t = (text: string | null | undefined) => {
    if (!text) return '';
    if (lang === 'ja') return text;

    if (lang === 'en') {
      if (dict[text]) return dict[text];

      // アンケートタイトルの特殊変換・フォールバック対応
      if (text.includes("参加アンケート")) {
        return text.replace("参加アンケート", " SvS Participation Survey");
      }

      if (text === "受付終了") return "Closed";
      if (text === "受付中") return "Active";
      if (text === "回答送信完了") return "Submitted";
      if (text === "回答期限: ") return "Deadline: ";
      if (text === "✅ 回答が送信されました") return "✅ Response submitted successfully";
      if (text === "ご回答ありがとうございます。以下の内容で登録されています。") return "Thank you for your response. It has been registered.";
      if (text === "内容を修正する") return "Edit Response";
      if (text === "あなたの回答内容") return "Your Response";
      if (text === "回答ゲームID") return "Game ID";
      if (text === "参加予定時間") return "Scheduled Participation Time";
      if (text === "選択した時間帯") return "Selected Time Slots";
      if (text === "備考: ") return "Note: ";
      if (text === "VC参加状況") return "VC Status";
      if (text === "補足: ") return "Supplementary: ";
      if (text === "溶鉱炉Lv") return "Furnace Lv";
      if (text === "総力") return "Power";
      if (text === "兵士Lv") return "Soldier Lv";
      if (text === "盾兵") return "Shield";
      if (text === "槍兵") return "Spear";
      if (text === "弓兵") return "Bow";
      if (text === "キャンセルして結果に戻る") return "Cancel and Return";
      if (text === "参加予定時間を教えてください。") return "Please let us know your planned participation time.";
      if (text === "*回答必須") return "*Required";
      if (text === "① フル参加(移転予定時間含む)") return "① Full participation (including relocation time)";
      if (text === "② フル参加(戦闘時間のみ)") return "② Full participation (combat time only)";
      if (text === "③ 途中参加") return "③ Partial participation (join midway)";
      if (text === "④ 不参加") return "④ Not participating";
      if (text === "参加可能時間を選択してください（複数選択可）") return "Select available time slots (multiple choices allowed)";
      if (text === "備考欄（参加時間について補足）") return "Remarks (supplementary info on participation time)";
      if (text === "（任意）") return "(Optional)";
      if (text === "例: 12時半頃から入れます") return "e.g., Can join around 12:30";
      if (text === "上で回答した参加予定時間、全時間でVC参加可能ですか。(聞き専含む)") return "Are you available for VC during all scheduled participation times? (Including listen-only)";
      if (text === "① VCフル参加") return "① Full VC participation";
      if (text === "② 一部の時間のみ参加") return "② Partial VC participation";
      if (text === "③ VC不参加") return "③ No VC participation";
      if (text === "参加可能時間を入力してください") return "Please enter available time";
      if (text === "例: 12時〜14時のみ参加可能") return "e.g., Available only from 12:00 to 14:00";
      if (text === "溶鉱炉Lvを回答してください。") return "Please answer your Furnace Lv.";
      if (text === "過去の回答でFC10を選択している場合、設問は表示されません。") return "This question is not displayed if FC10 was selected previously.";
      if (text === "総力を入力してください。") return "Please enter your power.";
      if (text === "例: 1.1") return "e.g., 1.1";
      if (text === "兵士Lvを回答してください（SvS当日までに解放する場合は解放予定後で回答）") return "Please answer your Soldier Lv (if unlocking before SvS day, answer based on expected unlock)";
      if (text === "過去の回答でFC10T11を選択している場合、設問は表示されません。") return "This question is not displayed if FC10T11 was selected previously.";
      if (text === "・盾兵") return "・Shield";
      if (text === "・槍兵") return "・Spear";
      if (text === "・弓兵") return "・Bow";
      if (text === "保存中...") return "Saving...";
      if (text === "回答を更新する") return "Update Response";
      if (text === "回答を送信する") return "Submit Response";
    }

    return dynamicTranslations[text] || text;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">{t("読み込み中...")}</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">{t("アンケートが見つかりませんでした。")}</p>
      </div>
    );
  }

  const formatDeadline = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    if (lang === 'en') {
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

  const getParticipationLabel = (type: string) => {
    switch(type) {
      case '1': return t('① フル参加(移転予定時間含む)');
      case '2': return t('② フル参加(戦闘時間のみ)');
      case '3': return t('③ 途中参加');
      case '4': return t('④ 不参加');
      default: return type;
    }
  };

  const getVcLabel = (status: string) => {
    switch(status) {
      case '1': return t('① VCフル参加');
      case '2': return t('② 一部の時間のみ参加');
      case '3': return t('③ VC不参加');
      default: return status;
    }
  };

  // 時間帯スロットのラベル定義（日本語・英語切り替え対応）
  const timeSlotOptions = [
    { label: lang === 'en' ? '11:00 range' : '20:00台', val: slot20, set: setSlot20 },
    { label: lang === 'en' ? '12:00 range' : '21:00台', val: slot21, set: setSlot21 },
    { label: lang === 'en' ? '13:00 range' : '22:00台', val: slot22, set: setSlot22 },
    { label: lang === 'en' ? '14:00 range' : '23:00台', val: slot23, set: setSlot23 },
    { label: lang === 'en' ? '15:00 range' : '24:00台', val: slot24, set: setSlot24 },
    { label: lang === 'en' ? '16:00 range' : '25:00台', val: slot25, set: setSlot25 },
  ];

  const allSoldiersMax = 
    member?.shield_soldier === 'FC10T11' && 
    member?.spear_soldier === 'FC10T11' && 
    member?.bow_soldier === 'FC10T11';

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
                {isExpired ? t("受付終了") : t("受付中")}
              </span>
              {hasResponded && !isEditing && (
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded-lg text-xs font-semibold">
                  {t("回答送信完了")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-[#0b0f19] border border-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (lang !== 'ja') {
                      setLang('ja');
                      localStorage.setItem('preferred_lang', 'ja');
                    }
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    lang === 'ja'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  日本語
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (lang !== 'en') {
                      setLang('en');
                      localStorage.setItem('preferred_lang', 'en');
                    }
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    lang === 'en'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  English
                </button>
              </div>
              <span className="text-xs text-slate-400">
                {t("回答期限: ")}{formatDeadline(survey.deadline)}
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">{t(survey.title)}</h1>
        </div>

        {hasResponded && !isEditing ? (
          <div className="space-y-6">
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <span>{t("✅ 回答が送信されました")}</span>
                </div>
                <p className="text-xs text-slate-300">
                  {t("ご回答ありがとうございます。以下の内容で登録されています。")}
                </p>
              </div>

              {!isExpired && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer"
                >
                  {t("内容を修正する")}
                </button>
              )}
            </div>

            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">
                {t("あなたの回答内容")}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">{t("回答ゲームID")}</span>
                  <p className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</p>
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">{t("参加予定時間")}</span>
                  <p className="font-semibold text-white">
                    {getParticipationLabel(savedResponse?.participation_type)}
                  </p>
                </div>

                {savedResponse?.participation_type === '3' && (
                  <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2 md:col-span-2">
                    <span className="text-slate-400">{t("選択した時間帯")}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {savedResponse?.slot_20 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '11:00 range' : '20:00台'}</span>}
                      {savedResponse?.slot_21 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '12:00 range' : '21:00台'}</span>}
                      {savedResponse?.slot_22 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '13:00 range' : '22:00台'}</span>}
                      {savedResponse?.slot_23 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '14:00 range' : '23:00台'}</span>}
                      {savedResponse?.slot_24 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '15:00 range' : '24:00台'}</span>}
                      {savedResponse?.slot_25 && <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">{lang === 'en' ? '16:00 range' : '25:00台'}</span>}
                    </div>
                    {savedResponse?.time_slot_memo && (
                      <p className="text-slate-300 mt-2 text-[11px]">{t("備考: ")}{savedResponse.time_slot_memo}</p>
                    )}
                  </div>
                )}

                {savedResponse?.participation_type !== '4' && (
                  <>
                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{t("VC参加状況")}</span>
                      <p className="font-semibold text-white">
                        {getVcLabel(savedResponse?.vc_status)}
                      </p>
                      {savedResponse?.vc_memo && (
                        <p className="text-slate-300 text-[11px]">{t("補足: ")}{savedResponse.vc_memo}</p>
                      )}
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{t("溶鉱炉Lv")}</span>
                      <p className="font-semibold text-white">{savedResponse?.snapshot_fc_level || '-'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{t("総力")}</span>
                      <p className="font-mono font-semibold text-white">{savedResponse?.snapshot_power || '-'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2 md:col-span-2">
                      <span className="text-slate-400">{t("兵士Lv")}</span>
                      <div className="grid grid-cols-3 gap-2 text-white">
                        <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">{t("盾兵")}</span>
                          <span className="font-semibold">{savedResponse?.snapshot_shield_soldier || '-'}</span>
                        </div>
                        <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">{t("槍兵")}</span>
                          <span className="font-semibold">{savedResponse?.snapshot_spear_soldier || '-'}</span>
                        </div>
                        <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">{t("弓兵")}</span>
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
                  <span className="text-slate-400">{t("回答中のゲームID: ")}</span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">{member?.game_id}</span>
                </div>
                {hasResponded && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-slate-400 hover:text-white underline text-xs cursor-pointer"
                  >
                    {t("キャンセルして結果に戻る")}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  {t("参加予定時間を教えてください。")} <span className="text-rose-400">{t("*回答必須")}</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: '1', label: t('① フル参加(移転予定時間含む)') },
                    { id: '2', label: t('② フル参加(戦闘時間のみ)') },
                    { id: '3', label: t('③ 途中参加') },
                    { id: '4', label: t('④ 不参加') },
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
                      {t("参加可能時間を選択してください（複数選択可）")} <span className="text-rose-400">{t("*回答必須")}</span>
                    </label>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {timeSlotOptions.map((item) => (
                        <label key={item.label} className={`flex items-center gap-2 bg-[#151c2c] border border-slate-700 p-2.5 rounded-lg text-xs ${isExpired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-slate-500'}`}>
                          <input
                            type="checkbox"
                            disabled={isExpired}
                            checked={item.val}
                            onChange={(e) => item.set(e.target.checked)}
                            className="accent-cyan-500"
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t("備考欄（参加時間について補足）")} <span className="text-slate-500 font-normal">{t("（任意）")}</span>
                    </label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={timeSlotMemo}
                      onChange={(e) => setTimeSlotMemo(e.target.value)}
                      placeholder={t("例: 12時半頃から入れます")}
                      className="w-full bg-[#151c2c] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              {participationType !== '4' && (
                <>
                  <div className="space-y-3 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      {t("上で回答した参加予定時間、全時間でVC参加可能ですか。(聞き専含む)")} <span className="text-rose-400">{t("*回答必須")}</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { id: '1', label: t('① VCフル参加') },
                        { id: '2', label: t('② 一部の時間のみ参加') },
                        { id: '3', label: t('③ VC不参加') },
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
                          {t("参加可能時間を入力してください")} <span className="text-rose-400">{t("*回答必須")}</span>
                        </label>
                        <input
                          type="text"
                          disabled={isExpired}
                          value={vcMemo}
                          onChange={(e) => setVcMemo(e.target.value)}
                          placeholder={t("例: 12時〜14時のみ参加可能")}
                          className="w-full bg-[#0b0f19] border border-cyan-900/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {member?.fc_level !== 'FC10' && (
                    <div className="space-y-2 pt-4 border-t border-slate-800">
                      <label className="block text-xs font-semibold text-slate-200">
                        {t("溶鉱炉Lvを回答してください。")} <span className="text-rose-400">{t("*回答必須")}</span>
                        <span className="block text-[11px] text-slate-400 font-normal mt-0.5">
                        {t("過去の回答でFC10を選択している場合、設問は表示されません。")}
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
                          <option value="FC6以上">{t("FC6以上")}</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      {t("総力を入力してください。")} <span className="text-rose-400">{t("*回答必須")}</span>
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
                        placeholder={t("例: 1.1")}
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
                        {t("兵士Lvを回答してください（SvS当日までに解放する場合は解放予定後で回答）")} <span className="text-rose-400">{t("*回答必須")}</span>
                        <span className="block text-[11px] text-slate-400 font-normal mt-0.5">
                        {t("過去の回答でFC10T11を選択している場合、設問は表示されません。")}
                      </span>
                      </p>

                      {member?.shield_soldier !== 'FC10T11' && (
                        <div className="space-y-1">
                          <label className="block text-[11px] text-slate-400">{t("・盾兵")} <span className="text-rose-400">*</span></label>
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
                          <label className="block text-[11px] text-slate-400">{t("・槍兵")} <span className="text-rose-400">*</span></label>
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
                          <label className="block text-[11px] text-slate-400">{t("・弓兵")} <span className="text-rose-400">*</span></label>
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
                    {submitting ? t('保存中...') : (hasResponded ? t('回答を更新する') : t('回答を送信する'))}
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