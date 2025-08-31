"use strict";

const LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"];
const LOG_LEVEL = (process.env.LOG_LEVEL || "INFO").toUpperCase();
const threshold = Math.max(0, LEVELS.indexOf(LOG_LEVEL));

function emit(level, message, meta) {
  const idx = LEVELS.indexOf(level);
  if (idx < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta && typeof meta === "object" ? { meta } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "ERROR") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

module.exports = {
  debug: (msg, meta) => emit("DEBUG", msg, meta),
  info: (msg, meta) => emit("INFO", msg, meta),
  warn: (msg, meta) => emit("WARN", msg, meta),
  error: (msg, meta) => emit("ERROR", msg, meta),
};
