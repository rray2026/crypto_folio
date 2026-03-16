# Deployment Guide

CryptoFolio is a pure client-side application. It can be hosted for free on platforms like **Cloudflare Pages**, **GitHub Pages**, or **Vercel**.

## 1. Recommended: Cloudflare Pages

### Option A: Manual Deployment (Wrangler CLI)
1. **Build the project**:
   ```bash
   npm run build
   ```
2. **Deploy via Wrangler**:
   ```bash
   npx wrangler pages deploy dist --project-name crypto-folio
   ```

### Option B: Automatic Deployment (GitHub Actions)
The project includes a `.github/workflows/deploy.yml` file. 
1. Add your `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to your GitHub Repository Secrets.
2. Every push to the `main` or `master` branch will trigger an automatic deployment.

## 2. Configuration (`wrangler.toml`)
The project uses a standard `wrangler.toml` for Cloudflare configuration. 
- **Compatibility Date**: 2024-05-02
- **Build Directory**: `dist`

## 3. Custom Domains
To bind a custom domain (e.g., `folio.yourdomain.com`):
1. Go to your Cloudflare Dashboard.
2. Navigate to **Workers & Pages** -> **crypto-folio**.
3. Select **Custom domains** and add your sub-domain. Cloudflare will handle SSL and DNS automatically.

## 4. SPA Routing
The application uses **React Router** in browser mode. Ensure your hosting provider is configured to redirect all 404s to `index.html`.
- For Cloudflare Pages, this is handled automatically for most SPA setups.
