-- CMS Content Types
-- Stores registered content type definitions (synced from code registry)
CREATE TABLE IF NOT EXISTS content_types (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  fields TEXT NOT NULL DEFAULT '[]',
  settings TEXT NOT NULL DEFAULT '{}',
  icon TEXT DEFAULT 'document',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CMS Content Items
-- Stores the actual content entries for all content types
CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  content_type_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  fields TEXT NOT NULL DEFAULT '{}',
  seo_title TEXT,
  seo_description TEXT,
  seo_image TEXT,
  author_id TEXT,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_type_id, slug),
  FOREIGN KEY (content_type_id) REFERENCES content_types(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

-- CMS Content Tags
-- Tags/categories scoped per content type
CREATE TABLE IF NOT EXISTS content_tags (
  id TEXT PRIMARY KEY,
  content_type_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_type_id, slug),
  FOREIGN KEY (content_type_id) REFERENCES content_types(id) ON DELETE CASCADE
);

-- CMS Content Item <-> Tag junction table
CREATE TABLE IF NOT EXISTS content_item_tags (
  content_item_id TEXT NOT NULL,
  content_tag_id TEXT NOT NULL,
  PRIMARY KEY (content_item_id, content_tag_id),
  FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE,
  FOREIGN KEY (content_tag_id) REFERENCES content_tags(id) ON DELETE CASCADE
);

-- Indexes for CMS tables
CREATE INDEX IF NOT EXISTS idx_content_items_type_id ON content_items(content_type_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_slug ON content_items(slug);
CREATE INDEX IF NOT EXISTS idx_content_items_author_id ON content_items(author_id);
CREATE INDEX IF NOT EXISTS idx_content_items_published_at ON content_items(published_at);
CREATE INDEX IF NOT EXISTS idx_content_items_created_at ON content_items(created_at);
CREATE INDEX IF NOT EXISTS idx_content_tags_type_id ON content_tags(content_type_id);
CREATE INDEX IF NOT EXISTS idx_content_item_tags_item ON content_item_tags(content_item_id);
CREATE INDEX IF NOT EXISTS idx_content_item_tags_tag ON content_item_tags(content_tag_id);
