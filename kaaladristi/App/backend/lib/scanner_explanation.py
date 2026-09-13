"""Presentation variants for existing Breakout Surge intents; no new intents."""
def with_depth(context, preset_id, depth):
    if preset_id != 'breakout_surge':
        return context
    if depth not in ('brief', 'simple', 'detailed'):
        raise ValueError('Invalid explanation depth')
    return {**context, 'presentation_version': 1, 'explanation_depth': depth}


def style(depth):
    common = (' For this Breakout Surge explanation, the following presentation instructions replace earlier length/format requirements. '
              'Answer the existing question using only supplied facts. Lead with its meaning, then evidence and a useful qualification. '
              'Do not invent data, price causes, investor activity or recommendations. A Flow 5D versus Flow 22D gap is a baseline comparison, '
              'not change since yesterday and not weekly/monthly trend confirmation. A daily RS-zone change does not establish longer-term alignment. '
              'Do not infer Greed/Fear without breadth evidence. Keep cohort counts separate from example stocks and describe only explicitly missing data. ')
    return common + {
        'brief': 'CONCISE: two or three sentences, at most 65 words. State the takeaway and main qualification; avoid a statistics dump.',
        'simple': 'EXPLAIN SIMPLY: at most 100 words. Explain what the observation means in everyday language and what to inspect next. Define relevant terminology; do not just repeat figures.',
        'detailed': 'GO DEEPER: at most 180 words in three short paragraphs: observation, supporting evidence, limits and next check. Preserve dates, coverage and comparison direction. Highlight mixed evidence without forecasting.'
    }[depth]
