import { ReactNode, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { notify } from "../notify";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function SubNav({ items }: { items: { to: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="btn btn-muted text-sm">
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="card text-sm text-gray-500">{text}</div>;
}

export function ErrorBox({ text, toast = true }: { text: string; toast?: boolean }) {
  const last = useRef("");
  useEffect(() => {
    if (!toast || !text || text === last.current) return;
    last.current = text;
    notify.error(text);
  }, [text, toast]);

  if (!text) return null;
  return (
    <div className="qx-inline-alert qx-inline-alert-error mb-3" role="alert">
      <XCircle size={16} className="shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

export function WarningBox({ text, toast = true }: { text: string; toast?: boolean }) {
  const last = useRef("");
  useEffect(() => {
    if (!toast || !text || text === last.current) return;
    last.current = text;
    notify.warning(text);
  }, [text, toast]);

  if (!text) return null;
  return (
    <div className="qx-inline-alert qx-inline-alert-warning mb-3" role="status">
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

export function SuccessBox({ text, toast = true }: { text: string; toast?: boolean }) {
  const last = useRef("");
  useEffect(() => {
    if (!toast || !text || text === last.current) return;
    last.current = text;
    notify.success(text);
  }, [text, toast]);

  if (!text) return null;
  return (
    <div className="qx-inline-alert qx-inline-alert-success mb-3" role="status">
      <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

