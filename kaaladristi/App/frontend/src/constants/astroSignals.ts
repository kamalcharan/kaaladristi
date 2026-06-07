/**
 * astroSignals.ts — re-exports from signalScale for backward compatibility.
 * New code should import directly from @/constants/signalScale.
 */

export {
  SIGNAL_CLASSES     as ASTRO_SIGNAL_CLASSES,
  impactToColor,
  SIGNAL_LABELS      as ASTRO_SIGNAL_LABELS,
  type SignalColor    as AstroSignalColor,
} from './signalScale';
