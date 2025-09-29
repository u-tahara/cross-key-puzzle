const connectButton = document.querySelector('.js-connect');
const codeInput = document.getElementById('mobileCodeInput');
const socket = new WebSocket('ws://192.168.1.6:8081');

function connect() {
  const code = codeInput.value.trim();
  if (!code) {
    window.alert('コードを入力してください');
    return;
  }
  socket.send(JSON.stringify({ type: 'join', code }));
}

connectButton.addEventListener('click', connect);

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'status' && data.role === 'mobile') {
    window.location.href = `mobile-next.html?code=${data.code}`;
  }
  if (data.type === 'error') {
    window.alert(data.text);
  }
});
