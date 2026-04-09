import { useState, useEffect, useRef, useCallback } from "react";
import { os, events } from "@neutralinojs/lib";

interface ProcessEntry {
  name: string;
  command: string;
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

export default function ProcessSpawner({ processes, cwd }: ProcessSpawnerProps) {
  const [outputs, setOutputs] = useState<Map<string, ProcessOutput>>(new Map());
  const [procIds, setProcIds] = useState<Map<string, number>>(new Map());

  // Stable refs so handler always sees current state without stale closures
  const outputsRef = useRef<Map<string, ProcessOutput>>(new Map());
  const procIdsRef = useRef<Map<string, number>>(new Map());

  // Singleton: exactly one handler, stable reference, no duplicate subscriptions
  const handlerRef = useRef<((evt: any) => void) | null>(null);

  useEffect(() => {
    const handler: typeof handlerRef.current = (evt: any) => {
      const { id, action, data } = evt.detail;
      const numId = typeof id === "string" ? parseInt(id, 10) : id;

      if (action === "stdOut" || action === "stdErr") {
        setOutputs((prev) => {
          const next = new Map(prev);
          for (const [name, pid] of procIdsRef.current) {
            if (pid === numId) {
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
          for (const [name, pid] of procIdsRef.current) {
            if (pid === numId) {
              const existing = next.get(name) || { stdout: [], stderr: [], exitCode: null };
              next.set(name, { ...existing, exitCode: data });
              break;
            }
          }
          return next;
        });
        setProcIds((prev) => {
          const next = new Map(prev);
          for (const [name, pid] of next) {
            if (pid === numId) { next.delete(name); break; }
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
    os.spawnProcess(proc.command, { cwd }).then((result) => {
      const numId = typeof result.id === "string" ? parseInt(result.id, 10) : result.id;
      setProcIds((prev) => new Map(prev).set(proc.name, numId));
      setOutputs((prev) =>
        new Map(prev).set(proc.name, { stdout: [], stderr: [], exitCode: null })
      );
    });
  }, [cwd]);

  const terminate = useCallback((procName: string) => {
    // Always read from ref to avoid stale state in async handlers
    const pid = procIdsRef.current.get(procName);
    if (pid === undefined) return;
    os.updateSpawnedProcess(String(pid), "terminate", "");
    setProcIds((prev) => {
      const next = new Map(prev);
      next.delete(procName);
      return next;
    });
  }, []);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {processes.map((proc) => {
          const pid = procIds.get(proc.name);
          const isRunning = pid !== undefined;
          const output = outputs.get(proc.name) || { stdout: [], stderr: [], exitCode: null };
          return (
            <div
              key={proc.name}
              style={{
                border: "1px solid #ccc",
                padding: "0.5rem",
                borderRadius: "4px",
                minWidth: "200px",
              }}
            >
              <strong>{proc.name}</strong>
              <br />
              <button onClick={() => spawn(proc)} disabled={isRunning}>
                {isRunning ? "Running..." : "Spawn"}
              </button>{" "}
              {isRunning && (
                <button onClick={() => terminate(proc.name)}>Terminate</button>
              )}
              <div style={{ marginTop: "0.25rem" }}>
                <strong>stdout:</strong>
                <pre
                  style={{
                    background: "#eee",
                    padding: "0.25rem",
                    color: "#000",
                    fontSize: "0.75rem",
                    maxHeight: "80px",
                    overflow: "auto",
                  }}
                >
                  {output.stdout.join("") || "(empty)"}
                </pre>
              </div>
              <div style={{ marginTop: "0.25rem" }}>
                <strong>stderr:</strong>
                <pre
                  style={{
                    background: "#fdd",
                    padding: "0.25rem",
                    color: "#000",
                    fontSize: "0.75rem",
                    maxHeight: "80px",
                    overflow: "auto",
                  }}
                >
                  {output.stderr.join("") || "(empty)"}
                </pre>
              </div>
              {output.exitCode !== null && (
                <p style={{ fontSize: "0.75rem" }}>Exit: {output.exitCode}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

