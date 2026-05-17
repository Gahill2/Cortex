import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const listenHost = process.env.HOST?.trim() || "0.0.0.0";

app.listen(env.PORT, listenHost, () => {
  logger.info("Cortex API listening", {
    host: listenHost,
    port: env.PORT,
    nodeEnv: env.NODE_ENV
  });
});
