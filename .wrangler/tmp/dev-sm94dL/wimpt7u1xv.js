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
  const fn2 = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn2, { __unenv__: true });
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
  bind(fn2) {
    return fn2;
  }
  runInAsyncScope(fn2, thisArg, ...args) {
    return fn2.call(thisArg, ...args);
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
  cursorTo(x2, y, callback) {
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

// .wrangler/tmp/pages-xDBVZE/bundledWorker-0.059398088614742495.mjs
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
  const fn2 = /* @__PURE__ */ __name2(() => {
    throw /* @__PURE__ */ createNotImplementedError2(name);
  }, "fn");
  return Object.assign(fn2, { __unenv__: true });
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
  bind(fn2) {
    return fn2;
  }
  runInAsyncScope(fn2, thisArg, ...args) {
    return fn2.call(thisArg, ...args);
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
  cursorTo(x2, y, callback) {
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
var Nr = Object.defineProperty;
var ut = /* @__PURE__ */ __name2((e) => {
  throw TypeError(e);
}, "ut");
var jr = /* @__PURE__ */ __name2((e, s, t) => s in e ? Nr(e, s, { enumerable: true, configurable: true, writable: true, value: t }) : e[s] = t, "jr");
var A = /* @__PURE__ */ __name2((e, s, t) => jr(e, typeof s != "symbol" ? s + "" : s, t), "A");
var $s = /* @__PURE__ */ __name2((e, s, t) => s.has(e) || ut("Cannot " + t), "$s");
var h = /* @__PURE__ */ __name2((e, s, t) => ($s(e, s, "read from private field"), t ? t.call(e) : s.get(e)), "h");
var D = /* @__PURE__ */ __name2((e, s, t) => s.has(e) ? ut("Cannot add the same private member more than once") : s instanceof WeakSet ? s.add(e) : s.set(e, t), "D");
var I = /* @__PURE__ */ __name2((e, s, t, r) => ($s(e, s, "write to private field"), r ? r.call(e, t) : s.set(e, t), t), "I");
var N = /* @__PURE__ */ __name2((e, s, t) => ($s(e, s, "access private method"), t), "N");
var dt = /* @__PURE__ */ __name2((e, s, t, r) => ({ set _(a) {
  I(e, s, a, t);
}, get _() {
  return h(e, s, r);
} }), "dt");
var pt = /* @__PURE__ */ __name2((e, s, t) => (r, a) => {
  let n = -1;
  return o(0);
  async function o(i) {
    if (i <= n) throw new Error("next() called multiple times");
    n = i;
    let c, l = false, u;
    if (e[i] ? (u = e[i][0][0], r.req.routeIndex = i) : u = i === e.length && a || void 0, u) try {
      c = await u(r, () => o(i + 1));
    } catch (d) {
      if (d instanceof Error && s) r.error = d, c = await s(d, r), l = true;
      else throw d;
    }
    else r.finalized === false && t && (c = await t(r));
    return c && (r.finalized === false || l) && (r.res = c), r;
  }
  __name(o, "o");
  __name2(o, "o");
}, "pt");
var Lr = /* @__PURE__ */ Symbol();
var Mr = /* @__PURE__ */ __name2(async (e, s = /* @__PURE__ */ Object.create(null)) => {
  const { all: t = false, dot: r = false } = s, n = (e instanceof Kt ? e.raw.headers : e.headers).get("Content-Type");
  return n != null && n.startsWith("multipart/form-data") || n != null && n.startsWith("application/x-www-form-urlencoded") ? $r(e, { all: t, dot: r }) : {};
}, "Mr");
async function $r(e, s) {
  const t = await e.formData();
  return t ? Fr(t, s) : {};
}
__name($r, "$r");
__name2($r, "$r");
function Fr(e, s) {
  const t = /* @__PURE__ */ Object.create(null);
  return e.forEach((r, a) => {
    s.all || a.endsWith("[]") ? Pr(t, a, r) : t[a] = r;
  }), s.dot && Object.entries(t).forEach(([r, a]) => {
    r.includes(".") && (Ur(t, r, a), delete t[r]);
  }), t;
}
__name(Fr, "Fr");
__name2(Fr, "Fr");
var Pr = /* @__PURE__ */ __name2((e, s, t) => {
  e[s] !== void 0 ? Array.isArray(e[s]) ? e[s].push(t) : e[s] = [e[s], t] : s.endsWith("[]") ? e[s] = [t] : e[s] = t;
}, "Pr");
var Ur = /* @__PURE__ */ __name2((e, s, t) => {
  let r = e;
  const a = s.split(".");
  a.forEach((n, o) => {
    o === a.length - 1 ? r[n] = t : ((!r[n] || typeof r[n] != "object" || Array.isArray(r[n]) || r[n] instanceof File) && (r[n] = /* @__PURE__ */ Object.create(null)), r = r[n]);
  });
}, "Ur");
var Ut = /* @__PURE__ */ __name2((e) => {
  const s = e.split("/");
  return s[0] === "" && s.shift(), s;
}, "Ut");
var xr = /* @__PURE__ */ __name2((e) => {
  const { groups: s, path: t } = Wr(e), r = Ut(t);
  return qr(r, s);
}, "xr");
var Wr = /* @__PURE__ */ __name2((e) => {
  const s = [];
  return e = e.replace(/\{[^}]+\}/g, (t, r) => {
    const a = `@${r}`;
    return s.push([a, t]), a;
  }), { groups: s, path: e };
}, "Wr");
var qr = /* @__PURE__ */ __name2((e, s) => {
  for (let t = s.length - 1; t >= 0; t--) {
    const [r] = s[t];
    for (let a = e.length - 1; a >= 0; a--) if (e[a].includes(r)) {
      e[a] = e[a].replace(r, s[t][1]);
      break;
    }
  }
  return e;
}, "qr");
var bs = {};
var Hr = /* @__PURE__ */ __name2((e, s) => {
  if (e === "*") return "*";
  const t = e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (t) {
    const r = `${e}#${s}`;
    return bs[r] || (t[2] ? bs[r] = s && s[0] !== ":" && s[0] !== "*" ? [r, t[1], new RegExp(`^${t[2]}(?=/${s})`)] : [e, t[1], new RegExp(`^${t[2]}$`)] : bs[r] = [e, t[1], true]), bs[r];
  }
  return null;
}, "Hr");
var Gs = /* @__PURE__ */ __name2((e, s) => {
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
}, "Gs");
var Kr = /* @__PURE__ */ __name2((e) => Gs(e, decodeURI), "Kr");
var xt = /* @__PURE__ */ __name2((e) => {
  const s = e.url, t = s.indexOf("/", s.indexOf(":") + 4);
  let r = t;
  for (; r < s.length; r++) {
    const a = s.charCodeAt(r);
    if (a === 37) {
      const n = s.indexOf("?", r), o = s.indexOf("#", r), i = n === -1 ? o === -1 ? void 0 : o : o === -1 ? n : Math.min(n, o), c = s.slice(t, i);
      return Kr(c.includes("%25") ? c.replace(/%25/g, "%2525") : c);
    } else if (a === 63 || a === 35) break;
  }
  return s.slice(t, r);
}, "xt");
var Br = /* @__PURE__ */ __name2((e) => {
  const s = xt(e);
  return s.length > 1 && s.at(-1) === "/" ? s.slice(0, -1) : s;
}, "Br");
var He = /* @__PURE__ */ __name2((e, s, ...t) => (t.length && (s = He(s, ...t)), `${(e == null ? void 0 : e[0]) === "/" ? "" : "/"}${e}${s === "/" ? "" : `${(e == null ? void 0 : e.at(-1)) === "/" ? "" : "/"}${(s == null ? void 0 : s[0]) === "/" ? s.slice(1) : s}`}`), "He");
var Wt = /* @__PURE__ */ __name2((e) => {
  if (e.charCodeAt(e.length - 1) !== 63 || !e.includes(":")) return null;
  const s = e.split("/"), t = [];
  let r = "";
  return s.forEach((a) => {
    if (a !== "" && !/\:/.test(a)) r += "/" + a;
    else if (/\:/.test(a)) if (/\?/.test(a)) {
      t.length === 0 && r === "" ? t.push("/") : t.push(r);
      const n = a.replace("?", "");
      r += "/" + n, t.push(r);
    } else r += "/" + a;
  }), t.filter((a, n, o) => o.indexOf(a) === n);
}, "Wt");
var Fs = /* @__PURE__ */ __name2((e) => /[%+]/.test(e) ? (e.indexOf("+") !== -1 && (e = e.replace(/\+/g, " ")), e.indexOf("%") !== -1 ? Gs(e, Ht) : e) : e, "Fs");
var qt = /* @__PURE__ */ __name2((e, s, t) => {
  let r;
  if (!t && s && !/[%+]/.test(s)) {
    let o = e.indexOf("?", 8);
    if (o === -1) return;
    for (e.startsWith(s, o + 1) || (o = e.indexOf(`&${s}`, o + 1)); o !== -1; ) {
      const i = e.charCodeAt(o + s.length + 1);
      if (i === 61) {
        const c = o + s.length + 2, l = e.indexOf("&", c);
        return Fs(e.slice(c, l === -1 ? void 0 : l));
      } else if (i == 38 || isNaN(i)) return "";
      o = e.indexOf(`&${s}`, o + 1);
    }
    if (r = /[%+]/.test(e), !r) return;
  }
  const a = {};
  r ?? (r = /[%+]/.test(e));
  let n = e.indexOf("?", 8);
  for (; n !== -1; ) {
    const o = e.indexOf("&", n + 1);
    let i = e.indexOf("=", n);
    i > o && o !== -1 && (i = -1);
    let c = e.slice(n + 1, i === -1 ? o === -1 ? void 0 : o : i);
    if (r && (c = Fs(c)), n = o, c === "") continue;
    let l;
    i === -1 ? l = "" : (l = e.slice(i + 1, o === -1 ? void 0 : o), r && (l = Fs(l))), t ? (a[c] && Array.isArray(a[c]) || (a[c] = []), a[c].push(l)) : a[c] ?? (a[c] = l);
  }
  return s ? a[s] : a;
}, "qt");
var Jr = qt;
var Vr = /* @__PURE__ */ __name2((e, s) => qt(e, s, true), "Vr");
var Ht = decodeURIComponent;
var mt = /* @__PURE__ */ __name2((e) => Gs(e, Ht), "mt");
var Ve;
var re;
var ye;
var Bt;
var Jt;
var Bs;
var we;
var Nt;
var Kt = (Nt = class {
  static {
    __name(this, "Nt");
  }
  static {
    __name2(this, "Nt");
  }
  constructor(e, s = "/", t = [[]]) {
    D(this, ye);
    A(this, "raw");
    D(this, Ve);
    D(this, re);
    A(this, "routeIndex", 0);
    A(this, "path");
    A(this, "bodyCache", {});
    D(this, we, (e2) => {
      const { bodyCache: s2, raw: t2 } = this, r = s2[e2];
      if (r) return r;
      const a = Object.keys(s2)[0];
      return a ? s2[a].then((n) => (a === "json" && (n = JSON.stringify(n)), new Response(n)[e2]())) : s2[e2] = t2[e2]();
    });
    this.raw = e, this.path = s, I(this, re, t), I(this, Ve, {});
  }
  param(e) {
    return e ? N(this, ye, Bt).call(this, e) : N(this, ye, Jt).call(this);
  }
  query(e) {
    return Jr(this.url, e);
  }
  queries(e) {
    return Vr(this.url, e);
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
    return (s = this.bodyCache).parsedBody ?? (s.parsedBody = await Mr(this, e));
  }
  json() {
    return h(this, we).call(this, "text").then((e) => JSON.parse(e));
  }
  text() {
    return h(this, we).call(this, "text");
  }
  arrayBuffer() {
    return h(this, we).call(this, "arrayBuffer");
  }
  blob() {
    return h(this, we).call(this, "blob");
  }
  formData() {
    return h(this, we).call(this, "formData");
  }
  addValidatedData(e, s) {
    h(this, Ve)[e] = s;
  }
  valid(e) {
    return h(this, Ve)[e];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [Lr]() {
    return h(this, re);
  }
  get matchedRoutes() {
    return h(this, re)[0].map(([[, e]]) => e);
  }
  get routePath() {
    return h(this, re)[0].map(([[, e]]) => e)[this.routeIndex].path;
  }
}, Ve = /* @__PURE__ */ new WeakMap(), re = /* @__PURE__ */ new WeakMap(), ye = /* @__PURE__ */ new WeakSet(), Bt = /* @__PURE__ */ __name2(function(e) {
  const s = h(this, re)[0][this.routeIndex][1][e], t = N(this, ye, Bs).call(this, s);
  return t && /\%/.test(t) ? mt(t) : t;
}, "Bt"), Jt = /* @__PURE__ */ __name2(function() {
  const e = {}, s = Object.keys(h(this, re)[0][this.routeIndex][1]);
  for (const t of s) {
    const r = N(this, ye, Bs).call(this, h(this, re)[0][this.routeIndex][1][t]);
    r !== void 0 && (e[t] = /\%/.test(r) ? mt(r) : r);
  }
  return e;
}, "Jt"), Bs = /* @__PURE__ */ __name2(function(e) {
  return h(this, re)[1] ? h(this, re)[1][e] : e;
}, "Bs"), we = /* @__PURE__ */ new WeakMap(), Nt);
var Yr = { Stringify: 1 };
var Vt = /* @__PURE__ */ __name2(async (e, s, t, r, a) => {
  typeof e == "object" && !(e instanceof String) && (e instanceof Promise || (e = e.toString()), e instanceof Promise && (e = await e));
  const n = e.callbacks;
  return n != null && n.length ? (a ? a[0] += e : a = [e], Promise.all(n.map((i) => i({ phase: s, buffer: a, context: r }))).then((i) => Promise.all(i.filter(Boolean).map((c) => Vt(c, s, false, r, a))).then(() => a[0]))) : Promise.resolve(e);
}, "Vt");
var zr = "text/plain; charset=UTF-8";
var Ps = /* @__PURE__ */ __name2((e, s) => ({ "Content-Type": e, ...s }), "Ps");
var Ue = /* @__PURE__ */ __name2((e, s) => new Response(e, s), "Ue");
var ps;
var ms;
var fe;
var Ye;
var he;
var ee;
var _s;
var ze;
var Ge;
var De;
var fs;
var hs;
var ue;
var Ke;
var Js;
var jt;
var Gr = (jt = class {
  static {
    __name(this, "jt");
  }
  static {
    __name2(this, "jt");
  }
  constructor(e, s) {
    D(this, ue);
    D(this, ps);
    D(this, ms);
    A(this, "env", {});
    D(this, fe);
    A(this, "finalized", false);
    A(this, "error");
    D(this, Ye);
    D(this, he);
    D(this, ee);
    D(this, _s);
    D(this, ze);
    D(this, Ge);
    D(this, De);
    D(this, fs);
    D(this, hs);
    A(this, "render", (...e2) => (h(this, ze) ?? I(this, ze, (s2) => this.html(s2)), h(this, ze).call(this, ...e2)));
    A(this, "setLayout", (e2) => I(this, _s, e2));
    A(this, "getLayout", () => h(this, _s));
    A(this, "setRenderer", (e2) => {
      I(this, ze, e2);
    });
    A(this, "header", (e2, s2, t) => {
      this.finalized && I(this, ee, Ue(h(this, ee).body, h(this, ee)));
      const r = h(this, ee) ? h(this, ee).headers : h(this, De) ?? I(this, De, new Headers());
      s2 === void 0 ? r.delete(e2) : t != null && t.append ? r.append(e2, s2) : r.set(e2, s2);
    });
    A(this, "status", (e2) => {
      I(this, Ye, e2);
    });
    A(this, "set", (e2, s2) => {
      h(this, fe) ?? I(this, fe, /* @__PURE__ */ new Map()), h(this, fe).set(e2, s2);
    });
    A(this, "get", (e2) => h(this, fe) ? h(this, fe).get(e2) : void 0);
    A(this, "newResponse", (...e2) => N(this, ue, Ke).call(this, ...e2));
    A(this, "body", (e2, s2, t) => N(this, ue, Ke).call(this, e2, s2, t));
    A(this, "text", (e2, s2, t) => N(this, ue, Js).call(this) && !s2 && !t ? Ue(e2) : N(this, ue, Ke).call(this, e2, s2, Ps(zr, t)));
    A(this, "json", (e2, s2, t) => N(this, ue, Js).call(this) && !s2 && !t ? Response.json(e2) : N(this, ue, Ke).call(this, JSON.stringify(e2), s2, Ps("application/json", t)));
    A(this, "html", (e2, s2, t) => {
      const r = /* @__PURE__ */ __name2((a) => N(this, ue, Ke).call(this, a, s2, Ps("text/html; charset=UTF-8", t)), "r");
      return typeof e2 == "object" ? Vt(e2, Yr.Stringify, false, {}).then(r) : r(e2);
    });
    A(this, "redirect", (e2, s2) => {
      const t = String(e2);
      return this.header("Location", /[^\x00-\xFF]/.test(t) ? encodeURI(t) : t), this.newResponse(null, s2 ?? 302);
    });
    A(this, "notFound", () => (h(this, Ge) ?? I(this, Ge, () => Ue()), h(this, Ge).call(this, this)));
    I(this, ps, e), s && (I(this, he, s.executionCtx), this.env = s.env, I(this, Ge, s.notFoundHandler), I(this, hs, s.path), I(this, fs, s.matchResult));
  }
  get req() {
    return h(this, ms) ?? I(this, ms, new Kt(h(this, ps), h(this, hs), h(this, fs))), h(this, ms);
  }
  get event() {
    if (h(this, he) && "respondWith" in h(this, he)) return h(this, he);
    throw Error("This context has no FetchEvent");
  }
  get executionCtx() {
    if (h(this, he)) return h(this, he);
    throw Error("This context has no ExecutionContext");
  }
  get res() {
    return h(this, ee) || I(this, ee, Ue(null, { headers: h(this, De) ?? I(this, De, new Headers()) }));
  }
  set res(e) {
    if (h(this, ee) && e) {
      e = Ue(e.body, e);
      for (const [s, t] of h(this, ee).headers.entries()) if (s !== "content-type") if (s === "set-cookie") {
        const r = h(this, ee).headers.getSetCookie();
        e.headers.delete("set-cookie");
        for (const a of r) e.headers.append("set-cookie", a);
      } else e.headers.set(s, t);
    }
    I(this, ee, e), this.finalized = true;
  }
  get var() {
    return h(this, fe) ? Object.fromEntries(h(this, fe)) : {};
  }
}, ps = /* @__PURE__ */ new WeakMap(), ms = /* @__PURE__ */ new WeakMap(), fe = /* @__PURE__ */ new WeakMap(), Ye = /* @__PURE__ */ new WeakMap(), he = /* @__PURE__ */ new WeakMap(), ee = /* @__PURE__ */ new WeakMap(), _s = /* @__PURE__ */ new WeakMap(), ze = /* @__PURE__ */ new WeakMap(), Ge = /* @__PURE__ */ new WeakMap(), De = /* @__PURE__ */ new WeakMap(), fs = /* @__PURE__ */ new WeakMap(), hs = /* @__PURE__ */ new WeakMap(), ue = /* @__PURE__ */ new WeakSet(), Ke = /* @__PURE__ */ __name2(function(e, s, t) {
  const r = h(this, ee) ? new Headers(h(this, ee).headers) : h(this, De) ?? new Headers();
  if (typeof s == "object" && "headers" in s) {
    const n = s.headers instanceof Headers ? s.headers : new Headers(s.headers);
    for (const [o, i] of n) o.toLowerCase() === "set-cookie" ? r.append(o, i) : r.set(o, i);
  }
  if (t) for (const [n, o] of Object.entries(t)) if (typeof o == "string") r.set(n, o);
  else {
    r.delete(n);
    for (const i of o) r.append(n, i);
  }
  const a = typeof s == "number" ? s : (s == null ? void 0 : s.status) ?? h(this, Ye);
  return Ue(e, { status: a, headers: r });
}, "Ke"), Js = /* @__PURE__ */ __name2(function() {
  return !h(this, De) && !h(this, Ye) && !this.finalized;
}, "Js"), jt);
var K = "ALL";
var Xr = "all";
var Qr = ["get", "post", "put", "delete", "options", "patch"];
var Yt = "Can not add a route since the matcher is already built.";
var zt = class extends Error {
  static {
    __name(this, "zt");
  }
  static {
    __name2(this, "zt");
  }
};
var Zr = "__COMPOSED_HANDLER";
var ea = /* @__PURE__ */ __name2((e) => e.text("404 Not Found", 404), "ea");
var _t = /* @__PURE__ */ __name2((e, s) => {
  if ("getResponse" in e) {
    const t = e.getResponse();
    return s.newResponse(t.body, t);
  }
  return console.error(e), s.text("Internal Server Error", 500);
}, "_t");
var ie;
var B;
var Gt;
var ce;
var Ae;
var Rs;
var Is;
var Xe;
var sa = (Xe = class {
  static {
    __name(this, "Xe");
  }
  static {
    __name2(this, "Xe");
  }
  constructor(s = {}) {
    D(this, B);
    A(this, "get");
    A(this, "post");
    A(this, "put");
    A(this, "delete");
    A(this, "options");
    A(this, "patch");
    A(this, "all");
    A(this, "on");
    A(this, "use");
    A(this, "router");
    A(this, "getPath");
    A(this, "_basePath", "/");
    D(this, ie, "/");
    A(this, "routes", []);
    D(this, ce, ea);
    A(this, "errorHandler", _t);
    A(this, "onError", (s2) => (this.errorHandler = s2, this));
    A(this, "notFound", (s2) => (I(this, ce, s2), this));
    A(this, "fetch", (s2, ...t) => N(this, B, Is).call(this, s2, t[1], t[0], s2.method));
    A(this, "request", (s2, t, r2, a2) => s2 instanceof Request ? this.fetch(t ? new Request(s2, t) : s2, r2, a2) : (s2 = s2.toString(), this.fetch(new Request(/^https?:\/\//.test(s2) ? s2 : `http://localhost${He("/", s2)}`, t), r2, a2)));
    A(this, "fire", () => {
      addEventListener("fetch", (s2) => {
        s2.respondWith(N(this, B, Is).call(this, s2.request, s2, void 0, s2.request.method));
      });
    });
    [...Qr, Xr].forEach((n) => {
      this[n] = (o, ...i) => (typeof o == "string" ? I(this, ie, o) : N(this, B, Ae).call(this, n, h(this, ie), o), i.forEach((c) => {
        N(this, B, Ae).call(this, n, h(this, ie), c);
      }), this);
    }), this.on = (n, o, ...i) => {
      for (const c of [o].flat()) {
        I(this, ie, c);
        for (const l of [n].flat()) i.map((u) => {
          N(this, B, Ae).call(this, l.toUpperCase(), h(this, ie), u);
        });
      }
      return this;
    }, this.use = (n, ...o) => (typeof n == "string" ? I(this, ie, n) : (I(this, ie, "*"), o.unshift(n)), o.forEach((i) => {
      N(this, B, Ae).call(this, K, h(this, ie), i);
    }), this);
    const { strict: r, ...a } = s;
    Object.assign(this, a), this.getPath = r ?? true ? s.getPath ?? xt : Br;
  }
  route(s, t) {
    const r = this.basePath(s);
    return t.routes.map((a) => {
      var o;
      let n;
      t.errorHandler === _t ? n = a.handler : (n = /* @__PURE__ */ __name2(async (i, c) => (await pt([], t.errorHandler)(i, () => a.handler(i, c))).res, "n"), n[Zr] = a.handler), N(o = r, B, Ae).call(o, a.method, a.path, n);
    }), this;
  }
  basePath(s) {
    const t = N(this, B, Gt).call(this);
    return t._basePath = He(this._basePath, s), t;
  }
  mount(s, t, r) {
    let a, n;
    r && (typeof r == "function" ? n = r : (n = r.optionHandler, r.replaceRequest === false ? a = /* @__PURE__ */ __name2((c) => c, "a") : a = r.replaceRequest));
    const o = n ? (c) => {
      const l = n(c);
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
      const c = He(this._basePath, s), l = c === "/" ? 0 : c.length;
      return (u) => {
        const d = new URL(u.url);
        return d.pathname = d.pathname.slice(l) || "/", new Request(d, u);
      };
    })());
    const i = /* @__PURE__ */ __name2(async (c, l) => {
      const u = await t(a(c.req.raw), ...o(c));
      if (u) return u;
      await l();
    }, "i");
    return N(this, B, Ae).call(this, K, He(s, "*"), i), this;
  }
}, ie = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new WeakSet(), Gt = /* @__PURE__ */ __name2(function() {
  const s = new Xe({ router: this.router, getPath: this.getPath });
  return s.errorHandler = this.errorHandler, I(s, ce, h(this, ce)), s.routes = this.routes, s;
}, "Gt"), ce = /* @__PURE__ */ new WeakMap(), Ae = /* @__PURE__ */ __name2(function(s, t, r) {
  s = s.toUpperCase(), t = He(this._basePath, t);
  const a = { basePath: this._basePath, path: t, method: s, handler: r };
  this.router.add(s, t, [r, a]), this.routes.push(a);
}, "Ae"), Rs = /* @__PURE__ */ __name2(function(s, t) {
  if (s instanceof Error) return this.errorHandler(s, t);
  throw s;
}, "Rs"), Is = /* @__PURE__ */ __name2(function(s, t, r, a) {
  if (a === "HEAD") return (async () => new Response(null, await N(this, B, Is).call(this, s, t, r, "GET")))();
  const n = this.getPath(s, { env: r }), o = this.router.match(a, n), i = new Gr(s, { path: n, matchResult: o, env: r, executionCtx: t, notFoundHandler: h(this, ce) });
  if (o[0].length === 1) {
    let l;
    try {
      l = o[0][0][0][0](i, async () => {
        i.res = await h(this, ce).call(this, i);
      });
    } catch (u) {
      return N(this, B, Rs).call(this, u, i);
    }
    return l instanceof Promise ? l.then((u) => u || (i.finalized ? i.res : h(this, ce).call(this, i))).catch((u) => N(this, B, Rs).call(this, u, i)) : l ?? h(this, ce).call(this, i);
  }
  const c = pt(o[0], this.errorHandler, h(this, ce));
  return (async () => {
    try {
      const l = await c(i);
      if (!l.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
      return l.res;
    } catch (l) {
      return N(this, B, Rs).call(this, l, i);
    }
  })();
}, "Is"), Xe);
var Xt = [];
function ta(e, s) {
  const t = this.buildAllMatchers(), r = /* @__PURE__ */ __name2(((a, n) => {
    const o = t[a] || t[K], i = o[2][n];
    if (i) return i;
    const c = n.match(o[0]);
    if (!c) return [[], Xt];
    const l = c.indexOf("", 1);
    return [o[1][l], c];
  }), "r");
  return this.match = r, r(e, s);
}
__name(ta, "ta");
__name2(ta, "ta");
var As = "[^/]+";
var ls = ".*";
var us = "(?:|/.*)";
var Be = /* @__PURE__ */ Symbol();
var ra = new Set(".\\+*[^]$()");
function aa(e, s) {
  return e.length === 1 ? s.length === 1 ? e < s ? -1 : 1 : -1 : s.length === 1 || e === ls || e === us ? 1 : s === ls || s === us ? -1 : e === As ? 1 : s === As ? -1 : e.length === s.length ? e < s ? -1 : 1 : s.length - e.length;
}
__name(aa, "aa");
__name2(aa, "aa");
var ke;
var Ce;
var le;
var Me;
var na = (Me = class {
  static {
    __name(this, "Me");
  }
  static {
    __name2(this, "Me");
  }
  constructor() {
    D(this, ke);
    D(this, Ce);
    D(this, le, /* @__PURE__ */ Object.create(null));
  }
  insert(s, t, r, a, n) {
    if (s.length === 0) {
      if (h(this, ke) !== void 0) throw Be;
      if (n) return;
      I(this, ke, t);
      return;
    }
    const [o, ...i] = s, c = o === "*" ? i.length === 0 ? ["", "", ls] : ["", "", As] : o === "/*" ? ["", "", us] : o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let l;
    if (c) {
      const u = c[1];
      let d = c[2] || As;
      if (u && c[2] && (d === ".*" || (d = d.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:"), /\((?!\?:)/.test(d)))) throw Be;
      if (l = h(this, le)[d], !l) {
        if (Object.keys(h(this, le)).some((m) => m !== ls && m !== us)) throw Be;
        if (n) return;
        l = h(this, le)[d] = new Me(), u !== "" && I(l, Ce, a.varIndex++);
      }
      !n && u !== "" && r.push([u, h(l, Ce)]);
    } else if (l = h(this, le)[o], !l) {
      if (Object.keys(h(this, le)).some((u) => u.length > 1 && u !== ls && u !== us)) throw Be;
      if (n) return;
      l = h(this, le)[o] = new Me();
    }
    l.insert(i, t, r, a, n);
  }
  buildRegExpStr() {
    const t = Object.keys(h(this, le)).sort(aa).map((r) => {
      const a = h(this, le)[r];
      return (typeof h(a, Ce) == "number" ? `(${r})@${h(a, Ce)}` : ra.has(r) ? `\\${r}` : r) + a.buildRegExpStr();
    });
    return typeof h(this, ke) == "number" && t.unshift(`#${h(this, ke)}`), t.length === 0 ? "" : t.length === 1 ? t[0] : "(?:" + t.join("|") + ")";
  }
}, ke = /* @__PURE__ */ new WeakMap(), Ce = /* @__PURE__ */ new WeakMap(), le = /* @__PURE__ */ new WeakMap(), Me);
var Cs;
var Es;
var Lt;
var oa = (Lt = class {
  static {
    __name(this, "Lt");
  }
  static {
    __name2(this, "Lt");
  }
  constructor() {
    D(this, Cs, { varIndex: 0 });
    D(this, Es, new na());
  }
  insert(e, s, t) {
    const r = [], a = [];
    for (let o = 0; ; ) {
      let i = false;
      if (e = e.replace(/\{[^}]+\}/g, (c) => {
        const l = `@\\${o}`;
        return a[o] = [l, c], o++, i = true, l;
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
    return h(this, Es).insert(n, s, r, h(this, Cs), t), r;
  }
  buildRegExp() {
    let e = h(this, Es).buildRegExpStr();
    if (e === "") return [/^$/, [], []];
    let s = 0;
    const t = [], r = [];
    return e = e.replace(/#(\d+)|@(\d+)|\.\*\$/g, (a, n, o) => n !== void 0 ? (t[++s] = Number(n), "$()") : (o !== void 0 && (r[Number(o)] = ++s), "")), [new RegExp(`^${e}`), t, r];
  }
}, Cs = /* @__PURE__ */ new WeakMap(), Es = /* @__PURE__ */ new WeakMap(), Lt);
var ia = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var vs = /* @__PURE__ */ Object.create(null);
function Qt(e) {
  return vs[e] ?? (vs[e] = new RegExp(e === "*" ? "" : `^${e.replace(/\/\*$|([.\\+*[^\]$()])/g, (s, t) => t ? `\\${t}` : "(?:|/.*)")}$`));
}
__name(Qt, "Qt");
__name2(Qt, "Qt");
function ca() {
  vs = /* @__PURE__ */ Object.create(null);
}
__name(ca, "ca");
__name2(ca, "ca");
function la(e) {
  var l;
  const s = new oa(), t = [];
  if (e.length === 0) return ia;
  const r = e.map((u) => [!/\*|\/:/.test(u[0]), ...u]).sort(([u, d], [m, _]) => u ? 1 : m ? -1 : d.length - _.length), a = /* @__PURE__ */ Object.create(null);
  for (let u = 0, d = -1, m = r.length; u < m; u++) {
    const [_, f, E] = r[u];
    _ ? a[f] = [E.map(([w]) => [w, /* @__PURE__ */ Object.create(null)]), Xt] : d++;
    let b;
    try {
      b = s.insert(f, d, _);
    } catch (w) {
      throw w === Be ? new zt(f) : w;
    }
    _ || (t[d] = E.map(([w, g]) => {
      const T = /* @__PURE__ */ Object.create(null);
      for (g -= 1; g >= 0; g--) {
        const [y, R] = b[g];
        T[y] = R;
      }
      return [w, T];
    }));
  }
  const [n, o, i] = s.buildRegExp();
  for (let u = 0, d = t.length; u < d; u++) for (let m = 0, _ = t[u].length; m < _; m++) {
    const f = (l = t[u][m]) == null ? void 0 : l[1];
    if (!f) continue;
    const E = Object.keys(f);
    for (let b = 0, w = E.length; b < w; b++) f[E[b]] = i[f[E[b]]];
  }
  const c = [];
  for (const u in o) c[u] = t[o[u]];
  return [n, c, a];
}
__name(la, "la");
__name2(la, "la");
function xe(e, s) {
  if (e) {
    for (const t of Object.keys(e).sort((r, a) => a.length - r.length)) if (Qt(t).test(s)) return [...e[t]];
  }
}
__name(xe, "xe");
__name2(xe, "xe");
var be;
var Se;
var Ns;
var Zt;
var Mt;
var ua = (Mt = class {
  static {
    __name(this, "Mt");
  }
  static {
    __name2(this, "Mt");
  }
  constructor() {
    D(this, Ns);
    A(this, "name", "RegExpRouter");
    D(this, be);
    D(this, Se);
    A(this, "match", ta);
    I(this, be, { [K]: /* @__PURE__ */ Object.create(null) }), I(this, Se, { [K]: /* @__PURE__ */ Object.create(null) });
  }
  add(e, s, t) {
    var i;
    const r = h(this, be), a = h(this, Se);
    if (!r || !a) throw new Error(Yt);
    r[e] || [r, a].forEach((c) => {
      c[e] = /* @__PURE__ */ Object.create(null), Object.keys(c[K]).forEach((l) => {
        c[e][l] = [...c[K][l]];
      });
    }), s === "/*" && (s = "*");
    const n = (s.match(/\/:/g) || []).length;
    if (/\*$/.test(s)) {
      const c = Qt(s);
      e === K ? Object.keys(r).forEach((l) => {
        var u;
        (u = r[l])[s] || (u[s] = xe(r[l], s) || xe(r[K], s) || []);
      }) : (i = r[e])[s] || (i[s] = xe(r[e], s) || xe(r[K], s) || []), Object.keys(r).forEach((l) => {
        (e === K || e === l) && Object.keys(r[l]).forEach((u) => {
          c.test(u) && r[l][u].push([t, n]);
        });
      }), Object.keys(a).forEach((l) => {
        (e === K || e === l) && Object.keys(a[l]).forEach((u) => c.test(u) && a[l][u].push([t, n]));
      });
      return;
    }
    const o = Wt(s) || [s];
    for (let c = 0, l = o.length; c < l; c++) {
      const u = o[c];
      Object.keys(a).forEach((d) => {
        var m;
        (e === K || e === d) && ((m = a[d])[u] || (m[u] = [...xe(r[d], u) || xe(r[K], u) || []]), a[d][u].push([t, n - l + c + 1]));
      });
    }
  }
  buildAllMatchers() {
    const e = /* @__PURE__ */ Object.create(null);
    return Object.keys(h(this, Se)).concat(Object.keys(h(this, be))).forEach((s) => {
      e[s] || (e[s] = N(this, Ns, Zt).call(this, s));
    }), I(this, be, I(this, Se, void 0)), ca(), e;
  }
}, be = /* @__PURE__ */ new WeakMap(), Se = /* @__PURE__ */ new WeakMap(), Ns = /* @__PURE__ */ new WeakSet(), Zt = /* @__PURE__ */ __name2(function(e) {
  const s = [];
  let t = e === K;
  return [h(this, be), h(this, Se)].forEach((r) => {
    const a = r[e] ? Object.keys(r[e]).map((n) => [n, r[e][n]]) : [];
    a.length !== 0 ? (t || (t = true), s.push(...a)) : e !== K && s.push(...Object.keys(r[K]).map((n) => [n, r[K][n]]));
  }), t ? la(s) : null;
}, "Zt"), Mt);
var Te;
var Ee;
var $t;
var da = ($t = class {
  static {
    __name(this, "$t");
  }
  static {
    __name2(this, "$t");
  }
  constructor(e) {
    A(this, "name", "SmartRouter");
    D(this, Te, []);
    D(this, Ee, []);
    I(this, Te, e.routers);
  }
  add(e, s, t) {
    if (!h(this, Ee)) throw new Error(Yt);
    h(this, Ee).push([e, s, t]);
  }
  match(e, s) {
    if (!h(this, Ee)) throw new Error("Fatal error");
    const t = h(this, Te), r = h(this, Ee), a = t.length;
    let n = 0, o;
    for (; n < a; n++) {
      const i = t[n];
      try {
        for (let c = 0, l = r.length; c < l; c++) i.add(...r[c]);
        o = i.match(e, s);
      } catch (c) {
        if (c instanceof zt) continue;
        throw c;
      }
      this.match = i.match.bind(i), I(this, Te, [i]), I(this, Ee, void 0);
      break;
    }
    if (n === a) throw new Error("Fatal error");
    return this.name = `SmartRouter + ${this.activeRouter.name}`, o;
  }
  get activeRouter() {
    if (h(this, Ee) || h(this, Te).length !== 1) throw new Error("No active router has been determined yet.");
    return h(this, Te)[0];
  }
}, Te = /* @__PURE__ */ new WeakMap(), Ee = /* @__PURE__ */ new WeakMap(), $t);
var ns = /* @__PURE__ */ Object.create(null);
var pa = /* @__PURE__ */ __name2((e) => {
  for (const s in e) return true;
  return false;
}, "pa");
var Re;
var Z;
var Ne;
var Qe;
var G;
var ge;
var Oe;
var Ze;
var ma = (Ze = class {
  static {
    __name(this, "Ze");
  }
  static {
    __name2(this, "Ze");
  }
  constructor(s, t, r) {
    D(this, ge);
    D(this, Re);
    D(this, Z);
    D(this, Ne);
    D(this, Qe, 0);
    D(this, G, ns);
    if (I(this, Z, r || /* @__PURE__ */ Object.create(null)), I(this, Re, []), s && t) {
      const a = /* @__PURE__ */ Object.create(null);
      a[s] = { handler: t, possibleKeys: [], score: 0 }, I(this, Re, [a]);
    }
    I(this, Ne, []);
  }
  insert(s, t, r) {
    I(this, Qe, ++dt(this, Qe)._);
    let a = this;
    const n = xr(t), o = [];
    for (let i = 0, c = n.length; i < c; i++) {
      const l = n[i], u = n[i + 1], d = Hr(l, u), m = Array.isArray(d) ? d[0] : l;
      if (m in h(a, Z)) {
        a = h(a, Z)[m], d && o.push(d[1]);
        continue;
      }
      h(a, Z)[m] = new Ze(), d && (h(a, Ne).push(d), o.push(d[1])), a = h(a, Z)[m];
    }
    return h(a, Re).push({ [s]: { handler: r, possibleKeys: o.filter((i, c, l) => l.indexOf(i) === c), score: h(this, Qe) } }), a;
  }
  search(s, t) {
    var u;
    const r = [];
    I(this, G, ns);
    let n = [this];
    const o = Ut(t), i = [], c = o.length;
    let l = null;
    for (let d = 0; d < c; d++) {
      const m = o[d], _ = d === c - 1, f = [];
      for (let b = 0, w = n.length; b < w; b++) {
        const g = n[b], T = h(g, Z)[m];
        T && (I(T, G, h(g, G)), _ ? (h(T, Z)["*"] && N(this, ge, Oe).call(this, r, h(T, Z)["*"], s, h(g, G)), N(this, ge, Oe).call(this, r, T, s, h(g, G))) : f.push(T));
        for (let y = 0, R = h(g, Ne).length; y < R; y++) {
          const $ = h(g, Ne)[y], k = h(g, G) === ns ? {} : { ...h(g, G) };
          if ($ === "*") {
            const F = h(g, Z)["*"];
            F && (N(this, ge, Oe).call(this, r, F, s, h(g, G)), I(F, G, k), f.push(F));
            continue;
          }
          const [O, W, P] = $;
          if (!m && !(P instanceof RegExp)) continue;
          const L = h(g, Z)[O];
          if (P instanceof RegExp) {
            if (l === null) {
              l = new Array(c);
              let Y = t[0] === "/" ? 1 : 0;
              for (let v = 0; v < c; v++) l[v] = Y, Y += o[v].length + 1;
            }
            const F = t.substring(l[d]), Q = P.exec(F);
            if (Q) {
              if (k[W] = Q[0], N(this, ge, Oe).call(this, r, L, s, h(g, G), k), pa(h(L, Z))) {
                I(L, G, k);
                const Y = ((u = Q[0].match(/\//)) == null ? void 0 : u.length) ?? 0;
                (i[Y] || (i[Y] = [])).push(L);
              }
              continue;
            }
          }
          (P === true || P.test(m)) && (k[W] = m, _ ? (N(this, ge, Oe).call(this, r, L, s, k, h(g, G)), h(L, Z)["*"] && N(this, ge, Oe).call(this, r, h(L, Z)["*"], s, k, h(g, G))) : (I(L, G, k), f.push(L)));
        }
      }
      const E = i.shift();
      n = E ? f.concat(E) : f;
    }
    return r.length > 1 && r.sort((d, m) => d.score - m.score), [r.map(({ handler: d, params: m }) => [d, m])];
  }
}, Re = /* @__PURE__ */ new WeakMap(), Z = /* @__PURE__ */ new WeakMap(), Ne = /* @__PURE__ */ new WeakMap(), Qe = /* @__PURE__ */ new WeakMap(), G = /* @__PURE__ */ new WeakMap(), ge = /* @__PURE__ */ new WeakSet(), Oe = /* @__PURE__ */ __name2(function(s, t, r, a, n) {
  for (let o = 0, i = h(t, Re).length; o < i; o++) {
    const c = h(t, Re)[o], l = c[r] || c[K], u = {};
    if (l !== void 0 && (l.params = /* @__PURE__ */ Object.create(null), s.push(l), a !== ns || n && n !== ns)) for (let d = 0, m = l.possibleKeys.length; d < m; d++) {
      const _ = l.possibleKeys[d], f = u[l.score];
      l.params[_] = n != null && n[_] && !f ? n[_] : a[_] ?? (n == null ? void 0 : n[_]), u[l.score] = true;
    }
  }
}, "Oe"), Ze);
var je;
var Ft;
var _a = (Ft = class {
  static {
    __name(this, "Ft");
  }
  static {
    __name2(this, "Ft");
  }
  constructor() {
    A(this, "name", "TrieRouter");
    D(this, je);
    I(this, je, new ma());
  }
  add(e, s, t) {
    const r = Wt(s);
    if (r) {
      for (let a = 0, n = r.length; a < n; a++) h(this, je).insert(e, r[a], t);
      return;
    }
    h(this, je).insert(e, s, t);
  }
  match(e, s) {
    return h(this, je).search(e, s);
  }
}, je = /* @__PURE__ */ new WeakMap(), Ft);
var er = class extends sa {
  static {
    __name(this, "er");
  }
  static {
    __name2(this, "er");
  }
  constructor(e = {}) {
    super(e), this.router = e.router ?? new da({ routers: [new ua(), new _a()] });
  }
};
var S = /* @__PURE__ */ __name2((e) => {
  const t = { ...{ origin: "*", allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"], allowHeaders: [], exposeHeaders: [] }, ...e }, r = /* @__PURE__ */ ((n) => typeof n == "string" ? n === "*" ? () => n : (o) => n === o ? o : null : typeof n == "function" ? n : (o) => n.includes(o) ? o : null)(t.origin), a = ((n) => typeof n == "function" ? n : Array.isArray(n) ? () => n : () => [])(t.allowMethods);
  return async function(o, i) {
    var u;
    function c(d, m) {
      o.res.headers.set(d, m);
    }
    __name(c, "c");
    __name2(c, "c");
    const l = await r(o.req.header("origin") || "", o);
    if (l && c("Access-Control-Allow-Origin", l), t.credentials && c("Access-Control-Allow-Credentials", "true"), (u = t.exposeHeaders) != null && u.length && c("Access-Control-Expose-Headers", t.exposeHeaders.join(",")), o.req.method === "OPTIONS") {
      t.origin !== "*" && c("Vary", "Origin"), t.maxAge != null && c("Access-Control-Max-Age", t.maxAge.toString());
      const d = await a(o.req.header("origin") || "", o);
      d.length && c("Access-Control-Allow-Methods", d.join(","));
      let m = t.allowHeaders;
      if (!(m != null && m.length)) {
        const _ = o.req.header("Access-Control-Request-Headers");
        _ && (m = _.split(/\s*,\s*/));
      }
      return m != null && m.length && (c("Access-Control-Allow-Headers", m.join(",")), o.res.headers.append("Vary", "Access-Control-Request-Headers")), o.res.headers.delete("Content-Length"), o.res.headers.delete("Content-Type"), new Response(null, { headers: o.res.headers, status: 204, statusText: "No Content" });
    }
    await i(), t.origin !== "*" && o.header("Vary", "Origin", { append: true });
  };
}, "S");
function fa(e) {
  var a;
  const s = ((a = e.split(".").pop()) == null ? void 0 : a.toLowerCase()) || "jpg", t = Date.now(), r = crypto.randomUUID().substring(0, 8);
  return `upload_${t}_${r}.${s}`;
}
__name(fa, "fa");
__name2(fa, "fa");
async function ha(e) {
  const s = new Uint8Array(e);
  return s[0] === 255 && s[1] === 216 && s[2] === 255 ? { valid: true, detectedType: "image/jpeg" } : s[0] === 137 && s[1] === 80 && s[2] === 78 && s[3] === 71 ? { valid: true, detectedType: "image/png" } : s[0] === 71 && s[1] === 73 && s[2] === 70 && s[3] === 56 ? { valid: true, detectedType: "image/gif" } : s[0] === 82 && s[1] === 73 && s[2] === 70 && s[3] === 70 && s[8] === 87 && s[9] === 69 && s[10] === 66 && s[11] === 80 ? { valid: true, detectedType: "image/webp" } : { valid: false };
}
__name(ha, "ha");
__name2(ha, "ha");
function Ea(e) {
  const s = ["DB", "SESSION_KV", "CACHE_KV", "TOSS_SECRET_KEY", "TOSS_CLIENT_KEY"], t = [];
  for (const r of s) e[r] || t.push(r);
  if (t.length > 0) throw new Error(`Missing required environment variables: ${t.join(", ")}

Please configure them:
` + t.map((r) => r === "TOSS_SECRET_KEY" || r === "TOSS_CLIENT_KEY" ? `  npx wrangler pages secret put ${r} --project-name ur-live` : `  Check wrangler.jsonc for ${r} binding`).join(`
`) + `

For more details, see ENV_SETUP_GUIDE.md`);
}
__name(Ea, "Ea");
__name2(Ea, "Ea");
function ga(e) {
  console.log("[ENV] Environment check:"), console.log("  DB:", e.DB ? "\u2705 Connected" : "\u274C Missing"), console.log("  SESSION_KV:", e.SESSION_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  CACHE_KV:", e.CACHE_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  TOSS_SECRET_KEY:", e.TOSS_SECRET_KEY ? "\u2705 Set" : "\u274C Missing"), console.log("  TOSS_CLIENT_KEY:", e.TOSS_CLIENT_KEY ? "\u2705 Set" : "\u274C Missing");
}
__name(ga, "ga");
__name2(ga, "ga");
async function ya(e) {
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
__name(ya, "ya");
__name2(ya, "ya");
function wa(e) {
  const s = [];
  s.push(""), s.push("========================================"), s.push("\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uACB0\uACFC"), s.push("========================================"), s.push("");
  let t = 0, r = 0, a = 0;
  for (const n of e) {
    const o = n.status === "pass" ? "\u2705" : n.status === "warn" ? "\u26A0\uFE0F" : "\u274C";
    s.push(`${o} ${n.name}: ${n.message}`), n.details && s.push(`   \u2192 ${n.details}`), n.status === "pass" && t++, n.status === "warn" && r++, n.status === "fail" && a++;
  }
  return s.push(""), s.push("========================================"), s.push(`\uCD1D ${e.length}\uAC1C \uD14C\uC2A4\uD2B8:`), s.push(`  \u2705 \uC131\uACF5: ${t}`), r > 0 && s.push(`  \u26A0\uFE0F  \uACBD\uACE0: ${r}`), a > 0 && s.push(`  \u274C \uC2E4\uD328: ${a}`), s.push("========================================"), s.push(""), a > 0 ? (s.push("\u274C \uD658\uACBD \uBCC0\uC218 \uC124\uC815\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."), s.push("\uC790\uC138\uD55C \uB0B4\uC6A9\uC740 ENV_SETUP_GUIDE.md\uB97C \uCC38\uACE0\uD558\uC138\uC694.")) : r > 0 ? s.push("\u26A0\uFE0F  \uC77C\uBD80 \uACBD\uACE0\uAC00 \uC788\uC9C0\uB9CC \uBC30\uD3EC\uB294 \uAC00\uB2A5\uD569\uB2C8\uB2E4.") : s.push("\u2705 \uBAA8\uB4E0 \uD658\uACBD \uBCC0\uC218\uAC00 \uC62C\uBC14\uB974\uAC8C \uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4!"), s.join(`
`);
}
__name(wa, "wa");
__name2(wa, "wa");
async function ba(e) {
  const s = await ya(e), t = s.filter((n) => n.status === "pass").length, r = s.filter((n) => n.status === "warn").length, a = s.filter((n) => n.status === "fail").length;
  return { success: a === 0, summary: { total: s.length, pass: t, warn: r, fail: a }, results: s, formatted: wa(s) };
}
__name(ba, "ba");
__name2(ba, "ba");
var Us = { ENV: "test", TEST_API_KEY: "03148F80-9525-4A00-83B4-1AE55DFFA2DF", TEST_BASE_URL: "https://testapi.barobill.co.kr" };
function Sa() {
  const e = Us.ENV === "production";
  return { baseUrl: Us.TEST_BASE_URL, apiKey: Us.TEST_API_KEY, isProduction: e };
}
__name(Sa, "Sa");
__name2(Sa, "Sa");
async function sr(e, s) {
  const t = Sa(), r = `${t.baseUrl}${e}`;
  try {
    const a = await fetch(r, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.apiKey}` }, body: JSON.stringify(s) });
    if (!a.ok) throw new Error(`\uBC14\uB85C\uBE4C API \uC624\uB958: ${a.status} ${a.statusText}`);
    return await a.json();
  } catch (a) {
    throw console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", a), a;
  }
}
__name(sr, "sr");
__name2(sr, "sr");
async function Ta(e) {
  try {
    const s = { CorpNum: e.supplierBusinessNumber, InvoicerCorpNum: e.supplierBusinessNumber, InvoicerCorpName: e.supplierBusinessName, InvoicerCEOName: e.supplierCEO, InvoicerAddr: e.supplierAddress, InvoicerBizType: e.supplierBusinessType, InvoicerBizClass: e.supplierBusinessCategory, InvoicerContactName: e.supplierCEO, InvoicerEmail: e.supplierEmail, InvoicerTEL: e.supplierTel, InvoiceeType: e.buyerBusinessNumber ? "\uC0AC\uC5C5\uC790" : "\uAC1C\uC778", InvoiceeCorpNum: e.buyerBusinessNumber, InvoiceeCorpName: e.buyerBusinessName, InvoiceeCEOName: e.buyerCEO, InvoiceeAddr: e.buyerAddress, InvoiceeEmail: e.buyerEmail, InvoiceeTEL: e.buyerTel, WriteDate: e.writeDate, PurposeType: e.purposeType, TaxType: e.taxType, DetailList: e.items.map((r, a) => ({ SerialNum: a + 1, ItemName: r.name, Qty: r.quantity, UnitPrice: r.unitPrice, SupplyCost: r.supplyPrice, Tax: r.taxAmount, Remark: r.description || "" })), SupplyCostTotal: e.totalSupplyPrice.toString(), TaxTotal: e.totalTaxAmount.toString(), TotalAmount: e.totalAmount.toString(), Remark1: e.memo || "", Remark2: e.orderNo || "", SendSMS: false, AutoAccept: false }, t = await sr("/eTaxInvoice/RegistAndIssue", s);
    if (t.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC2E4\uD328: ${t.message}`);
    return { success: true, ntsConfirmNumber: t.ntsconfirmNum, invoiceKey: t.invoiceKey, message: t.message };
  } catch (s) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC2E4\uD328:", s), s;
  }
}
__name(Ta, "Ta");
__name2(Ta, "Ta");
async function Ra(e, s, t) {
  try {
    const a = await sr("/eTaxInvoice/Delete", { CorpNum: e, InvoiceKey: s, Memo: t });
    if (a.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uCDE8\uC18C \uC2E4\uD328: ${a.message}`);
    return { success: true, message: a.message };
  } catch (r) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uCDE8\uC18C \uC2E4\uD328:", r), r;
  }
}
__name(Ra, "Ra");
__name2(Ra, "Ra");
function cs() {
  return false;
}
__name(cs, "cs");
__name2(cs, "cs");
async function Ia(e) {
  return await Ta(e);
}
__name(Ia, "Ia");
__name2(Ia, "Ia");
function va(e, s, t) {
  const r = Number(s.total_amount), a = Math.floor(r / 1.1), n = r - a;
  return { supplierBusinessNumber: e.business_number, supplierBusinessName: e.business_name, supplierCEO: e.ceo_name, supplierAddress: e.address, supplierBusinessType: e.business_type, supplierBusinessCategory: e.business_category, supplierEmail: e.email, supplierTel: e.phone, buyerBusinessNumber: s.buyer_business_number, buyerBusinessName: s.buyer_business_name || s.user_name, buyerCEO: s.buyer_ceo_name, buyerAddress: s.shipping_address, buyerEmail: s.user_email, buyerTel: s.shipping_phone, writeDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], purposeType: "01", taxType: "01", items: t.map((o) => {
    const i = Number(o.price) * Number(o.quantity), c = Math.floor(i / 1.1), l = i - c;
    return { name: o.product_name, quantity: Number(o.quantity), unitPrice: Number(o.price), supplyPrice: c, taxAmount: l, description: o.option_name || "" };
  }), totalSupplyPrice: a, totalTaxAmount: n, totalAmount: r, memo: `\uC8FC\uBB38\uBC88\uD638: ${s.order_number}`, orderNo: s.order_number };
}
__name(va, "va");
__name2(va, "va");
var ae = class extends Error {
  static {
    __name(this, "ae");
  }
  static {
    __name2(this, "ae");
  }
  constructor(s, t, r) {
    super(s), this.statusCode = t, this.code = r, this.name = "AuthError";
  }
};
function Aa(e) {
  return `${crypto.randomUUID()}-${e}`;
}
__name(Aa, "Aa");
__name2(Aa, "Aa");
function Oa(e) {
  var n, o, i, c, l, u, d;
  const s = e.id.toString(), t = ((n = e.properties) == null ? void 0 : n.nickname) || ((i = (o = e.kakao_account) == null ? void 0 : o.profile) == null ? void 0 : i.nickname) || "Kakao User", r = ((c = e.kakao_account) == null ? void 0 : c.email) || null, a = ((l = e.properties) == null ? void 0 : l.profile_image) || ((d = (u = e.kakao_account) == null ? void 0 : u.profile) == null ? void 0 : d.profile_image_url) || null;
  return { kakaoId: s, nickname: t, email: r, profileImage: a };
}
__name(Oa, "Oa");
__name2(Oa, "Oa");
async function Da(e, s, t, r, a) {
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
    `).bind(s, t, r, a).first();
    if (!n) throw new ae("Failed to upsert user", 500, "UPSERT_FAILED");
    return console.log("[Auth] \u26A1 User upserted successfully (optimized):", n.id), n;
  } catch (n) {
    throw n instanceof ae ? n : (console.error("[Auth] Database error during upsert:", n), new ae("Database error", 500, "DB_ERROR"));
  }
}
__name(Da, "Da");
__name2(Da, "Da");
async function ka(e) {
  try {
    const s = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${e}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" } });
    if (!s.ok) {
      const r = await s.text();
      throw console.error("[Kakao API] Failed to get user info:", r), new ae("Failed to get user info from Kakao", 401, "KAKAO_USER_INFO_FAILED");
    }
    const t = await s.json();
    if (!t.id) throw new ae("Invalid user data from Kakao", 500, "INVALID_KAKAO_DATA");
    return t;
  } catch (s) {
    throw s instanceof ae ? s : (console.error("[Kakao API] Network error:", s), new ae("Failed to communicate with Kakao API", 503, "KAKAO_API_ERROR"));
  }
}
__name(ka, "ka");
__name2(ka, "ka");
async function Ca(e, s, t) {
  try {
    const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: t, redirect_uri: s, code: e }).toString() });
    if (!r.ok) {
      const n = await r.json();
      throw console.error("[Kakao OAuth] Token exchange failed:", n), new ae(`Failed to exchange code: ${n.error_description || n.error}`, 401, n.error || "TOKEN_EXCHANGE_FAILED");
    }
    return (await r.json()).access_token;
  } catch (r) {
    throw r instanceof ae ? r : (console.error("[Kakao OAuth] Network error:", r), new ae("Failed to communicate with Kakao OAuth server", 503, "OAUTH_NETWORK_ERROR"));
  }
}
__name(Ca, "Ca");
__name2(Ca, "Ca");
async function tr(e, s) {
  const t = await ka(s), { kakaoId: r, nickname: a, email: n, profileImage: o } = Oa(t);
  console.log("[Auth] Processing login for Kakao user:", r);
  const i = await Da(e, r, a, n, o), c = Aa(i.id);
  return { user: i, sessionToken: c };
}
__name(tr, "tr");
__name2(tr, "tr");
async function rr(e, s, t = 30) {
  try {
    const r = await e.get(s, "json");
    if (!r) return console.log(`[Cache MISS] ${s}`), null;
    const a = Date.now() - r.timestamp;
    return a > t * 1e3 ? (console.log(`[Cache EXPIRED] ${s} (age: ${Math.round(a / 1e3)}s)`), null) : (console.log(`[Cache HIT] ${s} (age: ${Math.round(a / 1e3)}s)`), r.data);
  } catch (r) {
    return console.error(`[Cache] Get error for key "${s}":`, r), null;
  }
}
__name(rr, "rr");
__name2(rr, "rr");
async function Os(e, s, t, r = 30) {
  try {
    const a = { data: t, timestamp: Date.now() };
    await e.put(s, JSON.stringify(a), { expirationTtl: r }), console.log(`[Cache SET] ${s} (TTL: ${r}s)`);
  } catch (a) {
    console.error(`[Cache] Set error for key "${s}":`, a);
  }
}
__name(Os, "Os");
__name2(Os, "Os");
function Na(e) {
  const s = e.req.header("CF-Connecting-IP");
  if (s) return s;
  const t = e.req.header("X-Forwarded-For");
  if (t) return t.split(",")[0].trim();
  const r = e.req.header("X-Real-IP");
  return r || "unknown";
}
__name(Na, "Na");
__name2(Na, "Na");
function ja(e, s) {
  return `ratelimit:${e}:${s}`;
}
__name(ja, "ja");
__name2(ja, "ja");
var xs = /* @__PURE__ */ new Map();
async function La(e, s, t) {
  var m;
  const r = new URL(e.req.url).pathname, a = ja(s, r), n = Date.now(), o = t.windowMs * 1e3, c = e.get("user") && t.authenticatedMultiplier ? t.maxRequests * t.authenticatedMultiplier : t.maxRequests;
  try {
    const _ = (m = e.env) == null ? void 0 : m.RATE_LIMIT_KV;
    if (_) {
      const f = await _.get(a);
      let E;
      f ? (E = JSON.parse(f), n > E.resetTime ? E = { count: 1, resetTime: n + o } : E.count++) : E = { count: 1, resetTime: n + o };
      const b = Math.ceil(o / 1e3);
      await _.put(a, JSON.stringify(E), { expirationTtl: b });
      const w = E.count <= c, g = Math.max(0, c - E.count);
      return { allowed: w, remaining: g, resetTime: E.resetTime };
    }
  } catch (_) {
    console.error("KV Rate Limit Error:", _);
  }
  let l = xs.get(a);
  l && n > l.resetTime && (xs.delete(a), l = void 0), l ? l.count++ : l = { count: 1, resetTime: n + o }, xs.set(a, l);
  const u = l.count <= c, d = Math.max(0, c - l.count);
  return { allowed: u, remaining: d, resetTime: l.resetTime };
}
__name(La, "La");
__name2(La, "La");
function $e(e) {
  return async (s, t) => {
    const r = Na(s);
    if (e.skipIps && e.skipIps.includes(r)) return t();
    if (e.pathPattern) {
      const n = new URL(s.req.url).pathname;
      if (!e.pathPattern.test(n)) return t();
    }
    const a = await La(s, r, e);
    if (s.header("X-RateLimit-Limit", e.maxRequests.toString()), s.header("X-RateLimit-Remaining", a.remaining.toString()), s.header("X-RateLimit-Reset", new Date(a.resetTime).toISOString()), !a.allowed) {
      const n = Math.ceil((a.resetTime - Date.now()) / 1e3);
      return s.header("Retry-After", n.toString()), s.json({ success: false, error: e.message || "Too many requests. Please try again later.", retryAfter: n, resetTime: new Date(a.resetTime).toISOString() }, 429);
    }
    return t();
  };
}
__name($e, "$e");
__name2($e, "$e");
var Fe = { api: { windowMs: 60, maxRequests: 60, message: "API \uC694\uCCAD \uC81C\uD55C\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", authenticatedMultiplier: 2 }, auth: { windowMs: 60, maxRequests: 5, message: "\uB85C\uADF8\uC778 \uC2DC\uB3C4 \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uBD84 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/auth\// }, order: { windowMs: 60, maxRequests: 10, message: "\uC8FC\uBB38 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders/, authenticatedMultiplier: 2 }, cart: { windowMs: 60, maxRequests: 20, message: "\uC7A5\uBC14\uAD6C\uB2C8 \uC694\uCCAD\uC774 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/cart/, authenticatedMultiplier: 2 }, refund: { windowMs: 3600, maxRequests: 3, message: "\uD658\uBD88 \uC694\uCCAD \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uC2DC\uAC04 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders\/.*\/refund/ }, alimtalk: { windowMs: 60, maxRequests: 10, message: "\uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/seller\/alimtalk\/send/ }, upload: { windowMs: 60, maxRequests: 5, message: "\uD30C\uC77C \uC5C5\uB85C\uB4DC\uAC00 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/.*\/upload/ } };
var H = class extends Error {
  static {
    __name(this, "H");
  }
  static {
    __name2(this, "H");
  }
  constructor(s, t, r = "VALIDATION_ERROR") {
    super(t), this.field = s, this.code = r, this.name = "ValidationError";
  }
};
function Ma(e, s) {
  const { field: t, required: r, type: a, min: n, max: o, pattern: i, enum: c, custom: l, message: u } = s;
  if (r && (e == null || e === "")) throw new H(t, u || `${t}\uC740(\uB294) \uD544\uC218 \uD56D\uBAA9\uC785\uB2C8\uB2E4.`, "REQUIRED");
  if (!(e == null || e === "")) {
    if (a) switch (a) {
      case "string":
        if (typeof e != "string") throw new H(t, u || `${t}\uC740(\uB294) \uBB38\uC790\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "number":
        const d = typeof e == "string" ? Number(e) : e;
        if (typeof d != "number" || isNaN(d)) throw new H(t, u || `${t}\uC740(\uB294) \uC22B\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "boolean":
        if (typeof e != "boolean") throw new H(t, u || `${t}\uC740(\uB294) true/false \uAC12\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "email":
        if (typeof e != "string" || !Pa(e)) throw new H(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_EMAIL");
        break;
      case "url":
        if (typeof e != "string" || !Ua(e)) throw new H(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C URL\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_URL");
        break;
      case "phone":
        if (typeof e != "string" || !xa(e)) throw new H(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_PHONE");
        break;
      case "date":
        if (!(e instanceof Date) && !Wa(e)) throw new H(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C \uB0A0\uC9DC\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_DATE");
        break;
      case "array":
        if (!Array.isArray(e)) throw new H(t, u || `${t}\uC740(\uB294) \uBC30\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "object":
        if (typeof e != "object" || e === null || Array.isArray(e)) throw new H(t, u || `${t}\uC740(\uB294) \uAC1D\uCCB4\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
    }
    if (typeof e == "string") {
      if (n !== void 0 && e.length < n) throw new H(t, u || `${t}\uC740(\uB294) \uCD5C\uC18C ${n}\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SHORT");
      if (o !== void 0 && e.length > o) throw new H(t, u || `${t}\uC740(\uB294) \uCD5C\uB300 ${o}\uC790 \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LONG");
    }
    if (typeof e == "number") {
      if (n !== void 0 && e < n) throw new H(t, u || `${t}\uC740(\uB294) \uCD5C\uC18C ${n} \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SMALL");
      if (o !== void 0 && e > o) throw new H(t, u || `${t}\uC740(\uB294) \uCD5C\uB300 ${o} \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LARGE");
    }
    if (Array.isArray(e)) {
      if (n !== void 0 && e.length < n) throw new H(t, u || `${t}\uC740(\uB294) \uCD5C\uC18C ${n}\uAC1C \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_FEW");
      if (o !== void 0 && e.length > o) throw new H(t, u || `${t}\uC740(\uB294) \uCD5C\uB300 ${o}\uAC1C \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_MANY");
    }
    if (i && typeof e == "string" && !i.test(e)) throw new H(t, u || `${t}\uC758 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "INVALID_FORMAT");
    if (c && !c.includes(e)) throw new H(t, u || `${t}\uC740(\uB294) \uB2E4\uC74C \uC911 \uD558\uB098\uC5EC\uC57C \uD569\uB2C8\uB2E4: ${c.join(", ")}`, "INVALID_ENUM");
    if (l && l(e) === false) throw new H(t, u || `${t}\uC758 \uAC12\uC774 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "CUSTOM_VALIDATION_FAILED");
  }
}
__name(Ma, "Ma");
__name2(Ma, "Ma");
function $a(e, s) {
  for (const t of s) {
    const r = e[t.field];
    Ma(r, t);
  }
}
__name($a, "$a");
__name2($a, "$a");
function Fa(e) {
  return async (s, t) => {
    try {
      let r = {};
      const a = s.req.header("content-type") || "";
      a.includes("application/json") ? r = await s.req.json().catch(() => ({})) : (a.includes("application/x-www-form-urlencoded") || a.includes("multipart/form-data")) && (r = await s.req.parseBody().catch(() => ({})));
      const n = new URL(s.req.url);
      for (const [o, i] of n.searchParams.entries()) o in r || (r[o] = i);
      $a(r, e), s.set("validatedData", r), await t();
    } catch (r) {
      if (r instanceof H) return s.json({ success: false, error: r.message, field: r.field, code: r.code }, 400);
      throw r;
    }
  };
}
__name(Fa, "Fa");
__name2(Fa, "Fa");
function Pa(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}
__name(Pa, "Pa");
__name2(Pa, "Pa");
function Ua(e) {
  try {
    const s = new URL(e);
    return s.protocol === "http:" || s.protocol === "https:";
  } catch {
    return false;
  }
}
__name(Ua, "Ua");
__name2(Ua, "Ua");
function xa(e) {
  return /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e);
}
__name(xa, "xa");
__name2(xa, "xa");
function Wa(e) {
  if (typeof e != "string") return false;
  const s = new Date(e);
  return !isNaN(s.getTime());
}
__name(Wa, "Wa");
__name2(Wa, "Wa");
var qa = [{ field: "email", required: true, type: "email", max: 255, message: "\uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, { field: "password", required: true, type: "string", min: 8, max: 100, pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: "\uBE44\uBC00\uBC88\uD638\uB294 \uCD5C\uC18C 8\uC790 \uC774\uC0C1, \uB300\uC18C\uBB38\uC790\uC640 \uC22B\uC790\uB97C \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4." }, { field: "name", required: true, type: "string", min: 2, max: 50, message: "\uC774\uB984\uC740 2-50\uC790 \uC0AC\uC774\uC5EC\uC57C \uD569\uB2C8\uB2E4." }, { field: "phone", required: false, type: "phone", message: "\uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694. (\uC608: 010-1234-5678)" }];
function js(e) {
  const s = new URLSearchParams();
  for (const [t, r] of Object.entries(e)) r != null && s.append(t, String(r));
  return s;
}
__name(js, "js");
__name2(js, "js");
function Xs(e, s) {
  if (e.result_code !== "1") throw new Error(`[Aligo ${s}] ${e.message} (code: ${e.result_code})`);
}
__name(Xs, "Xs");
__name2(Xs, "Xs");
async function Qs(e) {
  console.log("[Aligo] \uD1A0\uD070 \uC0DD\uC131 \uC2DC\uC791");
  const t = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: js({ apikey: e.ALIGO_API_KEY, userid: e.ALIGO_USER_ID }) })).json();
  return Xs(t, "Token Create"), console.log("[Aligo] \u2705 \uD1A0\uD070 \uC0DD\uC131 \uC131\uACF5:", t.token.substring(0, 20) + "..."), { token: t.token, urtime: t.urtime };
}
__name(Qs, "Qs");
__name2(Qs, "Qs");
async function Ha(e, s) {
  console.log("[Aligo] \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D:", s.channelId);
  const { token: t } = await Qs(e), a = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: js({ token: t, userid: e.ALIGO_USER_ID, plusid: s.channelId, phonenumber: s.phoneNumber }) })).json();
  return Xs(a, "Channel Register"), console.log("[Aligo] \u2705 \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D \uC131\uACF5, senderKey:", a.senderkey), { success: true, senderKey: a.senderkey };
}
__name(Ha, "Ha");
__name2(Ha, "Ha");
async function Ka(e, s, t) {
  console.log("[Aligo] \uD15C\uD50C\uB9BF \uB4F1\uB85D:", t.templateCode);
  const { token: r } = await Qs(e), n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: js({ token: r, userid: e.ALIGO_USER_ID, senderkey: s, tpl_name: t.name, tpl_content: t.content, tpl_code: t.templateCode }) })).json();
  return Xs(n, "Template Register"), console.log("[Aligo] \u2705 \uD15C\uD50C\uB9BF \uB4F1\uB85D \uC131\uACF5:", n.tpl_code), { success: true, templateCode: n.tpl_code };
}
__name(Ka, "Ka");
__name2(Ka, "Ka");
async function Zs(e, s) {
  console.log("[Aligo] \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1:", s.to);
  try {
    const { token: t } = await Qs(e), r = s.buttons ? JSON.stringify({ button: s.buttons }) : void 0, n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: js({ token: t, userid: e.ALIGO_USER_ID, senderkey: s.senderKey, tpl_code: s.templateCode, receiver_1: s.to, subject_1: "\uC54C\uB9BC\uD1A1", message_1: s.message, button_1: r }) })).json();
    return n.result_code !== "1" ? (console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328:", n.message), { success: false, error: n.message }) : (console.log("[Aligo] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5, messageId:", n.msg_id), { success: true, messageId: n.msg_id });
  } catch (t) {
    return console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC5D0\uB7EC:", t.message), { success: false, error: t.message };
  }
}
__name(Zs, "Zs");
__name2(Zs, "Zs");
function Ba(e, s) {
  let t = e;
  for (const [r, a] of Object.entries(s)) {
    const n = new RegExp(`#{${r}}`, "g");
    t = t.replace(n, a);
  }
  return t;
}
__name(Ba, "Ba");
__name2(Ba, "Ba");
function ar(e) {
  let s = e.replace(/-/g, "");
  if (!s.startsWith("010")) throw new Error("Invalid phone number format. Must start with 010");
  if (s.length !== 11) throw new Error("Invalid phone number length. Must be 11 digits");
  return s;
}
__name(ar, "ar");
__name2(ar, "ar");
async function Ja(e, s) {
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
__name(Ja, "Ja");
__name2(Ja, "Ja");
async function Va(e, s) {
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
__name(Va, "Va");
__name2(Va, "Va");
async function ft(e, s) {
  await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(s.seller_id, s.template_code, s.recipient_phone, s.message, s.cost, s.status, s.order_id || null).run();
}
__name(ft, "ft");
__name2(ft, "ft");
async function Ya(e, s, t) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(t, s).run();
}
__name(Ya, "Ya");
__name2(Ya, "Ya");
async function za(e, s) {
  try {
    const { order: t, products: r } = await Ja(e.DB, s), a = await Va(e.DB, t.seller_id);
    if (!a) return console.warn(`Skipping alimtalk for order ${s}: no active account`), { success: false, reason: "no_account" };
    const n = 15;
    if (a.balance < n) return console.warn(`Skipping alimtalk for order ${s}: insufficient balance`), { success: false, reason: "insufficient_balance" };
    const o = r.map((l) => `${l.name} ${l.quantity}\uAC1C (${l.price.toLocaleString()}\uC6D0)`).join(`
`), i = `[\uC8FC\uBB38 \uD655\uC778]

\uC8FC\uBB38\uBC88\uD638: ${t.order_number}
\uC8FC\uBB38\uC77C\uC2DC: ${new Date(t.created_at).toLocaleString("ko-KR")}

\uC8FC\uBB38 \uC0C1\uD488:
${o}

\uCD1D \uACB0\uC81C\uAE08\uC561: ${t.total_amount.toLocaleString()}\uC6D0

\uBC30\uC1A1\uC9C0: ${t.shipping_address}
\uC218\uB839\uC778: ${t.shipping_name}
\uC5F0\uB77D\uCC98: ${t.shipping_phone}

\uC8FC\uBB38\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4!`, c = await Zs(e, { senderKey: a.sender_key, templateCode: "order_confirm", to: t.buyer_phone, message: i });
    return c.success ? (await Ya(e.DB, t.seller_id, n), await ft(e.DB, { seller_id: t.seller_id, template_code: "order_confirm", recipient_phone: t.buyer_phone, message: i, cost: n, status: "sent", order_id: s }), console.log(`Order confirmation sent for order ${s}`), { success: true }) : (await ft(e.DB, { seller_id: t.seller_id, template_code: "order_confirm", recipient_phone: t.buyer_phone, message: i, cost: 0, status: "failed", order_id: s }), console.error(`Failed to send order confirmation for order ${s}:`, c.error), { success: false, error: c.error });
  } catch (t) {
    return console.error(`Error sending order confirmation for order ${s}:`, t), { success: false, error: t.message };
  }
}
__name(za, "za");
__name2(za, "za");
function Ga(e, s) {
  let t = e;
  return Object.entries(s).forEach(([r, a]) => {
    const n = new RegExp(`#{${r}}`, "g");
    t = t.replace(n, a);
  }), t;
}
__name(Ga, "Ga");
__name2(Ga, "Ga");
function Xa(e, s) {
  const r = Array.from(e.matchAll(/#{(\w+)}/g), (a) => a[1]).filter((a) => !s[a]);
  return { valid: r.length === 0, missingVars: r };
}
__name(Xa, "Xa");
__name2(Xa, "Xa");
async function Qa(e, s, t) {
  const r = await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(s).first();
  if (!r) throw new Error(`Account not found: ${s}`);
  return { sufficient: r.balance >= t, currentBalance: r.balance };
}
__name(Qa, "Qa");
__name2(Qa, "Qa");
async function Za(e, s, t) {
  const r = await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(t, s, t).run();
  if (!r.success || r.meta.changes === 0) throw new Error("Insufficient balance or account not found");
}
__name(Za, "Za");
__name2(Za, "Za");
async function ht(e, s, t) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t, s).run();
}
__name(ht, "ht");
__name2(ht, "ht");
async function Ws(e, s) {
  await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s.accountId, s.templateId, s.orderId || null, s.recipientPhone, s.messageContent, s.status, s.cost, s.aligoMessageId || null, s.failedReason || null).run();
}
__name(Ws, "Ws");
__name2(Ws, "Ws");
async function en(e, s, t, r) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t, r, s).run();
}
__name(en, "en");
__name2(en, "en");
async function sn(e, s, t, r, a, n, o, i, c) {
  try {
    const l = { ...i, ...o.variables }, u = Ga(r, l), d = await Zs(e, { senderKey: a, templateCode: n, to: o.phone, message: u });
    return d.success ? (await Ws(e.DB, { accountId: s, templateId: t, recipientPhone: o.phone, messageContent: u, status: "sent", cost: c, aligoMessageId: d.messageId }), { phone: o.phone, status: "sent", messageId: d.messageId, cost: c }) : (await Ws(e.DB, { accountId: s, templateId: t, recipientPhone: o.phone, messageContent: u, status: "failed", cost: 0, failedReason: d.error }), await ht(e.DB, s, c), { phone: o.phone, status: "failed", error: d.error, cost: 0 });
  } catch (l) {
    return console.error(`Failed to send alimtalk to ${o.phone}:`, l), await Ws(e.DB, { accountId: s, templateId: t, recipientPhone: o.phone, messageContent: "", status: "failed", cost: 0, failedReason: l.message }), await ht(e.DB, s, c), { phone: o.phone, status: "failed", error: l.message, cost: 0 };
  }
}
__name(sn, "sn");
__name2(sn, "sn");
async function et(e, s) {
  const { accountId: t, templateId: r, recipients: a, variables: n } = s;
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
    `).bind(t).first();
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
    `).bind(r, t).first();
    if (!i) throw new Error("Template not found");
    if (i.status !== "approved") throw new Error("Template is not approved");
    const c = Xa(i.template_content, n);
    if (!c.valid) throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);
    const l = 15, u = a.length * l, d = await Qa(e.DB, t, u);
    if (!d.sufficient) throw new Error(`Insufficient balance. Required: ${u}, Current: ${d.currentBalance}`);
    await Za(e.DB, t, u), console.log(`[Alimtalk] Deducted ${u} points from account ${t}`);
    const m = [];
    let _ = 0, f = 0, E = 0;
    for (const b of a) {
      const w = await sn(e, t, r, i.template_content, o.sender_key, i.template_code, b, n, l);
      m.push(w), w.status === "sent" ? _++ : (f++, E += l), m.length % 10 === 0 && await new Promise((g) => setTimeout(g, 1e3));
    }
    return await en(e.DB, t, _, f), console.log(`[Alimtalk] Completed: ${_} sent, ${f} failed, ${E} refunded`), { success: true, totalRecipients: a.length, successCount: _, failedCount: f, refundedAmount: E, messages: m };
  } catch (o) {
    return console.error("[Alimtalk] Bulk send failed:", o), { success: false, totalRecipients: a.length, successCount: 0, failedCount: a.length, refundedAmount: 0, messages: [], error: o.message };
  }
}
__name(et, "et");
__name2(et, "et");
async function tn(e, s, t, r, a) {
  const n = await e.DB.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(r).first();
  if (!n) throw new Error(`Order not found: ${r}`);
  const i = (await e.DB.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(r).all()).results.map((u) => `${u.name} ${u.quantity}\uAC1C (${u.price.toLocaleString()}\uC6D0)`).join(`
`), c = { orderNumber: n.order_number, orderDate: new Date(n.created_at).toLocaleString("ko-KR"), productList: i, totalAmount: n.total_amount.toLocaleString(), shippingAddress: n.shipping_address, shippingName: n.shipping_name, shippingPhone: n.shipping_phone, buyerName: n.buyer_name, customMessage: a || "\uAC10\uC0AC\uD569\uB2C8\uB2E4!" }, l = [{ phone: n.buyer_phone, name: n.buyer_name }];
  return et(e, { accountId: s, templateId: t, recipients: l, variables: c });
}
__name(tn, "tn");
__name2(tn, "tn");
async function rn(e, s, t, r, a = {}) {
  const n = r.map((o) => ({ phone: o.phone, name: o.name, variables: Object.entries(o).filter(([i]) => i !== "phone" && i !== "name").reduce((i, [c, l]) => ({ ...i, [c]: l }), {}) }));
  return et(e, { accountId: s, templateId: t, recipients: n, variables: a });
}
__name(rn, "rn");
__name2(rn, "rn");
function an(e, s = 0.1) {
  return Math.floor(e * s);
}
__name(an, "an");
__name2(an, "an");
function nn() {
  const e = /* @__PURE__ */ new Date(), s = new Date(e.getFullYear(), e.getMonth() - 1, 1), t = s.getFullYear(), r = String(s.getMonth() + 1).padStart(2, "0"), a = new Date(t, s.getMonth() + 1, 0).getDate();
  return { startDate: `${t}-${r}-01`, endDate: `${t}-${r}-${a}` };
}
__name(nn, "nn");
__name2(nn, "nn");
async function on22(e, s, t) {
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
    const n = [];
    let o = 0, i = 0, c = 0;
    for (const m of a.results) {
      const _ = m.total_amount - m.shipping_fee, f = an(_);
      n.push({ order_id: m.id, order_number: m.order_number, order_date: m.created_at, product_name: m.product_names || "", quantity: m.total_quantity || 1, price: _, shipping_fee: m.shipping_fee || 0, platform_fee: f, status: m.status }), o += _, i += m.shipping_fee || 0, c += f;
    }
    const l = await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(s, t.startDate, t.endDate).first(), u = (l == null ? void 0 : l.refund_amount) || 0, d = o - c - u + i;
    return { seller_id: s, seller_name: r.business_name, total_sales: o, total_orders: n.length, platform_fee: c, shipping_fee: i, refund_amount: u, settlement_amount: d, orders: n };
  } catch (r) {
    return console.error(`Failed to calculate settlement for seller ${s}:`, r), null;
  }
}
__name(on22, "on2");
__name2(on22, "on");
async function cn(e, s) {
  console.log(`[Settlement] Generating report for ${s.startDate} ~ ${s.endDate}`);
  const t = await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(s.startDate, s.endDate).all(), r = [];
  let a = 0, n = 0, o = 0;
  for (const c of t.results) {
    const l = await on22(e, c.id, s);
    l && (r.push(l), a += l.total_sales, n += l.platform_fee, o += l.settlement_amount);
  }
  const i = { period: s, generated_at: (/* @__PURE__ */ new Date()).toISOString(), total_sales: a, total_platform_fee: n, total_settlement: o, sellers: r };
  return console.log(`[Settlement] Report generated: ${r.length} sellers, ${a.toLocaleString()}\uC6D0`), i;
}
__name(cn, "cn");
__name2(cn, "cn");
async function ln(e, s) {
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
__name(ln, "ln");
__name2(ln, "ln");
async function un(e, s) {
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
  `).bind(s).all()).results.map((n) => ({ seller_id: n.seller_id, seller_name: n.seller_name, total_sales: n.total_sales, total_orders: n.total_orders, platform_fee: n.platform_fee, shipping_fee: n.shipping_fee, refund_amount: n.refund_amount, settlement_amount: n.settlement_amount, orders: [] }));
  return { period: { startDate: t.period_start, endDate: t.period_end }, generated_at: t.generated_at, total_sales: t.total_sales, total_platform_fee: t.total_platform_fee, total_settlement: t.total_settlement, sellers: a };
}
__name(un, "un");
__name2(un, "un");
async function dn(e, s) {
  const t = new TextEncoder();
  let r;
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
        n.enqueue(t.encode(`data: ${c}

`));
      }
    } catch (o) {
      console.error("[SSE] Failed to fetch initial data:", o);
    }
    r = setInterval(async () => {
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
          n.enqueue(t.encode(`data: ${c}

`));
        }
        n.enqueue(t.encode(`: ping

`));
      } catch (o) {
        console.error("[SSE] Update failed:", o);
      }
    }, 3e4);
  }, cancel() {
    console.log(`[SSE] Client disconnected from stream ${e}`), r && clearInterval(r);
  } });
  return new Response(a, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(dn, "dn");
__name2(dn, "dn");
async function pn(e, s) {
  const t = new TextEncoder();
  let r = 0, a;
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
        r = i.results[0].id;
        const c = { type: "chat", data: i.results.reverse(), timestamp: (/* @__PURE__ */ new Date()).toISOString() }, l = JSON.stringify(c);
        o.enqueue(t.encode(`data: ${l}

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
          o.enqueue(t.encode(`data: ${l}

`));
        } else o.enqueue(t.encode(`: ping

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
__name(pn, "pn");
__name2(pn, "pn");
async function mn(e, s) {
  const t = new TextEncoder();
  let r = 0, a;
  const n = new ReadableStream({ async start(o) {
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
          o.enqueue(t.encode(`data: ${l}

`));
        } else o.enqueue(t.encode(`: ping

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
__name(mn, "mn");
__name2(mn, "mn");
async function _n(e, s) {
  const t = new TextEncoder();
  let r;
  const a = new ReadableStream({ async start(n) {
    console.log(`[SSE Stock] Seller ${e} connected`), r = setInterval(async () => {
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
          n.enqueue(t.encode(`data: ${c}

`));
        } else n.enqueue(t.encode(`: ping

`));
      } catch (o) {
        console.error("[SSE Stock] Polling failed:", o);
      }
    }, 6e4);
  }, cancel() {
    console.log(`[SSE Stock] Seller ${e} disconnected`), r && clearInterval(r);
  } });
  return new Response(a, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
__name(_n, "_n");
__name2(_n, "_n");
async function fn(e, s, t, r) {
  await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s, t, r.endpoint, r.keys.p256dh, r.keys.auth).run(), console.log(`[Push] Subscription saved for ${t} ${s}`);
}
__name(fn, "fn");
__name2(fn, "fn");
async function hn(e, s) {
  await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(s).run(), console.log(`[Push] Subscription deleted: ${s}`);
}
__name(hn, "hn");
__name2(hn, "hn");
function En(e) {
  if (e.req.method !== "GET") return false;
  const s = e.req.header("Authorization"), t = e.req.header("X-Session-Token");
  if (s || t) return false;
  const a = new URL(e.req.url).pathname;
  return !(a.includes("/api/products/") && a.includes("/stock") || a.includes("/api/streams/") && a.includes("/status") || a.includes("/current-product") || a.includes("/api/chat") || a.includes("/api/sse") || a.includes("/api/orders") || a.includes("/api/payment"));
}
__name(En, "En");
__name2(En, "En");
function gn(e, s) {
  return s || new URL(e.req.url).toString();
}
__name(gn, "gn");
__name2(gn, "gn");
function yn(e) {
  const s = [];
  return s.push("public"), s.push(`max-age=${e.ttl}`), e.sMaxAge !== void 0 ? s.push(`s-maxage=${e.sMaxAge}`) : s.push(`s-maxage=${e.ttl}`), e.staleWhileRevalidate && s.push(`stale-while-revalidate=${e.staleWhileRevalidate}`), s.join(", ");
}
__name(yn, "yn");
__name2(yn, "yn");
function st(e) {
  return async (s, t) => {
    var i;
    if (e.skipCache || !En(s)) return t();
    const r = gn(s, e.cacheKey), a = caches.default;
    let n = await a.match(r);
    if (n) {
      console.log(`[Cache HIT] ${r}`);
      const c = new Headers(n.headers);
      return c.set("X-Cache", "HIT"), c.set("X-Cache-Key", r), new Response(n.body, { status: n.status, statusText: n.statusText, headers: c });
    }
    console.log(`[Cache MISS] ${r}`), await t();
    const o = s.res;
    if (o.status >= 200 && o.status < 300) {
      const c = yn(e);
      o.headers.set("Cache-Control", c), o.headers.set("X-Cache", "MISS"), o.headers.set("X-Cache-Key", r);
      const l = e.varyBy || ["Accept-Encoding"];
      o.headers.set("Vary", l.join(", "));
      const u = o.clone();
      (i = s.executionCtx) == null || i.waitUntil(a.put(r, u));
    }
  };
}
__name(st, "st");
__name2(st, "st");
var tt = { products: { ttl: 10, sMaxAge: 60, staleWhileRevalidate: 120 }, liveStreams: { ttl: 5, sMaxAge: 10, staleWhileRevalidate: 30 }, microCache: { ttl: 10, sMaxAge: 10, staleWhileRevalidate: 30 } };
var wn = class extends Error {
  static {
    __name(this, "wn");
  }
  static {
    __name2(this, "wn");
  }
  constructor(s, t, r, a) {
    super(r), this.statusCode = s, this.code = t, this.details = a, this.name = "AppError", Error.captureStackTrace(this, this.constructor);
  }
};
async function bn(e, s, t, r) {
  if (e) try {
    const a = { title: `\u2705 ${s}`, description: t, color: 3066993, fields: [], timestamp: (/* @__PURE__ */ new Date()).toISOString(), footer: { text: "UR LIVE Monitor" } };
    if (r) for (const [n, o] of Object.entries(r)) a.fields.push({ name: n, value: String(o), inline: true });
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [a] }) });
  } catch (a) {
    console.error("[Discord] Failed to send success alert:", a);
  }
}
__name(bn, "bn");
__name2(bn, "bn");
async function Sn(e, s, t) {
  if (e) try {
    const r = ["\u{1F4CA} **KV \uC0AC\uC6A9\uB7C9 \uACBD\uACE0**", "", "\uD604\uC7AC \uC0AC\uC6A9\uB7C9:", `\u2022 \uC77D\uAE30: ${s.toFixed(1)}%`, `\u2022 \uC4F0\uAE30: ${t.toFixed(1)}%`, "", "50% \uC774\uC0C1 \uC0AC\uC6A9 \uC911\uC785\uB2C8\uB2E4. \uC720\uB8CC \uD50C\uB79C \uC5C5\uADF8\uB808\uC774\uB4DC\uB97C \uACE0\uB824\uD558\uC138\uC694.", "https://dash.cloudflare.com"].join(`
`);
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: r }) });
  } catch (r) {
    console.error("[Discord] Failed to send KV warning:", r);
  }
}
__name(Sn, "Sn");
__name2(Sn, "Sn");
var Tn = class {
  static {
    __name(this, "Tn");
  }
  static {
    __name2(this, "Tn");
  }
  constructor(s) {
    this.accessToken = null, this.tokenExpiry = 0, this.databaseURL = s.FIREBASE_DATABASE_URL, this.projectId = s.FIREBASE_PROJECT_ID, this.privateKey = s.FIREBASE_PRIVATE_KEY, this.clientEmail = s.FIREBASE_CLIENT_EMAIL, (!this.databaseURL || !this.projectId || !this.privateKey || !this.clientEmail) && console.warn("\u26A0\uFE0F Firebase Admin credentials not configured, using unauthenticated mode");
  }
  async set(s, t) {
    const r = `${this.databaseURL}/${s}.json`, a = await fetch(r, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    if (!a.ok) {
      const n = await a.text();
      throw console.error(`\u274C Firebase set failed for ${s}:`, n), new Error(`Firebase set failed: ${a.statusText}`);
    }
    console.log(`\u2705 Firebase: Set data at ${s}`);
  }
  async update(s, t) {
    const r = `${this.databaseURL}/${s}.json`, a = await fetch(r, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    if (!a.ok) {
      const n = await a.text();
      throw console.error(`\u274C Firebase update failed for ${s}:`, n), new Error(`Firebase update failed: ${a.statusText}`);
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
      const a = `chats/stream${s}`, n = Date.now();
      await this.set(`${a}/alert_${n}`, { username: "\uC2DC\uC2A4\uD15C", text: `\u26A0\uFE0F ${t}\uC758 \uC7AC\uACE0\uAC00 ${r}\uAC1C \uB0A8\uC558\uC2B5\uB2C8\uB2E4!`, timestamp: n, isSystem: true }), console.log(`\u2705 Firebase: Low stock alert sent for stream ${s}`);
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
      const r = { alg: "RS256", typ: "JWT" }, a = Math.floor(Date.now() / 1e3), n = { iss: this.clientEmail, sub: this.clientEmail, aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit", iat: a, exp: a + 3600, uid: s, claims: t || {} }, o = /* @__PURE__ */ __name2((w) => {
        const g = JSON.stringify(w);
        return btoa(g).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      }, "o"), i = o(r), c = o(n), l = `${i}.${c}`, u = this.privateKey.replace(/\\n/g, `
`), d = await this.pemToDer(u), m = await crypto.subtle.importKey("pkcs8", d, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]), _ = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", m, new TextEncoder().encode(l)), E = btoa(String.fromCharCode(...new Uint8Array(_))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""), b = `${l}.${E}`;
      return console.log("[Firebase Custom Token] \u2705 Token created successfully"), b;
    } catch (r) {
      throw console.error("[Firebase Custom Token] \u274C Failed to create token:", r), new Error("Failed to create Firebase custom token");
    }
  }
  async pemToDer(s) {
    const a = s.substring("-----BEGIN PRIVATE KEY-----".length, s.length - "-----END PRIVATE KEY-----".length - 1).trim(), n = atob(a), o = new Uint8Array(n.length);
    for (let i = 0; i < n.length; i++) o[i] = n.charCodeAt(i);
    return o.buffer;
  }
};
function gs(e) {
  return new Tn(e);
}
__name(gs, "gs");
__name2(gs, "gs");
var rt = crypto;
var nr = /* @__PURE__ */ __name2((e) => e instanceof CryptoKey, "nr");
var Ss = new TextEncoder();
var Ls = new TextDecoder();
function Rn(...e) {
  const s = e.reduce((a, { length: n }) => a + n, 0), t = new Uint8Array(s);
  let r = 0;
  for (const a of e) t.set(a, r), r += a.length;
  return t;
}
__name(Rn, "Rn");
__name2(Rn, "Rn");
var In = /* @__PURE__ */ __name2((e) => {
  const s = atob(e), t = new Uint8Array(s.length);
  for (let r = 0; r < s.length; r++) t[r] = s.charCodeAt(r);
  return t;
}, "In");
var Le = /* @__PURE__ */ __name2((e) => {
  let s = e;
  s instanceof Uint8Array && (s = Ls.decode(s)), s = s.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  try {
    return In(s);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}, "Le");
var X = class extends Error {
  static {
    __name(this, "X");
  }
  static {
    __name2(this, "X");
  }
  constructor(s, t) {
    var r;
    super(s, t), this.code = "ERR_JOSE_GENERIC", this.name = this.constructor.name, (r = Error.captureStackTrace) == null || r.call(Error, this, this.constructor);
  }
};
X.code = "ERR_JOSE_GENERIC";
var oe = class extends X {
  static {
    __name(this, "oe");
  }
  static {
    __name2(this, "oe");
  }
  constructor(s, t, r = "unspecified", a = "unspecified") {
    super(s, { cause: { claim: r, reason: a, payload: t } }), this.code = "ERR_JWT_CLAIM_VALIDATION_FAILED", this.claim = r, this.reason = a, this.payload = t;
  }
};
oe.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
var Vs = class extends X {
  static {
    __name(this, "Vs");
  }
  static {
    __name2(this, "Vs");
  }
  constructor(s, t, r = "unspecified", a = "unspecified") {
    super(s, { cause: { claim: r, reason: a, payload: t } }), this.code = "ERR_JWT_EXPIRED", this.claim = r, this.reason = a, this.payload = t;
  }
};
Vs.code = "ERR_JWT_EXPIRED";
var or = class extends X {
  static {
    __name(this, "or");
  }
  static {
    __name2(this, "or");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JOSE_ALG_NOT_ALLOWED";
  }
};
or.code = "ERR_JOSE_ALG_NOT_ALLOWED";
var me = class extends X {
  static {
    __name(this, "me");
  }
  static {
    __name2(this, "me");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JOSE_NOT_SUPPORTED";
  }
};
me.code = "ERR_JOSE_NOT_SUPPORTED";
var vn = class extends X {
  static {
    __name(this, "vn");
  }
  static {
    __name2(this, "vn");
  }
  constructor(s = "decryption operation failed", t) {
    super(s, t), this.code = "ERR_JWE_DECRYPTION_FAILED";
  }
};
vn.code = "ERR_JWE_DECRYPTION_FAILED";
var An = class extends X {
  static {
    __name(this, "An");
  }
  static {
    __name2(this, "An");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWE_INVALID";
  }
};
An.code = "ERR_JWE_INVALID";
var J = class extends X {
  static {
    __name(this, "J");
  }
  static {
    __name2(this, "J");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWS_INVALID";
  }
};
J.code = "ERR_JWS_INVALID";
var at = class extends X {
  static {
    __name(this, "at");
  }
  static {
    __name2(this, "at");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWT_INVALID";
  }
};
at.code = "ERR_JWT_INVALID";
var On = class extends X {
  static {
    __name(this, "On");
  }
  static {
    __name2(this, "On");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWK_INVALID";
  }
};
On.code = "ERR_JWK_INVALID";
var nt = class extends X {
  static {
    __name(this, "nt");
  }
  static {
    __name2(this, "nt");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWKS_INVALID";
  }
};
nt.code = "ERR_JWKS_INVALID";
var ot = class extends X {
  static {
    __name(this, "ot");
  }
  static {
    __name2(this, "ot");
  }
  constructor(s = "no applicable key found in the JSON Web Key Set", t) {
    super(s, t), this.code = "ERR_JWKS_NO_MATCHING_KEY";
  }
};
ot.code = "ERR_JWKS_NO_MATCHING_KEY";
var ir = class extends X {
  static {
    __name(this, "ir");
  }
  static {
    __name2(this, "ir");
  }
  constructor(s = "multiple matching keys found in the JSON Web Key Set", t) {
    super(s, t), this.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  }
};
ir.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
var cr = class extends X {
  static {
    __name(this, "cr");
  }
  static {
    __name2(this, "cr");
  }
  constructor(s = "request timed out", t) {
    super(s, t), this.code = "ERR_JWKS_TIMEOUT";
  }
};
cr.code = "ERR_JWKS_TIMEOUT";
var lr = class extends X {
  static {
    __name(this, "lr");
  }
  static {
    __name2(this, "lr");
  }
  constructor(s = "signature verification failed", t) {
    super(s, t), this.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  }
};
lr.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
function pe(e, s = "algorithm.name") {
  return new TypeError(`CryptoKey does not support this operation, its ${s} must be ${e}`);
}
__name(pe, "pe");
__name2(pe, "pe");
function os(e, s) {
  return e.name === s;
}
__name(os, "os");
__name2(os, "os");
function qs(e) {
  return parseInt(e.name.slice(4), 10);
}
__name(qs, "qs");
__name2(qs, "qs");
function Dn(e) {
  switch (e) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
__name(Dn, "Dn");
__name2(Dn, "Dn");
function kn(e, s) {
  if (s.length && !s.some((t) => e.usages.includes(t))) {
    let t = "CryptoKey does not support this operation, its usages must include ";
    if (s.length > 2) {
      const r = s.pop();
      t += `one of ${s.join(", ")}, or ${r}.`;
    } else s.length === 2 ? t += `one of ${s[0]} or ${s[1]}.` : t += `${s[0]}.`;
    throw new TypeError(t);
  }
}
__name(kn, "kn");
__name2(kn, "kn");
function Cn(e, s, ...t) {
  switch (s) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!os(e.algorithm, "HMAC")) throw pe("HMAC");
      const r = parseInt(s.slice(2), 10);
      if (qs(e.algorithm.hash) !== r) throw pe(`SHA-${r}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!os(e.algorithm, "RSASSA-PKCS1-v1_5")) throw pe("RSASSA-PKCS1-v1_5");
      const r = parseInt(s.slice(2), 10);
      if (qs(e.algorithm.hash) !== r) throw pe(`SHA-${r}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!os(e.algorithm, "RSA-PSS")) throw pe("RSA-PSS");
      const r = parseInt(s.slice(2), 10);
      if (qs(e.algorithm.hash) !== r) throw pe(`SHA-${r}`, "algorithm.hash");
      break;
    }
    case "EdDSA": {
      if (e.algorithm.name !== "Ed25519" && e.algorithm.name !== "Ed448") throw pe("Ed25519 or Ed448");
      break;
    }
    case "Ed25519": {
      if (!os(e.algorithm, "Ed25519")) throw pe("Ed25519");
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!os(e.algorithm, "ECDSA")) throw pe("ECDSA");
      const r = Dn(s);
      if (e.algorithm.namedCurve !== r) throw pe(r, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  kn(e, t);
}
__name(Cn, "Cn");
__name2(Cn, "Cn");
function ur(e, s, ...t) {
  var r;
  if (t = t.filter(Boolean), t.length > 2) {
    const a = t.pop();
    e += `one of type ${t.join(", ")}, or ${a}.`;
  } else t.length === 2 ? e += `one of type ${t[0]} or ${t[1]}.` : e += `of type ${t[0]}.`;
  return s == null ? e += ` Received ${s}` : typeof s == "function" && s.name ? e += ` Received function ${s.name}` : typeof s == "object" && s != null && (r = s.constructor) != null && r.name && (e += ` Received an instance of ${s.constructor.name}`), e;
}
__name(ur, "ur");
__name2(ur, "ur");
var Et = /* @__PURE__ */ __name2((e, ...s) => ur("Key must be ", e, ...s), "Et");
function dr(e, s, ...t) {
  return ur(`Key for the ${e} algorithm must be `, s, ...t);
}
__name(dr, "dr");
__name2(dr, "dr");
var pr = /* @__PURE__ */ __name2((e) => nr(e) ? true : (e == null ? void 0 : e[Symbol.toStringTag]) === "KeyObject", "pr");
var Ds = ["CryptoKey"];
var Nn = /* @__PURE__ */ __name2((...e) => {
  const s = e.filter(Boolean);
  if (s.length === 0 || s.length === 1) return true;
  let t;
  for (const r of s) {
    const a = Object.keys(r);
    if (!t || t.size === 0) {
      t = new Set(a);
      continue;
    }
    for (const n of a) {
      if (t.has(n)) return false;
      t.add(n);
    }
  }
  return true;
}, "Nn");
function jn(e) {
  return typeof e == "object" && e !== null;
}
__name(jn, "jn");
__name2(jn, "jn");
function Ie(e) {
  if (!jn(e) || Object.prototype.toString.call(e) !== "[object Object]") return false;
  if (Object.getPrototypeOf(e) === null) return true;
  let s = e;
  for (; Object.getPrototypeOf(s) !== null; ) s = Object.getPrototypeOf(s);
  return Object.getPrototypeOf(e) === s;
}
__name(Ie, "Ie");
__name2(Ie, "Ie");
var Ln = /* @__PURE__ */ __name2((e, s) => {
  if (e.startsWith("RS") || e.startsWith("PS")) {
    const { modulusLength: t } = s.algorithm;
    if (typeof t != "number" || t < 2048) throw new TypeError(`${e} requires key modulusLength to be 2048 bits or larger`);
  }
}, "Ln");
function es(e) {
  return Ie(e) && typeof e.kty == "string";
}
__name(es, "es");
__name2(es, "es");
function Mn(e) {
  return e.kty !== "oct" && typeof e.d == "string";
}
__name(Mn, "Mn");
__name2(Mn, "Mn");
function $n(e) {
  return e.kty !== "oct" && typeof e.d > "u";
}
__name($n, "$n");
__name2($n, "$n");
function Fn(e) {
  return es(e) && e.kty === "oct" && typeof e.k == "string";
}
__name(Fn, "Fn");
__name2(Fn, "Fn");
function Pn(e) {
  let s, t;
  switch (e.kty) {
    case "RSA": {
      switch (e.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          s = { name: "RSA-PSS", hash: `SHA-${e.alg.slice(-3)}` }, t = e.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          s = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${e.alg.slice(-3)}` }, t = e.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          s = { name: "RSA-OAEP", hash: `SHA-${parseInt(e.alg.slice(-3), 10) || 1}` }, t = e.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (e.alg) {
        case "ES256":
          s = { name: "ECDSA", namedCurve: "P-256" }, t = e.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          s = { name: "ECDSA", namedCurve: "P-384" }, t = e.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          s = { name: "ECDSA", namedCurve: "P-521" }, t = e.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          s = { name: "ECDH", namedCurve: e.crv }, t = e.d ? ["deriveBits"] : [];
          break;
        default:
          throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (e.alg) {
        case "Ed25519":
          s = { name: "Ed25519" }, t = e.d ? ["sign"] : ["verify"];
          break;
        case "EdDSA":
          s = { name: e.crv }, t = e.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          s = { name: e.crv }, t = e.d ? ["deriveBits"] : [];
          break;
        default:
          throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new me('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm: s, keyUsages: t };
}
__name(Pn, "Pn");
__name2(Pn, "Pn");
var mr = /* @__PURE__ */ __name2(async (e) => {
  if (!e.alg) throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  const { algorithm: s, keyUsages: t } = Pn(e), r = [s, e.ext ?? false, e.key_ops ?? t], a = { ...e };
  return delete a.alg, delete a.use, rt.subtle.importKey("jwk", a, ...r);
}, "mr");
var _r = /* @__PURE__ */ __name2((e) => Le(e), "_r");
var We;
var qe;
var fr = /* @__PURE__ */ __name2((e) => (e == null ? void 0 : e[Symbol.toStringTag]) === "KeyObject", "fr");
var ks = /* @__PURE__ */ __name2(async (e, s, t, r, a = false) => {
  let n = e.get(s);
  if (n != null && n[r]) return n[r];
  const o = await mr({ ...t, alg: r });
  return a && Object.freeze(s), n ? n[r] = o : e.set(s, { [r]: o }), o;
}, "ks");
var Un = /* @__PURE__ */ __name2((e, s) => {
  if (fr(e)) {
    let t = e.export({ format: "jwk" });
    return delete t.d, delete t.dp, delete t.dq, delete t.p, delete t.q, delete t.qi, t.k ? _r(t.k) : (qe || (qe = /* @__PURE__ */ new WeakMap()), ks(qe, e, t, s));
  }
  return es(e) ? e.k ? Le(e.k) : (qe || (qe = /* @__PURE__ */ new WeakMap()), ks(qe, e, e, s, true)) : e;
}, "Un");
var xn = /* @__PURE__ */ __name2((e, s) => {
  if (fr(e)) {
    let t = e.export({ format: "jwk" });
    return t.k ? _r(t.k) : (We || (We = /* @__PURE__ */ new WeakMap()), ks(We, e, t, s));
  }
  return es(e) ? e.k ? Le(e.k) : (We || (We = /* @__PURE__ */ new WeakMap()), ks(We, e, e, s, true)) : e;
}, "xn");
var Wn = { normalizePublicKey: Un, normalizePrivateKey: xn };
async function hr(e, s) {
  if (!Ie(e)) throw new TypeError("JWK must be an object");
  switch (s || (s = e.alg), e.kty) {
    case "oct":
      if (typeof e.k != "string" || !e.k) throw new TypeError('missing "k" (Key Value) Parameter value');
      return Le(e.k);
    case "RSA":
      if ("oth" in e && e.oth !== void 0) throw new me('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
    case "EC":
    case "OKP":
      return mr({ ...e, alg: s });
    default:
      throw new me('Unsupported "kty" (Key Type) Parameter value');
  }
}
__name(hr, "hr");
__name2(hr, "hr");
var Je = /* @__PURE__ */ __name2((e) => e == null ? void 0 : e[Symbol.toStringTag], "Je");
var Ys = /* @__PURE__ */ __name2((e, s, t) => {
  var r, a;
  if (s.use !== void 0 && s.use !== "sig") throw new TypeError("Invalid key for this operation, when present its use must be sig");
  if (s.key_ops !== void 0 && ((a = (r = s.key_ops).includes) == null ? void 0 : a.call(r, t)) !== true) throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${t}`);
  if (s.alg !== void 0 && s.alg !== e) throw new TypeError(`Invalid key for this operation, when present its alg must be ${e}`);
  return true;
}, "Ys");
var qn = /* @__PURE__ */ __name2((e, s, t, r) => {
  if (!(s instanceof Uint8Array)) {
    if (r && es(s)) {
      if (Fn(s) && Ys(e, s, t)) return;
      throw new TypeError('JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present');
    }
    if (!pr(s)) throw new TypeError(dr(e, s, ...Ds, "Uint8Array", r ? "JSON Web Key" : null));
    if (s.type !== "secret") throw new TypeError(`${Je(s)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "qn");
var Hn = /* @__PURE__ */ __name2((e, s, t, r) => {
  if (r && es(s)) switch (t) {
    case "sign":
      if (Mn(s) && Ys(e, s, t)) return;
      throw new TypeError("JSON Web Key for this operation be a private JWK");
    case "verify":
      if ($n(s) && Ys(e, s, t)) return;
      throw new TypeError("JSON Web Key for this operation be a public JWK");
  }
  if (!pr(s)) throw new TypeError(dr(e, s, ...Ds, r ? "JSON Web Key" : null));
  if (s.type === "secret") throw new TypeError(`${Je(s)} instances for asymmetric algorithms must not be of type "secret"`);
  if (t === "sign" && s.type === "public") throw new TypeError(`${Je(s)} instances for asymmetric algorithm signing must be of type "private"`);
  if (t === "decrypt" && s.type === "public") throw new TypeError(`${Je(s)} instances for asymmetric algorithm decryption must be of type "private"`);
  if (s.algorithm && t === "verify" && s.type === "private") throw new TypeError(`${Je(s)} instances for asymmetric algorithm verifying must be of type "public"`);
  if (s.algorithm && t === "encrypt" && s.type === "private") throw new TypeError(`${Je(s)} instances for asymmetric algorithm encryption must be of type "public"`);
}, "Hn");
function Er(e, s, t, r) {
  s.startsWith("HS") || s === "dir" || s.startsWith("PBES2") || /^A\d{3}(?:GCM)?KW$/.test(s) ? qn(s, t, r, e) : Hn(s, t, r, e);
}
__name(Er, "Er");
__name2(Er, "Er");
Er.bind(void 0, false);
var gt = Er.bind(void 0, true);
function Kn(e, s, t, r, a) {
  if (a.crit !== void 0 && (r == null ? void 0 : r.crit) === void 0) throw new e('"crit" (Critical) Header Parameter MUST be integrity protected');
  if (!r || r.crit === void 0) return /* @__PURE__ */ new Set();
  if (!Array.isArray(r.crit) || r.crit.length === 0 || r.crit.some((o) => typeof o != "string" || o.length === 0)) throw new e('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  let n;
  t !== void 0 ? n = new Map([...Object.entries(t), ...s.entries()]) : n = s;
  for (const o of r.crit) {
    if (!n.has(o)) throw new me(`Extension Header Parameter "${o}" is not recognized`);
    if (a[o] === void 0) throw new e(`Extension Header Parameter "${o}" is missing`);
    if (n.get(o) && r[o] === void 0) throw new e(`Extension Header Parameter "${o}" MUST be integrity protected`);
  }
  return new Set(r.crit);
}
__name(Kn, "Kn");
__name2(Kn, "Kn");
var Bn = /* @__PURE__ */ __name2((e, s) => {
  if (s !== void 0 && (!Array.isArray(s) || s.some((t) => typeof t != "string"))) throw new TypeError(`"${e}" option must be an array of strings`);
  if (s) return new Set(s);
}, "Bn");
function Jn(e, s) {
  const t = `SHA-${e.slice(-3)}`;
  switch (e) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash: t, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash: t, name: "RSA-PSS", saltLength: e.slice(-3) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash: t, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash: t, name: "ECDSA", namedCurve: s.namedCurve };
    case "Ed25519":
      return { name: "Ed25519" };
    case "EdDSA":
      return { name: s.name };
    default:
      throw new me(`alg ${e} is not supported either by JOSE or your javascript runtime`);
  }
}
__name(Jn, "Jn");
__name2(Jn, "Jn");
async function Vn(e, s, t) {
  if (s = await Wn.normalizePublicKey(s, e), nr(s)) return Cn(s, e, t), s;
  if (s instanceof Uint8Array) {
    if (!e.startsWith("HS")) throw new TypeError(Et(s, ...Ds));
    return rt.subtle.importKey("raw", s, { hash: `SHA-${e.slice(-3)}`, name: "HMAC" }, false, [t]);
  }
  throw new TypeError(Et(s, ...Ds, "Uint8Array", "JSON Web Key"));
}
__name(Vn, "Vn");
__name2(Vn, "Vn");
var Yn = /* @__PURE__ */ __name2(async (e, s, t, r) => {
  const a = await Vn(e, s, "verify");
  Ln(e, a);
  const n = Jn(e, a.algorithm);
  try {
    return await rt.subtle.verify(n, a, t, r);
  } catch {
    return false;
  }
}, "Yn");
async function zn(e, s, t) {
  if (!Ie(e)) throw new J("Flattened JWS must be an object");
  if (e.protected === void 0 && e.header === void 0) throw new J('Flattened JWS must have either of the "protected" or "header" members');
  if (e.protected !== void 0 && typeof e.protected != "string") throw new J("JWS Protected Header incorrect type");
  if (e.payload === void 0) throw new J("JWS Payload missing");
  if (typeof e.signature != "string") throw new J("JWS Signature missing or incorrect type");
  if (e.header !== void 0 && !Ie(e.header)) throw new J("JWS Unprotected Header incorrect type");
  let r = {};
  if (e.protected) try {
    const E = Le(e.protected);
    r = JSON.parse(Ls.decode(E));
  } catch {
    throw new J("JWS Protected Header is invalid");
  }
  if (!Nn(r, e.header)) throw new J("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const a = { ...r, ...e.header }, n = Kn(J, /* @__PURE__ */ new Map([["b64", true]]), t == null ? void 0 : t.crit, r, a);
  let o = true;
  if (n.has("b64") && (o = r.b64, typeof o != "boolean")) throw new J('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
  const { alg: i } = a;
  if (typeof i != "string" || !i) throw new J('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  const c = t && Bn("algorithms", t.algorithms);
  if (c && !c.has(i)) throw new or('"alg" (Algorithm) Header Parameter value not allowed');
  if (o) {
    if (typeof e.payload != "string") throw new J("JWS Payload must be a string");
  } else if (typeof e.payload != "string" && !(e.payload instanceof Uint8Array)) throw new J("JWS Payload must be a string or an Uint8Array instance");
  let l = false;
  typeof s == "function" ? (s = await s(r, e), l = true, gt(i, s, "verify"), es(s) && (s = await hr(s, i))) : gt(i, s, "verify");
  const u = Rn(Ss.encode(e.protected ?? ""), Ss.encode("."), typeof e.payload == "string" ? Ss.encode(e.payload) : e.payload);
  let d;
  try {
    d = Le(e.signature);
  } catch {
    throw new J("Failed to base64url decode the signature");
  }
  if (!await Yn(i, s, d, u)) throw new lr();
  let _;
  if (o) try {
    _ = Le(e.payload);
  } catch {
    throw new J("Failed to base64url decode the payload");
  }
  else typeof e.payload == "string" ? _ = Ss.encode(e.payload) : _ = e.payload;
  const f = { payload: _ };
  return e.protected !== void 0 && (f.protectedHeader = r), e.header !== void 0 && (f.unprotectedHeader = e.header), l ? { ...f, key: s } : f;
}
__name(zn, "zn");
__name2(zn, "zn");
async function Gn(e, s, t) {
  if (e instanceof Uint8Array && (e = Ls.decode(e)), typeof e != "string") throw new J("Compact JWS must be a string or Uint8Array");
  const { 0: r, 1: a, 2: n, length: o } = e.split(".");
  if (o !== 3) throw new J("Invalid Compact JWS");
  const i = await zn({ payload: a, protected: r, signature: n }, s, t), c = { payload: i.payload, protectedHeader: i.protectedHeader };
  return typeof s == "function" ? { ...c, key: i.key } : c;
}
__name(Gn, "Gn");
__name2(Gn, "Gn");
var Xn = /* @__PURE__ */ __name2((e) => Math.floor(e.getTime() / 1e3), "Xn");
var gr = 60;
var yr = gr * 60;
var it = yr * 24;
var Qn = it * 7;
var Zn = it * 365.25;
var eo = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var yt = /* @__PURE__ */ __name2((e) => {
  const s = eo.exec(e);
  if (!s || s[4] && s[1]) throw new TypeError("Invalid time period format");
  const t = parseFloat(s[2]), r = s[3].toLowerCase();
  let a;
  switch (r) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      a = Math.round(t);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      a = Math.round(t * gr);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      a = Math.round(t * yr);
      break;
    case "day":
    case "days":
    case "d":
      a = Math.round(t * it);
      break;
    case "week":
    case "weeks":
    case "w":
      a = Math.round(t * Qn);
      break;
    default:
      a = Math.round(t * Zn);
      break;
  }
  return s[1] === "-" || s[4] === "ago" ? -a : a;
}, "yt");
var wt = /* @__PURE__ */ __name2((e) => e.toLowerCase().replace(/^application\//, ""), "wt");
var so = /* @__PURE__ */ __name2((e, s) => typeof e == "string" ? s.includes(e) : Array.isArray(e) ? s.some(Set.prototype.has.bind(new Set(e))) : false, "so");
var to = /* @__PURE__ */ __name2((e, s, t = {}) => {
  let r;
  try {
    r = JSON.parse(Ls.decode(s));
  } catch {
  }
  if (!Ie(r)) throw new at("JWT Claims Set must be a top-level JSON object");
  const { typ: a } = t;
  if (a && (typeof e.typ != "string" || wt(e.typ) !== wt(a))) throw new oe('unexpected "typ" JWT header value', r, "typ", "check_failed");
  const { requiredClaims: n = [], issuer: o, subject: i, audience: c, maxTokenAge: l } = t, u = [...n];
  l !== void 0 && u.push("iat"), c !== void 0 && u.push("aud"), i !== void 0 && u.push("sub"), o !== void 0 && u.push("iss");
  for (const f of new Set(u.reverse())) if (!(f in r)) throw new oe(`missing required "${f}" claim`, r, f, "missing");
  if (o && !(Array.isArray(o) ? o : [o]).includes(r.iss)) throw new oe('unexpected "iss" claim value', r, "iss", "check_failed");
  if (i && r.sub !== i) throw new oe('unexpected "sub" claim value', r, "sub", "check_failed");
  if (c && !so(r.aud, typeof c == "string" ? [c] : c)) throw new oe('unexpected "aud" claim value', r, "aud", "check_failed");
  let d;
  switch (typeof t.clockTolerance) {
    case "string":
      d = yt(t.clockTolerance);
      break;
    case "number":
      d = t.clockTolerance;
      break;
    case "undefined":
      d = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate: m } = t, _ = Xn(m || /* @__PURE__ */ new Date());
  if ((r.iat !== void 0 || l) && typeof r.iat != "number") throw new oe('"iat" claim must be a number', r, "iat", "invalid");
  if (r.nbf !== void 0) {
    if (typeof r.nbf != "number") throw new oe('"nbf" claim must be a number', r, "nbf", "invalid");
    if (r.nbf > _ + d) throw new oe('"nbf" claim timestamp check failed', r, "nbf", "check_failed");
  }
  if (r.exp !== void 0) {
    if (typeof r.exp != "number") throw new oe('"exp" claim must be a number', r, "exp", "invalid");
    if (r.exp <= _ - d) throw new Vs('"exp" claim timestamp check failed', r, "exp", "check_failed");
  }
  if (l) {
    const f = _ - r.iat, E = typeof l == "number" ? l : yt(l);
    if (f - d > E) throw new Vs('"iat" claim timestamp check failed (too far in the past)', r, "iat", "check_failed");
    if (f < 0 - d) throw new oe('"iat" claim timestamp check failed (it should be in the past)', r, "iat", "check_failed");
  }
  return r;
}, "to");
async function ro(e, s, t) {
  var o;
  const r = await Gn(e, s, t);
  if ((o = r.protectedHeader.crit) != null && o.includes("b64") && r.protectedHeader.b64 === false) throw new at("JWTs MUST NOT use unencoded payload");
  const n = { payload: to(r.protectedHeader, r.payload, t), protectedHeader: r.protectedHeader };
  return typeof s == "function" ? { ...n, key: r.key } : n;
}
__name(ro, "ro");
__name2(ro, "ro");
function ao(e) {
  switch (typeof e == "string" && e.slice(0, 2)) {
    case "RS":
    case "PS":
      return "RSA";
    case "ES":
      return "EC";
    case "Ed":
      return "OKP";
    default:
      throw new me('Unsupported "alg" value for a JSON Web Key Set');
  }
}
__name(ao, "ao");
__name2(ao, "ao");
function no(e) {
  return e && typeof e == "object" && Array.isArray(e.keys) && e.keys.every(oo);
}
__name(no, "no");
__name2(no, "no");
function oo(e) {
  return Ie(e);
}
__name(oo, "oo");
__name2(oo, "oo");
function wr(e) {
  return typeof structuredClone == "function" ? structuredClone(e) : JSON.parse(JSON.stringify(e));
}
__name(wr, "wr");
__name2(wr, "wr");
var io = class {
  static {
    __name(this, "io");
  }
  static {
    __name2(this, "io");
  }
  constructor(s) {
    if (this._cached = /* @__PURE__ */ new WeakMap(), !no(s)) throw new nt("JSON Web Key Set malformed");
    this._jwks = wr(s);
  }
  async getKey(s, t) {
    const { alg: r, kid: a } = { ...s, ...t == null ? void 0 : t.header }, n = ao(r), o = this._jwks.keys.filter((l) => {
      let u = n === l.kty;
      if (u && typeof a == "string" && (u = a === l.kid), u && typeof l.alg == "string" && (u = r === l.alg), u && typeof l.use == "string" && (u = l.use === "sig"), u && Array.isArray(l.key_ops) && (u = l.key_ops.includes("verify")), u) switch (r) {
        case "ES256":
          u = l.crv === "P-256";
          break;
        case "ES256K":
          u = l.crv === "secp256k1";
          break;
        case "ES384":
          u = l.crv === "P-384";
          break;
        case "ES512":
          u = l.crv === "P-521";
          break;
        case "Ed25519":
          u = l.crv === "Ed25519";
          break;
        case "EdDSA":
          u = l.crv === "Ed25519" || l.crv === "Ed448";
          break;
      }
      return u;
    }), { 0: i, length: c } = o;
    if (c === 0) throw new ot();
    if (c !== 1) {
      const l = new ir(), { _cached: u } = this;
      throw l[Symbol.asyncIterator] = async function* () {
        for (const d of o) try {
          yield await bt(u, d, r);
        } catch {
        }
      }, l;
    }
    return bt(this._cached, i, r);
  }
};
async function bt(e, s, t) {
  const r = e.get(s) || e.set(s, {}).get(s);
  if (r[t] === void 0) {
    const a = await hr({ ...s, ext: true }, t);
    if (a instanceof Uint8Array || a.type !== "public") throw new nt("JSON Web Key Set members must be public keys");
    r[t] = a;
  }
  return r[t];
}
__name(bt, "bt");
__name2(bt, "bt");
function St(e) {
  const s = new io(e), t = /* @__PURE__ */ __name2(async (r, a) => s.getKey(r, a), "t");
  return Object.defineProperties(t, { jwks: { value: /* @__PURE__ */ __name2(() => wr(s._jwks), "value"), enumerable: true, configurable: false, writable: false } }), t;
}
__name(St, "St");
__name2(St, "St");
var co = /* @__PURE__ */ __name2(async (e, s, t) => {
  let r, a, n = false;
  typeof AbortController == "function" && (r = new AbortController(), a = setTimeout(() => {
    n = true, r.abort();
  }, s));
  const o = await fetch(e.href, { signal: r ? r.signal : void 0, redirect: "manual", headers: t.headers }).catch((i) => {
    throw n ? new cr() : i;
  });
  if (a !== void 0 && clearTimeout(a), o.status !== 200) throw new X("Expected 200 OK from the JSON Web Key Set HTTP response");
  try {
    return await o.json();
  } catch {
    throw new X("Failed to parse the JSON Web Key Set HTTP response as JSON");
  }
}, "co");
function lo() {
  return typeof WebSocketPair < "u" || typeof navigator < "u" && true || typeof EdgeRuntime < "u" && EdgeRuntime === "vercel";
}
__name(lo, "lo");
__name2(lo, "lo");
var zs;
var Ts;
var Pt;
(typeof navigator > "u" || !((Pt = (Ts = "Cloudflare-Workers") == null ? void 0 : Ts.startsWith) != null && Pt.call(Ts, "Mozilla/5.0 "))) && (zs = "jose/v5.10.0");
var Hs = /* @__PURE__ */ Symbol();
function uo(e, s) {
  return !(typeof e != "object" || e === null || !("uat" in e) || typeof e.uat != "number" || Date.now() - e.uat >= s || !("jwks" in e) || !Ie(e.jwks) || !Array.isArray(e.jwks.keys) || !Array.prototype.every.call(e.jwks.keys, Ie));
}
__name(uo, "uo");
__name2(uo, "uo");
var po = class {
  static {
    __name(this, "po");
  }
  static {
    __name2(this, "po");
  }
  constructor(s, t) {
    if (!(s instanceof URL)) throw new TypeError("url must be an instance of URL");
    this._url = new URL(s.href), this._options = { agent: t == null ? void 0 : t.agent, headers: t == null ? void 0 : t.headers }, this._timeoutDuration = typeof (t == null ? void 0 : t.timeoutDuration) == "number" ? t == null ? void 0 : t.timeoutDuration : 5e3, this._cooldownDuration = typeof (t == null ? void 0 : t.cooldownDuration) == "number" ? t == null ? void 0 : t.cooldownDuration : 3e4, this._cacheMaxAge = typeof (t == null ? void 0 : t.cacheMaxAge) == "number" ? t == null ? void 0 : t.cacheMaxAge : 6e5, (t == null ? void 0 : t[Hs]) !== void 0 && (this._cache = t == null ? void 0 : t[Hs], uo(t == null ? void 0 : t[Hs], this._cacheMaxAge) && (this._jwksTimestamp = this._cache.uat, this._local = St(this._cache.jwks)));
  }
  coolingDown() {
    return typeof this._jwksTimestamp == "number" ? Date.now() < this._jwksTimestamp + this._cooldownDuration : false;
  }
  fresh() {
    return typeof this._jwksTimestamp == "number" ? Date.now() < this._jwksTimestamp + this._cacheMaxAge : false;
  }
  async getKey(s, t) {
    (!this._local || !this.fresh()) && await this.reload();
    try {
      return await this._local(s, t);
    } catch (r) {
      if (r instanceof ot && this.coolingDown() === false) return await this.reload(), this._local(s, t);
      throw r;
    }
  }
  async reload() {
    this._pendingFetch && lo() && (this._pendingFetch = void 0);
    const s = new Headers(this._options.headers);
    zs && !s.has("User-Agent") && (s.set("User-Agent", zs), this._options.headers = Object.fromEntries(s.entries())), this._pendingFetch || (this._pendingFetch = co(this._url, this._timeoutDuration, this._options).then((t) => {
      this._local = St(t), this._cache && (this._cache.uat = Date.now(), this._cache.jwks = t), this._jwksTimestamp = Date.now(), this._pendingFetch = void 0;
    }).catch((t) => {
      throw this._pendingFetch = void 0, t;
    })), await this._pendingFetch;
  }
};
function mo(e, s) {
  const t = new po(e, s), r = /* @__PURE__ */ __name2(async (a, n) => t.getKey(a, n), "r");
  return Object.defineProperties(r, { coolingDown: { get: /* @__PURE__ */ __name2(() => t.coolingDown(), "get"), enumerable: true, configurable: false }, fresh: { get: /* @__PURE__ */ __name2(() => t.fresh(), "get"), enumerable: true, configurable: false }, reload: { value: /* @__PURE__ */ __name2(() => t.reload(), "value"), enumerable: true, configurable: false, writable: false }, reloading: { get: /* @__PURE__ */ __name2(() => !!t._pendingFetch, "get"), enumerable: true, configurable: false }, jwks: { value: /* @__PURE__ */ __name2(() => {
    var a;
    return (a = t._local) == null ? void 0 : a.jwks();
  }, "value"), enumerable: true, configurable: false, writable: false } }), r;
}
__name(mo, "mo");
__name2(mo, "mo");
var _e = /* @__PURE__ */ new Map();
var V = { hits: 0, misses: 0, writes: 0, evictions: 0 };
function ve(e) {
  const s = _e.get(e);
  return s ? s.expires < Date.now() ? (_e.delete(e), V.evictions++, V.misses++, null) : (V.hits++, s.data) : (V.misses++, null);
}
__name(ve, "ve");
__name2(ve, "ve");
function se(e, s, t) {
  const r = Date.now() + t * 1e3;
  if (_e.set(e, { data: s, expires: r }), V.writes++, _e.size > 1e3) {
    const a = _e.keys().next().value;
    a && (_e.delete(a), V.evictions++);
  }
}
__name(se, "se");
__name2(se, "se");
function _o(e) {
  let s = 0;
  for (const t of _e.keys()) t.includes(e) && (_e.delete(t), s++);
  return s;
}
__name(_o, "_o");
__name2(_o, "_o");
async function ss(e, s) {
  const t = Array.isArray(s) ? s : [s];
  for (const r of t) {
    const a = _o(r);
    a > 0 && console.log(`[Cache] \u{1F9F9} \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uC0AD\uC81C: ${r} (${a}\uAC1C)`);
    try {
      await e.CACHE_KV.delete(r), console.log(`[Cache] \u{1F9F9} KV \uCE90\uC2DC \uC0AD\uC81C: ${r}`);
    } catch (n) {
      console.error(`[Cache] \u274C KV \uCE90\uC2DC \uC0AD\uC81C \uC2E4\uD328: ${r}`, n);
    }
  }
}
__name(ss, "ss");
__name2(ss, "ss");
var ts = { LIVE_STREAMS: ["streams:live", "streams:all", "streams:scheduled", "live_streams:live:all:20:0", "live_streams:"], PRODUCTS: ["products:", "featured_products"], CART: /* @__PURE__ */ __name2((e) => [`cart:${e}`], "CART"), ORDERS: /* @__PURE__ */ __name2((e) => [`orders:${e}`], "ORDERS"), ALL: ["streams:", "live_streams:", "products:", "cart:", "orders:"] };
function fo(e) {
  const s = e.status >= 500 ? "error" : e.status >= 400 ? "warn" : "info";
  console.log(JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: s, message: "API Request", context: e, duration: e.duration }));
}
__name(fo, "fo");
__name2(fo, "fo");
function ho(e) {
  return { name: "tosspayments", async confirmPayment(s) {
    try {
      const t = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: `Basic ${btoa(e + ":")}`, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify({ paymentKey: s.paymentKey, orderId: s.orderId, amount: s.amount }) }), r = await t.json();
      if (!t.ok) return { success: false, orderId: s.orderId, paymentKey: s.paymentKey, method: "", totalAmount: s.amount, status: "FAILED", approvedAt: "", error: r.message || "\uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328", rawData: r };
      let a = {};
      r.card && (a = { cardCompany: r.card.company, cardNumber: r.card.number, installmentMonths: r.card.installmentPlanMonths || 0 });
      let n = {};
      return r.virtualAccount && (n = { virtualAccountBank: r.virtualAccount.bankCode, virtualAccountNumber: r.virtualAccount.accountNumber, virtualAccountHolder: r.virtualAccount.customerName, virtualAccountDueDate: r.virtualAccount.dueDate }), { success: true, orderId: r.orderId, paymentKey: r.paymentKey, method: r.method, totalAmount: r.totalAmount, status: r.status, approvedAt: r.approvedAt, transactionId: r.transactionKey, ...a, ...n, rawData: r };
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
__name(ho, "ho");
__name2(ho, "ho");
function Eo(e, s) {
  switch (e.toLowerCase()) {
    case "tosspayments":
      return ho(s);
    default:
      throw new Error(`Unknown payment provider: ${e}`);
  }
}
__name(Eo, "Eo");
__name2(Eo, "Eo");
var p = new er();
p.use("*", async (e, s) => {
  if (e.req.url.includes("localhost") || e.req.url.includes("127.0.0.1")) try {
    Ea(e.env), ga(e.env);
  } catch (r) {
    console.error("[ENV] Validation failed:", r);
  }
  await s();
});
async function go(e) {
  try {
    const s = e.req.header("Authorization"), t = (s == null ? void 0 : s.replace("Bearer ", "")) || "";
    if (!t) return console.warn("[Firebase Auth] No token provided"), null;
    try {
      const { verifyFirebaseIdToken: r } = await Promise.resolve().then(() => Uo), a = await r(t, e.env.FIREBASE_PROJECT_ID || "urteam-live-commerce-5b284");
      console.log("[Firebase Auth] \u2705 Firebase token verified:", a.uid);
      const n = await e.env.DB.prepare(`
        SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?
      `).bind(a.uid).first();
      if (!n) return console.warn("[Firebase Auth] User not found for UID:", a.uid), null;
      const o = a.role || n.user_type || "user";
      return console.log("[Firebase Auth] \u2705 User authenticated:", { userId: n.id, userType: o, email: n.email, firebaseUID: a.uid }), { userId: n.id, userType: o, email: n.email, firebaseUID: a.uid };
    } catch (r) {
      return console.error("[Firebase Auth] Token verification failed:", r), null;
    }
  } catch (s) {
    return console.error("[Firebase Auth Error]", s), null;
  }
}
__name(go, "go");
__name2(go, "go");
async function Pe(e, s, t) {
  if (!s) return null;
  const r = `session:${s}`;
  try {
    const a = ve(r);
    if (a) return a;
    const n = await e.get(r);
    if (!n) return null;
    const o = JSON.parse(n);
    if (o.expires_at && Date.now() > o.expires_at) return t != null && t.executionCtx || await e.delete(r), null;
    const i = { user_id: o.user_id, user_type: o.user_type || "user", created_at: o.created_at };
    return se(r, i, 900), i;
  } catch (a) {
    return console.error("[Auth] Session lookup error:", a), null;
  }
}
__name(Pe, "Pe");
__name2(Pe, "Pe");
async function j(e, s) {
  const t = await go(e);
  if (!t) return e.json({ success: false, error: "Authentication required - Firebase ID Token \uD544\uC694", code: "AUTH_REQUIRED" }, 401);
  e.set("user", { userId: t.userId, userType: t.userType, email: t.email, firebaseUID: t.firebaseUID }), e.set("userId", t.userId), e.set("userType", t.userType), e.set("email", t.email), e.set("firebaseUID", t.firebaseUID), await s();
}
__name(j, "j");
__name2(j, "j");
async function yo(e, s) {
  const t = e.get("userType"), r = e.get("userId");
  if (t !== "admin") return console.warn("[Security] Unauthorized admin access attempt:", { userId: r, userType: t }), e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await s();
}
__name(yo, "yo");
__name2(yo, "yo");
async function wo(e, s) {
  const t = e.get("userType"), r = e.get("userId");
  if (t !== "seller") return console.warn("[Security] Unauthorized seller access attempt:", { userId: r, userType: t }), e.json({ success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await s();
}
__name(wo, "wo");
__name2(wo, "wo");
async function bo(e) {
  return async (s, t) => {
    const r = s.get("userId");
    if (s.get("userType") === "admin") {
      await t();
      return;
    }
    const n = s.req.param("userId");
    if (n && n !== String(r)) return console.warn("[Security] Unauthorized resource access attempt:", { resourceType: e, requestedUserId: n, actualUserId: r }), s.json({ success: false, error: "\uBCF8\uC778\uC758 \uC815\uBCF4\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    await t();
  };
}
__name(bo, "bo");
__name2(bo, "bo");
async function So(e, s) {
  try {
    const t = ve(s);
    if (t !== null) return t;
    const r = await e.get(s);
    if (r) {
      const a = JSON.parse(r);
      return se(s, a, 300), a;
    }
    return null;
  } catch (t) {
    return console.error("[Cache] Read error:", t), null;
  }
}
__name(So, "So");
__name2(So, "So");
async function ds(e, s, t, r = 60, a = false) {
  try {
    se(s, t, r), a ? (await e.put(s, JSON.stringify(t), { expirationTtl: r }), console.log(`[Cache] \u2705 Saved to both Memory + KV: ${s}`)) : console.log(`[Cache] \u2705 Saved to Memory only (KV Write skipped): ${s}`);
  } catch (n) {
    console.error("[Cache] Write error:", n);
  }
}
__name(ds, "ds");
__name2(ds, "ds");
async function ct(e, ...s) {
  try {
    await Promise.all(s.map((t) => e.delete(t)));
  } catch (t) {
    console.error("[Cache] Delete error:", t);
  }
}
__name(ct, "ct");
__name2(ct, "ct");
async function ys(e, s, t, r, a, n, o) {
  try {
    await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s, t, r, a, n, o || null).run(), console.log(`[Notification] Created for ${t} ${s}: ${a}`);
  } catch (i) {
    console.error("[Notification] Create error:", i);
  }
}
__name(ys, "ys");
__name2(ys, "ys");
async function To(e, s, t, r, a) {
  await ys(e, s, "seller", "new_order", "\u{1F6D2} \uC2E0\uADDC \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r}\uB2D8\uC758 \uC8FC\uBB38 (${t}) - ${Ro(a)}`, "/seller/orders");
}
__name(To, "To");
__name2(To, "To");
async function br(e, s, t, r, a, n) {
  let o = "", i = "";
  switch (r) {
    case "preparing":
      o = "\u{1F4E6} \uC0C1\uD488 \uC900\uBE44 \uC911", i = `\uC8FC\uBB38\uBC88\uD638 ${t}\uC758 \uC0C1\uD488\uC744 \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4`;
      break;
    case "shipping":
      o = "\u{1F69A} \uBC30\uC1A1\uC774 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4", i = `\uC8FC\uBB38\uBC88\uD638 ${t}\uAC00 \uBC30\uC1A1 \uC911\uC785\uB2C8\uB2E4`, a && n && (i += ` (${a}: ${n})`);
      break;
    case "delivered":
      o = "\u2705 \uBC30\uC1A1 \uC644\uB8CC", i = `\uC8FC\uBB38\uBC88\uD638 ${t}\uAC00 \uBC30\uC1A1 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`;
      break;
    default:
      return;
  }
  await ys(e, s, "user", "shipping_status", o, i, "/my-orders");
}
__name(br, "br");
__name2(br, "br");
async function Sr(e, s, t, r, a) {
  await ys(e, s, "seller", "low_stock", "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", `${t}\uC758 \uC7AC\uACE0\uAC00 ${r}\uAC1C\uB85C \uBD80\uC871\uD569\uB2C8\uB2E4 (\uAE30\uC900: ${a}\uAC1C)`, "/seller/products");
}
__name(Sr, "Sr");
__name2(Sr, "Sr");
function Ro(e) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(e);
}
__name(Ro, "Ro");
__name2(Ro, "Ro");
async function Io(e, s, t) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const r = await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: s, description: t, scheduledStartTime: (/* @__PURE__ */ new Date()).toISOString() }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false }, contentDetails: { enableAutoStart: true, enableAutoStop: true } }) });
    if (!r.ok) {
      const d = await r.text();
      throw new Error(`YouTube Broadcast \uC0DD\uC131 \uC2E4\uD328: ${d}`);
    }
    const n = (await r.json()).id, o = await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: `${s} - Stream` }, cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" } }) });
    if (!o.ok) {
      const d = await o.text();
      throw new Error(`YouTube Stream \uC0DD\uC131 \uC2E4\uD328: ${d}`);
    }
    const i = await o.json(), c = i.id, l = i.cdn.ingestionInfo.streamName, u = i.cdn.ingestionInfo.ingestionAddress;
    return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`, { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}` } }), { broadcastId: n, streamId: c, streamKey: l, streamUrl: u };
  } catch (r) {
    throw console.error("[YouTube API] Live broadcast creation failed:", r), r;
  }
}
__name(Io, "Io");
__name2(Io, "Io");
async function vo(e, s) {
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
__name(vo, "vo");
__name2(vo, "vo");
async function Ao(e, s, t) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    let r = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${s}&part=snippet,authorDetails`;
    t && (r += `&pageToken=${t}`);
    const a = await fetch(r, { headers: { Authorization: `Bearer ${e.accessToken}` } });
    if (!a.ok) {
      const o = await a.text();
      throw new Error(`YouTube \uCC44\uD305 \uBA54\uC2DC\uC9C0 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${o}`);
    }
    const n = await a.json();
    return { messages: n.items || [], nextPageToken: n.nextPageToken, pollingIntervalMillis: n.pollingIntervalMillis || 5e3 };
  } catch (r) {
    throw console.error("[YouTube API] Get chat messages failed:", r), r;
  }
}
__name(Ao, "Ao");
__name2(Ao, "Ao");
async function Oo(e, s) {
  if (!e.apiKey && !e.accessToken) throw new Error("YouTube API Key \uB610\uB294 Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const t = e.accessToken ? { Authorization: `Bearer ${e.accessToken}` } : {}, r = e.accessToken ? `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}` : `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}&key=${e.apiKey}`, a = await fetch(r, { headers: t });
    if (!a.ok) {
      const l = await a.text();
      throw new Error(`YouTube \uD1B5\uACC4 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${l}`);
    }
    const n = await a.json();
    if (!n.items || n.items.length === 0) throw new Error("Video not found");
    const o = n.items[0], i = o.statistics, c = o.liveStreamingDetails;
    return { viewCount: parseInt(i.viewCount || "0"), likeCount: parseInt(i.likeCount || "0"), commentCount: parseInt(i.commentCount || "0"), concurrentViewers: c != null && c.concurrentViewers ? parseInt(c.concurrentViewers) : void 0 };
  } catch (t) {
    throw console.error("[YouTube API] Get live stats failed:", t), t;
  }
}
__name(Oo, "Oo");
__name2(Oo, "Oo");
function Tr(e) {
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
__name(Tr, "Tr");
__name2(Tr, "Tr");
function Rr(e) {
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
__name(Rr, "Rr");
__name2(Rr, "Rr");
function Do(e) {
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
__name(Do, "Do");
__name2(Do, "Do");
function Ir(e) {
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
__name(Ir, "Ir");
__name2(Ir, "Ir");
p.use("*", async (e, s) => {
  await s(), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");
  const t = new URL(e.req.url);
  t.hostname !== "localhost" && t.protocol === "https:" && e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("X-Frame-Options", "SAMEORIGIN"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
p.use("/api/*", S());
p.use($e(Fe.auth));
p.use($e(Fe.alimtalk));
p.use($e(Fe.order));
p.use($e(Fe.refund));
p.use($e(Fe.cart));
p.use($e(Fe.upload));
p.use("/api/*", $e(Fe.api));
p.use("*", async (e, s) => {
  await s(), e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"), e.header("X-Frame-Options", "DENY"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
p.use("/api/*", async (e, s) => {
  const t = Date.now(), r = e.req.method, a = e.req.path;
  await s();
  const n = Date.now() - t, o = e.res.status, i = { method: r, path: a, status: o, duration: n }, c = e.get("userId");
  c && (i.userId = c), fo(i);
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
  const r = await yo(e, () => Promise.resolve());
  return r || s();
});
p.use("/api/seller*", async (e, s) => {
  if (e.req.path === "/api/seller/register") return s();
  const t = await j(e, () => Promise.resolve());
  if (t) return t;
  const r = await wo(e, () => Promise.resolve());
  return r || s();
});
async function rs(e, s) {
  const t = await e.get(`session:${s}`);
  if (!t) return null;
  const r = JSON.parse(t);
  return r.expires_at && Date.now() > r.expires_at ? (await e.delete(`session:${s}`), null) : { session_token: s, [`${r.user_type}_id`]: r.user_id, user_type: r.user_type, ...r.userData };
}
__name(rs, "rs");
__name2(rs, "rs");
p.post("/api/auth/user/register", S(), Fa(qa), async (e) => {
  const { DB: s } = e.env;
  try {
    const { email: t, password: r, name: a, phone: n } = e.get("validatedData"), o = `placeholder_hash_for_${r}`;
    try {
      const c = (await s.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(t, o, a, n || null).run()).meta.last_row_id, l = `user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      return e.json({ success: true, data: { access_token: l, user: { id: c, email: t, name: a, phone: n } } });
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
    const n = await s.prepare(`
      SELECT id, email, name, kakao_id, password_hash, password, created_at
      FROM users 
      WHERE email = ?
    `).bind(r).first();
    if (!n) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(n.password_hash && n.password_hash.includes(`placeholder_hash_for_${a}`) || n.password && n.password === a)) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    await s.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();
    const i = crypto.randomUUID(), c = Date.now() + 720 * 60 * 60 * 1e3;
    return await t.put(`session:${i}`, JSON.stringify({ user_id: n.id, user_type: "user", expires_at: c, created_at: Date.now() }), { expirationTtl: 720 * 60 * 60 }), console.log("[User Login] Session created in SESSION_KV for user:", n.id), e.json({ success: true, data: { session_token: i, user: { id: n.id, email: n.email, name: n.name, phone: n.phone, profile_image: n.profile_image } } });
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
    const { email: t, password: r, name: a, phone: n, business_number: o, company_name: i } = await e.req.json();
    if (!t || !r || !a || !n) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (r.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const c = t.split("@")[0], l = `placeholder_hash_for_${r}`;
    try {
      const u = await s.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c, t, l, a, n, o || null, i || null).run();
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
    const i = gs(e.env), c = `admin_${a.id}`;
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
    const r = await rs(e.env.SESSION_KV, t);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = r.user_type === "admin" ? "admins" : "sellers", n = r.user_type === "admin" ? r.admin_id : r.seller_id, o = await s.prepare(`
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
    `).bind(n).first();
    return o ? e.json({ success: true, data: { user: { id: o.id, type: r.user_type, username: o.username, name: o.name, email: o.email, businessName: o.business_name } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/auth/kakao/sync/callback", async (e) => {
  var t, r, a, n, o, i, c, l, u, d, m, _, f;
  const { DB: s } = e.env;
  try {
    console.log("[Kakao Sync] Callback started"), console.log("[Kakao Sync] DB available:", !!s);
    const E = e.req.query("code"), b = e.req.query("state") || "/", w = e.req.query("error");
    if (console.log("[Kakao Sync] Query params:", { hasCode: !!E, state: b, error: w }), w) return console.error("[Kakao Sync] OAuth error:", w), e.redirect(`${b}?error=kakao_oauth_${w}`);
    if (!E) return console.error("[Kakao Sync] No authorization code"), e.redirect(`${b}?error=no_code`);
    console.log("[Kakao Sync] Authorization code received");
    const g = e.env.KAKAO_REST_API_KEY || "5dd74bccb797640b0efd070467f3bafd", T = `${new URL(e.req.url).origin}/auth/kakao/sync/callback`;
    console.log("[Kakao Sync] Exchanging code for token..."), console.log("  - REST_API_KEY:", g.substring(0, 10) + "..."), console.log("  - REDIRECT_URI:", T), console.log("[Kakao Sync] Step 1: Fetching access token...");
    const y = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: g, redirect_uri: T, code: E }) });
    if (console.log("[Kakao Sync] Token response status:", y.status), console.log("[Kakao Sync] Token request details:", { client_id: g, redirect_uri: T, code_length: E.length, code_prefix: E.substring(0, 20) }), !y.ok) {
      const q = await y.text();
      return console.error("[Kakao Sync] Token request failed:", q), e.redirect(`${b}?error=token_request_failed&detail=${encodeURIComponent(q)}`);
    }
    const R = await y.json();
    if (console.log("[Kakao Sync] Token data received:", { hasAccessToken: !!R.access_token, error: R.error, errorDescription: R.error_description }), !R.access_token) return console.error("[Kakao Sync] Token error:", R), e.redirect(`${b}?error=token_failed&detail=${encodeURIComponent(R.error || "unknown")}`);
    console.log("[Kakao Sync] Access token obtained successfully"), console.log("[Kakao Sync] Step 2: Fetching user info...");
    const $ = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${R.access_token}` } });
    console.log("[Kakao Sync] User response status:", $.status);
    const k = await $.json();
    if (console.log("[Kakao Sync] User data received:", { hasId: !!k.id, id: k.id, hasNickname: !!((t = k.properties) != null && t.nickname || (a = (r = k.kakao_account) == null ? void 0 : r.profile) != null && a.nickname) }), !k.id) return console.error("[Kakao Sync] Failed to get user info:", k), e.redirect(`${b}?error=user_info_failed`);
    console.log("[Kakao Sync] User info obtained successfully"), console.log("[Kakao Sync] Step 2.5: Fetching service terms...");
    const O = await fetch("https://kapi.kakao.com/v2/user/service_terms", { headers: { Authorization: `Bearer ${R.access_token}` } });
    console.log("[Kakao Sync] Terms response status:", O.status);
    let W = null;
    if (O.ok ? (W = await O.json(), console.log("[Kakao Sync] Service terms received:", { allowedServiceTerms: ((n = W.allowed_service_terms) == null ? void 0 : n.length) || 0, tags: (o = W.allowed_service_terms) == null ? void 0 : o.map((q) => q.tag) })) : console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"), console.log("[Kakao Sync] Step 3: Saving user to database..."), !s) return console.error("[Kakao Sync] DB is not available!"), e.redirect(`${b}?error=db_not_available`);
    const P = k.id.toString(), L = ((i = k.properties) == null ? void 0 : i.nickname) || ((l = (c = k.kakao_account) == null ? void 0 : c.profile) == null ? void 0 : l.nickname) || "Kakao User", F = ((u = k.kakao_account) == null ? void 0 : u.email) || "", Q = ((d = k.properties) == null ? void 0 : d.profile_image) || ((_ = (m = k.kakao_account) == null ? void 0 : m.profile) == null ? void 0 : _.profile_image_url) || "", Y = R.access_token, v = ((f = W == null ? void 0 : W.allowed_service_terms) == null ? void 0 : f.map((q) => q.tag)) || [], te = JSON.stringify(v);
    console.log("[Kakao Sync] User data:", { kakaoId: P, nickname: L, email: F ? "exists" : "none", serviceTerms: v });
    try {
      const q = await s.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(P).first();
      console.log("[Kakao Sync] Existing user check:", !!q);
      let U;
      q ? (U = q.id, await s.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L, F, Q, U).run(), console.log("[Kakao Sync] Updated user:", U)) : (U = (await s.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(P, L, F || null, Q || null).run()).meta.last_row_id, console.log("[Kakao Sync] Created user:", U)), console.log("[Kakao Sync] User saved successfully, userId:", U), console.log("[Kakao Sync] Step 4: Generating Firebase Custom Token...");
      const z = gs(e.env), de = `kakao_${P}`, ws = await z.createCustomToken(de, { role: "user", userId: U, email: F || void 0, kakaoId: P });
      try {
        await s.prepare(`
          UPDATE users SET firebase_uid = ? WHERE id = ?
        `).bind(de, U).run();
      } catch (Ms) {
        console.warn("[Kakao Sync] firebase_uid column not found, skipping update:", Ms);
      }
      console.log("[Kakao Sync] \u2705 Firebase Custom Token \uBC1C\uAE09 \uC644\uB8CC for user:", U), console.log("[Kakao Sync] Step 5: Redirecting with Firebase Custom Token...");
      const as = b.includes("?") ? `${b}&firebase_token=${encodeURIComponent(ws)}&userName=${encodeURIComponent(L)}` : `${b}?firebase_token=${encodeURIComponent(ws)}&userName=${encodeURIComponent(L)}`;
      return console.log("[Kakao Sync] Redirect URL (Firebase):", as.substring(0, 100) + "..."), e.redirect(as);
    } catch (q) {
      return console.error("[Kakao Sync] Database error:", q), console.error("[Kakao Sync] DB error details:", { message: q.message, name: q.name }), e.redirect(`${b}?error=database_error&detail=${encodeURIComponent(q.message)}`);
    }
  } catch (E) {
    console.error("[Kakao Sync] Exception:", E), console.error("[Kakao Sync] Error details:", { message: E.message, stack: E.stack, name: E.name });
    const b = e.req.query("state") || "/", w = encodeURIComponent(E.message || "unknown");
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
    const n = await Ca(t, a, e.env.KAKAO_REST_API_KEY), { user: o } = await tr(s, n), i = gs(e.env), c = `kakao_${o.kakao_id}`, l = await i.createCustomToken(c, { userId: o.id, userType: "user", email: o.email || void 0, kakaoId: o.kakao_id });
    console.log("[Kakao Callback] \u2705 Firebase Custom Token \uBC1C\uAE09 \uC644\uB8CC for user:", o.id);
    try {
      await s.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(c, o.id).run();
    } catch (u) {
      console.warn("[Kakao Callback] firebase_uid column not found, skipping update:", u);
    }
    return e.json({ success: true, data: { customToken: l, user: { id: o.id, name: o.name, email: o.email, profile_image: o.profile_image, firebaseUID: c } } });
  } catch (t) {
    return console.error("[Kakao Callback] Error:", t), t instanceof ae ? e.json({ success: false, error: t.message, code: t.code }, t.statusCode) : e.json({ success: false, error: t.message || "Internal server error", code: "UNKNOWN_ERROR" }, 500);
  }
});
p.post("/api/auth/kakao/firebase", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { accessToken: t } = await e.req.json();
    if (!t) return e.json({ success: false, error: "Access token is required" }, 400);
    console.log("[Kakao Firebase] Processing Kakao OAuth login");
    const r = Date.now(), { user: a } = await tr(s, t);
    console.log("[Kakao Firebase] ProcessKakaoLogin completed in", Date.now() - r, "ms");
    const n = await generateFirebaseCustomToken(a.id.toString(), { role: "user", email: a.email, name: a.name });
    return console.log("[Kakao Firebase] \u2705 Firebase Custom Token \uC0DD\uC131 \uC644\uB8CC for user:", a.id), console.log("[Kakao Firebase] Total login time:", Date.now() - r, "ms"), e.json({ success: true, customToken: n, user: { id: a.id, name: a.name, email: a.email, profile_image: a.profile_image } });
  } catch (t) {
    return console.error("[Kakao Firebase] Error:", t), t instanceof ae ? e.json({ success: false, error: t.message, code: t.code }, t.statusCode) : e.json({ success: false, error: t instanceof Error ? t.message : "Login failed", code: "UNKNOWN_ERROR" }, 500);
  }
});
var Ks = null;
function ko(e) {
  if (e != null && e.FIREBASE_PROJECT_ID) return e.FIREBASE_PROJECT_ID;
  const s = "urteam-live-commerce-5b284";
  return console.warn("[Firebase] \u26A0\uFE0F FIREBASE_PROJECT_ID \uD658\uACBD \uBCC0\uC218 \uC5C6\uC74C, \uD3F4\uBC31 \uC0AC\uC6A9:", s), s;
}
__name(ko, "ko");
__name2(ko, "ko");
async function Co(e, s) {
  var r;
  const t = ko(s);
  try {
    Ks || (Ks = mo(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")), console.log("[Firebase] \u2705 JWK Set initialized for project:", t));
    const { payload: a } = await ro(e, Ks, { issuer: `https://securetoken.google.com/${t}`, audience: t });
    return console.log("[Firebase] \u2705 Token verified:", { sub: a.sub, email: a.email, iss: a.iss, aud: a.aud, exp: a.exp }), a;
  } catch (a) {
    return console.error("[Firebase] \u274C Token verification failed:", { error: a.message, code: a.code, claim: a.claim, reason: a.reason, expectedProjectId: t }), a.code === "ERR_JWT_EXPIRED" ? console.error("[Firebase] Token expired. User needs to re-authenticate.") : a.code === "ERR_JWT_CLAIM_VALIDATION_FAILED" ? (console.error("[Firebase] Claim validation failed:", a.claim), a.claim === "aud" && (console.error("[Firebase] \u26A0\uFE0F Audience mismatch! Check FIREBASE_PROJECT_ID"), console.error("[Firebase] Expected:", t), console.error("[Firebase] Got:", (r = a.payload) == null ? void 0 : r.aud))) : a.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" && console.error("[Firebase] Invalid signature. Token may be tampered."), null;
  }
}
__name(Co, "Co");
__name2(Co, "Co");
p.post("/api/auth/firebase/sync", S(), async (e) => {
  var r, a;
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const { idToken: n, firebaseUid: o, email: i, displayName: c } = await e.req.json();
    if (!n || !o) return e.json({ success: false, error: "idToken and firebaseUid are required" }, 400);
    const l = `sync_limit:${o}`, u = await t.get(l);
    if (u) {
      const _ = Date.now() - parseInt(u);
      if (_ < 6e4) return console.log(`[Firebase Sync] \u23F3 Rate limited (${Math.floor((6e4 - _) / 1e3)}s remaining):`, o), e.json({ success: false, error: "Rate limited", retryAfter: Math.ceil((6e4 - _) / 1e3) }, 429);
    }
    console.log("[Firebase Sync] Syncing user to D1:", { firebaseUid: o, email: i });
    const d = await Co(n, e.env);
    if (console.log("[Firebase Sync] Token decoded:", { hasDecoded: !!d, decodedSub: d == null ? void 0 : d.sub, firebaseUid: o, match: (d == null ? void 0 : d.sub) === o }), !d || d.sub !== o) return console.error("[Firebase Sync] \u274C Token validation failed:", { decoded: !!d, expectedUid: o, actualSub: d == null ? void 0 : d.sub, projectId: ((r = e.env) == null ? void 0 : r.FIREBASE_PROJECT_ID) || "NOT_SET" }), e.json({ success: false, error: "Invalid Firebase token", details: { expectedUid: o, actualSub: (d == null ? void 0 : d.sub) || null, projectId: ((a = e.env) == null ? void 0 : a.FIREBASE_PROJECT_ID) || "NOT_SET" } }, 401);
    console.log("[Firebase Sync] \u2705 Token verified successfully");
    const m = await s.prepare("SELECT id, email, name FROM users WHERE firebase_uid = ?").bind(o).first();
    if (m) return await s.prepare(`
        UPDATE users 
        SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE firebase_uid = ?
      `).bind(i || m.email, c || m.name, o).run(), await t.put(l, Date.now().toString(), { expirationTtl: 60 }), console.log("[Firebase Sync] \u2705 \uAE30\uC874 \uC0AC\uC6A9\uC790 \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC:", m.id), e.json({ success: true, user: { id: m.id, email: i || m.email, name: c || m.name } });
    if (i) {
      const _ = await s.prepare("SELECT id, email, name FROM users WHERE email = ?").bind(i).first();
      if (_) return await s.prepare(`
            UPDATE users 
            SET firebase_uid = ?, name = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
          `).bind(o, c || _.name, i).run(), await t.put(l, Date.now().toString(), { expirationTtl: 60 }), console.log("[Firebase Sync] \u2705 \uAE30\uC874 \uC774\uBA54\uC77C \uC0AC\uC6A9\uC790\uC5D0 firebase_uid \uC5F0\uACB0:", _.id), e.json({ success: true, user: { id: _.id, email: _.email, name: c || _.name } });
    }
    return e.json({ success: false, error: "User not found. Please register first." }, 404);
  } catch (n) {
    return console.error("[Firebase Sync] Error:", n), e.json({ success: false, error: n instanceof Error ? n.message : "Sync failed" }, 500);
  }
});
p.post("/api/auth/firebase/register", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { idToken: t, firebaseUid: r, email: a, name: n, userType: o } = await e.req.json();
    if (!t || !r || !a || !n) return e.json({ success: false, error: "idToken, firebaseUid, email, and name are required" }, 400);
    console.log("[Firebase Register] Registering new user:", { firebaseUid: r, email: a, userType: o });
    const i = await verifyFirebaseToken(t, e.env);
    if (!i || i.uid !== r) return e.json({ success: false, error: "Invalid Firebase token" }, 401);
    const c = await s.prepare(`
      INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(r, a, n).run();
    return console.log("[Firebase Register] \u2705 \uC0C8 \uC0AC\uC6A9\uC790 \uC0DD\uC131 \uC644\uB8CC:", c.meta.last_row_id), e.json({ success: true, user: { id: c.meta.last_row_id, email: a, name: n, firebaseUid: r } });
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
      const n = await fetch("https://kapi.kakao.com/v1/user/unlink", { method: "POST", headers: { Authorization: `Bearer ${a.access_token}`, "Content-Type": "application/x-www-form-urlencoded" } }), o = await n.json();
      n.ok ? console.log("[Kakao Unlink] Kakao unlink successful:", o.id) : console.warn("[Kakao Unlink] Kakao unlink failed:", o);
    } catch (n) {
      console.error("[Kakao Unlink] Kakao API error:", n);
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
    const n = await s.prepare(`
      SELECT id, kakao_id, email, name, created_at
      FROM users 
      WHERE kakao_id = ?
    `).bind(r.toString()).first();
    return n ? (console.log("[Kakao Webhook] Deleting user data for user:", n.id), await s.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(), await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(), await s.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(), console.log("[Kakao Webhook] User data deleted successfully"), e.json({ success: true })) : (console.log("[Kakao Webhook] User not found:", r), e.json({ success: true }));
  } catch (t) {
    return console.error("[Kakao Webhook] Error:", t), e.json({ success: false, error: "Webhook processing failed" }, 500);
  }
});
p.get("/api/auth/user/verify", S(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const r = await rs(e.env.SESSION_KV, t);
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
    const t = await e.req.json(), r = t.user_id, a = t.recipient_name, n = t.phone, o = t.postal_code, i = t.address, c = t.address_detail, l = t.is_default;
    if (console.log("[POST /api/shipping-addresses] Received:", JSON.stringify(t)), !r || !a || !n || !i) return console.error("[POST /api/shipping-addresses] Missing required fields:", { userId: r, recipientName: a, phone: n, address: i }), e.json({ success: false, error: "\uD544\uC218 \uC815\uBCF4\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    l && await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(r).run();
    const u = await s.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a, n, o || "", i, c || "", l ? 1 : 0).run();
    return console.log("[POST /api/shipping-addresses] Success:", { id: u.meta.last_row_id }), e.json({ success: true, data: { id: u.meta.last_row_id } });
  } catch (t) {
    return console.error("[POST /api/shipping-addresses] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.put("/api/shipping-addresses/:id", S(), j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("id"), r = await e.req.json(), a = r.user_id, n = r.recipient_name, o = r.phone, i = r.postal_code, c = r.address, l = r.address_detail, u = r.is_default;
    return u && await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(), await s.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n, o, i || "", c, l || "", u ? 1 : 0, t, a).run(), e.json({ success: true });
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
async function x(e) {
  const s = e.req.header("Authorization");
  if (s != null && s.startsWith("Bearer ")) {
    const a = s.substring(7);
    try {
      const n = await verifyJWT(a, e.env.JWT_SECRET);
      return n.userType !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: n.userId, userData: n };
    } catch (n) {
      console.error("[verifyAdminSession] JWT verification failed:", n);
    }
  }
  const t = e.req.header("X-Session-Token");
  if (!t) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await rs(e.env.SESSION_KV, t);
  return !r || r.user_type !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: r.admin_id, userData: r };
}
__name(x, "x");
__name2(x, "x");
async function C(e) {
  const s = e.req.header("Authorization");
  if (s != null && s.startsWith("Bearer ")) {
    const a = s.substring(7);
    try {
      const n = await verifyJWT(a, e.env.JWT_SECRET);
      return n.userType !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: n.userId, userData: n };
    } catch (n) {
      console.error("[verifySellerSession] JWT verification failed:", n);
    }
  }
  const t = e.req.header("X-Session-Token");
  if (!t) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await rs(e.env.SESSION_KV, t);
  return !r || r.user_type !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: r.seller_id, userData: r };
}
__name(C, "C");
__name2(C, "C");
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
    for (const n of r.results) try {
      const o = await s.prepare(`
          SELECT product_id, quantity
          FROM order_items
          WHERE order_id = ?
        `).bind(n.id).all();
      if (o.results.length === 0) {
        console.warn(`[Cleanup] \u26A0\uFE0F \uC8FC\uBB38 ${n.order_number}: \uC544\uC774\uD15C \uC5C6\uC74C`);
        continue;
      }
      const i = o.results.map((c) => s.prepare(`
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
        `).bind(n.id).run(), console.log(`[Cleanup] \u2705 ${n.order_number}: ${o.results.length}\uAC1C \uC0C1\uD488 \uC608\uC57D \uD574\uC81C`), a++;
    } catch (o) {
      console.error(`[Cleanup] \u274C ${n.order_number} \uCC98\uB9AC \uC2E4\uD328:`, o);
    }
    return console.log(`[Cleanup] \u2705 \uC815\uB9AC \uC644\uB8CC: ${a}/${r.results.length}\uAC1C`), e.json({ success: true, message: `${a}\uAC1C\uC758 \uB9CC\uB8CC\uB41C \uC608\uC57D\uC744 \uC815\uB9AC\uD588\uC2B5\uB2C8\uB2E4.`, cleaned: a, total: r.results.length });
  } catch (t) {
    return console.error("[Cleanup] \u274C \uC815\uB9AC \uC2E4\uD328:", t), e.json({ success: false, error: "\uB9CC\uB8CC\uB41C \uC608\uC57D \uC815\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", details: t.message }, 500);
  }
});
p.get("/api/test/env", async (e) => {
  try {
    const s = await ba(e.env);
    return e.json(s);
  } catch (s) {
    return e.json({ success: false, error: "\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uC2E4\uD589 \uC911 \uC624\uB958 \uBC1C\uC0DD", details: s instanceof Error ? s.message : String(s) }, 500);
  }
});
p.get("/api/streams", st(tt.liveStreams), async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = e.req.query("status") || "all", a = `streams:${r}`, n = await t.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    let o = `
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
    r === "live" ? o += " WHERE ls.status = 'live'" : r === "scheduled" ? o += " WHERE ls.status = 'scheduled'" : r === "ended" ? o += " WHERE ls.status = 'ended'" : o += " WHERE ls.status IN ('live', 'scheduled')", o += ` ORDER BY 
      CASE ls.status 
        WHEN 'live' THEN 1 
        WHEN 'scheduled' THEN 2 
        ELSE 3 
      END,
      ls.created_at DESC`;
    const i = await s.prepare(o).all();
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
  const { DB: s } = e.env, { status: t, seller_id: r, limit: a = "20", offset: n = "0" } = e.req.query();
  try {
    const o = `live_streams:${t || "all"}:${r || "all"}:${a}:${n}`, i = 60, c = ve(o);
    if (c) return console.log("[LiveStreams] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", o), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStreams] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", o);
        const u = await Tt(s, t, r, a, n);
        se(o, u, i), console.log("[LiveStreams] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", o);
      } catch (u) {
        console.error("[LiveStreams] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", u);
      }
    })()), e.json({ success: true, data: c });
    console.log("[LiveStreams] \u{1F4BE} DB \uC870\uD68C:", o);
    const l = await Tt(s, t, r, a, n);
    return se(o, l, i), e.json({ success: true, data: l });
  } catch (o) {
    return console.error("[API] Live streams list error:", o), e.json({ success: false, error: `\uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${o.message}` }, 500);
  }
});
async function Tt(e, s, t, r, a) {
  let n = `
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;
  const o = [];
  s && (n += " AND ls.status = ?", o.push(s)), t && (n += " AND ls.seller_id = ?", o.push(t)), n += ' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC', n += " LIMIT ? OFFSET ?", o.push(parseInt(r), parseInt(a));
  const { results: i } = await e.prepare(n).bind(...o).all();
  return i;
}
__name(Tt, "Tt");
__name2(Tt, "Tt");
p.get("/api/live-streams/:id", async (e) => {
  const { DB: s } = e.env, t = e.req.param("id");
  try {
    const r = `live_stream:${t}`, a = 30, n = ve(r);
    if (n) return console.log("[LiveStream] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", r), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStream] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", r);
        const i = await Rt(s, t);
        i && (se(r, i, a), console.log("[LiveStream] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", r));
      } catch (i) {
        console.error("[LiveStream] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", i);
      }
    })()), e.json({ success: true, data: n });
    console.log("[LiveStream] \u{1F4BE} DB \uC870\uD68C:", r);
    const o = await Rt(s, t);
    return o ? (se(r, o, a), e.json({ success: true, data: o })) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
async function Rt(e, s) {
  return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first();
}
__name(Rt, "Rt");
__name2(Rt, "Rt");
p.get("/api/products", st(tt.products), async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = e.req.query("featured"), a = parseInt(e.req.query("limit") || "20"), n = parseInt(e.req.query("offset") || "0"), o = `products:list:${r || "all"}:${a}:${n}`, i = ve(o);
    if (i) return e.executionCtx.waitUntil((async () => {
      try {
        const l = await It(s, r, a, n);
        se(o, l, 3600), await ds(t, o, l, 300, false);
      } catch (l) {
        console.error("[Cache Revalidate] Products error:", l);
      }
    })()), e.json({ success: true, data: i, cached: true });
    const c = await It(s, r, a, n);
    return se(o, c, 3600), await ds(t, o, c, 300, false), e.json({ success: true, data: c, cached: false });
  } catch (r) {
    return console.error("Products list error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
async function It(e, s, t, r) {
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
__name(It, "It");
__name2(It, "It");
p.get("/api/products/popular", async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = "products:popular", a = ve(r);
    if (a) return e.executionCtx.waitUntil((async () => {
      try {
        const o = await vt(s);
        se(r, o, 3600), await ds(t, r, o, 600, false);
      } catch (o) {
        console.error("[Cache Revalidate] Popular products error:", o);
      }
    })()), e.json({ success: true, data: a, cached: true });
    const n = await vt(s);
    return se(r, n, 3600), await ds(t, r, n, 600, false), e.json({ success: true, data: n, cached: false });
  } catch (r) {
    return console.error("Popular products error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
async function vt(e) {
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
__name(vt, "vt");
__name2(vt, "vt");
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
    `).bind(r).all(), n = await s.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(r, r).all(), o = [...(a.results || []).map((i) => ({ type: "product", text: i.name })), ...(n.results || []).map((i) => ({ type: "seller", text: i.display_name }))];
    return e.json({ success: true, data: { suggestions: o } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/products/search", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.query("q") || "", r = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0");
    if (!t.trim()) return e.json({ success: false, error: "Search query is required" }, 400);
    const n = t.trim(), o = `${n}*`;
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
        `).bind(o, r, a).all(), l = await s.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(o).first();
        return e.json({ success: true, data: { products: c.results || [], total: (l == null ? void 0 : l.total) || 0, query: t, limit: r, offset: a, searchMethod: "fts5" } });
      } else throw console.log("[Search] \u26A0\uFE0F FTS5 \uBBF8\uC0AC\uC6A9 - LIKE \uAC80\uC0C9 fallback"), new Error("FTS5 not available");
    } catch (i) {
      console.log("[Search] \u{1F4BE} LIKE \uAC80\uC0C9 fallback:", i.message);
      const c = `%${n}%`, l = await s.prepare(`
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
    const r = `product:detail:${t}`, a = ve(r);
    if (a) return e.executionCtx.waitUntil((async () => {
      try {
        const o = await At(s, t);
        se(r, o, 1800);
      } catch (o) {
        console.error("[Cache Revalidate] Product detail error:", o);
      }
    })()), e.json({ success: true, data: a, cached: true });
    const n = await At(s, t);
    return n ? (se(r, n, 1800), e.json({ success: true, data: n, cached: false })) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
async function At(e, s) {
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
__name(At, "At");
__name2(At, "At");
p.get("/api/products/:id/stock", st(tt.microCache), async (e) => {
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
    const n = a.id;
    if (r !== String(n)) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC7A5\uBC14\uAD6C\uB2C8\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
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
p.post("/api/users", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = await e.req.json(), { kakaoId: r, name: a, email: n, phone: o } = t;
    if (!r || !a) return e.json({ success: false, error: "kakaoId and name are required" }, 400);
    const i = await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(r).first();
    if (i) return e.json({ success: true, data: { id: i.id } });
    const c = await s.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(r, a, n || null, o || null).run();
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
    const r = await e.req.json(), { productId: a, optionId: n, quantity: o, priceSnapshot: i, liveStreamId: c } = r, l = t, u = await s.prepare("SELECT stock FROM products WHERE id = ?").bind(a).first();
    if (!u || u.stock < o) return e.json({ success: false, error: "Insufficient stock" }, 400);
    const d = await s.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(l, a, n || null, n || null).first();
    let m;
    if (d) {
      const _ = d.quantity + o;
      await s.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(_, i, d.id).run(), m = d.id;
    } else m = (await s.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(l, a, n || null, o, i, c || null).run()).meta.last_row_id;
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
p.delete("/api/cart/clear/:userId", j, bo("cart"), async (e) => {
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
    const n = await s.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(t).first();
    return n ? n.stock < a ? e.json({ success: false, error: "Insufficient stock" }, 400) : (await s.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a, t).run(), e.json({ success: true })) : e.json({ success: false, error: "Cart item not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/orders", j, async (e) => {
  const { DB: s } = e.env;
  try {
    const t = await e.req.json(), { userId: r, cartItemIds: a, shippingInfo: n, items: o, shippingAddress: i, shippingAddressDetail: c, recipientName: l, recipientPhone: u, deliveryMemo: d, totalAmount: m, shippingFee: _, orderNumber: f, paymentKey: E, paymentMethod: b } = t;
    if (o && o.length > 0) {
      const O = o.map((M) => M.productId), W = O.map(() => "?").join(","), P = await s.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${W})
      `).bind(...O).all(), L = new Map(P.results.map((M) => [M.id, M])), F = [], Q = [];
      try {
        for (const M of o) {
          const ne = L.get(M.productId);
          if (!ne) throw new Error(`\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${M.productId})`);
          if (ne.stock - (ne.reserved_stock || 0) < M.quantity) throw new Error(`\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uBC29\uAE08 \uC0C1\uD488\uC774 \uBAA8\uB450 \uD310\uB9E4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${ne.name})`);
          if ((await s.prepare(`
            UPDATE products 
            SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND (stock - reserved_stock) >= ?
          `).bind(M.quantity, M.productId, M.quantity).run()).meta.changes === 0) throw new Error(`\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uBC29\uAE08 \uC0C1\uD488\uC774 \uBAA8\uB450 \uD310\uB9E4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${ne.name})`);
          console.log(`[Stock] \u2705 \uC7AC\uACE0 \uC608\uC57D \uC131\uACF5: ${ne.name} (${M.quantity}\uAC1C)`), Q.push({ product_id: M.productId, quantity: M.quantity }), F.push({ product_id: M.productId, option_id: M.optionId || null, quantity: M.quantity, price: M.price, product_name: ne.name, product_stock: ne.stock });
        }
      } catch (M) {
        if (console.error("[Stock] \u274C \uC7AC\uACE0 \uC608\uC57D \uC2E4\uD328:", M.message), Q.length > 0) {
          console.log(`[Stock] \u{1F504} ${Q.length}\uAC1C \uC0C1\uD488 \uC608\uC57D \uB864\uBC31 \uC2DC\uC791...`);
          for (const ne of Q) await s.prepare(`
              UPDATE products 
              SET reserved_stock = reserved_stock - ?
              WHERE id = ?
            `).bind(ne.quantity, ne.product_id).run();
          console.log("[Stock] \u2705 \uC608\uC57D \uB864\uBC31 \uC644\uB8CC");
        }
        return e.json({ success: false, error: M.message }, 400);
      }
      const Y = /* @__PURE__ */ new Date(), v = Y.getFullYear().toString().slice(-2), te = (Y.getMonth() + 1).toString().padStart(2, "0"), q = Y.getDate().toString().padStart(2, "0"), U = `${v}${te}${q}`, z = Math.random().toString(36).substring(2, 7).toUpperCase(), de = f || `ORD-${U}-${z}`, ws = c ? `${i} ${c}` : i, as = new Date(Date.now() + 600 * 1e3).toISOString(), lt = (await s.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, reservation_expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(de, r || null, m || 0, "pending", "pending", ws || null, l || null, u || null, d || null, E || null, as).run()).meta.last_row_id;
      for (const M of F) await s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(lt, M.product_id, M.option_id, M.quantity, M.price, M.product_name).run();
      return console.log(`[Order] \u2705 \uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC: ${de} (\uC608\uC57D \uB9CC\uB8CC: ${as})`), e.json({ success: true, data: { orderId: lt, orderNumber: de, totalAmount: m } });
    }
    if (!a || a.length === 0) return e.json({ success: false, error: "No items provided" }, 400);
    const w = a.map(() => "?").join(","), g = await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${w})
    `).bind(...a).all();
    if (g.results.length === 0) return e.json({ success: false, error: "No items found" }, 400);
    for (const O of g.results) if (O.product_stock < O.quantity) return e.json({ success: false, error: `Insufficient stock for ${O.product_name}` }, 400);
    const T = g.results.reduce((O, W) => O + W.price_snapshot * W.quantity, 0), y = `ORD${Date.now()}${Math.floor(Math.random() * 1e3)}`, $ = (await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(y, r, T, n.address, n.name, n.phone).run()).meta.last_row_id, k = [];
    for (const O of g.results) {
      let W = false, P = "";
      for (let L = 0; L < 3; L++) {
        const F = await s.prepare(`
          SELECT stock, version FROM products WHERE id = ?
        `).bind(O.product_id).first();
        if (!F) {
          P = `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${O.product_name}`;
          break;
        }
        const Q = F.stock, Y = F.version;
        if (Q < O.quantity) {
          P = `\uC7AC\uACE0 \uBD80\uC871: ${O.product_name} (\uB0A8\uC740 \uC7AC\uACE0: ${Q}\uAC1C)`;
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
          W = true, console.log(`[\uC7AC\uACE0] \u2705 \uC7AC\uACE0 \uCC28\uAC10 \uC131\uACF5: ${O.product_name} (\uC218\uB7C9: ${O.quantity}, \uBC84\uC804: ${Y} \u2192 ${Y + 1})`);
          break;
        }
        console.warn(`[\uC7AC\uACE0] \u26A0\uFE0F \uBC84\uC804 \uCDA9\uB3CC \uAC10\uC9C0 (\uC2DC\uB3C4 ${L + 1}/3): ${O.product_name}`), L < 2 ? await new Promise((te) => setTimeout(te, 50 * (L + 1))) : P = "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958 \uBC1C\uC0DD. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694. (\uB3D9\uC2DC \uC8FC\uBB38 \uCC98\uB9AC \uC911)";
      }
      if (!W) return e.json({ success: false, error: P || "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, P.includes("\uC7AC\uACE0 \uBD80\uC871") ? 400 : 409);
      k.push(s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind($, O.product_id, O.option_id, O.quantity, O.price_snapshot, O.product_name));
    }
    k.push(s.prepare(`DELETE FROM cart_items WHERE id IN (${w})`).bind(...a)), await s.batch(k);
    try {
      const O = g.results.map((L) => L.product_id), W = O.map(() => "?").join(","), P = await s.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${W}) AND seller_id IS NOT NULL
      `).bind(...O).all();
      for (const L of P.results) {
        const F = L.seller_id;
        await To(s, F, y, buyerName || shippingName || "\uACE0\uAC1D", T);
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
    const a = `current-product:${r}`, n = await rr(t, a, 3);
    if (n) return e.json({ success: true, data: n });
    const o = await s.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();
    if (!o || !o.current_product_id) return await Os(t, a, null, 3), e.json({ success: true, data: null });
    const i = await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(o.current_product_id).first(), c = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(), l = { product: i, options: c.results };
    return await Os(t, a, l, 3), e.json({ success: true, data: l });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/streams/:streamId/product-wait", async (e) => {
  const { LIVE_CACHE: s } = e.env, t = e.req.param("streamId"), r = e.req.query("lastTimestamp") || "0";
  try {
    const a = `product-timestamp:${t}`, n = `current-product:${t}`, o = 25e3, i = Date.now();
    for (; Date.now() - i < o; ) {
      const c = await s.get(a) || "0";
      if (c !== r) {
        const l = await rr(s, n, 30);
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
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = t.sellerId, a = e.req.query("period") || "7d";
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
    `).bind(r, `-${n} days`).all(), i = await s.prepare(`
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
    `).bind(r, `-${n} days`).first(), c = await s.prepare(`
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
    `).bind(r, `-${n} days`).all();
    return e.json({ success: true, data: { period: a, daily: o.results || [], summary: i || {}, topProducts: c.results || [] } });
  } catch (r) {
    return console.error("Error loading seller dashboard stats:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/analytics/products", async (e) => {
  const { DB: s } = e.env, t = await C(e);
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
  const { DB: s } = e.env, t = await C(e);
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
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { title: r, description: a, youtube_video_id: n, youtube_url: o, thumbnail_url: i, scheduled_at: c, status: l, seller_instagram: u, seller_youtube: d, seller_facebook: m } = await e.req.json();
    let _ = n, f = "youtube", E = null, b = null, w = i;
    if (o && !_ && (_ = Tr(o), !_)) if (_ = Rr(o), E = Ir(o), b = Do(o), _) f = "tiktok";
    else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok live stream URL." }, 400);
    if (!w && _ && f === "youtube" && (w = `https://img.youtube.com/vi/${_}/maxresdefault.jpg`), !r || !_) return e.json({ success: false, error: "Title and live stream URL are required" }, 400);
    const g = await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, _, l || "scheduled", c || null, t.sellerId, u || null, d || null, m || null, f, E, b, w || null).run(), T = await s.prepare(`
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
    `).bind(g.meta.last_row_id).first(), y = await s.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(t.sellerId).first();
    try {
      const { sendLiveStreamCreatedEmail: R } = await Promise.resolve().then(() => Wo);
      R({ streamId: g.meta.last_row_id, title: r, sellerName: (y == null ? void 0 : y.display_name) || (y == null ? void 0 : y.username) || "\uC54C \uC218 \uC5C6\uC74C", platform: f, scheduledAt: c, status: l || "scheduled" }).then(($) => {
        $.success ? console.log(`[Email] Live stream notification sent for stream #${$.meta.last_row_id}`) : console.error("[Email] Failed to send notification:", $.error);
      }).catch(($) => {
        console.error("[Email] Exception while sending notification:", $);
      });
    } catch (R) {
      console.error("[Email] Failed to send live stream notification:", R);
    }
    return await ss(e.env, ts.LIVE_STREAMS), e.json({ success: true, data: T });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/seller/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const { title: n, description: o, youtube_video_id: i, youtube_url: c, scheduled_at: l, status: u, seller_instagram: d, seller_youtube: m, seller_facebook: _ } = await e.req.json(), f = [], E = [];
    if (n !== void 0 && (f.push("title = ?"), E.push(n)), o !== void 0 && (f.push("description = ?"), E.push(o)), c !== void 0 || i !== void 0) {
      let b = i, w = "youtube", g = null;
      if (c && (b = Tr(c), !b)) if (b = Rr(c), g = Ir(c), b) w = "tiktok";
      else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok video URL." }, 400);
      b !== void 0 && (f.push("youtube_video_id = ?"), E.push(b), f.push("platform = ?"), E.push(w), w === "tiktok" && g && (f.push("tiktok_username = ?"), E.push(g)));
    }
    return u !== void 0 && (f.push("status = ?"), E.push(u)), l !== void 0 && (f.push("scheduled_at = ?"), E.push(l)), d !== void 0 && (f.push("seller_instagram = ?"), E.push(d)), m !== void 0 && (f.push("seller_youtube = ?"), E.push(m)), _ !== void 0 && (f.push("seller_facebook = ?"), E.push(_)), f.length === 0 ? e.json({ success: false, error: "No fields to update" }, 400) : (f.push("updated_at = datetime('now')"), await s.prepare(`
      UPDATE live_streams SET ${f.join(", ")} WHERE id = ?
    `).bind(...E, r).run(), await ss(e.env, ts.LIVE_STREAMS), e.json({ success: true }));
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/seller/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    return await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first() ? (await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), await ss(e.env, ts.LIVE_STREAMS), e.json({ success: true })) : e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/youtube/create-live", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { title: r, description: a, scheduled_at: n } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1 \uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD658\uACBD \uBCC0\uC218\uB97C \uC124\uC815\uD574\uC8FC\uC138\uC694.", help: "wrangler secret put YOUTUBE_ACCESS_TOKEN" }, 400);
    const i = await Io({ accessToken: o }, r, a || ""), l = (await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, i.broadcastId, n || null, t.sellerId, i.broadcastId, i.streamKey).run()).meta.last_row_id;
    return await ys(s, t.sellerId, "seller", "live_created", "\u{1F4FA} YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r} - \uC2A4\uD2B8\uB9BC \uD0A4\uC640 URL\uC744 \uD655\uC778\uD558\uC138\uC694`, `/seller/live-control?streamId=${l}`), e.json({ success: true, data: { streamId: l, broadcastId: i.broadcastId, youtubeVideoId: i.broadcastId, streamKey: i.streamKey, streamUrl: i.streamUrl, watchUrl: `https://www.youtube.com/watch?v=${i.broadcastId}` } });
  } catch (r) {
    return console.error("[YouTube Live] Create broadcast error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/youtube/end-live/:streamId", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("streamId"), a = await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!n) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const o = a.youtube_broadcast_id || a.youtube_video_id;
    return o ? (await vo({ accessToken: n }, o), await s.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(), await ys(s, t.sellerId, "seller", "live_ended", "\u2705 YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${a.title} \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, "/seller/streams"), e.json({ success: true, message: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" })) : e.json({ success: false, error: "YouTube Broadcast ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uB3D9\uC73C\uB85C \uC0DD\uC131\uB41C \uB77C\uC774\uBE0C\uC785\uB2C8\uB2E4." }, 400);
  } catch (r) {
    return console.error("[YouTube Live] End broadcast error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/youtube/stats/:streamId", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("streamId"), a = await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = a.youtube_video_id;
    if (!n) return e.json({ success: false, error: "YouTube Video ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_API_KEY, i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o && !i) return e.json({ success: false, error: "YouTube API Key \uB610\uB294 Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await Oo({ apiKey: o, accessToken: i }, n);
    return e.json({ success: true, data: { streamId: r, videoId: n, stats: c } });
  } catch (r) {
    return console.error("[YouTube Live] Get stats error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/youtube/chat/:streamId", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("streamId"), a = e.req.query("pageToken"), n = await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = n.youtube_live_chat_id;
    if (!o) return e.json({ success: false, error: "Live Chat ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!i) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await Ao({ accessToken: i }, o, a);
    return e.json({ success: true, data: c });
  } catch (r) {
    return console.error("[YouTube Live] Get chat messages error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/streams", async (e) => {
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { title: r, description: a, youtube_video_id: n, platform: o, tiktok_username: i, status: c } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const l = o || "youtube";
    if (l === "youtube" && !n) return e.json({ success: false, error: "YouTube \uD50C\uB7AB\uD3FC\uC740 \uC601\uC0C1 ID\uAC00 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    if (l === "tiktok" && !i) return e.json({ success: false, error: "TikTok \uD50C\uB7AB\uD3FC\uC740 \uC0AC\uC6A9\uC790\uBA85\uC774 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const u = await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(r, a || null, n || null, l, i || null, c || "scheduled", t.sellerId || null).run();
    return await ss(e.env, ts.LIVE_STREAMS), e.json({ success: true, data: { id: u.meta.last_row_id, title: r, description: a, youtube_video_id: n, platform: l, tiktok_username: i, status: c || "scheduled" } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/admin/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { title: a, description: n, youtube_video_id: o, platform: i, tiktok_username: c, status: l } = await e.req.json();
    return await s.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i || "youtube", c || null, l, r).run(), await ss(e.env, ts.LIVE_STREAMS), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/streams/:streamId/change-product", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("streamId"), { productId: a } = await e.req.json();
    if (!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const o = await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(a, t.sellerId).first();
    if (!o) return e.json({ success: false, error: "Product not found or not active" }, 404);
    const i = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(a).all();
    await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a, r).run();
    const { LIVE_CACHE: c } = e.env, l = `product-timestamp:${r}`, u = `current-product:${r}`, d = Date.now().toString();
    await c.put(l, d), await Os(c, u, { product: o, options: i.results }, 30);
    try {
      await gs(e.env).changeCurrentProduct(parseInt(r), a), console.log(`\u{1F525} Firebase: Product changed for stream ${r} to ${a}`);
    } catch (m) {
      console.error("\u26A0\uFE0F Firebase sync failed (non-blocking):", m);
    }
    return e.json({ success: true, data: { product: o, options: i.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/admin/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    return await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), await ss(e.env, ts.LIVE_STREAMS), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/streams/:streamId/change-product", async (e) => {
  const { DB: s } = e.env, t = e.req.param("streamId");
  try {
    const { productId: r } = await e.req.json(), a = await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id FROM products WHERE id = ? AND is_active = 1").bind(r).first();
    if (!a) return e.json({ success: false, error: "Product not found" }, 404);
    const n = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();
    await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(r, t).run();
    const { LIVE_CACHE: o } = e.env, i = `product-timestamp:${t}`, c = `current-product:${t}`, l = Date.now().toString();
    return await o.put(i, l), await Os(o, c, { product: a, options: n.results }, 30), e.json({ success: true, data: { product: a, options: n.results } });
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
    const n = await s.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(r).first();
    if (!n) return e.json({ success: false, error: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC0C1\uD488\uC774\uAC70\uB098 \uD310\uB9E4\uAC00 \uC911\uB2E8\uB41C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 404);
    if (await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t, r).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uCC1C\uD55C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 409);
    const i = await s.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(t, r).run();
    return e.json({ success: true, data: { id: i.meta.last_row_id, userId: t, productId: r, productName: n.name } });
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
    const t = e.req.param("userId"), r = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0"), { results: n } = await s.prepare(`
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
    `).bind(t, r, a).all(), o = await s.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(t).first();
    return e.json({ success: true, data: { items: n, total: (o == null ? void 0 : o.count) || 0, limit: r, offset: a } });
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
  const { DB: s, CACHE_KV: t } = e.env, r = await C(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const a = `seller:${r.sellerId}:products`, n = await t.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(r.sellerId).all();
    return await t.put(a, JSON.stringify(o.results), { expirationTtl: 300 }), e.json({ success: true, data: o.results });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.post("/api/seller/upload-image", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { image: r, filename: a } = await e.req.json();
    if (!r) return e.json({ success: false, error: "Image data is required" }, 400);
    const n = r.match(/^data:(image\/[\w+]+);base64,/);
    if (!n) return e.json({ success: false, error: "\uC798\uBABB\uB41C \uC774\uBBF8\uC9C0 \uD615\uC2DD\uC785\uB2C8\uB2E4." }, 400);
    const o = n[1], i = r.replace(/^data:image\/\w+;base64,/, "");
    let c;
    try {
      c = Uint8Array.from(atob(i), (m) => m.charCodeAt(0));
    } catch {
      return e.json({ success: false, error: "\uC774\uBBF8\uC9C0 \uB514\uCF54\uB529 \uC2E4\uD328" }, 400);
    }
    const l = 10 * 1024 * 1024;
    if (c.length > l) return e.json({ success: false, error: `\uD30C\uC77C \uD06C\uAE30\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4. \uCD5C\uB300 ${l / 1024 / 1024}MB\uAE4C\uC9C0 \uD5C8\uC6A9\uB429\uB2C8\uB2E4.` }, 400);
    const u = await ha(c.buffer);
    if (!u.valid) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC774\uBBF8\uC9C0 \uD30C\uC77C\uC785\uB2C8\uB2E4." }, 400);
    const d = e.env.IMAGES;
    if (d) {
      console.log("[Image Upload] Using R2 storage");
      const m = fa(a || "upload.jpg"), _ = `products/${t.sellerId}/${m}`;
      await d.put(_, c, { httpMetadata: { contentType: u.detectedType || o } });
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
    const r = e.req.path.replace("/api/images/", ""), a = e.req.query("width"), n = e.req.query("format"), o = e.req.query("quality") || "85", i = await t.get(r);
    if (!i) return e.notFound();
    const c = { "Content-Type": ((s = i.httpMetadata) == null ? void 0 : s.contentType) || "image/jpeg", "Cache-Control": "public, max-age=31536000" };
    if (a || n) {
      const l = [];
      a && l.push(`width=${a}`), n && l.push(`format=${n}`), o && l.push(`quality=${o}`), c["cf-resize"] = l.join(",");
    }
    return new Response(i.body, { headers: c });
  } catch (t) {
    return console.error("[Image Get] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/products", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { name: r, description: a, price: n, original_price: o, discount_rate: i, image_url: c, stock: l, category: u, live_stream_id: d, is_active: m } = await e.req.json();
    if (!r || !n) return e.json({ success: false, error: "Name and price are required" }, 400);
    if (d && !await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d, t.sellerId).first()) return e.json({ success: false, error: "Live stream not found or unauthorized" }, 404);
    const _ = await s.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a || null, n, o || null, i || 0, c || null, l || 0, u || null, d || null, t.sellerId, m !== void 0 ? m : 1).run(), f = await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(_.meta.last_row_id).first();
    return await ct(e.env.CACHE_KV, `seller:${t.sellerId}:products`, `public:seller:${t.sellerId}`), e.json({ success: true, data: f });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/products/:id", async (e) => {
  const { DB: s } = e.env, t = await C(e);
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
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { name: n, description: o, price: i, original_price: c, image_url: l, stock: u, category: d, is_active: m, live_stream_id: _ } = await e.req.json(), f = [], E = [];
    if (n !== void 0 && (f.push("name = ?"), E.push(n)), o !== void 0 && (f.push("description = ?"), E.push(o)), i !== void 0 && (f.push("price = ?"), E.push(i)), c !== void 0 && (f.push("original_price = ?"), E.push(c), i !== void 0 && c)) {
      const w = Math.round((c - i) / c * 100);
      f.push("discount_rate = ?"), E.push(w);
    }
    if (l !== void 0 && (f.push("image_url = ?"), E.push(l)), u !== void 0 && (f.push("stock = ?"), E.push(u)), d !== void 0 && (f.push("category = ?"), E.push(d)), m !== void 0 && (f.push("is_active = ?"), E.push(m ? 1 : 0)), _ !== void 0 && (f.push("live_stream_id = ?"), E.push(_ || null)), f.push("updated_at = CURRENT_TIMESTAMP"), E.push(r, t.sellerId), f.length === 1) return e.json({ success: false, error: "No fields to update" }, 400);
    await s.prepare(`UPDATE products SET ${f.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...E).run();
    const b = await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(r).first();
    return await ct(e.env.CACHE_KV, `seller:${t.sellerId}:products`, `public:seller:${t.sellerId}`), e.json({ success: true, data: b });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/seller/products/:id", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await s.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();
    return n && n.count > 0 ? e.json({ success: false, error: "\uC774\uBBF8 \uC8FC\uBB38\uB41C \uC0C1\uD488\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD488\uC808 \uCC98\uB9AC\uD558\uAC70\uB098 \uC228\uAE40 \uCC98\uB9AC\uD574\uC8FC\uC138\uC694." }, 400) : (await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(), await s.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(), await s.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(), await s.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).run(), await ct(e.env.CACHE_KV, `seller:${t.sellerId}:products`, `public:seller:${t.sellerId}`), e.json({ success: true }));
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/products/:id/options", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();
    return e.json({ success: true, data: n.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/products/:id/options", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { option_type: n, option_value: o, price_adjustment: i, stock: c } = await e.req.json();
    if (!n || !o) return e.json({ success: false, error: "Option type and value are required" }, 400);
    const l = await s.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r, n, o, i || 0, c || 0).run();
    return e.json({ success: true, data: { id: l.meta.last_row_id, product_id: r, option_type: n, option_value: o, price_adjustment: i || 0, stock: c || 0 } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/seller/products/:productId/options/:optionId", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("productId"), a = e.req.param("optionId");
    return await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first() ? (await s.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a, r).run(), e.json({ success: true })) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/stats", async (e) => {
  const { DB: s, CACHE_KV: t } = e.env, r = await C(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const a = `seller:${r.sellerId}:stats`, n = await t.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(r.sellerId).first(), i = await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(r.sellerId).first(), c = await s.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(r.sellerId).first(), l = await s.prepare(`
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
    `).bind(r.sellerId).first(), m = (d == null ? void 0 : d.total) || 0, _ = { totalProducts: o.count || 0, activeProducts: i.count || 0, totalStock: c.total || 0, totalOrders: l.count || 0, totalRevenue: l.total || 0, activeStreams: u.count || 0, totalViewers: m };
    return await t.put(a, JSON.stringify(_), { expirationTtl: 60 }), e.json({ success: true, data: _ });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/seller/stats/sales", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.query("period") || "daily";
    let a, n, o;
    switch (r) {
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
    `).bind(t.sellerId).all();
    return e.json({ success: true, data: { period: r, sales: i.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/stats/products", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = parseInt(e.req.query("limit") || "10"), a = parseInt(e.req.query("days") || "30"), n = await s.prepare(`
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
    return e.json({ success: true, data: { products: n.results, period_days: a } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/business-info", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { business_number: r, business_name: a, ceo_name: n, business_type: o, business_category: i, postal_code: c, address: l, phone: u, email: d } = await e.req.json();
    if (!r || !a || !n) return e.json({ success: false, error: "\uC0AC\uC5C5\uC790\uB4F1\uB85D\uBC88\uD638, \uC0C1\uD638\uBA85, \uB300\uD45C\uC790\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
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
      `).bind(r, a, n, o, i, c, l, u, d, t.sellerId).run() : _ = await s.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(t.sellerId, r, a, n, o, i, c, l, u, d).run(), e.json({ success: true, data: { id: m ? m.id : _.meta.last_row_id, seller_id: t.sellerId, business_number: r, is_verified: false, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4." } });
  } catch (r) {
    return console.error("\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uB4F1\uB85D \uC624\uB958:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/business-info", async (e) => {
  const { DB: s } = e.env, t = await C(e);
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
  const { DB: s } = e.env, t = await x(e);
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
  } catch (n) {
    return e.json({ success: false, error: n.message }, 500);
  }
});
p.get("/api/admin/seller-business", async (e) => {
  const { DB: s } = e.env, t = await x(e);
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
    for (const o of r.results) {
      const i = o.id;
      a.has(i) || a.set(i, { id: o.id, user_id: o.user_id, order_number: o.order_number, status: o.status, total_amount: o.total_amount, shipping_fee: o.shipping_fee, payment_method: o.payment_method, payment_key: o.payment_key, shipping_address: o.shipping_address, shipping_name: o.shipping_name, shipping_phone: o.shipping_phone, delivery_request: o.delivery_request, created_at: o.created_at, updated_at: o.updated_at, items: [] }), o.item_id && a.get(i).items.push({ id: o.item_id, product_id: o.product_id, option_id: o.option_id, quantity: o.quantity, price: o.item_price, product_name: o.product_name, image_url: o.image_url, option_value: o.option_value });
    }
    const n = Array.from(a.values());
    return e.json({ success: true, data: n });
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
    `).bind(t).all(), n = /* @__PURE__ */ new Map();
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
    const a = r.results[0], n = { id: a.id, user_id: a.user_id, order_number: a.order_number, status: a.status, total_amount: a.total_amount, shipping_fee: a.shipping_fee, payment_method: a.payment_method, payment_key: a.payment_key, shipping_address: a.shipping_address, shipping_name: a.shipping_name, shipping_phone: a.shipping_phone, delivery_request: a.delivery_request, created_at: a.created_at, updated_at: a.updated_at, items: [] };
    for (const o of r.results) o.item_id && n.items.push({ id: o.item_id, product_id: o.product_id, option_id: o.option_id, quantity: o.quantity, price: o.item_price, product_name: o.product_name, image_url: o.image_url, option_value: o.option_value });
    return e.json({ success: true, data: n });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/orders/:orderId/cancel", j, async (e) => {
  const { DB: s } = e.env, t = e.req.param("orderId");
  try {
    const a = (await e.req.json()).reason || "\uC0AC\uC720 \uC5C6\uC74C", n = await s.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(t).first();
    if (!n) return e.json({ success: false, error: "Order not found" }, 404);
    if (n.status !== "pending") return e.json({ success: false, error: "\uACB0\uC81C \uB300\uAE30 \uC911\uC778 \uC8FC\uBB38\uB9CC \uCDE8\uC18C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACB0\uC81C\uAC00 \uC644\uB8CC\uB41C \uC8FC\uBB38\uC740 \uD658\uBD88\uC744 \uC2E0\uCCAD\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(t).all();
    if (o.results.length > 0) {
      const i = o.results.map((c) => s.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(c.quantity, c.product_id));
      await s.batch(i);
    }
    return await s.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled", a, t).run(), e.json({ success: true, message: "Order cancelled successfully", data: { orderId: t, reason: a, itemsRestored: o.results.length } });
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
  const { DB: s } = e.env, t = await x(e), r = t.success ? { success: false } : await C(e);
  if (!t.success && !r.success) return e.json({ success: false, error: "Unauthorized" }, 401);
  try {
    const a = e.req.param("streamId"), { viewer_count: n } = await e.req.json();
    return typeof n != "number" || n < 0 ? e.json({ success: false, error: "Invalid viewer count" }, 400) : r.success && !await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a, r.sellerId).first() ? e.json({ success: false, error: "Stream not found or unauthorized" }, 404) : (await s.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n, a).run(), e.json({ success: true, data: { viewer_count: n } }));
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
    const { paymentKey: a, orderId: n, amount: o } = t;
    if (console.log("========================================"), console.log("[Payment] \u{1F680} \uACB0\uC81C \uC2B9\uC778 API \uD638\uCD9C\uB428"), console.log("========================================"), console.log("[Payment] \u{1F4CB} \uC694\uCCAD \uD30C\uB77C\uBBF8\uD130:"), console.log("  - orderId:", n), console.log("  - paymentKey:", a), console.log("  - amount:", o), console.log("  - timestamp:", (/* @__PURE__ */ new Date()).toISOString()), !a || !n || !o) return console.error("[Payment] \u274C \uD544\uC218 \uD30C\uB77C\uBBF8\uD130 \uB204\uB77D!"), console.error("[Payment] paymentKey:", !!a), console.error("[Payment] orderId:", !!n), console.error("[Payment] amount:", !!o), e.json({ success: false, error: "\uD544\uC218 \uD30C\uB77C\uBBF8\uD130\uAC00 \uB204\uB77D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", details: { paymentKey: !!a, orderId: !!n, amount: !!o } }, 400);
    console.log("[Payment] \u2705 \uD544\uC218 \uD30C\uB77C\uBBF8\uD130 \uAC80\uC99D \uD1B5\uACFC");
    const i = await s.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();
    if (!i) return console.error("[Payment] \u274C \uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C:", n), e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uBB38\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uAC70\uB098 \uC774\uBBF8 \uCC98\uB9AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", orderId: n }, 404);
    if (console.log("[Payment] \u2705 \uC8FC\uBB38 \uD655\uC778\uB428:", { id: i.id, order_number: i.order_number, total_amount: i.total_amount, status: i.status }), Number(o) !== Number(i.total_amount)) return console.error("[Payment] \u274C \uAE08\uC561 \uBD88\uC77C\uCE58!", { requested: Number(o), expected: Number(i.total_amount) }), e.json({ success: false, error: "\uACB0\uC81C \uAE08\uC561\uC774 \uC8FC\uBB38 \uAE08\uC561\uACFC \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", requestedAmount: Number(o), expectedAmount: Number(i.total_amount) }, 400);
    const c = e.env.TOSS_SECRET_KEY;
    if (!c) return console.error("[Payment] \u274C TOSS_SECRET_KEY \uD658\uACBD \uBCC0\uC218 \uC5C6\uC74C"), console.error("[Payment] c.env:", Object.keys(e.env || {})), e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    console.log("[Payment] \u2705 TOSS_SECRET_KEY \uD655\uC778\uB428:", c.substring(0, 20) + "..."), console.log("[Payment] \u{1F310} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uD638\uCD9C \uC2DC\uC791..."), console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"), console.log("[Payment] API \uBC84\uC804: 2022-11-16 (\uACB0\uC81C\uC704\uC82F \uACE0\uC815 \uBC84\uC804)");
    const l = "Basic " + btoa(c + ":");
    console.log("[Payment] Authorization \uD5E4\uB354 \uC0DD\uC131 \uC644\uB8CC");
    const u = { orderId: n, amount: Number(o), paymentKey: a };
    console.log("[Payment] \uC694\uCCAD \uBCF8\uBB38:", JSON.stringify(u, null, 2)), console.log("[Payment] \u{1F4CA} amount \uD0C0\uC785:", typeof u.amount), console.log("[Payment] \u{1F4CA} amount \uAC12:", u.amount);
    const d = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: l, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(u) }), m = await d.json();
    if (console.log("[Payment] \u{1F4E1} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uC751\uB2F5:"), console.log("  - HTTP \uC0C1\uD0DC:", d.status), console.log("  - \uC751\uB2F5 OK?:", d.ok), console.log("  - \uC751\uB2F5 \uB370\uC774\uD130 (\uC77C\uBD80):", JSON.stringify(m).substring(0, 300)), !d.ok) return console.error("[Payment] \u274C\u274C\u274C \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC2B9\uC778 \uC2E4\uD328!"), console.error("[Payment] HTTP \uC0C1\uD0DC:", d.status), console.error("[Payment] \uC5D0\uB7EC \uCF54\uB4DC:", m.code), console.error("[Payment] \uC5D0\uB7EC \uBA54\uC2DC\uC9C0:", m.message), console.error("[Payment] \uC804\uCCB4 \uC751\uB2F5:", JSON.stringify(m, null, 2)), e.json({ success: false, error: m.message || "\uACB0\uC81C \uC2B9\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", code: m.code, tossError: m }, d.status);
    console.log("[Payment] \u2705 \uACB0\uC81C \uC2B9\uC778 \uC131\uACF5! paymentKey:", a), console.log("[Payment] \u2705 \uC8FC\uBB38 \uBC88\uD638:", n);
    try {
      await s.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            reservation_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a, n).run(), console.log("[Payment] \u2705 \uC8FC\uBB38 \uC0C1\uD0DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC");
      const _ = await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();
      if (_.results.length > 0) {
        console.log(`[Stock] \u{1F512} \uC7AC\uACE0 \uD655\uC815 \uC2DC\uC791: ${_.results.length}\uAC1C \uC0C1\uD488`);
        const f = _.results.map((w) => s.prepare(`
            UPDATE products 
            SET stock = stock - ?,
                reserved_stock = reserved_stock - ?
            WHERE id = ?
          `).bind(w.quantity, w.quantity, w.product_id)), E = await s.batch(f);
        let b = 0;
        for (let w = 0; w < E.length; w++) if (E[w].meta.changes > 0) {
          b++;
          const g = _.results[w];
          console.log(`[Stock] \u2705 \uC7AC\uACE0 \uD655\uC815: product_id=${g.product_id}, quantity=${g.quantity}`);
        } else {
          const g = _.results[w];
          console.error(`[Stock] \u26A0\uFE0F \uC7AC\uACE0 \uD655\uC815 \uC2E4\uD328: product_id=${g.product_id}`);
        }
        console.log(`[Stock] \u2705 \uC7AC\uACE0 \uD655\uC815 \uC644\uB8CC: ${b}/${_.results.length}\uAC1C \uC131\uACF5`);
        try {
          const w = _.results.map((y) => y.product_id), g = w.map(() => "?").join(","), T = await s.prepare(`
            SELECT id, name, stock, reserved_stock, stock_alert_threshold, seller_id 
            FROM products 
            WHERE id IN (${g})
          `).bind(...w).all();
          for (const y of T.results) {
            const R = y.stock_alert_threshold || 10, $ = y.stock || 0, k = y.reserved_stock || 0, O = $ - k;
            O <= R && y.seller_id && (await Sr(s, y.seller_id, y.name, O, R), console.log(`[Low Stock Alert] \u{1F4E2} ${y.name}: \uAC00\uC6A9\uC7AC\uACE0 ${O}\uAC1C (\uC784\uACC4\uAC12 ${R}\uAC1C)`));
          }
        } catch (w) {
          console.error("[Low Stock Alert] \u26A0\uFE0F \uC54C\uB9BC \uC804\uC1A1 \uC2E4\uD328:", w);
        }
      }
      try {
        const f = i.id, E = await za(e.env, f);
        E.success ? console.log(`[Payment] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5 (\uC8FC\uBB38 ${f})`) : console.warn(`[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328 (\uC8FC\uBB38 ${f}):`, E.reason || E.error);
      } catch (f) {
        console.error("[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC911 \uC624\uB958:", f);
      }
    } catch (_) {
      console.error("[Payment] \u26A0\uFE0F DB \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 (\uACB0\uC81C\uB294 \uC131\uACF5):", _);
    }
    if (e.env.DISCORD_WEBHOOK_URL) try {
      await bn(e.env.DISCORD_WEBHOOK_URL, "\uACB0\uC81C \uC131\uACF5", `\uC8FC\uBB38\uBC88\uD638 ${n} \uACB0\uC81C \uC644\uB8CC`, { \uC8FC\uBB38\uBC88\uD638: n, \uACB0\uC81C\uAE08\uC561: `\u20A9${Number(o).toLocaleString()}`, \uACB0\uC81C\uD0A4: a.substring(0, 20) + "...", \uC0AC\uC6A9\uC790ID: i.user_id });
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
    const n = await s.prepare("SELECT id, order_number, status FROM orders WHERE order_number = ?").bind(r).first();
    if (!n) return console.warn("[Rollback] \u26A0\uFE0F \uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C:", r), e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (n.status === "paid") return console.warn("[Rollback] \u26A0\uFE0F \uC774\uBBF8 \uACB0\uC81C \uC644\uB8CC\uB41C \uC8FC\uBB38:", r), e.json({ success: false, error: "\uC774\uBBF8 \uACB0\uC81C\uAC00 \uC644\uB8CC\uB41C \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400);
    console.log("[Rollback] \u2705 \uC8FC\uBB38 \uD655\uC778\uB428:", n.order_number);
    const o = await s.prepare(`
      SELECT product_id, quantity 
      FROM order_items 
      WHERE order_id = ?
    `).bind(n.id).all();
    if (o.results.length === 0) return console.warn("[Rollback] \u26A0\uFE0F \uC8FC\uBB38 \uC544\uC774\uD15C \uC5C6\uC74C"), e.json({ success: false, error: "\uC8FC\uBB38 \uC544\uC774\uD15C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    console.log(`[Rollback] \u{1F4E6} ${o.results.length}\uAC1C \uC0C1\uD488 \uC608\uC57D \uD574\uC81C \uC2DC\uC791...`);
    const i = o.results.map((u) => s.prepare(`
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
      const d = o.results[u];
      console.log(`[Rollback] \u2705 \uC608\uC57D \uD574\uC81C: product_id=${d.product_id}, quantity=${d.quantity}`);
    }
    return console.log(`[Rollback] \u2705 \uC608\uC57D \uD574\uC81C \uC644\uB8CC: ${l}/${o.results.length}\uAC1C \uC131\uACF5`), await s.prepare(`
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
    const r = await e.req.json(), { userId: a, userName: n, userAvatar: o, message: i, isSeller: c, isAdmin: l } = r;
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
    `).bind(t, a || null, n, o || null, d, c ? 1 : 0, l ? 1 : 0).run();
    return e.json({ success: true, data: { id: m.meta.last_row_id, message: d } });
  } catch (r) {
    return console.error("Error sending chat message:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/chat/:liveStreamId/messages", S(), async (e) => {
  const { DB: s } = e.env, t = e.req.param("liveStreamId"), r = e.req.query("since"), a = Number(e.req.query("limit")) || 50;
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
    const o = [t];
    r && (n += " AND id > ?", o.push(Number(r))), n += " ORDER BY created_at DESC LIMIT ?", o.push(a);
    const c = (await s.prepare(n).bind(...o).all()).results.reverse();
    return e.json({ success: true, data: c });
  } catch (n) {
    return console.error("Error fetching chat messages:", n), e.json({ success: false, error: n.message }, 500);
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
    const r = await e.req.json(), { userId: a, bannedBy: n, reason: o, duration: i } = r;
    if (!a || !n) return e.json({ success: false, error: "userId and bannedBy are required" }, 400);
    let c = null;
    if (i) {
      const l = /* @__PURE__ */ new Date();
      l.setMinutes(l.getMinutes() + i), c = l.toISOString();
    }
    return await s.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(t, a, n, o || null, c).run(), e.json({ success: true, message: "User banned successfully" });
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
async function No(e, s, t) {
  try {
    const r = new TextEncoder(), a = r.encode(t), n = r.encode(e), o = await crypto.subtle.importKey("raw", a, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), i = await crypto.subtle.sign("HMAC", o, n), c = Array.from(new Uint8Array(i)), l = btoa(String.fromCharCode(...c));
    return s === l;
  } catch (r) {
    return console.error("[Webhook] \uC11C\uBA85 \uAC80\uC99D \uC624\uB958:", r), false;
  }
}
__name(No, "No");
__name2(No, "No");
p.post("/api/payments/webhook", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("toss-signature"), r = await e.req.text();
    if (t && e.env.TOSS_SECRET_KEY) {
      if (!await No(r, t, e.env.TOSS_SECRET_KEY)) return console.error("[Webhook] \u274C \uC11C\uBA85 \uAC80\uC99D \uC2E4\uD328 - \uC704\uC870\uB41C \uC6F9\uD6C5 \uC694\uCCAD"), e.json({ success: false, error: "Invalid signature" }, 401);
      console.log("[Webhook] \u2705 \uC11C\uBA85 \uAC80\uC99D \uC131\uACF5");
    } else console.warn("[Webhook] \u26A0\uFE0F \uC11C\uBA85 \uAC80\uC99D \uAC74\uB108\uB700 (\uAC1C\uBC1C \uD658\uACBD \uB610\uB294 \uC11C\uBA85 \uC5C6\uC74C)");
    const a = JSON.parse(r);
    switch (console.log("[Webhook] \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC6F9\uD6C5 \uC218\uC2E0:", { eventType: a.eventType, orderId: a.orderId, status: a.status, timestamp: (/* @__PURE__ */ new Date()).toISOString() }), a.eventType) {
      case "PAYMENT_STATUS_CHANGED":
        await jo(s, a);
        break;
      case "VIRTUAL_ACCOUNT_ISSUED":
        await Lo(s, a);
        break;
      default:
        console.log("[Webhook] \uCC98\uB9AC\uD558\uC9C0 \uC54A\uB294 \uC774\uBCA4\uD2B8 \uD0C0\uC785:", a.eventType);
    }
    return e.json({ success: true });
  } catch (t) {
    return console.error("[Webhook] \u274C \uC6F9\uD6C5 \uCC98\uB9AC \uC2E4\uD328:", t.message), e.json({ success: false, error: t.message }, 500);
  }
});
async function jo(e, s) {
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
__name(jo, "jo");
__name2(jo, "jo");
async function Lo(e, s) {
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
__name(Lo, "Lo");
__name2(Lo, "Lo");
p.post("/api/payments/:paymentKey/cancel", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("paymentKey"), r = await e.req.json(), { cancelReason: a, cancelAmount: n } = r;
    if (console.log("[Payment] \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD:", { paymentKey: t, cancelReason: a, cancelAmount: n }), !a) return e.json({ success: false, error: "\uCDE8\uC18C \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await s.prepare(`
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
    if (!o) return e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (o.status === "CANCELED" || o.status === "cancelled") return e.json({ success: false, error: "\uC774\uBBF8 \uCDE8\uC18C\uB41C \uACB0\uC81C\uC785\uB2C8\uB2E4." }, 400);
    const i = o.pg_provider || "tosspayments", c = e.env.TOSS_SECRET_KEY;
    if (!c) return e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    const l = Eo(i, c), u = n && n < o.amount, d = n || o.amount;
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
    `).bind(o.order_id).run(), console.log(`[Payment] \u2705 \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC [${i}]: ${t}`), e.json({ success: true, data: { paymentKey: t, orderId: o.order_id, cancelAmount: d, canceledAt: m.canceledAt, status: "CANCELED" } })) : (console.error(`[Payment] \u274C ${i} \uACB0\uC81C \uCDE8\uC18C \uC2E4\uD328:`, m.error), e.json({ success: false, error: m.error || "\uACB0\uC81C \uCDE8\uC18C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." }, 400));
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
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.query("status"), a = e.req.query("start_date"), n = e.req.query("end_date"), o = e.req.query("min_amount"), i = e.req.query("max_amount"), c = parseInt(e.req.query("page") || "1"), l = parseInt(e.req.query("limit") || "50"), u = (c - 1) * l, d = ["oi.seller_id = ?"], m = [t.sellerId];
    r && (d.push("o.status = ?"), m.push(r)), a && (d.push("DATE(o.created_at) >= ?"), m.push(a)), n && (d.push("DATE(o.created_at) <= ?"), m.push(n)), o && (d.push("o.total_amount >= ?"), m.push(parseInt(o))), i && (d.push("o.total_amount <= ?"), m.push(parseInt(i)));
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
    `).bind(...m, l, u).all(), E = await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${_}
    `).bind(...m).first(), b = (E == null ? void 0 : E.total) || 0, w = Math.ceil(b / l), g = /* @__PURE__ */ new Map();
    for (const y of f.results) {
      const R = y.id;
      g.has(R) || g.set(R, { id: y.id, user_id: y.user_id, user_name: y.user_name, order_number: y.order_number, status: y.status, total_amount: y.total_amount, shipping_fee: y.shipping_fee, payment_method: y.payment_method, payment_key: y.payment_key, shipping_address: y.shipping_address, shipping_name: y.shipping_name, shipping_phone: y.shipping_phone, delivery_request: y.delivery_request, created_at: y.created_at, updated_at: y.updated_at, items: [] }), y.item_id && g.get(R).items.push({ id: y.item_id, product_id: y.product_id, option_id: y.option_id, quantity: y.quantity, price: y.item_price, seller_id: y.seller_id, product_name: y.product_name, image_url: y.image_url, option_value: y.option_value });
    }
    const T = Array.from(g.values());
    return e.json({ success: true, data: T, pagination: { page: c, limit: l, total: b, totalPages: w }, filters: { status: r || null, startDate: a || null, endDate: n || null, minAmount: o ? parseInt(o) : null, maxAmount: i ? parseInt(i) : null } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/orders/export", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.query("format") || "csv", a = e.req.query("start_date"), n = e.req.query("end_date");
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
    const i = [t.sellerId];
    a && (o += " AND date(o.created_at) >= ?", i.push(a)), n && (o += " AND date(o.created_at) <= ?", i.push(n)), o += " GROUP BY o.id ORDER BY o.created_at DESC";
    const c = await s.prepare(o).bind(...i).all();
    if (r === "csv") {
      const l = ["\uC8FC\uBB38\uBC88\uD638", "\uC8FC\uBB38\uC77C\uC2DC", "\uC8FC\uBB38\uC0C1\uD0DC", "\uACB0\uC81C\uC0C1\uD0DC", "\uC8FC\uBB38\uAE08\uC561", "\uBC30\uC1A1\uC9C0", "\uC218\uB839\uC778", "\uC5F0\uB77D\uCC98", "\uD0DD\uBC30\uC0AC", "\uC6B4\uC1A1\uC7A5\uBC88\uD638", "\uAD6C\uB9E4\uC790\uBA85", "\uAD6C\uB9E4\uC790\uC774\uBA54\uC77C", "\uAD6C\uB9E4\uC790\uC5F0\uB77D\uCC98"], u = c.results.map((E) => [E.order_number || "", E.created_at ? new Date(E.created_at).toLocaleString("ko-KR") : "", E.status || "", E.payment_status || "", E.total_amount || 0, E.shipping_address || "", E.shipping_name || "", E.shipping_phone || "", E.carrier || "", E.tracking_number || "", E.buyer_name || "", E.buyer_email || "", E.buyer_phone || ""]), m = "\uFEFF" + [l.join(","), ...u.map((E) => E.map((b) => {
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
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("orderNumber"), { status: a } = await e.req.json();
    if (!["PAY_COMPLETE", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED"].includes(a)) return e.json({ success: false, error: "Invalid status" }, 400);
    const o = await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();
    if (!o) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id, t.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
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
            `).bind(c.id).all(), d = Number(c.total_amount), m = Math.floor(d / 1.1), _ = d - m, f = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), E = Math.random().toString(36).substring(2, 8).toUpperCase(), b = `${f}-${E}`, g = (await s.prepare(`
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
            `).bind(t.sellerId, r, b, l.business_number, l.business_name, l.ceo_name, l.address || "", l.business_type || "", l.business_category || "", l.email || "", l.phone || "", c.buyer_business_number, c.buyer_business_name, c.buyer_ceo_name || "", c.buyer_business_address || "", c.buyer_business_type || "", c.buyer_business_category || "", c.buyer_email || "", c.buyer_phone || "", m, _, d, `AUTO-${Date.now()}-${E}`).run()).meta.last_row_id;
          if (u.results.length > 0) {
            const T = u.results.map((y) => {
              const R = Math.floor(Number(y.price) * Number(y.quantity) / 1.1), $ = Number(y.price) * Number(y.quantity) - R;
              return s.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(g, y.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", y.quantity, y.price, R, $, y.option_name || "");
            });
            await s.batch(T);
          }
          await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r, t.sellerId, g).run(), console.log(`[AUTO TAX INVOICE] \u2705 \uBC1C\uD589 \uC644\uB8CC: invoice_id=${g}, invoice_number=${b}`);
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
        u && await br(s, c.user_id, r, u);
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
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("orderNumber"), { courier: a, tracking_number: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Courier and tracking number are required" }, 400);
    const o = await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();
    if (!o) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id, t.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
    await s.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a, n, r).run();
    try {
      const c = await s.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(r).first();
      c && c.user_id && await br(s, c.user_id, r, "shipping", a, n);
    } catch (c) {
      console.error("[Tracking] Notification error:", c);
    }
    return e.json({ success: true, message: "Tracking information updated" });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/orders", async (e) => {
  const { DB: s } = e.env, t = await x(e);
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
    const a = `sellers:list:${t}:${r}`, n = ve(a);
    if (n) return e.executionCtx.waitUntil((async () => {
      try {
        const i = await Ot(s, parseInt(t), parseInt(r));
        se(a, i, 3600);
      } catch (i) {
        console.error("[Cache Revalidate] Sellers error:", i);
      }
    })()), e.json({ success: true, data: n, cached: true });
    const o = await Ot(s, parseInt(t), parseInt(r));
    return se(a, o, 3600), e.json({ success: true, data: o, cached: false });
  } catch (a) {
    return console.error("[API] Sellers list error:", a), e.json({ success: false, error: `\uC140\uB7EC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${a.message}` }, 500);
  }
});
async function Ot(e, s, t) {
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
__name(Ot, "Ot");
__name2(Ot, "Ot");
p.get("/api/admin/sellers", async (e) => {
  const { DB: s } = e.env, t = await x(e);
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
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { username: r, password: a, name: n, email: o, phone: i, business_name: c, business_number: l } = await e.req.json();
    if (!r || !a || !n || !o || !c) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (await s.prepare("SELECT id FROM sellers WHERE username = ?").bind(r).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC544\uC774\uB514\uC785\uB2C8\uB2E4" }, 400);
    if (await s.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
    const m = `$2a$10$placeholder_hash_for_${a}`, _ = await s.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(r, m, n, o, i || null, c, l || null, t.adminId).run();
    return e.json({ success: true, data: { id: _.meta.last_row_id, username: r, name: n, email: o, business_name: c } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/admin/sellers/:id", async (e) => {
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { name: a, email: n, phone: o, business_name: i, business_number: c, is_active: l, status: u } = await e.req.json();
    return await s.prepare("SELECT id FROM sellers WHERE id = ?").bind(r).first() ? (await s.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i, c || null, l, u, r).run(), e.json({ success: true })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/admin/sellers/:id", async (e) => {
  const { DB: s } = e.env, t = await x(e);
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
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { new_password: a } = await e.req.json();
    if (!a || a.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const n = await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = `$2a$10$placeholder_hash_for_${a}`;
    return await s.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o, r).run(), await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.username}'\uC758 \uBE44\uBC00\uBC88\uD638\uAC00 \uC7AC\uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4` });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/admin/sellers/:id/commission", async (e) => {
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { commission_rate: a } = await e.req.json();
    if (a == null) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = parseFloat(a);
    if (isNaN(n) || n < 0 || n > 100) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC740 0\uC5D0\uC11C 100 \uC0AC\uC774\uC758 \uAC12\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const o = await s.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(r).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const i = o.commission_rate || 10;
    return await s.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n, r).run(), console.log(`\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD: \uD310\uB9E4\uC790 ${o.username} (ID: ${r}), ${i}% \u2192 ${n}%`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${o.username}'\uC758 \uC218\uC218\uB8CC\uC728\uC774 ${i}%\uC5D0\uC11C ${n}%\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: o.username, old_commission_rate: i, new_commission_rate: n } });
  } catch (r) {
    return console.error("\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/admin/sellers/:id/approve", async (e) => {
  const { DB: s } = e.env, t = await x(e);
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
      const { sendEmail: n, getSellerApprovalEmailHTML: o } = await Promise.resolve().then(() => kr), i = e.env.RESEND_API_KEY || "", c = o(a.name, a.username), l = await n({ to: a.email, subject: "\u{1F389} \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790 \uC2B9\uC778 \uC644\uB8CC", html: c }, i, e.env.EMAIL_FROM || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <noreply@ur-team.com>");
      l.success ? console.log(`[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC131\uACF5: ${a.email}`) : console.warn(`[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC2E4\uD328: ${l.error}`);
    } catch (n) {
      console.error("[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC624\uB958:", n);
    }
    try {
      const { createNotification: n, NotificationTemplates: o } = await Promise.resolve().then(() => Cr), i = o.seller_approved(a.name);
      await n(s, { userId: parseInt(r), type: "seller_approved", title: i.title, message: i.message, linkUrl: i.linkUrl });
    } catch (n) {
      console.error("[\uC140\uB7EC \uC2B9\uC778] \uC54C\uB9BC \uC0DD\uC131 \uC624\uB958:", n);
    }
    return e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.name}'\uB2D8\uC774 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: a.username, seller_name: a.name, status: "approved", approved_at: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (r) {
    return console.error("\uC140\uB7EC \uC2B9\uC778 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.patch("/api/admin/sellers/:id/reject", async (e) => {
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { reason: a } = await e.req.json();
    if (!a) return e.json({ success: false, error: "\uAC70\uBD80 \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (n.status === "rejected") return e.json({ success: false, error: "\uC774\uBBF8 \uAC70\uBD80\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400);
    if (await s.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, t.adminId, r).run(), console.log(`\uC140\uB7EC \uAC70\uBD80: ${n.username} (ID: ${r}), \uC0AC\uC720: ${a}`), n.email) try {
      const { sendEmail: o, getSellerRejectionEmailHTML: i } = await Promise.resolve().then(() => kr), c = e.env.RESEND_API_KEY || "", l = i(n.name, a), u = await o({ to: n.email, subject: "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790 \uC2B9\uC778 \uACB0\uACFC \uC548\uB0B4", html: l }, c, e.env.EMAIL_FROM || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <noreply@ur-team.com>");
      u.success ? console.log(`[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC131\uACF5: ${n.email}`) : console.warn(`[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC2E4\uD328: ${u.error}`);
    } catch (o) {
      console.error("[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC624\uB958:", o);
    }
    try {
      const { createNotification: o, NotificationTemplates: i } = await Promise.resolve().then(() => Cr), c = i.seller_rejected(a);
      await o(s, { userId: parseInt(r), type: "seller_rejected", title: c.title, message: c.message, linkUrl: c.linkUrl });
    } catch (o) {
      console.error("[\uC140\uB7EC \uAC70\uBD80] \uC54C\uB9BC \uC0DD\uC131 \uC624\uB958:", o);
    }
    return e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.name}'\uB2D8\uC758 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: n.username, seller_name: n.name, status: "rejected", rejection_reason: a, rejected_at: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (r) {
    return console.error("\uC140\uB7EC \uAC70\uBD80 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/sellers/pending", async (e) => {
  const { DB: s } = e.env, t = await x(e);
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
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = /* @__PURE__ */ new Date();
    r.setHours(0, 0, 0, 0);
    const a = r.toISOString(), n = await s.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM orders
      WHERE payment_status = 'approved'
      AND status = 'paid'
      AND created_at >= ?
    `).bind(a).first(), o = (n == null ? void 0 : n.sales) || 0, i = await s.prepare(`
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
    return e.json({ success: true, stats: { todaySales: o, todayOrders: c, currentVisitors: d, liveStreams: _ }, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/public/seller/:sellerId", async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = e.req.param("sellerId"), a = `public:seller:${r}`, n = await So(t, a);
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await s.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
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
    `).bind(r).first(), d = { profile: o, live_streams: i.results, scheduled_streams: c.results, products: l.results, stats: u };
    return await ds(t, a, d, 60, false), e.json({ success: true, data: d });
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
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { period: r } = e.req.query();
    let a = "";
    const n = /* @__PURE__ */ new Date();
    switch (r) {
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
    return e.json({ success: true, data: { overview: o, sellers: i.results, period: r || "all" } });
  } catch (r) {
    return console.error("\uC815\uC0B0 \uD1B5\uACC4 \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/settlement/records", async (e) => {
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { seller_id: r, period: a, status: n } = e.req.query();
    let o = ["payment_status = 'completed'", "is_cancelled = 0"];
    const i = [];
    r && (o.push("o.seller_id = ?"), i.push(r)), n && (o.push("o.settlement_status = ?"), i.push(n));
    const c = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const d = c.toISOString().split("T")[0];
        o.push(`DATE(o.created_at) = '${d}'`);
        break;
      case "week":
        const m = new Date(c.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${m}'`);
        break;
      case "month":
        const _ = new Date(c.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${_}'`);
        break;
    }
    const l = o.length > 0 ? `WHERE ${o.join(" AND ")}` : "", u = await s.prepare(`
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
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("orderId"), { status: a } = await e.req.json();
    if (!["pending", "completed"].includes(a)) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC815\uC0B0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4" }, 400);
    const n = await s.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(r).first();
    return n ? (await s.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a === "completed" ? "datetime('now')" : "NULL"}
      WHERE id = ?
    `).bind(a, r).run(), console.log(`\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD: \uC8FC\uBB38 ${n.order_number}, ${n.settlement_status} \u2192 ${a}`), e.json({ success: true, message: `\uC815\uC0B0 \uC0C1\uD0DC\uAC00 '${a}'\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { order_id: r, order_number: n.order_number, old_status: n.settlement_status, new_status: a } })) : e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/settlement/batch-complete", async (e) => {
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { order_ids: r } = await e.req.json();
    if (!Array.isArray(r) || r.length === 0) return e.json({ success: false, error: "\uC8FC\uBB38 ID \uBC30\uC5F4\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    let a = 0, n = 0;
    for (const o of r) try {
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
    return e.json({ success: true, message: `${a}\uAC74 \uC815\uC0B0 \uC644\uB8CC, ${n}\uAC74 \uC2E4\uD328`, data: { total: r.length, success: a, failed: n } });
  } catch (r) {
    return console.error("\uC77C\uAD04 \uC815\uC0B0 \uCC98\uB9AC \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/settlement/export-csv", async (e) => {
  const { DB: s } = e.env, t = await x(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { seller_id: r, period: a } = e.req.query();
    let n = ["payment_status = 'completed'", "is_cancelled = 0"];
    const o = [];
    r && (n.push("o.seller_id = ?"), o.push(r));
    const i = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const f = i.toISOString().split("T")[0];
        n.push(`DATE(o.created_at) = '${f}'`);
        break;
      case "week":
        const E = new Date(i.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${E}'`);
        break;
      case "month":
        const b = new Date(i.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${b}'`);
        break;
    }
    const c = n.length > 0 ? `WHERE ${n.join(" AND ")}` : "", u = (await s.prepare(`
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
    if (u.length === 0) return e.json({ success: false, error: "\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const d = Object.keys(u[0]);
    let m = d.join(",") + `
`;
    u.forEach((f) => {
      const E = d.map((b) => {
        const w = f[b];
        if (w == null) return "";
        const g = String(w);
        return g.includes(",") || g.includes('"') || g.includes(`
`) ? `"${g.replace(/"/g, '""')}"` : g;
      });
      m += E.join(",") + `
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
    const { userId: t, cartItems: r, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i, buyerBusinessNumber: c, buyerBusinessName: l, buyerCeoName: u } = await e.req.json();
    console.log("[DEPRECATED /api/orders/create] \uC8FC\uBB38 \uC0DD\uC131 \uC694\uCCAD:", { userId: t, cartItems: r == null ? void 0 : r.length, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i });
    let d = 10;
    if (o) {
      const v = await s.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();
      v && v.commission_rate !== null && (d = v.commission_rate);
    }
    console.log("\uC218\uC218\uB8CC\uC728:", { sellerId: o, commissionRate: d });
    const m = Math.floor(a * (d / 100)), _ = a - m;
    let f = null;
    if (n) {
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
      `).bind(n, t).first();
      if (!v) return e.json({ success: false, error: "\uBC30\uC1A1\uC9C0 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
      f = v;
    }
    if (!t) return e.json({ success: false, error: "User ID is required. Please login with Kakao first." }, 401);
    const E = t, b = /* @__PURE__ */ new Date(), w = b.getFullYear().toString().slice(-2), g = (b.getMonth() + 1).toString().padStart(2, "0"), T = b.getDate().toString().padStart(2, "0"), y = `${w}${g}${T}`, R = Math.random().toString(36).substring(2, 7).toUpperCase(), $ = `ORD-${y}-${R}`, k = r.map((v) => v.product_id), O = k.map(() => "?").join(","), W = await s.prepare(`
      SELECT id, stock FROM products WHERE id IN (${O})
    `).bind(...k).all(), P = new Map(W.results.map((v) => [v.id, v.stock]));
    for (const v of r) {
      const te = P.get(v.product_id);
      if (te === void 0) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${v.product_id})` }, 400);
      if (te < v.quantity) return e.json({ success: false, error: `\uC7AC\uACE0\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4 (\uC0C1\uD488 ID: ${v.product_id})` }, 400);
    }
    const F = (await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind($, E, a, "pending", o || null, d, m, _, n || null, (f == null ? void 0 : f.recipient_name) || null, (f == null ? void 0 : f.phone) || null, f != null && f.address ? `${f.address} ${f.address_detail}` : null, (f == null ? void 0 : f.postal_code) || null, i ? 1 : 0, c || null, l || null, u || null).run()).meta.last_row_id, Q = r.map((v) => s.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(F, v.product_id, v.option_id || null, v.quantity, v.price_snapshot || v.price)), Y = r.map((v) => s.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(v.quantity, v.product_id));
    await s.batch([...Q, ...Y]);
    try {
      const v = gs(e.env), te = r.map((z) => z.product_id), q = te.map(() => "?").join(","), U = await s.prepare(`
        SELECT id, name, price, original_price, discount_rate, stock, image_url
        FROM products
        WHERE id IN (${q})
      `).bind(...te).all();
      await Promise.all(U.results.map((z) => v.updateProductStock(z.id, z.stock, { name: z.name, price: z.price, original_price: z.original_price, discount_rate: z.discount_rate, image_url: z.image_url }))), console.log(`\u{1F525} Firebase: Stock updated for ${U.results.length} products`);
    } catch (v) {
      console.error("\u26A0\uFE0F Firebase stock sync failed (non-blocking):", v);
    }
    try {
      const v = r.map((U) => U.product_id), te = v.map(() => "?").join(","), q = await s.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${te})
      `).bind(...v).all();
      for (const U of q.results) {
        const z = U.stock_alert_threshold || 5, de = U.stock;
        de <= z && U.seller_id && (await Sr(s, U.seller_id, U.name, de, z), console.log(`[Low Stock Alert] ${U.name}: ${de} <= ${z}`));
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
    const r = await rs(e.env.SESSION_KV, t);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (r.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = r.seller_id || r.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], l = await s.prepare(`
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
    const r = await rs(e.env.SESSION_KV, t);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (r.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = r.seller_id || r.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], l = await s.prepare(`
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
      const m = d.status === "delivered" ? "\uBC30\uC1A1\uC644\uB8CC" : d.status === "shipped" ? "\uBC30\uC1A1\uC911" : d.status === "preparing" ? "\uC0C1\uD488\uC900\uBE44\uC911" : d.status === "paid" ? "\uACB0\uC81C\uC644\uB8CC" : "\uB300\uAE30\uC911", _ = d.buyer_business_name || "-", f = d.buyer_business_number || "-", E = d.invoice_number || "-", b = d.issue_date || "-", w = d.tax_invoice_status === "issued" ? "\uBC1C\uD589\uC644\uB8CC" : d.tax_invoice_status === "cancelled" ? "\uCDE8\uC18C" : "-", g = d.nts_confirm_number || "-";
      u += `${d.order_number},${d.created_at},${d.user_name || "\uC775\uBA85"},${d.total_amount},${d.commission_amount},${d.seller_amount},${m},${_},${f},${E},${b},${w},${g}
`;
    }
    return new Response(u, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${i}_${c}.csv"` } });
  } catch (s) {
    return console.error("CSV download error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/tax-invoices/issue", async (e) => {
  const { DB: s } = e.env, t = await C(e);
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
    const n = await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(t.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC2B9\uC778\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778\uC744 \uAE30\uB2E4\uB824\uC8FC\uC138\uC694." }, 400);
    const o = await s.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(), i = Number(a.total_amount), c = Math.floor(i / 1.1), l = i - c, u = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], d = `${u}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, m = va(n, a, o.results);
    let _, f, E;
    try {
      _ = await Ia(m), f = _.ntsConfirmNumber, E = _.invoiceKey, console.log("\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC131\uACF5:", { ntsConfirmNumber: f, invoiceKey: E, mockMode: cs() });
    } catch (g) {
      console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", g), f = "FAILED", E = null;
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
    `).bind(t.sellerId, r, "tax", d, u, n.business_number, n.business_name, n.ceo_name, n.address, n.business_type, n.business_category, a.buyer_business_number, a.buyer_business_name, a.buyer_ceo_name, c, l, i, f === "FAILED" ? "failed" : "issued", cs() ? "mock" : "barobill", E, f).run()).meta.last_row_id;
    for (const g of o.results) {
      const T = Math.floor(Number(g.price) * Number(g.quantity) / 1.1), y = Number(g.price) * Number(g.quantity) - T;
      await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(w, g.id, g.product_name, g.quantity, g.price, T, y).run();
    }
    return e.json({ success: true, data: { invoice_id: w, invoice_number: d, issue_date: u, total_amount: i, supply_price: c, tax_amount: l, status: f === "FAILED" ? "failed" : "issued", nts_confirm_number: f, api_invoice_key: E, mock_mode: cs(), message: f === "FAILED" ? "\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328. \uB098\uC911\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694." : cs() ? "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (Mock Mode - \uC2E4\uC81C \uBC1C\uD589 \uC544\uB2D8)" : "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4." } });
  } catch (r) {
    return console.error("\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC624\uB958:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/tax-invoices", async (e) => {
  var r;
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { start_date: a, end_date: n, status: o } = e.req.query();
    let i = `
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;
    const c = [t.sellerId];
    a && (i += " AND issue_date >= ?", c.push(a)), n && (i += " AND issue_date <= ?", c.push(n)), o && (i += " AND status = ?", c.push(o)), i += " ORDER BY created_at DESC";
    const l = await s.prepare(i).bind(...c).all();
    return e.json({ success: true, data: l.results || [], total: ((r = l.results) == null ? void 0 : r.length) || 0 });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/seller/tax-invoices/:id", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), a = await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r, t.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = await s.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(r).all();
    return e.json({ success: true, data: { ...a, items: n.results || [] } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/tax-invoices/:id/cancel", async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { reason: a } = await e.req.json(), n = await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r, t.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const o = new Date(n.issue_date), i = new Date(o);
    if (i.setDate(i.getDate() + 1), /* @__PURE__ */ new Date() > i) return e.json({ success: false, error: "\uBC1C\uD589\uC77C \uC775\uC77C\uAE4C\uC9C0\uB9CC \uCDE8\uC18C \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 400);
    try {
      if (n.api_invoice_key && !cs()) {
        const l = await s.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(t.sellerId).first();
        l && l.business_number && await Ra(l.business_number, n.api_invoice_key, a || "\uD310\uB9E4\uC790 \uC694\uCCAD");
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
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { status: r, limit: a = 50 } = e.req.query();
    let n = `
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;
    const o = [t.sellerId];
    r && (n += " AND log.status = ?", o.push(r)), n += " ORDER BY log.created_at DESC LIMIT ?", o.push(Number(a));
    const i = await s.prepare(n).bind(...o).all();
    return e.json({ success: true, data: i.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/tax-invoices/retry/:orderNumber", async (e) => {
  const { DB: s } = e.env, t = await C(e);
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
    `).bind(r).first();
    if (!o) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (!o.buyer_business_number || !o.buyer_business_name) return e.json({ success: false, error: "\uC8FC\uBB38\uC5D0 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 400);
    const i = await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(t.sellerId).first();
    if (!i) return e.json({ success: false, error: "\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const c = await s.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(), l = Number(o.total_amount), u = Math.floor(l / 1.1), d = l - u, m = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), _ = Math.random().toString(36).substring(2, 8).toUpperCase(), f = `${m}-${_}`, b = (await s.prepare(`
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
    `).bind(t.sellerId, r, f, i.business_number, i.business_name, i.ceo_name, i.address || "", i.business_type || "", i.business_category || "", i.email || "", i.phone || "", o.buyer_business_number, o.buyer_business_name, o.buyer_ceo_name || "", o.buyer_business_address || "", o.buyer_business_type || "", o.buyer_business_category || "", o.buyer_email || "", o.buyer_phone || "", u, d, l, `RETRY-${Date.now()}-${_}`).run()).meta.last_row_id;
    for (const w of c.results) {
      const g = Math.floor(Number(w.price) * Number(w.quantity) / 1.1), T = Number(w.price) * Number(w.quantity) - g;
      await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(b, w.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", w.quantity, w.price, g, T, w.option_name || "").run();
    }
    return await s.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(r, t.sellerId, b, n + 1).run(), await s.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n + 1, a.id).run(), console.log(`[TAX INVOICE RETRY] \u2705 \uC7AC\uC2DC\uB3C4 \uC131\uACF5: invoice_id=${b}, retry_count=${n + 1}`), e.json({ success: true, data: { invoice_id: b, invoice_number: f, retry_count: n + 1 } });
  } catch (r) {
    console.error("[TAX INVOICE RETRY] \uC7AC\uC2DC\uB3C4 \uC2E4\uD328:", r);
    try {
      const a = e.req.param("orderNumber"), n = await s.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a, t.sellerId).first(), o = Number((n == null ? void 0 : n.retry_count) || 0);
      await s.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a, t.sellerId, r.message, o + 1).run();
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
    const n = `<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY || "975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;
    return r = r.replace("<!-- Scripts -->", `<!-- Scripts -->
    ${n}`), console.log("[Live Page] Environment variables injected"), new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
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
    const { profile_image: a, bio: n, sns_instagram: o, sns_youtube: i, sns_facebook: c, sns_twitter: l, website_url: u, kakao_chat_link: d } = await e.req.json(), m = [], _ = [];
    if (a !== void 0 && (m.push("profile_image = ?"), _.push(a)), n !== void 0 && (m.push("bio = ?"), _.push(n)), o !== void 0 && (m.push("sns_instagram = ?"), _.push(o)), i !== void 0 && (m.push("sns_youtube = ?"), _.push(i)), c !== void 0 && (m.push("sns_facebook = ?"), _.push(c)), l !== void 0 && (m.push("sns_twitter = ?"), _.push(l)), u !== void 0 && (m.push("website_url = ?"), _.push(u)), d !== void 0 && (m.push("kakao_chat_link = ?"), _.push(d)), m.length === 0) return e.json({ success: false, error: "\uC218\uC815\uD560 \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
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
    const t = e.get("userId"), r = e.get("userType"), a = parseInt(e.req.query("limit") || "50"), n = e.req.query("unread_only") === "true";
    let o = `
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;
    n && (o += " AND is_read = 0"), o += " ORDER BY created_at DESC LIMIT ?";
    const i = await s.prepare(o).bind(t, r, a).all();
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
    const { title: r, image_url: a, link_url: n, description: o, is_active: i, display_order: c, start_date: l, end_date: u } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "\uC81C\uBAA9\uACFC \uC774\uBBF8\uC9C0\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const d = await s.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a, n || null, o || null, i !== false ? 1 : 0, c || 0, l || null, u || null).run();
    return e.json({ success: true, id: d.meta.last_row_id });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.put("/api/admin/banners/:id", j, async (e) => {
  const { DB: s } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const r = e.req.param("id"), { title: a, image_url: n, link_url: o, description: i, is_active: c, display_order: l, start_date: u, end_date: d } = await e.req.json();
    return await s.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a, n, o || null, i || null, c ? 1 : 0, l || 0, u || null, d || null, r).run(), e.json({ success: true });
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
  if (e instanceof wn) return console.error("[AppError]", { path: t, method: s.req.method, code: e.code, message: e.message, statusCode: e.statusCode }), s.json({ success: false, error: { code: e.code, message: e.message, ...e.details && { details: e.details } } }, e.statusCode);
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
    const { plan_name: t, min_quantity: r, max_quantity: a, unit_price: n } = await e.req.json();
    if (!t || !r || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = await s.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(t, r, a || null, n).run();
    return e.json({ success: true, pricing_id: o.meta.last_row_id });
  } catch (t) {
    return console.error("[Admin Alimtalk Pricing Create] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.put("/api/admin/alimtalk/pricing/:id", S(), async (e) => {
  const { env: s } = e, t = e.req.param("id");
  try {
    const { plan_name: r, min_quantity: a, max_quantity: n, unit_price: o, is_active: i } = await e.req.json();
    return (await s.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r, a, n || null, o, i ? 1 : 0, t).run()).meta.changes === 0 ? e.json({ success: false, error: "Pricing not found" }, 404) : e.json({ success: true, message: "Pricing updated successfully" });
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
    `).bind(t || "2000-01-01", r || "2100-01-01").first(), n = await s.DB.prepare(`
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
    return e.json({ success: true, statistics: { total: a, by_seller: n.results } });
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
    const t = e.req.header("X-Session-Token"), r = await Pe(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { channel_id: a, phone_number: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = ar(n), i = await Ha(s, { channelId: a, phoneNumber: o });
    if (!i.success) return e.json({ success: false, error: "Failed to register Kakao channel" }, 500);
    const c = await s.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(r.user_id, a, a, i.senderKey, o).run();
    return e.json({ success: true, account_id: c.meta.last_row_id, sender_key: i.senderKey, message: "Kakao channel registered successfully" });
  } catch (t) {
    return console.error("[Seller Alimtalk Register] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/seller/alimtalk/templates", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Pe(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const a = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!a) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const n = await s.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();
    return e.json({ success: true, templates: n.results });
  } catch (t) {
    return console.error("[Seller Alimtalk Templates] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/alimtalk/templates", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Pe(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_code: a, template_name: n, template_content: o, template_type: i } = await e.req.json();
    if (!a || !n || !o) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (!(await Ka(s, c.sender_key, { name: n, content: o, templateCode: a })).success) return e.json({ success: false, error: "Failed to register template" }, 500);
    const u = await s.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id, a, n, o, i || "basic").run();
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
    const t = e.req.header("X-Session-Token"), r = await Pe(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { amount: a, pricing_id: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!o) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const i = await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();
    if (!i) return e.json({ success: false, error: "Pricing not found" }, 404);
    const c = a * i.unit_price, l = `alimtalk_${o.id}_${Date.now()}`, u = await s.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id, a, c, i.unit_price, l).run(), d = `https://api.tosspayments.com/v1/payment/${l}`;
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
    const t = e.req.header("X-Session-Token"), r = await Pe(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_id: a, recipient_phone: n, variables: o, order_id: i } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
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
    const u = Ba(l.template_content, o || {}), d = ar(n), m = await Zs(s, { senderKey: c.sender_key, templateCode: l.template_code, to: d, message: u });
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
    const t = e.req.header("X-Session-Token"), r = await Pe(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { page: a = "1", limit: n = "20", status: o } = e.req.query(), i = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!i) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const c = (parseInt(a) - 1) * parseInt(n);
    let l = `
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;
    const u = [i.id];
    o && (l += " AND m.status = ?", u.push(o)), l += " ORDER BY m.created_at DESC LIMIT ? OFFSET ?", u.push(parseInt(n), c);
    const d = await s.DB.prepare(l).bind(...u).all(), m = await s.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();
    return e.json({ success: true, messages: d.results, pagination: { total: m.total, page: parseInt(a), limit: parseInt(n) } });
  } catch (t) {
    return console.error("[Seller Alimtalk Messages] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/seller/alimtalk/statistics", S(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await Pe(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { start_date: a, end_date: n } = e.req.query(), o = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
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
    `).bind(o.id, a || "2000-01-01", n || "2100-01-01").all(), l = i.total_sent > 0 ? (i.total_success / i.total_sent * 100).toFixed(2) : 0;
    return e.json({ success: true, statistics: { total_sent: i.total_sent, total_success: i.total_success, total_failed: i.total_failed, success_rate: l, total_cost: i.total_cost, by_template: c.results } });
  } catch (t) {
    return console.error("[Seller Alimtalk Statistics] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/alimtalk/send", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await e.req.json(), { templateId: r, recipients: a, variables: n } = t;
    if (!r || !Array.isArray(a) || a.length === 0) return e.json({ success: false, error: "templateId and recipients are required" }, 400);
    const o = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();
    if (!o) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    const i = await et(e.env, { accountId: o.id, templateId: parseInt(r), recipients: a.map((c) => ({ phone: c.phone, name: c.name, variables: c.variables || {} })), variables: n || {} });
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (s) {
    return console.error("[Alimtalk Send] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/alimtalk/send/order", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await e.req.json(), { templateId: r, orderId: a, customMessage: n } = t;
    if (!r || !a) return e.json({ success: false, error: "templateId and orderId are required" }, 400);
    const o = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();
    if (!o) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    if (!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a), parseInt(s)).first()) return e.json({ success: false, error: "Order not found or unauthorized" }, 404);
    const c = await tn(e.env, o.id, parseInt(r), parseInt(a), n);
    return e.json({ success: c.success, data: { total: c.totalRecipients, sent: c.successCount, failed: c.failedCount, refunded: c.refundedAmount }, messages: c.messages });
  } catch (s) {
    return console.error("[Alimtalk Send Order] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/alimtalk/send/bulk", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = await e.req.json(), { templateId: r, rows: a, variables: n } = t;
    if (!r || !Array.isArray(a) || a.length === 0) return e.json({ success: false, error: "templateId and rows are required" }, 400);
    const o = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();
    if (!o) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    const i = await rn(e.env, o.id, parseInt(r), a, n || {});
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (s) {
    return console.error("[Alimtalk Send Bulk] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/alimtalk/templates/:id/preview", S(), async (e) => {
  try {
    const s = e.req.header("X-Seller-ID");
    if (!s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const t = e.req.param("id"), r = await e.req.json(), { variables: a } = r, n = await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(t), parseInt(s)).first();
    if (!n) return e.json({ success: false, error: "Template not found" }, 404);
    let o = n.template_content;
    return a && Object.entries(a).forEach(([i, c]) => {
      const l = new RegExp(`#{${i}}`, "g");
      o = o.replace(l, c);
    }), e.json({ success: true, data: { template_name: n.template_name, original: n.template_content, preview: o, required_variables: Array.from(n.template_content.matchAll(/#{(\w+)}/g), (i) => i[1]) } });
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
    const s = parseInt(e.req.param("id")), t = await un(e.env.DB, s);
    return t ? e.json({ success: true, data: t }) : e.json({ success: false, error: "Settlement not found" }, 404);
  } catch (s) {
    return console.error("[Admin Settlement Detail] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/admin/settlements/generate", S(), async (e) => {
  try {
    const s = await e.req.json(), { startDate: t, endDate: r } = s, a = t && r ? { startDate: t, endDate: r } : nn(), n = await cn(e.env.DB, a);
    return await ln(e.env.DB, n), e.json({ success: true, data: n });
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
  if (!(await x(e)).success) return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const r = e.req.query("seller_id"), a = e.req.query("period") || "monthly", n = e.req.query("format") || "json";
    let o = e.req.query("start_date"), i = e.req.query("end_date");
    if (!r) return e.json({ success: false, error: "seller_id\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    const c = /* @__PURE__ */ new Date();
    if (a === "weekly") {
      const g = new Date(c);
      g.setDate(c.getDate() - c.getDay() - 6), g.setHours(0, 0, 0, 0);
      const T = new Date(g);
      T.setDate(g.getDate() + 6), T.setHours(23, 59, 59, 999), o = g.toISOString().split("T")[0], i = T.toISOString().split("T")[0];
    } else if (a === "monthly") {
      const g = new Date(c.getFullYear(), c.getMonth() - 1, 1), T = new Date(c.getFullYear(), c.getMonth(), 0);
      o = g.toISOString().split("T")[0], i = T.toISOString().split("T")[0];
    } else if (a === "custom" && (!o || !i)) return e.json({ success: false, error: "custom \uAE30\uAC04 \uC120\uD0DD \uC2DC start_date\uC640 end_date\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
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
    `).bind(r, o, i).all()).results, m = d.length, _ = d.reduce((g, T) => g + (T.total_amount || 0), 0), f = d.reduce((g, T) => g + (T.commission_amount || 0), 0), E = _ - f, b = m > 0 ? d.reduce((g, T) => g + (T.commission_rate || 0), 0) / m : 0, w = { sellerId: parseInt(r), sellerName: l.seller_name || "Unknown", businessName: l.business_name || null, period: { type: a, startDate: o, endDate: i }, summary: { totalOrders: m, totalSales: _, totalCommission: f, netAmount: E, commissionRate: Math.round(b * 100) / 100 }, orders: d.map((g) => ({ orderNumber: g.order_number, createdAt: g.created_at, status: g.status, totalAmount: g.total_amount || 0, commissionAmount: g.commission_amount || 0, sellerAmount: g.seller_amount || 0 })) };
    if (n === "csv") {
      const g = [];
      g.push("\uC140\uB7EC \uC815\uC0B0\uC11C"), g.push(`\uC140\uB7EC\uBA85,${w.sellerName}`), g.push(`\uC0AC\uC5C5\uC790\uBA85,${w.businessName || "N/A"}`), g.push(`\uC815\uC0B0 \uAE30\uAC04,${w.period.startDate} ~ ${w.period.endDate}`), g.push(""), g.push("\uAD6C\uBD84,\uAE08\uC561"), g.push(`\uCD1D \uC8FC\uBB38 \uAC74\uC218,${w.summary.totalOrders}\uAC74`), g.push(`\uCD1D \uB9E4\uCD9C,${w.summary.totalSales.toLocaleString()}\uC6D0`), g.push(`\uD50C\uB7AB\uD3FC \uC218\uC218\uB8CC (${w.summary.commissionRate}%),${w.summary.totalCommission.toLocaleString()}\uC6D0`), g.push(`\uC815\uC0B0 \uAE08\uC561,${w.summary.netAmount.toLocaleString()}\uC6D0`), g.push(""), g.push("\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC0C1\uD0DC,\uC8FC\uBB38\uAE08\uC561,\uD50C\uB7AB\uD3FC\uC218\uC218\uB8CC,\uC815\uC0B0\uAE08\uC561");
      for (const R of w.orders) g.push(`${R.orderNumber},${R.createdAt},${R.status},${R.totalAmount},${R.commissionAmount},${R.sellerAmount}`);
      const T = g.join(`
`), y = `settlement_${r}_${o}_${i}.csv`;
      return e.text(T, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${y}"` });
    }
    return e.json({ success: true, data: w });
  } catch (r) {
    return console.error("[Settlement] Calculation error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/settlements/my", S(), async (e) => {
  const { DB: s } = e.env, t = await C(e);
  if (!t.success) return e.json({ success: false, error: "\uC140\uB7EC \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  const r = new URL(e.req.url);
  r.searchParams.set("seller_id", String(t.sellerId));
  const a = new Request(r.toString(), e.req.raw);
  ({ ...e, req: new Proxy(a, { get(n, o) {
    return o === "query" ? (i) => i === "seller_id" ? String(t.sellerId) : r.searchParams.get(i) : n[o];
  } }) });
  try {
    const n = t.sellerId, o = e.req.query("period") || "monthly", i = e.req.query("format") || "json";
    let c = e.req.query("start_date"), l = e.req.query("end_date");
    const u = /* @__PURE__ */ new Date();
    if (o === "weekly") {
      const y = new Date(u);
      y.setDate(u.getDate() - u.getDay() - 6), y.setHours(0, 0, 0, 0);
      const R = new Date(y);
      R.setDate(y.getDate() + 6), R.setHours(23, 59, 59, 999), c = y.toISOString().split("T")[0], l = R.toISOString().split("T")[0];
    } else if (o === "monthly") {
      const y = new Date(u.getFullYear(), u.getMonth() - 1, 1), R = new Date(u.getFullYear(), u.getMonth(), 0);
      c = y.toISOString().split("T")[0], l = R.toISOString().split("T")[0];
    } else if (o === "custom" && (!c || !l)) return e.json({ success: false, error: "custom \uAE30\uAC04 \uC120\uD0DD \uC2DC start_date\uC640 end_date\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    const d = await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(n).first();
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
    `).bind(n, c, l).all()).results, f = _.length, E = _.reduce((y, R) => y + (R.total_amount || 0), 0), b = _.reduce((y, R) => y + (R.commission_amount || 0), 0), w = E - b, g = f > 0 ? _.reduce((y, R) => y + (R.commission_rate || 0), 0) / f : 0, T = { sellerId: n, sellerName: d.seller_name || "Unknown", businessName: d.business_name || null, period: { type: o, startDate: c, endDate: l }, summary: { totalOrders: f, totalSales: E, totalCommission: b, netAmount: w, commissionRate: Math.round(g * 100) / 100 }, orders: _.map((y) => ({ orderNumber: y.order_number, createdAt: y.created_at, status: y.status, totalAmount: y.total_amount || 0, commissionAmount: y.commission_amount || 0, sellerAmount: y.seller_amount || 0 })) };
    if (i === "csv") {
      const y = [];
      y.push("\uC140\uB7EC \uC815\uC0B0\uC11C"), y.push(`\uC140\uB7EC\uBA85,${T.sellerName}`), y.push(`\uC0AC\uC5C5\uC790\uBA85,${T.businessName || "N/A"}`), y.push(`\uC815\uC0B0 \uAE30\uAC04,${T.period.startDate} ~ ${T.period.endDate}`), y.push(""), y.push("\uAD6C\uBD84,\uAE08\uC561"), y.push(`\uCD1D \uC8FC\uBB38 \uAC74\uC218,${T.summary.totalOrders}\uAC74`), y.push(`\uCD1D \uB9E4\uCD9C,${T.summary.totalSales.toLocaleString()}\uC6D0`), y.push(`\uD50C\uB7AB\uD3FC \uC218\uC218\uB8CC (${T.summary.commissionRate}%),${T.summary.totalCommission.toLocaleString()}\uC6D0`), y.push(`\uC815\uC0B0 \uAE08\uC561,${T.summary.netAmount.toLocaleString()}\uC6D0`), y.push(""), y.push("\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC0C1\uD0DC,\uC8FC\uBB38\uAE08\uC561,\uD50C\uB7AB\uD3FC\uC218\uC218\uB8CC,\uC815\uC0B0\uAE08\uC561");
      for (const k of T.orders) y.push(`${k.orderNumber},${k.createdAt},${k.status},${k.totalAmount},${k.commissionAmount},${k.sellerAmount}`);
      const R = y.join(`
`), $ = `my_settlement_${c}_${l}.csv`;
      return e.text(R, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${$}"` });
    }
    return e.json({ success: true, data: T });
  } catch (n) {
    return console.error("[My Settlement] Error:", n), e.json({ success: false, error: n.message }, 500);
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
  return dn(s, e.env);
});
p.get("/api/live/:streamId/chat/sse", async (e) => {
  const s = e.req.param("streamId");
  return pn(s, e.env);
});
p.get("/api/seller/orders/sse", async (e) => {
  const s = e.req.header("X-Seller-ID");
  return s ? mn(s, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
p.get("/api/seller/stock/sse", async (e) => {
  const s = e.req.header("X-Seller-ID");
  return s ? _n(s, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
p.post("/api/push/subscribe", S(), async (e) => {
  try {
    const s = e.req.header("X-User-ID"), t = e.req.header("X-User-Type");
    if (!s || !t) return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await e.req.json();
    return await fn(e.env.DB, parseInt(s), t, r), e.json({ success: true });
  } catch (s) {
    return console.error("[Push Subscribe] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/push/unsubscribe", S(), async (e) => {
  try {
    const { endpoint: s } = await e.req.json();
    return s ? (await hn(e.env.DB, s), e.json({ success: true })) : e.json({ success: false, error: "Endpoint required" }, 400);
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
  return e.json({ success: true, data: { cache: { ...V, hitRate: `${r}%`, cacheSize: _e.size, maxSize: 1e3, memoryUsage: `${(_e.size / 1e3 * 100).toFixed(1)}%` }, description: { hits: "Memory cache\uB85C \uCC98\uB9AC\uB41C \uC694\uCCAD (KV \uC77D\uAE30 0\uD68C)", misses: "Memory cache \uBBF8\uC2A4\uB85C KV \uC870\uD68C\uD55C \uC694\uCCAD", writes: "Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", evictions: "Memory cache\uC5D0\uC11C \uC0AD\uC81C\uB41C \uD56D\uBAA9 \uC218 (\uB9CC\uB8CC \uB610\uB294 \uD06C\uAE30 \uC81C\uD55C)", hitRate: "Cache hit \uBE44\uC728 (\uB192\uC744\uC218\uB85D KV \uC0AC\uC6A9\uB7C9 \uAC10\uC18C)", cacheSize: "\uD604\uC7AC Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", maxSize: "Memory cache \uCD5C\uB300 \uD06C\uAE30", memoryUsage: "Memory cache \uC0AC\uC6A9\uB960 (cacheSize / maxSize)" }, kvUsageGuide: { currentHitRate: `${r}%`, recommendation: parseFloat(r) >= 90 ? "\u2705 \uCE90\uC2DC\uAC00 \uB9E4\uC6B0 \uD6A8\uACFC\uC801\uC73C\uB85C \uC791\uB3D9\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : parseFloat(r) >= 70 ? "\u26A0\uFE0F \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB0AE\uC2B5\uB2C8\uB2E4. TTL \uC870\uC815\uC744 \uACE0\uB824\uD558\uC138\uC694." : "\u274C \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB9E4\uC6B0 \uB0AE\uC2B5\uB2C8\uB2E4. \uCE90\uC2DC \uC124\uC815\uC744 \uD655\uC778\uD558\uC138\uC694.", kvDailyReadsLimit: "100,000 reads/day (free tier)", kvDailyWritesLimit: "1,000 writes/day (free tier)", estimatedDailyReads: Math.round(V.misses / (V.hits + V.misses || 1) * 1e4), estimatedDailyWrites: Math.round(V.writes / (V.hits + V.misses || 1) * 1e3) } } });
});
var Dt = {};
var kt = {};
p.get("/api/debug/kv-usage", S(), async (e) => {
  try {
    const s = Object.entries(Dt).sort((i, c) => c[1] - i[1]).slice(0, 20), t = Object.entries(kt).sort((i, c) => c[1] - i[1]).slice(0, 20), r = Object.values(Dt).reduce((i, c) => i + c, 0), a = Object.values(kt).reduce((i, c) => i + c, 0), n = r / 1e3 * 100, o = a / 1e5 * 100;
    if ((n >= 50 || o >= 50) && e.env.DISCORD_WEBHOOK_URL) try {
      await Sn(e.env.DISCORD_WEBHOOK_URL, o, n);
    } catch (i) {
      console.error("[Discord] KV \uACBD\uACE0 \uC804\uC1A1 \uC2E4\uD328:", i);
    }
    return e.json({ success: true, stats: { total_writes: r, total_reads: a, daily_write_limit: 1e3, daily_read_limit: 1e5, write_usage_percent: n.toFixed(2) + "%", read_usage_percent: o.toFixed(2) + "%", top_writes: s, top_reads: t }, recommendations: r > 500 ? ["\u26A0\uFE0F KV Write \uC0AC\uC6A9\uB7C9\uC774 \uB192\uC2B5\uB2C8\uB2E4!", "1. \uC138\uC158 \uAC31\uC2E0 \uC8FC\uAE30\uB97C \uB298\uB9AC\uC138\uC694 (\uD604\uC7AC 29\uC77C)", "2. \uCE90\uC2DC\uB97C \uBA54\uBAA8\uB9AC\uC5D0\uB9CC \uC800\uC7A5\uD558\uC138\uC694 (forceKvWrite: false)", "3. JWT \uC778\uC99D\uC73C\uB85C \uC804\uD658\uD558\uC138\uC694 (KV \uC0AC\uC6A9\uB7C9 90% \uAC10\uC18C)"] : ["\u2705 KV \uC0AC\uC6A9\uB7C9\uC774 \uC815\uC0C1 \uBC94\uC704\uC785\uB2C8\uB2E4."] });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/notifications", S(), async (e) => {
  var t;
  const { DB: s } = e.env;
  try {
    const r = e.req.query("userId"), a = parseInt(e.req.query("limit") || "20"), n = parseInt(e.req.query("offset") || "0");
    if (!r) return e.json({ success: false, error: "userId is required" }, 400);
    const o = await s.prepare(`
      SELECT id, type, title, message, link_url, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(r, a, n).all(), i = await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).bind(r).first();
    return e.json({ success: true, data: { notifications: o.results || [], unread_count: (i == null ? void 0 : i.count) || 0, total: ((t = o.results) == null ? void 0 : t.length) || 0 } });
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
async function Mo(e, s, t) {
  var a, n;
  const r = { embeds: [{ title: "\u{1F6A8} \uC11C\uBC84 \uC5D0\uB7EC \uBC1C\uC0DD", color: 16711680, fields: [{ name: "\uC5D0\uB7EC \uBA54\uC2DC\uC9C0", value: s.message || "Unknown error", inline: false }, { name: "\uBC1C\uC0DD \uC2DC\uAC01", value: (/* @__PURE__ */ new Date()).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }), inline: true }, { name: "HTTP \uBA54\uC18C\uB4DC", value: t.method || "N/A", inline: true }, { name: "API \uACBD\uB85C", value: t.path || "N/A", inline: false }, { name: "\uC0AC\uC6A9\uC790 ID", value: ((a = t.userId) == null ? void 0 : a.toString()) || "\uBE44\uB85C\uADF8\uC778", inline: true }, { name: "\uC0AC\uC6A9\uC790 \uD0C0\uC785", value: t.userType || "N/A", inline: true }, { name: "\uC5D0\uB7EC \uC2A4\uD0DD", value: "```\n" + (((n = s.stack) == null ? void 0 : n.substring(0, 800)) || "N/A") + "\n```", inline: false }], timestamp: (/* @__PURE__ */ new Date()).toISOString(), footer: { text: "UR LIVE Error Monitoring" } }] };
  try {
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) }), console.log("[Discord] Error alert sent successfully");
  } catch (o) {
    console.error("[Discord Webhook] Failed to send alert:", o);
  }
}
__name(Mo, "Mo");
__name2(Mo, "Mo");
p.onError(async (e, s) => {
  if (console.error("[Error]", e), s.env.DISCORD_WEBHOOK_URL) try {
    await Mo(s.env.DISCORD_WEBHOOK_URL, e, { method: s.req.method, path: s.req.path, userId: s.get("userId"), userType: s.get("userType") });
  } catch (t) {
    console.error("[Discord] Webhook failed, but continuing:", t);
  }
  return s.json({ success: false, error: { code: e.code || "INTERNAL_ERROR", message: e.message || "\uC11C\uBC84 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." } }, e.status || 500);
});
var Ct = new er();
var $o = Object.assign({ "/src/index.tsx": p });
var vr = false;
for (const [, e] of Object.entries($o)) e && (Ct.route("/", e), Ct.notFound(e.notFoundHandler), vr = true);
if (!vr) throw new Error("Can't import modules from ['/src/index.tsx']");
var is = null;
async function Ar(e, s) {
  try {
    const t = e.split(".");
    if (t.length !== 3) throw new Error("Invalid token structure");
    const r = JSON.parse(atob(t[0].replace(/-/g, "+").replace(/_/g, "/"))), a = JSON.parse(atob(t[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (console.log("[Firebase JWT] Token header:", r), console.log("[Firebase JWT] Token payload (aud, iss, exp):", { aud: a.aud, iss: a.iss, exp: a.exp }), a.aud !== s) throw new Error(`Invalid audience. Expected ${s}, got ${a.aud}`);
    if (!a.iss || !a.iss.includes(s)) throw new Error("Invalid issuer");
    if (a.exp < Math.floor(Date.now() / 1e3)) throw new Error("Token expired");
    return await Fo(e, r.kid), console.log("[Firebase JWT] \u2705 Token verified successfully"), a;
  } catch (t) {
    throw console.error("[Firebase JWT] \u274C Verification failed:", t), t;
  }
}
__name(Ar, "Ar");
__name2(Ar, "Ar");
async function Or() {
  const e = Date.now();
  if (is && is.expires > e) return is.keys;
  const s = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!s.ok) throw new Error("Failed to fetch public keys");
  const t = await s.json(), a = (s.headers.get("cache-control") || "").match(/max-age=(\d+)/), n = a ? parseInt(a[1]) : 3600;
  return is = { keys: Object.entries(t).map(([o, i]) => ({ kid: o, cert: i })), expires: e + n * 1e3 }, is.keys;
}
__name(Or, "Or");
__name2(Or, "Or");
async function Fo(e, s) {
  if (!(await Or()).find((a) => a.kid === s)) throw new Error(`Public key not found for kid: ${s}`);
  console.log("[Firebase JWT] Public key found for kid:", s);
}
__name(Fo, "Fo");
__name2(Fo, "Fo");
var Po = { verifyFirebaseIdToken: Ar, getPublicKeys: Or };
var Uo = Object.freeze(Object.defineProperty({ __proto__: null, default: Po, verifyFirebaseIdToken: Ar }, Symbol.toStringTag, { value: "Module" }));
async function Dr(e) {
  try {
    const { to: s, subject: t, htmlContent: r, textContent: a } = e, n = await fetch("https://api.mailchannels.net/tx/v1/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: s }] }], from: { email: "noreply@live.ur-team.com", name: "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158" }, subject: t, content: [{ type: "text/html", value: r }, ...a ? [{ type: "text/plain", value: a }] : []] }) });
    if (!n.ok) {
      const o = await n.text();
      return console.error("[Email] Failed to send:", n.status, o), { success: false, error: `Email send failed: ${n.status}` };
    }
    return console.log("[Email] Successfully sent to:", s), { success: true };
  } catch (s) {
    return console.error("[Email] Exception:", s), { success: false, error: s.message };
  }
}
__name(Dr, "Dr");
__name2(Dr, "Dr");
async function xo(e) {
  const { streamId: s, title: t, sellerName: r, platform: a, scheduledAt: n, status: o } = e, i = `https://live.ur-team.com/live/${s}`, c = o === "live" ? "\u{1F534} \uB77C\uC774\uBE0C \uC911" : o === "scheduled" ? "\u{1F4C5} \uC608\uC57D\uB428" : "\u23F8\uFE0F \uB300\uAE30 \uC911", l = `
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
  `, u = `
\u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131!

\uC0C1\uD0DC: ${c}
\uC81C\uBAA9: ${t}
\uD310\uB9E4\uC790: ${r}
\uD50C\uB7AB\uD3FC: ${a === "youtube" ? "YouTube" : "TikTok"}
${n ? `\uC608\uC57D \uC2DC\uAC04: ${new Date(n).toLocaleString("ko-KR")}` : ""}
\uB77C\uC774\uBE0C ID: #${s}

\u{1F517} \uB77C\uC774\uBE0C \uD398\uC774\uC9C0: ${i}

---
\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158
\uBD80\uC0B0\uAD11\uC5ED\uC2DC \uAE08\uC815\uAD6C \uB180\uC774\uB9C8\uB2F9\uB85C26 1402
\uB300\uD45C\uC804\uD654: 0507-0177-0432 | \uC774\uBA54\uC77C: jiwon@ur-team.com
  `;
  return Dr({ to: "jiwon@ur-team.com", subject: `[\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158] \u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131: ${t}`, htmlContent: l, textContent: u });
}
__name(xo, "xo");
__name2(xo, "xo");
var Wo = Object.freeze(Object.defineProperty({ __proto__: null, sendEmail: Dr, sendLiveStreamCreatedEmail: xo }, Symbol.toStringTag, { value: "Module" }));
async function qo(e, s, t) {
  const r = e.from || t || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <onboarding@resend.dev>", { to: a, subject: n, html: o } = e;
  if (!s) return console.warn("[Email] RESEND_API_KEY not configured, skipping email"), { success: false, error: "API key not configured" };
  try {
    console.log("[Email] Sending email:", { to: a, subject: n, from: r });
    const i = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${s}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: r, to: a, subject: n, html: o }) }), c = await i.json();
    return i.ok ? (console.log("[Email] Sent successfully:", { to: a, subject: n, id: c.id }), { success: true }) : (console.error("[Email] Failed to send:", c), { success: false, error: c.message || "Failed to send email" });
  } catch (i) {
    return console.error("[Email] Error:", i), { success: false, error: i.message };
  }
}
__name(qo, "qo");
__name2(qo, "qo");
function Ho(e, s) {
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
__name(Ho, "Ho");
__name2(Ho, "Ho");
function Ko(e, s) {
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
__name(Ko, "Ko");
__name2(Ko, "Ko");
var kr = Object.freeze(Object.defineProperty({ __proto__: null, getSellerApprovalEmailHTML: Ho, getSellerRejectionEmailHTML: Ko, sendEmail: qo }, Symbol.toStringTag, { value: "Module" }));
async function Bo(e, s) {
  const { userId: t, type: r, title: a, message: n, linkUrl: o } = s;
  try {
    const i = await e.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(t, r, a, n, o || null).run();
    return console.log(`[Notification] Created for user ${t}: ${r} - ${a}`), { success: true, id: i.meta.last_row_id };
  } catch (i) {
    return console.error("[Notification] Failed to create:", i), { success: false, error: i.message };
  }
}
__name(Bo, "Bo");
__name2(Bo, "Bo");
var Jo = { seller_approved: /* @__PURE__ */ __name2((e) => ({ title: "\u{1F389} \uD310\uB9E4\uC790 \uC2B9\uC778 \uC644\uB8CC", message: `${e}\uB2D8, \uCD95\uD558\uD569\uB2C8\uB2E4! \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790\uB85C \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller" }), "seller_approved"), seller_rejected: /* @__PURE__ */ __name2((e) => ({ title: "\uD310\uB9E4\uC790 \uC2B9\uC778 \uAC70\uBD80", message: `\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uD310\uB9E4\uC790 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0AC\uC720: ${e}`, linkUrl: "/seller/register" }), "seller_rejected"), order_complete: /* @__PURE__ */ __name2((e) => ({ title: "\uC8FC\uBB38 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_complete"), order_shipped: /* @__PURE__ */ __name2((e) => ({ title: "\uBC30\uC1A1 \uC2DC\uC791", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC0C1\uD488\uC774 \uBC30\uC1A1 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_shipped"), order_delivered: /* @__PURE__ */ __name2((e) => ({ title: "\uBC30\uC1A1 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC0C1\uD488\uC774 \uBC30\uC1A1 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_delivered"), refund_requested: /* @__PURE__ */ __name2((e) => ({ title: "\uD658\uBD88 \uC694\uCCAD \uC811\uC218", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uD658\uBD88\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "refund_requested"), refund_complete: /* @__PURE__ */ __name2((e, s) => ({ title: "\uD658\uBD88 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uD658\uBD88(\u20A9${s.toLocaleString()})\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "refund_complete"), product_low_stock: /* @__PURE__ */ __name2((e, s) => ({ title: "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", message: `${e}\uC758 \uC7AC\uACE0\uAC00 ${s}\uAC1C \uB0A8\uC558\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller/products" }), "product_low_stock"), product_sold_out: /* @__PURE__ */ __name2((e) => ({ title: "\u274C \uD488\uC808 \uC54C\uB9BC", message: `${e}\uC774(\uAC00) \uD488\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller/products" }), "product_sold_out") };
var Cr = Object.freeze(Object.defineProperty({ __proto__: null, NotificationTemplates: Jo, createNotification: Bo }, Symbol.toStringTag, { value: "Module" }));
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
var middleware_insertion_facade_default = Ct;
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

// .wrangler/tmp/pages-xDBVZE/wimpt7u1xv.js
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

// .wrangler/tmp/bundle-rA2EK5/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-rA2EK5/middleware-loader.entry.ts
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
//# sourceMappingURL=wimpt7u1xv.js.map
