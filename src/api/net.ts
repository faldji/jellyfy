import { logger } from '@/lib/logger';

export type NetEvent = {
  at: number;
  method: string;
  path: string;
  ms: number;
  bytes?: number;
  status?: number;
  deduped?: boolean;
  cancelled?: boolean;
  cacheHit?: boolean;
  retries?: number;
  action?: string;
};

export type NetSummary = {
  total: number;
  wire: number;
  deduped: number;
  cancelled: number;
  cacheHits: number;
  bytes: number;
  avgMs: number;
  byPath: Record<string, number>;
  slowest: { path: string; ms: number }[];
  actions: Record<string, number>;
};

type Listener = (event: NetEvent) => void;

const listeners = new Set<Listener>();
const MAX_EVENTS = 200;
const events: NetEvent[] = [];
let currentAction: string | undefined;

function recording(): boolean {
  return (typeof __DEV__ !== 'undefined' && __DEV__) || listeners.size > 0;
}

export function subscribeNet(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function beginNetAction(action: string) {
  currentAction = action;
}

export function endNetAction() {
  currentAction = undefined;
}

export function emitNet(event: Omit<NetEvent, 'at' | 'action'> & { at?: number; action?: string }) {
  const full: NetEvent = {
    ...event,
    at: event.at ?? Date.now(),
    action: event.action ?? currentAction,
  };
  if (recording()) {
    events.push(full);
    if (events.length > MAX_EVENTS) events.shift();
  }
  listeners.forEach((listener) => listener(full));
  if (!recording()) return;
  if (full.deduped) {
    logger.debug(`${full.method} ${full.path} deduped`);
    return;
  }
  if (full.cancelled) {
    logger.debug(`${full.method} ${full.path} cancelled`);
    return;
  }
  if (full.cacheHit) {
    logger.debug(`${full.method} ${full.path} cache`);
    return;
  }
  logger.debug(`${full.method} ${full.path}`, {
    ms: full.ms,
    bytes: full.bytes,
    status: full.status,
    retries: full.retries,
  });
}

export function netEvents(): readonly NetEvent[] {
  return events;
}

export function summarizeNet(slice?: readonly NetEvent[]): NetSummary {
  const list = slice ?? events;
  const byPath: Record<string, number> = {};
  const actions: Record<string, number> = {};
  let bytes = 0;
  let timed = 0;
  let timedMs = 0;
  let wire = 0;
  let deduped = 0;
  let cancelled = 0;
  let cacheHits = 0;
  for (const event of list) {
    const key = `${event.method} ${event.path}`;
    byPath[key] = (byPath[key] ?? 0) + 1;
    if (event.action) actions[event.action] = (actions[event.action] ?? 0) + 1;
    if (event.deduped) deduped += 1;
    else if (event.cancelled) cancelled += 1;
    else if (event.cacheHit) cacheHits += 1;
    else {
      wire += 1;
      if (typeof event.bytes === 'number') bytes += event.bytes;
      if (event.ms > 0) {
        timed += 1;
        timedMs += event.ms;
      }
    }
  }
  const slowest = [...list]
    .filter((event) => !event.deduped && !event.cancelled && !event.cacheHit)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)
    .map((event) => ({ path: `${event.method} ${event.path}`, ms: event.ms }));
  return {
    total: list.length,
    wire,
    deduped,
    cancelled,
    cacheHits,
    bytes,
    avgMs: timed ? Math.round(timedMs / timed) : 0,
    byPath,
    slowest,
    actions,
  };
}

/** Test helper. */
export function resetNet() {
  events.length = 0;
  listeners.clear();
  currentAction = undefined;
}
