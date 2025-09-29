(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  const codeDisplay = document.querySelector('[data-code-display]');

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const destinationMap = {
    '1': 'mobile-next.html',
    '2': 'mobile-next.html',
    '3': 'mobile-problem3.html',
    '4': 'mobile-next.html',
    '5': 'mobile-next.html'
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
