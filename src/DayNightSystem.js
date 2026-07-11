import * as THREE from 'three';

export class DayNightSystem {
    constructor(scene) {
        this.scene = scene;
        
        this.sunOrbitTime = 0;
        this.satelliteOrbitTime = Math.random() * 5; 
        this.currentSunIntensity = 1.2;
        this.textureLoader = new THREE.TextureLoader();

        
        // Math.PI (180°) = rises when the sun sets, like a real moon.
        this.planetaryData = {
            mercury: { sunScale: 2.5, secondary: 'none',    orbitType: 'none' },
            venus:   { sunScale: 1.3, secondary: 'none',    orbitType: 'none' },
            earth:   { sunScale: 1.0, secondary: 'moon',    orbitType: 'synced',  secondaryPhase: Math.PI,        speedMult: 1.0, colorFallback: 0x888888 },
            moon:    { sunScale: 1.0, secondary: 'earth',   orbitType: 'fixed',  secondaryPhase: Math.PI * 0.95, speedMult: 0.12, colorFallback: 0x2233ff }, 
            mars:    { sunScale: 0.7, secondary: 'earth',   orbitType: 'synced',  secondaryPhase: Math.PI * 0.6,  speedMult: 1.8, colorFallback: 0x2233ff },
            jupiter: { sunScale: 0.4, secondary: 'saturn',  orbitType: 'synced',  secondaryPhase: Math.PI * 1.3,  speedMult: 0.6, colorFallback: 0xddaa55 },
            saturn:  { sunScale: 0.25, secondary: 'jupiter', orbitType: 'synced', secondaryPhase: Math.PI * 0.8,  speedMult: 0.5, colorFallback: 0xffe6cc },
            uranus:  { sunScale: 0.15, secondary: 'neptune', orbitType: 'synced', secondaryPhase: Math.PI * 1.5,  speedMult: 0.4, colorFallback: 0x060e21 },
            neptune: { sunScale: 0.1, secondary: 'uranus',  orbitType: 'synced',  secondaryPhase: Math.PI * 0.4,  speedMult: 0.45, colorFallback: 0x172b30}
        };

        this.createRealisticSun();
        this.createSecondaryBody(); 
        this.createLights();
        
        this.updateTheme(0xffffff, 0.6, 'earth'); 
    }

    createRealisticSun() {
        this.sunGroup = new THREE.Group();
        this.scene.add(this.sunGroup);

        // CORE SUN SPHERE (The bright incandescent plasma center)
        const coreGeom = new THREE.SphereGeometry(3.5, 32, 32);
        this.coreMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            fog: false // Prevents the core sphere from turning grey/black in dense fog
        });
        this.sunCore = new THREE.Mesh(coreGeom, this.coreMaterial);
        this.sunGroup.add(this.sunCore);

        // PROCEDURAL HIGH-DEFINITION CHROMOSPHERE CORONA
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
            fog: false //Forces the sun glow to bypass Earth's atmospheric fog math!
        });
        this.sunCorona = new THREE.Mesh(new THREE.PlaneGeometry(35, 35), this.coronaMaterial);
        this.sunCorona.position.z = -0.1;
        this.sunGroup.add(this.sunCorona);

        // ANAMORPHIC PHOTOREALISTIC LENS FLARES & SOLAR RAYS
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
            fog: false //Forces lens rays to render perfectly on top of atmospheric scattering
        });
        this.sunFlare = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this.flareMaterial);
        this.sunFlare.position.z = -0.2;
        this.sunGroup.add(this.sunFlare);
    }

    createSecondaryBody() {
        // Reduced the geometry size slightly so it looks naturally distant in deep space
        const geom = new THREE.SphereGeometry(3.5, 32, 32); 
        this.secondaryMaterial = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 });
        this.secondaryMesh = new THREE.Mesh(geom, this.secondaryMaterial);

        // Put the secondary body on a dedicated render/light layer (1).
        this.secondaryMesh.layers.set(1);

        this.scene.add(this.secondaryMesh);
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
        this.sunLight.shadow.bias = -0.000005;
        this.scene.add(this.sunLight);

        // Soft bluish moonlight - only lit up (on Earth) when the moon is above the horizon
        this.moonLight = new THREE.DirectionalLight(0x9fb6ff, 0.0);
        this.moonLight.castShadow = false;
        this.scene.add(this.moonLight);
        this.scene.add(this.moonLight.target);

        //  Dedicated light for the secondary body (Moon seen from Earth, Earth seen
        // from the Moon, etc). Lives on layer 1 ONLY, so it exclusively lights
        // `secondaryMesh` and never the ground/player.
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
                    // Photo texture failed to load: fall back to a flat solid color
                    // for the secondary body (no procedural texture generation).
                    this.secondaryMaterial.map = null;
                    this.secondaryMaterial.color.setHex(cfg.colorFallback);
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

            // Feed the dedicated secondary-body light  This is what makes
            // the Moon/Earth stay realistically visible and lit at any time of day.
            this.secondaryLight.position.copy(this.sunGroup.position);
            this.secondaryLight.target.position.copy(this.secondaryMesh.position);
            this.secondaryLight.target.updateMatrixWorld();
            this.secondaryLight.intensity = this.currentSunIntensity;

            // Moonlight/Night directional light logic
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

            // The secondary body lives on layer 1 . The
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

        // Ambient lighting system 
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
    }
}