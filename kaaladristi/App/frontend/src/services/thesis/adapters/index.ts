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
import { powerBuyAdapter } from './powerBuy';
import { smartMoneyAdapter } from './smartMoney';
import { quietAccumulationAdapter } from './quietAccumulation';
import { convictionFlowAdapter } from './convictionFlow';

SETUP_ADAPTERS['stage_2_leaders']    = stage2LeadersAdapter;
SETUP_ADAPTERS['breakout_surge']     = breakoutSurgeAdapter;
SETUP_ADAPTERS['power_buy']          = powerBuyAdapter;
SETUP_ADAPTERS['smart_money']        = smartMoneyAdapter;
SETUP_ADAPTERS['quiet_accumulation'] = quietAccumulationAdapter;
SETUP_ADAPTERS['conviction_flow']    = convictionFlowAdapter;

// Roll-out (docs/claude/scanner-story-page-poa.md · Roll-out plan):
// Wave 3 — power_sell, distribution_warning (need Holder/Exit lens
// headings supplied by the adapter instead of the hardcoded LT/Swing).

// The default export is here so callers can `import './adapters'` and be
// sure the registrations ran (module load = side-effect fill of the map).
export {};
