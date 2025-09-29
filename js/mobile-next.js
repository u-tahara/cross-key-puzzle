const controller = document.querySelector('.controller');
const code = new URLSearchParams(window.location.search).get('code');
const socket = new WebSocket('https://ws.u-tahara.jp');

const goBackToProblem = () => {
  const baseUrl = 'mobile-problem.html';
  const url = code ? `${baseUrl}?code=${encodeURIComponent(code)}` : baseUrl;
  window.location.replace(url);
};

const setupBackNavigation = () => {
  if (!window.history || !window.history.pushState) {
    return;
  }

  const stateKey = { page: 'mobile-next' };

  try {
    const currentState = window.history.state || {};
    window.history.replaceState({ ...currentState, ...stateKey }, document.title);
  } catch (error) {
    return;
  }

  const handlePopState = () => {
    window.removeEventListener('popstate', handlePopState);
    goBackToProblem();
  };

  window.addEventListener('popstate', handlePopState);

  try {
    const duplicatedState = { ...(window.history.state || {}), ...stateKey, duplicated: true };
    window.history.pushState(duplicatedState, document.title);
  } catch (error) {
    window.removeEventListener('popstate', handlePopState);
  }
};

setupBackNavigation();

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
