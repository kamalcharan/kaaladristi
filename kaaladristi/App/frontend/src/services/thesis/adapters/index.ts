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
import { powerSellAdapter } from './powerSell';
import { distributionWarningAdapter } from './distributionWarning';

SETUP_ADAPTERS['stage_2_leaders']      = stage2LeadersAdapter;
SETUP_ADAPTERS['breakout_surge']       = breakoutSurgeAdapter;
SETUP_ADAPTERS['power_buy']            = powerBuyAdapter;
SETUP_ADAPTERS['smart_money']          = smartMoneyAdapter;
SETUP_ADAPTERS['quiet_accumulation']   = quietAccumulationAdapter;
SETUP_ADAPTERS['conviction_flow']      = convictionFlowAdapter;
SETUP_ADAPTERS['power_sell']           = powerSellAdapter;
SETUP_ADAPTERS['distribution_warning'] = distributionWarningAdapter;

// All six matview presets + stage_2_leaders + breakout_surge covered.
// Not covered (by design for now): stage_2_watch (no preset row),
// flower_pot_burst (FPB has its own coil-phase UI — a Story View for it
// needs a compression-phase adapter, tracked in the POA).

// The default export is here so callers can `import './adapters'` and be
// sure the registrations ran (module load = side-effect fill of the map).
export {};
