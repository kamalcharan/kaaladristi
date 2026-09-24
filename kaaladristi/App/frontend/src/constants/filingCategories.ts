/**
 * Filing categories — the display grouping for `km_corporate_events.desc_raw`.
 *
 * ⚠ READ `desc_raw`, NEVER `family`. NSE stamps every filing with its own
 * subject line and we store it verbatim: 117 distinct values, ZERO NULLs,
 * measured 2026-09-23. Our `km_corporate_events.family` column is LOSSIER than
 * the raw data it was derived from — 45.8% of rows sit in `UNCLASSIFIED` while
 * carrying a perfectly good subject ('Outcome of Board Meeting' 3,090,
 * 'General Updates' 3,185, 'Press Release' 1,606, 'Credit Rating' 268,
 * 'Dividend' 91). `family` drives the SIGNAL layer and is fine there; it must
 * not become this page's category axis or half the rows read "Unclassified"
 * when the exchange told us exactly what each one was.
 *
 * 117 raw values is too many chips, so they group to the list below. Anything
 * unmapped falls to `other` rather than disappearing — a new NSE subject must
 * still be reachable on the page the day it first appears.
 */

export interface FilingGroup {
  id: string;
  label: string;
  /** Exact `desc_raw` values, as NSE writes them. */
  descs: string[];
}

export const FILING_GROUPS: FilingGroup[] = [
  {
    id: 'results',
    label: 'Results',
    descs: [
      'Outcome of Board Meeting',
      'Integrated Filing- Financial',
      'Clarification - Financial Results',
      'Reply to Clarification- Financial results',
      'Reasons for Delayed/Non-submission of Financial Results',
    ],
  },
  {
    id: 'call',
    label: 'Conference Call',
    descs: [
      'Analysts/Institutional Investor Meet/Con. Call Updates',
      'Investor Presentation',
      'Monthly Business Updates',
    ],
  },
  {
    id: 'orders',
    label: 'Orders Won',
    descs: [
      'Bagging/Receiving of orders/contracts',
      'Awarding of order(s)/contract(s)',
    ],
  },
  {
    id: 'ma',
    label: 'M&A / Restructuring',
    descs: [
      'Acquisition',
      'Amalgamation/Merger',
      'Scheme of Arrangement',
      'Demerger',
      'Sale or disposal',
      'Diversification/Disinvestment',
      'Other Restructuring',
      'Offer for sale',
      'Public Announcement-Open Offer',
      'Disclosure under SEBI Takeover Regulations',
    ],
  },
  {
    id: 'expansion',
    label: 'Expansion',
    descs: [
      'Capacity addition',
      'Commencement of commercial production/operations',
      'Postponement of commercial production/operations',
      'Product launch',
      'Adoption of new line(s) of business',
      'Arrangements for strategic, technical, manufacturing, or marketing tie up',
      'Memorandum of Understanding/Agreements',
      'Agreements',
    ],
  },
  {
    id: 'management',
    label: 'Management',
    descs: [
      'Appointment',
      'Change in Management',
      'Change in Director(s)',
      'Resignation of Director/KMP/SMP',
      'Resignation',
      'Cessation',
      'Retirement',
      'Change in Company Secretary/Compliance Officer',
      'Demise',
      'Committee Meeting Updates',
    ],
  },
  {
    id: 'auditor',
    label: 'Auditor',
    descs: [
      'Change in Auditors',
      'Resignation of Statutory Auditor',
      'Initiation of Forensic Audit',
    ],
  },
  {
    id: 'legal',
    label: 'Legal & Distress',
    descs: [
      'Pendency of Litigation(s)/dispute(s) or the outcome impacting the Company',
      'Action(s) taken or orders passed',
      'Action(s) initiated or orders passed',
      'Corporate Insolvency Resolution Process',
      'Fraud/Default/Arrest',
      'Frauds/Default by employees',
      'Delay/default in the payment of fines/penalties/dues etc. to authority',
      'Defaults on Payment of Interest/Principal',
      'One time settlement',
      'Disruption of Operations',
      'Strikes/Lockouts/Disturbances',
      'Closure of operations',
      'Rescission/termination(s)',
      'Granting/withdrawal/surrender/cancellation/suspension of key licenses/ regulatory approvals',
    ],
  },
  {
    id: 'capital',
    label: 'Capital Raise',
    descs: [
      'Allotment of Securities',
      'Issue of Securities',
      'Preferential issue',
      'Qualified Institutional Placement',
      'Rights Issue',
      'Increase in Authorised Capital',
      'Conversion',
      'FCCBs',
      'Forfeiture',
      'Options to purchase securities',
      'Utilisation of Funds',
      'Giving guarantees/indemnity/ becoming a surety for third party',
      'Redemption',
    ],
  },
  {
    id: 'buyback',
    label: 'Buyback',
    descs: [
      'Buyback',
      'Closure of Buy Back',
      'Public Announcement - Buyback of Shares',
      'Post Buyback Public Announcement',
    ],
  },
  {
    id: 'corp_action',
    label: 'Dividend / Split / Bonus',
    descs: ['Record Date', 'Revised Record date', 'Dividend', 'Bonus', 'Stock split'],
  },
  {
    id: 'rating',
    label: 'Credit Rating',
    descs: ['Credit Rating', 'Credit Rating- Revision', 'Credit Rating- New', 'Credit Rating- Others'],
  },
  { id: 'esop', label: 'ESOP', descs: ['ESOP/ESOS/ESPS'] },
  {
    id: 'exchange_query',
    label: 'Exchange Query',
    descs: ['Spurt in Volume', 'Price movement', 'News Verification', 'Rumour Verification - Regulation 30(11)'],
  },
  {
    id: 'meetings',
    label: 'Shareholder Meetings',
    descs: ['Shareholders meeting', 'Extension of Annual General Meeting'],
  },
  {
    id: 'identity',
    label: 'Company Identity',
    descs: [
      'Name Change',
      'Name and Symbol Change',
      'Symbol Change of company',
      'Address Change',
      'Amendment to AOA/MOA',
      'Registrar & Share Transfer Agent Update',
    ],
  },
  {
    id: 'updates',
    label: 'Updates & Press',
    descs: [
      'General Updates',
      'Updates',
      'Press Release',
      'Press Release (Revised)',
      'Disclosure of material issue',
      'Effect(s) on listed entity due to changed regulatory  framework applicable',
      'Corrigendum',
      'Addendum',
      'Amendment(s)',
      'Others',
    ],
  },
  {
    // OFF BY DEFAULT. 'Copy of Newspaper Publication' alone is 3,827 rows —
    // a company posting its own results advert. Nothing here has ever been
    // worth a user's attention, and leaving it on buries everything that is.
    id: 'admin',
    label: 'Administrative',
    descs: [
      'Copy of Newspaper Publication',
      'Certificate under SEBI (Depositories and Participants) Regulations, 2018',
      'Trading Window',
      'Structural Digital Database',
      'Monitoring Agency Report',
      'Statement of deviation(s) or variation(s) under Reg. 32',
      'Quarterly Compliance Report on Corporate governance - within 21 days from the end of the quarter',
      'Trading Plan under PIT',
      'Integrated Filing- Governance',
      'Loss of Share Certificates',
      'Issue of Duplicate Share Certificate',
      'Suspension of Trading',
      'Voluntary Delisting',
    ],
  },
];

