export const joinPath = (...parts: string[]) => parts.join("/").replace(/\\/g, "/");

export const WEBUI_ROOT = import.meta.env.WEBUI_ROOT || ".";

export const OUTPUTS_PATH = joinPath(WEBUI_ROOT, "outputs");
