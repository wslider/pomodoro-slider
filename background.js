let currentTimer = null; // { endTime: timestamp, session: {...} }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTimer') {
    const { minutes, title, type } = message.session;

    const endTime = Date.now() + minutes * 60 * 1000;

    currentTimer = { endTime, session: { title, minutes, type } };

    chrome.alarms.create('pomoTimer', { when: endTime });

    // Optional: update badge immediately
    chrome.action.setBadgeText({ text: minutes.toString() });
    chrome.action.setBadgeBackgroundColor({ color: type === 'work' ? '#1b5f00' : '#00416d' });

    sendResponse({ status: 'started' });
    return true; // Keep message channel open for async response
  }

  if (message.action === 'getTimerState') {
    sendResponse({
      running: !!currentTimer,
      endTime: currentTimer?.endTime,
      session: currentTimer?.session
    });
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomoTimer') {
    const session = currentTimer.session;

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon128.png',
      title: `Time's up!`,
      message: `${session.title} (${session.minutes} min ${session.type}) is complete.`,
      priority: 2
    });

    // Reset badge
    chrome.action.setBadgeText({ text: '' });

    currentTimer = null;

    // Optional: play sound or send message to popup
  }
});

