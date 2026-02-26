console.log('Pomodoro Slider background service worker loaded!');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed or updated');
});

