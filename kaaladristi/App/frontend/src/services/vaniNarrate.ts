/**
 * vaniNarrate — Phase 3. VaNi as the storyteller. The client assembles the
 * ALREADY-COMPUTED deterministic facts (thesis / story events / move-quality)
 * and VaNi narrates them. Because VaNi only ever sees the given facts, it can't
 * invent numbers — one substrate, VaNi is the voice.
 */

const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

export async function narrateVani(subject: string, facts: string): Promise<string | null> {
  try {
    const res = await fetch(`${pipelineUrl}/api/ai/vani-narrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, facts }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { insight: string | null };
    return data.insight ?? null;
  } catch {
    return null;
  }
}
