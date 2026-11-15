# Jonathan Valdes — CV site

Static personal/CV website. Zero build step, zero runtime dependencies — plain HTML, CSS and JavaScript.

**Live:** https://jolly-sand-04e6b4510.3.azurestaticapps.net
**Repo:** https://github.com/ajvaldesg/cv-site (public)
**Hosting:** Azure Static Web Apps, Free tier (`jv-cv-site` · `rg-cv-site` · Central US), CI/CD via GitHub Actions on every push to `main`.

## Privacy

Email is public (as intended). Phone numbers are **not** in the HTML: each one ships base64-encoded in a `data-phone` attribute and is only turned into a `tel:` link when the visitor clicks *Show … phone*. Scrapers that look for `tel:` links or digit patterns find nothing. Phone buttons are hidden when printing to PDF.

## Structure

```
index.html                     # single-page CV
engineering/index.html         # "how this site is built" (architecture + ADRs)
assets/styles.css              # design system, layout, print styles
assets/app.js                  # theme, scroll reveal, print, live badges, contact form
assets/favicon.svg             # inline SVG favicon
api/                           # Azure Functions (Node 20, v4 model)
  package.json · host.json
  src/index.js                 # /api/health · /api/visits · /api/contact
infra/main.bicep               # Table Storage + Application Insights (+ tables)
staticwebapp.config.json       # routing, CSP, security headers, api runtime
.github/workflows/…            # build + deploy on push to main
```

## Architecture

```
Browser ──► Azure Static Web Apps (edge CDN, TLS, CSP)
              ├── "/" and "/engineering"  → static files
              └── "/api/*"                → managed Azure Functions (Node 20)
                                             ├── Azure Table Storage (counters, messages)
                                             └── Application Insights (requests, traces)
GitHub Actions ── build + deploy on push to main (frontend + API)
Bicep ─────────── storage account, tables and App Insights
```

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | liveness: runtime, region, uptime, integration flags |
| `/api/visits` | GET | increments + returns the visit counter |
| `/api/contact` | POST | validates and stores `{name, email, message}` |

All endpoints are same-origin and anonymous — no keys, no CORS preflight. The site
degrades gracefully: if the API or storage is unavailable, pages still render and the
badge says so.

## Infrastructure

`infra/main.bicep` creates the storage account (Standard_LRS, TLS 1.2, no public blob
access), the `counters` and `messages` tables, and the Application Insights component.
It never outputs secrets. Deploy:

```bash
az deployment group create -g rg-cv-site -n cv-site-infra -f infra/main.bicep
az staticwebapp appsettings set -n jv-cv-site -g rg-cv-site --setting-names \
  "STORAGE_CONNECTION_STRING=…" "APPLICATIONINSIGHTS_CONNECTION_STRING=…" "REGION_NAME=centralus"
```

The Static Web App itself (`jv-cv-site`, Free) is created once with
`az staticwebapp create`; everything after that is code.

## Monitoring

- Application Insights: every function invocation, latency and dependency call (30-day retention).
- Metric alert `alert-cv-site-5xx`: edge 5xx ratio > 5% over 15 min → email via action group `ag-cv-site`.
- On-page live badge: real `GET /api/health` timing plus the visit counter.
- **No standard web test on purpose:** billed at $0.00056/execution; a 4-region,
  5-minute ping test would cost ~$19/month. The metric alert costs $0.10/month and
  covers the same failure mode.

## Cost

| Resource | Monthly |
|---|---|
| Static Web Apps (Free) | $0.00 |
| Managed Functions (included with SWA) | $0.00 |
| Table Storage (LRS, < 1 MB) | < $0.01 |
| Application Insights (well under 5 GB free grant) | $0.00 |
| Metric alert rule (1) | $0.10 |
| **Total** | **≈ $0.10 / month** |

## Local development with the API

```bash
cd api && npm install && npm start   # requires Azure Functions Core Tools
# In another shell: npx @azure/static-web-apps-cli start . --api-location api
```

The counter/message writes need `STORAGE_CONNECTION_STRING` in `api/local.settings.json`
(git-ignored). Without it, `/api/health` still answers and `/api/contact` returns a clear
`storage_not_configured` error.

## Local preview

```bash
cd projects/cv-site
python3 -m http.server 8080
# http://localhost:8080
```

Or just open `index.html` in a browser.

## Features

- Responsive single page: hero, profile, 7 competency areas, 8-role timeline, credentials, contact.
- Light/dark theme, follows OS preference, remembers choice (`localStorage`).
- Print stylesheet: `Ctrl/Cmd + P` produces a clean, paginated PDF CV (nav and interactive chrome hidden).
- Accessibility: skip link, semantic landmarks, `aria` labels, respects `prefers-reduced-motion`.
- No frameworks, no trackers, no cookies. Only external request is Google Fonts (Inter/JetBrains Mono).

## Deploy — Azure Static Web Apps (Free tier)

Free plan includes: global CDN, free managed TLS certificate, custom domains, staging environments per pull request, and 100 GB bandwidth/month.

### Option A — GitHub Actions (recommended)

1. Create the Static Web App in Azure Portal → *Create a resource* → **Static Web App**
   - Plan type: **Free**
   - Source: **GitHub**, pick this repo, branch `main`
   - Build presets: **Custom** · App location `/` · Api location *(empty)* · Output location *(empty)*
2. Azure adds `AZURE_STATIC_WEB_APPS_API_TOKEN` to the repo secrets automatically.
   If you created the SWA without linking GitHub, copy the token manually:
   Azure Portal → Static Web App → *Manage deployment token* → repo → *Settings → Secrets → Actions*.
3. Push to `main`. The workflow in `.github/workflows/azure-static-web-apps.yml` builds and deploys.
   Every PR gets its own preview URL; closing the PR removes it.

### Option B — Azure CLI

```bash
az login
az group create --name rg-cv-site --location eastus2
az staticwebapp create \
  --name jv-cv-site \
  --resource-group rg-cv-site \
  --source . \
  --location eastus2 \
  --branch main \
  --app-location "/" \
  --login-with-github
```

### Option C — quick throwaway (no CI/CD)

```bash
az storage account create -n jvcvsite -g rg-cv-site -l eastus2 --sku Standard_LRS --kind StorageV2 --allow-blob-public-access true
az storage blob service-properties update --account-name jvcvsite --static-website --index-document index.html --404-document index.html
az storage blob upload-batch -d '$web' -s . --account-name jvcvsite --overwrite
```

> Option A is the one worth showing on a CV: SWA + GitHub Actions = managed platform, IaC-adjacent workflow, PR previews and automated rollout.

## Custom domain

Portal → Static Web App → *Custom domains* → *Add*. Create a `CNAME` to the generated `*.azurestaticapps.net` host.
TLS is provisioned and renewed automatically.

## Personal data note

The page publishes email and two phone numbers in plain text — they will be indexable and scrapeable.
Options if that becomes a problem:

- Keep only the email public and route phone requests through the email.
- Add `<meta name="robots" content="noindex">` (already not set — add it to keep the page private).
- Put the phone numbers behind a click (`mailto:`-style reveal) instead of plain text.

## TODO / ideas

- [ ] Optional: PDF download button pointing at a generated `cv.pdf`.
- [ ] Optional: `robots.txt` + `sitemap.xml`.
- [ ] Optional: custom domain (`jonathanvaldes.com`?).
- [ ] Optional: Spanish version at `/es/`.
