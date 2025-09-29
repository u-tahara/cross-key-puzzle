const codeDisplay = document.getElementById('pcCodeValue');
const socket = new WebSocket('ws://192.168.1.6:8081');

socket.addEventListener('open', () => {
  socket.send(JSON.stringify({ type: 'create' }));
});

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'code') {
    codeDisplay.textContent = `コード: ${data.code}`;
  }
  if (data.type === 'status' && data.role === 'pc') {
    window.location.href = `pc-next.html?code=${data.code}`;
  }
});
