/* sys lib */
import { CommonModule } from "@angular/common";
import { Component, Input, Output, EventEmitter } from "@angular/core";
import { Subject } from "rxjs";

/* materials */
import { MatIconModule } from "@angular/material/icon";

/* models */
import { Request, RequestResponse } from "@models/request";

/* helpers */
import { ParsingHelper } from "@helpers/parsing.helper";

/* components */
import { JsonHighlighterComponent } from "@components/json-highlighter/json-highlighter.component";

@Component({
  selector: "app-response-tab",
  standalone: true,
  imports: [CommonModule, MatIconModule, JsonHighlighterComponent],
  templateUrl: "./response-tab.component.html",
})
export class ResponseTabComponent {
  @Input() response: string = "";
  @Input() currentResponseId: string = "";
  @Input() isResponseCollapsed: boolean = false;
  @Input() infoRequest: Request | null = null;

  @Output() toggleResponseCollapsed = new EventEmitter<void>();
  @Output() viewLatestResponse = new EventEmitter<any>();
  @Output() loadResponseFromHistory = new EventEmitter<RequestResponse>();
  @Output() clearResponseHistory = new EventEmitter<void>();

  get latestResponse(): string {
    if (this.infoRequest && this.infoRequest.responses && this.infoRequest.responses.length > 0) {
      const latestResponse = this.infoRequest.responses[0];
      return latestResponse.data;
    }
    return this.response;
  }

  get responseHistory(): any[] {
    if (this.infoRequest && this.infoRequest.responses) {
      return this.infoRequest.responses.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
    }
    return [];
  }

  get currentResponseMetadata(): any {
    if (this.infoRequest && this.infoRequest.responses) {
      const responseMeta = this.infoRequest.responses.find((r) => r.id === this.currentResponseId);
      if (responseMeta) {
        return responseMeta;
      }
    }

    if (this.infoRequest && this.infoRequest.responses && this.infoRequest.responses.length > 0) {
      return this.infoRequest.responses[0];
    }
    return null;
  }

  get isViewingLatest(): boolean {
    if (this.infoRequest && this.infoRequest.responses && this.infoRequest.responses.length > 0) {
      const latestResponse = this.infoRequest.responses[0];
      return this.currentResponseId === latestResponse.id || !this.currentResponseId;
    }
    return true;
  }

  isJsonAsString(data: string): boolean {
    return ParsingHelper.isJsonAsString(data);
  }

  isHTML(data: string): boolean {
    return ParsingHelper.isHTML(data);
  }

  isXML(data: string): boolean {
    return ParsingHelper.isXML(data);
  }

  onToggleResponseCollapsed(): void {
    this.toggleResponseCollapsed.emit();
  }

  onViewLatestResponse(event: any): void {
    this.viewLatestResponse.emit(event);
  }

  onLoadResponseFromHistory(response: RequestResponse): void {
    this.loadResponseFromHistory.emit(response);
  }

  onClearResponseHistory(): void {
    this.clearResponseHistory.emit();
  }
}
