// ============ State ============
const STORAGE_KEY = 'lifehub_state_v1';

const defaultState = () => ({
  name: '',
  password: '',
  health: { water: {}, sleep: [], steps: [], walks: [] },
  body: { food: [], workouts: [], sleepLog: [] },
  breath: { sessions: [] },
  settings: { waterGoal: 8, sleepRecThreshold: 25 }
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) {}
  return defaultState();
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function today() { return new Date().toISOString().slice(0, 10); }
function now() { return new Date().toISOString(); }
function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// ============ Auth ============
let authenticated = false;
function isAuthRequired() {
  return !document.getElementById('modal-login').classList.contains('hidden') ||
         !document.getElementById('modal-setup').classList.contains('hidden');
}
function checkAuth() {
  authenticated = false;
  if (state.password) {
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').textContent = '';
    openModal('modal-login');
  } else {
    document.getElementById('setup-password').value = '';
    document.getElementById('setup-password2').value = '';
    document.getElementById('setup-error').textContent = '';
    openModal('modal-setup');
  }
}
function doSetup() {
  const p1 = document.getElementById('setup-password').value;
  const p2 = document.getElementById('setup-password2').value;
  if (!p1 || p1.length < 4) {
    document.getElementById('setup-error').textContent = 'Минимум 4 символа';
    return;
  }
  if (p1 !== p2) {
    document.getElementById('setup-error').textContent = 'Пароли не совпадают';
    return;
  }
  state.password = p1;
  saveState();
  authenticated = true;
  closeModal('modal-setup');
  toast('Пароль установлен');
}
function doLogin() {
  const val = document.getElementById('login-password').value;
  if (val === state.password) {
    authenticated = true;
    closeModal('modal-login');
  } else {
    document.getElementById('login-error').textContent = 'Неверный пароль';
  }
}

// ============ Navigation ============
const sectionTitles = {
  dashboard: 'Главная',
  steps: 'Шаги',
  health: 'Здоровье',
  breath: 'Дыхание',
  settings: 'Настройки'
};

function showSection(name) {
  if (isAuthRequired()) { checkAuth(); return; }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.section === name);
  });
  document.getElementById('page-title').textContent = sectionTitles[name] || name;
  // refresh
  if (name === 'dashboard') renderDashboard();
  if (name === 'steps') renderSteps();
  if (name === 'health') renderHealth();
  if (name === 'breath') renderBreath();
  if (name === 'settings') loadSettingsForm();
}

// ============ Modals ============
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => closeModal(b.dataset.close));
});
document.querySelectorAll('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', () => {
    const modal = bd.parentElement;
    if (modal && modal.id !== 'modal-login' && modal.id !== 'modal-setup') closeModal(modal.id);
  });
});
// Auth screen cannot be dismissed by Escape, Back button or swiping away
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isAuthRequired()) e.preventDefault();
});
document.addEventListener('touchmove', (e) => {
  if (isAuthRequired()) e.preventDefault();
}, { passive: false });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isAuthRequired()) checkAuth();
});
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && window.Capacitor.Plugins.App.addListener) {
  window.Capacitor.Plugins.App.addListener('backButton', () => {
    if (isAuthRequired()) return;
    if (window.history.length > 1) window.history.back();
  });
}

// ============ Dashboard ============
function renderDashboard() {
  const name = state.name ? `, ${state.name}` : '';
  document.getElementById('greeting').textContent = `Привет${name}! ${greetingEmoji()}`;
  document.getElementById('dash-water').textContent = state.health.water[today()] || 0;
  document.getElementById('dash-steps').textContent = getTodaySteps();
  const sleeps = (state.health.sleep || []).slice().sort((a,b) => b.date.localeCompare(a.date));
  const lastSleep = sleeps[0];
  document.getElementById('dash-sleep').textContent = lastSleep ? lastSleep.hours : '—';
}

function greetingEmoji() {
  const h = new Date().getHours();
  if (h < 6) return '🌙';
  if (h < 12) return '☀️';
  if (h < 18) return '🌤';
  return '🌙';
}
function isTodayOrNoDate(t) {
  if (!t.dueDate) return true;
  return t.dueDate === today();
}

// ============ Tasks ============
let taskFilter = 'all';
function renderTasks() {
  const list = document.getElementById('task-list');
  let tasks = state.tasks.slice();
  if (taskFilter === 'active') tasks = tasks.filter(t => !t.done);
  if (taskFilter === 'done') tasks = tasks.filter(t => t.done);
  const prioRank = { high: 0, med: 1, low: 2 };
  tasks.sort((a,b) => (a.done - b.done) || ((prioRank[a.priority]||1) - (prioRank[b.priority]||1)) || (a.dueDate||'9').localeCompare(b.dueDate||'9') || b.createdAt.localeCompare(a.createdAt));
  list.innerHTML = '';
  if (tasks.length === 0) {
    list.innerHTML = '<li class="muted">Нет задач</li>';
    return;
  }
  tasks.forEach(t => {
    const li = document.createElement('li');
    if (t.done) li.classList.add('done');
    const prioColor = t.priority === 'high' ? 'var(--danger)' : (t.priority === 'low' ? 'var(--success)' : 'var(--accent)');
    const due = t.dueDate ? `<div class="meta">📅 ${t.dueDate}</div>` : '';
    li.innerHTML = `
      <div class="checkbox ${t.done?'checked':''}" data-id="${t.id}">${t.done?'✓':''}</div>
      <div style="flex:1;">
        <div class="text">${escapeHtml(t.text)}</div>
        ${due}
      </div>
      <span style="width:8px;height:8px;border-radius:50%;background:${prioColor};display:inline-block;"></span>
      <div class="del" data-del="${t.id}">✕</div>
    `;
    list.appendChild(li);
  });
  list.querySelectorAll('.checkbox').forEach(cb => {
    cb.addEventListener('click', () => {
      const t = state.tasks.find(x => x.id === cb.dataset.id);
      if (t) { t.done = !t.done; saveState(); renderTasks(); renderDashboard(); }
    });
  });
  list.querySelectorAll('.del').forEach(d => {
    d.addEventListener('click', () => {
      state.tasks = state.tasks.filter(x => x.id !== d.dataset.del);
      saveState(); renderTasks(); renderDashboard();
    });
  });
}
function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;
  const priority = document.getElementById('task-priority').value;
  const dueDate = document.getElementById('task-date').value || '';
  state.tasks.push({ id: uid(), text, done: false, priority, dueDate, createdAt: now() });
  input.value = '';
  saveState(); renderTasks(); renderDashboard();
}

