import { Response } from 'express';
import { store } from './store';

interface ClientConnection {
  pin: string;
  res: Response;
  role: 'host' | 'participant';
  id: string;
}

const clients: Map<string, ClientConnection[]> = new Map();

export function registerSSEClient(pin: string, res: Response, role: 'host' | 'participant', clientId: string) {
  const session = store.getSession(pin);
  const cleanPin = session ? session.pin : (pin || '').replace(/\D/g, '').trim() || (pin || '').trim();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial state immediately
  const participants = store.getParticipants(cleanPin);
  const answers = store.getParticipantAnswers(cleanPin);

  const initialPayload = {
    type: 'INIT_STATE',
    session,
    participants,
    answers,
    answersCount: answers.length,
    timestamp: Date.now(),
  };

  res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

  const pinClients = clients.get(cleanPin) || [];
  const conn = { pin: cleanPin, res, role, id: clientId };
  pinClients.push(conn);
  clients.set(cleanPin, pinClients);

  if (pin && pin !== cleanPin) {
    const rawClients = clients.get(pin) || [];
    rawClients.push(conn);
    clients.set(pin, rawClients);
  }

  // Remove client on close
  res.on('close', () => {
    const list = clients.get(cleanPin) || [];
    clients.set(
      cleanPin,
      list.filter((c) => c.res !== res)
    );
    if (pin && pin !== cleanPin) {
      const rawList = clients.get(pin) || [];
      clients.set(
        pin,
        rawList.filter((c) => c.res !== res)
      );
    }
  });
}

export function broadcastSessionEvent(pin: string, eventType: string, payloadData?: any) {
  const session = store.getSession(pin);
  const cleanPin = session ? session.pin : (pin || '').replace(/\D/g, '').trim() || (pin || '').trim();
  
  const cleanClients = clients.get(cleanPin) || [];
  const rawClients = pin && pin !== cleanPin ? (clients.get(pin) || []) : [];
  
  // Deduplicate connections
  const clientSet = new Set<ClientConnection>();
  cleanClients.forEach((c) => clientSet.add(c));
  rawClients.forEach((c) => clientSet.add(c));
  const pinClients = Array.from(clientSet);

  const participants = store.getParticipants(cleanPin);
  const answers = store.getParticipantAnswers(cleanPin);

  const eventPayload = {
    type: eventType,
    session,
    participants,
    answers,
    data: payloadData,
    timestamp: Date.now(),
  };

  const jsonString = JSON.stringify(eventPayload);

  if (pinClients.length === 0) return;

  pinClients.forEach((client) => {
    try {
      client.res.write(`data: ${jsonString}\n\n`);
    } catch (e) {
      console.error('SSE send error for client', client.id, e);
    }
  });
}
