import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const blocked = (): never => { throw new Error('TEST_ONLY_EXTERNAL_NETWORK_BLOCKED'); };
globalThis.fetch = async () => blocked();
http.request = blocked;
http.get = blocked;
https.request = blocked;
https.get = blocked;
net.connect = blocked;
net.createConnection = blocked;
net.Socket.prototype.connect = blocked;
tls.connect = blocked;
