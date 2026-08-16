type LogMeta = Record<string, unknown> | unknown;

function write(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: LogMeta) {
  const line = `[jellyfy] ${message}`;
  if (meta === undefined) {
    console[level](line);
    return;
  }
  console[level](line, meta);
}

/** App logger. Skip noise; never log tokens, passwords, or full Authorization headers. */
export const logger = {
  debug(message: string, meta?: LogMeta) {
    if (__DEV__) write('debug', message, meta);
  },
  info(message: string, meta?: LogMeta) {
    if (__DEV__) write('info', message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    write('warn', message, meta);
  },
  error(message: string, meta?: LogMeta) {
    write('error', message, meta);
  },
};
