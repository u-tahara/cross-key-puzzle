(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  const codeDisplay = document.querySelector('[data-code-display]');
  const buttons = document.querySelectorAll('[data-problem]');

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const destinations = {
    '1': 'mobile-next.html',
    '2': 'mobile-next.html',
    '3': 'mobile-next.html',
    '4': 'mobile-next.html',
    '5': 'mobile-next.html'
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
