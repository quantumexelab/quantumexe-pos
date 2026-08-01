const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execFile } = require("child_process");
const http = require("http");
const { autoUpdater } = require("electron-updater");
const os = require("os");

const PORT = Number(process.env.POS_PORT || 4173);
let serverProc = null;
let mainWindow = null;
let updateDownloaded = false;
let apiLog = "";

function appendApiLog(chunk) {
  const text = String(chunk);
  apiLog += text;
  if (apiLog.length > 20_000) apiLog = apiLog.slice(-20_000);
  try {
    const logFile = path.join(app.getPath("userData"), "api-start.log");
    fs.appendFileSync(logFile, text);
  } catch {
    /* ignore */
  }
}

function bundleRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-bundle");
  }
  return path.resolve(__dirname, "../../");
}

function userDbPath() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "quantumexe-pos.db");
}

/** Prisma-friendly absolute SQLite URL on Windows (`file:C:/...`, not file:///). */
function databaseUrlFor(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  return `file:${normalized}`;
}

function findNodeBinary(root) {
  const portable = path.join(root, "node", "node.exe");
  if (fs.existsSync(portable)) return { bin: portable, asNode: false };
  return { bin: process.execPath, asNode: true };
}

function waitForHealth(timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (serverProc && serverProc.exitCode != null) {
        reject(
          new Error(
            `API process exited early (code ${serverProc.exitCode}).\n\n${apiLog.slice(-2500) || "No API log output."}`
          )
        );
        return;
      }
      const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else if (Date.now() - start > timeoutMs) {
          reject(new Error(`API health timeout.\n\n${apiLog.slice(-2500) || "No API log output."}`));
        } else setTimeout(tick, 400);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`API failed to start.\n\n${apiLog.slice(-2500) || "No API log output."}`));
        } else setTimeout(tick, 400);
      });
    };
    tick();
  });
}

function startApi() {
  const root = bundleRoot();
  const apiEntry = path.join(root, "api", "index.js");
  const webDist = path.join(root, "web-dist");
  const nodeModules = path.join(root, "node_modules");

  apiLog = "";
  try {
    fs.writeFileSync(path.join(app.getPath("userData"), "api-start.log"), "");
  } catch {
    /* ignore */
  }

  if (!fs.existsSync(apiEntry)) {
    throw new Error(`API bundle missing: ${apiEntry}`);
  }
  if (!fs.existsSync(path.join(nodeModules, "express"))) {
    throw new Error(
      `Runtime node_modules missing at:\n${nodeModules}\n\nRebuild the installer (node_modules must be packaged).`
    );
  }

  const env = {
    ...process.env,
    ELECTRON: "1",
    SERVE_WEB: "1",
    PORT: String(PORT),
    WEB_DIST: webDist,
    DATABASE_URL: databaseUrlFor(userDbPath()),
    JWT_SECRET: process.env.JWT_SECRET || "quantumexe-desktop-secret",
    NODE_PATH: nodeModules,
    // Don't inherit a broken sync config from the build machine unless desktop.env says so
    SYNC_TO_FIRESTORE: process.env.SYNC_TO_FIRESTORE || "0",
    BACKUP_DIR: path.join(app.getPath("userData"), "backups"),
  };

  const envFile = path.join(root, "desktop.env");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      v = v.replace(/\\n/g, "\n");
      env[m[1]] = v;
    }
  }

  const node = findNodeBinary(root);
  const spawnEnv = { ...env };
  if (node.asNode) spawnEnv.ELECTRON_RUN_AS_NODE = "1";

  appendApiLog(`[boot] root=${root}\n[boot] api=${apiEntry}\n[boot] db=${env.DATABASE_URL}\n`);

  serverProc = spawn(node.bin, [apiEntry], {
    cwd: root,
    env: spawnEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProc.stdout.on("data", (d) => appendApiLog(d));
  serverProc.stderr.on("data", (d) => appendApiLog(d));
  serverProc.on("exit", (code) => {
    appendApiLog(`[api] exited ${code}\n`);
    serverProc = null;
  });

  return waitForHealth();
}

function stopApi() {
  if (!serverProc) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(serverProc.pid), "/f", "/t"], { windowsHide: true });
    } else {
      serverProc.kill("SIGTERM");
    }
  } catch {
    /* ignore */
  }
  serverProc = null;
}

/** ESC/POS cash drawer pulse: ESC p m t1 t2 */
function cashDrawerEscPos(pin = 0) {
  return Buffer.from([0x1b, 0x70, pin === 1 ? 1 : 0, 0x19, 0xfa]);
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `qx-cash-drawer-${Date.now()}.ps1`);
    fs.writeFileSync(tmp, script, "utf8");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmp],
      { windowsHide: true, timeout: 15000 },
      (err, stdout, stderr) => {
        try {
          fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
        if (err) {
          reject(new Error(stderr || err.message || "PowerShell failed"));
          return;
        }
        resolve(String(stdout || "").trim());
      }
    );
  });
}

