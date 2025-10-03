(() => {
  const CODE_STORAGE_KEY = 'cross-key-puzzle:code';

  const readCodeFromQuery = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('code') || '').trim();
    } catch (error) {
      return '';
    }
  };

  const readStoredCode = () => {
    try {
      const stored = window.sessionStorage?.getItem(CODE_STORAGE_KEY);
      return (stored || '').trim();
    } catch (error) {
      return '';
    }
  };

  const storeCode = (value) => {
    if (!value) return;
    try {
      window.sessionStorage?.setItem(CODE_STORAGE_KEY, value);
    } catch (error) {
      // セッションストレージが利用できない場合は無視
    }
  };

  const code = (() => {
    const codeFromQuery = readCodeFromQuery();
    if (codeFromQuery) {
      storeCode(codeFromQuery);
      return codeFromQuery;
    }
    const stored = readStoredCode();
    if (stored) {
      return stored;
    }
    return '';
  })();
  const codeDisplay = document.querySelector('[data-code-display]');

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const destinationMap = {
    '1': 'mobile-next.html',
    '2': 'mobile-gyro.html',
    '3': 'mobile-problem3.html',
    '4': 'mobile-problem4.html',
    '5': 'mobile-problem5.html',
    '6': 'mobile-problem6.html',
  };

  const socket = io('https://ws.u-tahara.jp', {
    transports: ['websocket'],
    withCredentials: true
  });

  const joinRoom = () => {
    if (!code) return;
    socket.emit('join', { room: code, role: 'mobile' });
  };

  if (socket.connected) {
    joinRoom();
  }

  socket.on('connect', () => {
    joinRoom();
  });

  socket.on('reconnect', () => {
    joinRoom();
  });

  const goToProblem = (problem, destinations) => {
    const fallbackDestination = destinationMap[problem] || destinationMap['1'];
    const mobileDest = destinations?.mobile || fallbackDestination || 'mobile-next.html';
    const url = code ? `${mobileDest}?code=${encodeURIComponent(code)}` : mobileDest;
    window.location.href = url;
  };

  socket.on('problemSelected', (payload = {}) => {
    const { room, code: payloadCode, problem, destinations } = payload;
    const roomCode = room || payloadCode;
    if (!roomCode || roomCode !== code) return;
    goToProblem(problem, destinations);
  });

  socket.on('status', ({ room, code: payloadCode, step, problem, destinations } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || roomCode !== code) return;
    if (step === 'problemSelected') {
      goToProblem(problem, destinations);
    }
  });

  socket.on('paired', ({ code: pairedCode } = {}) => {
    if (!pairedCode || pairedCode !== code) return;
    // ペア成立後に PC が選択済みだった場合のフォールバック
  });

  socket.on('memberUpdate', (info = {}) => {
    if (info.type === 'leave' && info.count <= 1) {
      // PCが離脱した場合は待機画面のまま
      return;
    }
  });
})();
