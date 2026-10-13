import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // theme.test.ts reads theme.css via `?raw`; Vitest returns CSS imports as empty strings unless CSS processing is enabled for them.
    css: { include: [/src[\/]styles[\/]theme\.css/] },
  },
});
