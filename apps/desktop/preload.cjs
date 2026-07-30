// Reserved for future desktop bridges (printers, etc.)
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("quantumexeDesktop", {
  isDesktop: true,
});
