/**
 * Panchang mini-glossary — plain-language, observational definitions for the
 * Vedic terms that render as bare labels across the app (the single densest
 * source of "I don't understand what I'm looking at" in beta feedback).
 *
 * Used via <GlossaryTerm term="Tithi" /> (src/components/ui/GlossaryTerm.tsx),
 * which renders the term with a dotted underline + hover tooltip when the
 * term exists here, and plain text otherwise.
 *
 * Keys are matched case-insensitively. Keep definitions to 1–2 sentences,
 * SEBI-safe (observational — describe what the term IS, never what to do).
 */

export const PANCHANG_GLOSSARY: Record<string, string> = {
  'panchangam':
    'The Vedic almanac — five daily attributes of the sky (weekday, lunar day, constellation, yoga, karana). DristiQ correlates these cycles with observed market behaviour.',
  'panchang':
    'The Vedic almanac — five daily attributes of the sky (weekday, lunar day, constellation, yoga, karana). DristiQ correlates these cycles with observed market behaviour.',
  'vara':
    'The Vedic weekday. Each day is ruled by a planet — its Vara Lord (e.g. Monday · Moon, Saturday · Saturn).',
  'vara lord':
    'The planet that rules this weekday in the Vedic system (e.g. Monday · Moon, Thursday · Jupiter).',
  'tithi':
    'The lunar day — one of 30 steps in the Moon’s cycle from new moon to full moon and back. It changes at a specific time each day, not at midnight.',
  'paksha':
    'The lunar fortnight: Shukla (waxing — new moon toward full) or Krishna (waning — full moon toward new).',
  'nakshatra':
    'The constellation the Moon occupies today — one of 27 lunar mansions. A core timing element of Vedic astronomy; the Moon moves to the next roughly daily.',
  'yoga':
    'One of 27 daily combinations of the Sun’s and Moon’s positions in the panchang.',
  'karana':
    'Half of a tithi — one of 11 divisions used in the panchang; two karanas pass each lunar day.',
  'panchak':
    'A roughly 5-day window each month when the Moon transits the last five nakshatras — traditionally treated as a caution period. Shown as shaded zones on price charts.',
  'nakshatra-vara':
    'A combination rule: a specific nakshatra falling on a specific weekday. DristiQ tracks how markets have historically behaved on these combinations.',
};

/** Case-insensitive lookup; returns undefined for unknown terms. */
export function glossaryLookup(term: string): string | undefined {
  return PANCHANG_GLOSSARY[term.trim().toLowerCase()];
}
