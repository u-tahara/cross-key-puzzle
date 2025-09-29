const pcButton = document.getElementById('pcBtn');
const mobileButton = document.getElementById('spBtn');

pcButton.addEventListener('click', () => {
  window.location.href = 'pc.html';
});

mobileButton.addEventListener('click', () => {
  window.location.href = 'mobile.html';
});
