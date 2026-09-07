// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { fetchDictionary } from '@/lib/translation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PageItem {
  path: string;
  page_name: string;
  note: string | null;
  display_order: number;
  open: boolean;
  manage: boolean;
}

interface ActiveSurvey {
  id: string;
  survey_type: string;
  title: string;
  deadline: string;
  match_time?: string;
  target_restriction?: string;
}

export default function HomePage() {
  const [lang, setLang] = useState<'ja' | 'en'>('ja');
  const [dict, setDict] = useState<Record<string, string>>({});
  const [dynamicTranslations, setDynamicTranslations] = useState<Record<string, string>>({});
  
  const [pages, setPages] = useState<PageItem[]>([]);
  const [activeSurveys, setActiveSurveys] = useState<ActiveSurvey[]>([]);
  const [loading, setLoading] = useState(true);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [isDiscordUnlinked, setIsDiscordUnlinked] = useState(false);
  const [updatingDiscord, setUpdatingDiscord] = useState(false);

  // 1. 初期ロード時
  useEffect(() => {
    const savedLang = localStorage.getItem('preferred_lang') as 'ja' | 'en';
    if (savedLang) {
      setLang(savedLang);
    }

    fetchDictionary().then((loadedDict) => {
      setDict(loadedDict);
    });
  }, []);

  // 2. ユーザーデータとアンケートの取得
  useEffect(() => {
    const fetchUserDataAndSurveys = async () => {
      try {
        const savedGameId = localStorage.getItem('logged_in_game_id');
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUser = session?.user || null;

        let profileData = null;

        if (savedGameId) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('game_id', savedGameId)
            .single();
          profileData = data;
        } else if (supabaseUser) {
          const providerId = supabaseUser.user_metadata?.sub || supabaseUser.identities?.[0]?.id;
          if (providerId) {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('discord_id', String(providerId))
              .single();
            profileData = data;
          }
          if (!profileData) {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', supabaseUser.id)
              .single();
            profileData = data;
          }
        }

        if (profileData) {
          setUserProfile(profileData);
          const dId = profileData.discord_id;
          const unlinked = !dId || dId.startsWith('no_discord') || dId.startsWith('temp');
          setIsDiscordUnlinked(unlinked);
        }

        let isUserLeader = false;
        if (profileData && profileData.game_id) {
          const { data: memberData } = await supabase
            .from('members')
            .select('leader')
            .eq('game_id', profileData.game_id)
            .maybeSingle();

          if (memberData && memberData.leader === true) {
            isUserLeader = true;
          }
        }

        const roles: string[] = [];
        if (profileData) {
          if (profileData.is_master) roles.push('master');
          if (profileData.is_admin) roles.push('admin');
          if (profileData.is_strategy) roles.push('strategy');
          if (profileData.is_transfer) roles.push('transfer');
          if (profileData.is_member_manager) roles.push('member_manager');
          if (profileData.is_reserve_master) roles.push('reserve_master');
          if (profileData.is_member) roles.push('member');
          if (profileData.is_r4) roles.push('r4');
          if (profileData.is_gen_manage) roles.push('gen_manage');
          if (profileData.is_priority_reserve) roles.push('priority_reserve');
        }

        if (roles.length === 0) roles.push('member');
        const isMaster = roles.includes('master');

        let allowedPaths: string[] = [];
        if (isMaster) {
          allowedPaths = ['*'];
        } else if (roles.length > 0) {
          const { data: permData } = await supabase
            .from('role_permissions')
            .select('path')
            .in('web_role', roles);

          if (permData) {
            allowedPaths = permData.map((p) => p.path);
          }
        }

        const { data: pageData } = await supabase
          .from('page_list')
          .select('*')
          .eq('open', true)
          .order('display_order', { ascending: true });

        if (pageData) {
          const filtered = pageData.filter((page) => {
            if (page.path === '/') return false;
            return isMaster || allowedPaths.includes('*') || allowedPaths.includes(page.path);
          });
          setPages(filtered);
        }

        if (profileData) {
          const nowISO = new Date().toISOString();
          const { data: surveysData } = await supabase
            .from('surveys_master')
            .select('*')
            .gt('deadline', nowISO)
            .order('deadline', { ascending: true });

          if (surveysData) {
            const unansweredSurveys: ActiveSurvey[] = [];
            for (const survey of surveysData) {
              if (survey.target_restriction === 'non_leader_only' && isUserLeader) continue;
              
              const tableName = getAnswerTableName(survey.survey_type);
              let hasAnswered = false;

              if (profileData.game_id && tableName) {
                const { data: ansData } = await supabase
                  .from(tableName)
                  .select('survey_id')
                  .eq('survey_id', survey.id)
                  .eq('game_id', profileData.game_id)
                  .maybeSingle();

                if (ansData) hasAnswered = true;
              }

              if (!hasAnswered) unansweredSurveys.push(survey);
            }
            setActiveSurveys(unansweredSurveys);
          }
        }
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDataAndSurveys();
  }, []);

  // 3. 一括翻訳処理
  useEffect(() => {
    if (lang === 'ja') return;

    const baseTexts = [
      "2275 MANAGER",
      "同盟管理システムへようこそ",
      "Discord連携が完了していません",
      "正確な権限管理や通知のため、Discordアカウントとの連携を行ってください。",
      "処理中...",
      "🎮 Discord連携を行う",
      "未回答",
      "期限: ",
      "回答する →",
      "読み込み中...",
      "アクセス可能なページがありません。",
      "各機能の管理・詳細を行います。",
      "画面を開く →",
      "メンバーの基本情報を入力"
    ];

    const surveyTitles = activeSurveys.map(s => s.title).filter(Boolean);
    const pageNames = pages.map(p => p.page_name).filter(Boolean);
    const pageNotes = pages.map(p => p.note).filter(Boolean);

    const textsToTranslate = Array.from(new Set([...baseTexts, ...surveyTitles, ...pageNames, ...pageNotes]));

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
  }, [lang, dict, activeSurveys, pages]);

  const changeLang = (newLang: 'ja' | 'en') => {
    localStorage.setItem('preferred_lang', newLang);
    setLang(newLang);
    window.dispatchEvent(new Event('preferred_lang_changed'));
  };

  const handleLinkDiscord = async () => {
    try {
      setUpdatingDiscord(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (err: any) {
      alert(`Discord連携に失敗しました: ${err.message || '不明なエラー'}`);
      setUpdatingDiscord(false);
    }
  };

  const getAnswerTableName = (surveyType: string) => {
    switch (surveyType) {
      case 'weapon_schedule': return 'survey_responses_tal_schedule';
      case 'weapon_entry': return 'survey_responses_tal_entry';
      case 'svs': return 'survey_responses_svs';
      case 'frost_dragon': return 'survey_responses_ftd';
      case 'hero_skill': return 'survey_responses_hero_skill';
      default: return null;
    }
  };

  const getAnswerUrl = (surveyType: string, surveyId: string) => {
    switch (surveyType) {
      case 'weapon_schedule': return `/surveys/answer/tal_schedule/${surveyId}`;
      case 'weapon_entry': return `/surveys/answer/tal_entry/${surveyId}`;
      case 'svs': return `/surveys/answer/svs/${surveyId}`;
      case 'frost_dragon': return `/surveys/answer/ftd/${surveyId}`;
      case 'hero_skill': return `/surveys/answer/hero_skill/${surveyId}`;
      default: return `/surveys/answer/${surveyId}`;
    }
  };

  const formatDeadline = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  };

  // 翻訳関数（1. 翻訳テーブル優先 -> 2. 個別ハードコード -> 3. 自動翻訳）
  const t = (text: string | null | undefined) => {
    if (!text) return '';
    if (lang === 'ja') return text;

    if (lang === 'en') {
      // 1. 翻訳テーブルに登録があれば最優先で採用
      if (dict[text]) {
        return dict[text];
      }

      // 2. 個別のハードコードフォールバック（Discord is not connectedに変更）
      if (text === '同盟管理システムへようこそ') return 'Welcome to the Alliance Management System';
      if (text === 'Discord連携が完了していません') return 'Discord is not connected';
      if (text === '正確な権限管理や通知のため、Discordアカウントとの連携を行ってください。') return 'Please connect your Discord account for accurate permission management and notifications.';
      if (text === '処理中...') return 'Processing...';
      if (text === '🎮 Discord連携を行う') return '🎮 Connect Discord';
      if (text === '画面を開く →') return 'Open Screen →';
      if (text === '未回答') return 'Unanswered';
      if (text === '期限: ') return 'Deadline: ';
      if (text === '回答する →') return 'Answer →';
      
      // アンケートタイトルのフォールバック例
      if (text.includes('SvS参加アンケート')) return text.replace('SvS参加アンケート', 'SvS Participation Survey');
      if (text.includes('英雄スキルLv5アンケート')) return text.replace('英雄スキルLv5アンケート', 'Hero Skill Lv5 Survey');
    }

    // 3. テーブルになければ自動翻訳結果、それもなければ元のテキストを返す
    return dynamicTranslations[text] || text;
  };

  return (
    <div className="w-full bg-[#0b0f19] text-slate-100 flex-1 flex flex-col">
      <div className="max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* 言語切替ボタン（カプセル型のトグルスイッチ） */}
        <div className="flex justify-end">
          <div className="flex bg-[#151c2c] border border-slate-800 rounded-xl p-1 shadow">
            <button
              onClick={() => changeLang('ja')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'ja'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              日本語
            </button>
            <button
              onClick={() => changeLang('en')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'en'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              English
            </button>
          </div>
        </div>

        <section className="bg-[#151c2c] border border-slate-800/80 rounded-2xl p-8 text-center shadow-xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            {t("2275 MANAGER")}
          </h1>
          <p className="text-slate-400 text-sm md:text-base">
            {t("同盟管理システムへようこそ")}
          </p>
        </section>

        {!loading && isDiscordUnlinked && (
          <section className="bg-gradient-to-r from-indigo-950/40 via-[#151c2c] to-[#151c2c] border border-indigo-500/30 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-indigo-300 tracking-wide uppercase">
                {t("Discord連携が完了していません")}
              </h2>
              <p className="text-xs text-slate-400">
                {t("正確な権限管理や通知のため、Discordアカウントとの連携を行ってください。")}
              </p>
            </div>
            <button
              onClick={handleLinkDiscord}
              disabled={updatingDiscord}
              className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-bold transition shadow shrink-0 cursor-pointer disabled:opacity-50"
            >
              {updatingDiscord ? t("処理中...") : t("🎮 Discord連携を行う")}
            </button>
          </section>
        )}

        {!loading && activeSurveys.length > 0 && (
          <section className="bg-gradient-to-r from-amber-950/40 via-[#151c2c] to-[#151c2c] border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-amber-300 tracking-wide uppercase">
              {lang === 'ja'
                ? `回答済みでないアンケートがあります (${activeSurveys.length}件)`
                : `You have unanswered surveys (${activeSurveys.length})`}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeSurveys.map((survey) => (
                <div
                  key={survey.id}
                  className="bg-[#0b0f19]/80 border border-slate-800 hover:border-amber-500/50 rounded-xl p-4 flex items-center justify-between gap-4 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/50 rounded text-[10px] font-semibold">
                        {t("未回答")}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {t("期限: ")}{formatDeadline(survey.deadline)}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{t(survey.title)}</h3>
                  </div>
                  <Link
                    href={getAnswerUrl(survey.survey_type, survey.id)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition shadow shrink-0"
                  >
                    {t("回答する →")}
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          {loading ? (
            <div className="text-center py-12 text-slate-500">{t("読み込み中...")}</div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-[#151c2c]/50 rounded-xl border border-slate-800">
              {t("アクセス可能なページがありません。")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pages.map((page) => (
                <Link
                  key={page.path}
                  href={page.path}
                  className="group bg-[#151c2c] hover:bg-[#1b2438] border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-6 transition-all duration-200 shadow-md flex flex-col justify-between gap-6 cursor-pointer"
                >
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                      {t(page.page_name)}
                    </h2>
                    <p className="text-slate-400 text-xs md:text-sm line-clamp-2 min-h-[2rem]">
                      {t(page.note) || t("各機能の管理・詳細を行います。")}
                    </p>
                  </div>
                  <div className="text-cyan-400 text-xs font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    {t("画面を開く →")}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}