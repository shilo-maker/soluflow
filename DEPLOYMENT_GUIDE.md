# SoluFlow Production Deployment Guide

## Overview
This deployment includes major changes to the database structure for multi-workspace functionality.

## Major Changes in This Update
- ✅ Multi-workspace system (Personal & Team workspaces)
- ✅ Workspace roles (Admin, Planner, Leader, Member)
- ✅ Workspace invitations and member management
- ✅ Workspace-scoped songs and services
- ✅ Persistent song transposition per service
- ✅ Song and service visibility controls
- ✅ Enhanced UI/UX improvements
- ✅ Fixed login error message persistence

## Pre-Deployment Steps

### 1. Commit and Push All Changes
```bash
git add .
git commit -m "Major update: Multi-workspace functionality with complete migration"
git push origin main
```

### 2. Set Up Environment Variables
Make sure you have these environment variables set in your local `.env`:
- `PRODUCTION_DATABASE_URL` - Your Render PostgreSQL connection string

## Deployment Steps

### Step 1: Run Local Migration Script (Copy Data from Local to Production)

1. Make sure your local database has all the data you want to migrate
2. Get your production database URL from Render dashboard
3. Add it to your `.env` file as `PRODUCTION_DATABASE_URL`
4. Run the migration script:

```bash
cd server
node production-full-migration.js
```

This script will:
- Export all data from your local SQLite database
- Drop and recreate all tables in production with the new schema
- Create personal workspaces for all existing users
- Import all users, songs, services, and relationships
- Verify the data migration

### Step 2: Deploy to Render

Your render.yaml is already configured. The deployment will happen automatically when you push to GitHub.

1. Push your code to GitHub (if not already done):
```bash
git push origin main
```

2. Render will automatically:
   - Build and deploy the backend API
   - Build and deploy the frontend

3. Monitor the deployment in Render dashboard:
   - Backend: https://dashboard.render.com
   - Check build logs for any errors

### Step 3: Verify Production Deployment

1. Check the backend health endpoint:
   - Visit: `https://your-api-url.onrender.com/api/health`
   - Should return: `{"status": "ok"}`

2. Test the frontend:
   - Visit your frontend URL
   - Try logging in with an existing user
   - Verify workspace functionality works

3. Test key features:
   - [ ] Login/Registration works
   - [ ] Workspace switcher appears
   - [ ] Songs are visible in library
   - [ ] Services can be created and viewed
   - [ ] Transposition persists when switching songs
   - [ ] Workspace settings page works
   - [ ] Team workspace creation works
   - [ ] Invite links can be generated

## Rollback Plan

If something goes wrong:

1. **Database Rollback**: You have your local SQLite database as backup
2. **Code Rollback**:
   ```bash
   git revert HEAD
   git push origin main
   ```

## Database Schema Summary

### New Tables
- `workspaces` - Stores personal and team workspaces
- `workspace_members` - User membership in workspaces with roles
- `workspace_invitations` - Temporary invitation links for workspaces
- `song_workspaces` - Many-to-many relationship for songs shared across workspaces

### Modified Tables
- `users` - No schema changes, but all users get personal workspaces
- `songs` - Added `workspace_id` column
- `services` - Added `workspace_id` column

### Preserved Data
- All users (with passwords intact)
- All songs (assigned to creator's personal workspace)
- All services (assigned to creator's personal workspace)
- All service setlists
- All shared services

## Post-Deployment Verification Queries

Connect to production database and run these to verify:

```sql
-- Check user count
SELECT COUNT(*) FROM users;

-- Check workspace count (should equal user count for personal workspaces)
SELECT COUNT(*) FROM workspaces;

-- Check all workspaces have members
SELECT w.name, COUNT(wm.id) as member_count
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
GROUP BY w.id, w.name;

-- Check songs are associated with workspaces
SELECT COUNT(*) FROM songs WHERE workspace_id IS NOT NULL;

-- Check services are associated with workspaces
SELECT COUNT(*) FROM services WHERE workspace_id IS NOT NULL;
```

## Troubleshooting

### Issue: Migration script fails
- **Solution**: Check the error message. Most common issues:
  - Wrong database URL
  - Network connectivity to production database
  - Local database file not found

### Issue: Frontend can't connect to backend
- **Solution**:
  - Check `REACT_APP_API_URL` and `REACT_APP_SERVER_URL` environment variables in Render
  - Verify CORS settings allow your frontend domain

### Issue: Users can't log in after migration
- **Solution**:
  - Verify users table was migrated correctly
  - Check that passwords weren't corrupted during migration
  - Test with a known username/password from local database

## Notes

- The migration script uses SQL transactions where possible for data integrity
- All foreign key relationships are preserved
- User passwords are migrated as-is (already hashed)
- All timestamps are preserved from the original data
- Personal workspaces are automatically created for all users

## Support

If you encounter any issues during deployment, check:
1. Render build logs
2. Render runtime logs
3. Browser console for frontend errors
4. Network tab for API request/response errors
