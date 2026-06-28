# Smart Agriculture Digital Twin — Production Deployment Guide

This guide provides step-by-step instructions to deploy the Smart Agriculture Digital Twin system to production using **MongoDB Atlas**, **Render** (for the Express API backend), and **Vercel** (for the React SPA frontend).

---

## 📂 Architecture Overview
The application is structured as a client-server app:
1. **Frontend:** React Single Page Application (built using Vite, compiled to HTML/JS/CSS).
2. **Backend:** Node.js Express server (`server.ts` compiled with `esbuild` to `dist/server.cjs`).
3. **Database:** MongoDB for telemetry records, crop diagnoses, predictions, and user authentication.

---

## 🛠️ Step 1: Set Up MongoDB Atlas
1. Sign in to your [MongoDB Atlas account](https://www.mongodb.com/cloud/atlas).
2. Click **Create** to build a new shared database cluster (select the free M0 tier).
3. Under **Security Quickstart**:
   - Create a database user (e.g. `db_user`) and set a strong password.
   - Add a Network Access entry:
     - Add `0.0.0.0/0` to allow access from Render's dynamic hosting IPs.
4. Go to the Database page, click **Connect**, select **Drivers**, and copy the **Connection String**:
   ```
   mongodb+srv://db_user:<password>@cluster0.mongodb.net/agri-twin?retryWrites=true&w=majority
   ```
   *Replace `<password>` with your database user password.*

---

## 🚀 Step 2: Deploy Backend to Render
1. Sign in to your [Render account](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your Git repository.
4. Configure the Web Service:
   - **Name:** `smart-agri-twin-backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Plan:** `Free` (or custom tier)
5. Under **Advanced / Environment Variables**, add:
   - `MONGODB_URI`: *Your MongoDB Atlas connection string from Step 1.*
   - `GEMINI_API_KEY`: *Your Google AI Studio Gemini API Key.*
   - `AI_PROVIDER`: `gemini` (enables live Gemini-3.5-flash analytics)
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
6. Click **Deploy Web Service** and wait for the service to build and deploy. Copy the deployed service URL (e.g. `https://smart-agri-twin-backend.onrender.com`).

---

## ⚡ Step 3: Deploy Frontend to Vercel
1. Sign in to your [Vercel account](https://vercel.com).
2. Click **Add New** and select **Project**.
3. Import your Git repository.
4. Configure build settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Click **Deploy**. Vercel will build and launch your frontend.
6. Copy your deployed frontend URL (e.g. `https://smart-agri-twin.vercel.app`).

### API Rewrite Configuration
To proxy `/api` requests correctly in production, create a `vercel.json` file in the root of your project:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://smart-agri-twin-backend.onrender.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 🔒 Step 4: Final Environment Variables Checklist

Ensure the following variables are configured on the Render backend environment:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas production connection string |
| `GEMINI_API_KEY` | Yes | Key for live agronomy AI recommendations |
| `AI_PROVIDER` | Yes | Set to `gemini` for live integration |
| `JWT_SECRET` | No (Auto) | Used to encrypt token handshakes |
| `APP_URL` | No | Frontend hostname URL |

---

## 🧪 Step 5: Post-Deployment Verification
1. Access the Vercel frontend URL.
2. Sign up or log in.
3. Perform a Soil Test and verify the health analysis returns.
4. Try typing a query in the Assistant Chat to check live response rendering.
5. In case of issues, verify the server logs on the Render Dashboard.
