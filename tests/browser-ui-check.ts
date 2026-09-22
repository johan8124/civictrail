/**
 * CivicTrail Phase 2 REAL BROWSER validation (no extra dependency).
 *
 * Drives a real headless Chrome/Edge over the DevTools Protocol and exercises
 * the ACTUAL CivicTrail UI the way a person would: it clicks the synthetic
 * demo buttons, clicks "Check readiness", then reads the rendered DOM
 * (readiness banner, Evidence Ledger, Action Pack).
 *
 * It also verifies that no secret appears in the rendered HTML or in any
 * client JavaScript file served to the browser.
 *
 * Requires:
 * - `npm run dev` serving http://localhost:3000
 * - a local Chrome or Edge (override the path with CIVICTRAIL_CHROME)
 * - Node 22+ (global fetch and global WebSocket)
 *
 * Run: npx tsx tests/browser-ui-check.ts
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.CIVICTRAIL_BASE_URL ?? "http://localhost:3000";
const DEBUG_PORT = Number(process.env.CIVICTRAIL_CDP_PORT ?? "9333");
const STATIC_DIR = ".next/static";
const SHOT_DIR = "tests/screenshots";

const CHROME_CANDIDATES: string[] = [
  process.env.CIVICTRAIL_CHROME ?? "",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter((candidate) => candidate.length > 0);

/** Patterns that must never reach the browser. */
const SECRET_PATTERNS: RegExp[] = [/gsk_[A-Za-z0-9]/g, /GROQ_API_KEY/g, /sk-[A-Za-z0-9]{20,}/g];

interface CdpMessage {
  id?: number;
  result?: unknown;
  error?: { message: string };
}

interface CdpTarget {
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

interface LedgerEntrySnapshot {
  status: string;
  ruleId: string;
  text: string;
}

interface UiSnapshot {
  banner: string;
  entries: LedgerEntrySnapshot[];
  blockedStrip: string | null;
  packet: string | null;
  analysisPanelShown: boolean;
  analysisPanelGoneAfterResult: boolean;
  analysisCompleteShown: boolean;
  html: string;
  scriptSrcs: string[];
  overflowX: number;
  error?: string;
}

interface UiCase {
  name: string;
  buttonLabel: string;
  expectedStatus: "READY" | "BLOCKED" | "HUMAN REVIEW";
  expectedFailedRule: string | null;
  expectPacket: boolean;
  /** Cyber cases source their evidence from the cybercrime.gov.in portal. */
  cyber: boolean;

