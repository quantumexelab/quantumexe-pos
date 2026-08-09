/** Normalize Sri Lankan / E.164 phone login ids so +94… and 0… match. */
export function loginIdVariants(raw: string): string[] {
  const s = String(raw || "").trim();
  const out = new Set<string>();
  if (!s) return [];
  out.add(s);

  const digits = s.replace(/\D/g, "");
  if (!digits) return [...out];

  out.add(digits);

  let national = digits;
  if (digits.startsWith("94") && digits.length >= 11) {
    national = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length >= 9) {
    national = digits.slice(1);
  }

  if (national) {
    out.add(national);
    out.add(`0${national}`);
    out.add(`94${national}`);
    out.add(`+94${national}`);
  }

  return [...out];
}

/** Prefer fewest Firestore queries: raw, local 0xx, then +94. */
export function preferredLoginIds(raw: string): string[] {
  const all = loginIdVariants(raw);
  const preferred: string[] = [];
  const s = String(raw || "").trim();
  if (s) preferred.push(s);
  const zero = all.find((v) => /^0\d{9}$/.test(v));
  const e164 = all.find((v) => /^\+94\d{9}$/.test(v));
  if (zero && !preferred.includes(zero)) preferred.push(zero);
  if (e164 && !preferred.includes(e164)) preferred.push(e164);
  return preferred.length ? preferred : all.slice(0, 3);
}

export function userLoginWhere(login: string) {
  const variants = loginIdVariants(login);
  return {
    OR: variants.flatMap((v) => [{ username: v }, { contact: v }]),
  };
}
