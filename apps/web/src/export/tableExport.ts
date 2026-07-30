/** Lightweight CSV / Excel / PDF table exports (no extra deps). */

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown) {
  return JSON.stringify(String(v ?? ""));
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  downloadBlob(filename.endsWith(".csv") ? filename : `${filename}.csv`, new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
}

/** Excel-friendly CSV (.xls extension opens in Excel). */
export function downloadExcel(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  const name = filename.replace(/\.(csv|xls|xlsx)$/i, "") + ".xls";
  downloadBlob(name, new Blob(["\uFEFF" + lines.join("\r\n")], { type: "application/vnd.ms-excel;charset=utf-8" }));
}

function pdfEscape(text: string) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Builds a simple multi-page text PDF and triggers a real file download.
 */
export function downloadPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: unknown[][],
  opts?: { maxColWidth?: number }
) {
  const maxCol = opts?.maxColWidth ?? 28;
  const colWidths = headers.map((h, i) => {
    let w = h.length;
    for (const r of rows) w = Math.max(w, String(r[i] ?? "").length);
    return Math.min(maxCol, Math.max(8, w));
  });

  function fmtRow(cells: unknown[]) {
    return cells
      .map((c, i) => {
        const s = String(c ?? "");
        const w = colWidths[i] || 12;
        return (s.length > w ? s.slice(0, w - 1) + "…" : s).padEnd(w, " ");
      })
      .join("  ");
  }

  const lines: string[] = [
    title,
    `Exported: ${new Date().toLocaleString()}`,
    "".padEnd(Math.min(100, fmtRow(headers).length), "-"),
    fmtRow(headers),
    "".padEnd(Math.min(100, fmtRow(headers).length), "-"),
  ];
  if (!rows.length) lines.push("(No records)");
  else for (const r of rows) lines.push(fmtRow(r));

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36;
  const fontSize = 9;
  const lineHeight = 12;
  const usable = pageHeight - margin * 2;
  const linesPerPage = Math.max(1, Math.floor(usable / lineHeight));

  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push([title, "(No records)"]);

  const objs: Array<string | null> = [null]; // 1-based
  const fontObj = objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>") - 1;

  const contentObjIds: number[] = [];
  for (const pageLines of pages) {
    const streamParts = [`BT /F1 ${fontSize} Tf`];
    let y = pageHeight - margin - fontSize;
    for (const line of pageLines) {
      streamParts.push(`1 0 0 1 ${margin} ${y} Tm (${pdfEscape(line)}) Tj`);
      y -= lineHeight;
    }
    streamParts.push("ET");
    const stream = streamParts.join("\n");
    contentObjIds.push(objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`) - 1);
  }

  const pageObjIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjIds.push(
      objs.push(
        `<< /Type /Page /Parent PAGES_ID 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjIds[i]} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>`
      ) - 1
    );
  }

  const kids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  const pagesId = objs.push(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pageObjIds.length} >>`) - 1;

  for (const id of pageObjIds) {
    objs[id] = objs[id]!.replace("PAGES_ID", String(pagesId));
  }

  const catalogId = objs.push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`) - 1;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const name = filename.replace(/\.(pdf|csv|xls)$/i, "") + ".pdf";
  downloadBlob(name, new Blob([pdf], { type: "application/pdf" }));
}

export function exportTable(
  type: "csv" | "excel" | "pdf",
  filename: string,
  title: string,
  headers: string[],
  rows: unknown[][]
) {
  if (type === "pdf") {
    downloadPdf(filename, title, headers, rows);
    return;
  }
  if (type === "excel") {
    downloadExcel(filename, headers, rows);
    return;
  }
  downloadCsv(filename, headers, rows);
}
