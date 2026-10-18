CREATE TABLE IF NOT EXISTS todo_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 16000),
  labels TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(labels)),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','closed')),
  locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_todo_status_updated ON todo_items(status,updated_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS todo_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL REFERENCES todo_items(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES todo_replies(id) ON DELETE SET NULL,
  author TEXT NOT NULL CHECK(length(author) BETWEEN 1 AND 40),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_todo_replies ON todo_replies(todo_id,id);
CREATE TABLE IF NOT EXISTS todo_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  labels TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(labels))
);
INSERT INTO todo_templates(name,title,body,labels) SELECT '功能计划','功能：','## 目标

描述希望实现的功能。

## 待办

- [ ] 设计
- [ ] 实现
- [ ] 验证','["功能"]' WHERE NOT EXISTS (SELECT 1 FROM todo_templates WHERE name='功能计划');
INSERT INTO todo_templates(name,title,body,labels) SELECT '问题修复','修复：','## 问题描述

## 复现步骤

1. 

## 预期结果

## 实际结果','["修复"]' WHERE NOT EXISTS (SELECT 1 FROM todo_templates WHERE name='问题修复');
INSERT INTO todo_templates(name,title,body,labels) SELECT '日常待办','','## 事项

- [ ] 待办内容

## 备注','["待办"]' WHERE NOT EXISTS (SELECT 1 FROM todo_templates WHERE name='日常待办');
CREATE TABLE IF NOT EXISTS todo_reply_limits (
  key TEXT PRIMARY KEY,
  last_at INTEGER NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