// ============ Notes ============
let editingNoteId = null;
let selectedColor = '#3a2a1f';
function renderNotes() {
  const q = (document.getElementById('note-search').value || '').toLowerCase();
  const grid = document.getElementById('notes-grid');
  let notes = state.notes.slice().sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  if (q) notes = notes.filter(n => (n.title+n.content).toLowerCase().includes(q));
  grid.innerHTML = '';
  if (notes.length === 0) {
    grid.innerHTML = '<div class="muted" style="grid-column:1/-1;padding:20px;text-align:center;">Нет заметок</div>';
    return;
  }
  notes.forEach(n => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.style.background = n.color || '#3a2a1f';
    card.innerHTML = `
      <div class="note-title">${escapeHtml(n.title || 'Без названия')}</div>
      <div class="note-preview">${escapeHtml((n.content||'').slice(0,120))}</div>
      <div class="note-date">${fmtDate(n.updatedAt)}</div>
    `;
    card.addEventListener('click', () => openNote(n.id));
    grid.appendChild(card);
  });
}
function openNote(id) {
  editingNoteId = id;
  const n = id ? state.notes.find(x => x.id === id) : null;
  document.getElementById('note-modal-title').textContent = id ? 'Редактировать заметку' : 'Новая заметка';
  document.getElementById('note-title').value = n ? n.title : '';
  document.getElementById('note-content').value = n ? n.content : '';
  selectedColor = n ? (n.color || '#3a2a1f') : '#3a2a1f';
  updateColorSelection();
  document.getElementById('delete-note-btn').style.display = id ? 'inline-block' : 'none';
  openModal('modal-note');
}
function saveNote() {
  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-content').value;
  if (editingNoteId) {
    const n = state.notes.find(x => x.id === editingNoteId);
    if (n) { n.title = title; n.content = content; n.color = selectedColor; n.updatedAt = now(); }
  } else {
    state.notes.push({ id: uid(), title, content, color: selectedColor, createdAt: now(), updatedAt: now() });
  }
  saveState(); closeModal('modal-note'); renderNotes(); renderDashboard();
}
function deleteNote() {
  if (!editingNoteId) return;
  state.notes = state.notes.filter(x => x.id !== editingNoteId);
  saveState(); closeModal('modal-note'); renderNotes(); renderDashboard();
}

// ============ Diary ============
let selectedMood = '🙂';
let editingDiaryId = null;
function renderDiary() {
  const list = document.getElementById('diary-list');
  const entries = state.diary.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  list.innerHTML = '';
  if (entries.length === 0) {
    list.innerHTML = '<div class="muted" style="padding:20px;text-align:center;">Нет записей</div>';
    return;
  }
  entries.forEach(e => {
    const div = document.createElement('div');
    div.className = 'diary-entry';
    div.dataset.id = e.id;
    div.innerHTML = `
      <div class="diary-head">
        <span>${fmtDate(e.createdAt)}</span>
        <span class="diary-mood">${e.mood || ''}</span>
        <span class="del" data-del="${e.id}" style="cursor:pointer;color:var(--danger);">✕</span>
      </div>
      <div class="diary-text">${escapeHtml(e.text)}</div>
    `;
    list.appendChild(div);
  });
  list.querySelectorAll('.del').forEach(d => {
    d.addEventListener('click', (ev) => {
      ev.stopPropagation();
      state.diary = state.diary.filter(x => x.id !== d.dataset.del);
      saveState(); renderDiary(); renderDashboard();
    });
  });
  list.querySelectorAll('.diary-entry').forEach(div => {
    div.addEventListener('click', () => openDiary(div.dataset.id));
  });
}
function openDiary(id) {
  editingDiaryId = id;
  const e = id ? state.diary.find(x => x.id === id) : null;
  document.getElementById('diary-modal-title').textContent = id ? 'Редактировать запись' : 'Новая запись';
  document.getElementById('diary-content').value = e ? e.text : '';
  selectedMood = e ? (e.mood || '🙂') : '🙂';
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.toggle('active', b.dataset.mood === selectedMood));
  openModal('modal-diary');
}
function saveDiary() {
  const text = document.getElementById('diary-content').value.trim();
  if (!text) return;
  if (editingDiaryId) {
    const e = state.diary.find(x => x.id === editingDiaryId);
    if (e) { e.text = text; e.mood = selectedMood; }
  } else {
    state.diary.push({ id: uid(), date: today(), mood: selectedMood, text, createdAt: now() });
  }
  editingDiaryId = null;
  document.getElementById('diary-content').value = '';
  saveState(); closeModal('modal-diary'); renderDiary(); renderDashboard();
}
function saveDiary() {
  const text = document.getElementById('diary-content').value.trim();
  if (!text) return;
  state.diary.push({ id: uid(), date: today(), mood: selectedMood, text, createdAt: now() });
  document.getElementById('diary-content').value = '';
  saveState(); closeModal('modal-diary'); renderDiary(); renderDashboard();
}

// ============ Habits ============
function renderHabits() {
  const list = document.getElementById('habits-list');
  list.innerHTML = '';
  if (state.habits.length === 0) {
    list.innerHTML = '<div class="muted" style="padding:20px;text-align:center;">Нет привычек</div>';
    return;
  }
  const t = today();
  state.habits.forEach(h => {
    if (!h.completions) h.completions = {};
    const checked = !!h.completions[t];
    const streak = computeStreak(h);
    const div = document.createElement('div');
    div.className = 'habit-item';
    div.innerHTML = `
      <div class="habit-check ${checked?'checked':''}" data-id="${h.id}">${checked?'✓':''}</div>
      <div class="habit-name">${escapeHtml(h.name)}</div>
      <div class="habit-streak">🔥 ${streak}</div>
      <div class="del" data-del="${h.id}">✕</div>
    `;
    list.appendChild(div);
  });
  list.querySelectorAll('.habit-check').forEach(cb => {
    cb.addEventListener('click', () => {
      const h = state.habits.find(x => x.id === cb.dataset.id);
      if (!h) return;
      if (!h.completions) h.completions = {};
      const t = today();
      if (h.completions[t]) delete h.completions[t];
      else h.completions[t] = true;
      saveState(); renderHabits(); renderDashboard();
    });
  });
  list.querySelectorAll('.del').forEach(d => {
    d.addEventListener('click', () => {
      state.habits = state.habits.filter(x => x.id !== d.dataset.del);
      saveState(); renderHabits(); renderDashboard();
    });
  });
}
function computeStreak(h) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0,10);
    if (h.completions && h.completions[key]) { streak++; }
    else if (i > 0) break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
function addHabit() {
  const input = document.getElementById('habit-input');
  const name = input.value.trim();
  if (!name) return;
  state.habits.push({ id: uid(), name, createdAt: now(), completions: {} });
  input.value = '';
  saveState(); renderHabits(); renderDashboard();
}

