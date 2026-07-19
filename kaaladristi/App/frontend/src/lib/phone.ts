// Indian mobile number helpers — shared by onboarding (ProfileSetup) and the
// Account page so validation stays identical in both places.

/** Strip spaces, dashes, a leading +91 / 91 / 0, and keep digits. */
export function normalizeIndianMobile(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  // drop a leading country code (91) or trunk 0 if 11–12 digits result
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

/** A valid Indian mobile is 10 digits starting 6–9 (after normalization). */
export function isValidIndianMobile(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizeIndianMobile(raw))
}
