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

// .wrangler/tmp/pages-qrQYFM/bundledWorker-0.1433980782757116.mjs
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
var Mt = Object.defineProperty;
var $s = /* @__PURE__ */ __name2((e) => {
  throw TypeError(e);
}, "$s");
var $t = /* @__PURE__ */ __name2((e, s, t) => s in e ? Mt(e, s, { enumerable: true, configurable: true, writable: true, value: t }) : e[s] = t, "$t");
var D = /* @__PURE__ */ __name2((e, s, t) => $t(e, typeof s != "symbol" ? s + "" : s, t), "D");
var ys = /* @__PURE__ */ __name2((e, s, t) => s.has(e) || $s("Cannot " + t), "ys");
var E = /* @__PURE__ */ __name2((e, s, t) => (ys(e, s, "read from private field"), t ? t.call(e) : s.get(e)), "E");
var k = /* @__PURE__ */ __name2((e, s, t) => s.has(e) ? $s("Cannot add the same private member more than once") : s instanceof WeakSet ? s.add(e) : s.set(e, t), "k");
var I = /* @__PURE__ */ __name2((e, s, t, r) => (ys(e, s, "write to private field"), r ? r.call(e, t) : s.set(e, t), t), "I");
var C = /* @__PURE__ */ __name2((e, s, t) => (ys(e, s, "access private method"), t), "C");
var Fs = /* @__PURE__ */ __name2((e, s, t, r) => ({ set _(a) {
  I(e, s, a, t);
}, get _() {
  return E(e, s, r);
} }), "Fs");
var Us = /* @__PURE__ */ __name2((e, s, t) => (r, a) => {
  let o = -1;
  return n(0);
  async function n(i) {
    if (i <= o) throw new Error("next() called multiple times");
    o = i;
    let c, l = false, u;
    if (e[i] ? (u = e[i][0][0], r.req.routeIndex = i) : u = i === e.length && a || void 0, u) try {
      c = await u(r, () => n(i + 1));
    } catch (d) {
      if (d instanceof Error && s) r.error = d, c = await s(d, r), l = true;
      else throw d;
    }
    else r.finalized === false && t && (c = await t(r));
    return c && (r.finalized === false || l) && (r.res = c), r;
  }
  __name(n, "n");
  __name2(n, "n");
}, "Us");
var Ft = /* @__PURE__ */ Symbol();
var Ut = /* @__PURE__ */ __name2(async (e, s = /* @__PURE__ */ Object.create(null)) => {
  const { all: t = false, dot: r = false } = s, o = (e instanceof lt ? e.raw.headers : e.headers).get("Content-Type");
  return o != null && o.startsWith("multipart/form-data") || o != null && o.startsWith("application/x-www-form-urlencoded") ? qt(e, { all: t, dot: r }) : {};
}, "Ut");
async function qt(e, s) {
  const t = await e.formData();
  return t ? Pt(t, s) : {};
}
__name(qt, "qt");
__name2(qt, "qt");
function Pt(e, s) {
  const t = /* @__PURE__ */ Object.create(null);
  return e.forEach((r, a) => {
    s.all || a.endsWith("[]") ? xt(t, a, r) : t[a] = r;
  }), s.dot && Object.entries(t).forEach(([r, a]) => {
    r.includes(".") && (Ht(t, r, a), delete t[r]);
  }), t;
}
__name(Pt, "Pt");
__name2(Pt, "Pt");
var xt = /* @__PURE__ */ __name2((e, s, t) => {
  e[s] !== void 0 ? Array.isArray(e[s]) ? e[s].push(t) : e[s] = [e[s], t] : s.endsWith("[]") ? e[s] = [t] : e[s] = t;
}, "xt");
var Ht = /* @__PURE__ */ __name2((e, s, t) => {
  let r = e;
  const a = s.split(".");
  a.forEach((o, n) => {
    n === a.length - 1 ? r[o] = t : ((!r[o] || typeof r[o] != "object" || Array.isArray(r[o]) || r[o] instanceof File) && (r[o] = /* @__PURE__ */ Object.create(null)), r = r[o]);
  });
}, "Ht");
var at = /* @__PURE__ */ __name2((e) => {
  const s = e.split("/");
  return s[0] === "" && s.shift(), s;
}, "at");
var Wt = /* @__PURE__ */ __name2((e) => {
  const { groups: s, path: t } = Bt(e), r = at(t);
  return Kt(r, s);
}, "Wt");
var Bt = /* @__PURE__ */ __name2((e) => {
  const s = [];
  return e = e.replace(/\{[^}]+\}/g, (t, r) => {
    const a = `@${r}`;
    return s.push([a, t]), a;
  }), { groups: s, path: e };
}, "Bt");
var Kt = /* @__PURE__ */ __name2((e, s) => {
  for (let t = s.length - 1; t >= 0; t--) {
    const [r] = s[t];
    for (let a = e.length - 1; a >= 0; a--) if (e[a].includes(r)) {
      e[a] = e[a].replace(r, s[t][1]);
      break;
    }
  }
  return e;
}, "Kt");
var ls = {};
var Vt = /* @__PURE__ */ __name2((e, s) => {
  if (e === "*") return "*";
  const t = e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (t) {
    const r = `${e}#${s}`;
    return ls[r] || (t[2] ? ls[r] = s && s[0] !== ":" && s[0] !== "*" ? [r, t[1], new RegExp(`^${t[2]}(?=/${s})`)] : [e, t[1], new RegExp(`^${t[2]}$`)] : ls[r] = [e, t[1], true]), ls[r];
  }
  return null;
}, "Vt");
var Ds = /* @__PURE__ */ __name2((e, s) => {
  try {
    return s(e);
  } catch {
    return e.replace(/(?:%[0-9A-Fa-f]{2})+/g, (t) => {
      try {
        return s(t);
      } catch {
        return t;
      }
    });
  }
}, "Ds");
var Yt = /* @__PURE__ */ __name2((e) => Ds(e, decodeURI), "Yt");
var ot = /* @__PURE__ */ __name2((e) => {
  const s = e.url, t = s.indexOf("/", s.indexOf(":") + 4);
  let r = t;
  for (; r < s.length; r++) {
    const a = s.charCodeAt(r);
    if (a === 37) {
      const o = s.indexOf("?", r), n = s.indexOf("#", r), i = o === -1 ? n === -1 ? void 0 : n : n === -1 ? o : Math.min(o, n), c = s.slice(t, i);
      return Yt(c.includes("%25") ? c.replace(/%25/g, "%2525") : c);
    } else if (a === 63 || a === 35) break;
  }
  return s.slice(t, r);
}, "ot");
var Jt = /* @__PURE__ */ __name2((e) => {
  const s = ot(e);
  return s.length > 1 && s.at(-1) === "/" ? s.slice(0, -1) : s;
}, "Jt");
var Le = /* @__PURE__ */ __name2((e, s, ...t) => (t.length && (s = Le(s, ...t)), `${(e == null ? void 0 : e[0]) === "/" ? "" : "/"}${e}${s === "/" ? "" : `${(e == null ? void 0 : e.at(-1)) === "/" ? "" : "/"}${(s == null ? void 0 : s[0]) === "/" ? s.slice(1) : s}`}`), "Le");
var nt = /* @__PURE__ */ __name2((e) => {
  if (e.charCodeAt(e.length - 1) !== 63 || !e.includes(":")) return null;
  const s = e.split("/"), t = [];
  let r = "";
  return s.forEach((a) => {
    if (a !== "" && !/\:/.test(a)) r += "/" + a;
    else if (/\:/.test(a)) if (/\?/.test(a)) {
      t.length === 0 && r === "" ? t.push("/") : t.push(r);
      const o = a.replace("?", "");
      r += "/" + o, t.push(r);
    } else r += "/" + a;
  }), t.filter((a, o, n) => n.indexOf(a) === o);
}, "nt");
var ws = /* @__PURE__ */ __name2((e) => /[%+]/.test(e) ? (e.indexOf("+") !== -1 && (e = e.replace(/\+/g, " ")), e.indexOf("%") !== -1 ? Ds(e, ct) : e) : e, "ws");
var it = /* @__PURE__ */ __name2((e, s, t) => {
  let r;
  if (!t && s && !/[%+]/.test(s)) {
    let n = e.indexOf("?", 8);
    if (n === -1) return;
    for (e.startsWith(s, n + 1) || (n = e.indexOf(`&${s}`, n + 1)); n !== -1; ) {
      const i = e.charCodeAt(n + s.length + 1);
      if (i === 61) {
        const c = n + s.length + 2, l = e.indexOf("&", c);
        return ws(e.slice(c, l === -1 ? void 0 : l));
      } else if (i == 38 || isNaN(i)) return "";
      n = e.indexOf(`&${s}`, n + 1);
    }
    if (r = /[%+]/.test(e), !r) return;
  }
  const a = {};
  r ?? (r = /[%+]/.test(e));
  let o = e.indexOf("?", 8);
  for (; o !== -1; ) {
    const n = e.indexOf("&", o + 1);
    let i = e.indexOf("=", o);
    i > n && n !== -1 && (i = -1);
    let c = e.slice(o + 1, i === -1 ? n === -1 ? void 0 : n : i);
    if (r && (c = ws(c)), o = n, c === "") continue;
    let l;
    i === -1 ? l = "" : (l = e.slice(i + 1, n === -1 ? void 0 : n), r && (l = ws(l))), t ? (a[c] && Array.isArray(a[c]) || (a[c] = []), a[c].push(l)) : a[c] ?? (a[c] = l);
  }
  return s ? a[s] : a;
}, "it");
var zt = it;
var Gt = /* @__PURE__ */ __name2((e, s) => it(e, s, true), "Gt");
var ct = decodeURIComponent;
var qs = /* @__PURE__ */ __name2((e) => Ds(e, ct), "qs");
var Fe;
var se;
var _e;
var ut;
var dt;
var Is;
var fe;
var Qs;
var lt = (Qs = class {
  static {
    __name(this, "Qs");
  }
  static {
    __name2(this, "Qs");
  }
  constructor(e, s = "/", t = [[]]) {
    k(this, _e);
    D(this, "raw");
    k(this, Fe);
    k(this, se);
    D(this, "routeIndex", 0);
    D(this, "path");
    D(this, "bodyCache", {});
    k(this, fe, (e2) => {
      const { bodyCache: s2, raw: t2 } = this, r = s2[e2];
      if (r) return r;
      const a = Object.keys(s2)[0];
      return a ? s2[a].then((o) => (a === "json" && (o = JSON.stringify(o)), new Response(o)[e2]())) : s2[e2] = t2[e2]();
    });
    this.raw = e, this.path = s, I(this, se, t), I(this, Fe, {});
  }
  param(e) {
    return e ? C(this, _e, ut).call(this, e) : C(this, _e, dt).call(this);
  }
  query(e) {
    return zt(this.url, e);
  }
  queries(e) {
    return Gt(this.url, e);
  }
  header(e) {
    if (e) return this.raw.headers.get(e) ?? void 0;
    const s = {};
    return this.raw.headers.forEach((t, r) => {
      s[r] = t;
    }), s;
  }
  async parseBody(e) {
    var s;
    return (s = this.bodyCache).parsedBody ?? (s.parsedBody = await Ut(this, e));
  }
  json() {
    return E(this, fe).call(this, "text").then((e) => JSON.parse(e));
  }
  text() {
    return E(this, fe).call(this, "text");
  }
  arrayBuffer() {
    return E(this, fe).call(this, "arrayBuffer");
  }
  blob() {
    return E(this, fe).call(this, "blob");
  }
  formData() {
    return E(this, fe).call(this, "formData");
  }
  addValidatedData(e, s) {
    E(this, Fe)[e] = s;
  }
  valid(e) {
    return E(this, Fe)[e];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [Ft]() {
    return E(this, se);
  }
  get matchedRoutes() {
    return E(this, se)[0].map(([[, e]]) => e);
  }
  get routePath() {
    return E(this, se)[0].map(([[, e]]) => e)[this.routeIndex].path;
  }
}, Fe = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), _e = /* @__PURE__ */ new WeakSet(), ut = /* @__PURE__ */ __name2(function(e) {
  const s = E(this, se)[0][this.routeIndex][1][e], t = C(this, _e, Is).call(this, s);
  return t && /\%/.test(t) ? qs(t) : t;
}, "ut"), dt = /* @__PURE__ */ __name2(function() {
  const e = {}, s = Object.keys(E(this, se)[0][this.routeIndex][1]);
  for (const t of s) {
    const r = C(this, _e, Is).call(this, E(this, se)[0][this.routeIndex][1][t]);
    r !== void 0 && (e[t] = /\%/.test(r) ? qs(r) : r);
  }
  return e;
}, "dt"), Is = /* @__PURE__ */ __name2(function(e) {
  return E(this, se)[1] ? E(this, se)[1][e] : e;
}, "Is"), fe = /* @__PURE__ */ new WeakMap(), Qs);
var Xt = { Stringify: 1 };
var pt = /* @__PURE__ */ __name2(async (e, s, t, r, a) => {
  typeof e == "object" && !(e instanceof String) && (e instanceof Promise || (e = e.toString()), e instanceof Promise && (e = await e));
  const o = e.callbacks;
  return o != null && o.length ? (a ? a[0] += e : a = [e], Promise.all(o.map((i) => i({ phase: s, buffer: a, context: r }))).then((i) => Promise.all(i.filter(Boolean).map((c) => pt(c, s, false, r, a))).then(() => a[0]))) : Promise.resolve(e);
}, "pt");
var Qt = "text/plain; charset=UTF-8";
var bs = /* @__PURE__ */ __name2((e, s) => ({ "Content-Type": e, ...s }), "bs");
var Ce = /* @__PURE__ */ __name2((e, s) => new Response(e, s), "Ce");
var es;
var ss;
var ue;
var Ue;
var de;
var Q;
var ts;
var qe;
var Pe;
var Te;
var rs;
var as;
var ie;
var Me;
var vs;
var Zs;
var Zt = (Zs = class {
  static {
    __name(this, "Zs");
  }
  static {
    __name2(this, "Zs");
  }
  constructor(e, s) {
    k(this, ie);
    k(this, es);
    k(this, ss);
    D(this, "env", {});
    k(this, ue);
    D(this, "finalized", false);
    D(this, "error");
    k(this, Ue);
    k(this, de);
    k(this, Q);
    k(this, ts);
    k(this, qe);
    k(this, Pe);
    k(this, Te);
    k(this, rs);
    k(this, as);
    D(this, "render", (...e2) => (E(this, qe) ?? I(this, qe, (s2) => this.html(s2)), E(this, qe).call(this, ...e2)));
    D(this, "setLayout", (e2) => I(this, ts, e2));
    D(this, "getLayout", () => E(this, ts));
    D(this, "setRenderer", (e2) => {
      I(this, qe, e2);
    });
    D(this, "header", (e2, s2, t) => {
      this.finalized && I(this, Q, Ce(E(this, Q).body, E(this, Q)));
      const r = E(this, Q) ? E(this, Q).headers : E(this, Te) ?? I(this, Te, new Headers());
      s2 === void 0 ? r.delete(e2) : t != null && t.append ? r.append(e2, s2) : r.set(e2, s2);
    });
    D(this, "status", (e2) => {
      I(this, Ue, e2);
    });
    D(this, "set", (e2, s2) => {
      E(this, ue) ?? I(this, ue, /* @__PURE__ */ new Map()), E(this, ue).set(e2, s2);
    });
    D(this, "get", (e2) => E(this, ue) ? E(this, ue).get(e2) : void 0);
    D(this, "newResponse", (...e2) => C(this, ie, Me).call(this, ...e2));
    D(this, "body", (e2, s2, t) => C(this, ie, Me).call(this, e2, s2, t));
    D(this, "text", (e2, s2, t) => C(this, ie, vs).call(this) && !s2 && !t ? Ce(e2) : C(this, ie, Me).call(this, e2, s2, bs(Qt, t)));
    D(this, "json", (e2, s2, t) => C(this, ie, vs).call(this) && !s2 && !t ? Response.json(e2) : C(this, ie, Me).call(this, JSON.stringify(e2), s2, bs("application/json", t)));
    D(this, "html", (e2, s2, t) => {
      const r = /* @__PURE__ */ __name2((a) => C(this, ie, Me).call(this, a, s2, bs("text/html; charset=UTF-8", t)), "r");
      return typeof e2 == "object" ? pt(e2, Xt.Stringify, false, {}).then(r) : r(e2);
    });
    D(this, "redirect", (e2, s2) => {
      const t = String(e2);
      return this.header("Location", /[^\x00-\xFF]/.test(t) ? encodeURI(t) : t), this.newResponse(null, s2 ?? 302);
    });
    D(this, "notFound", () => (E(this, Pe) ?? I(this, Pe, () => Ce()), E(this, Pe).call(this, this)));
    I(this, es, e), s && (I(this, de, s.executionCtx), this.env = s.env, I(this, Pe, s.notFoundHandler), I(this, as, s.path), I(this, rs, s.matchResult));
  }
  get req() {
    return E(this, ss) ?? I(this, ss, new lt(E(this, es), E(this, as), E(this, rs))), E(this, ss);
  }
  get event() {
    if (E(this, de) && "respondWith" in E(this, de)) return E(this, de);
    throw Error("This context has no FetchEvent");
  }
  get executionCtx() {
    if (E(this, de)) return E(this, de);
    throw Error("This context has no ExecutionContext");
  }
  get res() {
    return E(this, Q) || I(this, Q, Ce(null, { headers: E(this, Te) ?? I(this, Te, new Headers()) }));
  }
  set res(e) {
    if (E(this, Q) && e) {
      e = Ce(e.body, e);
      for (const [s, t] of E(this, Q).headers.entries()) if (s !== "content-type") if (s === "set-cookie") {
        const r = E(this, Q).headers.getSetCookie();
        e.headers.delete("set-cookie");
        for (const a of r) e.headers.append("set-cookie", a);
      } else e.headers.set(s, t);
    }
    I(this, Q, e), this.finalized = true;
  }
  get var() {
    return E(this, ue) ? Object.fromEntries(E(this, ue)) : {};
  }
}, es = /* @__PURE__ */ new WeakMap(), ss = /* @__PURE__ */ new WeakMap(), ue = /* @__PURE__ */ new WeakMap(), Ue = /* @__PURE__ */ new WeakMap(), de = /* @__PURE__ */ new WeakMap(), Q = /* @__PURE__ */ new WeakMap(), ts = /* @__PURE__ */ new WeakMap(), qe = /* @__PURE__ */ new WeakMap(), Pe = /* @__PURE__ */ new WeakMap(), Te = /* @__PURE__ */ new WeakMap(), rs = /* @__PURE__ */ new WeakMap(), as = /* @__PURE__ */ new WeakMap(), ie = /* @__PURE__ */ new WeakSet(), Me = /* @__PURE__ */ __name2(function(e, s, t) {
  const r = E(this, Q) ? new Headers(E(this, Q).headers) : E(this, Te) ?? new Headers();
  if (typeof s == "object" && "headers" in s) {
    const o = s.headers instanceof Headers ? s.headers : new Headers(s.headers);
    for (const [n, i] of o) n.toLowerCase() === "set-cookie" ? r.append(n, i) : r.set(n, i);
  }
  if (t) for (const [o, n] of Object.entries(t)) if (typeof n == "string") r.set(o, n);
  else {
    r.delete(o);
    for (const i of n) r.append(o, i);
  }
  const a = typeof s == "number" ? s : (s == null ? void 0 : s.status) ?? E(this, Ue);
  return Ce(e, { status: a, headers: r });
}, "Me"), vs = /* @__PURE__ */ __name2(function() {
  return !E(this, Te) && !E(this, Ue) && !this.finalized;
}, "vs"), Zs);
var B = "ALL";
var er = "all";
var sr = ["get", "post", "put", "delete", "options", "patch"];
var mt = "Can not add a route since the matcher is already built.";
var _t = class extends Error {
  static {
    __name(this, "_t");
  }
  static {
    __name2(this, "_t");
  }
};
var tr = "__COMPOSED_HANDLER";
var rr = /* @__PURE__ */ __name2((e) => e.text("404 Not Found", 404), "rr");
var Ps = /* @__PURE__ */ __name2((e, s) => {
  if ("getResponse" in e) {
    const t = e.getResponse();
    return s.newResponse(t.body, t);
  }
  return console.error(e), s.text("Internal Server Error", 500);
}, "Ps");
var ae;
var K;
var ft;
var oe;
var be;
var us;
var ds;
var xe;
var ar = (xe = class {
  static {
    __name(this, "xe");
  }
  static {
    __name2(this, "xe");
  }
  constructor(s = {}) {
    k(this, K);
    D(this, "get");
    D(this, "post");
    D(this, "put");
    D(this, "delete");
    D(this, "options");
    D(this, "patch");
    D(this, "all");
    D(this, "on");
    D(this, "use");
    D(this, "router");
    D(this, "getPath");
    D(this, "_basePath", "/");
    k(this, ae, "/");
    D(this, "routes", []);
    k(this, oe, rr);
    D(this, "errorHandler", Ps);
    D(this, "onError", (s2) => (this.errorHandler = s2, this));
    D(this, "notFound", (s2) => (I(this, oe, s2), this));
    D(this, "fetch", (s2, ...t) => C(this, K, ds).call(this, s2, t[1], t[0], s2.method));
    D(this, "request", (s2, t, r2, a2) => s2 instanceof Request ? this.fetch(t ? new Request(s2, t) : s2, r2, a2) : (s2 = s2.toString(), this.fetch(new Request(/^https?:\/\//.test(s2) ? s2 : `http://localhost${Le("/", s2)}`, t), r2, a2)));
    D(this, "fire", () => {
      addEventListener("fetch", (s2) => {
        s2.respondWith(C(this, K, ds).call(this, s2.request, s2, void 0, s2.request.method));
      });
    });
    [...sr, er].forEach((o) => {
      this[o] = (n, ...i) => (typeof n == "string" ? I(this, ae, n) : C(this, K, be).call(this, o, E(this, ae), n), i.forEach((c) => {
        C(this, K, be).call(this, o, E(this, ae), c);
      }), this);
    }), this.on = (o, n, ...i) => {
      for (const c of [n].flat()) {
        I(this, ae, c);
        for (const l of [o].flat()) i.map((u) => {
          C(this, K, be).call(this, l.toUpperCase(), E(this, ae), u);
        });
      }
      return this;
    }, this.use = (o, ...n) => (typeof o == "string" ? I(this, ae, o) : (I(this, ae, "*"), n.unshift(o)), n.forEach((i) => {
      C(this, K, be).call(this, B, E(this, ae), i);
    }), this);
    const { strict: r, ...a } = s;
    Object.assign(this, a), this.getPath = r ?? true ? s.getPath ?? ot : Jt;
  }
  route(s, t) {
    const r = this.basePath(s);
    return t.routes.map((a) => {
      var n;
      let o;
      t.errorHandler === Ps ? o = a.handler : (o = /* @__PURE__ */ __name2(async (i, c) => (await Us([], t.errorHandler)(i, () => a.handler(i, c))).res, "o"), o[tr] = a.handler), C(n = r, K, be).call(n, a.method, a.path, o);
    }), this;
  }
  basePath(s) {
    const t = C(this, K, ft).call(this);
    return t._basePath = Le(this._basePath, s), t;
  }
  mount(s, t, r) {
    let a, o;
    r && (typeof r == "function" ? o = r : (o = r.optionHandler, r.replaceRequest === false ? a = /* @__PURE__ */ __name2((c) => c, "a") : a = r.replaceRequest));
    const n = o ? (c) => {
      const l = o(c);
      return Array.isArray(l) ? l : [l];
    } : (c) => {
      let l;
      try {
        l = c.executionCtx;
      } catch {
      }
      return [c.env, l];
    };
    a || (a = (() => {
      const c = Le(this._basePath, s), l = c === "/" ? 0 : c.length;
      return (u) => {
        const d = new URL(u.url);
        return d.pathname = d.pathname.slice(l) || "/", new Request(d, u);
      };
    })());
    const i = /* @__PURE__ */ __name2(async (c, l) => {
      const u = await t(a(c.req.raw), ...n(c));
      if (u) return u;
      await l();
    }, "i");
    return C(this, K, be).call(this, B, Le(s, "*"), i), this;
  }
}, ae = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakSet(), ft = /* @__PURE__ */ __name2(function() {
  const s = new xe({ router: this.router, getPath: this.getPath });
  return s.errorHandler = this.errorHandler, I(s, oe, E(this, oe)), s.routes = this.routes, s;
}, "ft"), oe = /* @__PURE__ */ new WeakMap(), be = /* @__PURE__ */ __name2(function(s, t, r) {
  s = s.toUpperCase(), t = Le(this._basePath, t);
  const a = { basePath: this._basePath, path: t, method: s, handler: r };
  this.router.add(s, t, [r, a]), this.routes.push(a);
}, "be"), us = /* @__PURE__ */ __name2(function(s, t) {
  if (s instanceof Error) return this.errorHandler(s, t);
  throw s;
}, "us"), ds = /* @__PURE__ */ __name2(function(s, t, r, a) {
  if (a === "HEAD") return (async () => new Response(null, await C(this, K, ds).call(this, s, t, r, "GET")))();
  const o = this.getPath(s, { env: r }), n = this.router.match(a, o), i = new Zt(s, { path: o, matchResult: n, env: r, executionCtx: t, notFoundHandler: E(this, oe) });
  if (n[0].length === 1) {
    let l;
    try {
      l = n[0][0][0][0](i, async () => {
        i.res = await E(this, oe).call(this, i);
      });
    } catch (u) {
      return C(this, K, us).call(this, u, i);
    }
    return l instanceof Promise ? l.then((u) => u || (i.finalized ? i.res : E(this, oe).call(this, i))).catch((u) => C(this, K, us).call(this, u, i)) : l ?? E(this, oe).call(this, i);
  }
  const c = Us(n[0], this.errorHandler, E(this, oe));
  return (async () => {
    try {
      const l = await c(i);
      if (!l.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
      return l.res;
    } catch (l) {
      return C(this, K, us).call(this, l, i);
    }
  })();
}, "ds"), xe);
var Et = [];
function or(e, s) {
  const t = this.buildAllMatchers(), r = /* @__PURE__ */ __name2(((a, o) => {
    const n = t[a] || t[B], i = n[2][o];
    if (i) return i;
    const c = o.match(n[0]);
    if (!c) return [[], Et];
    const l = c.indexOf("", 1);
    return [n[1][l], c];
  }), "r");
  return this.match = r, r(e, s);
}
__name(or, "or");
__name2(or, "or");
var ms = "[^/]+";
var Xe = ".*";
var Qe = "(?:|/.*)";
var $e = /* @__PURE__ */ Symbol();
var nr = new Set(".\\+*[^]$()");
function ir(e, s) {
  return e.length === 1 ? s.length === 1 ? e < s ? -1 : 1 : -1 : s.length === 1 || e === Xe || e === Qe ? 1 : s === Xe || s === Qe ? -1 : e === ms ? 1 : s === ms ? -1 : e.length === s.length ? e < s ? -1 : 1 : s.length - e.length;
}
__name(ir, "ir");
__name2(ir, "ir");
var Re;
var Ie;
var ne;
var Oe;
var cr = (Oe = class {
  static {
    __name(this, "Oe");
  }
  static {
    __name2(this, "Oe");
  }
  constructor() {
    k(this, Re);
    k(this, Ie);
    k(this, ne, /* @__PURE__ */ Object.create(null));
  }
  insert(s, t, r, a, o) {
    if (s.length === 0) {
      if (E(this, Re) !== void 0) throw $e;
      if (o) return;
      I(this, Re, t);
      return;
    }
    const [n, ...i] = s, c = n === "*" ? i.length === 0 ? ["", "", Xe] : ["", "", ms] : n === "/*" ? ["", "", Qe] : n.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let l;
    if (c) {
      const u = c[1];
      let d = c[2] || ms;
      if (u && c[2] && (d === ".*" || (d = d.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:"), /\((?!\?:)/.test(d)))) throw $e;
      if (l = E(this, ne)[d], !l) {
        if (Object.keys(E(this, ne)).some((m) => m !== Xe && m !== Qe)) throw $e;
        if (o) return;
        l = E(this, ne)[d] = new Oe(), u !== "" && I(l, Ie, a.varIndex++);
      }
      !o && u !== "" && r.push([u, E(l, Ie)]);
    } else if (l = E(this, ne)[n], !l) {
      if (Object.keys(E(this, ne)).some((u) => u.length > 1 && u !== Xe && u !== Qe)) throw $e;
      if (o) return;
      l = E(this, ne)[n] = new Oe();
    }
    l.insert(i, t, r, a, o);
  }
  buildRegExpStr() {
    const t = Object.keys(E(this, ne)).sort(ir).map((r) => {
      const a = E(this, ne)[r];
      return (typeof E(a, Ie) == "number" ? `(${r})@${E(a, Ie)}` : nr.has(r) ? `\\${r}` : r) + a.buildRegExpStr();
    });
    return typeof E(this, Re) == "number" && t.unshift(`#${E(this, Re)}`), t.length === 0 ? "" : t.length === 1 ? t[0] : "(?:" + t.join("|") + ")";
  }
}, Re = /* @__PURE__ */ new WeakMap(), Ie = /* @__PURE__ */ new WeakMap(), ne = /* @__PURE__ */ new WeakMap(), Oe);
var fs;
var os;
var et;
var lr = (et = class {
  static {
    __name(this, "et");
  }
  static {
    __name2(this, "et");
  }
  constructor() {
    k(this, fs, { varIndex: 0 });
    k(this, os, new cr());
  }
  insert(e, s, t) {
    const r = [], a = [];
    for (let n = 0; ; ) {
      let i = false;
      if (e = e.replace(/\{[^}]+\}/g, (c) => {
        const l = `@\\${n}`;
        return a[n] = [l, c], n++, i = true, l;
      }), !i) break;
    }
    const o = e.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let n = a.length - 1; n >= 0; n--) {
      const [i] = a[n];
      for (let c = o.length - 1; c >= 0; c--) if (o[c].indexOf(i) !== -1) {
        o[c] = o[c].replace(i, a[n][1]);
        break;
      }
    }
    return E(this, os).insert(o, s, r, E(this, fs), t), r;
  }
  buildRegExp() {
    let e = E(this, os).buildRegExpStr();
    if (e === "") return [/^$/, [], []];
    let s = 0;
    const t = [], r = [];
    return e = e.replace(/#(\d+)|@(\d+)|\.\*\$/g, (a, o, n) => o !== void 0 ? (t[++s] = Number(o), "$()") : (n !== void 0 && (r[Number(n)] = ++s), "")), [new RegExp(`^${e}`), t, r];
  }
}, fs = /* @__PURE__ */ new WeakMap(), os = /* @__PURE__ */ new WeakMap(), et);
var ur = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var ps = /* @__PURE__ */ Object.create(null);
function ht(e) {
  return ps[e] ?? (ps[e] = new RegExp(e === "*" ? "" : `^${e.replace(/\/\*$|([.\\+*[^\]$()])/g, (s, t) => t ? `\\${t}` : "(?:|/.*)")}$`));
}
__name(ht, "ht");
__name2(ht, "ht");
function dr() {
  ps = /* @__PURE__ */ Object.create(null);
}
__name(dr, "dr");
__name2(dr, "dr");
function pr(e) {
  var l;
  const s = new lr(), t = [];
  if (e.length === 0) return ur;
  const r = e.map((u) => [!/\*|\/:/.test(u[0]), ...u]).sort(([u, d], [m, _]) => u ? 1 : m ? -1 : d.length - _.length), a = /* @__PURE__ */ Object.create(null);
  for (let u = 0, d = -1, m = r.length; u < m; u++) {
    const [_, f, g] = r[u];
    _ ? a[f] = [g.map(([w]) => [w, /* @__PURE__ */ Object.create(null)]), Et] : d++;
    let b;
    try {
      b = s.insert(f, d, _);
    } catch (w) {
      throw w === $e ? new _t(f) : w;
    }
    _ || (t[d] = g.map(([w, h]) => {
      const T = /* @__PURE__ */ Object.create(null);
      for (h -= 1; h >= 0; h--) {
        const [y, R] = b[h];
        T[y] = R;
      }
      return [w, T];
    }));
  }
  const [o, n, i] = s.buildRegExp();
  for (let u = 0, d = t.length; u < d; u++) for (let m = 0, _ = t[u].length; m < _; m++) {
    const f = (l = t[u][m]) == null ? void 0 : l[1];
    if (!f) continue;
    const g = Object.keys(f);
    for (let b = 0, w = g.length; b < w; b++) f[g[b]] = i[f[g[b]]];
  }
  const c = [];
  for (const u in n) c[u] = t[n[u]];
  return [o, c, a];
}
__name(pr, "pr");
__name2(pr, "pr");
function je(e, s) {
  if (e) {
    for (const t of Object.keys(e).sort((r, a) => a.length - r.length)) if (ht(t).test(s)) return [...e[t]];
  }
}
__name(je, "je");
__name2(je, "je");
var Ee;
var he;
var Es;
var gt;
var st;
var mr = (st = class {
  static {
    __name(this, "st");
  }
  static {
    __name2(this, "st");
  }
  constructor() {
    k(this, Es);
    D(this, "name", "RegExpRouter");
    k(this, Ee);
    k(this, he);
    D(this, "match", or);
    I(this, Ee, { [B]: /* @__PURE__ */ Object.create(null) }), I(this, he, { [B]: /* @__PURE__ */ Object.create(null) });
  }
  add(e, s, t) {
    var i;
    const r = E(this, Ee), a = E(this, he);
    if (!r || !a) throw new Error(mt);
    r[e] || [r, a].forEach((c) => {
      c[e] = /* @__PURE__ */ Object.create(null), Object.keys(c[B]).forEach((l) => {
        c[e][l] = [...c[B][l]];
      });
    }), s === "/*" && (s = "*");
    const o = (s.match(/\/:/g) || []).length;
    if (/\*$/.test(s)) {
      const c = ht(s);
      e === B ? Object.keys(r).forEach((l) => {
        var u;
        (u = r[l])[s] || (u[s] = je(r[l], s) || je(r[B], s) || []);
      }) : (i = r[e])[s] || (i[s] = je(r[e], s) || je(r[B], s) || []), Object.keys(r).forEach((l) => {
        (e === B || e === l) && Object.keys(r[l]).forEach((u) => {
          c.test(u) && r[l][u].push([t, o]);
        });
      }), Object.keys(a).forEach((l) => {
        (e === B || e === l) && Object.keys(a[l]).forEach((u) => c.test(u) && a[l][u].push([t, o]));
      });
      return;
    }
    const n = nt(s) || [s];
    for (let c = 0, l = n.length; c < l; c++) {
      const u = n[c];
      Object.keys(a).forEach((d) => {
        var m;
        (e === B || e === d) && ((m = a[d])[u] || (m[u] = [...je(r[d], u) || je(r[B], u) || []]), a[d][u].push([t, o - l + c + 1]));
      });
    }
  }
  buildAllMatchers() {
    const e = /* @__PURE__ */ Object.create(null);
    return Object.keys(E(this, he)).concat(Object.keys(E(this, Ee))).forEach((s) => {
      e[s] || (e[s] = C(this, Es, gt).call(this, s));
    }), I(this, Ee, I(this, he, void 0)), dr(), e;
  }
}, Ee = /* @__PURE__ */ new WeakMap(), he = /* @__PURE__ */ new WeakMap(), Es = /* @__PURE__ */ new WeakSet(), gt = /* @__PURE__ */ __name2(function(e) {
  const s = [];
  let t = e === B;
  return [E(this, Ee), E(this, he)].forEach((r) => {
    const a = r[e] ? Object.keys(r[e]).map((o) => [o, r[e][o]]) : [];
    a.length !== 0 ? (t || (t = true), s.push(...a)) : e !== B && s.push(...Object.keys(r[B]).map((o) => [o, r[B][o]]));
  }), t ? pr(s) : null;
}, "gt"), st);
var ge;
var pe;
var tt;
var _r = (tt = class {
  static {
    __name(this, "tt");
  }
  static {
    __name2(this, "tt");
  }
  constructor(e) {
    D(this, "name", "SmartRouter");
    k(this, ge, []);
    k(this, pe, []);
    I(this, ge, e.routers);
  }
  add(e, s, t) {
    if (!E(this, pe)) throw new Error(mt);
    E(this, pe).push([e, s, t]);
  }
  match(e, s) {
    if (!E(this, pe)) throw new Error("Fatal error");
    const t = E(this, ge), r = E(this, pe), a = t.length;
    let o = 0, n;
    for (; o < a; o++) {
      const i = t[o];
      try {
        for (let c = 0, l = r.length; c < l; c++) i.add(...r[c]);
        n = i.match(e, s);
      } catch (c) {
        if (c instanceof _t) continue;
        throw c;
      }
      this.match = i.match.bind(i), I(this, ge, [i]), I(this, pe, void 0);
      break;
    }
    if (o === a) throw new Error("Fatal error");
    return this.name = `SmartRouter + ${this.activeRouter.name}`, n;
  }
  get activeRouter() {
    if (E(this, pe) || E(this, ge).length !== 1) throw new Error("No active router has been determined yet.");
    return E(this, ge)[0];
  }
}, ge = /* @__PURE__ */ new WeakMap(), pe = /* @__PURE__ */ new WeakMap(), tt);
var Je = /* @__PURE__ */ Object.create(null);
var fr = /* @__PURE__ */ __name2((e) => {
  for (const s in e) return true;
  return false;
}, "fr");
var ye;
var X;
var ve;
var He;
var z;
var me;
var Se;
var We;
var Er = (We = class {
  static {
    __name(this, "We");
  }
  static {
    __name2(this, "We");
  }
  constructor(s, t, r) {
    k(this, me);
    k(this, ye);
    k(this, X);
    k(this, ve);
    k(this, He, 0);
    k(this, z, Je);
    if (I(this, X, r || /* @__PURE__ */ Object.create(null)), I(this, ye, []), s && t) {
      const a = /* @__PURE__ */ Object.create(null);
      a[s] = { handler: t, possibleKeys: [], score: 0 }, I(this, ye, [a]);
    }
    I(this, ve, []);
  }
  insert(s, t, r) {
    I(this, He, ++Fs(this, He)._);
    let a = this;
    const o = Wt(t), n = [];
    for (let i = 0, c = o.length; i < c; i++) {
      const l = o[i], u = o[i + 1], d = Vt(l, u), m = Array.isArray(d) ? d[0] : l;
      if (m in E(a, X)) {
        a = E(a, X)[m], d && n.push(d[1]);
        continue;
      }
      E(a, X)[m] = new We(), d && (E(a, ve).push(d), n.push(d[1])), a = E(a, X)[m];
    }
    return E(a, ye).push({ [s]: { handler: r, possibleKeys: n.filter((i, c, l) => l.indexOf(i) === c), score: E(this, He) } }), a;
  }
  search(s, t) {
    var u;
    const r = [];
    I(this, z, Je);
    let o = [this];
    const n = at(t), i = [], c = n.length;
    let l = null;
    for (let d = 0; d < c; d++) {
      const m = n[d], _ = d === c - 1, f = [];
      for (let b = 0, w = o.length; b < w; b++) {
        const h = o[b], T = E(h, X)[m];
        T && (I(T, z, E(h, z)), _ ? (E(T, X)["*"] && C(this, me, Se).call(this, r, E(T, X)["*"], s, E(h, z)), C(this, me, Se).call(this, r, T, s, E(h, z))) : f.push(T));
        for (let y = 0, R = E(h, ve).length; y < R; y++) {
          const $ = E(h, ve)[y], A = E(h, z) === Je ? {} : { ...E(h, z) };
          if ($ === "*") {
            const F = E(h, X)["*"];
            F && (C(this, me, Se).call(this, r, F, s, E(h, z)), I(F, z, A), f.push(F));
            continue;
          }
          const [O, x, U] = $;
          if (!m && !(U instanceof RegExp)) continue;
          const L = E(h, X)[O];
          if (U instanceof RegExp) {
            if (l === null) {
              l = new Array(c);
              let Y = t[0] === "/" ? 1 : 0;
              for (let v = 0; v < c; v++) l[v] = Y, Y += n[v].length + 1;
            }
            const F = t.substring(l[d]), G = U.exec(F);
            if (G) {
              if (A[x] = G[0], C(this, me, Se).call(this, r, L, s, E(h, z), A), fr(E(L, X))) {
                I(L, z, A);
                const Y = ((u = G[0].match(/\//)) == null ? void 0 : u.length) ?? 0;
                (i[Y] || (i[Y] = [])).push(L);
              }
              continue;
            }
          }
          (U === true || U.test(m)) && (A[x] = m, _ ? (C(this, me, Se).call(this, r, L, s, A, E(h, z)), E(L, X)["*"] && C(this, me, Se).call(this, r, E(L, X)["*"], s, A, E(h, z))) : (I(L, z, A), f.push(L)));
        }
      }
      const g = i.shift();
      o = g ? f.concat(g) : f;
    }
    return r.length > 1 && r.sort((d, m) => d.score - m.score), [r.map(({ handler: d, params: m }) => [d, m])];
  }
}, ye = /* @__PURE__ */ new WeakMap(), X = /* @__PURE__ */ new WeakMap(), ve = /* @__PURE__ */ new WeakMap(), He = /* @__PURE__ */ new WeakMap(), z = /* @__PURE__ */ new WeakMap(), me = /* @__PURE__ */ new WeakSet(), Se = /* @__PURE__ */ __name2(function(s, t, r, a, o) {
  for (let n = 0, i = E(t, ye).length; n < i; n++) {
    const c = E(t, ye)[n], l = c[r] || c[B], u = {};
    if (l !== void 0 && (l.params = /* @__PURE__ */ Object.create(null), s.push(l), a !== Je || o && o !== Je)) for (let d = 0, m = l.possibleKeys.length; d < m; d++) {
      const _ = l.possibleKeys[d], f = u[l.score];
      l.params[_] = o != null && o[_] && !f ? o[_] : a[_] ?? (o == null ? void 0 : o[_]), u[l.score] = true;
    }
  }
}, "Se"), We);
var De;
var rt;
var hr = (rt = class {
  static {
    __name(this, "rt");
  }
  static {
    __name2(this, "rt");
  }
  constructor() {
    D(this, "name", "TrieRouter");
    k(this, De);
    I(this, De, new Er());
  }
  add(e, s, t) {
    const r = nt(s);
    if (r) {
      for (let a = 0, o = r.length; a < o; a++) E(this, De).insert(e, r[a], t);
      return;
    }
    E(this, De).insert(e, s, t);
  }
  match(e, s) {
    return E(this, De).search(e, s);
  }
}, De = /* @__PURE__ */ new WeakMap(), rt);
var yt = class extends ar {
  static {
    __name(this, "yt");
  }
  static {
    __name2(this, "yt");
  }
  constructor(e = {}) {
    super(e), this.router = e.router ?? new _r({ routers: [new mr(), new hr()] });
  }
};
var S = /* @__PURE__ */ __name2((e) => {
  const t = { ...{ origin: "*", allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"], allowHeaders: [], exposeHeaders: [] }, ...e }, r = /* @__PURE__ */ ((o) => typeof o == "string" ? o === "*" ? () => o : (n) => o === n ? n : null : typeof o == "function" ? o : (n) => o.includes(n) ? n : null)(t.origin), a = ((o) => typeof o == "function" ? o : Array.isArray(o) ? () => o : () => [])(t.allowMethods);
  return async function(n, i) {
    var u;
    function c(d, m) {
      n.res.headers.set(d, m);
    }
    __name(c, "c");
    __name2(c, "c");
    const l = await r(n.req.header("origin") || "", n);
    if (l && c("Access-Control-Allow-Origin", l), t.credentials && c("Access-Control-Allow-Credentials", "true"), (u = t.exposeHeaders) != null && u.length && c("Access-Control-Expose-Headers", t.exposeHeaders.join(",")), n.req.method === "OPTIONS") {
      t.origin !== "*" && c("Vary", "Origin"), t.maxAge != null && c("Access-Control-Max-Age", t.maxAge.toString());
      const d = await a(n.req.header("origin") || "", n);
      d.length && c("Access-Control-Allow-Methods", d.join(","));
      let m = t.allowHeaders;
      if (!(m != null && m.length)) {
        const _ = n.req.header("Access-Control-Request-Headers");
        _ && (m = _.split(/\s*,\s*/));
      }
      return m != null && m.length && (c("Access-Control-Allow-Headers", m.join(",")), n.res.headers.append("Vary", "Access-Control-Request-Headers")), n.res.headers.delete("Content-Length"), n.res.headers.delete("Content-Type"), new Response(null, { headers: n.res.headers, status: 204, statusText: "No Content" });
    }
    await i(), t.origin !== "*" && n.header("Vary", "Origin", { append: true });
  };
}, "S");
function gr(e) {
  var a;
  const s = ((a = e.split(".").pop()) == null ? void 0 : a.toLowerCase()) || "jpg", t = Date.now(), r = crypto.randomUUID().substring(0, 8);
  return `upload_${t}_${r}.${s}`;
}
__name(gr, "gr");
__name2(gr, "gr");
async function yr(e) {
  const s = new Uint8Array(e);
  return s[0] === 255 && s[1] === 216 && s[2] === 255 ? { valid: true, detectedType: "image/jpeg" } : s[0] === 137 && s[1] === 80 && s[2] === 78 && s[3] === 71 ? { valid: true, detectedType: "image/png" } : s[0] === 71 && s[1] === 73 && s[2] === 70 && s[3] === 56 ? { valid: true, detectedType: "image/gif" } : s[0] === 82 && s[1] === 73 && s[2] === 70 && s[3] === 70 && s[8] === 87 && s[9] === 69 && s[10] === 66 && s[11] === 80 ? { valid: true, detectedType: "image/webp" } : { valid: false };
}
__name(yr, "yr");
__name2(yr, "yr");
function wr(e) {
  const s = ["DB", "SESSION_KV", "CACHE_KV", "TOSS_SECRET_KEY", "TOSS_CLIENT_KEY"], t = [];
  for (const r of s) e[r] || t.push(r);
  if (t.length > 0) throw new Error(`Missing required environment variables: ${t.join(", ")}

Please configure them:
` + t.map((r) => r === "TOSS_SECRET_KEY" || r === "TOSS_CLIENT_KEY" ? `  npx wrangler pages secret put ${r} --project-name ur-live` : `  Check wrangler.jsonc for ${r} binding`).join(`
`) + `

For more details, see ENV_SETUP_GUIDE.md`);
}
__name(wr, "wr");
__name2(wr, "wr");
function br(e) {
  console.log("[ENV] Environment check:"), console.log("  DB:", e.DB ? "\u2705 Connected" : "\u274C Missing"), console.log("  SESSION_KV:", e.SESSION_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  CACHE_KV:", e.CACHE_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  TOSS_SECRET_KEY:", e.TOSS_SECRET_KEY ? "\u2705 Set" : "\u274C Missing"), console.log("  TOSS_CLIENT_KEY:", e.TOSS_CLIENT_KEY ? "\u2705 Set" : "\u274C Missing");
}
__name(br, "br");
__name2(br, "br");
async function Sr(e) {
  const s = [];
  try {
    e.DB ? (await e.DB.prepare("SELECT 1").first(), s.push({ name: "D1 Database Binding", status: "pass", message: "DB connected successfully" })) : s.push({ name: "D1 Database Binding", status: "fail", message: "DB binding not found", details: "Check wrangler.jsonc d1_databases configuration" });
  } catch (t) {
    s.push({ name: "D1 Database Binding", status: "fail", message: "DB query failed", details: t instanceof Error ? t.message : String(t) });
  }
  try {
    if (!e.SESSION_KV) s.push({ name: "SESSION_KV Binding", status: "fail", message: "SESSION_KV binding not found", details: "Check wrangler.jsonc kv_namespaces configuration" });
    else {
      const t = "test:env:check";
      await e.SESSION_KV.put(t, "ok", { expirationTtl: 60 }), await e.SESSION_KV.get(t) === "ok" ? s.push({ name: "SESSION_KV Binding", status: "pass", message: "SESSION_KV read/write successful" }) : s.push({ name: "SESSION_KV Binding", status: "warn", message: "SESSION_KV write succeeded but read failed" });
    }
  } catch (t) {
    s.push({ name: "SESSION_KV Binding", status: "fail", message: "SESSION_KV operation failed", details: t instanceof Error ? t.message : String(t) });
  }
  try {
    if (!e.CACHE_KV) s.push({ name: "CACHE_KV Binding", status: "fail", message: "CACHE_KV binding not found", details: "Check wrangler.jsonc kv_namespaces configuration" });
    else {
      const t = "test:cache:check";
      await e.CACHE_KV.put(t, "ok", { expirationTtl: 60 }), await e.CACHE_KV.get(t) === "ok" ? s.push({ name: "CACHE_KV Binding", status: "pass", message: "CACHE_KV read/write successful" }) : s.push({ name: "CACHE_KV Binding", status: "warn", message: "CACHE_KV write succeeded but read failed" });
    }
  } catch (t) {
    s.push({ name: "CACHE_KV Binding", status: "fail", message: "CACHE_KV operation failed", details: t instanceof Error ? t.message : String(t) });
  }
  return e.TOSS_SECRET_KEY ? !e.TOSS_SECRET_KEY.startsWith("test_gsk_") && !e.TOSS_SECRET_KEY.startsWith("live_gsk_") ? s.push({ name: "TOSS_SECRET_KEY", status: "warn", message: "TOSS_SECRET_KEY format may be invalid", details: "Expected format: test_gsk_* or live_gsk_*" }) : s.push({ name: "TOSS_SECRET_KEY", status: "pass", message: `TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0, 12)}...)` }) : s.push({ name: "TOSS_SECRET_KEY", status: "fail", message: "TOSS_SECRET_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live" }), e.TOSS_CLIENT_KEY ? !e.TOSS_CLIENT_KEY.startsWith("test_gck_") && !e.TOSS_CLIENT_KEY.startsWith("live_gck_") ? s.push({ name: "TOSS_CLIENT_KEY", status: "warn", message: "TOSS_CLIENT_KEY format may be invalid", details: "Expected format: test_gck_* or live_gck_*" }) : s.push({ name: "TOSS_CLIENT_KEY", status: "pass", message: `TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0, 12)}...)` }) : s.push({ name: "TOSS_CLIENT_KEY", status: "fail", message: "TOSS_CLIENT_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live" }), s;
}
__name(Sr, "Sr");
__name2(Sr, "Sr");
function Tr(e) {
  const s = [];
  s.push(""), s.push("========================================"), s.push("\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uACB0\uACFC"), s.push("========================================"), s.push("");
  let t = 0, r = 0, a = 0;
  for (const o of e) {
    const n = o.status === "pass" ? "\u2705" : o.status === "warn" ? "\u26A0\uFE0F" : "\u274C";
    s.push(`${n} ${o.name}: ${o.message}`), o.details && s.push(`   \u2192 ${o.details}`), o.status === "pass" && t++, o.status === "warn" && r++, o.status === "fail" && a++;
  }
  return s.push(""), s.push("========================================"), s.push(`\uCD1D ${e.length}\uAC1C \uD14C\uC2A4\uD2B8:`), s.push(`  \u2705 \uC131\uACF5: ${t}`), r > 0 && s.push(`  \u26A0\uFE0F  \uACBD\uACE0: ${r}`), a > 0 && s.push(`  \u274C \uC2E4\uD328: ${a}`), s.push("========================================"), s.push(""), a > 0 ? (s.push("\u274C \uD658\uACBD \uBCC0\uC218 \uC124\uC815\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."), s.push("\uC790\uC138\uD55C \uB0B4\uC6A9\uC740 ENV_SETUP_GUIDE.md\uB97C \uCC38\uACE0\uD558\uC138\uC694.")) : r > 0 ? s.push("\u26A0\uFE0F  \uC77C\uBD80 \uACBD\uACE0\uAC00 \uC788\uC9C0\uB9CC \uBC30\uD3EC\uB294 \uAC00\uB2A5\uD569\uB2C8\uB2E4.") : s.push("\u2705 \uBAA8\uB4E0 \uD658\uACBD \uBCC0\uC218\uAC00 \uC62C\uBC14\uB974\uAC8C \uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4!"), s.join(`
`);
}
__name(Tr, "Tr");
__name2(Tr, "Tr");
async function Rr(e) {
  const s = await Sr(e), t = s.filter((o) => o.status === "pass").length, r = s.filter((o) => o.status === "warn").length, a = s.filter((o) => o.status === "fail").length;
  return { success: a === 0, summary: { total: s.length, pass: t, warn: r, fail: a }, results: s, formatted: Tr(s) };
}
__name(Rr, "Rr");
__name2(Rr, "Rr");
var Ss = { ENV: "test", TEST_API_KEY: "03148F80-9525-4A00-83B4-1AE55DFFA2DF", TEST_BASE_URL: "https://testapi.barobill.co.kr" };
function Ir() {
  const e = Ss.ENV === "production";
  return { baseUrl: Ss.TEST_BASE_URL, apiKey: Ss.TEST_API_KEY, isProduction: e };
}
__name(Ir, "Ir");
__name2(Ir, "Ir");
async function wt(e, s) {
  const t = Ir(), r = `${t.baseUrl}${e}`;
  try {
    const a = await fetch(r, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.apiKey}` }, body: JSON.stringify(s) });
    if (!a.ok) throw new Error(`\uBC14\uB85C\uBE4C API \uC624\uB958: ${a.status} ${a.statusText}`);
    return await a.json();
  } catch (a) {
    throw console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", a), a;
  }
}
__name(wt, "wt");
__name2(wt, "wt");
async function vr(e) {
  try {
    const s = { CorpNum: e.supplierBusinessNumber, InvoicerCorpNum: e.supplierBusinessNumber, InvoicerCorpName: e.supplierBusinessName, InvoicerCEOName: e.supplierCEO, InvoicerAddr: e.supplierAddress, InvoicerBizType: e.supplierBusinessType, InvoicerBizClass: e.supplierBusinessCategory, InvoicerContactName: e.supplierCEO, InvoicerEmail: e.supplierEmail, InvoicerTEL: e.supplierTel, InvoiceeType: e.buyerBusinessNumber ? "\uC0AC\uC5C5\uC790" : "\uAC1C\uC778", InvoiceeCorpNum: e.buyerBusinessNumber, InvoiceeCorpName: e.buyerBusinessName, InvoiceeCEOName: e.buyerCEO, InvoiceeAddr: e.buyerAddress, InvoiceeEmail: e.buyerEmail, InvoiceeTEL: e.buyerTel, WriteDate: e.writeDate, PurposeType: e.purposeType, TaxType: e.taxType, DetailList: e.items.map((r, a) => ({ SerialNum: a + 1, ItemName: r.name, Qty: r.quantity, UnitPrice: r.unitPrice, SupplyCost: r.supplyPrice, Tax: r.taxAmount, Remark: r.description || "" })), SupplyCostTotal: e.totalSupplyPrice.toString(), TaxTotal: e.totalTaxAmount.toString(), TotalAmount: e.totalAmount.toString(), Remark1: e.memo || "", Remark2: e.orderNo || "", SendSMS: false, AutoAccept: false }, t = await wt("/eTaxInvoice/RegistAndIssue", s);
    if (t.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC2E4\uD328: ${t.message}`);
    return { success: true, ntsConfirmNumber: t.ntsconfirmNum, invoiceKey: t.invoiceKey, message: t.message };
  } catch (s) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC2E4\uD328:", s), s;
  }
}
__name(vr, "vr");
__name2(vr, "vr");
async function Dr(e, s, t) {
  try {
    const a = await wt("/eTaxInvoice/Delete", { CorpNum: e, InvoiceKey: s, Memo: t });
    if (a.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uCDE8\uC18C \uC2E4\uD328: ${a.message}`);
    return { success: true, message: a.message };
  } catch (r) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uCDE8\uC18C \uC2E4\uD328:", r), r;
  }
}
__name(Dr, "Dr");
__name2(Dr, "Dr");
function Ge() {
  return false;
}
__name(Ge, "Ge");
__name2(Ge, "Ge");
async function Or(e) {
  return await vr(e);
}
__name(Or, "Or");
__name2(Or, "Or");
function kr(e, s, t) {
  const r = Number(s.total_amount), a = Math.floor(r / 1.1), o = r - a;
  return { supplierBusinessNumber: e.business_number, supplierBusinessName: e.business_name, supplierCEO: e.ceo_name, supplierAddress: e.address, supplierBusinessType: e.business_type, supplierBusinessCategory: e.business_category, supplierEmail: e.email, supplierTel: e.phone, buyerBusinessNumber: s.buyer_business_number, buyerBusinessName: s.buyer_business_name || s.user_name, buyerCEO: s.buyer_ceo_name, buyerAddress: s.shipping_address, buyerEmail: s.user_email, buyerTel: s.shipping_phone, writeDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], purposeType: "01", taxType: "01", items: t.map((n) => {
    const i = Number(n.price) * Number(n.quantity), c = Math.floor(i / 1.1), l = i - c;
    return { name: n.product_name, quantity: Number(n.quantity), unitPrice: Number(n.price), supplyPrice: c, taxAmount: l, description: n.option_name || "" };
  }), totalSupplyPrice: a, totalTaxAmount: o, totalAmount: r, memo: `\uC8FC\uBB38\uBC88\uD638: ${s.order_number}`, orderNo: s.order_number };
}
__name(kr, "kr");
__name2(kr, "kr");
var te = class extends Error {
  static {
    __name(this, "te");
  }
  static {
    __name2(this, "te");
  }
  constructor(s, t, r) {
    super(s), this.statusCode = t, this.code = r, this.name = "AuthError";
  }
};
function Ar(e) {
  return `${crypto.randomUUID()}-${e}`;
}
__name(Ar, "Ar");
__name2(Ar, "Ar");
function Nr(e) {
  var o, n, i, c, l, u, d;
  const s = e.id.toString(), t = ((o = e.properties) == null ? void 0 : o.nickname) || ((i = (n = e.kakao_account) == null ? void 0 : n.profile) == null ? void 0 : i.nickname) || "Kakao User", r = ((c = e.kakao_account) == null ? void 0 : c.email) || null, a = ((l = e.properties) == null ? void 0 : l.profile_image) || ((d = (u = e.kakao_account) == null ? void 0 : u.profile) == null ? void 0 : d.profile_image_url) || null;
  return { kakaoId: s, nickname: t, email: r, profileImage: a };
}
__name(Nr, "Nr");
__name2(Nr, "Nr");
async function Cr(e, s, t, r, a) {
  try {
    const o = await e.prepare(`
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
    `).bind(s, t, r, a).first();
    if (!o) throw new te("Failed to upsert user", 500, "UPSERT_FAILED");
    return console.log("[Auth] \u26A1 User upserted successfully (optimized):", o.id), o;
  } catch (o) {
    throw o instanceof te ? o : (console.error("[Auth] Database error during upsert:", o), new te("Database error", 500, "DB_ERROR"));
  }
}
__name(Cr, "Cr");
__name2(Cr, "Cr");
async function jr(e) {
  try {
    const s = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${e}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" } });
    if (!s.ok) {
      const r = await s.text();
      throw console.error("[Kakao API] Failed to get user info:", r), new te("Failed to get user info from Kakao", 401, "KAKAO_USER_INFO_FAILED");
    }
    const t = await s.json();
    if (!t.id) throw new te("Invalid user data from Kakao", 500, "INVALID_KAKAO_DATA");
    return t;
  } catch (s) {
    throw s instanceof te ? s : (console.error("[Kakao API] Network error:", s), new te("Failed to communicate with Kakao API", 503, "KAKAO_API_ERROR"));
  }
}
__name(jr, "jr");
__name2(jr, "jr");
async function Lr(e, s, t) {
  try {
    const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: t, redirect_uri: s, code: e }).toString() });
    if (!r.ok) {
      const o = await r.json();
      throw console.error("[Kakao OAuth] Token exchange failed:", o), new te(`Failed to exchange code: ${o.error_description || o.error}`, 401, o.error || "TOKEN_EXCHANGE_FAILED");
    }
    return (await r.json()).access_token;
  } catch (r) {
    throw r instanceof te ? r : (console.error("[Kakao OAuth] Network error:", r), new te("Failed to communicate with Kakao OAuth server", 503, "OAUTH_NETWORK_ERROR"));
  }
}
__name(Lr, "Lr");
__name2(Lr, "Lr");
async function bt(e, s) {
  const t = await jr(s), { kakaoId: r, nickname: a, email: o, profileImage: n } = Nr(t);
  console.log("[Auth] Processing login for Kakao user:", r);
  const i = await Cr(e, r, a, o, n), c = Ar(i.id);
  return { user: i, sessionToken: c };
}
__name(bt, "bt");
__name2(bt, "bt");
async function St(e, s, t = 30) {
  try {
    const r = await e.get(s, "json");
    if (!r) return console.log(`[Cache MISS] ${s}`), null;
    const a = Date.now() - r.timestamp;
    return a > t * 1e3 ? (console.log(`[Cache EXPIRED] ${s} (age: ${Math.round(a / 1e3)}s)`), null) : (console.log(`[Cache HIT] ${s} (age: ${Math.round(a / 1e3)}s)`), r.data);
  } catch (r) {
    return console.error(`[Cache] Get error for key "${s}":`, r), null;
  }
}
__name(St, "St");
__name2(St, "St");
async function _s(e, s, t, r = 30) {
  try {
    const a = { data: t, timestamp: Date.now() };
    await e.put(s, JSON.stringify(a), { expirationTtl: r }), console.log(`[Cache SET] ${s} (TTL: ${r}s)`);
  } catch (a) {
    console.error(`[Cache] Set error for key "${s}":`, a);
  }
}
__name(_s, "_s");
__name2(_s, "_s");
function Mr(e) {
  const s = e.req.header("CF-Connecting-IP");
  if (s) return s;
  const t = e.req.header("X-Forwarded-For");
  if (t) return t.split(",")[0].trim();
  const r = e.req.header("X-Real-IP");
  return r || "unknown";
}
__name(Mr, "Mr");
__name2(Mr, "Mr");
function $r(e, s) {
  return `ratelimit:${e}:${s}`;
}
__name($r, "$r");
__name2($r, "$r");
var Ts = /* @__PURE__ */ new Map();
async function Fr(e, s, t) {
  var m;
  const r = new URL(e.req.url).pathname, a = $r(s, r), o = Date.now(), n = t.windowMs * 1e3, c = e.get("user") && t.authenticatedMultiplier ? t.maxRequests * t.authenticatedMultiplier : t.maxRequests;
  try {
    const _ = (m = e.env) == null ? void 0 : m.RATE_LIMIT_KV;
    if (_) {
      const f = await _.get(a);
      let g;
      f ? (g = JSON.parse(f), o > g.resetTime ? g = { count: 1, resetTime: o + n } : g.count++) : g = { count: 1, resetTime: o + n };
      const b = Math.ceil(n / 1e3);
      await _.put(a, JSON.stringify(g), { expirationTtl: b });
      const w = g.count <= c, h = Math.max(0, c - g.count);
      return { allowed: w, remaining: h, resetTime: g.resetTime };
    }
  } catch (_) {
    console.error("KV Rate Limit Error:", _);
  }
  let l = Ts.get(a);
  l && o > l.resetTime && (Ts.delete(a), l = void 0), l ? l.count++ : l = { count: 1, resetTime: o + n }, Ts.set(a, l);
  const u = l.count <= c, d = Math.max(0, c - l.count);
  return { allowed: u, remaining: d, resetTime: l.resetTime };
}
__name(Fr, "Fr");
__name2(Fr, "Fr");
function ke(e) {
  return async (s, t) => {
    const r = Mr(s);
    if (e.skipIps && e.skipIps.includes(r)) return t();
    if (e.pathPattern) {
      const o = new URL(s.req.url).pathname;
      if (!e.pathPattern.test(o)) return t();
    }
    const a = await Fr(s, r, e);
    if (s.header("X-RateLimit-Limit", e.maxRequests.toString()), s.header("X-RateLimit-Remaining", a.remaining.toString()), s.header("X-RateLimit-Reset", new Date(a.resetTime).toISOString()), !a.allowed) {
      const o = Math.ceil((a.resetTime - Date.now()) / 1e3);
      return s.header("Retry-After", o.toString()), s.json({ success: false, error: e.message || "Too many requests. Please try again later.", retryAfter: o, resetTime: new Date(a.resetTime).toISOString() }, 429);
    }
    return t();
  };
}
__name(ke, "ke");
__name2(ke, "ke");
var Ae = { api: { windowMs: 60, maxRequests: 60, message: "API \uC694\uCCAD \uC81C\uD55C\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", authenticatedMultiplier: 2 }, auth: { windowMs: 60, maxRequests: 5, message: "\uB85C\uADF8\uC778 \uC2DC\uB3C4 \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uBD84 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/auth\// }, order: { windowMs: 60, maxRequests: 10, message: "\uC8FC\uBB38 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders/, authenticatedMultiplier: 2 }, cart: { windowMs: 60, maxRequests: 20, message: "\uC7A5\uBC14\uAD6C\uB2C8 \uC694\uCCAD\uC774 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/cart/, authenticatedMultiplier: 2 }, refund: { windowMs: 3600, maxRequests: 3, message: "\uD658\uBD88 \uC694\uCCAD \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uC2DC\uAC04 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders\/.*\/refund/ }, alimtalk: { windowMs: 60, maxRequests: 10, message: "\uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/seller\/alimtalk\/send/ }, upload: { windowMs: 60, maxRequests: 5, message: "\uD30C\uC77C \uC5C5\uB85C\uB4DC\uAC00 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/.*\/upload/ } };
var W = class extends Error {
  static {
    __name(this, "W");
  }
  static {
    __name2(this, "W");
  }
  constructor(s, t, r = "VALIDATION_ERROR") {
    super(t), this.field = s, this.code = r, this.name = "ValidationError";
  }
};
function Ur(e, s) {
  const { field: t, required: r, type: a, min: o, max: n, pattern: i, enum: c, custom: l, message: u } = s;
  if (r && (e == null || e === "")) throw new W(t, u || `${t}\uC740(\uB294) \uD544\uC218 \uD56D\uBAA9\uC785\uB2C8\uB2E4.`, "REQUIRED");
  if (!(e == null || e === "")) {
    if (a) switch (a) {
      case "string":
        if (typeof e != "string") throw new W(t, u || `${t}\uC740(\uB294) \uBB38\uC790\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "number":
        const d = typeof e == "string" ? Number(e) : e;
        if (typeof d != "number" || isNaN(d)) throw new W(t, u || `${t}\uC740(\uB294) \uC22B\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "boolean":
        if (typeof e != "boolean") throw new W(t, u || `${t}\uC740(\uB294) true/false \uAC12\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "email":
        if (typeof e != "string" || !xr(e)) throw new W(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_EMAIL");
        break;
      case "url":
        if (typeof e != "string" || !Hr(e)) throw new W(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C URL\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_URL");
        break;
      case "phone":
        if (typeof e != "string" || !Wr(e)) throw new W(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_PHONE");
        break;
      case "date":
        if (!(e instanceof Date) && !Br(e)) throw new W(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C \uB0A0\uC9DC\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_DATE");
        break;
      case "array":
        if (!Array.isArray(e)) throw new W(t, u || `${t}\uC740(\uB294) \uBC30\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "object":
        if (typeof e != "object" || e === null || Array.isArray(e)) throw new W(t, u || `${t}\uC740(\uB294) \uAC1D\uCCB4\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
    }
    if (typeof e == "string") {
      if (o !== void 0 && e.length < o) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uC18C ${o}\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SHORT");
      if (n !== void 0 && e.length > n) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uB300 ${n}\uC790 \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LONG");
    }
    if (typeof e == "number") {
      if (o !== void 0 && e < o) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uC18C ${o} \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SMALL");
      if (n !== void 0 && e > n) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uB300 ${n} \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LARGE");
    }
    if (Array.isArray(e)) {
      if (o !== void 0 && e.length < o) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uC18C ${o}\uAC1C \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_FEW");
      if (n !== void 0 && e.length > n) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uB300 ${n}\uAC1C \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_MANY");
    }
    if (i && typeof e == "string" && !i.test(e)) throw new W(t, u || `${t}\uC758 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "INVALID_FORMAT");
    if (c && !c.includes(e)) throw new W(t, u || `${t}\uC740(\uB294) \uB2E4\uC74C \uC911 \uD558\uB098\uC5EC\uC57C \uD569\uB2C8\uB2E4: ${c.join(", ")}`, "INVALID_ENUM");
    if (l && l(e) === false) throw new W(t, u || `${t}\uC758 \uAC12\uC774 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "CUSTOM_VALIDATION_FAILED");
  }
}
__name(Ur, "Ur");
__name2(Ur, "Ur");
function qr(e, s) {
  for (const t of s) {
    const r = e[t.field];
    Ur(r, t);
  }
}
__name(qr, "qr");
__name2(qr, "qr");
function Pr(e) {
  return async (s, t) => {
    try {
      let r = {};
      const a = s.req.header("content-type") || "";
      a.includes("application/json") ? r = await s.req.json().catch(() => ({})) : (a.includes("application/x-www-form-urlencoded") || a.includes("multipart/form-data")) && (r = await s.req.parseBody().catch(() => ({})));
      const o = new URL(s.req.url);
      for (const [n, i] of o.searchParams.entries()) n in r || (r[n] = i);
      qr(r, e), s.set("validatedData", r), await t();
    } catch (r) {
      if (r instanceof W) return s.json({ success: false, error: r.message, field: r.field, code: r.code }, 400);
      throw r;
    }
  };
}
__name(Pr, "Pr");
__name2(Pr, "Pr");
function xr(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}
__name(xr, "xr");
__name2(xr, "xr");
function Hr(e) {
  try {
    const s = new URL(e);
    return s.protocol === "http:" || s.protocol === "https:";
  } catch {
    return false;
  }
}
__name(Hr, "Hr");
__name2(Hr, "Hr");
function Wr(e) {
  return /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e);
}
__name(Wr, "Wr");
__name2(Wr, "Wr");
function Br(e) {
  if (typeof e != "string") return false;
  const s = new Date(e);
  return !isNaN(s.getTime());
}
__name(Br, "Br");
__name2(Br, "Br");
var Kr = [{ field: "email", required: true, type: "email", max: 255, message: "\uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, { field: "password", required: true, type: "string", min: 8, max: 100, pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: "\uBE44\uBC00\uBC88\uD638\uB294 \uCD5C\uC18C 8\uC790 \uC774\uC0C1, \uB300\uC18C\uBB38\uC790\uC640 \uC22B\uC790\uB97C \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4." }, { field: "name", required: true, type: "string", min: 2, max: 50, message: "\uC774\uB984\uC740 2-50\uC790 \uC0AC\uC774\uC5EC\uC57C \uD569\uB2C8\uB2E4." }, { field: "phone", required: false, type: "phone", message: "\uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694. (\uC608: 010-1234-5678)" }];
function hs(e) {
  const s = new URLSearchParams();
  for (const [t, r] of Object.entries(e)) r != null && s.append(t, String(r));
  return s;
}
__name(hs, "hs");
__name2(hs, "hs");
function Os(e, s) {
  if (e.result_code !== "1") throw new Error(`[Aligo ${s}] ${e.message} (code: ${e.result_code})`);
}
__name(Os, "Os");
__name2(Os, "Os");
async function ks(e) {
  console.log("[Aligo] \uD1A0\uD070 \uC0DD\uC131 \uC2DC\uC791");
  const t = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: hs({ apikey: e.ALIGO_API_KEY, userid: e.ALIGO_USER_ID }) })).json();
  return Os(t, "Token Create"), console.log("[Aligo] \u2705 \uD1A0\uD070 \uC0DD\uC131 \uC131\uACF5:", t.token.substring(0, 20) + "..."), { token: t.token, urtime: t.urtime };
}
__name(ks, "ks");
__name2(ks, "ks");
async function Vr(e, s) {
  console.log("[Aligo] \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D:", s.channelId);
  const { token: t } = await ks(e), a = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: hs({ token: t, userid: e.ALIGO_USER_ID, plusid: s.channelId, phonenumber: s.phoneNumber }) })).json();
  return Os(a, "Channel Register"), console.log("[Aligo] \u2705 \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D \uC131\uACF5, senderKey:", a.senderkey), { success: true, senderKey: a.senderkey };
}
__name(Vr, "Vr");
__name2(Vr, "Vr");
async function Yr(e, s, t) {
  console.log("[Aligo] \uD15C\uD50C\uB9BF \uB4F1\uB85D:", t.templateCode);
  const { token: r } = await ks(e), o = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: hs({ token: r, userid: e.ALIGO_USER_ID, senderkey: s, tpl_name: t.name, tpl_content: t.content, tpl_code: t.templateCode }) })).json();
  return Os(o, "Template Register"), console.log("[Aligo] \u2705 \uD15C\uD50C\uB9BF \uB4F1\uB85D \uC131\uACF5:", o.tpl_code), { success: true, templateCode: o.tpl_code };
}
__name(Yr, "Yr");
__name2(Yr, "Yr");
async function As(e, s) {
  console.log("[Aligo] \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1:", s.to);
  try {
    const { token: t } = await ks(e), r = s.buttons ? JSON.stringify({ button: s.buttons }) : void 0, o = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: hs({ token: t, userid: e.ALIGO_USER_ID, senderkey: s.senderKey, tpl_code: s.templateCode, receiver_1: s.to, subject_1: "\uC54C\uB9BC\uD1A1", message_1: s.message, button_1: r }) })).json();
    return o.result_code !== "1" ? (console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328:", o.message), { success: false, error: o.message }) : (console.log("[Aligo] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5, messageId:", o.msg_id), { success: true, messageId: o.msg_id });
  } catch (t) {
    return console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC5D0\uB7EC:", t.message), { success: false, error: t.message };
  }
}
__name(As, "As");
__name2(As, "As");
function Jr(e, s) {
  let t = e;
  for (const [r, a] of Object.entries(s)) {
    const o = new RegExp(`#{${r}}`, "g");
    t = t.replace(o, a);
  }
  return t;
}
__name(Jr, "Jr");
__name2(Jr, "Jr");
function Tt(e) {
  let s = e.replace(/-/g, "");
  if (!s.startsWith("010")) throw new Error("Invalid phone number format. Must start with 010");
  if (s.length !== 11) throw new Error("Invalid phone number length. Must be 11 digits");
  return s;
}
__name(Tt, "Tt");
__name2(Tt, "Tt");
async function zr(e, s) {
  const t = await e.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(s).first();
  if (!t) throw new Error(`Order not found: ${s}`);
  const r = await e.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(s).all();
  return { order: t, products: r.results };
}
__name(zr, "zr");
__name2(zr, "zr");
async function Gr(e, s) {
  const t = await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(s).first();
  return t || (console.warn(`No active alimtalk account for seller ${s}`), null);
}
__name(Gr, "Gr");
__name2(Gr, "Gr");
async function xs(e, s) {
  await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(s.seller_id, s.template_code, s.recipient_phone, s.message, s.cost, s.status, s.order_id || null).run();
}
__name(xs, "xs");
__name2(xs, "xs");
async function Xr(e, s, t) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(t, s).run();
}
__name(Xr, "Xr");
__name2(Xr, "Xr");
async function Qr(e, s) {
  try {
    const { order: t, products: r } = await zr(e.DB, s), a = await Gr(e.DB, t.seller_id);
    if (!a) return console.warn(`Skipping alimtalk for order ${s}: no active account`), { success: false, reason: "no_account" };
    const o = 15;
    if (a.balance < o) return console.warn(`Skipping alimtalk for order ${s}: insufficient balance`), { success: false, reason: "insufficient_balance" };
    const n = r.map((l) => `${l.name} ${l.quantity}\uAC1C (${l.price.toLocaleString()}\uC6D0)`).join(`
`), i = `[\uC8FC\uBB38 \uD655\uC778]

\uC8FC\uBB38\uBC88\uD638: ${t.order_number}
\uC8FC\uBB38\uC77C\uC2DC: ${new Date(t.created_at).toLocaleString("ko-KR")}

\uC8FC\uBB38 \uC0C1\uD488:
${n}

\uCD1D \uACB0\uC81C\uAE08\uC561: ${t.total_amount.toLocaleString()}\uC6D0

\uBC30\uC1A1\uC9C0: ${t.shipping_address}
\uC218\uB839\uC778: ${t.shipping_name}
\uC5F0\uB77D\uCC98: ${t.shipping_phone}

\uC8FC\uBB38\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4!`, c = await As(e, { senderKey: a.sender_key, templateCode: "order_confirm", to: t.buyer_phone, message: i });
    return c.success ? (await Xr(e.DB, t.seller_id, o), await xs(e.DB, { seller_id: t.seller_id, template_code: "order_confirm", recipient_phone: t.buyer_phone, message: i, cost: o, status: "sent", order_id: s }), console.log(`Order confirmation sent for order ${s}`), { success: true }) : (await xs(e.DB, { seller_id: t.seller_id, template_code: "order_confirm", recipient_phone: t.buyer_phone, message: i, cost: 0, status: "failed", order_id: s }), console.error(`Failed to send order confirmation for order ${s}:`, c.error), { success: false, error: c.error });
  } catch (t) {
    return console.error(`Error sending order confirmation for order ${s}:`, t), { success: false, error: t.message };
  }
}
__name(Qr, "Qr");
__name2(Qr, "Qr");
function Zr(e, s) {
  let t = e;
  return Object.entries(s).forEach(([r, a]) => {
    const o = new RegExp(`#{${r}}`, "g");
    t = t.replace(o, a);
  }), t;
}
__name(Zr, "Zr");
__name2(Zr, "Zr");
function ea(e, s) {
  const r = Array.from(e.matchAll(/#{(\w+)}/g), (a) => a[1]).filter((a) => !s[a]);
  return { valid: r.length === 0, missingVars: r };
}
__name(ea, "ea");
__name2(ea, "ea");
async function sa(e, s, t) {
  const r = await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(s).first();
  if (!r) throw new Error(`Account not found: ${s}`);
  return { sufficient: r.balance >= t, currentBalance: r.balance };
}
__name(sa, "sa");
__name2(sa, "sa");
async function ta(e, s, t) {
  const r = await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(t, s, t).run();
  if (!r.success || r.meta.changes === 0) throw new Error("Insufficient balance or account not found");
}
__name(ta, "ta");
__name2(ta, "ta");
async function Hs(e, s, t) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t, s).run();
}
__name(Hs, "Hs");
__name2(Hs, "Hs");
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
async function ra(e, s, t, r) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t, r, s).run();
}
__name(ra, "ra");
__name2(ra, "ra");
async function aa(e, s, t, r, a, o, n, i, c) {
  try {
    const l = { ...i, ...n.variables }, u = Zr(r, l), d = await As(e, { senderKey: a, templateCode: o, to: n.phone, message: u });
    return d.success ? (await Rs(e.DB, { accountId: s, templateId: t, recipientPhone: n.phone, messageContent: u, status: "sent", cost: c, aligoMessageId: d.messageId }), { phone: n.phone, status: "sent", messageId: d.messageId, cost: c }) : (await Rs(e.DB, { accountId: s, templateId: t, recipientPhone: n.phone, messageContent: u, status: "failed", cost: 0, failedReason: d.error }), await Hs(e.DB, s, c), { phone: n.phone, status: "failed", error: d.error, cost: 0 });
  } catch (l) {
    return console.error(`Failed to send alimtalk to ${n.phone}:`, l), await Rs(e.DB, { accountId: s, templateId: t, recipientPhone: n.phone, messageContent: "", status: "failed", cost: 0, failedReason: l.message }), await Hs(e.DB, s, c), { phone: n.phone, status: "failed", error: l.message, cost: 0 };
  }
}
__name(aa, "aa");
__name2(aa, "aa");
async function Ns(e, s) {
  const { accountId: t, templateId: r, recipients: a, variables: o } = s;
  console.log(`[Alimtalk] Starting bulk send: ${a.length} recipients`);
  try {
    const n = await e.DB.prepare(`
      SELECT 
        id,
        sender_key,
        balance,
        status
      FROM alimtalk_accounts
      WHERE id = ?
    `).bind(t).first();
    if (!n) throw new Error("Account not found");
    if (n.status !== "active") throw new Error("Account is not active");
    const i = await e.DB.prepare(`
      SELECT 
        id,
        template_code,
        template_content,
        status
      FROM alimtalk_templates
      WHERE id = ? AND account_id = ?
    `).bind(r, t).first();
    if (!i) throw new Error("Template not found");
    if (i.status !== "approved") throw new Error("Template is not approved");
    const c = ea(i.template_content, o);
    if (!c.valid) throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);
    const l = 15, u = a.length * l, d = await sa(e.DB, t, u);
    if (!d.sufficient) throw new Error(`Insufficient balance. Required: ${u}, Current: ${d.currentBalance}`);
    await ta(e.DB, t, u), console.log(`[Alimtalk] Deducted ${u} points from account ${t}`);
    const m = [];
    let _ = 0, f = 0, g = 0;
    for (const b of a) {
      const w = await aa(e, t, r, i.template_content, n.sender_key, i.template_code, b, o, l);
      m.push(w), w.status === "sent" ? _++ : (f++, g += l), m.length % 10 === 0 && await new Promise((h) => setTimeout(h, 1e3));
    }
    return await ra(e.DB, t, _, f), console.log(`[Alimtalk] Completed: ${_} sent, ${f} failed, ${g} refunded`), { success: true, totalRecipients: a.length, successCount: _, failedCount: f, refundedAmount: g, messages: m };
  } catch (n) {
    return console.error("[Alimtalk] Bulk send failed:", n), { success: false, totalRecipients: a.length, successCount: 0, failedCount: a.length, refundedAmount: 0, messages: [], error: n.message };
  }
}
__name(Ns, "Ns");
__name2(Ns, "Ns");
async function oa(e, s, t, r, a) {
  const o = await e.DB.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(r).first();
  if (!o) throw new Error(`Order not found: ${r}`);
  const i = (await e.DB.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(r).all()).results.map((u) => `${u.name} ${u.quantity}\uAC1C (${u.price.toLocaleString()}\uC6D0)`).join(`
`), c = { orderNumber: o.order_number, orderDate: new Date(o.created_at).toLocaleString("ko-KR"), productList: i, totalAmount: o.total_amount.toLocaleString(), shippingAddress: o.shipping_address, shippingName: o.shipping_name, shippingPhone: o.shipping_phone, buyerName: o.buyer_name, customMessage: a || "\uAC10\uC0AC\uD569\uB2C8\uB2E4!" }, l = [{ phone: o.buyer_phone, name: o.buyer_name }];
  return Ns(e, { accountId: s, templateId: t, recipients: l, variables: c });
}
__name(oa, "oa");
__name2(oa, "oa");
async function na(e, s, t, r, a = {}) {
  const o = r.map((n) => ({ phone: n.phone, name: n.name, variables: Object.entries(n).filter(([i]) => i !== "phone" && i !== "name").reduce((i, [c, l]) => ({ ...i, [c]: l }), {}) }));
  return Ns(e, { accountId: s, templateId: t, recipients: o, variables: a });
}
__name(na, "na");
__name2(na, "na");
function ia(e, s = 0.1) {
  return Math.floor(e * s);
}
__name(ia, "ia");
__name2(ia, "ia");
function ca() {
  const e = /* @__PURE__ */ new Date(), s = new Date(e.getFullYear(), e.getMonth() - 1, 1), t = s.getFullYear(), r = String(s.getMonth() + 1).padStart(2, "0"), a = new Date(t, s.getMonth() + 1, 0).getDate();
  return { startDate: `${t}-${r}-01`, endDate: `${t}-${r}-${a}` };
}
__name(ca, "ca");
__name2(ca, "ca");
async function la(e, s, t) {
  try {
    const r = await e.prepare(`
      SELECT id, business_name FROM sellers WHERE id = ?
    `).bind(s).first();
    if (!r) return null;
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
    `).bind(s, t.startDate, t.endDate).all();
    if (!a.results || a.results.length === 0) return { seller_id: s, seller_name: r.business_name, total_sales: 0, total_orders: 0, platform_fee: 0, shipping_fee: 0, refund_amount: 0, settlement_amount: 0, orders: [] };
    const o = [];
    let n = 0, i = 0, c = 0;
    for (const m of a.results) {
      const _ = m.total_amount - m.shipping_fee, f = ia(_);
      o.push({ order_id: m.id, order_number: m.order_number, order_date: m.created_at, product_name: m.product_names || "", quantity: m.total_quantity || 1, price: _, shipping_fee: m.shipping_fee || 0, platform_fee: f, status: m.status }), n += _, i += m.shipping_fee || 0, c += f;
    }
    const l = await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(s, t.startDate, t.endDate).first(), u = (l == null ? void 0 : l.refund_amount) || 0, d = n - c - u + i;
    return { seller_id: s, seller_name: r.business_name, total_sales: n, total_orders: o.length, platform_fee: c, shipping_fee: i, refund_amount: u, settlement_amount: d, orders: o };
  } catch (r) {
    return console.error(`Failed to calculate settlement for seller ${s}:`, r), null;
  }
}
__name(la, "la");
__name2(la, "la");
async function ua(e, s) {
  console.log(`[Settlement] Generating report for ${s.startDate} ~ ${s.endDate}`);
  const t = await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(s.startDate, s.endDate).all(), r = [];
  let a = 0, o = 0, n = 0;
  for (const c of t.results) {
    const l = await la(e, c.id, s);
    l && (r.push(l), a += l.total_sales, o += l.platform_fee, n += l.settlement_amount);
  }
  const i = { period: s, generated_at: (/* @__PURE__ */ new Date()).toISOString(), total_sales: a, total_platform_fee: o, total_settlement: n, sellers: r };
  return console.log(`[Settlement] Report generated: ${r.length} sellers, ${a.toLocaleString()}\uC6D0`), i;
}
__name(ua, "ua");
__name2(ua, "ua");
async function da(e, s) {
  const r = (await e.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(s.period.startDate, s.period.endDate, s.total_sales, s.total_platform_fee, s.total_settlement, s.generated_at).run()).meta.last_row_id;
  for (const a of s.sellers) await e.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a.seller_id, a.total_sales, a.total_orders, a.platform_fee, a.shipping_fee, a.refund_amount, a.settlement_amount).run();
  console.log(`[Settlement] Report saved: ID ${r}`);
}
__name(da, "da");
__name2(da, "da");
async function pa(e, s) {
  const t = await e.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(s).first();
  if (!t) return null;
  const a = (await e.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(s).all()).results.map((o) => ({ seller_id: o.seller_id, seller_name: o.seller_name, total_sales: o.total_sales, total_orders: o.total_orders, platform_fee: o.platform_fee, shipping_fee: o.shipping_fee, refund_amount: o.refund_amount, settlement_amount: o.settlement_amount, orders: [] }));
  return { period: { startDate: t.period_start, endDate: t.period_end }, generated_at: t.generated_at, total_sales: t.total_sales, total_platform_fee: t.total_platform_fee, total_settlement: t.total_settlement, sellers: a };
}
__name(pa, "pa");
__name2(pa, "pa");
async function ma(e, s) {
  const t = new TextEncoder();
  let r;
  const a = new ReadableStream({ async start(o) {
    console.log(`[SSE] Client connected to stream ${e}`);
    try {
      const n = await s.DB.prepare(`
          SELECT 
            id,
            title,
            status,
            viewer_count,
            like_count
          FROM live_streams
          WHERE id = ?
        `).bind(e).first();
      if (n) {
        const i = { type: "status", data: n, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, c = JSON.stringify(i);
        o.enqueue(t.encode(`data: ${c}

`));
      }
    } catch (n) {
      console.error("[SSE] Failed to fetch initial data:", n);
    }
    r = setInterval(async () => {
      try {
        const n = await s.DB.prepare(`
            SELECT 
              viewer_count,
              like_count,
              comment_count
            FROM live_streams
            WHERE id = ?
          `).bind(e).first();
        if (n) {
          const i = { type: "viewer_count", data: n, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, c = JSON.stringify(i);
          o.enqueue(t.encode(`data: ${c}

`));
        }
        o.enqueue(t.encode(`: ping

`));
      } catch (n) {
        console.error("[SSE] Update failed:", n);
      }
    }, 3e4);
  }, cancel() {
    console.log(`[SSE] Client disconnected from stream ${e}`), r && clearInterval(r);
  } });
  return new Response(a, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(ma, "ma");
__name2(ma, "ma");
async function _a(e, s) {
  const t = new TextEncoder();
  let r = 0, a;
  const o = new ReadableStream({ async start(n) {
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
        r = i.results[0].id;
        const c = { type: "chat", data: i.results.reverse(), timestamp: (/* @__PURE__ */ new Date()).toISOString() }, l = JSON.stringify(c);
        n.enqueue(t.encode(`data: ${l}

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
          `).bind(e, r).all();
        if (i.results.length > 0) {
          r = i.results[i.results.length - 1].id;
          const c = { type: "chat", data: i.results, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, l = JSON.stringify(c);
          n.enqueue(t.encode(`data: ${l}

`));
        } else n.enqueue(t.encode(`: ping

`));
      } catch (i) {
        console.error("[SSE Chat] Polling failed:", i);
      }
    }, 5e3);
  }, cancel() {
    console.log(`[SSE Chat] Client disconnected from stream ${e}`), a && clearInterval(a);
  } });
  return new Response(o, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(_a, "_a");
__name2(_a, "_a");
async function fa(e, s) {
  const t = new TextEncoder();
  let r = 0, a;
  const o = new ReadableStream({ async start(n) {
    console.log(`[SSE Orders] Seller ${e} connected`);
    try {
      const i = await s.DB.prepare(`
          SELECT id FROM orders
          WHERE seller_id = ?
          ORDER BY id DESC
          LIMIT 1
        `).bind(e).first();
      i && (r = i.id);
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
          `).bind(e, r).all();
        if (i.results.length > 0) {
          r = i.results[i.results.length - 1].id;
          const c = { type: "order", data: i.results, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, l = JSON.stringify(c);
          n.enqueue(t.encode(`data: ${l}

`));
        } else n.enqueue(t.encode(`: ping

`));
      } catch (i) {
        console.error("[SSE Orders] Polling failed:", i);
      }
    }, 1e4);
  }, cancel() {
    console.log(`[SSE Orders] Seller ${e} disconnected`), a && clearInterval(a);
  } });
  return new Response(o, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(fa, "fa");
__name2(fa, "fa");
async function Ea(e, s) {
  const t = new TextEncoder();
  let r;
  const a = new ReadableStream({ async start(o) {
    console.log(`[SSE Stock] Seller ${e} connected`), r = setInterval(async () => {
      try {
        const n = await s.DB.prepare(`
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
        if (n.results.length > 0) {
          const i = { type: "stock", data: n.results, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, c = JSON.stringify(i);
          o.enqueue(t.encode(`data: ${c}

`));
        } else o.enqueue(t.encode(`: ping

`));
      } catch (n) {
        console.error("[SSE Stock] Polling failed:", n);
      }
    }, 6e4);
  }, cancel() {
    console.log(`[SSE Stock] Seller ${e} disconnected`), r && clearInterval(r);
  } });
  return new Response(a, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(Ea, "Ea");
__name2(Ea, "Ea");
async function ha(e, s, t, r) {
  await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s, t, r.endpoint, r.keys.p256dh, r.keys.auth).run(), console.log(`[Push] Subscription saved for ${t} ${s}`);
}
__name(ha, "ha");
__name2(ha, "ha");
async function ga(e, s) {
  await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(s).run(), console.log(`[Push] Subscription deleted: ${s}`);
}
__name(ga, "ga");
__name2(ga, "ga");
function ya(e) {
  if (e.req.method !== "GET") return false;
  const s = e.req.header("Authorization"), t = e.req.header("X-Session-Token");
  if (s || t) return false;
  const a = new URL(e.req.url).pathname;
  return !(a.includes("/api/products/") && a.includes("/stock") || a.includes("/api/streams/") && a.includes("/status") || a.includes("/current-product") || a.includes("/api/chat") || a.includes("/api/sse") || a.includes("/api/orders") || a.includes("/api/payment"));
}
__name(ya, "ya");
__name2(ya, "ya");
function wa(e, s) {
  return s || new URL(e.req.url).toString();
}
__name(wa, "wa");
__name2(wa, "wa");
function ba(e) {
  const s = [];
  return s.push("public"), s.push(`max-age=${e.ttl}`), e.sMaxAge !== void 0 ? s.push(`s-maxage=${e.sMaxAge}`) : s.push(`s-maxage=${e.ttl}`), e.staleWhileRevalidate && s.push(`stale-while-revalidate=${e.staleWhileRevalidate}`), s.join(", ");
}
__name(ba, "ba");
__name2(ba, "ba");
function Cs(e) {
  return async (s, t) => {
    var i;
    if (e.skipCache || !ya(s)) return t();
    const r = wa(s, e.cacheKey), a = caches.default;
    let o = await a.match(r);
    if (o) {
      console.log(`[Cache HIT] ${r}`);
      const c = new Headers(o.headers);
      return c.set("X-Cache", "HIT"), c.set("X-Cache-Key", r), new Response(o.body, { status: o.status, statusText: o.statusText, headers: c });
    }
    console.log(`[Cache MISS] ${r}`), await t();
    const n = s.res;
    if (n.status >= 200 && n.status < 300) {
      const c = ba(e);
      n.headers.set("Cache-Control", c), n.headers.set("X-Cache", "MISS"), n.headers.set("X-Cache-Key", r);
      const l = e.varyBy || ["Accept-Encoding"];
      n.headers.set("Vary", l.join(", "));
      const u = n.clone();
      (i = s.executionCtx) == null || i.waitUntil(a.put(r, u));
    }
  };
}
__name(Cs, "Cs");
__name2(Cs, "Cs");
var js = { products: { ttl: 10, sMaxAge: 60, staleWhileRevalidate: 120 }, liveStreams: { ttl: 5, sMaxAge: 10, staleWhileRevalidate: 30 }, microCache: { ttl: 10, sMaxAge: 10, staleWhileRevalidate: 30 } };
var Sa = class extends Error {
  static {
    __name(this, "Sa");
  }
  static {
    __name2(this, "Sa");
  }
  constructor(s, t, r, a) {
    super(r), this.statusCode = s, this.code = t, this.details = a, this.name = "AppError", Error.captureStackTrace(this, this.constructor);
  }
};
async function Ta(e, s, t, r) {
  if (e) try {
    const a = { title: `\u2705 ${s}`, description: t, color: 3066993, fields: [], timestamp: (/* @__PURE__ */ new Date()).toISOString(), footer: { text: "UR LIVE Monitor" } };
    if (r) for (const [o, n] of Object.entries(r)) a.fields.push({ name: o, value: String(n), inline: true });
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [a] }) });
  } catch (a) {
    console.error("[Discord] Failed to send success alert:", a);
  }
}
__name(Ta, "Ta");
__name2(Ta, "Ta");
async function Ra(e, s, t) {
  if (e) try {
    const r = ["\u{1F4CA} **KV \uC0AC\uC6A9\uB7C9 \uACBD\uACE0**", "", "\uD604\uC7AC \uC0AC\uC6A9\uB7C9:", `\u2022 \uC77D\uAE30: ${s.toFixed(1)}%`, `\u2022 \uC4F0\uAE30: ${t.toFixed(1)}%`, "", "50% \uC774\uC0C1 \uC0AC\uC6A9 \uC911\uC785\uB2C8\uB2E4. \uC720\uB8CC \uD50C\uB79C \uC5C5\uADF8\uB808\uC774\uB4DC\uB97C \uACE0\uB824\uD558\uC138\uC694.", "https://dash.cloudflare.com"].join(`
`);
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: r }) });
  } catch (r) {
    console.error("[Discord] Failed to send KV warning:", r);
  }
}
__name(Ra, "Ra");
__name2(Ra, "Ra");
var Ia = class {
  static {
    __name(this, "Ia");
  }
  static {
    __name2(this, "Ia");
  }
  constructor(s) {
    this.accessToken = null, this.tokenExpiry = 0, this.databaseURL = s.FIREBASE_DATABASE_URL, this.projectId = s.FIREBASE_PROJECT_ID, this.privateKey = s.FIREBASE_PRIVATE_KEY, this.clientEmail = s.FIREBASE_CLIENT_EMAIL, (!this.databaseURL || !this.projectId || !this.privateKey || !this.clientEmail) && console.warn("\u26A0\uFE0F Firebase Admin credentials not configured, using unauthenticated mode");
  }
  async set(s, t) {
    const r = `${this.databaseURL}/${s}.json`, a = await fetch(r, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    if (!a.ok) {
      const o = await a.text();
      throw console.error(`\u274C Firebase set failed for ${s}:`, o), new Error(`Firebase set failed: ${a.statusText}`);
    }
    console.log(`\u2705 Firebase: Set data at ${s}`);
  }
  async update(s, t) {
    const r = `${this.databaseURL}/${s}.json`, a = await fetch(r, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    if (!a.ok) {
      const o = await a.text();
      throw console.error(`\u274C Firebase update failed for ${s}:`, o), new Error(`Firebase update failed: ${a.statusText}`);
    }
    console.log(`\u2705 Firebase: Updated data at ${s}`);
  }
  async get(s) {
    const t = `${this.databaseURL}/${s}.json`, r = await fetch(t, { method: "GET" });
    if (!r.ok) throw new Error(`Firebase get failed: ${r.statusText}`);
    return await r.json();
  }
  async delete(s) {
    const t = `${this.databaseURL}/${s}.json`, r = await fetch(t, { method: "DELETE" });
    if (!r.ok) throw new Error(`Firebase delete failed: ${r.statusText}`);
    console.log(`\u2705 Firebase: Deleted data at ${s}`);
  }
  async updateStreamStatus(s, t) {
    try {
      await this.update(`streams/stream${s}`, { ...t, updated_at: Date.now() }), console.log(`\u2705 Firebase: Stream ${s} updated`, t);
    } catch (r) {
      console.error(`\u274C Firebase: Failed to update stream ${s}`, r);
    }
  }
  async updateProductStock(s, t, r) {
    try {
      await this.update(`products/product${s}`, { id: s, stock: t, ...r, updated_at: Date.now() }), console.log(`\u2705 Firebase: Product ${s} stock updated to ${t}`);
    } catch (a) {
      console.error(`\u274C Firebase: Failed to update product ${s}`, a);
    }
  }
  async changeCurrentProduct(s, t) {
    try {
      await this.updateStreamStatus(s, { current_product_id: t }), console.log(`\u2705 Firebase: Stream ${s} current product changed to ${t}`);
    } catch (r) {
      console.error(`\u274C Firebase: Failed to change product for stream ${s}`, r);
    }
  }
  async sendLowStockAlert(s, t, r) {
    try {
      const a = `chats/stream${s}`, o = Date.now();
      await this.set(`${a}/alert_${o}`, { username: "\uC2DC\uC2A4\uD15C", text: `\u26A0\uFE0F ${t}\uC758 \uC7AC\uACE0\uAC00 ${r}\uAC1C \uB0A8\uC558\uC2B5\uB2C8\uB2E4!`, timestamp: o, isSystem: true }), console.log(`\u2705 Firebase: Low stock alert sent for stream ${s}`);
    } catch (a) {
      console.error("\u274C Firebase: Failed to send low stock alert", a);
    }
  }
  async sendSoldOutAlert(s, t) {
    try {
      const r = `chats/stream${s}`, a = Date.now();
      await this.set(`${r}/soldout_${a}`, { username: "\uC2DC\uC2A4\uD15C", text: `\u{1F534} ${t}\uC774(\uAC00) \uD488\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4!`, timestamp: a, isSystem: true }), console.log(`\u2705 Firebase: Sold out alert sent for stream ${s}`);
    } catch (r) {
      console.error("\u274C Firebase: Failed to send sold out alert", r);
    }
  }
  async createCustomToken(s, t) {
    try {
      if (console.log(`[Firebase Custom Token] Creating for UID: ${s}`), !this.privateKey || !this.clientEmail || !this.projectId) throw new Error("Firebase credentials not configured");
      const r = { alg: "RS256", typ: "JWT" }, a = Math.floor(Date.now() / 1e3), o = { iss: this.clientEmail, sub: this.clientEmail, aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit", iat: a, exp: a + 3600, uid: s, claims: t || {} }, n = /* @__PURE__ */ __name2((w) => {
        const h = JSON.stringify(w);
        return btoa(h).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      }, "n"), i = n(r), c = n(o), l = `${i}.${c}`, u = this.privateKey.replace(/\\n/g, `
`), d = await this.pemToDer(u), m = await crypto.subtle.importKey("pkcs8", d, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]), _ = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", m, new TextEncoder().encode(l)), g = btoa(String.fromCharCode(...new Uint8Array(_))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""), b = `${l}.${g}`;
      return console.log("[Firebase Custom Token] \u2705 Token created successfully"), b;
    } catch (r) {
      throw console.error("[Firebase Custom Token] \u274C Failed to create token:", r), new Error("Failed to create Firebase custom token");
    }
  }
  async pemToDer(s) {
    const a = s.substring("-----BEGIN PRIVATE KEY-----".length, s.length - "-----END PRIVATE KEY-----".length - 1).trim(), o = atob(a), n = new Uint8Array(o.length);
    for (let i = 0; i < o.length; i++) n[i] = o.charCodeAt(i);
    return n.buffer;
  }
};
function ns(e) {
  return new Ia(e);
}
__name(ns, "ns");
__name2(ns, "ns");
var le = /* @__PURE__ */ new Map();
var V = { hits: 0, misses: 0, writes: 0, evictions: 0 };
function we(e) {
  const s = le.get(e);
  return s ? s.expires < Date.now() ? (le.delete(e), V.evictions++, V.misses++, null) : (V.hits++, s.data) : (V.misses++, null);
}
__name(we, "we");
__name2(we, "we");
function Z(e, s, t) {
  const r = Date.now() + t * 1e3;
  if (le.set(e, { data: s, expires: r }), V.writes++, le.size > 1e3) {
    const a = le.keys().next().value;
    a && (le.delete(a), V.evictions++);
  }
}
__name(Z, "Z");
__name2(Z, "Z");
function va(e) {
  let s = 0;
  for (const t of le.keys()) t.includes(e) && (le.delete(t), s++);
  return s;
}
__name(va, "va");
__name2(va, "va");
async function Be(e, s) {
  const t = Array.isArray(s) ? s : [s];
  for (const r of t) {
    const a = va(r);
    a > 0 && console.log(`[Cache] \u{1F9F9} \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uC0AD\uC81C: ${r} (${a}\uAC1C)`);
    try {
      await e.CACHE_KV.delete(r), console.log(`[Cache] \u{1F9F9} KV \uCE90\uC2DC \uC0AD\uC81C: ${r}`);
    } catch (o) {
      console.error(`[Cache] \u274C KV \uCE90\uC2DC \uC0AD\uC81C \uC2E4\uD328: ${r}`, o);
    }
  }
}
__name(Be, "Be");
__name2(Be, "Be");
var Ke = { LIVE_STREAMS: ["streams:live", "streams:all", "streams:scheduled", "live_streams:live:all:20:0", "live_streams:"], PRODUCTS: ["products:", "featured_products"], CART: /* @__PURE__ */ __name2((e) => [`cart:${e}`], "CART"), ORDERS: /* @__PURE__ */ __name2((e) => [`orders:${e}`], "ORDERS"), ALL: ["streams:", "live_streams:", "products:", "cart:", "orders:"] };
function Da(e) {
  const s = e.status >= 500 ? "error" : e.status >= 400 ? "warn" : "info";
  console.log(JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: s, message: "API Request", context: e, duration: e.duration }));
}
__name(Da, "Da");
__name2(Da, "Da");
function Oa(e) {
  return { name: "tosspayments", async confirmPayment(s) {
    try {
      const t = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: `Basic ${btoa(e + ":")}`, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify({ paymentKey: s.paymentKey, orderId: s.orderId, amount: s.amount }) }), r = await t.json();
      if (!t.ok) return { success: false, orderId: s.orderId, paymentKey: s.paymentKey, method: "", totalAmount: s.amount, status: "FAILED", approvedAt: "", error: r.message || "\uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328", rawData: r };
      let a = {};
      r.card && (a = { cardCompany: r.card.company, cardNumber: r.card.number, installmentMonths: r.card.installmentPlanMonths || 0 });
      let o = {};
      return r.virtualAccount && (o = { virtualAccountBank: r.virtualAccount.bankCode, virtualAccountNumber: r.virtualAccount.accountNumber, virtualAccountHolder: r.virtualAccount.customerName, virtualAccountDueDate: r.virtualAccount.dueDate }), { success: true, orderId: r.orderId, paymentKey: r.paymentKey, method: r.method, totalAmount: r.totalAmount, status: r.status, approvedAt: r.approvedAt, transactionId: r.transactionKey, ...a, ...o, rawData: r };
    } catch (t) {
      return { success: false, orderId: s.orderId, paymentKey: s.paymentKey, method: "", totalAmount: s.amount, status: "FAILED", approvedAt: "", error: t.message, rawData: null };
    }
  }, async cancelPayment(s) {
    try {
      const t = { cancelReason: s.cancelReason };
      s.cancelAmount && (t.cancelAmount = s.cancelAmount);
      const r = await fetch(`https://api.tosspayments.com/v1/payments/${s.paymentKey}/cancel`, { method: "POST", headers: { Authorization: `Basic ${btoa(e + ":")}`, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(t) }), a = await r.json();
      return r.ok ? { success: true, canceledAt: a.canceledAt || (/* @__PURE__ */ new Date()).toISOString(), rawData: a } : { success: false, error: a.message || "\uCDE8\uC18C \uC2E4\uD328" };
    } catch (t) {
      return { success: false, error: t.message };
    }
  }, async getPayment(s) {
    try {
      const t = await fetch(`https://api.tosspayments.com/v1/payments/${s}`, { method: "GET", headers: { Authorization: `Basic ${btoa(e + ":")}`, "TossPayments-API-Version": "2022-11-16" } }), r = await t.json();
      if (!t.ok) throw new Error(r.message);
      return { success: true, orderId: r.orderId, paymentKey: r.paymentKey, method: r.method, totalAmount: r.totalAmount, status: r.status, approvedAt: r.approvedAt, rawData: r };
    } catch (t) {
      throw t;
    }
  } };
}
__name(Oa, "Oa");
__name2(Oa, "Oa");
function ka(e, s) {
  switch (e.toLowerCase()) {
    case "tosspayments":
      return Oa(s);
    default:
      throw new Error(`Unknown payment provider: ${e}`);
  }
}
__name(ka, "ka");
__name2(ka, "ka");
var p = new yt();
p.use("*", async (e, s) => {
  if (e.req.url.includes("localhost") || e.req.url.includes("127.0.0.1")) try {
    wr(e.env), br(e.env);
  } catch (r) {
    console.error("[ENV] Validation failed:", r);
  }
  await s();
});
async function Aa(e) {
  try {
    const s = e.req.header("Authorization"), t = (s == null ? void 0 : s.replace("Bearer ", "")) || "";
    if (!t) return console.warn("[Firebase Auth] No token provided"), null;
    try {
      const { verifyFirebaseIdToken: r } = await Promise.resolve().then(() => za), a = await r(t, e.env.FIREBASE_PROJECT_ID || "urteam-live-commerce-5b284");
      console.log("[Firebase Auth] \u2705 Firebase token verified:", a.uid);
      const o = await e.env.DB.prepare(`
        SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?
      `).bind(a.uid).first();
      if (!o) return console.warn("[Firebase Auth] User not found for UID:", a.uid), null;
      const n = a.role || o.user_type || "user";
      return console.log("[Firebase Auth] \u2705 User authenticated:", { userId: o.id, userType: n, email: o.email, firebaseUID: a.uid }), { userId: o.id, userType: n, email: o.email, firebaseUID: a.uid };
    } catch (r) {
      return console.error("[Firebase Auth] Token verification failed:", r), null;
    }
  } catch (s) {
    return console.error("[Firebase Auth Error]", s), null;
  }
}
__name(Aa, "Aa");
__name2(Aa, "Aa");
async function Ne(e, s, t) {
  if (!s) return null;
  const r = `session:${s}`;
  try {
    const a = we(r);
    if (a) return a;
    const o = await e.get(r);
    if (!o) return null;
    const n = JSON.parse(o);
    if (n.expires_at && Date.now() > n.expires_at) return t != null && t.executionCtx || await e.delete(r), null;
    const i = { user_id: n.user_id, user_type: n.user_type || "user", created_at: n.created_at };
    return Z(r, i, 900), i;
  } catch (a) {
    return console.error("[Auth] Session lookup error:", a), null;
  }
}
__name(Ne, "Ne");
__name2(Ne, "Ne");
async function j(e, s) {
  const t = await Aa(e);
  if (!t) return e.json({ success: false, error: "Authentication required - Firebase ID Token \uD544\uC694", code: "AUTH_REQUIRED" }, 401);
  e.set("user", { userId: t.userId, userType: t.userType, email: t.email, firebaseUID: t.firebaseUID }), e.set("userId", t.userId), e.set("userType", t.userType), e.set("email", t.email), e.set("firebaseUID", t.firebaseUID), await s();
}
__name(j, "j");
__name2(j, "j");
async function Na(e, s) {
  const t = e.get("userType"), r = e.get("userId");
  if (t !== "admin") return console.warn("[Security] Unauthorized admin access attempt:", { userId: r, userType: t }), e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await s();
}
__name(Na, "Na");
__name2(Na, "Na");
async function Ca(e, s) {
  const t = e.get("userType"), r = e.get("userId");
  if (t !== "seller") return console.warn("[Security] Unauthorized seller access attempt:", { userId: r, userType: t }), e.json({ success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await s();
}
__name(Ca, "Ca");
__name2(Ca, "Ca");
async function ja(e) {
  return async (s, t) => {
    const r = s.get("userId");
    if (s.get("userType") === "admin") {
      await t();
      return;
    }
    const o = s.req.param("userId");
    if (o && o !== String(r)) return console.warn("[Security] Unauthorized resource access attempt:", { resourceType: e, requestedUserId: o, actualUserId: r }), s.json({ success: false, error: "\uBCF8\uC778\uC758 \uC815\uBCF4\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    await t();
  };
}
__name(ja, "ja");
__name2(ja, "ja");
async function La(e, s) {
  try {
    const t = we(s);
    if (t !== null) return t;
    const r = await e.get(s);
    if (r) {
      const a = JSON.parse(r);
      return Z(s, a, 300), a;
    }
    return null;
  } catch (t) {
    return console.error("[Cache] Read error:", t), null;
  }
}
__name(La, "La");
__name2(La, "La");
async function Ze(e, s, t, r = 60, a = false) {
  try {
    Z(s, t, r), a ? (await e.put(s, JSON.stringify(t), { expirationTtl: r }), console.log(`[Cache] \u2705 Saved to both Memory + KV: ${s}`)) : console.log(`[Cache] \u2705 Saved to Memory only (KV Write skipped): ${s}`);
  } catch (o) {
    console.error("[Cache] Write error:", o);
  }
}
__name(Ze, "Ze");
__name2(Ze, "Ze");
async function Ls(e, ...s) {
  try {
    await Promise.all(s.map((t) => e.delete(t)));
  } catch (t) {
    console.error("[Cache] Delete error:", t);
  }
}
__name(Ls, "Ls");
__name2(Ls, "Ls");
async function is(e, s, t, r, a, o, n) {
  try {
    await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s, t, r, a, o, n || null).run(), console.log(`[Notification] Created for ${t} ${s}: ${a}`);
  } catch (i) {
    console.error("[Notification] Create error:", i);
  }
}
__name(is, "is");
__name2(is, "is");
async function Ma(e, s, t, r, a) {
  await is(e, s, "seller", "new_order", "\u{1F6D2} \uC2E0\uADDC \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r}\uB2D8\uC758 \uC8FC\uBB38 (${t}) - ${$a(a)}`, "/seller/orders");
}
__name(Ma, "Ma");
__name2(Ma, "Ma");
async function Rt(e, s, t, r, a, o) {
  let n = "", i = "";
  switch (r) {
    case "preparing":
      n = "\u{1F4E6} \uC0C1\uD488 \uC900\uBE44 \uC911", i = `\uC8FC\uBB38\uBC88\uD638 ${t}\uC758 \uC0C1\uD488\uC744 \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4`;
      break;
    case "shipping":
      n = "\u{1F69A} \uBC30\uC1A1\uC774 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4", i = `\uC8FC\uBB38\uBC88\uD638 ${t}\uAC00 \uBC30\uC1A1 \uC911\uC785\uB2C8\uB2E4`, a && o && (i += ` (${a}: ${o})`);
      break;
    case "delivered":
      n = "\u2705 \uBC30\uC1A1 \uC644\uB8CC", i = `\uC8FC\uBB38\uBC88\uD638 ${t}\uAC00 \uBC30\uC1A1 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`;
      break;
    default:
      return;
  }
  await is(e, s, "user", "shipping_status", n, i, "/my-orders");
}
__name(Rt, "Rt");
__name2(Rt, "Rt");
async function It(e, s, t, r, a) {
  await is(e, s, "seller", "low_stock", "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", `${t}\uC758 \uC7AC\uACE0\uAC00 ${r}\uAC1C\uB85C \uBD80\uC871\uD569\uB2C8\uB2E4 (\uAE30\uC900: ${a}\uAC1C)`, "/seller/products");
}
__name(It, "It");
__name2(It, "It");
function $a(e) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(e);
}
__name($a, "$a");
__name2($a, "$a");
async function Fa(e, s, t) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const r = await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: s, description: t, scheduledStartTime: (/* @__PURE__ */ new Date()).toISOString() }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false }, contentDetails: { enableAutoStart: true, enableAutoStop: true } }) });
    if (!r.ok) {
      const d = await r.text();
      throw new Error(`YouTube Broadcast \uC0DD\uC131 \uC2E4\uD328: ${d}`);
    }
    const o = (await r.json()).id, n = await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: `${s} - Stream` }, cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" } }) });
    if (!n.ok) {
      const d = await n.text();
      throw new Error(`YouTube Stream \uC0DD\uC131 \uC2E4\uD328: ${d}`);
    }
    const i = await n.json(), c = i.id, l = i.cdn.ingestionInfo.streamName, u = i.cdn.ingestionInfo.ingestionAddress;
    return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${o}&streamId=${c}&part=snippet`, { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}` } }), { broadcastId: o, streamId: c, streamKey: l, streamUrl: u };
  } catch (r) {
    throw console.error("[YouTube API] Live broadcast creation failed:", r), r;
  }
}
__name(Fa, "Fa");
__name2(Fa, "Fa");
async function Ua(e, s) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const t = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${s}&part=status`, { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}` } });
    if (!t.ok) {
      const r = await t.text();
      throw new Error(`YouTube \uBC29\uC1A1 \uC885\uB8CC \uC2E4\uD328: ${r}`);
    }
  } catch (t) {
    throw console.error("[YouTube API] Live broadcast end failed:", t), t;
  }
}
__name(Ua, "Ua");
__name2(Ua, "Ua");
async function qa(e, s, t) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    let r = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${s}&part=snippet,authorDetails`;
    t && (r += `&pageToken=${t}`);
    const a = await fetch(r, { headers: { Authorization: `Bearer ${e.accessToken}` } });
    if (!a.ok) {
      const n = await a.text();
      throw new Error(`YouTube \uCC44\uD305 \uBA54\uC2DC\uC9C0 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${n}`);
    }
    const o = await a.json();
    return { messages: o.items || [], nextPageToken: o.nextPageToken, pollingIntervalMillis: o.pollingIntervalMillis || 5e3 };
  } catch (r) {
    throw console.error("[YouTube API] Get chat messages failed:", r), r;
  }
}
__name(qa, "qa");
__name2(qa, "qa");
async function Pa(e, s) {
  if (!e.apiKey && !e.accessToken) throw new Error("YouTube API Key \uB610\uB294 Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const t = e.accessToken ? { Authorization: `Bearer ${e.accessToken}` } : {}, r = e.accessToken ? `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}` : `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}&key=${e.apiKey}`, a = await fetch(r, { headers: t });
    if (!a.ok) {
      const l = await a.text();
      throw new Error(`YouTube \uD1B5\uACC4 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${l}`);
    }
    const o = await a.json();
    if (!o.items || o.items.length === 0) throw new Error("Video not found");
    const n = o.items[0], i = n.statistics, c = n.liveStreamingDetails;
    return { viewCount: parseInt(i.viewCount || "0"), likeCount: parseInt(i.likeCount || "0"), commentCount: parseInt(i.commentCount || "0"), concurrentViewers: c != null && c.concurrentViewers ? parseInt(c.concurrentViewers) : void 0 };
  } catch (t) {
    throw console.error("[YouTube API] Get live stats failed:", t), t;
  }
}
__name(Pa, "Pa");
__name2(Pa, "Pa");
function vt(e) {
  try {
    if (!/^https?:\/\//.test(e) && /^[\w-]{11}$/.test(e)) return e;
    const s = new URL(e);
    if (s.hostname.includes("youtube.com")) {
      const t = s.searchParams.get("v");
      if (t) return t;
      const r = s.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (r) return r[2];
    }
    if (s.hostname === "youtu.be") {
      const t = s.pathname.slice(1).split("?")[0];
      if (t && t.length === 11) return t;
    }
    return null;
  } catch {
    return null;
  }
}
__name(vt, "vt");
__name2(vt, "vt");
function Dt(e) {
  try {
    const s = new URL(e);
    if (s.hostname.includes("tiktok.com")) {
      const t = s.pathname.match(/\/video\/(\d+)/);
      if (t) return t[1];
      const r = s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (r) return r[1];
    }
    return s.hostname.includes("vm.tiktok.com") || s.hostname.includes("vt.tiktok.com") ? s.pathname.slice(1) : null;
  } catch {
    return null;
  }
}
__name(Dt, "Dt");
__name2(Dt, "Dt");
function xa(e) {
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
__name(xa, "xa");
__name2(xa, "xa");
function Ot(e) {
  try {
    const s = new URL(e);
    if (s.hostname.includes("tiktok.com")) {
      const t = s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (t) return t[1];
    }
    return s.hostname.includes("vm.tiktok.com") || s.hostname.includes("vt.tiktok.com") ? s.pathname.slice(1) : null;
  } catch {
    return null;
  }
}
__name(Ot, "Ot");
__name2(Ot, "Ot");
p.use("*", async (e, s) => {
  await s(), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");
  const t = new URL(e.req.url);
  t.hostname !== "localhost" && t.protocol === "https:" && e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("X-Frame-Options", "SAMEORIGIN"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
p.use("/api/*", S());
p.use(ke(Ae.auth));
p.use(ke(Ae.alimtalk));
p.use(ke(Ae.order));
p.use(ke(Ae.refund));
p.use(ke(Ae.cart));
p.use(ke(Ae.upload));
p.use("/api/*", ke(Ae.api));
p.use("*", async (e, s) => {
  await s(), e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"), e.header("X-Frame-Options", "DENY"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
p.use("/api/*", async (e, s) => {
  const t = Date.now(), r = e.req.method, a = e.req.path;
  await s();
  const o = Date.now() - t, n = e.res.status, i = { method: r, path: a, status: n, duration: o }, c = e.get("userId");
  c && (i.userId = c), Da(i);
});
p.use("/static/*", async (e, s) => {
  await s(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
p.use("/images/*", async (e, s) => {
  await s(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
p.use("/api/admin*", async (e, s) => {
  if (e.req.path === "/api/admin/login") return s();
  const t = await j(e, () => Promise.resolve());
  if (t) return t;
  const r = await Na(e, () => Promise.resolve());
  return r || s();
});
p.use("/api/seller*", async (e, s) => {
  if (e.req.path === "/api/seller/register") return s();
  const t = await j(e, () => Promise.resolve());
  if (t) return t;
  const r = await Ca(e, () => Promise.resolve());
  return r || s();
});
async function Ve(e, s) {
  const t = await e.get(`session:${s}`);
  if (!t) return null;
  const r = JSON.parse(t);
  return r.expires_at && Date.now() > r.expires_at ? (await e.delete(`session:${s}`), null) : { session_token: s, [`${r.user_type}_id`]: r.user_id, user_type: r.user_type, ...r.userData };
}
__name(Ve, "Ve");
__name2(Ve, "Ve");
p.post("/api/auth/user/register", S(), Pr(Kr), async (e) => {
  const { DB: s } = e.env;
  try {
    const { email: t, password: r, name: a, phone: o } = e.get("validatedData"), n = `placeholder_hash_for_${r}`;
    try {
      const c = (await s.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(t, n, a, o || null).run()).meta.last_row_id, l = `user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      return e.json({ success: true, data: { access_token: l, user: { id: c, email: t, name: a, phone: o } } });
    } catch (i) {
      const c = i.message || "";
      if (c.includes("UNIQUE") || c.includes("unique")) return e.json({ success: false, error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
      throw i;
    }
  } catch (t) {
    return console.error("[User Register] Error:", t), e.json({ success: false, error: t.message || "\uD68C\uC6D0\uAC00\uC785 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
p.post("/api/auth/user/login", S(), async (e) => {
  const { DB: s, SESSION_KV: t } = e.env;
  try {
    const { email: r, password: a } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const o = await s.prepare(`
      SELECT id, email, name, kakao_id, password_hash, password, created_at
      FROM users 
      WHERE email = ?
    `).bind(r).first();
    if (!o) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(o.password_hash && o.password_hash.includes(`placeholder_hash_for_${a}`) || o.password && o.password === a)) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    await s.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(o.id).run();
    const i = crypto.randomUUID(), c = Date.now() + 720 * 60 * 60 * 1e3;
    return await t.put(`session:${i}`, JSON.stringify({ user_id: o.id, user_type: "user", expires_at: c, created_at: Date.now() }), { expirationTtl: 720 * 60 * 60 }), console.log("[User Login] Session created in SESSION_KV for user:", o.id), e.json({ success: true, data: { session_token: i, user: { id: o.id, email: o.email, name: o.name, phone: o.phone, profile_image: o.profile_image } } });
  } catch (r) {
    return console.error("[User Login] Error:", r), e.json({ success: false, error: r.message || "\uB85C\uADF8\uC778 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
p.post("/api/auth/login", S(), async (e) => e.json({ success: false, error: "This endpoint is deprecated. Please use Firebase Authentication.", message: "Admin/Seller login should use /api/admin/login or /api/seller/login with Firebase Auth", code: "DEPRECATED_ENDPOINT" }, 410));
p.post("/api/auth/logout", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token");
    return t && await e.env.SESSION_KV.delete(`session:${t}`), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/register", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { email: t, password: r, name: a, phone: o, business_number: n, company_name: i } = await e.req.json();
    if (!t || !r || !a || !o) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (r.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const c = t.split("@")[0], l = `placeholder_hash_for_${r}`;
    try {
      const u = await s.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c, t, l, a, o, n || null, i || null).run();
      return e.json({ success: true, data: { sellerId: u.meta.last_row_id, message: "\uD68C\uC6D0\uAC00\uC785\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uD6C4 \uB85C\uADF8\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." } });
    } catch (u) {
      const d = u.message || "";
      if (d.includes("UNIQUE") || d.includes("unique")) return e.json({ success: false, error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
      throw u;
    }
  } catch (t) {
    return console.error("Seller registration error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/admin/login", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { email: t, password: r } = await e.req.json();
    if (!t || !r) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const a = await s.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        password_hash, 
        name, 
        is_active, 
        last_login_at
      FROM admins 
      WHERE email = ?
    `).bind(t).first();
    if (!a) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(t === "admin@example.com" && r === "admin123" || a.password_hash && a.password_hash.includes(`placeholder_hash_for_${r}`))) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!a.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    const i = ns(e.env), c = `admin_${a.id}`;
    try {
      await i.auth.getUser(c).catch(async () => {
        await i.auth.createUser({ uid: c, email: a.email, displayName: a.name });
      }), await i.auth.setCustomUserClaims(c, { role: "admin", userId: a.id, email: a.email });
      const l = await i.createCustomToken(c, { role: "admin", userId: a.id, email: a.email });
      return await s.prepare(`
        UPDATE admins SET firebase_uid = ? WHERE id = ?
      `).bind(c, a.id).run(), await s.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(), console.log(`[Firebase Login] \u2705 Admin ${a.email} logged in with Firebase (KV Write: 0)`), e.json({ success: true, data: { customToken: l, admin: { id: a.id, username: a.username, email: a.email, name: a.name, firebaseUID: c } } });
    } catch (l) {
      return console.error("[Firebase] Admin login error:", l), e.json({ success: false, error: "Firebase authentication failed" }, 500);
    }
  } catch (t) {
    return console.error("Admin login error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/auth/verify", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const r = await Ve(e.env.SESSION_KV, t);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = r.user_type === "admin" ? "admins" : "sellers", o = r.user_type === "admin" ? r.admin_id : r.seller_id, n = await s.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        name, 
        business_name, 
        is_active, 
        status
      FROM ${a} 
      WHERE id = ?
    `).bind(o).first();
    return n ? e.json({ success: true, data: { user: { id: n.id, type: r.user_type, username: n.username, name: n.name, email: n.email, businessName: n.business_name } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/auth/kakao/sync/callback", async (e) => {
  var t, r, a, o, n, i, c, l, u, d, m, _, f;
  const { DB: s } = e.env;
  try {
    console.log("[Kakao Sync] Callback started"), console.log("[Kakao Sync] DB available:", !!s);
    const g = e.req.query("code"), b = e.req.query("state") || "/", w = e.req.query("error");
    if (console.log("[Kakao Sync] Query params:", { hasCode: !!g, state: b, error: w }), w) return console.error("[Kakao Sync] OAuth error:", w), e.redirect(`${b}?error=kakao_oauth_${w}`);
    if (!g) return console.error("[Kakao Sync] No authorization code"), e.redirect(`${b}?error=no_code`);
    console.log("[Kakao Sync] Authorization code received");
    const h = e.env.KAKAO_REST_API_KEY || "5dd74bccb797640b0efd070467f3bafd", T = `${new URL(e.req.url).origin}/auth/kakao/sync/callback`;
    console.log("[Kakao Sync] Exchanging code for token..."), console.log("  - REST_API_KEY:", h.substring(0, 10) + "..."), console.log("  - REDIRECT_URI:", T), console.log("[Kakao Sync] Step 1: Fetching access token...");
    const y = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: h, redirect_uri: T, code: g }) });
    if (console.log("[Kakao Sync] Token response status:", y.status), console.log("[Kakao Sync] Token request details:", { client_id: h, redirect_uri: T, code_length: g.length, code_prefix: g.substring(0, 20) }), !y.ok) {
      const H = await y.text();
      return console.error("[Kakao Sync] Token request failed:", H), e.redirect(`${b}?error=token_request_failed&detail=${encodeURIComponent(H)}`);
    }
    const R = await y.json();
    if (console.log("[Kakao Sync] Token data received:", { hasAccessToken: !!R.access_token, error: R.error, errorDescription: R.error_description }), !R.access_token) return console.error("[Kakao Sync] Token error:", R), e.redirect(`${b}?error=token_failed&detail=${encodeURIComponent(R.error || "unknown")}`);
    console.log("[Kakao Sync] Access token obtained successfully"), console.log("[Kakao Sync] Step 2: Fetching user info...");
    const $ = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${R.access_token}` } });
    console.log("[Kakao Sync] User response status:", $.status);
    const A = await $.json();
    if (console.log("[Kakao Sync] User data received:", { hasId: !!A.id, id: A.id, hasNickname: !!((t = A.properties) != null && t.nickname || (a = (r = A.kakao_account) == null ? void 0 : r.profile) != null && a.nickname) }), !A.id) return console.error("[Kakao Sync] Failed to get user info:", A), e.redirect(`${b}?error=user_info_failed`);
    console.log("[Kakao Sync] User info obtained successfully"), console.log("[Kakao Sync] Step 2.5: Fetching service terms...");
    const O = await fetch("https://kapi.kakao.com/v2/user/service_terms", { headers: { Authorization: `Bearer ${R.access_token}` } });
    console.log("[Kakao Sync] Terms response status:", O.status);
    let x = null;
    if (O.ok ? (x = await O.json(), console.log("[Kakao Sync] Service terms received:", { allowedServiceTerms: ((o = x.allowed_service_terms) == null ? void 0 : o.length) || 0, tags: (n = x.allowed_service_terms) == null ? void 0 : n.map((H) => H.tag) })) : console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"), console.log("[Kakao Sync] Step 3: Saving user to database..."), !s) return console.error("[Kakao Sync] DB is not available!"), e.redirect(`${b}?error=db_not_available`);
    const U = A.id.toString(), L = ((i = A.properties) == null ? void 0 : i.nickname) || ((l = (c = A.kakao_account) == null ? void 0 : c.profile) == null ? void 0 : l.nickname) || "Kakao User", F = ((u = A.kakao_account) == null ? void 0 : u.email) || "", G = ((d = A.properties) == null ? void 0 : d.profile_image) || ((_ = (m = A.kakao_account) == null ? void 0 : m.profile) == null ? void 0 : _.profile_image_url) || "", Y = R.access_token, v = ((f = x == null ? void 0 : x.allowed_service_terms) == null ? void 0 : f.map((H) => H.tag)) || [], ee = JSON.stringify(v);
    console.log("[Kakao Sync] User data:", { kakaoId: U, nickname: L, email: F ? "exists" : "none", serviceTerms: v });
    try {
      const H = await s.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(U).first();
      console.log("[Kakao Sync] Existing user check:", !!H);
      let q;
      H ? (q = H.id, await s.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L, F, G, q).run(), console.log("[Kakao Sync] Updated user:", q)) : (q = (await s.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(U, L, F || null, G || null).run()).meta.last_row_id, console.log("[Kakao Sync] Created user:", q)), console.log("[Kakao Sync] User saved successfully, userId:", q), console.log("[Kakao Sync] Step 4: Generating Firebase Custom Token...");
      const J = ns(e.env), ce = `kakao_${U}`, cs = await J.createCustomToken(ce, { role: "user", userId: q, email: F || void 0, kakaoId: U });
      try {
        await s.prepare(`
          UPDATE users SET firebase_uid = ? WHERE id = ?
        `).bind(ce, q).run();
      } catch (gs) {
        console.warn("[Kakao Sync] firebase_uid column not found, skipping update:", gs);
      }
      console.log("[Kakao Sync] \u2705 Firebase Custom Token \uBC1C\uAE09 \uC644\uB8CC for user:", q), console.log("[Kakao Sync] Step 5: Redirecting with Firebase Custom Token...");
      const Ye = b.includes("?") ? `${b}&firebase_token=${encodeURIComponent(cs)}&userName=${encodeURIComponent(L)}` : `${b}?firebase_token=${encodeURIComponent(cs)}&userName=${encodeURIComponent(L)}`;
      return console.log("[Kakao Sync] Redirect URL (Firebase):", Ye.substring(0, 100) + "..."), e.redirect(Ye);
    } catch (H) {
      return console.error("[Kakao Sync] Database error:", H), console.error("[Kakao Sync] DB error details:", { message: H.message, name: H.name }), e.redirect(`${b}?error=database_error&detail=${encodeURIComponent(H.message)}`);
    }
  } catch (g) {
    console.error("[Kakao Sync] Exception:", g), console.error("[Kakao Sync] Error details:", { message: g.message, stack: g.stack, name: g.name });
    const b = e.req.query("state") || "/", w = encodeURIComponent(g.message || "unknown");
    return e.redirect(`${b}?error=kakao_sync_failed&detail=${w}`);
  }
});
p.post("/api/auth/kakao/callback", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { code: t, redirect_uri: r } = await e.req.json();
    if (!t) return e.json({ success: false, error: "Authorization code is required" }, 400);
    if (!e.env.KAKAO_REST_API_KEY) return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"), e.json({ success: false, error: "Server configuration error", code: "MISSING_API_KEY" }, 500);
    const a = r || "https://live.ur-team.com/auth/kakao/callback";
    console.log("[Kakao Callback] Starting OAuth flow with Firebase Custom Token");
    const o = await Lr(t, a, e.env.KAKAO_REST_API_KEY), { user: n } = await bt(s, o), i = ns(e.env), c = `kakao_${n.kakao_id}`, l = await i.createCustomToken(c, { userId: n.id, userType: "user", email: n.email || void 0, kakaoId: n.kakao_id });
    console.log("[Kakao Callback] \u2705 Firebase Custom Token \uBC1C\uAE09 \uC644\uB8CC for user:", n.id);
    try {
      await s.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(c, n.id).run();
    } catch (u) {
      console.warn("[Kakao Callback] firebase_uid column not found, skipping update:", u);
    }
    return e.json({ success: true, data: { customToken: l, user: { id: n.id, name: n.name, email: n.email, profile_image: n.profile_image, firebaseUID: c } } });
  } catch (t) {
    return console.error("[Kakao Callback] Error:", t), t instanceof te ? e.json({ success: false, error: t.message, code: t.code }, t.statusCode) : e.json({ success: false, error: t.message || "Internal server error", code: "UNKNOWN_ERROR" }, 500);
  }
});
p.post("/api/auth/kakao/firebase", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { accessToken: t } = await e.req.json();
    if (!t) return e.json({ success: false, error: "Access token is required" }, 400);
    console.log("[Kakao Firebase] Processing Kakao OAuth login");
    const r = Date.now(), { user: a } = await bt(s, t);
    console.log("[Kakao Firebase] ProcessKakaoLogin completed in", Date.now() - r, "ms");
    const o = await generateFirebaseCustomToken(a.id.toString(), { role: "user", email: a.email, name: a.name });
    return console.log("[Kakao Firebase] \u2705 Firebase Custom Token \uC0DD\uC131 \uC644\uB8CC for user:", a.id), console.log("[Kakao Firebase] Total login time:", Date.now() - r, "ms"), e.json({ success: true, customToken: o, user: { id: a.id, name: a.name, email: a.email, profile_image: a.profile_image } });
  } catch (t) {
    return console.error("[Kakao Firebase] Error:", t), t instanceof te ? e.json({ success: false, error: t.message, code: t.code }, t.statusCode) : e.json({ success: false, error: t instanceof Error ? t.message : "Login failed", code: "UNKNOWN_ERROR" }, 500);
  }
});
p.post("/api/auth/firebase/sync", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { idToken: t, firebaseUid: r, email: a, displayName: o } = await e.req.json();
    if (!t || !r) return e.json({ success: false, error: "idToken and firebaseUid are required" }, 400);
    console.log("[Firebase Sync] Syncing user to D1:", { firebaseUid: r, email: a });
    const n = await verifyFirebaseToken(t, e.env);
    if (!n || n.uid !== r) return e.json({ success: false, error: "Invalid Firebase token" }, 401);
    const i = await s.prepare("SELECT id, email, name FROM users WHERE firebase_uid = ?").bind(r).first();
    if (i) return await s.prepare(`
        UPDATE users 
        SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE firebase_uid = ?
      `).bind(a || i.email, o || i.name, r).run(), console.log("[Firebase Sync] \u2705 \uAE30\uC874 \uC0AC\uC6A9\uC790 \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC:", i.id), e.json({ success: true, user: { id: i.id, email: a || i.email, name: o || i.name } });
    if (a) {
      const c = await s.prepare("SELECT id, email, name FROM users WHERE email = ?").bind(a).first();
      if (c) return await s.prepare(`
            UPDATE users 
            SET firebase_uid = ?, name = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
          `).bind(r, o || c.name, a).run(), console.log("[Firebase Sync] \u2705 \uAE30\uC874 \uC774\uBA54\uC77C \uC0AC\uC6A9\uC790\uC5D0 firebase_uid \uC5F0\uACB0:", c.id), e.json({ success: true, user: { id: c.id, email: c.email, name: o || c.name } });
    }
    return e.json({ success: false, error: "User not found. Please register first." }, 404);
  } catch (t) {
    return console.error("[Firebase Sync] Error:", t), e.json({ success: false, error: t instanceof Error ? t.message : "Sync failed" }, 500);
  }
});
p.post("/api/auth/firebase/register", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { idToken: t, firebaseUid: r, email: a, name: o, userType: n } = await e.req.json();
    if (!t || !r || !a || !o) return e.json({ success: false, error: "idToken, firebaseUid, email, and name are required" }, 400);
    console.log("[Firebase Register] Registering new user:", { firebaseUid: r, email: a, userType: n });
    const i = await verifyFirebaseToken(t, e.env);
    if (!i || i.uid !== r) return e.json({ success: false, error: "Invalid Firebase token" }, 401);
    const c = await s.prepare(`
      INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(r, a, o).run();
    return console.log("[Firebase Register] \u2705 \uC0C8 \uC0AC\uC6A9\uC790 \uC0DD\uC131 \uC644\uB8CC:", c.meta.last_row_id), e.json({ success: true, user: { id: c.meta.last_row_id, email: a, name: o, firebaseUid: r } });
  } catch (t) {
    return console.error("[Firebase Register] Error:", t), t instanceof Error && t.message.includes("UNIQUE") ? e.json({ success: false, error: "Email already exists", code: "EMAIL_EXISTS" }, 409) : e.json({ success: false, error: t instanceof Error ? t.message : "Registration failed" }, 500);
  }
});
p.get("/api/auth/validate", S(), async (e) => {
  try {
    const s = e.req.header("Authorization"), t = (s == null ? void 0 : s.replace("Bearer ", "")) || "";
    if (!t) return e.json({ success: false, valid: false, error: "No JWT token provided", code: "NO_TOKEN" }, 401);
    const r = getJwtSecret(e.env);
    console.log("[JWT Validate] Secret (first 20 chars):", r.substring(0, 20)), console.log("[JWT Validate] Token (first 50 chars):", t.substring(0, 50));
    const a = await verifyCachedToken(t, r);
    return console.log("[JWT Validate] Payload:", a ? "Valid" : "Invalid/Expired"), a ? e.json({ success: true, valid: true, data: { user_id: a.userId, user_type: a.userType, email: a.email, session_valid: true }, user: { userId: a.userId, userType: a.userType, email: a.email } }) : e.json({ success: false, valid: false, error: "JWT token expired or invalid", code: "TOKEN_EXPIRED" }, 401);
  } catch (s) {
    return console.error("[JWT Validate Error]", s), e.json({ success: false, valid: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
  }
});
p.post("/api/auth/refresh", S(), async (e) => {
  try {
    const s = await e.req.json(), { refreshToken: t } = s;
    if (!t) return e.json({ success: false, error: "No refresh token provided", code: "NO_REFRESH_TOKEN" }, 400);
    const r = getJwtSecret(e.env), a = await refreshAccessToken(t, r);
    return a ? e.json({ success: true, data: { accessToken: a } }) : e.json({ success: false, error: "Refresh token expired or invalid", code: "REFRESH_TOKEN_EXPIRED" }, 401);
  } catch (s) {
    return console.error("[JWT Refresh Error]", s), e.json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
  }
});
p.post("/api/auth/kakao/logout", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token") || "";
    return t && (await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(), console.log("[Kakao Sync] Session deleted")), e.json({ success: true });
  } catch (t) {
    return console.error("[Kakao Sync] Logout error:", t), e.json({ success: false, error: "Logout failed" }, 500);
  }
});
p.post("/api/auth/kakao/unlink", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
    if (console.log("[Kakao Unlink] Starting unlink process..."), !await s.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(t).first()) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await s.prepare(`
      SELECT u.id, u.email, u.name, u.kakao_id, u.profile_image, u.created_at
      FROM users u
      WHERE u.id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(t).first();
    if (!a) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (console.log("[Kakao Unlink] User found:", a.id), a.access_token) try {
      console.log("[Kakao Unlink] Calling Kakao unlink API...");
      const o = await fetch("https://kapi.kakao.com/v1/user/unlink", { method: "POST", headers: { Authorization: `Bearer ${a.access_token}`, "Content-Type": "application/x-www-form-urlencoded" } }), n = await o.json();
      o.ok ? console.log("[Kakao Unlink] Kakao unlink successful:", n.id) : console.warn("[Kakao Unlink] Kakao unlink failed:", n);
    } catch (o) {
      console.error("[Kakao Unlink] Kakao API error:", o);
    }
    else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");
    return console.log("[Kakao Unlink] Deleting user data from DB..."), await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(), console.log("[Kakao Unlink] Sessions deleted"), await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(), console.log("[Kakao Unlink] Cart items deleted"), await s.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(), console.log("[Kakao Unlink] User deleted"), console.log("[Kakao Unlink] Unlink process completed successfully"), e.json({ success: true, message: "\uD68C\uC6D0 \uD0C8\uD1F4\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" });
  } catch (t) {
    return console.error("[Kakao Unlink] Error:", t), e.json({ success: false, error: "\uD68C\uC6D0 \uD0C8\uD1F4 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
p.post("/webhooks/kakao/unlink", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = await e.req.json(), { user_id: r, referrer_type: a } = t;
    if (console.log("[Kakao Webhook] Unlink notification received:", { user_id: r, referrer_type: a }), !r) return e.json({ success: false, error: "user_id is required" }, 400);
    const o = await s.prepare(`
      SELECT id, kakao_id, email, name, created_at
      FROM users 
      WHERE kakao_id = ?
    `).bind(r.toString()).first();
    return o ? (console.log("[Kakao Webhook] Deleting user data for user:", o.id), await s.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(), await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(o.id).run(), await s.prepare("DELETE FROM users WHERE id = ?").bind(o.id).run(), console.log("[Kakao Webhook] User data deleted successfully"), e.json({ success: true })) : (console.log("[Kakao Webhook] User not found:", r), e.json({ success: true }));
  } catch (t) {
    return console.error("[Kakao Webhook] Error:", t), e.json({ success: false, error: "Webhook processing failed" }, 500);
  }
});
p.get("/api/auth/user/verify", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const r = await Ve(e.env.SESSION_KV, t);
    if (!r || r.user_type !== "user") return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await s.prepare(`
      SELECT id, email, name, kakao_id, profile_image, created_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first();
    return a ? e.json({ success: true, data: { user: { id: a.id, name: a.name, email: a.email, profileImage: a.profile_image, phone: a.phone } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/shipping-addresses", S(), j, async (e) => {
  const { DB: s } = e.env, t = e.get("userId");
  try {
    const r = await s.prepare(`
      SELECT 
        id, 
        user_id, 
        recipient_name, 
        phone, 
        postal_code, 
        address, 
        address_detail, 
        is_default, 
        created_at, 
        updated_at 
      FROM shipping_addresses 
      WHERE user_id = ? 
      ORDER BY is_default DESC, created_at DESC
    `).bind(t).all();
    return e.json({ success: true, data: r.results || [] });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/shipping-addresses/:userId", S(), j, async (e) => {
  const { DB: s } = e.env, t = e.get("userId"), r = parseInt(e.req.param("userId"));
  try {
    if (r !== t) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uBC30\uC1A1\uC9C0\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const a = await s.prepare(`
      SELECT 
        id, 
        user_id, 
        recipient_name, 
        phone, 
        postal_code, 
        address, 
        address_detail, 
        is_default, 
        created_at, 
        updated_at 
      FROM shipping_addresses 
      WHERE user_id = ? 
      ORDER BY is_default DESC, created_at DESC
    `).bind(t).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.post("/api/shipping-addresses", S(), j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = await e.req.json(), r = t.user_id, a = t.recipient_name, o = t.phone, n = t.postal_code, i = t.address, c = t.address_detail, l = t.is_default;
    if (console.log("[POST /api/shipping-addresses] Received:", JSON.stringify(t)), !r || !a || !o || !i) return console.error("[POST /api/shipping-addresses] Missing required fields:", { userId: r, recipientName: a, phone: o, address: i }), e.json({ success: false, error: "\uD544\uC218 \uC815\uBCF4\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    l && await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(r).run();
    const u = await s.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a, o, n || "", i, c || "", l ? 1 : 0).run();
    return console.log("[POST /api/shipping-addresses] Success:", { id: u.meta.last_row_id }), e.json({ success: true, data: { id: u.meta.last_row_id } });
  } catch (t) {
    return console.error("[POST /api/shipping-addresses] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.put("/api/shipping-addresses/:id", S(), j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("id"), r = await e.req.json(), a = r.user_id, o = r.recipient_name, n = r.phone, i = r.postal_code, c = r.address, l = r.address_detail, u = r.is_default;
    return u && await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(), await s.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(o, n, i || "", c, l || "", u ? 1 : 0, t, a).run(), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.delete("/api/shipping-addresses/:id", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("id"), r = e.req.query("userId");
    return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t, r).run(), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
async function P(e) {
  const s = e.req.header("Authorization");
  if (s != null && s.startsWith("Bearer ")) {
    const a = s.substring(7);
    try {
      const o = await verifyJWT(a, e.env.JWT_SECRET);
      return o.userType !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: o.userId, userData: o };
    } catch (o) {
      console.error("[verifyAdminSession] JWT verification failed:", o);
    }
  }
  const t = e.req.header("X-Session-Token");
  if (!t) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await Ve(e.env.SESSION_KV, t);
  return !r || r.user_type !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: r.admin_id, userData: r };
}
__name(P, "P");
__name2(P, "P");
async function N(e) {
  const s = e.req.header("Authorization");
  if (s != null && s.startsWith("Bearer ")) {
    const a = s.substring(7);
    try {
      const o = await verifyJWT(a, e.env.JWT_SECRET);
      return o.userType !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: o.userId, userData: o };
    } catch (o) {
      console.error("[verifySellerSession] JWT verification failed:", o);
    }
  }
  const t = e.req.header("X-Session-Token");
  if (!t) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await Ve(e.env.SESSION_KV, t);
  return !r || r.user_type !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: r.seller_id, userData: r };
}
__name(N, "N");
__name2(N, "N");
p.get("/api/health", (e) => e.json({ success: true, status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString(), env: { hasDB: !!e.env.DB, hasSessionKV: !!e.env.SESSION_KV, hasCacheKV: !!e.env.CACHE_KV } }));
p.get("/api/cleanup/expired-reservations", async (e) => {
  const { DB: s } = e.env;
  try {
    console.log("========================================"), console.log("[Cleanup] \u23F0 \uB9CC\uB8CC\uB41C \uC7AC\uACE0 \uC608\uC57D \uC815\uB9AC \uC2DC\uC791"), console.log("========================================");
    const t = (/* @__PURE__ */ new Date()).toISOString();
    console.log("[Cleanup] \uD604\uC7AC \uC2DC\uAC04:", t);
    const r = await s.prepare(`
      SELECT id, order_number, reservation_expires_at
      FROM orders
      WHERE status = 'pending'
        AND reservation_expires_at IS NOT NULL
        AND reservation_expires_at < ?
      LIMIT 100
    `).bind(t).all();
    if (r.results.length === 0) return console.log("[Cleanup] \u2705 \uB9CC\uB8CC\uB41C \uC608\uC57D \uC5C6\uC74C"), e.json({ success: true, message: "\uB9CC\uB8CC\uB41C \uC608\uC57D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", cleaned: 0 });
    console.log(`[Cleanup] \u{1F4E6} \uB9CC\uB8CC\uB41C \uC8FC\uBB38 ${r.results.length}\uAC1C \uBC1C\uACAC`);
    let a = 0;
    for (const o of r.results) try {
      const n = await s.prepare(`
          SELECT product_id, quantity
          FROM order_items
          WHERE order_id = ?
        `).bind(o.id).all();
      if (n.results.length === 0) {
        console.warn(`[Cleanup] \u26A0\uFE0F \uC8FC\uBB38 ${o.order_number}: \uC544\uC774\uD15C \uC5C6\uC74C`);
        continue;
      }
      const i = n.results.map((c) => s.prepare(`
            UPDATE products 
            SET reserved_stock = CASE 
              WHEN reserved_stock >= ? THEN reserved_stock - ?
              ELSE 0
            END
            WHERE id = ?
          `).bind(c.quantity, c.quantity, c.product_id));
      await s.batch(i), await s.prepare(`
          UPDATE orders
          SET status = 'cancelled',
              payment_status = 'expired',
              reservation_expires_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(o.id).run(), console.log(`[Cleanup] \u2705 ${o.order_number}: ${n.results.length}\uAC1C \uC0C1\uD488 \uC608\uC57D \uD574\uC81C`), a++;
    } catch (n) {
      console.error(`[Cleanup] \u274C ${o.order_number} \uCC98\uB9AC \uC2E4\uD328:`, n);
    }
    return console.log(`[Cleanup] \u2705 \uC815\uB9AC \uC644\uB8CC: ${a}/${r.results.length}\uAC1C`), e.json({ success: true, message: `${a}\uAC1C\uC758 \uB9CC\uB8CC\uB41C \uC608\uC57D\uC744 \uC815\uB9AC\uD588\uC2B5\uB2C8\uB2E4.`, cleaned: a, total: r.results.length });
  } catch (t) {
    return console.error("[Cleanup] \u274C \uC815\uB9AC \uC2E4\uD328:", t), e.json({ success: false, error: "\uB9CC\uB8CC\uB41C \uC608\uC57D \uC815\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", details: t.message }, 500);
  }
});
p.get("/api/test/env", async (e) => {
  try {
    const s = await Rr(e.env);
    return e.json(s);
  } catch (s) {
    return e.json({ success: false, error: "\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uC2E4\uD589 \uC911 \uC624\uB958 \uBC1C\uC0DD", details: s instanceof Error ? s.message : String(s) }, 500);
  }
});
p.get("/api/streams", Cs(js.liveStreams), async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = e.req.query("status") || "all", a = `streams:${r}`, o = await t.get(a, "json");
    if (o) return e.json({ success: true, data: o, cached: true });
    let n = `
      SELECT 
        ls.id, 
        ls.title, 
        ls.description, 
        ls.youtube_video_id,
        ls.platform,
        ls.tiktok_username,
        ls.thumbnail_url,
        ls.status, 
        ls.current_product_id, 
        ls.seller_id,
        ls.scheduled_at, 
        ls.created_at, 
        ls.updated_at,
        s.display_name as seller_name,
        s.profile_image as seller_profile_image
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
    `;
    r === "live" ? n += " WHERE ls.status = 'live'" : r === "scheduled" ? n += " WHERE ls.status = 'scheduled'" : r === "ended" ? n += " WHERE ls.status = 'ended'" : n += " WHERE ls.status IN ('live', 'scheduled')", n += ` ORDER BY 
      CASE ls.status 
        WHEN 'live' THEN 1 
        WHEN 'scheduled' THEN 2 
        ELSE 3 
      END,
      ls.created_at DESC`;
    const i = await s.prepare(n).all();
    return await t.put(a, JSON.stringify(i.results), { expirationTtl: 600 }), e.json({ success: true, data: i.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/streams/:id", async (e) => {
  const { DB: s } = e.env, t = e.req.param("id");
  try {
    const r = await s.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(t).first();
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/live-streams", async (e) => {
  const { DB: s } = e.env, { status: t, seller_id: r, limit: a = "20", offset: o = "0" } = e.req.query();
  try {
    const n = `live_streams:${t || "all"}:${r || "all"}:${a}:${o}`, i = 60, c = we(n);
    if (c) return console.log("[LiveStreams] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", n), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStreams] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", n);
        const u = await Ws(s, t, r, a, o);
        Z(n, u, i), console.log("[LiveStreams] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", n);
      } catch (u) {
        console.error("[LiveStreams] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", u);
      }
    })()), e.json({ success: true, data: c });
    console.log("[LiveStreams] \u{1F4BE} DB \uC870\uD68C:", n);
    const l = await Ws(s, t, r, a, o);
    return Z(n, l, i), e.json({ success: true, data: l });
  } catch (n) {
    return console.error("[API] Live streams list error:", n), e.json({ success: false, error: `\uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${n.message}` }, 500);
  }
});
async function Ws(e, s, t, r, a) {
  let o = `
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;
  const n = [];
  s && (o += " AND ls.status = ?", n.push(s)), t && (o += " AND ls.seller_id = ?", n.push(t)), o += ' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC', o += " LIMIT ? OFFSET ?", n.push(parseInt(r), parseInt(a));
  const { results: i } = await e.prepare(o).bind(...n).all();
  return i;
}
__name(Ws, "Ws");
__name2(Ws, "Ws");
p.get("/api/live-streams/:id", async (e) => {
  const { DB: s } = e.env, t = e.req.param("id");
  try {
    const r = `live_stream:${t}`, a = 30, o = we(r);
    if (o) return console.log("[LiveStream] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", r), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStream] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", r);
        const i = await Bs(s, t);
        i && (Z(r, i, a), console.log("[LiveStream] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", r));
      } catch (i) {
        console.error("[LiveStream] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", i);
      }
    })()), e.json({ success: true, data: o });
    console.log("[LiveStream] \u{1F4BE} DB \uC870\uD68C:", r);
    const n = await Bs(s, t);
    return n ? (Z(r, n, a), e.json({ success: true, data: n })) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
async function Bs(e, s) {
  return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first();
}
__name(Bs, "Bs");
__name2(Bs, "Bs");
p.get("/api/products", Cs(js.products), async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = e.req.query("featured"), a = parseInt(e.req.query("limit") || "20"), o = parseInt(e.req.query("offset") || "0"), n = `products:list:${r || "all"}:${a}:${o}`, i = we(n);
    if (i) return e.executionCtx.waitUntil((async () => {
      try {
        const l = await Ks(s, r, a, o);
        Z(n, l, 3600), await Ze(t, n, l, 300, false);
      } catch (l) {
        console.error("[Cache Revalidate] Products error:", l);
      }
    })()), e.json({ success: true, data: i, cached: true });
    const c = await Ks(s, r, a, o);
    return Z(n, c, 3600), await Ze(t, n, c, 300, false), e.json({ success: true, data: c, cached: false });
  } catch (r) {
    return console.error("Products list error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
async function Ks(e, s, t, r) {
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
    `, (await e.prepare(a).bind(t, r).all()).results || [];
}
__name(Ks, "Ks");
__name2(Ks, "Ks");
p.get("/api/products/popular", async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = "products:popular", a = we(r);
    if (a) return e.executionCtx.waitUntil((async () => {
      try {
        const n = await Vs(s);
        Z(r, n, 3600), await Ze(t, r, n, 600, false);
      } catch (n) {
        console.error("[Cache Revalidate] Popular products error:", n);
      }
    })()), e.json({ success: true, data: a, cached: true });
    const o = await Vs(s);
    return Z(r, o, 3600), await Ze(t, r, o, 600, false), e.json({ success: true, data: o, cached: false });
  } catch (r) {
    return console.error("Popular products error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
async function Vs(e) {
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
__name(Vs, "Vs");
__name2(Vs, "Vs");
p.get("/api/search/suggestions", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.query("q") || "";
    if (!t.trim() || t.length < 2) return e.json({ success: true, data: { suggestions: [] } });
    const r = `%${t}%`, a = await s.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(r).all(), o = await s.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(r, r).all(), n = [...(a.results || []).map((i) => ({ type: "product", text: i.name })), ...(o.results || []).map((i) => ({ type: "seller", text: i.display_name }))];
    return e.json({ success: true, data: { suggestions: n } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/products/search", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.query("q") || "", r = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0");
    if (!t.trim()) return e.json({ success: false, error: "Search query is required" }, 400);
    const o = t.trim(), n = `${o}*`;
    try {
      if (await s.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='products_fts'
      `).first()) {
        console.log("[Search] \u26A1 FTS5 \uAC80\uC0C9 \uC0AC\uC6A9:", n);
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
        `).bind(n, r, a).all(), l = await s.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(n).first();
        return e.json({ success: true, data: { products: c.results || [], total: (l == null ? void 0 : l.total) || 0, query: t, limit: r, offset: a, searchMethod: "fts5" } });
      } else throw console.log("[Search] \u26A0\uFE0F FTS5 \uBBF8\uC0AC\uC6A9 - LIKE \uAC80\uC0C9 fallback"), new Error("FTS5 not available");
    } catch (i) {
      console.log("[Search] \u{1F4BE} LIKE \uAC80\uC0C9 fallback:", i.message);
      const c = `%${o}%`, l = await s.prepare(`
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
      `).bind(c, c, c, c, c, r, a).all(), u = await s.prepare(`
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
      `).bind(c, c, c, c, c).first();
      return e.json({ success: true, data: { products: l.results || [], total: (u == null ? void 0 : u.total) || 0, query: t, limit: r, offset: a, searchMethod: "like" } });
    }
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/products/:id", async (e) => {
  const { DB: s } = e.env, t = e.req.param("id");
  try {
    const r = `product:detail:${t}`, a = we(r);
    if (a) return e.executionCtx.waitUntil((async () => {
      try {
        const n = await Ys(s, t);
        Z(r, n, 1800);
      } catch (n) {
        console.error("[Cache Revalidate] Product detail error:", n);
      }
    })()), e.json({ success: true, data: a, cached: true });
    const o = await Ys(s, t);
    return o ? (Z(r, o, 1800), e.json({ success: true, data: o, cached: false })) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
async function Ys(e, s) {
  const t = await e.prepare(`
    SELECT 
      p.*,
      COALESCE(s.name, s.username, '\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158') as seller_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.is_active = 1
  `).bind(s).first();
  if (!t) return null;
  const r = await e.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(s).all();
  return { product: t, options: r.results };
}
__name(Ys, "Ys");
__name2(Ys, "Ys");
p.get("/api/products/:id/stock", Cs(js.microCache), async (e) => {
  const { DB: s } = e.env, t = e.req.param("id");
  try {
    const r = await s.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(t).first();
    return r ? e.json({ success: true, data: { productId: r.id, productName: r.name, stock: r.stock, available: r.stock > 0 } }) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/streams/:streamId/products", async (e) => {
  const { DB: s } = e.env, t = e.req.param("streamId");
  try {
    const r = await s.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(t).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/cart", j, async (e) => {
  const { DB: s } = e.env, t = e.get("userId");
  try {
    const r = await s.prepare(`
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
    `).bind(t).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return e.json({ success: false, error: `\uC7A5\uBC14\uAD6C\uB2C8 \uC870\uD68C \uC2E4\uD328: ${r.message}` }, 500);
  }
});
p.get("/api/cart/:userId", j, async (e) => {
  const { DB: s } = e.env, t = e.get("userId"), r = e.req.param("userId");
  try {
    let a = await s.prepare("SELECT id FROM users WHERE id = ?").bind(t).first();
    if (!a) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const o = a.id;
    if (r !== String(o)) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC7A5\uBC14\uAD6C\uB2C8\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const n = await s.prepare(`
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
    `).bind(o).all();
    return e.json({ success: true, data: n.results });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.post("/api/users", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = await e.req.json(), { kakaoId: r, name: a, email: o, phone: n } = t;
    if (!r || !a) return e.json({ success: false, error: "kakaoId and name are required" }, 400);
    const i = await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(r).first();
    if (i) return e.json({ success: true, data: { id: i.id } });
    const c = await s.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(r, a, o || null, n || null).run();
    return e.json({ success: true, data: { id: c.meta.last_row_id } });
  } catch (t) {
    return console.error("Error creating user:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/cart", S(), j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.get("userId");
    if (!t) return e.json({ success: false, error: "Authentication required" }, 401);
    const r = await e.req.json(), { productId: a, optionId: o, quantity: n, priceSnapshot: i, liveStreamId: c } = r, l = t, u = await s.prepare("SELECT stock FROM products WHERE id = ?").bind(a).first();
    if (!u || u.stock < n) return e.json({ success: false, error: "Insufficient stock" }, 400);
    const d = await s.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(l, a, o || null, o || null).first();
    let m;
    if (d) {
      const _ = d.quantity + n;
      await s.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(_, i, d.id).run(), m = d.id;
    } else m = (await s.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(l, a, o || null, n, i, c || null).run()).meta.last_row_id;
    return e.json({ success: true, data: { id: m, isUpdate: !!d } });
  } catch (t) {
    return console.error("[API /api/cart POST] Error:", t), console.error("[API /api/cart POST] Error message:", t.message), console.error("[API /api/cart POST] Error stack:", t.stack), e.json({ success: false, error: "Failed to add to cart: " + (t.message || "Unknown error") }, 500);
  }
});
p.delete("/api/cart/:cartItemId", j, async (e) => {
  const { DB: s } = e.env, t = e.req.param("cartItemId");
  try {
    return await s.prepare("DELETE FROM cart_items WHERE id = ?").bind(t).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/cart/clear/:userId", j, ja("cart"), async (e) => {
  const { DB: s } = e.env, t = e.req.param("userId");
  try {
    return await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(t).run(), e.json({ success: true, message: "\uC7A5\uBC14\uAD6C\uB2C8\uAC00 \uBE44\uC6CC\uC84C\uC2B5\uB2C8\uB2E4." });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/cart/:cartItemId", j, async (e) => {
  const { DB: s } = e.env, t = e.req.param("cartItemId");
  try {
    const r = await e.req.json(), { quantity: a } = r;
    if (!a || a < 1) return e.json({ success: false, error: "Invalid quantity" }, 400);
    const o = await s.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(t).first();
    return o ? o.stock < a ? e.json({ success: false, error: "Insufficient stock" }, 400) : (await s.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a, t).run(), e.json({ success: true })) : e.json({ success: false, error: "Cart item not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/orders", j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = await e.req.json(), { userId: r, cartItemIds: a, shippingInfo: o, items: n, shippingAddress: i, shippingAddressDetail: c, recipientName: l, recipientPhone: u, deliveryMemo: d, totalAmount: m, shippingFee: _, orderNumber: f, paymentKey: g, paymentMethod: b } = t;
    if (n && n.length > 0) {
      const O = n.map((M) => M.productId), x = O.map(() => "?").join(","), U = await s.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${x})
      `).bind(...O).all(), L = new Map(U.results.map((M) => [M.id, M])), F = [], G = [];
      try {
        for (const M of n) {
          const re = L.get(M.productId);
          if (!re) throw new Error(`\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${M.productId})`);
          if (re.stock - (re.reserved_stock || 0) < M.quantity) throw new Error(`\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uBC29\uAE08 \uC0C1\uD488\uC774 \uBAA8\uB450 \uD310\uB9E4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${re.name})`);
          if ((await s.prepare(`
            UPDATE products 
            SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND (stock - reserved_stock) >= ?
          `).bind(M.quantity, M.productId, M.quantity).run()).meta.changes === 0) throw new Error(`\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uBC29\uAE08 \uC0C1\uD488\uC774 \uBAA8\uB450 \uD310\uB9E4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${re.name})`);
          console.log(`[Stock] \u2705 \uC7AC\uACE0 \uC608\uC57D \uC131\uACF5: ${re.name} (${M.quantity}\uAC1C)`), G.push({ product_id: M.productId, quantity: M.quantity }), F.push({ product_id: M.productId, option_id: M.optionId || null, quantity: M.quantity, price: M.price, product_name: re.name, product_stock: re.stock });
        }
      } catch (M) {
        if (console.error("[Stock] \u274C \uC7AC\uACE0 \uC608\uC57D \uC2E4\uD328:", M.message), G.length > 0) {
          console.log(`[Stock] \u{1F504} ${G.length}\uAC1C \uC0C1\uD488 \uC608\uC57D \uB864\uBC31 \uC2DC\uC791...`);
          for (const re of G) await s.prepare(`
              UPDATE products 
              SET reserved_stock = reserved_stock - ?
              WHERE id = ?
            `).bind(re.quantity, re.product_id).run();
          console.log("[Stock] \u2705 \uC608\uC57D \uB864\uBC31 \uC644\uB8CC");
        }
        return e.json({ success: false, error: M.message }, 400);
      }
      const Y = /* @__PURE__ */ new Date(), v = Y.getFullYear().toString().slice(-2), ee = (Y.getMonth() + 1).toString().padStart(2, "0"), H = Y.getDate().toString().padStart(2, "0"), q = `${v}${ee}${H}`, J = Math.random().toString(36).substring(2, 7).toUpperCase(), ce = f || `ORD-${q}-${J}`, cs = c ? `${i} ${c}` : i, Ye = new Date(Date.now() + 600 * 1e3).toISOString(), Ms = (await s.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, reservation_expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(ce, r || null, m || 0, "pending", "pending", cs || null, l || null, u || null, d || null, g || null, Ye).run()).meta.last_row_id;
      for (const M of F) await s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ms, M.product_id, M.option_id, M.quantity, M.price, M.product_name).run();
      return console.log(`[Order] \u2705 \uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC: ${ce} (\uC608\uC57D \uB9CC\uB8CC: ${Ye})`), e.json({ success: true, data: { orderId: Ms, orderNumber: ce, totalAmount: m } });
    }
    if (!a || a.length === 0) return e.json({ success: false, error: "No items provided" }, 400);
    const w = a.map(() => "?").join(","), h = await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${w})
    `).bind(...a).all();
    if (h.results.length === 0) return e.json({ success: false, error: "No items found" }, 400);
    for (const O of h.results) if (O.product_stock < O.quantity) return e.json({ success: false, error: `Insufficient stock for ${O.product_name}` }, 400);
    const T = h.results.reduce((O, x) => O + x.price_snapshot * x.quantity, 0), y = `ORD${Date.now()}${Math.floor(Math.random() * 1e3)}`, $ = (await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(y, r, T, o.address, o.name, o.phone).run()).meta.last_row_id, A = [];
    for (const O of h.results) {
      let x = false, U = "";
      for (let L = 0; L < 3; L++) {
        const F = await s.prepare(`
          SELECT stock, version FROM products WHERE id = ?
        `).bind(O.product_id).first();
        if (!F) {
          U = `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${O.product_name}`;
          break;
        }
        const G = F.stock, Y = F.version;
        if (G < O.quantity) {
          U = `\uC7AC\uACE0 \uBD80\uC871: ${O.product_name} (\uB0A8\uC740 \uC7AC\uACE0: ${G}\uAC1C)`;
          break;
        }
        if ((await s.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND version = ?
            AND stock >= ?
            AND is_active = 1
        `).bind(O.quantity, O.product_id, Y, O.quantity).run()).meta.changes > 0) {
          x = true, console.log(`[\uC7AC\uACE0] \u2705 \uC7AC\uACE0 \uCC28\uAC10 \uC131\uACF5: ${O.product_name} (\uC218\uB7C9: ${O.quantity}, \uBC84\uC804: ${Y} \u2192 ${Y + 1})`);
          break;
        }
        console.warn(`[\uC7AC\uACE0] \u26A0\uFE0F \uBC84\uC804 \uCDA9\uB3CC \uAC10\uC9C0 (\uC2DC\uB3C4 ${L + 1}/3): ${O.product_name}`), L < 2 ? await new Promise((ee) => setTimeout(ee, 50 * (L + 1))) : U = "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958 \uBC1C\uC0DD. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694. (\uB3D9\uC2DC \uC8FC\uBB38 \uCC98\uB9AC \uC911)";
      }
      if (!x) return e.json({ success: false, error: U || "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, U.includes("\uC7AC\uACE0 \uBD80\uC871") ? 400 : 409);
      A.push(s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind($, O.product_id, O.option_id, O.quantity, O.price_snapshot, O.product_name));
    }
    A.push(s.prepare(`DELETE FROM cart_items WHERE id IN (${w})`).bind(...a)), await s.batch(A);
    try {
      const O = h.results.map((L) => L.product_id), x = O.map(() => "?").join(","), U = await s.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${x}) AND seller_id IS NOT NULL
      `).bind(...O).all();
      for (const L of U.results) {
        const F = L.seller_id;
        await Ma(s, F, y, buyerName || shippingName || "\uACE0\uAC1D", T);
      }
    } catch (O) {
      console.error("[Order] Notification error:", O);
    }
    return e.json({ success: true, data: { orderId: $, orderNumber: y, totalAmount: T } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/streams/:streamId/current-product", async (e) => {
  const { DB: s, LIVE_CACHE: t } = e.env, r = e.req.param("streamId");
  try {
    const a = `current-product:${r}`, o = await St(t, a, 3);
    if (o) return e.json({ success: true, data: o });
    const n = await s.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();
    if (!n || !n.current_product_id) return await _s(t, a, null, 3), e.json({ success: true, data: null });
    const i = await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(n.current_product_id).first(), c = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(n.current_product_id).all(), l = { product: i, options: c.results };
    return await _s(t, a, l, 3), e.json({ success: true, data: l });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/streams/:streamId/product-wait", async (e) => {
  const { LIVE_CACHE: s } = e.env, t = e.req.param("streamId"), r = e.req.query("lastTimestamp") || "0";
  try {
    const a = `product-timestamp:${t}`, o = `current-product:${t}`, n = 25e3, i = Date.now();
    for (; Date.now() - i < n; ) {
      const c = await s.get(a) || "0";
      if (c !== r) {
        const l = await St(s, o, 30);
        return e.json({ success: true, timestamp: c, data: l, changed: true });
      }
      await new Promise((l) => setTimeout(l, 1e3));
    }
    return e.json({ success: true, timestamp: r, data: null, changed: false });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/seller/dashboard/stats", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = t.sellerId, a = e.req.query("period") || "7d";
    let o = 7;
    a === "30d" ? o = 30 : a === "90d" && (o = 90);
    const n = await s.prepare(`
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
    `).bind(r, `-${o} days`).all(), i = await s.prepare(`
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
    `).bind(r, `-${o} days`).first(), c = await s.prepare(`
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
    `).bind(r, `-${o} days`).all();
    return e.json({ success: true, data: { period: a, daily: n.results || [], summary: i || {}, topProducts: c.results || [] } });
  } catch (r) {
    return console.error("Error loading seller dashboard stats:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/analytics/products", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = t.sellerId, a = await s.prepare(`
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
    `).bind(r).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (r) {
    return console.error("Error loading product analytics:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/streams", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = t.sellerId, a = await s.prepare(`
      SELECT 
        id, 
        title, 
        description, 
        youtube_video_id, 
        status, 
        current_product_id, 
        seller_id,
        scheduled_at, 
        started_at, 
        ended_at, 
        created_at, 
        updated_at
      FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (r) {
    return console.error("Error loading seller streams:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/streams", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { title: r, description: a, youtube_video_id: o, youtube_url: n, thumbnail_url: i, scheduled_at: c, status: l, seller_instagram: u, seller_youtube: d, seller_facebook: m } = await e.req.json();
    let _ = o, f = "youtube", g = null, b = null, w = i;
    if (n && !_ && (_ = vt(n), !_)) if (_ = Dt(n), g = Ot(n), b = xa(n), _) f = "tiktok";
    else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok live stream URL." }, 400);
    if (!w && _ && f === "youtube" && (w = `https://img.youtube.com/vi/${_}/maxresdefault.jpg`), !r || !_) return e.json({ success: false, error: "Title and live stream URL are required" }, 400);
    const h = await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, _, l || "scheduled", c || null, t.sellerId, u || null, d || null, m || null, f, g, b, w || null).run(), T = await s.prepare(`
      SELECT 
        id, 
        title, 
        description, 
        youtube_video_id, 
        status, 
        current_product_id, 
        seller_id,
        scheduled_at, 
        started_at, 
        ended_at, 
        created_at, 
        updated_at
      FROM live_streams 
      WHERE id = ?
    `).bind(h.meta.last_row_id).first(), y = await s.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(t.sellerId).first();
    try {
      const { sendLiveStreamCreatedEmail: R } = await Promise.resolve().then(() => Xa);
      R({ streamId: h.meta.last_row_id, title: r, sellerName: (y == null ? void 0 : y.display_name) || (y == null ? void 0 : y.username) || "\uC54C \uC218 \uC5C6\uC74C", platform: f, scheduledAt: c, status: l || "scheduled" }).then(($) => {
        $.success ? console.log(`[Email] Live stream notification sent for stream #${$.meta.last_row_id}`) : console.error("[Email] Failed to send notification:", $.error);
      }).catch(($) => {
        console.error("[Email] Exception while sending notification:", $);
      });
    } catch (R) {
      console.error("[Email] Failed to send live stream notification:", R);
    }
    return await Be(e.env, Ke.LIVE_STREAMS), e.json({ success: true, data: T });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/seller/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const { title: o, description: n, youtube_video_id: i, youtube_url: c, scheduled_at: l, status: u, seller_instagram: d, seller_youtube: m, seller_facebook: _ } = await e.req.json(), f = [], g = [];
    if (o !== void 0 && (f.push("title = ?"), g.push(o)), n !== void 0 && (f.push("description = ?"), g.push(n)), c !== void 0 || i !== void 0) {
      let b = i, w = "youtube", h = null;
      if (c && (b = vt(c), !b)) if (b = Dt(c), h = Ot(c), b) w = "tiktok";
      else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok video URL." }, 400);
      b !== void 0 && (f.push("youtube_video_id = ?"), g.push(b), f.push("platform = ?"), g.push(w), w === "tiktok" && h && (f.push("tiktok_username = ?"), g.push(h)));
    }
    return u !== void 0 && (f.push("status = ?"), g.push(u)), l !== void 0 && (f.push("scheduled_at = ?"), g.push(l)), d !== void 0 && (f.push("seller_instagram = ?"), g.push(d)), m !== void 0 && (f.push("seller_youtube = ?"), g.push(m)), _ !== void 0 && (f.push("seller_facebook = ?"), g.push(_)), f.length === 0 ? e.json({ success: false, error: "No fields to update" }, 400) : (f.push("updated_at = datetime('now')"), await s.prepare(`
      UPDATE live_streams SET ${f.join(", ")} WHERE id = ?
    `).bind(...g, r).run(), await Be(e.env, Ke.LIVE_STREAMS), e.json({ success: true }));
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/seller/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    return await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first() ? (await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), await Be(e.env, Ke.LIVE_STREAMS), e.json({ success: true })) : e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/youtube/create-live", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { title: r, description: a, scheduled_at: o } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1 \uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const n = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!n) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD658\uACBD \uBCC0\uC218\uB97C \uC124\uC815\uD574\uC8FC\uC138\uC694.", help: "wrangler secret put YOUTUBE_ACCESS_TOKEN" }, 400);
    const i = await Fa({ accessToken: n }, r, a || ""), l = (await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, i.broadcastId, o || null, t.sellerId, i.broadcastId, i.streamKey).run()).meta.last_row_id;
    return await is(s, t.sellerId, "seller", "live_created", "\u{1F4FA} YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r} - \uC2A4\uD2B8\uB9BC \uD0A4\uC640 URL\uC744 \uD655\uC778\uD558\uC138\uC694`, `/seller/live-control?streamId=${l}`), e.json({ success: true, data: { streamId: l, broadcastId: i.broadcastId, youtubeVideoId: i.broadcastId, streamKey: i.streamKey, streamUrl: i.streamUrl, watchUrl: `https://www.youtube.com/watch?v=${i.broadcastId}` } });
  } catch (r) {
    return console.error("[YouTube Live] Create broadcast error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/youtube/end-live/:streamId", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("streamId"), a = await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const n = a.youtube_broadcast_id || a.youtube_video_id;
    return n ? (await Ua({ accessToken: o }, n), await s.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(), await is(s, t.sellerId, "seller", "live_ended", "\u2705 YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${a.title} \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, "/seller/streams"), e.json({ success: true, message: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" })) : e.json({ success: false, error: "YouTube Broadcast ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uB3D9\uC73C\uB85C \uC0DD\uC131\uB41C \uB77C\uC774\uBE0C\uC785\uB2C8\uB2E4." }, 400);
  } catch (r) {
    return console.error("[YouTube Live] End broadcast error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/youtube/stats/:streamId", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("streamId"), a = await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = a.youtube_video_id;
    if (!o) return e.json({ success: false, error: "YouTube Video ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    const n = e.env.YOUTUBE_API_KEY, i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!n && !i) return e.json({ success: false, error: "YouTube API Key \uB610\uB294 Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await Pa({ apiKey: n, accessToken: i }, o);
    return e.json({ success: true, data: { streamId: r, videoId: o, stats: c } });
  } catch (r) {
    return console.error("[YouTube Live] Get stats error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/youtube/chat/:streamId", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("streamId"), a = e.req.query("pageToken"), o = await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first();
    if (!o) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = o.youtube_live_chat_id;
    if (!n) return e.json({ success: false, error: "Live Chat ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!i) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await qa({ accessToken: i }, n, a);
    return e.json({ success: true, data: c });
  } catch (r) {
    return console.error("[YouTube Live] Get chat messages error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/streams", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { title: r, description: a, youtube_video_id: o, platform: n, tiktok_username: i, status: c } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const l = n || "youtube";
    if (l === "youtube" && !o) return e.json({ success: false, error: "YouTube \uD50C\uB7AB\uD3FC\uC740 \uC601\uC0C1 ID\uAC00 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    if (l === "tiktok" && !i) return e.json({ success: false, error: "TikTok \uD50C\uB7AB\uD3FC\uC740 \uC0AC\uC6A9\uC790\uBA85\uC774 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const u = await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(r, a || null, o || null, l, i || null, c || "scheduled", t.sellerId || null).run();
    return await Be(e.env, Ke.LIVE_STREAMS), e.json({ success: true, data: { id: u.meta.last_row_id, title: r, description: a, youtube_video_id: o, platform: l, tiktok_username: i, status: c || "scheduled" } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/admin/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { title: a, description: o, youtube_video_id: n, platform: i, tiktok_username: c, status: l } = await e.req.json();
    return await s.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, o, n || null, i || "youtube", c || null, l, r).run(), await Be(e.env, Ke.LIVE_STREAMS), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/streams/:streamId/change-product", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("streamId"), { productId: a } = await e.req.json();
    if (!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const n = await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(a, t.sellerId).first();
    if (!n) return e.json({ success: false, error: "Product not found or not active" }, 404);
    const i = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(a).all();
    await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a, r).run();
    const { LIVE_CACHE: c } = e.env, l = `product-timestamp:${r}`, u = `current-product:${r}`, d = Date.now().toString();
    await c.put(l, d), await _s(c, u, { product: n, options: i.results }, 30);
    try {
      await ns(e.env).changeCurrentProduct(parseInt(r), a), console.log(`\u{1F525} Firebase: Product changed for stream ${r} to ${a}`);
    } catch (m) {
      console.error("\u26A0\uFE0F Firebase sync failed (non-blocking):", m);
    }
    return e.json({ success: true, data: { product: n, options: i.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/admin/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    return await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), await Be(e.env, Ke.LIVE_STREAMS), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/streams/:streamId/change-product", async (e) => {
  const { DB: s } = e.env, t = e.req.param("streamId");
  try {
    const { productId: r } = await e.req.json(), a = await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id FROM products WHERE id = ? AND is_active = 1").bind(r).first();
    if (!a) return e.json({ success: false, error: "Product not found" }, 404);
    const o = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();
    await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(r, t).run();
    const { LIVE_CACHE: n } = e.env, i = `product-timestamp:${t}`, c = `current-product:${t}`, l = Date.now().toString();
    return await n.put(i, l), await _s(n, c, { product: a, options: o.results }, 30), e.json({ success: true, data: { product: a, options: o.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/wishlists", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { userId: t, productId: r } = await e.req.json();
    if (!t || !r) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uC640 \uC0C1\uD488 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
    if (!await s.prepare("SELECT id FROM users WHERE id = ?").bind(t).first()) return e.json({ success: false, error: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC0AC\uC6A9\uC790\uC785\uB2C8\uB2E4." }, 404);
    const o = await s.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(r).first();
    if (!o) return e.json({ success: false, error: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC0C1\uD488\uC774\uAC70\uB098 \uD310\uB9E4\uAC00 \uC911\uB2E8\uB41C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 404);
    if (await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t, r).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uCC1C\uD55C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 409);
    const i = await s.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(t, r).run();
    return e.json({ success: true, data: { id: i.meta.last_row_id, userId: t, productId: r, productName: o.name } });
  } catch (t) {
    return console.error("[Wishlist] Add error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.delete("/api/wishlists/:id", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("id"), { userId: r } = e.req.query();
    return r ? await s.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(t, r).first() ? (await s.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(t, r).run(), e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (t) {
    return console.error("[Wishlist] Delete error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.delete("/api/wishlists/product/:productId", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("productId"), { userId: r } = e.req.query();
    return r ? (await s.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r, t).run()).meta.changes === 0 ? e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (t) {
    return console.error("[Wishlist] Delete by product error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/wishlists/:userId", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("userId"), r = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0"), { results: o } = await s.prepare(`
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
    `).bind(t, r, a).all(), n = await s.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(t).first();
    return e.json({ success: true, data: { items: o, total: (n == null ? void 0 : n.count) || 0, limit: r, offset: a } });
  } catch (t) {
    return console.error("[Wishlist] Get error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/wishlists/check/:userId/:productId", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("userId"), r = e.req.param("productId"), a = await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t, r).first();
    return e.json({ success: true, data: { isWishlisted: !!a, wishlistId: (a == null ? void 0 : a.id) || null } });
  } catch (t) {
    return console.error("[Wishlist] Check error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.delete("/api/shipping-addresses/:id", j, async (e) => {
  const { DB: s } = e.env, t = e.req.param("id");
  e.get("userId");
  try {
    return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t, userId).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/products", async (e) => {
  const { DB: s, CACHE_KV: t } = e.env, r = await N(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const a = `seller:${r.sellerId}:products`, o = await t.get(a, "json");
    if (o) return e.json({ success: true, data: o, cached: true });
    const n = await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(r.sellerId).all();
    return await t.put(a, JSON.stringify(n.results), { expirationTtl: 300 }), e.json({ success: true, data: n.results });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.post("/api/seller/upload-image", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { image: r, filename: a } = await e.req.json();
    if (!r) return e.json({ success: false, error: "Image data is required" }, 400);
    const o = r.match(/^data:(image\/[\w+]+);base64,/);
    if (!o) return e.json({ success: false, error: "\uC798\uBABB\uB41C \uC774\uBBF8\uC9C0 \uD615\uC2DD\uC785\uB2C8\uB2E4." }, 400);
    const n = o[1], i = r.replace(/^data:image\/\w+;base64,/, "");
    let c;
    try {
      c = Uint8Array.from(atob(i), (m) => m.charCodeAt(0));
    } catch {
      return e.json({ success: false, error: "\uC774\uBBF8\uC9C0 \uB514\uCF54\uB529 \uC2E4\uD328" }, 400);
    }
    const l = 10 * 1024 * 1024;
    if (c.length > l) return e.json({ success: false, error: `\uD30C\uC77C \uD06C\uAE30\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4. \uCD5C\uB300 ${l / 1024 / 1024}MB\uAE4C\uC9C0 \uD5C8\uC6A9\uB429\uB2C8\uB2E4.` }, 400);
    const u = await yr(c.buffer);
    if (!u.valid) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC774\uBBF8\uC9C0 \uD30C\uC77C\uC785\uB2C8\uB2E4." }, 400);
    const d = e.env.IMAGES;
    if (d) {
      console.log("[Image Upload] Using R2 storage");
      const m = gr(a || "upload.jpg"), _ = `products/${t.sellerId}/${m}`;
      await d.put(_, c, { httpMetadata: { contentType: u.detectedType || n } });
      const f = `/api/images/${_}`;
      return e.json({ success: true, url: f, variants: { thumbnail: `${f}?width=200&format=webp`, medium: `${f}?width=800&format=webp`, large: `${f}?width=1600&format=webp`, original: f }, storage: "r2" });
    } else return console.log("[Image Upload] R2 not available, using Base64 fallback"), r.length * 0.75 / (1024 * 1024) > 1 ? e.json({ success: false, error: "Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)" }, 400) : e.json({ success: true, url: r, storage: "base64", warning: "Using Base64 storage. Enable R2 for better performance." });
  } catch (r) {
    return console.error("[Image Upload] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/images/*", async (e) => {
  var s;
  try {
    const t = e.env.IMAGES;
    if (!t) return e.json({ success: false, error: "R2 not configured" }, 503);
    const r = e.req.path.replace("/api/images/", ""), a = e.req.query("width"), o = e.req.query("format"), n = e.req.query("quality") || "85", i = await t.get(r);
    if (!i) return e.notFound();
    const c = { "Content-Type": ((s = i.httpMetadata) == null ? void 0 : s.contentType) || "image/jpeg", "Cache-Control": "public, max-age=31536000" };
    if (a || o) {
      const l = [];
      a && l.push(`width=${a}`), o && l.push(`format=${o}`), n && l.push(`quality=${n}`), c["cf-resize"] = l.join(",");
    }
    return new Response(i.body, { headers: c });
  } catch (t) {
    return console.error("[Image Get] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/products", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { name: r, description: a, price: o, original_price: n, discount_rate: i, image_url: c, stock: l, category: u, live_stream_id: d, is_active: m } = await e.req.json();
    if (!r || !o) return e.json({ success: false, error: "Name and price are required" }, 400);
    if (d && !await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d, t.sellerId).first()) return e.json({ success: false, error: "Live stream not found or unauthorized" }, 404);
    const _ = await s.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a || null, o, n || null, i || 0, c || null, l || 0, u || null, d || null, t.sellerId, m !== void 0 ? m : 1).run(), f = await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(_.meta.last_row_id).first();
    return await Ls(e.env.CACHE_KV, `seller:${t.sellerId}:products`, `public:seller:${t.sellerId}`), e.json({ success: true, data: f });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/products/:id", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), a = await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(r, t.sellerId).first();
    return a ? e.json({ success: true, data: a }) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/seller/products/:id", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { name: o, description: n, price: i, original_price: c, image_url: l, stock: u, category: d, is_active: m, live_stream_id: _ } = await e.req.json(), f = [], g = [];
    if (o !== void 0 && (f.push("name = ?"), g.push(o)), n !== void 0 && (f.push("description = ?"), g.push(n)), i !== void 0 && (f.push("price = ?"), g.push(i)), c !== void 0 && (f.push("original_price = ?"), g.push(c), i !== void 0 && c)) {
      const w = Math.round((c - i) / c * 100);
      f.push("discount_rate = ?"), g.push(w);
    }
    if (l !== void 0 && (f.push("image_url = ?"), g.push(l)), u !== void 0 && (f.push("stock = ?"), g.push(u)), d !== void 0 && (f.push("category = ?"), g.push(d)), m !== void 0 && (f.push("is_active = ?"), g.push(m ? 1 : 0)), _ !== void 0 && (f.push("live_stream_id = ?"), g.push(_ || null)), f.push("updated_at = CURRENT_TIMESTAMP"), g.push(r, t.sellerId), f.length === 1) return e.json({ success: false, error: "No fields to update" }, 400);
    await s.prepare(`UPDATE products SET ${f.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...g).run();
    const b = await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(r).first();
    return await Ls(e.env.CACHE_KV, `seller:${t.sellerId}:products`, `public:seller:${t.sellerId}`), e.json({ success: true, data: b });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/seller/products/:id", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const o = await s.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();
    return o && o.count > 0 ? e.json({ success: false, error: "\uC774\uBBF8 \uC8FC\uBB38\uB41C \uC0C1\uD488\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD488\uC808 \uCC98\uB9AC\uD558\uAC70\uB098 \uC228\uAE40 \uCC98\uB9AC\uD574\uC8FC\uC138\uC694." }, 400) : (await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(), await s.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(), await s.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(), await s.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).run(), await Ls(e.env.CACHE_KV, `seller:${t.sellerId}:products`, `public:seller:${t.sellerId}`), e.json({ success: true }));
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/products/:id/options", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const o = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();
    return e.json({ success: true, data: o.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/products/:id/options", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { option_type: o, option_value: n, price_adjustment: i, stock: c } = await e.req.json();
    if (!o || !n) return e.json({ success: false, error: "Option type and value are required" }, 400);
    const l = await s.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r, o, n, i || 0, c || 0).run();
    return e.json({ success: true, data: { id: l.meta.last_row_id, product_id: r, option_type: o, option_value: n, price_adjustment: i || 0, stock: c || 0 } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/seller/products/:productId/options/:optionId", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("productId"), a = e.req.param("optionId");
    return await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first() ? (await s.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a, r).run(), e.json({ success: true })) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/stats", async (e) => {
  const { DB: s, CACHE_KV: t } = e.env, r = await N(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const a = `seller:${r.sellerId}:stats`, o = await t.get(a, "json");
    if (o) return e.json({ success: true, data: o, cached: true });
    const n = await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(r.sellerId).first(), i = await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(r.sellerId).first(), c = await s.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(r.sellerId).first(), l = await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(r.sellerId).first(), u = await s.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(), d = await s.prepare(`
      SELECT SUM(viewer_count) as total
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(), m = (d == null ? void 0 : d.total) || 0, _ = { totalProducts: n.count || 0, activeProducts: i.count || 0, totalStock: c.total || 0, totalOrders: l.count || 0, totalRevenue: l.total || 0, activeStreams: u.count || 0, totalViewers: m };
    return await t.put(a, JSON.stringify(_), { expirationTtl: 60 }), e.json({ success: true, data: _ });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/seller/stats/sales", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.query("period") || "daily";
    let a, o, n;
    switch (r) {
      case "weekly":
        a = "%Y-W%W", o = "week", n = 28;
        break;
      case "monthly":
        a = "%Y-%m", o = "month", n = 180;
        break;
      default:
        a = "%Y-%m-%d", o = "day", n = 30;
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
        AND o.created_at >= datetime('now', '-${n} days')
        AND o.status != 'cancelled'
      GROUP BY period
      ORDER BY period ASC
    `).bind(t.sellerId).all();
    return e.json({ success: true, data: { period: r, sales: i.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/stats/products", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = parseInt(e.req.query("limit") || "10"), a = parseInt(e.req.query("days") || "30"), o = await s.prepare(`
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
    `).bind(t.sellerId, r).all();
    return e.json({ success: true, data: { products: o.results, period_days: a } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/business-info", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { business_number: r, business_name: a, ceo_name: o, business_type: n, business_category: i, postal_code: c, address: l, phone: u, email: d } = await e.req.json();
    if (!r || !a || !o) return e.json({ success: false, error: "\uC0AC\uC5C5\uC790\uB4F1\uB85D\uBC88\uD638, \uC0C1\uD638\uBA85, \uB300\uD45C\uC790\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const m = await s.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();
    let _;
    return m ? _ = await s.prepare(`
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
      `).bind(r, a, o, n, i, c, l, u, d, t.sellerId).run() : _ = await s.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(t.sellerId, r, a, o, n, i, c, l, u, d).run(), e.json({ success: true, data: { id: m ? m.id : _.meta.last_row_id, seller_id: t.sellerId, business_number: r, is_verified: false, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4." } });
  } catch (r) {
    return console.error("\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uB4F1\uB85D \uC624\uB958:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/business-info", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "\uB4F1\uB85D\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/admin/seller-business/:id/verify", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  const r = e.req.param("id"), { verified: a } = await e.req.json();
  try {
    return a ? (await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(), e.json({ success: true, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : (await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(), e.json({ success: true, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uC2B9\uC778\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }));
  } catch (o) {
    return e.json({ success: false, error: o.message }, 500);
  }
});
p.get("/api/admin/seller-business", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = await s.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();
    return e.json({ success: true, data: r.results || [] });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/orders", j, async (e) => {
  const { DB: s } = e.env, t = e.get("userId");
  try {
    const r = await s.prepare(`
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
    `).bind(t).all(), a = /* @__PURE__ */ new Map();
    for (const n of r.results) {
      const i = n.id;
      a.has(i) || a.set(i, { id: n.id, user_id: n.user_id, order_number: n.order_number, status: n.status, total_amount: n.total_amount, shipping_fee: n.shipping_fee, payment_method: n.payment_method, payment_key: n.payment_key, shipping_address: n.shipping_address, shipping_name: n.shipping_name, shipping_phone: n.shipping_phone, delivery_request: n.delivery_request, created_at: n.created_at, updated_at: n.updated_at, items: [] }), n.item_id && a.get(i).items.push({ id: n.item_id, product_id: n.product_id, option_id: n.option_id, quantity: n.quantity, price: n.item_price, product_name: n.product_name, image_url: n.image_url, option_value: n.option_value });
    }
    const o = Array.from(a.values());
    return e.json({ success: true, data: o });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/orders/user/:userId", j, async (e) => {
  const { DB: s } = e.env, t = e.get("userId"), r = parseInt(e.req.param("userId"));
  try {
    if (r !== t) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC8FC\uBB38 \uB0B4\uC5ED\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
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
    `).bind(t).all(), o = /* @__PURE__ */ new Map();
    for (const i of a.results) {
      const c = i.id;
      o.has(c) || o.set(c, { id: i.id, user_id: i.user_id, order_number: i.order_number, status: i.status, total_amount: i.total_amount, shipping_fee: i.shipping_fee, payment_method: i.payment_method, payment_key: i.payment_key, shipping_address: i.shipping_address, shipping_name: i.shipping_name, shipping_phone: i.shipping_phone, delivery_request: i.delivery_request, created_at: i.created_at, updated_at: i.updated_at, items: [] }), i.item_id && o.get(c).items.push({ id: i.item_id, product_id: i.product_id, option_id: i.option_id, quantity: i.quantity, price: i.item_price, product_name: i.product_name, image_url: i.image_url, option_value: i.option_value });
    }
    const n = Array.from(o.values());
    return e.json({ success: true, data: n });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/orders/:orderNumber", j, async (e) => {
  const { DB: s } = e.env, t = e.req.param("orderNumber");
  try {
    const r = await s.prepare(`
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
    `).bind(t).all();
    if (r.results.length === 0) return e.json({ success: false, error: "Order not found" }, 404);
    const a = r.results[0], o = { id: a.id, user_id: a.user_id, order_number: a.order_number, status: a.status, total_amount: a.total_amount, shipping_fee: a.shipping_fee, payment_method: a.payment_method, payment_key: a.payment_key, shipping_address: a.shipping_address, shipping_name: a.shipping_name, shipping_phone: a.shipping_phone, delivery_request: a.delivery_request, created_at: a.created_at, updated_at: a.updated_at, items: [] };
    for (const n of r.results) n.item_id && o.items.push({ id: n.item_id, product_id: n.product_id, option_id: n.option_id, quantity: n.quantity, price: n.item_price, product_name: n.product_name, image_url: n.image_url, option_value: n.option_value });
    return e.json({ success: true, data: o });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/orders/:orderId/cancel", j, async (e) => {
  const { DB: s } = e.env, t = e.req.param("orderId");
  try {
    const a = (await e.req.json()).reason || "\uC0AC\uC720 \uC5C6\uC74C", o = await s.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(t).first();
    if (!o) return e.json({ success: false, error: "Order not found" }, 404);
    if (o.status !== "pending") return e.json({ success: false, error: "\uACB0\uC81C \uB300\uAE30 \uC911\uC778 \uC8FC\uBB38\uB9CC \uCDE8\uC18C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACB0\uC81C\uAC00 \uC644\uB8CC\uB41C \uC8FC\uBB38\uC740 \uD658\uBD88\uC744 \uC2E0\uCCAD\uD574\uC8FC\uC138\uC694." }, 400);
    const n = await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(t).all();
    if (n.results.length > 0) {
      const i = n.results.map((c) => s.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(c.quantity, c.product_id));
      await s.batch(i);
    }
    return await s.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled", a, t).run(), e.json({ success: true, message: "Order cancelled successfully", data: { orderId: t, reason: a, itemsRestored: n.results.length } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/streams/:streamId/viewer-count", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("streamId"), r = await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(t).first();
    return r ? e.json({ success: true, data: { viewer_count: r.viewer_count || 0 } }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.put("/api/streams/:streamId/viewer-count", async (e) => {
  const { DB: s } = e.env, t = await P(e), r = t.success ? { success: false } : await N(e);
  if (!t.success && !r.success) return e.json({ success: false, error: "Unauthorized" }, 401);
  try {
    const a = e.req.param("streamId"), { viewer_count: o } = await e.req.json();
    return typeof o != "number" || o < 0 ? e.json({ success: false, error: "Invalid viewer count" }, 400) : r.success && !await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a, r.sellerId).first() ? e.json({ success: false, error: "Stream not found or unauthorized" }, 404) : (await s.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(o, a).run(), e.json({ success: true, data: { viewer_count: o } }));
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.post("/api/streams/:streamId/view", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("streamId");
    await s.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(t).run();
    const r = await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(t).first();
    return e.json({ success: true, data: { viewer_count: (r == null ? void 0 : r.viewer_count) || 0 } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/payments/confirm", async (e) => {
  var r;
  const { DB: s } = e.env;
  let t = null;
  try {
    t = await e.req.json();
    const { paymentKey: a, orderId: o, amount: n } = t;
    if (console.log("========================================"), console.log("[Payment] \u{1F680} \uACB0\uC81C \uC2B9\uC778 API \uD638\uCD9C\uB428"), console.log("========================================"), console.log("[Payment] \u{1F4CB} \uC694\uCCAD \uD30C\uB77C\uBBF8\uD130:"), console.log("  - orderId:", o), console.log("  - paymentKey:", a), console.log("  - amount:", n), console.log("  - timestamp:", (/* @__PURE__ */ new Date()).toISOString()), !a || !o || !n) return console.error("[Payment] \u274C \uD544\uC218 \uD30C\uB77C\uBBF8\uD130 \uB204\uB77D!"), console.error("[Payment] paymentKey:", !!a), console.error("[Payment] orderId:", !!o), console.error("[Payment] amount:", !!n), e.json({ success: false, error: "\uD544\uC218 \uD30C\uB77C\uBBF8\uD130\uAC00 \uB204\uB77D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", details: { paymentKey: !!a, orderId: !!o, amount: !!n } }, 400);
    console.log("[Payment] \u2705 \uD544\uC218 \uD30C\uB77C\uBBF8\uD130 \uAC80\uC99D \uD1B5\uACFC");
    const i = await s.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(o).first();
    if (!i) return console.error("[Payment] \u274C \uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C:", o), e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uBB38\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uAC70\uB098 \uC774\uBBF8 \uCC98\uB9AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", orderId: o }, 404);
    if (console.log("[Payment] \u2705 \uC8FC\uBB38 \uD655\uC778\uB428:", { id: i.id, order_number: i.order_number, total_amount: i.total_amount, status: i.status }), Number(n) !== Number(i.total_amount)) return console.error("[Payment] \u274C \uAE08\uC561 \uBD88\uC77C\uCE58!", { requested: Number(n), expected: Number(i.total_amount) }), e.json({ success: false, error: "\uACB0\uC81C \uAE08\uC561\uC774 \uC8FC\uBB38 \uAE08\uC561\uACFC \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", requestedAmount: Number(n), expectedAmount: Number(i.total_amount) }, 400);
    const c = e.env.TOSS_SECRET_KEY;
    if (!c) return console.error("[Payment] \u274C TOSS_SECRET_KEY \uD658\uACBD \uBCC0\uC218 \uC5C6\uC74C"), console.error("[Payment] c.env:", Object.keys(e.env || {})), e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    console.log("[Payment] \u2705 TOSS_SECRET_KEY \uD655\uC778\uB428:", c.substring(0, 20) + "..."), console.log("[Payment] \u{1F310} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uD638\uCD9C \uC2DC\uC791..."), console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"), console.log("[Payment] API \uBC84\uC804: 2022-11-16 (\uACB0\uC81C\uC704\uC82F \uACE0\uC815 \uBC84\uC804)");
    const l = "Basic " + btoa(c + ":");
    console.log("[Payment] Authorization \uD5E4\uB354 \uC0DD\uC131 \uC644\uB8CC");
    const u = { orderId: o, amount: Number(n), paymentKey: a };
    console.log("[Payment] \uC694\uCCAD \uBCF8\uBB38:", JSON.stringify(u, null, 2)), console.log("[Payment] \u{1F4CA} amount \uD0C0\uC785:", typeof u.amount), console.log("[Payment] \u{1F4CA} amount \uAC12:", u.amount);
    const d = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: l, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(u) }), m = await d.json();
    if (console.log("[Payment] \u{1F4E1} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uC751\uB2F5:"), console.log("  - HTTP \uC0C1\uD0DC:", d.status), console.log("  - \uC751\uB2F5 OK?:", d.ok), console.log("  - \uC751\uB2F5 \uB370\uC774\uD130 (\uC77C\uBD80):", JSON.stringify(m).substring(0, 300)), !d.ok) return console.error("[Payment] \u274C\u274C\u274C \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC2B9\uC778 \uC2E4\uD328!"), console.error("[Payment] HTTP \uC0C1\uD0DC:", d.status), console.error("[Payment] \uC5D0\uB7EC \uCF54\uB4DC:", m.code), console.error("[Payment] \uC5D0\uB7EC \uBA54\uC2DC\uC9C0:", m.message), console.error("[Payment] \uC804\uCCB4 \uC751\uB2F5:", JSON.stringify(m, null, 2)), e.json({ success: false, error: m.message || "\uACB0\uC81C \uC2B9\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", code: m.code, tossError: m }, d.status);
    console.log("[Payment] \u2705 \uACB0\uC81C \uC2B9\uC778 \uC131\uACF5! paymentKey:", a), console.log("[Payment] \u2705 \uC8FC\uBB38 \uBC88\uD638:", o);
    try {
      await s.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            reservation_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a, o).run(), console.log("[Payment] \u2705 \uC8FC\uBB38 \uC0C1\uD0DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC");
      const _ = await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(o).all();
      if (_.results.length > 0) {
        console.log(`[Stock] \u{1F512} \uC7AC\uACE0 \uD655\uC815 \uC2DC\uC791: ${_.results.length}\uAC1C \uC0C1\uD488`);
        const f = _.results.map((w) => s.prepare(`
            UPDATE products 
            SET stock = stock - ?,
                reserved_stock = reserved_stock - ?
            WHERE id = ?
          `).bind(w.quantity, w.quantity, w.product_id)), g = await s.batch(f);
        let b = 0;
        for (let w = 0; w < g.length; w++) if (g[w].meta.changes > 0) {
          b++;
          const h = _.results[w];
          console.log(`[Stock] \u2705 \uC7AC\uACE0 \uD655\uC815: product_id=${h.product_id}, quantity=${h.quantity}`);
        } else {
          const h = _.results[w];
          console.error(`[Stock] \u26A0\uFE0F \uC7AC\uACE0 \uD655\uC815 \uC2E4\uD328: product_id=${h.product_id}`);
        }
        console.log(`[Stock] \u2705 \uC7AC\uACE0 \uD655\uC815 \uC644\uB8CC: ${b}/${_.results.length}\uAC1C \uC131\uACF5`);
        try {
          const w = _.results.map((y) => y.product_id), h = w.map(() => "?").join(","), T = await s.prepare(`
            SELECT id, name, stock, reserved_stock, stock_alert_threshold, seller_id 
            FROM products 
            WHERE id IN (${h})
          `).bind(...w).all();
          for (const y of T.results) {
            const R = y.stock_alert_threshold || 10, $ = y.stock || 0, A = y.reserved_stock || 0, O = $ - A;
            O <= R && y.seller_id && (await It(s, y.seller_id, y.name, O, R), console.log(`[Low Stock Alert] \u{1F4E2} ${y.name}: \uAC00\uC6A9\uC7AC\uACE0 ${O}\uAC1C (\uC784\uACC4\uAC12 ${R}\uAC1C)`));
          }
        } catch (w) {
          console.error("[Low Stock Alert] \u26A0\uFE0F \uC54C\uB9BC \uC804\uC1A1 \uC2E4\uD328:", w);
        }
      }
      try {
        const f = i.id, g = await Qr(e.env, f);
        g.success ? console.log(`[Payment] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5 (\uC8FC\uBB38 ${f})`) : console.warn(`[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328 (\uC8FC\uBB38 ${f}):`, g.reason || g.error);
      } catch (f) {
        console.error("[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC911 \uC624\uB958:", f);
      }
    } catch (_) {
      console.error("[Payment] \u26A0\uFE0F DB \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 (\uACB0\uC81C\uB294 \uC131\uACF5):", _);
    }
    if (e.env.DISCORD_WEBHOOK_URL) try {
      await Ta(e.env.DISCORD_WEBHOOK_URL, "\uACB0\uC81C \uC131\uACF5", `\uC8FC\uBB38\uBC88\uD638 ${o} \uACB0\uC81C \uC644\uB8CC`, { \uC8FC\uBB38\uBC88\uD638: o, \uACB0\uC81C\uAE08\uC561: `\u20A9${Number(n).toLocaleString()}`, \uACB0\uC81C\uD0A4: a.substring(0, 20) + "...", \uC0AC\uC6A9\uC790ID: i.user_id });
    } catch (_) {
      console.error("[Discord] \uACB0\uC81C \uC131\uACF5 \uC54C\uB9BC \uC2E4\uD328:", _);
    }
    return e.json({ success: true, data: m });
  } catch (a) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328:", { orderId: t == null ? void 0 : t.orderId, error: a.message, stack: (r = a.stack) == null ? void 0 : r.substring(0, 500) }), e.json({ success: false, error: "\uACB0\uC81C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uACE0\uAC1D\uC13C\uD130\uB85C \uBB38\uC758\uD574\uC8FC\uC138\uC694.", details: a.message }, 500);
  }
});
p.post("/api/payments/rollback", async (e) => {
  var t;
  const { DB: s } = e.env;
  try {
    const { orderId: r, reason: a } = await e.req.json();
    if (console.log("========================================"), console.log("[Rollback] \u{1F504} \uC7AC\uACE0 \uC608\uC57D \uD574\uC81C \uC2DC\uC791"), console.log("========================================"), console.log("[Rollback] \uC8FC\uBB38 \uBC88\uD638:", r), console.log("[Rollback] \uC0AC\uC720:", a || "\uACB0\uC81C \uC2E4\uD328"), !r) return e.json({ success: false, error: "\uC8FC\uBB38 \uBC88\uD638\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
    const o = await s.prepare("SELECT id, order_number, status FROM orders WHERE order_number = ?").bind(r).first();
    if (!o) return console.warn("[Rollback] \u26A0\uFE0F \uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C:", r), e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (o.status === "paid") return console.warn("[Rollback] \u26A0\uFE0F \uC774\uBBF8 \uACB0\uC81C \uC644\uB8CC\uB41C \uC8FC\uBB38:", r), e.json({ success: false, error: "\uC774\uBBF8 \uACB0\uC81C\uAC00 \uC644\uB8CC\uB41C \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400);
    console.log("[Rollback] \u2705 \uC8FC\uBB38 \uD655\uC778\uB428:", o.order_number);
    const n = await s.prepare(`
      SELECT product_id, quantity 
      FROM order_items 
      WHERE order_id = ?
    `).bind(o.id).all();
    if (n.results.length === 0) return console.warn("[Rollback] \u26A0\uFE0F \uC8FC\uBB38 \uC544\uC774\uD15C \uC5C6\uC74C"), e.json({ success: false, error: "\uC8FC\uBB38 \uC544\uC774\uD15C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    console.log(`[Rollback] \u{1F4E6} ${n.results.length}\uAC1C \uC0C1\uD488 \uC608\uC57D \uD574\uC81C \uC2DC\uC791...`);
    const i = n.results.map((u) => s.prepare(`
        UPDATE products 
        SET reserved_stock = CASE 
          WHEN reserved_stock >= ? THEN reserved_stock - ?
          ELSE 0
        END
        WHERE id = ?
      `).bind(u.quantity, u.quantity, u.product_id)), c = await s.batch(i);
    let l = 0;
    for (let u = 0; u < c.length; u++) if (c[u].meta.changes > 0) {
      l++;
      const d = n.results[u];
      console.log(`[Rollback] \u2705 \uC608\uC57D \uD574\uC81C: product_id=${d.product_id}, quantity=${d.quantity}`);
    }
    return console.log(`[Rollback] \u2705 \uC608\uC57D \uD574\uC81C \uC644\uB8CC: ${l}/${n.results.length}\uAC1C \uC131\uACF5`), await s.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'failed',
          reservation_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r).run(), console.log("[Rollback] \u2705 \uC8FC\uBB38 \uCDE8\uC18C \uC644\uB8CC:", r), e.json({ success: true, message: "\uC7AC\uACE0 \uC608\uC57D\uC774 \uD574\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", data: { orderId: r, releasedItems: l } });
  } catch (r) {
    return console.error("[Rollback] \u274C \uC608\uC57D \uD574\uC81C \uC2E4\uD328:", { error: r.message, stack: (t = r.stack) == null ? void 0 : t.substring(0, 500) }), e.json({ success: false, error: "\uC7AC\uACE0 \uC608\uC57D \uD574\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", details: r.message }, 500);
  }
});
p.post("/api/chat/:liveStreamId/messages", S(), async (e) => {
  const { DB: s } = e.env, t = e.req.param("liveStreamId");
  try {
    const r = await e.req.json(), { userId: a, userName: o, userAvatar: n, message: i, isSeller: c, isAdmin: l } = r;
    if (!i || i.trim().length === 0) return e.json({ success: false, error: "Message cannot be empty" }, 400);
    if (i.length > 500) return e.json({ success: false, error: "Message is too long (max 500 characters)" }, 400);
    if (a && await s.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(t, a).first()) return e.json({ success: false, error: "You are banned from this chat" }, 403);
    const u = ["\uC528\uBC1C", "\uAC1C\uC0C8\uB07C", "\uBCD1\uC2E0", "\uC886", "\uC2DC\uBC1C"];
    let d = i;
    u.forEach((_) => {
      const f = new RegExp(_, "gi");
      d = d.replace(f, "*".repeat(_.length));
    });
    const m = await s.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(t, a || null, o, n || null, d, c ? 1 : 0, l ? 1 : 0).run();
    return e.json({ success: true, data: { id: m.meta.last_row_id, message: d } });
  } catch (r) {
    return console.error("Error sending chat message:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/chat/:liveStreamId/messages", S(), async (e) => {
  const { DB: s } = e.env, t = e.req.param("liveStreamId"), r = e.req.query("since"), a = Number(e.req.query("limit")) || 50;
  try {
    let o = `
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
    const n = [t];
    r && (o += " AND id > ?", n.push(Number(r))), o += " ORDER BY created_at DESC LIMIT ?", n.push(a);
    const c = (await s.prepare(o).bind(...n).all()).results.reverse();
    return e.json({ success: true, data: c });
  } catch (o) {
    return console.error("Error fetching chat messages:", o), e.json({ success: false, error: o.message }, 500);
  }
});
p.delete("/api/chat/:liveStreamId/messages/:messageId", S(), async (e) => {
  const { DB: s } = e.env, t = e.req.param("messageId");
  try {
    return await s.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(t).run(), e.json({ success: true, message: "Message deleted successfully" });
  } catch (r) {
    return console.error("Error deleting chat message:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/chat/:liveStreamId/ban", S(), async (e) => {
  const { DB: s } = e.env, t = e.req.param("liveStreamId");
  try {
    const r = await e.req.json(), { userId: a, bannedBy: o, reason: n, duration: i } = r;
    if (!a || !o) return e.json({ success: false, error: "userId and bannedBy are required" }, 400);
    let c = null;
    if (i) {
      const l = /* @__PURE__ */ new Date();
      l.setMinutes(l.getMinutes() + i), c = l.toISOString();
    }
    return await s.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(t, a, o, n || null, c).run(), e.json({ success: true, message: "User banned successfully" });
  } catch (r) {
    return console.error("Error banning user:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/chat/:liveStreamId/ban/:userId", S(), async (e) => {
  const { DB: s } = e.env, t = e.req.param("liveStreamId"), r = e.req.param("userId");
  try {
    return await s.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(t, r).run(), e.json({ success: true, message: "Ban removed successfully" });
  } catch (a) {
    return console.error("Error removing ban:", a), e.json({ success: false, error: a.message }, 500);
  }
});
async function Ha(e, s, t) {
  try {
    const r = new TextEncoder(), a = r.encode(t), o = r.encode(e), n = await crypto.subtle.importKey("raw", a, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), i = await crypto.subtle.sign("HMAC", n, o), c = Array.from(new Uint8Array(i)), l = btoa(String.fromCharCode(...c));
    return s === l;
  } catch (r) {
    return console.error("[Webhook] \uC11C\uBA85 \uAC80\uC99D \uC624\uB958:", r), false;
  }
}
__name(Ha, "Ha");
__name2(Ha, "Ha");
p.post("/api/payments/webhook", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("toss-signature"), r = await e.req.text();
    if (t && e.env.TOSS_SECRET_KEY) {
      if (!await Ha(r, t, e.env.TOSS_SECRET_KEY)) return console.error("[Webhook] \u274C \uC11C\uBA85 \uAC80\uC99D \uC2E4\uD328 - \uC704\uC870\uB41C \uC6F9\uD6C5 \uC694\uCCAD"), e.json({ success: false, error: "Invalid signature" }, 401);
      console.log("[Webhook] \u2705 \uC11C\uBA85 \uAC80\uC99D \uC131\uACF5");
    } else console.warn("[Webhook] \u26A0\uFE0F \uC11C\uBA85 \uAC80\uC99D \uAC74\uB108\uB700 (\uAC1C\uBC1C \uD658\uACBD \uB610\uB294 \uC11C\uBA85 \uC5C6\uC74C)");
    const a = JSON.parse(r);
    switch (console.log("[Webhook] \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC6F9\uD6C5 \uC218\uC2E0:", { eventType: a.eventType, orderId: a.orderId, status: a.status, timestamp: (/* @__PURE__ */ new Date()).toISOString() }), a.eventType) {
      case "PAYMENT_STATUS_CHANGED":
        await Wa(s, a);
        break;
      case "VIRTUAL_ACCOUNT_ISSUED":
        await Ba(s, a);
        break;
      default:
        console.log("[Webhook] \uCC98\uB9AC\uD558\uC9C0 \uC54A\uB294 \uC774\uBCA4\uD2B8 \uD0C0\uC785:", a.eventType);
    }
    return e.json({ success: true });
  } catch (t) {
    return console.error("[Webhook] \u274C \uC6F9\uD6C5 \uCC98\uB9AC \uC2E4\uD328:", t.message), e.json({ success: false, error: t.message }, 500);
  }
});
async function Wa(e, s) {
  const { orderId: t, status: r, paymentKey: a } = s;
  console.log("[Webhook] \uACB0\uC81C \uC0C1\uD0DC \uBCC0\uACBD:", { orderId: t, status: r }), await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(r, JSON.stringify(s), a).run(), (r === "DONE" || r === "completed") && (await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(t).run(), console.log("[Webhook] \u2705 \uAC00\uC0C1\uACC4\uC88C \uC785\uAE08 \uC644\uB8CC \uCC98\uB9AC:", t));
}
__name(Wa, "Wa");
__name2(Wa, "Wa");
async function Ba(e, s) {
  const { orderId: t, virtualAccount: r } = s;
  console.log("[Webhook] \uAC00\uC0C1\uACC4\uC88C \uBC1C\uAE09:", { orderId: t, bank: r == null ? void 0 : r.bank, accountNumber: r == null ? void 0 : r.accountNumber }), await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(r == null ? void 0 : r.bank, r == null ? void 0 : r.accountNumber, r == null ? void 0 : r.customerName, r == null ? void 0 : r.dueDate, JSON.stringify(s), t).run(), console.log("[Webhook] \u2705 \uAC00\uC0C1\uACC4\uC88C \uC815\uBCF4 \uC800\uC7A5 \uC644\uB8CC:", t);
}
__name(Ba, "Ba");
__name2(Ba, "Ba");
p.post("/api/payments/:paymentKey/cancel", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("paymentKey"), r = await e.req.json(), { cancelReason: a, cancelAmount: o } = r;
    if (console.log("[Payment] \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD:", { paymentKey: t, cancelReason: a, cancelAmount: o }), !a) return e.json({ success: false, error: "\uCDE8\uC18C \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
    const n = await s.prepare(`
      SELECT 
        id, 
        order_id, 
        pg_provider, 
        pg_payment_key, 
        pg_transaction_id,
        method, 
        amount, 
        status,
        card_company,
        card_number,
        installment_months,
        requested_at,
        approved_at,
        cancelled_at,
        created_at
      FROM payments 
      WHERE pg_payment_key = ?
    `).bind(t).first();
    if (!n) return e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (n.status === "CANCELED" || n.status === "cancelled") return e.json({ success: false, error: "\uC774\uBBF8 \uCDE8\uC18C\uB41C \uACB0\uC81C\uC785\uB2C8\uB2E4." }, 400);
    const i = n.pg_provider || "tosspayments", c = e.env.TOSS_SECRET_KEY;
    if (!c) return e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    const l = ka(i, c), u = o && o < n.amount, d = o || n.amount;
    console.log("[Payment] PG \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD \uC911...", { pgProvider: i, paymentKey: t, cancelAmount: d, isPartial: u });
    const m = await l.cancelPayment({ paymentKey: t, cancelReason: a, cancelAmount: d });
    return m.success ? (console.log("[Payment] \u2705 PG \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC:", { paymentKey: t, cancelAmount: d, canceledAt: m.canceledAt }), await s.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED", m.canceledAt || (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(m), t).run(), await s.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(n.order_id).run(), console.log(`[Payment] \u2705 \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC [${i}]: ${t}`), e.json({ success: true, data: { paymentKey: t, orderId: n.order_id, cancelAmount: d, canceledAt: m.canceledAt, status: "CANCELED" } })) : (console.error(`[Payment] \u274C ${i} \uACB0\uC81C \uCDE8\uC18C \uC2E4\uD328:`, m.error), e.json({ success: false, error: m.error || "\uACB0\uC81C \uCDE8\uC18C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." }, 400));
  } catch (t) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC2E4\uD328:", t.message), e.json({ success: false, error: "\uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
p.get("/api/payments/:paymentKey", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("paymentKey"), r = await s.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(t).first();
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
  } catch (t) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uC870\uD68C \uC2E4\uD328:", t.message), e.json({ success: false, error: "\uACB0\uC81C \uC870\uD68C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
p.get("/api/payments/order/:orderId", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("orderId"), r = await s.prepare(`
      SELECT 
        id, 
        order_id, 
        pg_provider, 
        pg_payment_key, 
        pg_transaction_id,
        method, 
        amount, 
        status,
        card_company,
        card_number,
        installment_months,
        requested_at,
        approved_at,
        cancelled_at,
        created_at
      FROM payments 
      WHERE order_id = ? 
      ORDER BY created_at DESC
    `).bind(t).all();
    return e.json({ success: true, data: r.results || [] });
  } catch (t) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", t.message), e.json({ success: false, error: "\uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
p.get("/api/seller/orders", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.query("status"), a = e.req.query("start_date"), o = e.req.query("end_date"), n = e.req.query("min_amount"), i = e.req.query("max_amount"), c = parseInt(e.req.query("page") || "1"), l = parseInt(e.req.query("limit") || "50"), u = (c - 1) * l, d = ["oi.seller_id = ?"], m = [t.sellerId];
    r && (d.push("o.status = ?"), m.push(r)), a && (d.push("DATE(o.created_at) >= ?"), m.push(a)), o && (d.push("DATE(o.created_at) <= ?"), m.push(o)), n && (d.push("o.total_amount >= ?"), m.push(parseInt(n))), i && (d.push("o.total_amount <= ?"), m.push(parseInt(i)));
    const _ = d.join(" AND "), f = await s.prepare(`
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
      WHERE ${_}
      ORDER BY o.created_at DESC, oi.id ASC
      LIMIT ? OFFSET ?
    `).bind(...m, l, u).all(), g = await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${_}
    `).bind(...m).first(), b = (g == null ? void 0 : g.total) || 0, w = Math.ceil(b / l), h = /* @__PURE__ */ new Map();
    for (const y of f.results) {
      const R = y.id;
      h.has(R) || h.set(R, { id: y.id, user_id: y.user_id, user_name: y.user_name, order_number: y.order_number, status: y.status, total_amount: y.total_amount, shipping_fee: y.shipping_fee, payment_method: y.payment_method, payment_key: y.payment_key, shipping_address: y.shipping_address, shipping_name: y.shipping_name, shipping_phone: y.shipping_phone, delivery_request: y.delivery_request, created_at: y.created_at, updated_at: y.updated_at, items: [] }), y.item_id && h.get(R).items.push({ id: y.item_id, product_id: y.product_id, option_id: y.option_id, quantity: y.quantity, price: y.item_price, seller_id: y.seller_id, product_name: y.product_name, image_url: y.image_url, option_value: y.option_value });
    }
    const T = Array.from(h.values());
    return e.json({ success: true, data: T, pagination: { page: c, limit: l, total: b, totalPages: w }, filters: { status: r || null, startDate: a || null, endDate: o || null, minAmount: n ? parseInt(n) : null, maxAmount: i ? parseInt(i) : null } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/orders/export", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.query("format") || "csv", a = e.req.query("start_date"), o = e.req.query("end_date");
    let n = `
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
    const i = [t.sellerId];
    a && (n += " AND date(o.created_at) >= ?", i.push(a)), o && (n += " AND date(o.created_at) <= ?", i.push(o)), n += " GROUP BY o.id ORDER BY o.created_at DESC";
    const c = await s.prepare(n).bind(...i).all();
    if (r === "csv") {
      const l = ["\uC8FC\uBB38\uBC88\uD638", "\uC8FC\uBB38\uC77C\uC2DC", "\uC8FC\uBB38\uC0C1\uD0DC", "\uACB0\uC81C\uC0C1\uD0DC", "\uC8FC\uBB38\uAE08\uC561", "\uBC30\uC1A1\uC9C0", "\uC218\uB839\uC778", "\uC5F0\uB77D\uCC98", "\uD0DD\uBC30\uC0AC", "\uC6B4\uC1A1\uC7A5\uBC88\uD638", "\uAD6C\uB9E4\uC790\uBA85", "\uAD6C\uB9E4\uC790\uC774\uBA54\uC77C", "\uAD6C\uB9E4\uC790\uC5F0\uB77D\uCC98"], u = c.results.map((g) => [g.order_number || "", g.created_at ? new Date(g.created_at).toLocaleString("ko-KR") : "", g.status || "", g.payment_status || "", g.total_amount || 0, g.shipping_address || "", g.shipping_name || "", g.shipping_phone || "", g.carrier || "", g.tracking_number || "", g.buyer_name || "", g.buyer_email || "", g.buyer_phone || ""]), m = "\uFEFF" + [l.join(","), ...u.map((g) => g.map((b) => {
        const w = String(b);
        return w.includes(",") || w.includes(`
`) || w.includes('"') ? `"${w.replace(/"/g, '""')}"` : w;
      }).join(","))].join(`
`), _ = /* @__PURE__ */ new Date(), f = `orders_${_.toISOString().split("T")[0]}_${_.getTime()}.csv`;
      return new Response(m, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${encodeURIComponent(f)}"`, "Cache-Control": "no-cache" } });
    } else return e.json({ success: false, error: "Unsupported format" }, 400);
  } catch (r) {
    return console.error("Export error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/seller/orders/:orderNumber/status", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("orderNumber"), { status: a } = await e.req.json();
    if (!["PAY_COMPLETE", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED"].includes(a)) return e.json({ success: false, error: "Invalid status" }, 400);
    const n = await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(n.id, t.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
    if (await s.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a, r).run(), a === "DELIVERED") try {
      console.log(`[AUTO TAX INVOICE] \uBC30\uC1A1\uC644\uB8CC \uAC10\uC9C0: ${r}, \uC790\uB3D9 \uBC1C\uD589 \uC2DC\uC791...`);
      const c = await s.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(r).first();
      if (c != null && c.buyer_business_number && (c != null && c.buyer_business_name)) {
        console.log(`[AUTO TAX INVOICE] \uC0AC\uC5C5\uC790 \uAD6C\uB9E4 \uD655\uC778: ${c.buyer_business_number}`);
        const l = await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(t.sellerId).first();
        if (!l) console.warn(`[AUTO TAX INVOICE] \uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4 \uBBF8\uC2B9\uC778: seller_id=${t.sellerId}`), await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.', CURRENT_TIMESTAMP)
            `).bind(r, t.sellerId).run();
        else {
          console.log(`[AUTO TAX INVOICE] \uBC1C\uD589 \uC2DC\uC791: orderNumber=${r}`);
          const u = await s.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(), d = Number(c.total_amount), m = Math.floor(d / 1.1), _ = d - m, f = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), g = Math.random().toString(36).substring(2, 8).toUpperCase(), b = `${f}-${g}`, h = (await s.prepare(`
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
            `).bind(t.sellerId, r, b, l.business_number, l.business_name, l.ceo_name, l.address || "", l.business_type || "", l.business_category || "", l.email || "", l.phone || "", c.buyer_business_number, c.buyer_business_name, c.buyer_ceo_name || "", c.buyer_business_address || "", c.buyer_business_type || "", c.buyer_business_category || "", c.buyer_email || "", c.buyer_phone || "", m, _, d, `AUTO-${Date.now()}-${g}`).run()).meta.last_row_id;
          if (u.results.length > 0) {
            const T = u.results.map((y) => {
              const R = Math.floor(Number(y.price) * Number(y.quantity) / 1.1), $ = Number(y.price) * Number(y.quantity) - R;
              return s.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(h, y.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", y.quantity, y.price, R, $, y.option_name || "");
            });
            await s.batch(T);
          }
          await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r, t.sellerId, h).run(), console.log(`[AUTO TAX INVOICE] \u2705 \uBC1C\uD589 \uC644\uB8CC: invoice_id=${h}, invoice_number=${b}`);
        }
      } else console.log(`[AUTO TAX INVOICE] \uC77C\uBC18 \uAD6C\uB9E4 (\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uC5C6\uC74C): ${r}`);
    } catch (c) {
      console.error("[AUTO TAX INVOICE] \uBC1C\uD589 \uC2E4\uD328:", c);
      try {
        await s.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(r, t.sellerId, c.message).run();
      } catch (l) {
        console.error("[AUTO TAX INVOICE] \uB85C\uADF8 \uAE30\uB85D \uC2E4\uD328:", l);
      }
    }
    try {
      const c = await s.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(r).first();
      if (c && c.user_id) {
        const u = { PREPARING: "preparing", SHIPPING: "shipping", DELIVERED: "delivered" }[a];
        u && await Rt(s, c.user_id, r, u);
      }
    } catch (c) {
      console.error("[Order Status] Notification error:", c);
    }
    return e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/seller/orders/:orderNumber/tracking", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("orderNumber"), { courier: a, tracking_number: o } = await e.req.json();
    if (!a || !o) return e.json({ success: false, error: "Courier and tracking number are required" }, 400);
    const n = await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(n.id, t.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
    await s.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a, o, r).run();
    try {
      const c = await s.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(r).first();
      c && c.user_id && await Rt(s, c.user_id, r, "shipping", a, o);
    } catch (c) {
      console.error("[Tracking] Notification error:", c);
    }
    return e.json({ success: true, message: "Tracking information updated" });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/orders", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/sellers", async (e) => {
  const { DB: s } = e.env, { limit: t = "20", offset: r = "0" } = e.req.query();
  try {
    const a = `sellers:list:${t}:${r}`, o = we(a);
    if (o) return e.executionCtx.waitUntil((async () => {
      try {
        const i = await Js(s, parseInt(t), parseInt(r));
        Z(a, i, 3600);
      } catch (i) {
        console.error("[Cache Revalidate] Sellers error:", i);
      }
    })()), e.json({ success: true, data: o, cached: true });
    const n = await Js(s, parseInt(t), parseInt(r));
    return Z(a, n, 3600), e.json({ success: true, data: n, cached: false });
  } catch (a) {
    return console.error("[API] Sellers list error:", a), e.json({ success: false, error: `\uC140\uB7EC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${a.message}` }, 500);
  }
});
async function Js(e, s, t) {
  const r = `
    SELECT id, business_name, name as display_name, 
           commission_rate, created_at
    FROM sellers 
    WHERE is_active = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, { results: a } = await e.prepare(r).bind(s, t).all();
  return a;
}
__name(Js, "Js");
__name2(Js, "Js");
p.get("/api/admin/sellers", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/sellers", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { username: r, password: a, name: o, email: n, phone: i, business_name: c, business_number: l } = await e.req.json();
    if (!r || !a || !o || !n || !c) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (await s.prepare("SELECT id FROM sellers WHERE username = ?").bind(r).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC544\uC774\uB514\uC785\uB2C8\uB2E4" }, 400);
    if (await s.prepare("SELECT id FROM sellers WHERE email = ?").bind(n).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
    const m = `$2a$10$placeholder_hash_for_${a}`, _ = await s.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(r, m, o, n, i || null, c, l || null, t.adminId).run();
    return e.json({ success: true, data: { id: _.meta.last_row_id, username: r, name: o, email: n, business_name: c } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/admin/sellers/:id", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { name: a, email: o, phone: n, business_name: i, business_number: c, is_active: l, status: u } = await e.req.json();
    return await s.prepare("SELECT id FROM sellers WHERE id = ?").bind(r).first() ? (await s.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, o, n || null, i, c || null, l, u, r).run(), e.json({ success: true })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/admin/sellers/:id", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), a = await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();
    return a ? (await s.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(), await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.username}'\uC758 \uB85C\uADF8\uC778 \uAD8C\uD55C\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4` })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/sellers/:id/reset-password", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { new_password: a } = await e.req.json();
    if (!a || a.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const o = await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = `$2a$10$placeholder_hash_for_${a}`;
    return await s.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n, r).run(), await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${o.username}'\uC758 \uBE44\uBC00\uBC88\uD638\uAC00 \uC7AC\uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4` });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/admin/sellers/:id/commission", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { commission_rate: a } = await e.req.json();
    if (a == null) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const o = parseFloat(a);
    if (isNaN(o) || o < 0 || o > 100) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC740 0\uC5D0\uC11C 100 \uC0AC\uC774\uC758 \uAC12\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const n = await s.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const i = n.commission_rate || 10;
    return await s.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o, r).run(), console.log(`\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD: \uD310\uB9E4\uC790 ${n.username} (ID: ${r}), ${i}% \u2192 ${o}%`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.username}'\uC758 \uC218\uC218\uB8CC\uC728\uC774 ${i}%\uC5D0\uC11C ${o}%\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: n.username, old_commission_rate: i, new_commission_rate: o } });
  } catch (r) {
    return console.error("\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/admin/sellers/:id/approve", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), a = await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();
    if (!a) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (a.status === "approved") return e.json({ success: false, error: "\uC774\uBBF8 \uC2B9\uC778\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400);
    if (await s.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(t.adminId, r).run(), console.log(`\uC140\uB7EC \uC2B9\uC778: ${a.username} (ID: ${r}) by Admin ID: ${t.adminId}`), a.email) try {
      const { sendEmail: o, getSellerApprovalEmailHTML: n } = await Promise.resolve().then(() => jt), i = e.env.RESEND_API_KEY || "", c = n(a.name, a.username), l = await o({ to: a.email, subject: "\u{1F389} \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790 \uC2B9\uC778 \uC644\uB8CC", html: c }, i, e.env.EMAIL_FROM || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <noreply@ur-team.com>");
      l.success ? console.log(`[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC131\uACF5: ${a.email}`) : console.warn(`[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC2E4\uD328: ${l.error}`);
    } catch (o) {
      console.error("[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC624\uB958:", o);
    }
    try {
      const { createNotification: o, NotificationTemplates: n } = await Promise.resolve().then(() => Lt), i = n.seller_approved(a.name);
      await o(s, { userId: parseInt(r), type: "seller_approved", title: i.title, message: i.message, linkUrl: i.linkUrl });
    } catch (o) {
      console.error("[\uC140\uB7EC \uC2B9\uC778] \uC54C\uB9BC \uC0DD\uC131 \uC624\uB958:", o);
    }
    return e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.name}'\uB2D8\uC774 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: a.username, seller_name: a.name, status: "approved", approved_at: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (r) {
    return console.error("\uC140\uB7EC \uC2B9\uC778 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/admin/sellers/:id/reject", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { reason: a } = await e.req.json();
    if (!a) return e.json({ success: false, error: "\uAC70\uBD80 \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const o = await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (o.status === "rejected") return e.json({ success: false, error: "\uC774\uBBF8 \uAC70\uBD80\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400);
    if (await s.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, t.adminId, r).run(), console.log(`\uC140\uB7EC \uAC70\uBD80: ${o.username} (ID: ${r}), \uC0AC\uC720: ${a}`), o.email) try {
      const { sendEmail: n, getSellerRejectionEmailHTML: i } = await Promise.resolve().then(() => jt), c = e.env.RESEND_API_KEY || "", l = i(o.name, a), u = await n({ to: o.email, subject: "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790 \uC2B9\uC778 \uACB0\uACFC \uC548\uB0B4", html: l }, c, e.env.EMAIL_FROM || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <noreply@ur-team.com>");
      u.success ? console.log(`[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC131\uACF5: ${o.email}`) : console.warn(`[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC2E4\uD328: ${u.error}`);
    } catch (n) {
      console.error("[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC624\uB958:", n);
    }
    try {
      const { createNotification: n, NotificationTemplates: i } = await Promise.resolve().then(() => Lt), c = i.seller_rejected(a);
      await n(s, { userId: parseInt(r), type: "seller_rejected", title: c.title, message: c.message, linkUrl: c.linkUrl });
    } catch (n) {
      console.error("[\uC140\uB7EC \uAC70\uBD80] \uC54C\uB9BC \uC0DD\uC131 \uC624\uB958:", n);
    }
    return e.json({ success: true, message: `\uD310\uB9E4\uC790 '${o.name}'\uB2D8\uC758 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: o.username, seller_name: o.name, status: "rejected", rejection_reason: a, rejected_at: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (r) {
    return console.error("\uC140\uB7EC \uAC70\uBD80 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/sellers/pending", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();
    return e.json({ success: true, data: r.results, count: r.results.length });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/dashboard/stats", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = /* @__PURE__ */ new Date();
    r.setHours(0, 0, 0, 0);
    const a = r.toISOString(), o = await s.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM orders
      WHERE payment_status = 'approved'
      AND status = 'paid'
      AND created_at >= ?
    `).bind(a).first(), n = (o == null ? void 0 : o.sales) || 0, i = await s.prepare(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(a).first(), c = (i == null ? void 0 : i.count) || 0, l = new Date(Date.now() - 300 * 1e3).toISOString(), u = await s.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(l).first(), d = (u == null ? void 0 : u.count) || 0, m = await s.prepare(`
      SELECT COUNT(*) as count
      FROM live_streams
      WHERE status = 'live'
    `).first(), _ = (m == null ? void 0 : m.count) || 0;
    return e.json({ success: true, stats: { todaySales: n, todayOrders: c, currentVisitors: d, liveStreams: _ }, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/public/seller/:sellerId", async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = e.req.param("sellerId"), a = `public:seller:${r}`, o = await La(t, a);
    if (o) return e.json({ success: true, data: o, cached: true });
    const n = await s.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();
    if (!n) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const i = await s.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(r).all(), c = await s.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(r).all(), l = await s.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(r).all(), u = await s.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(r).first(), d = { profile: n, live_streams: i.results, scheduled_streams: c.results, products: l.results, stats: u };
    return await Ze(t, a, d, 60, false), e.json({ success: true, data: d });
  } catch (r) {
    return console.error("\uC140\uB7EC \uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/public/seller/username/:username", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("username"), r = await s.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(t).first();
    return r ? e.json({ success: true, data: { seller_id: r.id } }) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return console.error("\uC140\uB7EC \uC870\uD68C \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/admin/settlement/stats", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { period: r } = e.req.query();
    let a = "";
    const o = /* @__PURE__ */ new Date();
    switch (r) {
      case "today":
        a = `AND DATE(o.created_at) = '${o.toISOString().split("T")[0]}'`;
        break;
      case "week":
        a = `AND DATE(o.created_at) >= '${new Date(o.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0]}'`;
        break;
      case "month":
        a = `AND DATE(o.created_at) >= '${new Date(o.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0]}'`;
        break;
      default:
        a = "";
    }
    const n = await s.prepare(`
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
    return e.json({ success: true, data: { overview: n, sellers: i.results, period: r || "all" } });
  } catch (r) {
    return console.error("\uC815\uC0B0 \uD1B5\uACC4 \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/settlement/records", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { seller_id: r, period: a, status: o } = e.req.query();
    let n = ["payment_status = 'completed'", "is_cancelled = 0"];
    const i = [];
    r && (n.push("o.seller_id = ?"), i.push(r)), o && (n.push("o.settlement_status = ?"), i.push(o));
    const c = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const d = c.toISOString().split("T")[0];
        n.push(`DATE(o.created_at) = '${d}'`);
        break;
      case "week":
        const m = new Date(c.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${m}'`);
        break;
      case "month":
        const _ = new Date(c.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${_}'`);
        break;
    }
    const l = n.length > 0 ? `WHERE ${n.join(" AND ")}` : "", u = await s.prepare(`
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
      ${l}
      ORDER BY o.created_at DESC
      LIMIT 100
    `).bind(...i).all();
    return e.json({ success: true, data: u.results });
  } catch (r) {
    return console.error("\uC815\uC0B0 \uB0B4\uC5ED \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/admin/settlement/:orderId/status", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("orderId"), { status: a } = await e.req.json();
    if (!["pending", "completed"].includes(a)) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC815\uC0B0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4" }, 400);
    const o = await s.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(r).first();
    return o ? (await s.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a === "completed" ? "datetime('now')" : "NULL"}
      WHERE id = ?
    `).bind(a, r).run(), console.log(`\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD: \uC8FC\uBB38 ${o.order_number}, ${o.settlement_status} \u2192 ${a}`), e.json({ success: true, message: `\uC815\uC0B0 \uC0C1\uD0DC\uAC00 '${a}'\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { order_id: r, order_number: o.order_number, old_status: o.settlement_status, new_status: a } })) : e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/settlement/batch-complete", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { order_ids: r } = await e.req.json();
    if (!Array.isArray(r) || r.length === 0) return e.json({ success: false, error: "\uC8FC\uBB38 ID \uBC30\uC5F4\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    let a = 0, o = 0;
    for (const n of r) try {
      await s.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(n).run(), a++;
    } catch (i) {
      o++, console.error(`\uC8FC\uBB38 ${n} \uC815\uC0B0 \uCC98\uB9AC \uC2E4\uD328:`, i);
    }
    return e.json({ success: true, message: `${a}\uAC74 \uC815\uC0B0 \uC644\uB8CC, ${o}\uAC74 \uC2E4\uD328`, data: { total: r.length, success: a, failed: o } });
  } catch (r) {
    return console.error("\uC77C\uAD04 \uC815\uC0B0 \uCC98\uB9AC \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/settlement/export-csv", async (e) => {
  const { DB: s } = e.env, t = await P(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { seller_id: r, period: a } = e.req.query();
    let o = ["payment_status = 'completed'", "is_cancelled = 0"];
    const n = [];
    r && (o.push("o.seller_id = ?"), n.push(r));
    const i = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const f = i.toISOString().split("T")[0];
        o.push(`DATE(o.created_at) = '${f}'`);
        break;
      case "week":
        const g = new Date(i.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${g}'`);
        break;
      case "month":
        const b = new Date(i.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${b}'`);
        break;
    }
    const c = o.length > 0 ? `WHERE ${o.join(" AND ")}` : "", u = (await s.prepare(`
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
    `).bind(...n).all()).results;
    if (u.length === 0) return e.json({ success: false, error: "\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const d = Object.keys(u[0]);
    let m = d.join(",") + `
`;
    u.forEach((f) => {
      const g = d.map((b) => {
        const w = f[b];
        if (w == null) return "";
        const h = String(w);
        return h.includes(",") || h.includes('"') || h.includes(`
`) ? `"${h.replace(/"/g, '""')}"` : h;
      });
      m += g.join(",") + `
`;
    });
    const _ = "\uFEFF";
    return new Response(_ + m, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${a || "all"}_${Date.now()}.csv"` } });
  } catch (r) {
    return console.error("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/orders/create", j, async (e) => {
  const { DB: s } = e.env;
  try {
    const { userId: t, cartItems: r, totalAmount: a, shippingAddressId: o, sellerId: n, issueTaxInvoice: i, buyerBusinessNumber: c, buyerBusinessName: l, buyerCeoName: u } = await e.req.json();
    console.log("[DEPRECATED /api/orders/create] \uC8FC\uBB38 \uC0DD\uC131 \uC694\uCCAD:", { userId: t, cartItems: r == null ? void 0 : r.length, totalAmount: a, shippingAddressId: o, sellerId: n, issueTaxInvoice: i });
    let d = 10;
    if (n) {
      const v = await s.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(n).first();
      v && v.commission_rate !== null && (d = v.commission_rate);
    }
    console.log("\uC218\uC218\uB8CC\uC728:", { sellerId: n, commissionRate: d });
    const m = Math.floor(a * (d / 100)), _ = a - m;
    let f = null;
    if (o) {
      const v = await s.prepare(`
        SELECT 
          id, 
          user_id, 
          recipient_name, 
          phone, 
          postal_code, 
          address, 
          address_detail, 
          is_default, 
          created_at, 
          updated_at 
        FROM shipping_addresses 
        WHERE id = ? AND user_id = ?
      `).bind(o, t).first();
      if (!v) return e.json({ success: false, error: "\uBC30\uC1A1\uC9C0 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
      f = v;
    }
    if (!t) return e.json({ success: false, error: "User ID is required. Please login with Kakao first." }, 401);
    const g = t, b = /* @__PURE__ */ new Date(), w = b.getFullYear().toString().slice(-2), h = (b.getMonth() + 1).toString().padStart(2, "0"), T = b.getDate().toString().padStart(2, "0"), y = `${w}${h}${T}`, R = Math.random().toString(36).substring(2, 7).toUpperCase(), $ = `ORD-${y}-${R}`, A = r.map((v) => v.product_id), O = A.map(() => "?").join(","), x = await s.prepare(`
      SELECT id, stock FROM products WHERE id IN (${O})
    `).bind(...A).all(), U = new Map(x.results.map((v) => [v.id, v.stock]));
    for (const v of r) {
      const ee = U.get(v.product_id);
      if (ee === void 0) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${v.product_id})` }, 400);
      if (ee < v.quantity) return e.json({ success: false, error: `\uC7AC\uACE0\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4 (\uC0C1\uD488 ID: ${v.product_id})` }, 400);
    }
    const F = (await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind($, g, a, "pending", n || null, d, m, _, o || null, (f == null ? void 0 : f.recipient_name) || null, (f == null ? void 0 : f.phone) || null, f != null && f.address ? `${f.address} ${f.address_detail}` : null, (f == null ? void 0 : f.postal_code) || null, i ? 1 : 0, c || null, l || null, u || null).run()).meta.last_row_id, G = r.map((v) => s.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(F, v.product_id, v.option_id || null, v.quantity, v.price_snapshot || v.price)), Y = r.map((v) => s.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(v.quantity, v.product_id));
    await s.batch([...G, ...Y]);
    try {
      const v = ns(e.env), ee = r.map((J) => J.product_id), H = ee.map(() => "?").join(","), q = await s.prepare(`
        SELECT id, name, price, original_price, discount_rate, stock, image_url
        FROM products
        WHERE id IN (${H})
      `).bind(...ee).all();
      await Promise.all(q.results.map((J) => v.updateProductStock(J.id, J.stock, { name: J.name, price: J.price, original_price: J.original_price, discount_rate: J.discount_rate, image_url: J.image_url }))), console.log(`\u{1F525} Firebase: Stock updated for ${q.results.length} products`);
    } catch (v) {
      console.error("\u26A0\uFE0F Firebase stock sync failed (non-blocking):", v);
    }
    try {
      const v = r.map((q) => q.product_id), ee = v.map(() => "?").join(","), H = await s.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${ee})
      `).bind(...v).all();
      for (const q of H.results) {
        const J = q.stock_alert_threshold || 5, ce = q.stock;
        ce <= J && q.seller_id && (await It(s, q.seller_id, q.name, ce, J), console.log(`[Low Stock Alert] ${q.name}: ${ce} <= ${J}`));
      }
    } catch (v) {
      console.error("[Low Stock Alert] Error:", v);
    }
    return console.log("\uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC:", { orderId: F, orderNumber: $ }), e.json({ success: true, orderId: F, orderNumber: $, totalAmount: a });
  } catch (t) {
    return console.error("\uC8FC\uBB38 \uC0DD\uC131 \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/orders/:orderNumber/refund", S(), j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("orderNumber"), { reason: r } = await e.req.json();
    console.log("[Order Refund] \uD658\uBD88 \uC694\uCCAD:", { orderNumber: t, reason: r });
    const a = await s.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(t).first();
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
    `).bind(r || "\uAD6C\uB9E4\uC790 \uC694\uCCAD", t).run(), console.log("[Order Refund] \uC8FC\uBB38 \uC0C1\uD0DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC:", t);
    const o = await s.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();
    if (o.results.length > 0) {
      const n = o.results.map((i) => s.prepare(`
          UPDATE products 
          SET stock = stock + ?,
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(i.quantity, i.product_id));
      await s.batch(n), console.log("[Order Refund] \uC7AC\uACE0 \uBCF5\uAD6C \uC644\uB8CC:", { items: o.results.length });
    }
    return console.log("[Order Refund] \u2705 \uD658\uBD88 \uC644\uB8CC:", { orderNumber: t, reason: r }), e.json({ success: true, message: "\uC8FC\uBB38\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: { orderNumber: t, cancelDate: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (t) {
    return console.error("[Order Refund] Error:", t), e.json({ success: false, error: t.message || "\uC8FC\uBB38 \uCDE8\uC18C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
p.use("/api/seller/*", j);
p.get("/api/seller/sales", S(), async (e) => {
  try {
    const { DB: s } = e.env, t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const r = await Ve(e.env.SESSION_KV, t);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (r.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = r.seller_id || r.user_id, { startDate: o, endDate: n } = e.req.query(), i = o || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = n || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], l = await s.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(a).first();
    if (!l) return e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const u = await s.prepare(`
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
    `).bind(a, i, c).first(), d = await s.prepare(`
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
    return e.json({ success: true, data: { seller: l, stats: u, orders: (d == null ? void 0 : d.results) || [] } });
  } catch (s) {
    return console.error("Seller sales query error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/settlement-csv", S(), async (e) => {
  try {
    const { DB: s } = e.env, t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const r = await Ve(e.env.SESSION_KV, t);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (r.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = r.seller_id || r.user_id, { startDate: o, endDate: n } = e.req.query(), i = o || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = n || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], l = await s.prepare(`
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
    let u = `\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC8FC\uBB38\uC790,\uCD1D\uAE08\uC561,\uC218\uC218\uB8CC(10%),\uC815\uC0B0\uAE08\uC561(90%),\uC8FC\uBB38\uC0C1\uD0DC,\uC0AC\uC5C5\uC790\uBA85,\uC0AC\uC5C5\uC790\uBC88\uD638,\uC138\uAE08\uACC4\uC0B0\uC11C\uBC88\uD638,\uBC1C\uD589\uC77C\uC790,\uACC4\uC0B0\uC11C\uC0C1\uD0DC,\uAD6D\uC138\uCCAD\uC2B9\uC778\uBC88\uD638
`;
    for (const d of (l == null ? void 0 : l.results) || []) {
      const m = d.status === "delivered" ? "\uBC30\uC1A1\uC644\uB8CC" : d.status === "shipped" ? "\uBC30\uC1A1\uC911" : d.status === "preparing" ? "\uC0C1\uD488\uC900\uBE44\uC911" : d.status === "paid" ? "\uACB0\uC81C\uC644\uB8CC" : "\uB300\uAE30\uC911", _ = d.buyer_business_name || "-", f = d.buyer_business_number || "-", g = d.invoice_number || "-", b = d.issue_date || "-", w = d.tax_invoice_status === "issued" ? "\uBC1C\uD589\uC644\uB8CC" : d.tax_invoice_status === "cancelled" ? "\uCDE8\uC18C" : "-", h = d.nts_confirm_number || "-";
      u += `${d.order_number},${d.created_at},${d.user_name || "\uC775\uBA85"},${d.total_amount},${d.commission_amount},${d.seller_amount},${m},${_},${f},${g},${b},${w},${h}
`;
    }
    return new Response(u, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${i}_${c}.csv"` } });
  } catch (s) {
    return console.error("CSV download error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/tax-invoices/issue", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { order_number: r } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uC8FC\uBB38\uBC88\uD638\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const a = await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(r).first();
    if (!a) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (!a.issue_tax_invoice) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589\uC774 \uC694\uCCAD\uB418\uC9C0 \uC54A\uC740 \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400);
    const o = await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(t.sellerId).first();
    if (!o) return e.json({ success: false, error: "\uC2B9\uC778\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778\uC744 \uAE30\uB2E4\uB824\uC8FC\uC138\uC694." }, 400);
    const n = await s.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(), i = Number(a.total_amount), c = Math.floor(i / 1.1), l = i - c, u = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], d = `${u}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, m = kr(o, a, n.results);
    let _, f, g;
    try {
      _ = await Or(m), f = _.ntsConfirmNumber, g = _.invoiceKey, console.log("\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC131\uACF5:", { ntsConfirmNumber: f, invoiceKey: g, mockMode: Ge() });
    } catch (h) {
      console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", h), f = "FAILED", g = null;
    }
    const w = (await s.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t.sellerId, r, "tax", d, u, o.business_number, o.business_name, o.ceo_name, o.address, o.business_type, o.business_category, a.buyer_business_number, a.buyer_business_name, a.buyer_ceo_name, c, l, i, f === "FAILED" ? "failed" : "issued", Ge() ? "mock" : "barobill", g, f).run()).meta.last_row_id;
    for (const h of n.results) {
      const T = Math.floor(Number(h.price) * Number(h.quantity) / 1.1), y = Number(h.price) * Number(h.quantity) - T;
      await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(w, h.id, h.product_name, h.quantity, h.price, T, y).run();
    }
    return e.json({ success: true, data: { invoice_id: w, invoice_number: d, issue_date: u, total_amount: i, supply_price: c, tax_amount: l, status: f === "FAILED" ? "failed" : "issued", nts_confirm_number: f, api_invoice_key: g, mock_mode: Ge(), message: f === "FAILED" ? "\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328. \uB098\uC911\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694." : Ge() ? "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (Mock Mode - \uC2E4\uC81C \uBC1C\uD589 \uC544\uB2D8)" : "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4." } });
  } catch (r) {
    return console.error("\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC624\uB958:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/tax-invoices", async (e) => {
  var r;
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { start_date: a, end_date: o, status: n } = e.req.query();
    let i = `
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;
    const c = [t.sellerId];
    a && (i += " AND issue_date >= ?", c.push(a)), o && (i += " AND issue_date <= ?", c.push(o)), n && (i += " AND status = ?", c.push(n)), i += " ORDER BY created_at DESC";
    const l = await s.prepare(i).bind(...c).all();
    return e.json({ success: true, data: l.results || [], total: ((r = l.results) == null ? void 0 : r.length) || 0 });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/seller/tax-invoices/:id", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), a = await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r, t.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const o = await s.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(r).all();
    return e.json({ success: true, data: { ...a, items: o.results || [] } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/tax-invoices/:id/cancel", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { reason: a } = await e.req.json(), o = await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r, t.sellerId).first();
    if (!o) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = new Date(o.issue_date), i = new Date(n);
    if (i.setDate(i.getDate() + 1), /* @__PURE__ */ new Date() > i) return e.json({ success: false, error: "\uBC1C\uD589\uC77C \uC775\uC77C\uAE4C\uC9C0\uB9CC \uCDE8\uC18C \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 400);
    try {
      if (o.api_invoice_key && !Ge()) {
        const l = await s.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(t.sellerId).first();
        l && l.business_number && await Dr(l.business_number, o.api_invoice_key, a || "\uD310\uB9E4\uC790 \uC694\uCCAD");
      }
    } catch (l) {
      console.error("\uBC14\uB85C\uBE4C \uCDE8\uC18C API \uD638\uCD9C \uC2E4\uD328:", l);
    }
    return await s.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(), e.json({ success: true, message: "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/tax-invoices/auto-issue-logs", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { status: r, limit: a = 50 } = e.req.query();
    let o = `
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;
    const n = [t.sellerId];
    r && (o += " AND log.status = ?", n.push(r)), o += " ORDER BY log.created_at DESC LIMIT ?", n.push(Number(a));
    const i = await s.prepare(o).bind(...n).all();
    return e.json({ success: true, data: i.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/tax-invoices/retry/:orderNumber", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("orderNumber");
    console.log(`[TAX INVOICE RETRY] \uC7AC\uC2DC\uB3C4 \uC2DC\uC791: ${r}`);
    const a = await s.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(r, t.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uC7AC\uC2DC\uB3C4\uD560 \uC2E4\uD328 \uB85C\uADF8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const o = Number(a.retry_count || 0);
    if (o >= 3) return e.json({ success: false, error: "\uCD5C\uB300 \uC7AC\uC2DC\uB3C4 \uD69F\uC218(3\uD68C)\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4." }, 400);
    const n = await s.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(r).first();
    if (!n) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (!n.buyer_business_number || !n.buyer_business_name) return e.json({ success: false, error: "\uC8FC\uBB38\uC5D0 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 400);
    const i = await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(t.sellerId).first();
    if (!i) return e.json({ success: false, error: "\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const c = await s.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(n.id).all(), l = Number(n.total_amount), u = Math.floor(l / 1.1), d = l - u, m = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), _ = Math.random().toString(36).substring(2, 8).toUpperCase(), f = `${m}-${_}`, b = (await s.prepare(`
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
    `).bind(t.sellerId, r, f, i.business_number, i.business_name, i.ceo_name, i.address || "", i.business_type || "", i.business_category || "", i.email || "", i.phone || "", n.buyer_business_number, n.buyer_business_name, n.buyer_ceo_name || "", n.buyer_business_address || "", n.buyer_business_type || "", n.buyer_business_category || "", n.buyer_email || "", n.buyer_phone || "", u, d, l, `RETRY-${Date.now()}-${_}`).run()).meta.last_row_id;
    for (const w of c.results) {
      const h = Math.floor(Number(w.price) * Number(w.quantity) / 1.1), T = Number(w.price) * Number(w.quantity) - h;
      await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(b, w.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", w.quantity, w.price, h, T, w.option_name || "").run();
    }
    return await s.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(r, t.sellerId, b, o + 1).run(), await s.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(o + 1, a.id).run(), console.log(`[TAX INVOICE RETRY] \u2705 \uC7AC\uC2DC\uB3C4 \uC131\uACF5: invoice_id=${b}, retry_count=${o + 1}`), e.json({ success: true, data: { invoice_id: b, invoice_number: f, retry_count: o + 1 } });
  } catch (r) {
    console.error("[TAX INVOICE RETRY] \uC7AC\uC2DC\uB3C4 \uC2E4\uD328:", r);
    try {
      const a = e.req.param("orderNumber"), o = await s.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a, t.sellerId).first(), n = Number((o == null ? void 0 : o.retry_count) || 0);
      await s.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a, t.sellerId, r.message, n + 1).run();
    } catch (a) {
      console.error("[TAX INVOICE RETRY] \uB85C\uADF8 \uAE30\uB85D \uC2E4\uD328:", a);
    }
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/live/:id", async (e) => {
  try {
    const s = new URL("/static/live.html", e.req.url);
    let r = await (await fetch(s.toString())).text();
    const o = `<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY || "975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;
    return r = r.replace("<!-- Scripts -->", `<!-- Scripts -->
    ${o}`), console.log("[Live Page] Environment variables injected"), new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (s) {
    return console.error("Error serving live page:", s), new Response("<h1>Error loading live page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
p.get("/cart", async (e) => {
  try {
    const s = new URL("/static/cart.html", e.req.url);
    let r = await (await fetch(s.toString())).text();
    return r = r.replace("%%NICEPAY_CLIENT_ID%%", e.env.NICEPAY_CLIENT_ID || "S2_d5ec29558e9d46419bf01eb828ca0834"), r = r.replace("%%NICEPAY_MID%%", e.env.NICEPAY_MID || "nictest00m"), new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (s) {
    return console.error("Error serving cart page:", s), new Response("<h1>Error loading cart page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
p.get("/my-orders", async (e) => {
  try {
    const s = new URL("/static/my-orders.html", e.req.url), r = await (await fetch(s.toString())).text();
    return new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (s) {
    return console.error("Error serving my orders page:", s), new Response("<h1>Error loading orders page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
p.get("/payment-result", async (e) => {
  try {
    const s = new URL("/payment-result.html", e.req.url), r = await (await fetch(s.toString())).text();
    return new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (s) {
    return console.error("Error serving payment result page:", s), new Response("<h1>Error loading payment result page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
p.get("/api/seller/profile", async (e) => {
  const { DB: s } = e.env, t = e.req.header("X-Session-Token");
  if (!t) return e.json({ success: false, error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const r = await s.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(t).first();
    if (!r || !r.seller_id) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
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
    `).bind(r.seller_id).first();
    return a ? e.json({ success: true, data: a }) : e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/seller/profile", async (e) => {
  const { DB: s } = e.env, t = e.req.header("X-Session-Token");
  if (!t) return e.json({ success: false, error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const r = await s.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(t).first();
    if (!r || !r.seller_id) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const { profile_image: a, bio: o, sns_instagram: n, sns_youtube: i, sns_facebook: c, sns_twitter: l, website_url: u, kakao_chat_link: d } = await e.req.json(), m = [], _ = [];
    if (a !== void 0 && (m.push("profile_image = ?"), _.push(a)), o !== void 0 && (m.push("bio = ?"), _.push(o)), n !== void 0 && (m.push("sns_instagram = ?"), _.push(n)), i !== void 0 && (m.push("sns_youtube = ?"), _.push(i)), c !== void 0 && (m.push("sns_facebook = ?"), _.push(c)), l !== void 0 && (m.push("sns_twitter = ?"), _.push(l)), u !== void 0 && (m.push("website_url = ?"), _.push(u)), d !== void 0 && (m.push("kakao_chat_link = ?"), _.push(d)), m.length === 0) return e.json({ success: false, error: "\uC218\uC815\uD560 \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    m.push("updated_at = datetime('now')"), _.push(r.seller_id), await s.prepare(`
      UPDATE sellers 
      SET ${m.join(", ")}
      WHERE id = ?
    `).bind(..._).run();
    const f = await s.prepare(`
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
    `).bind(r.seller_id).first();
    return e.json({ success: true, message: "\uD504\uB85C\uD544\uC774 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: f });
  } catch (r) {
    return console.error("\uD504\uB85C\uD544 \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/public/:sellerId", async (e) => {
  const { DB: s } = e.env, t = e.req.param("sellerId");
  try {
    const r = await s.prepare(`
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
    `).bind(t).first();
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uC140\uB7EC \uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/:sellerId/streams", async (e) => {
  const { DB: s } = e.env, t = e.req.param("sellerId");
  try {
    const r = await s.prepare(`
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
    `).bind(t).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return console.error("\uB77C\uC774\uBE0C \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/:sellerId/products-public", async (e) => {
  const { DB: s } = e.env, t = e.req.param("sellerId");
  try {
    const r = await s.prepare(`
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
    `).bind(t).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return console.error("\uC0C1\uD488 \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/notifications", j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.get("userId"), r = e.get("userType"), a = parseInt(e.req.query("limit") || "50"), o = e.req.query("unread_only") === "true";
    let n = `
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;
    o && (n += " AND is_read = 0"), n += " ORDER BY created_at DESC LIMIT ?";
    const i = await s.prepare(n).bind(t, r, a).all();
    return e.json({ success: true, data: i.results });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/notifications/unread-count", j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.get("userId"), r = e.get("userType"), a = await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(t, r).first();
    return e.json({ success: true, count: (a == null ? void 0 : a.count) || 0 });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.put("/api/notifications/:id/read", j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("id"), r = e.get("userId"), a = e.get("userType");
    return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(t, r, a).first() ? (await s.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(t).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.put("/api/notifications/read-all", j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.get("userId"), r = e.get("userType");
    return await s.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(t, r).run(), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.delete("/api/notifications/:id", j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("id"), r = e.get("userId"), a = e.get("userType");
    return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(t, r, a).first() ? (await s.prepare("DELETE FROM notifications WHERE id = ?").bind(t).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/banners", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = (/* @__PURE__ */ new Date()).toISOString(), r = await s.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(t, t).all();
    return e.json({ success: true, data: r.results });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/admin/banners", j, async (e) => {
  const { DB: s } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const r = await s.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();
    return e.json({ success: true, data: r.results });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/admin/banners", j, async (e) => {
  const { DB: s } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const { title: r, image_url: a, link_url: o, description: n, is_active: i, display_order: c, start_date: l, end_date: u } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "\uC81C\uBAA9\uACFC \uC774\uBBF8\uC9C0\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const d = await s.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a, o || null, n || null, i !== false ? 1 : 0, c || 0, l || null, u || null).run();
    return e.json({ success: true, id: d.meta.last_row_id });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.put("/api/admin/banners/:id", j, async (e) => {
  const { DB: s } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const r = e.req.param("id"), { title: a, image_url: o, link_url: n, description: i, is_active: c, display_order: l, start_date: u, end_date: d } = await e.req.json();
    return await s.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a, o, n || null, i || null, c ? 1 : 0, l || 0, u || null, d || null, r).run(), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.delete("/api/admin/banners/:id", j, async (e) => {
  const { DB: s } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const r = e.req.param("id");
    return await s.prepare("DELETE FROM banners WHERE id = ?").bind(r).run(), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/order-complete", (e) => e.redirect("/order-complete.html", 302));
p.notFound((e) => {
  const s = e.req.path;
  return s.startsWith("/api/") ? e.json({ success: false, error: "Not found", message: `The requested endpoint ${s} was not found.` }, 404) : new Response(null, { status: 404 });
});
p.onError((e, s) => {
  const t = s.req.path;
  if (e instanceof Sa) return console.error("[AppError]", { path: t, method: s.req.method, code: e.code, message: e.message, statusCode: e.statusCode }), s.json({ success: false, error: { code: e.code, message: e.message, ...e.details && { details: e.details } } }, e.statusCode);
  if (console.error("[Global Error Handler]", { path: t, method: s.req.method, error: e.message, stack: e.stack }), t.startsWith("/api/")) {
    let r = 500, a = "Internal Server Error";
    return e.message.includes("Unauthorized") || e.message.includes("\uB85C\uADF8\uC778") ? (r = 401, a = "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uB85C\uADF8\uC778\uD574\uC8FC\uC138\uC694.") : e.message.includes("Forbidden") || e.message.includes("\uAD8C\uD55C") ? (r = 403, a = "\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.") : e.message.includes("Not found") || e.message.includes("\uCC3E\uC744 \uC218 \uC5C6") ? (r = 404, a = "\uC694\uCCAD\uD558\uC2E0 \uB9AC\uC18C\uC2A4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.") : (e.message.includes("Bad request") || e.message.includes("\uC798\uBABB\uB41C")) && (r = 400, a = "\uC798\uBABB\uB41C \uC694\uCCAD\uC785\uB2C8\uB2E4."), s.json({ success: false, error: e.message || a }, r);
  }
  return s.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>\uC624\uB958 \uBC1C\uC0DD - \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158</title>
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
p.get("/api/admin/alimtalk/pricing", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();
    return e.json({ success: true, pricing: t.results });
  } catch (t) {
    return console.error("[Admin Alimtalk Pricing] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/admin/alimtalk/pricing", S(), async (e) => {
  const { env: s } = e;
  try {
    const { plan_name: t, min_quantity: r, max_quantity: a, unit_price: o } = await e.req.json();
    if (!t || !r || !o) return e.json({ success: false, error: "Missing required fields" }, 400);
    const n = await s.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(t, r, a || null, o).run();
    return e.json({ success: true, pricing_id: n.meta.last_row_id });
  } catch (t) {
    return console.error("[Admin Alimtalk Pricing Create] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.put("/api/admin/alimtalk/pricing/:id", S(), async (e) => {
  const { env: s } = e, t = e.req.param("id");
  try {
    const { plan_name: r, min_quantity: a, max_quantity: o, unit_price: n, is_active: i } = await e.req.json();
    return (await s.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r, a, o || null, n, i ? 1 : 0, t).run()).meta.changes === 0 ? e.json({ success: false, error: "Pricing not found" }, 404) : e.json({ success: true, message: "Pricing updated successfully" });
  } catch (r) {
    return console.error("[Admin Alimtalk Pricing Update] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/admin/alimtalk/pricing/:id", S(), async (e) => {
  const { env: s } = e, t = e.req.param("id");
  try {
    return (await s.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(t).run()).meta.changes === 0 ? e.json({ success: false, error: "Pricing not found" }, 404) : e.json({ success: true, message: "Pricing deleted successfully" });
  } catch (r) {
    return console.error("[Admin Alimtalk Pricing Delete] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/alimtalk/accounts", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = await s.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();
    return e.json({ success: true, accounts: t.results });
  } catch (t) {
    return console.error("[Admin Alimtalk Accounts] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.patch("/api/admin/alimtalk/accounts/:id/status", S(), async (e) => {
  const { env: s } = e, t = e.req.param("id");
  try {
    const { status: r } = await e.req.json();
    return ["active", "suspended", "rejected"].includes(r) ? (await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r, t).run()).meta.changes === 0 ? e.json({ success: false, error: "Account not found" }, 404) : e.json({ success: true, message: `Account ${r} successfully` }) : e.json({ success: false, error: "Invalid status" }, 400);
  } catch (r) {
    return console.error("[Admin Alimtalk Account Status] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/alimtalk/statistics", S(), async (e) => {
  const { env: s } = e;
  try {
    const { start_date: t, end_date: r } = e.req.query(), a = await s.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_revenue
      FROM alimtalk_messages
      WHERE created_at >= ? AND created_at <= ?
    `).bind(t || "2000-01-01", r || "2100-01-01").first(), o = await s.DB.prepare(`
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
    `).bind(t || "2000-01-01", r || "2100-01-01").all();
    return e.json({ success: true, statistics: { total: a, by_seller: o.results } });
  } catch (t) {
    return console.error("[Admin Alimtalk Statistics] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.use("/api/seller/alimtalk/*", j);
p.get("/api/seller/alimtalk/account", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.get("user");
    if (!t || t.userType !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(t.userId).first();
    return e.json({ success: true, account: r });
  } catch (t) {
    return console.error("[Seller Alimtalk Account] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/alimtalk/register", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Ne(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { channel_id: a, phone_number: o } = await e.req.json();
    if (!a || !o) return e.json({ success: false, error: "Missing required fields" }, 400);
    const n = Tt(o), i = await Vr(s, { channelId: a, phoneNumber: n });
    if (!i.success) return e.json({ success: false, error: "Failed to register Kakao channel" }, 500);
    const c = await s.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(r.user_id, a, a, i.senderKey, n).run();
    return e.json({ success: true, account_id: c.meta.last_row_id, sender_key: i.senderKey, message: "Kakao channel registered successfully" });
  } catch (t) {
    return console.error("[Seller Alimtalk Register] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/seller/alimtalk/templates", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Ne(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const a = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!a) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const o = await s.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();
    return e.json({ success: true, templates: o.results });
  } catch (t) {
    return console.error("[Seller Alimtalk Templates] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/alimtalk/templates", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Ne(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_code: a, template_name: o, template_content: n, template_type: i } = await e.req.json();
    if (!a || !o || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (!(await Yr(s, c.sender_key, { name: o, content: n, templateCode: a })).success) return e.json({ success: false, error: "Failed to register template" }, 500);
    const u = await s.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id, a, o, n, i || "basic").run();
    return e.json({ success: true, template_id: u.meta.last_row_id, message: "Template registered successfully. Approval pending (1-2 days)" });
  } catch (t) {
    return console.error("[Seller Alimtalk Template Register] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/seller/alimtalk/pricing", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();
    return e.json({ success: true, pricing: t.results });
  } catch (t) {
    return console.error("[Seller Alimtalk Pricing] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/alimtalk/charge", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Ne(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { amount: a, pricing_id: o } = await e.req.json();
    if (!a || !o) return e.json({ success: false, error: "Missing required fields" }, 400);
    const n = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!n) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const i = await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(o).first();
    if (!i) return e.json({ success: false, error: "Pricing not found" }, 404);
    const c = a * i.unit_price, l = `alimtalk_${n.id}_${Date.now()}`, u = await s.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(n.id, a, c, i.unit_price, l).run(), d = `https://api.tosspayments.com/v1/payment/${l}`;
    return e.json({ success: true, charge_id: u.meta.last_row_id, order_id: l, amount: a, price: c, unit_price: i.unit_price, payment_url: d });
  } catch (t) {
    return console.error("[Seller Alimtalk Charge] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/alimtalk/charge/complete", S(), async (e) => {
  const { env: s } = e;
  try {
    const { order_id: t, payment_id: r } = await e.req.json();
    if (!t) return e.json({ success: false, error: "Missing order_id" }, 400);
    const a = await s.DB.prepare(`
      SELECT * FROM alimtalk_charges WHERE order_id = ? AND payment_status = 'pending'
    `).bind(t).first();
    return a ? (await s.DB.prepare(`
      UPDATE alimtalk_charges 
      SET payment_status = 'completed', 
          payment_id = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r || null, a.id).run(), await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a.amount, a.account_id).run(), e.json({ success: true, message: "Charge completed successfully", charged_amount: a.amount })) : e.json({ success: false, error: "Charge not found or already completed" }, 404);
  } catch (t) {
    return console.error("[Seller Alimtalk Charge Complete] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/alimtalk/send", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Ne(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_id: a, recipient_phone: o, variables: n, order_id: i } = await e.req.json();
    if (!a || !o) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (c.balance < 1) return e.json({ success: false, error: "Insufficient balance. Please charge first." }, 400);
    const l = await s.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a, c.id).first();
    if (!l) return e.json({ success: false, error: "Template not found or not approved" }, 404);
    const u = Jr(l.template_content, n || {}), d = Tt(o), m = await As(s, { senderKey: c.sender_key, templateCode: l.template_code, to: d, message: u });
    if (!m.success) return await s.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id, a, i || null, d, u, m.error).run(), e.json({ success: false, error: m.error }, 500);
    const _ = await s.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id, a, i || null, d, u, 15, m.messageId).run();
    return await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(), e.json({ success: true, message_id: _.meta.last_row_id, aligo_message_id: m.messageId, status: "sent", remaining_balance: c.balance - 1 });
  } catch (t) {
    return console.error("[Seller Alimtalk Send] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/seller/alimtalk/messages", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Ne(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { page: a = "1", limit: o = "20", status: n } = e.req.query(), i = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!i) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const c = (parseInt(a) - 1) * parseInt(o);
    let l = `
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;
    const u = [i.id];
    n && (l += " AND m.status = ?", u.push(n)), l += " ORDER BY m.created_at DESC LIMIT ? OFFSET ?", u.push(parseInt(o), c);
    const d = await s.DB.prepare(l).bind(...u).all(), m = await s.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();
    return e.json({ success: true, messages: d.results, pagination: { total: m.total, page: parseInt(a), limit: parseInt(o) } });
  } catch (t) {
    return console.error("[Seller Alimtalk Messages] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/seller/alimtalk/statistics", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Ne(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { start_date: a, end_date: o } = e.req.query(), n = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!n) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
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
    `).bind(n.id, a || "2000-01-01", o || "2100-01-01").first(), c = await s.DB.prepare(`
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
    `).bind(n.id, a || "2000-01-01", o || "2100-01-01").all(), l = i.total_sent > 0 ? (i.total_success / i.total_sent * 100).toFixed(2) : 0;
    return e.json({ success: true, statistics: { total_sent: i.total_sent, total_success: i.total_success, total_failed: i.total_failed, success_rate: l, total_cost: i.total_cost, by_template: c.results } });
  } catch (t) {
    return console.error("[Seller Alimtalk Statistics] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/alimtalk/send", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await e.req.json(), { templateId: r, recipients: a, variables: o } = t;
    if (!r || !Array.isArray(a) || a.length === 0) return e.json({ success: false, error: "templateId and recipients are required" }, 400);
    const n = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();
    if (!n) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    const i = await Ns(e.env, { accountId: n.id, templateId: parseInt(r), recipients: a.map((c) => ({ phone: c.phone, name: c.name, variables: c.variables || {} })), variables: o || {} });
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (s) {
    return console.error("[Alimtalk Send] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/alimtalk/send/order", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await e.req.json(), { templateId: r, orderId: a, customMessage: o } = t;
    if (!r || !a) return e.json({ success: false, error: "templateId and orderId are required" }, 400);
    const n = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();
    if (!n) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    if (!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a), parseInt(s)).first()) return e.json({ success: false, error: "Order not found or unauthorized" }, 404);
    const c = await oa(e.env, n.id, parseInt(r), parseInt(a), o);
    return e.json({ success: c.success, data: { total: c.totalRecipients, sent: c.successCount, failed: c.failedCount, refunded: c.refundedAmount }, messages: c.messages });
  } catch (s) {
    return console.error("[Alimtalk Send Order] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/alimtalk/send/bulk", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await e.req.json(), { templateId: r, rows: a, variables: o } = t;
    if (!r || !Array.isArray(a) || a.length === 0) return e.json({ success: false, error: "templateId and rows are required" }, 400);
    const n = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();
    if (!n) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    const i = await na(e.env, n.id, parseInt(r), a, o || {});
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (s) {
    return console.error("[Alimtalk Send Bulk] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/alimtalk/templates/:id/preview", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = e.req.param("id"), r = await e.req.json(), { variables: a } = r, o = await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(t), parseInt(s)).first();
    if (!o) return e.json({ success: false, error: "Template not found" }, 404);
    let n = o.template_content;
    return a && Object.entries(a).forEach(([i, c]) => {
      const l = new RegExp(`#{${i}}`, "g");
      n = n.replace(l, c);
    }), e.json({ success: true, data: { template_name: o.template_name, original: o.template_content, preview: n, required_variables: Array.from(o.template_content.matchAll(/#{(\w+)}/g), (i) => i[1]) } });
  } catch (s) {
    return console.error("[Alimtalk Preview] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/admin/settlements", S(), async (e) => {
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
p.get("/api/admin/settlements/:id", S(), async (e) => {
  try {
    const s = parseInt(e.req.param("id")), t = await pa(e.env.DB, s);
    return t ? e.json({ success: true, data: t }) : e.json({ success: false, error: "Settlement not found" }, 404);
  } catch (s) {
    return console.error("[Admin Settlement Detail] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/admin/settlements/generate", S(), async (e) => {
  try {
    const s = await e.req.json(), { startDate: t, endDate: r } = s, a = t && r ? { startDate: t, endDate: r } : ca(), o = await ua(e.env.DB, a);
    return await da(e.env.DB, o), e.json({ success: true, data: o });
  } catch (s) {
    return console.error("[Admin Generate Settlement] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/settlements", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await e.env.DB.prepare(`
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
    return e.json({ success: true, data: t.results });
  } catch (s) {
    return console.error("[Seller Settlements] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/admin/settlements/calculate", S(), async (e) => {
  const { DB: s } = e.env;
  if (!(await P(e)).success) return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const r = e.req.query("seller_id"), a = e.req.query("period") || "monthly", o = e.req.query("format") || "json";
    let n = e.req.query("start_date"), i = e.req.query("end_date");
    if (!r) return e.json({ success: false, error: "seller_id\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    const c = /* @__PURE__ */ new Date();
    if (a === "weekly") {
      const h = new Date(c);
      h.setDate(c.getDate() - c.getDay() - 6), h.setHours(0, 0, 0, 0);
      const T = new Date(h);
      T.setDate(h.getDate() + 6), T.setHours(23, 59, 59, 999), n = h.toISOString().split("T")[0], i = T.toISOString().split("T")[0];
    } else if (a === "monthly") {
      const h = new Date(c.getFullYear(), c.getMonth() - 1, 1), T = new Date(c.getFullYear(), c.getMonth(), 0);
      n = h.toISOString().split("T")[0], i = T.toISOString().split("T")[0];
    } else if (a === "custom" && (!n || !i)) return e.json({ success: false, error: "custom \uAE30\uAC04 \uC120\uD0DD \uC2DC start_date\uC640 end_date\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    const l = await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(r).first();
    if (!l) return e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const d = (await s.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.status,
        o.total_amount,
        o.commission_rate,
        o.commission_amount,
        o.seller_amount
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.seller_id = ?
        AND o.status IN ('paid', 'preparing', 'shipped', 'delivered')
        AND DATE(o.created_at) >= ?
        AND DATE(o.created_at) <= ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).bind(r, n, i).all()).results, m = d.length, _ = d.reduce((h, T) => h + (T.total_amount || 0), 0), f = d.reduce((h, T) => h + (T.commission_amount || 0), 0), g = _ - f, b = m > 0 ? d.reduce((h, T) => h + (T.commission_rate || 0), 0) / m : 0, w = { sellerId: parseInt(r), sellerName: l.seller_name || "Unknown", businessName: l.business_name || null, period: { type: a, startDate: n, endDate: i }, summary: { totalOrders: m, totalSales: _, totalCommission: f, netAmount: g, commissionRate: Math.round(b * 100) / 100 }, orders: d.map((h) => ({ orderNumber: h.order_number, createdAt: h.created_at, status: h.status, totalAmount: h.total_amount || 0, commissionAmount: h.commission_amount || 0, sellerAmount: h.seller_amount || 0 })) };
    if (o === "csv") {
      const h = [];
      h.push("\uC140\uB7EC \uC815\uC0B0\uC11C"), h.push(`\uC140\uB7EC\uBA85,${w.sellerName}`), h.push(`\uC0AC\uC5C5\uC790\uBA85,${w.businessName || "N/A"}`), h.push(`\uC815\uC0B0 \uAE30\uAC04,${w.period.startDate} ~ ${w.period.endDate}`), h.push(""), h.push("\uAD6C\uBD84,\uAE08\uC561"), h.push(`\uCD1D \uC8FC\uBB38 \uAC74\uC218,${w.summary.totalOrders}\uAC74`), h.push(`\uCD1D \uB9E4\uCD9C,${w.summary.totalSales.toLocaleString()}\uC6D0`), h.push(`\uD50C\uB7AB\uD3FC \uC218\uC218\uB8CC (${w.summary.commissionRate}%),${w.summary.totalCommission.toLocaleString()}\uC6D0`), h.push(`\uC815\uC0B0 \uAE08\uC561,${w.summary.netAmount.toLocaleString()}\uC6D0`), h.push(""), h.push("\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC0C1\uD0DC,\uC8FC\uBB38\uAE08\uC561,\uD50C\uB7AB\uD3FC\uC218\uC218\uB8CC,\uC815\uC0B0\uAE08\uC561");
      for (const R of w.orders) h.push(`${R.orderNumber},${R.createdAt},${R.status},${R.totalAmount},${R.commissionAmount},${R.sellerAmount}`);
      const T = h.join(`
`), y = `settlement_${r}_${n}_${i}.csv`;
      return e.text(T, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${y}"` });
    }
    return e.json({ success: true, data: w });
  } catch (r) {
    return console.error("[Settlement] Calculation error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/settlements/my", S(), async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: "\uC140\uB7EC \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  const r = new URL(e.req.url);
  r.searchParams.set("seller_id", String(t.sellerId));
  const a = new Request(r.toString(), e.req.raw);
  ({ ...e, req: new Proxy(a, { get(o, n) {
    return n === "query" ? (i) => i === "seller_id" ? String(t.sellerId) : r.searchParams.get(i) : o[n];
  } }) });
  try {
    const o = t.sellerId, n = e.req.query("period") || "monthly", i = e.req.query("format") || "json";
    let c = e.req.query("start_date"), l = e.req.query("end_date");
    const u = /* @__PURE__ */ new Date();
    if (n === "weekly") {
      const y = new Date(u);
      y.setDate(u.getDate() - u.getDay() - 6), y.setHours(0, 0, 0, 0);
      const R = new Date(y);
      R.setDate(y.getDate() + 6), R.setHours(23, 59, 59, 999), c = y.toISOString().split("T")[0], l = R.toISOString().split("T")[0];
    } else if (n === "monthly") {
      const y = new Date(u.getFullYear(), u.getMonth() - 1, 1), R = new Date(u.getFullYear(), u.getMonth(), 0);
      c = y.toISOString().split("T")[0], l = R.toISOString().split("T")[0];
    } else if (n === "custom" && (!c || !l)) return e.json({ success: false, error: "custom \uAE30\uAC04 \uC120\uD0DD \uC2DC start_date\uC640 end_date\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    const d = await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(o).first();
    if (!d) return e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const _ = (await s.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.status,
        o.total_amount,
        o.commission_rate,
        o.commission_amount,
        o.seller_amount
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.seller_id = ?
        AND o.status IN ('paid', 'preparing', 'shipped', 'delivered')
        AND DATE(o.created_at) >= ?
        AND DATE(o.created_at) <= ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).bind(o, c, l).all()).results, f = _.length, g = _.reduce((y, R) => y + (R.total_amount || 0), 0), b = _.reduce((y, R) => y + (R.commission_amount || 0), 0), w = g - b, h = f > 0 ? _.reduce((y, R) => y + (R.commission_rate || 0), 0) / f : 0, T = { sellerId: o, sellerName: d.seller_name || "Unknown", businessName: d.business_name || null, period: { type: n, startDate: c, endDate: l }, summary: { totalOrders: f, totalSales: g, totalCommission: b, netAmount: w, commissionRate: Math.round(h * 100) / 100 }, orders: _.map((y) => ({ orderNumber: y.order_number, createdAt: y.created_at, status: y.status, totalAmount: y.total_amount || 0, commissionAmount: y.commission_amount || 0, sellerAmount: y.seller_amount || 0 })) };
    if (i === "csv") {
      const y = [];
      y.push("\uC140\uB7EC \uC815\uC0B0\uC11C"), y.push(`\uC140\uB7EC\uBA85,${T.sellerName}`), y.push(`\uC0AC\uC5C5\uC790\uBA85,${T.businessName || "N/A"}`), y.push(`\uC815\uC0B0 \uAE30\uAC04,${T.period.startDate} ~ ${T.period.endDate}`), y.push(""), y.push("\uAD6C\uBD84,\uAE08\uC561"), y.push(`\uCD1D \uC8FC\uBB38 \uAC74\uC218,${T.summary.totalOrders}\uAC74`), y.push(`\uCD1D \uB9E4\uCD9C,${T.summary.totalSales.toLocaleString()}\uC6D0`), y.push(`\uD50C\uB7AB\uD3FC \uC218\uC218\uB8CC (${T.summary.commissionRate}%),${T.summary.totalCommission.toLocaleString()}\uC6D0`), y.push(`\uC815\uC0B0 \uAE08\uC561,${T.summary.netAmount.toLocaleString()}\uC6D0`), y.push(""), y.push("\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC0C1\uD0DC,\uC8FC\uBB38\uAE08\uC561,\uD50C\uB7AB\uD3FC\uC218\uC218\uB8CC,\uC815\uC0B0\uAE08\uC561");
      for (const A of T.orders) y.push(`${A.orderNumber},${A.createdAt},${A.status},${A.totalAmount},${A.commissionAmount},${A.sellerAmount}`);
      const R = y.join(`
`), $ = `my_settlement_${c}_${l}.csv`;
      return e.text(R, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${$}"` });
    }
    return e.json({ success: true, data: T });
  } catch (o) {
    return console.error("[My Settlement] Error:", o), e.json({ success: false, error: o.message }, 500);
  }
});
p.get("/api/seller/settlements", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await e.env.DB.prepare(`
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
    return e.json({ success: true, data: t.results });
  } catch (s) {
    return console.error("[Seller Settlements] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/live/:streamId/sse", async (e) => {
  const s = e.req.param("streamId");
  return ma(s, e.env);
});
p.get("/api/live/:streamId/chat/sse", async (e) => {
  const s = e.req.param("streamId");
  return _a(s, e.env);
});
p.get("/api/seller/orders/sse", async (e) => {
  const s = e.req.header("X-Seller-ID");
  return s ? fa(s, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
p.get("/api/seller/stock/sse", async (e) => {
  const s = e.req.header("X-Seller-ID");
  return s ? Ea(s, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
p.post("/api/push/subscribe", S(), async (e) => {
  try {
    const s = e.req.header("X-User-ID"), t = e.req.header("X-User-Type");
    if (!s || !t) return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await e.req.json();
    return await ha(e.env.DB, parseInt(s), t, r), e.json({ success: true });
  } catch (s) {
    return console.error("[Push Subscribe] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/push/unsubscribe", S(), async (e) => {
  try {
    const { endpoint: s } = await e.req.json();
    return s ? (await ga(e.env.DB, s), e.json({ success: true })) : e.json({ success: false, error: "Endpoint required" }, 400);
  } catch (s) {
    return console.error("[Push Unsubscribe] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/push/vapid-public-key", S(), async (e) => {
  try {
    const s = e.env.VAPID_PUBLIC_KEY || "";
    return e.json({ success: true, publicKey: s });
  } catch (s) {
    return console.error("[Push VAPID Key] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/cache/stats", async (e) => {
  const s = e.req.query("token"), t = e.env.STATS_SECRET_TOKEN || "your-secret-token-here";
  if (s !== t) return e.json({ success: false, error: "\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC62C\uBC14\uB978 token\uC744 \uC81C\uACF5\uD574\uC8FC\uC138\uC694." }, 403);
  const r = V.hits + V.misses > 0 ? (V.hits / (V.hits + V.misses) * 100).toFixed(2) : "0.00";
  return e.json({ success: true, data: { cache: { ...V, hitRate: `${r}%`, cacheSize: le.size, maxSize: 1e3, memoryUsage: `${(le.size / 1e3 * 100).toFixed(1)}%` }, description: { hits: "Memory cache\uB85C \uCC98\uB9AC\uB41C \uC694\uCCAD (KV \uC77D\uAE30 0\uD68C)", misses: "Memory cache \uBBF8\uC2A4\uB85C KV \uC870\uD68C\uD55C \uC694\uCCAD", writes: "Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", evictions: "Memory cache\uC5D0\uC11C \uC0AD\uC81C\uB41C \uD56D\uBAA9 \uC218 (\uB9CC\uB8CC \uB610\uB294 \uD06C\uAE30 \uC81C\uD55C)", hitRate: "Cache hit \uBE44\uC728 (\uB192\uC744\uC218\uB85D KV \uC0AC\uC6A9\uB7C9 \uAC10\uC18C)", cacheSize: "\uD604\uC7AC Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", maxSize: "Memory cache \uCD5C\uB300 \uD06C\uAE30", memoryUsage: "Memory cache \uC0AC\uC6A9\uB960 (cacheSize / maxSize)" }, kvUsageGuide: { currentHitRate: `${r}%`, recommendation: parseFloat(r) >= 90 ? "\u2705 \uCE90\uC2DC\uAC00 \uB9E4\uC6B0 \uD6A8\uACFC\uC801\uC73C\uB85C \uC791\uB3D9\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : parseFloat(r) >= 70 ? "\u26A0\uFE0F \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB0AE\uC2B5\uB2C8\uB2E4. TTL \uC870\uC815\uC744 \uACE0\uB824\uD558\uC138\uC694." : "\u274C \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB9E4\uC6B0 \uB0AE\uC2B5\uB2C8\uB2E4. \uCE90\uC2DC \uC124\uC815\uC744 \uD655\uC778\uD558\uC138\uC694.", kvDailyReadsLimit: "100,000 reads/day (free tier)", kvDailyWritesLimit: "1,000 writes/day (free tier)", estimatedDailyReads: Math.round(V.misses / (V.hits + V.misses || 1) * 1e4), estimatedDailyWrites: Math.round(V.writes / (V.hits + V.misses || 1) * 1e3) } } });
});
var zs = {};
var Gs = {};
p.get("/api/debug/kv-usage", S(), async (e) => {
  try {
    const s = Object.entries(zs).sort((i, c) => c[1] - i[1]).slice(0, 20), t = Object.entries(Gs).sort((i, c) => c[1] - i[1]).slice(0, 20), r = Object.values(zs).reduce((i, c) => i + c, 0), a = Object.values(Gs).reduce((i, c) => i + c, 0), o = r / 1e3 * 100, n = a / 1e5 * 100;
    if ((o >= 50 || n >= 50) && e.env.DISCORD_WEBHOOK_URL) try {
      await Ra(e.env.DISCORD_WEBHOOK_URL, n, o);
    } catch (i) {
      console.error("[Discord] KV \uACBD\uACE0 \uC804\uC1A1 \uC2E4\uD328:", i);
    }
    return e.json({ success: true, stats: { total_writes: r, total_reads: a, daily_write_limit: 1e3, daily_read_limit: 1e5, write_usage_percent: o.toFixed(2) + "%", read_usage_percent: n.toFixed(2) + "%", top_writes: s, top_reads: t }, recommendations: r > 500 ? ["\u26A0\uFE0F KV Write \uC0AC\uC6A9\uB7C9\uC774 \uB192\uC2B5\uB2C8\uB2E4!", "1. \uC138\uC158 \uAC31\uC2E0 \uC8FC\uAE30\uB97C \uB298\uB9AC\uC138\uC694 (\uD604\uC7AC 29\uC77C)", "2. \uCE90\uC2DC\uB97C \uBA54\uBAA8\uB9AC\uC5D0\uB9CC \uC800\uC7A5\uD558\uC138\uC694 (forceKvWrite: false)", "3. JWT \uC778\uC99D\uC73C\uB85C \uC804\uD658\uD558\uC138\uC694 (KV \uC0AC\uC6A9\uB7C9 90% \uAC10\uC18C)"] : ["\u2705 KV \uC0AC\uC6A9\uB7C9\uC774 \uC815\uC0C1 \uBC94\uC704\uC785\uB2C8\uB2E4."] });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/notifications", S(), async (e) => {
  var t;
  const { DB: s } = e.env;
  try {
    const r = e.req.query("userId"), a = parseInt(e.req.query("limit") || "20"), o = parseInt(e.req.query("offset") || "0");
    if (!r) return e.json({ success: false, error: "userId is required" }, 400);
    const n = await s.prepare(`
      SELECT id, type, title, message, link_url, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(r, a, o).all(), i = await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).bind(r).first();
    return e.json({ success: true, data: { notifications: n.results || [], unread_count: (i == null ? void 0 : i.count) || 0, total: ((t = n.results) == null ? void 0 : t.length) || 0 } });
  } catch (r) {
    return console.error("[Notifications] Get error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/notifications/:id/read", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("id"), { userId: r } = await e.req.json();
    return r ? (await s.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).bind(t, r).run()).meta.changes === 0 ? e.json({ success: false, error: "Notification not found" }, 404) : e.json({ success: true, message: "Notification marked as read" }) : e.json({ success: false, error: "userId is required" }, 400);
  } catch (t) {
    return console.error("[Notifications] Mark read error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.patch("/api/notifications/read-all", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { userId: t } = await e.req.json();
    return t ? (await s.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `).bind(t).run(), e.json({ success: true, message: "All notifications marked as read" })) : e.json({ success: false, error: "userId is required" }, 400);
  } catch (t) {
    return console.error("[Notifications] Mark all read error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.delete("/api/notifications/:id", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("id"), r = e.req.query("userId");
    return r ? (await s.prepare(`
      DELETE FROM notifications
      WHERE id = ? AND user_id = ?
    `).bind(t, r).run()).meta.changes === 0 ? e.json({ success: false, error: "Notification not found" }, 404) : e.json({ success: true, message: "Notification deleted" }) : e.json({ success: false, error: "userId is required" }, 400);
  } catch (t) {
    return console.error("[Notifications] Delete error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
async function Ka(e, s, t) {
  var a, o;
  const r = { embeds: [{ title: "\u{1F6A8} \uC11C\uBC84 \uC5D0\uB7EC \uBC1C\uC0DD", color: 16711680, fields: [{ name: "\uC5D0\uB7EC \uBA54\uC2DC\uC9C0", value: s.message || "Unknown error", inline: false }, { name: "\uBC1C\uC0DD \uC2DC\uAC01", value: (/* @__PURE__ */ new Date()).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }), inline: true }, { name: "HTTP \uBA54\uC18C\uB4DC", value: t.method || "N/A", inline: true }, { name: "API \uACBD\uB85C", value: t.path || "N/A", inline: false }, { name: "\uC0AC\uC6A9\uC790 ID", value: ((a = t.userId) == null ? void 0 : a.toString()) || "\uBE44\uB85C\uADF8\uC778", inline: true }, { name: "\uC0AC\uC6A9\uC790 \uD0C0\uC785", value: t.userType || "N/A", inline: true }, { name: "\uC5D0\uB7EC \uC2A4\uD0DD", value: "```\n" + (((o = s.stack) == null ? void 0 : o.substring(0, 800)) || "N/A") + "\n```", inline: false }], timestamp: (/* @__PURE__ */ new Date()).toISOString(), footer: { text: "UR LIVE Error Monitoring" } }] };
  try {
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) }), console.log("[Discord] Error alert sent successfully");
  } catch (n) {
    console.error("[Discord Webhook] Failed to send alert:", n);
  }
}
__name(Ka, "Ka");
__name2(Ka, "Ka");
p.onError(async (e, s) => {
  if (console.error("[Error]", e), s.env.DISCORD_WEBHOOK_URL) try {
    await Ka(s.env.DISCORD_WEBHOOK_URL, e, { method: s.req.method, path: s.req.path, userId: s.get("userId"), userType: s.get("userType") });
  } catch (t) {
    console.error("[Discord] Webhook failed, but continuing:", t);
  }
  return s.json({ success: false, error: { code: e.code || "INTERNAL_ERROR", message: e.message || "\uC11C\uBC84 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." } }, e.status || 500);
});
var Xs = new yt();
var Va = Object.assign({ "/src/index.tsx": p });
var kt = false;
for (const [, e] of Object.entries(Va)) e && (Xs.route("/", e), Xs.notFound(e.notFoundHandler), kt = true);
if (!kt) throw new Error("Can't import modules from ['/src/index.tsx']");
var ze = null;
async function At(e, s) {
  try {
    const t = e.split(".");
    if (t.length !== 3) throw new Error("Invalid token structure");
    const r = JSON.parse(atob(t[0].replace(/-/g, "+").replace(/_/g, "/"))), a = JSON.parse(atob(t[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (console.log("[Firebase JWT] Token header:", r), console.log("[Firebase JWT] Token payload (aud, iss, exp):", { aud: a.aud, iss: a.iss, exp: a.exp }), a.aud !== s) throw new Error(`Invalid audience. Expected ${s}, got ${a.aud}`);
    if (!a.iss || !a.iss.includes(s)) throw new Error("Invalid issuer");
    if (a.exp < Math.floor(Date.now() / 1e3)) throw new Error("Token expired");
    return await Ya(e, r.kid), console.log("[Firebase JWT] \u2705 Token verified successfully"), a;
  } catch (t) {
    throw console.error("[Firebase JWT] \u274C Verification failed:", t), t;
  }
}
__name(At, "At");
__name2(At, "At");
async function Nt() {
  const e = Date.now();
  if (ze && ze.expires > e) return ze.keys;
  const s = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!s.ok) throw new Error("Failed to fetch public keys");
  const t = await s.json(), a = (s.headers.get("cache-control") || "").match(/max-age=(\d+)/), o = a ? parseInt(a[1]) : 3600;
  return ze = { keys: Object.entries(t).map(([n, i]) => ({ kid: n, cert: i })), expires: e + o * 1e3 }, ze.keys;
}
__name(Nt, "Nt");
__name2(Nt, "Nt");
async function Ya(e, s) {
  if (!(await Nt()).find((a) => a.kid === s)) throw new Error(`Public key not found for kid: ${s}`);
  console.log("[Firebase JWT] Public key found for kid:", s);
}
__name(Ya, "Ya");
__name2(Ya, "Ya");
var Ja = { verifyFirebaseIdToken: At, getPublicKeys: Nt };
var za = Object.freeze(Object.defineProperty({ __proto__: null, default: Ja, verifyFirebaseIdToken: At }, Symbol.toStringTag, { value: "Module" }));
async function Ct(e) {
  try {
    const { to: s, subject: t, htmlContent: r, textContent: a } = e, o = await fetch("https://api.mailchannels.net/tx/v1/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: s }] }], from: { email: "noreply@live.ur-team.com", name: "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158" }, subject: t, content: [{ type: "text/html", value: r }, ...a ? [{ type: "text/plain", value: a }] : []] }) });
    if (!o.ok) {
      const n = await o.text();
      return console.error("[Email] Failed to send:", o.status, n), { success: false, error: `Email send failed: ${o.status}` };
    }
    return console.log("[Email] Successfully sent to:", s), { success: true };
  } catch (s) {
    return console.error("[Email] Exception:", s), { success: false, error: s.message };
  }
}
__name(Ct, "Ct");
__name2(Ct, "Ct");
async function Ga(e) {
  const { streamId: s, title: t, sellerName: r, platform: a, scheduledAt: o, status: n } = e, i = `https://live.ur-team.com/live/${s}`, c = n === "live" ? "\u{1F534} \uB77C\uC774\uBE0C \uC911" : n === "scheduled" ? "\u{1F4C5} \uC608\uC57D\uB428" : "\u23F8\uFE0F \uB300\uAE30 \uC911", l = `
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
          <span class="badge ${n === "live" ? "badge-live" : "badge-scheduled"}">${c}</span>
        </span>
      </div>
      
      <div class="info-row">
        <span class="label">\uC81C\uBAA9</span>
        <span class="value"><strong>${t}</strong></span>
      </div>
      
      <div class="info-row">
        <span class="label">\uD310\uB9E4\uC790</span>
        <span class="value">${r}</span>
      </div>
      
      <div class="info-row">
        <span class="label">\uD50C\uB7AB\uD3FC</span>
        <span class="value">${a === "youtube" ? "\u{1F4FA} YouTube" : "\u{1F3B5} TikTok"}</span>
      </div>
      
      ${o ? `
      <div class="info-row">
        <span class="label">\uC608\uC57D \uC2DC\uAC04</span>
        <span class="value">${new Date(o).toLocaleString("ko-KR")}</span>
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
  `, u = `
\u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131!

\uC0C1\uD0DC: ${c}
\uC81C\uBAA9: ${t}
\uD310\uB9E4\uC790: ${r}
\uD50C\uB7AB\uD3FC: ${a === "youtube" ? "YouTube" : "TikTok"}
${o ? `\uC608\uC57D \uC2DC\uAC04: ${new Date(o).toLocaleString("ko-KR")}` : ""}
\uB77C\uC774\uBE0C ID: #${s}

\u{1F517} \uB77C\uC774\uBE0C \uD398\uC774\uC9C0: ${i}

---
\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158
\uBD80\uC0B0\uAD11\uC5ED\uC2DC \uAE08\uC815\uAD6C \uB180\uC774\uB9C8\uB2F9\uB85C26 1402
\uB300\uD45C\uC804\uD654: 0507-0177-0432 | \uC774\uBA54\uC77C: jiwon@ur-team.com
  `;
  return Ct({ to: "jiwon@ur-team.com", subject: `[\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158] \u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131: ${t}`, htmlContent: l, textContent: u });
}
__name(Ga, "Ga");
__name2(Ga, "Ga");
var Xa = Object.freeze(Object.defineProperty({ __proto__: null, sendEmail: Ct, sendLiveStreamCreatedEmail: Ga }, Symbol.toStringTag, { value: "Module" }));
async function Qa(e, s, t) {
  const r = e.from || t || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <onboarding@resend.dev>", { to: a, subject: o, html: n } = e;
  if (!s) return console.warn("[Email] RESEND_API_KEY not configured, skipping email"), { success: false, error: "API key not configured" };
  try {
    console.log("[Email] Sending email:", { to: a, subject: o, from: r });
    const i = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${s}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: r, to: a, subject: o, html: n }) }), c = await i.json();
    return i.ok ? (console.log("[Email] Sent successfully:", { to: a, subject: o, id: c.id }), { success: true }) : (console.error("[Email] Failed to send:", c), { success: false, error: c.message || "Failed to send email" });
  } catch (i) {
    return console.error("[Email] Error:", i), { success: false, error: i.message };
  }
}
__name(Qa, "Qa");
__name2(Qa, "Qa");
function Za(e, s) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\uC140\uB7EC \uC2B9\uC778 \uC644\uB8CC</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #1d1d1f; font-size: 28px; font-weight: 700;">\u{1F389} \uCD95\uD558\uD569\uB2C8\uB2E4!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                \uC548\uB155\uD558\uC138\uC694, <strong>${e}</strong>\uB2D8!
              </p>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                <strong>\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158</strong> \uD310\uB9E4\uC790\uB85C \uC2B9\uC778\uB418\uC168\uC2B5\uB2C8\uB2E4! \u{1F38A}
              </p>
              
              <div style="background-color: #f9f9f9; border-left: 4px solid #FFD700; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <p style="margin: 0 0 10px; color: #1d1d1f; font-size: 14px;">
                  <strong>\uD310\uB9E4\uC790 \uC815\uBCF4</strong>
                </p>
                <p style="margin: 0 0 5px; color: #666; font-size: 14px;">
                  \uC544\uC774\uB514: <strong>${s}</strong>
                </p>
                <p style="margin: 0; color: #666; font-size: 14px;">
                  \uC774\uB984: <strong>${e}</strong>
                </p>
              </div>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                \uC774\uC81C \uC0C1\uD488\uC744 \uB4F1\uB85D\uD558\uACE0 \uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uC2DC\uC791\uD558\uC2E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4!
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="https://live.ur-team.com/seller" style="display: inline-block; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #1d1d1f; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3);">
                  \uC140\uB7EC \uB300\uC2DC\uBCF4\uB4DC \uBC14\uB85C\uAC00\uAE30 \u2192
                </a>
              </div>
              
              <p style="margin: 30px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                \uC9C8\uBB38\uC774\uB098 \uB3C4\uC6C0\uC774 \uD544\uC694\uD558\uC2DC\uBA74 \uC5B8\uC81C\uB4E0\uC9C0 \uC5F0\uB77D\uC8FC\uC138\uC694.<br>
                \uAC10\uC0AC\uD569\uB2C8\uB2E4!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                <strong>\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158</strong> | \uB77C\uC774\uBE0C \uCEE4\uBA38\uC2A4 \uD50C\uB7AB\uD3FC
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                \xA9 2026 \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
__name(Za, "Za");
__name2(Za, "Za");
function eo(e, s) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\uC140\uB7EC \uC2B9\uC778 \uAC70\uBD80</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #f5f5f5; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #1d1d1f; font-size: 24px; font-weight: 600;">\uD310\uB9E4\uC790 \uC2B9\uC778 \uACB0\uACFC \uC548\uB0B4</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                \uC548\uB155\uD558\uC138\uC694, <strong>${e}</strong>\uB2D8.
              </p>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                \uC8C4\uC1A1\uD558\uAC8C\uB3C4 \uD604\uC7AC \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790 \uC2B9\uC778\uC774 \uBCF4\uB958\uB418\uC5C8\uC2B5\uB2C8\uB2E4.
              </p>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <p style="margin: 0 0 10px; color: #1d1d1f; font-size: 14px;">
                  <strong>\uAC70\uBD80 \uC0AC\uC720</strong>
                </p>
                <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
                  ${s}
                </p>
              </div>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                \uC704 \uC0AC\uD56D\uC744 \uBCF4\uC644\uD558\uC2E0 \uD6C4 \uB2E4\uC2DC \uC2E0\uCCAD\uD574\uC8FC\uC2DC\uBA74 \uC7AC\uAC80\uD1A0\uD558\uACA0\uC2B5\uB2C8\uB2E4.
              </p>
              
              <p style="margin: 30px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                \uCD94\uAC00 \uBB38\uC758\uC0AC\uD56D\uC774 \uC788\uC73C\uC2DC\uBA74 \uC5B8\uC81C\uB4E0\uC9C0 \uC5F0\uB77D\uC8FC\uC138\uC694.<br>
                \uAC10\uC0AC\uD569\uB2C8\uB2E4.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                <strong>\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158</strong> | \uB77C\uC774\uBE0C \uCEE4\uBA38\uC2A4 \uD50C\uB7AB\uD3FC
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                \xA9 2026 \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
__name(eo, "eo");
__name2(eo, "eo");
var jt = Object.freeze(Object.defineProperty({ __proto__: null, getSellerApprovalEmailHTML: Za, getSellerRejectionEmailHTML: eo, sendEmail: Qa }, Symbol.toStringTag, { value: "Module" }));
async function so(e, s) {
  const { userId: t, type: r, title: a, message: o, linkUrl: n } = s;
  try {
    const i = await e.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(t, r, a, o, n || null).run();
    return console.log(`[Notification] Created for user ${t}: ${r} - ${a}`), { success: true, id: i.meta.last_row_id };
  } catch (i) {
    return console.error("[Notification] Failed to create:", i), { success: false, error: i.message };
  }
}
__name(so, "so");
__name2(so, "so");
var to = { seller_approved: /* @__PURE__ */ __name2((e) => ({ title: "\u{1F389} \uD310\uB9E4\uC790 \uC2B9\uC778 \uC644\uB8CC", message: `${e}\uB2D8, \uCD95\uD558\uD569\uB2C8\uB2E4! \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790\uB85C \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller" }), "seller_approved"), seller_rejected: /* @__PURE__ */ __name2((e) => ({ title: "\uD310\uB9E4\uC790 \uC2B9\uC778 \uAC70\uBD80", message: `\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uD310\uB9E4\uC790 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0AC\uC720: ${e}`, linkUrl: "/seller/register" }), "seller_rejected"), order_complete: /* @__PURE__ */ __name2((e) => ({ title: "\uC8FC\uBB38 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_complete"), order_shipped: /* @__PURE__ */ __name2((e) => ({ title: "\uBC30\uC1A1 \uC2DC\uC791", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC0C1\uD488\uC774 \uBC30\uC1A1 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_shipped"), order_delivered: /* @__PURE__ */ __name2((e) => ({ title: "\uBC30\uC1A1 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC0C1\uD488\uC774 \uBC30\uC1A1 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_delivered"), refund_requested: /* @__PURE__ */ __name2((e) => ({ title: "\uD658\uBD88 \uC694\uCCAD \uC811\uC218", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uD658\uBD88\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "refund_requested"), refund_complete: /* @__PURE__ */ __name2((e, s) => ({ title: "\uD658\uBD88 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uD658\uBD88(\u20A9${s.toLocaleString()})\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "refund_complete"), product_low_stock: /* @__PURE__ */ __name2((e, s) => ({ title: "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", message: `${e}\uC758 \uC7AC\uACE0\uAC00 ${s}\uAC1C \uB0A8\uC558\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller/products" }), "product_low_stock"), product_sold_out: /* @__PURE__ */ __name2((e) => ({ title: "\u274C \uD488\uC808 \uC54C\uB9BC", message: `${e}\uC774(\uAC00) \uD488\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller/products" }), "product_sold_out") };
var Lt = Object.freeze(Object.defineProperty({ __proto__: null, NotificationTemplates: to, createNotification: so }, Symbol.toStringTag, { value: "Module" }));
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
var middleware_insertion_facade_default = Xs;
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

// .wrangler/tmp/pages-qrQYFM/jatt5rd3vrg.js
var define_ROUTES_default = { version: 1, include: ["/*"], exclude: ["/_headers", "/_redirects", "/favicon.svg", "/lazy-loading-guide.html", "/my-orders.html", "/order-complete.html", "/privacy.html", "/refund.html", "/shipping-policy.html", "/static/*", "/terms-static.html", "/terms.html", "/test-login.html", "/version.json"] };
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

// .wrangler/tmp/bundle-RbK7FZ/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-RbK7FZ/middleware-loader.entry.ts
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
//# sourceMappingURL=jatt5rd3vrg.js.map
