<?php
declare(strict_types=1);

/**
 * Delete-request endpoint template for xneelo shared hosting.
 * References: "Is PHP available with all web hosting packages?"
 * References: "Do you support SendMail on your servers?"
 */

const DELETE_REQUEST_TO = '{{DELETE_REQUEST_EMAIL}}';
const MAIL_FROM = '{{FROM_NO_REPLY_EMAIL}}';
const SITE_HOST = '{{PRIMARY_HOST}}';
const DELETE_FORM_ENABLED = {{DELETE_FORM_ENABLED_PHP_BOOL}};

const MIN_SUBMIT_SECONDS = 3;
const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_SECONDS = 300;

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

if (!DELETE_FORM_ENABLED) {
  respondJson(403, ['ok' => false, 'error' => 'Web form submissions are disabled. Please email the privacy team.']);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Allow: POST');
  respondJson(405, ['ok' => false, 'error' => 'Method not allowed.']);
}

$ip = getClientIp();
$rateLimit = checkRateLimit($ip);
if (!$rateLimit['ok']) {
  $status = (int) ($rateLimit['status'] ?? 429);
  if (isset($rateLimit['retry_after']) && $status === 429) {
    header('Retry-After: ' . (string) $rateLimit['retry_after']);
  }
  if ($status === 429) {
    respondJson(429, ['ok' => false, 'error' => 'Too many requests. Please try again later.']);
  }
  respondJson(503, ['ok' => false, 'error' => 'Unable to submit request right now. Please try again later.']);
}

$company = trim((string) ($_POST['company'] ?? ''));
if ($company !== '') {
  respondJson(400, ['ok' => false, 'error' => 'Unable to process request.']);
}

$submittedAt = (int) ($_POST['submitted_at'] ?? 0);
$now = time();
if ($submittedAt <= 0 || ($now - $submittedAt) < MIN_SUBMIT_SECONDS || ($now - $submittedAt) > 86400) {
  respondJson(400, ['ok' => false, 'error' => 'Please wait a few seconds and submit again.']);
}

$fullName = normalizeOneLine((string) ($_POST['full_name'] ?? ''));
$email = normalizeOneLine((string) ($_POST['email'] ?? ''));
$phone = normalizeOneLine((string) ($_POST['phone'] ?? ''));
$requestDetails = trim((string) ($_POST['request_details'] ?? ''));
$confirmation = (string) ($_POST['confirmation'] ?? '');

if (!isConfirmationChecked($confirmation)) {
  respondJson(400, ['ok' => false, 'error' => 'Please confirm the request before submitting.']);
}

if (!isValidLength($fullName, 2, 120)) {
  respondJson(400, ['ok' => false, 'error' => 'Please provide your full name.']);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !isValidLength($email, 5, 160)) {
  respondJson(400, ['ok' => false, 'error' => 'Please provide a valid email address.']);
}

if ($phone !== '' && !isValidLength($phone, 7, 40)) {
  respondJson(400, ['ok' => false, 'error' => 'Please provide a valid phone number or leave it empty.']);
}

if (!isValidLength($requestDetails, 20, 4000)) {
  respondJson(400, ['ok' => false, 'error' => 'Please provide enough detail for your request.']);
}

if (containsHeaderInjection($fullName) || containsHeaderInjection($email) || containsHeaderInjection($phone)) {
  respondJson(400, ['ok' => false, 'error' => 'Invalid request data.']);
}

$subjectName = preg_replace('/\s+/', ' ', $fullName) ?: 'Unknown';
$subject = 'Delete My Data Request - ' . $subjectName;

