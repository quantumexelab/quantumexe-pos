/** Browser-side Firebase service-account JSON helpers (Master Admin paste). */

export type ParsedServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function normalizePem(key: string): string {
  let k = String(key || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  for (let i = 0; i < 3; i++) {
    if (k.includes("\\n")) k = k.replace(/\\n/g, "\n");
    if (k.includes("\\r")) k = k.replace(/\\r/g, "\r");
  }
  k = k.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (k.includes("BEGIN") && k.includes("PRIVATE KEY")) {
    const beginMatch = k.match(/-----BEGIN ([A-Z0-9 ]+)-----/);
    const endMatch = k.match(/-----END ([A-Z0-9 ]+)-----/);
    if (beginMatch && endMatch) {
      const label = beginMatch[1];
      const beginTag = `-----BEGIN ${label}-----`;
      const endTag = `-----END ${label}-----`;
      const start = k.indexOf(beginTag) + beginTag.length;
      const end = k.indexOf(endTag);
      if (end > start) {
        const body = k.slice(start, end).replace(/[^A-Za-z0-9+/=]/g, "");
        if (body.length < 80) {
          throw new Error("private_key looks truncated — paste the full JSON file");
        }
        const lines: string[] = [];
        for (let i = 0; i < body.length; i += 64) lines.push(body.slice(i, i + 64));
        k = `${beginTag}\n${lines.join("\n")}\n${endTag}\n`;
      }
    }
  }

  if (!k.includes("BEGIN PRIVATE KEY") && !k.includes("BEGIN RSA PRIVATE KEY")) {
    throw new Error("No private key found — paste the full downloaded service-account JSON");
  }
  return k.endsWith("\n") ? k : `${k}\n`;
}

/** Accept full JSON file text, or a bare PEM private key. */
export function parseServiceAccountPaste(raw: string): ParsedServiceAccount {
  let text = String(raw || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!text) throw new Error("Paste is empty");

  text = text
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  // Bare PEM paste
  if (text.includes("BEGIN") && text.includes("PRIVATE KEY") && !text.includes('"type"')) {
    throw new Error("Paste the full JSON file (includes project_id + client_email), not only the private key");
  }

  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
  }

  let sa: Record<string, unknown>;
  try {
    sa = JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `Invalid service account JSON — open the .json in Notepad, Ctrl+A, Ctrl+C, paste the whole file. (${
        e instanceof Error ? e.message : "parse error"
      })`
    );
  }

  const projectId = String(sa.project_id || sa.projectId || "").trim();
  const clientEmail = String(sa.client_email || sa.clientEmail || "").trim();
  const privateKeyRaw = String(sa.private_key || sa.privateKey || "").trim();

  if (!projectId) throw new Error("JSON missing project_id");
  if (!clientEmail) throw new Error("JSON missing client_email");
  if (!privateKeyRaw) throw new Error("JSON missing private_key");

  return {
    projectId,
    clientEmail,
    privateKey: normalizePem(privateKeyRaw),
  };
}

export function buildFirebaseConnectPayload(form: {
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
}): { firebaseProjectId: string; firebaseClientEmail: string; firebasePrivateKey: string } {
  const raw = form.firebasePrivateKey.trim();
  const looksJson = raw.startsWith("{") || raw.includes('"private_key"') || raw.includes('"type"');

  if (looksJson) {
    const sa = parseServiceAccountPaste(raw);
    return {
      firebaseProjectId: form.firebaseProjectId.trim() || sa.projectId,
      firebaseClientEmail: form.firebaseClientEmail.trim() || sa.clientEmail,
      firebasePrivateKey: sa.privateKey,
    };
  }

  if (!form.firebaseProjectId.trim() || !form.firebaseClientEmail.trim()) {
    throw new Error("Project ID and client email are required (or paste the full JSON file)");
  }
  return {
    firebaseProjectId: form.firebaseProjectId.trim(),
    firebaseClientEmail: form.firebaseClientEmail.trim(),
    firebasePrivateKey: normalizePem(raw),
  };
}
