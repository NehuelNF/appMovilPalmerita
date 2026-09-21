import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('dist/server', { recursive: true });
mkdirSync('dist/.openai', { recursive: true });
copyFileSync('server/worker.mjs', 'dist/server/index.js');
copyFileSync('.openai/hosting.json', 'dist/.openai/hosting.json');
