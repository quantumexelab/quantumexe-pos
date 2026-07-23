import { ReactNode } from "react";
import { Link } from "react-router-dom";

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

export function ErrorBox({ text }: { text: string }) {
  return <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{text}</div>;
}
