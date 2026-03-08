# D1 Migration Guide

## Apply firebase_uid Migration

### Option 1: Cloudflare Dashboard (Easiest)

1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **D1 Databases**
3. Select `toss-live-commerce-db`
4. Go to **Console** tab
5. Copy and paste the following SQL:

```sql
-- Add firebase_uid column to users table
ALTER TABLE users ADD COLUMN firebase_uid TEXT;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
```

6. Click **Execute**
7. Verify with: `SELECT * FROM users LIMIT 1;`

### Option 2: Wrangler CLI (Local)

```bash
# Requires CLOUDFLARE_API_TOKEN environment variable
wrangler d1 execute toss-live-commerce-db \
  --remote \
  --file=./migrations/0030_add_firebase_uid.sql
```

### Option 3: GitHub Actions (Requires Workflow Permission)

If you have `workflows` permission, you can use:
- Run workflow: `.github/workflows/run-migration.yml` (to be created)
- Input: `0030_add_firebase_uid.sql`

## Verification

After migration, the API will automatically start syncing `firebase_uid` for all users on their next login.

Check logs for:
```
[Firebase Sync] ✅ 기존 사용자 업데이트 완료
```

## Rollback (if needed)

```sql
-- Remove the column
ALTER TABLE users DROP COLUMN firebase_uid;

-- Remove the index
DROP INDEX IF EXISTS idx_users_firebase_uid;
```

## Why This Migration?

The `firebase_uid` column is required for:
- Syncing Firebase Authentication with D1 database
- Enabling proper user session management
- Supporting multiple auth providers (Email, Kakao, Google, etc.)

Before this migration, the API returns:
```json
{
  "success": true,
  "warning": "Database migration pending",
  "requiresMigration": true
}
```

After migration, normal sync will work:
```json
{
  "success": true,
  "user": { "id": 123, "email": "user@example.com", "name": "User" }
}
```
