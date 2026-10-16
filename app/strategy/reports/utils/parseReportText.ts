export interface ParsedTroop {
  side: 'left' | 'right';
  troop_type: 'Infantry' | 'rancer' | 'marksman';
  level: number;
  troops: number;
}

export interface ParsedReportData {
  reportDate: string;
  gen: string;
  
  // 左側プレイヤー
  leftName: string;
  leftPosition: string;
  leftPower: number;
  leftTroops: number;
  leftLosses: number;
  leftInjured: number;
  leftLightlyInjured: number;
  leftSurvivors: number;

  // 右側プレイヤー
  rightName: string;
  rightPosition: string;
  rightPower: number;
  rightTroops: number;
  rightLosses: number;
  rightInjured: number;
  rightLightlyInjured: number;
  rightSurvivors: number;

  // 追加ステータス（左）
  leftInAttack: number;
  leftInDefense: number;
  leftInLethality: number;
  leftInHp: number;
  leftLaAttack: number;
  leftLaDefense: number;
  leftLaLethality: number;
  leftLaHp: number;
  leftMaAttack: number;
  leftMaDefense: number;
  leftMaLethality: number;
  leftMaHp: number;

  // 追加ステータス（右）
  rightInAttack: number;
  rightInDefense: number;
  rightInLethality: number;
  rightInHp: number;
  rightLaAttack: number;
  rightLaDefense: number;
  rightLaLethality: number;
  rightLaHp: number;
  rightMaAttack: number;
  rightMaDefense: number;
  rightMaLethality: number;
  rightMaHp: number;

  // 英雄＆スキル（左）
  leftHero1: string;
  leftHero1Skills: { turn: number; kill: number }[];
  leftHero2: string;
  leftHero2Skills: { turn: number; kill: number }[];
  leftHero3: string;
  leftHero3Skills: { turn: number; kill: number }[];
  
  // 英雄＆スキル（右）
  rightHero1: string;
  rightHero1Skills: { turn: number; kill: number }[];
  rightHero2: string;
  rightHero2Skills: { turn: number; kill: number }[];
  rightHero3: string;
  rightHero3Skills: { turn: number; kill: number }[];

  // 乗り英雄
  leftJoiner1: string;
  leftJoiner2: string;
  leftJoiner3: string;
  leftJoiner4: string;
  rightJoiner1: string;
  rightJoiner2: string;
  rightJoiner3: string;
  rightJoiner4: string;

  // 兵士数リスト（report_troop用）
  troopsList: ParsedTroop[];
}

/**
 * ユーティリティ: 数値文字列からカンマなどを除外して安全にint4へ変換
 */
const parseNum = (val: string | undefined): number => {
  if (!val) return 0;
  const num = parseInt(val.replace(/[,，]/g, ''), 10);
  return isNaN(num) ? 0 : num;
};

/**
 * 貼り付けられたレポートテキスト全体を解析するメイン関数
 */
export function parseReportText(text: string): ParsedReportData {
  // 初期値（空のデータ構造）
  const result: ParsedReportData = {
    reportDate: '',
    gen: 'Gen1',
    leftName: '', leftPosition: '', leftPower: 0, leftTroops: 0, leftLosses: 0, leftInjured: 0, leftLightlyInjured: 0, leftSurvivors: 0,
    rightName: '', rightPosition: '', rightPower: 0, rightTroops: 0, rightLosses: 0, rightInjured: 0, rightLightlyInjured: 0, rightSurvivors: 0,
    leftInAttack: 0, leftInDefense: 0, leftInLethality: 0, leftInHp: 0,
    leftLaAttack: 0, leftLaDefense: 0, leftLaLethality: 0, leftLaHp: 0,
    leftMaAttack: 0, leftMaDefense: 0, leftMaLethality: 0, leftMaHp: 0,
    rightInAttack: 0, rightInDefense: 0, rightInLethality: 0, rightInHp: 0,
    rightLaAttack: 0, rightLaDefense: 0, rightLaLethality: 0, rightLaHp: 0,
    rightMaAttack: 0, rightMaDefense: 0, rightMaLethality: 0, rightMaHp: 0,
    leftHero1: '', leftHero1Skills: [],
    leftHero2: '', leftHero2Skills: [],
    leftHero3: '', leftHero3Skills: [],
    rightHero1: '', rightHero1Skills: [],
    rightHero2: '', rightHero2Skills: [],
    rightHero3: '', rightHero3Skills: [],
    leftJoiner1: '', leftJoiner2: '', leftJoiner3: '', leftJoiner4: '',
    rightJoiner1: '', rightJoiner2: '', rightJoiner3: '', rightJoiner4: '',
    troopsList: [],
  };

  if (!text) return result;

  // 1. レポート日時の抽出 (例: 2026-09-26 22:11:35 や 和暦・スラッシュ区切りなど)
  const dateMatch = text.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[\s日]\d{1,2}:\d{2}:\d{2})/);
  if (dateMatch) {
    result.reportDate = dateMatch[1].replace(/[年月]/g, '-').replace(/[日]/g, '');
  }

  // 2. 世代 (Gen) の抽出
  const genMatch = text.match(/(Gen\s*\d+)/i);
  if (genMatch) {
    result.gen = genMatch[1].replace(/\s+/g, '');
  }

  // 3. プレイヤー名や概要項目の抽出（フォーマット規則に応じた柔軟なマッチング）
  // ※ 実際のフォーマット構造に合わせて、必要に応じてキーワード部分の正規表現を微調整可能です。
  
  // 例: 「左側プレイヤー（青陣営）」まわりの抽出パターン例
  const leftNameMatch = text.match(/左側プレイヤー.*?アカウント名[:：]\s*([^\n\r]+)/i);
  if (leftNameMatch) result.leftName = leftNameMatch[1].trim();

  const rightNameMatch = text.match(/右側プレイヤー.*?アカウント名[:：]\s*([^\n\r]+)/i);
  if (rightNameMatch) result.rightName = rightNameMatch[1].trim();

  // 4. 兵士数の解析 (例: 盾兵: [Lv][兵士数] / [Lv][兵士数] などのパターンを想定)
  // 例として「盾兵」ブロックから左・右のLvと数値を走査するロジックの枠組み
  // ※実際のテキストの並び方に合わせて抽出を安定させます。

  return result;
}