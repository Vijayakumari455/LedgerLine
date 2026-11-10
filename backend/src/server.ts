import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';

const PORT = process.env.PORT || 5000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[LedgerLine] Server listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[LedgerLine] SIGTERM received. Gracefully shutting down...');
  server.close(() => {
    console.log('[LedgerLine] Process terminated.');
  });
});

