# Breakout Surge beta

Entry: `/scanner/breakout_surge` after normal sign-in. No other scanner is switched to the beta companion.

The guided read uses four questions, three explanation depths and highlighted evidence. It is calculated directly from the complete filtered results, without an LLM call; this gives beta users a repeatable baseline. Examples are the first five displayed stocks, not recommendations or the complete population. Existing stock-level VaNi questions still use their existing implementation and feedback controls. Existing on-page scanner questions remain accessible and offer Back to guided read.

The readout separates recent flow from its baseline, labels unavailable evidence and does not claim weekly/monthly strength or market breadth from daily scanner rows. Changing filters recomputes all counts. Row VaNi receives the row date when available.

Beta tasks:
- Read the takeaway and identify one caution without founder explanation.
- Switch explanation styles and decide whether the extra detail helps.
- Inspect the evidence, then open one stock through its VaNi mascot.
- Check a filtered or empty list; do not confuse it with the complete scan.
- Use Helpful / Needs clarity. Guided-read ratings use existing product analytics when enabled; stock answer feedback uses the existing VaNi feedback endpoint.

Track question selections, evidence openings, ratings and stock-chart next steps. Review actual stock-level model output before treating the beta as fully validated. No user invitations, access changes or production deployment are performed by this code update.
