export const logger = {
  info: (message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] ${timestamp} - ${message}`, meta ? JSON.stringify(sanitizeMeta(meta)) : '');
  },
  warn: (message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    console.warn(`[WARN] ${timestamp} - ${message}`, meta ? JSON.stringify(sanitizeMeta(meta)) : '');
  },
  error: (message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] ${timestamp} - ${message}`, meta ? JSON.stringify(sanitizeMeta(meta)) : '');
  },
  debug: (message: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = new Date().toISOString();
      console.debug(`[DEBUG] ${timestamp} - ${message}`, meta ? JSON.stringify(sanitizeMeta(meta)) : '');
    }
  }
};

function sanitizeMeta(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...(obj as Record<string, unknown>) };
  const sensitiveKeys = ['apiKey', 'key', 'password', 'secret', 'authorization', 'token', 'OPENAI_API_KEY'];
  
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      clone[key] = '***REDACTED***';
    } else if (typeof clone[key] === 'object') {
      clone[key] = sanitizeMeta(clone[key]);
    }
  }
  return clone;
}
