import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MemoryConfig } from '../../types/config.js';
import { SessionNotFoundError } from '../../utils/errors.js';
import type { Message, SessionState } from '../../types/index.js';
import { randomId } from '../../utils/id.js';
import type { Session } from './types.js';

export class SessionManager {
  private readonly sessions = new Map<string, Session>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly config: MemoryConfig) {}

  private async withLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(sessionId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    this.locks.set(sessionId, next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(sessionId) === next) {
        this.locks.delete(sessionId);
      }
    }
  }

  async getOrCreateSession(sessionId: string, userId = 'anonymous', channel = 'direct'): Promise<Session> {
    return this.withLock(sessionId, async () => {
      const existing = await this.getSession(sessionId);
      if (existing) return existing;

      const session: Session = {
        id: sessionId,
        userId,
        channel,
        messages: [],
        context: {},
        createdAt: new Date(),
        lastActiveAt: new Date(),
        status: 'idle',
        metadata: {}
      };
      this.sessions.set(session.id, session);
      await this.persistSession(session);
      return session;
    });
  }

  async createSession(userId: string, channel: string): Promise<Session> {
    const sessionId = randomId();
    return this.getOrCreateSession(sessionId, userId, channel);
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const loaded = await this.loadSession(sessionId);
    if (loaded) this.sessions.set(sessionId, loaded);
    return loaded;
  }

  async requireSession(sessionId: string): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    return this.withLock(sessionId, async () => {
      const session = await this.requireSession(sessionId);
      session.messages.push(message);
      session.lastActiveAt = new Date();
      session.messages = this.truncateHistory(session.messages);
      await this.persistSession(session);
    });
  }

  async replaceMessages(sessionId: string, messages: Message[]): Promise<void> {
    return this.withLock(sessionId, async () => {
      const session = await this.requireSession(sessionId);
      session.messages = this.truncateHistory(messages);
      session.lastActiveAt = new Date();
      await this.persistSession(session);
    });
  }

  async setStatus(sessionId: string, status: SessionState['status']): Promise<void> {
    return this.withLock(sessionId, async () => {
      const session = await this.requireSession(sessionId);
      session.status = status;
      session.lastActiveAt = new Date();
      await this.persistSession(session);
    });
  }

  async getState(sessionId: string): Promise<SessionState> {
    const session = await this.requireSession(sessionId);
    return {
      sessionId,
      status: session.status,
      messageCount: session.messages.length,
      lastMessage: session.messages.at(-1)?.timestamp
    };
  }

  private truncateHistory(messages: Message[]): Message[] {
    if (messages.length <= this.config.maxHistoryLength) {
      return messages;
    }
    const keepRecent = Math.max(1, Math.floor(this.config.maxHistoryLength * 0.7));
    const keepImportant = this.config.maxHistoryLength - keepRecent;
    const recent = messages.slice(-keepRecent);
    const recentIds = new Set(recent.map((message) => message.id));
    const important = messages
      .filter((message) => message.isImportant && !recentIds.has(message.id))
      .slice(-keepImportant);
    return [...important, ...recent].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  private async persistSession(session: Session): Promise<void> {
    await mkdir(this.config.storagePath, { recursive: true });
    const filePath = join(this.config.storagePath, `${session.id}.json`);
    await writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  private async loadSession(sessionId: string): Promise<Session | undefined> {
    try {
      const filePath = join(this.config.storagePath, `${sessionId}.json`);
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Session;
      return reviveSession(parsed);
    } catch {
      return undefined;
    }
  }
}

function reviveSession(session: Session): Session {
  return {
    ...session,
    createdAt: new Date(session.createdAt),
    lastActiveAt: new Date(session.lastActiveAt),
    messages: session.messages.map((message) => ({
      ...message,
      timestamp: new Date(message.timestamp)
    }))
  };
}
