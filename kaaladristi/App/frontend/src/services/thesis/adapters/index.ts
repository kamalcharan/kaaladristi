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
import { stage2WatchAdapter } from './stage2Watch';
import { volumeDriveAdapter } from './volumeDrive';
import { stage3WatchAdapter, stage4LeadersAdapter, vaniExitWatchAdapter } from './stageWeakness';
import { flowerPotBurstAdapter } from './flowerPot';
import { wakingGiantsAdapter, wgAscentAdapter, wgStirringAdapter } from './wakingGiants';
import { weeklyMoversAdapter } from './weeklyMovers';
import { monthlyMoversAdapter } from './monthlyMovers';

SETUP_ADAPTERS['stage_2_leaders']      = stage2LeadersAdapter;
SETUP_ADAPTERS['breakout_surge']       = breakoutSurgeAdapter;
SETUP_ADAPTERS['power_buy']            = powerBuyAdapter;
SETUP_ADAPTERS['smart_money']          = smartMoneyAdapter;
SETUP_ADAPTERS['quiet_accumulation']   = quietAccumulationAdapter;
SETUP_ADAPTERS['conviction_flow']      = convictionFlowAdapter;
SETUP_ADAPTERS['power_sell']           = powerSellAdapter;
SETUP_ADAPTERS['distribution_warning'] = distributionWarningAdapter;
SETUP_ADAPTERS['stage_2_watch']        = stage2WatchAdapter;
SETUP_ADAPTERS['volume_drive']         = volumeDriveAdapter;
SETUP_ADAPTERS['stage_3_watch']        = stage3WatchAdapter;
SETUP_ADAPTERS['stage_4_leaders']      = stage4LeadersAdapter;
SETUP_ADAPTERS['vani_exit_watch']      = vaniExitWatchAdapter;
SETUP_ADAPTERS['flower_pot_burst']     = flowerPotBurstAdapter;
SETUP_ADAPTERS['waking_giants']        = wakingGiantsAdapter;
SETUP_ADAPTERS['weekly_movers']         = weeklyMoversAdapter;
SETUP_ADAPTERS['monthly_movers']        = monthlyMoversAdapter;
SETUP_ADAPTERS['wg_ascent']            = wgAscentAdapter;
SETUP_ADAPTERS['wg_stirring']          = wgStirringAdapter;

// COMPLETE: every preset in SCAN_PRESETS (scanEngine.ts) has a Story
// View adapter. A new scanner needs one adapter file + one line here.

// The default export is here so callers can `import './adapters'` and be
// sure the registrations ran (module load = side-effect fill of the map).
export {};
