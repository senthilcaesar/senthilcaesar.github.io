#!/usr/bin/env node
// Pre-renders the terminal's voice-over with Kokoro (af_heart).
//
// It runs the real js/terminal.js in a sandbox, collects the spoken text of
// every fixed command output, renders each one to audio/terminal/*.m4a and
// writes audio/terminal/clips.js ({ fingerprint: file }). The page plays
// a clip only when its fingerprint matches the text it is about to read, so
// after editing an output, re-run this script; until then that output falls
// back to the browser voice.
//
// Outputs that change are spoken from smaller pieces (the page's
// speechPieces): experience line by line, date from "Today is Monday," +
// "November" + "sixteenth," + "2026.". With a simulated clock this script
// pre-renders every piece for the next MONTHS_AHEAD months / YEARS_AHEAD
// years, so re-run it now and then to keep them in Kokoro.
//
//   node tools/terminal-voice/build.js            # render what's missing
//   node tools/terminal-voice/build.js --list     # print the texts, render nothing
//   node tools/terminal-voice/build.js --force    # re-render everything
//
// Needs ffmpeg and the Kokoro Python env (default ~/.cache/demo-video-tts,
// override with KOKORO_PY=/path/to/python).

const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "audio/terminal");
const VOICE = "af_heart";
const SPEED = 0.83;
const KOKORO_PY =
  process.env.KOKORO_PY || path.join(os.homedir(), ".cache/demo-video-tts/bin/python");

const MONTHS_AHEAD = 36; // experience: durations change monthly
const YEARS_AHEAD = 5; // date

// Commands whose output is fixed: one clip each.
const COMMANDS = [
  "hello", "about", // not "help": it isn't read aloud
  "identity", "skills", "softskills", "principles",
  "character", "presentation", "hobbies", "favorites", "education", "certifications", "links",
  "contact", "blog", "reading", "garden", "projects", "project",
  "project 1", "project 2", "project 3", "weather",
  ...["auto", "none", "rain", "sun-rising", "snowing", "summer", "windy",
      "cloudy", "fall", "moon", "matrix"].map((m) => `weather ${m}`),
  "theme", "theme", // once into dark, once back to light
  "voice on", "voice off", "voice blah",
  "matrix", "gravity", "antigravity", "sudo", "sudo destroy", "exit",
  "not-a-command",
];

