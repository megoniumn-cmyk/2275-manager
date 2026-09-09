'use client';

type SvSHeaderProps = {
  eventDates: string[];
  selectedDate: string;
  opponent: string;
  loading: boolean;
  summaryCounts: {
    type1: number;
    type2: number;
    type3: number;
  };
  onDateChange: (date: string) => void;
  onOpponentChange: (value: string) => void;
};

export default function SvSHeader({
  eventDates,
  selectedDate,
  opponent,
  loading,
  summaryCounts,
  onDateChange,
  onOpponentChange,
}: SvSHeaderProps) {
  return (
    <div className="max-w-7xl mx-auto bg-[#151c2c] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* イベント日程選択 */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-400">イベント日程 (surveys_master)</label>
          <select
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">{loading ? '読み込み中...' : '日程を選択してください'}</option>
            {eventDates.map((date) => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>

        {/* 対戦相手 (surveys_master.mattching) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-400">対戦相手 (SV)</label>
          <input
            type="text"
            value={opponent}
            onChange={(e) => onOpponentChange(e.target.value)}
            placeholder="例: #1234 サーバー"
            className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* 参加人数サマリー */}
        <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 flex justify-around text-center">
          <div>
            <div className="text-[10px] text-slate-400">フル参加(移転)</div>
            <div className="text-sm font-bold text-cyan-400">{summaryCounts.type1}人</div>
          </div>
          <div className="border-r border-slate-800"></div>
          <div>
            <div className="text-[10px] text-slate-400">フル(戦闘のみ)</div>
            <div className="text-sm font-bold text-cyan-400">{summaryCounts.type2}人</div>
          </div>
          <div className="border-r border-slate-800"></div>
          <div>
            <div className="text-[10px] text-slate-400">途中参加</div>
            <div className="text-sm font-bold text-cyan-400">{summaryCounts.type3}人</div>
          </div>
        </div>
      </div>
    </div>
  );
}