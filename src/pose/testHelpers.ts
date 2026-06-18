/**
 * Shared test utilities.
 *
 * describeIntegration: a describe block that is skipped in CI (where
 * process.env.RUN_INTEGRATION is not set) so the fast `npm test` CI build
 * never runs expensive estimator-on-real-log tests. Developers run the full
 * suite locally with `npm run test:full`.
 */
import { describe as vitestDescribe } from 'vitest';

const RUN_INTEGRATION =
  process.env.RUN_INTEGRATION === '1' || process.env.RUN_INTEGRATION === 'true';

/**
 * Wraps vitest's describe, skipping the block unless RUN_INTEGRATION=1.
 *
 * Usage:
 *   describeIntegration('my heavy test', () => { ... });
 */
export const describeIntegration = RUN_INTEGRATION
  ? vitestDescribe
  : vitestDescribe.skip;

/**
 * Conditionally runs the describe block ONLY if RUN_INTEGRATION=1.
 * Shortcut equivalent to describeIntegration.
 */
export function describeIfIntegration(name: string, fn: () => void): void {
  describeIntegration(name, fn);
}
