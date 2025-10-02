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
  const buttons = document.querySelectorAll('[data-problem]');

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }


  const destinationMap = {
    '1': { pc: 'pc-next.html', mobile: 'mobile-next.html' },
    '2': { pc: 'pc-gyro.html', mobile: 'mobile-gyro.html' },
    '3': { pc: 'pc-problem3.html', mobile: 'mobile-problem3.html' },
    '4': { pc: 'pc-problem4.html', mobile: 'mobile-problem4.html' },
    '5': { pc: 'pc-problem5.html', mobile: 'mobile-problem5.html' },
    '6': { pc: 'pc-problem6.html', mobile: 'mobile-problem6.html' },
  };

  const socket = io('https://ws.u-tahara.jp', {
    transports: ['websocket'],
    withCredentials: true
  });

  const pendingQueue = [];

  const emitQueued = () => {
    if (!socket.connected) return;
    while (pendingQueue.length) {
      const payload = pendingQueue.shift();
      socket.emit('problemSelected', payload);
      socket.emit('status', {
        role: 'mobile',
        code,
        room: code,
        step: 'problemSelected',
        problem: payload?.problem,
        destinations: payload?.destinations
      });
    }
  };

  const joinRoom = () => {
    if (!code) return;
    socket.emit('join', { room: code, role: 'pc' });
  };

  socket.on('connect', () => {
    joinRoom();
    emitQueued();
  });

  socket.on('problemSelected', (payload = {}) => {
    const { room, code: payloadCode, problem } = payload;
    const roomCode = room || payloadCode;
    if (!roomCode || roomCode !== code) return;
    goToProblem(problem);
  });

  socket.on('disconnect', () => {
    // 再接続時に部屋へ復帰する
    // Socket.IO が自動再接続後に connect を発火するため特別な処理は不要
  });

  const goToProblem = (problem) => {
    const entry = destinationMap[problem] || destinationMap['1'];
    if (!entry) return;
    const dest = entry.pc;

    const url = code ? `${dest}?code=${encodeURIComponent(code)}` : dest;
    window.location.href = url;
  };


  const notifySelection = (problem) => {
    if (!code) return;
    const entry = destinationMap[problem] || destinationMap['1'];
    if (!entry) return;

    const payload = {
      room: code,
      code,
      problem,
      destinations: entry
    };

    if (socket.connected) {
      socket.emit('problemSelected', payload);
      socket.emit('status', {
        role: 'mobile',
        code,
        room: code,
        step: 'problemSelected',
        problem,
        destinations: entry
      });
    } else {
      pendingQueue.length = 0;
      pendingQueue.push(payload);
    }
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const { problem } = button.dataset;
      if (!problem) return;

      buttons.forEach((b) => {
        b.disabled = true;
      });

      notifySelection(problem);
      // イベント送信から遷移まで僅かな余裕を持たせる
      setTimeout(() => {
        goToProblem(problem);
      }, 120);

    });
  });
})();