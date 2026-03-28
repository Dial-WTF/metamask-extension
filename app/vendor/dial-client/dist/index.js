import { TimeoutError, AuthError, ApiError, NotFoundError, RateLimitError, PermissionDeniedError, NetworkError, ValidationError, BrowserStorage, MemoryStorage, IS_BROWSER, DEFAULT_NETWORK, API_BASE_URLS, getFetch, detectEnvironment, SDK_VERSION } from '@dial-wtf/core';
export { API_BASE_URLS, ApiError, AuthError, BrowserStorage, DEFAULT_NETWORK, DialError, ENVIRONMENT, IS_BROWSER, IS_BROWSER_LIKE, IS_EXTENSION, IS_NODE, MemoryStorage, NetworkError, NotFoundError, PermissionDeniedError, RateLimitError, SDK_VERSION, SessionExpiredError, TimeoutError, ValidationError, detectEnvironment, getFetch } from '@dial-wtf/core';
import EventEmitter3 from 'eventemitter3';

/* @dial-wtf/client - Universal TypeScript SDK */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var HttpClient = class {
  constructor(config) {
    __publicField(this, "config");
    __publicField(this, "authToken");
    __publicField(this, "sessionRefresher");
    __publicField(this, "refreshPromise");
    __publicField(this, "inflightGets", /* @__PURE__ */ new Map());
    this.config = config;
  }
  setAuthToken(token) {
    this.authToken = token;
  }
  getAuthToken() {
    return this.authToken;
  }
  /**
   * Register a callback to refresh the session on 401 (P2-5 fix).
   * The callback should refresh the session and return the new auth token.
   */
  setSessionRefresher(refresher) {
    this.sessionRefresher = refresher;
  }
  buildUrl(endpoint, params) {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = new URL(`${base}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== void 0) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }
  buildHeaders(customHeaders) {
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": `@dial-wtf/client`
    };
    if (this.config.apiKey) {
      headers["x-api-key"] = this.config.apiKey;
    }
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }
    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }
    return headers;
  }
  /**
   * Compose multiple AbortSignals into one.
   * Uses AbortSignal.any() where available (Node 20+, modern browsers),
   * falls back to manual composition.
   */
  composeSignals(signals) {
    const filtered = signals.filter(Boolean);
    if (filtered.length === 0) {
      const controller2 = new AbortController();
      return { signal: controller2.signal, cleanup: () => {
      } };
    }
    if (filtered.length === 1) {
      return { signal: filtered[0], cleanup: () => {
      } };
    }
    if ("any" in AbortSignal) {
      return {
        signal: AbortSignal.any(filtered),
        cleanup: () => {
        }
      };
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    for (const sig of filtered) {
      if (sig.aborted) {
        controller.abort();
        return { signal: controller.signal, cleanup: () => {
        } };
      }
      sig.addEventListener("abort", onAbort, { once: true });
    }
    const cleanup = () => {
      for (const sig of filtered) {
        sig.removeEventListener("abort", onAbort);
      }
    };
    return { signal: controller.signal, cleanup };
  }
  async request(endpoint, options = {}, _isRetry = false) {
    const { method = "GET", headers, body, timeout, signal } = options;
    const url = this.buildUrl(endpoint);
    const requestHeaders = this.buildHeaders(headers);
    const timeoutController = new AbortController();
    const timeoutMs = timeout != null ? timeout : this.config.timeout;
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const signals = [timeoutController.signal];
    if (signal) signals.push(signal);
    const { signal: composedSignal, cleanup } = this.composeSignals(signals);
    try {
      if (this.config.debug) {
        console.log(`[Dial SDK] ${method} ${url}`);
      }
      const response = await this.config.fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : void 0,
        signal: composedSignal
      });
      clearTimeout(timeoutId);
      cleanup();
      const contentType = response.headers.get("content-type");
      let data;
      if (contentType == null ? void 0 : contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      if (!response.ok) {
        if (response.status === 401 && !_isRetry && this.sessionRefresher) {
          const newToken = await this.refreshSession();
          this.setAuthToken(newToken);
          return this.request(endpoint, options, true);
        }
        this.handleErrorResponse(response.status, data, response.headers);
      }
      if (typeof data === "object" && data !== null && "data" in data) {
        return data.data;
      }
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      cleanup();
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new TimeoutError();
        }
        if (error instanceof AuthError && !_isRetry && this.sessionRefresher) {
          const newToken = await this.refreshSession();
          this.setAuthToken(newToken);
          return this.request(endpoint, options, true);
        }
        if (error instanceof ApiError || error instanceof AuthError || error instanceof NotFoundError || error instanceof RateLimitError || error instanceof PermissionDeniedError) {
          throw error;
        }
        throw new NetworkError(error.message);
      }
      throw new NetworkError("Unknown network error");
    }
  }
  /**
   * Refresh session, deduplicating concurrent refresh calls.
   * @internal
   */
  async refreshSession() {
    if (!this.refreshPromise) {
      this.refreshPromise = this.sessionRefresher().finally(() => {
        this.refreshPromise = void 0;
      });
    }
    return this.refreshPromise;
  }
  handleErrorResponse(status, body, headers) {
    switch (status) {
      case 401:
        throw new AuthError(this.getErrorMessage(body, "Unauthorized"));
      case 403:
        throw new PermissionDeniedError(this.getErrorMessage(body, "Permission denied"));
      case 404:
        throw new NotFoundError(this.getErrorMessage(body, "Endpoint not found"));
      case 429: {
        const retryAfter = headers.get("retry-after");
        throw new RateLimitError(
          this.getErrorMessage(body, "Rate limit exceeded"),
          retryAfter ? parseInt(retryAfter, 10) : void 0
        );
      }
      default:
        throw ApiError.fromResponse(status, body);
    }
  }
  getErrorMessage(body, fallback) {
    if (typeof body === "object" && body !== null) {
      const errorBody = body;
      if (typeof errorBody["error"] === "string") {
        return errorBody["error"];
      }
      if (typeof errorBody["message"] === "string") {
        return errorBody["message"];
      }
    }
    return fallback;
  }
  async get(endpoint, params, options) {
    const cacheKey = params ? this.buildUrl(endpoint, this.toUrlParams(params)) : endpoint;
    const inflight = this.inflightGets.get(cacheKey);
    if (inflight) return inflight;
    const promise = this.executeGet(endpoint, params, options);
    this.inflightGets.set(cacheKey, promise);
    promise.finally(() => this.inflightGets.delete(cacheKey));
    return promise;
  }
  async executeGet(endpoint, params, options) {
    if (params) {
      const urlParams = this.toUrlParams(params);
      const url = this.buildUrl(endpoint, urlParams);
      return this.request(url.replace(this.config.baseUrl, ""), __spreadProps(__spreadValues({}, options), {
        method: "GET"
      }));
    }
    return this.request(endpoint, __spreadProps(__spreadValues({}, options), {
      method: "GET"
    }));
  }
  toUrlParams(params) {
    const urlParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== void 0 && value !== null) {
        if (value instanceof Date) {
          urlParams[key] = value.toISOString();
        } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          urlParams[key] = value;
        } else {
          urlParams[key] = String(value);
        }
      }
    }
    return urlParams;
  }
  async post(endpoint, body, options) {
    return this.request(endpoint, __spreadProps(__spreadValues({}, options), {
      method: "POST",
      body
    }));
  }
  async put(endpoint, body, options) {
    return this.request(endpoint, __spreadProps(__spreadValues({}, options), {
      method: "PUT",
      body
    }));
  }
  async patch(endpoint, body, options) {
    return this.request(endpoint, __spreadProps(__spreadValues({}, options), {
      method: "PATCH",
      body
    }));
  }
  async delete(endpoint, options) {
    return this.request(endpoint, __spreadProps(__spreadValues({}, options), {
      method: "DELETE"
    }));
  }
};

// src/services/base.ts
var BaseService = class {
  constructor(http, apiVersion = "v1") {
    __publicField(this, "http");
    __publicField(this, "apiVersion");
    this.http = http;
    this.apiVersion = apiVersion;
  }
  endpoint(path) {
    return `/${this.apiVersion}${path}`;
  }
  rawEndpoint(path) {
    return path;
  }
};
var AuthService = class extends BaseService {
  constructor(http) {
    super(http);
  }
  async getNonce(address) {
    const response = await this.http.get(
      this.rawEndpoint("/siwe/nonce"),
      { address }
    );
    return response.nonce;
  }
  /**
   * Verify SIWE credentials and create session.
   *
   * Uses dynamic import() for siwe to avoid crashing if not installed (C1 fix).
   */
  async verifySiwe(message, signature) {
    let parsed;
    try {
      const { SiweMessage } = await import('siwe');
      const siweMsg = new SiweMessage(message);
      parsed = {
        address: siweMsg.address,
        chainId: siweMsg.chainId,
        nonce: siweMsg.nonce
      };
    } catch (e) {
      parsed = this.parseSiweFields(message);
    }
    const response = await this.http.post(
      this.rawEndpoint("/siwe/verify"),
      {
        message,
        signature,
        address: parsed.address,
        chainId: parsed.chainId,
        nonce: parsed.nonce
      }
    );
    return response;
  }
  async verifySiws(message, signature) {
    const response = await this.http.post(
      this.rawEndpoint("/siws/verify"),
      { message, signature }
    );
    return response;
  }
  async authenticate(credentials) {
    if (credentials.siwe) {
      return this.verifySiwe(
        credentials.siwe.message,
        credentials.siwe.signature
      );
    }
    if (credentials.siws) {
      return this.verifySiws(
        credentials.siws.message,
        credentials.siws.signature
      );
    }
    throw new ValidationError(
      "Either siwe or siws credentials must be provided"
    );
  }
  async validateSession(session) {
    try {
      const expiresAt = new Date(session.expiresAt);
      if (expiresAt <= /* @__PURE__ */ new Date()) {
        return false;
      }
      this.http.setAuthToken(session.token);
      const response = await this.http.get(
        this.rawEndpoint("/auth/validate")
      );
      return response.valid;
    } catch (e) {
      return false;
    }
  }
  async refreshSession(session) {
    if (!session.refreshToken) {
      throw new AuthError("No refresh token available");
    }
    const response = await this.http.post(
      this.rawEndpoint("/auth/refresh"),
      { refreshToken: session.refreshToken }
    );
    return response;
  }
  async logout() {
    await this.http.post(this.rawEndpoint("/auth/logout"));
  }
  getWalletAddress(session) {
    return session.walletAddress;
  }
  /**
   * Fallback SIWE message parser when the siwe package is not installed.
   * Extracts address, chainId, and nonce from the EIP-4361 formatted string.
   */
  parseSiweFields(message) {
    const lines = message.split("\n");
    let address = "";
    let chainId = 1;
    let nonce = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (i === 1 && /^0x[a-fA-F0-9]{40}$/.test(line)) {
        address = line;
      }
      if (line.startsWith("Chain ID:")) {
        chainId = parseInt(line.replace("Chain ID:", "").trim(), 10);
      }
      if (line.startsWith("Nonce:")) {
        nonce = line.replace("Nonce:", "").trim();
      }
    }
    return { address, chainId, nonce };
  }
};

// src/services/party-lines.ts
var PartyLinesService = class extends BaseService {
  constructor(http) {
    super(http);
  }
  async query(options) {
    return this.http.get(this.endpoint("/party-lines"), {
      isActive: options == null ? void 0 : options.isActive,
      search: options == null ? void 0 : options.search,
      limit: options == null ? void 0 : options.limit,
      offset: options == null ? void 0 : options.offset
    });
  }
  async getAll(options) {
    const response = await this.query(options);
    return response.partyLines;
  }
  async getActive(options) {
    const response = await this.query(__spreadProps(__spreadValues({}, options), { isActive: true }));
    return response.partyLines;
  }
  async search(searchTerm, options) {
    const response = await this.query(__spreadProps(__spreadValues({}, options), { search: searchTerm }));
    return response.partyLines;
  }
  async create(options) {
    return this.http.post(this.endpoint("/party-lines"), options);
  }
  async getByRoomCode(roomCode) {
    return this.http.get(this.endpoint(`/party-lines/code/${roomCode}`));
  }
  async getById(id) {
    return this.http.get(this.endpoint(`/party-lines/${id}`));
  }
};

// src/services/registry.ts
var RegistryService = class extends BaseService {
  constructor(http) {
    super(http);
  }
  async listPublicRooms(params) {
    return this.http.get(this.endpoint("/registry/rooms"), params ? { limit: params.limit, offset: params.offset } : void 0);
  }
  async getTokenInfo(contractAddress) {
    return this.http.get(this.endpoint(`/registry/tokens/${contractAddress}`));
  }
  async searchProfiles(options) {
    return this.http.get(this.endpoint("/registry/profiles/search"), options);
  }
  async getProfileByENS(ensName) {
    return this.http.get(this.endpoint(`/registry/ens/${ensName}`));
  }
  /**
   * Batch lookup profiles by wallet addresses.
   * Fetches up to 100 profiles in a single HTTP request.
   *
   * @example
   * ```typescript
   * const profiles = await dial.registry.getProfiles({
   *   addresses: ['0xabc...', '0xdef...']
   * });
   * ```
   */
  async getProfiles(options) {
    const profiles = await this.http.post(
      this.endpoint("/registry/profiles/batch"),
      { addresses: options.addresses }
    );
    const map = /* @__PURE__ */ new Map();
    for (const p of profiles) {
      map.set(p.walletAddress, p);
    }
    return map;
  }
  /**
   * Resolve the verified on-chain primary ENS name for an address.
   * Returns null if no reverse ENS record is set.
   *
   * @example
   * ```typescript
   * const ens = await dial.registry.resolveENS('0x123...');
   * // => { ensName: 'vitalik.eth', verified: true }
   * ```
   */
  async resolveENS(address) {
    try {
      return await this.http.get(
        this.endpoint(`/registry/ens/resolve/${address}`)
      );
    } catch (e) {
      return null;
    }
  }
};
var DialEventEmitter = class {
  constructor() {
    __publicField(this, "emitter");
    this.emitter = new EventEmitter3();
  }
  /**
   * Subscribe to an event
   */
  on(event, listener) {
    this.emitter.on(event, listener);
  }
  /**
   * Subscribe to an event (only fires once)
   */
  once(event, listener) {
    this.emitter.once(event, listener);
  }
  /**
   * Unsubscribe from an event
   */
  off(event, listener) {
    if (listener) {
      this.emitter.off(event, listener);
    } else {
      this.emitter.removeAllListeners(event);
    }
  }
  /**
   * Emit an event
   */
  emit(event, payload) {
    this.emitter.emit(event, payload);
  }
  /**
   * Remove all listeners
   */
  removeAllListeners(event) {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }
  /**
   * Get listener count for an event
   */
  listenerCount(event) {
    return this.emitter.listenerCount(event);
  }
};

// src/services/calls.ts
var CallsService = class extends BaseService {
  constructor(http) {
    super(http);
    __publicField(this, "localStream");
    __publicField(this, "remoteStreams", /* @__PURE__ */ new Map());
  }
  async start(options) {
    return this.http.post(this.endpoint("/calls"), options);
  }
  async answer(callId) {
    return this.http.post(this.endpoint(`/calls/${callId}/answer`));
  }
  async decline(callId, options) {
    await this.http.post(this.endpoint(`/calls/${callId}/decline`), options);
  }
  async end(callId) {
    await this.http.post(this.endpoint(`/calls/${callId}/end`));
  }
  async get(callId) {
    return this.http.get(this.endpoint(`/calls/${callId}`));
  }
  async getHistory(params) {
    const response = await this.http.get(
      this.endpoint("/calls"),
      params ? __spreadValues({}, params) : void 0
    );
    if (!Array.isArray(response) && "calls" in response) {
      return response.calls;
    }
    return response;
  }
  async mute(callId) {
    await this.http.post(this.endpoint(`/calls/${callId}/mute`));
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
  }
  async unmute(callId) {
    await this.http.post(this.endpoint(`/calls/${callId}/unmute`));
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }
  }
  async toggleMute(callId) {
    await this.http.post(this.endpoint(`/calls/${callId}/toggle-mute`));
  }
  async disableVideo(callId) {
    await this.http.post(this.endpoint(`/calls/${callId}/disable-video`));
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
    }
  }
  async enableVideo(callId) {
    await this.http.post(this.endpoint(`/calls/${callId}/enable-video`));
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
    }
  }
  async toggleVideo(callId) {
    await this.http.post(this.endpoint(`/calls/${callId}/toggle-video`));
  }
  async setSpeaker(callId, enabled) {
    await this.http.post(this.endpoint(`/calls/${callId}/speaker`), { enabled });
  }
  getLocalStream(_callId) {
    return this.localStream;
  }
  getRemoteStream(callId) {
    return this.remoteStreams.get(callId);
  }
  async startRecording(callId) {
    return this.http.post(this.endpoint(`/calls/${callId}/recording/start`));
  }
  async stopRecording(callId) {
    return this.http.post(this.endpoint(`/calls/${callId}/recording/stop`));
  }
  setRingtone(audioUrl) {
    if (typeof window !== "undefined" && typeof Audio !== "undefined") {
      const audio = new Audio(audioUrl);
      audio.preload = "auto";
    }
  }
  /** @internal */
  _setLocalStream(stream) {
    this.localStream = stream;
  }
  /** @internal */
  _setRemoteStream(callId, stream) {
    this.remoteStreams.set(callId, stream);
  }
  /** @internal */
  _clearStreams(callId) {
    this.remoteStreams.delete(callId);
  }
};

// src/services/chats.ts
var ChatService = class extends BaseService {
  constructor(http) {
    super(http);
  }
  async send(options) {
    var _a, _b;
    if ((_a = options.media) == null ? void 0 : _a.file) {
      return this.sendWithMedia(options);
    }
    return this.http.post(this.endpoint("/chat/messages"), {
      to: options.to,
      content: options.content,
      type: (_b = options.type) != null ? _b : "text",
      threadId: options.threadId,
      provider: options.provider,
      encrypted: options.encrypted,
      replyTo: options.replyTo,
      mentions: options.mentions
    });
  }
  async sendWithMedia(options) {
    var _a, _b, _c;
    return this.http.post(this.endpoint("/chat/messages"), {
      to: options.to,
      content: (_b = (_a = options.media) == null ? void 0 : _a.caption) != null ? _b : options.content,
      type: options.type,
      threadId: options.threadId,
      provider: options.provider,
      encrypted: options.encrypted,
      replyTo: options.replyTo,
      mentions: options.mentions,
      hasMedia: true,
      mediaDuration: (_c = options.media) == null ? void 0 : _c.duration
    });
  }
  async listThreads(params) {
    return this.http.get(this.endpoint("/chat/threads"), params ? __spreadValues({}, params) : void 0);
  }
  /** @deprecated Use listThreads() */
  async getConversations(params) {
    return this.listThreads(params);
  }
  async getThread(options) {
    return this.http.get(this.endpoint("/chat/threads"), {
      with: options.with,
      threadModel: options.threadModel,
      provider: options.provider
    });
  }
  /** @deprecated Use getThread() */
  async getConversation(options) {
    return this.getThread(options);
  }
  async listMessages(options) {
    var _a, _b;
    return this.http.get(this.endpoint("/chat/messages"), {
      with: options.with,
      threadId: options.threadId,
      before: (_a = options.before) == null ? void 0 : _a.toString(),
      after: (_b = options.after) == null ? void 0 : _b.toString(),
      limit: options.limit,
      offset: options.offset
    });
  }
  /** @deprecated Use listMessages() */
  async getMessages(options) {
    return this.listMessages(options);
  }
  async markAsRead(messageId) {
    await this.http.post(this.endpoint(`/chat/messages/${messageId}/read`));
  }
  async addReaction(options) {
    await this.http.post(this.endpoint(`/chat/messages/${options.messageId}/reactions`), { emoji: options.emoji });
  }
  async removeReaction(options) {
    await this.http.delete(this.endpoint(`/chat/messages/${options.messageId}/reactions/${encodeURIComponent(options.emoji)}`));
  }
  async startTyping(options) {
    await this.http.post(this.endpoint("/chat/typing"), { threadId: options.threadId, isTyping: true });
  }
  async stopTyping(options) {
    await this.http.post(this.endpoint("/chat/typing"), { threadId: options.threadId, isTyping: false });
  }
  async createDM(options) {
    return this.http.post(this.endpoint("/chat/threads"), { type: "dm", participants: [options.otherDialUserId] });
  }
  /** @deprecated Use createDM() or createGroup() */
  async createThread(options) {
    return this.http.post(this.endpoint("/chat/threads"), options);
  }
  async createManagedThread(options) {
    return this.http.post(this.endpoint("/chat/threads/managed"), options);
  }
  async listManagedThreads(options) {
    return this.http.get(this.endpoint("/chat/threads/managed"), options == null ? void 0 : options.filters);
  }
  async archiveThread(threadId) {
    await this.http.post(this.endpoint(`/chat/threads/${threadId}/archive`));
  }
  async createGroup(options) {
    return this.http.post(this.endpoint("/chat/threads"), {
      type: "group",
      name: options.name,
      participants: options.participants,
      provider: options.provider
    });
  }
  async inviteToGroup(options) {
    await this.http.post(this.endpoint(`/chat/threads/${options.groupId}/invite`), { addresses: options.addresses });
  }
  async addMember(options) {
    await this.http.post(this.endpoint(`/chat/threads/${options.threadId}/members`), { address: options.address });
  }
  /** @deprecated Use addMember() */
  async addGroupMember(options) {
    return this.addMember({ threadId: options.groupId, address: options.address });
  }
  async removeMember(options) {
    await this.http.delete(this.endpoint(`/chat/threads/${options.threadId}/members/${options.address}`));
  }
  /** @deprecated Use removeMember() */
  async removeGroupMember(options) {
    return this.removeMember({ threadId: options.groupId, address: options.address });
  }
  async leaveGroup(threadId) {
    await this.http.post(this.endpoint(`/chat/threads/${threadId}/leave`));
  }
  async updateGroup(options) {
    return this.http.patch(this.endpoint(`/chat/threads/${options.threadId}`), { name: options.name });
  }
  async delete(messageId, options) {
    await this.http.delete(this.endpoint(`/chat/messages/${messageId}`), {
      headers: (options == null ? void 0 : options.forEveryone) ? { "X-Delete-For-Everyone": "true" } : void 0
    });
  }
  async search(options) {
    return this.http.get(this.endpoint("/chat/messages/search"), options);
  }
};

// src/services/profile.ts
var ProfileService = class extends BaseService {
  constructor(http) {
    super(http);
  }
  async get() {
    return this.http.get(this.endpoint("/profile"));
  }
  async getProfile(options) {
    return this.http.get(this.endpoint(`/profiles/${options.walletAddress}`));
  }
  async update(options) {
    return this.http.patch(this.endpoint("/profile"), options);
  }
  async updateAvatar(_options) {
    return this.http.post(this.endpoint("/profile/avatar"), { hasAvatar: true });
  }
  async setStatus(status, options) {
    await this.http.post(this.endpoint("/profile/status"), { status, customMessage: options == null ? void 0 : options.customMessage });
  }
  async getStatus() {
    return this.http.get(this.endpoint("/profile/status"));
  }
  async updatePreferences(preferences) {
    await this.http.patch(this.endpoint("/profile/preferences"), preferences);
  }
  async updatePrivacy(privacy) {
    await this.http.patch(this.endpoint("/profile/privacy"), privacy);
  }
  async updateNotificationSettings(settings) {
    await this.http.patch(this.endpoint("/profile/notifications"), settings);
  }
  async enableDoNotDisturb(options) {
    await this.http.post(this.endpoint("/profile/dnd"), __spreadValues({ enabled: true }, options));
  }
  async disableDoNotDisturb() {
    await this.http.post(this.endpoint("/profile/dnd"), { enabled: false });
  }
  async blockUser(walletAddress) {
    await this.http.post(this.endpoint("/profile/blocked"), { walletAddress });
  }
  async unblockUser(walletAddress) {
    await this.http.delete(this.endpoint(`/profile/blocked/${walletAddress}`));
  }
  async getBlockedUsers() {
    return this.http.get(this.endpoint("/profile/blocked"));
  }
  async linkENS(options) {
    await this.http.post(this.endpoint("/profile/verify/ens"), options);
  }
  async verifyTwitter(options) {
    await this.http.post(this.endpoint("/profile/verify/twitter"), options);
  }
  async verifyGithub(options) {
    await this.http.post(this.endpoint("/profile/verify/github"), options);
  }
  /**
   * @deprecated Use `userDialer.contacts.add()` instead. ProfileService contact
   * methods bypass ContactsBook's cache and event system, causing stale reads.
   */
  async addContact(options) {
    return this.http.post(this.endpoint("/profile/contacts"), options);
  }
  /**
   * @deprecated Use `userDialer.contacts.getAll()` instead. ProfileService contact
   * methods bypass ContactsBook's cache and event system, causing stale reads.
   */
  async getContacts(params) {
    return this.http.get(this.endpoint("/profile/contacts"), params ? __spreadValues({}, params) : void 0);
  }
  /**
   * @deprecated Use `userDialer.contacts.update()` instead. ProfileService contact
   * methods bypass ContactsBook's cache and event system, causing stale reads.
   */
  async updateContact(options) {
    return this.http.patch(this.endpoint(`/profile/contacts/${options.walletAddress}`), options);
  }
  /**
   * @deprecated Use `userDialer.contacts.remove()` instead. ProfileService contact
   * methods bypass ContactsBook's cache and event system, causing stale reads.
   */
  async removeContact(walletAddress) {
    await this.http.delete(this.endpoint(`/profile/contacts/${walletAddress}`));
  }
};

// src/services/voicemail.ts
var VoicemailService = class extends BaseService {
  constructor(http) {
    super(http);
  }
  async startRecording(options) {
    return this.http.post(this.endpoint("/voicemails/record"), options);
  }
  async stopRecording(voicemailId) {
    return this.http.post(this.endpoint(`/voicemails/${voicemailId}/stop`));
  }
  async record(options) {
    return this.startRecording(options);
  }
  async getAll(options) {
    return this.http.get(this.endpoint("/voicemails"), { unreadOnly: options == null ? void 0 : options.unreadOnly, limit: options == null ? void 0 : options.limit, offset: options == null ? void 0 : options.offset });
  }
  async get(voicemailId) {
    return this.http.get(this.endpoint(`/voicemails/${voicemailId}`));
  }
  async markAsRead(voicemailId) {
    await this.http.post(this.endpoint(`/voicemails/${voicemailId}/read`));
  }
  async transcribe(voicemailId) {
    return this.http.post(this.endpoint(`/voicemails/${voicemailId}/transcribe`));
  }
  async delete(voicemailId) {
    await this.http.delete(this.endpoint(`/voicemails/${voicemailId}`));
  }
  async archive(voicemailId) {
    await this.http.post(this.endpoint(`/voicemails/${voicemailId}/archive`));
  }
  async getArchived() {
    return this.http.get(this.endpoint("/voicemails/archived"));
  }
  async download(voicemailId) {
    const voicemail = await this.get(voicemailId);
    const response = await fetch(voicemail.audioUrl);
    return response.blob();
  }
  async getWaveform(voicemailId) {
    return this.http.get(this.endpoint(`/voicemails/${voicemailId}/waveform`));
  }
  async setGreeting(options) {
    return this.http.post(this.endpoint("/voicemails/greeting"), { text: options.text, voice: options.voice, duration: options.duration, hasAudioFile: !!options.audioFile });
  }
  async getGreeting() {
    return this.http.get(this.endpoint("/voicemails/greeting"));
  }
  async enable() {
    await this.http.post(this.endpoint("/voicemails/settings"), { enabled: true });
  }
  async disable() {
    await this.http.post(this.endpoint("/voicemails/settings"), { enabled: false });
  }
  async isEnabled() {
    const r = await this.http.get(this.endpoint("/voicemails/settings"));
    return r.enabled;
  }
  async setNotificationPreferences(preferences) {
    await this.http.post(this.endpoint("/voicemails/notifications"), preferences);
  }
};

// src/services/conference.ts
var ConferenceService = class extends BaseService {
  constructor(http) {
    super(http);
    __publicField(this, "participantStreams", /* @__PURE__ */ new Map());
    __publicField(this, "_mediaProvider", null);
  }
  setMediaProvider(provider) {
    this._mediaProvider = provider;
  }
  get mediaProvider() {
    return this._mediaProvider;
  }
  async connectMedia(room, userName, config) {
    if (!this._mediaProvider) throw new Error("No media provider set. Call setMediaProvider() first.");
    if (!room.mediaToken) throw new Error("Room has no mediaToken. Backend may not have HMS integration enabled.");
    await this._mediaProvider.connect({ authToken: room.mediaToken, userName, roomId: room.hmsRoomId }, config);
  }
  async disconnectMedia() {
    if (!this._mediaProvider) return;
    try {
      await this._mediaProvider.disconnect();
    } catch (err) {
      console.warn("[Dial SDK] Media disconnect error (non-fatal):", err);
    }
  }
  async create(options) {
    return this.http.post(this.endpoint("/conference/rooms"), options);
  }
  async join(options) {
    const response = await this.http.post(this.endpoint(`/conference/rooms/${options.roomId}/join`), { video: options.video, audio: options.audio, displayName: options.displayName });
    return this.normalizeRoomResponse(response);
  }
  async joinByUrl(options) {
    const response = await this.http.post(this.endpoint("/conference/rooms/join-by-url"), options);
    return this.normalizeRoomResponse(response);
  }
  normalizeRoomResponse(response) {
    var _b, _c;
    const _a = response, { token, role } = _a, rest = __objRest(_a, ["token", "role"]);
    return __spreadProps(__spreadValues({}, rest), { mediaToken: (_b = rest.mediaToken) != null ? _b : token, mediaRole: (_c = rest.mediaRole) != null ? _c : role });
  }
  async leave(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/leave`));
    this.participantStreams.delete(roomId);
    await this.disconnectMedia();
  }
  async getParticipants(roomId) {
    return this.http.get(this.endpoint(`/conference/rooms/${roomId}/participants`));
  }
  getParticipantStream(roomId, participantId) {
    return this.participantStreams.get(`${roomId}:${participantId}`);
  }
  async muteAudio(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/mute-audio`));
    this._mediaDispatch(() => this._mediaProvider.setLocalAudioEnabled(false));
  }
  async unmuteAudio(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/unmute-audio`));
    this._mediaDispatch(() => this._mediaProvider.setLocalAudioEnabled(true));
  }
  async muteParticipant(roomId, participantId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/participants/${participantId}/mute`));
  }
  async muteAll(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/mute-all`));
  }
  async disableVideo(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/disable-video`));
    this._mediaDispatch(() => this._mediaProvider.setLocalVideoEnabled(false));
  }
  async enableVideo(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/enable-video`));
    this._mediaDispatch(() => this._mediaProvider.setLocalVideoEnabled(true));
  }
  async requestVideo(roomId, participantId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/participants/${participantId}/request-video`));
  }
  async startScreenShare(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/screen-share/start`));
    this._mediaDispatch(() => this._mediaProvider.startScreenShare());
  }
  async stopScreenShare(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/screen-share/stop`));
    this._mediaDispatch(() => this._mediaProvider.stopScreenShare());
  }
  async startRecording(roomId) {
    return this.http.post(this.endpoint(`/conference/rooms/${roomId}/recording/start`));
  }
  async stopRecording(roomId) {
    return this.http.post(this.endpoint(`/conference/rooms/${roomId}/recording/stop`));
  }
  async getRecordings(roomId) {
    return this.http.get(this.endpoint(`/conference/rooms/${roomId}/recordings`));
  }
  async sendMessage(roomId, options) {
    return this.http.post(this.endpoint(`/conference/rooms/${roomId}/messages`), options);
  }
  async setLayout(roomId, layout, options) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/layout`), __spreadValues({ layout }, options));
  }
  async end(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/end`));
  }
  async removeParticipant(roomId, participantId) {
    await this.http.delete(this.endpoint(`/conference/rooms/${roomId}/participants/${participantId}`));
  }
  async transferHost(roomId, newHostParticipantId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/transfer-host`), { participantId: newHostParticipantId });
  }
  async createBreakoutRooms(roomId, options) {
    return this.http.post(this.endpoint(`/conference/rooms/${roomId}/breakout-rooms`), options);
  }
  async moveToBreakout(roomId, participantId, breakoutRoomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/breakout-rooms/${breakoutRoomId}/move`), { participantId });
  }
  async closeBreakoutRooms(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/breakout-rooms/close`));
  }
  async createPoll(roomId, options) {
    return this.http.post(this.endpoint(`/conference/rooms/${roomId}/polls`), options);
  }
  async vote(roomId, pollId, optionIndex) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/polls/${pollId}/vote`), { optionIndex });
  }
  async getPollResults(roomId, pollId) {
    return this.http.get(this.endpoint(`/conference/rooms/${roomId}/polls/${pollId}/results`));
  }
  async raiseHand(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/raise-hand`));
  }
  async lowerHand(roomId) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/lower-hand`));
  }
  async setVideoQuality(roomId, settings) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/quality`), settings);
  }
  async setAdaptiveQuality(roomId, enabled) {
    await this.http.post(this.endpoint(`/conference/rooms/${roomId}/adaptive-quality`), { enabled });
  }
  async getStats(roomId) {
    return this.http.get(this.endpoint(`/conference/rooms/${roomId}/stats`));
  }
  /** @internal */
  _setParticipantStream(roomId, participantId, stream) {
    this.participantStreams.set(`${roomId}:${participantId}`, stream);
  }
  _mediaDispatch(fn) {
    if (!this._mediaProvider) return;
    fn().catch((err) => {
      console.warn("[Dial SDK] Media provider error (non-fatal):", err);
    });
  }
};
var ContactsBook = class {
  constructor(provider, config) {
    __publicField(this, "provider");
    __publicField(this, "emitter", new EventEmitter3());
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "loaded", false);
    this.provider = provider;
    if ((config == null ? void 0 : config.autoLoad) === true) {
      this.load().catch(() => {
      });
    }
  }
  async load() {
    const contacts = await this.provider.getAll();
    this.cache.clear();
    for (const c of contacts) {
      this.cache.set(c.walletAddress.toLowerCase(), c);
    }
    this.loaded = true;
    this.emit("contacts:loaded", { contacts });
    return contacts;
  }
  async getAll() {
    if (!this.loaded) await this.load();
    return Array.from(this.cache.values());
  }
  async get(walletAddress) {
    var _a;
    if (!this.loaded) await this.load();
    return (_a = this.cache.get(walletAddress.toLowerCase())) != null ? _a : null;
  }
  async has(walletAddress) {
    if (!this.loaded) await this.load();
    return this.cache.has(walletAddress.toLowerCase());
  }
  async add(options) {
    const contact = await this.provider.add(options);
    this.cache.set(contact.walletAddress.toLowerCase(), contact);
    this.emit("contact:added", { contact });
    return contact;
  }
  async update(options) {
    const contact = await this.provider.update(options);
    this.cache.set(contact.walletAddress.toLowerCase(), contact);
    this.emit("contact:updated", { contact });
    return contact;
  }
  async remove(walletAddress) {
    await this.provider.remove(walletAddress);
    this.cache.delete(walletAddress.toLowerCase());
    this.emit("contact:removed", { walletAddress });
  }
  on(event, callback) {
    this.emitter.on(event, callback);
  }
  off(event, callback) {
    if (callback) {
      this.emitter.off(event, callback);
    } else {
      this.emitter.removeAllListeners(event);
    }
  }
  removeAllListeners() {
    this.emitter.removeAllListeners();
  }
  emit(event, payload) {
    this.emitter.emit(event, payload);
  }
};
var LocalContactsBookProvider = class {
  constructor(options) {
    __publicField(this, "storageKey");
    __publicField(this, "storage");
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "loaded", false);
    var _a, _b;
    const prefix = (_a = options.storagePrefix) != null ? _a : "dial_contacts";
    this.storageKey = `${prefix}:${options.walletAddress.toLowerCase()}`;
    this.storage = (_b = options.storage) != null ? _b : IS_BROWSER ? new BrowserStorage() : new MemoryStorage();
  }
  async getAll() {
    await this.ensureLoaded();
    return Array.from(this.cache.values());
  }
  async get(walletAddress) {
    var _a;
    await this.ensureLoaded();
    return (_a = this.cache.get(walletAddress.toLowerCase())) != null ? _a : null;
  }
  async add(options) {
    var _a;
    await this.ensureLoaded();
    const key = options.walletAddress.toLowerCase();
    const contact = {
      walletAddress: options.walletAddress,
      profile: {
        walletAddress: options.walletAddress,
        displayName: (_a = options.nickname) != null ? _a : options.walletAddress,
        status: "offline",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      nickname: options.nickname,
      tags: options.tags,
      addedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.cache.set(key, contact);
    await this.persist();
    return contact;
  }
  async update(options) {
    var _a, _b, _c;
    await this.ensureLoaded();
    const key = options.walletAddress.toLowerCase();
    const existing = this.cache.get(key);
    if (!existing) {
      throw new NotFoundError(`Contact ${options.walletAddress} not found`);
    }
    const updated = __spreadProps(__spreadValues({}, existing), {
      nickname: (_a = options.nickname) != null ? _a : existing.nickname,
      tags: (_b = options.tags) != null ? _b : existing.tags,
      notes: (_c = options.notes) != null ? _c : existing.notes
    });
    this.cache.set(key, updated);
    await this.persist();
    return updated;
  }
  async remove(walletAddress) {
    await this.ensureLoaded();
    this.cache.delete(walletAddress.toLowerCase());
    await this.persist();
  }
  async has(walletAddress) {
    await this.ensureLoaded();
    return this.cache.has(walletAddress.toLowerCase());
  }
  async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await this.storage.getItem(this.storageKey);
      if (raw) {
        const contacts = JSON.parse(raw);
        for (const c of contacts) {
          this.cache.set(c.walletAddress.toLowerCase(), c);
        }
      }
    } catch (e) {
      this.cache.clear();
    }
  }
  async persist() {
    try {
      const contacts = Array.from(this.cache.values());
      await this.storage.setItem(this.storageKey, JSON.stringify(contacts));
    } catch (e) {
    }
  }
};

