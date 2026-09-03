export type AutoLabWorkspace = "configure" | "garage";

export type VehicleTwinTool =
  | "get_state"
  | "set_view"
  | "set_motion"
  | "list_parts"
  | "get_part"
  | "frame_part"
  | "highlight_part"
  | "set_annotations"
  | "get_specification"
  | "measure"
  | "set_vehicle_context"
  | "reset";

export type VehicleTwinContext = {
  build: string;
  paint: string;
  wheels: string;
  interior: string;
  rangeMiles: number | null;
  vehicleTotal: number;
  revision: number;
};

type WorkspaceListener = (workspace: AutoLabWorkspace) => void;
type LoadListener = (requested: boolean) => void;

const FRAME_TIMEOUT_MS = 45_000;
const listeners = new Set<WorkspaceListener>();
const loadListeners = new Set<LoadListener>();

let workspace: AutoLabWorkspace = "configure";
let loadRequested = false;
let frame: HTMLIFrameElement | null = null;
let frameReady = false;

function emitWorkspace() {
  listeners.forEach((listener) => listener(workspace));
}

function requestFrameLoad() {
  if (loadRequested) return;
  loadRequested = true;
  loadListeners.forEach((listener) => listener(true));
}

function waitForFrame(): Promise<HTMLIFrameElement> {
  if (frame?.contentWindow && frameReady) return Promise.resolve(frame);
  requestFrameLoad();

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const poll = window.setInterval(() => {
      if (frame?.contentWindow && frameReady) {
        window.clearInterval(poll);
        resolve(frame);
        return;
      }
      if (performance.now() - startedAt >= FRAME_TIMEOUT_MS) {
        window.clearInterval(poll);
        reject(new Error("The vehicle twin is still loading. Try the request again."));
      }
    }, 50);
  });
}

async function callTwin<T>(tool: VehicleTwinTool, args: Record<string, unknown> = {}): Promise<T> {
  const targetFrame = await waitForFrame();
  const targetWindow = targetFrame.contentWindow;
  if (!targetWindow) throw new Error("The vehicle twin is unavailable.");

  const id = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error(`The vehicle twin did not answer ${tool}.`));
    }, FRAME_TIMEOUT_MS);

    function onMessage(event: MessageEvent) {
      if (
        event.source !== targetWindow
        || event.origin !== window.location.origin
        || event.data?.source !== "r2-blueprint-result"
        || event.data?.id !== id
      ) return;

      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      if (event.data.ok) resolve(event.data.result as T);
      else reject(new Error(String(event.data.error ?? `Vehicle twin tool ${tool} failed.`)));
    }

    window.addEventListener("message", onMessage);
    targetWindow.postMessage(
      { source: "r2-blueprint", id, tool, args },
      window.location.origin,
    );
  });
}

export const ownerGuideBridge = {
  getWorkspace: () => workspace,
  setWorkspace(next: AutoLabWorkspace) {
    if (workspace === next) return;
    workspace = next;
    emitWorkspace();
  },
  observeWorkspace(listener: WorkspaceListener) {
    listeners.add(listener);
    listener(workspace);
    return () => {
      listeners.delete(listener);
    };
  },
  requestFrame: requestFrameLoad,
  observeFrameRequest(listener: LoadListener) {
    loadListeners.add(listener);
    listener(loadRequested);
    return () => {
      loadListeners.delete(listener);
    };
  },
  bindFrame(nextFrame: HTMLIFrameElement | null) {
    frame = nextFrame;
    frameReady = Boolean(nextFrame?.contentDocument?.readyState === "complete");
  },
  markFrameReady() {
    frameReady = true;
  },
  async call<T>(tool: VehicleTwinTool, args: Record<string, unknown> = {}, reveal = false) {
    if (reveal) this.setWorkspace("garage");
    return callTwin<T>(tool, args);
  },
  async syncContext(context: VehicleTwinContext) {
    return callTwin("set_vehicle_context", context);
  },
};
