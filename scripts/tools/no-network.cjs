// Preloaded with `node --require` (through NODE_OPTIONS, so child processes load it too) by
// scripts/tools/build-offline.mjs. Every outgoing connection and every DNS lookup is refused as if
// the machine were offline, and written to the file in NO_NETWORK_LOG, so a build that tries the
// network fails the check even when the code that tried catches the error.
// Local pipes and Unix sockets (how Node talks to its own worker processes) stay allowed, and so
// does the loopback address.

'use strict';

const fs = require('fs');
const net = require('net');
const dns = require('dns');

const LOG = process.env.NO_NETWORK_LOG;
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

function record(kind, target) {
  const stack = (new Error().stack || '').split('\n').slice(3, 9).map((l) => l.trim()).join(' | ');
  const line = JSON.stringify({ pid: process.pid, kind, target, stack }) + '\n';
  if (LOG) fs.appendFileSync(LOG, line);
}

function offline(code, target) {
  const error = new Error(`no network during this run: ${target}`);
  error.code = code;
  return error;
}

if (process.env.NO_NETWORK_TRACE) fs.appendFileSync(process.env.NO_NETWORK_TRACE, `${process.pid}\n`);

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function connect(...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = typeof first === 'object' && first !== null ? first : null;
  const pathTarget = options ? options.path : typeof first === 'string' && Number.isNaN(Number(first)) ? first : undefined;
  if (pathTarget) return originalConnect.apply(this, args);
  const port = options ? options.port : first;
  const host = (options ? options.host : typeof args[1] === 'string' ? args[1] : undefined) || 'localhost';
  if (LOOPBACK.has(host)) return originalConnect.apply(this, args);
  const target = `${host}:${port}`;
  record('connect', target);
  process.nextTick(() => this.destroy(offline('ECONNREFUSED', target)));
  return this;
};

const originalLookup = dns.lookup;
dns.lookup = function lookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  if (LOOPBACK.has(hostname)) return originalLookup.call(dns, hostname, options, callback);
  record('dns', hostname);
  process.nextTick(() => cb(offline('ENOTFOUND', hostname)));
  return {};
};
const originalPromiseLookup = dns.promises.lookup;
dns.promises.lookup = async function lookup(hostname, options) {
  if (LOOPBACK.has(hostname)) return originalPromiseLookup.call(dns.promises, hostname, options);
  record('dns', hostname);
  throw offline('ENOTFOUND', hostname);
};
