export type OriginResult =
  | { ok: true; origin: string; warning: string | null }
  | { ok: false; reason: 'scheme' | 'credentials' | 'invalid'; message: string };

export function toOAuthOrigin(input: string): OriginResult {
  const raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) {
    return { ok: false, reason: 'scheme', message: '請先補上 http:// 或 https://，助手不會替你猜網址協定。' };
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, reason: 'scheme', message: '只接受 http:// 或 https:// 網址。' };
    }
    if (url.username || url.password) {
      return { ok: false, reason: 'credentials', message: '網址含有帳號或密碼，請移除後再輸入。' };
    }
    if (!url.hostname) throw new Error('missing hostname');
    const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
    return {
      ok: true,
      origin: url.origin,
      warning: url.protocol === 'http:' && !local ? '這是非本機 HTTP 網址，請核對 Google 對 Authorized JavaScript origins 的允許規則。' : null
    };
  } catch {
    return { ok: false, reason: 'invalid', message: '無法解析這個網址。請確認格式，例如 https://tavern.example.com。' };
  }
}

export function collectOAuthOrigins(inputs: string[]): { origins: string[]; errors: string[]; warnings: string[] } {
  const origins: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [index, input] of inputs.entries()) {
    if (!input.trim()) continue;
    const result = toOAuthOrigin(input);
    if (!result.ok) errors.push(`第 ${index + 1} 筆：${result.message}`);
    else {
      if (!origins.includes(result.origin)) origins.push(result.origin);
      if (result.warning) warnings.push(`${result.origin}: ${result.warning}`);
    }
  }
  return { origins, errors, warnings };
}
