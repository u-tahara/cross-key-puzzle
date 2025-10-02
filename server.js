/**
 * CrossKey Puzzle - WebSocket(Server) / Socket.IO 6桁コード版（依存ファイルなし）
 * - normalizeVisitedState / mergeVisitedStates を内蔵
 * - そのまま /srv/crosskey-ws/server.js に上書きOK
 */

import http from 'http';
import { Server } from 'socket.io';

// ====== 外部ファイルの代替（内蔵ユーティリティ） ======
function normalizeVisitedState(src) {
  const base = { north: false, east: false, south: false, west: false };
  if (!src || typeof src !== 'object') return { ...base };
  return {
    north: Boolean(src.north),
    east:  Boolean(src.east),
    south: Boolean(src.south),
    west:  Boolean(src.west),
  };
}
function mergeVisitedStates(a, b) {
  const A = normalizeVisitedState(a);
  const B = normalizeVisitedState(b);
  return {
    north: A.north || B.north,
    east:  A.east  || B.east,
    south: A.south || B.south,
    west:  A.west  || B.west,
  };
}

// ====== 迷路ロジック（最小） ======
const MAZE_CONFIGS = {
  '1': {
    width: 5, height: 5,
    goal: { x: 4, y: 4 }, start: { x: 0, y: 0 },
    map: [
      [0,1,0,0,0],
      [0,1,0,1,0],
      [0,0,0,1,0],
      [1,1,0,1,0],
      [0,0,0,0,0],
    ],
  },
  '2': {
    width: 6, height: 6,
    goal: { x: 5, y: 5 }, start: { x: 0, y: 0 },
    map: [
      [0,0,0,1,0,0],
      [1,1,0,1,0,1],
      [0,0,0,0,0,0],
      [0,1,1,1,1,0],
      [0,0,0,0,1,0],
      [1,1,1,0,0,0],
    ],
  },
};
const DEFAULT_MAZE_KEY = '1';
const resolveMazeConfigKey = (problem) => {
  const key = String(problem || '').trim();
  return Object.prototype.hasOwnProperty.call(MAZE_CONFIGS, key) ? key : DEFAULT_MAZE_KEY;
};
const getMazeConfig = (problemOrKey) => MAZE_CONFIGS[resolveMazeConfigKey(problemOrKey)];
const createInitialMazeState = (config = getMazeConfig(DEFAULT_MAZE_KEY)) => ({ player: { ...config.start } });
const canMoveOnMaze = (config, x, y) => (
  !!config && Number.isFinite(x) && Number.isFinite(y) &&
  x >= 0 && x < config.width && y >= 0 && y < config.height &&
  Array.isArray(config.map) && Array.isArray(config.map[y]) && config.map[y][x] === 0
);
const applyMazeMove = (mazeState, direction, config) => {
  if (!mazeState || !mazeState.player || !config) return { moved: false };
  let { x:newX, y:newY } = mazeState.player;
  if (direction === 'up') newY -= 1;
  if (direction === 'down') newY += 1;
  if (direction === 'left') newX -= 1;
  if (direction === 'right') newX += 1;
  if (!canMoveOnMaze(config, newX, newY)) return { moved: false };
  mazeState.player = { x:newX, y:newY };
  return { moved: true, goalReached: (newX === config.goal.x && newY === config.goal.y) };
};

// ====== Problem5 (Audio) ======
const AUDIO_THRESHOLD = 0.35;
const clampAudioLevel = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  if (number >= 1) return 1;
  return number;
};
const createInitialAudioState = () => ({
  level: 0,
  peak: 0,
  thresholdReached: false,
  threshold: AUDIO_THRESHOLD,
});
const updateAudioState = (prev = createInitialAudioState(), level, { peak, threshold = AUDIO_THRESHOLD } = {}) => {
  const normalizedLevel = clampAudioLevel(level);
  const fallbackPeak = Math.max(prev.peak || 0, normalizedLevel);
  const normalizedPeak = clampAudioLevel(Number.isFinite(peak) ? peak : fallbackPeak);
  const thresholdReached = Boolean(prev.thresholdReached || normalizedPeak >= threshold);
  return {
    level: normalizedLevel,
    peak: normalizedPeak,
    thresholdReached,
    threshold,
  };
};

