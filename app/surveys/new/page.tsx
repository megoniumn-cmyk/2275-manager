'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type SurveyType = {
  id: string;
  name: string;
  requiresDate: boolean;
};

export default function NewSurveyPage() {
  const router = useRouter();

  const surveyTypes: SurveyType[] = [
    { id: 'svs', name: 'SvS参加アンケート', requiresDate: true },
    { id: 'frost_dragon', name: '霜竜の覇者参加アンケート', requiresDate: true },
    { id: 'weapon_entry', name: '兵器リーグ参加アンケート(エントリー)', requiresDate: true },
    { id: 'weapon_schedule', name: '兵器リーグ参戦予定確認アンケート', requiresDate: true },
    { id: 'hero_skill', name: '英雄スキルLv5アンケート', requiresDate: false },
  ];

  const [selectedTypeId, setSelectedTypeId] = useState<string>('svs');
  const [eventDate, setEventDate] = useState<string>('');
  const [matchTime, setMatchTime] = useState<string>('21:00');
  const [deadline, setDeadline] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const currentSurveyType = surveyTypes.find(t => t.id === selectedTypeId) || surveyTypes[0];

  // タイトルの自動生成
  const getAutoTitle = () => {
    const typeName = currentSurveyType.name;
    if (!currentSurveyType.requiresDate || !eventDate) {
      return typeName;
    }
    
    const [year, month, day] = eventDate.split('-');
    const formattedDate = month && day ? `${parseInt(month)}/${parseInt(day)}` : eventDate;
    
    return `${formattedDate} ${typeName}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const generatedTitle = getAutoTitle();
      const commonId = crypto.randomUUID(); // 共通id（自動発番のUUID）
      const nowIso = new Date().toISOString(); // アンケート作成日時のタイムスタンプ

      // 1. surveys_master テーブル用ペイロード
      const insertPayload: any = {
        id: commonId,
        survey_type: selectedTypeId,
        title: generatedTitle,
        event_date: currentSurveyType.requiresDate && eventDate ? eventDate : null,
        deadline: new Date(deadline).toISOString(),
        status: 'open',
      };

      if (selectedTypeId === 'weapon_schedule') {
        insertPayload.match_time = matchTime;
      }

      // 英雄スキルLv5のアンケートを選んだ場合、リーダー以外だけが回答する設定を付与
      if (selectedTypeId === 'hero_skill') {
        insertPayload.target_restriction = 'non_leader_only';
      }

      // surveys_master テーブルへインサート
      const { error: surveyError } = await supabase.from('surveys_master').insert([insertPayload]);
      if (surveyError) throw new Error(`surveys_master 登録エラー: ${surveyError.message}`);

      // 2. 指定された3つのアンケート作成時のみ events テーブルにもデータを保存
      // (1) SvS参加アンケート ('svs')
      // (2) 霜竜の覇者参加アンケート ('frost_dragon')
      // (3) 兵器リーグ参加アンケート(エントリー) ('weapon_entry')
      if (['svs', 'frost_dragon', 'weapon_entry'].includes(selectedTypeId)) {
        
        // events テーブルの現在の order_index の最大値を取得
        const { data: maxOrderData, error: maxOrderError } = await supabase
          .from('events')
          .select('order_index')
          .order('order_index', { ascending: false })
          .limit(1);

        if (maxOrderError) {
          console.warn('order_indexの最大値取得に失敗しました:', maxOrderError);
        }

        // order_index（今登録されている番号の中で一番大きい数に+1、データがなければ1）
        const nextOrderIndex = maxOrderData && maxOrderData.length > 0 && maxOrderData[0].order_index != null
          ? Number(maxOrderData[0].order_index) + 1
          : 1;

        // アンケートの種類に応じたタイトルの書き換え
        let eventTableTitle = generatedTitle;
        if (selectedTypeId === 'svs') {
          eventTableTitle = 'SvS';
        } else if (selectedTypeId === 'frost_dragon') {
          eventTableTitle = '霜竜の覇者';
        } else if (selectedTypeId === 'weapon_entry') {
          eventTableTitle = '雪原兵器リーグ'; // 初戦の日付
        }

        const eventPayload = {
          id: commonId,                  // surveys_master と同じ共通id
          title: eventTableTitle,        // 指定されたタイトル
          event_date: eventDate || null, // イベント日 / 初戦の日付
          order_index: nextOrderIndex,   // 計算された order_index
          created_at: nowIso,            // アンケート作成日時のタイムスタンプ
        };

        const { error: eventError } = await supabase.from('events').insert([eventPayload]);
        if (eventError) {
          throw new Error(`eventsテーブルへの保存に失敗しました: ${eventError.message}`);
        }
      }

      alert('アンケートを作成しました！');
      router.push('/surveys'); 
    } catch (error: any) {
      console.error(error);
      alert(`エラーが発生しました: ${error.message || '不明なエラー'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col flex-1 w-full">
      <main className="flex-1 max-w-[1600px] mx-auto p-6 w-full space-y-6 flex flex-col">
        
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">📋 新規アンケート作成</h1>
            <p className="text-sm text-slate-400 mt-1">イベントやリーグ戦のアンケートを作成します。</p>
          </div>
        </div>

        <div className="flex-1 border border-slate-800 rounded-xl bg-[#151c2c] shadow-xl p-6">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
            
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                1. アンケートの種類を選択
              </label>
              <select
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                required
              >
                {surveyTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                自動生成タイトル
              </label>
              <div className="text-sm font-medium text-slate-200">
                {getAutoTitle()}
              </div>
            </div>

            <div className="space-y-6 bg-[#0b0f19] border border-slate-800 p-5 rounded-xl">
              
              <div className={`grid grid-cols-1 ${currentSurveyType.requiresDate ? 'md:grid-cols-2' : 'grid-cols-1'} gap-6`}>
                {currentSurveyType.requiresDate && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      {selectedTypeId === 'weapon_entry' ? '初戦の日付' : selectedTypeId === 'weapon_schedule' ? '対戦日' : 'イベント日'}
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full bg-[#151c2c] border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    回答期日 (JST)
                  </label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-[#151c2c] border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">※日本時間（JST）で設定されます</span>
                </div>
              </div>

              {selectedTypeId === 'weapon_schedule' && (
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-slate-200">
                    対戦時間 <span className="text-rose-400">*必須</span>
                  </label>
                  <select
                    value={matchTime}
                    onChange={(e) => setMatchTime(e.target.value)}
                    className="w-full bg-[#151c2c] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    required
                  >
                    <option value="11:00">11:00</option>
                    <option value="16:00">16:00</option>
                    <option value="21:00">21:00</option>
                    <option value="23:00">23:00</option>
                    <option value="5:00">5:00</option>
                  </select>
                </div>
              )}

            </div>

            <div className="text-xs text-slate-400 bg-cyan-950/25 border border-cyan-900/40 p-4 rounded-xl">
              ℹ️ 選択中のパターン：<span className="text-cyan-300 font-medium">{currentSurveyType.name}</span>
              {selectedTypeId === 'hero_skill' && (
                <div className="text-amber-300 mt-1">※このアンケートは「リーダー以外」のメンバーのみが回答対象となります。</div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer disabled:opacity-50"
              >
                {loading ? '作成中...' : 'アンケートを作成する'}
              </button>
            </div>

          </form>
        </div>

      </main>
    </div>
  );
}