export interface LuggageItem {
  name: string;
  detail: string;
  side: 'left' | 'right';
  row: 1 | 2 | 3;
  path: string;
}

export const luggage: LuggageItem[] = [
  { name: '聊天紀錄', detail: '聊過的話，走過的篇章', side: 'left', row: 1, path: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z' },
  { name: '角色卡', detail: '陪伴你的角色與模樣', side: 'left', row: 2, path: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm-1 9v-1a4 4 0 0 1 8 0v1' },
  { name: '玩家人設', detail: '故事裡的你，連同頭像', side: 'left', row: 3, path: 'M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21v-2a8 8 0 0 1 16 0v2' },
  { name: '世界書', detail: '這個世界的背景與細節', side: 'right', row: 1, path: 'M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3V3Z' },
  { name: '預設提示詞', detail: '為對話選好的設定', side: 'right', row: 2, path: 'M4 7h16M4 17h16M8 4v6M16 14v6' },
  { name: '正則', detail: '熟悉的文字處理規則', side: 'right', row: 3, path: 'm8 5-5 7 5 7m8-14 5 7-5 7m-3-15-2 16' }
];
