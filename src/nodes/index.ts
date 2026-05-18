import type { NodeTypes } from "@xyflow/react";
import { UserNode } from "./UserNode";
import { AssistantNode } from "./AssistantNode";
import { ToolResultNode } from "./ToolResultNode";

export const nodeTypes: NodeTypes = {
  user: UserNode,
  assistant: AssistantNode,
  tool_result: ToolResultNode,
};
