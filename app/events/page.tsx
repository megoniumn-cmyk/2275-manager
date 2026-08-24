'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Member = {
  game_id: string;
  name: string;
  alliance: string | null;
};

type EventItem = {
  id: string;
  title: string;
  event_date: string | null;
  order_index: number;
};

type EventParticipation = {
  id: string;
  event_id: string;
  member_game_id: string;
  status: string;
};

const PRESET_EVENTS = ['SvS', '霜竜の覇者', '雪原兵器リーグ', '兵器工場戦', '峡谷合戦'];

const STATUS_OPTIONS = [
  { value: '未定', label: '未定' },
  { value: '参加', label: '参加' },
  { value: '不参加', label: '不参加' },
  { value: '途中参加', label: '途中参加' },
  { value: '指示×', label: '指示×' },
  { value: '軍1参加', label: '軍1参加' },
  { value: '軍1欠席', label: '軍1欠席' },
  { value: '軍1遅刻', label: '軍1遅刻' },
  { value: '軍1指示△', label: '軍1指示△' },
  { value: '軍1指示×', label: '軍1指示×' },
  { value: '軍1控欠席', label: '軍1控欠席' },
  { value: '軍2参加', label: '軍2参加' },
  { value: '軍2欠席', label: '軍2欠席' },
  { value: '加入前', label: '加入前' },
];

