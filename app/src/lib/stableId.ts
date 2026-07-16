type StableIdDiagnostics = {
  secureContext: boolean;
  cryptoAvailable: boolean;
  randomUUIDAvailable: boolean;
  getRandomValuesAvailable: boolean;
};

function getGlobalCrypto() {
  return globalThis.crypto;
}

function sanitizePrefix(prefix?: string) {
  const normalizedPrefix = prefix?.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  return normalizedPrefix || 'id';
}

function readPerformanceNow() {
  return typeof globalThis.performance?.now === 'function'
    ? Math.floor(globalThis.performance.now() * 1000).toString(36)
    : '0';
}

function readRandomSegment() {
  const cryptoProvider = getGlobalCrypto();

  if (typeof cryptoProvider?.getRandomValues === 'function') {
    const randomValues = new Uint32Array(2);
    cryptoProvider.getRandomValues(randomValues);
    return Array.from(randomValues, (value) => value.toString(36)).join('');
  }

  return Math.random().toString(36).slice(2);
}

export function getStableIdDiagnostics(): StableIdDiagnostics {
  const cryptoProvider = getGlobalCrypto();

  return {
    secureContext: Boolean(globalThis.isSecureContext),
    cryptoAvailable: Boolean(cryptoProvider),
    randomUUIDAvailable: typeof cryptoProvider?.randomUUID === 'function',
    getRandomValuesAvailable: typeof cryptoProvider?.getRandomValues === 'function',
  };
}

export function createStableId(prefix?: string) {
  const cryptoProvider = getGlobalCrypto();

  if (typeof cryptoProvider?.randomUUID === 'function') {
    const id = cryptoProvider.randomUUID();
    return prefix ? `${sanitizePrefix(prefix)}-${id}` : id;
  }

  const stablePrefix = sanitizePrefix(prefix);
  const createdAt = Date.now().toString(36);
  const performanceStamp = readPerformanceNow();
  const randomSegment = readRandomSegment();

  return `${stablePrefix}-${createdAt}-${performanceStamp}-${randomSegment}`;
}
