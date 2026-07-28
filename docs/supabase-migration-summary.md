# Staging Supabase Project Migration: Troubleshooting & Resolution Summary

This document captures the context, steps taken, issues encountered, and final resolutions during the migration of the Sakura 3 Staging environment from the old Supabase project (`lfxkabhzfgenpqfnhjyw`) to the new project (`zhpwhoiigwwgpxvsubdb`).

---

## 1. Background & Context
To align staging environments with the new staging domain (`sr3.my.id`), we migrated our databases, files, and users to a clean Supabase project instance (`zhpwhoiigwwgpxvsubdb`). 

The migration involved updating environment configurations and credentials across three dependent repositories:
- **`community-portal`** (SSO Auth Hub)
- **`file-finder-sr3`** (IPL Finder App)
- **`rekap-viewer`** (IPL Payment Viewer App)

---

## 2. Issues Encountered & Troubleshooting Steps

### Issue 1: Supabase CLI Migration Conflict (`profiles` table already exists)
* **Symptom**: Running `npx supabase db push` to initialize the database returned:
  `ERROR: relation "profiles" already exists (SQLSTATE 42P07)`
* **Root Cause**: The remote database was initialized with standard tables (like `profiles`) by Lovable Cloud's default setup, but the CLI's migration history table (`supabase_migrations.schema_migrations`) was empty. Thus, the CLI tried to run migrations from the very beginning (`20260105012830`), causing table name collisions.
* **Attempted/Considered Solutions**: 
  - *Database Reset*: Dropping the public schema and repushing was rejected because data (17 registered user profiles and files index) had already been migrated/loaded and needed to be preserved.
* **Resolution**: Marked all local migrations as already applied on the remote instance by repairing the migration history using:
  ```bash
  npx supabase migration repair --status applied
  ```
  This synced the CLI history with the actual state of the database without wiping existing tables or records.

---

### Issue 2: Role Assignment Changes Not saving to New Database
* **Symptom**: Setting approval status to `approved` and assigning application roles (e.g. `ipl_finder.admin`) in the Portal UI did not populate the `user_app_roles` table in the new database (queries returned empty `[]`).
* **Root Cause**: Vite builds inject variables (like `VITE_SUPABASE_URL`) **at compile/build time** into static JS bundles. While local configuration files were updated, the staging Portal app (`community-veryresto`) had not been rebuilt and deployed since those edits. The UI was running the old bundle and writing permissions/approvals to the **old** Supabase project instead of the new one.
* **Resolution**: Re-built and deployed the portal to Fly.io:
  ```bash
  npm run deploy:staging
  ```
  Additionally, users had to **log out and log back in** to invalidate old browser session JWTs signed with the old database's key and receive a fresh token signed by the new project's JWT secret.

---

### Issue 3: Storage Upload returning HTTP 400 (Bad Request)
* **Symptom**: Authenticated users trying to upload statement files to the `text-files` bucket received `400 (Bad Request)` errors from the storage API endpoint:
  `POST /storage/v1/object/text-files/... 400 (Bad Request)`
* **Root Cause**: The database migration/cloning process only copied tables from the `public` schema. RLS (Row Level Security) policies on tables in the `storage` schema (like `storage.objects`) were not copied over by default. Since RLS was enabled on the bucket but no select/insert policies existed, the storage server blocked all writes by default.
* **Resolution**: Created a new migration file [20260729000000_recreate_storage_policies.sql](file:///Users/a/Codes/sakura3id/community-portal/supabase/migrations/20260729000000_recreate_storage_policies.sql) to reconstruct the storage RLS policies:
  - **SELECT** policy allowing approved users (`ipl_finder.read_files`) to read.
  - **INSERT** policy allowing authorized uploaders (`ipl_finder.upload_files`) to write.
  - **DELETE** policy allowing uploaders or admins to remove their own files.

  We pushed the new migration to the remote database:
  ```bash
  SUPABASE_ACCESS_TOKEN=your_token npx supabase db push
  ```

---

## 3. Verified Final State
- **Migration History**: All 34 migrations are in sync (`Local == Remote`).
- **User Roles & Approvals**: `veryresto@gmail.com` correctly holds the `ipl_finder.admin` role in `user_app_roles` on the new database.
- **Storage Upload**: Users with the `admin` app role can successfully upload text files to the `text-files` bucket without encountering policy or bad request errors.
