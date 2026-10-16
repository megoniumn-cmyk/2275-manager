'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TroopEntry {
  level: string;
  count: string;
}

interface HeroMaster {
  id?: string;
  name: string;
  troop_type: string;
  display_order: number;
  joiner_setting?: boolean;
}

interface SkillEntry {
  act: string;
  kill: string;
}

interface BattleReportFormUIProps {
  heroList: HeroMaster[];
  initialGen?: string;
  initialParsedData?: any;
  onSubmit: (formData: {
    reportDate: string;
    gen: string;
    bluePlayer: any;
    redPlayer: any;
    blueTroops: any;
    redTroops: any;
    blueStats: any;
    redStats: any;
    heroes: any;
    blueRidingHeroes: string[];
    redRidingHeroes: string[];
  }) => void;
}

export default function BattleReportFormUI({
  heroList,
  initialGen = 'Gen1',
  initialParsedData,
  onSubmit,
}: BattleReportFormUIProps) {
  const [rawText, setRawText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // コピー用プロンプトテキスト
  const promptTemplate = `添付された4枚の戦闘結果画像（1枚目：戦闘概要、2枚目：追加ステータス、3・4枚目：英雄スキル詳細）の情報を読み取り、以下の【出力フォーマット】に従って正確にテキスト化してください。
一括でコピーできるようにコードブロックにまとめてください。

【出力フォーマット】
1. 戦闘概要（1枚目画像）
-レポート日時：右上
- 左側プレイヤー（青陣営）:
- 形態: （※アイコンの左上が「盾」なら駐屯、「剣」なら集結と記載）
  - アカウント名: 
  - パワー減少量 / 戦闘力等: 
  - 部隊: 
  - 損失: 
  - 負傷: 
  - 軽傷: 
  - 生存: 
- 右側プレイヤー（赤陣営）:
- 形態: （※アイコンの右上が「盾」なら駐屯、「剣」なら集結と記載）
  - アカウント名: 
  - パワー減少量 / 戦闘力等: 
  - 部隊: 
  - 損失: 
  - 負傷: 
  - 軽傷: 
  - 生存: 

2. 兵士数(2枚目画像)
- 左側プレイヤー / 右側プレイヤー
- 盾兵: [Lv][兵士数] / [Lv][兵士数] 
- 槍兵: [Lv][兵士数] / [Lv][兵士数] 
- 弓兵: [Lv][兵士数] / [Lv][兵士数] 
横棒グラフに記載がなければ兵士数0
下のアイコンは左から盾兵、槍兵、弓兵
その下が総兵士数

3. 追加ステータス（3枚目画像）
- 左側プレイヤー / 右側プレイヤー
- 盾兵攻撃力: [左] / [右]
- 盾兵防御力: [左] / [Right]
- 盾兵殺傷力: [左] / [Right]
- 盾兵HP: [左] / [Right]
- 槍兵攻撃力: [左] / [Right]
- 槍兵防御力: [左] / [Right]
- 槍兵殺傷力: [左] / [Right]
- 槍兵HP: [左] / [Right]
- 弓兵攻撃力: [左] / [Right]
- 弓兵防御力: [Left] / [Right]
- 弓兵殺傷力: [Left] / [Right]
- 弓兵HP: [Left] / [Right]

4. 英雄スキル詳細（4・5枚目画像、重複部分は統合）
※各英雄ごとに、上から順にスキル1〜5（または4か3）の発動数とキル数を記載してください。

■ 英雄1: [左側の英雄名] vs [右側の英雄名]
- 左側（[左側の英雄名]）:
  - スキル1: 発動 [数], キル [数]
  - スキル2: 発動 [数], キル [数]
  - スキル3: 発動 [数], キル [数]
  - スキル4: 発動 [数], キル [数]（※存在する場合のみ）
- 右側（[右側の英雄名]）:
  - スキル1: 発動 [数], キル [数]
  - スキル2: 発動 [数], キル [数]
  - スキル3: 発動 [数], キル [数]
  - スキル4: 発動 [数], キル [数]（※存在する場合のみ）

■ 英雄2: [左側の英雄名] vs [右側の英雄名]
（※同様に記載）

■ 英雄3: [左側の英雄名] vs [Right側の英雄名]
（※同様に記載）`;

  const handleCopyPrompt = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(promptTemplate);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = promptTemplate;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      alert('コピーに失敗しました');
    }
  };

  // 1. 戦闘概要
  const [reportDate, setReportDate] = useState('');
  const [gen, setGen] = useState(initialGen);
  const [bluePlayer, setBluePlayer] = useState({ name: '', form: '集結', power: '', troops: '', wounded: '', slightWounded: '', losses: '', survival: '' });
  const [redPlayer, setRedPlayer] = useState({ name: '', form: '集結', power: '', troops: '', wounded: '', slightWounded: '', losses: '', survival: '' });

  // 2. 兵士数
  const [blueTroops, setBlueTroops] = useState<{
    shield: TroopEntry[];
    spear: TroopEntry[];
    bow: TroopEntry[];
  }>({
    shield: [{ level: '', count: '' }],
    spear: [{ level: '', count: '' }],
    bow: [{ level: '', count: '' }],
  });

  const [redTroops, setRedTroops] = useState<{
    shield: TroopEntry[];
    spear: TroopEntry[];
    bow: TroopEntry[];
  }>({
    shield: [{ level: '', count: '' }],
    spear: [{ level: '', count: '' }],
    bow: [{ level: '', count: '' }],
  });

  // 3. 追加ステータス
  const [blueStats, setBlueStats] = useState({
    shieldAtk: '', shieldDef: '', shieldLeth: '', shieldHp: '',
    spearAtk: '', spearDef: '', spearLeth: '', spearHp: '',
    bowAtk: '', bowDef: '', bowLeth: '', bowHp: '',
  });
  const [redStats, setRedStats] = useState({
    shieldAtk: '', shieldDef: '', shieldLeth: '', shieldHp: '',
    spearAtk: '', spearDef: '', spearLeth: '', spearHp: '',
    bowAtk: '', bowDef: '', bowLeth: '', bowHp: '',
  });

  // 4. 英雄スキル詳細
  const [heroes, setHeroes] = useState([
    {
      title: '英雄1（盾英雄）', type: 'shield',
      nameLeft: '', nameRight: '',
      skillsLeft: [
        { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }
      ] as SkillEntry[],
      skillsRight: [
        { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }
      ] as SkillEntry[]
    },
    {
      title: '英雄2（槍英雄）', type: 'spear',
      nameLeft: '', nameRight: '',
      skillsLeft: [
        { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }
      ] as SkillEntry[],
      skillsRight: [
        { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }
      ] as SkillEntry[]
    },
    {
      title: '英雄3（弓英雄）', type: 'bow',
      nameLeft: '', nameRight: '',
      skillsLeft: [
        { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }
      ] as SkillEntry[],
      skillsRight: [
        { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }, { act: '', kill: '' }
      ] as SkillEntry[]
    },
  ]);

  const [blueRidingHeroes, setBlueRidingHeroes] = useState<string[]>(['', '', '', '']);
  const [redRidingHeroes, setRedRidingHeroes] = useState<string[]>(['', '', '', '']);

  // 共通のテキストパース実行ロジック
  const parseTextToState = (text: string) => {
    if (!text) return;

    const dateMatch = text.match(/-?レポート日時[：:]\s*([^\n]+)/);
    if (dateMatch) setReportDate(dateMatch[1].trim());

    const leftBlockMatch = text.match(/左側プレイヤー（青陣営）[\s\S]*?(?=- 右側プレイヤー（赤陣営）|2\.兵士数|$)/);
    const rightBlockMatch = text.match(/右側プレイヤー（赤陣営）[\s\S]*?(?=2\.兵士数|$)/);

    if (leftBlockMatch) {
      const lb = leftBlockMatch[0];
      const formMatch = lb.match(/-?\s*形態[：:]\s*([^\n]+)/);
      const nameMatch = lb.match(/-?\s*アカウント名[：:]\s*([^\n]+)/);
      const powerMatch = lb.match(/-?\s*パワー減少量.*?([：:])\s*([^\n]+)/);
      const troopsMatch = lb.match(/-?\s*部隊[：:]\s*([^\n]+)/);
      const lossesMatch = lb.match(/-?\s*損失[：:]\s*([^\n]+)/);
      const woundedMatch = lb.match(/-?\s*負傷[：:]\s*([^\n]+)/);
      const slightMatch = lb.match(/-?\s*軽傷[：:]\s*([^\n]+)/);
      const survivalMatch = lb.match(/-?\s*生存[：:]\s*([^\n]+)/);

      setBluePlayer(prev => ({
        ...prev,
        form: formMatch ? formMatch[1].trim() : prev.form,
        name: nameMatch ? nameMatch[1].trim() : prev.name,
        power: powerMatch ? powerMatch[2].trim() : prev.power,
        troops: troopsMatch ? troopsMatch[1].trim() : prev.troops,
        losses: lossesMatch ? lossesMatch[1].trim() : prev.losses,
        wounded: woundedMatch ? woundedMatch[1].trim() : prev.wounded,
        slightWounded: slightMatch ? slightMatch[1].trim() : prev.slightWounded,
        survival: survivalMatch ? survivalMatch[1].trim() : prev.survival,
      }));
    }

    if (rightBlockMatch) {
      const rb = rightBlockMatch[0];
      const formMatch = rb.match(/-?\s*形態[：:]\s*([^\n]+)/);
      const nameMatch = rb.match(/-?\s*アカウント名[：:]\s*([^\n]+)/);
      const powerMatch = rb.match(/-?\s*パワー減少量.*?([：:])\s*([^\n]+)/);
      const troopsMatch = rb.match(/-?\s*部隊[：:]\s*([^\n]+)/);
      const lossesMatch = rb.match(/-?\s*損失[：:]\s*([^\n]+)/);
      const woundedMatch = rb.match(/-?\s*負傷[：:]\s*([^\n]+)/);
      const slightMatch = rb.match(/-?\s*軽傷[：:]\s*([^\n]+)/);
      const survivalMatch = rb.match(/-?\s*生存[：:]\s*([^\n]+)/);

      setRedPlayer(prev => ({
        ...prev,
        form: formMatch ? formMatch[1].trim() : prev.form,
        name: nameMatch ? nameMatch[1].trim() : prev.name,
        power: powerMatch ? powerMatch[2].trim() : prev.power,
        troops: troopsMatch ? troopsMatch[1].trim() : prev.troops,
        losses: lossesMatch ? lossesMatch[1].trim() : prev.losses,
        wounded: woundedMatch ? woundedMatch[1].trim() : prev.wounded,
        slightWounded: slightMatch ? slightMatch[1].trim() : prev.slightWounded,
        survival: survivalMatch ? survivalMatch[1].trim() : prev.survival,
      }));
    }

    const parseStat = (label: string) => {
      const reg = new RegExp(`${label}[：:]\\s*([^\\/\n]+)\\/\\s*([^\n]+)`);
      const m = text.match(reg);
      return m ? { left: m[1].trim(), right: m[2].trim() } : { left: '', right: '' };
    };

    const sInAtk = parseStat('盾兵攻撃力');
    const sInDef = parseStat('盾兵防御力');
    const sInLeth = parseStat('盾兵殺傷力');
    const sInHp = parseStat('盾兵HP');

    const sLaAtk = parseStat('槍兵攻撃力');
    const sLaDef = parseStat('槍兵防御力');
    const sLaLeth = parseStat('槍兵殺傷力');
    const sLaHp = parseStat('槍兵HP');

    const sMaAtk = parseStat('弓兵攻撃力');
    const sMaDef = parseStat('弓兵防御力');
    const sMaLeth = parseStat('弓兵殺傷力');
    const sMaHp = parseStat('弓兵HP');

    setBlueStats(prev => ({
      ...prev,
      shieldAtk: sInAtk.left, shieldDef: sInDef.left, shieldLeth: sInLeth.left, shieldHp: sInHp.left,
      spearAtk: sLaAtk.left, spearDef: sLaDef.left, spearLeth: sLaLeth.left, spearHp: sLaHp.left,
      bowAtk: sMaAtk.left, bowDef: sMaDef.left, bowLeth: sMaLeth.left, bowHp: sMaHp.left,
    }));

    setRedStats(prev => ({
      ...prev,
      shieldAtk: sInAtk.right, shieldDef: sInDef.right, shieldLeth: sInLeth.right, shieldHp: sInHp.right,
      spearAtk: sLaAtk.right, spearDef: sLaDef.right, spearLeth: sLaLeth.right, spearHp: sLaHp.right,
      bowAtk: sMaAtk.right, bowDef: sMaDef.right, bowLeth: sMaLeth.right, bowHp: sMaHp.right,
    }));
  };

  // initialParsedData が渡された場合に自動反映する
  useEffect(() => {
    if (initialParsedData) {
      if (typeof initialParsedData === 'string') {
        setRawText(initialParsedData);
        parseTextToState(initialParsedData);
      } else if (typeof initialParsedData === 'object') {
        if (initialParsedData.rawText) {
          setRawText(initialParsedData.rawText);
          parseTextToState(initialParsedData.rawText);
        }
      }
    }
  }, [initialParsedData]);

  // テキスト一括解析ボタンクリック時の処理
  const handleParseText = () => {
    if (!rawText) {
      alert('テキストが入力されていません。');
      return;
    }
    parseTextToState(rawText);
    alert('テキストの自動解析とフォームへの反映が完了しました！内容を確認してください。');
  };

  const getHeroesByType = (type: string) => {
    return heroList.filter(h => h.troop_type === type).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  };

  const getJoinerHeroes = () => {
    return heroList.filter(h => h.troop_type === 'joiner' && h.joiner_setting === true).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  };

  const addTroopRow = (side: 'blue' | 'red', type: 'shield' | 'spear' | 'bow') => {
    if (side === 'blue') {
      setBlueTroops(prev => ({ ...prev, [type]: [...prev[type], { level: '', count: '' }] }));
    } else {
      setRedTroops(prev => ({ ...prev, [type]: [...prev[type], { level: '', count: '' }] }));
    }
  };

  const removeTroopRow = (side: 'blue' | 'red', type: 'shield' | 'spear' | 'bow', index: number) => {
    if (side === 'blue') {
      setBlueTroops(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
    } else {
      setRedTroops(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
    }
  };

  const updateTroopRow = (side: 'blue' | 'red', type: 'shield' | 'spear' | 'bow', index: number, field: 'level' | 'count', value: string) => {
    if (side === 'blue') {
      const updated = [...blueTroops[type]];
      updated[index][field] = value;
      setBlueTroops(prev => ({ ...prev, [type]: updated }));
    } else {
      const updated = [...redTroops[type]];
      updated[index][field] = value;
      setRedTroops(prev => ({ ...prev, [type]: updated }));
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      reportDate,
      gen,
      bluePlayer,
      redPlayer,
      blueTroops,
      redTroops,
      blueStats,
      redStats,
      heroes,
      blueRidingHeroes,
      redRidingHeroes,
    });
  };

  return (
    <div className="p-6 text-white bg-gray-950 min-h-screen max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/strategy/reports" className="text-xs text-cyan-400 hover:underline">
          ← 戦闘レポート一覧に戻る
        </Link>
        <h1 className="text-xl font-bold mt-1">＋ 戦闘レポート新規登録</h1>
      </div>

      <form onSubmit={handleSubmitForm} className="space-y-6">
        
        {/* テキスト一括貼付 ＆ 取り込みボタン */}
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-cyan-400">スクショ自動解析 / テキスト一括貼付</h2>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="bg-gray-800 hover:bg-gray-700 text-cyan-300 px-3 py-1.5 rounded text-xs font-semibold transition border border-cyan-800/50 flex items-center gap-1.5 cursor-pointer"
            >
              {copySuccess ? '✅ コピー完了！' : '📋 プロンプトをコピー'}
            </button>
          </div>
          <textarea
            className="w-full h-32 bg-gray-950 border border-gray-700 rounded p-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-cyan-500"
            placeholder="ここにフォーマットのテキストを貼り付け..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <div>
            <button
              type="button"
              onClick={handleParseText}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-xs font-bold transition shadow cursor-pointer"
            >
              📥 テキストを自動解析してフォームに反映する
            </button>
          </div>
        </div>

        {/* 1. 戦闘概要 */}
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-4">
          <h2 className="text-sm font-semibold text-green-400">1. 戦闘概要</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">レポート日時</label>
              <input
                type="text"
                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-200"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                placeholder="例: 2026-09-26 22:11:35"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">世代 (Gen)</label>
              <select
                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-200"
                value={gen}
                onChange={(e) => setGen(e.target.value)}
              >
                {[...Array(18)].map((_, i) => (
                  <option key={`gen-${i+1}`} value={`Gen${i+1}`}>Gen {i+1}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-gray-950 rounded border border-blue-900/50 space-y-3">
              <h3 className="text-xs font-bold text-blue-400">左側プレイヤー（青陣営）</h3>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] text-gray-400">アカウント名</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={bluePlayer.name} onChange={e => setBluePlayer({...bluePlayer, name: e.target.value})} /></div>
                <div>
                  <label className="block text-[10px] text-gray-400">形態</label>
                  <select className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={bluePlayer.form} onChange={e => setBluePlayer({...bluePlayer, form: e.target.value})}>
                    <option value="集結">集結</option>
                    <option value="駐屯">駐屯</option>
                  </select>
                </div>
                <div><label className="block text-[10px] text-gray-400">パワー減少量等</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={bluePlayer.power} onChange={e => setBluePlayer({...bluePlayer, power: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">部隊</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={bluePlayer.troops} onChange={e => setBluePlayer({...bluePlayer, troops: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">重傷</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={bluePlayer.wounded} onChange={e => setBluePlayer({...bluePlayer, wounded: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">軽傷</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={bluePlayer.slightWounded} onChange={e => setBluePlayer({...bluePlayer, slightWounded: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">損失</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={bluePlayer.losses} onChange={e => setBluePlayer({...bluePlayer, losses: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">生存</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={bluePlayer.survival} onChange={e => setBluePlayer({...bluePlayer, survival: e.target.value})} /></div>
              </div>
            </div>

            <div className="p-3 bg-gray-950 rounded border border-red-900/50 space-y-3">
              <h3 className="text-xs font-bold text-red-400">右側プレイヤー（赤陣営）</h3>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] text-gray-400">アカウント名</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={redPlayer.name} onChange={e => setRedPlayer({...redPlayer, name: e.target.value})} /></div>
                <div>
                  <label className="block text-[10px] text-gray-400">形態</label>
                  <select className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={redPlayer.form} onChange={e => setRedPlayer({...redPlayer, form: e.target.value})}>
                    <option value="集結">集結</option>
                    <option value="駐屯">駐屯</option>
                  </select>
                </div>
                <div><label className="block text-[10px] text-gray-400">パワー減少量等</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={redPlayer.power} onChange={e => setRedPlayer({...redPlayer, power: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">部隊</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={redPlayer.troops} onChange={e => setRedPlayer({...redPlayer, troops: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">重傷</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={redPlayer.wounded} onChange={e => setRedPlayer({...redPlayer, wounded: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">軽傷</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={redPlayer.slightWounded} onChange={e => setRedPlayer({...redPlayer, slightWounded: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">損失</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={redPlayer.losses} onChange={e => setRedPlayer({...redPlayer, losses: e.target.value})} /></div>
                <div><label className="block text-[10px] text-gray-400">生存</label><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-200" value={redPlayer.survival} onChange={e => setRedPlayer({...redPlayer, survival: e.target.value})} /></div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 兵士数 */}
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-4">
          <h2 className="text-sm font-semibold text-green-400">2. 兵士数</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-950 rounded border border-blue-900/50 space-y-4">
              <h3 className="text-xs font-bold text-blue-400">左側プレイヤーの兵士数</h3>
              {(['shield', 'spear', 'bow'] as const).map(type => (
                <div key={`b-${type}`} className="space-y-2 pb-2 border-b border-gray-900">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-300 font-semibold">{type === 'shield' ? '盾兵' : type === 'spear' ? '槍兵' : '弓兵'}</span>
                    <button type="button" onClick={() => addTroopRow('blue', type)} className="text-[10px] text-cyan-400 hover:underline">＋ 兵士を追加</button>
                  </div>
                  {blueTroops[type].map((item, idx) => (
                    <div key={`b-${type}-${idx}`} className="flex items-center gap-2">
                      <select className="w-1/3 bg-gray-900 border border-gray-700 rounded p-1 text-xs text-gray-200" value={item.level} onChange={e => updateTroopRow('blue', type, idx, 'level', e.target.value)}>
                        <option value="">Lv選択</option>
                        {[...Array(12)].map((_, i) => (<option key={`lvl-${i+1}`} value={i+1}>Lv {i+1}</option>))}
                      </select>
                      <input type="text" className="w-1/2 bg-gray-900 border border-gray-700 rounded p-1 text-xs text-gray-200" placeholder="兵士数" value={item.count} onChange={e => updateTroopRow('blue', type, idx, 'count', e.target.value)} />
                      {blueTroops[type].length > 1 && (<button type="button" onClick={() => removeTroopRow('blue', type, idx)} className="text-red-400 text-xs px-1 hover:text-red-300">×</button>)}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="p-3 bg-gray-950 rounded border border-red-900/50 space-y-4">
              <h3 className="text-xs font-bold text-red-400">右側プレイヤーの兵士数</h3>
              {(['shield', 'spear', 'bow'] as const).map(type => (
                <div key={`r-${type}`} className="space-y-2 pb-2 border-b border-gray-900">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-300 font-semibold">{type === 'shield' ? '盾兵' : type === 'spear' ? '槍兵' : '弓兵'}</span>
                    <button type="button" onClick={() => addTroopRow('red', type)} className="text-[10px] text-cyan-400 hover:underline">＋ 兵士を追加</button>
                  </div>
                  {redTroops[type].map((item, idx) => (
                    <div key={`r-${type}-${idx}`} className="flex items-center gap-2">
                      <select className="w-1/3 bg-gray-900 border border-gray-700 rounded p-1 text-xs text-gray-200" value={item.level} onChange={e => updateTroopRow('red', type, idx, 'level', e.target.value)}>
                        <option value="">Lv選択</option>
                        {[...Array(12)].map((_, i) => (<option key={`lvl-${i+1}`} value={i+1}>Lv {i+1}</option>))}
                      </select>
                      <input type="text" className="w-1/2 bg-gray-900 border border-gray-700 rounded p-1 text-xs text-gray-200" placeholder="兵士数" value={item.count} onChange={e => updateTroopRow('red', type, idx, 'count', e.target.value)} />
                      {redTroops[type].length > 1 && (<button type="button" onClick={() => removeTroopRow('red', type, idx)} className="text-red-400 text-xs px-1 hover:text-red-300">×</button>)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. 追加ステータス */}
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-4">
          <h2 className="text-sm font-semibold text-green-400">3. 追加ステータス</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-950 rounded border border-blue-900/50 space-y-3">
              <h3 className="text-xs font-bold text-blue-400">左側ステータス</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[11px] text-gray-400">盾兵 (Attack / Defense / Lethality / HP)</span>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    <input type="text" placeholder="Atk" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.shieldAtk} onChange={e => setBlueStats({...blueStats, shieldAtk: e.target.value})} />
                    <input type="text" placeholder="Def" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.shieldDef} onChange={e => setBlueStats({...blueStats, shieldDef: e.target.value})} />
                    <input type="text" placeholder="Leth" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.shieldLeth} onChange={e => setBlueStats({...blueStats, shieldLeth: e.target.value})} />
                    <input type="text" placeholder="HP" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.shieldHp} onChange={e => setBlueStats({...blueStats, shieldHp: e.target.value})} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400">槍兵 (Attack / Defense / Lethality / HP)</span>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    <input type="text" placeholder="Atk" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.spearAtk} onChange={e => setBlueStats({...blueStats, spearAtk: e.target.value})} />
                    <input type="text" placeholder="Def" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.spearDef} onChange={e => setBlueStats({...blueStats, spearDef: e.target.value})} />
                    <input type="text" placeholder="Leth" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.spearLeth} onChange={e => setBlueStats({...blueStats, spearLeth: e.target.value})} />
                    <input type="text" placeholder="HP" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.spearHp} onChange={e => setBlueStats({...blueStats, spearHp: e.target.value})} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400">弓兵 (Attack / Defense / Lethality / HP)</span>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    <input type="text" placeholder="Atk" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.bowAtk} onChange={e => setBlueStats({...blueStats, bowAtk: e.target.value})} />
                    <input type="text" placeholder="Def" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.bowDef} onChange={e => setBlueStats({...blueStats, bowDef: e.target.value})} />
                    <input type="text" placeholder="Leth" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.bowLeth} onChange={e => setBlueStats({...blueStats, bowLeth: e.target.value})} />
                    <input type="text" placeholder="HP" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={blueStats.bowHp} onChange={e => setBlueStats({...blueStats, bowHp: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-950 rounded border border-red-900/50 space-y-3">
              <h3 className="text-xs font-bold text-red-400">右側ステータス</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[11px] text-gray-400">盾兵 (Attack / Defense / Lethality / HP)</span>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    <input type="text" placeholder="Atk" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.shieldAtk} onChange={e => setRedStats({...redStats, shieldAtk: e.target.value})} />
                    <input type="text" placeholder="Def" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.shieldDef} onChange={e => setRedStats({...redStats, shieldDef: e.target.value})} />
                    <input type="text" placeholder="Leth" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.shieldLeth} onChange={e => setRedStats({...redStats, shieldLeth: e.target.value})} />
                    <input type="text" placeholder="HP" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.shieldHp} onChange={e => setRedStats({...redStats, shieldHp: e.target.value})} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400">槍兵 (Attack / Defense / Lethality / HP)</span>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    <input type="text" placeholder="Atk" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.spearAtk} onChange={e => setRedStats({...redStats, spearAtk: e.target.value})} />
                    <input type="text" placeholder="Def" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.spearDef} onChange={e => setRedStats({...redStats, spearDef: e.target.value})} />
                    <input type="text" placeholder="Leth" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.spearLeth} onChange={e => setRedStats({...redStats, spearLeth: e.target.value})} />
                    <input type="text" placeholder="HP" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.spearHp} onChange={e => setRedStats({...redStats, spearHp: e.target.value})} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400">弓兵 (Attack / Defense / Lethality / HP)</span>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    <input type="text" placeholder="Atk" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.bowAtk} onChange={e => setRedStats({...redStats, bowAtk: e.target.value})} />
                    <input type="text" placeholder="Def" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.bowDef} onChange={e => setRedStats({...redStats, bowDef: e.target.value})} />
                    <input type="text" placeholder="Leth" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.bowLeth} onChange={e => setRedStats({...redStats, bowLeth: e.target.value})} />
                    <input type="text" placeholder="HP" className="bg-gray-900 border border-gray-700 rounded p-1 text-gray-200" value={redStats.bowHp} onChange={e => setRedStats({...redStats, bowHp: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. 英雄スキル詳細 */}
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-4">
          <h2 className="text-sm font-semibold text-green-400">4. 英雄スキル詳細</h2>
          {heroes.map((heroSection, hIndex) => (
            <div key={`hero-sec-${hIndex}`} className="p-3 bg-gray-950 rounded border border-gray-800 space-y-3">
              <span className="text-xs font-bold text-cyan-400">{heroSection.title}</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 左側英雄 */}
                <div className="space-y-3 p-2.5 bg-gray-900/50 rounded border border-blue-950">
                  <div>
                    <label className="block text-[10px] text-blue-400 mb-1">左側 英雄名</label>
                    <select
                      className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-xs text-gray-200"
                      value={heroSection.nameLeft}
                      onChange={e => {
                        const updated = [...heroes];
                        updated[hIndex].nameLeft = e.target.value;
                        setHeroes(updated);
                      }}
                    >
                      <option value="">英雄を選択</option>
                      {getHeroesByType(heroSection.type).map(h => (
                        <option key={`bl-${h.name}`} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-gray-400 font-semibold">スキル 1〜5 (発動数 / キル数)</span>
                    {[0, 1, 2, 3, 4].map((sIndex) => (
                      <div key={`bl-s-${sIndex}`} className="flex items-center gap-1.5 text-xs">
                        <span className="w-12 text-[10px] text-gray-400">スキル{sIndex + 1}</span>
                        <input
                          type="text"
                          placeholder="発動"
                          className="w-1/2 bg-gray-950 border border-gray-700 rounded p-1 text-gray-200 text-center"
                          value={heroSection.skillsLeft[sIndex].act}
                          onChange={e => {
                            const updated = [...heroes];
                            updated[hIndex].skillsLeft[sIndex].act = e.target.value;
                            setHeroes(updated);
                          }}
                        />
                        <input
                          type="text"
                          placeholder="キル"
                          className="w-1/2 bg-gray-950 border border-gray-700 rounded p-1 text-gray-200 text-center"
                          value={heroSection.skillsLeft[sIndex].kill}
                          onChange={e => {
                            const updated = [...heroes];
                            updated[hIndex].skillsLeft[sIndex].kill = e.target.value;
                            setHeroes(updated);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 右側英雄 */}
                <div className="space-y-3 p-2.5 bg-gray-900/50 rounded border border-red-950">
                  <div>
                    <label className="block text-[10px] text-red-400 mb-1">右側 英雄名</label>
                    <select
                      className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-xs text-gray-200"
                      value={heroSection.nameRight}
                      onChange={e => {
                        const updated = [...heroes];
                        updated[hIndex].nameRight = e.target.value;
                        setHeroes(updated);
                      }}
                    >
                      <option value="">英雄を選択</option>
                      {getHeroesByType(heroSection.type).map(h => (
                        <option key={`br-${h.name}`} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-gray-400 font-semibold">スキル 1〜5 (発動数 / キル数)</span>
                    {[0, 1, 2, 3, 4].map((sIndex) => (
                      <div key={`br-s-${sIndex}`} className="flex items-center gap-1.5 text-xs">
                        <span className="w-12 text-[10px] text-gray-400">スキル{sIndex + 1}</span>
                        <input
                          type="text"
                          placeholder="発動"
                          className="w-1/2 bg-gray-950 border border-gray-700 rounded p-1 text-gray-200 text-center"
                          value={heroSection.skillsRight[sIndex].act}
                          onChange={e => {
                            const updated = [...heroes];
                            updated[hIndex].skillsRight[sIndex].act = e.target.value;
                            setHeroes(updated);
                          }}
                        />
                        <input
                          type="text"
                          placeholder="キル"
                          className="w-1/2 bg-gray-950 border border-gray-700 rounded p-1 text-gray-200 text-center"
                          value={heroSection.skillsRight[sIndex].kill}
                          onChange={e => {
                            const updated = [...heroes];
                            updated[hIndex].skillsRight[sIndex].kill = e.target.value;
                            setHeroes(updated);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 乗り英雄 */}
          <div className="p-3 bg-gray-950 rounded border border-gray-800 space-y-3">
            <h3 className="text-xs font-bold text-cyan-400">乗り英雄（集結参加など）</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] text-blue-400">左側 乗り英雄 (4枠)</label>
                {blueRidingHeroes.map((rh, idx) => (
                  <select
                    key={`bl-rh-${idx}`}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-xs text-gray-200 mb-1"
                    value={rh}
                    onChange={e => {
                      const updated = [...blueRidingHeroes];
                      updated[idx] = e.target.value;
                      setBlueRidingHeroes(updated);
                    }}
                  >
                    <option value="">乗り英雄 {idx + 1} を選択</option>
                    {getJoinerHeroes().map(jh => (
                      <option key={`j-bl-${jh.name}-${idx}`} value={jh.name}>{jh.name}</option>
                    ))}
                  </select>
                ))}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] text-red-400">右側 乗り英雄 (4枠)</label>
                {redRidingHeroes.map((rh, idx) => (
                  <select
                    key={`rd-rh-${idx}`}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-xs text-gray-200 mb-1"
                    value={rh}
                    onChange={e => {
                      const updated = [...redRidingHeroes];
                      updated[idx] = e.target.value;
                      setRedRidingHeroes(updated);
                    }}
                  >
                    <option value="">乗り英雄 {idx + 1} を選択</option>
                    {getJoinerHeroes().map(jh => (
                      <option key={`j-rd-${jh.name}-${idx}`} value={jh.name}>{jh.name}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 登録・キャンセルボタン */}
        <div className="flex gap-4 pt-4 pb-12">
          <button
            type="submit"
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded text-sm font-bold transition shadow-lg cursor-pointer"
          >
            データを保存する
          </button>
          <Link
            href="/strategy/reports"
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-3 rounded text-sm transition flex items-center justify-center"
          >
            キャンセル
          </Link>
        </div>

      </form>
    </div>
  );
}