// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CrystalSkill = {
  id: string;
  name: string;
  description: string | null;
  duration: string | null;
  cooldown: string | null;
  max_count: number;
  cost: number;
  display_order: number;
  count?: number;
};

const DEFAULT_SKILLS: CrystalSkill[] = [
  { id: '1', name: '霜竜王・石塔戦勝利', description: '負傷兵50%即時回復', duration: '10分', cooldown: '60分', max_count: 1, cost: 40000, display_order: 1, count: 0 },
  { id: '2', name: '都市攻撃', description: '損失分の50%が負傷', duration: '10分', cooldown: '30分', max_count: 2, cost: 10000, display_order: 2, count: 0 },
  { id: '3', name: '都市攻撃勝利', description: '敵都市を辺境へ移動\n10分間移転不可', duration: '10分', cooldown: '20分', max_count: 3, cost: 35000, display_order: 3, count: 0 },
  { id: '4', name: '都市防衛', description: '敵の損失率50%上昇\n味方負傷率50%減少', duration: '10分', cooldown: '30分', max_count: 2, cost: 20000, display_order: 4, count: 0 },
  { id: '5', name: '霜竜王・石塔防衛戦', description: '部隊攻撃力15%上昇\n部隊防御力15%上昇', duration: '30分', cooldown: '60分', max_count: 1, cost: 50000, display_order: 5, count: 0 },
  { id: '6', name: '集結容量', description: '集結容量30%上昇', duration: '30分', cooldown: '60分', max_count: 1, cost: 50000, display_order: 6, count: 0 },
  { id: '7', name: 'ソロ行軍速度', description: 'ソロ行軍速度100%上昇', duration: '10分', cooldown: '30分', max_count: 2, cost: 20000, display_order: 7, count: 0 },
  { id: '8', name: '竜髄水晶採集', description: '採集速度50%上昇', duration: '10分', cooldown: '30分', max_count: 2, cost: 20000, display_order: 8, count: 0 },
];

const MEMBER_COUNT = 60; // 同盟メンバー数
const GUARD_CRYSTAL = 300; // 護衛1体あたりの水晶
const LV1_CRYSTAL = 600;  // Lv1採集地 1箇所の水晶
const LV2_CRYSTAL = 1200; // Lv2採集地 1箇所の水晶
const AVG_CRYSTAL_PER_NODE = 1080; // 平均採集Lv1.8を考慮した1箇所あたりの平均水晶

