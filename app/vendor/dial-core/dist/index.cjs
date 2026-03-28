'use strict';

/* @dial-wtf/core - Platform-agnostic types and interfaces */
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/types/client.ts
var SDK_VERSION = "0.3.0";
var API_BASE_URLS = {
  mainnet: "https://dial.wtf/api",
  alpha: "https://alpha.dial.wtf/api",
  staging: "https://staging.dial.wtf/api",
  testnet: "https://testnet.dial.wtf/api",
  devnet: "https://dev.dial.wtf/api"
};
var DEFAULT_NETWORK = "alpha";

// src/errors.ts
var DialError = class _DialError extends Error {
  constructor(message, code, statusCode, details) {
    super(message);
    __publicField(this, "code");
    __publicField(this, "statusCode");
    __publicField(this, "details");
    this.name = "DialError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, _DialError.prototype);
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details
    };
  }
};
var AuthError = class _AuthError extends DialError {
  constructor(message, code, details) {
    super(message, code != null ? code : "AUTH_ERROR", 401, details);
    this.name = "AuthError";
    Object.setPrototypeOf(this, _AuthError.prototype);
  }
};
var ApiError = class _ApiError extends DialError {
  constructor(message, statusCode, code, details) {
    super(message, code != null ? code : "API_ERROR", statusCode, details);
    this.name = "ApiError";
    Object.setPrototypeOf(this, _ApiError.prototype);
  }
  static fromResponse(status, body) {
    var _a, _b, _c;
    if (typeof body === "object" && body !== null) {
      const errorBody = body;
      return new _ApiError(
        String((_b = (_a = errorBody["error"]) != null ? _a : errorBody["message"]) != null ? _b : "Unknown API error"),
        status,
        String((_c = errorBody["code"]) != null ? _c : "API_ERROR"),
        errorBody["details"]
      );
    }
    return new _ApiError("Unknown API error", status);
  }
};
var NetworkError = class _NetworkError extends DialError {
  constructor(message, details) {
    super(message, "NETWORK_ERROR", void 0, details);
    this.name = "NetworkError";
    Object.setPrototypeOf(this, _NetworkError.prototype);
  }
};
var TimeoutError = class _TimeoutError extends DialError {
  constructor(message) {
    super(message != null ? message : "Request timed out", "TIMEOUT_ERROR", 408);
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, _TimeoutError.prototype);
  }
};
var ValidationError = class _ValidationError extends DialError {
  constructor(message, field, details) {
    super(message, "VALIDATION_ERROR", 400, details);
    __publicField(this, "field");
    this.name = "ValidationError";
    this.field = field;
    Object.setPrototypeOf(this, _ValidationError.prototype);
  }
};
var RateLimitError = class _RateLimitError extends DialError {
  constructor(message, retryAfter) {
    super(message != null ? message : "Rate limit exceeded", "RATE_LIMIT_ERROR", 429);
    __publicField(this, "retryAfter");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, _RateLimitError.prototype);
  }
};
var SessionExpiredError = class _SessionExpiredError extends AuthError {
  constructor() {
    super("Session expired. Please re-authenticate.", "SESSION_EXPIRED");
    this.name = "SessionExpiredError";
    Object.setPrototypeOf(this, _SessionExpiredError.prototype);
  }
};
var NotFoundError = class _NotFoundError extends DialError {
  constructor(message, resourceType) {
    super(message, "NOT_FOUND", 404, resourceType ? { resourceType } : void 0);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, _NotFoundError.prototype);
  }
};
var PermissionDeniedError = class _PermissionDeniedError extends DialError {
  constructor(message, requiredPermission) {
    super(
      message != null ? message : "Permission denied",
      "PERMISSION_DENIED",
      403,
      requiredPermission ? { requiredPermission } : void 0
    );
    this.name = "PermissionDeniedError";
    Object.setPrototypeOf(this, _PermissionDeniedError.prototype);
  }
};

// src/interfaces/storage.ts
var MemoryStorage = class {
  constructor() {
    __publicField(this, "store", /* @__PURE__ */ new Map());
  }
  async getItem(key) {
    var _a;
    return (_a = this.store.get(key)) != null ? _a : null;
  }
  async setItem(key, value) {
    this.store.set(key, value);
  }
  async removeItem(key) {
    this.store.delete(key);
  }
};
var BrowserStorage = class {
  get _storage() {
    return globalThis["localStorage"];
  }
  async getItem(key) {
    var _a, _b;
    return (_b = (_a = this._storage) == null ? void 0 : _a.getItem(key)) != null ? _b : null;
  }
  async setItem(key, value) {
    var _a;
    (_a = this._storage) == null ? void 0 : _a.setItem(key, value);
  }
  async removeItem(key) {
    var _a;
    (_a = this._storage) == null ? void 0 : _a.removeItem(key);
  }
};

