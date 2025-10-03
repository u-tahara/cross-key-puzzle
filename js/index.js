const autoRedirectMessage = document.getElementById('autoRedirectMessage');
const loadingSpinner = document.querySelector('.loading-spinner');
const loadingScreen = document.querySelector('.loading-screen');

const redirectTo = (path) => {
  if (!path) return;
  window.location.replace(path);
};

const detectOS = () => {
  const userAgent = navigator.userAgent || '';
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const ua = userAgent.toLowerCase();
  const pf = platform.toLowerCase();

  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/windows phone/.test(ua)) return 'windows-phone';

  const isMacLike = /mac/.test(pf) || /macintosh/.test(ua);
  if (isMacLike) {
    // iPadOS 13 以降は Mac として報告されるため、タッチ対応か確認
    if (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) {
      return 'ios';
    }
    return 'mac';
  }

  if (/win/.test(pf) || /windows/.test(ua)) return 'windows';
  if (/linux/.test(pf) || /linux/.test(ua)) return 'linux';

  return 'unknown';
};

const determineDestination = () => {
  const os = detectOS();
  if (['android', 'ios', 'windows-phone'].includes(os)) {
    return 'mobile.html';
  }
  if (['windows', 'mac', 'linux'].includes(os)) {
    return 'pc.html';
  }
  return null;
};

window.addEventListener('DOMContentLoaded', () => {
  if (autoRedirectMessage) {
    autoRedirectMessage.textContent = '端末情報を取得しています...';
  }

  if (loadingScreen) {
    loadingScreen.setAttribute('aria-busy', 'true');
  }

  const destination = determineDestination();
  if (destination) {
    if (autoRedirectMessage) {
      const message = destination === 'pc.html'
        ? 'PC端末を確認しました。まもなく移動します。'
        : 'スマホ端末を確認しました。まもなく移動します。';
      autoRedirectMessage.textContent = message;
    }
    setTimeout(() => {
      redirectTo(destination);
    }, 2000);
    return;
  }

  if (autoRedirectMessage) {
    autoRedirectMessage.textContent = '端末を判別できませんでした。PC版またはスマホ版のページを直接開いてください。';
  }

  if (loadingSpinner) {
    loadingSpinner.classList.add('is-hidden');
  }

  if (loadingScreen) {
    loadingScreen.setAttribute('aria-busy', 'false');
  }
});
