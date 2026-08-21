-- Comments can have replies (parent_id), and parent_id references comments
-- with ON DELETE CASCADE. Hard-deleting a comment that has replies would
-- silently wipe those replies too, so deletion is soft when replies exist:
-- the row stays, is_deleted flips true, and the client renders a placeholder
-- instead of the body (mirrors how a withdrawn author's nickname is
-- replaced rather than deleting their posts/comments).

alter table comments add column is_deleted boolean not null default false;
