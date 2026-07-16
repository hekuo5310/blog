CREATE TABLE post_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  post_title TEXT NOT NULL,
  post_slug TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('published', 'updated')),
  changes TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_post_activities_created_at ON post_activities(created_at);
CREATE INDEX idx_post_activities_post_id ON post_activities(post_id);

INSERT INTO post_activities (post_id, post_title, post_slug, event_type, changes, created_at)
SELECT id, title, slug, 'published', '{"published":true}', created_at
FROM posts
WHERE published = 1;
