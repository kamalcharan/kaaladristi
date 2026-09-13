# Price Action VaNi companion beta

All eight Price Action Studio screeners now place their existing VaNi intents in a companion beside the results on desktop and above them on smaller screens. The original questions, readiness gates, evidence builders, feedback and table-filter callbacks remain in use. No replacement intents are added.

The companion uses the approved mascot header and loader, vertically grouped questions, Concise / Explain simply / Go deeper controls, highlighted evidence and retry. Changing depth does not reapply table filters. Backend cache keys separate explanation depths for all eight Studio presets.

Flower Pot Burst uses the same companion shell and branded loader with its five existing questions. Its existing GET endpoints retain their answer format; explanation-depth variants are a follow-up for that separate API.

Rollout requires frontend deployment and backend restart/deployment. Validate real model wording and live data after deployment. Automated browser checks use mocked answers and cover the original seven Breakout Surge intent requests, filters, depths, evidence, side-panel placement, and light/dark mobile/desktop layouts. Backend tests cover depth support for all eight Studio presets. Beta feedback should also cover row VaNi and changed dates/exchanges.
