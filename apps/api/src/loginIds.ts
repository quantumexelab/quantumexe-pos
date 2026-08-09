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

export function userLoginWhere(login: string) {
  const variants = loginIdVariants(login);
  return {
    OR: variants.flatMap((v) => [{ username: v }, { contact: v }]),
  };
}
