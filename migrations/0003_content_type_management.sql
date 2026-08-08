-- Add is_system flag to content_types to distinguish code-defined vs user-created types
-- System types (from registry) cannot be deleted via admin UI
ALTER TABLE content_types ADD COLUMN is_system INTEGER DEFAULT 0;
