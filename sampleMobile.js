// ----------------------
// ES Modules / WebSocket
// ----------------------

export function SampleMobile() {
  const socket = new WebSocket("https://ws.u-tahara.jp");

  function connect() {
    const code = document.getElementById('code').value;
    socket.send(JSON.stringify({ type: "join", code }));
  }

  document.querySelector('.js-connect').addEventListener('click', connect);

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'status' && data.role === 'mobile') {
      location.href = `mobile-next.html?code=${data.code}`;
    }
    if (data.type === 'error') {
      alert(data.text);
    }
  });
}