#!/usr/bin/env node
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
const OUTPUT_DIR = path.join(ROOT_DIR, 'public_html');
const CONFIG_PATH = path.join(ROOT_DIR, 'site.config.json');
const BRAND_CSS_PATH = path.join(ROOT_DIR, 'styles', 'brand.generated.css');

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
  {
    src: 'delete-my-data/submit.php',
    dest: 'delete-my-data/submit.php',
  },
  {
    src: '.htaccess',
    dest: '.htaccess',
  },
  {
    src: 'robots.txt',
    dest: 'robots.txt',
  },
  {
    src: 'sitemap.xml',
    dest: 'sitemap.xml',
  },
];

const STATIC_DIRECTORIES = ['assets', 'scripts', 'styles'];

main().catch((error) => {
  console.error(`[brand:apply] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const rawConfig = await loadJson(CONFIG_PATH);
  const validationErrors = validateConfig(rawConfig);
  if (validationErrors.length > 0) {
    const formatted = validationErrors.map((entry) => `- ${entry}`).join('\n');
    throw new Error(`Invalid site.config.json:\n${formatted}`);
  }

  const config = normalizeConfig(rawConfig);
  const today = new Date().toISOString().slice(0, 10);

  const globalTokens = buildGlobalTokens(config, today);
  const brandCss = buildBrandCss(config);

  await writeFile(BRAND_CSS_PATH, brandCss, 'utf8');

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const directory of STATIC_DIRECTORIES) {
    const sourceDir = path.join(ROOT_DIR, directory);
    const destinationDir = path.join(OUTPUT_DIR, directory);
    await cp(sourceDir, destinationDir, { recursive: true, force: true });
  }

  await mkdir(path.join(OUTPUT_DIR, '.data', 'rate-limit'), { recursive: true });
  await cp(path.join(ROOT_DIR, '.data', '.htaccess'), path.join(OUTPUT_DIR, '.data', '.htaccess'), {
    force: true,
  });

  for (const page of HTML_PAGE_DEFINITIONS) {
    const templatePath = path.join(ROOT_DIR, page.src);
    const outputPath = path.join(OUTPUT_DIR, page.dest);

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
    };

    const rendered = replacePlaceholders(template, pageTokens, page.src);
    await writeRenderedFile(outputPath, rendered);
  }

  for (const file of TEMPLATE_FILE_DEFINITIONS) {
    const templatePath = path.join(ROOT_DIR, file.src);
    const outputPath = path.join(OUTPUT_DIR, file.dest);
    const template = await readFile(templatePath, 'utf8');
    const rendered = replacePlaceholders(template, globalTokens, file.src);
    await writeRenderedFile(outputPath, rendered);
  }

  console.log('[brand:apply] Completed successfully.');
  console.log(`[brand:apply] Generated deployable output in ${path.relative(ROOT_DIR, OUTPUT_DIR)}`);
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
  assertString(config, 'theme.background', errors);
  assertString(config, 'theme.text', errors);
  assertString(config, 'theme.muted', errors);
  assertString(config, 'theme.border', errors);

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

  for (const themeField of ['theme.primary', 'theme.accent', 'theme.background', 'theme.text', 'theme.muted', 'theme.border']) {
    const value = getPath(config, themeField);
    if (typeof value === 'string' && !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
      errors.push(`${themeField} must be a 6-digit hex color (example: #0b3c97).`);
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

  for (const key of Object.keys(normalized.theme)) {
    normalized.theme[key] = normalized.theme[key].trim().toLowerCase();
  }

  normalized.copy = {
    homeStatus: 'Website Under Construction',
    homeHeadline: 'A polished new website is on the way.',
    homeSubtitle: 'We are updating our digital presence for faster access to services, support, and legal resources.',
    footerSummary: 'Official communication and legal pages remain available while this website is being updated.',
    privacyIntro: 'This Privacy Policy explains how we collect, use, and protect personal information.',
    deleteIntro: 'Use this page to request deletion of personal information, subject to legal and operational requirements.',
    siteDescription: '',
    deleteFormNote: 'This form is for privacy requests only. It is not an emergency response channel.',
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

  return normalized;
}

function buildGlobalTokens(config, today) {
  const privacyPolicyUrl = buildAbsoluteUrl(config.domain.baseUrl, config.urls.privacyPolicyPath);
  const deleteMyDataUrl = buildAbsoluteUrl(config.domain.baseUrl, config.urls.deleteMyDataPath);
  const supportPhoneUri = formatTelUri(config.contact.phone);

  return {
    BRAND_NAME: config.brand.name,
    TAGLINE: config.brand.tagline,
    LEGAL_NAME: config.brand.legalName,
    PRIMARY_HOST: config.domain.primaryHost,
    CANONICAL_HOST: config.domain.canonicalHost,
    CANONICAL_HOST_REGEX: escapeForRegex(config.domain.canonicalHost),
    BASE_URL: config.domain.baseUrl,

    CONTACT_EMAIL: config.emails.privacyTo,
    DELETE_REQUEST_EMAIL: config.emails.deleteRequestsTo,
    FROM_NO_REPLY_EMAIL: config.emails.fromNoReply,

    SUPPORT_PHONE: config.contact.phone,
    SUPPORT_PHONE_URI: supportPhoneUri,
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
    THEME_BACKGROUND: config.theme.background,
    THEME_TEXT: config.theme.text,
    THEME_MUTED: config.theme.muted,
    THEME_BORDER: config.theme.border,

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
  const primary = config.theme.primary;
  const accent = config.theme.accent;
  const background = config.theme.background;
  const text = config.theme.text;
  const muted = config.theme.muted;
  const border = config.theme.border;

  const primaryDeep = shiftHex(primary, -24);
  const primaryBright = shiftHex(primary, 14);
  const accentDeep = shiftHex(accent, -16);
  const pageSurfaceAlt = shiftHex(background, 6);
  const textOnDark = contrastColor(primary);
  const splashBackground = config.assets.splashBg ? `url("${config.assets.splashBg}")` : 'none';

  return `/* Auto-generated by tools/apply-branding.mjs. */\n:root {\n  --brand-blue: ${primary};\n  --brand-blue-deep: ${primaryDeep};\n  --brand-blue-bright: ${primaryBright};\n  --brand-yellow: ${accent};\n  --brand-yellow-deep: ${accentDeep};\n\n  --text-primary: ${text};\n  --text-secondary: ${muted};\n  --text-on-dark: ${textOnDark};\n\n  --bg-page: ${background};\n  --bg-surface: #ffffff;\n  --bg-surface-alt: ${pageSurfaceAlt};\n  --border: ${border};\n\n  --theme-primary: ${primary};\n  --theme-accent: ${accent};\n  --theme-background: ${background};\n  --theme-text: ${text};\n  --theme-muted: ${muted};\n  --theme-border: ${border};\n\n  --splash-bg-image: ${splashBackground};\n}\n`;
}

function buildAnalyticsScript(config) {
  if (!config.features.enableAnalytics) {
    return '';
  }

  const scriptUrl = config.analytics.scriptUrl.trim();
  const dataDomain = (config.analytics.dataDomain || config.domain.primaryHost).trim();

  return `<script defer src="${escapeHtml(scriptUrl)}" data-domain="${escapeHtml(dataDomain)}"></script>`;
}

function buildCspHeader(config) {
  const analyticsOrigin = config.features.enableAnalytics && config.analytics.scriptUrl
    ? new URL(config.analytics.scriptUrl).origin
    : '';

  const scriptSrc = [`'self'`];
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
    const uniqueUnresolved = [...new Set(unresolvedMatches)].join(', ');
    throw new Error(`Unresolved placeholders in ${contextLabel}: ${uniqueUnresolved}`);
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

  const prefixed = trimmed.startsWith('+') ? `+${trimmed.slice(1).replace(/\D/g, '')}` : trimmed.replace(/\D/g, '');
  return prefixed;
}

function shiftHex(hexColor, percent) {
  const amount = Math.round((255 * percent) / 100);
  const [r, g, b] = parseHex(hexColor);
  const next = [
    clamp(r + amount, 0, 255),
    clamp(g + amount, 0, 255),
    clamp(b + amount, 0, 255),
  ];

  return toHex(next[0], next[1], next[2]);
}

function parseHex(hexColor) {
  const normalized = hexColor.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function toHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function contrastColor(hexColor) {
  const [r, g, b] = parseHex(hexColor);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.56 ? '#111111' : '#f5f7ff';
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
