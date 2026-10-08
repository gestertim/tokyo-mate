import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const blocked = () => { throw new Error('TEST_ONLY_EXTERNAL_NETWORK_BLOCKED'); };
globalThis.fetch = async () => blocked();
http.request = blocked; http.get = blocked;
https.request = blocked; https.get = blocked;
net.connect = blocked; net.createConnection = blocked;
net.Socket.prototype.connect = blocked; tls.connect = blocked;

let slot, sequence = 0, waiting = false;
const send = (type) => {
  if (process.connected) process.send({ type, slot, sequence }, (error) => { if (error) process.exitCode = 1; });
};
process.on('message', (message) => {
  if (!message || Object.keys(message).length !== 3 ||
      !['type', 'slot', 'sequence'].every((name) => Object.hasOwn(message, name)) ||
      ![0, 1].includes(message.slot) || !Number.isSafeInteger(message.sequence)) {
    process.exit(1);
  }
  if (message.type === 'init' && slot === undefined && message.sequence === 0) {
    slot = message.slot; send('ready');
  } else if (message.type === 'release' && message.slot === slot && !waiting && message.sequence === sequence + 1) {
    sequence = message.sequence; waiting = true; send('execute');
  } else if (message.type === 'result' && message.slot === slot && waiting && message.sequence === sequence) {
    waiting = false; send('done');
  } else process.exit(1);
});
process.on('disconnect', () => process.exit(0));
