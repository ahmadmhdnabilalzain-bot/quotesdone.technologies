/**
 * Leveled, namespaced logger: `const log = createLogger('3d:host')` prints as `qdt:3d:host`.
 * debug/info print only when enabled (?debug). warn/error always print: they mean something is wrong.
 * The last entries are kept in memory so the HUD can show the most recent error.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  ns: string;
  message: string;
  timeMs: number;
}

export interface Logger {
  debug(message: string, ...data: unknown[]): void;
  info(message: string, ...data: unknown[]): void;
  warn(message: string, ...data: unknown[]): void;
  error(message: string, ...data: unknown[]): void;
  /** Time an async or sync step and log `label 12 ms`. */
  time<T>(label: string, fn: () => T): T;
}

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const HISTORY_LIMIT = 50;

const state = {
  verbose: false,
  history: [] as LogEntry[],
  sink: console as Pick<Console, 'debug' | 'info' | 'warn' | 'error'>,
};

/** Turn verbose (debug + info) logging on or off. Called once at boot from the ?debug flag. */
export function setVerbose(on: boolean): void {
  state.verbose = on;
}

/** Test hook: redirect output. */
export function setSink(sink: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>): void {
  state.sink = sink;
}

export function logHistory(): readonly LogEntry[] {
  return state.history;
}

export function lastError(): LogEntry | undefined {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const entry = state.history[i];
    if (entry && entry.level === 'error') return entry;
  }
  return undefined;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function createLogger(ns: string): Logger {
  const prefix = `qdt:${ns}`;
  const emit = (level: LogLevel, message: string, data: unknown[]): void => {
    state.history.push({ level, ns: prefix, message, timeMs: now() });
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    if (!state.verbose && RANK[level] < RANK.warn) return;
    state.sink[level](`[${prefix}] ${message}`, ...data);
  };
  return {
    debug: (m, ...d) => emit('debug', m, d),
    info: (m, ...d) => emit('info', m, d),
    warn: (m, ...d) => emit('warn', m, d),
    error: (m, ...d) => emit('error', m, d),
    time<T>(label: string, fn: () => T): T {
      const start = now();
      const result = fn();
      if (result instanceof Promise) {
        return result.then((value) => {
          emit('info', `${label} ${Math.round(now() - start)} ms`, []);
          return value;
        }) as T;
      }
      emit('info', `${label} ${Math.round(now() - start)} ms`, []);
      return result;
    },
  };
}