// How Kokoro should say the text, following the demo-video skill's
// pronunciation rules (references/scene-authoring.md › Pronunciation).
// Applied to the audio only; the fingerprint is taken from the page's own
// text. Rules run in order and never inside a [word](/…/) span an earlier
// rule made, so possessives come before their base word.
// Audit after any change: node build.js --json, then check every word's
// phonemes with misaki (❓ = dropped, ᵻ = may mumble, no ˈ on an opener =
// rushed cold start).
const PRONOUNCE = [
  // Cold starts: every clip, and every part after a list number's pause, is
  // rendered on its own, so an unstressed first word gets rushed. Stress it.
  [/^I'm\b/, "[I'm](/ˈIm/)"],
  [/^I've\b/, "[I've](/ˈIv/)"],
  [/^I\b/, "[I](/ˈI/)"],
  [/^Make\b/, "[Make](/mˈAk/)"],
  [/^When\b/, "[When](/wˈɛn/)"],
  [/^A\b/, "[A](/ˈA/)"],
  [/^Today is\b/, "[Today](/tʊdˈA/) is"], // "Today is Tuesday" came out "Other day is"

  // URLs and addresses, said the way a person would.
  [/\bsenthilcaesar\.github\.io\/([\w-]+)\/?/g,
    "[senthil](/sˈɛnθɪl/) [caesar](/sˈizəɹ/) dot [github](/ɡˈɪthʌb/) dot I-O slash $1"],
  [/\bsenthilcaesar\.github\.io\b/g,
    "[senthil](/sˈɛnθɪl/) [caesar](/sˈizəɹ/) dot [github](/ɡˈɪthʌb/) dot I-O"],
  [/\bsenthilcaesar@gmail\.com\b/g,
    "[senthil](/sˈɛnθɪl/) [caesar](/sˈizəɹ/) at G mail dot com"],

  // Codes and numbers, said the way a person would.
  [/\b(\d+)-(\d+)\b/g, "$1 to $2"],
  [/m\/s²/g, " meters per second squared"],
  [/\bCI\/CD\b/g, "C-I C-D"],

  // Names outside Kokoro's lexicon are dropped silently: spell them.
  // Possessives first.
  [/\bSenthil's\b/g, "[Senthil's](/sˈɛnθɪlz/)"],
  [/\bSenthilCaesar\b/g, "[Senthil](/sˈɛnθɪl/) [Caesar](/sˈizəɹ/)"],
  [/\bSenthil\b/g, "[Senthil](/sˈɛnθɪl/)"],
  [/\bPalanivelu\b/g, "[Palanivelu](/pˌɑlənɪvˈAlu/)"],
  [/\bUMass\b/g, "[UMass](/jˈu mˈæs/)"],
  [/\bAgentic\b/g, "[Agentic](/Aʤˈɛntɪk/)"], // the skill's verified spelling
  [/\bAppalachia\b/g, "[Appalachia](/ˌæpəlˈAʧə/)"],
  [/\bBengaluru\b/g, "[Bengaluru](/bˈɛŋɡəlˌuɹu/)"],
  [/\bCoursera\b/g, "[Coursera](/kɔɹsˈɛɹə/)"],
  [/\bDespa\b/g, "[Despa](/dˈɛspə/)"],
  [/\bMphasiS\b/g, "[Mphasis](/ɛmfˈAsɪs/)"],
  [/\bNeo\b/g, "[Neo](/nˈiO/)"],
  [/\bNetlify\b/g, "[Netlify](/nˈɛtlɪfˌI/)"],
  [/\bNumPy\b/g, "[NumPy](/nˈʌm pˈI/)"],
  [/\bOllama\b/g, "[Ollama](/olˈɑmə/)"],
  [/\bStanford\b/g, "[Stanford](/stˈænfəɹd/)"],
  [/\bUdemy\b/g, "[Udemy](/jˈudəmi/)"],
  [/\bValentin\b/g, "[Valentin](/vˈæləntɪn/)"],
  [/\bZustand\b/g, "[Zustand](/tsˈuʃtɑnt/)"],
  [/\bTarento\b/g, "[Tarento](/təɹˈɛntO/)"],
  [/\bAmudham\b/g, "[Amudham](/əmˈʊdəm/)"],
  [/\bBrigham\b/g, "[Brigham](/bɹˈɪɡəm/)"],
  [/\bBioinformatician\b/g, "[Bioinformatician](/bˌIOˌɪnfəɹmətˈɪʃən/)"],
  [/\bChennai\b/g, "[Chennai](/ʧɛnˈI/)"],
  [/\bPune\b/g, "[Pune](/pˈunA/)"],
  [/\bIT\b/g, "I-T"], // not the word "it"
  [/ II\b/g, " two"], // job grades: "Coordinator II"
  [/ I(?=,| \()/g, " one"], // "Bioinformatician I," "Analyst I ("
  [/\bGithub\b/g, "GitHub"],
  [/\bJupyter\b/g, "Jupiter"],
  [/\bsudo\b/g, "[sudo](/sˈudu/)"],

  // Compounds: split them so each part is said, and stressed, clearly.
  [/\bLangFuse\b/g, "[Lang](/lˈæŋ/) Fuse"],
  [/\bLangGraph\b/g, "[Lang](/lˈæŋ/) Graph"],
  [/\bThreeJS\b/g, "Three J-S"],
  [/\bNext\.js\b/g, "Next J-S"],
  [/\bNode\.js\b/g, "Node J-S"],
  [/\bXGBoost\b/g, "X-G Boost"],
  [/\bPyTorch\b/g, "Pie Torch"],
  [/\bPyMuPDF\b/g, "Pie Mew P-D-F"],
  [/\bMATLAB\b/g, "Mat Lab"],
  [/\bR Shiny\b/g, "R-Shiny"],
  [/\bWebGL\b/g, "Web G-L"],
  [/\bDeepLearning\.AI\b/g, "Deep Learning dot AI"],
  [/\bOpenAI\b/g, "Open AI"],
  [/\bFastAPI\b/g, "Fast [API](/ˌApˌiˈI/)"],
  [/\bKnowledgeLab\b/g, "Knowledge Lab"],
  [/\bWanderlist\b/g, "Wander list"],
  [/\bsoftskills\b/g, "soft skills"],
  [/\bantigravity\b/g, "anti gravity"],
  [/\bFrontend\b/g, "Front end"],
  [/\bMatplotlib\b/g, "Mat plot lib"],
  [/\bPinecone\b/g, "Pine cone"],
  [/\b[Ss]cikit-learn\b/g, "Sigh kit learn"],
  [/\bSeaborn\b/g, "Sea born"],
  [/\bStreamlit\b/g, "Stream lit"],
  [/\bflat-shaded\b/g, "flat [shaded](/ʃˈAdəd/)"],

  // Acronyms. Kokoro spells most capitals by itself; these it misreads.
  // (Hyphenated letters don't work here: a leading "A-" is read as "uh".)
  [/\bAPIs\b/g, "[APIs](/ˌApˌiˈIz/)"],
  [/\bAPI\b/g, "[API](/ˌApˌiˈI/)"],
  [/\bAWS\b/g, "[AWS](/ˌAdˌʌbᵊljuˈɛs/)"], // not "awes"
  [/\bVS\b/g, "[VS](/vˌiˈɛs/)"], // not "viz"
  [/\bJSON\b/g, "[JSON](/ʤˈAsən/)"], // "Jason", not J-S-O-N
  [/\bRAG\b/g, "[RAG](/ɹˈæɡ/)"],
  [/\bLLMs\b/g, "[LLMs](/ˌɛlˌɛlˈɛmz/)"],

  // The reduced vowel ᵻ can come out mumbled: respell it with ə.
  ...Object.entries({
    accumulated: "əkjˈumjəlˌATəd", advantages: "ədvˈæntɪʤəz",
    courses: "kˈɔɹsəz", encourages: "ɪnkˈɜɹɪʤəz", experiences: "ɪkspˈɪɹiənsəz",
    floated: "flˈOTəd", greatest: "ɡɹˈATəst", initiated: "ɪnˈɪʃiˌATəd",
    languages: "lˈæŋɡwɪʤəz", latest: "lˈATəst", loaded: "lˈOdəd",
    oriented: "ˈɔɹiəntəd", phrases: "fɹˈAzəz", resizes: "ɹisˈIzəz",
    resources: "ɹˈisˌɔɹsəz", summarizes: "sˈʌməɹˌIzəz",
  }).map(([word, ipa]) => [new RegExp(`\\b${word}\\b`, "gi"), `[$&](/${ipa}/)`]),

  [/\/\s*/g, " "],
];

function collect() {
  const noop = () => {};
  // A do-anything DOM stand-in: every property is another stub.
  const stub = () =>
    new Proxy(function () {}, {
      get: (t, k) => {
        if (k === "querySelectorAll") return () => [];
        if (k === Symbol.toPrimitive) return () => "";
        return stub();
      },
      apply: () => stub(),
      set: () => true,
    });
  const bodyClasses = new Set();
  const body = new Proxy(
    {
      classList: {
        contains: (c) => bodyClasses.has(c),
        add: (c) => bodyClasses.add(c),
        remove: (c) => bodyClasses.delete(c),
      },
    },
    { get: (t, k) => (k in t ? t[k] : stub()) },
  );
  let exported = null;
  const window = {
    innerWidth: 1280,
    innerHeight: 800,
    open: noop,
    setWeather: noop,
    openReadingModal: noop,
    toggleTheme: () =>
      bodyClasses.has("dark-mode") ? bodyClasses.delete("dark-mode") : bodyClasses.add("dark-mode"),
    addEventListener: noop,
    matchMedia: () => ({ matches: false }),
    getSelection: () => null,
    Audio: function () {},
    __collectTerminalVoice: (api) => (exported = api),
  };
  const document = {
    getElementById: () => stub(),
    querySelectorAll: () => [],
    addEventListener: noop,
    createElement: () => stub(),
    body,
  };
  // A clock the script can move, so date-dependent output can be simulated.
  let fakeNow = Date.now();
  class FakeDate extends Date {
    constructor(...args) {
      if (args.length) super(...args);
      else super(fakeNow);
    }
    static now() {
      return fakeNow;
    }
  }
  const context = {
    window, document, Date: FakeDate,
    localStorage: { getItem: () => null, setItem: noop },
    fetch: () => Promise.resolve({ ok: false }),
    setTimeout: noop, console, Audio: window.Audio,
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/terminal.js"), "utf8"), context);
  if (!exported) throw new Error("terminal.js did not call __collectTerminalVoice");

  const htmls = [
    ["welcome", exported.welcomeHTML],
    ["voice-on", exported.voiceOnMessage],
    ...COMMANDS.map((c) => [c, exported.executeCommand(c)]),
    ...exported.qaAnswers.map((a, i) => [`qa-${i + 1}`, a]),
  ];
  const items = new Map();
  const add = (name, text, tight = false) => {
    if (!text) return;
    const key = exported.speechFingerprint(text);
    if (items.has(key)) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    items.set(key, { key, text, tight, file: `${slug}-${key}.m4a` });
  };
  for (const [name, html] of htmls) {
    if (html) add(name, exported.htmlToSpeech(html));
  }

  // Pieces for outputs that change. A whole line gets normal spacing; a
  // segment of a line (part of a date) is cut tight so the pieces join up.
  const addPieces = (name, html) => {
    const text = exported.htmlToSpeech(html);
    const lines = text.split("\n");
    for (const piece of exported.speechPieces(text)) add(name, piece, !lines.includes(piece));
  };
  const start = new Date();
  for (let m = 0; m <= MONTHS_AHEAD; m++) {
    fakeNow = new Date(start.getFullYear(), start.getMonth() + m, 15).getTime();
    addPieces("experience", exported.executeCommand("experience"));
  }
  for (let d = 0; d <= 366 * YEARS_AHEAD; d++) {
    fakeNow = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d, 12).getTime();
    addPieces("date", exported.executeCommand("date"));
  }
  fakeNow = Date.now();
  addPieces("weather-unknown", exported.executeCommand("weather not-a-mode"));
  return [...items.values()];
}

// List numbers are said with the list's own word, on their own, with a gap
// either side, so "3. Use your brain" becomes:
//   (pause) "Principle three." (pause) "Use your brain".
// A bare "Three." came out clipped: Kokoro rushes a single word said alone.
const PAUSE_BEFORE_NUMBER = 0.7; // seconds
const PAUSE_AFTER_NUMBER = 0.4;
const NUMBER_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty"];
const numberWord = (n) =>
  n < 20 ? NUMBER_WORDS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + NUMBER_WORDS[n % 10].toLowerCase() : "");