// ============ Budget ============
let budgetType = 'expense';
function populateBudgetMonths() {
  const sel = document.getElementById('budget-month');
  if (!sel) return;
  const cur = sel.value;
  const months = new Set();
  state.budget.forEach(b => months.add(b.date.slice(0,7)));
  const nowM = today().slice(0,7);
  months.add(nowM);
  const sorted = Array.from(months).sort().reverse();
  sel.innerHTML = '<option value="all">Все месяцы</option>' + sorted.map(m => `<option value="${m}">${m}</option>`).join('');
  if (cur && Array.from(sel.options).some(o => o.value === cur)) sel.value = cur;
  else sel.value = nowM;
}
function renderBudget() {
  populateBudgetMonths();
  const month = document.getElementById('budget-month').value;
  const list = document.getElementById('budget-list');
  let entries = state.budget.slice();
  if (month && month !== 'all') entries = entries.filter(b => b.date.startsWith(month));
  entries.sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  list.innerHTML = '';
  if (entries.length === 0) {
    list.innerHTML = '<li class="muted">Нет записей</li>';
  } else {
    entries.forEach(b => {
      const li = document.createElement('li');
      const sign = b.type === 'income' ? '+' : '-';
      const color = b.type === 'income' ? 'var(--success)' : 'var(--danger)';
      li.innerHTML = `
        <div style="flex:1;">
          <div class="text">${escapeHtml(b.desc || b.category)}</div>
          <div class="meta">${b.category} · ${b.date}</div>
        </div>
        <div style="color:${color};font-weight:600;">${sign}${Number(b.amount).toLocaleString('ru-RU')} ₽</div>
        <div class="del" data-del="${b.id}">✕</div>
      `;
      list.appendChild(li);
    });
    list.querySelectorAll('.del').forEach(d => {
      d.addEventListener('click', () => {
        state.budget = state.budget.filter(x => x.id !== d.dataset.del);
        saveState(); renderBudget(); renderDashboard();
      });
    });
  }
  updateBudgetSummary(month);
}
function updateBudgetSummary(month) {
  let filtered = state.budget;
  if (month && month !== 'all') filtered = filtered.filter(b => b.date.startsWith(month));
  const inc = filtered.filter(b => b.type === 'income').reduce((s,b) => s + Number(b.amount), 0);
  const exp = filtered.filter(b => b.type === 'expense').reduce((s,b) => s + Number(b.amount), 0);
  document.getElementById('budget-income').textContent = inc.toLocaleString('ru-RU') + ' ₽';
  document.getElementById('budget-expense').textContent = exp.toLocaleString('ru-RU') + ' ₽';
  document.getElementById('budget-balance').textContent = (inc - exp).toLocaleString('ru-RU') + ' ₽';
}
function updateBudgetSummary() {
  const inc = state.budget.filter(b => b.type === 'income').reduce((s,b) => s + Number(b.amount), 0);
  const exp = state.budget.filter(b => b.type === 'expense').reduce((s,b) => s + Number(b.amount), 0);
  document.getElementById('budget-income').textContent = inc.toLocaleString('ru-RU') + ' ₽';
  document.getElementById('budget-expense').textContent = exp.toLocaleString('ru-RU') + ' ₽';
  document.getElementById('budget-balance').textContent = (inc - exp).toLocaleString('ru-RU') + ' ₽';
}
function saveBudget() {
  const amount = Number(document.getElementById('budget-amount').value);
  if (!amount || amount <= 0) return;
  const category = document.getElementById('budget-category').value;
  const desc = document.getElementById('budget-desc').value.trim();
  const type = document.getElementById('budget-type').value;
  state.budget.push({ id: uid(), type, amount, category, desc, date: today() });
  document.getElementById('budget-amount').value = '';
  document.getElementById('budget-desc').value = '';
  saveState(); closeModal('modal-budget'); renderBudget(); renderDashboard();
}
function openBudgetModal(type) {
  budgetType = type;
  document.getElementById('budget-type').value = type;
  document.getElementById('budget-modal-title').textContent = type === 'income' ? 'Новый доход' : 'Новый расход';
  openModal('modal-budget');
}

// ============ Health ============
function renderHealth() {
  const t = today();
  const water = state.health.water[t] || 0;
  document.getElementById('water-count').textContent = water;
  const goal = state.settings.waterGoal || 8;
  document.getElementById('water-progress').style.width = Math.min(100, water / goal * 100) + '%';
  // sleep history
  const sleeps = (state.health.sleep || []).slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  const sleepHistoryEl = document.getElementById('sleep-history');
  if (sleepHistoryEl) sleepHistoryEl.textContent = sleeps.map(s => `${s.date}: ${s.hours} ч`).join(' · ') || 'Нет данных';
  renderSleepRecordings();
  renderBody();
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AudioRecording) {
    renderNativeRecordings();
  }
  const thr = document.getElementById('sleeprec-threshold');
  if (thr) {
    thr.value = sleepRecThreshold;
    document.getElementById('sleeprec-threshold-val').textContent = sleepRecThreshold;
  }
}
function addWater(delta) {
  const t = today();
  if (!state.health.water[t]) state.health.water[t] = 0;
  state.health.water[t] = Math.max(0, state.health.water[t] + delta);
  saveState(); renderHealth(); renderDashboard();
}
function saveSleep() {
  const v = Number(document.getElementById('sleep-input').value);
  if (!v) return;
  if (!state.health.sleep) state.health.sleep = [];
  const t = today();
  const existing = state.health.sleep.find(s => s.date === t);
  if (existing) existing.hours = v;
  else state.health.sleep.push({ date: t, hours: v });
  document.getElementById('sleep-input').value = '';
  saveState(); renderHealth();
}
function getTodaySteps() {
  if (!state.health.steps) state.health.steps = [];
  const e = state.health.steps.find(s => s.date === today());
  return e ? e.count : 0;
}
function setTodaySteps(n) {
  if (!state.health.steps) state.health.steps = [];
  const t = today();
  let e = state.health.steps.find(s => s.date === t);
  if (e) e.count = Math.max(0, n);
  else state.health.steps.push({ date: t, count: Math.max(0, n) });
  saveState();
}
function saveSteps() {
  const v = Number(document.getElementById('steps-input').value);
  if (!v) return;
  setTodaySteps(getTodaySteps() + v);
  document.getElementById('steps-input').value = '';
  renderSteps(); renderDashboard();
}

