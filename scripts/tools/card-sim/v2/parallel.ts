// Plays experiment cells on worker threads. Every game is a pure function of (cell, game index),
// so results do not depend on how games are split between workers.
import { cpus } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { playCellGame, type CellSpec, type GameResult } from './cells';

interface Job { cell: number; from: number; to: number }

const CHUNK = 20;

export function threads(): number {
  const env = Number(process.env.SIM_THREADS);
  return env > 0 ? env : Math.max(1, cpus().length - 2);
}

const memo = new Map<string, GameResult[]>();
const keyOf = (c: CellSpec) => JSON.stringify(c, (_k, v) => (v === Infinity ? 'Infinity' : v));

/** Plays every game of every cell (a cell already played in this process is reused) */
export async function playCells(cells: CellSpec[], log = true): Promise<GameResult[][]> {
  const todo = cells.filter((c, i) => !memo.has(keyOf(c)) && cells.findIndex((d) => keyOf(d) === keyOf(c)) === i);
  const played = await playFresh(todo, log);
  todo.forEach((c, i) => memo.set(keyOf(c), played[i]));
  return cells.map((c) => memo.get(keyOf(c))!);
}

async function playFresh(cells: CellSpec[], log: boolean): Promise<GameResult[][]> {
  const jobs: Job[] = [];
  for (let c = 0; c < cells.length; c++) for (let from = 0; from < cells[c].games; from += CHUNK) jobs.push({ cell: c, from, to: Math.min(cells[c].games, from + CHUNK) });
  const results: GameResult[][] = cells.map(() => []);
  const n = threads();
  if (n === 1) {
    for (const j of jobs) for (let i = j.from; i < j.to; i++) results[j.cell].push(playCellGame(cells[j.cell], i));
    return results;
  }
  const total = jobs.length;
  let done = 0;
  const started = Date.now();
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, () => new Promise<void>((resolve, reject) => {
    // tsx registers its loader at run time, which workers do not inherit: register it again
    const w = new Worker(`require('tsx/cjs'); require(${JSON.stringify(join(__dirname, 'worker.ts'))});`, { eval: true });
    const next = () => {
      const j = jobs.shift();
      if (!j) { void w.terminate(); resolve(); return; }
      w.postMessage({ cell: cells[j.cell], cellIndex: j.cell, from: j.from, to: j.to });
    };
    w.on('message', (m: { cellIndex: number; games: GameResult[] }) => {
      results[m.cellIndex].push(...m.games);
      done++;
      if (log && (done % 25 === 0 || done === total)) process.stdout.write(`\r  ${done}/${total} chunks, ${((Date.now() - started) / 1000).toFixed(0)} s   `);
      next();
    });
    w.on('error', reject);
    next();
  })));
  if (log) process.stdout.write('\n');
  for (const r of results) r.sort((a, b) => a.i - b.i);
  return results;
}
