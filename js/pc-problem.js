(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  const codeDisplay = document.querySelector('[data-code-display]');
  const buttons = document.querySelectorAll('[data-problem]');

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const destinations = {
    '1': 'pc-next.html',
    '2': 'pc-next.html',
    '3': 'pc-next.html',
    '4': 'pc-next.html',
    '5': 'pc-next.html'
  };

  const goToProblem = (problem) => {
    const dest = destinations[problem] || destinations['1'];
    if (!dest) return;
    const url = code ? `${dest}?code=${encodeURIComponent(code)}` : dest;
    window.location.href = url;
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const { problem } = button.dataset;
      goToProblem(problem);
    });
  });
})();
