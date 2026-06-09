/**
 * Dutch phone-number helpers — ONE definition, shared by the sourcing guards
 * (places-to-brief's "don't derive whatsapp from a landline") and the opener
 * builder. A wa.me link to a landline is a dead link on exactly the message
 * that is supposed to win the salon's trust.
 */

/** "+31 (0)6 12345678" is the dominant NL website spelling — the trunk-zero
 * "(0)" must go BEFORE stripping other formatting, or it survives as a digit. */
function normalize(phone: string): string {
  return phone.replace(/\(0\)/g, "").replace(/[^\d+]/g, "");
}

/** A Dutch MOBILE number is 06 / +316 / +31(0)6 / 00316 followed by 8 digits.
 * Anything else on +31 is a geographic landline (e.g. +31 30 = Utrecht), which
 * cannot host a WhatsApp account. */
export function isDutchMobile(phone?: string): boolean {
  if (!phone) return false;
  return /^(?:\+316|00316|06)\d{8}$/.test(normalize(phone));
}

/** wa.me wants the international number, digits only ("31612345678").
 * Returns null when the input isn't a Dutch mobile. */
export function dutchMobileToWaNumber(phone?: string): string | null {
  if (!phone || !isDutchMobile(phone)) return null;
  const d = normalize(phone);
  if (d.startsWith("+316")) return d.slice(1);
  if (d.startsWith("00316")) return d.slice(2);
  return `31${d.slice(1)}`; // 06xxxxxxxx → 316xxxxxxxx
}
