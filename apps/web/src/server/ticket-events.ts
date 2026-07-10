import { EventEmitter } from 'node:events';

// Single-process pub/sub for ticket message events. Fine for one web replica;
// if the deployment scales to multiple pods, swap this for Redis pub/sub so
// SSE subscribers on other replicas also receive the event.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export interface TicketMessageEvent {
  ticketId: string;
  messageId: string;
}

export function publishTicketMessage(event: TicketMessageEvent): void {
  emitter.emit(event.ticketId, event);
}

export function subscribeToTicket(
  ticketId: string,
  onMessage: (event: TicketMessageEvent) => void,
): () => void {
  emitter.on(ticketId, onMessage);
  return () => emitter.off(ticketId, onMessage);
}