function renderSteps() {
  document.getElementById('steps-today').textContent = getTodaySteps();
  const steps = (state.health.steps || []).slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  const el = document.getElementById('steps-history');
  if (el) el.textContent = steps.map(s => `${s.date}: ${s.count}`).join(' · ') || 'Нет данных';
  renderGeoHistory();
}
// ============ Geolocation / Walks ============
let geoWatchId = null;
let geoPoints = [];
let geoStart = null;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function startGeoTracking() {
  if (geoWatchId !== null) return;
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation && window.Capacitor.Plugins.Geolocation.requestPermissions) {
    try {
      const p = await window.Capacitor.Plugins.Geolocation.requestPermissions();
      if (p.location !== 'granted' && p.coarseLocation !== 'granted') {
        document.getElementById('geo-status').textContent = 'Нет разрешения на геолокацию';
        toast('Разрешите геолокацию в настройках телефона');
        return;
      }
    } catch (e) {}
  }
  if (!('geolocation' in navigator)) {
    document.getElementById('geo-status').textContent = 'Геолокация не поддерживается';
    return;
  }
  geoPoints = [];
  geoStart = Date.now();
  document.getElementById('geo-status').textContent = 'Отслеживание…';
  document.getElementById('geo-start-btn').disabled = true;
  document.getElementById('geo-stop-btn').disabled = false;
  const onSuccess = (pos) => {
    const { latitude, longitude, accuracy, speed } = pos.coords;
    geoPoints.push({ lat: latitude, lon: longitude, t: Date.now(), accuracy, speed });
    updateGeoUI();
  };
  const onError = (err) => {
    document.getElementById('geo-status').textContent = 'Ошибка: ' + err.message;
  };
  // Use Capacitor if available
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation) {
    window.Capacitor.Plugins.Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
      if (err) { onError(err); return; }
      onSuccess(pos);
    }).then(id => { geoWatchId = id; });
  } else {
    geoWatchId = navigator.geolocation.watchPosition(onSuccess, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  }
}

function stopGeoTracking() {
  if (geoWatchId === null) return;
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation) {
    window.Capacitor.Plugins.Geolocation.clearWatch({ id: geoWatchId });
  } else {
    navigator.geolocation.clearWatch(geoWatchId);
  }
  geoWatchId = null;
  // save walk
  const dist = computeGeoDistance();
  const steps = Math.round(dist * 1300);
  if (dist > 0.05) {
    if (!state.health.walks) state.health.walks = [];
    state.health.walks.push({ date: today(), distance: dist, steps, points: geoPoints.length, createdAt: now() });
    saveState();
    toast(`Прогулка: ${dist.toFixed(2)} км`);
  }
  document.getElementById('geo-status').textContent = 'Остановлено';
  document.getElementById('geo-start-btn').disabled = false;
  document.getElementById('geo-stop-btn').disabled = true;
  renderHealth();
}

function computeGeoDistance() {
  let total = 0;
  for (let i = 1; i < geoPoints.length; i++) {
    total += haversine(geoPoints[i-1].lat, geoPoints[i-1].lon, geoPoints[i].lat, geoPoints[i].lon);
  }
  return total;
}

function updateGeoUI() {
  const dist = computeGeoDistance();
  document.getElementById('geo-distance').textContent = dist.toFixed(2);
  document.getElementById('geo-steps').textContent = Math.round(dist * 1300);
}

function clearGeo() {
  geoPoints = [];
  document.getElementById('geo-distance').textContent = '0';
  document.getElementById('geo-steps').textContent = '0';
  document.getElementById('geo-status').textContent = 'Сброшено';
}

// ============ Sleep sound recording ============
let sleepRecStream = null;
let sleepRecAudioCtx = null;
let sleepRecAnalyser = null;
let sleepRecRecorder = null;
let sleepRecChunks = [];
let sleepRecRecording = false;
let sleepRecActive = false;
let sleepRecSilenceTimer = null;
let sleepRecThreshold = 25;

function openSleepDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('lifehub_sleep', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('recordings')) {
        db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveSleepRecording(blob) {
  const db = await openSleepDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    const store = tx.objectStore('recordings');
    const rec = { blob, createdAt: now(), duration: 0 };
    const req = store.add(rec);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getSleepRecordings() {
  const db = await openSleepDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recordings', 'readonly');
    const store = tx.objectStore('recordings');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function deleteSleepRecording(id) {
  const db = await openSleepDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    const store = tx.objectStore('recordings');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function requestMicPermission() {
  const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AudioRecording;
  if (plugin && plugin.requestMicrophonePermission) {
    try {
      const r = await plugin.requestMicrophonePermission();
      return !!r.granted;
    } catch (e) { return false; }
  }
  return true;
}

async function startSleepRecording() {
  if (sleepRecActive) return;
  const micOk = await requestMicPermission();
  if (!micOk) {
    document.getElementById('sleeprec-status').textContent = 'Нет доступа к микрофону. Разрешите его в настройках приложения.';
    toast('Разрешите доступ к микрофону');
    return;
  }
  const bg = document.getElementById('sleeprec-bg-toggle').checked;
  if (bg && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AudioRecording) {
    try {
      await window.Capacitor.Plugins.AudioRecording.startRecording();
      sleepRecActive = true;
      document.getElementById('sleeprec-status').textContent = 'Фоновая запись…';
      document.getElementById('sleeprec-start-btn').disabled = true;
      document.getElementById('sleeprec-stop-btn').disabled = false;
      toast('Фоновая запись запущена');
    } catch (e) {
      document.getElementById('sleeprec-status').textContent = 'Ошибка: ' + e.message;
    }
    return;
  }
  try {
    sleepRecStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    document.getElementById('sleeprec-status').textContent = 'Нет доступа к микрофону: ' + e.message;
    return;
  }
  sleepRecAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = sleepRecAudioCtx.createMediaStreamSource(sleepRecStream);
  sleepRecAnalyser = sleepRecAudioCtx.createAnalyser();
  sleepRecAnalyser.fftSize = 512;
  source.connect(sleepRecAnalyser);

  sleepRecActive = true;
  document.getElementById('sleeprec-status').textContent = 'Слушаю…';
  document.getElementById('sleeprec-start-btn').disabled = true;
  document.getElementById('sleeprec-stop-btn').disabled = false;

  monitorSleepAudio();
}

function getAudioLevel() {
  if (!sleepRecAnalyser) return 0;
  const data = new Uint8Array(sleepRecAnalyser.frequencyBinCount);
  sleepRecAnalyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / data.length;
}

function monitorSleepAudio() {
  if (!sleepRecActive) return;
  const level = getAudioLevel();
  const thr = sleepRecThreshold;
  if (level > thr && !sleepRecRecording) {
    startSleepChunk();
  } else if (level <= thr && sleepRecRecording) {
    if (!sleepRecSilenceTimer) {
      sleepRecSilenceTimer = setTimeout(() => {
        stopSleepChunk();
        sleepRecSilenceTimer = null;
      }, 2000);
    }
  } else if (level > thr && sleepRecSilenceTimer) {
    clearTimeout(sleepRecSilenceTimer);
    sleepRecSilenceTimer = null;
  }
  requestAnimationFrame(monitorSleepAudio);
}

function startSleepChunk() {
  if (!sleepRecStream) return;
  sleepRecChunks = [];
  sleepRecRecorder = new MediaRecorder(sleepRecStream);
  sleepRecRecorder.ondataavailable = (e) => { if (e.data.size > 0) sleepRecChunks.push(e.data); };
  sleepRecRecorder.onstop = async () => {
    const blob = new Blob(sleepRecChunks, { type: 'audio/webm' });
    if (blob.size > 1000) {
      await saveSleepRecording(blob);
      await renderSleepRecordings();
      toast('Сохранён фрагмент');
    }
    sleepRecChunks = [];
  };
  sleepRecRecorder.start();
  sleepRecRecording = true;
}

function stopSleepChunk() {
  if (sleepRecRecorder && sleepRecRecorder.state !== 'inactive') {
    sleepRecRecorder.stop();
  }
  sleepRecRecording = false;
}

async function stopSleepRecording() {
  const bg = document.getElementById('sleeprec-bg-toggle').checked;
  if (bg && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AudioRecording) {
    try {
      await window.Capacitor.Plugins.AudioRecording.stopRecording();
    } catch (e) {}
    sleepRecActive = false;
    document.getElementById('sleeprec-status').textContent = 'Остановлено';
    document.getElementById('sleeprec-start-btn').disabled = false;
    document.getElementById('sleeprec-stop-btn').disabled = true;
    await renderNativeRecordings();
    toast('Фоновая запись остановлена');
    return;
  }
  sleepRecActive = false;
  if (sleepRecSilenceTimer) { clearTimeout(sleepRecSilenceTimer); sleepRecSilenceTimer = null; }
  if (sleepRecRecording) stopSleepChunk();
  if (sleepRecStream) { sleepRecStream.getTracks().forEach(t => t.stop()); sleepRecStream = null; }
  if (sleepRecAudioCtx) { sleepRecAudioCtx.close(); sleepRecAudioCtx = null; }
  document.getElementById('sleeprec-status').textContent = 'Остановлено';
  document.getElementById('sleeprec-start-btn').disabled = false;
  document.getElementById('sleeprec-stop-btn').disabled = true;
  await renderSleepRecordings();
}

async function renderNativeRecordings() {
  const list = document.getElementById('sleeprec-list');
  const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AudioRecording;
  if (!plugin) { list.innerHTML = '<div class="muted small">Нативный плагин недоступен</div>'; return; }
  try {
    const res = await plugin.listRecordings();
    const files = res.files || [];
    document.getElementById('sleeprec-count').textContent = 'Записей: ' + files.length;
    if (files.length === 0) { list.innerHTML = '<div class="muted small">Нет записей</div>'; return; }
    list.innerHTML = '';
    files.forEach(f => {
      const div = document.createElement('div');
      div.style = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);';
      const btn = document.createElement('button');
      btn.className = 'btn-ghost small';
      btn.textContent = '▶ ' + f.name;
      btn.addEventListener('click', async () => {
        const r = await plugin.readRecording({ name: f.name });
        const audio = new Audio('data:audio/mp4;base64,' + r.base64);
        audio.play();
      });
      const del = document.createElement('span');
      del.className = 'del';
      del.textContent = '✕';
      del.style.cursor = 'pointer';
      div.appendChild(btn);
      div.appendChild(del);
      list.appendChild(div);
    });
  } catch (e) {
    list.innerHTML = '<div class="muted small">Ошибка: ' + e.message + '</div>';
  }
}

async function renderSleepRecordings() {
  const list = document.getElementById('sleeprec-list');
  const recs = await getSleepRecordings();
  document.getElementById('sleeprec-count').textContent = 'Записей: ' + recs.length;
  if (recs.length === 0) { list.innerHTML = '<div class="muted small">Нет записей</div>'; return; }
  list.innerHTML = '';
  recs.slice().reverse().forEach(r => {
    const url = URL.createObjectURL(r.blob);
    const div = document.createElement('div');
    div.style = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);';
    div.innerHTML = `
      <audio controls src="${url}" style="flex:1;height:32px;"></audio>
      <span class="muted small">${new Date(r.createdAt).toLocaleTimeString('ru-RU')}</span>
      <button class="del" data-id="${r.id}">✕</button>
    `;
    list.appendChild(div);
  });
  list.querySelectorAll('.del').forEach(d => {
    d.addEventListener('click', async () => {
      await deleteSleepRecording(Number(d.dataset.id));
      await renderSleepRecordings();
      toast('Удалено');
    });
  });
}

function renderGeoHistory() {
  const walks = (state.health.walks || []).slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  const el = document.getElementById('geo-history');
  if (!el) return;
  if (walks.length === 0) { el.textContent = 'Нет прогулок'; return; }
  el.innerHTML = walks.map(w => `${fmtDate(w.createdAt)}: ${w.distance.toFixed(2)} км (~${w.steps} шагов)`).join('<br>');
}

// ============ Step counter (DeviceMotion) ============
let stepCounting = false;
let stepLastTime = 0;
let stepAccelBuf = [];

function startStepCounting() {
  if (stepCounting) return;
  const status = document.getElementById('step-status');
  if (typeof DeviceMotionEvent === 'undefined') {
    status.textContent = 'Датчик недоступен в этом браузере';
    return;
  }
  const begin = () => {
    stepCounting = true;
    stepLastTime = 0;
    stepAccelBuf = [];
    status.textContent = 'Считаю… (идите с телефоном)';
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Motion) {
      window.Capacitor.Plugins.Motion.addListener('accel', (event) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc) return;
        handleAccel(acc.x, acc.y, acc.z);
      });
    } else {
      window.addEventListener('devicemotion', handleDeviceMotion);
    }
    document.getElementById('step-start-btn').disabled = true;
    document.getElementById('step-stop-btn').disabled = false;
  };
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then(resp => {
        if (resp === 'granted') begin();
        else status.textContent = 'Нет доступа к датчикам движения';
      })
      .catch(err => { status.textContent = 'Ошибка: ' + err.message; });
  } else {
    begin();
  }
}
function stopStepCounting() {
  stepCounting = false;
  window.removeEventListener('devicemotion', handleDeviceMotion);
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Motion) {
    window.Capacitor.Plugins.Motion.removeAllListeners();
  }
  document.getElementById('step-status').textContent = 'Остановлено';
  document.getElementById('step-start-btn').disabled = false;
  document.getElementById('step-stop-btn').disabled = true;
}
function resetSteps() {
  if (!confirm('Сбросить шаги за сегодня?')) return;
  setTodaySteps(0);
  renderSteps(); renderDashboard();
}
function handleAccel(x, y, z) {
  if (!stepCounting) return;
  const mag = Math.sqrt((x||0)**2 + (y||0)**2 + (z||0)**2);
  const delta = mag - 9.81;
  const now = Date.now();
  stepAccelBuf.push({ t: now, v: delta });
  stepAccelBuf = stepAccelBuf.filter(h => now - h.t < 500);
  if (stepAccelBuf.length < 8) return;
  const vals = stepAccelBuf.map(h => h.v);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  if (max - min > 3.5 && delta > max - 0.4 && now - stepLastTime > 400) {
    stepLastTime = now;
    setTodaySteps(getTodaySteps() + 1);
    document.getElementById('steps-today').textContent = getTodaySteps();
    document.getElementById('dash-steps').textContent = getTodaySteps();
  }
}
function handleDeviceMotion(e) {
  if (!stepCounting) return;
  const acc = (e.accelerationIncludingGravity || e.acceleration);
  if (!acc) return;
  handleAccel(acc.x, acc.y, acc.z);
}

