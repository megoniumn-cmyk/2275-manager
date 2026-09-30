// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

const getComingSunday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

export default function FoundryHeader({ supabase, selectedDate, setSelectedDate, onMemberRegistered }) {
  const [eventDates, setEventDates] = useState([]);
  const [newDate, setNewDate] = useState(getComingSunday());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchEventDates();
  }, []);

  const fetchEventDates = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('title', '兵器工場戦')
      .order('order_index', { ascending: true });

    if (!error && data) {
      setEventDates(data);
      if (data.length > 0 && !selectedDate) {
        setSelectedDate(data[0].event_date);
      }
    }
  };

  const handleAddEventDate = async () => {
    const targetDate = newDate || getComingSunday();

    const { data: maxData, error: maxError } = await supabase
      .from('events')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1);

    let nextOrderIndex = 1;
    if (!maxError && maxData && maxData.length > 0) {
      nextOrderIndex = (maxData[0].order_index || 0) + 1;
    }

    const { error } = await supabase.from('events').insert([
      {
        title: '兵器工場戦',
        event_date: targetDate,
        order_index: nextOrderIndex,
      },
    ]);

    if (!error) {
      alert('イベント日を登録しました！');
      setNewDate(getComingSunday());
      fetchEventDates();
    } else {
      alert('登録エラー: ' + error.message);
    }
  };

  // ファイルをGeminiが扱えるInlineData形式に変換するヘルパー
  const fileToGenerativePart = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64String,
            mimeType: file.type,
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // スクショ画像からメンバー情報を自動抽出してSupabaseに登録
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!selectedDate) {
      alert('先にヘッダーでイベント日を選択してください。');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      // 1. APIキーの確認 (Next.jsのクライアントサイドで使えるように NEXT_PUBLIC_ を想定。必要に応じて変更してください)
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        alert('Gemini APIキー（NEXT_PUBLIC_GEMINI_API_KEY）が設定されていません。');
        setUploading(false);
        e.target.value = '';
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      let allExtractedMembers = [];

      // 2. 選択されたすべての画像を順にGeminiで解析
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imagePart = await fileToGenerativePart(file);

        const prompt = `
          この画像はスマホゲーム「ホワイトアウトサバイバル」の兵器工場戦または同盟メンバーリストのスクリーンショットです。
          画像に含まれるすべてのプレイヤーの「名前(name)」と「戦力(power: 数値のみ)」、および「控え」の状態（「控え」や「しょうが」などの表記があれば true、参戦なら false）を読み取ってください。
          以下のJSONフォーマットの配列形式のみで結果を返してください。マークダウンのバッククォート(```json ... ```)は付けず、純粋なJSON文字列のみを出力してください。
          [
            {"name": "プレイヤー名", "power": 123456, "bench": false}
          ]
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [prompt, imagePart],
        });

        const textResponse = response.text.trim();
        // 余分なマークダウン記号がついている場合のクレンジング
        const cleanJsonText = textResponse.replace(/^```json\s*/, '').replace(/^