# Bus Tracking System

## Vercel Deployment Guide

This application consists of two parts:
1. Frontend: Static HTML/CSS/JS files in `ICB-Tracking-System-main`
2. Backend: Node.js Express API in `ICB-backend`

### Deployment Steps

1. Install Vercel CLI:
   ```
   npm install -g vercel
   ```

2. Login to Vercel:
   ```
   vercel login
   ```

3. Deploy the Backend:
   ```
   cd ICB-backend
   vercel
   ```
   - When prompted, choose to use settings from `vercel.json`
   - Note down the deployment URL (e.g., `https://icb-backend.vercel.app`)

4. Deploy the Frontend:
   ```
   cd ../ICB-Tracking-System-main
   vercel
   ```
   - When prompted, choose to use settings from `vercel.json`
   - Set the backend API URL as an environment variable if prompted

5. Connect the two deployments by setting the frontend base URL in the backend environment variables.

### Environment Variables

For the backend deployment, you'll need to set these environment variables in the Vercel dashboard:
- `MONGO_URI`: Your MongoDB connection string
- `PORT`: Will be automatically set by Vercel

### Notes

- Each part of the application should be deployed as a separate Vercel project
- Make sure your frontend code references the backend API using the deployed URL, not localhost
- You may need to update API URLs in your frontend code before deployment 