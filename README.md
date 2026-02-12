# White-Label Static Site Template (xneelo-ready)

Reusable static template for quick client rollout on xneelo shared hosting.

- Stack: static `HTML/CSS/JS` + optional `PHP` delete-request handler
- Deploy target: xneelo `public_html`
- Source of truth: `site.config.json`
- Asset strategy: local assets only (no required external CDN dependencies)

## Why `site.config.json` (Option A)

This template uses `site.config.json` as the single branding source because it is simple, framework-free, and easy for non-developers to edit without executing JavaScript.

## White-Label Workflow

1. Update `site.config.json`.
2. Replace assets under `assets/` (logos, icon, OG image, splash graphic).
3. Run:

```bash
npm run brand:apply
```

4. Deploy the generated `public_html/` output.

## What `brand:apply` Does

`tools/apply-branding.mjs` validates config and generates a deployable site in `public_html/`.

- Replaces placeholders in:
  - `index.html`
  - `privacy-policy/index.html`
  - `delete-my-data/index.html`
  - `delete-my-data/submit.php`
  - `.htaccess`
  - `robots.txt`
  - `sitemap.xml`
- Generates `styles/brand.generated.css` from `theme` values
- Copies static assets/scripts/styles into `public_html/`
- Applies SEO/robots and CSP behavior based on feature flags

## Placeholder Convention

Core tokens are standardized in page templates, including:

- `{{BRAND_NAME}}`, `{{TAGLINE}}`, `{{PRIMARY_HOST}}`, `{{CANONICAL_URL}}`
- `{{PRIVACY_POLICY_URL}}`, `{{DELETE_MY_DATA_URL}}`
- `{{CONTACT_EMAIL}}`, `{{DELETE_REQUEST_EMAIL}}`, `{{SUPPORT_PHONE}}`

## xneelo Deployment Steps

1. In local repo, run `npm run brand:apply`.
2. Upload all contents of `public_html/` into your domain's hosting `public_html/`.
3. Confirm SSL is enabled for the domain.
4. Keep generated `.htaccess` in place to force HTTPS.
5. Create mailbox forwarding for deletion/privacy requests:
   - create `delete@<domain>` and forward externally as needed
   - create `privacy@<domain>` if used
6. Verify PHP endpoint support for delete form.

xneelo help centre articles to reference:

- "Force HTTPS using a .htaccess file via the xneelo Control Panel"
- "How to set up mail forwarding via the xneelo Control Panel"
- "Do you support SendMail on your servers?"
- "Is PHP available with all web hosting packages?"

## Delete My Data Form Behavior

When `features.enableDeleteForm=true`:

- Form posts/fetches `POST /delete-my-data/submit.php`
- `submit.php` uses generated mailbox values from config
- `Reply-To` is set to the requester email
- Anti-spam controls:
  - honeypot field
  - minimum submit time
  - IP rate limit window
- Returns JSON responses with proper status codes

When `features.enableDeleteForm=false`:

- Page shows direct email submission instructions
- PHP endpoint returns a disabled response

Rate-limit storage path: `/.data/rate-limit/` (protected by `/.data/.htaccess`).

## Security and Hosting Hardening

Generated `.htaccess` includes:

- HTTPS redirect first in rewrite rules
- optional canonical host redirect (commented)
- legacy redirect compatibility (`.html` to folder routes)
- conservative caching for HTML/PHP and short cache for static assets
- security headers (when `mod_headers` is available)
- configurable CSP strict/relaxed via `features.enableCspStrict`

## Indexing and Sitemap Toggle

- `enableNoIndex=true`:
  - page `<meta name="robots" content="noindex, nofollow">`
  - `robots.txt` disallows all crawlers
- `enableNoIndex=false`:
  - page robots meta becomes `index, follow`
  - `robots.txt` allows crawling and includes sitemap link

## Optional Analytics

No environment variables are required for base operation.

If analytics is enabled (`features.enableAnalytics=true`), set:

- `analytics.scriptUrl`
- `analytics.dataDomain` (optional; defaults to primary host)

## Lightweight JS Lint

```bash
npm run lint:js
```

Runs syntax checks over `scripts/` and `tools/`.

## Testing Checklist

1. `npm run brand:apply` succeeds without validation errors.
2. Mobile layout remains usable down to `320px` width on all pages.
3. Keyboard-only navigation works for skip-link, menu, links, and form controls.
4. Screen reader basics are present:
   - labels associated with every input
   - `aria-live` updates for form status
   - error summary announced and focusable
5. Form failure and success flows are verified:
   - client-side validation errors
   - server-side failure message handling
   - success panel with request reference ID
6. HTTP status checks:
   - `GET /` returns `200`
   - `GET /privacy-policy/` returns `200`
   - `GET /delete-my-data/` returns `200`
   - `POST /delete-my-data/submit.php` returns JSON status (`200/4xx/5xx`)
7. Cache behavior:
   - HTML/PHP are not cached aggressively
   - static assets receive short-term cache headers
8. `public_html/robots.txt` and page robots meta match expected `enableNoIndex` mode.
9. `public_html/sitemap.xml` uses correct base URL and clean routes.
10. `public_html/.htaccess` contains HTTPS redirect and generated CSP mode.
11. `/.data/.htaccess` blocks direct web access to rate-limit storage.