  guardOutcomeText: string;
}

const UI_CASES: UiCase[] = [
  {
    name: "valid cyber case -> READY",
    buttonLabel: "Load synthetic demo (READY)",
    expectedStatus: "READY",
    expectedFailedRule: null,
    expectPacket: true,
    cyber: true,

    guardOutcomeText: "Classification accepted by deterministic guard",
  },
  {
    name: "invalid UTR 12345 -> BLOCKED",
    buttonLabel: "Invalid UTR (BLOCKED)",
    expectedStatus: "BLOCKED",
    expectedFailedRule: "CYBER-CHECKLIST-007",
    expectPacket: true,
    cyber: true,

    guardOutcomeText: "Classification accepted by deterministic guard",
  },
  {
    name: "incident details under 200 chars -> BLOCKED",
    buttonLabel: "Short details (BLOCKED)",
    expectedStatus: "BLOCKED",
    expectedFailedRule: "CYBER-CHECKLIST-003",
    expectPacket: true,
    cyber: true,

    guardOutcomeText: "Classification accepted by deterministic guard",
  },
  {
    name: "prohibited special characters -> BLOCKED",
    buttonLabel: "Prohibited characters (BLOCKED)",
    expectedStatus: "BLOCKED",
    expectedFailedRule: "CYBER-CHECKLIST-004",
    expectPacket: true,
    cyber: true,

    guardOutcomeText: "Classification accepted by deterministic guard",
  },
  {
    name: "unsupported municipal-tax case -> HUMAN_REVIEW",
    buttonLabel: "Municipal tax (HUMAN_REVIEW)",
    expectedStatus: "HUMAN REVIEW",
    expectedFailedRule: null,
    expectPacket: false,
    cyber: true,

    guardOutcomeText: "downgraded suggestion to HUMAN_REVIEW",
  },
  {
    name: "ambiguous description -> HUMAN_REVIEW",
    buttonLabel: "Ambiguous case (HUMAN_REVIEW)",
    expectedStatus: "HUMAN REVIEW",
    expectedFailedRule: null,
    expectPacket: false,
    cyber: true,

    guardOutcomeText: "downgraded suggestion to HUMAN_REVIEW",
  },
  {
    name: "consumer NCH complete intake -> READY",
    buttonLabel: "Consumer NCH demo (READY)",
    expectedStatus: "READY",
    expectedFailedRule: null,
    expectPacket: true,
    guardOutcomeText: "Classification accepted by deterministic guard",
    cyber: false,
  },
  {
    name: "consumer e-Jagriti with affidavit -> READY",
    buttonLabel: "Consumer e-Jagriti demo (READY)",
    expectedStatus: "READY",
    expectedFailedRule: null,
    expectPacket: true,
    guardOutcomeText: "Classification accepted by deterministic guard",
    cyber: false,
  },
  {
    name: "consumer missing purchase evidence -> BLOCKED",
    buttonLabel: "Consumer missing evidence (BLOCKED)",
    expectedStatus: "BLOCKED",
    expectedFailedRule: "CONSUMER-INTAKE-003",
    expectPacket: true,
    guardOutcomeText: "Classification accepted by deterministic guard",
    cyber: false,
  },
  {
    name: "consumer ambiguous -> HUMAN_REVIEW",
    buttonLabel: "Consumer ambiguous (HUMAN_REVIEW)",
    expectedStatus: "HUMAN REVIEW",
    expectedFailedRule: null,
    expectPacket: false,
    guardOutcomeText: "downgraded suggestion to HUMAN_REVIEW",
    cyber: false,
  },

];

/** Minimal DevTools Protocol client (Node global WebSocket). */
class CdpSession {
  private readonly socket: WebSocket;
  private sequence = 1;
  private readonly waiting = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (typeof message.id !== "number") return;
      const pending = this.waiting.get(message.id);
      if (!pending) return;
      this.waiting.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  static async connect(url: string): Promise<CdpSession> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error(`Could not connect to ${url}`)),
        { once: true },
      );
    });
    return new CdpSession(socket);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.sequence++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const outcome = (await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    })) as { result?: { value?: unknown }; exceptionDetails?: unknown };
    if (outcome?.exceptionDetails) {
      throw new Error(`Page evaluation failed: ${JSON.stringify(outcome.exceptionDetails)}`);
    }
    return outcome?.result?.value as T;
  }

  close(): void {
    this.socket.close();
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function countSecretHits(text: string): number {
  let hits = 0;
  for (const pattern of SECRET_PATTERNS) {
    hits += text.match(pattern)?.length ?? 0;
  }
  return hits;
}

/** Recursively collect files under a directory (returns [] when absent). */
function collectFiles(dir: string): string[] {
  const found: string[] = [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return found;
  }
  for (const name of names) {
    const full = join(dir, name);
    try {
      if (statSync(full).isDirectory()) found.push(...collectFiles(full));
      else found.push(full);
    } catch {
      // Unreadable entry: it cannot be served to a browser anyway.
    }
  }
  return found;
}

async function waitForServer(): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(BASE, { method: "GET" });
      if (response.ok) return true;
    } catch {
      // Server not up yet.
    }
    await sleep(1000);
  }
  return false;
}

function findBrowser(): string | null {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Not present at this path.
    }
  }
  return null;
}

async function launchBrowser(executable: string): Promise<{ process: ChildProcess; profileDir: string }> {
  const profileDir = mkdtempSync(join(tmpdir(), "civictrail-ui-"));
  const browser = spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  return { process: browser, profileDir };
}

async function waitForPageTarget(): Promise<CdpTarget> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = (await response.json()) as CdpTarget[];
      const page = targets.find((target) => target.type === "page" && Boolean(target.webSocketDebuggerUrl));
      if (page) return page;
    } catch {
      // DevTools endpoint not ready yet.
    }
    await sleep(500);
  }
  throw new Error("Headless browser did not expose a page target");
}

/**
 * Load the CivicTrail page fresh so each case starts from a clean UI state.
 *
 * Navigation destroys the previous execution context, so this polls with short
 * evaluations (tolerating not-ready/destroyed contexts) until the new document
 * is complete and the intake form is present.
 */
async function navigateFresh(session: CdpSession): Promise<string> {
  await session.send("Page.navigate", { url: BASE });
  let observed = "no-response";
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      observed = await session.evaluate<string>(
        `document.readyState + "|" + (document.querySelector("form textarea") ? "form" : "no-form") + "|" + location.href`,
      );
      if (typeof observed === "string" && observed.startsWith("complete|form|")) return "ready";
    } catch {
      observed = "context-not-ready";
    }
    await sleep(500);
  }
  return `timeout (last observed: ${observed})`;
}

/** Click a synthetic demo button and wait until React has filled the form. */
async function loadDemo(session: CdpSession, label: string): Promise<string> {
  return session.evaluate<string>(`(async () => {
    const wanted = ${JSON.stringify(label)};
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const button = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === wanted,
      );
      if (button) {
        const area = document.querySelector('form textarea');
        const before = area ? area.value : '';
        button.click();
        await new Promise((r) => setTimeout(r, 400));
        const after = document.querySelector('form textarea');
        if (after && after.value.length > 0 && after.value !== before) return 'loaded';
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return 'timeout';
  })()`);
}

