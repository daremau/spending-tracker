/**
 * Minimal RFC 4180 style CSV helpers.
 *
 * The version 1 exporter hand-rolled quoting and split sections on blank
 * lines, which broke on any value containing a comma, a quote, or a newline.
 * These helpers quote every field and parse with a real state machine so that
 * account names and notes round-trip unchanged.
 */

export function csvField(value: string | null | undefined): string {
  const text = value ?? "";
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(values: Array<string | null | undefined>): string {
  return values.map(csvField).join(",");
}

/** Splits one CSV line into fields, honouring quotes and doubled quotes. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (inQuotes) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      fields.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

export type CsvSections = Map<string, string[][]>;

/**
 * Splits a sectioned export into `# NAME` blocks, dropping each block's header
 * row. Works for both version 1 and version 2 files.
 */
export function parseCsvSections(content: string): CsvSections {
  const sections: CsvSections = new Map();
  const lines = content.split(/\r?\n/);

  let currentName: string | null = null;
  let expectingHeader = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      currentName = line.slice(1).trim().toUpperCase();
      sections.set(currentName, []);
      expectingHeader = true;
      continue;
    }

    if (!currentName) continue;
    if (expectingHeader) {
      expectingHeader = false;
      continue;
    }

    sections.get(currentName)?.push(parseCsvLine(line));
  }

  return sections;
}

export function cell(row: string[], index: number): string {
  return row[index] ?? "";
}

export function optionalCell(row: string[], index: number): string | null {
  const value = cell(row, index);
  return value === "" ? null : value;
}

export function booleanCell(row: string[], index: number, fallback = true) {
  const value = cell(row, index).toLowerCase();
  if (value === "") return fallback;
  return value === "true" || value === "1" || value === "yes";
}
