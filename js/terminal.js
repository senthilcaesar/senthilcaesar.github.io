(function () {
  const trigger = document.getElementById("terminal-trigger");
  const windowDiv = document.getElementById("terminal-window");
  if (!trigger || !windowDiv) return;
  const backdrop = document.getElementById("terminal-backdrop");
  const closeBtn = windowDiv.querySelector(".btn.close");
  const mobileCloseBtn = windowDiv.querySelector(".terminal-mobile-close-btn");
  const minimizeBtn = windowDiv.querySelector(".btn.minimize");
  const maximizeBtn = windowDiv.querySelector(".btn.maximize");
  const header = windowDiv.querySelector(".terminal-header");
  const input = document.getElementById("terminal-input");
  const outputContainer = windowDiv.querySelector(".terminal-output");
  const body = document.getElementById("terminal-body");
  const chips = windowDiv.querySelectorAll(".term-chip");
  const voiceBtn = windowDiv.querySelector(".terminal-voice-btn");

  const commandHistory = [];
  let historyIndex = -1;
  let isTyping = false;
  let hasTypedWelcome = false;
  const TYPING_SPEED = 4; // ms per character (extremely fast)
  const WELCOME_HTML = `Welcome to Senthil's interactive console v1.0.0.<br>Type <span class="highlight">help</span> to see a list of commands.<br><br>`;

  const qaDatabase = [
    {
      keywords: [
        "who is senthil",
        "who are you",
        "what is your name",
        "senthil palanivelu",
        "about senthil",
      ],
      answer:
        "I'm a CS graduate from UMass Boston specializing in Data Analytics, AI Engineering, and Machine Learning. I'm passionate about using evidence-based insights to solve real-world problems.",
    },
    {
      keywords: [
        "where do you live",
        "where does he live",
        "location",
        "where is he",
        "where are you based",
        "address",
        "city",
      ],
      answer: "I live in Bangalore, India.",
    },
    {
      keywords: [
        "hobbies",
        "favorites",
        "interest",
        "what does he do in his free time",
        "outside of work",
        "hobby",
      ],
      answer:
        'My hobbies include reading books (feel free to check out my <a class="link" href="https://senthilcaesar.github.io/my-reading/" target="_blank">readings page</a>!), hiking, travelling, exploring new tech, and listening to music.',
    },
    {
      keywords: [
        "currently learning",
        "what is he learning",
        "current focus",
        "what is he studying",
        "learning now",
      ],
      answer:
        "I'm currently learning AI Agentic coding frameworks, TypeScript, LangFuse, and effective communication.",
    },
    {
      keywords: [
        "like to work with",
        "working style",
        "what is he like as a colleague",
        "work style",
        "work with",
      ],
      answer:
        "I'm analytical, proactive, and value collaboration. I focus on delivering clear business value, writing clean documentation, and evidence-based problem-solving.",
    },
    {
      keywords: [
        "work experience",
        "experience",
        "projects",
        "what has he built",
        "employment",
        "career",
        "jobs",
      ],
      answer:
        'I\'ve built analytical data pipelines, AI models, and portfolio applications. Check out my <a class="link" href="https://senthilcaesar.github.io/portfolio/" target="_blank">Portfolio</a> to see my projects.',
    },
    {
      keywords: ["senthilcaesar", "alias", "github name"],
      answer: "SenthilCaesar is my GitHub handle and developer alias.",
    },
  ];

  // Voice-over: optionally read each command's output aloud. Fixed outputs
  // have pre-rendered Kokoro clips (audio/terminal/), looked up by a
  // fingerprint of the spoken text, so an edited output never plays stale
  // audio. Anything without a clip (dates, durations) uses the browser voice.
  const VOICE_KEY = "terminal-voice";
  const VOICE_ON_MESSAGE = "Voice-over on.";
  const CLIP_DIR = "audio/terminal/";
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  const canPlayClips = typeof Audio === "function";
  const voiceSupported = canPlayClips || !!synth;
  let voiceEnabled = false;
  let chosenVoice = null;
  let speechRun = 0; // bumps on every stop so stale callbacks are ignored
  // { fingerprint: filename }, set by audio/terminal/clips.js. A script
  // rather than a fetch, so it also works when index.html is opened from disk.
  const clips = (canPlayClips && window.TERMINAL_VOICE_CLIPS) || {};
  let clipPlayer = null;

  try {
    voiceEnabled = voiceSupported && localStorage.getItem(VOICE_KEY) === "on";
  } catch (e) {
    voiceEnabled = false;
  }

  function pickVoice() {
    if (!synth) return;
    const english = synth.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang));
    if (!english.length) return;
    const preferred =
      /natural|neural|premium|enhanced|google us english|samantha|daniel|aria|jenny/i;
    chosenVoice =
      english.find((v) => preferred.test(v.name) && v.localService) ||
      english.find((v) => preferred.test(v.name)) ||
      english.find((v) => v.default) ||
      english[0];
  }

  if (synth && synth.addEventListener) {
    pickVoice();
    synth.addEventListener("voiceschanged", pickVoice);
  }

  const MONTH_FULL = {
    Jan: "January", Feb: "February", Mar: "March", Apr: "April",
    Jun: "June", Jul: "July", Aug: "August", Sep: "September",
    Oct: "October", Nov: "November", Dec: "December",
  };

  const ENTITIES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

  // Turn the HTML a command returns into sentences that sound natural.
  // Pure string work (no DOM), so tools/terminal-voice/build.js gets the
  // exact same text, and fingerprint, as the page does.
  function htmlToSpeech(html) {
    return html
      // The opening heading ("Hobbies:", "Quick Links:") only restates the
      // command, so it stays on screen but isn't read.
      .replace(/^\s*(?:<b>[^<]*:<\/b>|[A-Z][\w &]*:)\s*<br\s*\/?>/, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(td|th)>/gi, ", ")
      .replace(/<\/(tr|li|p|div)>/gi, "\n")
      .replace(/<\/span>\s*(?=<span class="term-item[" ])/gi, "</span>\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&(#?\w+);/g, (m, name) => (name in ENTITIES ? ENTITIES[name] : m))
      .replace(/\p{Extended_Pictographic}|️/gu, "")
      .replace(/[•◦]/g, "")
      .replace(/\b(\d{4})\s+-\s+(?=[A-Z])/g, "$1 to ")
      .replace(/\[|\]/g, "")
      .replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b(?=\s+\d{4})/g, (m) => MONTH_FULL[m])
      .replace(/\b1 yr\b/g, "1 year")
      .replace(/\b(\d+) yrs\b/g, "$1 years")
      .replace(/\b1 mo\b/g, "1 month")
      .replace(/\b(\d+) mos\b/g, "$1 months")
      .replace(/^\s*(\d+)\)/gm, "$1. ")
      .replace(/^\s*([a-z])\)/gm, "")
      .replace(/^\s*-\s+/gm, "")
      .replace(/\s+-\s+/g, ", ")
      .replace(/\s*\|\s*/g, ", ")
      .replace(/\be\.g\.\s*/g, "for example ")
      .replace(/\s*\bv\d+(\.\d+)+\b/g, "") // version numbers stay on screen only
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim().replace(/,$/, ""))
      .filter(Boolean)
      .map((line) => (/[.!?:,]$/.test(line) ? line : line + "."))
      .join("\n");
  }

  // FNV-1a over the text: a short, stable key for the clip manifest.
  function speechFingerprint(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  // Chrome stops long utterances after ~15 seconds, so queue short chunks.
  function chunkSpeech(text) {
    const chunks = [];
    text.split("\n").forEach((line) => {
      const sentences = line.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g) || [line];
      let current = "";
      sentences.forEach((sentence) => {
        if ((current + sentence).length > 180 && current) {
          chunks.push(current.trim());
          current = "";
        }
        current += sentence;
      });
      if (current.trim()) chunks.push(current.trim());
    });
    return chunks;
  }

  function setSpeaking(on) {
    if (voiceBtn) voiceBtn.classList.toggle("speaking", on);
  }

  function stopSpeaking() {
    speechRun++;
    if (synth) synth.cancel();
    if (clipPlayer) {
      clipPlayer.pause();
      clipPlayer.removeAttribute("src");
    }
    setSpeaking(false);
  }

  function speakWithBrowser(text, run) {
    if (!synth) return;
    const chunks = chunkSpeech(text);
    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang;
      }
      if (i === 0) {
        utterance.onstart = () => run === speechRun && setSpeaking(true);
      }
      if (i === chunks.length - 1) {
        utterance.onend = utterance.onerror = () =>
          run === speechRun && setSpeaking(false);
      }
      synth.speak(utterance);
    });
  }

  // Plays one or more clips back to back on a single audio element (once it
  // has started inside the user's gesture, later play() calls are allowed).
  function playClips(files, pieces, run) {
    if (!clipPlayer) {
      clipPlayer = new Audio();
      clipPlayer.preload = "auto";
    }
    let index = 0;
    const fallBack = () => {
      // Missing or blocked clip: read the rest with the browser voice.
      if (run === speechRun) speakWithBrowser(pieces.slice(index).join("\n"), run);
    };
    const playNext = () => {
      clipPlayer.src = CLIP_DIR + files[index];
      const playing = clipPlayer.play();
      if (playing && playing.catch) {
        playing.catch((err) => {
          if (run !== speechRun || (err && err.name === "AbortError")) return;
          fallBack();
        });
      }
    };
    clipPlayer.onplaying = () => run === speechRun && setSpeaking(true);
    clipPlayer.onerror = fallBack;
    clipPlayer.onended = () => {
      if (run !== speechRun) return;
      index++;
      if (index < files.length) playNext();
      else setSpeaking(false);
    };
    playNext();
  }

  // Outputs that change (dates, durations, the visitor's own words) have no
  // clip of their own. They are spoken from smaller pre-rendered pieces: each
  // line, and for the lines below, the segments these return.
  const ORDINALS = [
    "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
    "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth",
    "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
    "nineteenth", "twentieth", "twenty-first", "twenty-second", "twenty-third",
    "twenty-fourth", "twenty-fifth", "twenty-sixth", "twenty-seventh",
    "twenty-eighth", "twenty-ninth", "thirtieth", "thirty-first",
  ];
  const SEGMENTERS = [
    // "Today is Monday, November 16, 2026."
    [
      /^Today is (\w+), (\w+) (\d{1,2}), (\d{4})\.$/,
      (m, weekday, month, day, year) => [`Today is ${weekday},`, month, `${ORDINALS[+day]},`, `${year}.`],
    ],
    // Don't repeat what the visitor typed.
    [/^Unknown weather mode: .*?\. (Type .*)$/, (m, rest) => ["Unknown weather mode.", rest]],
  ];

  function speechPieces(text) {
    const pieces = [];
    for (const line of text.split("\n")) {
      const seg = SEGMENTERS.find(([re]) => re.test(line));
      if (seg) pieces.push(...seg[1](...line.match(seg[0])));
      else pieces.push(line);
    }
    return pieces;
  }

  // Commands whose output is not read aloud (a new one still stops any
  // reading in progress).
  const SILENT_COMMANDS = ["help"];

  function speakOutput(html, cmdStr = "") {
    if (!voiceEnabled || !html) return;
    stopSpeaking();
    if (SILENT_COMMANDS.includes(cmdStr.trim().split(" ")[0].toLowerCase())) return;
    const text = htmlToSpeech(html);
    if (!text) return;
    const run = speechRun;
    // Played straight from the key press or click: browsers only let audio
    // start inside the user's gesture.
    const whole = clips[speechFingerprint(text)];
    if (whole) return playClips([whole], [text], run);
    const pieces = speechPieces(text);
    const files = pieces.map((piece) => clips[speechFingerprint(piece)]);
    if (files.every(Boolean)) playClips(files, pieces, run);
    else speakWithBrowser(text, run);
  }

  function syncVoiceButton() {
    if (!voiceBtn) return;
    voiceBtn.setAttribute("aria-pressed", voiceEnabled ? "true" : "false");
    voiceBtn.setAttribute(
      "aria-label",
      voiceEnabled ? "Turn voice-over off" : "Turn voice-over on",
    );
    voiceBtn.title = voiceEnabled ? "Voice-over: on" : "Voice-over: off";
  }

  function setVoice(on) {
    voiceEnabled = voiceSupported && on;
    try {
      localStorage.setItem(VOICE_KEY, voiceEnabled ? "on" : "off");
    } catch (e) {
      /* storage blocked; the setting just won't persist */
    }
    if (!voiceEnabled) stopSpeaking();
    syncVoiceButton();
  }

  if (voiceBtn) {
    if (!voiceSupported) {
      voiceBtn.hidden = true;
    } else {
      syncVoiceButton();
      voiceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setVoice(!voiceEnabled);
        if (voiceEnabled) speakOutput(VOICE_ON_MESSAGE);
      });
    }
  }

  function tokenizeHTML(htmlString) {
    const tokens = [];
    let i = 0;
    while (i < htmlString.length) {
      if (htmlString[i] === "<") {
        const endIdx = htmlString.indexOf(">", i);
        if (endIdx !== -1) {
          tokens.push(htmlString.substring(i, endIdx + 1));
          i = endIdx + 1;
        } else {
          tokens.push(htmlString[i]);
          i++;
        }
      } else if (htmlString[i] === "&") {
        const endIdx = htmlString.indexOf(";", i);
        if (endIdx !== -1 && endIdx - i < 10) {
          tokens.push(htmlString.substring(i, endIdx + 1));
          i = endIdx + 1;
        } else {
          tokens.push(htmlString[i]);
          i++;
        }
      } else {
        tokens.push(htmlString[i]);
        i++;
      }
    }
    return tokens;
  }

  function typewrite(element, htmlString, speed = TYPING_SPEED, onComplete) {
    const tokens = tokenizeHTML(htmlString);
    let currentTokenIdx = 0;
    let accumulated = "";

    function typeNext() {
      if (currentTokenIdx >= tokens.length) {
        if (onComplete) onComplete();
        return;
      }

      let token = tokens[currentTokenIdx];
      while (token && token.startsWith("<") && token.endsWith(">")) {
        accumulated += token;
        currentTokenIdx++;
        token = tokens[currentTokenIdx];
      }

      if (token) {
        accumulated += token;
        currentTokenIdx++;
      }

      element.innerHTML = accumulated;
      outputContainer.scrollTop = outputContainer.scrollHeight;

      setTimeout(typeNext, speed);
    }

    typeNext();
  }

  function openTerminal() {
    windowDiv.classList.remove("hidden");
    if (backdrop) backdrop.classList.remove("hidden");
    if (typeof window.updateWeatherObstacles === "function") {
      window.updateWeatherObstacles();
    }
    if (window.innerWidth > 768) {
      input.focus();
    }
    if (!hasTypedWelcome) {
      hasTypedWelcome = true;
      const welcomeHTML = WELCOME_HTML;
      outputContainer.innerHTML = "";
      isTyping = true;
      speakOutput(welcomeHTML);
      typewrite(outputContainer, welcomeHTML, TYPING_SPEED, () => {
        isTyping = false;
        if (window.innerWidth > 768) {
          input.focus();
        }
      });
    }
  }

  function closeTerminal() {
    stopSpeaking();
    windowDiv.classList.add("hidden");
    windowDiv.classList.remove("minimized", "maximized");
    if (backdrop) backdrop.classList.add("hidden");
    if (typeof window.updateWeatherObstacles === "function") {
      window.updateWeatherObstacles();
    }
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (windowDiv.classList.contains("hidden")) {
      openTerminal();
    } else {
      closeTerminal();
    }
  });

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTerminal();
  });

  if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTerminal();
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTerminal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !windowDiv.classList.contains("hidden")) {
      closeTerminal();
    }
  });

  // Quick Command Chips
  chips.forEach((chip) => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const cmdVal = chip.getAttribute("data-cmd");
      if (!cmdVal) return;

      if (cmdVal === "exit") {
        closeTerminal();
        return;
      }

      if (cmdVal === "clear") {
        stopSpeaking();
        outputContainer.innerHTML = "";
        return;
      }

      if (isTyping) return;

      const userLine = document.createElement("div");
      userLine.classList.add("cmd-line");
      userLine.innerHTML = `<span class="prompt">senthil:~$</span> <span class="command-text">${cmdVal}</span>`;
      outputContainer.appendChild(userLine);

      const result = executeCommand(cmdVal);
      if (result) {
        const resLine = document.createElement("div");
        resLine.classList.add("cmd-result");
        const fullWidthCmds = ["experience", "education", "certifications"];
        if (fullWidthCmds.includes(cmdVal.toLowerCase().split(" ")[0])) {
          resLine.classList.add("full-width");
        }
        outputContainer.appendChild(resLine);

        isTyping = true;
        speakOutput(result, cmdVal);
        typewrite(resLine, result, TYPING_SPEED, () => {
          isTyping = false;
        });
      }

      setTimeout(() => {
        outputContainer.scrollTop = outputContainer.scrollHeight;
        body.scrollTop = body.scrollHeight;
      }, 20);
    });
  });

  minimizeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    windowDiv.classList.remove("maximized");
    windowDiv.classList.toggle("minimized");
    if (typeof window.updateWeatherObstacles === "function") {
      setTimeout(window.updateWeatherObstacles, 350);
    }
  });

  maximizeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    windowDiv.classList.remove("minimized");
    windowDiv.classList.toggle("maximized");
    if (typeof window.updateWeatherObstacles === "function") {
      setTimeout(window.updateWeatherObstacles, 350);
    }
  });

  header.addEventListener("click", () => {
    if (windowDiv.classList.contains("minimized")) {
      windowDiv.classList.remove("minimized");
      input.focus();
      if (typeof window.updateWeatherObstacles === "function") {
        setTimeout(window.updateWeatherObstacles, 350);
      }
    }
  });

  body.addEventListener("click", () => {
    // Don't steal focus while the user is selecting output text,
    // focusing the input would collapse the selection.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      return;
    }
    input.focus();
  });

  input.addEventListener("keydown", (e) => {
    if (isTyping) {
      // Let copy/select-all shortcuts through while output is animating.
      if ((e.metaKey || e.ctrlKey) && ["c", "a", "x"].includes(e.key.toLowerCase())) {
        return;
      }
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      const cmdVal = input.value.trim();
      if (cmdVal) {
        commandHistory.push(cmdVal);
        historyIndex = commandHistory.length;

        // Display user's command
        const userLine = document.createElement("div");
        userLine.classList.add("cmd-line");
        userLine.innerHTML = `<span class="prompt">senthil:~$</span> <span class="command-text">${cmdVal}</span>`;
        outputContainer.appendChild(userLine);

        // Execute and display response
        const result = executeCommand(cmdVal);
        if (result) {
          const resLine = document.createElement("div");
          resLine.classList.add("cmd-result");
          const fullWidthCmds = ["experience", "education", "certifications"];
          if (fullWidthCmds.includes(cmdVal.toLowerCase().split(" ")[0])) {
            resLine.classList.add("full-width");
          }
          outputContainer.appendChild(resLine);

          isTyping = true;
          speakOutput(result, cmdVal);
          typewrite(resLine, result, TYPING_SPEED, () => {
            isTyping = false;
            input.focus();
          });
        }
      } else {
        const userLine = document.createElement("div");
        userLine.classList.add("cmd-line");
        userLine.innerHTML = `<span class="prompt">senthil:~$</span>`;
        outputContainer.appendChild(userLine);
      }
      input.value = "";
      setTimeout(() => {
        outputContainer.scrollTop = outputContainer.scrollHeight;
      }, 10);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const partial = input.value.trimStart();
      if (!partial || partial.includes(" ")) return;
      const commands = [
        "about",
        "identity",
        "skills",
        "softskills",
        "principles",
        "character",
        "presentation",
        "hobbies",
        "favorites",
        "date",
        "reading",
        "experience",
        "garden",
        "education",
        "certifications",
        "projects",
        "project",
        "weather",
        "links",
        "contact",
        "theme",
        "voice",
        "clear",
        "exit",
        "help",
        "matrix",
        "gravity",
        "antigravity",
        "sudo",
      ];
      const matches = commands.filter((c) =>
        c.startsWith(partial.toLowerCase()),
      );
      if (matches.length === 1) {
        input.value = matches[0] + " ";
      } else if (matches.length > 1) {
        let prefix = matches[0];
        for (const m of matches) {
          while (!m.startsWith(prefix)) prefix = prefix.slice(0, -1);
        }
        if (prefix.length > partial.length) {
          input.value = prefix;
        } else {
          const matchLine = document.createElement("div");
          matchLine.classList.add("cmd-line");
          matchLine.innerHTML = `<span class="prompt">senthil:~$</span> <span class="command-text">${partial}</span><br>${matches.join("&nbsp;&nbsp;")}`;
          outputContainer.appendChild(matchLine);
          outputContainer.scrollTop = outputContainer.scrollHeight;
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = commandHistory[historyIndex];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        input.value = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        input.value = "";
      }
    }
  });

  function executeCommand(cmdStr) {
    const parts = cmdStr.split(" ");
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case "hello":
      case "hi":
      case "hey":
        return `Hello! How can I help you today? To see the list of available commands type <span class="highlight">help</span>`;
      case "help":
        return `Available commands:<br>• <span class="highlight">about</span>          - <span class="gray">Brief bio</span><br>• <span class="highlight">identity</span>       - <span class="gray">Who I am</span><br>• <span class="highlight">date</span>          - <span class="gray">Today's day of week & date</span><br>• <span class="highlight">skills</span>         - <span class="gray">Technical proficiencies bar chart</span><br>• <span class="highlight">softskills</span>     - <span class="gray">Essential soft skills</span><br>• <span class="highlight">principles</span>     - <span class="gray">Four principles to live by</span><br>• <span class="highlight">character</span>      - <span class="gray">Traits of character to hold to</span><br>• <span class="highlight">presentation</span>   - <span class="gray">Tips for giving a presentation</span><br>• <span class="highlight">hobbies</span>        - <span class="gray">Things I enjoy doing</span><br>• <span class="highlight">favorites</span>      - <span class="gray">A few of my favorite things</span><br>• <span class="highlight">experience</span>     - <span class="gray">Career timeline</span><br>• <span class="highlight">garden</span>         - <span class="gray">Career timeline as a garden</span><br>• <span class="highlight">education</span>      - <span class="gray">Education history and courses</span><br>• <span class="highlight">certifications</span> - <span class="gray">Professional certificates</span><br>• <span class="highlight">projects</span>       - <span class="gray">Open the Projects page</span><br>• <span class="highlight">reading</span>        - <span class="gray">Favorite newspapers & magazines</span><br>• <span class="highlight">weather</span>        - <span class="gray">Canvas weather control (e.g. "weather rain")</span><br>• <span class="highlight">links</span>          - <span class="gray">Quick links list</span><br>• <span class="highlight">contact</span>        - <span class="gray">Contact and social accounts</span><br>• <span class="highlight">theme</span>          - <span class="gray">Toggle dark/light mode</span><br>• <span class="highlight">voice</span>          - <span class="gray">Read output aloud (voice on / voice off)</span><br>• <span class="highlight">clear</span>          - <span class="gray">Clear terminal window</span><br>• <span class="highlight">exit</span>           - <span class="gray">Close the terminal</span><br>• <span class="highlight">help</span>           - <span class="gray">Show this screen</span><br><br>💡 Try system overrides: <span class="highlight">matrix</span>, <span class="highlight">gravity</span>, <span class="highlight">sudo destroy</span>`;
      case "education":
        return `<b>Education History:</b><br><br>
• <span class="highlight">[Jan 2015 - Jan 2019]</span> <b>Master of Science in Computer Science</b>, <span class="error">University of Massachusetts Boston</span> (USA)<br>
  <span class="gray"><i>Courses:</i><br>
  - Advanced Algorithms<br>
  - Algorithms in Bioinformatics<br>
  - Analysis of Algorithm<br>
  - Big Data Analytics<br>
  - Linear Algebra<br>
  - Calculus<br>
  - Software Development and Design<br>
  - Database Management<br>
  - Computing Data Structure<br>
  - Mathematical Logic</span><br><br>
• <span class="highlight">[Sep 2007 - Sep 2011]</span> <b>Bachelor of Engineering in Electronics and Communication</b>, <span class="error">Anna University</span> (India)<br>
  <span class="gray"><i>Courses:</i><br>
  - Signal Processing<br>
  - Microprocessor<br>
  - Satellite communication<br>
  - Control Systems Design</span>`;
      case "certifications":
        return `<b>Professional Certifications:</b><br><br>
• <span class="highlight">[September 2026]</span> <span class="purple">Introduction to REST APIs for Absolute Beginners</span>, Valentin Despa | Udemy<br>
  <span class="gray">Core REST API concepts: HTTP methods and status codes, request/response structure, JSON payloads, endpoints and resources, authentication basics, and testing APIs with tools like Postman.</span><br><br>
• <span class="highlight">[August 2026]</span> <span class="purple">Introduction to Git and Github</span>, Google | Coursera<br>
  <span class="gray">Foundational concepts of version control, Git workflow, repository management, branching, merging, and collaborative software development on GitHub.</span><br><br>
• <span class="highlight">[March 2025]</span> <span class="purple">Supervised Machine Learning: Regression and Classification</span>, DeepLearning.AI | Coursera | Stanford Online<br>
  <span class="gray">Build & train supervised machine learning models in Python using popular libraries NumPy & scikit-learn for prediction & binary classification tasks, including linear regression & logistic regression.</span><br><br>
• <span class="highlight">[February 2025]</span> <span class="purple">Google Prompting Essentials</span>, Google | Coursera<br>
  <span class="gray">AI agent design, Multimodal prompting, Prompt chaining, Prompt Design, Prompt evaluation and iteration, Responsible AI.</span><br><br>
• <span class="highlight">[July 2024]</span> <span class="purple">Mathematics for Machine Learning and Data Science</span>, DeepLearning.AI | Coursera<br>
  <span class="gray">A comprehensive course covering fundamental mathematics toolkit of machine learning: calculus, linear algebra, statistics, and probability.</span>`;
      case "skills":
        return `<b>Technical Skills & Proficiencies:</b><br>
<table class="term-table">
<tr><th>Category</th><th>Skills</th></tr>
<tr><td>Languages</td><td><span class="gray">Python, R Programming, R Shiny, SQL, JavaScript, TypeScript, HTML, CSS, Shell Scripting, MATLAB</span></td></tr>
<tr><td>Full Stack Development</td><td><span class="gray">Next.js, React, Tailwind CSS, Framer Motion, Zustand, Node.js, REST APIs, Streamlit, FastAPI</span></td></tr>
<tr><td>Machine Learning & AI</td><td><span class="gray">Machine Learning, Deep Learning, LLMs & RAG, AI Agents, Computer Vision, NLP, PyTorch, Scikit-learn, XGBoost, OpenAI API, Prompt Engineering, Random Forest, SVM, Gradient Descent, PCA, Neural Networks</span></td></tr>
<tr><td>Data Science & Analytics</td><td><span class="gray">Data Analysis, Statistical Modeling, Hypothesis Testing, Time Series Analysis, Signal Processing, Bayesian Statistics, Pandas, NumPy, Matplotlib/Seaborn, Data Visualization, Linear/Logistic Regression, Probability Theory</span></td></tr>
<tr><td>Tools & Platforms</td><td><span class="gray">AWS, Docker, Linux, Git/GitHub, CI/CD, GitHub Actions, VS Code, Jupyter, Netlify, PyMuPDF, Pinecone</span></td></tr>
</table>`;
      case "presentation":
        return `<b>Presentation tips:</b><br><br>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Write a talking script.</span> While you won’t be able to read directly from it while presenting, an outline that summarizes your presentation can help keep your talking points clear as you speak.</span></span>
<span class="term-item term-item-sub"><span class="term-item-num highlight">◦</span><span class="term-item-text">If you struggle to come up with a script, try pulling up your poster or slides, turning on a recorder and talking through it as if you were explaining it to someone else (although it may feel funny talking to yourself).</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Keep it short.</span> Most people want a quick summary of your topic, not a 20-minute explanation. Spend most of your time on the most important ideas of your presentation, and define words your audience may not know along the way.</span></span>
<span class="term-item term-item-sub"><span class="term-item-num highlight">◦</span><span class="term-item-text">For example, explain what words like “rural”, “Appalachia” and “psychosocial” mean, so the rest of the poster makes sense as you walk people through it.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">PRACTICE, PRACTICE, PRACTICE!</span> Whether you do this with your coworkers or in front of your bathroom mirror, practice makes perfect. Give yourself space to stumble over words and make mistakes in private, so that when it is time to present, you know which words or parts to take at a slower pace.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Remember: you’ve got this!</span> You did the work and made the poster or presentation. You practiced. You refined your talking script to make it as clean and coherent as possible. You know this content like the back of your hand! Have confidence in yourself (and remember that it’ll be over before you know it!).</span></span>`;
      case "hobbies":
        return `<b>Hobbies:</b><br><br>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Reading books</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Hiking</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Cycling</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Walking around the city</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Exploring cafe/book shops</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Travel</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Blogging/Vlogging</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Buying miscellaneous items</span></span>`;
      case "favorites":
        return `<b>Favorites:</b><br><br>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Car:</span> Honda CR-V Hybrid</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Food:</span> Fish, HotPot</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Brand:</span> American Eagle, H&amp;M</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Perfume:</span> Dolce &amp; Gabbana Light Blue Pour Homme Eau de Toilette</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Tech:</span> All Apple Products</span></span>`;
      case "character":
        return `<b>Character:</b><br><br>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Self-sufficient</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Self-assertive</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Self-actualization</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Self-determination</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Stand firm in your personal integrity</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Work through your moral dilemmas, the wars, the combats of the mind</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Never let personal emotions have full rein over you; if left unchecked, it will lead straight to destruction.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Be disciplined in thought and action.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Be patient. It's easy to make rash decisions in a fit of anger.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Don't make life decisions based on the barest bits of information.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Don't let yourself, your reality, interests, life developments and your self-belief crumble to ground zero just because you fell into infatuation.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Self-confidence, dignity and elegance are the image I should have.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Silence: Do not engage in unimportant talk.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Decide what you want to accomplish, be unyielding.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">When other people criticize you, you must be calm and dispassionate and show that you are listening attentively.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">I have no time to be unhappy because there are too many things I want to do.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Be resolute (hold your ground).</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Be patient and wait for the purpose of things to become visible.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">In pursuing success, knowledge contributes 50% and interpersonal relations 50%.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Walk into a room like you own it.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Be confident in your actions and words.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Life is not just about making money. Even if I make a lot of money, it won't satisfy me. Just to make money is not enough meaning in life. I want to keep raising the quality of my life. I want to find new kinds of happiness. I am looking for something that couldn't be measured.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Don't lose sight of what is more important to you.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text">Proceed with a strong intention, but a gentle approach.</span></span>`;
      case "principles":
      case "princicples":
        return `<b>Principles:</b><br><br>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Don't allow yourself to fall ill.</span> A wild life can at times appear romantic, poetic, and attractive, but in today's conditions it is inappropriate. You are the best keeper of your life. There is nothing more unfortunate nowadays than to lose your health. It is closest to your heart. The only thing to do is keep a close watch on it, pay careful attention to it, and cherish it.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Make sure you are happy.</span> Only when you are happy can you be youthful, active, fulfilled in your life, and steadfast in the face of all difficulties; only then will you see a future ahead of you and know how to enjoy yourself. This sort of happiness is not a life of contentment, but a life of struggle and of advance. Therefore we should all do some meaningful work each day and some reading, so that each of us is in a position to give something to others. Loafing about simply encourages the feeling that life is hollow, feeble, and in decay.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Use your brain, and make a habit of doing so.</span> Correct any tendency not to think and ponder, or to swim with the current. Before you say or do anything, think whether what you are saying is right, whether that is the most suitable way of dealing with the problem, whether it goes against your own principles, whether you feel you can take responsibility for it. Then you will have no cause to regret your actions later. This is what is known as acting rationally. It is the best way of avoiding the pitfalls of sweet words and honeyed phrases, of being sidetracked by petty gains, of wasting our emotions and wasting our lives.</span></span>
<span class="term-item"><span class="term-item-num highlight">•</span><span class="term-item-text"><span class="highlight">Resolution in hardship, perseverance to the end.</span> Aware, modern person should identify and cast off all their rosy illusions. Happiness is to take up the struggle in the midst of the raging storm and not to pluck the lute in the moonlight or recite poetry among the blossoms. In the absence of the greatest resolution, it is very easy to falter in mid-path. Not to suffer is to become degenerate. The strength to carry on should be nurtured through the quality of "perseverance." People without great aims and ambitions rarely have the firmness of purpose that does not covet petty advantages or seek a comfortable existence. But only those who have aims and ambitions for the benefit, not of the individual, but of humankind as a whole can persevere to the end.</span></span>`;
      case "softskills":
        return `<b>Essential Soft Skills:</b><br><br>
• Asking the Right Questions<br>
• Clear and Articulate Communication<br>
• Storytelling and Narrative Building<br>
• A Research Oriented Mindset<br>
• Polished Presentation Skills`;
      case "experience": {
        const MONTH_NAMES = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        // start/end are [year, month] with month 1-12; end: null means "Present"
        const roles = [
          {
            start: [2026, 4],
            end: null,
            title: "Senior Innovation Engineer",
            org: "Tarento Group",
            loc: "Bengaluru, India",
          },
          {
            start: [2025, 7],
            end: [2026, 4],
            title: "Member of Technical Staff",
            org: "Amudham Naturals",
            loc: "Chennai, India",
          },
          {
            start: [2022, 9],
            end: [2024, 12],
            title: "Bioinformatician I",
            org: "Brigham & Women's Hospital",
            loc: "Boston, USA",
          },
          {
            start: [2021, 9],
            end: [2022, 7],
            title: "Research Associate - Research Math",
            org: "Nationwide Children's Hospital",
            loc: "Columbus, USA",
          },
          {
            start: [2020, 4],
            end: [2021, 8],
            title: "Research Data Analyst I",
            org: "Boston University",
            loc: "Boston, USA",
          },
          {
            start: [2019, 1],
            end: [2020, 3],
            title: "Clinical Research Coordinator II",
            org: "Mass General Hospital",
            loc: "Boston, USA",
          },
          {
            start: [2016, 7],
            end: [2017, 8],
            title: "Research Assistant",
            org: "University of Massachusetts Boston",
            loc: "Boston, USA",
          },
          {
            start: [2015, 9],
            end: [2016, 5],
            title: "IT Assistant",
            org: "University of Massachusetts Boston",
            loc: "Boston, USA",
          },
          {
            start: [2012, 10],
            end: [2014, 2],
            title: "IT Specialist",
            org: "MphasiS",
            loc: "Pune, India",
          },
        ];

        const now = new Date();
        const nowYM = [now.getFullYear(), now.getMonth() + 1];

        // Inclusive month count: both the start and end month count as worked.
        const monthsBetween = ([sy, sm], [ey, em]) =>
          Math.max(0, (ey - sy) * 12 + (em - sm) + 1);

        const formatDuration = (months) => {
          const yrs = Math.floor(months / 12);
          const mos = months % 12;
          let dur = "";
          if (yrs > 0) dur += `${yrs} yr${yrs > 1 ? "s" : ""} `;
          if (mos > 0 || yrs === 0) dur += `${mos} mo${mos !== 1 ? "s" : ""}`;
          return dur.trim();
        };

        let totalMonths = 0;
        const rolesHtml = roles
          .map((role) => {
            const endYM = role.end || nowYM;
            const months = monthsBetween(role.start, endYM);
            totalMonths += months;
            const startLabel = `${MONTH_NAMES[role.start[1] - 1]} ${role.start[0]}`;
            const endLabel = role.end
              ? `${MONTH_NAMES[role.end[1] - 1]} ${role.end[0]}`
              : "Present";
            return `• <span class="highlight">[${startLabel} - ${endLabel}]</span> <span class="gray">${role.title}, ${role.org} (${role.loc})</span> - <span class="success">(${formatDuration(months)})</span>`;
          })
          .join("<br>\n");

        const totalYears = (totalMonths / 12).toFixed(1);

        return `Work Experience Timeline:<br>
${rolesHtml}<br><br>
Total Work Experience: <span class="success">${totalYears}+ Years (Net Active Experience)</span>`;
      }
      case "garden":
        window.open("garden/", "_blank", "noopener");
        return `Planting the career garden in a new tab... 🌱<br>If it didn't open, visit <a class="link" href="garden/" target="_blank">senthilcaesar.github.io/garden/</a>`;
      case "projects":
        window.open("https://senthilcaesar.github.io/projects/", "_blank", "noopener");
        return `Opening Projects in a new tab...<br>If it didn't open, visit <a class="link" href="https://senthilcaesar.github.io/projects/" target="_blank">senthilcaesar.github.io/projects/</a>`;
      case "project":
        const num = parts[1];
        if (num === "1") {
          return `<b>AI Agentic Coder</b>:<br>
  - Role: Lead Developer<br>
  - <span class="gray">Details: Developed an AI framework that refactors HTML and CSS modules synchronously.</span><br>
  - Tech Stack: Python, LangGraph, Ollama.<br>
  - Link: <a class="link" href="https://github.com/SenthilCaesar" target="_blank">GitHub Repository</a>`;
        } else if (num === "2") {
          return `<b>Sales Predictor</b>:<br>
  - Role: Data Analyst<br>
  - <span class="gray">Details: Built XGBoost algorithms to predict monthly client sales indices.</span><br>
  - Tech Stack: R, XGBoost, Shiny.<br>
  - Link: <a class="link" href="https://github.com/SenthilCaesar" target="_blank">GitHub Repository</a>`;
        } else if (num === "3") {
          return `<b>ThreeJS Gears</b>:<br>
  - Role: Frontend Architect<br>
  - <span class="gray">Details: Designed 3D flat-shaded mechanical gears that react to drag resizes and clicks.</span><br>
  - Tech Stack: JavaScript, WebGL, ThreeJS.<br>
  - Link: <a class="link" href="https://github.com/SenthilCaesar" target="_blank">GitHub Repository</a>`;
        }
        return `<span class="error">Usage: "project [1-3]". Try "project 1".</span>`;
      case "weather":
        const modeArg = parts[1];
        const modes = [
          "auto",
          "none",
          "rain",
          "sun-rising",
          "snowing",
          "summer",
          "windy",
          "cloudy",
          "fall",
          "moon",
          "matrix",
        ];
        if (!modeArg) {
          return `Available weather modes: <span class="highlight">${modes.join(", ")}</span><br>Usage: "weather [mode]". Try "weather rain".`;
        }
        if (modes.includes(modeArg.toLowerCase())) {
          if (typeof window.setWeather === "function") {
            const mapping = {
              auto: { icon: "⏰", label: "Auto (Time Sync)" },
              none: { icon: "✨", label: "Clear" },
              rain: { icon: "🌧️", label: "Rain" },
              "sun-rising": { icon: "🌅", label: "Sun Rising" },
              snowing: { icon: "❄️", label: "Snowing" },
              summer: { icon: "☀️", label: "Summer" },
              windy: { icon: "💨", label: "Windy" },
              cloudy: { icon: "☁️", label: "Cloudy" },
              fall: { icon: "🍁", label: "Fall" },
              moon: { icon: "🌙", label: "Moon" },
              matrix: { icon: "📟", label: "Matrix" },
            };
            const selection = mapping[modeArg.toLowerCase()];
            window.setWeather(
              modeArg.toLowerCase(),
              selection.icon,
              selection.label,
              true,
            );
            return `<span class="success">Atmosphere set to ${selection.label}.</span>`;
          }
          return `<span class="error">Weather engine is not ready.</span>`;
        }
        return `<span class="error">Unknown weather mode: "${modeArg}". Type "weather" to see options.</span>`;
      case "about":
        return `<span class="gray">I started my career as an IT Specialist, primarily working in Linux administration. That was when I was first introduced to Bash scripting and discovered how powerful programming could be in automating routine tasks. It sparked my interest in programming and computer science. Eventually, I reached a point where I felt I had outgrown the routine boundaries of my day-to-day responsibilities. I wanted to explore more, learn programming in depth, and understand computer science beyond my immediate role. That motivation led me to pursue a Master's degree in Computer Science at the University of Massachusetts Boston.<br><br>My time at UMass Boston transformed my learning experience and broadened my perspective. Two courses in particular, Big Data Analytics and Structural Bioinformatics, played an important role in shaping my career aspirations. I became interested in applying computer science to advance genetics and genomics research. Although I couldn't find an opportunity in bioinformatics, I serendipitously landed a position in neuroscience research, an opportunity I remain grateful for.<br><br>For the next six years, I worked in computational neuroscience, exploring areas such as brain anatomy, MRI, sleep medicine, and Alzheimer's research. During this time, I gained hands-on experience in data analytics, machine learning, and deep learning. At the end of 2024, due to visa-related restrictions, I had to leave my position in Boston and move back to India.<br><br>Since then, I have been focusing on machine learning and AI. I also ventured into entrepreneurship, building and launching an online food e-commerce business in India, leveraging AI throughout the journey, from research and website development to marketing, advertising, and launching the business on Amazon India.<br><br>Once the business was up and running, I wanted to explore how AI could be adopted and implemented at an enterprise scale. This led me to my current role, where I get to work more closely with enterprise AI solutions.<br><br>Looking ahead, I am excited about the AI transformation journey and eager to take on new challenges, continue learning, and explore the possibilities of AI.</span>`;
      case "identity":
        return `<span class="gray">My identity is not defined by a single attribute or characteristic. It is the unique manifestation of all my accumulated memories, experiences, lessons, and perspectives, woven together over time to shape who I am today.</span>`;
      case "date":
      case "day":
      case "today": {
        const now = new Date();
        const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
        const monthLong = now.toLocaleDateString("en-US", { month: "long" });
        const dayNum = now.getDate();
        const year = now.getFullYear();
        return `<span class="success">Today is <b>${dayOfWeek}, ${monthLong} ${dayNum}, ${year}</b></span>`;
      }
      case "blog":
        return `Check out my latest thoughts, guides, and learnings:<br><a class="link" href="https://senthilcaesar.github.io/blogs/" target="_blank">senthilcaesar.github.io/blogs/</a>`;
      case "reading":
      case "reads":
      case "press":
      case "magazines":
      case "newspapers":
        if (typeof window.openReadingModal === "function") {
          window.openReadingModal();
          return `<span class="success">Opening Favorite Reading List dialog... 📰</span>`;
        }
        return `<b>Favorite Newspapers & Magazines:</b><br><br>
<b>📰 Newspapers:</b><br>
• <a class="link" href="https://www.nytimes.com" target="_blank">New York Times</a><br>
• <a class="link" href="https://www.wsj.com" target="_blank">Wall Street Journal</a><br><br>
<b>📑 Magazines:</b><br>
• <a class="link" href="https://hbr.org" target="_blank">Harvard Business Review</a><br>
• <a class="link" href="https://sloanreview.mit.edu" target="_blank">MIT Sloan Management Review</a><br>
• <a class="link" href="https://www.bloomberg.com/businessweek" target="_blank">Bloomberg Businessweek</a><br>
• <a class="link" href="https://www.scientificamerican.com/" target="_blank">Scientific American</a><br>
• <a class="link" href="https://www.quantamagazine.org/" target="_blank">Quanta Magazine</a><br>
• <a class="link" href="https://www.nytimes.com/section/magazine" target="_blank">NYT Magazine</a><br>
• <a class="link" href="https://time.com" target="_blank">Times Magazine</a><br>
• <a class="link" href="https://www.wired.com" target="_blank">Wired USA</a><br>
• <a class="link" href="https://www.economist.com" target="_blank">The Economist</a><br>
• <a class="link" href="https://www.forbes.com" target="_blank">Forbes USA</a><br>
• <a class="link" href="https://www.ft.com/magazine" target="_blank">FT Weekend Magazine</a><br>
• <a class="link" href="https://www.theatlantic.com" target="_blank">The Atlantic</a>`;
      case "links":
        return `Quick Links:<br>• <a class="link" href="https://senthilcaesar.github.io/portfolio/" target="_blank">Portfolio</a><br>• <a class="link" href="https://senthilcaesar.github.io/projects/" target="_blank">Projects</a><br>• <a class="link" href="https://senthilcaesar.github.io/my-reading/" target="_blank">Readings</a><br>• <a class="link" href="https://senthilcaesar.github.io/knowledgelab/" target="_blank">KnowledgeLab</a><br>• <a class="link" href="https://senthilcaesar.github.io/resources/" target="_blank">URL Library</a><br>• <a class="link" href="https://senthilcaesar.github.io/commands/" target="_blank">Commands</a><br>• <a class="link" href="https://senthilcaesar.github.io/promptshelf/" target="_blank">Prompt Shelf</a><br>• <a class="link" href="https://senthilcaesar.github.io/blogs/" target="_blank">Blogs</a><br>• <a class="link" href="https://senthilcaesar.github.io/study/" target="_blank">Study</a><br>• <a class="link" href="https://senthilcaesar.github.io/tech-stack/" target="_blank">Tech Stack</a><br>• <a class="link" href="https://senthilcaesar.github.io/wander-list/" target="_blank">Wanderlist</a>`;
      case "contact":
        return `Let's connect!<br>• Email: <span class="highlight">senthilcaesar@gmail.com</span><br>• LinkedIn: <a class="link" href="https://www.linkedin.com/in/senthil-palanivelu-0ba38844/" target="_blank">LinkedIn Profile</a><br>• GitHub: <a class="link" href="https://github.com/SenthilCaesar" target="_blank">GitHub Profile</a><br>• Instagram: <a class="link" href="https://www.instagram.com/senthil_p89" target="_blank">Instagram Profile</a>`;
      case "theme":
        if (typeof window.toggleTheme === "function") {
          window.toggleTheme();
          const isDark = document.body.classList.contains("dark-mode");
          return `<span class="success">Theme toggled to ${isDark ? "Dark Mode" : "Light Mode"}!</span>`;
        }
        const toggle = document.getElementById("theme-toggle");
        if (toggle) {
          toggle.click();
          const isDark = document.body.classList.contains("dark-mode");
          return `<span class="success">Theme toggled to ${isDark ? "Dark Mode" : "Light Mode"}!</span>`;
        }
        return `<span class="error">Theme toggle button not found.</span>`;
      case "voice":
      case "voiceover": {
        if (!voiceSupported) {
          return `<span class="error">Voice-over isn't supported in this browser.</span>`;
        }
        const arg = (parts[1] || "").toLowerCase();
        if (arg === "on") setVoice(true);
        else if (arg === "off") setVoice(false);
        else if (arg === "") setVoice(!voiceEnabled);
        else return `<span class="error">Usage: "voice on" or "voice off".</span>`;
        return voiceEnabled
          ? `<span class="success">Voice-over on. Command output will be read aloud.</span>`
          : `<span class="success">Voice-over off.</span>`;
      }
      case "clear":
        stopSpeaking();
        outputContainer.innerHTML = "";
        return "";
      case "exit":
        setTimeout(() => {
          closeTerminal();
        }, 300);
        return `<span class="success">Goodbye, Senthil out. 👋</span>`;
      case "matrix":
        if (typeof window.setWeather === "function") {
          window.setWeather("matrix", "📟", "Matrix");
          return `<span class="success">Matrix simulation loaded. Wake up, Neo...</span>`;
        }
        return `<span class="error">Simulation engine not loaded.</span>`;
      case "gravity":
        const fallSelectors = [
          ".quick-link-card",
          ".profile-container",
          ".profile-name",
          ".profile-title",
          ".profile-affiliation",
          ".social-links",
          "#gear-canvas-container",
          ".content-section",
          ".sub-list-col",
          ".section-divider",
        ];
        fallSelectors.forEach((sel) => {
          const elements = document.querySelectorAll(sel);
          elements.forEach((el) => {
            el.classList.add("gravity-fell");
          });
        });
        if (typeof window.updateWeatherObstacles === "function") {
          setTimeout(window.updateWeatherObstacles, 2500);
        }
        return `<span class="error">CRITICAL WARNING: Gravity constant has been set to 9.8m/s²... Oops! All content fell. Type <span class="highlight">antigravity</span> to restore order.</span>`;
      case "antigravity":
        const restoreSelectors = [
          ".quick-link-card",
          ".profile-container",
          ".profile-name",
          ".profile-title",
          ".profile-affiliation",
          ".social-links",
          "#gear-canvas-container",
          ".content-section",
          ".sub-list-col",
          ".section-divider",
        ];
        restoreSelectors.forEach((sel) => {
          const elements = document.querySelectorAll(sel);
          elements.forEach((el) => {
            el.classList.remove("gravity-fell");
          });
        });
        if (typeof window.updateWeatherObstacles === "function") {
          setTimeout(window.updateWeatherObstacles, 2500);
        }
        return `<span class="success">Gravity restored. Elements floated back to standard orbit.</span>`;
      case "sudo":
        if (parts[1] && parts[1].toLowerCase() === "destroy") {
          document.body.classList.add("screen-shake");

          setTimeout(() => {
            windowDiv.classList.add("hidden");
          }, 500);

          setTimeout(() => {
            document.body.classList.remove("screen-shake");
            const glitchScreen = document.getElementById("glitch-screen");
            if (glitchScreen) {
              glitchScreen.classList.add("active");
            }
          }, 2000);

          return `<span class="error">CRITICAL ERROR: SYSTEM DESTRUCTION INITIATED...</span>`;
        }
        return `<span class="error">Usage: sudo [command]. Try "sudo destroy" if you dare.</span>`;
      default:
        // Check Q&A Database before falling back to error
        const cleanedQuery = cmdStr
          .toLowerCase()
          .replace(/[?.,!]/g, "")
          .trim();
        for (const qa of qaDatabase) {
          for (const kw of qa.keywords) {
            if (cleanedQuery.includes(kw)) {
              return qa.answer;
            }
          }
        }
        return `<span class="error">Command not found. Type "help" to list available commands.</span>`;
    }
  }

  // Lets tools/terminal-voice/build.js collect every output's spoken text.
  if (typeof window.__collectTerminalVoice === "function") {
    window.__collectTerminalVoice({
      executeCommand,
      htmlToSpeech,
      speechFingerprint,
      speechPieces,
      welcomeHTML: WELCOME_HTML,
      voiceOnMessage: VOICE_ON_MESSAGE,
      qaAnswers: qaDatabase.map((qa) => qa.answer),
    });
  }

  // Resize Handler: every edge and corner can be dragged, like a desktop window
  const MIN_WIDTH = 260;
  const MIN_HEIGHT = 180;
  let resizeDir = "";
  let resizeStart = null;

  windowDiv.querySelectorAll(".terminal-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      // Switch to explicit left/top/size so any edge can move independently
      const rect = windowDiv.getBoundingClientRect();
      Object.assign(windowDiv.style, {
        left: rect.left + "px",
        top: rect.top + "px",
        right: "auto",
        bottom: "auto",
        width: rect.width + "px",
        height: rect.height + "px",
        maxWidth: "none",
        maxHeight: "none",
      });

      resizeDir = handle.dataset.dir;
      resizeStart = { x: e.clientX, y: e.clientY, rect };
      handle.setPointerCapture(e.pointerId);
      windowDiv.classList.add("resizing");
      handle.addEventListener("pointermove", onResizeMove);
      handle.addEventListener("pointerup", onResizeEnd);
      handle.addEventListener("pointercancel", onResizeEnd);
    });
  });

  function onResizeMove(e) {
    const { rect } = resizeStart;
    const dx = e.clientX - resizeStart.x;
    const dy = e.clientY - resizeStart.y;
    let { left, top, right, bottom } = rect;

    // Move only the edges this handle owns, clamped to the viewport and
    // stopping at the minimum size rather than ignoring the movement
    if (resizeDir.includes("w")) {
      left = Math.min(Math.max(rect.left + dx, 0), right - MIN_WIDTH);
    }
    if (resizeDir.includes("e")) {
      right = Math.max(Math.min(rect.right + dx, window.innerWidth), left + MIN_WIDTH);
    }
    if (resizeDir.includes("n")) {
      top = Math.min(Math.max(rect.top + dy, 0), bottom - MIN_HEIGHT);
    }
    if (resizeDir.includes("s")) {
      bottom = Math.max(Math.min(rect.bottom + dy, window.innerHeight), top + MIN_HEIGHT);
    }

    Object.assign(windowDiv.style, {
      left: left + "px",
      top: top + "px",
      width: right - left + "px",
      height: bottom - top + "px",
    });
    if (typeof window.updateWeatherObstacles === "function") {
      window.updateWeatherObstacles();
    }
  }

  function onResizeEnd(e) {
    const handle = e.currentTarget;
    handle.releasePointerCapture(e.pointerId);
    windowDiv.classList.remove("resizing");
    handle.removeEventListener("pointermove", onResizeMove);
    handle.removeEventListener("pointerup", onResizeEnd);
    handle.removeEventListener("pointercancel", onResizeEnd);
    if (typeof window.updateWeatherObstacles === "function") {
      window.updateWeatherObstacles();
    }
  }

  // Drag Handler: move the window by its title bar
  const DRAG_MARGIN = 40; // px of title bar that must stay on screen
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function canDrag() {
    return (
      !windowDiv.classList.contains("minimized") &&
      !windowDiv.classList.contains("maximized") &&
      window.innerWidth > 768 &&
      !window.matchMedia("(hover: none)").matches
    );
  }

  function moveTo(left, top) {
    const width = windowDiv.offsetWidth;
    const maxLeft = window.innerWidth - DRAG_MARGIN;
    const minLeft = DRAG_MARGIN - width;
    const maxTop = window.innerHeight - header.offsetHeight;
    windowDiv.style.left = Math.min(Math.max(left, minLeft), maxLeft) + "px";
    windowDiv.style.top = Math.min(Math.max(top, 0), maxTop) + "px";
  }

  header.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !canDrag()) return;
    if (e.target.closest(".terminal-buttons, .terminal-voice-btn")) return;
    e.preventDefault();

    const rect = windowDiv.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    windowDiv.style.right = "auto";
    windowDiv.style.bottom = "auto";
    moveTo(rect.left, rect.top);

    header.setPointerCapture(e.pointerId);
    windowDiv.classList.add("dragging");
    header.addEventListener("pointermove", onDragMove);
    header.addEventListener("pointerup", onDragEnd);
    header.addEventListener("pointercancel", onDragEnd);
  });

  function onDragMove(e) {
    moveTo(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
    if (typeof window.updateWeatherObstacles === "function") {
      window.updateWeatherObstacles();
    }
  }

  function onDragEnd(e) {
    header.releasePointerCapture(e.pointerId);
    windowDiv.classList.remove("dragging");
    header.removeEventListener("pointermove", onDragMove);
    header.removeEventListener("pointerup", onDragEnd);
    header.removeEventListener("pointercancel", onDragEnd);
    if (typeof window.updateWeatherObstacles === "function") {
      window.updateWeatherObstacles();
    }
  }

  // Keep a dragged window reachable when the browser is resized
  window.addEventListener("resize", () => {
    if (!windowDiv.style.left) return;
    const rect = windowDiv.getBoundingClientRect();
    moveTo(rect.left, rect.top);
  });

  // Mobile virtual keyboard adaptation
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      if (!windowDiv.classList.contains("hidden") && window.innerWidth <= 768) {
        const offset = window.innerHeight - window.visualViewport.height;
        if (offset > 60) {
          windowDiv.style.bottom = `${offset}px`;
          body.scrollTop = body.scrollHeight;
        } else {
          windowDiv.style.bottom = "0px";
        }
      }
    });
  }

  // Auto scroll into view when input receives focus on mobile/tablet
  input.addEventListener("focus", () => {
    setTimeout(() => {
      outputContainer.scrollTop = outputContainer.scrollHeight;
      body.scrollTop = body.scrollHeight;
    }, 280);
  });

  // Glitch Reboot Event Handler
  const rebootBtn = document.getElementById("glitch-reboot-btn");
  if (rebootBtn) {
    rebootBtn.addEventListener("click", () => {
      const glitchScreen = document.getElementById("glitch-screen");
      if (glitchScreen) {
        glitchScreen.classList.remove("active");
      }

      // Restore gravity
      const elements = document.querySelectorAll(".gravity-fell");
      elements.forEach((el) => el.classList.remove("gravity-fell"));

      // Restore terminal window
      windowDiv.classList.remove("hidden");

      // Reset weather back to auto
      if (typeof window.setWeather === "function") {
        window.setWeather("auto", "⏰", "Auto (Time Sync)");
      }

      // Print reboot message in terminal
      outputContainer.innerHTML =
        "System rebooted successfully.<br>Core kernel initialized.<br><br>";
      input.value = "";
      input.focus();
    });
  }
})();
