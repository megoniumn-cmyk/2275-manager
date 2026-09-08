'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type UnansweredMember = {
  game_id: string;
  name?: string;
  fc_level?: string;
  current_power?: string;
  shield_soldier?: string;
  spear_soldier?: string;
  bow_soldier?: string;
};

type ManualRegisterModalProps = {
  surveyId: string;
  surveyType: string;
  eventDate: string | null;
  unansweredMembers: UnansweredMember[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ManualRegisterModal({
  surveyId,
  surveyType,
  eventDate,
  unansweredMembers,
  isOpen,
  onClose,
  onSuccess,
}: ManualRegisterModalProps) {
  const [selectedGameId, setSelectedGameId] = useState<string>(
    unansweredMembers[0]?.game_id || ''
  );
  const [submitting, setSubmitting] = useState<boolean>(false);

  // アンケート回答フォームの状態
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

  if (!isOpen) return null;

  // メンバーが切り替わった時に既存データをフォームに反映させるためのハンドラ
  const handleMemberChange = (gameId: string) => {
    setSelectedGameId(gameId);
    const target = unansweredMembers.find((m) => m.game_id === gameId);
    if (target) {
      if (target.fc_level) setFcLevel(target.fc_level);
      if (target.shield_soldier) setShieldSoldier(target.shield_soldier);
      if (target.spear_soldier) setSpearSoldier(target.spear_soldier);
      if (target.bow_soldier) setBowSoldier(target.bow_soldier);

      if (target.current_power) {
        const match = target.current_power.match(/^([0-9.]+)([BM]?)$/i);
        if (match) {
          setPowerNum(match[1]);
          if (match[2]) setPowerUnit(match[2].toUpperCase());
        } else {
          setPowerNum(target.current_power);
        }
      } else {
        setPowerNum('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedGameId) {
      alert('メンバーを選択してください。');
      return;
    }

    if (participationType === '3') {
      const hasSlotSelected = slot20 || slot21 || slot22 || slot23 || slot24 || slot25;
      if (!hasSlotSelected) {
        alert('「参加可能時間を選択してください」の項目で、少なくとも1つの時間帯を選択してください。');
        return;
      }
    }

    setSubmitting(true);
    try {
      const fullPower = powerNum ? `${powerNum}${powerUnit}` : null;
      const targetMember = unansweredMembers.find((m) => m.game_id === selectedGameId);

      const finalFcLevel = targetMember?.fc_level === 'FC10' ? 'FC10' : fcLevel;
      const finalPower = fullPower || targetMember?.current_power || null;
      const finalShield = targetMember?.shield_soldier === 'FC10T11' ? 'FC10T11' : shieldSoldier;
      const finalSpear = targetMember?.spear_soldier === 'FC10T11' ? 'FC10T11' : spearSoldier;
      const finalBow = targetMember?.bow_soldier === 'FC10T11' ? 'FC10T11' : bowSoldier;

      // 不参加以外の場合はメンバー情報も必要に応じて更新
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
          .eq('game_id', selectedGameId);

        if (memberError) throw memberError;
      }

      // スロットのON/OFF判定
      let s20 = false;
      let s21 = false;
      let s22 = false;
      let s23 = false;
      let s24 = false;
      let s25 = false;

      if (participationType === '1') {
        s20 = s21 = s22 = s23 = s24 = s25 = true;
      } else if (participationType === '2') {
        s21 = s22 = s23 = s24 = s25 = true;
      } else if (participationType === '3') {
        s20 = slot20;
        s21 = slot21;
        s22 = slot22;
        s23 = slot23;
        s24 = slot24;
        s25 = slot25;
      }

      const surveyResponsePayload = {
        survey_id: surveyId,
        game_id: selectedGameId,
        survey_type: surveyType || 'svs',
        event_date: eventDate || null,
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

      const { error: surveyResponseError } = await supabase
        .from('survey_responses_svs')
        .upsert([surveyResponsePayload], { onConflict: 'survey_id,game_id' });

      if (surveyResponseError) throw surveyResponseError;

      alert('未回答者の回答を手動登録しました。');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      alert(`登録エラー: ${error.message || '不明なエラー'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const timeSlotOptions = [
    { label: '20:00台', val: slot20, set: setSlot20 },
    { label: '21:00台', val: slot21, set: setSlot21 },
    { label: '22:00台', val: slot22, set: setSlot22 },
    { label: '23:00台', val: slot23, set: setSlot23 },
    { label: '24:00台', val: slot24, set: setSlot24 },
    { label: '25:00台', val: slot25, set: setSlot25 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-2xl max-w-[800px] w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-100">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-white">未回答者の回答を登録（手動）</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-1 cursor-pointer"
          >
            ✕ 閉じる
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 対象メンバー選択 */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-200">
              対象メンバー選択 <span className="text-rose-400">*回答必須</span>
            </label>
            <div className="relative">
              <select
                value={selectedGameId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 appearance-none"
                required
              >
                {unansweredMembers.length === 0 ? (
                  <option value="">未回答のメンバーがいません</option>
                ) : (
                  unansweredMembers.map((m) => (
                    <option key={m.game_id} value={m.game_id}>
                      {m.name ? `${m.name} (${m.game_id})` : m.game_id}
                    </option>
                  ))
                )}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
          </div>

          {/* 参加予定時間 */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-200">
              参加予定時間を教えてください。 <span className="text-rose-400">*回答必須</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: '1', label: '① フル参加(移転予定時間含む)' },
                { id: '2', label: '② フル参加(戦闘時間のみ)' },
                { id: '3', label: '③ 途中参加' },
                { id: '4', label: '④ 不参加' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setParticipationType(item.id)}
                  className={`p-3 rounded-xl text-xs font-medium border text-left transition cursor-pointer ${
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

          {/* 途中参加の場合の時間帯選択 */}
          {participationType === '3' && (
            <div className="bg-[#0b0f19] border border-cyan-900/40 p-5 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-semibold text-cyan-300 mb-2">
                  参加可能時間を選択してください（複数選択可） <span className="text-rose-400">*回答必須</span>
                </label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {timeSlotOptions.map((item) => (
                    <label key={item.label} className="flex items-center gap-2 bg-[#151c2c] border border-slate-700 p-2.5 rounded-lg text-xs cursor-pointer hover:border-slate-500">
                      <input
                        type="checkbox"
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
                  備考欄（参加時間について補足） <span className="text-slate-500 font-normal">（任意）</span>
                </label>
                <input
                  type="text"
                  value={timeSlotMemo}
                  onChange={(e) => setTimeSlotMemo(e.target.value)}
                  placeholder="例: 12時半頃から入れます"
                  className="w-full bg-[#151c2c] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* VC参加状況 */}
          {participationType !== '4' && (
            <>
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-200">
                  上で回答した参加予定時間、全時間でVC参加可能ですか。(聞き専含む) <span className="text-rose-400">*回答必須</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: '1', label: '① VCフル参加' },
                    { id: '2', label: '② 一部の時間のみ参加' },
                    { id: '3', label: '③ VC不参加' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setVcStatus(item.id)}
                      className={`p-3 rounded-xl text-xs font-medium border text-left transition cursor-pointer ${
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
                      参加可能時間を入力してください <span className="text-rose-400">*回答必須</span>
                    </label>
                    <input
                      type="text"
                      value={vcMemo}
                      onChange={(e) => setVcMemo(e.target.value)}
                      placeholder="例: 12時〜14時のみ参加可能"
                      className="w-full bg-[#0b0f19] border border-cyan-900/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                )}
              </div>

              {/* 溶鉱炉Lv */}
              <div className="space-y-2 pt-4 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-200">
                  溶鉱炉Lvを回答してください。 <span className="text-rose-400">*回答必須</span>
                </label>
                <div className="relative">
                  <select
                    value={fcLevel}
                    onChange={(e) => setFcLevel(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 appearance-none"
                    required
                  >
                    <option value="FC10">FC10</option>
                    <option value="FC9">FC9</option>
                    <option value="FC8">FC8</option>
                    <option value="FC7">FC7</option>
                    <option value="FC6以上">FC6以上</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                </div>
              </div>

              {/* 総力 */}
              <div className="space-y-2 pt-4 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-200">
                  総力を入力してください。 <span className="text-rose-400">*回答必須</span>
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={powerNum}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      setPowerNum(val);
                    }}
                    placeholder="例: 1.1"
                    className="flex-1 bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                  <div className="relative w-36">
                    <select
                      value={powerUnit}
                      onChange={(e) => setPowerUnit(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold appearance-none"
                    >
                      <option value="B">B</option>
                      <option value="M">M</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                  </div>
                </div>
              </div>

              {/* 兵士Lv */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <p className="text-xs font-semibold text-slate-200">
                  兵士Lvを回答してください（SvS当日までに解放する場合は解放予定後で回答） <span className="text-rose-400">*回答必須</span>
                </p>

                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400">・盾兵 <span className="text-rose-400">*</span></label>
                  <select
                    value={shieldSoldier}
                    onChange={(e) => setShieldSoldier(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
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
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400">・槍兵 <span className="text-rose-400">*</span></label>
                  <select
                    value={spearSoldier}
                    onChange={(e) => setSpearSoldier(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
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
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400">・弓兵 <span className="text-rose-400">*</span></label>
                  <select
                    value={bowSoldier}
                    onChange={(e) => setBowSoldier(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
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
                </div>
              </div>
            </>
          )}

          {/* ボタン部分 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer disabled:opacity-50"
            >
              {submitting ? '登録中...' : '手動で登録する'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}