// ============ Body (weight, food, workouts, sleep) ============
function renderBody() {
  renderFood();
  renderWorkouts();
  renderSleepLog();
}
function renderWeight() {
  const arr = (state.body.weight || []).slice().sort((a,b) => b.date.localeCompare(a.date));
  const hist = document.getElementById('weight-history');
  if (arr.length === 0) { hist.textContent = 'Нет данных'; document.getElementById('bmi-text').textContent = ''; return; }
  hist.innerHTML = arr.slice(0,7).map(w => `${w.date}: ${w.kg} кг`).join(' · ');
  const last = arr[0];
  const height = 1.7; // default; could be setting
  const bmi = (last.kg / (height*height)).toFixed(1);
  document.getElementById('bmi-text').textContent = `ИМТ (при росте ${height} м): ${bmi}`;
}
function saveWeight() {
  const v = Number(document.getElementById('weight-input').value);
  if (!v) return;
  if (!state.body.weight) state.body.weight = [];
  const t = today();
  const existing = state.body.weight.find(w => w.date === t);
  if (existing) existing.kg = v;
  else state.body.weight.push({ date: t, kg: v });
  document.getElementById('weight-input').value = '';
  saveState(); renderBody();
}
function renderFood() {
  const arr = (state.body.food || []).filter(f => f.date === today());
  const total = arr.reduce((s,f) => s + Number(f.kcal), 0);
  document.getElementById('food-today').textContent = `Сегодня: ${total} ккал`;
  const list = document.getElementById('food-list');
  list.innerHTML = '';
  arr.forEach(f => {
    const div = document.createElement('div');
    div.style = 'display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:13px;';
    div.innerHTML = `<span>${escapeHtml(f.name)} (${f.meal})</span><span>${f.kcal} ккал <span class="del" data-id="${f.id}" style="cursor:pointer;color:var(--danger);">✕</span></span>`;
    list.appendChild(div);
  });
  list.querySelectorAll('.del').forEach(d => {
    d.addEventListener('click', () => {
      state.body.food = state.body.food.filter(f => f.id !== d.dataset.id);
      saveState(); renderFood();
    });
  });
}
function addFood() {
  const name = document.getElementById('food-name').value.trim();
  const kcal = Number(document.getElementById('food-kcal').value);
  const meal = document.getElementById('food-meal').value;
  if (!name || !kcal) return;
  if (!state.body.food) state.body.food = [];
  state.body.food.push({ id: uid(), name, kcal, meal, date: today(), createdAt: now() });
  document.getElementById('food-name').value = '';
  document.getElementById('food-kcal').value = '';
  saveState(); renderFood();
}
function renderWorkouts() {
  const arr = (state.body.workouts || []).filter(w => w.date === today());
  const total = arr.reduce((s,w) => s + Number(w.mins), 0);
  document.getElementById('workout-today').textContent = `Сегодня: ${total} мин`;
  const list = document.getElementById('workout-list');
  list.innerHTML = '';
  arr.forEach(w => {
    const div = document.createElement('div');
    div.style = 'display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:13px;';
    div.innerHTML = `<span>${escapeHtml(w.name)}</span><span>${w.mins} мин <span class="del" data-id="${w.id}" style="cursor:pointer;color:var(--danger);">✕</span></span>`;
    list.appendChild(div);
  });
  list.querySelectorAll('.del').forEach(d => {
    d.addEventListener('click', () => {
      state.body.workouts = state.body.workouts.filter(w => w.id !== d.dataset.id);
      saveState(); renderWorkouts();
    });
  });
}
function addWorkout() {
  const name = document.getElementById('workout-name').value.trim();
  const mins = Number(document.getElementById('workout-mins').value);
  if (!name || !mins) return;
  if (!state.body.workouts) state.body.workouts = [];
  state.body.workouts.push({ id: uid(), name, mins, date: today(), createdAt: now() });
  document.getElementById('workout-name').value = '';
  document.getElementById('workout-mins').value = '';
  saveState(); renderWorkouts();
}
function renderSleepLog() {
  const arr = (state.body.sleepLog || []).slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0,7);
  const el = document.getElementById('sleeplog-history');
  if (arr.length === 0) { el.textContent = 'Нет данных'; return; }
  el.innerHTML = arr.map(s => `${s.date}: ${s.bed}–${s.wake} · ${s.quality}/5`).join('<br>');
}
function saveSleepLog() {
  const bed = document.getElementById('sleep-bed').value;
  const wake = document.getElementById('sleep-wake').value;
  const quality = document.getElementById('sleep-quality').value;
  if (!bed || !wake) return;
  if (!state.body.sleepLog) state.body.sleepLog = [];
  const t = today();
  const existing = state.body.sleepLog.find(s => s.date === t);
  if (existing) { existing.bed = bed; existing.wake = wake; existing.quality = quality; }
  else state.body.sleepLog.push({ date: t, bed, wake, quality });
  saveState(); renderSleepLog(); toast('Сохранено');
}

// ============ Breath ============
let breathTimer = null;
let breathTech = 'box';
let breathCycle = 0;
const breathTechs = {
  box: { phases: [{name:'Вдох',dur:4,cls:'inhale'},{name:'Задержка',dur:4,cls:'hold'},{name:'Выдох',dur:4,cls:'exhale'},{name:'Задержка',dur:4,cls:'hold'}] },
  '478': { phases: [{name:'Вдох',dur:4,cls:'inhale'},{name:'Задержка',dur:7,cls:'hold'},{name:'Выдох',dur:8,cls:'exhale'}] },
  calm: { phases: [{name:'Вдох',dur:5,cls:'inhale'},{name:'Выдох',dur:5,cls:'exhale'}] }
};
function renderBreath() {
  const sessions = (state.breath.sessions || []).slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,10);
  const el = document.getElementById('breath-history');
  if (sessions.length === 0) { el.textContent = 'Нет данных'; return; }
  el.innerHTML = sessions.map(s => `${fmtDate(s.createdAt)}: ${s.tech} · ${s.cycles} циклов`).join('<br>');
}
let breathSessionTimer = null;
function startBreath() {
  if (breathTimer) return;
  const tech = breathTechs[breathTech];
  const circle = document.getElementById('breath-circle');
  const text = document.getElementById('breath-text');
  const phaseEl = document.getElementById('breath-phase');
  let phaseIdx = 0;
  let remaining = tech.phases[0].dur;
  breathCycle = 0;
  document.getElementById('breath-cycles').textContent = '0';
  const tick = () => {
    if (remaining <= 0) {
      phaseIdx = (phaseIdx + 1) % tech.phases.length;
      if (phaseIdx === 0) { breathCycle++; document.getElementById('breath-cycles').textContent = breathCycle; }
      remaining = tech.phases[phaseIdx].dur;
      circle.className = 'breath-circle ' + tech.phases[phaseIdx].cls;
    }
    const ph = tech.phases[phaseIdx];
    text.textContent = ph.name;
    phaseEl.textContent = `${ph.name} · ${remaining}с`;
    remaining--;
    breathTimer = setTimeout(tick, 1000);
  };
  circle.className = 'breath-circle ' + tech.phases[0].cls;
  tick();
  document.getElementById('breath-start-btn').disabled = true;
  document.getElementById('breath-stop-btn').disabled = false;
  if (breathSessionTimer) clearTimeout(breathSessionTimer);
  breathSessionTimer = setTimeout(() => { toast('Сессия завершена (5 мин)'); stopBreath(); }, 5 * 60 * 1000);
}
function stopBreath() {
  if (breathSessionTimer) { clearTimeout(breathSessionTimer); breathSessionTimer = null; }
  if (breathTimer) { clearTimeout(breathTimer); breathTimer = null; }
  document.getElementById('breath-circle').className = 'breath-circle';
  document.getElementById('breath-text').textContent = 'Готов';
  document.getElementById('breath-phase').textContent = 'Выберите технику';
  document.getElementById('breath-start-btn').disabled = false;
  document.getElementById('breath-stop-btn').disabled = true;
  if (breathCycle > 0) {
    if (!state.breath.sessions) state.breath.sessions = [];
    state.breath.sessions.push({ tech: breathTech, cycles: breathCycle, createdAt: now() });
    saveState(); renderBreath();
    toast(`Сессия: ${breathCycle} циклов`);
  }
  breathCycle = 0;
}

