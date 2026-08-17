CREATE INDEX IF NOT EXISTS idx_posts_published_created_at ON posts(published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pages_published_created_at ON pages(published, created_at ASC);
