# Branding Quick Start

This repo is a white-label template driven by a single config file: `site.config.json`.

## 10-Minute Setup

1. Edit `site.config.json`.
2. Replace brand assets in `assets/` and keep root-absolute paths in config:
   - `assets.logo`
   - `assets.logoWhite`
   - `assets.icon`
   - `assets.favicon`
   - `assets.ogImage`
   - `assets.splashBg`
3. Run:

```bash
npm run brand:apply
```

4. Upload the contents of `public_html/` to your hosting `public_html/` directory.

## Required Config Groups

- `brand` - name, tagline, legal entity
- `domain` - hosts and base URL
- `emails` - privacy/delete/no-reply mailboxes
- `contact` - phone/address/hours
- `urls` - privacy and delete page paths
- `social` - social links
- `theme` - six core hex colors
- `assets` - logos/icons/OG/splash paths
- `features` - toggles (`enableDeleteForm`, `enableNoIndex`, `enableAnalytics`, `enableCspStrict`)

## What `brand:apply` Generates

- Branded HTML in `public_html/`
- `public_html/styles/brand.generated.css` from theme colors
- Branded `public_html/sitemap.xml`
- `public_html/robots.txt` with index/noindex mode
- Branded `public_html/.htaccess` with CSP strict/relaxed mode
- Branded `public_html/delete-my-data/submit.php`

## Feature Toggles

- `enableDeleteForm=true`: web form enabled (`/delete-my-data/submit.php`)
- `enableDeleteForm=false`: email-only deletion instructions shown
- `enableNoIndex=true`: `robots.txt` disallows indexing and pages emit `noindex`
- `enableNoIndex=false`: indexing allowed and sitemap line included in `robots.txt`
- `enableAnalytics=true`: injects analytics script tag from `analytics.scriptUrl`
- `enableCspStrict=true`: strict CSP header; set false for relaxed CSP

## Notes

- Keep paths root-absolute (for example `/assets/svg/logo.svg`).
- Form endpoint includes honeypot, min-submit-time, and IP rate limiting.
- Rate-limit data is stored in `/.data/rate-limit/` and protected by `/.data/.htaccess`.
