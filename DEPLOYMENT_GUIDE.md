# SoluFlow Production Deployment Guide - Fresh Start

## Overview
Complete fresh deployment with data import from local database.

## Deployment Steps

### Step 1: Delete Old Production Database (In Render Dashboard)

1. Go to https://dashboard.render.com
2. Find your old `soluflow-db` database
3. Click on it → Settings → Delete Database
4. Confirm deletion

### Step 2: Create New Production Database

1. In Render dashboard, click "New +" → PostgreSQL
2. Configure:
   - **Name**: `soluflow-db`
   - **Database**: `soluflow`
   - **Region**: Oregon (same as your services)
   - **Plan**: Free
3. Click "Create Database"
4. Wait for it to provision (takes 1-2 minutes)

### Step 3: Update Backend Service Database Connection

1. Go to your `soluflow-api` service in Render
2. Go to Environment
3. Find the `DATABASE_URL` variable
4. Update it to connect to the new database:
   - Click "Add from Database"
   - Select your new `soluflow-db`
   - Choose "Internal Database URL"
5. Save changes

### Step 4: Deploy Backend (Tables Will Auto-Create)

The deployment should already be in progress from the git push. If not:

1. Go to `soluflow-api` service
2. Click "Manual Deploy" → "Deploy latest commit"
3. Watch the logs - Sequelize will automatically create all tables with the new schema
4. Wait for deployment to complete and show "Live"

### Step 5: Import Your Local Data

Once the backend is deployed and tables are created:

1. **Get your Production Database URL:**
   - In Render, go to your `soluflow-db` database
   - Copy the "External Database URL"

2. **Add it to your local `.env` file:**
   ```
   PRODUCTION_DATABASE_URL=your-external-database-url-here
   ```

3. **Run the import script:**
   ```bash
   cd server
   node simple-data-import.js
   ```

This will:
- ✅ Export all data from your local SQLite database
- ✅ Clear any existing production data
- ✅ Import all users with their passwords
- ✅ Create personal workspaces for each user
- ✅ Import all songs (assigned to creator's workspace)
- ✅ Import all services (assigned to creator's workspace)
- ✅ Import all service setlists
- ✅ Import all shared services
- ✅ Verify the data import

### Step 6: Deploy Frontend

The frontend should also be deploying automatically. Monitor:

1. Go to `soluflow-frontend` service in Render
2. Check deployment status
3. Wait for it to show "Live"

### Step 7: Verify Everything Works

1. **Test the backend:**
   - Visit: `https://your-api-url.onrender.com/api/health`
   - Should return: `{"status": "ok"}`

2. **Test the frontend:**
   - Visit your frontend URL
   - Login with existing credentials
   - Verify:
     - [x] Workspace switcher appears in header
     - [x] Your songs are visible in library
     - [x] Your services are visible
     - [x] Can create a team workspace
     - [x] Can generate invite links
     - [x] Song transposition persists when switching songs

## What Got Deployed

### Major Features
- ✅ Multi-workspace system (Personal & Team)
- ✅ Workspace roles (Admin, Planner, Leader, Member)
- ✅ Member management & invitations
- ✅ Persistent song transposition per service
- ✅ Enhanced visibility controls
- ✅ UI/UX improvements

### Database Schema
- **New tables**: `workspaces`, `workspace_members`, `workspace_invitations`, `song_workspaces`
- **Modified**: `songs`, `services` (now have `workspace_id`)
- **All data preserved** from local database

## Troubleshooting

### Import script fails
- **Check**: Database URL is correct in `.env`
- **Check**: Local `database.sqlite` file exists
- **Check**: Production tables were created (backend deployed successfully)

### Can't login after import
- **Solution**: Passwords are preserved during import. Use the same credentials as local.

### Workspace switcher doesn't appear
- **Check**: Frontend deployed successfully
- **Check**: User has at least one workspace (should have personal workspace)
- **Check**: Browser console for errors

### Songs/Services not visible
- **Check**: They were assigned to your workspace during import
- **Check**: You're viewing the correct workspace
- **Check**: Backend logs for any errors

## Important Notes

- 🔄 The deployment is **already in progress** from your git push
- 📊 All user passwords are preserved (already hashed)
- 🏢 Every user automatically gets a personal workspace
- 🎵 All songs are assigned to their creator's personal workspace
- 📅 All services are assigned to their creator's personal workspace

## Next Steps After Deployment

1. Test creating a team workspace
2. Invite another user to your team workspace
3. Test workspace-scoped songs and services
4. Verify transposition persistence works

---

**Your code is already deploying!** Just wait for it to finish, then run the import script.
