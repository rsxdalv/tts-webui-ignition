import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import neuLogo from "/neutralino.png";
import "./App.css";

import { filesystem } from "@neutralinojs/lib";
import ProcessSpawner from "./ProcessSpawner";

const PROCESSES = [
  { name: "npm start", command: "npm run start" },
  { name: "dir", command: "dir" },
  { name: "echo hello world", command: "echo hello world" },
];

const CWD =
  import.meta.env.MODE === "development"
    ? "C:\\Users\\rob\\Desktop\\tts-generation-webui-main\\react-ui\\"
    : ".";

function App() {
  const [count, setCount] = useState(0);

  // Log current directory or error after component is mounted
  filesystem
    .readDirectory("./")
    .then((data) => {
      console.log(data);
    })
    .catch((err) => {
      console.log(err);
    });

  return (
    <>
      <div className="flex items-center justify-center gap-4">
        <a href="http://localhost:3000" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="http://localhost:7770" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a href="https://neutralino.js.org/" target="_blank">
          <img src={neuLogo} className="logo" alt="Neutralino logo" />
        </a>
      </div>
      <h1>Vite + React + Neutralino</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <ProcessSpawner processes={PROCESSES} cwd={CWD} />
			<p className="read-the-docs">Click on the Vite and React logos to learn more</p>
		</>
	);
}

export default App;
