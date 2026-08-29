export const TASKS_EXTENSION_ID = "io.modelcontextprotocol/tasks";
export const CLIENT_CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities";

export function withTasksCapability(meta = {}) {
  const clientCapabilities = meta[CLIENT_CAPABILITIES_META] ?? {};
  return {
    ...meta,
    [CLIENT_CAPABILITIES_META]: {
      ...clientCapabilities,
      extensions: {
        ...(clientCapabilities.extensions ?? {}),
        [TASKS_EXTENSION_ID]: {}
      }
    }
  };
}

export function hasTasksCapability(meta) {
  const extensions = meta?.[CLIENT_CAPABILITIES_META]?.extensions;
  return Boolean(extensions && Object.hasOwn(extensions, TASKS_EXTENSION_ID));
}

export function taskRoutingHeaders(taskId) {
  return {
    "Mcp-Method": "tasks/get",
    "Mcp-Name": taskId
  };
}