// src/utils/environment.ts
function detectEnvironment() {
  var _a, _b, _c;
  if (typeof globalThis !== "undefined" && typeof globalThis["chrome"] !== "undefined") {
    const chrome = globalThis["chrome"];
    if (chrome && typeof chrome["runtime"] === "object" && chrome["runtime"] !== null) {
      const runtime = chrome["runtime"];
      if (typeof runtime["id"] === "string") {
        return "extension";
      }
    }
  }
  if (typeof globalThis["window"] !== "undefined" && typeof globalThis["document"] !== "undefined") {
    return "browser";
  }
  if (typeof globalThis["process"] !== "undefined" && ((_a = globalThis["process"]) == null ? void 0 : _a["versions"]) != null && ((_c = (_b = globalThis["process"]) == null ? void 0 : _b["versions"]) == null ? void 0 : _c["node"]) != null) {
    return "node";
  }
  return "unknown";
}
var ENVIRONMENT = detectEnvironment();
var IS_BROWSER = ENVIRONMENT === "browser";
var IS_NODE = ENVIRONMENT === "node";
var IS_EXTENSION = ENVIRONMENT === "extension";
var IS_BROWSER_LIKE = IS_BROWSER || IS_EXTENSION;
var BROWSER_ONLY_FEATURES = [
  "calls.getLocalStream",
  "calls.getRemoteStream",
  "conference.getParticipantStream",
  "conference.startScreenShare",
  "voicemail.download",
  "profile.updateAvatar"
];
var ISOMORPHIC_FEATURES = [
  "auth.*",
  "profile.*",
  "messages.*",
  "calls.start",
  "calls.answer",
  "calls.decline",
  "calls.end",
  "calls.mute",
  "calls.unmute",
  "calls.getHistory",
  "voicemail.getAll",
  "voicemail.get",
  "voicemail.markAsRead",
  "voicemail.transcribe",
  "conference.create",
  "conference.join",
  "conference.leave",
  "conference.getParticipants",
  "partyLines.*",
  "registry.*"
];
function assertBrowser(feature) {
  if (!IS_BROWSER && !IS_EXTENSION) {
    throw new Error(
      `[Dial SDK] The feature "${feature}" is only available in browser/extension environments. It requires browser-specific APIs (MediaStream, WebRTC, etc.) that are not available in Node.js.`
    );
  }
}
function assertNode(feature) {
  if (!IS_NODE) {
    throw new Error(
      `[Dial SDK] The feature "${feature}" is only available in Node.js environments.`
    );
  }
}
function getFetch() {
  if (typeof globalThis.fetch !== "undefined") {
    return globalThis.fetch.bind(globalThis);
  }
  throw new Error(
    "[Dial SDK] No fetch implementation found. Please use Node.js 18+ or provide a custom fetch implementation."
  );
}
function warnBrowserOnly(feature) {
  if (!IS_BROWSER && !IS_EXTENSION) {
    console.warn(
      `[Dial SDK] Warning: "${feature}" has limited functionality in non-browser environments.`
    );
  }
}

exports.API_BASE_URLS = API_BASE_URLS;
exports.ApiError = ApiError;
exports.AuthError = AuthError;
exports.BROWSER_ONLY_FEATURES = BROWSER_ONLY_FEATURES;
exports.BrowserStorage = BrowserStorage;
exports.DEFAULT_NETWORK = DEFAULT_NETWORK;
exports.DialError = DialError;
exports.ENVIRONMENT = ENVIRONMENT;
exports.ISOMORPHIC_FEATURES = ISOMORPHIC_FEATURES;
exports.IS_BROWSER = IS_BROWSER;
exports.IS_BROWSER_LIKE = IS_BROWSER_LIKE;
exports.IS_EXTENSION = IS_EXTENSION;
exports.IS_NODE = IS_NODE;
exports.MemoryStorage = MemoryStorage;
exports.NetworkError = NetworkError;
exports.NotFoundError = NotFoundError;
exports.PermissionDeniedError = PermissionDeniedError;
exports.RateLimitError = RateLimitError;
exports.SDK_VERSION = SDK_VERSION;
exports.SessionExpiredError = SessionExpiredError;
exports.TimeoutError = TimeoutError;
exports.ValidationError = ValidationError;
exports.assertBrowser = assertBrowser;
exports.assertNode = assertNode;
exports.detectEnvironment = detectEnvironment;
exports.getFetch = getFetch;
exports.warnBrowserOnly = warnBrowserOnly;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map