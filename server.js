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

/** roomStates = Map<roomCode, { step: string, problem?: string, destinations?: { pc?: string, mobile?: string }, maze?: { player: { x: number, y: number } }, mazeConfigKey?: string }> */
const roomStates = new Map();

const sanitizeCode = (value) => String(value || '')
  .replace(/\s+/g, '')
  .toUpperCase()
  .slice(0, CODE_LEN);

const normalizeDestinations = (dest = {}) => {
  if (typeof dest !== 'object' || dest === null) return undefined;
  const result = {};
  if (dest.pc) result.pc = String(dest.pc);
  if (dest.mobile) result.mobile = String(dest.mobile);
  return Object.keys(result).length ? result : undefined;
};

// ====== 迷路設定 ======
const MAZE_CONFIGS = {
  '1': {
    width: 5,
    height: 5,
    goal: { x: 4, y: 4 },
    start: { x: 0, y: 0 },
    map: [
      [0, 1, 0, 0, 0],
      [0, 1, 0, 1, 0],
      [0, 0, 0, 1, 0],
      [1, 1, 0, 1, 0],
      [0, 0, 0, 0, 0],
    ],
  },
  '2': {
    width: 6,
    height: 6,
    goal: { x: 5, y: 5 },
    start: { x: 0, y: 0 },
    map: [
      [0, 0, 0, 1, 0, 0],
      [1, 1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 1, 0],
      [1, 1, 1, 0, 0, 0],
    ],
  },
};

const DEFAULT_MAZE_KEY = '1';

const resolveMazeConfigKey = (problem) => {
  const key = String(problem || '').trim();
  return Object.prototype.hasOwnProperty.call(MAZE_CONFIGS, key) ? key : DEFAULT_MAZE_KEY;
};

const getMazeConfig = (problemOrKey) => {
  const key = resolveMazeConfigKey(problemOrKey);
  return MAZE_CONFIGS[key];
};

const createInitialMazeState = (config = getMazeConfig(DEFAULT_MAZE_KEY)) => ({
  player: { ...config.start },
});

const canMoveOnMaze = (config, x, y) => (
  x >= 0
  && x < config.width
  && y >= 0
  && y < config.height
  && config.map[y][x] === 0
);

const applyMazeMove = (mazeState, direction, config) => {
  if (!mazeState || !mazeState.player) return { moved: false };

  let newX = mazeState.player.x;
  let newY = mazeState.player.y;

  if (direction === 'up') newY -= 1;
  if (direction === 'down') newY += 1;
  if (direction === 'left') newX -= 1;
  if (direction === 'right') newX += 1;

  if (!canMoveOnMaze(config, newX, newY)) {
    return { moved: false };
  }

  mazeState.player = { x: newX, y: newY };

  const goalReached = (newX === config.goal.x) && (newY === config.goal.y);

  return { moved: true, goalReached };
};

const emitMazeState = (target, room, mazeState, { direction, moved, goalReached, from, t } = {}, config = getMazeConfig(DEFAULT_MAZE_KEY)) => {
  if (!mazeState || !mazeState.player) return;

  const payload = {
    room,
    code: room,
    player: { ...mazeState.player },
    goal: { ...config.goal },
    moved: Boolean(moved),
  };

  if (typeof direction === 'string') payload.direction = direction;
  if (typeof from === 'string') payload.from = from;
  if (goalReached) payload.goalReached = true;
  if (typeof t === 'number' && Number.isFinite(t)) payload.t = t;

  target.emit('mazeState', payload);
};

