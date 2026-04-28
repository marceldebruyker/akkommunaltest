// Minimal structured logger that redacts PII before writing to stdout/stderr.
// We intentionally don't ship a full logger framework — Vercel/CloudWatch ingest
// stdout JSON natively, and avoiding extra deps keeps the cold-start small.
//
// If we ever need OpenTelemetry/Sentry, swap the implementations of `log()`
// here; call-sites stay unchanged.

const PII_KEYS = new Set([
  'email', 'customerEmail', 'customer_email',
  'phone', 'phoneNumber', 'phone_number',
  'password', 'token', 'apiKey', 'api_key',
  'authorization', 'cookie',
  'leitwegId', 'leitweg_id'
]);

function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(k)) {
      out[k] = maskString(typeof v === 'string' ? v : String(v));
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

function maskString(s: string): string {
  if (!s) return s;
  // Email: "marcel@example.com" -> "ma***@example.com"
  if (s.includes('@')) {
    const [local, domain] = s.split('@');
    const visible = local.slice(0, 2);
    return `${visible}***@${domain ?? ''}`;
  }
  if (s.length <= 4) return '***';
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, message: string, context?: Record<string, unknown>) {
  const payload = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...(context ? (redact(context) as object) : {})
  };
  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
};
