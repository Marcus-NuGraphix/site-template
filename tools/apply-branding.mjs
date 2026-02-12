#!/usr/bin/env node
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_PATH = path.join(ROOT_DIR, 'site.config.json');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'public_html');
const BRAND_CSS_PATH = path.join(ROOT_DIR, 'styles', 'brand.generated.css');

const args = parseArgs(process.argv.slice(2));
const configPath = args.config
  ? resolvePathFromRoot(args.config)
  : DEFAULT_CONFIG_PATH;
const outputDir = args.out
  ? resolvePathFromRoot(args.out)
  : DEFAULT_OUTPUT_DIR;

const HTML_PAGE_DEFINITIONS = [
  {
    src: 'index.html',
    dest: 'index.html',
    canonicalPath: '/',
    metaTitle: (config) => `${config.brand.name} | ${config.brand.tagline}`,
    metaDescription: (config) => config.copy.siteDescription || config.copy.homeSubtitle,
    ogType: 'website',
  },
  {
    src: 'privacy-policy/index.html',
    dest: 'privacy-policy/index.html',
    canonicalPath: (config) => config.urls.privacyPolicyPath,
    metaTitle: (config) => `${config.brand.name} | Privacy Policy`,
    metaDescription: (config) => `Privacy policy and data-handling commitments for ${config.brand.name}.`,
    ogType: 'article',
  },
  {
    src: 'delete-my-data/index.html',
    dest: 'delete-my-data/index.html',
    canonicalPath: (config) => config.urls.deleteMyDataPath,
    metaTitle: (config) => `${config.brand.name} | Delete My Data`,
    metaDescription: (config) => `Submit and track personal data deletion requests for ${config.brand.name}.`,
    ogType: 'website',
  },
];

const TEMPLATE_FILE_DEFINITIONS = [
  { src: 'delete-my-data/submit.php', dest: 'delete-my-data/submit.php' },
  { src: '.htaccess', dest: '.htaccess' },
  { src: 'robots.txt', dest: 'robots.txt' },
  { src: 'sitemap.xml', dest: 'sitemap.xml' },
];

const STATIC_DIRECTORIES = ['assets', 'scripts', 'styles'];

