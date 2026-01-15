import { Request } from "./request";

export interface Collection {
  id: string;
  title: string;
  editTitle: boolean;
  expanded: boolean;
  requests: Array<Request>;
}
