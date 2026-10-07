// قراءة قائمة المودمات من ملف إكسل/CSV أو من نص ملصوق من إكسل.
// الأعمدة تُعرف بأسمائها: PROD ID و SN و MAC (وعمود # للترقيم يُهمل لأن النظام يرقّم بنفسه).

export type ImportItem = { code: string; prod_id: string; sn: string; mac: string };

type Field = "prod_id" | "sn" | "mac";

const HEADER_NAMES: Record<string, Field> = {
  prodid: "prod_id",
  productid: "prod_id",
  prod: "prod_id",
  sn: "sn",
  serial: "sn",
  serialno: "sn",
  serialnumber: "sn",
  mac: "mac",
  macaddress: "mac",
};

function normalizeHeader(cell: string) {
  return cell.toLowerCase().replace(/[\s_.\-#/]/g, "");
}

/** CSV text into rows, understanding quotes. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.map((r) => r.map((c) => c.trim()));
}

/** Rows into modems. A header row with PROD ID / SN / MAC is found by name; without one, the first cell of each row is the code. */
export function rowsToItems(rows: string[][]): { items: ImportItem[]; hasHeader: boolean } {
  let headerAt = -1;
  const columns: Partial<Record<Field, number>> = {};

  for (let i = 0; i < Math.min(rows.length, 5) && headerAt < 0; i += 1) {
    const found: Partial<Record<Field, number>> = {};

    rows[i].forEach((cell, index) => {
      const field = HEADER_NAMES[normalizeHeader(cell)];
      if (field && found[field] === undefined) found[field] = index;
    });

    if (Object.keys(found).length > 0) {
      headerAt = i;
      Object.assign(columns, found);
    }
  }

  const items: ImportItem[] = [];

  if (headerAt >= 0) {
    for (const row of rows.slice(headerAt + 1)) {
      const prod_id = columns.prod_id !== undefined ? (row[columns.prod_id] ?? "") : "";
      const sn = columns.sn !== undefined ? (row[columns.sn] ?? "") : "";
      const mac = columns.mac !== undefined ? (row[columns.mac] ?? "") : "";
      const code = sn || prod_id || mac;

      if (code) items.push({ code, prod_id, sn, mac });
    }
    return { items, hasHeader: true };
  }

  for (const row of rows) {
    const code = row.find((cell) => cell !== "") ?? "";
    if (code) items.push({ code, prod_id: "", sn: "", mac: "" });
  }
  return { items, hasHeader: false };
}

/** Pasted text: tab separated (from Excel), comma separated (CSV), or one code per line. */
export function parseText(text: string) {
  const delimiter = text.includes("\t") ? "\t" : /^[^\n]*,/.test(text) ? "," : "\u0000";
  return rowsToItems(parseDelimited(text, delimiter));
}

export function rowsToTabText(rows: string[][]) {
  return rows.map((row) => row.map((cell) => cell.replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
}

export const templateCsv = "\uFEFF#,PROD ID,SN,MAC\r\n1,2150089532HYS3009716,48575443FD3322B8,28808A5FE2E1\r\n";