// The word for each list, picked by its heading; anything else is "Number".
const LIST_LABELS = [
  [/^Principles:/, "Principle"],
  // Short words get "number" too: "Skill one" alone came out rushed.
  [/^Presentation tips:/, "Tip number"],
  [/^Essential Soft Skills:/, "Skill number"],
  [/^Character:/, "Trait number"],
];

// render.py splits the text on ⟨pause N⟩ and inserts N seconds of silence.

function forKokoro(text) {
  const parts = []; // { pause } | { number } | { text }
  const lines = text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').split("\n");
  const label = (LIST_LABELS.find(([re]) => re.test(lines[0])) || [null, "Number"])[1];
  for (const line of lines) {
    const item = line.match(/^(\d{1,2})\.\s+(.*)$/);
    const last = parts[parts.length - 1];
    if (item) {
      parts.push({ pause: PAUSE_BEFORE_NUMBER }, { number: +item[1] }, { pause: PAUSE_AFTER_NUMBER });
      parts.push({ text: item[2] });
    } else if (last && "text" in last) {
      last.text += " " + line;
    } else {
      parts.push({ text: line });
    }
  }
  if (parts.length && "pause" in parts[0]) parts.shift(); // nothing to pause after
  return parts
    .map((p) =>
      "pause" in p ? `⟨pause ${p.pause}⟩` : "number" in p ? `${label} ${numberWord(p.number).toLowerCase()}.` : pronounce(p.text),
    )
    .join(" ");
}