// src/client/user-dialer.ts
var UserDialer = class {
  constructor(http, session, contactsProvider, contactsConfig, authService) {
    __publicField(this, "http");
    __publicField(this, "session");
    __publicField(this, "events");
    /** @internal */
    __publicField(this, "authService");
    /**
     * Calls service - wallet-to-wallet audio/video calling
     *
     * @remarks
     * - `start()`, `answer()`, `decline()`, `end()` - Isomorphic
     * - `getLocalStream()`, `getRemoteStream()` - Browser only
     *
     * @example
     * ```typescript
     * // Start a video call
     * const call = await userDialer.calls.start({
     *   to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
     *   type: 'video'
     * });
     * ```
     */
    __publicField(this, "calls");
    /**
     * Chat service - E2EE DMs and Groups
     *
     * @remarks
     * All methods are isomorphic and work in both browser and Node.js.
     * Uses Signal Protocol for DMs and Sender Keys for Groups.
     *
     * @example
     * ```typescript
     * // Send a message
     * await userDialer.chat.send({
     *   to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
     *   content: 'Hello!'
     * });
     *
     * // Create a DM
     * const dm = await userDialer.chat.createDM({
     *   otherDialUserId: '0x...'
     * });
     *
     * // Create a group
     * const group = await userDialer.chat.createGroup({
     *   name: 'My Group',
     *   participants: ['0x...', '0x...']
     * });
     * ```
     */
    __publicField(this, "chat");
    /**
     * Messages service - wallet-to-wallet messaging
     * @deprecated Use chat instead
     */
    __publicField(this, "messages");
    /**
     * Profile service - manage user profiles
     *
     * @remarks
     * All methods are isomorphic except `updateAvatar()` which uses File API.
     *
     * @example
     * ```typescript
     * // Get current profile
     * const profile = await userDialer.profile.get();
     * ```
     */
    __publicField(this, "profile");
    /**
     * Voicemail service - manage voicemails
     *
     * @remarks
     * - `getAll()`, `get()`, `markAsRead()`, `transcribe()` - Isomorphic
     * - `download()` - Browser only (uses Blob)
     *
     * @example
     * ```typescript
     * // Get all voicemails
     * const voicemails = await userDialer.voicemail.getAll();
     * ```
     */
    __publicField(this, "voicemail");
    /**
     * Conference service - video conferencing
     *
     * @remarks
     * - Room management methods are isomorphic
     * - Media streaming methods are browser only
     *
     * @example
     * ```typescript
     * // Create a conference room
     * const room = await userDialer.conference.create({
     *   name: 'Team Standup',
     *   maxParticipants: 10
     * });
     * ```
     */
    __publicField(this, "conference");
    /**
     * Contacts book - manage user contacts
     *
     * @remarks
     * Uses LocalContactsBookProvider by default (localStorage in browser).
     * Supply a custom IContactsBookProvider via `setContactsProvider()` to
     * use API-backed or custom storage.
     *
     * @example
     * ```typescript
     * // Add a contact
     * await userDialer.contacts.add({ walletAddress: '0x...' });
     *
     * // List contacts
     * const contacts = await userDialer.contacts.getAll();
     *
     * // Listen for changes
     * userDialer.contacts.on('contact:added', ({ contact }) => {
     *   console.log('Added:', contact.walletAddress);
     * });
     * ```
     */
    __publicField(this, "contacts");
    this.http = http;
    this.session = session;
    this.events = new DialEventEmitter();
    this.http.setAuthToken(session.token);
    this.authService = authService != null ? authService : new AuthService(http);
    this.calls = new CallsService(http);
    this.chat = new ChatService(http);
    this.messages = this.chat;
    this.profile = new ProfileService(http);
    this.voicemail = new VoicemailService(http);
    this.conference = new ConferenceService(http);
    if (session.refreshToken) {
      this.http.setSessionRefresher(async () => {
        const newSession = await this.authService.refreshSession(this.session);
        this.session = __spreadValues(__spreadValues({}, this.session), newSession);
        return newSession.token;
      });
    }
    const provider = contactsProvider != null ? contactsProvider : new LocalContactsBookProvider({
      walletAddress: session.walletAddress
    });
    this.contacts = new ContactsBook(provider, contactsConfig);
  }
  /**
   * Replace the contacts book provider at runtime
   *
   * @example
   * ```typescript
   * import { ApiContactsBookProvider } from '@dial-wtf/client';
   * userDialer.setContactsProvider(new ApiContactsBookProvider(httpClient));
   * ```
   */
  setContactsProvider(provider, config) {
    this.contacts.removeAllListeners();
    this.contacts = new ContactsBook(provider, config);
  }
  /**
   * Get the authenticated user's wallet address
   */
  get walletAddress() {
    return this.session.walletAddress;
  }
  /**
   * Check if the session is still valid
   */
  async isSessionValid() {
    return this.authService.validateSession(this.session);
  }
  /**
   * Export session data for persistence
   *
   * @remarks
   * Store this data securely (e.g., localStorage, secure cookie) to restore sessions later.
   *
   * @example
   * ```typescript
   * const sessionData = userDialer.exportSession();
   * localStorage.setItem('dial_session', JSON.stringify(sessionData));
   * ```
   */
  exportSession() {
    return __spreadValues({}, this.session);
  }
  /**
   * Logout and invalidate the session
   */
  async logout() {
    await this.authService.logout();
    this.http.setAuthToken(void 0);
    this.events.removeAllListeners();
  }
  /**
   * Subscribe to events
   *
   * @example
   * ```typescript
   * userDialer.on('call:incoming', (call) => {
   *   console.log('Incoming call from:', call.from);
   * });
   * ```
   */
  on(event, listener) {
    this.events.on(event, listener);
  }
  /**
   * Subscribe to an event (only fires once)
   */
  once(event, listener) {
    this.events.once(event, listener);
  }
  /**
   * Unsubscribe from events
   */
  off(event, listener) {
    this.events.off(event, listener);
  }
  /**
   * Emit an event (internal use)
   * @internal
   */
  _emit(event, payload) {
    this.events.emit(event, payload);
  }
};