/** Groups hidden unless the user asks for them. */
export const MUTED_GROUP_IDS = new Set(['admin']);

/**
 * HIGH PRIORITY — measured, not asserted.
 *
 * Every filing class was tested for forward drift over 20 sessions against a
 * universe median of -0.59% (Jul-Aug 2026, one results season). Only these
 * moved anything:
 *
 *   result reaction > +5%   n=278   +0.95%   (+1.54 pts)   <- the only positive
 *   LITIGATION              n= 86   -2.90%   (-2.31 pts)
 *   REGULATORY_ACTION       n=129   -2.22%   (-1.63 pts)
 *   INSOLVENCY              n= 61   -2.22%   (-1.63 pts)
 *
 * ⚠ 'Bagging/Receiving of orders/contracts' is deliberately ABSENT. It pops
 * +2.07% on Day 0 and gives back 3.20% over the next month — -2.61 pts against
 * the market, the same pop-then-fade shape as dot_svd. "Companies that won a
 * large order" is the intuitive high-priority list and it is a losing one.
 * Acquisition (-1.40) is out for the same reason.
 *
 * ⚠ 'Change in Auditors' is ABSENT too: measured -0.11 pts, i.e. nothing.
 * Including it because it SOUNDS alarming is how a badge trains users to
 * ignore it.
 *
 * This tab shows results as a CLASS. The reaction >= +5% gate needs
 * kd_result_returns and belongs to the PEAD scanner, not to a browse page.
 */
export const HIGH_PRIORITY_DESCS: string[] = [
  'Outcome of Board Meeting',
  'Integrated Filing- Financial',
  'Pendency of Litigation(s)/dispute(s) or the outcome impacting the Company',
  'Action(s) taken or orders passed',
  'Action(s) initiated or orders passed',
  'Corporate Insolvency Resolution Process',
];