async function sendRawToPrinter(printerName, bytes) {
  if (process.platform !== "win32") {
    throw new Error("Cash drawer raw print is supported on Windows desktop only");
  }
  const name = String(printerName || "").trim();
  if (!name) throw new Error("Printer name is required");
  const b64 = Buffer.from(bytes).toString("base64");
  const safeName = name.replace(/'/g, "''");
  const script = `
$ErrorActionPreference = 'Stop'
$printer = '${safeName}'
$bytes = [Convert]::FromBase64String('${b64}')
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class QxRawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
  public static bool Send(string printerName, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printerName, out h, IntPtr.Zero)) return false;
    DOCINFOA di = new DOCINFOA();
    di.pDocName = "QUANTUMEXE Cash Drawer";
    di.pDataType = "RAW";
    if (!StartDocPrinter(h, 1, di)) { ClosePrinter(h); return false; }
    if (!StartPagePrinter(h)) { EndDocPrinter(h); ClosePrinter(h); return false; }
    IntPtr p = Marshal.AllocCoTaskMem(data.Length);
    Marshal.Copy(data, 0, p, data.Length);
    int written = 0;
    bool ok = WritePrinter(h, p, data.Length, out written);
    Marshal.FreeCoTaskMem(p);
    EndPagePrinter(h);
    EndDocPrinter(h);
    ClosePrinter(h);
    return ok && written == data.Length;
  }
}
"@
$ok = [QxRawPrint]::Send($printer, $bytes)
if (-not $ok) { throw "Raw print to '$printer' failed. Check Windows printer name." }
Write-Output 'OK'
`;
  await runPowerShell(script);
}

async function listWindowsPrinters() {
  if (process.platform !== "win32") return [];
  try {
    const out = await runPowerShell(
      `Get-Printer | Select-Object -ExpandProperty Name | ForEach-Object { $_ }`
    );
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function setupCashDrawerIpc() {
  ipcMain.handle("cash-drawer-open", async (_evt, opts = {}) => {
    try {
      const printerName = String(opts.printerName || "XP-Q80T").trim();
      const pin = Number(opts.pin) === 1 ? 1 : 0;
      await sendRawToPrinter(printerName, cashDrawerEscPos(pin));
      return { ok: true, message: `Cash drawer pulse sent to ${printerName}` };
    } catch (e) {
      return { ok: false, message: String(e?.message || e) };
    }
  });

  ipcMain.handle("printers-list", async () => {
    try {
      return await listWindowsPrinters();
    } catch {
      return [];
    }
  });
}

async function ensureDatabase() {
  const root = bundleRoot();
  const dbFile = userDbPath();
  const seedDb = path.join(root, "prisma", "demo.sqlite");

  // Recreate if missing or empty/corrupt
  const needsSeed = !fs.existsSync(dbFile) || fs.statSync(dbFile).size < 1024;
  if (!needsSeed) return;

  if (fs.existsSync(seedDb) && fs.statSync(seedDb).size > 1024) {
    fs.copyFileSync(seedDb, dbFile);
    appendApiLog(`[db] Seeded from demo.sqlite -> ${dbFile}\n`);
    return;
  }

  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
  const schema = path.join(root, "prisma", "schema.prisma");
  if (!fs.existsSync(prismaCli) || !fs.existsSync(schema)) {
    throw new Error("No demo database packaged and prisma CLI missing.");
  }

  await new Promise((resolve, reject) => {
    const node = findNodeBinary(root);
    const spawnEnv = {
      ...process.env,
      DATABASE_URL: databaseUrlFor(dbFile),
    };
    if (node.asNode) spawnEnv.ELECTRON_RUN_AS_NODE = "1";
    const child = spawn(node.bin, [prismaCli, "db", "push", "--schema", schema, "--skip-generate"], {
      cwd: root,
      env: spawnEnv,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`prisma db push exit ${code}`))));
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: "QUANTUMEXE POS",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log("[update] Skipped in dev mode");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => console.log("[update] Checking…"));
  autoUpdater.on("update-available", (info) => {
    console.log("[update] Available:", info.version);
    if (mainWindow) {
      dialog
        .showMessageBox(mainWindow, {
          type: "info",
          title: "Update available",
          message: `QUANTUMEXE POS ${info.version} is downloading in the background.`,
          buttons: ["OK"],
        })
        .catch(() => undefined);
    }
  });
  autoUpdater.on("update-not-available", () => console.log("[update] Up to date"));
  autoUpdater.on("error", (err) => console.error("[update] Error:", err?.message || err));
  autoUpdater.on("update-downloaded", async (info) => {
    updateDownloaded = true;
    const win = mainWindow;
    const opts = {
      type: "info",
      title: "Update ready",
      message: `Version ${info.version} downloaded. Restart now to install?`,
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
    };
    const result = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
    if (result.response === 0) {
      stopApi();
      autoUpdater.quitAndInstall(false, true);
    }
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => console.error("[update]", e?.message || e));
  }, 8_000);
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => undefined);
  }, 6 * 60 * 60 * 1000);
}

app.whenReady().then(async () => {
  try {
    setupCashDrawerIpc();
    await ensureDatabase();
    await startApi();
    await createWindow();
    setupAutoUpdater();
  } catch (e) {
    const logPath = path.join(app.getPath("userData"), "api-start.log");
    dialog.showErrorBox(
      "QUANTUMEXE POS failed to start",
      `${String(e?.message || e)}\n\nLog: ${logPath}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopApi();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => stopApi());

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
