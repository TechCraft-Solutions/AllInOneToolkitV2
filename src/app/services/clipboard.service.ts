/* sys lib */
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

/* models */
import { RecObj, BodyData } from "@models/request";
import { TableData } from "@models/table-data";

export interface ClipboardData {
  type: "table-rows" | "key-value-pairs";
  data: any[];
  source: string;
  timestamp: Date;
}

export interface TableRowData {
  rowIndex: number;
  columns: (string | number | boolean)[];
  headers?: string[];
}

@Injectable({
  providedIn: "root",
})
export class ClipboardService {
  private clipboardData = new BehaviorSubject<ClipboardData | null>(null);
  public clipboardData$ = this.clipboardData.asObservable();

  constructor() {}

  /**
   * Copy table rows from visualization tables (CSV, JSON, XML to table)
   */
  copyTableRows(rows: TableRowData[], headers: string[], source: string): void {
    const data: ClipboardData = {
      type: "table-rows",
      data: rows,
      source,
      timestamp: new Date(),
    };

    this.clipboardData.next(data);

    const tsvData = this.convertToTSV(rows, headers);
    this.copyToSystemClipboard(tsvData);
  }

  /**
   * Copy key-value pairs from editable tables (URL request params/headers/body)
   */
  copyKeyValuePairs(items: (RecObj | BodyData)[], source: string): void {
    const data: ClipboardData = {
      type: "key-value-pairs",
      data: items.map((item) => ({ ...item })),
      source,
      timestamp: new Date(),
    };

    this.clipboardData.next(data);

    const jsonData = JSON.stringify(items, null, 2);
    this.copyToSystemClipboard(jsonData);
  }

  /**
   * Get current clipboard data
   */
  getClipboardData(): ClipboardData | null {
    return this.clipboardData.value;
  }

  /**
   * Check if clipboard has data
   */
  hasData(): boolean {
    return this.clipboardData.value !== null;
  }

  /**
   * Clear clipboard
   */
  clear(): void {
    this.clipboardData.next(null);
  }

  /**
   * Convert table rows to key-value pairs for pasting into editable tables
   */
  convertTableRowsToKeyValuePairs(rows: TableRowData[], headers: string[]): RecObj[] {
    return rows.map((row, index) => ({
      key: row.columns[0]?.toString() || `row_${index + 1}`,
      value: row.columns[1]?.toString() || "",
      isActive: true,
      position: index,
    }));
  }

  /**
   * Convert key-value pairs to table rows for pasting into visualization tables
   */
  convertKeyValuePairsToTableRows(items: (RecObj | BodyData)[]): TableRowData[] {
    return items.map((item, index) => ({
      rowIndex: index,
      columns: [item.key, this.getItemValue(item)],
    }));
  }

  /**
   * Get value from RecObj or BodyData item
   */
  private getItemValue(item: RecObj | BodyData): string {
    if ("value" in item && typeof item.value === "object" && "value" in item.value) {
      return (item as BodyData).value.value?.toString() || "";
    } else {
      return (item as RecObj).value?.toString() || "";
    }
  }

  /**
   * Convert table rows to TSV format for system clipboard
   */
  private convertToTSV(rows: TableRowData[], headers: string[]): string {
    const lines: string[] = [];

    if (headers.length > 0) {
      lines.push(headers.join("\t"));
    }

    rows.forEach((row) => {
      lines.push(row.columns.map((col) => col?.toString() || "").join("\t"));
    });

    return lines.join("\n");
  }

  /**
   * Copy text to system clipboard
   */
  private async copyToSystemClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.warn("Failed to copy to system clipboard:", error);

      this.fallbackCopyToClipboard(text);
    }
  }

  /**
   * Fallback method for older browsers
   */
  private fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
    } catch (error) {
      console.warn("Fallback copy also failed:", error);
    }

    document.body.removeChild(textArea);
  }

  /**
   * Check if clipboard data is compatible with target type
   */
  isCompatibleWithTarget(clipboardType: string, targetType: "table" | "editable-table"): boolean {
    if (!this.hasData()) return false;

    const data = this.clipboardData.value!;
    switch (targetType) {
      case "table":
        return data.type === "table-rows" || data.type === "key-value-pairs";
      case "editable-table":
        return data.type === "key-value-pairs" || data.type === "table-rows";
      default:
        return false;
    }
  }
}
