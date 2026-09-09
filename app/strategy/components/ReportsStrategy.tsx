'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TroopUnit {
  id: string;
  type: 'Infantry' | 'Lancers' | 'Marksmen';
  tier: string;
  fc_level: number;
  quantity: number;
  survived: number;
}

interface TroopStats {
  atk: number;
  def: number;
  health: number;
  lethality: number;
}

interface CombatReportSim {
  id: string;
  created_at: string;
  result: 'win' | 'loss';
  opponent_name: string;
  attacker_stats: { infantry: TroopStats; lancers: TroopStats; marksmen: TroopStats; };
  defender_stats: { infantry: TroopStats; lancers: TroopStats; marksmen: TroopStats; };
  attacker_troops: TroopUnit[];
  defender_troops: TroopUnit[];
  attacker_heroes?: { leader: { infantry: string; lancers: string; marksmen: string }; joiners: string[]; };
  defender_heroes?: { leader: { infantry: string; lancers: string; marksmen: string }; joiners: string[]; };
  attacker_skill_counts?: { heroes: Record<string, { skill1: number; skill2: number; skill3: number }>; troop_skill: number; };
  defender_skill_counts?: { heroes: Record<string, { skill1: number; skill2: number; skill3: number }>; troop_skill: number; };
  memo?: string;
}

interface HeroItem {
  id: string;
  name: string;
  troop_type: string;
  display_order?: number;
}

