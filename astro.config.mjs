// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://casa-hl.chefsitturchey.workers.dev',
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [react(), sitemap({ filter: (page) => !page.includes('/admin') })],
  security: { checkOrigin: true },
  image: {
    responsiveStyles: true,
    layout: 'constrained',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
