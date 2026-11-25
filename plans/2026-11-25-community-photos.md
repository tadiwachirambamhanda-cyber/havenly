# Plan: private photo store for community posts

## Goal
Community post photos open only for students allowed to see the post, so hiding a post also hides its photos.

## Feature
Owner decision 2026-11-25 ("include private photo store"), closing the open finding from the v2 foundation Codex review (round 3). Part of F19 and F24.

## Steps
1. Migration `20261125240000_community_photos.sql`: a private `community-photos` store (5 MB, images only); students upload and delete only in their own folder; a student sees a photo when it is theirs or belongs to a post they can see (the posts rules apply, so hidden posts, blocked people and old posts are left out); signed-out visitors see none.
2. Rolled-back test `scripts/db-tests/community_photos.py`, then apply live (needs the owner's yes).
3. Lane C's brief: upload to `community-photos`, show with short-lived signed links, never the old public store.

## Checks
Rolled-back test: own-folder uploads only; a visible post's photo is visible to another student; an unused upload is not; once the post is hidden the photo is not; others cannot delete it; the author and the team still see it; signed out sees none; the store is private.

## Not doing
Moving the old archived posts' photos (they stay in the public `post-images` store, untouched, as the owner chose to keep old content). The app code that uploads and shows photos (Lane C).

## Questions
1. Answered 2026-11-25: "yes apply the photo store".

## Verification
Rolled-back test 11/11 passed on the live data. Applied live after the owner's yes: `community-photos` exists and is private; migration history recorded.