// ====== Problem6 (Shake) ======
const SHAKE_THRESHOLD = 18;
const SHAKE_MIN_INTERVAL = 280;
const SHAKE_REQUIRED = 8;
const createInitialShakeState = () => ({
  count: 0,
  completed: false,
  lastShakeAt: 0,
  required: SHAKE_REQUIRED,
});
const updateShakeState = (
  prev = createInitialShakeState(),
  magnitude,
  {
    now = Date.now(),
    threshold = SHAKE_THRESHOLD,
    minInterval = SHAKE_MIN_INTERVAL,
    required = SHAKE_REQUIRED,
  } = {},
) => {
  const base = {
    count: Number(prev.count) || 0,
    completed: Boolean(prev.completed),
    lastShakeAt: Number(prev.lastShakeAt) || 0,
    required: Number(prev.required) || required,
  };

  let { count, completed, lastShakeAt } = base;
  let incremented = false;

  if (!completed && Number.isFinite(magnitude) && magnitude >= threshold) {
    const elapsed = now - lastShakeAt;
    const allowInitial = count <= 0 && lastShakeAt <= 0;
    if (allowInitial || elapsed >= minInterval) {
      count += 1;
      lastShakeAt = now;
      incremented = true;
    }
  }

  if (count >= required) {
    completed = true;
  }

  return {
    count,
    completed,
    lastShakeAt,
    required,
    threshold,
    minInterval,
    incremented,
  };
};

// ====== 基本設定 ======
const PORT = Number(process.env.PORT || 3001);
const parseOrigins = () => (process.env.ALLOW_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
const ALLOW = new Set(parseOrigins());

// ====== コード（6桁） ======
const CODE_LEN = 6;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // I,O,1,0 除外
const genCode = () => Array.from({length: CODE_LEN}, () => CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join('');

// ====== HTTP（/healthz /version） ======
const httpServer = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, {'Content-Type':'text/plain'}); res.end('ok'); return; }
  if (req.url === '/version') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ name:'crosskey-ws', port:PORT, allowOrigins:[...ALLOW], codeLen:CODE_LEN })); return;
  }
  res.writeHead(404); res.end();
});

// ====== Socket.IO ======
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => { if (!origin) return cb(null, true); return cb(null, ALLOW.has(origin)); },
    credentials: true,
  },
  transports: ['websocket','polling'],
  maxHttpBufferSize: 256*1024,
});

// ルーム状態
const rooms = new Map(); // Map<roomCode, Set<socketId>>（必要なら拡張）
const roomStates = new Map(); // Map<roomCode, {...}>

const sanitizeCode = (v) => String(v || '').replace(/\s+/g,'').toUpperCase().slice(0, CODE_LEN);
const normalizeDestinations = (dest={}) => {
  if (typeof dest !== 'object' || dest === null) return undefined;
  const out = {}; if (dest.pc) out.pc = String(dest.pc); if (dest.mobile) out.mobile = String(dest.mobile);
  return Object.keys(out).length ? out : undefined;
};
const emitMazeState = (target, room, mazeState, {direction, moved, goalReached, from, t}={}, config=getMazeConfig(DEFAULT_MAZE_KEY)) => {
  if (!mazeState || !mazeState.player) return;
  const payload = { room, code:room, player:{...mazeState.player}, goal:{...config.goal}, moved: !!moved };
  if (typeof direction === 'string') payload.direction = direction;
  if (from) payload.from = from;
  if (goalReached) payload.goalReached = true;
  if (Number.isFinite(t)) payload.t = Number(t);
  target.emit('mazeState', payload);
};