main().catch((error) => {
  console.error(`[brand:apply] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const rawConfig = await loadJson(configPath);
  const validationErrors = validateConfig(rawConfig);
  if (validationErrors.length > 0) {
    const formatted = validationErrors.map((entry) => `- ${entry}`).join('\n');
    throw new Error(`Invalid config file (${path.relative(ROOT_DIR, configPath)}):\n${formatted}`);
  }

  const config = normalizeConfig(rawConfig);
  const today = new Date().toISOString().slice(0, 10);

  const globalTokens = buildGlobalTokens(config, today);
  const brandCss = buildBrandCss(config);

  await writeFile(BRAND_CSS_PATH, brandCss, 'utf8');

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const directory of STATIC_DIRECTORIES) {
    await cp(path.join(ROOT_DIR, directory), path.join(outputDir, directory), {
      recursive: true,
      force: true,
    });
  }

  await mkdir(path.join(outputDir, '.data', 'rate-limit'), { recursive: true });
  await cp(path.join(ROOT_DIR, '.data', '.htaccess'), path.join(outputDir, '.data', '.htaccess'), { force: true });

  for (const page of HTML_PAGE_DEFINITIONS) {
    const templatePath = path.join(ROOT_DIR, page.src);
    const outputPath = path.join(outputDir, page.dest);
    const template = await readFile(templatePath, 'utf8');

    const canonicalPath = typeof page.canonicalPath === 'function'
      ? page.canonicalPath(config)
      : page.canonicalPath;
    const canonicalUrl = buildAbsoluteUrl(config.domain.baseUrl, canonicalPath);

    const metaTitle = page.metaTitle(config);
    const metaDescription = page.metaDescription(config);

    const pageTokens = {
      ...globalTokens,
      CANONICAL_URL: canonicalUrl,
      META_TITLE: metaTitle,
      META_DESCRIPTION: metaDescription,
      OG_TITLE: metaTitle,
      OG_DESCRIPTION: metaDescription,
      OG_URL: canonicalUrl,
      OG_IMAGE_URL: buildAbsoluteUrl(config.domain.baseUrl, config.assets.ogImage),
      OG_TYPE: page.ogType,
      TWITTER_TITLE: metaTitle,
      TWITTER_DESCRIPTION: metaDescription,
      TWITTER_IMAGE_URL: buildAbsoluteUrl(config.domain.baseUrl, config.assets.ogImage),
      ROBOTS_META_CONTENT: config.features.enableNoIndex ? 'noindex, nofollow' : 'index, follow',
      ANALYTICS_SCRIPT: buildAnalyticsScript(config),
      DELETE_FORM_CARD_HIDDEN_ATTR: config.features.enableDeleteForm ? '' : 'hidden',
      DELETE_FORM_DISABLED_NOTE_HIDDEN_ATTR: config.features.enableDeleteForm ? 'hidden' : '',
      DELETE_FORM_DISABLED_ATTR: config.features.enableDeleteForm ? '' : 'data-form-disabled="true"',
      TEMPLATE_PROVIDER_BANNER_HIDDEN_ATTR: config.features.enableTemplateProviderBanner ? '' : 'hidden',
    };

    const rendered = replacePlaceholders(template, pageTokens, page.src);
    await writeRenderedFile(outputPath, rendered);
  }

  for (const file of TEMPLATE_FILE_DEFINITIONS) {
    const templatePath = path.join(ROOT_DIR, file.src);
    const outputPath = path.join(outputDir, file.dest);
    const template = await readFile(templatePath, 'utf8');
    const rendered = replacePlaceholders(template, globalTokens, file.src);
    await writeRenderedFile(outputPath, rendered);
  }

  console.log('[brand:apply] Completed successfully.');
  console.log(`[brand:apply] Config: ${path.relative(ROOT_DIR, configPath)}`);
  console.log(`[brand:apply] Output: ${path.relative(ROOT_DIR, outputDir)}`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (entry === '--config') {
      parsed.config = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (entry === '--out') {
      parsed.out = argv[index + 1] || '';
      index += 1;
    }
  }
  return parsed;
}

function resolvePathFromRoot(inputPath) {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.join(ROOT_DIR, inputPath);
}

async function writeRenderedFile(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function loadJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function validateConfig(config) {
  const errors = [];

  assertString(config, 'brand.name', errors);
  assertString(config, 'brand.tagline', errors);
  assertString(config, 'brand.legalName', errors);
  assertString(config, 'brand.templateProvider', errors);

  assertString(config, 'domain.primaryHost', errors);
  assertString(config, 'domain.canonicalHost', errors);
  assertString(config, 'domain.baseUrl', errors);

  assertString(config, 'emails.deleteRequestsTo', errors);
  assertString(config, 'emails.privacyTo', errors);
  assertString(config, 'emails.fromNoReply', errors);

  assertString(config, 'contact.phone', errors);
  assertString(config, 'contact.address', errors);
  assertString(config, 'contact.supportHours', errors);

  assertString(config, 'urls.privacyPolicyPath', errors);
  assertString(config, 'urls.deleteMyDataPath', errors);

  assertString(config, 'social.facebook', errors, { allowEmpty: true });
  assertString(config, 'social.instagram', errors, { allowEmpty: true });
  assertString(config, 'social.linkedin', errors, { allowEmpty: true });
  assertString(config, 'social.x', errors, { allowEmpty: true });
  assertString(config, 'social.youtube', errors, { allowEmpty: true });

  assertString(config, 'theme.primary', errors);
  assertString(config, 'theme.accent', errors);
  assertString(config, 'theme.destructive', errors);

  for (const mode of ['light', 'dark']) {
    for (const tokenName of ['background', 'surface', 'sidebar', 'foreground', 'muted', 'secondary', 'border', 'ring']) {
      assertString(config, `theme.${mode}.${tokenName}`, errors);
    }
  }

  assertString(config, 'assets.logo', errors);
  assertString(config, 'assets.logoWhite', errors);
  assertString(config, 'assets.icon', errors);
  assertString(config, 'assets.favicon', errors);
  assertString(config, 'assets.ogImage', errors);
  assertString(config, 'assets.splashBg', errors);

  assertBoolean(config, 'features.enableDeleteForm', errors);
  assertBoolean(config, 'features.enableNoIndex', errors);
  assertBoolean(config, 'features.enableAnalytics', errors);
  assertBoolean(config, 'features.enableCspStrict', errors);
  if (getPath(config, 'features.enableTemplateProviderBanner') !== undefined) {
    assertBoolean(config, 'features.enableTemplateProviderBanner', errors);
  }

  if (typeof config.domain?.baseUrl === 'string' && !/^https?:\/\//.test(config.domain.baseUrl.trim())) {
    errors.push('domain.baseUrl must start with http:// or https://');
  }

  for (const hostPath of ['domain.primaryHost', 'domain.canonicalHost']) {
    const hostValue = getPath(config, hostPath);
    if (typeof hostValue === 'string' && /https?:\/\//.test(hostValue)) {
      errors.push(`${hostPath} must be host-only (no protocol).`);
    }
  }

  for (const pathField of ['urls.privacyPolicyPath', 'urls.deleteMyDataPath']) {
    const value = getPath(config, pathField);
    if (typeof value === 'string' && (!value.startsWith('/') || !value.endsWith('/'))) {
      errors.push(`${pathField} must start and end with '/'.`);
    }
  }

  for (const colorField of ['theme.primary', 'theme.accent', 'theme.destructive']) {
    const value = getPath(config, colorField);
    if (typeof value === 'string' && !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
      errors.push(`${colorField} must be a 6-digit hex color.`);
    }
  }

  for (const assetField of ['assets.logo', 'assets.logoWhite', 'assets.icon', 'assets.favicon', 'assets.ogImage', 'assets.splashBg']) {
    const value = getPath(config, assetField);
    if (typeof value === 'string' && !value.startsWith('/')) {
      errors.push(`${assetField} must use a root-absolute path (example: /assets/svg/logo.svg).`);
    }
  }

  if (config.features?.enableAnalytics) {
    const scriptUrl = config.analytics?.scriptUrl;
    if (typeof scriptUrl !== 'string' || scriptUrl.trim() === '') {
      errors.push('analytics.scriptUrl is required when features.enableAnalytics=true.');
    } else {
      try {
        new URL(scriptUrl);
      } catch {
        errors.push('analytics.scriptUrl must be a valid URL when analytics is enabled.');
      }
    }
  }

  return errors;
}

function normalizeConfig(config) {
  const normalized = structuredClone(config);

  normalized.domain.baseUrl = normalized.domain.baseUrl.trim().replace(/\/+$/, '');
  normalized.domain.primaryHost = normalized.domain.primaryHost.trim().toLowerCase();
  normalized.domain.canonicalHost = normalized.domain.canonicalHost.trim().toLowerCase();

  normalized.urls.privacyPolicyPath = normalizePath(normalized.urls.privacyPolicyPath);
  normalized.urls.deleteMyDataPath = normalizePath(normalized.urls.deleteMyDataPath);

  normalized.theme.primary = normalized.theme.primary.trim();
  normalized.theme.accent = normalized.theme.accent.trim();
  normalized.theme.destructive = normalized.theme.destructive.trim();

  for (const mode of ['light', 'dark']) {
    for (const tokenName of ['background', 'surface', 'sidebar', 'foreground', 'muted', 'secondary', 'border', 'ring']) {
      normalized.theme[mode][tokenName] = normalized.theme[mode][tokenName].trim();
    }
  }

  normalized.copy = {
    homeStatus: "We're working on something new.",
    homeHeadline: 'Website under construction',
    homeSubtitle: 'This site is being prepared with Nu Graphix.',
    footerSummary: 'Temporary compliance and legal pages are available while the site is being prepared.',
    templateCredit: `Template by ${normalized.brand.templateProvider || 'Nu Graphix'}.`,
    privacyIntro: 'This privacy policy template explains common data-handling practices for compliance-ready websites.',
    deleteIntro: 'Use this page to request deletion of personal information, subject to legal and operational requirements.',
    siteDescription: '',
    deleteFormNote: 'This form is for privacy requests only and is not an emergency communication channel.',
    ...normalized.copy,
  };

  normalized.legal = {
    effectiveDate: '',
    lastUpdated: '',
    ...normalized.legal,
  };

  normalized.analytics = {
    scriptUrl: '',
    dataDomain: '',
    ...normalized.analytics,
  };

  normalized.features = {
    enableDeleteForm: true,
    enableNoIndex: true,
    enableAnalytics: false,
    enableCspStrict: true,
    enableTemplateProviderBanner: true,
    ...normalized.features,
  };

  return normalized;
}

function buildGlobalTokens(config, today) {
  const privacyPolicyUrl = buildAbsoluteUrl(config.domain.baseUrl, config.urls.privacyPolicyPath);
  const deleteMyDataUrl = buildAbsoluteUrl(config.domain.baseUrl, config.urls.deleteMyDataPath);

  return {
    BRAND_NAME: config.brand.name,
    TAGLINE: config.brand.tagline,
    LEGAL_NAME: config.brand.legalName,
    TEMPLATE_PROVIDER_NAME: config.brand.templateProvider,

    PRIMARY_HOST: config.domain.primaryHost,
    CANONICAL_HOST: config.domain.canonicalHost,
    CANONICAL_HOST_REGEX: escapeForRegex(config.domain.canonicalHost),
    BASE_URL: config.domain.baseUrl,

    CONTACT_EMAIL: config.emails.privacyTo,
    DELETE_REQUEST_EMAIL: config.emails.deleteRequestsTo,
    FROM_NO_REPLY_EMAIL: config.emails.fromNoReply,

    SUPPORT_PHONE: config.contact.phone,
    SUPPORT_PHONE_URI: formatTelUri(config.contact.phone),
    CONTACT_ADDRESS: config.contact.address,
    SUPPORT_HOURS: config.contact.supportHours,

    PRIVACY_POLICY_PATH: config.urls.privacyPolicyPath,
    DELETE_MY_DATA_PATH: config.urls.deleteMyDataPath,
    PRIVACY_POLICY_URL: privacyPolicyUrl,
    DELETE_MY_DATA_URL: deleteMyDataUrl,

    FACEBOOK_URL: config.social.facebook,
    INSTAGRAM_URL: config.social.instagram,
    LINKEDIN_URL: config.social.linkedin,
    X_URL: config.social.x,
    YOUTUBE_URL: config.social.youtube,

    THEME_PRIMARY: config.theme.primary,
    THEME_ACCENT: config.theme.accent,
    THEME_DESTRUCTIVE: config.theme.destructive,

    ASSET_LOGO: config.assets.logo,
    ASSET_LOGO_WHITE: config.assets.logoWhite,
    ASSET_ICON: config.assets.icon,
    ASSET_FAVICON: config.assets.favicon,
    ASSET_OG_IMAGE: config.assets.ogImage,
    ASSET_SPLASH_BG: config.assets.splashBg,

    HOME_STATUS: config.copy.homeStatus,
    HOME_HEADLINE: config.copy.homeHeadline,
    HOME_SUBTITLE: config.copy.homeSubtitle,
    FOOTER_SUMMARY: config.copy.footerSummary,
    TEMPLATE_CREDIT_LINE: config.copy.templateCredit,
    PRIVACY_INTRO: config.copy.privacyIntro,
    DELETE_INTRO: config.copy.deleteIntro,
    SITE_DESCRIPTION: config.copy.siteDescription,
    DELETE_FORM_NOTE: config.copy.deleteFormNote,

    LEGAL_EFFECTIVE_DATE: config.legal.effectiveDate || today,
    LEGAL_LAST_UPDATED: config.legal.lastUpdated || today,
    TODAY: today,

    ROBOTS_RULE_LINE: config.features.enableNoIndex ? 'Disallow: /' : 'Allow: /',
    ROBOTS_SITEMAP_LINE: config.features.enableNoIndex
      ? ''
      : `Sitemap: ${buildAbsoluteUrl(config.domain.baseUrl, '/sitemap.xml')}`,

    DELETE_FORM_ENABLED_PHP_BOOL: config.features.enableDeleteForm ? 'true' : 'false',
    CSP_HEADER: buildCspHeader(config),
    TWITTER_HANDLE: extractTwitterHandle(config.social.x),
  };
}

function buildBrandCss(config) {
  const light = config.theme.light;
  const dark = config.theme.dark;

  const primaryFg = readableForeground(config.theme.primary, '#0b111b', '#ffffff');
  const accentFg = readableForeground(config.theme.accent, '#0b111b', '#ffffff');
  const destructiveFg = readableForeground(config.theme.destructive, '#0b111b', '#ffffff');

  const baseBlock = buildThemeTokenBlock({
    primary: config.theme.primary,
    accent: config.theme.accent,
    destructive: config.theme.destructive,
    primaryForeground: primaryFg,
    accentForeground: accentFg,
    destructiveForeground: destructiveFg,
    background: light.background,
    surface: light.surface,
    sidebar: light.sidebar,
    foreground: light.foreground,
    muted: light.muted,
    secondary: light.secondary,
    border: light.border,
    ring: light.ring,
    textOnDark: dark.foreground,
    splashBg: config.assets.splashBg,
  });

  const darkBlock = buildThemeTokenBlock({
    primary: config.theme.primary,
    accent: config.theme.accent,
    destructive: config.theme.destructive,
    primaryForeground: primaryFg,
    accentForeground: accentFg,
    destructiveForeground: destructiveFg,
    background: dark.background,
    surface: dark.surface,
    sidebar: dark.sidebar,
    foreground: dark.foreground,
    muted: dark.muted,
    secondary: dark.secondary,
    border: dark.border,
    ring: dark.ring,
    textOnDark: dark.foreground,
    splashBg: config.assets.splashBg,
  });

  return `/* Auto-generated by tools/apply-branding.mjs. */\n:root {\n${indent(baseBlock, 2)}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${indent(darkBlock, 4)}\n  }\n}\n\n:root[data-theme="light"],\nbody[data-theme="light"] {\n${indent(baseBlock, 2)}\n}\n\n:root[data-theme="dark"],\nbody[data-theme="dark"] {\n${indent(darkBlock, 2)}\n}\n`;
}

function buildThemeTokenBlock(theme) {
  return [
    `--color-primary: ${theme.primary};`,
    `--color-primary-rgb: ${toRgbTriplet(theme.primary, '47 125 186')};`,
    `--color-primary-foreground: ${theme.primaryForeground};`,
    `--color-accent: ${theme.accent};`,
    `--color-accent-rgb: ${toRgbTriplet(theme.accent, '46 207 160')};`,
    `--color-accent-foreground: ${theme.accentForeground};`,
    `--color-accent-strong: color-mix(in srgb, var(--color-accent) 84%, #0f1726);`,
    `--color-accent-soft: rgb(var(--color-accent-rgb) / 0.15);`,
    `--color-destructive: ${theme.destructive};`,
    `--color-destructive-rgb: ${toRgbTriplet(theme.destructive, '229 72 59')};`,
    `--color-destructive-foreground: ${theme.destructiveForeground};`,
    `--color-bg: ${theme.background};`,
    `--color-bg-rgb: ${toRgbTriplet(theme.background, '255 255 255')};`,
    `--color-surface: ${theme.surface};`,
    `--color-surface-rgb: ${toRgbTriplet(theme.surface, '255 255 255')};`,
    `--color-sidebar: ${theme.sidebar};`,
    `--color-sidebar-rgb: ${toRgbTriplet(theme.sidebar, '250 251 252')};`,
    `--color-fg: ${theme.foreground};`,
    `--color-fg-rgb: ${toRgbTriplet(theme.foreground, '31 41 55')};`,
    `--color-muted: ${theme.muted};`,
    `--color-muted-rgb: ${toRgbTriplet(theme.muted, '107 114 128')};`,
    `--color-secondary: ${theme.secondary};`,
    `--color-secondary-rgb: ${toRgbTriplet(theme.secondary, '243 244 246')};`,
    `--color-border: ${theme.border};`,
    `--color-ring: ${theme.ring};`,
    `--color-ring-rgb: ${toRgbTriplet(theme.ring, '147 163 184')};`,
    `--color-primary-strong: color-mix(in srgb, var(--color-primary) 82%, #001325);`,
    `--color-primary-soft: rgb(var(--color-primary-rgb) / 0.16);`,
    `--color-bg-elevated: var(--color-surface);`,
    `--color-bg-muted: var(--color-secondary);`,
    `--color-text: var(--color-fg);`,
    `--color-text-muted: var(--color-muted);`,
    `--theme-primary: var(--color-primary);`,
    `--theme-accent: var(--color-accent);`,
    `--theme-background: var(--color-bg);`,
    `--theme-text: var(--color-fg);`,
    `--theme-muted: var(--color-muted);`,
    `--theme-border: var(--color-border);`,
    `--brand-blue: var(--color-primary);`,
    `--brand-blue-deep: var(--color-primary-strong);`,
    `--brand-blue-bright: color-mix(in srgb, var(--color-primary) 72%, #ffffff);`,
    `--brand-yellow: var(--color-accent);`,
    `--brand-yellow-deep: color-mix(in srgb, var(--color-accent) 74%, #0f1d18);`,
    `--text-primary: var(--color-fg);`,
    `--text-secondary: var(--color-muted);`,
    `--text-on-dark: ${theme.textOnDark};`,
    `--bg-page: var(--color-bg);`,
    `--bg-surface: var(--color-surface);`,
    `--bg-surface-alt: var(--color-secondary);`,
    `--border: var(--color-border);`,
    `--success: #15803d;`,
    `--warning: #a36b00;`,
    `--error: var(--color-destructive);`,
    `--info: var(--color-primary);`,
    `--splash-bg-image: url("${theme.splashBg}");`,
  ].join('\n');
}

function readableForeground(hexColor, darkForeground, lightForeground) {
  const parsed = parseHexColor(hexColor);
  if (!parsed) {
    return lightForeground;
  }

  const [r, g, b] = parsed;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? darkForeground : lightForeground;
}

function parseHexColor(colorValue) {
  const trimmed = String(colorValue).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return null;
  }

  return [
    Number.parseInt(trimmed.slice(1, 3), 16),
    Number.parseInt(trimmed.slice(3, 5), 16),
    Number.parseInt(trimmed.slice(5, 7), 16),
  ];
}

