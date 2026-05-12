import * as Ably from 'ably';
import { apiFetch, authHeaders } from '../utils/api';

let client = null;
let clientToken = null;

export function getRealtime(token) {
  if (client && clientToken === token) return client;
  if (client) client.close();
  clientToken = token;
  client = new Ably.Realtime({
    authCallback: async (_tokenParams, callback) => {
      try {
        const res = await apiFetch('/realtime/ably-token', { headers: authHeaders(token) });
        const tokenRequest = await res.json();
        if (!res.ok) throw new Error(tokenRequest.error || 'Erro realtime');
        callback(null, tokenRequest);
      } catch (err) {
        callback(err, null);
      }
    },
  });
  return client;
}

export function getCallChannel(token, conversationId) {
  return getRealtime(token).channels.get(`call:${conversationId}`);
}

export function closeRealtime() {
  if (client) client.close();
  client = null;
  clientToken = null;
}
