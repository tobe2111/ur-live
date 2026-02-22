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
var isWorkerdProcessV2 = globalThis.Cloudflare.compatibilityFlags.enable_nodejs_process_v2;
var unenvProcess = new Process({
  env: globalProcess.env,
  // `hrtime` is only available from workerd process v2
  hrtime: isWorkerdProcessV2 ? workerdProcess.hrtime : hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  // Always implemented by workerd
  env,
  // Only implemented in workerd v2
  hrtime: hrtime3,
  // Always implemented by workerd
  nextTick
} = unenvProcess;
var {
  _channel,
  _disconnect,
  _events,
  _eventsCount,
  _handleQueue,
  _maxListeners,
  _pendingMessage,
  _send,
  assert,
  disconnect,
  mainModule
} = unenvProcess;
var {
  // @ts-expect-error `_debugEnd` is missing typings
  _debugEnd,
  // @ts-expect-error `_debugProcess` is missing typings
  _debugProcess,
  // @ts-expect-error `_exiting` is missing typings
  _exiting,
  // @ts-expect-error `_fatalException` is missing typings
  _fatalException,
  // @ts-expect-error `_getActiveHandles` is missing typings
  _getActiveHandles,
  // @ts-expect-error `_getActiveRequests` is missing typings
  _getActiveRequests,
  // @ts-expect-error `_kill` is missing typings
  _kill,
  // @ts-expect-error `_linkedBinding` is missing typings
  _linkedBinding,
  // @ts-expect-error `_preload_modules` is missing typings
  _preload_modules,
  // @ts-expect-error `_rawDebug` is missing typings
  _rawDebug,
  // @ts-expect-error `_startProfilerIdleNotifier` is missing typings
  _startProfilerIdleNotifier,
  // @ts-expect-error `_stopProfilerIdleNotifier` is missing typings
  _stopProfilerIdleNotifier,
  // @ts-expect-error `_tickCallback` is missing typings
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  availableMemory,
  // @ts-expect-error `binding` is missing typings
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  // @ts-expect-error `domain` is missing typings
  domain,
  emit,
  emitWarning,
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
  // @ts-expect-error `initgroups` is missing typings
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  memoryUsage,
  // @ts-expect-error `moduleLoadList` is missing typings
  moduleLoadList,
  off,
  on,
  once,
  // @ts-expect-error `openStdin` is missing typings
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  // @ts-expect-error `reallyExit` is missing typings
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
} = isWorkerdProcessV2 ? workerdProcess : unenvProcess;
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

// .wrangler/tmp/pages-SFInw5/bundledWorker-0.008060468254985631.mjs
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
var isWorkerdProcessV22 = globalThis.Cloudflare.compatibilityFlags.enable_nodejs_process_v2;
var unenvProcess2 = new Process2({
  env: globalProcess2.env,
  // `hrtime` is only available from workerd process v2
  hrtime: isWorkerdProcessV22 ? workerdProcess2.hrtime : hrtime4,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess2.nextTick
});
var { exit: exit2, features: features2, platform: platform2 } = workerdProcess2;
var {
  // Always implemented by workerd
  env: env2,
  // Only implemented in workerd v2
  hrtime: hrtime32,
  // Always implemented by workerd
  nextTick: nextTick2
} = unenvProcess2;
var {
  _channel: _channel2,
  _disconnect: _disconnect2,
  _events: _events2,
  _eventsCount: _eventsCount2,
  _handleQueue: _handleQueue2,
  _maxListeners: _maxListeners2,
  _pendingMessage: _pendingMessage2,
  _send: _send2,
  assert: assert22,
  disconnect: disconnect2,
  mainModule: mainModule2
} = unenvProcess2;
var {
  // @ts-expect-error `_debugEnd` is missing typings
  _debugEnd: _debugEnd2,
  // @ts-expect-error `_debugProcess` is missing typings
  _debugProcess: _debugProcess2,
  // @ts-expect-error `_exiting` is missing typings
  _exiting: _exiting2,
  // @ts-expect-error `_fatalException` is missing typings
  _fatalException: _fatalException2,
  // @ts-expect-error `_getActiveHandles` is missing typings
  _getActiveHandles: _getActiveHandles2,
  // @ts-expect-error `_getActiveRequests` is missing typings
  _getActiveRequests: _getActiveRequests2,
  // @ts-expect-error `_kill` is missing typings
  _kill: _kill2,
  // @ts-expect-error `_linkedBinding` is missing typings
  _linkedBinding: _linkedBinding2,
  // @ts-expect-error `_preload_modules` is missing typings
  _preload_modules: _preload_modules2,
  // @ts-expect-error `_rawDebug` is missing typings
  _rawDebug: _rawDebug2,
  // @ts-expect-error `_startProfilerIdleNotifier` is missing typings
  _startProfilerIdleNotifier: _startProfilerIdleNotifier2,
  // @ts-expect-error `_stopProfilerIdleNotifier` is missing typings
  _stopProfilerIdleNotifier: _stopProfilerIdleNotifier2,
  // @ts-expect-error `_tickCallback` is missing typings
  _tickCallback: _tickCallback2,
  abort: abort2,
  addListener: addListener2,
  allowedNodeEnvironmentFlags: allowedNodeEnvironmentFlags2,
  arch: arch2,
  argv: argv2,
  argv0: argv02,
  availableMemory: availableMemory2,
  // @ts-expect-error `binding` is missing typings
  binding: binding2,
  channel: channel2,
  chdir: chdir2,
  config: config2,
  connected: connected2,
  constrainedMemory: constrainedMemory2,
  cpuUsage: cpuUsage2,
  cwd: cwd2,
  debugPort: debugPort2,
  dlopen: dlopen2,
  // @ts-expect-error `domain` is missing typings
  domain: domain2,
  emit: emit2,
  emitWarning: emitWarning2,
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
  // @ts-expect-error `initgroups` is missing typings
  initgroups: initgroups2,
  kill: kill2,
  listenerCount: listenerCount2,
  listeners: listeners2,
  loadEnvFile: loadEnvFile2,
  memoryUsage: memoryUsage2,
  // @ts-expect-error `moduleLoadList` is missing typings
  moduleLoadList: moduleLoadList2,
  off: off2,
  on: on2,
  once: once2,
  // @ts-expect-error `openStdin` is missing typings
  openStdin: openStdin2,
  permission: permission2,
  pid: pid2,
  ppid: ppid2,
  prependListener: prependListener2,
  prependOnceListener: prependOnceListener2,
  rawListeners: rawListeners2,
  // @ts-expect-error `reallyExit` is missing typings
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
} = isWorkerdProcessV22 ? workerdProcess2 : unenvProcess2;
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
var Zs = Object.defineProperty;
var ps = /* @__PURE__ */ __name2((e) => {
  throw TypeError(e);
}, "ps");
var er = /* @__PURE__ */ __name2((e, t, s) => t in e ? Zs(e, t, { enumerable: true, configurable: true, writable: true, value: s }) : e[t] = s, "er");
var R = /* @__PURE__ */ __name2((e, t, s) => er(e, typeof t != "symbol" ? t + "" : t, s), "R");
var es = /* @__PURE__ */ __name2((e, t, s) => t.has(e) || ps("Cannot " + s), "es");
var m = /* @__PURE__ */ __name2((e, t, s) => (es(e, t, "read from private field"), s ? s.call(e) : t.get(e)), "m");
var v = /* @__PURE__ */ __name2((e, t, s) => t.has(e) ? ps("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, s), "v");
var S = /* @__PURE__ */ __name2((e, t, s, r) => (es(e, t, "write to private field"), r ? r.call(e, s) : t.set(e, s), s), "S");
var j = /* @__PURE__ */ __name2((e, t, s) => (es(e, t, "access private method"), s), "j");
var ms = /* @__PURE__ */ __name2((e, t, s, r) => ({ set _(a) {
  S(e, t, a, s);
}, get _() {
  return m(e, t, r);
} }), "ms");
var _s = /* @__PURE__ */ __name2((e, t, s) => (r, a) => {
  let n = -1;
  return o(0);
  async function o(i) {
    if (i <= n) throw new Error("next() called multiple times");
    n = i;
    let c, u = false, l;
    if (e[i] ? (l = e[i][0][0], r.req.routeIndex = i) : l = i === e.length && a || void 0, l) try {
      c = await l(r, () => o(i + 1));
    } catch (p) {
      if (p instanceof Error && t) r.error = p, c = await t(p, r), u = true;
      else throw p;
    }
    else r.finalized === false && s && (c = await s(r));
    return c && (r.finalized === false || u) && (r.res = c), r;
  }
  __name(o, "o");
  __name2(o, "o");
}, "_s");
var sr = Symbol();
var rr = /* @__PURE__ */ __name2(async (e, t = /* @__PURE__ */ Object.create(null)) => {
  const { all: s = false, dot: r = false } = t, n = (e instanceof Ds ? e.raw.headers : e.headers).get("Content-Type");
  return n != null && n.startsWith("multipart/form-data") || n != null && n.startsWith("application/x-www-form-urlencoded") ? tr(e, { all: s, dot: r }) : {};
}, "rr");
async function tr(e, t) {
  const s = await e.formData();
  return s ? ar(s, t) : {};
}
__name(tr, "tr");
__name2(tr, "tr");
function ar(e, t) {
  const s = /* @__PURE__ */ Object.create(null);
  return e.forEach((r, a) => {
    t.all || a.endsWith("[]") ? nr(s, a, r) : s[a] = r;
  }), t.dot && Object.entries(s).forEach(([r, a]) => {
    r.includes(".") && (or(s, r, a), delete s[r]);
  }), s;
}
__name(ar, "ar");
__name2(ar, "ar");
var nr = /* @__PURE__ */ __name2((e, t, s) => {
  e[t] !== void 0 ? Array.isArray(e[t]) ? e[t].push(s) : e[t] = [e[t], s] : t.endsWith("[]") ? e[t] = [s] : e[t] = s;
}, "nr");
var or = /* @__PURE__ */ __name2((e, t, s) => {
  let r = e;
  const a = t.split(".");
  a.forEach((n, o) => {
    o === a.length - 1 ? r[n] = s : ((!r[n] || typeof r[n] != "object" || Array.isArray(r[n]) || r[n] instanceof File) && (r[n] = /* @__PURE__ */ Object.create(null)), r = r[n]);
  });
}, "or");
var Rs = /* @__PURE__ */ __name2((e) => {
  const t = e.split("/");
  return t[0] === "" && t.shift(), t;
}, "Rs");
var ir = /* @__PURE__ */ __name2((e) => {
  const { groups: t, path: s } = cr(e), r = Rs(s);
  return ur(r, t);
}, "ir");
var cr = /* @__PURE__ */ __name2((e) => {
  const t = [];
  return e = e.replace(/\{[^}]+\}/g, (s, r) => {
    const a = `@${r}`;
    return t.push([a, s]), a;
  }), { groups: t, path: e };
}, "cr");
var ur = /* @__PURE__ */ __name2((e, t) => {
  for (let s = t.length - 1; s >= 0; s--) {
    const [r] = t[s];
    for (let a = e.length - 1; a >= 0; a--) if (e[a].includes(r)) {
      e[a] = e[a].replace(r, t[s][1]);
      break;
    }
  }
  return e;
}, "ur");
var We = {};
var lr = /* @__PURE__ */ __name2((e, t) => {
  if (e === "*") return "*";
  const s = e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (s) {
    const r = `${e}#${t}`;
    return We[r] || (s[2] ? We[r] = t && t[0] !== ":" && t[0] !== "*" ? [r, s[1], new RegExp(`^${s[2]}(?=/${t})`)] : [e, s[1], new RegExp(`^${s[2]}$`)] : We[r] = [e, s[1], true]), We[r];
  }
  return null;
}, "lr");
var ns = /* @__PURE__ */ __name2((e, t) => {
  try {
    return t(e);
  } catch {
    return e.replace(/(?:%[0-9A-Fa-f]{2})+/g, (s) => {
      try {
        return t(s);
      } catch {
        return s;
      }
    });
  }
}, "ns");
var dr = /* @__PURE__ */ __name2((e) => ns(e, decodeURI), "dr");
var Is = /* @__PURE__ */ __name2((e) => {
  const t = e.url, s = t.indexOf("/", t.indexOf(":") + 4);
  let r = s;
  for (; r < t.length; r++) {
    const a = t.charCodeAt(r);
    if (a === 37) {
      const n = t.indexOf("?", r), o = t.slice(s, n === -1 ? void 0 : n);
      return dr(o.includes("%25") ? o.replace(/%25/g, "%2525") : o);
    } else if (a === 63) break;
  }
  return t.slice(s, r);
}, "Is");
var pr = /* @__PURE__ */ __name2((e) => {
  const t = Is(e);
  return t.length > 1 && t.at(-1) === "/" ? t.slice(0, -1) : t;
}, "pr");
var be = /* @__PURE__ */ __name2((e, t, ...s) => (s.length && (t = be(t, ...s)), `${(e == null ? void 0 : e[0]) === "/" ? "" : "/"}${e}${t === "/" ? "" : `${(e == null ? void 0 : e.at(-1)) === "/" ? "" : "/"}${(t == null ? void 0 : t[0]) === "/" ? t.slice(1) : t}`}`), "be");
var vs = /* @__PURE__ */ __name2((e) => {
  if (e.charCodeAt(e.length - 1) !== 63 || !e.includes(":")) return null;
  const t = e.split("/"), s = [];
  let r = "";
  return t.forEach((a) => {
    if (a !== "" && !/\:/.test(a)) r += "/" + a;
    else if (/\:/.test(a)) if (/\?/.test(a)) {
      s.length === 0 && r === "" ? s.push("/") : s.push(r);
      const n = a.replace("?", "");
      r += "/" + n, s.push(r);
    } else r += "/" + a;
  }), s.filter((a, n, o) => o.indexOf(a) === n);
}, "vs");
var ss = /* @__PURE__ */ __name2((e) => /[%+]/.test(e) ? (e.indexOf("+") !== -1 && (e = e.replace(/\+/g, " ")), e.indexOf("%") !== -1 ? ns(e, js) : e) : e, "ss");
var Os = /* @__PURE__ */ __name2((e, t, s) => {
  let r;
  if (!s && t && !/[%+]/.test(t)) {
    let o = e.indexOf("?", 8);
    if (o === -1) return;
    for (e.startsWith(t, o + 1) || (o = e.indexOf(`&${t}`, o + 1)); o !== -1; ) {
      const i = e.charCodeAt(o + t.length + 1);
      if (i === 61) {
        const c = o + t.length + 2, u = e.indexOf("&", c);
        return ss(e.slice(c, u === -1 ? void 0 : u));
      } else if (i == 38 || isNaN(i)) return "";
      o = e.indexOf(`&${t}`, o + 1);
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
    if (r && (c = ss(c)), n = o, c === "") continue;
    let u;
    i === -1 ? u = "" : (u = e.slice(i + 1, o === -1 ? void 0 : o), r && (u = ss(u))), s ? (a[c] && Array.isArray(a[c]) || (a[c] = []), a[c].push(u)) : a[c] ?? (a[c] = u);
  }
  return t ? a[t] : a;
}, "Os");
var mr = Os;
var _r = /* @__PURE__ */ __name2((e, t) => Os(e, t, true), "_r");
var js = decodeURIComponent;
var Es = /* @__PURE__ */ __name2((e) => ns(e, js), "Es");
var Re;
var K;
var ae;
var ks;
var Ns;
var as;
var ne;
var gs;
var Ds = (gs = class {
  static {
    __name(this, "gs");
  }
  static {
    __name2(this, "gs");
  }
  constructor(e, t = "/", s = [[]]) {
    v(this, ae);
    R(this, "raw");
    v(this, Re);
    v(this, K);
    R(this, "routeIndex", 0);
    R(this, "path");
    R(this, "bodyCache", {});
    v(this, ne, (e2) => {
      const { bodyCache: t2, raw: s2 } = this, r = t2[e2];
      if (r) return r;
      const a = Object.keys(t2)[0];
      return a ? t2[a].then((n) => (a === "json" && (n = JSON.stringify(n)), new Response(n)[e2]())) : t2[e2] = s2[e2]();
    });
    this.raw = e, this.path = t, S(this, K, s), S(this, Re, {});
  }
  param(e) {
    return e ? j(this, ae, ks).call(this, e) : j(this, ae, Ns).call(this);
  }
  query(e) {
    return mr(this.url, e);
  }
  queries(e) {
    return _r(this.url, e);
  }
  header(e) {
    if (e) return this.raw.headers.get(e) ?? void 0;
    const t = {};
    return this.raw.headers.forEach((s, r) => {
      t[r] = s;
    }), t;
  }
  async parseBody(e) {
    var t;
    return (t = this.bodyCache).parsedBody ?? (t.parsedBody = await rr(this, e));
  }
  json() {
    return m(this, ne).call(this, "text").then((e) => JSON.parse(e));
  }
  text() {
    return m(this, ne).call(this, "text");
  }
  arrayBuffer() {
    return m(this, ne).call(this, "arrayBuffer");
  }
  blob() {
    return m(this, ne).call(this, "blob");
  }
  formData() {
    return m(this, ne).call(this, "formData");
  }
  addValidatedData(e, t) {
    m(this, Re)[e] = t;
  }
  valid(e) {
    return m(this, Re)[e];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [sr]() {
    return m(this, K);
  }
  get matchedRoutes() {
    return m(this, K)[0].map(([[, e]]) => e);
  }
  get routePath() {
    return m(this, K)[0].map(([[, e]]) => e)[this.routeIndex].path;
  }
}, Re = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakMap(), ae = /* @__PURE__ */ new WeakSet(), ks = /* @__PURE__ */ __name2(function(e) {
  const t = m(this, K)[0][this.routeIndex][1][e], s = j(this, ae, as).call(this, t);
  return s && /\%/.test(s) ? Es(s) : s;
}, "ks"), Ns = /* @__PURE__ */ __name2(function() {
  const e = {}, t = Object.keys(m(this, K)[0][this.routeIndex][1]);
  for (const s of t) {
    const r = j(this, ae, as).call(this, m(this, K)[0][this.routeIndex][1][s]);
    r !== void 0 && (e[s] = /\%/.test(r) ? Es(r) : r);
  }
  return e;
}, "Ns"), as = /* @__PURE__ */ __name2(function(e) {
  return m(this, K)[1] ? m(this, K)[1][e] : e;
}, "as"), ne = /* @__PURE__ */ new WeakMap(), gs);
var Er = { Stringify: 1 };
var As = /* @__PURE__ */ __name2(async (e, t, s, r, a) => {
  typeof e == "object" && !(e instanceof String) && (e instanceof Promise || (e = e.toString()), e instanceof Promise && (e = await e));
  const n = e.callbacks;
  return n != null && n.length ? (a ? a[0] += e : a = [e], Promise.all(n.map((i) => i({ phase: t, buffer: a, context: r }))).then((i) => Promise.all(i.filter(Boolean).map((c) => As(c, t, false, r, a))).then(() => a[0]))) : Promise.resolve(e);
}, "As");
var fr = "text/plain; charset=UTF-8";
var rs = /* @__PURE__ */ __name2((e, t) => ({ "Content-Type": e, ...t }), "rs");
var Pe;
var He;
var ee;
var Ie;
var se;
var W;
var xe;
var ve;
var Oe;
var _e;
var Fe;
var qe;
var oe;
var Te;
var ys;
var hr = (ys = class {
  static {
    __name(this, "ys");
  }
  static {
    __name2(this, "ys");
  }
  constructor(e, t) {
    v(this, oe);
    v(this, Pe);
    v(this, He);
    R(this, "env", {});
    v(this, ee);
    R(this, "finalized", false);
    R(this, "error");
    v(this, Ie);
    v(this, se);
    v(this, W);
    v(this, xe);
    v(this, ve);
    v(this, Oe);
    v(this, _e);
    v(this, Fe);
    v(this, qe);
    R(this, "render", (...e2) => (m(this, ve) ?? S(this, ve, (t2) => this.html(t2)), m(this, ve).call(this, ...e2)));
    R(this, "setLayout", (e2) => S(this, xe, e2));
    R(this, "getLayout", () => m(this, xe));
    R(this, "setRenderer", (e2) => {
      S(this, ve, e2);
    });
    R(this, "header", (e2, t2, s) => {
      this.finalized && S(this, W, new Response(m(this, W).body, m(this, W)));
      const r = m(this, W) ? m(this, W).headers : m(this, _e) ?? S(this, _e, new Headers());
      t2 === void 0 ? r.delete(e2) : s != null && s.append ? r.append(e2, t2) : r.set(e2, t2);
    });
    R(this, "status", (e2) => {
      S(this, Ie, e2);
    });
    R(this, "set", (e2, t2) => {
      m(this, ee) ?? S(this, ee, /* @__PURE__ */ new Map()), m(this, ee).set(e2, t2);
    });
    R(this, "get", (e2) => m(this, ee) ? m(this, ee).get(e2) : void 0);
    R(this, "newResponse", (...e2) => j(this, oe, Te).call(this, ...e2));
    R(this, "body", (e2, t2, s) => j(this, oe, Te).call(this, e2, t2, s));
    R(this, "text", (e2, t2, s) => !m(this, _e) && !m(this, Ie) && !t2 && !s && !this.finalized ? new Response(e2) : j(this, oe, Te).call(this, e2, t2, rs(fr, s)));
    R(this, "json", (e2, t2, s) => j(this, oe, Te).call(this, JSON.stringify(e2), t2, rs("application/json", s)));
    R(this, "html", (e2, t2, s) => {
      const r = /* @__PURE__ */ __name2((a) => j(this, oe, Te).call(this, a, t2, rs("text/html; charset=UTF-8", s)), "r");
      return typeof e2 == "object" ? As(e2, Er.Stringify, false, {}).then(r) : r(e2);
    });
    R(this, "redirect", (e2, t2) => {
      const s = String(e2);
      return this.header("Location", /[^\x00-\xFF]/.test(s) ? encodeURI(s) : s), this.newResponse(null, t2 ?? 302);
    });
    R(this, "notFound", () => (m(this, Oe) ?? S(this, Oe, () => new Response()), m(this, Oe).call(this, this)));
    S(this, Pe, e), t && (S(this, se, t.executionCtx), this.env = t.env, S(this, Oe, t.notFoundHandler), S(this, qe, t.path), S(this, Fe, t.matchResult));
  }
  get req() {
    return m(this, He) ?? S(this, He, new Ds(m(this, Pe), m(this, qe), m(this, Fe))), m(this, He);
  }
  get event() {
    if (m(this, se) && "respondWith" in m(this, se)) return m(this, se);
    throw Error("This context has no FetchEvent");
  }
  get executionCtx() {
    if (m(this, se)) return m(this, se);
    throw Error("This context has no ExecutionContext");
  }
  get res() {
    return m(this, W) || S(this, W, new Response(null, { headers: m(this, _e) ?? S(this, _e, new Headers()) }));
  }
  set res(e) {
    if (m(this, W) && e) {
      e = new Response(e.body, e);
      for (const [t, s] of m(this, W).headers.entries()) if (t !== "content-type") if (t === "set-cookie") {
        const r = m(this, W).headers.getSetCookie();
        e.headers.delete("set-cookie");
        for (const a of r) e.headers.append("set-cookie", a);
      } else e.headers.set(t, s);
    }
    S(this, W, e), this.finalized = true;
  }
  get var() {
    return m(this, ee) ? Object.fromEntries(m(this, ee)) : {};
  }
}, Pe = /* @__PURE__ */ new WeakMap(), He = /* @__PURE__ */ new WeakMap(), ee = /* @__PURE__ */ new WeakMap(), Ie = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), W = /* @__PURE__ */ new WeakMap(), xe = /* @__PURE__ */ new WeakMap(), ve = /* @__PURE__ */ new WeakMap(), Oe = /* @__PURE__ */ new WeakMap(), _e = /* @__PURE__ */ new WeakMap(), Fe = /* @__PURE__ */ new WeakMap(), qe = /* @__PURE__ */ new WeakMap(), oe = /* @__PURE__ */ new WeakSet(), Te = /* @__PURE__ */ __name2(function(e, t, s) {
  const r = m(this, W) ? new Headers(m(this, W).headers) : m(this, _e) ?? new Headers();
  if (typeof t == "object" && "headers" in t) {
    const n = t.headers instanceof Headers ? t.headers : new Headers(t.headers);
    for (const [o, i] of n) o.toLowerCase() === "set-cookie" ? r.append(o, i) : r.set(o, i);
  }
  if (s) for (const [n, o] of Object.entries(s)) if (typeof o == "string") r.set(n, o);
  else {
    r.delete(n);
    for (const i of o) r.append(n, i);
  }
  const a = typeof t == "number" ? t : (t == null ? void 0 : t.status) ?? m(this, Ie);
  return new Response(e, { status: a, headers: r });
}, "Te"), ys);
var U = "ALL";
var gr = "all";
var yr = ["get", "post", "put", "delete", "options", "patch"];
var Cs = "Can not add a route since the matcher is already built.";
var Ls = class extends Error {
  static {
    __name(this, "Ls");
  }
  static {
    __name2(this, "Ls");
  }
};
var wr = "__COMPOSED_HANDLER";
var br = /* @__PURE__ */ __name2((e) => e.text("404 Not Found", 404), "br");
var fs = /* @__PURE__ */ __name2((e, t) => {
  if ("getResponse" in e) {
    const s = e.getResponse();
    return t.newResponse(s.body, s);
  }
  return console.error(e), t.text("Internal Server Error", 500);
}, "fs");
var V;
var P;
var Ms;
var J;
var pe;
var Ke;
var Ye;
var je;
var Tr = (je = class {
  static {
    __name(this, "je");
  }
  static {
    __name2(this, "je");
  }
  constructor(t = {}) {
    v(this, P);
    R(this, "get");
    R(this, "post");
    R(this, "put");
    R(this, "delete");
    R(this, "options");
    R(this, "patch");
    R(this, "all");
    R(this, "on");
    R(this, "use");
    R(this, "router");
    R(this, "getPath");
    R(this, "_basePath", "/");
    v(this, V, "/");
    R(this, "routes", []);
    v(this, J, br);
    R(this, "errorHandler", fs);
    R(this, "onError", (t2) => (this.errorHandler = t2, this));
    R(this, "notFound", (t2) => (S(this, J, t2), this));
    R(this, "fetch", (t2, ...s) => j(this, P, Ye).call(this, t2, s[1], s[0], t2.method));
    R(this, "request", (t2, s, r2, a2) => t2 instanceof Request ? this.fetch(s ? new Request(t2, s) : t2, r2, a2) : (t2 = t2.toString(), this.fetch(new Request(/^https?:\/\//.test(t2) ? t2 : `http://localhost${be("/", t2)}`, s), r2, a2)));
    R(this, "fire", () => {
      addEventListener("fetch", (t2) => {
        t2.respondWith(j(this, P, Ye).call(this, t2.request, t2, void 0, t2.request.method));
      });
    });
    [...yr, gr].forEach((n) => {
      this[n] = (o, ...i) => (typeof o == "string" ? S(this, V, o) : j(this, P, pe).call(this, n, m(this, V), o), i.forEach((c) => {
        j(this, P, pe).call(this, n, m(this, V), c);
      }), this);
    }), this.on = (n, o, ...i) => {
      for (const c of [o].flat()) {
        S(this, V, c);
        for (const u of [n].flat()) i.map((l) => {
          j(this, P, pe).call(this, u.toUpperCase(), m(this, V), l);
        });
      }
      return this;
    }, this.use = (n, ...o) => (typeof n == "string" ? S(this, V, n) : (S(this, V, "*"), o.unshift(n)), o.forEach((i) => {
      j(this, P, pe).call(this, U, m(this, V), i);
    }), this);
    const { strict: r, ...a } = t;
    Object.assign(this, a), this.getPath = r ?? true ? t.getPath ?? Is : pr;
  }
  route(t, s) {
    const r = this.basePath(t);
    return s.routes.map((a) => {
      var o;
      let n;
      s.errorHandler === fs ? n = a.handler : (n = /* @__PURE__ */ __name2(async (i, c) => (await _s([], s.errorHandler)(i, () => a.handler(i, c))).res, "n"), n[wr] = a.handler), j(o = r, P, pe).call(o, a.method, a.path, n);
    }), this;
  }
  basePath(t) {
    const s = j(this, P, Ms).call(this);
    return s._basePath = be(this._basePath, t), s;
  }
  mount(t, s, r) {
    let a, n;
    r && (typeof r == "function" ? n = r : (n = r.optionHandler, r.replaceRequest === false ? a = /* @__PURE__ */ __name2((c) => c, "a") : a = r.replaceRequest));
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
      const c = be(this._basePath, t), u = c === "/" ? 0 : c.length;
      return (l) => {
        const p = new URL(l.url);
        return p.pathname = p.pathname.slice(u) || "/", new Request(p, l);
      };
    })());
    const i = /* @__PURE__ */ __name2(async (c, u) => {
      const l = await s(a(c.req.raw), ...o(c));
      if (l) return l;
      await u();
    }, "i");
    return j(this, P, pe).call(this, U, be(t, "*"), i), this;
  }
}, V = /* @__PURE__ */ new WeakMap(), P = /* @__PURE__ */ new WeakSet(), Ms = /* @__PURE__ */ __name2(function() {
  const t = new je({ router: this.router, getPath: this.getPath });
  return t.errorHandler = this.errorHandler, S(t, J, m(this, J)), t.routes = this.routes, t;
}, "Ms"), J = /* @__PURE__ */ new WeakMap(), pe = /* @__PURE__ */ __name2(function(t, s, r) {
  t = t.toUpperCase(), s = be(this._basePath, s);
  const a = { basePath: this._basePath, path: s, method: t, handler: r };
  this.router.add(t, s, [r, a]), this.routes.push(a);
}, "pe"), Ke = /* @__PURE__ */ __name2(function(t, s) {
  if (t instanceof Error) return this.errorHandler(t, s);
  throw t;
}, "Ke"), Ye = /* @__PURE__ */ __name2(function(t, s, r, a) {
  if (a === "HEAD") return (async () => new Response(null, await j(this, P, Ye).call(this, t, s, r, "GET")))();
  const n = this.getPath(t, { env: r }), o = this.router.match(a, n), i = new hr(t, { path: n, matchResult: o, env: r, executionCtx: s, notFoundHandler: m(this, J) });
  if (o[0].length === 1) {
    let u;
    try {
      u = o[0][0][0][0](i, async () => {
        i.res = await m(this, J).call(this, i);
      });
    } catch (l) {
      return j(this, P, Ke).call(this, l, i);
    }
    return u instanceof Promise ? u.then((l) => l || (i.finalized ? i.res : m(this, J).call(this, i))).catch((l) => j(this, P, Ke).call(this, l, i)) : u ?? m(this, J).call(this, i);
  }
  const c = _s(o[0], this.errorHandler, m(this, J));
  return (async () => {
    try {
      const u = await c(i);
      if (!u.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
      return u.res;
    } catch (u) {
      return j(this, P, Ke).call(this, u, i);
    }
  })();
}, "Ye"), je);
var Us = [];
function Sr(e, t) {
  const s = this.buildAllMatchers(), r = /* @__PURE__ */ __name2(((a, n) => {
    const o = s[a] || s[U], i = o[2][n];
    if (i) return i;
    const c = n.match(o[0]);
    if (!c) return [[], Us];
    const u = c.indexOf("", 1);
    return [o[1][u], c];
  }), "r");
  return this.match = r, r(e, t);
}
__name(Sr, "Sr");
__name2(Sr, "Sr");
var Je = "[^/]+";
var Me = ".*";
var Ue = "(?:|/.*)";
var Se = Symbol();
var Rr = new Set(".\\+*[^]$()");
function Ir(e, t) {
  return e.length === 1 ? t.length === 1 ? e < t ? -1 : 1 : -1 : t.length === 1 || e === Me || e === Ue ? 1 : t === Me || t === Ue ? -1 : e === Je ? 1 : t === Je ? -1 : e.length === t.length ? e < t ? -1 : 1 : t.length - e.length;
}
__name(Ir, "Ir");
__name2(Ir, "Ir");
var Ee;
var fe;
var z;
var ye;
var vr = (ye = class {
  static {
    __name(this, "ye");
  }
  static {
    __name2(this, "ye");
  }
  constructor() {
    v(this, Ee);
    v(this, fe);
    v(this, z, /* @__PURE__ */ Object.create(null));
  }
  insert(t, s, r, a, n) {
    if (t.length === 0) {
      if (m(this, Ee) !== void 0) throw Se;
      if (n) return;
      S(this, Ee, s);
      return;
    }
    const [o, ...i] = t, c = o === "*" ? i.length === 0 ? ["", "", Me] : ["", "", Je] : o === "/*" ? ["", "", Ue] : o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let u;
    if (c) {
      const l = c[1];
      let p = c[2] || Je;
      if (l && c[2] && (p === ".*" || (p = p.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:"), /\((?!\?:)/.test(p)))) throw Se;
      if (u = m(this, z)[p], !u) {
        if (Object.keys(m(this, z)).some((_) => _ !== Me && _ !== Ue)) throw Se;
        if (n) return;
        u = m(this, z)[p] = new ye(), l !== "" && S(u, fe, a.varIndex++);
      }
      !n && l !== "" && r.push([l, m(u, fe)]);
    } else if (u = m(this, z)[o], !u) {
      if (Object.keys(m(this, z)).some((l) => l.length > 1 && l !== Me && l !== Ue)) throw Se;
      if (n) return;
      u = m(this, z)[o] = new ye();
    }
    u.insert(i, s, r, a, n);
  }
  buildRegExpStr() {
    const s = Object.keys(m(this, z)).sort(Ir).map((r) => {
      const a = m(this, z)[r];
      return (typeof m(a, fe) == "number" ? `(${r})@${m(a, fe)}` : Rr.has(r) ? `\\${r}` : r) + a.buildRegExpStr();
    });
    return typeof m(this, Ee) == "number" && s.unshift(`#${m(this, Ee)}`), s.length === 0 ? "" : s.length === 1 ? s[0] : "(?:" + s.join("|") + ")";
  }
}, Ee = /* @__PURE__ */ new WeakMap(), fe = /* @__PURE__ */ new WeakMap(), z = /* @__PURE__ */ new WeakMap(), ye);
var Ge;
var $e;
var ws;
var Or = (ws = class {
  static {
    __name(this, "ws");
  }
  static {
    __name2(this, "ws");
  }
  constructor() {
    v(this, Ge, { varIndex: 0 });
    v(this, $e, new vr());
  }
  insert(e, t, s) {
    const r = [], a = [];
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
    return m(this, $e).insert(n, t, r, m(this, Ge), s), r;
  }
  buildRegExp() {
    let e = m(this, $e).buildRegExpStr();
    if (e === "") return [/^$/, [], []];
    let t = 0;
    const s = [], r = [];
    return e = e.replace(/#(\d+)|@(\d+)|\.\*\$/g, (a, n, o) => n !== void 0 ? (s[++t] = Number(n), "$()") : (o !== void 0 && (r[Number(o)] = ++t), "")), [new RegExp(`^${e}`), s, r];
  }
}, Ge = /* @__PURE__ */ new WeakMap(), $e = /* @__PURE__ */ new WeakMap(), ws);
var jr = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var Ve = /* @__PURE__ */ Object.create(null);
function Ps(e) {
  return Ve[e] ?? (Ve[e] = new RegExp(e === "*" ? "" : `^${e.replace(/\/\*$|([.\\+*[^\]$()])/g, (t, s) => s ? `\\${s}` : "(?:|/.*)")}$`));
}
__name(Ps, "Ps");
__name2(Ps, "Ps");
function Dr() {
  Ve = /* @__PURE__ */ Object.create(null);
}
__name(Dr, "Dr");
__name2(Dr, "Dr");
function kr(e) {
  var u;
  const t = new Or(), s = [];
  if (e.length === 0) return jr;
  const r = e.map((l) => [!/\*|\/:/.test(l[0]), ...l]).sort(([l, p], [_, f]) => l ? 1 : _ ? -1 : p.length - f.length), a = /* @__PURE__ */ Object.create(null);
  for (let l = 0, p = -1, _ = r.length; l < _; l++) {
    const [f, E, g] = r[l];
    f ? a[E] = [g.map(([w]) => [w, /* @__PURE__ */ Object.create(null)]), Us] : p++;
    let h;
    try {
      h = t.insert(E, p, f);
    } catch (w) {
      throw w === Se ? new Ls(E) : w;
    }
    f || (s[p] = g.map(([w, y]) => {
      const D = /* @__PURE__ */ Object.create(null);
      for (y -= 1; y >= 0; y--) {
        const [k, T] = h[y];
        D[k] = T;
      }
      return [w, D];
    }));
  }
  const [n, o, i] = t.buildRegExp();
  for (let l = 0, p = s.length; l < p; l++) for (let _ = 0, f = s[l].length; _ < f; _++) {
    const E = (u = s[l][_]) == null ? void 0 : u[1];
    if (!E) continue;
    const g = Object.keys(E);
    for (let h = 0, w = g.length; h < w; h++) E[g[h]] = i[E[g[h]]];
  }
  const c = [];
  for (const l in o) c[l] = s[o[l]];
  return [n, c, a];
}
__name(kr, "kr");
__name2(kr, "kr");
function we(e, t) {
  if (e) {
    for (const s of Object.keys(e).sort((r, a) => a.length - r.length)) if (Ps(s).test(t)) return [...e[s]];
  }
}
__name(we, "we");
__name2(we, "we");
var ie;
var ce;
var Xe;
var Hs;
var bs;
var Nr = (bs = class {
  static {
    __name(this, "bs");
  }
  static {
    __name2(this, "bs");
  }
  constructor() {
    v(this, Xe);
    R(this, "name", "RegExpRouter");
    v(this, ie);
    v(this, ce);
    R(this, "match", Sr);
    S(this, ie, { [U]: /* @__PURE__ */ Object.create(null) }), S(this, ce, { [U]: /* @__PURE__ */ Object.create(null) });
  }
  add(e, t, s) {
    var i;
    const r = m(this, ie), a = m(this, ce);
    if (!r || !a) throw new Error(Cs);
    r[e] || [r, a].forEach((c) => {
      c[e] = /* @__PURE__ */ Object.create(null), Object.keys(c[U]).forEach((u) => {
        c[e][u] = [...c[U][u]];
      });
    }), t === "/*" && (t = "*");
    const n = (t.match(/\/:/g) || []).length;
    if (/\*$/.test(t)) {
      const c = Ps(t);
      e === U ? Object.keys(r).forEach((u) => {
        var l;
        (l = r[u])[t] || (l[t] = we(r[u], t) || we(r[U], t) || []);
      }) : (i = r[e])[t] || (i[t] = we(r[e], t) || we(r[U], t) || []), Object.keys(r).forEach((u) => {
        (e === U || e === u) && Object.keys(r[u]).forEach((l) => {
          c.test(l) && r[u][l].push([s, n]);
        });
      }), Object.keys(a).forEach((u) => {
        (e === U || e === u) && Object.keys(a[u]).forEach((l) => c.test(l) && a[u][l].push([s, n]));
      });
      return;
    }
    const o = vs(t) || [t];
    for (let c = 0, u = o.length; c < u; c++) {
      const l = o[c];
      Object.keys(a).forEach((p) => {
        var _;
        (e === U || e === p) && ((_ = a[p])[l] || (_[l] = [...we(r[p], l) || we(r[U], l) || []]), a[p][l].push([s, n - u + c + 1]));
      });
    }
  }
  buildAllMatchers() {
    const e = /* @__PURE__ */ Object.create(null);
    return Object.keys(m(this, ce)).concat(Object.keys(m(this, ie))).forEach((t) => {
      e[t] || (e[t] = j(this, Xe, Hs).call(this, t));
    }), S(this, ie, S(this, ce, void 0)), Dr(), e;
  }
}, ie = /* @__PURE__ */ new WeakMap(), ce = /* @__PURE__ */ new WeakMap(), Xe = /* @__PURE__ */ new WeakSet(), Hs = /* @__PURE__ */ __name2(function(e) {
  const t = [];
  let s = e === U;
  return [m(this, ie), m(this, ce)].forEach((r) => {
    const a = r[e] ? Object.keys(r[e]).map((n) => [n, r[e][n]]) : [];
    a.length !== 0 ? (s || (s = true), t.push(...a)) : e !== U && t.push(...Object.keys(r[U]).map((n) => [n, r[U][n]]));
  }), s ? kr(t) : null;
}, "Hs"), bs);
var ue;
var re;
var Ts;
var Ar = (Ts = class {
  static {
    __name(this, "Ts");
  }
  static {
    __name2(this, "Ts");
  }
  constructor(e) {
    R(this, "name", "SmartRouter");
    v(this, ue, []);
    v(this, re, []);
    S(this, ue, e.routers);
  }
  add(e, t, s) {
    if (!m(this, re)) throw new Error(Cs);
    m(this, re).push([e, t, s]);
  }
  match(e, t) {
    if (!m(this, re)) throw new Error("Fatal error");
    const s = m(this, ue), r = m(this, re), a = s.length;
    let n = 0, o;
    for (; n < a; n++) {
      const i = s[n];
      try {
        for (let c = 0, u = r.length; c < u; c++) i.add(...r[c]);
        o = i.match(e, t);
      } catch (c) {
        if (c instanceof Ls) continue;
        throw c;
      }
      this.match = i.match.bind(i), S(this, ue, [i]), S(this, re, void 0);
      break;
    }
    if (n === a) throw new Error("Fatal error");
    return this.name = `SmartRouter + ${this.activeRouter.name}`, o;
  }
  get activeRouter() {
    if (m(this, re) || m(this, ue).length !== 1) throw new Error("No active router has been determined yet.");
    return m(this, ue)[0];
  }
}, ue = /* @__PURE__ */ new WeakMap(), re = /* @__PURE__ */ new WeakMap(), Ts);
var Ce = /* @__PURE__ */ Object.create(null);
var le;
var q;
var he;
var De;
var H;
var te;
var me;
var ke;
var Cr = (ke = class {
  static {
    __name(this, "ke");
  }
  static {
    __name2(this, "ke");
  }
  constructor(t, s, r) {
    v(this, te);
    v(this, le);
    v(this, q);
    v(this, he);
    v(this, De, 0);
    v(this, H, Ce);
    if (S(this, q, r || /* @__PURE__ */ Object.create(null)), S(this, le, []), t && s) {
      const a = /* @__PURE__ */ Object.create(null);
      a[t] = { handler: s, possibleKeys: [], score: 0 }, S(this, le, [a]);
    }
    S(this, he, []);
  }
  insert(t, s, r) {
    S(this, De, ++ms(this, De)._);
    let a = this;
    const n = ir(s), o = [];
    for (let i = 0, c = n.length; i < c; i++) {
      const u = n[i], l = n[i + 1], p = lr(u, l), _ = Array.isArray(p) ? p[0] : u;
      if (_ in m(a, q)) {
        a = m(a, q)[_], p && o.push(p[1]);
        continue;
      }
      m(a, q)[_] = new ke(), p && (m(a, he).push(p), o.push(p[1])), a = m(a, q)[_];
    }
    return m(a, le).push({ [t]: { handler: r, possibleKeys: o.filter((i, c, u) => u.indexOf(i) === c), score: m(this, De) } }), a;
  }
  search(t, s) {
    var c;
    const r = [];
    S(this, H, Ce);
    let n = [this];
    const o = Rs(s), i = [];
    for (let u = 0, l = o.length; u < l; u++) {
      const p = o[u], _ = u === l - 1, f = [];
      for (let E = 0, g = n.length; E < g; E++) {
        const h = n[E], w = m(h, q)[p];
        w && (S(w, H, m(h, H)), _ ? (m(w, q)["*"] && r.push(...j(this, te, me).call(this, m(w, q)["*"], t, m(h, H))), r.push(...j(this, te, me).call(this, w, t, m(h, H)))) : f.push(w));
        for (let y = 0, D = m(h, he).length; y < D; y++) {
          const k = m(h, he)[y], T = m(h, H) === Ce ? {} : { ...m(h, H) };
          if (k === "*") {
            const L = m(h, q)["*"];
            L && (r.push(...j(this, te, me).call(this, L, t, m(h, H))), S(L, H, T), f.push(L));
            continue;
          }
          const [A, C, I] = k;
          if (!p && !(I instanceof RegExp)) continue;
          const N = m(h, q)[A], x = o.slice(u).join("/");
          if (I instanceof RegExp) {
            const L = I.exec(x);
            if (L) {
              if (T[C] = L[0], r.push(...j(this, te, me).call(this, N, t, m(h, H), T)), Object.keys(m(N, q)).length) {
                S(N, H, T);
                const G = ((c = L[0].match(/\//)) == null ? void 0 : c.length) ?? 0;
                (i[G] || (i[G] = [])).push(N);
              }
              continue;
            }
          }
          (I === true || I.test(p)) && (T[C] = p, _ ? (r.push(...j(this, te, me).call(this, N, t, T, m(h, H))), m(N, q)["*"] && r.push(...j(this, te, me).call(this, m(N, q)["*"], t, T, m(h, H)))) : (S(N, H, T), f.push(N)));
        }
      }
      n = f.concat(i.shift() ?? []);
    }
    return r.length > 1 && r.sort((u, l) => u.score - l.score), [r.map(({ handler: u, params: l }) => [u, l])];
  }
}, le = /* @__PURE__ */ new WeakMap(), q = /* @__PURE__ */ new WeakMap(), he = /* @__PURE__ */ new WeakMap(), De = /* @__PURE__ */ new WeakMap(), H = /* @__PURE__ */ new WeakMap(), te = /* @__PURE__ */ new WeakSet(), me = /* @__PURE__ */ __name2(function(t, s, r, a) {
  const n = [];
  for (let o = 0, i = m(t, le).length; o < i; o++) {
    const c = m(t, le)[o], u = c[s] || c[U], l = {};
    if (u !== void 0 && (u.params = /* @__PURE__ */ Object.create(null), n.push(u), r !== Ce || a && a !== Ce)) for (let p = 0, _ = u.possibleKeys.length; p < _; p++) {
      const f = u.possibleKeys[p], E = l[u.score];
      u.params[f] = a != null && a[f] && !E ? a[f] : r[f] ?? (a == null ? void 0 : a[f]), l[u.score] = true;
    }
  }
  return n;
}, "me"), ke);
var ge;
var Ss;
var Lr = (Ss = class {
  static {
    __name(this, "Ss");
  }
  static {
    __name2(this, "Ss");
  }
  constructor() {
    R(this, "name", "TrieRouter");
    v(this, ge);
    S(this, ge, new Cr());
  }
  add(e, t, s) {
    const r = vs(t);
    if (r) {
      for (let a = 0, n = r.length; a < n; a++) m(this, ge).insert(e, r[a], s);
      return;
    }
    m(this, ge).insert(e, t, s);
  }
  match(e, t) {
    return m(this, ge).search(e, t);
  }
}, ge = /* @__PURE__ */ new WeakMap(), Ss);
var xs = class extends Tr {
  static {
    __name(this, "xs");
  }
  static {
    __name2(this, "xs");
  }
  constructor(e = {}) {
    super(e), this.router = e.router ?? new Ar({ routers: [new Nr(), new Lr()] });
  }
};
var b = /* @__PURE__ */ __name2((e) => {
  const s = { ...{ origin: "*", allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"], allowHeaders: [], exposeHeaders: [] }, ...e }, r = /* @__PURE__ */ ((n) => typeof n == "string" ? n === "*" ? () => n : (o) => n === o ? o : null : typeof n == "function" ? n : (o) => n.includes(o) ? o : null)(s.origin), a = ((n) => typeof n == "function" ? n : Array.isArray(n) ? () => n : () => [])(s.allowMethods);
  return async function(o, i) {
    var l;
    function c(p, _) {
      o.res.headers.set(p, _);
    }
    __name(c, "c");
    __name2(c, "c");
    const u = await r(o.req.header("origin") || "", o);
    if (u && c("Access-Control-Allow-Origin", u), s.credentials && c("Access-Control-Allow-Credentials", "true"), (l = s.exposeHeaders) != null && l.length && c("Access-Control-Expose-Headers", s.exposeHeaders.join(",")), o.req.method === "OPTIONS") {
      s.origin !== "*" && c("Vary", "Origin"), s.maxAge != null && c("Access-Control-Max-Age", s.maxAge.toString());
      const p = await a(o.req.header("origin") || "", o);
      p.length && c("Access-Control-Allow-Methods", p.join(","));
      let _ = s.allowHeaders;
      if (!(_ != null && _.length)) {
        const f = o.req.header("Access-Control-Request-Headers");
        f && (_ = f.split(/\s*,\s*/));
      }
      return _ != null && _.length && (c("Access-Control-Allow-Headers", _.join(",")), o.res.headers.append("Vary", "Access-Control-Request-Headers")), o.res.headers.delete("Content-Length"), o.res.headers.delete("Content-Type"), new Response(null, { headers: o.res.headers, status: 204, statusText: "No Content" });
    }
    await i(), s.origin !== "*" && o.header("Vary", "Origin", { append: true });
  };
}, "b");
function Mr(e) {
  const t = ["DB", "SESSION_KV", "CACHE_KV", "TOSS_SECRET_KEY", "TOSS_CLIENT_KEY"], s = [];
  for (const r of t) e[r] || s.push(r);
  if (s.length > 0) throw new Error(`Missing required environment variables: ${s.join(", ")}

Please configure them:
` + s.map((r) => r === "TOSS_SECRET_KEY" || r === "TOSS_CLIENT_KEY" ? `  npx wrangler pages secret put ${r} --project-name ur-live` : `  Check wrangler.jsonc for ${r} binding`).join(`
`) + `

For more details, see ENV_SETUP_GUIDE.md`);
}
__name(Mr, "Mr");
__name2(Mr, "Mr");
function Ur(e) {
  console.log("[ENV] Environment check:"), console.log("  DB:", e.DB ? "\u2705 Connected" : "\u274C Missing"), console.log("  SESSION_KV:", e.SESSION_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  CACHE_KV:", e.CACHE_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  TOSS_SECRET_KEY:", e.TOSS_SECRET_KEY ? "\u2705 Set" : "\u274C Missing"), console.log("  TOSS_CLIENT_KEY:", e.TOSS_CLIENT_KEY ? "\u2705 Set" : "\u274C Missing");
}
__name(Ur, "Ur");
__name2(Ur, "Ur");
async function Pr(e) {
  const t = [];
  try {
    e.DB ? (await e.DB.prepare("SELECT 1").first(), t.push({ name: "D1 Database Binding", status: "pass", message: "DB connected successfully" })) : t.push({ name: "D1 Database Binding", status: "fail", message: "DB binding not found", details: "Check wrangler.jsonc d1_databases configuration" });
  } catch (s) {
    t.push({ name: "D1 Database Binding", status: "fail", message: "DB query failed", details: s instanceof Error ? s.message : String(s) });
  }
  try {
    if (!e.SESSION_KV) t.push({ name: "SESSION_KV Binding", status: "fail", message: "SESSION_KV binding not found", details: "Check wrangler.jsonc kv_namespaces configuration" });
    else {
      const s = "test:env:check";
      await e.SESSION_KV.put(s, "ok", { expirationTtl: 60 }), await e.SESSION_KV.get(s) === "ok" ? t.push({ name: "SESSION_KV Binding", status: "pass", message: "SESSION_KV read/write successful" }) : t.push({ name: "SESSION_KV Binding", status: "warn", message: "SESSION_KV write succeeded but read failed" });
    }
  } catch (s) {
    t.push({ name: "SESSION_KV Binding", status: "fail", message: "SESSION_KV operation failed", details: s instanceof Error ? s.message : String(s) });
  }
  try {
    if (!e.CACHE_KV) t.push({ name: "CACHE_KV Binding", status: "fail", message: "CACHE_KV binding not found", details: "Check wrangler.jsonc kv_namespaces configuration" });
    else {
      const s = "test:cache:check";
      await e.CACHE_KV.put(s, "ok", { expirationTtl: 60 }), await e.CACHE_KV.get(s) === "ok" ? t.push({ name: "CACHE_KV Binding", status: "pass", message: "CACHE_KV read/write successful" }) : t.push({ name: "CACHE_KV Binding", status: "warn", message: "CACHE_KV write succeeded but read failed" });
    }
  } catch (s) {
    t.push({ name: "CACHE_KV Binding", status: "fail", message: "CACHE_KV operation failed", details: s instanceof Error ? s.message : String(s) });
  }
  return e.TOSS_SECRET_KEY ? !e.TOSS_SECRET_KEY.startsWith("test_gsk_") && !e.TOSS_SECRET_KEY.startsWith("live_gsk_") ? t.push({ name: "TOSS_SECRET_KEY", status: "warn", message: "TOSS_SECRET_KEY format may be invalid", details: "Expected format: test_gsk_* or live_gsk_*" }) : t.push({ name: "TOSS_SECRET_KEY", status: "pass", message: `TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0, 12)}...)` }) : t.push({ name: "TOSS_SECRET_KEY", status: "fail", message: "TOSS_SECRET_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live" }), e.TOSS_CLIENT_KEY ? !e.TOSS_CLIENT_KEY.startsWith("test_gck_") && !e.TOSS_CLIENT_KEY.startsWith("live_gck_") ? t.push({ name: "TOSS_CLIENT_KEY", status: "warn", message: "TOSS_CLIENT_KEY format may be invalid", details: "Expected format: test_gck_* or live_gck_*" }) : t.push({ name: "TOSS_CLIENT_KEY", status: "pass", message: `TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0, 12)}...)` }) : t.push({ name: "TOSS_CLIENT_KEY", status: "fail", message: "TOSS_CLIENT_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live" }), t;
}
__name(Pr, "Pr");
__name2(Pr, "Pr");
function Hr(e) {
  const t = [];
  t.push(""), t.push("========================================"), t.push("\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uACB0\uACFC"), t.push("========================================"), t.push("");
  let s = 0, r = 0, a = 0;
  for (const n of e) {
    const o = n.status === "pass" ? "\u2705" : n.status === "warn" ? "\u26A0\uFE0F" : "\u274C";
    t.push(`${o} ${n.name}: ${n.message}`), n.details && t.push(`   \u2192 ${n.details}`), n.status === "pass" && s++, n.status === "warn" && r++, n.status === "fail" && a++;
  }
  return t.push(""), t.push("========================================"), t.push(`\uCD1D ${e.length}\uAC1C \uD14C\uC2A4\uD2B8:`), t.push(`  \u2705 \uC131\uACF5: ${s}`), r > 0 && t.push(`  \u26A0\uFE0F  \uACBD\uACE0: ${r}`), a > 0 && t.push(`  \u274C \uC2E4\uD328: ${a}`), t.push("========================================"), t.push(""), a > 0 ? (t.push("\u274C \uD658\uACBD \uBCC0\uC218 \uC124\uC815\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."), t.push("\uC790\uC138\uD55C \uB0B4\uC6A9\uC740 ENV_SETUP_GUIDE.md\uB97C \uCC38\uACE0\uD558\uC138\uC694.")) : r > 0 ? t.push("\u26A0\uFE0F  \uC77C\uBD80 \uACBD\uACE0\uAC00 \uC788\uC9C0\uB9CC \uBC30\uD3EC\uB294 \uAC00\uB2A5\uD569\uB2C8\uB2E4.") : t.push("\u2705 \uBAA8\uB4E0 \uD658\uACBD \uBCC0\uC218\uAC00 \uC62C\uBC14\uB974\uAC8C \uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4!"), t.join(`
`);
}
__name(Hr, "Hr");
__name2(Hr, "Hr");
async function xr(e) {
  const t = await Pr(e), s = t.filter((n) => n.status === "pass").length, r = t.filter((n) => n.status === "warn").length, a = t.filter((n) => n.status === "fail").length;
  return { success: a === 0, summary: { total: t.length, pass: s, warn: r, fail: a }, results: t, formatted: Hr(t) };
}
__name(xr, "xr");
__name2(xr, "xr");
var ts = { ENV: "test", TEST_API_KEY: "03148F80-9525-4A00-83B4-1AE55DFFA2DF", TEST_BASE_URL: "https://testapi.barobill.co.kr" };
function Fr() {
  const e = ts.ENV === "production";
  return { baseUrl: ts.TEST_BASE_URL, apiKey: ts.TEST_API_KEY, isProduction: e };
}
__name(Fr, "Fr");
__name2(Fr, "Fr");
async function Fs(e, t) {
  const s = Fr(), r = `${s.baseUrl}${e}`;
  try {
    const a = await fetch(r, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.apiKey}` }, body: JSON.stringify(t) });
    if (!a.ok) throw new Error(`\uBC14\uB85C\uBE4C API \uC624\uB958: ${a.status} ${a.statusText}`);
    return await a.json();
  } catch (a) {
    throw console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", a), a;
  }
}
__name(Fs, "Fs");
__name2(Fs, "Fs");
async function qr(e) {
  try {
    const t = { CorpNum: e.supplierBusinessNumber, InvoicerCorpNum: e.supplierBusinessNumber, InvoicerCorpName: e.supplierBusinessName, InvoicerCEOName: e.supplierCEO, InvoicerAddr: e.supplierAddress, InvoicerBizType: e.supplierBusinessType, InvoicerBizClass: e.supplierBusinessCategory, InvoicerContactName: e.supplierCEO, InvoicerEmail: e.supplierEmail, InvoicerTEL: e.supplierTel, InvoiceeType: e.buyerBusinessNumber ? "\uC0AC\uC5C5\uC790" : "\uAC1C\uC778", InvoiceeCorpNum: e.buyerBusinessNumber, InvoiceeCorpName: e.buyerBusinessName, InvoiceeCEOName: e.buyerCEO, InvoiceeAddr: e.buyerAddress, InvoiceeEmail: e.buyerEmail, InvoiceeTEL: e.buyerTel, WriteDate: e.writeDate, PurposeType: e.purposeType, TaxType: e.taxType, DetailList: e.items.map((r, a) => ({ SerialNum: a + 1, ItemName: r.name, Qty: r.quantity, UnitPrice: r.unitPrice, SupplyCost: r.supplyPrice, Tax: r.taxAmount, Remark: r.description || "" })), SupplyCostTotal: e.totalSupplyPrice.toString(), TaxTotal: e.totalTaxAmount.toString(), TotalAmount: e.totalAmount.toString(), Remark1: e.memo || "", Remark2: e.orderNo || "", SendSMS: false, AutoAccept: false }, s = await Fs("/eTaxInvoice/RegistAndIssue", t);
    if (s.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC2E4\uD328: ${s.message}`);
    return { success: true, ntsConfirmNumber: s.ntsconfirmNum, invoiceKey: s.invoiceKey, message: s.message };
  } catch (t) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC2E4\uD328:", t), t;
  }
}
__name(qr, "qr");
__name2(qr, "qr");
async function $r(e, t, s) {
  try {
    const a = await Fs("/eTaxInvoice/Delete", { CorpNum: e, InvoiceKey: t, Memo: s });
    if (a.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uCDE8\uC18C \uC2E4\uD328: ${a.message}`);
    return { success: true, message: a.message };
  } catch (r) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uCDE8\uC18C \uC2E4\uD328:", r), r;
  }
}
__name($r, "$r");
__name2($r, "$r");
function Le() {
  return false;
}
__name(Le, "Le");
__name2(Le, "Le");
async function Br(e) {
  return await qr(e);
}
__name(Br, "Br");
__name2(Br, "Br");
function Wr(e, t, s) {
  const r = Number(t.total_amount), a = Math.floor(r / 1.1), n = r - a;
  return { supplierBusinessNumber: e.business_number, supplierBusinessName: e.business_name, supplierCEO: e.ceo_name, supplierAddress: e.address, supplierBusinessType: e.business_type, supplierBusinessCategory: e.business_category, supplierEmail: e.email, supplierTel: e.phone, buyerBusinessNumber: t.buyer_business_number, buyerBusinessName: t.buyer_business_name || t.user_name, buyerCEO: t.buyer_ceo_name, buyerAddress: t.shipping_address, buyerEmail: t.user_email, buyerTel: t.shipping_phone, writeDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], purposeType: "01", taxType: "01", items: s.map((o) => {
    const i = Number(o.price) * Number(o.quantity), c = Math.floor(i / 1.1), u = i - c;
    return { name: o.product_name, quantity: Number(o.quantity), unitPrice: Number(o.price), supplyPrice: c, taxAmount: u, description: o.option_name || "" };
  }), totalSupplyPrice: a, totalTaxAmount: n, totalAmount: r, memo: `\uC8FC\uBB38\uBC88\uD638: ${t.order_number}`, orderNo: t.order_number };
}
__name(Wr, "Wr");
__name2(Wr, "Wr");
var Y = class extends Error {
  static {
    __name(this, "Y");
  }
  static {
    __name2(this, "Y");
  }
  constructor(t, s, r) {
    super(t), this.statusCode = s, this.code = r, this.name = "AuthError";
  }
};
function Kr(e) {
  return `${crypto.randomUUID()}-${e}`;
}
__name(Kr, "Kr");
__name2(Kr, "Kr");
function Yr(e) {
  var n, o, i, c, u, l, p;
  const t = e.id.toString(), s = ((n = e.properties) == null ? void 0 : n.nickname) || ((i = (o = e.kakao_account) == null ? void 0 : o.profile) == null ? void 0 : i.nickname) || "Kakao User", r = ((c = e.kakao_account) == null ? void 0 : c.email) || null, a = ((u = e.properties) == null ? void 0 : u.profile_image) || ((p = (l = e.kakao_account) == null ? void 0 : l.profile) == null ? void 0 : p.profile_image_url) || null;
  return { kakaoId: t, nickname: s, email: r, profileImage: a };
}
__name(Yr, "Yr");
__name2(Yr, "Yr");
async function Vr(e, t, s, r, a) {
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
    `).bind(t, s, r, a).first();
    if (!n) throw new Y("Failed to upsert user", 500, "UPSERT_FAILED");
    return console.log("[Auth] \u26A1 User upserted successfully (optimized):", n.id), n;
  } catch (n) {
    throw n instanceof Y ? n : (console.error("[Auth] Database error during upsert:", n), new Y("Database error", 500, "DB_ERROR"));
  }
}
__name(Vr, "Vr");
__name2(Vr, "Vr");
async function Jr(e) {
  try {
    const t = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${e}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" } });
    if (!t.ok) {
      const r = await t.text();
      throw console.error("[Kakao API] Failed to get user info:", r), new Y("Failed to get user info from Kakao", 401, "KAKAO_USER_INFO_FAILED");
    }
    const s = await t.json();
    if (!s.id) throw new Y("Invalid user data from Kakao", 500, "INVALID_KAKAO_DATA");
    return s;
  } catch (t) {
    throw t instanceof Y ? t : (console.error("[Kakao API] Network error:", t), new Y("Failed to communicate with Kakao API", 503, "KAKAO_API_ERROR"));
  }
}
__name(Jr, "Jr");
__name2(Jr, "Jr");
async function zr(e, t, s) {
  try {
    const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: s, redirect_uri: t, code: e }).toString() });
    if (!r.ok) {
      const n = await r.json();
      throw console.error("[Kakao OAuth] Token exchange failed:", n), new Y(`Failed to exchange code: ${n.error_description || n.error}`, 401, n.error || "TOKEN_EXCHANGE_FAILED");
    }
    return (await r.json()).access_token;
  } catch (r) {
    throw r instanceof Y ? r : (console.error("[Kakao OAuth] Network error:", r), new Y("Failed to communicate with Kakao OAuth server", 503, "OAUTH_NETWORK_ERROR"));
  }
}
__name(zr, "zr");
__name2(zr, "zr");
async function qs(e, t) {
  const s = await Jr(t), { kakaoId: r, nickname: a, email: n, profileImage: o } = Yr(s);
  console.log("[Auth] Processing login for Kakao user:", r);
  const i = await Vr(e, r, a, n, o), c = Kr(i.id);
  return { user: i, sessionToken: c };
}
__name(qs, "qs");
__name2(qs, "qs");
async function $s(e, t, s = 30) {
  try {
    const r = await e.get(t, "json");
    if (!r) return console.log(`[Cache MISS] ${t}`), null;
    const a = Date.now() - r.timestamp;
    return a > s * 1e3 ? (console.log(`[Cache EXPIRED] ${t} (age: ${Math.round(a / 1e3)}s)`), null) : (console.log(`[Cache HIT] ${t} (age: ${Math.round(a / 1e3)}s)`), r.data);
  } catch (r) {
    return console.error(`[Cache] Get error for key "${t}":`, r), null;
  }
}
__name($s, "$s");
__name2($s, "$s");
async function ze(e, t, s, r = 30) {
  try {
    const a = { data: s, timestamp: Date.now() };
    await e.put(t, JSON.stringify(a), { expirationTtl: r }), console.log(`[Cache SET] ${t} (TTL: ${r}s)`);
  } catch (a) {
    console.error(`[Cache] Set error for key "${t}":`, a);
  }
}
__name(ze, "ze");
__name2(ze, "ze");
function Qe(e) {
  const t = new URLSearchParams();
  for (const [s, r] of Object.entries(e)) r != null && t.append(s, String(r));
  return t;
}
__name(Qe, "Qe");
__name2(Qe, "Qe");
function os(e, t) {
  if (e.result_code !== "1") throw new Error(`[Aligo ${t}] ${e.message} (code: ${e.result_code})`);
}
__name(os, "os");
__name2(os, "os");
async function is(e) {
  console.log("[Aligo] \uD1A0\uD070 \uC0DD\uC131 \uC2DC\uC791");
  const s = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Qe({ apikey: e.ALIGO_API_KEY, userid: e.ALIGO_USER_ID }) })).json();
  return os(s, "Token Create"), console.log("[Aligo] \u2705 \uD1A0\uD070 \uC0DD\uC131 \uC131\uACF5:", s.token.substring(0, 20) + "..."), { token: s.token, urtime: s.urtime };
}
__name(is, "is");
__name2(is, "is");
async function Gr(e, t) {
  console.log("[Aligo] \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D:", t.channelId);
  const { token: s } = await is(e), a = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Qe({ token: s, userid: e.ALIGO_USER_ID, plusid: t.channelId, phonenumber: t.phoneNumber }) })).json();
  return os(a, "Channel Register"), console.log("[Aligo] \u2705 \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D \uC131\uACF5, senderKey:", a.senderkey), { success: true, senderKey: a.senderkey };
}
__name(Gr, "Gr");
__name2(Gr, "Gr");
async function Xr(e, t, s) {
  console.log("[Aligo] \uD15C\uD50C\uB9BF \uB4F1\uB85D:", s.templateCode);
  const { token: r } = await is(e), n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Qe({ token: r, userid: e.ALIGO_USER_ID, senderkey: t, tpl_name: s.name, tpl_content: s.content, tpl_code: s.templateCode }) })).json();
  return os(n, "Template Register"), console.log("[Aligo] \u2705 \uD15C\uD50C\uB9BF \uB4F1\uB85D \uC131\uACF5:", n.tpl_code), { success: true, templateCode: n.tpl_code };
}
__name(Xr, "Xr");
__name2(Xr, "Xr");
async function Qr(e, t) {
  console.log("[Aligo] \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1:", t.to);
  try {
    const { token: s } = await is(e), r = t.buttons ? JSON.stringify({ button: t.buttons }) : void 0, n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Qe({ token: s, userid: e.ALIGO_USER_ID, senderkey: t.senderKey, tpl_code: t.templateCode, receiver_1: t.to, subject_1: "\uC54C\uB9BC\uD1A1", message_1: t.message, button_1: r }) })).json();
    return n.result_code !== "1" ? (console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328:", n.message), { success: false, error: n.message }) : (console.log("[Aligo] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5, messageId:", n.msg_id), { success: true, messageId: n.msg_id });
  } catch (s) {
    return console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC5D0\uB7EC:", s.message), { success: false, error: s.message };
  }
}
__name(Qr, "Qr");
__name2(Qr, "Qr");
function Zr(e, t) {
  let s = e;
  for (const [r, a] of Object.entries(t)) {
    const n = new RegExp(`#{${r}}`, "g");
    s = s.replace(n, a);
  }
  return s;
}
__name(Zr, "Zr");
__name2(Zr, "Zr");
function Bs(e) {
  let t = e.replace(/-/g, "");
  if (!t.startsWith("010")) throw new Error("Invalid phone number format. Must start with 010");
  if (t.length !== 11) throw new Error("Invalid phone number length. Must be 11 digits");
  return t;
}
__name(Bs, "Bs");
__name2(Bs, "Bs");
function et(e) {
  const t = e.status >= 500 ? "error" : e.status >= 400 ? "warn" : "info";
  console.log(JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: t, message: "API Request", context: e, duration: e.duration }));
}
__name(et, "et");
__name2(et, "et");
function st(e) {
  return { name: "tosspayments", async confirmPayment(t) {
    try {
      const s = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: `Basic ${btoa(e + ":")}`, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify({ paymentKey: t.paymentKey, orderId: t.orderId, amount: t.amount }) }), r = await s.json();
      if (!s.ok) return { success: false, orderId: t.orderId, paymentKey: t.paymentKey, method: "", totalAmount: t.amount, status: "FAILED", approvedAt: "", error: r.message || "\uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328", rawData: r };
      let a = {};
      r.card && (a = { cardCompany: r.card.company, cardNumber: r.card.number, installmentMonths: r.card.installmentPlanMonths || 0 });
      let n = {};
      return r.virtualAccount && (n = { virtualAccountBank: r.virtualAccount.bankCode, virtualAccountNumber: r.virtualAccount.accountNumber, virtualAccountHolder: r.virtualAccount.customerName, virtualAccountDueDate: r.virtualAccount.dueDate }), { success: true, orderId: r.orderId, paymentKey: r.paymentKey, method: r.method, totalAmount: r.totalAmount, status: r.status, approvedAt: r.approvedAt, transactionId: r.transactionKey, ...a, ...n, rawData: r };
    } catch (s) {
      return { success: false, orderId: t.orderId, paymentKey: t.paymentKey, method: "", totalAmount: t.amount, status: "FAILED", approvedAt: "", error: s.message, rawData: null };
    }
  }, async cancelPayment(t) {
    try {
      const s = { cancelReason: t.cancelReason };
      t.cancelAmount && (s.cancelAmount = t.cancelAmount);
      const r = await fetch(`https://api.tosspayments.com/v1/payments/${t.paymentKey}/cancel`, { method: "POST", headers: { Authorization: `Basic ${btoa(e + ":")}`, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(s) }), a = await r.json();
      return r.ok ? { success: true, canceledAt: a.canceledAt || (/* @__PURE__ */ new Date()).toISOString(), rawData: a } : { success: false, error: a.message || "\uCDE8\uC18C \uC2E4\uD328" };
    } catch (s) {
      return { success: false, error: s.message };
    }
  }, async getPayment(t) {
    try {
      const s = await fetch(`https://api.tosspayments.com/v1/payments/${t}`, { method: "GET", headers: { Authorization: `Basic ${btoa(e + ":")}`, "TossPayments-API-Version": "2022-11-16" } }), r = await s.json();
      if (!s.ok) throw new Error(r.message);
      return { success: true, orderId: r.orderId, paymentKey: r.paymentKey, method: r.method, totalAmount: r.totalAmount, status: r.status, approvedAt: r.approvedAt, rawData: r };
    } catch (s) {
      throw s;
    }
  } };
}
__name(st, "st");
__name2(st, "st");
function rt(e, t) {
  switch (e.toLowerCase()) {
    case "tosspayments":
      return st(t);
    default:
      throw new Error(`Unknown payment provider: ${e}`);
  }
}
__name(rt, "rt");
__name2(rt, "rt");
var d = new xs();
d.use("*", async (e, t) => {
  if (e.req.url.includes("localhost") || e.req.url.includes("127.0.0.1")) try {
    Mr(e.env), Ur(e.env);
  } catch (r) {
    console.error("[ENV] Validation failed:", r);
  }
  await t();
});
async function Q(e, t) {
  if (!t) return null;
  try {
    const s = await e.get(`session:${t}`);
    if (!s) return null;
    const r = JSON.parse(s);
    return r.expires_at && Date.now() > r.expires_at ? (await e.delete(`session:${t}`), null) : { user_id: r.user_id, user_type: r.user_type || "user" };
  } catch (s) {
    return console.error("[Auth] Session lookup error:", s), null;
  }
}
__name(Q, "Q");
__name2(Q, "Q");
async function $(e, t) {
  var n;
  const { SESSION_KV: s } = e.env;
  let r = e.req.header("X-Session-Token");
  if (r || (r = (n = e.req.header("Authorization")) == null ? void 0 : n.replace("Bearer ", "")), !r) {
    const o = e.req.header("Cookie");
    if (o) {
      const i = o.match(/session=([^;]+)/);
      r = i ? i[1] : void 0;
    }
  }
  const a = await Q(s, r);
  if (!a) return e.json({ success: false, error: "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uB85C\uADF8\uC778 \uD574\uC8FC\uC138\uC694." }, 401);
  try {
    if (r) {
      const o = await s.get(`session:${r}`);
      if (o) {
        const i = JSON.parse(o), c = i.expires_at - Date.now(), u = 10080 * 60 * 1e3;
        if (c < u) {
          const l = Date.now() + 2592e6;
          await s.put(`session:${r}`, JSON.stringify({ ...i, expires_at: l }), { expirationTtl: 720 * 60 * 60 }), console.log("[Auth] \u2705 Session auto-renewed for user:", a.user_id, "- New expiration:", new Date(l).toISOString());
        }
      }
    }
  } catch (o) {
    console.error("[Auth] Session renewal error:", o);
  }
  e.set("userId", a.user_id), e.set("userType", a.user_type), await t();
}
__name($, "$");
__name2($, "$");
async function cs(e, t) {
  try {
    const s = await e.get(t);
    return s ? JSON.parse(s) : null;
  } catch (s) {
    return console.error("[Cache] Read error:", s), null;
  }
}
__name(cs, "cs");
__name2(cs, "cs");
async function us(e, t, s, r = 60) {
  try {
    await e.put(t, JSON.stringify(s), { expirationTtl: r });
  } catch (a) {
    console.error("[Cache] Write error:", a);
  }
}
__name(us, "us");
__name2(us, "us");
async function ls(e, ...t) {
  try {
    await Promise.all(t.map((s) => e.delete(s)));
  } catch (s) {
    console.error("[Cache] Delete error:", s);
  }
}
__name(ls, "ls");
__name2(ls, "ls");
async function Be(e, t, s, r, a, n, o) {
  try {
    await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(t, s, r, a, n, o || null).run(), console.log(`[Notification] Created for ${s} ${t}: ${a}`);
  } catch (i) {
    console.error("[Notification] Create error:", i);
  }
}
__name(Be, "Be");
__name2(Be, "Be");
async function tt(e, t, s, r, a) {
  await Be(e, t, "seller", "new_order", "\u{1F6D2} \uC2E0\uADDC \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r}\uB2D8\uC758 \uC8FC\uBB38 (${s}) - ${nt(a)}`, "/seller/orders");
}
__name(tt, "tt");
__name2(tt, "tt");
async function Ws(e, t, s, r, a, n) {
  let o = "", i = "";
  switch (r) {
    case "preparing":
      o = "\u{1F4E6} \uC0C1\uD488 \uC900\uBE44 \uC911", i = `\uC8FC\uBB38\uBC88\uD638 ${s}\uC758 \uC0C1\uD488\uC744 \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4`;
      break;
    case "shipping":
      o = "\u{1F69A} \uBC30\uC1A1\uC774 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4", i = `\uC8FC\uBB38\uBC88\uD638 ${s}\uAC00 \uBC30\uC1A1 \uC911\uC785\uB2C8\uB2E4`, a && n && (i += ` (${a}: ${n})`);
      break;
    case "delivered":
      o = "\u2705 \uBC30\uC1A1 \uC644\uB8CC", i = `\uC8FC\uBB38\uBC88\uD638 ${s}\uAC00 \uBC30\uC1A1 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`;
      break;
    default:
      return;
  }
  await Be(e, t, "user", "shipping_status", o, i, "/my-orders");
}
__name(Ws, "Ws");
__name2(Ws, "Ws");
async function at(e, t, s, r, a) {
  await Be(e, t, "seller", "low_stock", "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", `${s}\uC758 \uC7AC\uACE0\uAC00 ${r}\uAC1C\uB85C \uBD80\uC871\uD569\uB2C8\uB2E4 (\uAE30\uC900: ${a}\uAC1C)`, "/seller/products");
}
__name(at, "at");
__name2(at, "at");
function nt(e) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(e);
}
__name(nt, "nt");
__name2(nt, "nt");
async function ot(e, t, s) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const r = await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: t, description: s, scheduledStartTime: (/* @__PURE__ */ new Date()).toISOString() }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false }, contentDetails: { enableAutoStart: true, enableAutoStop: true } }) });
    if (!r.ok) {
      const p = await r.text();
      throw new Error(`YouTube Broadcast \uC0DD\uC131 \uC2E4\uD328: ${p}`);
    }
    const n = (await r.json()).id, o = await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: `${t} - Stream` }, cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" } }) });
    if (!o.ok) {
      const p = await o.text();
      throw new Error(`YouTube Stream \uC0DD\uC131 \uC2E4\uD328: ${p}`);
    }
    const i = await o.json(), c = i.id, u = i.cdn.ingestionInfo.streamName, l = i.cdn.ingestionInfo.ingestionAddress;
    return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`, { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}` } }), { broadcastId: n, streamId: c, streamKey: u, streamUrl: l };
  } catch (r) {
    throw console.error("[YouTube API] Live broadcast creation failed:", r), r;
  }
}
__name(ot, "ot");
__name2(ot, "ot");
async function it(e, t) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const s = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${t}&part=status`, { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}` } });
    if (!s.ok) {
      const r = await s.text();
      throw new Error(`YouTube \uBC29\uC1A1 \uC885\uB8CC \uC2E4\uD328: ${r}`);
    }
  } catch (s) {
    throw console.error("[YouTube API] Live broadcast end failed:", s), s;
  }
}
__name(it, "it");
__name2(it, "it");
async function ct(e, t, s) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    let r = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${t}&part=snippet,authorDetails`;
    s && (r += `&pageToken=${s}`);
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
__name(ct, "ct");
__name2(ct, "ct");
async function ut(e, t) {
  if (!e.apiKey && !e.accessToken) throw new Error("YouTube API Key \uB610\uB294 Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const s = e.accessToken ? { Authorization: `Bearer ${e.accessToken}` } : {}, r = e.accessToken ? `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}` : `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}&key=${e.apiKey}`, a = await fetch(r, { headers: s });
    if (!a.ok) {
      const u = await a.text();
      throw new Error(`YouTube \uD1B5\uACC4 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${u}`);
    }
    const n = await a.json();
    if (!n.items || n.items.length === 0) throw new Error("Video not found");
    const o = n.items[0], i = o.statistics, c = o.liveStreamingDetails;
    return { viewCount: parseInt(i.viewCount || "0"), likeCount: parseInt(i.likeCount || "0"), commentCount: parseInt(i.commentCount || "0"), concurrentViewers: c != null && c.concurrentViewers ? parseInt(c.concurrentViewers) : void 0 };
  } catch (s) {
    throw console.error("[YouTube API] Get live stats failed:", s), s;
  }
}
__name(ut, "ut");
__name2(ut, "ut");
function Ks(e) {
  try {
    if (!/^https?:\/\//.test(e) && /^[\w-]{11}$/.test(e)) return e;
    const t = new URL(e);
    if (t.hostname.includes("youtube.com")) {
      const s = t.searchParams.get("v");
      if (s) return s;
      const r = t.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (r) return r[2];
    }
    if (t.hostname === "youtu.be") {
      const s = t.pathname.slice(1).split("?")[0];
      if (s && s.length === 11) return s;
    }
    return null;
  } catch {
    return null;
  }
}
__name(Ks, "Ks");
__name2(Ks, "Ks");
function Ys(e) {
  try {
    const t = new URL(e);
    if (t.hostname.includes("tiktok.com")) {
      const s = t.pathname.match(/\/video\/(\d+)/);
      if (s) return s[1];
      const r = t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (r) return r[1];
    }
    return t.hostname.includes("vm.tiktok.com") || t.hostname.includes("vt.tiktok.com") ? t.pathname.slice(1) : null;
  } catch {
    return null;
  }
}
__name(Ys, "Ys");
__name2(Ys, "Ys");
function lt(e) {
  try {
    const t = new URL(e);
    if (t.hostname.includes("tiktok.com")) {
      if (t.pathname.includes("/live")) return "live";
      if (t.pathname.includes("/video/")) return "video";
    }
    return null;
  } catch {
    return null;
  }
}
__name(lt, "lt");
__name2(lt, "lt");
function Vs(e) {
  try {
    const t = new URL(e);
    if (t.hostname.includes("tiktok.com")) {
      const s = t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (s) return s[1];
    }
    return t.hostname.includes("vm.tiktok.com") || t.hostname.includes("vt.tiktok.com") ? t.pathname.slice(1) : null;
  } catch {
    return null;
  }
}
__name(Vs, "Vs");
__name2(Vs, "Vs");
d.use("*", async (e, t) => {
  await t(), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");
  const s = new URL(e.req.url);
  s.hostname !== "localhost" && s.protocol === "https:" && e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("X-Frame-Options", "SAMEORIGIN"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
d.use("/api/*", b());
d.use("/api/*", async (e, t) => {
  const s = Date.now(), r = e.req.method, a = e.req.path;
  await t();
  const n = Date.now() - s, o = e.res.status, i = { method: r, path: a, status: o, duration: n }, c = e.get("userId");
  c && (i.userId = c), et(i);
});
d.use("/static/*", async (e, t) => {
  await t(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
d.use("/images/*", async (e, t) => {
  await t(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
async function Js(e, t, s, r) {
  const a = crypto.randomUUID(), n = Date.now() + 1440 * 60 * 1e3, o = { user_id: t, user_type: s, userData: r, expires_at: n };
  return await e.put(`session:${a}`, JSON.stringify(o), { expirationTtl: 86400 }), console.log(`[createSession] \u2705 Session created for ${s} user ${t}`), a;
}
__name(Js, "Js");
__name2(Js, "Js");
async function Ne(e, t) {
  const s = await e.get(`session:${t}`);
  if (!s) return null;
  const r = JSON.parse(s);
  return r.expires_at && Date.now() > r.expires_at ? (await e.delete(`session:${t}`), null) : { session_token: t, [`${r.user_type}_id`]: r.user_id, user_type: r.user_type, ...r.userData };
}
__name(Ne, "Ne");
__name2(Ne, "Ne");
d.post("/api/auth/user/register", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { email: s, password: r, name: a, phone: n } = await e.req.json();
    if (!s || !r || !a) return e.json({ success: false, error: "\uC774\uBA54\uC77C, \uBE44\uBC00\uBC88\uD638, \uC774\uB984\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const o = `placeholder_hash_for_${r}`;
    try {
      const c = (await t.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(s, o, a, n || null).run()).meta.last_row_id, u = `user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      return e.json({ success: true, data: { access_token: u, user: { id: c, email: s, name: a, phone: n } } });
    } catch (i) {
      const c = i.message || "";
      if (c.includes("UNIQUE") || c.includes("unique")) return e.json({ success: false, error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
      throw i;
    }
  } catch (s) {
    return console.error("[User Register] Error:", s), e.json({ success: false, error: s.message || "\uD68C\uC6D0\uAC00\uC785 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
d.post("/api/auth/user/login", b(), async (e) => {
  const { DB: t, SESSION_KV: s } = e.env;
  try {
    const { email: r, password: a } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await t.prepare("SELECT * FROM users WHERE email = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(n.password_hash && n.password_hash.includes(`placeholder_hash_for_${a}`))) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    await t.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();
    const i = crypto.randomUUID(), c = Date.now() + 1440 * 60 * 1e3;
    return await s.put(`session:${i}`, JSON.stringify({ user_id: n.id, user_type: "user", expires_at: c }), { expirationTtl: 1440 * 60 }), console.log("[User Login] Session created in SESSION_KV for user:", n.id), e.json({ success: true, data: { session_token: i, user: { id: n.id, email: n.email, name: n.name, phone: n.phone, profile_image: n.profile_image } } });
  } catch (r) {
    return console.error("[User Login] Error:", r), e.json({ success: false, error: r.message || "\uB85C\uADF8\uC778 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
d.post("/api/auth/login", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { username: s, password: r, userType: a } = await e.req.json();
    if (!s || !r || !a) return e.json({ success: false, error: "\uC544\uC774\uB514\uC640 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    let n, o = a === "admin" ? "admins" : "sellers";
    if (n = await t.prepare(`SELECT * FROM ${o} WHERE username = ? OR email = ?`).bind(s, s).first(), !n) return e.json({ success: false, error: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    const i = a === "admin" && (s === "admin" || s === "admin@example.com") && r === "admin123", c = a === "seller" && (s === "seller1" && r === "seller123" || s === "seller2" && r === "seller123"), u = n.password_hash && n.password_hash.includes(`placeholder_hash_for_${r}`);
    if (!(i || c || u)) return e.json({ success: false, error: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!n.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    if (a === "seller" && n.status !== "approved") return e.json({ success: false, error: "\uC2B9\uC778 \uB300\uAE30 \uC911\uC778 \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    const p = await Js(e.env.SESSION_KV, n.id, a, { username: n.username, name: n.name, email: n.email, businessName: n.business_name, role: n.role });
    return await t.prepare(`UPDATE ${o} SET last_login_at = datetime('now') WHERE id = ?`).bind(n.id).run(), e.json({ success: true, data: { sessionToken: p, user: { id: n.id, username: n.username, name: n.name, email: n.email, type: a, businessName: n.business_name, role: n.role } } });
  } catch (s) {
    return console.error("Login error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/auth/logout", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token");
    return s && await e.env.SESSION_KV.delete(`session:${s}`), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/register", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { email: s, password: r, name: a, phone: n, business_number: o, company_name: i } = await e.req.json();
    if (!s || !r || !a || !n) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (r.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const c = s.split("@")[0], u = `placeholder_hash_for_${r}`;
    try {
      const l = await t.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c, s, u, a, n, o || null, i || null).run();
      return e.json({ success: true, data: { sellerId: l.meta.last_row_id, message: "\uD68C\uC6D0\uAC00\uC785\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uD6C4 \uB85C\uADF8\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." } });
    } catch (l) {
      const p = l.message || "";
      if (p.includes("UNIQUE") || p.includes("unique")) return e.json({ success: false, error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
      throw l;
    }
  } catch (s) {
    return console.error("Seller registration error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/admin/login", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { email: s, password: r } = await e.req.json();
    if (!s || !r) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const a = await t.prepare("SELECT * FROM admins WHERE email = ?").bind(s).first();
    if (!a) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(s === "admin@example.com" && r === "admin123" || a.password_hash && a.password_hash.includes(`placeholder_hash_for_${r}`))) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!a.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    const i = await Js(e.env.SESSION_KV, a.id, "admin", { username: a.username, email: a.email, name: a.name, role: a.role });
    return await t.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(), e.json({ success: true, data: { token: i, admin: { id: a.id, username: a.username, email: a.email, name: a.name, role: a.role } } });
  } catch (s) {
    return console.error("Admin login error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/auth/verify", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const r = await Ne(e.env.SESSION_KV, s);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = r.user_type === "admin" ? "admins" : "sellers", n = r.user_type === "admin" ? r.admin_id : r.seller_id, o = await t.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(n).first();
    return o ? e.json({ success: true, data: { user: { id: o.id, type: r.user_type, username: o.username, name: o.name, email: o.email, businessName: o.business_name, role: o.role } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/auth/kakao/sync/callback", async (e) => {
  var s, r, a, n, o, i, c, u, l, p, _, f, E;
  const { DB: t } = e.env;
  try {
    console.log("[Kakao Sync] Callback started"), console.log("[Kakao Sync] DB available:", !!t);
    const g = e.req.query("code"), h = e.req.query("state") || "/", w = e.req.query("error");
    if (console.log("[Kakao Sync] Query params:", { hasCode: !!g, state: h, error: w }), w) return console.error("[Kakao Sync] OAuth error:", w), e.redirect(`${h}?error=kakao_oauth_${w}`);
    if (!g) return console.error("[Kakao Sync] No authorization code"), e.redirect(`${h}?error=no_code`);
    console.log("[Kakao Sync] Authorization code received");
    const y = e.env.KAKAO_REST_API_KEY || "5dd74bccb797640b0efd070467f3bafd", D = `${new URL(e.req.url).origin}/auth/kakao/sync/callback`;
    console.log("[Kakao Sync] Exchanging code for token..."), console.log("  - REST_API_KEY:", y.substring(0, 10) + "..."), console.log("  - REDIRECT_URI:", D), console.log("[Kakao Sync] Step 1: Fetching access token...");
    const k = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: y, redirect_uri: D, code: g }) });
    if (console.log("[Kakao Sync] Token response status:", k.status), console.log("[Kakao Sync] Token request details:", { client_id: y, redirect_uri: D, code_length: g.length, code_prefix: g.substring(0, 20) }), !k.ok) {
      const B = await k.text();
      return console.error("[Kakao Sync] Token request failed:", B), e.redirect(`${h}?error=token_request_failed&detail=${encodeURIComponent(B)}`);
    }
    const T = await k.json();
    if (console.log("[Kakao Sync] Token data received:", { hasAccessToken: !!T.access_token, error: T.error, errorDescription: T.error_description }), !T.access_token) return console.error("[Kakao Sync] Token error:", T), e.redirect(`${h}?error=token_failed&detail=${encodeURIComponent(T.error || "unknown")}`);
    console.log("[Kakao Sync] Access token obtained successfully"), console.log("[Kakao Sync] Step 2: Fetching user info...");
    const A = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${T.access_token}` } });
    console.log("[Kakao Sync] User response status:", A.status);
    const C = await A.json();
    if (console.log("[Kakao Sync] User data received:", { hasId: !!C.id, id: C.id, hasNickname: !!((s = C.properties) != null && s.nickname || (a = (r = C.kakao_account) == null ? void 0 : r.profile) != null && a.nickname) }), !C.id) return console.error("[Kakao Sync] Failed to get user info:", C), e.redirect(`${h}?error=user_info_failed`);
    console.log("[Kakao Sync] User info obtained successfully"), console.log("[Kakao Sync] Step 2.5: Fetching service terms...");
    const I = await fetch("https://kapi.kakao.com/v2/user/service_terms", { headers: { Authorization: `Bearer ${T.access_token}` } });
    console.log("[Kakao Sync] Terms response status:", I.status);
    let N = null;
    if (I.ok ? (N = await I.json(), console.log("[Kakao Sync] Service terms received:", { allowedServiceTerms: ((n = N.allowed_service_terms) == null ? void 0 : n.length) || 0, tags: (o = N.allowed_service_terms) == null ? void 0 : o.map((B) => B.tag) })) : console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"), console.log("[Kakao Sync] Step 3: Saving user to database..."), !t) return console.error("[Kakao Sync] DB is not available!"), e.redirect(`${h}?error=db_not_available`);
    const x = C.id.toString(), L = ((i = C.properties) == null ? void 0 : i.nickname) || ((u = (c = C.kakao_account) == null ? void 0 : c.profile) == null ? void 0 : u.nickname) || "Kakao User", G = ((l = C.kakao_account) == null ? void 0 : l.email) || "", X = ((p = C.properties) == null ? void 0 : p.profile_image) || ((f = (_ = C.kakao_account) == null ? void 0 : _.profile) == null ? void 0 : f.profile_image_url) || "", Ae = T.access_token, F = ((E = N == null ? void 0 : N.allowed_service_terms) == null ? void 0 : E.map((B) => B.tag)) || [], de = JSON.stringify(F);
    console.log("[Kakao Sync] User data:", { kakaoId: x, nickname: L, email: G ? "exists" : "none", serviceTerms: F });
    try {
      const B = await t.prepare("SELECT * FROM users WHERE kakao_id = ?").bind(x).first();
      console.log("[Kakao Sync] Existing user check:", !!B);
      let Z;
      B ? (Z = B.id, await t.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L, G, X, Z).run(), console.log("[Kakao Sync] Updated user:", Z)) : (Z = (await t.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(x, L, G || null, X || null).run()).meta.last_row_id, console.log("[Kakao Sync] Created user:", Z)), console.log("[Kakao Sync] User saved successfully, userId:", Z), console.log("[Kakao Sync] Step 4: Creating session...");
      const { SESSION_KV: Xs } = e.env, Ze = crypto.randomUUID(), Qs = Date.now() + 1440 * 60 * 1e3;
      await Xs.put(`session:${Ze}`, JSON.stringify({ user_id: Z, user_type: "user", expires_at: Qs }), { expirationTtl: 1440 * 60 }), console.log("[Kakao Sync] Session created successfully in SESSION_KV"), console.log("[Kakao Sync] Step 5: Redirecting...");
      const ds = h.includes("?") ? `${h}&login=success&session=${Ze}&userId=${Z}&userName=${encodeURIComponent(L)}` : `${h}?login=success&session=${Ze}&userId=${Z}&userName=${encodeURIComponent(L)}`;
      return console.log("[Kakao Sync] Redirect URL:", ds), e.redirect(ds);
    } catch (B) {
      return console.error("[Kakao Sync] Database error:", B), console.error("[Kakao Sync] DB error details:", { message: B.message, name: B.name }), e.redirect(`${h}?error=database_error&detail=${encodeURIComponent(B.message)}`);
    }
  } catch (g) {
    console.error("[Kakao Sync] Exception:", g), console.error("[Kakao Sync] Error details:", { message: g.message, stack: g.stack, name: g.name });
    const h = e.req.query("state") || "/", w = encodeURIComponent(g.message || "unknown");
    return e.redirect(`${h}?error=kakao_sync_failed&detail=${w}`);
  }
});
d.post("/api/auth/kakao/callback", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { code: s, redirect_uri: r } = await e.req.json();
    if (!s) return e.json({ success: false, error: "Authorization code is required" }, 400);
    if (!e.env.KAKAO_REST_API_KEY) return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"), e.json({ success: false, error: "Server configuration error", code: "MISSING_API_KEY" }, 500);
    const a = r || "https://live.ur-team.com/auth/kakao/callback";
    console.log("[Kakao Callback] Starting OAuth flow");
    const n = await zr(s, a, e.env.KAKAO_REST_API_KEY), { user: o, sessionToken: i } = await qs(t, n), c = Date.now() + 720 * 60 * 60 * 1e3;
    return await e.env.SESSION_KV.put(`session:${i}`, JSON.stringify({ user_id: o.id, user_type: "user", expires_at: c }), { expirationTtl: 720 * 60 * 60 }), console.log("[Kakao Callback] \u2705 Session saved to SESSION_KV for user:", o.id, "- Expires:", new Date(c).toISOString()), e.json({ success: true, data: { session_token: i, user: { id: o.id, name: o.name, email: o.email, profile_image: o.profile_image } } });
  } catch (s) {
    return console.error("[Kakao Callback] Error:", s), s instanceof Y ? e.json({ success: false, error: s.message, code: s.code }, s.statusCode) : e.json({ success: false, error: s.message || "Internal server error", code: "UNKNOWN_ERROR" }, 500);
  }
});
d.post("/api/auth/kakao/sync", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { accessToken: s } = await e.req.json();
    if (!s) return e.json({ success: false, error: "Access token is required" }, 400);
    console.log("[Kakao Sync] Verifying access token");
    const r = Date.now(), { user: a, sessionToken: n } = await qs(t, s);
    console.log("[Kakao Sync] ProcessKakaoLogin completed in", Date.now() - r, "ms");
    const o = Date.now() + 720 * 60 * 60 * 1e3, i = Date.now();
    return await e.env.SESSION_KV.put(`session:${n}`, JSON.stringify({ user_id: a.id, user_type: "user", expires_at: o }), { expirationTtl: 720 * 60 * 60 }), console.log("[Kakao Sync] \u2705 Session saved to SESSION_KV in", Date.now() - i, "ms"), console.log("[Kakao Sync] Total login time:", Date.now() - r, "ms"), e.json({ success: true, data: { session_token: n, user: { id: a.id, name: a.name, email: a.email, profile_image: a.profile_image } } });
  } catch (s) {
    return console.error("[Kakao Sync] Error:", s), s instanceof Y ? e.json({ success: false, error: s.message, code: s.code }, s.statusCode) : e.json({ success: false, error: s instanceof Error ? s.message : "Login failed", code: "UNKNOWN_ERROR" }, 500);
  }
});
d.get("/api/auth/validate", b(), async (e) => {
  var s;
  const { SESSION_KV: t } = e.env;
  try {
    const r = e.req.header("X-Session-Token") || ((s = e.req.header("Authorization")) == null ? void 0 : s.replace("Bearer ", "")) || "";
    if (!r) return e.json({ success: false, error: "No session token provided", code: "NO_TOKEN" }, 401);
    const a = await Q(t, r);
    return a ? e.json({ success: true, data: { user_id: a.user_id, user_type: a.user_type, session_valid: true } }) : e.json({ success: false, error: "Session expired or invalid", code: "SESSION_EXPIRED" }, 401);
  } catch (r) {
    return console.error("[Auth Validate] Error:", r), e.json({ success: false, error: "Validation failed", code: "VALIDATION_ERROR" }, 500);
  }
});
d.post("/api/auth/kakao/logout", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token") || "";
    return s && (await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(s).run(), console.log("[Kakao Sync] Session deleted")), e.json({ success: true });
  } catch (s) {
    return console.error("[Kakao Sync] Logout error:", s), e.json({ success: false, error: "Logout failed" }, 500);
  }
});
d.post("/api/auth/kakao/unlink", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
    if (console.log("[Kakao Unlink] Starting unlink process..."), !await t.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(s).first()) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await t.prepare(`
      SELECT * FROM users WHERE id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(s).first();
    if (!a) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (console.log("[Kakao Unlink] User found:", a.id), a.access_token) try {
      console.log("[Kakao Unlink] Calling Kakao unlink API...");
      const n = await fetch("https://kapi.kakao.com/v1/user/unlink", { method: "POST", headers: { Authorization: `Bearer ${a.access_token}`, "Content-Type": "application/x-www-form-urlencoded" } }), o = await n.json();
      n.ok ? console.log("[Kakao Unlink] Kakao unlink successful:", o.id) : console.warn("[Kakao Unlink] Kakao unlink failed:", o);
    } catch (n) {
      console.error("[Kakao Unlink] Kakao API error:", n);
    }
    else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");
    return console.log("[Kakao Unlink] Deleting user data from DB..."), await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(s).run(), console.log("[Kakao Unlink] Sessions deleted"), await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(), console.log("[Kakao Unlink] Cart items deleted"), await t.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(), console.log("[Kakao Unlink] User deleted"), console.log("[Kakao Unlink] Unlink process completed successfully"), e.json({ success: true, message: "\uD68C\uC6D0 \uD0C8\uD1F4\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" });
  } catch (s) {
    return console.error("[Kakao Unlink] Error:", s), e.json({ success: false, error: "\uD68C\uC6D0 \uD0C8\uD1F4 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
d.post("/webhooks/kakao/unlink", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = await e.req.json(), { user_id: r, referrer_type: a } = s;
    if (console.log("[Kakao Webhook] Unlink notification received:", { user_id: r, referrer_type: a }), !r) return e.json({ success: false, error: "user_id is required" }, 400);
    const n = await t.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(r.toString()).first();
    return n ? (console.log("[Kakao Webhook] Deleting user data for user:", n.id), await t.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(), await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(), await t.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(), console.log("[Kakao Webhook] User data deleted successfully"), e.json({ success: true })) : (console.log("[Kakao Webhook] User not found:", r), e.json({ success: true }));
  } catch (s) {
    return console.error("[Kakao Webhook] Error:", s), e.json({ success: false, error: "Webhook processing failed" }, 500);
  }
});
d.get("/api/auth/user/verify", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const r = await Ne(e.env.SESSION_KV, s);
    if (!r || r.user_type !== "user") return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = parseInt(s.split("_")[1]), n = await t.prepare("SELECT * FROM users WHERE id = ?").bind(a).first();
    return n ? e.json({ success: true, data: { user: { id: n.id, name: n.name, email: n.email, profileImage: n.profile_image, phone: n.phone } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/shipping-addresses", b(), $, async (e) => {
  const { DB: t } = e.env, s = e.get("userId");
  try {
    const r = await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(s).all();
    return e.json({ success: true, data: r.results || [] });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/shipping-addresses/:userId", b(), $, async (e) => {
  const { DB: t } = e.env, s = e.get("userId"), r = parseInt(e.req.param("userId"));
  try {
    if (r !== s) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uBC30\uC1A1\uC9C0\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const a = await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(s).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.post("/api/shipping-addresses", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = await e.req.json(), r = s.user_id, a = s.recipient_name, n = s.phone, o = s.postal_code, i = s.address, c = s.address_detail, u = s.is_default;
    if (console.log("[POST /api/shipping-addresses] Received:", JSON.stringify(s)), !r || !a || !n || !i) return console.error("[POST /api/shipping-addresses] Missing required fields:", { userId: r, recipientName: a, phone: n, address: i }), e.json({ success: false, error: "\uD544\uC218 \uC815\uBCF4\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    u && await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(r).run();
    const l = await t.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a, n, o || "", i, c || "", u ? 1 : 0).run();
    return console.log("[POST /api/shipping-addresses] Success:", { id: l.meta.last_row_id }), e.json({ success: true, data: { id: l.meta.last_row_id } });
  } catch (s) {
    return console.error("[POST /api/shipping-addresses] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.put("/api/shipping-addresses/:id", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), r = await e.req.json(), a = r.user_id, n = r.recipient_name, o = r.phone, i = r.postal_code, c = r.address, u = r.address_detail, l = r.is_default;
    return l && await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(), await t.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n, o, i || "", c, u || "", l ? 1 : 0, s, a).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.delete("/api/shipping-addresses/:id", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), r = e.req.query("userId");
    return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(s, r).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
async function M(e) {
  const t = e.req.header("X-Session-Token");
  if (!t) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const s = await Ne(e.env.SESSION_KV, t);
  return !s || s.user_type !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: s.admin_id, userData: s };
}
__name(M, "M");
__name2(M, "M");
async function O(e) {
  const t = e.req.header("X-Session-Token");
  if (!t) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const s = await Ne(e.env.SESSION_KV, t);
  return !s || s.user_type !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: s.seller_id, userData: s };
}
__name(O, "O");
__name2(O, "O");
d.get("/api/health", (e) => e.json({ success: true, status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString(), env: { hasDB: !!e.env.DB, hasSessionKV: !!e.env.SESSION_KV, hasCacheKV: !!e.env.CACHE_KV } }));
d.get("/api/test/env", async (e) => {
  try {
    const t = await xr(e.env);
    return e.json(t);
  } catch (t) {
    return e.json({ success: false, error: "\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uC2E4\uD589 \uC911 \uC624\uB958 \uBC1C\uC0DD", details: t instanceof Error ? t.message : String(t) }, 500);
  }
});
d.get("/api/streams", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env;
  try {
    const r = "streams:live", a = await s.get(r, "json");
    if (a) return e.json({ success: true, data: a, cached: true });
    const n = await t.prepare("SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC").bind("live").all();
    return await s.put(r, JSON.stringify(n.results), { expirationTtl: 600 }), e.json({ success: true, data: n.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/streams/:id", async (e) => {
  const { DB: t } = e.env, s = e.req.param("id");
  try {
    const r = await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(s).first();
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/live-streams", async (e) => {
  const { DB: t } = e.env, { status: s, seller_id: r, limit: a = "20", offset: n = "0" } = e.req.query();
  try {
    let o = `
      SELECT ls.*, 
             s.display_name as seller_name
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      WHERE 1=1
    `;
    const i = [];
    s && (o += " AND ls.status = ?", i.push(s)), r && (o += " AND ls.seller_id = ?", i.push(r)), o += ' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC', o += " LIMIT ? OFFSET ?", i.push(parseInt(a), parseInt(n));
    const { results: c } = await t.prepare(o).bind(...i).all();
    return e.json({ success: true, data: c });
  } catch (o) {
    return console.error("[API] Live streams list error:", o), e.json({ success: false, error: `\uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${o.message}` }, 500);
  }
});
d.get("/api/live-streams/:id", async (e) => {
  const { DB: t } = e.env, s = e.req.param("id");
  try {
    const r = await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(s).first();
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/products", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env;
  try {
    const r = e.req.query("featured"), a = parseInt(e.req.query("limit") || "20"), n = parseInt(e.req.query("offset") || "0"), o = `products:list:${r || "all"}:${a}:${n}`, i = await cs(s, o);
    if (i) return e.json({ success: true, data: i, cached: true });
    let c;
    r === "true" ? c = `
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
      ` : c = `
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
      `;
    const l = (await t.prepare(c).bind(a, n).all()).results || [];
    return await us(s, o, l, 300), e.json({ success: true, data: l, cached: false });
  } catch (r) {
    return console.error("Products list error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/products/popular", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env;
  try {
    const r = await cs(s, "products:popular");
    if (r) return e.json({ success: true, data: r, cached: true });
    const n = (await t.prepare(`
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
    return await us(s, "products:popular", n, 600), e.json({ success: true, data: n, cached: false });
  } catch (r) {
    return console.error("Popular products error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/search/suggestions", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.query("q") || "";
    if (!s.trim() || s.length < 2) return e.json({ success: true, data: { suggestions: [] } });
    const r = `%${s}%`, a = await t.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(r).all(), n = await t.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(r, r).all(), o = [...(a.results || []).map((i) => ({ type: "product", text: i.name })), ...(n.results || []).map((i) => ({ type: "seller", text: i.display_name }))];
    return e.json({ success: true, data: { suggestions: o } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/products/search", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.query("q") || "", r = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0");
    if (!s.trim()) return e.json({ success: false, error: "Search query is required" }, 400);
    const n = `%${s}%`, o = await t.prepare(`
      SELECT 
        p.*,
        s.display_name as seller_name,
        s.username as seller_username
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(n, n, n, r, a).all(), i = await t.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
    `).bind(n, n, n).first();
    return e.json({ success: true, data: { products: o.results || [], total: (i == null ? void 0 : i.total) || 0, query: s, limit: r, offset: a } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/products/:id", async (e) => {
  const { DB: t } = e.env, s = e.req.param("id");
  try {
    const r = await t.prepare(`
      SELECT 
        p.*,
        COALESCE(s.name, s.username, 'UR Live') as seller_name
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = ? AND p.is_active = 1
    `).bind(s).first();
    if (!r) return e.json({ success: false, error: "Product not found" }, 404);
    const a = await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s).all();
    return e.json({ success: true, data: { product: r, options: a.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/products/:id/stock", async (e) => {
  const { DB: t } = e.env, s = e.req.param("id");
  try {
    const r = await t.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(s).first();
    return r ? e.json({ success: true, data: { productId: r.id, productName: r.name, stock: r.stock, available: r.stock > 0 } }) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/streams/:streamId/products", async (e) => {
  const { DB: t } = e.env, s = e.req.param("streamId");
  try {
    const r = await t.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(s).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/cart", $, async (e) => {
  const { DB: t } = e.env, s = e.get("userId");
  try {
    const r = await t.prepare(`
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
    `).bind(s).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return e.json({ success: false, error: `\uC7A5\uBC14\uAD6C\uB2C8 \uC870\uD68C \uC2E4\uD328: ${r.message}` }, 500);
  }
});
d.get("/api/cart/:userId", $, async (e) => {
  const { DB: t } = e.env, s = e.get("userId"), r = e.req.param("userId");
  try {
    let a = await t.prepare("SELECT id FROM users WHERE id = ?").bind(s).first();
    if (!a) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = a.id;
    if (r !== String(n)) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC7A5\uBC14\uAD6C\uB2C8\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const o = await t.prepare(`
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
  const { DB: t } = e.env;
  try {
    const s = await e.req.json(), { kakaoId: r, name: a, email: n, phone: o } = s;
    if (!r || !a) return e.json({ success: false, error: "kakaoId and name are required" }, 400);
    const i = await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(r).first();
    if (i) return e.json({ success: true, data: { id: i.id } });
    const c = await t.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(r, a, n || null, o || null).run();
    return e.json({ success: true, data: { id: c.meta.last_row_id } });
  } catch (s) {
    return console.error("Error creating user:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/cart", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = await e.req.json(), { userId: r, kakaoId: a, productId: n, optionId: o, quantity: i, priceSnapshot: c, liveStreamId: u } = s, l = a || r;
    if (!l) return e.json({ success: false, error: "userId or kakaoId is required" }, 400);
    let p = await t.prepare("SELECT id FROM users WHERE id = ?").bind(l).first();
    if (p || (p = await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(l).first()), !p) return e.json({ success: false, error: "User not found" }, 404);
    const _ = p.id, f = await t.prepare("SELECT stock FROM products WHERE id = ?").bind(n).first();
    if (!f || f.stock < i) return e.json({ success: false, error: "Insufficient stock" }, 400);
    const E = await t.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(_, n, o || null, o || null).first();
    let g;
    if (E) {
      const h = E.quantity + i;
      await t.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(h, c, E.id).run(), g = E.id;
    } else g = (await t.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(_, n, o || null, i, c, u || null).run()).meta.last_row_id;
    return e.json({ success: true, data: { id: g, isUpdate: !!E } });
  } catch (s) {
    return console.error("[API /api/cart POST] Error:", s), console.error("[API /api/cart POST] Error message:", s.message), console.error("[API /api/cart POST] Error stack:", s.stack), e.json({ success: false, error: "Failed to add to cart: " + (s.message || "Unknown error") }, 500);
  }
});
d.delete("/api/cart/:cartItemId", async (e) => {
  const { DB: t } = e.env, s = e.req.param("cartItemId");
  try {
    return await t.prepare("DELETE FROM cart_items WHERE id = ?").bind(s).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/cart/clear/:userId", async (e) => {
  const { DB: t } = e.env, s = e.req.param("userId");
  try {
    return await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(s).run(), e.json({ success: true, message: "\uC7A5\uBC14\uAD6C\uB2C8\uAC00 \uBE44\uC6CC\uC84C\uC2B5\uB2C8\uB2E4." });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/cart/:cartItemId", async (e) => {
  const { DB: t } = e.env, s = e.req.param("cartItemId");
  try {
    const r = await e.req.json(), { quantity: a } = r;
    if (!a || a < 1) return e.json({ success: false, error: "Invalid quantity" }, 400);
    const n = await t.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(s).first();
    return n ? n.stock < a ? e.json({ success: false, error: "Insufficient stock" }, 400) : (await t.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a, s).run(), e.json({ success: true })) : e.json({ success: false, error: "Cart item not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/orders", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = await e.req.json(), { userId: r, cartItemIds: a, shippingInfo: n, items: o, shippingAddress: i, shippingAddressDetail: c, recipientName: u, recipientPhone: l, deliveryMemo: p, totalAmount: _, shippingFee: f, orderNumber: E, paymentKey: g, paymentMethod: h } = s;
    if (o && o.length > 0) {
      const I = [];
      for (const F of o) {
        const de = await t.prepare(`
          SELECT id, name, price, stock 
          FROM products 
          WHERE id = ?
        `).bind(F.productId).first();
        if (!de) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${F.productId})` }, 400);
        if (de.stock < F.quantity) return e.json({ success: false, error: `\uC7AC\uACE0 \uBD80\uC871: ${de.name} (\uB0A8\uC740 \uC7AC\uACE0: ${de.stock}\uAC1C)` }, 400);
        I.push({ product_id: F.productId, option_id: F.optionId || null, quantity: F.quantity, price: F.price, product_name: de.name, product_stock: de.stock });
      }
      const N = Date.now(), x = Math.random().toString(36).substring(2, 8).toUpperCase(), L = E || `ORDER_${N}_${x}`, G = c ? `${i} ${c}` : i, Ae = (await t.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(L, r || null, _ || 0, "pending", "pending", G || null, u || null, l || null, p || null, g || null).run()).meta.last_row_id;
      for (const F of I) await t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ae, F.product_id, F.option_id, F.quantity, F.price, F.product_name).run();
      return e.json({ success: true, data: { orderId: Ae, orderNumber: L, totalAmount: _ } });
    }
    if (!a || a.length === 0) return e.json({ success: false, error: "No items provided" }, 400);
    const w = a.map(() => "?").join(","), y = await t.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${w})
    `).bind(...a).all();
    if (y.results.length === 0) return e.json({ success: false, error: "No items found" }, 400);
    for (const I of y.results) if (I.product_stock < I.quantity) return e.json({ success: false, error: `Insufficient stock for ${I.product_name}` }, 400);
    const D = y.results.reduce((I, N) => I + N.price_snapshot * N.quantity, 0), k = `ORD${Date.now()}${Math.floor(Math.random() * 1e3)}`, A = (await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(k, r, D, n.address, n.name, n.phone).run()).meta.last_row_id, C = [];
    for (const I of y.results) {
      let N = false, x = "";
      for (let L = 0; L < 3; L++) {
        if ((await t.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND stock >= ?
            AND is_active = 1
        `).bind(I.quantity, I.product_id, I.quantity).run()).meta.changes > 0) {
          N = true;
          break;
        }
        const X = await t.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(I.product_id).first();
        if (!X || X.stock < I.quantity) {
          x = `\uC7AC\uACE0 \uBD80\uC871: ${I.product_name} (\uB0A8\uC740 \uC7AC\uACE0: ${(X == null ? void 0 : X.stock) || 0}\uAC1C)`;
          break;
        }
        L < 2 ? await new Promise((Ae) => setTimeout(Ae, 50 * L)) : x = "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958 \uBC1C\uC0DD. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694. (\uB3D9\uC2DC\uC131 \uCDA9\uB3CC)";
      }
      if (!N) return e.json({ success: false, error: x || "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, x.includes("\uC7AC\uACE0 \uBD80\uC871") ? 400 : 409);
      C.push(t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(A, I.product_id, I.option_id, I.quantity, I.price_snapshot, I.product_name));
    }
    C.push(t.prepare(`DELETE FROM cart_items WHERE id IN (${w})`).bind(...a)), await t.batch(C);
    try {
      const I = /* @__PURE__ */ new Set();
      for (const N of y.results) {
        const x = await t.prepare("SELECT seller_id FROM products WHERE id = ?").bind(N.product_id).first();
        x && x.seller_id && I.add(x.seller_id);
      }
      for (const N of I) await tt(t, N, k, buyerName || shippingName || "\uACE0\uAC1D", D);
    } catch (I) {
      console.error("[Order] Notification error:", I);
    }
    return e.json({ success: true, data: { orderId: A, orderNumber: k, totalAmount: D } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/streams/:streamId/current-product", async (e) => {
  const { DB: t, LIVE_CACHE: s } = e.env, r = e.req.param("streamId");
  try {
    const a = `current-product:${r}`, n = await $s(s, a, 3);
    if (n) return e.json({ success: true, data: n });
    const o = await t.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();
    if (!o || !o.current_product_id) return await ze(s, a, null, 3), e.json({ success: true, data: null });
    const i = await t.prepare("SELECT * FROM products WHERE id = ?").bind(o.current_product_id).first(), c = await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(), u = { product: i, options: c.results };
    return await ze(s, a, u, 3), e.json({ success: true, data: u });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/streams/:streamId/product-wait", async (e) => {
  const { LIVE_CACHE: t } = e.env, s = e.req.param("streamId"), r = e.req.query("lastTimestamp") || "0";
  try {
    const a = `product-timestamp:${s}`, n = `current-product:${s}`, o = 25e3, i = Date.now();
    for (; Date.now() - i < o; ) {
      const c = await t.get(a) || "0";
      if (c !== r) {
        const u = await $s(t, n, 30);
        return e.json({ success: true, timestamp: c, data: u, changed: true });
      }
      await new Promise((u) => setTimeout(u, 1e3));
    }
    return e.json({ success: true, timestamp: r, data: null, changed: false });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/seller/streams", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = s.sellerId, a = await t.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (r) {
    return console.error("Error loading seller streams:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/streams", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { title: r, description: a, youtube_video_id: n, youtube_url: o, thumbnail_url: i, scheduled_at: c, status: u, seller_instagram: l, seller_youtube: p, seller_facebook: _ } = await e.req.json();
    let f = n, E = "youtube", g = null, h = null, w = i;
    if (o && !f && (f = Ks(o), !f)) if (f = Ys(o), g = Vs(o), h = lt(o), f) E = "tiktok";
    else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok live stream URL." }, 400);
    if (!w && f && E === "youtube" && (w = `https://img.youtube.com/vi/${f}/maxresdefault.jpg`), !r || !f) return e.json({ success: false, error: "Title and live stream URL are required" }, 400);
    const y = await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, f, u || "scheduled", c || null, s.sellerId, l || null, p || null, _ || null, E, g, h, w || null).run(), D = await t.prepare("SELECT * FROM live_streams WHERE id = ?").bind(y.meta.last_row_id).first(), k = await t.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(s.sellerId).first();
    try {
      const { sendLiveStreamCreatedEmail: T } = await Promise.resolve().then(() => Et);
      T({ streamId: y.meta.last_row_id, title: r, sellerName: (k == null ? void 0 : k.display_name) || (k == null ? void 0 : k.username) || "\uC54C \uC218 \uC5C6\uC74C", platform: E, scheduledAt: c, status: u || "scheduled" }).then((A) => {
        A.success ? console.log(`[Email] Live stream notification sent for stream #${A.meta.last_row_id}`) : console.error("[Email] Failed to send notification:", A.error);
      }).catch((A) => {
        console.error("[Email] Exception while sending notification:", A);
      });
    } catch (T) {
      console.error("[Email] Failed to send live stream notification:", T);
    }
    return e.json({ success: true, data: D });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/seller/streams/:id", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const { title: n, description: o, youtube_video_id: i, youtube_url: c, scheduled_at: u, status: l, seller_instagram: p, seller_youtube: _, seller_facebook: f } = await e.req.json(), E = [], g = [];
    if (n !== void 0 && (E.push("title = ?"), g.push(n)), o !== void 0 && (E.push("description = ?"), g.push(o)), c !== void 0 || i !== void 0) {
      let h = i, w = "youtube", y = null;
      if (c && (h = Ks(c), !h)) if (h = Ys(c), y = Vs(c), h) w = "tiktok";
      else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok video URL." }, 400);
      h !== void 0 && (E.push("youtube_video_id = ?"), g.push(h), E.push("platform = ?"), g.push(w), w === "tiktok" && y && (E.push("tiktok_username = ?"), g.push(y)));
    }
    return l !== void 0 && (E.push("status = ?"), g.push(l)), u !== void 0 && (E.push("scheduled_at = ?"), g.push(u)), p !== void 0 && (E.push("seller_instagram = ?"), g.push(p)), _ !== void 0 && (E.push("seller_youtube = ?"), g.push(_)), f !== void 0 && (E.push("seller_facebook = ?"), g.push(f)), E.length === 0 ? e.json({ success: false, error: "No fields to update" }, 400) : (E.push("updated_at = datetime('now')"), await t.prepare(`
      UPDATE live_streams SET ${E.join(", ")} WHERE id = ?
    `).bind(...g, r).run(), e.json({ success: true }));
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/seller/streams/:id", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    return await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first() ? (await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), e.json({ success: true })) : e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/youtube/create-live", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { title: r, description: a, scheduled_at: n } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1 \uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD658\uACBD \uBCC0\uC218\uB97C \uC124\uC815\uD574\uC8FC\uC138\uC694.", help: "wrangler secret put YOUTUBE_ACCESS_TOKEN" }, 400);
    const i = await ot({ accessToken: o }, r, a || ""), u = (await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, i.broadcastId, n || null, s.sellerId, i.broadcastId, i.streamKey).run()).meta.last_row_id;
    return await Be(t, s.sellerId, "seller", "live_created", "\u{1F4FA} YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r} - \uC2A4\uD2B8\uB9BC \uD0A4\uC640 URL\uC744 \uD655\uC778\uD558\uC138\uC694`, `/seller/live-control?streamId=${u}`), e.json({ success: true, data: { streamId: u, broadcastId: i.broadcastId, youtubeVideoId: i.broadcastId, streamKey: i.streamKey, streamUrl: i.streamUrl, watchUrl: `https://www.youtube.com/watch?v=${i.broadcastId}` } });
  } catch (r) {
    return console.error("[YouTube Live] Create broadcast error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/youtube/end-live/:streamId", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("streamId"), a = await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!n) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const o = a.youtube_broadcast_id || a.youtube_video_id;
    return o ? (await it({ accessToken: n }, o), await t.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(), await Be(t, s.sellerId, "seller", "live_ended", "\u2705 YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${a.title} \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, "/seller/streams"), e.json({ success: true, message: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" })) : e.json({ success: false, error: "YouTube Broadcast ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uB3D9\uC73C\uB85C \uC0DD\uC131\uB41C \uB77C\uC774\uBE0C\uC785\uB2C8\uB2E4." }, 400);
  } catch (r) {
    return console.error("[YouTube Live] End broadcast error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/youtube/stats/:streamId", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("streamId"), a = await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = a.youtube_video_id;
    if (!n) return e.json({ success: false, error: "YouTube Video ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_API_KEY, i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o && !i) return e.json({ success: false, error: "YouTube API Key \uB610\uB294 Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await ut({ apiKey: o, accessToken: i }, n);
    return e.json({ success: true, data: { streamId: r, videoId: n, stats: c } });
  } catch (r) {
    return console.error("[YouTube Live] Get stats error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/youtube/chat/:streamId", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("streamId"), a = e.req.query("pageToken"), n = await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = n.youtube_live_chat_id;
    if (!o) return e.json({ success: false, error: "Live Chat ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!i) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await ct({ accessToken: i }, o, a);
    return e.json({ success: true, data: c });
  } catch (r) {
    return console.error("[YouTube Live] Get chat messages error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/admin/streams", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { title: r, description: a, youtube_video_id: n, platform: o, tiktok_username: i, status: c } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const u = o || "youtube";
    if (u === "youtube" && !n) return e.json({ success: false, error: "YouTube \uD50C\uB7AB\uD3FC\uC740 \uC601\uC0C1 ID\uAC00 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    if (u === "tiktok" && !i) return e.json({ success: false, error: "TikTok \uD50C\uB7AB\uD3FC\uC740 \uC0AC\uC6A9\uC790\uBA85\uC774 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const l = await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(r, a || null, n || null, u, i || null, c || "scheduled", s.sellerId || null).run();
    return e.json({ success: true, data: { id: l.meta.last_row_id, title: r, description: a, youtube_video_id: n, platform: u, tiktok_username: i, status: c || "scheduled" } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/admin/streams/:id", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { title: a, description: n, youtube_video_id: o, platform: i, tiktok_username: c, status: u } = await e.req.json();
    return await t.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i || "youtube", c || null, u, r).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/streams/:streamId/change-product", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("streamId"), { productId: a } = await e.req.json();
    if (!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const o = await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_active = 1").bind(a, s.sellerId).first();
    if (!o) return e.json({ success: false, error: "Product not found or not active" }, 404);
    const i = await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(a).all();
    await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a, r).run();
    const { LIVE_CACHE: c } = e.env, u = `product-timestamp:${r}`, l = `current-product:${r}`, p = Date.now().toString();
    return await c.put(u, p), await ze(c, l, { product: o, options: i.results }, 30), e.json({ success: true, data: { product: o, options: i.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/admin/streams/:id", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    return await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/admin/streams/:streamId/change-product", async (e) => {
  const { DB: t } = e.env, s = e.req.param("streamId");
  try {
    const { productId: r } = await e.req.json(), a = await t.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(r).first();
    if (!a) return e.json({ success: false, error: "Product not found" }, 404);
    const n = await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(r).all();
    await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(r, s).run();
    const { LIVE_CACHE: o } = e.env, i = `product-timestamp:${s}`, c = `current-product:${s}`, u = Date.now().toString();
    return await o.put(i, u), await ze(o, c, { product: a, options: n.results }, 30), e.json({ success: true, data: { product: a, options: n.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/wishlists", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { userId: s, productId: r } = await e.req.json();
    if (!s || !r) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uC640 \uC0C1\uD488 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
    if (!await t.prepare("SELECT id FROM users WHERE id = ?").bind(s).first()) return e.json({ success: false, error: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC0AC\uC6A9\uC790\uC785\uB2C8\uB2E4." }, 404);
    const n = await t.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(r).first();
    if (!n) return e.json({ success: false, error: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC0C1\uD488\uC774\uAC70\uB098 \uD310\uB9E4\uAC00 \uC911\uB2E8\uB41C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 404);
    if (await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s, r).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uCC1C\uD55C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 409);
    const i = await t.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(s, r).run();
    return e.json({ success: true, data: { id: i.meta.last_row_id, userId: s, productId: r, productName: n.name } });
  } catch (s) {
    return console.error("[Wishlist] Add error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.delete("/api/wishlists/:id", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), { userId: r } = e.req.query();
    return r ? await t.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(s, r).first() ? (await t.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(s, r).run(), e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (s) {
    return console.error("[Wishlist] Delete error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.delete("/api/wishlists/product/:productId", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("productId"), { userId: r } = e.req.query();
    return r ? (await t.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r, s).run()).meta.changes === 0 ? e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (s) {
    return console.error("[Wishlist] Delete by product error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/wishlists/:userId", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("userId"), r = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0"), { results: n } = await t.prepare(`
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
    `).bind(s, r, a).all(), o = await t.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(s).first();
    return e.json({ success: true, data: { items: n, total: (o == null ? void 0 : o.count) || 0, limit: r, offset: a } });
  } catch (s) {
    return console.error("[Wishlist] Get error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/wishlists/check/:userId/:productId", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("userId"), r = e.req.param("productId"), a = await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s, r).first();
    return e.json({ success: true, data: { isWishlisted: !!a, wishlistId: (a == null ? void 0 : a.id) || null } });
  } catch (s) {
    return console.error("[Wishlist] Check error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.delete("/api/shipping-addresses/:id", $, async (e) => {
  const { DB: t } = e.env, s = e.req.param("id");
  e.get("userId");
  try {
    return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(s, userId).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/products", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env, r = await O(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const a = `seller:${r.sellerId}:products`, n = await s.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(r.sellerId).all();
    return await s.put(a, JSON.stringify(o.results), { expirationTtl: 300 }), e.json({ success: true, data: o.results });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.post("/api/seller/upload-image", async (e) => {
  var r;
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { image: a, filename: n } = await e.req.json();
    if (!a) return e.json({ success: false, error: "Image data is required" }, 400);
    const o = e.env.IMAGES;
    if (o) {
      console.log("[Image Upload] Using R2 storage");
      const i = a.replace(/^data:image\/\w+;base64,/, ""), c = Uint8Array.from(atob(i), (_) => _.charCodeAt(0)), u = (n == null ? void 0 : n.split(".").pop()) || "jpg", l = `products/${s.sellerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${u}`;
      await o.put(l, c, { httpMetadata: { contentType: ((r = a.match(/^data:(image\/\w+);base64,/)) == null ? void 0 : r[1]) || "image/jpeg" } });
      const p = `/api/images/${l}`;
      return e.json({ success: true, url: p, storage: "r2" });
    } else return console.log("[Image Upload] R2 not available, using Base64 fallback"), a.length * 0.75 / (1024 * 1024) > 1 ? e.json({ success: false, error: "Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)" }, 400) : e.json({ success: true, url: a, storage: "base64", warning: "Using Base64 storage. Enable R2 for better performance." });
  } catch (a) {
    return console.error("[Image Upload] Error:", a), e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/images/*", async (e) => {
  var t;
  try {
    const s = e.env.IMAGES;
    if (!s) return e.json({ success: false, error: "R2 not configured" }, 503);
    const r = e.req.path.replace("/api/images/", ""), a = await s.get(r);
    return a ? new Response(a.body, { headers: { "Content-Type": ((t = a.httpMetadata) == null ? void 0 : t.contentType) || "image/jpeg", "Cache-Control": "public, max-age=31536000" } }) : e.notFound();
  } catch (s) {
    return console.error("[Image Get] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/products", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { name: r, description: a, price: n, original_price: o, discount_rate: i, image_url: c, stock: u, category: l, live_stream_id: p, is_active: _ } = await e.req.json();
    if (!r || !n) return e.json({ success: false, error: "Name and price are required" }, 400);
    if (p && !await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(p, s.sellerId).first()) return e.json({ success: false, error: "Live stream not found or unauthorized" }, 404);
    const f = await t.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a || null, n, o || null, i || 0, c || null, u || 0, l || null, p || null, s.sellerId, _ !== void 0 ? _ : 1).run(), E = await t.prepare("SELECT * FROM products WHERE id = ?").bind(f.meta.last_row_id).first();
    return await ls(e.env.CACHE_KV, `seller:${s.sellerId}:products`, `public:seller:${s.sellerId}`), e.json({ success: true, data: E });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/products/:id", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), a = await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(r, s.sellerId).first();
    return a ? e.json({ success: true, data: a }) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/seller/products/:id", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { name: n, description: o, price: i, original_price: c, image_url: u, stock: l, category: p, is_active: _ } = await e.req.json(), f = [], E = [];
    if (n !== void 0 && (f.push("name = ?"), E.push(n)), o !== void 0 && (f.push("description = ?"), E.push(o)), i !== void 0 && (f.push("price = ?"), E.push(i)), c !== void 0 && (f.push("original_price = ?"), E.push(c), i !== void 0 && c)) {
      const h = Math.round((c - i) / c * 100);
      f.push("discount_rate = ?"), E.push(h);
    }
    if (u !== void 0 && (f.push("image_url = ?"), E.push(u)), l !== void 0 && (f.push("stock = ?"), E.push(l)), p !== void 0 && (f.push("category = ?"), E.push(p)), _ !== void 0 && (f.push("is_active = ?"), E.push(_ ? 1 : 0)), f.push("updated_at = CURRENT_TIMESTAMP"), E.push(r, s.sellerId), f.length === 1) return e.json({ success: false, error: "No fields to update" }, 400);
    await t.prepare(`UPDATE products SET ${f.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...E).run();
    const g = await t.prepare("SELECT * FROM products WHERE id = ?").bind(r).first();
    return await ls(e.env.CACHE_KV, `seller:${s.sellerId}:products`, `public:seller:${s.sellerId}`), e.json({ success: true, data: g });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/seller/products/:id", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await t.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();
    return n && n.count > 0 ? e.json({ success: false, error: "\uC774\uBBF8 \uC8FC\uBB38\uB41C \uC0C1\uD488\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD488\uC808 \uCC98\uB9AC\uD558\uAC70\uB098 \uC228\uAE40 \uCC98\uB9AC\uD574\uC8FC\uC138\uC694." }, 400) : (await t.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(), await t.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(), await t.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(), await t.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).run(), await ls(e.env.CACHE_KV, `seller:${s.sellerId}:products`, `public:seller:${s.sellerId}`), e.json({ success: true }));
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/products/:id/options", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await t.prepare("SELECT * FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();
    return e.json({ success: true, data: n.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/products/:id/options", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { option_type: n, option_value: o, price_adjustment: i, stock: c } = await e.req.json();
    if (!n || !o) return e.json({ success: false, error: "Option type and value are required" }, 400);
    const u = await t.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r, n, o, i || 0, c || 0).run();
    return e.json({ success: true, data: { id: u.meta.last_row_id, product_id: r, option_type: n, option_value: o, price_adjustment: i || 0, stock: c || 0 } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/seller/products/:productId/options/:optionId", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("productId"), a = e.req.param("optionId");
    return await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first() ? (await t.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a, r).run(), e.json({ success: true })) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/stats", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env, r = await O(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const a = `seller:${r.sellerId}:stats`, n = await s.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(r.sellerId).first(), i = await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(r.sellerId).first(), c = await t.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(r.sellerId).first(), u = await t.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(r.sellerId).first(), l = await t.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(), _ = { totalProducts: o.count || 0, activeProducts: i.count || 0, totalStock: c.total || 0, totalOrders: u.count || 0, totalRevenue: u.total || 0, activeStreams: l.count || 0, totalViewers: 0 };
    return await s.put(a, JSON.stringify(_), { expirationTtl: 60 }), e.json({ success: true, data: _ });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/seller/stats/sales", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
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
    const i = await t.prepare(`
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
    `).bind(s.sellerId).all();
    return e.json({ success: true, data: { period: r, sales: i.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/stats/products", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = parseInt(e.req.query("limit") || "10"), a = parseInt(e.req.query("days") || "30"), n = await t.prepare(`
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
    `).bind(s.sellerId, r).all();
    return e.json({ success: true, data: { products: n.results, period_days: a } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/business-info", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { business_number: r, business_name: a, ceo_name: n, business_type: o, business_category: i, postal_code: c, address: u, phone: l, email: p } = await e.req.json();
    if (!r || !a || !n) return e.json({ success: false, error: "\uC0AC\uC5C5\uC790\uB4F1\uB85D\uBC88\uD638, \uC0C1\uD638\uBA85, \uB300\uD45C\uC790\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const _ = await t.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(s.sellerId).first();
    let f;
    return _ ? f = await t.prepare(`
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
      `).bind(r, a, n, o, i, c, u, l, p, s.sellerId).run() : f = await t.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(s.sellerId, r, a, n, o, i, c, u, l, p).run(), e.json({ success: true, data: { id: _ ? _.id : f.meta.last_row_id, seller_id: s.sellerId, business_number: r, is_verified: false, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4." } });
  } catch (r) {
    return console.error("\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uB4F1\uB85D \uC624\uB958:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/business-info", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(s.sellerId).first();
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "\uB4F1\uB85D\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/admin/seller-business/:id/verify", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  const r = e.req.param("id"), { verified: a } = await e.req.json();
  try {
    return a ? (await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(), e.json({ success: true, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : (await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(), e.json({ success: true, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uC2B9\uC778\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }));
  } catch (n) {
    return e.json({ success: false, error: n.message }, 500);
  }
});
d.get("/api/admin/seller-business", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = await t.prepare(`
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
d.get("/api/orders", $, async (e) => {
  const { DB: t } = e.env, s = e.get("userId");
  try {
    const r = await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(s).all(), a = await Promise.all(r.results.map(async (n) => {
      const o = await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(n.id).all();
      return { ...n, items: o.results };
    }));
    return e.json({ success: true, data: a });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/orders/user/:userId", $, async (e) => {
  const { DB: t } = e.env, s = e.get("userId"), r = parseInt(e.req.param("userId"));
  try {
    if (r !== s) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC8FC\uBB38 \uB0B4\uC5ED\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const a = await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(s).all(), n = await Promise.all(a.results.map(async (o) => {
      const i = await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(o.id).all();
      return { ...o, items: i.results };
    }));
    return e.json({ success: true, data: n });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/orders/:orderNumber", async (e) => {
  const { DB: t } = e.env, s = e.req.param("orderNumber");
  try {
    const r = await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(s).first();
    if (!r) return e.json({ success: false, error: "Order not found" }, 404);
    const a = await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(r.id).all();
    return e.json({ success: true, data: { ...r, items: a.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/orders/:orderId/cancel", async (e) => {
  const { DB: t } = e.env, s = e.req.param("orderId");
  try {
    const a = (await e.req.json()).reason || "\uC0AC\uC720 \uC5C6\uC74C", n = await t.prepare("SELECT * FROM orders WHERE id = ?").bind(s).first();
    if (!n) return e.json({ success: false, error: "Order not found" }, 404);
    if (n.status !== "pending") return e.json({ success: false, error: "\uACB0\uC81C \uB300\uAE30 \uC911\uC778 \uC8FC\uBB38\uB9CC \uCDE8\uC18C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACB0\uC81C\uAC00 \uC644\uB8CC\uB41C \uC8FC\uBB38\uC740 \uD658\uBD88\uC744 \uC2E0\uCCAD\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(s).all();
    for (const i of o.results) await t.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(i.quantity, i.product_id).run();
    return await t.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled", a, s).run(), e.json({ success: true, message: "Order cancelled successfully", data: { orderId: s, reason: a, itemsRestored: o.results.length } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/streams/:streamId/viewer-count", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("streamId"), r = await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(s).first();
    return r ? e.json({ success: true, data: { viewer_count: r.viewer_count || 0 } }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.put("/api/streams/:streamId/viewer-count", async (e) => {
  const { DB: t } = e.env, s = await M(e), r = s.success ? { success: false } : await O(e);
  if (!s.success && !r.success) return e.json({ success: false, error: "Unauthorized" }, 401);
  try {
    const a = e.req.param("streamId"), { viewer_count: n } = await e.req.json();
    return typeof n != "number" || n < 0 ? e.json({ success: false, error: "Invalid viewer count" }, 400) : r.success && !await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a, r.sellerId).first() ? e.json({ success: false, error: "Stream not found or unauthorized" }, 404) : (await t.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n, a).run(), e.json({ success: true, data: { viewer_count: n } }));
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.post("/api/streams/:streamId/view", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("streamId");
    await t.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(s).run();
    const r = await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(s).first();
    return e.json({ success: true, data: { viewer_count: (r == null ? void 0 : r.viewer_count) || 0 } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/payments/confirm", async (e) => {
  var r;
  const { DB: t } = e.env;
  let s = null;
  try {
    s = await e.req.json();
    const { paymentKey: a, orderId: n, amount: o } = s;
    if (console.log("========================================"), console.log("[Payment] \u{1F680} \uACB0\uC81C \uC2B9\uC778 API \uD638\uCD9C\uB428"), console.log("========================================"), console.log("[Payment] \u{1F4CB} \uC694\uCCAD \uD30C\uB77C\uBBF8\uD130:"), console.log("  - orderId:", n), console.log("  - paymentKey:", a), console.log("  - amount:", o), console.log("  - timestamp:", (/* @__PURE__ */ new Date()).toISOString()), !a || !n || !o) return console.error("[Payment] \u274C \uD544\uC218 \uD30C\uB77C\uBBF8\uD130 \uB204\uB77D!"), console.error("[Payment] paymentKey:", !!a), console.error("[Payment] orderId:", !!n), console.error("[Payment] amount:", !!o), e.json({ success: false, error: "\uD544\uC218 \uD30C\uB77C\uBBF8\uD130\uAC00 \uB204\uB77D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", details: { paymentKey: !!a, orderId: !!n, amount: !!o } }, 400);
    console.log("[Payment] \u2705 \uD544\uC218 \uD30C\uB77C\uBBF8\uD130 \uAC80\uC99D \uD1B5\uACFC");
    const i = await t.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();
    if (!i) return console.error("[Payment] \u274C \uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C:", n), e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uBB38\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uAC70\uB098 \uC774\uBBF8 \uCC98\uB9AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", orderId: n }, 404);
    if (console.log("[Payment] \u2705 \uC8FC\uBB38 \uD655\uC778\uB428:", { id: i.id, order_number: i.order_number, total_amount: i.total_amount, status: i.status }), Number(o) !== Number(i.total_amount)) return console.error("[Payment] \u274C \uAE08\uC561 \uBD88\uC77C\uCE58!", { requested: Number(o), expected: Number(i.total_amount) }), e.json({ success: false, error: "\uACB0\uC81C \uAE08\uC561\uC774 \uC8FC\uBB38 \uAE08\uC561\uACFC \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", requestedAmount: Number(o), expectedAmount: Number(i.total_amount) }, 400);
    const c = e.env.TOSS_SECRET_KEY;
    if (!c) return console.error("[Payment] \u274C TOSS_SECRET_KEY \uD658\uACBD \uBCC0\uC218 \uC5C6\uC74C"), console.error("[Payment] c.env:", Object.keys(e.env || {})), e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    console.log("[Payment] \u2705 TOSS_SECRET_KEY \uD655\uC778\uB428:", c.substring(0, 20) + "..."), console.log("[Payment] \u{1F310} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uD638\uCD9C \uC2DC\uC791..."), console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"), console.log("[Payment] API \uBC84\uC804: 2022-11-16 (\uACB0\uC81C\uC704\uC82F \uACE0\uC815 \uBC84\uC804)");
    const u = "Basic " + btoa(c + ":");
    console.log("[Payment] Authorization \uD5E4\uB354 \uC0DD\uC131 \uC644\uB8CC");
    const l = { orderId: n, amount: Number(o), paymentKey: a };
    console.log("[Payment] \uC694\uCCAD \uBCF8\uBB38:", JSON.stringify(l, null, 2)), console.log("[Payment] \u{1F4CA} amount \uD0C0\uC785:", typeof l.amount), console.log("[Payment] \u{1F4CA} amount \uAC12:", l.amount);
    const p = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: u, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(l) }), _ = await p.json();
    if (console.log("[Payment] \u{1F4E1} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uC751\uB2F5:"), console.log("  - HTTP \uC0C1\uD0DC:", p.status), console.log("  - \uC751\uB2F5 OK?:", p.ok), console.log("  - \uC751\uB2F5 \uB370\uC774\uD130 (\uC77C\uBD80):", JSON.stringify(_).substring(0, 300)), !p.ok) return console.error("[Payment] \u274C\u274C\u274C \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC2B9\uC778 \uC2E4\uD328!"), console.error("[Payment] HTTP \uC0C1\uD0DC:", p.status), console.error("[Payment] \uC5D0\uB7EC \uCF54\uB4DC:", _.code), console.error("[Payment] \uC5D0\uB7EC \uBA54\uC2DC\uC9C0:", _.message), console.error("[Payment] \uC804\uCCB4 \uC751\uB2F5:", JSON.stringify(_, null, 2)), e.json({ success: false, error: _.message || "\uACB0\uC81C \uC2B9\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", code: _.code, tossError: _ }, p.status);
    console.log("[Payment] \u2705 \uACB0\uC81C \uC2B9\uC778 \uC131\uACF5! paymentKey:", a), console.log("[Payment] \u2705 \uC8FC\uBB38 \uBC88\uD638:", n);
    try {
      await t.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a, n).run(), console.log("[Payment] \u2705 \uC8FC\uBB38 \uC0C1\uD0DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC");
      const f = await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();
      for (const E of f.results) (await t.prepare(`
          UPDATE products 
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `).bind(E.quantity, E.product_id, E.quantity).run()).meta.changes === 0 && console.error(`[Payment] \u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871: product_id=${E.product_id}`);
      console.log("[Payment] \u2705 \uC7AC\uACE0 \uCC28\uAC10 \uC644\uB8CC");
    } catch (f) {
      console.error("[Payment] \u26A0\uFE0F DB \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 (\uACB0\uC81C\uB294 \uC131\uACF5):", f);
    }
    return e.json({ success: true, data: _ });
  } catch (a) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328:", { orderId: s == null ? void 0 : s.orderId, error: a.message, stack: (r = a.stack) == null ? void 0 : r.substring(0, 500) }), e.json({ success: false, error: "\uACB0\uC81C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uACE0\uAC1D\uC13C\uD130\uB85C \uBB38\uC758\uD574\uC8FC\uC138\uC694.", details: a.message }, 500);
  }
});
d.post("/api/chat/:liveStreamId/messages", b(), async (e) => {
  const { DB: t } = e.env, s = e.req.param("liveStreamId");
  try {
    const r = await e.req.json(), { userId: a, userName: n, userAvatar: o, message: i, isSeller: c, isAdmin: u } = r;
    if (!i || i.trim().length === 0) return e.json({ success: false, error: "Message cannot be empty" }, 400);
    if (i.length > 500) return e.json({ success: false, error: "Message is too long (max 500 characters)" }, 400);
    if (a && await t.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(s, a).first()) return e.json({ success: false, error: "You are banned from this chat" }, 403);
    const l = ["\uC528\uBC1C", "\uAC1C\uC0C8\uB07C", "\uBCD1\uC2E0", "\uC886", "\uC2DC\uBC1C"];
    let p = i;
    l.forEach((f) => {
      const E = new RegExp(f, "gi");
      p = p.replace(E, "*".repeat(f.length));
    });
    const _ = await t.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(s, a || null, n, o || null, p, c ? 1 : 0, u ? 1 : 0).run();
    return e.json({ success: true, data: { id: _.meta.last_row_id, message: p } });
  } catch (r) {
    return console.error("Error sending chat message:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/chat/:liveStreamId/messages", b(), async (e) => {
  const { DB: t } = e.env, s = e.req.param("liveStreamId"), r = e.req.query("since"), a = Number(e.req.query("limit")) || 50;
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
    const o = [s];
    r && (n += " AND id > ?", o.push(Number(r))), n += " ORDER BY created_at DESC LIMIT ?", o.push(a);
    const c = (await t.prepare(n).bind(...o).all()).results.reverse();
    return e.json({ success: true, data: c });
  } catch (n) {
    return console.error("Error fetching chat messages:", n), e.json({ success: false, error: n.message }, 500);
  }
});
d.delete("/api/chat/:liveStreamId/messages/:messageId", b(), async (e) => {
  const { DB: t } = e.env, s = e.req.param("messageId");
  try {
    return await t.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(s).run(), e.json({ success: true, message: "Message deleted successfully" });
  } catch (r) {
    return console.error("Error deleting chat message:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/chat/:liveStreamId/ban", b(), async (e) => {
  const { DB: t } = e.env, s = e.req.param("liveStreamId");
  try {
    const r = await e.req.json(), { userId: a, bannedBy: n, reason: o, duration: i } = r;
    if (!a || !n) return e.json({ success: false, error: "userId and bannedBy are required" }, 400);
    let c = null;
    if (i) {
      const u = /* @__PURE__ */ new Date();
      u.setMinutes(u.getMinutes() + i), c = u.toISOString();
    }
    return await t.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(s, a, n, o || null, c).run(), e.json({ success: true, message: "User banned successfully" });
  } catch (r) {
    return console.error("Error banning user:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/chat/:liveStreamId/ban/:userId", b(), async (e) => {
  const { DB: t } = e.env, s = e.req.param("liveStreamId"), r = e.req.param("userId");
  try {
    return await t.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(s, r).run(), e.json({ success: true, message: "Ban removed successfully" });
  } catch (a) {
    return console.error("Error removing ban:", a), e.json({ success: false, error: a.message }, 500);
  }
});
d.post("/api/payments/webhook", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = await e.req.json();
    switch (console.log("[Webhook] \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC6F9\uD6C5 \uC218\uC2E0:", { eventType: s.eventType, orderId: s.orderId, status: s.status, timestamp: (/* @__PURE__ */ new Date()).toISOString() }), s.eventType) {
      case "PAYMENT_STATUS_CHANGED":
        await dt(t, s);
        break;
      case "VIRTUAL_ACCOUNT_ISSUED":
        await pt(t, s);
        break;
      default:
        console.log("[Webhook] \uCC98\uB9AC\uD558\uC9C0 \uC54A\uB294 \uC774\uBCA4\uD2B8 \uD0C0\uC785:", s.eventType);
    }
    return e.json({ success: true });
  } catch (s) {
    return console.error("[Webhook] \u274C \uC6F9\uD6C5 \uCC98\uB9AC \uC2E4\uD328:", s.message), e.json({ success: false, error: s.message }, 500);
  }
});
async function dt(e, t) {
  const { orderId: s, status: r, paymentKey: a } = t;
  console.log("[Webhook] \uACB0\uC81C \uC0C1\uD0DC \uBCC0\uACBD:", { orderId: s, status: r }), await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(r, JSON.stringify(t), a).run(), (r === "DONE" || r === "completed") && (await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(s).run(), console.log("[Webhook] \u2705 \uAC00\uC0C1\uACC4\uC88C \uC785\uAE08 \uC644\uB8CC \uCC98\uB9AC:", s));
}
__name(dt, "dt");
__name2(dt, "dt");
async function pt(e, t) {
  const { orderId: s, virtualAccount: r } = t;
  console.log("[Webhook] \uAC00\uC0C1\uACC4\uC88C \uBC1C\uAE09:", { orderId: s, bank: r == null ? void 0 : r.bank, accountNumber: r == null ? void 0 : r.accountNumber }), await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(r == null ? void 0 : r.bank, r == null ? void 0 : r.accountNumber, r == null ? void 0 : r.customerName, r == null ? void 0 : r.dueDate, JSON.stringify(t), s).run(), console.log("[Webhook] \u2705 \uAC00\uC0C1\uACC4\uC88C \uC815\uBCF4 \uC800\uC7A5 \uC644\uB8CC:", s);
}
__name(pt, "pt");
__name2(pt, "pt");
d.post("/api/payments/:paymentKey/cancel", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("paymentKey"), r = await e.req.json(), { cancelReason: a, cancelAmount: n } = r;
    if (console.log("[Payment] \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD:", { paymentKey: s, cancelReason: a, cancelAmount: n }), !a) return e.json({ success: false, error: "\uCDE8\uC18C \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await t.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(s).first();
    if (!o) return e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (o.status === "CANCELED" || o.status === "cancelled") return e.json({ success: false, error: "\uC774\uBBF8 \uCDE8\uC18C\uB41C \uACB0\uC81C\uC785\uB2C8\uB2E4." }, 400);
    const i = o.pg_provider || "tosspayments", c = e.env.TOSS_SECRET_KEY;
    if (!c) return e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    const u = rt(i, c), l = n && n < o.amount, p = n || o.amount;
    console.log("[Payment] PG \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD \uC911...", { pgProvider: i, paymentKey: s, cancelAmount: p, isPartial: l });
    const _ = await u.cancelPayment({ paymentKey: s, cancelReason: a, cancelAmount: p });
    return _.success ? (console.log("[Payment] \u2705 PG \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC:", { paymentKey: s, cancelAmount: p, canceledAt: _.canceledAt }), await t.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED", _.canceledAt || (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(_), s).run(), await t.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(), console.log(`[Payment] \u2705 \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC [${i}]: ${s}`), e.json({ success: true, data: { paymentKey: s, orderId: o.order_id, cancelAmount: p, canceledAt: _.canceledAt, status: "CANCELED" } })) : (console.error(`[Payment] \u274C ${i} \uACB0\uC81C \uCDE8\uC18C \uC2E4\uD328:`, _.error), e.json({ success: false, error: _.error || "\uACB0\uC81C \uCDE8\uC18C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." }, 400));
  } catch (s) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC2E4\uD328:", s.message), e.json({ success: false, error: "\uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
d.get("/api/payments/:paymentKey", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("paymentKey"), r = await t.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(s).first();
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
  } catch (s) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uC870\uD68C \uC2E4\uD328:", s.message), e.json({ success: false, error: "\uACB0\uC81C \uC870\uD68C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
d.get("/api/payments/order/:orderId", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("orderId"), r = await t.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
    `).bind(s).all();
    return e.json({ success: true, data: r.results || [] });
  } catch (s) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", s.message), e.json({ success: false, error: "\uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
d.get("/api/seller/orders", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = await t.prepare(`
      SELECT DISTINCT o.*, u.name as user_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC
    `).bind(s.sellerId).all(), a = await Promise.all(r.results.map(async (n) => {
      const o = await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ? AND oi.seller_id = ?
        `).bind(n.id, s.sellerId).all();
      return { ...n, items: o.results };
    }));
    return e.json({ success: true, data: a });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.patch("/api/seller/orders/:orderNumber/status", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("orderNumber"), { status: a } = await e.req.json();
    if (!["PAY_COMPLETE", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED"].includes(a)) return e.json({ success: false, error: "Invalid status" }, 400);
    const o = await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();
    if (!o) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id, s.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
    if (await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a, r).run(), a === "DELIVERED") try {
      console.log(`[AUTO TAX INVOICE] \uBC30\uC1A1\uC644\uB8CC \uAC10\uC9C0: ${r}, \uC790\uB3D9 \uBC1C\uD589 \uC2DC\uC791...`);
      const c = await t.prepare(`
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
        const u = await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(s.sellerId).first();
        if (!u) console.warn(`[AUTO TAX INVOICE] \uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4 \uBBF8\uC2B9\uC778: seller_id=${s.sellerId}`), await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.', CURRENT_TIMESTAMP)
            `).bind(r, s.sellerId).run();
        else {
          console.log(`[AUTO TAX INVOICE] \uBC1C\uD589 \uC2DC\uC791: orderNumber=${r}`);
          const l = await t.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(), p = Number(c.total_amount), _ = Math.floor(p / 1.1), f = p - _, E = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), g = Math.random().toString(36).substring(2, 8).toUpperCase(), h = `${E}-${g}`, y = (await t.prepare(`
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
            `).bind(s.sellerId, r, h, u.business_number, u.business_name, u.ceo_name, u.address || "", u.business_type || "", u.business_category || "", u.email || "", u.phone || "", c.buyer_business_number, c.buyer_business_name, c.buyer_ceo_name || "", c.buyer_business_address || "", c.buyer_business_type || "", c.buyer_business_category || "", c.buyer_email || "", c.buyer_phone || "", _, f, p, `AUTO-${Date.now()}-${g}`).run()).meta.last_row_id;
          for (const D of l.results) {
            const k = Math.floor(Number(D.price) * Number(D.quantity) / 1.1), T = Number(D.price) * Number(D.quantity) - k;
            await t.prepare(`
                INSERT INTO tax_invoice_items (
                  tax_invoice_id, product_name, quantity, unit_price,
                  supply_price, tax_amount, description, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(y, D.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", D.quantity, D.price, k, T, D.option_name || "").run();
          }
          await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r, s.sellerId, y).run(), console.log(`[AUTO TAX INVOICE] \u2705 \uBC1C\uD589 \uC644\uB8CC: invoice_id=${y}, invoice_number=${h}`);
        }
      } else console.log(`[AUTO TAX INVOICE] \uC77C\uBC18 \uAD6C\uB9E4 (\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uC5C6\uC74C): ${r}`);
    } catch (c) {
      console.error("[AUTO TAX INVOICE] \uBC1C\uD589 \uC2E4\uD328:", c);
      try {
        await t.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(r, s.sellerId, c.message).run();
      } catch (u) {
        console.error("[AUTO TAX INVOICE] \uB85C\uADF8 \uAE30\uB85D \uC2E4\uD328:", u);
      }
    }
    try {
      const c = await t.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(r).first();
      if (c && c.user_id) {
        const l = { PREPARING: "preparing", SHIPPING: "shipping", DELIVERED: "delivered" }[a];
        l && await Ws(t, c.user_id, r, l);
      }
    } catch (c) {
      console.error("[Order Status] Notification error:", c);
    }
    return e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/seller/orders/:orderNumber/tracking", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("orderNumber"), { courier: a, tracking_number: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Courier and tracking number are required" }, 400);
    const o = await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();
    if (!o) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id, s.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
    await t.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a, n, r).run();
    try {
      const c = await t.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(r).first();
      c && c.user_id && await Ws(t, c.user_id, r, "shipping", a, n);
    } catch (c) {
      console.error("[Tracking] Notification error:", c);
    }
    return e.json({ success: true, message: "Tracking information updated" });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/orders/:orderNumber/refund", async (e) => {
  const { DB: t } = e.env, s = e.req.param("orderNumber"), { reason: r } = await e.req.json();
  try {
    const a = await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(s).first();
    return a ? ["paid", "preparing", "shipped", "delivered"].includes(a.status) ? a.status === "refunded" || a.status === "cancelled" ? e.json({ success: false, error: "\uC774\uBBF8 \uD658\uBD88 \uB610\uB294 \uCDE8\uC18C\uB41C \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400) : (await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind("refunded", s).run(), e.json({ success: true, message: "\uD658\uBD88 \uC694\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uACE0\uAC1D\uC13C\uD130(0507-0177-0432)\uC5D0\uC11C \uCC98\uB9AC \uC608\uC815\uC785\uB2C8\uB2E4.", requiresManualProcessing: true })) : e.json({ success: false, error: "\uD658\uBD88\uC774 \uBD88\uAC00\uB2A5\uD55C \uC8FC\uBB38 \uC0C1\uD0DC\uC785\uB2C8\uB2E4." }, 400) : e.json({ success: false, error: "Order not found" }, 404);
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/admin/orders", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = await t.prepare(`
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
d.get("/api/sellers", async (e) => {
  const { DB: t } = e.env, { limit: s = "20", offset: r = "0" } = e.req.query();
  try {
    const a = `
      SELECT id, business_name, name as display_name, 
             commission_rate, created_at
      FROM sellers 
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, { results: n } = await t.prepare(a).bind(parseInt(s), parseInt(r)).all();
    return e.json({ success: true, data: n });
  } catch (a) {
    return console.error("[API] Sellers list error:", a), e.json({ success: false, error: `\uC140\uB7EC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${a.message}` }, 500);
  }
});
d.get("/api/admin/sellers", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = await t.prepare(`
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
d.post("/api/admin/sellers", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { username: r, password: a, name: n, email: o, phone: i, business_name: c, business_number: u } = await e.req.json();
    if (!r || !a || !n || !o || !c) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (await t.prepare("SELECT id FROM sellers WHERE username = ?").bind(r).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC544\uC774\uB514\uC785\uB2C8\uB2E4" }, 400);
    if (await t.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
    const _ = `$2a$10$placeholder_hash_for_${a}`, f = await t.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(r, _, n, o, i || null, c, u || null, s.adminId).run();
    return e.json({ success: true, data: { id: f.meta.last_row_id, username: r, name: n, email: o, business_name: c } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.put("/api/admin/sellers/:id", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { name: a, email: n, phone: o, business_name: i, business_number: c, is_active: u, status: l } = await e.req.json();
    return await t.prepare("SELECT id FROM sellers WHERE id = ?").bind(r).first() ? (await t.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i, c || null, u, l, r).run(), e.json({ success: true })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/admin/sellers/:id", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), a = await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();
    return a ? (await t.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(), await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.username}'\uC758 \uB85C\uADF8\uC778 \uAD8C\uD55C\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4` })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/admin/sellers/:id/reset-password", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { new_password: a } = await e.req.json();
    if (!a || a.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const n = await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = `$2a$10$placeholder_hash_for_${a}`;
    return await t.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o, r).run(), await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.username}'\uC758 \uBE44\uBC00\uBC88\uD638\uAC00 \uC7AC\uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4` });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.patch("/api/admin/sellers/:id/commission", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { commission_rate: a } = await e.req.json();
    if (a == null) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = parseFloat(a);
    if (isNaN(n) || n < 0 || n > 100) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC740 0\uC5D0\uC11C 100 \uC0AC\uC774\uC758 \uAC12\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const o = await t.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(r).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const i = o.commission_rate || 10;
    return await t.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n, r).run(), console.log(`\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD: \uD310\uB9E4\uC790 ${o.username} (ID: ${r}), ${i}% \u2192 ${n}%`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${o.username}'\uC758 \uC218\uC218\uB8CC\uC728\uC774 ${i}%\uC5D0\uC11C ${n}%\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: o.username, old_commission_rate: i, new_commission_rate: n } });
  } catch (r) {
    return console.error("\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.patch("/api/admin/sellers/:id/approve", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), a = await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();
    return a ? a.status === "approved" ? e.json({ success: false, error: "\uC774\uBBF8 \uC2B9\uC778\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400) : (await t.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(s.adminId, r).run(), console.log(`\uC140\uB7EC \uC2B9\uC778: ${a.username} (ID: ${r}) by Admin ID: ${s.adminId}`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.name}'\uB2D8\uC774 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: a.username, seller_name: a.name, status: "approved", approved_at: (/* @__PURE__ */ new Date()).toISOString() } })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uC140\uB7EC \uC2B9\uC778 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.patch("/api/admin/sellers/:id/reject", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { reason: a } = await e.req.json();
    if (!a) return e.json({ success: false, error: "\uAC70\uBD80 \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();
    return n ? n.status === "rejected" ? e.json({ success: false, error: "\uC774\uBBF8 \uAC70\uBD80\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400) : (await t.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, s.adminId, r).run(), console.log(`\uC140\uB7EC \uAC70\uBD80: ${n.username} (ID: ${r}), \uC0AC\uC720: ${a}`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.name}'\uB2D8\uC758 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: n.username, seller_name: n.name, status: "rejected", rejection_reason: a, rejected_at: (/* @__PURE__ */ new Date()).toISOString() } })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uC140\uB7EC \uAC70\uBD80 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/admin/sellers/pending", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = await t.prepare(`
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
d.get("/api/public/seller/:sellerId", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env;
  try {
    const r = e.req.param("sellerId"), a = `public:seller:${r}`, n = await cs(s, a);
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await t.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const i = await t.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(r).all(), c = await t.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(r).all(), u = await t.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(r).all(), l = await t.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(r).first(), p = { profile: o, live_streams: i.results, scheduled_streams: c.results, products: u.results, stats: l };
    return await us(s, a, p, 60), e.json({ success: true, data: p });
  } catch (r) {
    return console.error("\uC140\uB7EC \uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/public/seller/username/:username", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("username"), r = await t.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(s).first();
    return r ? e.json({ success: true, data: { seller_id: r.id } }) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return console.error("\uC140\uB7EC \uC870\uD68C \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/admin/settlement/stats", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
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
    const o = await t.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(seller_amount), 0) as total_seller_amount
      FROM orders o
      WHERE payment_status = 'completed' 
        AND is_cancelled = 0
        ${a}
    `).first(), i = await t.prepare(`
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
d.get("/api/admin/settlement/records", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { seller_id: r, period: a, status: n } = e.req.query();
    let o = ["payment_status = 'completed'", "is_cancelled = 0"];
    const i = [];
    r && (o.push("o.seller_id = ?"), i.push(r)), n && (o.push("o.settlement_status = ?"), i.push(n));
    const c = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const p = c.toISOString().split("T")[0];
        o.push(`DATE(o.created_at) = '${p}'`);
        break;
      case "week":
        const _ = new Date(c.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${_}'`);
        break;
      case "month":
        const f = new Date(c.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${f}'`);
        break;
    }
    const u = o.length > 0 ? `WHERE ${o.join(" AND ")}` : "", l = await t.prepare(`
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
  } catch (r) {
    return console.error("\uC815\uC0B0 \uB0B4\uC5ED \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.patch("/api/admin/settlement/:orderId/status", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("orderId"), { status: a } = await e.req.json();
    if (!["pending", "completed"].includes(a)) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC815\uC0B0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4" }, 400);
    const n = await t.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(r).first();
    return n ? (await t.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a === "completed" ? "datetime('now')" : "NULL"}
      WHERE id = ?
    `).bind(a, r).run(), console.log(`\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD: \uC8FC\uBB38 ${n.order_number}, ${n.settlement_status} \u2192 ${a}`), e.json({ success: true, message: `\uC815\uC0B0 \uC0C1\uD0DC\uAC00 '${a}'\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { order_id: r, order_number: n.order_number, old_status: n.settlement_status, new_status: a } })) : e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/admin/settlement/batch-complete", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { order_ids: r } = await e.req.json();
    if (!Array.isArray(r) || r.length === 0) return e.json({ success: false, error: "\uC8FC\uBB38 ID \uBC30\uC5F4\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    let a = 0, n = 0;
    for (const o of r) try {
      await t.prepare(`
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
d.get("/api/admin/settlement/export-csv", async (e) => {
  const { DB: t } = e.env, s = await M(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { seller_id: r, period: a } = e.req.query();
    let n = ["payment_status = 'completed'", "is_cancelled = 0"];
    const o = [];
    r && (n.push("o.seller_id = ?"), o.push(r));
    const i = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const E = i.toISOString().split("T")[0];
        n.push(`DATE(o.created_at) = '${E}'`);
        break;
      case "week":
        const g = new Date(i.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${g}'`);
        break;
      case "month":
        const h = new Date(i.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${h}'`);
        break;
    }
    const c = n.length > 0 ? `WHERE ${n.join(" AND ")}` : "", l = (await t.prepare(`
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
    let _ = p.join(",") + `
`;
    l.forEach((E) => {
      const g = p.map((h) => {
        const w = E[h];
        if (w == null) return "";
        const y = String(w);
        return y.includes(",") || y.includes('"') || y.includes(`
`) ? `"${y.replace(/"/g, '""')}"` : y;
      });
      _ += g.join(",") + `
`;
    });
    const f = "\uFEFF";
    return new Response(f + _, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${a || "all"}_${Date.now()}.csv"` } });
  } catch (r) {
    return console.error("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/orders/create", async (e) => {
  const { DB: t } = e.env;
  try {
    const { userId: s, cartItems: r, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i, buyerBusinessNumber: c, buyerBusinessName: u, buyerCeoName: l } = await e.req.json();
    console.log("\uC8FC\uBB38 \uC0DD\uC131 \uC694\uCCAD:", { userId: s, cartItems: r == null ? void 0 : r.length, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i });
    let p = 10;
    if (o) {
      const T = await t.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();
      T && T.commission_rate !== null && (p = T.commission_rate);
    }
    console.log("\uC218\uC218\uB8CC\uC728:", { sellerId: o, commissionRate: p });
    const _ = Math.floor(a * (p / 100)), f = a - _;
    let E = null;
    if (n) {
      const T = await t.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(n, s).first();
      if (!T) return e.json({ success: false, error: "\uBC30\uC1A1\uC9C0 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
      E = T;
    }
    if (!s) return e.json({ success: false, error: "User ID is required. Please login with Kakao first." }, 401);
    const g = s, h = Date.now(), w = Math.random().toString(36).substring(2, 8).toUpperCase(), y = `ORDER_${h}_${w}`;
    for (const T of r) {
      const A = await t.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(T.product_id).first();
      if (!A) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${T.product_id})` }, 400);
      if (A.stock < T.quantity) return e.json({ success: false, error: `\uC7AC\uACE0\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4 (\uC0C1\uD488 ID: ${T.product_id})` }, 400);
    }
    const k = (await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(y, g, a, "pending", o || null, p, _, f, n || null, (E == null ? void 0 : E.recipient_name) || null, (E == null ? void 0 : E.phone) || null, E != null && E.address ? `${E.address} ${E.address_detail}` : null, (E == null ? void 0 : E.postal_code) || null, i ? 1 : 0, c || null, u || null, l || null).run()).meta.last_row_id;
    for (const T of r) {
      await t.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(k, T.product_id, T.option_id || null, T.quantity, T.price_snapshot || T.price).run(), await t.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(T.quantity, T.product_id).run();
      try {
        const A = await t.prepare(`
          SELECT id, name, stock, stock_alert_threshold, seller_id 
          FROM products 
          WHERE id = ?
        `).bind(T.product_id).first();
        if (A) {
          const C = A.stock_alert_threshold || 5, I = A.stock;
          I <= C && A.seller_id && (await at(t, A.seller_id, A.name, I, C), console.log(`[Low Stock Alert] ${A.name}: ${I} <= ${C}`));
        }
      } catch (A) {
        console.error("[Low Stock Alert] Error:", A);
      }
    }
    return console.log("\uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC:", { orderId: k, orderNumber: y }), e.json({ success: true, orderId: k, orderNumber: y, totalAmount: a });
  } catch (s) {
    return console.error("\uC8FC\uBB38 \uC0DD\uC131 \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/orders/:orderNumber/refund", b(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("orderNumber"), { reason: r } = await e.req.json();
    console.log("[Order Refund] \uD658\uBD88 \uC694\uCCAD:", { orderNumber: s, reason: r });
    const a = await t.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(s).first();
    if (!a) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (a.payment_status === "cancelled") return e.json({ success: false, error: "\uC774\uBBF8 \uCDE8\uC18C\uB41C \uC8FC\uBB38\uC785\uB2C8\uB2E4" }, 400);
    await t.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r || "\uAD6C\uB9E4\uC790 \uC694\uCCAD", s).run(), console.log("[Order Refund] \uC8FC\uBB38 \uC0C1\uD0DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC:", s);
    const n = await t.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();
    for (const o of n.results) await t.prepare(`
        UPDATE products 
        SET stock = stock + ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(o.quantity, o.product_id).run(), console.log("[Order Refund] \uC7AC\uACE0 \uBCF5\uAD6C:", { productId: o.product_id, quantity: o.quantity });
    return console.log("[Order Refund] \u2705 \uD658\uBD88 \uC644\uB8CC:", { orderNumber: s, reason: r }), e.json({ success: true, message: "\uC8FC\uBB38\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: { orderNumber: s, cancelDate: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (s) {
    return console.error("[Order Refund] Error:", s), e.json({ success: false, error: s.message || "\uC8FC\uBB38 \uCDE8\uC18C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
d.get("/api/seller/sales", b(), async (e) => {
  try {
    const { DB: t } = e.env, s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const r = await Ne(e.env.SESSION_KV, s);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (r.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = r.seller_id || r.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], u = await t.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(a).first();
    if (!u) return e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const l = await t.prepare(`
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
    `).bind(a, i, c).first(), p = await t.prepare(`
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
  } catch (t) {
    return console.error("Seller sales query error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.get("/api/seller/settlement-csv", b(), async (e) => {
  try {
    const { DB: t } = e.env, s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const r = await Ne(e.env.SESSION_KV, s);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (r.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = r.seller_id || r.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], u = await t.prepare(`
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
      const _ = p.status === "delivered" ? "\uBC30\uC1A1\uC644\uB8CC" : p.status === "shipped" ? "\uBC30\uC1A1\uC911" : p.status === "preparing" ? "\uC0C1\uD488\uC900\uBE44\uC911" : p.status === "paid" ? "\uACB0\uC81C\uC644\uB8CC" : "\uB300\uAE30\uC911", f = p.buyer_business_name || "-", E = p.buyer_business_number || "-", g = p.invoice_number || "-", h = p.issue_date || "-", w = p.tax_invoice_status === "issued" ? "\uBC1C\uD589\uC644\uB8CC" : p.tax_invoice_status === "cancelled" ? "\uCDE8\uC18C" : "-", y = p.nts_confirm_number || "-";
      l += `${p.order_number},${p.created_at},${p.user_name || "\uC775\uBA85"},${p.total_amount},${p.commission_amount},${p.seller_amount},${_},${f},${E},${g},${h},${w},${y}
`;
    }
    return new Response(l, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${i}_${c}.csv"` } });
  } catch (t) {
    return console.error("CSV download error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
d.post("/api/seller/tax-invoices/issue", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { order_number: r } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uC8FC\uBB38\uBC88\uD638\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const a = await t.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(r).first();
    if (!a) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (!a.issue_tax_invoice) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589\uC774 \uC694\uCCAD\uB418\uC9C0 \uC54A\uC740 \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400);
    const n = await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(s.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC2B9\uC778\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778\uC744 \uAE30\uB2E4\uB824\uC8FC\uC138\uC694." }, 400);
    const o = await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(), i = Number(a.total_amount), c = Math.floor(i / 1.1), u = i - c, l = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], p = `${l}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, _ = Wr(n, a, o.results);
    let f, E, g;
    try {
      f = await Br(_), E = f.ntsConfirmNumber, g = f.invoiceKey, console.log("\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC131\uACF5:", { ntsConfirmNumber: E, invoiceKey: g, mockMode: Le() });
    } catch (y) {
      console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", y), E = "FAILED", g = null;
    }
    const w = (await t.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s.sellerId, r, "tax", p, l, n.business_number, n.business_name, n.ceo_name, n.address, n.business_type, n.business_category, a.buyer_business_number, a.buyer_business_name, a.buyer_ceo_name, c, u, i, E === "FAILED" ? "failed" : "issued", Le() ? "mock" : "barobill", g, E).run()).meta.last_row_id;
    for (const y of o.results) {
      const D = Math.floor(Number(y.price) * Number(y.quantity) / 1.1), k = Number(y.price) * Number(y.quantity) - D;
      await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(w, y.id, y.product_name, y.quantity, y.price, D, k).run();
    }
    return e.json({ success: true, data: { invoice_id: w, invoice_number: p, issue_date: l, total_amount: i, supply_price: c, tax_amount: u, status: E === "FAILED" ? "failed" : "issued", nts_confirm_number: E, api_invoice_key: g, mock_mode: Le(), message: E === "FAILED" ? "\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328. \uB098\uC911\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694." : Le() ? "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (Mock Mode - \uC2E4\uC81C \uBC1C\uD589 \uC544\uB2D8)" : "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4." } });
  } catch (r) {
    return console.error("\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC624\uB958:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/tax-invoices", async (e) => {
  var r;
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { start_date: a, end_date: n, status: o } = e.req.query();
    let i = `
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;
    const c = [s.sellerId];
    a && (i += " AND issue_date >= ?", c.push(a)), n && (i += " AND issue_date <= ?", c.push(n)), o && (i += " AND status = ?", c.push(o)), i += " ORDER BY created_at DESC";
    const u = await t.prepare(i).bind(...c).all();
    return e.json({ success: true, data: u.results || [], total: ((r = u.results) == null ? void 0 : r.length) || 0 });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
d.get("/api/seller/tax-invoices/:id", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), a = await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r, s.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = await t.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(r).all();
    return e.json({ success: true, data: { ...a, items: n.results || [] } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/tax-invoices/:id/cancel", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { reason: a } = await e.req.json(), n = await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r, s.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const o = new Date(n.issue_date), i = new Date(o);
    if (i.setDate(i.getDate() + 1), /* @__PURE__ */ new Date() > i) return e.json({ success: false, error: "\uBC1C\uD589\uC77C \uC775\uC77C\uAE4C\uC9C0\uB9CC \uCDE8\uC18C \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 400);
    try {
      if (n.api_invoice_key && !Le()) {
        const u = await t.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(s.sellerId).first();
        u && u.business_number && await $r(u.business_number, n.api_invoice_key, a || "\uD310\uB9E4\uC790 \uC694\uCCAD");
      }
    } catch (u) {
      console.error("\uBC14\uB85C\uBE4C \uCDE8\uC18C API \uD638\uCD9C \uC2E4\uD328:", u);
    }
    return await t.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(), e.json({ success: true, message: "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/tax-invoices/auto-issue-logs", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
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
    const o = [s.sellerId];
    r && (n += " AND log.status = ?", o.push(r)), n += " ORDER BY log.created_at DESC LIMIT ?", o.push(Number(a));
    const i = await t.prepare(n).bind(...o).all();
    return e.json({ success: true, data: i.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.post("/api/seller/tax-invoices/retry/:orderNumber", async (e) => {
  const { DB: t } = e.env, s = await O(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("orderNumber");
    console.log(`[TAX INVOICE RETRY] \uC7AC\uC2DC\uB3C4 \uC2DC\uC791: ${r}`);
    const a = await t.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(r, s.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uC7AC\uC2DC\uB3C4\uD560 \uC2E4\uD328 \uB85C\uADF8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = Number(a.retry_count || 0);
    if (n >= 3) return e.json({ success: false, error: "\uCD5C\uB300 \uC7AC\uC2DC\uB3C4 \uD69F\uC218(3\uD68C)\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4." }, 400);
    const o = await t.prepare(`
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
    const i = await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(s.sellerId).first();
    if (!i) return e.json({ success: false, error: "\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const c = await t.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(), u = Number(o.total_amount), l = Math.floor(u / 1.1), p = u - l, _ = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), f = Math.random().toString(36).substring(2, 8).toUpperCase(), E = `${_}-${f}`, h = (await t.prepare(`
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
    `).bind(s.sellerId, r, E, i.business_number, i.business_name, i.ceo_name, i.address || "", i.business_type || "", i.business_category || "", i.email || "", i.phone || "", o.buyer_business_number, o.buyer_business_name, o.buyer_ceo_name || "", o.buyer_business_address || "", o.buyer_business_type || "", o.buyer_business_category || "", o.buyer_email || "", o.buyer_phone || "", l, p, u, `RETRY-${Date.now()}-${f}`).run()).meta.last_row_id;
    for (const w of c.results) {
      const y = Math.floor(Number(w.price) * Number(w.quantity) / 1.1), D = Number(w.price) * Number(w.quantity) - y;
      await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(h, w.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", w.quantity, w.price, y, D, w.option_name || "").run();
    }
    return await t.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(r, s.sellerId, h, n + 1).run(), await t.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n + 1, a.id).run(), console.log(`[TAX INVOICE RETRY] \u2705 \uC7AC\uC2DC\uB3C4 \uC131\uACF5: invoice_id=${h}, retry_count=${n + 1}`), e.json({ success: true, data: { invoice_id: h, invoice_number: E, retry_count: n + 1 } });
  } catch (r) {
    console.error("[TAX INVOICE RETRY] \uC7AC\uC2DC\uB3C4 \uC2E4\uD328:", r);
    try {
      const a = e.req.param("orderNumber"), n = await t.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a, s.sellerId).first(), o = Number((n == null ? void 0 : n.retry_count) || 0);
      await t.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a, s.sellerId, r.message, o + 1).run();
    } catch (a) {
      console.error("[TAX INVOICE RETRY] \uB85C\uADF8 \uAE30\uB85D \uC2E4\uD328:", a);
    }
    return e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/live/:id", async (e) => {
  try {
    const t = new URL("/static/live.html", e.req.url);
    let r = await (await fetch(t.toString())).text();
    const n = `<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY || "975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;
    return r = r.replace("<!-- Scripts -->", `<!-- Scripts -->
    ${n}`), console.log("[Live Page] Environment variables injected"), new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving live page:", t), new Response("<h1>Error loading live page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
d.get("/cart", async (e) => {
  try {
    const t = new URL("/static/cart.html", e.req.url);
    let r = await (await fetch(t.toString())).text();
    return r = r.replace("%%NICEPAY_CLIENT_ID%%", e.env.NICEPAY_CLIENT_ID || "S2_d5ec29558e9d46419bf01eb828ca0834"), r = r.replace("%%NICEPAY_MID%%", e.env.NICEPAY_MID || "nictest00m"), new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving cart page:", t), new Response("<h1>Error loading cart page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
d.get("/my-orders", async (e) => {
  try {
    const t = new URL("/static/my-orders.html", e.req.url), r = await (await fetch(t.toString())).text();
    return new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving my orders page:", t), new Response("<h1>Error loading orders page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
d.get("/payment-result", async (e) => {
  try {
    const t = new URL("/payment-result.html", e.req.url), r = await (await fetch(t.toString())).text();
    return new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving payment result page:", t), new Response("<h1>Error loading payment result page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
d.get("/api/seller/profile", async (e) => {
  const { DB: t } = e.env, s = e.req.header("X-Session-Token");
  if (!s) return e.json({ success: false, error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const r = await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(s).first();
    if (!r || !r.seller_id) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await t.prepare(`
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
d.patch("/api/seller/profile", async (e) => {
  const { DB: t } = e.env, s = e.req.header("X-Session-Token");
  if (!s) return e.json({ success: false, error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const r = await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(s).first();
    if (!r || !r.seller_id) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const { profile_image: a, bio: n, sns_instagram: o, sns_youtube: i, sns_facebook: c, sns_twitter: u, website_url: l, kakao_chat_link: p } = await e.req.json(), _ = [], f = [];
    if (a !== void 0 && (_.push("profile_image = ?"), f.push(a)), n !== void 0 && (_.push("bio = ?"), f.push(n)), o !== void 0 && (_.push("sns_instagram = ?"), f.push(o)), i !== void 0 && (_.push("sns_youtube = ?"), f.push(i)), c !== void 0 && (_.push("sns_facebook = ?"), f.push(c)), u !== void 0 && (_.push("sns_twitter = ?"), f.push(u)), l !== void 0 && (_.push("website_url = ?"), f.push(l)), p !== void 0 && (_.push("kakao_chat_link = ?"), f.push(p)), _.length === 0) return e.json({ success: false, error: "\uC218\uC815\uD560 \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    _.push("updated_at = datetime('now')"), f.push(r.seller_id), await t.prepare(`
      UPDATE sellers 
      SET ${_.join(", ")}
      WHERE id = ?
    `).bind(...f).run();
    const E = await t.prepare(`
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
    return e.json({ success: true, message: "\uD504\uB85C\uD544\uC774 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: E });
  } catch (r) {
    return console.error("\uD504\uB85C\uD544 \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/public/:sellerId", async (e) => {
  const { DB: t } = e.env, s = e.req.param("sellerId");
  try {
    const r = await t.prepare(`
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
    `).bind(s).first();
    return r ? e.json({ success: true, data: r }) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uC140\uB7EC \uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/:sellerId/streams", async (e) => {
  const { DB: t } = e.env, s = e.req.param("sellerId");
  try {
    const r = await t.prepare(`
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
    `).bind(s).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return console.error("\uB77C\uC774\uBE0C \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/seller/:sellerId/products-public", async (e) => {
  const { DB: t } = e.env, s = e.req.param("sellerId");
  try {
    const r = await t.prepare(`
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
    `).bind(s).all();
    return e.json({ success: true, data: r.results });
  } catch (r) {
    return console.error("\uC0C1\uD488 \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/notifications", $, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.get("userId"), r = e.get("userType"), a = parseInt(e.req.query("limit") || "50"), n = e.req.query("unread_only") === "true";
    let o = `
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;
    n && (o += " AND is_read = 0"), o += " ORDER BY created_at DESC LIMIT ?";
    const i = await t.prepare(o).bind(s, r, a).all();
    return e.json({ success: true, data: i.results });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/notifications/unread-count", $, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.get("userId"), r = e.get("userType"), a = await t.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(s, r).first();
    return e.json({ success: true, count: (a == null ? void 0 : a.count) || 0 });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.put("/api/notifications/:id/read", $, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), r = e.get("userId"), a = e.get("userType");
    return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s, r, a).first() ? (await t.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(s).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.put("/api/notifications/read-all", $, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.get("userId"), r = e.get("userType");
    return await t.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(s, r).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.delete("/api/notifications/:id", $, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), r = e.get("userId"), a = e.get("userType");
    return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s, r, a).first() ? (await t.prepare("DELETE FROM notifications WHERE id = ?").bind(s).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/banners", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = (/* @__PURE__ */ new Date()).toISOString(), r = await t.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(s, s).all();
    return e.json({ success: true, data: r.results });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/admin/banners", $, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const r = await t.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();
    return e.json({ success: true, data: r.results });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/admin/banners", $, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const { title: r, image_url: a, link_url: n, description: o, is_active: i, display_order: c, start_date: u, end_date: l } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "\uC81C\uBAA9\uACFC \uC774\uBBF8\uC9C0\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const p = await t.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a, n || null, o || null, i !== false ? 1 : 0, c || 0, u || null, l || null).run();
    return e.json({ success: true, id: p.meta.last_row_id });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.put("/api/admin/banners/:id", $, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const r = e.req.param("id"), { title: a, image_url: n, link_url: o, description: i, is_active: c, display_order: u, start_date: l, end_date: p } = await e.req.json();
    return await t.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a, n, o || null, i || null, c ? 1 : 0, u || 0, l || null, p || null, r).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.delete("/api/admin/banners/:id", $, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const r = e.req.param("id");
    return await t.prepare("DELETE FROM banners WHERE id = ?").bind(r).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/order-complete", (e) => e.redirect("/order-complete.html", 302));
d.notFound((e) => {
  const t = e.req.path;
  return t.startsWith("/api/") ? e.json({ success: false, error: "Not found", message: `The requested endpoint ${t} was not found.` }, 404) : new Response(null, { status: 404 });
});
d.onError((e, t) => {
  const s = t.req.path;
  if (console.error("[Global Error Handler]", { path: s, method: t.req.method, error: e.message, stack: e.stack }), s.startsWith("/api/")) {
    let r = 500, a = "Internal Server Error";
    return e.message.includes("Unauthorized") || e.message.includes("\uB85C\uADF8\uC778") ? (r = 401, a = "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uB85C\uADF8\uC778\uD574\uC8FC\uC138\uC694.") : e.message.includes("Forbidden") || e.message.includes("\uAD8C\uD55C") ? (r = 403, a = "\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.") : e.message.includes("Not found") || e.message.includes("\uCC3E\uC744 \uC218 \uC5C6") ? (r = 404, a = "\uC694\uCCAD\uD558\uC2E0 \uB9AC\uC18C\uC2A4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.") : (e.message.includes("Bad request") || e.message.includes("\uC798\uBABB\uB41C")) && (r = 400, a = "\uC798\uBABB\uB41C \uC694\uCCAD\uC785\uB2C8\uB2E4."), t.json({ success: false, error: e.message || a }, r);
  }
  return t.html(`
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
d.get("/api/admin/alimtalk/pricing", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = await t.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();
    return e.json({ success: true, pricing: s.results });
  } catch (s) {
    return console.error("[Admin Alimtalk Pricing] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/admin/alimtalk/pricing", b(), async (e) => {
  const { env: t } = e;
  try {
    const { plan_name: s, min_quantity: r, max_quantity: a, unit_price: n } = await e.req.json();
    if (!s || !r || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = await t.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(s, r, a || null, n).run();
    return e.json({ success: true, pricing_id: o.meta.last_row_id });
  } catch (s) {
    return console.error("[Admin Alimtalk Pricing Create] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.put("/api/admin/alimtalk/pricing/:id", b(), async (e) => {
  const { env: t } = e, s = e.req.param("id");
  try {
    const { plan_name: r, min_quantity: a, max_quantity: n, unit_price: o, is_active: i } = await e.req.json();
    return (await t.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r, a, n || null, o, i ? 1 : 0, s).run()).meta.changes === 0 ? e.json({ success: false, error: "Pricing not found" }, 404) : e.json({ success: true, message: "Pricing updated successfully" });
  } catch (r) {
    return console.error("[Admin Alimtalk Pricing Update] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.delete("/api/admin/alimtalk/pricing/:id", b(), async (e) => {
  const { env: t } = e, s = e.req.param("id");
  try {
    return (await t.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(s).run()).meta.changes === 0 ? e.json({ success: false, error: "Pricing not found" }, 404) : e.json({ success: true, message: "Pricing deleted successfully" });
  } catch (r) {
    return console.error("[Admin Alimtalk Pricing Delete] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/admin/alimtalk/accounts", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = await t.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();
    return e.json({ success: true, accounts: s.results });
  } catch (s) {
    return console.error("[Admin Alimtalk Accounts] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.patch("/api/admin/alimtalk/accounts/:id/status", b(), async (e) => {
  const { env: t } = e, s = e.req.param("id");
  try {
    const { status: r } = await e.req.json();
    return ["active", "suspended", "rejected"].includes(r) ? (await t.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r, s).run()).meta.changes === 0 ? e.json({ success: false, error: "Account not found" }, 404) : e.json({ success: true, message: `Account ${r} successfully` }) : e.json({ success: false, error: "Invalid status" }, 400);
  } catch (r) {
    return console.error("[Admin Alimtalk Account Status] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
d.get("/api/admin/alimtalk/statistics", b(), async (e) => {
  const { env: t } = e;
  try {
    const { start_date: s, end_date: r } = e.req.query(), a = await t.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_revenue
      FROM alimtalk_messages
      WHERE created_at >= ? AND created_at <= ?
    `).bind(s || "2000-01-01", r || "2100-01-01").first(), n = await t.DB.prepare(`
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
    `).bind(s || "2000-01-01", r || "2100-01-01").all();
    return e.json({ success: true, statistics: { total: a, by_seller: n.results } });
  } catch (s) {
    return console.error("[Admin Alimtalk Statistics] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/seller/alimtalk/account", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await Q(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const a = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(r.user_id).first();
    return e.json({ success: true, account: a });
  } catch (s) {
    return console.error("[Seller Alimtalk Account] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/alimtalk/register", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await Q(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { channel_id: a, phone_number: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = Bs(n), i = await Gr(t, { channelId: a, phoneNumber: o });
    if (!i.success) return e.json({ success: false, error: "Failed to register Kakao channel" }, 500);
    const c = await t.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(r.user_id, a, a, i.senderKey, o).run();
    return e.json({ success: true, account_id: c.meta.last_row_id, sender_key: i.senderKey, message: "Kakao channel registered successfully" });
  } catch (s) {
    return console.error("[Seller Alimtalk Register] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/seller/alimtalk/templates", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await Q(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const a = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!a) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const n = await t.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();
    return e.json({ success: true, templates: n.results });
  } catch (s) {
    return console.error("[Seller Alimtalk Templates] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/alimtalk/templates", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await Q(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_code: a, template_name: n, template_content: o, template_type: i } = await e.req.json();
    if (!a || !n || !o) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (!(await Xr(t, c.sender_key, { name: n, content: o, templateCode: a })).success) return e.json({ success: false, error: "Failed to register template" }, 500);
    const l = await t.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id, a, n, o, i || "basic").run();
    return e.json({ success: true, template_id: l.meta.last_row_id, message: "Template registered successfully. Approval pending (1-2 days)" });
  } catch (s) {
    return console.error("[Seller Alimtalk Template Register] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/seller/alimtalk/pricing", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = await t.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();
    return e.json({ success: true, pricing: s.results });
  } catch (s) {
    return console.error("[Seller Alimtalk Pricing] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/alimtalk/charge", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await Q(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { amount: a, pricing_id: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!o) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const i = await t.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();
    if (!i) return e.json({ success: false, error: "Pricing not found" }, 404);
    const c = a * i.unit_price, u = `alimtalk_${o.id}_${Date.now()}`, l = await t.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id, a, c, i.unit_price, u).run(), p = `https://api.tosspayments.com/v1/payment/${u}`;
    return e.json({ success: true, charge_id: l.meta.last_row_id, order_id: u, amount: a, price: c, unit_price: i.unit_price, payment_url: p });
  } catch (s) {
    return console.error("[Seller Alimtalk Charge] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/alimtalk/charge/complete", b(), async (e) => {
  const { env: t } = e;
  try {
    const { order_id: s, payment_id: r } = await e.req.json();
    if (!s) return e.json({ success: false, error: "Missing order_id" }, 400);
    const a = await t.DB.prepare(`
      SELECT * FROM alimtalk_charges WHERE order_id = ? AND payment_status = 'pending'
    `).bind(s).first();
    return a ? (await t.DB.prepare(`
      UPDATE alimtalk_charges 
      SET payment_status = 'completed', 
          payment_id = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r || null, a.id).run(), await t.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a.amount, a.account_id).run(), e.json({ success: true, message: "Charge completed successfully", charged_amount: a.amount })) : e.json({ success: false, error: "Charge not found or already completed" }, 404);
  } catch (s) {
    return console.error("[Seller Alimtalk Charge Complete] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.post("/api/seller/alimtalk/send", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await Q(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_id: a, recipient_phone: n, variables: o, order_id: i } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (c.balance < 1) return e.json({ success: false, error: "Insufficient balance. Please charge first." }, 400);
    const u = await t.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a, c.id).first();
    if (!u) return e.json({ success: false, error: "Template not found or not approved" }, 404);
    const l = Zr(u.template_content, o || {}), p = Bs(n), _ = await Qr(t, { senderKey: c.sender_key, templateCode: u.template_code, to: p, message: l });
    if (!_.success) return await t.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id, a, i || null, p, l, _.error).run(), e.json({ success: false, error: _.error }, 500);
    const f = await t.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id, a, i || null, p, l, 15, _.messageId).run();
    return await t.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(), e.json({ success: true, message_id: f.meta.last_row_id, aligo_message_id: _.messageId, status: "sent", remaining_balance: c.balance - 1 });
  } catch (s) {
    return console.error("[Seller Alimtalk Send] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/seller/alimtalk/messages", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await Q(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { page: a = "1", limit: n = "20", status: o } = e.req.query(), i = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
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
    const p = await t.DB.prepare(u).bind(...l).all(), _ = await t.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();
    return e.json({ success: true, messages: p.results, pagination: { total: _.total, page: parseInt(a), limit: parseInt(n) } });
  } catch (s) {
    return console.error("[Seller Alimtalk Messages] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
d.get("/api/seller/alimtalk/statistics", b(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await Q(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { start_date: a, end_date: n } = e.req.query(), o = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();
    if (!o) return e.json({ success: false, error: "Alimtalk account not found" }, 404);
    const i = await t.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_cost
      FROM alimtalk_messages
      WHERE account_id = ?
        AND created_at >= ?
        AND created_at <= ?
    `).bind(o.id, a || "2000-01-01", n || "2100-01-01").first(), c = await t.DB.prepare(`
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
  } catch (s) {
    return console.error("[Seller Alimtalk Statistics] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
var hs = new xs();
var mt = Object.assign({ "/src/index.tsx": d });
var zs = false;
for (const [, e] of Object.entries(mt)) e && (hs.route("/", e), hs.notFound(e.notFoundHandler), zs = true);
if (!zs) throw new Error("Can't import modules from ['/src/index.tsx']");
async function Gs(e) {
  try {
    const { to: t, subject: s, htmlContent: r, textContent: a } = e, n = await fetch("https://api.mailchannels.net/tx/v1/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: t }] }], from: { email: "noreply@live.ur-team.com", name: "\uC720\uC5B4 \uB77C\uC774\uBE0C" }, subject: s, content: [{ type: "text/html", value: r }, ...a ? [{ type: "text/plain", value: a }] : []] }) });
    if (!n.ok) {
      const o = await n.text();
      return console.error("[Email] Failed to send:", n.status, o), { success: false, error: `Email send failed: ${n.status}` };
    }
    return console.log("[Email] Successfully sent to:", t), { success: true };
  } catch (t) {
    return console.error("[Email] Exception:", t), { success: false, error: t.message };
  }
}
__name(Gs, "Gs");
__name2(Gs, "Gs");
async function _t(e) {
  const { streamId: t, title: s, sellerName: r, platform: a, scheduledAt: n, status: o } = e, i = `https://live.ur-team.com/live/${t}`, c = o === "live" ? "\u{1F534} \uB77C\uC774\uBE0C \uC911" : o === "scheduled" ? "\u{1F4C5} \uC608\uC57D\uB428" : "\u23F8\uFE0F \uB300\uAE30 \uC911", u = `
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
        <span class="value"><strong>${s}</strong></span>
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
        <span class="value">#${t}</span>
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
\uC81C\uBAA9: ${s}
\uD310\uB9E4\uC790: ${r}
\uD50C\uB7AB\uD3FC: ${a === "youtube" ? "YouTube" : "TikTok"}
${n ? `\uC608\uC57D \uC2DC\uAC04: ${new Date(n).toLocaleString("ko-KR")}` : ""}
\uB77C\uC774\uBE0C ID: #${t}

\u{1F517} \uB77C\uC774\uBE0C \uD398\uC774\uC9C0: ${i}

---
\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158
\uBD80\uC0B0\uAD11\uC5ED\uC2DC \uAE08\uC815\uAD6C \uB180\uC774\uB9C8\uB2F9\uB85C26 1402
\uB300\uD45C\uC804\uD654: 0507-0177-0432 | \uC774\uBA54\uC77C: jiwon@ur-team.com
  `;
  return Gs({ to: "jiwon@ur-team.com", subject: `[\uC720\uC5B4 \uB77C\uC774\uBE0C] \u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131: ${s}`, htmlContent: u, textContent: l });
}
__name(_t, "_t");
__name2(_t, "_t");
var Et = Object.freeze(Object.defineProperty({ __proto__: null, sendEmail: Gs, sendLiveStreamCreatedEmail: _t }, Symbol.toStringTag, { value: "Module" }));
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
var middleware_insertion_facade_default = hs;
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

// .wrangler/tmp/pages-SFInw5/ul1zlj9bzdj.js
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

// .wrangler/tmp/bundle-fzQoRx/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-fzQoRx/middleware-loader.entry.ts
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
//# sourceMappingURL=ul1zlj9bzdj.js.map