// ====== ソケット処理 ======
io.on('connection', (socket) => {
  socket.data.room = null;
  socket.data.role = null;

  // PC: ルーム作成
  socket.on('create', () => {
    const code = genCode();
    if (socket.data.room) socket.leave(socket.data.room);

    socket.data.room = code;
    socket.data.role = 'pc';
    socket.join(code);

    socket.emit('code', { code });
    socket.emit('status', { role: 'pc', code }); // PC待機通知（遷移はしない）
  });

  // PC/スマホ共通: 入室（スマホは {room, role:'mobile'} を送る）
  socket.on('join', (payload) => {
    const room = sanitizeCode(payload?.room);
    const role = payload?.role || 'guest';
    if (!room || room.length !== CODE_LEN) {
      socket.emit('errorMsg', { code: 'BAD_CODE', message: `コードは${CODE_LEN}桁です` });
      return;
    }

    if (socket.data.room) socket.leave(socket.data.room);
    socket.data.room = room;
    socket.data.role = role;
    socket.join(room);

    const s = io.sockets.adapter.rooms.get(room);
    const count = s ? s.size : 1;

    io.to(room).emit('memberUpdate', { type: 'join', role, count });

    // 二者が揃ったら同時遷移の合図
    if (count >= 2) {
      io.to(room).emit('paired', { code: room });
    }

    const state = roomStates.get(room);
    if (state) {
      const mazeKey = resolveMazeConfigKey(state.mazeConfigKey || state.problem);
      const mazeConfig = getMazeConfig(mazeKey);
      state.mazeConfigKey = mazeKey;
      roomStates.set(room, state);
      socket.emit('status', { room, code: room, ...state });
      if (state.maze) {
        emitMazeState(socket, room, state.maze, { moved: false }, mazeConfig);
      }
    }
  });

  // 任意：スマホ → PC 操作の中継（テンプレ）
  socket.on('move', ({ room, payload } = {}) => {
    const code = sanitizeCode(room || socket.data.room);
    if (!code) return;
    const p = payload || {};
    const data = {
      x: Math.max(-1, Math.min(1, Number(p.x || 0))),
      y: Math.max(-1, Math.min(1, Number(p.y || 0))),
      t: Number(p.t || Date.now())
    };
    socket.to(code).emit('move', data);
  });

  socket.on('moveDirection', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;

    const direction = String(payload.direction || '').toLowerCase();
    if (!['up', 'down', 'left', 'right'].includes(direction)) return;

    const state = roomStates.get(code) || {};
    const mazeKey = resolveMazeConfigKey(state.mazeConfigKey || state.problem);
    const mazeConfig = getMazeConfig(mazeKey);

    if (!state.maze) {
      state.maze = createInitialMazeState(mazeConfig);
    }

    state.mazeConfigKey = mazeKey;
    roomStates.set(code, state);

    const moveResult = applyMazeMove(state.maze, direction, mazeConfig);
    const timestamp = Number(payload.t || Date.now());

    const meta = {
      direction,
      moved: moveResult.moved,
      goalReached: moveResult.goalReached,
      from: socket.data.role || undefined,
      t: timestamp,
    };

    if (!moveResult.moved) {
      emitMazeState(socket, code, state.maze, meta, mazeConfig);
      return;
    }

    emitMazeState(io.to(code), code, state.maze, meta, mazeConfig);
  });

  socket.on('problemSelected', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;

    const problem = String(payload.problem || '').trim();
    if (!problem) return;

    const destinations = normalizeDestinations(payload.destinations);

    const mazeKey = resolveMazeConfigKey(problem);
    const mazeConfig = getMazeConfig(mazeKey);
    const maze = createInitialMazeState(mazeConfig);

    const state = {
      step: 'problemSelected',
      problem,
      destinations,
      maze,
      mazeConfigKey: mazeKey,
    };

    roomStates.set(code, state);

    const data = { room: code, code, problem, maze, mazeConfigKey: mazeKey };
    if (destinations) data.destinations = destinations;

    io.to(code).emit('problemSelected', data);
    io.to(code).emit('status', { room: code, code, ...state });
  });

  socket.on('navigateBack', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;

    const role = typeof payload.role === 'string' ? payload.role : undefined;

    roomStates.set(code, { step: 'problemSelection' });

    const notifyPayload = { room: code, code };
    if (role) notifyPayload.from = role;

    socket.to(code).emit('navigateBack', notifyPayload);
    io.to(code).emit('status', { room: code, code, step: 'problemSelection', from: role });
  });

  socket.on('disconnect', () => {
    const room = socket.data.room;
    if (!room) return;
    const s = io.sockets.adapter.rooms.get(room);
    const count = s ? s.size - 1 : 0;
    io.to(room).emit('memberUpdate', { type: 'leave', count });

    if (!s || count <= 0) {
      roomStates.delete(room);
    }
  });
});

// ====== 起動 ======
httpServer.listen(PORT, () => {
  console.log(`[start] Socket.IO on ${PORT}`);
  console.log(`[allow]`, [...ALLOW], `codeLen=${CODE_LEN}`);
});
