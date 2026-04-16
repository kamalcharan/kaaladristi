/**
 * Symbol display utilities
 * =========================
 * BSE stocks have numeric symbols (e.g. 500325, 544456) that are
 * meaningless to users. These utilities derive readable display names
 * from company_name for BSE stocks while preserving NSE ticker symbols.
 *
 * Usage:
 *   displaySymbol(stock)  → "RELIANCE" or "RM Drip"
 *   displaySubName(stock) → "Reliance Industries" or null
 *   navName(stock)        → URL-friendly name for navigation
 */

/** Check if a symbol is a numeric BSE code */
export function isNumericSymbol(symbol: string): boolean {
  return /^\d+$/.test(symbol);
}

/**
 * Derive a short readable name from company_name.
 * "R M Drip and Sprinklers Systems Limited" → "RM Drip"
 * "Reliance Industries Limited" → "Reliance Industries"
 * "Tata Consultancy Services Limited" → "Tata Consultancy"
 */
export function shortNameFromCompany(name: string): string {
  return name
    .replace(/\s+(Limited|Ltd|Pvt|Private|Corp|Corporation|Company|Co|Inc|Incorporated|LLP|PLC)\.?\s*$/i, '')
    .replace(/\s+and\s+/gi, ' & ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');
}

/**
 * Display name for UI hero text.
 * NSE: returns ticker symbol ("RELIANCE", "INFY")
 * BSE: returns short company name ("RM Drip", "Reliance Industries")
 */
export function displaySymbol(stock: { symbol: string; company_name: string | null }): string {
  if (!isNumericSymbol(stock.symbol)) return stock.symbol;
  if (!stock.company_name) return stock.symbol;
  return shortNameFromCompany(stock.company_name);
}

/**
 * Sub-name shown below hero text.
 * NSE: returns full company name ("Reliance Industries Limited")
 * BSE: returns null (company name already used as hero)
 */
export function displaySubName(stock: { symbol: string; company_name: string | null }): string | null {
  if (isNumericSymbol(stock.symbol)) return null;
  return stock.company_name;
}

/**
 * Name for navigation URLs (readable, not numeric).
 * Ensures /chart/equity/:id?name=... always has a human-readable name.
 */
export function navName(stock: { symbol: string; company_name: string | null }): string {
  if (isNumericSymbol(stock.symbol) && stock.company_name) {
    return stock.company_name;
  }
  return stock.symbol;
}

/**
 * Tooltip text for BSE stocks showing code + ISIN.
 * Returns null for NSE stocks (no tooltip needed).
 */
export function bseTooltip(stock: { symbol: string; exchange: string | null; isin?: string | null }): string | null {
  if (!isNumericSymbol(stock.symbol)) return null;
  const parts = [`BSE: ${stock.symbol}`];
  if (stock.isin) parts.push(stock.isin);
  return parts.join(' \u00B7 ');
}
