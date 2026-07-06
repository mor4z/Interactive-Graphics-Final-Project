import * as THREE from 'three';

export class SkyboxManager {
    constructor(scene) {
        this.scene = scene;
        this.starsMesh = null;
        this.skyRotationTime = 0;
        this.currentPlanet = 'earth';
        
        // BASELINE DATABASE: Earth set to its original steady color with fog disabled
        // star opacity is to show the stars from a specific planet
        this.atmosphereData = {
            mercury: { color: 0x000000, starOpacity: 1.0, starColor: 0xffffff, hasFog: false }, 
            venus:   { color: 0x5a3c16, starOpacity: 0.0, starColor: 0x000000, hasFog: true },  
            earth:   { color: 0x2a4d7c, starOpacity: 0.5, starColor: 0xddddff, hasFog: false }, // <-- Fog completely disabled
            moon:    { color: 0x000000, starOpacity: 1.0, starColor: 0xffffff, hasFog: false }, 
            mars:    { color: 0x4d261a, starOpacity: 0.6, starColor: 0xffeedd, hasFog: true },  
            jupiter: { color: 0x21160c, starOpacity: 0.0, starColor: 0x000000, hasFog: true },  
            saturn:  { color: 0x2e2719, starOpacity: 0.0, starColor: 0x000000, hasFog: true },
            uranus:  { color: 0x0f2024, starOpacity: 0.0, starColor: 0x000000, hasFog: true },
            neptune: { color: 0x060e21, starOpacity: 0.0, starColor: 0x000000, hasFog: true }
        };

        // Day/Night sky color ramp - only used for Earth's dynamic atmosphere
        this.earthSkyDay = new THREE.Color(0x2a4d7c);
        this.earthSkyDusk = new THREE.Color(0xb5572a);
        this.earthSkyNight = new THREE.Color(0x00000a);

        this.createProceduralStars();
    }

    createProceduralStars() {
        const starCount = 2000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            const radius = 300 + Math.random() * 50; 
            const u = Math.random(); const v = Math.random();
            const theta = u * 2.0 * Math.PI; const phi = Math.acos(2.0 * v - 1.0);
            positions[i]     = radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = radius * Math.cos(phi);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.starMaterial = new THREE.PointsMaterial({
            color: 0xffffff, size: 0.9, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false 
        });

        this.starsMesh = new THREE.Points(geometry, this.starMaterial);
        this.scene.add(this.starsMesh);
    }

    updateAtmosphere(planetName) {
        this.currentPlanet = planetName;
        const cfg = this.atmosphereData[planetName] || this.atmosphereData.earth;

        // Apply stable, static background colors for ALL planets (including Earth)
        if (this.scene.background && typeof this.scene.background.setHex === 'function') {
            this.scene.background.setHex(cfg.color);
        } else {
            this.scene.background = new THREE.Color(cfg.color);
        }

        if (this.scene.fog) {
            if (cfg.hasFog) {
                this.scene.fog.color.setHex(cfg.color);
                this.scene.fog.density = 0.015;
            } else {
                this.scene.fog.density = 0.0; // Hard clamp to ensure zero fog tracking artifacts
            }
        }

        this.starMaterial.opacity = cfg.starOpacity;
        this.starMaterial.color.setHex(cfg.starColor);
    }

    // RESTORED: Removed dynamic lerps to keep colors perfectly locked and stable
    update(playerPosition, deltaTime, sunNormalizedY = 0) {
        if (this.starsMesh) {
            this.starsMesh.position.copy(playerPosition);
            this.skyRotationTime += deltaTime * 0.002;
            this.starsMesh.rotation.y = this.skyRotationTime;
            this.starsMesh.rotation.z = this.skyRotationTime * 0.3;
        }

        // Dynamic day/night atmosphere ONLY on Earth - other planets keep their fixed look
        if (this.currentPlanet === 'earth') {
            // sunNormalizedY: ~ -1 (below horizon) -> 0 (horizon) -> 1 (zenith)
            const t = THREE.MathUtils.clamp(sunNormalizedY, -1, 1);

            let skyColor;
            let starOpacity;

            if (t >= 0) {
                // Day: blend from dusk (t=0) to full day (t=0.4+)
                const dayT = THREE.MathUtils.clamp(t / 0.4, 0, 1);
                skyColor = this.earthSkyDusk.clone().lerp(this.earthSkyDay, dayT);
                starOpacity = THREE.MathUtils.lerp(0.5, 0.0, dayT);
            } else {
                // Night: blend from dusk (t=0) to full night (t=-0.3 and below)
                const nightT = THREE.MathUtils.clamp(-t / 0.3, 0, 1);
                skyColor = this.earthSkyDusk.clone().lerp(this.earthSkyNight, nightT);
                starOpacity = THREE.MathUtils.lerp(0.5, 1.0, nightT);
            }

            if (this.scene.background && typeof this.scene.background.copy === 'function') {
                this.scene.background.copy(skyColor);
            } else {
                this.scene.background = skyColor.clone();
            }

            this.starMaterial.opacity = starOpacity;
            this.starMaterial.color.setHex(0xddddff);
        }
    }
}