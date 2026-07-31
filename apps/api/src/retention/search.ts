import fs from "fs";
import path from "path";
import { prisma } from "../lib.js";
import { archivesRoot, archivesSupported } from "./paths.js";
import { listSqliteArchives, openArchivePrisma } from "./archives.js";

export type ArchiveSearchHit = {
  source: string; // "live" | "archive:2025-03" | "archive:2025"
  kind: "invoice" | "customer" | "product" | "grn";
  id: number | string;
  label: string;
  sub?: string;
  createdAt?: string | null;
};

function sourceTag(relativeOrLive: string): string {
  if (relativeOrLive === "live") return "live";
  const base = path.basename(relativeOrLive, path.extname(relativeOrLive));
  const m = base.match(/backup_(.+)$/i);
  return m ? `archive:${m[1]}` : `archive:${base}`;
}

async function searchClient(
  client: typeof prisma,
  source: string,
  q: string,
  from?: Date | null,
  to?: Date | null
): Promise<ArchiveSearchHit[]> {
  const hits: ArchiveSearchHit[] = [];
  const like = q;
  const createdFilter =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  try {
    const invoices = await client.invoice.findMany({
      where: {
        AND: [
          {
            OR: [
              { invoiceNo: { contains: like } },
              { customer: { name: { contains: like } } },
              { customer: { phone: { contains: like } } },
            ],
          },
          createdFilter ? { createdAt: createdFilter } : {},
        ],
      },
      take: 40,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });
    for (const inv of invoices) {
      hits.push({
        source,
        kind: "invoice",
        id: inv.id,
        label: inv.invoiceNo,
        sub: inv.customer?.name || inv.customer?.phone || undefined,
        createdAt: inv.createdAt?.toISOString?.() ?? null,
      });
    }
  } catch {
    /* schema drift in old archive */
  }

  try {
    const customers = await client.customer.findMany({
      where: {
        AND: [
          {
            OR: [{ name: { contains: like } }, { phone: { contains: like } }, { email: { contains: like } }],
          },
          createdFilter ? { createdAt: createdFilter } : {},
        ],
      },
      take: 40,
      orderBy: { createdAt: "desc" },
    });
    for (const c of customers) {
      hits.push({
        source,
        kind: "customer",
        id: c.id,
        label: c.name,
        sub: c.phone || c.email || undefined,
        createdAt: c.createdAt?.toISOString?.() ?? null,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const products = await client.product.findMany({
      where: {
        AND: [
          {
            OR: [{ name: { contains: like } }, { code: { contains: like } }],
          },
          createdFilter ? { createdAt: createdFilter } : {},
        ],
      },
      take: 40,
      orderBy: { createdAt: "desc" },
    });
    for (const p of products) {
      hits.push({
        source,
        kind: "product",
        id: p.id,
        label: p.name,
        sub: p.code,
        createdAt: p.createdAt?.toISOString?.() ?? null,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const grns = await client.grn.findMany({
      where: {
        AND: [
          {
            OR: [{ billNo: { contains: like } }, { supplier: { name: { contains: like } } }],
          },
          createdFilter ? { createdAt: createdFilter } : {},
        ],
      },
      take: 40,
      orderBy: { createdAt: "desc" },
      include: { supplier: true },
    });
    for (const g of grns) {
      hits.push({
        source,
        kind: "grn",
        id: g.id,
        label: g.billNo || `GRN #${g.id}`,
        sub: g.supplier?.name || undefined,
        createdAt: g.createdAt?.toISOString?.() ?? null,
      });
    }
  } catch {
    /* ignore */
  }

  return hits;
}

export async function searchLiveAndArchives(opts: {
  q: string;
  from?: string | null;
  to?: string | null;
  includeArchives?: boolean;
}): Promise<{ hits: ArchiveSearchHit[]; archivesScanned: number; archivesSupported: boolean }> {
  const q = String(opts.q || "").trim();
  if (q.length < 1) {
    return { hits: [], archivesScanned: 0, archivesSupported: archivesSupported() };
  }
  const from = opts.from ? new Date(opts.from) : null;
  const to = opts.to ? new Date(opts.to) : null;
  const fromOk = from && !Number.isNaN(from.getTime()) ? from : null;
  const toOk = to && !Number.isNaN(to.getTime()) ? to : null;

  const hits = await searchClient(prisma, "live", q, fromOk, toOk);
  let archivesScanned = 0;

  if (opts.includeArchives !== false && archivesSupported()) {
    const files = listSqliteArchives();
    for (const f of files) {
      if (!fs.existsSync(f.path)) continue;
      const tag = sourceTag(f.relative);
      const client = openArchivePrisma(f.path);
      try {
        const more = await searchClient(client as typeof prisma, tag, q, fromOk, toOk);
        hits.push(...more);
        archivesScanned += 1;
      } catch (e) {
        console.warn("[archive-search]", f.file, e instanceof Error ? e.message : e);
      } finally {
        await client.$disconnect().catch(() => undefined);
      }
    }
  }

  // De-dupe by kind+id+source keeping first
  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const k = `${h.source}:${h.kind}:${h.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    hits: unique.slice(0, 200),
    archivesScanned,
    archivesSupported: archivesSupported(),
  };
}

export function resolveArchiveDownloadPath(relative: string): string | null {
  if (!archivesSupported()) return null;
  const root = archivesRoot();
  const safe = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(root, safe);
  if (!full.startsWith(root)) return null;
  if (!fs.existsSync(full)) return null;
  return full;
}
