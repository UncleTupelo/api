# GPU Datacenter Economics Dashboard

A single-page, static dashboard for GPU specs, cloud pricing, and LLM training/inference unit economics. It is designed to live on GitHub Pages/Netlify (e.g., `joef-agent26.xyz`) and pull data from GitHub, Notion, or any HTTPS JSON feed so you never have to edit the HTML to refresh numbers.

## Quick start

1. Open `dashboard/index.html` in a browser or deploy the `dashboard/` folder to any static host.
2. By default the page loads `./data.json` (checked into this repo). Override the data source with a query string:
   - GitHub raw JSON: `?dataUrl=https://raw.githubusercontent.com/<org>/<repo>/main/dashboard/data.json`
   - Notion (via your proxy): `?dataUrl=https://your-notion-proxy.example.com/gpu-dashboard`
3. Adjust auto-refresh: `?refreshMinutes=15` (defaults to 30, minimum 5).
4. Click **Refresh data** in the hero to force a fetch without reloading the page.

## Data contract

The JSON must expose the following keys (see `data.json` for a reference):

- `metadata.updatedAt` (ISO date or label)
- `gpuSpecifications[]` with `architecture`, `launchYear`, `fp16Tflops`, `fp8Tflops`, `memoryGb`, `memoryBandwidthTbs`, `tdpWatts`, `purchasePriceLow`, `purchasePriceHigh`, `cloudRentalLow`, `cloudRentalHigh`, `tokensPerSec`
- `cloudPricing[]` with `provider`, `gpuType`, `pricePerGpuHour`, `config`, `availability`
- `trainingCosts[]`, `inferencePerformance[]`, `marketForecast[]` (see schema in `data.json`)

## Keeping the data fresh

- **GitHub integration:** Store the live JSON in your repo and point `dataUrl` at the raw file. Use a GitHub Action to regenerate the JSON nightly from your research sources.
- **Notion integration:** Notion's API requires a secret and is not CORS-friendly. Deploy a tiny serverless proxy (e.g., on Cloudflare Workers/Vercel Functions) that converts your Notion database into the JSON contract above, then supply that proxy URL via `dataUrl`.
- **Continuous updates:** The page auto-refreshes its data fetch every `refreshMinutes`. All charts/tables rerender without a full reload.

## Deployment notes

- Static assets only—no build step needed. Upload the `dashboard/` folder or enable GitHub Pages on `/dashboard`.
- To bind to `joef-agent26.xyz`, point DNS at your host (e.g., `cname joef-agent26.github.io`), then add the custom domain in your host settings.
- Add CSP rules if you serve from your own domain: allow CDN for `cdn.jsdelivr.net` (Chart.js) and your chosen `dataUrl` origin.

## What changed recently

- UI refreshed with a darker, high-contrast layout and clearer section headers.
- Swappable data source so the page can live anywhere while data lives in GitHub/Notion.
- Auto-refresh loop and single-click refresh to keep pricing/spec changes flowing without redeploying.
