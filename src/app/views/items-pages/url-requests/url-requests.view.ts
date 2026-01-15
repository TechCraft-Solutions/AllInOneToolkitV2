/* sys lib */
import { CommonModule } from "@angular/common";
import { Component, OnInit, Input, HostListener, ChangeDetectorRef } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
  CdkDragDrop,
  CdkDragStart,
  CdkDragEnd,
  DragDropModule,
  CdkDropList,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { v4 as UUID } from "uuid";
import { confirm } from "@tauri-apps/plugin-dialog";

/* material */
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatSelectModule } from "@angular/material/select";
import { MatTabsModule } from "@angular/material/tabs";
import { MatIconModule } from "@angular/material/icon";
import { MatCheckboxModule, MatCheckboxChange } from "@angular/material/checkbox";

/* helpers */
import { ParsingHelper } from "@helpers/parsing.helper";

/* models */
import { Response, ResponseStatus } from "@models/response";
import { Collection } from "@models/collection";
import { UndoItem } from "@models/undo_item";
import {
  BodyData,
  BodyValue,
  RecObj,
  Request,
  RequestResponse,
  TypeRequest,
} from "@models/request";

/* services */
import { UrlRequestsService } from "@services/url-requests.service";
import { NotifyService } from "@services/notify.service";

/* components */
import { JsonParserComponent } from "@components/json-parser/json-parser.component";
import { EditableTableComponent } from "@components/editable-table/editable-table.component";
import { ResponseTabComponent } from "@components/response-tab/response-tab.component";

@Component({
  selector: "app-url-requests",
  standalone: true,
  providers: [UrlRequestsService],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatExpansionModule,
    MatSelectModule,
    MatTabsModule,
    MatIconModule,
    MatCheckboxModule,
    DragDropModule,
    CdkDropList,
    EditableTableComponent,
    ResponseTabComponent,
  ],
  templateUrl: "./url-requests.view.html",
})
export class UrlRequestsView implements OnInit {
  constructor(
    private urlRequestsService: UrlRequestsService,
    private notifyService: NotifyService,
    private cdr: ChangeDetectorRef
  ) {}

  widthLeftSidebar: number = 300;
  widthRightSidebar: number = 0;
  isResizing = false;

  savedListCollections: Array<Collection> = [];
  listCollections: Array<Collection> = [];
  listTypesRequest: Array<{ title: string; color: string }> = [];
  colorTypeRequest = {
    [TypeRequest.GET]: "text-green-500",
    [TypeRequest.POST]: "text-yellow-500 dark:text-yellow-300",
    [TypeRequest.PUT]: "text-blue-500",
    [TypeRequest.DEL]: "text-red-500",
  };
  typeEditorData: { headers: "table" | "json"; body: "table" | "json"; params: "table" | "json" } =
    {
      headers: "table",
      body: "table",
      params: "table",
    };

  prevTitleCollection: string = "";
  prevTitleRequest: string = "";

  infoCollection: Collection | null = null;
  infoRequest: Request | null = null;

  editingObj: RecObj | BodyData | null = null;
  editingCol: string = "";
  editingRow: number = -1;

  draggedItem: {
    type: "table-row" | "request" | "collection";
    data: any;
    source: { collectionId?: string; requestId?: string; tableType?: string; index?: number };
  } | null = null;
  isDragging: boolean = false;
  hoveredCollectionId: string | null = null;
  hoveredRequestId: string | null = null;
  targetTabType: string | null = null;
  targetRequest: Request | null = null;

  undoStack: UndoItem[] = [];

  selectedTabIndex: number = 0;
  response: string = "";
  currentResponseId: string = "";
  isResponseCollapsed: boolean = false;
  windowInnerWidth: number = 0;

  isShowSidebar: boolean = false;

  isJsonAsString = ParsingHelper.isJsonAsString;
  isHTML = ParsingHelper.isHTML;
  isXML = ParsingHelper.isXML;