export default function EventsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [participations, setParticipations] = useState<EventParticipation[]>([]);
  const [loading, setLoading] = useState(true);

  // モーダル関連
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEventTitle, setSelectedEventTitle] = useState('SvS');
  const [eventDate, setEventDate] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editEventTitle, setEditEventTitle] = useState('');
  const [editEventDate, setEditEventDate] = useState('');

  // ソート状態
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 各列の個別フィルター状態
  const [nameFilters, setNameFilters] = useState<string[]>([]);
  const [allianceFilters, setAllianceFilters] = useState<string[]>([]);
  const [eventFilters, setEventFilters] = useState<Record<string, string[]>>({});

  // フィルター用ポップアップの開閉管理
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 名前フィルタ内の絞り込み検索用テキスト
  const [nameSearchText, setNameSearchText] = useState<string>('');

  const csvFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveFilterDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchData() {
    setLoading(true);
    const [membersRes, eventsRes, partsRes] = await Promise.all([
      supabase.from('members').select('game_id, name, alliance').not('game_id', 'is', null),
      supabase.from('events').select('*').order('order_index', { ascending: true }).order('event_date', { ascending: true }),
      supabase.from('event_participations').select('*'),
    ]);

    if (membersRes.data) {
      const validMembers = membersRes.data.filter((m) => m.game_id && m.game_id.trim() !== '');
      setMembers(validMembers);
    }
    if (eventsRes.data) setEvents(eventsRes.data);
    if (partsRes.data) setParticipations(partsRes.data);
    setLoading(false);
  }

  const allianceList = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.alliance) set.add(m.alliance);
    });
    return Array.from(set);
  }, [members]);

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    const nextOrder = events.length > 0 ? Math.max(...events.map((ev) => ev.order_index || 0)) + 1 : 0;

    const { error } = await supabase.from('events').insert([
      { title: selectedEventTitle, event_date: eventDate || null, order_index: nextOrder }
    ]);

    if (error) {
      console.error('Error adding event:', error);
      alert('イベントの追加に失敗しました。');
    } else {
      setIsAddModalOpen(false);
      setEventDate('');
      fetchData();
    }
  }

  function openEditModal(eventItem: EventItem, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingEvent(eventItem);
    setEditEventTitle(eventItem.title);
    setEditEventDate(eventItem.event_date || '');
    setIsEditModalOpen(true);
  }

  async function handleUpdateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEvent) return;

    const { error } = await supabase
      .from('events')
      .update({
        title: editEventTitle,
        event_date: editEventDate || null,
      })
      .eq('id', editingEvent.id);

    if (error) {
      console.error('Error updating event:', error);
      alert('イベントの更新に失敗しました。');
    } else {
      setIsEditModalOpen(false);
      setEditingEvent(null);
      fetchData();
    }
  }

  async function handleDeleteEvent() {
    if (!editingEvent) return;
    if (!confirm(`「${editingEvent.title} (${editingEvent.event_date || '日時未設定'})」を削除してもよろしいですか？紐づく参加ステータスも削除されます。`)) {
      return;
    }

    await supabase.from('event_participations').delete().eq('event_id', editingEvent.id);
    const { error } = await supabase.from('events').delete().eq('id', editingEvent.id);

    if (error) {
      console.error('Error deleting event:', error);
      alert('イベントの削除に失敗しました。');
    } else {
      setIsEditModalOpen(false);
      setEditingEvent(null);
      fetchData();
    }
  }

  async function handleStatusChange(eventId: string, memberGameId: string, status: string) {
    const existing = participations.find(
      (p) => p.event_id === eventId && p.member_game_id === memberGameId
    );

    if (existing) {
      const { error } = await supabase
        .from('event_participations')
        .update({ status })
        .eq('id', existing.id);
      if (!error) {
        setParticipations(
          participations.map((p) => (p.id === existing.id ? { ...p, status } : p))
        );
      }
    } else {
      const { data, error } = await supabase
        .from('event_participations')
        .insert([{ event_id: eventId, member_game_id: memberGameId, status }])
        .select()
        .single();
      if (!error && data) {
        setParticipations([...participations, data]);
      }
    }
  }

  async function moveEvent(index: number, direction: 'left' | 'right', e: React.MouseEvent) {
    e.stopPropagation();
    const newEvents = [...events];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newEvents.length) return;

    const temp = newEvents[index];
    newEvents[index] = newEvents[targetIndex];
    newEvents[targetIndex] = temp;

    setEvents(newEvents);

    for (let i = 0; i < newEvents.length; i++) {
      await supabase.from('events').update({ order_index: i }).eq('id', newEvents[i].id);
    }
  }

  function toggleNameFilter(gameId: string) {
    setNameFilters((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  }

  function toggleAllianceFilter(al: string) {
    setAllianceFilters((prev) =>
      prev.includes(al) ? prev.filter((item) => item !== al) : [...prev, al]
    );
  }

  function toggleEventStatusFilter(eventId: string, statusVal: string) {
    setEventFilters((prev) => {
      const currentList = prev[eventId] || [];
      const updatedList = currentList.includes(statusVal)
        ? currentList.filter((s) => s !== statusVal)
        : [...currentList, statusVal];
      return {
        ...prev,
        [eventId]: updatedList,
      };
    });
  }

  const filteredMemberListForPopup = useMemo(() => {
    if (!nameSearchText.trim()) return members;
    const query = nameSearchText.toLowerCase();
    return members.filter((m) => (m.name || '').toLowerCase().includes(query));
  }, [members, nameSearchText]);

  const filteredAndSortedMembers = useMemo(() => {
    const filtered = members.filter((member) => {
      if (nameFilters.length > 0) {
        if (!nameFilters.includes(member.game_id)) {
          return false;
        }
      }

      if (allianceFilters.length > 0) {
        const memAlliance = member.alliance || '';
        if (!allianceFilters.includes(memAlliance)) {
          return false;
        }
      }

      for (const event of events) {
        const selectedStatuses = eventFilters[event.id] || [];
        if (selectedStatuses.length > 0) {
          const part = participations.find(
            (p) => p.event_id === event.id && p.member_game_id === member.game_id
          );
          const currentStatus = part ? part.status : '未定';
          if (!selectedStatuses.includes(currentStatus)) {
            return false;
          }
        }
      }

      return true;
    });

    return filtered.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (sortField === 'alliance') {
        valA = (a.alliance || '').toLowerCase();
        valB = (b.alliance || '').toLowerCase();
      } else {
        const partA = participations.find((p) => p.event_id === sortField && p.member_game_id === a.game_id);
        const partB = participations.find((p) => p.event_id === sortField && p.member_game_id === b.game_id);
        valA = partA ? partA.status : '未定';
        valB = partB ? partB.status : '未定';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [members, participations, sortField, sortDirection, nameFilters, allianceFilters, eventFilters, events]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function clearAllFilters() {
    setNameFilters([]);
    setAllianceFilters([]);
    setEventFilters({});
    setNameSearchText('');
    setActiveFilterDropdown(null);
  }

  function handleExportCSV() {
    if (events.length === 0 || members.length === 0) {
      alert('エクスポートするデータがありません。');
      return;
    }

    const headers = ['game_id', 'name', 'alliance', ...events.map((e) => `${e.title}_${e.event_date || '未設定'}`)];
    const csvRows = [headers.join(',')];

    for (const member of members) {
      const row = [
        `"${member.game_id}"`,
        `"${member.name}"`,
        `"${member.alliance || ''}"`,
      ];

      for (const event of events) {
        const part = participations.find(
          (p) => p.event_id === event.id && p.member_game_id === member.game_id
        );
        const status = part ? part.status : '未定';
        row.push(`"${status}"`);
      }
      csvRows.push(row.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `event_participations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter((line) => line.trim() !== '');
      if (lines.length < 2) {
        alert('CSVの形式が正しくありません。');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
      const eventHeaders = headers.slice(3);

      let updateCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        if (row.length < 3) continue;

        const gameId = row[0].replace(/^"|"$/g, '').trim();
        for (let j = 0; j < eventHeaders.length; j++) {
          const colIndex = 3 + j;
          if (row[colIndex]) {
            const status = row[colIndex].replace(/^"|"$/g, '').trim();
            if (events[j]) {
              const targetEventId = events[j].id;
              await handleStatusChange(targetEventId, gameId, status);
              updateCount++;
            }
          }
        }
      }

      alert(`CSVインポートが完了しました（更新件数: ${updateCount}件）`);
      fetchData();
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    );
  }

  const hasActiveFilters =
    nameFilters.length > 0 ||
    allianceFilters.length > 0 ||
    Object.values(eventFilters).some((list) => list && list.length > 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">イベント参加状況管理</h1>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 text-xs rounded transition"
              >
                すべてのフィルターをクリア
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium rounded transition text-sm"
            >
              CSV出力
            </button>
            <button
              onClick={() => csvFileInputRef.current?.click()}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium rounded transition text-sm"
            >
              CSV取込
            </button>
            <input
              type="file"
              ref={csvFileInputRef}
              onChange={handleImportCSV}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-medium rounded transition text-sm"
            >
              + イベント追加
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto shadow-xl">
          <table className="w-full border-collapse text-left whitespace-nowrap">
            <thead>
              {/* ヘッダー行1：タイトル・ソート・移動・編集 */}
              <tr className="bg-gray-800 text-gray-300 text-sm border-b border-gray-700">
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 sticky left-0 bg-gray-800 z-25 cursor-pointer hover:text-white select-none border-r border-gray-700"
                >
                  名前 {sortField === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleSort('alliance')}
                  className="px-6 py-3 sticky left-[120px] bg-gray-800 z-25 cursor-pointer hover:text-white select-none border-r border-gray-700"
                >
                  同盟 {sortField === 'alliance' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>

                {events.map((event, index) => (
                  <th
                    key={event.id}
                    onClick={() => handleSort(event.id)}
                    className="px-6 py-3 border-r border-gray-800 min-w-[200px] cursor-pointer hover:bg-gray-750 select-none"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-blue-400">
                          {event.title} {sortField === event.id && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                        <div className="flex gap-1.5 items-center">
                          <button
                            onClick={(e) => openEditModal(event, e)}
                            className="px-1.5 py-0.5 bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white rounded text-xs transition"
                            title="イベントを編集"
                          >
                            編集
                          </button>
                          <div className="flex gap-1 text-xs">
                            <button
                              onClick={(e) => moveEvent(index, 'left', e)}
                              disabled={index === 0}
                              className="px-1.5 py-0.5 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
                              title="左へ移動"
                            >
                              ◀
                            </button>
                            <button
                              onClick={(e) => moveEvent(index, 'right', e)}
                              disabled={index === events.length - 1}
                              className="px-1.5 py-0.5 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
                              title="右へ移動"
                            >
                              ▶
                            </button>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{event.event_date || '日時未設定'}</span>
                    </div>
                  </th>
                ))}
              </tr>

              {/* ヘッダー行2：各列のポップアップ複数選択フィルターコントロール */}
              <tr className="bg-gray-850 border-b border-gray-700 text-xs">
                {/* 名前フィルター */}
                <th className="px-3 py-2 sticky left-0 bg-gray-850 z-25 border-r border-gray-700 relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'name' ? null : 'name')}
                    className={`w-full px-2 py-1 rounded text-xs text-left border flex justify-between items-center ${
                      nameFilters.length > 0
                        ? 'bg-blue-900/40 border-blue-500 text-blue-200'
                        : 'bg-gray-900 border-gray-700 text-gray-300'
                    }`}
                  >
                    <span className="truncate">
                      {nameFilters.length === 0
                        ? '名前選択 (すべて)'
                        : `名前 (${nameFilters.length}件選択)`}
                    </span>
                    <span className="text-[10px]">▼</span>
                  </button>

                  {activeFilterDropdown === 'name' && (
                    <div ref={dropdownRef} className="absolute left-3 top-10 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2 z-50 text-left">
                      <div className="flex justify-between items-center mb-2 px-1 text-[11px] text-gray-400 border-b border-gray-800 pb-1">
                        <span>名前フィルタ</span>
                        {nameFilters.length > 0 && (
                          <button
                            onClick={() => setNameFilters([])}
                            className="text-blue-400 hover:underline"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                      <div className="mb-2">
                        <input
                          type="text"
                          placeholder="名前を検索..."
                          value={nameSearchText}
                          onChange={(e) => setNameSearchText(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {filteredMemberListForPopup.map((member) => {
                          const isChecked = nameFilters.includes(member.game_id);
                          return (
                            <label
                              key={member.game_id}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-pointer text-gray-300 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleNameFilter(member.game_id)}
                                className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                              />
                              <span className="truncate">{member.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </th>

                {/* 同盟フィルター */}
                <th className="px-3 py-2 sticky left-[120px] bg-gray-850 z-25 border-r border-gray-700 relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'alliance' ? null : 'alliance')}
                    className={`w-full px-2 py-1 rounded text-xs text-left border flex justify-between items-center ${
                      allianceFilters.length > 0
                        ? 'bg-blue-900/40 border-blue-500 text-blue-200'
                        : 'bg-gray-900 border-gray-700 text-gray-300'
                    }`}
                  >
                    <span className="truncate">
                      {allianceFilters.length === 0
                        ? '同盟選択 (すべて)'
                        : `同盟 (${allianceFilters.length}件選択)`}
                    </span>
                    <span className="text-[10px]">▼</span>
                  </button>

                  {activeFilterDropdown === 'alliance' && (
                    <div ref={dropdownRef} className="absolute left-3 top-10 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2 z-50 text-left">
                      <div className="flex justify-between items-center mb-2 px-1 text-[11px] text-gray-400 border-b border-gray-800 pb-1">
                        <span>同盟フィルタ</span>
                        {allianceFilters.length > 0 && (
                          <button
                            onClick={() => setAllianceFilters([])}
                            className="text-blue-400 hover:underline"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {allianceList.map((al) => {
                          const isChecked = allianceFilters.includes(al);
                          return (
                            <label
                              key={al}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-pointer text-gray-300 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleAllianceFilter(al)}
                                className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                              />
                              <span className="truncate">{al || '(未設定)'}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </th>

                {/* 各イベントステータスフィルター */}
                {events.map((event) => {
                  const selectedStatuses = eventFilters[event.id] || [];
                  const isDropdownOpen = activeFilterDropdown === event.id;

                  return (
                    <th key={event.id} className="px-3 py-2 border-r border-gray-800 relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveFilterDropdown(isDropdownOpen ? null : event.id)}
                        className={`w-full px-2 py-1 rounded text-xs text-left border flex justify-between items-center ${
                          selectedStatuses.length > 0
                            ? 'bg-blue-900/40 border-blue-500 text-blue-200'
                            : 'bg-gray-900 border-gray-700 text-gray-300'
                        }`}
                      >
                        <span className="truncate">
                          {selectedStatuses.length === 0
                            ? 'ステータス選択 (すべて)'
                            : `選択中 (${selectedStatuses.length}件)`}
                        </span>
                        <span className="text-[10px]">▼</span>
                      </button>

                      {isDropdownOpen && (
                        <div ref={dropdownRef} className="absolute left-3 top-10 w-52 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2 z-50 text-left">
                          <div className="flex justify-between items-center mb-2 px-1 text-[11px] text-gray-400 border-b border-gray-800 pb-1">
                            <span>ステータスフィルタ</span>
                            {selectedStatuses.length > 0 && (
                              <button
                                onClick={() =>
                                  setEventFilters((prev) => ({ ...prev, [event.id]: [] }))
                                }
                                className="text-blue-400 hover:underline"
                              >
                                クリア
                              </button>
                            )}
                          </div>
                          <div className="max-h-56 overflow-y-auto space-y-1">
                            {STATUS_OPTIONS.map((opt) => {
                              const isChecked = selectedStatuses.includes(opt.value);
                              return (
                                <label
                                  key={opt.value}
                                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-pointer text-gray-300 text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleEventStatusFilter(event.id, opt.value)}
                                    className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                                  />
                                  <span>{opt.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedMembers.length === 0 ? (
                <tr>
                  <td colSpan={2 + events.length} className="px-6 py-8 text-center text-gray-400">
                    条件に一致するメンバーが見つかりません。
                  </td>
                </tr>
              ) : (
                filteredAndSortedMembers.map((member) => (
                  <tr key={member.game_id} className="border-b border-gray-800 hover:bg-gray-800/40">
                    <td className="px-6 py-3 font-medium text-white sticky left-0 bg-gray-900 z-10 border-r border-gray-800">
                      {member.name}
                    </td>
                    <td className="px-6 py-3 text-gray-300 sticky left-[120px] bg-gray-900 z-10 border-r border-gray-800">
                      {member.alliance || '-'}
                    </td>

                    {events.map((event) => {
                      const part = participations.find(
                        (p) => p.event_id === event.id && p.member_game_id === member.game_id
                      );
                      const status = part ? part.status : '未定';

                      return (
                        <td key={event.id} className="px-6 py-3 border-r border-gray-800/50">
                          <select
                            value={status}
                            onChange={(e) => handleStatusChange(event.id, member.game_id, e.target.value)}
                            className="px-3 py-1 rounded text-sm font-medium border bg-gray-800 text-gray-300 border-gray-700 focus:outline-none focus:border-blue-500"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value} className="bg-gray-900">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新規イベント追加モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-white">新しいイベントを追加</h2>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">イベント名</label>
                <select
                  value={selectedEventTitle}
                  onChange={(e) => setSelectedEventTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                >
                  {PRESET_EVENTS.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">開催日付</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded transition"
                >
                  登録する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* イベント編集・削除モーダル */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-white">イベントの編集</h2>
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">イベント名</label>
                <input
                  type="text"
                  value={editEventTitle}
                  onChange={(e) => setEditEventTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">開催日付</label>
                <input
                  type="date"
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-between items-center mt-6">
                <button
                  type="button"
                  onClick={handleDeleteEvent}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-800 rounded transition text-sm"
                >
                  このイベントを削除
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition text-sm"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded transition text-sm"
                  >
                    保存する
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}