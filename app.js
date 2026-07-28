const LOCAL_STORAGE_KEY = 'taskflow_pro_tasks_v1';
let tasks = [];
let activeStatusFilter = 'all';
let activeTagFilter = 'all';
let searchQuery = '';
let currentSort = 'createdAt-desc';
let deferredPrompt;

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initOnlineStatus();
  loadTasks();
  setupEventListeners();
});

// Register Service Worker & Install Prompt
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker Registered:', reg.scope))
      .catch(err => console.error('Service Worker Registration Failed:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('installPWA');
    if (btn) btn.classList.remove('hidden');
  });

  document.getElementById('installPWA')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('アプリが正常にインストールされました', 'success');
    }
    deferredPrompt = null;
    document.getElementById('installPWA').classList.add('hidden');
  });
}

// Online/Offline detection
function initOnlineStatus() {
  const statusEl = document.getElementById('onlineStatus');
  const updateStatus = () => {
    if (navigator.onLine) {
      statusEl.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      statusEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>Online';
      syncTasksWithBackend();
    } else {
      statusEl.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20';
      statusEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>Offline (Local)';
      showToast('オフラインモードに切り替わりました', 'info');
    }
  };
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
}

// Task Fetching & Storage Logic
async function loadTasks() {
  // Load local first for fast rendering
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    try { tasks = JSON.parse(local); } catch (e) { tasks = []; }
  }

  // Attempt server fetch if online
  if (navigator.onLine) {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const serverTasks = await res.json();
        if (Array.isArray(serverTasks) && serverTasks.length > 0) {
          tasks = serverTasks;
          saveToLocalStorage();
        }
      }
    } catch (err) {
      console.log('Serving from local storage cache');
    }
  }
  renderApp();
}

function saveToLocalStorage() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
}

async function syncTasksWithBackend() {
  if (!navigator.onLine) return;
  try {
    await fetch('/api/tasks/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks)
    });
  } catch (err) {
    console.error('Failed to sync backend:', err);
  }
}

// Task Event Handlers
function setupEventListeners() {
  // Add Task Form
  document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('taskTitle');
    const priorityInput = document.getElementById('taskPriority');
    const tagsInput = document.getElementById('taskTags');
    const dueDateInput = document.getElementById('taskDueDate');

    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: titleInput.value.trim(),
      description: '',
      status: 'todo',
      priority: priorityInput.value,
      tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
      dueDate: dueDateInput.value || null,
      createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    saveToLocalStorage();
    renderApp();
    showToast('新しいタスクを追加しました', 'success');
    titleInput.value = '';
    tagsInput.value = '';
    dueDateInput.value = '';

    if (navigator.onLine) {
      try {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask)
        });
      } catch (err) { console.error(err); }
    }
  });

  // Status Filter Group
  document.getElementById('statusFilterGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-status]');
    if (!btn) return;
    document.querySelectorAll('#statusFilterGroup button').forEach(b => b.classList.remove('active', 'bg-slate-700/50', 'text-slate-200'));
    btn.classList.add('active', 'bg-slate-700/50', 'text-slate-200');
    activeStatusFilter = btn.dataset.status;
    renderTaskList();
  });

  // Search and Sort
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderTaskList();
  });
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderTaskList();
  });

  // Modal controls
  document.getElementById('closeEditModal').addEventListener('click', closeModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeModal);
  document.getElementById('editTaskForm').addEventListener('submit', handleEditSubmit);
}

// Render Logic
function renderApp() {
  renderStats();
  renderTagFilters();
  renderTaskList();
}

function renderStats() {
  const total = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'in-progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const todo = tasks.filter(t => t.status === 'todo').length;

  document.getElementById('countAll').textContent = total;
  document.getElementById('countInProgress').textContent = inProgress;
  document.getElementById('countCompleted').textContent = completed;

  document.getElementById('filterAllBadge').textContent = total;
  document.getElementById('filterTodoBadge').textContent = todo;
  document.getElementById('filterInProgressBadge').textContent = inProgress;
  document.getElementById('filterCompletedBadge').textContent = completed;

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  document.getElementById('progressPercent').textContent = percent + '%';
  document.getElementById('progressBar').style.width = percent + '%';
}

