/** CD-7220 / ESC-POS style 2-line customer pole display via Web Serial API. */

const WIDTH = 20;

type SerialPortLike = {
  open: (opts: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  readable: ReadableStream<Uint8Array> | null;
};

declare global {
  interface Navigator {
    serial?: {
      requestPort: () => Promise<SerialPortLike>;
      getPorts: () => Promise<SerialPortLike[]>;
    };
  }
}

let port: SerialPortLike | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

function pad(s: string, n = WIDTH) {
  const t = String(s || "").slice(0, n);
  return t + " ".repeat(Math.max(0, n - t.length));
}

function encode(bytes: number[] | string) {
  if (typeof bytes === "string") return new TextEncoder().encode(bytes);
  return new Uint8Array(bytes);
}

export function poleDisplaySupported() {
  return typeof navigator !== "undefined" && !!navigator.serial;
}

export function poleDisplayConnected() {
  return !!port && !!writer;
}

export async function connectPoleDisplay(baudRate = 9600) {
  if (!navigator.serial) {
    throw new Error("Web Serial not supported in this browser. Use Chrome/Edge on desktop.");
  }
  if (writer) {
    try {
      await writer.close();
    } catch {
      /* ignore */
    }
    writer = null;
  }
  if (port) {
    try {
      await port.close();
    } catch {
      /* ignore */
    }
    port = null;
  }

  const existing = await navigator.serial.getPorts();
  port = existing[0] || (await navigator.serial.requestPort());
  await port.open({ baudRate });
  if (!port.writable) throw new Error("Pole display port is not writable");
  writer = port.writable.getWriter();
  await writePoleLines("CD-7220 READY", "CUSTOMER DISPLAY");
  return true;
}

export async function disconnectPoleDisplay() {
  try {
    await writer?.close();
  } catch {
    /* ignore */
  }
  writer = null;
  try {
    await port?.close();
  } catch {
    /* ignore */
  }
  port = null;
}

async function rawWrite(data: Uint8Array) {
  if (!writer) throw new Error("Pole display not connected");
  await writer.write(data);
}

/**
 * CD-7220 common command set:
 * ESC Q A + 20 chars + CR  → line 1
 * ESC Q B + 20 chars + CR  → line 2
 * Also send form-feed clear first for a clean screen.
 */
export async function writePoleLines(line1: string, line2: string) {
  if (!writer) return;
  const l1 = pad(line1);
  const l2 = pad(line2);
  // Clear
  await rawWrite(encode([0x0c]));
  // ESC Q A line1 CR
  await rawWrite(encode([0x1b, 0x51, 0x41, ...Array.from(new TextEncoder().encode(l1)), 0x0d]));
  // ESC Q B line2 CR
  await rawWrite(encode([0x1b, 0x51, 0x42, ...Array.from(new TextEncoder().encode(l2)), 0x0d]));
}

export async function showPoleCart(opts: {
  itemName?: string;
  itemPrice?: number;
  total: number;
  currency?: string;
}) {
  const cur = opts.currency || "Rs.";
  const top = opts.itemName
    ? `${String(opts.itemName).slice(0, 12)} ${cur}${Number(opts.itemPrice || 0).toFixed(0)}`.slice(0, WIDTH)
    : "READY";
  const bottom = `TOTAL ${cur}${Number(opts.total || 0).toFixed(2)}`.slice(0, WIDTH);
  await writePoleLines(top, bottom);
}

export async function showPoleThankYou(total: number, currency = "Rs.") {
  await writePoleLines("THANK YOU", `TOTAL ${currency}${Number(total).toFixed(2)}`.slice(0, WIDTH));
}

export async function showPoleIdle(shopName = "WELCOME") {
  await writePoleLines(String(shopName).slice(0, WIDTH), "HAVE A NICE DAY");
}
