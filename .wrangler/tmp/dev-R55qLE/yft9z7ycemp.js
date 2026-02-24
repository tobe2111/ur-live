var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env3) {
    return 1;
  }
  hasColors(count3, env3) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process2 extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process2.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd3) {
    this.#cwd = cwd3;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// .wrangler/tmp/pages-oW3zpg/bundledWorker-0.16233866088012716.mjs
import { Writable } from "node:stream";
import { EventEmitter as EventEmitter2 } from "node:events";
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
// @__NO_SIDE_EFFECTS__
function createNotImplementedError2(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError2, "createNotImplementedError");
__name2(createNotImplementedError2, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented2(name) {
  const fn = /* @__PURE__ */ __name2(() => {
    throw /* @__PURE__ */ createNotImplementedError2(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented2, "notImplemented");
__name2(notImplemented2, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");
__name2(notImplementedClass, "notImplementedClass");
var _timeOrigin2 = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow2 = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin2;
var nodeTiming2 = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry2 = class {
  static {
    __name(this, "PerformanceEntry");
  }
  static {
    __name2(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow2();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow2() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark3 = class PerformanceMark22 extends PerformanceEntry2 {
  static {
    __name(this, "PerformanceMark2");
  }
  static {
    __name2(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure2 = class extends PerformanceEntry2 {
  static {
    __name(this, "PerformanceMeasure");
  }
  static {
    __name2(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming2 = class extends PerformanceEntry2 {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  static {
    __name2(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList2 = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  static {
    __name2(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance2 = class {
  static {
    __name(this, "Performance");
  }
  static {
    __name2(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin2;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw /* @__PURE__ */ createNotImplementedError2("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming2;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming2("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin2) {
      return _performanceNow2();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark3(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure2(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw /* @__PURE__ */ createNotImplementedError2("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw /* @__PURE__ */ createNotImplementedError2("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw /* @__PURE__ */ createNotImplementedError2("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver2 = class {
  static {
    __name(this, "PerformanceObserver");
  }
  static {
    __name2(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw /* @__PURE__ */ createNotImplementedError2("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw /* @__PURE__ */ createNotImplementedError2("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance2 = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance2();
globalThis.performance = performance2;
globalThis.Performance = Performance2;
globalThis.PerformanceEntry = PerformanceEntry2;
globalThis.PerformanceMark = PerformanceMark3;
globalThis.PerformanceMeasure = PerformanceMeasure2;
globalThis.PerformanceObserver = PerformanceObserver2;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList2;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming2;
var noop_default = Object.assign(() => {
}, { __unenv__: true });
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented2("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;
var workerdConsole = globalThis["console"];
var {
  assert: assert2,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;
globalThis.console = console_default;
var hrtime4 = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name2(/* @__PURE__ */ __name(function hrtime22(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime2"), "hrtime"), { bigint: /* @__PURE__ */ __name2(/* @__PURE__ */ __name(function bigint2() {
  return BigInt(Date.now() * 1e6);
}, "bigint"), "bigint") });
var ReadStream2 = class {
  static {
    __name(this, "ReadStream");
  }
  static {
    __name2(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};
var WriteStream2 = class {
  static {
    __name(this, "WriteStream");
  }
  static {
    __name2(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env22) {
    return 1;
  }
  hasColors(count3, env22) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};
var NODE_VERSION2 = "22.14.0";
var Process2 = class _Process extends EventEmitter2 {
  static {
    __name(this, "_Process");
  }
  static {
    __name2(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter2.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream2(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream2(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream2(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd22) {
    this.#cwd = cwd22;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION2}`;
  }
  get versions() {
    return { node: NODE_VERSION2 };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw /* @__PURE__ */ createNotImplementedError2("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw /* @__PURE__ */ createNotImplementedError2("process.getActiveResourcesInfo");
  }
  exit() {
    throw /* @__PURE__ */ createNotImplementedError2("process.exit");
  }
  reallyExit() {
    throw /* @__PURE__ */ createNotImplementedError2("process.reallyExit");
  }
  kill() {
    throw /* @__PURE__ */ createNotImplementedError2("process.kill");
  }
  abort() {
    throw /* @__PURE__ */ createNotImplementedError2("process.abort");
  }
  dlopen() {
    throw /* @__PURE__ */ createNotImplementedError2("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw /* @__PURE__ */ createNotImplementedError2("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw /* @__PURE__ */ createNotImplementedError2("process.loadEnvFile");
  }
  disconnect() {
    throw /* @__PURE__ */ createNotImplementedError2("process.disconnect");
  }
  cpuUsage() {
    throw /* @__PURE__ */ createNotImplementedError2("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw /* @__PURE__ */ createNotImplementedError2("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw /* @__PURE__ */ createNotImplementedError2("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw /* @__PURE__ */ createNotImplementedError2("process.initgroups");
  }
  openStdin() {
    throw /* @__PURE__ */ createNotImplementedError2("process.openStdin");
  }
  assert() {
    throw /* @__PURE__ */ createNotImplementedError2("process.assert");
  }
  binding() {
    throw /* @__PURE__ */ createNotImplementedError2("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented2("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented2("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented2("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented2("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented2("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented2("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name2(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};
var globalProcess2 = globalThis["process"];
var getBuiltinModule2 = globalProcess2.getBuiltinModule;
var workerdProcess2 = getBuiltinModule2("node:process");
var unenvProcess2 = new Process2({
  env: globalProcess2.env,
  hrtime: hrtime4,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess2.nextTick
});
var { exit: exit2, features: features2, platform: platform2 } = workerdProcess2;
var {
  _channel: _channel2,
  _debugEnd: _debugEnd2,
  _debugProcess: _debugProcess2,
  _disconnect: _disconnect2,
  _events: _events2,
  _eventsCount: _eventsCount2,
  _exiting: _exiting2,
  _fatalException: _fatalException2,
  _getActiveHandles: _getActiveHandles2,
  _getActiveRequests: _getActiveRequests2,
  _handleQueue: _handleQueue2,
  _kill: _kill2,
  _linkedBinding: _linkedBinding2,
  _maxListeners: _maxListeners2,
  _pendingMessage: _pendingMessage2,
  _preload_modules: _preload_modules2,
  _rawDebug: _rawDebug2,
  _send: _send2,
  _startProfilerIdleNotifier: _startProfilerIdleNotifier2,
  _stopProfilerIdleNotifier: _stopProfilerIdleNotifier2,
  _tickCallback: _tickCallback2,
  abort: abort2,
  addListener: addListener2,
  allowedNodeEnvironmentFlags: allowedNodeEnvironmentFlags2,
  arch: arch2,
  argv: argv2,
  argv0: argv02,
  assert: assert22,
  availableMemory: availableMemory2,
  binding: binding2,
  channel: channel2,
  chdir: chdir2,
  config: config2,
  connected: connected2,
  constrainedMemory: constrainedMemory2,
  cpuUsage: cpuUsage2,
  cwd: cwd2,
  debugPort: debugPort2,
  disconnect: disconnect2,
  dlopen: dlopen2,
  domain: domain2,
  emit: emit2,
  emitWarning: emitWarning2,
  env: env2,
  eventNames: eventNames2,
  execArgv: execArgv2,
  execPath: execPath2,
  exitCode: exitCode2,
  finalization: finalization2,
  getActiveResourcesInfo: getActiveResourcesInfo2,
  getegid: getegid2,
  geteuid: geteuid2,
  getgid: getgid2,
  getgroups: getgroups2,
  getMaxListeners: getMaxListeners2,
  getuid: getuid2,
  hasUncaughtExceptionCaptureCallback: hasUncaughtExceptionCaptureCallback2,
  hrtime: hrtime32,
  initgroups: initgroups2,
  kill: kill2,
  listenerCount: listenerCount2,
  listeners: listeners2,
  loadEnvFile: loadEnvFile2,
  mainModule: mainModule2,
  memoryUsage: memoryUsage2,
  moduleLoadList: moduleLoadList2,
  nextTick: nextTick2,
  off: off2,
  on: on2,
  once: once2,
  openStdin: openStdin2,
  permission: permission2,
  pid: pid2,
  ppid: ppid2,
  prependListener: prependListener2,
  prependOnceListener: prependOnceListener2,
  rawListeners: rawListeners2,
  reallyExit: reallyExit2,
  ref: ref2,
  release: release2,
  removeAllListeners: removeAllListeners2,
  removeListener: removeListener2,
  report: report2,
  resourceUsage: resourceUsage2,
  send: send2,
  setegid: setegid2,
  seteuid: seteuid2,
  setgid: setgid2,
  setgroups: setgroups2,
  setMaxListeners: setMaxListeners2,
  setSourceMapsEnabled: setSourceMapsEnabled2,
  setuid: setuid2,
  setUncaughtExceptionCaptureCallback: setUncaughtExceptionCaptureCallback2,
  sourceMapsEnabled: sourceMapsEnabled2,
  stderr: stderr2,
  stdin: stdin2,
  stdout: stdout2,
  throwDeprecation: throwDeprecation2,
  title: title2,
  traceDeprecation: traceDeprecation2,
  umask: umask2,
  unref: unref2,
  uptime: uptime2,
  version: version2,
  versions: versions2
} = unenvProcess2;
var _process2 = {
  abort: abort2,
  addListener: addListener2,
  allowedNodeEnvironmentFlags: allowedNodeEnvironmentFlags2,
  hasUncaughtExceptionCaptureCallback: hasUncaughtExceptionCaptureCallback2,
  setUncaughtExceptionCaptureCallback: setUncaughtExceptionCaptureCallback2,
  loadEnvFile: loadEnvFile2,
  sourceMapsEnabled: sourceMapsEnabled2,
  arch: arch2,
  argv: argv2,
  argv0: argv02,
  chdir: chdir2,
  config: config2,
  connected: connected2,
  constrainedMemory: constrainedMemory2,
  availableMemory: availableMemory2,
  cpuUsage: cpuUsage2,
  cwd: cwd2,
  debugPort: debugPort2,
  dlopen: dlopen2,
  disconnect: disconnect2,
  emit: emit2,
  emitWarning: emitWarning2,
  env: env2,
  eventNames: eventNames2,
  execArgv: execArgv2,
  execPath: execPath2,
  exit: exit2,
  finalization: finalization2,
  features: features2,
  getBuiltinModule: getBuiltinModule2,
  getActiveResourcesInfo: getActiveResourcesInfo2,
  getMaxListeners: getMaxListeners2,
  hrtime: hrtime32,
  kill: kill2,
  listeners: listeners2,
  listenerCount: listenerCount2,
  memoryUsage: memoryUsage2,
  nextTick: nextTick2,
  on: on2,
  off: off2,
  once: once2,
  pid: pid2,
  platform: platform2,
  ppid: ppid2,
  prependListener: prependListener2,
  prependOnceListener: prependOnceListener2,
  rawListeners: rawListeners2,
  release: release2,
  removeAllListeners: removeAllListeners2,
  removeListener: removeListener2,
  report: report2,
  resourceUsage: resourceUsage2,
  setMaxListeners: setMaxListeners2,
  setSourceMapsEnabled: setSourceMapsEnabled2,
  stderr: stderr2,
  stdin: stdin2,
  stdout: stdout2,
  title: title2,
  throwDeprecation: throwDeprecation2,
  traceDeprecation: traceDeprecation2,
  umask: umask2,
  uptime: uptime2,
  version: version2,
  versions: versions2,
  // @ts-expect-error old API
  domain: domain2,
  initgroups: initgroups2,
  moduleLoadList: moduleLoadList2,
  reallyExit: reallyExit2,
  openStdin: openStdin2,
  assert: assert22,
  binding: binding2,
  send: send2,
  exitCode: exitCode2,
  channel: channel2,
  getegid: getegid2,
  geteuid: geteuid2,
  getgid: getgid2,
  getgroups: getgroups2,
  getuid: getuid2,
  setegid: setegid2,
  seteuid: seteuid2,
  setgid: setgid2,
  setgroups: setgroups2,
  setuid: setuid2,
  permission: permission2,
  mainModule: mainModule2,
  _events: _events2,
  _eventsCount: _eventsCount2,
  _exiting: _exiting2,
  _maxListeners: _maxListeners2,
  _debugEnd: _debugEnd2,
  _debugProcess: _debugProcess2,
  _fatalException: _fatalException2,
  _getActiveHandles: _getActiveHandles2,
  _getActiveRequests: _getActiveRequests2,
  _kill: _kill2,
  _preload_modules: _preload_modules2,
  _rawDebug: _rawDebug2,
  _startProfilerIdleNotifier: _startProfilerIdleNotifier2,
  _stopProfilerIdleNotifier: _stopProfilerIdleNotifier2,
  _tickCallback: _tickCallback2,
  _disconnect: _disconnect2,
  _handleQueue: _handleQueue2,
  _pendingMessage: _pendingMessage2,
  _channel: _channel2,
  _send: _send2,
  _linkedBinding: _linkedBinding2
};
var process_default2 = _process2;
globalThis.process = process_default2;
var xr = Object.defineProperty;
var $s = /* @__PURE__ */ __name2((e) => {
  throw TypeError(e);
}, "$s");
var Br = /* @__PURE__ */ __name2((e, s, r) => s in e ? xr(e, s, { enumerable: true, configurable: true, writable: true, value: r }) : e[s] = r, "Br");
var b = /* @__PURE__ */ __name2((e, s, r) => Br(e, typeof s != "symbol" ? s + "" : s, r), "b");
var ys = /* @__PURE__ */ __name2((e, s, r) => s.has(e) || $s("Cannot " + r), "ys");
var f = /* @__PURE__ */ __name2((e, s, r) => (ys(e, s, "read from private field"), r ? r.call(e) : s.get(e)), "f");
var I = /* @__PURE__ */ __name2((e, s, r) => s.has(e) ? $s("Cannot add the same private member more than once") : s instanceof WeakSet ? s.add(e) : s.set(e, r), "I");
var T = /* @__PURE__ */ __name2((e, s, r, t) => (ys(e, s, "write to private field"), t ? t.call(e, r) : s.set(e, r), r), "T");
var k = /* @__PURE__ */ __name2((e, s, r) => (ys(e, s, "access private method"), r), "k");
var qs = /* @__PURE__ */ __name2((e, s, r, t) => ({ set _(a) {
  T(e, s, a, r);
}, get _() {
  return f(e, s, t);
} }), "qs");
var Hs = /* @__PURE__ */ __name2((e, s, r) => (t, a) => {
  let n = -1;
  return o(0);
  async function o(i) {
    if (i <= n) throw new Error("next() called multiple times");
    n = i;
    let c, u = false, l;
    if (e[i] ? (l = e[i][0][0], t.req.routeIndex = i) : l = i === e.length && a || void 0, l) try {
      c = await l(t, () => o(i + 1));
    } catch (p) {
      if (p instanceof Error && s) t.error = p, c = await s(p, t), u = true;
      else throw p;
    }
    else t.finalized === false && r && (c = await r(t));
    return c && (t.finalized === false || u) && (t.res = c), t;
  }
  __name(o, "o");
  __name2(o, "o");
}, "Hs");
var Wr = /* @__PURE__ */ Symbol();
var Kr = /* @__PURE__ */ __name2(async (e, s = /* @__PURE__ */ Object.create(null)) => {
  const { all: r = false, dot: t = false } = s, n = (e instanceof mr ? e.raw.headers : e.headers).get("Content-Type");
  return n != null && n.startsWith("multipart/form-data") || n != null && n.startsWith("application/x-www-form-urlencoded") ? Vr(e, { all: r, dot: t }) : {};
}, "Kr");
async function Vr(e, s) {
  const r = await e.formData();
  return r ? Yr(r, s) : {};
}
__name(Vr, "Vr");
__name2(Vr, "Vr");
function Yr(e, s) {
  const r = /* @__PURE__ */ Object.create(null);
  return e.forEach((t, a) => {
    s.all || a.endsWith("[]") ? Jr(r, a, t) : r[a] = t;
  }), s.dot && Object.entries(r).forEach(([t, a]) => {
    t.includes(".") && (zr(r, t, a), delete r[t]);
  }), r;
}
__name(Yr, "Yr");
__name2(Yr, "Yr");
var Jr = /* @__PURE__ */ __name2((e, s, r) => {
  e[s] !== void 0 ? Array.isArray(e[s]) ? e[s].push(r) : e[s] = [e[s], r] : s.endsWith("[]") ? e[s] = [r] : e[s] = r;
}, "Jr");
var zr = /* @__PURE__ */ __name2((e, s, r) => {
  let t = e;
  const a = s.split(".");
  a.forEach((n, o) => {
    o === a.length - 1 ? t[n] = r : ((!t[n] || typeof t[n] != "object" || Array.isArray(t[n]) || t[n] instanceof File) && (t[n] = /* @__PURE__ */ Object.create(null)), t = t[n]);
  });
}, "zr");
var cr = /* @__PURE__ */ __name2((e) => {
  const s = e.split("/");
  return s[0] === "" && s.shift(), s;
}, "cr");
var Gr = /* @__PURE__ */ __name2((e) => {
  const { groups: s, path: r } = Xr(e), t = cr(r);
  return Qr(t, s);
}, "Gr");
var Xr = /* @__PURE__ */ __name2((e) => {
  const s = [];
  return e = e.replace(/\{[^}]+\}/g, (r, t) => {
    const a = `@${t}`;
    return s.push([a, r]), a;
  }), { groups: s, path: e };
}, "Xr");
var Qr = /* @__PURE__ */ __name2((e, s) => {
  for (let r = s.length - 1; r >= 0; r--) {
    const [t] = s[r];
    for (let a = e.length - 1; a >= 0; a--) if (e[a].includes(t)) {
      e[a] = e[a].replace(t, s[r][1]);
      break;
    }
  }
  return e;
}, "Qr");
var ls = {};
var Zr = /* @__PURE__ */ __name2((e, s) => {
  if (e === "*") return "*";
  const r = e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (r) {
    const t = `${e}#${s}`;
    return ls[t] || (r[2] ? ls[t] = s && s[0] !== ":" && s[0] !== "*" ? [t, r[1], new RegExp(`^${r[2]}(?=/${s})`)] : [e, r[1], new RegExp(`^${r[2]}$`)] : ls[t] = [e, r[1], true]), ls[t];
  }
  return null;
}, "Zr");
var Os = /* @__PURE__ */ __name2((e, s) => {
  try {
    return s(e);
  } catch {
    return e.replace(/(?:%[0-9A-Fa-f]{2})+/g, (r) => {
      try {
        return s(r);
      } catch {
        return r;
      }
    });
  }
}, "Os");
var et = /* @__PURE__ */ __name2((e) => Os(e, decodeURI), "et");
var ur = /* @__PURE__ */ __name2((e) => {
  const s = e.url, r = s.indexOf("/", s.indexOf(":") + 4);
  let t = r;
  for (; t < s.length; t++) {
    const a = s.charCodeAt(t);
    if (a === 37) {
      const n = s.indexOf("?", t), o = s.indexOf("#", t), i = n === -1 ? o === -1 ? void 0 : o : o === -1 ? n : Math.min(n, o), c = s.slice(r, i);
      return et(c.includes("%25") ? c.replace(/%25/g, "%2525") : c);
    } else if (a === 63 || a === 35) break;
  }
  return s.slice(r, t);
}, "ur");
var st = /* @__PURE__ */ __name2((e) => {
  const s = ur(e);
  return s.length > 1 && s.at(-1) === "/" ? s.slice(0, -1) : s;
}, "st");
var Me = /* @__PURE__ */ __name2((e, s, ...r) => (r.length && (s = Me(s, ...r)), `${(e == null ? void 0 : e[0]) === "/" ? "" : "/"}${e}${s === "/" ? "" : `${(e == null ? void 0 : e.at(-1)) === "/" ? "" : "/"}${(s == null ? void 0 : s[0]) === "/" ? s.slice(1) : s}`}`), "Me");
var lr = /* @__PURE__ */ __name2((e) => {
  if (e.charCodeAt(e.length - 1) !== 63 || !e.includes(":")) return null;
  const s = e.split("/"), r = [];
  let t = "";
  return s.forEach((a) => {
    if (a !== "" && !/\:/.test(a)) t += "/" + a;
    else if (/\:/.test(a)) if (/\?/.test(a)) {
      r.length === 0 && t === "" ? r.push("/") : r.push(t);
      const n = a.replace("?", "");
      t += "/" + n, r.push(t);
    } else t += "/" + a;
  }), r.filter((a, n, o) => o.indexOf(a) === n);
}, "lr");
var ws = /* @__PURE__ */ __name2((e) => /[%+]/.test(e) ? (e.indexOf("+") !== -1 && (e = e.replace(/\+/g, " ")), e.indexOf("%") !== -1 ? Os(e, pr) : e) : e, "ws");
var dr = /* @__PURE__ */ __name2((e, s, r) => {
  let t;
  if (!r && s && !/[%+]/.test(s)) {
    let o = e.indexOf("?", 8);
    if (o === -1) return;
    for (e.startsWith(s, o + 1) || (o = e.indexOf(`&${s}`, o + 1)); o !== -1; ) {
      const i = e.charCodeAt(o + s.length + 1);
      if (i === 61) {
        const c = o + s.length + 2, u = e.indexOf("&", c);
        return ws(e.slice(c, u === -1 ? void 0 : u));
      } else if (i == 38 || isNaN(i)) return "";
      o = e.indexOf(`&${s}`, o + 1);
    }
    if (t = /[%+]/.test(e), !t) return;
  }
  const a = {};
  t ?? (t = /[%+]/.test(e));
  let n = e.indexOf("?", 8);
  for (; n !== -1; ) {
    const o = e.indexOf("&", n + 1);
    let i = e.indexOf("=", n);
    i > o && o !== -1 && (i = -1);
    let c = e.slice(n + 1, i === -1 ? o === -1 ? void 0 : o : i);
    if (t && (c = ws(c)), n = o, c === "") continue;
    let u;
    i === -1 ? u = "" : (u = e.slice(i + 1, o === -1 ? void 0 : o), t && (u = ws(u))), r ? (a[c] && Array.isArray(a[c]) || (a[c] = []), a[c].push(u)) : a[c] ?? (a[c] = u);
  }
  return s ? a[s] : a;
}, "dr");
var rt = dr;
var tt = /* @__PURE__ */ __name2((e, s) => dr(e, s, true), "tt");
var pr = decodeURIComponent;
var Fs = /* @__PURE__ */ __name2((e) => Os(e, pr), "Fs");
var $e;
var Z;
var le;
var _r;
var fr;
var Is;
var me;
var rr;
var mr = (rr = class {
  static {
    __name(this, "rr");
  }
  static {
    __name2(this, "rr");
  }
  constructor(e, s = "/", r = [[]]) {
    I(this, le);
    b(this, "raw");
    I(this, $e);
    I(this, Z);
    b(this, "routeIndex", 0);
    b(this, "path");
    b(this, "bodyCache", {});
    I(this, me, (e2) => {
      const { bodyCache: s2, raw: r2 } = this, t = s2[e2];
      if (t) return t;
      const a = Object.keys(s2)[0];
      return a ? s2[a].then((n) => (a === "json" && (n = JSON.stringify(n)), new Response(n)[e2]())) : s2[e2] = r2[e2]();
    });
    this.raw = e, this.path = s, T(this, Z, r), T(this, $e, {});
  }
  param(e) {
    return e ? k(this, le, _r).call(this, e) : k(this, le, fr).call(this);
  }
  query(e) {
    return rt(this.url, e);
  }
  queries(e) {
    return tt(this.url, e);
  }
  header(e) {
    if (e) return this.raw.headers.get(e) ?? void 0;
    const s = {};
    return this.raw.headers.forEach((r, t) => {
      s[t] = r;
    }), s;
  }
  async parseBody(e) {
    var s;
    return (s = this.bodyCache).parsedBody ?? (s.parsedBody = await Kr(this, e));
  }
  json() {
    return f(this, me).call(this, "text").then((e) => JSON.parse(e));
  }
  text() {
    return f(this, me).call(this, "text");
  }
  arrayBuffer() {
    return f(this, me).call(this, "arrayBuffer");
  }
  blob() {
    return f(this, me).call(this, "blob");
  }
  formData() {
    return f(this, me).call(this, "formData");
  }
  addValidatedData(e, s) {
    f(this, $e)[e] = s;
  }
  valid(e) {
    return f(this, $e)[e];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [Wr]() {
    return f(this, Z);
  }
  get matchedRoutes() {
    return f(this, Z)[0].map(([[, e]]) => e);
  }
  get routePath() {
    return f(this, Z)[0].map(([[, e]]) => e)[this.routeIndex].path;
  }
}, $e = /* @__PURE__ */ new WeakMap(), Z = /* @__PURE__ */ new WeakMap(), le = /* @__PURE__ */ new WeakSet(), _r = /* @__PURE__ */ __name2(function(e) {
  const s = f(this, Z)[0][this.routeIndex][1][e], r = k(this, le, Is).call(this, s);
  return r && /\%/.test(r) ? Fs(r) : r;
}, "_r"), fr = /* @__PURE__ */ __name2(function() {
  const e = {}, s = Object.keys(f(this, Z)[0][this.routeIndex][1]);
  for (const r of s) {
    const t = k(this, le, Is).call(this, f(this, Z)[0][this.routeIndex][1][r]);
    t !== void 0 && (e[r] = /\%/.test(t) ? Fs(t) : t);
  }
  return e;
}, "fr"), Is = /* @__PURE__ */ __name2(function(e) {
  return f(this, Z)[1] ? f(this, Z)[1][e] : e;
}, "Is"), me = /* @__PURE__ */ new WeakMap(), rr);
var at = { Stringify: 1 };
var Er = /* @__PURE__ */ __name2(async (e, s, r, t, a) => {
  typeof e == "object" && !(e instanceof String) && (e instanceof Promise || (e = e.toString()), e instanceof Promise && (e = await e));
  const n = e.callbacks;
  return n != null && n.length ? (a ? a[0] += e : a = [e], Promise.all(n.map((i) => i({ phase: s, buffer: a, context: t }))).then((i) => Promise.all(i.filter(Boolean).map((c) => Er(c, s, false, t, a))).then(() => a[0]))) : Promise.resolve(e);
}, "Er");
var nt = "text/plain; charset=UTF-8";
var Ss = /* @__PURE__ */ __name2((e, s) => ({ "Content-Type": e, ...s }), "Ss");
var Ce = /* @__PURE__ */ __name2((e, s) => new Response(e, s), "Ce");
var es;
var ss;
var oe;
var qe;
var ie;
var G;
var rs;
var He;
var Fe;
var be;
var ts;
var as;
var ae;
var Pe;
var vs;
var tr;
var ot = (tr = class {
  static {
    __name(this, "tr");
  }
  static {
    __name2(this, "tr");
  }
  constructor(e, s) {
    I(this, ae);
    I(this, es);
    I(this, ss);
    b(this, "env", {});
    I(this, oe);
    b(this, "finalized", false);
    b(this, "error");
    I(this, qe);
    I(this, ie);
    I(this, G);
    I(this, rs);
    I(this, He);
    I(this, Fe);
    I(this, be);
    I(this, ts);
    I(this, as);
    b(this, "render", (...e2) => (f(this, He) ?? T(this, He, (s2) => this.html(s2)), f(this, He).call(this, ...e2)));
    b(this, "setLayout", (e2) => T(this, rs, e2));
    b(this, "getLayout", () => f(this, rs));
    b(this, "setRenderer", (e2) => {
      T(this, He, e2);
    });
    b(this, "header", (e2, s2, r) => {
      this.finalized && T(this, G, Ce(f(this, G).body, f(this, G)));
      const t = f(this, G) ? f(this, G).headers : f(this, be) ?? T(this, be, new Headers());
      s2 === void 0 ? t.delete(e2) : r != null && r.append ? t.append(e2, s2) : t.set(e2, s2);
    });
    b(this, "status", (e2) => {
      T(this, qe, e2);
    });
    b(this, "set", (e2, s2) => {
      f(this, oe) ?? T(this, oe, /* @__PURE__ */ new Map()), f(this, oe).set(e2, s2);
    });
    b(this, "get", (e2) => f(this, oe) ? f(this, oe).get(e2) : void 0);
    b(this, "newResponse", (...e2) => k(this, ae, Pe).call(this, ...e2));
    b(this, "body", (e2, s2, r) => k(this, ae, Pe).call(this, e2, s2, r));
    b(this, "text", (e2, s2, r) => k(this, ae, vs).call(this) && !s2 && !r ? Ce(e2) : k(this, ae, Pe).call(this, e2, s2, Ss(nt, r)));
    b(this, "json", (e2, s2, r) => k(this, ae, vs).call(this) && !s2 && !r ? Response.json(e2) : k(this, ae, Pe).call(this, JSON.stringify(e2), s2, Ss("application/json", r)));
    b(this, "html", (e2, s2, r) => {
      const t = /* @__PURE__ */ __name2((a) => k(this, ae, Pe).call(this, a, s2, Ss("text/html; charset=UTF-8", r)), "t");
      return typeof e2 == "object" ? Er(e2, at.Stringify, false, {}).then(t) : t(e2);
    });
    b(this, "redirect", (e2, s2) => {
      const r = String(e2);
      return this.header("Location", /[^\x00-\xFF]/.test(r) ? encodeURI(r) : r), this.newResponse(null, s2 ?? 302);
    });
    b(this, "notFound", () => (f(this, Fe) ?? T(this, Fe, () => Ce()), f(this, Fe).call(this, this)));
    T(this, es, e), s && (T(this, ie, s.executionCtx), this.env = s.env, T(this, Fe, s.notFoundHandler), T(this, as, s.path), T(this, ts, s.matchResult));
  }
  get req() {
    return f(this, ss) ?? T(this, ss, new mr(f(this, es), f(this, as), f(this, ts))), f(this, ss);
  }
  get event() {
    if (f(this, ie) && "respondWith" in f(this, ie)) return f(this, ie);
    throw Error("This context has no FetchEvent");
  }
  get executionCtx() {
    if (f(this, ie)) return f(this, ie);
    throw Error("This context has no ExecutionContext");
  }
  get res() {
    return f(this, G) || T(this, G, Ce(null, { headers: f(this, be) ?? T(this, be, new Headers()) }));
  }
  set res(e) {
    if (f(this, G) && e) {
      e = Ce(e.body, e);
      for (const [s, r] of f(this, G).headers.entries()) if (s !== "content-type") if (s === "set-cookie") {
        const t = f(this, G).headers.getSetCookie();
        e.headers.delete("set-cookie");
        for (const a of t) e.headers.append("set-cookie", a);
      } else e.headers.set(s, r);
    }
    T(this, G, e), this.finalized = true;
  }
  get var() {
    return f(this, oe) ? Object.fromEntries(f(this, oe)) : {};
  }
}, es = /* @__PURE__ */ new WeakMap(), ss = /* @__PURE__ */ new WeakMap(), oe = /* @__PURE__ */ new WeakMap(), qe = /* @__PURE__ */ new WeakMap(), ie = /* @__PURE__ */ new WeakMap(), G = /* @__PURE__ */ new WeakMap(), rs = /* @__PURE__ */ new WeakMap(), He = /* @__PURE__ */ new WeakMap(), Fe = /* @__PURE__ */ new WeakMap(), be = /* @__PURE__ */ new WeakMap(), ts = /* @__PURE__ */ new WeakMap(), as = /* @__PURE__ */ new WeakMap(), ae = /* @__PURE__ */ new WeakSet(), Pe = /* @__PURE__ */ __name2(function(e, s, r) {
  const t = f(this, G) ? new Headers(f(this, G).headers) : f(this, be) ?? new Headers();
  if (typeof s == "object" && "headers" in s) {
    const n = s.headers instanceof Headers ? s.headers : new Headers(s.headers);
    for (const [o, i] of n) o.toLowerCase() === "set-cookie" ? t.append(o, i) : t.set(o, i);
  }
  if (r) for (const [n, o] of Object.entries(r)) if (typeof o == "string") t.set(n, o);
  else {
    t.delete(n);
    for (const i of o) t.append(n, i);
  }
  const a = typeof s == "number" ? s : (s == null ? void 0 : s.status) ?? f(this, qe);
  return Ce(e, { status: a, headers: t });
}, "Pe"), vs = /* @__PURE__ */ __name2(function() {
  return !f(this, be) && !f(this, qe) && !this.finalized;
}, "vs"), tr);
var W = "ALL";
var it = "all";
var ct = ["get", "post", "put", "delete", "options", "patch"];
var hr = "Can not add a route since the matcher is already built.";
var gr = class extends Error {
  static {
    __name(this, "gr");
  }
  static {
    __name2(this, "gr");
  }
};
var ut = "__COMPOSED_HANDLER";
var lt = /* @__PURE__ */ __name2((e) => e.text("404 Not Found", 404), "lt");
var xs = /* @__PURE__ */ __name2((e, s) => {
  if ("getResponse" in e) {
    const r = e.getResponse();
    return s.newResponse(r.body, r);
  }
  return console.error(e), s.text("Internal Server Error", 500);
}, "xs");
var se;
var K;
var yr;
var re;
var Se;
var ds;
var ps;
var xe;
var dt = (xe = class {
  static {
    __name(this, "xe");
  }
  static {
    __name2(this, "xe");
  }
  constructor(s = {}) {
    I(this, K);
    b(this, "get");
    b(this, "post");
    b(this, "put");
    b(this, "delete");
    b(this, "options");
    b(this, "patch");
    b(this, "all");
    b(this, "on");
    b(this, "use");
    b(this, "router");
    b(this, "getPath");
    b(this, "_basePath", "/");
    I(this, se, "/");
    b(this, "routes", []);
    I(this, re, lt);
    b(this, "errorHandler", xs);
    b(this, "onError", (s2) => (this.errorHandler = s2, this));
    b(this, "notFound", (s2) => (T(this, re, s2), this));
    b(this, "fetch", (s2, ...r) => k(this, K, ps).call(this, s2, r[1], r[0], s2.method));
    b(this, "request", (s2, r, t2, a2) => s2 instanceof Request ? this.fetch(r ? new Request(s2, r) : s2, t2, a2) : (s2 = s2.toString(), this.fetch(new Request(/^https?:\/\//.test(s2) ? s2 : `http://localhost${Me("/", s2)}`, r), t2, a2)));
    b(this, "fire", () => {
      addEventListener("fetch", (s2) => {
        s2.respondWith(k(this, K, ps).call(this, s2.request, s2, void 0, s2.request.method));
      });
    });
    [...ct, it].forEach((n) => {
      this[n] = (o, ...i) => (typeof o == "string" ? T(this, se, o) : k(this, K, Se).call(this, n, f(this, se), o), i.forEach((c) => {
        k(this, K, Se).call(this, n, f(this, se), c);
      }), this);
    }), this.on = (n, o, ...i) => {
      for (const c of [o].flat()) {
        T(this, se, c);
        for (const u of [n].flat()) i.map((l) => {
          k(this, K, Se).call(this, u.toUpperCase(), f(this, se), l);
        });
      }
      return this;
    }, this.use = (n, ...o) => (typeof n == "string" ? T(this, se, n) : (T(this, se, "*"), o.unshift(n)), o.forEach((i) => {
      k(this, K, Se).call(this, W, f(this, se), i);
    }), this);
    const { strict: t, ...a } = s;
    Object.assign(this, a), this.getPath = t ?? true ? s.getPath ?? ur : st;
  }
  route(s, r) {
    const t = this.basePath(s);
    return r.routes.map((a) => {
      var o;
      let n;
      r.errorHandler === xs ? n = a.handler : (n = /* @__PURE__ */ __name2(async (i, c) => (await Hs([], r.errorHandler)(i, () => a.handler(i, c))).res, "n"), n[ut] = a.handler), k(o = t, K, Se).call(o, a.method, a.path, n);
    }), this;
  }
  basePath(s) {
    const r = k(this, K, yr).call(this);
    return r._basePath = Me(this._basePath, s), r;
  }
  mount(s, r, t) {
    let a, n;
    t && (typeof t == "function" ? n = t : (n = t.optionHandler, t.replaceRequest === false ? a = /* @__PURE__ */ __name2((c) => c, "a") : a = t.replaceRequest));
    const o = n ? (c) => {
      const u = n(c);
      return Array.isArray(u) ? u : [u];
    } : (c) => {
      let u;
      try {
        u = c.executionCtx;
      } catch {
      }
      return [c.env, u];
    };
    a || (a = (() => {
      const c = Me(this._basePath, s), u = c === "/" ? 0 : c.length;
      return (l) => {
        const p = new URL(l.url);
        return p.pathname = p.pathname.slice(u) || "/", new Request(p, l);
      };
    })());
    const i = /* @__PURE__ */ __name2(async (c, u) => {
      const l = await r(a(c.req.raw), ...o(c));
      if (l) return l;
      await u();
    }, "i");
    return k(this, K, Se).call(this, W, Me(s, "*"), i), this;
  }
}, se = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakSet(), yr = /* @__PURE__ */ __name2(function() {
  const s = new xe({ router: this.router, getPath: this.getPath });
  return s.errorHandler = this.errorHandler, T(s, re, f(this, re)), s.routes = this.routes, s;
}, "yr"), re = /* @__PURE__ */ new WeakMap(), Se = /* @__PURE__ */ __name2(function(s, r, t) {
  s = s.toUpperCase(), r = Me(this._basePath, r);
  const a = { basePath: this._basePath, path: r, method: s, handler: t };
  this.router.add(s, r, [t, a]), this.routes.push(a);
}, "Se"), ds = /* @__PURE__ */ __name2(function(s, r) {
  if (s instanceof Error) return this.errorHandler(s, r);
  throw s;
}, "ds"), ps = /* @__PURE__ */ __name2(function(s, r, t, a) {
  if (a === "HEAD") return (async () => new Response(null, await k(this, K, ps).call(this, s, r, t, "GET")))();
  const n = this.getPath(s, { env: t }), o = this.router.match(a, n), i = new ot(s, { path: n, matchResult: o, env: t, executionCtx: r, notFoundHandler: f(this, re) });
  if (o[0].length === 1) {
    let u;
    try {
      u = o[0][0][0][0](i, async () => {
        i.res = await f(this, re).call(this, i);
      });
    } catch (l) {
      return k(this, K, ds).call(this, l, i);
    }
    return u instanceof Promise ? u.then((l) => l || (i.finalized ? i.res : f(this, re).call(this, i))).catch((l) => k(this, K, ds).call(this, l, i)) : u ?? f(this, re).call(this, i);
  }
  const c = Hs(o[0], this.errorHandler, f(this, re));
  return (async () => {
    try {
      const u = await c(i);
      if (!u.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
      return u.res;
    } catch (u) {
      return k(this, K, ds).call(this, u, i);
    }
  })();
}, "ps"), xe);
var wr = [];
function pt(e, s) {
  const r = this.buildAllMatchers(), t = /* @__PURE__ */ __name2(((a, n) => {
    const o = r[a] || r[W], i = o[2][n];
    if (i) return i;
    const c = n.match(o[0]);
    if (!c) return [[], wr];
    const u = c.indexOf("", 1);
    return [o[1][u], c];
  }), "t");
  return this.match = t, t(e, s);
}
__name(pt, "pt");
__name2(pt, "pt");
var _s = "[^/]+";
var Ge = ".*";
var Xe = "(?:|/.*)";
var Ue = /* @__PURE__ */ Symbol();
var mt = new Set(".\\+*[^]$()");
function _t(e, s) {
  return e.length === 1 ? s.length === 1 ? e < s ? -1 : 1 : -1 : s.length === 1 || e === Ge || e === Xe ? 1 : s === Ge || s === Xe ? -1 : e === _s ? 1 : s === _s ? -1 : e.length === s.length ? e < s ? -1 : 1 : s.length - e.length;
}
__name(_t, "_t");
__name2(_t, "_t");
var Re;
var Ie;
var te;
var De;
var ft = (De = class {
  static {
    __name(this, "De");
  }
  static {
    __name2(this, "De");
  }
  constructor() {
    I(this, Re);
    I(this, Ie);
    I(this, te, /* @__PURE__ */ Object.create(null));
  }
  insert(s, r, t, a, n) {
    if (s.length === 0) {
      if (f(this, Re) !== void 0) throw Ue;
      if (n) return;
      T(this, Re, r);
      return;
    }
    const [o, ...i] = s, c = o === "*" ? i.length === 0 ? ["", "", Ge] : ["", "", _s] : o === "/*" ? ["", "", Xe] : o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let u;
    if (c) {
      const l = c[1];
      let p = c[2] || _s;
      if (l && c[2] && (p === ".*" || (p = p.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:"), /\((?!\?:)/.test(p)))) throw Ue;
      if (u = f(this, te)[p], !u) {
        if (Object.keys(f(this, te)).some((m) => m !== Ge && m !== Xe)) throw Ue;
        if (n) return;
        u = f(this, te)[p] = new De(), l !== "" && T(u, Ie, a.varIndex++);
      }
      !n && l !== "" && t.push([l, f(u, Ie)]);
    } else if (u = f(this, te)[o], !u) {
      if (Object.keys(f(this, te)).some((l) => l.length > 1 && l !== Ge && l !== Xe)) throw Ue;
      if (n) return;
      u = f(this, te)[o] = new De();
    }
    u.insert(i, r, t, a, n);
  }
  buildRegExpStr() {
    const r = Object.keys(f(this, te)).sort(_t).map((t) => {
      const a = f(this, te)[t];
      return (typeof f(a, Ie) == "number" ? `(${t})@${f(a, Ie)}` : mt.has(t) ? `\\${t}` : t) + a.buildRegExpStr();
    });
    return typeof f(this, Re) == "number" && r.unshift(`#${f(this, Re)}`), r.length === 0 ? "" : r.length === 1 ? r[0] : "(?:" + r.join("|") + ")";
  }
}, Re = /* @__PURE__ */ new WeakMap(), Ie = /* @__PURE__ */ new WeakMap(), te = /* @__PURE__ */ new WeakMap(), De);
var Es;
var ns;
var ar;
var Et = (ar = class {
  static {
    __name(this, "ar");
  }
  static {
    __name2(this, "ar");
  }
  constructor() {
    I(this, Es, { varIndex: 0 });
    I(this, ns, new ft());
  }
  insert(e, s, r) {
    const t = [], a = [];
    for (let o = 0; ; ) {
      let i = false;
      if (e = e.replace(/\{[^}]+\}/g, (c) => {
        const u = `@\\${o}`;
        return a[o] = [u, c], o++, i = true, u;
      }), !i) break;
    }
    const n = e.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let o = a.length - 1; o >= 0; o--) {
      const [i] = a[o];
      for (let c = n.length - 1; c >= 0; c--) if (n[c].indexOf(i) !== -1) {
        n[c] = n[c].replace(i, a[o][1]);
        break;
      }
    }
    return f(this, ns).insert(n, s, t, f(this, Es), r), t;
  }
  buildRegExp() {
    let e = f(this, ns).buildRegExpStr();
    if (e === "") return [/^$/, [], []];
    let s = 0;
    const r = [], t = [];
    return e = e.replace(/#(\d+)|@(\d+)|\.\*\$/g, (a, n, o) => n !== void 0 ? (r[++s] = Number(n), "$()") : (o !== void 0 && (t[Number(o)] = ++s), "")), [new RegExp(`^${e}`), r, t];
  }
}, Es = /* @__PURE__ */ new WeakMap(), ns = /* @__PURE__ */ new WeakMap(), ar);
var ht = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var ms = /* @__PURE__ */ Object.create(null);
function Sr(e) {
  return ms[e] ?? (ms[e] = new RegExp(e === "*" ? "" : `^${e.replace(/\/\*$|([.\\+*[^\]$()])/g, (s, r) => r ? `\\${r}` : "(?:|/.*)")}$`));
}
__name(Sr, "Sr");
__name2(Sr, "Sr");
function gt() {
  ms = /* @__PURE__ */ Object.create(null);
}
__name(gt, "gt");
__name2(gt, "gt");
function yt(e) {
  var u;
  const s = new Et(), r = [];
  if (e.length === 0) return ht;
  const t = e.map((l) => [!/\*|\/:/.test(l[0]), ...l]).sort(([l, p], [m, E]) => l ? 1 : m ? -1 : p.length - E.length), a = /* @__PURE__ */ Object.create(null);
  for (let l = 0, p = -1, m = t.length; l < m; l++) {
    const [E, _, h] = t[l];
    E ? a[_] = [h.map(([S]) => [S, /* @__PURE__ */ Object.create(null)]), wr] : p++;
    let g;
    try {
      g = s.insert(_, p, E);
    } catch (S) {
      throw S === Ue ? new gr(_) : S;
    }
    E || (r[p] = h.map(([S, y]) => {
      const j = /* @__PURE__ */ Object.create(null);
      for (y -= 1; y >= 0; y--) {
        const [O, L] = g[y];
        j[O] = L;
      }
      return [S, j];
    }));
  }
  const [n, o, i] = s.buildRegExp();
  for (let l = 0, p = r.length; l < p; l++) for (let m = 0, E = r[l].length; m < E; m++) {
    const _ = (u = r[l][m]) == null ? void 0 : u[1];
    if (!_) continue;
    const h = Object.keys(_);
    for (let g = 0, S = h.length; g < S; g++) _[h[g]] = i[_[h[g]]];
  }
  const c = [];
  for (const l in o) c[l] = r[o[l]];
  return [n, c, a];
}
__name(yt, "yt");
__name2(yt, "yt");
function Le(e, s) {
  if (e) {
    for (const r of Object.keys(e).sort((t, a) => a.length - t.length)) if (Sr(r).test(s)) return [...e[r]];
  }
}
__name(Le, "Le");
__name2(Le, "Le");
var _e;
var fe;
var hs;
var Tr;
var nr;
var wt = (nr = class {
  static {
    __name(this, "nr");
  }
  static {
    __name2(this, "nr");
  }
  constructor() {
    I(this, hs);
    b(this, "name", "RegExpRouter");
    I(this, _e);
    I(this, fe);
    b(this, "match", pt);
    T(this, _e, { [W]: /* @__PURE__ */ Object.create(null) }), T(this, fe, { [W]: /* @__PURE__ */ Object.create(null) });
  }
  add(e, s, r) {
    var i;
    const t = f(this, _e), a = f(this, fe);
    if (!t || !a) throw new Error(hr);
    t[e] || [t, a].forEach((c) => {
      c[e] = /* @__PURE__ */ Object.create(null), Object.keys(c[W]).forEach((u) => {
        c[e][u] = [...c[W][u]];
      });
    }), s === "/*" && (s = "*");
    const n = (s.match(/\/:/g) || []).length;
    if (/\*$/.test(s)) {
      const c = Sr(s);
      e === W ? Object.keys(t).forEach((u) => {
        var l;
        (l = t[u])[s] || (l[s] = Le(t[u], s) || Le(t[W], s) || []);
      }) : (i = t[e])[s] || (i[s] = Le(t[e], s) || Le(t[W], s) || []), Object.keys(t).forEach((u) => {
        (e === W || e === u) && Object.keys(t[u]).forEach((l) => {
          c.test(l) && t[u][l].push([r, n]);
        });
      }), Object.keys(a).forEach((u) => {
        (e === W || e === u) && Object.keys(a[u]).forEach((l) => c.test(l) && a[u][l].push([r, n]));
      });
      return;
    }
    const o = lr(s) || [s];
    for (let c = 0, u = o.length; c < u; c++) {
      const l = o[c];
      Object.keys(a).forEach((p) => {
        var m;
        (e === W || e === p) && ((m = a[p])[l] || (m[l] = [...Le(t[p], l) || Le(t[W], l) || []]), a[p][l].push([r, n - u + c + 1]));
      });
    }
  }
  buildAllMatchers() {
    const e = /* @__PURE__ */ Object.create(null);
    return Object.keys(f(this, fe)).concat(Object.keys(f(this, _e))).forEach((s) => {
      e[s] || (e[s] = k(this, hs, Tr).call(this, s));
    }), T(this, _e, T(this, fe, void 0)), gt(), e;
  }
}, _e = /* @__PURE__ */ new WeakMap(), fe = /* @__PURE__ */ new WeakMap(), hs = /* @__PURE__ */ new WeakSet(), Tr = /* @__PURE__ */ __name2(function(e) {
  const s = [];
  let r = e === W;
  return [f(this, _e), f(this, fe)].forEach((t) => {
    const a = t[e] ? Object.keys(t[e]).map((n) => [n, t[e][n]]) : [];
    a.length !== 0 ? (r || (r = true), s.push(...a)) : e !== W && s.push(...Object.keys(t[W]).map((n) => [n, t[W][n]]));
  }), r ? yt(s) : null;
}, "Tr"), nr);
var Ee;
var ce;
var or;
var St = (or = class {
  static {
    __name(this, "or");
  }
  static {
    __name2(this, "or");
  }
  constructor(e) {
    b(this, "name", "SmartRouter");
    I(this, Ee, []);
    I(this, ce, []);
    T(this, Ee, e.routers);
  }
  add(e, s, r) {
    if (!f(this, ce)) throw new Error(hr);
    f(this, ce).push([e, s, r]);
  }
  match(e, s) {
    if (!f(this, ce)) throw new Error("Fatal error");
    const r = f(this, Ee), t = f(this, ce), a = r.length;
    let n = 0, o;
    for (; n < a; n++) {
      const i = r[n];
      try {
        for (let c = 0, u = t.length; c < u; c++) i.add(...t[c]);
        o = i.match(e, s);
      } catch (c) {
        if (c instanceof gr) continue;
        throw c;
      }
      this.match = i.match.bind(i), T(this, Ee, [i]), T(this, ce, void 0);
      break;
    }
    if (n === a) throw new Error("Fatal error");
    return this.name = `SmartRouter + ${this.activeRouter.name}`, o;
  }
  get activeRouter() {
    if (f(this, ce) || f(this, Ee).length !== 1) throw new Error("No active router has been determined yet.");
    return f(this, Ee)[0];
  }
}, Ee = /* @__PURE__ */ new WeakMap(), ce = /* @__PURE__ */ new WeakMap(), or);
var Ye = /* @__PURE__ */ Object.create(null);
var Tt = /* @__PURE__ */ __name2((e) => {
  for (const s in e) return true;
  return false;
}, "Tt");
var he;
var z;
var ve;
var Be;
var J;
var ue;
var Te;
var We;
var bt = (We = class {
  static {
    __name(this, "We");
  }
  static {
    __name2(this, "We");
  }
  constructor(s, r, t) {
    I(this, ue);
    I(this, he);
    I(this, z);
    I(this, ve);
    I(this, Be, 0);
    I(this, J, Ye);
    if (T(this, z, t || /* @__PURE__ */ Object.create(null)), T(this, he, []), s && r) {
      const a = /* @__PURE__ */ Object.create(null);
      a[s] = { handler: r, possibleKeys: [], score: 0 }, T(this, he, [a]);
    }
    T(this, ve, []);
  }
  insert(s, r, t) {
    T(this, Be, ++qs(this, Be)._);
    let a = this;
    const n = Gr(r), o = [];
    for (let i = 0, c = n.length; i < c; i++) {
      const u = n[i], l = n[i + 1], p = Zr(u, l), m = Array.isArray(p) ? p[0] : u;
      if (m in f(a, z)) {
        a = f(a, z)[m], p && o.push(p[1]);
        continue;
      }
      f(a, z)[m] = new We(), p && (f(a, ve).push(p), o.push(p[1])), a = f(a, z)[m];
    }
    return f(a, he).push({ [s]: { handler: t, possibleKeys: o.filter((i, c, u) => u.indexOf(i) === c), score: f(this, Be) } }), a;
  }
  search(s, r) {
    var l;
    const t = [];
    T(this, J, Ye);
    let n = [this];
    const o = cr(r), i = [], c = o.length;
    let u = null;
    for (let p = 0; p < c; p++) {
      const m = o[p], E = p === c - 1, _ = [];
      for (let g = 0, S = n.length; g < S; g++) {
        const y = n[g], j = f(y, z)[m];
        j && (T(j, J, f(y, J)), E ? (f(j, z)["*"] && k(this, ue, Te).call(this, t, f(j, z)["*"], s, f(y, J)), k(this, ue, Te).call(this, t, j, s, f(y, J))) : _.push(j));
        for (let O = 0, L = f(y, ve).length; O < L; O++) {
          const U = f(y, ve)[O], N = f(y, J) === Ye ? {} : { ...f(y, J) };
          if (U === "*") {
            const q = f(y, z)["*"];
            q && (k(this, ue, Te).call(this, t, q, s, f(y, J)), T(q, J, N), _.push(q));
            continue;
          }
          const [D, M, $] = U;
          if (!m && !($ instanceof RegExp)) continue;
          const C = f(y, z)[D];
          if ($ instanceof RegExp) {
            if (u === null) {
              u = new Array(c);
              let Q = r[0] === "/" ? 1 : 0;
              for (let R = 0; R < c; R++) u[R] = Q, Q += o[R].length + 1;
            }
            const q = r.substring(u[p]), V = $.exec(q);
            if (V) {
              if (N[M] = V[0], k(this, ue, Te).call(this, t, C, s, f(y, J), N), Tt(f(C, z))) {
                T(C, J, N);
                const Q = ((l = V[0].match(/\//)) == null ? void 0 : l.length) ?? 0;
                (i[Q] || (i[Q] = [])).push(C);
              }
              continue;
            }
          }
          ($ === true || $.test(m)) && (N[M] = m, E ? (k(this, ue, Te).call(this, t, C, s, N, f(y, J)), f(C, z)["*"] && k(this, ue, Te).call(this, t, f(C, z)["*"], s, N, f(y, J))) : (T(C, J, N), _.push(C)));
        }
      }
      const h = i.shift();
      n = h ? _.concat(h) : _;
    }
    return t.length > 1 && t.sort((p, m) => p.score - m.score), [t.map(({ handler: p, params: m }) => [p, m])];
  }
}, he = /* @__PURE__ */ new WeakMap(), z = /* @__PURE__ */ new WeakMap(), ve = /* @__PURE__ */ new WeakMap(), Be = /* @__PURE__ */ new WeakMap(), J = /* @__PURE__ */ new WeakMap(), ue = /* @__PURE__ */ new WeakSet(), Te = /* @__PURE__ */ __name2(function(s, r, t, a, n) {
  for (let o = 0, i = f(r, he).length; o < i; o++) {
    const c = f(r, he)[o], u = c[t] || c[W], l = {};
    if (u !== void 0 && (u.params = /* @__PURE__ */ Object.create(null), s.push(u), a !== Ye || n && n !== Ye)) for (let p = 0, m = u.possibleKeys.length; p < m; p++) {
      const E = u.possibleKeys[p], _ = l[u.score];
      u.params[E] = n != null && n[E] && !_ ? n[E] : a[E] ?? (n == null ? void 0 : n[E]), l[u.score] = true;
    }
  }
}, "Te"), We);
var Oe;
var ir;
var Rt = (ir = class {
  static {
    __name(this, "ir");
  }
  static {
    __name2(this, "ir");
  }
  constructor() {
    b(this, "name", "TrieRouter");
    I(this, Oe);
    T(this, Oe, new bt());
  }
  add(e, s, r) {
    const t = lr(s);
    if (t) {
      for (let a = 0, n = t.length; a < n; a++) f(this, Oe).insert(e, t[a], r);
      return;
    }
    f(this, Oe).insert(e, s, r);
  }
  match(e, s) {
    return f(this, Oe).search(e, s);
  }
}, Oe = /* @__PURE__ */ new WeakMap(), ir);
var Ds = class extends dt {
  static {
    __name(this, "Ds");
  }
  static {
    __name2(this, "Ds");
  }
  constructor(e = {}) {
    super(e), this.router = e.router ?? new St({ routers: [new wt(), new Rt()] });
  }
};
var w = /* @__PURE__ */ __name2((e) => {
  const r = { ...{ origin: "*", allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"], allowHeaders: [], exposeHeaders: [] }, ...e }, t = /* @__PURE__ */ ((n) => typeof n == "string" ? n === "*" ? () => n : (o) => n === o ? o : null : typeof n == "function" ? n : (o) => n.includes(o) ? o : null)(r.origin), a = ((n) => typeof n == "function" ? n : Array.isArray(n) ? () => n : () => [])(r.allowMethods);
  return async function(o, i) {
    var l;
    function c(p, m) {
      o.res.headers.set(p, m);
    }
    __name(c, "c");
    __name2(c, "c");
    const u = await t(o.req.header("origin") || "", o);
    if (u && c("Access-Control-Allow-Origin", u), r.credentials && c("Access-Control-Allow-Credentials", "true"), (l = r.exposeHeaders) != null && l.length && c("Access-Control-Expose-Headers", r.exposeHeaders.join(",")), o.req.method === "OPTIONS") {
      r.origin !== "*" && c("Vary", "Origin"), r.maxAge != null && c("Access-Control-Max-Age", r.maxAge.toString());
      const p = await a(o.req.header("origin") || "", o);
      p.length && c("Access-Control-Allow-Methods", p.join(","));
      let m = r.allowHeaders;
      if (!(m != null && m.length)) {
        const E = o.req.header("Access-Control-Request-Headers");
        E && (m = E.split(/\s*,\s*/));
      }
      return m != null && m.length && (c("Access-Control-Allow-Headers", m.join(",")), o.res.headers.append("Vary", "Access-Control-Request-Headers")), o.res.headers.delete("Content-Length"), o.res.headers.delete("Content-Type"), new Response(null, { headers: o.res.headers, status: 204, statusText: "No Content" });
    }
    await i(), r.origin !== "*" && o.header("Vary", "Origin", { append: true });
  };
}, "w");
function It(e) {
  var a;
  const s = ((a = e.split(".").pop()) == null ? void 0 : a.toLowerCase()) || "jpg", r = Date.now(), t = crypto.randomUUID().substring(0, 8);
  return `upload_${r}_${t}.${s}`;
}
__name(It, "It");
__name2(It, "It");
async function vt(e) {
  const s = new Uint8Array(e);
  return s[0] === 255 && s[1] === 216 && s[2] === 255 ? { valid: true, detectedType: "image/jpeg" } : s[0] === 137 && s[1] === 80 && s[2] === 78 && s[3] === 71 ? { valid: true, detectedType: "image/png" } : s[0] === 71 && s[1] === 73 && s[2] === 70 && s[3] === 56 ? { valid: true, detectedType: "image/gif" } : s[0] === 82 && s[1] === 73 && s[2] === 70 && s[3] === 70 && s[8] === 87 && s[9] === 69 && s[10] === 66 && s[11] === 80 ? { valid: true, detectedType: "image/webp" } : { valid: false };
}
__name(vt, "vt");
__name2(vt, "vt");
function Ot(e) {
  let s = "";
  for (let r = 0; r < e.byteLength; r++) s += String.fromCharCode(e[r]);
  return s;
}
__name(Ot, "Ot");
__name2(Ot, "Ot");
function br(e) {
  let s = new Uint8Array(e.length);
  for (let r = 0; r < e.length; r++) s[r] = e.charCodeAt(r);
  return s;
}
__name(br, "br");
__name2(br, "br");
function Dt(e) {
  return btoa(Ot(new Uint8Array(e)));
}
__name(Dt, "Dt");
__name2(Dt, "Dt");
function Rr(e) {
  return br(atob(e));
}
__name(Rr, "Rr");
__name2(Rr, "Rr");
function ks(e) {
  return br(e);
}
__name(ks, "ks");
__name2(ks, "ks");
function kt(e) {
  return Dt(e).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(kt, "kt");
__name2(kt, "kt");
function At(e) {
  return Rr(e.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, ""));
}
__name(At, "At");
__name2(At, "At");
function Bs(e) {
  const r = new TextEncoder().encode(e), t = String.fromCharCode(...r);
  return btoa(t).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(Bs, "Bs");
__name2(Bs, "Bs");
function Ir(e) {
  return Rr(e.replace(/-+(BEGIN|END).*/g, "").replace(/\s/g, ""));
}
__name(Ir, "Ir");
__name2(Ir, "Ir");
async function jt(e, s, r) {
  return await crypto.subtle.importKey("raw", ks(e), s, true, r);
}
__name(jt, "jt");
__name2(jt, "jt");
async function Nt(e, s, r) {
  return await crypto.subtle.importKey("jwk", e, s, true, r);
}
__name(Nt, "Nt");
__name2(Nt, "Nt");
async function Ct(e, s, r) {
  return await crypto.subtle.importKey("spki", Ir(e), s, true, r);
}
__name(Ct, "Ct");
__name2(Ct, "Ct");
async function Lt(e, s, r) {
  return await crypto.subtle.importKey("pkcs8", Ir(e), s, true, r);
}
__name(Lt, "Lt");
__name2(Lt, "Lt");
async function vr(e, s, r) {
  if (typeof e == "object") return Nt(e, s, r);
  if (typeof e != "string") throw new Error("Unsupported key type!");
  return e.includes("PUBLIC") ? Ct(e, s, r) : e.includes("PRIVATE") ? Lt(e, s, r) : jt(e, s, r);
}
__name(vr, "vr");
__name2(vr, "vr");
function Ws(e) {
  const s = Array.from(atob(e), (t) => t.charCodeAt(0)), r = new TextDecoder("utf-8").decode(new Uint8Array(s));
  return JSON.parse(r);
}
__name(Ws, "Ws");
__name2(Ws, "Ws");
if (typeof crypto > "u" || !crypto.subtle) throw new Error("SubtleCrypto not supported!");
var Or = { none: { name: "none" }, ES256: { name: "ECDSA", namedCurve: "P-256", hash: { name: "SHA-256" } }, ES384: { name: "ECDSA", namedCurve: "P-384", hash: { name: "SHA-384" } }, ES512: { name: "ECDSA", namedCurve: "P-521", hash: { name: "SHA-512" } }, HS256: { name: "HMAC", hash: { name: "SHA-256" } }, HS384: { name: "HMAC", hash: { name: "SHA-384" } }, HS512: { name: "HMAC", hash: { name: "SHA-512" } }, RS256: { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }, RS384: { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-384" } }, RS512: { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-512" } } };
async function Mt(e, s, r = "HS256") {
  if (typeof r == "string" && (r = { algorithm: r }), r = { algorithm: "HS256", header: { typ: "JWT", ...r.header ?? {} }, ...r }, !e || typeof e != "object") throw new Error("payload must be an object");
  if (r.algorithm !== "none" && (!s || typeof s != "string" && typeof s != "object")) throw new Error("secret must be a string, a JWK object or a CryptoKey object");
  if (typeof r.algorithm != "string") throw new Error("options.algorithm must be a string");
  const t = Or[r.algorithm];
  if (!t) throw new Error("algorithm not found");
  e.iat || (e.iat = Math.floor(Date.now() / 1e3));
  const a = `${Bs(JSON.stringify({ ...r.header, alg: r.algorithm }))}.${Bs(JSON.stringify(e))}`;
  if (r.algorithm === "none") return a;
  const n = s instanceof CryptoKey ? s : await vr(s, t, ["sign"]), o = await crypto.subtle.sign(t, n, ks(a));
  return `${a}.${kt(o)}`;
}
__name(Mt, "Mt");
__name2(Mt, "Mt");
async function Pt(e, s, r = "HS256") {
  var u;
  if (typeof r == "string" && (r = { algorithm: r }), r = { algorithm: "HS256", clockTolerance: 0, throwError: false, ...r }, typeof e != "string") throw new Error("token must be a string");
  if (r.algorithm !== "none" && typeof s != "string" && typeof s != "object") throw new Error("secret must be a string, a JWK object or a CryptoKey object");
  if (typeof r.algorithm != "string") throw new Error("options.algorithm must be a string");
  const t = e.split(".", 3);
  if (t.length < 2) throw new Error("token must consist of 2 or more parts");
  const [a, n, o] = t, i = Or[r.algorithm];
  if (!i) throw new Error("algorithm not found");
  const c = Dr(e);
  try {
    if (((u = c.header) == null ? void 0 : u.alg) !== r.algorithm) throw new Error("INVALID_SIGNATURE");
    if (c.payload) {
      const p = Math.floor(Date.now() / 1e3);
      if (c.payload.nbf && c.payload.nbf > p && c.payload.nbf - p > (r.clockTolerance ?? 0)) throw new Error("NOT_YET_VALID");
      if (c.payload.exp && c.payload.exp <= p && p - c.payload.exp > (r.clockTolerance ?? 0)) throw new Error("EXPIRED");
    }
    if (i.name === "none") return c;
    const l = s instanceof CryptoKey ? s : await vr(s, i, ["verify"]);
    if (!await crypto.subtle.verify(i, l, At(o), ks(`${a}.${n}`))) throw new Error("INVALID_SIGNATURE");
    return c;
  } catch (l) {
    if (r.throwError) throw l;
    return;
  }
}
__name(Pt, "Pt");
__name2(Pt, "Pt");
function Dr(e) {
  return { header: Ws(e.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")), payload: Ws(e.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")) };
}
__name(Dr, "Dr");
__name2(Dr, "Dr");
var Qe = { sign: Mt, verify: Pt, decode: Dr };
function de(e) {
  return (e == null ? void 0 : e.JWT_SECRET) || "ur-live-commerce-jwt-secret-2026-CHANGE-THIS-IN-PRODUCTION";
}
__name(de, "de");
__name2(de, "de");
async function os(e, s) {
  return await Qe.sign({ userId: e.userId, userType: e.userType, email: e.email, exp: Math.floor(Date.now() / 1e3) + 3600, type: "access" }, s);
}
__name(os, "os");
__name2(os, "os");
async function As(e, s) {
  return await Qe.sign({ userId: e.userId, userType: e.userType, email: e.email, exp: Math.floor(Date.now() / 1e3) + 720 * 60 * 60, type: "refresh" }, s);
}
__name(As, "As");
__name2(As, "As");
async function is(e, s) {
  try {
    return await Qe.verify(e, s) ? Qe.decode(e).payload : null;
  } catch {
    return null;
  }
}
__name(is, "is");
__name2(is, "is");
async function kr(e, s) {
  const r = await is(e, s);
  return !r || r.type !== "refresh" ? null : await os({ userId: r.userId, userType: r.userType, email: r.email }, s);
}
__name(kr, "kr");
__name2(kr, "kr");
async function Ar(e, s, r) {
  try {
    const n = Qe.decode(e).payload.exp - Math.floor(Date.now() / 1e3);
    n > 0 && await s.put(`blacklist:token:${e}`, "1", { expirationTtl: n });
  } catch (t) {
    console.error("Failed to blacklist token:", t);
  }
}
__name(Ar, "Ar");
__name2(Ar, "Ar");
async function Ut(e, s) {
  try {
    return await s.get(`blacklist:token:${e}`) !== null;
  } catch {
    return false;
  }
}
__name(Ut, "Ut");
__name2(Ut, "Ut");
var Je = /* @__PURE__ */ new Map();
async function js(e, s) {
  const r = Math.floor(Date.now() / 1e3), t = Je.get(e);
  if (t && t.exp > r) return t.payload;
  const a = await is(e, s);
  if (a && a.exp && (Je.set(e, { payload: a, exp: a.exp }), Je.size > 1e3)) {
    const n = Je.keys().next().value;
    Je.delete(n);
  }
  return a;
}
__name(js, "js");
__name2(js, "js");
var jr = Object.freeze(Object.defineProperty({ __proto__: null, blacklistToken: Ar, generateAccessToken: os, generateRefreshToken: As, getJwtSecret: de, isTokenBlacklisted: Ut, refreshAccessToken: kr, verifyCachedToken: js, verifyToken: is }, Symbol.toStringTag, { value: "Module" }));
var cs = new Ds();
cs.post("/api/auth/refresh", w(), async (e) => {
  try {
    const { refresh_token: s } = await e.req.json();
    if (!s) return e.json({ success: false, error: "Refresh token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
    const r = de(e.env), t = await is(s, r);
    if (!t || t.type !== "refresh") return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 refresh token\uC785\uB2C8\uB2E4." }, 401);
    if (e.env.SESSION_KV && await e.env.SESSION_KV.get(`blacklist:token:${s}`)) return e.json({ success: false, error: "\uB85C\uADF8\uC544\uC6C3\uB41C refresh token\uC785\uB2C8\uB2E4." }, 401);
    const a = await os({ userId: t.userId, userType: t.userType, email: t.email }, r);
    return e.json({ success: true, access_token: a, expires_in: 900 });
  } catch (s) {
    return console.error("[JWT] Refresh token error:", s), e.json({ success: false, error: "Refresh token \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
cs.post("/api/auth/logout", w(), async (e) => {
  try {
    const s = e.req.header("Authorization"), r = s == null ? void 0 : s.replace("Bearer ", "");
    if (!r) return e.json({ success: false, error: "\uB85C\uADF8\uC544\uC6C3\uD560 \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 400);
    if (!e.env.SESSION_KV) return e.json({ success: false, error: "KV\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 500);
    const t = de(e.env);
    return await Ar(r, e.env.SESSION_KV, t), e.json({ success: true, message: "\uB85C\uADF8\uC544\uC6C3\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (s) {
    return console.error("[JWT] Logout error:", s), e.json({ success: false, error: "\uB85C\uADF8\uC544\uC6C3 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
cs.post("/api/auth/login-jwt", w(), async (e) => {
  try {
    const { email: s, password: r, user_type: t } = await e.req.json();
    if (!s || !r) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD558\uC138\uC694." }, 400);
    const a = { userId: 1, userType: t || "user", email: s }, n = de(e.env), o = await os(a, n), i = await As(a, n);
    return e.json({ success: true, access_token: o, refresh_token: i, expires_in: 900, token_type: "Bearer", user: { id: a.userId, email: a.email, user_type: a.userType } });
  } catch (s) {
    return console.error("[JWT] Login error:", s), e.json({ success: false, error: "\uB85C\uADF8\uC778 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
cs.get("/api/auth/verify", w(), async (e) => {
  try {
    const s = e.req.header("Authorization"), r = s == null ? void 0 : s.replace("Bearer ", "");
    if (!r) return e.json({ success: false, error: "\uD1A0\uD070\uC774 \uC81C\uACF5\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const t = de(e.env), a = await is(r, t);
    return a ? e.json({ success: true, payload: a }) : e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uD1A0\uD070\uC785\uB2C8\uB2E4." }, 401);
  } catch {
    return e.json({ success: false, error: "\uD1A0\uD070 \uAC80\uC99D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
function $t(e) {
  const s = ["DB", "SESSION_KV", "CACHE_KV", "TOSS_SECRET_KEY", "TOSS_CLIENT_KEY"], r = [];
  for (const t of s) e[t] || r.push(t);
  if (r.length > 0) throw new Error(`Missing required environment variables: ${r.join(", ")}

Please configure them:
` + r.map((t) => t === "TOSS_SECRET_KEY" || t === "TOSS_CLIENT_KEY" ? `  npx wrangler pages secret put ${t} --project-name ur-live` : `  Check wrangler.jsonc for ${t} binding`).join(`
`) + `

For more details, see ENV_SETUP_GUIDE.md`);
}
__name($t, "$t");
__name2($t, "$t");
function qt(e) {
  console.log("[ENV] Environment check:"), console.log("  DB:", e.DB ? "\u2705 Connected" : "\u274C Missing"), console.log("  SESSION_KV:", e.SESSION_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  CACHE_KV:", e.CACHE_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  TOSS_SECRET_KEY:", e.TOSS_SECRET_KEY ? "\u2705 Set" : "\u274C Missing"), console.log("  TOSS_CLIENT_KEY:", e.TOSS_CLIENT_KEY ? "\u2705 Set" : "\u274C Missing");
}
__name(qt, "qt");
__name2(qt, "qt");
async function Ht(e) {
  const s = [];
  try {
    e.DB ? (await e.DB.prepare("SELECT 1").first(), s.push({ name: "D1 Database Binding", status: "pass", message: "DB connected successfully" })) : s.push({ name: "D1 Database Binding", status: "fail", message: "DB binding not found", details: "Check wrangler.jsonc d1_databases configuration" });
  } catch (r) {
    s.push({ name: "D1 Database Binding", status: "fail", message: "DB query failed", details: r instanceof Error ? r.message : String(r) });
  }
  try {
    if (!e.SESSION_KV) s.push({ name: "SESSION_KV Binding", status: "fail", message: "SESSION_KV binding not found", details: "Check wrangler.jsonc kv_namespaces configuration" });
    else {
      const r = "test:env:check";
      await e.SESSION_KV.put(r, "ok", { expirationTtl: 60 }), await e.SESSION_KV.get(r) === "ok" ? s.push({ name: "SESSION_KV Binding", status: "pass", message: "SESSION_KV read/write successful" }) : s.push({ name: "SESSION_KV Binding", status: "warn", message: "SESSION_KV write succeeded but read failed" });
    }
  } catch (r) {
    s.push({ name: "SESSION_KV Binding", status: "fail", message: "SESSION_KV operation failed", details: r instanceof Error ? r.message : String(r) });
  }
  try {
    if (!e.CACHE_KV) s.push({ name: "CACHE_KV Binding", status: "fail", message: "CACHE_KV binding not found", details: "Check wrangler.jsonc kv_namespaces configuration" });
    else {
      const r = "test:cache:check";
      await e.CACHE_KV.put(r, "ok", { expirationTtl: 60 }), await e.CACHE_KV.get(r) === "ok" ? s.push({ name: "CACHE_KV Binding", status: "pass", message: "CACHE_KV read/write successful" }) : s.push({ name: "CACHE_KV Binding", status: "warn", message: "CACHE_KV write succeeded but read failed" });
    }
  } catch (r) {
    s.push({ name: "CACHE_KV Binding", status: "fail", message: "CACHE_KV operation failed", details: r instanceof Error ? r.message : String(r) });
  }
  return e.TOSS_SECRET_KEY ? !e.TOSS_SECRET_KEY.startsWith("test_gsk_") && !e.TOSS_SECRET_KEY.startsWith("live_gsk_") ? s.push({ name: "TOSS_SECRET_KEY", status: "warn", message: "TOSS_SECRET_KEY format may be invalid", details: "Expected format: test_gsk_* or live_gsk_*" }) : s.push({ name: "TOSS_SECRET_KEY", status: "pass", message: `TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0, 12)}...)` }) : s.push({ name: "TOSS_SECRET_KEY", status: "fail", message: "TOSS_SECRET_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live" }), e.TOSS_CLIENT_KEY ? !e.TOSS_CLIENT_KEY.startsWith("test_gck_") && !e.TOSS_CLIENT_KEY.startsWith("live_gck_") ? s.push({ name: "TOSS_CLIENT_KEY", status: "warn", message: "TOSS_CLIENT_KEY format may be invalid", details: "Expected format: test_gck_* or live_gck_*" }) : s.push({ name: "TOSS_CLIENT_KEY", status: "pass", message: `TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0, 12)}...)` }) : s.push({ name: "TOSS_CLIENT_KEY", status: "fail", message: "TOSS_CLIENT_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live" }), s;
}
__name(Ht, "Ht");
__name2(Ht, "Ht");
function Ft(e) {
  const s = [];
  s.push(""), s.push("========================================"), s.push("\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uACB0\uACFC"), s.push("========================================"), s.push("");
  let r = 0, t = 0, a = 0;
  for (const n of e) {
    const o = n.status === "pass" ? "\u2705" : n.status === "warn" ? "\u26A0\uFE0F" : "\u274C";
    s.push(`${o} ${n.name}: ${n.message}`), n.details && s.push(`   \u2192 ${n.details}`), n.status === "pass" && r++, n.status === "warn" && t++, n.status === "fail" && a++;
  }
  return s.push(""), s.push("========================================"), s.push(`\uCD1D ${e.length}\uAC1C \uD14C\uC2A4\uD2B8:`), s.push(`  \u2705 \uC131\uACF5: ${r}`), t > 0 && s.push(`  \u26A0\uFE0F  \uACBD\uACE0: ${t}`), a > 0 && s.push(`  \u274C \uC2E4\uD328: ${a}`), s.push("========================================"), s.push(""), a > 0 ? (s.push("\u274C \uD658\uACBD \uBCC0\uC218 \uC124\uC815\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."), s.push("\uC790\uC138\uD55C \uB0B4\uC6A9\uC740 ENV_SETUP_GUIDE.md\uB97C \uCC38\uACE0\uD558\uC138\uC694.")) : t > 0 ? s.push("\u26A0\uFE0F  \uC77C\uBD80 \uACBD\uACE0\uAC00 \uC788\uC9C0\uB9CC \uBC30\uD3EC\uB294 \uAC00\uB2A5\uD569\uB2C8\uB2E4.") : s.push("\u2705 \uBAA8\uB4E0 \uD658\uACBD \uBCC0\uC218\uAC00 \uC62C\uBC14\uB974\uAC8C \uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4!"), s.join(`
`);
}
__name(Ft, "Ft");
__name2(Ft, "Ft");
async function xt(e) {
  const s = await Ht(e), r = s.filter((n) => n.status === "pass").length, t = s.filter((n) => n.status === "warn").length, a = s.filter((n) => n.status === "fail").length;
  return { success: a === 0, summary: { total: s.length, pass: r, warn: t, fail: a }, results: s, formatted: Ft(s) };
}
__name(xt, "xt");
__name2(xt, "xt");
var Ts = { ENV: "test", TEST_API_KEY: "03148F80-9525-4A00-83B4-1AE55DFFA2DF", TEST_BASE_URL: "https://testapi.barobill.co.kr" };
function Bt() {
  const e = Ts.ENV === "production";
  return { baseUrl: Ts.TEST_BASE_URL, apiKey: Ts.TEST_API_KEY, isProduction: e };
}
__name(Bt, "Bt");
__name2(Bt, "Bt");
async function Nr(e, s) {
  const r = Bt(), t = `${r.baseUrl}${e}`;
  try {
    const a = await fetch(t, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${r.apiKey}` }, body: JSON.stringify(s) });
    if (!a.ok) throw new Error(`\uBC14\uB85C\uBE4C API \uC624\uB958: ${a.status} ${a.statusText}`);
    return await a.json();
  } catch (a) {
    throw console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", a), a;
  }
}
__name(Nr, "Nr");
__name2(Nr, "Nr");
async function Wt(e) {
  try {
    const s = { CorpNum: e.supplierBusinessNumber, InvoicerCorpNum: e.supplierBusinessNumber, InvoicerCorpName: e.supplierBusinessName, InvoicerCEOName: e.supplierCEO, InvoicerAddr: e.supplierAddress, InvoicerBizType: e.supplierBusinessType, InvoicerBizClass: e.supplierBusinessCategory, InvoicerContactName: e.supplierCEO, InvoicerEmail: e.supplierEmail, InvoicerTEL: e.supplierTel, InvoiceeType: e.buyerBusinessNumber ? "\uC0AC\uC5C5\uC790" : "\uAC1C\uC778", InvoiceeCorpNum: e.buyerBusinessNumber, InvoiceeCorpName: e.buyerBusinessName, InvoiceeCEOName: e.buyerCEO, InvoiceeAddr: e.buyerAddress, InvoiceeEmail: e.buyerEmail, InvoiceeTEL: e.buyerTel, WriteDate: e.writeDate, PurposeType: e.purposeType, TaxType: e.taxType, DetailList: e.items.map((t, a) => ({ SerialNum: a + 1, ItemName: t.name, Qty: t.quantity, UnitPrice: t.unitPrice, SupplyCost: t.supplyPrice, Tax: t.taxAmount, Remark: t.description || "" })), SupplyCostTotal: e.totalSupplyPrice.toString(), TaxTotal: e.totalTaxAmount.toString(), TotalAmount: e.totalAmount.toString(), Remark1: e.memo || "", Remark2: e.orderNo || "", SendSMS: false, AutoAccept: false }, r = await Nr("/eTaxInvoice/RegistAndIssue", s);
    if (r.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC2E4\uD328: ${r.message}`);
    return { success: true, ntsConfirmNumber: r.ntsconfirmNum, invoiceKey: r.invoiceKey, message: r.message };
  } catch (s) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC2E4\uD328:", s), s;
  }
}
__name(Wt, "Wt");
__name2(Wt, "Wt");
async function Kt(e, s, r) {
  try {
    const a = await Nr("/eTaxInvoice/Delete", { CorpNum: e, InvoiceKey: s, Memo: r });
    if (a.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uCDE8\uC18C \uC2E4\uD328: ${a.message}`);
    return { success: true, message: a.message };
  } catch (t) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uCDE8\uC18C \uC2E4\uD328:", t), t;
  }
}
__name(Kt, "Kt");
__name2(Kt, "Kt");
function ze() {
  return false;
}
__name(ze, "ze");
__name2(ze, "ze");
async function Vt(e) {
  return await Wt(e);
}
__name(Vt, "Vt");
__name2(Vt, "Vt");
function Yt(e, s, r) {
  const t = Number(s.total_amount), a = Math.floor(t / 1.1), n = t - a;
  return { supplierBusinessNumber: e.business_number, supplierBusinessName: e.business_name, supplierCEO: e.ceo_name, supplierAddress: e.address, supplierBusinessType: e.business_type, supplierBusinessCategory: e.business_category, supplierEmail: e.email, supplierTel: e.phone, buyerBusinessNumber: s.buyer_business_number, buyerBusinessName: s.buyer_business_name || s.user_name, buyerCEO: s.buyer_ceo_name, buyerAddress: s.shipping_address, buyerEmail: s.user_email, buyerTel: s.shipping_phone, writeDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], purposeType: "01", taxType: "01", items: r.map((o) => {
    const i = Number(o.price) * Number(o.quantity), c = Math.floor(i / 1.1), u = i - c;
    return { name: o.product_name, quantity: Number(o.quantity), unitPrice: Number(o.price), supplyPrice: c, taxAmount: u, description: o.option_name || "" };
  }), totalSupplyPrice: a, totalTaxAmount: n, totalAmount: t, memo: `\uC8FC\uBB38\uBC88\uD638: ${s.order_number}`, orderNo: s.order_number };
}
__name(Yt, "Yt");
__name2(Yt, "Yt");
var ee = class extends Error {
  static {
    __name(this, "ee");
  }
  static {
    __name2(this, "ee");
  }
  constructor(s, r, t) {
    super(s), this.statusCode = r, this.code = t, this.name = "AuthError";
  }
};
function Jt(e) {
  return `${crypto.randomUUID()}-${e}`;
}
__name(Jt, "Jt");
__name2(Jt, "Jt");
function zt(e) {
  var n, o, i, c, u, l, p;
  const s = e.id.toString(), r = ((n = e.properties) == null ? void 0 : n.nickname) || ((i = (o = e.kakao_account) == null ? void 0 : o.profile) == null ? void 0 : i.nickname) || "Kakao User", t = ((c = e.kakao_account) == null ? void 0 : c.email) || null, a = ((u = e.properties) == null ? void 0 : u.profile_image) || ((p = (l = e.kakao_account) == null ? void 0 : l.profile) == null ? void 0 : p.profile_image_url) || null;
  return { kakaoId: s, nickname: r, email: t, profileImage: a };
}
__name(zt, "zt");
__name2(zt, "zt");
async function Gt(e, s, r, t, a) {
  try {
    const n = await e.prepare(`
      INSERT INTO users (
        kakao_id, name, email, profile_image, 
        created_at, last_login_at, updated_at
      )
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(kakao_id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        profile_image = excluded.profile_image,
        last_login_at = datetime('now'),
        updated_at = datetime('now')
      RETURNING id, kakao_id, name, email, profile_image
    `).bind(s, r, t, a).first();
    if (!n) throw new ee("Failed to upsert user", 500, "UPSERT_FAILED");
    return console.log("[Auth] \u26A1 User upserted successfully (optimized):", n.id), n;
  } catch (n) {
    throw n instanceof ee ? n : (console.error("[Auth] Database error during upsert:", n), new ee("Database error", 500, "DB_ERROR"));
  }
}
__name(Gt, "Gt");
__name2(Gt, "Gt");
async function Xt(e) {
  try {
    const s = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${e}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" } });
    if (!s.ok) {
      const t = await s.text();
      throw console.error("[Kakao API] Failed to get user info:", t), new ee("Failed to get user info from Kakao", 401, "KAKAO_USER_INFO_FAILED");
    }
    const r = await s.json();
    if (!r.id) throw new ee("Invalid user data from Kakao", 500, "INVALID_KAKAO_DATA");
    return r;
  } catch (s) {
    throw s instanceof ee ? s : (console.error("[Kakao API] Network error:", s), new ee("Failed to communicate with Kakao API", 503, "KAKAO_API_ERROR"));
  }
}
__name(Xt, "Xt");
__name2(Xt, "Xt");
async function Qt(e, s, r) {
  try {
    const t = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: r, redirect_uri: s, code: e }).toString() });
    if (!t.ok) {
      const n = await t.json();
      throw console.error("[Kakao OAuth] Token exchange failed:", n), new ee(`Failed to exchange code: ${n.error_description || n.error}`, 401, n.error || "TOKEN_EXCHANGE_FAILED");
    }
    return (await t.json()).access_token;
  } catch (t) {
    throw t instanceof ee ? t : (console.error("[Kakao OAuth] Network error:", t), new ee("Failed to communicate with Kakao OAuth server", 503, "OAUTH_NETWORK_ERROR"));
  }
}
__name(Qt, "Qt");
__name2(Qt, "Qt");
async function Cr(e, s) {
  const r = await Xt(s), { kakaoId: t, nickname: a, email: n, profileImage: o } = zt(r);
  console.log("[Auth] Processing login for Kakao user:", t);
  const i = await Gt(e, t, a, n, o), c = Jt(i.id);
  return { user: i, sessionToken: c };
}
__name(Cr, "Cr");
__name2(Cr, "Cr");
async function Lr(e, s, r = 30) {
  try {
    const t = await e.get(s, "json");
    if (!t) return console.log(`[Cache MISS] ${s}`), null;
    const a = Date.now() - t.timestamp;
    return a > r * 1e3 ? (console.log(`[Cache EXPIRED] ${s} (age: ${Math.round(a / 1e3)}s)`), null) : (console.log(`[Cache HIT] ${s} (age: ${Math.round(a / 1e3)}s)`), t.data);
  } catch (t) {
    return console.error(`[Cache] Get error for key "${s}":`, t), null;
  }
}
__name(Lr, "Lr");
__name2(Lr, "Lr");
async function fs(e, s, r, t = 30) {
  try {
    const a = { data: r, timestamp: Date.now() };
    await e.put(s, JSON.stringify(a), { expirationTtl: t }), console.log(`[Cache SET] ${s} (TTL: ${t}s)`);
  } catch (a) {
    console.error(`[Cache] Set error for key "${s}":`, a);
  }
}
__name(fs, "fs");
__name2(fs, "fs");
function Zt(e) {
  const s = e.req.header("CF-Connecting-IP");
  if (s) return s;
  const r = e.req.header("X-Forwarded-For");
  if (r) return r.split(",")[0].trim();
  const t = e.req.header("X-Real-IP");
  return t || "unknown";
}
__name(Zt, "Zt");
__name2(Zt, "Zt");
function ea(e, s) {
  return `ratelimit:${e}:${s}`;
}
__name(ea, "ea");
__name2(ea, "ea");
var bs = /* @__PURE__ */ new Map();
async function sa(e, s, r) {
  var m;
  const t = new URL(e.req.url).pathname, a = ea(s, t), n = Date.now(), o = r.windowMs * 1e3, c = e.get("user") && r.authenticatedMultiplier ? r.maxRequests * r.authenticatedMultiplier : r.maxRequests;
  try {
    const E = (m = e.env) == null ? void 0 : m.RATE_LIMIT_KV;
    if (E) {
      const _ = await E.get(a);
      let h;
      _ ? (h = JSON.parse(_), n > h.resetTime ? h = { count: 1, resetTime: n + o } : h.count++) : h = { count: 1, resetTime: n + o };
      const g = Math.ceil(o / 1e3);
      await E.put(a, JSON.stringify(h), { expirationTtl: g });
      const S = h.count <= c, y = Math.max(0, c - h.count);
      return { allowed: S, remaining: y, resetTime: h.resetTime };
    }
  } catch (E) {
    console.error("KV Rate Limit Error:", E);
  }
  let u = bs.get(a);
  u && n > u.resetTime && (bs.delete(a), u = void 0), u ? u.count++ : u = { count: 1, resetTime: n + o }, bs.set(a, u);
  const l = u.count <= c, p = Math.max(0, c - u.count);
  return { allowed: l, remaining: p, resetTime: u.resetTime };
}
__name(sa, "sa");
__name2(sa, "sa");
function ke(e) {
  return async (s, r) => {
    const t = Zt(s);
    if (e.skipIps && e.skipIps.includes(t)) return r();
    if (e.pathPattern) {
      const n = new URL(s.req.url).pathname;
      if (!e.pathPattern.test(n)) return r();
    }
    const a = await sa(s, t, e);
    if (s.header("X-RateLimit-Limit", e.maxRequests.toString()), s.header("X-RateLimit-Remaining", a.remaining.toString()), s.header("X-RateLimit-Reset", new Date(a.resetTime).toISOString()), !a.allowed) {
      const n = Math.ceil((a.resetTime - Date.now()) / 1e3);
      return s.header("Retry-After", n.toString()), s.json({ success: false, error: e.message || "Too many requests. Please try again later.", retryAfter: n, resetTime: new Date(a.resetTime).toISOString() }, 429);
    }
    return r();
  };
}
__name(ke, "ke");
__name2(ke, "ke");
var Ae = { api: { windowMs: 60, maxRequests: 60, message: "API \uC694\uCCAD \uC81C\uD55C\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", authenticatedMultiplier: 2 }, auth: { windowMs: 60, maxRequests: 5, message: "\uB85C\uADF8\uC778 \uC2DC\uB3C4 \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uBD84 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/auth\// }, order: { windowMs: 60, maxRequests: 10, message: "\uC8FC\uBB38 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders/, authenticatedMultiplier: 2 }, cart: { windowMs: 60, maxRequests: 20, message: "\uC7A5\uBC14\uAD6C\uB2C8 \uC694\uCCAD\uC774 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/cart/, authenticatedMultiplier: 2 }, refund: { windowMs: 3600, maxRequests: 3, message: "\uD658\uBD88 \uC694\uCCAD \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uC2DC\uAC04 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders\/.*\/refund/ }, alimtalk: { windowMs: 60, maxRequests: 10, message: "\uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/seller\/alimtalk\/send/ }, upload: { windowMs: 60, maxRequests: 5, message: "\uD30C\uC77C \uC5C5\uB85C\uB4DC\uAC00 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/.*\/upload/ } };
var F = class extends Error {
  static {
    __name(this, "F");
  }
  static {
    __name2(this, "F");
  }
  constructor(s, r, t = "VALIDATION_ERROR") {
    super(r), this.field = s, this.code = t, this.name = "ValidationError";
  }
};
function ra(e, s) {
  const { field: r, required: t, type: a, min: n, max: o, pattern: i, enum: c, custom: u, message: l } = s;
  if (t && (e == null || e === "")) throw new F(r, l || `${r}\uC740(\uB294) \uD544\uC218 \uD56D\uBAA9\uC785\uB2C8\uB2E4.`, "REQUIRED");
  if (!(e == null || e === "")) {
    if (a) switch (a) {
      case "string":
        if (typeof e != "string") throw new F(r, l || `${r}\uC740(\uB294) \uBB38\uC790\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "number":
        const p = typeof e == "string" ? Number(e) : e;
        if (typeof p != "number" || isNaN(p)) throw new F(r, l || `${r}\uC740(\uB294) \uC22B\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "boolean":
        if (typeof e != "boolean") throw new F(r, l || `${r}\uC740(\uB294) true/false \uAC12\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "email":
        if (typeof e != "string" || !na(e)) throw new F(r, l || `${r}\uC740(\uB294) \uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_EMAIL");
        break;
      case "url":
        if (typeof e != "string" || !oa(e)) throw new F(r, l || `${r}\uC740(\uB294) \uC720\uD6A8\uD55C URL\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_URL");
        break;
      case "phone":
        if (typeof e != "string" || !ia(e)) throw new F(r, l || `${r}\uC740(\uB294) \uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_PHONE");
        break;
      case "date":
        if (!(e instanceof Date) && !ca(e)) throw new F(r, l || `${r}\uC740(\uB294) \uC720\uD6A8\uD55C \uB0A0\uC9DC\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_DATE");
        break;
      case "array":
        if (!Array.isArray(e)) throw new F(r, l || `${r}\uC740(\uB294) \uBC30\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "object":
        if (typeof e != "object" || e === null || Array.isArray(e)) throw new F(r, l || `${r}\uC740(\uB294) \uAC1D\uCCB4\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
    }
    if (typeof e == "string") {
      if (n !== void 0 && e.length < n) throw new F(r, l || `${r}\uC740(\uB294) \uCD5C\uC18C ${n}\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SHORT");
      if (o !== void 0 && e.length > o) throw new F(r, l || `${r}\uC740(\uB294) \uCD5C\uB300 ${o}\uC790 \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LONG");
    }
    if (typeof e == "number") {
      if (n !== void 0 && e < n) throw new F(r, l || `${r}\uC740(\uB294) \uCD5C\uC18C ${n} \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SMALL");
      if (o !== void 0 && e > o) throw new F(r, l || `${r}\uC740(\uB294) \uCD5C\uB300 ${o} \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LARGE");
    }
    if (Array.isArray(e)) {
      if (n !== void 0 && e.length < n) throw new F(r, l || `${r}\uC740(\uB294) \uCD5C\uC18C ${n}\uAC1C \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_FEW");
      if (o !== void 0 && e.length > o) throw new F(r, l || `${r}\uC740(\uB294) \uCD5C\uB300 ${o}\uAC1C \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_MANY");
    }
    if (i && typeof e == "string" && !i.test(e)) throw new F(r, l || `${r}\uC758 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "INVALID_FORMAT");
    if (c && !c.includes(e)) throw new F(r, l || `${r}\uC740(\uB294) \uB2E4\uC74C \uC911 \uD558\uB098\uC5EC\uC57C \uD569\uB2C8\uB2E4: ${c.join(", ")}`, "INVALID_ENUM");
    if (u && u(e) === false) throw new F(r, l || `${r}\uC758 \uAC12\uC774 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "CUSTOM_VALIDATION_FAILED");
  }
}
__name(ra, "ra");
__name2(ra, "ra");
function ta(e, s) {
  for (const r of s) {
    const t = e[r.field];
    ra(t, r);
  }
}
__name(ta, "ta");
__name2(ta, "ta");
function aa(e) {
  return async (s, r) => {
    try {
      let t = {};
      const a = s.req.header("content-type") || "";
      a.includes("application/json") ? t = await s.req.json().catch(() => ({})) : (a.includes("application/x-www-form-urlencoded") || a.includes("multipart/form-data")) && (t = await s.req.parseBody().catch(() => ({})));
      const n = new URL(s.req.url);
      for (const [o, i] of n.searchParams.entries()) o in t || (t[o] = i);
      ta(t, e), s.set("validatedData", t), await r();
    } catch (t) {
      if (t instanceof F) return s.json({ success: false, error: t.message, field: t.field, code: t.code }, 400);
      throw t;
    }
  };
}
__name(aa, "aa");
__name2(aa, "aa");
function na(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}
__name(na, "na");
__name2(na, "na");
function oa(e) {
  try {
    const s = new URL(e);
    return s.protocol === "http:" || s.protocol === "https:";
  } catch {
    return false;
  }
}
__name(oa, "oa");
__name2(oa, "oa");
function ia(e) {
  return /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e);
}
__name(ia, "ia");
__name2(ia, "ia");
function ca(e) {
  if (typeof e != "string") return false;
  const s = new Date(e);
  return !isNaN(s.getTime());
}
__name(ca, "ca");
__name2(ca, "ca");
var ua = [{ field: "email", required: true, type: "email", max: 255, message: "\uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, { field: "password", required: true, type: "string", min: 8, max: 100, pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: "\uBE44\uBC00\uBC88\uD638\uB294 \uCD5C\uC18C 8\uC790 \uC774\uC0C1, \uB300\uC18C\uBB38\uC790\uC640 \uC22B\uC790\uB97C \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4." }, { field: "name", required: true, type: "string", min: 2, max: 50, message: "\uC774\uB984\uC740 2-50\uC790 \uC0AC\uC774\uC5EC\uC57C \uD569\uB2C8\uB2E4." }, { field: "phone", required: false, type: "phone", message: "\uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694. (\uC608: 010-1234-5678)" }];
function gs(e) {
  const s = new URLSearchParams();
  for (const [r, t] of Object.entries(e)) t != null && s.append(r, String(t));
  return s;
}
__name(gs, "gs");
__name2(gs, "gs");
function Ns(e, s) {
  if (e.result_code !== "1") throw new Error(`[Aligo ${s}] ${e.message} (code: ${e.result_code})`);
}
__name(Ns, "Ns");
__name2(Ns, "Ns");
async function Cs(e) {
  console.log("[Aligo] \uD1A0\uD070 \uC0DD\uC131 \uC2DC\uC791");
  const r = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: gs({ apikey: e.ALIGO_API_KEY, userid: e.ALIGO_USER_ID }) })).json();
  return Ns(r, "Token Create"), console.log("[Aligo] \u2705 \uD1A0\uD070 \uC0DD\uC131 \uC131\uACF5:", r.token.substring(0, 20) + "..."), { token: r.token, urtime: r.urtime };
}
__name(Cs, "Cs");
__name2(Cs, "Cs");
async function la(e, s) {
  console.log("[Aligo] \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D:", s.channelId);
  const { token: r } = await Cs(e), a = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: gs({ token: r, userid: e.ALIGO_USER_ID, plusid: s.channelId, phonenumber: s.phoneNumber }) })).json();
  return Ns(a, "Channel Register"), console.log("[Aligo] \u2705 \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D \uC131\uACF5, senderKey:", a.senderkey), { success: true, senderKey: a.senderkey };
}
__name(la, "la");
__name2(la, "la");
async function da(e, s, r) {
  console.log("[Aligo] \uD15C\uD50C\uB9BF \uB4F1\uB85D:", r.templateCode);
  const { token: t } = await Cs(e), n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: gs({ token: t, userid: e.ALIGO_USER_ID, senderkey: s, tpl_name: r.name, tpl_content: r.content, tpl_code: r.templateCode }) })).json();
  return Ns(n, "Template Register"), console.log("[Aligo] \u2705 \uD15C\uD50C\uB9BF \uB4F1\uB85D \uC131\uACF5:", n.tpl_code), { success: true, templateCode: n.tpl_code };
}
__name(da, "da");
__name2(da, "da");
async function Ls(e, s) {
  console.log("[Aligo] \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1:", s.to);
  try {
    const { token: r } = await Cs(e), t = s.buttons ? JSON.stringify({ button: s.buttons }) : void 0, n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: gs({ token: r, userid: e.ALIGO_USER_ID, senderkey: s.senderKey, tpl_code: s.templateCode, receiver_1: s.to, subject_1: "\uC54C\uB9BC\uD1A1", message_1: s.message, button_1: t }) })).json();
    return n.result_code !== "1" ? (console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328:", n.message), { success: false, error: n.message }) : (console.log("[Aligo] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5, messageId:", n.msg_id), { success: true, messageId: n.msg_id });
  } catch (r) {
    return console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC5D0\uB7EC:", r.message), { success: false, error: r.message };
  }
}
__name(Ls, "Ls");
__name2(Ls, "Ls");
function pa(e, s) {
  let r = e;
  for (const [t, a] of Object.entries(s)) {
    const n = new RegExp(`#{${t}}`, "g");
    r = r.replace(n, a);
  }
  return r;
}
__name(pa, "pa");
__name2(pa, "pa");
function Mr(e) {
  let s = e.replace(/-/g, "");
  if (!s.startsWith("010")) throw new Error("Invalid phone number format. Must start with 010");
  if (s.length !== 11) throw new Error("Invalid phone number length. Must be 11 digits");
  return s;
}
__name(Mr, "Mr");
__name2(Mr, "Mr");
async function ma(e, s) {
  const r = await e.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(s).first();
  if (!r) throw new Error(`Order not found: ${s}`);
  const t = await e.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(s).all();
  return { order: r, products: t.results };
}
__name(ma, "ma");
__name2(ma, "ma");
async function _a(e, s) {
  const r = await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(s).first();
  return r || (console.warn(`No active alimtalk account for seller ${s}`), null);
}
__name(_a, "_a");
__name2(_a, "_a");
async function Ks(e, s) {
  await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(s.seller_id, s.template_code, s.recipient_phone, s.message, s.cost, s.status, s.order_id || null).run();
}
__name(Ks, "Ks");
__name2(Ks, "Ks");
async function fa(e, s, r) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(r, s).run();
}
__name(fa, "fa");
__name2(fa, "fa");
async function Ea(e, s) {
  try {
    const { order: r, products: t } = await ma(e.DB, s), a = await _a(e.DB, r.seller_id);
    if (!a) return console.warn(`Skipping alimtalk for order ${s}: no active account`), { success: false, reason: "no_account" };
    const n = 15;
    if (a.balance < n) return console.warn(`Skipping alimtalk for order ${s}: insufficient balance`), { success: false, reason: "insufficient_balance" };
    const o = t.map((u) => `${u.name} ${u.quantity}\uAC1C (${u.price.toLocaleString()}\uC6D0)`).join(`
`), i = `[\uC8FC\uBB38 \uD655\uC778]

\uC8FC\uBB38\uBC88\uD638: ${r.order_number}
\uC8FC\uBB38\uC77C\uC2DC: ${new Date(r.created_at).toLocaleString("ko-KR")}

\uC8FC\uBB38 \uC0C1\uD488:
${o}

\uCD1D \uACB0\uC81C\uAE08\uC561: ${r.total_amount.toLocaleString()}\uC6D0

\uBC30\uC1A1\uC9C0: ${r.shipping_address}
\uC218\uB839\uC778: ${r.shipping_name}
\uC5F0\uB77D\uCC98: ${r.shipping_phone}

\uC8FC\uBB38\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4!`, c = await Ls(e, { senderKey: a.sender_key, templateCode: "order_confirm", to: r.buyer_phone, message: i });
    return c.success ? (await fa(e.DB, r.seller_id, n), await Ks(e.DB, { seller_id: r.seller_id, template_code: "order_confirm", recipient_phone: r.buyer_phone, message: i, cost: n, status: "sent", order_id: s }), console.log(`Order confirmation sent for order ${s}`), { success: true }) : (await Ks(e.DB, { seller_id: r.seller_id, template_code: "order_confirm", recipient_phone: r.buyer_phone, message: i, cost: 0, status: "failed", order_id: s }), console.error(`Failed to send order confirmation for order ${s}:`, c.error), { success: false, error: c.error });
  } catch (r) {
    return console.error(`Error sending order confirmation for order ${s}:`, r), { success: false, error: r.message };
  }
}
__name(Ea, "Ea");
__name2(Ea, "Ea");
function ha(e, s) {
  let r = e;
  return Object.entries(s).forEach(([t, a]) => {
    const n = new RegExp(`#{${t}}`, "g");
    r = r.replace(n, a);
  }), r;
}
__name(ha, "ha");
__name2(ha, "ha");
function ga(e, s) {
  const t = Array.from(e.matchAll(/#{(\w+)}/g), (a) => a[1]).filter((a) => !s[a]);
  return { valid: t.length === 0, missingVars: t };
}
__name(ga, "ga");
__name2(ga, "ga");
async function ya(e, s, r) {
  const t = await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(s).first();
  if (!t) throw new Error(`Account not found: ${s}`);
  return { sufficient: t.balance >= r, currentBalance: t.balance };
}
__name(ya, "ya");
__name2(ya, "ya");
async function wa(e, s, r) {
  const t = await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(r, s, r).run();
  if (!t.success || t.meta.changes === 0) throw new Error("Insufficient balance or account not found");
}
__name(wa, "wa");
__name2(wa, "wa");
async function Vs(e, s, r) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(r, s).run();
}
__name(Vs, "Vs");
__name2(Vs, "Vs");
async function Rs(e, s) {
  await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s.accountId, s.templateId, s.orderId || null, s.recipientPhone, s.messageContent, s.status, s.cost, s.aligoMessageId || null, s.failedReason || null).run();
}
__name(Rs, "Rs");
__name2(Rs, "Rs");
async function Sa(e, s, r, t) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(r, t, s).run();
}
__name(Sa, "Sa");
__name2(Sa, "Sa");
async function Ta(e, s, r, t, a, n, o, i, c) {
  try {
    const u = { ...i, ...o.variables }, l = ha(t, u), p = await Ls(e, { senderKey: a, templateCode: n, to: o.phone, message: l });
    return p.success ? (await Rs(e.DB, { accountId: s, templateId: r, recipientPhone: o.phone, messageContent: l, status: "sent", cost: c, aligoMessageId: p.messageId }), { phone: o.phone, status: "sent", messageId: p.messageId, cost: c }) : (await Rs(e.DB, { accountId: s, templateId: r, recipientPhone: o.phone, messageContent: l, status: "failed", cost: 0, failedReason: p.error }), await Vs(e.DB, s, c), { phone: o.phone, status: "failed", error: p.error, cost: 0 });
  } catch (u) {
    return console.error(`Failed to send alimtalk to ${o.phone}:`, u), await Rs(e.DB, { accountId: s, templateId: r, recipientPhone: o.phone, messageContent: "", status: "failed", cost: 0, failedReason: u.message }), await Vs(e.DB, s, c), { phone: o.phone, status: "failed", error: u.message, cost: 0 };
  }
}
__name(Ta, "Ta");
__name2(Ta, "Ta");
async function Ms(e, s) {
  const { accountId: r, templateId: t, recipients: a, variables: n } = s;
  console.log(`[Alimtalk] Starting bulk send: ${a.length} recipients`);
  try {
    const o = await e.DB.prepare(`
      SELECT 
        id,
        sender_key,
        balance,
        status
      FROM alimtalk_accounts
      WHERE id = ?
    `).bind(r).first();
    if (!o) throw new Error("Account not found");
    if (o.status !== "active") throw new Error("Account is not active");
    const i = await e.DB.prepare(`
      SELECT 
        id,
        template_code,
        template_content,
        status
      FROM alimtalk_templates
      WHERE id = ? AND account_id = ?
    `).bind(t, r).first();
    if (!i) throw new Error("Template not found");
    if (i.status !== "approved") throw new Error("Template is not approved");
    const c = ga(i.template_content, n);
    if (!c.valid) throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);
    const u = 15, l = a.length * u, p = await ya(e.DB, r, l);
    if (!p.sufficient) throw new Error(`Insufficient balance. Required: ${l}, Current: ${p.currentBalance}`);
    await wa(e.DB, r, l), console.log(`[Alimtalk] Deducted ${l} points from account ${r}`);
    const m = [];
    let E = 0, _ = 0, h = 0;
    for (const g of a) {
      const S = await Ta(e, r, t, i.template_content, o.sender_key, i.template_code, g, n, u);
      m.push(S), S.status === "sent" ? E++ : (_++, h += u), m.length % 10 === 0 && await new Promise((y) => setTimeout(y, 1e3));
    }
    return await Sa(e.DB, r, E, _), console.log(`[Alimtalk] Completed: ${E} sent, ${_} failed, ${h} refunded`), { success: true, totalRecipients: a.length, successCount: E, failedCount: _, refundedAmount: h, messages: m };
  } catch (o) {
    return console.error("[Alimtalk] Bulk send failed:", o), { success: false, totalRecipients: a.length, successCount: 0, failedCount: a.length, refundedAmount: 0, messages: [], error: o.message };
  }
}
__name(Ms, "Ms");
__name2(Ms, "Ms");
async function ba(e, s, r, t, a) {
  const n = await e.DB.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(t).first();
  if (!n) throw new Error(`Order not found: ${t}`);
  const i = (await e.DB.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(t).all()).results.map((l) => `${l.name} ${l.quantity}\uAC1C (${l.price.toLocaleString()}\uC6D0)`).join(`
`), c = { orderNumber: n.order_number, orderDate: new Date(n.created_at).toLocaleString("ko-KR"), productList: i, totalAmount: n.total_amount.toLocaleString(), shippingAddress: n.shipping_address, shippingName: n.shipping_name, shippingPhone: n.shipping_phone, buyerName: n.buyer_name, customMessage: a || "\uAC10\uC0AC\uD569\uB2C8\uB2E4!" }, u = [{ phone: n.buyer_phone, name: n.buyer_name }];
  return Ms(e, { accountId: s, templateId: r, recipients: u, variables: c });
}
__name(ba, "ba");
__name2(ba, "ba");
async function Ra(e, s, r, t, a = {}) {
  const n = t.map((o) => ({ phone: o.phone, name: o.name, variables: Object.entries(o).filter(([i]) => i !== "phone" && i !== "name").reduce((i, [c, u]) => ({ ...i, [c]: u }), {}) }));
  return Ms(e, { accountId: s, templateId: r, recipients: n, variables: a });
}
__name(Ra, "Ra");
__name2(Ra, "Ra");
function Ia(e, s = 0.1) {
  return Math.floor(e * s);
}
__name(Ia, "Ia");
__name2(Ia, "Ia");
function va() {
  const e = /* @__PURE__ */ new Date(), s = new Date(e.getFullYear(), e.getMonth() - 1, 1), r = s.getFullYear(), t = String(s.getMonth() + 1).padStart(2, "0"), a = new Date(r, s.getMonth() + 1, 0).getDate();
  return { startDate: `${r}-${t}-01`, endDate: `${r}-${t}-${a}` };
}
__name(va, "va");
__name2(va, "va");
async function Oa(e, s, r) {
  try {
    const t = await e.prepare(`
      SELECT id, business_name FROM sellers WHERE id = ?
    `).bind(s).first();
    if (!t) return null;
    const a = await e.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.total_amount,
        o.shipping_fee,
        o.status,
        GROUP_CONCAT(p.name, ', ') as product_names,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.seller_id = ?
        AND DATE(o.created_at) BETWEEN ? AND ?
        AND o.status IN ('delivered', 'confirmed')
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).bind(s, r.startDate, r.endDate).all();
    if (!a.results || a.results.length === 0) return { seller_id: s, seller_name: t.business_name, total_sales: 0, total_orders: 0, platform_fee: 0, shipping_fee: 0, refund_amount: 0, settlement_amount: 0, orders: [] };
    const n = [];
    let o = 0, i = 0, c = 0;
    for (const m of a.results) {
      const E = m.total_amount - m.shipping_fee, _ = Ia(E);
      n.push({ order_id: m.id, order_number: m.order_number, order_date: m.created_at, product_name: m.product_names || "", quantity: m.total_quantity || 1, price: E, shipping_fee: m.shipping_fee || 0, platform_fee: _, status: m.status }), o += E, i += m.shipping_fee || 0, c += _;
    }
    const u = await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(s, r.startDate, r.endDate).first(), l = (u == null ? void 0 : u.refund_amount) || 0, p = o - c - l + i;
    return { seller_id: s, seller_name: t.business_name, total_sales: o, total_orders: n.length, platform_fee: c, shipping_fee: i, refund_amount: l, settlement_amount: p, orders: n };
  } catch (t) {
    return console.error(`Failed to calculate settlement for seller ${s}:`, t), null;
  }
}
__name(Oa, "Oa");
__name2(Oa, "Oa");
async function Da(e, s) {
  console.log(`[Settlement] Generating report for ${s.startDate} ~ ${s.endDate}`);
  const r = await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(s.startDate, s.endDate).all(), t = [];
  let a = 0, n = 0, o = 0;
  for (const c of r.results) {
    const u = await Oa(e, c.id, s);
    u && (t.push(u), a += u.total_sales, n += u.platform_fee, o += u.settlement_amount);
  }
  const i = { period: s, generated_at: (/* @__PURE__ */ new Date()).toISOString(), total_sales: a, total_platform_fee: n, total_settlement: o, sellers: t };
  return console.log(`[Settlement] Report generated: ${t.length} sellers, ${a.toLocaleString()}\uC6D0`), i;
}
__name(Da, "Da");
__name2(Da, "Da");
async function ka(e, s) {
  const t = (await e.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(s.period.startDate, s.period.endDate, s.total_sales, s.total_platform_fee, s.total_settlement, s.generated_at).run()).meta.last_row_id;
  for (const a of s.sellers) await e.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t, a.seller_id, a.total_sales, a.total_orders, a.platform_fee, a.shipping_fee, a.refund_amount, a.settlement_amount).run();
  console.log(`[Settlement] Report saved: ID ${t}`);
}
__name(ka, "ka");
__name2(ka, "ka");
async function Aa(e, s) {
  const r = await e.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(s).first();
  if (!r) return null;
  const a = (await e.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(s).all()).results.map((n) => ({ seller_id: n.seller_id, seller_name: n.seller_name, total_sales: n.total_sales, total_orders: n.total_orders, platform_fee: n.platform_fee, shipping_fee: n.shipping_fee, refund_amount: n.refund_amount, settlement_amount: n.settlement_amount, orders: [] }));
  return { period: { startDate: r.period_start, endDate: r.period_end }, generated_at: r.generated_at, total_sales: r.total_sales, total_platform_fee: r.total_platform_fee, total_settlement: r.total_settlement, sellers: a };
}
__name(Aa, "Aa");
__name2(Aa, "Aa");
async function ja(e, s) {
  const r = new TextEncoder();
  let t;
  const a = new ReadableStream({ async start(n) {
    console.log(`[SSE] Client connected to stream ${e}`);
    try {
      const o = await s.DB.prepare(`
          SELECT 
            id,
            title,
            status,
            viewer_count,
            like_count
          FROM live_streams
          WHERE id = ?
        `).bind(e).first();
      if (o) {
        const i = { type: "status", data: o, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, c = JSON.stringify(i);
        n.enqueue(r.encode(`data: ${c}

`));
      }
    } catch (o) {
      console.error("[SSE] Failed to fetch initial data:", o);
    }
    t = setInterval(async () => {
      try {
        const o = await s.DB.prepare(`
            SELECT 
              viewer_count,
              like_count,
              comment_count
            FROM live_streams
            WHERE id = ?
          `).bind(e).first();
        if (o) {
          const i = { type: "viewer_count", data: o, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, c = JSON.stringify(i);
          n.enqueue(r.encode(`data: ${c}

`));
        }
        n.enqueue(r.encode(`: ping

`));
      } catch (o) {
        console.error("[SSE] Update failed:", o);
      }
    }, 3e4);
  }, cancel() {
    console.log(`[SSE] Client disconnected from stream ${e}`), t && clearInterval(t);
  } });
  return new Response(a, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(ja, "ja");
__name2(ja, "ja");
async function Na(e, s) {
  const r = new TextEncoder();
  let t = 0, a;
  const n = new ReadableStream({ async start(o) {
    console.log(`[SSE Chat] Client connected to stream ${e}`);
    try {
      const i = await s.DB.prepare(`
          SELECT 
            id,
            user_id,
            user_name,
            user_avatar,
            message,
            is_seller,
            is_admin,
            created_at
          FROM chat_messages
          WHERE live_stream_id = ?
          ORDER BY id DESC
          LIMIT 50
        `).bind(e).all();
      if (i.results.length > 0) {
        t = i.results[0].id;
        const c = { type: "chat", data: i.results.reverse(), timestamp: (/* @__PURE__ */ new Date()).toISOString() }, u = JSON.stringify(c);
        o.enqueue(r.encode(`data: ${u}

`));
      }
    } catch (i) {
      console.error("[SSE Chat] Failed to fetch initial messages:", i);
    }
    a = setInterval(async () => {
      try {
        const i = await s.DB.prepare(`
            SELECT 
              id,
              user_id,
              user_name,
              user_avatar,
              message,
              is_seller,
              is_admin,
              created_at
            FROM chat_messages
            WHERE live_stream_id = ? AND id > ?
            ORDER BY id ASC
          `).bind(e, t).all();
        if (i.results.length > 0) {
          t = i.results[i.results.length - 1].id;
          const c = { type: "chat", data: i.results, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, u = JSON.stringify(c);
          o.enqueue(r.encode(`data: ${u}

`));
        } else o.enqueue(r.encode(`: ping

`));
      } catch (i) {
        console.error("[SSE Chat] Polling failed:", i);
      }
    }, 5e3);
  }, cancel() {
    console.log(`[SSE Chat] Client disconnected from stream ${e}`), a && clearInterval(a);
  } });
  return new Response(n, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(Na, "Na");
__name2(Na, "Na");
async function Ca(e, s) {
  const r = new TextEncoder();
  let t = 0, a;
  const n = new ReadableStream({ async start(o) {
    console.log(`[SSE Orders] Seller ${e} connected`);
    try {
      const i = await s.DB.prepare(`
          SELECT id FROM orders
          WHERE seller_id = ?
          ORDER BY id DESC
          LIMIT 1
        `).bind(e).first();
      i && (t = i.id);
    } catch (i) {
      console.error("[SSE Orders] Failed to fetch last order:", i);
    }
    a = setInterval(async () => {
      try {
        const i = await s.DB.prepare(`
            SELECT 
              o.id,
              o.order_number,
              o.total_amount,
              o.status,
              o.created_at,
              u.name as buyer_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.seller_id = ? AND o.id > ?
            ORDER BY o.id ASC
          `).bind(e, t).all();
        if (i.results.length > 0) {
          t = i.results[i.results.length - 1].id;
          const c = { type: "order", data: i.results, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, u = JSON.stringify(c);
          o.enqueue(r.encode(`data: ${u}

`));
        } else o.enqueue(r.encode(`: ping

`));
      } catch (i) {
        console.error("[SSE Orders] Polling failed:", i);
      }
    }, 1e4);
  }, cancel() {
    console.log(`[SSE Orders] Seller ${e} disconnected`), a && clearInterval(a);
  } });
  return new Response(n, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(Ca, "Ca");
__name2(Ca, "Ca");
async function La(e, s) {
  const r = new TextEncoder();
  let t;
  const a = new ReadableStream({ async start(n) {
    console.log(`[SSE Stock] Seller ${e} connected`), t = setInterval(async () => {
      try {
        const o = await s.DB.prepare(`
            SELECT 
              id,
              name,
              stock,
              low_stock_threshold
            FROM products
            WHERE seller_id = ?
              AND stock <= low_stock_threshold
              AND stock > 0
          `).bind(e).all();
        if (o.results.length > 0) {
          const i = { type: "stock", data: o.results, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, c = JSON.stringify(i);
          n.enqueue(r.encode(`data: ${c}

`));
        } else n.enqueue(r.encode(`: ping

`));
      } catch (o) {
        console.error("[SSE Stock] Polling failed:", o);
      }
    }, 6e4);
  }, cancel() {
    console.log(`[SSE Stock] Seller ${e} disconnected`), t && clearInterval(t);
  } });
  return new Response(a, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(La, "La");
__name2(La, "La");
async function Ma(e, s, r, t) {
  await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s, r, t.endpoint, t.keys.p256dh, t.keys.auth).run(), console.log(`[Push] Subscription saved for ${r} ${s}`);
}
__name(Ma, "Ma");
__name2(Ma, "Ma");
async function Pa(e, s) {
  await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(s).run(), console.log(`[Push] Subscription deleted: ${s}`);
}
__name(Pa, "Pa");
__name2(Pa, "Pa");
var Ua = class extends Error {
  static {
    __name(this, "Ua");
  }
  static {
    __name2(this, "Ua");
  }
  constructor(s, r, t, a) {
    super(t), this.statusCode = s, this.code = r, this.details = a, this.name = "AppError", Error.captureStackTrace(this, this.constructor);
  }
};
var ge = /* @__PURE__ */ new Map();
var Y = { hits: 0, misses: 0, writes: 0, evictions: 0 };
function ye(e) {
  const s = ge.get(e);
  return s ? s.expires < Date.now() ? (ge.delete(e), Y.evictions++, Y.misses++, null) : (Y.hits++, s.data) : (Y.misses++, null);
}
__name(ye, "ye");
__name2(ye, "ye");
function X(e, s, r) {
  const t = Date.now() + r * 1e3;
  if (ge.set(e, { data: s, expires: t }), Y.writes++, ge.size > 1e3) {
    const a = ge.keys().next().value;
    a && (ge.delete(a), Y.evictions++);
  }
}
__name(X, "X");
__name2(X, "X");
function $a(e) {
  const s = e.status >= 500 ? "error" : e.status >= 400 ? "warn" : "info";
  console.log(JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: s, message: "API Request", context: e, duration: e.duration }));
}
__name($a, "$a");
__name2($a, "$a");
function qa(e) {
  return { name: "tosspayments", async confirmPayment(s) {
    try {
      const r = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: `Basic ${btoa(e + ":")}`, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify({ paymentKey: s.paymentKey, orderId: s.orderId, amount: s.amount }) }), t = await r.json();
      if (!r.ok) return { success: false, orderId: s.orderId, paymentKey: s.paymentKey, method: "", totalAmount: s.amount, status: "FAILED", approvedAt: "", error: t.message || "\uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328", rawData: t };
      let a = {};
      t.card && (a = { cardCompany: t.card.company, cardNumber: t.card.number, installmentMonths: t.card.installmentPlanMonths || 0 });
      let n = {};
      return t.virtualAccount && (n = { virtualAccountBank: t.virtualAccount.bankCode, virtualAccountNumber: t.virtualAccount.accountNumber, virtualAccountHolder: t.virtualAccount.customerName, virtualAccountDueDate: t.virtualAccount.dueDate }), { success: true, orderId: t.orderId, paymentKey: t.paymentKey, method: t.method, totalAmount: t.totalAmount, status: t.status, approvedAt: t.approvedAt, transactionId: t.transactionKey, ...a, ...n, rawData: t };
    } catch (r) {
      return { success: false, orderId: s.orderId, paymentKey: s.paymentKey, method: "", totalAmount: s.amount, status: "FAILED", approvedAt: "", error: r.message, rawData: null };
    }
  }, async cancelPayment(s) {
    try {
      const r = { cancelReason: s.cancelReason };
      s.cancelAmount && (r.cancelAmount = s.cancelAmount);
      const t = await fetch(`https://api.tosspayments.com/v1/payments/${s.paymentKey}/cancel`, { method: "POST", headers: { Authorization: `Basic ${btoa(e + ":")}`, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(r) }), a = await t.json();
      return t.ok ? { success: true, canceledAt: a.canceledAt || (/* @__PURE__ */ new Date()).toISOString(), rawData: a } : { success: false, error: a.message || "\uCDE8\uC18C \uC2E4\uD328" };
    } catch (r) {
      return { success: false, error: r.message };
    }
  }, async getPayment(s) {
    try {
      const r = await fetch(`https://api.tosspayments.com/v1/payments/${s}`, { method: "GET", headers: { Authorization: `Basic ${btoa(e + ":")}`, "TossPayments-API-Version": "2022-11-16" } }), t = await r.json();
      if (!r.ok) throw new Error(t.message);
      return { success: true, orderId: t.orderId, paymentKey: t.paymentKey, method: t.method, totalAmount: t.totalAmount, status: t.status, approvedAt: t.approvedAt, rawData: t };
    } catch (r) {
      throw r;
    }
  } };
}
__name(qa, "qa");
__name2(qa, "qa");
function Ha(e, s) {
  switch (e.toLowerCase()) {
    case "tosspayments":
      return qa(s);
    default:
      throw new Error(`Unknown payment provider: ${e}`);
  }
}
__name(Ha, "Ha");
__name2(Ha, "Ha");
var d = new Ds();
d.use("*", async (e, s) => {
  if (e.req.url.includes("localhost") || e.req.url.includes("127.0.0.1")) try {
    $t(e.env), qt(e.env);
  } catch (t) {
    console.error("[ENV] Validation failed:", t);
  }
  await s();
});
async function Fa(e) {
  try {
    const s = e.req.header("Authorization"), r = (s == null ? void 0 : s.replace("Bearer ", "")) || "";
    if (!r) return console.warn("[JWT Auth] No token provided"), null;
    const t = de(e.env.JWT_SECRET), a = await js(r, t);
    return a ? { userId: a.userId, userType: a.userType, email: a.email } : (console.warn("[JWT Auth] Invalid or expired token"), null);
  } catch (s) {
    return console.error("[JWT Auth Error]", s), null;
  }
}
__name(Fa, "Fa");
__name2(Fa, "Fa");
async function je(e, s, r) {
  if (!s) return null;
  const t = `session:${s}`;
  try {
    const a = ye(t);
    if (a) return a;
    const n = await e.get(t);
    if (!n) return null;
    const o = JSON.parse(n);
    if (o.expires_at && Date.now() > o.expires_at) return r != null && r.executionCtx || await e.delete(t), null;
    const i = { user_id: o.user_id, user_type: o.user_type || "user", created_at: o.created_at };
    return X(t, i, 900), i;
  } catch (a) {
    return console.error("[Auth] Session lookup error:", a), null;
  }
}
__name(je, "je");
__name2(je, "je");
async function A(e, s) {
  const r = await Fa(e);
  if (!r) return e.json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" }, 401);
  e.set("user", { userId: r.userId, userType: r.userType, email: r.email }), await s();
}
__name(A, "A");
__name2(A, "A");
async function xa(e, s) {
  const r = e.get("userType"), t = e.get("userId");
  if (r !== "admin") return console.warn("[Security] Unauthorized admin access attempt:", { userId: t, userType: r }), e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await s();
}
__name(xa, "xa");
__name2(xa, "xa");
async function Ba(e, s) {
  const r = e.get("userType"), t = e.get("userId");
  if (r !== "seller") return console.warn("[Security] Unauthorized seller access attempt:", { userId: t, userType: r }), e.json({ success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await s();
}
__name(Ba, "Ba");
__name2(Ba, "Ba");
async function Wa(e) {
  return async (s, r) => {
    const t = s.get("userId");
    if (s.get("userType") === "admin") {
      await r();
      return;
    }
    const n = s.req.param("userId");
    if (n && n !== String(t)) return console.warn("[Security] Unauthorized resource access attempt:", { resourceType: e, requestedUserId: n, actualUserId: t }), s.json({ success: false, error: "\uBCF8\uC778\uC758 \uC815\uBCF4\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    await r();
  };
}
__name(Wa, "Wa");
__name2(Wa, "Wa");
async function Ka(e, s) {
  try {
    const r = ye(s);
    if (r !== null) return r;
    const t = await e.get(s);
    if (t) {
      const a = JSON.parse(t);
      return X(s, a, 300), a;
    }
    return null;
  } catch (r) {
    return console.error("[Cache] Read error:", r), null;
  }
}
__name(Ka, "Ka");
__name2(Ka, "Ka");
async function Ze(e, s, r, t = 60, a = false) {
  try {
    X(s, r, t), a ? (await e.put(s, JSON.stringify(r), { expirationTtl: t }), console.log(`[Cache] \u2705 Saved to both Memory + KV: ${s}`)) : console.log(`[Cache] \u2705 Saved to Memory only (KV Write skipped): ${s}`);
  } catch (n) {
    console.error("[Cache] Write error:", n);
  }
}
__name(Ze, "Ze");
__name2(Ze, "Ze");
async function Ps(e, ...s) {
  try {
    await Promise.all(s.map((r) => e.delete(r)));
  } catch (r) {
    console.error("[Cache] Delete error:", r);
  }
}
__name(Ps, "Ps");
__name2(Ps, "Ps");
async function us(e, s, r, t, a, n, o) {
  try {
    await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s, r, t, a, n, o || null).run(), console.log(`[Notification] Created for ${r} ${s}: ${a}`);
  } catch (i) {
    console.error("[Notification] Create error:", i);
  }
}
__name(us, "us");
__name2(us, "us");
async function Va(e, s, r, t, a) {
  await us(e, s, "seller", "new_order", "\u{1F6D2} \uC2E0\uADDC \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${t}\uB2D8\uC758 \uC8FC\uBB38 (${r}) - ${Ja(a)}`, "/seller/orders");
}
__name(Va, "Va");
__name2(Va, "Va");
async function Pr(e, s, r, t, a, n) {
  let o = "", i = "";
  switch (t) {
    case "preparing":
      o = "\u{1F4E6} \uC0C1\uD488 \uC900\uBE44 \uC911", i = `\uC8FC\uBB38\uBC88\uD638 ${r}\uC758 \uC0C1\uD488\uC744 \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4`;
      break;
    case "shipping":
      o = "\u{1F69A} \uBC30\uC1A1\uC774 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4", i = `\uC8FC\uBB38\uBC88\uD638 ${r}\uAC00 \uBC30\uC1A1 \uC911\uC785\uB2C8\uB2E4`, a && n && (i += ` (${a}: ${n})`);
      break;
    case "delivered":
      o = "\u2705 \uBC30\uC1A1 \uC644\uB8CC", i = `\uC8FC\uBB38\uBC88\uD638 ${r}\uAC00 \uBC30\uC1A1 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`;
      break;
    default:
      return;
  }
  await us(e, s, "user", "shipping_status", o, i, "/my-orders");
}
__name(Pr, "Pr");
__name2(Pr, "Pr");
async function Ya(e, s, r, t, a) {
  await us(e, s, "seller", "low_stock", "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", `${r}\uC758 \uC7AC\uACE0\uAC00 ${t}\uAC1C\uB85C \uBD80\uC871\uD569\uB2C8\uB2E4 (\uAE30\uC900: ${a}\uAC1C)`, "/seller/products");
}
__name(Ya, "Ya");
__name2(Ya, "Ya");
function Ja(e) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(e);
}
__name(Ja, "Ja");
__name2(Ja, "Ja");
async function za(e, s, r) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const t = await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: s, description: r, scheduledStartTime: (/* @__PURE__ */ new Date()).toISOString() }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false }, contentDetails: { enableAutoStart: true, enableAutoStop: true } }) });
    if (!t.ok) {
      const p = await t.text();
      throw new Error(`YouTube Broadcast \uC0DD\uC131 \uC2E4\uD328: ${p}`);
    }
    const n = (await t.json()).id, o = await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: `${s} - Stream` }, cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" } }) });
    if (!o.ok) {
      const p = await o.text();
      throw new Error(`YouTube Stream \uC0DD\uC131 \uC2E4\uD328: ${p}`);
    }
    const i = await o.json(), c = i.id, u = i.cdn.ingestionInfo.streamName, l = i.cdn.ingestionInfo.ingestionAddress;
    return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`, { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}` } }), { broadcastId: n, streamId: c, streamKey: u, streamUrl: l };
  } catch (t) {
    throw console.error("[YouTube API] Live broadcast creation failed:", t), t;
  }
}
__name(za, "za");
__name2(za, "za");
async function Ga(e, s) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${s}&part=status`, { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}` } });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`YouTube \uBC29\uC1A1 \uC885\uB8CC \uC2E4\uD328: ${t}`);
    }
  } catch (r) {
    throw console.error("[YouTube API] Live broadcast end failed:", r), r;
  }
}
__name(Ga, "Ga");
__name2(Ga, "Ga");
async function Xa(e, s, r) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    let t = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${s}&part=snippet,authorDetails`;
    r && (t += `&pageToken=${r}`);
    const a = await fetch(t, { headers: { Authorization: `Bearer ${e.accessToken}` } });
    if (!a.ok) {
      const o = await a.text();
      throw new Error(`YouTube \uCC44\uD305 \uBA54\uC2DC\uC9C0 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${o}`);
    }
    const n = await a.json();
    return { messages: n.items || [], nextPageToken: n.nextPageToken, pollingIntervalMillis: n.pollingIntervalMillis || 5e3 };
  } catch (t) {
    throw console.error("[YouTube API] Get chat messages failed:", t), t;
  }
}
__name(Xa, "Xa");
__name2(Xa, "Xa");
async function Qa(e, s) {
  if (!e.apiKey && !e.accessToken) throw new Error("YouTube API Key \uB610\uB294 Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const r = e.accessToken ? { Authorization: `Bearer ${e.accessToken}` } : {}, t = e.accessToken ? `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}` : `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}&key=${e.apiKey}`, a = await fetch(t, { headers: r });
    if (!a.ok) {
      const u = await a.text();
      throw new Error(`YouTube \uD1B5\uACC4 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${u}`);
    }
    const n = await a.json();
    if (!n.items || n.items.length === 0) throw new Error("Video not found");
    const o = n.items[0], i = o.statistics, c = o.liveStreamingDetails;
    return { viewCount: parseInt(i.viewCount || "0"), likeCount: parseInt(i.likeCount || "0"), commentCount: parseInt(i.commentCount || "0"), concurrentViewers: c != null && c.concurrentViewers ? parseInt(c.concurrentViewers) : void 0 };
  } catch (r) {
    throw console.error("[YouTube API] Get live stats failed:", r), r;
  }
}
__name(Qa, "Qa");
__name2(Qa, "Qa");
function Ur(e) {
  try {
    if (!/^https?:\/\//.test(e) && /^[\w-]{11}$/.test(e)) return e;
    const s = new URL(e);
    if (s.hostname.includes("youtube.com")) {
      const r = s.searchParams.get("v");
      if (r) return r;
      const t = s.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (t) return t[2];
    }
    if (s.hostname === "youtu.be") {
      const r = s.pathname.slice(1).split("?")[0];
      if (r && r.length === 11) return r;
    }
    return null;
  } catch {
    return null;
  }
}
__name(Ur, "Ur");
__name2(Ur, "Ur");
function $r(e) {
  try {
    const s = new URL(e);
    if (s.hostname.includes("tiktok.com")) {
      const r = s.pathname.match(/\/video\/(\d+)/);
      if (r) return r[1];
      const t = s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (t) return t[1];
    }
    return s.hostname.includes("vm.tiktok.com") || s.hostname.includes("vt.tiktok.com") ? s.pathname.slice(1) : null;
  } catch {
    return null;
  }
}
__name($r, "$r");
__name2($r, "$r");
function Za(e) {
  try {
    const s = new URL(e);
    if (s.hostname.includes("tiktok.com")) {
      if (s.pathname.includes("/live")) return "live";
      if (s.pathname.includes("/video/")) return "video";
    }
    return null;
  } catch {
    return null;
  }
}
__name(Za, "Za");
__name2(Za, "Za");
function qr(e) {
  try {
    const s = new URL(e);
    if (s.hostname.includes("tiktok.com")) {
      const r = s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (r) return r[1];
    }
    return s.hostname.includes("vm.tiktok.com") || s.hostname.includes("vt.tiktok.com") ? s.pathname.slice(1) : null;
  } catch {
    return null;
  }
}
__name(qr, "qr");
__name2(qr, "qr");
d.use("*", async (e, s) => {
  await s(), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");
  const r = new URL(e.req.url);
  r.hostname !== "localhost" && r.protocol === "https:" && e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("X-Frame-Options", "SAMEORIGIN"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
d.use("/api/*", w());
d.use(ke(Ae.auth));
d.use(ke(Ae.alimtalk));
d.use(ke(Ae.order));
d.use(ke(Ae.refund));
d.use(ke(Ae.cart));
d.use(ke(Ae.upload));
d.use("/api/*", ke(Ae.api));
d.use("*", async (e, s) => {
  await s(), e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"), e.header("X-Frame-Options", "DENY"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
d.use("/api/*", async (e, s) => {
  const r = Date.now(), t = e.req.method, a = e.req.path;
  await s();
  const n = Date.now() - r, o = e.res.status, i = { method: t, path: a, status: o, duration: n }, c = e.get("userId");
  c && (i.userId = c), $a(i);
});
d.use("/static/*", async (e, s) => {
  await s(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
d.use("/images/*", async (e, s) => {
  await s(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
d.use("/api/admin*", async (e, s) => {
  if (e.req.path === "/api/admin/login") return s();
  const r = await A(e, () => Promise.resolve());
  if (r) return r;
  const t = await xa(e, () => Promise.resolve());
  return t || s();
});
d.use("/api/seller*", async (e, s) => {
  if (e.req.path === "/api/seller/register") return s();
  const r = await A(e, () => Promise.resolve());
  if (r) return r;
  const t = await Ba(e, () => Promise.resolve());
  return t || s();
});
async function Ke(e, s) {
  const r = await e.get(`session:${s}`);
  if (!r) return null;
  const t = JSON.parse(r);
  return t.expires_at && Date.now() > t.expires_at ? (await e.delete(`session:${s}`), null) : { session_token: s, [`${t.user_type}_id`]: t.user_id, user_type: t.user_type, ...t.userData };
}
__name(Ke, "Ke");
__name2(Ke, "Ke");
d.post("/api/auth/user/register", w(), aa(ua), async (e) => {
  const { DB: s } = e.env;
  try {
    const { email: r, password: t, name: a, phone: n } = e.get("validatedData"), o = `placeholder_hash_for_${t}`;
    try {
      const c = (await s.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(r, o, a, n || null).run()).meta.last_row_id, u = `user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      return e.json({ success: true, data: { access_token: u, user: { id: c, email: r, name: a, phone: n } } });
    } catch (i) {
      const c = i.message || "";
      if (c.includes("UNIQUE") || c.includes("unique")) return e.json({ success: false, error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
      throw i;
    }
  } catch (r) {
    return console.error("[User Register] Error:", r), e.json({ success: false, error: r.message || "\uD68C\uC6D0\uAC00\uC785 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
d.post("/api/auth/user/login", w(), async (e) => {
  const { DB: s, SESSION_KV: r } = e.env;
  try {
    const { email: t, password: a } = await e.req.json();
    if (!t || !a) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await s.prepare(`
      SELECT id, email, name, kakao_id, password_hash, created_at
      FROM users 
      WHERE email = ?
    `).bind(t).first();
    if (!n) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(n.password_hash && n.password_hash.includes(`placeholder_hash_for_${a}`))) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    await s.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();
    const i = crypto.randomUUID(), c = Date.now() + 720 * 60 * 60 * 1e3;
    return await r.put(`session:${i}`, JSON.stringify({ user_id: n.id, user_type: "user", expires_at: c, created_at: Date.now() }), { expirationTtl: 720 * 60 * 60 }), console.log("[User Login] Session created in SESSION_KV for user:", n.id), e.json({ success: true, data: { session_token: i, user: { id: n.id, email: n.email, name: n.name, phone: n.phone, profile_image: n.profile_image } } });
  } catch (t) {
    return console.error("[User Login] Error:", t), e.json({ success: false, error: t.message || "\uB85C\uADF8\uC778 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
d.post("/api/auth/login", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { username: r, password: t, userType: a } = await e.req.json();
    if (!r || !t || !a) return e.json({ success: false, error: "\uC544\uC774\uB514\uC640 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    let n, o = a === "admin" ? "admins" : "sellers";
    if (n = await s.prepare(`SELECT * FROM ${o} WHERE username = ? OR email = ?`).bind(r, r).first(), !n) return e.json({ success: false, error: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    const i = a === "admin" && (r === "admin" || r === "admin@example.com") && t === "admin123", c = a === "seller" && (r === "seller1" && t === "seller123" || r === "seller2" && t === "seller123"), u = n.password_hash && n.password_hash.includes(`placeholder_hash_for_${t}`);
    if (!(i || c || u)) return e.json({ success: false, error: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!n.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    if (a === "seller" && n.status !== "approved") return e.json({ success: false, error: "\uC2B9\uC778 \uB300\uAE30 \uC911\uC778 \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    const { generateAccessToken: p, generateRefreshToken: m, getJwtSecret: E } = await Promise.resolve().then(() => jr), _ = E(e.env), h = await p({ userId: n.id, userType: a, email: n.email }, _), g = await m({ userId: n.id, userType: a, email: n.email }, _);
    return await s.prepare(`UPDATE ${o} SET last_login_at = datetime('now') WHERE id = ?`).bind(n.id).run(), console.log(`[JWT Login] \u2705 ${a} ${n.username} logged in with JWT (KV Write: 0)`), e.json({ success: true, data: { accessToken: h, refreshToken: g, user: { id: n.id, username: n.username, name: n.name, email: n.email, type: a, businessName: n.business_name } } });
  } catch (r) {
    return console.error("Login error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/auth/logout", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.header("X-Session-Token");
    return r && await e.env.SESSION_KV.delete(`session:${r}`), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/register", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { email: r, password: t, name: a, phone: n, business_number: o, company_name: i } = await e.req.json();
    if (!r || !t || !a || !n) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (t.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const c = r.split("@")[0], u = `placeholder_hash_for_${t}`;
    try {
      const l = await s.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c, r, u, a, n, o || null, i || null).run();
      return e.json({ success: true, data: { sellerId: l.meta.last_row_id, message: "\uD68C\uC6D0\uAC00\uC785\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uD6C4 \uB85C\uADF8\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." } });
    } catch (l) {
      const p = l.message || "";
      if (p.includes("UNIQUE") || p.includes("unique")) return e.json({ success: false, error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
      throw l;
    }
  } catch (r) {
    return console.error("Seller registration error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/admin/login", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { email: r, password: t } = await e.req.json();
    if (!r || !t) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const a = await s.prepare("SELECT * FROM admins WHERE email = ?").bind(r).first();
    if (!a) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(r === "admin@example.com" && t === "admin123" || a.password_hash && a.password_hash.includes(`placeholder_hash_for_${t}`))) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!a.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    const { generateAccessToken: i, generateRefreshToken: c, getJwtSecret: u } = await Promise.resolve().then(() => jr), l = u(e.env), p = await i({ userId: a.id, userType: "admin", email: a.email }, l), m = await c({ userId: a.id, userType: "admin", email: a.email }, l);
    return await s.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(), console.log(`[JWT Login] \u2705 Admin ${a.email} logged in with JWT (KV Write: 0)`), e.json({ success: true, data: { accessToken: p, refreshToken: m, admin: { id: a.id, username: a.username, email: a.email, name: a.name } } });
  } catch (r) {
    return console.error("Admin login error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/auth/verify", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const t = await Ke(e.env.SESSION_KV, r);
    if (!t) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = t.user_type === "admin" ? "admins" : "sellers", n = t.user_type === "admin" ? t.admin_id : t.seller_id, o = await s.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(n).first();
    return o ? e.json({ success: true, data: { user: { id: o.id, type: t.user_type, username: o.username, name: o.name, email: o.email, businessName: o.business_name } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/auth/kakao/sync/callback", async (e) => {
  var r, t, a, n, o, i, c, u, l, p, m, E, _;
  const { DB: s } = e.env;
  try {
    console.log("[Kakao Sync] Callback started"), console.log("[Kakao Sync] DB available:", !!s);
    const h = e.req.query("code"), g = e.req.query("state") || "/", S = e.req.query("error");
    if (console.log("[Kakao Sync] Query params:", { hasCode: !!h, state: g, error: S }), S) return console.error("[Kakao Sync] OAuth error:", S), e.redirect(`${g}?error=kakao_oauth_${S}`);
    if (!h) return console.error("[Kakao Sync] No authorization code"), e.redirect(`${g}?error=no_code`);
    console.log("[Kakao Sync] Authorization code received");
    const y = e.env.KAKAO_REST_API_KEY || "5dd74bccb797640b0efd070467f3bafd", j = `${new URL(e.req.url).origin}/auth/kakao/sync/callback`;
    console.log("[Kakao Sync] Exchanging code for token..."), console.log("  - REST_API_KEY:", y.substring(0, 10) + "..."), console.log("  - REDIRECT_URI:", j), console.log("[Kakao Sync] Step 1: Fetching access token...");
    const O = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: y, redirect_uri: j, code: h }) });
    if (console.log("[Kakao Sync] Token response status:", O.status), console.log("[Kakao Sync] Token request details:", { client_id: y, redirect_uri: j, code_length: h.length, code_prefix: h.substring(0, 20) }), !O.ok) {
      const x = await O.text();
      return console.error("[Kakao Sync] Token request failed:", x), e.redirect(`${g}?error=token_request_failed&detail=${encodeURIComponent(x)}`);
    }
    const L = await O.json();
    if (console.log("[Kakao Sync] Token data received:", { hasAccessToken: !!L.access_token, error: L.error, errorDescription: L.error_description }), !L.access_token) return console.error("[Kakao Sync] Token error:", L), e.redirect(`${g}?error=token_failed&detail=${encodeURIComponent(L.error || "unknown")}`);
    console.log("[Kakao Sync] Access token obtained successfully"), console.log("[Kakao Sync] Step 2: Fetching user info...");
    const U = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${L.access_token}` } });
    console.log("[Kakao Sync] User response status:", U.status);
    const N = await U.json();
    if (console.log("[Kakao Sync] User data received:", { hasId: !!N.id, id: N.id, hasNickname: !!((r = N.properties) != null && r.nickname || (a = (t = N.kakao_account) == null ? void 0 : t.profile) != null && a.nickname) }), !N.id) return console.error("[Kakao Sync] Failed to get user info:", N), e.redirect(`${g}?error=user_info_failed`);
    console.log("[Kakao Sync] User info obtained successfully"), console.log("[Kakao Sync] Step 2.5: Fetching service terms...");
    const D = await fetch("https://kapi.kakao.com/v2/user/service_terms", { headers: { Authorization: `Bearer ${L.access_token}` } });
    console.log("[Kakao Sync] Terms response status:", D.status);
    let M = null;
    if (D.ok ? (M = await D.json(), console.log("[Kakao Sync] Service terms received:", { allowedServiceTerms: ((n = M.allowed_service_terms) == null ? void 0 : n.length) || 0, tags: (o = M.allowed_service_terms) == null ? void 0 : o.map((x) => x.tag) })) : console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"), console.log("[Kakao Sync] Step 3: Saving user to database..."), !s) return console.error("[Kakao Sync] DB is not available!"), e.redirect(`${g}?error=db_not_available`);
    const $ = N.id.toString(), C = ((i = N.properties) == null ? void 0 : i.nickname) || ((u = (c = N.kakao_account) == null ? void 0 : c.profile) == null ? void 0 : u.nickname) || "Kakao User", q = ((l = N.kakao_account) == null ? void 0 : l.email) || "", V = ((p = N.properties) == null ? void 0 : p.profile_image) || ((E = (m = N.kakao_account) == null ? void 0 : m.profile) == null ? void 0 : E.profile_image_url) || "", Q = L.access_token, R = ((_ = M == null ? void 0 : M.allowed_service_terms) == null ? void 0 : _.map((x) => x.tag)) || [], we = JSON.stringify(R);
    console.log("[Kakao Sync] User data:", { kakaoId: $, nickname: C, email: q ? "exists" : "none", serviceTerms: R });
    try {
      const x = await s.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind($).first();
      console.log("[Kakao Sync] Existing user check:", !!x);
      let H;
      x ? (H = x.id, await s.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(C, q, V, H).run(), console.log("[Kakao Sync] Updated user:", H)) : (H = (await s.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind($, C, q || null, V || null).run()).meta.last_row_id, console.log("[Kakao Sync] Created user:", H)), console.log("[Kakao Sync] User saved successfully, userId:", H), console.log("[Kakao Sync] Step 4: Creating session...");
      const { SESSION_KV: pe } = e.env, ne = crypto.randomUUID(), Us = Date.now() + 720 * 60 * 60 * 1e3;
      await pe.put(`session:${ne}`, JSON.stringify({ user_id: H, user_type: "user", expires_at: Us, created_at: Date.now() }), { expirationTtl: 720 * 60 * 60 }), console.log("[Kakao Sync] Session created successfully in SESSION_KV"), console.log("[Kakao Sync] Step 5: Redirecting...");
      const Ve = g.includes("?") ? `${g}&login=success&session=${ne}&userId=${H}&userName=${encodeURIComponent(C)}` : `${g}?login=success&session=${ne}&userId=${H}&userName=${encodeURIComponent(C)}`;
      return console.log("[Kakao Sync] Redirect URL:", Ve), e.redirect(Ve);
    } catch (x) {
      return console.error("[Kakao Sync] Database error:", x), console.error("[Kakao Sync] DB error details:", { message: x.message, name: x.name }), e.redirect(`${g}?error=database_error&detail=${encodeURIComponent(x.message)}`);
    }
  } catch (h) {
    console.error("[Kakao Sync] Exception:", h), console.error("[Kakao Sync] Error details:", { message: h.message, stack: h.stack, name: h.name });
    const g = e.req.query("state") || "/", S = encodeURIComponent(h.message || "unknown");
    return e.redirect(`${g}?error=kakao_sync_failed&detail=${S}`);
  }
});
d.post("/api/auth/kakao/callback", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { code: r, redirect_uri: t } = await e.req.json();
    if (!r) return e.json({ success: false, error: "Authorization code is required" }, 400);
    if (!e.env.KAKAO_REST_API_KEY) return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"), e.json({ success: false, error: "Server configuration error", code: "MISSING_API_KEY" }, 500);
    const a = t || "https://live.ur-team.com/auth/kakao/callback";
    console.log("[Kakao Callback] Starting OAuth flow");
    const n = await Qt(r, a, e.env.KAKAO_REST_API_KEY), { user: o } = await Cr(s, n), i = de(e.env), c = await os({ userId: o.id, userType: "user", email: o.email || void 0 }, i), u = await As({ userId: o.id, userType: "user", email: o.email || void 0 }, i);
    return console.log("[Kakao Callback] \u2705 JWT \uD1A0\uD070 \uBC1C\uAE09 \uC644\uB8CC for user:", o.id), e.json({ success: true, data: { accessToken: c, refreshToken: u, user: { id: o.id, name: o.name, email: o.email, profile_image: o.profile_image } } });
  } catch (r) {
    return console.error("[Kakao Callback] Error:", r), r instanceof ee ? e.json({ success: false, error: r.message, code: r.code }, r.statusCode) : e.json({ success: false, error: r.message || "Internal server error", code: "UNKNOWN_ERROR" }, 500);
  }
});
d.post("/api/auth/kakao/sync", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { accessToken: r } = await e.req.json();
    if (!r) return e.json({ success: false, error: "Access token is required" }, 400);
    console.log("[Kakao Sync] Verifying access token");
    const t = Date.now(), { user: a, sessionToken: n } = await Cr(s, r);
    console.log("[Kakao Sync] ProcessKakaoLogin completed in", Date.now() - t, "ms");
    const o = Date.now() + 720 * 60 * 60 * 1e3, i = Date.now();
    return await e.env.SESSION_KV.put(`session:${n}`, JSON.stringify({ user_id: a.id, user_type: "user", expires_at: o }), { expirationTtl: 720 * 60 * 60 }), console.log("[Kakao Sync] \u2705 Session saved to SESSION_KV in", Date.now() - i, "ms"), console.log("[Kakao Sync] Total login time:", Date.now() - t, "ms"), e.json({ success: true, data: { session_token: n, user: { id: a.id, name: a.name, email: a.email, profile_image: a.profile_image } } });
  } catch (r) {
    return console.error("[Kakao Sync] Error:", r), r instanceof ee ? e.json({ success: false, error: r.message, code: r.code }, r.statusCode) : e.json({ success: false, error: r instanceof Error ? r.message : "Login failed", code: "UNKNOWN_ERROR" }, 500);
  }
});
d.get("/api/auth/validate", w(), async (e) => {
  try {
    const s = e.req.header("Authorization"), r = (s == null ? void 0 : s.replace("Bearer ", "")) || "";
    if (!r) return e.json({ success: false, valid: false, error: "No JWT token provided", code: "NO_TOKEN" }, 401);
    const t = de(e.env.JWT_SECRET), a = await js(r, t);
    return a ? e.json({ success: true, valid: true, data: { user_id: a.userId, user_type: a.userType, email: a.email, session_valid: true }, user: { userId: a.userId, userType: a.userType, email: a.email } }) : e.json({ success: false, valid: false, error: "JWT token expired or invalid", code: "TOKEN_EXPIRED" }, 401);
  } catch (s) {
    return console.error("[JWT Validate Error]", s), e.json({ success: false, valid: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
  }
});
d.post("/api/auth/refresh", w(), async (e) => {
  try {
    const s = await e.req.json(), { refreshToken: r } = s;
    if (!r) return e.json({ success: false, error: "No refresh token provided", code: "NO_REFRESH_TOKEN" }, 400);
    const t = de(e.env), a = await kr(r, t);
    return a ? e.json({ success: true, data: { accessToken: a } }) : e.json({ success: false, error: "Refresh token expired or invalid", code: "REFRESH_TOKEN_EXPIRED" }, 401);
  } catch (s) {
    return console.error("[JWT Refresh Error]", s), e.json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
  }
});
d.post("/api/auth/kakao/logout", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.header("X-Session-Token") || "";
    return r && (await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(), console.log("[Kakao Sync] Session deleted")), e.json({ success: true });
  } catch (r) {
    return console.error("[Kakao Sync] Logout error:", r), e.json({ success: false, error: "Logout failed" }, 500);
  }
});
d.post("/api/auth/kakao/unlink", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
    if (console.log("[Kakao Unlink] Starting unlink process..."), !await s.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(r).first()) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await s.prepare(`
      SELECT u.id, u.email, u.name, u.kakao_id, u.profile_image, u.created_at
      FROM users u
      WHERE u.id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(r).first();
    if (!a) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (console.log("[Kakao Unlink] User found:", a.id), a.access_token) try {
      console.log("[Kakao Unlink] Calling Kakao unlink API...");
      const n = await fetch("https://kapi.kakao.com/v1/user/unlink", { method: "POST", headers: { Authorization: `Bearer ${a.access_token}`, "Content-Type": "application/x-www-form-urlencoded" } }), o = await n.json();
      n.ok ? console.log("[Kakao Unlink] Kakao unlink successful:", o.id) : console.warn("[Kakao Unlink] Kakao unlink failed:", o);
    } catch (n) {
      console.error("[Kakao Unlink] Kakao API error:", n);
    }
    else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");
    return console.log("[Kakao Unlink] Deleting user data from DB..."), await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(), console.log("[Kakao Unlink] Sessions deleted"), await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(), console.log("[Kakao Unlink] Cart items deleted"), await s.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(), console.log("[Kakao Unlink] User deleted"), console.log("[Kakao Unlink] Unlink process completed successfully"), e.json({ success: true, message: "\uD68C\uC6D0 \uD0C8\uD1F4\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" });
  } catch (r) {
    return console.error("[Kakao Unlink] Error:", r), e.json({ success: false, error: "\uD68C\uC6D0 \uD0C8\uD1F4 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
d.post("/webhooks/kakao/unlink", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = await e.req.json(), { user_id: t, referrer_type: a } = r;
    if (console.log("[Kakao Webhook] Unlink notification received:", { user_id: t, referrer_type: a }), !t) return e.json({ success: false, error: "user_id is required" }, 400);
    const n = await s.prepare(`
      SELECT id, kakao_id, email, name, created_at
      FROM users 
      WHERE kakao_id = ?
    `).bind(t.toString()).first();
    return n ? (console.log("[Kakao Webhook] Deleting user data for user:", n.id), await s.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(), await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(), await s.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(), console.log("[Kakao Webhook] User data deleted successfully"), e.json({ success: true })) : (console.log("[Kakao Webhook] User not found:", t), e.json({ success: true }));
  } catch (r) {
    return console.error("[Kakao Webhook] Error:", r), e.json({ success: false, error: "Webhook processing failed" }, 500);
  }
});
d.get("/api/auth/user/verify", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const t = await Ke(e.env.SESSION_KV, r);
    if (!t || t.user_type !== "user") return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await s.prepare(`
      SELECT id, email, name, kakao_id, profile_image, created_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first();
    return a ? e.json({ success: true, data: { user: { id: a.id, name: a.name, email: a.email, profileImage: a.profile_image, phone: a.phone } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/shipping-addresses", w(), A, async (e) => {
  const { DB: s } = e.env, r = e.get("userId");
  try {
    const t = await s.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: t.results || [] });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/shipping-addresses/:userId", w(), A, async (e) => {
  const { DB: s } = e.env, r = e.get("userId"), t = parseInt(e.req.param("userId"));
  try {
    if (t !== r) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uBC30\uC1A1\uC9C0\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const a = await s.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.post("/api/shipping-addresses", w(), A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = await e.req.json(), t = r.user_id, a = r.recipient_name, n = r.phone, o = r.postal_code, i = r.address, c = r.address_detail, u = r.is_default;
    if (console.log("[POST /api/shipping-addresses] Received:", JSON.stringify(r)), !t || !a || !n || !i) return console.error("[POST /api/shipping-addresses] Missing required fields:", { userId: t, recipientName: a, phone: n, address: i }), e.json({ success: false, error: "\uD544\uC218 \uC815\uBCF4\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    u && await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(t).run();
    const l = await s.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t, a, n, o || "", i, c || "", u ? 1 : 0).run();
    return console.log("[POST /api/shipping-addresses] Success:", { id: l.meta.last_row_id }), e.json({ success: true, data: { id: l.meta.last_row_id } });
  } catch (r) {
    return console.error("[POST /api/shipping-addresses] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/shipping-addresses/:id", w(), A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("id"), t = await e.req.json(), a = t.user_id, n = t.recipient_name, o = t.phone, i = t.postal_code, c = t.address, u = t.address_detail, l = t.is_default;
    return l && await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(), await s.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n, o, i || "", c, u || "", l ? 1 : 0, r, a).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/shipping-addresses/:id", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("id"), t = e.req.query("userId");
    return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r, t).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
async function P(e) {
  const s = e.req.header("X-Session-Token");
  if (!s) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await Ke(e.env.SESSION_KV, s);
  return !r || r.user_type !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: r.admin_id, userData: r };
}
__name(P, "P");
__name2(P, "P");
async function v(e) {
  const s = e.req.header("X-Session-Token");
  if (!s) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await Ke(e.env.SESSION_KV, s);
  return !r || r.user_type !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: r.seller_id, userData: r };
}
__name(v, "v");
__name2(v, "v");
d.get("/api/health", (e) => e.json({ success: true, status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString(), env: { hasDB: !!e.env.DB, hasSessionKV: !!e.env.SESSION_KV, hasCacheKV: !!e.env.CACHE_KV } }));
d.get("/api/test/env", async (e) => {
  try {
    const s = await xt(e.env);
    return e.json(s);
  } catch (s) {
    return e.json({ success: false, error: "\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uC2E4\uD589 \uC911 \uC624\uB958 \uBC1C\uC0DD", details: s instanceof Error ? s.message : String(s) }, 500);
  }
});
d.get("/api/streams", async (e) => {
  const { DB: s, CACHE_KV: r } = e.env;
  try {
    const t = "streams:live", a = await r.get(t, "json");
    if (a) return e.json({ success: true, data: a, cached: true });
    const n = await s.prepare("SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC").bind("live").all();
    return await r.put(t, JSON.stringify(n.results), { expirationTtl: 600 }), e.json({ success: true, data: n.results });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/streams/:id", async (e) => {
  const { DB: s } = e.env, r = e.req.param("id");
  try {
    const t = await s.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(r).first();
    return t ? e.json({ success: true, data: t }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/live-streams", async (e) => {
  const { DB: s } = e.env, { status: r, seller_id: t, limit: a = "20", offset: n = "0" } = e.req.query();
  try {
    const o = `live_streams:${r || "all"}:${t || "all"}:${a}:${n}`, i = 60, c = ye(o);
    if (c) return console.log("[LiveStreams] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", o), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStreams] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", o);
        const l = await Ys(s, r, t, a, n);
        X(o, l, i), console.log("[LiveStreams] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", o);
      } catch (l) {
        console.error("[LiveStreams] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", l);
      }
    })()), e.json({ success: true, data: c });
    console.log("[LiveStreams] \u{1F4BE} DB \uC870\uD68C:", o);
    const u = await Ys(s, r, t, a, n);
    return X(o, u, i), e.json({ success: true, data: u });
  } catch (o) {
    return console.error("[API] Live streams list error:", o), e.json({ success: false, error: `\uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${o.message}` }, 500);
  }
});
async function Ys(e, s, r, t, a) {
  let n = `
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;
  const o = [];
  s && (n += " AND ls.status = ?", o.push(s)), r && (n += " AND ls.seller_id = ?", o.push(r)), n += ' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC', n += " LIMIT ? OFFSET ?", o.push(parseInt(t), parseInt(a));
  const { results: i } = await e.prepare(n).bind(...o).all();
  return i;
}
__name(Ys, "Ys");
__name2(Ys, "Ys");
d.get("/api/live-streams/:id", async (e) => {
  const { DB: s } = e.env, r = e.req.param("id");
  try {
    const t = `live_stream:${r}`, a = 30, n = ye(t);
    if (n) return console.log("[LiveStream] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", t), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStream] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", t);
        const i = await Js(s, r);
        i && (X(t, i, a), console.log("[LiveStream] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", t));
      } catch (i) {
        console.error("[LiveStream] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", i);
      }
    })()), e.json({ success: true, data: n });
    console.log("[LiveStream] \u{1F4BE} DB \uC870\uD68C:", t);
    const o = await Js(s, r);
    return o ? (X(t, o, a), e.json({ success: true, data: o })) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
async function Js(e, s) {
  return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first();
}
__name(Js, "Js");
__name2(Js, "Js");
d.get("/api/products", async (e) => {
  const { DB: s, CACHE_KV: r } = e.env;
  try {
    const t = e.req.query("featured"), a = parseInt(e.req.query("limit") || "20"), n = parseInt(e.req.query("offset") || "0"), o = `products:list:${t || "all"}:${a}:${n}`, i = ye(o);
    if (i) return e.executionCtx.waitUntil((async () => {
      try {
        const u = await zs(s, t, a, n);
        X(o, u, 3600), await Ze(r, o, u, 300, false);
      } catch (u) {
        console.error("[Cache Revalidate] Products error:", u);
      }
    })()), e.json({ success: true, data: i, cached: true });
    const c = await zs(s, t, a, n);
    return X(o, c, 3600), await Ze(r, o, c, 300, false), e.json({ success: true, data: c, cached: false });
  } catch (t) {
    return console.error("Products list error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
async function zs(e, s, r, t) {
  let a;
  return s === "true" ? a = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        p.seller_id,
        s.display_name as seller_name,
        COALESCE(SUM(oi.quantity), 0) as sold_count
      FROM products p
      JOIN sellers s ON p.seller_id = s.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.is_active = 1 
        AND p.stock > 0 
        AND s.is_featured_seller = 1
      GROUP BY p.id
      ORDER BY sold_count DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    ` : a = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        p.seller_id,
        COALESCE(SUM(oi.quantity), 0) as sold_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.is_active = 1 AND p.stock > 0
      GROUP BY p.id
      ORDER BY sold_count DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `, (await e.prepare(a).bind(r, t).all()).results || [];
}
__name(zs, "zs");
__name2(zs, "zs");
d.get("/api/products/popular", async (e) => {
  const { DB: s, CACHE_KV: r } = e.env;
  try {
    const t = "products:popular", a = ye(t);
    if (a) return e.executionCtx.waitUntil((async () => {
      try {
        const o = await Gs(s);
        X(t, o, 3600), await Ze(r, t, o, 600, false);
      } catch (o) {
        console.error("[Cache Revalidate] Popular products error:", o);
      }
    })()), e.json({ success: true, data: a, cached: true });
    const n = await Gs(s);
    return X(t, n, 3600), await Ze(r, t, n, 600, false), e.json({ success: true, data: n, cached: false });
  } catch (t) {
    return console.error("Popular products error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
async function Gs(e) {
  return (await e.prepare(`
    SELECT 
      p.id,
      p.name,
      p.description,
      p.price as current_price,
      p.original_price,
      p.discount_rate,
      p.image_url,
      p.stock,
      p.category,
      COALESCE(SUM(oi.quantity), 0) as sold_count
    FROM products p
    LEFT JOIN order_items oi ON p.id = oi.product_id
    LEFT JOIN orders o ON oi.order_id = o.id
    WHERE p.is_active = 1 AND p.stock > 0
    GROUP BY p.id
    ORDER BY sold_count DESC, p.created_at DESC
    LIMIT 20
  `).all()).results || [];
}
__name(Gs, "Gs");
__name2(Gs, "Gs");
d.get("/api/search/suggestions", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.query("q") || "";
    if (!r.trim() || r.length < 2) return e.json({ success: true, data: { suggestions: [] } });
    const t = `%${r}%`, a = await s.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(t).all(), n = await s.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(t, t).all(), o = [...(a.results || []).map((i) => ({ type: "product", text: i.name })), ...(n.results || []).map((i) => ({ type: "seller", text: i.display_name }))];
    return e.json({ success: true, data: { suggestions: o } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/products/search", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.query("q") || "", t = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0");
    if (!r.trim()) return e.json({ success: false, error: "Search query is required" }, 400);
    const n = r.trim(), o = `${n}*`;
    try {
      if (await s.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='products_fts'
      `).first()) {
        console.log("[Search] \u26A1 FTS5 \uAC80\uC0C9 \uC0AC\uC6A9:", o);
        const c = await s.prepare(`
          SELECT 
            p.*,
            s.display_name as seller_name,
            s.username as seller_username,
            bm25(products_fts) as rank
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          LEFT JOIN sellers s ON p.seller_id = s.id
          WHERE products_fts MATCH ?
            AND p.is_active = 1
          ORDER BY rank ASC
          LIMIT ? OFFSET ?
        `).bind(o, t, a).all(), u = await s.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(o).first();
        return e.json({ success: true, data: { products: c.results || [], total: (u == null ? void 0 : u.total) || 0, query: r, limit: t, offset: a, searchMethod: "fts5" } });
      } else throw console.log("[Search] \u26A0\uFE0F FTS5 \uBBF8\uC0AC\uC6A9 - LIKE \uAC80\uC0C9 fallback"), new Error("FTS5 not available");
    } catch (i) {
      console.log("[Search] \u{1F4BE} LIKE \uAC80\uC0C9 fallback:", i.message);
      const c = `%${n}%`, u = await s.prepare(`
        SELECT 
          p.*,
          s.display_name as seller_name,
          s.username as seller_username
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ? 
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(c, c, c, c, c, t, a).all(), l = await s.prepare(`
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
      `).bind(c, c, c, c, c).first();
      return e.json({ success: true, data: { products: u.results || [], total: (l == null ? void 0 : l.total) || 0, query: r, limit: t, offset: a, searchMethod: "like" } });
    }
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/products/:id", async (e) => {
  const { DB: s } = e.env, r = e.req.param("id");
  try {
    const t = `product:detail:${r}`, a = ye(t);
    if (a) return e.executionCtx.waitUntil((async () => {
      try {
        const o = await Xs(s, r);
        X(t, o, 1800);
      } catch (o) {
        console.error("[Cache Revalidate] Product detail error:", o);
      }
    })()), e.json({ success: true, data: a, cached: true });
    const n = await Xs(s, r);
    return n ? (X(t, n, 1800), e.json({ success: true, data: n, cached: false })) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
async function Xs(e, s) {
  const r = await e.prepare(`
    SELECT 
      p.*,
      COALESCE(s.name, s.username, 'UR Live') as seller_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.is_active = 1
  `).bind(s).first();
  if (!r) return null;
  const t = await e.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s).all();
  return { product: r, options: t.results };
}
__name(Xs, "Xs");
__name2(Xs, "Xs");
d.get("/api/products/:id/stock", async (e) => {
  const { DB: s } = e.env, r = e.req.param("id");
  try {
    const t = await s.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(r).first();
    return t ? e.json({ success: true, data: { productId: t.id, productName: t.name, stock: t.stock, available: t.stock > 0 } }) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/streams/:streamId/products", async (e) => {
  const { DB: s } = e.env, r = e.req.param("streamId");
  try {
    const t = await s.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: t.results });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/cart", A, async (e) => {
  const { DB: s } = e.env, r = e.get("userId");
  try {
    const t = await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.image_url as image_url,
        p.seller_id as seller_id,
        po.option_value as option_value,
        s.shipping_fee as shipping_fee,
        s.free_shipping_threshold as free_shipping_threshold,
        s.display_name as seller_name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_options po ON ci.option_id = po.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE ci.user_id = ?
      ORDER BY ci.added_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: t.results });
  } catch (t) {
    return e.json({ success: false, error: `\uC7A5\uBC14\uAD6C\uB2C8 \uC870\uD68C \uC2E4\uD328: ${t.message}` }, 500);
  }
});
d.get("/api/cart/:userId", A, async (e) => {
  const { DB: s } = e.env, r = e.get("userId"), t = e.req.param("userId");
  try {
    let a = await s.prepare("SELECT id FROM users WHERE id = ?").bind(r).first();
    if (!a) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = a.id;
    if (t !== String(n)) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC7A5\uBC14\uAD6C\uB2C8\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const o = await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.image_url as image_url,
        p.seller_id as seller_id,
        po.option_value as option_value,
        s.shipping_fee as shipping_fee,
        s.free_shipping_threshold as free_shipping_threshold,
        s.display_name as seller_name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_options po ON ci.option_id = po.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE ci.user_id = ?
      ORDER BY ci.added_at DESC
    `).bind(n).all();
    return e.json({ success: true, data: o.results });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.post("/api/users", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = await e.req.json(), { kakaoId: t, name: a, email: n, phone: o } = r;
    if (!t || !a) return e.json({ success: false, error: "kakaoId and name are required" }, 400);
    const i = await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(t).first();
    if (i) return e.json({ success: true, data: { id: i.id } });
    const c = await s.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(t, a, n || null, o || null).run();
    return e.json({ success: true, data: { id: c.meta.last_row_id } });
  } catch (r) {
    return console.error("Error creating user:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/cart", A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = await e.req.json(), { userId: t, kakaoId: a, productId: n, optionId: o, quantity: i, priceSnapshot: c, liveStreamId: u } = r, l = a || t;
    if (!l) return e.json({ success: false, error: "userId or kakaoId is required" }, 400);
    let p = await s.prepare("SELECT id FROM users WHERE id = ?").bind(l).first();
    if (p || (p = await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(l).first()), !p) return e.json({ success: false, error: "User not found" }, 404);
    const m = p.id, E = await s.prepare("SELECT stock FROM products WHERE id = ?").bind(n).first();
    if (!E || E.stock < i) return e.json({ success: false, error: "Insufficient stock" }, 400);
    const _ = await s.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(m, n, o || null, o || null).first();
    let h;
    if (_) {
      const g = _.quantity + i;
      await s.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(g, c, _.id).run(), h = _.id;
    } else h = (await s.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(m, n, o || null, i, c, u || null).run()).meta.last_row_id;
    return e.json({ success: true, data: { id: h, isUpdate: !!_ } });
  } catch (r) {
    return console.error("[API /api/cart POST] Error:", r), console.error("[API /api/cart POST] Error message:", r.message), console.error("[API /api/cart POST] Error stack:", r.stack), e.json({ success: false, error: "Failed to add to cart: " + (r.message || "Unknown error") }, 500);
  }
});
d.delete("/api/cart/:cartItemId", A, async (e) => {
  const { DB: s } = e.env, r = e.req.param("cartItemId");
  try {
    return await s.prepare("DELETE FROM cart_items WHERE id = ?").bind(r).run(), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.delete("/api/cart/clear/:userId", A, Wa("cart"), async (e) => {
  const { DB: s } = e.env, r = e.req.param("userId");
  try {
    return await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(r).run(), e.json({ success: true, message: "\uC7A5\uBC14\uAD6C\uB2C8\uAC00 \uBE44\uC6CC\uC84C\uC2B5\uB2C8\uB2E4." });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.put("/api/cart/:cartItemId", A, async (e) => {
  const { DB: s } = e.env, r = e.req.param("cartItemId");
  try {
    const t = await e.req.json(), { quantity: a } = t;
    if (!a || a < 1) return e.json({ success: false, error: "Invalid quantity" }, 400);
    const n = await s.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(r).first();
    return n ? n.stock < a ? e.json({ success: false, error: "Insufficient stock" }, 400) : (await s.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a, r).run(), e.json({ success: true })) : e.json({ success: false, error: "Cart item not found" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/orders", A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = await e.req.json(), { userId: t, cartItemIds: a, shippingInfo: n, items: o, shippingAddress: i, shippingAddressDetail: c, recipientName: u, recipientPhone: l, deliveryMemo: p, totalAmount: m, shippingFee: E, orderNumber: _, paymentKey: h, paymentMethod: g } = r;
    if (o && o.length > 0) {
      const D = o.map((B) => B.productId), M = D.map(() => "?").join(","), $ = await s.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${M})
      `).bind(...D).all(), C = new Map($.results.map((B) => [B.id, B])), q = [];
      for (const B of o) {
        const Ne = C.get(B.productId);
        if (!Ne) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${B.productId})` }, 400);
        if (Ne.stock < B.quantity) return e.json({ success: false, error: `\uC7AC\uACE0 \uBD80\uC871: ${Ne.name} (\uB0A8\uC740 \uC7AC\uACE0: ${Ne.stock}\uAC1C)` }, 400);
        q.push({ product_id: B.productId, option_id: B.optionId || null, quantity: B.quantity, price: B.price, product_name: Ne.name, product_stock: Ne.stock });
      }
      const V = /* @__PURE__ */ new Date(), Q = V.getFullYear().toString().slice(-2), R = (V.getMonth() + 1).toString().padStart(2, "0"), we = V.getDate().toString().padStart(2, "0"), x = `${Q}${R}${we}`, H = Math.random().toString(36).substring(2, 7).toUpperCase(), pe = _ || `ORD-${x}-${H}`, ne = c ? `${i} ${c}` : i, Ve = (await s.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(pe, t || null, m || 0, "pending", "pending", ne || null, u || null, l || null, p || null, h || null).run()).meta.last_row_id;
      for (const B of q) await s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ve, B.product_id, B.option_id, B.quantity, B.price, B.product_name).run();
      return e.json({ success: true, data: { orderId: Ve, orderNumber: pe, totalAmount: m } });
    }
    if (!a || a.length === 0) return e.json({ success: false, error: "No items provided" }, 400);
    const S = a.map(() => "?").join(","), y = await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${S})
    `).bind(...a).all();
    if (y.results.length === 0) return e.json({ success: false, error: "No items found" }, 400);
    for (const D of y.results) if (D.product_stock < D.quantity) return e.json({ success: false, error: `Insufficient stock for ${D.product_name}` }, 400);
    const j = y.results.reduce((D, M) => D + M.price_snapshot * M.quantity, 0), O = `ORD${Date.now()}${Math.floor(Math.random() * 1e3)}`, U = (await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(O, t, j, n.address, n.name, n.phone).run()).meta.last_row_id, N = [];
    for (const D of y.results) {
      let M = false, $ = "";
      for (let C = 0; C < 3; C++) {
        if ((await s.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND stock >= ?
            AND is_active = 1
        `).bind(D.quantity, D.product_id, D.quantity).run()).meta.changes > 0) {
          M = true;
          break;
        }
        const V = await s.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(D.product_id).first();
        if (!V || V.stock < D.quantity) {
          $ = `\uC7AC\uACE0 \uBD80\uC871: ${D.product_name} (\uB0A8\uC740 \uC7AC\uACE0: ${(V == null ? void 0 : V.stock) || 0}\uAC1C)`;
          break;
        }
        C < 2 ? await new Promise((Q) => setTimeout(Q, 50 * C)) : $ = "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958 \uBC1C\uC0DD. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694. (\uB3D9\uC2DC\uC131 \uCDA9\uB3CC)";
      }
      if (!M) return e.json({ success: false, error: $ || "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, $.includes("\uC7AC\uACE0 \uBD80\uC871") ? 400 : 409);
      N.push(s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(U, D.product_id, D.option_id, D.quantity, D.price_snapshot, D.product_name));
    }
    N.push(s.prepare(`DELETE FROM cart_items WHERE id IN (${S})`).bind(...a)), await s.batch(N);
    try {
      const D = y.results.map((C) => C.product_id), M = D.map(() => "?").join(","), $ = await s.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${M}) AND seller_id IS NOT NULL
      `).bind(...D).all();
      for (const C of $.results) {
        const q = C.seller_id;
        await Va(s, q, O, buyerName || shippingName || "\uACE0\uAC1D", j);
      }
    } catch (D) {
      console.error("[Order] Notification error:", D);
    }
    return e.json({ success: true, data: { orderId: U, orderNumber: O, totalAmount: j } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/streams/:streamId/current-product", async (e) => {
  const { DB: s, LIVE_CACHE: r } = e.env, t = e.req.param("streamId");
  try {
    const a = `current-product:${t}`, n = await Lr(r, a, 3);
    if (n) return e.json({ success: true, data: n });
    const o = await s.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(t).first();
    if (!o || !o.current_product_id) return await fs(r, a, null, 3), e.json({ success: true, data: null });
    const i = await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(o.current_product_id).first(), c = await s.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(), u = { product: i, options: c.results };
    return await fs(r, a, u, 3), e.json({ success: true, data: u });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/streams/:streamId/product-wait", async (e) => {
  const { LIVE_CACHE: s } = e.env, r = e.req.param("streamId"), t = e.req.query("lastTimestamp") || "0";
  try {
    const a = `product-timestamp:${r}`, n = `current-product:${r}`, o = 25e3, i = Date.now();
    for (; Date.now() - i < o; ) {
      const c = await s.get(a) || "0";
      if (c !== t) {
        const u = await Lr(s, n, 30);
        return e.json({ success: true, timestamp: c, data: u, changed: true });
      }
      await new Promise((u) => setTimeout(u, 1e3));
    }
    return e.json({ success: true, timestamp: t, data: null, changed: false });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/seller/dashboard/stats", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = r.sellerId, a = e.req.query("period") || "7d";
    let n = 7;
    a === "30d" ? n = 30 : a === "90d" && (n = 90);
    const o = await s.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(total_amount) as sales,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders
      FROM orders
      WHERE seller_id = ?
        AND created_at >= datetime('now', ?)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).bind(t, `-${n} days`).all(), i = await s.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_sales,
        AVG(total_amount) as avg_order_value,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders
      WHERE seller_id = ?
        AND created_at >= datetime('now', ?)
    `).bind(t, `-${n} days`).first(), c = await s.prepare(`
      SELECT 
        oi.product_id,
        p.name as product_name,
        COUNT(*) as order_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.price * oi.quantity) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.seller_id = ?
        AND o.created_at >= datetime('now', ?)
      GROUP BY oi.product_id, p.name
      ORDER BY total_revenue DESC
      LIMIT 5
    `).bind(t, `-${n} days`).all();
    return e.json({ success: true, data: { period: a, daily: o.results || [], summary: i || {}, topProducts: c.results || [] } });
  } catch (t) {
    return console.error("Error loading seller dashboard stats:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/analytics/products", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = r.sellerId, a = await s.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.stock,
        COALESCE(SUM(oi.quantity), 0) as total_sold,
        COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
        COUNT(DISTINCT o.id) as order_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.seller_id = ?
      GROUP BY p.id, p.name, p.price, p.stock
      ORDER BY total_revenue DESC
    `).bind(t).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (t) {
    return console.error("Error loading product analytics:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/streams", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = r.sellerId, a = await s.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(t).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (t) {
    return console.error("Error loading seller streams:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/seller/streams", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { title: t, description: a, youtube_video_id: n, youtube_url: o, thumbnail_url: i, scheduled_at: c, status: u, seller_instagram: l, seller_youtube: p, seller_facebook: m } = await e.req.json();
    let E = n, _ = "youtube", h = null, g = null, S = i;
    if (o && !E && (E = Ur(o), !E)) if (E = $r(o), h = qr(o), g = Za(o), E) _ = "tiktok";
    else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok live stream URL." }, 400);
    if (!S && E && _ === "youtube" && (S = `https://img.youtube.com/vi/${E}/maxresdefault.jpg`), !t || !E) return e.json({ success: false, error: "Title and live stream URL are required" }, 400);
    const y = await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t, a || null, E, u || "scheduled", c || null, r.sellerId, l || null, p || null, m || null, _, h, g, S || null).run(), j = await s.prepare("SELECT * FROM live_streams WHERE id = ?").bind(y.meta.last_row_id).first(), O = await s.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(r.sellerId).first();
    try {
      const { sendLiveStreamCreatedEmail: L } = await Promise.resolve().then(() => an);
      L({ streamId: y.meta.last_row_id, title: t, sellerName: (O == null ? void 0 : O.display_name) || (O == null ? void 0 : O.username) || "\uC54C \uC218 \uC5C6\uC74C", platform: _, scheduledAt: c, status: u || "scheduled" }).then((U) => {
        U.success ? console.log(`[Email] Live stream notification sent for stream #${U.meta.last_row_id}`) : console.error("[Email] Failed to send notification:", U.error);
      }).catch((U) => {
        console.error("[Email] Exception while sending notification:", U);
      });
    } catch (L) {
      console.error("[Email] Failed to send live stream notification:", L);
    }
    return e.json({ success: true, data: j });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.put("/api/seller/streams/:id", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id");
    if (!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const { title: n, description: o, youtube_video_id: i, youtube_url: c, scheduled_at: u, status: l, seller_instagram: p, seller_youtube: m, seller_facebook: E } = await e.req.json(), _ = [], h = [];
    if (n !== void 0 && (_.push("title = ?"), h.push(n)), o !== void 0 && (_.push("description = ?"), h.push(o)), c !== void 0 || i !== void 0) {
      let g = i, S = "youtube", y = null;
      if (c && (g = Ur(c), !g)) if (g = $r(c), y = qr(c), g) S = "tiktok";
      else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok video URL." }, 400);
      g !== void 0 && (_.push("youtube_video_id = ?"), h.push(g), _.push("platform = ?"), h.push(S), S === "tiktok" && y && (_.push("tiktok_username = ?"), h.push(y)));
    }
    return l !== void 0 && (_.push("status = ?"), h.push(l)), u !== void 0 && (_.push("scheduled_at = ?"), h.push(u)), p !== void 0 && (_.push("seller_instagram = ?"), h.push(p)), m !== void 0 && (_.push("seller_youtube = ?"), h.push(m)), E !== void 0 && (_.push("seller_facebook = ?"), h.push(E)), _.length === 0 ? e.json({ success: false, error: "No fields to update" }, 400) : (_.push("updated_at = datetime('now')"), await s.prepare(`
      UPDATE live_streams SET ${_.join(", ")} WHERE id = ?
    `).bind(...h, t).run(), e.json({ success: true }));
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.delete("/api/seller/streams/:id", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id");
    return await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first() ? (await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(t).run(), e.json({ success: true })) : e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/seller/youtube/create-live", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { title: t, description: a, scheduled_at: n } = await e.req.json();
    if (!t) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1 \uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD658\uACBD \uBCC0\uC218\uB97C \uC124\uC815\uD574\uC8FC\uC138\uC694.", help: "wrangler secret put YOUTUBE_ACCESS_TOKEN" }, 400);
    const i = await za({ accessToken: o }, t, a || ""), u = (await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t, a || null, i.broadcastId, n || null, r.sellerId, i.broadcastId, i.streamKey).run()).meta.last_row_id;
    return await us(s, r.sellerId, "seller", "live_created", "\u{1F4FA} YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${t} - \uC2A4\uD2B8\uB9BC \uD0A4\uC640 URL\uC744 \uD655\uC778\uD558\uC138\uC694`, `/seller/live-control?streamId=${u}`), e.json({ success: true, data: { streamId: u, broadcastId: i.broadcastId, youtubeVideoId: i.broadcastId, streamKey: i.streamKey, streamUrl: i.streamUrl, watchUrl: `https://www.youtube.com/watch?v=${i.broadcastId}` } });
  } catch (t) {
    return console.error("[YouTube Live] Create broadcast error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/seller/youtube/end-live/:streamId", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("streamId"), a = await s.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!n) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const o = a.youtube_broadcast_id || a.youtube_video_id;
    return o ? (await Ga({ accessToken: n }, o), await s.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(), await us(s, r.sellerId, "seller", "live_ended", "\u2705 YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${a.title} \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, "/seller/streams"), e.json({ success: true, message: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" })) : e.json({ success: false, error: "YouTube Broadcast ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uB3D9\uC73C\uB85C \uC0DD\uC131\uB41C \uB77C\uC774\uBE0C\uC785\uB2C8\uB2E4." }, 400);
  } catch (t) {
    return console.error("[YouTube Live] End broadcast error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/youtube/stats/:streamId", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("streamId"), a = await s.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = a.youtube_video_id;
    if (!n) return e.json({ success: false, error: "YouTube Video ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_API_KEY, i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o && !i) return e.json({ success: false, error: "YouTube API Key \uB610\uB294 Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await Qa({ apiKey: o, accessToken: i }, n);
    return e.json({ success: true, data: { streamId: t, videoId: n, stats: c } });
  } catch (t) {
    return console.error("[YouTube Live] Get stats error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/youtube/chat/:streamId", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("streamId"), a = e.req.query("pageToken"), n = await s.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = n.youtube_live_chat_id;
    if (!o) return e.json({ success: false, error: "Live Chat ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!i) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await Xa({ accessToken: i }, o, a);
    return e.json({ success: true, data: c });
  } catch (t) {
    return console.error("[YouTube Live] Get chat messages error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/admin/streams", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { title: t, description: a, youtube_video_id: n, platform: o, tiktok_username: i, status: c } = await e.req.json();
    if (!t) return e.json({ success: false, error: "\uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const u = o || "youtube";
    if (u === "youtube" && !n) return e.json({ success: false, error: "YouTube \uD50C\uB7AB\uD3FC\uC740 \uC601\uC0C1 ID\uAC00 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    if (u === "tiktok" && !i) return e.json({ success: false, error: "TikTok \uD50C\uB7AB\uD3FC\uC740 \uC0AC\uC6A9\uC790\uBA85\uC774 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const l = await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(t, a || null, n || null, u, i || null, c || "scheduled", r.sellerId || null).run();
    return e.json({ success: true, data: { id: l.meta.last_row_id, title: t, description: a, youtube_video_id: n, platform: u, tiktok_username: i, status: c || "scheduled" } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.put("/api/admin/streams/:id", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), { title: a, description: n, youtube_video_id: o, platform: i, tiktok_username: c, status: u } = await e.req.json();
    return await s.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i || "youtube", c || null, u, t).run(), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/seller/streams/:streamId/change-product", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("streamId"), { productId: a } = await e.req.json();
    if (!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const o = await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(a, r.sellerId).first();
    if (!o) return e.json({ success: false, error: "Product not found or not active" }, 404);
    const i = await s.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(a).all();
    await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a, t).run();
    const { LIVE_CACHE: c } = e.env, u = `product-timestamp:${t}`, l = `current-product:${t}`, p = Date.now().toString();
    return await c.put(u, p), await fs(c, l, { product: o, options: i.results }, 30), e.json({ success: true, data: { product: o, options: i.results } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.delete("/api/admin/streams/:id", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id");
    return await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(t).run(), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/admin/streams/:streamId/change-product", async (e) => {
  const { DB: s } = e.env, r = e.req.param("streamId");
  try {
    const { productId: t } = await e.req.json(), a = await s.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(t).first();
    if (!a) return e.json({ success: false, error: "Product not found" }, 404);
    const n = await s.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(t).all();
    await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(t, r).run();
    const { LIVE_CACHE: o } = e.env, i = `product-timestamp:${r}`, c = `current-product:${r}`, u = Date.now().toString();
    return await o.put(i, u), await fs(o, c, { product: a, options: n.results }, 30), e.json({ success: true, data: { product: a, options: n.results } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/wishlists", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { userId: r, productId: t } = await e.req.json();
    if (!r || !t) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uC640 \uC0C1\uD488 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
    if (!await s.prepare("SELECT id FROM users WHERE id = ?").bind(r).first()) return e.json({ success: false, error: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC0AC\uC6A9\uC790\uC785\uB2C8\uB2E4." }, 404);
    const n = await s.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(t).first();
    if (!n) return e.json({ success: false, error: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC0C1\uD488\uC774\uAC70\uB098 \uD310\uB9E4\uAC00 \uC911\uB2E8\uB41C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 404);
    if (await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r, t).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uCC1C\uD55C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 409);
    const i = await s.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(r, t).run();
    return e.json({ success: true, data: { id: i.meta.last_row_id, userId: r, productId: t, productName: n.name } });
  } catch (r) {
    return console.error("[Wishlist] Add error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/wishlists/:id", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("id"), { userId: t } = e.req.query();
    return t ? await s.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(r, t).first() ? (await s.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(r, t).run(), e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (r) {
    return console.error("[Wishlist] Delete error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/wishlists/product/:productId", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("productId"), { userId: t } = e.req.query();
    return t ? (await s.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t, r).run()).meta.changes === 0 ? e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (r) {
    return console.error("[Wishlist] Delete by product error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/wishlists/:userId", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("userId"), t = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0"), { results: n } = await s.prepare(`
      SELECT 
        w.id,
        w.user_id,
        w.product_id,
        w.created_at,
        p.name as product_name,
        p.price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        p.is_active,
        s.display_name as seller_name,
        s.id as seller_id
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(r, t, a).all(), o = await s.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(r).first();
    return e.json({ success: true, data: { items: n, total: (o == null ? void 0 : o.count) || 0, limit: t, offset: a } });
  } catch (r) {
    return console.error("[Wishlist] Get error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/wishlists/check/:userId/:productId", w(), async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("userId"), t = e.req.param("productId"), a = await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r, t).first();
    return e.json({ success: true, data: { isWishlisted: !!a, wishlistId: (a == null ? void 0 : a.id) || null } });
  } catch (r) {
    return console.error("[Wishlist] Check error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/shipping-addresses/:id", A, async (e) => {
  const { DB: s } = e.env, r = e.req.param("id");
  e.get("userId");
  try {
    return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r, userId).run(), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/products", async (e) => {
  const { DB: s, CACHE_KV: r } = e.env, t = await v(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const a = `seller:${t.sellerId}:products`, n = await r.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(t.sellerId).all();
    return await r.put(a, JSON.stringify(o.results), { expirationTtl: 300 }), e.json({ success: true, data: o.results });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.post("/api/seller/upload-image", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { image: t, filename: a } = await e.req.json();
    if (!t) return e.json({ success: false, error: "Image data is required" }, 400);
    const n = t.match(/^data:(image\/[\w+]+);base64,/);
    if (!n) return e.json({ success: false, error: "\uC798\uBABB\uB41C \uC774\uBBF8\uC9C0 \uD615\uC2DD\uC785\uB2C8\uB2E4." }, 400);
    const o = n[1], i = t.replace(/^data:image\/\w+;base64,/, "");
    let c;
    try {
      c = Uint8Array.from(atob(i), (m) => m.charCodeAt(0));
    } catch {
      return e.json({ success: false, error: "\uC774\uBBF8\uC9C0 \uB514\uCF54\uB529 \uC2E4\uD328" }, 400);
    }
    const u = 10 * 1024 * 1024;
    if (c.length > u) return e.json({ success: false, error: `\uD30C\uC77C \uD06C\uAE30\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4. \uCD5C\uB300 ${u / 1024 / 1024}MB\uAE4C\uC9C0 \uD5C8\uC6A9\uB429\uB2C8\uB2E4.` }, 400);
    const l = await vt(c.buffer);
    if (!l.valid) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC774\uBBF8\uC9C0 \uD30C\uC77C\uC785\uB2C8\uB2E4." }, 400);
    const p = e.env.IMAGES;
    if (p) {
      console.log("[Image Upload] Using R2 storage");
      const m = It(a || "upload.jpg"), E = `products/${r.sellerId}/${m}`;
      await p.put(E, c, { httpMetadata: { contentType: l.detectedType || o } });
      const _ = `/api/images/${E}`;
      return e.json({ success: true, url: _, storage: "r2" });
    } else return console.log("[Image Upload] R2 not available, using Base64 fallback"), t.length * 0.75 / (1024 * 1024) > 1 ? e.json({ success: false, error: "Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)" }, 400) : e.json({ success: true, url: t, storage: "base64", warning: "Using Base64 storage. Enable R2 for better performance." });
  } catch (t) {
    return console.error("[Image Upload] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/images/*", async (e) => {
  var s;
  try {
    const r = e.env.IMAGES;
    if (!r) return e.json({ success: false, error: "R2 not configured" }, 503);
    const t = e.req.path.replace("/api/images/", ""), a = await r.get(t);
    return a ? new Response(a.body, { headers: { "Content-Type": ((s = a.httpMetadata) == null ? void 0 : s.contentType) || "image/jpeg", "Cache-Control": "public, max-age=31536000" } }) : e.notFound();
  } catch (r) {
    return console.error("[Image Get] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/products", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { name: t, description: a, price: n, original_price: o, discount_rate: i, image_url: c, stock: u, category: l, live_stream_id: p, is_active: m } = await e.req.json();
    if (!t || !n) return e.json({ success: false, error: "Name and price are required" }, 400);
    if (p && !await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(p, r.sellerId).first()) return e.json({ success: false, error: "Live stream not found or unauthorized" }, 404);
    const E = await s.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t, a || null, n, o || null, i || 0, c || null, u || 0, l || null, p || null, r.sellerId, m !== void 0 ? m : 1).run(), _ = await s.prepare("SELECT * FROM products WHERE id = ?").bind(E.meta.last_row_id).first();
    return await Ps(e.env.CACHE_KV, `seller:${r.sellerId}:products`, `public:seller:${r.sellerId}`), e.json({ success: true, data: _ });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/products/:id", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), a = await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(t, r.sellerId).first();
    return a ? e.json({ success: true, data: a }) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.put("/api/seller/products/:id", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id");
    if (!await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { name: n, description: o, price: i, original_price: c, image_url: u, stock: l, category: p, is_active: m } = await e.req.json(), E = [], _ = [];
    if (n !== void 0 && (E.push("name = ?"), _.push(n)), o !== void 0 && (E.push("description = ?"), _.push(o)), i !== void 0 && (E.push("price = ?"), _.push(i)), c !== void 0 && (E.push("original_price = ?"), _.push(c), i !== void 0 && c)) {
      const g = Math.round((c - i) / c * 100);
      E.push("discount_rate = ?"), _.push(g);
    }
    if (u !== void 0 && (E.push("image_url = ?"), _.push(u)), l !== void 0 && (E.push("stock = ?"), _.push(l)), p !== void 0 && (E.push("category = ?"), _.push(p)), m !== void 0 && (E.push("is_active = ?"), _.push(m ? 1 : 0)), E.push("updated_at = CURRENT_TIMESTAMP"), _.push(t, r.sellerId), E.length === 1) return e.json({ success: false, error: "No fields to update" }, 400);
    await s.prepare(`UPDATE products SET ${E.join(", ")} WHERE id = ? AND seller_id = ?`).bind(..._).run();
    const h = await s.prepare("SELECT * FROM products WHERE id = ?").bind(t).first();
    return await Ps(e.env.CACHE_KV, `seller:${r.sellerId}:products`, `public:seller:${r.sellerId}`), e.json({ success: true, data: h });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.delete("/api/seller/products/:id", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id");
    if (!await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await s.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(t).first();
    return n && n.count > 0 ? e.json({ success: false, error: "\uC774\uBBF8 \uC8FC\uBB38\uB41C \uC0C1\uD488\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD488\uC808 \uCC98\uB9AC\uD558\uAC70\uB098 \uC228\uAE40 \uCC98\uB9AC\uD574\uC8FC\uC138\uC694." }, 400) : (await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(t).run(), await s.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(t).run(), await s.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(t).run(), await s.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).run(), await Ps(e.env.CACHE_KV, `seller:${r.sellerId}:products`, `public:seller:${r.sellerId}`), e.json({ success: true }));
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/products/:id/options", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id");
    if (!await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await s.prepare("SELECT * FROM product_options WHERE product_id = ? ORDER BY id").bind(t).all();
    return e.json({ success: true, data: n.results });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/seller/products/:id/options", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id");
    if (!await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { option_type: n, option_value: o, price_adjustment: i, stock: c } = await e.req.json();
    if (!n || !o) return e.json({ success: false, error: "Option type and value are required" }, 400);
    const u = await s.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(t, n, o, i || 0, c || 0).run();
    return e.json({ success: true, data: { id: u.meta.last_row_id, product_id: t, option_type: n, option_value: o, price_adjustment: i || 0, stock: c || 0 } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.delete("/api/seller/products/:productId/options/:optionId", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("productId"), a = e.req.param("optionId");
    return await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t, r.sellerId).first() ? (await s.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a, t).run(), e.json({ success: true })) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/stats", async (e) => {
  const { DB: s, CACHE_KV: r } = e.env, t = await v(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const a = `seller:${t.sellerId}:stats`, n = await r.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(t.sellerId).first(), i = await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(t.sellerId).first(), c = await s.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(t.sellerId).first(), u = await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(t.sellerId).first(), l = await s.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(t.sellerId).first(), m = { totalProducts: o.count || 0, activeProducts: i.count || 0, totalStock: c.total || 0, totalOrders: u.count || 0, totalRevenue: u.total || 0, activeStreams: l.count || 0, totalViewers: 0 };
    return await r.put(a, JSON.stringify(m), { expirationTtl: 60 }), e.json({ success: true, data: m });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/seller/stats/sales", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.query("period") || "daily";
    let a, n, o;
    switch (t) {
      case "weekly":
        a = "%Y-W%W", n = "week", o = 28;
        break;
      case "monthly":
        a = "%Y-%m", n = "month", o = 180;
        break;
      default:
        a = "%Y-%m-%d", n = "day", o = 30;
    }
    const i = await s.prepare(`
      SELECT 
        strftime('${a}', o.created_at) as period,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.price * oi.quantity) as total_sales,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
        AND o.created_at >= datetime('now', '-${o} days')
        AND o.status != 'cancelled'
      GROUP BY period
      ORDER BY period ASC
    `).bind(r.sellerId).all();
    return e.json({ success: true, data: { period: t, sales: i.results } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/stats/products", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = parseInt(e.req.query("limit") || "10"), a = parseInt(e.req.query("days") || "30"), n = await s.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.image_url,
        COUNT(DISTINCT oi.order_id) as order_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.price * oi.quantity) as total_revenue,
        p.stock as current_stock
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.seller_id = ?
        AND o.created_at >= datetime('now', '-${a} days')
        AND o.status != 'cancelled'
      GROUP BY p.id
      ORDER BY total_revenue DESC
      LIMIT ?
    `).bind(r.sellerId, t).all();
    return e.json({ success: true, data: { products: n.results, period_days: a } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/seller/business-info", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { business_number: t, business_name: a, ceo_name: n, business_type: o, business_category: i, postal_code: c, address: u, phone: l, email: p } = await e.req.json();
    if (!t || !a || !n) return e.json({ success: false, error: "\uC0AC\uC5C5\uC790\uB4F1\uB85D\uBC88\uD638, \uC0C1\uD638\uBA85, \uB300\uD45C\uC790\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const m = await s.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();
    let E;
    return m ? E = await s.prepare(`
        UPDATE seller_business_info
        SET business_number = ?,
            business_name = ?,
            ceo_name = ?,
            business_type = ?,
            business_category = ?,
            postal_code = ?,
            address = ?,
            phone = ?,
            email = ?,
            is_verified = 0,
            verified_at = NULL,
            updated_at = datetime('now')
        WHERE seller_id = ?
      `).bind(t, a, n, o, i, c, u, l, p, r.sellerId).run() : E = await s.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(r.sellerId, t, a, n, o, i, c, u, l, p).run(), e.json({ success: true, data: { id: m ? m.id : E.meta.last_row_id, seller_id: r.sellerId, business_number: t, is_verified: false, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4." } });
  } catch (t) {
    return console.error("\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uB4F1\uB85D \uC624\uB958:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/business-info", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();
    return t ? e.json({ success: true, data: t }) : e.json({ success: false, error: "\uB4F1\uB85D\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.put("/api/admin/seller-business/:id/verify", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  const t = e.req.param("id"), { verified: a } = await e.req.json();
  try {
    return a ? (await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(t).run(), e.json({ success: true, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : (await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(t).run(), e.json({ success: true, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uC2B9\uC778\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }));
  } catch (n) {
    return e.json({ success: false, error: n.message }, 500);
  }
});
d.get("/api/admin/seller-business", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = await s.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();
    return e.json({ success: true, data: t.results || [] });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/orders", A, async (e) => {
  const { DB: s } = e.env, r = e.get("userId");
  try {
    const t = await s.prepare(`
      SELECT 
        o.*,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `).bind(r).all(), a = /* @__PURE__ */ new Map();
    for (const o of t.results) {
      const i = o.id;
      a.has(i) || a.set(i, { id: o.id, user_id: o.user_id, order_number: o.order_number, status: o.status, total_amount: o.total_amount, shipping_fee: o.shipping_fee, payment_method: o.payment_method, payment_key: o.payment_key, shipping_address: o.shipping_address, shipping_name: o.shipping_name, shipping_phone: o.shipping_phone, delivery_request: o.delivery_request, created_at: o.created_at, updated_at: o.updated_at, items: [] }), o.item_id && a.get(i).items.push({ id: o.item_id, product_id: o.product_id, option_id: o.option_id, quantity: o.quantity, price: o.item_price, product_name: o.product_name, image_url: o.image_url, option_value: o.option_value });
    }
    const n = Array.from(a.values());
    return e.json({ success: true, data: n });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/orders/user/:userId", A, async (e) => {
  const { DB: s } = e.env, r = e.get("userId"), t = parseInt(e.req.param("userId"));
  try {
    if (t !== r) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC8FC\uBB38 \uB0B4\uC5ED\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const a = await s.prepare(`
      SELECT 
        o.*,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `).bind(r).all(), n = /* @__PURE__ */ new Map();
    for (const i of a.results) {
      const c = i.id;
      n.has(c) || n.set(c, { id: i.id, user_id: i.user_id, order_number: i.order_number, status: i.status, total_amount: i.total_amount, shipping_fee: i.shipping_fee, payment_method: i.payment_method, payment_key: i.payment_key, shipping_address: i.shipping_address, shipping_name: i.shipping_name, shipping_phone: i.shipping_phone, delivery_request: i.delivery_request, created_at: i.created_at, updated_at: i.updated_at, items: [] }), i.item_id && n.get(c).items.push({ id: i.item_id, product_id: i.product_id, option_id: i.option_id, quantity: i.quantity, price: i.item_price, product_name: i.product_name, image_url: i.image_url, option_value: i.option_value });
    }
    const o = Array.from(n.values());
    return e.json({ success: true, data: o });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/orders/:orderNumber", A, async (e) => {
  const { DB: s } = e.env, r = e.req.param("orderNumber");
  try {
    const t = await s.prepare(`
      SELECT 
        o.*,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE o.order_number = ?
      ORDER BY oi.id ASC
    `).bind(r).all();
    if (t.results.length === 0) return e.json({ success: false, error: "Order not found" }, 404);
    const a = t.results[0], n = { id: a.id, user_id: a.user_id, order_number: a.order_number, status: a.status, total_amount: a.total_amount, shipping_fee: a.shipping_fee, payment_method: a.payment_method, payment_key: a.payment_key, shipping_address: a.shipping_address, shipping_name: a.shipping_name, shipping_phone: a.shipping_phone, delivery_request: a.delivery_request, created_at: a.created_at, updated_at: a.updated_at, items: [] };
    for (const o of t.results) o.item_id && n.items.push({ id: o.item_id, product_id: o.product_id, option_id: o.option_id, quantity: o.quantity, price: o.item_price, product_name: o.product_name, image_url: o.image_url, option_value: o.option_value });
    return e.json({ success: true, data: n });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/orders/:orderId/cancel", A, async (e) => {
  const { DB: s } = e.env, r = e.req.param("orderId");
  try {
    const a = (await e.req.json()).reason || "\uC0AC\uC720 \uC5C6\uC74C", n = await s.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(r).first();
    if (!n) return e.json({ success: false, error: "Order not found" }, 404);
    if (n.status !== "pending") return e.json({ success: false, error: "\uACB0\uC81C \uB300\uAE30 \uC911\uC778 \uC8FC\uBB38\uB9CC \uCDE8\uC18C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACB0\uC81C\uAC00 \uC644\uB8CC\uB41C \uC8FC\uBB38\uC740 \uD658\uBD88\uC744 \uC2E0\uCCAD\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(r).all();
    if (o.results.length > 0) {
      const i = o.results.map((c) => s.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(c.quantity, c.product_id));
      await s.batch(i);
    }
    return await s.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled", a, r).run(), e.json({ success: true, message: "Order cancelled successfully", data: { orderId: r, reason: a, itemsRestored: o.results.length } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/streams/:streamId/viewer-count", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("streamId"), t = await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();
    return t ? e.json({ success: true, data: { viewer_count: t.viewer_count || 0 } }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/streams/:streamId/viewer-count", async (e) => {
  const { DB: s } = e.env, r = await P(e), t = r.success ? { success: false } : await v(e);
  if (!r.success && !t.success) return e.json({ success: false, error: "Unauthorized" }, 401);
  try {
    const a = e.req.param("streamId"), { viewer_count: n } = await e.req.json();
    return typeof n != "number" || n < 0 ? e.json({ success: false, error: "Invalid viewer count" }, 400) : t.success && !await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a, t.sellerId).first() ? e.json({ success: false, error: "Stream not found or unauthorized" }, 404) : (await s.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n, a).run(), e.json({ success: true, data: { viewer_count: n } }));
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.post("/api/streams/:streamId/view", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("streamId");
    await s.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(r).run();
    const t = await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();
    return e.json({ success: true, data: { viewer_count: (t == null ? void 0 : t.viewer_count) || 0 } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/payments/confirm", async (e) => {
  var t;
  const { DB: s } = e.env;
  let r = null;
  try {
    r = await e.req.json();
    const { paymentKey: a, orderId: n, amount: o } = r;
    if (console.log("========================================"), console.log("[Payment] \u{1F680} \uACB0\uC81C \uC2B9\uC778 API \uD638\uCD9C\uB428"), console.log("========================================"), console.log("[Payment] \u{1F4CB} \uC694\uCCAD \uD30C\uB77C\uBBF8\uD130:"), console.log("  - orderId:", n), console.log("  - paymentKey:", a), console.log("  - amount:", o), console.log("  - timestamp:", (/* @__PURE__ */ new Date()).toISOString()), !a || !n || !o) return console.error("[Payment] \u274C \uD544\uC218 \uD30C\uB77C\uBBF8\uD130 \uB204\uB77D!"), console.error("[Payment] paymentKey:", !!a), console.error("[Payment] orderId:", !!n), console.error("[Payment] amount:", !!o), e.json({ success: false, error: "\uD544\uC218 \uD30C\uB77C\uBBF8\uD130\uAC00 \uB204\uB77D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", details: { paymentKey: !!a, orderId: !!n, amount: !!o } }, 400);
    console.log("[Payment] \u2705 \uD544\uC218 \uD30C\uB77C\uBBF8\uD130 \uAC80\uC99D \uD1B5\uACFC");
    const i = await s.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();
    if (!i) return console.error("[Payment] \u274C \uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C:", n), e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uBB38\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uAC70\uB098 \uC774\uBBF8 \uCC98\uB9AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", orderId: n }, 404);
    if (console.log("[Payment] \u2705 \uC8FC\uBB38 \uD655\uC778\uB428:", { id: i.id, order_number: i.order_number, total_amount: i.total_amount, status: i.status }), Number(o) !== Number(i.total_amount)) return console.error("[Payment] \u274C \uAE08\uC561 \uBD88\uC77C\uCE58!", { requested: Number(o), expected: Number(i.total_amount) }), e.json({ success: false, error: "\uACB0\uC81C \uAE08\uC561\uC774 \uC8FC\uBB38 \uAE08\uC561\uACFC \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", requestedAmount: Number(o), expectedAmount: Number(i.total_amount) }, 400);
    const c = e.env.TOSS_SECRET_KEY;
    if (!c) return console.error("[Payment] \u274C TOSS_SECRET_KEY \uD658\uACBD \uBCC0\uC218 \uC5C6\uC74C"), console.error("[Payment] c.env:", Object.keys(e.env || {})), e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    console.log("[Payment] \u2705 TOSS_SECRET_KEY \uD655\uC778\uB428:", c.substring(0, 20) + "..."), console.log("[Payment] \u{1F310} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uD638\uCD9C \uC2DC\uC791..."), console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"), console.log("[Payment] API \uBC84\uC804: 2022-11-16 (\uACB0\uC81C\uC704\uC82F \uACE0\uC815 \uBC84\uC804)");
    const u = "Basic " + btoa(c + ":");
    console.log("[Payment] Authorization \uD5E4\uB354 \uC0DD\uC131 \uC644\uB8CC");
    const l = { orderId: n, amount: Number(o), paymentKey: a };
    console.log("[Payment] \uC694\uCCAD \uBCF8\uBB38:", JSON.stringify(l, null, 2)), console.log("[Payment] \u{1F4CA} amount \uD0C0\uC785:", typeof l.amount), console.log("[Payment] \u{1F4CA} amount \uAC12:", l.amount);
    const p = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: u, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(l) }), m = await p.json();
    if (console.log("[Payment] \u{1F4E1} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uC751\uB2F5:"), console.log("  - HTTP \uC0C1\uD0DC:", p.status), console.log("  - \uC751\uB2F5 OK?:", p.ok), console.log("  - \uC751\uB2F5 \uB370\uC774\uD130 (\uC77C\uBD80):", JSON.stringify(m).substring(0, 300)), !p.ok) return console.error("[Payment] \u274C\u274C\u274C \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC2B9\uC778 \uC2E4\uD328!"), console.error("[Payment] HTTP \uC0C1\uD0DC:", p.status), console.error("[Payment] \uC5D0\uB7EC \uCF54\uB4DC:", m.code), console.error("[Payment] \uC5D0\uB7EC \uBA54\uC2DC\uC9C0:", m.message), console.error("[Payment] \uC804\uCCB4 \uC751\uB2F5:", JSON.stringify(m, null, 2)), e.json({ success: false, error: m.message || "\uACB0\uC81C \uC2B9\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", code: m.code, tossError: m }, p.status);
    console.log("[Payment] \u2705 \uACB0\uC81C \uC2B9\uC778 \uC131\uACF5! paymentKey:", a), console.log("[Payment] \u2705 \uC8FC\uBB38 \uBC88\uD638:", n);
    try {
      await s.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a, n).run(), console.log("[Payment] \u2705 \uC8FC\uBB38 \uC0C1\uD0DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC");
      const E = await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();
      if (E.results.length > 0) {
        const _ = E.results.map((g) => s.prepare(`
            UPDATE products 
            SET stock = stock - ?
            WHERE id = ? AND stock >= ?
          `).bind(g.quantity, g.product_id, g.quantity)), h = await s.batch(_);
        for (let g = 0; g < h.length; g++) if (h[g].meta.changes === 0) {
          const S = E.results[g];
          console.error(`[Payment] \u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871: product_id=${S.product_id}`);
        }
      }
      console.log("[Payment] \u2705 \uC7AC\uACE0 \uCC28\uAC10 \uC644\uB8CC");
      try {
        const _ = i.id, h = await Ea(e.env, _);
        h.success ? console.log(`[Payment] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5 (\uC8FC\uBB38 ${_})`) : console.warn(`[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328 (\uC8FC\uBB38 ${_}):`, h.reason || h.error);
      } catch (_) {
        console.error("[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC911 \uC624\uB958:", _);
      }
    } catch (E) {
      console.error("[Payment] \u26A0\uFE0F DB \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 (\uACB0\uC81C\uB294 \uC131\uACF5):", E);
    }
    return e.json({ success: true, data: m });
  } catch (a) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328:", { orderId: r == null ? void 0 : r.orderId, error: a.message, stack: (t = a.stack) == null ? void 0 : t.substring(0, 500) }), e.json({ success: false, error: "\uACB0\uC81C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uACE0\uAC1D\uC13C\uD130\uB85C \uBB38\uC758\uD574\uC8FC\uC138\uC694.", details: a.message }, 500);
  }
});
d.post("/api/chat/:liveStreamId/messages", w(), async (e) => {
  const { DB: s } = e.env, r = e.req.param("liveStreamId");
  try {
    const t = await e.req.json(), { userId: a, userName: n, userAvatar: o, message: i, isSeller: c, isAdmin: u } = t;
    if (!i || i.trim().length === 0) return e.json({ success: false, error: "Message cannot be empty" }, 400);
    if (i.length > 500) return e.json({ success: false, error: "Message is too long (max 500 characters)" }, 400);
    if (a && await s.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(r, a).first()) return e.json({ success: false, error: "You are banned from this chat" }, 403);
    const l = ["\uC528\uBC1C", "\uAC1C\uC0C8\uB07C", "\uBCD1\uC2E0", "\uC886", "\uC2DC\uBC1C"];
    let p = i;
    l.forEach((E) => {
      const _ = new RegExp(E, "gi");
      p = p.replace(_, "*".repeat(E.length));
    });
    const m = await s.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a || null, n, o || null, p, c ? 1 : 0, u ? 1 : 0).run();
    return e.json({ success: true, data: { id: m.meta.last_row_id, message: p } });
  } catch (t) {
    return console.error("Error sending chat message:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/chat/:liveStreamId/messages", w(), async (e) => {
  const { DB: s } = e.env, r = e.req.param("liveStreamId"), t = e.req.query("since"), a = Number(e.req.query("limit")) || 50;
  try {
    let n = `
      SELECT 
        id,
        user_id,
        user_name,
        user_avatar,
        message,
        is_seller,
        is_admin,
        is_deleted,
        datetime(created_at) as created_at
      FROM chat_messages
      WHERE live_stream_id = ? AND is_deleted = 0
    `;
    const o = [r];
    t && (n += " AND id > ?", o.push(Number(t))), n += " ORDER BY created_at DESC LIMIT ?", o.push(a);
    const c = (await s.prepare(n).bind(...o).all()).results.reverse();
    return e.json({ success: true, data: c });
  } catch (n) {
    return console.error("Error fetching chat messages:", n), e.json({ success: false, error: n.message }, 500);
  }
});
d.delete("/api/chat/:liveStreamId/messages/:messageId", w(), async (e) => {
  const { DB: s } = e.env, r = e.req.param("messageId");
  try {
    return await s.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(r).run(), e.json({ success: true, message: "Message deleted successfully" });
  } catch (t) {
    return console.error("Error deleting chat message:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/chat/:liveStreamId/ban", w(), async (e) => {
  const { DB: s } = e.env, r = e.req.param("liveStreamId");
  try {
    const t = await e.req.json(), { userId: a, bannedBy: n, reason: o, duration: i } = t;
    if (!a || !n) return e.json({ success: false, error: "userId and bannedBy are required" }, 400);
    let c = null;
    if (i) {
      const u = /* @__PURE__ */ new Date();
      u.setMinutes(u.getMinutes() + i), c = u.toISOString();
    }
    return await s.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(r, a, n, o || null, c).run(), e.json({ success: true, message: "User banned successfully" });
  } catch (t) {
    return console.error("Error banning user:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.delete("/api/chat/:liveStreamId/ban/:userId", w(), async (e) => {
  const { DB: s } = e.env, r = e.req.param("liveStreamId"), t = e.req.param("userId");
  try {
    return await s.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(r, t).run(), e.json({ success: true, message: "Ban removed successfully" });
  } catch (a) {
    return console.error("Error removing ban:", a), e.json({ success: false, error: a.message }, 500);
  }
});
d.post("/api/payments/webhook", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = await e.req.json();
    switch (console.log("[Webhook] \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC6F9\uD6C5 \uC218\uC2E0:", { eventType: r.eventType, orderId: r.orderId, status: r.status, timestamp: (/* @__PURE__ */ new Date()).toISOString() }), r.eventType) {
      case "PAYMENT_STATUS_CHANGED":
        await en(s, r);
        break;
      case "VIRTUAL_ACCOUNT_ISSUED":
        await sn(s, r);
        break;
      default:
        console.log("[Webhook] \uCC98\uB9AC\uD558\uC9C0 \uC54A\uB294 \uC774\uBCA4\uD2B8 \uD0C0\uC785:", r.eventType);
    }
    return e.json({ success: true });
  } catch (r) {
    return console.error("[Webhook] \u274C \uC6F9\uD6C5 \uCC98\uB9AC \uC2E4\uD328:", r.message), e.json({ success: false, error: r.message }, 500);
  }
});
async function en(e, s) {
  const { orderId: r, status: t, paymentKey: a } = s;
  console.log("[Webhook] \uACB0\uC81C \uC0C1\uD0DC \uBCC0\uACBD:", { orderId: r, status: t }), await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(t, JSON.stringify(s), a).run(), (t === "DONE" || t === "completed") && (await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r).run(), console.log("[Webhook] \u2705 \uAC00\uC0C1\uACC4\uC88C \uC785\uAE08 \uC644\uB8CC \uCC98\uB9AC:", r));
}
__name(en, "en");
__name2(en, "en");
async function sn(e, s) {
  const { orderId: r, virtualAccount: t } = s;
  console.log("[Webhook] \uAC00\uC0C1\uACC4\uC88C \uBC1C\uAE09:", { orderId: r, bank: t == null ? void 0 : t.bank, accountNumber: t == null ? void 0 : t.accountNumber }), await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(t == null ? void 0 : t.bank, t == null ? void 0 : t.accountNumber, t == null ? void 0 : t.customerName, t == null ? void 0 : t.dueDate, JSON.stringify(s), r).run(), console.log("[Webhook] \u2705 \uAC00\uC0C1\uACC4\uC88C \uC815\uBCF4 \uC800\uC7A5 \uC644\uB8CC:", r);
}
__name(sn, "sn");
__name2(sn, "sn");
d.post("/api/payments/:paymentKey/cancel", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("paymentKey"), t = await e.req.json(), { cancelReason: a, cancelAmount: n } = t;
    if (console.log("[Payment] \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD:", { paymentKey: r, cancelReason: a, cancelAmount: n }), !a) return e.json({ success: false, error: "\uCDE8\uC18C \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await s.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(r).first();
    if (!o) return e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (o.status === "CANCELED" || o.status === "cancelled") return e.json({ success: false, error: "\uC774\uBBF8 \uCDE8\uC18C\uB41C \uACB0\uC81C\uC785\uB2C8\uB2E4." }, 400);
    const i = o.pg_provider || "tosspayments", c = e.env.TOSS_SECRET_KEY;
    if (!c) return e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    const u = Ha(i, c), l = n && n < o.amount, p = n || o.amount;
    console.log("[Payment] PG \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD \uC911...", { pgProvider: i, paymentKey: r, cancelAmount: p, isPartial: l });
    const m = await u.cancelPayment({ paymentKey: r, cancelReason: a, cancelAmount: p });
    return m.success ? (console.log("[Payment] \u2705 PG \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC:", { paymentKey: r, cancelAmount: p, canceledAt: m.canceledAt }), await s.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED", m.canceledAt || (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(m), r).run(), await s.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(), console.log(`[Payment] \u2705 \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC [${i}]: ${r}`), e.json({ success: true, data: { paymentKey: r, orderId: o.order_id, cancelAmount: p, canceledAt: m.canceledAt, status: "CANCELED" } })) : (console.error(`[Payment] \u274C ${i} \uACB0\uC81C \uCDE8\uC18C \uC2E4\uD328:`, m.error), e.json({ success: false, error: m.error || "\uACB0\uC81C \uCDE8\uC18C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." }, 400));
  } catch (r) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC2E4\uD328:", r.message), e.json({ success: false, error: "\uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
d.get("/api/payments/:paymentKey", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("paymentKey"), t = await s.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(r).first();
    return t ? e.json({ success: true, data: t }) : e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
  } catch (r) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uC870\uD68C \uC2E4\uD328:", r.message), e.json({ success: false, error: "\uACB0\uC81C \uC870\uD68C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
d.get("/api/payments/order/:orderId", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("orderId"), t = await s.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: t.results || [] });
  } catch (r) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", r.message), e.json({ success: false, error: "\uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
d.get("/api/seller/orders", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = await s.prepare(`
      SELECT 
        o.*,
        u.name as user_name,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        oi.seller_id,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `).bind(r.sellerId).all(), a = /* @__PURE__ */ new Map();
    for (const o of t.results) {
      const i = o.id;
      a.has(i) || a.set(i, { id: o.id, user_id: o.user_id, user_name: o.user_name, order_number: o.order_number, status: o.status, total_amount: o.total_amount, shipping_fee: o.shipping_fee, payment_method: o.payment_method, payment_key: o.payment_key, shipping_address: o.shipping_address, shipping_name: o.shipping_name, shipping_phone: o.shipping_phone, delivery_request: o.delivery_request, created_at: o.created_at, updated_at: o.updated_at, items: [] }), o.item_id && a.get(i).items.push({ id: o.item_id, product_id: o.product_id, option_id: o.option_id, quantity: o.quantity, price: o.item_price, seller_id: o.seller_id, product_name: o.product_name, image_url: o.image_url, option_value: o.option_value });
    }
    const n = Array.from(a.values());
    return e.json({ success: true, data: n });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/orders/export", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.query("format") || "csv", a = e.req.query("start_date"), n = e.req.query("end_date");
    let o = `
      SELECT 
        o.order_number,
        o.created_at,
        o.status,
        o.payment_status,
        o.total_amount,
        o.shipping_address,
        o.shipping_name,
        o.shipping_phone,
        o.tracking_number,
        o.carrier,
        u.name as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
    `;
    const i = [r.sellerId];
    a && (o += " AND date(o.created_at) >= ?", i.push(a)), n && (o += " AND date(o.created_at) <= ?", i.push(n)), o += " GROUP BY o.id ORDER BY o.created_at DESC";
    const c = await s.prepare(o).bind(...i).all();
    if (t === "csv") {
      const u = ["\uC8FC\uBB38\uBC88\uD638", "\uC8FC\uBB38\uC77C\uC2DC", "\uC8FC\uBB38\uC0C1\uD0DC", "\uACB0\uC81C\uC0C1\uD0DC", "\uC8FC\uBB38\uAE08\uC561", "\uBC30\uC1A1\uC9C0", "\uC218\uB839\uC778", "\uC5F0\uB77D\uCC98", "\uD0DD\uBC30\uC0AC", "\uC6B4\uC1A1\uC7A5\uBC88\uD638", "\uAD6C\uB9E4\uC790\uBA85", "\uAD6C\uB9E4\uC790\uC774\uBA54\uC77C", "\uAD6C\uB9E4\uC790\uC5F0\uB77D\uCC98"], l = c.results.map((h) => [h.order_number || "", h.created_at ? new Date(h.created_at).toLocaleString("ko-KR") : "", h.status || "", h.payment_status || "", h.total_amount || 0, h.shipping_address || "", h.shipping_name || "", h.shipping_phone || "", h.carrier || "", h.tracking_number || "", h.buyer_name || "", h.buyer_email || "", h.buyer_phone || ""]), m = "\uFEFF" + [u.join(","), ...l.map((h) => h.map((g) => {
        const S = String(g);
        return S.includes(",") || S.includes(`
`) || S.includes('"') ? `"${S.replace(/"/g, '""')}"` : S;
      }).join(","))].join(`
`), E = /* @__PURE__ */ new Date(), _ = `orders_${E.toISOString().split("T")[0]}_${E.getTime()}.csv`;
      return new Response(m, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${encodeURIComponent(_)}"`, "Cache-Control": "no-cache" } });
    } else return e.json({ success: false, error: "Unsupported format" }, 400);
  } catch (t) {
    return console.error("Export error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.patch("/api/seller/orders/:orderNumber/status", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("orderNumber"), { status: a } = await e.req.json();
    if (!["PAY_COMPLETE", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED"].includes(a)) return e.json({ success: false, error: "Invalid status" }, 400);
    const o = await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(t).first();
    if (!o) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id, r.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
    if (await s.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a, t).run(), a === "DELIVERED") try {
      console.log(`[AUTO TAX INVOICE] \uBC30\uC1A1\uC644\uB8CC \uAC10\uC9C0: ${t}, \uC790\uB3D9 \uBC1C\uD589 \uC2DC\uC791...`);
      const c = await s.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(t).first();
      if (c != null && c.buyer_business_number && (c != null && c.buyer_business_name)) {
        console.log(`[AUTO TAX INVOICE] \uC0AC\uC5C5\uC790 \uAD6C\uB9E4 \uD655\uC778: ${c.buyer_business_number}`);
        const u = await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();
        if (!u) console.warn(`[AUTO TAX INVOICE] \uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4 \uBBF8\uC2B9\uC778: seller_id=${r.sellerId}`), await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.', CURRENT_TIMESTAMP)
            `).bind(t, r.sellerId).run();
        else {
          console.log(`[AUTO TAX INVOICE] \uBC1C\uD589 \uC2DC\uC791: orderNumber=${t}`);
          const l = await s.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(), p = Number(c.total_amount), m = Math.floor(p / 1.1), E = p - m, _ = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), h = Math.random().toString(36).substring(2, 8).toUpperCase(), g = `${_}-${h}`, y = (await s.prepare(`
              INSERT INTO tax_invoices (
                seller_id, order_number, invoice_number, issue_date,
                supplier_business_number, supplier_business_name, supplier_ceo_name,
                supplier_address, supplier_business_type, supplier_business_category,
                supplier_email, supplier_phone,
                buyer_business_number, buyer_business_name, buyer_ceo_name,
                buyer_address, buyer_business_type, buyer_business_category,
                buyer_email, buyer_phone,
                supply_price, tax_amount, total_amount,
                status, api_provider, nts_confirm_number,
                created_at, updated_at
              ) VALUES (?, ?, ?, DATE('now'),
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                'issued', 'barobill', ?,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )
            `).bind(r.sellerId, t, g, u.business_number, u.business_name, u.ceo_name, u.address || "", u.business_type || "", u.business_category || "", u.email || "", u.phone || "", c.buyer_business_number, c.buyer_business_name, c.buyer_ceo_name || "", c.buyer_business_address || "", c.buyer_business_type || "", c.buyer_business_category || "", c.buyer_email || "", c.buyer_phone || "", m, E, p, `AUTO-${Date.now()}-${h}`).run()).meta.last_row_id;
          if (l.results.length > 0) {
            const j = l.results.map((O) => {
              const L = Math.floor(Number(O.price) * Number(O.quantity) / 1.1), U = Number(O.price) * Number(O.quantity) - L;
              return s.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(y, O.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", O.quantity, O.price, L, U, O.option_name || "");
            });
            await s.batch(j);
          }
          await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(t, r.sellerId, y).run(), console.log(`[AUTO TAX INVOICE] \u2705 \uBC1C\uD589 \uC644\uB8CC: invoice_id=${y}, invoice_number=${g}`);
        }
      } else console.log(`[AUTO TAX INVOICE] \uC77C\uBC18 \uAD6C\uB9E4 (\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uC5C6\uC74C): ${t}`);
    } catch (c) {
      console.error("[AUTO TAX INVOICE] \uBC1C\uD589 \uC2E4\uD328:", c);
      try {
        await s.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(t, r.sellerId, c.message).run();
      } catch (u) {
        console.error("[AUTO TAX INVOICE] \uB85C\uADF8 \uAE30\uB85D \uC2E4\uD328:", u);
      }
    }
    try {
      const c = await s.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(t).first();
      if (c && c.user_id) {
        const l = { PREPARING: "preparing", SHIPPING: "shipping", DELIVERED: "delivered" }[a];
        l && await Pr(s, c.user_id, t, l);
      }
    } catch (c) {
      console.error("[Order Status] Notification error:", c);
    }
    return e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.put("/api/seller/orders/:orderNumber/tracking", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("orderNumber"), { courier: a, tracking_number: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Courier and tracking number are required" }, 400);
    const o = await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(t).first();
    if (!o) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id, r.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
    await s.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a, n, t).run();
    try {
      const c = await s.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(t).first();
      c && c.user_id && await Pr(s, c.user_id, t, "shipping", a, n);
    } catch (c) {
      console.error("[Tracking] Notification error:", c);
    }
    return e.json({ success: true, message: "Tracking information updated" });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/orders/:orderNumber/refund", A, async (e) => {
  const { DB: s } = e.env, r = e.req.param("orderNumber"), { reason: t } = await e.req.json();
  try {
    const a = await s.prepare(`
      SELECT id, order_number, user_id, status, total_amount,
             payment_key, payment_status, shipping_address, shipping_name,
             shipping_phone, created_at, updated_at
      FROM orders 
      WHERE order_number = ?
    `).bind(r).first();
    return a ? ["paid", "preparing", "shipped", "delivered"].includes(a.status) ? a.status === "refunded" || a.status === "cancelled" ? e.json({ success: false, error: "\uC774\uBBF8 \uD658\uBD88 \uB610\uB294 \uCDE8\uC18C\uB41C \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400) : (await s.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind("refunded", r).run(), e.json({ success: true, message: "\uD658\uBD88 \uC694\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uACE0\uAC1D\uC13C\uD130(0507-0177-0432)\uC5D0\uC11C \uCC98\uB9AC \uC608\uC815\uC785\uB2C8\uB2E4.", requiresManualProcessing: true })) : e.json({ success: false, error: "\uD658\uBD88\uC774 \uBD88\uAC00\uB2A5\uD55C \uC8FC\uBB38 \uC0C1\uD0DC\uC785\uB2C8\uB2E4." }, 400) : e.json({ success: false, error: "Order not found" }, 404);
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/admin/orders", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();
    return e.json({ success: true, data: t.results });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/sellers", async (e) => {
  const { DB: s } = e.env, { limit: r = "20", offset: t = "0" } = e.req.query();
  try {
    const a = `sellers:list:${r}:${t}`, n = ye(a);
    if (n) return e.executionCtx.waitUntil((async () => {
      try {
        const i = await Qs(s, parseInt(r), parseInt(t));
        X(a, i, 3600);
      } catch (i) {
        console.error("[Cache Revalidate] Sellers error:", i);
      }
    })()), e.json({ success: true, data: n, cached: true });
    const o = await Qs(s, parseInt(r), parseInt(t));
    return X(a, o, 3600), e.json({ success: true, data: o, cached: false });
  } catch (a) {
    return console.error("[API] Sellers list error:", a), e.json({ success: false, error: `\uC140\uB7EC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${a.message}` }, 500);
  }
});
async function Qs(e, s, r) {
  const t = `
    SELECT id, business_name, name as display_name, 
           commission_rate, created_at
    FROM sellers 
    WHERE is_active = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, { results: a } = await e.prepare(t).bind(s, r).all();
  return a;
}
__name(Qs, "Qs");
__name2(Qs, "Qs");
d.get("/api/admin/sellers", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();
    return e.json({ success: true, data: t.results });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/admin/sellers", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { username: t, password: a, name: n, email: o, phone: i, business_name: c, business_number: u } = await e.req.json();
    if (!t || !a || !n || !o || !c) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (await s.prepare("SELECT id FROM sellers WHERE username = ?").bind(t).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC544\uC774\uB514\uC785\uB2C8\uB2E4" }, 400);
    if (await s.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
    const m = `$2a$10$placeholder_hash_for_${a}`, E = await s.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(t, m, n, o, i || null, c, u || null, r.adminId).run();
    return e.json({ success: true, data: { id: E.meta.last_row_id, username: t, name: n, email: o, business_name: c } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.put("/api/admin/sellers/:id", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), { name: a, email: n, phone: o, business_name: i, business_number: c, is_active: u, status: l } = await e.req.json();
    return await s.prepare("SELECT id FROM sellers WHERE id = ?").bind(t).first() ? (await s.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i, c || null, u, l, t).run(), e.json({ success: true })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.delete("/api/admin/sellers/:id", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), a = await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(t).first();
    return a ? (await s.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(), await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(t).run(), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.username}'\uC758 \uB85C\uADF8\uC778 \uAD8C\uD55C\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4` })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/admin/sellers/:id/reset-password", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), { new_password: a } = await e.req.json();
    if (!a || a.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const n = await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(t).first();
    if (!n) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = `$2a$10$placeholder_hash_for_${a}`;
    return await s.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o, t).run(), await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(t).run(), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.username}'\uC758 \uBE44\uBC00\uBC88\uD638\uAC00 \uC7AC\uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4` });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.patch("/api/admin/sellers/:id/commission", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), { commission_rate: a } = await e.req.json();
    if (a == null) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = parseFloat(a);
    if (isNaN(n) || n < 0 || n > 100) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC740 0\uC5D0\uC11C 100 \uC0AC\uC774\uC758 \uAC12\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const o = await s.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(t).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const i = o.commission_rate || 10;
    return await s.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n, t).run(), console.log(`\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD: \uD310\uB9E4\uC790 ${o.username} (ID: ${t}), ${i}% \u2192 ${n}%`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${o.username}'\uC758 \uC218\uC218\uB8CC\uC728\uC774 ${i}%\uC5D0\uC11C ${n}%\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: t, seller_username: o.username, old_commission_rate: i, new_commission_rate: n } });
  } catch (t) {
    return console.error("\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.patch("/api/admin/sellers/:id/approve", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), a = await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(t).first();
    return a ? a.status === "approved" ? e.json({ success: false, error: "\uC774\uBBF8 \uC2B9\uC778\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400) : (await s.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(r.adminId, t).run(), console.log(`\uC140\uB7EC \uC2B9\uC778: ${a.username} (ID: ${t}) by Admin ID: ${r.adminId}`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.name}'\uB2D8\uC774 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: t, seller_username: a.username, seller_name: a.name, status: "approved", approved_at: (/* @__PURE__ */ new Date()).toISOString() } })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return console.error("\uC140\uB7EC \uC2B9\uC778 \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.patch("/api/admin/sellers/:id/reject", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), { reason: a } = await e.req.json();
    if (!a) return e.json({ success: false, error: "\uAC70\uBD80 \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(t).first();
    return n ? n.status === "rejected" ? e.json({ success: false, error: "\uC774\uBBF8 \uAC70\uBD80\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400) : (await s.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, r.adminId, t).run(), console.log(`\uC140\uB7EC \uAC70\uBD80: ${n.username} (ID: ${t}), \uC0AC\uC720: ${a}`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.name}'\uB2D8\uC758 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: t, seller_username: n.username, seller_name: n.name, status: "rejected", rejection_reason: a, rejected_at: (/* @__PURE__ */ new Date()).toISOString() } })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return console.error("\uC140\uB7EC \uAC70\uBD80 \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/admin/sellers/pending", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();
    return e.json({ success: true, data: t.results, count: t.results.length });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/public/seller/:sellerId", async (e) => {
  const { DB: s, CACHE_KV: r } = e.env;
  try {
    const t = e.req.param("sellerId"), a = `public:seller:${t}`, n = await Ka(r, a);
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await s.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(t).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const i = await s.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(t).all(), c = await s.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(t).all(), u = await s.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(t).all(), l = await s.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(t).first(), p = { profile: o, live_streams: i.results, scheduled_streams: c.results, products: u.results, stats: l };
    return await Ze(r, a, p, 60, false), e.json({ success: true, data: p });
  } catch (t) {
    return console.error("\uC140\uB7EC \uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/public/seller/username/:username", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("username"), t = await s.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();
    return t ? e.json({ success: true, data: { seller_id: t.id } }) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uC140\uB7EC \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/admin/settlement/stats", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { period: t } = e.req.query();
    let a = "";
    const n = /* @__PURE__ */ new Date();
    switch (t) {
      case "today":
        a = `AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;
        break;
      case "week":
        a = `AND DATE(o.created_at) >= '${new Date(n.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0]}'`;
        break;
      case "month":
        a = `AND DATE(o.created_at) >= '${new Date(n.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0]}'`;
        break;
      default:
        a = "";
    }
    const o = await s.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(seller_amount), 0) as total_seller_amount
      FROM orders o
      WHERE payment_status = 'completed' 
        AND is_cancelled = 0
        ${a}
    `).first(), i = await s.prepare(`
      SELECT 
        s.id as seller_id,
        s.username as seller_name,
        s.business_name,
        s.commission_rate,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_sales,
        COALESCE(SUM(o.commission_amount), 0) as commission_amount,
        COALESCE(SUM(o.seller_amount), 0) as seller_amount,
        SUM(CASE WHEN o.settlement_status = 'pending' THEN o.seller_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN o.settlement_status = 'completed' THEN o.seller_amount ELSE 0 END) as settled_amount
      FROM sellers s
      LEFT JOIN orders o ON s.id = o.seller_id 
        AND o.payment_status = 'completed' 
        AND o.is_cancelled = 0
        ${a}
      GROUP BY s.id
      HAVING order_count > 0
      ORDER BY total_sales DESC
    `).all();
    return e.json({ success: true, data: { overview: o, sellers: i.results, period: t || "all" } });
  } catch (t) {
    return console.error("\uC815\uC0B0 \uD1B5\uACC4 \uC870\uD68C \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/admin/settlement/records", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { seller_id: t, period: a, status: n } = e.req.query();
    let o = ["payment_status = 'completed'", "is_cancelled = 0"];
    const i = [];
    t && (o.push("o.seller_id = ?"), i.push(t)), n && (o.push("o.settlement_status = ?"), i.push(n));
    const c = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const p = c.toISOString().split("T")[0];
        o.push(`DATE(o.created_at) = '${p}'`);
        break;
      case "week":
        const m = new Date(c.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${m}'`);
        break;
      case "month":
        const E = new Date(c.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${E}'`);
        break;
    }
    const u = o.length > 0 ? `WHERE ${o.join(" AND ")}` : "", l = await s.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.seller_id,
        s.username as seller_name,
        s.business_name,
        o.total_amount,
        o.commission_rate,
        o.commission_amount,
        o.seller_amount,
        o.settlement_status,
        o.settled_at,
        o.created_at,
        u.name as user_name
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      ${u}
      ORDER BY o.created_at DESC
      LIMIT 100
    `).bind(...i).all();
    return e.json({ success: true, data: l.results });
  } catch (t) {
    return console.error("\uC815\uC0B0 \uB0B4\uC5ED \uC870\uD68C \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.patch("/api/admin/settlement/:orderId/status", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("orderId"), { status: a } = await e.req.json();
    if (!["pending", "completed"].includes(a)) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC815\uC0B0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4" }, 400);
    const n = await s.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(t).first();
    return n ? (await s.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a === "completed" ? "datetime('now')" : "NULL"}
      WHERE id = ?
    `).bind(a, t).run(), console.log(`\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD: \uC8FC\uBB38 ${n.order_number}, ${n.settlement_status} \u2192 ${a}`), e.json({ success: true, message: `\uC815\uC0B0 \uC0C1\uD0DC\uAC00 '${a}'\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { order_id: t, order_number: n.order_number, old_status: n.settlement_status, new_status: a } })) : e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return console.error("\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/admin/settlement/batch-complete", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { order_ids: t } = await e.req.json();
    if (!Array.isArray(t) || t.length === 0) return e.json({ success: false, error: "\uC8FC\uBB38 ID \uBC30\uC5F4\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    let a = 0, n = 0;
    for (const o of t) try {
      await s.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(), a++;
    } catch (i) {
      n++, console.error(`\uC8FC\uBB38 ${o} \uC815\uC0B0 \uCC98\uB9AC \uC2E4\uD328:`, i);
    }
    return e.json({ success: true, message: `${a}\uAC74 \uC815\uC0B0 \uC644\uB8CC, ${n}\uAC74 \uC2E4\uD328`, data: { total: t.length, success: a, failed: n } });
  } catch (t) {
    return console.error("\uC77C\uAD04 \uC815\uC0B0 \uCC98\uB9AC \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/admin/settlement/export-csv", async (e) => {
  const { DB: s } = e.env, r = await P(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { seller_id: t, period: a } = e.req.query();
    let n = ["payment_status = 'completed'", "is_cancelled = 0"];
    const o = [];
    t && (n.push("o.seller_id = ?"), o.push(t));
    const i = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const _ = i.toISOString().split("T")[0];
        n.push(`DATE(o.created_at) = '${_}'`);
        break;
      case "week":
        const h = new Date(i.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${h}'`);
        break;
      case "month":
        const g = new Date(i.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${g}'`);
        break;
    }
    const c = n.length > 0 ? `WHERE ${n.join(" AND ")}` : "", l = (await s.prepare(`
      SELECT 
        o.order_number as '\uC8FC\uBB38\uBC88\uD638',
        o.created_at as '\uC8FC\uBB38\uC77C\uC2DC',
        s.username as '\uD310\uB9E4\uC790ID',
        s.business_name as '\uC0AC\uC5C5\uC790\uBA85',
        u.name as '\uAD6C\uB9E4\uC790\uBA85',
        o.total_amount as '\uCD1D\uAE08\uC561',
        o.commission_rate as '\uC218\uC218\uB8CC\uC728',
        o.commission_amount as '\uC218\uC218\uB8CC',
        o.seller_amount as '\uC815\uC0B0\uAE08\uC561',
        o.settlement_status as '\uC815\uC0B0\uC0C1\uD0DC',
        o.settled_at as '\uC815\uC0B0\uC77C\uC2DC'
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      ${c}
      ORDER BY o.created_at DESC
    `).bind(...o).all()).results;
    if (l.length === 0) return e.json({ success: false, error: "\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const p = Object.keys(l[0]);
    let m = p.join(",") + `
`;
    l.forEach((_) => {
      const h = p.map((g) => {
        const S = _[g];
        if (S == null) return "";
        const y = String(S);
        return y.includes(",") || y.includes('"') || y.includes(`
`) ? `"${y.replace(/"/g, '""')}"` : y;
      });
      m += h.join(",") + `
`;
    });
    const E = "\uFEFF";
    return new Response(E + m, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${a || "all"}_${Date.now()}.csv"` } });
  } catch (t) {
    return console.error("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/orders/create", A, async (e) => {
  const { DB: s } = e.env;
  try {
    const { userId: r, cartItems: t, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i, buyerBusinessNumber: c, buyerBusinessName: u, buyerCeoName: l } = await e.req.json();
    console.log("\uC8FC\uBB38 \uC0DD\uC131 \uC694\uCCAD:", { userId: r, cartItems: t == null ? void 0 : t.length, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i });
    let p = 10;
    if (o) {
      const R = await s.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();
      R && R.commission_rate !== null && (p = R.commission_rate);
    }
    console.log("\uC218\uC218\uB8CC\uC728:", { sellerId: o, commissionRate: p });
    const m = Math.floor(a * (p / 100)), E = a - m;
    let _ = null;
    if (n) {
      const R = await s.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(n, r).first();
      if (!R) return e.json({ success: false, error: "\uBC30\uC1A1\uC9C0 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
      _ = R;
    }
    if (!r) return e.json({ success: false, error: "User ID is required. Please login with Kakao first." }, 401);
    const h = r, g = /* @__PURE__ */ new Date(), S = g.getFullYear().toString().slice(-2), y = (g.getMonth() + 1).toString().padStart(2, "0"), j = g.getDate().toString().padStart(2, "0"), O = `${S}${y}${j}`, L = Math.random().toString(36).substring(2, 7).toUpperCase(), U = `ORD-${O}-${L}`, N = t.map((R) => R.product_id), D = N.map(() => "?").join(","), M = await s.prepare(`
      SELECT id, stock FROM products WHERE id IN (${D})
    `).bind(...N).all(), $ = new Map(M.results.map((R) => [R.id, R.stock]));
    for (const R of t) {
      const we = $.get(R.product_id);
      if (we === void 0) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${R.product_id})` }, 400);
      if (we < R.quantity) return e.json({ success: false, error: `\uC7AC\uACE0\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4 (\uC0C1\uD488 ID: ${R.product_id})` }, 400);
    }
    const q = (await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(U, h, a, "pending", o || null, p, m, E, n || null, (_ == null ? void 0 : _.recipient_name) || null, (_ == null ? void 0 : _.phone) || null, _ != null && _.address ? `${_.address} ${_.address_detail}` : null, (_ == null ? void 0 : _.postal_code) || null, i ? 1 : 0, c || null, u || null, l || null).run()).meta.last_row_id, V = t.map((R) => s.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(q, R.product_id, R.option_id || null, R.quantity, R.price_snapshot || R.price)), Q = t.map((R) => s.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(R.quantity, R.product_id));
    await s.batch([...V, ...Q]);
    try {
      const R = t.map((H) => H.product_id), we = R.map(() => "?").join(","), x = await s.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${we})
      `).bind(...R).all();
      for (const H of x.results) {
        const pe = H.stock_alert_threshold || 5, ne = H.stock;
        ne <= pe && H.seller_id && (await Ya(s, H.seller_id, H.name, ne, pe), console.log(`[Low Stock Alert] ${H.name}: ${ne} <= ${pe}`));
      }
    } catch (R) {
      console.error("[Low Stock Alert] Error:", R);
    }
    return console.log("\uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC:", { orderId: q, orderNumber: U }), e.json({ success: true, orderId: q, orderNumber: U, totalAmount: a });
  } catch (r) {
    return console.error("\uC8FC\uBB38 \uC0DD\uC131 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/orders/:orderNumber/refund", w(), A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("orderNumber"), { reason: t } = await e.req.json();
    console.log("[Order Refund] \uD658\uBD88 \uC694\uCCAD:", { orderNumber: r, reason: t });
    const a = await s.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(r).first();
    if (!a) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (a.payment_status === "cancelled") return e.json({ success: false, error: "\uC774\uBBF8 \uCDE8\uC18C\uB41C \uC8FC\uBB38\uC785\uB2C8\uB2E4" }, 400);
    await s.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(t || "\uAD6C\uB9E4\uC790 \uC694\uCCAD", r).run(), console.log("[Order Refund] \uC8FC\uBB38 \uC0C1\uD0DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC:", r);
    const n = await s.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();
    if (n.results.length > 0) {
      const o = n.results.map((i) => s.prepare(`
          UPDATE products 
          SET stock = stock + ?,
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(i.quantity, i.product_id));
      await s.batch(o), console.log("[Order Refund] \uC7AC\uACE0 \uBCF5\uAD6C \uC644\uB8CC:", { items: n.results.length });
    }
    return console.log("[Order Refund] \u2705 \uD658\uBD88 \uC644\uB8CC:", { orderNumber: r, reason: t }), e.json({ success: true, message: "\uC8FC\uBB38\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: { orderNumber: r, cancelDate: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (r) {
    return console.error("[Order Refund] Error:", r), e.json({ success: false, error: r.message || "\uC8FC\uBB38 \uCDE8\uC18C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
d.use("/api/seller/*", A);
d.get("/api/seller/sales", w(), async (e) => {
  try {
    const { DB: s } = e.env, r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const t = await Ke(e.env.SESSION_KV, r);
    if (!t) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (t.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = t.seller_id || t.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], u = await s.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(a).first();
    if (!u) return e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const l = await s.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(seller_amount), 0) as net_amount
      FROM orders
      WHERE seller_id = ?
        AND payment_status = 'approved'
        AND DATE(created_at) >= DATE(?)
        AND DATE(created_at) <= DATE(?)
    `).bind(a, i, c).first(), p = await s.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.commission_amount,
        o.seller_amount,
        o.payment_status,
        o.created_at,
        u.name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.seller_id = ?
        AND DATE(o.created_at) >= DATE(?)
        AND DATE(o.created_at) <= DATE(?)
      ORDER BY o.created_at DESC
      LIMIT 100
    `).bind(a, i, c).all();
    return e.json({ success: true, data: { seller: u, stats: l, orders: (p == null ? void 0 : p.results) || [] } });
  } catch (s) {
    return console.error("Seller sales query error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/seller/settlement-csv", w(), async (e) => {
  try {
    const { DB: s } = e.env, r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const t = await Ke(e.env.SESSION_KV, r);
    if (!t) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (t.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = t.seller_id || t.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], u = await s.prepare(`
      SELECT 
        o.order_number,
        o.total_amount,
        o.commission_amount,
        o.seller_amount,
        o.payment_status,
        o.status,
        o.created_at,
        u.name as user_name,
        o.buyer_business_name,
        o.buyer_business_number,
        ti.id as tax_invoice_id,
        ti.invoice_number,
        ti.issue_date,
        ti.status as tax_invoice_status,
        ti.nts_confirm_number
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN tax_invoices ti ON o.order_number = ti.order_number
      WHERE o.seller_id = ?
        AND o.payment_status IN ('approved', 'completed')
        AND DATE(o.created_at) >= DATE(?)
        AND DATE(o.created_at) <= DATE(?)
      ORDER BY o.created_at DESC
    `).bind(a, i, c).all();
    let l = `\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC8FC\uBB38\uC790,\uCD1D\uAE08\uC561,\uC218\uC218\uB8CC(10%),\uC815\uC0B0\uAE08\uC561(90%),\uC8FC\uBB38\uC0C1\uD0DC,\uC0AC\uC5C5\uC790\uBA85,\uC0AC\uC5C5\uC790\uBC88\uD638,\uC138\uAE08\uACC4\uC0B0\uC11C\uBC88\uD638,\uBC1C\uD589\uC77C\uC790,\uACC4\uC0B0\uC11C\uC0C1\uD0DC,\uAD6D\uC138\uCCAD\uC2B9\uC778\uBC88\uD638
`;
    for (const p of (u == null ? void 0 : u.results) || []) {
      const m = p.status === "delivered" ? "\uBC30\uC1A1\uC644\uB8CC" : p.status === "shipped" ? "\uBC30\uC1A1\uC911" : p.status === "preparing" ? "\uC0C1\uD488\uC900\uBE44\uC911" : p.status === "paid" ? "\uACB0\uC81C\uC644\uB8CC" : "\uB300\uAE30\uC911", E = p.buyer_business_name || "-", _ = p.buyer_business_number || "-", h = p.invoice_number || "-", g = p.issue_date || "-", S = p.tax_invoice_status === "issued" ? "\uBC1C\uD589\uC644\uB8CC" : p.tax_invoice_status === "cancelled" ? "\uCDE8\uC18C" : "-", y = p.nts_confirm_number || "-";
      l += `${p.order_number},${p.created_at},${p.user_name || "\uC775\uBA85"},${p.total_amount},${p.commission_amount},${p.seller_amount},${m},${E},${_},${h},${g},${S},${y}
`;
    }
    return new Response(l, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${i}_${c}.csv"` } });
  } catch (s) {
    return console.error("CSV download error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/tax-invoices/issue", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { order_number: t } = await e.req.json();
    if (!t) return e.json({ success: false, error: "\uC8FC\uBB38\uBC88\uD638\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const a = await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(t).first();
    if (!a) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (!a.issue_tax_invoice) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589\uC774 \uC694\uCCAD\uB418\uC9C0 \uC54A\uC740 \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400);
    const n = await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(r.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC2B9\uC778\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778\uC744 \uAE30\uB2E4\uB824\uC8FC\uC138\uC694." }, 400);
    const o = await s.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(), i = Number(a.total_amount), c = Math.floor(i / 1.1), u = i - c, l = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], p = `${l}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, m = Yt(n, a, o.results);
    let E, _, h;
    try {
      E = await Vt(m), _ = E.ntsConfirmNumber, h = E.invoiceKey, console.log("\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC131\uACF5:", { ntsConfirmNumber: _, invoiceKey: h, mockMode: ze() });
    } catch (y) {
      console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", y), _ = "FAILED", h = null;
    }
    const S = (await s.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r.sellerId, t, "tax", p, l, n.business_number, n.business_name, n.ceo_name, n.address, n.business_type, n.business_category, a.buyer_business_number, a.buyer_business_name, a.buyer_ceo_name, c, u, i, _ === "FAILED" ? "failed" : "issued", ze() ? "mock" : "barobill", h, _).run()).meta.last_row_id;
    for (const y of o.results) {
      const j = Math.floor(Number(y.price) * Number(y.quantity) / 1.1), O = Number(y.price) * Number(y.quantity) - j;
      await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(S, y.id, y.product_name, y.quantity, y.price, j, O).run();
    }
    return e.json({ success: true, data: { invoice_id: S, invoice_number: p, issue_date: l, total_amount: i, supply_price: c, tax_amount: u, status: _ === "FAILED" ? "failed" : "issued", nts_confirm_number: _, api_invoice_key: h, mock_mode: ze(), message: _ === "FAILED" ? "\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328. \uB098\uC911\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694." : ze() ? "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (Mock Mode - \uC2E4\uC81C \uBC1C\uD589 \uC544\uB2D8)" : "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4." } });
  } catch (t) {
    return console.error("\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC624\uB958:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/tax-invoices", async (e) => {
  var t;
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { start_date: a, end_date: n, status: o } = e.req.query();
    let i = `
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;
    const c = [r.sellerId];
    a && (i += " AND issue_date >= ?", c.push(a)), n && (i += " AND issue_date <= ?", c.push(n)), o && (i += " AND status = ?", c.push(o)), i += " ORDER BY created_at DESC";
    const u = await s.prepare(i).bind(...c).all();
    return e.json({ success: true, data: u.results || [], total: ((t = u.results) == null ? void 0 : t.length) || 0 });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/seller/tax-invoices/:id", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), a = await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(t, r.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = await s.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(t).all();
    return e.json({ success: true, data: { ...a, items: n.results || [] } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/seller/tax-invoices/:id/cancel", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("id"), { reason: a } = await e.req.json(), n = await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(t, r.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const o = new Date(n.issue_date), i = new Date(o);
    if (i.setDate(i.getDate() + 1), /* @__PURE__ */ new Date() > i) return e.json({ success: false, error: "\uBC1C\uD589\uC77C \uC775\uC77C\uAE4C\uC9C0\uB9CC \uCDE8\uC18C \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 400);
    try {
      if (n.api_invoice_key && !ze()) {
        const u = await s.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(r.sellerId).first();
        u && u.business_number && await Kt(u.business_number, n.api_invoice_key, a || "\uD310\uB9E4\uC790 \uC694\uCCAD");
      }
    } catch (u) {
      console.error("\uBC14\uB85C\uBE4C \uCDE8\uC18C API \uD638\uCD9C \uC2E4\uD328:", u);
    }
    return await s.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(), e.json({ success: true, message: "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/tax-invoices/auto-issue-logs", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { status: t, limit: a = 50 } = e.req.query();
    let n = `
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;
    const o = [r.sellerId];
    t && (n += " AND log.status = ?", o.push(t)), n += " ORDER BY log.created_at DESC LIMIT ?", o.push(Number(a));
    const i = await s.prepare(n).bind(...o).all();
    return e.json({ success: true, data: i.results });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/seller/tax-invoices/retry/:orderNumber", async (e) => {
  const { DB: s } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const t = e.req.param("orderNumber");
    console.log(`[TAX INVOICE RETRY] \uC7AC\uC2DC\uB3C4 \uC2DC\uC791: ${t}`);
    const a = await s.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(t, r.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uC7AC\uC2DC\uB3C4\uD560 \uC2E4\uD328 \uB85C\uADF8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = Number(a.retry_count || 0);
    if (n >= 3) return e.json({ success: false, error: "\uCD5C\uB300 \uC7AC\uC2DC\uB3C4 \uD69F\uC218(3\uD68C)\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4." }, 400);
    const o = await s.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(t).first();
    if (!o) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (!o.buyer_business_number || !o.buyer_business_name) return e.json({ success: false, error: "\uC8FC\uBB38\uC5D0 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 400);
    const i = await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();
    if (!i) return e.json({ success: false, error: "\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const c = await s.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(), u = Number(o.total_amount), l = Math.floor(u / 1.1), p = u - l, m = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), E = Math.random().toString(36).substring(2, 8).toUpperCase(), _ = `${m}-${E}`, g = (await s.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name,
        supplier_address, supplier_business_type, supplier_business_category,
        supplier_email, supplier_phone,
        buyer_business_number, buyer_business_name, buyer_ceo_name,
        buyer_address, buyer_business_type, buyer_business_category,
        buyer_email, buyer_phone,
        supply_price, tax_amount, total_amount,
        status, api_provider, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, DATE('now'),
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        'issued', 'barobill', ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).bind(r.sellerId, t, _, i.business_number, i.business_name, i.ceo_name, i.address || "", i.business_type || "", i.business_category || "", i.email || "", i.phone || "", o.buyer_business_number, o.buyer_business_name, o.buyer_ceo_name || "", o.buyer_business_address || "", o.buyer_business_type || "", o.buyer_business_category || "", o.buyer_email || "", o.buyer_phone || "", l, p, u, `RETRY-${Date.now()}-${E}`).run()).meta.last_row_id;
    for (const S of c.results) {
      const y = Math.floor(Number(S.price) * Number(S.quantity) / 1.1), j = Number(S.price) * Number(S.quantity) - y;
      await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(g, S.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", S.quantity, S.price, y, j, S.option_name || "").run();
    }
    return await s.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(t, r.sellerId, g, n + 1).run(), await s.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n + 1, a.id).run(), console.log(`[TAX INVOICE RETRY] \u2705 \uC7AC\uC2DC\uB3C4 \uC131\uACF5: invoice_id=${g}, retry_count=${n + 1}`), e.json({ success: true, data: { invoice_id: g, invoice_number: _, retry_count: n + 1 } });
  } catch (t) {
    console.error("[TAX INVOICE RETRY] \uC7AC\uC2DC\uB3C4 \uC2E4\uD328:", t);
    try {
      const a = e.req.param("orderNumber"), n = await s.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a, r.sellerId).first(), o = Number((n == null ? void 0 : n.retry_count) || 0);
      await s.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a, r.sellerId, t.message, o + 1).run();
    } catch (a) {
      console.error("[TAX INVOICE RETRY] \uB85C\uADF8 \uAE30\uB85D \uC2E4\uD328:", a);
    }
    return e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/live/:id", async (e) => {
  try {
    const s = new URL("/static/live.html", e.req.url);
    let t = await (await fetch(s.toString())).text();
    const n = `<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY || "975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;
    return t = t.replace("<!-- Scripts -->", `<!-- Scripts -->
    ${n}`), console.log("[Live Page] Environment variables injected"), new Response(t, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (s) {
    return console.error("Error serving live page:", s), new Response("<h1>Error loading live page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
d.get("/cart", async (e) => {
  try {
    const s = new URL("/static/cart.html", e.req.url);
    let t = await (await fetch(s.toString())).text();
    return t = t.replace("%%NICEPAY_CLIENT_ID%%", e.env.NICEPAY_CLIENT_ID || "S2_d5ec29558e9d46419bf01eb828ca0834"), t = t.replace("%%NICEPAY_MID%%", e.env.NICEPAY_MID || "nictest00m"), new Response(t, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (s) {
    return console.error("Error serving cart page:", s), new Response("<h1>Error loading cart page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
d.get("/my-orders", async (e) => {
  try {
    const s = new URL("/static/my-orders.html", e.req.url), t = await (await fetch(s.toString())).text();
    return new Response(t, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (s) {
    return console.error("Error serving my orders page:", s), new Response("<h1>Error loading orders page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
d.get("/payment-result", async (e) => {
  try {
    const s = new URL("/payment-result.html", e.req.url), t = await (await fetch(s.toString())).text();
    return new Response(t, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (s) {
    return console.error("Error serving payment result page:", s), new Response("<h1>Error loading payment result page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
d.get("/api/seller/profile", async (e) => {
  const { DB: s } = e.env, r = e.req.header("X-Session-Token");
  if (!r) return e.json({ success: false, error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const t = await s.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(r).first();
    if (!t || !t.seller_id) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await s.prepare(`
      SELECT 
        id,
        username,
        name,
        email,
        phone,
        business_name,
        business_number,
        profile_image,
        bio,
        sns_instagram,
        sns_youtube,
        sns_facebook,
        sns_twitter,
        website_url,
        kakao_chat_link,
        status,
        created_at
      FROM sellers 
      WHERE id = ?
    `).bind(t.seller_id).first();
    return a ? e.json({ success: true, data: a }) : e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return console.error("\uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.patch("/api/seller/profile", async (e) => {
  const { DB: s } = e.env, r = e.req.header("X-Session-Token");
  if (!r) return e.json({ success: false, error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const t = await s.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(r).first();
    if (!t || !t.seller_id) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const { profile_image: a, bio: n, sns_instagram: o, sns_youtube: i, sns_facebook: c, sns_twitter: u, website_url: l, kakao_chat_link: p } = await e.req.json(), m = [], E = [];
    if (a !== void 0 && (m.push("profile_image = ?"), E.push(a)), n !== void 0 && (m.push("bio = ?"), E.push(n)), o !== void 0 && (m.push("sns_instagram = ?"), E.push(o)), i !== void 0 && (m.push("sns_youtube = ?"), E.push(i)), c !== void 0 && (m.push("sns_facebook = ?"), E.push(c)), u !== void 0 && (m.push("sns_twitter = ?"), E.push(u)), l !== void 0 && (m.push("website_url = ?"), E.push(l)), p !== void 0 && (m.push("kakao_chat_link = ?"), E.push(p)), m.length === 0) return e.json({ success: false, error: "\uC218\uC815\uD560 \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    m.push("updated_at = datetime('now')"), E.push(t.seller_id), await s.prepare(`
      UPDATE sellers 
      SET ${m.join(", ")}
      WHERE id = ?
    `).bind(...E).run();
    const _ = await s.prepare(`
      SELECT 
        id,
        username,
        name,
        email,
        phone,
        business_name,
        business_number,
        profile_image,
        bio,
        sns_instagram,
        sns_youtube,
        sns_facebook,
        sns_twitter,
        website_url,
        kakao_chat_link,
        status,
        created_at
      FROM sellers 
      WHERE id = ?
    `).bind(t.seller_id).first();
    return e.json({ success: true, message: "\uD504\uB85C\uD544\uC774 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: _ });
  } catch (t) {
    return console.error("\uD504\uB85C\uD544 \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/public/:sellerId", async (e) => {
  const { DB: s } = e.env, r = e.req.param("sellerId");
  try {
    const t = await s.prepare(`
      SELECT 
        id,
        username,
        name,
        email,
        phone,
        business_name,
        business_number,
        profile_image,
        bio,
        sns_instagram,
        sns_youtube,
        sns_facebook,
        sns_twitter,
        website_url,
        is_active,
        status,
        created_at
      FROM sellers 
      WHERE id = ? AND is_active = 1 AND status = 'approved'
    `).bind(r).first();
    return t ? e.json({ success: true, data: t }) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return console.error("\uC140\uB7EC \uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/:sellerId/streams", async (e) => {
  const { DB: s } = e.env, r = e.req.param("sellerId");
  try {
    const t = await s.prepare(`
      SELECT 
        id,
        title,
        description,
        youtube_video_id,
        status,
        viewer_count,
        scheduled_at,
        created_at
      FROM live_streams 
      WHERE seller_id = ?
      ORDER BY 
        CASE status
          WHEN 'live' THEN 1
          WHEN 'scheduled' THEN 2
          WHEN 'ended' THEN 3
        END,
        created_at DESC
      LIMIT 50
    `).bind(r).all();
    return e.json({ success: true, data: t.results });
  } catch (t) {
    return console.error("\uB77C\uC774\uBE0C \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/:sellerId/products-public", async (e) => {
  const { DB: s } = e.env, r = e.req.param("sellerId");
  try {
    const t = await s.prepare(`
      SELECT 
        id,
        name,
        price,
        original_price,
        discount_rate,
        stock,
        image_url,
        category,
        is_active
      FROM products 
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(r).all();
    return e.json({ success: true, data: t.results });
  } catch (t) {
    return console.error("\uC0C1\uD488 \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/notifications", A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.get("userId"), t = e.get("userType"), a = parseInt(e.req.query("limit") || "50"), n = e.req.query("unread_only") === "true";
    let o = `
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;
    n && (o += " AND is_read = 0"), o += " ORDER BY created_at DESC LIMIT ?";
    const i = await s.prepare(o).bind(r, t, a).all();
    return e.json({ success: true, data: i.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/notifications/unread-count", A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.get("userId"), t = e.get("userType"), a = await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r, t).first();
    return e.json({ success: true, count: (a == null ? void 0 : a.count) || 0 });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/notifications/:id/read", A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("id"), t = e.get("userId"), a = e.get("userType");
    return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r, t, a).first() ? (await s.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(r).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/notifications/read-all", A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.get("userId"), t = e.get("userType");
    return await s.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r, t).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/notifications/:id", A, async (e) => {
  const { DB: s } = e.env;
  try {
    const r = e.req.param("id"), t = e.get("userId"), a = e.get("userType");
    return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r, t, a).first() ? (await s.prepare("DELETE FROM notifications WHERE id = ?").bind(r).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/banners", async (e) => {
  const { DB: s } = e.env;
  try {
    const r = (/* @__PURE__ */ new Date()).toISOString(), t = await s.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(r, r).all();
    return e.json({ success: true, data: t.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/admin/banners", A, async (e) => {
  const { DB: s } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const t = await s.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();
    return e.json({ success: true, data: t.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/admin/banners", A, async (e) => {
  const { DB: s } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const { title: t, image_url: a, link_url: n, description: o, is_active: i, display_order: c, start_date: u, end_date: l } = await e.req.json();
    if (!t || !a) return e.json({ success: false, error: "\uC81C\uBAA9\uACFC \uC774\uBBF8\uC9C0\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const p = await s.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t, a, n || null, o || null, i !== false ? 1 : 0, c || 0, u || null, l || null).run();
    return e.json({ success: true, id: p.meta.last_row_id });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/admin/banners/:id", A, async (e) => {
  const { DB: s } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const t = e.req.param("id"), { title: a, image_url: n, link_url: o, description: i, is_active: c, display_order: u, start_date: l, end_date: p } = await e.req.json();
    return await s.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a, n, o || null, i || null, c ? 1 : 0, u || 0, l || null, p || null, t).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/admin/banners/:id", A, async (e) => {
  const { DB: s } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const t = e.req.param("id");
    return await s.prepare("DELETE FROM banners WHERE id = ?").bind(t).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/order-complete", (e) => e.redirect("/order-complete.html", 302));
d.notFound((e) => {
  const s = e.req.path;
  return s.startsWith("/api/") ? e.json({ success: false, error: "Not found", message: `The requested endpoint ${s} was not found.` }, 404) : new Response(null, { status: 404 });
});
d.onError((e, s) => {
  const r = s.req.path;
  if (e instanceof Ua) return console.error("[AppError]", { path: r, method: s.req.method, code: e.code, message: e.message, statusCode: e.statusCode }), s.json({ success: false, error: { code: e.code, message: e.message, ...e.details && { details: e.details } } }, e.statusCode);
  if (console.error("[Global Error Handler]", { path: r, method: s.req.method, error: e.message, stack: e.stack }), r.startsWith("/api/")) {
    let t = 500, a = "Internal Server Error";
    return e.message.includes("Unauthorized") || e.message.includes("\uB85C\uADF8\uC778") ? (t = 401, a = "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uB85C\uADF8\uC778\uD574\uC8FC\uC138\uC694.") : e.message.includes("Forbidden") || e.message.includes("\uAD8C\uD55C") ? (t = 403, a = "\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.") : e.message.includes("Not found") || e.message.includes("\uCC3E\uC744 \uC218 \uC5C6") ? (t = 404, a = "\uC694\uCCAD\uD558\uC2E0 \uB9AC\uC18C\uC2A4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.") : (e.message.includes("Bad request") || e.message.includes("\uC798\uBABB\uB41C")) && (t = 400, a = "\uC798\uBABB\uB41C \uC694\uCCAD\uC785\uB2C8\uB2E4."), s.json({ success: false, error: e.message || a }, t);
  }
  return s.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>\uC624\uB958 \uBC1C\uC0DD - \uC720\uC5B4 \uB77C\uC774\uBE0C</title>
      <script src="https://cdn.tailwindcss.com"><\/script>
    </head>
    <body class="bg-gray-50">
      <div class="min-h-screen flex items-center justify-center px-4">
        <div class="max-w-md w-full text-center">
          <div class="mb-8">
            <svg class="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 class="text-3xl font-bold text-gray-900 mb-4">\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4</h1>
          <p class="text-gray-600 mb-8">
            \uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uC77C\uC2DC\uC801\uC778 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.<br/>
            \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.
          </p>
          <div class="space-y-3">
            <a 
              href="/" 
              class="inline-block w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              \uD648\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30
            </a>
            <button 
              onclick="window.history.back()" 
              class="inline-block w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              \uC774\uC804 \uD398\uC774\uC9C0\uB85C
            </button>
          </div>
          
        </div>
      </div>
    </body>
    </html>
  `, 500);
});
d.get("/api/admin/alimtalk/pricing", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();
    return e.json({ success: true, pricing: r.results });
  } catch (r) {
    return console.error("[Admin Alimtalk Pricing] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/admin/alimtalk/pricing", w(), async (e) => {
  const { env: s } = e;
  try {
    const { plan_name: r, min_quantity: t, max_quantity: a, unit_price: n } = await e.req.json();
    if (!r || !t || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = await s.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(r, t, a || null, n).run();
    return e.json({ success: true, pricing_id: o.meta.last_row_id });
  } catch (r) {
    return console.error("[Admin Alimtalk Pricing Create] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/admin/alimtalk/pricing/:id", w(), async (e) => {
  const { env: s } = e, r = e.req.param("id");
  try {
    const { plan_name: t, min_quantity: a, max_quantity: n, unit_price: o, is_active: i } = await e.req.json();
    return (await s.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t, a, n || null, o, i ? 1 : 0, r).run()).meta.changes === 0 ? e.json({ success: false, error: "Pricing not found" }, 404) : e.json({ success: true, message: "Pricing updated successfully" });
  } catch (t) {
    return console.error("[Admin Alimtalk Pricing Update] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.delete("/api/admin/alimtalk/pricing/:id", w(), async (e) => {
  const { env: s } = e, r = e.req.param("id");
  try {
    return (await s.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(r).run()).meta.changes === 0 ? e.json({ success: false, error: "Pricing not found" }, 404) : e.json({ success: true, message: "Pricing deleted successfully" });
  } catch (t) {
    return console.error("[Admin Alimtalk Pricing Delete] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/admin/alimtalk/accounts", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = await s.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();
    return e.json({ success: true, accounts: r.results });
  } catch (r) {
    return console.error("[Admin Alimtalk Accounts] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.patch("/api/admin/alimtalk/accounts/:id/status", w(), async (e) => {
  const { env: s } = e, r = e.req.param("id");
  try {
    const { status: t } = await e.req.json();
    return ["active", "suspended", "rejected"].includes(t) ? (await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t, r).run()).meta.changes === 0 ? e.json({ success: false, error: "Account not found" }, 404) : e.json({ success: true, message: `Account ${t} successfully` }) : e.json({ success: false, error: "Invalid status" }, 400);
  } catch (t) {
    return console.error("[Admin Alimtalk Account Status] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/admin/alimtalk/statistics", w(), async (e) => {
  const { env: s } = e;
  try {
    const { start_date: r, end_date: t } = e.req.query(), a = await s.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_revenue
      FROM alimtalk_messages
      WHERE created_at >= ? AND created_at <= ?
    `).bind(r || "2000-01-01", t || "2100-01-01").first(), n = await s.DB.prepare(`
      SELECT 
        s.id,
        s.name as seller_name,
        COUNT(m.id) as messages_sent,
        SUM(m.cost) as revenue,
        a.balance
      FROM sellers s
      JOIN alimtalk_accounts a ON s.id = a.seller_id
      LEFT JOIN alimtalk_messages m ON a.id = m.account_id
      WHERE m.created_at >= ? AND m.created_at <= ?
      GROUP BY s.id
      ORDER BY revenue DESC
      LIMIT 10
    `).bind(r || "2000-01-01", t || "2100-01-01").all();
    return e.json({ success: true, statistics: { total: a, by_seller: n.results } });
  } catch (r) {
    return console.error("[Admin Alimtalk Statistics] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.use("/api/seller/alimtalk/*", A);
d.get("/api/seller/alimtalk/account", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = e.get("user");
    if (!r || r.userType !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(r.userId).first();
    return e.json({ success: true, account: t });
  } catch (r) {
    return console.error("[Seller Alimtalk Account] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/alimtalk/register", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = e.req.header("X-Session-Token"), t = await je(s, r);
    if (!t || t.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { channel_id: a, phone_number: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = Mr(n), i = await la(s, { channelId: a, phoneNumber: o });
    if (!i.success) return e.json({ success: false, error: "Failed to register Kakao channel" }, 500);
    const c = await s.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(t.user_id, a, a, i.senderKey, o).run();
    return e.json({ success: true, account_id: c.meta.last_row_id, sender_key: i.senderKey, message: "Kakao channel registered successfully" });
  } catch (r) {
    return console.error("[Seller Alimtalk Register] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/alimtalk/templates", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = e.req.header("X-Session-Token"), t = await je(s, r);
    if (!t || t.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const a = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();
    if (!a) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const n = await s.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();
    return e.json({ success: true, templates: n.results });
  } catch (r) {
    return console.error("[Seller Alimtalk Templates] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/alimtalk/templates", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = e.req.header("X-Session-Token"), t = await je(s, r);
    if (!t || t.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_code: a, template_name: n, template_content: o, template_type: i } = await e.req.json();
    if (!a || !n || !o) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(t.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (!(await da(s, c.sender_key, { name: n, content: o, templateCode: a })).success) return e.json({ success: false, error: "Failed to register template" }, 500);
    const l = await s.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id, a, n, o, i || "basic").run();
    return e.json({ success: true, template_id: l.meta.last_row_id, message: "Template registered successfully. Approval pending (1-2 days)" });
  } catch (r) {
    return console.error("[Seller Alimtalk Template Register] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/alimtalk/pricing", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();
    return e.json({ success: true, pricing: r.results });
  } catch (r) {
    return console.error("[Seller Alimtalk Pricing] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/alimtalk/charge", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = e.req.header("X-Session-Token"), t = await je(s, r);
    if (!t || t.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { amount: a, pricing_id: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();
    if (!o) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const i = await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();
    if (!i) return e.json({ success: false, error: "Pricing not found" }, 404);
    const c = a * i.unit_price, u = `alimtalk_${o.id}_${Date.now()}`, l = await s.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id, a, c, i.unit_price, u).run(), p = `https://api.tosspayments.com/v1/payment/${u}`;
    return e.json({ success: true, charge_id: l.meta.last_row_id, order_id: u, amount: a, price: c, unit_price: i.unit_price, payment_url: p });
  } catch (r) {
    return console.error("[Seller Alimtalk Charge] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/alimtalk/charge/complete", w(), async (e) => {
  const { env: s } = e;
  try {
    const { order_id: r, payment_id: t } = await e.req.json();
    if (!r) return e.json({ success: false, error: "Missing order_id" }, 400);
    const a = await s.DB.prepare(`
      SELECT * FROM alimtalk_charges WHERE order_id = ? AND payment_status = 'pending'
    `).bind(r).first();
    return a ? (await s.DB.prepare(`
      UPDATE alimtalk_charges 
      SET payment_status = 'completed', 
          payment_id = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t || null, a.id).run(), await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a.amount, a.account_id).run(), e.json({ success: true, message: "Charge completed successfully", charged_amount: a.amount })) : e.json({ success: false, error: "Charge not found or already completed" }, 404);
  } catch (r) {
    return console.error("[Seller Alimtalk Charge Complete] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/alimtalk/send", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = e.req.header("X-Session-Token"), t = await je(s, r);
    if (!t || t.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_id: a, recipient_phone: n, variables: o, order_id: i } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(t.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (c.balance < 1) return e.json({ success: false, error: "Insufficient balance. Please charge first." }, 400);
    const u = await s.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a, c.id).first();
    if (!u) return e.json({ success: false, error: "Template not found or not approved" }, 404);
    const l = pa(u.template_content, o || {}), p = Mr(n), m = await Ls(s, { senderKey: c.sender_key, templateCode: u.template_code, to: p, message: l });
    if (!m.success) return await s.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id, a, i || null, p, l, m.error).run(), e.json({ success: false, error: m.error }, 500);
    const E = await s.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id, a, i || null, p, l, 15, m.messageId).run();
    return await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(), e.json({ success: true, message_id: E.meta.last_row_id, aligo_message_id: m.messageId, status: "sent", remaining_balance: c.balance - 1 });
  } catch (r) {
    return console.error("[Seller Alimtalk Send] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/alimtalk/messages", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = e.req.header("X-Session-Token"), t = await je(s, r);
    if (!t || t.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { page: a = "1", limit: n = "20", status: o } = e.req.query(), i = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();
    if (!i) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const c = (parseInt(a) - 1) * parseInt(n);
    let u = `
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;
    const l = [i.id];
    o && (u += " AND m.status = ?", l.push(o)), u += " ORDER BY m.created_at DESC LIMIT ? OFFSET ?", l.push(parseInt(n), c);
    const p = await s.DB.prepare(u).bind(...l).all(), m = await s.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();
    return e.json({ success: true, messages: p.results, pagination: { total: m.total, page: parseInt(a), limit: parseInt(n) } });
  } catch (r) {
    return console.error("[Seller Alimtalk Messages] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/alimtalk/statistics", w(), async (e) => {
  const { env: s } = e;
  try {
    const r = e.req.header("X-Session-Token"), t = await je(s, r);
    if (!t || t.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { start_date: a, end_date: n } = e.req.query(), o = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();
    if (!o) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const i = await s.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_cost
      FROM alimtalk_messages
      WHERE account_id = ?
        AND created_at >= ?
        AND created_at <= ?
    `).bind(o.id, a || "2000-01-01", n || "2100-01-01").first(), c = await s.DB.prepare(`
      SELECT 
        t.template_name,
        COUNT(m.id) as count
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
        AND m.created_at >= ?
        AND m.created_at <= ?
      GROUP BY t.id
      ORDER BY count DESC
    `).bind(o.id, a || "2000-01-01", n || "2100-01-01").all(), u = i.total_sent > 0 ? (i.total_success / i.total_sent * 100).toFixed(2) : 0;
    return e.json({ success: true, statistics: { total_sent: i.total_sent, total_success: i.total_success, total_failed: i.total_failed, success_rate: u, total_cost: i.total_cost, by_template: c.results } });
  } catch (r) {
    return console.error("[Seller Alimtalk Statistics] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/alimtalk/send", w(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await e.req.json(), { templateId: t, recipients: a, variables: n } = r;
    if (!t || !Array.isArray(a) || a.length === 0) return e.json({ success: false, error: "templateId and recipients are required" }, 400);
    const o = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();
    if (!o) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    const i = await Ms(e.env, { accountId: o.id, templateId: parseInt(t), recipients: a.map((c) => ({ phone: c.phone, name: c.name, variables: c.variables || {} })), variables: n || {} });
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (s) {
    return console.error("[Alimtalk Send] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/alimtalk/send/order", w(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await e.req.json(), { templateId: t, orderId: a, customMessage: n } = r;
    if (!t || !a) return e.json({ success: false, error: "templateId and orderId are required" }, 400);
    const o = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();
    if (!o) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    if (!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a), parseInt(s)).first()) return e.json({ success: false, error: "Order not found or unauthorized" }, 404);
    const c = await ba(e.env, o.id, parseInt(t), parseInt(a), n);
    return e.json({ success: c.success, data: { total: c.totalRecipients, sent: c.successCount, failed: c.failedCount, refunded: c.refundedAmount }, messages: c.messages });
  } catch (s) {
    return console.error("[Alimtalk Send Order] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/alimtalk/send/bulk", w(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await e.req.json(), { templateId: t, rows: a, variables: n } = r;
    if (!t || !Array.isArray(a) || a.length === 0) return e.json({ success: false, error: "templateId and rows are required" }, 400);
    const o = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();
    if (!o) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    const i = await Ra(e.env, o.id, parseInt(t), a, n || {});
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (s) {
    return console.error("[Alimtalk Send Bulk] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/alimtalk/templates/:id/preview", w(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = e.req.param("id"), t = await e.req.json(), { variables: a } = t, n = await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(r), parseInt(s)).first();
    if (!n) return e.json({ success: false, error: "Template not found" }, 404);
    let o = n.template_content;
    return a && Object.entries(a).forEach(([i, c]) => {
      const u = new RegExp(`#{${i}}`, "g");
      o = o.replace(u, c);
    }), e.json({ success: true, data: { template_name: n.template_name, original: n.template_content, preview: o, required_variables: Array.from(n.template_content.matchAll(/#{(\w+)}/g), (i) => i[1]) } });
  } catch (s) {
    return console.error("[Alimtalk Preview] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/admin/settlements", w(), async (e) => {
  try {
    const s = await e.env.DB.prepare(`
      SELECT * FROM settlements
      ORDER BY period_start DESC
      LIMIT 50
    `).all();
    return e.json({ success: true, data: s.results });
  } catch (s) {
    return console.error("[Admin Settlements] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/admin/settlements/:id", w(), async (e) => {
  try {
    const s = parseInt(e.req.param("id")), r = await Aa(e.env.DB, s);
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "Settlement not found" }, 404);
  } catch (s) {
    return console.error("[Admin Settlement Detail] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/admin/settlements/generate", w(), async (e) => {
  try {
    const s = await e.req.json(), { startDate: r, endDate: t } = s, a = r && t ? { startDate: r, endDate: t } : va(), n = await Da(e.env.DB, a);
    return await ka(e.env.DB, n), e.json({ success: true, data: n });
  } catch (s) {
    return console.error("[Admin Generate Settlement] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/seller/settlements", w(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await e.env.DB.prepare(`
      SELECT 
        s.id,
        s.period_start,
        s.period_end,
        sd.total_sales,
        sd.total_orders,
        sd.platform_fee,
        sd.shipping_fee,
        sd.refund_amount,
        sd.settlement_amount,
        sd.status,
        sd.paid_at
      FROM settlements s
      JOIN settlement_details sd ON s.id = sd.settlement_id
      WHERE sd.seller_id = ?
      ORDER BY s.period_start DESC
      LIMIT 50
    `).bind(parseInt(s)).all();
    return e.json({ success: true, data: r.results });
  } catch (s) {
    return console.error("[Seller Settlements] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/live/:streamId/sse", async (e) => {
  const s = e.req.param("streamId");
  return ja(s, e.env);
});
d.get("/api/live/:streamId/chat/sse", async (e) => {
  const s = e.req.param("streamId");
  return Na(s, e.env);
});
d.get("/api/seller/orders/sse", async (e) => {
  const s = e.req.header("X-Seller-ID");
  return s ? Ca(s, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
d.get("/api/seller/stock/sse", async (e) => {
  const s = e.req.header("X-Seller-ID");
  return s ? La(s, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
d.post("/api/push/subscribe", w(), async (e) => {
  try {
    const s = e.req.header("X-User-ID"), r = e.req.header("X-User-Type");
    if (!s || !r) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await e.req.json();
    return await Ma(e.env.DB, parseInt(s), r, t), e.json({ success: true });
  } catch (s) {
    return console.error("[Push Subscribe] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/push/unsubscribe", w(), async (e) => {
  try {
    const { endpoint: s } = await e.req.json();
    return s ? (await Pa(e.env.DB, s), e.json({ success: true })) : e.json({ success: false, error: "Endpoint required" }, 400);
  } catch (s) {
    return console.error("[Push Unsubscribe] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/push/vapid-public-key", w(), async (e) => {
  try {
    const s = e.env.VAPID_PUBLIC_KEY || "";
    return e.json({ success: true, publicKey: s });
  } catch (s) {
    return console.error("[Push VAPID Key] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/cache/stats", async (e) => {
  const s = e.req.query("token"), r = e.env.STATS_SECRET_TOKEN || "your-secret-token-here";
  if (s !== r) return e.json({ success: false, error: "\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC62C\uBC14\uB978 token\uC744 \uC81C\uACF5\uD574\uC8FC\uC138\uC694." }, 403);
  const t = Y.hits + Y.misses > 0 ? (Y.hits / (Y.hits + Y.misses) * 100).toFixed(2) : "0.00";
  return e.json({ success: true, data: { cache: { ...Y, hitRate: `${t}%`, cacheSize: ge.size, maxSize: 1e3, memoryUsage: `${(ge.size / 1e3 * 100).toFixed(1)}%` }, description: { hits: "Memory cache\uB85C \uCC98\uB9AC\uB41C \uC694\uCCAD (KV \uC77D\uAE30 0\uD68C)", misses: "Memory cache \uBBF8\uC2A4\uB85C KV \uC870\uD68C\uD55C \uC694\uCCAD", writes: "Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", evictions: "Memory cache\uC5D0\uC11C \uC0AD\uC81C\uB41C \uD56D\uBAA9 \uC218 (\uB9CC\uB8CC \uB610\uB294 \uD06C\uAE30 \uC81C\uD55C)", hitRate: "Cache hit \uBE44\uC728 (\uB192\uC744\uC218\uB85D KV \uC0AC\uC6A9\uB7C9 \uAC10\uC18C)", cacheSize: "\uD604\uC7AC Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", maxSize: "Memory cache \uCD5C\uB300 \uD06C\uAE30", memoryUsage: "Memory cache \uC0AC\uC6A9\uB960 (cacheSize / maxSize)" }, kvUsageGuide: { currentHitRate: `${t}%`, recommendation: parseFloat(t) >= 90 ? "\u2705 \uCE90\uC2DC\uAC00 \uB9E4\uC6B0 \uD6A8\uACFC\uC801\uC73C\uB85C \uC791\uB3D9\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : parseFloat(t) >= 70 ? "\u26A0\uFE0F \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB0AE\uC2B5\uB2C8\uB2E4. TTL \uC870\uC815\uC744 \uACE0\uB824\uD558\uC138\uC694." : "\u274C \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB9E4\uC6B0 \uB0AE\uC2B5\uB2C8\uB2E4. \uCE90\uC2DC \uC124\uC815\uC744 \uD655\uC778\uD558\uC138\uC694.", kvDailyReadsLimit: "100,000 reads/day (free tier)", kvDailyWritesLimit: "1,000 writes/day (free tier)", estimatedDailyReads: Math.round(Y.misses / (Y.hits + Y.misses || 1) * 1e4), estimatedDailyWrites: Math.round(Y.writes / (Y.hits + Y.misses || 1) * 1e3) } } });
});
d.route("/", cs);
var Zs = {};
var er = {};
d.get("/api/debug/kv-usage", w(), async (e) => {
  try {
    const s = Object.entries(Zs).sort((n, o) => o[1] - n[1]).slice(0, 20), r = Object.entries(er).sort((n, o) => o[1] - n[1]).slice(0, 20), t = Object.values(Zs).reduce((n, o) => n + o, 0), a = Object.values(er).reduce((n, o) => n + o, 0);
    return e.json({ success: true, stats: { total_writes: t, total_reads: a, daily_write_limit: 1e3, daily_read_limit: 1e5, write_usage_percent: (t / 1e3 * 100).toFixed(2) + "%", read_usage_percent: (a / 1e5 * 100).toFixed(2) + "%", top_writes: s, top_reads: r }, recommendations: t > 500 ? ["\u26A0\uFE0F KV Write \uC0AC\uC6A9\uB7C9\uC774 \uB192\uC2B5\uB2C8\uB2E4!", "1. \uC138\uC158 \uAC31\uC2E0 \uC8FC\uAE30\uB97C \uB298\uB9AC\uC138\uC694 (\uD604\uC7AC 29\uC77C)", "2. \uCE90\uC2DC\uB97C \uBA54\uBAA8\uB9AC\uC5D0\uB9CC \uC800\uC7A5\uD558\uC138\uC694 (forceKvWrite: false)", "3. JWT \uC778\uC99D\uC73C\uB85C \uC804\uD658\uD558\uC138\uC694 (KV \uC0AC\uC6A9\uB7C9 90% \uAC10\uC18C)"] : ["\u2705 KV \uC0AC\uC6A9\uB7C9\uC774 \uC815\uC0C1 \uBC94\uC704\uC785\uB2C8\uB2E4."] });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
var sr = new Ds();
var rn = Object.assign({ "/src/index.tsx": d });
var Hr = false;
for (const [, e] of Object.entries(rn)) e && (sr.route("/", e), sr.notFound(e.notFoundHandler), Hr = true);
if (!Hr) throw new Error("Can't import modules from ['/src/index.tsx']");
async function Fr(e) {
  try {
    const { to: s, subject: r, htmlContent: t, textContent: a } = e, n = await fetch("https://api.mailchannels.net/tx/v1/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: s }] }], from: { email: "noreply@live.ur-team.com", name: "\uC720\uC5B4 \uB77C\uC774\uBE0C" }, subject: r, content: [{ type: "text/html", value: t }, ...a ? [{ type: "text/plain", value: a }] : []] }) });
    if (!n.ok) {
      const o = await n.text();
      return console.error("[Email] Failed to send:", n.status, o), { success: false, error: `Email send failed: ${n.status}` };
    }
    return console.log("[Email] Successfully sent to:", s), { success: true };
  } catch (s) {
    return console.error("[Email] Exception:", s), { success: false, error: s.message };
  }
}
__name(Fr, "Fr");
__name2(Fr, "Fr");
async function tn(e) {
  const { streamId: s, title: r, sellerName: t, platform: a, scheduledAt: n, status: o } = e, i = `https://live.ur-team.com/live/${s}`, c = o === "live" ? "\u{1F534} \uB77C\uC774\uBE0C \uC911" : o === "scheduled" ? "\u{1F4C5} \uC608\uC57D\uB428" : "\u23F8\uFE0F \uB300\uAE30 \uC911", u = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .content {
      background: #f9fafb;
      padding: 30px 20px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .info-box {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    .info-row {
      margin: 10px 0;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: 600;
      color: #6b7280;
      display: inline-block;
      width: 120px;
    }
    .value {
      color: #111827;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
    }
    .badge-live {
      background: #fee2e2;
      color: #dc2626;
    }
    .badge-scheduled {
      background: #dbeafe;
      color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">\u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">\uC140\uB7EC\uAC00 \uC0C8\uB85C\uC6B4 \uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uAC1C\uC124\uD588\uC2B5\uB2C8\uB2E4</p>
  </div>
  
  <div class="content">
    <div class="info-box">
      <h2 style="margin-top: 0; color: #111827;">\uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC815\uBCF4</h2>
      
      <div class="info-row">
        <span class="label">\uC0C1\uD0DC</span>
        <span class="value">
          <span class="badge ${o === "live" ? "badge-live" : "badge-scheduled"}">${c}</span>
        </span>
      </div>
      
      <div class="info-row">
        <span class="label">\uC81C\uBAA9</span>
        <span class="value"><strong>${r}</strong></span>
      </div>
      
      <div class="info-row">
        <span class="label">\uD310\uB9E4\uC790</span>
        <span class="value">${t}</span>
      </div>
      
      <div class="info-row">
        <span class="label">\uD50C\uB7AB\uD3FC</span>
        <span class="value">${a === "youtube" ? "\u{1F4FA} YouTube" : "\u{1F3B5} TikTok"}</span>
      </div>
      
      ${n ? `
      <div class="info-row">
        <span class="label">\uC608\uC57D \uC2DC\uAC04</span>
        <span class="value">${new Date(n).toLocaleString("ko-KR")}</span>
      </div>
      ` : ""}
      
      <div class="info-row">
        <span class="label">\uB77C\uC774\uBE0C ID</span>
        <span class="value">#${s}</span>
      </div>
    </div>
    
    <div style="text-align: center;">
      <a href="${i}" class="button">
        \u{1F517} \uB77C\uC774\uBE0C \uD398\uC774\uC9C0 \uBC14\uB85C\uAC00\uAE30
      </a>
    </div>
    
    <div style="background: #fffbeb; border: 1px solid #fde047; padding: 15px; border-radius: 8px; margin-top: 20px;">
      <p style="margin: 0; color: #92400e;">
        <strong>\u{1F4A1} \uCC38\uACE0:</strong> \uC774 \uC774\uBA54\uC77C\uC740 \uC790\uB3D9\uC73C\uB85C \uC804\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4. 
        \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC\uC744 \uD655\uC778\uD558\uACE0 \uD544\uC694\uC2DC \uAD00\uB9AC\uC790 \uB300\uC2DC\uBCF4\uB4DC\uC5D0\uC11C \uAD00\uB9AC\uD558\uC138\uC694.
      </p>
    </div>
  </div>
  
  <div class="footer">
    <p style="margin: 5px 0;">
      <strong>\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158</strong><br>
      \uBD80\uC0B0\uAD11\uC5ED\uC2DC \uAE08\uC815\uAD6C \uB180\uC774\uB9C8\uB2F9\uB85C26 1402<br>
      \uB300\uD45C\uC804\uD654: 0507-0177-0432 | \uC774\uBA54\uC77C: jiwon@ur-team.com
    </p>
    <p style="margin: 15px 0 5px 0; font-size: 12px; color: #9ca3af;">
      \xA9 2026 \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158. All rights reserved.
    </p>
  </div>
</body>
</html>
  `, l = `
\u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131!

\uC0C1\uD0DC: ${c}
\uC81C\uBAA9: ${r}
\uD310\uB9E4\uC790: ${t}
\uD50C\uB7AB\uD3FC: ${a === "youtube" ? "YouTube" : "TikTok"}
${n ? `\uC608\uC57D \uC2DC\uAC04: ${new Date(n).toLocaleString("ko-KR")}` : ""}
\uB77C\uC774\uBE0C ID: #${s}

\u{1F517} \uB77C\uC774\uBE0C \uD398\uC774\uC9C0: ${i}

---
\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158
\uBD80\uC0B0\uAD11\uC5ED\uC2DC \uAE08\uC815\uAD6C \uB180\uC774\uB9C8\uB2F9\uB85C26 1402
\uB300\uD45C\uC804\uD654: 0507-0177-0432 | \uC774\uBA54\uC77C: jiwon@ur-team.com
  `;
  return Fr({ to: "jiwon@ur-team.com", subject: `[\uC720\uC5B4 \uB77C\uC774\uBE0C] \u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131: ${r}`, htmlContent: u, textContent: l });
}
__name(tn, "tn");
__name2(tn, "tn");
var an = Object.freeze(Object.defineProperty({ __proto__: null, sendEmail: Fr, sendLiveStreamCreatedEmail: tn }, Symbol.toStringTag, { value: "Module" }));
var drainBody = /* @__PURE__ */ __name2(async (request, env22, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env22);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env22, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env22);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = sr;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env22, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env22, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env22, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env22, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env22, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env22, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env22, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env22, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env22, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env22, ctx) => {
      this.env = env22;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/wrangler/templates/pages-dev-util.ts
function isRoutingRuleMatch(pathname, routingRule) {
  if (!pathname) {
    throw new Error("Pathname is undefined.");
  }
  if (!routingRule) {
    throw new Error("Routing rule is undefined.");
  }
  const ruleRegExp = transformRoutingRuleToRegExp(routingRule);
  return pathname.match(ruleRegExp) !== null;
}
__name(isRoutingRuleMatch, "isRoutingRuleMatch");
function transformRoutingRuleToRegExp(rule) {
  let transformedRule;
  if (rule === "/" || rule === "/*") {
    transformedRule = rule;
  } else if (rule.endsWith("/*")) {
    transformedRule = `${rule.substring(0, rule.length - 2)}(/*)?`;
  } else if (rule.endsWith("/")) {
    transformedRule = `${rule.substring(0, rule.length - 1)}(/)?`;
  } else if (rule.endsWith("*")) {
    transformedRule = rule;
  } else {
    transformedRule = `${rule}(/)?`;
  }
  transformedRule = `^${transformedRule.replaceAll(/\./g, "\\.").replaceAll(/\*/g, ".*")}$`;
  return new RegExp(transformedRule);
}
__name(transformRoutingRuleToRegExp, "transformRoutingRuleToRegExp");

// .wrangler/tmp/pages-oW3zpg/yft9z7ycemp.js
var define_ROUTES_default = {
  version: 1,
  include: [
    "/api/*",
    "/auth/*"
  ],
  exclude: [
    "/static/*"
  ]
};
var routes = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env3, context2) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env3.ASSETS.fetch(request);
      }
    }
    for (const include of routes.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = middleware_loader_entry_default;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env3, context2);
      }
    }
    return env3.ASSETS.fetch(request);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env3, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env3);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env3, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env3);
  } catch (e) {
    const error3 = reduceError2(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-AVeMRV/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = pages_dev_pipeline_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env3, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env3, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env3, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env3, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-AVeMRV/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env3, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env3, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env3, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env3, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env3, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env3, ctx) => {
      this.env = env3;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=yft9z7ycemp.js.map
