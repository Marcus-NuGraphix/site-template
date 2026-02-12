# Nu Graphix Site Template (xneelo-ready)

Nu Graphix default product template for temporary launch pages and compliance URLs.

- Stack: static `HTML/CSS/JS` + optional `PHP` delete-request endpoint
- Hosting target: xneelo shared hosting (`public_html`)
- Single source of truth: root `site.config.json`
- Local assets only: no required external CDN assets

## Nu Graphix Default Brand

Out of the box this template ships as a Nu Graphix product:

- Brand: `Nu Graphix`
- Legal descriptor: `Nu Graphix (South Africa)`
- Tagline: `Modern web templates & compliance-ready site starters.`
- Palette and semantic tokens are generated from the Nu Graphix brand system.

## Quick Start

1. Edit `site.config.json`.
2. Update assets referenced by config (`logo`, `logoWhite`, `icon`, `favicon`, `ogImage`, `splashBg`).
3. Run:

```bash
npm run brand:apply
```

4. Upload generated `public_html/` contents to xneelo `public_html/`.

## Local Development (Docker)

This repo supports a local Docker environment for previewing the generated `public_html/` output with Apache + PHP.

One-time setup:

```bash
npm run dev:setup
```

Before `dev:up`, ensure Docker Desktop (or Docker Engine) is running.

Run locally:

```bash
npm run dev:up
```

Stop:

```bash
npm run dev:down
```

Logs:

```bash
npm run dev:logs
```

Open `http://localhost:8080`.

Local dev files are intentionally git-ignored:

- `docker-compose.local.yml`
- `Dockerfile.local`
- `.docker-local/`

## Branding Workflow

`tools/apply-branding.mjs`:

- validates config and fails with clear messages
- generates `styles/brand.generated.css` with semantic light/dark brand tokens
- replaces placeholders in HTML, `robots.txt`, `sitemap.xml`, `.htaccess`, and `submit.php`
- updates SEO/OG metadata and canonical URLs from config

### Scripts

```bash
npm run brand:apply
npm run client:new -- <clientSlug> <clientName> <domain>
npm run dev:setup
npm run dev:up
npm run dev:down
npm run lint:js
```

## New Client Bootstrap

Create a new client config scaffold:

```bash
npm run client:new -- acme "Acme Security" acme.co.za
```

This generates:

- `clients/acme/site.config.json`
- `clients/acme/assets/.gitkeep`

Build using that client config:

```bash
npm run brand:apply -- --config clients/acme/site.config.json
```

## Theme Tokens and Dark Mode

Generated CSS exposes semantic tokens including:

- `--color-primary`
- `--color-accent`
- `--color-destructive`
- `--color-bg`
- `--color-surface`
- `--color-sidebar`
- `--color-fg`
- `--color-muted`
- `--color-secondary`
- `--color-border`
- `--color-ring`

Derived tokens are also generated (`--color-primary-foreground`, `--color-accent-foreground`, etc.).

Theme behavior:

- default: system preference via `prefers-color-scheme`
- manual override: set `data-theme="light"` or `data-theme="dark"` on `<html>` (or `<body>`)

## App-Store Compliance URL Checklist

Ensure these URLs are public and correct before app listing submissions:

1. `/privacy-policy/`
2. `/delete-my-data/`

They are designed as stable, clean routes and are included in sitemap output.

## Noindex Toggle for Temporary Sites

`features.enableNoIndex` controls both:

- page robots meta (`noindex, nofollow` vs `index, follow`)
- generated `robots.txt` rules

Use `true` for temporary/private launches, and `false` when ready for indexing.

## xneelo Deployment Notes

1. Upload generated `public_html/` files to domain web root (`public_html/`).
2. Enable SSL for domain.
3. Keep generated `.htaccess` in place (HTTPS redirect + headers).
4. Configure mailbox forwarding (for example `delete@domain` and `hello@domain`).
5. Verify PHP + SendMail support for delete form endpoint.

xneelo help centre articles referenced by name:

- "How to set up mail forwarding via the xneelo Control Panel"
- "Force HTTPS using a .htaccess file via the xneelo Control Panel"
- "Is PHP available with all web hosting packages?"
- "Do you support SendMail on your servers?"

### Mail Forwarding Workflow (recommended)

- Form endpoint sends to `delete@domain` (or configured delete mailbox)
- xneelo mail forwarder routes that mailbox to operational external inboxes
- keeps a clean domain-specific compliance address while preserving existing team inbox tooling

## Quality Checklist

1. `npm run brand:apply` succeeds.
2. Mobile layout works at `320px` width.
3. Keyboard-only navigation works on all pages.
4. Screen reader basics present (labels, status regions, error summary focus).
5. Delete request failure/success flows verified.
6. Core status checks: `GET /`, `GET /privacy-policy/`, `GET /delete-my-data/` => `200`.
7. Endpoint checks: `POST /delete-my-data/submit.php` returns JSON with proper status code.
8. Cache policy verifies HTML/PHP not aggressively cached.
9. `enableNoIndex` behavior reflected in robots meta and `robots.txt`.
10. `/.data/.htaccess` blocks direct access to rate-limit storage.