// ============ Google Drive backup ============
let gdriveToken = null;
let gdriveTokenClient = null;

function initGDriveClient() {
  const clientId = state.settings.gdriveClientId;
  if (!clientId) return;
  if (!window.google || !google.accounts) return;
  gdriveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (resp) => {
      if (resp.error) { document.getElementById('gdrive-status').textContent = 'Ошибка: ' + resp.error; return; }
      gdriveToken = resp.access_token;
      document.getElementById('gdrive-status').textContent = 'Вошли в Google';
    }
  });
}
function gdriveAuth() {
  const clientId = document.getElementById('gdrive-clientid').value.trim();
  if (!clientId) { toast('Введите Client ID'); return; }
  state.settings.gdriveClientId = clientId;
  saveState();
  if (!window.google || !google.accounts) { toast('Google API не загружен, попробуйте позже'); return; }
  initGDriveClient();
  if (gdriveTokenClient) gdriveTokenClient.requestAccessToken();
}
async function gdriveBackup() {
  if (!gdriveToken) { toast('Сначала войдите в Google'); return; }
  const status = document.getElementById('gdrive-status');
  status.textContent = 'Загрузка…';
  const content = JSON.stringify(state);
  const metadata = { name: 'lifehub-backup.json', mimeType: 'application/json' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));
  try {
    // check existing file
    const search = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27lifehub-backup.json%27&spaces=drive', {
      headers: { Authorization: 'Bearer ' + gdriveToken }
    });
    const searchData = await search.json();
    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';
    if (searchData.files && searchData.files.length > 0) {
      url = 'https://www.googleapis.com/upload/drive/v3/files/' + searchData.files[0].id + '?uploadType=multipart';
      method = 'PATCH';
    }
    const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + gdriveToken }, body: form });
    if (res.ok) { status.textContent = 'Загружено в Drive'; toast('Резервная копия сохранена'); }
    else { status.textContent = 'Ошибка загрузки'; }
  } catch (e) {
    status.textContent = 'Ошибка: ' + e.message;
  }
}
async function gdriveRestore() {
  if (!gdriveToken) { toast('Сначала войдите в Google'); return; }
  const status = document.getElementById('gdrive-status');
  status.textContent = 'Поиск файла…';
  try {
    const search = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27lifehub-backup.json%27&spaces=drive', {
      headers: { Authorization: 'Bearer ' + gdriveToken }
    });
    const searchData = await search.json();
    if (!searchData.files || searchData.files.length === 0) { status.textContent = 'Файл не найден'; return; }
    const fileId = searchData.files[0].id;
    const res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', {
      headers: { Authorization: 'Bearer ' + gdriveToken }
    });
    const data = await res.json();
    state = { ...defaultState(), ...data };
    saveState();
    status.textContent = 'Восстановлено';
    toast('Данные восстановлены');
    showSection('dashboard');
  } catch (e) {
    status.textContent = 'Ошибка: ' + e.message;
  }
}

// ============ Settings ============
function loadSettingsForm() {
  document.getElementById('setting-name').value = state.name || '';
  document.getElementById('setting-password').value = state.password || '';
  document.getElementById('setting-watergoal').value = state.settings.waterGoal || 8;
  document.getElementById('notif-toggle').checked = !!state.settings.notifications;
  document.getElementById('gdrive-clientid').value = state.settings.gdriveClientId || '';
  hasNotificationPermission().then(ok => notifStatus(ok ? 'Разрешение на уведомления есть' : 'Разрешение не получено — нажмите кнопку ниже'));
  const stats = `Вода: ${state.health.water[today()] || 0} стаканов · Шаги: ${getTodaySteps()} · Сессий дыхания: ${(state.breath.sessions || []).length}`;
  document.getElementById('stats-text').textContent = stats;
}
function saveSettings() {
  state.name = document.getElementById('setting-name').value.trim();
  state.password = document.getElementById('setting-password').value;
  state.settings.waterGoal = Number(document.getElementById('setting-watergoal').value) || 8;
  const notif = document.getElementById('notif-toggle').checked;
  if (notif && !state.settings.notifications) {
    requestNotificationPermission();
  }
  state.settings.notifications = notif;
  saveState();
  toast('Сохранено');
  renderDashboard();
  renderHealth();
  setupNotifications();
}
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lifehub-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      state = { ...defaultState(), ...data };
      saveState();
      toast('Импортировано');
      showSection('dashboard');
    } catch (err) {
      toast('Ошибка файла');
    }
  };
  reader.readAsText(file);
}
function clearData() {
  if (!confirm('Удалить все данные?')) return;
  state = defaultState();
  saveState();
  showSection('dashboard');
}

// ============ Helpers ============
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