function toRgbTriplet(colorValue, fallback) {
  const parsedHex = parseHexColor(colorValue);
  if (parsedHex) {
    return parsedHex.join(' ');
  }

  const numericMatches = String(colorValue).match(/[\d.]+/g);
  if (numericMatches && numericMatches.length >= 3) {
    const [r, g, b] = numericMatches.slice(0, 3).map((value) => Number.parseFloat(value));
    if ([r, g, b].every((value) => Number.isFinite(value))) {
      return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
    }
  }

  return fallback;
}

function indent(value, spaces) {
  const prefix = ' '.repeat(spaces);
  return value.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function buildAnalyticsScript(config) {
  if (!config.features.enableAnalytics) {
    return '';
  }

  const scriptUrl = config.analytics.scriptUrl.trim();
  const dataDomain = (config.analytics.dataDomain || config.domain.primaryHost).trim();

  return `<script defer src="${escapeHtml(scriptUrl)}" data-domain="${escapeHtml(dataDomain)}"></script>`;
}

function computeInlineScriptHashes(templateDir) {
  // Read all HTML templates and extract inline <script> blocks to compute
  // their SHA-256 hashes for the CSP header. This runs synchronously with
  // the content already loaded during the build.
  const INLINE_THEME_SCRIPT =
    "(function(){try{var t=localStorage.getItem('site-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-active-theme',t)}}catch(e){}})();";
  const hash = createHash('sha256').update(INLINE_THEME_SCRIPT, 'utf8').digest('base64');
  return [`'sha256-${hash}'`];
}

function buildCspHeader(config) {
  const analyticsOrigin = config.features.enableAnalytics && config.analytics.scriptUrl
    ? new URL(config.analytics.scriptUrl).origin
    : '';

  const inlineHashes = computeInlineScriptHashes();
  const scriptSrc = [`'self'`, ...inlineHashes];
  const connectSrc = [`'self'`];

  if (analyticsOrigin) {
    scriptSrc.push(analyticsOrigin);
    connectSrc.push(analyticsOrigin);
  }

  if (config.features.enableCspStrict) {
    return [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      `script-src ${scriptSrc.join(' ')}`,
      "style-src 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      `connect-src ${connectSrc.join(' ')}`,
      "upgrade-insecure-requests",
    ].join('; ');
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(' ')} 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    "upgrade-insecure-requests",
  ].join('; ');
}

