// Desktop bridges: printers, cash drawer, etc.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("quantumexeDesktop", {
  isDesktop: true,
  openCashDrawer: (opts) => ipcRenderer.invoke("cash-drawer-open", opts || {}),
  listPrinters: () => ipcRenderer.invoke("printers-list"),
});
