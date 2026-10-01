// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Header from './components/Header';
import MemberList from './components/memberlist';
import Confirmation from './components/confirmation';

export default function CanyonPage() {
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('management');

  const [startPos, setStartPos] = useState('');
  const [members, setMembers] = useState([]);
  const [notes, setNotes] = useState({
    basic: '',
    phase1: '',
    phase2: '',
    phase3: '',
  });

  // '峡谷合戦' のイベント日程一覧を取得 (event_date を使用)
  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('title', '峡谷合戦')
      .order('order_index', { ascending: true });

    if (!error && data) {
      setEvents(data);
      if (data.length > 0 && !selectedDate) {
        setSelectedDate(data[0].event_date);
      }
    }
  };

  const fetchMembers = async () => {
    if (!selectedDate) {
      setMembers([]);
      return;
    }
    const { data, error } = await supabase
      .from('cc_memberlist')
      .select('*')
      .eq('eventdate', selectedDate)
      .order('power', { ascending: false });

    if (!error && data) {
      setMembers(data);
    }
  };

  const fetchEventDetails = async () => {
    if (!selectedDate) {
      setStartPos('');
      setNotes({ basic: '', phase1: '', phase2: '', phase3: '' });
      return;
    }

    const { data: eventData } = await supabase
      .from('events')
      .select('start')
      .eq('event_date', selectedDate)
      .single();

    if (eventData) {
      setStartPos(eventData.start || '');
    }

    const { data: noteData } = await supabase
      .from('cc_note')
      .select('*')
      .eq('eventdate', selectedDate);

    if (noteData) {
      const newNotes = { basic: '', phase1: '', phase2: '', phase3: '' };
      noteData.forEach((item) => {
        if (newNotes.hasOwnProperty(item.pattern)) {
          newNotes[item.pattern] = item.note || '';
        }
      });
      setNotes(newNotes);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchMembers();
    fetchEventDetails();
  }, [selectedDate, refreshKey]);

  const handleMemberRegistered = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleSaveNote = async (pattern, text) => {
    setNotes((prev) => ({ ...prev, [pattern]: text }));
    if (!selectedDate) return;

    await supabase.from('cc_note').upsert(
      [
        {
          eventdate: selectedDate,
          pattern: pattern,
          note: text,
        },
      ],
      { onConflict: 'eventdate,pattern' }
    );
  };

  return (
    <main className="min-h-screen bg-[#0b0f19] text-slate-100 p-3 sm:p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Header
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          onMemberRegistered={handleMemberRegistered}
          fetchEvents={fetchEvents}
          events={events}
        />

        {!selectedDate ? (
          <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
            <p className="text-sm font-bold text-cyan-400">⚠️ まず最初にヘッダーから日付を選択するか、イベント日を追加してください。</p>
            <p className="text-xs">日付を選択すると、編成や作戦を設定・確認できるようになります。</p>
          </div>
        ) : (
          <>
            <div className="flex bg-[#151c2c] border border-slate-800 p-1.5 rounded-2xl overflow-x-auto gap-1">
              <button
                onClick={() => setActiveTab('management')}
                className={`flex-1 min-w-[120px] py-2.5 px-3 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                  activeTab === 'management' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                🛡️ チーム編成・作戦入力
              </button>
              <button
                onClick={() => setActiveTab('confirmation')}
                className={`flex-1 min-w-[120px] py-2.5 px-3 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                  activeTab === 'confirmation' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                📋 作戦確認
              </button>
            </div>

            <div className="space-y-6">
              {activeTab === 'management' ? (
                <MemberList
                  selectedDate={selectedDate}
                  startPos={startPos}
                  setStartPos={setStartPos}
                  members={members}
                  fetchMembers={fetchMembers}
                  notes={notes}
                  handleSaveNote={handleSaveNote}
                />
              ) : (
                <Confirmation
                  selectedDate={selectedDate}
                  startPos={startPos}
                  members={members}
                  notes={notes}
                />
              )}
            </div>
          </>
        )}

      </div>
    </main>
  );
}