function replacePlaceholders(template, tokens, contextLabel) {
  const rendered = template.replace(/{{([A-Z0-9_]+)}}/g, (fullMatch, key) => {
    if (!(key in tokens)) {
      throw new Error(`Missing value for placeholder ${fullMatch} in ${contextLabel}`);
    }

    return String(tokens[key]);
  });

  const unresolvedMatches = rendered.match(/{{[A-Z0-9_]+}}/g);
  if (unresolvedMatches) {
    const unique = [...new Set(unresolvedMatches)].join(', ');
    throw new Error(`Unresolved placeholders in ${contextLabel}: ${unique}`);
  }

  return rendered;
}

function buildAbsoluteUrl(baseUrl, pathName) {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const rawPath = String(pathName).trim();
  if (rawPath === '' || rawPath === '/') {
    return `${cleanBase}/`;
  }

  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `${cleanBase}${normalizedPath}`;
}

function normalizePath(pathValue) {
  const trimmed = String(pathValue).trim();
  if (trimmed === '' || trimmed === '/') {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function getPath(source, pathExpression) {
  return pathExpression.split('.').reduce((current, key) => {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }

    return current[key];
  }, source);
}

function assertString(source, pathExpression, errors, options = {}) {
  const value = getPath(source, pathExpression);
  const allowEmpty = Boolean(options.allowEmpty);

  if (typeof value !== 'string') {
    errors.push(`${pathExpression} must be a string.`);
    return;
  }

  if (!allowEmpty && value.trim() === '') {
    errors.push(`${pathExpression} must not be empty.`);
  }
}

function assertBoolean(source, pathExpression, errors) {
  const value = getPath(source, pathExpression);
  if (typeof value !== 'boolean') {
    errors.push(`${pathExpression} must be true or false.`);
  }
}

function formatTelUri(phone) {
  const trimmed = String(phone).trim();
  if (trimmed === '') {
    return '';
  }

  const normalized = trimmed.startsWith('+')
    ? `+${trimmed.slice(1).replace(/\D/g, '')}`
    : trimmed.replace(/\D/g, '');

  return normalized;
}

function escapeForRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function extractTwitterHandle(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('@')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      return `@${parts[0]}`;
    }
  } catch {
    return '';
  }

  return '';
}