const DESC_TO_GROUP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of FILING_GROUPS) for (const d of g.descs) m.set(d, g.id);
  return m;
})();

export const GROUP_LABEL: Record<string, string> = Object.fromEntries(
  FILING_GROUPS.map((g) => [g.id, g.label]),
);

/** Unmapped subjects fall here rather than vanishing. */
export const OTHER_GROUP_ID = 'other';

export function groupForDesc(desc: string | null | undefined): string {
  if (!desc) return OTHER_GROUP_ID;
  return DESC_TO_GROUP.get(desc) ?? OTHER_GROUP_ID;
}

export function groupLabel(id: string): string {
  return GROUP_LABEL[id] ?? 'Other';
}

/** Every `desc_raw` behind a set of group ids — what the query filters on. */
export function descsForGroups(groupIds: string[]): string[] {
  const want = new Set(groupIds);
  return FILING_GROUPS.filter((g) => want.has(g.id)).flatMap((g) => g.descs);
}

/** Group ids shown by default: everything except the muted ones. */
export const DEFAULT_GROUP_IDS: string[] = FILING_GROUPS
  .filter((g) => !MUTED_GROUP_IDS.has(g.id))
  .map((g) => g.id);

/** The sub-chips behind one group, in the catalogue's own order. */
export function descsForGroup(groupId: string): string[] {
  return FILING_GROUPS.find((g) => g.id === groupId)?.descs ?? [];
}

/**
 * Short names people actually type, mapped to NSE's own wording.
 *
 * ⚠ Substring search over `desc_raw` CANNOT find these. "QIP" does not appear
 * anywhere in "Qualified Institutional Placement", "OFS" is absent from "Offer
 * for sale", and "CIRP" from "Corporate Insolvency Resolution Process" — so a
 * search box that only does ILIKE returns zero rows for the three terms a user
 * is most likely to try. Each entry is an acronym or a market nickname, never a
 * synonym we invented.
 */
export const DESC_ALIASES: Record<string, string[]> = {
  qip: ['Qualified Institutional Placement'],
  ofs: ['Offer for sale'],
  fccb: ['FCCBs'],
  cirp: ['Corporate Insolvency Resolution Process'],
  insolvency: ['Corporate Insolvency Resolution Process'],
  nclt: ['Corporate Insolvency Resolution Process'],
  sast: ['Disclosure under SEBI Takeover Regulations'],
  takeover: ['Disclosure under SEBI Takeover Regulations'],
  pit: ['Trading Plan under PIT', 'Trading Window'],
  esop: ['ESOP/ESOS/ESPS', 'Options to purchase securities'],
  agm: ['Shareholders meeting', 'Extension of Annual General Meeting'],
  egm: ['Shareholders meeting'],
  concall: ['Analysts/Institutional Investor Meet/Con. Call Updates'],
  'con call': ['Analysts/Institutional Investor Meet/Con. Call Updates'],
  earnings: ['Outcome of Board Meeting', 'Integrated Filing- Financial'],
  results: ['Outcome of Board Meeting', 'Integrated Filing- Financial'],
  fundraise: ['Qualified Institutional Placement', 'Preferential issue',
              'Rights Issue', 'Issue of Securities', 'FCCBs'],
  'fund raise': ['Qualified Institutional Placement', 'Preferential issue',
                 'Rights Issue', 'Issue of Securities', 'FCCBs'],
  'fund raising': ['Qualified Institutional Placement', 'Preferential issue',
                   'Rights Issue', 'Issue of Securities', 'FCCBs'],
  pref: ['Preferential issue'],
  split: ['Stock split'],
  merger: ['Amalgamation/Merger', 'Scheme of Arrangement'],
  order: ['Bagging/Receiving of orders/contracts', 'Awarding of order(s)/contract(s)'],
};

/**
 * Subjects a search term should also match — its ALIASES plus any group label
 * it names. Substring matching over the subject text itself is left to the
 * server (`desc_raw.ilike`), so this returns only what ILIKE cannot find.
 */
export function aliasDescs(term: string): string[] {
  const t = term.trim().toLowerCase();
  if (t.length < 2) return [];
  const out = new Set<string>();
  for (const [k, descs] of Object.entries(DESC_ALIASES)) {
    if (k.includes(t) || t.includes(k)) descs.forEach((d) => out.add(d));
  }
  for (const g of FILING_GROUPS) {
    if (g.label.toLowerCase().includes(t)) g.descs.forEach((d) => out.add(d));
  }
  return [...out];
}
