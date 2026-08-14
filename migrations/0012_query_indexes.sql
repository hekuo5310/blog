CREATE INDEX IF NOT EXISTS idx_posts_published_created_at ON posts(published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pages_published_created_at ON pages(published, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_page_views_country_created_at ON page_views(country_code, created_at);
