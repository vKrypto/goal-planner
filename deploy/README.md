# Optional cloud sync

The app stays fully static on GitHub Pages and connects directly to Firebase or Supabase. There is no app server to host. Each browser saves its provider configuration separately in `target-planner.connection.v1`; backup JSON and cloud payloads contain only plan data. No credentials are compiled into the website.

## How versions work

The client canonicalizes the entire validated dataset (including notes, photos, completion states and app currency) and computes a SHA-256 hash. It saves the last successfully synced hash separately. On app open, focus, network reconnection, and one second after local edits, it reads the remote hash first. A visible app also checks once per minute.

- Same local and cloud hash: no payload transfer.
- Only local changed: upload using an atomic expected-hash check.
- Only cloud changed: download, verify the payload hash, then save locally.
- Both changed, unknown nonempty history, or a previously known cloud snapshot disappeared: stop and ask which whole version to keep.

This is snapshot version comparison, not a full Git history or automatic item merge. Choosing a version replaces the other dataset, including deletions. Pulls wait while an item form/detail or backup confirmation is open. Edits made during requests are preserved for the next sync. Failed requests keep local plans intact. Backups remain useful before conflict resolution.

## Firebase

1. Create a Firebase project and Realtime Database; enable email/password Authentication and create an account.
2. Install `firebase.rules.json` as the database rules. Data is scoped to the signed-in user at `target_planner/<uid>/<data_id>`.
3. In app settings choose Firebase. Paste the database URL (example placeholder is shown), Firebase Web API key, email, password, and Data ID.

The password is used for sign-in and discarded. The browser retains refresh credentials and renews ID tokens. Writes use Firebase ETags and `if-match` to reject concurrent writes. Do not use an admin database secret or open read/write database rules.

## Supabase

1. Create a project, enable email/password Auth, and create/confirm an account.
2. Run `supabase.sql` in the SQL editor. It creates an owner-scoped table, RLS policy, and hash/read/conditional-write RPC functions.
3. Choose Supabase in app settings. Enter the project URL, publishable/anon key, email, password, and Data ID.

Rows belong to `auth.uid()`. Atomic writes return false on version conflicts. Never enter a `service_role` or `sb_secret_` key in a browser. The app rejects these keys. The password is discarded after sign-in; session refresh credentials stay local.

Firebase and Supabase are configured by the user. No projects or accounts are created automatically.
