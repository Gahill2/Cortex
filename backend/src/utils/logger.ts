import { env } from "../config/env.js";

type LogMeta = Record<string, unknown>;

const write = (level: string, message: string, meta?: LogMeta): void => {
  const line = {
    level,
    message,
    time: new Date().toISOString(),
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {})
  };
  const out = JSON.stringify(line);
  if (level === "error") {
    console.error(out);
  } else if (level === "warn") {
    console.warn(out);
  } else {
    console.log(out);
  }
};

export const logger = {
  info: (message: string, meta?: LogMeta) => write("info", message, meta),
  warn: (message: string, meta?: LogMeta) => write("warn", message, meta),
  error: (message: string, meta?: LogMeta) => write("error", message, meta),
  debug: (message: string, meta?: LogMeta) => {
    if (env.NODE_ENV === "development") write("debug", message, meta);
  }
};
