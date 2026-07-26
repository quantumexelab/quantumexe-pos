declare module "../api-dist/app.js" {
  import type { Request, Response } from "express";
  const app: (req: Request, res: Response) => void;
  export default app;
}
