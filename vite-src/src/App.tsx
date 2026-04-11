import "./App.css";
import { useState, useEffect } from "react";
import { os } from "@neutralinojs/lib";
import ProcessSpawner from "./ProcessSpawner";
import { WEBUI_ROOT, OUTPUTS_PATH, joinPath } from "./config";

const DEV = import.meta.env.MODE === "development";
const REACT_UI_PATH = DEV ? joinPath(WEBUI_ROOT, "react-ui") + "/" : ".";

const PROCESSES = [
  {
    name: "TTS WebUI",
    command: "python server.py",
    openUrl: "http://localhost:7770",
    cwd: WEBUI_ROOT,
  },
  {
    name: "React UI",
    command: "npm start",
    openUrl: "http://localhost:3000",
    cwd: REACT_UI_PATH,
  },
];

type Theme = "light" | "dark" | "system";

function getEffectiveTheme(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function App() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "system",
  );
  const [isDark, setIsDark] = useState(() => getEffectiveTheme(theme));

  // Sync document class and listen for system theme changes
  useEffect(() => {
    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle("dark", dark);
      setIsDark(dark);
    };
    apply(getEffectiveTheme(theme));

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply(getEffectiveTheme("system"));
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  const setThemeAndPersist = (t: Theme) => {
    localStorage.setItem("theme", t);
    setTheme(t);
  };
  const openOutputs = () => {
    const isWindows = (window as any).NL_OS === "Windows";
    os.execCommand(isWindows ? `explorer "${OUTPUTS_PATH}"` : `open "${OUTPUTS_PATH}"`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-8 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">TTS WebUI</h1>
          <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setThemeAndPersist("light")}
              className={`text-lg px-2 py-1 rounded cursor-pointer transition-colors ${theme === "light" ? "bg-white dark:bg-gray-700 shadow-sm text-amber-600" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`}
              title="Light mode"
            >
              ☀️
            </button>
            <button
              onClick={() => setThemeAndPersist("dark")}
              className={`text-lg px-2 py-1 rounded cursor-pointer transition-colors ${theme === "dark" ? "bg-white dark:bg-gray-700 shadow-sm text-amber-400" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`}
              title="Dark mode"
            >
              🌙
            </button>
            <button
              onClick={() => setThemeAndPersist("system")}
              className={`text-lg px-2 py-1 rounded cursor-pointer transition-colors ${theme === "system" ? "bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`}
              title="System theme"
            >
              💻
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <ProcessSpawner process={PROCESSES[0]} />
          <ProcessSpawner process={PROCESSES[1]} />
        </div>
        <div className="mt-4">
          <button
            onClick={openOutputs}
            className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium transition-colors cursor-pointer"
          >
            Open outputs
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
