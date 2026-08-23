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

SETUP_ADAPTERS['stage_2_leaders'] = stage2LeadersAdapter;

// Reserved for follow-up phases (uncomment when the adapter ships):
// import { wakingGiantsAdapter } from './wakingGiants';
// SETUP_ADAPTERS['waking_giants'] = wakingGiantsAdapter;
//
// import { flowerPotBurstAdapter } from './flowerPot';
// SETUP_ADAPTERS['flower_pot_burst'] = flowerPotBurstAdapter;

// The default export is here so callers can `import './adapters'` and be
// sure the registrations ran (module load = side-effect fill of the map).
export {};