// ソケット処理
io.on('connection', (socket) => {
  socket.data.room = null;
  socket.data.role = null;

  // PC: ルーム作成
  socket.on('create', () => {
    const code = genCode();
    if (socket.data.room) socket.leave(socket.data.room);
    socket.data.room = code; socket.data.role = 'pc';
    socket.join(code);
    socket.emit('code', { code });
    socket.emit('status', { role:'pc', code }); // 待機通知（遷移はしない）
  });

  // PC/スマホ: 入室
  socket.on('join', (payload) => {
    const room = sanitizeCode(payload?.room);
    const role = payload?.role || 'guest';
    if (!room || room.length !== CODE_LEN) { socket.emit('errorMsg', { code:'BAD_CODE', message:`コードは${CODE_LEN}桁です` }); return; }
    if (socket.data.room) socket.leave(socket.data.room);
    socket.data.room = room; socket.data.role = role;
    socket.join(room);

    const s = io.sockets.adapter.rooms.get(room);
    const count = s ? s.size : 1;
    io.to(room).emit('memberUpdate', { type:'join', role, count });
    if (count >= 2) io.to(room).emit('paired', { code: room }); // 同時遷移合図

    // 既存ステートがあれば同期
    const state = roomStates.get(room);
    if (state) {
      const mazeKey = resolveMazeConfigKey(state.mazeConfigKey || state.problem);
      const mazeConfig = getMazeConfig(mazeKey);
      state.mazeConfigKey = mazeKey;
      roomStates.set(room, state);
      socket.emit('status', { room, code: room, ...state });
      if (state.maze) emitMazeState(socket, room, state.maze, { moved:false }, mazeConfig);
    }
  });

  // 汎用 move（必要に応じて）
  socket.on('move', ({ room, payload } = {}) => {
    const code = sanitizeCode(room || socket.data.room);
    if (!code) return;
    const p = payload || {};
    const data = {
      x: Math.max(-1, Math.min(1, Number(p.x || 0))),
      y: Math.max(-1, Math.min(1, Number(p.y || 0))),
      t: Number(p.t || Date.now()),
    };
    socket.to(code).emit('move', data);
  });

  // 迷路の方向移動
  socket.on('moveDirection', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;
    const direction = String(payload.direction || '').toLowerCase();
    if (!['up','down','left','right'].includes(direction)) return;

    const state = roomStates.get(code) || {};
    const mazeKey = resolveMazeConfigKey(state.mazeConfigKey || state.problem);
    const mazeConfig = getMazeConfig(mazeKey);
    if (!state.maze) state.maze = createInitialMazeState(mazeConfig);
    state.mazeConfigKey = mazeKey; roomStates.set(code, state);

    const moveResult = applyMazeMove(state.maze, direction, mazeConfig);
    const timestamp = Number(payload.t || Date.now());
    const meta = { direction, moved: moveResult.moved, goalReached: moveResult.goalReached, from: socket.data.role || undefined, t: timestamp };

    if (!moveResult.moved) { emitMazeState(socket, code, state.maze, meta, mazeConfig); return; }
    emitMazeState(io.to(code), code, state.maze, meta, mazeConfig);
  });

  // 問題選択
  socket.on('problemSelected', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;
    const problem = String(payload.problem || '').trim();
    if (!problem) return;

    const destinations = normalizeDestinations(payload.destinations);
    const mazeKey = resolveMazeConfigKey(problem);
    const mazeConfig = getMazeConfig(mazeKey);
    const maze = createInitialMazeState(mazeConfig);

    const state = { step:'problemSelected', problem, destinations, maze, mazeConfigKey: mazeKey };
    if (problem === '3') state.lightLevel = 1;
    if (problem === '4') state.orientation = { heading:null, direction:null, visited:{ north:false, east:false, south:false, west:false } };
    if (problem === '5') state.audio = createInitialAudioState();
    if (problem === '6') state.shake = createInitialShakeState();

    roomStates.set(code, state);

    const data = { room:code, code, problem, maze, mazeConfigKey: mazeKey };
    if (destinations) data.destinations = destinations;
    io.to(code).emit('problemSelected', data);
    io.to(code).emit('status', { room:code, code, ...state });
  });

  // 戻る
  socket.on('navigateBack', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;
    const role = typeof payload.role === 'string' ? payload.role : undefined;
    roomStates.set(code, { step:'problemSelection' });
    const notifyPayload = { room:code, code }; if (role) notifyPayload.from = role;
    socket.to(code).emit('navigateBack', notifyPayload);
    io.to(code).emit('status', { room:code, code, step:'problemSelection', from: role });
  });

  // 方位（Problem4）
  socket.on('heading', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;
    const headingValue = Number(payload.heading);
    if (!Number.isFinite(headingValue)) return;
    const normalizedHeading = ((headingValue % 360) + 360) % 360;

    const rawDirection = typeof payload.direction === 'string' ? payload.direction.toLowerCase() : undefined;
    const valid = new Set(['north','east','south','west']);
    const direction = rawDirection && valid.has(rawDirection) ? rawDirection : undefined;

    const state = roomStates.get(code) || {};
    const current = state.orientation || {};
    let visited = normalizeVisitedState(current.visited);
    if (payload && typeof payload === 'object') visited = mergeVisitedStates(visited, payload.visited);

    const orientation = {
      heading: normalizedHeading,
      direction: direction || current.direction || null,
      visited,
      updatedAt: Date.now(),
    };
    if (direction) { orientation.direction = direction; orientation.visited[direction] = true; }
    else if (Object.prototype.hasOwnProperty.call(payload, 'direction') && payload.direction === null) {
      orientation.direction = null;
    }

    state.orientation = orientation; roomStates.set(code, state);

    const response = { room:code, code, heading: orientation.heading, visited: { ...orientation.visited } };
    if (orientation.direction) response.direction = orientation.direction;
    if (Number.isFinite(payload.t)) response.t = Number(payload.t);
    if (socket.data?.role) response.from = socket.data.role;
    io.to(code).emit('heading', response);
  });

  // 明るさ（Problem3）
  socket.on('lightLevel', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;
    const level = Number(payload.level);
    if (!Number.isFinite(level)) return;
    const normalized = Math.min(1, Math.max(0, level));
    const state = roomStates.get(code) || {};
    state.lightLevel = normalized; roomStates.set(code, state);
    const response = { room:code, code, level: normalized };
    if (Number.isFinite(payload.t)) response.t = Number(payload.t);
    io.to(code).emit('lightLevel', response);
  });

  // 音量（Problem5）
  socket.on('audioLevel', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;

    const levelValue = Number(payload.level);
    const peakValue = Number(payload.peak);
    const hasLevel = Number.isFinite(levelValue);
    const hasPeak = Number.isFinite(peakValue);
    if (!hasLevel && !hasPeak) return;

    const state = roomStates.get(code) || {};
    const current = state.audio || createInitialAudioState();
    const next = updateAudioState(
      current,
      hasLevel ? levelValue : current.level,
      { peak: hasPeak ? peakValue : undefined },
    );

    state.audio = next; roomStates.set(code, state);

    const response = {
      room: code,
      code,
      level: next.level,
      peak: next.peak,
      threshold: next.threshold,
      thresholdReached: next.thresholdReached,
    };
    if (Number.isFinite(payload.t)) response.t = Number(payload.t);
    if (socket.data?.role) response.from = socket.data.role;
    io.to(code).emit('audioLevel', response);
  });

  // シェイク（Problem6）
  socket.on('shake', (payload = {}) => {
    const code = sanitizeCode(payload.room || payload.code || socket.data.room);
    if (!code || code.length !== CODE_LEN) return;
    const magnitude = Number(payload.magnitude);
    if (!Number.isFinite(magnitude)) return;

    const timestamp = Number(payload.t);
    const now = Number.isFinite(timestamp) ? timestamp : Date.now();

    const state = roomStates.get(code) || {};
    const current = state.shake || createInitialShakeState();
    const next = updateShakeState(current, magnitude, { now });
    state.shake = {
      count: next.count,
      completed: next.completed,
      lastShakeAt: next.lastShakeAt,
      required: next.required,
    };
    roomStates.set(code, state);

    const response = {
      room: code,
      code,
      magnitude,
      count: next.count,
      completed: next.completed,
      required: next.required,
    };
    if (Number.isFinite(payload.t)) response.t = Number(payload.t);
    if (socket.data?.role) response.from = socket.data.role;
    io.to(code).emit('shake', response);
  });

  socket.on('disconnect', () => {
    const room = socket.data.room; if (!room) return;
    const s = io.sockets.adapter.rooms.get(room);
    const count = s ? s.size - 1 : 0;
    io.to(room).emit('memberUpdate', { type:'leave', count });
    if (!s || count <= 0) roomStates.delete(room);
  });
});

// 起動
httpServer.listen(PORT, () => {
  console.log(`[start] Socket.IO on ${PORT}`);
  console.log(`[allow]`, [...ALLOW], `codeLen=${CODE_LEN}`);
});
