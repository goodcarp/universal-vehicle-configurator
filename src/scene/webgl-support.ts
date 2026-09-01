export type WebGLSupport = "supported" | "unsupported";

export function detectWebGLSupport(): WebGLSupport {
  if (typeof window === "undefined" || typeof document === "undefined") return "unsupported";
  if (!("WebGLRenderingContext" in window) && !("WebGL2RenderingContext" in window)) {
    return "unsupported";
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      failIfMajorPerformanceCaveat: true,
    }) ?? canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      failIfMajorPerformanceCaveat: true,
    });
    if (!context) return "unsupported";
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return "supported";
  } catch {
    return "unsupported";
  }
}
