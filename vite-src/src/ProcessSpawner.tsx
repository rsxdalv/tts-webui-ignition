import { useState, useEffect, useRef, useCallback } from "react";
import { os, events } from "@neutralinojs/lib";

interface ProcessEntry {
  name: string;
  command: string;
  openUrl?: string;
  cwd?: string; // per-process override; falls back to the global cwd prop
}

interface ProcessSpawnerProps {
  processes: ProcessEntry[];
  cwd: string;
}

interface ProcessOutput {
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
}

interface ProcInfo {
  id: number;  // Neutralino internal ID (used for updateSpawnedProcess & event matching)
  pid: number; // OS process ID (used for taskkill / kill)
}

export default function ProcessSpawner({ processes, cwd }: ProcessSpawnerProps) {
  const [outputs, setOutputs] = useState<Map<string, ProcessOutput>>(new Map());
  const [procIds, setProcIds] = useState<Map<string, ProcInfo>>(new Map());

  // Stable refs so handler always sees current state without stale closures
  const outputsRef = useRef<Map<string, ProcessOutput>>(new Map());
  const procIdsRef = useRef<Map<string, ProcInfo>>(new Map());

  // Singleton: exactly one handler, stable reference, no duplicate subscriptions
  const handlerRef = useRef<((evt: any) => void) | null>(null);

  useEffect(() => {
    const handler: typeof handlerRef.current = (evt: any) => {
      const { id, action, data } = evt.detail;
      const numId = typeof id === "string" ? parseInt(id, 10) : id;

      if (action === "stdOut" || action === "stdErr") {
        setOutputs((prev) => {
          const next = new Map(prev);
          for (const [name, info] of procIdsRef.current) {
            if (info.id === numId) {
              const existing = next.get(name) || { stdout: [], stderr: [], exitCode: null };
              const updated = { ...existing };
              if (action === "stdOut") updated.stdout = [...updated.stdout, data];
              else updated.stderr = [...updated.stderr, data];
              next.set(name, updated);
              break;
            }
          }
          return next;
        });
      } else if (action === "exit") {
        setOutputs((prev) => {
          const next = new Map(prev);
          for (const [name, info] of procIdsRef.current) {
            if (info.id === numId) {
              const existing = next.get(name) || { stdout: [], stderr: [], exitCode: null };
              next.set(name, { ...existing, exitCode: data });
              break;
            }
          }
          return next;
        });
        setProcIds((prev) => {
          const next = new Map(prev);
          for (const [name, info] of next) {
            if (info.id === numId) { next.delete(name); break; }
          }
          return next;
        });
      }
    };

    handlerRef.current = handler;
    events.on("spawnedProcess", handler);

    return () => {
      if (handlerRef.current) {
        events.off("spawnedProcess", handlerRef.current);
        handlerRef.current = null;
      }
    };
  }, []);

  // Keep refs in sync with state
  useEffect(() => { outputsRef.current = outputs; }, [outputs]);
  useEffect(() => { procIdsRef.current = procIds; }, [procIds]);

  const spawn = useCallback((proc: ProcessEntry) => {
    os.spawnProcess(proc.command, { cwd: proc.cwd ?? cwd }).then((result) => {
      const info: ProcInfo = { id: result.id, pid: result.pid };
      setProcIds((prev) => new Map(prev).set(proc.name, info));
      setOutputs((prev) =>
        new Map(prev).set(proc.name, { stdout: [], stderr: [], exitCode: null })
      );
    });
  }, [cwd]);

  const terminate = useCallback((procName: string) => {
    const info = procIdsRef.current.get(procName);
    if (info === undefined) return;

    // NL_OS is injected by the Neutralino backend: "Windows" | "Linux" | "Darwin" | "FreeBSD"
    const isWindows = (window as any).NL_OS === "Windows";
    if (isWindows) {
      // taskkill /F /T kills the entire process tree (npm → cmd → node/vite).
      os.execCommand(`taskkill /F /T /PID ${info.pid}`).catch(() => {
        os.updateSpawnedProcess(info.id, "exit").catch(() => {});
      });
    } else {
      os.updateSpawnedProcess(info.id, "exit").catch(() => {});
    }

    setProcIds((prev) => {
      const next = new Map(prev);
      next.delete(procName);
      return next;
    });
  }, []);

  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const selectedOutput = selectedLog ? (outputs.get(selectedLog) ?? null) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {processes.map((proc) => {
          const isRunning = procIds.get(proc.name) !== undefined;
          return (
            <div key={proc.name} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col gap-2">
              <h2 className="text-base font-semibold border-b border-gray-700 pb-2">{proc.name}</h2>
              <button
                onClick={() => isRunning ? terminate(proc.name) : spawn(proc)}
                className={`w-full py-2 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
                  isRunning
                    ? "bg-red-700 hover:bg-red-600 text-white"
                    : "bg-green-700 hover:bg-green-600 text-white"
                }`}
              >
                {isRunning ? `Stop ${proc.name}` : `Run ${proc.name}`}
              </button>
              <button
                onClick={() => setSelectedLog(proc.name)}
                className="w-full py-2 px-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors cursor-pointer"
              >
                Open logs
              </button>
              {proc.openUrl && (
                <button
                  onClick={() => window.open(proc.openUrl, "_blank")}
                  className="w-full py-2 px-3 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-medium transition-colors cursor-pointer"
                >
                  Open site
                </button>
              )}
            </div>
          );
        })}
      </div>

      {selectedLog !== null && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedLog(null); }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-[680px] max-w-[90vw] max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold text-lg">{selectedLog} — logs</span>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-white cursor-pointer px-2"
              >
                ✕
              </button>
            </div>
            {selectedOutput ? (
              <>
                <div className="mb-3">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">stdout</span>
                  <pre className="mt-1 bg-gray-950 rounded-lg p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                    {selectedOutput.stdout.join("") || "(empty)"}
                  </pre>
                </div>
                <div>
                  <span className="text-xs text-red-400 uppercase tracking-wide">stderr</span>
                  <pre className="mt-1 bg-red-950 rounded-lg p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                    {selectedOutput.stderr.join("") || "(empty)"}
                  </pre>
                </div>
                {selectedOutput.exitCode !== null && (
                  <p className="mt-2 text-xs text-gray-500">Exit code: {selectedOutput.exitCode}</p>
                )}
              </>
            ) : (
              <p className="text-gray-500 text-sm">No output recorded yet.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
