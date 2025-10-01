const pcButton = document.getElementById('pcBtn');
const mobileButton = document.getElementById('spBtn');

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

if (pcButton) {
  pcButton.addEventListener('click', () => {
    redirectTo('pc.html');
  });
}

if (mobileButton) {
  mobileButton.addEventListener('click', () => {
    redirectTo('mobile.html');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const destination = determineDestination();
  if (destination) {
    redirectTo(destination);
  }
});
