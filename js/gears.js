        (function () {
            function initGears() {
                const container = document.getElementById('gear-canvas-container');
                if (!container) return;

                // Scene Setup
                const scene = new THREE.Scene();

                // Camera
                const width = container.clientWidth || 200;
                const height = container.clientHeight || 200;
                const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
                camera.position.set(0, 0, 12);

                // Renderer
                const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                renderer.setSize(width, height);
                const isMobileDevice = window.innerWidth < 768;
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileDevice ? 1.5 : 2));
                container.appendChild(renderer.domElement);

            // Group to hold all gears for the mouse hover tilt effect
            const gearGroup = new THREE.Group();
            gearGroup.rotation.x = 0.35;
            gearGroup.rotation.y = -0.25;
            scene.add(gearGroup);

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
            dirLight1.position.set(5, 8, 5);
            scene.add(dirLight1);

            // Fill light to light up shadowed gear facets and make metal reflections look realistic
            const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
            dirLight2.position.set(-5, -8, -5);
            scene.add(dirLight2);

            const pointLight = new THREE.PointLight(0xffffff, 0.8, 30);
            pointLight.position.set(-3, -3, 6);
            scene.add(pointLight);

            // Materials and Theme Colors
            const colors = {
                dark: {
                    gear: 0xa0a5ad,       // Brushed matte silver
                    ambient: 0xffffff,
                    ambientIntensity: 0.35,
                    dirLight: 0xffffff,
                    dirIntensity: 0.6,
                    pointLight: 0xffffff,
                    pointIntensity: 0.4,
                    metalness: 0.6,
                    roughness: 0.45
                },
                light: {
                    gear: 0xb8bcc4,       // Bright brushed silver
                    ambient: 0xffffff,
                    ambientIntensity: 0.4,
                    dirLight: 0xffffff,
                    dirIntensity: 0.6,
                    pointLight: 0xffffff,
                    pointIntensity: 0.4,
                    metalness: 0.6,
                    roughness: 0.45
                }
            };

            const gearMaterial = new THREE.MeshStandardMaterial({
                color: colors.light.gear,
                metalness: colors.light.metalness,
                roughness: colors.light.roughness,
                flatShading: true
            });

            function applyTheme(isDark) {
                const theme = isDark ? colors.dark : colors.light;

                gearMaterial.color.setHex(theme.gear);
                gearMaterial.metalness = theme.metalness;
                gearMaterial.roughness = theme.roughness;

                ambientLight.color.setHex(theme.ambient);
                ambientLight.intensity = theme.ambientIntensity;

                dirLight1.color.setHex(theme.dirLight);
                dirLight1.intensity = theme.dirIntensity;
                dirLight2.intensity = theme.dirIntensity * 0.5;

                pointLight.color.setHex(theme.pointLight);
                pointLight.intensity = theme.pointIntensity;
            }

            // Initialize theme based on body class
            const isDarkInitial = document.body.classList.contains('dark-mode');
            applyTheme(isDarkInitial);

            // Expose the update function for the theme toggle click handler
            window.updateGearTheme = function (isDark) {
                applyTheme(isDark);
            };

            // Gear Geometry Generation
            function createGearGeometry(teeth, rInner, rOuter, rBore, thickness) {
                const shape = new THREE.Shape();
                const angleStep = (Math.PI * 2) / teeth;

                for (let i = 0; i < teeth; i++) {
                    const theta = i * angleStep;
                    const t0 = theta;
                    const t1 = theta + angleStep * 0.15;
                    const t2 = theta + angleStep * 0.35;
                    const t3 = theta + angleStep * 0.65;
                    const t4 = theta + angleStep * 0.85;

                    const p0_x = Math.cos(t0) * rInner;
                    const p0_y = Math.sin(t0) * rInner;
                    const p1_x = Math.cos(t1) * rInner;
                    const p1_y = Math.sin(t1) * rInner;
                    const p2_x = Math.cos(t2) * rOuter;
                    const p2_y = Math.sin(t2) * rOuter;
                    const p3_x = Math.cos(t3) * rOuter;
                    const p3_y = Math.sin(t3) * rOuter;
                    const p4_x = Math.cos(t4) * rInner;
                    const p4_y = Math.sin(t4) * rInner;

                    if (i === 0) {
                        shape.moveTo(p0_x, p0_y);
                    } else {
                        shape.lineTo(p0_x, p0_y);
                    }
                    shape.lineTo(p1_x, p1_y);
                    shape.lineTo(p2_x, p2_y);
                    shape.lineTo(p3_x, p3_y);
                    shape.lineTo(p4_x, p4_y);
                }
                shape.closePath();

                // Bore hole
                const holePath = new THREE.Path();
                const segments = 32;
                for (let i = 0; i <= segments; i++) {
                    const theta = -(i / segments) * Math.PI * 2;
                    const x = Math.cos(theta) * rBore;
                    const y = Math.sin(theta) * rBore;
                    if (i === 0) {
                        holePath.moveTo(x, y);
                    } else {
                        holePath.lineTo(x, y);
                    }
                }
                shape.holes.push(holePath);

                const extrudeSettings = {
                    steps: 1,
                    depth: thickness,
                    bevelEnabled: true,
                    bevelThickness: 0.08,
                    bevelSize: 0.04,
                    bevelSegments: 3
                };

                const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geometry.center();
                return geometry;
            }

            const thickness = 0.35;

            const teethA = 12;
            const geomA = createGearGeometry(teethA, 1.25, 1.75, 0.45, thickness);
            const gearA = new THREE.Mesh(geomA, gearMaterial);
            const posA = new THREE.Vector3(-1.1, -0.7, 0);
            gearA.position.copy(posA);
            gearGroup.add(gearA);

            const teethB = 16;
            const geomB = createGearGeometry(teethB, 1.75, 2.25, 0.6, thickness);
            const gearB = new THREE.Mesh(geomB, gearMaterial);
            const posB = new THREE.Vector3(1.7, 1.4, 0);
            gearB.position.copy(posB);
            gearGroup.add(gearB);

            const teethC = 8;
            const geomC = createGearGeometry(teethC, 0.8, 1.2, 0.3, thickness);
            const gearC = new THREE.Mesh(geomC, gearMaterial);
            const posC = new THREE.Vector3(-2.6, 1.3, 0);
            gearC.position.copy(posC);
            gearGroup.add(gearC);

            // Expose gears data globally for rain simulation interaction
            window.gearsData = {
                container: container,
                camera: camera,
                gears: [
                    { mesh: gearA, radiusInner: 1.25, radiusOuter: 1.75, pos: posA, teeth: teethA },
                    { mesh: gearB, radiusInner: 1.75, radiusOuter: 2.25, pos: posB, teeth: teethB },
                    { mesh: gearC, radiusInner: 0.8, radiusOuter: 1.2, pos: posC, teeth: teethC }
                ]
            };

            function getDrivenRotation(driverRotation, N_driver, N_driven, centerDriver, centerDriven, isValleyAligned = true) {
                const dx = centerDriven.x - centerDriver.x;
                const dy = centerDriven.y - centerDriver.y;
                const thetaContact = Math.atan2(dy, dx);
                const ratio = N_driver / N_driven;
                const phaseOffset = isValleyAligned ? Math.PI / N_driven : 0;
                return -driverRotation * ratio + thetaContact * (1 + ratio) + Math.PI - phaseOffset;
            }

            // Mouse Move Tilt
            let targetRotX = 0.35;
            let targetRotY = -0.25;

            container.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

                targetRotY = -0.25 + mouseX * 0.35;
                targetRotX = 0.35 - mouseY * 0.35;
            });

            container.addEventListener('mouseleave', () => {
                targetRotX = 0.35;
                targetRotY = -0.25;
            });

            // Click to Spin
            let spinVelocity = 0;
            let lightIntensityBoost = 0;

            container.addEventListener('click', () => {
                spinVelocity = 4.5;
                lightIntensityBoost = 1.2;
            });

            // Animation Loop
            const clock = new THREE.Clock();
            const baseSpeedScale = 0.35;
            let currentAngle = 0;

            function animate() {
                requestAnimationFrame(animate);

                const delta = clock.getDelta();
                spinVelocity += (0 - spinVelocity) * 0.05;
                const weatherSpeed = window.weatherGearSpeed || 0;
                const currentSpeed = baseSpeedScale + spinVelocity + weatherSpeed;
                currentAngle += delta * currentSpeed;

                gearA.rotation.z = currentAngle;
                gearB.rotation.z = getDrivenRotation(currentAngle, teethA, teethB, posA, posB, true);
                gearC.rotation.z = getDrivenRotation(currentAngle, teethA, teethC, posA, posC, true);

                gearGroup.rotation.x += (targetRotX - gearGroup.rotation.x) * 0.08;
                gearGroup.rotation.y += (targetRotY - gearGroup.rotation.y) * 0.08;

                lightIntensityBoost += (0 - lightIntensityBoost) * 0.08;
                const isDark = document.body.classList.contains('dark-mode');
                const theme = isDark ? colors.dark : colors.light;
                pointLight.intensity = theme.pointIntensity + lightIntensityBoost * 2.5;

                renderer.render(scene, camera);
            }

            animate();

            // Responsive Resize
            window.addEventListener('resize', () => {
                const w = container.clientWidth || 200;
                const h = container.clientHeight || 200;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            });
        }

        if (typeof THREE !== 'undefined') {
            initGears();
        } else {
            const s = document.getElementById('three-js-script');
            if (s) {
                s.addEventListener('load', initGears);
            }
        }
    })();