  ngOnInit(): void {
    document.addEventListener("mousedown", (e: any) => {
      if (
        e.target.tagName.toLowerCase() !== "input" &&
        e.target.tagName.toLowerCase() !== "textarea"
      ) {
        this.editingCol = "";
        this.editingRow = -1;
        this.editingObj = null;
      }
    });

    document.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "z") {
        event.preventDefault();
        this.undo();
      }
      if (event.ctrlKey && event.key === "s" && this.infoRequest) {
        event.preventDefault();
        this.saveData();
      }
    });

    this.widthRightSidebar = window.innerWidth - 300;
    this.windowInnerWidth = window.innerWidth;
    setInterval(() => {
      this.windowInnerWidth = window.innerWidth;
      this.widthRightSidebar = window.innerWidth - this.widthLeftSidebar - 10;
    }, 500);

    if (window.innerWidth > 768) {
      this.isShowSidebar = true;
    } else {
      this.isShowSidebar = false;
    }

    Object.entries(this.colorTypeRequest).forEach((item) => {
      this.listTypesRequest.push({ title: item[0], color: item[1] });
    });

    this.urlRequestsService
      .getData<Array<any>>()
      .then((response: Response<Array<any>>) => {
        if (response.status == ResponseStatus.SUCCESS) {
          this.savedListCollections = response.data;
          // Initialize positions for existing data
          this.initializePositions(this.savedListCollections);
          this.listCollections = this.savedListCollections;
        } else {
          this.notifyService.showError("Failed to load data");
        }
      })
      .catch((err: Response<string>) => {
        this.notifyService.showError(err.message ?? err.toString());
      });
  }

  onMouseDown(event: MouseEvent): void {
    this.isResizing = true;
    event.preventDefault();
  }

  @HostListener("document:mousemove", ["$event"])
  onMouseMove(event: MouseEvent): void {
    if (this.isResizing) {
      if (event.clientX <= 700) {
        this.widthLeftSidebar = Math.max(200, event.clientX);
      }
      this.widthRightSidebar = window.innerWidth - this.widthLeftSidebar;
    }
  }

  @HostListener("document:mouseup")
  onMouseUp(): void {
    this.isResizing = false;
  }

  dropCollections(event: CdkDragDrop<string[]>) {
    const prevElement = this.listCollections[event.previousIndex];
    this.listCollections.splice(event.previousIndex, 1);
    this.listCollections.splice(event.currentIndex, 0, prevElement);
    this.saveData();
  }

  dropRequests(event: CdkDragDrop<string[]>, indexCollection: number) {
    // Check if we're dropping a table row onto a request
    if (this.draggedItem && this.draggedItem.type === "table-row") {
      if (this.hoveredRequestId) {
        const targetRequest = this.listCollections[indexCollection].requests.find(
          (r) => r.id === this.hoveredRequestId
        );
        if (targetRequest) {
          this.handleTableRowDropOnRequest(targetRequest, this.draggedItem);
        }
      }
      return;
    }

    // Original request reordering logic
    const prevElement = this.listCollections[indexCollection].requests[event.previousIndex];
    this.listCollections[indexCollection].requests.splice(event.previousIndex, 1);
    this.listCollections[indexCollection].requests.splice(event.currentIndex, 0, prevElement);
    this.saveData();
  }

  setTitle(event: any, typeData: "collection" | "request", data: any) {
    if (event.key == "Enter") {
      if (typeData == "collection") {
        this.confirmRenameCollection(event, data);
      } else if (typeData == "request") {
        this.confirmRenameRequest(event, data);
      }
    } else if (event.key == "Escape") {
      if (typeData == "collection") {
        this.cancelRenameCollection(event, data);
      } else if (typeData == "request") {
        this.cancelRenameRequest(event, data);
      }
    }
  }

  setUrl(event: any) {
    if (event.key == "Enter") {
      this.saveData();
    }
  }

  isSaved(): boolean {
    if (this.infoRequest) {
      const idReq = this.infoRequest.id;
      const savedRequest = () => {
        for (let collection of this.savedListCollections) {
          const request = collection.requests.find((req) => req.id === idReq);
          if (request) {
            return request;
          }
        }
        return null;
      };

      if (savedRequest()) {
        return JSON.stringify(savedRequest()) == JSON.stringify(this.infoRequest);
      }
    }

    return false;
  }

  createCollection() {
    const collection: Collection = {
      id: UUID(),
      title: `New collection ${this.listCollections.length + 1}`,
      editTitle: false,
      expanded: false,
      requests: [],
    };
    this.listCollections.push(collection);

    this.saveData();
  }

  toggleExpansion(coll: Collection) {
    coll.expanded = !coll.expanded;
  }

  renameCollection(coll: Collection) {
    coll.editTitle = true;
    this.prevTitleCollection = coll.title;
  }

  confirmRenameCollection(event: any, coll: Collection) {
    event.stopPropagation();
    event.preventDefault();
    this.undoStack.push({
      type: "collectionTitle",
      oldValue: coll.title,
      newValue: this.prevTitleCollection,
      collectionId: coll.id,
    });
    coll.editTitle = false;
    coll.title = this.prevTitleCollection;
    this.prevTitleCollection = "";

    this.saveData();
  }

  cancelRenameCollection(event: any, coll: Collection) {
    event.stopPropagation();
    event.preventDefault();
    coll.editTitle = false;
    this.prevTitleCollection = "";
  }

  async deleteCollection(index: number) {
    const confirmed = await confirm(
      `Are you sure you want to delete the collection "${this.listCollections[index].title}"? This action cannot be undone.`,
      {
        title: "Delete Collection",
      }
    );
    if (!confirmed) return;

    this.listCollections.splice(index, 1);
    this.infoCollection = null;
    this.infoRequest = null;

    this.saveData();
  }

  createRequest(coll: Collection) {
    const request: Request = {
      id: UUID(),
      title: `New request ${coll.requests.length + 1}`,
      editTitle: false,
      typeReq: TypeRequest.GET,
      url: "",
      params: [{ key: "", value: "", isActive: false, position: 0 }],
      headers: [
        { key: "Accept", value: "*/*", isActive: true, position: 0 },
        { key: "Accept-Encoding", value: "utf-8", isActive: false, position: 1 },
        { key: "Content-Type", value: "application/json", isActive: true, position: 2 },
        { key: "Connection", value: "keep-alive", isActive: true, position: 3 },
        {
          key: "User-Agent",
          value: "PostmanRuntime/7.43.0",
          isActive: true,
          position: 4,
        },
        { key: "", value: "", isActive: false, position: 5 },
      ],
      body: [{ key: "", value: { type: "String", value: "" }, isActive: false, position: 0 }],
      responses: [],
    };
    coll.requests.push(request);

    this.infoCollection = coll;
    this.infoRequest = coll.requests[coll.requests.length - 1];

    this.saveData();
  }

  renameRequest(req: Request) {
    req.editTitle = true;
    this.prevTitleRequest = req.title;
  }

  confirmRenameRequest(event: any, req: Request) {
    event.preventDefault();
    this.undoStack.push({
      type: "requestTitle",
      oldValue: req.title,
      newValue: this.prevTitleRequest,
      requestId: req.id,
    });
    req.editTitle = false;
    req.title = this.prevTitleRequest;
    this.prevTitleRequest = "";

    this.saveData();
  }

  cancelRenameRequest(event: any, req: Request) {
    event.preventDefault();
    req.editTitle = false;
    this.prevTitleRequest = "";
  }

  async deleteRequest(coll: Collection, index: number) {
    const confirmed = await confirm(
      `Are you sure you want to delete the request "${coll.requests[index].title}"? This action cannot be undone.`,
      {
        title: "Delete Request",
      }
    );
    if (!confirmed) return;

    coll.requests.splice(index, 1);
    this.infoRequest = null;

    this.saveData();
  }

  deleteRec(list: Array<RecObj>, index: number) {
    list.splice(index, 1);
    if (list.length == 0) {
      list.push({
        key: "",
        value: "",
        isActive: false,
        position: 0,
      });
    }
  }

  onDragStart(
    event: CdkDragStart,
    item: any,
    itemType: "table-row" | "request" | "collection",
    sourceInfo: any
  ) {
    console.log("Parent onDragStart:", itemType, sourceInfo);
    this.isDragging = true;
    this.draggedItem = {
      type: itemType,
      data: JSON.parse(JSON.stringify(item)), // Deep copy to avoid reference issues
      source: sourceInfo,
    };
    console.log("Set draggedItem:", this.draggedItem);
  }

  onDragEnd(event: CdkDragEnd) {
    console.log("Parent onDragEnd, scheduling draggedItem clear");
    this.isDragging = false;
    // Delay clearing draggedItem to ensure drop events are processed first
    setTimeout(() => {
      this.draggedItem = null;
      this.hoveredCollectionId = null;
      this.hoveredRequestId = null;
      this.targetTabType = null;
      this.targetRequest = null;
    }, 100);
  }

  handleTableRowDropOnRequest(targetRequest: Request, draggedItem: any) {
    if (!draggedItem || draggedItem.type !== "table-row") return;

    const itemsToInsert = draggedItem.data.items || [draggedItem.data];
    const sourceTableType = draggedItem.source.tableType;
    const targetTableType = draggedItem.source.tableType; // This is set by the caller

    // Validation: Prevent incompatible drops
    if (
      (sourceTableType === "body" && targetTableType !== "body") ||
      (sourceTableType !== "body" && targetTableType === "body")
    ) {
      this.notifyService.showError(`Cannot drop ${sourceTableType} item to ${targetTableType} tab`);
      return;
    }

    const targetArray = (targetRequest as any)[targetTableType];
    if (!targetArray) return;

    // Handle multiple items
    const convertedItems = itemsToInsert.map((item: any) => {
      // Deep clone the item to avoid reference issues
      const clonedItem = JSON.parse(JSON.stringify(item));

      // Convert value if necessary
      if (targetTableType === "body" && sourceTableType !== "body") {
        clonedItem.value = { type: "String", value: clonedItem.value };
      } else if (targetTableType !== "body" && sourceTableType === "body") {
        clonedItem.value = ParsingHelper.getRawValue("body", clonedItem.value);
      }

      return clonedItem;
    });

    // Add all items to the target request's table
    targetArray.push(...convertedItems);

    // Remove the empty row if it exists
    const emptyIndex = targetArray.findIndex((row: any) => row.key === "");
    if (emptyIndex !== -1) {
      targetArray.splice(emptyIndex, 1);
    }

    // Add back an empty row
    if (targetTableType === "body") {
      targetArray.push({ key: "", value: { type: "String", value: "" }, isActive: false });
    } else {
      targetArray.push({ key: "", value: "", isActive: false });
    }

    this.cdr.detectChanges();

    // Switch to the target request if it's different from current
    if (targetRequest.id !== this.infoRequest?.id) {
      const collection = this.listCollections.find((coll) =>
        coll.requests.some((req) => req.id === targetRequest.id)
      );
      if (collection) {
        this.getInfo(collection, targetRequest);
      }
    }

    this.saveData();
  }

  handleTabDrop(event: CdkDragDrop<any>, targetTableType: string) {
    if (this.draggedItem && this.draggedItem.type === "table-row") {
      const targetRequest = this.infoRequest; // Always drop to current request
      if (targetRequest) {
        // Copy the dragged item to the target table
        this.handleTableRowDropOnRequest(targetRequest, {
          ...this.draggedItem,
          source: { ...this.draggedItem.source, tableType: targetTableType },
        });

        // Switch to the target tab after drop
        let targetTabIndex = -1;
        switch (targetTableType) {
          case "params":
            targetTabIndex = 0;
            break;
          case "headers":
            targetTabIndex = 1;
            break;
          case "body":
            targetTabIndex = 2;
            break;
        }
        if (targetTabIndex !== -1) {
          this.selectedTabIndex = targetTabIndex;
        }
      }
    }
  }

  handleCollectionDrop(event: CdkDragDrop<any>, targetCollection: Collection) {
    if (this.draggedItem && this.draggedItem.type === "table-row") {
      // Create a new request in the target collection with the dragged items
      const newRequest: Request = {
        id: UUID(),
        title: `New request ${targetCollection.requests.length + 1}`,
        editTitle: false,
        typeReq: TypeRequest.POST,
        url: "",
        params: [],
        headers: [
          { key: "Accept", value: "*/*", isActive: true, position: 0 },
          { key: "Content-Type", value: "application/json", isActive: true, position: 1 },
        ],
        body: [],
        responses: [],
      };

      // Add the dragged items to the appropriate table
      const itemsToInsert = this.draggedItem.data.items || [this.draggedItem.data];
      const sourceTableType = this.draggedItem.source.tableType;

      if (sourceTableType === "params") {
        newRequest.params.push(
          ...itemsToInsert.map((item: any, index: number) => ({
            ...JSON.parse(JSON.stringify(item)),
            position: index,
          }))
        );
        newRequest.params.push({
          key: "",
          value: "",
          isActive: false,
          position: newRequest.params.length,
        });
      } else if (sourceTableType === "headers") {
        newRequest.headers.push(
          ...itemsToInsert.map((item: any, index: number) => ({
            ...JSON.parse(JSON.stringify(item)),
            position: index,
          }))
        );
        newRequest.headers.push({
          key: "",
          value: "",
          isActive: false,
          position: newRequest.headers.length,
        });
      } else if (sourceTableType === "body") {
        newRequest.body.push(
          ...itemsToInsert.map((item: any, index: number) => ({
            ...JSON.parse(JSON.stringify(item)),
            position: index,
          }))
        );
        newRequest.body.push({
          key: "",
          value: { type: "String", value: "" },
          isActive: false,
          position: newRequest.body.length,
        });
      }

      targetCollection.requests.push(newRequest);
      this.getInfo(targetCollection, newRequest);
      this.saveData();
    }
  }

  onCollectionHover(collection: Collection) {
    if (this.isDragging) {
      this.hoveredCollectionId = collection.id;
    }
  }

  onCollectionLeave(collection: Collection) {
    if (this.hoveredCollectionId === collection.id) {
      this.hoveredCollectionId = null;
    }
  }

  onTabHover(tabType: string) {
    if (this.isDragging) {
      this.targetTabType = tabType;
      const index = tabType === "params" ? 0 : tabType === "headers" ? 1 : 2;
      setTimeout(() => {
        this.selectedTabIndex = index;
        this.cdr.detectChanges();
        this.cdr.markForCheck();
      }, 200);
    }
  }

  onRequestHover(request: Request) {
    this.hoveredRequestId = request.id;
    if (this.isDragging) {
      this.targetRequest = request;
      setTimeout(() => {
        const collection = this.listCollections.find((coll) =>
          coll.requests.some((req) => req.id === request.id)
        );
        if (collection) {
          this.getInfo(collection, request);
        }
      }, 200);
    }
  }

  onRequestLeave(request: Request) {
    if (this.hoveredRequestId === request.id) {
      this.hoveredRequestId = null;
      // Don't clear preview here - let request area handle it
      if (this.isDragging) {
        this.cdr.markForCheck();
      }
    }
  }

  dropTableRecords(event: CdkDragDrop<any>, type: string) {
    console.log("dropTableRecords called:", { type, draggedItem: this.draggedItem, event });

    if (this.draggedItem && this.draggedItem.type === "table-row" && this.infoRequest) {
      const sourceTableType = this.draggedItem.source.tableType;
      const itemsToMove = this.draggedItem.data.items || [this.draggedItem.data];

      const isSameContainer = event.previousContainer === event.container;

      console.log("Drop analysis:", {
        sourceTableType,
        type,
        isSameContainer,
        previousContainerId: event.previousContainer?.id,
        containerId: event.container?.id,
        itemsToMoveCount: itemsToMove.length,
        previousIndex: event.previousIndex,
        currentIndex: event.currentIndex,
      });

      // For same-container operations, handle reordering
      if (isSameContainer && sourceTableType === type) {
        const sourceArray = this.infoRequest[
          sourceTableType as keyof typeof this.infoRequest
        ] as any[];

        console.log(
          `Reordering ${type}: moved from index ${event.previousIndex} to ${event.currentIndex}`
        );

        if (itemsToMove.length === 1) {
          // Single item reorder - use CDK's moveItemInArray
          moveItemInArray(sourceArray, event.previousIndex, event.currentIndex);
        } else {
          // Multi-item reorder within same table
          this.handleMultiItemReorder(itemsToMove, event.currentIndex, type);
        }

        // Update positions after reordering
        this.updatePositions(sourceArray);
        console.log(
          `${type} positions updated:`,
          sourceArray.map((item) => ({ key: item.key, position: item.position }))
        );
      } else {
        // Cross-table or cross-request move
        const targetRequest = this.targetRequest || this.infoRequest;
        const targetType = this.targetTabType || type;
        const targetArray = targetRequest[targetType as keyof typeof targetRequest] as any[];

        // Convert items for insertion
        const convertedItems = itemsToMove.map((item: any) => {
          const clonedItem = JSON.parse(JSON.stringify(item));

          // Convert value if necessary
          if (targetType === "body" && sourceTableType !== "body") {
            clonedItem.value = { type: "String", value: clonedItem.value };
          } else if (targetType !== "body" && sourceTableType === "body") {
            clonedItem.value = ParsingHelper.getRawValue("body", clonedItem.value);
          }

          return clonedItem;
        });

        // Insert all items at the drop position
        targetArray.splice(event.currentIndex, 0, ...convertedItems);

        console.log(
          `Moving ${convertedItems.length} items from ${sourceTableType} to ${targetType} at position ${event.currentIndex}`
        );

        // Update positions for the inserted items
        for (let i = 0; i < convertedItems.length; i++) {
          convertedItems[i].position = event.currentIndex + i;
        }

        // Update positions for items after the insertion point
        for (let i = event.currentIndex + convertedItems.length; i < targetArray.length; i++) {
          targetArray[i].position = i;
        }

        console.log(
          `${targetType} positions updated after insertion:`,
          targetArray.map((item) => ({ key: item.key, position: item.position }))
        );

        // Remove items from source
        if (sourceTableType) {
          this.removeItemsFromSource(itemsToMove, sourceTableType);
          // Update source positions after removal
          const sourceArray = this.infoRequest[
            sourceTableType as keyof typeof this.infoRequest
          ] as any[];
          this.updatePositions(sourceArray);
          console.log(
            `${sourceTableType} positions updated after removal:`,
            sourceArray.map((item) => ({ key: item.key, position: item.position }))
          );
        }

        // Clean up target array
        this.cleanupTargetArray(targetArray, targetType, event.currentIndex, convertedItems.length);

        // Switch to the target
        if (this.targetRequest) {
          const collection = this.listCollections.find((coll) =>
            coll.requests.some((req) => req.id === this.targetRequest!.id)
          );
          if (collection) {
            this.getInfo(collection, this.targetRequest!);
          }
          this.targetRequest = null;
        }
        if (this.targetTabType) {
          const index =
            this.targetTabType === "params" ? 0 : this.targetTabType === "headers" ? 1 : 2;
          this.selectedTabIndex = index;
          this.targetTabType = null;
        }
      }

      this.cdr.detectChanges();
      this.saveData();
    }
  }

  private handleMultiItemReorder(itemsToMove: any[], targetIndex: number, type: string) {
    if (!this.infoRequest || !this.draggedItem) return;

    const sourceArray = this.infoRequest[type as keyof typeof this.infoRequest] as any[];

    // Get the indices of selected items, sorted in ascending order
    const indicesToRemove: number[] = ((this.draggedItem.source as any).indices || [])
      .slice()
      .sort((a: number, b: number) => a - b);

    if (indicesToRemove.length === 0) return;

    // Remove items from source array (in reverse order to maintain indices)
    const removedItems: any[] = [];
    indicesToRemove
      .slice()
      .reverse()
      .forEach((index: number) => {
        if (index < sourceArray.length) {
          removedItems.unshift(sourceArray.splice(index, 1)[0]);
        }
      });

    // Calculate the correct insertion index
    // Count how many removed items were before the target index
    let insertIndex = targetIndex;
    const itemsRemovedBeforeTarget = indicesToRemove.filter(
      (index: number) => index < targetIndex
    ).length;
    insertIndex -= itemsRemovedBeforeTarget;

    // Ensure insert index is within bounds
    insertIndex = Math.max(0, Math.min(insertIndex, sourceArray.length));

    // Insert items at the calculated position
    sourceArray.splice(insertIndex, 0, ...removedItems);
  }

  private removeItemsFromSource(itemsToMove: any[], sourceTableType: string) {
    if (!this.infoRequest) return;

    const sourceArray = this.infoRequest[sourceTableType as keyof typeof this.infoRequest] as any[];

    // Remove items that match the dragged items (in reverse order)
    const indicesToRemove: number[] = [];
    itemsToMove.forEach((item: any) => {
      const index = sourceArray.findIndex(
        (srcItem: any) =>
          srcItem.key === item.key && JSON.stringify(srcItem.value) === JSON.stringify(item.value)
      );
      if (index !== -1) {
        indicesToRemove.push(index);
      }
    });

    indicesToRemove.sort((a, b) => b - a); // Remove from highest index first
    indicesToRemove.forEach((index) => {
      sourceArray.splice(index, 1);
    });
  }

  private cleanupTargetArray(
    targetArray: any[],
    targetType: string,
    insertIndex: number,
    insertedCount: number
  ) {
    // Remove empty row if it exists and is after the insert
    const emptyIndex = targetArray.findIndex((row: any) => row.key === "");
    if (emptyIndex !== -1 && emptyIndex > insertIndex + insertedCount - 1) {
      targetArray.splice(emptyIndex, 1);
    }

    // Ensure empty row at end
    if (!targetArray.some((row: any) => row.key === "")) {
      if (targetType === "body") {
        targetArray.push({
          key: "",
          value: { type: "String", value: "" },
          isActive: false,
          position: targetArray.length,
        });
      } else {
        targetArray.push({ key: "", value: "", isActive: false, position: targetArray.length });
      }
    }
  }

  getList(typeData: "params" | "headers" | "body"): Array<RecObj | BodyData> {
    const targetRequest = this.infoRequest;
    if (targetRequest) {
      return (targetRequest as any)[typeData] || [];
    }

    return [];
  }

  getRawBodyForRequest(request?: Request): string {
    const targetRequest = request || this.infoRequest;
    return targetRequest ? ParsingHelper.convertKeyValueToJson(targetRequest.body, "body") : "{}";
  }

  createObj(typeObj: "params" | "headers" | "body") {
    if (this.infoRequest) {
      switch (typeObj) {
        case "params":
        case "headers":
          this.infoRequest[typeObj].push({
            key: "",
            value: "",
            isActive: false,
            position: this.infoRequest[typeObj].length,
          });
          break;
        case "body":
          this.infoRequest[typeObj].push({
            key: "",
            value: { type: "String", value: "" },
            isActive: false,
            position: this.infoRequest[typeObj].length,
          });
          break;
        default:
          break;
      }
    }
  }

  editObj(row: number, field: "key" | "value", data: RecObj) {
    this.editingRow = row;
    this.editingCol = field;
    this.editingObj = data;
  }

  selAll(event: MatCheckboxChange, typeObj: "params" | "headers" | "body") {
    if (this.infoRequest) {
      this.infoRequest[typeObj].forEach((rec) => (rec.isActive = event.checked));
    }
  }

  onKeyDown(
    event: KeyboardEvent,
    row: number,
    typeObj: "params" | "headers" | "body",
    field: "key" | "value"
  ) {
    if (event.key === "Tab") {
      event.preventDefault();
      this.navigateToNextCell(typeObj, row, field);
    }
  }

  navigateToNextCell(typeObj: "params" | "headers" | "body", row: number, field: "key" | "value") {
    const list = this.getList(typeObj);
    let nextRow = row;
    let nextField = field;

    if (typeObj === "body") {
      // For body, only value field, so move to next row's value
      nextRow = (row + 1) % list.length;
      nextField = "value";
    } else {
      // For params and headers, key -> value -> next row's key
      if (field === "key") {
        nextField = "value";
      } else {
        nextRow = (row + 1) % list.length;
        nextField = "key";
      }
    }

    // Start editing the next cell
    const nextItem = list[nextRow];
    if (nextItem) {
      this.editObj(nextRow, nextField, nextItem);
    }
  }

  selectContent() {
    setTimeout(() => {
      const input = document.getElementById("editing-input") as
        | HTMLInputElement
        | HTMLTextAreaElement;
      if (input) {
        input.select();
      }
    }, 0);
  }

  inputChange(
    event: any,
    row: number,
    typeObj: "params" | "headers" | "body",
    field: "key" | "value"
  ) {
    if (this.editingObj) {
      const oldVal = this.editingObj[field];
      if (field == "value" && typeObj == "body") {
        this.editingObj[field] = this.parseBodyValue(event.target.value);
      } else {
        this.editingObj[field] = event.target.value;
      }

      this.undoStack.push({
        type: typeObj.slice(0, -1) as "param" | "header" | "body",
        oldValue: oldVal,
        newValue: this.editingObj[field],
        index: row,
        field,
        requestId: this.infoRequest!.id,
      });

      if (this.infoRequest) {
        if (this.infoRequest[typeObj].findIndex((rec) => rec.key == "") == -1) {
          this.createObj(typeObj);
        }
        this.infoRequest[typeObj][row][field] = this.editingObj[field];
        if (field == "key") {
          this.infoRequest[typeObj][row].isActive = true;
        }
      }
    }
  }

  parseUrl() {
    if (this.infoRequest && this.infoRequest.url != "") {
      if (this.infoRequest.url.indexOf("http") == -1) {
        this.infoRequest.url = "http://" + this.infoRequest.url;
      }
      const url = new URL(this.infoRequest.url);
      if (url.search !== "") {
        this.infoRequest.params = [];
        let index = 0;
        url.searchParams.forEach((value, key) => {
          this.infoRequest!.params.push({
            key,
            value,
            isActive: true,
            position: index++,
          });
        });
        this.createObj("params");
        this.undoStack.push({
          type: "url",
          oldValue: this.infoRequest.url,
          newValue: url.origin + url.pathname + url.hash,
          requestId: this.infoRequest.id,
        });
        this.infoRequest.url = url.origin + url.pathname + url.hash;
      }
    }
  }

  get rawHeaders(): string {
    return this.infoRequest
      ? ParsingHelper.convertKeyValueToJson(this.infoRequest.headers, "headers")
      : "{}";
  }

  get rawBody(): string {
    return this.infoRequest
      ? ParsingHelper.convertKeyValueToJson(this.infoRequest.body, "body")
      : "{}";
  }

  get rawParams(): string {
    return this.infoRequest
      ? ParsingHelper.convertKeyValueToJson(this.infoRequest.params, "params")
      : "{}";
  }

  getRawBody(): string {
    return this.infoRequest
      ? ParsingHelper.convertKeyValueToJson(this.infoRequest.body, "body")
      : "{}";
  }

  getRawParams(): string {
    return this.infoRequest
      ? ParsingHelper.convertKeyValueToJson(this.infoRequest.params, "params")
      : "{}";
  }

  parseHeader(event: any) {
    if (this.infoRequest) {
      this.infoRequest.headers = ParsingHelper.parseJsonToKeyValueArray(
        event.target.value,
        "headers"
      );
    }
  }

  parseBody(event: any) {
    if (this.infoRequest) {
      this.infoRequest.body = ParsingHelper.parseJsonToKeyValueArray(event.target.value, "body");
    }
  }

  parseParam(event: any) {
    if (this.infoRequest) {
      this.infoRequest.params = ParsingHelper.parseJsonToKeyValueArray(
        event.target.value,
        "params"
      );
    }
  }

  parseBodyValue(data: any): BodyValue {
    return ParsingHelper.parseBodyValue(data);
  }

  addResponseToHistory(responseData: string, status: "success" | "error") {
    if (this.infoRequest) {
      if (!this.infoRequest.responses) {
        this.infoRequest.responses = [];
      }

      const responseItem: RequestResponse = {
        id: UUID(),
        timestamp: new Date(),
        data: responseData,
        status: status,
      };

      if (this.infoRequest.responses.length >= 10) {
        this.infoRequest.responses.shift();
      }

      this.infoRequest.responses.push(responseItem);
      this.saveData();
    }
  }

  sendRequest() {
    if (this.infoRequest) {
      this.urlRequestsService
        .sendRequest<string>(this.infoRequest)
        .then((response: Response<string>) => {
          this.selectedTabIndex = 3;
          this.notifyService.showNotify(response.status, response.message);
          if (response.status == ResponseStatus.SUCCESS) {
            this.response = response.data;
            this.addResponseToHistory(response.data, "success");
          }
        })
        .catch((err: Response<string>) => {
          const errorMsg = err.message ?? err.toString();
          this.response = errorMsg;
          this.addResponseToHistory(errorMsg, "error");
          this.notifyService.showError(errorMsg);
          this.selectedTabIndex = 3;
        });
    }
  }

  toggleResponseCollapsed() {
    this.isResponseCollapsed = !this.isResponseCollapsed;
  }

  viewLatestResponse(event: any) {
    event.stopPropagation();
    this.getLatestResponse();
    this.isResponseCollapsed = false;
  }

  getInfo(coll: Collection, req: Request) {
    this.infoCollection = coll;
    this.infoRequest = req;

    this.getLatestResponse();
  }

  saveData() {
    this.urlRequestsService
      .saveData<string>(this.listCollections)
      .then((data: Response<string>) => {
        this.notifyService.showNotify(data.status, data.message);
      })
      .catch((err: Response<string>) => {
        this.notifyService.showError(err.message ?? err.toString());
      });
  }

  toggleEditorMode(type: "params" | "headers" | "body") {
    this.typeEditorData[type] = this.typeEditorData[type] === "table" ? "json" : "table";
  }

  private updatePositions(array: (RecObj | BodyData)[]): void {
    array.forEach((item, index) => {
      item.position = index;
    });
  }

  private initializePositions(collections: Collection[]): void {
    collections.forEach((collection) => {
      collection.requests.forEach((request) => {
        // Initialize positions for params
        if (request.params) {
          request.params.forEach((param, index) => {
            if (param.position === undefined) {
              param.position = index;
            }
          });
        }
        // Initialize positions for headers
        if (request.headers) {
          request.headers.forEach((header, index) => {
            if (header.position === undefined) {
              header.position = index;
            }
          });
        }
        // Initialize positions for body
        if (request.body) {
          request.body.forEach((bodyItem, index) => {
            if (bodyItem.position === undefined) {
              bodyItem.position = index;
            }
          });
        }
      });
    });
  }

  isValuePresent(item: RecObj | BodyData, type: string): boolean {
    if (item.key === "") return false;
    if (type === "body") {
      return (item as BodyData).value.value !== "";
    } else {
      return (item as RecObj).value !== "";
    }
  }

  private undo() {
    if (this.undoStack.length > 0) {
      const item = this.undoStack.pop()!;
      switch (item.type) {
        case "url":
          const req = this.listCollections
            .flatMap((c) => c.requests)
            .find((r) => r.id === item.requestId);
          if (req) req.url = item.oldValue;
          break;
        case "param":
        case "header":
        case "body":
          if (this.infoRequest && item.index !== undefined && item.field) {
            (this.infoRequest as any)[item.type + "s"][item.index][item.field] = item.oldValue;
          }
          break;
        case "requestTitle":
          const rreq = this.listCollections
            .flatMap((c) => c.requests)
            .find((r) => r.id === item.requestId);
          if (rreq) rreq.title = item.oldValue;
          break;
        case "collectionTitle":
          const coll = this.listCollections.find((c) => c.id === item.collectionId);
          if (coll) coll.title = item.oldValue;
          break;
      }
    }
  }

  // Event handlers for EditableTableComponent
  onTableEditObj(event: { row: number; field: "key" | "value"; data: any }): void {
    this.editObj(event.row, event.field, event.data);
  }

  onTableSelAll(event: { event: any; type: "params" | "headers" | "body" }): void {
    this.selAll(event.event, event.type);
  }

  onTableKeyDown(event: {
    event: KeyboardEvent;
    row: number;
    type: "params" | "headers" | "body";
    field: "key" | "value";
  }): void {
    this.onKeyDown(event.event, event.row, event.type, event.field);
  }

  onTableInputChange(event: {
    event: any;
    row: number;
    type: "params" | "headers" | "body";
    field: "key" | "value";
  }): void {
    this.inputChange(event.event, event.row, event.type, event.field);
  }

  onTableDeleteRec(event: { list: any[]; index: number }): void {
    this.deleteRec(event.list, event.index);
  }

  onTableDragStart(event: { event: any; data: any }): void {
    this.onDragStart(event.event, event.data.item, event.data.itemType, event.data.sourceInfo);
  }

  onTableDragEnd(event: any): void {
    this.onDragEnd(event);
  }

  onTableDropRecords(event: { event: any; type: "params" | "headers" | "body" }): void {
    this.dropTableRecords(event.event, event.type);
  }

  // Event handlers for ResponseTabComponent
  onResponseToggleCollapsed(): void {
    this.toggleResponseCollapsed();
  }

  onResponseViewLatest(event: any): void {
    this.viewLatestResponse(event);
  }

  onResponseLoadFromHistory(response: any): void {
    this.loadResponseFromHistory(response);
  }

  onResponseClearHistory(): void {
    this.clearResponseHistory();
  }

  // History-related methods (kept for backward compatibility with existing logic)
  getLatestResponse(): string {
    if (this.infoRequest && this.infoRequest.responses && this.infoRequest.responses.length > 0) {
      const latestResponse = this.infoRequest.responses[0];
      this.response = latestResponse.data;
      this.currentResponseId = latestResponse.id;
      return this.response;
    }
    this.currentResponseId = "";
    return this.response;
  }

  loadResponseFromHistory(response: RequestResponse) {
    this.response = response.data;
    this.currentResponseId = response.id;
    this.isResponseCollapsed = false;
  }

  clearResponseHistory() {
    if (this.infoRequest) {
      this.infoRequest.responses = [];
      this.saveData();
      this.notifyService.showNotify(ResponseStatus.SUCCESS, "Response history cleared");
    }
  }
}