export default function CrystalSimulatorPage() {
  const [skills, setSkills] = useState<CrystalSkill[]>(DEFAULT_SKILLS);

  useEffect(() => {
    fetchSkills();
  }, []);

  async function fetchSkills() {
    try {
      const { data, error } = await supabase
        .from('crystal_skills')
        .select('id, name, description, duration, cooldown, max_count, cost, display_order')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching crystal skills from DB:', error);
      } else if (data && data.length > 0) {
        const initialized = data.map((s) => ({ ...s, count: 0 }));
        setSkills(initialized);
      }
    } catch (e) {
      console.error('Failed to connect DB, using default skills', e);
    }
  }

  const handleSkillClick = (id: string) => {
    setSkills((prev) =>
      prev.map((skill) => {
        if (skill.id === id) {
          const current = skill.count || 0;
          const max = skill.max_count || 1;
          const next = current + 1 > max ? 0 : current + 1;
          return { ...skill, count: next };
        }
        return skill;
      })
    );
  };

  const handleReset = () => {
    setSkills((prev) => prev.map((s) => ({ ...s, count: 0 })));
  };

  const totalCost = skills.reduce((sum, s) => sum + s.cost * (s.count || 0), 0);

  // ==================== 回収プランの段階的自動配分ロジック ====================
  let targetGuardsPerPerson = 0;
  let targetNodesPerPerson = 0;

  if (totalCost <= 0) {
    targetGuardsPerPerson = 0;
    targetNodesPerPerson = 0;
  } else {
    const maxGatherOnlyTotal = MEMBER_COUNT * 2.0 * AVG_CRYSTAL_PER_NODE;
    if (totalCost <= maxGatherOnlyTotal) {
      targetGuardsPerPerson = 0;
      targetNodesPerPerson = totalCost / (MEMBER_COUNT * AVG_CRYSTAL_PER_NODE);
    } else {
      const costStep2 = MEMBER_COUNT * (3 * GUARD_CRYSTAL + 2.5 * AVG_CRYSTAL_PER_NODE);
      if (totalCost <= costStep2) {
        targetGuardsPerPerson = 3;
        const remainingCost = totalCost - MEMBER_COUNT * (3 * GUARD_CRYSTAL);
        targetNodesPerPerson = Math.max(0, remainingCost / (MEMBER_COUNT * AVG_CRYSTAL_PER_NODE));
      } else {
        const costStep3 = MEMBER_COUNT * (5 * GUARD_CRYSTAL + 3.0 * AVG_CRYSTAL_PER_NODE);
        if (totalCost <= costStep3) {
          targetGuardsPerPerson = 5;
          const remainingCost = totalCost - MEMBER_COUNT * (5 * GUARD_CRYSTAL);
          targetNodesPerPerson = Math.max(0, remainingCost / (MEMBER_COUNT * AVG_CRYSTAL_PER_NODE));
        } else {
          targetNodesPerPerson = 3.0;
          const gatherCoveredCost = MEMBER_COUNT * (3.0 * AVG_CRYSTAL_PER_NODE);
          const remainingForGuards = Math.max(0, totalCost - gatherCoveredCost);
          targetGuardsPerPerson = remainingForGuards / (MEMBER_COUNT * GUARD_CRYSTAL);
        }
      }
    }
  }

  const totalGuardsNeeded = Math.ceil(targetGuardsPerPerson * MEMBER_COUNT);
  const totalNodes30Min = Math.ceil(targetNodesPerPerson * MEMBER_COUNT);

  const guardCrystalTotal = totalGuardsNeeded * GUARD_CRYSTAL;
  const lv1NodesTotal = Math.round(totalNodes30Min * 0.2);
  const lv2NodesTotal = totalNodes30Min - lv1NodesTotal;
  const lv1CrystalTotal = lv1NodesTotal * LV1_CRYSTAL;
  const lv2CrystalTotal = lv2NodesTotal * LV2_CRYSTAL;
  const gatherCrystalTotal = lv1CrystalTotal + lv2CrystalTotal;

  // 採集スキルデータの取得
  const gatherSkill = skills.find((s) => s.name.includes('採集'));
  const gatherSkillCount = gatherSkill ? gatherSkill.count || 0 : 0;
  const gatherSkillCostBase = gatherSkill ? gatherSkill.cost : 20000;

  // 10分間（スキル1回分：ノルマの1/3）
  const nodes10Min = totalNodes30Min / 3.0;
  const crystal10Min = nodes10Min * AVG_CRYSTAL_PER_NODE;
  const cost10Min = gatherSkillCostBase * 1;
  const profit10Min = crystal10Min - cost10Min;

  // 20分間（スキル2回分：ノルマの2/3）
  const nodes20Min = (totalNodes30Min / 3.0) * 2.0;
  const crystal20Min = nodes20Min * AVG_CRYSTAL_PER_NODE;
  const cost20Min = gatherSkillCostBase * 2;
  const profit20Min = crystal20Min - cost20Min;

  const getSkillByOrder = (order: number) => skills.find((s) => s.display_order === order);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-2 sm:p-6 flex flex-col items-center select-none overflow-x-hidden">
      <div className="max-w-5xl w-full space-y-4 sm:space-y-6">
        
        {/* ヘッダー */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-3 gap-2">
          <div>
            <h1 className="text-base sm:text-2xl font-bold text-blue-400 flex items-center gap-1.5">
              <span>💎</span> 霜竜の覇者 水晶スキルシミュレーター
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
              スキルカードをタップしてオン/オフ・回数を切替（1回〜最大3回）
            </p>
          </div>
          {totalCost > 0 && (
            <button
              onClick={handleReset}
              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-[10px] sm:text-xs font-semibold border border-gray-700 transition flex-shrink-0"
            >
              リセット ✕
            </button>
          )}
        </div>

        {/* メインボード（中央水晶 ＋ 時計回り配置） */}
        <div className="bg-gradient-to-b from-gray-900 via-gray-925 to-gray-950 border border-gray-800 rounded-2xl p-4 sm:p-8 shadow-2xl overflow-hidden flex justify-center items-center">
          <div className="relative w-full max-w-[720px] h-[640px] sm:h-[620px] flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

            {/* 中央：水晶 ＋ 合計消費数カウンター */}
            <div className="z-20 bg-gray-950/95 border-2 border-blue-500/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-blue-950/90 flex flex-col items-center text-center backdrop-blur-md w-40 sm:w-56">
              <div className="text-3xl sm:text-4xl mb-0.5 animate-pulse">💎</div>
              <span className="text-[9px] sm:text-[11px] text-gray-400 font-bold uppercase tracking-widest">合計消費水晶</span>
              <div className="text-2xl sm:text-4xl font-black text-white tracking-wider flex items-center gap-1 mt-0.5">
                <span className="text-blue-400 font-mono">{totalCost.toLocaleString()}</span>
              </div>
              {totalCost > 0 && (
                <div className="mt-1.5 px-2.5 py-0.5 bg-blue-950 text-blue-300 rounded-full text-[9px] sm:text-[10px] font-bold border border-blue-800">
                  {skills.filter((s) => (s.count || 0) > 0).length}個選択中
                </div>
              )}
            </div>

            {/* 8個のスキルカード（時計回り・絶対配置） */}
            <div className="absolute inset-0 pointer-events-none">
              {[
                { order: 1, pos: 'top-1 sm:top-2 left-1/2 -translate-x-1/2' },
                { order: 2, pos: 'top-[14%] right-[2%] sm:right-[4%]' },
                { order: 3, pos: 'top-1/2 -translate-y-1/2 right-0 sm:right-[1%]' },
                { order: 4, pos: 'bottom-[14%] right-[2%] sm:right-[4%]' },
                { order: 5, pos: 'bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2' },
                { order: 6, pos: 'bottom-[14%] left-[2%] sm:left-[4%]' },
                { order: 7, pos: 'top-1/2 -translate-y-1/2 left-0 sm:left-[1%]' },
                { order: 8, pos: 'top-[14%] left-[2%] sm:left-[4%]' },
              ].map(({ order, pos }) => {
                const skill = getSkillByOrder(order);
                if (!skill) return null;
                const count = skill.count || 0;
                const isActive = count > 0;

                return (
                  <div key={skill.id} className={`absolute ${pos} pointer-events-auto z-10 w-[140px] sm:w-[195px]`}>
                    <SkillCard skill={skill} isActive={isActive} count={count} onClick={() => handleSkillClick(skill.id)} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 水晶獲得量 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-4 space-y-3 shadow-lg">
          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
            <h2 className="text-xs sm:text-sm font-bold text-blue-300 flex items-center gap-1.5">
              <span>📊</span> 水晶獲得量
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            {/* ① 護衛情報 */}
            <div className="space-y-1.5">
              <span className="text-gray-300 font-bold block px-1">① 護衛</span>
              <div className="bg-gray-950 px-3 py-2.5 rounded-xl border border-gray-800 flex justify-between items-center">
                <span className="text-gray-400">1体あたりの獲得</span>
                <span className="font-mono text-indigo-300 font-bold text-sm">
                  1体 = 💎 300個
                </span>
              </div>
            </div>

            {/* ② 採集情報（テーブル） */}
            <div className="space-y-1.5">
              <span className="text-gray-300 font-bold block px-1">② 採集</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-950 text-gray-400 border-b border-gray-800 text-[10px] sm:text-xs">
                      <th className="p-2 font-semibold">スキル</th>
                      <th className="p-2 font-semibold">レベル</th>
                      <th className="p-2 font-semibold">採集量</th>
                      <th className="p-2 font-semibold">採集速度</th>
                      <th className="p-2 font-semibold">採集時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-[11px] sm:text-xs">
                    <tr className="hover:bg-gray-800/30">
                      <td className="p-2 text-gray-300 font-medium" rowSpan={2}>なし</td>
                      <td className="p-2 text-gray-300">レベル1</td>
                      <td className="p-2 font-mono text-blue-200">600</td>
                      <td className="p-2 font-mono text-gray-300">1/S</td>
                      <td className="p-2 font-mono text-gray-300">10:00</td>
                    </tr>
                    <tr className="hover:bg-gray-800/30">
                      <td className="p-2 text-gray-300">レベル2</td>
                      <td className="p-2 font-mono text-blue-200">1,200</td>
                      <td className="p-2 font-mono text-gray-300">1.5/S</td>
                      <td className="p-2 font-mono text-gray-300">13:20</td>
                    </tr>
                    <tr className="bg-blue-950/20 hover:bg-blue-900/30">
                      <td className="p-2 font-bold text-blue-400" rowSpan={2}>
                        ⚡ 発動中
                      </td>
                      <td className="p-2 text-blue-200">レベル1</td>
                      <td className="p-2 font-mono text-blue-200 font-bold">600</td>
                      <td className="p-2 font-mono text-emerald-400 font-bold">1.5/S</td>
                      <td className="p-2 font-mono text-emerald-400 font-bold">6:40</td>
                    </tr>
                    <tr className="bg-blue-950/20 hover:bg-blue-900/30">
                      <td className="p-2 text-blue-200">レベル2</td>
                      <td className="p-2 font-mono text-blue-200 font-bold">1,200</td>
                      <td className="p-2 font-mono text-emerald-400 font-bold">2.25/S</td>
                      <td className="p-2 font-mono text-emerald-400 font-bold">8:54</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 収支・ノルマ試算エリア */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          
          {/* 採集・護衛ノルマ（自動回収プラン） */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-4 space-y-3.5 shadow-lg">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2.5">
              <h2 className="text-xs sm:text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                <span>🛡️</span> 採集・護衛ノルマ（自動回収プラン）
              </h2>
              <span className="text-[10px] sm:text-[11px] text-gray-400">同盟基準: 60人</span>
            </div>

            <div className="space-y-3 text-xs">
              
              {/* 護衛ノルマ ＆ 獲得水晶合計 */}
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-bold">護衛討伐ノルマ (300水晶/体)</span>
                  <span className="font-mono text-indigo-300 text-xs font-bold">
                    全体: <strong className="text-white text-sm">{totalGuardsNeeded.toLocaleString()} 体</strong>
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-gray-400">1人あたりの平均目安</span>
                  <span className="font-mono font-bold text-indigo-200">
                    約 <strong className="text-indigo-400 text-sm">{targetGuardsPerPerson.toFixed(1)}</strong> 体 / 人
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-800/80 flex justify-between items-center text-[11px]">
                  <span className="text-indigo-300 font-medium">💎 護衛獲得水晶 合計</span>
                  <span className="font-mono font-bold text-indigo-300 text-sm">
                    {guardCrystalTotal.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">水晶</span>
                  </span>
                </div>
              </div>

              {/* 採集ノルマ ＆ 獲得水晶合計 (Lv1, Lv2, 合計) */}
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-bold">採集ノルマ (30分合計 / 平均Lv1.8)</span>
                  <span className="font-mono text-blue-300 text-xs font-bold">
                    全体: <strong className="text-white text-sm">{totalNodes30Min.toLocaleString()} 箇所</strong>
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-gray-400">1人あたりの平均目安</span>
                  <span className="font-mono font-bold text-blue-200">
                    約 <strong className="text-blue-400 text-sm">{targetNodesPerPerson.toFixed(1)}</strong> 箇所 / 人
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-800/80 space-y-1 text-[11px]">
                  <div className="flex justify-between text-gray-400">
                    <span>├ Lv1 (600個/箇所 × {lv1NodesTotal}箇所)</span>
                    <span className="font-mono font-semibold text-gray-300">{lv1CrystalTotal.toLocaleString()} 水晶</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>├ Lv2 (1,200個/箇所 × {lv2NodesTotal}箇所)</span>
                    <span className="font-mono font-semibold text-gray-300">{lv2CrystalTotal.toLocaleString()} 水晶</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-gray-800/50">
                    <span className="text-blue-300 font-medium">💎 採集獲得水晶 合計</span>
                    <span className="font-mono font-bold text-blue-300 text-sm">
                      {gatherCrystalTotal.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">水晶</span>
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 採集速度UP 損益分岐点（黒字化）連動修正エリア */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-4 space-y-3.5 shadow-lg">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2.5">
              <h2 className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                <span>⚡</span> 採集速度UP 損益分岐点（黒字化）
              </h2>
              <span className="text-[10px] sm:text-[11px] text-emerald-400 font-mono font-bold">
                スキルコスト: {gatherSkillCostBase.toLocaleString()} 水晶/回
              </span>
            </div>

            {gatherSkillCount === 0 ? (
              <div className="py-7 text-center text-xs text-gray-500">
                上のスキル配置で「竜髄水晶採集」を選択（1回または2回）すると、選択回数に応じた黒字化シミュレーションが表示されます。
              </div>
            ) : gatherSkillCount === 1 ? (
              <div className="space-y-3 text-xs">
                <p className="text-[10px] sm:text-[11px] text-gray-300 leading-relaxed bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-800/40">
                  スキル使用回数 <strong>1回</strong>（10分間 / ノルマ1/3）の獲得量とコストを比較：
                </p>

                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-2">
                  <div className="text-[11px] font-bold text-emerald-300 flex justify-between items-center border-b border-gray-800 pb-1">
                    <span>⏱️ スキル1回使用（10分間）</span>
                    <span className="font-mono text-gray-400 font-normal">コスト: {cost10Min.toLocaleString()}水晶</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">10分間の獲得目安 ({nodes10Min.toFixed(1)}箇所分)</span>
                    <span className="font-mono font-bold text-blue-300">
                      {Math.round(crystal10Min).toLocaleString()} 水晶
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                    <span className="text-gray-300 font-bold">純利益（収支）</span>
                    <span className={`font-mono font-black text-sm ${profit10Min >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {profit10Min >= 0 ? `+${Math.round(profit10Min).toLocaleString()} 水晶 (黒字)` : `${Math.round(profit10Min).toLocaleString()} 水晶 (赤字)`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-[10px] sm:text-[11px] text-gray-300 leading-relaxed bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-800/40">
                  スキル使用回数 <strong>2回</strong>（20分間 / ノルマ2/3）の獲得量とコストを比較：
                </p>

                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-2">
                  <div className="text-[11px] font-bold text-emerald-300 flex justify-between items-center border-b border-gray-800 pb-1">
                    <span>⏱️ スキル2回使用（20分間）</span>
                    <span className="font-mono text-gray-400 font-normal">コスト: {cost20Min.toLocaleString()}水晶</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">20分間の獲得目安 ({nodes20Min.toFixed(1)}箇所分)</span>
                    <span className="font-mono font-bold text-blue-300">
                      {Math.round(crystal20Min).toLocaleString()} 水晶
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                    <span className="text-gray-300 font-bold">純利益（収支）</span>
                    <span className={`font-mono font-black text-sm ${profit20Min >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {profit20Min >= 0 ? `+${Math.round(profit20Min).toLocaleString()} 水晶 (黒字)` : `${Math.round(profit20Min).toLocaleString()} 水晶 (赤字)`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

// スキルカードコンポーネント
function SkillCard({
  skill,
  isActive,
  count,
  onClick,
}: {
  skill: CrystalSkill;
  isActive: boolean;
  count: number;
  onClick: () => void;
}) {
  const currentTotalCost = skill.cost * count;

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl p-2 sm:p-2.5 border transition-all duration-200 relative select-none flex flex-col justify-between ${
        isActive
          ? 'bg-gradient-to-b from-blue-950/95 to-indigo-950/95 border-blue-400 shadow-lg shadow-blue-900/50 scale-[1.02]'
          : 'bg-gray-900/90 border-gray-800 hover:border-gray-700 opacity-90 hover:opacity-100'
      }`}
    >
      {/* 発動回数バッジ */}
      <div
        className={`absolute -top-1.5 -right-1 text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full border shadow ${
          isActive
            ? 'bg-blue-600 border-blue-300 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-400'
        }`}
      >
        {count}/{skill.max_count}回
      </div>

      <div>
        {/* スキル名 */}
        <div className="text-[10px] sm:text-xs font-bold text-blue-200 mb-0.5 pr-8 truncate" title={skill.name}>
          {skill.name}
        </div>

        {/* 時間 & CT */}
        <div className="text-[8px] sm:text-[9px] text-indigo-300/80 font-mono mb-1 flex gap-0.5">
          <span>{skill.duration || '-'}</span>
          <span>|</span>
          <span>CT:{skill.cooldown || '-'}</span>
        </div>

        {/* スキル説明 */}
        <div className="text-[9px] sm:text-[10px] text-gray-300 whitespace-pre-line leading-tight mb-1 min-h-[22px] sm:min-h-[26px]">
          {skill.description || '-'}
        </div>
      </div>

      {/* 消費水晶額 */}
      <div className="pt-1 border-t border-gray-800/80 flex justify-between items-center">
        <span className="text-[8px] sm:text-[9px] text-gray-400">消費</span>
        <span className="text-[10px] sm:text-xs font-black text-white font-mono">
          💎{(isActive ? currentTotalCost : skill.cost).toLocaleString()}
        </span>
      </div>
    </div>
  );
}