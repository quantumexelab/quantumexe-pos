export type CustomerDisplayLine = {
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
};

export type CustomerDisplayState = {
  shopName: string;
  welcomeNote: string;
  items: CustomerDisplayLine[];
  subtotal: number;
  discount: number;
  total: number;
  paid?: number;
  change?: number;
  status: "idle" | "cart" | "paid" | "thankyou";
  updatedAt: number;
};

const CHANNEL = "quantumexe-customer-display";
const STORAGE_KEY = "quantumexe_customer_display_state";

const IDLE: CustomerDisplayState = {
  shopName: "QUANTUMEXE POS",
  welcomeNote: "Welcome",
  items: [],
  subtotal: 0,
  discount: 0,
  total: 0,
  status: "idle",
  updatedAt: Date.now(),
};

function broadcast(state: CustomerDisplayState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage(state);
      ch.close();
    }
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANNEL, { detail: state }));
  } catch {
    /* ignore */
  }
}

export function publishCustomerDisplay(partial: Partial<CustomerDisplayState> & Pick<CustomerDisplayState, "status">) {
  const prev = readCustomerDisplay();
  const next: CustomerDisplayState = {
    ...prev,
    ...partial,
    updatedAt: Date.now(),
  };
  broadcast(next);
  return next;
}

export function readCustomerDisplay(): CustomerDisplayState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...IDLE };
    return { ...IDLE, ...JSON.parse(raw) };
  } catch {
    return { ...IDLE };
  }
}

export function subscribeCustomerDisplay(cb: (state: CustomerDisplayState) => void): () => void {
  cb(readCustomerDisplay());

  let ch: BroadcastChannel | null = null;
  const onMsg = (ev: MessageEvent) => {
    if (ev.data) cb(ev.data as CustomerDisplayState);
  };
  try {
    if (typeof BroadcastChannel !== "undefined") {
      ch = new BroadcastChannel(CHANNEL);
      ch.addEventListener("message", onMsg);
    }
  } catch {
    ch = null;
  }

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === STORAGE_KEY && ev.newValue) {
      try {
        cb(JSON.parse(ev.newValue));
      } catch {
        /* ignore */
      }
    }
  };
  const onCustom = (ev: Event) => {
    const detail = (ev as CustomEvent).detail;
    if (detail) cb(detail as CustomerDisplayState);
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANNEL, onCustom as EventListener);

  return () => {
    ch?.removeEventListener("message", onMsg);
    ch?.close();
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANNEL, onCustom as EventListener);
  };
}

export function openCustomerDisplayWindow() {
  const pathUrl = `${window.location.origin}/customer-display`;
  const w = window.open(pathUrl, "quantumexe-customer-display", "popup=yes,width=1024,height=768");
  if (!w) {
    alert("Allow pop-ups to open the customer display");
    return null;
  }
  return w;
}
