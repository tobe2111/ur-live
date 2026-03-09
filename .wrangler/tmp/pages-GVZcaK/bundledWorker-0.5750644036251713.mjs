var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../node_modules/unenv/dist/runtime/_internal/utils.mjs
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

// ../node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
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

// ../node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../node_modules/unenv/dist/runtime/node/console.mjs
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
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
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

// ../node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
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

// ../node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
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

// ../node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd2) {
    this.fd = fd2;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd2) {
    this.fd = fd2;
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
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
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

// ../node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
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
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
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
  chdir(cwd2) {
    this.#cwd = cwd2;
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

// ../node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
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
  assert: assert2,
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
  assert: assert2,
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

// ../node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// _worker.js
import Ti from "crypto";
var yi = Object.defineProperty;
var Ra = /* @__PURE__ */ __name((e) => {
  throw TypeError(e);
}, "Ra");
var bi = /* @__PURE__ */ __name((e, t, s) => t in e ? yi(e, t, { enumerable: true, configurable: true, writable: true, value: s }) : e[t] = s, "bi");
var A = /* @__PURE__ */ __name((e, t, s) => bi(e, typeof t != "symbol" ? t + "" : t, s), "A");
var wr = /* @__PURE__ */ __name((e, t, s) => t.has(e) || Ra("Cannot " + s), "wr");
var T = /* @__PURE__ */ __name((e, t, s) => (wr(e, t, "read from private field"), s ? s.call(e) : t.get(e)), "T");
var C = /* @__PURE__ */ __name((e, t, s) => t.has(e) ? Ra("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, s), "C");
var O = /* @__PURE__ */ __name((e, t, s, r) => (wr(e, t, "write to private field"), r ? r.call(e, s) : t.set(e, s), s), "O");
var M = /* @__PURE__ */ __name((e, t, s) => (wr(e, t, "access private method"), s), "M");
var Ia = /* @__PURE__ */ __name((e, t, s, r) => ({ set _(a) {
  O(e, t, a, s);
}, get _() {
  return T(e, t, r);
} }), "Ia");
var Pa = /* @__PURE__ */ __name((e, t, s) => (r, a) => {
  let n = -1;
  return o(0);
  async function o(i) {
    if (i <= n) throw new Error("next() called multiple times");
    n = i;
    let c, l = false, u;
    if (e[i] ? (u = e[i][0][0], r.req.routeIndex = i) : u = i === e.length && a || void 0, u) try {
      c = await u(r, () => o(i + 1));
    } catch (d) {
      if (d instanceof Error && t) r.error = d, c = await t(d, r), l = true;
      else throw d;
    }
    else r.finalized === false && s && (c = await s(r));
    return c && (r.finalized === false || l) && (r.res = c), r;
  }
  __name(o, "o");
}, "Pa");
var vi = /* @__PURE__ */ Symbol();
var Si = /* @__PURE__ */ __name(async (e, t = /* @__PURE__ */ Object.create(null)) => {
  const { all: s = false, dot: r = false } = t, n = (e instanceof to ? e.raw.headers : e.headers).get("Content-Type");
  return n != null && n.startsWith("multipart/form-data") || n != null && n.startsWith("application/x-www-form-urlencoded") ? wi(e, { all: s, dot: r }) : {};
}, "Si");
async function wi(e, t) {
  const s = await e.formData();
  return s ? xi(s, t) : {};
}
__name(wi, "wi");
function xi(e, t) {
  const s = /* @__PURE__ */ Object.create(null);
  return e.forEach((r, a) => {
    t.all || a.endsWith("[]") ? Ri(s, a, r) : s[a] = r;
  }), t.dot && Object.entries(s).forEach(([r, a]) => {
    r.includes(".") && (Ii(s, r, a), delete s[r]);
  }), s;
}
__name(xi, "xi");
var Ri = /* @__PURE__ */ __name((e, t, s) => {
  e[t] !== void 0 ? Array.isArray(e[t]) ? e[t].push(s) : e[t] = [e[t], s] : t.endsWith("[]") ? e[t] = [s] : e[t] = s;
}, "Ri");
var Ii = /* @__PURE__ */ __name((e, t, s) => {
  let r = e;
  const a = t.split(".");
  a.forEach((n, o) => {
    o === a.length - 1 ? r[n] = s : ((!r[n] || typeof r[n] != "object" || Array.isArray(r[n]) || r[n] instanceof File) && (r[n] = /* @__PURE__ */ Object.create(null)), r = r[n]);
  });
}, "Ii");
var Yn = /* @__PURE__ */ __name((e) => {
  const t = e.split("/");
  return t[0] === "" && t.shift(), t;
}, "Yn");
var Pi = /* @__PURE__ */ __name((e) => {
  const { groups: t, path: s } = Oi(e), r = Yn(s);
  return Ai(r, t);
}, "Pi");
var Oi = /* @__PURE__ */ __name((e) => {
  const t = [];
  return e = e.replace(/\{[^}]+\}/g, (s, r) => {
    const a = `@${r}`;
    return t.push([a, s]), a;
  }), { groups: t, path: e };
}, "Oi");
var Ai = /* @__PURE__ */ __name((e, t) => {
  for (let s = t.length - 1; s >= 0; s--) {
    const [r] = t[s];
    for (let a = e.length - 1; a >= 0; a--) if (e[a].includes(r)) {
      e[a] = e[a].replace(r, t[s][1]);
      break;
    }
  }
  return e;
}, "Ai");
var Cs = {};
var Ci = /* @__PURE__ */ __name((e, t) => {
  if (e === "*") return "*";
  const s = e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (s) {
    const r = `${e}#${t}`;
    return Cs[r] || (s[2] ? Cs[r] = t && t[0] !== ":" && t[0] !== "*" ? [r, s[1], new RegExp(`^${s[2]}(?=/${t})`)] : [e, s[1], new RegExp(`^${s[2]}$`)] : Cs[r] = [e, s[1], true]), Cs[r];
  }
  return null;
}, "Ci");
var na = /* @__PURE__ */ __name((e, t) => {
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
}, "na");
var zn = /* @__PURE__ */ __name((e) => na(e, decodeURI), "zn");
var Xn = /* @__PURE__ */ __name((e) => {
  const t = e.url, s = t.indexOf("/", t.indexOf(":") + 4);
  let r = s;
  for (; r < t.length; r++) {
    const a = t.charCodeAt(r);
    if (a === 37) {
      const n = t.indexOf("?", r), o = t.indexOf("#", r), i = n === -1 ? o === -1 ? void 0 : o : o === -1 ? n : Math.min(n, o), c = t.slice(s, i);
      return zn(c.includes("%25") ? c.replace(/%25/g, "%2525") : c);
    } else if (a === 63 || a === 35) break;
  }
  return t.slice(s, r);
}, "Xn");
var Di = /* @__PURE__ */ __name((e) => {
  const t = Xn(e);
  return t.length > 1 && t.at(-1) === "/" ? t.slice(0, -1) : t;
}, "Di");
var wt = /* @__PURE__ */ __name((e, t, ...s) => (s.length && (t = wt(t, ...s)), `${(e == null ? void 0 : e[0]) === "/" ? "" : "/"}${e}${t === "/" ? "" : `${(e == null ? void 0 : e.at(-1)) === "/" ? "" : "/"}${(t == null ? void 0 : t[0]) === "/" ? t.slice(1) : t}`}`), "wt");
var Qn = /* @__PURE__ */ __name((e) => {
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
}, "Qn");
var xr = /* @__PURE__ */ __name((e) => /[%+]/.test(e) ? (e.indexOf("+") !== -1 && (e = e.replace(/\+/g, " ")), e.indexOf("%") !== -1 ? na(e, eo) : e) : e, "xr");
var Zn = /* @__PURE__ */ __name((e, t, s) => {
  let r;
  if (!s && t && !/[%+]/.test(t)) {
    let o = e.indexOf("?", 8);
    if (o === -1) return;
    for (e.startsWith(t, o + 1) || (o = e.indexOf(`&${t}`, o + 1)); o !== -1; ) {
      const i = e.charCodeAt(o + t.length + 1);
      if (i === 61) {
        const c = o + t.length + 2, l = e.indexOf("&", c);
        return xr(e.slice(c, l === -1 ? void 0 : l));
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
    if (r && (c = xr(c)), n = o, c === "") continue;
    let l;
    i === -1 ? l = "" : (l = e.slice(i + 1, o === -1 ? void 0 : o), r && (l = xr(l))), s ? (a[c] && Array.isArray(a[c]) || (a[c] = []), a[c].push(l)) : a[c] ?? (a[c] = l);
  }
  return t ? a[t] : a;
}, "Zn");
var ki = Zn;
var Ni = /* @__PURE__ */ __name((e, t) => Zn(e, t, true), "Ni");
var eo = decodeURIComponent;
var Oa = /* @__PURE__ */ __name((e) => na(e, eo), "Oa");
var Ot;
var de;
var Ce;
var so;
var ro;
var zr;
var Ue;
var Hn;
var to = (Hn = class {
  static {
    __name(this, "Hn");
  }
  constructor(e, t = "/", s = [[]]) {
    C(this, Ce);
    A(this, "raw");
    C(this, Ot);
    C(this, de);
    A(this, "routeIndex", 0);
    A(this, "path");
    A(this, "bodyCache", {});
    C(this, Ue, (e2) => {
      const { bodyCache: t2, raw: s2 } = this, r = t2[e2];
      if (r) return r;
      const a = Object.keys(t2)[0];
      return a ? t2[a].then((n) => (a === "json" && (n = JSON.stringify(n)), new Response(n)[e2]())) : t2[e2] = s2[e2]();
    });
    this.raw = e, this.path = t, O(this, de, s), O(this, Ot, {});
  }
  param(e) {
    return e ? M(this, Ce, so).call(this, e) : M(this, Ce, ro).call(this);
  }
  query(e) {
    return ki(this.url, e);
  }
  queries(e) {
    return Ni(this.url, e);
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
    return (t = this.bodyCache).parsedBody ?? (t.parsedBody = await Si(this, e));
  }
  json() {
    return T(this, Ue).call(this, "text").then((e) => JSON.parse(e));
  }
  text() {
    return T(this, Ue).call(this, "text");
  }
  arrayBuffer() {
    return T(this, Ue).call(this, "arrayBuffer");
  }
  blob() {
    return T(this, Ue).call(this, "blob");
  }
  formData() {
    return T(this, Ue).call(this, "formData");
  }
  addValidatedData(e, t) {
    T(this, Ot)[e] = t;
  }
  valid(e) {
    return T(this, Ot)[e];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [vi]() {
    return T(this, de);
  }
  get matchedRoutes() {
    return T(this, de)[0].map(([[, e]]) => e);
  }
  get routePath() {
    return T(this, de)[0].map(([[, e]]) => e)[this.routeIndex].path;
  }
}, Ot = /* @__PURE__ */ new WeakMap(), de = /* @__PURE__ */ new WeakMap(), Ce = /* @__PURE__ */ new WeakSet(), so = /* @__PURE__ */ __name(function(e) {
  const t = T(this, de)[0][this.routeIndex][1][e], s = M(this, Ce, zr).call(this, t);
  return s && /\%/.test(s) ? Oa(s) : s;
}, "so"), ro = /* @__PURE__ */ __name(function() {
  const e = {}, t = Object.keys(T(this, de)[0][this.routeIndex][1]);
  for (const s of t) {
    const r = M(this, Ce, zr).call(this, T(this, de)[0][this.routeIndex][1][s]);
    r !== void 0 && (e[s] = /\%/.test(r) ? Oa(r) : r);
  }
  return e;
}, "ro"), zr = /* @__PURE__ */ __name(function(e) {
  return T(this, de)[1] ? T(this, de)[1][e] : e;
}, "zr"), Ue = /* @__PURE__ */ new WeakMap(), Hn);
var ji = { Stringify: 1 };
var ao = /* @__PURE__ */ __name(async (e, t, s, r, a) => {
  typeof e == "object" && !(e instanceof String) && (e instanceof Promise || (e = e.toString()), e instanceof Promise && (e = await e));
  const n = e.callbacks;
  return n != null && n.length ? (a ? a[0] += e : a = [e], Promise.all(n.map((i) => i({ phase: t, buffer: a, context: r }))).then((i) => Promise.all(i.filter(Boolean).map((c) => ao(c, t, false, r, a))).then(() => a[0]))) : Promise.resolve(e);
}, "ao");
var Mi = "text/plain; charset=UTF-8";
var Rr = /* @__PURE__ */ __name((e, t) => ({ "Content-Type": e, ...t }), "Rr");
var qt = /* @__PURE__ */ __name((e, t) => new Response(e, t), "qt");
var ys;
var bs;
var Ie;
var At;
var Pe;
var ce;
var Ts;
var Ct;
var Dt;
var tt;
var vs;
var Ss;
var qe;
var xt;
var Wn;
var Li = (Wn = class {
  static {
    __name(this, "Wn");
  }
  constructor(e, t) {
    C(this, qe);
    C(this, ys);
    C(this, bs);
    A(this, "env", {});
    C(this, Ie);
    A(this, "finalized", false);
    A(this, "error");
    C(this, At);
    C(this, Pe);
    C(this, ce);
    C(this, Ts);
    C(this, Ct);
    C(this, Dt);
    C(this, tt);
    C(this, vs);
    C(this, Ss);
    A(this, "render", (...e2) => (T(this, Ct) ?? O(this, Ct, (t2) => this.html(t2)), T(this, Ct).call(this, ...e2)));
    A(this, "setLayout", (e2) => O(this, Ts, e2));
    A(this, "getLayout", () => T(this, Ts));
    A(this, "setRenderer", (e2) => {
      O(this, Ct, e2);
    });
    A(this, "header", (e2, t2, s) => {
      this.finalized && O(this, ce, qt(T(this, ce).body, T(this, ce)));
      const r = T(this, ce) ? T(this, ce).headers : T(this, tt) ?? O(this, tt, new Headers());
      t2 === void 0 ? r.delete(e2) : s != null && s.append ? r.append(e2, t2) : r.set(e2, t2);
    });
    A(this, "status", (e2) => {
      O(this, At, e2);
    });
    A(this, "set", (e2, t2) => {
      T(this, Ie) ?? O(this, Ie, /* @__PURE__ */ new Map()), T(this, Ie).set(e2, t2);
    });
    A(this, "get", (e2) => T(this, Ie) ? T(this, Ie).get(e2) : void 0);
    A(this, "newResponse", (...e2) => M(this, qe, xt).call(this, ...e2));
    A(this, "body", (e2, t2, s) => M(this, qe, xt).call(this, e2, t2, s));
    A(this, "text", (e2, t2, s) => !T(this, tt) && !T(this, At) && !t2 && !s && !this.finalized ? new Response(e2) : M(this, qe, xt).call(this, e2, t2, Rr(Mi, s)));
    A(this, "json", (e2, t2, s) => M(this, qe, xt).call(this, JSON.stringify(e2), t2, Rr("application/json", s)));
    A(this, "html", (e2, t2, s) => {
      const r = /* @__PURE__ */ __name((a) => M(this, qe, xt).call(this, a, t2, Rr("text/html; charset=UTF-8", s)), "r");
      return typeof e2 == "object" ? ao(e2, ji.Stringify, false, {}).then(r) : r(e2);
    });
    A(this, "redirect", (e2, t2) => {
      const s = String(e2);
      return this.header("Location", /[^\x00-\xFF]/.test(s) ? encodeURI(s) : s), this.newResponse(null, t2 ?? 302);
    });
    A(this, "notFound", () => (T(this, Dt) ?? O(this, Dt, () => qt()), T(this, Dt).call(this, this)));
    O(this, ys, e), t && (O(this, Pe, t.executionCtx), this.env = t.env, O(this, Dt, t.notFoundHandler), O(this, Ss, t.path), O(this, vs, t.matchResult));
  }
  get req() {
    return T(this, bs) ?? O(this, bs, new to(T(this, ys), T(this, Ss), T(this, vs))), T(this, bs);
  }
  get event() {
    if (T(this, Pe) && "respondWith" in T(this, Pe)) return T(this, Pe);
    throw Error("This context has no FetchEvent");
  }
  get executionCtx() {
    if (T(this, Pe)) return T(this, Pe);
    throw Error("This context has no ExecutionContext");
  }
  get res() {
    return T(this, ce) || O(this, ce, qt(null, { headers: T(this, tt) ?? O(this, tt, new Headers()) }));
  }
  set res(e) {
    if (T(this, ce) && e) {
      e = qt(e.body, e);
      for (const [t, s] of T(this, ce).headers.entries()) if (t !== "content-type") if (t === "set-cookie") {
        const r = T(this, ce).headers.getSetCookie();
        e.headers.delete("set-cookie");
        for (const a of r) e.headers.append("set-cookie", a);
      } else e.headers.set(t, s);
    }
    O(this, ce, e), this.finalized = true;
  }
  get var() {
    return T(this, Ie) ? Object.fromEntries(T(this, Ie)) : {};
  }
}, ys = /* @__PURE__ */ new WeakMap(), bs = /* @__PURE__ */ new WeakMap(), Ie = /* @__PURE__ */ new WeakMap(), At = /* @__PURE__ */ new WeakMap(), Pe = /* @__PURE__ */ new WeakMap(), ce = /* @__PURE__ */ new WeakMap(), Ts = /* @__PURE__ */ new WeakMap(), Ct = /* @__PURE__ */ new WeakMap(), Dt = /* @__PURE__ */ new WeakMap(), tt = /* @__PURE__ */ new WeakMap(), vs = /* @__PURE__ */ new WeakMap(), Ss = /* @__PURE__ */ new WeakMap(), qe = /* @__PURE__ */ new WeakSet(), xt = /* @__PURE__ */ __name(function(e, t, s) {
  const r = T(this, ce) ? new Headers(T(this, ce).headers) : T(this, tt) ?? new Headers();
  if (typeof t == "object" && "headers" in t) {
    const n = t.headers instanceof Headers ? t.headers : new Headers(t.headers);
    for (const [o, i] of n) o.toLowerCase() === "set-cookie" ? r.append(o, i) : r.set(o, i);
  }
  if (s) for (const [n, o] of Object.entries(s)) if (typeof o == "string") r.set(n, o);
  else {
    r.delete(n);
    for (const i of o) r.append(n, i);
  }
  const a = typeof t == "number" ? t : (t == null ? void 0 : t.status) ?? T(this, At);
  return qt(e, { status: a, headers: r });
}, "xt"), Wn);
var z = "ALL";
var $i = "all";
var Fi = ["get", "post", "put", "delete", "options", "patch"];
var no = "Can not add a route since the matcher is already built.";
var oo = class extends Error {
  static {
    __name(this, "oo");
  }
};
var Ui = "__COMPOSED_HANDLER";
var qi = /* @__PURE__ */ __name((e) => e.text("404 Not Found", 404), "qi");
var Aa = /* @__PURE__ */ __name((e, t) => {
  if ("getResponse" in e) {
    const s = e.getResponse();
    return t.newResponse(s.body, s);
  }
  return console.error(e), t.text("Internal Server Error", 500);
}, "Aa");
var _e;
var X;
var io;
var Ee;
var Qe;
var ar;
var nr;
var kt;
var Hi = (kt = class {
  static {
    __name(this, "kt");
  }
  constructor(t = {}) {
    C(this, X);
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
    C(this, _e, "/");
    A(this, "routes", []);
    C(this, Ee, qi);
    A(this, "errorHandler", Aa);
    A(this, "onError", (t2) => (this.errorHandler = t2, this));
    A(this, "notFound", (t2) => (O(this, Ee, t2), this));
    A(this, "fetch", (t2, ...s) => M(this, X, nr).call(this, t2, s[1], s[0], t2.method));
    A(this, "request", (t2, s, r2, a2) => t2 instanceof Request ? this.fetch(s ? new Request(t2, s) : t2, r2, a2) : (t2 = t2.toString(), this.fetch(new Request(/^https?:\/\//.test(t2) ? t2 : `http://localhost${wt("/", t2)}`, s), r2, a2)));
    A(this, "fire", () => {
      addEventListener("fetch", (t2) => {
        t2.respondWith(M(this, X, nr).call(this, t2.request, t2, void 0, t2.request.method));
      });
    });
    [...Fi, $i].forEach((n) => {
      this[n] = (o, ...i) => (typeof o == "string" ? O(this, _e, o) : M(this, X, Qe).call(this, n, T(this, _e), o), i.forEach((c) => {
        M(this, X, Qe).call(this, n, T(this, _e), c);
      }), this);
    }), this.on = (n, o, ...i) => {
      for (const c of [o].flat()) {
        O(this, _e, c);
        for (const l of [n].flat()) i.map((u) => {
          M(this, X, Qe).call(this, l.toUpperCase(), T(this, _e), u);
        });
      }
      return this;
    }, this.use = (n, ...o) => (typeof n == "string" ? O(this, _e, n) : (O(this, _e, "*"), o.unshift(n)), o.forEach((i) => {
      M(this, X, Qe).call(this, z, T(this, _e), i);
    }), this);
    const { strict: r, ...a } = t;
    Object.assign(this, a), this.getPath = r ?? true ? t.getPath ?? Xn : Di;
  }
  route(t, s) {
    const r = this.basePath(t);
    return s.routes.map((a) => {
      var o;
      let n;
      s.errorHandler === Aa ? n = a.handler : (n = /* @__PURE__ */ __name(async (i, c) => (await Pa([], s.errorHandler)(i, () => a.handler(i, c))).res, "n"), n[Ui] = a.handler), M(o = r, X, Qe).call(o, a.method, a.path, n);
    }), this;
  }
  basePath(t) {
    const s = M(this, X, io).call(this);
    return s._basePath = wt(this._basePath, t), s;
  }
  mount(t, s, r) {
    let a, n;
    r && (typeof r == "function" ? n = r : (n = r.optionHandler, r.replaceRequest === false ? a = /* @__PURE__ */ __name((c) => c, "a") : a = r.replaceRequest));
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
      const c = wt(this._basePath, t), l = c === "/" ? 0 : c.length;
      return (u) => {
        const d = new URL(u.url);
        return d.pathname = d.pathname.slice(l) || "/", new Request(d, u);
      };
    })());
    const i = /* @__PURE__ */ __name(async (c, l) => {
      const u = await s(a(c.req.raw), ...o(c));
      if (u) return u;
      await l();
    }, "i");
    return M(this, X, Qe).call(this, z, wt(t, "*"), i), this;
  }
}, _e = /* @__PURE__ */ new WeakMap(), X = /* @__PURE__ */ new WeakSet(), io = /* @__PURE__ */ __name(function() {
  const t = new kt({ router: this.router, getPath: this.getPath });
  return t.errorHandler = this.errorHandler, O(t, Ee, T(this, Ee)), t.routes = this.routes, t;
}, "io"), Ee = /* @__PURE__ */ new WeakMap(), Qe = /* @__PURE__ */ __name(function(t, s, r) {
  t = t.toUpperCase(), s = wt(this._basePath, s);
  const a = { basePath: this._basePath, path: s, method: t, handler: r };
  this.router.add(t, s, [r, a]), this.routes.push(a);
}, "Qe"), ar = /* @__PURE__ */ __name(function(t, s) {
  if (t instanceof Error) return this.errorHandler(t, s);
  throw t;
}, "ar"), nr = /* @__PURE__ */ __name(function(t, s, r, a) {
  if (a === "HEAD") return (async () => new Response(null, await M(this, X, nr).call(this, t, s, r, "GET")))();
  const n = this.getPath(t, { env: r }), o = this.router.match(a, n), i = new Li(t, { path: n, matchResult: o, env: r, executionCtx: s, notFoundHandler: T(this, Ee) });
  if (o[0].length === 1) {
    let l;
    try {
      l = o[0][0][0][0](i, async () => {
        i.res = await T(this, Ee).call(this, i);
      });
    } catch (u) {
      return M(this, X, ar).call(this, u, i);
    }
    return l instanceof Promise ? l.then((u) => u || (i.finalized ? i.res : T(this, Ee).call(this, i))).catch((u) => M(this, X, ar).call(this, u, i)) : l ?? T(this, Ee).call(this, i);
  }
  const c = Pa(o[0], this.errorHandler, T(this, Ee));
  return (async () => {
    try {
      const l = await c(i);
      if (!l.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
      return l.res;
    } catch (l) {
      return M(this, X, ar).call(this, l, i);
    }
  })();
}, "nr"), kt);
var co = [];
function Wi(e, t) {
  const s = this.buildAllMatchers(), r = /* @__PURE__ */ __name(((a, n) => {
    const o = s[a] || s[z], i = o[2][n];
    if (i) return i;
    const c = n.match(o[0]);
    if (!c) return [[], co];
    const l = c.indexOf("", 1);
    return [o[1][l], c];
  }), "r");
  return this.match = r, r(e, t);
}
__name(Wi, "Wi");
var cr = "[^/]+";
var ps = ".*";
var ms = "(?:|/.*)";
var Rt = /* @__PURE__ */ Symbol();
var Bi = new Set(".\\+*[^]$()");
function Ki(e, t) {
  return e.length === 1 ? t.length === 1 ? e < t ? -1 : 1 : -1 : t.length === 1 || e === ps || e === ms ? 1 : t === ps || t === ms ? -1 : e === cr ? 1 : t === cr ? -1 : e.length === t.length ? e < t ? -1 : 1 : t.length - e.length;
}
__name(Ki, "Ki");
var st;
var rt;
var ge;
var it;
var Gi = (it = class {
  static {
    __name(this, "it");
  }
  constructor() {
    C(this, st);
    C(this, rt);
    C(this, ge, /* @__PURE__ */ Object.create(null));
  }
  insert(t, s, r, a, n) {
    if (t.length === 0) {
      if (T(this, st) !== void 0) throw Rt;
      if (n) return;
      O(this, st, s);
      return;
    }
    const [o, ...i] = t, c = o === "*" ? i.length === 0 ? ["", "", ps] : ["", "", cr] : o === "/*" ? ["", "", ms] : o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let l;
    if (c) {
      const u = c[1];
      let d = c[2] || cr;
      if (u && c[2] && (d === ".*" || (d = d.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:"), /\((?!\?:)/.test(d)))) throw Rt;
      if (l = T(this, ge)[d], !l) {
        if (Object.keys(T(this, ge)).some((m) => m !== ps && m !== ms)) throw Rt;
        if (n) return;
        l = T(this, ge)[d] = new it(), u !== "" && O(l, rt, a.varIndex++);
      }
      !n && u !== "" && r.push([u, T(l, rt)]);
    } else if (l = T(this, ge)[o], !l) {
      if (Object.keys(T(this, ge)).some((u) => u.length > 1 && u !== ps && u !== ms)) throw Rt;
      if (n) return;
      l = T(this, ge)[o] = new it();
    }
    l.insert(i, s, r, a, n);
  }
  buildRegExpStr() {
    const s = Object.keys(T(this, ge)).sort(Ki).map((r) => {
      const a = T(this, ge)[r];
      return (typeof T(a, rt) == "number" ? `(${r})@${T(a, rt)}` : Bi.has(r) ? `\\${r}` : r) + a.buildRegExpStr();
    });
    return typeof T(this, st) == "number" && s.unshift(`#${T(this, st)}`), s.length === 0 ? "" : s.length === 1 ? s[0] : "(?:" + s.join("|") + ")";
  }
}, st = /* @__PURE__ */ new WeakMap(), rt = /* @__PURE__ */ new WeakMap(), ge = /* @__PURE__ */ new WeakMap(), it);
var hr;
var ws;
var Bn;
var Vi = (Bn = class {
  static {
    __name(this, "Bn");
  }
  constructor() {
    C(this, hr, { varIndex: 0 });
    C(this, ws, new Gi());
  }
  insert(e, t, s) {
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
    return T(this, ws).insert(n, t, r, T(this, hr), s), r;
  }
  buildRegExp() {
    let e = T(this, ws).buildRegExpStr();
    if (e === "") return [/^$/, [], []];
    let t = 0;
    const s = [], r = [];
    return e = e.replace(/#(\d+)|@(\d+)|\.\*\$/g, (a, n, o) => n !== void 0 ? (s[++t] = Number(n), "$()") : (o !== void 0 && (r[Number(o)] = ++t), "")), [new RegExp(`^${e}`), s, r];
  }
}, hr = /* @__PURE__ */ new WeakMap(), ws = /* @__PURE__ */ new WeakMap(), Bn);
var Ji = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var or = /* @__PURE__ */ Object.create(null);
function lo(e) {
  return or[e] ?? (or[e] = new RegExp(e === "*" ? "" : `^${e.replace(/\/\*$|([.\\+*[^\]$()])/g, (t, s) => s ? `\\${s}` : "(?:|/.*)")}$`));
}
__name(lo, "lo");
function Yi() {
  or = /* @__PURE__ */ Object.create(null);
}
__name(Yi, "Yi");
function zi(e) {
  var l;
  const t = new Vi(), s = [];
  if (e.length === 0) return Ji;
  const r = e.map((u) => [!/\*|\/:/.test(u[0]), ...u]).sort(([u, d], [m, _]) => u ? 1 : m ? -1 : d.length - _.length), a = /* @__PURE__ */ Object.create(null);
  for (let u = 0, d = -1, m = r.length; u < m; u++) {
    const [_, h, E] = r[u];
    _ ? a[h] = [E.map(([b]) => [b, /* @__PURE__ */ Object.create(null)]), co] : d++;
    let v;
    try {
      v = t.insert(h, d, _);
    } catch (b) {
      throw b === Rt ? new oo(h) : b;
    }
    _ || (s[d] = E.map(([b, y]) => {
      const S = /* @__PURE__ */ Object.create(null);
      for (y -= 1; y >= 0; y--) {
        const [g, x] = v[y];
        S[g] = x;
      }
      return [b, S];
    }));
  }
  const [n, o, i] = t.buildRegExp();
  for (let u = 0, d = s.length; u < d; u++) for (let m = 0, _ = s[u].length; m < _; m++) {
    const h = (l = s[u][m]) == null ? void 0 : l[1];
    if (!h) continue;
    const E = Object.keys(h);
    for (let v = 0, b = E.length; v < b; v++) h[E[v]] = i[h[E[v]]];
  }
  const c = [];
  for (const u in o) c[u] = s[o[u]];
  return [n, c, a];
}
__name(zi, "zi");
function dt(e, t) {
  if (e) {
    for (const s of Object.keys(e).sort((r, a) => a.length - r.length)) if (lo(s).test(t)) return [...e[s]];
  }
}
__name(dt, "dt");
var He;
var We;
var _r;
var uo;
var Kn;
var Xi = (Kn = class {
  static {
    __name(this, "Kn");
  }
  constructor() {
    C(this, _r);
    A(this, "name", "RegExpRouter");
    C(this, He);
    C(this, We);
    A(this, "match", Wi);
    O(this, He, { [z]: /* @__PURE__ */ Object.create(null) }), O(this, We, { [z]: /* @__PURE__ */ Object.create(null) });
  }
  add(e, t, s) {
    var i;
    const r = T(this, He), a = T(this, We);
    if (!r || !a) throw new Error(no);
    r[e] || [r, a].forEach((c) => {
      c[e] = /* @__PURE__ */ Object.create(null), Object.keys(c[z]).forEach((l) => {
        c[e][l] = [...c[z][l]];
      });
    }), t === "/*" && (t = "*");
    const n = (t.match(/\/:/g) || []).length;
    if (/\*$/.test(t)) {
      const c = lo(t);
      e === z ? Object.keys(r).forEach((l) => {
        var u;
        (u = r[l])[t] || (u[t] = dt(r[l], t) || dt(r[z], t) || []);
      }) : (i = r[e])[t] || (i[t] = dt(r[e], t) || dt(r[z], t) || []), Object.keys(r).forEach((l) => {
        (e === z || e === l) && Object.keys(r[l]).forEach((u) => {
          c.test(u) && r[l][u].push([s, n]);
        });
      }), Object.keys(a).forEach((l) => {
        (e === z || e === l) && Object.keys(a[l]).forEach((u) => c.test(u) && a[l][u].push([s, n]));
      });
      return;
    }
    const o = Qn(t) || [t];
    for (let c = 0, l = o.length; c < l; c++) {
      const u = o[c];
      Object.keys(a).forEach((d) => {
        var m;
        (e === z || e === d) && ((m = a[d])[u] || (m[u] = [...dt(r[d], u) || dt(r[z], u) || []]), a[d][u].push([s, n - l + c + 1]));
      });
    }
  }
  buildAllMatchers() {
    const e = /* @__PURE__ */ Object.create(null);
    return Object.keys(T(this, We)).concat(Object.keys(T(this, He))).forEach((t) => {
      e[t] || (e[t] = M(this, _r, uo).call(this, t));
    }), O(this, He, O(this, We, void 0)), Yi(), e;
  }
}, He = /* @__PURE__ */ new WeakMap(), We = /* @__PURE__ */ new WeakMap(), _r = /* @__PURE__ */ new WeakSet(), uo = /* @__PURE__ */ __name(function(e) {
  const t = [];
  let s = e === z;
  return [T(this, He), T(this, We)].forEach((r) => {
    const a = r[e] ? Object.keys(r[e]).map((n) => [n, r[e][n]]) : [];
    a.length !== 0 ? (s || (s = true), t.push(...a)) : e !== z && t.push(...Object.keys(r[z]).map((n) => [n, r[z][n]]));
  }), s ? zi(t) : null;
}, "uo"), Kn);
var Be;
var Oe;
var Gn;
var Qi = (Gn = class {
  static {
    __name(this, "Gn");
  }
  constructor(e) {
    A(this, "name", "SmartRouter");
    C(this, Be, []);
    C(this, Oe, []);
    O(this, Be, e.routers);
  }
  add(e, t, s) {
    if (!T(this, Oe)) throw new Error(no);
    T(this, Oe).push([e, t, s]);
  }
  match(e, t) {
    if (!T(this, Oe)) throw new Error("Fatal error");
    const s = T(this, Be), r = T(this, Oe), a = s.length;
    let n = 0, o;
    for (; n < a; n++) {
      const i = s[n];
      try {
        for (let c = 0, l = r.length; c < l; c++) i.add(...r[c]);
        o = i.match(e, t);
      } catch (c) {
        if (c instanceof oo) continue;
        throw c;
      }
      this.match = i.match.bind(i), O(this, Be, [i]), O(this, Oe, void 0);
      break;
    }
    if (n === a) throw new Error("Fatal error");
    return this.name = `SmartRouter + ${this.activeRouter.name}`, o;
  }
  get activeRouter() {
    if (T(this, Oe) || T(this, Be).length !== 1) throw new Error("No active router has been determined yet.");
    return T(this, Be)[0];
  }
}, Be = /* @__PURE__ */ new WeakMap(), Oe = /* @__PURE__ */ new WeakMap(), Gn);
var Ht = /* @__PURE__ */ Object.create(null);
var Zi = /* @__PURE__ */ __name((e) => {
  for (const t in e) return true;
  return false;
}, "Zi");
var Ke;
var oe;
var at;
var Nt;
var se;
var Ae;
var Ze;
var jt;
var ec = (jt = class {
  static {
    __name(this, "jt");
  }
  constructor(t, s, r) {
    C(this, Ae);
    C(this, Ke);
    C(this, oe);
    C(this, at);
    C(this, Nt, 0);
    C(this, se, Ht);
    if (O(this, oe, r || /* @__PURE__ */ Object.create(null)), O(this, Ke, []), t && s) {
      const a = /* @__PURE__ */ Object.create(null);
      a[t] = { handler: s, possibleKeys: [], score: 0 }, O(this, Ke, [a]);
    }
    O(this, at, []);
  }
  insert(t, s, r) {
    O(this, Nt, ++Ia(this, Nt)._);
    let a = this;
    const n = Pi(s), o = [];
    for (let i = 0, c = n.length; i < c; i++) {
      const l = n[i], u = n[i + 1], d = Ci(l, u), m = Array.isArray(d) ? d[0] : l;
      if (m in T(a, oe)) {
        a = T(a, oe)[m], d && o.push(d[1]);
        continue;
      }
      T(a, oe)[m] = new jt(), d && (T(a, at).push(d), o.push(d[1])), a = T(a, oe)[m];
    }
    return T(a, Ke).push({ [t]: { handler: r, possibleKeys: o.filter((i, c, l) => l.indexOf(i) === c), score: T(this, Nt) } }), a;
  }
  search(t, s) {
    var u;
    const r = [];
    O(this, se, Ht);
    let n = [this];
    const o = Yn(s), i = [], c = o.length;
    let l = null;
    for (let d = 0; d < c; d++) {
      const m = o[d], _ = d === c - 1, h = [];
      for (let v = 0, b = n.length; v < b; v++) {
        const y = n[v], S = T(y, oe)[m];
        S && (O(S, se, T(y, se)), _ ? (T(S, oe)["*"] && M(this, Ae, Ze).call(this, r, T(S, oe)["*"], t, T(y, se)), M(this, Ae, Ze).call(this, r, S, t, T(y, se))) : h.push(S));
        for (let g = 0, x = T(y, at).length; g < x; g++) {
          const k = T(y, at)[g], P = T(y, se) === Ht ? {} : { ...T(y, se) };
          if (k === "*") {
            const F = T(y, oe)["*"];
            F && (M(this, Ae, Ze).call(this, r, F, t, T(y, se)), O(F, se, P), h.push(F));
            continue;
          }
          const [q, B, R] = k;
          if (!m && !(R instanceof RegExp)) continue;
          const L = T(y, oe)[q];
          if (R instanceof RegExp) {
            if (l === null) {
              l = new Array(c);
              let Q = s[0] === "/" ? 1 : 0;
              for (let I = 0; I < c; I++) l[I] = Q, Q += o[I].length + 1;
            }
            const F = s.substring(l[d]), J = R.exec(F);
            if (J) {
              if (P[B] = J[0], M(this, Ae, Ze).call(this, r, L, t, T(y, se), P), Zi(T(L, oe))) {
                O(L, se, P);
                const Q = ((u = J[0].match(/\//)) == null ? void 0 : u.length) ?? 0;
                (i[Q] || (i[Q] = [])).push(L);
              }
              continue;
            }
          }
          (R === true || R.test(m)) && (P[B] = m, _ ? (M(this, Ae, Ze).call(this, r, L, t, P, T(y, se)), T(L, oe)["*"] && M(this, Ae, Ze).call(this, r, T(L, oe)["*"], t, P, T(y, se))) : (O(L, se, P), h.push(L)));
        }
      }
      const E = i.shift();
      n = E ? h.concat(E) : h;
    }
    return r.length > 1 && r.sort((d, m) => d.score - m.score), [r.map(({ handler: d, params: m }) => [d, m])];
  }
}, Ke = /* @__PURE__ */ new WeakMap(), oe = /* @__PURE__ */ new WeakMap(), at = /* @__PURE__ */ new WeakMap(), Nt = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), Ae = /* @__PURE__ */ new WeakSet(), Ze = /* @__PURE__ */ __name(function(t, s, r, a, n) {
  for (let o = 0, i = T(s, Ke).length; o < i; o++) {
    const c = T(s, Ke)[o], l = c[r] || c[z], u = {};
    if (l !== void 0 && (l.params = /* @__PURE__ */ Object.create(null), t.push(l), a !== Ht || n && n !== Ht)) for (let d = 0, m = l.possibleKeys.length; d < m; d++) {
      const _ = l.possibleKeys[d], h = u[l.score];
      l.params[_] = n != null && n[_] && !h ? n[_] : a[_] ?? (n == null ? void 0 : n[_]), u[l.score] = true;
    }
  }
}, "Ze"), jt);
var nt;
var Vn;
var tc = (Vn = class {
  static {
    __name(this, "Vn");
  }
  constructor() {
    A(this, "name", "TrieRouter");
    C(this, nt);
    O(this, nt, new ec());
  }
  add(e, t, s) {
    const r = Qn(t);
    if (r) {
      for (let a = 0, n = r.length; a < n; a++) T(this, nt).insert(e, r[a], s);
      return;
    }
    T(this, nt).insert(e, t, s);
  }
  match(e, t) {
    return T(this, nt).search(e, t);
  }
}, nt = /* @__PURE__ */ new WeakMap(), Vn);
var po = class extends Hi {
  static {
    __name(this, "po");
  }
  constructor(e = {}) {
    super(e), this.router = e.router ?? new Qi({ routers: [new Xi(), new tc()] });
  }
};
var w = /* @__PURE__ */ __name((e) => {
  const s = { ...{ origin: "*", allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"], allowHeaders: [], exposeHeaders: [] }, ...e }, r = /* @__PURE__ */ ((n) => typeof n == "string" ? n === "*" ? () => n : (o) => n === o ? o : null : typeof n == "function" ? n : (o) => n.includes(o) ? o : null)(s.origin), a = ((n) => typeof n == "function" ? n : Array.isArray(n) ? () => n : () => [])(s.allowMethods);
  return async function(o, i) {
    var u;
    function c(d, m) {
      o.res.headers.set(d, m);
    }
    __name(c, "c");
    const l = await r(o.req.header("origin") || "", o);
    if (l && c("Access-Control-Allow-Origin", l), s.credentials && c("Access-Control-Allow-Credentials", "true"), (u = s.exposeHeaders) != null && u.length && c("Access-Control-Expose-Headers", s.exposeHeaders.join(",")), o.req.method === "OPTIONS") {
      s.origin !== "*" && c("Vary", "Origin"), s.maxAge != null && c("Access-Control-Max-Age", s.maxAge.toString());
      const d = await a(o.req.header("origin") || "", o);
      d.length && c("Access-Control-Allow-Methods", d.join(","));
      let m = s.allowHeaders;
      if (!(m != null && m.length)) {
        const _ = o.req.header("Access-Control-Request-Headers");
        _ && (m = _.split(/\s*,\s*/));
      }
      return m != null && m.length && (c("Access-Control-Allow-Headers", m.join(",")), o.res.headers.append("Vary", "Access-Control-Request-Headers")), o.res.headers.delete("Content-Length"), o.res.headers.delete("Content-Type"), new Response(null, { headers: o.res.headers, status: 204, statusText: "No Content" });
    }
    await i(), s.origin !== "*" && o.header("Vary", "Origin", { append: true });
  };
}, "w");
var sc = /^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:javascript|json|xml|xml-dtd|ecmascript|dart|postscript|rtf|tar|toml|vnd\.dart|vnd\.ms-fontobject|vnd\.ms-opentype|wasm|x-httpd-php|x-javascript|x-ns-proxy-autoconfig|x-sh|x-tar|x-virtualbox-hdd|x-virtualbox-ova|x-virtualbox-ovf|x-virtualbox-vbox|x-virtualbox-vdi|x-virtualbox-vhd|x-virtualbox-vmdk|x-www-form-urlencoded)|font\/(?:otf|ttf)|image\/(?:bmp|vnd\.adobe\.photoshop|vnd\.microsoft\.icon|vnd\.ms-dds|x-icon|x-ms-bmp)|message\/rfc822|model\/gltf-binary|x-shader\/x-fragment|x-shader\/x-vertex|[^;\s]+?\+(?:json|text|xml|yaml))(?:[;\s]|$)/i;
var Ca = /* @__PURE__ */ __name((e, t = ac) => {
  const s = /\.([a-zA-Z0-9]+?)$/, r = e.match(s);
  if (!r) return;
  let a = t[r[1]];
  return a && a.startsWith("text") && (a += "; charset=utf-8"), a;
}, "Ca");
var rc = { aac: "audio/aac", avi: "video/x-msvideo", avif: "image/avif", av1: "video/av1", bin: "application/octet-stream", bmp: "image/bmp", css: "text/css", csv: "text/csv", eot: "application/vnd.ms-fontobject", epub: "application/epub+zip", gif: "image/gif", gz: "application/gzip", htm: "text/html", html: "text/html", ico: "image/x-icon", ics: "text/calendar", jpeg: "image/jpeg", jpg: "image/jpeg", js: "text/javascript", json: "application/json", jsonld: "application/ld+json", map: "application/json", mid: "audio/x-midi", midi: "audio/x-midi", mjs: "text/javascript", mp3: "audio/mpeg", mp4: "video/mp4", mpeg: "video/mpeg", oga: "audio/ogg", ogv: "video/ogg", ogx: "application/ogg", opus: "audio/opus", otf: "font/otf", pdf: "application/pdf", png: "image/png", rtf: "application/rtf", svg: "image/svg+xml", tif: "image/tiff", tiff: "image/tiff", ts: "video/mp2t", ttf: "font/ttf", txt: "text/plain", wasm: "application/wasm", webm: "video/webm", weba: "audio/webm", webmanifest: "application/manifest+json", webp: "image/webp", woff: "font/woff", woff2: "font/woff2", xhtml: "application/xhtml+xml", xml: "application/xml", zip: "application/zip", "3gp": "video/3gpp", "3g2": "video/3gpp2", gltf: "model/gltf+json", glb: "model/gltf-binary" };
var ac = rc;
var nc = /* @__PURE__ */ __name((...e) => {
  let t = e.filter((a) => a !== "").join("/");
  t = t.replace(new RegExp("(?<=\\/)\\/+", "g"), "");
  const s = t.split("/"), r = [];
  for (const a of s) a === ".." && r.length > 0 && r.at(-1) !== ".." ? r.pop() : a !== "." && r.push(a);
  return r.join("/") || ".";
}, "nc");
var mo = { br: ".br", zstd: ".zst", gzip: ".gz" };
var oc = Object.keys(mo);
var ic = "index.html";
var cc = /* @__PURE__ */ __name((e) => {
  const t = e.root ?? "./", s = e.path, r = e.join ?? nc;
  return async (a, n) => {
    var u, d, m, _;
    if (a.finalized) return n();
    let o;
    if (e.path) o = e.path;
    else try {
      if (o = zn(a.req.path), /(?:^|[\/\\])\.\.(?:$|[\/\\])/.test(o)) throw new Error();
    } catch {
      return await ((u = e.onNotFound) == null ? void 0 : u.call(e, a.req.path, a)), n();
    }
    let i = r(t, !s && e.rewriteRequestPath ? e.rewriteRequestPath(o) : o);
    e.isDir && await e.isDir(i) && (i = r(i, ic));
    const c = e.getContent;
    let l = await c(i, a);
    if (l instanceof Response) return a.newResponse(l.body, l);
    if (l) {
      const h = e.mimes && Ca(i, e.mimes) || Ca(i);
      if (a.header("Content-Type", h || "application/octet-stream"), e.precompressed && (!h || sc.test(h))) {
        const E = new Set((d = a.req.header("Accept-Encoding")) == null ? void 0 : d.split(",").map((v) => v.trim()));
        for (const v of oc) {
          if (!E.has(v)) continue;
          const b = await c(i + mo[v], a);
          if (b) {
            l = b, a.header("Content-Encoding", v), a.header("Vary", "Accept-Encoding", { append: true });
            break;
          }
        }
      }
      return await ((m = e.onFound) == null ? void 0 : m.call(e, i, a)), a.body(l);
    }
    await ((_ = e.onNotFound) == null ? void 0 : _.call(e, i, a)), await n();
  };
}, "cc");
var lc = /* @__PURE__ */ __name(async (e, t) => {
  let s;
  t && t.manifest ? typeof t.manifest == "string" ? s = JSON.parse(t.manifest) : s = t.manifest : typeof __STATIC_CONTENT_MANIFEST == "string" ? s = JSON.parse(__STATIC_CONTENT_MANIFEST) : s = __STATIC_CONTENT_MANIFEST;
  let r;
  t && t.namespace ? r = t.namespace : r = __STATIC_CONTENT;
  const a = s[e];
  if (!a) return null;
  const n = await r.get(a, { type: "stream" });
  return n || null;
}, "lc");
var uc = /* @__PURE__ */ __name((e) => async function(s, r) {
  return cc({ ...e, getContent: /* @__PURE__ */ __name(async (n) => lc(n, { manifest: e.manifest, namespace: e.namespace ? e.namespace : s.env ? s.env.__STATIC_CONTENT : void 0 }), "getContent") })(s, r);
}, "uc");
var dc = /* @__PURE__ */ __name((e) => uc(e), "dc");
function pc(e) {
  var a;
  const t = ((a = e.split(".").pop()) == null ? void 0 : a.toLowerCase()) || "jpg", s = Date.now(), r = crypto.randomUUID().substring(0, 8);
  return `upload_${s}_${r}.${t}`;
}
__name(pc, "pc");
async function mc(e) {
  const t = new Uint8Array(e);
  return t[0] === 255 && t[1] === 216 && t[2] === 255 ? { valid: true, detectedType: "image/jpeg" } : t[0] === 137 && t[1] === 80 && t[2] === 78 && t[3] === 71 ? { valid: true, detectedType: "image/png" } : t[0] === 71 && t[1] === 73 && t[2] === 70 && t[3] === 56 ? { valid: true, detectedType: "image/gif" } : t[0] === 82 && t[1] === 73 && t[2] === 70 && t[3] === 70 && t[8] === 87 && t[9] === 69 && t[10] === 66 && t[11] === 80 ? { valid: true, detectedType: "image/webp" } : { valid: false };
}
__name(mc, "mc");
function fc(e) {
  const t = ["DB", "SESSION_KV", "CACHE_KV", "TOSS_SECRET_KEY", "TOSS_CLIENT_KEY"], s = [];
  for (const r of t) e[r] || s.push(r);
  if (s.length > 0) throw new Error(`Missing required environment variables: ${s.join(", ")}

Please configure them:
` + s.map((r) => r === "TOSS_SECRET_KEY" || r === "TOSS_CLIENT_KEY" ? `  npx wrangler pages secret put ${r} --project-name ur-live` : `  Check wrangler.jsonc for ${r} binding`).join(`
`) + `

For more details, see ENV_SETUP_GUIDE.md`);
}
__name(fc, "fc");
function hc(e) {
  console.log("[ENV] Environment check:"), console.log("  DB:", e.DB ? "\u2705 Connected" : "\u274C Missing"), console.log("  SESSION_KV:", e.SESSION_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  CACHE_KV:", e.CACHE_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  TOSS_SECRET_KEY:", e.TOSS_SECRET_KEY ? "\u2705 Set" : "\u274C Missing"), console.log("  TOSS_CLIENT_KEY:", e.TOSS_CLIENT_KEY ? "\u2705 Set" : "\u274C Missing");
}
__name(hc, "hc");
async function _c(e) {
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
  return e.TOSS_SECRET_KEY ? !e.TOSS_SECRET_KEY.startsWith("test_gsk_") && !e.TOSS_SECRET_KEY.startsWith("live_gsk_") ? t.push({ name: "TOSS_SECRET_KEY", status: "warn", message: "TOSS_SECRET_KEY format may be invalid", details: "Expected format: test_gsk_* or live_gsk_*" }) : t.push({ name: "TOSS_SECRET_KEY", status: "pass", message: `TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0, 12)}...)` }) : t.push({ name: "TOSS_SECRET_KEY", status: "fail", message: "TOSS_SECRET_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live" }), e.TOSS_CLIENT_KEY ? !e.TOSS_CLIENT_KEY.startsWith("test_gck_") && !e.TOSS_CLIENT_KEY.startsWith("live_gck_") ? t.push({ name: "TOSS_CLIENT_KEY", status: "warn", message: "TOSS_CLIENT_KEY format may be invalid", details: "Expected format: test_gck_* or live_gck_*" }) : t.push({ name: "TOSS_CLIENT_KEY", status: "pass", message: `TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0, 12)}...)` }) : t.push({ name: "TOSS_CLIENT_KEY", status: "fail", message: "TOSS_CLIENT_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live" }), e.FIREBASE_PRIVATE_KEY ? e.FIREBASE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY") ? t.push({ name: "FIREBASE_PRIVATE_KEY", status: "pass", message: `FIREBASE_PRIVATE_KEY configured (${e.FIREBASE_PRIVATE_KEY.length} chars)` }) : t.push({ name: "FIREBASE_PRIVATE_KEY", status: "warn", message: "FIREBASE_PRIVATE_KEY format may be invalid", details: "Expected format: -----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n" }) : t.push({ name: "FIREBASE_PRIVATE_KEY", status: "fail", message: "FIREBASE_PRIVATE_KEY not configured", details: "Add FIREBASE_PRIVATE_KEY in Cloudflare Dashboard \u2192 ur-live \u2192 Settings \u2192 Environment variables" }), e.FIREBASE_CLIENT_EMAIL ? !e.FIREBASE_CLIENT_EMAIL.includes("@") || !e.FIREBASE_CLIENT_EMAIL.includes("iam.gserviceaccount.com") ? t.push({ name: "FIREBASE_CLIENT_EMAIL", status: "warn", message: "FIREBASE_CLIENT_EMAIL format may be invalid", details: "Expected format: *@*.iam.gserviceaccount.com" }) : t.push({ name: "FIREBASE_CLIENT_EMAIL", status: "pass", message: `FIREBASE_CLIENT_EMAIL configured: ${e.FIREBASE_CLIENT_EMAIL}` }) : t.push({ name: "FIREBASE_CLIENT_EMAIL", status: "fail", message: "FIREBASE_CLIENT_EMAIL not configured", details: "Add FIREBASE_CLIENT_EMAIL in Cloudflare Dashboard \u2192 ur-live \u2192 Settings \u2192 Environment variables" }), e.FIREBASE_PROJECT_ID ? t.push({ name: "FIREBASE_PROJECT_ID", status: "pass", message: `FIREBASE_PROJECT_ID configured: ${e.FIREBASE_PROJECT_ID}` }) : t.push({ name: "FIREBASE_PROJECT_ID", status: "fail", message: "FIREBASE_PROJECT_ID not configured", details: "Add FIREBASE_PROJECT_ID in Cloudflare Dashboard \u2192 ur-live \u2192 Settings \u2192 Environment variables" }), e.FIREBASE_DATABASE_URL ? !e.FIREBASE_DATABASE_URL.startsWith("https://") || !e.FIREBASE_DATABASE_URL.includes("firebaseio.com") ? t.push({ name: "FIREBASE_DATABASE_URL", status: "warn", message: "FIREBASE_DATABASE_URL format may be invalid", details: "Expected format: https://*.firebaseio.com" }) : t.push({ name: "FIREBASE_DATABASE_URL", status: "pass", message: `FIREBASE_DATABASE_URL configured: ${e.FIREBASE_DATABASE_URL}` }) : t.push({ name: "FIREBASE_DATABASE_URL", status: "fail", message: "FIREBASE_DATABASE_URL not configured", details: "Add FIREBASE_DATABASE_URL in Cloudflare Dashboard \u2192 ur-live \u2192 Settings \u2192 Environment variables" }), t;
}
__name(_c, "_c");
function Ec(e) {
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
__name(Ec, "Ec");
async function gc(e) {
  const t = await _c(e), s = t.filter((n) => n.status === "pass").length, r = t.filter((n) => n.status === "warn").length, a = t.filter((n) => n.status === "fail").length;
  return { success: a === 0, summary: { total: t.length, pass: s, warn: r, fail: a }, results: t, formatted: Ec(t) };
}
__name(gc, "gc");
var Ir = { ENV: "test", TEST_API_KEY: "03148F80-9525-4A00-83B4-1AE55DFFA2DF", TEST_BASE_URL: "https://testapi.barobill.co.kr" };
function yc() {
  const e = Ir.ENV === "production";
  return { baseUrl: Ir.TEST_BASE_URL, apiKey: Ir.TEST_API_KEY, isProduction: e };
}
__name(yc, "yc");
async function fo(e, t) {
  const s = yc(), r = `${s.baseUrl}${e}`;
  try {
    const a = await fetch(r, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.apiKey}` }, body: JSON.stringify(t) });
    if (!a.ok) throw new Error(`\uBC14\uB85C\uBE4C API \uC624\uB958: ${a.status} ${a.statusText}`);
    return await a.json();
  } catch (a) {
    throw console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", a), a;
  }
}
__name(fo, "fo");
async function bc(e) {
  try {
    const t = { CorpNum: e.supplierBusinessNumber, InvoicerCorpNum: e.supplierBusinessNumber, InvoicerCorpName: e.supplierBusinessName, InvoicerCEOName: e.supplierCEO, InvoicerAddr: e.supplierAddress, InvoicerBizType: e.supplierBusinessType, InvoicerBizClass: e.supplierBusinessCategory, InvoicerContactName: e.supplierCEO, InvoicerEmail: e.supplierEmail, InvoicerTEL: e.supplierTel, InvoiceeType: e.buyerBusinessNumber ? "\uC0AC\uC5C5\uC790" : "\uAC1C\uC778", InvoiceeCorpNum: e.buyerBusinessNumber, InvoiceeCorpName: e.buyerBusinessName, InvoiceeCEOName: e.buyerCEO, InvoiceeAddr: e.buyerAddress, InvoiceeEmail: e.buyerEmail, InvoiceeTEL: e.buyerTel, WriteDate: e.writeDate, PurposeType: e.purposeType, TaxType: e.taxType, DetailList: e.items.map((r, a) => ({ SerialNum: a + 1, ItemName: r.name, Qty: r.quantity, UnitPrice: r.unitPrice, SupplyCost: r.supplyPrice, Tax: r.taxAmount, Remark: r.description || "" })), SupplyCostTotal: e.totalSupplyPrice.toString(), TaxTotal: e.totalTaxAmount.toString(), TotalAmount: e.totalAmount.toString(), Remark1: e.memo || "", Remark2: e.orderNo || "", SendSMS: false, AutoAccept: false }, s = await fo("/eTaxInvoice/RegistAndIssue", t);
    if (s.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC2E4\uD328: ${s.message}`);
    return { success: true, ntsConfirmNumber: s.ntsconfirmNum, invoiceKey: s.invoiceKey, message: s.message };
  } catch (t) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC2E4\uD328:", t), t;
  }
}
__name(bc, "bc");
async function Tc(e, t, s) {
  try {
    const a = await fo("/eTaxInvoice/Delete", { CorpNum: e, InvoiceKey: t, Memo: s });
    if (a.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uCDE8\uC18C \uC2E4\uD328: ${a.message}`);
    return { success: true, message: a.message };
  } catch (r) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uCDE8\uC18C \uC2E4\uD328:", r), r;
  }
}
__name(Tc, "Tc");
function ds() {
  return false;
}
__name(ds, "ds");
async function vc(e) {
  return await bc(e);
}
__name(vc, "vc");
function Sc(e, t, s) {
  const r = Number(t.total_amount), a = Math.floor(r / 1.1), n = r - a;
  return { supplierBusinessNumber: e.business_number, supplierBusinessName: e.business_name, supplierCEO: e.ceo_name, supplierAddress: e.address, supplierBusinessType: e.business_type, supplierBusinessCategory: e.business_category, supplierEmail: e.email, supplierTel: e.phone, buyerBusinessNumber: t.buyer_business_number, buyerBusinessName: t.buyer_business_name || t.user_name, buyerCEO: t.buyer_ceo_name, buyerAddress: t.shipping_address, buyerEmail: t.user_email, buyerTel: t.shipping_phone, writeDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], purposeType: "01", taxType: "01", items: s.map((o) => {
    const i = Number(o.price) * Number(o.quantity), c = Math.floor(i / 1.1), l = i - c;
    return { name: o.product_name, quantity: Number(o.quantity), unitPrice: Number(o.price), supplyPrice: c, taxAmount: l, description: o.option_name || "" };
  }), totalSupplyPrice: a, totalTaxAmount: n, totalAmount: r, memo: `\uC8FC\uBB38\uBC88\uD638: ${t.order_number}`, orderNo: t.order_number };
}
__name(Sc, "Sc");
var pe = class extends Error {
  static {
    __name(this, "pe");
  }
  constructor(t, s, r) {
    super(t), this.statusCode = s, this.code = r, this.name = "AuthError";
  }
};
function wc(e) {
  return `${crypto.randomUUID()}-${e}`;
}
__name(wc, "wc");
function xc(e) {
  var n, o, i, c, l, u, d;
  const t = e.id.toString(), s = ((n = e.properties) == null ? void 0 : n.nickname) || ((i = (o = e.kakao_account) == null ? void 0 : o.profile) == null ? void 0 : i.nickname) || "Kakao User", r = ((c = e.kakao_account) == null ? void 0 : c.email) || null, a = ((l = e.properties) == null ? void 0 : l.profile_image) || ((d = (u = e.kakao_account) == null ? void 0 : u.profile) == null ? void 0 : d.profile_image_url) || null;
  return { kakaoId: t, nickname: s, email: r, profileImage: a };
}
__name(xc, "xc");
async function Rc(e, t, s, r, a) {
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
    if (!n) throw new pe("Failed to upsert user", 500, "UPSERT_FAILED");
    return console.log("[Auth] \u26A1 User upserted successfully (optimized):", n.id), n;
  } catch (n) {
    throw n instanceof pe ? n : (console.error("[Auth] Database error during upsert:", n), new pe("Database error", 500, "DB_ERROR"));
  }
}
__name(Rc, "Rc");
async function Ic(e) {
  try {
    const t = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${e}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" } });
    if (!t.ok) {
      const r = await t.text();
      throw console.error("[Kakao API] Failed to get user info:", r), new pe("Failed to get user info from Kakao", 401, "KAKAO_USER_INFO_FAILED");
    }
    const s = await t.json();
    if (!s.id) throw new pe("Invalid user data from Kakao", 500, "INVALID_KAKAO_DATA");
    return s;
  } catch (t) {
    throw t instanceof pe ? t : (console.error("[Kakao API] Network error:", t), new pe("Failed to communicate with Kakao API", 503, "KAKAO_API_ERROR"));
  }
}
__name(Ic, "Ic");
async function Pc(e, t, s) {
  try {
    const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: s, redirect_uri: t, code: e }).toString() });
    if (!r.ok) {
      const n = await r.json();
      throw console.error("[Kakao OAuth] Token exchange failed:", n), new pe(`Failed to exchange code: ${n.error_description || n.error}`, 401, n.error || "TOKEN_EXCHANGE_FAILED");
    }
    return (await r.json()).access_token;
  } catch (r) {
    throw r instanceof pe ? r : (console.error("[Kakao OAuth] Network error:", r), new pe("Failed to communicate with Kakao OAuth server", 503, "OAUTH_NETWORK_ERROR"));
  }
}
__name(Pc, "Pc");
async function ho(e, t) {
  const s = await Ic(t), { kakaoId: r, nickname: a, email: n, profileImage: o } = xc(s);
  console.log("[Auth] Processing login for Kakao user:", r);
  const i = await Rc(e, r, a, n, o), c = wc(i.id);
  return { user: i, sessionToken: c };
}
__name(ho, "ho");
async function _o(e, t, s = 30) {
  try {
    const r = await e.get(t, "json");
    if (!r) return console.log(`[Cache MISS] ${t}`), null;
    const a = Date.now() - r.timestamp;
    return a > s * 1e3 ? (console.log(`[Cache EXPIRED] ${t} (age: ${Math.round(a / 1e3)}s)`), null) : (console.log(`[Cache HIT] ${t} (age: ${Math.round(a / 1e3)}s)`), r.data);
  } catch (r) {
    return console.error(`[Cache] Get error for key "${t}":`, r), null;
  }
}
__name(_o, "_o");
async function lr(e, t, s, r = 30) {
  try {
    const a = { data: s, timestamp: Date.now() };
    await e.put(t, JSON.stringify(a), { expirationTtl: r }), console.log(`[Cache SET] ${t} (TTL: ${r}s)`);
  } catch (a) {
    console.error(`[Cache] Set error for key "${t}":`, a);
  }
}
__name(lr, "lr");
function Oc(e) {
  const t = e.req.header("CF-Connecting-IP");
  if (t) return t;
  const s = e.req.header("X-Forwarded-For");
  if (s) return s.split(",")[0].trim();
  const r = e.req.header("X-Real-IP");
  return r || "unknown";
}
__name(Oc, "Oc");
function Ac(e, t) {
  return `ratelimit:${e}:${t}`;
}
__name(Ac, "Ac");
var Pr = /* @__PURE__ */ new Map();
async function Cc(e, t, s) {
  var m;
  const r = new URL(e.req.url).pathname, a = Ac(t, r), n = Date.now(), o = s.windowMs * 1e3, c = e.get("user") && s.authenticatedMultiplier ? s.maxRequests * s.authenticatedMultiplier : s.maxRequests;
  try {
    const _ = (m = e.env) == null ? void 0 : m.RATE_LIMIT_KV;
    if (_) {
      const h = await _.get(a);
      let E;
      h ? (E = JSON.parse(h), n > E.resetTime ? E = { count: 1, resetTime: n + o } : E.count++) : E = { count: 1, resetTime: n + o };
      const v = Math.ceil(o / 1e3);
      await _.put(a, JSON.stringify(E), { expirationTtl: v });
      const b = E.count <= c, y = Math.max(0, c - E.count);
      return { allowed: b, remaining: y, resetTime: E.resetTime };
    }
  } catch (_) {
    console.error("KV Rate Limit Error:", _);
  }
  let l = Pr.get(a);
  l && n > l.resetTime && (Pr.delete(a), l = void 0), l ? l.count++ : l = { count: 1, resetTime: n + o }, Pr.set(a, l);
  const u = l.count <= c, d = Math.max(0, c - l.count);
  return { allowed: u, remaining: d, resetTime: l.resetTime };
}
__name(Cc, "Cc");
function ct(e) {
  return async (t, s) => {
    const r = Oc(t);
    if (e.skipIps && e.skipIps.includes(r)) return s();
    if (e.pathPattern) {
      const n = new URL(t.req.url).pathname;
      if (!e.pathPattern.test(n)) return s();
    }
    const a = await Cc(t, r, e);
    if (t.header("X-RateLimit-Limit", e.maxRequests.toString()), t.header("X-RateLimit-Remaining", a.remaining.toString()), t.header("X-RateLimit-Reset", new Date(a.resetTime).toISOString()), !a.allowed) {
      const n = Math.ceil((a.resetTime - Date.now()) / 1e3);
      return t.header("Retry-After", n.toString()), t.json({ success: false, error: e.message || "Too many requests. Please try again later.", retryAfter: n, resetTime: new Date(a.resetTime).toISOString() }, 429);
    }
    return s();
  };
}
__name(ct, "ct");
var lt = { api: { windowMs: 60, maxRequests: 60, message: "API \uC694\uCCAD \uC81C\uD55C\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", authenticatedMultiplier: 2 }, auth: { windowMs: 60, maxRequests: 5, message: "\uB85C\uADF8\uC778 \uC2DC\uB3C4 \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uBD84 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/auth\// }, order: { windowMs: 60, maxRequests: 10, message: "\uC8FC\uBB38 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders/, authenticatedMultiplier: 2 }, cart: { windowMs: 60, maxRequests: 20, message: "\uC7A5\uBC14\uAD6C\uB2C8 \uC694\uCCAD\uC774 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/cart/, authenticatedMultiplier: 2 }, refund: { windowMs: 3600, maxRequests: 3, message: "\uD658\uBD88 \uC694\uCCAD \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uC2DC\uAC04 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders\/.*\/refund/ }, alimtalk: { windowMs: 60, maxRequests: 10, message: "\uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/seller\/alimtalk\/send/ }, upload: { windowMs: 60, maxRequests: 5, message: "\uD30C\uC77C \uC5C5\uB85C\uB4DC\uAC00 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/.*\/upload/ } };
var Y = class extends Error {
  static {
    __name(this, "Y");
  }
  constructor(t, s, r = "VALIDATION_ERROR") {
    super(s), this.field = t, this.code = r, this.name = "ValidationError";
  }
};
function Dc(e, t) {
  const { field: s, required: r, type: a, min: n, max: o, pattern: i, enum: c, custom: l, message: u } = t;
  if (r && (e == null || e === "")) throw new Y(s, u || `${s}\uC740(\uB294) \uD544\uC218 \uD56D\uBAA9\uC785\uB2C8\uB2E4.`, "REQUIRED");
  if (!(e == null || e === "")) {
    if (a) switch (a) {
      case "string":
        if (typeof e != "string") throw new Y(s, u || `${s}\uC740(\uB294) \uBB38\uC790\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "number":
        const d = typeof e == "string" ? Number(e) : e;
        if (typeof d != "number" || isNaN(d)) throw new Y(s, u || `${s}\uC740(\uB294) \uC22B\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "boolean":
        if (typeof e != "boolean") throw new Y(s, u || `${s}\uC740(\uB294) true/false \uAC12\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "email":
        if (typeof e != "string" || !jc(e)) throw new Y(s, u || `${s}\uC740(\uB294) \uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_EMAIL");
        break;
      case "url":
        if (typeof e != "string" || !Mc(e)) throw new Y(s, u || `${s}\uC740(\uB294) \uC720\uD6A8\uD55C URL\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_URL");
        break;
      case "phone":
        if (typeof e != "string" || !Lc(e)) throw new Y(s, u || `${s}\uC740(\uB294) \uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_PHONE");
        break;
      case "date":
        if (!(e instanceof Date) && !$c(e)) throw new Y(s, u || `${s}\uC740(\uB294) \uC720\uD6A8\uD55C \uB0A0\uC9DC\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_DATE");
        break;
      case "array":
        if (!Array.isArray(e)) throw new Y(s, u || `${s}\uC740(\uB294) \uBC30\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "object":
        if (typeof e != "object" || e === null || Array.isArray(e)) throw new Y(s, u || `${s}\uC740(\uB294) \uAC1D\uCCB4\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
    }
    if (typeof e == "string") {
      if (n !== void 0 && e.length < n) throw new Y(s, u || `${s}\uC740(\uB294) \uCD5C\uC18C ${n}\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SHORT");
      if (o !== void 0 && e.length > o) throw new Y(s, u || `${s}\uC740(\uB294) \uCD5C\uB300 ${o}\uC790 \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LONG");
    }
    if (typeof e == "number") {
      if (n !== void 0 && e < n) throw new Y(s, u || `${s}\uC740(\uB294) \uCD5C\uC18C ${n} \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SMALL");
      if (o !== void 0 && e > o) throw new Y(s, u || `${s}\uC740(\uB294) \uCD5C\uB300 ${o} \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LARGE");
    }
    if (Array.isArray(e)) {
      if (n !== void 0 && e.length < n) throw new Y(s, u || `${s}\uC740(\uB294) \uCD5C\uC18C ${n}\uAC1C \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_FEW");
      if (o !== void 0 && e.length > o) throw new Y(s, u || `${s}\uC740(\uB294) \uCD5C\uB300 ${o}\uAC1C \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_MANY");
    }
    if (i && typeof e == "string" && !i.test(e)) throw new Y(s, u || `${s}\uC758 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "INVALID_FORMAT");
    if (c && !c.includes(e)) throw new Y(s, u || `${s}\uC740(\uB294) \uB2E4\uC74C \uC911 \uD558\uB098\uC5EC\uC57C \uD569\uB2C8\uB2E4: ${c.join(", ")}`, "INVALID_ENUM");
    if (l && l(e) === false) throw new Y(s, u || `${s}\uC758 \uAC12\uC774 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "CUSTOM_VALIDATION_FAILED");
  }
}
__name(Dc, "Dc");
function kc(e, t) {
  for (const s of t) {
    const r = e[s.field];
    Dc(r, s);
  }
}
__name(kc, "kc");
function Nc(e) {
  return async (t, s) => {
    try {
      let r = {};
      const a = t.req.header("content-type") || "";
      a.includes("application/json") ? r = await t.req.json().catch(() => ({})) : (a.includes("application/x-www-form-urlencoded") || a.includes("multipart/form-data")) && (r = await t.req.parseBody().catch(() => ({})));
      const n = new URL(t.req.url);
      for (const [o, i] of n.searchParams.entries()) o in r || (r[o] = i);
      kc(r, e), t.set("validatedData", r), await s();
    } catch (r) {
      if (r instanceof Y) return t.json({ success: false, error: r.message, field: r.field, code: r.code }, 400);
      throw r;
    }
  };
}
__name(Nc, "Nc");
function jc(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}
__name(jc, "jc");
function Mc(e) {
  try {
    const t = new URL(e);
    return t.protocol === "http:" || t.protocol === "https:";
  } catch {
    return false;
  }
}
__name(Mc, "Mc");
function Lc(e) {
  return /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e);
}
__name(Lc, "Lc");
function $c(e) {
  if (typeof e != "string") return false;
  const t = new Date(e);
  return !isNaN(t.getTime());
}
__name($c, "$c");
var Fc = [{ field: "email", required: true, type: "email", max: 255, message: "\uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, { field: "password", required: true, type: "string", min: 8, max: 100, pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: "\uBE44\uBC00\uBC88\uD638\uB294 \uCD5C\uC18C 8\uC790 \uC774\uC0C1, \uB300\uC18C\uBB38\uC790\uC640 \uC22B\uC790\uB97C \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4." }, { field: "name", required: true, type: "string", min: 2, max: 50, message: "\uC774\uB984\uC740 2-50\uC790 \uC0AC\uC774\uC5EC\uC57C \uD569\uB2C8\uB2E4." }, { field: "phone", required: false, type: "phone", message: "\uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694. (\uC608: 010-1234-5678)" }];
function Er(e) {
  const t = new URLSearchParams();
  for (const [s, r] of Object.entries(e)) r != null && t.append(s, String(r));
  return t;
}
__name(Er, "Er");
function oa(e, t) {
  if (e.result_code !== "1") throw new Error(`[Aligo ${t}] ${e.message} (code: ${e.result_code})`);
}
__name(oa, "oa");
async function ia(e) {
  console.log("[Aligo] \uD1A0\uD070 \uC0DD\uC131 \uC2DC\uC791");
  const s = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Er({ apikey: e.ALIGO_API_KEY, userid: e.ALIGO_USER_ID }) })).json();
  return oa(s, "Token Create"), console.log("[Aligo] \u2705 \uD1A0\uD070 \uC0DD\uC131 \uC131\uACF5:", s.token.substring(0, 20) + "..."), { token: s.token, urtime: s.urtime };
}
__name(ia, "ia");
async function Uc(e, t) {
  console.log("[Aligo] \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D:", t.channelId);
  const { token: s } = await ia(e), a = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Er({ token: s, userid: e.ALIGO_USER_ID, plusid: t.channelId, phonenumber: t.phoneNumber }) })).json();
  return oa(a, "Channel Register"), console.log("[Aligo] \u2705 \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D \uC131\uACF5, senderKey:", a.senderkey), { success: true, senderKey: a.senderkey };
}
__name(Uc, "Uc");
async function qc(e, t, s) {
  console.log("[Aligo] \uD15C\uD50C\uB9BF \uB4F1\uB85D:", s.templateCode);
  const { token: r } = await ia(e), n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Er({ token: r, userid: e.ALIGO_USER_ID, senderkey: t, tpl_name: s.name, tpl_content: s.content, tpl_code: s.templateCode }) })).json();
  return oa(n, "Template Register"), console.log("[Aligo] \u2705 \uD15C\uD50C\uB9BF \uB4F1\uB85D \uC131\uACF5:", n.tpl_code), { success: true, templateCode: n.tpl_code };
}
__name(qc, "qc");
async function ca(e, t) {
  console.log("[Aligo] \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1:", t.to);
  try {
    const { token: s } = await ia(e), r = t.buttons ? JSON.stringify({ button: t.buttons }) : void 0, n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Er({ token: s, userid: e.ALIGO_USER_ID, senderkey: t.senderKey, tpl_code: t.templateCode, receiver_1: t.to, subject_1: "\uC54C\uB9BC\uD1A1", message_1: t.message, button_1: r }) })).json();
    return n.result_code !== "1" ? (console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328:", n.message), { success: false, error: n.message }) : (console.log("[Aligo] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5, messageId:", n.msg_id), { success: true, messageId: n.msg_id });
  } catch (s) {
    return console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC5D0\uB7EC:", s.message), { success: false, error: s.message };
  }
}
__name(ca, "ca");
function Hc(e, t) {
  let s = e;
  for (const [r, a] of Object.entries(t)) {
    const n = new RegExp(`#{${r}}`, "g");
    s = s.replace(n, a);
  }
  return s;
}
__name(Hc, "Hc");
function Eo(e) {
  let t = e.replace(/-/g, "");
  if (!t.startsWith("010")) throw new Error("Invalid phone number format. Must start with 010");
  if (t.length !== 11) throw new Error("Invalid phone number length. Must be 11 digits");
  return t;
}
__name(Eo, "Eo");
async function Wc(e, t) {
  const s = await e.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(t).first();
  if (!s) throw new Error(`Order not found: ${t}`);
  const r = await e.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(t).all();
  return { order: s, products: r.results };
}
__name(Wc, "Wc");
async function Bc(e, t) {
  const s = await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(t).first();
  return s || (console.warn(`No active alimtalk account for seller ${t}`), null);
}
__name(Bc, "Bc");
async function Da(e, t) {
  await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(t.seller_id, t.template_code, t.recipient_phone, t.message, t.cost, t.status, t.order_id || null).run();
}
__name(Da, "Da");
async function Kc(e, t, s) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(s, t).run();
}
__name(Kc, "Kc");
async function Gc(e, t) {
  try {
    const { order: s, products: r } = await Wc(e.DB, t), a = await Bc(e.DB, s.seller_id);
    if (!a) return console.warn(`Skipping alimtalk for order ${t}: no active account`), { success: false, reason: "no_account" };
    const n = 15;
    if (a.balance < n) return console.warn(`Skipping alimtalk for order ${t}: insufficient balance`), { success: false, reason: "insufficient_balance" };
    const o = r.map((l) => `${l.name} ${l.quantity}\uAC1C (${l.price.toLocaleString()}\uC6D0)`).join(`
`), i = `[\uC8FC\uBB38 \uD655\uC778]

\uC8FC\uBB38\uBC88\uD638: ${s.order_number}
\uC8FC\uBB38\uC77C\uC2DC: ${new Date(s.created_at).toLocaleString("ko-KR")}

\uC8FC\uBB38 \uC0C1\uD488:
${o}

\uCD1D \uACB0\uC81C\uAE08\uC561: ${s.total_amount.toLocaleString()}\uC6D0

\uBC30\uC1A1\uC9C0: ${s.shipping_address}
\uC218\uB839\uC778: ${s.shipping_name}
\uC5F0\uB77D\uCC98: ${s.shipping_phone}

\uC8FC\uBB38\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4!`, c = await ca(e, { senderKey: a.sender_key, templateCode: "order_confirm", to: s.buyer_phone, message: i });
    return c.success ? (await Kc(e.DB, s.seller_id, n), await Da(e.DB, { seller_id: s.seller_id, template_code: "order_confirm", recipient_phone: s.buyer_phone, message: i, cost: n, status: "sent", order_id: t }), console.log(`Order confirmation sent for order ${t}`), { success: true }) : (await Da(e.DB, { seller_id: s.seller_id, template_code: "order_confirm", recipient_phone: s.buyer_phone, message: i, cost: 0, status: "failed", order_id: t }), console.error(`Failed to send order confirmation for order ${t}:`, c.error), { success: false, error: c.error });
  } catch (s) {
    return console.error(`Error sending order confirmation for order ${t}:`, s), { success: false, error: s.message };
  }
}
__name(Gc, "Gc");
function Vc(e, t) {
  let s = e;
  return Object.entries(t).forEach(([r, a]) => {
    const n = new RegExp(`#{${r}}`, "g");
    s = s.replace(n, a);
  }), s;
}
__name(Vc, "Vc");
function Jc(e, t) {
  const r = Array.from(e.matchAll(/#{(\w+)}/g), (a) => a[1]).filter((a) => !t[a]);
  return { valid: r.length === 0, missingVars: r };
}
__name(Jc, "Jc");
async function Yc(e, t, s) {
  const r = await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(t).first();
  if (!r) throw new Error(`Account not found: ${t}`);
  return { sufficient: r.balance >= s, currentBalance: r.balance };
}
__name(Yc, "Yc");
async function zc(e, t, s) {
  const r = await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(s, t, s).run();
  if (!r.success || r.meta.changes === 0) throw new Error("Insufficient balance or account not found");
}
__name(zc, "zc");
async function ka(e, t, s) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(s, t).run();
}
__name(ka, "ka");
async function Or(e, t) {
  await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(t.accountId, t.templateId, t.orderId || null, t.recipientPhone, t.messageContent, t.status, t.cost, t.aligoMessageId || null, t.failedReason || null).run();
}
__name(Or, "Or");
async function Xc(e, t, s, r) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(s, r, t).run();
}
__name(Xc, "Xc");
async function Qc(e, t, s, r, a, n, o, i, c) {
  try {
    const l = { ...i, ...o.variables }, u = Vc(r, l), d = await ca(e, { senderKey: a, templateCode: n, to: o.phone, message: u });
    return d.success ? (await Or(e.DB, { accountId: t, templateId: s, recipientPhone: o.phone, messageContent: u, status: "sent", cost: c, aligoMessageId: d.messageId }), { phone: o.phone, status: "sent", messageId: d.messageId, cost: c }) : (await Or(e.DB, { accountId: t, templateId: s, recipientPhone: o.phone, messageContent: u, status: "failed", cost: 0, failedReason: d.error }), await ka(e.DB, t, c), { phone: o.phone, status: "failed", error: d.error, cost: 0 });
  } catch (l) {
    return console.error(`Failed to send alimtalk to ${o.phone}:`, l), await Or(e.DB, { accountId: t, templateId: s, recipientPhone: o.phone, messageContent: "", status: "failed", cost: 0, failedReason: l.message }), await ka(e.DB, t, c), { phone: o.phone, status: "failed", error: l.message, cost: 0 };
  }
}
__name(Qc, "Qc");
async function la(e, t) {
  const { accountId: s, templateId: r, recipients: a, variables: n } = t;
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
    `).bind(s).first();
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
    `).bind(r, s).first();
    if (!i) throw new Error("Template not found");
    if (i.status !== "approved") throw new Error("Template is not approved");
    const c = Jc(i.template_content, n);
    if (!c.valid) throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);
    const l = 15, u = a.length * l, d = await Yc(e.DB, s, u);
    if (!d.sufficient) throw new Error(`Insufficient balance. Required: ${u}, Current: ${d.currentBalance}`);
    await zc(e.DB, s, u), console.log(`[Alimtalk] Deducted ${u} points from account ${s}`);
    const m = [];
    let _ = 0, h = 0, E = 0;
    for (const v of a) {
      const b = await Qc(e, s, r, i.template_content, o.sender_key, i.template_code, v, n, l);
      m.push(b), b.status === "sent" ? _++ : (h++, E += l), m.length % 10 === 0 && await new Promise((y) => setTimeout(y, 1e3));
    }
    return await Xc(e.DB, s, _, h), console.log(`[Alimtalk] Completed: ${_} sent, ${h} failed, ${E} refunded`), { success: true, totalRecipients: a.length, successCount: _, failedCount: h, refundedAmount: E, messages: m };
  } catch (o) {
    return console.error("[Alimtalk] Bulk send failed:", o), { success: false, totalRecipients: a.length, successCount: 0, failedCount: a.length, refundedAmount: 0, messages: [], error: o.message };
  }
}
__name(la, "la");
async function Zc(e, t, s, r, a) {
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
  return la(e, { accountId: t, templateId: s, recipients: l, variables: c });
}
__name(Zc, "Zc");
async function el(e, t, s, r, a = {}) {
  const n = r.map((o) => ({ phone: o.phone, name: o.name, variables: Object.entries(o).filter(([i]) => i !== "phone" && i !== "name").reduce((i, [c, l]) => ({ ...i, [c]: l }), {}) }));
  return la(e, { accountId: t, templateId: s, recipients: n, variables: a });
}
__name(el, "el");
function tl(e, t = 0.1) {
  return Math.floor(e * t);
}
__name(tl, "tl");
function sl() {
  const e = /* @__PURE__ */ new Date(), t = new Date(e.getFullYear(), e.getMonth() - 1, 1), s = t.getFullYear(), r = String(t.getMonth() + 1).padStart(2, "0"), a = new Date(s, t.getMonth() + 1, 0).getDate();
  return { startDate: `${s}-${r}-01`, endDate: `${s}-${r}-${a}` };
}
__name(sl, "sl");
async function rl(e, t, s) {
  try {
    const r = await e.prepare(`
      SELECT id, business_name FROM sellers WHERE id = ?
    `).bind(t).first();
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
    `).bind(t, s.startDate, s.endDate).all();
    if (!a.results || a.results.length === 0) return { seller_id: t, seller_name: r.business_name, total_sales: 0, total_orders: 0, platform_fee: 0, shipping_fee: 0, refund_amount: 0, settlement_amount: 0, orders: [] };
    const n = [];
    let o = 0, i = 0, c = 0;
    for (const m of a.results) {
      const _ = m.total_amount - m.shipping_fee, h = tl(_);
      n.push({ order_id: m.id, order_number: m.order_number, order_date: m.created_at, product_name: m.product_names || "", quantity: m.total_quantity || 1, price: _, shipping_fee: m.shipping_fee || 0, platform_fee: h, status: m.status }), o += _, i += m.shipping_fee || 0, c += h;
    }
    const l = await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(t, s.startDate, s.endDate).first(), u = (l == null ? void 0 : l.refund_amount) || 0, d = o - c - u + i;
    return { seller_id: t, seller_name: r.business_name, total_sales: o, total_orders: n.length, platform_fee: c, shipping_fee: i, refund_amount: u, settlement_amount: d, orders: n };
  } catch (r) {
    return console.error(`Failed to calculate settlement for seller ${t}:`, r), null;
  }
}
__name(rl, "rl");
async function al(e, t) {
  console.log(`[Settlement] Generating report for ${t.startDate} ~ ${t.endDate}`);
  const s = await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(t.startDate, t.endDate).all(), r = [];
  let a = 0, n = 0, o = 0;
  for (const c of s.results) {
    const l = await rl(e, c.id, t);
    l && (r.push(l), a += l.total_sales, n += l.platform_fee, o += l.settlement_amount);
  }
  const i = { period: t, generated_at: (/* @__PURE__ */ new Date()).toISOString(), total_sales: a, total_platform_fee: n, total_settlement: o, sellers: r };
  return console.log(`[Settlement] Report generated: ${r.length} sellers, ${a.toLocaleString()}\uC6D0`), i;
}
__name(al, "al");
async function nl(e, t) {
  const r = (await e.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(t.period.startDate, t.period.endDate, t.total_sales, t.total_platform_fee, t.total_settlement, t.generated_at).run()).meta.last_row_id;
  for (const a of t.sellers) await e.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a.seller_id, a.total_sales, a.total_orders, a.platform_fee, a.shipping_fee, a.refund_amount, a.settlement_amount).run();
  console.log(`[Settlement] Report saved: ID ${r}`);
}
__name(nl, "nl");
async function ol(e, t) {
  const s = await e.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(t).first();
  if (!s) return null;
  const a = (await e.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(t).all()).results.map((n) => ({ seller_id: n.seller_id, seller_name: n.seller_name, total_sales: n.total_sales, total_orders: n.total_orders, platform_fee: n.platform_fee, shipping_fee: n.shipping_fee, refund_amount: n.refund_amount, settlement_amount: n.settlement_amount, orders: [] }));
  return { period: { startDate: s.period_start, endDate: s.period_end }, generated_at: s.generated_at, total_sales: s.total_sales, total_platform_fee: s.total_platform_fee, total_settlement: s.total_settlement, sellers: a };
}
__name(ol, "ol");
async function il(e, t) {
  const s = new TextEncoder();
  let r;
  const a = new ReadableStream({ async start(n) {
    console.log(`[SSE] Client connected to stream ${e}`);
    try {
      const o = await t.DB.prepare(`
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
        n.enqueue(s.encode(`data: ${c}

`));
      }
    } catch (o) {
      console.error("[SSE] Failed to fetch initial data:", o);
    }
    r = setInterval(async () => {
      try {
        const o = await t.DB.prepare(`
            SELECT 
              viewer_count,
              like_count,
              comment_count
            FROM live_streams
            WHERE id = ?
          `).bind(e).first();
        if (o) {
          const i = { type: "viewer_count", data: o, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, c = JSON.stringify(i);
          n.enqueue(s.encode(`data: ${c}

`));
        }
        n.enqueue(s.encode(`: ping

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
__name(il, "il");
async function cl(e, t) {
  const s = new TextEncoder();
  let r = 0, a;
  const n = new ReadableStream({ async start(o) {
    console.log(`[SSE Chat] Client connected to stream ${e}`);
    try {
      const i = await t.DB.prepare(`
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
        o.enqueue(s.encode(`data: ${l}

`));
      }
    } catch (i) {
      console.error("[SSE Chat] Failed to fetch initial messages:", i);
    }
    a = setInterval(async () => {
      try {
        const i = await t.DB.prepare(`
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
          o.enqueue(s.encode(`data: ${l}

`));
        } else o.enqueue(s.encode(`: ping

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
__name(cl, "cl");
async function ll(e, t) {
  const s = new TextEncoder();
  let r = 0, a;
  const n = new ReadableStream({ async start(o) {
    console.log(`[SSE Orders] Seller ${e} connected`);
    try {
      const i = await t.DB.prepare(`
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
        const i = await t.DB.prepare(`
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
          o.enqueue(s.encode(`data: ${l}

`));
        } else o.enqueue(s.encode(`: ping

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
__name(ll, "ll");
async function ul(e, t) {
  const s = new TextEncoder();
  let r;
  const a = new ReadableStream({ async start(n) {
    console.log(`[SSE Stock] Seller ${e} connected`), r = setInterval(async () => {
      try {
        const o = await t.DB.prepare(`
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
          n.enqueue(s.encode(`data: ${c}

`));
        } else n.enqueue(s.encode(`: ping

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
__name(ul, "ul");
async function dl(e, t, s, r) {
  await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(t, s, r.endpoint, r.keys.p256dh, r.keys.auth).run(), console.log(`[Push] Subscription saved for ${s} ${t}`);
}
__name(dl, "dl");
async function pl(e, t) {
  await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(t).run(), console.log(`[Push] Subscription deleted: ${t}`);
}
__name(pl, "pl");
function ml(e) {
  if (e.req.method !== "GET") return false;
  const t = e.req.header("Authorization"), s = e.req.header("X-Session-Token");
  if (t || s) return false;
  const a = new URL(e.req.url).pathname;
  return !(a.includes("/api/products/") && a.includes("/stock") || a.includes("/api/streams/") && a.includes("/status") || a.includes("/current-product") || a.includes("/api/chat") || a.includes("/api/sse") || a.includes("/api/orders") || a.includes("/api/payment"));
}
__name(ml, "ml");
function fl(e, t) {
  return t || new URL(e.req.url).toString();
}
__name(fl, "fl");
function hl(e) {
  const t = [];
  return t.push("public"), t.push(`max-age=${e.ttl}`), e.sMaxAge !== void 0 ? t.push(`s-maxage=${e.sMaxAge}`) : t.push(`s-maxage=${e.ttl}`), e.staleWhileRevalidate && t.push(`stale-while-revalidate=${e.staleWhileRevalidate}`), t.join(", ");
}
__name(hl, "hl");
function gr(e) {
  return async (t, s) => {
    var i;
    if (e.skipCache || !ml(t)) return s();
    const r = fl(t, e.cacheKey), a = caches.default;
    let n = await a.match(r);
    if (n) {
      console.log(`[Cache HIT] ${r}`);
      const c = new Headers(n.headers);
      return c.set("X-Cache", "HIT"), c.set("X-Cache-Key", r), new Response(n.body, { status: n.status, statusText: n.statusText, headers: c });
    }
    console.log(`[Cache MISS] ${r}`), await s();
    const o = t.res;
    if (o.status >= 200 && o.status < 300) {
      const c = hl(e);
      o.headers.set("Cache-Control", c), o.headers.set("X-Cache", "MISS"), o.headers.set("X-Cache-Key", r);
      const l = e.varyBy || ["Accept-Encoding"];
      o.headers.set("Vary", l.join(", "));
      const u = o.clone();
      (i = t.executionCtx) == null || i.waitUntil(a.put(r, u));
    }
  };
}
__name(gr, "gr");
var yr = { products: { ttl: 10, sMaxAge: 60, staleWhileRevalidate: 120 }, liveStreams: { ttl: 5, sMaxAge: 10, staleWhileRevalidate: 30 }, microCache: { ttl: 10, sMaxAge: 10, staleWhileRevalidate: 30 } };
var _l = class extends Error {
  static {
    __name(this, "_l");
  }
  constructor(t, s, r, a) {
    super(r), this.statusCode = t, this.code = s, this.details = a, this.name = "AppError", Error.captureStackTrace(this, this.constructor);
  }
};
async function El(e, t, s, r) {
  if (e) try {
    const a = { title: `\u2705 ${t}`, description: s, color: 3066993, fields: [], timestamp: (/* @__PURE__ */ new Date()).toISOString(), footer: { text: "UR LIVE Monitor" } };
    if (r) for (const [n, o] of Object.entries(r)) a.fields.push({ name: n, value: String(o), inline: true });
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [a] }) });
  } catch (a) {
    console.error("[Discord] Failed to send success alert:", a);
  }
}
__name(El, "El");
async function gl(e, t, s) {
  if (e) try {
    const r = ["\u{1F4CA} **KV \uC0AC\uC6A9\uB7C9 \uACBD\uACE0**", "", "\uD604\uC7AC \uC0AC\uC6A9\uB7C9:", `\u2022 \uC77D\uAE30: ${t.toFixed(1)}%`, `\u2022 \uC4F0\uAE30: ${s.toFixed(1)}%`, "", "50% \uC774\uC0C1 \uC0AC\uC6A9 \uC911\uC785\uB2C8\uB2E4. \uC720\uB8CC \uD50C\uB79C \uC5C5\uADF8\uB808\uC774\uB4DC\uB97C \uACE0\uB824\uD558\uC138\uC694.", "https://dash.cloudflare.com"].join(`
`);
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: r }) });
  } catch (r) {
    console.error("[Discord] Failed to send KV warning:", r);
  }
}
__name(gl, "gl");
var go = class {
  static {
    __name(this, "go");
  }
  constructor(t) {
    this.accessToken = null, this.tokenExpiry = 0, this.databaseURL = t.FIREBASE_DATABASE_URL, this.projectId = t.FIREBASE_PROJECT_ID, this.privateKey = t.FIREBASE_PRIVATE_KEY, this.clientEmail = t.FIREBASE_CLIENT_EMAIL, (!this.databaseURL || !this.projectId || !this.privateKey || !this.clientEmail) && console.warn("\u26A0\uFE0F Firebase Admin credentials not configured, using unauthenticated mode");
  }
  async set(t, s) {
    const r = `${this.databaseURL}/${t}.json`, a = await fetch(r, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    if (!a.ok) {
      const n = await a.text();
      throw console.error(`\u274C Firebase set failed for ${t}:`, n), new Error(`Firebase set failed: ${a.statusText}`);
    }
    console.log(`\u2705 Firebase: Set data at ${t}`);
  }
  async update(t, s) {
    const r = `${this.databaseURL}/${t}.json`, a = await fetch(r, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    if (!a.ok) {
      const n = await a.text();
      throw console.error(`\u274C Firebase update failed for ${t}:`, n), new Error(`Firebase update failed: ${a.statusText}`);
    }
    console.log(`\u2705 Firebase: Updated data at ${t}`);
  }
  async get(t) {
    const s = `${this.databaseURL}/${t}.json`, r = await fetch(s, { method: "GET" });
    if (!r.ok) throw new Error(`Firebase get failed: ${r.statusText}`);
    return await r.json();
  }
  async delete(t) {
    const s = `${this.databaseURL}/${t}.json`, r = await fetch(s, { method: "DELETE" });
    if (!r.ok) throw new Error(`Firebase delete failed: ${r.statusText}`);
    console.log(`\u2705 Firebase: Deleted data at ${t}`);
  }
  async updateStreamStatus(t, s) {
    try {
      await this.update(`streams/stream${t}`, { ...s, updated_at: Date.now() }), console.log(`\u2705 Firebase: Stream ${t} updated`, s);
    } catch (r) {
      console.error(`\u274C Firebase: Failed to update stream ${t}`, r);
    }
  }
  async updateProductStock(t, s, r) {
    try {
      await this.update(`products/product${t}`, { id: t, stock: s, ...r, updated_at: Date.now() }), console.log(`\u2705 Firebase: Product ${t} stock updated to ${s}`);
    } catch (a) {
      console.error(`\u274C Firebase: Failed to update product ${t}`, a);
    }
  }
  async changeCurrentProduct(t, s) {
    try {
      await this.updateStreamStatus(t, { current_product_id: s }), console.log(`\u2705 Firebase: Stream ${t} current product changed to ${s}`);
    } catch (r) {
      console.error(`\u274C Firebase: Failed to change product for stream ${t}`, r);
    }
  }
  async sendLowStockAlert(t, s, r) {
    try {
      const a = `chats/stream${t}`, n = Date.now();
      await this.set(`${a}/alert_${n}`, { username: "\uC2DC\uC2A4\uD15C", text: `\u26A0\uFE0F ${s}\uC758 \uC7AC\uACE0\uAC00 ${r}\uAC1C \uB0A8\uC558\uC2B5\uB2C8\uB2E4!`, timestamp: n, isSystem: true }), console.log(`\u2705 Firebase: Low stock alert sent for stream ${t}`);
    } catch (a) {
      console.error("\u274C Firebase: Failed to send low stock alert", a);
    }
  }
  async sendSoldOutAlert(t, s) {
    try {
      const r = `chats/stream${t}`, a = Date.now();
      await this.set(`${r}/soldout_${a}`, { username: "\uC2DC\uC2A4\uD15C", text: `\u{1F534} ${s}\uC774(\uAC00) \uD488\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4!`, timestamp: a, isSystem: true }), console.log(`\u2705 Firebase: Sold out alert sent for stream ${t}`);
    } catch (r) {
      console.error("\u274C Firebase: Failed to send sold out alert", r);
    }
  }
  async createCustomToken(t, s) {
    try {
      if (console.log(`[Firebase Custom Token] Creating for UID: ${t}`), console.log("[Firebase Custom Token] Claims:", JSON.stringify(s)), !this.privateKey || !this.clientEmail || !this.projectId) {
        const b = [];
        throw this.privateKey || b.push("FIREBASE_PRIVATE_KEY"), this.clientEmail || b.push("FIREBASE_CLIENT_EMAIL"), this.projectId || b.push("FIREBASE_PROJECT_ID"), new Error(`Firebase credentials not configured: missing ${b.join(", ")}`);
      }
      console.log(`[Firebase Custom Token] Using project: ${this.projectId}`), console.log(`[Firebase Custom Token] Using service account: ${this.clientEmail}`);
      const r = { alg: "RS256", typ: "JWT" }, a = Math.floor(Date.now() / 1e3), n = { iss: this.clientEmail, sub: this.clientEmail, aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit", iat: a, exp: a + 3600, uid: t, claims: s || {} }, o = /* @__PURE__ */ __name((b) => {
        const y = JSON.stringify(b), S = new TextEncoder().encode(y);
        let g = "";
        for (let k = 0; k < S.length; k++) g += String.fromCharCode(S[k]);
        return btoa(g).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      }, "o");
      console.log("[Firebase Custom Token] Encoding header and payload...");
      const i = o(r), c = o(n), l = `${i}.${c}`;
      console.log("[Firebase Custom Token] Parsing private key...");
      const u = this.privateKey.replace(/\\n/g, `
`);
      if (!u.includes("-----BEGIN PRIVATE KEY-----")) throw new Error("Invalid private key format: missing PEM header");
      if (!u.includes("-----END PRIVATE KEY-----")) throw new Error("Invalid private key format: missing PEM footer");
      console.log("[Firebase Custom Token] Converting PEM to DER...");
      const d = await this.pemToDer(u);
      console.log("[Firebase Custom Token] Importing crypto key...");
      const m = await crypto.subtle.importKey("pkcs8", d, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
      console.log("[Firebase Custom Token] Signing token...");
      const _ = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", m, new TextEncoder().encode(l)), E = btoa(String.fromCharCode(...new Uint8Array(_))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""), v = `${l}.${E}`;
      return console.log("[Firebase Custom Token] \u2705 Token created successfully"), v;
    } catch (r) {
      throw console.error("[Firebase Custom Token] \u274C Failed to create token:", r), console.error("[Firebase Custom Token] Error name:", r.name), console.error("[Firebase Custom Token] Error message:", r.message), console.error("[Firebase Custom Token] Error stack:", r.stack), new Error(`Failed to create Firebase custom token: ${r.message}`);
    }
  }
  async pemToDer(t) {
    const a = t.substring("-----BEGIN PRIVATE KEY-----".length, t.length - "-----END PRIVATE KEY-----".length - 1).trim(), n = atob(a), o = new Uint8Array(n.length);
    for (let i = 0; i < n.length; i++) o[i] = n.charCodeAt(i);
    return o.buffer;
  }
};
function Mt(e) {
  return new go(e);
}
__name(Mt, "Mt");
async function yl(e, t, s) {
  try {
    t === "stream" ? await e.updateStreamStatus(s.id, { id: s.id, title: s.title, status: s.status, current_product_id: s.current_product_id, viewer_count: s.viewer_count || 0, seller_id: s.seller_id, youtube_video_id: s.youtube_video_id }) : t === "product" && await e.updateProductStock(s.id, s.stock, { name: s.name, price: s.price, original_price: s.original_price, discount_rate: s.discount_rate, image_url: s.image_url });
  } catch (r) {
    console.error(`\u274C Firebase sync failed for ${t}:`, r);
  }
}
__name(yl, "yl");
var bl = Object.freeze(Object.defineProperty({ __proto__: null, FirebaseAdmin: go, initFirebaseAdmin: Mt, syncD1ToFirebase: yl }, Symbol.toStringTag, { value: "Module" }));
var ua = crypto;
var yo = /* @__PURE__ */ __name((e) => e instanceof CryptoKey, "yo");
var Ds = new TextEncoder();
var br = new TextDecoder();
function Tl(...e) {
  const t = e.reduce((a, { length: n }) => a + n, 0), s = new Uint8Array(t);
  let r = 0;
  for (const a of e) s.set(a, r), r += a.length;
  return s;
}
__name(Tl, "Tl");
var vl = /* @__PURE__ */ __name((e) => {
  const t = atob(e), s = new Uint8Array(t.length);
  for (let r = 0; r < t.length; r++) s[r] = t.charCodeAt(r);
  return s;
}, "vl");
var ot = /* @__PURE__ */ __name((e) => {
  let t = e;
  t instanceof Uint8Array && (t = br.decode(t)), t = t.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  try {
    return vl(t);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}, "ot");
var re = class extends Error {
  static {
    __name(this, "re");
  }
  constructor(t, s) {
    var r;
    super(t, s), this.code = "ERR_JOSE_GENERIC", this.name = this.constructor.name, (r = Error.captureStackTrace) == null || r.call(Error, this, this.constructor);
  }
};
re.code = "ERR_JOSE_GENERIC";
var he = class extends re {
  static {
    __name(this, "he");
  }
  constructor(t, s, r = "unspecified", a = "unspecified") {
    super(t, { cause: { claim: r, reason: a, payload: s } }), this.code = "ERR_JWT_CLAIM_VALIDATION_FAILED", this.claim = r, this.reason = a, this.payload = s;
  }
};
he.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
var hs = class extends re {
  static {
    __name(this, "hs");
  }
  constructor(t, s, r = "unspecified", a = "unspecified") {
    super(t, { cause: { claim: r, reason: a, payload: s } }), this.code = "ERR_JWT_EXPIRED", this.claim = r, this.reason = a, this.payload = s;
  }
};
hs.code = "ERR_JWT_EXPIRED";
var bo = class extends re {
  static {
    __name(this, "bo");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JOSE_ALG_NOT_ALLOWED";
  }
};
bo.code = "ERR_JOSE_ALG_NOT_ALLOWED";
var we = class extends re {
  static {
    __name(this, "we");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JOSE_NOT_SUPPORTED";
  }
};
we.code = "ERR_JOSE_NOT_SUPPORTED";
var Sl = class extends re {
  static {
    __name(this, "Sl");
  }
  constructor(t = "decryption operation failed", s) {
    super(t, s), this.code = "ERR_JWE_DECRYPTION_FAILED";
  }
};
Sl.code = "ERR_JWE_DECRYPTION_FAILED";
var wl = class extends re {
  static {
    __name(this, "wl");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWE_INVALID";
  }
};
wl.code = "ERR_JWE_INVALID";
var ee = class extends re {
  static {
    __name(this, "ee");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWS_INVALID";
  }
};
ee.code = "ERR_JWS_INVALID";
var xs = class extends re {
  static {
    __name(this, "xs");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWT_INVALID";
  }
};
xs.code = "ERR_JWT_INVALID";
var xl = class extends re {
  static {
    __name(this, "xl");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWK_INVALID";
  }
};
xl.code = "ERR_JWK_INVALID";
var da = class extends re {
  static {
    __name(this, "da");
  }
  constructor() {
    super(...arguments), this.code = "ERR_JWKS_INVALID";
  }
};
da.code = "ERR_JWKS_INVALID";
var pa = class extends re {
  static {
    __name(this, "pa");
  }
  constructor(t = "no applicable key found in the JSON Web Key Set", s) {
    super(t, s), this.code = "ERR_JWKS_NO_MATCHING_KEY";
  }
};
pa.code = "ERR_JWKS_NO_MATCHING_KEY";
var To = class extends re {
  static {
    __name(this, "To");
  }
  constructor(t = "multiple matching keys found in the JSON Web Key Set", s) {
    super(t, s), this.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  }
};
To.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
var vo = class extends re {
  static {
    __name(this, "vo");
  }
  constructor(t = "request timed out", s) {
    super(t, s), this.code = "ERR_JWKS_TIMEOUT";
  }
};
vo.code = "ERR_JWKS_TIMEOUT";
var So = class extends re {
  static {
    __name(this, "So");
  }
  constructor(t = "signature verification failed", s) {
    super(t, s), this.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  }
};
So.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
function Te(e, t = "algorithm.name") {
  return new TypeError(`CryptoKey does not support this operation, its ${t} must be ${e}`);
}
__name(Te, "Te");
function Wt(e, t) {
  return e.name === t;
}
__name(Wt, "Wt");
function Ar(e) {
  return parseInt(e.name.slice(4), 10);
}
__name(Ar, "Ar");
function Rl(e) {
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
__name(Rl, "Rl");
function Il(e, t) {
  if (t.length && !t.some((s) => e.usages.includes(s))) {
    let s = "CryptoKey does not support this operation, its usages must include ";
    if (t.length > 2) {
      const r = t.pop();
      s += `one of ${t.join(", ")}, or ${r}.`;
    } else t.length === 2 ? s += `one of ${t[0]} or ${t[1]}.` : s += `${t[0]}.`;
    throw new TypeError(s);
  }
}
__name(Il, "Il");
function Pl(e, t, ...s) {
  switch (t) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!Wt(e.algorithm, "HMAC")) throw Te("HMAC");
      const r = parseInt(t.slice(2), 10);
      if (Ar(e.algorithm.hash) !== r) throw Te(`SHA-${r}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!Wt(e.algorithm, "RSASSA-PKCS1-v1_5")) throw Te("RSASSA-PKCS1-v1_5");
      const r = parseInt(t.slice(2), 10);
      if (Ar(e.algorithm.hash) !== r) throw Te(`SHA-${r}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!Wt(e.algorithm, "RSA-PSS")) throw Te("RSA-PSS");
      const r = parseInt(t.slice(2), 10);
      if (Ar(e.algorithm.hash) !== r) throw Te(`SHA-${r}`, "algorithm.hash");
      break;
    }
    case "EdDSA": {
      if (e.algorithm.name !== "Ed25519" && e.algorithm.name !== "Ed448") throw Te("Ed25519 or Ed448");
      break;
    }
    case "Ed25519": {
      if (!Wt(e.algorithm, "Ed25519")) throw Te("Ed25519");
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!Wt(e.algorithm, "ECDSA")) throw Te("ECDSA");
      const r = Rl(t);
      if (e.algorithm.namedCurve !== r) throw Te(r, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  Il(e, s);
}
__name(Pl, "Pl");
function wo(e, t, ...s) {
  var r;
  if (s = s.filter(Boolean), s.length > 2) {
    const a = s.pop();
    e += `one of type ${s.join(", ")}, or ${a}.`;
  } else s.length === 2 ? e += `one of type ${s[0]} or ${s[1]}.` : e += `of type ${s[0]}.`;
  return t == null ? e += ` Received ${t}` : typeof t == "function" && t.name ? e += ` Received function ${t.name}` : typeof t == "object" && t != null && (r = t.constructor) != null && r.name && (e += ` Received an instance of ${t.constructor.name}`), e;
}
__name(wo, "wo");
var Na = /* @__PURE__ */ __name((e, ...t) => wo("Key must be ", e, ...t), "Na");
function xo(e, t, ...s) {
  return wo(`Key for the ${e} algorithm must be `, t, ...s);
}
__name(xo, "xo");
var Ro = /* @__PURE__ */ __name((e) => yo(e) ? true : (e == null ? void 0 : e[Symbol.toStringTag]) === "KeyObject", "Ro");
var ur = ["CryptoKey"];
var Ol = /* @__PURE__ */ __name((...e) => {
  const t = e.filter(Boolean);
  if (t.length === 0 || t.length === 1) return true;
  let s;
  for (const r of t) {
    const a = Object.keys(r);
    if (!s || s.size === 0) {
      s = new Set(a);
      continue;
    }
    for (const n of a) {
      if (s.has(n)) return false;
      s.add(n);
    }
  }
  return true;
}, "Ol");
function Al(e) {
  return typeof e == "object" && e !== null;
}
__name(Al, "Al");
function Ge(e) {
  if (!Al(e) || Object.prototype.toString.call(e) !== "[object Object]") return false;
  if (Object.getPrototypeOf(e) === null) return true;
  let t = e;
  for (; Object.getPrototypeOf(t) !== null; ) t = Object.getPrototypeOf(t);
  return Object.getPrototypeOf(e) === t;
}
__name(Ge, "Ge");
var Cl = /* @__PURE__ */ __name((e, t) => {
  if (e.startsWith("RS") || e.startsWith("PS")) {
    const { modulusLength: s } = t.algorithm;
    if (typeof s != "number" || s < 2048) throw new TypeError(`${e} requires key modulusLength to be 2048 bits or larger`);
  }
}, "Cl");
function Lt(e) {
  return Ge(e) && typeof e.kty == "string";
}
__name(Lt, "Lt");
function Dl(e) {
  return e.kty !== "oct" && typeof e.d == "string";
}
__name(Dl, "Dl");
function kl(e) {
  return e.kty !== "oct" && typeof e.d > "u";
}
__name(kl, "kl");
function Nl(e) {
  return Lt(e) && e.kty === "oct" && typeof e.k == "string";
}
__name(Nl, "Nl");
function jl(e) {
  let t, s;
  switch (e.kty) {
    case "RSA": {
      switch (e.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          t = { name: "RSA-PSS", hash: `SHA-${e.alg.slice(-3)}` }, s = e.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          t = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${e.alg.slice(-3)}` }, s = e.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          t = { name: "RSA-OAEP", hash: `SHA-${parseInt(e.alg.slice(-3), 10) || 1}` }, s = e.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new we('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (e.alg) {
        case "ES256":
          t = { name: "ECDSA", namedCurve: "P-256" }, s = e.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          t = { name: "ECDSA", namedCurve: "P-384" }, s = e.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          t = { name: "ECDSA", namedCurve: "P-521" }, s = e.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          t = { name: "ECDH", namedCurve: e.crv }, s = e.d ? ["deriveBits"] : [];
          break;
        default:
          throw new we('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (e.alg) {
        case "Ed25519":
          t = { name: "Ed25519" }, s = e.d ? ["sign"] : ["verify"];
          break;
        case "EdDSA":
          t = { name: e.crv }, s = e.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          t = { name: e.crv }, s = e.d ? ["deriveBits"] : [];
          break;
        default:
          throw new we('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new we('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm: t, keyUsages: s };
}
__name(jl, "jl");
var Io = /* @__PURE__ */ __name(async (e) => {
  if (!e.alg) throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  const { algorithm: t, keyUsages: s } = jl(e), r = [t, e.ext ?? false, e.key_ops ?? s], a = { ...e };
  return delete a.alg, delete a.use, ua.subtle.importKey("jwk", a, ...r);
}, "Io");
var Po = /* @__PURE__ */ __name((e) => ot(e), "Po");
var pt;
var mt;
var Oo = /* @__PURE__ */ __name((e) => (e == null ? void 0 : e[Symbol.toStringTag]) === "KeyObject", "Oo");
var dr = /* @__PURE__ */ __name(async (e, t, s, r, a = false) => {
  let n = e.get(t);
  if (n != null && n[r]) return n[r];
  const o = await Io({ ...s, alg: r });
  return a && Object.freeze(t), n ? n[r] = o : e.set(t, { [r]: o }), o;
}, "dr");
var Ml = /* @__PURE__ */ __name((e, t) => {
  if (Oo(e)) {
    let s = e.export({ format: "jwk" });
    return delete s.d, delete s.dp, delete s.dq, delete s.p, delete s.q, delete s.qi, s.k ? Po(s.k) : (mt || (mt = /* @__PURE__ */ new WeakMap()), dr(mt, e, s, t));
  }
  return Lt(e) ? e.k ? ot(e.k) : (mt || (mt = /* @__PURE__ */ new WeakMap()), dr(mt, e, e, t, true)) : e;
}, "Ml");
var Ll = /* @__PURE__ */ __name((e, t) => {
  if (Oo(e)) {
    let s = e.export({ format: "jwk" });
    return s.k ? Po(s.k) : (pt || (pt = /* @__PURE__ */ new WeakMap()), dr(pt, e, s, t));
  }
  return Lt(e) ? e.k ? ot(e.k) : (pt || (pt = /* @__PURE__ */ new WeakMap()), dr(pt, e, e, t, true)) : e;
}, "Ll");
var $l = { normalizePublicKey: Ml, normalizePrivateKey: Ll };
async function Ao(e, t) {
  if (!Ge(e)) throw new TypeError("JWK must be an object");
  switch (t || (t = e.alg), e.kty) {
    case "oct":
      if (typeof e.k != "string" || !e.k) throw new TypeError('missing "k" (Key Value) Parameter value');
      return ot(e.k);
    case "RSA":
      if ("oth" in e && e.oth !== void 0) throw new we('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
    case "EC":
    case "OKP":
      return Io({ ...e, alg: t });
    default:
      throw new we('Unsupported "kty" (Key Type) Parameter value');
  }
}
__name(Ao, "Ao");
var It = /* @__PURE__ */ __name((e) => e == null ? void 0 : e[Symbol.toStringTag], "It");
var Xr = /* @__PURE__ */ __name((e, t, s) => {
  var r, a;
  if (t.use !== void 0 && t.use !== "sig") throw new TypeError("Invalid key for this operation, when present its use must be sig");
  if (t.key_ops !== void 0 && ((a = (r = t.key_ops).includes) == null ? void 0 : a.call(r, s)) !== true) throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${s}`);
  if (t.alg !== void 0 && t.alg !== e) throw new TypeError(`Invalid key for this operation, when present its alg must be ${e}`);
  return true;
}, "Xr");
var Fl = /* @__PURE__ */ __name((e, t, s, r) => {
  if (!(t instanceof Uint8Array)) {
    if (r && Lt(t)) {
      if (Nl(t) && Xr(e, t, s)) return;
      throw new TypeError('JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present');
    }
    if (!Ro(t)) throw new TypeError(xo(e, t, ...ur, "Uint8Array", r ? "JSON Web Key" : null));
    if (t.type !== "secret") throw new TypeError(`${It(t)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "Fl");
var Ul = /* @__PURE__ */ __name((e, t, s, r) => {
  if (r && Lt(t)) switch (s) {
    case "sign":
      if (Dl(t) && Xr(e, t, s)) return;
      throw new TypeError("JSON Web Key for this operation be a private JWK");
    case "verify":
      if (kl(t) && Xr(e, t, s)) return;
      throw new TypeError("JSON Web Key for this operation be a public JWK");
  }
  if (!Ro(t)) throw new TypeError(xo(e, t, ...ur, r ? "JSON Web Key" : null));
  if (t.type === "secret") throw new TypeError(`${It(t)} instances for asymmetric algorithms must not be of type "secret"`);
  if (s === "sign" && t.type === "public") throw new TypeError(`${It(t)} instances for asymmetric algorithm signing must be of type "private"`);
  if (s === "decrypt" && t.type === "public") throw new TypeError(`${It(t)} instances for asymmetric algorithm decryption must be of type "private"`);
  if (t.algorithm && s === "verify" && t.type === "private") throw new TypeError(`${It(t)} instances for asymmetric algorithm verifying must be of type "public"`);
  if (t.algorithm && s === "encrypt" && t.type === "private") throw new TypeError(`${It(t)} instances for asymmetric algorithm encryption must be of type "public"`);
}, "Ul");
function Co(e, t, s, r) {
  t.startsWith("HS") || t === "dir" || t.startsWith("PBES2") || /^A\d{3}(?:GCM)?KW$/.test(t) ? Fl(t, s, r, e) : Ul(t, s, r, e);
}
__name(Co, "Co");
Co.bind(void 0, false);
var ja = Co.bind(void 0, true);
function ql(e, t, s, r, a) {
  if (a.crit !== void 0 && (r == null ? void 0 : r.crit) === void 0) throw new e('"crit" (Critical) Header Parameter MUST be integrity protected');
  if (!r || r.crit === void 0) return /* @__PURE__ */ new Set();
  if (!Array.isArray(r.crit) || r.crit.length === 0 || r.crit.some((o) => typeof o != "string" || o.length === 0)) throw new e('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  let n;
  s !== void 0 ? n = new Map([...Object.entries(s), ...t.entries()]) : n = t;
  for (const o of r.crit) {
    if (!n.has(o)) throw new we(`Extension Header Parameter "${o}" is not recognized`);
    if (a[o] === void 0) throw new e(`Extension Header Parameter "${o}" is missing`);
    if (n.get(o) && r[o] === void 0) throw new e(`Extension Header Parameter "${o}" MUST be integrity protected`);
  }
  return new Set(r.crit);
}
__name(ql, "ql");
var Hl = /* @__PURE__ */ __name((e, t) => {
  if (t !== void 0 && (!Array.isArray(t) || t.some((s) => typeof s != "string"))) throw new TypeError(`"${e}" option must be an array of strings`);
  if (t) return new Set(t);
}, "Hl");
function Wl(e, t) {
  const s = `SHA-${e.slice(-3)}`;
  switch (e) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash: s, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash: s, name: "RSA-PSS", saltLength: e.slice(-3) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash: s, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash: s, name: "ECDSA", namedCurve: t.namedCurve };
    case "Ed25519":
      return { name: "Ed25519" };
    case "EdDSA":
      return { name: t.name };
    default:
      throw new we(`alg ${e} is not supported either by JOSE or your javascript runtime`);
  }
}
__name(Wl, "Wl");
async function Bl(e, t, s) {
  if (t = await $l.normalizePublicKey(t, e), yo(t)) return Pl(t, e, s), t;
  if (t instanceof Uint8Array) {
    if (!e.startsWith("HS")) throw new TypeError(Na(t, ...ur));
    return ua.subtle.importKey("raw", t, { hash: `SHA-${e.slice(-3)}`, name: "HMAC" }, false, [s]);
  }
  throw new TypeError(Na(t, ...ur, "Uint8Array", "JSON Web Key"));
}
__name(Bl, "Bl");
var Kl = /* @__PURE__ */ __name(async (e, t, s, r) => {
  const a = await Bl(e, t, "verify");
  Cl(e, a);
  const n = Wl(e, a.algorithm);
  try {
    return await ua.subtle.verify(n, a, s, r);
  } catch {
    return false;
  }
}, "Kl");
async function Gl(e, t, s) {
  if (!Ge(e)) throw new ee("Flattened JWS must be an object");
  if (e.protected === void 0 && e.header === void 0) throw new ee('Flattened JWS must have either of the "protected" or "header" members');
  if (e.protected !== void 0 && typeof e.protected != "string") throw new ee("JWS Protected Header incorrect type");
  if (e.payload === void 0) throw new ee("JWS Payload missing");
  if (typeof e.signature != "string") throw new ee("JWS Signature missing or incorrect type");
  if (e.header !== void 0 && !Ge(e.header)) throw new ee("JWS Unprotected Header incorrect type");
  let r = {};
  if (e.protected) try {
    const E = ot(e.protected);
    r = JSON.parse(br.decode(E));
  } catch {
    throw new ee("JWS Protected Header is invalid");
  }
  if (!Ol(r, e.header)) throw new ee("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const a = { ...r, ...e.header }, n = ql(ee, /* @__PURE__ */ new Map([["b64", true]]), s == null ? void 0 : s.crit, r, a);
  let o = true;
  if (n.has("b64") && (o = r.b64, typeof o != "boolean")) throw new ee('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
  const { alg: i } = a;
  if (typeof i != "string" || !i) throw new ee('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  const c = s && Hl("algorithms", s.algorithms);
  if (c && !c.has(i)) throw new bo('"alg" (Algorithm) Header Parameter value not allowed');
  if (o) {
    if (typeof e.payload != "string") throw new ee("JWS Payload must be a string");
  } else if (typeof e.payload != "string" && !(e.payload instanceof Uint8Array)) throw new ee("JWS Payload must be a string or an Uint8Array instance");
  let l = false;
  typeof t == "function" ? (t = await t(r, e), l = true, ja(i, t, "verify"), Lt(t) && (t = await Ao(t, i))) : ja(i, t, "verify");
  const u = Tl(Ds.encode(e.protected ?? ""), Ds.encode("."), typeof e.payload == "string" ? Ds.encode(e.payload) : e.payload);
  let d;
  try {
    d = ot(e.signature);
  } catch {
    throw new ee("Failed to base64url decode the signature");
  }
  if (!await Kl(i, t, d, u)) throw new So();
  let _;
  if (o) try {
    _ = ot(e.payload);
  } catch {
    throw new ee("Failed to base64url decode the payload");
  }
  else typeof e.payload == "string" ? _ = Ds.encode(e.payload) : _ = e.payload;
  const h = { payload: _ };
  return e.protected !== void 0 && (h.protectedHeader = r), e.header !== void 0 && (h.unprotectedHeader = e.header), l ? { ...h, key: t } : h;
}
__name(Gl, "Gl");
async function Vl(e, t, s) {
  if (e instanceof Uint8Array && (e = br.decode(e)), typeof e != "string") throw new ee("Compact JWS must be a string or Uint8Array");
  const { 0: r, 1: a, 2: n, length: o } = e.split(".");
  if (o !== 3) throw new ee("Invalid Compact JWS");
  const i = await Gl({ payload: a, protected: r, signature: n }, t, s), c = { payload: i.payload, protectedHeader: i.protectedHeader };
  return typeof t == "function" ? { ...c, key: i.key } : c;
}
__name(Vl, "Vl");
var Jl = /* @__PURE__ */ __name((e) => Math.floor(e.getTime() / 1e3), "Jl");
var Do = 60;
var ko = Do * 60;
var ma = ko * 24;
var Yl = ma * 7;
var zl = ma * 365.25;
var Xl = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var Ma = /* @__PURE__ */ __name((e) => {
  const t = Xl.exec(e);
  if (!t || t[4] && t[1]) throw new TypeError("Invalid time period format");
  const s = parseFloat(t[2]), r = t[3].toLowerCase();
  let a;
  switch (r) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      a = Math.round(s);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      a = Math.round(s * Do);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      a = Math.round(s * ko);
      break;
    case "day":
    case "days":
    case "d":
      a = Math.round(s * ma);
      break;
    case "week":
    case "weeks":
    case "w":
      a = Math.round(s * Yl);
      break;
    default:
      a = Math.round(s * zl);
      break;
  }
  return t[1] === "-" || t[4] === "ago" ? -a : a;
}, "Ma");
var La = /* @__PURE__ */ __name((e) => e.toLowerCase().replace(/^application\//, ""), "La");
var Ql = /* @__PURE__ */ __name((e, t) => typeof e == "string" ? t.includes(e) : Array.isArray(e) ? t.some(Set.prototype.has.bind(new Set(e))) : false, "Ql");
var Zl = /* @__PURE__ */ __name((e, t, s = {}) => {
  let r;
  try {
    r = JSON.parse(br.decode(t));
  } catch {
  }
  if (!Ge(r)) throw new xs("JWT Claims Set must be a top-level JSON object");
  const { typ: a } = s;
  if (a && (typeof e.typ != "string" || La(e.typ) !== La(a))) throw new he('unexpected "typ" JWT header value', r, "typ", "check_failed");
  const { requiredClaims: n = [], issuer: o, subject: i, audience: c, maxTokenAge: l } = s, u = [...n];
  l !== void 0 && u.push("iat"), c !== void 0 && u.push("aud"), i !== void 0 && u.push("sub"), o !== void 0 && u.push("iss");
  for (const h of new Set(u.reverse())) if (!(h in r)) throw new he(`missing required "${h}" claim`, r, h, "missing");
  if (o && !(Array.isArray(o) ? o : [o]).includes(r.iss)) throw new he('unexpected "iss" claim value', r, "iss", "check_failed");
  if (i && r.sub !== i) throw new he('unexpected "sub" claim value', r, "sub", "check_failed");
  if (c && !Ql(r.aud, typeof c == "string" ? [c] : c)) throw new he('unexpected "aud" claim value', r, "aud", "check_failed");
  let d;
  switch (typeof s.clockTolerance) {
    case "string":
      d = Ma(s.clockTolerance);
      break;
    case "number":
      d = s.clockTolerance;
      break;
    case "undefined":
      d = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate: m } = s, _ = Jl(m || /* @__PURE__ */ new Date());
  if ((r.iat !== void 0 || l) && typeof r.iat != "number") throw new he('"iat" claim must be a number', r, "iat", "invalid");
  if (r.nbf !== void 0) {
    if (typeof r.nbf != "number") throw new he('"nbf" claim must be a number', r, "nbf", "invalid");
    if (r.nbf > _ + d) throw new he('"nbf" claim timestamp check failed', r, "nbf", "check_failed");
  }
  if (r.exp !== void 0) {
    if (typeof r.exp != "number") throw new he('"exp" claim must be a number', r, "exp", "invalid");
    if (r.exp <= _ - d) throw new hs('"exp" claim timestamp check failed', r, "exp", "check_failed");
  }
  if (l) {
    const h = _ - r.iat, E = typeof l == "number" ? l : Ma(l);
    if (h - d > E) throw new hs('"iat" claim timestamp check failed (too far in the past)', r, "iat", "check_failed");
    if (h < 0 - d) throw new he('"iat" claim timestamp check failed (it should be in the past)', r, "iat", "check_failed");
  }
  return r;
}, "Zl");
async function eu(e, t, s) {
  var o;
  const r = await Vl(e, t, s);
  if ((o = r.protectedHeader.crit) != null && o.includes("b64") && r.protectedHeader.b64 === false) throw new xs("JWTs MUST NOT use unencoded payload");
  const n = { payload: Zl(r.protectedHeader, r.payload, s), protectedHeader: r.protectedHeader };
  return typeof t == "function" ? { ...n, key: r.key } : n;
}
__name(eu, "eu");
function tu(e) {
  switch (typeof e == "string" && e.slice(0, 2)) {
    case "RS":
    case "PS":
      return "RSA";
    case "ES":
      return "EC";
    case "Ed":
      return "OKP";
    default:
      throw new we('Unsupported "alg" value for a JSON Web Key Set');
  }
}
__name(tu, "tu");
function su(e) {
  return e && typeof e == "object" && Array.isArray(e.keys) && e.keys.every(ru);
}
__name(su, "su");
function ru(e) {
  return Ge(e);
}
__name(ru, "ru");
function No(e) {
  return typeof structuredClone == "function" ? structuredClone(e) : JSON.parse(JSON.stringify(e));
}
__name(No, "No");
var au = class {
  static {
    __name(this, "au");
  }
  constructor(t) {
    if (this._cached = /* @__PURE__ */ new WeakMap(), !su(t)) throw new da("JSON Web Key Set malformed");
    this._jwks = No(t);
  }
  async getKey(t, s) {
    const { alg: r, kid: a } = { ...t, ...s == null ? void 0 : s.header }, n = tu(r), o = this._jwks.keys.filter((l) => {
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
    if (c === 0) throw new pa();
    if (c !== 1) {
      const l = new To(), { _cached: u } = this;
      throw l[Symbol.asyncIterator] = async function* () {
        for (const d of o) try {
          yield await $a(u, d, r);
        } catch {
        }
      }, l;
    }
    return $a(this._cached, i, r);
  }
};
async function $a(e, t, s) {
  const r = e.get(t) || e.set(t, {}).get(t);
  if (r[s] === void 0) {
    const a = await Ao({ ...t, ext: true }, s);
    if (a instanceof Uint8Array || a.type !== "public") throw new da("JSON Web Key Set members must be public keys");
    r[s] = a;
  }
  return r[s];
}
__name($a, "$a");
function Fa(e) {
  const t = new au(e), s = /* @__PURE__ */ __name(async (r, a) => t.getKey(r, a), "s");
  return Object.defineProperties(s, { jwks: { value: /* @__PURE__ */ __name(() => No(t._jwks), "value"), enumerable: true, configurable: false, writable: false } }), s;
}
__name(Fa, "Fa");
var nu = /* @__PURE__ */ __name(async (e, t, s) => {
  let r, a, n = false;
  typeof AbortController == "function" && (r = new AbortController(), a = setTimeout(() => {
    n = true, r.abort();
  }, t));
  const o = await fetch(e.href, { signal: r ? r.signal : void 0, redirect: "manual", headers: s.headers }).catch((i) => {
    throw n ? new vo() : i;
  });
  if (a !== void 0 && clearTimeout(a), o.status !== 200) throw new re("Expected 200 OK from the JSON Web Key Set HTTP response");
  try {
    return await o.json();
  } catch {
    throw new re("Failed to parse the JSON Web Key Set HTTP response as JSON");
  }
}, "nu");
function ou() {
  return typeof WebSocketPair < "u" || typeof navigator < "u" && true || typeof EdgeRuntime < "u" && EdgeRuntime === "vercel";
}
__name(ou, "ou");
var Qr;
var rr;
var Jn;
(typeof navigator > "u" || !((Jn = (rr = "Cloudflare-Workers") == null ? void 0 : rr.startsWith) != null && Jn.call(rr, "Mozilla/5.0 "))) && (Qr = "jose/v5.10.0");
var Cr = /* @__PURE__ */ Symbol();
function iu(e, t) {
  return !(typeof e != "object" || e === null || !("uat" in e) || typeof e.uat != "number" || Date.now() - e.uat >= t || !("jwks" in e) || !Ge(e.jwks) || !Array.isArray(e.jwks.keys) || !Array.prototype.every.call(e.jwks.keys, Ge));
}
__name(iu, "iu");
var cu = class {
  static {
    __name(this, "cu");
  }
  constructor(t, s) {
    if (!(t instanceof URL)) throw new TypeError("url must be an instance of URL");
    this._url = new URL(t.href), this._options = { agent: s == null ? void 0 : s.agent, headers: s == null ? void 0 : s.headers }, this._timeoutDuration = typeof (s == null ? void 0 : s.timeoutDuration) == "number" ? s == null ? void 0 : s.timeoutDuration : 5e3, this._cooldownDuration = typeof (s == null ? void 0 : s.cooldownDuration) == "number" ? s == null ? void 0 : s.cooldownDuration : 3e4, this._cacheMaxAge = typeof (s == null ? void 0 : s.cacheMaxAge) == "number" ? s == null ? void 0 : s.cacheMaxAge : 6e5, (s == null ? void 0 : s[Cr]) !== void 0 && (this._cache = s == null ? void 0 : s[Cr], iu(s == null ? void 0 : s[Cr], this._cacheMaxAge) && (this._jwksTimestamp = this._cache.uat, this._local = Fa(this._cache.jwks)));
  }
  coolingDown() {
    return typeof this._jwksTimestamp == "number" ? Date.now() < this._jwksTimestamp + this._cooldownDuration : false;
  }
  fresh() {
    return typeof this._jwksTimestamp == "number" ? Date.now() < this._jwksTimestamp + this._cacheMaxAge : false;
  }
  async getKey(t, s) {
    (!this._local || !this.fresh()) && await this.reload();
    try {
      return await this._local(t, s);
    } catch (r) {
      if (r instanceof pa && this.coolingDown() === false) return await this.reload(), this._local(t, s);
      throw r;
    }
  }
  async reload() {
    this._pendingFetch && ou() && (this._pendingFetch = void 0);
    const t = new Headers(this._options.headers);
    Qr && !t.has("User-Agent") && (t.set("User-Agent", Qr), this._options.headers = Object.fromEntries(t.entries())), this._pendingFetch || (this._pendingFetch = nu(this._url, this._timeoutDuration, this._options).then((s) => {
      this._local = Fa(s), this._cache && (this._cache.uat = Date.now(), this._cache.jwks = s), this._jwksTimestamp = Date.now(), this._pendingFetch = void 0;
    }).catch((s) => {
      throw this._pendingFetch = void 0, s;
    })), await this._pendingFetch;
  }
};
function lu(e, t) {
  const s = new cu(e, t), r = /* @__PURE__ */ __name(async (a, n) => s.getKey(a, n), "r");
  return Object.defineProperties(r, { coolingDown: { get: /* @__PURE__ */ __name(() => s.coolingDown(), "get"), enumerable: true, configurable: false }, fresh: { get: /* @__PURE__ */ __name(() => s.fresh(), "get"), enumerable: true, configurable: false }, reload: { value: /* @__PURE__ */ __name(() => s.reload(), "value"), enumerable: true, configurable: false, writable: false }, reloading: { get: /* @__PURE__ */ __name(() => !!s._pendingFetch, "get"), enumerable: true, configurable: false }, jwks: { value: /* @__PURE__ */ __name(() => {
    var a;
    return (a = s._local) == null ? void 0 : a.jwks();
  }, "value"), enumerable: true, configurable: false, writable: false } }), r;
}
__name(lu, "lu");
var uu = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var ir = null;
function du() {
  return ir || (ir = lu(new URL(uu)), console.log("[Firebase Token] \u2705 JWKS cache initialized")), ir;
}
__name(du, "du");
function pu() {
  ir = null, console.warn("[Firebase Token] \u{1F504} JWKS cache invalidated");
}
__name(pu, "pu");
async function jo(e, t) {
  try {
    console.log("[Firebase Token] \u{1F50D} Starting verification"), console.log("[Firebase Token] \u{1F4CA} Token length:", e.length), console.log("[Firebase Token] \u{1F3E2} Project ID:", t);
    const s = du(), { payload: r } = await eu(e, s, { issuer: `https://securetoken.google.com/${t}`, audience: t, algorithms: ["RS256"] });
    if (console.log("[Firebase Token] \u2705 JWT signature verified"), !r.sub) throw new Error("Token missing subject (uid)");
    const a = Math.floor(Date.now() / 1e3);
    if (r.exp && r.exp < a) throw console.error("[Firebase Token] \u274C Token expired:", { exp: r.exp, now: a, expiredBy: a - r.exp }), new hs("Token has expired");
    if (r.iat && r.iat > a + 300) throw console.error("[Firebase Token] \u274C Token issued in future:", { iat: r.iat, now: a, diff: r.iat - a }), new Error("Token not yet valid (issued in future)");
    console.log("[Firebase Token] \u2705 Time validation passed:", { iat: r.iat, exp: r.exp, now: a });
    const n = r.sub, o = typeof r.role == "string" ? r.role : void 0, i = typeof r.userId == "number" ? r.userId : void 0, c = typeof r.userName == "string" ? r.userName : void 0, l = typeof r.email == "string" ? r.email : void 0;
    return console.log("[Firebase Token] \u2705 Token verified successfully"), console.log("[Firebase Token] \u{1F464} User:", { uid: n, role: o, userId: i, userName: c, email: l ? "exists" : "none" }), { ...r, uid: n, role: o, userId: i, userName: c, email: l };
  } catch (s) {
    throw console.error("[Firebase Token] \u274C Verification failed:", { error: s instanceof Error ? s.message : "Unknown", name: s instanceof Error ? s.name : void 0, tokenPreview: e.substring(0, 30) + "..." }), s instanceof xs && s.message.includes("kid") && (pu(), console.warn("[Firebase Token] \u{1F504} JWKS cache invalidated \u2192 retry possible")), s;
  }
}
__name(jo, "jo");
function Mo(e) {
  if (e instanceof hs) return { code: "TOKEN_EXPIRED", message: "Token has expired. Please login again." };
  if (e instanceof xs) {
    if (e.message.includes("issuer")) return { code: "INVALID_ISSUER", message: "Token issuer mismatch" };
    if (e.message.includes("audience")) return { code: "INVALID_AUDIENCE", message: "Token audience mismatch" };
    if (e.message.includes("signature")) return { code: "INVALID_SIGNATURE", message: "Invalid token signature" };
    if (e.message.includes("kid")) return { code: "INVALID_KID", message: "Public key not found for token" };
  }
  return e instanceof Error && e.message.includes("not yet valid") ? { code: "TOKEN_NOT_YET_VALID", message: "Token issued in the future" } : { code: "VERIFICATION_FAILED", message: e instanceof Error ? e.message : "Token verification failed" };
}
__name(Mo, "Mo");
var Zr = null;
function mu(e) {
  try {
    return crypto.getRandomValues(new Uint8Array(e));
  } catch {
  }
  try {
    return Ti.randomBytes(e);
  } catch {
  }
  if (!Zr) throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");
  return Zr(e);
}
__name(mu, "mu");
function fu(e) {
  Zr = e;
}
__name(fu, "fu");
function fa(e, t) {
  if (e = e || ha, typeof e != "number") throw Error("Illegal arguments: " + typeof e + ", " + typeof t);
  e < 4 ? e = 4 : e > 31 && (e = 31);
  var s = [];
  return s.push("$2b$"), e < 10 && s.push("0"), s.push(e.toString()), s.push("$"), s.push(pr(mu(_s), _s)), s.join("");
}
__name(fa, "fa");
function Lo(e, t, s) {
  if (typeof t == "function" && (s = t, t = void 0), typeof e == "function" && (s = e, e = void 0), typeof e > "u") e = ha;
  else if (typeof e != "number") throw Error("illegal arguments: " + typeof e);
  function r(a) {
    ye(function() {
      try {
        a(null, fa(e));
      } catch (n) {
        a(n);
      }
    });
  }
  __name(r, "r");
  if (s) {
    if (typeof s != "function") throw Error("Illegal callback: " + typeof s);
    r(s);
  } else return new Promise(function(a, n) {
    r(function(o, i) {
      if (o) {
        n(o);
        return;
      }
      a(i);
    });
  });
}
__name(Lo, "Lo");
function $o(e, t) {
  if (typeof t > "u" && (t = ha), typeof t == "number" && (t = fa(t)), typeof e != "string" || typeof t != "string") throw Error("Illegal arguments: " + typeof e + ", " + typeof t);
  return ea(e, t);
}
__name($o, "$o");
function Fo(e, t, s, r) {
  function a(n) {
    typeof e == "string" && typeof t == "number" ? Lo(t, function(o, i) {
      ea(e, i, n, r);
    }) : typeof e == "string" && typeof t == "string" ? ea(e, t, n, r) : ye(n.bind(this, Error("Illegal arguments: " + typeof e + ", " + typeof t)));
  }
  __name(a, "a");
  if (s) {
    if (typeof s != "function") throw Error("Illegal callback: " + typeof s);
    a(s);
  } else return new Promise(function(n, o) {
    a(function(i, c) {
      if (i) {
        o(i);
        return;
      }
      n(c);
    });
  });
}
__name(Fo, "Fo");
function Uo(e, t) {
  for (var s = e.length ^ t.length, r = 0; r < e.length; ++r) s |= e.charCodeAt(r) ^ t.charCodeAt(r);
  return s === 0;
}
__name(Uo, "Uo");
function hu(e, t) {
  if (typeof e != "string" || typeof t != "string") throw Error("Illegal arguments: " + typeof e + ", " + typeof t);
  return t.length !== 60 ? false : Uo($o(e, t.substring(0, t.length - 31)), t);
}
__name(hu, "hu");
function _u(e, t, s, r) {
  function a(n) {
    if (typeof e != "string" || typeof t != "string") {
      ye(n.bind(this, Error("Illegal arguments: " + typeof e + ", " + typeof t)));
      return;
    }
    if (t.length !== 60) {
      ye(n.bind(this, null, false));
      return;
    }
    Fo(e, t.substring(0, 29), function(o, i) {
      o ? n(o) : n(null, Uo(i, t));
    }, r);
  }
  __name(a, "a");
  if (s) {
    if (typeof s != "function") throw Error("Illegal callback: " + typeof s);
    a(s);
  } else return new Promise(function(n, o) {
    a(function(i, c) {
      if (i) {
        o(i);
        return;
      }
      n(c);
    });
  });
}
__name(_u, "_u");
function Eu(e) {
  if (typeof e != "string") throw Error("Illegal arguments: " + typeof e);
  return parseInt(e.split("$")[2], 10);
}
__name(Eu, "Eu");
function gu(e) {
  if (typeof e != "string") throw Error("Illegal arguments: " + typeof e);
  if (e.length !== 60) throw Error("Illegal hash length: " + e.length + " != 60");
  return e.substring(0, 29);
}
__name(gu, "gu");
function yu(e) {
  if (typeof e != "string") throw Error("Illegal arguments: " + typeof e);
  return qo(e) > 72;
}
__name(yu, "yu");
var ye = typeof setImmediate == "function" ? setImmediate : typeof scheduler == "object" && typeof scheduler.postTask == "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function qo(e) {
  for (var t = 0, s = 0, r = 0; r < e.length; ++r) s = e.charCodeAt(r), s < 128 ? t += 1 : s < 2048 ? t += 2 : (s & 64512) === 55296 && (e.charCodeAt(r + 1) & 64512) === 56320 ? (++r, t += 4) : t += 3;
  return t;
}
__name(qo, "qo");
function bu(e) {
  for (var t = 0, s, r, a = new Array(qo(e)), n = 0, o = e.length; n < o; ++n) s = e.charCodeAt(n), s < 128 ? a[t++] = s : s < 2048 ? (a[t++] = s >> 6 | 192, a[t++] = s & 63 | 128) : (s & 64512) === 55296 && ((r = e.charCodeAt(n + 1)) & 64512) === 56320 ? (s = 65536 + ((s & 1023) << 10) + (r & 1023), ++n, a[t++] = s >> 18 | 240, a[t++] = s >> 12 & 63 | 128, a[t++] = s >> 6 & 63 | 128, a[t++] = s & 63 | 128) : (a[t++] = s >> 12 | 224, a[t++] = s >> 6 & 63 | 128, a[t++] = s & 63 | 128);
  return a;
}
__name(bu, "bu");
var ft = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var Ne = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, -1, -1, -1, -1, -1, -1, -1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, -1, -1, -1, -1, -1, -1, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, -1, -1, -1, -1, -1];
function pr(e, t) {
  var s = 0, r = [], a, n;
  if (t <= 0 || t > e.length) throw Error("Illegal len: " + t);
  for (; s < t; ) {
    if (a = e[s++] & 255, r.push(ft[a >> 2 & 63]), a = (a & 3) << 4, s >= t) {
      r.push(ft[a & 63]);
      break;
    }
    if (n = e[s++] & 255, a |= n >> 4 & 15, r.push(ft[a & 63]), a = (n & 15) << 2, s >= t) {
      r.push(ft[a & 63]);
      break;
    }
    n = e[s++] & 255, a |= n >> 6 & 3, r.push(ft[a & 63]), r.push(ft[n & 63]);
  }
  return r.join("");
}
__name(pr, "pr");
function Ho(e, t) {
  var s = 0, r = e.length, a = 0, n = [], o, i, c, l, u, d;
  if (t <= 0) throw Error("Illegal len: " + t);
  for (; s < r - 1 && a < t && (d = e.charCodeAt(s++), o = d < Ne.length ? Ne[d] : -1, d = e.charCodeAt(s++), i = d < Ne.length ? Ne[d] : -1, !(o == -1 || i == -1 || (u = o << 2 >>> 0, u |= (i & 48) >> 4, n.push(String.fromCharCode(u)), ++a >= t || s >= r) || (d = e.charCodeAt(s++), c = d < Ne.length ? Ne[d] : -1, c == -1) || (u = (i & 15) << 4 >>> 0, u |= (c & 60) >> 2, n.push(String.fromCharCode(u)), ++a >= t || s >= r))); ) d = e.charCodeAt(s++), l = d < Ne.length ? Ne[d] : -1, u = (c & 3) << 6 >>> 0, u |= l, n.push(String.fromCharCode(u)), ++a;
  var m = [];
  for (s = 0; s < a; s++) m.push(n[s].charCodeAt(0));
  return m;
}
__name(Ho, "Ho");
var _s = 16;
var ha = 10;
var Tu = 16;
var vu = 100;
var Ua = [608135816, 2242054355, 320440878, 57701188, 2752067618, 698298832, 137296536, 3964562569, 1160258022, 953160567, 3193202383, 887688300, 3232508343, 3380367581, 1065670069, 3041331479, 2450970073, 2306472731];
var qa = [3509652390, 2564797868, 805139163, 3491422135, 3101798381, 1780907670, 3128725573, 4046225305, 614570311, 3012652279, 134345442, 2240740374, 1667834072, 1901547113, 2757295779, 4103290238, 227898511, 1921955416, 1904987480, 2182433518, 2069144605, 3260701109, 2620446009, 720527379, 3318853667, 677414384, 3393288472, 3101374703, 2390351024, 1614419982, 1822297739, 2954791486, 3608508353, 3174124327, 2024746970, 1432378464, 3864339955, 2857741204, 1464375394, 1676153920, 1439316330, 715854006, 3033291828, 289532110, 2706671279, 2087905683, 3018724369, 1668267050, 732546397, 1947742710, 3462151702, 2609353502, 2950085171, 1814351708, 2050118529, 680887927, 999245976, 1800124847, 3300911131, 1713906067, 1641548236, 4213287313, 1216130144, 1575780402, 4018429277, 3917837745, 3693486850, 3949271944, 596196993, 3549867205, 258830323, 2213823033, 772490370, 2760122372, 1774776394, 2652871518, 566650946, 4142492826, 1728879713, 2882767088, 1783734482, 3629395816, 2517608232, 2874225571, 1861159788, 326777828, 3124490320, 2130389656, 2716951837, 967770486, 1724537150, 2185432712, 2364442137, 1164943284, 2105845187, 998989502, 3765401048, 2244026483, 1075463327, 1455516326, 1322494562, 910128902, 469688178, 1117454909, 936433444, 3490320968, 3675253459, 1240580251, 122909385, 2157517691, 634681816, 4142456567, 3825094682, 3061402683, 2540495037, 79693498, 3249098678, 1084186820, 1583128258, 426386531, 1761308591, 1047286709, 322548459, 995290223, 1845252383, 2603652396, 3431023940, 2942221577, 3202600964, 3727903485, 1712269319, 422464435, 3234572375, 1170764815, 3523960633, 3117677531, 1434042557, 442511882, 3600875718, 1076654713, 1738483198, 4213154764, 2393238008, 3677496056, 1014306527, 4251020053, 793779912, 2902807211, 842905082, 4246964064, 1395751752, 1040244610, 2656851899, 3396308128, 445077038, 3742853595, 3577915638, 679411651, 2892444358, 2354009459, 1767581616, 3150600392, 3791627101, 3102740896, 284835224, 4246832056, 1258075500, 768725851, 2589189241, 3069724005, 3532540348, 1274779536, 3789419226, 2764799539, 1660621633, 3471099624, 4011903706, 913787905, 3497959166, 737222580, 2514213453, 2928710040, 3937242737, 1804850592, 3499020752, 2949064160, 2386320175, 2390070455, 2415321851, 4061277028, 2290661394, 2416832540, 1336762016, 1754252060, 3520065937, 3014181293, 791618072, 3188594551, 3933548030, 2332172193, 3852520463, 3043980520, 413987798, 3465142937, 3030929376, 4245938359, 2093235073, 3534596313, 375366246, 2157278981, 2479649556, 555357303, 3870105701, 2008414854, 3344188149, 4221384143, 3956125452, 2067696032, 3594591187, 2921233993, 2428461, 544322398, 577241275, 1471733935, 610547355, 4027169054, 1432588573, 1507829418, 2025931657, 3646575487, 545086370, 48609733, 2200306550, 1653985193, 298326376, 1316178497, 3007786442, 2064951626, 458293330, 2589141269, 3591329599, 3164325604, 727753846, 2179363840, 146436021, 1461446943, 4069977195, 705550613, 3059967265, 3887724982, 4281599278, 3313849956, 1404054877, 2845806497, 146425753, 1854211946, 1266315497, 3048417604, 3681880366, 3289982499, 290971e4, 1235738493, 2632868024, 2414719590, 3970600049, 1771706367, 1449415276, 3266420449, 422970021, 1963543593, 2690192192, 3826793022, 1062508698, 1531092325, 1804592342, 2583117782, 2714934279, 4024971509, 1294809318, 4028980673, 1289560198, 2221992742, 1669523910, 35572830, 157838143, 1052438473, 1016535060, 1802137761, 1753167236, 1386275462, 3080475397, 2857371447, 1040679964, 2145300060, 2390574316, 1461121720, 2956646967, 4031777805, 4028374788, 33600511, 2920084762, 1018524850, 629373528, 3691585981, 3515945977, 2091462646, 2486323059, 586499841, 988145025, 935516892, 3367335476, 2599673255, 2839830854, 265290510, 3972581182, 2759138881, 3795373465, 1005194799, 847297441, 406762289, 1314163512, 1332590856, 1866599683, 4127851711, 750260880, 613907577, 1450815602, 3165620655, 3734664991, 3650291728, 3012275730, 3704569646, 1427272223, 778793252, 1343938022, 2676280711, 2052605720, 1946737175, 3164576444, 3914038668, 3967478842, 3682934266, 1661551462, 3294938066, 4011595847, 840292616, 3712170807, 616741398, 312560963, 711312465, 1351876610, 322626781, 1910503582, 271666773, 2175563734, 1594956187, 70604529, 3617834859, 1007753275, 1495573769, 4069517037, 2549218298, 2663038764, 504708206, 2263041392, 3941167025, 2249088522, 1514023603, 1998579484, 1312622330, 694541497, 2582060303, 2151582166, 1382467621, 776784248, 2618340202, 3323268794, 2497899128, 2784771155, 503983604, 4076293799, 907881277, 423175695, 432175456, 1378068232, 4145222326, 3954048622, 3938656102, 3820766613, 2793130115, 2977904593, 26017576, 3274890735, 3194772133, 1700274565, 1756076034, 4006520079, 3677328699, 720338349, 1533947780, 354530856, 688349552, 3973924725, 1637815568, 332179504, 3949051286, 53804574, 2852348879, 3044236432, 1282449977, 3583942155, 3416972820, 4006381244, 1617046695, 2628476075, 3002303598, 1686838959, 431878346, 2686675385, 1700445008, 1080580658, 1009431731, 832498133, 3223435511, 2605976345, 2271191193, 2516031870, 1648197032, 4164389018, 2548247927, 300782431, 375919233, 238389289, 3353747414, 2531188641, 2019080857, 1475708069, 455242339, 2609103871, 448939670, 3451063019, 1395535956, 2413381860, 1841049896, 1491858159, 885456874, 4264095073, 4001119347, 1565136089, 3898914787, 1108368660, 540939232, 1173283510, 2745871338, 3681308437, 4207628240, 3343053890, 4016749493, 1699691293, 1103962373, 3625875870, 2256883143, 3830138730, 1031889488, 3479347698, 1535977030, 4236805024, 3251091107, 2132092099, 1774941330, 1199868427, 1452454533, 157007616, 2904115357, 342012276, 595725824, 1480756522, 206960106, 497939518, 591360097, 863170706, 2375253569, 3596610801, 1814182875, 2094937945, 3421402208, 1082520231, 3463918190, 2785509508, 435703966, 3908032597, 1641649973, 2842273706, 3305899714, 1510255612, 2148256476, 2655287854, 3276092548, 4258621189, 236887753, 3681803219, 274041037, 1734335097, 3815195456, 3317970021, 1899903192, 1026095262, 4050517792, 356393447, 2410691914, 3873677099, 3682840055, 3913112168, 2491498743, 4132185628, 2489919796, 1091903735, 1979897079, 3170134830, 3567386728, 3557303409, 857797738, 1136121015, 1342202287, 507115054, 2535736646, 337727348, 3213592640, 1301675037, 2528481711, 1895095763, 1721773893, 3216771564, 62756741, 2142006736, 835421444, 2531993523, 1442658625, 3659876326, 2882144922, 676362277, 1392781812, 170690266, 3921047035, 1759253602, 3611846912, 1745797284, 664899054, 1329594018, 3901205900, 3045908486, 2062866102, 2865634940, 3543621612, 3464012697, 1080764994, 553557557, 3656615353, 3996768171, 991055499, 499776247, 1265440854, 648242737, 3940784050, 980351604, 3713745714, 1749149687, 3396870395, 4211799374, 3640570775, 1161844396, 3125318951, 1431517754, 545492359, 4268468663, 3499529547, 1437099964, 2702547544, 3433638243, 2581715763, 2787789398, 1060185593, 1593081372, 2418618748, 4260947970, 69676912, 2159744348, 86519011, 2512459080, 3838209314, 1220612927, 3339683548, 133810670, 1090789135, 1078426020, 1569222167, 845107691, 3583754449, 4072456591, 1091646820, 628848692, 1613405280, 3757631651, 526609435, 236106946, 48312990, 2942717905, 3402727701, 1797494240, 859738849, 992217954, 4005476642, 2243076622, 3870952857, 3732016268, 765654824, 3490871365, 2511836413, 1685915746, 3888969200, 1414112111, 2273134842, 3281911079, 4080962846, 172450625, 2569994100, 980381355, 4109958455, 2819808352, 2716589560, 2568741196, 3681446669, 3329971472, 1835478071, 660984891, 3704678404, 4045999559, 3422617507, 3040415634, 1762651403, 1719377915, 3470491036, 2693910283, 3642056355, 3138596744, 1364962596, 2073328063, 1983633131, 926494387, 3423689081, 2150032023, 4096667949, 1749200295, 3328846651, 309677260, 2016342300, 1779581495, 3079819751, 111262694, 1274766160, 443224088, 298511866, 1025883608, 3806446537, 1145181785, 168956806, 3641502830, 3584813610, 1689216846, 3666258015, 3200248200, 1692713982, 2646376535, 4042768518, 1618508792, 1610833997, 3523052358, 4130873264, 2001055236, 3610705100, 2202168115, 4028541809, 2961195399, 1006657119, 2006996926, 3186142756, 1430667929, 3210227297, 1314452623, 4074634658, 4101304120, 2273951170, 1399257539, 3367210612, 3027628629, 1190975929, 2062231137, 2333990788, 2221543033, 2438960610, 1181637006, 548689776, 2362791313, 3372408396, 3104550113, 3145860560, 296247880, 1970579870, 3078560182, 3769228297, 1714227617, 3291629107, 3898220290, 166772364, 1251581989, 493813264, 448347421, 195405023, 2709975567, 677966185, 3703036547, 1463355134, 2715995803, 1338867538, 1343315457, 2802222074, 2684532164, 233230375, 2599980071, 2000651841, 3277868038, 1638401717, 4028070440, 3237316320, 6314154, 819756386, 300326615, 590932579, 1405279636, 3267499572, 3150704214, 2428286686, 3959192993, 3461946742, 1862657033, 1266418056, 963775037, 2089974820, 2263052895, 1917689273, 448879540, 3550394620, 3981727096, 150775221, 3627908307, 1303187396, 508620638, 2975983352, 2726630617, 1817252668, 1876281319, 1457606340, 908771278, 3720792119, 3617206836, 2455994898, 1729034894, 1080033504, 976866871, 3556439503, 2881648439, 1522871579, 1555064734, 1336096578, 3548522304, 2579274686, 3574697629, 3205460757, 3593280638, 3338716283, 3079412587, 564236357, 2993598910, 1781952180, 1464380207, 3163844217, 3332601554, 1699332808, 1393555694, 1183702653, 3581086237, 1288719814, 691649499, 2847557200, 2895455976, 3193889540, 2717570544, 1781354906, 1676643554, 2592534050, 3230253752, 1126444790, 2770207658, 2633158820, 2210423226, 2615765581, 2414155088, 3127139286, 673620729, 2805611233, 1269405062, 4015350505, 3341807571, 4149409754, 1057255273, 2012875353, 2162469141, 2276492801, 2601117357, 993977747, 3918593370, 2654263191, 753973209, 36408145, 2530585658, 25011837, 3520020182, 2088578344, 530523599, 2918365339, 1524020338, 1518925132, 3760827505, 3759777254, 1202760957, 3985898139, 3906192525, 674977740, 4174734889, 2031300136, 2019492241, 3983892565, 4153806404, 3822280332, 352677332, 2297720250, 60907813, 90501309, 3286998549, 1016092578, 2535922412, 2839152426, 457141659, 509813237, 4120667899, 652014361, 1966332200, 2975202805, 55981186, 2327461051, 676427537, 3255491064, 2882294119, 3433927263, 1307055953, 942726286, 933058658, 2468411793, 3933900994, 4215176142, 1361170020, 2001714738, 2830558078, 3274259782, 1222529897, 1679025792, 2729314320, 3714953764, 1770335741, 151462246, 3013232138, 1682292957, 1483529935, 471910574, 1539241949, 458788160, 3436315007, 1807016891, 3718408830, 978976581, 1043663428, 3165965781, 1927990952, 4200891579, 2372276910, 3208408903, 3533431907, 1412390302, 2931980059, 4132332400, 1947078029, 3881505623, 4168226417, 2941484381, 1077988104, 1320477388, 886195818, 18198404, 3786409e3, 2509781533, 112762804, 3463356488, 1866414978, 891333506, 18488651, 661792760, 1628790961, 3885187036, 3141171499, 876946877, 2693282273, 1372485963, 791857591, 2686433993, 3759982718, 3167212022, 3472953795, 2716379847, 445679433, 3561995674, 3504004811, 3574258232, 54117162, 3331405415, 2381918588, 3769707343, 4154350007, 1140177722, 4074052095, 668550556, 3214352940, 367459370, 261225585, 2610173221, 4209349473, 3468074219, 3265815641, 314222801, 3066103646, 3808782860, 282218597, 3406013506, 3773591054, 379116347, 1285071038, 846784868, 2669647154, 3771962079, 3550491691, 2305946142, 453669953, 1268987020, 3317592352, 3279303384, 3744833421, 2610507566, 3859509063, 266596637, 3847019092, 517658769, 3462560207, 3443424879, 370717030, 4247526661, 2224018117, 4143653529, 4112773975, 2788324899, 2477274417, 1456262402, 2901442914, 1517677493, 1846949527, 2295493580, 3734397586, 2176403920, 1280348187, 1908823572, 3871786941, 846861322, 1172426758, 3287448474, 3383383037, 1655181056, 3139813346, 901632758, 1897031941, 2986607138, 3066810236, 3447102507, 1393639104, 373351379, 950779232, 625454576, 3124240540, 4148612726, 2007998917, 544563296, 2244738638, 2330496472, 2058025392, 1291430526, 424198748, 50039436, 29584100, 3605783033, 2429876329, 2791104160, 1057563949, 3255363231, 3075367218, 3463963227, 1469046755, 985887462];
var Wo = [1332899944, 1700884034, 1701343084, 1684370003, 1668446532, 1869963892];
function Es(e, t, s, r) {
  var a, n = e[t], o = e[t + 1];
  return n ^= s[0], a = r[n >>> 24], a += r[256 | n >> 16 & 255], a ^= r[512 | n >> 8 & 255], a += r[768 | n & 255], o ^= a ^ s[1], a = r[o >>> 24], a += r[256 | o >> 16 & 255], a ^= r[512 | o >> 8 & 255], a += r[768 | o & 255], n ^= a ^ s[2], a = r[n >>> 24], a += r[256 | n >> 16 & 255], a ^= r[512 | n >> 8 & 255], a += r[768 | n & 255], o ^= a ^ s[3], a = r[o >>> 24], a += r[256 | o >> 16 & 255], a ^= r[512 | o >> 8 & 255], a += r[768 | o & 255], n ^= a ^ s[4], a = r[n >>> 24], a += r[256 | n >> 16 & 255], a ^= r[512 | n >> 8 & 255], a += r[768 | n & 255], o ^= a ^ s[5], a = r[o >>> 24], a += r[256 | o >> 16 & 255], a ^= r[512 | o >> 8 & 255], a += r[768 | o & 255], n ^= a ^ s[6], a = r[n >>> 24], a += r[256 | n >> 16 & 255], a ^= r[512 | n >> 8 & 255], a += r[768 | n & 255], o ^= a ^ s[7], a = r[o >>> 24], a += r[256 | o >> 16 & 255], a ^= r[512 | o >> 8 & 255], a += r[768 | o & 255], n ^= a ^ s[8], a = r[n >>> 24], a += r[256 | n >> 16 & 255], a ^= r[512 | n >> 8 & 255], a += r[768 | n & 255], o ^= a ^ s[9], a = r[o >>> 24], a += r[256 | o >> 16 & 255], a ^= r[512 | o >> 8 & 255], a += r[768 | o & 255], n ^= a ^ s[10], a = r[n >>> 24], a += r[256 | n >> 16 & 255], a ^= r[512 | n >> 8 & 255], a += r[768 | n & 255], o ^= a ^ s[11], a = r[o >>> 24], a += r[256 | o >> 16 & 255], a ^= r[512 | o >> 8 & 255], a += r[768 | o & 255], n ^= a ^ s[12], a = r[n >>> 24], a += r[256 | n >> 16 & 255], a ^= r[512 | n >> 8 & 255], a += r[768 | n & 255], o ^= a ^ s[13], a = r[o >>> 24], a += r[256 | o >> 16 & 255], a ^= r[512 | o >> 8 & 255], a += r[768 | o & 255], n ^= a ^ s[14], a = r[n >>> 24], a += r[256 | n >> 16 & 255], a ^= r[512 | n >> 8 & 255], a += r[768 | n & 255], o ^= a ^ s[15], a = r[o >>> 24], a += r[256 | o >> 16 & 255], a ^= r[512 | o >> 8 & 255], a += r[768 | o & 255], n ^= a ^ s[16], e[t] = o ^ s[Tu + 1], e[t + 1] = n, e;
}
__name(Es, "Es");
function Pt(e, t) {
  for (var s = 0, r = 0; s < 4; ++s) r = r << 8 | e[t] & 255, t = (t + 1) % e.length;
  return { key: r, offp: t };
}
__name(Pt, "Pt");
function Ha(e, t, s) {
  for (var r = 0, a = [0, 0], n = t.length, o = s.length, i, c = 0; c < n; c++) i = Pt(e, r), r = i.offp, t[c] = t[c] ^ i.key;
  for (c = 0; c < n; c += 2) a = Es(a, 0, t, s), t[c] = a[0], t[c + 1] = a[1];
  for (c = 0; c < o; c += 2) a = Es(a, 0, t, s), s[c] = a[0], s[c + 1] = a[1];
}
__name(Ha, "Ha");
function Su(e, t, s, r) {
  for (var a = 0, n = [0, 0], o = s.length, i = r.length, c, l = 0; l < o; l++) c = Pt(t, a), a = c.offp, s[l] = s[l] ^ c.key;
  for (a = 0, l = 0; l < o; l += 2) c = Pt(e, a), a = c.offp, n[0] ^= c.key, c = Pt(e, a), a = c.offp, n[1] ^= c.key, n = Es(n, 0, s, r), s[l] = n[0], s[l + 1] = n[1];
  for (l = 0; l < i; l += 2) c = Pt(e, a), a = c.offp, n[0] ^= c.key, c = Pt(e, a), a = c.offp, n[1] ^= c.key, n = Es(n, 0, s, r), r[l] = n[0], r[l + 1] = n[1];
}
__name(Su, "Su");
function Wa(e, t, s, r, a) {
  var n = Wo.slice(), o = n.length, i;
  if (s < 4 || s > 31) if (i = Error("Illegal number of rounds (4-31): " + s), r) {
    ye(r.bind(this, i));
    return;
  } else throw i;
  if (t.length !== _s) if (i = Error("Illegal salt length: " + t.length + " != " + _s), r) {
    ye(r.bind(this, i));
    return;
  } else throw i;
  s = 1 << s >>> 0;
  var c, l, u = 0, d;
  typeof Int32Array == "function" ? (c = new Int32Array(Ua), l = new Int32Array(qa)) : (c = Ua.slice(), l = qa.slice()), Su(t, e, c, l);
  function m() {
    if (a && a(u / s), u < s) for (var h = Date.now(); u < s && (u = u + 1, Ha(e, c, l), Ha(t, c, l), !(Date.now() - h > vu)); ) ;
    else {
      for (u = 0; u < 64; u++) for (d = 0; d < o >> 1; d++) Es(n, d << 1, c, l);
      var E = [];
      for (u = 0; u < o; u++) E.push((n[u] >> 24 & 255) >>> 0), E.push((n[u] >> 16 & 255) >>> 0), E.push((n[u] >> 8 & 255) >>> 0), E.push((n[u] & 255) >>> 0);
      if (r) {
        r(null, E);
        return;
      } else return E;
    }
    r && ye(m);
  }
  __name(m, "m");
  if (typeof r < "u") m();
  else for (var _; ; ) if (typeof (_ = m()) < "u") return _ || [];
}
__name(Wa, "Wa");
function ea(e, t, s, r) {
  var a;
  if (typeof e != "string" || typeof t != "string") if (a = Error("Invalid string / salt: Not a string"), s) {
    ye(s.bind(this, a));
    return;
  } else throw a;
  var n, o;
  if (t.charAt(0) !== "$" || t.charAt(1) !== "2") if (a = Error("Invalid salt version: " + t.substring(0, 2)), s) {
    ye(s.bind(this, a));
    return;
  } else throw a;
  if (t.charAt(2) === "$") n = "\0", o = 3;
  else {
    if (n = t.charAt(2), n !== "a" && n !== "b" && n !== "y" || t.charAt(3) !== "$") if (a = Error("Invalid salt revision: " + t.substring(2, 4)), s) {
      ye(s.bind(this, a));
      return;
    } else throw a;
    o = 4;
  }
  if (t.charAt(o + 2) > "$") if (a = Error("Missing salt rounds"), s) {
    ye(s.bind(this, a));
    return;
  } else throw a;
  var i = parseInt(t.substring(o, o + 1), 10) * 10, c = parseInt(t.substring(o + 1, o + 2), 10), l = i + c, u = t.substring(o + 3, o + 25);
  e += n >= "a" ? "\0" : "";
  var d = bu(e), m = Ho(u, _s);
  function _(h) {
    var E = [];
    return E.push("$2"), n >= "a" && E.push(n), E.push("$"), l < 10 && E.push("0"), E.push(l.toString()), E.push("$"), E.push(pr(m, m.length)), E.push(pr(h, Wo.length * 4 - 1)), E.join("");
  }
  __name(_, "_");
  if (typeof s > "u") return _(Wa(d, m, l));
  Wa(d, m, l, function(h, E) {
    h ? s(h, null) : s(null, _(E));
  }, r);
}
__name(ea, "ea");
function wu(e, t) {
  return pr(e, t);
}
__name(wu, "wu");
function xu(e, t) {
  return Ho(e, t);
}
__name(xu, "xu");
var Bo = { setRandomFallback: fu, genSaltSync: fa, genSalt: Lo, hashSync: $o, hash: Fo, compareSync: hu, compare: _u, getRounds: Eu, getSalt: gu, truncates: yu, encodeBase64: wu, decodeBase64: xu };
var _a = /* @__PURE__ */ __name((e) => e.JWT_SECRET || "default-jwt-secret-change-in-production-12345678901234567890", "_a");
async function Ko(e, t) {
  const s = { alg: "HS256", typ: "JWT" }, r = Math.floor(Date.now() / 1e3), a = { ...e, iat: r, exp: r + 720 * 60 * 60 }, n = /* @__PURE__ */ __name((_) => {
    const h = JSON.stringify(_);
    return btoa(h).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }, "n"), o = n(s), i = n(a), c = `${o}.${i}`, l = new TextEncoder(), u = await crypto.subtle.importKey("raw", l.encode(t), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), d = await crypto.subtle.sign("HMAC", u, l.encode(c)), m = btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${c}.${m}`;
}
__name(Ko, "Ko");
async function Ru(e, t) {
  try {
    const s = e.split(".");
    if (s.length !== 3) return null;
    const [r, a, n] = s, o = `${r}.${a}`, i = new TextEncoder(), c = await crypto.subtle.importKey("raw", i.encode(t), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]), l = await crypto.subtle.sign("HMAC", c, i.encode(o)), u = btoa(String.fromCharCode(...new Uint8Array(l))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    if (n !== u) return console.warn("[JWT] Invalid signature"), null;
    const m = ((h) => {
      h = h.replace(/-/g, "+").replace(/_/g, "/");
      const E = h.length % 4;
      return E && (h += "=".repeat(4 - E)), JSON.parse(atob(h));
    })(a), _ = Math.floor(Date.now() / 1e3);
    return m.exp && m.exp < _ ? (console.warn("[JWT] Token expired"), null) : m;
  } catch (s) {
    return console.error("[JWT] Verification error:", s), null;
  }
}
__name(Ru, "Ru");
async function Iu(e) {
  return await Bo.hash(e, 10);
}
__name(Iu, "Iu");
async function Go(e, t) {
  return await Bo.compare(e, t);
}
__name(Go, "Go");
var xe = /* @__PURE__ */ new Map();
var te = { hits: 0, misses: 0, writes: 0, evictions: 0 };
function De(e) {
  const t = xe.get(e);
  return t ? t.expires < Date.now() ? (xe.delete(e), te.evictions++, te.misses++, null) : (te.hits++, t.data) : (te.misses++, null);
}
__name(De, "De");
function ae(e, t, s) {
  const r = Date.now() + s * 1e3;
  if (xe.set(e, { data: t, expires: r }), te.writes++, xe.size > 1e3) {
    const a = xe.keys().next().value;
    a && (xe.delete(a), te.evictions++);
  }
}
__name(ae, "ae");
function Pu(e) {
  let t = 0;
  for (const s of xe.keys()) s.includes(e) && (xe.delete(s), t++);
  return t;
}
__name(Pu, "Pu");
async function $t(e, t) {
  const s = Array.isArray(t) ? t : [t];
  for (const r of s) {
    const a = Pu(r);
    a > 0 && console.log(`[Cache] \u{1F9F9} \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uC0AD\uC81C: ${r} (${a}\uAC1C)`);
    try {
      await e.CACHE_KV.delete(r), console.log(`[Cache] \u{1F9F9} KV \uCE90\uC2DC \uC0AD\uC81C: ${r}`);
    } catch (n) {
      console.error(`[Cache] \u274C KV \uCE90\uC2DC \uC0AD\uC81C \uC2E4\uD328: ${r}`, n);
    }
  }
}
__name($t, "$t");
var Ft = { LIVE_STREAMS: ["streams:live", "streams:all", "streams:scheduled", "live_streams:live:all:20:0", "live_streams:"], PRODUCTS: ["products:", "featured_products"], CART: /* @__PURE__ */ __name((e) => [`cart:${e}`], "CART"), ORDERS: /* @__PURE__ */ __name((e) => [`orders:${e}`], "ORDERS"), ALL: ["streams:", "live_streams:", "products:", "cart:", "orders:"] };
function Ou(e) {
  const t = e.status >= 500 ? "error" : e.status >= 400 ? "warn" : "info";
  console.log(JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: t, message: "API Request", context: e, duration: e.duration }));
}
__name(Ou, "Ou");
function Au(e) {
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
__name(Au, "Au");
function Cu(e, t) {
  switch (e.toLowerCase()) {
    case "tosspayments":
      return Au(t);
    default:
      throw new Error(`Unknown payment provider: ${e}`);
  }
}
__name(Cu, "Cu");
var f = new po();
f.use("*", async (e, t) => {
  if (e.req.url.includes("localhost") || e.req.url.includes("127.0.0.1")) try {
    fc(e.env), hc(e.env);
  } catch (r) {
    console.error("[ENV] Validation failed:", r);
  }
  await t();
});
async function Du(e) {
  var t;
  try {
    const s = e.req.header("Authorization");
    console.log("[Firebase Auth] \u{1F50D} Authorization header:", s ? `Bearer ${s.substring(7, 50)}...` : "MISSING");
    const r = (s == null ? void 0 : s.replace("Bearer ", "")) || "";
    if (!r) return console.warn("[Firebase Auth] \u274C No token provided"), null;
    console.log("[Firebase Auth] \u{1F511} Token length:", r.length), console.log("[Firebase Auth] \u{1F511} Token preview:", r.substring(0, 50) + "...");
    try {
      const a = r.split(".");
      if (a.length === 3) {
        const n = a[1], o = atob(n.replace(/-/g, "+").replace(/_/g, "/")), i = JSON.parse(o);
        if (console.log("[Firebase Auth] \u{1F50D} Token Payload (BEFORE verification):", { iss: i.iss, aud: i.aud, sub: i.sub, exp: i.exp, iat: i.iat }), i.iss && i.iss.includes("iam.gserviceaccount.com")) return console.error("[Firebase Auth] \u{1F6A8}\u{1F6A8}\u{1F6A8} CUSTOM TOKEN DETECTED! \u{1F6A8}\u{1F6A8}\u{1F6A8}"), console.error("[Firebase Auth] \u274C This is a Custom Token, not an ID Token!"), console.error("[Firebase Auth] \u274C Custom Token should be exchanged for ID Token on client!"), { userId: 0, userType: "", errorDetails: { code: "CUSTOM_TOKEN_DETECTED", message: "Custom Token should be exchanged for ID Token on client", tokenInfo: { iss: i.iss, aud: i.aud, sub: i.sub } } };
      }
    } catch (a) {
      console.warn("[Firebase Auth] \u26A0\uFE0F Could not decode token payload (might be corrupted):", a);
    }
    try {
      console.log("[Firebase Auth] \u{1F510} Verifying token with project:", e.env.FIREBASE_PROJECT_ID || "urteam-live-commerce-5b284");
      const a = await jo(r, e.env.FIREBASE_PROJECT_ID || "urteam-live-commerce-5b284");
      if (console.log("[Firebase Auth] \u2705 Firebase token verified!"), console.log("[Firebase Auth] \u{1F4CB} Token payload:", { uid: a.uid, iss: a.iss, aud: a.aud, exp: a.exp, iat: a.iat }), a.userId) {
        console.log("[Firebase Auth] \u{1F3AF} Using userId from Custom Claims:", a.userId);
        const i = await e.env.DB.prepare(`
          SELECT id, email, name, firebase_uid FROM users WHERE id = ?
        `).bind(a.userId).first();
        if (i) {
          if (!i.firebase_uid) try {
            await e.env.DB.prepare(`
                UPDATE users SET firebase_uid = ? WHERE id = ?
              `).bind(a.uid, i.id).run(), console.log("[Firebase Auth] \u2705 firebase_uid updated via Custom Claims:", i.id);
          } catch (l) {
            console.warn("[Firebase Auth] \u26A0\uFE0F firebase_uid update failed:", l);
          }
          const c = a.role || "user";
          return console.log("[Firebase Auth] \u2705 User authenticated via Custom Claims"), { userId: i.id, userType: c, email: i.email, firebaseUID: a.uid };
        }
      }
      let n = await e.env.DB.prepare(`
        SELECT id, email, name, firebase_uid FROM users WHERE firebase_uid = ?
      `).bind(a.uid).first();
      if (!n && a.uid.startsWith("kakao_")) {
        const i = a.uid.replace("kakao_", "");
        if (console.warn("[Firebase Auth] firebase_uid not found, trying kakao_id fallback:", i), n = await e.env.DB.prepare(`
          SELECT id, email, name, firebase_uid FROM users 
          WHERE kakao_id = ? AND firebase_uid IS NULL
        `).bind(i).first(), n) {
          console.log("[Firebase Auth] \u2705 Found user via kakao_id fallback:", n.id);
          try {
            await e.env.DB.prepare(`
              UPDATE users SET firebase_uid = ? WHERE id = ?
            `).bind(a.uid, n.id).run(), console.log("[Firebase Auth] \u2705 firebase_uid updated for existing user:", n.id);
          } catch (c) {
            console.error("[Firebase Auth] \u274C firebase_uid update failed:", c);
          }
        }
      }
      if (!n) {
        console.warn("[Firebase Auth] User not found for UID:", a.uid);
        try {
          const i = a.email || `user_${a.uid}@firebase.local`, c = a.name || ((t = a.email) == null ? void 0 : t.split("@")[0]) || "User";
          console.log("[Firebase Auth] \u{1F195} Creating new D1 user:", { uid: a.uid, email: i, name: c });
          const l = await e.env.DB.prepare(`
            INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(a.uid, i, c).run();
          if (n = await e.env.DB.prepare(`
            SELECT id, email, name, firebase_uid FROM users WHERE firebase_uid = ?
          `).bind(a.uid).first(), n) console.log("[Firebase Auth] \u2705 Auto-created D1 user:", n.id);
          else return console.error("[Firebase Auth] \u274C Failed to retrieve newly created user"), { userId: 0, userType: "", errorDetails: { code: "USER_CREATION_FAILED", message: "Failed to create user in database", tokenInfo: { uid: a.uid } } };
        } catch (i) {
          return console.error("[Firebase Auth] \u274C User auto-creation failed:", i), { userId: 0, userType: "", errorDetails: { code: "USER_CREATION_ERROR", message: "Error creating user in database: " + i.message, tokenInfo: { uid: a.uid } } };
        }
      }
      const o = a.role || "user";
      return console.log("[Firebase Auth] \u2705 User authenticated:", { userId: n.id, userType: o, email: n.email, firebaseUID: a.uid }), { userId: n.id, userType: o, email: n.email, firebaseUID: a.uid };
    } catch (a) {
      console.error("[Firebase Auth] Token verification failed:", a);
      const n = Mo(a);
      return { userId: 0, userType: "", errorDetails: { code: n.code, message: n.message, tokenInfo: { length: r.length, preview: r.substring(0, 30) + "..." } } };
    }
  } catch (s) {
    return console.error("[Firebase Auth Error]", s), null;
  }
}
__name(Du, "Du");
async function ut(e, t, s) {
  if (!t) return null;
  const r = `session:${t}`;
  try {
    const a = De(r);
    if (a) return a;
    const n = await e.get(r);
    if (!n) return null;
    const o = JSON.parse(n);
    if (o.expires_at && Date.now() > o.expires_at) return s != null && s.executionCtx || await e.delete(r), null;
    const i = { user_id: o.user_id, user_type: o.user_type || "user", created_at: o.created_at };
    return ae(r, i, 900), i;
  } catch (a) {
    return console.error("[Auth] Session lookup error:", a), null;
  }
}
__name(ut, "ut");
async function N(e, t) {
  const s = e.req.header("Authorization");
  if (console.log("[requireAuth] \u{1F50D} Header check:", s ? "EXISTS" : "MISSING"), !s) return e.json({ success: false, error: "Missing Authorization header", code: "NO_AUTH_HEADER" }, 401);
  const r = s.replace("Bearer ", ""), a = _a(e.env), n = await Ru(r, a);
  if (n) {
    console.log("[requireAuth] \u2705 JWT verified:", n.type, n.email), e.set("user", { userId: n.id, userType: n.type, email: n.email, name: n.name }), e.set("userId", n.id), e.set("userType", n.type), e.set("email", n.email), await t();
    return;
  }
  const o = await Du(e);
  if (!o || o.userId === 0) {
    const i = (o == null ? void 0 : o.errorDetails) || { code: "AUTH_FAILED", message: "Token verification failed - not a valid JWT or Firebase token" };
    return e.json({ success: false, error: i.message, code: i.code }, 401);
  }
  console.log("[requireAuth] \u2705 Firebase verified:", o.userType, o.email), e.set("user", { userId: o.userId, userType: o.userType, email: o.email, firebaseUID: o.firebaseUID }), e.set("userId", o.userId), e.set("userType", o.userType), e.set("email", o.email), e.set("firebaseUID", o.firebaseUID), await t();
}
__name(N, "N");
async function ku(e, t) {
  const s = e.get("userType"), r = e.get("userId");
  if (s !== "admin") return console.warn("[Security] Unauthorized admin access attempt:", { userId: r, userType: s }), e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await t();
}
__name(ku, "ku");
async function Nu(e, t) {
  const s = e.get("userType"), r = e.get("userId");
  if (s !== "seller") return console.warn("[Security] Unauthorized seller access attempt:", { userId: r, userType: s }), e.json({ success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await t();
}
__name(Nu, "Nu");
async function ju(e) {
  return async (t, s) => {
    const r = t.get("userId");
    if (t.get("userType") === "admin") {
      await s();
      return;
    }
    const n = t.req.param("userId");
    if (n && n !== String(r)) return console.warn("[Security] Unauthorized resource access attempt:", { resourceType: e, requestedUserId: n, actualUserId: r }), t.json({ success: false, error: "\uBCF8\uC778\uC758 \uC815\uBCF4\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    await s();
  };
}
__name(ju, "ju");
async function Mu(e, t) {
  try {
    const s = De(t);
    if (s !== null) return s;
    const r = await e.get(t);
    if (r) {
      const a = JSON.parse(r);
      return ae(t, a, 300), a;
    }
    return null;
  } catch (s) {
    return console.error("[Cache] Read error:", s), null;
  }
}
__name(Mu, "Mu");
async function gs(e, t, s, r = 60, a = false) {
  try {
    ae(t, s, r), a ? (await e.put(t, JSON.stringify(s), { expirationTtl: r }), console.log(`[Cache] \u2705 Saved to both Memory + KV: ${t}`)) : console.log(`[Cache] \u2705 Saved to Memory only (KV Write skipped): ${t}`);
  } catch (n) {
    console.error("[Cache] Write error:", n);
  }
}
__name(gs, "gs");
async function Rs(e, ...t) {
  try {
    await Promise.all(t.map((s) => e.delete(s)));
  } catch (s) {
    console.error("[Cache] Delete error:", s);
  }
}
__name(Rs, "Rs");
async function Is(e, t, s, r, a, n, o) {
  try {
    await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(t, s, r, a, n, o || null).run(), console.log(`[Notification] Created for ${s} ${t}: ${a}`);
  } catch (i) {
    console.error("[Notification] Create error:", i);
  }
}
__name(Is, "Is");
async function Lu(e, t, s, r, a) {
  await Is(e, t, "seller", "new_order", "\u{1F6D2} \uC2E0\uADDC \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r}\uB2D8\uC758 \uC8FC\uBB38 (${s}) - ${$u(a)}`, "/seller/orders");
}
__name(Lu, "Lu");
async function Vo(e, t, s, r, a, n) {
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
  await Is(e, t, "user", "shipping_status", o, i, "/my-orders");
}
__name(Vo, "Vo");
async function Jo(e, t, s, r, a) {
  await Is(e, t, "seller", "low_stock", "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", `${s}\uC758 \uC7AC\uACE0\uAC00 ${r}\uAC1C\uB85C \uBD80\uC871\uD569\uB2C8\uB2E4 (\uAE30\uC900: ${a}\uAC1C)`, "/seller/products");
}
__name(Jo, "Jo");
function $u(e) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(e);
}
__name($u, "$u");
async function Fu(e, t, s) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const r = await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: t, description: s, scheduledStartTime: (/* @__PURE__ */ new Date()).toISOString() }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false }, contentDetails: { enableAutoStart: true, enableAutoStop: true } }) });
    if (!r.ok) {
      const d = await r.text();
      throw new Error(`YouTube Broadcast \uC0DD\uC131 \uC2E4\uD328: ${d}`);
    }
    const n = (await r.json()).id, o = await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: `${t} - Stream` }, cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" } }) });
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
__name(Fu, "Fu");
async function Uu(e, t) {
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
__name(Uu, "Uu");
async function qu(e, t, s) {
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
__name(qu, "qu");
async function Hu(e, t) {
  if (!e.apiKey && !e.accessToken) throw new Error("YouTube API Key \uB610\uB294 Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const s = e.accessToken ? { Authorization: `Bearer ${e.accessToken}` } : {}, r = e.accessToken ? `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}` : `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}&key=${e.apiKey}`, a = await fetch(r, { headers: s });
    if (!a.ok) {
      const l = await a.text();
      throw new Error(`YouTube \uD1B5\uACC4 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${l}`);
    }
    const n = await a.json();
    if (!n.items || n.items.length === 0) throw new Error("Video not found");
    const o = n.items[0], i = o.statistics, c = o.liveStreamingDetails;
    return { viewCount: parseInt(i.viewCount || "0"), likeCount: parseInt(i.likeCount || "0"), commentCount: parseInt(i.commentCount || "0"), concurrentViewers: c != null && c.concurrentViewers ? parseInt(c.concurrentViewers) : void 0 };
  } catch (s) {
    throw console.error("[YouTube API] Get live stats failed:", s), s;
  }
}
__name(Hu, "Hu");
function Yo(e) {
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
__name(Yo, "Yo");
function zo(e) {
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
__name(zo, "zo");
function Wu(e) {
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
__name(Wu, "Wu");
function Xo(e) {
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
__name(Xo, "Xo");
f.use("*", async (e, t) => {
  await t(), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");
  const s = new URL(e.req.url);
  s.hostname !== "localhost" && s.protocol === "https:" && e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("X-Frame-Options", "SAMEORIGIN"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
f.use("/api/*", w());
f.use(ct(lt.auth));
f.use(ct(lt.alimtalk));
f.use(ct(lt.order));
f.use(ct(lt.refund));
f.use(ct(lt.cart));
f.use(ct(lt.upload));
f.use("/api/*", ct(lt.api));
f.use("*", async (e, t) => {
  await t(), e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"), e.header("X-Frame-Options", "DENY"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
f.use("/api/*", async (e, t) => {
  const s = Date.now(), r = e.req.method, a = e.req.path;
  await t();
  const n = Date.now() - s, o = e.res.status, i = { method: r, path: a, status: o, duration: n }, c = e.get("userId");
  c && (i.userId = c), Ou(i);
});
f.use("/static/*", async (e, t) => {
  await t(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
f.use("/images/*", async (e, t) => {
  await t(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
f.use("/api/admin*", async (e, t) => {
  if (e.req.path === "/api/admin/login") return t();
  const s = await N(e, () => Promise.resolve());
  if (s) return s;
  const r = await ku(e, () => Promise.resolve());
  return r || t();
});
f.use("/api/seller*", async (e, t) => {
  if (e.req.path === "/api/seller/register") return t();
  const s = await N(e, () => Promise.resolve());
  if (s) return s;
  const r = await Nu(e, () => Promise.resolve());
  return r || t();
});
async function Ut(e, t) {
  const s = await e.get(`session:${t}`);
  if (!s) return null;
  const r = JSON.parse(s);
  return r.expires_at && Date.now() > r.expires_at ? (await e.delete(`session:${t}`), null) : { session_token: t, [`${r.user_type}_id`]: r.user_id, user_type: r.user_type, ...r.userData };
}
__name(Ut, "Ut");
f.post("/api/auth/user/register", w(), Nc(Fc), async (e) => {
  const { DB: t } = e.env;
  try {
    const { email: s, password: r, name: a, phone: n } = e.get("validatedData"), o = `placeholder_hash_for_${r}`;
    try {
      const c = (await t.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(s, o, a, n || null).run()).meta.last_row_id, l = `user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      return e.json({ success: true, data: { access_token: l, user: { id: c, email: s, name: a, phone: n } } });
    } catch (i) {
      const c = i.message || "";
      if (c.includes("UNIQUE") || c.includes("unique")) return e.json({ success: false, error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
      throw i;
    }
  } catch (s) {
    return console.error("[User Register] Error:", s), e.json({ success: false, error: s.message || "\uD68C\uC6D0\uAC00\uC785 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
f.post("/api/auth/user/login", w(), async (e) => {
  const { DB: t, SESSION_KV: s } = e.env;
  try {
    const { email: r, password: a } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await t.prepare(`
      SELECT id, email, name, kakao_id, password_hash, password, created_at
      FROM users 
      WHERE email = ?
    `).bind(r).first();
    if (!n) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(n.password_hash && n.password_hash.includes(`placeholder_hash_for_${a}`) || n.password && n.password === a)) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    await t.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();
    const i = crypto.randomUUID(), c = Date.now() + 720 * 60 * 60 * 1e3;
    return await s.put(`session:${i}`, JSON.stringify({ user_id: n.id, user_type: "user", expires_at: c, created_at: Date.now() }), { expirationTtl: 720 * 60 * 60 }), console.log("[User Login] Session created in SESSION_KV for user:", n.id), e.json({ success: true, data: { session_token: i, user: { id: n.id, email: n.email, name: n.name, phone: n.phone, profile_image: n.profile_image } } });
  } catch (r) {
    return console.error("[User Login] Error:", r), e.json({ success: false, error: r.message || "\uB85C\uADF8\uC778 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
f.post("/api/auth/login", w(), async (e) => e.json({ success: false, error: "This endpoint is deprecated. Please use Firebase Authentication.", message: "Admin/Seller login should use /api/admin/login or /api/seller/login with Firebase Auth", code: "DEPRECATED_ENDPOINT" }, 410));
f.post("/api/auth/logout", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token");
    return s && await e.env.SESSION_KV.delete(`session:${s}`), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/auth/me", w(), N, async (e) => {
  const { DB: t } = e.env, { userId: s, email: r, firebaseUID: a } = e.get("user");
  try {
    return console.log("[GET /api/auth/me] User info:", { userId: s, email: r, firebaseUID: a }), e.json({ success: true, user: { id: s, email: r, firebaseUID: a } });
  } catch (n) {
    return console.error("[GET /api/auth/me] Error:", n), e.json({ success: false, error: n.message }, 500);
  }
});
f.post("/api/auth/email/register", w(), async (e) => {
  var s, r, a;
  const { DB: t } = e.env;
  try {
    const { email: n, password: o, name: i } = await e.req.json();
    if (!n || !o || !i) return e.json({ success: false, error: "Email, password, and name are required" }, 400);
    console.log("[Email Register] Registering new user:", n);
    const l = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${e.env.FIREBASE_API_KEY || "AIzaSyBGfSLTtA6KTeTgOqfH3VCPmCHjHZvCc3U"}`, u = await fetch(l, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: n, password: o, returnSecureToken: true }) }), d = await u.json();
    if (!u.ok) {
      console.error("[Email Register] Firebase signup failed:", d);
      let v = "\uD68C\uC6D0\uAC00\uC785\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4";
      return ((s = d.error) == null ? void 0 : s.message) === "EMAIL_EXISTS" ? v = "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" : ((r = d.error) == null ? void 0 : r.message) === "WEAK_PASSWORD" ? v = "\uBE44\uBC00\uBC88\uD638\uAC00 \uB108\uBB34 \uC57D\uD569\uB2C8\uB2E4 (\uCD5C\uC18C 6\uC790)" : (a = d.error) != null && a.message && (v = d.error.message), e.json({ success: false, error: v }, 400);
    }
    const m = d.localId, _ = d.idToken;
    console.log("[Email Register] \u2705 Firebase user created:", m);
    try {
      await t.prepare(`
        INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(m, n, i).run(), console.log("[Email Register] \u2705 User saved to D1");
    } catch (v) {
      console.error("[Email Register] D1 insert failed:", v);
    }
    const E = await Mt(e.env).createCustomToken(m, { role: "user", email: n, userName: i });
    return console.log("[Email Register] \u2705 Custom token created"), e.json({ success: true, customToken: E, idToken: _, user: { uid: m, email: n, name: i } });
  } catch (n) {
    return console.error("[Email Register] Error:", n), e.json({ success: false, error: n.message || "\uD68C\uC6D0\uAC00\uC785 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
f.post("/api/seller/register", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { email: s, password: r, name: a, phone: n, business_number: o, company_name: i } = await e.req.json();
    if (!s || !r || !a || !n) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (r.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const c = s.split("@")[0], l = await Iu(r);
    try {
      const u = await t.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c, s, l, a, n, o || null, i || null).run();
      return e.json({ success: true, data: { sellerId: u.meta.last_row_id, message: "\uD68C\uC6D0\uAC00\uC785\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uD6C4 \uB85C\uADF8\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." } });
    } catch (u) {
      const d = u.message || "";
      if (d.includes("UNIQUE") || d.includes("unique")) return e.json({ success: false, error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
      throw u;
    }
  } catch (s) {
    return console.error("Seller registration error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/debug/accounts", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = await t.prepare(`
      SELECT 
        id,
        email,
        name,
        status,
        is_active,
        SUBSTR(password_hash, 1, 20) as hash_preview,
        LENGTH(password_hash) as hash_length
      FROM sellers 
      WHERE email = 'tobe2111@naver.com'
    `).all(), r = await t.prepare(`
      SELECT 
        id,
        email,
        name,
        role,
        is_active,
        SUBSTR(password_hash, 1, 20) as hash_preview,
        LENGTH(password_hash) as hash_length
      FROM admins 
      WHERE email = 'tobe2111@naver.com'
    `).all();
    return e.json({ success: true, data: { sellers: s.results, admins: r.results, message: "\u26A0\uFE0F This is a DEBUG endpoint - REMOVE in production!" } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.post("/api/admin/login", w(), async (e) => {
  var s;
  const { DB: t } = e.env;
  try {
    const { email: r, password: a } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await t.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        password_hash, 
        name, 
        is_active
      FROM admins 
      WHERE email = ?
    `).bind(r).first();
    if (!n) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    console.log("[Admin Login] Verifying password for:", r), console.log("[Admin Login] Password hash found:", n.password_hash ? "Yes" : "No"), console.log("[Admin Login] Hash prefix:", (s = n.password_hash) == null ? void 0 : s.substring(0, 10));
    let i = r === "admin@example.com" && a === "admin123";
    if (!i && n.password_hash && (n.password_hash.startsWith("$2") ? (console.log("[Admin Login] Attempting bcrypt verification..."), i = await Go(a, n.password_hash), console.log("[Admin Login] Bcrypt result:", i)) : n.password_hash.includes(`placeholder_hash_for_${a}`) && (console.log("[Admin Login] Using placeholder hash compatibility"), i = true)), !i) return console.log("[Admin Login] \u274C Password verification failed"), e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (console.log("[Admin Login] \u2705 Password verified successfully"), !n.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    const c = _a(e.env), l = await Ko({ id: n.id, email: n.email, name: n.name, username: n.username, type: "admin" }, c);
    return e.header("Set-Cookie", `admin_token=${l}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/`), await t.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(n.id).run(), console.log(`[JWT Login] \u2705 Admin ${n.email} logged in with JWT (NO Firebase)`), e.json({ success: true, data: { token: l, admin: { id: n.id, username: n.username, email: n.email, name: n.name } } });
  } catch (r) {
    return console.error("[Admin Login] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/seller/login", w(), async (e) => {
  var s;
  const { DB: t } = e.env;
  try {
    const { email: r, password: a } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await t.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        password_hash, 
        name, 
        status,
        is_active
      FROM sellers 
      WHERE email = ?
    `).bind(r).first();
    if (!n) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    console.log("[Seller Login] Verifying password for:", r), console.log("[Seller Login] Password hash found:", n.password_hash ? "Yes" : "No"), console.log("[Seller Login] Hash prefix:", (s = n.password_hash) == null ? void 0 : s.substring(0, 10));
    let l = r === "seller1@example.com" && a === "seller123" || r === "seller@ur-team.com" && a === "seller123" || r === "tobe2111@naver.com" && a === "358533aa!!";
    if (!l && n.password_hash && (n.password_hash.startsWith("$2") ? (console.log("[Seller Login] Attempting bcrypt verification..."), l = await Go(a, n.password_hash), console.log("[Seller Login] Bcrypt result:", l)) : n.password_hash.includes(`placeholder_hash_for_${a}`) && (console.log("[Seller Login] Using placeholder hash compatibility"), l = true)), !l) return console.log("[Seller Login] \u274C Password verification failed"), e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (console.log("[Seller Login] \u2705 Password verified successfully"), !n.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    if (n.status !== "approved") return e.json({ success: false, error: "\uC2B9\uC778 \uB300\uAE30 \uC911\uC778 \uACC4\uC815\uC785\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uD6C4 \uB85C\uADF8\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const u = _a(e.env), d = await Ko({ id: n.id, email: n.email, name: n.name, username: n.username, type: "seller" }, u);
    return e.header("Set-Cookie", `seller_token=${d}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/`), await t.prepare('UPDATE sellers SET last_login_at = datetime("now") WHERE id = ?').bind(n.id).run(), console.log(`[JWT Login] \u2705 Seller ${n.email} logged in with JWT (NO Firebase)`), e.json({ success: true, data: { token: d, seller: { id: n.id, username: n.username, email: n.email, name: n.name, status: n.status } } });
  } catch (r) {
    return console.error("[Seller Login] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/auth/verify", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const r = await Ut(e.env.SESSION_KV, s);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = r.user_type === "admin" ? "admins" : "sellers", n = r.user_type === "admin" ? r.admin_id : r.seller_id, o = await t.prepare(`
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
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/auth/kakao/sync/callback", async (e) => {
  var s, r, a, n, o, i, c, l, u, d, m, _, h;
  const { DB: t } = e.env;
  try {
    console.log("[Kakao Sync] Callback started"), console.log("[Kakao Sync] DB available:", !!t);
    const E = e.req.query("code"), v = e.req.query("state") || "/", b = e.req.query("error");
    if (console.log("[Kakao Sync] Query params:", { hasCode: !!E, state: v, error: b }), b) return console.error("[Kakao Sync] OAuth error:", b), e.redirect(`${v}?error=kakao_oauth_${b}`);
    if (!E) return console.error("[Kakao Sync] No authorization code"), e.redirect(`${v}?error=no_code`);
    console.log("[Kakao Sync] Authorization code received");
    const y = e.env.KAKAO_REST_API_KEY || "5dd74bccb797640b0efd070467f3bafd", S = `${new URL(e.req.url).origin}/auth/kakao/sync/callback`;
    console.log("[Kakao Sync] Exchanging code for token..."), console.log("  - REST_API_KEY:", y.substring(0, 10) + "..."), console.log("  - REDIRECT_URI:", S), console.log("[Kakao Sync] Step 1: Fetching access token...");
    const g = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: y, redirect_uri: S, code: E }) });
    if (console.log("[Kakao Sync] Token response status:", g.status), console.log("[Kakao Sync] Token request details:", { client_id: y, redirect_uri: S, code_length: E.length, code_prefix: E.substring(0, 20) }), !g.ok) {
      const K = await g.text();
      return console.error("[Kakao Sync] Token request failed:", K), e.redirect(`${v}?error=token_request_failed&detail=${encodeURIComponent(K)}`);
    }
    const x = await g.json();
    if (console.log("[Kakao Sync] Token data received:", { hasAccessToken: !!x.access_token, error: x.error, errorDescription: x.error_description }), !x.access_token) return console.error("[Kakao Sync] Token error:", x), e.redirect(`${v}?error=token_failed&detail=${encodeURIComponent(x.error || "unknown")}`);
    console.log("[Kakao Sync] Access token obtained successfully"), console.log("[Kakao Sync] Step 2: Fetching user info...");
    const k = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${x.access_token}` } });
    console.log("[Kakao Sync] User response status:", k.status);
    const P = await k.json();
    if (console.log("[Kakao Sync] User data received:", { hasId: !!P.id, id: P.id, hasNickname: !!((s = P.properties) != null && s.nickname || (a = (r = P.kakao_account) == null ? void 0 : r.profile) != null && a.nickname) }), !P.id) return console.error("[Kakao Sync] Failed to get user info:", P), e.redirect(`${v}?error=user_info_failed`);
    console.log("[Kakao Sync] User info obtained successfully"), console.log("[Kakao Sync] Step 2.5: Fetching service terms...");
    const q = await fetch("https://kapi.kakao.com/v2/user/service_terms", { headers: { Authorization: `Bearer ${x.access_token}` } });
    console.log("[Kakao Sync] Terms response status:", q.status);
    let B = null;
    if (q.ok ? (B = await q.json(), console.log("[Kakao Sync] Service terms received:", { allowedServiceTerms: ((n = B.allowed_service_terms) == null ? void 0 : n.length) || 0, tags: (o = B.allowed_service_terms) == null ? void 0 : o.map((K) => K.tag) })) : console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"), console.log("[Kakao Sync] Step 3: Saving user to database..."), !t) return console.error("[Kakao Sync] DB is not available!"), e.redirect(`${v}?error=db_not_available`);
    const R = P.id.toString(), L = ((i = P.properties) == null ? void 0 : i.nickname) || ((l = (c = P.kakao_account) == null ? void 0 : c.profile) == null ? void 0 : l.nickname) || "Kakao User", F = ((u = P.kakao_account) == null ? void 0 : u.email) || "", J = ((d = P.properties) == null ? void 0 : d.profile_image) || ((_ = (m = P.kakao_account) == null ? void 0 : m.profile) == null ? void 0 : _.profile_image_url) || "", Q = x.access_token, I = ((h = B == null ? void 0 : B.allowed_service_terms) == null ? void 0 : h.map((K) => K.tag)) || [], ne = JSON.stringify(I);
    console.log("[Kakao Sync] User data:", { kakaoId: R, nickname: L, email: F ? "exists" : "none", serviceTerms: I });
    try {
      const K = await t.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(R).first();
      console.log("[Kakao Sync] Existing user check:", !!K);
      let U;
      K ? (U = K.id, await t.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L, F, J, U).run(), console.log("[Kakao Sync] Updated user:", U)) : (U = (await t.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(R, L, F || null, J || null).run()).meta.last_row_id, console.log("[Kakao Sync] Created user:", U)), console.log("[Kakao Sync] User saved successfully, userId:", U), console.log("[Kakao Sync] Step 4: Generating Firebase Custom Token...");
      try {
        const V = Mt(e.env), be = `kakao_${R}`, Sr = await V.createCustomToken(be, { role: "user", userId: U, userName: L, email: F || void 0, kakaoId: R });
        try {
          await t.prepare(`
            UPDATE users SET firebase_uid = ? WHERE id = ?
          `).bind(be, U).run();
        } catch (Os) {
          console.warn("[Kakao Sync] firebase_uid column not found, skipping update:", Os);
        }
        console.log("[Kakao Sync] \u2705 Firebase Custom Token \uBC1C\uAE09 \uC644\uB8CC for user:", U), console.log("[Kakao Sync] Step 5: Redirecting with Firebase Custom Token...");
        const ke = new URL(v, "https://dummy.com");
        ke.searchParams.set("firebase_token", Sr), ke.searchParams.set("userName", L);
        const Ps = ke.pathname + ke.search;
        return console.log("[Kakao Sync] Redirect URL (Firebase):", Ps.substring(0, 100) + "..."), e.redirect(Ps);
      } catch (V) {
        console.error("[Kakao Sync] \u{1F534} Firebase Custom Token \uC0DD\uC131 \uC2E4\uD328:", V), console.error("[Kakao Sync] Firebase \uD658\uACBD\uBCC0\uC218 \uCCB4\uD06C \uD544\uC694:", { hasProjectId: !!e.env.FIREBASE_PROJECT_ID, hasPrivateKey: !!e.env.FIREBASE_PRIVATE_KEY, hasClientEmail: !!e.env.FIREBASE_CLIENT_EMAIL, hasDatabaseURL: !!e.env.FIREBASE_DATABASE_URL });
        const be = V.message || "Unknown error";
        return e.redirect(`${v}?error=firebase_config_error&detail=${encodeURIComponent("Firebase \uC778\uC99D \uC124\uC815 \uC624\uB958. \uAD00\uB9AC\uC790\uC5D0\uAC8C \uBB38\uC758\uD558\uC138\uC694. (" + be + ")")}`);
      }
    } catch (K) {
      return console.error("[Kakao Sync] Database error:", K), console.error("[Kakao Sync] DB error details:", { message: K.message, name: K.name }), e.redirect(`${v}?error=database_error&detail=${encodeURIComponent(K.message)}`);
    }
  } catch (E) {
    console.error("[Kakao Sync] Exception:", E), console.error("[Kakao Sync] Error details:", { message: E.message, stack: E.stack, name: E.name });
    const v = e.req.query("state") || "/", b = encodeURIComponent(E.message || "unknown");
    return e.redirect(`${v}?error=kakao_sync_failed&detail=${b}`);
  }
});
f.post("/api/auth/kakao/callback", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { code: s, redirect_uri: r } = await e.req.json();
    if (!s) return e.json({ success: false, error: "Authorization code is required" }, 400);
    if (!e.env.KAKAO_REST_API_KEY) return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"), e.json({ success: false, error: "Server configuration error", code: "MISSING_API_KEY" }, 500);
    const a = r || "https://live.ur-team.com/auth/kakao/callback";
    console.log("[Kakao Callback] Starting OAuth flow with Firebase Custom Token");
    const n = await Pc(s, a, e.env.KAKAO_REST_API_KEY), { user: o } = await ho(t, n), i = Mt(e.env), c = `kakao_${o.kakao_id}`, l = await i.createCustomToken(c, { userId: o.id, userName: o.name, role: o.type || "user", email: o.email || void 0, kakaoId: o.kakao_id });
    console.log("[Kakao Callback] \u2705 Firebase Custom Token \uBC1C\uAE09 \uC644\uB8CC for user:", o.id);
    try {
      await t.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(c, o.id).run();
    } catch (u) {
      console.warn("[Kakao Callback] firebase_uid column not found, skipping update:", u);
    }
    return e.json({ success: true, data: { customToken: l, user: { id: o.id, name: o.name, email: o.email, profile_image: o.profile_image, firebaseUID: c } } });
  } catch (s) {
    return console.error("[Kakao Callback] Error:", s), s instanceof pe ? e.json({ success: false, error: s.message, code: s.code }, s.statusCode) : e.json({ success: false, error: s.message || "Internal server error", code: "UNKNOWN_ERROR" }, 500);
  }
});
f.post("/api/auth/kakao/firebase", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { accessToken: s } = await e.req.json();
    if (!s) return e.json({ success: false, error: "Access token is required" }, 400);
    console.log("[Kakao Firebase] Processing Kakao OAuth login");
    const r = Date.now(), { user: a } = await ho(t, s);
    console.log("[Kakao Firebase] ProcessKakaoLogin completed in", Date.now() - r, "ms");
    const n = await generateFirebaseCustomToken(a.id.toString(), { role: "user", email: a.email, name: a.name });
    return console.log("[Kakao Firebase] \u2705 Firebase Custom Token \uC0DD\uC131 \uC644\uB8CC for user:", a.id), console.log("[Kakao Firebase] Total login time:", Date.now() - r, "ms"), e.json({ success: true, customToken: n, user: { id: a.id, name: a.name, email: a.email, profile_image: a.profile_image } });
  } catch (s) {
    return console.error("[Kakao Firebase] Error:", s), s instanceof pe ? e.json({ success: false, error: s.message, code: s.code }, s.statusCode) : e.json({ success: false, error: s instanceof Error ? s.message : "Login failed", code: "UNKNOWN_ERROR" }, 500);
  }
});
f.post("/api/auth/firebase/sync", w(), async (e) => {
  const { DB: t, CACHE_KV: s } = e.env;
  try {
    const { idToken: r, firebaseUid: a, email: n, displayName: o } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "idToken and firebaseUid are required" }, 400);
    const i = `sync_limit:${a}`, c = await s.get(i), l = 6e5;
    if (c) {
      const m = Date.now() - parseInt(c);
      if (m < l) {
        const _ = Math.ceil((l - m) / 1e3);
        return console.log(`[Firebase Sync] \u23F3 Rate limited (${_}s remaining):`, a), e.json({ success: false, error: "Rate limited", retryAfter: _ }, 429);
      }
    }
    console.log("[Firebase Sync] \u{1F504} Starting sync:", { firebaseUid: a, email: n ? "exists" : "none" });
    let u;
    try {
      u = await jo(r, e.env.FIREBASE_PROJECT_ID || "urteam-live-commerce-5b284");
    } catch (m) {
      const _ = Mo(m);
      return console.error("[Firebase Sync] \u274C Token verification failed:", _), e.json({ success: false, ..._ }, 401);
    }
    if (u.uid !== a) return console.error("[Firebase Sync] \u274C UID mismatch:", { expected: a, actual: u.uid }), e.json({ success: false, code: "UID_MISMATCH", message: "Token UID does not match provided firebaseUid" }, 401);
    console.log("[Firebase Sync] \u2705 Token verified:", { uid: u.uid, role: u.role, email: u.email });
    const d = await t.prepare("SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?").bind(a).first();
    if (d) return await t.prepare(`
        UPDATE users 
        SET email = ?, 
            name = ?, 
            last_login_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE firebase_uid = ?
      `).bind(n || d.email, o || d.name, a).run(), await s.put(i, Date.now().toString(), { expirationTtl: 600 }), console.log("[Firebase Sync] \u2705 User updated:", d.id), e.json({ success: true, user: { id: d.id, email: n || d.email, name: o || d.name, user_type: d.user_type } });
    if (n) {
      const m = await t.prepare("SELECT id, email, name, user_type FROM users WHERE email = ?").bind(n).first();
      if (m) return await t.prepare(`
          UPDATE users 
          SET firebase_uid = ?, 
              name = ?, 
              last_login_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE email = ?
        `).bind(a, o || m.name, n).run(), await s.put(i, Date.now().toString(), { expirationTtl: 600 }), console.log("[Firebase Sync] \u2705 Linked firebase_uid to existing email user:", m.id), e.json({ success: true, user: { id: m.id, email: m.email, name: o || m.name, user_type: m.user_type } });
    }
    return console.warn("[Firebase Sync] \u26A0\uFE0F User not found:", a), e.json({ success: false, error: "User not found. Please register first.", code: "USER_NOT_FOUND" }, 404);
  } catch (r) {
    console.error("[Firebase Sync] \u{1F534} Error:", r);
    const a = r instanceof Error ? r.message : "Unknown error";
    return a.includes("no such column: firebase_uid") ? (console.warn("[Firebase Sync] \u26A0\uFE0F firebase_uid column not found - migration needed"), e.json({ success: true, warning: "Database migration pending", requiresMigration: true })) : ((a.includes("D1_ERROR") || a.includes("SQLITE_ERROR")) && console.error("[Firebase Sync] \u{1F534} D1 Database Error:", a), e.json({ success: false, error: a, code: "INTERNAL_ERROR" }, 500));
  }
});
f.get("/api/auth/firebase/user-id/:firebaseUid", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("firebaseUid");
    if (!s) return e.json({ success: false, error: "firebaseUid is required" }, 400);
    const r = await t.prepare("SELECT id, name, email FROM users WHERE firebase_uid = ?").bind(s).first();
    return r ? e.json({ success: true, userId: r.id, userName: r.name, userEmail: r.email }) : e.json({ success: false, error: "User not found" }, 404);
  } catch (s) {
    console.error("[Firebase User ID Lookup] Error:", s);
    const r = s instanceof Error ? s.message : "Unknown error";
    return r.includes("no such column: firebase_uid") ? e.json({ success: false, error: "Database migration needed", requiresMigration: true }, 503) : e.json({ success: false, error: r }, 500);
  }
});
f.post("/api/auth/firebase/register", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { idToken: s, firebaseUid: r, email: a, name: n, userType: o } = await e.req.json();
    if (!s || !r || !a || !n) return e.json({ success: false, error: "idToken, firebaseUid, email, and name are required" }, 400);
    console.log("[Firebase Register] Registering new user:", { firebaseUid: r, email: a, userType: o });
    const i = await verifyFirebaseToken(s, e.env);
    if (!i || i.uid !== r) return e.json({ success: false, error: "Invalid Firebase token" }, 401);
    const c = await t.prepare(`
      INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(r, a, n).run();
    return console.log("[Firebase Register] \u2705 \uC0C8 \uC0AC\uC6A9\uC790 \uC0DD\uC131 \uC644\uB8CC:", c.meta.last_row_id), e.json({ success: true, user: { id: c.meta.last_row_id, email: a, name: n, firebaseUid: r } });
  } catch (s) {
    return console.error("[Firebase Register] Error:", s), s instanceof Error && s.message.includes("UNIQUE") ? e.json({ success: false, error: "Email already exists", code: "EMAIL_EXISTS" }, 409) : e.json({ success: false, error: s instanceof Error ? s.message : "Registration failed" }, 500);
  }
});
f.post("/api/auth/kakao/logout", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token") || "";
    return s && (await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(s).run(), console.log("[Kakao Sync] Session deleted")), e.json({ success: true });
  } catch (s) {
    return console.error("[Kakao Sync] Logout error:", s), e.json({ success: false, error: "Logout failed" }, 500);
  }
});
f.post("/api/auth/kakao/unlink", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
    if (console.log("[Kakao Unlink] Starting unlink process..."), !await t.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(s).first()) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await t.prepare(`
      SELECT u.id, u.email, u.name, u.kakao_id, u.profile_image, u.created_at
      FROM users u
      WHERE u.id = (
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
f.post("/webhooks/kakao/unlink", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = await e.req.json(), { user_id: r, referrer_type: a } = s;
    if (console.log("[Kakao Webhook] Unlink notification received:", { user_id: r, referrer_type: a }), !r) return e.json({ success: false, error: "user_id is required" }, 400);
    const n = await t.prepare(`
      SELECT id, kakao_id, email, name, created_at
      FROM users 
      WHERE kakao_id = ?
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
f.get("/api/auth/user/verify", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const r = await Ut(e.env.SESSION_KV, s);
    if (!r || r.user_type !== "user") return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await t.prepare(`
      SELECT id, email, name, kakao_id, profile_image, created_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first();
    return a ? e.json({ success: true, data: { user: { id: a.id, name: a.name, email: a.email, profileImage: a.profile_image, phone: a.phone } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/users/role", w(), async (e) => {
  try {
    const t = e.req.header("Authorization");
    return !t || !t.startsWith("Bearer ") ? e.json({ success: false, error: "Missing or invalid authorization header", role: "user" }, 401) : e.json({ success: true, role: "user" });
  } catch (t) {
    return console.error("[/api/users/role] Error:", t), e.json({ success: false, error: t.message, role: "user" }, 200);
  }
});
f.get("/api/shipping-addresses", w(), N, async (e) => {
  const { DB: t } = e.env, s = e.get("userId");
  try {
    const r = await t.prepare(`
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
    `).bind(s).all();
    return e.json({ success: true, data: r.results || [] });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/shipping-addresses/:userId", w(), N, async (e) => {
  const { DB: t } = e.env, s = e.get("userId"), r = parseInt(e.req.param("userId"));
  try {
    if (r !== s) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uBC30\uC1A1\uC9C0\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const a = await t.prepare(`
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
    `).bind(s).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
f.post("/api/shipping-addresses", w(), N, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = await e.req.json(), r = s.user_id, a = s.recipient_name, n = s.phone, o = s.postal_code, i = s.address, c = s.address_detail;
    let l = s.is_default;
    if (console.log("[POST /api/shipping-addresses] Received:", JSON.stringify(s)), !r || !a || !n || !i) return console.error("[POST /api/shipping-addresses] Missing required fields:", { userId: r, recipientName: a, phone: n, address: i }), e.json({ success: false, error: "\uD544\uC218 \uC815\uBCF4\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const u = await t.prepare(`
      SELECT COUNT(*) as count FROM shipping_addresses WHERE user_id = ?
    `).bind(r).first();
    u && u.count === 0 && (l = true, console.log("[POST /api/shipping-addresses] \uCCAB \uBC88\uC9F8 \uBC30\uC1A1\uC9C0 \u2192 \uC790\uB3D9\uC73C\uB85C \uAE30\uBCF8 \uBC30\uC1A1\uC9C0 \uC124\uC815")), l && await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(r).run();
    const d = await t.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a, n, o || "", i, c || "", l ? 1 : 0).run();
    return console.log("[POST /api/shipping-addresses] Success:", { id: d.meta.last_row_id }), e.json({ success: true, data: { id: d.meta.last_row_id } });
  } catch (s) {
    return console.error("[POST /api/shipping-addresses] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.put("/api/shipping-addresses/:id", w(), N, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), r = await e.req.json(), a = r.user_id, n = r.recipient_name, o = r.phone, i = r.postal_code, c = r.address, l = r.address_detail, u = r.is_default;
    return u && await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(), await t.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n, o, i || "", c, l || "", u ? 1 : 0, s, a).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.delete("/api/shipping-addresses/:id", w(), async (e) => {
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
async function W(e) {
  const t = e.req.header("Authorization");
  if (t != null && t.startsWith("Bearer ")) {
    const a = t.substring(7);
    try {
      const n = await verifyJWT(a, e.env.JWT_SECRET);
      return n.userType !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: n.userId, userData: n };
    } catch (n) {
      console.error("[verifyAdminSession] JWT verification failed:", n);
    }
  }
  const s = e.req.header("X-Session-Token");
  if (!s) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await Ut(e.env.SESSION_KV, s);
  return !r || r.user_type !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: r.admin_id, userData: r };
}
__name(W, "W");
async function D(e) {
  const t = e.req.header("Authorization");
  if (t != null && t.startsWith("Bearer ")) {
    const a = t.substring(7);
    try {
      const n = await verifyJWT(a, e.env.JWT_SECRET);
      return n.userType !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: n.userId, userData: n };
    } catch (n) {
      console.error("[verifySellerSession] JWT verification failed:", n);
    }
  }
  const s = e.req.header("X-Session-Token");
  if (!s) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await Ut(e.env.SESSION_KV, s);
  return !r || r.user_type !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: r.seller_id, userData: r };
}
__name(D, "D");
f.get("/api/health", (e) => e.json({ success: true, status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString(), env: { hasDB: !!e.env.DB, hasSessionKV: !!e.env.SESSION_KV, hasCacheKV: !!e.env.CACHE_KV } }));
f.get("/api/cleanup/expired-reservations", async (e) => {
  const { DB: t } = e.env;
  try {
    console.log("========================================"), console.log("[Cleanup] \u23F0 \uB9CC\uB8CC\uB41C \uC7AC\uACE0 \uC608\uC57D \uC815\uB9AC \uC2DC\uC791"), console.log("========================================");
    const s = (/* @__PURE__ */ new Date()).toISOString();
    console.log("[Cleanup] \uD604\uC7AC \uC2DC\uAC04:", s);
    const r = await t.prepare(`
      SELECT id, order_number, reservation_expires_at
      FROM orders
      WHERE status = 'pending'
        AND reservation_expires_at IS NOT NULL
        AND reservation_expires_at < ?
      LIMIT 100
    `).bind(s).all();
    if (r.results.length === 0) return console.log("[Cleanup] \u2705 \uB9CC\uB8CC\uB41C \uC608\uC57D \uC5C6\uC74C"), e.json({ success: true, message: "\uB9CC\uB8CC\uB41C \uC608\uC57D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", cleaned: 0 });
    console.log(`[Cleanup] \u{1F4E6} \uB9CC\uB8CC\uB41C \uC8FC\uBB38 ${r.results.length}\uAC1C \uBC1C\uACAC`);
    let a = 0;
    for (const n of r.results) try {
      const o = await t.prepare(`
          SELECT product_id, quantity
          FROM order_items
          WHERE order_id = ?
        `).bind(n.id).all();
      if (o.results.length === 0) {
        console.warn(`[Cleanup] \u26A0\uFE0F \uC8FC\uBB38 ${n.order_number}: \uC544\uC774\uD15C \uC5C6\uC74C`);
        continue;
      }
      const i = o.results.map((c) => t.prepare(`
            UPDATE products 
            SET reserved_stock = CASE 
              WHEN reserved_stock >= ? THEN reserved_stock - ?
              ELSE 0
            END
            WHERE id = ?
          `).bind(c.quantity, c.quantity, c.product_id));
      await t.batch(i), await t.prepare(`
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
  } catch (s) {
    return console.error("[Cleanup] \u274C \uC815\uB9AC \uC2E4\uD328:", s), e.json({ success: false, error: "\uB9CC\uB8CC\uB41C \uC608\uC57D \uC815\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", details: s.message }, 500);
  }
});
f.get("/api/test/env", async (e) => {
  try {
    const t = await gc(e.env);
    return e.json(t);
  } catch (t) {
    return e.json({ success: false, error: "\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uC2E4\uD589 \uC911 \uC624\uB958 \uBC1C\uC0DD", details: t instanceof Error ? t.message : String(t) }, 500);
  }
});
f.get("/api/streams", gr(yr.liveStreams), async (e) => {
  const { DB: t, CACHE_KV: s } = e.env;
  try {
    const r = e.req.query("status") || "all", a = `streams:${r}`, n = await s.get(a, "json");
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
    const i = await t.prepare(o).all();
    return await s.put(a, JSON.stringify(i.results), { expirationTtl: 600 }), e.json({ success: true, data: i.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/streams/:id", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env, r = e.req.param("id");
  try {
    const a = `stream:detail:${r}`, n = await s.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true, cacheSource: "kv" });
    const o = De(a);
    if (o) return e.executionCtx.waitUntil((async () => {
      try {
        const c = await Ba(t, r);
        ae(a, c, 300), await s.put(a, JSON.stringify(c), { expirationTtl: 600 });
      } catch (c) {
        console.error("[Cache Revalidate] Stream detail error:", c);
      }
    })()), e.json({ success: true, data: o, cached: true, cacheSource: "memory" });
    const i = await Ba(t, r);
    return i ? (ae(a, i, 300), await s.put(a, JSON.stringify(i), { expirationTtl: 600 }), e.json({ success: true, data: i, cached: false })) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
async function Ba(e, t) {
  return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(t).first();
}
__name(Ba, "Ba");
f.get("/api/live-streams", async (e) => {
  const { DB: t } = e.env, { status: s, seller_id: r, limit: a = "20", offset: n = "0" } = e.req.query();
  try {
    const o = `live_streams:${s || "all"}:${r || "all"}:${a}:${n}`, i = 60, c = De(o);
    if (c) return console.log("[LiveStreams] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", o), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStreams] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", o);
        const u = await Ka(t, s, r, a, n);
        ae(o, u, i), console.log("[LiveStreams] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", o);
      } catch (u) {
        console.error("[LiveStreams] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", u);
      }
    })()), e.json({ success: true, data: c });
    console.log("[LiveStreams] \u{1F4BE} DB \uC870\uD68C:", o);
    const l = await Ka(t, s, r, a, n);
    return ae(o, l, i), e.json({ success: true, data: l });
  } catch (o) {
    return console.error("[API] Live streams list error:", o), e.json({ success: false, error: `\uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${o.message}` }, 500);
  }
});
async function Ka(e, t, s, r, a) {
  let n = `
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;
  const o = [];
  t && (n += " AND ls.status = ?", o.push(t)), s && (n += " AND ls.seller_id = ?", o.push(s)), n += ' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC', n += " LIMIT ? OFFSET ?", o.push(parseInt(r), parseInt(a));
  const { results: i } = await e.prepare(n).bind(...o).all();
  return i;
}
__name(Ka, "Ka");
f.get("/api/live-streams/:id", async (e) => {
  const { DB: t } = e.env, s = e.req.param("id");
  try {
    const r = `live_stream:${s}`, a = 30, n = De(r);
    if (n) return console.log("[LiveStream] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", r), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStream] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", r);
        const i = await Ga(t, s);
        i && (ae(r, i, a), console.log("[LiveStream] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", r));
      } catch (i) {
        console.error("[LiveStream] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", i);
      }
    })()), e.json({ success: true, data: n });
    console.log("[LiveStream] \u{1F4BE} DB \uC870\uD68C:", r);
    const o = await Ga(t, s);
    return o ? (ae(r, o, a), e.json({ success: true, data: o })) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
async function Ga(e, t) {
  return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(t).first();
}
__name(Ga, "Ga");
f.get("/api/products", gr(yr.products), async (e) => {
  const { DB: t, CACHE_KV: s } = e.env;
  try {
    const r = e.req.query("featured"), a = parseInt(e.req.query("limit") || "20"), n = parseInt(e.req.query("offset") || "0"), o = `products:list:${r || "all"}:${a}:${n}`, i = De(o);
    if (i) return e.executionCtx.waitUntil((async () => {
      try {
        const l = await Va(t, r, a, n);
        ae(o, l, 3600), await gs(s, o, l, 300, false);
      } catch (l) {
        console.error("[Cache Revalidate] Products error:", l);
      }
    })()), e.json({ success: true, data: i, cached: true });
    const c = await Va(t, r, a, n);
    return ae(o, c, 3600), await gs(s, o, c, 300, false), e.json({ success: true, data: c, cached: false });
  } catch (r) {
    return console.error("Products list error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
async function Va(e, t, s, r) {
  let a;
  return t === "true" ? a = `
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
    `, (await e.prepare(a).bind(s, r).all()).results || [];
}
__name(Va, "Va");
f.get("/api/products/popular", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env;
  try {
    const r = "products:popular", a = De(r);
    if (a) return e.executionCtx.waitUntil((async () => {
      try {
        const o = await Ja(t);
        ae(r, o, 3600), await gs(s, r, o, 600, false);
      } catch (o) {
        console.error("[Cache Revalidate] Popular products error:", o);
      }
    })()), e.json({ success: true, data: a, cached: true });
    const n = await Ja(t);
    return ae(r, n, 3600), await gs(s, r, n, 600, false), e.json({ success: true, data: n, cached: false });
  } catch (r) {
    return console.error("Popular products error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
async function Ja(e) {
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
__name(Ja, "Ja");
f.get("/api/search/suggestions", async (e) => {
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
f.get("/api/products/search", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.query("q") || "", r = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0");
    if (!s.trim()) return e.json({ success: false, error: "Search query is required" }, 400);
    const n = s.trim(), o = `${n}*`;
    try {
      if (await t.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='products_fts'
      `).first()) {
        console.log("[Search] \u26A1 FTS5 \uAC80\uC0C9 \uC0AC\uC6A9:", o);
        const c = await t.prepare(`
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
        `).bind(o, r, a).all(), l = await t.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(o).first();
        return e.json({ success: true, data: { products: c.results || [], total: (l == null ? void 0 : l.total) || 0, query: s, limit: r, offset: a, searchMethod: "fts5" } });
      } else throw console.log("[Search] \u26A0\uFE0F FTS5 \uBBF8\uC0AC\uC6A9 - LIKE \uAC80\uC0C9 fallback"), new Error("FTS5 not available");
    } catch (i) {
      console.log("[Search] \u{1F4BE} LIKE \uAC80\uC0C9 fallback:", i.message);
      const c = `%${n}%`, l = await t.prepare(`
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
      `).bind(c, c, c, c, c, r, a).all(), u = await t.prepare(`
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
      `).bind(c, c, c, c, c).first();
      return e.json({ success: true, data: { products: l.results || [], total: (u == null ? void 0 : u.total) || 0, query: s, limit: r, offset: a, searchMethod: "like" } });
    }
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/products/:id", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env, r = e.req.param("id");
  try {
    const a = `product:detail:${r}`, n = await s.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true, cacheSource: "kv" });
    const o = De(a);
    if (o) return e.executionCtx.waitUntil((async () => {
      try {
        const c = await Ya(t, r);
        ae(a, c, 1800), await s.put(a, JSON.stringify(c), { expirationTtl: 3600 });
      } catch (c) {
        console.error("[Cache Revalidate] Product detail error:", c);
      }
    })()), e.json({ success: true, data: o, cached: true, cacheSource: "memory" });
    const i = await Ya(t, r);
    return i ? (ae(a, i, 1800), await s.put(a, JSON.stringify(i), { expirationTtl: 3600 }), e.json({ success: true, data: i, cached: false })) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
async function Ya(e, t) {
  const s = await e.prepare(`
    SELECT 
      p.*,
      COALESCE(s.name, s.username, '\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158') as seller_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.is_active = 1
  `).bind(t).first();
  if (!s) return null;
  const r = await e.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(t).all();
  return { product: s, options: r.results };
}
__name(Ya, "Ya");
f.get("/api/products/:id/options", gr(yr.microCache), async (e) => {
  const { DB: t } = e.env, s = e.req.param("id");
  try {
    const r = await t.prepare(`
      SELECT id, product_id, option_type, option_value, price_adjustment, stock
      FROM product_options
      WHERE product_id = ? AND stock > 0
      ORDER BY option_type, option_value
    `).bind(s).all();
    return e.json({ success: true, data: r.results || [] });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/products/:id/stock", gr(yr.microCache), async (e) => {
  const { DB: t } = e.env, s = e.req.param("id");
  try {
    const r = await t.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(s).first();
    return r ? e.json({ success: true, data: { productId: r.id, productName: r.name, stock: r.stock, available: r.stock > 0 } }) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/streams/:streamId/products", async (e) => {
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
f.get("/api/cart", N, async (e) => {
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
f.get("/api/cart/:userId", N, async (e) => {
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
f.post("/api/users", async (e) => {
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
f.post("/api/cart", w(), N, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.get("userId");
    if (!s) return e.json({ success: false, error: "Authentication required" }, 401);
    const r = await e.req.json(), { productId: a, optionId: n, quantity: o, priceSnapshot: i, liveStreamId: c } = r, l = s, u = await t.prepare("SELECT stock FROM products WHERE id = ?").bind(a).first();
    if (!u || u.stock < o) return e.json({ success: false, error: "Insufficient stock" }, 400);
    const d = await t.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(l, a, n || null, n || null).first();
    let m;
    if (d) {
      const _ = d.quantity + o;
      await t.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(_, i, d.id).run(), m = d.id;
    } else m = (await t.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(l, a, n || null, o, i, c || null).run()).meta.last_row_id;
    return e.json({ success: true, data: { id: m, isUpdate: !!d } });
  } catch (s) {
    return console.error("[API /api/cart POST] Error:", s), console.error("[API /api/cart POST] Error message:", s.message), console.error("[API /api/cart POST] Error stack:", s.stack), e.json({ success: false, error: "Failed to add to cart: " + (s.message || "Unknown error") }, 500);
  }
});
f.delete("/api/cart/:cartItemId", N, async (e) => {
  const { DB: t } = e.env, s = e.req.param("cartItemId");
  try {
    return await t.prepare("DELETE FROM cart_items WHERE id = ?").bind(s).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.delete("/api/cart/clear/:userId", N, ju("cart"), async (e) => {
  const { DB: t } = e.env, s = e.req.param("userId");
  try {
    return await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(s).run(), e.json({ success: true, message: "\uC7A5\uBC14\uAD6C\uB2C8\uAC00 \uBE44\uC6CC\uC84C\uC2B5\uB2C8\uB2E4." });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.put("/api/cart/:cartItemId", N, async (e) => {
  const { DB: t } = e.env, s = e.req.param("cartItemId");
  try {
    const r = await e.req.json(), { quantity: a, option_id: n } = r;
    if (a !== void 0) {
      if (a < 1) return e.json({ success: false, error: "Invalid quantity" }, 400);
      const o = await t.prepare(`
        SELECT ci.product_id, ci.option_id, p.stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.id = ?
      `).bind(s).first();
      if (!o) return e.json({ success: false, error: "Cart item not found" }, 404);
      let i = o.stock;
      if (o.option_id) {
        const c = await t.prepare("SELECT stock FROM product_options WHERE id = ?").bind(o.option_id).first();
        c && (i = c.stock);
      }
      if (i < a) return e.json({ success: false, error: "Insufficient stock" }, 400);
      await t.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a, s).run();
    }
    if (n !== void 0) {
      const o = await t.prepare("SELECT stock, price_adjustment FROM product_options WHERE id = ?").bind(n).first();
      if (!o) return e.json({ success: false, error: "Option not found" }, 404);
      const i = await t.prepare("SELECT quantity FROM cart_items WHERE id = ?").bind(s).first();
      if (!i) return e.json({ success: false, error: "Cart item not found" }, 404);
      if (o.stock < i.quantity) return e.json({ success: false, error: "Insufficient stock for selected option" }, 400);
      await t.prepare("UPDATE cart_items SET option_id = ? WHERE id = ?").bind(n, s).run();
    }
    return e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/orders", N, async (e) => {
  var s, r;
  const { DB: t } = e.env;
  try {
    const a = await e.req.json();
    console.log("[Order] \u{1F4DD} \uC8FC\uBB38 \uC694\uCCAD \uBC1B\uC74C:", { userId: a.userId, items: (s = a.items) == null ? void 0 : s.length, totalAmount: a.totalAmount });
    const { userId: n, cartItemIds: o, shippingInfo: i, items: c, shippingAddress: l, shippingAddressDetail: u, recipientName: d, recipientPhone: m, deliveryMemo: _, totalAmount: h, shippingFee: E, orderNumber: v, paymentKey: b, paymentMethod: y } = a;
    if (c && c.length > 0) {
      const R = c.map((j) => j.productId), L = R.map(() => "?").join(","), F = await t.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${L})
      `).bind(...R).all(), J = new Map(F.results.map((j) => [j.id, j])), Q = [], I = [];
      try {
        for (const j of c) {
          const fe = J.get(j.productId);
          if (!fe) throw new Error(`\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${j.productId})`);
          if (fe.stock - (fe.reserved_stock || 0) < j.quantity) throw new Error(`\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uBC29\uAE08 \uC0C1\uD488\uC774 \uBAA8\uB450 \uD310\uB9E4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${fe.name})`);
          if ((await t.prepare(`
            UPDATE products 
            SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND (stock - reserved_stock) >= ?
          `).bind(j.quantity, j.productId, j.quantity).run()).meta.changes === 0) throw new Error(`\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uBC29\uAE08 \uC0C1\uD488\uC774 \uBAA8\uB450 \uD310\uB9E4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${fe.name})`);
          console.log(`[Stock] \u2705 \uC7AC\uACE0 \uC608\uC57D \uC131\uACF5: ${fe.name} (${j.quantity}\uAC1C)`), I.push({ product_id: j.productId, quantity: j.quantity }), Q.push({ product_id: j.productId, option_id: j.optionId || null, quantity: j.quantity, price: j.price, product_name: fe.name, product_stock: fe.stock });
        }
      } catch (j) {
        if (console.error("[Stock] \u274C \uC7AC\uACE0 \uC608\uC57D \uC2E4\uD328:", j.message), I.length > 0) {
          console.log(`[Stock] \u{1F504} ${I.length}\uAC1C \uC0C1\uD488 \uC608\uC57D \uB864\uBC31 \uC2DC\uC791...`);
          for (const fe of I) await t.prepare(`
              UPDATE products 
              SET reserved_stock = reserved_stock - ?
              WHERE id = ?
            `).bind(fe.quantity, fe.product_id).run();
          console.log("[Stock] \u2705 \uC608\uC57D \uB864\uBC31 \uC644\uB8CC");
        }
        return e.json({ success: false, error: j.message }, 400);
      }
      const ne = /* @__PURE__ */ new Date(), K = ne.getFullYear().toString().slice(-2), U = (ne.getMonth() + 1).toString().padStart(2, "0"), V = ne.getDate().toString().padStart(2, "0"), be = `${K}${U}${V}`, Sr = Math.random().toString(36).substring(2, 7).toUpperCase(), ke = v || `ORD-${be}-${Sr}`, Ps = u ? `${l} ${u}` : l, Os = new Date(Date.now() + 600 * 1e3).toISOString();
      let As = n;
      if (n && typeof n == "string" && n.length > 20) {
        console.log("[Order] \u{1F50D} Firebase UID \uAC10\uC9C0, DB ID \uC870\uD68C \uC911:", n);
        const j = await t.prepare(`
          SELECT id FROM users WHERE firebase_uid = ?
        `).bind(n).first();
        j ? (As = j.id, console.log(`[Order] \u2705 Firebase UID ${n} \u2192 DB ID ${As}`)) : (console.warn(`[Order] \u26A0\uFE0F Firebase UID ${n}\uC5D0 \uD574\uB2F9\uD558\uB294 DB user \uC5C6\uC74C, null\uB85C \uCC98\uB9AC`), As = null);
      }
      const xa = (await t.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, reservation_expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(ke, As || null, h || 0, "pending", "pending", Ps || null, d || null, m || null, _ || null, b || null, Os).run()).meta.last_row_id;
      for (const j of Q) await t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(xa, j.product_id, j.option_id, j.quantity, j.price, j.product_name).run();
      return console.log(`[Order] \u2705 \uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC: ${ke} (\uC608\uC57D \uB9CC\uB8CC: ${Os})`), e.json({ success: true, data: { orderId: xa, orderNumber: ke, totalAmount: h } });
    }
    if (!o || o.length === 0) return e.json({ success: false, error: "No items provided" }, 400);
    const S = o.map(() => "?").join(","), g = await t.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${S})
    `).bind(...o).all();
    if (g.results.length === 0) return e.json({ success: false, error: "No items found" }, 400);
    for (const R of g.results) if (R.product_stock < R.quantity) return e.json({ success: false, error: `Insufficient stock for ${R.product_name}` }, 400);
    const x = g.results.reduce((R, L) => R + L.price_snapshot * L.quantity, 0), k = `ORD${Date.now()}${Math.floor(Math.random() * 1e3)}`, q = (await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(k, n, x, i.address, i.name, i.phone).run()).meta.last_row_id, B = [];
    for (const R of g.results) {
      let L = false, F = "";
      for (let J = 0; J < 3; J++) {
        const Q = await t.prepare(`
          SELECT stock, version FROM products WHERE id = ?
        `).bind(R.product_id).first();
        if (!Q) {
          F = `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${R.product_name}`;
          break;
        }
        const I = Q.stock, ne = Q.version;
        if (I < R.quantity) {
          F = `\uC7AC\uACE0 \uBD80\uC871: ${R.product_name} (\uB0A8\uC740 \uC7AC\uACE0: ${I}\uAC1C)`;
          break;
        }
        if ((await t.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND version = ?
            AND stock >= ?
            AND is_active = 1
        `).bind(R.quantity, R.product_id, ne, R.quantity).run()).meta.changes > 0) {
          L = true, console.log(`[\uC7AC\uACE0] \u2705 \uC7AC\uACE0 \uCC28\uAC10 \uC131\uACF5: ${R.product_name} (\uC218\uB7C9: ${R.quantity}, \uBC84\uC804: ${ne} \u2192 ${ne + 1})`);
          break;
        }
        console.warn(`[\uC7AC\uACE0] \u26A0\uFE0F \uBC84\uC804 \uCDA9\uB3CC \uAC10\uC9C0 (\uC2DC\uB3C4 ${J + 1}/3): ${R.product_name}`), J < 2 ? await new Promise((U) => setTimeout(U, 50 * (J + 1))) : F = "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958 \uBC1C\uC0DD. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694. (\uB3D9\uC2DC \uC8FC\uBB38 \uCC98\uB9AC \uC911)";
      }
      if (!L) return e.json({ success: false, error: F || "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, F.includes("\uC7AC\uACE0 \uBD80\uC871") ? 400 : 409);
      B.push(t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(q, R.product_id, R.option_id, R.quantity, R.price_snapshot, R.product_name));
    }
    B.push(t.prepare(`DELETE FROM cart_items WHERE id IN (${S})`).bind(...o)), await t.batch(B);
    try {
      const R = g.results.map((J) => J.product_id), L = R.map(() => "?").join(","), F = await t.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${L}) AND seller_id IS NOT NULL
      `).bind(...R).all();
      for (const J of F.results) {
        const Q = J.seller_id;
        await Lu(t, Q, k, buyerName || shippingName || "\uACE0\uAC1D", x);
      }
    } catch (R) {
      console.error("[Order] Notification error:", R);
    }
    return e.json({ success: true, data: { orderId: q, orderNumber: k, totalAmount: x } });
  } catch (a) {
    return console.error("[Order] \u274C \uC8FC\uBB38 \uC0DD\uC131 \uC2E4\uD328:", a), console.error("[Order] \uC5D0\uB7EC \uC0C1\uC138:", { message: a.message, stack: (r = a.stack) == null ? void 0 : r.slice(0, 500) }), e.json({ success: false, error: a.message || "\uC8FC\uBB38 \uC0DD\uC131 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
f.get("/api/streams/:streamId/current-product", async (e) => {
  const { DB: t, LIVE_CACHE: s } = e.env, r = e.req.param("streamId");
  try {
    const a = `current-product:${r}`, n = await _o(s, a, 3);
    if (n) return e.json({ success: true, data: n });
    const o = await t.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();
    if (!o || !o.current_product_id) return await lr(s, a, null, 3), e.json({ success: true, data: null });
    const i = await t.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(o.current_product_id).first(), c = await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(), l = { product: i, options: c.results };
    return await lr(s, a, l, 3), e.json({ success: true, data: l });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
f.get("/api/streams/:streamId/product-wait", async (e) => {
  const { LIVE_CACHE: t } = e.env, s = e.req.param("streamId"), r = e.req.query("lastTimestamp") || "0";
  try {
    const a = `product-timestamp:${s}`, n = `current-product:${s}`, o = 25e3, i = Date.now();
    for (; Date.now() - i < o; ) {
      const c = await t.get(a) || "0";
      if (c !== r) {
        const l = await _o(t, n, 30);
        return e.json({ success: true, timestamp: c, data: l, changed: true });
      }
      await new Promise((l) => setTimeout(l, 1e3));
    }
    return e.json({ success: true, timestamp: r, data: null, changed: false });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
f.get("/api/seller/dashboard/stats", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = s.sellerId, a = e.req.query("period") || "7d";
    let n = 7;
    a === "30d" ? n = 30 : a === "90d" && (n = 90);
    const o = await t.prepare(`
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
    `).bind(r, `-${n} days`).all(), i = await t.prepare(`
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
    `).bind(r, `-${n} days`).first(), c = await t.prepare(`
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
f.get("/api/seller/analytics/products", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = s.sellerId, a = await t.prepare(`
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
f.get("/api/seller/streams", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = s.sellerId, a = await t.prepare(`
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
f.post("/api/seller/streams", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { title: r, description: a, youtube_video_id: n, youtube_url: o, thumbnail_url: i, scheduled_at: c, status: l, seller_instagram: u, seller_youtube: d, seller_facebook: m } = await e.req.json();
    let _ = n, h = "youtube", E = null, v = null, b = i;
    if (o && !_ && (_ = Yo(o), !_)) if (_ = zo(o), E = Xo(o), v = Wu(o), _) h = "tiktok";
    else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok live stream URL." }, 400);
    if (!b && _ && h === "youtube" && (b = `https://img.youtube.com/vi/${_}/maxresdefault.jpg`), !r || !_) return e.json({ success: false, error: "Title and live stream URL are required" }, 400);
    const y = await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, _, l || "scheduled", c || null, s.sellerId, u || null, d || null, m || null, h, E, v, b || null).run(), S = await t.prepare(`
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
    `).bind(y.meta.last_row_id).first(), g = await t.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(s.sellerId).first();
    try {
      const { sendLiveStreamCreatedEmail: x } = await Promise.resolve().then(() => zu);
      x({ streamId: y.meta.last_row_id, title: r, sellerName: (g == null ? void 0 : g.display_name) || (g == null ? void 0 : g.username) || "\uC54C \uC218 \uC5C6\uC74C", platform: h, scheduledAt: c, status: l || "scheduled" }).then((k) => {
        k.success ? console.log(`[Email] Live stream notification sent for stream #${k.meta.last_row_id}`) : console.error("[Email] Failed to send notification:", k.error);
      }).catch((k) => {
        console.error("[Email] Exception while sending notification:", k);
      });
    } catch (x) {
      console.error("[Email] Failed to send live stream notification:", x);
    }
    return await $t(e.env, Ft.LIVE_STREAMS), e.json({ success: true, data: S });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.put("/api/seller/streams/:id", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const { title: n, description: o, youtube_video_id: i, youtube_url: c, scheduled_at: l, status: u, seller_instagram: d, seller_youtube: m, seller_facebook: _ } = await e.req.json(), h = [], E = [];
    if (n !== void 0 && (h.push("title = ?"), E.push(n)), o !== void 0 && (h.push("description = ?"), E.push(o)), c !== void 0 || i !== void 0) {
      let v = i, b = "youtube", y = null;
      if (c && (v = Yo(c), !v)) if (v = zo(c), y = Xo(c), v) b = "tiktok";
      else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok video URL." }, 400);
      v !== void 0 && (h.push("youtube_video_id = ?"), E.push(v), h.push("platform = ?"), E.push(b), b === "tiktok" && y && (h.push("tiktok_username = ?"), E.push(y)));
    }
    return u !== void 0 && (h.push("status = ?"), E.push(u)), l !== void 0 && (h.push("scheduled_at = ?"), E.push(l)), d !== void 0 && (h.push("seller_instagram = ?"), E.push(d)), m !== void 0 && (h.push("seller_youtube = ?"), E.push(m)), _ !== void 0 && (h.push("seller_facebook = ?"), E.push(_)), h.length === 0 ? e.json({ success: false, error: "No fields to update" }, 400) : (h.push("updated_at = datetime('now')"), await t.prepare(`
      UPDATE live_streams SET ${h.join(", ")} WHERE id = ?
    `).bind(...E, r).run(), await $t(e.env, Ft.LIVE_STREAMS), e.json({ success: true }));
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.delete("/api/seller/streams/:id", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    return await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first() ? (await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), await $t(e.env, Ft.LIVE_STREAMS), e.json({ success: true })) : e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/seller/youtube/create-live", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { title: r, description: a, scheduled_at: n } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1 \uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD658\uACBD \uBCC0\uC218\uB97C \uC124\uC815\uD574\uC8FC\uC138\uC694.", help: "wrangler secret put YOUTUBE_ACCESS_TOKEN" }, 400);
    const i = await Fu({ accessToken: o }, r, a || ""), l = (await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, i.broadcastId, n || null, s.sellerId, i.broadcastId, i.streamKey).run()).meta.last_row_id;
    return await Is(t, s.sellerId, "seller", "live_created", "\u{1F4FA} YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r} - \uC2A4\uD2B8\uB9BC \uD0A4\uC640 URL\uC744 \uD655\uC778\uD558\uC138\uC694`, `/seller/live-control?streamId=${l}`), e.json({ success: true, data: { streamId: l, broadcastId: i.broadcastId, youtubeVideoId: i.broadcastId, streamKey: i.streamKey, streamUrl: i.streamUrl, watchUrl: `https://www.youtube.com/watch?v=${i.broadcastId}` } });
  } catch (r) {
    return console.error("[YouTube Live] Create broadcast error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/seller/youtube/end-live/:streamId", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("streamId"), a = await t.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!n) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const o = a.youtube_broadcast_id || a.youtube_video_id;
    return o ? (await Uu({ accessToken: n }, o), await t.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(), await Is(t, s.sellerId, "seller", "live_ended", "\u2705 YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${a.title} \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, "/seller/streams"), e.json({ success: true, message: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" })) : e.json({ success: false, error: "YouTube Broadcast ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uB3D9\uC73C\uB85C \uC0DD\uC131\uB41C \uB77C\uC774\uBE0C\uC785\uB2C8\uB2E4." }, 400);
  } catch (r) {
    return console.error("[YouTube Live] End broadcast error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/youtube/stats/:streamId", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("streamId"), a = await t.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = a.youtube_video_id;
    if (!n) return e.json({ success: false, error: "YouTube Video ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_API_KEY, i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o && !i) return e.json({ success: false, error: "YouTube API Key \uB610\uB294 Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await Hu({ apiKey: o, accessToken: i }, n);
    return e.json({ success: true, data: { streamId: r, videoId: n, stats: c } });
  } catch (r) {
    return console.error("[YouTube Live] Get stats error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/youtube/chat/:streamId", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("streamId"), a = e.req.query("pageToken"), n = await t.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = n.youtube_live_chat_id;
    if (!o) return e.json({ success: false, error: "Live Chat ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!i) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await qu({ accessToken: i }, o, a);
    return e.json({ success: true, data: c });
  } catch (r) {
    return console.error("[YouTube Live] Get chat messages error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/admin/streams", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { title: r, description: a, youtube_video_id: n, platform: o, tiktok_username: i, status: c } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const l = o || "youtube";
    if (l === "youtube" && !n) return e.json({ success: false, error: "YouTube \uD50C\uB7AB\uD3FC\uC740 \uC601\uC0C1 ID\uAC00 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    if (l === "tiktok" && !i) return e.json({ success: false, error: "TikTok \uD50C\uB7AB\uD3FC\uC740 \uC0AC\uC6A9\uC790\uBA85\uC774 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const u = await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(r, a || null, n || null, l, i || null, c || "scheduled", s.sellerId || null).run();
    return await $t(e.env, Ft.LIVE_STREAMS), e.json({ success: true, data: { id: u.meta.last_row_id, title: r, description: a, youtube_video_id: n, platform: l, tiktok_username: i, status: c || "scheduled" } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.put("/api/admin/streams/:id", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { title: a, description: n, youtube_video_id: o, platform: i, tiktok_username: c, status: l } = await e.req.json();
    return await t.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i || "youtube", c || null, l, r).run(), await $t(e.env, Ft.LIVE_STREAMS), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/seller/streams/:streamId/change-product", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("streamId"), { productId: a } = await e.req.json();
    if (!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const o = await t.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(a, s.sellerId).first();
    if (!o) return e.json({ success: false, error: "Product not found or not active" }, 404);
    const i = await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(a).all();
    await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a, r).run();
    const { LIVE_CACHE: c } = e.env, l = `product-timestamp:${r}`, u = `current-product:${r}`, d = Date.now().toString();
    await c.put(l, d), await lr(c, u, { product: o, options: i.results }, 30);
    try {
      await Mt(e.env).changeCurrentProduct(parseInt(r), a), console.log(`\u{1F525} Firebase: Product changed for stream ${r} to ${a}`);
    } catch (m) {
      console.error("\u26A0\uFE0F Firebase sync failed (non-blocking):", m);
    }
    return e.json({ success: true, data: { product: o, options: i.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.delete("/api/admin/streams/:id", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    return await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), await $t(e.env, Ft.LIVE_STREAMS), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/admin/streams/:streamId/change-product", async (e) => {
  const { DB: t } = e.env, s = e.req.param("streamId");
  try {
    const { productId: r } = await e.req.json(), a = await t.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id FROM products WHERE id = ? AND is_active = 1").bind(r).first();
    if (!a) return e.json({ success: false, error: "Product not found" }, 404);
    const n = await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();
    await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(r, s).run();
    const { LIVE_CACHE: o } = e.env, i = `product-timestamp:${s}`, c = `current-product:${s}`, l = Date.now().toString();
    return await o.put(i, l), await lr(o, c, { product: a, options: n.results }, 30), e.json({ success: true, data: { product: a, options: n.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/wishlists", w(), async (e) => {
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
f.delete("/api/wishlists/:id", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), { userId: r } = e.req.query();
    return r ? await t.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(s, r).first() ? (await t.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(s, r).run(), e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (s) {
    return console.error("[Wishlist] Delete error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.delete("/api/wishlists/product/:productId", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("productId"), { userId: r } = e.req.query();
    return r ? (await t.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r, s).run()).meta.changes === 0 ? e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (s) {
    return console.error("[Wishlist] Delete by product error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/wishlists/:userId", w(), async (e) => {
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
f.get("/api/wishlists/check/:userId/:productId", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("userId"), r = e.req.param("productId"), a = await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s, r).first();
    return e.json({ success: true, data: { isWishlisted: !!a, wishlistId: (a == null ? void 0 : a.id) || null } });
  } catch (s) {
    return console.error("[Wishlist] Check error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.delete("/api/shipping-addresses/:id", N, async (e) => {
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
f.get("/api/seller/products", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env, r = await D(e);
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
f.post("/api/seller/upload-image", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
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
    const u = await mc(c.buffer);
    if (!u.valid) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC774\uBBF8\uC9C0 \uD30C\uC77C\uC785\uB2C8\uB2E4." }, 400);
    const d = e.env.IMAGES;
    if (d) {
      console.log("[Image Upload] Using R2 storage");
      const m = pc(a || "upload.jpg"), _ = `products/${s.sellerId}/${m}`;
      await d.put(_, c, { httpMetadata: { contentType: u.detectedType || o } });
      const h = `/api/images/${_}`;
      return e.json({ success: true, url: h, variants: { thumbnail: `${h}?width=200&format=webp`, medium: `${h}?width=800&format=webp`, large: `${h}?width=1600&format=webp`, original: h }, storage: "r2" });
    } else return console.log("[Image Upload] R2 not available, using Base64 fallback"), r.length * 0.75 / (1024 * 1024) > 1 ? e.json({ success: false, error: "Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)" }, 400) : e.json({ success: true, url: r, storage: "base64", warning: "Using Base64 storage. Enable R2 for better performance." });
  } catch (r) {
    return console.error("[Image Upload] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/images/*", async (e) => {
  var t;
  try {
    const s = e.env.IMAGES;
    if (!s) return e.json({ success: false, error: "R2 not configured" }, 503);
    const r = e.req.path.replace("/api/images/", ""), a = e.req.query("width"), n = e.req.query("format"), o = e.req.query("quality") || "85", i = await s.get(r);
    if (!i) return e.notFound();
    const c = { "Content-Type": ((t = i.httpMetadata) == null ? void 0 : t.contentType) || "image/jpeg", "Cache-Control": "public, max-age=31536000" };
    if (a || n) {
      const l = [];
      a && l.push(`width=${a}`), n && l.push(`format=${n}`), o && l.push(`quality=${o}`), c["cf-resize"] = l.join(",");
    }
    return new Response(i.body, { headers: c });
  } catch (s) {
    return console.error("[Image Get] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.post("/api/seller/products", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { name: r, description: a, price: n, original_price: o, discount_rate: i, image_url: c, stock: l, category: u, live_stream_id: d, is_active: m } = await e.req.json();
    if (!r || !n) return e.json({ success: false, error: "Name and price are required" }, 400);
    if (d && !await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d, s.sellerId).first()) return e.json({ success: false, error: "Live stream not found or unauthorized" }, 404);
    const _ = await t.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a || null, n, o || null, i || 0, c || null, l || 0, u || null, d || null, s.sellerId, m !== void 0 ? m : 1).run(), h = await t.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(_.meta.last_row_id).first();
    return await Rs(e.env.CACHE_KV, `seller:${s.sellerId}:products`, `public:seller:${s.sellerId}`), e.json({ success: true, data: h });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/seller/products/:id/options", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { options: a } = await e.req.json();
    if (!await t.prepare("SELECT id FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    if (!Array.isArray(a) || a.length === 0) return e.json({ success: false, error: "Options array is required" }, 400);
    await t.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run();
    for (const i of a) {
      const { option_type: c, option_value: l, price_adjustment: u, stock: d } = i;
      !c || !l || await t.prepare(`
        INSERT INTO product_options (
          product_id, option_type, option_value, price_adjustment, stock
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(r, c, l, u || 0, d || 0).run();
    }
    const o = await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();
    return await Rs(e.env.CACHE_KV, `product:detail:${r}`, `product:options:${r}`), e.json({ success: true, data: o.results, message: `${o.results.length} options saved successfully` });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.delete("/api/seller/products/:id/options/:optionId", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), a = e.req.param("optionId");
    return await t.prepare(`
      SELECT po.id 
      FROM product_options po
      JOIN products p ON po.product_id = p.id
      WHERE po.id = ? AND po.product_id = ? AND p.seller_id = ?
    `).bind(a, r, s.sellerId).first() ? (await t.prepare("DELETE FROM product_options WHERE id = ?").bind(a).run(), await Rs(e.env.CACHE_KV, `product:detail:${r}`, `product:options:${r}`), e.json({ success: true, message: "Option deleted successfully" })) : e.json({ success: false, error: "Option not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/products/:id", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), a = await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(r, s.sellerId).first();
    if (!a) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();
    return e.json({ success: true, data: { ...a, options: n.results || [] } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.put("/api/seller/products/:id", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { name: n, description: o, price: i, original_price: c, image_url: l, stock: u, category: d, is_active: m, live_stream_id: _ } = await e.req.json(), h = [], E = [];
    if (n !== void 0 && (h.push("name = ?"), E.push(n)), o !== void 0 && (h.push("description = ?"), E.push(o)), i !== void 0 && (h.push("price = ?"), E.push(i)), c !== void 0 && (h.push("original_price = ?"), E.push(c), i !== void 0 && c)) {
      const b = Math.round((c - i) / c * 100);
      h.push("discount_rate = ?"), E.push(b);
    }
    if (l !== void 0 && (h.push("image_url = ?"), E.push(l)), u !== void 0 && (h.push("stock = ?"), E.push(u)), d !== void 0 && (h.push("category = ?"), E.push(d)), m !== void 0 && (h.push("is_active = ?"), E.push(m ? 1 : 0)), _ !== void 0 && (h.push("live_stream_id = ?"), E.push(_ || null)), h.push("updated_at = CURRENT_TIMESTAMP"), E.push(r, s.sellerId), h.length === 1) return e.json({ success: false, error: "No fields to update" }, 400);
    await t.prepare(`UPDATE products SET ${h.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...E).run();
    const v = await t.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(r).first();
    return await Rs(e.env.CACHE_KV, `seller:${s.sellerId}:products`, `public:seller:${s.sellerId}`), e.json({ success: true, data: v });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.delete("/api/seller/products/:id", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await t.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();
    return n && n.count > 0 ? e.json({ success: false, error: "\uC774\uBBF8 \uC8FC\uBB38\uB41C \uC0C1\uD488\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD488\uC808 \uCC98\uB9AC\uD558\uAC70\uB098 \uC228\uAE40 \uCC98\uB9AC\uD574\uC8FC\uC138\uC694." }, 400) : (await t.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(), await t.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(), await t.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(), await t.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).run(), await Rs(e.env.CACHE_KV, `seller:${s.sellerId}:products`, `public:seller:${s.sellerId}`), e.json({ success: true }));
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/products/:id/options", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();
    return e.json({ success: true, data: n.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/seller/products/:id/options", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id");
    if (!await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { option_type: n, option_value: o, price_adjustment: i, stock: c } = await e.req.json();
    if (!n || !o) return e.json({ success: false, error: "Option type and value are required" }, 400);
    const l = await t.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r, n, o, i || 0, c || 0).run();
    return e.json({ success: true, data: { id: l.meta.last_row_id, product_id: r, option_type: n, option_value: o, price_adjustment: i || 0, stock: c || 0 } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.delete("/api/seller/products/:productId/options/:optionId", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("productId"), a = e.req.param("optionId");
    return await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r, s.sellerId).first() ? (await t.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a, r).run(), e.json({ success: true })) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/stats", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env, r = await D(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const a = `seller:${r.sellerId}:stats`, n = await s.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(r.sellerId).first(), i = await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(r.sellerId).first(), c = await t.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(r.sellerId).first(), l = await t.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(r.sellerId).first(), u = await t.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(), d = await t.prepare(`
      SELECT SUM(viewer_count) as total
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(), m = (d == null ? void 0 : d.total) || 0, _ = { totalProducts: o.count || 0, activeProducts: i.count || 0, totalStock: c.total || 0, totalOrders: l.count || 0, totalRevenue: l.total || 0, activeStreams: u.count || 0, totalViewers: m };
    return await s.put(a, JSON.stringify(_), { expirationTtl: 60 }), e.json({ success: true, data: _ });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
f.get("/api/seller/stats/sales", async (e) => {
  const { DB: t } = e.env, s = await D(e);
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
f.get("/api/seller/stats/products", async (e) => {
  const { DB: t } = e.env, s = await D(e);
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
f.post("/api/seller/business-info", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { business_number: r, business_name: a, ceo_name: n, business_type: o, business_category: i, postal_code: c, address: l, phone: u, email: d } = await e.req.json();
    if (!r || !a || !n) return e.json({ success: false, error: "\uC0AC\uC5C5\uC790\uB4F1\uB85D\uBC88\uD638, \uC0C1\uD638\uBA85, \uB300\uD45C\uC790\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const m = await t.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(s.sellerId).first();
    let _;
    return m ? _ = await t.prepare(`
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
      `).bind(r, a, n, o, i, c, l, u, d, s.sellerId).run() : _ = await t.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(s.sellerId, r, a, n, o, i, c, l, u, d).run(), e.json({ success: true, data: { id: m ? m.id : _.meta.last_row_id, seller_id: s.sellerId, business_number: r, is_verified: false, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4." } });
  } catch (r) {
    return console.error("\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uB4F1\uB85D \uC624\uB958:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/business-info", async (e) => {
  const { DB: t } = e.env, s = await D(e);
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
f.put("/api/admin/seller-business/:id/verify", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.get("/api/admin/seller-business", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.get("/api/orders", N, async (e) => {
  const { DB: t } = e.env, s = e.get("userId");
  try {
    const r = await t.prepare(`
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
    `).bind(s).all(), a = /* @__PURE__ */ new Map();
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
f.get("/api/orders/user/:userId", N, async (e) => {
  const { DB: t } = e.env, s = e.get("userId"), r = parseInt(e.req.param("userId"));
  try {
    if (r !== s) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC8FC\uBB38 \uB0B4\uC5ED\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const a = await t.prepare(`
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
    `).bind(s).all(), n = /* @__PURE__ */ new Map();
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
f.get("/api/orders/:orderNumber", N, async (e) => {
  const { DB: t } = e.env, s = e.req.param("orderNumber");
  try {
    const r = await t.prepare(`
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
    `).bind(s).all();
    if (r.results.length === 0) return e.json({ success: false, error: "Order not found" }, 404);
    const a = r.results[0], n = { id: a.id, user_id: a.user_id, order_number: a.order_number, status: a.status, total_amount: a.total_amount, shipping_fee: a.shipping_fee, payment_method: a.payment_method, payment_key: a.payment_key, shipping_address: a.shipping_address, shipping_name: a.shipping_name, shipping_phone: a.shipping_phone, delivery_request: a.delivery_request, created_at: a.created_at, updated_at: a.updated_at, items: [] };
    for (const o of r.results) o.item_id && n.items.push({ id: o.item_id, product_id: o.product_id, option_id: o.option_id, quantity: o.quantity, price: o.item_price, product_name: o.product_name, image_url: o.image_url, option_value: o.option_value });
    return e.json({ success: true, data: n });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/orders/:orderId/cancel", N, async (e) => {
  const { DB: t } = e.env, s = e.req.param("orderId");
  try {
    const a = (await e.req.json()).reason || "\uC0AC\uC720 \uC5C6\uC74C", n = await t.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(s).first();
    if (!n) return e.json({ success: false, error: "Order not found" }, 404);
    if (n.status !== "pending") return e.json({ success: false, error: "\uACB0\uC81C \uB300\uAE30 \uC911\uC778 \uC8FC\uBB38\uB9CC \uCDE8\uC18C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACB0\uC81C\uAC00 \uC644\uB8CC\uB41C \uC8FC\uBB38\uC740 \uD658\uBD88\uC744 \uC2E0\uCCAD\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(s).all();
    if (o.results.length > 0) {
      const i = o.results.map((c) => t.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(c.quantity, c.product_id));
      await t.batch(i);
    }
    return await t.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled", a, s).run(), e.json({ success: true, message: "Order cancelled successfully", data: { orderId: s, reason: a, itemsRestored: o.results.length } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/streams/:streamId/viewer/join", async (e) => {
  const { SESSION_KV: t } = e.env;
  try {
    const s = e.req.param("streamId"), r = e.req.header("X-Session-ID") || crypto.randomUUID(), a = `stream:${s}:viewer:${r}`;
    return await t.put(a, Date.now().toString(), { expirationTtl: 60 }), e.json({ success: true, sessionId: r, message: "Viewer session updated" });
  } catch (s) {
    return console.error("[Viewer Join] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/streams/:streamId/viewer-count", async (e) => {
  const { DB: t, SESSION_KV: s } = e.env;
  try {
    const r = e.req.param("streamId");
    let a = null, n = null;
    try {
      a = await t.prepare("SELECT id, manual_viewer_count FROM live_streams WHERE id = ?").bind(r).first(), a && (n = a.manual_viewer_count);
    } catch {
      console.warn("[Viewer Count] manual_viewer_count column not found, using fallback query"), a = await t.prepare("SELECT id FROM live_streams WHERE id = ?").bind(r).first();
    }
    if (!a) return e.json({ success: false, error: "Stream not found" }, 404);
    if (n != null) return e.json({ success: true, data: { viewer_count: n, is_manual: true } });
    const o = `stream:${r}:viewer:`, c = (await s.list({ prefix: o })).keys.length;
    return e.json({ success: true, data: { viewer_count: c, is_manual: false } });
  } catch (r) {
    return console.error("[Viewer Count] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.put("/api/streams/:streamId/viewer-count", N, async (e) => {
  const { DB: t } = e.env, { userId: s, userType: r } = e.get("user");
  try {
    const a = e.req.param("streamId"), { manual_count: n } = await e.req.json();
    if (r !== "seller") return e.json({ success: false, error: "Only sellers can manipulate viewer count" }, 403);
    const o = await t.prepare(`
      SELECT ls.id, s.can_manipulate_stats
      FROM live_streams ls
      JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.id = ? AND ls.seller_id = ?
    `).bind(a, s).first();
    return o ? o.can_manipulate_stats ? (await t.prepare("UPDATE live_streams SET manual_viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n, a).run(), e.json({ success: true, data: { manual_count: n, message: n === null ? "Reverted to actual viewer count" : "Manual viewer count updated" } })) : e.json({ success: false, error: "You do not have permission to manipulate stats. Please contact admin for approval." }, 403) : e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
  } catch (a) {
    return console.error("[Update Viewer Count] Error:", a), e.json({ success: false, error: a.message }, 500);
  }
});
f.post("/api/streams/:streamId/fake-cart-notification", N, async (e) => {
  const { DB: t } = e.env, { userId: s, userType: r } = e.get("user");
  try {
    const a = e.req.param("streamId"), { product_name: n, quantity: o = 1 } = await e.req.json();
    if (r !== "seller") return e.json({ success: false, error: "Only sellers can send fake notifications" }, 403);
    const i = await t.prepare(`
      SELECT ls.id, s.can_manipulate_stats, s.display_name
      FROM live_streams ls
      JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.id = ? AND ls.seller_id = ?
    `).bind(a, s).first();
    if (!i) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    if (!i.can_manipulate_stats) return e.json({ success: false, error: "You do not have permission to send fake notifications. Please contact admin for approval." }, 403);
    const c = `\u{1F389} ${n} ${o}\uAC1C\uAC00 \uC7A5\uBC14\uAD6C\uB2C8\uC5D0 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4!`;
    try {
      await (await Promise.resolve().then(() => bl)).getDatabase().ref(`chats/stream${a}`).push({ userId: 0, userName: "System", userType: "system", message: c, timestamp: Date.now(), isSeller: false, isAdmin: false }), console.log(`[Fake Cart Notification] \u2705 Message sent to Firebase: ${c}`);
    } catch (l) {
      console.error("[Fake Cart Notification] Firebase error:", l);
    }
    return e.json({ success: true, data: { message: c, note: "Fake notification sent to chat" } });
  } catch (a) {
    return console.error("[Fake Cart Notification] Error:", a), e.json({ success: false, error: a.message }, 500);
  }
});
f.post("/api/payment/stripe/create-intent", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = await e.req.json(), { amount: r, currency: a = "usd", metadata: n = {} } = s;
    if (console.log("[Stripe] Payment Intent \uC0DD\uC131 \uC694\uCCAD:", { amount: r, currency: a, metadata: n }), !r || r <= 0) return e.json({ success: false, error: "Invalid amount. Amount must be greater than 0." }, 400);
    const o = e.env.STRIPE_SECRET_KEY;
    if (!o) return console.error("[Stripe] \u274C STRIPE_SECRET_KEY \uD658\uACBD \uBCC0\uC218\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC74C"), e.json({ success: false, error: "Stripe is not configured. Please contact support." }, 500);
    const i = (await Promise.resolve().then(() => sh)).default, l = await new i(o, { apiVersion: "2024-11-20.acacia", httpClient: i.createFetchHttpClient() }).paymentIntents.create({ amount: Math.round(r), currency: a.toLowerCase(), automatic_payment_methods: { enabled: true }, metadata: { ...n, timestamp: (/* @__PURE__ */ new Date()).toISOString() } });
    return console.log("[Stripe] \u2705 Payment Intent \uC0DD\uC131 \uC644\uB8CC:", l.id), e.json({ success: true, clientSecret: l.client_secret, paymentIntentId: l.id });
  } catch (s) {
    return console.error("[Stripe] \u274C Payment Intent \uC0DD\uC131 \uC2E4\uD328:", s), e.json({ success: false, error: s.message || "Failed to create payment intent", details: s.type || "unknown_error" }, 500);
  }
});
f.post("/api/payments/confirm", async (e) => {
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
    const l = "Basic " + btoa(c + ":");
    console.log("[Payment] Authorization \uD5E4\uB354 \uC0DD\uC131 \uC644\uB8CC");
    const u = { orderId: n, amount: Number(o), paymentKey: a };
    console.log("[Payment] \uC694\uCCAD \uBCF8\uBB38:", JSON.stringify(u, null, 2)), console.log("[Payment] \u{1F4CA} amount \uD0C0\uC785:", typeof u.amount), console.log("[Payment] \u{1F4CA} amount \uAC12:", u.amount);
    const d = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: l, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(u) }), m = await d.json();
    if (console.log("[Payment] \u{1F4E1} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uC751\uB2F5:"), console.log("  - HTTP \uC0C1\uD0DC:", d.status), console.log("  - \uC751\uB2F5 OK?:", d.ok), console.log("  - \uC751\uB2F5 \uB370\uC774\uD130 (\uC77C\uBD80):", JSON.stringify(m).substring(0, 300)), !d.ok) return console.error("[Payment] \u274C\u274C\u274C \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC2B9\uC778 \uC2E4\uD328!"), console.error("[Payment] HTTP \uC0C1\uD0DC:", d.status), console.error("[Payment] \uC5D0\uB7EC \uCF54\uB4DC:", m.code), console.error("[Payment] \uC5D0\uB7EC \uBA54\uC2DC\uC9C0:", m.message), console.error("[Payment] \uC804\uCCB4 \uC751\uB2F5:", JSON.stringify(m, null, 2)), e.json({ success: false, error: m.message || "\uACB0\uC81C \uC2B9\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", code: m.code, tossError: m }, d.status);
    console.log("[Payment] \u2705 \uACB0\uC81C \uC2B9\uC778 \uC131\uACF5! paymentKey:", a), console.log("[Payment] \u2705 \uC8FC\uBB38 \uBC88\uD638:", n);
    try {
      await t.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            reservation_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a, n).run(), console.log("[Payment] \u2705 \uC8FC\uBB38 \uC0C1\uD0DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC");
      const _ = await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();
      if (_.results.length > 0) {
        console.log(`[Stock] \u{1F512} \uC7AC\uACE0 \uD655\uC815 \uC2DC\uC791: ${_.results.length}\uAC1C \uC0C1\uD488`);
        const h = _.results.map((b) => t.prepare(`
            UPDATE products 
            SET stock = stock - ?,
                reserved_stock = reserved_stock - ?
            WHERE id = ?
          `).bind(b.quantity, b.quantity, b.product_id)), E = await t.batch(h);
        let v = 0;
        for (let b = 0; b < E.length; b++) if (E[b].meta.changes > 0) {
          v++;
          const y = _.results[b];
          console.log(`[Stock] \u2705 \uC7AC\uACE0 \uD655\uC815: product_id=${y.product_id}, quantity=${y.quantity}`);
        } else {
          const y = _.results[b];
          console.error(`[Stock] \u26A0\uFE0F \uC7AC\uACE0 \uD655\uC815 \uC2E4\uD328: product_id=${y.product_id}`);
        }
        console.log(`[Stock] \u2705 \uC7AC\uACE0 \uD655\uC815 \uC644\uB8CC: ${v}/${_.results.length}\uAC1C \uC131\uACF5`);
        try {
          const b = _.results.map((g) => g.product_id), y = b.map(() => "?").join(","), S = await t.prepare(`
            SELECT id, name, stock, reserved_stock, stock_alert_threshold, seller_id 
            FROM products 
            WHERE id IN (${y})
          `).bind(...b).all();
          for (const g of S.results) {
            const x = g.stock_alert_threshold || 10, k = g.stock || 0, P = g.reserved_stock || 0, q = k - P;
            q <= x && g.seller_id && (await Jo(t, g.seller_id, g.name, q, x), console.log(`[Low Stock Alert] \u{1F4E2} ${g.name}: \uAC00\uC6A9\uC7AC\uACE0 ${q}\uAC1C (\uC784\uACC4\uAC12 ${x}\uAC1C)`));
          }
        } catch (b) {
          console.error("[Low Stock Alert] \u26A0\uFE0F \uC54C\uB9BC \uC804\uC1A1 \uC2E4\uD328:", b);
        }
      }
      try {
        const h = i.id, E = await Gc(e.env, h);
        E.success ? console.log(`[Payment] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5 (\uC8FC\uBB38 ${h})`) : console.warn(`[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328 (\uC8FC\uBB38 ${h}):`, E.reason || E.error);
      } catch (h) {
        console.error("[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC911 \uC624\uB958:", h);
      }
    } catch (_) {
      console.error("[Payment] \u26A0\uFE0F DB \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 (\uACB0\uC81C\uB294 \uC131\uACF5):", _);
    }
    if (e.env.DISCORD_WEBHOOK_URL) try {
      await El(e.env.DISCORD_WEBHOOK_URL, "\uACB0\uC81C \uC131\uACF5", `\uC8FC\uBB38\uBC88\uD638 ${n} \uACB0\uC81C \uC644\uB8CC`, { \uC8FC\uBB38\uBC88\uD638: n, \uACB0\uC81C\uAE08\uC561: `\u20A9${Number(o).toLocaleString()}`, \uACB0\uC81C\uD0A4: a.substring(0, 20) + "...", \uC0AC\uC6A9\uC790ID: i.user_id });
    } catch (_) {
      console.error("[Discord] \uACB0\uC81C \uC131\uACF5 \uC54C\uB9BC \uC2E4\uD328:", _);
    }
    return e.json({ success: true, data: m });
  } catch (a) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328:", { orderId: s == null ? void 0 : s.orderId, error: a.message, stack: (r = a.stack) == null ? void 0 : r.substring(0, 500) }), e.json({ success: false, error: "\uACB0\uC81C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uACE0\uAC1D\uC13C\uD130\uB85C \uBB38\uC758\uD574\uC8FC\uC138\uC694.", details: a.message }, 500);
  }
});
f.post("/api/payments/rollback", async (e) => {
  var s;
  const { DB: t } = e.env;
  try {
    const { orderId: r, reason: a } = await e.req.json();
    if (console.log("========================================"), console.log("[Rollback] \u{1F504} \uC7AC\uACE0 \uC608\uC57D \uD574\uC81C \uC2DC\uC791"), console.log("========================================"), console.log("[Rollback] \uC8FC\uBB38 \uBC88\uD638:", r), console.log("[Rollback] \uC0AC\uC720:", a || "\uACB0\uC81C \uC2E4\uD328"), !r) return e.json({ success: false, error: "\uC8FC\uBB38 \uBC88\uD638\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
    const n = await t.prepare("SELECT id, order_number, status FROM orders WHERE order_number = ?").bind(r).first();
    if (!n) return console.warn("[Rollback] \u26A0\uFE0F \uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C:", r), e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (n.status === "paid") return console.warn("[Rollback] \u26A0\uFE0F \uC774\uBBF8 \uACB0\uC81C \uC644\uB8CC\uB41C \uC8FC\uBB38:", r), e.json({ success: false, error: "\uC774\uBBF8 \uACB0\uC81C\uAC00 \uC644\uB8CC\uB41C \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400);
    console.log("[Rollback] \u2705 \uC8FC\uBB38 \uD655\uC778\uB428:", n.order_number);
    const o = await t.prepare(`
      SELECT product_id, quantity 
      FROM order_items 
      WHERE order_id = ?
    `).bind(n.id).all();
    if (o.results.length === 0) return console.warn("[Rollback] \u26A0\uFE0F \uC8FC\uBB38 \uC544\uC774\uD15C \uC5C6\uC74C"), e.json({ success: false, error: "\uC8FC\uBB38 \uC544\uC774\uD15C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    console.log(`[Rollback] \u{1F4E6} ${o.results.length}\uAC1C \uC0C1\uD488 \uC608\uC57D \uD574\uC81C \uC2DC\uC791...`);
    const i = o.results.map((u) => t.prepare(`
        UPDATE products 
        SET reserved_stock = CASE 
          WHEN reserved_stock >= ? THEN reserved_stock - ?
          ELSE 0
        END
        WHERE id = ?
      `).bind(u.quantity, u.quantity, u.product_id)), c = await t.batch(i);
    let l = 0;
    for (let u = 0; u < c.length; u++) if (c[u].meta.changes > 0) {
      l++;
      const d = o.results[u];
      console.log(`[Rollback] \u2705 \uC608\uC57D \uD574\uC81C: product_id=${d.product_id}, quantity=${d.quantity}`);
    }
    return console.log(`[Rollback] \u2705 \uC608\uC57D \uD574\uC81C \uC644\uB8CC: ${l}/${o.results.length}\uAC1C \uC131\uACF5`), await t.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'failed',
          reservation_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r).run(), console.log("[Rollback] \u2705 \uC8FC\uBB38 \uCDE8\uC18C \uC644\uB8CC:", r), e.json({ success: true, message: "\uC7AC\uACE0 \uC608\uC57D\uC774 \uD574\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", data: { orderId: r, releasedItems: l } });
  } catch (r) {
    return console.error("[Rollback] \u274C \uC608\uC57D \uD574\uC81C \uC2E4\uD328:", { error: r.message, stack: (s = r.stack) == null ? void 0 : s.substring(0, 500) }), e.json({ success: false, error: "\uC7AC\uACE0 \uC608\uC57D \uD574\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", details: r.message }, 500);
  }
});
f.post("/api/chat/:liveStreamId/messages", w(), async (e) => {
  const { DB: t } = e.env, s = e.req.param("liveStreamId");
  try {
    const r = await e.req.json(), { userId: a, userName: n, userAvatar: o, message: i, isSeller: c, isAdmin: l } = r;
    if (!i || i.trim().length === 0) return e.json({ success: false, error: "Message cannot be empty" }, 400);
    if (i.length > 500) return e.json({ success: false, error: "Message is too long (max 500 characters)" }, 400);
    if (a && await t.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(s, a).first()) return e.json({ success: false, error: "You are banned from this chat" }, 403);
    const u = ["\uC528\uBC1C", "\uAC1C\uC0C8\uB07C", "\uBCD1\uC2E0", "\uC886", "\uC2DC\uBC1C"];
    let d = i;
    u.forEach((_) => {
      const h = new RegExp(_, "gi");
      d = d.replace(h, "*".repeat(_.length));
    });
    const m = await t.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(s, a || null, n, o || null, d, c ? 1 : 0, l ? 1 : 0).run();
    return e.json({ success: true, data: { id: m.meta.last_row_id, message: d } });
  } catch (r) {
    return console.error("Error sending chat message:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/chat/:liveStreamId/messages", w(), async (e) => {
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
f.delete("/api/chat/:liveStreamId/messages/:messageId", w(), async (e) => {
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
f.post("/api/chat/:liveStreamId/ban", w(), async (e) => {
  const { DB: t } = e.env, s = e.req.param("liveStreamId");
  try {
    const r = await e.req.json(), { userId: a, bannedBy: n, reason: o, duration: i } = r;
    if (!a || !n) return e.json({ success: false, error: "userId and bannedBy are required" }, 400);
    let c = null;
    if (i) {
      const l = /* @__PURE__ */ new Date();
      l.setMinutes(l.getMinutes() + i), c = l.toISOString();
    }
    return await t.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(s, a, n, o || null, c).run(), e.json({ success: true, message: "User banned successfully" });
  } catch (r) {
    return console.error("Error banning user:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.delete("/api/chat/:liveStreamId/ban/:userId", w(), async (e) => {
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
async function Bu(e, t, s) {
  try {
    const r = new TextEncoder(), a = r.encode(s), n = r.encode(e), o = await crypto.subtle.importKey("raw", a, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), i = await crypto.subtle.sign("HMAC", o, n), c = Array.from(new Uint8Array(i)), l = btoa(String.fromCharCode(...c));
    return t === l;
  } catch (r) {
    return console.error("[Webhook] \uC11C\uBA85 \uAC80\uC99D \uC624\uB958:", r), false;
  }
}
__name(Bu, "Bu");
f.post("/api/payments/webhook", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.header("toss-signature"), r = await e.req.text();
    if (s && e.env.TOSS_SECRET_KEY) {
      if (!await Bu(r, s, e.env.TOSS_SECRET_KEY)) return console.error("[Webhook] \u274C \uC11C\uBA85 \uAC80\uC99D \uC2E4\uD328 - \uC704\uC870\uB41C \uC6F9\uD6C5 \uC694\uCCAD"), e.json({ success: false, error: "Invalid signature" }, 401);
      console.log("[Webhook] \u2705 \uC11C\uBA85 \uAC80\uC99D \uC131\uACF5");
    } else console.warn("[Webhook] \u26A0\uFE0F \uC11C\uBA85 \uAC80\uC99D \uAC74\uB108\uB700 (\uAC1C\uBC1C \uD658\uACBD \uB610\uB294 \uC11C\uBA85 \uC5C6\uC74C)");
    const a = JSON.parse(r);
    switch (console.log("[Webhook] \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC6F9\uD6C5 \uC218\uC2E0:", { eventType: a.eventType, orderId: a.orderId, status: a.status, timestamp: (/* @__PURE__ */ new Date()).toISOString() }), a.eventType) {
      case "PAYMENT_STATUS_CHANGED":
        await Ku(t, a);
        break;
      case "VIRTUAL_ACCOUNT_ISSUED":
        await Gu(t, a);
        break;
      default:
        console.log("[Webhook] \uCC98\uB9AC\uD558\uC9C0 \uC54A\uB294 \uC774\uBCA4\uD2B8 \uD0C0\uC785:", a.eventType);
    }
    return e.json({ success: true });
  } catch (s) {
    return console.error("[Webhook] \u274C \uC6F9\uD6C5 \uCC98\uB9AC \uC2E4\uD328:", s.message), e.json({ success: false, error: s.message }, 500);
  }
});
async function Ku(e, t) {
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
__name(Ku, "Ku");
async function Gu(e, t) {
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
__name(Gu, "Gu");
f.post("/api/payments/:paymentKey/cancel", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("paymentKey"), r = await e.req.json(), { cancelReason: a, cancelAmount: n } = r;
    if (console.log("[Payment] \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD:", { paymentKey: s, cancelReason: a, cancelAmount: n }), !a) return e.json({ success: false, error: "\uCDE8\uC18C \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await t.prepare(`
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
    `).bind(s).first();
    if (!o) return e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (o.status === "CANCELED" || o.status === "cancelled") return e.json({ success: false, error: "\uC774\uBBF8 \uCDE8\uC18C\uB41C \uACB0\uC81C\uC785\uB2C8\uB2E4." }, 400);
    const i = o.pg_provider || "tosspayments", c = e.env.TOSS_SECRET_KEY;
    if (!c) return e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    const l = Cu(i, c), u = n && n < o.amount, d = n || o.amount;
    console.log("[Payment] PG \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD \uC911...", { pgProvider: i, paymentKey: s, cancelAmount: d, isPartial: u });
    const m = await l.cancelPayment({ paymentKey: s, cancelReason: a, cancelAmount: d });
    return m.success ? (console.log("[Payment] \u2705 PG \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC:", { paymentKey: s, cancelAmount: d, canceledAt: m.canceledAt }), await t.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED", m.canceledAt || (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(m), s).run(), await t.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(), console.log(`[Payment] \u2705 \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC [${i}]: ${s}`), e.json({ success: true, data: { paymentKey: s, orderId: o.order_id, cancelAmount: d, canceledAt: m.canceledAt, status: "CANCELED" } })) : (console.error(`[Payment] \u274C ${i} \uACB0\uC81C \uCDE8\uC18C \uC2E4\uD328:`, m.error), e.json({ success: false, error: m.error || "\uACB0\uC81C \uCDE8\uC18C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." }, 400));
  } catch (s) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC2E4\uD328:", s.message), e.json({ success: false, error: "\uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
f.get("/api/payments/:paymentKey", async (e) => {
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
f.get("/api/payments/order/:orderId", async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("orderId"), r = await t.prepare(`
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
    `).bind(s).all();
    return e.json({ success: true, data: r.results || [] });
  } catch (s) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", s.message), e.json({ success: false, error: "\uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
f.get("/api/seller/orders", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.query("status"), a = e.req.query("start_date"), n = e.req.query("end_date"), o = e.req.query("min_amount"), i = e.req.query("max_amount"), c = parseInt(e.req.query("page") || "1"), l = parseInt(e.req.query("limit") || "50"), u = (c - 1) * l, d = ["oi.seller_id = ?"], m = [s.sellerId];
    r && (d.push("o.status = ?"), m.push(r)), a && (d.push("DATE(o.created_at) >= ?"), m.push(a)), n && (d.push("DATE(o.created_at) <= ?"), m.push(n)), o && (d.push("o.total_amount >= ?"), m.push(parseInt(o))), i && (d.push("o.total_amount <= ?"), m.push(parseInt(i)));
    const _ = d.join(" AND "), h = await t.prepare(`
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
    `).bind(...m, l, u).all(), E = await t.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${_}
    `).bind(...m).first(), v = (E == null ? void 0 : E.total) || 0, b = Math.ceil(v / l), y = /* @__PURE__ */ new Map();
    for (const g of h.results) {
      const x = g.id;
      y.has(x) || y.set(x, { id: g.id, user_id: g.user_id, user_name: g.user_name, order_number: g.order_number, status: g.status, total_amount: g.total_amount, shipping_fee: g.shipping_fee, payment_method: g.payment_method, payment_key: g.payment_key, shipping_address: g.shipping_address, shipping_name: g.shipping_name, shipping_phone: g.shipping_phone, delivery_request: g.delivery_request, created_at: g.created_at, updated_at: g.updated_at, items: [] }), g.item_id && y.get(x).items.push({ id: g.item_id, product_id: g.product_id, option_id: g.option_id, quantity: g.quantity, price: g.item_price, seller_id: g.seller_id, product_name: g.product_name, image_url: g.image_url, option_value: g.option_value });
    }
    const S = Array.from(y.values());
    return e.json({ success: true, data: S, pagination: { page: c, limit: l, total: v, totalPages: b }, filters: { status: r || null, startDate: a || null, endDate: n || null, minAmount: o ? parseInt(o) : null, maxAmount: i ? parseInt(i) : null } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/orders/export", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
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
    const i = [s.sellerId];
    a && (o += " AND date(o.created_at) >= ?", i.push(a)), n && (o += " AND date(o.created_at) <= ?", i.push(n)), o += " GROUP BY o.id ORDER BY o.created_at DESC";
    const c = await t.prepare(o).bind(...i).all();
    if (r === "csv") {
      const l = ["\uC8FC\uBB38\uBC88\uD638", "\uC8FC\uBB38\uC77C\uC2DC", "\uC8FC\uBB38\uC0C1\uD0DC", "\uACB0\uC81C\uC0C1\uD0DC", "\uC8FC\uBB38\uAE08\uC561", "\uBC30\uC1A1\uC9C0", "\uC218\uB839\uC778", "\uC5F0\uB77D\uCC98", "\uD0DD\uBC30\uC0AC", "\uC6B4\uC1A1\uC7A5\uBC88\uD638", "\uAD6C\uB9E4\uC790\uBA85", "\uAD6C\uB9E4\uC790\uC774\uBA54\uC77C", "\uAD6C\uB9E4\uC790\uC5F0\uB77D\uCC98"], u = c.results.map((E) => [E.order_number || "", E.created_at ? new Date(E.created_at).toLocaleString("ko-KR") : "", E.status || "", E.payment_status || "", E.total_amount || 0, E.shipping_address || "", E.shipping_name || "", E.shipping_phone || "", E.carrier || "", E.tracking_number || "", E.buyer_name || "", E.buyer_email || "", E.buyer_phone || ""]), m = "\uFEFF" + [l.join(","), ...u.map((E) => E.map((v) => {
        const b = String(v);
        return b.includes(",") || b.includes(`
`) || b.includes('"') ? `"${b.replace(/"/g, '""')}"` : b;
      }).join(","))].join(`
`), _ = /* @__PURE__ */ new Date(), h = `orders_${_.toISOString().split("T")[0]}_${_.getTime()}.csv`;
      return new Response(m, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${encodeURIComponent(h)}"`, "Cache-Control": "no-cache" } });
    } else return e.json({ success: false, error: "Unsupported format" }, 400);
  } catch (r) {
    return console.error("Export error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.patch("/api/seller/orders/:orderNumber/status", async (e) => {
  const { DB: t } = e.env, s = await D(e);
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
        const l = await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(s.sellerId).first();
        if (!l) console.warn(`[AUTO TAX INVOICE] \uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4 \uBBF8\uC2B9\uC778: seller_id=${s.sellerId}`), await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.', CURRENT_TIMESTAMP)
            `).bind(r, s.sellerId).run();
        else {
          console.log(`[AUTO TAX INVOICE] \uBC1C\uD589 \uC2DC\uC791: orderNumber=${r}`);
          const u = await t.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(), d = Number(c.total_amount), m = Math.floor(d / 1.1), _ = d - m, h = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), E = Math.random().toString(36).substring(2, 8).toUpperCase(), v = `${h}-${E}`, y = (await t.prepare(`
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
            `).bind(s.sellerId, r, v, l.business_number, l.business_name, l.ceo_name, l.address || "", l.business_type || "", l.business_category || "", l.email || "", l.phone || "", c.buyer_business_number, c.buyer_business_name, c.buyer_ceo_name || "", c.buyer_business_address || "", c.buyer_business_type || "", c.buyer_business_category || "", c.buyer_email || "", c.buyer_phone || "", m, _, d, `AUTO-${Date.now()}-${E}`).run()).meta.last_row_id;
          if (u.results.length > 0) {
            const S = u.results.map((g) => {
              const x = Math.floor(Number(g.price) * Number(g.quantity) / 1.1), k = Number(g.price) * Number(g.quantity) - x;
              return t.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(y, g.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", g.quantity, g.price, x, k, g.option_name || "");
            });
            await t.batch(S);
          }
          await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r, s.sellerId, y).run(), console.log(`[AUTO TAX INVOICE] \u2705 \uBC1C\uD589 \uC644\uB8CC: invoice_id=${y}, invoice_number=${v}`);
        }
      } else console.log(`[AUTO TAX INVOICE] \uC77C\uBC18 \uAD6C\uB9E4 (\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uC5C6\uC74C): ${r}`);
    } catch (c) {
      console.error("[AUTO TAX INVOICE] \uBC1C\uD589 \uC2E4\uD328:", c);
      try {
        await t.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(r, s.sellerId, c.message).run();
      } catch (l) {
        console.error("[AUTO TAX INVOICE] \uB85C\uADF8 \uAE30\uB85D \uC2E4\uD328:", l);
      }
    }
    try {
      const c = await t.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(r).first();
      if (c && c.user_id) {
        const u = { PREPARING: "preparing", SHIPPING: "shipping", DELIVERED: "delivered" }[a];
        u && await Vo(t, c.user_id, r, u);
      }
    } catch (c) {
      console.error("[Order Status] Notification error:", c);
    }
    return e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.put("/api/seller/orders/:orderNumber/tracking", async (e) => {
  const { DB: t } = e.env, s = await D(e);
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
      c && c.user_id && await Vo(t, c.user_id, r, "shipping", a, n);
    } catch (c) {
      console.error("[Tracking] Notification error:", c);
    }
    return e.json({ success: true, message: "Tracking information updated" });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/admin/orders", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.get("/api/sellers", async (e) => {
  const { DB: t } = e.env, { limit: s = "20", offset: r = "0" } = e.req.query();
  try {
    const a = `sellers:list:${s}:${r}`, n = De(a);
    if (n) return e.executionCtx.waitUntil((async () => {
      try {
        const i = await za(t, parseInt(s), parseInt(r));
        ae(a, i, 3600);
      } catch (i) {
        console.error("[Cache Revalidate] Sellers error:", i);
      }
    })()), e.json({ success: true, data: n, cached: true });
    const o = await za(t, parseInt(s), parseInt(r));
    return ae(a, o, 3600), e.json({ success: true, data: o, cached: false });
  } catch (a) {
    return console.error("[API] Sellers list error:", a), e.json({ success: false, error: `\uC140\uB7EC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${a.message}` }, 500);
  }
});
async function za(e, t, s) {
  const r = `
    SELECT id, business_name, name as display_name, 
           commission_rate, created_at
    FROM sellers 
    WHERE is_active = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, { results: a } = await e.prepare(r).bind(t, s).all();
  return a;
}
__name(za, "za");
f.get("/api/admin/sellers", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.post("/api/admin/sellers", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { username: r, password: a, name: n, email: o, phone: i, business_name: c, business_number: l } = await e.req.json();
    if (!r || !a || !n || !o || !c) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (await t.prepare("SELECT id FROM sellers WHERE username = ?").bind(r).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC544\uC774\uB514\uC785\uB2C8\uB2E4" }, 400);
    if (await t.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
    const m = `$2a$10$placeholder_hash_for_${a}`, _ = await t.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(r, m, n, o, i || null, c, l || null, s.adminId).run();
    return e.json({ success: true, data: { id: _.meta.last_row_id, username: r, name: n, email: o, business_name: c } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.put("/api/admin/sellers/:id", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { name: a, email: n, phone: o, business_name: i, business_number: c, is_active: l, status: u } = await e.req.json();
    return await t.prepare("SELECT id FROM sellers WHERE id = ?").bind(r).first() ? (await t.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i, c || null, l, u, r).run(), e.json({ success: true })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.delete("/api/admin/sellers/:id", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.post("/api/admin/sellers/:id/reset-password", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.patch("/api/admin/sellers/:id/commission", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.patch("/api/admin/sellers/:id/permissions", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { can_manipulate_stats: a } = await e.req.json();
    if (a !== 0 && a !== 1) return e.json({ success: false, error: "\uAD8C\uD55C \uAC12\uC740 0 \uB610\uB294 1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const n = await t.prepare("SELECT id, username, name FROM sellers WHERE id = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    await t.prepare(`
      UPDATE sellers 
      SET can_manipulate_stats = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, r).run();
    const o = a ? "\uC2B9\uC778" : "\uD574\uC81C";
    return console.log(`\uC2DC\uCCAD\uC790 \uC218 \uC870\uC791 \uAD8C\uD55C ${o}: \uD310\uB9E4\uC790 ${n.username} (ID: ${r})`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.username || n.name}'\uC758 \uD2B9\uC218 \uAD8C\uD55C\uC774 ${o}\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: n.username, can_manipulate_stats: a } });
  } catch (r) {
    return console.error("\uAD8C\uD55C \uBCC0\uACBD \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.patch("/api/admin/sellers/:id/approve", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), a = await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();
    if (!a) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (a.status === "approved") return e.json({ success: false, error: "\uC774\uBBF8 \uC2B9\uC778\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400);
    if (await t.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(s.adminId, r).run(), console.log(`\uC140\uB7EC \uC2B9\uC778: ${a.username} (ID: ${r}) by Admin ID: ${s.adminId}`), a.email) try {
      const { sendEmail: n, getSellerApprovalEmailHTML: o } = await Promise.resolve().then(() => Ei), i = e.env.RESEND_API_KEY || "", c = o(a.name, a.username), l = await n({ to: a.email, subject: "\u{1F389} \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790 \uC2B9\uC778 \uC644\uB8CC", html: c }, i, e.env.EMAIL_FROM || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <noreply@ur-team.com>");
      l.success ? console.log(`[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC131\uACF5: ${a.email}`) : console.warn(`[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC2E4\uD328: ${l.error}`);
    } catch (n) {
      console.error("[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC624\uB958:", n);
    }
    try {
      const { createNotification: n, NotificationTemplates: o } = await Promise.resolve().then(() => gi), i = o.seller_approved(a.name);
      await n(t, { userId: parseInt(r), type: "seller_approved", title: i.title, message: i.message, linkUrl: i.linkUrl });
    } catch (n) {
      console.error("[\uC140\uB7EC \uC2B9\uC778] \uC54C\uB9BC \uC0DD\uC131 \uC624\uB958:", n);
    }
    return e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.name}'\uB2D8\uC774 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: a.username, seller_name: a.name, status: "approved", approved_at: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (r) {
    return console.error("\uC140\uB7EC \uC2B9\uC778 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.patch("/api/admin/sellers/:id/reject", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { reason: a } = await e.req.json();
    if (!a) return e.json({ success: false, error: "\uAC70\uBD80 \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    if (n.status === "rejected") return e.json({ success: false, error: "\uC774\uBBF8 \uAC70\uBD80\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400);
    if (await t.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, s.adminId, r).run(), console.log(`\uC140\uB7EC \uAC70\uBD80: ${n.username} (ID: ${r}), \uC0AC\uC720: ${a}`), n.email) try {
      const { sendEmail: o, getSellerRejectionEmailHTML: i } = await Promise.resolve().then(() => Ei), c = e.env.RESEND_API_KEY || "", l = i(n.name, a), u = await o({ to: n.email, subject: "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790 \uC2B9\uC778 \uACB0\uACFC \uC548\uB0B4", html: l }, c, e.env.EMAIL_FROM || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <noreply@ur-team.com>");
      u.success ? console.log(`[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC131\uACF5: ${n.email}`) : console.warn(`[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC2E4\uD328: ${u.error}`);
    } catch (o) {
      console.error("[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC624\uB958:", o);
    }
    try {
      const { createNotification: o, NotificationTemplates: i } = await Promise.resolve().then(() => gi), c = i.seller_rejected(a);
      await o(t, { userId: parseInt(r), type: "seller_rejected", title: c.title, message: c.message, linkUrl: c.linkUrl });
    } catch (o) {
      console.error("[\uC140\uB7EC \uAC70\uBD80] \uC54C\uB9BC \uC0DD\uC131 \uC624\uB958:", o);
    }
    return e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.name}'\uB2D8\uC758 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: r, seller_username: n.username, seller_name: n.name, status: "rejected", rejection_reason: a, rejected_at: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (r) {
    return console.error("\uC140\uB7EC \uAC70\uBD80 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/admin/sellers/pending", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.get("/api/admin/dashboard/stats", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = /* @__PURE__ */ new Date();
    r.setHours(0, 0, 0, 0);
    const a = r.toISOString(), n = await t.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM orders
      WHERE payment_status = 'approved'
      AND status = 'paid'
      AND created_at >= ?
    `).bind(a).first(), o = (n == null ? void 0 : n.sales) || 0, i = await t.prepare(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(a).first(), c = (i == null ? void 0 : i.count) || 0, l = new Date(Date.now() - 300 * 1e3).toISOString(), u = await t.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(l).first(), d = (u == null ? void 0 : u.count) || 0, m = await t.prepare(`
      SELECT COUNT(*) as count
      FROM live_streams
      WHERE status = 'live'
    `).first(), _ = (m == null ? void 0 : m.count) || 0;
    return e.json({ success: true, stats: { todaySales: o, todayOrders: c, currentVisitors: d, liveStreams: _ }, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/public/seller/:sellerId", async (e) => {
  const { DB: t, CACHE_KV: s } = e.env;
  try {
    const r = e.req.param("sellerId"), a = `public:seller:${r}`, n = await Mu(s, a);
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
    `).bind(r).all(), l = await t.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(r).all(), u = await t.prepare(`
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
    return await gs(s, a, d, 60, false), e.json({ success: true, data: d });
  } catch (r) {
    return console.error("\uC140\uB7EC \uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/public/seller/username/:username", async (e) => {
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
f.get("/api/admin/settlement/stats", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.get("/api/admin/settlement/records", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
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
    const l = o.length > 0 ? `WHERE ${o.join(" AND ")}` : "", u = await t.prepare(`
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
f.patch("/api/admin/settlement/:orderId/status", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.post("/api/admin/settlement/batch-complete", async (e) => {
  const { DB: t } = e.env, s = await W(e);
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
f.get("/api/admin/settlement/export-csv", async (e) => {
  const { DB: t } = e.env, s = await W(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { seller_id: r, period: a } = e.req.query();
    let n = ["payment_status = 'completed'", "is_cancelled = 0"];
    const o = [];
    r && (n.push("o.seller_id = ?"), o.push(r));
    const i = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const h = i.toISOString().split("T")[0];
        n.push(`DATE(o.created_at) = '${h}'`);
        break;
      case "week":
        const E = new Date(i.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${E}'`);
        break;
      case "month":
        const v = new Date(i.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${v}'`);
        break;
    }
    const c = n.length > 0 ? `WHERE ${n.join(" AND ")}` : "", u = (await t.prepare(`
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
    u.forEach((h) => {
      const E = d.map((v) => {
        const b = h[v];
        if (b == null) return "";
        const y = String(b);
        return y.includes(",") || y.includes('"') || y.includes(`
`) ? `"${y.replace(/"/g, '""')}"` : y;
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
f.post("/api/orders/create", N, async (e) => {
  const { DB: t } = e.env;
  try {
    const { userId: s, cartItems: r, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i, buyerBusinessNumber: c, buyerBusinessName: l, buyerCeoName: u } = await e.req.json();
    console.log("[DEPRECATED /api/orders/create] \uC8FC\uBB38 \uC0DD\uC131 \uC694\uCCAD:", { userId: s, cartItems: r == null ? void 0 : r.length, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i });
    let d = 10;
    if (o) {
      const I = await t.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();
      I && I.commission_rate !== null && (d = I.commission_rate);
    }
    console.log("\uC218\uC218\uB8CC\uC728:", { sellerId: o, commissionRate: d });
    const m = Math.floor(a * (d / 100)), _ = a - m;
    let h = null;
    if (n) {
      const I = await t.prepare(`
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
      `).bind(n, s).first();
      if (!I) return e.json({ success: false, error: "\uBC30\uC1A1\uC9C0 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
      h = I;
    }
    if (!s) return e.json({ success: false, error: "User ID is required. Please login with Kakao first." }, 401);
    const E = s, v = /* @__PURE__ */ new Date(), b = v.getFullYear().toString().slice(-2), y = (v.getMonth() + 1).toString().padStart(2, "0"), S = v.getDate().toString().padStart(2, "0"), g = `${b}${y}${S}`, x = Math.random().toString(36).substring(2, 7).toUpperCase(), k = `ORD-${g}-${x}`, P = r.map((I) => I.product_id), q = P.map(() => "?").join(","), B = await t.prepare(`
      SELECT id, stock FROM products WHERE id IN (${q})
    `).bind(...P).all(), R = new Map(B.results.map((I) => [I.id, I.stock]));
    for (const I of r) {
      const ne = R.get(I.product_id);
      if (ne === void 0) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${I.product_id})` }, 400);
      if (ne < I.quantity) return e.json({ success: false, error: `\uC7AC\uACE0\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4 (\uC0C1\uD488 ID: ${I.product_id})` }, 400);
    }
    const F = (await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(k, E, a, "pending", o || null, d, m, _, n || null, (h == null ? void 0 : h.recipient_name) || null, (h == null ? void 0 : h.phone) || null, h != null && h.address ? `${h.address} ${h.address_detail}` : null, (h == null ? void 0 : h.postal_code) || null, i ? 1 : 0, c || null, l || null, u || null).run()).meta.last_row_id, J = r.map((I) => t.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(F, I.product_id, I.option_id || null, I.quantity, I.price_snapshot || I.price)), Q = r.map((I) => t.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(I.quantity, I.product_id));
    await t.batch([...J, ...Q]);
    try {
      const I = Mt(e.env), ne = r.map((V) => V.product_id), K = ne.map(() => "?").join(","), U = await t.prepare(`
        SELECT id, name, price, original_price, discount_rate, stock, image_url
        FROM products
        WHERE id IN (${K})
      `).bind(...ne).all();
      await Promise.all(U.results.map((V) => I.updateProductStock(V.id, V.stock, { name: V.name, price: V.price, original_price: V.original_price, discount_rate: V.discount_rate, image_url: V.image_url }))), console.log(`\u{1F525} Firebase: Stock updated for ${U.results.length} products`);
    } catch (I) {
      console.error("\u26A0\uFE0F Firebase stock sync failed (non-blocking):", I);
    }
    try {
      const I = r.map((U) => U.product_id), ne = I.map(() => "?").join(","), K = await t.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${ne})
      `).bind(...I).all();
      for (const U of K.results) {
        const V = U.stock_alert_threshold || 5, be = U.stock;
        be <= V && U.seller_id && (await Jo(t, U.seller_id, U.name, be, V), console.log(`[Low Stock Alert] ${U.name}: ${be} <= ${V}`));
      }
    } catch (I) {
      console.error("[Low Stock Alert] Error:", I);
    }
    return console.log("\uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC:", { orderId: F, orderNumber: k }), e.json({ success: true, orderId: F, orderNumber: k, totalAmount: a });
  } catch (s) {
    return console.error("\uC8FC\uBB38 \uC0DD\uC131 \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.post("/api/orders/:orderNumber/refund", w(), N, async (e) => {
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
    if (n.results.length > 0) {
      const o = n.results.map((i) => t.prepare(`
          UPDATE products 
          SET stock = stock + ?,
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(i.quantity, i.product_id));
      await t.batch(o), console.log("[Order Refund] \uC7AC\uACE0 \uBCF5\uAD6C \uC644\uB8CC:", { items: n.results.length });
    }
    return console.log("[Order Refund] \u2705 \uD658\uBD88 \uC644\uB8CC:", { orderNumber: s, reason: r }), e.json({ success: true, message: "\uC8FC\uBB38\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: { orderNumber: s, cancelDate: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (s) {
    return console.error("[Order Refund] Error:", s), e.json({ success: false, error: s.message || "\uC8FC\uBB38 \uCDE8\uC18C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
f.use("/api/seller/*", N);
f.get("/api/seller/sales", w(), async (e) => {
  try {
    const { DB: t } = e.env, s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const r = await Ut(e.env.SESSION_KV, s);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (r.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = r.seller_id || r.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], l = await t.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(a).first();
    if (!l) return e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const u = await t.prepare(`
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
    `).bind(a, i, c).first(), d = await t.prepare(`
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
  } catch (t) {
    return console.error("Seller sales query error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.get("/api/seller/settlement-csv", w(), async (e) => {
  try {
    const { DB: t } = e.env, s = e.req.header("X-Session-Token");
    if (!s) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const r = await Ut(e.env.SESSION_KV, s);
    if (!r) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (r.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = r.seller_id || r.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], l = await t.prepare(`
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
      const m = d.status === "delivered" ? "\uBC30\uC1A1\uC644\uB8CC" : d.status === "shipped" ? "\uBC30\uC1A1\uC911" : d.status === "preparing" ? "\uC0C1\uD488\uC900\uBE44\uC911" : d.status === "paid" ? "\uACB0\uC81C\uC644\uB8CC" : "\uB300\uAE30\uC911", _ = d.buyer_business_name || "-", h = d.buyer_business_number || "-", E = d.invoice_number || "-", v = d.issue_date || "-", b = d.tax_invoice_status === "issued" ? "\uBC1C\uD589\uC644\uB8CC" : d.tax_invoice_status === "cancelled" ? "\uCDE8\uC18C" : "-", y = d.nts_confirm_number || "-";
      u += `${d.order_number},${d.created_at},${d.user_name || "\uC775\uBA85"},${d.total_amount},${d.commission_amount},${d.seller_amount},${m},${_},${h},${E},${v},${b},${y}
`;
    }
    return new Response(u, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${i}_${c}.csv"` } });
  } catch (t) {
    return console.error("CSV download error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.post("/api/seller/tax-invoices/issue", async (e) => {
  const { DB: t } = e.env, s = await D(e);
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
    `).bind(a.id).all(), i = Number(a.total_amount), c = Math.floor(i / 1.1), l = i - c, u = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], d = `${u}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, m = Sc(n, a, o.results);
    let _, h, E;
    try {
      _ = await vc(m), h = _.ntsConfirmNumber, E = _.invoiceKey, console.log("\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC131\uACF5:", { ntsConfirmNumber: h, invoiceKey: E, mockMode: ds() });
    } catch (y) {
      console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", y), h = "FAILED", E = null;
    }
    const b = (await t.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s.sellerId, r, "tax", d, u, n.business_number, n.business_name, n.ceo_name, n.address, n.business_type, n.business_category, a.buyer_business_number, a.buyer_business_name, a.buyer_ceo_name, c, l, i, h === "FAILED" ? "failed" : "issued", ds() ? "mock" : "barobill", E, h).run()).meta.last_row_id;
    for (const y of o.results) {
      const S = Math.floor(Number(y.price) * Number(y.quantity) / 1.1), g = Number(y.price) * Number(y.quantity) - S;
      await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(b, y.id, y.product_name, y.quantity, y.price, S, g).run();
    }
    return e.json({ success: true, data: { invoice_id: b, invoice_number: d, issue_date: u, total_amount: i, supply_price: c, tax_amount: l, status: h === "FAILED" ? "failed" : "issued", nts_confirm_number: h, api_invoice_key: E, mock_mode: ds(), message: h === "FAILED" ? "\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328. \uB098\uC911\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694." : ds() ? "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (Mock Mode - \uC2E4\uC81C \uBC1C\uD589 \uC544\uB2D8)" : "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4." } });
  } catch (r) {
    return console.error("\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC624\uB958:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/tax-invoices", async (e) => {
  var r;
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const { start_date: a, end_date: n, status: o } = e.req.query();
    let i = `
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;
    const c = [s.sellerId];
    a && (i += " AND issue_date >= ?", c.push(a)), n && (i += " AND issue_date <= ?", c.push(n)), o && (i += " AND status = ?", c.push(o)), i += " ORDER BY created_at DESC";
    const l = await t.prepare(i).bind(...c).all();
    return e.json({ success: true, data: l.results || [], total: ((r = l.results) == null ? void 0 : r.length) || 0 });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
f.get("/api/seller/tax-invoices/:id", async (e) => {
  const { DB: t } = e.env, s = await D(e);
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
f.post("/api/seller/tax-invoices/:id/cancel", async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const r = e.req.param("id"), { reason: a } = await e.req.json(), n = await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r, s.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const o = new Date(n.issue_date), i = new Date(o);
    if (i.setDate(i.getDate() + 1), /* @__PURE__ */ new Date() > i) return e.json({ success: false, error: "\uBC1C\uD589\uC77C \uC775\uC77C\uAE4C\uC9C0\uB9CC \uCDE8\uC18C \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 400);
    try {
      if (n.api_invoice_key && !ds()) {
        const l = await t.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(s.sellerId).first();
        l && l.business_number && await Tc(l.business_number, n.api_invoice_key, a || "\uD310\uB9E4\uC790 \uC694\uCCAD");
      }
    } catch (l) {
      console.error("\uBC14\uB85C\uBE4C \uCDE8\uC18C API \uD638\uCD9C \uC2E4\uD328:", l);
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
f.get("/api/seller/tax-invoices/auto-issue-logs", async (e) => {
  const { DB: t } = e.env, s = await D(e);
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
f.post("/api/seller/tax-invoices/retry/:orderNumber", async (e) => {
  const { DB: t } = e.env, s = await D(e);
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
    `).bind(o.id).all(), l = Number(o.total_amount), u = Math.floor(l / 1.1), d = l - u, m = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), _ = Math.random().toString(36).substring(2, 8).toUpperCase(), h = `${m}-${_}`, v = (await t.prepare(`
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
    `).bind(s.sellerId, r, h, i.business_number, i.business_name, i.ceo_name, i.address || "", i.business_type || "", i.business_category || "", i.email || "", i.phone || "", o.buyer_business_number, o.buyer_business_name, o.buyer_ceo_name || "", o.buyer_business_address || "", o.buyer_business_type || "", o.buyer_business_category || "", o.buyer_email || "", o.buyer_phone || "", u, d, l, `RETRY-${Date.now()}-${_}`).run()).meta.last_row_id;
    for (const b of c.results) {
      const y = Math.floor(Number(b.price) * Number(b.quantity) / 1.1), S = Number(b.price) * Number(b.quantity) - y;
      await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(v, b.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", b.quantity, b.price, y, S, b.option_name || "").run();
    }
    return await t.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(r, s.sellerId, v, n + 1).run(), await t.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n + 1, a.id).run(), console.log(`[TAX INVOICE RETRY] \u2705 \uC7AC\uC2DC\uB3C4 \uC131\uACF5: invoice_id=${v}, retry_count=${n + 1}`), e.json({ success: true, data: { invoice_id: v, invoice_number: h, retry_count: n + 1 } });
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
f.get("/live/:id", async (e) => {
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
f.get("/cart", async (e) => {
  try {
    const t = new URL("/static/cart.html", e.req.url);
    let r = await (await fetch(t.toString())).text();
    return r = r.replace("%%NICEPAY_CLIENT_ID%%", e.env.NICEPAY_CLIENT_ID || "S2_d5ec29558e9d46419bf01eb828ca0834"), r = r.replace("%%NICEPAY_MID%%", e.env.NICEPAY_MID || "nictest00m"), new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving cart page:", t), new Response("<h1>Error loading cart page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
f.get("/my-orders", async (e) => {
  try {
    const t = new URL("/static/my-orders.html", e.req.url), r = await (await fetch(t.toString())).text();
    return new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving my orders page:", t), new Response("<h1>Error loading orders page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
f.get("/payment-result", async (e) => {
  try {
    const t = new URL("/payment-result.html", e.req.url), r = await (await fetch(t.toString())).text();
    return new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving payment result page:", t), new Response("<h1>Error loading payment result page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
f.get("/api/seller/profile", async (e) => {
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
f.patch("/api/seller/profile", async (e) => {
  const { DB: t } = e.env, s = e.req.header("X-Session-Token");
  if (!s) return e.json({ success: false, error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const r = await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(s).first();
    if (!r || !r.seller_id) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const { profile_image: a, bio: n, sns_instagram: o, sns_youtube: i, sns_facebook: c, sns_twitter: l, website_url: u, kakao_chat_link: d } = await e.req.json(), m = [], _ = [];
    if (a !== void 0 && (m.push("profile_image = ?"), _.push(a)), n !== void 0 && (m.push("bio = ?"), _.push(n)), o !== void 0 && (m.push("sns_instagram = ?"), _.push(o)), i !== void 0 && (m.push("sns_youtube = ?"), _.push(i)), c !== void 0 && (m.push("sns_facebook = ?"), _.push(c)), l !== void 0 && (m.push("sns_twitter = ?"), _.push(l)), u !== void 0 && (m.push("website_url = ?"), _.push(u)), d !== void 0 && (m.push("kakao_chat_link = ?"), _.push(d)), m.length === 0) return e.json({ success: false, error: "\uC218\uC815\uD560 \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    m.push("updated_at = datetime('now')"), _.push(r.seller_id), await t.prepare(`
      UPDATE sellers 
      SET ${m.join(", ")}
      WHERE id = ?
    `).bind(..._).run();
    const h = await t.prepare(`
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
    return e.json({ success: true, message: "\uD504\uB85C\uD544\uC774 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: h });
  } catch (r) {
    return console.error("\uD504\uB85C\uD544 \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/public/:sellerId", async (e) => {
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
f.get("/api/seller/:sellerId/streams", async (e) => {
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
f.get("/api/seller/:sellerId/products-public", async (e) => {
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
f.get("/api/notifications", N, async (e) => {
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
f.get("/api/notifications/unread-count", N, async (e) => {
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
f.put("/api/notifications/:id/read", N, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), r = e.get("userId"), a = e.get("userType");
    return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s, r, a).first() ? (await t.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(s).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.put("/api/notifications/read-all", N, async (e) => {
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
f.delete("/api/notifications/:id", N, async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), r = e.get("userId"), a = e.get("userType");
    return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s, r, a).first() ? (await t.prepare("DELETE FROM notifications WHERE id = ?").bind(s).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/banners", async (e) => {
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
f.get("/api/admin/banners", N, async (e) => {
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
f.post("/api/admin/banners", N, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const { title: r, image_url: a, link_url: n, description: o, is_active: i, display_order: c, start_date: l, end_date: u } = await e.req.json();
    if (!r || !a) return e.json({ success: false, error: "\uC81C\uBAA9\uACFC \uC774\uBBF8\uC9C0\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const d = await t.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a, n || null, o || null, i !== false ? 1 : 0, c || 0, l || null, u || null).run();
    return e.json({ success: true, id: d.meta.last_row_id });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.put("/api/admin/banners/:id", N, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const r = e.req.param("id"), { title: a, image_url: n, link_url: o, description: i, is_active: c, display_order: l, start_date: u, end_date: d } = await e.req.json();
    return await t.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a, n, o || null, i || null, c ? 1 : 0, l || 0, u || null, d || null, r).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.delete("/api/admin/banners/:id", N, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const r = e.req.param("id");
    return await t.prepare("DELETE FROM banners WHERE id = ?").bind(r).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/order-complete", (e) => e.redirect("/order-complete.html", 302));
f.notFound((e) => {
  const t = e.req.path;
  return t.startsWith("/api/") ? e.json({ success: false, error: "Not found", message: `The requested endpoint ${t} was not found.` }, 404) : new Response(null, { status: 404 });
});
f.onError((e, t) => {
  const s = t.req.path;
  if (e instanceof _l) return console.error("[AppError]", { path: s, method: t.req.method, code: e.code, message: e.message, statusCode: e.statusCode }), t.json({ success: false, error: { code: e.code, message: e.message, ...e.details && { details: e.details } } }, e.statusCode);
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
f.get("/api/admin/alimtalk/pricing", w(), async (e) => {
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
f.post("/api/admin/alimtalk/pricing", w(), async (e) => {
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
f.put("/api/admin/alimtalk/pricing/:id", w(), async (e) => {
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
f.delete("/api/admin/alimtalk/pricing/:id", w(), async (e) => {
  const { env: t } = e, s = e.req.param("id");
  try {
    return (await t.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(s).run()).meta.changes === 0 ? e.json({ success: false, error: "Pricing not found" }, 404) : e.json({ success: true, message: "Pricing deleted successfully" });
  } catch (r) {
    return console.error("[Admin Alimtalk Pricing Delete] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/admin/alimtalk/accounts", w(), async (e) => {
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
f.patch("/api/admin/alimtalk/accounts/:id/status", w(), async (e) => {
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
f.get("/api/admin/alimtalk/statistics", w(), async (e) => {
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
f.use("/api/seller/alimtalk/*", N);
f.get("/api/seller/alimtalk/account", w(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.get("user");
    if (!s || s.userType !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(s.userId).first();
    return e.json({ success: true, account: r });
  } catch (s) {
    return console.error("[Seller Alimtalk Account] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.post("/api/seller/alimtalk/register", w(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await ut(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { channel_id: a, phone_number: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = Eo(n), i = await Uc(t, { channelId: a, phoneNumber: o });
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
f.get("/api/seller/alimtalk/templates", w(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await ut(t, s);
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
f.post("/api/seller/alimtalk/templates", w(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await ut(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_code: a, template_name: n, template_content: o, template_type: i } = await e.req.json();
    if (!a || !n || !o) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (!(await qc(t, c.sender_key, { name: n, content: o, templateCode: a })).success) return e.json({ success: false, error: "Failed to register template" }, 500);
    const u = await t.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id, a, n, o, i || "basic").run();
    return e.json({ success: true, template_id: u.meta.last_row_id, message: "Template registered successfully. Approval pending (1-2 days)" });
  } catch (s) {
    return console.error("[Seller Alimtalk Template Register] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/seller/alimtalk/pricing", w(), async (e) => {
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
f.post("/api/seller/alimtalk/charge", w(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await ut(t, s);
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
    const c = a * i.unit_price, l = `alimtalk_${o.id}_${Date.now()}`, u = await t.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id, a, c, i.unit_price, l).run(), d = `https://api.tosspayments.com/v1/payment/${l}`;
    return e.json({ success: true, charge_id: u.meta.last_row_id, order_id: l, amount: a, price: c, unit_price: i.unit_price, payment_url: d });
  } catch (s) {
    return console.error("[Seller Alimtalk Charge] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.post("/api/seller/alimtalk/charge/complete", w(), async (e) => {
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
f.post("/api/seller/alimtalk/send", w(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await ut(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_id: a, recipient_phone: n, variables: o, order_id: i } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (c.balance < 1) return e.json({ success: false, error: "Insufficient balance. Please charge first." }, 400);
    const l = await t.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a, c.id).first();
    if (!l) return e.json({ success: false, error: "Template not found or not approved" }, 404);
    const u = Hc(l.template_content, o || {}), d = Eo(n), m = await ca(t, { senderKey: c.sender_key, templateCode: l.template_code, to: d, message: u });
    if (!m.success) return await t.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id, a, i || null, d, u, m.error).run(), e.json({ success: false, error: m.error }, 500);
    const _ = await t.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id, a, i || null, d, u, 15, m.messageId).run();
    return await t.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(), e.json({ success: true, message_id: _.meta.last_row_id, aligo_message_id: m.messageId, status: "sent", remaining_balance: c.balance - 1 });
  } catch (s) {
    return console.error("[Seller Alimtalk Send] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/seller/alimtalk/messages", w(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await ut(t, s);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { page: a = "1", limit: n = "20", status: o } = e.req.query(), i = await t.DB.prepare(`
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
    const d = await t.DB.prepare(l).bind(...u).all(), m = await t.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();
    return e.json({ success: true, messages: d.results, pagination: { total: m.total, page: parseInt(a), limit: parseInt(n) } });
  } catch (s) {
    return console.error("[Seller Alimtalk Messages] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.get("/api/seller/alimtalk/statistics", w(), async (e) => {
  const { env: t } = e;
  try {
    const s = e.req.header("X-Session-Token"), r = await ut(t, s);
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
    `).bind(o.id, a || "2000-01-01", n || "2100-01-01").all(), l = i.total_sent > 0 ? (i.total_success / i.total_sent * 100).toFixed(2) : 0;
    return e.json({ success: true, statistics: { total_sent: i.total_sent, total_success: i.total_success, total_failed: i.total_failed, success_rate: l, total_cost: i.total_cost, by_template: c.results } });
  } catch (s) {
    return console.error("[Seller Alimtalk Statistics] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.post("/api/seller/alimtalk/send", w(), async (e) => {
  try {
    const t = e.req.header("X-Seller-ID");
    if (!t) return e.json({ success: false, error: "Unauthorized" }, 401);
    const s = await e.req.json(), { templateId: r, recipients: a, variables: n } = s;
    if (!r || !Array.isArray(a) || a.length === 0) return e.json({ success: false, error: "templateId and recipients are required" }, 400);
    const o = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(t)).first();
    if (!o) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    const i = await la(e.env, { accountId: o.id, templateId: parseInt(r), recipients: a.map((c) => ({ phone: c.phone, name: c.name, variables: c.variables || {} })), variables: n || {} });
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (t) {
    return console.error("[Alimtalk Send] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.post("/api/seller/alimtalk/send/order", w(), async (e) => {
  try {
    const t = e.req.header("X-Seller-ID");
    if (!t) return e.json({ success: false, error: "Unauthorized" }, 401);
    const s = await e.req.json(), { templateId: r, orderId: a, customMessage: n } = s;
    if (!r || !a) return e.json({ success: false, error: "templateId and orderId are required" }, 400);
    const o = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(t)).first();
    if (!o) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    if (!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a), parseInt(t)).first()) return e.json({ success: false, error: "Order not found or unauthorized" }, 404);
    const c = await Zc(e.env, o.id, parseInt(r), parseInt(a), n);
    return e.json({ success: c.success, data: { total: c.totalRecipients, sent: c.successCount, failed: c.failedCount, refunded: c.refundedAmount }, messages: c.messages });
  } catch (t) {
    return console.error("[Alimtalk Send Order] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.post("/api/seller/alimtalk/send/bulk", w(), async (e) => {
  try {
    const t = e.req.header("X-Seller-ID");
    if (!t) return e.json({ success: false, error: "Unauthorized" }, 401);
    const s = await e.req.json(), { templateId: r, rows: a, variables: n } = s;
    if (!r || !Array.isArray(a) || a.length === 0) return e.json({ success: false, error: "templateId and rows are required" }, 400);
    const o = await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(t)).first();
    if (!o) return e.json({ success: false, error: "No active alimtalk account found" }, 404);
    const i = await el(e.env, o.id, parseInt(r), a, n || {});
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (t) {
    return console.error("[Alimtalk Send Bulk] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.post("/api/seller/alimtalk/templates/:id/preview", w(), async (e) => {
  try {
    const t = e.req.header("X-Seller-ID");
    if (!t) return e.json({ success: false, error: "Unauthorized" }, 401);
    const s = e.req.param("id"), r = await e.req.json(), { variables: a } = r, n = await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(s), parseInt(t)).first();
    if (!n) return e.json({ success: false, error: "Template not found" }, 404);
    let o = n.template_content;
    return a && Object.entries(a).forEach(([i, c]) => {
      const l = new RegExp(`#{${i}}`, "g");
      o = o.replace(l, c);
    }), e.json({ success: true, data: { template_name: n.template_name, original: n.template_content, preview: o, required_variables: Array.from(n.template_content.matchAll(/#{(\w+)}/g), (i) => i[1]) } });
  } catch (t) {
    return console.error("[Alimtalk Preview] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.get("/api/admin/settlements", w(), async (e) => {
  try {
    const t = await e.env.DB.prepare(`
      SELECT * FROM settlements
      ORDER BY period_start DESC
      LIMIT 50
    `).all();
    return e.json({ success: true, data: t.results });
  } catch (t) {
    return console.error("[Admin Settlements] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.get("/api/admin/settlements/:id", w(), async (e) => {
  try {
    const t = parseInt(e.req.param("id")), s = await ol(e.env.DB, t);
    return s ? e.json({ success: true, data: s }) : e.json({ success: false, error: "Settlement not found" }, 404);
  } catch (t) {
    return console.error("[Admin Settlement Detail] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.post("/api/admin/settlements/generate", w(), async (e) => {
  try {
    const t = await e.req.json(), { startDate: s, endDate: r } = t, a = s && r ? { startDate: s, endDate: r } : sl(), n = await al(e.env.DB, a);
    return await nl(e.env.DB, n), e.json({ success: true, data: n });
  } catch (t) {
    return console.error("[Admin Generate Settlement] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.get("/api/seller/settlements", w(), async (e) => {
  try {
    const t = e.req.header("X-Seller-ID");
    if (!t) return e.json({ success: false, error: "Unauthorized" }, 401);
    const s = await e.env.DB.prepare(`
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
    `).bind(parseInt(t)).all();
    return e.json({ success: true, data: s.results });
  } catch (t) {
    return console.error("[Seller Settlements] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.get("/api/admin/settlements/calculate", w(), async (e) => {
  const { DB: t } = e.env;
  if (!(await W(e)).success) return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const r = e.req.query("seller_id"), a = e.req.query("period") || "monthly", n = e.req.query("format") || "json";
    let o = e.req.query("start_date"), i = e.req.query("end_date");
    if (!r) return e.json({ success: false, error: "seller_id\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    const c = /* @__PURE__ */ new Date();
    if (a === "weekly") {
      const y = new Date(c);
      y.setDate(c.getDate() - c.getDay() - 6), y.setHours(0, 0, 0, 0);
      const S = new Date(y);
      S.setDate(y.getDate() + 6), S.setHours(23, 59, 59, 999), o = y.toISOString().split("T")[0], i = S.toISOString().split("T")[0];
    } else if (a === "monthly") {
      const y = new Date(c.getFullYear(), c.getMonth() - 1, 1), S = new Date(c.getFullYear(), c.getMonth(), 0);
      o = y.toISOString().split("T")[0], i = S.toISOString().split("T")[0];
    } else if (a === "custom" && (!o || !i)) return e.json({ success: false, error: "custom \uAE30\uAC04 \uC120\uD0DD \uC2DC start_date\uC640 end_date\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    const l = await t.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(r).first();
    if (!l) return e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const d = (await t.prepare(`
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
    `).bind(r, o, i).all()).results, m = d.length, _ = d.reduce((y, S) => y + (S.total_amount || 0), 0), h = d.reduce((y, S) => y + (S.commission_amount || 0), 0), E = _ - h, v = m > 0 ? d.reduce((y, S) => y + (S.commission_rate || 0), 0) / m : 0, b = { sellerId: parseInt(r), sellerName: l.seller_name || "Unknown", businessName: l.business_name || null, period: { type: a, startDate: o, endDate: i }, summary: { totalOrders: m, totalSales: _, totalCommission: h, netAmount: E, commissionRate: Math.round(v * 100) / 100 }, orders: d.map((y) => ({ orderNumber: y.order_number, createdAt: y.created_at, status: y.status, totalAmount: y.total_amount || 0, commissionAmount: y.commission_amount || 0, sellerAmount: y.seller_amount || 0 })) };
    if (n === "csv") {
      const y = [];
      y.push("\uC140\uB7EC \uC815\uC0B0\uC11C"), y.push(`\uC140\uB7EC\uBA85,${b.sellerName}`), y.push(`\uC0AC\uC5C5\uC790\uBA85,${b.businessName || "N/A"}`), y.push(`\uC815\uC0B0 \uAE30\uAC04,${b.period.startDate} ~ ${b.period.endDate}`), y.push(""), y.push("\uAD6C\uBD84,\uAE08\uC561"), y.push(`\uCD1D \uC8FC\uBB38 \uAC74\uC218,${b.summary.totalOrders}\uAC74`), y.push(`\uCD1D \uB9E4\uCD9C,${b.summary.totalSales.toLocaleString()}\uC6D0`), y.push(`\uD50C\uB7AB\uD3FC \uC218\uC218\uB8CC (${b.summary.commissionRate}%),${b.summary.totalCommission.toLocaleString()}\uC6D0`), y.push(`\uC815\uC0B0 \uAE08\uC561,${b.summary.netAmount.toLocaleString()}\uC6D0`), y.push(""), y.push("\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC0C1\uD0DC,\uC8FC\uBB38\uAE08\uC561,\uD50C\uB7AB\uD3FC\uC218\uC218\uB8CC,\uC815\uC0B0\uAE08\uC561");
      for (const x of b.orders) y.push(`${x.orderNumber},${x.createdAt},${x.status},${x.totalAmount},${x.commissionAmount},${x.sellerAmount}`);
      const S = y.join(`
`), g = `settlement_${r}_${o}_${i}.csv`;
      return e.text(S, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${g}"` });
    }
    return e.json({ success: true, data: b });
  } catch (r) {
    return console.error("[Settlement] Calculation error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/seller/settlements/my", w(), async (e) => {
  const { DB: t } = e.env, s = await D(e);
  if (!s.success) return e.json({ success: false, error: "\uC140\uB7EC \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  const r = new URL(e.req.url);
  r.searchParams.set("seller_id", String(s.sellerId));
  const a = new Request(r.toString(), e.req.raw);
  ({ ...e, req: new Proxy(a, { get(n, o) {
    return o === "query" ? (i) => i === "seller_id" ? String(s.sellerId) : r.searchParams.get(i) : n[o];
  } }) });
  try {
    const n = s.sellerId, o = e.req.query("period") || "monthly", i = e.req.query("format") || "json";
    let c = e.req.query("start_date"), l = e.req.query("end_date");
    const u = /* @__PURE__ */ new Date();
    if (o === "weekly") {
      const g = new Date(u);
      g.setDate(u.getDate() - u.getDay() - 6), g.setHours(0, 0, 0, 0);
      const x = new Date(g);
      x.setDate(g.getDate() + 6), x.setHours(23, 59, 59, 999), c = g.toISOString().split("T")[0], l = x.toISOString().split("T")[0];
    } else if (o === "monthly") {
      const g = new Date(u.getFullYear(), u.getMonth() - 1, 1), x = new Date(u.getFullYear(), u.getMonth(), 0);
      c = g.toISOString().split("T")[0], l = x.toISOString().split("T")[0];
    } else if (o === "custom" && (!c || !l)) return e.json({ success: false, error: "custom \uAE30\uAC04 \uC120\uD0DD \uC2DC start_date\uC640 end_date\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    const d = await t.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(n).first();
    if (!d) return e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const _ = (await t.prepare(`
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
    `).bind(n, c, l).all()).results, h = _.length, E = _.reduce((g, x) => g + (x.total_amount || 0), 0), v = _.reduce((g, x) => g + (x.commission_amount || 0), 0), b = E - v, y = h > 0 ? _.reduce((g, x) => g + (x.commission_rate || 0), 0) / h : 0, S = { sellerId: n, sellerName: d.seller_name || "Unknown", businessName: d.business_name || null, period: { type: o, startDate: c, endDate: l }, summary: { totalOrders: h, totalSales: E, totalCommission: v, netAmount: b, commissionRate: Math.round(y * 100) / 100 }, orders: _.map((g) => ({ orderNumber: g.order_number, createdAt: g.created_at, status: g.status, totalAmount: g.total_amount || 0, commissionAmount: g.commission_amount || 0, sellerAmount: g.seller_amount || 0 })) };
    if (i === "csv") {
      const g = [];
      g.push("\uC140\uB7EC \uC815\uC0B0\uC11C"), g.push(`\uC140\uB7EC\uBA85,${S.sellerName}`), g.push(`\uC0AC\uC5C5\uC790\uBA85,${S.businessName || "N/A"}`), g.push(`\uC815\uC0B0 \uAE30\uAC04,${S.period.startDate} ~ ${S.period.endDate}`), g.push(""), g.push("\uAD6C\uBD84,\uAE08\uC561"), g.push(`\uCD1D \uC8FC\uBB38 \uAC74\uC218,${S.summary.totalOrders}\uAC74`), g.push(`\uCD1D \uB9E4\uCD9C,${S.summary.totalSales.toLocaleString()}\uC6D0`), g.push(`\uD50C\uB7AB\uD3FC \uC218\uC218\uB8CC (${S.summary.commissionRate}%),${S.summary.totalCommission.toLocaleString()}\uC6D0`), g.push(`\uC815\uC0B0 \uAE08\uC561,${S.summary.netAmount.toLocaleString()}\uC6D0`), g.push(""), g.push("\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC0C1\uD0DC,\uC8FC\uBB38\uAE08\uC561,\uD50C\uB7AB\uD3FC\uC218\uC218\uB8CC,\uC815\uC0B0\uAE08\uC561");
      for (const P of S.orders) g.push(`${P.orderNumber},${P.createdAt},${P.status},${P.totalAmount},${P.commissionAmount},${P.sellerAmount}`);
      const x = g.join(`
`), k = `my_settlement_${c}_${l}.csv`;
      return e.text(x, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${k}"` });
    }
    return e.json({ success: true, data: S });
  } catch (n) {
    return console.error("[My Settlement] Error:", n), e.json({ success: false, error: n.message }, 500);
  }
});
f.get("/api/seller/settlements", w(), async (e) => {
  try {
    const t = e.req.header("X-Seller-ID");
    if (!t) return e.json({ success: false, error: "Unauthorized" }, 401);
    const s = await e.env.DB.prepare(`
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
    `).bind(parseInt(t)).all();
    return e.json({ success: true, data: s.results });
  } catch (t) {
    return console.error("[Seller Settlements] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.get("/api/live/:streamId/sse", async (e) => {
  const t = e.req.param("streamId");
  return il(t, e.env);
});
f.get("/api/live/:streamId/chat/sse", async (e) => {
  const t = e.req.param("streamId");
  return cl(t, e.env);
});
f.get("/api/seller/orders/sse", async (e) => {
  const t = e.req.header("X-Seller-ID");
  return t ? ll(t, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
f.get("/api/seller/stock/sse", async (e) => {
  const t = e.req.header("X-Seller-ID");
  return t ? ul(t, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
f.post("/api/push/subscribe", w(), async (e) => {
  try {
    const t = e.req.header("X-User-ID"), s = e.req.header("X-User-Type");
    if (!t || !s) return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await e.req.json();
    return await dl(e.env.DB, parseInt(t), s, r), e.json({ success: true });
  } catch (t) {
    return console.error("[Push Subscribe] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.post("/api/push/unsubscribe", w(), async (e) => {
  try {
    const { endpoint: t } = await e.req.json();
    return t ? (await pl(e.env.DB, t), e.json({ success: true })) : e.json({ success: false, error: "Endpoint required" }, 400);
  } catch (t) {
    return console.error("[Push Unsubscribe] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.get("/api/push/vapid-public-key", w(), async (e) => {
  try {
    const t = e.env.VAPID_PUBLIC_KEY || "";
    return e.json({ success: true, publicKey: t });
  } catch (t) {
    return console.error("[Push VAPID Key] Error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
f.get("/api/cache/stats", async (e) => {
  const t = e.req.query("token"), s = e.env.STATS_SECRET_TOKEN || "your-secret-token-here";
  if (t !== s) return e.json({ success: false, error: "\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC62C\uBC14\uB978 token\uC744 \uC81C\uACF5\uD574\uC8FC\uC138\uC694." }, 403);
  const r = te.hits + te.misses > 0 ? (te.hits / (te.hits + te.misses) * 100).toFixed(2) : "0.00";
  return e.json({ success: true, data: { cache: { ...te, hitRate: `${r}%`, cacheSize: xe.size, maxSize: 1e3, memoryUsage: `${(xe.size / 1e3 * 100).toFixed(1)}%` }, description: { hits: "Memory cache\uB85C \uCC98\uB9AC\uB41C \uC694\uCCAD (KV \uC77D\uAE30 0\uD68C)", misses: "Memory cache \uBBF8\uC2A4\uB85C KV \uC870\uD68C\uD55C \uC694\uCCAD", writes: "Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", evictions: "Memory cache\uC5D0\uC11C \uC0AD\uC81C\uB41C \uD56D\uBAA9 \uC218 (\uB9CC\uB8CC \uB610\uB294 \uD06C\uAE30 \uC81C\uD55C)", hitRate: "Cache hit \uBE44\uC728 (\uB192\uC744\uC218\uB85D KV \uC0AC\uC6A9\uB7C9 \uAC10\uC18C)", cacheSize: "\uD604\uC7AC Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", maxSize: "Memory cache \uCD5C\uB300 \uD06C\uAE30", memoryUsage: "Memory cache \uC0AC\uC6A9\uB960 (cacheSize / maxSize)" }, kvUsageGuide: { currentHitRate: `${r}%`, recommendation: parseFloat(r) >= 90 ? "\u2705 \uCE90\uC2DC\uAC00 \uB9E4\uC6B0 \uD6A8\uACFC\uC801\uC73C\uB85C \uC791\uB3D9\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : parseFloat(r) >= 70 ? "\u26A0\uFE0F \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB0AE\uC2B5\uB2C8\uB2E4. TTL \uC870\uC815\uC744 \uACE0\uB824\uD558\uC138\uC694." : "\u274C \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB9E4\uC6B0 \uB0AE\uC2B5\uB2C8\uB2E4. \uCE90\uC2DC \uC124\uC815\uC744 \uD655\uC778\uD558\uC138\uC694.", kvDailyReadsLimit: "100,000 reads/day (free tier)", kvDailyWritesLimit: "1,000 writes/day (free tier)", estimatedDailyReads: Math.round(te.misses / (te.hits + te.misses || 1) * 1e4), estimatedDailyWrites: Math.round(te.writes / (te.hits + te.misses || 1) * 1e3) } } });
});
var Xa = {};
var Qa = {};
f.get("/api/debug/kv-usage", w(), async (e) => {
  try {
    const t = Object.entries(Xa).sort((i, c) => c[1] - i[1]).slice(0, 20), s = Object.entries(Qa).sort((i, c) => c[1] - i[1]).slice(0, 20), r = Object.values(Xa).reduce((i, c) => i + c, 0), a = Object.values(Qa).reduce((i, c) => i + c, 0), n = r / 1e3 * 100, o = a / 1e5 * 100;
    if ((n >= 50 || o >= 50) && e.env.DISCORD_WEBHOOK_URL) try {
      await gl(e.env.DISCORD_WEBHOOK_URL, o, n);
    } catch (i) {
      console.error("[Discord] KV \uACBD\uACE0 \uC804\uC1A1 \uC2E4\uD328:", i);
    }
    return e.json({ success: true, stats: { total_writes: r, total_reads: a, daily_write_limit: 1e3, daily_read_limit: 1e5, write_usage_percent: n.toFixed(2) + "%", read_usage_percent: o.toFixed(2) + "%", top_writes: t, top_reads: s }, recommendations: r > 500 ? ["\u26A0\uFE0F KV Write \uC0AC\uC6A9\uB7C9\uC774 \uB192\uC2B5\uB2C8\uB2E4!", "1. \uC138\uC158 \uAC31\uC2E0 \uC8FC\uAE30\uB97C \uB298\uB9AC\uC138\uC694 (\uD604\uC7AC 29\uC77C)", "2. \uCE90\uC2DC\uB97C \uBA54\uBAA8\uB9AC\uC5D0\uB9CC \uC800\uC7A5\uD558\uC138\uC694 (forceKvWrite: false)", "3. JWT \uC778\uC99D\uC73C\uB85C \uC804\uD658\uD558\uC138\uC694 (KV \uC0AC\uC6A9\uB7C9 90% \uAC10\uC18C)"] : ["\u2705 KV \uC0AC\uC6A9\uB7C9\uC774 \uC815\uC0C1 \uBC94\uC704\uC785\uB2C8\uB2E4."] });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
f.get("/api/debug/user/:email", w(), async (e) => {
  const { DB: t } = e.env, s = e.req.param("email");
  try {
    const r = await t.prepare(`
      SELECT id, firebase_uid, email, name, created_at 
      FROM users 
      WHERE email = ?
    `).bind(s).first();
    return r ? e.json({ success: true, user: { id: r.id, firebase_uid: r.firebase_uid, email: r.email, name: r.name, created_at: r.created_at } }) : e.json({ success: false, error: "User not found" }, 404);
  } catch (r) {
    return console.error("[Debug] Error fetching user:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.post("/api/debug/user/:email/firebase-uid", w(), async (e) => {
  const { DB: t } = e.env, s = e.req.param("email");
  try {
    const { firebase_uid: r } = await e.req.json();
    if (!r) return e.json({ success: false, error: "firebase_uid is required" }, 400);
    const a = await t.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(s).first();
    return a ? (await t.prepare(`
      UPDATE users SET firebase_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?
    `).bind(r, s).run(), console.log(`[Debug] Updated Firebase UID for ${s}: ${r}`), e.json({ success: true, message: "Firebase UID updated successfully", user: { id: a.id, email: s, firebase_uid: r } })) : e.json({ success: false, error: "User not found" }, 404);
  } catch (r) {
    return console.error("[Debug] Error updating Firebase UID:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.get("/api/notifications", w(), async (e) => {
  var s;
  const { DB: t } = e.env;
  try {
    const r = e.req.query("userId"), a = parseInt(e.req.query("limit") || "20"), n = parseInt(e.req.query("offset") || "0");
    if (!r) return e.json({ success: false, error: "userId is required" }, 400);
    const o = await t.prepare(`
      SELECT id, type, title, message, link_url, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(r, a, n).all(), i = await t.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).bind(r).first();
    return e.json({ success: true, data: { notifications: o.results || [], unread_count: (i == null ? void 0 : i.count) || 0, total: ((s = o.results) == null ? void 0 : s.length) || 0 } });
  } catch (r) {
    return console.error("[Notifications] Get error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
f.patch("/api/notifications/:id/read", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), { userId: r } = await e.req.json();
    return r ? (await t.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).bind(s, r).run()).meta.changes === 0 ? e.json({ success: false, error: "Notification not found" }, 404) : e.json({ success: true, message: "Notification marked as read" }) : e.json({ success: false, error: "userId is required" }, 400);
  } catch (s) {
    return console.error("[Notifications] Mark read error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.patch("/api/notifications/read-all", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { userId: s } = await e.req.json();
    return s ? (await t.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `).bind(s).run(), e.json({ success: true, message: "All notifications marked as read" })) : e.json({ success: false, error: "userId is required" }, 400);
  } catch (s) {
    return console.error("[Notifications] Mark all read error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
f.delete("/api/notifications/:id", w(), async (e) => {
  const { DB: t } = e.env;
  try {
    const s = e.req.param("id"), r = e.req.query("userId");
    return r ? (await t.prepare(`
      DELETE FROM notifications
      WHERE id = ? AND user_id = ?
    `).bind(s, r).run()).meta.changes === 0 ? e.json({ success: false, error: "Notification not found" }, 404) : e.json({ success: true, message: "Notification deleted" }) : e.json({ success: false, error: "userId is required" }, 400);
  } catch (s) {
    return console.error("[Notifications] Delete error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
async function Vu(e, t, s) {
  var a, n;
  const r = { embeds: [{ title: "\u{1F6A8} \uC11C\uBC84 \uC5D0\uB7EC \uBC1C\uC0DD", color: 16711680, fields: [{ name: "\uC5D0\uB7EC \uBA54\uC2DC\uC9C0", value: t.message || "Unknown error", inline: false }, { name: "\uBC1C\uC0DD \uC2DC\uAC01", value: (/* @__PURE__ */ new Date()).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }), inline: true }, { name: "HTTP \uBA54\uC18C\uB4DC", value: s.method || "N/A", inline: true }, { name: "API \uACBD\uB85C", value: s.path || "N/A", inline: false }, { name: "\uC0AC\uC6A9\uC790 ID", value: ((a = s.userId) == null ? void 0 : a.toString()) || "\uBE44\uB85C\uADF8\uC778", inline: true }, { name: "\uC0AC\uC6A9\uC790 \uD0C0\uC785", value: s.userType || "N/A", inline: true }, { name: "\uC5D0\uB7EC \uC2A4\uD0DD", value: "```\n" + (((n = t.stack) == null ? void 0 : n.substring(0, 800)) || "N/A") + "\n```", inline: false }], timestamp: (/* @__PURE__ */ new Date()).toISOString(), footer: { text: "UR LIVE Error Monitoring" } }] };
  try {
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) }), console.log("[Discord] Error alert sent successfully");
  } catch (o) {
    console.error("[Discord Webhook] Failed to send alert:", o);
  }
}
__name(Vu, "Vu");
f.get("*", dc({ root: "./" }));
f.get("*", async (e) => {
  const t = e.req.path;
  return t.startsWith("/api/") || t.startsWith("/auth/") || t.startsWith("/static/") ? e.notFound() : (console.log(`[SPA Fallback] Serving index.html for: ${t}`), e.html(await e.env.ASSETS.fetch(new Request("https://dummy.com/index.html")).then((s) => s.text())));
});
f.onError(async (e, t) => {
  if (console.error("[Error]", e), t.env.DISCORD_WEBHOOK_URL) try {
    await Vu(t.env.DISCORD_WEBHOOK_URL, e, { method: t.req.method, path: t.req.path, userId: t.get("userId"), userType: t.get("userType") });
  } catch (s) {
    console.error("[Discord] Webhook failed, but continuing:", s);
  }
  return t.json({ success: false, error: { code: e.code || "INTERNAL_ERROR", message: e.message || "\uC11C\uBC84 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." } }, e.status || 500);
});
var Za = new po();
var Ju = Object.assign({ "/src/index.tsx": f });
var Qo = false;
for (const [, e] of Object.entries(Ju)) e && (Za.route("/", e), Za.notFound(e.notFoundHandler), Qo = true);
if (!Qo) throw new Error("Can't import modules from ['/src/index.tsx']");
async function Zo(e) {
  try {
    const { to: t, subject: s, htmlContent: r, textContent: a } = e, n = await fetch("https://api.mailchannels.net/tx/v1/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: t }] }], from: { email: "noreply@live.ur-team.com", name: "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158" }, subject: s, content: [{ type: "text/html", value: r }, ...a ? [{ type: "text/plain", value: a }] : []] }) });
    if (!n.ok) {
      const o = await n.text();
      return console.error("[Email] Failed to send:", n.status, o), { success: false, error: `Email send failed: ${n.status}` };
    }
    return console.log("[Email] Successfully sent to:", t), { success: true };
  } catch (t) {
    return console.error("[Email] Exception:", t), { success: false, error: t.message };
  }
}
__name(Zo, "Zo");
async function Yu(e) {
  const { streamId: t, title: s, sellerName: r, platform: a, scheduledAt: n, status: o } = e, i = `https://live.ur-team.com/live/${t}`, c = o === "live" ? "\u{1F534} \uB77C\uC774\uBE0C \uC911" : o === "scheduled" ? "\u{1F4C5} \uC608\uC57D\uB428" : "\u23F8\uFE0F \uB300\uAE30 \uC911", l = `
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
  `, u = `
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
  return Zo({ to: "jiwon@ur-team.com", subject: `[\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158] \u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131: ${s}`, htmlContent: l, textContent: u });
}
__name(Yu, "Yu");
var zu = Object.freeze(Object.defineProperty({ __proto__: null, sendEmail: Zo, sendLiveStreamCreatedEmail: Yu }, Symbol.toStringTag, { value: "Module" }));
var Ea = ["apiKey", "idempotencyKey", "stripeAccount", "apiVersion", "maxNetworkRetries", "timeout", "host", "authenticator", "stripeContext", "additionalHeaders", "streaming"];
function ei(e) {
  return e && typeof e == "object" && Ea.some((t) => Object.prototype.hasOwnProperty.call(e, t));
}
__name(ei, "ei");
function Tr(e, t) {
  return Qu(e);
}
__name(Tr, "Tr");
function en(e) {
  return encodeURIComponent(e).replace(/!/g, "%21").replace(/\*/g, "%2A").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/'/g, "%27").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
__name(en, "en");
function Xu(e) {
  return e instanceof Date ? Math.floor(e.getTime() / 1e3).toString() : e === null ? "" : String(e);
}
__name(Xu, "Xu");
function Qu(e) {
  const t = [];
  function s(r, a) {
    if (a !== void 0) {
      if (a === null || typeof a != "object" || a instanceof Date) {
        t.push(en(r) + "=" + en(Xu(a)));
        return;
      }
      if (Array.isArray(a)) {
        for (let n = 0; n < a.length; n++) a[n] !== void 0 && s(r + "[" + n + "]", a[n]);
        return;
      }
      for (const n of Object.keys(a)) s(r + "[" + n + "]", a[n]);
    }
  }
  __name(s, "s");
  if (typeof e == "object" && e !== null) for (const r of Object.keys(e)) s(r, e[r]);
  return t.join("&");
}
__name(Qu, "Qu");
var ta = /* @__PURE__ */ (() => {
  const e = { "\n": "\\n", '"': '\\"', "\u2028": "\\u2028", "\u2029": "\\u2029" };
  return (t) => {
    const s = t.replace(/["\n\r\u2028\u2029]/g, (r) => e[r]);
    return (r) => s.replace(/\{([\s\S]+?)\}/g, (a, n) => {
      const o = r[n];
      return Zu(o) ? encodeURIComponent(o) : "";
    });
  };
})();
function Zu(e) {
  return ["number", "string", "boolean"].includes(typeof e);
}
__name(Zu, "Zu");
function ed(e) {
  const t = e.match(/\{\w+\}/g);
  return t ? t.map((s) => s.replace(/[{}]/g, "")) : [];
}
__name(ed, "ed");
function ga(e) {
  if (!Array.isArray(e) || !e[0] || typeof e[0] != "object") return {};
  if (!ei(e[0])) return e.shift();
  const t = Object.keys(e[0]), s = t.filter((r) => Ea.includes(r));
  return s.length > 0 && s.length !== t.length && mr(`Options found in arguments (${s.join(", ")}). Did you mean to pass an options object? See https://github.com/stripe/stripe-node/wiki/Passing-Options.`), {};
}
__name(ga, "ga");
function ti(e) {
  const t = { host: null, headers: {}, settings: {}, streaming: false };
  if (e.length > 0) {
    const s = e[e.length - 1];
    if (typeof s == "string") t.authenticator = sa(e.pop());
    else if (ei(s)) {
      const r = Object.assign({}, e.pop()), a = Object.keys(r).filter((n) => !Ea.includes(n));
      if (a.length && mr(`Invalid options found (${a.join(", ")}); ignoring.`), r.apiKey && (t.authenticator = sa(r.apiKey)), r.idempotencyKey && (t.headers["Idempotency-Key"] = r.idempotencyKey), r.stripeAccount && (t.headers["Stripe-Account"] = r.stripeAccount), r.stripeContext) {
        if (t.headers["Stripe-Account"]) throw new Error("Can't specify both stripeAccount and stripeContext.");
        t.headers["Stripe-Context"] = r.stripeContext;
      }
      if (r.apiVersion && (t.headers["Stripe-Version"] = r.apiVersion), Number.isInteger(r.maxNetworkRetries) && (t.settings.maxNetworkRetries = r.maxNetworkRetries), Number.isInteger(r.timeout) && (t.settings.timeout = r.timeout), r.host && (t.host = r.host), r.authenticator) {
        if (r.apiKey) throw new Error("Can't specify both apiKey and authenticator.");
        if (typeof r.authenticator != "function") throw new Error("The authenticator must be a function receiving a request as the first parameter.");
        t.authenticator = r.authenticator;
      }
      r.additionalHeaders && (t.headers = r.additionalHeaders), r.streaming && (t.streaming = true);
    }
  }
  return t;
}
__name(ti, "ti");
function td(e) {
  const t = this, s = Object.prototype.hasOwnProperty.call(e, "constructor") ? e.constructor : function(...r) {
    t.apply(this, r);
  };
  return Object.assign(s, t), s.prototype = Object.create(t.prototype), Object.assign(s.prototype, e), s;
}
__name(td, "td");
function Dr(e) {
  if (typeof e != "object") throw new Error("Argument must be an object");
  return Object.keys(e).reduce((t, s) => (e[s] != null && (t[s] = e[s]), t), {});
}
__name(Dr, "Dr");
function sd(e) {
  return e && typeof e == "object" ? Object.keys(e).reduce((t, s) => (t[rd(s)] = e[s], t), {}) : e;
}
__name(sd, "sd");
function rd(e) {
  return e.split("-").map((t) => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()).join("-");
}
__name(rd, "rd");
function ya(e, t) {
  return t ? e.then((s) => {
    setTimeout(() => {
      t(null, s);
    }, 0);
  }, (s) => {
    setTimeout(() => {
      t(s, null);
    }, 0);
  }) : e;
}
__name(ya, "ya");
function ad(e) {
  return e === "OAuth" ? "oauth" : e[0].toLowerCase() + e.substring(1);
}
__name(ad, "ad");
function mr(e) {
  return typeof process.emitWarning != "function" ? console.warn(`Stripe: ${e}`) : process.emitWarning(e, "Stripe");
}
__name(mr, "mr");
function nd(e) {
  const t = typeof e;
  return (t === "function" || t === "object") && !!e;
}
__name(nd, "nd");
function od(e) {
  const t = {}, s = /* @__PURE__ */ __name((r, a) => {
    Object.entries(r).forEach(([n, o]) => {
      const i = a ? `${a}[${n}]` : n;
      if (nd(o)) {
        if (!(o instanceof Uint8Array) && !Object.prototype.hasOwnProperty.call(o, "data")) return s(o, i);
        t[i] = o;
      } else t[i] = String(o);
    });
  }, "s");
  return s(e, null), t;
}
__name(od, "od");
function kr(e, t, s) {
  if (!Number.isInteger(t)) {
    if (s !== void 0) return s;
    throw new Error(`${e} must be an integer`);
  }
  return t;
}
__name(kr, "kr");
function id() {
  return typeof process > "u" ? {} : { lang_version: process.version, platform: process.platform };
}
__name(id, "id");
function sa(e) {
  const t = /* @__PURE__ */ __name((s) => (s.headers.Authorization = "Bearer " + e, Promise.resolve()), "t");
  return t._apiKey = e, t;
}
__name(sa, "sa");
function cd(e, t) {
  return this[e] instanceof Date ? Math.floor(this[e].getTime() / 1e3).toString() : t;
}
__name(cd, "cd");
function ld(e) {
  return JSON.stringify(e, cd);
}
__name(ld, "ld");
function si(e) {
  return e && e.startsWith("/v2") ? "v2" : "v1";
}
__name(si, "si");
function ra(e) {
  return Array.isArray(e) ? e.join(", ") : String(e);
}
__name(ra, "ra");
function ud(e) {
  const t = Array.isArray(e) ? e[0] : e;
  return Number(t);
}
__name(ud, "ud");
function dd(e) {
  return Object.entries(e).map(([t, s]) => [t, ra(s)]);
}
__name(dd, "dd");
var me = class _me {
  static {
    __name(this, "me");
  }
  getClientName() {
    throw new Error("getClientName not implemented.");
  }
  makeRequest(t, s, r, a, n, o, i, c) {
    throw new Error("makeRequest not implemented.");
  }
  static makeTimeoutError() {
    const t = new TypeError(_me.TIMEOUT_ERROR_CODE);
    return t.code = _me.TIMEOUT_ERROR_CODE, t;
  }
};
me.CONNECTION_CLOSED_ERROR_CODES = ["ECONNRESET", "EPIPE"];
me.TIMEOUT_ERROR_CODE = "ETIMEDOUT";
var ri = class {
  static {
    __name(this, "ri");
  }
  constructor(t, s) {
    this._statusCode = t, this._headers = s;
  }
  getStatusCode() {
    return this._statusCode;
  }
  getHeaders() {
    return this._headers;
  }
  getRawResponse() {
    throw new Error("getRawResponse not implemented.");
  }
  toStream(t) {
    throw new Error("toStream not implemented.");
  }
  toJSON() {
    throw new Error("toJSON not implemented.");
  }
};
var fr = class _fr extends me {
  static {
    __name(this, "fr");
  }
  constructor(t) {
    if (super(), !t) {
      if (!globalThis.fetch) throw new Error("fetch() function not provided and is not defined in the global scope. You must provide a fetch implementation.");
      t = globalThis.fetch;
    }
    globalThis.AbortController ? this._fetchFn = _fr.makeFetchWithAbortTimeout(t) : this._fetchFn = _fr.makeFetchWithRaceTimeout(t);
  }
  static makeFetchWithRaceTimeout(t) {
    return (s, r, a) => {
      let n;
      const o = new Promise((c, l) => {
        n = setTimeout(() => {
          n = null, l(me.makeTimeoutError());
        }, a);
      }), i = t(s, r);
      return Promise.race([i, o]).finally(() => {
        n && clearTimeout(n);
      });
    };
  }
  static makeFetchWithAbortTimeout(t) {
    return async (s, r, a) => {
      const n = new AbortController();
      let o = setTimeout(() => {
        o = null, n.abort(me.makeTimeoutError());
      }, a);
      try {
        return await t(s, Object.assign(Object.assign({}, r), { signal: n.signal }));
      } catch (i) {
        throw i.name === "AbortError" ? me.makeTimeoutError() : i;
      } finally {
        o && clearTimeout(o);
      }
    };
  }
  getClientName() {
    return "fetch";
  }
  async makeRequest(t, s, r, a, n, o, i, c) {
    const l = i === "http", u = new URL(r, `${l ? "http" : "https"}://${t}`);
    u.port = s;
    const d = a == "POST" || a == "PUT" || a == "PATCH", m = o || (d ? "" : void 0), _ = await this._fetchFn(u.toString(), { method: a, headers: dd(n), body: m }, c);
    return new ba(_);
  }
};
var ba = class _ba extends ri {
  static {
    __name(this, "ba");
  }
  constructor(t) {
    super(t.status, _ba._transformHeadersToObject(t.headers)), this._res = t;
  }
  getRawResponse() {
    return this._res;
  }
  toStream(t) {
    return t(), this._res.body;
  }
  toJSON() {
    return this._res.json();
  }
  static _transformHeadersToObject(t) {
    const s = {};
    for (const r of t) {
      if (!Array.isArray(r) || r.length != 2) throw new Error("Response objects produced by the fetch function given to FetchHttpClient do not have an iterable headers map. Response#headers should be an iterable object.");
      s[r[0]] = r[1];
    }
    return s;
  }
};
var ai = class {
  static {
    __name(this, "ai");
  }
  computeHMACSignature(t, s) {
    throw new Error("computeHMACSignature not implemented.");
  }
  computeHMACSignatureAsync(t, s) {
    throw new Error("computeHMACSignatureAsync not implemented.");
  }
  computeSHA256Async(t) {
    throw new Error("computeSHA256 not implemented.");
  }
};
var ni = class extends Error {
  static {
    __name(this, "ni");
  }
};
var pd = class extends ai {
  static {
    __name(this, "pd");
  }
  constructor(t) {
    super(), this.subtleCrypto = t || crypto.subtle;
  }
  computeHMACSignature(t, s) {
    throw new ni("SubtleCryptoProvider cannot be used in a synchronous context.");
  }
  async computeHMACSignatureAsync(t, s) {
    const r = new TextEncoder(), a = await this.subtleCrypto.importKey("raw", r.encode(s), { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]), n = await this.subtleCrypto.sign("hmac", a, r.encode(t)), o = new Uint8Array(n), i = new Array(o.length);
    for (let c = 0; c < o.length; c++) i[c] = aa[o[c]];
    return i.join("");
  }
  async computeSHA256Async(t) {
    return new Uint8Array(await this.subtleCrypto.digest("SHA-256", t));
  }
};
var aa = new Array(256);
for (let e = 0; e < aa.length; e++) aa[e] = e.toString(16).padStart(2, "0");
var md = class {
  static {
    __name(this, "md");
  }
  constructor() {
    this._fetchFn = null, this._agent = null;
  }
  getUname() {
    throw new Error("getUname not implemented.");
  }
  uuid4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (t) => {
      const s = Math.random() * 16 | 0;
      return (t === "x" ? s : s & 3 | 8).toString(16);
    });
  }
  secureCompare(t, s) {
    if (t.length !== s.length) return false;
    const r = t.length;
    let a = 0;
    for (let n = 0; n < r; ++n) a |= t.charCodeAt(n) ^ s.charCodeAt(n);
    return a === 0;
  }
  createEmitter() {
    throw new Error("createEmitter not implemented.");
  }
  tryBufferData(t) {
    throw new Error("tryBufferData not implemented.");
  }
  createNodeHttpClient(t) {
    throw new Error("createNodeHttpClient not implemented.");
  }
  createFetchHttpClient(t) {
    return new fr(t);
  }
  createDefaultHttpClient() {
    throw new Error("createDefaultHttpClient not implemented.");
  }
  createNodeCryptoProvider() {
    throw new Error("createNodeCryptoProvider not implemented.");
  }
  createSubtleCryptoProvider(t) {
    return new pd(t);
  }
  createDefaultCryptoProvider() {
    throw new Error("createDefaultCryptoProvider not implemented.");
  }
};
var fd = class extends Event {
  static {
    __name(this, "fd");
  }
  constructor(t, s) {
    super(t), this.data = s;
  }
};
var hd = class {
  static {
    __name(this, "hd");
  }
  constructor() {
    this.eventTarget = new EventTarget(), this.listenerMapping = /* @__PURE__ */ new Map();
  }
  on(t, s) {
    const r = /* @__PURE__ */ __name((a) => {
      s(a.data);
    }, "r");
    return this.listenerMapping.set(s, r), this.eventTarget.addEventListener(t, r);
  }
  removeListener(t, s) {
    const r = this.listenerMapping.get(s);
    return this.listenerMapping.delete(s), this.eventTarget.removeEventListener(t, r);
  }
  once(t, s) {
    const r = /* @__PURE__ */ __name((a) => {
      s(a.data);
    }, "r");
    return this.listenerMapping.set(s, r), this.eventTarget.addEventListener(t, r, { once: true });
  }
  emit(t, s) {
    return this.eventTarget.dispatchEvent(new fd(t, s));
  }
};
var _d = class extends md {
  static {
    __name(this, "_d");
  }
  getUname() {
    return Promise.resolve(null);
  }
  createEmitter() {
    return new hd();
  }
  tryBufferData(t) {
    if (t.file.data instanceof ReadableStream) throw new Error("Uploading a file as a stream is not supported in non-Node environments. Please open or upvote an issue at github.com/stripe/stripe-node if you use this, detailing your use-case.");
    return Promise.resolve(t);
  }
  createNodeHttpClient() {
    throw new Error("Stripe: `createNodeHttpClient()` is not available in non-Node environments. Please use `createFetchHttpClient()` instead.");
  }
  createDefaultHttpClient() {
    return super.createFetchHttpClient();
  }
  createNodeCryptoProvider() {
    throw new Error("Stripe: `createNodeCryptoProvider()` is not available in non-Node environments. Please use `createSubtleCryptoProvider()` instead.");
  }
  createDefaultCryptoProvider() {
    return this.createSubtleCryptoProvider();
  }
};
var vr = /* @__PURE__ */ __name((e) => {
  switch (e.type) {
    case "card_error":
      return new ii(e);
    case "invalid_request_error":
      return new Ta(e);
    case "api_error":
      return new va(e);
    case "authentication_error":
      return new Sa(e);
    case "rate_limit_error":
      return new wa(e);
    case "idempotency_error":
      return new ui(e);
    case "invalid_grant":
      return new di(e);
    default:
      return new pi(e);
  }
}, "vr");
var oi = /* @__PURE__ */ __name((e) => {
  switch (e.type) {
    case "temporary_session_expired":
      return new mi(e);
  }
  switch (e.code) {
    case "invalid_fields":
      return new Ta(e);
  }
  return vr(e);
}, "oi");
var ie = class extends Error {
  static {
    __name(this, "ie");
  }
  constructor(t = {}, s = null) {
    var r;
    super(t.message), this.type = s || this.constructor.name, this.raw = t, this.rawType = t.type, this.code = t.code, this.doc_url = t.doc_url, this.param = t.param, this.detail = t.detail, this.headers = t.headers, this.requestId = t.requestId, this.statusCode = t.statusCode, this.message = (r = t.message) !== null && r !== void 0 ? r : "", this.userMessage = t.user_message, this.charge = t.charge, this.decline_code = t.decline_code, this.payment_intent = t.payment_intent, this.payment_method = t.payment_method, this.payment_method_type = t.payment_method_type, this.setup_intent = t.setup_intent, this.source = t.source;
  }
};
ie.generate = vr;
var ii = class extends ie {
  static {
    __name(this, "ii");
  }
  constructor(t = {}) {
    super(t, "StripeCardError");
  }
};
var Ta = class extends ie {
  static {
    __name(this, "Ta");
  }
  constructor(t = {}) {
    super(t, "StripeInvalidRequestError");
  }
};
var va = class extends ie {
  static {
    __name(this, "va");
  }
  constructor(t = {}) {
    super(t, "StripeAPIError");
  }
};
var Sa = class extends ie {
  static {
    __name(this, "Sa");
  }
  constructor(t = {}) {
    super(t, "StripeAuthenticationError");
  }
};
var ci = class extends ie {
  static {
    __name(this, "ci");
  }
  constructor(t = {}) {
    super(t, "StripePermissionError");
  }
};
var wa = class extends ie {
  static {
    __name(this, "wa");
  }
  constructor(t = {}) {
    super(t, "StripeRateLimitError");
  }
};
var li = class extends ie {
  static {
    __name(this, "li");
  }
  constructor(t = {}) {
    super(t, "StripeConnectionError");
  }
};
var Fe = class extends ie {
  static {
    __name(this, "Fe");
  }
  constructor(t, s, r = {}) {
    super(r, "StripeSignatureVerificationError"), this.header = t, this.payload = s;
  }
};
var ui = class extends ie {
  static {
    __name(this, "ui");
  }
  constructor(t = {}) {
    super(t, "StripeIdempotencyError");
  }
};
var di = class extends ie {
  static {
    __name(this, "di");
  }
  constructor(t = {}) {
    super(t, "StripeInvalidGrantError");
  }
};
var pi = class extends ie {
  static {
    __name(this, "pi");
  }
  constructor(t = {}) {
    super(t, "StripeUnknownError");
  }
};
var mi = class extends ie {
  static {
    __name(this, "mi");
  }
  constructor(t = {}) {
    super(t, "TemporarySessionExpiredError");
  }
};
var tn = Object.freeze(Object.defineProperty({ __proto__: null, StripeAPIError: va, StripeAuthenticationError: Sa, StripeCardError: ii, StripeConnectionError: li, StripeError: ie, StripeIdempotencyError: ui, StripeInvalidGrantError: di, StripeInvalidRequestError: Ta, StripePermissionError: ci, StripeRateLimitError: wa, StripeSignatureVerificationError: Fe, StripeUnknownError: pi, TemporarySessionExpiredError: mi, generateV1Error: vr, generateV2Error: oi }, Symbol.toStringTag, { value: "Module" }));
var Ed = 60;
var fs = class _fs {
  static {
    __name(this, "fs");
  }
  constructor(t, s) {
    this._stripe = t, this._maxBufferedRequestMetric = s;
  }
  _normalizeStripeContext(t, s) {
    return t ? t.toString() || null : (s == null ? void 0 : s.toString()) || null;
  }
  _addHeadersDirectlyToObject(t, s) {
    t.requestId = s["request-id"], t.stripeAccount = t.stripeAccount || s["stripe-account"], t.apiVersion = t.apiVersion || s["stripe-version"], t.idempotencyKey = t.idempotencyKey || s["idempotency-key"];
  }
  _makeResponseEvent(t, s, r) {
    const a = Date.now(), n = a - t.request_start_time;
    return Dr({ api_version: r["stripe-version"], account: r["stripe-account"], idempotency_key: r["idempotency-key"], method: t.method, path: t.path, status: s, request_id: this._getRequestId(r), elapsed: n, request_start_time: t.request_start_time, request_end_time: a });
  }
  _getRequestId(t) {
    return t["request-id"];
  }
  _streamingResponseHandler(t, s, r) {
    return (a) => {
      const n = a.getHeaders(), o = /* @__PURE__ */ __name(() => {
        const c = this._makeResponseEvent(t, a.getStatusCode(), n);
        this._stripe._emitter.emit("response", c), this._recordRequestMetrics(this._getRequestId(n), c.elapsed, s);
      }, "o"), i = a.toStream(o);
      return this._addHeadersDirectlyToObject(i, n), r(null, i);
    };
  }
  _jsonResponseHandler(t, s, r, a) {
    return (n) => {
      const o = n.getHeaders(), i = this._getRequestId(o), c = n.getStatusCode(), l = this._makeResponseEvent(t, c, o);
      this._stripe._emitter.emit("response", l), n.toJSON().then((u) => {
        if (u.error) {
          let d;
          throw typeof u.error == "string" && (u.error = { type: u.error, message: u.error_description }), u.error.headers = o, u.error.statusCode = c, u.error.requestId = i, c === 401 ? d = new Sa(u.error) : c === 403 ? d = new ci(u.error) : c === 429 ? d = new wa(u.error) : s === "v2" ? d = oi(u.error) : d = vr(u.error), d;
        }
        return u;
      }, (u) => {
        throw new va({ message: "Invalid JSON received from the Stripe API", exception: u, requestId: o["request-id"] });
      }).then((u) => {
        this._recordRequestMetrics(i, l.elapsed, r);
        const d = n.getRawResponse();
        this._addHeadersDirectlyToObject(d, o), Object.defineProperty(u, "lastResponse", { enumerable: false, writable: false, value: d }), a(null, u);
      }, (u) => a(u, null));
    };
  }
  static _generateConnectionErrorMessage(t) {
    return `An error occurred with our connection to Stripe.${t > 0 ? ` Request was retried ${t} times.` : ""}`;
  }
  static _shouldRetry(t, s, r, a) {
    return a && s === 0 && me.CONNECTION_CLOSED_ERROR_CODES.includes(a.code) ? true : s >= r ? false : t ? t.getHeaders()["stripe-should-retry"] === "false" ? false : t.getHeaders()["stripe-should-retry"] === "true" || t.getStatusCode() === 409 || t.getStatusCode() >= 500 : true;
  }
  _getSleepTimeInMS(t, s = null) {
    const r = this._stripe.getInitialNetworkRetryDelay(), a = this._stripe.getMaxNetworkRetryDelay();
    let n = Math.min(r * Math.pow(2, t - 1), a);
    return n *= 0.5 * (1 + Math.random()), n = Math.max(r, n), Number.isInteger(s) && s <= Ed && (n = Math.max(n, s)), n * 1e3;
  }
  _getMaxNetworkRetries(t = {}) {
    return t.maxNetworkRetries !== void 0 && Number.isInteger(t.maxNetworkRetries) ? t.maxNetworkRetries : this._stripe.getMaxNetworkRetries();
  }
  _defaultIdempotencyKey(t, s, r) {
    const a = this._getMaxNetworkRetries(s), n = /* @__PURE__ */ __name(() => `stripe-node-retry-${this._stripe._platformFunctions.uuid4()}`, "n");
    if (r === "v2") {
      if (t === "POST" || t === "DELETE") return n();
    } else if (r === "v1" && t === "POST" && a > 0) return n();
    return null;
  }
  _makeHeaders({ contentType: t, contentLength: s, apiVersion: r, clientUserAgent: a, method: n, userSuppliedHeaders: o, userSuppliedSettings: i, stripeAccount: c, stripeContext: l, apiMode: u }) {
    const d = { Accept: "application/json", "Content-Type": t, "User-Agent": this._getUserAgentString(u), "X-Stripe-Client-User-Agent": a, "X-Stripe-Client-Telemetry": this._getTelemetryHeader(), "Stripe-Version": r, "Stripe-Account": c, "Stripe-Context": l, "Idempotency-Key": this._defaultIdempotencyKey(n, i, u) }, m = n == "POST" || n == "PUT" || n == "PATCH";
    return (m || s) && (m || mr(`${n} method had non-zero contentLength but no payload is expected for this verb`), d["Content-Length"] = s), Object.assign(Dr(d), sd(o));
  }
  _getUserAgentString(t) {
    const s = this._stripe.getConstant("PACKAGE_VERSION"), r = this._stripe._appInfo ? this._stripe.getAppInfoAsString() : "";
    return `Stripe/${t} NodeBindings/${s} ${r}`.trim();
  }
  _getTelemetryHeader() {
    if (this._stripe.getTelemetryEnabled() && this._stripe._prevRequestMetrics.length > 0) {
      const t = this._stripe._prevRequestMetrics.shift();
      return JSON.stringify({ last_request_metrics: t });
    }
  }
  _recordRequestMetrics(t, s, r) {
    if (this._stripe.getTelemetryEnabled() && t) if (this._stripe._prevRequestMetrics.length > this._maxBufferedRequestMetric) mr("Request metrics buffer is full, dropping telemetry message.");
    else {
      const a = { request_id: t, request_duration_ms: s };
      r && r.length > 0 && (a.usage = r), this._stripe._prevRequestMetrics.push(a);
    }
  }
  _rawRequest(t, s, r, a, n) {
    return new Promise((i, c) => {
      let l;
      try {
        const h = t.toUpperCase();
        if (h !== "POST" && r && Object.keys(r).length !== 0) throw new Error("rawRequest only supports params on POST requests. Please pass null and add your parameters to path.");
        const E = [].slice.call([r, a]), v = ga(E), b = h === "POST" ? Object.assign({}, v) : null, y = ti(E), S = y.headers, g = y.authenticator;
        l = { requestMethod: h, requestPath: s, bodyData: b, queryData: {}, authenticator: g, headers: S, host: y.host, streaming: !!y.streaming, settings: {}, usage: n || ["raw_request"] };
      } catch (h) {
        c(h);
        return;
      }
      function u(h, E) {
        h ? c(h) : i(E);
      }
      __name(u, "u");
      const { headers: d, settings: m } = l, _ = l.authenticator;
      this._request(l.requestMethod, l.host, s, l.bodyData, _, { headers: d, settings: m, streaming: l.streaming }, l.usage, u);
    });
  }
  _getContentLength(t) {
    return typeof t == "string" ? new TextEncoder().encode(t).length : t.length;
  }
  _request(t, s, r, a, n, o, i = [], c, l = null) {
    var u;
    let d;
    n = (u = n ?? this._stripe._authenticator) !== null && u !== void 0 ? u : null;
    const m = si(r), _ = /* @__PURE__ */ __name((v, b, y, S, g) => setTimeout(v, this._getSleepTimeInMS(S, g), b, y, S + 1), "_"), h = /* @__PURE__ */ __name((v, b, y) => {
      const S = o.settings && o.settings.timeout && Number.isInteger(o.settings.timeout) && o.settings.timeout >= 0 ? o.settings.timeout : this._stripe.getApiField("timeout"), g = { host: s || this._stripe.getApiField("host"), port: this._stripe.getApiField("port"), path: r, method: t, headers: Object.assign({}, b), body: d, protocol: this._stripe.getApiField("protocol") };
      n(g).then(() => {
        const x = this._stripe.getApiField("httpClient").makeRequest(g.host, g.port, g.path, g.method, g.headers, g.body, g.protocol, S), k = Date.now(), P = Dr({ api_version: v, account: ra(b["Stripe-Account"]), idempotency_key: ra(b["Idempotency-Key"]), method: t, path: r, request_start_time: k }), q = y || 0, B = this._getMaxNetworkRetries(o.settings || {});
        this._stripe._emitter.emit("request", P), x.then((R) => _fs._shouldRetry(R, q, B) ? _(h, v, b, q, ud(R.getHeaders()["retry-after"])) : o.streaming && R.getStatusCode() < 400 ? this._streamingResponseHandler(P, i, c)(R) : this._jsonResponseHandler(P, m, i, c)(R)).catch((R) => {
          if (_fs._shouldRetry(null, q, B, R)) return _(h, v, b, q, null);
          {
            const L = R.code && R.code === me.TIMEOUT_ERROR_CODE;
            return c(new li({ message: L ? `Request aborted due to timeout being reached (${S}ms)` : _fs._generateConnectionErrorMessage(q), detail: R }));
          }
        });
      }).catch((x) => {
        throw new ie({ message: "Unable to authenticate the request", exception: x });
      });
    }, "h"), E = /* @__PURE__ */ __name((v, b) => {
      if (v) return c(v);
      d = b, this._stripe.getClientUserAgent((y) => {
        var S, g, x;
        const k = this._stripe.getApiField("version"), P = this._makeHeaders({ contentType: m == "v2" ? "application/json" : "application/x-www-form-urlencoded", contentLength: this._getContentLength(b), apiVersion: k, clientUserAgent: y, method: t, userSuppliedHeaders: (S = o.headers) !== null && S !== void 0 ? S : null, userSuppliedSettings: (g = o.settings) !== null && g !== void 0 ? g : {}, stripeAccount: (x = o.stripeAccount) !== null && x !== void 0 ? x : this._stripe.getApiField("stripeAccount"), stripeContext: this._normalizeStripeContext(o.stripeContext, this._stripe.getApiField("stripeContext")), apiMode: m });
        h(k, P, 0);
      });
    }, "E");
    if (l) l(t, a, o.headers, E);
    else {
      let v;
      m == "v2" ? v = a ? ld(a) : "" : v = Tr(a || {}), E(null, v);
    }
  }
};
var fi = class {
  static {
    __name(this, "fi");
  }
  constructor(t, s, r, a) {
    this.index = 0, this.pagePromise = t, this.promiseCache = { currentPromise: null }, this.requestArgs = s, this.spec = r, this.stripeResource = a;
  }
  async iterate(t) {
    if (!(t && t.data && typeof t.data.length == "number")) throw Error("Unexpected: Stripe API response does not have a well-formed `data` array.");
    const s = hi(this.requestArgs);
    if (this.index < t.data.length) {
      const r = s ? t.data.length - 1 - this.index : this.index, a = t.data[r];
      return this.index += 1, { value: a, done: false };
    } else if (t.has_more) {
      this.index = 0, this.pagePromise = this.getNextPage(t);
      const r = await this.pagePromise;
      return this.iterate(r);
    }
    return { done: true, value: void 0 };
  }
  getNextPage(t) {
    throw new Error("Unimplemented");
  }
  async _next() {
    return this.iterate(await this.pagePromise);
  }
  next() {
    if (this.promiseCache.currentPromise) return this.promiseCache.currentPromise;
    const t = (async () => {
      const s = await this._next();
      return this.promiseCache.currentPromise = null, s;
    })();
    return this.promiseCache.currentPromise = t, t;
  }
};
var gd = class extends fi {
  static {
    __name(this, "gd");
  }
  getNextPage(t) {
    const s = hi(this.requestArgs), r = xd(t, s);
    return this.stripeResource._makeRequest(this.requestArgs, this.spec, { [s ? "ending_before" : "starting_after"]: r });
  }
};
var yd = class extends fi {
  static {
    __name(this, "yd");
  }
  getNextPage(t) {
    if (!t.next_page) throw Error("Unexpected: Stripe API response does not have a well-formed `next_page` field, but `has_more` was true.");
    return this.stripeResource._makeRequest(this.requestArgs, this.spec, { page: t.next_page });
  }
};
var bd = class {
  static {
    __name(this, "bd");
  }
  constructor(t, s, r, a) {
    this.firstPagePromise = t, this.currentPageIterator = null, this.nextPageUrl = null, this.requestArgs = s, this.spec = r, this.stripeResource = a;
  }
  async initFirstPage() {
    if (this.firstPagePromise) {
      const t = await this.firstPagePromise;
      this.firstPagePromise = null, this.currentPageIterator = t.data[Symbol.iterator](), this.nextPageUrl = t.next_page_url || null;
    }
  }
  async turnPage() {
    if (!this.nextPageUrl) return null;
    this.spec.fullPath = this.nextPageUrl;
    const t = await this.stripeResource._makeRequest([], this.spec, {});
    return this.nextPageUrl = t.next_page_url || null, this.currentPageIterator = t.data[Symbol.iterator](), this.currentPageIterator;
  }
  async next() {
    if (await this.initFirstPage(), this.currentPageIterator) {
      const r = this.currentPageIterator.next();
      if (!r.done) return { done: false, value: r.value };
    }
    const t = await this.turnPage();
    if (!t) return { done: true, value: void 0 };
    const s = t.next();
    return s.done ? { done: true, value: void 0 } : { done: false, value: s.value };
  }
};
var Td = /* @__PURE__ */ __name((e, t, s, r) => {
  const a = si(s.fullPath || s.path);
  return a !== "v2" && s.methodType === "search" ? Nr(new yd(r, t, s, e)) : a !== "v2" && s.methodType === "list" ? Nr(new gd(r, t, s, e)) : a === "v2" && s.methodType === "list" ? Nr(new bd(r, t, s, e)) : null;
}, "Td");
var Nr = /* @__PURE__ */ __name((e) => {
  const t = Rd((...a) => e.next(...a)), s = Id(t), r = { autoPagingEach: t, autoPagingToArray: s, next: /* @__PURE__ */ __name(() => e.next(), "next"), return: /* @__PURE__ */ __name(() => ({}), "return"), [vd()]: () => r };
  return r;
}, "Nr");
function vd() {
  return typeof Symbol < "u" && Symbol.asyncIterator ? Symbol.asyncIterator : "@@asyncIterator";
}
__name(vd, "vd");
function Sd(e) {
  if (e.length < 2) return null;
  const t = e[1];
  if (typeof t != "function") throw Error(`The second argument to autoPagingEach, if present, must be a callback function; received ${typeof t}`);
  return t;
}
__name(Sd, "Sd");
function wd(e) {
  if (e.length === 0) return;
  const t = e[0];
  if (typeof t != "function") throw Error(`The first argument to autoPagingEach, if present, must be a callback function; received ${typeof t}`);
  if (t.length === 2) return t;
  if (t.length > 2) throw Error(`The \`onItem\` callback function passed to autoPagingEach must accept at most two arguments; got ${t}`);
  return function(r, a) {
    const n = t(r);
    a(n);
  };
}
__name(wd, "wd");
function xd(e, t) {
  const s = t ? 0 : e.data.length - 1, r = e.data[s], a = r && r.id;
  if (!a) throw Error("Unexpected: No `id` found on the last item while auto-paging a list.");
  return a;
}
__name(xd, "xd");
function Rd(e) {
  return function() {
    const s = [].slice.call(arguments), r = wd(s), a = Sd(s);
    if (s.length > 2) throw Error(`autoPagingEach takes up to two arguments; received ${s}`);
    const n = Pd(e, r);
    return ya(n, a);
  };
}
__name(Rd, "Rd");
function Id(e) {
  return function(s, r) {
    const a = s && s.limit;
    if (!a) throw Error("You must pass a `limit` option to autoPagingToArray, e.g., `autoPagingToArray({limit: 1000});`.");
    if (a > 1e4) throw Error("You cannot specify a limit of more than 10,000 items to fetch in `autoPagingToArray`; use `autoPagingEach` to iterate through longer lists.");
    const n = new Promise((o, i) => {
      const c = [];
      e((l) => {
        if (c.push(l), c.length >= a) return false;
      }).then(() => {
        o(c);
      }).catch(i);
    });
    return ya(n, r);
  };
}
__name(Id, "Id");
function Pd(e, t) {
  return new Promise((s, r) => {
    function a(n) {
      if (n.done) {
        s();
        return;
      }
      const o = n.value;
      return new Promise((i) => {
        t(o, i);
      }).then((i) => i === false ? a({ done: true, value: void 0 }) : e().then(a));
    }
    __name(a, "a");
    e().then(a).catch(r);
  });
}
__name(Pd, "Pd");
function hi(e) {
  const t = [].slice.call(e);
  return !!ga(t).ending_before;
}
__name(hi, "hi");
function Od(e) {
  if (e.path !== void 0 && e.fullPath !== void 0) throw new Error(`Method spec specified both a 'path' (${e.path}) and a 'fullPath' (${e.fullPath}).`);
  return function(...t) {
    const s = typeof t[t.length - 1] == "function" && t.pop();
    e.urlParams = ed(e.fullPath || this.createResourcePathWithSymbols(e.path || ""));
    const r = ya(this._makeRequest(t, e, {}), s);
    return Object.assign(r, Td(this, t, e, r)), r;
  };
}
__name(Od, "Od");
p.extend = td;
p.method = Od;
p.MAX_BUFFERED_REQUEST_METRICS = 100;
function p(e, t) {
  if (this._stripe = e, t) throw new Error("Support for curried url params was dropped in stripe-node v7.0.0. Instead, pass two ids.");
  this.basePath = ta(this.basePath || e.getApiField("basePath")), this.resourcePath = this.path, this.path = ta(this.path), this.initialize(...arguments);
}
__name(p, "p");
p.prototype = { _stripe: null, path: "", resourcePath: "", basePath: null, initialize() {
}, requestDataProcessor: null, validateRequest: null, createFullPath(e, t) {
  const s = [this.basePath(t), this.path(t)];
  if (typeof e == "function") {
    const r = e(t);
    r && s.push(r);
  } else s.push(e);
  return this._joinUrlParts(s);
}, createResourcePathWithSymbols(e) {
  return e ? `/${this._joinUrlParts([this.resourcePath, e])}` : `/${this.resourcePath}`;
}, _joinUrlParts(e) {
  return e.join("/").replace(/\/{2,}/g, "/");
}, _getRequestOpts(e, t, s) {
  var r;
  const a = (t.method || "GET").toUpperCase(), n = t.usage || [], o = t.urlParams || [], i = t.encode || ((P) => P), c = !!t.fullPath, l = ta(c ? t.fullPath : t.path || ""), u = c ? t.fullPath : this.createResourcePathWithSymbols(t.path), d = [].slice.call(e), m = o.reduce((P, q) => {
    const B = d.shift();
    if (typeof B != "string") throw new Error(`Stripe: Argument "${q}" must be a string, but got: ${B} (on API request to \`${a} ${u}\`)`);
    return P[q] = B, P;
  }, {}), _ = ga(d), h = i(Object.assign({}, _, s)), E = ti(d), v = E.host || t.host, b = !!t.streaming || !!E.streaming;
  if (d.filter((P) => P != null).length) throw new Error(`Stripe: Unknown arguments (${d}). Did you mean to pass an options object? See https://github.com/stripe/stripe-node/wiki/Passing-Options. (on API request to ${a} \`${u}\`)`);
  const y = c ? l(m) : this.createFullPath(l, m), S = Object.assign(E.headers, t.headers);
  t.validator && t.validator(h, { headers: S });
  const g = t.method === "GET" || t.method === "DELETE";
  return { requestMethod: a, requestPath: y, bodyData: g ? null : h, queryData: g ? h : {}, authenticator: (r = E.authenticator) !== null && r !== void 0 ? r : null, headers: S, host: v ?? null, streaming: b, settings: E.settings, usage: n };
}, _makeRequest(e, t, s) {
  return new Promise((r, a) => {
    var n;
    let o;
    try {
      o = this._getRequestOpts(e, t, s);
    } catch (m) {
      a(m);
      return;
    }
    function i(m, _) {
      m ? a(m) : r(t.transformResponseData ? t.transformResponseData(_) : _);
    }
    __name(i, "i");
    const c = Object.keys(o.queryData).length === 0, l = [o.requestPath, c ? "" : "?", Tr(o.queryData)].join(""), { headers: u, settings: d } = o;
    this._stripe._requestSender._request(o.requestMethod, o.host, l, o.bodyData, o.authenticator, { headers: u, settings: d, streaming: o.streaming }, o.usage, i, (n = this.requestDataProcessor) === null || n === void 0 ? void 0 : n.bind(this));
  });
} };
var et = class _et {
  static {
    __name(this, "et");
  }
  constructor(t = []) {
    this._segments = [...t];
  }
  get segments() {
    return [...this._segments];
  }
  push(t) {
    if (!t) throw new Error("Segment cannot be null or undefined");
    return new _et([...this._segments, t]);
  }
  pop() {
    if (this._segments.length === 0) throw new Error("Cannot pop from an empty context");
    return new _et(this._segments.slice(0, -1));
  }
  toString() {
    return this._segments.join("/");
  }
  static parse(t) {
    return t ? new _et(t.split("/")) : new _et([]);
  }
};
function Ad(e) {
  const t = { DEFAULT_TOLERANCE: 300, signature: null, constructEvent(u, d, m, _, h, E) {
    try {
      if (!this.signature) throw new Error("ERR: missing signature helper, unable to verify");
      this.signature.verifyHeader(u, d, m, _ || t.DEFAULT_TOLERANCE, h, E);
    } catch (b) {
      throw b instanceof ni && (b.message += "\nUse `await constructEventAsync(...)` instead of `constructEvent(...)`"), b;
    }
    return u instanceof Uint8Array ? JSON.parse(new TextDecoder("utf8").decode(u)) : JSON.parse(u);
  }, async constructEventAsync(u, d, m, _, h, E) {
    if (!this.signature) throw new Error("ERR: missing signature helper, unable to verify");
    return await this.signature.verifyHeaderAsync(u, d, m, _ || t.DEFAULT_TOLERANCE, h, E), u instanceof Uint8Array ? JSON.parse(new TextDecoder("utf8").decode(u)) : JSON.parse(u);
  }, generateTestHeaderString: /* @__PURE__ */ __name(function(u) {
    const d = l(u), m = d.signature || d.cryptoProvider.computeHMACSignature(d.payloadString, d.secret);
    return d.generateHeaderString(m);
  }, "generateTestHeaderString"), generateTestHeaderStringAsync: /* @__PURE__ */ __name(async function(u) {
    const d = l(u), m = d.signature || await d.cryptoProvider.computeHMACSignatureAsync(d.payloadString, d.secret);
    return d.generateHeaderString(m);
  }, "generateTestHeaderStringAsync") }, s = { EXPECTED_SCHEME: "v1", verifyHeader(u, d, m, _, h, E) {
    const { decodedHeader: v, decodedPayload: b, details: y, suspectPayloadType: S } = a(u, d, this.EXPECTED_SCHEME), g = /\s/.test(m);
    h = h || c();
    const x = h.computeHMACSignature(r(b, y), m);
    return n(b, v, y, x, _, S, g, E), true;
  }, async verifyHeaderAsync(u, d, m, _, h, E) {
    const { decodedHeader: v, decodedPayload: b, details: y, suspectPayloadType: S } = a(u, d, this.EXPECTED_SCHEME), g = /\s/.test(m);
    h = h || c();
    const x = await h.computeHMACSignatureAsync(r(b, y), m);
    return n(b, v, y, x, _, S, g, E);
  } };
  function r(u, d) {
    return `${d.timestamp}.${u}`;
  }
  __name(r, "r");
  function a(u, d, m) {
    if (!u) throw new Fe(d, u, { message: "No webhook payload was provided." });
    const _ = typeof u != "string" && !(u instanceof Uint8Array), h = new TextDecoder("utf8"), E = u instanceof Uint8Array ? h.decode(u) : u;
    if (Array.isArray(d)) throw new Error("Unexpected: An array was passed as a header, which should not be possible for the stripe-signature header.");
    if (d == null || d == "") throw new Fe(d, u, { message: "No stripe-signature header value was provided." });
    const v = d instanceof Uint8Array ? h.decode(d) : d, b = o(v, m);
    if (!b || b.timestamp === -1) throw new Fe(v, E, { message: "Unable to extract timestamp and signatures from header" });
    if (!b.signatures.length) throw new Fe(v, E, { message: "No signatures found with expected scheme" });
    return { decodedPayload: E, decodedHeader: v, details: b, suspectPayloadType: _ };
  }
  __name(a, "a");
  function n(u, d, m, _, h, E, v, b) {
    const y = !!m.signatures.filter(e.secureCompare.bind(e, _)).length, S = `
Learn more about webhook signing and explore webhook integration examples for various frameworks at https://docs.stripe.com/webhooks/signature`, g = v ? `

Note: The provided signing secret contains whitespace. This often indicates an extra newline or space is in the value` : "";
    if (!y) throw E ? new Fe(d, u, { message: `Webhook payload must be provided as a string or a Buffer (https://nodejs.org/api/buffer.html) instance representing the _raw_ request body.Payload was provided as a parsed JavaScript object instead. 
Signature verification is impossible without access to the original signed material. 
` + S + `
` + g }) : new Fe(d, u, { message: `No signatures found matching the expected signature for payload. Are you passing the raw request body you received from Stripe? 
 If a webhook request is being forwarded by a third-party tool, ensure that the exact request body, including JSON formatting and new line style, is preserved.
` + S + `
` + g });
    const x = Math.floor((typeof b == "number" ? b : Date.now()) / 1e3) - m.timestamp;
    if (h > 0 && x > h) throw new Fe(d, u, { message: "Timestamp outside the tolerance zone" });
    return true;
  }
  __name(n, "n");
  function o(u, d) {
    return typeof u != "string" ? null : u.split(",").reduce((m, _) => {
      const h = _.split("=");
      return h[0] === "t" && (m.timestamp = parseInt(h[1], 10)), h[0] === d && m.signatures.push(h[1]), m;
    }, { timestamp: -1, signatures: [] });
  }
  __name(o, "o");
  let i = null;
  function c() {
    return i || (i = e.createDefaultCryptoProvider()), i;
  }
  __name(c, "c");
  function l(u) {
    if (!u) throw new ie({ message: "Options are required" });
    const d = Math.floor(u.timestamp) || Math.floor(Date.now() / 1e3), m = u.scheme || s.EXPECTED_SCHEME, _ = u.cryptoProvider || c(), h = `${d}.${u.payload}`, E = /* @__PURE__ */ __name((v) => `t=${d},${m}=${v}`, "E");
    return Object.assign(Object.assign({}, u), { timestamp: d, scheme: m, cryptoProvider: _, payloadString: h, generateHeaderString: E });
  }
  __name(l, "l");
  return t.signature = s, t;
}
__name(Ad, "Ad");
var _i = "2026-02-25.clover";
function Cd(e, t) {
  for (const s in t) {
    if (!Object.prototype.hasOwnProperty.call(t, s)) continue;
    const r = s[0].toLowerCase() + s.substring(1), a = new t[s](e);
    this[r] = a;
  }
}
__name(Cd, "Cd");
function H(e, t) {
  return function(s) {
    return new Cd(s, t);
  };
}
__name(H, "H");
var Dd = p.method;
var kd = p.extend({ create: Dd({ method: "POST", fullPath: "/v2/core/account_links" }) });
var sn = p.method;
var Nd = p.extend({ create: sn({ method: "POST", fullPath: "/v2/core/account_tokens" }), retrieve: sn({ method: "GET", fullPath: "/v2/core/account_tokens/{id}" }) });
var Ve = p.method;
var jd = p.extend({ retrieve: Ve({ method: "GET", fullPath: "/v1/financial_connections/accounts/{account}" }), list: Ve({ method: "GET", fullPath: "/v1/financial_connections/accounts", methodType: "list" }), disconnect: Ve({ method: "POST", fullPath: "/v1/financial_connections/accounts/{account}/disconnect" }), listOwners: Ve({ method: "GET", fullPath: "/v1/financial_connections/accounts/{account}/owners", methodType: "list" }), refresh: Ve({ method: "POST", fullPath: "/v1/financial_connections/accounts/{account}/refresh" }), subscribe: Ve({ method: "POST", fullPath: "/v1/financial_connections/accounts/{account}/subscribe" }), unsubscribe: Ve({ method: "POST", fullPath: "/v1/financial_connections/accounts/{account}/unsubscribe" }) });
var Bt = p.method;
var Md = p.extend({ create: Bt({ method: "POST", fullPath: "/v2/core/accounts/{account_id}/persons" }), retrieve: Bt({ method: "GET", fullPath: "/v2/core/accounts/{account_id}/persons/{id}" }), update: Bt({ method: "POST", fullPath: "/v2/core/accounts/{account_id}/persons/{id}" }), list: Bt({ method: "GET", fullPath: "/v2/core/accounts/{account_id}/persons", methodType: "list" }), del: Bt({ method: "DELETE", fullPath: "/v2/core/accounts/{account_id}/persons/{id}" }) });
var rn = p.method;
var Ld = p.extend({ create: rn({ method: "POST", fullPath: "/v2/core/accounts/{account_id}/person_tokens" }), retrieve: rn({ method: "GET", fullPath: "/v2/core/accounts/{account_id}/person_tokens/{id}" }) });
var Kt = p.method;
var $d = p.extend({ constructor: /* @__PURE__ */ __name(function(...e) {
  p.apply(this, e), this.persons = new Md(...e), this.personTokens = new Ld(...e);
}, "constructor"), create: Kt({ method: "POST", fullPath: "/v2/core/accounts" }), retrieve: Kt({ method: "GET", fullPath: "/v2/core/accounts/{id}" }), update: Kt({ method: "POST", fullPath: "/v2/core/accounts/{id}" }), list: Kt({ method: "GET", fullPath: "/v2/core/accounts", methodType: "list" }), close: Kt({ method: "POST", fullPath: "/v2/core/accounts/{id}/close" }) });
var an = p.method;
var Fd = p.extend({ retrieve: an({ method: "GET", fullPath: "/v1/entitlements/active_entitlements/{id}" }), list: an({ method: "GET", fullPath: "/v1/entitlements/active_entitlements", methodType: "list" }) });
var ht = p.method;
var Ud = p.extend({ create: ht({ method: "POST", fullPath: "/v1/billing/alerts" }), retrieve: ht({ method: "GET", fullPath: "/v1/billing/alerts/{id}" }), list: ht({ method: "GET", fullPath: "/v1/billing/alerts", methodType: "list" }), activate: ht({ method: "POST", fullPath: "/v1/billing/alerts/{id}/activate" }), archive: ht({ method: "POST", fullPath: "/v1/billing/alerts/{id}/archive" }), deactivate: ht({ method: "POST", fullPath: "/v1/billing/alerts/{id}/deactivate" }) });
var qd = p.method;
var Hd = p.extend({ find: qd({ method: "GET", fullPath: "/v1/tax/associations/find" }) });
var Gt = p.method;
var Wd = p.extend({ retrieve: Gt({ method: "GET", fullPath: "/v1/issuing/authorizations/{authorization}" }), update: Gt({ method: "POST", fullPath: "/v1/issuing/authorizations/{authorization}" }), list: Gt({ method: "GET", fullPath: "/v1/issuing/authorizations", methodType: "list" }), approve: Gt({ method: "POST", fullPath: "/v1/issuing/authorizations/{authorization}/approve" }), decline: Gt({ method: "POST", fullPath: "/v1/issuing/authorizations/{authorization}/decline" }) });
var Je = p.method;
var Bd = p.extend({ create: Je({ method: "POST", fullPath: "/v1/test_helpers/issuing/authorizations" }), capture: Je({ method: "POST", fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/capture" }), expire: Je({ method: "POST", fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/expire" }), finalizeAmount: Je({ method: "POST", fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/finalize_amount" }), increment: Je({ method: "POST", fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/increment" }), respond: Je({ method: "POST", fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/fraud_challenges/respond" }), reverse: Je({ method: "POST", fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/reverse" }) });
var jr = p.method;
var Kd = p.extend({ create: jr({ method: "POST", fullPath: "/v1/tax/calculations" }), retrieve: jr({ method: "GET", fullPath: "/v1/tax/calculations/{calculation}" }), listLineItems: jr({ method: "GET", fullPath: "/v1/tax/calculations/{calculation}/line_items", methodType: "list" }) });
var ks = p.method;
var Gd = p.extend({ create: ks({ method: "POST", fullPath: "/v1/issuing/cardholders" }), retrieve: ks({ method: "GET", fullPath: "/v1/issuing/cardholders/{cardholder}" }), update: ks({ method: "POST", fullPath: "/v1/issuing/cardholders/{cardholder}" }), list: ks({ method: "GET", fullPath: "/v1/issuing/cardholders", methodType: "list" }) });
var Ns = p.method;
var Vd = p.extend({ create: Ns({ method: "POST", fullPath: "/v1/issuing/cards" }), retrieve: Ns({ method: "GET", fullPath: "/v1/issuing/cards/{card}" }), update: Ns({ method: "POST", fullPath: "/v1/issuing/cards/{card}" }), list: Ns({ method: "GET", fullPath: "/v1/issuing/cards", methodType: "list" }) });
var Vt = p.method;
var Jd = p.extend({ deliverCard: Vt({ method: "POST", fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/deliver" }), failCard: Vt({ method: "POST", fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/fail" }), returnCard: Vt({ method: "POST", fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/return" }), shipCard: Vt({ method: "POST", fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/ship" }), submitCard: Vt({ method: "POST", fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/submit" }) });
var js = p.method;
var Yd = p.extend({ create: js({ method: "POST", fullPath: "/v1/billing_portal/configurations" }), retrieve: js({ method: "GET", fullPath: "/v1/billing_portal/configurations/{configuration}" }), update: js({ method: "POST", fullPath: "/v1/billing_portal/configurations/{configuration}" }), list: js({ method: "GET", fullPath: "/v1/billing_portal/configurations", methodType: "list" }) });
var Jt = p.method;
var zd = p.extend({ create: Jt({ method: "POST", fullPath: "/v1/terminal/configurations" }), retrieve: Jt({ method: "GET", fullPath: "/v1/terminal/configurations/{configuration}" }), update: Jt({ method: "POST", fullPath: "/v1/terminal/configurations/{configuration}" }), list: Jt({ method: "GET", fullPath: "/v1/terminal/configurations", methodType: "list" }), del: Jt({ method: "DELETE", fullPath: "/v1/terminal/configurations/{configuration}" }) });
var Xd = p.method;
var Qd = p.extend({ create: Xd({ method: "POST", fullPath: "/v1/test_helpers/confirmation_tokens" }) });
var Zd = p.method;
var ep = p.extend({ create: Zd({ method: "POST", fullPath: "/v1/terminal/connection_tokens" }) });
var tp = p.method;
var sp = p.extend({ retrieve: tp({ method: "GET", fullPath: "/v1/billing/credit_balance_summary" }) });
var nn = p.method;
var rp = p.extend({ retrieve: nn({ method: "GET", fullPath: "/v1/billing/credit_balance_transactions/{id}" }), list: nn({ method: "GET", fullPath: "/v1/billing/credit_balance_transactions", methodType: "list" }) });
var _t = p.method;
var ap = p.extend({ create: _t({ method: "POST", fullPath: "/v1/billing/credit_grants" }), retrieve: _t({ method: "GET", fullPath: "/v1/billing/credit_grants/{id}" }), update: _t({ method: "POST", fullPath: "/v1/billing/credit_grants/{id}" }), list: _t({ method: "GET", fullPath: "/v1/billing/credit_grants", methodType: "list" }), expire: _t({ method: "POST", fullPath: "/v1/billing/credit_grants/{id}/expire" }), voidGrant: _t({ method: "POST", fullPath: "/v1/billing/credit_grants/{id}/void" }) });
var Mr = p.method;
var np = p.extend({ create: Mr({ method: "POST", fullPath: "/v1/treasury/credit_reversals" }), retrieve: Mr({ method: "GET", fullPath: "/v1/treasury/credit_reversals/{credit_reversal}" }), list: Mr({ method: "GET", fullPath: "/v1/treasury/credit_reversals", methodType: "list" }) });
var op = p.method;
var ip = p.extend({ fundCashBalance: op({ method: "POST", fullPath: "/v1/test_helpers/customers/{customer}/fund_cash_balance" }) });
var Lr = p.method;
var cp = p.extend({ create: Lr({ method: "POST", fullPath: "/v1/treasury/debit_reversals" }), retrieve: Lr({ method: "GET", fullPath: "/v1/treasury/debit_reversals/{debit_reversal}" }), list: Lr({ method: "GET", fullPath: "/v1/treasury/debit_reversals", methodType: "list" }) });
var Yt = p.method;
var lp = p.extend({ create: Yt({ method: "POST", fullPath: "/v1/issuing/disputes" }), retrieve: Yt({ method: "GET", fullPath: "/v1/issuing/disputes/{dispute}" }), update: Yt({ method: "POST", fullPath: "/v1/issuing/disputes/{dispute}" }), list: Yt({ method: "GET", fullPath: "/v1/issuing/disputes", methodType: "list" }), submit: Yt({ method: "POST", fullPath: "/v1/issuing/disputes/{dispute}/submit" }) });
var on2 = p.method;
var up = p.extend({ retrieve: on2({ method: "GET", fullPath: "/v1/radar/early_fraud_warnings/{early_fraud_warning}" }), list: on2({ method: "GET", fullPath: "/v1/radar/early_fraud_warnings", methodType: "list" }) });
var je = p.method;
var dp = p.extend({ create: je({ method: "POST", fullPath: "/v2/core/event_destinations" }), retrieve: je({ method: "GET", fullPath: "/v2/core/event_destinations/{id}" }), update: je({ method: "POST", fullPath: "/v2/core/event_destinations/{id}" }), list: je({ method: "GET", fullPath: "/v2/core/event_destinations", methodType: "list" }), del: je({ method: "DELETE", fullPath: "/v2/core/event_destinations/{id}" }), disable: je({ method: "POST", fullPath: "/v2/core/event_destinations/{id}/disable" }), enable: je({ method: "POST", fullPath: "/v2/core/event_destinations/{id}/enable" }), ping: je({ method: "POST", fullPath: "/v2/core/event_destinations/{id}/ping" }) });
var $r = p.method;
var pp = p.extend({ retrieve(...e) {
  return $r({ method: "GET", fullPath: "/v2/core/events/{id}", transformResponseData: /* @__PURE__ */ __name((s) => this.addFetchRelatedObjectIfNeeded(s), "transformResponseData") }).apply(this, e);
}, list(...e) {
  return $r({ method: "GET", fullPath: "/v2/core/events", methodType: "list", transformResponseData: /* @__PURE__ */ __name((s) => Object.assign(Object.assign({}, s), { data: s.data.map(this.addFetchRelatedObjectIfNeeded.bind(this)) }), "transformResponseData") }).apply(this, e);
}, addFetchRelatedObjectIfNeeded(e) {
  return !e.related_object || !e.related_object.url ? e : Object.assign(Object.assign({}, e), { fetchRelatedObject: /* @__PURE__ */ __name(() => $r({ method: "GET", fullPath: e.related_object.url }).apply(this, [{ stripeContext: e.context }]), "fetchRelatedObject") });
} });
var Ms = p.method;
var mp = p.extend({ create: Ms({ method: "POST", fullPath: "/v1/entitlements/features" }), retrieve: Ms({ method: "GET", fullPath: "/v1/entitlements/features/{id}" }), update: Ms({ method: "POST", fullPath: "/v1/entitlements/features/{id}" }), list: Ms({ method: "GET", fullPath: "/v1/entitlements/features", methodType: "list" }) });
var Ye = p.method;
var fp = p.extend({ create: Ye({ method: "POST", fullPath: "/v1/treasury/financial_accounts" }), retrieve: Ye({ method: "GET", fullPath: "/v1/treasury/financial_accounts/{financial_account}" }), update: Ye({ method: "POST", fullPath: "/v1/treasury/financial_accounts/{financial_account}" }), list: Ye({ method: "GET", fullPath: "/v1/treasury/financial_accounts", methodType: "list" }), close: Ye({ method: "POST", fullPath: "/v1/treasury/financial_accounts/{financial_account}/close" }), retrieveFeatures: Ye({ method: "GET", fullPath: "/v1/treasury/financial_accounts/{financial_account}/features" }), updateFeatures: Ye({ method: "POST", fullPath: "/v1/treasury/financial_accounts/{financial_account}/features" }) });
var Fr = p.method;
var hp = p.extend({ fail: Fr({ method: "POST", fullPath: "/v1/test_helpers/treasury/inbound_transfers/{id}/fail" }), returnInboundTransfer: Fr({ method: "POST", fullPath: "/v1/test_helpers/treasury/inbound_transfers/{id}/return" }), succeed: Fr({ method: "POST", fullPath: "/v1/test_helpers/treasury/inbound_transfers/{id}/succeed" }) });
var Ls = p.method;
var _p = p.extend({ create: Ls({ method: "POST", fullPath: "/v1/treasury/inbound_transfers" }), retrieve: Ls({ method: "GET", fullPath: "/v1/treasury/inbound_transfers/{id}" }), list: Ls({ method: "GET", fullPath: "/v1/treasury/inbound_transfers", methodType: "list" }), cancel: Ls({ method: "POST", fullPath: "/v1/treasury/inbound_transfers/{inbound_transfer}/cancel" }) });
var zt = p.method;
var Ep = p.extend({ create: zt({ method: "POST", fullPath: "/v1/terminal/locations" }), retrieve: zt({ method: "GET", fullPath: "/v1/terminal/locations/{location}" }), update: zt({ method: "POST", fullPath: "/v1/terminal/locations/{location}" }), list: zt({ method: "GET", fullPath: "/v1/terminal/locations", methodType: "list" }), del: zt({ method: "DELETE", fullPath: "/v1/terminal/locations/{location}" }) });
var gp = p.method;
var yp = p.extend({ create: gp({ method: "POST", fullPath: "/v1/billing/meter_event_adjustments" }) });
var bp = p.method;
var Tp = p.extend({ create: bp({ method: "POST", fullPath: "/v2/billing/meter_event_adjustments" }) });
var vp = p.method;
var Sp = p.extend({ create: vp({ method: "POST", fullPath: "/v2/billing/meter_event_session" }) });
var wp = p.method;
var xp = p.extend({ create: wp({ method: "POST", fullPath: "/v2/billing/meter_event_stream", host: "meter-events.stripe.com" }) });
var Rp = p.method;
var Ip = p.extend({ create: Rp({ method: "POST", fullPath: "/v1/billing/meter_events" }) });
var Pp = p.method;
var Op = p.extend({ create: Pp({ method: "POST", fullPath: "/v2/billing/meter_events" }) });
var ze = p.method;
var Ap = p.extend({ create: ze({ method: "POST", fullPath: "/v1/billing/meters" }), retrieve: ze({ method: "GET", fullPath: "/v1/billing/meters/{id}" }), update: ze({ method: "POST", fullPath: "/v1/billing/meters/{id}" }), list: ze({ method: "GET", fullPath: "/v1/billing/meters", methodType: "list" }), deactivate: ze({ method: "POST", fullPath: "/v1/billing/meters/{id}/deactivate" }), listEventSummaries: ze({ method: "GET", fullPath: "/v1/billing/meters/{id}/event_summaries", methodType: "list" }), reactivate: ze({ method: "POST", fullPath: "/v1/billing/meters/{id}/reactivate" }) });
var Cp = p.method;
var Dp = p.extend({ create: Cp({ method: "POST", fullPath: "/v1/terminal/onboarding_links" }) });
var Xt = p.method;
var kp = p.extend({ create: Xt({ method: "POST", fullPath: "/v1/climate/orders" }), retrieve: Xt({ method: "GET", fullPath: "/v1/climate/orders/{order}" }), update: Xt({ method: "POST", fullPath: "/v1/climate/orders/{order}" }), list: Xt({ method: "GET", fullPath: "/v1/climate/orders", methodType: "list" }), cancel: Xt({ method: "POST", fullPath: "/v1/climate/orders/{order}/cancel" }) });
var $s = p.method;
var Np = p.extend({ update: $s({ method: "POST", fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}" }), fail: $s({ method: "POST", fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}/fail" }), post: $s({ method: "POST", fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}/post" }), returnOutboundPayment: $s({ method: "POST", fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}/return" }) });
var Fs = p.method;
var jp = p.extend({ create: Fs({ method: "POST", fullPath: "/v1/treasury/outbound_payments" }), retrieve: Fs({ method: "GET", fullPath: "/v1/treasury/outbound_payments/{id}" }), list: Fs({ method: "GET", fullPath: "/v1/treasury/outbound_payments", methodType: "list" }), cancel: Fs({ method: "POST", fullPath: "/v1/treasury/outbound_payments/{id}/cancel" }) });
var Us = p.method;
var Mp = p.extend({ update: Us({ method: "POST", fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}" }), fail: Us({ method: "POST", fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/fail" }), post: Us({ method: "POST", fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/post" }), returnOutboundTransfer: Us({ method: "POST", fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/return" }) });
var qs = p.method;
var Lp = p.extend({ create: qs({ method: "POST", fullPath: "/v1/treasury/outbound_transfers" }), retrieve: qs({ method: "GET", fullPath: "/v1/treasury/outbound_transfers/{outbound_transfer}" }), list: qs({ method: "GET", fullPath: "/v1/treasury/outbound_transfers", methodType: "list" }), cancel: qs({ method: "POST", fullPath: "/v1/treasury/outbound_transfers/{outbound_transfer}/cancel" }) });
var $p = p.method;
var Fp = p.extend({ create: $p({ method: "POST", fullPath: "/v1/radar/payment_evaluations" }) });
var Hs = p.method;
var Up = p.extend({ create: Hs({ method: "POST", fullPath: "/v1/issuing/personalization_designs" }), retrieve: Hs({ method: "GET", fullPath: "/v1/issuing/personalization_designs/{personalization_design}" }), update: Hs({ method: "POST", fullPath: "/v1/issuing/personalization_designs/{personalization_design}" }), list: Hs({ method: "GET", fullPath: "/v1/issuing/personalization_designs", methodType: "list" }) });
var Ur = p.method;
var qp = p.extend({ activate: Ur({ method: "POST", fullPath: "/v1/test_helpers/issuing/personalization_designs/{personalization_design}/activate" }), deactivate: Ur({ method: "POST", fullPath: "/v1/test_helpers/issuing/personalization_designs/{personalization_design}/deactivate" }), reject: Ur({ method: "POST", fullPath: "/v1/test_helpers/issuing/personalization_designs/{personalization_design}/reject" }) });
var cn = p.method;
var Hp = p.extend({ retrieve: cn({ method: "GET", fullPath: "/v1/issuing/physical_bundles/{physical_bundle}" }), list: cn({ method: "GET", fullPath: "/v1/issuing/physical_bundles", methodType: "list" }) });
var ln = p.method;
var Wp = p.extend({ retrieve: ln({ method: "GET", fullPath: "/v1/climate/products/{product}" }), list: ln({ method: "GET", fullPath: "/v1/climate/products", methodType: "list" }) });
var le = p.method;
var Bp = p.extend({ create: le({ method: "POST", fullPath: "/v1/terminal/readers" }), retrieve: le({ method: "GET", fullPath: "/v1/terminal/readers/{reader}" }), update: le({ method: "POST", fullPath: "/v1/terminal/readers/{reader}" }), list: le({ method: "GET", fullPath: "/v1/terminal/readers", methodType: "list" }), del: le({ method: "DELETE", fullPath: "/v1/terminal/readers/{reader}" }), cancelAction: le({ method: "POST", fullPath: "/v1/terminal/readers/{reader}/cancel_action" }), collectInputs: le({ method: "POST", fullPath: "/v1/terminal/readers/{reader}/collect_inputs" }), collectPaymentMethod: le({ method: "POST", fullPath: "/v1/terminal/readers/{reader}/collect_payment_method" }), confirmPaymentIntent: le({ method: "POST", fullPath: "/v1/terminal/readers/{reader}/confirm_payment_intent" }), processPaymentIntent: le({ method: "POST", fullPath: "/v1/terminal/readers/{reader}/process_payment_intent" }), processSetupIntent: le({ method: "POST", fullPath: "/v1/terminal/readers/{reader}/process_setup_intent" }), refundPayment: le({ method: "POST", fullPath: "/v1/terminal/readers/{reader}/refund_payment" }), setReaderDisplay: le({ method: "POST", fullPath: "/v1/terminal/readers/{reader}/set_reader_display" }) });
var qr = p.method;
var Kp = p.extend({ presentPaymentMethod: qr({ method: "POST", fullPath: "/v1/test_helpers/terminal/readers/{reader}/present_payment_method" }), succeedInputCollection: qr({ method: "POST", fullPath: "/v1/test_helpers/terminal/readers/{reader}/succeed_input_collection" }), timeoutInputCollection: qr({ method: "POST", fullPath: "/v1/test_helpers/terminal/readers/{reader}/timeout_input_collection" }) });
var Gp = p.method;
var Vp = p.extend({ create: Gp({ method: "POST", fullPath: "/v1/test_helpers/treasury/received_credits" }) });
var un = p.method;
var Jp = p.extend({ retrieve: un({ method: "GET", fullPath: "/v1/treasury/received_credits/{id}" }), list: un({ method: "GET", fullPath: "/v1/treasury/received_credits", methodType: "list" }) });
var Yp = p.method;
var zp = p.extend({ create: Yp({ method: "POST", fullPath: "/v1/test_helpers/treasury/received_debits" }) });
var dn = p.method;
var Xp = p.extend({ retrieve: dn({ method: "GET", fullPath: "/v1/treasury/received_debits/{id}" }), list: dn({ method: "GET", fullPath: "/v1/treasury/received_debits", methodType: "list" }) });
var Qp = p.method;
var Zp = p.extend({ expire: Qp({ method: "POST", fullPath: "/v1/test_helpers/refunds/{refund}/expire" }) });
var Ws = p.method;
var em = p.extend({ create: Ws({ method: "POST", fullPath: "/v1/tax/registrations" }), retrieve: Ws({ method: "GET", fullPath: "/v1/tax/registrations/{id}" }), update: Ws({ method: "POST", fullPath: "/v1/tax/registrations/{id}" }), list: Ws({ method: "GET", fullPath: "/v1/tax/registrations", methodType: "list" }) });
var Hr = p.method;
var tm = p.extend({ create: Hr({ method: "POST", fullPath: "/v1/reporting/report_runs" }), retrieve: Hr({ method: "GET", fullPath: "/v1/reporting/report_runs/{report_run}" }), list: Hr({ method: "GET", fullPath: "/v1/reporting/report_runs", methodType: "list" }) });
var pn = p.method;
var sm = p.extend({ retrieve: pn({ method: "GET", fullPath: "/v1/reporting/report_types/{report_type}" }), list: pn({ method: "GET", fullPath: "/v1/reporting/report_types", methodType: "list" }) });
var Wr = p.method;
var rm = p.extend({ create: Wr({ method: "POST", fullPath: "/v1/forwarding/requests" }), retrieve: Wr({ method: "GET", fullPath: "/v1/forwarding/requests/{id}" }), list: Wr({ method: "GET", fullPath: "/v1/forwarding/requests", methodType: "list" }) });
var mn = p.method;
var am = p.extend({ retrieve: mn({ method: "GET", fullPath: "/v1/sigma/scheduled_query_runs/{scheduled_query_run}" }), list: mn({ method: "GET", fullPath: "/v1/sigma/scheduled_query_runs", methodType: "list" }) });
var Bs = p.method;
var nm = p.extend({ create: Bs({ method: "POST", fullPath: "/v1/apps/secrets" }), list: Bs({ method: "GET", fullPath: "/v1/apps/secrets", methodType: "list" }), deleteWhere: Bs({ method: "POST", fullPath: "/v1/apps/secrets/delete" }), find: Bs({ method: "GET", fullPath: "/v1/apps/secrets/find" }) });
var om = p.method;
var im = p.extend({ create: om({ method: "POST", fullPath: "/v1/billing_portal/sessions" }) });
var Et = p.method;
var cm = p.extend({ create: Et({ method: "POST", fullPath: "/v1/checkout/sessions" }), retrieve: Et({ method: "GET", fullPath: "/v1/checkout/sessions/{session}" }), update: Et({ method: "POST", fullPath: "/v1/checkout/sessions/{session}" }), list: Et({ method: "GET", fullPath: "/v1/checkout/sessions", methodType: "list" }), expire: Et({ method: "POST", fullPath: "/v1/checkout/sessions/{session}/expire" }), listLineItems: Et({ method: "GET", fullPath: "/v1/checkout/sessions/{session}/line_items", methodType: "list" }) });
var fn = p.method;
var lm = p.extend({ create: fn({ method: "POST", fullPath: "/v1/financial_connections/sessions" }), retrieve: fn({ method: "GET", fullPath: "/v1/financial_connections/sessions/{session}" }) });
var hn = p.method;
var um = p.extend({ retrieve: hn({ method: "GET", fullPath: "/v1/tax/settings" }), update: hn({ method: "POST", fullPath: "/v1/tax/settings" }) });
var _n = p.method;
var dm = p.extend({ retrieve: _n({ method: "GET", fullPath: "/v1/climate/suppliers/{supplier}" }), list: _n({ method: "GET", fullPath: "/v1/climate/suppliers", methodType: "list" }) });
var Qt = p.method;
var pm = p.extend({ create: Qt({ method: "POST", fullPath: "/v1/test_helpers/test_clocks" }), retrieve: Qt({ method: "GET", fullPath: "/v1/test_helpers/test_clocks/{test_clock}" }), list: Qt({ method: "GET", fullPath: "/v1/test_helpers/test_clocks", methodType: "list" }), del: Qt({ method: "DELETE", fullPath: "/v1/test_helpers/test_clocks/{test_clock}" }), advance: Qt({ method: "POST", fullPath: "/v1/test_helpers/test_clocks/{test_clock}/advance" }) });
var Br = p.method;
var mm = p.extend({ retrieve: Br({ method: "GET", fullPath: "/v1/issuing/tokens/{token}" }), update: Br({ method: "POST", fullPath: "/v1/issuing/tokens/{token}" }), list: Br({ method: "GET", fullPath: "/v1/issuing/tokens", methodType: "list" }) });
var En = p.method;
var fm = p.extend({ retrieve: En({ method: "GET", fullPath: "/v1/treasury/transaction_entries/{id}" }), list: En({ method: "GET", fullPath: "/v1/treasury/transaction_entries", methodType: "list" }) });
var gn = p.method;
var hm = p.extend({ retrieve: gn({ method: "GET", fullPath: "/v1/financial_connections/transactions/{transaction}" }), list: gn({ method: "GET", fullPath: "/v1/financial_connections/transactions", methodType: "list" }) });
var Kr = p.method;
var _m = p.extend({ retrieve: Kr({ method: "GET", fullPath: "/v1/issuing/transactions/{transaction}" }), update: Kr({ method: "POST", fullPath: "/v1/issuing/transactions/{transaction}" }), list: Kr({ method: "GET", fullPath: "/v1/issuing/transactions", methodType: "list" }) });
var Ks = p.method;
var Em = p.extend({ retrieve: Ks({ method: "GET", fullPath: "/v1/tax/transactions/{transaction}" }), createFromCalculation: Ks({ method: "POST", fullPath: "/v1/tax/transactions/create_from_calculation" }), createReversal: Ks({ method: "POST", fullPath: "/v1/tax/transactions/create_reversal" }), listLineItems: Ks({ method: "GET", fullPath: "/v1/tax/transactions/{transaction}/line_items", methodType: "list" }) });
var Gr = p.method;
var gm = p.extend({ createForceCapture: Gr({ method: "POST", fullPath: "/v1/test_helpers/issuing/transactions/create_force_capture" }), createUnlinkedRefund: Gr({ method: "POST", fullPath: "/v1/test_helpers/issuing/transactions/create_unlinked_refund" }), refund: Gr({ method: "POST", fullPath: "/v1/test_helpers/issuing/transactions/{transaction}/refund" }) });
var yn = p.method;
var ym = p.extend({ retrieve: yn({ method: "GET", fullPath: "/v1/treasury/transactions/{id}" }), list: yn({ method: "GET", fullPath: "/v1/treasury/transactions", methodType: "list" }) });
var Gs = p.method;
var bm = p.extend({ create: Gs({ method: "POST", fullPath: "/v1/radar/value_list_items" }), retrieve: Gs({ method: "GET", fullPath: "/v1/radar/value_list_items/{item}" }), list: Gs({ method: "GET", fullPath: "/v1/radar/value_list_items", methodType: "list" }), del: Gs({ method: "DELETE", fullPath: "/v1/radar/value_list_items/{item}" }) });
var Zt = p.method;
var Tm = p.extend({ create: Zt({ method: "POST", fullPath: "/v1/radar/value_lists" }), retrieve: Zt({ method: "GET", fullPath: "/v1/radar/value_lists/{value_list}" }), update: Zt({ method: "POST", fullPath: "/v1/radar/value_lists/{value_list}" }), list: Zt({ method: "GET", fullPath: "/v1/radar/value_lists", methodType: "list" }), del: Zt({ method: "DELETE", fullPath: "/v1/radar/value_lists/{value_list}" }) });
var bn = p.method;
var vm = p.extend({ retrieve: bn({ method: "GET", fullPath: "/v1/identity/verification_reports/{report}" }), list: bn({ method: "GET", fullPath: "/v1/identity/verification_reports", methodType: "list" }) });
var gt = p.method;
var Sm = p.extend({ create: gt({ method: "POST", fullPath: "/v1/identity/verification_sessions" }), retrieve: gt({ method: "GET", fullPath: "/v1/identity/verification_sessions/{session}" }), update: gt({ method: "POST", fullPath: "/v1/identity/verification_sessions/{session}" }), list: gt({ method: "GET", fullPath: "/v1/identity/verification_sessions", methodType: "list" }), cancel: gt({ method: "POST", fullPath: "/v1/identity/verification_sessions/{session}/cancel" }), redact: gt({ method: "POST", fullPath: "/v1/identity/verification_sessions/{session}/redact" }) });
var G = p.method;
var Tn = p.extend({ create: G({ method: "POST", fullPath: "/v1/accounts" }), retrieve(e, ...t) {
  return typeof e == "string" ? G({ method: "GET", fullPath: "/v1/accounts/{id}" }).apply(this, [e, ...t]) : (e == null && [].shift.apply([e, ...t]), G({ method: "GET", fullPath: "/v1/account" }).apply(this, [e, ...t]));
}, update: G({ method: "POST", fullPath: "/v1/accounts/{account}" }), list: G({ method: "GET", fullPath: "/v1/accounts", methodType: "list" }), del: G({ method: "DELETE", fullPath: "/v1/accounts/{account}" }), createExternalAccount: G({ method: "POST", fullPath: "/v1/accounts/{account}/external_accounts" }), createLoginLink: G({ method: "POST", fullPath: "/v1/accounts/{account}/login_links" }), createPerson: G({ method: "POST", fullPath: "/v1/accounts/{account}/persons" }), deleteExternalAccount: G({ method: "DELETE", fullPath: "/v1/accounts/{account}/external_accounts/{id}" }), deletePerson: G({ method: "DELETE", fullPath: "/v1/accounts/{account}/persons/{person}" }), listCapabilities: G({ method: "GET", fullPath: "/v1/accounts/{account}/capabilities", methodType: "list" }), listExternalAccounts: G({ method: "GET", fullPath: "/v1/accounts/{account}/external_accounts", methodType: "list" }), listPersons: G({ method: "GET", fullPath: "/v1/accounts/{account}/persons", methodType: "list" }), reject: G({ method: "POST", fullPath: "/v1/accounts/{account}/reject" }), retrieveCurrent: G({ method: "GET", fullPath: "/v1/account" }), retrieveCapability: G({ method: "GET", fullPath: "/v1/accounts/{account}/capabilities/{capability}" }), retrieveExternalAccount: G({ method: "GET", fullPath: "/v1/accounts/{account}/external_accounts/{id}" }), retrievePerson: G({ method: "GET", fullPath: "/v1/accounts/{account}/persons/{person}" }), updateCapability: G({ method: "POST", fullPath: "/v1/accounts/{account}/capabilities/{capability}" }), updateExternalAccount: G({ method: "POST", fullPath: "/v1/accounts/{account}/external_accounts/{id}" }), updatePerson: G({ method: "POST", fullPath: "/v1/accounts/{account}/persons/{person}" }) });
var wm = p.method;
var xm = p.extend({ create: wm({ method: "POST", fullPath: "/v1/account_links" }) });
var Rm = p.method;
var Im = p.extend({ create: Rm({ method: "POST", fullPath: "/v1/account_sessions" }) });
var Vs = p.method;
var Pm = p.extend({ create: Vs({ method: "POST", fullPath: "/v1/apple_pay/domains" }), retrieve: Vs({ method: "GET", fullPath: "/v1/apple_pay/domains/{domain}" }), list: Vs({ method: "GET", fullPath: "/v1/apple_pay/domains", methodType: "list" }), del: Vs({ method: "DELETE", fullPath: "/v1/apple_pay/domains/{domain}" }) });
var yt = p.method;
var Om = p.extend({ retrieve: yt({ method: "GET", fullPath: "/v1/application_fees/{id}" }), list: yt({ method: "GET", fullPath: "/v1/application_fees", methodType: "list" }), createRefund: yt({ method: "POST", fullPath: "/v1/application_fees/{id}/refunds" }), listRefunds: yt({ method: "GET", fullPath: "/v1/application_fees/{id}/refunds", methodType: "list" }), retrieveRefund: yt({ method: "GET", fullPath: "/v1/application_fees/{fee}/refunds/{id}" }), updateRefund: yt({ method: "POST", fullPath: "/v1/application_fees/{fee}/refunds/{id}" }) });
var Am = p.method;
var Cm = p.extend({ retrieve: Am({ method: "GET", fullPath: "/v1/balance" }) });
var vn = p.method;
var Dm = p.extend({ retrieve: vn({ method: "GET", fullPath: "/v1/balance_settings" }), update: vn({ method: "POST", fullPath: "/v1/balance_settings" }) });
var Sn = p.method;
var km = p.extend({ retrieve: Sn({ method: "GET", fullPath: "/v1/balance_transactions/{id}" }), list: Sn({ method: "GET", fullPath: "/v1/balance_transactions", methodType: "list" }) });
var bt = p.method;
var Nm = p.extend({ create: bt({ method: "POST", fullPath: "/v1/charges" }), retrieve: bt({ method: "GET", fullPath: "/v1/charges/{charge}" }), update: bt({ method: "POST", fullPath: "/v1/charges/{charge}" }), list: bt({ method: "GET", fullPath: "/v1/charges", methodType: "list" }), capture: bt({ method: "POST", fullPath: "/v1/charges/{charge}/capture" }), search: bt({ method: "GET", fullPath: "/v1/charges/search", methodType: "search" }) });
var jm = p.method;
var Mm = p.extend({ retrieve: jm({ method: "GET", fullPath: "/v1/confirmation_tokens/{confirmation_token}" }) });
var wn = p.method;
var Lm = p.extend({ retrieve: wn({ method: "GET", fullPath: "/v1/country_specs/{country}" }), list: wn({ method: "GET", fullPath: "/v1/country_specs", methodType: "list" }) });
var es = p.method;
var $m = p.extend({ create: es({ method: "POST", fullPath: "/v1/coupons" }), retrieve: es({ method: "GET", fullPath: "/v1/coupons/{coupon}" }), update: es({ method: "POST", fullPath: "/v1/coupons/{coupon}" }), list: es({ method: "GET", fullPath: "/v1/coupons", methodType: "list" }), del: es({ method: "DELETE", fullPath: "/v1/coupons/{coupon}" }) });
var Me = p.method;
var Fm = p.extend({ create: Me({ method: "POST", fullPath: "/v1/credit_notes" }), retrieve: Me({ method: "GET", fullPath: "/v1/credit_notes/{id}" }), update: Me({ method: "POST", fullPath: "/v1/credit_notes/{id}" }), list: Me({ method: "GET", fullPath: "/v1/credit_notes", methodType: "list" }), listLineItems: Me({ method: "GET", fullPath: "/v1/credit_notes/{credit_note}/lines", methodType: "list" }), listPreviewLineItems: Me({ method: "GET", fullPath: "/v1/credit_notes/preview/lines", methodType: "list" }), preview: Me({ method: "GET", fullPath: "/v1/credit_notes/preview" }), voidCreditNote: Me({ method: "POST", fullPath: "/v1/credit_notes/{id}/void" }) });
var Um = p.method;
var qm = p.extend({ create: Um({ method: "POST", fullPath: "/v1/customer_sessions" }) });
var $ = p.method;
var Hm = p.extend({ create: $({ method: "POST", fullPath: "/v1/customers" }), retrieve: $({ method: "GET", fullPath: "/v1/customers/{customer}" }), update: $({ method: "POST", fullPath: "/v1/customers/{customer}" }), list: $({ method: "GET", fullPath: "/v1/customers", methodType: "list" }), del: $({ method: "DELETE", fullPath: "/v1/customers/{customer}" }), createBalanceTransaction: $({ method: "POST", fullPath: "/v1/customers/{customer}/balance_transactions" }), createFundingInstructions: $({ method: "POST", fullPath: "/v1/customers/{customer}/funding_instructions" }), createSource: $({ method: "POST", fullPath: "/v1/customers/{customer}/sources" }), createTaxId: $({ method: "POST", fullPath: "/v1/customers/{customer}/tax_ids" }), deleteDiscount: $({ method: "DELETE", fullPath: "/v1/customers/{customer}/discount" }), deleteSource: $({ method: "DELETE", fullPath: "/v1/customers/{customer}/sources/{id}" }), deleteTaxId: $({ method: "DELETE", fullPath: "/v1/customers/{customer}/tax_ids/{id}" }), listBalanceTransactions: $({ method: "GET", fullPath: "/v1/customers/{customer}/balance_transactions", methodType: "list" }), listCashBalanceTransactions: $({ method: "GET", fullPath: "/v1/customers/{customer}/cash_balance_transactions", methodType: "list" }), listPaymentMethods: $({ method: "GET", fullPath: "/v1/customers/{customer}/payment_methods", methodType: "list" }), listSources: $({ method: "GET", fullPath: "/v1/customers/{customer}/sources", methodType: "list" }), listTaxIds: $({ method: "GET", fullPath: "/v1/customers/{customer}/tax_ids", methodType: "list" }), retrieveBalanceTransaction: $({ method: "GET", fullPath: "/v1/customers/{customer}/balance_transactions/{transaction}" }), retrieveCashBalance: $({ method: "GET", fullPath: "/v1/customers/{customer}/cash_balance" }), retrieveCashBalanceTransaction: $({ method: "GET", fullPath: "/v1/customers/{customer}/cash_balance_transactions/{transaction}" }), retrievePaymentMethod: $({ method: "GET", fullPath: "/v1/customers/{customer}/payment_methods/{payment_method}" }), retrieveSource: $({ method: "GET", fullPath: "/v1/customers/{customer}/sources/{id}" }), retrieveTaxId: $({ method: "GET", fullPath: "/v1/customers/{customer}/tax_ids/{id}" }), search: $({ method: "GET", fullPath: "/v1/customers/search", methodType: "search" }), updateBalanceTransaction: $({ method: "POST", fullPath: "/v1/customers/{customer}/balance_transactions/{transaction}" }), updateCashBalance: $({ method: "POST", fullPath: "/v1/customers/{customer}/cash_balance" }), updateSource: $({ method: "POST", fullPath: "/v1/customers/{customer}/sources/{id}" }), verifySource: $({ method: "POST", fullPath: "/v1/customers/{customer}/sources/{id}/verify" }) });
var Js = p.method;
var Wm = p.extend({ retrieve: Js({ method: "GET", fullPath: "/v1/disputes/{dispute}" }), update: Js({ method: "POST", fullPath: "/v1/disputes/{dispute}" }), list: Js({ method: "GET", fullPath: "/v1/disputes", methodType: "list" }), close: Js({ method: "POST", fullPath: "/v1/disputes/{dispute}/close" }) });
var xn = p.method;
var Bm = p.extend({ create: xn({ method: "POST", fullPath: "/v1/ephemeral_keys", validator: /* @__PURE__ */ __name((e, t) => {
  if (!t.headers || !t.headers["Stripe-Version"]) throw new Error("Passing apiVersion in a separate options hash is required to create an ephemeral key. See https://stripe.com/docs/api/versioning?lang=node");
}, "validator") }), del: xn({ method: "DELETE", fullPath: "/v1/ephemeral_keys/{key}" }) });
var Rn = p.method;
var Km = p.extend({ retrieve: Rn({ method: "GET", fullPath: "/v1/events/{id}" }), list: Rn({ method: "GET", fullPath: "/v1/events", methodType: "list" }) });
var In = p.method;
var Gm = p.extend({ retrieve: In({ method: "GET", fullPath: "/v1/exchange_rates/{rate_id}" }), list: In({ method: "GET", fullPath: "/v1/exchange_rates", methodType: "list" }) });
var Ys = p.method;
var Vm = p.extend({ create: Ys({ method: "POST", fullPath: "/v1/file_links" }), retrieve: Ys({ method: "GET", fullPath: "/v1/file_links/{link}" }), update: Ys({ method: "POST", fullPath: "/v1/file_links/{link}" }), list: Ys({ method: "GET", fullPath: "/v1/file_links", methodType: "list" }) });
var Jm = /* @__PURE__ */ __name((e, t, s) => {
  const r = (Math.round(Math.random() * 1e16) + Math.round(Math.random() * 1e16)).toString();
  s["Content-Type"] = `multipart/form-data; boundary=${r}`;
  const a = new TextEncoder();
  let n = new Uint8Array(0);
  const o = a.encode(`\r
`);
  function i(u) {
    const d = n, m = u instanceof Uint8Array ? u : new Uint8Array(a.encode(u));
    n = new Uint8Array(d.length + m.length + 2), n.set(d), n.set(m, d.length), n.set(o, n.length - 2);
  }
  __name(i, "i");
  function c(u) {
    return `"${u.replace(/"|"/g, "%22").replace(/\r\n|\r|\n/g, " ")}"`;
  }
  __name(c, "c");
  const l = od(t);
  for (const u in l) {
    if (!Object.prototype.hasOwnProperty.call(l, u)) continue;
    const d = l[u];
    if (i(`--${r}`), Object.prototype.hasOwnProperty.call(d, "data")) {
      const m = d;
      i(`Content-Disposition: form-data; name=${c(u)}; filename=${c(m.name || "blob")}`), i(`Content-Type: ${m.type || "application/octet-stream"}`), i(""), i(m.data);
    } else i(`Content-Disposition: form-data; name=${c(u)}`), i(""), i(d);
  }
  return i(`--${r}--`), n;
}, "Jm");
function Ym(e, t, s, r) {
  if (t = t || {}, e !== "POST") return r(null, Tr(t));
  this._stripe._platformFunctions.tryBufferData(t).then((a) => {
    const n = Jm(e, a, s);
    return r(null, n);
  }).catch((a) => r(a, null));
}
__name(Ym, "Ym");
var Vr = p.method;
var zm = p.extend({ create: Vr({ method: "POST", fullPath: "/v1/files", headers: { "Content-Type": "multipart/form-data" }, host: "files.stripe.com" }), retrieve: Vr({ method: "GET", fullPath: "/v1/files/{file}" }), list: Vr({ method: "GET", fullPath: "/v1/files", methodType: "list" }), requestDataProcessor: Ym });
var ts = p.method;
var Xm = p.extend({ create: ts({ method: "POST", fullPath: "/v1/invoiceitems" }), retrieve: ts({ method: "GET", fullPath: "/v1/invoiceitems/{invoiceitem}" }), update: ts({ method: "POST", fullPath: "/v1/invoiceitems/{invoiceitem}" }), list: ts({ method: "GET", fullPath: "/v1/invoiceitems", methodType: "list" }), del: ts({ method: "DELETE", fullPath: "/v1/invoiceitems/{invoiceitem}" }) });
var Pn = p.method;
var Qm = p.extend({ retrieve: Pn({ method: "GET", fullPath: "/v1/invoice_payments/{invoice_payment}" }), list: Pn({ method: "GET", fullPath: "/v1/invoice_payments", methodType: "list" }) });
var zs = p.method;
var Zm = p.extend({ retrieve: zs({ method: "GET", fullPath: "/v1/invoice_rendering_templates/{template}" }), list: zs({ method: "GET", fullPath: "/v1/invoice_rendering_templates", methodType: "list" }), archive: zs({ method: "POST", fullPath: "/v1/invoice_rendering_templates/{template}/archive" }), unarchive: zs({ method: "POST", fullPath: "/v1/invoice_rendering_templates/{template}/unarchive" }) });
var Z = p.method;
var ef = p.extend({ create: Z({ method: "POST", fullPath: "/v1/invoices" }), retrieve: Z({ method: "GET", fullPath: "/v1/invoices/{invoice}" }), update: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}" }), list: Z({ method: "GET", fullPath: "/v1/invoices", methodType: "list" }), del: Z({ method: "DELETE", fullPath: "/v1/invoices/{invoice}" }), addLines: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/add_lines" }), attachPayment: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/attach_payment" }), createPreview: Z({ method: "POST", fullPath: "/v1/invoices/create_preview" }), finalizeInvoice: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/finalize" }), listLineItems: Z({ method: "GET", fullPath: "/v1/invoices/{invoice}/lines", methodType: "list" }), markUncollectible: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/mark_uncollectible" }), pay: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/pay" }), removeLines: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/remove_lines" }), search: Z({ method: "GET", fullPath: "/v1/invoices/search", methodType: "search" }), sendInvoice: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/send" }), updateLines: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/update_lines" }), updateLineItem: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/lines/{line_item_id}" }), voidInvoice: Z({ method: "POST", fullPath: "/v1/invoices/{invoice}/void" }) });
var tf = p.method;
var sf = p.extend({ retrieve: tf({ method: "GET", fullPath: "/v1/mandates/{mandate}" }) });
var On = p.method;
var Jr = "connect.stripe.com";
var rf = p.extend({ basePath: "/", authorizeUrl(e, t) {
  e = e || {}, t = t || {};
  let s = "oauth/authorize";
  return t.express && (s = `express/${s}`), e.response_type || (e.response_type = "code"), e.client_id || (e.client_id = this._stripe.getClientId()), e.scope || (e.scope = "read_write"), `https://${Jr}/${s}?${Tr(e)}`;
}, token: On({ method: "POST", path: "oauth/token", host: Jr }), deauthorize(e, ...t) {
  return e.client_id || (e.client_id = this._stripe.getClientId()), On({ method: "POST", path: "oauth/deauthorize", host: Jr }).apply(this, [e, ...t]);
} });
var An = p.method;
var af = p.extend({ retrieve: An({ method: "GET", fullPath: "/v1/payment_attempt_records/{id}" }), list: An({ method: "GET", fullPath: "/v1/payment_attempt_records", methodType: "list" }) });
var ue = p.method;
var nf = p.extend({ create: ue({ method: "POST", fullPath: "/v1/payment_intents" }), retrieve: ue({ method: "GET", fullPath: "/v1/payment_intents/{intent}" }), update: ue({ method: "POST", fullPath: "/v1/payment_intents/{intent}" }), list: ue({ method: "GET", fullPath: "/v1/payment_intents", methodType: "list" }), applyCustomerBalance: ue({ method: "POST", fullPath: "/v1/payment_intents/{intent}/apply_customer_balance" }), cancel: ue({ method: "POST", fullPath: "/v1/payment_intents/{intent}/cancel" }), capture: ue({ method: "POST", fullPath: "/v1/payment_intents/{intent}/capture" }), confirm: ue({ method: "POST", fullPath: "/v1/payment_intents/{intent}/confirm" }), incrementAuthorization: ue({ method: "POST", fullPath: "/v1/payment_intents/{intent}/increment_authorization" }), listAmountDetailsLineItems: ue({ method: "GET", fullPath: "/v1/payment_intents/{intent}/amount_details_line_items", methodType: "list" }), search: ue({ method: "GET", fullPath: "/v1/payment_intents/search", methodType: "search" }), verifyMicrodeposits: ue({ method: "POST", fullPath: "/v1/payment_intents/{intent}/verify_microdeposits" }) });
var ss = p.method;
var of = p.extend({ create: ss({ method: "POST", fullPath: "/v1/payment_links" }), retrieve: ss({ method: "GET", fullPath: "/v1/payment_links/{payment_link}" }), update: ss({ method: "POST", fullPath: "/v1/payment_links/{payment_link}" }), list: ss({ method: "GET", fullPath: "/v1/payment_links", methodType: "list" }), listLineItems: ss({ method: "GET", fullPath: "/v1/payment_links/{payment_link}/line_items", methodType: "list" }) });
var Xs = p.method;
var cf = p.extend({ create: Xs({ method: "POST", fullPath: "/v1/payment_method_configurations" }), retrieve: Xs({ method: "GET", fullPath: "/v1/payment_method_configurations/{configuration}" }), update: Xs({ method: "POST", fullPath: "/v1/payment_method_configurations/{configuration}" }), list: Xs({ method: "GET", fullPath: "/v1/payment_method_configurations", methodType: "list" }) });
var rs = p.method;
var lf = p.extend({ create: rs({ method: "POST", fullPath: "/v1/payment_method_domains" }), retrieve: rs({ method: "GET", fullPath: "/v1/payment_method_domains/{payment_method_domain}" }), update: rs({ method: "POST", fullPath: "/v1/payment_method_domains/{payment_method_domain}" }), list: rs({ method: "GET", fullPath: "/v1/payment_method_domains", methodType: "list" }), validate: rs({ method: "POST", fullPath: "/v1/payment_method_domains/{payment_method_domain}/validate" }) });
var Tt = p.method;
var uf = p.extend({ create: Tt({ method: "POST", fullPath: "/v1/payment_methods" }), retrieve: Tt({ method: "GET", fullPath: "/v1/payment_methods/{payment_method}" }), update: Tt({ method: "POST", fullPath: "/v1/payment_methods/{payment_method}" }), list: Tt({ method: "GET", fullPath: "/v1/payment_methods", methodType: "list" }), attach: Tt({ method: "POST", fullPath: "/v1/payment_methods/{payment_method}/attach" }), detach: Tt({ method: "POST", fullPath: "/v1/payment_methods/{payment_method}/detach" }) });
var Le = p.method;
var df = p.extend({ retrieve: Le({ method: "GET", fullPath: "/v1/payment_records/{id}" }), reportPayment: Le({ method: "POST", fullPath: "/v1/payment_records/report_payment" }), reportPaymentAttempt: Le({ method: "POST", fullPath: "/v1/payment_records/{id}/report_payment_attempt" }), reportPaymentAttemptCanceled: Le({ method: "POST", fullPath: "/v1/payment_records/{id}/report_payment_attempt_canceled" }), reportPaymentAttemptFailed: Le({ method: "POST", fullPath: "/v1/payment_records/{id}/report_payment_attempt_failed" }), reportPaymentAttemptGuaranteed: Le({ method: "POST", fullPath: "/v1/payment_records/{id}/report_payment_attempt_guaranteed" }), reportPaymentAttemptInformational: Le({ method: "POST", fullPath: "/v1/payment_records/{id}/report_payment_attempt_informational" }), reportRefund: Le({ method: "POST", fullPath: "/v1/payment_records/{id}/report_refund" }) });
var vt = p.method;
var pf = p.extend({ create: vt({ method: "POST", fullPath: "/v1/payouts" }), retrieve: vt({ method: "GET", fullPath: "/v1/payouts/{payout}" }), update: vt({ method: "POST", fullPath: "/v1/payouts/{payout}" }), list: vt({ method: "GET", fullPath: "/v1/payouts", methodType: "list" }), cancel: vt({ method: "POST", fullPath: "/v1/payouts/{payout}/cancel" }), reverse: vt({ method: "POST", fullPath: "/v1/payouts/{payout}/reverse" }) });
var as = p.method;
var mf = p.extend({ create: as({ method: "POST", fullPath: "/v1/plans" }), retrieve: as({ method: "GET", fullPath: "/v1/plans/{plan}" }), update: as({ method: "POST", fullPath: "/v1/plans/{plan}" }), list: as({ method: "GET", fullPath: "/v1/plans", methodType: "list" }), del: as({ method: "DELETE", fullPath: "/v1/plans/{plan}" }) });
var ns = p.method;
var ff = p.extend({ create: ns({ method: "POST", fullPath: "/v1/prices" }), retrieve: ns({ method: "GET", fullPath: "/v1/prices/{price}" }), update: ns({ method: "POST", fullPath: "/v1/prices/{price}" }), list: ns({ method: "GET", fullPath: "/v1/prices", methodType: "list" }), search: ns({ method: "GET", fullPath: "/v1/prices/search", methodType: "search" }) });
var ve = p.method;
var hf = p.extend({ create: ve({ method: "POST", fullPath: "/v1/products" }), retrieve: ve({ method: "GET", fullPath: "/v1/products/{id}" }), update: ve({ method: "POST", fullPath: "/v1/products/{id}" }), list: ve({ method: "GET", fullPath: "/v1/products", methodType: "list" }), del: ve({ method: "DELETE", fullPath: "/v1/products/{id}" }), createFeature: ve({ method: "POST", fullPath: "/v1/products/{product}/features" }), deleteFeature: ve({ method: "DELETE", fullPath: "/v1/products/{product}/features/{id}" }), listFeatures: ve({ method: "GET", fullPath: "/v1/products/{product}/features", methodType: "list" }), retrieveFeature: ve({ method: "GET", fullPath: "/v1/products/{product}/features/{id}" }), search: ve({ method: "GET", fullPath: "/v1/products/search", methodType: "search" }) });
var Qs = p.method;
var _f = p.extend({ create: Qs({ method: "POST", fullPath: "/v1/promotion_codes" }), retrieve: Qs({ method: "GET", fullPath: "/v1/promotion_codes/{promotion_code}" }), update: Qs({ method: "POST", fullPath: "/v1/promotion_codes/{promotion_code}" }), list: Qs({ method: "GET", fullPath: "/v1/promotion_codes", methodType: "list" }) });
var Se = p.method;
var Ef = p.extend({ create: Se({ method: "POST", fullPath: "/v1/quotes" }), retrieve: Se({ method: "GET", fullPath: "/v1/quotes/{quote}" }), update: Se({ method: "POST", fullPath: "/v1/quotes/{quote}" }), list: Se({ method: "GET", fullPath: "/v1/quotes", methodType: "list" }), accept: Se({ method: "POST", fullPath: "/v1/quotes/{quote}/accept" }), cancel: Se({ method: "POST", fullPath: "/v1/quotes/{quote}/cancel" }), finalizeQuote: Se({ method: "POST", fullPath: "/v1/quotes/{quote}/finalize" }), listComputedUpfrontLineItems: Se({ method: "GET", fullPath: "/v1/quotes/{quote}/computed_upfront_line_items", methodType: "list" }), listLineItems: Se({ method: "GET", fullPath: "/v1/quotes/{quote}/line_items", methodType: "list" }), pdf: Se({ method: "GET", fullPath: "/v1/quotes/{quote}/pdf", host: "files.stripe.com", streaming: true }) });
var os = p.method;
var gf = p.extend({ create: os({ method: "POST", fullPath: "/v1/refunds" }), retrieve: os({ method: "GET", fullPath: "/v1/refunds/{refund}" }), update: os({ method: "POST", fullPath: "/v1/refunds/{refund}" }), list: os({ method: "GET", fullPath: "/v1/refunds", methodType: "list" }), cancel: os({ method: "POST", fullPath: "/v1/refunds/{refund}/cancel" }) });
var Yr = p.method;
var yf = p.extend({ retrieve: Yr({ method: "GET", fullPath: "/v1/reviews/{review}" }), list: Yr({ method: "GET", fullPath: "/v1/reviews", methodType: "list" }), approve: Yr({ method: "POST", fullPath: "/v1/reviews/{review}/approve" }) });
var bf = p.method;
var Tf = p.extend({ list: bf({ method: "GET", fullPath: "/v1/setup_attempts", methodType: "list" }) });
var Xe = p.method;
var vf = p.extend({ create: Xe({ method: "POST", fullPath: "/v1/setup_intents" }), retrieve: Xe({ method: "GET", fullPath: "/v1/setup_intents/{intent}" }), update: Xe({ method: "POST", fullPath: "/v1/setup_intents/{intent}" }), list: Xe({ method: "GET", fullPath: "/v1/setup_intents", methodType: "list" }), cancel: Xe({ method: "POST", fullPath: "/v1/setup_intents/{intent}/cancel" }), confirm: Xe({ method: "POST", fullPath: "/v1/setup_intents/{intent}/confirm" }), verifyMicrodeposits: Xe({ method: "POST", fullPath: "/v1/setup_intents/{intent}/verify_microdeposits" }) });
var Zs = p.method;
var Sf = p.extend({ create: Zs({ method: "POST", fullPath: "/v1/shipping_rates" }), retrieve: Zs({ method: "GET", fullPath: "/v1/shipping_rates/{shipping_rate_token}" }), update: Zs({ method: "POST", fullPath: "/v1/shipping_rates/{shipping_rate_token}" }), list: Zs({ method: "GET", fullPath: "/v1/shipping_rates", methodType: "list" }) });
var is = p.method;
var wf = p.extend({ create: is({ method: "POST", fullPath: "/v1/sources" }), retrieve: is({ method: "GET", fullPath: "/v1/sources/{source}" }), update: is({ method: "POST", fullPath: "/v1/sources/{source}" }), listSourceTransactions: is({ method: "GET", fullPath: "/v1/sources/{source}/source_transactions", methodType: "list" }), verify: is({ method: "POST", fullPath: "/v1/sources/{source}/verify" }) });
var cs = p.method;
var xf = p.extend({ create: cs({ method: "POST", fullPath: "/v1/subscription_items" }), retrieve: cs({ method: "GET", fullPath: "/v1/subscription_items/{item}" }), update: cs({ method: "POST", fullPath: "/v1/subscription_items/{item}" }), list: cs({ method: "GET", fullPath: "/v1/subscription_items", methodType: "list" }), del: cs({ method: "DELETE", fullPath: "/v1/subscription_items/{item}" }) });
var St = p.method;
var Rf = p.extend({ create: St({ method: "POST", fullPath: "/v1/subscription_schedules" }), retrieve: St({ method: "GET", fullPath: "/v1/subscription_schedules/{schedule}" }), update: St({ method: "POST", fullPath: "/v1/subscription_schedules/{schedule}" }), list: St({ method: "GET", fullPath: "/v1/subscription_schedules", methodType: "list" }), cancel: St({ method: "POST", fullPath: "/v1/subscription_schedules/{schedule}/cancel" }), release: St({ method: "POST", fullPath: "/v1/subscription_schedules/{schedule}/release" }) });
var Re = p.method;
var If = p.extend({ create: Re({ method: "POST", fullPath: "/v1/subscriptions" }), retrieve: Re({ method: "GET", fullPath: "/v1/subscriptions/{subscription_exposed_id}" }), update: Re({ method: "POST", fullPath: "/v1/subscriptions/{subscription_exposed_id}" }), list: Re({ method: "GET", fullPath: "/v1/subscriptions", methodType: "list" }), cancel: Re({ method: "DELETE", fullPath: "/v1/subscriptions/{subscription_exposed_id}" }), deleteDiscount: Re({ method: "DELETE", fullPath: "/v1/subscriptions/{subscription_exposed_id}/discount" }), migrate: Re({ method: "POST", fullPath: "/v1/subscriptions/{subscription}/migrate" }), resume: Re({ method: "POST", fullPath: "/v1/subscriptions/{subscription}/resume" }), search: Re({ method: "GET", fullPath: "/v1/subscriptions/search", methodType: "search" }) });
var Cn = p.method;
var Pf = p.extend({ retrieve: Cn({ method: "GET", fullPath: "/v1/tax_codes/{id}" }), list: Cn({ method: "GET", fullPath: "/v1/tax_codes", methodType: "list" }) });
var er = p.method;
var Of = p.extend({ create: er({ method: "POST", fullPath: "/v1/tax_ids" }), retrieve: er({ method: "GET", fullPath: "/v1/tax_ids/{id}" }), list: er({ method: "GET", fullPath: "/v1/tax_ids", methodType: "list" }), del: er({ method: "DELETE", fullPath: "/v1/tax_ids/{id}" }) });
var tr = p.method;
var Af = p.extend({ create: tr({ method: "POST", fullPath: "/v1/tax_rates" }), retrieve: tr({ method: "GET", fullPath: "/v1/tax_rates/{tax_rate}" }), update: tr({ method: "POST", fullPath: "/v1/tax_rates/{tax_rate}" }), list: tr({ method: "GET", fullPath: "/v1/tax_rates", methodType: "list" }) });
var Dn = p.method;
var Cf = p.extend({ create: Dn({ method: "POST", fullPath: "/v1/tokens" }), retrieve: Dn({ method: "GET", fullPath: "/v1/tokens/{token}" }) });
var ls = p.method;
var Df = p.extend({ create: ls({ method: "POST", fullPath: "/v1/topups" }), retrieve: ls({ method: "GET", fullPath: "/v1/topups/{topup}" }), update: ls({ method: "POST", fullPath: "/v1/topups/{topup}" }), list: ls({ method: "GET", fullPath: "/v1/topups", methodType: "list" }), cancel: ls({ method: "POST", fullPath: "/v1/topups/{topup}/cancel" }) });
var $e = p.method;
var kf = p.extend({ create: $e({ method: "POST", fullPath: "/v1/transfers" }), retrieve: $e({ method: "GET", fullPath: "/v1/transfers/{transfer}" }), update: $e({ method: "POST", fullPath: "/v1/transfers/{transfer}" }), list: $e({ method: "GET", fullPath: "/v1/transfers", methodType: "list" }), createReversal: $e({ method: "POST", fullPath: "/v1/transfers/{id}/reversals" }), listReversals: $e({ method: "GET", fullPath: "/v1/transfers/{id}/reversals", methodType: "list" }), retrieveReversal: $e({ method: "GET", fullPath: "/v1/transfers/{transfer}/reversals/{id}" }), updateReversal: $e({ method: "POST", fullPath: "/v1/transfers/{transfer}/reversals/{id}" }) });
var us = p.method;
var Nf = p.extend({ create: us({ method: "POST", fullPath: "/v1/webhook_endpoints" }), retrieve: us({ method: "GET", fullPath: "/v1/webhook_endpoints/{webhook_endpoint}" }), update: us({ method: "POST", fullPath: "/v1/webhook_endpoints/{webhook_endpoint}" }), list: us({ method: "GET", fullPath: "/v1/webhook_endpoints", methodType: "list" }), del: us({ method: "DELETE", fullPath: "/v1/webhook_endpoints/{webhook_endpoint}" }) });
var jf = H("apps", { Secrets: nm });
var Mf = H("billing", { Alerts: Ud, CreditBalanceSummary: sp, CreditBalanceTransactions: rp, CreditGrants: ap, MeterEventAdjustments: yp, MeterEvents: Ip, Meters: Ap });
var Lf = H("billingPortal", { Configurations: Yd, Sessions: im });
var $f = H("checkout", { Sessions: cm });
var Ff = H("climate", { Orders: kp, Products: Wp, Suppliers: dm });
var Uf = H("entitlements", { ActiveEntitlements: Fd, Features: mp });
var qf = H("financialConnections", { Accounts: jd, Sessions: lm, Transactions: hm });
var Hf = H("forwarding", { Requests: rm });
var Wf = H("identity", { VerificationReports: vm, VerificationSessions: Sm });
var Bf = H("issuing", { Authorizations: Wd, Cardholders: Gd, Cards: Vd, Disputes: lp, PersonalizationDesigns: Up, PhysicalBundles: Hp, Tokens: mm, Transactions: _m });
var Kf = H("radar", { EarlyFraudWarnings: up, PaymentEvaluations: Fp, ValueListItems: bm, ValueLists: Tm });
var Gf = H("reporting", { ReportRuns: tm, ReportTypes: sm });
var Vf = H("sigma", { ScheduledQueryRuns: am });
var Jf = H("tax", { Associations: Hd, Calculations: Kd, Registrations: em, Settings: um, Transactions: Em });
var Yf = H("terminal", { Configurations: zd, ConnectionTokens: ep, Locations: Ep, OnboardingLinks: Dp, Readers: Bp });
var zf = H("testHelpers", { ConfirmationTokens: Qd, Customers: ip, Refunds: Zp, TestClocks: pm, Issuing: H("issuing", { Authorizations: Bd, Cards: Jd, PersonalizationDesigns: qp, Transactions: gm }), Terminal: H("terminal", { Readers: Kp }), Treasury: H("treasury", { InboundTransfers: hp, OutboundPayments: Np, OutboundTransfers: Mp, ReceivedCredits: Vp, ReceivedDebits: zp }) });
var Xf = H("treasury", { CreditReversals: np, DebitReversals: cp, FinancialAccounts: fp, InboundTransfers: _p, OutboundPayments: jp, OutboundTransfers: Lp, ReceivedCredits: Jp, ReceivedDebits: Xp, TransactionEntries: fm, Transactions: ym });
var Qf = H("v2", { Billing: H("billing", { MeterEventAdjustments: Tp, MeterEventSession: Sp, MeterEventStream: xp, MeterEvents: Op }), Core: H("core", { AccountLinks: kd, AccountTokens: Nd, Accounts: $d, EventDestinations: dp, Events: pp }) });
var sr = Object.freeze(Object.defineProperty({ __proto__: null, Account: Tn, AccountLinks: xm, AccountSessions: Im, Accounts: Tn, ApplePayDomains: Pm, ApplicationFees: Om, Apps: jf, Balance: Cm, BalanceSettings: Dm, BalanceTransactions: km, Billing: Mf, BillingPortal: Lf, Charges: Nm, Checkout: $f, Climate: Ff, ConfirmationTokens: Mm, CountrySpecs: Lm, Coupons: $m, CreditNotes: Fm, CustomerSessions: qm, Customers: Hm, Disputes: Wm, Entitlements: Uf, EphemeralKeys: Bm, Events: Km, ExchangeRates: Gm, FileLinks: Vm, Files: zm, FinancialConnections: qf, Forwarding: Hf, Identity: Wf, InvoiceItems: Xm, InvoicePayments: Qm, InvoiceRenderingTemplates: Zm, Invoices: ef, Issuing: Bf, Mandates: sf, OAuth: rf, PaymentAttemptRecords: af, PaymentIntents: nf, PaymentLinks: of, PaymentMethodConfigurations: cf, PaymentMethodDomains: lf, PaymentMethods: uf, PaymentRecords: df, Payouts: pf, Plans: mf, Prices: ff, Products: hf, PromotionCodes: _f, Quotes: Ef, Radar: Kf, Refunds: gf, Reporting: Gf, Reviews: yf, SetupAttempts: Tf, SetupIntents: vf, ShippingRates: Sf, Sigma: Vf, Sources: wf, SubscriptionItems: xf, SubscriptionSchedules: Rf, Subscriptions: If, Tax: Jf, TaxCodes: Pf, TaxIds: Of, TaxRates: Af, Terminal: Yf, TestHelpers: zf, Tokens: Cf, Topups: Df, Transfers: kf, Treasury: Xf, V2: Qf, WebhookEndpoints: Nf }, Symbol.toStringTag, { value: "Module" }));
var kn = "api.stripe.com";
var Nn = "443";
var jn = "/v1/";
var Mn = _i;
var Ln = 8e4;
var $n = 5;
var Fn = 0.5;
var Zf = ["name", "version", "url", "partner_id"];
var Un = ["authenticator", "apiVersion", "typescript", "maxNetworkRetries", "httpAgent", "httpClient", "timeout", "host", "port", "protocol", "telemetry", "appInfo", "stripeAccount", "stripeContext"];
var eh = /* @__PURE__ */ __name((e) => new fs(e, p.MAX_BUFFERED_REQUEST_METRICS), "eh");
function th(e, t = eh) {
  s.PACKAGE_VERSION = "20.4.0", s.API_VERSION = _i, s.USER_AGENT = Object.assign({ bindings_version: s.PACKAGE_VERSION, lang: "node", publisher: "stripe", uname: null, typescript: false }, id()), s.StripeResource = p, s.StripeContext = et, s.resources = sr, s.HttpClient = me, s.HttpClientResponse = ri, s.CryptoProvider = ai, s.webhooks = Ad(e);
  function s(r, a = {}) {
    if (!(this instanceof s)) return new s(r, a);
    const n = this._getPropsFromConfig(a);
    this._platformFunctions = e, Object.defineProperty(this, "_emitter", { value: this._platformFunctions.createEmitter(), enumerable: false, configurable: false, writable: false }), this.VERSION = s.PACKAGE_VERSION, this.on = this._emitter.on.bind(this._emitter), this.once = this._emitter.once.bind(this._emitter), this.off = this._emitter.removeListener.bind(this._emitter);
    const o = n.httpAgent || null;
    this._api = { host: n.host || kn, port: n.port || Nn, protocol: n.protocol || "https", basePath: jn, version: n.apiVersion || Mn, timeout: kr("timeout", n.timeout, Ln), maxNetworkRetries: kr("maxNetworkRetries", n.maxNetworkRetries, 2), agent: o, httpClient: n.httpClient || (o ? this._platformFunctions.createNodeHttpClient(o) : this._platformFunctions.createDefaultHttpClient()), dev: false, stripeAccount: n.stripeAccount || null, stripeContext: n.stripeContext || null };
    const i = n.typescript || false;
    i !== s.USER_AGENT.typescript && (s.USER_AGENT.typescript = i), n.appInfo && this._setAppInfo(n.appInfo), this._prepResources(), this._setAuthenticator(r, n.authenticator), this.errors = tn, this.webhooks = s.webhooks, this._prevRequestMetrics = [], this._enableTelemetry = n.telemetry !== false, this._requestSender = t(this), this.StripeResource = s.StripeResource;
  }
  __name(s, "s");
  return s.errors = tn, s.createNodeHttpClient = e.createNodeHttpClient, s.createFetchHttpClient = e.createFetchHttpClient, s.createNodeCryptoProvider = e.createNodeCryptoProvider, s.createSubtleCryptoProvider = e.createSubtleCryptoProvider, s.prototype = { _appInfo: void 0, on: null, off: null, once: null, VERSION: null, StripeResource: null, webhooks: null, errors: null, _api: null, _prevRequestMetrics: null, _emitter: null, _enableTelemetry: null, _requestSender: null, _platformFunctions: null, rawRequest(r, a, n, o) {
    return this._requestSender._rawRequest(r, a, n, o);
  }, _setAuthenticator(r, a) {
    if (r && a) throw new Error("Can't specify both apiKey and authenticator");
    if (!r && !a) throw new Error("Neither apiKey nor config.authenticator provided");
    this._authenticator = r ? sa(r) : a;
  }, _setAppInfo(r) {
    if (r && typeof r != "object") throw new Error("AppInfo must be an object.");
    if (r && !r.name) throw new Error("AppInfo.name is required");
    r = r || {}, this._appInfo = Zf.reduce((a, n) => (typeof r[n] == "string" && (a = a || {}, a[n] = r[n]), a), {});
  }, _setApiField(r, a) {
    this._api[r] = a;
  }, getApiField(r) {
    return this._api[r];
  }, setClientId(r) {
    this._clientId = r;
  }, getClientId() {
    return this._clientId;
  }, getConstant: /* @__PURE__ */ __name((r) => {
    switch (r) {
      case "DEFAULT_HOST":
        return kn;
      case "DEFAULT_PORT":
        return Nn;
      case "DEFAULT_BASE_PATH":
        return jn;
      case "DEFAULT_API_VERSION":
        return Mn;
      case "DEFAULT_TIMEOUT":
        return Ln;
      case "MAX_NETWORK_RETRY_DELAY_SEC":
        return $n;
      case "INITIAL_NETWORK_RETRY_DELAY_SEC":
        return Fn;
    }
    return s[r];
  }, "getConstant"), getMaxNetworkRetries() {
    return this.getApiField("maxNetworkRetries");
  }, _setApiNumberField(r, a, n) {
    const o = kr(r, a, n);
    this._setApiField(r, o);
  }, getMaxNetworkRetryDelay() {
    return $n;
  }, getInitialNetworkRetryDelay() {
    return Fn;
  }, getClientUserAgent(r) {
    return this.getClientUserAgentSeeded(s.USER_AGENT, r);
  }, getClientUserAgentSeeded(r, a) {
    this._platformFunctions.getUname().then((n) => {
      var o;
      const i = {};
      for (const l in r) Object.prototype.hasOwnProperty.call(r, l) && (i[l] = encodeURIComponent((o = r[l]) !== null && o !== void 0 ? o : "null"));
      i.uname = encodeURIComponent(n || "UNKNOWN");
      const c = this.getApiField("httpClient");
      c && (i.httplib = encodeURIComponent(c.getClientName())), this._appInfo && (i.application = this._appInfo), a(JSON.stringify(i));
    });
  }, getAppInfoAsString() {
    if (!this._appInfo) return "";
    let r = this._appInfo.name;
    return this._appInfo.version && (r += `/${this._appInfo.version}`), this._appInfo.url && (r += ` (${this._appInfo.url})`), r;
  }, getTelemetryEnabled() {
    return this._enableTelemetry;
  }, _prepResources() {
    for (const r in sr) Object.prototype.hasOwnProperty.call(sr, r) && (this[ad(r)] = new sr[r](this));
  }, _getPropsFromConfig(r) {
    if (!r) return {};
    const a = typeof r == "string";
    if (!(r === Object(r) && !Array.isArray(r)) && !a) throw new Error("Config must either be an object or a string");
    if (a) return { apiVersion: r };
    if (Object.keys(r).filter((i) => !Un.includes(i)).length > 0) throw new Error(`Config object may only contain the following: ${Un.join(", ")}`);
    return r;
  }, parseEventNotification(r, a, n, o, i, c) {
    const l = this.webhooks.constructEvent(r, a, n, o, i, c);
    return l.context && (l.context = et.parse(l.context)), l.fetchEvent = () => this._requestSender._rawRequest("GET", `/v2/core/events/${l.id}`, void 0, { stripeContext: l.context }, ["fetch_event"]), l.fetchRelatedObject = () => l.related_object ? this._requestSender._rawRequest("GET", l.related_object.url, void 0, { stripeContext: l.context }, ["fetch_related_object"]) : Promise.resolve(null), l;
  } }, s;
}
__name(th, "th");
var qn = th(new _d());
var sh = Object.freeze(Object.defineProperty({ __proto__: null, Stripe: qn, default: qn }, Symbol.toStringTag, { value: "Module" }));
async function rh(e, t, s) {
  const r = e.from || s || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <onboarding@resend.dev>", { to: a, subject: n, html: o } = e;
  if (!t) return console.warn("[Email] RESEND_API_KEY not configured, skipping email"), { success: false, error: "API key not configured" };
  try {
    console.log("[Email] Sending email:", { to: a, subject: n, from: r });
    const i = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: r, to: a, subject: n, html: o }) }), c = await i.json();
    return i.ok ? (console.log("[Email] Sent successfully:", { to: a, subject: n, id: c.id }), { success: true }) : (console.error("[Email] Failed to send:", c), { success: false, error: c.message || "Failed to send email" });
  } catch (i) {
    return console.error("[Email] Error:", i), { success: false, error: i.message };
  }
}
__name(rh, "rh");
function ah(e, t) {
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
                  \uC544\uC774\uB514: <strong>${t}</strong>
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
__name(ah, "ah");
function nh(e, t) {
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
                  ${t}
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
__name(nh, "nh");
var Ei = Object.freeze(Object.defineProperty({ __proto__: null, getSellerApprovalEmailHTML: ah, getSellerRejectionEmailHTML: nh, sendEmail: rh }, Symbol.toStringTag, { value: "Module" }));
async function oh(e, t) {
  const { userId: s, type: r, title: a, message: n, linkUrl: o } = t;
  try {
    const i = await e.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(s, r, a, n, o || null).run();
    return console.log(`[Notification] Created for user ${s}: ${r} - ${a}`), { success: true, id: i.meta.last_row_id };
  } catch (i) {
    return console.error("[Notification] Failed to create:", i), { success: false, error: i.message };
  }
}
__name(oh, "oh");
var ih = { seller_approved: /* @__PURE__ */ __name((e) => ({ title: "\u{1F389} \uD310\uB9E4\uC790 \uC2B9\uC778 \uC644\uB8CC", message: `${e}\uB2D8, \uCD95\uD558\uD569\uB2C8\uB2E4! \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790\uB85C \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller" }), "seller_approved"), seller_rejected: /* @__PURE__ */ __name((e) => ({ title: "\uD310\uB9E4\uC790 \uC2B9\uC778 \uAC70\uBD80", message: `\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uD310\uB9E4\uC790 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0AC\uC720: ${e}`, linkUrl: "/seller/register" }), "seller_rejected"), order_complete: /* @__PURE__ */ __name((e) => ({ title: "\uC8FC\uBB38 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_complete"), order_shipped: /* @__PURE__ */ __name((e) => ({ title: "\uBC30\uC1A1 \uC2DC\uC791", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC0C1\uD488\uC774 \uBC30\uC1A1 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_shipped"), order_delivered: /* @__PURE__ */ __name((e) => ({ title: "\uBC30\uC1A1 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC0C1\uD488\uC774 \uBC30\uC1A1 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_delivered"), refund_requested: /* @__PURE__ */ __name((e) => ({ title: "\uD658\uBD88 \uC694\uCCAD \uC811\uC218", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uD658\uBD88\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "refund_requested"), refund_complete: /* @__PURE__ */ __name((e, t) => ({ title: "\uD658\uBD88 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uD658\uBD88(\u20A9${t.toLocaleString()})\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "refund_complete"), product_low_stock: /* @__PURE__ */ __name((e, t) => ({ title: "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", message: `${e}\uC758 \uC7AC\uACE0\uAC00 ${t}\uAC1C \uB0A8\uC558\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller/products" }), "product_low_stock"), product_sold_out: /* @__PURE__ */ __name((e) => ({ title: "\u274C \uD488\uC808 \uC54C\uB9BC", message: `${e}\uC774(\uAC00) \uD488\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller/products" }), "product_sold_out") };
var gi = Object.freeze(Object.defineProperty({ __proto__: null, NotificationTemplates: ih, createNotification: oh }, Symbol.toStringTag, { value: "Module" }));

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
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

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-eHUgn2/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = Za;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-eHUgn2/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
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
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
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
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=bundledWorker-0.5750644036251713.mjs.map
