const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// In-memory data persistence
let tasks = [
  {
    id: 'task_sample_1',
    title: 'TaskFlow Proのセットアップ',
    description: 'PWAとオフライン同期機能の動作確認を行います。',
    status: 'completed',
    priority: 'high',
    tags: ['開発', 'PWA'],
    dueDate: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_sample_2',
    title: '新規プロジェクト提案書の作成',
    description: '次期プロダクト仕様に関するレビュー用ドキュメントを用意する。',
    status: 'in-progress',
    priority: 'medium',
    tags: ['仕事', '企画'],
    dueDate: '',
    createdAt: new Date().toISOString()
  }
];

// GET all tasks
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

// POST create task
app.post('/api/tasks', (req, res) => {
  const newTask = req.body;
  if (!newTask.id || !newTask.title) {
    return res.status(400).json({ error: 'Title and ID are required' });
  }
  tasks.unshift(newTask);
  res.status(201).json(newTask);
});

// PUT update task
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...req.body };
    return res.json(tasks[index]);
  }
  res.status(404).json({ error: 'Task not found' });
});

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  tasks = tasks.filter(t => t.id !== id);
  res.json({ success: true, id });
});

// Sync endpoint
app.post('/api/tasks/sync', (req, res) => {
  if (Array.isArray(req.body)) {
    tasks = req.body;
    return res.json({ success: true, count: tasks.length });
  }
  res.status(400).json({ error: 'Invalid array payload' });
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TaskFlow Express server running on port ${PORT}`);
});