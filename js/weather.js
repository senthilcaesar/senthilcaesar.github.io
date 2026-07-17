(function () {
  // Dropdown DOM components
  const weatherBtn = document.getElementById("weather-btn");
  const weatherMenu = document.getElementById("weather-menu");
  const weatherOptions = document.querySelectorAll(".weather-option");
  const weatherIconCurrent = document.querySelector(".weather-icon-current");
  const weatherText = document.querySelector(".weather-text");

  if (!weatherBtn || !weatherMenu) return;

  let canvas = null;
  let ctx = null;
  let animationFrameId = null;
  let active = false;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let currentMode = "none"; // 'none', 'rain', 'sun-rising', 'snowing', 'summer', 'windy', 'cloudy', 'fall', 'moon'

  // Layout Caching to prevent forced reflows (Layout Thrashing)
  let cachedPageObstacles = [];
  let cachedGearContainer = null;
  let cachedTerminalWindow = null;

  function updateCachedObstacles() {
    cachedPageObstacles = [];
    const selectors = [
      ".quick-link-card",
      ".profile-img",
      ".speech-bubble",
      ".contact-box",
      ".sub-list-col",
    ];
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    selectors.forEach((sel) => {
      const elements = document.querySelectorAll(sel);
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          cachedPageObstacles.push({
            pageLeft: rect.left + scrollX,
            pageTop: rect.top + scrollY,
            width: rect.width,
            height: rect.height,
          });
        }
      });
    });

    if (window.gearsData && window.gearsData.container) {
      const rect = window.gearsData.container.getBoundingClientRect();
      cachedGearContainer = {
        pageLeft: rect.left + scrollX,
        pageTop: rect.top + scrollY,
        width: rect.width,
        height: rect.height,
      };
    } else {
      cachedGearContainer = null;
    }

    const terminalWindow = document.getElementById("terminal-window");
    if (terminalWindow && !terminalWindow.classList.contains("hidden")) {
      const rect = terminalWindow.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        cachedTerminalWindow = {
          pageLeft: rect.left + scrollX,
          pageTop: rect.top + scrollY,
          width: rect.width,
          height: rect.height,
        };
      } else {
        cachedTerminalWindow = null;
      }
    } else {
      cachedTerminalWindow = null;
    }
  }
  window.updateWeatherObstacles = updateCachedObstacles;

  // Global settings
  const CONFIG = {
    windX: -1.2,
    maxDrops: 180,
    maxSnowflakes: 150,
    maxLeaves: 45,
    maxSparkles: 60,
    maxMist: 8,
  };

  // Entity Arrays
  // 1. Rain
  let drops = [];
  let splashes = [];
  let gearDroplets = [];
  let cardDroplets = [];
  let lightningOpacity = 0;
  let nextLightningTime = 0;
  let activeBolt = null;

  // 2. Snow
  let snowflakes = [];
  let gearSnowlets = [];

  // 3. Fall & Windy Leaves
  let leaves = [];
  let windStreaks = [];

  // 4. Amber Sparkles & Solar Dust
  let sparkles = [];

  // 5. Cloudy Mist
  let mistParticles = [];

  let stars = [];

  // 7. Matrix Code Rain
  let matrixCodes = [];

  // --- DROP DOWN INTERACTIVE EVENT LISTENERS ---
  weatherBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const parent = weatherBtn.parentElement;
    parent.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!weatherBtn.parentElement.contains(e.target)) {
      weatherBtn.parentElement.classList.remove("open");
    }
  });

  weatherOptions.forEach((opt) => {
    opt.addEventListener("click", (e) => {
      const selected = opt.getAttribute("data-weather");

      // Update active class in dropdown menu
      weatherOptions.forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");

      // Close menu
      weatherBtn.parentElement.classList.remove("open");

      // Transition to selected weather
      setWeather(
        selected,
        opt.querySelector(".option-icon").textContent,
        opt.querySelector(".option-label").textContent,
      );
    });
  });

  let autoInterval = null;

  function runSimulation(mode) {
    if (mode === currentMode) return;

    // 1. Clean up current weather state
    cleanupWeatherEffect();

    currentMode = mode;

    // Remove previous weather classes from body
    document.body.classList.remove(
      "weather-sun-rising",
      "weather-summer",
      "weather-cloudy",
      "weather-windy",
      "weather-fall",
      "weather-moon",
    );

    // 2. Initialize new weather state
    if (mode === "none") {
      return; // Clear weather needs no canvas loop
    }

    // Add weather specific body class for CSS variables & transitions
    document.body.classList.add(`weather-${mode}`);

    // Spin gears faster if windy
    if (mode === "windy") {
      window.weatherGearSpeed = 1.8;
    }

    // Set up canvas and start loop
    setupCanvas();
    updateCachedObstacles();
    window.addEventListener("resize", resizeCanvas);

    active = true;
    initEntities(mode);
    loop();
  }

  function applyAutoWeather() {
    const hour = new Date().getHours();
    let targetMode = "moon";
    let targetLabel = "Moon";

    if (6 <= hour && hour < 12) {
      targetMode = "sun-rising";
      targetLabel = "Sun Rising";
    } else if (12 <= hour && hour < 18) {
      targetMode = "summer";
      targetLabel = "Summer";
    }

    // Night (Moon) automatically switches to Dark Mode
    // Morning (Sun Rising) and Afternoon (Summer) switch to Light Mode
    const shouldBeDark = targetMode === "moon";
    const isDarkCurrent = document.body.classList.contains("dark-mode");

    if (shouldBeDark !== isDarkCurrent) {
      if (shouldBeDark) {
        document.body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
      } else {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
      }

      // Update theme button icon
      if (typeof window.updateThemeIcon === "function") {
        window.updateThemeIcon(shouldBeDark);
      }

      // Update three.js gears
      if (typeof window.updateGearTheme === "function") {
        window.updateGearTheme(shouldBeDark);
      }
    }

    weatherIconCurrent.textContent = "⏰";
    weatherText.textContent = `Auto (${targetLabel})`;

    runSimulation(targetMode);
  }

  function setWeather(mode, icon, label) {
    if (autoInterval) {
      clearInterval(autoInterval);
      autoInterval = null;
    }

    if (mode === "auto") {
      applyAutoWeather();
      autoInterval = setInterval(applyAutoWeather, 30000); // Check every 30 seconds
    } else {
      weatherIconCurrent.textContent = icon;
      weatherText.textContent = label;
      runSimulation(mode);
    }
  }
  window.setWeather = setWeather;

  // --- ENTITY CLASSES ---

  // --- 1. RAIN SYSTEM ---
  class Drop {
    constructor(isInitial = false) {
      this.reset(isInitial);
    }

    reset(
      isInitial = false,
      customX = null,
      customY = null,
      customVx = null,
      customVy = null,
    ) {
      if (customX !== null && customY !== null) {
        this.x = customX;
        this.y = customY;
        this.length = 6 + Math.random() * 6;
        this.speed = customVy || 8;
        this.vx = customVx !== null ? customVx : CONFIG.windX;
        this.width = 1.0 + Math.random() * 0.5;
        this.opacity = 0.55;
        this.isDrip = true;
      } else {
        this.x = Math.random() * (width + 100) - 50;
        this.y = isInitial ? Math.random() * height : -30 - Math.random() * 50;
        this.length = 12 + Math.random() * 12;
        this.speed = 16 + Math.random() * 10;
        this.vx = CONFIG.windX;
        this.width = 1.0 + Math.random() * 0.8;
        this.opacity = (this.length / 24) * 0.7;
        this.isDrip = false;
      }
    }

    update(activeObstacles, activeGears) {
      const prevX = this.x;
      const prevY = this.y;

      this.y += this.speed;
      this.x += this.vx;

      const bottomPrevY = prevY + this.length;
      const bottomNextY = this.y + this.length;

      // Gear collisions
      if (activeGears && activeGears.length > 0) {
        for (let gear of activeGears) {
          const dx = this.x - gear.cx;
          const dy = bottomNextY - gear.cy;
          const dist = Math.hypot(dx, dy);
          if (dist <= gear.radius && dy < 0 && bottomPrevY <= gear.cy) {
            const hitAngle = Math.atan2(dy, dx);
            const hitX = gear.cx + gear.radius * Math.cos(hitAngle);
            const hitY = gear.cy + gear.radius * Math.sin(hitAngle);
            createSplash(hitX, hitY);
            gearDroplets.push(
              new GearDroplet(
                gear.index,
                hitAngle,
                gear.radius,
                this.width * 1.5,
              ),
            );
            return false;
          }
        }
      }

      // Card/Box collisions
      if (activeObstacles && activeObstacles.length > 0) {
        for (let obs of activeObstacles) {
          if (bottomPrevY <= obs.top && bottomNextY >= obs.top) {
            const t =
              (obs.top - bottomPrevY) / (bottomNextY - bottomPrevY || 1);
            const hitX = prevX + (this.x - prevX) * t;
            if (hitX >= obs.left && hitX <= obs.right) {
              createSplash(hitX, obs.top);
              if (Math.random() < 0.15) {
                cardDroplets.push(
                  new CardDroplet(hitX, obs.top, obs.bottom, this.width * 1.4),
                );
              }
              return false;
            }
          }
        }
      }

      if (this.y >= height) {
        createSplash(this.x, height);
        return false;
      }
      return true;
    }

    draw() {
      const isDark = document.body.classList.contains("dark-mode");
      ctx.strokeStyle = isDark
        ? `rgba(165, 203, 255, ${this.opacity * 0.95})`
        : `rgba(47, 65, 90, ${this.opacity * 0.9})`;
      ctx.lineWidth = this.width;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.vx * 0.6, this.y + this.length);
      ctx.stroke();
    }
  }

  class GearDroplet {
    constructor(gearIndex, angle, radius, size) {
      this.gearIndex = gearIndex;
      this.angle = angle;
      this.radius = radius;
      this.size = size || 2;
      this.trail = [];
      this.gravitySlideSpeed = 0.015 + Math.random() * 0.015;
      this.friction = 0.98;
      this.age = 0;
    }

    update(activeGears) {
      this.age++;
      const gear = activeGears.find((g) => g.index === this.gearIndex);
      if (!gear) return false;

      const currentRot = gear.mesh.rotation.z;
      if (gear.mesh.lastZRotation === undefined) {
        gear.mesh.lastZRotation = currentRot;
      }
      const dphi = currentRot - gear.mesh.lastZRotation;
      this.angle -= dphi * this.friction;

      const gravityForce = Math.cos(this.angle);
      this.angle += gravityForce * this.gravitySlideSpeed;
      this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));

      const x = gear.cx + this.radius * Math.cos(this.angle);
      const y = gear.cy + this.radius * Math.sin(this.angle);

      this.trail.push({ x, y });
      if (this.trail.length > 5) this.trail.shift();

      const isNearBottom = Math.sin(this.angle) > 0.94;
      const isSpinningFast = Math.abs(dphi) > 0.05;

      let detach = false;
      if (isNearBottom && Math.random() < 0.06) detach = true;
      else if (isSpinningFast && Math.random() < 0.12) detach = true;
      else if (this.age > 240) detach = true;

      if (detach) {
        let vx = CONFIG.windX;
        let vy = 3 + Math.random() * 2;
        if (isSpinningFast) {
          const speed = -dphi * this.radius * 0.8;
          vx = -speed * Math.sin(this.angle) + CONFIG.windX * 0.5;
          vy = speed * Math.cos(this.angle) + 2;
        }
        spawnDrippingDrop(x, y, vx, vy);
        return false;
      }
      return true;
    }

    draw() {
      if (this.trail.length < 2) return;
      const isDark = document.body.classList.contains("dark-mode");
      ctx.strokeStyle = isDark
        ? `rgba(165, 203, 255, 0.8)`
        : `rgba(47, 65, 90, 0.75)`;
      ctx.lineWidth = this.size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();

      const head = this.trail[this.trail.length - 1];
      ctx.fillStyle = isDark
        ? `rgba(200, 225, 255, 0.95)`
        : `rgba(60, 80, 110, 0.9)`;
      ctx.beginPath();
      ctx.arc(head.x, head.y, this.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class CardDroplet {
    constructor(x, y, bottomY, size) {
      this.x = x;
      this.y = y;
      this.bottomY = bottomY;
      this.size = size || 1.5;
      this.trail = [];
      this.speed = 0.5 + Math.random() * 0.8;
      this.wiggleFactor = 0.25;
    }

    update() {
      this.y += this.speed;
      this.x += (Math.random() - 0.5) * this.wiggleFactor + CONFIG.windX * 0.05;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 5) this.trail.shift();

      if (this.y >= this.bottomY) {
        spawnDrippingDrop(this.x, this.y, CONFIG.windX, 2 + Math.random() * 2);
        return false;
      }
      return true;
    }

    draw() {
      if (this.trail.length < 2) return;
      const isDark = document.body.classList.contains("dark-mode");
      ctx.strokeStyle = isDark
        ? `rgba(165, 203, 255, 0.45)`
        : `rgba(47, 65, 90, 0.4)`;
      ctx.lineWidth = this.size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();

      const head = this.trail[this.trail.length - 1];
      ctx.fillStyle = isDark
        ? `rgba(180, 215, 255, 0.7)`
        : `rgba(50, 70, 95, 0.65)`;
      ctx.beginPath();
      ctx.arc(head.x, head.y, this.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class SplashParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      const angle = Math.PI + (Math.random() - 0.5) * 0.8;
      const force = 1.5 + Math.random() * 2.5;
      this.vx = Math.cos(angle) * force + CONFIG.windX * 0.2;
      this.vy = Math.sin(angle) * force;
      this.size = 1.0 + Math.random() * 1.5;
      this.gravity = 0.12;
      this.alpha = 1.0;
      this.decay = 0.04 + Math.random() * 0.04;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.alpha -= this.decay;
      return this.alpha > 0;
    }

    draw() {
      const isDark = document.body.classList.contains("dark-mode");
      ctx.fillStyle = isDark
        ? `rgba(165, 203, 255, ${this.alpha * 0.7})`
        : `rgba(47, 65, 90, ${this.alpha * 0.75})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- 2. SNOW SYSTEM ---
  class Snowflake {
    constructor(isInitial = false) {
      this.reset(isInitial);
    }

    reset(isInitial = false) {
      this.x = Math.random() * (width + 100) - 50;
      this.y = isInitial ? Math.random() * height : -10 - Math.random() * 50;
      this.radius = 1.2 + Math.random() * 2.3;
      this.speed = 0.8 + Math.random() * 1.2;
      this.density = 0.5 + Math.random() * 1.0;
      this.angle = Math.random() * Math.PI * 2;
      this.opacity = 0.4 + Math.random() * 0.45;
      this.settled = false;
      this.settleAge = 150 + Math.floor(Math.random() * 100);
      this.maxSettleAge = this.settleAge;
    }

    update(activeObstacles, activeGears) {
      if (this.settled) {
        this.settleAge--;
        return this.settleAge > 0;
      }

      this.y += this.speed;
      this.x += Math.sin(this.angle) * 0.4 + CONFIG.windX * 0.15;
      this.angle += 0.015;

      // Gear collisions
      if (activeGears && activeGears.length > 0) {
        for (let gear of activeGears) {
          const dx = this.x - gear.cx;
          const dy = this.y - gear.cy;
          const dist = Math.hypot(dx, dy);
          if (dist <= gear.radius && dy < 0 && this.y - this.speed <= gear.cy) {
            const hitAngle = Math.atan2(dy, dx);
            gearSnowlets.push(
              new GearSnowlet(gear.index, hitAngle, gear.radius, this.radius),
            );
            return false;
          }
        }
      }

      // Obstacle collisions
      if (activeObstacles && activeObstacles.length > 0) {
        for (let obs of activeObstacles) {
          if (
            this.y >= obs.top &&
            this.y - this.speed <= obs.top &&
            this.x >= obs.left &&
            this.x <= obs.right
          ) {
            this.settled = true;
            this.y = obs.top - 0.5;
            return true;
          }
        }
      }

      // Screen bottom
      if (this.y >= height) {
        this.settled = true;
        this.y = height - 0.5;
        return true;
      }

      return true;
    }

    draw() {
      const currentOpacity = this.settled
        ? this.opacity * (this.settleAge / this.maxSettleAge)
        : this.opacity;
      ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class GearSnowlet {
    constructor(gearIndex, angle, radius, size) {
      this.gearIndex = gearIndex;
      this.angle = angle;
      this.radius = radius;
      this.size = size;
      this.gravitySlideSpeed = 0.008 + Math.random() * 0.01;
      this.friction = 0.99;
      this.age = 0;
      this.maxAge = 120 + Math.random() * 60;
    }

    update(activeGears) {
      this.age++;
      const gear = activeGears.find((g) => g.index === this.gearIndex);
      if (!gear) return false;

      const currentRot = gear.mesh.rotation.z;
      if (gear.mesh.lastZRotation === undefined) {
        gear.mesh.lastZRotation = currentRot;
      }
      const dphi = currentRot - gear.mesh.lastZRotation;
      this.angle -= dphi * this.friction;

      const gravityForce = Math.cos(this.angle);
      this.angle += gravityForce * this.gravitySlideSpeed;
      this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));

      this.x = gear.cx + this.radius * Math.cos(this.angle);
      this.y = gear.cy + this.radius * Math.sin(this.angle);

      if (this.age > this.maxAge || Math.sin(this.angle) > 0.96) {
        return false;
      }
      return true;
    }

    draw() {
      const opacity = 1.0 - this.age / this.maxAge;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.85})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- 3. FALL & WINDY LEAF SYSTEM ---
  class Leaf {
    constructor(isInitial = false, isWindy = false) {
      this.isWindy = isWindy;
      this.reset(isInitial);
    }

    reset(isInitial = false) {
      this.x = Math.random() * (width + 200) - (this.isWindy ? 50 : 100);
      this.y = isInitial ? Math.random() * height : -20 - Math.random() * 80;

      // Autumn leaves color palette
      const colorsList = [
        "rgba(220, 38, 38, opacity)", // Crimson
        "rgba(217, 119, 6, opacity)", // Amber
        "rgba(180, 83, 9, opacity)", // Rust
        "rgba(234, 179, 8, opacity)", // Gold
        "rgba(161, 98, 7, opacity)", // Olive gold
      ];
      this.colorTemplate =
        colorsList[Math.floor(Math.random() * colorsList.length)];
      this.size = 6 + Math.random() * 8;
      this.ratio = 0.45 + Math.random() * 0.25;

      if (this.isWindy) {
        this.vy = 0.8 + Math.random() * 1.5;
        this.vx = -4.5 - Math.random() * 5.0; // blowing hard left
        this.rotSpeed = (Math.random() - 0.5) * 0.15;
        this.swaySpeed = 0.05 + Math.random() * 0.05;
      } else {
        this.vy = 1.0 + Math.random() * 1.2;
        this.vx = -0.5 - Math.random() * 1.5; // drifting left gently
        this.rotSpeed = (Math.random() - 0.5) * 0.06;
        this.swaySpeed = 0.02 + Math.random() * 0.02;
      }

      this.rotation = Math.random() * Math.PI * 2;
      this.swayAngle = Math.random() * Math.PI * 2;
      this.opacity = 0.7 + Math.random() * 0.25;
      this.settled = false;
      this.settleAge = 200 + Math.floor(Math.random() * 150);
      this.maxSettleAge = this.settleAge;
    }

    update(activeObstacles) {
      if (this.settled) {
        this.settleAge--;
        return this.settleAge > 0;
      }

      this.y += this.vy;

      if (this.isWindy) {
        this.x += this.vx;
        this.rotation += this.rotSpeed * 1.5;
      } else {
        this.x += this.vx + Math.sin(this.swayAngle) * 0.8;
        this.swayAngle += this.swaySpeed;
        this.rotation += this.rotSpeed;
      }

      // Obstacle collisions
      if (activeObstacles && activeObstacles.length > 0) {
        for (let obs of activeObstacles) {
          if (
            this.y >= obs.top &&
            this.y - this.vy <= obs.top &&
            this.x >= obs.left &&
            this.x <= obs.right
          ) {
            this.settled = true;
            this.y = obs.top - 1;
            this.vx = 0;
            this.vy = 0;
            return true;
          }
        }
      }

      // Bottom of screen
      if (this.y >= height) {
        this.settled = true;
        this.y = height - 1;
        return true;
      }

      if (this.x < -50 || this.x > width + 100) {
        return false;
      }
      return true;
    }

    draw() {
      const curOpacity = this.settled
        ? this.opacity * (this.settleAge / this.maxSettleAge)
        : this.opacity;
      ctx.fillStyle = this.colorTemplate.replace(
        "opacity",
        curOpacity.toString(),
      );

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      ctx.beginPath();
      ctx.moveTo(0, -this.size / 2);
      ctx.quadraticCurveTo(this.size * this.ratio, 0, 0, this.size / 2);
      ctx.quadraticCurveTo(-this.size * this.ratio, 0, 0, -this.size / 2);
      ctx.fill();

      ctx.restore();
    }
  }

  class WindStreak {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = width + 50 + Math.random() * 200;
      this.y = Math.random() * height;
      this.length = 80 + Math.random() * 120;
      this.speed = 8 + Math.random() * 6;
      this.opacity = 0.05 + Math.random() * 0.15;
      this.width = 1.0 + Math.random() * 1.5;
    }

    update() {
      this.x -= this.speed;
      return this.x > -this.length - 50;
    }

    draw() {
      const isDark = document.body.classList.contains("dark-mode");
      ctx.strokeStyle = isDark
        ? `rgba(224, 242, 254, ${this.opacity})`
        : `rgba(148, 163, 184, ${this.opacity})`;
      ctx.lineWidth = this.width;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.quadraticCurveTo(
        this.x + this.length / 2,
        this.y + Math.sin(this.x * 0.01) * 15,
        this.x + this.length,
        this.y,
      );
      ctx.stroke();
    }
  }

  // --- 4. SUN RISING & SUMMER PARTICLES ---
  class AmberSparkle {
    constructor(type = "sunrise") {
      this.type = type; // 'sunrise', 'summer', 'sunset'
      this.reset(true);
    }

    reset(isInitial = false) {
      this.x = Math.random() * width;
      this.y = isInitial ? Math.random() * height : height + 10;
      this.size = 1.5 + Math.random() * 2.5;

      if (this.type === "summer") {
        this.vy = -0.4 - Math.random() * 0.6;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.maxAge = 250 + Math.random() * 150;
      } else if (this.type === "sunset") {
        this.vy = -0.2 - Math.random() * 0.4;
        this.vx = -0.3 - Math.random() * 0.5; // drift slow top left
        this.maxAge = 400 + Math.random() * 200;
      } else {
        // sunrise
        this.vy = -0.3 - Math.random() * 0.5;
        this.vx = 0.2 + Math.random() * 0.6; // drift towards top right
        this.maxAge = 300 + Math.random() * 200;
      }

      this.age = 0;
      this.opacity = 0.15 + Math.random() * 0.45;
      this.phase = Math.random() * Math.PI * 2;
      this.phaseSpeed = 0.01 + Math.random() * 0.02;
    }

    update() {
      this.age++;
      this.y += this.vy;
      this.x += this.vx + Math.sin(this.phase) * 0.2;
      this.phase += this.phaseSpeed;

      if (
        this.x < -10 ||
        this.x > width + 10 ||
        this.y < -10 ||
        this.age > this.maxAge
      ) {
        return false;
      }
      return true;
    }

    draw() {
      const lifeRatio = 1.0 - this.age / this.maxAge;
      const pulse = Math.sin(this.age * 0.05 + this.phase) * 0.2 + 0.8;
      const curOpacity = this.opacity * lifeRatio * pulse;

      const isDark = document.body.classList.contains("dark-mode");

      if (this.type === "summer") {
        ctx.fillStyle = isDark
          ? `rgba(253, 224, 71, ${curOpacity})`
          : `rgba(245, 158, 11, ${curOpacity})`;
        ctx.shadowColor = "rgba(245, 158, 11, 0.5)";
      } else if (this.type === "sunset") {
        ctx.fillStyle = isDark
          ? `rgba(232, 121, 249, ${curOpacity})`
          : `rgba(219, 39, 119, ${curOpacity * 0.8})`;
        ctx.shadowColor = "rgba(219, 39, 119, 0.5)";
      } else {
        // sunrise
        ctx.fillStyle = isDark
          ? `rgba(251, 191, 36, ${curOpacity})`
          : `rgba(239, 68, 68, ${curOpacity * 0.8})`;
        ctx.shadowColor = "rgba(251, 191, 36, 0.5)";
      }

      ctx.shadowBlur = isDark ? 6 : 0;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    }
  }

  // --- 5. CLOUDY MIST PARTICLES ---
  class MistParticle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * (width + 200) - 100;
      this.y = Math.random() * height * 0.7;
      this.radius = 40 + Math.random() * 80;
      this.vx = -0.2 - Math.random() * 0.3;
      this.vy = (Math.random() - 0.5) * 0.05;
      this.opacity = 0.03 + Math.random() * 0.06;
      this.maxAge = 600 + Math.random() * 400;
      this.age = 0;
    }

    update() {
      this.age++;
      this.x += this.vx;
      this.y += this.vy;
      return this.age < this.maxAge && this.x > -this.radius * 2;
    }

    draw() {
      const lifeRatio = Math.sin((this.age / this.maxAge) * Math.PI);
      const isDark = document.body.classList.contains("dark-mode");
      const grad = ctx.createRadialGradient(
        this.x,
        this.y,
        0,
        this.x,
        this.y,
        this.radius,
      );
      const col = isDark ? "47, 55, 73" : "203, 213, 225";
      grad.addColorStop(0, `rgba(${col}, ${this.opacity * lifeRatio})`);
      grad.addColorStop(1, `rgba(${col}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- 6. MOON STAR PARTICLES ---
  class Star {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height * 0.75; // sky region
      this.size = 0.6 + Math.random() * 1.4;
      this.opacity = 0.25 + Math.random() * 0.65;
      this.twinkleSpeed = 0.01 + Math.random() * 0.025;
      this.phase = Math.random() * Math.PI * 2;
    }

    update() {
      this.phase += this.twinkleSpeed;
      return true;
    }

    draw() {
      const alpha = this.opacity * (0.35 + Math.sin(this.phase) * 0.65);
      ctx.fillStyle = `rgba(248, 250, 252, ${alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- 7. MATRIX SYSTEM ---
  class MatrixCode {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.speed = 3 + Math.random() * 4;
      this.chars = [];
      this.fontSize = 12 + Math.random() * 6;
      this.opacity = 0.4 + Math.random() * 0.6;
      this.length = 10 + Math.floor(Math.random() * 15);
      this.lastUpdate = 0;
      this.updateInterval = 60 + Math.random() * 60; // change characters randomly
    }

    update() {
      this.y += this.speed;

      const now = Date.now();
      if (now - this.lastUpdate > this.updateInterval) {
        // Scroll down and add a new random character at the head
        const characters =
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍｦｲｸｺｿﾁﾄﾉﾌﾔﾖﾙﾚﾛﾝ";
        const char = characters.charAt(
          Math.floor(Math.random() * characters.length),
        );
        this.chars.unshift(char);
        if (this.chars.length > this.length) {
          this.chars.pop();
        }
        this.lastUpdate = now;
      }

      if (this.y - this.length * this.fontSize > height) {
        this.y = -20;
        this.speed = 3 + Math.random() * 4;
        this.chars = [];
      }
      return true;
    }

    draw() {
      ctx.font = `bold ${this.fontSize}px 'JetBrains Mono', monospace`;
      for (let i = 0; i < this.chars.length; i++) {
        const charY = this.y - i * this.fontSize;
        if (charY < 0 || charY > height) continue;

        // First character is bright white-green, subsequent fade to darker green
        if (i === 0) {
          ctx.fillStyle = `rgba(180, 255, 180, ${this.opacity})`;
        } else {
          const ageMultiplier = (this.length - i) / this.length;
          ctx.fillStyle = `rgba(0, 255, 70, ${this.opacity * ageMultiplier})`;
        }
        ctx.fillText(this.chars[i], this.x, charY);
      }
    }
  }

  // --- SIMULATION PIPELINE METHODS ---

  function spawnDrippingDrop(x, y, vx, vy) {
    if (drops.length > CONFIG.maxDrops * 1.5) return;
    const d = new Drop();
    d.reset(false, x, y, vx, vy);
    drops.push(d);
  }

  function createSplash(x, y) {
    if (splashes.length > 300) return;
    const count = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < count; i++) {
      splashes.push(new SplashParticle(x, y));
    }
  }

  function generateBolt(x1, y1, x2, y2, displace) {
    const segments = [];
    function divide(xStart, yStart, xEnd, yEnd, disp) {
      if (disp < 4) {
        segments.push({ x1: xStart, y1: yStart, x2: xEnd, y2: yEnd });
        return;
      }
      const midX = (xStart + xEnd) / 2;
      const midY = (yStart + yEnd) / 2;
      const jitter = (Math.random() - 0.5) * disp;
      const newMidX = midX + jitter;

      divide(xStart, yStart, newMidX, midY, disp / 2);
      divide(newMidX, midY, xEnd, yEnd, disp / 2);

      if (Math.random() < 0.12 && disp > 16) {
        const bx = newMidX + (Math.random() - 0.5) * disp * 1.5;
        const by = midY + Math.random() * (yEnd - midY) * 0.8;
        divide(newMidX, midY, bx, by, disp / 2);
      }
    }
    divide(x1, y1, x2, y2, displace);
    return segments;
  }

  function triggerLightningStrike() {
    lightningOpacity = 0.4 + Math.random() * 0.25;
    setTimeout(() => {
      if (active && currentMode === "rain") {
        lightningOpacity = 0.5 + Math.random() * 0.35;
        const startX = Math.random() * width;
        const endX = startX + (Math.random() - 0.5) * 200;
        const endY = height * 0.3 + Math.random() * height * 0.5;
        activeBolt = {
          segments: generateBolt(startX, 0, endX, endY, 120),
          opacity: 1.0,
          width: 1.5 + Math.random() * 2,
        };
      }
    }, 150);
  }

  function setupCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "weather-canvas";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resizeCanvas();
  }

  // High-DPI Canvas Scaling
  function resizeCanvas() {
    if (!canvas) return;
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const isMobile = width < 768;
    const densityMultiplier = isMobile ? 0.45 : 1.0;

    CONFIG.maxDrops = Math.min(
      Math.floor(width * 0.15 * densityMultiplier),
      isMobile ? 80 : 250,
    );
    CONFIG.maxSnowflakes = Math.min(
      Math.floor(width * 0.12 * densityMultiplier),
      isMobile ? 70 : 220,
    );
    CONFIG.maxLeaves = Math.min(
      Math.floor(width * 0.04 * densityMultiplier),
      isMobile ? 25 : 70,
    );

    updateCachedObstacles();
  }

  function initEntities(mode) {
    drops = [];
    splashes = [];
    gearDroplets = [];
    cardDroplets = [];
    snowflakes = [];
    gearSnowlets = [];
    leaves = [];
    windStreaks = [];
    sparkles = [];
    mistParticles = [];
    stars = [];
    matrixCodes = [];
    lightningOpacity = 0;
    activeBolt = null;

    if (mode === "rain") {
      const initialCount = Math.floor(CONFIG.maxDrops * 0.4);
      for (let i = 0; i < CONFIG.maxDrops; i++) {
        drops.push(new Drop(i < initialCount));
      }
      nextLightningTime = Date.now() + 4000 + Math.random() * 6000;
    } else if (mode === "snowing") {
      const initialCount = Math.floor(CONFIG.maxSnowflakes * 0.5);
      for (let i = 0; i < CONFIG.maxSnowflakes; i++) {
        snowflakes.push(new Snowflake(i < initialCount));
      }
    } else if (mode === "windy") {
      const initialCount = Math.floor(CONFIG.maxLeaves * 0.4);
      for (let i = 0; i < CONFIG.maxLeaves; i++) {
        leaves.push(new Leaf(i < initialCount, true));
      }
      for (let i = 0; i < 4; i++) {
        windStreaks.push(new WindStreak());
      }
    } else if (mode === "cloudy") {
      for (let i = 0; i < CONFIG.maxMist * 0.6; i++) {
        const mp = new MistParticle();
        mp.x = Math.random() * width;
        mistParticles.push(mp);
      }
    } else if (mode === "fall") {
      const initialCount = Math.floor(CONFIG.maxLeaves * 0.4);
      for (let i = 0; i < CONFIG.maxLeaves; i++) {
        leaves.push(new Leaf(i < initialCount, false));
      }
    } else if (mode === "moon") {
      for (let i = 0; i < 60; i++) {
        stars.push(new Star());
      }
    } else if (mode === "matrix") {
      const columns = Math.floor(width / 14);
      for (let i = 0; i < columns; i++) {
        matrixCodes.push(new MatrixCode(i * 14, Math.random() * -height));
      }
    }
  }

  function cleanupWeatherEffect() {
    active = false;
    window.weatherGearSpeed = 0;
    stars = [];
    matrixCodes = [];
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx = null;
    }
    window.removeEventListener("resize", resizeCanvas);
  }

  // --- ANIMATION LOOP ---
  function loop() {
    if (!active) return;

    ctx.clearRect(0, 0, width, height);

    // Gather 2D page obstacles using cached document positions (avoid layout thrashing)
    const activeObstacles = [];
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    cachedPageObstacles.forEach((obs) => {
      const top = obs.pageTop - scrollY;
      const left = obs.pageLeft - scrollX;
      const bottom = top + obs.height;
      const right = left + obs.width;
      if (bottom > 0 && top < height && right > 0 && left < width) {
        activeObstacles.push({ left, top, right, bottom });
      }
    });

    if (cachedTerminalWindow) {
      const top = cachedTerminalWindow.pageTop - scrollY;
      const left = cachedTerminalWindow.pageLeft - scrollX;
      const bottom = top + cachedTerminalWindow.height;
      const right = left + cachedTerminalWindow.width;
      if (bottom > 0 && top < height && right > 0 && left < width) {
        activeObstacles.push({ left, top, right, bottom });
      }
    }

    // Gather projected Three.js gears coordinates
    const activeGears = [];
    if (
      window.gearsData &&
      window.gearsData.camera &&
      window.gearsData.gears &&
      typeof THREE !== "undefined" &&
      cachedGearContainer
    ) {
      const containerRect = {
        left: cachedGearContainer.pageLeft - scrollX,
        top: cachedGearContainer.pageTop - scrollY,
        width: cachedGearContainer.width,
        height: cachedGearContainer.height,
        right:
          cachedGearContainer.pageLeft - scrollX + cachedGearContainer.width,
        bottom:
          cachedGearContainer.pageTop - scrollY + cachedGearContainer.height,
      };

      if (
        containerRect.bottom > 0 &&
        containerRect.top < height &&
        containerRect.right > 0 &&
        containerRect.left < width
      ) {
        window.gearsData.gears.forEach((gear, idx) => {
          const wp = new THREE.Vector3();
          wp.setFromMatrixPosition(gear.mesh.matrixWorld);
          wp.project(window.gearsData.camera);

          const cx =
            containerRect.left + (wp.x * 0.5 + 0.5) * containerRect.width;
          const cy =
            containerRect.top + (-(wp.y * 0.5) + 0.5) * containerRect.height;

          const localPoint = new THREE.Vector3(gear.radiusOuter, 0, 0);
          gear.mesh.localToWorld(localPoint);
          localPoint.project(window.gearsData.camera);
          const px =
            containerRect.left +
            (localPoint.x * 0.5 + 0.5) * containerRect.width;
          const py =
            containerRect.top +
            (-(localPoint.y * 0.5) + 0.5) * containerRect.height;
          const radius = Math.hypot(px - cx, py - cy);

          activeGears.push({
            index: idx,
            cx: cx,
            cy: cy,
            radius: radius,
            mesh: gear.mesh,
          });
        });
      }
    }

    // --- RENDERING ACCORDING TO WEATHER MODE ---

    if (currentMode === "rain") {
      while (drops.length < CONFIG.maxDrops) {
        drops.push(new Drop());
      }

      const now = Date.now();
      if (now > nextLightningTime) {
        triggerLightningStrike();
        nextLightningTime = now + 10000 + Math.random() * 15000;
      }

      if (lightningOpacity > 0) {
        const isDark = document.body.classList.contains("dark-mode");
        ctx.fillStyle = isDark
          ? `rgba(240, 248, 255, ${lightningOpacity * 0.45})`
          : `rgba(186, 230, 253, ${lightningOpacity * 0.22})`;
        ctx.fillRect(0, 0, width, height);
        lightningOpacity -= 0.035;
      }

      if (activeBolt) {
        const isDark = document.body.classList.contains("dark-mode");
        ctx.strokeStyle = isDark
          ? `rgba(224, 242, 254, ${activeBolt.opacity * 0.95})`
          : `rgba(37, 99, 235, ${activeBolt.opacity * 0.65})`;
        ctx.lineWidth = activeBolt.width;
        if (isDark) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = "#e0f2fe";
        }
        ctx.beginPath();
        activeBolt.segments.forEach((seg) => {
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
        activeBolt.opacity -= 0.12;
        if (activeBolt.opacity <= 0) activeBolt = null;
      }

      drops = drops.filter((drop) => {
        const keep = drop.update(activeObstacles, activeGears);
        if (keep) drop.draw();
        return keep;
      });

      gearDroplets = gearDroplets.filter((droplet) => {
        const keep = droplet.update(activeGears);
        if (keep) droplet.draw();
        return keep;
      });

      cardDroplets = cardDroplets.filter((droplet) => {
        const keep = droplet.update();
        if (keep) droplet.draw();
        return keep;
      });

      splashes = splashes.filter((particle) => {
        const keep = particle.update();
        if (keep) particle.draw();
        return keep;
      });
    } else if (currentMode === "snowing") {
      while (snowflakes.length < CONFIG.maxSnowflakes) {
        snowflakes.push(new Snowflake());
      }

      snowflakes = snowflakes.filter((flake) => {
        const keep = flake.update(activeObstacles, activeGears);
        if (keep) flake.draw();
        return keep;
      });

      gearSnowlets = gearSnowlets.filter((snowlet) => {
        const keep = snowlet.update(activeGears);
        if (keep) snowlet.draw();
        return keep;
      });
    } else if (currentMode === "sun-rising") {
      // Sunbeams drawing (rotating radial wedges)
      const beamsCount = 8;
      const beamsCenterX = width - 110;
      const beamsCenterY = 80;
      const rotationSpeed = Date.now() * 0.00015;
      const isDark = document.body.classList.contains("dark-mode");

      ctx.save();
      ctx.translate(beamsCenterX, beamsCenterY);
      ctx.rotate(rotationSpeed);

      const beamColor = isDark
        ? "rgba(251, 146, 60, 0.025)"
        : "rgba(253, 224, 71, 0.04)";

      for (let i = 0; i < beamsCount; i++) {
        ctx.rotate((Math.PI * 2) / beamsCount);
        ctx.fillStyle = beamColor;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(1000, -80);
        ctx.lineTo(1000, 80);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (currentMode === "summer") {
      // Golden sunbeams coming down from top right
      const isDark = document.body.classList.contains("dark-mode");
      const pulse = Math.sin(Date.now() * 0.001) * 0.05 + 0.95;
      const gradient = ctx.createRadialGradient(
        width,
        0,
        0,
        width,
        0,
        Math.max(width, height) * 0.8 * pulse,
      );

      if (isDark) {
        gradient.addColorStop(0, "rgba(251, 146, 60, 0.08)");
        gradient.addColorStop(0.5, "rgba(251, 191, 36, 0.03)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      } else {
        gradient.addColorStop(0, "rgba(253, 224, 71, 0.12)");
        gradient.addColorStop(0.5, "rgba(251, 191, 36, 0.04)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else if (currentMode === "windy") {
      // Wind streaks
      while (windStreaks.length < 8) {
        windStreaks.push(new WindStreak());
      }
      windStreaks = windStreaks.filter((s) => {
        const keep = s.update();
        if (keep) s.draw();
        return keep;
      });

      // Blowing leaves
      while (leaves.length < CONFIG.maxLeaves) {
        leaves.push(new Leaf(false, true));
      }
      leaves = leaves.filter((leaf) => {
        const keep = leaf.update(activeObstacles);
        if (keep) leaf.draw();
        return keep;
      });
    } else if (currentMode === "cloudy") {
      // Mist particles
      while (mistParticles.length < CONFIG.maxMist) {
        mistParticles.push(new MistParticle());
      }
      mistParticles = mistParticles.filter((m) => {
        const keep = m.update();
        if (keep) m.draw();
        return keep;
      });
    } else if (currentMode === "fall") {
      // Autumn leaves falling gently
      while (leaves.length < CONFIG.maxLeaves) {
        leaves.push(new Leaf(false, false));
      }
      leaves = leaves.filter((leaf) => {
        const keep = leaf.update(activeObstacles);
        if (keep) leaf.draw();
        return keep;
      });
    } else if (currentMode === "moon") {
      // Twinkling stars
      stars.forEach((s) => {
        s.update();
        s.draw();
      });
    } else if (currentMode === "matrix") {
      matrixCodes.forEach((code) => {
        code.update();
        code.draw();
      });
    }

    // Update gears rotation tracking state
    if (activeGears.length > 0) {
      activeGears.forEach((gear) => {
        gear.mesh.lastZRotation = gear.mesh.rotation.z;
      });
    }

    animationFrameId = requestAnimationFrame(loop);
  }

  // Initialize default weather simulation based on time of day
  setWeather("auto", "⏰", "Auto (Time Sync)");
})();
