# Jonathan Valdes — CV site

Static personal/CV website. Zero build step, zero runtime dependencies — plain HTML, CSS and JavaScript.

## Structure

```
index.html                  # single-page site
assets/styles.css           # design system + layout + print styles
assets/app.js               # theme toggle, scroll reveal, print button
assets/favicon.svg          # inline SVG favicon
staticwebapp.config.json    # Azure Static Web Apps: routes, security headers, CSP
.github/workflows/…         # CI/CD to Azure Static Web Apps
```

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
