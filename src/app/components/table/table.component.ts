/* sys lib */
import { CommonModule } from "@angular/common";
import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from "@angular/core";

/* materials */
import { MatExpansionModule } from "@angular/material/expansion";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";

/* services */
import { ClipboardService, TableRowData } from "@services/clipboard.service";
import { NotifyService } from "@services/notify.service";

/* models */
import { TableData } from "@models/table-data";

@Component({
  selector: "app-table",
  standalone: true,
  imports: [CommonModule, MatExpansionModule, MatIconModule, MatButtonModule, MatCheckboxModule],
  templateUrl: "./table.component.html",
})
export class TableComponent {
  constructor(
    private clipboardService: ClipboardService,
    private notifyService: NotifyService,
    private elementRef: ElementRef
  ) {}

  @Input() dataTable: TableData = {
    thead: [],
    tbody: [],
  };

  @Input() index: number = 0;
  @Input() source: string = "Table";

  @Output() rowsCopied = new EventEmitter<TableRowData[]>();

  selectedRows: Set<number> = new Set();
  showSelection: boolean = false;

  isString(cell: any) {
    return typeof cell === "string";
  }

  isTable(cell: any) {
    return typeof cell == "object" && cell !== null;
  }

  getColorBackground(index: number) {}

  @HostListener("document:keydown", ["$event"])
  onDocumentKeyDown(event: KeyboardEvent): void {
    if (this.dataTable.tbody.length === 0) return;

    const activeElement = document.activeElement;
    const isInputFocused =
      activeElement &&
      (activeElement.tagName.toLowerCase() === "input" ||
        activeElement.tagName.toLowerCase() === "textarea");

    if (isInputFocused) return;

    const tableElement = this.elementRef?.nativeElement as HTMLElement;
    if (!tableElement || tableElement.offsetParent === null) return;

    if (event.ctrlKey && event.key === "a") {
      event.preventDefault();
      this.selectAllRows();
    } else if (event.ctrlKey && event.key === "c") {
      event.preventDefault();
      this.copySelectedRows();
    }
  }

  toggleRowSelection(rowIndex: number): void {
    if (this.selectedRows.has(rowIndex)) {
      this.selectedRows.delete(rowIndex);
    } else {
      this.selectedRows.add(rowIndex);
    }

    this.updateSelectionMode();
  }

  selectAllRows(): void {
    const selectableRows = this.dataTable.tbody
      .map((_, index) => index)
      .filter((index) => this.isRowSelectable(index));

    const hasUnselected = selectableRows.some((index) => !this.selectedRows.has(index));

    if (hasUnselected) {
      selectableRows.forEach((index) => this.selectedRows.add(index));
    } else {
      selectableRows.forEach((index) => this.selectedRows.delete(index));
    }

    this.updateSelectionMode();
  }

  isRowSelectable(rowIndex: number): boolean {
    const row = this.dataTable.tbody[rowIndex];

    return row.some((cell) => this.isString(cell) && cell.trim() !== "");
  }

  private updateSelectionMode(): void {
    this.showSelection = this.selectedRows.size > 0;
  }

  copySelectedRows(): void {
    if (this.selectedRows.size === 0) {
      this.notifyService.showInfo("No rows selected to copy");
      return;
    }

    try {
      const selectedData: TableRowData[] = Array.from(this.selectedRows)
        .sort((a, b) => a - b)
        .map((rowIndex) => ({
          rowIndex,
          columns: this.dataTable.tbody[rowIndex].map((cell) =>
            this.isString(cell) ? cell : "[Nested Table]"
          ),
          headers: this.dataTable.thead,
        }));

      this.clipboardService.copyTableRows(selectedData, this.dataTable.thead, this.source);
      this.notifyService.showSuccess(`Copied ${selectedData.length} row(s) to clipboard`);
      this.rowsCopied.emit(selectedData);
    } catch (error) {
      console.error("Error copying rows:", error);
      this.notifyService.showError("Failed to copy rows: " + (error as Error).message);
    }
  }

  clearSelection(): void {
    this.selectedRows.clear();
    this.showSelection = false;
  }

  isRowSelected(rowIndex: number): boolean {
    return this.selectedRows.has(rowIndex);
  }

  getSelectedCount(): number {
    return this.selectedRows.size;
  }

  isAllSelected(): boolean {
    const selectableRows = this.dataTable.tbody
      .map((_, index) => index)
      .filter((index) => this.isRowSelectable(index));
    return selectableRows.length > 0 && this.selectedRows.size === selectableRows.length;
  }

  isIndeterminate(): boolean {
    const selectableRows = this.dataTable.tbody
      .map((_, index) => index)
      .filter((index) => this.isRowSelectable(index));
    return this.selectedRows.size > 0 && this.selectedRows.size < selectableRows.length;
  }
}
