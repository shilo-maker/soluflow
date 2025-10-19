# SoluFlow Deployment Guide

This guide will walk you through deploying SoluFlow to Render.com (free tier).

## Prerequisites

1. A GitHub account with your SoluFlow repository
2. A Render account (sign up at https://render.com - free)
3. All changes committed and pushed to GitHub

## Deployment Steps

### Option 1: Deploy using render.yaml (Recommended)

This is the easiest method as the `render.yaml` file contains all the configuration.

1. **Go to Render Dashboard**
   - Visit https://dashboard.render.com
   - Log in or create a new account

2. **Create New Blueprint**
   - Click "New +" ’ "Blueprint"
   - Connect your GitHub repository
   - Select your `soluflow` repository
   - Render will automatically detect the `render.yaml` file

3. **Configure Environment Variables**

   After the services are created, you need to update these environment variables:

   **For `soluflow-api` (Backend):**
   - `CLIENT_URL`: Set to your frontend URL (e.g., `https://soluflow-frontend.onrender.com`)
   - `JWT_SECRET`: This will be auto-generated, but you can change it
   - Other variables are already configured in render.yaml

   **For `soluflow-frontend` (Frontend):**
   - `REACT_APP_API_URL`: Set to your backend URL + `/api` (e.g., `https://soluflow-api.onrender.com/api`)
   - `REACT_APP_SERVER_URL`: Set to your backend URL (e.g., `https://soluflow-api.onrender.com`)

4. **Deploy**
   - Click "Apply" to start the deployment
   - Render will:
     - Create a PostgreSQL database
     - Deploy the backend API
     - Deploy the frontend (static site)
   - Wait for all services to show "Live" status (this may take 5-10 minutes on free tier)

5. **Access Your App**
   - Your frontend will be available at: `https://soluflow-frontend.onrender.com`
   - Your backend API will be at: `https://soluflow-api.onrender.com`

### Option 2: Manual Deployment

If you prefer to set up each service manually:

#### 1. Deploy PostgreSQL Database

1. In Render Dashboard, click "New +" ’ "PostgreSQL"
2. Name: `soluflow-db`
3. Database: `soluflow`
4. Region: Oregon (free)
5. Plan: Free
6. Click "Create Database"
7. Wait for it to be created, then copy the **Internal Database URL**

#### 2. Deploy Backend (Node.js)

1. Click "New +" ’ "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name:** `soluflow-api`
   - **Region:** Oregon
   - **Branch:** main (or your default branch)
   - **Root Directory:** Leave empty
   - **Runtime:** Node
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Plan:** Free

4. Add Environment Variables:
   ```
   NODE_ENV=production
   DATABASE_URL=<paste the Internal Database URL from step 1>
   CLIENT_URL=<will set after frontend is deployed>
   JWT_SECRET=<generate a random secret key>
   JWT_EXPIRES_IN=1h
   JWT_REFRESH_EXPIRES_IN=7d
   ```

5. Click "Create Web Service"
6. Wait for deployment to complete
7. Copy the backend URL (e.g., `https://soluflow-api.onrender.com`)

#### 3. Deploy Frontend (React)

1. Click "New +" ’ "Static Site"
2. Connect your GitHub repository
3. Configure:
   - **Name:** `soluflow-frontend`
   - **Region:** Oregon
   - **Branch:** main
   - **Root Directory:** Leave empty
   - **Build Command:** `cd client && npm install && npm run build`
   - **Publish Directory:** `client/build`

4. Add Environment Variables:
   ```
   REACT_APP_API_URL=<your backend URL>/api
   REACT_APP_SERVER_URL=<your backend URL>
   ```
   Example:
   ```
   REACT_APP_API_URL=https://soluflow-api.onrender.com/api
   REACT_APP_SERVER_URL=https://soluflow-api.onrender.com
   ```

5. Click "Create Static Site"
6. Wait for deployment to complete

#### 4. Update Backend CLIENT_URL

1. Go back to your backend service (`soluflow-api`)
2. Go to "Environment" tab
3. Update the `CLIENT_URL` variable with your frontend URL
4. Click "Save Changes"
5. The backend will automatically redeploy

### 5. Verify Deployment

1. Visit your frontend URL
2. Try to register a new user
3. Log in and test the functionality
4. Check that real-time features work (leader/follower sync)

## Important Notes

### Free Tier Limitations

- **Backend:** Spins down after 15 minutes of inactivity (first request will be slow)
- **Database:** 256MB storage limit
- **Build time:** Limited to 3-5 minutes

### Troubleshooting

**Backend won't start:**
- Check logs in Render Dashboard
- Verify DATABASE_URL is correctly set
- Ensure all environment variables are set

**Frontend can't connect to backend:**
- Verify REACT_APP_API_URL is correct
- Check CORS settings in backend
- Make sure backend is running

**Database connection errors:**
- Verify DATABASE_URL is from the Internal Database URL
- Check that SSL is enabled in database config

**Real-time features not working:**
- Ensure REACT_APP_SERVER_URL matches your backend URL
- Check that WebSocket connections are allowed

### Auto-Deploy from GitHub

Render automatically deploys when you push to your main branch:

1. Make changes locally
2. Commit: `git add . && git commit -m "your message"`
3. Push: `git push`
4. Render will automatically build and deploy

### Custom Domain (Optional)

To use your own domain:

1. Go to your frontend service settings
2. Click "Custom Domain"
3. Follow instructions to add your domain
4. Update `CLIENT_URL` in backend to match your custom domain

## Security Recommendations

Before going to production:

1. **Change JWT_SECRET** to a strong random string
2. **Use environment variables** for all sensitive data
3. **Enable HTTPS** (Render does this automatically)
4. **Limit CORS** to only your frontend domain
5. **Set up proper database backups**

## Monitoring

- Check Render Dashboard for service health
- Monitor logs for errors
- Set up email notifications in Render settings

## Need Help?

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- Check logs in Dashboard for detailed error messages

---

**Congratulations!** Your SoluFlow app is now deployed and accessible to the world! <‰
