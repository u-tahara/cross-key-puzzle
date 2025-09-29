(() => {
  const connectButton = document.querySelector('.js-connect');
  const codeInput     = document.getElementById('mobileCodeInput');

  // Socket.IO で接続（wss:// 相当）
  const socket = io('https://ws.u-tahara.jp', {
    transports: ['websocket'],
    withCredentials: true
  });

  let currentCode = '';

  // 入力を常に大文字＆空白除去
  const normalizeCode = (v) => (v || '').trim().toUpperCase();
  codeInput?.addEventListener('input', () => {
    const cur = codeInput.value;
    const norm = normalizeCode(cur);
    if (cur !== norm) codeInput.value = norm;
  });

  // 参加処理（PCと同じコードで join）
  function connect() {
    const code = normalizeCode(codeInput?.value);
    if (!code) {
      window.alert('コードを入力してください');
      codeInput?.focus();
      return;
    }
    if (!code || code.length !== 6) {            // ★ 6桁チェック
    window.alert('6桁のコードを入力してください');
    codeInput?.focus();
    return;
    }
    currentCode = code;
    // 二重押しガード
    if (connectButton) {
      connectButton.disabled = true;
      connectButton.dataset._label ??= connectButton.textContent;
      connectButton.textContent = '接続中…';
    }
    // サーバーへ参加要求（role: mobile）
    socket.emit('join', { room: code, role: 'mobile' });
  }

  // ボタン・Enterキーで接続
  connectButton?.addEventListener('click', connect);
  codeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connect();
  });

  // ---- サーバーからのイベント ----

  // 旧実装互換: サーバーが「mobile用のstatus」を返すとき
  socket.on('status', ({ role, code } = {}) => {
    if (role === 'mobile') {
      const c = code || currentCode;
      location.href = `mobile-next.html?code=${encodeURIComponent(c)}`;
    }
  });

  // 新実装: PCとスマホの“同時遷移”合図
  socket.on('paired', ({ code } = {}) => {
    const c = code || currentCode;
    location.href = `mobile-next.html?code=${encodeURIComponent(c)}`;
  });

  // 互換フォールバック: “部屋の人数更新”で2人以上になったら遷移
  socket.on('memberUpdate', (info = {}) => {
    if (info.type === 'join' && typeof info.count === 'number' && info.count >= 2) {
      location.href = `mobile-next.html?code=${encodeURIComponent(currentCode)}`;
    }
  });

  // サーバー側の明示的エラー
  socket.on('errorMsg', (err = {}) => {
    if (connectButton) {
      connectButton.disabled = false;
      connectButton.textContent = connectButton.dataset._label || '接続する';
    }
    window.alert(err.message || err.text || '接続エラーが発生しました');
  });

  // 接続/切断のUX微調整
  socket.on('connect', () => {
    // 接続済みでも join は“押したタイミング”で送る
    // ここでは何もしない
  });

  socket.on('disconnect', () => {
    // 失敗時ボタンを戻す
    if (connectButton) {
      connectButton.disabled = false;
      connectButton.textContent = connectButton.dataset._label || '接続する';
    }
  });

  // 予防: ブラウザのエラーを拾って表示（開発時に役立つ）
  window.addEventListener('error', (e) => {
    // コンソールにも出るが、画面上の気付き用
    console.warn('Error:', e.message);
  });
})();