'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import BattleReportFormUI from '../components/BattleReportFormUI';
import { parseReportText, ParsedReportData } from '../utils/parseReportText';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface HeroMaster {
  id?: string;
  name: string;
  troop_type: string;
  display_order: number;
  joiner_setting?: boolean;
}

export default function NewBattleReportPage() {
  const router = useRouter();
  const [heroList, setHeroList] = useState<HeroMaster[]>([]);
  const [initialGen, setInitialGen] = useState<string>('Gen1');
  const [loading, setLoading] = useState(true);

  // テキスト解析結果のデータを保持するステート
  const [parsedData, setParsedData] = useState<ParsedReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. 英雄マスターデータの取得
        const { data: heroData, error: heroError } = await supabase
          .from('heroes')
          .select('*')
          .order('display_order', { ascending: true });

        if (heroError) {
          console.error('英雄マスターの取得に失敗しました:', heroError);
        } else if (heroData) {
          setHeroList(heroData);
        }

        // 2. report_basic から最新データの gen を取得
        const { data: reportData, error: reportError } = await supabase
          .from('report_basic')
          .select('gen, created_at')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!reportError && reportData && reportData.length > 0) {
          setInitialGen(reportData[0].gen || 'Gen1');
        }
      } catch (err) {
        console.error('初期化エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 【ステップ2】テキストエリアの文字列を受け取り、パースしてステートにセットするハンドラー
  const handleParseText = (rawText: string) => {
    try {
      const result = parseReportText(rawText);
      setParsedData(result);
      alert('テキストの解析が完了し、フォームに反映しました！');
    } catch (err) {
      console.error('テキスト解析エラー:', err);
      alert('テキストの解析に失敗しました。フォーマットを確認してください。');
    }
  };

  // 【ステップ3】フォームのデータを最終的にDB（report_basic & report_troop）へ登録する処理
  const handleFormSubmit = async (formData: any) => {
    try {
      setLoading(true);

      // 1. report_basic へのインサート
      const { error: basicError } = await supabase.from('report_basic').insert([
        {
          reportdate: formData.reportDate,
          gen: formData.gen,
          // 左側プレイヤー
          left_name: formData.leftName,
          left_position: formData.leftPosition,
          left_power: formData.leftPower,
          left_troops: formData.leftTroops,
          left_losses: formData.leftLosses,
          left_injured: formData.leftInjured,
          left_lightlyinjured: formData.leftLightlyInjured,
          left_survivors: formData.leftSurvivors,
          // 右側プレイヤー
          right_name: formData.rightName,
          right_position: formData.rightPosition,
          right_power: formData.rightPower,
          right_troops: formData.rightTroops,
          right_losses: formData.rightLosses,
          right_injured: formData.rightInjured,
          right_lightlyinjured: formData.rightLightlyInjured,
          right_survivors: formData.rightSurvivors,
          // 追加ステータス（左）
          left_in_attack: formData.leftInAttack,
          left_in_defense: formData.leftInDefense,
          left_in_lethality: formData.leftInLethality,
          left_in_hp: formData.leftInHp,
          left_la_attack: formData.leftLaAttack,
          left_la_defense: formData.leftLaDefense,
          left_la_lethality: formData.leftLaLethality,
          left_la_hp: formData.leftLaHp,
          left_ma_attack: formData.leftMaAttack,
          left_ma_defense: formData.leftMaDefense,
          left_ma_lethality: formData.leftMaLethality,
          left_ma_hp: formData.leftMaHp,
          // 追加ステータス（右）
          right_in_attack: formData.rightInAttack,
          right_in_defense: formData.rightInDefense,
          right_in_lethality: formData.rightInLethality,
          right_in_hp: formData.rightInHp,
          right_la_attack: formData.rightLaAttack,
          right_la_defense: formData.rightLaDefense,
          right_la_lethality: formData.rightLaLethality,
          right_la_hp: formData.rightLaHp,
          right_ma_attack: formData.rightMaAttack,
          right_ma_defense: formData.rightMaDefense,
          right_ma_lethality: formData.rightMaLethality,
          right_ma_hp: formData.rightMaHp,
          // 英雄1〜3（スキル含む）
          left_hero1: formData.leftHero1,
          left_hero1_skill1_trun: formData.leftHero1Skill1Trun,
          left_hero1_skill1_kill: formData.leftHero1Skill1Kill,
          left_hero1_skill2_trun: formData.leftHero1Skill2Trun,
          left_hero1_skill2_kill: formData.leftHero1Skill2Kill,
          left_hero1_skill3_trun: formData.leftHero1Skill3Trun,
          left_hero1_skill3_kill: formData.leftHero1Skill3Kill,
          left_hero1_skill4_trun: formData.leftHero1Skill4Trun,
          left_hero1_skill4_kill: formData.leftHero1Skill4Kill,
          left_hero1_skill5_trun: formData.leftHero1Skill5Trun,
          left_hero1_skill5_kill: formData.leftHero1Skill5Kill,

          right_hero1: formData.rightHero1,
          right_hero1_skill1_trun: formData.rightHero1Skill1Trun,
          right_hero1_skill1_kill: formData.rightHero1Skill1Kill,
          right_hero1_skill2_trun: formData.rightHero1Skill2Trun,
          right_hero1_skill2_kill: formData.rightHero1Skill2Kill,
          right_hero1_skill3_trun: formData.rightHero1Skill3Trun,
          right_hero1_skill3_kill: formData.rightHero1Skill3Kill,
          right_hero1_skill4_trun: formData.rightHero1Skill4Trun,
          right_hero1_skill4_kill: formData.rightHero1Skill4Kill,
          right_hero1_skill5_trun: formData.rightHero1Skill5Trun,
          right_hero1_skill5_kill: formData.rightHero1Skill5Kill,

          left_hero2: formData.leftHero2,
          left_hero2_skill1_trun: formData.leftHero2Skill1Trun,
          left_hero2_skill1_kill: formData.leftHero2Skill1Kill,
          left_hero2_skill2_trun: formData.leftHero2Skill2Trun,
          left_hero2_skill2_kill: formData.leftHero2Skill2Kill,
          left_hero2_skill3_trun: formData.leftHero2Skill3Trun,
          left_hero2_skill3_kill: formData.leftHero2Skill3Kill,
          left_hero2_skill4_trun: formData.leftHero2Skill4Trun,
          left_hero2_skill4_kill: formData.leftHero2Skill4Kill,
          left_hero2_skill5_trun: formData.leftHero2Skill5Trun,
          left_hero2_skill5_kill: formData.leftHero2Skill5Kill,

          right_hero2: formData.rightHero2,
          right_hero2_skill1_trun: formData.rightHero2Skill1Trun,
          right_hero2_skill1_kill: formData.rightHero2Skill1Kill,
          right_hero2_skill2_trun: formData.rightHero2Skill2Trun,
          right_hero2_skill2_kill: formData.rightHero2Skill2Kill,
          right_hero2_skill3_trun: formData.rightHero2Skill3Trun,
          right_hero2_skill3_kill: formData.rightHero2Skill3Kill,
          right_hero2_skill4_trun: formData.rightHero2Skill4Trun,
          right_hero2_skill4_kill: formData.rightHero2Skill4Kill,
          right_hero2_skill5_trun: formData.rightHero2Skill5Trun,
          right_hero2_skill5_kill: formData.rightHero2Skill5Kill,

          left_hero3: formData.leftHero3,
          left_hero3_skill1_trun: formData.leftHero3Skill1Trun,
          left_hero3_skill1_kill: formData.leftHero3Skill1Kill,
          left_hero3_skill2_trun: formData.leftHero3Skill2Trun,
          left_hero3_skill2_kill: formData.leftHero3Skill2Kill,
          left_hero3_skill3_trun: formData.leftHero3Skill3Trun,
          left_hero3_skill3_kill: formData.leftHero3Skill3Kill,
          left_hero3_skill4_trun: formData.leftHero3Skill4Trun,
          left_hero3_skill4_kill: formData.leftHero3Skill4Kill,
          left_hero3_skill5_trun: formData.leftHero3Skill5Trun,
          left_hero3_skill5_kill: formData.leftHero3Skill5Kill,

          right_hero3: formData.rightHero3,
          right_hero3_skill1_trun: formData.rightHero3Skill1Trun,
          right_hero3_skill1_kill: formData.rightHero3Skill1Kill,
          right_hero3_skill2_trun: formData.rightHero3Skill2Trun,
          right_hero3_skill2_kill: formData.rightHero3Skill2Kill,
          right_hero3_skill3_trun: formData.rightHero3Skill3Trun,
          right_hero3_skill3_kill: formData.rightHero3Skill3Kill,
          right_hero3_skill4_trun: formData.rightHero3Skill4Trun,
          right_hero3_skill4_kill: formData.rightHero3Skill4Kill,
          right_hero3_skill5_trun: formData.rightHero3Skill5Trun,
          right_hero3_skill5_kill: formData.rightHero3Skill5Kill,

          // 乗り英雄
          left_joiner1: formData.leftJoiner1,
          left_joiner2: formData.leftJoiner2,
          left_joiner3: formData.leftJoiner3,
          left_joiner4: formData.leftJoiner4,
          right_joiner1: formData.rightJoiner1,
          right_joiner2: formData.rightJoiner2,
          right_joiner3: formData.rightJoiner3,
          right_joiner4: formData.rightJoiner4,

          created_at: new Date().toISOString(),
        },
      ]);

      if (basicError) throw basicError;

      // 2. 兵士数（report_troop）の登録（Lv0や兵士数0を除く）
      if (formData.troopsList && formData.troopsList.length > 0) {
        const validTroops = formData.troopsList
          .filter((t: any) => t.level > 0 && t.troops > 0)
          .map((t: any) => ({
            side: t.side,
            troop_type: t.troop_type,
            level: t.level,
            troops: t.troops,
          }));

        if (validTroops.length > 0) {
          const { error: troopError } = await supabase
            .from('report_troop')
            .insert(validTroops);

          if (troopError) throw troopError;
        }
      }

      alert('戦闘レポートを正常に登録しました！');
      router.push('/strategy/reports');
    } catch (err: any) {
      console.error('保存エラー:', err);
      alert(`保存に失敗しました: ${err.message || '不明なエラー'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && heroList.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 bg-gray-950 min-h-screen flex items-center justify-center">
        データを読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <BattleReportFormUI
        heroList={heroList}
        initialGen={initialGen}
        initialParsedData={parsedData}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}