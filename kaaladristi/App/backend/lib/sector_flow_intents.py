"""Small, deterministic projections of the existing sector snapshot. No new queries."""
from .market_structure_vani import number

INTENTS = ('sector.read', 'sector.entering', 'sector.fading', 'sector.leaving',
           'sector.compare', 'sector.persistence')


def build_views(ctx):
    from .sector_vani import flow_state
    rows = ctx.get('rows', [])
    dates = sorted({r['trade_date'] for r in ctx.get('history', [])
                    if r['trade_date'] <= ctx['date']} | {ctx['date']})[-ctx['period']:]
    history = {(r['index_id'], r['trade_date']): r for r in ctx.get('history', [])}
    def example(r):
        cells = []
        for day in reversed(dates):
            observation = history.get((r['index_id'], day))
            cells.append({'date': day, 'state': flow_state(observation) if observation else 'Unavailable'})
        run = 0
        for cell in cells:
            if cell['state'] not in ('Strong', 'Building'): break
            run += 1
        fast, slow = number(r.get('score_5d')), number(r.get('score_22d'))
        return {'id': r['index_id'], 'name': r['name'], 'state': flow_state(r),
                'fast': fast, 'slow': slow,
                'relation': 'Unavailable' if fast is None or slow is None else 'Above' if fast > slow else 'Below' if fast < slow else 'Equal',
                'run': run, 'sessions': len(dates), 'cells': cells}
    examples = [example(r) for r in rows]
    examples.sort(key=lambda r: (-(r['fast'] if r['fast'] is not None else -1), r['name'], r['id']))
    missing = max(0, ctx.get('index_count', len(rows)) - len(rows)) + sum(r['state'] == 'Unavailable' for r in examples)
    views = {}
    for intent in INTENTS:
        selected = list(examples)
        tone = 'neutral'
        if intent in ('sector.entering', 'sector.persistence'):
            selected = [r for r in selected if r['state'] in ('Strong', 'Building')]
            tone = 'green'
            title = 'Recent flow is active relative to its baseline.'
            meaning = 'Entering combines Strong and Building. It describes price-and-amount conditions, not identified investors or net cash received.'
            next_step = 'Check whether activity repeats, then inspect how many constituents participate.'
            empty = 'No entering flows in this selection.'
            if intent == 'sector.persistence':
                selected.sort(key=lambda r: (-r['run'], r['name'], r['id']))
                title = 'Repeated activity is different from a single strong reading.'
                meaning = 'The strip follows entering flow across recorded category sessions. Strong and Building both count; other states and missing readings break the run.'
                next_step = 'Inspect interruptions and constituent participation. This short window cannot establish a months-long theme.'
        elif intent == 'sector.fading':
            selected = [r for r in selected if r['state'] == 'Fading']
            tone = 'amber'
            title = 'Recent flow sits below its underlying baseline.'
            meaning = 'The near-term score remains positive but is below Flow 22D. Fading does not by itself establish a decline since yesterday.'
            next_step = 'Inspect the flow history and constituent spread before interpreting the softer reading.'
            empty = 'No fading flows in this selection.'
        elif intent == 'sector.leaving':
            selected = [r for r in selected if r['state'] == 'Outflow']
            tone = 'red'
            title = 'Price and amount conditions meet the outflow rule.'
            meaning = 'These baskets combine no positive near-term score with negative 5D return and a lower 5D average amount. Quiet and missing readings are separate.'
            next_step = 'Inspect constituent flow to see whether the condition is shared across the basket.'
            empty = 'No outflow readings in this selection.'
        elif intent == 'sector.compare':
            selected = [r for r in selected if r['relation'] != 'Unavailable']
            title = 'Two horizons describe the same basket differently.'
            meaning = 'Above, below or equal compares Flow 5D with Flow 22D. This comparison is neither a return percentage nor a change since yesterday.'
            next_step = 'Compare the two scores, then use persistence to inspect their history.'
            empty = 'No complete score pairs in this selection.'
        else:
            selected = [r for r in selected if r['state'] != 'Unavailable']
            title = 'Read the condition before interpreting the score.'
            meaning = 'Strong and Building describe entering flow; Fading is positive but below baseline. Outflow, Quiet and unavailable readings must stay separate.'
            next_step = 'Choose a flow group, inspect persistence, then open constituent evidence.'
            empty = 'No classified flow readings in this selection.'
        if not selected:
            title, tone = empty, 'neutral'
            meaning = 'No available readings match this question. Missing observations are not evidence of zero activity.'
            next_step = 'Choose another flow question, category or available session.'
        views[intent] = {'title': title, 'meaning': meaning, 'next': next_step, 'tone': tone,
                         'matching_ids': [r['id'] for r in selected], 'examples': selected[:3],
                         'matches': len(selected), 'unavailable': missing,
                         'scope': ctx['category'], 'date': ctx['date'], 'period': ctx['period']}
    return views


def intent_facts(ctx, intent):
    view = ctx['intent_views'][intent]
    facts = [f"Closing session {view['date']}; category {view['scope']}; {view['period']}-session window.",
             view['title'], view['meaning'], view['next'],
             f"{view['matches']} matching baskets; {view['unavailable']} unavailable in category. Examples are limited to three, not the whole group."]
    for r in view['examples']:
        facts.append(f"{r['name']}: {r['state']}; Flow 5D={r['fast']}, Flow 22D={r['slow']}; near-term {r['relation']} underlying.")
        if intent == 'sector.persistence':
            facts.append(f"Current entering run within the recorded window: {r['run']} of {r['sessions']} category sessions. Missing readings break the run. A run filling the window may have begun earlier; no original start date is established.")
    return facts