function renderTagFilters() {
  const container = document.getElementById('tagFilterContainer');
  const allTags = new Set();
  tasks.forEach(t => t.tags && t.tags.forEach(tag => allTags.add(tag)));

  let html = `<button data-tag="all" class="tag-filter-btn ${activeTagFilter === 'all' ? 'active border-brand-500/50 bg-brand-500/20 text-brand-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'} text-xs px-2.5 py-1 rounded-lg border font-medium transition">すべて</button>`;
  
  allTags.forEach(tag => {
    const isActive = activeTagFilter === tag;
    html += `<button data-tag="${escapeHtml(tag)}" class="tag-filter-btn ${isActive ? 'active border-brand-500/50 bg-brand-500/20 text-brand-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'} text-xs px-2.5 py-1 rounded-lg border font-medium transition">#${escapeHtml(tag)}</button>`;
  });

  container.innerHTML = html;
  container.querySelectorAll('.tag-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTagFilter = btn.dataset.tag;
      renderTagFilters();
      renderTaskList();
    });
  });
}

function getFilteredTasks() {
  return tasks.filter(task => {
    // Status filter
    if (activeStatusFilter !== 'all' && task.status !== activeStatusFilter) return false;
    // Tag filter
    if (activeTagFilter !== 'all' && (!task.tags || !task.tags.includes(activeTagFilter))) return false;
    // Search query
    if (searchQuery) {
      const matchTitle = task.title.toLowerCase().includes(searchQuery);
      const matchDesc = (task.description || '').toLowerCase().includes(searchQuery);
      const matchTag = task.tags && task.tags.some(t => t.toLowerCase().includes(searchQuery));
      if (!matchTitle && !matchDesc && !matchTag) return false;
    }
    return true;
  }).sort((a, b) => {
    if (currentSort === 'createdAt-desc') return new Date(b.createdAt) - new Date(a.createdAt);
    if (currentSort === 'createdAt-asc') return new Date(a.createdAt) - new Date(b.createdAt);
    if (currentSort === 'priority-desc') {
      const pMap = { high: 3, medium: 2, low: 1 };
      return pMap[b.priority] - pMap[a.priority];
    }
    if (currentSort === 'dueDate-asc') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    return 0;
  });
}

