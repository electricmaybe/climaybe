import { existsSync, readdirSync, watch } from 'node:fs';
import { join } from 'node:path';

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function listDirsRecursively(rootDir) {
  const dirs = [];
  if (!existsSync(rootDir)) return dirs;

  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    dirs.push(dir);
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = join(dir, e.name);
      stack.push(full);
    }
  }
  return dirs;
}

export function watchTree({ rootDir, ignore = () => false, onChange, debounceMs = 300 } = {}) {
  if (!rootDir) throw new Error('watchTree: rootDir is required');
  if (typeof onChange !== 'function') throw new Error('watchTree: onChange is required');
  if (!existsSync(rootDir)) return { close: () => {} };

  const watchers = new Map();
  const debounced = debounce(onChange, debounceMs);

  function ensureWatched(dir) {
    if (watchers.has(dir)) return;
    try {
      const w = watch(dir, { persistent: true }, (eventType, filename) => {
        const name = typeof filename === 'string' ? filename : '';
        const full = name ? join(dir, name) : dir;
        if (ignore(full)) return;
        debounced(full, eventType);
        // Best-effort: new dirs can appear; rescan on any event.
        rescan();
      });
      watchers.set(dir, w);
    } catch {
      // ignore unwatcheable dirs
    }
  }

  function rescan() {
    const dirs = listDirsRecursively(rootDir);
    for (const d of dirs) ensureWatched(d);
  }

  rescan();

  return {
    close() {
      for (const w of watchers.values()) {
        try {
          w.close();
        } catch {
          // ignore
        }
      }
      watchers.clear();
    },
  };
}