let waterReminderTimer = null;
function notifStatus(text) {
  const el = document.getElementById('notif-status');
  if (el) el.textContent = text || '';
}
async function hasNotificationPermission() {
  const custom = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AudioRecording;
  if (custom && custom.checkNotificationPermission) {
    try {
      const r = await custom.checkNotificationPermission();
      return !!r.granted;
    } catch (e) { return false; }
  }
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    try {
      const p = await window.Capacitor.Plugins.LocalNotifications.checkPermissions();
      return p.display === 'granted';
    } catch (e) { return false; }
  }
  return 'Notification' in window && Notification.permission === 'granted';
}
async function requestNotificationPermission() {
  const custom = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AudioRecording;
  if (custom && custom.requestNotificationPermission) {
    try {
      const r = await custom.requestNotificationPermission();
      const ok = !!r.granted;
      const msg = ok ? 'Уведомления включены' : 'Разрешение не получено — включите в настройках телефона';
      toast(msg); notifStatus(msg);
      return ok;
    } catch (e) {
      const msg = 'Ошибка запроса разрешения: ' + e.message;
      toast(msg); notifStatus(msg);
      return false;
    }
  }
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    try {
      const p = await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
      const ok = p.display === 'granted';
      const msg = ok ? 'Уведомления включены' : 'Разрешение не получено — включите в настройках телефона';
      toast(msg); notifStatus(msg);
      return ok;
    } catch (e) {
      const msg = 'Ошибка запроса разрешения: ' + e.message;
      toast(msg); notifStatus(msg);
      return false;
    }
  }
  if (!('Notification' in window)) {
    const msg = 'Уведомления не поддерживаются в этом браузере';
    toast(msg); notifStatus(msg);
    return false;
  }
  try {
    const p = await Notification.requestPermission();
    const ok = p === 'granted';
    const msg = ok ? 'Уведомления включены' : 'Разрешение не получено';
    toast(msg); notifStatus(msg);
    return ok;
  } catch (e) {
    const msg = 'Ошибка запроса разрешения: ' + e.message;
    toast(msg); notifStatus(msg);
    return false;
  }
}
function sendNotification(title, body) {
  if (!state.settings.notifications) return;
  // Capacitor native
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    window.Capacitor.Plugins.LocalNotifications.schedule({
      notifications: [{
        title: title,
        body: body || '',
        id: Date.now() % 100000,
        schedule: { at: new Date(Date.now() + 100) },
        smallIcon: 'ic_stat_lifehub'
      }]
    }).catch(() => {});
    return;
  }
  // Web fallback
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body: body || '', icon: 'icon.svg', badge: 'icon.svg' });
  } catch (e) {}
}
function setupNotifications() {
  if (waterReminderTimer) clearInterval(waterReminderTimer);
  if (!state.settings.notifications) return;
  // remind about water every 2 hours while app is open
  waterReminderTimer = setInterval(() => {
    const w = state.health.water[today()] || 0;
    const goal = state.settings.waterGoal || 8;
    if (w < goal) sendNotification('Вода', `Вы выпили ${w} из ${goal} стаканов. Время попить воды!`);
  }, 2 * 60 * 60 * 1000);
}
function notifyTaskDone() {
  // optional
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function updateColorSelection() {
  document.querySelectorAll('.color-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.color === selectedColor);
  });
}

// ============ Event wiring ============
document.addEventListener('DOMContentLoaded', () => {
  // nav
  document.querySelectorAll('.nav-item').forEach(b => {
    b.addEventListener('click', () => showSection(b.dataset.section));
  });
  // dashboard quick actions
  document.querySelectorAll('[data-goto]').forEach(c => {
    c.addEventListener('click', () => showSection(c.dataset.goto));
  });
  document.querySelectorAll('[data-action]').forEach(b => {
    b.addEventListener('click', () => {
      const a = b.dataset.action;
      if (a === 'drink-water') { addWater(1); }
      if (a === 'start-steps') { showSection('steps'); }
      if (a === 'start-breath') { showSection('breath'); }
      if (a === 'record-sleep') { showSection('health'); document.getElementById('sleeprec-start-btn').click(); }
    });
  });

  // health
  document.getElementById('water-plus').addEventListener('click', () => addWater(1));
  document.getElementById('water-minus').addEventListener('click', () => addWater(-1));
  document.getElementById('save-steps-btn').addEventListener('click', saveSteps);
  document.getElementById('step-start-btn').addEventListener('click', startStepCounting);
  document.getElementById('step-stop-btn').addEventListener('click', stopStepCounting);
  document.getElementById('step-reset-btn').addEventListener('click', resetSteps);
  document.getElementById('step-stop-btn').disabled = true;
  document.getElementById('geo-start-btn').addEventListener('click', startGeoTracking);
  document.getElementById('geo-stop-btn').addEventListener('click', stopGeoTracking);
  document.getElementById('geo-clear-btn').addEventListener('click', clearGeo);
  document.getElementById('geo-stop-btn').disabled = true;
  document.getElementById('sleeprec-start-btn').addEventListener('click', startSleepRecording);
  document.getElementById('sleeprec-stop-btn').addEventListener('click', stopSleepRecording);
  document.getElementById('sleeprec-stop-btn').disabled = true;
  document.getElementById('sleeprec-threshold').addEventListener('input', (e) => {
    sleepRecThreshold = Number(e.target.value);
    state.settings.sleepRecThreshold = sleepRecThreshold;
    saveState();
    document.getElementById('sleeprec-threshold-val').textContent = sleepRecThreshold;
  });
  document.getElementById('add-food-btn').addEventListener('click', addFood);
  document.getElementById('add-workout-btn').addEventListener('click', addWorkout);
  document.getElementById('save-sleeplog-btn').addEventListener('click', saveSleepLog);

  // breath
  document.querySelectorAll('[data-tech]').forEach(b => {
    b.addEventListener('click', () => {
      breathTech = b.dataset.tech;
      document.querySelectorAll('[data-tech]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  });
  const defaultTech = document.querySelector('[data-tech="box"]');
  if (defaultTech) defaultTech.classList.add('active');
  document.getElementById('breath-start-btn').addEventListener('click', startBreath);
  document.getElementById('breath-stop-btn').addEventListener('click', stopBreath);
  document.getElementById('breath-stop-btn').disabled = true;

  // settings
  document.getElementById('settings-btn').addEventListener('click', () => showSection('settings'));
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
  document.getElementById('notif-permission-btn').addEventListener('click', requestNotificationPermission);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('clear-data-btn').addEventListener('click', clearData);
  document.getElementById('clear-cache-btn').addEventListener('click', async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if (window.caches) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
    toast('Кэш очищен, перезагрузка…');
    setTimeout(() => location.reload(), 800);
  });
  document.getElementById('gdrive-auth-btn').addEventListener('click', gdriveAuth);
  document.getElementById('gdrive-backup-btn').addEventListener('click', gdriveBackup);
  document.getElementById('gdrive-restore-btn').addEventListener('click', gdriveRestore);

  // login
  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  // setup
  document.getElementById('setup-btn').addEventListener('click', doSetup);
  document.getElementById('setup-password2').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSetup();
  });

  // auth check
  sleepRecThreshold = state.settings.sleepRecThreshold || 25;
  checkAuth();
  showSection('dashboard');
  setupNotifications();
  if (window.Capacitor) {
    setTimeout(() => {
      hasNotificationPermission().then(ok => { if (!ok) requestNotificationPermission(); });
    }, 1200);
  }
});
