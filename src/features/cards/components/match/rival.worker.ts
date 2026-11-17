// The computer opponent's own thread (see state/rival.ts): the page stays smooth while it thinks.
import { rivalCore, type RivalRequest } from '@/features/cards/state/rival';

const handle = rivalCore();
const scope = self as unknown as { onmessage: ((e: MessageEvent<RivalRequest>) => void) | null; postMessage: (m: unknown) => void };
scope.onmessage = (e) => {
  const reply = handle(e.data);
  if (reply) scope.postMessage(reply);
};
