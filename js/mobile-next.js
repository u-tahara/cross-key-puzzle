const controller = document.querySelector('.controller');
const code = new URLSearchParams(window.location.search).get('code');
const socket = new WebSocket('https://ws.u-tahara.jp');

socket.addEventListener('open', () => {
  socket.send(JSON.stringify({ type: 'resume', role: 'mobile', code }));
});

controller.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-direction]');
  if (!button) {
    return;
  }

  const { direction } = button.dataset;
  socket.send(JSON.stringify({ type: 'move', direction }));
});
