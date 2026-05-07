import { createServer } from "node:http";
import handler from "../lib/api-handler.js";

const PORT = Number(process.env.PORT ?? 8787);

createServer(handler).listen(PORT, "127.0.0.1", () => {
  console.log(`Orange Alliance API listening on http://127.0.0.1:${PORT}`);
});
