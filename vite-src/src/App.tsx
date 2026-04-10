import "./App.css";
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

function App() {
  const openOutputs = () => {
    const isWindows = (window as any).NL_OS === "Windows";
    os.execCommand(isWindows ? `explorer "${OUTPUTS_PATH}"` : `open "${OUTPUTS_PATH}"`);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">TTS WebUI</h1>
      <ProcessSpawner processes={PROCESSES} cwd={WEBUI_ROOT} />
      <div className="mt-4">
        <button
          onClick={openOutputs}
          className="py-2 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors cursor-pointer"
        >
          Open outputs
        </button>
      </div>
    </div>
  );
}

export default App;
