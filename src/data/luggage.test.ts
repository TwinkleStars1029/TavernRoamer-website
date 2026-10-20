import { describe, expect, it } from 'vitest';
import { luggage } from './luggage';

describe('luggage', () => {
  it('has six items, three on each side', () => {
    expect(luggage).toHaveLength(6);
    expect(luggage.filter(item => item.side === 'left')).toHaveLength(3);
    expect(luggage.filter(item => item.side === 'right')).toHaveLength(3);
  });
  it('uses rows 1 to 3 once per side', () => {
    for (const side of ['left', 'right'] as const) {
      expect(luggage.filter(item => item.side === side).map(item => item.row).sort()).toEqual([1, 2, 3]);
    }
  });
  it('keeps the home page order', () => {
    expect(luggage.map(item => item.name)).toEqual(['聊天紀錄', '角色卡', '玩家人設', '世界書', '預設提示詞', '正則']);
  });
});
