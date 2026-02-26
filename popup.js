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

// Load sessions from storage and display them
async function loadSessions() {
  try {
    const { sessions = [] } = await chrome.storage.local.get('sessions');

    sessionsList.innerHTML = '';

    if (sessions.length === 0) {
      sessionsList.innerHTML = '<li>No custom sessions yet — add one!</li>';
      return;
    }

    sessions.forEach((session, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${session.title} (${session.minutes} min - ${session.type})</span>
        <button class="use-btn" data-index="${index}">Use</button>
        <button class="delete-btn" data-index="${index}">Delete</button>
      `;
      sessionsList.appendChild(li);
    });

    // Re-attach listeners (querySelectorAll after DOM update)
    document.querySelectorAll('.use-btn').forEach(btn =>
      btn.addEventListener('click', handleUse)
    );
    document.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', handleDelete)
    );

  } catch (err) {
    console.error('Failed to load sessions:', err);
    sessionsList.innerHTML = '<li>Error loading sessions</li>';
  }
}

setInterval(async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTimerState' });
    if (response.running) {
      const remainingMs = response.endTime - Date.now();
      if (remainingMs > 0) {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        timeLeft.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        currentMode.textContent = response.session.type === 'work' ? 'Focus' : 'Break';
      } else {
        timeLeft.textContent = '00:00';
        currentMode.textContent = 'Done!';
      }
    } else {
      timeLeft.textContent = '25:00';
      currentMode.textContent = 'Ready';
    }
  } catch (err) {
    console.error('Timer poll error:', err);
  }
}, 1000);

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
    await loadSessions();           // assuming loadSessions is async too
    alert('Session added!');
  } catch (err) {
    console.error('Failed to save session:', err);
    alert('Error saving session. Check console.');
  }
});

async function handleUse(e) {
  const index = parseInt(e.target.dataset.index);
  try {
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    const session = sessions[index];
    if (session) {
      // Send to background
      chrome.runtime.sendMessage(
        { action: 'startTimer', session },
        (response) => {
          if (response?.status === 'started') {
            alert(`Started: ${session.title}`);

            currentMode.textContent = session.type === 'work' ? 'Focus' : 'Break';
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

// Button placeholders (can stay sync for now, or make async later when real)
startBtn.addEventListener('click', () => alert('TODO: Start timer'));
pauseBtn.addEventListener('click', () => alert('TODO: Pause'));
resetBtn.addEventListener('click', () => alert('TODO: Reset'));

loadSessions();