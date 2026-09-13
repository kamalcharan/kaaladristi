# Breakout Surge beta: existing VaNi interface

Use `/scanner/breakout_surge`. The on-page VaNi card retains its seven existing questions, evidence builders, readiness gates and matching table-filter callbacks. No replacement menu or deterministic scanner narrative is used.

Breakout Surge adds the approved mascot header, mascot loader, Concise / Explain simply / Go deeper controls, highlighted evidence sections, retry and existing answer feedback. Changing depth re-answers the selected intent without reapplying its table filter. Cache keys separate depths and invalidate the prior presentation. Other Studios retain their existing presentation.

Rollout requires frontend deployment and backend restart/deployment. Test every available original question, each depth, table filtering, row VaNi, changed dates/exchange and unavailable prior-session evidence. Review real model wording after deployment; automated UI tests use mocked responses. Feedback continues through the existing VaNi answer feedback endpoint.