// src/client/dial-client.ts
var DialClient = class {
  /**
   * Create a new DialClient instance
   *
   * @param config - Client configuration options
   */
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "http");
    /**
     * Authentication service
     *
     * @remarks
     * Isomorphic - works in both browser and Node.js
     *
     * @example
     * ```typescript
     * // Get nonce for SIWE message
     * const nonce = await dial.auth.getNonce();
     * ```
     */
    __publicField(this, "auth");
    /**
     * Party Lines service - query and create party lines
     *
     * @remarks
     * Isomorphic - works in both browser and Node.js
     * Read operations don't require authentication.
     * Write operations require an API key.
     *
     * @example
     * ```typescript
     * // Get active party lines (no auth required)
     * const partyLines = await dial.partyLines.getActive();
     *
     * // Create party line (requires API key)
     * const room = await dial.partyLines.create({
     *   owner: '0x...',
     *   name: 'My Room'
     * });
     * ```
     */
    __publicField(this, "partyLines");
    /**
     * Registry service - public registry features
     *
     * @remarks
     * Isomorphic - works in both browser and Node.js
     * No authentication required.
     *
     * @example
     * ```typescript
     * // Search profiles
     * const profiles = await dial.registry.searchProfiles({ query: 'alice' });
     *
     * // Get profile by ENS
     * const profile = await dial.registry.getProfileByENS('alice.eth');
     * ```
     */
    __publicField(this, "registry");
    this.config = this.resolveConfig(config);
    this.http = new HttpClient(this.config);
    this.auth = new AuthService(this.http);
    this.partyLines = new PartyLinesService(this.http);
    this.registry = new RegistryService(this.http);
  }
  /**
   * Resolve configuration with defaults
   */
  resolveConfig(config) {
    var _a, _b, _c, _d, _e;
    const network = (_a = config.network) != null ? _a : DEFAULT_NETWORK;
    const baseUrl = (_b = config.baseUrl) != null ? _b : API_BASE_URLS[network];
    return {
      apiKey: config.apiKey,
      baseUrl,
      timeout: (_c = config.timeout) != null ? _c : 3e4,
      debug: (_d = config.debug) != null ? _d : false,
      fetch: (_e = config.fetch) != null ? _e : getFetch()
    };
  }
  /**
   * Authenticate and create a user-bound client
   *
   * @remarks
   * Pass either SIWE (Ethereum) or SIWS (Solana) credentials.
   * Returns a UserDialer instance with access to all authenticated features.
   *
   * @example
   * ```typescript
   * // With SIWE (Ethereum)
   * const userDialer = await dial.asUser({
   *   siwe: { message, signature }
   * });
   *
   * // With SIWS (Solana)
   * const userDialer = await dial.asUser({
   *   siws: { message, signature }
   * });
   * ```
   */
  async asUser(credentials) {
    if (!credentials.siwe && !credentials.siws) {
      throw new ValidationError(
        "Either siwe or siws credentials must be provided"
      );
    }
    const authResult = await this.auth.authenticate(credentials);
    return new UserDialer(this.http, authResult.session, void 0, void 0, this.auth);
  }
  /**
   * Restore a session from exported session data
   *
   * @remarks
   * Use this to restore a previously authenticated session without
   * requiring the user to sign again.
   *
   * @example
   * ```typescript
   * // Restore from localStorage
   * const sessionData = JSON.parse(localStorage.getItem('dial_session'));
   * const userDialer = await dial.restoreSession(sessionData);
   *
   * // Validate session is still active
   * if (await userDialer.isSessionValid()) {
   *   console.log('Session restored successfully');
   * }
   * ```
   */
  async restoreSession(session) {
    if (!session.walletAddress || !session.token || !session.expiresAt) {
      throw new ValidationError("Invalid session data");
    }
    const expiresAt = new Date(session.expiresAt);
    if (expiresAt <= /* @__PURE__ */ new Date()) {
      throw new ValidationError("Session has expired");
    }
    return new UserDialer(this.http, session, void 0, void 0, this.auth);
  }
  /**
   * Simple SIWE authentication helper
   *
   * @remarks
   * Browser only - requires wallet provider.
   * Handles SIWE message creation and signing internally.
   *
   * @example
   * ```typescript
   * // With ethers.js signer
   * const userDialer = await dial.authenticateWithWallet({
   *   wallet: signer,
   *   chainId: 1
   * });
   * ```
   */
  async authenticateWithWallet(options) {
    var _a, _b;
    const address = await options.wallet.getAddress();
    const nonce = await this.auth.getNonce(address);
    const domain = (_a = options.domain) != null ? _a : this.detectDomain();
    const uri = (_b = options.uri) != null ? _b : this.detectUri();
    const issuedAt = (/* @__PURE__ */ new Date()).toISOString();
    const message = [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      "Sign in to Dial",
      "",
      `URI: ${uri}`,
      `Version: 1`,
      `Chain ID: ${options.chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`
    ].join("\n");
    const signature = await options.wallet.signMessage(message);
    return this.asUser({
      siwe: { message, signature }
    });
  }
  /**
   * Simple SIWS authentication helper for Solana
   *
   * @remarks
   * Browser only - requires Solana wallet adapter.
   *
   * @example
   * ```typescript
   * // With Solana wallet adapter
   * const userDialer = await dial.authenticateWithSolana({
   *   wallet: solanaWallet
   * });
   * ```
   */
  async authenticateWithSolana(options) {
    var _a, _b;
    const address = options.wallet.publicKey.toBase58();
    const nonce = await this.auth.getNonce(address);
    const domain = (_a = options.domain) != null ? _a : this.detectDomain();
    const uri = (_b = options.uri) != null ? _b : this.detectUri();
    const issuedAt = (/* @__PURE__ */ new Date()).toISOString();
    const message = [
      `${domain} wants you to sign in with your Solana account:`,
      address,
      "",
      "Sign in to Dial",
      "",
      `URI: ${uri}`,
      `Version: 1`,
      `Chain ID: mainnet`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`
    ].join("\n");
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = await options.wallet.signMessage(messageBytes);
    const signature = this.uint8ArrayToBase58(signatureBytes);
    return this.asUser({
      siws: { message, signature }
    });
  }
  /**
   * Auto-detect the SIWE/SIWS domain from the current environment.
   * Returns the hostname for browsers, the extension origin for extensions,
   * or 'dial.wtf' as the fallback.
   * @internal
   */
  detectDomain() {
    const env = detectEnvironment();
    if (env === "extension") {
      const chrome = globalThis["chrome"];
      const runtime = chrome == null ? void 0 : chrome["runtime"];
      const id = runtime == null ? void 0 : runtime["id"];
      if (id) return `chrome-extension://${id}`;
    }
    if (env === "browser") {
      const location = globalThis["location"];
      if (location == null ? void 0 : location.hostname) return location.hostname;
    }
    return "dial.wtf";
  }
  /**
   * Auto-detect the SIWE/SIWS URI from the current environment.
   * @internal
   */
  detectUri() {
    const env = detectEnvironment();
    if (env === "extension") {
      const chrome = globalThis["chrome"];
      const runtime = chrome == null ? void 0 : chrome["runtime"];
      const id = runtime == null ? void 0 : runtime["id"];
      if (id) return `chrome-extension://${id}`;
    }
    if (env === "browser") {
      const location = globalThis["location"];
      if (location == null ? void 0 : location.origin) return location.origin;
    }
    return "https://dial.wtf";
  }
  /**
   * Simple base58 encoding for signatures
   * @internal
   */
  uint8ArrayToBase58(bytes) {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let result = "";
    let num = BigInt(0);
    for (const byte of bytes) {
      num = num * BigInt(256) + BigInt(byte);
    }
    while (num > 0) {
      result = ALPHABET[Number(num % BigInt(58))] + result;
      num = num / BigInt(58);
    }
    for (const byte of bytes) {
      if (byte === 0) {
        result = "1" + result;
      } else {
        break;
      }
    }
    return result;
  }
};
/** SDK version */
__publicField(DialClient, "version", SDK_VERSION);
var ApiContactsBookProvider = class {
  constructor(httpOrConfig, apiVersion) {
    __publicField(this, "http");
    __publicField(this, "apiVersion");
    var _a;
    if (httpOrConfig instanceof HttpClient) {
      this.http = httpOrConfig;
      this.apiVersion = apiVersion != null ? apiVersion : "v1";
    } else {
      const config = {
        baseUrl: httpOrConfig.baseUrl,
        apiKey: httpOrConfig.apiKey,
        timeout: 3e4,
        debug: false,
        fetch: getFetch()
      };
      this.http = new HttpClient(config);
      this.http.setAuthToken(httpOrConfig.token);
      this.apiVersion = (_a = httpOrConfig.apiVersion) != null ? _a : "v1";
    }
  }
  async getAll(params) {
    return this.http.get(this.endpoint("/profile/contacts"), params ? __spreadValues({}, params) : void 0);
  }
  async get(walletAddress) {
    var _a;
    try {
      const contacts = await this.getAll();
      return (_a = contacts.find((c) => c.walletAddress.toLowerCase() === walletAddress.toLowerCase())) != null ? _a : null;
    } catch (e) {
      return null;
    }
  }
  async add(options) {
    return this.http.post(this.endpoint("/profile/contacts"), options);
  }
  async update(options) {
    return this.http.patch(this.endpoint(`/profile/contacts/${options.walletAddress}`), options);
  }
  async remove(walletAddress) {
    await this.http.delete(this.endpoint(`/profile/contacts/${walletAddress}`));
  }
  async has(walletAddress) {
    const contact = await this.get(walletAddress);
    return contact !== null;
  }
  endpoint(path) {
    return `/${this.apiVersion}${path}`;
  }
};

export { ApiContactsBookProvider, AuthService, CallsService, ChatService, ConferenceService, ContactsBook, DialClient, DialEventEmitter, HttpClient, LocalContactsBookProvider, PartyLinesService, ProfileService, RegistryService, UserDialer, VoicemailService };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map