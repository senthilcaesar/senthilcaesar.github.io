// Animated 3D birds (storks and parrots) flying across the page background.
// Models from the three.js examples (MIT, by mirada / ro.me), embedded in models/bird-models.js.
(function () {
  // model: which bird; scale: size; y: height (-1 bottom .. 1 top of view);
  // z: depth (negative = further away); speed: screen-widths per second (roughly);
  // flap: wing-beat speed; offset: starting point along the path (0..1)
  const FLOCK = [
    { model: "stork", scale: 0.6, y: 0.55, z: 0, speed: 0.032, flap: 1.0, offset: 0.2 },
    { model: "stork", scale: 0.45, y: 0.42, z: -250, speed: 0.032, flap: 1.15, offset: 0.12 },
    { model: "parrot", scale: 0.45, y: 0.3, z: -150, speed: 0.045, flap: 1.4, offset: 0.85 },
    { model: "parrot", scale: 0.35, y: 0.22, z: -350, speed: 0.045, flap: 1.55, offset: 0.78 },
  ];

  function init() {
    const container = document.getElementById("sky-birds");
    if (!container || typeof THREE === "undefined" || !THREE.GLTFLoader || !window.BIRD_MODELS) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      return; // no WebGL: just skip the birds
    }
    const isMobile = window.innerWidth < 768;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(0, 0, 1000);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(-1, 1.5, 1);
    scene.add(sun);

    // Visible half-width/height of the view at z = 0
    function viewHalf() {
      const h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      return { w: h * camera.aspect, h: h };
    }

    const birds = [];
    const loader = new THREE.GLTFLoader();
    FLOCK.forEach(function (s) {
      loader.load(window.BIRD_MODELS[s.model], function (gltf) {
        const mesh = gltf.scene.children[0];
        mesh.scale.setScalar(s.scale);
        const mixer = new THREE.AnimationMixer(mesh);
        const action = mixer.clipAction(gltf.animations[0]);
        action.timeScale = s.flap;
        action.startAt(-Math.random());
        action.play();
        scene.add(mesh);
        birds.push({ mesh: mesh, mixer: mixer, s: s, progress: s.offset });
      }, undefined, function (err) {
        console.warn("[birds] could not load model", err);
      });
    });

    const clock = new THREE.Clock();
    let running = true;

    function animate() {
      if (!running) return;
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;
      const half = viewHalf();

      birds.forEach(function (b, i) {
        b.mixer.update(dt);
        b.progress += b.s.speed * dt;
        if (b.progress > 1.15) b.progress -= 1.3;
        // depth-aware edges so birds start and end fully off-screen
        const depthScale = (camera.position.z - b.s.z) / camera.position.z;
        const edge = half.w * depthScale + 200;
        b.mesh.position.x = -edge + b.progress * edge * 2;
        b.mesh.position.y = half.h * depthScale * b.s.y + Math.sin(t * 0.6 + i * 2) * 25;
        b.mesh.position.z = b.s.z;
        // face the direction of travel, with a slight bank as they rise and fall
        b.mesh.rotation.y = Math.PI / 2;
        b.mesh.rotation.z = Math.cos(t * 0.6 + i * 2) * 0.08;
      });

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Pause when the tab is hidden to save battery
    document.addEventListener("visibilitychange", function () {
      const wasRunning = running;
      running = !document.hidden;
      if (running && !wasRunning) {
        clock.getDelta();
        animate();
      }
    });
  }

  let tries = 0;
  function waitForThree() {
    if (typeof THREE !== "undefined" && THREE.GLTFLoader) init();
    else if (++tries < 100) setTimeout(waitForThree, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForThree);
  else waitForThree();
})();