/**
 * Submit the form like a user, wait for the readiness banner, then read the
 * rendered banner, Evidence Ledger and Action Pack straight from the DOM.
 */
async function submitAndSnapshot(session: CdpSession, expectedStatus: string): Promise<UiSnapshot> {
  const raw = await session.evaluate<string>(`(async () => {
    const expected = ${JSON.stringify(expectedStatus)};
    const submitSelector = 'form button[type="submit"]';
    const submit = document.querySelector(submitSelector);
    if (!submit) return JSON.stringify({ error: 'no submit button found' });
    if (submit.disabled) return JSON.stringify({ error: 'submit button is disabled' });
    submit.click();
    // The analysis-in-progress panel must appear immediately after submit —
    // never a blank waiting screen.
    await new Promise((r) => setTimeout(r, 300));
    const analysisPanel = [...document.querySelectorAll('[role="status"]')].find((n) =>
      (n.textContent || '').toUpperCase().includes('CIVICTRAIL ANALYSIS'),
    );
    const analysisPanelText = analysisPanel ? (analysisPanel.textContent || '').toUpperCase() : '';
    const analysisPanelShown = Boolean(
      analysisPanel &&
        analysisPanelText.includes('STRANDS AGENT ACTIVE') &&
        analysisPanelText.includes('ELAPSED'),
    );
    // The triage route runs the Strands agent against a live model endpoint, so
    // a single case can legitimately take a while. Wait generously
    // rather than reporting a false timeout.
    const deadline = Date.now() + 600000;
    let banner = null;
    while (Date.now() < deadline) {
      const current = document.querySelector(submitSelector);
      const label = current ? (current.textContent || '').trim() : '';
      banner = [...document.querySelectorAll('div.rounded-xl.border')].find((d) =>
        /^(READY|BLOCKED|HUMAN REVIEW)/.test((d.textContent || '').trim()),
      );
      if (label.indexOf('Triaging') === -1 && banner) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!banner) return JSON.stringify({ error: 'timed out waiting for the readiness banner' });
    const bannerText = (banner.textContent || '').trim();
    if (bannerText.indexOf(expected) !== 0) {
      return JSON.stringify({ error: 'unexpected readiness status: ' + bannerText.slice(0, 80) });
    }
    const ledger = [...document.querySelectorAll('section')].find((s) => {
      const heading = s.querySelector('h3');
      return heading && (heading.textContent || '').trim() === 'Evidence Ledger';
    });
    const entries = ledger
      ? [...ledger.querySelectorAll('li')].map((li) => {
          const statusSpan = li.querySelector('span');
          const metaSpans = [...li.querySelectorAll('span.font-mono')];
          const ruleSpan = metaSpans.find((s) =>
            /^[A-Z][A-Z0-9-]*-[0-9]+/.test((s.textContent || '').trim()),
          );
          return {
            status: statusSpan ? (statusSpan.textContent || '').trim() : '',
            ruleId: ruleSpan ? (ruleSpan.textContent || '').trim().split(' ')[0] : '',
            text: (li.textContent || '').trim(),
          };
        })
      : [];
    const blockedStripNode = ledger
      ? [...ledger.querySelectorAll('div')].find((d) =>
          (d.textContent || '').trim().startsWith('Blocked by rule(s):'),
        )
      : null;
    const packet = [...document.querySelectorAll('section')].find((s) => {
      const heading = s.querySelector('h3');
      return heading && (heading.textContent || '').trim() === 'Action Pack';
    });
    // After the result arrives, the progress panel must be unmounted entirely
    // and only the completion strip must remain.
    const analysisPanelAfterResult = [...document.querySelectorAll('[role="status"]')].find((n) =>
      (n.textContent || '').toUpperCase().includes('CIVICTRAIL ANALYSIS'),
    );
    const analysisCompleteShown = [...document.querySelectorAll('[role="status"]')].some((n) =>
      (n.textContent || '').toUpperCase().includes('ANALYSIS COMPLETE'),
    );
    return JSON.stringify({
      banner: bannerText,
      entries: entries,
      blockedStrip: blockedStripNode ? (blockedStripNode.textContent || '').trim() : null,
      packet: packet ? (packet.textContent || '').trim() : null,
      analysisPanelShown,
      analysisPanelGoneAfterResult: !analysisPanelAfterResult,
      analysisCompleteShown,
      html: document.documentElement.outerHTML,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scriptSrcs: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src') || ''),
    });
  })()`);
  return JSON.parse(raw) as UiSnapshot;
}

interface ReadabilityInfo {
  filledTextareas: number;
  filledInputs: number;
  valueColor: RgbaTuple;
  valueBackground: RgbaTuple;
  valueWeight: string | null;
  placeholderColor: RgbaTuple | null;
  placeholderBackground: RgbaTuple | null;
  notice: string | null;
  truncation: Array<{ id: string; overflow: number }>;
  error?: string;
}

interface RgbColor {
  rgb: [number, number, number];
  alpha: number;
}

