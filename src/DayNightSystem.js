import * as THREE from 'three';

export class DayNightSystem {
    constructor(scene) {
        this.scene = scene;
        
        this.sunOrbitTime = 0;
        this.satelliteOrbitTime = Math.random() * 5; 
        this.currentSunIntensity = 1.2;
        this.textureLoader = new THREE.TextureLoader();

        // Procedural fallback textures for the Moon and Earth as seen from afar (Moon
        // from Earth, Earth from the Moon). Generated once here and reused - if a real
        // photo texture exists at ./assets/textures/<name>/color.jpg it's preferred and
        // loaded instead (see updateTheme), but these guarantee a realistic, textured
        // look even when that file is missing, instead of a flat solid-color sphere.
        this.moonProceduralTexture = this.createMoonProceduralTexture();
        this.earthProceduralTexture = this.createEarthProceduralTexture();

        // Updated Database: Reuses existing primary planet folders to guarantee textures load correctly
        // secondaryPhase: angle offset relative to the sun's own orbit clock.
        // Math.PI (180°) = rises when the sun sets, like a real moon.
        this.planetaryData = {
            mercury: { sunScale: 2.5, secondary: 'none',    orbitType: 'none' },
            venus:   { sunScale: 1.3, secondary: 'none',    orbitType: 'none' },
            earth:   { sunScale: 1.0, secondary: 'moon',    orbitType: 'synced',  secondaryPhase: Math.PI,        speedMult: 1.0, colorFallback: 0x888888 },
            moon:    { sunScale: 1.0, secondary: 'earth',   orbitType: 'fixed',  secondaryPhase: Math.PI * 0.95, speedMult: 0.12, colorFallback: 0x2233ff }, // Uses assets/textures/earth/
            mars:    { sunScale: 0.7, secondary: 'earth',   orbitType: 'synced',  secondaryPhase: Math.PI * 0.6,  speedMult: 1.8, colorFallback: 0x2233ff },
            jupiter: { sunScale: 0.4, secondary: 'saturn',  orbitType: 'synced',  secondaryPhase: Math.PI * 1.3,  speedMult: 0.6, colorFallback: 0xddaa55 },
            saturn:  { sunScale: 0.25, secondary: 'jupiter', orbitType: 'synced', secondaryPhase: Math.PI * 0.8,  speedMult: 0.5, colorFallback: 0xffe6cc },
            uranus:  { sunScale: 0.15, secondary: 'neptune', orbitType: 'synced', secondaryPhase: Math.PI * 1.5,  speedMult: 0.4, colorFallback: 0x060e21 },
            neptune: { sunScale: 0.1, secondary: 'uranus',  orbitType: 'synced',  secondaryPhase: Math.PI * 0.4,  speedMult: 0.45, colorFallback: 0x172b30 }
        };

        this.createRealisticSun();
        this.createSecondaryBody(); 
        this.createLights();
        
        this.updateTheme(0xffffff, 0.6, 'earth'); 
    }

   

createRealisticSun() {
    this.sunGroup = new THREE.Group();
    this.scene.add(this.sunGroup);

    // 1. CORE SUN SPHERE (The bright incandescent plasma center)
    const coreGeom = new THREE.SphereGeometry(3.5, 32, 32);
    this.coreMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        fog: false // FIX: Prevents the core sphere from turning grey/black in dense fog
    });
    this.sunCore = new THREE.Mesh(coreGeom, this.coreMaterial);
    this.sunGroup.add(this.sunCore);

    // 2. PROCEDURAL HIGH-DEFINITION CHROMOSPHERE CORONA
    const coronaCanvas = document.createElement('canvas');
    coronaCanvas.width = 512; 
    coronaCanvas.height = 512;
    const ctxCorona = coronaCanvas.getContext('2d');
    
    ctxCorona.clearRect(0, 0, 512, 512);
    
    const coronaGrad = ctxCorona.createRadialGradient(256, 256, 10, 256, 256, 256);
    coronaGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');     
    coronaGrad.addColorStop(0.1, 'rgba(255, 255, 200, 0.95)');   
    coronaGrad.addColorStop(0.25, 'rgba(255, 180, 50, 0.7)');    
    coronaGrad.addColorStop(0.5, 'rgba(255, 110, 20, 0.25)');    
    coronaGrad.addColorStop(0.8, 'rgba(230, 50, 10, 0.05)');     
    coronaGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');            
    
    ctxCorona.fillStyle = coronaGrad; 
    ctxCorona.fillRect(0, 0, 512, 512);

    const coronaTexture = new THREE.CanvasTexture(coronaCanvas);
    coronaTexture.premultiplyAlpha = true;

    this.coronaMaterial = new THREE.MeshBasicMaterial({
        map: coronaTexture, 
        blending: THREE.AdditiveBlending, 
        transparent: true, 
        depthWrite: false,
        fog: false // <--- CRITICAL FIX: Forces the sun glow to bypass Earth's atmospheric fog math!
    });
    this.sunCorona = new THREE.Mesh(new THREE.PlaneGeometry(35, 35), this.coronaMaterial);
    this.sunCorona.position.z = -0.1;
    this.sunGroup.add(this.sunCorona);

    // 3. ANAMORPHIC PHOTOREALISTIC LENS FLARES & SOLAR RAYS
    const flareCanvas = document.createElement('canvas');
    flareCanvas.width = 512; 
    flareCanvas.height = 512;
    const ctxFlare = flareCanvas.getContext('2d');
    
    ctxFlare.clearRect(0, 0, 512, 512);
    
    const flareGrad = ctxFlare.createRadialGradient(256, 256, 0, 256, 256, 256);
    flareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    flareGrad.addColorStop(0.2, 'rgba(255, 200, 100, 0.12)');
    flareGrad.addColorStop(0.6, 'rgba(255, 120, 40, 0.02)');
    flareGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctxFlare.fillStyle = flareGrad; 
    ctxFlare.fillRect(0, 0, 512, 512);

    const rayCount = 12;
    for (let i = 0; i < rayCount; i++) {
        const angle = (i * Math.PI) / (rayCount / 2);
        const rayLength = 180 + Math.sin(i * 3) * 60; 
        const rayThickness = (i % 2 === 0) ? 3 : 1; 
        
        ctxFlare.strokeStyle = (i % 2 === 0) ? 'rgba(255, 235, 180, 0.04)' : 'rgba(255, 160, 80, 0.02)';
        ctxFlare.lineWidth = rayThickness;
        
        ctxFlare.beginPath(); 
        ctxFlare.moveTo(256, 256);
        ctxFlare.lineTo(256 + Math.cos(angle) * 120, 256 + Math.sin(angle) * 120); 
        ctxFlare.stroke();
    }

    const flareTexture = new THREE.CanvasTexture(flareCanvas);
    flareTexture.premultiplyAlpha = true;

    this.flareMaterial = new THREE.MeshBasicMaterial({
        map: flareTexture, 
        blending: THREE.AdditiveBlending, 
        transparent: true, 
        depthWrite: false,
        fog: false // <--- CRITICAL FIX: Forces lens rays to render perfectly on top of atmospheric scattering
    });
    this.sunFlare = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this.flareMaterial);
    this.sunFlare.position.z = -0.2;
    this.sunGroup.add(this.sunFlare);
}

    createSecondaryBody() {
        // Reduced the geometry size slightly (from 5.0 to 3.5) so it looks naturally distant in deep space
        const geom = new THREE.SphereGeometry(3.5, 32, 32); 
        this.secondaryMaterial = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 });
        this.secondaryMesh = new THREE.Mesh(geom, this.secondaryMaterial);

        // FIX: Put the secondary body on a dedicated render/light layer (1).
        // This detaches it from the main `sunLight`, whose intensity is deliberately
        // dimmed based on the LOCAL horizon (sunrise/sunset on the ground the player
        // stands on). A real moon/earth seen from afar is still fully sunlit even
        // when it's night where the player is standing - that's exactly why we can
        // see the Moon at night. The dedicated `secondaryLight` below (also on layer 1)
        // lights ONLY this mesh, with a stable intensity, giving a correct, realistic
        // day/night terminator on the body itself instead of it going dark with the
        // local ground.
        this.secondaryMesh.layers.set(1);

        this.scene.add(this.secondaryMesh);
    }

    // Procedurally paints a lunar-looking surface: grey regolith base, a handful of
    // dark "maria" plains, and a scatter of craters with a bright rim on one side to
    // fake directional relief shading.
    createMoonProceduralTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#9a9a9a';
        ctx.fillRect(0, 0, size, size);

        // Dark basaltic "maria" patches
        for (let i = 0; i < 6; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = 40 + Math.random() * 70;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(65,65,70,0.55)');
            grad.addColorStop(1, 'rgba(65,65,70,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }

        // Craters: soft shadow + a bright highlight rim on one edge
        for (let i = 0; i < 150; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = 2 + Math.random() * 14;

            const shade = ctx.createRadialGradient(x, y, 0, x, y, r);
            shade.addColorStop(0, 'rgba(35,35,35,0.5)');
            shade.addColorStop(0.7, 'rgba(35,35,35,0.15)');
            shade.addColorStop(1, 'rgba(35,35,35,0)');
            ctx.fillStyle = shade;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = 'rgba(225,225,225,0.25)';
            ctx.lineWidth = Math.max(1, r * 0.15);
            ctx.beginPath();
            ctx.arc(x, y, r * 0.9, Math.PI * 1.1, Math.PI * 1.9);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    // Procedurally paints an Earth-looking surface: blue ocean gradient, irregular
    // green/brown continent blobs, white polar caps, and soft translucent cloud swirls.
    createEarthProceduralTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');

        const oceanGrad = ctx.createLinearGradient(0, 0, 0, size);
        oceanGrad.addColorStop(0, '#0a3d75');
        oceanGrad.addColorStop(0.5, '#1c5f9e');
        oceanGrad.addColorStop(1, '#0a3d75');
        ctx.fillStyle = oceanGrad;
        ctx.fillRect(0, 0, size, size);

        const continentColors = ['#3f6b34', '#5a7d3a', '#8a7248', '#4a7a3d'];
        for (let i = 0; i < 7; i++) {
            const cx = Math.random() * size;
            const cy = size * 0.15 + Math.random() * size * 0.7;
            const blobRadius = 30 + Math.random() * 60;
            ctx.fillStyle = continentColors[i % continentColors.length];
            ctx.beginPath();
            const points = 10;
            for (let p = 0; p <= points; p++) {
                const angle = (p / points) * Math.PI * 2;
                const rr = blobRadius * (0.6 + Math.random() * 0.6);
                const x = cx + Math.cos(angle) * rr;
                const y = cy + Math.sin(angle) * rr * 0.6;
                if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Polar ice caps
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(0, 0, size, size * 0.06);
        ctx.fillRect(0, size * 0.94, size, size * 0.06);

        // Cloud swirls
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = 15 + Math.random() * 35;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(255,255,255,0.5)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    createLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 1000; // Increased shadow clipping range for security
        
        const d = 40;
        this.sunLight.shadow.camera.left = -d; this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d; this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0005;
        this.scene.add(this.sunLight);

        // Soft bluish moonlight - only lit up (on Earth) when the moon is above the horizon
        this.moonLight = new THREE.DirectionalLight(0x9fb6ff, 0.0);
        this.moonLight.castShadow = false;
        this.scene.add(this.moonLight);
        this.scene.add(this.moonLight.target);

        // FIX: Dedicated light for the secondary body (Moon seen from Earth, Earth seen
        // from the Moon, etc). Lives on layer 1 ONLY, so it exclusively lights
        // `secondaryMesh` and never the ground/player. Its intensity is NOT tied to the
        // local sunY horizon-dimming factor, so the body stays properly (and
        // realistically) lit regardless of whether it's day or night where the player
        // is standing - only its own sun-facing hemisphere is bright, giving a correct
        // lit/dark terminator instead of a flat, lightless disc.
        this.secondaryLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.secondaryLight.castShadow = false;
        this.secondaryLight.layers.set(1);
        this.scene.add(this.secondaryLight);
        this.scene.add(this.secondaryLight.target);

        // Tiny ambient fill exclusively for the secondary body so its dark hemisphere
        // isn't pure black (subtle "earthshine"-like effect) - still layer 1 only.
        this.secondaryAmbient = new THREE.AmbientLight(0xffffff, 0.06);
        this.secondaryAmbient.layers.set(1);
        this.scene.add(this.secondaryAmbient);
    }

    updateTheme(sunColor, sunIntensity, planetName) {
        this.sunLight.color.setHex(sunColor);
        this.coreMaterial.color.setHex(sunColor);
        this.coronaMaterial.color.setHex(sunColor);
        this.flareMaterial.color.setHex(sunColor);
        this.currentSunIntensity = sunIntensity;
        this.activePlanet = planetName;

        const cfg = this.planetaryData[planetName] || this.planetaryData.earth;

        this.sunGroup.scale.setScalar(cfg.sunScale);

        if (cfg.secondary === 'none') {
            this.secondaryMesh.visible = false;
        } else {
            this.secondaryMesh.visible = true;
            // Pointing directly to the primary folders you already have in your project directory
            const texPath = `./assets/textures/${cfg.secondary}/color.jpg`;
            
            this.textureLoader.load(texPath, 
                (tex) => {
                    this.secondaryMaterial.map = tex;
                    this.secondaryMaterial.color.setHex(0xffffff); 
                    this.secondaryMaterial.needsUpdate = true;
                }, 
                undefined, 
                () => {
                    // FIX: instead of falling back to a flat solid color (which is what
                    // made the body look like a lifeless, textureless "planet"), use the
                    // procedural Moon/Earth texture generated in the constructor. Any
                    // other secondary body type (e.g. Jupiter/Saturn seen from a
                    // neighboring planet) still falls back to its plain color, since we
                    // don't have a dedicated procedural texture for those.
                    const proceduralTex =
                        cfg.secondary === 'moon' ? this.moonProceduralTexture :
                        cfg.secondary === 'earth' ? this.earthProceduralTexture :
                        null;

                    if (proceduralTex) {
                        this.secondaryMaterial.map = proceduralTex;
                        this.secondaryMaterial.color.setHex(0xffffff);
                    } else {
                        this.secondaryMaterial.map = null;
                        this.secondaryMaterial.color.setHex(cfg.colorFallback);
                    }
                    this.secondaryMaterial.needsUpdate = true;
                }
            );
        }
    }

    update(deltaTime, playerPosition, camera) {
    this.sunOrbitTime += deltaTime * 0.05;
    
    // Pushed the celestial distance to 450 meters so objects stay strictly in the backdrop sky
    const orbitRadius = 450; 
    
    const sunX = Math.cos(this.sunOrbitTime) * orbitRadius;
    // Offset Y translation + 80 ensures the celestial bodies never dip beneath the flat ground plane grid
    const sunY = Math.sin(this.sunOrbitTime) * (orbitRadius - 100) + 80; 
    const sunZ = Math.sin(this.sunOrbitTime * 0.5) * 100;    

    this.sunGroup.position.set(playerPosition.x + sunX, playerPosition.y + sunY, playerPosition.z + sunZ);

    // Identify the active planet safely (fallback to earth if undefined)
    const currentPlanet = this.activePlanet || 'earth';

    if (this.secondaryMesh.visible) {
        const cfg = this.planetaryData[currentPlanet] || this.planetaryData.earth;
        let secX = 0, secY = 0, secZ = 0;

        if (cfg.orbitType === 'fixed') {
            // Earth seen from the Moon: locked high up safely in the stars backdrop
            secX = 150;
            secY = 300;
            secZ = -250;
        } else {
            // 'synced': shares the sun's own orbit clock with a phase offset, so the body
            // genuinely rises and sets instead of looping artificially clamped near the top.
            const angle = this.sunOrbitTime * (cfg.speedMult || 1.0) + (cfg.secondaryPhase || Math.PI);
            secX = Math.cos(angle) * (orbitRadius - 50);
            secY = Math.sin(angle) * (orbitRadius - 100) + 80;
            secZ = Math.sin(angle * 0.5) * 100;
        }

        this.secondaryMesh.position.set(playerPosition.x + secX, playerPosition.y + secY, playerPosition.z + secZ);
        this.secondaryMesh.rotation.y += deltaTime * 0.02;

        // FIX: Feed the dedicated secondary-body light with the SAME direction as the
        // real sun (sun position -> player), so the lit/dark hemisphere of the body
        // matches the true sun angle (correct "phase"), but keep its intensity stable
        // instead of using the horizon-dimmed `sunLight.intensity`. This is what makes
        // the Moon/Earth stay realistically visible and lit at any time of day.
        this.secondaryLight.position.copy(this.sunGroup.position);
        this.secondaryLight.target.position.copy(this.secondaryMesh.position);
        this.secondaryLight.target.updateMatrixWorld();
        this.secondaryLight.intensity = this.currentSunIntensity;

        // --- MOONLIGHT / NIGHT DIRECTIONAL LIGHT LOGIC ---
        // We only want directional moonlight on Earth. For other planets, we strictly avoid any directional night beam.
        if (currentPlanet === 'earth' && cfg.secondary === 'moon') {
            this.moonLight.position.copy(this.secondaryMesh.position);
            this.moonLight.target.position.copy(playerPosition);
            this.moonLight.target.updateMatrixWorld();
            const moonFactor = THREE.MathUtils.clamp(secY / 200, 0, 1);
            this.moonLight.intensity = moonFactor * 0.25;
        } else {
            this.moonLight.intensity = 0.0;
        }
    } else {
        this.moonLight.intensity = 0.0;
    }

    if (camera) {
        this.sunCorona.lookAt(camera.position);
        this.sunFlare.lookAt(camera.position);
        this.sunFlare.rotation.z = this.sunOrbitTime * 0.2;

        // FIX: The secondary body lives on layer 1 (see createSecondaryBody). The
        // camera must explicitly enable that layer or it will simply never render it.
        camera.layers.enable(1);
    }

    this.sunLight.position.copy(this.sunGroup.position);
    this.sunLight.target.position.copy(playerPosition);
    this.sunLight.target.updateMatrixWorld();

    // Zenith boost: extra brightness the higher the sun climbs, on top of the base intensity
    const zenithFactor = THREE.MathUtils.clamp(sunY / 300, 0, 1);
    const zenithBoost = 1.0 + zenithFactor * 0.35;

    if (sunY < 40) {
        const factor = Math.max(0, (sunY - 10) / 30);
        this.sunLight.intensity = this.currentSunIntensity * factor;
        this.coronaMaterial.opacity = factor;
        this.flareMaterial.opacity = factor;
    } else {
        this.sunLight.intensity = this.currentSunIntensity * zenithBoost;
        this.coronaMaterial.opacity = 1.0;
        this.flareMaterial.opacity = 1.0;
    }

    // --- AMBIENT LIGHTING SYSTEM ---
    if (currentPlanet === 'earth') {
        // Earth behaves dynamically: dark ambient light during night time
        const ambientFactor = THREE.MathUtils.clamp((sunY - 10) / 60, 0.08, 1.0);
        this.ambientLight.intensity = 0.15 * ambientFactor * zenithBoost;
    } else {
        // Other planets: when the sun goes down (sunY < 0), we inject a steady, soft ambient light baseline.
        // This keeps the landscape visible everywhere without casting any specific moon beams or harsh shadows.
        if (sunY < 0) {
            this.ambientLight.intensity = 0.25; // Soft global visibility baseline at night
        } else {
            // Smoothly transitions into daylight ambient brightness as the sun goes up
            const sunFactor = THREE.MathUtils.clamp(sunY / 60, 0, 1);
            this.ambientLight.intensity = THREE.MathUtils.lerp(0.25, 0.45, sunFactor) * zenithBoost;
        }
    }
    }}