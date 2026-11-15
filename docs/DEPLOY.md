# Deployment and Hosting Guide

This document covers deployment, configuration, rollback procedures, environment variables, and fallback hosting plans for Ophiuchus.

---

## 1. How Deploys Happen

The Ophiuchus web app is a static single-page application built with Vite and React. It deploys automatically to **Azure Static Web Apps** via GitHub Actions.

### Deployment Pipeline
1. **Trigger:** Any push or merge to the `main` branch triggers the workflow defined in `.github/workflows/azure-static-web-apps.yml`. (Pull requests to `main` automatically deploy preview staging environments; closing a PR cleans up the preview environment).
2. **Runner & Node.js 24:** GitHub Actions provisions an `ubuntu-latest` runner and sets up **Node.js 24** using `actions/setup-node@v4` with npm package cache enabled.
3. **Quality Gates:** Before building, the pipeline executes the four verification scripts:
   - `npm --prefix app run lint` (ESLint with zero warnings allowed)
   - `npm --prefix app run typecheck` (Strict TypeScript checks)
   - `npm --prefix app run test` (Vitest test suite)
   - If **any** of these steps fail, the pipeline halts immediately, preventing broken code from deploying.
4. **Build:** The pipeline runs `npm --prefix app run build`, generating the production bundle into `app/dist/`.
5. **Upload & Deploy:** The official `Azure/static-web-apps-deploy@v1` action deploys the contents of `app/dist/` to Azure Static Web Apps using the repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.

### Hosting & Routing Configuration
The hosting configuration is defined in `app/public/staticwebapp.config.json`, which Vite copies to the root of `dist/` upon build:
- **SPA Deep Linking (`navigationFallback`):** Rewrites all page routes (e.g. `/nutrition`, `/medical-status`, `/emergency`, `/w`, `/dev/components`) to `/index.html` so client-side React Router handles reloads without returning HTTP 404. Excludes `/api/*`, `/assets/*`, and static image/font extensions.
- **Security Headers:** Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and strict referrer policy.
- **Cache Invalidation:** Configures `Cache-Control: no-cache, no-store, must-revalidate` for `index.html`, `sw.js`, `registerSW.js`, and `manifest.webmanifest`.
- **Static Assets Caching:** Configures immutable caching (`public, max-age=31536000, immutable`) for hashed files under `/assets/*`.

---

## 2. How to See a Failed Deploy

### In GitHub:
1. Navigate to your repository on GitHub: `https://github.com/aviadxyz/Ophiuchus`.
2. Click the **Actions** tab at the top.
3. In the left sidebar, click **Azure Static Web Apps CI/CD**.
4. Workflow runs are displayed in chronological order. A failed deploy is marked with a red circle with a white cross (`❌`).
5. Click on the failed run, then click on the **Build and Deploy Job**.
6. Expand the red-highlighted step (e.g., `Run lint`, `Run typecheck`, `Run tests`, or `Deploy to Azure Static Web Apps`) to view the exact error logs and stack trace.

