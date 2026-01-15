/* sys lib */
import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

@Component({
  selector: "app-json-highlighter",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./json-highlighter.component.html",
})
export class JsonHighlighterComponent implements OnChanges {
  @Input() json: string = "";

  highlightedJson: SafeHtml = "";

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["json"]) {
      try {
        const rawHtml = this.highlightJson(this.json);
        this.highlightedJson = this.sanitizer.bypassSecurityTrustHtml(rawHtml);
      } catch (error) {
        console.warn("JSON highlighting failed:", error);
        this.highlightedJson = this.escapeHtml(this.json);
      }
    }
  }

  private highlightJson(jsonString: string): string {
    try {
      // Parse and re-stringify to ensure proper formatting
      const parsed = JSON.parse(jsonString);
      const formatted = JSON.stringify(parsed, null, 2);

      // Apply syntax highlighting
      const highlighted = this.applySyntaxHighlighting(formatted);
      return highlighted || this.escapeHtml(jsonString);
    } catch (error) {
      // Try to extract JSON from HTTP response
      const lines = jsonString.split("\n");
      let bodyStart = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "") {
          bodyStart = i + 1;
          break;
        }
      }
      if (bodyStart > 0) {
        const body = lines.slice(bodyStart).join("\n").trim();
        try {
          const parsed = JSON.parse(body);
          const formatted = JSON.stringify(parsed, null, 2);
          const highlighted = this.applySyntaxHighlighting(formatted);
          return highlighted || this.escapeHtml(body);
        } catch (e2) {
          // If still fails, return the original string
          return this.escapeHtml(jsonString);
        }
      }
      // If parsing fails, return the original string with basic highlighting
      return this.escapeHtml(jsonString);
    }
  }

  private applySyntaxHighlighting(json: string): string {
    try {
      const parsed = JSON.parse(json);
      return this.buildHtml(parsed, 0);
    } catch (error) {
      // Fallback to escaped text if parsing fails
      return this.escapeHtml(json);
    }
  }

  private buildHtml(value: any, indent: number = 0): string {
    const indentStr = "  ".repeat(indent);

    if (value === null) {
      return `<span class="json-hl-null">null</span>`;
    }

    if (typeof value === "boolean") {
      return `<span class="json-hl-boolean">${value}</span>`;
    }

    if (typeof value === "number") {
      return `<span class="json-hl-number">${value}</span>`;
    }

    if (typeof value === "string") {
      return `<span class="json-hl-string">"${this.escapeHtml(value)}"</span>`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `<span class="json-hl-bracket">[]</span>`;
      }

      const items = value.map((item, index) => {
        const comma = index < value.length - 1 ? '<span class="json-hl-bracket">,</span>' : "";
        return `${"  ".repeat(indent + 1)}${this.buildHtml(item, indent + 1)}${comma}`;
      });

      return `<span class="json-hl-bracket">[</span>\n${items.join("\n")}\n${indentStr}<span class="json-hl-bracket">]</span>`;
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return `<span class="json-hl-bracket">{}</span>`;
      }

      const properties = entries.map(([key, val], index) => {
        const comma = index < entries.length - 1 ? '<span class="json-hl-bracket">,</span>' : "";
        const keyHtml = `<span class="json-hl-key">"${this.escapeHtml(key)}"</span>`;
        const colonHtml = `<span class="json-hl-colon">:</span>`;
        const valueHtml = this.buildHtml(val, indent + 1);

        return `${"  ".repeat(indent + 1)}${keyHtml} ${colonHtml} ${valueHtml}${comma}`;
      });

      return `<span class="json-hl-bracket">{</span>\n${properties.join("\n")}\n${indentStr}<span class="json-hl-bracket">}</span>`;
    }

    return this.escapeHtml(String(value));
  }

  private escapeHtml(text: string): string {
    const htmlEscapes: { [key: string]: string } = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
  }
}
