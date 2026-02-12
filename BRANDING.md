# BRANDING Guide

This template uses one active source-of-truth config file at repo root: `site.config.json`.

Use it to control brand, domain, contact details, palette, assets, and feature toggles without manual HTML/CSS edits.

## Rebrand in Under 10 Minutes

1. Edit `site.config.json`.
2. Replace assets referenced in config:
   - `/assets/svg/logo.svg`
   - `/assets/svg/logo-white.svg`
   - `/assets/svg/icon.svg`
   - `/assets/favicon.ico`
   - `/assets/svg/under-construction-graphic.svg` (or your own path)
3. Run:

```bash
npm run brand:apply
```

4. Upload generated `public_html/` to xneelo `public_html/`.

## Create a New Client Config Fast

```bash
npm run client:new -- <clientSlug> "<Client Name>" <domain>
```

Example:

```bash
npm run client:new -- acme "Acme Security" acme.co.za
```

This creates:

- `clients/acme/site.config.json`
- `clients/acme/assets/.gitkeep`

Then build directly from that config:

```bash
npm run brand:apply -- --config clients/acme/site.config.json
```

## What `brand:apply` Updates

- Branded pages:
  - `index.html`
  - `privacy-policy/index.html`
  - `delete-my-data/index.html`
- Host/config files:
  - `.htaccess`
  - `robots.txt`
  - `sitemap.xml`
  - `delete-my-data/submit.php`
- Generated CSS:
  - `styles/brand.generated.css`

## Config Sections

- `brand`: names/tagline/template provider label
- `domain`: hosts and canonical base URL
- `emails`: privacy/delete/no-reply mailboxes
- `contact`: phone/address/hours
- `urls`: clean route paths
- `social`: social profile URLs
- `theme`: Nu Graphix semantic color model (primary/accent/destructive + light/dark sets)
- `assets`: logo/icon/favicon/OG/splash paths
- `features`: behavior toggles
- `copy`: UI microcopy strings
- `legal`: effective and updated dates
- `analytics`: optional analytics script settings

## Key Placeholder Tokens

Common placeholders used across templates:

- `{{BRAND_NAME}}`, `{{LEGAL_NAME}}`, `{{TAGLINE}}`
- `{{TEMPLATE_PROVIDER_NAME}}`, `{{TEMPLATE_CREDIT_LINE}}`
- `{{PRIMARY_HOST}}`, `{{BASE_URL}}`, `{{CANONICAL_URL}}`
- `{{PRIVACY_POLICY_PATH}}`, `{{DELETE_MY_DATA_PATH}}`
- `{{PRIVACY_POLICY_URL}}`, `{{DELETE_MY_DATA_URL}}`
- `{{CONTACT_EMAIL}}`, `{{DELETE_REQUEST_EMAIL}}`, `{{FROM_NO_REPLY_EMAIL}}`
- `{{SUPPORT_PHONE}}`, `{{SUPPORT_PHONE_URI}}`, `{{CONTACT_ADDRESS}}`, `{{SUPPORT_HOURS}}`
- `{{THEME_PRIMARY}}`, `{{THEME_ACCENT}}`, `{{THEME_DESTRUCTIVE}}`
- `{{ASSET_LOGO}}`, `{{ASSET_LOGO_WHITE}}`, `{{ASSET_ICON}}`, `{{ASSET_FAVICON}}`, `{{ASSET_OG_IMAGE}}`, `{{ASSET_SPLASH_BG}}`

Feature-driven placeholders:

- `{{DELETE_FORM_CARD_HIDDEN_ATTR}}`
- `{{DELETE_FORM_DISABLED_NOTE_HIDDEN_ATTR}}`
- `{{DELETE_FORM_DISABLED_ATTR}}`
- `{{TEMPLATE_PROVIDER_BANNER_HIDDEN_ATTR}}`

## Theme Override

By default, generated CSS follows `prefers-color-scheme`.

Manual override options:

- `<html data-theme="light">`
- `<html data-theme="dark">`

(also supported on `<body>`)

## Notes

- Keep all paths root-absolute in config.
- Keep `.htaccess` and `/.data/.htaccess` in deployment output.
- Delete-form endpoint uses anti-spam controls and returns JSON status codes.
