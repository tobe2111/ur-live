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
  constructor(fd) {
    this.fd = fd;
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
var er = Object.defineProperty;
var Ks = /* @__PURE__ */ __name((e) => {
  throw TypeError(e);
}, "Ks");
var sr = /* @__PURE__ */ __name((e, s, t) => s in e ? er(e, s, { enumerable: true, configurable: true, writable: true, value: t }) : e[s] = t, "sr");
var D = /* @__PURE__ */ __name((e, s, t) => sr(e, typeof s != "symbol" ? s + "" : s, t), "D");
var Rs = /* @__PURE__ */ __name((e, s, t) => s.has(e) || Ks("Cannot " + t), "Rs");
var h = /* @__PURE__ */ __name((e, s, t) => (Rs(e, s, "read from private field"), t ? t.call(e) : s.get(e)), "h");
var k = /* @__PURE__ */ __name((e, s, t) => s.has(e) ? Ks("Cannot add the same private member more than once") : s instanceof WeakSet ? s.add(e) : s.set(e, t), "k");
var v = /* @__PURE__ */ __name((e, s, t, r) => (Rs(e, s, "write to private field"), r ? r.call(e, t) : s.set(e, t), t), "v");
var C = /* @__PURE__ */ __name((e, s, t) => (Rs(e, s, "access private method"), t), "C");
var Vs = /* @__PURE__ */ __name((e, s, t, r) => ({ set _(a) {
  v(e, s, a, t);
}, get _() {
  return h(e, s, r);
} }), "Vs");
var Ys = /* @__PURE__ */ __name((e, s, t) => (r, a) => {
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
}, "Ys");
var tr = /* @__PURE__ */ Symbol();
var rr = /* @__PURE__ */ __name(async (e, s = /* @__PURE__ */ Object.create(null)) => {
  const { all: t = false, dot: r = false } = s, n = (e instanceof wt ? e.raw.headers : e.headers).get("Content-Type");
  return n != null && n.startsWith("multipart/form-data") || n != null && n.startsWith("application/x-www-form-urlencoded") ? ar(e, { all: t, dot: r }) : {};
}, "rr");
async function ar(e, s) {
  const t = await e.formData();
  return t ? nr(t, s) : {};
}
__name(ar, "ar");
function nr(e, s) {
  const t = /* @__PURE__ */ Object.create(null);
  return e.forEach((r, a) => {
    s.all || a.endsWith("[]") ? or(t, a, r) : t[a] = r;
  }), s.dot && Object.entries(t).forEach(([r, a]) => {
    r.includes(".") && (ir(t, r, a), delete t[r]);
  }), t;
}
__name(nr, "nr");
var or = /* @__PURE__ */ __name((e, s, t) => {
  e[s] !== void 0 ? Array.isArray(e[s]) ? e[s].push(t) : e[s] = [e[s], t] : s.endsWith("[]") ? e[s] = [t] : e[s] = t;
}, "or");
var ir = /* @__PURE__ */ __name((e, s, t) => {
  let r = e;
  const a = s.split(".");
  a.forEach((n, o) => {
    o === a.length - 1 ? r[n] = t : ((!r[n] || typeof r[n] != "object" || Array.isArray(r[n]) || r[n] instanceof File) && (r[n] = /* @__PURE__ */ Object.create(null)), r = r[n]);
  });
}, "ir");
var ft = /* @__PURE__ */ __name((e) => {
  const s = e.split("/");
  return s[0] === "" && s.shift(), s;
}, "ft");
var cr = /* @__PURE__ */ __name((e) => {
  const { groups: s, path: t } = lr(e), r = ft(t);
  return ur(r, s);
}, "cr");
var lr = /* @__PURE__ */ __name((e) => {
  const s = [];
  return e = e.replace(/\{[^}]+\}/g, (t, r) => {
    const a = `@${r}`;
    return s.push([a, t]), a;
  }), { groups: s, path: e };
}, "lr");
var ur = /* @__PURE__ */ __name((e, s) => {
  for (let t = s.length - 1; t >= 0; t--) {
    const [r] = s[t];
    for (let a = e.length - 1; a >= 0; a--) if (e[a].includes(r)) {
      e[a] = e[a].replace(r, s[t][1]);
      break;
    }
  }
  return e;
}, "ur");
var fs = {};
var dr = /* @__PURE__ */ __name((e, s) => {
  if (e === "*") return "*";
  const t = e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (t) {
    const r = `${e}#${s}`;
    return fs[r] || (t[2] ? fs[r] = s && s[0] !== ":" && s[0] !== "*" ? [r, t[1], new RegExp(`^${t[2]}(?=/${s})`)] : [e, t[1], new RegExp(`^${t[2]}$`)] : fs[r] = [e, t[1], true]), fs[r];
  }
  return null;
}, "dr");
var js = /* @__PURE__ */ __name((e, s) => {
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
}, "js");
var pr = /* @__PURE__ */ __name((e) => js(e, decodeURI), "pr");
var ht = /* @__PURE__ */ __name((e) => {
  const s = e.url, t = s.indexOf("/", s.indexOf(":") + 4);
  let r = t;
  for (; r < s.length; r++) {
    const a = s.charCodeAt(r);
    if (a === 37) {
      const n = s.indexOf("?", r), o = s.indexOf("#", r), i = n === -1 ? o === -1 ? void 0 : o : o === -1 ? n : Math.min(n, o), c = s.slice(t, i);
      return pr(c.includes("%25") ? c.replace(/%25/g, "%2525") : c);
    } else if (a === 63 || a === 35) break;
  }
  return s.slice(t, r);
}, "ht");
var mr = /* @__PURE__ */ __name((e) => {
  const s = ht(e);
  return s.length > 1 && s.at(-1) === "/" ? s.slice(0, -1) : s;
}, "mr");
var $e = /* @__PURE__ */ __name((e, s, ...t) => (t.length && (s = $e(s, ...t)), `${(e == null ? void 0 : e[0]) === "/" ? "" : "/"}${e}${s === "/" ? "" : `${(e == null ? void 0 : e.at(-1)) === "/" ? "" : "/"}${(s == null ? void 0 : s[0]) === "/" ? s.slice(1) : s}`}`), "$e");
var Et = /* @__PURE__ */ __name((e) => {
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
}, "Et");
var Is = /* @__PURE__ */ __name((e) => /[%+]/.test(e) ? (e.indexOf("+") !== -1 && (e = e.replace(/\+/g, " ")), e.indexOf("%") !== -1 ? js(e, yt) : e) : e, "Is");
var gt = /* @__PURE__ */ __name((e, s, t) => {
  let r;
  if (!t && s && !/[%+]/.test(s)) {
    let o = e.indexOf("?", 8);
    if (o === -1) return;
    for (e.startsWith(s, o + 1) || (o = e.indexOf(`&${s}`, o + 1)); o !== -1; ) {
      const i = e.charCodeAt(o + s.length + 1);
      if (i === 61) {
        const c = o + s.length + 2, l = e.indexOf("&", c);
        return Is(e.slice(c, l === -1 ? void 0 : l));
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
    if (r && (c = Is(c)), n = o, c === "") continue;
    let l;
    i === -1 ? l = "" : (l = e.slice(i + 1, o === -1 ? void 0 : o), r && (l = Is(l))), t ? (a[c] && Array.isArray(a[c]) || (a[c] = []), a[c].push(l)) : a[c] ?? (a[c] = l);
  }
  return s ? a[s] : a;
}, "gt");
var _r = gt;
var fr = /* @__PURE__ */ __name((e, s) => gt(e, s, true), "fr");
var yt = decodeURIComponent;
var Js = /* @__PURE__ */ __name((e) => js(e, yt), "Js");
var xe;
var se;
var fe;
var St;
var bt;
var Ns;
var he;
var lt;
var wt = (lt = class {
  static {
    __name(this, "lt");
  }
  constructor(e, s = "/", t = [[]]) {
    k(this, fe);
    D(this, "raw");
    k(this, xe);
    k(this, se);
    D(this, "routeIndex", 0);
    D(this, "path");
    D(this, "bodyCache", {});
    k(this, he, (e2) => {
      const { bodyCache: s2, raw: t2 } = this, r = s2[e2];
      if (r) return r;
      const a = Object.keys(s2)[0];
      return a ? s2[a].then((n) => (a === "json" && (n = JSON.stringify(n)), new Response(n)[e2]())) : s2[e2] = t2[e2]();
    });
    this.raw = e, this.path = s, v(this, se, t), v(this, xe, {});
  }
  param(e) {
    return e ? C(this, fe, St).call(this, e) : C(this, fe, bt).call(this);
  }
  query(e) {
    return _r(this.url, e);
  }
  queries(e) {
    return fr(this.url, e);
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
    return (s = this.bodyCache).parsedBody ?? (s.parsedBody = await rr(this, e));
  }
  json() {
    return h(this, he).call(this, "text").then((e) => JSON.parse(e));
  }
  text() {
    return h(this, he).call(this, "text");
  }
  arrayBuffer() {
    return h(this, he).call(this, "arrayBuffer");
  }
  blob() {
    return h(this, he).call(this, "blob");
  }
  formData() {
    return h(this, he).call(this, "formData");
  }
  addValidatedData(e, s) {
    h(this, xe)[e] = s;
  }
  valid(e) {
    return h(this, xe)[e];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [tr]() {
    return h(this, se);
  }
  get matchedRoutes() {
    return h(this, se)[0].map(([[, e]]) => e);
  }
  get routePath() {
    return h(this, se)[0].map(([[, e]]) => e)[this.routeIndex].path;
  }
}, xe = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), fe = /* @__PURE__ */ new WeakSet(), St = /* @__PURE__ */ __name(function(e) {
  const s = h(this, se)[0][this.routeIndex][1][e], t = C(this, fe, Ns).call(this, s);
  return t && /\%/.test(t) ? Js(t) : t;
}, "St"), bt = /* @__PURE__ */ __name(function() {
  const e = {}, s = Object.keys(h(this, se)[0][this.routeIndex][1]);
  for (const t of s) {
    const r = C(this, fe, Ns).call(this, h(this, se)[0][this.routeIndex][1][t]);
    r !== void 0 && (e[t] = /\%/.test(r) ? Js(r) : r);
  }
  return e;
}, "bt"), Ns = /* @__PURE__ */ __name(function(e) {
  return h(this, se)[1] ? h(this, se)[1][e] : e;
}, "Ns"), he = /* @__PURE__ */ new WeakMap(), lt);
var hr = { Stringify: 1 };
var Tt = /* @__PURE__ */ __name(async (e, s, t, r, a) => {
  typeof e == "object" && !(e instanceof String) && (e instanceof Promise || (e = e.toString()), e instanceof Promise && (e = await e));
  const n = e.callbacks;
  return n != null && n.length ? (a ? a[0] += e : a = [e], Promise.all(n.map((i) => i({ phase: s, buffer: a, context: r }))).then((i) => Promise.all(i.filter(Boolean).map((c) => Tt(c, s, false, r, a))).then(() => a[0]))) : Promise.resolve(e);
}, "Tt");
var Er = "text/plain; charset=UTF-8";
var vs = /* @__PURE__ */ __name((e, s) => ({ "Content-Type": e, ...s }), "vs");
var Le = /* @__PURE__ */ __name((e, s) => new Response(e, s), "Le");
var as;
var ns;
var de;
var He;
var pe;
var Q;
var os;
var Fe;
var Be;
var Re;
var is;
var cs;
var ie;
var Ue;
var Cs;
var ut;
var gr = (ut = class {
  static {
    __name(this, "ut");
  }
  constructor(e, s) {
    k(this, ie);
    k(this, as);
    k(this, ns);
    D(this, "env", {});
    k(this, de);
    D(this, "finalized", false);
    D(this, "error");
    k(this, He);
    k(this, pe);
    k(this, Q);
    k(this, os);
    k(this, Fe);
    k(this, Be);
    k(this, Re);
    k(this, is);
    k(this, cs);
    D(this, "render", (...e2) => (h(this, Fe) ?? v(this, Fe, (s2) => this.html(s2)), h(this, Fe).call(this, ...e2)));
    D(this, "setLayout", (e2) => v(this, os, e2));
    D(this, "getLayout", () => h(this, os));
    D(this, "setRenderer", (e2) => {
      v(this, Fe, e2);
    });
    D(this, "header", (e2, s2, t) => {
      this.finalized && v(this, Q, Le(h(this, Q).body, h(this, Q)));
      const r = h(this, Q) ? h(this, Q).headers : h(this, Re) ?? v(this, Re, new Headers());
      s2 === void 0 ? r.delete(e2) : t != null && t.append ? r.append(e2, s2) : r.set(e2, s2);
    });
    D(this, "status", (e2) => {
      v(this, He, e2);
    });
    D(this, "set", (e2, s2) => {
      h(this, de) ?? v(this, de, /* @__PURE__ */ new Map()), h(this, de).set(e2, s2);
    });
    D(this, "get", (e2) => h(this, de) ? h(this, de).get(e2) : void 0);
    D(this, "newResponse", (...e2) => C(this, ie, Ue).call(this, ...e2));
    D(this, "body", (e2, s2, t) => C(this, ie, Ue).call(this, e2, s2, t));
    D(this, "text", (e2, s2, t) => C(this, ie, Cs).call(this) && !s2 && !t ? Le(e2) : C(this, ie, Ue).call(this, e2, s2, vs(Er, t)));
    D(this, "json", (e2, s2, t) => C(this, ie, Cs).call(this) && !s2 && !t ? Response.json(e2) : C(this, ie, Ue).call(this, JSON.stringify(e2), s2, vs("application/json", t)));
    D(this, "html", (e2, s2, t) => {
      const r = /* @__PURE__ */ __name((a) => C(this, ie, Ue).call(this, a, s2, vs("text/html; charset=UTF-8", t)), "r");
      return typeof e2 == "object" ? Tt(e2, hr.Stringify, false, {}).then(r) : r(e2);
    });
    D(this, "redirect", (e2, s2) => {
      const t = String(e2);
      return this.header("Location", /[^\x00-\xFF]/.test(t) ? encodeURI(t) : t), this.newResponse(null, s2 ?? 302);
    });
    D(this, "notFound", () => (h(this, Be) ?? v(this, Be, () => Le()), h(this, Be).call(this, this)));
    v(this, as, e), s && (v(this, pe, s.executionCtx), this.env = s.env, v(this, Be, s.notFoundHandler), v(this, cs, s.path), v(this, is, s.matchResult));
  }
  get req() {
    return h(this, ns) ?? v(this, ns, new wt(h(this, as), h(this, cs), h(this, is))), h(this, ns);
  }
  get event() {
    if (h(this, pe) && "respondWith" in h(this, pe)) return h(this, pe);
    throw Error("This context has no FetchEvent");
  }
  get executionCtx() {
    if (h(this, pe)) return h(this, pe);
    throw Error("This context has no ExecutionContext");
  }
  get res() {
    return h(this, Q) || v(this, Q, Le(null, { headers: h(this, Re) ?? v(this, Re, new Headers()) }));
  }
  set res(e) {
    if (h(this, Q) && e) {
      e = Le(e.body, e);
      for (const [s, t] of h(this, Q).headers.entries()) if (s !== "content-type") if (s === "set-cookie") {
        const r = h(this, Q).headers.getSetCookie();
        e.headers.delete("set-cookie");
        for (const a of r) e.headers.append("set-cookie", a);
      } else e.headers.set(s, t);
    }
    v(this, Q, e), this.finalized = true;
  }
  get var() {
    return h(this, de) ? Object.fromEntries(h(this, de)) : {};
  }
}, as = /* @__PURE__ */ new WeakMap(), ns = /* @__PURE__ */ new WeakMap(), de = /* @__PURE__ */ new WeakMap(), He = /* @__PURE__ */ new WeakMap(), pe = /* @__PURE__ */ new WeakMap(), Q = /* @__PURE__ */ new WeakMap(), os = /* @__PURE__ */ new WeakMap(), Fe = /* @__PURE__ */ new WeakMap(), Be = /* @__PURE__ */ new WeakMap(), Re = /* @__PURE__ */ new WeakMap(), is = /* @__PURE__ */ new WeakMap(), cs = /* @__PURE__ */ new WeakMap(), ie = /* @__PURE__ */ new WeakSet(), Ue = /* @__PURE__ */ __name(function(e, s, t) {
  const r = h(this, Q) ? new Headers(h(this, Q).headers) : h(this, Re) ?? new Headers();
  if (typeof s == "object" && "headers" in s) {
    const n = s.headers instanceof Headers ? s.headers : new Headers(s.headers);
    for (const [o, i] of n) o.toLowerCase() === "set-cookie" ? r.append(o, i) : r.set(o, i);
  }
  if (t) for (const [n, o] of Object.entries(t)) if (typeof o == "string") r.set(n, o);
  else {
    r.delete(n);
    for (const i of o) r.append(n, i);
  }
  const a = typeof s == "number" ? s : (s == null ? void 0 : s.status) ?? h(this, He);
  return Le(e, { status: a, headers: r });
}, "Ue"), Cs = /* @__PURE__ */ __name(function() {
  return !h(this, Re) && !h(this, He) && !this.finalized;
}, "Cs"), ut);
var V = "ALL";
var yr = "all";
var wr = ["get", "post", "put", "delete", "options", "patch"];
var Rt = "Can not add a route since the matcher is already built.";
var It = class extends Error {
  static {
    __name(this, "It");
  }
};
var Sr = "__COMPOSED_HANDLER";
var br = /* @__PURE__ */ __name((e) => e.text("404 Not Found", 404), "br");
var zs = /* @__PURE__ */ __name((e, s) => {
  if ("getResponse" in e) {
    const t = e.getResponse();
    return s.newResponse(t.body, t);
  }
  return console.error(e), s.text("Internal Server Error", 500);
}, "zs");
var ae;
var Y;
var vt;
var ne;
var be;
var hs;
var Es;
var We;
var Tr = (We = class {
  static {
    __name(this, "We");
  }
  constructor(s = {}) {
    k(this, Y);
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
    k(this, ne, br);
    D(this, "errorHandler", zs);
    D(this, "onError", (s2) => (this.errorHandler = s2, this));
    D(this, "notFound", (s2) => (v(this, ne, s2), this));
    D(this, "fetch", (s2, ...t) => C(this, Y, Es).call(this, s2, t[1], t[0], s2.method));
    D(this, "request", (s2, t, r2, a2) => s2 instanceof Request ? this.fetch(t ? new Request(s2, t) : s2, r2, a2) : (s2 = s2.toString(), this.fetch(new Request(/^https?:\/\//.test(s2) ? s2 : `http://localhost${$e("/", s2)}`, t), r2, a2)));
    D(this, "fire", () => {
      addEventListener("fetch", (s2) => {
        s2.respondWith(C(this, Y, Es).call(this, s2.request, s2, void 0, s2.request.method));
      });
    });
    [...wr, yr].forEach((n) => {
      this[n] = (o, ...i) => (typeof o == "string" ? v(this, ae, o) : C(this, Y, be).call(this, n, h(this, ae), o), i.forEach((c) => {
        C(this, Y, be).call(this, n, h(this, ae), c);
      }), this);
    }), this.on = (n, o, ...i) => {
      for (const c of [o].flat()) {
        v(this, ae, c);
        for (const l of [n].flat()) i.map((u) => {
          C(this, Y, be).call(this, l.toUpperCase(), h(this, ae), u);
        });
      }
      return this;
    }, this.use = (n, ...o) => (typeof n == "string" ? v(this, ae, n) : (v(this, ae, "*"), o.unshift(n)), o.forEach((i) => {
      C(this, Y, be).call(this, V, h(this, ae), i);
    }), this);
    const { strict: r, ...a } = s;
    Object.assign(this, a), this.getPath = r ?? true ? s.getPath ?? ht : mr;
  }
  route(s, t) {
    const r = this.basePath(s);
    return t.routes.map((a) => {
      var o;
      let n;
      t.errorHandler === zs ? n = a.handler : (n = /* @__PURE__ */ __name(async (i, c) => (await Ys([], t.errorHandler)(i, () => a.handler(i, c))).res, "n"), n[Sr] = a.handler), C(o = r, Y, be).call(o, a.method, a.path, n);
    }), this;
  }
  basePath(s) {
    const t = C(this, Y, vt).call(this);
    return t._basePath = $e(this._basePath, s), t;
  }
  mount(s, t, r) {
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
      const c = $e(this._basePath, s), l = c === "/" ? 0 : c.length;
      return (u) => {
        const d = new URL(u.url);
        return d.pathname = d.pathname.slice(l) || "/", new Request(d, u);
      };
    })());
    const i = /* @__PURE__ */ __name(async (c, l) => {
      const u = await t(a(c.req.raw), ...o(c));
      if (u) return u;
      await l();
    }, "i");
    return C(this, Y, be).call(this, V, $e(s, "*"), i), this;
  }
}, ae = /* @__PURE__ */ new WeakMap(), Y = /* @__PURE__ */ new WeakSet(), vt = /* @__PURE__ */ __name(function() {
  const s = new We({ router: this.router, getPath: this.getPath });
  return s.errorHandler = this.errorHandler, v(s, ne, h(this, ne)), s.routes = this.routes, s;
}, "vt"), ne = /* @__PURE__ */ new WeakMap(), be = /* @__PURE__ */ __name(function(s, t, r) {
  s = s.toUpperCase(), t = $e(this._basePath, t);
  const a = { basePath: this._basePath, path: t, method: s, handler: r };
  this.router.add(s, t, [r, a]), this.routes.push(a);
}, "be"), hs = /* @__PURE__ */ __name(function(s, t) {
  if (s instanceof Error) return this.errorHandler(s, t);
  throw s;
}, "hs"), Es = /* @__PURE__ */ __name(function(s, t, r, a) {
  if (a === "HEAD") return (async () => new Response(null, await C(this, Y, Es).call(this, s, t, r, "GET")))();
  const n = this.getPath(s, { env: r }), o = this.router.match(a, n), i = new gr(s, { path: n, matchResult: o, env: r, executionCtx: t, notFoundHandler: h(this, ne) });
  if (o[0].length === 1) {
    let l;
    try {
      l = o[0][0][0][0](i, async () => {
        i.res = await h(this, ne).call(this, i);
      });
    } catch (u) {
      return C(this, Y, hs).call(this, u, i);
    }
    return l instanceof Promise ? l.then((u) => u || (i.finalized ? i.res : h(this, ne).call(this, i))).catch((u) => C(this, Y, hs).call(this, u, i)) : l ?? h(this, ne).call(this, i);
  }
  const c = Ys(o[0], this.errorHandler, h(this, ne));
  return (async () => {
    try {
      const l = await c(i);
      if (!l.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
      return l.res;
    } catch (l) {
      return C(this, Y, hs).call(this, l, i);
    }
  })();
}, "Es"), We);
var Dt = [];
function Rr(e, s) {
  const t = this.buildAllMatchers(), r = /* @__PURE__ */ __name(((a, n) => {
    const o = t[a] || t[V], i = o[2][n];
    if (i) return i;
    const c = n.match(o[0]);
    if (!c) return [[], Dt];
    const l = c.indexOf("", 1);
    return [o[1][l], c];
  }), "r");
  return this.match = r, r(e, s);
}
__name(Rr, "Rr");
var ys = "[^/]+";
var es = ".*";
var ss = "(?:|/.*)";
var Pe = /* @__PURE__ */ Symbol();
var Ir = new Set(".\\+*[^]$()");
function vr(e, s) {
  return e.length === 1 ? s.length === 1 ? e < s ? -1 : 1 : -1 : s.length === 1 || e === es || e === ss ? 1 : s === es || s === ss ? -1 : e === ys ? 1 : s === ys ? -1 : e.length === s.length ? e < s ? -1 : 1 : s.length - e.length;
}
__name(vr, "vr");
var Ie;
var ve;
var oe;
var Ae;
var Dr = (Ae = class {
  static {
    __name(this, "Ae");
  }
  constructor() {
    k(this, Ie);
    k(this, ve);
    k(this, oe, /* @__PURE__ */ Object.create(null));
  }
  insert(s, t, r, a, n) {
    if (s.length === 0) {
      if (h(this, Ie) !== void 0) throw Pe;
      if (n) return;
      v(this, Ie, t);
      return;
    }
    const [o, ...i] = s, c = o === "*" ? i.length === 0 ? ["", "", es] : ["", "", ys] : o === "/*" ? ["", "", ss] : o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let l;
    if (c) {
      const u = c[1];
      let d = c[2] || ys;
      if (u && c[2] && (d === ".*" || (d = d.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:"), /\((?!\?:)/.test(d)))) throw Pe;
      if (l = h(this, oe)[d], !l) {
        if (Object.keys(h(this, oe)).some((m) => m !== es && m !== ss)) throw Pe;
        if (n) return;
        l = h(this, oe)[d] = new Ae(), u !== "" && v(l, ve, a.varIndex++);
      }
      !n && u !== "" && r.push([u, h(l, ve)]);
    } else if (l = h(this, oe)[o], !l) {
      if (Object.keys(h(this, oe)).some((u) => u.length > 1 && u !== es && u !== ss)) throw Pe;
      if (n) return;
      l = h(this, oe)[o] = new Ae();
    }
    l.insert(i, t, r, a, n);
  }
  buildRegExpStr() {
    const t = Object.keys(h(this, oe)).sort(vr).map((r) => {
      const a = h(this, oe)[r];
      return (typeof h(a, ve) == "number" ? `(${r})@${h(a, ve)}` : Ir.has(r) ? `\\${r}` : r) + a.buildRegExpStr();
    });
    return typeof h(this, Ie) == "number" && t.unshift(`#${h(this, Ie)}`), t.length === 0 ? "" : t.length === 1 ? t[0] : "(?:" + t.join("|") + ")";
  }
}, Ie = /* @__PURE__ */ new WeakMap(), ve = /* @__PURE__ */ new WeakMap(), oe = /* @__PURE__ */ new WeakMap(), Ae);
var Ss;
var ls;
var dt;
var Or = (dt = class {
  static {
    __name(this, "dt");
  }
  constructor() {
    k(this, Ss, { varIndex: 0 });
    k(this, ls, new Dr());
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
    return h(this, ls).insert(n, s, r, h(this, Ss), t), r;
  }
  buildRegExp() {
    let e = h(this, ls).buildRegExpStr();
    if (e === "") return [/^$/, [], []];
    let s = 0;
    const t = [], r = [];
    return e = e.replace(/#(\d+)|@(\d+)|\.\*\$/g, (a, n, o) => n !== void 0 ? (t[++s] = Number(n), "$()") : (o !== void 0 && (r[Number(o)] = ++s), "")), [new RegExp(`^${e}`), t, r];
  }
}, Ss = /* @__PURE__ */ new WeakMap(), ls = /* @__PURE__ */ new WeakMap(), dt);
var Ar = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var gs = /* @__PURE__ */ Object.create(null);
function Ot(e) {
  return gs[e] ?? (gs[e] = new RegExp(e === "*" ? "" : `^${e.replace(/\/\*$|([.\\+*[^\]$()])/g, (s, t) => t ? `\\${t}` : "(?:|/.*)")}$`));
}
__name(Ot, "Ot");
function kr() {
  gs = /* @__PURE__ */ Object.create(null);
}
__name(kr, "kr");
function Nr(e) {
  var l;
  const s = new Or(), t = [];
  if (e.length === 0) return Ar;
  const r = e.map((u) => [!/\*|\/:/.test(u[0]), ...u]).sort(([u, d], [m, _]) => u ? 1 : m ? -1 : d.length - _.length), a = /* @__PURE__ */ Object.create(null);
  for (let u = 0, d = -1, m = r.length; u < m; u++) {
    const [_, f, g] = r[u];
    _ ? a[f] = [g.map(([w]) => [w, /* @__PURE__ */ Object.create(null)]), Dt] : d++;
    let S;
    try {
      S = s.insert(f, d, _);
    } catch (w) {
      throw w === Pe ? new It(f) : w;
    }
    _ || (t[d] = g.map(([w, E]) => {
      const T = /* @__PURE__ */ Object.create(null);
      for (E -= 1; E >= 0; E--) {
        const [y, R] = S[E];
        T[y] = R;
      }
      return [w, T];
    }));
  }
  const [n, o, i] = s.buildRegExp();
  for (let u = 0, d = t.length; u < d; u++) for (let m = 0, _ = t[u].length; m < _; m++) {
    const f = (l = t[u][m]) == null ? void 0 : l[1];
    if (!f) continue;
    const g = Object.keys(f);
    for (let S = 0, w = g.length; S < w; S++) f[g[S]] = i[f[g[S]]];
  }
  const c = [];
  for (const u in o) c[u] = t[o[u]];
  return [n, c, a];
}
__name(Nr, "Nr");
function Me(e, s) {
  if (e) {
    for (const t of Object.keys(e).sort((r, a) => a.length - r.length)) if (Ot(t).test(s)) return [...e[t]];
  }
}
__name(Me, "Me");
var Ee;
var ge;
var bs;
var At;
var pt;
var Cr = (pt = class {
  static {
    __name(this, "pt");
  }
  constructor() {
    k(this, bs);
    D(this, "name", "RegExpRouter");
    k(this, Ee);
    k(this, ge);
    D(this, "match", Rr);
    v(this, Ee, { [V]: /* @__PURE__ */ Object.create(null) }), v(this, ge, { [V]: /* @__PURE__ */ Object.create(null) });
  }
  add(e, s, t) {
    var i;
    const r = h(this, Ee), a = h(this, ge);
    if (!r || !a) throw new Error(Rt);
    r[e] || [r, a].forEach((c) => {
      c[e] = /* @__PURE__ */ Object.create(null), Object.keys(c[V]).forEach((l) => {
        c[e][l] = [...c[V][l]];
      });
    }), s === "/*" && (s = "*");
    const n = (s.match(/\/:/g) || []).length;
    if (/\*$/.test(s)) {
      const c = Ot(s);
      e === V ? Object.keys(r).forEach((l) => {
        var u;
        (u = r[l])[s] || (u[s] = Me(r[l], s) || Me(r[V], s) || []);
      }) : (i = r[e])[s] || (i[s] = Me(r[e], s) || Me(r[V], s) || []), Object.keys(r).forEach((l) => {
        (e === V || e === l) && Object.keys(r[l]).forEach((u) => {
          c.test(u) && r[l][u].push([t, n]);
        });
      }), Object.keys(a).forEach((l) => {
        (e === V || e === l) && Object.keys(a[l]).forEach((u) => c.test(u) && a[l][u].push([t, n]));
      });
      return;
    }
    const o = Et(s) || [s];
    for (let c = 0, l = o.length; c < l; c++) {
      const u = o[c];
      Object.keys(a).forEach((d) => {
        var m;
        (e === V || e === d) && ((m = a[d])[u] || (m[u] = [...Me(r[d], u) || Me(r[V], u) || []]), a[d][u].push([t, n - l + c + 1]));
      });
    }
  }
  buildAllMatchers() {
    const e = /* @__PURE__ */ Object.create(null);
    return Object.keys(h(this, ge)).concat(Object.keys(h(this, Ee))).forEach((s) => {
      e[s] || (e[s] = C(this, bs, At).call(this, s));
    }), v(this, Ee, v(this, ge, void 0)), kr(), e;
  }
}, Ee = /* @__PURE__ */ new WeakMap(), ge = /* @__PURE__ */ new WeakMap(), bs = /* @__PURE__ */ new WeakSet(), At = /* @__PURE__ */ __name(function(e) {
  const s = [];
  let t = e === V;
  return [h(this, Ee), h(this, ge)].forEach((r) => {
    const a = r[e] ? Object.keys(r[e]).map((n) => [n, r[e][n]]) : [];
    a.length !== 0 ? (t || (t = true), s.push(...a)) : e !== V && s.push(...Object.keys(r[V]).map((n) => [n, r[V][n]]));
  }), t ? Nr(s) : null;
}, "At"), pt);
var ye;
var me;
var mt;
var jr = (mt = class {
  static {
    __name(this, "mt");
  }
  constructor(e) {
    D(this, "name", "SmartRouter");
    k(this, ye, []);
    k(this, me, []);
    v(this, ye, e.routers);
  }
  add(e, s, t) {
    if (!h(this, me)) throw new Error(Rt);
    h(this, me).push([e, s, t]);
  }
  match(e, s) {
    if (!h(this, me)) throw new Error("Fatal error");
    const t = h(this, ye), r = h(this, me), a = t.length;
    let n = 0, o;
    for (; n < a; n++) {
      const i = t[n];
      try {
        for (let c = 0, l = r.length; c < l; c++) i.add(...r[c]);
        o = i.match(e, s);
      } catch (c) {
        if (c instanceof It) continue;
        throw c;
      }
      this.match = i.match.bind(i), v(this, ye, [i]), v(this, me, void 0);
      break;
    }
    if (n === a) throw new Error("Fatal error");
    return this.name = `SmartRouter + ${this.activeRouter.name}`, o;
  }
  get activeRouter() {
    if (h(this, me) || h(this, ye).length !== 1) throw new Error("No active router has been determined yet.");
    return h(this, ye)[0];
  }
}, ye = /* @__PURE__ */ new WeakMap(), me = /* @__PURE__ */ new WeakMap(), mt);
var Xe = /* @__PURE__ */ Object.create(null);
var Lr = /* @__PURE__ */ __name((e) => {
  for (const s in e) return true;
  return false;
}, "Lr");
var we;
var X;
var De;
var Ke;
var G;
var _e;
var Te;
var Ve;
var Mr = (Ve = class {
  static {
    __name(this, "Ve");
  }
  constructor(s, t, r) {
    k(this, _e);
    k(this, we);
    k(this, X);
    k(this, De);
    k(this, Ke, 0);
    k(this, G, Xe);
    if (v(this, X, r || /* @__PURE__ */ Object.create(null)), v(this, we, []), s && t) {
      const a = /* @__PURE__ */ Object.create(null);
      a[s] = { handler: t, possibleKeys: [], score: 0 }, v(this, we, [a]);
    }
    v(this, De, []);
  }
  insert(s, t, r) {
    v(this, Ke, ++Vs(this, Ke)._);
    let a = this;
    const n = cr(t), o = [];
    for (let i = 0, c = n.length; i < c; i++) {
      const l = n[i], u = n[i + 1], d = dr(l, u), m = Array.isArray(d) ? d[0] : l;
      if (m in h(a, X)) {
        a = h(a, X)[m], d && o.push(d[1]);
        continue;
      }
      h(a, X)[m] = new Ve(), d && (h(a, De).push(d), o.push(d[1])), a = h(a, X)[m];
    }
    return h(a, we).push({ [s]: { handler: r, possibleKeys: o.filter((i, c, l) => l.indexOf(i) === c), score: h(this, Ke) } }), a;
  }
  search(s, t) {
    var u;
    const r = [];
    v(this, G, Xe);
    let n = [this];
    const o = ft(t), i = [], c = o.length;
    let l = null;
    for (let d = 0; d < c; d++) {
      const m = o[d], _ = d === c - 1, f = [];
      for (let S = 0, w = n.length; S < w; S++) {
        const E = n[S], T = h(E, X)[m];
        T && (v(T, G, h(E, G)), _ ? (h(T, X)["*"] && C(this, _e, Te).call(this, r, h(T, X)["*"], s, h(E, G)), C(this, _e, Te).call(this, r, T, s, h(E, G))) : f.push(T));
        for (let y = 0, R = h(E, De).length; y < R; y++) {
          const U = h(E, De)[y], A = h(E, G) === Xe ? {} : { ...h(E, G) };
          if (U === "*") {
            const M = h(E, X)["*"];
            M && (C(this, _e, Te).call(this, r, M, s, h(E, G)), v(M, G, A), f.push(M));
            continue;
          }
          const [O, P, q] = U;
          if (!m && !(q instanceof RegExp)) continue;
          const L = h(E, X)[O];
          if (q instanceof RegExp) {
            if (l === null) {
              l = new Array(c);
              let B = t[0] === "/" ? 1 : 0;
              for (let I = 0; I < c; I++) l[I] = B, B += o[I].length + 1;
            }
            const M = t.substring(l[d]), K = q.exec(M);
            if (K) {
              if (A[P] = K[0], C(this, _e, Te).call(this, r, L, s, h(E, G), A), Lr(h(L, X))) {
                v(L, G, A);
                const B = ((u = K[0].match(/\//)) == null ? void 0 : u.length) ?? 0;
                (i[B] || (i[B] = [])).push(L);
              }
              continue;
            }
          }
          (q === true || q.test(m)) && (A[P] = m, _ ? (C(this, _e, Te).call(this, r, L, s, A, h(E, G)), h(L, X)["*"] && C(this, _e, Te).call(this, r, h(L, X)["*"], s, A, h(E, G))) : (v(L, G, A), f.push(L)));
        }
      }
      const g = i.shift();
      n = g ? f.concat(g) : f;
    }
    return r.length > 1 && r.sort((d, m) => d.score - m.score), [r.map(({ handler: d, params: m }) => [d, m])];
  }
}, we = /* @__PURE__ */ new WeakMap(), X = /* @__PURE__ */ new WeakMap(), De = /* @__PURE__ */ new WeakMap(), Ke = /* @__PURE__ */ new WeakMap(), G = /* @__PURE__ */ new WeakMap(), _e = /* @__PURE__ */ new WeakSet(), Te = /* @__PURE__ */ __name(function(s, t, r, a, n) {
  for (let o = 0, i = h(t, we).length; o < i; o++) {
    const c = h(t, we)[o], l = c[r] || c[V], u = {};
    if (l !== void 0 && (l.params = /* @__PURE__ */ Object.create(null), s.push(l), a !== Xe || n && n !== Xe)) for (let d = 0, m = l.possibleKeys.length; d < m; d++) {
      const _ = l.possibleKeys[d], f = u[l.score];
      l.params[_] = n != null && n[_] && !f ? n[_] : a[_] ?? (n == null ? void 0 : n[_]), u[l.score] = true;
    }
  }
}, "Te"), Ve);
var Oe;
var _t;
var $r = (_t = class {
  static {
    __name(this, "_t");
  }
  constructor() {
    D(this, "name", "TrieRouter");
    k(this, Oe);
    v(this, Oe, new Mr());
  }
  add(e, s, t) {
    const r = Et(s);
    if (r) {
      for (let a = 0, n = r.length; a < n; a++) h(this, Oe).insert(e, r[a], t);
      return;
    }
    h(this, Oe).insert(e, s, t);
  }
  match(e, s) {
    return h(this, Oe).search(e, s);
  }
}, Oe = /* @__PURE__ */ new WeakMap(), _t);
var Ls = class extends Tr {
  static {
    __name(this, "Ls");
  }
  constructor(e = {}) {
    super(e), this.router = e.router ?? new jr({ routers: [new Cr(), new $r()] });
  }
};
var b = /* @__PURE__ */ __name((e) => {
  const t = { ...{ origin: "*", allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"], allowHeaders: [], exposeHeaders: [] }, ...e }, r = /* @__PURE__ */ ((n) => typeof n == "string" ? n === "*" ? () => n : (o) => n === o ? o : null : typeof n == "function" ? n : (o) => n.includes(o) ? o : null)(t.origin), a = ((n) => typeof n == "function" ? n : Array.isArray(n) ? () => n : () => [])(t.allowMethods);
  return async function(o, i) {
    var u;
    function c(d, m) {
      o.res.headers.set(d, m);
    }
    __name(c, "c");
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
}, "b");
function Ur(e) {
  var a;
  const s = ((a = e.split(".").pop()) == null ? void 0 : a.toLowerCase()) || "jpg", t = Date.now(), r = crypto.randomUUID().substring(0, 8);
  return `upload_${t}_${r}.${s}`;
}
__name(Ur, "Ur");
async function Pr(e) {
  const s = new Uint8Array(e);
  return s[0] === 255 && s[1] === 216 && s[2] === 255 ? { valid: true, detectedType: "image/jpeg" } : s[0] === 137 && s[1] === 80 && s[2] === 78 && s[3] === 71 ? { valid: true, detectedType: "image/png" } : s[0] === 71 && s[1] === 73 && s[2] === 70 && s[3] === 56 ? { valid: true, detectedType: "image/gif" } : s[0] === 82 && s[1] === 73 && s[2] === 70 && s[3] === 70 && s[8] === 87 && s[9] === 69 && s[10] === 66 && s[11] === 80 ? { valid: true, detectedType: "image/webp" } : { valid: false };
}
__name(Pr, "Pr");
function qr(e) {
  let s = "";
  for (let t = 0; t < e.byteLength; t++) s += String.fromCharCode(e[t]);
  return s;
}
__name(qr, "qr");
function kt(e) {
  let s = new Uint8Array(e.length);
  for (let t = 0; t < e.length; t++) s[t] = e.charCodeAt(t);
  return s;
}
__name(kt, "kt");
function xr(e) {
  return btoa(qr(new Uint8Array(e)));
}
__name(xr, "xr");
function Nt(e) {
  return kt(atob(e));
}
__name(Nt, "Nt");
function Ms(e) {
  return kt(e);
}
__name(Ms, "Ms");
function Hr(e) {
  return xr(e).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(Hr, "Hr");
function Fr(e) {
  return Nt(e.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, ""));
}
__name(Fr, "Fr");
function Gs(e) {
  const t = new TextEncoder().encode(e), r = String.fromCharCode(...t);
  return btoa(r).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(Gs, "Gs");
function Ct(e) {
  return Nt(e.replace(/-+(BEGIN|END).*/g, "").replace(/\s/g, ""));
}
__name(Ct, "Ct");
async function Br(e, s, t) {
  return await crypto.subtle.importKey("raw", Ms(e), s, true, t);
}
__name(Br, "Br");
async function Wr(e, s, t) {
  return await crypto.subtle.importKey("jwk", e, s, true, t);
}
__name(Wr, "Wr");
async function Kr(e, s, t) {
  return await crypto.subtle.importKey("spki", Ct(e), s, true, t);
}
__name(Kr, "Kr");
async function Vr(e, s, t) {
  return await crypto.subtle.importKey("pkcs8", Ct(e), s, true, t);
}
__name(Vr, "Vr");
async function jt(e, s, t) {
  if (typeof e == "object") return Wr(e, s, t);
  if (typeof e != "string") throw new Error("Unsupported key type!");
  return e.includes("PUBLIC") ? Kr(e, s, t) : e.includes("PRIVATE") ? Vr(e, s, t) : Br(e, s, t);
}
__name(jt, "jt");
function Xs(e) {
  const s = Array.from(atob(e), (r) => r.charCodeAt(0)), t = new TextDecoder("utf-8").decode(new Uint8Array(s));
  return JSON.parse(t);
}
__name(Xs, "Xs");
if (typeof crypto > "u" || !crypto.subtle) throw new Error("SubtleCrypto not supported!");
var Lt = { none: { name: "none" }, ES256: { name: "ECDSA", namedCurve: "P-256", hash: { name: "SHA-256" } }, ES384: { name: "ECDSA", namedCurve: "P-384", hash: { name: "SHA-384" } }, ES512: { name: "ECDSA", namedCurve: "P-521", hash: { name: "SHA-512" } }, HS256: { name: "HMAC", hash: { name: "SHA-256" } }, HS384: { name: "HMAC", hash: { name: "SHA-384" } }, HS512: { name: "HMAC", hash: { name: "SHA-512" } }, RS256: { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }, RS384: { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-384" } }, RS512: { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-512" } } };
async function Yr(e, s, t = "HS256") {
  if (typeof t == "string" && (t = { algorithm: t }), t = { algorithm: "HS256", header: { typ: "JWT", ...t.header ?? {} }, ...t }, !e || typeof e != "object") throw new Error("payload must be an object");
  if (t.algorithm !== "none" && (!s || typeof s != "string" && typeof s != "object")) throw new Error("secret must be a string, a JWK object or a CryptoKey object");
  if (typeof t.algorithm != "string") throw new Error("options.algorithm must be a string");
  const r = Lt[t.algorithm];
  if (!r) throw new Error("algorithm not found");
  e.iat || (e.iat = Math.floor(Date.now() / 1e3));
  const a = `${Gs(JSON.stringify({ ...t.header, alg: t.algorithm }))}.${Gs(JSON.stringify(e))}`;
  if (t.algorithm === "none") return a;
  const n = s instanceof CryptoKey ? s : await jt(s, r, ["sign"]), o = await crypto.subtle.sign(r, n, Ms(a));
  return `${a}.${Hr(o)}`;
}
__name(Yr, "Yr");
async function Jr(e, s, t = "HS256") {
  var l;
  if (typeof t == "string" && (t = { algorithm: t }), t = { algorithm: "HS256", clockTolerance: 0, throwError: false, ...t }, typeof e != "string") throw new Error("token must be a string");
  if (t.algorithm !== "none" && typeof s != "string" && typeof s != "object") throw new Error("secret must be a string, a JWK object or a CryptoKey object");
  if (typeof t.algorithm != "string") throw new Error("options.algorithm must be a string");
  const r = e.split(".", 3);
  if (r.length < 2) throw new Error("token must consist of 2 or more parts");
  const [a, n, o] = r, i = Lt[t.algorithm];
  if (!i) throw new Error("algorithm not found");
  const c = Mt(e);
  try {
    if (((l = c.header) == null ? void 0 : l.alg) !== t.algorithm) throw new Error("INVALID_SIGNATURE");
    if (c.payload) {
      const d = Math.floor(Date.now() / 1e3);
      if (c.payload.nbf && c.payload.nbf > d && c.payload.nbf - d > (t.clockTolerance ?? 0)) throw new Error("NOT_YET_VALID");
      if (c.payload.exp && c.payload.exp <= d && d - c.payload.exp > (t.clockTolerance ?? 0)) throw new Error("EXPIRED");
    }
    if (i.name === "none") return c;
    const u = s instanceof CryptoKey ? s : await jt(s, i, ["verify"]);
    if (!await crypto.subtle.verify(i, u, Fr(o), Ms(`${a}.${n}`))) throw new Error("INVALID_SIGNATURE");
    return c;
  } catch (u) {
    if (t.throwError) throw u;
    return;
  }
}
__name(Jr, "Jr");
function Mt(e) {
  return { header: Xs(e.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")), payload: Xs(e.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")) };
}
__name(Mt, "Mt");
var ts = { sign: Yr, verify: Jr, decode: Mt };
function ce(e) {
  return (e == null ? void 0 : e.JWT_SECRET) || "ur-live-commerce-jwt-secret-2026-CHANGE-THIS-IN-PRODUCTION";
}
__name(ce, "ce");
async function ke(e, s) {
  return await ts.sign({ userId: e.userId, userType: e.userType, email: e.email, exp: Math.floor(Date.now() / 1e3) + 3600, type: "access" }, s);
}
__name(ke, "ke");
async function us(e, s) {
  return await ts.sign({ userId: e.userId, userType: e.userType, email: e.email, exp: Math.floor(Date.now() / 1e3) + 720 * 60 * 60, type: "refresh" }, s);
}
__name(us, "us");
async function ds(e, s) {
  try {
    return await ts.verify(e, s) ? ts.decode(e).payload : null;
  } catch {
    return null;
  }
}
__name(ds, "ds");
async function $t(e, s) {
  const t = await ds(e, s);
  return !t || t.type !== "refresh" ? null : await ke({ userId: t.userId, userType: t.userType, email: t.email }, s);
}
__name($t, "$t");
async function Ut(e, s, t) {
  try {
    const n = ts.decode(e).payload.exp - Math.floor(Date.now() / 1e3);
    n > 0 && await s.put(`blacklist:token:${e}`, "1", { expirationTtl: n });
  } catch (r) {
    console.error("Failed to blacklist token:", r);
  }
}
__name(Ut, "Ut");
async function zr(e, s) {
  try {
    return await s.get(`blacklist:token:${e}`) !== null;
  } catch {
    return false;
  }
}
__name(zr, "zr");
var Qe = /* @__PURE__ */ new Map();
async function $s(e, s) {
  const t = Math.floor(Date.now() / 1e3), r = Qe.get(e);
  if (r && r.exp > t) return r.payload;
  const a = await ds(e, s);
  if (a && a.exp && (Qe.set(e, { payload: a, exp: a.exp }), Qe.size > 1e3)) {
    const n = Qe.keys().next().value;
    Qe.delete(n);
  }
  return a;
}
__name($s, "$s");
var Pt = Object.freeze(Object.defineProperty({ __proto__: null, blacklistToken: Ut, generateAccessToken: ke, generateRefreshToken: us, getJwtSecret: ce, isTokenBlacklisted: zr, refreshAccessToken: $t, verifyCachedToken: $s, verifyToken: ds }, Symbol.toStringTag, { value: "Module" }));
var ps = new Ls();
ps.post("/api/auth/refresh", b(), async (e) => {
  try {
    const { refresh_token: s } = await e.req.json();
    if (!s) return e.json({ success: false, error: "Refresh token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
    const t = ce(e.env), r = await ds(s, t);
    if (!r || r.type !== "refresh") return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 refresh token\uC785\uB2C8\uB2E4." }, 401);
    if (e.env.SESSION_KV && await e.env.SESSION_KV.get(`blacklist:token:${s}`)) return e.json({ success: false, error: "\uB85C\uADF8\uC544\uC6C3\uB41C refresh token\uC785\uB2C8\uB2E4." }, 401);
    const a = await ke({ userId: r.userId, userType: r.userType, email: r.email }, t);
    return e.json({ success: true, access_token: a, expires_in: 900 });
  } catch (s) {
    return console.error("[JWT] Refresh token error:", s), e.json({ success: false, error: "Refresh token \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
ps.post("/api/auth/logout", b(), async (e) => {
  try {
    const s = e.req.header("Authorization"), t = s == null ? void 0 : s.replace("Bearer ", "");
    if (!t) return e.json({ success: false, error: "\uB85C\uADF8\uC544\uC6C3\uD560 \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 400);
    if (!e.env.SESSION_KV) return e.json({ success: false, error: "KV\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 500);
    const r = ce(e.env);
    return await Ut(t, e.env.SESSION_KV, r), e.json({ success: true, message: "\uB85C\uADF8\uC544\uC6C3\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (s) {
    return console.error("[JWT] Logout error:", s), e.json({ success: false, error: "\uB85C\uADF8\uC544\uC6C3 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
ps.post("/api/auth/login-jwt", b(), async (e) => {
  try {
    const { email: s, password: t, user_type: r } = await e.req.json();
    if (!s || !t) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD558\uC138\uC694." }, 400);
    if (!e.env.DB) return e.json({ success: false, error: "Database\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 500);
    const a = await e.env.DB.prepare(`SELECT id, email, password_hash, name, phone, profile_image 
       FROM users 
       WHERE email = ?`).bind(s).first();
    if (!a) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 401);
    if (!a.password_hash) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 401);
    const { verifyPassword: n } = await Promise.resolve().then(() => vn);
    if (!await n(t, a.password_hash)) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 401);
    await e.env.DB.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(a.id).run();
    const i = { userId: a.id, userType: r || "user", email: a.email }, c = ce(e.env), l = await ke(i, c), u = await us(i, c);
    return e.json({ success: true, access_token: l, refresh_token: u, expires_in: 900, token_type: "Bearer", user: { id: i.userId, email: i.email, name: a.name, user_type: i.userType } });
  } catch (s) {
    return console.error("[JWT] Login error:", s), e.json({ success: false, error: "\uB85C\uADF8\uC778 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
ps.get("/api/auth/verify", b(), async (e) => {
  try {
    const s = e.req.header("Authorization"), t = s == null ? void 0 : s.replace("Bearer ", "");
    if (!t) return e.json({ success: false, error: "\uD1A0\uD070\uC774 \uC81C\uACF5\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const r = ce(e.env), a = await ds(t, r);
    return a ? e.json({ success: true, payload: a }) : e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uD1A0\uD070\uC785\uB2C8\uB2E4." }, 401);
  } catch {
    return e.json({ success: false, error: "\uD1A0\uD070 \uAC80\uC99D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
function Gr(e) {
  const s = ["DB", "SESSION_KV", "CACHE_KV", "TOSS_SECRET_KEY", "TOSS_CLIENT_KEY"], t = [];
  for (const r of s) e[r] || t.push(r);
  if (t.length > 0) throw new Error(`Missing required environment variables: ${t.join(", ")}

Please configure them:
` + t.map((r) => r === "TOSS_SECRET_KEY" || r === "TOSS_CLIENT_KEY" ? `  npx wrangler pages secret put ${r} --project-name ur-live` : `  Check wrangler.jsonc for ${r} binding`).join(`
`) + `

For more details, see ENV_SETUP_GUIDE.md`);
}
__name(Gr, "Gr");
function Xr(e) {
  console.log("[ENV] Environment check:"), console.log("  DB:", e.DB ? "\u2705 Connected" : "\u274C Missing"), console.log("  SESSION_KV:", e.SESSION_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  CACHE_KV:", e.CACHE_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  TOSS_SECRET_KEY:", e.TOSS_SECRET_KEY ? "\u2705 Set" : "\u274C Missing"), console.log("  TOSS_CLIENT_KEY:", e.TOSS_CLIENT_KEY ? "\u2705 Set" : "\u274C Missing");
}
__name(Xr, "Xr");
async function Qr(e) {
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
__name(Qr, "Qr");
function Zr(e) {
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
__name(Zr, "Zr");
async function ea(e) {
  const s = await Qr(e), t = s.filter((n) => n.status === "pass").length, r = s.filter((n) => n.status === "warn").length, a = s.filter((n) => n.status === "fail").length;
  return { success: a === 0, summary: { total: s.length, pass: t, warn: r, fail: a }, results: s, formatted: Zr(s) };
}
__name(ea, "ea");
var Ds = { ENV: "test", TEST_API_KEY: "03148F80-9525-4A00-83B4-1AE55DFFA2DF", TEST_BASE_URL: "https://testapi.barobill.co.kr" };
function sa() {
  const e = Ds.ENV === "production";
  return { baseUrl: Ds.TEST_BASE_URL, apiKey: Ds.TEST_API_KEY, isProduction: e };
}
__name(sa, "sa");
async function qt(e, s) {
  const t = sa(), r = `${t.baseUrl}${e}`;
  try {
    const a = await fetch(r, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.apiKey}` }, body: JSON.stringify(s) });
    if (!a.ok) throw new Error(`\uBC14\uB85C\uBE4C API \uC624\uB958: ${a.status} ${a.statusText}`);
    return await a.json();
  } catch (a) {
    throw console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", a), a;
  }
}
__name(qt, "qt");
async function ta(e) {
  try {
    const s = { CorpNum: e.supplierBusinessNumber, InvoicerCorpNum: e.supplierBusinessNumber, InvoicerCorpName: e.supplierBusinessName, InvoicerCEOName: e.supplierCEO, InvoicerAddr: e.supplierAddress, InvoicerBizType: e.supplierBusinessType, InvoicerBizClass: e.supplierBusinessCategory, InvoicerContactName: e.supplierCEO, InvoicerEmail: e.supplierEmail, InvoicerTEL: e.supplierTel, InvoiceeType: e.buyerBusinessNumber ? "\uC0AC\uC5C5\uC790" : "\uAC1C\uC778", InvoiceeCorpNum: e.buyerBusinessNumber, InvoiceeCorpName: e.buyerBusinessName, InvoiceeCEOName: e.buyerCEO, InvoiceeAddr: e.buyerAddress, InvoiceeEmail: e.buyerEmail, InvoiceeTEL: e.buyerTel, WriteDate: e.writeDate, PurposeType: e.purposeType, TaxType: e.taxType, DetailList: e.items.map((r, a) => ({ SerialNum: a + 1, ItemName: r.name, Qty: r.quantity, UnitPrice: r.unitPrice, SupplyCost: r.supplyPrice, Tax: r.taxAmount, Remark: r.description || "" })), SupplyCostTotal: e.totalSupplyPrice.toString(), TaxTotal: e.totalTaxAmount.toString(), TotalAmount: e.totalAmount.toString(), Remark1: e.memo || "", Remark2: e.orderNo || "", SendSMS: false, AutoAccept: false }, t = await qt("/eTaxInvoice/RegistAndIssue", s);
    if (t.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC2E4\uD328: ${t.message}`);
    return { success: true, ntsConfirmNumber: t.ntsconfirmNum, invoiceKey: t.invoiceKey, message: t.message };
  } catch (s) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC2E4\uD328:", s), s;
  }
}
__name(ta, "ta");
async function ra(e, s, t) {
  try {
    const a = await qt("/eTaxInvoice/Delete", { CorpNum: e, InvoiceKey: s, Memo: t });
    if (a.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uCDE8\uC18C \uC2E4\uD328: ${a.message}`);
    return { success: true, message: a.message };
  } catch (r) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uCDE8\uC18C \uC2E4\uD328:", r), r;
  }
}
__name(ra, "ra");
function Ze() {
  return false;
}
__name(Ze, "Ze");
async function aa(e) {
  return await ta(e);
}
__name(aa, "aa");
function na(e, s, t) {
  const r = Number(s.total_amount), a = Math.floor(r / 1.1), n = r - a;
  return { supplierBusinessNumber: e.business_number, supplierBusinessName: e.business_name, supplierCEO: e.ceo_name, supplierAddress: e.address, supplierBusinessType: e.business_type, supplierBusinessCategory: e.business_category, supplierEmail: e.email, supplierTel: e.phone, buyerBusinessNumber: s.buyer_business_number, buyerBusinessName: s.buyer_business_name || s.user_name, buyerCEO: s.buyer_ceo_name, buyerAddress: s.shipping_address, buyerEmail: s.user_email, buyerTel: s.shipping_phone, writeDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], purposeType: "01", taxType: "01", items: t.map((o) => {
    const i = Number(o.price) * Number(o.quantity), c = Math.floor(i / 1.1), l = i - c;
    return { name: o.product_name, quantity: Number(o.quantity), unitPrice: Number(o.price), supplyPrice: c, taxAmount: l, description: o.option_name || "" };
  }), totalSupplyPrice: a, totalTaxAmount: n, totalAmount: r, memo: `\uC8FC\uBB38\uBC88\uD638: ${s.order_number}`, orderNo: s.order_number };
}
__name(na, "na");
var te = class extends Error {
  static {
    __name(this, "te");
  }
  constructor(s, t, r) {
    super(s), this.statusCode = t, this.code = r, this.name = "AuthError";
  }
};
function oa(e) {
  return `${crypto.randomUUID()}-${e}`;
}
__name(oa, "oa");
function ia(e) {
  var n, o, i, c, l, u, d;
  const s = e.id.toString(), t = ((n = e.properties) == null ? void 0 : n.nickname) || ((i = (o = e.kakao_account) == null ? void 0 : o.profile) == null ? void 0 : i.nickname) || "Kakao User", r = ((c = e.kakao_account) == null ? void 0 : c.email) || null, a = ((l = e.properties) == null ? void 0 : l.profile_image) || ((d = (u = e.kakao_account) == null ? void 0 : u.profile) == null ? void 0 : d.profile_image_url) || null;
  return { kakaoId: s, nickname: t, email: r, profileImage: a };
}
__name(ia, "ia");
async function ca(e, s, t, r, a) {
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
    if (!n) throw new te("Failed to upsert user", 500, "UPSERT_FAILED");
    return console.log("[Auth] \u26A1 User upserted successfully (optimized):", n.id), n;
  } catch (n) {
    throw n instanceof te ? n : (console.error("[Auth] Database error during upsert:", n), new te("Database error", 500, "DB_ERROR"));
  }
}
__name(ca, "ca");
async function la(e) {
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
__name(la, "la");
async function ua(e, s, t) {
  try {
    const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: t, redirect_uri: s, code: e }).toString() });
    if (!r.ok) {
      const n = await r.json();
      throw console.error("[Kakao OAuth] Token exchange failed:", n), new te(`Failed to exchange code: ${n.error_description || n.error}`, 401, n.error || "TOKEN_EXCHANGE_FAILED");
    }
    return (await r.json()).access_token;
  } catch (r) {
    throw r instanceof te ? r : (console.error("[Kakao OAuth] Network error:", r), new te("Failed to communicate with Kakao OAuth server", 503, "OAUTH_NETWORK_ERROR"));
  }
}
__name(ua, "ua");
async function xt(e, s) {
  const t = await la(s), { kakaoId: r, nickname: a, email: n, profileImage: o } = ia(t);
  console.log("[Auth] Processing login for Kakao user:", r);
  const i = await ca(e, r, a, n, o), c = oa(i.id);
  return { user: i, sessionToken: c };
}
__name(xt, "xt");
async function Ht(e, s, t = 30) {
  try {
    const r = await e.get(s, "json");
    if (!r) return console.log(`[Cache MISS] ${s}`), null;
    const a = Date.now() - r.timestamp;
    return a > t * 1e3 ? (console.log(`[Cache EXPIRED] ${s} (age: ${Math.round(a / 1e3)}s)`), null) : (console.log(`[Cache HIT] ${s} (age: ${Math.round(a / 1e3)}s)`), r.data);
  } catch (r) {
    return console.error(`[Cache] Get error for key "${s}":`, r), null;
  }
}
__name(Ht, "Ht");
async function ws(e, s, t, r = 30) {
  try {
    const a = { data: t, timestamp: Date.now() };
    await e.put(s, JSON.stringify(a), { expirationTtl: r }), console.log(`[Cache SET] ${s} (TTL: ${r}s)`);
  } catch (a) {
    console.error(`[Cache] Set error for key "${s}":`, a);
  }
}
__name(ws, "ws");
function da(e) {
  const s = e.req.header("CF-Connecting-IP");
  if (s) return s;
  const t = e.req.header("X-Forwarded-For");
  if (t) return t.split(",")[0].trim();
  const r = e.req.header("X-Real-IP");
  return r || "unknown";
}
__name(da, "da");
function pa(e, s) {
  return `ratelimit:${e}:${s}`;
}
__name(pa, "pa");
var Os = /* @__PURE__ */ new Map();
async function ma(e, s, t) {
  var m;
  const r = new URL(e.req.url).pathname, a = pa(s, r), n = Date.now(), o = t.windowMs * 1e3, c = e.get("user") && t.authenticatedMultiplier ? t.maxRequests * t.authenticatedMultiplier : t.maxRequests;
  try {
    const _ = (m = e.env) == null ? void 0 : m.RATE_LIMIT_KV;
    if (_) {
      const f = await _.get(a);
      let g;
      f ? (g = JSON.parse(f), n > g.resetTime ? g = { count: 1, resetTime: n + o } : g.count++) : g = { count: 1, resetTime: n + o };
      const S = Math.ceil(o / 1e3);
      await _.put(a, JSON.stringify(g), { expirationTtl: S });
      const w = g.count <= c, E = Math.max(0, c - g.count);
      return { allowed: w, remaining: E, resetTime: g.resetTime };
    }
  } catch (_) {
    console.error("KV Rate Limit Error:", _);
  }
  let l = Os.get(a);
  l && n > l.resetTime && (Os.delete(a), l = void 0), l ? l.count++ : l = { count: 1, resetTime: n + o }, Os.set(a, l);
  const u = l.count <= c, d = Math.max(0, c - l.count);
  return { allowed: u, remaining: d, resetTime: l.resetTime };
}
__name(ma, "ma");
function Ne(e) {
  return async (s, t) => {
    const r = da(s);
    if (e.skipIps && e.skipIps.includes(r)) return t();
    if (e.pathPattern) {
      const n = new URL(s.req.url).pathname;
      if (!e.pathPattern.test(n)) return t();
    }
    const a = await ma(s, r, e);
    if (s.header("X-RateLimit-Limit", e.maxRequests.toString()), s.header("X-RateLimit-Remaining", a.remaining.toString()), s.header("X-RateLimit-Reset", new Date(a.resetTime).toISOString()), !a.allowed) {
      const n = Math.ceil((a.resetTime - Date.now()) / 1e3);
      return s.header("Retry-After", n.toString()), s.json({ success: false, error: e.message || "Too many requests. Please try again later.", retryAfter: n, resetTime: new Date(a.resetTime).toISOString() }, 429);
    }
    return t();
  };
}
__name(Ne, "Ne");
var Ce = { api: { windowMs: 60, maxRequests: 60, message: "API \uC694\uCCAD \uC81C\uD55C\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", authenticatedMultiplier: 2 }, auth: { windowMs: 60, maxRequests: 5, message: "\uB85C\uADF8\uC778 \uC2DC\uB3C4 \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uBD84 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/auth\// }, order: { windowMs: 60, maxRequests: 10, message: "\uC8FC\uBB38 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders/, authenticatedMultiplier: 2 }, cart: { windowMs: 60, maxRequests: 20, message: "\uC7A5\uBC14\uAD6C\uB2C8 \uC694\uCCAD\uC774 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/cart/, authenticatedMultiplier: 2 }, refund: { windowMs: 3600, maxRequests: 3, message: "\uD658\uBD88 \uC694\uCCAD \uD69F\uC218\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. 1\uC2DC\uAC04 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/orders\/.*\/refund/ }, alimtalk: { windowMs: 60, maxRequests: 10, message: "\uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC694\uCCAD\uC774 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/seller\/alimtalk\/send/ }, upload: { windowMs: 60, maxRequests: 5, message: "\uD30C\uC77C \uC5C5\uB85C\uB4DC\uAC00 \uB108\uBB34 \uBE48\uBC88\uD569\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", pathPattern: /^\/api\/.*\/upload/ } };
var W = class extends Error {
  static {
    __name(this, "W");
  }
  constructor(s, t, r = "VALIDATION_ERROR") {
    super(t), this.field = s, this.code = r, this.name = "ValidationError";
  }
};
function _a(e, s) {
  const { field: t, required: r, type: a, min: n, max: o, pattern: i, enum: c, custom: l, message: u } = s;
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
        if (typeof e != "string" || !Ea(e)) throw new W(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_EMAIL");
        break;
      case "url":
        if (typeof e != "string" || !ga(e)) throw new W(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C URL\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_URL");
        break;
      case "phone":
        if (typeof e != "string" || !ya(e)) throw new W(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_PHONE");
        break;
      case "date":
        if (!(e instanceof Date) && !wa(e)) throw new W(t, u || `${t}\uC740(\uB294) \uC720\uD6A8\uD55C \uB0A0\uC9DC\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_DATE");
        break;
      case "array":
        if (!Array.isArray(e)) throw new W(t, u || `${t}\uC740(\uB294) \uBC30\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
      case "object":
        if (typeof e != "object" || e === null || Array.isArray(e)) throw new W(t, u || `${t}\uC740(\uB294) \uAC1D\uCCB4\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "INVALID_TYPE");
        break;
    }
    if (typeof e == "string") {
      if (n !== void 0 && e.length < n) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uC18C ${n}\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SHORT");
      if (o !== void 0 && e.length > o) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uB300 ${o}\uC790 \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LONG");
    }
    if (typeof e == "number") {
      if (n !== void 0 && e < n) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uC18C ${n} \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_SMALL");
      if (o !== void 0 && e > o) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uB300 ${o} \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_LARGE");
    }
    if (Array.isArray(e)) {
      if (n !== void 0 && e.length < n) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uC18C ${n}\uAC1C \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`, "TOO_FEW");
      if (o !== void 0 && e.length > o) throw new W(t, u || `${t}\uC740(\uB294) \uCD5C\uB300 ${o}\uAC1C \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.`, "TOO_MANY");
    }
    if (i && typeof e == "string" && !i.test(e)) throw new W(t, u || `${t}\uC758 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "INVALID_FORMAT");
    if (c && !c.includes(e)) throw new W(t, u || `${t}\uC740(\uB294) \uB2E4\uC74C \uC911 \uD558\uB098\uC5EC\uC57C \uD569\uB2C8\uB2E4: ${c.join(", ")}`, "INVALID_ENUM");
    if (l && l(e) === false) throw new W(t, u || `${t}\uC758 \uAC12\uC774 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`, "CUSTOM_VALIDATION_FAILED");
  }
}
__name(_a, "_a");
function fa(e, s) {
  for (const t of s) {
    const r = e[t.field];
    _a(r, t);
  }
}
__name(fa, "fa");
function ha(e) {
  return async (s, t) => {
    try {
      let r = {};
      const a = s.req.header("content-type") || "";
      a.includes("application/json") ? r = await s.req.json().catch(() => ({})) : (a.includes("application/x-www-form-urlencoded") || a.includes("multipart/form-data")) && (r = await s.req.parseBody().catch(() => ({})));
      const n = new URL(s.req.url);
      for (const [o, i] of n.searchParams.entries()) o in r || (r[o] = i);
      fa(r, e), s.set("validatedData", r), await t();
    } catch (r) {
      if (r instanceof W) return s.json({ success: false, error: r.message, field: r.field, code: r.code }, 400);
      throw r;
    }
  };
}
__name(ha, "ha");
function Ea(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}
__name(Ea, "Ea");
function ga(e) {
  try {
    const s = new URL(e);
    return s.protocol === "http:" || s.protocol === "https:";
  } catch {
    return false;
  }
}
__name(ga, "ga");
function ya(e) {
  return /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e);
}
__name(ya, "ya");
function wa(e) {
  if (typeof e != "string") return false;
  const s = new Date(e);
  return !isNaN(s.getTime());
}
__name(wa, "wa");
var Sa = [{ field: "email", required: true, type: "email", max: 255, message: "\uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, { field: "password", required: true, type: "string", min: 8, max: 100, pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: "\uBE44\uBC00\uBC88\uD638\uB294 \uCD5C\uC18C 8\uC790 \uC774\uC0C1, \uB300\uC18C\uBB38\uC790\uC640 \uC22B\uC790\uB97C \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4." }, { field: "name", required: true, type: "string", min: 2, max: 50, message: "\uC774\uB984\uC740 2-50\uC790 \uC0AC\uC774\uC5EC\uC57C \uD569\uB2C8\uB2E4." }, { field: "phone", required: false, type: "phone", message: "\uC720\uD6A8\uD55C \uC804\uD654\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694. (\uC608: 010-1234-5678)" }];
function Ts(e) {
  const s = new URLSearchParams();
  for (const [t, r] of Object.entries(e)) r != null && s.append(t, String(r));
  return s;
}
__name(Ts, "Ts");
function Us(e, s) {
  if (e.result_code !== "1") throw new Error(`[Aligo ${s}] ${e.message} (code: ${e.result_code})`);
}
__name(Us, "Us");
async function Ps(e) {
  console.log("[Aligo] \uD1A0\uD070 \uC0DD\uC131 \uC2DC\uC791");
  const t = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Ts({ apikey: e.ALIGO_API_KEY, userid: e.ALIGO_USER_ID }) })).json();
  return Us(t, "Token Create"), console.log("[Aligo] \u2705 \uD1A0\uD070 \uC0DD\uC131 \uC131\uACF5:", t.token.substring(0, 20) + "..."), { token: t.token, urtime: t.urtime };
}
__name(Ps, "Ps");
async function ba(e, s) {
  console.log("[Aligo] \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D:", s.channelId);
  const { token: t } = await Ps(e), a = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Ts({ token: t, userid: e.ALIGO_USER_ID, plusid: s.channelId, phonenumber: s.phoneNumber }) })).json();
  return Us(a, "Channel Register"), console.log("[Aligo] \u2705 \uCE74\uCE74\uC624 \uCC44\uB110 \uB4F1\uB85D \uC131\uACF5, senderKey:", a.senderkey), { success: true, senderKey: a.senderkey };
}
__name(ba, "ba");
async function Ta(e, s, t) {
  console.log("[Aligo] \uD15C\uD50C\uB9BF \uB4F1\uB85D:", t.templateCode);
  const { token: r } = await Ps(e), n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Ts({ token: r, userid: e.ALIGO_USER_ID, senderkey: s, tpl_name: t.name, tpl_content: t.content, tpl_code: t.templateCode }) })).json();
  return Us(n, "Template Register"), console.log("[Aligo] \u2705 \uD15C\uD50C\uB9BF \uB4F1\uB85D \uC131\uACF5:", n.tpl_code), { success: true, templateCode: n.tpl_code };
}
__name(Ta, "Ta");
async function qs(e, s) {
  console.log("[Aligo] \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1:", s.to);
  try {
    const { token: t } = await Ps(e), r = s.buttons ? JSON.stringify({ button: s.buttons }) : void 0, n = await (await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: Ts({ token: t, userid: e.ALIGO_USER_ID, senderkey: s.senderKey, tpl_code: s.templateCode, receiver_1: s.to, subject_1: "\uC54C\uB9BC\uD1A1", message_1: s.message, button_1: r }) })).json();
    return n.result_code !== "1" ? (console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328:", n.message), { success: false, error: n.message }) : (console.log("[Aligo] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5, messageId:", n.msg_id), { success: true, messageId: n.msg_id });
  } catch (t) {
    return console.error("[Aligo] \u274C \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC5D0\uB7EC:", t.message), { success: false, error: t.message };
  }
}
__name(qs, "qs");
function Ra(e, s) {
  let t = e;
  for (const [r, a] of Object.entries(s)) {
    const n = new RegExp(`#{${r}}`, "g");
    t = t.replace(n, a);
  }
  return t;
}
__name(Ra, "Ra");
function Ft(e) {
  let s = e.replace(/-/g, "");
  if (!s.startsWith("010")) throw new Error("Invalid phone number format. Must start with 010");
  if (s.length !== 11) throw new Error("Invalid phone number length. Must be 11 digits");
  return s;
}
__name(Ft, "Ft");
async function Ia(e, s) {
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
__name(Ia, "Ia");
async function va(e, s) {
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
__name(va, "va");
async function Qs(e, s) {
  await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(s.seller_id, s.template_code, s.recipient_phone, s.message, s.cost, s.status, s.order_id || null).run();
}
__name(Qs, "Qs");
async function Da(e, s, t) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(t, s).run();
}
__name(Da, "Da");
async function Oa(e, s) {
  try {
    const { order: t, products: r } = await Ia(e.DB, s), a = await va(e.DB, t.seller_id);
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

\uC8FC\uBB38\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4!`, c = await qs(e, { senderKey: a.sender_key, templateCode: "order_confirm", to: t.buyer_phone, message: i });
    return c.success ? (await Da(e.DB, t.seller_id, n), await Qs(e.DB, { seller_id: t.seller_id, template_code: "order_confirm", recipient_phone: t.buyer_phone, message: i, cost: n, status: "sent", order_id: s }), console.log(`Order confirmation sent for order ${s}`), { success: true }) : (await Qs(e.DB, { seller_id: t.seller_id, template_code: "order_confirm", recipient_phone: t.buyer_phone, message: i, cost: 0, status: "failed", order_id: s }), console.error(`Failed to send order confirmation for order ${s}:`, c.error), { success: false, error: c.error });
  } catch (t) {
    return console.error(`Error sending order confirmation for order ${s}:`, t), { success: false, error: t.message };
  }
}
__name(Oa, "Oa");
function Aa(e, s) {
  let t = e;
  return Object.entries(s).forEach(([r, a]) => {
    const n = new RegExp(`#{${r}}`, "g");
    t = t.replace(n, a);
  }), t;
}
__name(Aa, "Aa");
function ka(e, s) {
  const r = Array.from(e.matchAll(/#{(\w+)}/g), (a) => a[1]).filter((a) => !s[a]);
  return { valid: r.length === 0, missingVars: r };
}
__name(ka, "ka");
async function Na(e, s, t) {
  const r = await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(s).first();
  if (!r) throw new Error(`Account not found: ${s}`);
  return { sufficient: r.balance >= t, currentBalance: r.balance };
}
__name(Na, "Na");
async function Ca(e, s, t) {
  const r = await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(t, s, t).run();
  if (!r.success || r.meta.changes === 0) throw new Error("Insufficient balance or account not found");
}
__name(Ca, "Ca");
async function Zs(e, s, t) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t, s).run();
}
__name(Zs, "Zs");
async function As(e, s) {
  await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s.accountId, s.templateId, s.orderId || null, s.recipientPhone, s.messageContent, s.status, s.cost, s.aligoMessageId || null, s.failedReason || null).run();
}
__name(As, "As");
async function ja(e, s, t, r) {
  await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t, r, s).run();
}
__name(ja, "ja");
async function La(e, s, t, r, a, n, o, i, c) {
  try {
    const l = { ...i, ...o.variables }, u = Aa(r, l), d = await qs(e, { senderKey: a, templateCode: n, to: o.phone, message: u });
    return d.success ? (await As(e.DB, { accountId: s, templateId: t, recipientPhone: o.phone, messageContent: u, status: "sent", cost: c, aligoMessageId: d.messageId }), { phone: o.phone, status: "sent", messageId: d.messageId, cost: c }) : (await As(e.DB, { accountId: s, templateId: t, recipientPhone: o.phone, messageContent: u, status: "failed", cost: 0, failedReason: d.error }), await Zs(e.DB, s, c), { phone: o.phone, status: "failed", error: d.error, cost: 0 });
  } catch (l) {
    return console.error(`Failed to send alimtalk to ${o.phone}:`, l), await As(e.DB, { accountId: s, templateId: t, recipientPhone: o.phone, messageContent: "", status: "failed", cost: 0, failedReason: l.message }), await Zs(e.DB, s, c), { phone: o.phone, status: "failed", error: l.message, cost: 0 };
  }
}
__name(La, "La");
async function xs(e, s) {
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
    const c = ka(i.template_content, n);
    if (!c.valid) throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);
    const l = 15, u = a.length * l, d = await Na(e.DB, t, u);
    if (!d.sufficient) throw new Error(`Insufficient balance. Required: ${u}, Current: ${d.currentBalance}`);
    await Ca(e.DB, t, u), console.log(`[Alimtalk] Deducted ${u} points from account ${t}`);
    const m = [];
    let _ = 0, f = 0, g = 0;
    for (const S of a) {
      const w = await La(e, t, r, i.template_content, o.sender_key, i.template_code, S, n, l);
      m.push(w), w.status === "sent" ? _++ : (f++, g += l), m.length % 10 === 0 && await new Promise((E) => setTimeout(E, 1e3));
    }
    return await ja(e.DB, t, _, f), console.log(`[Alimtalk] Completed: ${_} sent, ${f} failed, ${g} refunded`), { success: true, totalRecipients: a.length, successCount: _, failedCount: f, refundedAmount: g, messages: m };
  } catch (o) {
    return console.error("[Alimtalk] Bulk send failed:", o), { success: false, totalRecipients: a.length, successCount: 0, failedCount: a.length, refundedAmount: 0, messages: [], error: o.message };
  }
}
__name(xs, "xs");
async function Ma(e, s, t, r, a) {
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
  return xs(e, { accountId: s, templateId: t, recipients: l, variables: c });
}
__name(Ma, "Ma");
async function $a(e, s, t, r, a = {}) {
  const n = r.map((o) => ({ phone: o.phone, name: o.name, variables: Object.entries(o).filter(([i]) => i !== "phone" && i !== "name").reduce((i, [c, l]) => ({ ...i, [c]: l }), {}) }));
  return xs(e, { accountId: s, templateId: t, recipients: n, variables: a });
}
__name($a, "$a");
function Ua(e, s = 0.1) {
  return Math.floor(e * s);
}
__name(Ua, "Ua");
function Pa() {
  const e = /* @__PURE__ */ new Date(), s = new Date(e.getFullYear(), e.getMonth() - 1, 1), t = s.getFullYear(), r = String(s.getMonth() + 1).padStart(2, "0"), a = new Date(t, s.getMonth() + 1, 0).getDate();
  return { startDate: `${t}-${r}-01`, endDate: `${t}-${r}-${a}` };
}
__name(Pa, "Pa");
async function qa(e, s, t) {
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
      const _ = m.total_amount - m.shipping_fee, f = Ua(_);
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
__name(qa, "qa");
async function xa(e, s) {
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
    const l = await qa(e, c.id, s);
    l && (r.push(l), a += l.total_sales, n += l.platform_fee, o += l.settlement_amount);
  }
  const i = { period: s, generated_at: (/* @__PURE__ */ new Date()).toISOString(), total_sales: a, total_platform_fee: n, total_settlement: o, sellers: r };
  return console.log(`[Settlement] Report generated: ${r.length} sellers, ${a.toLocaleString()}\uC6D0`), i;
}
__name(xa, "xa");
async function Ha(e, s) {
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
__name(Ha, "Ha");
async function Fa(e, s) {
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
__name(Fa, "Fa");
async function Ba(e, s) {
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
__name(Ba, "Ba");
async function Wa(e, s) {
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
__name(Wa, "Wa");
async function Ka(e, s) {
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
__name(Ka, "Ka");
async function Va(e, s) {
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
__name(Va, "Va");
async function Ya(e, s, t, r) {
  await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s, t, r.endpoint, r.keys.p256dh, r.keys.auth).run(), console.log(`[Push] Subscription saved for ${t} ${s}`);
}
__name(Ya, "Ya");
async function Ja(e, s) {
  await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(s).run(), console.log(`[Push] Subscription deleted: ${s}`);
}
__name(Ja, "Ja");
function za(e) {
  if (e.req.method !== "GET") return false;
  const s = e.req.header("Authorization"), t = e.req.header("X-Session-Token");
  if (s || t) return false;
  const a = new URL(e.req.url).pathname;
  return !(a.includes("/api/products/") && a.includes("/stock") || a.includes("/api/streams/") && a.includes("/status") || a.includes("/current-product") || a.includes("/api/chat") || a.includes("/api/sse") || a.includes("/api/orders") || a.includes("/api/payment"));
}
__name(za, "za");
function Ga(e, s) {
  return s || new URL(e.req.url).toString();
}
__name(Ga, "Ga");
function Xa(e) {
  const s = [];
  return s.push("public"), s.push(`max-age=${e.ttl}`), e.sMaxAge !== void 0 ? s.push(`s-maxage=${e.sMaxAge}`) : s.push(`s-maxage=${e.ttl}`), e.staleWhileRevalidate && s.push(`stale-while-revalidate=${e.staleWhileRevalidate}`), s.join(", ");
}
__name(Xa, "Xa");
function Hs(e) {
  return async (s, t) => {
    var i;
    if (e.skipCache || !za(s)) return t();
    const r = Ga(s, e.cacheKey), a = caches.default;
    let n = await a.match(r);
    if (n) {
      console.log(`[Cache HIT] ${r}`);
      const c = new Headers(n.headers);
      return c.set("X-Cache", "HIT"), c.set("X-Cache-Key", r), new Response(n.body, { status: n.status, statusText: n.statusText, headers: c });
    }
    console.log(`[Cache MISS] ${r}`), await t();
    const o = s.res;
    if (o.status >= 200 && o.status < 300) {
      const c = Xa(e);
      o.headers.set("Cache-Control", c), o.headers.set("X-Cache", "MISS"), o.headers.set("X-Cache-Key", r);
      const l = e.varyBy || ["Accept-Encoding"];
      o.headers.set("Vary", l.join(", "));
      const u = o.clone();
      (i = s.executionCtx) == null || i.waitUntil(a.put(r, u));
    }
  };
}
__name(Hs, "Hs");
var Fs = { products: { ttl: 10, sMaxAge: 60, staleWhileRevalidate: 120 }, liveStreams: { ttl: 5, sMaxAge: 10, staleWhileRevalidate: 30 }, microCache: { ttl: 10, sMaxAge: 10, staleWhileRevalidate: 30 } };
var Qa = class extends Error {
  static {
    __name(this, "Qa");
  }
  constructor(s, t, r, a) {
    super(r), this.statusCode = s, this.code = t, this.details = a, this.name = "AppError", Error.captureStackTrace(this, this.constructor);
  }
};
async function Za(e, s, t, r) {
  if (e) try {
    const a = { title: `\u2705 ${s}`, description: t, color: 3066993, fields: [], timestamp: (/* @__PURE__ */ new Date()).toISOString(), footer: { text: "UR LIVE Monitor" } };
    if (r) for (const [n, o] of Object.entries(r)) a.fields.push({ name: n, value: String(o), inline: true });
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [a] }) });
  } catch (a) {
    console.error("[Discord] Failed to send success alert:", a);
  }
}
__name(Za, "Za");
async function en(e, s, t) {
  if (e) try {
    const r = ["\u{1F4CA} **KV \uC0AC\uC6A9\uB7C9 \uACBD\uACE0**", "", "\uD604\uC7AC \uC0AC\uC6A9\uB7C9:", `\u2022 \uC77D\uAE30: ${s.toFixed(1)}%`, `\u2022 \uC4F0\uAE30: ${t.toFixed(1)}%`, "", "50% \uC774\uC0C1 \uC0AC\uC6A9 \uC911\uC785\uB2C8\uB2E4. \uC720\uB8CC \uD50C\uB79C \uC5C5\uADF8\uB808\uC774\uB4DC\uB97C \uACE0\uB824\uD558\uC138\uC694.", "https://dash.cloudflare.com"].join(`
`);
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: r }) });
  } catch (r) {
    console.error("[Discord] Failed to send KV warning:", r);
  }
}
__name(en, "en");
var sn = class {
  static {
    __name(this, "sn");
  }
  constructor(s) {
    this.databaseURL = s.FIREBASE_DATABASE_URL || "https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app", this.apiKey = s.FIREBASE_API_KEY || "AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s";
  }
  async set(s, t) {
    const r = `${this.databaseURL}/${s}.json`, a = await fetch(r, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    if (!a.ok) throw new Error(`Firebase set failed: ${a.statusText}`);
  }
  async update(s, t) {
    const r = `${this.databaseURL}/${s}.json`, a = await fetch(r, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    if (!a.ok) throw new Error(`Firebase update failed: ${a.statusText}`);
  }
  async get(s) {
    const t = `${this.databaseURL}/${s}.json`, r = await fetch(t, { method: "GET" });
    if (!r.ok) throw new Error(`Firebase get failed: ${r.statusText}`);
    return await r.json();
  }
  async delete(s) {
    const t = `${this.databaseURL}/${s}.json`, r = await fetch(t, { method: "DELETE" });
    if (!r.ok) throw new Error(`Firebase delete failed: ${r.statusText}`);
  }
  async updateStreamStatus(s, t) {
    await this.update(`streams/stream${s}`, { ...t, updated_at: Date.now() }), console.log(`\u2705 Firebase: Stream ${s} updated`, t);
  }
  async updateProductStock(s, t, r) {
    await this.update(`products/product${s}`, { id: s, stock: t, ...r, updated_at: Date.now() }), console.log(`\u2705 Firebase: Product ${s} stock updated to ${t}`);
  }
  async updateStreamProduct(s, t, r, a = false) {
    await this.update(`stream_products/stream${s}/products/product${t}`, { id: t, stock: r, is_current: a, updated_at: Date.now() }), console.log(`\u2705 Firebase: Stream ${s} product ${t} updated`);
  }
  async changeCurrentProduct(s, t) {
    await this.updateStreamStatus(s, { current_product_id: t });
    const r = await this.get(`stream_products/stream${s}/products`);
    if (r) {
      const a = {};
      for (const n in r) a[`stream_products/stream${s}/products/${n}/is_current`] = false;
      a[`stream_products/stream${s}/products/product${t}/is_current`] = true, await Promise.all(Object.entries(a).map(([n, o]) => this.update(n, o)));
    }
    console.log(`\u2705 Firebase: Stream ${s} current product changed to ${t}`);
  }
  async sendLowStockAlert(s, t, r) {
    const a = `chats/stream${s}`, n = Date.now();
    await this.set(`${a}/alert_${n}`, { username: "\uC2DC\uC2A4\uD15C", text: `\u26A0\uFE0F ${t}\uC758 \uC7AC\uACE0\uAC00 ${r}\uAC1C \uB0A8\uC558\uC2B5\uB2C8\uB2E4!`, timestamp: n, isSystem: true }), console.log(`\u2705 Firebase: Low stock alert sent for stream ${s}`);
  }
  async sendSoldOutAlert(s, t) {
    const r = `chats/stream${s}`, a = Date.now();
    await this.set(`${r}/soldout_${a}`, { username: "\uC2DC\uC2A4\uD15C", text: `\u{1F534} ${t}\uC774(\uAC00) \uD488\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4!`, timestamp: a, isSystem: true }), console.log(`\u2705 Firebase: Sold out alert sent for stream ${s}`);
  }
};
function Bt(e) {
  return new sn(e);
}
__name(Bt, "Bt");
var ue = /* @__PURE__ */ new Map();
var z = { hits: 0, misses: 0, writes: 0, evictions: 0 };
function Se(e) {
  const s = ue.get(e);
  return s ? s.expires < Date.now() ? (ue.delete(e), z.evictions++, z.misses++, null) : (z.hits++, s.data) : (z.misses++, null);
}
__name(Se, "Se");
function Z(e, s, t) {
  const r = Date.now() + t * 1e3;
  if (ue.set(e, { data: s, expires: r }), z.writes++, ue.size > 1e3) {
    const a = ue.keys().next().value;
    a && (ue.delete(a), z.evictions++);
  }
}
__name(Z, "Z");
function tn(e) {
  let s = 0;
  for (const t of ue.keys()) t.includes(e) && (ue.delete(t), s++);
  return s;
}
__name(tn, "tn");
async function Ye(e, s) {
  const t = Array.isArray(s) ? s : [s];
  for (const r of t) {
    const a = tn(r);
    a > 0 && console.log(`[Cache] \u{1F9F9} \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uC0AD\uC81C: ${r} (${a}\uAC1C)`);
    try {
      await e.CACHE_KV.delete(r), console.log(`[Cache] \u{1F9F9} KV \uCE90\uC2DC \uC0AD\uC81C: ${r}`);
    } catch (n) {
      console.error(`[Cache] \u274C KV \uCE90\uC2DC \uC0AD\uC81C \uC2E4\uD328: ${r}`, n);
    }
  }
}
__name(Ye, "Ye");
var Je = { LIVE_STREAMS: ["streams:live", "streams:all", "streams:scheduled", "live_streams:live:all:20:0", "live_streams:"], PRODUCTS: ["products:", "featured_products"], CART: /* @__PURE__ */ __name((e) => [`cart:${e}`], "CART"), ORDERS: /* @__PURE__ */ __name((e) => [`orders:${e}`], "ORDERS"), ALL: ["streams:", "live_streams:", "products:", "cart:", "orders:"] };
function rn(e) {
  const s = e.status >= 500 ? "error" : e.status >= 400 ? "warn" : "info";
  console.log(JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: s, message: "API Request", context: e, duration: e.duration }));
}
__name(rn, "rn");
function an(e) {
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
__name(an, "an");
function nn(e, s) {
  switch (e.toLowerCase()) {
    case "tosspayments":
      return an(s);
    default:
      throw new Error(`Unknown payment provider: ${e}`);
  }
}
__name(nn, "nn");
var p = new Ls();
p.use("*", async (e, s) => {
  if (e.req.url.includes("localhost") || e.req.url.includes("127.0.0.1")) try {
    Gr(e.env), Xr(e.env);
  } catch (r) {
    console.error("[ENV] Validation failed:", r);
  }
  await s();
});
async function on2(e) {
  try {
    const s = e.req.header("Authorization"), t = (s == null ? void 0 : s.replace("Bearer ", "")) || "";
    if (!t) return console.warn("[JWT Auth] No token provided"), null;
    const r = ce(e.env), a = await $s(t, r);
    return a ? { userId: a.userId, userType: a.userType, email: a.email } : (console.warn("[JWT Auth] Invalid or expired token"), null);
  } catch (s) {
    return console.error("[JWT Auth Error]", s), null;
  }
}
__name(on2, "on");
async function je(e, s, t) {
  if (!s) return null;
  const r = `session:${s}`;
  try {
    const a = Se(r);
    if (a) return a;
    const n = await e.get(r);
    if (!n) return null;
    const o = JSON.parse(n);
    if (o.expires_at && Date.now() > o.expires_at) return t != null && t.executionCtx || await e.delete(r), null;
    const i = { user_id: o.user_id, user_type: o.user_type || "user", created_at: o.created_at };
    return Z(r, i, 900), i;
  } catch (a) {
    return console.error("[Auth] Session lookup error:", a), null;
  }
}
__name(je, "je");
async function j(e, s) {
  const t = await on2(e);
  if (!t) return e.json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" }, 401);
  e.set("user", { userId: t.userId, userType: t.userType, email: t.email }), e.set("userId", t.userId), e.set("userType", t.userType), e.set("email", t.email), await s();
}
__name(j, "j");
async function cn(e, s) {
  const t = e.get("userType"), r = e.get("userId");
  if (t !== "admin") return console.warn("[Security] Unauthorized admin access attempt:", { userId: r, userType: t }), e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await s();
}
__name(cn, "cn");
async function ln(e, s) {
  const t = e.get("userType"), r = e.get("userId");
  if (t !== "seller") return console.warn("[Security] Unauthorized seller access attempt:", { userId: r, userType: t }), e.json({ success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  await s();
}
__name(ln, "ln");
async function un(e) {
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
__name(un, "un");
async function dn(e, s) {
  try {
    const t = Se(s);
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
__name(dn, "dn");
async function rs(e, s, t, r = 60, a = false) {
  try {
    Z(s, t, r), a ? (await e.put(s, JSON.stringify(t), { expirationTtl: r }), console.log(`[Cache] \u2705 Saved to both Memory + KV: ${s}`)) : console.log(`[Cache] \u2705 Saved to Memory only (KV Write skipped): ${s}`);
  } catch (n) {
    console.error("[Cache] Write error:", n);
  }
}
__name(rs, "rs");
async function Bs(e, ...s) {
  try {
    await Promise.all(s.map((t) => e.delete(t)));
  } catch (t) {
    console.error("[Cache] Delete error:", t);
  }
}
__name(Bs, "Bs");
async function ms(e, s, t, r, a, n, o) {
  try {
    await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s, t, r, a, n, o || null).run(), console.log(`[Notification] Created for ${t} ${s}: ${a}`);
  } catch (i) {
    console.error("[Notification] Create error:", i);
  }
}
__name(ms, "ms");
async function pn(e, s, t, r, a) {
  await ms(e, s, "seller", "new_order", "\u{1F6D2} \uC2E0\uADDC \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r}\uB2D8\uC758 \uC8FC\uBB38 (${t}) - ${mn(a)}`, "/seller/orders");
}
__name(pn, "pn");
async function Wt(e, s, t, r, a, n) {
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
  await ms(e, s, "user", "shipping_status", o, i, "/my-orders");
}
__name(Wt, "Wt");
async function Kt(e, s, t, r, a) {
  await ms(e, s, "seller", "low_stock", "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", `${t}\uC758 \uC7AC\uACE0\uAC00 ${r}\uAC1C\uB85C \uBD80\uC871\uD569\uB2C8\uB2E4 (\uAE30\uC900: ${a}\uAC1C)`, "/seller/products");
}
__name(Kt, "Kt");
function mn(e) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(e);
}
__name(mn, "mn");
async function _n(e, s, t) {
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
__name(_n, "_n");
async function fn(e, s) {
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
__name(fn, "fn");
async function hn(e, s, t) {
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
__name(hn, "hn");
async function En(e, s) {
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
__name(En, "En");
function Vt(e) {
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
__name(Vt, "Vt");
function Yt(e) {
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
__name(Yt, "Yt");
function gn(e) {
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
__name(gn, "gn");
function Jt(e) {
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
__name(Jt, "Jt");
p.use("*", async (e, s) => {
  await s(), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");
  const t = new URL(e.req.url);
  t.hostname !== "localhost" && t.protocol === "https:" && e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("X-Frame-Options", "SAMEORIGIN"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
p.use("/api/*", b());
p.use(Ne(Ce.auth));
p.use(Ne(Ce.alimtalk));
p.use(Ne(Ce.order));
p.use(Ne(Ce.refund));
p.use(Ne(Ce.cart));
p.use(Ne(Ce.upload));
p.use("/api/*", Ne(Ce.api));
p.use("*", async (e, s) => {
  await s(), e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"), e.header("X-Frame-Options", "DENY"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
p.use("/api/*", async (e, s) => {
  const t = Date.now(), r = e.req.method, a = e.req.path;
  await s();
  const n = Date.now() - t, o = e.res.status, i = { method: r, path: a, status: o, duration: n }, c = e.get("userId");
  c && (i.userId = c), rn(i);
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
  const r = await cn(e, () => Promise.resolve());
  return r || s();
});
p.use("/api/seller*", async (e, s) => {
  if (e.req.path === "/api/seller/register") return s();
  const t = await j(e, () => Promise.resolve());
  if (t) return t;
  const r = await ln(e, () => Promise.resolve());
  return r || s();
});
async function ze(e, s) {
  const t = await e.get(`session:${s}`);
  if (!t) return null;
  const r = JSON.parse(t);
  return r.expires_at && Date.now() > r.expires_at ? (await e.delete(`session:${s}`), null) : { session_token: s, [`${r.user_type}_id`]: r.user_id, user_type: r.user_type, ...r.userData };
}
__name(ze, "ze");
p.post("/api/auth/user/register", b(), ha(Sa), async (e) => {
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
p.post("/api/auth/user/login", b(), async (e) => {
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
p.post("/api/auth/login", b(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { username: t, password: r, userType: a } = await e.req.json(), n = e.req.header("CF-Connecting-IP") || e.req.header("X-Forwarded-For") || "Unknown", o = e.req.header("User-Agent") || "Unknown";
    if (!t || !r || !a) return e.json({ success: false, error: "\uC544\uC774\uB514\uC640 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    let i, c = a === "admin" ? "admins" : "sellers";
    if (a === "admin" ? i = await s.prepare(`
        SELECT 
          id, 
          username, 
          email, 
          password_hash, 
          name, 
          is_active, 
          last_login_at
        FROM ${c} 
        WHERE username = ? OR email = ?
      `).bind(t, t).first() : i = await s.prepare(`
        SELECT 
          id, 
          username, 
          email, 
          password_hash, 
          name, 
          is_active, 
          status, 
          last_login_at, 
          business_name
        FROM ${c} 
        WHERE username = ? OR email = ?
      `).bind(t, t).first(), !i) {
      const { sendDiscordAlert: P, addLoginHistory: q } = await Promise.resolve().then(() => ks);
      return q(n, false), await P({ type: "login_failure", username: t, userType: a, ip: n, userAgent: o, timestamp: (/* @__PURE__ */ new Date()).toISOString(), details: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uACC4\uC815" }, e.env.DISCORD_WEBHOOK_URL), e.json({ success: false, error: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    }
    const l = a === "admin" && (t === "admin" || t === "admin@example.com") && r === "admin123", u = a === "seller" && (t === "seller1" && r === "seller123" || t === "seller2" && r === "seller123"), d = i.password_hash && i.password_hash.includes(`placeholder_hash_for_${r}`);
    if (!(l || u || d)) {
      const { sendDiscordAlert: P, addLoginHistory: q, detectSuspiciousLogin: L, getLoginHistory: M } = await Promise.resolve().then(() => ks);
      q(n, false);
      const K = M(n), B = L(n, o, a, K);
      return await P({ type: B ? "suspicious_login" : "login_failure", userId: i.id, username: i.username, userType: a, ip: n, userAgent: o, timestamp: (/* @__PURE__ */ new Date()).toISOString(), details: B ? "\u26A0\uFE0F 5\uBD84 \uB0B4 3\uD68C \uC774\uC0C1 \uC2E4\uD328 \uB610\uB294 \uC758\uC2EC\uC2A4\uB7EC\uC6B4 \uD328\uD134" : "\uBE44\uBC00\uBC88\uD638 \uBD88\uC77C\uCE58", metadata: { "\uCD5C\uADFC \uC2E4\uD328 \uD69F\uC218": K.filter((I) => !I.success).length.toString() } }, e.env.DISCORD_WEBHOOK_URL), e.json({ success: false, error: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    }
    if (!i.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    if (a === "seller" && i.status !== "approved") return e.json({ success: false, error: "\uC2B9\uC778 \uB300\uAE30 \uC911\uC778 \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    const { generateAccessToken: _, generateRefreshToken: f, getJwtSecret: g } = await Promise.resolve().then(() => Pt), S = g(e.env), w = await _({ userId: i.id, userType: a, email: i.email }, S), E = await f({ userId: i.id, userType: a, email: i.email }, S);
    await s.prepare(`UPDATE ${c} SET last_login_at = datetime('now') WHERE id = ?`).bind(i.id).run();
    const { sendDiscordAlert: T, addLoginHistory: y, detectSuspiciousLogin: R, getLoginHistory: U } = await Promise.resolve().then(() => ks);
    y(n, true);
    const A = U(n), O = R(n, o, a, A);
    return (a === "admin" || O) && await T({ type: O ? "suspicious_login" : "login_success", userId: i.id, username: i.username, userType: a, ip: n, userAgent: o, timestamp: (/* @__PURE__ */ new Date()).toISOString(), details: O ? "\u26A0\uFE0F \uC758\uC2EC\uC2A4\uB7EC\uC6B4 \uD328\uD134 \uAC10\uC9C0 (\uAD00\uB9AC\uC790 \uB85C\uADF8\uC778 \uB610\uB294 \uBE44\uC815\uC0C1 User Agent)" : void 0 }, e.env.DISCORD_WEBHOOK_URL), console.log(`[JWT Login] \u2705 ${a} ${i.username} logged in with JWT (KV Write: 0)`), e.json({ success: true, data: { accessToken: w, refreshToken: E, user: { id: i.id, username: i.username, name: i.name, email: i.email, type: a, businessName: i.business_name } } });
  } catch (t) {
    return console.error("Login error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/auth/logout", b(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token");
    return t && await e.env.SESSION_KV.delete(`session:${t}`), e.json({ success: true });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/register", b(), async (e) => {
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
p.post("/api/admin/login", b(), async (e) => {
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
    const { generateAccessToken: i, generateRefreshToken: c, getJwtSecret: l } = await Promise.resolve().then(() => Pt), u = l(e.env), d = await i({ userId: a.id, userType: "admin", email: a.email }, u), m = await c({ userId: a.id, userType: "admin", email: a.email }, u);
    return await s.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(), console.log(`[JWT Login] \u2705 Admin ${a.email} logged in with JWT (KV Write: 0)`), e.json({ success: true, data: { accessToken: d, refreshToken: m, admin: { id: a.id, username: a.username, email: a.email, name: a.name } } });
  } catch (t) {
    return console.error("Admin login error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/auth/verify", b(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const r = await ze(e.env.SESSION_KV, t);
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
    const g = e.req.query("code"), S = e.req.query("state") || "/", w = e.req.query("error");
    if (console.log("[Kakao Sync] Query params:", { hasCode: !!g, state: S, error: w }), w) return console.error("[Kakao Sync] OAuth error:", w), e.redirect(`${S}?error=kakao_oauth_${w}`);
    if (!g) return console.error("[Kakao Sync] No authorization code"), e.redirect(`${S}?error=no_code`);
    console.log("[Kakao Sync] Authorization code received");
    const E = e.env.KAKAO_REST_API_KEY || "5dd74bccb797640b0efd070467f3bafd", T = `${new URL(e.req.url).origin}/auth/kakao/sync/callback`;
    console.log("[Kakao Sync] Exchanging code for token..."), console.log("  - REST_API_KEY:", E.substring(0, 10) + "..."), console.log("  - REDIRECT_URI:", T), console.log("[Kakao Sync] Step 1: Fetching access token...");
    const y = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: E, redirect_uri: T, code: g }) });
    if (console.log("[Kakao Sync] Token response status:", y.status), console.log("[Kakao Sync] Token request details:", { client_id: E, redirect_uri: T, code_length: g.length, code_prefix: g.substring(0, 20) }), !y.ok) {
      const F = await y.text();
      return console.error("[Kakao Sync] Token request failed:", F), e.redirect(`${S}?error=token_request_failed&detail=${encodeURIComponent(F)}`);
    }
    const R = await y.json();
    if (console.log("[Kakao Sync] Token data received:", { hasAccessToken: !!R.access_token, error: R.error, errorDescription: R.error_description }), !R.access_token) return console.error("[Kakao Sync] Token error:", R), e.redirect(`${S}?error=token_failed&detail=${encodeURIComponent(R.error || "unknown")}`);
    console.log("[Kakao Sync] Access token obtained successfully"), console.log("[Kakao Sync] Step 2: Fetching user info...");
    const U = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${R.access_token}` } });
    console.log("[Kakao Sync] User response status:", U.status);
    const A = await U.json();
    if (console.log("[Kakao Sync] User data received:", { hasId: !!A.id, id: A.id, hasNickname: !!((t = A.properties) != null && t.nickname || (a = (r = A.kakao_account) == null ? void 0 : r.profile) != null && a.nickname) }), !A.id) return console.error("[Kakao Sync] Failed to get user info:", A), e.redirect(`${S}?error=user_info_failed`);
    console.log("[Kakao Sync] User info obtained successfully"), console.log("[Kakao Sync] Step 2.5: Fetching service terms...");
    const O = await fetch("https://kapi.kakao.com/v2/user/service_terms", { headers: { Authorization: `Bearer ${R.access_token}` } });
    console.log("[Kakao Sync] Terms response status:", O.status);
    let P = null;
    if (O.ok ? (P = await O.json(), console.log("[Kakao Sync] Service terms received:", { allowedServiceTerms: ((n = P.allowed_service_terms) == null ? void 0 : n.length) || 0, tags: (o = P.allowed_service_terms) == null ? void 0 : o.map((F) => F.tag) })) : console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"), console.log("[Kakao Sync] Step 3: Saving user to database..."), !s) return console.error("[Kakao Sync] DB is not available!"), e.redirect(`${S}?error=db_not_available`);
    const q = A.id.toString(), L = ((i = A.properties) == null ? void 0 : i.nickname) || ((l = (c = A.kakao_account) == null ? void 0 : c.profile) == null ? void 0 : l.nickname) || "Kakao User", M = ((u = A.kakao_account) == null ? void 0 : u.email) || "", K = ((d = A.properties) == null ? void 0 : d.profile_image) || ((_ = (m = A.kakao_account) == null ? void 0 : m.profile) == null ? void 0 : _.profile_image_url) || "", B = R.access_token, I = ((f = P == null ? void 0 : P.allowed_service_terms) == null ? void 0 : f.map((F) => F.tag)) || [], ee = JSON.stringify(I);
    console.log("[Kakao Sync] User data:", { kakaoId: q, nickname: L, email: M ? "exists" : "none", serviceTerms: I });
    try {
      const F = await s.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(q).first();
      console.log("[Kakao Sync] Existing user check:", !!F);
      let x;
      F ? (x = F.id, await s.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L, M, K, x).run(), console.log("[Kakao Sync] Updated user:", x)) : (x = (await s.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(q, L, M || null, K || null).run()).meta.last_row_id, console.log("[Kakao Sync] Created user:", x)), console.log("[Kakao Sync] User saved successfully, userId:", x), console.log("[Kakao Sync] Step 4: Generating JWT tokens...");
      const J = ce(e.env), le = await ke({ userId: x, userType: "user", email: M || void 0 }, J), _s = await us({ userId: x, userType: "user", email: M || void 0 }, J);
      console.log("[Kakao Sync] \u2705 JWT \uD1A0\uD070 \uBC1C\uAE09 \uC644\uB8CC for user:", x), console.log("[Kakao Sync] Step 5: Redirecting with JWT...");
      const Ge = S.includes("?") ? `${S}&access_token=${encodeURIComponent(le)}&refresh_token=${encodeURIComponent(_s)}&userId=${x}&userName=${encodeURIComponent(L)}&userEmail=${encodeURIComponent(M || "")}` : `${S}?access_token=${encodeURIComponent(le)}&refresh_token=${encodeURIComponent(_s)}&userId=${x}&userName=${encodeURIComponent(L)}&userEmail=${encodeURIComponent(M || "")}`;
      return console.log("[Kakao Sync] Redirect URL (JWT):", Ge.substring(0, 100) + "..."), e.redirect(Ge);
    } catch (F) {
      return console.error("[Kakao Sync] Database error:", F), console.error("[Kakao Sync] DB error details:", { message: F.message, name: F.name }), e.redirect(`${S}?error=database_error&detail=${encodeURIComponent(F.message)}`);
    }
  } catch (g) {
    console.error("[Kakao Sync] Exception:", g), console.error("[Kakao Sync] Error details:", { message: g.message, stack: g.stack, name: g.name });
    const S = e.req.query("state") || "/", w = encodeURIComponent(g.message || "unknown");
    return e.redirect(`${S}?error=kakao_sync_failed&detail=${w}`);
  }
});
p.post("/api/auth/kakao/callback", b(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { code: t, redirect_uri: r } = await e.req.json();
    if (!t) return e.json({ success: false, error: "Authorization code is required" }, 400);
    if (!e.env.KAKAO_REST_API_KEY) return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"), e.json({ success: false, error: "Server configuration error", code: "MISSING_API_KEY" }, 500);
    const a = r || "https://live.ur-team.com/auth/kakao/callback";
    console.log("[Kakao Callback] Starting OAuth flow");
    const n = await ua(t, a, e.env.KAKAO_REST_API_KEY), { user: o } = await xt(s, n), i = ce(e.env), c = await ke({ userId: o.id, userType: "user", email: o.email || void 0 }, i), l = await us({ userId: o.id, userType: "user", email: o.email || void 0 }, i);
    return console.log("[Kakao Callback] \u2705 JWT \uD1A0\uD070 \uBC1C\uAE09 \uC644\uB8CC for user:", o.id), e.json({ success: true, data: { accessToken: c, refreshToken: l, user: { id: o.id, name: o.name, email: o.email, profile_image: o.profile_image } } });
  } catch (t) {
    return console.error("[Kakao Callback] Error:", t), t instanceof te ? e.json({ success: false, error: t.message, code: t.code }, t.statusCode) : e.json({ success: false, error: t.message || "Internal server error", code: "UNKNOWN_ERROR" }, 500);
  }
});
p.post("/api/auth/kakao/sync", b(), async (e) => {
  const { DB: s } = e.env;
  try {
    const { accessToken: t } = await e.req.json();
    if (!t) return e.json({ success: false, error: "Access token is required" }, 400);
    console.log("[Kakao Sync] Verifying access token");
    const r = Date.now(), { user: a } = await xt(s, t);
    console.log("[Kakao Sync] ProcessKakaoLogin completed in", Date.now() - r, "ms");
    const n = ce(e.env), o = await ke({ userId: a.id, userType: "user", email: a.email || void 0 }, n), i = await us({ userId: a.id, userType: "user", email: a.email || void 0 }, n);
    return console.log("[Kakao Sync] \u2705 JWT \uD1A0\uD070 \uBC1C\uAE09 \uC644\uB8CC for user:", a.id), console.log("[Kakao Sync] Total login time:", Date.now() - r, "ms"), e.json({ success: true, data: { accessToken: o, refreshToken: i, user: { id: a.id, name: a.name, email: a.email, profile_image: a.profile_image } } });
  } catch (t) {
    return console.error("[Kakao Sync] Error:", t), t instanceof te ? e.json({ success: false, error: t.message, code: t.code }, t.statusCode) : e.json({ success: false, error: t instanceof Error ? t.message : "Login failed", code: "UNKNOWN_ERROR" }, 500);
  }
});
p.get("/api/auth/validate", b(), async (e) => {
  try {
    const s = e.req.header("Authorization"), t = (s == null ? void 0 : s.replace("Bearer ", "")) || "";
    if (!t) return e.json({ success: false, valid: false, error: "No JWT token provided", code: "NO_TOKEN" }, 401);
    const r = ce(e.env);
    console.log("[JWT Validate] Secret (first 20 chars):", r.substring(0, 20)), console.log("[JWT Validate] Token (first 50 chars):", t.substring(0, 50));
    const a = await $s(t, r);
    return console.log("[JWT Validate] Payload:", a ? "Valid" : "Invalid/Expired"), a ? e.json({ success: true, valid: true, data: { user_id: a.userId, user_type: a.userType, email: a.email, session_valid: true }, user: { userId: a.userId, userType: a.userType, email: a.email } }) : e.json({ success: false, valid: false, error: "JWT token expired or invalid", code: "TOKEN_EXPIRED" }, 401);
  } catch (s) {
    return console.error("[JWT Validate Error]", s), e.json({ success: false, valid: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
  }
});
p.post("/api/auth/refresh", b(), async (e) => {
  try {
    const s = await e.req.json(), { refreshToken: t } = s;
    if (!t) return e.json({ success: false, error: "No refresh token provided", code: "NO_REFRESH_TOKEN" }, 400);
    const r = ce(e.env), a = await $t(t, r);
    return a ? e.json({ success: true, data: { accessToken: a } }) : e.json({ success: false, error: "Refresh token expired or invalid", code: "REFRESH_TOKEN_EXPIRED" }, 401);
  } catch (s) {
    return console.error("[JWT Refresh Error]", s), e.json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
  }
});
p.post("/api/auth/kakao/logout", b(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token") || "";
    return t && (await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(), console.log("[Kakao Sync] Session deleted")), e.json({ success: true });
  } catch (t) {
    return console.error("[Kakao Sync] Logout error:", t), e.json({ success: false, error: "Logout failed" }, 500);
  }
});
p.post("/api/auth/kakao/unlink", b(), async (e) => {
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
p.get("/api/auth/user/verify", b(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const r = await ze(e.env.SESSION_KV, t);
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
p.get("/api/shipping-addresses", b(), j, async (e) => {
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
p.get("/api/shipping-addresses/:userId", b(), j, async (e) => {
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
p.post("/api/shipping-addresses", b(), j, async (e) => {
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
p.put("/api/shipping-addresses/:id", b(), j, async (e) => {
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
p.delete("/api/shipping-addresses/:id", b(), async (e) => {
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
async function H(e) {
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
  const r = await ze(e.env.SESSION_KV, t);
  return !r || r.user_type !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: r.admin_id, userData: r };
}
__name(H, "H");
async function N(e) {
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
  const r = await ze(e.env.SESSION_KV, t);
  return !r || r.user_type !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: r.seller_id, userData: r };
}
__name(N, "N");
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
    const s = await ea(e.env);
    return e.json(s);
  } catch (s) {
    return e.json({ success: false, error: "\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uC2E4\uD589 \uC911 \uC624\uB958 \uBC1C\uC0DD", details: s instanceof Error ? s.message : String(s) }, 500);
  }
});
p.get("/api/streams", Hs(Fs.liveStreams), async (e) => {
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
    const o = `live_streams:${t || "all"}:${r || "all"}:${a}:${n}`, i = 60, c = Se(o);
    if (c) return console.log("[LiveStreams] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", o), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStreams] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", o);
        const u = await et(s, t, r, a, n);
        Z(o, u, i), console.log("[LiveStreams] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", o);
      } catch (u) {
        console.error("[LiveStreams] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", u);
      }
    })()), e.json({ success: true, data: c });
    console.log("[LiveStreams] \u{1F4BE} DB \uC870\uD68C:", o);
    const l = await et(s, t, r, a, n);
    return Z(o, l, i), e.json({ success: true, data: l });
  } catch (o) {
    return console.error("[API] Live streams list error:", o), e.json({ success: false, error: `\uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${o.message}` }, 500);
  }
});
async function et(e, s, t, r, a) {
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
__name(et, "et");
p.get("/api/live-streams/:id", async (e) => {
  const { DB: s } = e.env, t = e.req.param("id");
  try {
    const r = `live_stream:${t}`, a = 30, n = Se(r);
    if (n) return console.log("[LiveStream] \u26A1 \uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD788\uD2B8:", r), e.executionCtx.waitUntil((async () => {
      try {
        console.log("[LiveStream] \u{1F504} \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2DC\uC791:", r);
        const i = await st(s, t);
        i && (Z(r, i, a), console.log("[LiveStream] \u2705 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC644\uB8CC:", r));
      } catch (i) {
        console.error("[LiveStream] \u274C \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0 \uC2E4\uD328:", i);
      }
    })()), e.json({ success: true, data: n });
    console.log("[LiveStream] \u{1F4BE} DB \uC870\uD68C:", r);
    const o = await st(s, t);
    return o ? (Z(r, o, a), e.json({ success: true, data: o })) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
async function st(e, s) {
  return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first();
}
__name(st, "st");
p.get("/api/products", Hs(Fs.products), async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = e.req.query("featured"), a = parseInt(e.req.query("limit") || "20"), n = parseInt(e.req.query("offset") || "0"), o = `products:list:${r || "all"}:${a}:${n}`, i = Se(o);
    if (i) return e.executionCtx.waitUntil((async () => {
      try {
        const l = await tt(s, r, a, n);
        Z(o, l, 3600), await rs(t, o, l, 300, false);
      } catch (l) {
        console.error("[Cache Revalidate] Products error:", l);
      }
    })()), e.json({ success: true, data: i, cached: true });
    const c = await tt(s, r, a, n);
    return Z(o, c, 3600), await rs(t, o, c, 300, false), e.json({ success: true, data: c, cached: false });
  } catch (r) {
    return console.error("Products list error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
async function tt(e, s, t, r) {
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
__name(tt, "tt");
p.get("/api/products/popular", async (e) => {
  const { DB: s, CACHE_KV: t } = e.env;
  try {
    const r = "products:popular", a = Se(r);
    if (a) return e.executionCtx.waitUntil((async () => {
      try {
        const o = await rt(s);
        Z(r, o, 3600), await rs(t, r, o, 600, false);
      } catch (o) {
        console.error("[Cache Revalidate] Popular products error:", o);
      }
    })()), e.json({ success: true, data: a, cached: true });
    const n = await rt(s);
    return Z(r, n, 3600), await rs(t, r, n, 600, false), e.json({ success: true, data: n, cached: false });
  } catch (r) {
    return console.error("Popular products error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
async function rt(e) {
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
__name(rt, "rt");
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
    const r = `product:detail:${t}`, a = Se(r);
    if (a) return e.executionCtx.waitUntil((async () => {
      try {
        const o = await at(s, t);
        Z(r, o, 1800);
      } catch (o) {
        console.error("[Cache Revalidate] Product detail error:", o);
      }
    })()), e.json({ success: true, data: a, cached: true });
    const n = await at(s, t);
    return n ? (Z(r, n, 1800), e.json({ success: true, data: n, cached: false })) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
async function at(e, s) {
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
__name(at, "at");
p.get("/api/products/:id/stock", Hs(Fs.microCache), async (e) => {
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
p.post("/api/cart", j, async (e) => {
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
p.delete("/api/cart/clear/:userId", j, un("cart"), async (e) => {
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
    const t = await e.req.json(), { userId: r, cartItemIds: a, shippingInfo: n, items: o, shippingAddress: i, shippingAddressDetail: c, recipientName: l, recipientPhone: u, deliveryMemo: d, totalAmount: m, shippingFee: _, orderNumber: f, paymentKey: g, paymentMethod: S } = t;
    if (o && o.length > 0) {
      const O = o.map(($) => $.productId), P = O.map(() => "?").join(","), q = await s.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${P})
      `).bind(...O).all(), L = new Map(q.results.map(($) => [$.id, $])), M = [], K = [];
      try {
        for (const $ of o) {
          const re = L.get($.productId);
          if (!re) throw new Error(`\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${$.productId})`);
          if (re.stock - (re.reserved_stock || 0) < $.quantity) throw new Error(`\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uBC29\uAE08 \uC0C1\uD488\uC774 \uBAA8\uB450 \uD310\uB9E4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${re.name})`);
          if ((await s.prepare(`
            UPDATE products 
            SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND (stock - reserved_stock) >= ?
          `).bind($.quantity, $.productId, $.quantity).run()).meta.changes === 0) throw new Error(`\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uBC29\uAE08 \uC0C1\uD488\uC774 \uBAA8\uB450 \uD310\uB9E4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${re.name})`);
          console.log(`[Stock] \u2705 \uC7AC\uACE0 \uC608\uC57D \uC131\uACF5: ${re.name} (${$.quantity}\uAC1C)`), K.push({ product_id: $.productId, quantity: $.quantity }), M.push({ product_id: $.productId, option_id: $.optionId || null, quantity: $.quantity, price: $.price, product_name: re.name, product_stock: re.stock });
        }
      } catch ($) {
        if (console.error("[Stock] \u274C \uC7AC\uACE0 \uC608\uC57D \uC2E4\uD328:", $.message), K.length > 0) {
          console.log(`[Stock] \u{1F504} ${K.length}\uAC1C \uC0C1\uD488 \uC608\uC57D \uB864\uBC31 \uC2DC\uC791...`);
          for (const re of K) await s.prepare(`
              UPDATE products 
              SET reserved_stock = reserved_stock - ?
              WHERE id = ?
            `).bind(re.quantity, re.product_id).run();
          console.log("[Stock] \u2705 \uC608\uC57D \uB864\uBC31 \uC644\uB8CC");
        }
        return e.json({ success: false, error: $.message }, 400);
      }
      const B = /* @__PURE__ */ new Date(), I = B.getFullYear().toString().slice(-2), ee = (B.getMonth() + 1).toString().padStart(2, "0"), F = B.getDate().toString().padStart(2, "0"), x = `${I}${ee}${F}`, J = Math.random().toString(36).substring(2, 7).toUpperCase(), le = f || `ORD-${x}-${J}`, _s = c ? `${i} ${c}` : i, Ge = new Date(Date.now() + 600 * 1e3).toISOString(), Ws = (await s.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, reservation_expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(le, r || null, m || 0, "pending", "pending", _s || null, l || null, u || null, d || null, g || null, Ge).run()).meta.last_row_id;
      for (const $ of M) await s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ws, $.product_id, $.option_id, $.quantity, $.price, $.product_name).run();
      return console.log(`[Order] \u2705 \uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC: ${le} (\uC608\uC57D \uB9CC\uB8CC: ${Ge})`), e.json({ success: true, data: { orderId: Ws, orderNumber: le, totalAmount: m } });
    }
    if (!a || a.length === 0) return e.json({ success: false, error: "No items provided" }, 400);
    const w = a.map(() => "?").join(","), E = await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${w})
    `).bind(...a).all();
    if (E.results.length === 0) return e.json({ success: false, error: "No items found" }, 400);
    for (const O of E.results) if (O.product_stock < O.quantity) return e.json({ success: false, error: `Insufficient stock for ${O.product_name}` }, 400);
    const T = E.results.reduce((O, P) => O + P.price_snapshot * P.quantity, 0), y = `ORD${Date.now()}${Math.floor(Math.random() * 1e3)}`, U = (await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(y, r, T, n.address, n.name, n.phone).run()).meta.last_row_id, A = [];
    for (const O of E.results) {
      let P = false, q = "";
      for (let L = 0; L < 3; L++) {
        const M = await s.prepare(`
          SELECT stock, version FROM products WHERE id = ?
        `).bind(O.product_id).first();
        if (!M) {
          q = `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${O.product_name}`;
          break;
        }
        const K = M.stock, B = M.version;
        if (K < O.quantity) {
          q = `\uC7AC\uACE0 \uBD80\uC871: ${O.product_name} (\uB0A8\uC740 \uC7AC\uACE0: ${K}\uAC1C)`;
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
        `).bind(O.quantity, O.product_id, B, O.quantity).run()).meta.changes > 0) {
          P = true, console.log(`[\uC7AC\uACE0] \u2705 \uC7AC\uACE0 \uCC28\uAC10 \uC131\uACF5: ${O.product_name} (\uC218\uB7C9: ${O.quantity}, \uBC84\uC804: ${B} \u2192 ${B + 1})`);
          break;
        }
        console.warn(`[\uC7AC\uACE0] \u26A0\uFE0F \uBC84\uC804 \uCDA9\uB3CC \uAC10\uC9C0 (\uC2DC\uB3C4 ${L + 1}/3): ${O.product_name}`), L < 2 ? await new Promise((ee) => setTimeout(ee, 50 * (L + 1))) : q = "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958 \uBC1C\uC0DD. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694. (\uB3D9\uC2DC \uC8FC\uBB38 \uCC98\uB9AC \uC911)";
      }
      if (!P) return e.json({ success: false, error: q || "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, q.includes("\uC7AC\uACE0 \uBD80\uC871") ? 400 : 409);
      A.push(s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(U, O.product_id, O.option_id, O.quantity, O.price_snapshot, O.product_name));
    }
    A.push(s.prepare(`DELETE FROM cart_items WHERE id IN (${w})`).bind(...a)), await s.batch(A);
    try {
      const O = E.results.map((L) => L.product_id), P = O.map(() => "?").join(","), q = await s.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${P}) AND seller_id IS NOT NULL
      `).bind(...O).all();
      for (const L of q.results) {
        const M = L.seller_id;
        await pn(s, M, y, buyerName || shippingName || "\uACE0\uAC1D", T);
      }
    } catch (O) {
      console.error("[Order] Notification error:", O);
    }
    return e.json({ success: true, data: { orderId: U, orderNumber: y, totalAmount: T } });
  } catch (t) {
    return e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/streams/:streamId/current-product", async (e) => {
  const { DB: s, LIVE_CACHE: t } = e.env, r = e.req.param("streamId");
  try {
    const a = `current-product:${r}`, n = await Ht(t, a, 3);
    if (n) return e.json({ success: true, data: n });
    const o = await s.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();
    if (!o || !o.current_product_id) return await ws(t, a, null, 3), e.json({ success: true, data: null });
    const i = await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(o.current_product_id).first(), c = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(), l = { product: i, options: c.results };
    return await ws(t, a, l, 3), e.json({ success: true, data: l });
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
        const l = await Ht(s, n, 30);
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
    const { title: r, description: a, youtube_video_id: n, youtube_url: o, thumbnail_url: i, scheduled_at: c, status: l, seller_instagram: u, seller_youtube: d, seller_facebook: m } = await e.req.json();
    let _ = n, f = "youtube", g = null, S = null, w = i;
    if (o && !_ && (_ = Vt(o), !_)) if (_ = Yt(o), g = Jt(o), S = gn(o), _) f = "tiktok";
    else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok live stream URL." }, 400);
    if (!w && _ && f === "youtube" && (w = `https://img.youtube.com/vi/${_}/maxresdefault.jpg`), !r || !_) return e.json({ success: false, error: "Title and live stream URL are required" }, 400);
    const E = await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, _, l || "scheduled", c || null, t.sellerId, u || null, d || null, m || null, f, g, S, w || null).run(), T = await s.prepare(`
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
    `).bind(E.meta.last_row_id).first(), y = await s.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(t.sellerId).first();
    try {
      const { sendLiveStreamCreatedEmail: R } = await Promise.resolve().then(() => $n);
      R({ streamId: E.meta.last_row_id, title: r, sellerName: (y == null ? void 0 : y.display_name) || (y == null ? void 0 : y.username) || "\uC54C \uC218 \uC5C6\uC74C", platform: f, scheduledAt: c, status: l || "scheduled" }).then((U) => {
        U.success ? console.log(`[Email] Live stream notification sent for stream #${U.meta.last_row_id}`) : console.error("[Email] Failed to send notification:", U.error);
      }).catch((U) => {
        console.error("[Email] Exception while sending notification:", U);
      });
    } catch (R) {
      console.error("[Email] Failed to send live stream notification:", R);
    }
    return await Ye(e.env, Je.LIVE_STREAMS), e.json({ success: true, data: T });
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
    const { title: n, description: o, youtube_video_id: i, youtube_url: c, scheduled_at: l, status: u, seller_instagram: d, seller_youtube: m, seller_facebook: _ } = await e.req.json(), f = [], g = [];
    if (n !== void 0 && (f.push("title = ?"), g.push(n)), o !== void 0 && (f.push("description = ?"), g.push(o)), c !== void 0 || i !== void 0) {
      let S = i, w = "youtube", E = null;
      if (c && (S = Vt(c), !S)) if (S = Yt(c), E = Jt(c), S) w = "tiktok";
      else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok video URL." }, 400);
      S !== void 0 && (f.push("youtube_video_id = ?"), g.push(S), f.push("platform = ?"), g.push(w), w === "tiktok" && E && (f.push("tiktok_username = ?"), g.push(E)));
    }
    return u !== void 0 && (f.push("status = ?"), g.push(u)), l !== void 0 && (f.push("scheduled_at = ?"), g.push(l)), d !== void 0 && (f.push("seller_instagram = ?"), g.push(d)), m !== void 0 && (f.push("seller_youtube = ?"), g.push(m)), _ !== void 0 && (f.push("seller_facebook = ?"), g.push(_)), f.length === 0 ? e.json({ success: false, error: "No fields to update" }, 400) : (f.push("updated_at = datetime('now')"), await s.prepare(`
      UPDATE live_streams SET ${f.join(", ")} WHERE id = ?
    `).bind(...g, r).run(), await Ye(e.env, Je.LIVE_STREAMS), e.json({ success: true }));
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/seller/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    return await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first() ? (await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), await Ye(e.env, Je.LIVE_STREAMS), e.json({ success: true })) : e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/youtube/create-live", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const { title: r, description: a, scheduled_at: n } = await e.req.json();
    if (!r) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1 \uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD658\uACBD \uBCC0\uC218\uB97C \uC124\uC815\uD574\uC8FC\uC138\uC694.", help: "wrangler secret put YOUTUBE_ACCESS_TOKEN" }, 400);
    const i = await _n({ accessToken: o }, r, a || ""), l = (await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r, a || null, i.broadcastId, n || null, t.sellerId, i.broadcastId, i.streamKey).run()).meta.last_row_id;
    return await ms(s, t.sellerId, "seller", "live_created", "\u{1F4FA} YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${r} - \uC2A4\uD2B8\uB9BC \uD0A4\uC640 URL\uC744 \uD655\uC778\uD558\uC138\uC694`, `/seller/live-control?streamId=${l}`), e.json({ success: true, data: { streamId: l, broadcastId: i.broadcastId, youtubeVideoId: i.broadcastId, streamKey: i.streamKey, streamUrl: i.streamUrl, watchUrl: `https://www.youtube.com/watch?v=${i.broadcastId}` } });
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
    const n = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!n) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const o = a.youtube_broadcast_id || a.youtube_video_id;
    return o ? (await fn({ accessToken: n }, o), await s.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(), await ms(s, t.sellerId, "seller", "live_ended", "\u2705 YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${a.title} \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, "/seller/streams"), e.json({ success: true, message: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" })) : e.json({ success: false, error: "YouTube Broadcast ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uB3D9\uC73C\uB85C \uC0DD\uC131\uB41C \uB77C\uC774\uBE0C\uC785\uB2C8\uB2E4." }, 400);
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
    const n = a.youtube_video_id;
    if (!n) return e.json({ success: false, error: "YouTube Video ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_API_KEY, i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o && !i) return e.json({ success: false, error: "YouTube API Key \uB610\uB294 Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await En({ apiKey: o, accessToken: i }, n);
    return e.json({ success: true, data: { streamId: r, videoId: n, stats: c } });
  } catch (r) {
    return console.error("[YouTube Live] Get stats error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/youtube/chat/:streamId", async (e) => {
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("streamId"), a = e.req.query("pageToken"), n = await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = n.youtube_live_chat_id;
    if (!o) return e.json({ success: false, error: "Live Chat ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!i) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await hn({ accessToken: i }, o, a);
    return e.json({ success: true, data: c });
  } catch (r) {
    return console.error("[YouTube Live] Get chat messages error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/streams", async (e) => {
  const { DB: s } = e.env, t = await H(e);
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
    return await Ye(e.env, Je.LIVE_STREAMS), e.json({ success: true, data: { id: u.meta.last_row_id, title: r, description: a, youtube_video_id: n, platform: l, tiktok_username: i, status: c || "scheduled" } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/admin/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await H(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { title: a, description: n, youtube_video_id: o, platform: i, tiktok_username: c, status: l } = await e.req.json();
    return await s.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i || "youtube", c || null, l, r).run(), await Ye(e.env, Je.LIVE_STREAMS), e.json({ success: true });
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
    await c.put(l, d), await ws(c, u, { product: o, options: i.results }, 30);
    try {
      await Bt(e.env).changeCurrentProduct(parseInt(r), a), console.log(`\u{1F525} Firebase: Product changed for stream ${r} to ${a}`);
    } catch (m) {
      console.error("\u26A0\uFE0F Firebase sync failed (non-blocking):", m);
    }
    return e.json({ success: true, data: { product: o, options: i.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/admin/streams/:id", async (e) => {
  const { DB: s } = e.env, t = await H(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id");
    return await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(), await Ye(e.env, Je.LIVE_STREAMS), e.json({ success: true });
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
    return await o.put(i, l), await ws(o, c, { product: a, options: n.results }, 30), e.json({ success: true, data: { product: a, options: n.results } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/wishlists", b(), async (e) => {
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
p.delete("/api/wishlists/:id", b(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("id"), { userId: r } = e.req.query();
    return r ? await s.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(t, r).first() ? (await s.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(t, r).run(), e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (t) {
    return console.error("[Wishlist] Delete error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.delete("/api/wishlists/product/:productId", b(), async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.param("productId"), { userId: r } = e.req.query();
    return r ? (await s.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r, t).run()).meta.changes === 0 ? e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (t) {
    return console.error("[Wishlist] Delete by product error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/wishlists/:userId", b(), async (e) => {
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
p.get("/api/wishlists/check/:userId/:productId", b(), async (e) => {
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
  const { DB: s } = e.env, t = await N(e);
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
    const u = await Pr(c.buffer);
    if (!u.valid) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC774\uBBF8\uC9C0 \uD30C\uC77C\uC785\uB2C8\uB2E4." }, 400);
    const d = e.env.IMAGES;
    if (d) {
      console.log("[Image Upload] Using R2 storage");
      const m = Ur(a || "upload.jpg"), _ = `products/${t.sellerId}/${m}`;
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
  const { DB: s } = e.env, t = await N(e);
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
    return await Bs(e.env.CACHE_KV, `seller:${t.sellerId}:products`, `public:seller:${t.sellerId}`), e.json({ success: true, data: f });
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
    const { name: n, description: o, price: i, original_price: c, image_url: l, stock: u, category: d, is_active: m, live_stream_id: _ } = await e.req.json(), f = [], g = [];
    if (n !== void 0 && (f.push("name = ?"), g.push(n)), o !== void 0 && (f.push("description = ?"), g.push(o)), i !== void 0 && (f.push("price = ?"), g.push(i)), c !== void 0 && (f.push("original_price = ?"), g.push(c), i !== void 0 && c)) {
      const w = Math.round((c - i) / c * 100);
      f.push("discount_rate = ?"), g.push(w);
    }
    if (l !== void 0 && (f.push("image_url = ?"), g.push(l)), u !== void 0 && (f.push("stock = ?"), g.push(u)), d !== void 0 && (f.push("category = ?"), g.push(d)), m !== void 0 && (f.push("is_active = ?"), g.push(m ? 1 : 0)), _ !== void 0 && (f.push("live_stream_id = ?"), g.push(_ || null)), f.push("updated_at = CURRENT_TIMESTAMP"), g.push(r, t.sellerId), f.length === 1) return e.json({ success: false, error: "No fields to update" }, 400);
    await s.prepare(`UPDATE products SET ${f.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...g).run();
    const S = await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(r).first();
    return await Bs(e.env.CACHE_KV, `seller:${t.sellerId}:products`, `public:seller:${t.sellerId}`), e.json({ success: true, data: S });
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
    const n = await s.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();
    return n && n.count > 0 ? e.json({ success: false, error: "\uC774\uBBF8 \uC8FC\uBB38\uB41C \uC0C1\uD488\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD488\uC808 \uCC98\uB9AC\uD558\uAC70\uB098 \uC228\uAE40 \uCC98\uB9AC\uD574\uC8FC\uC138\uC694." }, 400) : (await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(), await s.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(), await s.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(), await s.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r, t.sellerId).run(), await Bs(e.env.CACHE_KV, `seller:${t.sellerId}:products`, `public:seller:${t.sellerId}`), e.json({ success: true }));
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
    const n = await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();
    return e.json({ success: true, data: n.results });
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
    const { option_type: n, option_value: o, price_adjustment: i, stock: c } = await e.req.json();
    if (!n || !o) return e.json({ success: false, error: "Option type and value are required" }, 400);
    const l = await s.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r, n, o, i || 0, c || 0).run();
    return e.json({ success: true, data: { id: l.meta.last_row_id, product_id: r, option_type: n, option_value: o, price_adjustment: i || 0, stock: c || 0 } });
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
  const { DB: s } = e.env, t = await N(e);
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
  const { DB: s } = e.env, t = await N(e);
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
  const { DB: s } = e.env, t = await N(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e), r = t.success ? { success: false } : await N(e);
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
          `).bind(w.quantity, w.quantity, w.product_id)), g = await s.batch(f);
        let S = 0;
        for (let w = 0; w < g.length; w++) if (g[w].meta.changes > 0) {
          S++;
          const E = _.results[w];
          console.log(`[Stock] \u2705 \uC7AC\uACE0 \uD655\uC815: product_id=${E.product_id}, quantity=${E.quantity}`);
        } else {
          const E = _.results[w];
          console.error(`[Stock] \u26A0\uFE0F \uC7AC\uACE0 \uD655\uC815 \uC2E4\uD328: product_id=${E.product_id}`);
        }
        console.log(`[Stock] \u2705 \uC7AC\uACE0 \uD655\uC815 \uC644\uB8CC: ${S}/${_.results.length}\uAC1C \uC131\uACF5`);
        try {
          const w = _.results.map((y) => y.product_id), E = w.map(() => "?").join(","), T = await s.prepare(`
            SELECT id, name, stock, reserved_stock, stock_alert_threshold, seller_id 
            FROM products 
            WHERE id IN (${E})
          `).bind(...w).all();
          for (const y of T.results) {
            const R = y.stock_alert_threshold || 10, U = y.stock || 0, A = y.reserved_stock || 0, O = U - A;
            O <= R && y.seller_id && (await Kt(s, y.seller_id, y.name, O, R), console.log(`[Low Stock Alert] \u{1F4E2} ${y.name}: \uAC00\uC6A9\uC7AC\uACE0 ${O}\uAC1C (\uC784\uACC4\uAC12 ${R}\uAC1C)`));
          }
        } catch (w) {
          console.error("[Low Stock Alert] \u26A0\uFE0F \uC54C\uB9BC \uC804\uC1A1 \uC2E4\uD328:", w);
        }
      }
      try {
        const f = i.id, g = await Oa(e.env, f);
        g.success ? console.log(`[Payment] \u2705 \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC131\uACF5 (\uC8FC\uBB38 ${f})`) : console.warn(`[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC2E4\uD328 (\uC8FC\uBB38 ${f}):`, g.reason || g.error);
      } catch (f) {
        console.error("[Payment] \u26A0\uFE0F \uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uC911 \uC624\uB958:", f);
      }
    } catch (_) {
      console.error("[Payment] \u26A0\uFE0F DB \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 (\uACB0\uC81C\uB294 \uC131\uACF5):", _);
    }
    if (e.env.DISCORD_WEBHOOK_URL) try {
      await Za(e.env.DISCORD_WEBHOOK_URL, "\uACB0\uC81C \uC131\uACF5", `\uC8FC\uBB38\uBC88\uD638 ${n} \uACB0\uC81C \uC644\uB8CC`, { \uC8FC\uBB38\uBC88\uD638: n, \uACB0\uC81C\uAE08\uC561: `\u20A9${Number(o).toLocaleString()}`, \uACB0\uC81C\uD0A4: a.substring(0, 20) + "...", \uC0AC\uC6A9\uC790ID: i.user_id });
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
p.post("/api/chat/:liveStreamId/messages", b(), async (e) => {
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
p.get("/api/chat/:liveStreamId/messages", b(), async (e) => {
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
p.delete("/api/chat/:liveStreamId/messages/:messageId", b(), async (e) => {
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
p.post("/api/chat/:liveStreamId/ban", b(), async (e) => {
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
p.delete("/api/chat/:liveStreamId/ban/:userId", b(), async (e) => {
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
async function yn(e, s, t) {
  try {
    const r = new TextEncoder(), a = r.encode(t), n = r.encode(e), o = await crypto.subtle.importKey("raw", a, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), i = await crypto.subtle.sign("HMAC", o, n), c = Array.from(new Uint8Array(i)), l = btoa(String.fromCharCode(...c));
    return s === l;
  } catch (r) {
    return console.error("[Webhook] \uC11C\uBA85 \uAC80\uC99D \uC624\uB958:", r), false;
  }
}
__name(yn, "yn");
p.post("/api/payments/webhook", async (e) => {
  const { DB: s } = e.env;
  try {
    const t = e.req.header("toss-signature"), r = await e.req.text();
    if (t && e.env.TOSS_SECRET_KEY) {
      if (!await yn(r, t, e.env.TOSS_SECRET_KEY)) return console.error("[Webhook] \u274C \uC11C\uBA85 \uAC80\uC99D \uC2E4\uD328 - \uC704\uC870\uB41C \uC6F9\uD6C5 \uC694\uCCAD"), e.json({ success: false, error: "Invalid signature" }, 401);
      console.log("[Webhook] \u2705 \uC11C\uBA85 \uAC80\uC99D \uC131\uACF5");
    } else console.warn("[Webhook] \u26A0\uFE0F \uC11C\uBA85 \uAC80\uC99D \uAC74\uB108\uB700 (\uAC1C\uBC1C \uD658\uACBD \uB610\uB294 \uC11C\uBA85 \uC5C6\uC74C)");
    const a = JSON.parse(r);
    switch (console.log("[Webhook] \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC6F9\uD6C5 \uC218\uC2E0:", { eventType: a.eventType, orderId: a.orderId, status: a.status, timestamp: (/* @__PURE__ */ new Date()).toISOString() }), a.eventType) {
      case "PAYMENT_STATUS_CHANGED":
        await wn(s, a);
        break;
      case "VIRTUAL_ACCOUNT_ISSUED":
        await Sn(s, a);
        break;
      default:
        console.log("[Webhook] \uCC98\uB9AC\uD558\uC9C0 \uC54A\uB294 \uC774\uBCA4\uD2B8 \uD0C0\uC785:", a.eventType);
    }
    return e.json({ success: true });
  } catch (t) {
    return console.error("[Webhook] \u274C \uC6F9\uD6C5 \uCC98\uB9AC \uC2E4\uD328:", t.message), e.json({ success: false, error: t.message }, 500);
  }
});
async function wn(e, s) {
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
__name(wn, "wn");
async function Sn(e, s) {
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
__name(Sn, "Sn");
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
    const l = nn(i, c), u = n && n < o.amount, d = n || o.amount;
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
  const { DB: s } = e.env, t = await N(e);
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
    `).bind(...m, l, u).all(), g = await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${_}
    `).bind(...m).first(), S = (g == null ? void 0 : g.total) || 0, w = Math.ceil(S / l), E = /* @__PURE__ */ new Map();
    for (const y of f.results) {
      const R = y.id;
      E.has(R) || E.set(R, { id: y.id, user_id: y.user_id, user_name: y.user_name, order_number: y.order_number, status: y.status, total_amount: y.total_amount, shipping_fee: y.shipping_fee, payment_method: y.payment_method, payment_key: y.payment_key, shipping_address: y.shipping_address, shipping_name: y.shipping_name, shipping_phone: y.shipping_phone, delivery_request: y.delivery_request, created_at: y.created_at, updated_at: y.updated_at, items: [] }), y.item_id && E.get(R).items.push({ id: y.item_id, product_id: y.product_id, option_id: y.option_id, quantity: y.quantity, price: y.item_price, seller_id: y.seller_id, product_name: y.product_name, image_url: y.image_url, option_value: y.option_value });
    }
    const T = Array.from(E.values());
    return e.json({ success: true, data: T, pagination: { page: c, limit: l, total: S, totalPages: w }, filters: { status: r || null, startDate: a || null, endDate: n || null, minAmount: o ? parseInt(o) : null, maxAmount: i ? parseInt(i) : null } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/orders/export", async (e) => {
  const { DB: s } = e.env, t = await N(e);
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
      const l = ["\uC8FC\uBB38\uBC88\uD638", "\uC8FC\uBB38\uC77C\uC2DC", "\uC8FC\uBB38\uC0C1\uD0DC", "\uACB0\uC81C\uC0C1\uD0DC", "\uC8FC\uBB38\uAE08\uC561", "\uBC30\uC1A1\uC9C0", "\uC218\uB839\uC778", "\uC5F0\uB77D\uCC98", "\uD0DD\uBC30\uC0AC", "\uC6B4\uC1A1\uC7A5\uBC88\uD638", "\uAD6C\uB9E4\uC790\uBA85", "\uAD6C\uB9E4\uC790\uC774\uBA54\uC77C", "\uAD6C\uB9E4\uC790\uC5F0\uB77D\uCC98"], u = c.results.map((g) => [g.order_number || "", g.created_at ? new Date(g.created_at).toLocaleString("ko-KR") : "", g.status || "", g.payment_status || "", g.total_amount || 0, g.shipping_address || "", g.shipping_name || "", g.shipping_phone || "", g.carrier || "", g.tracking_number || "", g.buyer_name || "", g.buyer_email || "", g.buyer_phone || ""]), m = "\uFEFF" + [l.join(","), ...u.map((g) => g.map((S) => {
        const w = String(S);
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
            `).bind(c.id).all(), d = Number(c.total_amount), m = Math.floor(d / 1.1), _ = d - m, f = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), g = Math.random().toString(36).substring(2, 8).toUpperCase(), S = `${f}-${g}`, E = (await s.prepare(`
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
            `).bind(t.sellerId, r, S, l.business_number, l.business_name, l.ceo_name, l.address || "", l.business_type || "", l.business_category || "", l.email || "", l.phone || "", c.buyer_business_number, c.buyer_business_name, c.buyer_ceo_name || "", c.buyer_business_address || "", c.buyer_business_type || "", c.buyer_business_category || "", c.buyer_email || "", c.buyer_phone || "", m, _, d, `AUTO-${Date.now()}-${g}`).run()).meta.last_row_id;
          if (u.results.length > 0) {
            const T = u.results.map((y) => {
              const R = Math.floor(Number(y.price) * Number(y.quantity) / 1.1), U = Number(y.price) * Number(y.quantity) - R;
              return s.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(E, y.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", y.quantity, y.price, R, U, y.option_name || "");
            });
            await s.batch(T);
          }
          await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r, t.sellerId, E).run(), console.log(`[AUTO TAX INVOICE] \u2705 \uBC1C\uD589 \uC644\uB8CC: invoice_id=${E}, invoice_number=${S}`);
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
        u && await Wt(s, c.user_id, r, u);
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
      c && c.user_id && await Wt(s, c.user_id, r, "shipping", a, n);
    } catch (c) {
      console.error("[Tracking] Notification error:", c);
    }
    return e.json({ success: true, message: "Tracking information updated" });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/orders", async (e) => {
  const { DB: s } = e.env, t = await H(e);
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
    const a = `sellers:list:${t}:${r}`, n = Se(a);
    if (n) return e.executionCtx.waitUntil((async () => {
      try {
        const i = await nt(s, parseInt(t), parseInt(r));
        Z(a, i, 3600);
      } catch (i) {
        console.error("[Cache Revalidate] Sellers error:", i);
      }
    })()), e.json({ success: true, data: n, cached: true });
    const o = await nt(s, parseInt(t), parseInt(r));
    return Z(a, o, 3600), e.json({ success: true, data: o, cached: false });
  } catch (a) {
    return console.error("[API] Sellers list error:", a), e.json({ success: false, error: `\uC140\uB7EC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${a.message}` }, 500);
  }
});
async function nt(e, s, t) {
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
__name(nt, "nt");
p.get("/api/admin/sellers", async (e) => {
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
      const { sendEmail: n, getSellerApprovalEmailHTML: o } = await Promise.resolve().then(() => Xt), i = e.env.RESEND_API_KEY || "", c = o(a.name, a.username), l = await n({ to: a.email, subject: "\u{1F389} \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790 \uC2B9\uC778 \uC644\uB8CC", html: c }, i, e.env.EMAIL_FROM || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <noreply@ur-team.com>");
      l.success ? console.log(`[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC131\uACF5: ${a.email}`) : console.warn(`[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC2E4\uD328: ${l.error}`);
    } catch (n) {
      console.error("[\uC140\uB7EC \uC2B9\uC778] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC624\uB958:", n);
    }
    try {
      const { createNotification: n, NotificationTemplates: o } = await Promise.resolve().then(() => Qt), i = o.seller_approved(a.name);
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
  const { DB: s } = e.env, t = await H(e);
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
      const { sendEmail: o, getSellerRejectionEmailHTML: i } = await Promise.resolve().then(() => Xt), c = e.env.RESEND_API_KEY || "", l = i(n.name, a), u = await o({ to: n.email, subject: "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790 \uC2B9\uC778 \uACB0\uACFC \uC548\uB0B4", html: l }, c, e.env.EMAIL_FROM || "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 <noreply@ur-team.com>");
      u.success ? console.log(`[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC131\uACF5: ${n.email}`) : console.warn(`[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC2E4\uD328: ${u.error}`);
    } catch (o) {
      console.error("[\uC140\uB7EC \uAC70\uBD80] \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC624\uB958:", o);
    }
    try {
      const { createNotification: o, NotificationTemplates: i } = await Promise.resolve().then(() => Qt), c = i.seller_rejected(a);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
    const r = e.req.param("sellerId"), a = `public:seller:${r}`, n = await dn(t, a);
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
    return await rs(t, a, d, 60, false), e.json({ success: true, data: d });
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
  const { DB: s } = e.env, t = await H(e);
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
        const g = new Date(i.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${g}'`);
        break;
      case "month":
        const S = new Date(i.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${S}'`);
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
      const g = d.map((S) => {
        const w = f[S];
        if (w == null) return "";
        const E = String(w);
        return E.includes(",") || E.includes('"') || E.includes(`
`) ? `"${E.replace(/"/g, '""')}"` : E;
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
    const { userId: t, cartItems: r, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i, buyerBusinessNumber: c, buyerBusinessName: l, buyerCeoName: u } = await e.req.json();
    console.log("[DEPRECATED /api/orders/create] \uC8FC\uBB38 \uC0DD\uC131 \uC694\uCCAD:", { userId: t, cartItems: r == null ? void 0 : r.length, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i });
    let d = 10;
    if (o) {
      const I = await s.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();
      I && I.commission_rate !== null && (d = I.commission_rate);
    }
    console.log("\uC218\uC218\uB8CC\uC728:", { sellerId: o, commissionRate: d });
    const m = Math.floor(a * (d / 100)), _ = a - m;
    let f = null;
    if (n) {
      const I = await s.prepare(`
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
      if (!I) return e.json({ success: false, error: "\uBC30\uC1A1\uC9C0 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
      f = I;
    }
    if (!t) return e.json({ success: false, error: "User ID is required. Please login with Kakao first." }, 401);
    const g = t, S = /* @__PURE__ */ new Date(), w = S.getFullYear().toString().slice(-2), E = (S.getMonth() + 1).toString().padStart(2, "0"), T = S.getDate().toString().padStart(2, "0"), y = `${w}${E}${T}`, R = Math.random().toString(36).substring(2, 7).toUpperCase(), U = `ORD-${y}-${R}`, A = r.map((I) => I.product_id), O = A.map(() => "?").join(","), P = await s.prepare(`
      SELECT id, stock FROM products WHERE id IN (${O})
    `).bind(...A).all(), q = new Map(P.results.map((I) => [I.id, I.stock]));
    for (const I of r) {
      const ee = q.get(I.product_id);
      if (ee === void 0) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${I.product_id})` }, 400);
      if (ee < I.quantity) return e.json({ success: false, error: `\uC7AC\uACE0\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4 (\uC0C1\uD488 ID: ${I.product_id})` }, 400);
    }
    const M = (await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(U, g, a, "pending", o || null, d, m, _, n || null, (f == null ? void 0 : f.recipient_name) || null, (f == null ? void 0 : f.phone) || null, f != null && f.address ? `${f.address} ${f.address_detail}` : null, (f == null ? void 0 : f.postal_code) || null, i ? 1 : 0, c || null, l || null, u || null).run()).meta.last_row_id, K = r.map((I) => s.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(M, I.product_id, I.option_id || null, I.quantity, I.price_snapshot || I.price)), B = r.map((I) => s.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(I.quantity, I.product_id));
    await s.batch([...K, ...B]);
    try {
      const I = Bt(e.env), ee = r.map((J) => J.product_id), F = ee.map(() => "?").join(","), x = await s.prepare(`
        SELECT id, name, price, original_price, discount_rate, stock, image_url
        FROM products
        WHERE id IN (${F})
      `).bind(...ee).all();
      await Promise.all(x.results.map((J) => I.updateProductStock(J.id, J.stock, { name: J.name, price: J.price, original_price: J.original_price, discount_rate: J.discount_rate, image_url: J.image_url }))), console.log(`\u{1F525} Firebase: Stock updated for ${x.results.length} products`);
    } catch (I) {
      console.error("\u26A0\uFE0F Firebase stock sync failed (non-blocking):", I);
    }
    try {
      const I = r.map((x) => x.product_id), ee = I.map(() => "?").join(","), F = await s.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${ee})
      `).bind(...I).all();
      for (const x of F.results) {
        const J = x.stock_alert_threshold || 5, le = x.stock;
        le <= J && x.seller_id && (await Kt(s, x.seller_id, x.name, le, J), console.log(`[Low Stock Alert] ${x.name}: ${le} <= ${J}`));
      }
    } catch (I) {
      console.error("[Low Stock Alert] Error:", I);
    }
    return console.log("\uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC:", { orderId: M, orderNumber: U }), e.json({ success: true, orderId: M, orderNumber: U, totalAmount: a });
  } catch (t) {
    return console.error("\uC8FC\uBB38 \uC0DD\uC131 \uC2E4\uD328:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/orders/:orderNumber/refund", b(), j, async (e) => {
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
p.get("/api/seller/sales", b(), async (e) => {
  try {
    const { DB: s } = e.env, t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const r = await ze(e.env.SESSION_KV, t);
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
p.get("/api/seller/settlement-csv", b(), async (e) => {
  try {
    const { DB: s } = e.env, t = e.req.header("X-Session-Token");
    if (!t) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const r = await ze(e.env.SESSION_KV, t);
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
      const m = d.status === "delivered" ? "\uBC30\uC1A1\uC644\uB8CC" : d.status === "shipped" ? "\uBC30\uC1A1\uC911" : d.status === "preparing" ? "\uC0C1\uD488\uC900\uBE44\uC911" : d.status === "paid" ? "\uACB0\uC81C\uC644\uB8CC" : "\uB300\uAE30\uC911", _ = d.buyer_business_name || "-", f = d.buyer_business_number || "-", g = d.invoice_number || "-", S = d.issue_date || "-", w = d.tax_invoice_status === "issued" ? "\uBC1C\uD589\uC644\uB8CC" : d.tax_invoice_status === "cancelled" ? "\uCDE8\uC18C" : "-", E = d.nts_confirm_number || "-";
      u += `${d.order_number},${d.created_at},${d.user_name || "\uC775\uBA85"},${d.total_amount},${d.commission_amount},${d.seller_amount},${m},${_},${f},${g},${S},${w},${E}
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
    const n = await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(t.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC2B9\uC778\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778\uC744 \uAE30\uB2E4\uB824\uC8FC\uC138\uC694." }, 400);
    const o = await s.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(), i = Number(a.total_amount), c = Math.floor(i / 1.1), l = i - c, u = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], d = `${u}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, m = na(n, a, o.results);
    let _, f, g;
    try {
      _ = await aa(m), f = _.ntsConfirmNumber, g = _.invoiceKey, console.log("\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC131\uACF5:", { ntsConfirmNumber: f, invoiceKey: g, mockMode: Ze() });
    } catch (E) {
      console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", E), f = "FAILED", g = null;
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
    `).bind(t.sellerId, r, "tax", d, u, n.business_number, n.business_name, n.ceo_name, n.address, n.business_type, n.business_category, a.buyer_business_number, a.buyer_business_name, a.buyer_ceo_name, c, l, i, f === "FAILED" ? "failed" : "issued", Ze() ? "mock" : "barobill", g, f).run()).meta.last_row_id;
    for (const E of o.results) {
      const T = Math.floor(Number(E.price) * Number(E.quantity) / 1.1), y = Number(E.price) * Number(E.quantity) - T;
      await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(w, E.id, E.product_name, E.quantity, E.price, T, y).run();
    }
    return e.json({ success: true, data: { invoice_id: w, invoice_number: d, issue_date: u, total_amount: i, supply_price: c, tax_amount: l, status: f === "FAILED" ? "failed" : "issued", nts_confirm_number: f, api_invoice_key: g, mock_mode: Ze(), message: f === "FAILED" ? "\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328. \uB098\uC911\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694." : Ze() ? "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (Mock Mode - \uC2E4\uC81C \uBC1C\uD589 \uC544\uB2D8)" : "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4." } });
  } catch (r) {
    return console.error("\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC624\uB958:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/tax-invoices", async (e) => {
  var r;
  const { DB: s } = e.env, t = await N(e);
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
  const { DB: s } = e.env, t = await N(e);
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
  const { DB: s } = e.env, t = await N(e);
  if (!t.success) return e.json({ success: false, error: t.error }, 401);
  try {
    const r = e.req.param("id"), { reason: a } = await e.req.json(), n = await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r, t.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const o = new Date(n.issue_date), i = new Date(o);
    if (i.setDate(i.getDate() + 1), /* @__PURE__ */ new Date() > i) return e.json({ success: false, error: "\uBC1C\uD589\uC77C \uC775\uC77C\uAE4C\uC9C0\uB9CC \uCDE8\uC18C \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 400);
    try {
      if (n.api_invoice_key && !Ze()) {
        const l = await s.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(t.sellerId).first();
        l && l.business_number && await ra(l.business_number, n.api_invoice_key, a || "\uD310\uB9E4\uC790 \uC694\uCCAD");
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
    `).bind(o.id).all(), l = Number(o.total_amount), u = Math.floor(l / 1.1), d = l - u, m = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), _ = Math.random().toString(36).substring(2, 8).toUpperCase(), f = `${m}-${_}`, S = (await s.prepare(`
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
      const E = Math.floor(Number(w.price) * Number(w.quantity) / 1.1), T = Number(w.price) * Number(w.quantity) - E;
      await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(S, w.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", w.quantity, w.price, E, T, w.option_name || "").run();
    }
    return await s.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(r, t.sellerId, S, n + 1).run(), await s.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n + 1, a.id).run(), console.log(`[TAX INVOICE RETRY] \u2705 \uC7AC\uC2DC\uB3C4 \uC131\uACF5: invoice_id=${S}, retry_count=${n + 1}`), e.json({ success: true, data: { invoice_id: S, invoice_number: f, retry_count: n + 1 } });
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
  if (e instanceof Qa) return console.error("[AppError]", { path: t, method: s.req.method, code: e.code, message: e.message, statusCode: e.statusCode }), s.json({ success: false, error: { code: e.code, message: e.message, ...e.details && { details: e.details } } }, e.statusCode);
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
p.get("/api/admin/alimtalk/pricing", b(), async (e) => {
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
p.post("/api/admin/alimtalk/pricing", b(), async (e) => {
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
p.put("/api/admin/alimtalk/pricing/:id", b(), async (e) => {
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
p.delete("/api/admin/alimtalk/pricing/:id", b(), async (e) => {
  const { env: s } = e, t = e.req.param("id");
  try {
    return (await s.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(t).run()).meta.changes === 0 ? e.json({ success: false, error: "Pricing not found" }, 404) : e.json({ success: true, message: "Pricing deleted successfully" });
  } catch (r) {
    return console.error("[Admin Alimtalk Pricing Delete] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/alimtalk/accounts", b(), async (e) => {
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
p.patch("/api/admin/alimtalk/accounts/:id/status", b(), async (e) => {
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
p.get("/api/admin/alimtalk/statistics", b(), async (e) => {
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
p.get("/api/seller/alimtalk/account", b(), async (e) => {
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
p.post("/api/seller/alimtalk/register", b(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await je(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { channel_id: a, phone_number: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Missing required fields" }, 400);
    const o = Ft(n), i = await ba(s, { channelId: a, phoneNumber: o });
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
p.get("/api/seller/alimtalk/templates", b(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await je(s, t);
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
p.post("/api/seller/alimtalk/templates", b(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await je(s, t);
    if (!r || r.user_type !== "seller") return e.json({ success: false, error: "Unauthorized" }, 401);
    const { template_code: a, template_name: n, template_content: o, template_type: i } = await e.req.json();
    if (!a || !n || !o) return e.json({ success: false, error: "Missing required fields" }, 400);
    const c = await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();
    if (!c) return e.json({ success: false, error: "Active alimtalk account not found" }, 404);
    if (!(await Ta(s, c.sender_key, { name: n, content: o, templateCode: a })).success) return e.json({ success: false, error: "Failed to register template" }, 500);
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
p.get("/api/seller/alimtalk/pricing", b(), async (e) => {
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
p.post("/api/seller/alimtalk/charge", b(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await je(s, t);
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
p.post("/api/seller/alimtalk/charge/complete", b(), async (e) => {
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
p.post("/api/seller/alimtalk/send", b(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await je(s, t);
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
    const u = Ra(l.template_content, o || {}), d = Ft(n), m = await qs(s, { senderKey: c.sender_key, templateCode: l.template_code, to: d, message: u });
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
p.get("/api/seller/alimtalk/messages", b(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await je(s, t);
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
p.get("/api/seller/alimtalk/statistics", b(), async (e) => {
  const { env: s } = e;
  try {
    const t = e.req.header("X-Session-Token"), r = await je(s, t);
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
p.post("/api/seller/alimtalk/send", b(), async (e) => {
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
    const i = await xs(e.env, { accountId: o.id, templateId: parseInt(r), recipients: a.map((c) => ({ phone: c.phone, name: c.name, variables: c.variables || {} })), variables: n || {} });
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (s) {
    return console.error("[Alimtalk Send] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/alimtalk/send/order", b(), async (e) => {
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
    const c = await Ma(e.env, o.id, parseInt(r), parseInt(a), n);
    return e.json({ success: c.success, data: { total: c.totalRecipients, sent: c.successCount, failed: c.failedCount, refunded: c.refundedAmount }, messages: c.messages });
  } catch (s) {
    return console.error("[Alimtalk Send Order] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/alimtalk/send/bulk", b(), async (e) => {
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
    const i = await $a(e.env, o.id, parseInt(r), a, n || {});
    return e.json({ success: i.success, data: { total: i.totalRecipients, sent: i.successCount, failed: i.failedCount, refunded: i.refundedAmount }, messages: i.messages });
  } catch (s) {
    return console.error("[Alimtalk Send Bulk] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/alimtalk/templates/:id/preview", b(), async (e) => {
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
p.get("/api/admin/settlements", b(), async (e) => {
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
p.get("/api/admin/settlements/:id", b(), async (e) => {
  try {
    const s = parseInt(e.req.param("id")), t = await Fa(e.env.DB, s);
    return t ? e.json({ success: true, data: t }) : e.json({ success: false, error: "Settlement not found" }, 404);
  } catch (s) {
    return console.error("[Admin Settlement Detail] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/admin/settlements/generate", b(), async (e) => {
  try {
    const s = await e.req.json(), { startDate: t, endDate: r } = s, a = t && r ? { startDate: t, endDate: r } : Pa(), n = await xa(e.env.DB, a);
    return await Ha(e.env.DB, n), e.json({ success: true, data: n });
  } catch (s) {
    return console.error("[Admin Generate Settlement] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/settlements", b(), async (e) => {
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
p.get("/api/admin/settlements/calculate", b(), async (e) => {
  const { DB: s } = e.env;
  if (!(await H(e)).success) return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const r = e.req.query("seller_id"), a = e.req.query("period") || "monthly", n = e.req.query("format") || "json";
    let o = e.req.query("start_date"), i = e.req.query("end_date");
    if (!r) return e.json({ success: false, error: "seller_id\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    const c = /* @__PURE__ */ new Date();
    if (a === "weekly") {
      const E = new Date(c);
      E.setDate(c.getDate() - c.getDay() - 6), E.setHours(0, 0, 0, 0);
      const T = new Date(E);
      T.setDate(E.getDate() + 6), T.setHours(23, 59, 59, 999), o = E.toISOString().split("T")[0], i = T.toISOString().split("T")[0];
    } else if (a === "monthly") {
      const E = new Date(c.getFullYear(), c.getMonth() - 1, 1), T = new Date(c.getFullYear(), c.getMonth(), 0);
      o = E.toISOString().split("T")[0], i = T.toISOString().split("T")[0];
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
    `).bind(r, o, i).all()).results, m = d.length, _ = d.reduce((E, T) => E + (T.total_amount || 0), 0), f = d.reduce((E, T) => E + (T.commission_amount || 0), 0), g = _ - f, S = m > 0 ? d.reduce((E, T) => E + (T.commission_rate || 0), 0) / m : 0, w = { sellerId: parseInt(r), sellerName: l.seller_name || "Unknown", businessName: l.business_name || null, period: { type: a, startDate: o, endDate: i }, summary: { totalOrders: m, totalSales: _, totalCommission: f, netAmount: g, commissionRate: Math.round(S * 100) / 100 }, orders: d.map((E) => ({ orderNumber: E.order_number, createdAt: E.created_at, status: E.status, totalAmount: E.total_amount || 0, commissionAmount: E.commission_amount || 0, sellerAmount: E.seller_amount || 0 })) };
    if (n === "csv") {
      const E = [];
      E.push("\uC140\uB7EC \uC815\uC0B0\uC11C"), E.push(`\uC140\uB7EC\uBA85,${w.sellerName}`), E.push(`\uC0AC\uC5C5\uC790\uBA85,${w.businessName || "N/A"}`), E.push(`\uC815\uC0B0 \uAE30\uAC04,${w.period.startDate} ~ ${w.period.endDate}`), E.push(""), E.push("\uAD6C\uBD84,\uAE08\uC561"), E.push(`\uCD1D \uC8FC\uBB38 \uAC74\uC218,${w.summary.totalOrders}\uAC74`), E.push(`\uCD1D \uB9E4\uCD9C,${w.summary.totalSales.toLocaleString()}\uC6D0`), E.push(`\uD50C\uB7AB\uD3FC \uC218\uC218\uB8CC (${w.summary.commissionRate}%),${w.summary.totalCommission.toLocaleString()}\uC6D0`), E.push(`\uC815\uC0B0 \uAE08\uC561,${w.summary.netAmount.toLocaleString()}\uC6D0`), E.push(""), E.push("\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC0C1\uD0DC,\uC8FC\uBB38\uAE08\uC561,\uD50C\uB7AB\uD3FC\uC218\uC218\uB8CC,\uC815\uC0B0\uAE08\uC561");
      for (const R of w.orders) E.push(`${R.orderNumber},${R.createdAt},${R.status},${R.totalAmount},${R.commissionAmount},${R.sellerAmount}`);
      const T = E.join(`
`), y = `settlement_${r}_${o}_${i}.csv`;
      return e.text(T, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${y}"` });
    }
    return e.json({ success: true, data: w });
  } catch (r) {
    return console.error("[Settlement] Calculation error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/seller/settlements/my", b(), async (e) => {
  const { DB: s } = e.env, t = await N(e);
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
    `).bind(n, c, l).all()).results, f = _.length, g = _.reduce((y, R) => y + (R.total_amount || 0), 0), S = _.reduce((y, R) => y + (R.commission_amount || 0), 0), w = g - S, E = f > 0 ? _.reduce((y, R) => y + (R.commission_rate || 0), 0) / f : 0, T = { sellerId: n, sellerName: d.seller_name || "Unknown", businessName: d.business_name || null, period: { type: o, startDate: c, endDate: l }, summary: { totalOrders: f, totalSales: g, totalCommission: S, netAmount: w, commissionRate: Math.round(E * 100) / 100 }, orders: _.map((y) => ({ orderNumber: y.order_number, createdAt: y.created_at, status: y.status, totalAmount: y.total_amount || 0, commissionAmount: y.commission_amount || 0, sellerAmount: y.seller_amount || 0 })) };
    if (i === "csv") {
      const y = [];
      y.push("\uC140\uB7EC \uC815\uC0B0\uC11C"), y.push(`\uC140\uB7EC\uBA85,${T.sellerName}`), y.push(`\uC0AC\uC5C5\uC790\uBA85,${T.businessName || "N/A"}`), y.push(`\uC815\uC0B0 \uAE30\uAC04,${T.period.startDate} ~ ${T.period.endDate}`), y.push(""), y.push("\uAD6C\uBD84,\uAE08\uC561"), y.push(`\uCD1D \uC8FC\uBB38 \uAC74\uC218,${T.summary.totalOrders}\uAC74`), y.push(`\uCD1D \uB9E4\uCD9C,${T.summary.totalSales.toLocaleString()}\uC6D0`), y.push(`\uD50C\uB7AB\uD3FC \uC218\uC218\uB8CC (${T.summary.commissionRate}%),${T.summary.totalCommission.toLocaleString()}\uC6D0`), y.push(`\uC815\uC0B0 \uAE08\uC561,${T.summary.netAmount.toLocaleString()}\uC6D0`), y.push(""), y.push("\uC8FC\uBB38\uBC88\uD638,\uC8FC\uBB38\uC77C\uC2DC,\uC0C1\uD0DC,\uC8FC\uBB38\uAE08\uC561,\uD50C\uB7AB\uD3FC\uC218\uC218\uB8CC,\uC815\uC0B0\uAE08\uC561");
      for (const A of T.orders) y.push(`${A.orderNumber},${A.createdAt},${A.status},${A.totalAmount},${A.commissionAmount},${A.sellerAmount}`);
      const R = y.join(`
`), U = `my_settlement_${c}_${l}.csv`;
      return e.text(R, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${U}"` });
    }
    return e.json({ success: true, data: T });
  } catch (n) {
    return console.error("[My Settlement] Error:", n), e.json({ success: false, error: n.message }, 500);
  }
});
p.get("/api/seller/settlements", b(), async (e) => {
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
  return Ba(s, e.env);
});
p.get("/api/live/:streamId/chat/sse", async (e) => {
  const s = e.req.param("streamId");
  return Wa(s, e.env);
});
p.get("/api/seller/orders/sse", async (e) => {
  const s = e.req.header("X-Seller-ID");
  return s ? Ka(s, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
p.get("/api/seller/stock/sse", async (e) => {
  const s = e.req.header("X-Seller-ID");
  return s ? Va(s, e.env) : e.json({ success: false, error: "Unauthorized" }, 401);
});
p.post("/api/push/subscribe", b(), async (e) => {
  try {
    const s = e.req.header("X-User-ID"), t = e.req.header("X-User-Type");
    if (!s || !t) return e.json({ success: false, error: "Unauthorized" }, 401);
    const r = await e.req.json();
    return await Ya(e.env.DB, parseInt(s), t, r), e.json({ success: true });
  } catch (s) {
    return console.error("[Push Subscribe] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/push/unsubscribe", b(), async (e) => {
  try {
    const { endpoint: s } = await e.req.json();
    return s ? (await Ja(e.env.DB, s), e.json({ success: true })) : e.json({ success: false, error: "Endpoint required" }, 400);
  } catch (s) {
    return console.error("[Push Unsubscribe] Error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/push/vapid-public-key", b(), async (e) => {
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
  const r = z.hits + z.misses > 0 ? (z.hits / (z.hits + z.misses) * 100).toFixed(2) : "0.00";
  return e.json({ success: true, data: { cache: { ...z, hitRate: `${r}%`, cacheSize: ue.size, maxSize: 1e3, memoryUsage: `${(ue.size / 1e3 * 100).toFixed(1)}%` }, description: { hits: "Memory cache\uB85C \uCC98\uB9AC\uB41C \uC694\uCCAD (KV \uC77D\uAE30 0\uD68C)", misses: "Memory cache \uBBF8\uC2A4\uB85C KV \uC870\uD68C\uD55C \uC694\uCCAD", writes: "Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", evictions: "Memory cache\uC5D0\uC11C \uC0AD\uC81C\uB41C \uD56D\uBAA9 \uC218 (\uB9CC\uB8CC \uB610\uB294 \uD06C\uAE30 \uC81C\uD55C)", hitRate: "Cache hit \uBE44\uC728 (\uB192\uC744\uC218\uB85D KV \uC0AC\uC6A9\uB7C9 \uAC10\uC18C)", cacheSize: "\uD604\uC7AC Memory cache\uC5D0 \uC800\uC7A5\uB41C \uD56D\uBAA9 \uC218", maxSize: "Memory cache \uCD5C\uB300 \uD06C\uAE30", memoryUsage: "Memory cache \uC0AC\uC6A9\uB960 (cacheSize / maxSize)" }, kvUsageGuide: { currentHitRate: `${r}%`, recommendation: parseFloat(r) >= 90 ? "\u2705 \uCE90\uC2DC\uAC00 \uB9E4\uC6B0 \uD6A8\uACFC\uC801\uC73C\uB85C \uC791\uB3D9\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : parseFloat(r) >= 70 ? "\u26A0\uFE0F \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB0AE\uC2B5\uB2C8\uB2E4. TTL \uC870\uC815\uC744 \uACE0\uB824\uD558\uC138\uC694." : "\u274C \uCE90\uC2DC \uD788\uD2B8\uC728\uC774 \uB9E4\uC6B0 \uB0AE\uC2B5\uB2C8\uB2E4. \uCE90\uC2DC \uC124\uC815\uC744 \uD655\uC778\uD558\uC138\uC694.", kvDailyReadsLimit: "100,000 reads/day (free tier)", kvDailyWritesLimit: "1,000 writes/day (free tier)", estimatedDailyReads: Math.round(z.misses / (z.hits + z.misses || 1) * 1e4), estimatedDailyWrites: Math.round(z.writes / (z.hits + z.misses || 1) * 1e3) } } });
});
p.route("/", ps);
var ot = {};
var it = {};
p.get("/api/debug/kv-usage", b(), async (e) => {
  try {
    const s = Object.entries(ot).sort((i, c) => c[1] - i[1]).slice(0, 20), t = Object.entries(it).sort((i, c) => c[1] - i[1]).slice(0, 20), r = Object.values(ot).reduce((i, c) => i + c, 0), a = Object.values(it).reduce((i, c) => i + c, 0), n = r / 1e3 * 100, o = a / 1e5 * 100;
    if ((n >= 50 || o >= 50) && e.env.DISCORD_WEBHOOK_URL) try {
      await en(e.env.DISCORD_WEBHOOK_URL, o, n);
    } catch (i) {
      console.error("[Discord] KV \uACBD\uACE0 \uC804\uC1A1 \uC2E4\uD328:", i);
    }
    return e.json({ success: true, stats: { total_writes: r, total_reads: a, daily_write_limit: 1e3, daily_read_limit: 1e5, write_usage_percent: n.toFixed(2) + "%", read_usage_percent: o.toFixed(2) + "%", top_writes: s, top_reads: t }, recommendations: r > 500 ? ["\u26A0\uFE0F KV Write \uC0AC\uC6A9\uB7C9\uC774 \uB192\uC2B5\uB2C8\uB2E4!", "1. \uC138\uC158 \uAC31\uC2E0 \uC8FC\uAE30\uB97C \uB298\uB9AC\uC138\uC694 (\uD604\uC7AC 29\uC77C)", "2. \uCE90\uC2DC\uB97C \uBA54\uBAA8\uB9AC\uC5D0\uB9CC \uC800\uC7A5\uD558\uC138\uC694 (forceKvWrite: false)", "3. JWT \uC778\uC99D\uC73C\uB85C \uC804\uD658\uD558\uC138\uC694 (KV \uC0AC\uC6A9\uB7C9 90% \uAC10\uC18C)"] : ["\u2705 KV \uC0AC\uC6A9\uB7C9\uC774 \uC815\uC0C1 \uBC94\uC704\uC785\uB2C8\uB2E4."] });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/notifications", b(), async (e) => {
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
p.patch("/api/notifications/:id/read", b(), async (e) => {
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
p.patch("/api/notifications/read-all", b(), async (e) => {
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
p.delete("/api/notifications/:id", b(), async (e) => {
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
async function bn(e, s, t) {
  var a, n;
  const r = { embeds: [{ title: "\u{1F6A8} \uC11C\uBC84 \uC5D0\uB7EC \uBC1C\uC0DD", color: 16711680, fields: [{ name: "\uC5D0\uB7EC \uBA54\uC2DC\uC9C0", value: s.message || "Unknown error", inline: false }, { name: "\uBC1C\uC0DD \uC2DC\uAC01", value: (/* @__PURE__ */ new Date()).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }), inline: true }, { name: "HTTP \uBA54\uC18C\uB4DC", value: t.method || "N/A", inline: true }, { name: "API \uACBD\uB85C", value: t.path || "N/A", inline: false }, { name: "\uC0AC\uC6A9\uC790 ID", value: ((a = t.userId) == null ? void 0 : a.toString()) || "\uBE44\uB85C\uADF8\uC778", inline: true }, { name: "\uC0AC\uC6A9\uC790 \uD0C0\uC785", value: t.userType || "N/A", inline: true }, { name: "\uC5D0\uB7EC \uC2A4\uD0DD", value: "```\n" + (((n = s.stack) == null ? void 0 : n.substring(0, 800)) || "N/A") + "\n```", inline: false }], timestamp: (/* @__PURE__ */ new Date()).toISOString(), footer: { text: "UR LIVE Error Monitoring" } }] };
  try {
    await fetch(e, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) }), console.log("[Discord] Error alert sent successfully");
  } catch (o) {
    console.error("[Discord Webhook] Failed to send alert:", o);
  }
}
__name(bn, "bn");
p.onError(async (e, s) => {
  if (console.error("[Error]", e), s.env.DISCORD_WEBHOOK_URL) try {
    await bn(s.env.DISCORD_WEBHOOK_URL, e, { method: s.req.method, path: s.req.path, userId: s.get("userId"), userType: s.get("userType") });
  } catch (t) {
    console.error("[Discord] Webhook failed, but continuing:", t);
  }
  return s.json({ success: false, error: { code: e.code || "INTERNAL_ERROR", message: e.message || "\uC11C\uBC84 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." } }, e.status || 500);
});
var ct = new Ls();
var Tn = Object.assign({ "/src/index.tsx": p });
var zt = false;
for (const [, e] of Object.entries(Tn)) e && (ct.route("/", e), ct.notFound(e.notFoundHandler), zt = true);
if (!zt) throw new Error("Can't import modules from ['/src/index.tsx']");
async function Rn(e) {
  const s = crypto.getRandomValues(new Uint8Array(16)), t = new TextEncoder().encode(e), r = await crypto.subtle.importKey("raw", t, { name: "PBKDF2" }, false, ["deriveBits"]), a = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: s, iterations: 1e5, hash: "SHA-256" }, r, 256), n = btoa(String.fromCharCode(...s)), o = btoa(String.fromCharCode(...new Uint8Array(a)));
  return `${n}$${o}`;
}
__name(Rn, "Rn");
async function In(e, s) {
  const [t, r] = s.split("$");
  if (!t || !r) return false;
  const a = Uint8Array.from(atob(t), (l) => l.charCodeAt(0)), n = new TextEncoder().encode(e), o = await crypto.subtle.importKey("raw", n, { name: "PBKDF2" }, false, ["deriveBits"]), i = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: a, iterations: 1e5, hash: "SHA-256" }, o, 256), c = btoa(String.fromCharCode(...new Uint8Array(i)));
  return r === c;
}
__name(In, "In");
var vn = Object.freeze(Object.defineProperty({ __proto__: null, hashPassword: Rn, verifyPassword: In }, Symbol.toStringTag, { value: "Module" }));
async function Dn(e, s) {
  var t;
  if (!s) {
    console.log("[Discord Alert - Mock]", e);
    return;
  }
  try {
    const r = On(e.type), a = { title: An(e.type), description: e.details || kn(e), color: r, fields: [{ name: "\uC0AC\uC6A9\uC790", value: e.username || ((t = e.userId) == null ? void 0 : t.toString()) || "Unknown", inline: true }, { name: "\uC0AC\uC6A9\uC790 \uD0C0\uC785", value: e.userType || "N/A", inline: true }, { name: "IP \uC8FC\uC18C", value: e.ip || "Unknown", inline: true }, { name: "User Agent", value: e.userAgent ? Nn(e.userAgent, 100) : "Unknown", inline: false }, { name: "\uC2DC\uAC04", value: e.timestamp, inline: false }], footer: { text: "\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 Security Monitoring" }, timestamp: (/* @__PURE__ */ new Date()).toISOString() };
    if (e.metadata) for (const [n, o] of Object.entries(e.metadata)) a.fields.push({ name: n, value: String(o), inline: true });
    await fetch(s, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [a] }) }), console.log("[Discord Alert] Sent:", e.type);
  } catch (r) {
    console.error("[Discord Alert Error]", r);
  }
}
__name(Dn, "Dn");
function On(e) {
  return { login_success: 65280, login_failure: 16750848, suspicious_login: 16711680, jwt_validation_failure: 16737792, rate_limit_exceeded: 16711680 }[e] || 8421504;
}
__name(On, "On");
function An(e) {
  return { login_success: "\u2705 \uB85C\uADF8\uC778 \uC131\uACF5", login_failure: "\u26A0\uFE0F \uB85C\uADF8\uC778 \uC2E4\uD328", suspicious_login: "\u{1F6A8} \uC758\uC2EC\uC2A4\uB7EC\uC6B4 \uB85C\uADF8\uC778 \uAC10\uC9C0", jwt_validation_failure: "\u274C JWT \uAC80\uC99D \uC2E4\uD328", rate_limit_exceeded: "\u{1F6AB} Rate Limit \uCD08\uACFC" }[e] || "\u{1F4CA} \uBCF4\uC548 \uC774\uBCA4\uD2B8";
}
__name(An, "An");
function kn(e) {
  return { login_success: "\uC0AC\uC6A9\uC790\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uB85C\uADF8\uC778\uD588\uC2B5\uB2C8\uB2E4.", login_failure: "\uB85C\uADF8\uC778 \uC2DC\uB3C4\uAC00 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uBE44\uBC00\uBC88\uD638 \uC624\uB958 \uB610\uB294 \uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uACC4\uC815\uC785\uB2C8\uB2E4.", suspicious_login: "\uBE44\uC815\uC0C1\uC801\uC778 \uB85C\uADF8\uC778 \uD328\uD134\uC774 \uAC10\uC9C0\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC989\uC2DC \uD655\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.", jwt_validation_failure: "JWT \uD1A0\uD070 \uAC80\uC99D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB9CC\uB8CC\uB418\uC5C8\uAC70\uB098 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uD1A0\uD070\uC785\uB2C8\uB2E4.", rate_limit_exceeded: "API Rate Limit\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. DDoS \uACF5\uACA9 \uAC00\uB2A5\uC131\uC774 \uC788\uC2B5\uB2C8\uB2E4." }[e.type] || "\uBCF4\uC548 \uAD00\uB828 \uC774\uBCA4\uD2B8\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
}
__name(kn, "kn");
function Nn(e, s) {
  return e.length <= s ? e : e.substring(0, s) + "...";
}
__name(Nn, "Nn");
function Cn(e, s, t, r) {
  const a = Date.now() - 3e5;
  if (r.filter((c) => c.ip === e && !c.success && c.timestamp > a).length >= 3 || t === "admin") return true;
  const o = ["python", "curl", "wget", "postman", "insomnia", "bot", "crawler", "spider", "scraper"], i = s.toLowerCase();
  return !!o.some((c) => i.includes(c));
}
__name(Cn, "Cn");
var qe = /* @__PURE__ */ new Map();
function jn(e, s) {
  const t = qe.get(e) || [];
  t.push({ timestamp: Date.now(), success: s });
  const r = Date.now() - 3600 * 1e3, a = t.filter((n) => n.timestamp > r);
  if (qe.set(e, a), qe.size > 1e3) {
    const n = qe.keys().next().value;
    qe.delete(n);
  }
}
__name(jn, "jn");
function Ln(e) {
  return (qe.get(e) || []).map((s) => ({ ...s, ip: e }));
}
__name(Ln, "Ln");
var ks = Object.freeze(Object.defineProperty({ __proto__: null, addLoginHistory: jn, detectSuspiciousLogin: Cn, getLoginHistory: Ln, sendDiscordAlert: Dn }, Symbol.toStringTag, { value: "Module" }));
async function Gt(e) {
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
__name(Gt, "Gt");
async function Mn(e) {
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
  return Gt({ to: "jiwon@ur-team.com", subject: `[\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158] \u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131: ${t}`, htmlContent: l, textContent: u });
}
__name(Mn, "Mn");
var $n = Object.freeze(Object.defineProperty({ __proto__: null, sendEmail: Gt, sendLiveStreamCreatedEmail: Mn }, Symbol.toStringTag, { value: "Module" }));
async function Un(e, s, t) {
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
__name(Un, "Un");
function Pn(e, s) {
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
__name(Pn, "Pn");
function qn(e, s) {
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
__name(qn, "qn");
var Xt = Object.freeze(Object.defineProperty({ __proto__: null, getSellerApprovalEmailHTML: Pn, getSellerRejectionEmailHTML: qn, sendEmail: Un }, Symbol.toStringTag, { value: "Module" }));
async function xn(e, s) {
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
__name(xn, "xn");
var Hn = { seller_approved: /* @__PURE__ */ __name((e) => ({ title: "\u{1F389} \uD310\uB9E4\uC790 \uC2B9\uC778 \uC644\uB8CC", message: `${e}\uB2D8, \uCD95\uD558\uD569\uB2C8\uB2E4! \uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158 \uD310\uB9E4\uC790\uB85C \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller" }), "seller_approved"), seller_rejected: /* @__PURE__ */ __name((e) => ({ title: "\uD310\uB9E4\uC790 \uC2B9\uC778 \uAC70\uBD80", message: `\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uD310\uB9E4\uC790 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0AC\uC720: ${e}`, linkUrl: "/seller/register" }), "seller_rejected"), order_complete: /* @__PURE__ */ __name((e) => ({ title: "\uC8FC\uBB38 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_complete"), order_shipped: /* @__PURE__ */ __name((e) => ({ title: "\uBC30\uC1A1 \uC2DC\uC791", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC0C1\uD488\uC774 \uBC30\uC1A1 \uC2DC\uC791\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_shipped"), order_delivered: /* @__PURE__ */ __name((e) => ({ title: "\uBC30\uC1A1 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uC0C1\uD488\uC774 \uBC30\uC1A1 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "order_delivered"), refund_requested: /* @__PURE__ */ __name((e) => ({ title: "\uD658\uBD88 \uC694\uCCAD \uC811\uC218", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uD658\uBD88\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "refund_requested"), refund_complete: /* @__PURE__ */ __name((e, s) => ({ title: "\uD658\uBD88 \uC644\uB8CC", message: `\uC8FC\uBB38\uBC88\uD638 ${e}\uC758 \uD658\uBD88(\u20A9${s.toLocaleString()})\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: `/orders/${e}` }), "refund_complete"), product_low_stock: /* @__PURE__ */ __name((e, s) => ({ title: "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", message: `${e}\uC758 \uC7AC\uACE0\uAC00 ${s}\uAC1C \uB0A8\uC558\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller/products" }), "product_low_stock"), product_sold_out: /* @__PURE__ */ __name((e) => ({ title: "\u274C \uD488\uC808 \uC54C\uB9BC", message: `${e}\uC774(\uAC00) \uD488\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, linkUrl: "/seller/products" }), "product_sold_out") };
var Qt = Object.freeze(Object.defineProperty({ __proto__: null, NotificationTemplates: Hn, createNotification: xn }, Symbol.toStringTag, { value: "Module" }));

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

// ../.wrangler/tmp/bundle-LpoDkn/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = ct;

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

// ../.wrangler/tmp/bundle-LpoDkn/middleware-loader.entry.ts
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
//# sourceMappingURL=bundledWorker-0.1988355877757917.mjs.map
