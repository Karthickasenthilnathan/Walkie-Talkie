import { io } from 'socket.io-client';

/**
 * Small Socket.IO client used by the benchmark runners.
 *
 * The default event names match the benchmark protocol. They can be changed
 * through `events` when a runner is testing a differently named server.
 */
class BenchmarkClient {
  constructor({
    url = 'http://localhost:3000',
    token,
    events = {},
    socketOptions = {},
  } = {}) {
    this.url = url;
    this.token = token;
    this.events = {
      join: 'channel:join',
      send: 'message:send',
      resume: 'resume',
      message: 'message:new',
      ...events,
    };

    this.lastSeq = null;
    this.messagesReceived = 0;
    this.latencies = [];

    this.socket = io(this.url, {
      ...socketOptions,
      autoConnect: false,
      auth: {
        ...(socketOptions.auth || {}),
        token: this.token,
      },
    });

    const recordMessage = (message) => {
      this.messagesReceived += 1;

      const sequence = message && (message.seq ?? message.sequence);
      if (Number.isFinite(Number(sequence))) {
        this.lastSeq = Number(sequence);
      }

      const sentAt = message && (
        message.sentAt
        ?? message.timestamp
        ?? message.createdAt
        ?? extractSentAt(message.content)
      );
      const sentAtMs = toMilliseconds(sentAt);
      if (sentAtMs !== null) {
        this.latencies.push(Math.max(0, Date.now() - sentAtMs));
      }
    };

    this.socket.on(this.events.message, recordMessage);
    this.socket.on('messages:replay', (messages) => {
      if (Array.isArray(messages)) messages.forEach(recordMessage);
    });
  }

  connect() {
    if (this.socket.connected) return Promise.resolve(this.socket);

    return new Promise((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve(this.socket);
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);
      this.socket.connect();
    });
  }

  join(channelId) {
    this.socket.emit(this.events.join, channelId);
    return this;
  }

  send(content) {
    this.socket.emit(this.events.send, content);
    return this;
  }

  resume(cursor) {
    this.socket.emit(this.events.resume, cursor);
    return this;
  }

  disconnect() {
    this.socket.disconnect();
    return this;
  }
}

function toMilliseconds(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && Number.isNaN(Number(value))) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  // Unix timestamps are commonly sent in either seconds or milliseconds.
  return number < 1e12 ? number * 1000 : number;
}

function extractSentAt(content) {
  if (typeof content !== 'string') return null;
  const match = content.match(/(?:sentAt|sent-at)[:=](\d{10,})/i);
  return match ? Number(match[1]) : null;
}

export { BenchmarkClient };
export default BenchmarkClient;
