// background.js - Full timer engine

let currentTimer = null; // { endTime: number, session: {...}, paused: boolean, pausedAt: number }

const BADGE_COLOR_WORK = '#ff6347';
const BADGE_COLOR_BREAK = '#3498db';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTimer') {
    const { minutes, title, type } = message.session;

    const endTime = Date.now() + minutes * 60 * 1000;

    currentTimer = {
      endTime,
      session: { title, minutes, type },
      paused: false,
      pausedAt: null
    };

    chrome.alarms.create('pomoTimer', { when: endTime });
    updateBadge(minutes, type);

    sendResponse({ status: 'started', endTime });
    return true;
  }

  if (message.action === 'pauseTimer') {
    if (!currentTimer || currentTimer.paused) {
      sendResponse({ status: 'not running or already paused' });
      return true;
    }

    currentTimer.paused = true;
    currentTimer.pausedAt = Date.now();
    chrome.alarms.clear('pomoTimer');

    chrome.action.setBadgeText({ text: '⏸' });
    chrome.action.setBadgeBackgroundColor({ color: '#7f8c8d' });

    sendResponse({ status: 'paused' });
    return true;
  }

  if (message.action === 'resumeTimer') {
    if (!currentTimer || !currentTimer.paused) {
      sendResponse({ status: 'not paused' });
      return true;
    }

    const elapsedWhilePaused = Date.now() - currentTimer.pausedAt;
    currentTimer.endTime += elapsedWhilePaused;
    currentTimer.paused = false;
    currentTimer.pausedAt = null;

    chrome.alarms.create('pomoTimer', { when: currentTimer.endTime });

    const remainingMs = currentTimer.endTime - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    updateBadge(remainingMinutes, currentTimer.session.type);

    sendResponse({ status: 'resumed' });
    return true;
  }

  if (message.action === 'resetTimer') {
    if (currentTimer) {
      chrome.alarms.clear('pomoTimer');
      currentTimer = null;
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ status: 'reset' });
    } else {
      sendResponse({ status: 'no timer running' });
    }
    return true;
  }

  if (message.action === 'getTimerState') {
    sendResponse({
      running: !!currentTimer && !currentTimer.paused,
      paused: !!currentTimer?.paused,
      endTime: currentTimer?.endTime,
      session: currentTimer?.session,
      remainingMs: currentTimer ? currentTimer.endTime - Date.now() : 0
    });
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomoTimer' && currentTimer && !currentTimer.paused) {
    const session = currentTimer.session;

    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon128.png',
      title: "Time's Up!",
      message: `${session.title} (${session.minutes} min ${session.type}) is complete.`,
      priority: 2
    });

    chrome.action.setBadgeText({ text: '' });
    currentTimer = null;
  }
});

function updateBadge(minutes, type) {
  chrome.action.setBadgeText({ text: minutes.toString() });
  chrome.action.setBadgeBackgroundColor({ color: type === 'work' ? BADGE_COLOR_WORK : BADGE_COLOR_BREAK });
}
