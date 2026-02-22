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
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
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
  assert: assert2,
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
var zs = Object.defineProperty;
var cs = /* @__PURE__ */ __name((e) => {
  throw TypeError(e);
}, "cs");
var Gs = /* @__PURE__ */ __name((e, t, r) => t in e ? zs(e, t, { enumerable: true, configurable: true, writable: true, value: r }) : e[t] = r, "Gs");
var S = /* @__PURE__ */ __name((e, t, r) => Gs(e, typeof t != "symbol" ? t + "" : t, r), "S");
var Qe = /* @__PURE__ */ __name((e, t, r) => t.has(e) || cs("Cannot " + r), "Qe");
var m = /* @__PURE__ */ __name((e, t, r) => (Qe(e, t, "read from private field"), r ? r.call(e) : t.get(e)), "m");
var R = /* @__PURE__ */ __name((e, t, r) => t.has(e) ? cs("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, r), "R");
var T = /* @__PURE__ */ __name((e, t, r, s) => (Qe(e, t, "write to private field"), s ? s.call(e, r) : t.set(e, r), r), "T");
var j = /* @__PURE__ */ __name((e, t, r) => (Qe(e, t, "access private method"), r), "j");
var us = /* @__PURE__ */ __name((e, t, r, s) => ({ set _(a) {
  T(e, t, a, r);
}, get _() {
  return m(e, t, s);
} }), "us");
var ls = /* @__PURE__ */ __name((e, t, r) => (s, a) => {
  let n = -1;
  return o(0);
  async function o(i) {
    if (i <= n) throw new Error("next() called multiple times");
    n = i;
    let c, u = false, l;
    if (e[i] ? (l = e[i][0][0], s.req.routeIndex = i) : l = i === e.length && a || void 0, l) try {
      c = await l(s, () => o(i + 1));
    } catch (d) {
      if (d instanceof Error && t) s.error = d, c = await t(d, s), u = true;
      else throw d;
    }
    else s.finalized === false && r && (c = await r(s));
    return c && (s.finalized === false || u) && (s.res = c), s;
  }
  __name(o, "o");
}, "ls");
var Xs = Symbol();
var Qs = /* @__PURE__ */ __name(async (e, t = /* @__PURE__ */ Object.create(null)) => {
  const { all: r = false, dot: s = false } = t, n = (e instanceof Rs ? e.raw.headers : e.headers).get("Content-Type");
  return n != null && n.startsWith("multipart/form-data") || n != null && n.startsWith("application/x-www-form-urlencoded") ? Zs(e, { all: r, dot: s }) : {};
}, "Qs");
async function Zs(e, t) {
  const r = await e.formData();
  return r ? er(r, t) : {};
}
__name(Zs, "Zs");
function er(e, t) {
  const r = /* @__PURE__ */ Object.create(null);
  return e.forEach((s, a) => {
    t.all || a.endsWith("[]") ? sr(r, a, s) : r[a] = s;
  }), t.dot && Object.entries(r).forEach(([s, a]) => {
    s.includes(".") && (rr(r, s, a), delete r[s]);
  }), r;
}
__name(er, "er");
var sr = /* @__PURE__ */ __name((e, t, r) => {
  e[t] !== void 0 ? Array.isArray(e[t]) ? e[t].push(r) : e[t] = [e[t], r] : t.endsWith("[]") ? e[t] = [r] : e[t] = r;
}, "sr");
var rr = /* @__PURE__ */ __name((e, t, r) => {
  let s = e;
  const a = t.split(".");
  a.forEach((n, o) => {
    o === a.length - 1 ? s[n] = r : ((!s[n] || typeof s[n] != "object" || Array.isArray(s[n]) || s[n] instanceof File) && (s[n] = /* @__PURE__ */ Object.create(null)), s = s[n]);
  });
}, "rr");
var bs = /* @__PURE__ */ __name((e) => {
  const t = e.split("/");
  return t[0] === "" && t.shift(), t;
}, "bs");
var tr = /* @__PURE__ */ __name((e) => {
  const { groups: t, path: r } = ar(e), s = bs(r);
  return nr(s, t);
}, "tr");
var ar = /* @__PURE__ */ __name((e) => {
  const t = [];
  return e = e.replace(/\{[^}]+\}/g, (r, s) => {
    const a = `@${s}`;
    return t.push([a, r]), a;
  }), { groups: t, path: e };
}, "ar");
var nr = /* @__PURE__ */ __name((e, t) => {
  for (let r = t.length - 1; r >= 0; r--) {
    const [s] = t[r];
    for (let a = e.length - 1; a >= 0; a--) if (e[a].includes(s)) {
      e[a] = e[a].replace(s, t[r][1]);
      break;
    }
  }
  return e;
}, "nr");
var Ke = {};
var or = /* @__PURE__ */ __name((e, t) => {
  if (e === "*") return "*";
  const r = e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (r) {
    const s = `${e}#${t}`;
    return Ke[s] || (r[2] ? Ke[s] = t && t[0] !== ":" && t[0] !== "*" ? [s, r[1], new RegExp(`^${r[2]}(?=/${t})`)] : [e, r[1], new RegExp(`^${r[2]}$`)] : Ke[s] = [e, r[1], true]), Ke[s];
  }
  return null;
}, "or");
var ts = /* @__PURE__ */ __name((e, t) => {
  try {
    return t(e);
  } catch {
    return e.replace(/(?:%[0-9A-Fa-f]{2})+/g, (r) => {
      try {
        return t(r);
      } catch {
        return r;
      }
    });
  }
}, "ts");
var ir = /* @__PURE__ */ __name((e) => ts(e, decodeURI), "ir");
var ws = /* @__PURE__ */ __name((e) => {
  const t = e.url, r = t.indexOf("/", t.indexOf(":") + 4);
  let s = r;
  for (; s < t.length; s++) {
    const a = t.charCodeAt(s);
    if (a === 37) {
      const n = t.indexOf("?", s), o = t.slice(r, n === -1 ? void 0 : n);
      return ir(o.includes("%25") ? o.replace(/%25/g, "%2525") : o);
    } else if (a === 63) break;
  }
  return t.slice(r, s);
}, "ws");
var cr = /* @__PURE__ */ __name((e) => {
  const t = ws(e);
  return t.length > 1 && t.at(-1) === "/" ? t.slice(0, -1) : t;
}, "cr");
var be = /* @__PURE__ */ __name((e, t, ...r) => (r.length && (t = be(t, ...r)), `${(e == null ? void 0 : e[0]) === "/" ? "" : "/"}${e}${t === "/" ? "" : `${(e == null ? void 0 : e.at(-1)) === "/" ? "" : "/"}${(t == null ? void 0 : t[0]) === "/" ? t.slice(1) : t}`}`), "be");
var Ts = /* @__PURE__ */ __name((e) => {
  if (e.charCodeAt(e.length - 1) !== 63 || !e.includes(":")) return null;
  const t = e.split("/"), r = [];
  let s = "";
  return t.forEach((a) => {
    if (a !== "" && !/\:/.test(a)) s += "/" + a;
    else if (/\:/.test(a)) if (/\?/.test(a)) {
      r.length === 0 && s === "" ? r.push("/") : r.push(s);
      const n = a.replace("?", "");
      s += "/" + n, r.push(s);
    } else s += "/" + a;
  }), r.filter((a, n, o) => o.indexOf(a) === n);
}, "Ts");
var Ze = /* @__PURE__ */ __name((e) => /[%+]/.test(e) ? (e.indexOf("+") !== -1 && (e = e.replace(/\+/g, " ")), e.indexOf("%") !== -1 ? ts(e, Is) : e) : e, "Ze");
var Ss = /* @__PURE__ */ __name((e, t, r) => {
  let s;
  if (!r && t && !/[%+]/.test(t)) {
    let o = e.indexOf("?", 8);
    if (o === -1) return;
    for (e.startsWith(t, o + 1) || (o = e.indexOf(`&${t}`, o + 1)); o !== -1; ) {
      const i = e.charCodeAt(o + t.length + 1);
      if (i === 61) {
        const c = o + t.length + 2, u = e.indexOf("&", c);
        return Ze(e.slice(c, u === -1 ? void 0 : u));
      } else if (i == 38 || isNaN(i)) return "";
      o = e.indexOf(`&${t}`, o + 1);
    }
    if (s = /[%+]/.test(e), !s) return;
  }
  const a = {};
  s ?? (s = /[%+]/.test(e));
  let n = e.indexOf("?", 8);
  for (; n !== -1; ) {
    const o = e.indexOf("&", n + 1);
    let i = e.indexOf("=", n);
    i > o && o !== -1 && (i = -1);
    let c = e.slice(n + 1, i === -1 ? o === -1 ? void 0 : o : i);
    if (s && (c = Ze(c)), n = o, c === "") continue;
    let u;
    i === -1 ? u = "" : (u = e.slice(i + 1, o === -1 ? void 0 : o), s && (u = Ze(u))), r ? (a[c] && Array.isArray(a[c]) || (a[c] = []), a[c].push(u)) : a[c] ?? (a[c] = u);
  }
  return t ? a[t] : a;
}, "Ss");
var ur = Ss;
var lr = /* @__PURE__ */ __name((e, t) => Ss(e, t, true), "lr");
var Is = decodeURIComponent;
var ds = /* @__PURE__ */ __name((e) => ts(e, Is), "ds");
var Se;
var B;
var te;
var vs;
var Os;
var rs;
var ae;
var _s;
var Rs = (_s = class {
  static {
    __name(this, "_s");
  }
  constructor(e, t = "/", r = [[]]) {
    R(this, te);
    S(this, "raw");
    R(this, Se);
    R(this, B);
    S(this, "routeIndex", 0);
    S(this, "path");
    S(this, "bodyCache", {});
    R(this, ae, (e2) => {
      const { bodyCache: t2, raw: r2 } = this, s = t2[e2];
      if (s) return s;
      const a = Object.keys(t2)[0];
      return a ? t2[a].then((n) => (a === "json" && (n = JSON.stringify(n)), new Response(n)[e2]())) : t2[e2] = r2[e2]();
    });
    this.raw = e, this.path = t, T(this, B, r), T(this, Se, {});
  }
  param(e) {
    return e ? j(this, te, vs).call(this, e) : j(this, te, Os).call(this);
  }
  query(e) {
    return ur(this.url, e);
  }
  queries(e) {
    return lr(this.url, e);
  }
  header(e) {
    if (e) return this.raw.headers.get(e) ?? void 0;
    const t = {};
    return this.raw.headers.forEach((r, s) => {
      t[s] = r;
    }), t;
  }
  async parseBody(e) {
    var t;
    return (t = this.bodyCache).parsedBody ?? (t.parsedBody = await Qs(this, e));
  }
  json() {
    return m(this, ae).call(this, "text").then((e) => JSON.parse(e));
  }
  text() {
    return m(this, ae).call(this, "text");
  }
  arrayBuffer() {
    return m(this, ae).call(this, "arrayBuffer");
  }
  blob() {
    return m(this, ae).call(this, "blob");
  }
  formData() {
    return m(this, ae).call(this, "formData");
  }
  addValidatedData(e, t) {
    m(this, Se)[e] = t;
  }
  valid(e) {
    return m(this, Se)[e];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [Xs]() {
    return m(this, B);
  }
  get matchedRoutes() {
    return m(this, B)[0].map(([[, e]]) => e);
  }
  get routePath() {
    return m(this, B)[0].map(([[, e]]) => e)[this.routeIndex].path;
  }
}, Se = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new WeakMap(), te = /* @__PURE__ */ new WeakSet(), vs = /* @__PURE__ */ __name(function(e) {
  const t = m(this, B)[0][this.routeIndex][1][e], r = j(this, te, rs).call(this, t);
  return r && /\%/.test(r) ? ds(r) : r;
}, "vs"), Os = /* @__PURE__ */ __name(function() {
  const e = {}, t = Object.keys(m(this, B)[0][this.routeIndex][1]);
  for (const r of t) {
    const s = j(this, te, rs).call(this, m(this, B)[0][this.routeIndex][1][r]);
    s !== void 0 && (e[r] = /\%/.test(s) ? ds(s) : s);
  }
  return e;
}, "Os"), rs = /* @__PURE__ */ __name(function(e) {
  return m(this, B)[1] ? m(this, B)[1][e] : e;
}, "rs"), ae = /* @__PURE__ */ new WeakMap(), _s);
var dr = { Stringify: 1 };
var js = /* @__PURE__ */ __name(async (e, t, r, s, a) => {
  typeof e == "object" && !(e instanceof String) && (e instanceof Promise || (e = e.toString()), e instanceof Promise && (e = await e));
  const n = e.callbacks;
  return n != null && n.length ? (a ? a[0] += e : a = [e], Promise.all(n.map((i) => i({ phase: t, buffer: a, context: s }))).then((i) => Promise.all(i.filter(Boolean).map((c) => js(c, t, false, s, a))).then(() => a[0]))) : Promise.resolve(e);
}, "js");
var pr = "text/plain; charset=UTF-8";
var es = /* @__PURE__ */ __name((e, t) => ({ "Content-Type": e, ...t }), "es");
var Pe;
var He;
var Z;
var Ie;
var ee;
var W;
var Ue;
var Re;
var ve;
var me;
var xe;
var $e;
var ne;
var we;
var fs;
var mr = (fs = class {
  static {
    __name(this, "fs");
  }
  constructor(e, t) {
    R(this, ne);
    R(this, Pe);
    R(this, He);
    S(this, "env", {});
    R(this, Z);
    S(this, "finalized", false);
    S(this, "error");
    R(this, Ie);
    R(this, ee);
    R(this, W);
    R(this, Ue);
    R(this, Re);
    R(this, ve);
    R(this, me);
    R(this, xe);
    R(this, $e);
    S(this, "render", (...e2) => (m(this, Re) ?? T(this, Re, (t2) => this.html(t2)), m(this, Re).call(this, ...e2)));
    S(this, "setLayout", (e2) => T(this, Ue, e2));
    S(this, "getLayout", () => m(this, Ue));
    S(this, "setRenderer", (e2) => {
      T(this, Re, e2);
    });
    S(this, "header", (e2, t2, r) => {
      this.finalized && T(this, W, new Response(m(this, W).body, m(this, W)));
      const s = m(this, W) ? m(this, W).headers : m(this, me) ?? T(this, me, new Headers());
      t2 === void 0 ? s.delete(e2) : r != null && r.append ? s.append(e2, t2) : s.set(e2, t2);
    });
    S(this, "status", (e2) => {
      T(this, Ie, e2);
    });
    S(this, "set", (e2, t2) => {
      m(this, Z) ?? T(this, Z, /* @__PURE__ */ new Map()), m(this, Z).set(e2, t2);
    });
    S(this, "get", (e2) => m(this, Z) ? m(this, Z).get(e2) : void 0);
    S(this, "newResponse", (...e2) => j(this, ne, we).call(this, ...e2));
    S(this, "body", (e2, t2, r) => j(this, ne, we).call(this, e2, t2, r));
    S(this, "text", (e2, t2, r) => !m(this, me) && !m(this, Ie) && !t2 && !r && !this.finalized ? new Response(e2) : j(this, ne, we).call(this, e2, t2, es(pr, r)));
    S(this, "json", (e2, t2, r) => j(this, ne, we).call(this, JSON.stringify(e2), t2, es("application/json", r)));
    S(this, "html", (e2, t2, r) => {
      const s = /* @__PURE__ */ __name((a) => j(this, ne, we).call(this, a, t2, es("text/html; charset=UTF-8", r)), "s");
      return typeof e2 == "object" ? js(e2, dr.Stringify, false, {}).then(s) : s(e2);
    });
    S(this, "redirect", (e2, t2) => {
      const r = String(e2);
      return this.header("Location", /[^\x00-\xFF]/.test(r) ? encodeURI(r) : r), this.newResponse(null, t2 ?? 302);
    });
    S(this, "notFound", () => (m(this, ve) ?? T(this, ve, () => new Response()), m(this, ve).call(this, this)));
    T(this, Pe, e), t && (T(this, ee, t.executionCtx), this.env = t.env, T(this, ve, t.notFoundHandler), T(this, $e, t.path), T(this, xe, t.matchResult));
  }
  get req() {
    return m(this, He) ?? T(this, He, new Rs(m(this, Pe), m(this, $e), m(this, xe))), m(this, He);
  }
  get event() {
    if (m(this, ee) && "respondWith" in m(this, ee)) return m(this, ee);
    throw Error("This context has no FetchEvent");
  }
  get executionCtx() {
    if (m(this, ee)) return m(this, ee);
    throw Error("This context has no ExecutionContext");
  }
  get res() {
    return m(this, W) || T(this, W, new Response(null, { headers: m(this, me) ?? T(this, me, new Headers()) }));
  }
  set res(e) {
    if (m(this, W) && e) {
      e = new Response(e.body, e);
      for (const [t, r] of m(this, W).headers.entries()) if (t !== "content-type") if (t === "set-cookie") {
        const s = m(this, W).headers.getSetCookie();
        e.headers.delete("set-cookie");
        for (const a of s) e.headers.append("set-cookie", a);
      } else e.headers.set(t, r);
    }
    T(this, W, e), this.finalized = true;
  }
  get var() {
    return m(this, Z) ? Object.fromEntries(m(this, Z)) : {};
  }
}, Pe = /* @__PURE__ */ new WeakMap(), He = /* @__PURE__ */ new WeakMap(), Z = /* @__PURE__ */ new WeakMap(), Ie = /* @__PURE__ */ new WeakMap(), ee = /* @__PURE__ */ new WeakMap(), W = /* @__PURE__ */ new WeakMap(), Ue = /* @__PURE__ */ new WeakMap(), Re = /* @__PURE__ */ new WeakMap(), ve = /* @__PURE__ */ new WeakMap(), me = /* @__PURE__ */ new WeakMap(), xe = /* @__PURE__ */ new WeakMap(), $e = /* @__PURE__ */ new WeakMap(), ne = /* @__PURE__ */ new WeakSet(), we = /* @__PURE__ */ __name(function(e, t, r) {
  const s = m(this, W) ? new Headers(m(this, W).headers) : m(this, me) ?? new Headers();
  if (typeof t == "object" && "headers" in t) {
    const n = t.headers instanceof Headers ? t.headers : new Headers(t.headers);
    for (const [o, i] of n) o.toLowerCase() === "set-cookie" ? s.append(o, i) : s.set(o, i);
  }
  if (r) for (const [n, o] of Object.entries(r)) if (typeof o == "string") s.set(n, o);
  else {
    s.delete(n);
    for (const i of o) s.append(n, i);
  }
  const a = typeof t == "number" ? t : (t == null ? void 0 : t.status) ?? m(this, Ie);
  return new Response(e, { status: a, headers: s });
}, "we"), fs);
var P = "ALL";
var _r = "all";
var fr = ["get", "post", "put", "delete", "options", "patch"];
var Ds = "Can not add a route since the matcher is already built.";
var Ns = class extends Error {
  static {
    __name(this, "Ns");
  }
};
var Er = "__COMPOSED_HANDLER";
var hr = /* @__PURE__ */ __name((e) => e.text("404 Not Found", 404), "hr");
var ps = /* @__PURE__ */ __name((e, t) => {
  if ("getResponse" in e) {
    const r = e.getResponse();
    return t.newResponse(r.body, r);
  }
  return console.error(e), t.text("Internal Server Error", 500);
}, "ps");
var V;
var H;
var As;
var J;
var de;
var We;
var Be;
var Oe;
var yr = (Oe = class {
  static {
    __name(this, "Oe");
  }
  constructor(t = {}) {
    R(this, H);
    S(this, "get");
    S(this, "post");
    S(this, "put");
    S(this, "delete");
    S(this, "options");
    S(this, "patch");
    S(this, "all");
    S(this, "on");
    S(this, "use");
    S(this, "router");
    S(this, "getPath");
    S(this, "_basePath", "/");
    R(this, V, "/");
    S(this, "routes", []);
    R(this, J, hr);
    S(this, "errorHandler", ps);
    S(this, "onError", (t2) => (this.errorHandler = t2, this));
    S(this, "notFound", (t2) => (T(this, J, t2), this));
    S(this, "fetch", (t2, ...r) => j(this, H, Be).call(this, t2, r[1], r[0], t2.method));
    S(this, "request", (t2, r, s2, a2) => t2 instanceof Request ? this.fetch(r ? new Request(t2, r) : t2, s2, a2) : (t2 = t2.toString(), this.fetch(new Request(/^https?:\/\//.test(t2) ? t2 : `http://localhost${be("/", t2)}`, r), s2, a2)));
    S(this, "fire", () => {
      addEventListener("fetch", (t2) => {
        t2.respondWith(j(this, H, Be).call(this, t2.request, t2, void 0, t2.request.method));
      });
    });
    [...fr, _r].forEach((n) => {
      this[n] = (o, ...i) => (typeof o == "string" ? T(this, V, o) : j(this, H, de).call(this, n, m(this, V), o), i.forEach((c) => {
        j(this, H, de).call(this, n, m(this, V), c);
      }), this);
    }), this.on = (n, o, ...i) => {
      for (const c of [o].flat()) {
        T(this, V, c);
        for (const u of [n].flat()) i.map((l) => {
          j(this, H, de).call(this, u.toUpperCase(), m(this, V), l);
        });
      }
      return this;
    }, this.use = (n, ...o) => (typeof n == "string" ? T(this, V, n) : (T(this, V, "*"), o.unshift(n)), o.forEach((i) => {
      j(this, H, de).call(this, P, m(this, V), i);
    }), this);
    const { strict: s, ...a } = t;
    Object.assign(this, a), this.getPath = s ?? true ? t.getPath ?? ws : cr;
  }
  route(t, r) {
    const s = this.basePath(t);
    return r.routes.map((a) => {
      var o;
      let n;
      r.errorHandler === ps ? n = a.handler : (n = /* @__PURE__ */ __name(async (i, c) => (await ls([], r.errorHandler)(i, () => a.handler(i, c))).res, "n"), n[Er] = a.handler), j(o = s, H, de).call(o, a.method, a.path, n);
    }), this;
  }
  basePath(t) {
    const r = j(this, H, As).call(this);
    return r._basePath = be(this._basePath, t), r;
  }
  mount(t, r, s) {
    let a, n;
    s && (typeof s == "function" ? n = s : (n = s.optionHandler, s.replaceRequest === false ? a = /* @__PURE__ */ __name((c) => c, "a") : a = s.replaceRequest));
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
        const d = new URL(l.url);
        return d.pathname = d.pathname.slice(u) || "/", new Request(d, l);
      };
    })());
    const i = /* @__PURE__ */ __name(async (c, u) => {
      const l = await r(a(c.req.raw), ...o(c));
      if (l) return l;
      await u();
    }, "i");
    return j(this, H, de).call(this, P, be(t, "*"), i), this;
  }
}, V = /* @__PURE__ */ new WeakMap(), H = /* @__PURE__ */ new WeakSet(), As = /* @__PURE__ */ __name(function() {
  const t = new Oe({ router: this.router, getPath: this.getPath });
  return t.errorHandler = this.errorHandler, T(t, J, m(this, J)), t.routes = this.routes, t;
}, "As"), J = /* @__PURE__ */ new WeakMap(), de = /* @__PURE__ */ __name(function(t, r, s) {
  t = t.toUpperCase(), r = be(this._basePath, r);
  const a = { basePath: this._basePath, path: r, method: t, handler: s };
  this.router.add(t, r, [s, a]), this.routes.push(a);
}, "de"), We = /* @__PURE__ */ __name(function(t, r) {
  if (t instanceof Error) return this.errorHandler(t, r);
  throw t;
}, "We"), Be = /* @__PURE__ */ __name(function(t, r, s, a) {
  if (a === "HEAD") return (async () => new Response(null, await j(this, H, Be).call(this, t, r, s, "GET")))();
  const n = this.getPath(t, { env: s }), o = this.router.match(a, n), i = new mr(t, { path: n, matchResult: o, env: s, executionCtx: r, notFoundHandler: m(this, J) });
  if (o[0].length === 1) {
    let u;
    try {
      u = o[0][0][0][0](i, async () => {
        i.res = await m(this, J).call(this, i);
      });
    } catch (l) {
      return j(this, H, We).call(this, l, i);
    }
    return u instanceof Promise ? u.then((l) => l || (i.finalized ? i.res : m(this, J).call(this, i))).catch((l) => j(this, H, We).call(this, l, i)) : u ?? m(this, J).call(this, i);
  }
  const c = ls(o[0], this.errorHandler, m(this, J));
  return (async () => {
    try {
      const u = await c(i);
      if (!u.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
      return u.res;
    } catch (u) {
      return j(this, H, We).call(this, u, i);
    }
  })();
}, "Be"), Oe);
var Cs = [];
function gr(e, t) {
  const r = this.buildAllMatchers(), s = /* @__PURE__ */ __name(((a, n) => {
    const o = r[a] || r[P], i = o[2][n];
    if (i) return i;
    const c = n.match(o[0]);
    if (!c) return [[], Cs];
    const u = c.indexOf("", 1);
    return [o[1][u], c];
  }), "s");
  return this.match = s, s(e, t);
}
__name(gr, "gr");
var Ve = "[^/]+";
var Le = ".*";
var Me = "(?:|/.*)";
var Te = Symbol();
var br = new Set(".\\+*[^]$()");
function wr(e, t) {
  return e.length === 1 ? t.length === 1 ? e < t ? -1 : 1 : -1 : t.length === 1 || e === Le || e === Me ? 1 : t === Le || t === Me ? -1 : e === Ve ? 1 : t === Ve ? -1 : e.length === t.length ? e < t ? -1 : 1 : t.length - e.length;
}
__name(wr, "wr");
var _e;
var fe;
var z;
var ye;
var Tr = (ye = class {
  static {
    __name(this, "ye");
  }
  constructor() {
    R(this, _e);
    R(this, fe);
    R(this, z, /* @__PURE__ */ Object.create(null));
  }
  insert(t, r, s, a, n) {
    if (t.length === 0) {
      if (m(this, _e) !== void 0) throw Te;
      if (n) return;
      T(this, _e, r);
      return;
    }
    const [o, ...i] = t, c = o === "*" ? i.length === 0 ? ["", "", Le] : ["", "", Ve] : o === "/*" ? ["", "", Me] : o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let u;
    if (c) {
      const l = c[1];
      let d = c[2] || Ve;
      if (l && c[2] && (d === ".*" || (d = d.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:"), /\((?!\?:)/.test(d)))) throw Te;
      if (u = m(this, z)[d], !u) {
        if (Object.keys(m(this, z)).some((_) => _ !== Le && _ !== Me)) throw Te;
        if (n) return;
        u = m(this, z)[d] = new ye(), l !== "" && T(u, fe, a.varIndex++);
      }
      !n && l !== "" && s.push([l, m(u, fe)]);
    } else if (u = m(this, z)[o], !u) {
      if (Object.keys(m(this, z)).some((l) => l.length > 1 && l !== Le && l !== Me)) throw Te;
      if (n) return;
      u = m(this, z)[o] = new ye();
    }
    u.insert(i, r, s, a, n);
  }
  buildRegExpStr() {
    const r = Object.keys(m(this, z)).sort(wr).map((s) => {
      const a = m(this, z)[s];
      return (typeof m(a, fe) == "number" ? `(${s})@${m(a, fe)}` : br.has(s) ? `\\${s}` : s) + a.buildRegExpStr();
    });
    return typeof m(this, _e) == "number" && r.unshift(`#${m(this, _e)}`), r.length === 0 ? "" : r.length === 1 ? r[0] : "(?:" + r.join("|") + ")";
  }
}, _e = /* @__PURE__ */ new WeakMap(), fe = /* @__PURE__ */ new WeakMap(), z = /* @__PURE__ */ new WeakMap(), ye);
var ze;
var Fe;
var Es;
var Sr = (Es = class {
  static {
    __name(this, "Es");
  }
  constructor() {
    R(this, ze, { varIndex: 0 });
    R(this, Fe, new Tr());
  }
  insert(e, t, r) {
    const s = [], a = [];
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
    return m(this, Fe).insert(n, t, s, m(this, ze), r), s;
  }
  buildRegExp() {
    let e = m(this, Fe).buildRegExpStr();
    if (e === "") return [/^$/, [], []];
    let t = 0;
    const r = [], s = [];
    return e = e.replace(/#(\d+)|@(\d+)|\.\*\$/g, (a, n, o) => n !== void 0 ? (r[++t] = Number(n), "$()") : (o !== void 0 && (s[Number(o)] = ++t), "")), [new RegExp(`^${e}`), r, s];
  }
}, ze = /* @__PURE__ */ new WeakMap(), Fe = /* @__PURE__ */ new WeakMap(), Es);
var Ir = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var Ye = /* @__PURE__ */ Object.create(null);
function ks(e) {
  return Ye[e] ?? (Ye[e] = new RegExp(e === "*" ? "" : `^${e.replace(/\/\*$|([.\\+*[^\]$()])/g, (t, r) => r ? `\\${r}` : "(?:|/.*)")}$`));
}
__name(ks, "ks");
function Rr() {
  Ye = /* @__PURE__ */ Object.create(null);
}
__name(Rr, "Rr");
function vr(e) {
  var u;
  const t = new Sr(), r = [];
  if (e.length === 0) return Ir;
  const s = e.map((l) => [!/\*|\/:/.test(l[0]), ...l]).sort(([l, d], [_, E]) => l ? 1 : _ ? -1 : d.length - E.length), a = /* @__PURE__ */ Object.create(null);
  for (let l = 0, d = -1, _ = s.length; l < _; l++) {
    const [E, f, y] = s[l];
    E ? a[f] = [y.map(([b]) => [b, /* @__PURE__ */ Object.create(null)]), Cs] : d++;
    let h;
    try {
      h = t.insert(f, d, E);
    } catch (b) {
      throw b === Te ? new Ns(f) : b;
    }
    E || (r[d] = y.map(([b, g]) => {
      const D = /* @__PURE__ */ Object.create(null);
      for (g -= 1; g >= 0; g--) {
        const [N, w] = h[g];
        D[N] = w;
      }
      return [b, D];
    }));
  }
  const [n, o, i] = t.buildRegExp();
  for (let l = 0, d = r.length; l < d; l++) for (let _ = 0, E = r[l].length; _ < E; _++) {
    const f = (u = r[l][_]) == null ? void 0 : u[1];
    if (!f) continue;
    const y = Object.keys(f);
    for (let h = 0, b = y.length; h < b; h++) f[y[h]] = i[f[y[h]]];
  }
  const c = [];
  for (const l in o) c[l] = r[o[l]];
  return [n, c, a];
}
__name(vr, "vr");
function ge(e, t) {
  if (e) {
    for (const r of Object.keys(e).sort((s, a) => a.length - s.length)) if (ks(r).test(t)) return [...e[r]];
  }
}
__name(ge, "ge");
var oe;
var ie;
var Ge;
var Ls;
var hs;
var Or = (hs = class {
  static {
    __name(this, "hs");
  }
  constructor() {
    R(this, Ge);
    S(this, "name", "RegExpRouter");
    R(this, oe);
    R(this, ie);
    S(this, "match", gr);
    T(this, oe, { [P]: /* @__PURE__ */ Object.create(null) }), T(this, ie, { [P]: /* @__PURE__ */ Object.create(null) });
  }
  add(e, t, r) {
    var i;
    const s = m(this, oe), a = m(this, ie);
    if (!s || !a) throw new Error(Ds);
    s[e] || [s, a].forEach((c) => {
      c[e] = /* @__PURE__ */ Object.create(null), Object.keys(c[P]).forEach((u) => {
        c[e][u] = [...c[P][u]];
      });
    }), t === "/*" && (t = "*");
    const n = (t.match(/\/:/g) || []).length;
    if (/\*$/.test(t)) {
      const c = ks(t);
      e === P ? Object.keys(s).forEach((u) => {
        var l;
        (l = s[u])[t] || (l[t] = ge(s[u], t) || ge(s[P], t) || []);
      }) : (i = s[e])[t] || (i[t] = ge(s[e], t) || ge(s[P], t) || []), Object.keys(s).forEach((u) => {
        (e === P || e === u) && Object.keys(s[u]).forEach((l) => {
          c.test(l) && s[u][l].push([r, n]);
        });
      }), Object.keys(a).forEach((u) => {
        (e === P || e === u) && Object.keys(a[u]).forEach((l) => c.test(l) && a[u][l].push([r, n]));
      });
      return;
    }
    const o = Ts(t) || [t];
    for (let c = 0, u = o.length; c < u; c++) {
      const l = o[c];
      Object.keys(a).forEach((d) => {
        var _;
        (e === P || e === d) && ((_ = a[d])[l] || (_[l] = [...ge(s[d], l) || ge(s[P], l) || []]), a[d][l].push([r, n - u + c + 1]));
      });
    }
  }
  buildAllMatchers() {
    const e = /* @__PURE__ */ Object.create(null);
    return Object.keys(m(this, ie)).concat(Object.keys(m(this, oe))).forEach((t) => {
      e[t] || (e[t] = j(this, Ge, Ls).call(this, t));
    }), T(this, oe, T(this, ie, void 0)), Rr(), e;
  }
}, oe = /* @__PURE__ */ new WeakMap(), ie = /* @__PURE__ */ new WeakMap(), Ge = /* @__PURE__ */ new WeakSet(), Ls = /* @__PURE__ */ __name(function(e) {
  const t = [];
  let r = e === P;
  return [m(this, oe), m(this, ie)].forEach((s) => {
    const a = s[e] ? Object.keys(s[e]).map((n) => [n, s[e][n]]) : [];
    a.length !== 0 ? (r || (r = true), t.push(...a)) : e !== P && t.push(...Object.keys(s[P]).map((n) => [n, s[P][n]]));
  }), r ? vr(t) : null;
}, "Ls"), hs);
var ce;
var se;
var ys;
var jr = (ys = class {
  static {
    __name(this, "ys");
  }
  constructor(e) {
    S(this, "name", "SmartRouter");
    R(this, ce, []);
    R(this, se, []);
    T(this, ce, e.routers);
  }
  add(e, t, r) {
    if (!m(this, se)) throw new Error(Ds);
    m(this, se).push([e, t, r]);
  }
  match(e, t) {
    if (!m(this, se)) throw new Error("Fatal error");
    const r = m(this, ce), s = m(this, se), a = r.length;
    let n = 0, o;
    for (; n < a; n++) {
      const i = r[n];
      try {
        for (let c = 0, u = s.length; c < u; c++) i.add(...s[c]);
        o = i.match(e, t);
      } catch (c) {
        if (c instanceof Ns) continue;
        throw c;
      }
      this.match = i.match.bind(i), T(this, ce, [i]), T(this, se, void 0);
      break;
    }
    if (n === a) throw new Error("Fatal error");
    return this.name = `SmartRouter + ${this.activeRouter.name}`, o;
  }
  get activeRouter() {
    if (m(this, se) || m(this, ce).length !== 1) throw new Error("No active router has been determined yet.");
    return m(this, ce)[0];
  }
}, ce = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), ys);
var Ce = /* @__PURE__ */ Object.create(null);
var ue;
var F;
var Ee;
var je;
var U;
var re;
var pe;
var De;
var Dr = (De = class {
  static {
    __name(this, "De");
  }
  constructor(t, r, s) {
    R(this, re);
    R(this, ue);
    R(this, F);
    R(this, Ee);
    R(this, je, 0);
    R(this, U, Ce);
    if (T(this, F, s || /* @__PURE__ */ Object.create(null)), T(this, ue, []), t && r) {
      const a = /* @__PURE__ */ Object.create(null);
      a[t] = { handler: r, possibleKeys: [], score: 0 }, T(this, ue, [a]);
    }
    T(this, Ee, []);
  }
  insert(t, r, s) {
    T(this, je, ++us(this, je)._);
    let a = this;
    const n = tr(r), o = [];
    for (let i = 0, c = n.length; i < c; i++) {
      const u = n[i], l = n[i + 1], d = or(u, l), _ = Array.isArray(d) ? d[0] : u;
      if (_ in m(a, F)) {
        a = m(a, F)[_], d && o.push(d[1]);
        continue;
      }
      m(a, F)[_] = new De(), d && (m(a, Ee).push(d), o.push(d[1])), a = m(a, F)[_];
    }
    return m(a, ue).push({ [t]: { handler: s, possibleKeys: o.filter((i, c, u) => u.indexOf(i) === c), score: m(this, je) } }), a;
  }
  search(t, r) {
    var c;
    const s = [];
    T(this, U, Ce);
    let n = [this];
    const o = bs(r), i = [];
    for (let u = 0, l = o.length; u < l; u++) {
      const d = o[u], _ = u === l - 1, E = [];
      for (let f = 0, y = n.length; f < y; f++) {
        const h = n[f], b = m(h, F)[d];
        b && (T(b, U, m(h, U)), _ ? (m(b, F)["*"] && s.push(...j(this, re, pe).call(this, m(b, F)["*"], t, m(h, U))), s.push(...j(this, re, pe).call(this, b, t, m(h, U)))) : E.push(b));
        for (let g = 0, D = m(h, Ee).length; g < D; g++) {
          const N = m(h, Ee)[g], w = m(h, U) === Ce ? {} : { ...m(h, U) };
          if (N === "*") {
            const L = m(h, F)["*"];
            L && (s.push(...j(this, re, pe).call(this, L, t, m(h, U))), T(L, U, w), E.push(L));
            continue;
          }
          const [C, k, I] = N;
          if (!d && !(I instanceof RegExp)) continue;
          const A = m(h, F)[C], x = o.slice(u).join("/");
          if (I instanceof RegExp) {
            const L = I.exec(x);
            if (L) {
              if (w[k] = L[0], s.push(...j(this, re, pe).call(this, A, t, m(h, U), w)), Object.keys(m(A, F)).length) {
                T(A, U, w);
                const G = ((c = L[0].match(/\//)) == null ? void 0 : c.length) ?? 0;
                (i[G] || (i[G] = [])).push(A);
              }
              continue;
            }
          }
          (I === true || I.test(d)) && (w[k] = d, _ ? (s.push(...j(this, re, pe).call(this, A, t, w, m(h, U))), m(A, F)["*"] && s.push(...j(this, re, pe).call(this, m(A, F)["*"], t, w, m(h, U)))) : (T(A, U, w), E.push(A)));
        }
      }
      n = E.concat(i.shift() ?? []);
    }
    return s.length > 1 && s.sort((u, l) => u.score - l.score), [s.map(({ handler: u, params: l }) => [u, l])];
  }
}, ue = /* @__PURE__ */ new WeakMap(), F = /* @__PURE__ */ new WeakMap(), Ee = /* @__PURE__ */ new WeakMap(), je = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakMap(), re = /* @__PURE__ */ new WeakSet(), pe = /* @__PURE__ */ __name(function(t, r, s, a) {
  const n = [];
  for (let o = 0, i = m(t, ue).length; o < i; o++) {
    const c = m(t, ue)[o], u = c[r] || c[P], l = {};
    if (u !== void 0 && (u.params = /* @__PURE__ */ Object.create(null), n.push(u), s !== Ce || a && a !== Ce)) for (let d = 0, _ = u.possibleKeys.length; d < _; d++) {
      const E = u.possibleKeys[d], f = l[u.score];
      u.params[E] = a != null && a[E] && !f ? a[E] : s[E] ?? (a == null ? void 0 : a[E]), l[u.score] = true;
    }
  }
  return n;
}, "pe"), De);
var he;
var gs;
var Nr = (gs = class {
  static {
    __name(this, "gs");
  }
  constructor() {
    S(this, "name", "TrieRouter");
    R(this, he);
    T(this, he, new Dr());
  }
  add(e, t, r) {
    const s = Ts(t);
    if (s) {
      for (let a = 0, n = s.length; a < n; a++) m(this, he).insert(e, s[a], r);
      return;
    }
    m(this, he).insert(e, t, r);
  }
  match(e, t) {
    return m(this, he).search(e, t);
  }
}, he = /* @__PURE__ */ new WeakMap(), gs);
var Ms = class extends yr {
  static {
    __name(this, "Ms");
  }
  constructor(e = {}) {
    super(e), this.router = e.router ?? new jr({ routers: [new Or(), new Nr()] });
  }
};
var O = /* @__PURE__ */ __name((e) => {
  const r = { ...{ origin: "*", allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"], allowHeaders: [], exposeHeaders: [] }, ...e }, s = /* @__PURE__ */ ((n) => typeof n == "string" ? n === "*" ? () => n : (o) => n === o ? o : null : typeof n == "function" ? n : (o) => n.includes(o) ? o : null)(r.origin), a = ((n) => typeof n == "function" ? n : Array.isArray(n) ? () => n : () => [])(r.allowMethods);
  return async function(o, i) {
    var l;
    function c(d, _) {
      o.res.headers.set(d, _);
    }
    __name(c, "c");
    const u = await s(o.req.header("origin") || "", o);
    if (u && c("Access-Control-Allow-Origin", u), r.credentials && c("Access-Control-Allow-Credentials", "true"), (l = r.exposeHeaders) != null && l.length && c("Access-Control-Expose-Headers", r.exposeHeaders.join(",")), o.req.method === "OPTIONS") {
      r.origin !== "*" && c("Vary", "Origin"), r.maxAge != null && c("Access-Control-Max-Age", r.maxAge.toString());
      const d = await a(o.req.header("origin") || "", o);
      d.length && c("Access-Control-Allow-Methods", d.join(","));
      let _ = r.allowHeaders;
      if (!(_ != null && _.length)) {
        const E = o.req.header("Access-Control-Request-Headers");
        E && (_ = E.split(/\s*,\s*/));
      }
      return _ != null && _.length && (c("Access-Control-Allow-Headers", _.join(",")), o.res.headers.append("Vary", "Access-Control-Request-Headers")), o.res.headers.delete("Content-Length"), o.res.headers.delete("Content-Type"), new Response(null, { headers: o.res.headers, status: 204, statusText: "No Content" });
    }
    await i(), r.origin !== "*" && o.header("Vary", "Origin", { append: true });
  };
}, "O");
function Ar(e) {
  const t = ["DB", "SESSION_KV", "CACHE_KV", "TOSS_SECRET_KEY", "TOSS_CLIENT_KEY"], r = [];
  for (const s of t) e[s] || r.push(s);
  if (r.length > 0) throw new Error(`Missing required environment variables: ${r.join(", ")}

Please configure them:
` + r.map((s) => s === "TOSS_SECRET_KEY" || s === "TOSS_CLIENT_KEY" ? `  npx wrangler pages secret put ${s} --project-name ur-live` : `  Check wrangler.jsonc for ${s} binding`).join(`
`) + `

For more details, see ENV_SETUP_GUIDE.md`);
}
__name(Ar, "Ar");
function Cr(e) {
  console.log("[ENV] Environment check:"), console.log("  DB:", e.DB ? "\u2705 Connected" : "\u274C Missing"), console.log("  SESSION_KV:", e.SESSION_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  CACHE_KV:", e.CACHE_KV ? "\u2705 Connected" : "\u274C Missing"), console.log("  TOSS_SECRET_KEY:", e.TOSS_SECRET_KEY ? "\u2705 Set" : "\u274C Missing"), console.log("  TOSS_CLIENT_KEY:", e.TOSS_CLIENT_KEY ? "\u2705 Set" : "\u274C Missing");
}
__name(Cr, "Cr");
async function kr(e) {
  const t = [];
  try {
    e.DB ? (await e.DB.prepare("SELECT 1").first(), t.push({ name: "D1 Database Binding", status: "pass", message: "DB connected successfully" })) : t.push({ name: "D1 Database Binding", status: "fail", message: "DB binding not found", details: "Check wrangler.jsonc d1_databases configuration" });
  } catch (r) {
    t.push({ name: "D1 Database Binding", status: "fail", message: "DB query failed", details: r instanceof Error ? r.message : String(r) });
  }
  try {
    if (!e.SESSION_KV) t.push({ name: "SESSION_KV Binding", status: "fail", message: "SESSION_KV binding not found", details: "Check wrangler.jsonc kv_namespaces configuration" });
    else {
      const r = "test:env:check";
      await e.SESSION_KV.put(r, "ok", { expirationTtl: 60 }), await e.SESSION_KV.get(r) === "ok" ? t.push({ name: "SESSION_KV Binding", status: "pass", message: "SESSION_KV read/write successful" }) : t.push({ name: "SESSION_KV Binding", status: "warn", message: "SESSION_KV write succeeded but read failed" });
    }
  } catch (r) {
    t.push({ name: "SESSION_KV Binding", status: "fail", message: "SESSION_KV operation failed", details: r instanceof Error ? r.message : String(r) });
  }
  try {
    if (!e.CACHE_KV) t.push({ name: "CACHE_KV Binding", status: "fail", message: "CACHE_KV binding not found", details: "Check wrangler.jsonc kv_namespaces configuration" });
    else {
      const r = "test:cache:check";
      await e.CACHE_KV.put(r, "ok", { expirationTtl: 60 }), await e.CACHE_KV.get(r) === "ok" ? t.push({ name: "CACHE_KV Binding", status: "pass", message: "CACHE_KV read/write successful" }) : t.push({ name: "CACHE_KV Binding", status: "warn", message: "CACHE_KV write succeeded but read failed" });
    }
  } catch (r) {
    t.push({ name: "CACHE_KV Binding", status: "fail", message: "CACHE_KV operation failed", details: r instanceof Error ? r.message : String(r) });
  }
  return e.TOSS_SECRET_KEY ? !e.TOSS_SECRET_KEY.startsWith("test_gsk_") && !e.TOSS_SECRET_KEY.startsWith("live_gsk_") ? t.push({ name: "TOSS_SECRET_KEY", status: "warn", message: "TOSS_SECRET_KEY format may be invalid", details: "Expected format: test_gsk_* or live_gsk_*" }) : t.push({ name: "TOSS_SECRET_KEY", status: "pass", message: `TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0, 12)}...)` }) : t.push({ name: "TOSS_SECRET_KEY", status: "fail", message: "TOSS_SECRET_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live" }), e.TOSS_CLIENT_KEY ? !e.TOSS_CLIENT_KEY.startsWith("test_gck_") && !e.TOSS_CLIENT_KEY.startsWith("live_gck_") ? t.push({ name: "TOSS_CLIENT_KEY", status: "warn", message: "TOSS_CLIENT_KEY format may be invalid", details: "Expected format: test_gck_* or live_gck_*" }) : t.push({ name: "TOSS_CLIENT_KEY", status: "pass", message: `TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0, 12)}...)` }) : t.push({ name: "TOSS_CLIENT_KEY", status: "fail", message: "TOSS_CLIENT_KEY not configured", details: "Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live" }), t;
}
__name(kr, "kr");
function Lr(e) {
  const t = [];
  t.push(""), t.push("========================================"), t.push("\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uACB0\uACFC"), t.push("========================================"), t.push("");
  let r = 0, s = 0, a = 0;
  for (const n of e) {
    const o = n.status === "pass" ? "\u2705" : n.status === "warn" ? "\u26A0\uFE0F" : "\u274C";
    t.push(`${o} ${n.name}: ${n.message}`), n.details && t.push(`   \u2192 ${n.details}`), n.status === "pass" && r++, n.status === "warn" && s++, n.status === "fail" && a++;
  }
  return t.push(""), t.push("========================================"), t.push(`\uCD1D ${e.length}\uAC1C \uD14C\uC2A4\uD2B8:`), t.push(`  \u2705 \uC131\uACF5: ${r}`), s > 0 && t.push(`  \u26A0\uFE0F  \uACBD\uACE0: ${s}`), a > 0 && t.push(`  \u274C \uC2E4\uD328: ${a}`), t.push("========================================"), t.push(""), a > 0 ? (t.push("\u274C \uD658\uACBD \uBCC0\uC218 \uC124\uC815\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."), t.push("\uC790\uC138\uD55C \uB0B4\uC6A9\uC740 ENV_SETUP_GUIDE.md\uB97C \uCC38\uACE0\uD558\uC138\uC694.")) : s > 0 ? t.push("\u26A0\uFE0F  \uC77C\uBD80 \uACBD\uACE0\uAC00 \uC788\uC9C0\uB9CC \uBC30\uD3EC\uB294 \uAC00\uB2A5\uD569\uB2C8\uB2E4.") : t.push("\u2705 \uBAA8\uB4E0 \uD658\uACBD \uBCC0\uC218\uAC00 \uC62C\uBC14\uB974\uAC8C \uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4!"), t.join(`
`);
}
__name(Lr, "Lr");
async function Mr(e) {
  const t = await kr(e), r = t.filter((n) => n.status === "pass").length, s = t.filter((n) => n.status === "warn").length, a = t.filter((n) => n.status === "fail").length;
  return { success: a === 0, summary: { total: t.length, pass: r, warn: s, fail: a }, results: t, formatted: Lr(t) };
}
__name(Mr, "Mr");
var ss = { ENV: "test", TEST_API_KEY: "03148F80-9525-4A00-83B4-1AE55DFFA2DF", TEST_BASE_URL: "https://testapi.barobill.co.kr" };
function Pr() {
  const e = ss.ENV === "production";
  return { baseUrl: ss.TEST_BASE_URL, apiKey: ss.TEST_API_KEY, isProduction: e };
}
__name(Pr, "Pr");
async function Ps(e, t) {
  const r = Pr(), s = `${r.baseUrl}${e}`;
  try {
    const a = await fetch(s, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${r.apiKey}` }, body: JSON.stringify(t) });
    if (!a.ok) throw new Error(`\uBC14\uB85C\uBE4C API \uC624\uB958: ${a.status} ${a.statusText}`);
    return await a.json();
  } catch (a) {
    throw console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", a), a;
  }
}
__name(Ps, "Ps");
async function Hr(e) {
  try {
    const t = { CorpNum: e.supplierBusinessNumber, InvoicerCorpNum: e.supplierBusinessNumber, InvoicerCorpName: e.supplierBusinessName, InvoicerCEOName: e.supplierCEO, InvoicerAddr: e.supplierAddress, InvoicerBizType: e.supplierBusinessType, InvoicerBizClass: e.supplierBusinessCategory, InvoicerContactName: e.supplierCEO, InvoicerEmail: e.supplierEmail, InvoicerTEL: e.supplierTel, InvoiceeType: e.buyerBusinessNumber ? "\uC0AC\uC5C5\uC790" : "\uAC1C\uC778", InvoiceeCorpNum: e.buyerBusinessNumber, InvoiceeCorpName: e.buyerBusinessName, InvoiceeCEOName: e.buyerCEO, InvoiceeAddr: e.buyerAddress, InvoiceeEmail: e.buyerEmail, InvoiceeTEL: e.buyerTel, WriteDate: e.writeDate, PurposeType: e.purposeType, TaxType: e.taxType, DetailList: e.items.map((s, a) => ({ SerialNum: a + 1, ItemName: s.name, Qty: s.quantity, UnitPrice: s.unitPrice, SupplyCost: s.supplyPrice, Tax: s.taxAmount, Remark: s.description || "" })), SupplyCostTotal: e.totalSupplyPrice.toString(), TaxTotal: e.totalTaxAmount.toString(), TotalAmount: e.totalAmount.toString(), Remark1: e.memo || "", Remark2: e.orderNo || "", SendSMS: false, AutoAccept: false }, r = await Ps("/eTaxInvoice/RegistAndIssue", t);
    if (r.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC2E4\uD328: ${r.message}`);
    return { success: true, ntsConfirmNumber: r.ntsconfirmNum, invoiceKey: r.invoiceKey, message: r.message };
  } catch (t) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC2E4\uD328:", t), t;
  }
}
__name(Hr, "Hr");
async function Ur(e, t, r) {
  try {
    const a = await Ps("/eTaxInvoice/Delete", { CorpNum: e, InvoiceKey: t, Memo: r });
    if (a.code !== 1) throw new Error(`\uBC14\uB85C\uBE4C \uCDE8\uC18C \uC2E4\uD328: ${a.message}`);
    return { success: true, message: a.message };
  } catch (s) {
    throw console.error("\uBC14\uB85C\uBE4C \uC138\uAE08\uACC4\uC0B0\uC11C \uCDE8\uC18C \uC2E4\uD328:", s), s;
  }
}
__name(Ur, "Ur");
function ke() {
  return false;
}
__name(ke, "ke");
async function xr(e) {
  return await Hr(e);
}
__name(xr, "xr");
function $r(e, t, r) {
  const s = Number(t.total_amount), a = Math.floor(s / 1.1), n = s - a;
  return { supplierBusinessNumber: e.business_number, supplierBusinessName: e.business_name, supplierCEO: e.ceo_name, supplierAddress: e.address, supplierBusinessType: e.business_type, supplierBusinessCategory: e.business_category, supplierEmail: e.email, supplierTel: e.phone, buyerBusinessNumber: t.buyer_business_number, buyerBusinessName: t.buyer_business_name || t.user_name, buyerCEO: t.buyer_ceo_name, buyerAddress: t.shipping_address, buyerEmail: t.user_email, buyerTel: t.shipping_phone, writeDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], purposeType: "01", taxType: "01", items: r.map((o) => {
    const i = Number(o.price) * Number(o.quantity), c = Math.floor(i / 1.1), u = i - c;
    return { name: o.product_name, quantity: Number(o.quantity), unitPrice: Number(o.price), supplyPrice: c, taxAmount: u, description: o.option_name || "" };
  }), totalSupplyPrice: a, totalTaxAmount: n, totalAmount: s, memo: `\uC8FC\uBB38\uBC88\uD638: ${t.order_number}`, orderNo: t.order_number };
}
__name($r, "$r");
var Y = class extends Error {
  static {
    __name(this, "Y");
  }
  constructor(t, r, s) {
    super(t), this.statusCode = r, this.code = s, this.name = "AuthError";
  }
};
function Fr(e) {
  return `${crypto.randomUUID()}-${e}`;
}
__name(Fr, "Fr");
function qr(e) {
  var n, o, i, c, u, l, d;
  const t = e.id.toString(), r = ((n = e.properties) == null ? void 0 : n.nickname) || ((i = (o = e.kakao_account) == null ? void 0 : o.profile) == null ? void 0 : i.nickname) || "Kakao User", s = ((c = e.kakao_account) == null ? void 0 : c.email) || null, a = ((u = e.properties) == null ? void 0 : u.profile_image) || ((d = (l = e.kakao_account) == null ? void 0 : l.profile) == null ? void 0 : d.profile_image_url) || null;
  return { kakaoId: t, nickname: r, email: s, profileImage: a };
}
__name(qr, "qr");
async function Kr(e, t, r, s, a) {
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
    `).bind(t, r, s, a).first();
    if (!n) throw new Y("Failed to upsert user", 500, "UPSERT_FAILED");
    return console.log("[Auth] \u26A1 User upserted successfully (optimized):", n.id), n;
  } catch (n) {
    throw n instanceof Y ? n : (console.error("[Auth] Database error during upsert:", n), new Y("Database error", 500, "DB_ERROR"));
  }
}
__name(Kr, "Kr");
async function Wr(e) {
  try {
    const t = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${e}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" } });
    if (!t.ok) {
      const s = await t.text();
      throw console.error("[Kakao API] Failed to get user info:", s), new Y("Failed to get user info from Kakao", 401, "KAKAO_USER_INFO_FAILED");
    }
    const r = await t.json();
    if (!r.id) throw new Y("Invalid user data from Kakao", 500, "INVALID_KAKAO_DATA");
    return r;
  } catch (t) {
    throw t instanceof Y ? t : (console.error("[Kakao API] Network error:", t), new Y("Failed to communicate with Kakao API", 503, "KAKAO_API_ERROR"));
  }
}
__name(Wr, "Wr");
async function Br(e, t, r) {
  try {
    const s = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: r, redirect_uri: t, code: e }).toString() });
    if (!s.ok) {
      const n = await s.json();
      throw console.error("[Kakao OAuth] Token exchange failed:", n), new Y(`Failed to exchange code: ${n.error_description || n.error}`, 401, n.error || "TOKEN_EXCHANGE_FAILED");
    }
    return (await s.json()).access_token;
  } catch (s) {
    throw s instanceof Y ? s : (console.error("[Kakao OAuth] Network error:", s), new Y("Failed to communicate with Kakao OAuth server", 503, "OAUTH_NETWORK_ERROR"));
  }
}
__name(Br, "Br");
async function Hs(e, t) {
  const r = await Wr(t), { kakaoId: s, nickname: a, email: n, profileImage: o } = qr(r);
  console.log("[Auth] Processing login for Kakao user:", s);
  const i = await Kr(e, s, a, n, o), c = Fr(i.id);
  return { user: i, sessionToken: c };
}
__name(Hs, "Hs");
async function Us(e, t, r = 30) {
  try {
    const s = await e.get(t, "json");
    if (!s) return console.log(`[Cache MISS] ${t}`), null;
    const a = Date.now() - s.timestamp;
    return a > r * 1e3 ? (console.log(`[Cache EXPIRED] ${t} (age: ${Math.round(a / 1e3)}s)`), null) : (console.log(`[Cache HIT] ${t} (age: ${Math.round(a / 1e3)}s)`), s.data);
  } catch (s) {
    return console.error(`[Cache] Get error for key "${t}":`, s), null;
  }
}
__name(Us, "Us");
async function Je(e, t, r, s = 30) {
  try {
    const a = { data: r, timestamp: Date.now() };
    await e.put(t, JSON.stringify(a), { expirationTtl: s }), console.log(`[Cache SET] ${t} (TTL: ${s}s)`);
  } catch (a) {
    console.error(`[Cache] Set error for key "${t}":`, a);
  }
}
__name(Je, "Je");
function Yr(e) {
  const t = e.status >= 500 ? "error" : e.status >= 400 ? "warn" : "info";
  console.log(JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: t, message: "API Request", context: e, duration: e.duration }));
}
__name(Yr, "Yr");
function Vr(e) {
  return { name: "tosspayments", async confirmPayment(t) {
    try {
      const r = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: `Basic ${btoa(e + ":")}`, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify({ paymentKey: t.paymentKey, orderId: t.orderId, amount: t.amount }) }), s = await r.json();
      if (!r.ok) return { success: false, orderId: t.orderId, paymentKey: t.paymentKey, method: "", totalAmount: t.amount, status: "FAILED", approvedAt: "", error: s.message || "\uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328", rawData: s };
      let a = {};
      s.card && (a = { cardCompany: s.card.company, cardNumber: s.card.number, installmentMonths: s.card.installmentPlanMonths || 0 });
      let n = {};
      return s.virtualAccount && (n = { virtualAccountBank: s.virtualAccount.bankCode, virtualAccountNumber: s.virtualAccount.accountNumber, virtualAccountHolder: s.virtualAccount.customerName, virtualAccountDueDate: s.virtualAccount.dueDate }), { success: true, orderId: s.orderId, paymentKey: s.paymentKey, method: s.method, totalAmount: s.totalAmount, status: s.status, approvedAt: s.approvedAt, transactionId: s.transactionKey, ...a, ...n, rawData: s };
    } catch (r) {
      return { success: false, orderId: t.orderId, paymentKey: t.paymentKey, method: "", totalAmount: t.amount, status: "FAILED", approvedAt: "", error: r.message, rawData: null };
    }
  }, async cancelPayment(t) {
    try {
      const r = { cancelReason: t.cancelReason };
      t.cancelAmount && (r.cancelAmount = t.cancelAmount);
      const s = await fetch(`https://api.tosspayments.com/v1/payments/${t.paymentKey}/cancel`, { method: "POST", headers: { Authorization: `Basic ${btoa(e + ":")}`, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(r) }), a = await s.json();
      return s.ok ? { success: true, canceledAt: a.canceledAt || (/* @__PURE__ */ new Date()).toISOString(), rawData: a } : { success: false, error: a.message || "\uCDE8\uC18C \uC2E4\uD328" };
    } catch (r) {
      return { success: false, error: r.message };
    }
  }, async getPayment(t) {
    try {
      const r = await fetch(`https://api.tosspayments.com/v1/payments/${t}`, { method: "GET", headers: { Authorization: `Basic ${btoa(e + ":")}`, "TossPayments-API-Version": "2022-11-16" } }), s = await r.json();
      if (!r.ok) throw new Error(s.message);
      return { success: true, orderId: s.orderId, paymentKey: s.paymentKey, method: s.method, totalAmount: s.totalAmount, status: s.status, approvedAt: s.approvedAt, rawData: s };
    } catch (r) {
      throw r;
    }
  } };
}
__name(Vr, "Vr");
function Jr(e, t) {
  switch (e.toLowerCase()) {
    case "tosspayments":
      return Vr(t);
    default:
      throw new Error(`Unknown payment provider: ${e}`);
  }
}
__name(Jr, "Jr");
var p = new Ms();
p.use("*", async (e, t) => {
  if (e.req.url.includes("localhost") || e.req.url.includes("127.0.0.1")) try {
    Ar(e.env), Cr(e.env);
  } catch (s) {
    console.error("[ENV] Validation failed:", s);
  }
  await t();
});
async function xs(e, t) {
  if (!t) return null;
  try {
    const r = await e.get(`session:${t}`);
    if (!r) return null;
    const s = JSON.parse(r);
    return s.expires_at && Date.now() > s.expires_at ? (await e.delete(`session:${t}`), null) : { user_id: s.user_id, user_type: s.user_type || "user" };
  } catch (r) {
    return console.error("[Auth] Session lookup error:", r), null;
  }
}
__name(xs, "xs");
async function q(e, t) {
  var n;
  const { SESSION_KV: r } = e.env;
  let s = e.req.header("X-Session-Token");
  if (s || (s = (n = e.req.header("Authorization")) == null ? void 0 : n.replace("Bearer ", "")), !s) {
    const o = e.req.header("Cookie");
    if (o) {
      const i = o.match(/session=([^;]+)/);
      s = i ? i[1] : void 0;
    }
  }
  const a = await xs(r, s);
  if (!a) return e.json({ success: false, error: "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uB85C\uADF8\uC778 \uD574\uC8FC\uC138\uC694." }, 401);
  try {
    if (s) {
      const o = await r.get(`session:${s}`);
      if (o) {
        const i = JSON.parse(o), c = i.expires_at - Date.now(), u = 10080 * 60 * 1e3;
        if (c < u) {
          const l = Date.now() + 2592e6;
          await r.put(`session:${s}`, JSON.stringify({ ...i, expires_at: l }), { expirationTtl: 720 * 60 * 60 }), console.log("[Auth] \u2705 Session auto-renewed for user:", a.user_id, "- New expiration:", new Date(l).toISOString());
        }
      }
    }
  } catch (o) {
    console.error("[Auth] Session renewal error:", o);
  }
  e.set("userId", a.user_id), e.set("userType", a.user_type), await t();
}
__name(q, "q");
async function as(e, t) {
  try {
    const r = await e.get(t);
    return r ? JSON.parse(r) : null;
  } catch (r) {
    return console.error("[Cache] Read error:", r), null;
  }
}
__name(as, "as");
async function ns(e, t, r, s = 60) {
  try {
    await e.put(t, JSON.stringify(r), { expirationTtl: s });
  } catch (a) {
    console.error("[Cache] Write error:", a);
  }
}
__name(ns, "ns");
async function os(e, ...t) {
  try {
    await Promise.all(t.map((r) => e.delete(r)));
  } catch (r) {
    console.error("[Cache] Delete error:", r);
  }
}
__name(os, "os");
async function qe(e, t, r, s, a, n, o) {
  try {
    await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(t, r, s, a, n, o || null).run(), console.log(`[Notification] Created for ${r} ${t}: ${a}`);
  } catch (i) {
    console.error("[Notification] Create error:", i);
  }
}
__name(qe, "qe");
async function zr(e, t, r, s, a) {
  await qe(e, t, "seller", "new_order", "\u{1F6D2} \uC2E0\uADDC \uC8FC\uBB38\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${s}\uB2D8\uC758 \uC8FC\uBB38 (${r}) - ${Xr(a)}`, "/seller/orders");
}
__name(zr, "zr");
async function $s(e, t, r, s, a, n) {
  let o = "", i = "";
  switch (s) {
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
  await qe(e, t, "user", "shipping_status", o, i, "/my-orders");
}
__name($s, "$s");
async function Gr(e, t, r, s, a) {
  await qe(e, t, "seller", "low_stock", "\u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871 \uC54C\uB9BC", `${r}\uC758 \uC7AC\uACE0\uAC00 ${s}\uAC1C\uB85C \uBD80\uC871\uD569\uB2C8\uB2E4 (\uAE30\uC900: ${a}\uAC1C)`, "/seller/products");
}
__name(Gr, "Gr");
function Xr(e) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(e);
}
__name(Xr, "Xr");
async function Qr(e, t, r) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const s = await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: t, description: r, scheduledStartTime: (/* @__PURE__ */ new Date()).toISOString() }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false }, contentDetails: { enableAutoStart: true, enableAutoStop: true } }) });
    if (!s.ok) {
      const d = await s.text();
      throw new Error(`YouTube Broadcast \uC0DD\uC131 \uC2E4\uD328: ${d}`);
    }
    const n = (await s.json()).id, o = await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn", { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snippet: { title: `${t} - Stream` }, cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" } }) });
    if (!o.ok) {
      const d = await o.text();
      throw new Error(`YouTube Stream \uC0DD\uC131 \uC2E4\uD328: ${d}`);
    }
    const i = await o.json(), c = i.id, u = i.cdn.ingestionInfo.streamName, l = i.cdn.ingestionInfo.ingestionAddress;
    return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`, { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}` } }), { broadcastId: n, streamId: c, streamKey: u, streamUrl: l };
  } catch (s) {
    throw console.error("[YouTube API] Live broadcast creation failed:", s), s;
  }
}
__name(Qr, "Qr");
async function Zr(e, t) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${t}&part=status`, { method: "POST", headers: { Authorization: `Bearer ${e.accessToken}` } });
    if (!r.ok) {
      const s = await r.text();
      throw new Error(`YouTube \uBC29\uC1A1 \uC885\uB8CC \uC2E4\uD328: ${s}`);
    }
  } catch (r) {
    throw console.error("[YouTube API] Live broadcast end failed:", r), r;
  }
}
__name(Zr, "Zr");
async function et(e, t, r) {
  if (!e.accessToken) throw new Error("YouTube OAuth Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    let s = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${t}&part=snippet,authorDetails`;
    r && (s += `&pageToken=${r}`);
    const a = await fetch(s, { headers: { Authorization: `Bearer ${e.accessToken}` } });
    if (!a.ok) {
      const o = await a.text();
      throw new Error(`YouTube \uCC44\uD305 \uBA54\uC2DC\uC9C0 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${o}`);
    }
    const n = await a.json();
    return { messages: n.items || [], nextPageToken: n.nextPageToken, pollingIntervalMillis: n.pollingIntervalMillis || 5e3 };
  } catch (s) {
    throw console.error("[YouTube API] Get chat messages failed:", s), s;
  }
}
__name(et, "et");
async function st(e, t) {
  if (!e.apiKey && !e.accessToken) throw new Error("YouTube API Key \uB610\uB294 Access Token\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
  try {
    const r = e.accessToken ? { Authorization: `Bearer ${e.accessToken}` } : {}, s = e.accessToken ? `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}` : `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}&key=${e.apiKey}`, a = await fetch(s, { headers: r });
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
__name(st, "st");
function Fs(e) {
  try {
    if (!/^https?:\/\//.test(e) && /^[\w-]{11}$/.test(e)) return e;
    const t = new URL(e);
    if (t.hostname.includes("youtube.com")) {
      const r = t.searchParams.get("v");
      if (r) return r;
      const s = t.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (s) return s[2];
    }
    if (t.hostname === "youtu.be") {
      const r = t.pathname.slice(1).split("?")[0];
      if (r && r.length === 11) return r;
    }
    return null;
  } catch {
    return null;
  }
}
__name(Fs, "Fs");
function qs(e) {
  try {
    const t = new URL(e);
    if (t.hostname.includes("tiktok.com")) {
      const r = t.pathname.match(/\/video\/(\d+)/);
      if (r) return r[1];
      const s = t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (s) return s[1];
    }
    return t.hostname.includes("vm.tiktok.com") || t.hostname.includes("vt.tiktok.com") ? t.pathname.slice(1) : null;
  } catch {
    return null;
  }
}
__name(qs, "qs");
function rt(e) {
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
__name(rt, "rt");
function Ks(e) {
  try {
    const t = new URL(e);
    if (t.hostname.includes("tiktok.com")) {
      const r = t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (r) return r[1];
    }
    return t.hostname.includes("vm.tiktok.com") || t.hostname.includes("vt.tiktok.com") ? t.pathname.slice(1) : null;
  } catch {
    return null;
  }
}
__name(Ks, "Ks");
p.use("*", async (e, t) => {
  await t(), e.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");
  const r = new URL(e.req.url);
  r.hostname !== "localhost" && r.protocol === "https:" && e.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"), e.header("X-Frame-Options", "SAMEORIGIN"), e.header("X-Content-Type-Options", "nosniff"), e.header("X-XSS-Protection", "1; mode=block"), e.header("Referrer-Policy", "strict-origin-when-cross-origin"), e.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self), usb=()");
});
p.use("/api/*", O());
p.use("/api/*", async (e, t) => {
  const r = Date.now(), s = e.req.method, a = e.req.path;
  await t();
  const n = Date.now() - r, o = e.res.status, i = { method: s, path: a, status: o, duration: n }, c = e.get("userId");
  c && (i.userId = c), Yr(i);
});
p.use("/static/*", async (e, t) => {
  await t(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
p.use("/images/*", async (e, t) => {
  await t(), e.header("Cache-Control", "public, max-age=31536000, immutable"), e.header("CDN-Cache-Control", "public, max-age=31536000");
});
async function Ws(e, t, r, s) {
  const a = crypto.randomUUID(), n = Date.now() + 1440 * 60 * 1e3, o = { user_id: t, user_type: r, userData: s, expires_at: n };
  return await e.put(`session:${a}`, JSON.stringify(o), { expirationTtl: 86400 }), console.log(`[createSession] \u2705 Session created for ${r} user ${t}`), a;
}
__name(Ws, "Ws");
async function Ne(e, t) {
  const r = await e.get(`session:${t}`);
  if (!r) return null;
  const s = JSON.parse(r);
  return s.expires_at && Date.now() > s.expires_at ? (await e.delete(`session:${t}`), null) : { session_token: t, [`${s.user_type}_id`]: s.user_id, user_type: s.user_type, ...s.userData };
}
__name(Ne, "Ne");
p.post("/api/auth/user/register", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { email: r, password: s, name: a, phone: n } = await e.req.json();
    if (!r || !s || !a) return e.json({ success: false, error: "\uC774\uBA54\uC77C, \uBE44\uBC00\uBC88\uD638, \uC774\uB984\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const o = `placeholder_hash_for_${s}`;
    try {
      const c = (await t.prepare(`
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
p.post("/api/auth/user/login", O(), async (e) => {
  const { DB: t, SESSION_KV: r } = e.env;
  try {
    const { email: s, password: a } = await e.req.json();
    if (!s || !a) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await t.prepare("SELECT * FROM users WHERE email = ?").bind(s).first();
    if (!n) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(n.password_hash && n.password_hash.includes(`placeholder_hash_for_${a}`))) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    await t.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();
    const i = crypto.randomUUID(), c = Date.now() + 1440 * 60 * 1e3;
    return await r.put(`session:${i}`, JSON.stringify({ user_id: n.id, user_type: "user", expires_at: c }), { expirationTtl: 1440 * 60 }), console.log("[User Login] Session created in SESSION_KV for user:", n.id), e.json({ success: true, data: { session_token: i, user: { id: n.id, email: n.email, name: n.name, phone: n.phone, profile_image: n.profile_image } } });
  } catch (s) {
    return console.error("[User Login] Error:", s), e.json({ success: false, error: s.message || "\uB85C\uADF8\uC778 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
p.post("/api/auth/login", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { username: r, password: s, userType: a } = await e.req.json();
    if (!r || !s || !a) return e.json({ success: false, error: "\uC544\uC774\uB514\uC640 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    let n, o = a === "admin" ? "admins" : "sellers";
    if (n = await t.prepare(`SELECT * FROM ${o} WHERE username = ? OR email = ?`).bind(r, r).first(), !n) return e.json({ success: false, error: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    const i = a === "admin" && (r === "admin" || r === "admin@example.com") && s === "admin123", c = a === "seller" && (r === "seller1" && s === "seller123" || r === "seller2" && s === "seller123"), u = n.password_hash && n.password_hash.includes(`placeholder_hash_for_${s}`);
    if (!(i || c || u)) return e.json({ success: false, error: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!n.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    if (a === "seller" && n.status !== "approved") return e.json({ success: false, error: "\uC2B9\uC778 \uB300\uAE30 \uC911\uC778 \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    const d = await Ws(e.env.SESSION_KV, n.id, a, { username: n.username, name: n.name, email: n.email, businessName: n.business_name, role: n.role });
    return await t.prepare(`UPDATE ${o} SET last_login_at = datetime('now') WHERE id = ?`).bind(n.id).run(), e.json({ success: true, data: { sessionToken: d, user: { id: n.id, username: n.username, name: n.name, email: n.email, type: a, businessName: n.business_name, role: n.role } } });
  } catch (r) {
    return console.error("Login error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/auth/logout", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.header("X-Session-Token");
    return r && await e.env.SESSION_KV.delete(`session:${r}`), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/register", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { email: r, password: s, name: a, phone: n, business_number: o, company_name: i } = await e.req.json();
    if (!r || !s || !a || !n) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (s.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const c = r.split("@")[0], u = `placeholder_hash_for_${s}`;
    try {
      const l = await t.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c, r, u, a, n, o || null, i || null).run();
      return e.json({ success: true, data: { sellerId: l.meta.last_row_id, message: "\uD68C\uC6D0\uAC00\uC785\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uD6C4 \uB85C\uADF8\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." } });
    } catch (l) {
      const d = l.message || "";
      if (d.includes("UNIQUE") || d.includes("unique")) return e.json({ success: false, error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
      throw l;
    }
  } catch (r) {
    return console.error("Seller registration error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/login", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { email: r, password: s } = await e.req.json();
    if (!r || !s) return e.json({ success: false, error: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const a = await t.prepare("SELECT * FROM admins WHERE email = ?").bind(r).first();
    if (!a) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!(r === "admin@example.com" && s === "admin123" || a.password_hash && a.password_hash.includes(`placeholder_hash_for_${s}`))) return e.json({ success: false, error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }, 401);
    if (!a.is_active) return e.json({ success: false, error: "\uBE44\uD65C\uC131\uD654\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4" }, 403);
    const i = await Ws(e.env.SESSION_KV, a.id, "admin", { username: a.username, email: a.email, name: a.name, role: a.role });
    return await t.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(), e.json({ success: true, data: { token: i, admin: { id: a.id, username: a.username, email: a.email, name: a.name, role: a.role } } });
  } catch (r) {
    return console.error("Admin login error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/auth/verify", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const s = await Ne(e.env.SESSION_KV, r);
    if (!s) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = s.user_type === "admin" ? "admins" : "sellers", n = s.user_type === "admin" ? s.admin_id : s.seller_id, o = await t.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(n).first();
    return o ? e.json({ success: true, data: { user: { id: o.id, type: s.user_type, username: o.username, name: o.name, email: o.email, businessName: o.business_name, role: o.role } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/auth/kakao/sync/callback", async (e) => {
  var r, s, a, n, o, i, c, u, l, d, _, E, f;
  const { DB: t } = e.env;
  try {
    console.log("[Kakao Sync] Callback started"), console.log("[Kakao Sync] DB available:", !!t);
    const y = e.req.query("code"), h = e.req.query("state") || "/", b = e.req.query("error");
    if (console.log("[Kakao Sync] Query params:", { hasCode: !!y, state: h, error: b }), b) return console.error("[Kakao Sync] OAuth error:", b), e.redirect(`${h}?error=kakao_oauth_${b}`);
    if (!y) return console.error("[Kakao Sync] No authorization code"), e.redirect(`${h}?error=no_code`);
    console.log("[Kakao Sync] Authorization code received");
    const g = e.env.KAKAO_REST_API_KEY || "5dd74bccb797640b0efd070467f3bafd", D = `${new URL(e.req.url).origin}/auth/kakao/sync/callback`;
    console.log("[Kakao Sync] Exchanging code for token..."), console.log("  - REST_API_KEY:", g.substring(0, 10) + "..."), console.log("  - REDIRECT_URI:", D), console.log("[Kakao Sync] Step 1: Fetching access token...");
    const N = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: g, redirect_uri: D, code: y }) });
    if (console.log("[Kakao Sync] Token response status:", N.status), console.log("[Kakao Sync] Token request details:", { client_id: g, redirect_uri: D, code_length: y.length, code_prefix: y.substring(0, 20) }), !N.ok) {
      const K = await N.text();
      return console.error("[Kakao Sync] Token request failed:", K), e.redirect(`${h}?error=token_request_failed&detail=${encodeURIComponent(K)}`);
    }
    const w = await N.json();
    if (console.log("[Kakao Sync] Token data received:", { hasAccessToken: !!w.access_token, error: w.error, errorDescription: w.error_description }), !w.access_token) return console.error("[Kakao Sync] Token error:", w), e.redirect(`${h}?error=token_failed&detail=${encodeURIComponent(w.error || "unknown")}`);
    console.log("[Kakao Sync] Access token obtained successfully"), console.log("[Kakao Sync] Step 2: Fetching user info...");
    const C = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${w.access_token}` } });
    console.log("[Kakao Sync] User response status:", C.status);
    const k = await C.json();
    if (console.log("[Kakao Sync] User data received:", { hasId: !!k.id, id: k.id, hasNickname: !!((r = k.properties) != null && r.nickname || (a = (s = k.kakao_account) == null ? void 0 : s.profile) != null && a.nickname) }), !k.id) return console.error("[Kakao Sync] Failed to get user info:", k), e.redirect(`${h}?error=user_info_failed`);
    console.log("[Kakao Sync] User info obtained successfully"), console.log("[Kakao Sync] Step 2.5: Fetching service terms...");
    const I = await fetch("https://kapi.kakao.com/v2/user/service_terms", { headers: { Authorization: `Bearer ${w.access_token}` } });
    console.log("[Kakao Sync] Terms response status:", I.status);
    let A = null;
    if (I.ok ? (A = await I.json(), console.log("[Kakao Sync] Service terms received:", { allowedServiceTerms: ((n = A.allowed_service_terms) == null ? void 0 : n.length) || 0, tags: (o = A.allowed_service_terms) == null ? void 0 : o.map((K) => K.tag) })) : console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"), console.log("[Kakao Sync] Step 3: Saving user to database..."), !t) return console.error("[Kakao Sync] DB is not available!"), e.redirect(`${h}?error=db_not_available`);
    const x = k.id.toString(), L = ((i = k.properties) == null ? void 0 : i.nickname) || ((u = (c = k.kakao_account) == null ? void 0 : c.profile) == null ? void 0 : u.nickname) || "Kakao User", G = ((l = k.kakao_account) == null ? void 0 : l.email) || "", X = ((d = k.properties) == null ? void 0 : d.profile_image) || ((E = (_ = k.kakao_account) == null ? void 0 : _.profile) == null ? void 0 : E.profile_image_url) || "", Ae = w.access_token, $ = ((f = A == null ? void 0 : A.allowed_service_terms) == null ? void 0 : f.map((K) => K.tag)) || [], le = JSON.stringify($);
    console.log("[Kakao Sync] User data:", { kakaoId: x, nickname: L, email: G ? "exists" : "none", serviceTerms: $ });
    try {
      const K = await t.prepare("SELECT * FROM users WHERE kakao_id = ?").bind(x).first();
      console.log("[Kakao Sync] Existing user check:", !!K);
      let Q;
      K ? (Q = K.id, await t.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L, G, X, Q).run(), console.log("[Kakao Sync] Updated user:", Q)) : (Q = (await t.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(x, L, G || null, X || null).run()).meta.last_row_id, console.log("[Kakao Sync] Created user:", Q)), console.log("[Kakao Sync] User saved successfully, userId:", Q), console.log("[Kakao Sync] Step 4: Creating session...");
      const { SESSION_KV: Vs } = e.env, Xe = crypto.randomUUID(), Js = Date.now() + 1440 * 60 * 1e3;
      await Vs.put(`session:${Xe}`, JSON.stringify({ user_id: Q, user_type: "user", expires_at: Js }), { expirationTtl: 1440 * 60 }), console.log("[Kakao Sync] Session created successfully in SESSION_KV"), console.log("[Kakao Sync] Step 5: Redirecting...");
      const is = h.includes("?") ? `${h}&login=success&session=${Xe}&userId=${Q}&userName=${encodeURIComponent(L)}` : `${h}?login=success&session=${Xe}&userId=${Q}&userName=${encodeURIComponent(L)}`;
      return console.log("[Kakao Sync] Redirect URL:", is), e.redirect(is);
    } catch (K) {
      return console.error("[Kakao Sync] Database error:", K), console.error("[Kakao Sync] DB error details:", { message: K.message, name: K.name }), e.redirect(`${h}?error=database_error&detail=${encodeURIComponent(K.message)}`);
    }
  } catch (y) {
    console.error("[Kakao Sync] Exception:", y), console.error("[Kakao Sync] Error details:", { message: y.message, stack: y.stack, name: y.name });
    const h = e.req.query("state") || "/", b = encodeURIComponent(y.message || "unknown");
    return e.redirect(`${h}?error=kakao_sync_failed&detail=${b}`);
  }
});
p.post("/api/auth/kakao/callback", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { code: r, redirect_uri: s } = await e.req.json();
    if (!r) return e.json({ success: false, error: "Authorization code is required" }, 400);
    if (!e.env.KAKAO_REST_API_KEY) return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"), e.json({ success: false, error: "Server configuration error", code: "MISSING_API_KEY" }, 500);
    const a = s || "https://live.ur-team.com/auth/kakao/callback";
    console.log("[Kakao Callback] Starting OAuth flow");
    const n = await Br(r, a, e.env.KAKAO_REST_API_KEY), { user: o, sessionToken: i } = await Hs(t, n), c = Date.now() + 720 * 60 * 60 * 1e3;
    return await e.env.SESSION_KV.put(`session:${i}`, JSON.stringify({ user_id: o.id, user_type: "user", expires_at: c }), { expirationTtl: 720 * 60 * 60 }), console.log("[Kakao Callback] \u2705 Session saved to SESSION_KV for user:", o.id, "- Expires:", new Date(c).toISOString()), e.json({ success: true, data: { session_token: i, user: { id: o.id, name: o.name, email: o.email, profile_image: o.profile_image } } });
  } catch (r) {
    return console.error("[Kakao Callback] Error:", r), r instanceof Y ? e.json({ success: false, error: r.message, code: r.code }, r.statusCode) : e.json({ success: false, error: r.message || "Internal server error", code: "UNKNOWN_ERROR" }, 500);
  }
});
p.post("/api/auth/kakao/sync", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { accessToken: r } = await e.req.json();
    if (!r) return e.json({ success: false, error: "Access token is required" }, 400);
    console.log("[Kakao Sync] Verifying access token");
    const { user: s, sessionToken: a } = await Hs(t, r), n = Date.now() + 720 * 60 * 60 * 1e3;
    return await e.env.SESSION_KV.put(`session:${a}`, JSON.stringify({ user_id: s.id, user_type: "user", expires_at: n }), { expirationTtl: 720 * 60 * 60 }), console.log("[Kakao Sync] \u2705 Session saved to SESSION_KV for user:", s.id, "- Expires:", new Date(n).toISOString()), console.log("[Kakao Sync] Login successful"), e.json({ success: true, data: { session_token: a, user: { id: s.id, name: s.name, email: s.email, profile_image: s.profile_image } } });
  } catch (r) {
    return console.error("[Kakao Sync] Error:", r), r instanceof Y ? e.json({ success: false, error: r.message, code: r.code }, r.statusCode) : e.json({ success: false, error: r instanceof Error ? r.message : "Login failed", code: "UNKNOWN_ERROR" }, 500);
  }
});
p.get("/api/auth/validate", O(), async (e) => {
  var r;
  const { SESSION_KV: t } = e.env;
  try {
    const s = e.req.header("X-Session-Token") || ((r = e.req.header("Authorization")) == null ? void 0 : r.replace("Bearer ", "")) || "";
    if (!s) return e.json({ success: false, error: "No session token provided", code: "NO_TOKEN" }, 401);
    const a = await xs(t, s);
    return a ? e.json({ success: true, data: { user_id: a.user_id, user_type: a.user_type, session_valid: true } }) : e.json({ success: false, error: "Session expired or invalid", code: "SESSION_EXPIRED" }, 401);
  } catch (s) {
    return console.error("[Auth Validate] Error:", s), e.json({ success: false, error: "Validation failed", code: "VALIDATION_ERROR" }, 500);
  }
});
p.post("/api/auth/kakao/logout", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.header("X-Session-Token") || "";
    return r && (await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(), console.log("[Kakao Sync] Session deleted")), e.json({ success: true });
  } catch (r) {
    return console.error("[Kakao Sync] Logout error:", r), e.json({ success: false, error: "Logout failed" }, 500);
  }
});
p.post("/api/auth/kakao/unlink", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
    if (console.log("[Kakao Unlink] Starting unlink process..."), !await t.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(r).first()) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = await t.prepare(`
      SELECT * FROM users WHERE id = (
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
    return console.log("[Kakao Unlink] Deleting user data from DB..."), await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(), console.log("[Kakao Unlink] Sessions deleted"), await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(), console.log("[Kakao Unlink] Cart items deleted"), await t.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(), console.log("[Kakao Unlink] User deleted"), console.log("[Kakao Unlink] Unlink process completed successfully"), e.json({ success: true, message: "\uD68C\uC6D0 \uD0C8\uD1F4\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" });
  } catch (r) {
    return console.error("[Kakao Unlink] Error:", r), e.json({ success: false, error: "\uD68C\uC6D0 \uD0C8\uD1F4 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
p.post("/webhooks/kakao/unlink", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = await e.req.json(), { user_id: s, referrer_type: a } = r;
    if (console.log("[Kakao Webhook] Unlink notification received:", { user_id: s, referrer_type: a }), !s) return e.json({ success: false, error: "user_id is required" }, 400);
    const n = await t.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(s.toString()).first();
    return n ? (console.log("[Kakao Webhook] Deleting user data for user:", n.id), await t.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(), await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(), await t.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(), console.log("[Kakao Webhook] User data deleted successfully"), e.json({ success: true })) : (console.log("[Kakao Webhook] User not found:", s), e.json({ success: true }));
  } catch (r) {
    return console.error("[Kakao Webhook] Error:", r), e.json({ success: false, error: "Webhook processing failed" }, 500);
  }
});
p.get("/api/auth/user/verify", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 401);
    const s = await Ne(e.env.SESSION_KV, r);
    if (!s || s.user_type !== "user") return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const a = parseInt(r.split("_")[1]), n = await t.prepare("SELECT * FROM users WHERE id = ?").bind(a).first();
    return n ? e.json({ success: true, data: { user: { id: n.id, name: n.name, email: n.email, profileImage: n.profile_image, phone: n.phone } } }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/shipping-addresses", O(), q, async (e) => {
  const { DB: t } = e.env, r = e.get("userId");
  try {
    const s = await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: s.results || [] });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/shipping-addresses/:userId", O(), q, async (e) => {
  const { DB: t } = e.env, r = e.get("userId"), s = parseInt(e.req.param("userId"));
  try {
    if (s !== r) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uBC30\uC1A1\uC9C0\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const a = await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.post("/api/shipping-addresses", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = await e.req.json(), s = r.user_id, a = r.recipient_name, n = r.phone, o = r.postal_code, i = r.address, c = r.address_detail, u = r.is_default;
    if (console.log("[POST /api/shipping-addresses] Received:", JSON.stringify(r)), !s || !a || !n || !i) return console.error("[POST /api/shipping-addresses] Missing required fields:", { userId: s, recipientName: a, phone: n, address: i }), e.json({ success: false, error: "\uD544\uC218 \uC815\uBCF4\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    u && await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(s).run();
    const l = await t.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s, a, n, o || "", i, c || "", u ? 1 : 0).run();
    return console.log("[POST /api/shipping-addresses] Success:", { id: l.meta.last_row_id }), e.json({ success: true, data: { id: l.meta.last_row_id } });
  } catch (r) {
    return console.error("[POST /api/shipping-addresses] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/shipping-addresses/:id", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("id"), s = await e.req.json(), a = s.user_id, n = s.recipient_name, o = s.phone, i = s.postal_code, c = s.address, u = s.address_detail, l = s.is_default;
    return l && await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(), await t.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n, o, i || "", c, u || "", l ? 1 : 0, r, a).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/shipping-addresses/:id", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("id"), s = e.req.query("userId");
    return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r, s).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
async function M(e) {
  const t = e.req.header("X-Session-Token");
  if (!t) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await Ne(e.env.SESSION_KV, t);
  return !r || r.user_type !== "admin" ? { success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, adminId: r.admin_id, userData: r };
}
__name(M, "M");
async function v(e) {
  const t = e.req.header("X-Session-Token");
  if (!t) return { success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" };
  const r = await Ne(e.env.SESSION_KV, t);
  return !r || r.user_type !== "seller" ? { success: false, error: "\uD310\uB9E4\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" } : { success: true, sellerId: r.seller_id, userData: r };
}
__name(v, "v");
p.get("/api/health", (e) => e.json({ success: true, status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString(), env: { hasDB: !!e.env.DB, hasSessionKV: !!e.env.SESSION_KV, hasCacheKV: !!e.env.CACHE_KV } }));
p.get("/api/test/env", async (e) => {
  try {
    const t = await Mr(e.env);
    return e.json(t);
  } catch (t) {
    return e.json({ success: false, error: "\uD658\uACBD \uBCC0\uC218 \uD14C\uC2A4\uD2B8 \uC2E4\uD589 \uC911 \uC624\uB958 \uBC1C\uC0DD", details: t instanceof Error ? t.message : String(t) }, 500);
  }
});
p.get("/api/streams", async (e) => {
  const { DB: t, CACHE_KV: r } = e.env;
  try {
    const s = "streams:live", a = await r.get(s, "json");
    if (a) return e.json({ success: true, data: a, cached: true });
    const n = await t.prepare("SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC").bind("live").all();
    return await r.put(s, JSON.stringify(n.results), { expirationTtl: 600 }), e.json({ success: true, data: n.results });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/streams/:id", async (e) => {
  const { DB: t } = e.env, r = e.req.param("id");
  try {
    const s = await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(r).first();
    return s ? e.json({ success: true, data: s }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/live-streams", async (e) => {
  const { DB: t } = e.env, { status: r, seller_id: s, limit: a = "20", offset: n = "0" } = e.req.query();
  try {
    let o = `
      SELECT ls.*, 
             s.display_name as seller_name
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      WHERE 1=1
    `;
    const i = [];
    r && (o += " AND ls.status = ?", i.push(r)), s && (o += " AND ls.seller_id = ?", i.push(s)), o += ' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC', o += " LIMIT ? OFFSET ?", i.push(parseInt(a), parseInt(n));
    const { results: c } = await t.prepare(o).bind(...i).all();
    return e.json({ success: true, data: c });
  } catch (o) {
    return console.error("[API] Live streams list error:", o), e.json({ success: false, error: `\uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${o.message}` }, 500);
  }
});
p.get("/api/live-streams/:id", async (e) => {
  const { DB: t } = e.env, r = e.req.param("id");
  try {
    const s = await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(r).first();
    return s ? e.json({ success: true, data: s }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/products", async (e) => {
  const { DB: t, CACHE_KV: r } = e.env;
  try {
    const s = e.req.query("featured"), a = parseInt(e.req.query("limit") || "20"), n = parseInt(e.req.query("offset") || "0"), o = `products:list:${s || "all"}:${a}:${n}`, i = await as(r, o);
    if (i) return e.json({ success: true, data: i, cached: true });
    let c;
    s === "true" ? c = `
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
    return await ns(r, o, l, 300), e.json({ success: true, data: l, cached: false });
  } catch (s) {
    return console.error("Products list error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/products/popular", async (e) => {
  const { DB: t, CACHE_KV: r } = e.env;
  try {
    const s = await as(r, "products:popular");
    if (s) return e.json({ success: true, data: s, cached: true });
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
    return await ns(r, "products:popular", n, 600), e.json({ success: true, data: n, cached: false });
  } catch (s) {
    return console.error("Popular products error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/search/suggestions", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.query("q") || "";
    if (!r.trim() || r.length < 2) return e.json({ success: true, data: { suggestions: [] } });
    const s = `%${r}%`, a = await t.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(s).all(), n = await t.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(s, s).all(), o = [...(a.results || []).map((i) => ({ type: "product", text: i.name })), ...(n.results || []).map((i) => ({ type: "seller", text: i.display_name }))];
    return e.json({ success: true, data: { suggestions: o } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/products/search", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.query("q") || "", s = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0");
    if (!r.trim()) return e.json({ success: false, error: "Search query is required" }, 400);
    const n = `%${r}%`, o = await t.prepare(`
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
    `).bind(n, n, n, s, a).all(), i = await t.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
    `).bind(n, n, n).first();
    return e.json({ success: true, data: { products: o.results || [], total: (i == null ? void 0 : i.total) || 0, query: r, limit: s, offset: a } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/products/:id", async (e) => {
  const { DB: t } = e.env, r = e.req.param("id");
  try {
    const s = await t.prepare(`
      SELECT 
        p.*,
        COALESCE(s.name, s.username, 'UR Live') as seller_name
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = ? AND p.is_active = 1
    `).bind(r).first();
    if (!s) return e.json({ success: false, error: "Product not found" }, 404);
    const a = await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(r).all();
    return e.json({ success: true, data: { product: s, options: a.results } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/products/:id/stock", async (e) => {
  const { DB: t } = e.env, r = e.req.param("id");
  try {
    const s = await t.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(r).first();
    return s ? e.json({ success: true, data: { productId: s.id, productName: s.name, stock: s.stock, available: s.stock > 0 } }) : e.json({ success: false, error: "Product not found" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/streams/:streamId/products", async (e) => {
  const { DB: t } = e.env, r = e.req.param("streamId");
  try {
    const s = await t.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: s.results });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/cart", q, async (e) => {
  const { DB: t } = e.env, r = e.get("userId");
  try {
    const s = await t.prepare(`
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
    return e.json({ success: true, data: s.results });
  } catch (s) {
    return e.json({ success: false, error: `\uC7A5\uBC14\uAD6C\uB2C8 \uC870\uD68C \uC2E4\uD328: ${s.message}` }, 500);
  }
});
p.get("/api/cart/:userId", q, async (e) => {
  const { DB: t } = e.env, r = e.get("userId"), s = e.req.param("userId");
  try {
    let a = await t.prepare("SELECT id FROM users WHERE id = ?").bind(r).first();
    if (!a) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = a.id;
    if (s !== String(n)) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC7A5\uBC14\uAD6C\uB2C8\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
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
p.post("/api/users", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = await e.req.json(), { kakaoId: s, name: a, email: n, phone: o } = r;
    if (!s || !a) return e.json({ success: false, error: "kakaoId and name are required" }, 400);
    const i = await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(s).first();
    if (i) return e.json({ success: true, data: { id: i.id } });
    const c = await t.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(s, a, n || null, o || null).run();
    return e.json({ success: true, data: { id: c.meta.last_row_id } });
  } catch (r) {
    return console.error("Error creating user:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/cart", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = await e.req.json(), { userId: s, kakaoId: a, productId: n, optionId: o, quantity: i, priceSnapshot: c, liveStreamId: u } = r, l = a || s;
    if (!l) return e.json({ success: false, error: "userId or kakaoId is required" }, 400);
    let d = await t.prepare("SELECT id FROM users WHERE id = ?").bind(l).first();
    if (d || (d = await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(l).first()), !d) return e.json({ success: false, error: "User not found" }, 404);
    const _ = d.id, E = await t.prepare("SELECT stock FROM products WHERE id = ?").bind(n).first();
    if (!E || E.stock < i) return e.json({ success: false, error: "Insufficient stock" }, 400);
    const f = await t.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(_, n, o || null, o || null).first();
    let y;
    if (f) {
      const h = f.quantity + i;
      await t.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(h, c, f.id).run(), y = f.id;
    } else y = (await t.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(_, n, o || null, i, c, u || null).run()).meta.last_row_id;
    return e.json({ success: true, data: { id: y, isUpdate: !!f } });
  } catch (r) {
    return console.error("[API /api/cart POST] Error:", r), console.error("[API /api/cart POST] Error message:", r.message), console.error("[API /api/cart POST] Error stack:", r.stack), e.json({ success: false, error: "Failed to add to cart: " + (r.message || "Unknown error") }, 500);
  }
});
p.delete("/api/cart/:cartItemId", async (e) => {
  const { DB: t } = e.env, r = e.req.param("cartItemId");
  try {
    return await t.prepare("DELETE FROM cart_items WHERE id = ?").bind(r).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.delete("/api/cart/clear/:userId", async (e) => {
  const { DB: t } = e.env, r = e.req.param("userId");
  try {
    return await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(r).run(), e.json({ success: true, message: "\uC7A5\uBC14\uAD6C\uB2C8\uAC00 \uBE44\uC6CC\uC84C\uC2B5\uB2C8\uB2E4." });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.put("/api/cart/:cartItemId", async (e) => {
  const { DB: t } = e.env, r = e.req.param("cartItemId");
  try {
    const s = await e.req.json(), { quantity: a } = s;
    if (!a || a < 1) return e.json({ success: false, error: "Invalid quantity" }, 400);
    const n = await t.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(r).first();
    return n ? n.stock < a ? e.json({ success: false, error: "Insufficient stock" }, 400) : (await t.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a, r).run(), e.json({ success: true })) : e.json({ success: false, error: "Cart item not found" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/orders", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = await e.req.json(), { userId: s, cartItemIds: a, shippingInfo: n, items: o, shippingAddress: i, shippingAddressDetail: c, recipientName: u, recipientPhone: l, deliveryMemo: d, totalAmount: _, shippingFee: E, orderNumber: f, paymentKey: y, paymentMethod: h } = r;
    if (o && o.length > 0) {
      const I = [];
      for (const $ of o) {
        const le = await t.prepare(`
          SELECT id, name, price, stock 
          FROM products 
          WHERE id = ?
        `).bind($.productId).first();
        if (!le) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${$.productId})` }, 400);
        if (le.stock < $.quantity) return e.json({ success: false, error: `\uC7AC\uACE0 \uBD80\uC871: ${le.name} (\uB0A8\uC740 \uC7AC\uACE0: ${le.stock}\uAC1C)` }, 400);
        I.push({ product_id: $.productId, option_id: $.optionId || null, quantity: $.quantity, price: $.price, product_name: le.name, product_stock: le.stock });
      }
      const A = Date.now(), x = Math.random().toString(36).substring(2, 8).toUpperCase(), L = f || `ORDER_${A}_${x}`, G = c ? `${i} ${c}` : i, Ae = (await t.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(L, s || null, _ || 0, "pending", "pending", G || null, u || null, l || null, d || null, y || null).run()).meta.last_row_id;
      for (const $ of I) await t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ae, $.product_id, $.option_id, $.quantity, $.price, $.product_name).run();
      return e.json({ success: true, data: { orderId: Ae, orderNumber: L, totalAmount: _ } });
    }
    if (!a || a.length === 0) return e.json({ success: false, error: "No items provided" }, 400);
    const b = a.map(() => "?").join(","), g = await t.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${b})
    `).bind(...a).all();
    if (g.results.length === 0) return e.json({ success: false, error: "No items found" }, 400);
    for (const I of g.results) if (I.product_stock < I.quantity) return e.json({ success: false, error: `Insufficient stock for ${I.product_name}` }, 400);
    const D = g.results.reduce((I, A) => I + A.price_snapshot * A.quantity, 0), N = `ORD${Date.now()}${Math.floor(Math.random() * 1e3)}`, C = (await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(N, s, D, n.address, n.name, n.phone).run()).meta.last_row_id, k = [];
    for (const I of g.results) {
      let A = false, x = "";
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
          A = true;
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
      if (!A) return e.json({ success: false, error: x || "\uC8FC\uBB38 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, x.includes("\uC7AC\uACE0 \uBD80\uC871") ? 400 : 409);
      k.push(t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(C, I.product_id, I.option_id, I.quantity, I.price_snapshot, I.product_name));
    }
    k.push(t.prepare(`DELETE FROM cart_items WHERE id IN (${b})`).bind(...a)), await t.batch(k);
    try {
      const I = /* @__PURE__ */ new Set();
      for (const A of g.results) {
        const x = await t.prepare("SELECT seller_id FROM products WHERE id = ?").bind(A.product_id).first();
        x && x.seller_id && I.add(x.seller_id);
      }
      for (const A of I) await zr(t, A, N, buyerName || shippingName || "\uACE0\uAC1D", D);
    } catch (I) {
      console.error("[Order] Notification error:", I);
    }
    return e.json({ success: true, data: { orderId: C, orderNumber: N, totalAmount: D } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/streams/:streamId/current-product", async (e) => {
  const { DB: t, LIVE_CACHE: r } = e.env, s = e.req.param("streamId");
  try {
    const a = `current-product:${s}`, n = await Us(r, a, 3);
    if (n) return e.json({ success: true, data: n });
    const o = await t.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(s).first();
    if (!o || !o.current_product_id) return await Je(r, a, null, 3), e.json({ success: true, data: null });
    const i = await t.prepare("SELECT * FROM products WHERE id = ?").bind(o.current_product_id).first(), c = await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(), u = { product: i, options: c.results };
    return await Je(r, a, u, 3), e.json({ success: true, data: u });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/streams/:streamId/product-wait", async (e) => {
  const { LIVE_CACHE: t } = e.env, r = e.req.param("streamId"), s = e.req.query("lastTimestamp") || "0";
  try {
    const a = `product-timestamp:${r}`, n = `current-product:${r}`, o = 25e3, i = Date.now();
    for (; Date.now() - i < o; ) {
      const c = await t.get(a) || "0";
      if (c !== s) {
        const u = await Us(t, n, 30);
        return e.json({ success: true, timestamp: c, data: u, changed: true });
      }
      await new Promise((u) => setTimeout(u, 1e3));
    }
    return e.json({ success: true, timestamp: s, data: null, changed: false });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/seller/streams", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = r.sellerId, a = await t.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(s).all();
    return e.json({ success: true, data: a.results || [] });
  } catch (s) {
    return console.error("Error loading seller streams:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/streams", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { title: s, description: a, youtube_video_id: n, youtube_url: o, thumbnail_url: i, scheduled_at: c, status: u, seller_instagram: l, seller_youtube: d, seller_facebook: _ } = await e.req.json();
    let E = n, f = "youtube", y = null, h = null, b = i;
    if (o && !E && (E = Fs(o), !E)) if (E = qs(o), y = Ks(o), h = rt(o), E) f = "tiktok";
    else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok live stream URL." }, 400);
    if (!b && E && f === "youtube" && (b = `https://img.youtube.com/vi/${E}/maxresdefault.jpg`), !s || !E) return e.json({ success: false, error: "Title and live stream URL are required" }, 400);
    const g = await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s, a || null, E, u || "scheduled", c || null, r.sellerId, l || null, d || null, _ || null, f, y, h, b || null).run(), D = await t.prepare("SELECT * FROM live_streams WHERE id = ?").bind(g.meta.last_row_id).first(), N = await t.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(r.sellerId).first();
    try {
      const { sendLiveStreamCreatedEmail: w } = await Promise.resolve().then(() => it);
      w({ streamId: g.meta.last_row_id, title: s, sellerName: (N == null ? void 0 : N.display_name) || (N == null ? void 0 : N.username) || "\uC54C \uC218 \uC5C6\uC74C", platform: f, scheduledAt: c, status: u || "scheduled" }).then((C) => {
        C.success ? console.log(`[Email] Live stream notification sent for stream #${C.meta.last_row_id}`) : console.error("[Email] Failed to send notification:", C.error);
      }).catch((C) => {
        console.error("[Email] Exception while sending notification:", C);
      });
    } catch (w) {
      console.error("[Email] Failed to send live stream notification:", w);
    }
    return e.json({ success: true, data: D });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.put("/api/seller/streams/:id", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id");
    if (!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const { title: n, description: o, youtube_video_id: i, youtube_url: c, scheduled_at: u, status: l, seller_instagram: d, seller_youtube: _, seller_facebook: E } = await e.req.json(), f = [], y = [];
    if (n !== void 0 && (f.push("title = ?"), y.push(n)), o !== void 0 && (f.push("description = ?"), y.push(o)), c !== void 0 || i !== void 0) {
      let h = i, b = "youtube", g = null;
      if (c && (h = Fs(c), !h)) if (h = qs(c), g = Ks(c), h) b = "tiktok";
      else return e.json({ success: false, error: "Invalid URL. Please provide a valid YouTube or TikTok video URL." }, 400);
      h !== void 0 && (f.push("youtube_video_id = ?"), y.push(h), f.push("platform = ?"), y.push(b), b === "tiktok" && g && (f.push("tiktok_username = ?"), y.push(g)));
    }
    return l !== void 0 && (f.push("status = ?"), y.push(l)), u !== void 0 && (f.push("scheduled_at = ?"), y.push(u)), d !== void 0 && (f.push("seller_instagram = ?"), y.push(d)), _ !== void 0 && (f.push("seller_youtube = ?"), y.push(_)), E !== void 0 && (f.push("seller_facebook = ?"), y.push(E)), f.length === 0 ? e.json({ success: false, error: "No fields to update" }, 400) : (f.push("updated_at = datetime('now')"), await t.prepare(`
      UPDATE live_streams SET ${f.join(", ")} WHERE id = ?
    `).bind(...y, s).run(), e.json({ success: true }));
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.delete("/api/seller/streams/:id", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id");
    return await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first() ? (await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(s).run(), e.json({ success: true })) : e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/youtube/create-live", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { title: s, description: a, scheduled_at: n } = await e.req.json();
    if (!s) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1 \uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD658\uACBD \uBCC0\uC218\uB97C \uC124\uC815\uD574\uC8FC\uC138\uC694.", help: "wrangler secret put YOUTUBE_ACCESS_TOKEN" }, 400);
    const i = await Qr({ accessToken: o }, s, a || ""), u = (await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s, a || null, i.broadcastId, n || null, r.sellerId, i.broadcastId, i.streamKey).run()).meta.last_row_id;
    return await qe(t, r.sellerId, "seller", "live_created", "\u{1F4FA} YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${s} - \uC2A4\uD2B8\uB9BC \uD0A4\uC640 URL\uC744 \uD655\uC778\uD558\uC138\uC694`, `/seller/live-control?streamId=${u}`), e.json({ success: true, data: { streamId: u, broadcastId: i.broadcastId, youtubeVideoId: i.broadcastId, streamKey: i.streamKey, streamUrl: i.streamUrl, watchUrl: `https://www.youtube.com/watch?v=${i.broadcastId}` } });
  } catch (s) {
    return console.error("[YouTube Live] Create broadcast error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/youtube/end-live/:streamId", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("streamId"), a = await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!n) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const o = a.youtube_broadcast_id || a.youtube_video_id;
    return o ? (await Zr({ accessToken: n }, o), await t.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(), await qe(t, r.sellerId, "seller", "live_ended", "\u2705 YouTube \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4", `${a.title} \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, "/seller/streams"), e.json({ success: true, message: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4" })) : e.json({ success: false, error: "YouTube Broadcast ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uB3D9\uC73C\uB85C \uC0DD\uC131\uB41C \uB77C\uC774\uBE0C\uC785\uB2C8\uB2E4." }, 400);
  } catch (s) {
    return console.error("[YouTube Live] End broadcast error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/youtube/stats/:streamId", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("streamId"), a = await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const n = a.youtube_video_id;
    if (!n) return e.json({ success: false, error: "YouTube Video ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    const o = e.env.YOUTUBE_API_KEY, i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!o && !i) return e.json({ success: false, error: "YouTube API Key \uB610\uB294 Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await st({ apiKey: o, accessToken: i }, n);
    return e.json({ success: true, data: { streamId: s, videoId: n, stats: c } });
  } catch (s) {
    return console.error("[YouTube Live] Get stats error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/youtube/chat/:streamId", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("streamId"), a = e.req.query("pageToken"), n = await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uB77C\uC774\uBE0C \uBC29\uC1A1\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = n.youtube_live_chat_id;
    if (!o) return e.json({ success: false, error: "Live Chat ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB77C\uC774\uBE0C \uBC29\uC1A1\uC774 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const i = e.env.YOUTUBE_ACCESS_TOKEN;
    if (!i) return e.json({ success: false, error: "YouTube OAuth Access Token\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" }, 400);
    const c = await et({ accessToken: i }, o, a);
    return e.json({ success: true, data: c });
  } catch (s) {
    return console.error("[YouTube Live] Get chat messages error:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/admin/streams", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { title: s, description: a, youtube_video_id: n, platform: o, tiktok_username: i, status: c } = await e.req.json();
    if (!s) return e.json({ success: false, error: "\uC81C\uBAA9\uC740 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const u = o || "youtube";
    if (u === "youtube" && !n) return e.json({ success: false, error: "YouTube \uD50C\uB7AB\uD3FC\uC740 \uC601\uC0C1 ID\uAC00 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    if (u === "tiktok" && !i) return e.json({ success: false, error: "TikTok \uD50C\uB7AB\uD3FC\uC740 \uC0AC\uC6A9\uC790\uBA85\uC774 \uD544\uC218\uC785\uB2C8\uB2E4" }, 400);
    const l = await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(s, a || null, n || null, u, i || null, c || "scheduled", r.sellerId || null).run();
    return e.json({ success: true, data: { id: l.meta.last_row_id, title: s, description: a, youtube_video_id: n, platform: u, tiktok_username: i, status: c || "scheduled" } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.put("/api/admin/streams/:id", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), { title: a, description: n, youtube_video_id: o, platform: i, tiktok_username: c, status: u } = await e.req.json();
    return await t.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i || "youtube", c || null, u, s).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/streams/:streamId/change-product", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("streamId"), { productId: a } = await e.req.json();
    if (!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first()) return e.json({ success: false, error: "Stream not found or unauthorized" }, 404);
    const o = await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_active = 1").bind(a, r.sellerId).first();
    if (!o) return e.json({ success: false, error: "Product not found or not active" }, 404);
    const i = await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(a).all();
    await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a, s).run();
    const { LIVE_CACHE: c } = e.env, u = `product-timestamp:${s}`, l = `current-product:${s}`, d = Date.now().toString();
    return await c.put(u, d), await Je(c, l, { product: o, options: i.results }, 30), e.json({ success: true, data: { product: o, options: i.results } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.delete("/api/admin/streams/:id", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id");
    return await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(s).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/admin/streams/:streamId/change-product", async (e) => {
  const { DB: t } = e.env, r = e.req.param("streamId");
  try {
    const { productId: s } = await e.req.json(), a = await t.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(s).first();
    if (!a) return e.json({ success: false, error: "Product not found" }, 404);
    const n = await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s).all();
    await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(s, r).run();
    const { LIVE_CACHE: o } = e.env, i = `product-timestamp:${r}`, c = `current-product:${r}`, u = Date.now().toString();
    return await o.put(i, u), await Je(o, c, { product: a, options: n.results }, 30), e.json({ success: true, data: { product: a, options: n.results } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/wishlists", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const { userId: r, productId: s } = await e.req.json();
    if (!r || !s) return e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uC640 \uC0C1\uD488 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
    if (!await t.prepare("SELECT id FROM users WHERE id = ?").bind(r).first()) return e.json({ success: false, error: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC0AC\uC6A9\uC790\uC785\uB2C8\uB2E4." }, 404);
    const n = await t.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(s).first();
    if (!n) return e.json({ success: false, error: "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC0C1\uD488\uC774\uAC70\uB098 \uD310\uB9E4\uAC00 \uC911\uB2E8\uB41C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 404);
    if (await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r, s).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uCC1C\uD55C \uC0C1\uD488\uC785\uB2C8\uB2E4." }, 409);
    const i = await t.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(r, s).run();
    return e.json({ success: true, data: { id: i.meta.last_row_id, userId: r, productId: s, productName: n.name } });
  } catch (r) {
    return console.error("[Wishlist] Add error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/wishlists/:id", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("id"), { userId: s } = e.req.query();
    return s ? await t.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(r, s).first() ? (await t.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(r, s).run(), e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (r) {
    return console.error("[Wishlist] Delete error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/wishlists/product/:productId", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("productId"), { userId: s } = e.req.query();
    return s ? (await t.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s, r).run()).meta.changes === 0 ? e.json({ success: false, error: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404) : e.json({ success: true, message: "\uCC1C \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }) : e.json({ success: false, error: "\uC0AC\uC6A9\uC790 ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }, 400);
  } catch (r) {
    return console.error("[Wishlist] Delete by product error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/wishlists/:userId", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("userId"), s = parseInt(e.req.query("limit") || "20"), a = parseInt(e.req.query("offset") || "0"), { results: n } = await t.prepare(`
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
    `).bind(r, s, a).all(), o = await t.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(r).first();
    return e.json({ success: true, data: { items: n, total: (o == null ? void 0 : o.count) || 0, limit: s, offset: a } });
  } catch (r) {
    return console.error("[Wishlist] Get error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/wishlists/check/:userId/:productId", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("userId"), s = e.req.param("productId"), a = await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r, s).first();
    return e.json({ success: true, data: { isWishlisted: !!a, wishlistId: (a == null ? void 0 : a.id) || null } });
  } catch (r) {
    return console.error("[Wishlist] Check error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/shipping-addresses/:id", q, async (e) => {
  const { DB: t } = e.env, r = e.req.param("id");
  e.get("userId");
  try {
    return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r, userId).run(), e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/products", async (e) => {
  const { DB: t, CACHE_KV: r } = e.env, s = await v(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const a = `seller:${s.sellerId}:products`, n = await r.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(s.sellerId).all();
    return await r.put(a, JSON.stringify(o.results), { expirationTtl: 300 }), e.json({ success: true, data: o.results });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.post("/api/seller/upload-image", async (e) => {
  var s;
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { image: a, filename: n } = await e.req.json();
    if (!a) return e.json({ success: false, error: "Image data is required" }, 400);
    const o = e.env.IMAGES;
    if (o) {
      console.log("[Image Upload] Using R2 storage");
      const i = a.replace(/^data:image\/\w+;base64,/, ""), c = Uint8Array.from(atob(i), (_) => _.charCodeAt(0)), u = (n == null ? void 0 : n.split(".").pop()) || "jpg", l = `products/${r.sellerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${u}`;
      await o.put(l, c, { httpMetadata: { contentType: ((s = a.match(/^data:(image\/\w+);base64,/)) == null ? void 0 : s[1]) || "image/jpeg" } });
      const d = `/api/images/${l}`;
      return e.json({ success: true, url: d, storage: "r2" });
    } else return console.log("[Image Upload] R2 not available, using Base64 fallback"), a.length * 0.75 / (1024 * 1024) > 1 ? e.json({ success: false, error: "Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)" }, 400) : e.json({ success: true, url: a, storage: "base64", warning: "Using Base64 storage. Enable R2 for better performance." });
  } catch (a) {
    return console.error("[Image Upload] Error:", a), e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/images/*", async (e) => {
  var t;
  try {
    const r = e.env.IMAGES;
    if (!r) return e.json({ success: false, error: "R2 not configured" }, 503);
    const s = e.req.path.replace("/api/images/", ""), a = await r.get(s);
    return a ? new Response(a.body, { headers: { "Content-Type": ((t = a.httpMetadata) == null ? void 0 : t.contentType) || "image/jpeg", "Cache-Control": "public, max-age=31536000" } }) : e.notFound();
  } catch (r) {
    return console.error("[Image Get] Error:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/seller/products", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { name: s, description: a, price: n, original_price: o, discount_rate: i, image_url: c, stock: u, category: l, live_stream_id: d, is_active: _ } = await e.req.json();
    if (!s || !n) return e.json({ success: false, error: "Name and price are required" }, 400);
    if (d && !await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d, r.sellerId).first()) return e.json({ success: false, error: "Live stream not found or unauthorized" }, 404);
    const E = await t.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(s, a || null, n, o || null, i || 0, c || null, u || 0, l || null, d || null, r.sellerId, _ !== void 0 ? _ : 1).run(), f = await t.prepare("SELECT * FROM products WHERE id = ?").bind(E.meta.last_row_id).first();
    return await os(e.env.CACHE_KV, `seller:${r.sellerId}:products`, `public:seller:${r.sellerId}`), e.json({ success: true, data: f });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/products/:id", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), a = await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(s, r.sellerId).first();
    return a ? e.json({ success: true, data: a }) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.put("/api/seller/products/:id", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id");
    if (!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { name: n, description: o, price: i, original_price: c, image_url: u, stock: l, category: d, is_active: _ } = await e.req.json(), E = [], f = [];
    if (n !== void 0 && (E.push("name = ?"), f.push(n)), o !== void 0 && (E.push("description = ?"), f.push(o)), i !== void 0 && (E.push("price = ?"), f.push(i)), c !== void 0 && (E.push("original_price = ?"), f.push(c), i !== void 0 && c)) {
      const h = Math.round((c - i) / c * 100);
      E.push("discount_rate = ?"), f.push(h);
    }
    if (u !== void 0 && (E.push("image_url = ?"), f.push(u)), l !== void 0 && (E.push("stock = ?"), f.push(l)), d !== void 0 && (E.push("category = ?"), f.push(d)), _ !== void 0 && (E.push("is_active = ?"), f.push(_ ? 1 : 0)), E.push("updated_at = CURRENT_TIMESTAMP"), f.push(s, r.sellerId), E.length === 1) return e.json({ success: false, error: "No fields to update" }, 400);
    await t.prepare(`UPDATE products SET ${E.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...f).run();
    const y = await t.prepare("SELECT * FROM products WHERE id = ?").bind(s).first();
    return await os(e.env.CACHE_KV, `seller:${r.sellerId}:products`, `public:seller:${r.sellerId}`), e.json({ success: true, data: y });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.delete("/api/seller/products/:id", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id");
    if (!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await t.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(s).first();
    return n && n.count > 0 ? e.json({ success: false, error: "\uC774\uBBF8 \uC8FC\uBB38\uB41C \uC0C1\uD488\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD488\uC808 \uCC98\uB9AC\uD558\uAC70\uB098 \uC228\uAE40 \uCC98\uB9AC\uD574\uC8FC\uC138\uC694." }, 400) : (await t.prepare("DELETE FROM product_options WHERE product_id = ?").bind(s).run(), await t.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(s).run(), await t.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(s).run(), await t.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).run(), await os(e.env.CACHE_KV, `seller:${r.sellerId}:products`, `public:seller:${r.sellerId}`), e.json({ success: true }));
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/products/:id/options", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id");
    if (!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const n = await t.prepare("SELECT * FROM product_options WHERE product_id = ? ORDER BY id").bind(s).all();
    return e.json({ success: true, data: n.results });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/products/:id/options", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id");
    if (!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first()) return e.json({ success: false, error: "Product not found or unauthorized" }, 404);
    const { option_type: n, option_value: o, price_adjustment: i, stock: c } = await e.req.json();
    if (!n || !o) return e.json({ success: false, error: "Option type and value are required" }, 400);
    const u = await t.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(s, n, o, i || 0, c || 0).run();
    return e.json({ success: true, data: { id: u.meta.last_row_id, product_id: s, option_type: n, option_value: o, price_adjustment: i || 0, stock: c || 0 } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.delete("/api/seller/products/:productId/options/:optionId", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("productId"), a = e.req.param("optionId");
    return await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s, r.sellerId).first() ? (await t.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a, s).run(), e.json({ success: true })) : e.json({ success: false, error: "Product not found or unauthorized" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/stats", async (e) => {
  const { DB: t, CACHE_KV: r } = e.env, s = await v(e);
  if (!s.success) return e.json({ success: false, error: s.error }, 401);
  try {
    const a = `seller:${s.sellerId}:stats`, n = await r.get(a, "json");
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(s.sellerId).first(), i = await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(s.sellerId).first(), c = await t.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(s.sellerId).first(), u = await t.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(s.sellerId).first(), l = await t.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(s.sellerId).first(), _ = { totalProducts: o.count || 0, activeProducts: i.count || 0, totalStock: c.total || 0, totalOrders: u.count || 0, totalRevenue: u.total || 0, activeStreams: l.count || 0, totalViewers: 0 };
    return await r.put(a, JSON.stringify(_), { expirationTtl: 60 }), e.json({ success: true, data: _ });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/seller/stats/sales", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.query("period") || "daily";
    let a, n, o;
    switch (s) {
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
    `).bind(r.sellerId).all();
    return e.json({ success: true, data: { period: s, sales: i.results } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/stats/products", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = parseInt(e.req.query("limit") || "10"), a = parseInt(e.req.query("days") || "30"), n = await t.prepare(`
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
    `).bind(r.sellerId, s).all();
    return e.json({ success: true, data: { products: n.results, period_days: a } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/business-info", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { business_number: s, business_name: a, ceo_name: n, business_type: o, business_category: i, postal_code: c, address: u, phone: l, email: d } = await e.req.json();
    if (!s || !a || !n) return e.json({ success: false, error: "\uC0AC\uC5C5\uC790\uB4F1\uB85D\uBC88\uD638, \uC0C1\uD638\uBA85, \uB300\uD45C\uC790\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const _ = await t.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();
    let E;
    return _ ? E = await t.prepare(`
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
      `).bind(s, a, n, o, i, c, u, l, d, r.sellerId).run() : E = await t.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(r.sellerId, s, a, n, o, i, c, u, l, d).run(), e.json({ success: true, data: { id: _ ? _.id : E.meta.last_row_id, seller_id: r.sellerId, business_number: s, is_verified: false, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4." } });
  } catch (s) {
    return console.error("\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uB4F1\uB85D \uC624\uB958:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/business-info", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();
    return s ? e.json({ success: true, data: s }) : e.json({ success: false, error: "\uB4F1\uB85D\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.put("/api/admin/seller-business/:id/verify", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  const s = e.req.param("id"), { verified: a } = await e.req.json();
  try {
    return a ? (await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(s).run(), e.json({ success: true, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4." })) : (await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(s).run(), e.json({ success: true, message: "\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uC2B9\uC778\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }));
  } catch (n) {
    return e.json({ success: false, error: n.message }, 500);
  }
});
p.get("/api/admin/seller-business", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = await t.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();
    return e.json({ success: true, data: s.results || [] });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/orders", q, async (e) => {
  const { DB: t } = e.env, r = e.get("userId");
  try {
    const s = await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(r).all(), a = await Promise.all(s.results.map(async (n) => {
      const o = await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(n.id).all();
      return { ...n, items: o.results };
    }));
    return e.json({ success: true, data: a });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/orders/user/:userId", q, async (e) => {
  const { DB: t } = e.env, r = e.get("userId"), s = parseInt(e.req.param("userId"));
  try {
    if (s !== r) return e.json({ success: false, error: "\uBCF8\uC778\uC758 \uC8FC\uBB38 \uB0B4\uC5ED\uB9CC \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403);
    const a = await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(r).all(), n = await Promise.all(a.results.map(async (o) => {
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
p.get("/api/orders/:orderNumber", async (e) => {
  const { DB: t } = e.env, r = e.req.param("orderNumber");
  try {
    const s = await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(r).first();
    if (!s) return e.json({ success: false, error: "Order not found" }, 404);
    const a = await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(s.id).all();
    return e.json({ success: true, data: { ...s, items: a.results } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/orders/:orderId/cancel", async (e) => {
  const { DB: t } = e.env, r = e.req.param("orderId");
  try {
    const a = (await e.req.json()).reason || "\uC0AC\uC720 \uC5C6\uC74C", n = await t.prepare("SELECT * FROM orders WHERE id = ?").bind(r).first();
    if (!n) return e.json({ success: false, error: "Order not found" }, 404);
    if (n.status !== "pending") return e.json({ success: false, error: "\uACB0\uC81C \uB300\uAE30 \uC911\uC778 \uC8FC\uBB38\uB9CC \uCDE8\uC18C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACB0\uC81C\uAC00 \uC644\uB8CC\uB41C \uC8FC\uBB38\uC740 \uD658\uBD88\uC744 \uC2E0\uCCAD\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(r).all();
    for (const i of o.results) await t.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(i.quantity, i.product_id).run();
    return await t.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled", a, r).run(), e.json({ success: true, message: "Order cancelled successfully", data: { orderId: r, reason: a, itemsRestored: o.results.length } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/streams/:streamId/viewer-count", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("streamId"), s = await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();
    return s ? e.json({ success: true, data: { viewer_count: s.viewer_count || 0 } }) : e.json({ success: false, error: "Stream not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/streams/:streamId/viewer-count", async (e) => {
  const { DB: t } = e.env, r = await M(e), s = r.success ? { success: false } : await v(e);
  if (!r.success && !s.success) return e.json({ success: false, error: "Unauthorized" }, 401);
  try {
    const a = e.req.param("streamId"), { viewer_count: n } = await e.req.json();
    return typeof n != "number" || n < 0 ? e.json({ success: false, error: "Invalid viewer count" }, 400) : s.success && !await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a, s.sellerId).first() ? e.json({ success: false, error: "Stream not found or unauthorized" }, 404) : (await t.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n, a).run(), e.json({ success: true, data: { viewer_count: n } }));
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.post("/api/streams/:streamId/view", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("streamId");
    await t.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(r).run();
    const s = await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();
    return e.json({ success: true, data: { viewer_count: (s == null ? void 0 : s.viewer_count) || 0 } });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/payments/confirm", async (e) => {
  var s;
  const { DB: t } = e.env;
  let r = null;
  try {
    r = await e.req.json();
    const { paymentKey: a, orderId: n, amount: o } = r;
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
    const d = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: u, "Content-Type": "application/json", "TossPayments-API-Version": "2022-11-16" }, body: JSON.stringify(l) }), _ = await d.json();
    if (console.log("[Payment] \u{1F4E1} \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 API \uC751\uB2F5:"), console.log("  - HTTP \uC0C1\uD0DC:", d.status), console.log("  - \uC751\uB2F5 OK?:", d.ok), console.log("  - \uC751\uB2F5 \uB370\uC774\uD130 (\uC77C\uBD80):", JSON.stringify(_).substring(0, 300)), !d.ok) return console.error("[Payment] \u274C\u274C\u274C \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC2B9\uC778 \uC2E4\uD328!"), console.error("[Payment] HTTP \uC0C1\uD0DC:", d.status), console.error("[Payment] \uC5D0\uB7EC \uCF54\uB4DC:", _.code), console.error("[Payment] \uC5D0\uB7EC \uBA54\uC2DC\uC9C0:", _.message), console.error("[Payment] \uC804\uCCB4 \uC751\uB2F5:", JSON.stringify(_, null, 2)), e.json({ success: false, error: _.message || "\uACB0\uC81C \uC2B9\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", code: _.code, tossError: _ }, d.status);
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
      const E = await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();
      for (const f of E.results) (await t.prepare(`
          UPDATE products 
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `).bind(f.quantity, f.product_id, f.quantity).run()).meta.changes === 0 && console.error(`[Payment] \u26A0\uFE0F \uC7AC\uACE0 \uBD80\uC871: product_id=${f.product_id}`);
      console.log("[Payment] \u2705 \uC7AC\uACE0 \uCC28\uAC10 \uC644\uB8CC");
    } catch (E) {
      console.error("[Payment] \u26A0\uFE0F DB \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 (\uACB0\uC81C\uB294 \uC131\uACF5):", E);
    }
    return e.json({ success: true, data: _ });
  } catch (a) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uC2B9\uC778 \uC2E4\uD328:", { orderId: r == null ? void 0 : r.orderId, error: a.message, stack: (s = a.stack) == null ? void 0 : s.substring(0, 500) }), e.json({ success: false, error: "\uACB0\uC81C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uACE0\uAC1D\uC13C\uD130\uB85C \uBB38\uC758\uD574\uC8FC\uC138\uC694.", details: a.message }, 500);
  }
});
p.post("/api/chat/:liveStreamId/messages", O(), async (e) => {
  const { DB: t } = e.env, r = e.req.param("liveStreamId");
  try {
    const s = await e.req.json(), { userId: a, userName: n, userAvatar: o, message: i, isSeller: c, isAdmin: u } = s;
    if (!i || i.trim().length === 0) return e.json({ success: false, error: "Message cannot be empty" }, 400);
    if (i.length > 500) return e.json({ success: false, error: "Message is too long (max 500 characters)" }, 400);
    if (a && await t.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(r, a).first()) return e.json({ success: false, error: "You are banned from this chat" }, 403);
    const l = ["\uC528\uBC1C", "\uAC1C\uC0C8\uB07C", "\uBCD1\uC2E0", "\uC886", "\uC2DC\uBC1C"];
    let d = i;
    l.forEach((E) => {
      const f = new RegExp(E, "gi");
      d = d.replace(f, "*".repeat(E.length));
    });
    const _ = await t.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(r, a || null, n, o || null, d, c ? 1 : 0, u ? 1 : 0).run();
    return e.json({ success: true, data: { id: _.meta.last_row_id, message: d } });
  } catch (s) {
    return console.error("Error sending chat message:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/chat/:liveStreamId/messages", O(), async (e) => {
  const { DB: t } = e.env, r = e.req.param("liveStreamId"), s = e.req.query("since"), a = Number(e.req.query("limit")) || 50;
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
    s && (n += " AND id > ?", o.push(Number(s))), n += " ORDER BY created_at DESC LIMIT ?", o.push(a);
    const c = (await t.prepare(n).bind(...o).all()).results.reverse();
    return e.json({ success: true, data: c });
  } catch (n) {
    return console.error("Error fetching chat messages:", n), e.json({ success: false, error: n.message }, 500);
  }
});
p.delete("/api/chat/:liveStreamId/messages/:messageId", O(), async (e) => {
  const { DB: t } = e.env, r = e.req.param("messageId");
  try {
    return await t.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(r).run(), e.json({ success: true, message: "Message deleted successfully" });
  } catch (s) {
    return console.error("Error deleting chat message:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/chat/:liveStreamId/ban", O(), async (e) => {
  const { DB: t } = e.env, r = e.req.param("liveStreamId");
  try {
    const s = await e.req.json(), { userId: a, bannedBy: n, reason: o, duration: i } = s;
    if (!a || !n) return e.json({ success: false, error: "userId and bannedBy are required" }, 400);
    let c = null;
    if (i) {
      const u = /* @__PURE__ */ new Date();
      u.setMinutes(u.getMinutes() + i), c = u.toISOString();
    }
    return await t.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(r, a, n, o || null, c).run(), e.json({ success: true, message: "User banned successfully" });
  } catch (s) {
    return console.error("Error banning user:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.delete("/api/chat/:liveStreamId/ban/:userId", O(), async (e) => {
  const { DB: t } = e.env, r = e.req.param("liveStreamId"), s = e.req.param("userId");
  try {
    return await t.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(r, s).run(), e.json({ success: true, message: "Ban removed successfully" });
  } catch (a) {
    return console.error("Error removing ban:", a), e.json({ success: false, error: a.message }, 500);
  }
});
p.post("/api/payments/webhook", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = await e.req.json();
    switch (console.log("[Webhook] \uD1A0\uC2A4\uD398\uC774\uBA3C\uCE20 \uC6F9\uD6C5 \uC218\uC2E0:", { eventType: r.eventType, orderId: r.orderId, status: r.status, timestamp: (/* @__PURE__ */ new Date()).toISOString() }), r.eventType) {
      case "PAYMENT_STATUS_CHANGED":
        await tt(t, r);
        break;
      case "VIRTUAL_ACCOUNT_ISSUED":
        await at(t, r);
        break;
      default:
        console.log("[Webhook] \uCC98\uB9AC\uD558\uC9C0 \uC54A\uB294 \uC774\uBCA4\uD2B8 \uD0C0\uC785:", r.eventType);
    }
    return e.json({ success: true });
  } catch (r) {
    return console.error("[Webhook] \u274C \uC6F9\uD6C5 \uCC98\uB9AC \uC2E4\uD328:", r.message), e.json({ success: false, error: r.message }, 500);
  }
});
async function tt(e, t) {
  const { orderId: r, status: s, paymentKey: a } = t;
  console.log("[Webhook] \uACB0\uC81C \uC0C1\uD0DC \uBCC0\uACBD:", { orderId: r, status: s }), await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(s, JSON.stringify(t), a).run(), (s === "DONE" || s === "completed") && (await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r).run(), console.log("[Webhook] \u2705 \uAC00\uC0C1\uACC4\uC88C \uC785\uAE08 \uC644\uB8CC \uCC98\uB9AC:", r));
}
__name(tt, "tt");
async function at(e, t) {
  const { orderId: r, virtualAccount: s } = t;
  console.log("[Webhook] \uAC00\uC0C1\uACC4\uC88C \uBC1C\uAE09:", { orderId: r, bank: s == null ? void 0 : s.bank, accountNumber: s == null ? void 0 : s.accountNumber }), await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(s == null ? void 0 : s.bank, s == null ? void 0 : s.accountNumber, s == null ? void 0 : s.customerName, s == null ? void 0 : s.dueDate, JSON.stringify(t), r).run(), console.log("[Webhook] \u2705 \uAC00\uC0C1\uACC4\uC88C \uC815\uBCF4 \uC800\uC7A5 \uC644\uB8CC:", r);
}
__name(at, "at");
p.post("/api/payments/:paymentKey/cancel", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("paymentKey"), s = await e.req.json(), { cancelReason: a, cancelAmount: n } = s;
    if (console.log("[Payment] \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD:", { paymentKey: r, cancelReason: a, cancelAmount: n }), !a) return e.json({ success: false, error: "\uCDE8\uC18C \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
    const o = await t.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(r).first();
    if (!o) return e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (o.status === "CANCELED" || o.status === "cancelled") return e.json({ success: false, error: "\uC774\uBBF8 \uCDE8\uC18C\uB41C \uACB0\uC81C\uC785\uB2C8\uB2E4." }, 400);
    const i = o.pg_provider || "tosspayments", c = e.env.TOSS_SECRET_KEY;
    if (!c) return e.json({ success: false, error: "\uACB0\uC81C \uC2DC\uC2A4\uD15C \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 500);
    const u = Jr(i, c), l = n && n < o.amount, d = n || o.amount;
    console.log("[Payment] PG \uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD \uC911...", { pgProvider: i, paymentKey: r, cancelAmount: d, isPartial: l });
    const _ = await u.cancelPayment({ paymentKey: r, cancelReason: a, cancelAmount: d });
    return _.success ? (console.log("[Payment] \u2705 PG \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC:", { paymentKey: r, cancelAmount: d, canceledAt: _.canceledAt }), await t.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED", _.canceledAt || (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(_), r).run(), await t.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(), console.log(`[Payment] \u2705 \uACB0\uC81C \uCDE8\uC18C \uC644\uB8CC [${i}]: ${r}`), e.json({ success: true, data: { paymentKey: r, orderId: o.order_id, cancelAmount: d, canceledAt: _.canceledAt, status: "CANCELED" } })) : (console.error(`[Payment] \u274C ${i} \uACB0\uC81C \uCDE8\uC18C \uC2E4\uD328:`, _.error), e.json({ success: false, error: _.error || "\uACB0\uC81C \uCDE8\uC18C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." }, 400));
  } catch (r) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC2E4\uD328:", r.message), e.json({ success: false, error: "\uACB0\uC81C \uCDE8\uC18C \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
p.get("/api/payments/:paymentKey", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("paymentKey"), s = await t.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(r).first();
    return s ? e.json({ success: true, data: s }) : e.json({ success: false, error: "\uACB0\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
  } catch (r) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uC870\uD68C \uC2E4\uD328:", r.message), e.json({ success: false, error: "\uACB0\uC81C \uC870\uD68C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
p.get("/api/payments/order/:orderId", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("orderId"), s = await t.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
    `).bind(r).all();
    return e.json({ success: true, data: s.results || [] });
  } catch (r) {
    return console.error("[Payment] \u274C \uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", r.message), e.json({ success: false, error: "\uACB0\uC81C \uBAA9\uB85D \uC870\uD68C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
p.get("/api/seller/orders", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = await t.prepare(`
      SELECT DISTINCT o.*, u.name as user_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC
    `).bind(r.sellerId).all(), a = await Promise.all(s.results.map(async (n) => {
      const o = await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ? AND oi.seller_id = ?
        `).bind(n.id, r.sellerId).all();
      return { ...n, items: o.results };
    }));
    return e.json({ success: true, data: a });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.patch("/api/seller/orders/:orderNumber/status", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("orderNumber"), { status: a } = await e.req.json();
    if (!["PAY_COMPLETE", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED"].includes(a)) return e.json({ success: false, error: "Invalid status" }, 400);
    const o = await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(s).first();
    if (!o) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id, r.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
    if (await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a, s).run(), a === "DELIVERED") try {
      console.log(`[AUTO TAX INVOICE] \uBC30\uC1A1\uC644\uB8CC \uAC10\uC9C0: ${s}, \uC790\uB3D9 \uBC1C\uD589 \uC2DC\uC791...`);
      const c = await t.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(s).first();
      if (c != null && c.buyer_business_number && (c != null && c.buyer_business_name)) {
        console.log(`[AUTO TAX INVOICE] \uC0AC\uC5C5\uC790 \uAD6C\uB9E4 \uD655\uC778: ${c.buyer_business_number}`);
        const u = await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();
        if (!u) console.warn(`[AUTO TAX INVOICE] \uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4 \uBBF8\uC2B9\uC778: seller_id=${r.sellerId}`), await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.', CURRENT_TIMESTAMP)
            `).bind(s, r.sellerId).run();
        else {
          console.log(`[AUTO TAX INVOICE] \uBC1C\uD589 \uC2DC\uC791: orderNumber=${s}`);
          const l = await t.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(), d = Number(c.total_amount), _ = Math.floor(d / 1.1), E = d - _, f = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), y = Math.random().toString(36).substring(2, 8).toUpperCase(), h = `${f}-${y}`, g = (await t.prepare(`
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
            `).bind(r.sellerId, s, h, u.business_number, u.business_name, u.ceo_name, u.address || "", u.business_type || "", u.business_category || "", u.email || "", u.phone || "", c.buyer_business_number, c.buyer_business_name, c.buyer_ceo_name || "", c.buyer_business_address || "", c.buyer_business_type || "", c.buyer_business_category || "", c.buyer_email || "", c.buyer_phone || "", _, E, d, `AUTO-${Date.now()}-${y}`).run()).meta.last_row_id;
          for (const D of l.results) {
            const N = Math.floor(Number(D.price) * Number(D.quantity) / 1.1), w = Number(D.price) * Number(D.quantity) - N;
            await t.prepare(`
                INSERT INTO tax_invoice_items (
                  tax_invoice_id, product_name, quantity, unit_price,
                  supply_price, tax_amount, description, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(g, D.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", D.quantity, D.price, N, w, D.option_name || "").run();
          }
          await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(s, r.sellerId, g).run(), console.log(`[AUTO TAX INVOICE] \u2705 \uBC1C\uD589 \uC644\uB8CC: invoice_id=${g}, invoice_number=${h}`);
        }
      } else console.log(`[AUTO TAX INVOICE] \uC77C\uBC18 \uAD6C\uB9E4 (\uC0AC\uC5C5\uC790 \uC815\uBCF4 \uC5C6\uC74C): ${s}`);
    } catch (c) {
      console.error("[AUTO TAX INVOICE] \uBC1C\uD589 \uC2E4\uD328:", c);
      try {
        await t.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(s, r.sellerId, c.message).run();
      } catch (u) {
        console.error("[AUTO TAX INVOICE] \uB85C\uADF8 \uAE30\uB85D \uC2E4\uD328:", u);
      }
    }
    try {
      const c = await t.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(s).first();
      if (c && c.user_id) {
        const l = { PREPARING: "preparing", SHIPPING: "shipping", DELIVERED: "delivered" }[a];
        l && await $s(t, c.user_id, s, l);
      }
    } catch (c) {
      console.error("[Order Status] Notification error:", c);
    }
    return e.json({ success: true });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.put("/api/seller/orders/:orderNumber/tracking", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("orderNumber"), { courier: a, tracking_number: n } = await e.req.json();
    if (!a || !n) return e.json({ success: false, error: "Courier and tracking number are required" }, 400);
    const o = await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(s).first();
    if (!o) return e.json({ success: false, error: "Order not found" }, 404);
    if (!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id, r.sellerId).first()) return e.json({ success: false, error: "Unauthorized" }, 403);
    await t.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a, n, s).run();
    try {
      const c = await t.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(s).first();
      c && c.user_id && await $s(t, c.user_id, s, "shipping", a, n);
    } catch (c) {
      console.error("[Tracking] Notification error:", c);
    }
    return e.json({ success: true, message: "Tracking information updated" });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/orders/:orderNumber/refund", async (e) => {
  const { DB: t } = e.env, r = e.req.param("orderNumber"), { reason: s } = await e.req.json();
  try {
    const a = await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(r).first();
    return a ? ["paid", "preparing", "shipped", "delivered"].includes(a.status) ? a.status === "refunded" || a.status === "cancelled" ? e.json({ success: false, error: "\uC774\uBBF8 \uD658\uBD88 \uB610\uB294 \uCDE8\uC18C\uB41C \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400) : (await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind("refunded", r).run(), e.json({ success: true, message: "\uD658\uBD88 \uC694\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uACE0\uAC1D\uC13C\uD130(0507-0177-0432)\uC5D0\uC11C \uCC98\uB9AC \uC608\uC815\uC785\uB2C8\uB2E4.", requiresManualProcessing: true })) : e.json({ success: false, error: "\uD658\uBD88\uC774 \uBD88\uAC00\uB2A5\uD55C \uC8FC\uBB38 \uC0C1\uD0DC\uC785\uB2C8\uB2E4." }, 400) : e.json({ success: false, error: "Order not found" }, 404);
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/admin/orders", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = await t.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();
    return e.json({ success: true, data: s.results });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/sellers", async (e) => {
  const { DB: t } = e.env, { limit: r = "20", offset: s = "0" } = e.req.query();
  try {
    const a = `
      SELECT id, business_name, name as display_name, 
             commission_rate, created_at
      FROM sellers 
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, { results: n } = await t.prepare(a).bind(parseInt(r), parseInt(s)).all();
    return e.json({ success: true, data: n });
  } catch (a) {
    return console.error("[API] Sellers list error:", a), e.json({ success: false, error: `\uC140\uB7EC \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${a.message}` }, 500);
  }
});
p.get("/api/admin/sellers", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();
    return e.json({ success: true, data: s.results });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/admin/sellers", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { username: s, password: a, name: n, email: o, phone: i, business_name: c, business_number: u } = await e.req.json();
    if (!s || !a || !n || !o || !c) return e.json({ success: false, error: "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    if (await t.prepare("SELECT id FROM sellers WHERE username = ?").bind(s).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC544\uC774\uB514\uC785\uB2C8\uB2E4" }, 400);
    if (await t.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first()) return e.json({ success: false, error: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4" }, 400);
    const _ = `$2a$10$placeholder_hash_for_${a}`, E = await t.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(s, _, n, o, i || null, c, u || null, r.adminId).run();
    return e.json({ success: true, data: { id: E.meta.last_row_id, username: s, name: n, email: o, business_name: c } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.put("/api/admin/sellers/:id", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), { name: a, email: n, phone: o, business_name: i, business_number: c, is_active: u, status: l } = await e.req.json();
    return await t.prepare("SELECT id FROM sellers WHERE id = ?").bind(s).first() ? (await t.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, n, o || null, i, c || null, u, l, s).run(), e.json({ success: true })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.delete("/api/admin/sellers/:id", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), a = await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(s).first();
    return a ? (await t.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(), await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(s).run(), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.username}'\uC758 \uB85C\uADF8\uC778 \uAD8C\uD55C\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4` })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/admin/sellers/:id/reset-password", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), { new_password: a } = await e.req.json();
    if (!a || a.length < 6) return e.json({ success: false, error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const n = await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(s).first();
    if (!n) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const o = `$2a$10$placeholder_hash_for_${a}`;
    return await t.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o, s).run(), await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(s).run(), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.username}'\uC758 \uBE44\uBC00\uBC88\uD638\uAC00 \uC7AC\uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4` });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.patch("/api/admin/sellers/:id/commission", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), { commission_rate: a } = await e.req.json();
    if (a == null) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = parseFloat(a);
    if (isNaN(n) || n < 0 || n > 100) return e.json({ success: false, error: "\uC218\uC218\uB8CC\uC728\uC740 0\uC5D0\uC11C 100 \uC0AC\uC774\uC758 \uAC12\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" }, 400);
    const o = await t.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(s).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const i = o.commission_rate || 10;
    return await t.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n, s).run(), console.log(`\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD: \uD310\uB9E4\uC790 ${o.username} (ID: ${s}), ${i}% \u2192 ${n}%`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${o.username}'\uC758 \uC218\uC218\uB8CC\uC728\uC774 ${i}%\uC5D0\uC11C ${n}%\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: s, seller_username: o.username, old_commission_rate: i, new_commission_rate: n } });
  } catch (s) {
    return console.error("\uC218\uC218\uB8CC\uC728 \uBCC0\uACBD \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.patch("/api/admin/sellers/:id/approve", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), a = await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(s).first();
    return a ? a.status === "approved" ? e.json({ success: false, error: "\uC774\uBBF8 \uC2B9\uC778\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400) : (await t.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(r.adminId, s).run(), console.log(`\uC140\uB7EC \uC2B9\uC778: ${a.username} (ID: ${s}) by Admin ID: ${r.adminId}`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${a.name}'\uB2D8\uC774 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: s, seller_username: a.username, seller_name: a.name, status: "approved", approved_at: (/* @__PURE__ */ new Date()).toISOString() } })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return console.error("\uC140\uB7EC \uC2B9\uC778 \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.patch("/api/admin/sellers/:id/reject", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), { reason: a } = await e.req.json();
    if (!a) return e.json({ success: false, error: "\uAC70\uBD80 \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694" }, 400);
    const n = await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(s).first();
    return n ? n.status === "rejected" ? e.json({ success: false, error: "\uC774\uBBF8 \uAC70\uBD80\uB41C \uD310\uB9E4\uC790\uC785\uB2C8\uB2E4" }, 400) : (await t.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a, r.adminId, s).run(), console.log(`\uC140\uB7EC \uAC70\uBD80: ${n.username} (ID: ${s}), \uC0AC\uC720: ${a}`), e.json({ success: true, message: `\uD310\uB9E4\uC790 '${n.name}'\uB2D8\uC758 \uC2B9\uC778\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { seller_id: s, seller_username: n.username, seller_name: n.name, status: "rejected", rejection_reason: a, rejected_at: (/* @__PURE__ */ new Date()).toISOString() } })) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return console.error("\uC140\uB7EC \uAC70\uBD80 \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/admin/sellers/pending", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();
    return e.json({ success: true, data: s.results, count: s.results.length });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/public/seller/:sellerId", async (e) => {
  const { DB: t, CACHE_KV: r } = e.env;
  try {
    const s = e.req.param("sellerId"), a = `public:seller:${s}`, n = await as(r, a);
    if (n) return e.json({ success: true, data: n, cached: true });
    const o = await t.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(s).first();
    if (!o) return e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
    const i = await t.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(s).all(), c = await t.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(s).all(), u = await t.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(s).all(), l = await t.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(s).first(), d = { profile: o, live_streams: i.results, scheduled_streams: c.results, products: u.results, stats: l };
    return await ns(r, a, d, 60), e.json({ success: true, data: d });
  } catch (s) {
    return console.error("\uC140\uB7EC \uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/public/seller/username/:username", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("username"), s = await t.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();
    return s ? e.json({ success: true, data: { seller_id: s.id } }) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (r) {
    return console.error("\uC140\uB7EC \uC870\uD68C \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/settlement/stats", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { period: s } = e.req.query();
    let a = "";
    const n = /* @__PURE__ */ new Date();
    switch (s) {
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
    return e.json({ success: true, data: { overview: o, sellers: i.results, period: s || "all" } });
  } catch (s) {
    return console.error("\uC815\uC0B0 \uD1B5\uACC4 \uC870\uD68C \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/admin/settlement/records", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { seller_id: s, period: a, status: n } = e.req.query();
    let o = ["payment_status = 'completed'", "is_cancelled = 0"];
    const i = [];
    s && (o.push("o.seller_id = ?"), i.push(s)), n && (o.push("o.settlement_status = ?"), i.push(n));
    const c = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const d = c.toISOString().split("T")[0];
        o.push(`DATE(o.created_at) = '${d}'`);
        break;
      case "week":
        const _ = new Date(c.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${_}'`);
        break;
      case "month":
        const E = new Date(c.getTime() - 720 * 60 * 60 * 1e3).toISOString().split("T")[0];
        o.push(`DATE(o.created_at) >= '${E}'`);
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
  } catch (s) {
    return console.error("\uC815\uC0B0 \uB0B4\uC5ED \uC870\uD68C \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.patch("/api/admin/settlement/:orderId/status", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("orderId"), { status: a } = await e.req.json();
    if (!["pending", "completed"].includes(a)) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC815\uC0B0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4" }, 400);
    const n = await t.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(s).first();
    return n ? (await t.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a === "completed" ? "datetime('now')" : "NULL"}
      WHERE id = ?
    `).bind(a, s).run(), console.log(`\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD: \uC8FC\uBB38 ${n.order_number}, ${n.settlement_status} \u2192 ${a}`), e.json({ success: true, message: `\uC815\uC0B0 \uC0C1\uD0DC\uAC00 '${a}'\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4`, data: { order_id: s, order_number: n.order_number, old_status: n.settlement_status, new_status: a } })) : e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return console.error("\uC815\uC0B0 \uC0C1\uD0DC \uBCC0\uACBD \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/admin/settlement/batch-complete", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { order_ids: s } = await e.req.json();
    if (!Array.isArray(s) || s.length === 0) return e.json({ success: false, error: "\uC8FC\uBB38 ID \uBC30\uC5F4\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 400);
    let a = 0, n = 0;
    for (const o of s) try {
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
    return e.json({ success: true, message: `${a}\uAC74 \uC815\uC0B0 \uC644\uB8CC, ${n}\uAC74 \uC2E4\uD328`, data: { total: s.length, success: a, failed: n } });
  } catch (s) {
    return console.error("\uC77C\uAD04 \uC815\uC0B0 \uCC98\uB9AC \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/admin/settlement/export-csv", async (e) => {
  const { DB: t } = e.env, r = await M(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { seller_id: s, period: a } = e.req.query();
    let n = ["payment_status = 'completed'", "is_cancelled = 0"];
    const o = [];
    s && (n.push("o.seller_id = ?"), o.push(s));
    const i = /* @__PURE__ */ new Date();
    switch (a) {
      case "today":
        const f = i.toISOString().split("T")[0];
        n.push(`DATE(o.created_at) = '${f}'`);
        break;
      case "week":
        const y = new Date(i.getTime() - 10080 * 60 * 1e3).toISOString().split("T")[0];
        n.push(`DATE(o.created_at) >= '${y}'`);
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
    const d = Object.keys(l[0]);
    let _ = d.join(",") + `
`;
    l.forEach((f) => {
      const y = d.map((h) => {
        const b = f[h];
        if (b == null) return "";
        const g = String(b);
        return g.includes(",") || g.includes('"') || g.includes(`
`) ? `"${g.replace(/"/g, '""')}"` : g;
      });
      _ += y.join(",") + `
`;
    });
    const E = "\uFEFF";
    return new Response(E + _, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${a || "all"}_${Date.now()}.csv"` } });
  } catch (s) {
    return console.error("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/orders/create", async (e) => {
  const { DB: t } = e.env;
  try {
    const { userId: r, cartItems: s, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i, buyerBusinessNumber: c, buyerBusinessName: u, buyerCeoName: l } = await e.req.json();
    console.log("\uC8FC\uBB38 \uC0DD\uC131 \uC694\uCCAD:", { userId: r, cartItems: s == null ? void 0 : s.length, totalAmount: a, shippingAddressId: n, sellerId: o, issueTaxInvoice: i });
    let d = 10;
    if (o) {
      const w = await t.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();
      w && w.commission_rate !== null && (d = w.commission_rate);
    }
    console.log("\uC218\uC218\uB8CC\uC728:", { sellerId: o, commissionRate: d });
    const _ = Math.floor(a * (d / 100)), E = a - _;
    let f = null;
    if (n) {
      const w = await t.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(n, r).first();
      if (!w) return e.json({ success: false, error: "\uBC30\uC1A1\uC9C0 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
      f = w;
    }
    if (!r) return e.json({ success: false, error: "User ID is required. Please login with Kakao first." }, 401);
    const y = r, h = Date.now(), b = Math.random().toString(36).substring(2, 8).toUpperCase(), g = `ORDER_${h}_${b}`;
    for (const w of s) {
      const C = await t.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(w.product_id).first();
      if (!C) return e.json({ success: false, error: `\uC0C1\uD488\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (ID: ${w.product_id})` }, 400);
      if (C.stock < w.quantity) return e.json({ success: false, error: `\uC7AC\uACE0\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4 (\uC0C1\uD488 ID: ${w.product_id})` }, 400);
    }
    const N = (await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(g, y, a, "pending", o || null, d, _, E, n || null, (f == null ? void 0 : f.recipient_name) || null, (f == null ? void 0 : f.phone) || null, f != null && f.address ? `${f.address} ${f.address_detail}` : null, (f == null ? void 0 : f.postal_code) || null, i ? 1 : 0, c || null, u || null, l || null).run()).meta.last_row_id;
    for (const w of s) {
      await t.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(N, w.product_id, w.option_id || null, w.quantity, w.price_snapshot || w.price).run(), await t.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(w.quantity, w.product_id).run();
      try {
        const C = await t.prepare(`
          SELECT id, name, stock, stock_alert_threshold, seller_id 
          FROM products 
          WHERE id = ?
        `).bind(w.product_id).first();
        if (C) {
          const k = C.stock_alert_threshold || 5, I = C.stock;
          I <= k && C.seller_id && (await Gr(t, C.seller_id, C.name, I, k), console.log(`[Low Stock Alert] ${C.name}: ${I} <= ${k}`));
        }
      } catch (C) {
        console.error("[Low Stock Alert] Error:", C);
      }
    }
    return console.log("\uC8FC\uBB38 \uC0DD\uC131 \uC644\uB8CC:", { orderId: N, orderNumber: g }), e.json({ success: true, orderId: N, orderNumber: g, totalAmount: a });
  } catch (r) {
    return console.error("\uC8FC\uBB38 \uC0DD\uC131 \uC2E4\uD328:", r), e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/orders/:orderNumber/refund", O(), async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("orderNumber"), { reason: s } = await e.req.json();
    console.log("[Order Refund] \uD658\uBD88 \uC694\uCCAD:", { orderNumber: r, reason: s });
    const a = await t.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(r).first();
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
    `).bind(s || "\uAD6C\uB9E4\uC790 \uC694\uCCAD", r).run(), console.log("[Order Refund] \uC8FC\uBB38 \uC0C1\uD0DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC:", r);
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
    return console.log("[Order Refund] \u2705 \uD658\uBD88 \uC644\uB8CC:", { orderNumber: r, reason: s }), e.json({ success: true, message: "\uC8FC\uBB38\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: { orderNumber: r, cancelDate: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (r) {
    return console.error("[Order Refund] Error:", r), e.json({ success: false, error: r.message || "\uC8FC\uBB38 \uCDE8\uC18C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" }, 500);
  }
});
p.get("/api/seller/sales", O(), async (e) => {
  try {
    const { DB: t } = e.env, r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const s = await Ne(e.env.SESSION_KV, r);
    if (!s) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (s.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = s.seller_id || s.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], u = await t.prepare(`
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
    return e.json({ success: true, data: { seller: u, stats: l, orders: (d == null ? void 0 : d.results) || [] } });
  } catch (t) {
    return console.error("Seller sales query error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.get("/api/seller/settlement-csv", O(), async (e) => {
  try {
    const { DB: t } = e.env, r = e.req.header("X-Session-Token");
    if (!r) return e.json({ success: false, error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 401);
    const s = await Ne(e.env.SESSION_KV, r);
    if (!s) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4." }, 401);
    if (s.user_type !== "seller") return e.json({ success: false, error: "\uC140\uB7EC\uB9CC \uC811\uADFC \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 403);
    const a = s.seller_id || s.user_id, { startDate: n, endDate: o } = e.req.query(), i = n || new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0], c = o || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], u = await t.prepare(`
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
    for (const d of (u == null ? void 0 : u.results) || []) {
      const _ = d.status === "delivered" ? "\uBC30\uC1A1\uC644\uB8CC" : d.status === "shipped" ? "\uBC30\uC1A1\uC911" : d.status === "preparing" ? "\uC0C1\uD488\uC900\uBE44\uC911" : d.status === "paid" ? "\uACB0\uC81C\uC644\uB8CC" : "\uB300\uAE30\uC911", E = d.buyer_business_name || "-", f = d.buyer_business_number || "-", y = d.invoice_number || "-", h = d.issue_date || "-", b = d.tax_invoice_status === "issued" ? "\uBC1C\uD589\uC644\uB8CC" : d.tax_invoice_status === "cancelled" ? "\uCDE8\uC18C" : "-", g = d.nts_confirm_number || "-";
      l += `${d.order_number},${d.created_at},${d.user_name || "\uC775\uBA85"},${d.total_amount},${d.commission_amount},${d.seller_amount},${_},${E},${f},${y},${h},${b},${g}
`;
    }
    return new Response(l, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement_${i}_${c}.csv"` } });
  } catch (t) {
    return console.error("CSV download error:", t), e.json({ success: false, error: t.message }, 500);
  }
});
p.post("/api/seller/tax-invoices/issue", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { order_number: s } = await e.req.json();
    if (!s) return e.json({ success: false, error: "\uC8FC\uBB38\uBC88\uD638\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const a = await t.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(s).first();
    if (!a) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (!a.issue_tax_invoice) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589\uC774 \uC694\uCCAD\uB418\uC9C0 \uC54A\uC740 \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 400);
    const n = await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(r.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC2B9\uC778\uB41C \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778\uC744 \uAE30\uB2E4\uB824\uC8FC\uC138\uC694." }, 400);
    const o = await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(), i = Number(a.total_amount), c = Math.floor(i / 1.1), u = i - c, l = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], d = `${l}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, _ = $r(n, a, o.results);
    let E, f, y;
    try {
      E = await xr(_), f = E.ntsConfirmNumber, y = E.invoiceKey, console.log("\uBC14\uB85C\uBE4C \uBC1C\uD589 \uC131\uACF5:", { ntsConfirmNumber: f, invoiceKey: y, mockMode: ke() });
    } catch (g) {
      console.error("\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328:", g), f = "FAILED", y = null;
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
    `).bind(r.sellerId, s, "tax", d, l, n.business_number, n.business_name, n.ceo_name, n.address, n.business_type, n.business_category, a.buyer_business_number, a.buyer_business_name, a.buyer_ceo_name, c, u, i, f === "FAILED" ? "failed" : "issued", ke() ? "mock" : "barobill", y, f).run()).meta.last_row_id;
    for (const g of o.results) {
      const D = Math.floor(Number(g.price) * Number(g.quantity) / 1.1), N = Number(g.price) * Number(g.quantity) - D;
      await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(b, g.id, g.product_name, g.quantity, g.price, D, N).run();
    }
    return e.json({ success: true, data: { invoice_id: b, invoice_number: d, issue_date: l, total_amount: i, supply_price: c, tax_amount: u, status: f === "FAILED" ? "failed" : "issued", nts_confirm_number: f, api_invoice_key: y, mock_mode: ke(), message: f === "FAILED" ? "\uBC14\uB85C\uBE4C API \uD638\uCD9C \uC2E4\uD328. \uB098\uC911\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694." : ke() ? "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (Mock Mode - \uC2E4\uC81C \uBC1C\uD589 \uC544\uB2D8)" : "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uBC1C\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4." } });
  } catch (s) {
    return console.error("\uC138\uAE08\uACC4\uC0B0\uC11C \uBC1C\uD589 \uC624\uB958:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/tax-invoices", async (e) => {
  var s;
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { start_date: a, end_date: n, status: o } = e.req.query();
    let i = `
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;
    const c = [r.sellerId];
    a && (i += " AND issue_date >= ?", c.push(a)), n && (i += " AND issue_date <= ?", c.push(n)), o && (i += " AND status = ?", c.push(o)), i += " ORDER BY created_at DESC";
    const u = await t.prepare(i).bind(...c).all();
    return e.json({ success: true, data: u.results || [], total: ((s = u.results) == null ? void 0 : s.length) || 0 });
  } catch (a) {
    return e.json({ success: false, error: a.message }, 500);
  }
});
p.get("/api/seller/tax-invoices/:id", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), a = await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(s, r.sellerId).first();
    if (!a) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const n = await t.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(s).all();
    return e.json({ success: true, data: { ...a, items: n.results || [] } });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/tax-invoices/:id/cancel", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("id"), { reason: a } = await e.req.json(), n = await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(s, r.sellerId).first();
    if (!n) return e.json({ success: false, error: "\uC138\uAE08\uACC4\uC0B0\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    const o = new Date(n.issue_date), i = new Date(o);
    if (i.setDate(i.getDate() + 1), /* @__PURE__ */ new Date() > i) return e.json({ success: false, error: "\uBC1C\uD589\uC77C \uC775\uC77C\uAE4C\uC9C0\uB9CC \uCDE8\uC18C \uAC00\uB2A5\uD569\uB2C8\uB2E4." }, 400);
    try {
      if (n.api_invoice_key && !ke()) {
        const u = await t.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(r.sellerId).first();
        u && u.business_number && await Ur(u.business_number, n.api_invoice_key, a || "\uD310\uB9E4\uC790 \uC694\uCCAD");
      }
    } catch (u) {
      console.error("\uBC14\uB85C\uBE4C \uCDE8\uC18C API \uD638\uCD9C \uC2E4\uD328:", u);
    }
    return await t.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(), e.json({ success: true, message: "\uC138\uAE08\uACC4\uC0B0\uC11C\uAC00 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/tax-invoices/auto-issue-logs", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const { status: s, limit: a = 50 } = e.req.query();
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
    s && (n += " AND log.status = ?", o.push(s)), n += " ORDER BY log.created_at DESC LIMIT ?", o.push(Number(a));
    const i = await t.prepare(n).bind(...o).all();
    return e.json({ success: true, data: i.results });
  } catch (s) {
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.post("/api/seller/tax-invoices/retry/:orderNumber", async (e) => {
  const { DB: t } = e.env, r = await v(e);
  if (!r.success) return e.json({ success: false, error: r.error }, 401);
  try {
    const s = e.req.param("orderNumber");
    console.log(`[TAX INVOICE RETRY] \uC7AC\uC2DC\uB3C4 \uC2DC\uC791: ${s}`);
    const a = await t.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(s, r.sellerId).first();
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
    `).bind(s).first();
    if (!o) return e.json({ success: false, error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    if (!o.buyer_business_number || !o.buyer_business_name) return e.json({ success: false, error: "\uC8FC\uBB38\uC5D0 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }, 400);
    const i = await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();
    if (!i) return e.json({ success: false, error: "\uD310\uB9E4\uC790 \uC0AC\uC5C5\uC790 \uC815\uBCF4\uAC00 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 400);
    const c = await t.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(), u = Number(o.total_amount), l = Math.floor(u / 1.1), d = u - l, _ = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, ""), E = Math.random().toString(36).substring(2, 8).toUpperCase(), f = `${_}-${E}`, h = (await t.prepare(`
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
    `).bind(r.sellerId, s, f, i.business_number, i.business_name, i.ceo_name, i.address || "", i.business_type || "", i.business_category || "", i.email || "", i.phone || "", o.buyer_business_number, o.buyer_business_name, o.buyer_ceo_name || "", o.buyer_business_address || "", o.buyer_business_type || "", o.buyer_business_category || "", o.buyer_email || "", o.buyer_phone || "", l, d, u, `RETRY-${Date.now()}-${E}`).run()).meta.last_row_id;
    for (const b of c.results) {
      const g = Math.floor(Number(b.price) * Number(b.quantity) / 1.1), D = Number(b.price) * Number(b.quantity) - g;
      await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(h, b.product_name || "\uC0C1\uD488\uBA85 \uC5C6\uC74C", b.quantity, b.price, g, D, b.option_name || "").run();
    }
    return await t.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(s, r.sellerId, h, n + 1).run(), await t.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n + 1, a.id).run(), console.log(`[TAX INVOICE RETRY] \u2705 \uC7AC\uC2DC\uB3C4 \uC131\uACF5: invoice_id=${h}, retry_count=${n + 1}`), e.json({ success: true, data: { invoice_id: h, invoice_number: f, retry_count: n + 1 } });
  } catch (s) {
    console.error("[TAX INVOICE RETRY] \uC7AC\uC2DC\uB3C4 \uC2E4\uD328:", s);
    try {
      const a = e.req.param("orderNumber"), n = await t.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a, r.sellerId).first(), o = Number((n == null ? void 0 : n.retry_count) || 0);
      await t.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a, r.sellerId, s.message, o + 1).run();
    } catch (a) {
      console.error("[TAX INVOICE RETRY] \uB85C\uADF8 \uAE30\uB85D \uC2E4\uD328:", a);
    }
    return e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/live/:id", async (e) => {
  try {
    const t = new URL("/static/live.html", e.req.url);
    let s = await (await fetch(t.toString())).text();
    const n = `<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY || "975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;
    return s = s.replace("<!-- Scripts -->", `<!-- Scripts -->
    ${n}`), console.log("[Live Page] Environment variables injected"), new Response(s, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving live page:", t), new Response("<h1>Error loading live page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
p.get("/cart", async (e) => {
  try {
    const t = new URL("/static/cart.html", e.req.url);
    let s = await (await fetch(t.toString())).text();
    return s = s.replace("%%NICEPAY_CLIENT_ID%%", e.env.NICEPAY_CLIENT_ID || "S2_d5ec29558e9d46419bf01eb828ca0834"), s = s.replace("%%NICEPAY_MID%%", e.env.NICEPAY_MID || "nictest00m"), new Response(s, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving cart page:", t), new Response("<h1>Error loading cart page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
p.get("/my-orders", async (e) => {
  try {
    const t = new URL("/static/my-orders.html", e.req.url), s = await (await fetch(t.toString())).text();
    return new Response(s, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving my orders page:", t), new Response("<h1>Error loading orders page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
p.get("/payment-result", async (e) => {
  try {
    const t = new URL("/payment-result.html", e.req.url), s = await (await fetch(t.toString())).text();
    return new Response(s, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (t) {
    return console.error("Error serving payment result page:", t), new Response("<h1>Error loading payment result page</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
p.get("/api/seller/profile", async (e) => {
  const { DB: t } = e.env, r = e.req.header("X-Session-Token");
  if (!r) return e.json({ success: false, error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const s = await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(r).first();
    if (!s || !s.seller_id) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
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
    `).bind(s.seller_id).first();
    return a ? e.json({ success: true, data: a }) : e.json({ success: false, error: "\uC140\uB7EC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return console.error("\uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.patch("/api/seller/profile", async (e) => {
  const { DB: t } = e.env, r = e.req.header("X-Session-Token");
  if (!r) return e.json({ success: false, error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" }, 401);
  try {
    const s = await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(r).first();
    if (!s || !s.seller_id) return e.json({ success: false, error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC138\uC158\uC785\uB2C8\uB2E4" }, 401);
    const { profile_image: a, bio: n, sns_instagram: o, sns_youtube: i, sns_facebook: c, sns_twitter: u, website_url: l, kakao_chat_link: d } = await e.req.json(), _ = [], E = [];
    if (a !== void 0 && (_.push("profile_image = ?"), E.push(a)), n !== void 0 && (_.push("bio = ?"), E.push(n)), o !== void 0 && (_.push("sns_instagram = ?"), E.push(o)), i !== void 0 && (_.push("sns_youtube = ?"), E.push(i)), c !== void 0 && (_.push("sns_facebook = ?"), E.push(c)), u !== void 0 && (_.push("sns_twitter = ?"), E.push(u)), l !== void 0 && (_.push("website_url = ?"), E.push(l)), d !== void 0 && (_.push("kakao_chat_link = ?"), E.push(d)), _.length === 0) return e.json({ success: false, error: "\uC218\uC815\uD560 \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" }, 400);
    _.push("updated_at = datetime('now')"), E.push(s.seller_id), await t.prepare(`
      UPDATE sellers 
      SET ${_.join(", ")}
      WHERE id = ?
    `).bind(...E).run();
    const f = await t.prepare(`
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
    `).bind(s.seller_id).first();
    return e.json({ success: true, message: "\uD504\uB85C\uD544\uC774 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4", data: f });
  } catch (s) {
    return console.error("\uD504\uB85C\uD544 \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/public/:sellerId", async (e) => {
  const { DB: t } = e.env, r = e.req.param("sellerId");
  try {
    const s = await t.prepare(`
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
    return s ? e.json({ success: true, data: s }) : e.json({ success: false, error: "\uD310\uB9E4\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" }, 404);
  } catch (s) {
    return console.error("\uC140\uB7EC \uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/:sellerId/streams", async (e) => {
  const { DB: t } = e.env, r = e.req.param("sellerId");
  try {
    const s = await t.prepare(`
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
    return e.json({ success: true, data: s.results });
  } catch (s) {
    return console.error("\uB77C\uC774\uBE0C \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/seller/:sellerId/products-public", async (e) => {
  const { DB: t } = e.env, r = e.req.param("sellerId");
  try {
    const s = await t.prepare(`
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
    return e.json({ success: true, data: s.results });
  } catch (s) {
    return console.error("\uC0C1\uD488 \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328:", s), e.json({ success: false, error: s.message }, 500);
  }
});
p.get("/api/notifications", q, async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.get("userId"), s = e.get("userType"), a = parseInt(e.req.query("limit") || "50"), n = e.req.query("unread_only") === "true";
    let o = `
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;
    n && (o += " AND is_read = 0"), o += " ORDER BY created_at DESC LIMIT ?";
    const i = await t.prepare(o).bind(r, s, a).all();
    return e.json({ success: true, data: i.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/notifications/unread-count", q, async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.get("userId"), s = e.get("userType"), a = await t.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r, s).first();
    return e.json({ success: true, count: (a == null ? void 0 : a.count) || 0 });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/notifications/:id/read", q, async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("id"), s = e.get("userId"), a = e.get("userType");
    return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r, s, a).first() ? (await t.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(r).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/notifications/read-all", q, async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.get("userId"), s = e.get("userType");
    return await t.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r, s).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/notifications/:id", q, async (e) => {
  const { DB: t } = e.env;
  try {
    const r = e.req.param("id"), s = e.get("userId"), a = e.get("userType");
    return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r, s, a).first() ? (await t.prepare("DELETE FROM notifications WHERE id = ?").bind(r).run(), e.json({ success: true })) : e.json({ success: false, error: "Notification not found" }, 404);
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/banners", async (e) => {
  const { DB: t } = e.env;
  try {
    const r = (/* @__PURE__ */ new Date()).toISOString(), s = await t.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(r, r).all();
    return e.json({ success: true, data: s.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/api/admin/banners", q, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const s = await t.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();
    return e.json({ success: true, data: s.results });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.post("/api/admin/banners", q, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const { title: s, image_url: a, link_url: n, description: o, is_active: i, display_order: c, start_date: u, end_date: l } = await e.req.json();
    if (!s || !a) return e.json({ success: false, error: "\uC81C\uBAA9\uACFC \uC774\uBBF8\uC9C0\uB294 \uD544\uC218\uC785\uB2C8\uB2E4." }, 400);
    const d = await t.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(s, a, n || null, o || null, i !== false ? 1 : 0, c || 0, u || null, l || null).run();
    return e.json({ success: true, id: d.meta.last_row_id });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.put("/api/admin/banners/:id", q, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const s = e.req.param("id"), { title: a, image_url: n, link_url: o, description: i, is_active: c, display_order: u, start_date: l, end_date: d } = await e.req.json();
    return await t.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a, n, o || null, i || null, c ? 1 : 0, u || 0, l || null, d || null, s).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.delete("/api/admin/banners/:id", q, async (e) => {
  const { DB: t } = e.env;
  try {
    if (e.get("userType") !== "admin") return e.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
    const s = e.req.param("id");
    return await t.prepare("DELETE FROM banners WHERE id = ?").bind(s).run(), e.json({ success: true });
  } catch (r) {
    return e.json({ success: false, error: r.message }, 500);
  }
});
p.get("/order-complete", (e) => e.redirect("/order-complete.html", 302));
p.notFound((e) => {
  const t = e.req.path;
  return t.startsWith("/api/") ? e.json({ success: false, error: "Not found", message: `The requested endpoint ${t} was not found.` }, 404) : new Response(null, { status: 404 });
});
p.onError((e, t) => {
  const r = t.req.path;
  if (console.error("[Global Error Handler]", { path: r, method: t.req.method, error: e.message, stack: e.stack }), r.startsWith("/api/")) {
    let s = 500, a = "Internal Server Error";
    return e.message.includes("Unauthorized") || e.message.includes("\uB85C\uADF8\uC778") ? (s = 401, a = "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uB85C\uADF8\uC778\uD574\uC8FC\uC138\uC694.") : e.message.includes("Forbidden") || e.message.includes("\uAD8C\uD55C") ? (s = 403, a = "\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.") : e.message.includes("Not found") || e.message.includes("\uCC3E\uC744 \uC218 \uC5C6") ? (s = 404, a = "\uC694\uCCAD\uD558\uC2E0 \uB9AC\uC18C\uC2A4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.") : (e.message.includes("Bad request") || e.message.includes("\uC798\uBABB\uB41C")) && (s = 400, a = "\uC798\uBABB\uB41C \uC694\uCCAD\uC785\uB2C8\uB2E4."), t.json({ success: false, error: e.message || a }, s);
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
var ms = new Ms();
var nt = Object.assign({ "/src/index.tsx": p });
var Bs = false;
for (const [, e] of Object.entries(nt)) e && (ms.route("/", e), ms.notFound(e.notFoundHandler), Bs = true);
if (!Bs) throw new Error("Can't import modules from ['/src/index.tsx']");
async function Ys(e) {
  try {
    const { to: t, subject: r, htmlContent: s, textContent: a } = e, n = await fetch("https://api.mailchannels.net/tx/v1/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: t }] }], from: { email: "noreply@live.ur-team.com", name: "\uC720\uC5B4 \uB77C\uC774\uBE0C" }, subject: r, content: [{ type: "text/html", value: s }, ...a ? [{ type: "text/plain", value: a }] : []] }) });
    if (!n.ok) {
      const o = await n.text();
      return console.error("[Email] Failed to send:", n.status, o), { success: false, error: `Email send failed: ${n.status}` };
    }
    return console.log("[Email] Successfully sent to:", t), { success: true };
  } catch (t) {
    return console.error("[Email] Exception:", t), { success: false, error: t.message };
  }
}
__name(Ys, "Ys");
async function ot(e) {
  const { streamId: t, title: r, sellerName: s, platform: a, scheduledAt: n, status: o } = e, i = `https://live.ur-team.com/live/${t}`, c = o === "live" ? "\u{1F534} \uB77C\uC774\uBE0C \uC911" : o === "scheduled" ? "\u{1F4C5} \uC608\uC57D\uB428" : "\u23F8\uFE0F \uB300\uAE30 \uC911", u = `
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
        <span class="value">${s}</span>
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
\uC81C\uBAA9: ${r}
\uD310\uB9E4\uC790: ${s}
\uD50C\uB7AB\uD3FC: ${a === "youtube" ? "YouTube" : "TikTok"}
${n ? `\uC608\uC57D \uC2DC\uAC04: ${new Date(n).toLocaleString("ko-KR")}` : ""}
\uB77C\uC774\uBE0C ID: #${t}

\u{1F517} \uB77C\uC774\uBE0C \uD398\uC774\uC9C0: ${i}

---
\uB9AC\uC2A4\uD130\uCF54\uD37C\uB808\uC774\uC158
\uBD80\uC0B0\uAD11\uC5ED\uC2DC \uAE08\uC815\uAD6C \uB180\uC774\uB9C8\uB2F9\uB85C26 1402
\uB300\uD45C\uC804\uD654: 0507-0177-0432 | \uC774\uBA54\uC77C: jiwon@ur-team.com
  `;
  return Ys({ to: "jiwon@ur-team.com", subject: `[\uC720\uC5B4 \uB77C\uC774\uBE0C] \u{1F389} \uC0C8 \uB77C\uC774\uBE0C \uC2A4\uD2B8\uB9BC \uC0DD\uC131: ${r}`, htmlContent: u, textContent: l });
}
__name(ot, "ot");
var it = Object.freeze(Object.defineProperty({ __proto__: null, sendEmail: Ys, sendLiveStreamCreatedEmail: ot }, Symbol.toStringTag, { value: "Module" }));

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

// ../.wrangler/tmp/bundle-A7oWwE/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = ms;

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

// ../.wrangler/tmp/bundle-A7oWwE/middleware-loader.entry.ts
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
//# sourceMappingURL=bundledWorker-0.21246619268217826.mjs.map
