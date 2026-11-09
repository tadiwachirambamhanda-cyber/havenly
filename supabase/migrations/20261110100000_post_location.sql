-- Optional place a post is about (a café, a venue, an event spot). Plain text
-- so anything a student types works; the app turns it into a "Open in Maps"
-- link. No coordinates: Maps searches the text.
alter table public.posts
  add column location text check (location is null or char_length(location) <= 120);
