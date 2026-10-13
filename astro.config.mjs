import { defineConfig } from 'astro/config';

export default defineConfig({
  base: process.env.SITE_BASE ? `/${process.env.SITE_BASE.replace(/^\/+|\/+$/g, '')}/` : '/',
  trailingSlash: 'always',
  output: 'static'
});
