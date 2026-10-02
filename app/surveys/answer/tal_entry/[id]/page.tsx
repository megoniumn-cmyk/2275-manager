// app/surveys/answer/tal_entry/[id]/page.tsx
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
  nickname?: string;
  fc_level?: string;
  current_power?: string;
  shield_soldier?: string;
  spear_soldier?: string;
  bow_soldier?: string;
  main_game_id?: string;
};

export default function TalSurveyAnswerPage() {
  const params = useParams();
  const surveyId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

  const [lang, setLang] = useState<'ja' | 'en'>('ja');
  const [dict, setDict] = useState<Record<string, string>>({});
  const [dynamicTranslations, setDynamicTranslations] = useState<Record<string, string>>({});

  const [survey, setSurvey] = useState<SurveyMaster | null>(null);
  
  // アカウント管理用ステート
  const [availableAccounts, setAvailableAccounts] = useState<MemberData[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  
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

  // 1. 初期ロード（言語設定・辞書データ・アンケート＆アカウント一覧取得）
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

        // メインおよび main_game_id が一致するサブアカウント一覧を取得
        const { data: mainMember, error: mainError } = await supabase
          .from('members')
          .select('*')
          .eq('game_id', currentLoginGameId)
          .single();

        if (mainError) throw mainError;

        const { data: subMembers, error: subError } = await supabase
          .from('members')
          .select('*')
          .eq('main_game_id', currentLoginGameId);

        if (subError) throw subError;

        const allAccounts = [mainMember, ...(subMembers || [])].filter(Boolean);
        setAvailableAccounts(allAccounts);
        setSelectedGameId(currentLoginGameId);

      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [surveyId]);

  // 2. 選択されたアカウント（selectedGameId）が変更された際のデータ（メンバー情報・既存回答）の非同期再取得
  useEffect(() => {
    if (!selectedGameId || !surveyId) return;

    async function fetchAccountData() {
      try {
        // メンバー情報の反映
        const matchedMember = availableAccounts.find(m => m.game_id === selectedGameId);
        if (matchedMember) {
          setMember(matchedMember);
          if (matchedMember.fc_level) setFcLevel(matchedMember.fc_level);
          else setFcLevel('FC9');
          if (matchedMember.shield_soldier) setShieldSoldier(matchedMember.shield_soldier);
          else setShieldSoldier('FC10T11');
          if (matchedMember.spear_soldier) setSpearSoldier(matchedMember.spear_soldier);
          else setSpearSoldier('FC10T11');
          if (matchedMember.bow_soldier) setBowSoldier(matchedMember.bow_soldier);
          else setBowSoldier('FC10T11');
          
          if (matchedMember.current_power) {
            const match = matchedMember.current_power.match(/^([0-9.]+)([BM]?)$/i);
            if (match) {
              setPowerNum(match[1]);
              if (match[2]) setPowerUnit(match[2].toUpperCase());
            } else {
              setPowerNum(matchedMember.current_power);
            }
          } else {
            setPowerNum('');
          }
        } else {
          setMember({ game_id: selectedGameId });
        }

        // 該当アカウントの既存回答を取得
        const { data: responseData } = await supabase
          .from('survey_responses_tal_entry')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('game_id', selectedGameId)
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
        } else {
          setHasResponded(false);
          setSavedResponse(null);
          setEntryStatus('yes');
          setCombatPower('');
          setScheduleAnswers({ 0: '1', 1: '1', 2: '1', 3: '1', 4: '1', 5: '1', 6: '1' });
          setVcStatus('1');
        }

      } catch (error) {
        console.error(error);
      }
    }

    fetchAccountData();
  }, [selectedGameId, surveyId, availableAccounts]);

  // 3. 動的翻訳の補完処理
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
      "エントリー希望",
      "溶鉱炉Lv",
      "部隊戦闘力",
      "総力",
      "VC参加状況",
      "各日程の参加予定",
      "兵士Lv",
      "盾兵",
      "槍兵",
      "弓兵",
      "キャンセルして結果に戻る",
      "エントリー希望しますか",
      "*回答必須",
      "① 希望する",
      "② 希望しない",
      "過去の回答でFC10を選択している場合、設問は表示されません。",
      "部隊戦闘力を入力してください。",
      "例: 13000",
      "それぞれの参加予定について回答してください。",
      "の予定",
      "④ 途中参加",
      "⑤ 不参加",
      "VC参加(聞き専含む)について回答してください。",
      "① 全部VC参加可能",
      "② 一部VC参加不可",
      "③ VC参加不可",
      "総力を入力してください。",
      "例: 1.1",
      "兵士Lvを回答してください（SvS当日までに解放する場合は、解放予定後の兵士Lvで回答）",
      "保存中...",
      "回答を更新する",
      "回答を送信する",
      "初戦の日付: ",
      "操作アカウント選択: "
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

  const changeLang = (newLang: 'ja' | 'en') => {
    setLang(newLang);
    localStorage.setItem('preferred_lang', newLang);
  };

  const getTargetDates = (baseDateStr: string | null) => {
    const dates: string[] = [];
    const base = baseDateStr ? new Date(baseDateStr) : new Date();
    if (isNaN(base.getTime())) {
      base.setTime(new Date().getTime());
    }
    for (let i = 0; i <= 12; i += 2) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(`${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
    }
    return dates;
  };

  const targetDates = getTargetDates(survey?.event_date || null);

  const isExpired = survey ? new Date() > new Date(survey.deadline) : false;

  const isAllFc10T11 = shieldSoldier === 'FC10T11' && spearSoldier === 'FC10T11' && bowSoldier === 'FC10T11';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExpired) {
      alert(lang === 'en' ? 'The deadline has passed, so you cannot answer or edit.' : '受付期限が終了しているため、回答・修正はできません。');
      return;
    }

    if (!selectedGameId) {
      alert(lang === 'en' ? 'Game ID could not be retrieved.' : 'ゲームIDが取得できませんでした。');
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
          .eq('game_id', selectedGameId);

        if (memberError) throw memberError;
      }

      const surveyResponsePayload: any = {
        survey_id: surveyId,
        game_id: selectedGameId,
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

  const t = (text: string | null | undefined) => {
    if (!text) return '';
    if (lang === 'ja') return text;

    if (lang === 'en') {
      if (dict[text]) return dict[text];

      if (text.includes('兵器リーグ参加アンケート')) {
        let translatedTitle = text.replace(/兵器リーグ参加アンケート/g, 'Arms League Participation Survey');
        translatedTitle = translatedTitle.replace(/\(エントリー\)/g, '(Entry)').replace(/\(ENTRY\)/g, '(Entry)');
        return translatedTitle;
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
      if (text === "エントリー希望") return "Entry Preference";
      if (text === "溶鉱炉Lv") return "Furnace Lv";
      if (text === "部隊戦闘力") return "Combat Power";
      if (text === "総力") return "Power";
      if (text === "VC参加状況") return "VC Status";
      if (text === "各日程の参加予定") return "Schedule per Date";
      if (text === "兵士Lv") return "Soldier Lv";
      if (text === "盾兵") return "Shield";
      if (text === "槍兵") return "Spear";
      if (text === "弓兵") return "Bow";
      if (text === "キャンセルして結果に戻る") return "Cancel and Return";
      if (text === "エントリー希望しますか") return "Would you like to enter?";
      if (text === "*回答必須") return "*Required";
      if (text === "① 希望する") return "① Yes";
      if (text === "② 希望しない") return "② No";
      if (text === "過去の回答でFC10を選択している場合、設問は表示されません。") return "This question is not displayed if FC10 was selected previously.";
      if (text === "部隊戦闘力を入力してください。") return "Please enter your combat power.";
      if (text === "例: 13000") return "e.g., 13000";
      if (text === "それぞれの参加予定について回答してください。") return "Please answer your participation schedule for each date.";
      if (text === "の予定") return "'s Schedule";
      if (text === "④ 途中参加") return "④ Join midway";
      if (text === "⑤ 不参加") return "⑤ Not participating";
      if (text === "VC参加(聞き専含む)について回答してください。") return "Please answer regarding VC participation (including listen-only).";
      if (text === "① 全部VC参加可能") return "① Full VC available";
      if (text === "② 一部VC参加不可") return "② Partial VC unavailable";
      if (text === "③ VC参加不可") return "③ No VC available";
      if (text === "総力を入力してください。") return "Please enter your power.";
      if (text === "例: 1.1") return "e.g., 1.1";
      if (text === "兵士Lvを回答してください（SvS当日までに解放する場合は、解放予定後の兵士Lvで回答）") return "Please answer your Soldier Lv (if unlocking before SvS day, answer based on expected unlock)";
      if (text === "保存中...") return "Saving...";
      if (text === "回答を更新する") return "Update Response";
      if (text === "回答を送信する") return "Submit Response";
      if (text === "初戦の日付: ") return "First match date: ";
      if (text === "操作アカウント選択: ") return "Select Account: ";
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

  const getScheduleLabel = (val: string) => {
    switch(val) {
      case '1': return lang === 'en' ? '① Full 12/14' : '① 21/23時フル';
      case '2': return lang === 'en' ? '② 12 only' : '② 21時のみ';
      case '3': return lang === 'en' ? '③ 12 only' : '③ 23時のみ';
      case '4': return t('④ 途中参加');
      case '5': return t('⑤ 不参加');
      default: return val;
    }
  };

  const getVcLabel = (status: string) => {
    switch(status) {
      case '1': return t('① 全部VC参加可能');
      case '2': return t('② 一部VC参加不可');
      case '3': return t('③ VC参加不可');
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
                {isExpired ? t("受付終了") : t("受付中")}
              </span>
              {hasResponded && !isEditing && (
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded-lg text-xs font-semibold">
                  {t("回答送信完了")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-[#0b0f19] border border-slate-800 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => changeLang('ja')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    lang === 'ja'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  日本語
                </button>
                <button
                  type="button"
                  onClick={() => changeLang('en')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    lang === 'en'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
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
          {survey.event_date && (
            <p className="text-xs text-cyan-400">
              {t("初戦の日付: ")}{lang === 'en' ? new Date(survey.event_date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : new Date(survey.event_date).toLocaleDateString('ja-JP')}
            </p>
          )}

          {/* アカウント切り替えUI */}
          {availableAccounts.length > 0 && (
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-300">{t("操作アカウント選択: ")}</span>
              <select
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                className="bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {availableAccounts.map((acc) => (
                  <option key={acc.game_id} value={acc.game_id}>
                    {acc.game_id} {acc.nickname ? `(${acc.nickname})` : ''} {acc.main_game_id ? '[Sub]' : '[Main]'}
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
                  <p className="font-mono font-bold text-cyan-400 text-sm">{selectedGameId}</p>
                </div>

                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-slate-400">{t("エントリー希望")}</span>
                  <p className="font-semibold text-white">
                    {savedResponse?.entry_status === 'yes' ? t('① 希望する') : t('② 希望しない')}
                  </p>
                </div>

                {savedResponse?.entry_status === 'yes' && (
                  <>
                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{t("溶鉱炉Lv")}</span>
                      <p className="font-semibold text-white">{savedResponse?.fc_level || 'FC10 (自動)'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{t("部隊戦闘力")}</span>
                      <p className="font-mono font-semibold text-white">{savedResponse?.combat_power || '-'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{t("総力")}</span>
                      <p className="font-mono font-semibold text-white">{savedResponse?.current_power || '-'}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-400">{t("VC参加状況")}</span>
                      <p className="font-semibold text-white">{getVcLabel(savedResponse?.vc_status)}</p>
                    </div>

                    <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2 md:col-span-2">
                      <span className="text-slate-400">{t("各日程の参加予定")}</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-white">
                        {targetDates.map((dateStr, idx) => (
                          <div key={idx} className="bg-[#151c2c] p-2 rounded border border-slate-700 text-[11px]">
                            <span className="text-cyan-400 font-semibold">{dateStr}{t("の予定")}: </span>
                            <span>{getScheduleLabel(savedResponse?.schedule_answers?.[idx])}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {!(savedResponse?.shield_soldier === 'FC10T11' && savedResponse?.spear_soldier === 'FC10T11' && savedResponse?.bow_soldier === 'FC10T11') && (
                      <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl space-y-2 md:col-span-2">
                        <span className="text-slate-400">{t("兵士Lv")}</span>
                        <div className="grid grid-cols-3 gap-2 text-white">
                          <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">{t("盾兵")}</span>
                            <span className="font-semibold">{savedResponse?.shield_soldier || '-'}</span>
                          </div>
                          <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">{t("槍兵")}</span>
                            <span className="font-semibold">{savedResponse?.spear_soldier || '-'}</span>
                          </div>
                          <div className="bg-[#151c2c] p-2 rounded border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">{t("弓兵")}</span>
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
                  <span className="text-slate-400">{t("回答中のゲームID: ")}</span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">{selectedGameId}</span>
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
                  {t("エントリー希望しますか")} <span className="text-rose-400">{t("*回答必須")}</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'yes', label: t('① 希望する') },
                    { id: 'no', label: t('② 希望しない') },
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
                        {t("溶鉱炉Lvを回答してください。")} <span className="text-rose-400">{t("*回答必須")}</span>
                        <span className="block text-[11px] text-slate-400 font-normal">{t("過去の回答でFC10を選択している場合、設問は表示されません。")}</span>
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
                          <option value="FC6以下">{t("FC6以下")}</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      {t("部隊戦闘力を入力してください。")} <span className="text-rose-400">{t("*回答必須")}</span>
                    </label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={combatPower}
                      onChange={(e) => setCombatPower(e.target.value)}
                      placeholder={t("例: 13000")}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-60"
                      required
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      {t("それぞれの参加予定について回答してください。")} <span className="text-rose-400">{t("*回答必須")}</span>
                    </label>
                    <div className="space-y-3 bg-[#0b0f19] p-4 rounded-xl border border-slate-800">
                      {targetDates.map((dateStr, idx) => (
                        <div key={idx} className="space-y-1.5 pb-3 border-b border-slate-800/60 last:border-0 last:pb-0">
                          <span className="text-xs font-semibold text-cyan-400">{dateStr} {t("の予定")}</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {[
                              { id: '1', label: lang === 'en' ? '① Full 12/14' : '① 21/23時フル' },
                              { id: '2', label: lang === 'en' ? '② 12 only' : '② 21時のみ' },
                              { id: '3', label: lang === 'en' ? '③ 12 only' : '③ 23時のみ' },
                              { id: '4', label: t('④ 途中参加') },
                              { id: '5', label: t('⑤ 不参加') },
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
                      {t("VC参加(聞き専含む)について回答してください。")} <span className="text-rose-400">{t("*回答必須")}</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { id: '1', label: t('① 全部VC参加可能') },
                        { id: '2', label: t('② 一部VC参加不可') },
                        { id: '3', label: t('③ VC参加不可') },
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

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-200">
                        {t("総力を入力してください。")}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        disabled={isExpired}
                        value={powerNum}
                        onChange={(e) => setPowerNum(e.target.value)}
                        placeholder={t("例: 1.1")}
                        className="flex-1 bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-60"
                      />
                      <div className="flex bg-[#0b0f19] border border-slate-700 p-0.5 rounded-xl">
                        {['B', 'M'].map((unit) => (
                          <button
                            type="button"
                            disabled={isExpired}
                            key={unit}
                            onClick={() => setPowerUnit(unit)}
                            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
                              isExpired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            } ${
                              powerUnit === unit
                                ? 'bg-cyan-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200">
                      {t("兵士Lvを回答してください（SvS当日までに解放する場合は、解放予定後の兵士Lvで回答）")}
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0b0f19] p-4 rounded-xl border border-slate-800">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-300 block">{t("盾兵")}</span>
                        <select
                          disabled={isExpired || isAllFc10T11}
                          value={shieldSoldier}
                          onChange={(e) => setShieldSoldier(e.target.value)}
                          className="w-full bg-[#151c2c] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-40"
                        >
                          <option value="FC10T11">FC10T11 (T11解放)</option>
                          <option value="T10">T10</option>
                          <option value="T9">T9以下</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-300 block">{t("槍兵")}</span>
                        <select
                          disabled={isExpired || isAllFc10T11}
                          value={spearSoldier}
                          onChange={(e) => setSpearSoldier(e.target.value)}
                          className="w-full bg-[#151c2c] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-40"
                        >
                          <option value="FC10T11">FC10T11 (T11解放)</option>
                          <option value="T10">T10</option>
                          <option value="T9">T9以下</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-300 block">{t("弓兵")}</span>
                        <select
                          disabled={isExpired || isAllFc10T11}
                          value={bowSoldier}
                          onChange={(e) => setBowSoldier(e.target.value)}
                          className="w-full bg-[#151c2c] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-40"
                        >
                          <option value="FC10T11">FC10T11 (T11解放)</option>
                          <option value="T10">T10</option>
                          <option value="T9">T9以下</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {!isExpired && (
                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? t("保存中...") : hasResponded ? t("回答を更新する") : t("回答を送信する")}
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