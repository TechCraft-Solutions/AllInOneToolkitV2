/* sys lib */
import { CommonModule } from "@angular/common";
import { Component, Input, Output, EventEmitter, HostListener } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  CdkDragDrop,
  CdkDropList,
  DragDropModule,
  CdkDrag,
  CdkDragEnd,
  CdkDragStart,
} from "@angular/cdk/drag-drop";

/* models */
import { RecObj, BodyData, BodyValue, Request } from "@models/request";

/* helpers */
import { ParsingHelper } from "@helpers/parsing.helper";

/* services */
import { ClipboardService } from "@services/clipboard.service";
import { NotifyService } from "@services/notify.service";

/* materials */
import { MatIconModule } from "@angular/material/icon";
import { MatCheckboxModule, MatCheckboxChange } from "@angular/material/checkbox";

export type TableType = "params" | "headers" | "body";

export interface DragStartData {
  item: any;
  items?: any[];
  itemType: "table-row";
  sourceInfo: {
    tableType: TableType;
    requestId?: string;
    index: number;
    indices: number[];
  };
}

@Component({
  selector: "app-editable-table",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    CdkDropList,
    MatIconModule,
    MatCheckboxModule,
  ],
  templateUrl: "./editable-table.component.html",
})
export class EditableTableComponent {
  @Input() type!: TableType;
  @Input() list: Array<RecObj | BodyData> = [];
  @Input() editingRow: number = -1;
  @Input() editingCol: string = "";
  @Input() editingObj: RecObj | BodyData | null = null;
  @Input() infoRequest: Request | null = null;
  @Input() draggedItem: any = null;
  @Input() isDragging: boolean = false;
  @Input() selectedTabIndex: number = 0;

  selectedRows: Set<number> = new Set();

  constructor(
    public clipboardService: ClipboardService,
    private notifyService: NotifyService
  ) {}

  @Output() editObj = new EventEmitter<{
    row: number;
    field: "key" | "value";
    data: RecObj | BodyData;
  }>();
  @Output() selAll = new EventEmitter<{ event: MatCheckboxChange; type: TableType }>();
  @Output() onKeyDownEvent = new EventEmitter<{
    event: KeyboardEvent;
    row: number;
    type: TableType;
    field: "key" | "value";
  }>();
  @Output() inputChangeEvent = new EventEmitter<{
    event: any;
    row: number;
    type: TableType;
    field: "key" | "value";
  }>();
  @Output() deleteRec = new EventEmitter<{ list: Array<RecObj | BodyData>; index: number }>();
  @Output() onDragStartEvent = new EventEmitter<{
    event: CdkDragStart;
    data: DragStartData;
  }>();
  @Output() onDragEndEvent = new EventEmitter<CdkDragEnd>();
  @Output() dropTableRecords = new EventEmitter<{
    event: CdkDragDrop<any>;
    type: TableType;
  }>();

  @HostListener("document:keydown", ["$event"])
  onDocumentKeyDown(event: KeyboardEvent): void {
    const isActiveTab =
      (this.type === "params" && this.selectedTabIndex === 0) ||
      (this.type === "headers" && this.selectedTabIndex === 1) ||
      (this.type === "body" && this.selectedTabIndex === 2);

    const activeElement = document.activeElement;
    const isInputFocused =
      activeElement &&
      (activeElement.tagName.toLowerCase() === "input" ||
        activeElement.tagName.toLowerCase() === "textarea");

    if (event.ctrlKey && event.key === "a" && isActiveTab && !isInputFocused) {
      event.preventDefault();
      this.selectAllItems();
    }

    if (event.ctrlKey && event.key === "c" && isActiveTab && !isInputFocused) {
      event.preventDefault();
      this.copySelectedItems();
    }

    if (event.ctrlKey && event.key === "v" && isActiveTab && !isInputFocused) {
      event.preventDefault();
      this.pasteFromClipboard();
    }

    if (event.key === "Escape" && isActiveTab && this.selectedRows.size > 0) {
      this.selectedRows.clear();
    }
  }

  onEditObj(row: number, field: "key" | "value", data: RecObj | BodyData): void {
    this.editObj.emit({ row, field, data });
  }

  onSelAll(event: MatCheckboxChange): void {
    this.selAll.emit({ event, type: this.type });
  }

  onKeyDown(event: KeyboardEvent, row: number, field: "key" | "value"): void {
    this.onKeyDownEvent.emit({ event, row, type: this.type, field });
  }

  onInputChange(event: any, row: number, field: "key" | "value"): void {
    this.inputChangeEvent.emit({ event, row, type: this.type, field });
  }

  onDeleteRec(index: number): void {
    this.deleteRec.emit({ list: this.list, index });
  }

