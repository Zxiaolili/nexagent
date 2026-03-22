/**
 * Interaction Engine — protocol for data-action attributes in prototype HTML.
 *
 * | Attribute                | Effect                              |
 * |--------------------------|-------------------------------------|
 * | data-action="navigate"   | Navigate to data-target page id     |
 * | data-nexagent-element    | English id unique per page (Agent @-mentions) |
 * | data-action="back"       | Go back to previous page            |
 * | data-action="toast"      | Show toast with data-message        |
 * | data-action="toggle"     | Toggle data-target element          |
 * | data-action="modal-open" | Show modal with data-target id      |
 * | data-action="modal-close"| Hide current modal                  |
 * | data-interaction="swipe" | Enable swipe on container           |
 * | data-interaction="select"| Enable selection in group           |
 *
 * Messages (iframe -> parent):
 * - { type: "nexagent:navigate", pageId: string }
 * - { type: "nexagent:navigate-back" }
 * - { type: "nexagent:interaction", action: string, target: string }
 */

export interface InteractionMessage {
  type: "nexagent:navigate" | "nexagent:navigate-back" | "nexagent:interaction";
  pageId?: string;
  action?: string;
  target?: string;
}

export function isInteractionMessage(data: unknown): data is InteractionMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as InteractionMessage).type === "string"
  );
}

export const SUPPORTED_ACTIONS = [
  "navigate",
  "back",
  "toast",
  "toggle",
  "modal-open",
  "modal-close",
] as const;

export const SUPPORTED_INTERACTIONS = [
  "swipe-horizontal",
  "single-select",
  "multi-select",
] as const;

export type ActionType = (typeof SUPPORTED_ACTIONS)[number];
export type InteractionType = (typeof SUPPORTED_INTERACTIONS)[number];
