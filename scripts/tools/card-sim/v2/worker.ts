// Worker thread for parallel.ts: plays the games it is sent and posts the results back.
import { parentPort } from 'node:worker_threads';
import { playCellGame, type CellSpec } from './cells';

parentPort!.on('message', (m: { cell: CellSpec; cellIndex: number; from: number; to: number }) => {
  const games = [];
  for (let i = m.from; i < m.to; i++) games.push(playCellGame(m.cell, i));
  parentPort!.postMessage({ cellIndex: m.cellIndex, games });
});