function pronounce(text) {
  let out = text;
  for (const [re, say] of PRONOUNCE) {
    // never rewrite inside a [word](/phonemes/) span an earlier rule made
    out = out
      .split(/(\[[^\]]*\]\(\/[^)]*\/\))/)
      .map((part, i) => (i % 2 ? part : part.replace(re, say)))
      .join("");
  }
  return out.replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}

function main() {
  const args = new Set(process.argv.slice(2));
  const items = collect();

  if (args.has("--json")) {
    // for pronunciation audits: [{ file, text, kokoro }]
    console.log(JSON.stringify(items.map((it) => ({ file: it.file, text: it.text, tight: it.tight, kokoro: forKokoro(it.text) }))));
    return;
  }

  if (args.has("--list")) {
    for (const it of items) console.log(`${it.file}\n  ${forKokoro(it.text)}\n`);
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const todo = args.has("--force")
    ? items
    : items.filter((it) => !fs.existsSync(path.join(OUT_DIR, it.file)));

  if (todo.length) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "terminal-voice-"));
    const job = {
      voice: VOICE,
      speed: SPEED,
      items: todo.map((it) => ({
        text: forKokoro(it.text),
        tight: it.tight,
        // a date's day ("sixteenth,") said alone starts with a stray "uh"
        lead_in: it.tight && /^[a-z-]+(st|nd|rd|th),$/.test(it.text) ? "November" : undefined,
        out: path.join(tmp, it.key + ".wav"),
      })),
    };
    console.log(`Rendering ${todo.length} clip(s) with Kokoro ${VOICE}...`);
    execFileSync(KOKORO_PY, [path.join(__dirname, "render.py")], {
      input: JSON.stringify(job),
      stdio: ["pipe", "inherit", "inherit"],
    });
    for (const it of todo) {
      execFileSync("ffmpeg", [
        "-y", "-loglevel", "error", "-i", path.join(tmp, it.key + ".wav"),
        "-af", it.tight ? "volume=2.2,alimiter=limit=0.84" : "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-ac", "1", "-ar", "24000",
        "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart",
        path.join(OUT_DIR, it.file),
      ]);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // Drop clips whose text no longer exists.
  const keep = new Set(items.map((it) => it.file));
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith(".m4a") && !keep.has(f)) {
      fs.rmSync(path.join(OUT_DIR, f));
      console.log(`Removed stale ${f}`);
    }
  }

  const manifest = Object.fromEntries(
    items.slice().sort((a, b) => a.file.localeCompare(b.file)).map((it) => [it.key, it.file]),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "clips.js"),
    "// Generated by tools/terminal-voice/build.js. Do not edit by hand.\n" +
      `window.TERMINAL_VOICE_CLIPS = ${JSON.stringify(manifest, null, 2)};\n`,
  );
  const old = path.join(OUT_DIR, "manifest.json");
  if (fs.existsSync(old)) fs.rmSync(old);
  console.log(`clips.js: ${items.length} clips (${todo.length} rendered).`);
}

main();