  onDragStart(event: CdkDragStart, item: RecObj | BodyData, index: number): void {
    console.log("EditableTable onDragStart:", this.type, item);

    const selectedItems = Array.from(this.selectedRows)
      .map((i) => this.list[i])
      .filter((row) => row.key !== "");
    const isMultiSelect = selectedItems.length > 1;

    let dragData: DragStartData;

    if (isMultiSelect) {
      dragData = {
        item,
        items: selectedItems.map((row) => ({ ...row })),
        itemType: "table-row",
        sourceInfo: {
          tableType: this.type,
          requestId: this.infoRequest?.id,
          index,
          indices: selectedItems.map((_, i) =>
            this.list.findIndex((row) => row === selectedItems[i])
          ),
        },
      };
    } else {
      dragData = {
        item,
        itemType: "table-row",
        sourceInfo: {
          tableType: this.type,
          requestId: this.infoRequest?.id,
          index,
          indices: [index],
        },
      };
    }

    this.onDragStartEvent.emit({
      event,
      data: dragData,
    });
  }

  onDragEnd(event: CdkDragEnd): void {
    this.selectedRows.clear();
    this.onDragEndEvent.emit(event);
  }

  onDropTableRecords(event: CdkDragDrop<any>): void {
    console.log("EditableTable onDropTableRecords:", this.type, event);

    const isActiveTab =
      (this.type === "params" && this.selectedTabIndex === 0) ||
      (this.type === "headers" && this.selectedTabIndex === 1) ||
      (this.type === "body" && this.selectedTabIndex === 2);

    if (isActiveTab) {
      this.dropTableRecords.emit({ event, type: this.type });
    }
  }

  toggleSelection(index: number): void {
    if (this.selectedRows.has(index)) {
      this.selectedRows.delete(index);
    } else {
      this.selectedRows.add(index);
    }
  }

  getRawValue(data: any | BodyValue): string {
    return ParsingHelper.getRawValue(this.type, data);
  }

  isValuePresent(item: RecObj | BodyData): boolean {
    if (item.key === "") return false;
    if (this.type === "body") {
      return (item as BodyData).value.value !== "";
    } else {
      return (item as RecObj).value !== "";
    }
  }

  selectContent(): void {
    setTimeout(() => {
      const input = document.getElementById("editing-input") as
        | HTMLInputElement
        | HTMLTextAreaElement;
      if (input) {
        input.select();
      }
    }, 0);
  }

  private selectAllItems(): void {
    const selectableRows = this.list
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.key !== "");

    const hasUnselected = selectableRows.some(({ index }) => !this.selectedRows.has(index));

    if (hasUnselected) {
      selectableRows.forEach(({ index }) => this.selectedRows.add(index));
    } else {
      selectableRows.forEach(({ index }) => this.selectedRows.delete(index));
    }
  }

  private copySelectedItems(): void {
    if (this.selectedRows.size === 0) {
      this.notifyService.showInfo("No items selected to copy");
      return;
    }

    const selectedItems = Array.from(this.selectedRows)
      .sort((a, b) => a - b)
      .map((index) => this.list[index]);

    if (this.type === "body") {
      this.clipboardService.copyKeyValuePairs(selectedItems as BodyData[], "URL Request Body");
    } else {
      this.clipboardService.copyKeyValuePairs(
        selectedItems as RecObj[],
        `URL Request ${this.type}`
      );
    }

    this.notifyService.showSuccess(`Copied ${selectedItems.length} item(s) to clipboard`);
  }

  private pasteFromClipboard(): void {
    const clipboardData = this.clipboardService.getClipboardData();
    if (!clipboardData) {
      this.notifyService.showInfo("No data in clipboard to paste");
      return;
    }

    try {
      if (clipboardData.type === "key-value-pairs") {
        this.pasteKeyValuePairs(clipboardData.data);
      } else if (clipboardData.type === "table-rows") {
        this.pasteTableRows(clipboardData.data);
      } else {
        this.notifyService.showError("Unsupported clipboard data type");
      }
    } catch (error) {
      console.error("Paste error:", error);
      this.notifyService.showError("Failed to paste data: " + (error as Error).message);
    }
  }

  private pasteKeyValuePairs(items: (RecObj | BodyData)[]): void {
    const convertedItems = items.map((item, index) => {
      if (this.type === "body") {
        const bodyData: BodyData = {
          key: item.key,
          value: {
            type: "String",
            value: this.getItemValue(item),
          },
          isActive: item.isActive,
          position: this.list.length + index,
        };
        return bodyData;
      } else {
        const recObj: RecObj = {
          key: item.key,
          value: this.getItemValue(item),
          isActive: item.isActive,
          position: this.list.length + index,
        };
        return recObj;
      }
    });

    this.list.push(...convertedItems);

    this.notifyService.showSuccess(`Pasted ${convertedItems.length} item(s) from clipboard`);
  }

  private pasteTableRows(rows: any[]): void {
    const keyValueItems = this.clipboardService.convertTableRowsToKeyValuePairs(rows, []);

    this.pasteKeyValuePairs(keyValueItems);
  }

  private getItemValue(item: RecObj | BodyData): string {
    if ("value" in item && typeof item.value === "object" && "value" in item.value) {
      return (item as BodyData).value.value?.toString() || "";
    } else {
      return (item as RecObj).value?.toString() || "";
    }
  }
}
