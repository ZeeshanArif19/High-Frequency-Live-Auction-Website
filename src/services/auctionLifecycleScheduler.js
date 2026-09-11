import { initializeAuctionLifecycle, processAuctionLifecycle } from './auctionLifecycleService.js';

const DEFAULT_INTERVAL_MS = 1000;

export async function startAuctionLifecycleScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  await initializeAuctionLifecycle();
  const timer = setInterval(() => {
    processAuctionLifecycle().catch((error) => {
      console.error('[Lifecycle] Transition processing failed:', error.message);
    });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
