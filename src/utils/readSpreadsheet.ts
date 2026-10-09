/**
 * Lightweight client-side CSV / XLSX reader for the Executive Dashboard.
 * Uses browser ZIP streams (no remote converter and no spreadsheet data upload).
 * The first row of each sheet is treated as its header.
 */
export type SheetRows = { name: string; rows: Record<string, string>[] };

function parseCSV(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row);
      row = []; field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

function toObjects(grid: string[][]): Record<string, string>[] {
  const [header, ...body] = grid;
  if (!header) return [];
  const keys = header.map(h => h.trim());
  return body.filter(r => r.some(c => c.trim())).map(r =>
    Object.fromEntries(keys.map((key, i) => [key, (r[i] ?? "").trim()])),
  );
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, "").toUpperCase();
  let value = 0;
  for (const ch of letters) value = value * 26 + ch.charCodeAt(0) - 64;
  return value - 1;
}

async function unzipXlsx(file: File): Promise<Map<string, Uint8Array>> {
  const data = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(data.buffer);
  let end = -1;
  for (let pos = data.length - 22; pos >= Math.max(0, data.length - 65557); pos--) {
    if (view.getUint32(pos, true) === 0x06054b50) { end = pos; break; }
  }
  if (end < 0) throw Error("Invalid XLSX ZIP directory");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw Error("Invalid XLSX ZIP entry");
    const compression = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 20, true);
    const nameSize = view.getUint16(offset + 28, true);
    const extraSize = view.getUint16(offset + 30, true);
    const commentSize = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = decoder.decode(data.slice(offset + 46, offset + 46 + nameSize));
    offset += 46 + nameSize + extraSize + commentSize;
    if (!/^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml|workbook\.xml)$/.test(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const compressed = data.slice(start, start + size);
    if (compression === 0) files.set(name, compressed);
    else if (compression === 8) {
      if (typeof DecompressionStream === "undefined") throw Error("XLSX decompression unavailable in this browser. Use CSV instead.");
      const stream = new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
      files.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
    } else throw Error("Unsupported XLSX compression method");
  }
  return files;
}

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw Error("Invalid XLSX XML");
  return doc;
}

export async function readSpreadsheet(file: File): Promise<SheetRows[]> {
  const filename = file.name.toLowerCase();
  if (filename.endsWith(".csv")) return [{ name: "Accounts", rows: toObjects(parseCSV(await file.text())) }];
  if (!filename.endsWith(".xlsx")) throw Error("Please upload a .csv or .xlsx file.");
  const files = await unzipXlsx(file);
  const decoder = new TextDecoder();
  const read = (name: string) => files.has(name) ? xml(decoder.decode(files.get(name))) : null;
  const shared = Array.from(read("xl/sharedStrings.xml")?.getElementsByTagName("si") ?? [])
    .map(node => Array.from(node.getElementsByTagName("t")).map(t => t.textContent ?? "").join(""));
  const sheetNames = Array.from(read("xl/workbook.xml")?.getElementsByTagName("sheet") ?? [])
    .map(s => s.getAttribute("name") ?? "Accounts");
  const sheetFiles = [...files.keys()].filter(key => /^xl\/worksheets\/sheet\d+\.xml$/.test(key))
    .sort((a, b) => Number(a.match(/sheet(\d+)/)?.[1] ?? 0) - Number(b.match(/sheet(\d+)/)?.[1] ?? 0));
  return sheetFiles.map((path, index) => {
    const doc = read(path);
    const grid = Array.from(doc?.getElementsByTagName("row") ?? []).map(row => {
      const cells: string[] = [];
      for (const cell of Array.from(row.getElementsByTagName("c"))) {
        const position = columnIndex(cell.getAttribute("r") ?? "A1");
        if (position < 0 || position > 100) continue;
        const kind = cell.getAttribute("t");
        const raw = cell.getElementsByTagName("v")[0]?.textContent ?? "";
        cells[position] = kind === "s" ? shared[Number(raw)] ?? "" :
          kind === "inlineStr" ? Array.from(cell.getElementsByTagName("t")).map(t => t.textContent ?? "").join("") : raw;
      }
      return Array.from({ length: cells.length }, (_, i) => cells[i] ?? "");
    });
    return { name: sheetNames[index] ?? "Sheet " + (index + 1), rows: toObjects(grid) };
  });
}
