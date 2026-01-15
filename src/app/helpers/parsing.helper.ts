/* models */
import { BodyValue } from "@models/request";

export class ParsingHelper {
  static isXML(str: string): boolean {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, "application/xml");
    return doc.getElementsByTagName("parsererror").length === 0;
  }

  static isHTML(str: string): boolean {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, "text/html");
    return Array.from(doc.body.childNodes).every((element) => element.nodeName !== "parsererror");
  }

  static isJson(data: Object): boolean {
    return typeof data === "object";
  }

  static isJsonAsString(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return typeof parsed === "object" && parsed !== null;
    } catch (e) {
      return false;
    }
  }

  static getRawValue(type: "params" | "headers" | "body", data: any | BodyValue): string {
    switch (type) {
      case "body":
        switch (data.type) {
          case "String":
            return data.value;
          case "Number":
            return String(data.value);
          case "Bool":
            return String(data.value);
          case "Array":
            return JSON.stringify(data.value);
          case "Object":
            return JSON.stringify(data.value);
          default:
            return "";
        }
      case "params":
      case "headers":
        return String(data);
      default:
        return "";
    }
  }

  static parseBodyValue(data: any): BodyValue {
    let tempObj: BodyValue = { type: "String", value: "" };
    if (ParsingHelper.isJsonAsString(data)) {
      if (Array.isArray(JSON.parse(data))) {
        tempObj = {
          type: "Array",
          value: JSON.parse(data),
        } as BodyValue;
      } else if (!Array.isArray(JSON.parse(data)) && ParsingHelper.isJsonAsString(data)) {
        tempObj = {
          type: "Object",
          value: JSON.parse(data),
        } as BodyValue;
      }
    } else if (ParsingHelper.isJson(data)) {
      if (Array.isArray(data)) {
        tempObj = {
          type: "Array",
          value: data,
        } as BodyValue;
      } else if (!Array.isArray(data) && ParsingHelper.isJson(data)) {
        tempObj = {
          type: "Object",
          value: data,
        } as BodyValue;
      }
    } else if (/true/i.test(data) || /false/i.test(data)) {
      tempObj = {
        type: "Bool",
        value: /true/i.test(data),
      } as BodyValue;
    } else if (Number(data)) {
      tempObj = {
        type: "Number",
        value: Number(data),
      } as BodyValue;
    } else {
      tempObj = {
        type: "String",
        value: data.toString(),
      } as BodyValue;
    }

    return tempObj;
  }

  static parseJsonToKeyValueArray(jsonString: string, type: "params" | "headers" | "body"): any[] {
    try {
      const rawData = JSON.parse(jsonString);
      if (!rawData) return [];

      const keys = Object.keys(rawData);
      const result: any[] = [];

      keys.forEach((key) => {
        if (type === "body") {
          result.push({
            key,
            value: ParsingHelper.parseBodyValue(rawData[key]),
            isActive: true,
          });
        } else {
          result.push({
            key,
            value: rawData[key],
            isActive: true,
          });
        }
      });

      // Add empty row
      if (type === "body") {
        result.push({
          key: "",
          value: { type: "String", value: "" },
          isActive: false,
        });
      } else {
        result.push({
          key: "",
          value: "",
          isActive: false,
        });
      }

      return result;
    } catch (e) {
      return [];
    }
  }

  static convertKeyValueToJson(array: any[], type: "params" | "headers" | "body"): string {
    const result: { [key: string]: any } = {};

    array.forEach((item) => {
      if (item.key && item.key !== "") {
        if (type === "body") {
          result[item.key] = ParsingHelper.getRawValue("body", item.value);
        } else {
          result[item.key] = item.value;
        }
      }
    });

    return JSON.stringify(result, null, type === "params" ? 2 : 0);
  }
}
