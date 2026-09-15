-- Lets a message carry a post alongside (or instead of) its own text, so
-- "Send to" can drop a post into a DM as a tappable preview card rather
-- than just a plain-text link. on delete set null (not cascade): if the
-- shared post is later deleted, the message itself should survive — it
-- just falls back to reading as a plain-text message, same reasoning as
-- conversations.initiator_id.
alter table messages add column shared_post_id uuid references posts(id) on delete set null;