/** Parse an rgb()/rgba() color string; returns null for non-rgb formats. */
function parseColor(color: string): RgbColor | null {
  const parts = color.match(/\d+(?:\.\d+)?/g);
  if (!parts || parts.length < 3) return null;
  return {
    rgb: [Number(parts[0]), Number(parts[1]), Number(parts[2])],
    alpha: parts.length > 3 ? Number(parts[3]) : 1,
  };
}

function srgbChannel(channel: number): number {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: [number, number, number]): number {
  return 0.2126 * srgbChannel(rgb[0]) + 0.7152 * srgbChannel(rgb[1]) + 0.0722 * srgbChannel(rgb[2]);
}

/** WCAG contrast ratio between two opaque colors. */
function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Blend a possibly translucent color over the CivicTrail navy base #010828. */
function blendOverNavy(color: RgbColor): [number, number, number] {
  const base: [number, number, number] = [1, 8, 40];
  return [
    color.rgb[0] * color.alpha + base[0] * (1 - color.alpha),
    color.rgb[1] * color.alpha + base[1] * (1 - color.alpha),
    color.rgb[2] * color.alpha + base[2] * (1 - color.alpha),
  ];
}

/**
 * Effective text contrast of a color string against a background color string.
 * Translucent text (e.g. `text-cream/55`) is composited over the surface first,
 * so the measured ratio matches what a reader actually sees on screen.
 */
function textContrast(textColor: string, bgColor: string): number | null {
  const text = parseColor(textColor);
  const bg = parseColor(bgColor);
  if (!text || !bg) return null;
  const surface = blendOverNavy(bg);
  const foreground: [number, number, number] = [
    text.rgb[0] * text.alpha + surface[0] * (1 - text.alpha),
    text.rgb[1] * text.alpha + surface[1] * (1 - text.alpha),
    text.rgb[2] * text.alpha + surface[2] * (1 - text.alpha),
  ];
  return contrastRatio(foreground, surface);
}

interface RgbaTuple {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ContrastSample {
  label: string;
  text: RgbaTuple;
  surface: RgbaTuple;
}

/** Flatten a translucent surface onto the CivicTrail navy base. */
function flattenOverNavy(color: RgbaTuple): [number, number, number] {
  const base: [number, number, number] = [1, 8, 40];
  return [
    color.r * color.a + base[0] * (1 - color.a),
    color.g * color.a + base[1] * (1 - color.a),
    color.b * color.a + base[2] * (1 - color.a),
  ];
}

/**
 * Text-over-surface contrast for numeric rgba samples. The text alpha is
 * composited over the surface so translucent Tailwind colors are measured the
 * way a reader actually perceives them.
 */
function tupleContrast(text: RgbaTuple, surface: RgbaTuple): number {
  const bg = flattenOverNavy(surface);
  const fg: [number, number, number] = [
    text.r * text.a + bg[0] * (1 - text.a),
    text.g * text.a + bg[1] * (1 - text.a),
    text.b * text.a + bg[2] * (1 - text.a),
  ];
  return contrastRatio(fg, bg);
}

/**
 * Sample the headline presentation text (hero, section headings, field labels,
 * status banner, ledger, Action Pack) together with the surface each one sits
 * on. Colors are resolved through a canvas, which normalizes modern CSS color
 * serializations (e.g. Tailwind's `color(srgb ...)` output for `text-cream/85`)
 * into plain sRGB numbers.
 */
async function sampleKeyText(session: CdpSession): Promise<ContrastSample[]> {
  const raw = await session.evaluate<string>(
    `(JSON.stringify((function () {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      function toRgba(value) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2], a: data[3] / 255 };
      }
      function surface(node) {
        let current = node;
        while (current && current.nodeType === 1) {
          const sampled = toRgba(getComputedStyle(current).backgroundColor);
          if (sampled.a >= 0.5) return sampled;
          current = current.parentElement;
        }
        return { r: 1, g: 8, b: 40, a: 1 };
      }
      function sample(label, node) {
        if (!node) return null;
        return { label: label, text: toRgba(getComputedStyle(node).color), surface: surface(node) };
      }
      const sections = [...document.querySelectorAll('section')];
      const byHeading = (text) =>
        sections.find((s) => {
          const h = s.querySelector('h3');
          return h && (h.textContent || '').trim() === text;
        });
      const ledger = byHeading('Evidence Ledger');
      const packet = byHeading('Action Pack');
      return [
        sample('hero headline', document.querySelector('h1')),
        sample('hero accent phrase', document.querySelector('#home .font-accent')),
        sample('section heading', document.querySelector('#how-it-works h2')),
        sample('field label', document.querySelector('#start-a-case label')),
        sample(
          'status banner',
          [...document.querySelectorAll('div.rounded-xl.border')].find((d) =>
            /^(READY|BLOCKED|HUMAN REVIEW)/.test((d.textContent || '').trim()),
          ),
        ),
        sample('ledger claim', ledger ? ledger.querySelector('li span.text-sm') : null),
        sample('ledger provenance', ledger ? ledger.querySelector('li div.font-mono') : null),
        sample('action pack text', packet ? packet.querySelector('p.font-mono') : null),
        sample(
          'human confirmation notice',
          packet
            ? [...packet.querySelectorAll('*')].find(
                (n) => n.children.length === 0 && (n.textContent || '').includes('Requires human confirmation'),
              )
            : null,
        ),
      ].filter(Boolean);
    })()))`,
  );
  return JSON.parse(raw) as ContrastSample[];
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Computed-style probe: loaded values must be high-contrast; placeholders dimmer. */
async function checkReadability(session: CdpSession): Promise<ReadabilityInfo> {
  const raw = await session.evaluate<string>(
    `(JSON.stringify((function () {
      const controls = [...document.querySelectorAll('form textarea, form input')];
      const filledTextareas = controls.filter((c) => c.tagName === 'TEXTAREA' && c.value.trim().length > 0);
      const filledInputs = controls.filter((c) => c.tagName === 'INPUT' && c.value.trim().length > 0);
      const emptyWithPlaceholder = controls.filter((c) => c.placeholder && c.value.trim().length === 0);
      const target = filledInputs[0] || filledTextareas[0];
      if (!target) return { error: 'no filled control after demo load' };
      const notice = document.querySelector('[role="status"]');
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      const toRgba = (value) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2], a: data[3] / 255 };
      };
      return {
        filledTextareas: filledTextareas.length,
        filledInputs: filledInputs.length,
        valueColor: toRgba(getComputedStyle(target).color),
        valueBackground: toRgba(getComputedStyle(target).backgroundColor),
        valueWeight: filledInputs[0] ? getComputedStyle(filledInputs[0]).fontWeight : null,
        placeholderColor: emptyWithPlaceholder[0]
          ? toRgba(getComputedStyle(emptyWithPlaceholder[0], '::placeholder').color)
          : null,
        placeholderBackground: emptyWithPlaceholder[0]
          ? toRgba(getComputedStyle(emptyWithPlaceholder[0]).backgroundColor)
          : null,
        notice: notice ? (notice.textContent || '').trim() : null,
        truncation: filledTextareas.map((c) => ({
          id: c.id || '(unnamed)',
          overflow: c.scrollHeight - c.clientHeight,
        })),
      };
    })()))`,
  );
  return JSON.parse(raw) as ReadabilityInfo;
}

async function screenshot(
  session: CdpSession,
  path: string,
  fullPage = true,
): Promise<void> {
  const shot = (await session.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: fullPage,
  })) as { data?: string };
  if (shot?.data) writeFileSync(path, Buffer.from(shot.data, "base64"));
}


