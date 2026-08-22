import { api_origin, getTelegramId, isInAigramNow } from './bridge';

const GUEST_TELEGRAM_ID = '__alteru_guest__';
const DEFAULT_POLL_MS = 250;
const DEFAULT_TIMEOUT_MS = 10_000;

export const IDENTITY_SYNC_RELEASE = 'alteru-identity-sync-20260822';

export interface WaitForAigramIdentityOptions {
  pollMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Wait for the live shell identity only when the launch context can become an
 * Aigram platform session. External visitors return immediately; a delayed
 * platform bridge gets a bounded polling window.
 */
export async function waitForAigramIdentity(
  options: WaitForAigramIdentityOptions = {},
): Promise<string | null> {
  document.documentElement.dataset.identitySync = IDENTITY_SYNC_RELEASE;

  const readIdentity = () => {
    const telegramId = getTelegramId();
    return isInAigramNow() && telegramId && telegramId !== GUEST_TELEGRAM_ID
      ? telegramId
      : null;
  };

  const immediate = readIdentity();
  if (immediate) return immediate;

  // A delayed bridge is expected only for an iframe launch carrying the
  // platform API origin. Do not hold up ordinary external visitors.
  if (!api_origin) return null;

  const pollMs = Math.max(50, options.pollMs ?? DEFAULT_POLL_MS);
  const deadline = Date.now() + Math.max(0, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  while (!options.signal?.aborted && Date.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, pollMs));
    const telegramId = readIdentity();
    if (telegramId) return telegramId;
  }

  return null;
}
