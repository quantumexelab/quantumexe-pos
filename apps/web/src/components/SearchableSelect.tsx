import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export type SearchableOption = {
  id: string | number;
  name: string;
};

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

/** Type-to-filter dropdown with auto-suggest list. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
  disabled = false,
  className = "",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => String(o.id) === String(value)) || null,
    [options, value]
  );

  useEffect(() => {
    if (!open) setQuery(selected?.name || "");
  }, [selected?.name, open, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? options
      : options.filter((o) => String(o.name || "").toLowerCase().includes(q));
    return list.slice(0, 80);
  }, [options, query]);

  function pick(opt: SearchableOption) {
    onChange(String(opt.id));
    setQuery(opt.name);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(true);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <Search size={14} className="input-icon" />
        <input
          className="input has-icon pr-9"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            if (selected && next !== selected.name) onChange("");
          }}
          onFocus={() => setOpen(true)}
        />
        {(value || query) && !disabled && (
          <button
            type="button"
            title="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 grid place-items-center"
            onClick={clear}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-auto">
          {filtered.map((o) => {
            const active = String(o.id) === String(value);
            return (
              <button
                key={o.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 ${
                  active ? "bg-green-50 font-semibold text-green-800" : "text-gray-800"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
              >
                {o.name}
              </button>
            );
          })}
          {!filtered.length && <div className="px-3 py-2 text-sm text-gray-400">{emptyText}</div>}
        </div>
      )}
    </div>
  );
}
