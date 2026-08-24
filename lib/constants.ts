// lib/constants.ts

// ① 兵士レベルの選択肢リスト
export const SOLDIER_OPTIONS = [
  { label: 'FC10T11', value: 'FC10T11' },
  { label: 'FC9T11',  value: 'FC9T11' },
  { label: 'FC8T11',  value: 'FC8T11' },
  { label: 'FC7T11',  value: 'FC7T11' },
  { label: 'FC6T11',  value: 'FC6T11' },
  { label: 'FC5T11',  value: 'FC5T11' },
  { label: 'FC10T10', value: 'FC10T10' },
  { label: 'FC9T10',  value: 'FC9T10' },
  { label: 'FC8T10',  value: 'FC8T10' },
  { label: 'FC7T10',  value: 'FC7T10' },
  { label: 'FC6T10',  value: 'FC6T10' },
  { label: 'それ以外 / Other', value: 'それ以外' },
];

// ④ イベント名の選択肢リスト
export const EVENT_NAME_OPTIONS = [
  'SvS',
  '霜竜',
  '兵器リーグ',
  '兵器工場',
  '峡谷合戦',
];

// ④ マス目のステータス選択肢リスト
export const RESPONSE_STATUS_OPTIONS = [
  '未回答',
  '参加',
  '不参加',
  '途中参加',
  '指示×',
  '軍1参加',
  '軍1欠席',
  '軍1遅刻',
  '軍1控欠席',
  '軍1指示△',
  '軍1指示×',
  '軍2参加',
  '軍2欠席',
  '加入前',
];

// ④ ステータスに応じた TailWind CSS クラスを取得する関数
export function getStatusStyle(status: string): string {
  switch (status) {
    case '参加':
    case '軍1参加':
    case '軍2参加':
      return 'bg-green-100 text-green-800 border-green-300 font-medium';

    case '不参加':
    case '軍1欠席':
    case '軍1控欠席':
      return 'bg-red-100 text-red-800 border-red-300 font-medium';

    case '途中参加':
    case '軍1遅刻':
      return 'bg-amber-100 text-amber-800 border-amber-300 font-medium';

    case '指示×':
    case '軍1指示△':
    case '軍1指示×':
      return 'bg-purple-100 text-purple-800 border-purple-300 font-medium';

    case '加入前':
    case '未回答':
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}