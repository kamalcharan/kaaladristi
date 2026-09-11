/**
 * Shared types for the VaNi conversational pane.
 *
 * ChatMessage lives here rather than in VaNiChatPanel because the autorun
 * brief renders VaNi answers too — if the shape stayed private to the panel,
 * the brief would grow its own near-copy of the bubble and the two would
 * drift (different padding, no feedback control, a second cache badge).
 */
export interface ChatMessage {
  id: string;
  type: 'intent' | 'response';
  intentId?: string;
  text: string;
  cached?: boolean;
  logId?: string;
  timestamp: number;
  /** Optional deep link rendered under the message (stock-lookup flow). */
  link?: { href: string; label: string };
}