### In Azure Portal:
1. Go to the [Azure Portal](https://portal.azure.com).
2. Search for and select your **Static Web Apps** resource.
3. Under the **Overview** blade, look at the **Deployment history** section.
4. Click on the commit hash or run status to jump directly to the relevant GitHub Actions execution log.

---

## 3. How to Roll Back

### Method A: Git Revert on `main` (Recommended)
Because the pipeline is fully automated and enforces all linters and tests, the cleanest and most dependable rollback is reverting the offending commit:
1. In your local repository:
   ```bash
   git checkout main
   git pull origin main
   git revert <commit-sha-to-undo>
   git push origin main
   ```
   *(Or on GitHub: navigate to the Pull Request or Commit, click **Revert**, and merge the resulting PR).*
2. The CI/CD workflow automatically builds, tests, and deploys the clean previous commit within minutes.

### Method B: Immediate GitHub Actions Re-run
If you need to instantly restore the last working state while diagnosing an issue:
1. Go to **Actions** -> **Azure Static Web Apps CI/CD**.
2. Click on the most recent **successful (green)** workflow run.
3. In the upper-right corner, click **Re-run all jobs**.
4. The runner will re-execute the build and redeploy the artifacts from that known good commit.

---

## 4. Environment Settings: `VITE_CHAT_URL` and `VITE_EVENTS_URL`

Per CONTRACTS section 11, the app checks two environment variables in `app/src/config.ts`:
- `VITE_CHAT_URL`: Custom base URL for the Med bot endpoint (`POST /api/chat`).
- `VITE_EVENTS_URL`: Custom base URL for watch/console relay messages (`POST /api/events` and `GET /api/events`).
- `VITE_SOCIAL_URL`: Crew network endpoint URL.

When one is left empty, that feature uses its offline fallback and calls no server (CONTRACTS section 11). The app does not guess a relative `/api/*` path.

### Where to Set Them:

#### For Client-Side Builds (GitHub Actions):
Vite requires `VITE_` variables to be present during `npm run build`:
1. In GitHub, go to **Settings** -> **Secrets and variables** -> **Actions**.
2. Click the **Variables** tab (or **Secrets** if sensitive).
3. Click **New repository variable**.
4. Add `VITE_CHAT_URL` and `VITE_EVENTS_URL` with your target host URLs (e.g., `https://your-app.azurestaticapps.net`).
5. In `.github/workflows/azure-static-web-apps.yml`, pass them into the `Build app` step:
   ```yaml
   - name: Build app
     run: npm --prefix app run build
     env:
       VITE_CHAT_URL: ${{ vars.VITE_CHAT_URL }}
       VITE_EVENTS_URL: ${{ vars.VITE_EVENTS_URL }}
   ```
   *(Note: When the API functions run under the same Azure Static Web App domain in Part B, set these to the relative paths `/api/chat` and `/api/events`. Left blank, the features stay on their offline fallbacks.)*

#### For Backend API / Function Secrets (Azure Portal - Part B):
Application secrets (such as model provider API keys) must **never** be prefixed with `VITE_` and never go into GitHub repo settings or browser bundles:
1. Go to Azure Portal -> your Static Web App resource.
2. In the left navigation menu, select **Configuration** (or **Environment variables** under Settings).
3. Under **Application settings**, click **+ Add**.
4. Enter the backend secret name (e.g. `MODEL_API_KEY`) and its value.
5. Click **Save**.

---

## 5. Cache Replacement & Offline PWA (Note for Lane 01)

To ensure that judges and crew members never see a stale cached version after a new deploy:

1. **HTTP Headers (`staticwebapp.config.json`):**
   - `/index.html`, `/sw.js`, `/registerSW.js`, and `/manifest.webmanifest` are served with `Cache-Control: no-cache, no-store, must-revalidate`.
   - Browsers and intermediate CDNs always revalidate navigation requests and service worker script updates.
2. **VitePWA Configuration (`app/vite.config.ts`):**
   - Configured with `registerType: 'autoUpdate'`, `skipWaiting: true`, `clientsClaim: true`, and `cleanupOutdatedCaches: true`.
   - When a new build deploys, Workbox detects the changed asset hashes, activates the new service worker immediately without waiting for open tabs to close, and removes superseded caches.
3. **Lane 01 Note:**
   - If lane 01 wants open browser tabs to automatically refresh as soon as a new version takes over (without the user needing to click a button or manually refresh), lane 01 can listen for the service worker controller change in `app/src/main.tsx`:
     ```ts
     if ('serviceWorker' in navigator) {
       navigator.serviceWorker.addEventListener('controllerchange', () => {
         window.location.reload()
       })
     }
     ```

---

## 6. Manual Setup Guide: Azure Portal & GitHub

Follow these steps once by hand to connect the GitHub repository to Azure Static Web Apps:

### Step 1: Create Static Web App in Azure Portal
1. Sign in to the [Azure Portal](https://portal.azure.com).
2. In the top search bar, search for **Static Web Apps** and click on it.
3. Click **+ Create** (or **Create static web app**).
4. Fill in the **Basics** tab:
   - **Subscription:** Select your subscription (e.g., Azure credit offer).
   - **Resource Group:** Click **Create new** and name it `rg-ophiuchus` (or select an existing one).
   - **Name:** Enter `ophiuchus-app`.
   - **Plan type:** Select **Free** (or Standard).
   - **Region:** Select `East US 2` or `West Europe` (whichever is closest).
   - **Source:** Select **Other** (to manage GitHub Actions through our pre-configured workflow and token, preventing Azure from overwriting our custom workflow).
5. Click **Review + create**, then click **Create**.
6. Wait for deployment to complete, then click **Go to resource**.

### Step 2: Retrieve Deployment Token
1. On your Static Web App resource overview page, look at the top toolbar.
2. Click **Manage deployment token**.
3. In the flyout panel, click the **Copy to clipboard** icon next to the deployment token.

### Step 3: Add Token to GitHub Secrets
1. In your browser, open the GitHub repository: `https://github.com/aviadxyz/Ophiuchus`.
2. Click on **Settings** (tab on the repository toolbar).
3. In the left sidebar, click **Secrets and variables**, then click **Actions**.
4. In the **Repository secrets** section, click **New repository secret**.
5. Set:
   - **Name:** `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - **Secret:** Paste the token copied from Step 2.
6. Click **Add secret**.

Deploys are now live and will trigger on every push to `main`!

---

## 7. Plan B: Moving to Another Static Host (Three Steps)

If Azure is unavailable, stalls, or account limits occur, follow this 3-step fallback using **Cloudflare Pages** (or Vercel):

### Step 1: Connect Git Repository
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) -> **Workers & Pages** -> click **Create application** -> **Pages** -> **Connect to Git**.
2. Select GitHub account and choose `aviadxyz/Ophiuchus`.

### Step 2: Configure Build Settings
1. Set the build parameters:
   - **Framework preset:** `Vite`
   - **Root directory:** `app`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
2. Under **Environment variables**, set:
   - `NODE_VERSION` = `24`
3. Click **Save and Deploy**.

### Step 3: SPA Fallback Routing
1. Add an SPA redirect rule so deep routes reload cleanly:
   Create `app/public/_redirects` containing:
   ```
   /*    /index.html   200
   ```
   *(Cloudflare Pages automatically serves `index.html` for client-side routes with 200 HTTP status).*
2. Verify by opening `/nutrition` directly in the browser and refreshing the page.