$userAgent = normalizeOneLine((string) ($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'));
$serverTime = gmdate('Y-m-d H:i:s') . ' UTC';

$bodyLines = [
  'Delete My Data request submitted from ' . SITE_HOST,
  '',
  'Timestamp: ' . $serverTime,
  'Requester name: ' . $fullName,
  'Requester email: ' . $email,
  'Requester phone: ' . ($phone !== '' ? $phone : 'Not provided'),
  'IP address: ' . $ip,
  'User agent: ' . $userAgent,
  '',
  'Request details:',
  $requestDetails,
  '',
  'End of request'
];

$body = implode("\n", $bodyLines);

$headers = [
  'From: ' . MAIL_FROM,
  'Reply-To: ' . $email,
  'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
  'Message-ID: <' . uniqid('delete-request-', true) . '@' . SITE_HOST . '>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8'
];

$mailParameters = '-f' . MAIL_FROM;
$sent = @mail(DELETE_REQUEST_TO, $subject, $body, implode("\r\n", $headers), $mailParameters);

if (!$sent) {
  $mailError = error_get_last();
  $errorMessage = is_array($mailError) && isset($mailError['message']) ? $mailError['message'] : 'unknown error';
  error_log('[delete-request] mail() failed for IP: ' . $ip . ' error: ' . $errorMessage);
  respondJson(500, ['ok' => false, 'error' => 'Unable to submit request right now. Please try again later.']);
}

respondJson(200, ['ok' => true]);

function respondJson(int $statusCode, array $payload): void
{
  http_response_code($statusCode);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function normalizeOneLine(string $value): string
{
  $clean = trim($value);
  $clean = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $clean);
  $clean = preg_replace('/\s+/u', ' ', $clean);
  return $clean ?? '';
}

function isValidLength(string $value, int $min, int $max): bool
{
  $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
  return $length >= $min && $length <= $max;
}

function isConfirmationChecked(string $value): bool
{
  return in_array(strtolower(trim($value)), ['1', 'true', 'on', 'yes'], true);
}

function containsHeaderInjection(string $value): bool
{
  return (bool) preg_match('/(?:\r|\n|%0a|%0d|content-type:|bcc:|cc:|to:)/i', $value);
}

function getClientIp(): string
{
  $candidates = [
    $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '',
    $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '',
    $_SERVER['REMOTE_ADDR'] ?? '',
  ];

  foreach ($candidates as $candidate) {
    if ($candidate === '') {
      continue;
    }

    $parts = explode(',', $candidate);
    foreach ($parts as $part) {
      $ip = trim($part);
      if (filter_var($ip, FILTER_VALIDATE_IP)) {
        return $ip;
      }
    }
  }

  return '0.0.0.0';
}

function checkRateLimit(string $ip): array
{
  $storageDir = resolveRateLimitDirectory();
  if ($storageDir === '') {
    error_log('[delete-request] rate-limit storage unavailable');
    return ['ok' => false, 'status' => 503];
  }

  $fileName = hash('sha256', $ip) . '.json';
  $filePath = $storageDir . DIRECTORY_SEPARATOR . $fileName;

  $fp = @fopen($filePath, 'c+');
  if ($fp === false) {
    error_log('[delete-request] unable to open rate-limit file: ' . $filePath);
    return ['ok' => false, 'status' => 503];
  }

  if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    error_log('[delete-request] unable to lock rate-limit file: ' . $filePath);
    return ['ok' => false, 'status' => 503];
  }

  $raw = stream_get_contents($fp);
  $record = json_decode($raw !== false ? $raw : '', true);
  if (!is_array($record) || !isset($record['attempts']) || !is_array($record['attempts'])) {
    $record = ['attempts' => []];
  }

  $now = time();
  $windowStart = $now - RATE_LIMIT_WINDOW_SECONDS;
  $attempts = [];
  foreach ($record['attempts'] as $attempt) {
    $attemptInt = (int) $attempt;
    if ($attemptInt >= $windowStart) {
      $attempts[] = $attemptInt;
    }
  }

  $isBlocked = count($attempts) >= MAX_REQUESTS_PER_WINDOW;
  if ($isBlocked) {
    sort($attempts);
    $retryAfter = max(1, ($attempts[0] + RATE_LIMIT_WINDOW_SECONDS) - $now);
    flock($fp, LOCK_UN);
    fclose($fp);
    return ['ok' => false, 'retry_after' => $retryAfter];
  }

  $attempts[] = $now;
  $record['attempts'] = $attempts;

  rewind($fp);
  ftruncate($fp, 0);
  fwrite($fp, json_encode($record));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);

  return ['ok' => true];
}

function resolveRateLimitDirectory(): string
{
  $preferred = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.data' . DIRECTORY_SEPARATOR . 'rate-limit';
  if (ensureDirectory($preferred)) {
    return $preferred;
  }

  $fallback = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'site-template-delete-request-rate-limit';
  if (ensureDirectory($fallback)) {
    return $fallback;
  }

  return '';
}

function ensureDirectory(string $path): bool
{
  if (is_dir($path)) {
    return is_writable($path);
  }

  return @mkdir($path, 0700, true) && is_writable($path);
}
