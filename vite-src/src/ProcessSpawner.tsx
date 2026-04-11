import { useState, useEffect, useRef, useCallback } from "react";
import { os, events } from "@neutralinojs/lib";

interface ProcessEntry {
  name: string;
  command: string;
  openUrl?: string;
  cwd?: string;
}

interface ProcessSpawnerProps {
  process: ProcessEntry;
}

interface ProcessOutput {
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
}

interface ProcInfo {
  id: number;
  pid: number;
}

export default function ProcessSpawner({ process: proc }: ProcessSpawnerProps) {
  const [outputs, setOutputs] = useState<ProcessOutput>({ stdout: [], stderr: [], exitCode: null });
  const [procId, setProcId] = useState<ProcInfo | null>(null);

  const outputsRef = useRef<ProcessOutput>({ stdout: [], stderr: [], exitCode: null });
  const procIdRef = useRef<ProcInfo | null>(null);
  const handlerRef = useRef<((evt: any) => void) | null>(null);

  useEffect(() => {
    const handler: typeof handlerRef.current = (evt: any) => {
      const { id, action, data } = evt.detail;
      const numId = typeof id === "string" ? parseInt(id, 10) : id;

      if ((action === "stdOut" || action === "stdErr") && procIdRef.current?.id === numId) {
        setOutputs((prev) => {
          const updated = { ...prev };
          if (action === "stdOut") updated.stdout = [...updated.stdout, data];
          else updated.stderr = [...updated.stderr, data];
          return updated;
        });
      } else if (action === "exit" && procIdRef.current?.id === numId) {
        setOutputs((prev) => ({ ...prev, exitCode: data }));
        setProcId(null);
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

  useEffect(() => { outputsRef.current = outputs; }, [outputs]);
  useEffect(() => { procIdRef.current = procId; }, [procId]);

  const spawn = useCallback(() => {
    os.spawnProcess(proc.command, { cwd: proc.cwd }).then((result) => {
      const info: ProcInfo = { id: result.id, pid: result.pid };
      setProcId(info);
      setOutputs({ stdout: [], stderr: [], exitCode: null });
    });
  }, [proc.command, proc.cwd]);

  const terminate = useCallback(() => {
    if (procIdRef.current === null) return;

    const isWindows = (window as any).NL_OS === "Windows";
    if (isWindows) {
      os.execCommand(`taskkill /F /T /PID ${procIdRef.current.pid}`).catch(() => {
        os.updateSpawnedProcess(procIdRef.current!.id, "exit").catch(() => {});
      });
    } else {
      os.updateSpawnedProcess(procIdRef.current.id, "exit").catch(() => {});
    }

    setProcId(null);
  }, []);

  const [selectedLog, setSelectedLog] = useState(false);

  return (
    <>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2">
        <h2 className="text-base font-semibold border-b border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-gray-100">{proc.name}</h2>
        <button
          onClick={() => procId ? terminate() : spawn()}
          className={`w-full py-2 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
            procId
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-gray-500 hover:bg-gray-600 text-white"
          }`}
        >
          {procId ? `Stop ${proc.name}` : `Run ${proc.name}`}
        </button>
        <button
          onClick={() => setSelectedLog(true)}
          className="w-full py-2 px-3 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium transition-colors cursor-pointer"
        >
          Open logs
        </button>
        {proc.openUrl && (
          <button
            onClick={() => window.open(proc.openUrl, "_blank")}
            className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer"
          >
            Open site
          </button>
        )}
      </div>

      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedLog(false); }}
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 w-[680px] max-w-[90vw] max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4 text-gray-900 dark:text-gray-100">
              <span className="font-semibold text-lg">{proc.name} — logs</span>
              <button
                onClick={() => setSelectedLog(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer px-2"
              >
                ✕
              </button>
            </div>
            {outputs.stdout.length > 0 || outputs.stderr.length > 0 ? (
              <>
                <div className="mb-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">stdout</span>
                  <pre className="mt-1 bg-gray-100 dark:bg-black rounded-lg p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap text-green-700 dark:text-green-400">
                    {outputs.stdout.join("") || "(empty)"}
                  </pre>
                </div>
                <div>
                  <span className="text-xs text-red-400 uppercase tracking-wide">stderr</span>
                  <pre className="mt-1 bg-red-50 dark:bg-red-950 rounded-lg p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap text-red-700 dark:text-red-300">
                    {outputs.stderr.join("") || "(empty)"}
                  </pre>
                </div>
                {outputs.exitCode !== null && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Exit code: {outputs.exitCode}</p>
                )}
              </>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No output yet.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
