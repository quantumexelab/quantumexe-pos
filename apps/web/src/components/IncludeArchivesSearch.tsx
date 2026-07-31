import { FormEvent, useState } from "react";
import api from "../api";

export type ArchiveHit = {
  source: string;
  kind: string;
  id: number | string;
  label: string;
  sub?: string;
  createdAt?: string | null;
};

type Props = {
  /** Restrict API hits to this kind when displaying (still searches all, filters client-side). */
  kinds?: Array<"invoice" | "customer" | "product" | "grn">;
  query: string;
  from?: string;
  to?: string;
  className?: string;
};

/** Checkbox + optional archive results strip for Manage Invoice / Customer / Product. */
export function IncludeArchivesSearch({ kinds, query, from, to, className }: Props) {
  const [include, setInclude] = useState(false);
  const [hits, setHits] = useState<ArchiveHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function run(e?: FormEvent) {
    e?.preventDefault();
    if (!include || !query.trim()) {
      setHits([]);
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const { data } = await api.get("/archive/search", {
        params: {
          q: query.trim(),
          from: from || undefined,
          to: to || undefined,
          includeArchives: "1",
        },
      });
      let list: ArchiveHit[] = (data.data?.hits || []).filter((h: ArchiveHit) => h.source !== "live");
      if (kinds?.length) list = list.filter((h) => kinds.includes(h.kind as (typeof kinds)[number]));
      setHits(list);
      if (!data.data?.archivesSupported) {
        setNote("Archives available on shop PC only");
      } else if (!list.length) {
        setNote("No archive matches");
      }
    } catch (err: any) {
      setNote(err.message || "Archive search failed");
      setHits([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
        <input
          type="checkbox"
          checked={include}
          onChange={(e) => {
            setInclude(e.target.checked);
            if (!e.target.checked) {
              setHits([]);
              setNote("");
            }
          }}
        />
        Include archives
      </label>
      {include && (
        <button
          type="button"
          disabled={busy || !query.trim()}
          onClick={() => void run()}
          className="ml-2 text-xs font-semibold text-sky-700 hover:underline disabled:opacity-50"
        >
          {busy ? "Searching archives…" : "Search archives"}
        </button>
      )}
      {note && <div className="mt-1 text-[11px] text-gray-500">{note}</div>}
      {hits.length > 0 && (
        <div className="mt-2 max-h-36 overflow-auto rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100">
          {hits.slice(0, 30).map((h) => (
            <div key={`${h.source}-${h.kind}-${h.id}`} className="px-3 py-1.5 text-xs flex gap-2">
              <span className="font-bold text-slate-600 shrink-0">{h.source}</span>
              <span className="font-semibold text-gray-900 truncate">{h.label}</span>
              {h.sub ? <span className="text-gray-500 truncate">{h.sub}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