function renderTaskList() {
  const listContainer = document.getElementById('taskList');
  const filtered = getFilteredTasks();

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="text-center py-12 bg-slate-800/30 border border-slate-700/40 rounded-2xl">
        <i class="fa-solid fa-clipboard-list text-4xl text-slate-600 mb-3 block"></i>
        <p class="text-slate-400 font-medium text-sm">該当するタスクが見つかりません</p>
        <p class="text-slate-500 text-xs mt-1">新しいタスクを作成するか、フィルターを変更してください。</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filtered.map(task => {
    const priorityColors = {
      high: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    };
    const priorityLabels = { high: '高', medium: '中', low: '低' };
    const statusBadge = {
      'todo': '<span class="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium"><i class="fa-regular fa-circle mr-1"></i>未完了</span>',
      'in-progress': '<span class="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium"><i class="fa-solid fa-spinner animate-spin mr-1"></i>進行中</span>',
      'completed': '<span class="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium"><i class="fa-regular fa-circle-check mr-1"></i>完了</span>'
    };

    const tagsHtml = (task.tags || []).map(tag => `<span class="text-[10px] bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded">#${escapeHtml(tag)}</span>`).join('');

    return `
      <div class="bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-xl p-4 transition-all duration-200 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
        <div class="flex items-start gap-3 flex-1 min-w-0">
          <button onclick="toggleTaskComplete('${task.id}')" class="mt-0.5 text-slate-500 hover:text-emerald-400 transition text-lg flex-shrink-0">
            <i class="fa-${task.status === 'completed' ? 'solid fa-circle-check text-emerald-400' : 'regular fa-circle'}"></i>
          </button>
          <div class="space-y-1.5 flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-semibold ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-100'} truncate">${escapeHtml(task.title)}</h3>
              ${statusBadge[task.status]}
              <span class="px-2 py-0.5 rounded-full text-[10px] border font-semibold ${priorityColors[task.priority]}">${priorityLabels[task.priority]}</span>
            </div>
            ${task.description ? `<p class="text-xs text-slate-400 line-clamp-2">${escapeHtml(task.description)}</p>` : ''}
            <div class="flex items-center gap-3 text-xs text-slate-400 flex-wrap pt-1">
              ${task.dueDate ? `<span class="flex items-center gap-1 text-[11px]"><i class="fa-regular fa-calendar text-slate-500"></i> ${task.dueDate}</span>` : ''}
              ${tagsHtml ? `<div class="flex items-center gap-1">${tagsHtml}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-center opacity-90 group-hover:opacity-100 transition">
          <select onchange="changeTaskStatus('${task.id}', this.value)" class="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2 py-1 outline-none">
            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>未完了</option>
            <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>進行中</option>
            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>完了</option>
          </select>
          <button onclick="openEditModal('${task.id}')" class="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded-lg transition">
            <i class="fa-solid fa-pen-to-square text-xs"></i>
          </button>
          <button onclick="deleteTask('${task.id}')" class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Task Operations
window.toggleTaskComplete = async function(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = task.status === 'completed' ? 'todo' : 'completed';
  saveToLocalStorage();
  renderApp();
  if (navigator.onLine) {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
    } catch (e) {}
  }
};

window.changeTaskStatus = async function(id, status) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = status;
  saveToLocalStorage();
  renderApp();
  if (navigator.onLine) {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
    } catch (e) {}
  }
};

window.deleteTask = async function(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveToLocalStorage();
  renderApp();
  showToast('タスクを削除しました', 'info');
  if (navigator.onLine) {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch (e) {}
  }
};

// Modal & Edit handlers
window.openEditModal = function(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('editTaskId').value = task.id;
  document.getElementById('editTaskTitle').value = task.title;
  document.getElementById('editTaskDesc').value = task.description || '';
  document.getElementById('editTaskPriority').value = task.priority;
  document.getElementById('editTaskStatus').value = task.status;
  document.getElementById('editTaskTags').value = (task.tags || []).join(', ');
  document.getElementById('editTaskDueDate').value = task.dueDate || '';
  
  const modal = document.getElementById('editModal');
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('modal-open'), 10);
};

function closeModal() {
  const modal = document.getElementById('editModal');
  modal.classList.remove('modal-open');
  setTimeout(() => modal.classList.add('hidden'), 200);
}

async function handleEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editTaskId').value;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.title = document.getElementById('editTaskTitle').value.trim();
  task.description = document.getElementById('editTaskDesc').value.trim();
  task.priority = document.getElementById('editTaskPriority').value;
  task.status = document.getElementById('editTaskStatus').value;
  task.tags = document.getElementById('editTaskTags').value.split(',').map(t => t.trim()).filter(Boolean);
  task.dueDate = document.getElementById('editTaskDueDate').value || null;
  task.updatedAt = new Date().toISOString();

  saveToLocalStorage();
  renderApp();
  closeModal();
  showToast('タスク情報を更新しました', 'success');

  if (navigator.onLine) {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
    } catch (e) {}
  }
}

// Utility Helpers
function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-brand-600';
  toast.className = `${bg} text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-xl transition-all duration-300 transform translate-y-2 opacity-0 flex items-center gap-2 pointer-events-auto`;
  toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-info'}"></i> ${msg}`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}