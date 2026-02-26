// popup.js - Async/await version

// DOM elements
const timeLeft = document.getElementById('time-left');
const currentMode = document.getElementById('current-mode');
const startBtn = document.getElementById('start');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');
const sessionsList = document.getElementById('sessions-list');
const addForm = document.getElementById('add-session-form');
const titleInput = document.getElementById('session-title');
const minutesInput = document.getElementById('session-minutes');

// Load and display saved sessions (async)
async function loadSessions() {
  try {
    const { sessions = [] } = await chrome.storage.local.get('sessions');

    sessionsList.innerHTML = '';

    if (sessions.length === 0) {
      sessionsList.innerHTML = '<li>No custom sessions yet — add one!</li>';
      return;
    }

    // Build list items
    sessionsList.innerHTML = sessions
      .map(
        (session, index) => `
          <li>
            <span>${session.title} (${session.minutes} min - ${session.type})</span>
            <button class="use-btn" data-index="${index}">Use</button>
            <button class="delete-btn" data-index="${index}">Delete</button>
          </li>
        `
      )
      .join('');

    // Re-attach event listeners (important after innerHTML reset)
    document.querySelectorAll('.use-btn').forEach(btn => {
      btn.addEventListener('click', handleUse);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', handleDelete);
    });

  } catch (err) {
    console.error('Failed to load sessions:', err);
    sessionsList.innerHTML = '<li>Error loading sessions. Check console.</li>';
  }
}

// Add new session
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const minutes = parseInt(minutesInput.value, 10);
  const type = document.querySelector('input[name="type"]:checked').value;

  if (!title || isNaN(minutes) || minutes < 1 || minutes > 120) {
    alert('Please enter a valid title and minutes (1–120).');
    return;
  }

  try {
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    sessions.push({ id: Date.now(), title, minutes, type });

    await chrome.storage.local.set({ sessions });

    titleInput.value = '';
    minutesInput.value = '25';
    await loadSessions();
    alert('Session added!');
  } catch (err) {
    console.error('Failed to save session:', err);
    alert('Error saving session. Check console.');
  }
});

// Use a session to start timer
async function handleUse(e) {
  const index = parseInt(e.target.dataset.index);
  try {
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    const session = sessions[index];
    if (session) {
      chrome.runtime.sendMessage(
        { action: 'startTimer', session },
        (response) => {
          if (response?.status === 'started') {
            currentMode.textContent = session.type === 'work' ? 'Focus' : 'Break';
            alert(`Started: ${session.title}`);
          }
        }
      );
    }
  } catch (err) {
    console.error(err);
  }
}

// Delete a session
async function handleDelete(e) {
  const index = parseInt(e.target.dataset.index);
  if (!confirm('Delete this session?')) return;

  try {
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    sessions.splice(index, 1);
    await chrome.storage.local.set({ sessions });
    await loadSessions();
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
}

// Button controls - now fully functional
startBtn.addEventListener('click', async () => {
  // For now, start a default 25-min work session (later we'll use selected/custom)
  const defaultSession = { title: 'Default Focus', minutes: 25, type: 'work' };

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startTimer',
      session: defaultSession
    });

    if (response.status === 'started') {
      currentMode.textContent = 'Focus';
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      resetBtn.disabled = false;
      alert('Timer started!');
    }
  } catch (err) {
    console.error('Start failed:', err);
  }
});

pauseBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'pauseTimer' });
    if (response.status === 'paused') {
      currentMode.textContent = 'Paused';
      pauseBtn.textContent = 'Resume';
      pauseBtn.onclick = resumeTimer; // Switch to resume on next click
    }
  } catch (err) {
    console.error('Pause failed:', err);
  }
});

async function resumeTimer() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'resumeTimer' });
    if (response.status === 'resumed') {
      currentMode.textContent = 'Focus'; // or Break depending on session
      pauseBtn.textContent = 'Pause';
      pauseBtn.onclick = pauseBtnClickHandler; // Reset to pause
    }
  } catch (err) {
    console.error('Resume failed:', err);
  }
}

// Helper to reset pause button handler
function pauseBtnClickHandler() {
  pauseBtn.addEventListener('click', pauseBtnClickHandler); // Re-attach if needed
}

resetBtn.addEventListener('click', async () => {
  if (!confirm('Reset timer?')) return;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'resetTimer' });
    if (response.status === 'reset') {
      timeLeft.textContent = '25:00';
      currentMode.textContent = 'Ready';
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      resetBtn.disabled = true;
      pauseBtn.textContent = 'Pause';
      pauseBtn.onclick = pauseBtnClickHandler;
      alert('Timer reset');
    }
  } catch (err) {
    console.error('Reset failed:', err);
  }
});

// Poll timer state every second (already in your code - keep it)
setInterval(async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTimerState' });

    if (response.running) {
      const remainingMs = response.remainingMs;
      if (remainingMs > 0) {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        timeLeft.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        currentMode.textContent = response.session.type === 'work' ? 'Focus' : 'Break';
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        resetBtn.disabled = false;
      } else {
        timeLeft.textContent = '00:00';
        currentMode.textContent = 'Done!';
      }
    } else if (response.paused) {
      timeLeft.textContent = 'Paused';
      currentMode.textContent = 'Paused';
      pauseBtn.textContent = 'Resume';
      pauseBtn.onclick = resumeTimer;
    } else {
      timeLeft.textContent = '25:00';
      currentMode.textContent = 'Ready';
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      resetBtn.disabled = true;
      pauseBtn.textContent = 'Pause';
      pauseBtn.onclick = pauseBtnClickHandler;
    }
  } catch (err) {
    console.error('Timer poll failed:', err);
  }
}, 1000);

// Initial load
loadSessions();

// Poll background every second for timer state
setInterval(async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTimerState' });

    if (response.running) {
      const remainingMs = response.remainingMs;
      if (remainingMs > 0) {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        timeLeft.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        currentMode.textContent = response.session.type === 'work' ? 'Focus' : 'Break';
      } else {
        timeLeft.textContent = '00:00';
        currentMode.textContent = 'Done!';
      }
    } else if (response.paused) {
      timeLeft.textContent = 'Paused';
      currentMode.textContent = 'Paused';
    } else {
      timeLeft.textContent = '25:00';
      currentMode.textContent = 'Ready';
    }
  } catch (err) {
    console.error('Timer poll failed:', err);
  }
}, 1000);