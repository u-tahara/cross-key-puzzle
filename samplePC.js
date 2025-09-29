// ----------------------
// ES Modules / WebSocket
// ----------------------

export function SamplePC() {
  const socket = new WebSocket("ws://192.168.1.6:8081");

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: "create" }));
  });

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'code') {
      document.getElementById('code').textContent = 'コード: ' + data.code;
    }
    if (data.type === 'status' && data.role === 'pc') {
      // ペア成立 → 次画面へ遷移
      location.href = `pc-next.html?code=${data.code}`;
    }
  });
}