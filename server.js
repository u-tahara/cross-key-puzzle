/**
 * CrossKey Puzzle - WebSocket(Server) / Socket.IO 6桁コード版
 * ------------------------------------------------
 * 必要パッケージ:
 *   npm i socket.io
 *
 * 起動例:
 *   PORT=3001 \
 *   NODE_ENV=production \
 *   ALLOW_ORIGINS=https://u-tahara.jp,https://www.u-tahara.jp,http://localhost:8000 \
 *   node server.js
 */

import http from 'http';
import { Server } from 'socket.io';

// ====== 設定 ======
const PORT = Number(process.env.PORT || 3001);

// 許可Origin（カンマ区切り）をSetに
const parseOrigins = () => (process.env.ALLOW_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const ALLOW = new Set(parseOrigins());

// ====== ユーティリティ ======
const CODE_LEN = 6; // ★ ここが6桁
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 紛らわしい文字(I,O,1,0)除外
const genCode = () =>
  Array.from({ length: CODE_LEN }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

// ====== HTTP (healthz) ======
const httpServer = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return;
  }
  if (req.url === '/version') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name: 'crosskey-ws', port: PORT, allowOrigins: [...ALLOW], codeLen: CODE_LEN })); return;
  }
  res.writeHead(404); res.end();
});

// ====== Socket.IO 初期化 ======
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);        // file:// を許可（開発用）
      return cb(null, ALLOW.has(origin));        // 完全一致で許可
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 256 * 1024,
});

// ====== ルーム状態（超最小） ======
/** rooms = Map<roomCode, Set<socketId>> */
const rooms = new Map();

// ====== ソケット処理 ======
io.on('connection', (socket) => {
  socket.data.room = null;

  // PC: ルーム作成
  socket.on('create', () => {
    const code = genCode();
    if (socket.data.room) socket.leave(socket.data.room);

    socket.data.room = code;
    socket.join(code);

    socket.emit('code', { code });
    socket.emit('status', { role: 'pc', code }); // PC待機通知（遷移はしない）
  });

  // PC/スマホ共通: 入室（スマホは {room, role:'mobile'} を送る）
  socket.on('join', (payload) => {
    const room = String(payload?.room || '').replace(/\s+/g, '').toUpperCase().slice(0, CODE_LEN);
    const role = payload?.role || 'guest';
    if (!room || room.length !== CODE_LEN) {
      socket.emit('errorMsg', { code: 'BAD_CODE', message: `コードは${CODE_LEN}桁です` });
      return;
    }

    if (socket.data.room) socket.leave(socket.data.room);
    socket.data.room = room;
    socket.join(room);

    const s = io.sockets.adapter.rooms.get(room);
    const count = s ? s.size : 1;

    io.to(room).emit('memberUpdate', { type: 'join', role, count });

    // 二者が揃ったら同時遷移の合図
    if (count >= 2) {
      io.to(room).emit('paired', { code: room });
    }
  });

  // 任意：スマホ → PC 操作の中継（テンプレ）
  socket.on('move', ({ room, payload } = {}) => {
    const code = String(room || socket.data.room || '').toUpperCase().slice(0, CODE_LEN);
    if (!code) return;
    const p = payload || {};
    const data = {
      x: Math.max(-1, Math.min(1, Number(p.x || 0))),
      y: Math.max(-1, Math.min(1, Number(p.y || 0))),
      t: Number(p.t || Date.now())
    };
    socket.to(code).emit('move', data);
  });

  socket.on('disconnect', () => {
    const room = socket.data.room;
    if (!room) return;
    const s = io.sockets.adapter.rooms.get(room);
    const count = s ? s.size - 1 : 0;
    io.to(room).emit('memberUpdate', { type: 'leave', count });
  });
});

// ====== 起動 ======
httpServer.listen(PORT, () => {
  console.log(`[start] Socket.IO on ${PORT}`);
  console.log(`[allow]`, [...ALLOW], `codeLen=${CODE_LEN}`);
});
