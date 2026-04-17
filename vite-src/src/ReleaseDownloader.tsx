import { useState, useEffect, useRef } from "react";
import { os, events } from "@neutralinojs/lib";
import { WEBUI_ROOT, joinPath } from "./config";

export interface ReleaseDownloaderProps {
  name: string;
  downloadUrl: string;
  zipName?: string;
  cwd?: string;
  /** Called when extraction completes successfully (exit code 0) */
  onSuccess?: () => void;
}

function getDownloadCommand(url: string, outputPath: string): string {
  return `curl -Lk "${url}" -o "${outputPath}"`;
}

function getUnzipCommand(zipPath: string, destPath: string): string {
  const isWindows = (window as any).NL_OS === "Windows";
  if (isWindows) {
    return `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`;
  }
  return `unzip -o '${zipPath}' -d '${destPath}'`;
}

interface ProcessState {
  procId: number | null;
  pid: number | null;
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
  isRunning: boolean;
}

export function ReleaseDownloader({
  name,
  downloadUrl,
  zipName = "release.zip",
  cwd = WEBUI_ROOT,
  onSuccess,
}: ReleaseDownloaderProps) {
  const [download, setDownload] = useState<ProcessState>({
    procId: null,
    pid: null,
    stdout: [],
    stderr: [],
    exitCode: null,
    isRunning: false,
  });
  const [unzip, setUnzip] = useState<ProcessState>({
    procId: null,
    pid: null,
    stdout: [],
    stderr: [],
    exitCode: null,
    isRunning: false,
  });

  const downloadRef = useRef(download);
  const unzipRef = useRef(unzip);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    downloadRef.current = download;
  }, [download]);
  useEffect(() => {
    unzipRef.current = unzip;
  }, [unzip]);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    const handler = (evt: any) => {
      const { id, action, data } = evt.detail;
      const numId = typeof id === "string" ? parseInt(id, 10) : id;

      // Download process events
      if (
        downloadRef.current.procId !== null &&
        downloadRef.current.procId === numId
      ) {
        setDownload((prev) => {
          if (action === "stdOut")
            return { ...prev, stdout: [...prev.stdout, data] };
          if (action === "stdErr")
            return { ...prev, stderr: [...prev.stderr, data] };
          if (action === "exit")
            return { ...prev, exitCode: data, isRunning: false, procId: null };
          return prev;
        });
      }

      // Unzip process events
      if (
        unzipRef.current.procId !== null &&
        unzipRef.current.procId === numId
      ) {
        setUnzip((prev) => {
          if (action === "stdOut")
            return { ...prev, stdout: [...prev.stdout, data] };
          if (action === "stdErr")
            return { ...prev, stderr: [...prev.stderr, data] };
          if (action === "exit") {
            if (data === 0) onSuccessRef.current?.();
            return { ...prev, exitCode: data, isRunning: false, procId: null };
          }
          return prev;
        });
      }
    };

    events.on("spawnedProcess", handler);
    return () => {
      events.off("spawnedProcess", handler);
    };
  }, []);

  const spawnDownload = async () => {
    const zipPath = joinPath(cwd, zipName);
    const command = getDownloadCommand(downloadUrl, zipPath);
    console.log(`[ReleaseDownloader] Downloading: ${command}`);
    const result = await os.spawnProcess(command, { cwd });
    setDownload({
      procId: result.id,
      pid: result.pid,
      stdout: [],
      stderr: [],
      exitCode: null,
      isRunning: true,
    });
  };

  const spawnUnzip = async () => {
    const zipPath = joinPath(cwd, zipName);
    const command = getUnzipCommand(zipPath, cwd);
    console.log(`[ReleaseDownloader] Unzipping: ${command}`);
    const result = await os.spawnProcess(command, { cwd });
    setUnzip({
      procId: result.id,
      pid: result.pid,
      stdout: [],
      stderr: [],
      exitCode: null,
      isRunning: true,
    });
  };

  const terminate = async (_procId: number, pid: number) => {
    const isWindows = (window as any).NL_OS === "Windows";
    if (isWindows) {
      await os.execCommand(`taskkill /F /T /PID ${pid}`).catch(() => {});
    }
    setDownload((prev) => ({ ...prev, isRunning: false }));
    setUnzip((prev) => ({ ...prev, isRunning: false }));
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2">
      <h2 className="text-base font-semibold border-b border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-gray-100">
        {name}
      </h2>
      <button
        onClick={() =>
          download.isRunning
            ? terminate(download.procId!, download.pid!)
            : spawnDownload()
        }
        className={`w-full py-2 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
          download.isRunning
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-green-600 hover:bg-green-500 text-white"
        }`}
      >
        {download.isRunning ? "Cancel Download" : "Download Release"}
      </button>
      <button
        onClick={() =>
          unzip.isRunning ? terminate(unzip.procId!, unzip.pid!) : spawnUnzip()
        }
        disabled={!download.isRunning && download.exitCode === null}
        className="w-full py-2 px-3 rounded-lg font-medium transition-colors cursor-pointer bg-purple-600 hover:bg-purple-500 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {unzip.isRunning ? "Cancel Extract" : "Extract ZIP"}
      </button>
      {download.exitCode !== null && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          Download{" "}
          {download.exitCode === 0
            ? "✓ completed"
            : `✗ failed (exit ${download.exitCode})`}
        </p>
      )}
      {unzip.exitCode !== null && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          Extract{" "}
          {unzip.exitCode === 0
            ? "✓ completed"
            : `✗ failed (exit ${unzip.exitCode})`}
        </p>
      )}
      {(download.stdout.length > 0 || download.stderr.length > 0) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500 dark:text-gray-400">
            Download log
          </summary>
          <pre className="mt-1 bg-gray-200 dark:bg-gray-900 rounded-lg p-2 text-xs overflow-auto max-h-32 whitespace-pre-wrap">
            {download.stdout.join("")}
            {download.stderr.join("")}
          </pre>
        </details>
      )}
      {(unzip.stdout.length > 0 || unzip.stderr.length > 0) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500 dark:text-gray-400">
            Extract log
          </summary>
          <pre className="mt-1 bg-gray-200 dark:bg-gray-900 rounded-lg p-2 text-xs overflow-auto max-h-32 whitespace-pre-wrap">
            {unzip.stdout.join("")}
            {unzip.stderr.join("")}
          </pre>
        </details>
      )}
    </div>
  );
}
