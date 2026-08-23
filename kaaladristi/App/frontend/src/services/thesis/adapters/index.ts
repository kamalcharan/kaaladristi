/**
 * Setup adapter registry.
 *
 * One line per preset. Adding a new scanner scans this file to decide
 * whether it has a Thesis view yet. Ordering here doesn't matter — the
 * registry is a plain object.
 *
 * See: docs/claude/scanner-story-page-poa.md
 */

import { SETUP_ADAPTERS } from '../setupAdapter';
import { stage2LeadersAdapter } from './stage2';
import { breakoutSurgeAdapter } from './breakoutSurge';

SETUP_ADAPTERS['stage_2_leaders'] = stage2LeadersAdapter;
SETUP_ADAPTERS['breakout_surge']  = breakoutSurgeAdapter;

// Roll-out waves (docs/claude/scanner-story-page-poa.md · Roll-out plan):
// Wave 2 — smart_money, quiet_accumulation, conviction_flow, power_buy
// Wave 3 — power_sell, distribution_warning (Holder/Exit lenses)

// The default export is here so callers can `import './adapters'` and be
// sure the registrations ran (module load = side-effect fill of the map).
export {};