export default function StrategyReportsPage() {
  const [reports, setReports] = useState<CombatReportSim[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shieldHeroes, setShieldHeroes] = useState<HeroItem[]>([]);
  const [spearHeroes, setSpearHeroes] = useState<HeroItem[]>([]);
  const [bowHeroes, setBowHeroes] = useState<HeroItem[]>([]);
  const [joinerHeroes, setJoinerHeroes] = useState<HeroItem[]>([]);

  const [activeTab, setActiveTab] = useState<'attacker' | 'defender'>('attacker');

  const [result, setResult] = useState<'win' | 'loss'>('win');
  const [opponentName, setOpponentName] = useState('');

  // ステータス
  const [atkInf, setAtkInf] = useState<TroopStats>({ atk: 2500, def: 2200, health: 2300, lethality: 2600 });
  const [atkLan, setAtkLan] = useState<TroopStats>({ atk: 2600, def: 2100, health: 2200, lethality: 2700 });
  const [atkMar, setAtkMar] = useState<TroopStats>({ atk: 2700, def: 2000, health: 2100, lethality: 2800 });

  const [defInf, setDefInf] = useState<TroopStats>({ atk: 2400, def: 2300, health: 2400, lethality: 2500 });
  const [defLan, setDefLan] = useState<TroopStats>({ atk: 2500, def: 2200, health: 2300, lethality: 2600 });
  const [defMar, setDefMar] = useState<TroopStats>({ atk: 2600, def: 2100, health: 2200, lethality: 2700 });

  // 兵士リスト
  const [attackerTroops, setAttackerTroops] = useState<TroopUnit[]>([
    { id: '1', type: 'Infantry', tier: '11', fc_level: 8, quantity: 75000, survived: 50000 },
  ]);
  const [defenderTroops, setDefenderTroops] = useState<TroopUnit[]>([
    { id: '1', type: 'Infantry', tier: '11', fc_level: 8, quantity: 70000, survived: 40000 },
  ]);

  // 英雄編成
  const [attackerLeaderHeroes, setAttackerLeaderHeroes] = useState({ infantry: '', lancers: '', marksmen: '' });
  const [attackerJoinerHeroes, setAttackerJoinerHeroes] = useState<string[]>(['', '', '', '']);
  const [defenderLeaderHeroes, setDefenderLeaderHeroes] = useState({ infantry: '', lancers: '', marksmen: '' });
  const [defenderJoinerHeroes, setDefenderJoinerHeroes] = useState<string[]>(['', '', '', '']);

  // スキル発動回数
  const [attackerHeroSkills, setAttackerHeroSkills] = useState<Record<string, { skill1: number; skill2: number; skill3: number }>>({});
  const [attackerTroopSkill, setAttackerTroopSkill] = useState<number>(0);
  const [defenderHeroSkills, setDefenderHeroSkills] = useState<Record<string, { skill1: number; skill2: number; skill3: number }>>({});
  const [defenderTroopSkill, setDefenderTroopSkill] = useState<number>(0);

  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReports();
    fetchHeroes();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('combat_reports').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setReports(data);
    } catch (err) {
      console.error('レポート取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHeroes = async () => {
    try {
      const { data, error } = await supabase.from('heroes').select('*');
      if (error) throw error;
      console.log('取得したheroes全データ:', data); // ← ブラウザのF12コンソールで内容を確認できます
      
      if (data) {
        // 多様な表記揺れ（shield, 盾兵, etc.）に対応できるように柔軟にフィルター
        setShieldHeroes(data.filter(h => {
          const t = (h.troop_type || '').toLowerCase();
          return t.includes('shield') || t.includes('盾');
        }));
        setSpearHeroes(data.filter(h => {
          const t = (h.troop_type || '').toLowerCase();
          return t.includes('spear') || t.includes('槍');
        }));
        setBowHeroes(data.filter(h => {
          const t = (h.troop_type || '').toLowerCase();
          return t.includes('bow') || t.includes('marksman') || t.includes('弓');
        }));
        setJoinerHeroes(data.filter(h => {
          const t = (h.troop_type || '').toLowerCase();
          return t.includes('joiner') || t.includes('ジョイナー');
        }).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
      }
    } catch (err) {
      console.error('英雄マスタ取得エラー:', err);
    }
  };

  const handleAddUnit = (side: 'attacker' | 'defender') => {
    const newUnit: TroopUnit = { id: Math.random().toString(36).substring(2, 9), type: 'Infantry', tier: '11', fc_level: 8, quantity: 0, survived: 0 };
    if (side === 'attacker') setAttackerTroops([...attackerTroops, newUnit]);
    else setDefenderTroops([...defenderTroops, newUnit]);
  };

  const handleRemoveUnit = (side: 'attacker' | 'defender', id: string) => {
    if (side === 'attacker') setAttackerTroops(attackerTroops.filter(t => t.id !== id));
    else setDefenderTroops(defenderTroops.filter(t => t.id !== id));
  };

  const handleUpdateUnit = (side: 'attacker' | 'defender', id: string, field: keyof TroopUnit, value: any) => {
    if (side === 'attacker') setAttackerTroops(attackerTroops.map(t => t.id === id ? { ...t, [field]: value } : t));
    else setDefenderTroops(defenderTroops.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSkillChange = (side: 'attacker' | 'defender', heroName: string, skillKey: 'skill1' | 'skill2' | 'skill3', val: number) => {
    if (!heroName) return;
    if (side === 'attacker') {
      const current = attackerHeroSkills[heroName] || { skill1: 0, skill2: 0, skill3: 0 };
      setAttackerHeroSkills({ ...attackerHeroSkills, [heroName]: { ...current, [skillKey]: val } });
    } else {
      const current = defenderHeroSkills[heroName] || { skill1: 0, skill2: 0, skill3: 0 };
      setDefenderHeroSkills({ ...defenderHeroSkills, [heroName]: { ...current, [skillKey]: val } });
    }
  };

  const handleImageParse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setTimeout(() => {
      setIsParsing(false);
      alert('スクショの自動解析が完了しました（サンプルデータ反映）');
      setOpponentName('相手プレイヤー名');
    }, 1500);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const savedGameId = localStorage.getItem('logged_in_game_id') || 'unknown';
      const payload = {
        result,
        opponent_name: opponentName,
        attacker_stats: { infantry: atkInf, lancers: atkLan, marksmen: atkMar },
        defender_stats: { infantry: defInf, lancers: defLan, marksmen: defMar },
        attacker_troops: attackerTroops,
        defender_troops: defenderTroops,
        attacker_heroes: { leader: attackerLeaderHeroes, joiners: attackerJoinerHeroes },
        defender_heroes: { leader: defenderLeaderHeroes, joiners: defenderJoinerHeroes },
        attacker_skill_counts: { heroes: attackerHeroSkills, troop_skill: attackerTroopSkill },
        defender_skill_counts: { heroes: defenderHeroSkills, troop_skill: defenderTroopSkill },
        memo,
        game_id: savedGameId,
      };

      const { error } = await supabase.from('combat_reports').insert([payload]);
      if (error) throw error;

      alert('戦闘レポートを登録しました！');
      setIsModalOpen(false);
      fetchReports();
    } catch (err: any) {
      console.error('登録エラー:', err);
      alert(`登録失敗: ${err.message || ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeroSkillsInput = (side: 'attacker' | 'defender', heroName: string, labelPrefix: string) => {
    if (!heroName) return null;
    const skills = (side === 'attacker' ? attackerHeroSkills[heroName] : defenderHeroSkills[heroName]) || { skill1: 0, skill2: 0, skill3: 0 };

    return (
      <div className="bg-[#0b0f19] p-3 rounded-lg border border-slate-800 space-y-2">
        <div className="font-semibold text-cyan-300 text-[11px]">{labelPrefix}: {heroName} のスキル発動回数</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">Skill 1</label>
            <input type="number" value={skills.skill1} onChange={(e) => handleSkillChange(side, heroName, 'skill1', Number(e.target.value))} className="w-full bg-[#151c2c] border border-slate-700 rounded p-1 text-white text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Skill 2</label>
            <input type="number" value={skills.skill2} onChange={(e) => handleSkillChange(side, heroName, 'skill2', Number(e.target.value))} className="w-full bg-[#151c2c] border border-slate-700 rounded p-1 text-white text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Skill 3</label>
            <input type="number" value={skills.skill3} onChange={(e) => handleSkillChange(side, heroName, 'skill3', Number(e.target.value))} className="w-full bg-[#151c2c] border border-slate-700 rounded p-1 text-white text-xs" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col">
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#151c2c] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link href="/" className="hover:text-cyan-400">ホーム</Link>
              <span>/</span>
              <span className="text-cyan-400 font-semibold">戦闘レポート管理</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">⚔️ 兵種別ステータス・複数兵士アナライザー</h1>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow shrink-0 cursor-pointer"
          >
            ＋ レポートを新規登録
          </button>
        </div>

        <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white">📋 登録済み戦闘レポート一覧</h2>
          {loading ? (
            <div className="text-xs text-slate-400 py-4">読み込み中...</div>
          ) : reports.length === 0 ? (
            <div className="text-xs text-slate-400">登録されたレポートはありません。</div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div key={report.id} className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className={`px-2 py-0.5 rounded font-bold mr-2 ${report.result === 'win' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                      {report.result === 'win' ? '勝利 (Win)' : '敗北 (Loss)'}
                    </span>
                    <span className="text-white font-bold">vs {report.opponent_name || '名称未設定'}</span>
                  </div>
                  <span className="text-slate-500">{new Date(report.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#151c2c] border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white">⚙️ シミュレーター形式・データ入力</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕ 閉じる</button>
            </div>

            <form onSubmit={handleRegister} className="space-y-6 text-xs">
              <div className="bg-[#0b0f19] border border-cyan-900/40 rounded-xl p-4 space-y-3">
                <div className="font-bold text-cyan-400">📸 スクショ自動解析</div>
                <p className="text-[11px] text-slate-400">戦闘レポートのスクショを選択すると、部隊・ステータス・リーダー英雄のスキル発動回数を自動で埋めます。</p>
                <input type="file" ref={fileInputRef} onChange={handleImageParse} accept="image/*" className="hidden" />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isParsing}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isParsing ? '解析中...' : 'ファイルを選択'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">勝敗</label>
                  <select value={result} onChange={(e) => setResult(e.target.value as any)} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-white">
                    <option value="win">勝利 (Win)</option>
                    <option value="loss">敗北 (Loss)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">相手の名前</label>
                  <input type="text" value={opponentName} onChange={(e) => setOpponentName(e.target.value)} placeholder="対戦相手名" className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-white" />
                </div>
              </div>

              <div className="flex border-b border-slate-800">
                <button type="button" onClick={() => setActiveTab('attacker')} className={`flex-1 py-3 text-center font-bold transition border-b-2 cursor-pointer ${activeTab === 'attacker' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-400'}`}>
                  ⚔️ 攻撃側データ入力 (Attacker)
                </button>
                <button type="button" onClick={() => setActiveTab('defender')} className={`flex-1 py-3 text-center font-bold transition border-b-2 cursor-pointer ${activeTab === 'defender' ? 'border-rose-500 text-rose-400 bg-rose-950/20' : 'border-transparent text-slate-400'}`}>
                  🛡️ 防御側データ入力 (Defender)
                </button>
              </div>

              {activeTab === 'attacker' && (
                <div className="space-y-6">
                  <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 space-y-4">
                    <div className="font-bold text-cyan-400">📊 攻撃側 兵種別ステータス</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-[#151c2c] p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="font-semibold text-slate-300">盾兵 (Infantry)</div>
                        <div>
                          <label className="text-[10px] text-slate-400">攻撃力</label>
                          <input type="number" value={atkInf.atk} onChange={(e) => setAtkInf({...atkInf, atk: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">防御力</label>
                          <input type="number" value={atkInf.def} onChange={(e) => setAtkInf({...atkInf, def: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">体力</label>
                          <input type="number" value={atkInf.health} onChange={(e) => setAtkInf({...atkInf, health: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">負傷率 / 破壊力</label>
                          <input type="number" value={atkInf.lethality} onChange={(e) => setAtkInf({...atkInf, lethality: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                      </div>
                      <div className="bg-[#151c2c] p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="font-semibold text-slate-300">槍兵 (Lancers)</div>
                        <div>
                          <label className="text-[10px] text-slate-400">攻撃力</label>
                          <input type="number" value={atkLan.atk} onChange={(e) => setAtkLan({...atkLan, atk: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">防御力</label>
                          <input type="number" value={atkLan.def} onChange={(e) => setAtkLan({...atkLan, def: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">体力</label>
                          <input type="number" value={atkLan.health} onChange={(e) => setAtkLan({...atkLan, health: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">負傷率 / 破壊力</label>
                          <input type="number" value={atkLan.lethality} onChange={(e) => setAtkLan({...atkLan, lethality: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                      </div>
                      <div className="bg-[#151c2c] p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="font-semibold text-slate-300">弓兵 (Marksmen)</div>
                        <div>
                          <label className="text-[10px] text-slate-400">攻撃力</label>
                          <input type="number" value={atkMar.atk} onChange={(e) => setAtkMar({...atkMar, atk: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">防御力</label>
                          <input type="number" value={atkMar.def} onChange={(e) => setAtkMar({...atkMar, def: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">体力</label>
                          <input type="number" value={atkMar.health} onChange={(e) => setAtkMar({...atkMar, health: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">負傷率 / 破壊力</label>
                          <input type="number" value={atkMar.lethality} onChange={(e) => setAtkMar({...atkMar, lethality: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 space-y-4">
                    <div className="font-bold text-cyan-400">🦸 攻撃側 英雄編成 & スキル発動回数</div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">盾兵 (Shield Leader)</label>
                        <select 
                          value={attackerLeaderHeroes.infantry} 
                          onChange={(e) => setAttackerLeaderHeroes({...attackerLeaderHeroes, infantry: e.target.value})} 
                          className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-white"
                        >
                          <option value="">(選択してください)</option>
                          {shieldHeroes.map((hero) => <option key={hero.id} value={hero.name}>{hero.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">槍兵 (Spear Leader)</label>
                        <select 
                          value={attackerLeaderHeroes.lancers} 
                          onChange={(e) => setAttackerLeaderHeroes({...attackerLeaderHeroes, lancers: e.target.value})} 
                          className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-white"
                        >
                          <option value="">(選択してください)</option>
                          {spearHeroes.map((hero) => <option key={hero.id} value={hero.name}>{hero.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">弓兵 (Bow Leader)</label>
                        <select 
                          value={attackerLeaderHeroes.marksmen} 
                          onChange={(e) => setAttackerLeaderHeroes({...attackerLeaderHeroes, marksmen: e.target.value})} 
                          className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-white"
                        >
                          <option value="">(選択してください)</option>
                          {bowHeroes.map((hero) => <option key={hero.id} value={hero.name}>{hero.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      {renderHeroSkillsInput('attacker', attackerLeaderHeroes.infantry, '盾リーダー')}
                      {renderHeroSkillsInput('attacker', attackerLeaderHeroes.lancers, '槍リーダー')}
                      {renderHeroSkillsInput('attacker', attackerLeaderHeroes.marksmen, '弓リーダー')}
                    </div>

                    <div className="bg-[#151c2c] p-3 rounded-lg border border-slate-800 space-y-2 mt-4">
                      <span className="text-[11px] font-bold text-slate-300">🤝 Joiner 英雄選択（4体）</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {attackerJoinerHeroes.map((heroVal, idx) => (
                          <div key={idx}>
                            <label className="block text-[10px] text-slate-400 mb-1">Joiner #{idx + 1}</label>
                            <select 
                              value={heroVal} 
                              onChange={(e) => {
                                const updated = [...attackerJoinerHeroes];
                                updated[idx] = e.target.value;
                                setAttackerJoinerHeroes(updated);
                              }} 
                              className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white text-xs"
                            >
                              <option value="">(選択なし)</option>
                              {joinerHeroes.map((hero) => <option key={hero.id} value={hero.name}>{hero.name}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-cyan-400">🛡️ 攻撃側 兵士明細</div>
                      <button type="button" onClick={() => handleAddUnit('attacker')} className="px-3 py-1 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded text-[11px] font-bold cursor-pointer">＋ 兵士行を追加</button>
                    </div>
                    <div className="space-y-2">
                      {attackerTroops.map((unit) => (
                        <div key={unit.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#151c2c] p-3 rounded-lg border border-slate-800 items-end">
                          <div>
                            <label className="text-[10px] text-slate-400">兵種</label>
                            <select value={unit.type} onChange={(e) => handleUpdateUnit('attacker', unit.id, 'type', e.target.value)} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white">
                              <option value="Infantry">盾兵</option>
                              <option value="Lancers">槍兵</option>
                              <option value="Marksmen">弓兵</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">Tier</label>
                            <input type="text" value={unit.tier} onChange={(e) => handleUpdateUnit('attacker', unit.id, 'tier', e.target.value)} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">FC</label>
                            <input type="number" value={unit.fc_level} onChange={(e) => handleUpdateUnit('attacker', unit.id, 'fc_level', Number(e.target.value))} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">出陣数</label>
                            <input type="number" value={unit.quantity} onChange={(e) => handleUpdateUnit('attacker', unit.id, 'quantity', Number(e.target.value))} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">生存数</label>
                            <input type="number" value={unit.survived} onChange={(e) => handleUpdateUnit('attacker', unit.id, 'survived', Number(e.target.value))} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div className="flex items-center">
                            <button type="button" onClick={() => handleRemoveUnit('attacker', unit.id)} className="w-full py-1.5 bg-rose-950 text-rose-400 border border-rose-900 rounded font-bold cursor-pointer">削除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'defender' && (
                <div className="space-y-6">
                  <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 space-y-4">
                    <div className="font-bold text-rose-400">📊 防御側 兵種別ステータス</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-[#151c2c] p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="font-semibold text-slate-300">盾兵 (Infantry)</div>
                        <div>
                          <label className="text-[10px] text-slate-400">攻撃力</label>
                          <input type="number" value={defInf.atk} onChange={(e) => setDefInf({...defInf, atk: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">防御力</label>
                          <input type="number" value={defInf.def} onChange={(e) => setDefInf({...defInf, def: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">体力</label>
                          <input type="number" value={defInf.health} onChange={(e) => setDefInf({...defInf, health: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">負傷率 / 破壊力</label>
                          <input type="number" value={defInf.lethality} onChange={(e) => setDefInf({...defInf, lethality: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                      </div>
                      <div className="bg-[#151c2c] p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="font-semibold text-slate-300">槍兵 (Lancers)</div>
                        <div>
                          <label className="text-[10px] text-slate-400">攻撃力</label>
                          <input type="number" value={defLan.atk} onChange={(e) => setDefLan({...defLan, atk: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">防御力</label>
                          <input type="number" value={defLan.def} onChange={(e) => setDefLan({...defLan, def: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">体力</label>
                          <input type="number" value={defLan.health} onChange={(e) => setDefLan({...defLan, health: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">負傷率 / 破壊力</label>
                          <input type="number" value={defLan.lethality} onChange={(e) => setDefLan({...defLan, lethality: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                      </div>
                      <div className="bg-[#151c2c] p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="font-semibold text-slate-300">弓兵 (Marksmen)</div>
                        <div>
                          <label className="text-[10px] text-slate-400">攻撃力</label>
                          <input type="number" value={defMar.atk} onChange={(e) => setDefMar({...defMar, atk: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">防御力</label>
                          <input type="number" value={defMar.def} onChange={(e) => setDefMar({...defMar, def: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">体力</label>
                          <input type="number" value={defMar.health} onChange={(e) => setDefMar({...defMar, health: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">負傷率 / 破壊力</label>
                          <input type="number" value={defMar.lethality} onChange={(e) => setDefMar({...defMar, lethality: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 space-y-4">
                    <div className="font-bold text-rose-400">🦸 防御側 英雄編成 & スキル発動回数</div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">盾兵 (Shield Leader)</label>
                        <select 
                          value={defenderLeaderHeroes.infantry} 
                          onChange={(e) => setDefenderLeaderHeroes({...defenderLeaderHeroes, infantry: e.target.value})} 
                          className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-white"
                        >
                          <option value="">(選択してください)</option>
                          {shieldHeroes.map((hero) => <option key={hero.id} value={hero.name}>{hero.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">槍兵 (Spear Leader)</label>
                        <select 
                          value={defenderLeaderHeroes.lancers} 
                          onChange={(e) => setDefenderLeaderHeroes({...defenderLeaderHeroes, lancers: e.target.value})} 
                          className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-white"
                        >
                          <option value="">(選択してください)</option>
                          {spearHeroes.map((hero) => <option key={hero.id} value={hero.name}>{hero.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">弓兵 (Bow Leader)</label>
                        <select 
                          value={defenderLeaderHeroes.marksmen} 
                          onChange={(e) => setDefenderLeaderHeroes({...defenderLeaderHeroes, marksmen: e.target.value})} 
                          className="w-full bg-[#151c2c] border border-slate-700 rounded p-2 text-white"
                        >
                          <option value="">(選択してください)</option>
                          {bowHeroes.map((hero) => <option key={hero.id} value={hero.name}>{hero.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      {renderHeroSkillsInput('defender', defenderLeaderHeroes.infantry, '盾リーダー')}
                      {renderHeroSkillsInput('defender', defenderLeaderHeroes.lancers, '槍リーダー')}
                      {renderHeroSkillsInput('defender', defenderLeaderHeroes.marksmen, '弓リーダー')}
                    </div>

                    <div className="bg-[#151c2c] p-3 rounded-lg border border-slate-800 space-y-2 mt-4">
                      <span className="text-[11px] font-bold text-slate-300">🤝 Joiner 英雄選択（4体）</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {defenderJoinerHeroes.map((heroVal, idx) => (
                          <div key={idx}>
                            <label className="block text-[10px] text-slate-400 mb-1">Joiner #{idx + 1}</label>
                            <select 
                              value={heroVal} 
                              onChange={(e) => {
                                const updated = [...defenderJoinerHeroes];
                                updated[idx] = e.target.value;
                                setDefenderJoinerHeroes(updated);
                              }} 
                              className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white text-xs"
                            >
                              <option value="">(選択なし)</option>
                              {joinerHeroes.map((hero) => <option key={hero.id} value={hero.name}>{hero.name}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-rose-400">🛡️ 防御側 兵士明細</div>
                      <button type="button" onClick={() => handleAddUnit('defender')} className="px-3 py-1 bg-rose-950 text-rose-400 border border-rose-800 rounded text-[11px] font-bold cursor-pointer">＋ 兵士行を追加</button>
                    </div>
                    <div className="space-y-2">
                      {defenderTroops.map((unit) => (
                        <div key={unit.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#151c2c] p-3 rounded-lg border border-slate-800 items-end">
                          <div>
                            <label className="text-[10px] text-slate-400">兵種</label>
                            <select value={unit.type} onChange={(e) => handleUpdateUnit('defender', unit.id, 'type', e.target.value)} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white">
                              <option value="Infantry">盾兵</option>
                              <option value="Lancers">槍兵</option>
                              <option value="Marksmen">弓兵</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">Tier</label>
                            <input type="text" value={unit.tier} onChange={(e) => handleUpdateUnit('defender', unit.id, 'tier', e.target.value)} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">FC</label>
                            <input type="number" value={unit.fc_level} onChange={(e) => handleUpdateUnit('defender', unit.id, 'fc_level', Number(e.target.value))} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">出陣数</label>
                            <input type="number" value={unit.quantity} onChange={(e) => handleUpdateUnit('defender', unit.id, 'quantity', Number(e.target.value))} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">生存数</label>
                            <input type="number" value={unit.survived} onChange={(e) => handleUpdateUnit('defender', unit.id, 'survived', Number(e.target.value))} className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div className="flex items-center">
                            <button type="button" onClick={() => handleRemoveUnit('defender', unit.id)} className="w-full py-1.5 bg-rose-950 text-rose-400 border border-rose-900 rounded font-bold cursor-pointer">削除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">メモ</label>
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="戦闘に関する気づきやメモを入力..." rows={3} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-white" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold cursor-pointer">キャンセル</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">登録する</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}