let failures = 0;
function check(ok: boolean, detail: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? "  ok" : "  FAIL"} - ${detail}`);
}

async function main(): Promise<void> {
  if (typeof WebSocket === "undefined") {
    throw new Error("This check needs Node 22+ (global WebSocket).");
  }
  const executable = findBrowser();
  if (!executable) {
    throw new Error(
      `No Chrome/Edge found. Set CIVICTRAIL_CHROME to a browser path. Tried: ${CHROME_CANDIDATES.join(", ")}`,
    );
  }
  if (!(await waitForServer())) {
    throw new Error(`CivicTrail dev server is not reachable at ${BASE} - run "npm run dev" first.`);
  }

  console.log(`Real browser: ${executable}`);
  mkdirSync(SHOT_DIR, { recursive: true });

  const { process: browser, profileDir } = await launchBrowser(executable);
  let session: CdpSession | null = null;

  try {
    const target = await waitForPageTarget();
    session = await CdpSession.connect(target.webSocketDebuggerUrl ?? "");
    await session.send("Page.enable");
    await session.send("Runtime.enable");

    let renderedHtml = "";
    const scriptSources = new Set<string>();

    // The browser starts on about:blank, so nothing from CivicTrail — including
    // the cinematic section videos — exists until the page is really loaded.
    const initialNavigation = await navigateFresh(session);
    if (initialNavigation !== "ready") {
      throw new Error(`Page did not load for the cinematic-section probe: ${initialNavigation}`);
    }

    const videoInfo = await session.evaluate<string>(
      `(JSON.stringify([...document.querySelectorAll('video')].map(function (v) {
        const source = v.querySelector('source');
        return {
          autoplay: v.autoplay,
          loop: v.loop,
          muted: v.muted,
          playsInline: v.playsInline,
          src: source ? source.getAttribute('src') : null,
        };
      })))`,
    );
    interface VideoInfo {
      autoplay: boolean;
      loop: boolean;
      muted: boolean;
      playsInline: boolean;
      src: string | null;
    }
    const videos = JSON.parse(videoInfo) as VideoInfo[];
    check(videos.length >= 2, `cinematic section videos rendered (${videos.length})`);
    check(
      videos.every((v) => v.autoplay && v.loop && v.muted && v.playsInline),
      "section videos autoplay, loop, stay muted and playsInline",
    );
    check(
      videos.every((v) => (v.src ?? "").startsWith("https://") && (v.src ?? "").endsWith(".mp4")),
      "section videos load the supplied motion-background assets",
    );

    interface DesignProbe {
      heroHeading: string;
      heroHasVideo: boolean;
      heroHasVeil: boolean;
      heroColor: string;
      accentFont: string;
      displayFont: string;
      monoFont: string;
      bodyBackground: string;
      placeholder: RgbaTuple | null;
      placeholderSurface: RgbaTuple | null;
      fieldValueColor: RgbaTuple | null;
    }
    const designProbe = JSON.parse(
      await session.evaluate<string>(
        `(JSON.stringify((function () {
          const font = (selector) => {
            const node = document.querySelector(selector);
            return node ? getComputedStyle(node).fontFamily : '';
          };
          const hero = document.querySelector('#home');
          const heading = document.querySelector('h1');
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d');
          const toRgba = (value) => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = value;
            ctx.fillRect(0, 0, 1, 1);
            const data = ctx.getImageData(0, 0, 1, 1).data;
            return { r: data[0], g: data[1], b: data[2], a: data[3] / 255 };
          };
          const emptyField = [...document.querySelectorAll('#start-a-case textarea')].find(
            (t) => t.value.trim().length === 0,
          );
          return {
            heroHeading: heading ? (heading.textContent || '').trim() : '',
            heroHasVideo: Boolean(hero && hero.querySelector('video')),
            heroHasVeil: Boolean(hero && hero.querySelector('.video-veil')),
            heroColor: heading ? getComputedStyle(heading).color : '',
            accentFont: font('#home .font-accent'),
            displayFont: font('h1'),
            monoFont: font('.font-mono'),
            bodyBackground: getComputedStyle(document.body).backgroundColor,
            placeholder: emptyField ? toRgba(getComputedStyle(emptyField, '::placeholder').color) : null,
            placeholderSurface: emptyField ? toRgba(getComputedStyle(emptyField).backgroundColor) : null,
            fieldValueColor: emptyField ? toRgba(getComputedStyle(emptyField).color) : null,
          };
        })()))`,
      ),
    ) as DesignProbe;

    check(
      designProbe.heroHeading.toLowerCase().includes("action-ready"),
      `hero headline keeps the CivicTrail proposition ("${designProbe.heroHeading}")`,
    );
    check(designProbe.heroHasVideo, "hero renders its cinematic background video");
    check(designProbe.heroHasVeil, "hero keeps a dark overlay so no text sits on a bright frame");
    const heroContrast = textContrast(designProbe.heroColor, "rgb(1, 8, 40)");
    check(
      heroContrast !== null && heroContrast >= 4.5,
      `hero headline stays high-contrast over the dark field (ratio ${heroContrast ?? "n/a"})`,
    );
    check(/Anton/i.test(designProbe.displayFont), `major headings use the Anton display face (${designProbe.displayFont})`);
    check(/Condiment/i.test(designProbe.accentFont), `accent phrases use the Condiment face (${designProbe.accentFont})`);
    check(/mono/i.test(designProbe.monoFont), `descriptive copy uses a monospace face (${designProbe.monoFont})`);
    const bodyContrast = textContrast("rgb(239, 244, 255)", designProbe.bodyBackground);
    check(
      designProbe.bodyBackground.replace(/\s+/g, "") === "rgb(1,8,40)",
      `page sits on the deep navy visual base (${designProbe.bodyBackground})`,
    );
    check(
      bodyContrast !== null && bodyContrast >= 4.5,
      `cream text on the navy base is high-contrast (ratio ${bodyContrast ?? "n/a"})`,
    );

    const placeholder = designProbe.placeholder;
    const placeholderSurface = designProbe.placeholderSurface;
    const fieldValueColor = designProbe.fieldValueColor;
    if (!placeholder || !placeholderSurface || !fieldValueColor) {
      failures += 1;
      console.log("  FAIL - empty intake field could not be sampled for placeholder contrast");
    } else {
      const placeholderRatio = tupleContrast(placeholder, placeholderSurface);
      const valueRatio = tupleContrast(fieldValueColor, placeholderSurface);
      check(
        valueRatio >= 4.5,
        `empty-field value color is high-contrast, so loaded values never look like placeholders (ratio ${valueRatio.toFixed(2)})`,
      );
      check(
        placeholderRatio >= 3,
        `placeholder text stays legible but subdued (ratio ${placeholderRatio.toFixed(2)})`,
      );
      check(
        placeholderRatio < valueRatio - 1,
        `placeholder is visibly dimmer than an actual value (${placeholderRatio.toFixed(2)} vs ${valueRatio.toFixed(2)})`,
      );
    }

    for (const uiCase of UI_CASES) {
      console.log(`\n${uiCase.name}`);
      const navigation = await navigateFresh(session);
      if (navigation !== "ready") {
        throw new Error(`Page did not load for case "${uiCase.name}": ${navigation}`);
      }
      const loaded = await loadDemo(session, uiCase.buttonLabel);
      if (loaded !== "loaded") {
        throw new Error(`Demo button "${uiCase.buttonLabel}" did not populate the form`);
      }
      const readability = await checkReadability(session);
      if (readability.error) {
        failures += 1;
        console.log(`  FAIL - readability probe: ${readability.error}`);
      } else {
        const valueContrast = tupleContrast(readability.valueColor, readability.valueBackground);
        check(
          valueContrast >= 4.5,
          `loaded value text is high-contrast over its surface (ratio ${valueContrast.toFixed(2)})`,
        );
        if (readability.valueWeight !== null) {
          check(
            Number(readability.valueWeight) >= 500,
            `loaded values are visually emphasized (font-weight ${readability.valueWeight})`,
          );
        }
        if (readability.placeholderColor && readability.placeholderBackground) {
          const placeholderContrast = tupleContrast(
            readability.placeholderColor,
            readability.placeholderBackground,
          );
          check(
            placeholderContrast >= 3 &&
              placeholderContrast < valueContrast &&
              valueContrast - placeholderContrast > 3,
            `placeholder stays legible yet clearly dimmer than loaded values (ratio ${placeholderContrast.toFixed(2)} vs ${valueContrast.toFixed(2)})`,
          );
        }
        check(
          readability.notice !== null && readability.notice.includes("Synthetic demo case"),
          "synthetic-data notice rendered for the loaded demo",
        );
        check(
          readability.notice !== null && readability.notice.includes("Demo case loaded"),
          "demo-loaded confirmation rendered for the loaded demo",
        );
        const clipped = readability.truncation.filter((item) => item.overflow > 2);
        check(
          clipped.length === 0,
          `no textarea truncates its loaded value (${clipped.length} clipped of ${readability.truncation.length})`,
        );
      }
      await screenshot(session, join(SHOT_DIR, `${slug(uiCase.name)}-form.png`));

      const snapshot = await submitAndSnapshot(session, uiCase.expectedStatus);
      if (snapshot.error) {
        failures += 1;
        console.log(`  FAIL - ${snapshot.error}`);
        continue;
      }

      renderedHtml += snapshot.html;
      for (const src of snapshot.scriptSrcs) scriptSources.add(src);
      check(
        snapshot.overflowX <= 1,
        `no horizontal overflow (overflowX=${snapshot.overflowX}px)`,
      );
      await screenshot(session, join(SHOT_DIR, `${slug(uiCase.name)}-result.png`));

      const keyText = await sampleKeyText(session);
      if (keyText.length === 0) {
        failures += 1;
        console.log("  FAIL - key presentation text could not be sampled");
      }
      for (const item of keyText) {
        const ratio = tupleContrast(item.text, item.surface);
        check(
          ratio >= 4.5,
          `${item.label} stays readable on its surface (ratio ${ratio.toFixed(2)})`,
        );
      }


      const failedRules = snapshot.entries.filter((e) => e.status === "fail").map((e) => e.ruleId);
      const passedRules = snapshot.entries.filter((e) => e.status === "pass").map((e) => e.ruleId);
      const portalSourced = snapshot.entries.filter((e) =>
        e.text.includes("National Cyber Crime Reporting Portal"),
      ).length;

      check(
        snapshot.banner.startsWith(uiCase.expectedStatus),
        `banner shows ${uiCase.expectedStatus} (got "${snapshot.banner.slice(0, 24)}")`,
      );
      check(snapshot.banner.includes(uiCase.guardOutcomeText), `guard outcome visible: "${uiCase.guardOutcomeText}"`);
      check(
        snapshot.analysisPanelShown,
        "analysis-in-progress panel appeared immediately with agent-active status and elapsed timer",
      );
      check(snapshot.analysisPanelGoneAfterResult, "analysis panel is replaced once the result arrives");
      check(
        snapshot.analysisCompleteShown,
        "analysis-complete strip bridges the panel and the readiness result",
      );
      if (uiCase.expectedFailedRule === null) {
        check(failedRules.length === 0, `no failed deterministic rule (failed=[${failedRules.join(",")}])`);
      } else {
        check(
          failedRules.includes(uiCase.expectedFailedRule),
          `ledger shows failed rule ${uiCase.expectedFailedRule} (failed=[${failedRules.join(",")}])`,
        );
        check(
          snapshot.blockedStrip !== null &&
            snapshot.blockedStrip.includes(uiCase.expectedFailedRule),
          `result headline exposes the failed rule ID (strip: "${snapshot.blockedStrip ?? "none"}")`,
        );
      }
      if (uiCase.expectPacket) {
        check(
          passedRules.length > 0,
          `passing ledger evidence preserved (${passedRules.length} passing: ${passedRules.join(",")})`,
        );
      } else {
        const reviewEntries = snapshot.entries.filter((e) => e.status === "review").length;
        check(reviewEntries >= 1, `ledger shows the unresolved-classification review entry (${reviewEntries})`);
      }
      if (uiCase.expectPacket) {
        check(
          snapshot.packet !== null && snapshot.packet.includes("Requires human confirmation"),
          "Action Pack rendered and still requires human confirmation",
        );
        check(
          portalSourced >= (uiCase.cyber ? 10 : 0),
          `ledger names the National Cyber Crime Reporting Portal (${portalSourced} entries)`,
        );
      } else {
        check(snapshot.packet === null, "no Action Pack for an unresolved classification");
        check(
          snapshot.banner.includes("No Action Pack was generated"),
          "HUMAN REVIEW result states explicitly that no Action Pack was generated",
        );
        check(
          snapshot.banner.includes("requires human confirmation"),
          "HUMAN REVIEW result still requires human confirmation",
        );
      }
    }


    console.log("\nMobile viewport (390x844)");
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    const mobileNavigation = await navigateFresh(session);
    if (mobileNavigation !== "ready") {
      throw new Error(`Page did not load at the mobile viewport: ${mobileNavigation}`);
    }
    const mobileOverflow = await session.evaluate<string>(
      "(document.documentElement.scrollWidth - document.documentElement.clientWidth)",
    );
    check(
      Number(mobileOverflow) <= 1,
      `no horizontal overflow at mobile width (overflow=${mobileOverflow}px)`,
    );
    const mobileForm = await session.evaluate<string>(
      "(document.querySelector('form textarea') ? 'yes' : 'no')",
    );
    check(mobileForm === "yes", "intake form remains present and usable at mobile width");
    const mobileNav = await session.evaluate<string>(
      `(function () {
        const desktop = document.querySelector('nav[aria-label="Primary"]');
        if (!desktop) return 'missing';
        return window.getComputedStyle(desktop).display === 'none' ? 'hidden' : 'visible';
      })()`,
    );
    check(mobileNav === "hidden", `desktop navigation is hidden at mobile width (${mobileNav})`);
    const smallestButton = await session.evaluate<string>(
      `(function () {
        const buttons = [...document.querySelectorAll('#start-a-case button')].filter(
          (b) => b.offsetParent !== null,
        );
        if (buttons.length === 0) return 'none';
        return String(
          Math.round(Math.min(...buttons.map((b) => b.getBoundingClientRect().height))),
        );
      })()`,
    );
    check(
      smallestButton !== "none" && Number(smallestButton) >= 30,
      `demo and submit buttons stay touch-friendly on mobile (smallest height ${smallestButton}px)`,
    );
    const mobileDemoValues = await session.evaluate<string>(
      `(function () {
        const area = document.querySelector('form textarea');
        return area ? String(Math.round(parseFloat(getComputedStyle(area).fontSize))) : 'none';
      })()`,
    );
    check(
      mobileDemoValues !== "none" && Number(mobileDemoValues) >= 12,
      `intake values keep a legible font size on mobile (${mobileDemoValues}px)`,
    );
    // Viewport-only capture: a 390px-wide full-page raster is extremely tall,
    // and compositing every backdrop-filter at once can stall the renderer.
    await screenshot(session, join(SHOT_DIR, "mobile-hero.png"), false);
    await session.send("Emulation.clearDeviceMetricsOverride");

    console.log("\nSecret scan");
    const htmlHits = countSecretHits(renderedHtml);
    check(htmlHits === 0, `no secret pattern in rendered HTML (hits=${htmlHits})`);

    let clientJsHits = 0;
    let scannedChunks = 0;
    for (const src of scriptSources) {
      const url = src.startsWith("http") ? src : `${BASE}${src}`;
      try {
        const text = await (await fetch(url)).text();
        scannedChunks += 1;
        clientJsHits += countSecretHits(text);
      } catch {
        check(false, `could not fetch client chunk ${src}`);
      }
    }
    check(clientJsHits === 0, `no secret in ${scannedChunks} served client chunk(s) (hits=${clientJsHits})`);

    const staticFiles = collectFiles(STATIC_DIR).filter((file) => file.endsWith(".js"));
    let staticHits = 0;
    for (const file of staticFiles) {
      staticHits += countSecretHits(readFileSync(file, "utf8"));
    }
    check(
      staticHits === 0,
      `no secret in ${staticFiles.length} built client JS file(s) under ${STATIC_DIR} (hits=${staticHits})`,
    );

    console.log(failures === 0 ? "\nALL REAL-BROWSER CHECKS PASSED" : `\n${failures} REAL-BROWSER CHECK(S) FAILED`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    session?.close();
    browser.kill();
    await sleep(500);
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // Temporary profile cleanup is best effort.
    }
  }
}

main().catch((error: unknown) => {
  console.error("Real-browser check crashed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
