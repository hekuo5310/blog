ALTER TABLE page_views ADD COLUMN country_code TEXT
  CHECK (country_code IS NULL OR length(country_code) = 2);

CREATE INDEX IF NOT EXISTS idx_page_views_country_created_at
  ON page_views(country_code, created_at);
