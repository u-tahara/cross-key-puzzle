(() => {
  const codeDisplay = document.getElementById('pcCodeValue');
  const CODE_STORAGE_KEY = 'cross-key-puzzle:code';

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

  const updateCodeDisplay = (value) => {
    if (!codeDisplay) return;
    codeDisplay.textContent = `コード: ${value || ''}`;
  };

  // wss 相当のSocket.IO接続
  const socket = io('https://ws.u-tahara.jp', {
    transports: ['websocket'],
    withCredentials: true
  });

  let currentCode = readStoredCode() || null;

  if (currentCode) {
    updateCodeDisplay(currentCode);
  }

  socket.on('connect', () => {
    // ルーム作成リクエスト（サーバー側でコード生成＆PCをその部屋にjoin）
    socket.emit('create');
  });

  // 生成されたコードを受け取って表示
  socket.on('code', ({ code } = {}) => {
    currentCode = code || currentCode;
    if (currentCode) {
      storeCode(currentCode);
    }
    updateCodeDisplay(currentCode);
  });

  // PCが待機状態になった通知（遷移はしない）
  socket.on('status', ({ role, code } = {}) => {
    if (role === 'pc') {
      currentCode = code || currentCode;
      if (currentCode) {
        storeCode(currentCode);
      }
      // ここでは遷移しない。スマホ参加＝paired を待つ。
    }
  });

  // 🔴 スマホが同じコードで入室した合図（同時遷移）
  socket.on('paired', ({ code } = {}) => {
    const c = code || currentCode || '';
    location.href = `pc-problem.html?code=${encodeURIComponent(c)}`;
  });

  // 互換フォールバック：メンバー数イベントで2人以上になったら遷移
  socket.on('memberUpdate', (info = {}) => {
    if (info.type === 'join' && typeof info.count === 'number' && info.count >= 2) {
      const c = currentCode || '';
      location.href = `pc-problem.html?code=${encodeURIComponent(c)}`;
    }
  });

  // 任意：開発時のエラー検知
  window.addEventListener('error', (e) => console.warn('PC Error:', e.message));
})();
