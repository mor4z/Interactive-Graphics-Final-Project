import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.textureLoader = new THREE.TextureLoader();

        this.themes = {
            mercury: { fog: 0x050505, sunIntensity: 3.0, sunColor: 0xfff3cc, folder: './assets/textures/mercury/' },
            venus:   { fog: 0x8a5a16, sunIntensity: 1.8, sunColor: 0xffd0a1, folder: './assets/textures/venus/' },
            earth:   { fog: 0x1a1a2e, sunIntensity: 1.2, sunColor: 0xffffff, folder: './assets/textures/earth/' },
            moon:    { fog: 0x0a0a14, sunIntensity: 1.2, sunColor: 0xeeeeff, folder: './assets/textures/moon/' },
            mars:    { fog: 0x4d261a, sunIntensity: 0.8, sunColor: 0xffcccc, folder: './assets/textures/mars/' },
            jupiter: { fog: 0x2e1f13, sunIntensity: 0.6, sunColor: 0xffe6cc, folder: './assets/textures/jupiter/' },
            saturn:  { fog: 0x3d3525, sunIntensity: 0.5, sunColor: 0xfffae6, folder: './assets/textures/saturn/' },
            uranus:  { fog: 0x172b30, sunIntensity: 0.3, sunColor: 0xccf2ff, folder: './assets/textures/uranus/' },
            neptune: { fog: 0x0b1630, sunIntensity: 0.2, sunColor: 0xccd9ff, folder: './assets/textures/neptune/' }
        };

        this.createGround();
        this.createReferenceObjects();
        this.updatePlanetTextures('earth');
    }

    createGround() {
    // INCREASED SEGMENTS: Changed from 128x128 to 512x512. 
    // This provides enough vertex density to physically deform the vertices into 3D hills and craters.
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000, 512, 512);
    
    this.groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        roughness: 0.95,  
        metalness: 0.0,
        // displacementScale: Controls how high the 3D mountains/crateri will physically look (in meters)
        displacementScale: 15.0, 
        // displacementBias: Offsets the baseline height calculation if needed
        displacementBias: 0.0 
    });
    
    const ground = new THREE.Mesh(groundGeometry, this.groundMaterial); 
    
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
}

    createReferenceObjects() {
        // Store static collision boxes (AABB) for these obstacles once, at creation
        // time, so the game loop doesn't have to recompute Box3.setFromObject() every
        // single frame - the obstacles never move so this is safe and cheap.
        this.obstacleBoxes = [];

        // Materials by obstacle "class" - purely visual, so it's obvious at a glance
        // which obstacles can be hopped over and which have to be walked around.
        const tallMaterial   = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.2, metalness: 0.8 });
        const mediumMaterial = new THREE.MeshStandardMaterial({ color: 0x8fa3b8, roughness: 0.4, metalness: 0.5 });
        const lowMaterial    = new THREE.MeshStandardMaterial({ color: 0xffa726, roughness: 0.6, metalness: 0.1 });

        // A varied obstacle field, identical on every planet, to properly test collision:
        // - "tall"   (6m):        always blocks movement, must be walked around
        // - "medium" (2.2-3m):    also blocks movement, still too tall to clear with a jump
        // - "low"    (0.5-0.85m): short enough to hop over (jump test) - see Physics.js,
        //   which now lets the player's vertical position clear an obstacle mid-jump
        //   instead of always treating it like a solid wall.
        const obstacleDefs = [
            // Tall towers
            { type: 'box', size: [2, 6, 2],       pos: [-5, -5],   material: tallMaterial },
            { type: 'box', size: [2, 6, 2],       pos: [5, -10],   material: tallMaterial },
            { type: 'box', size: [2, 6, 2],       pos: [-10, -20], material: tallMaterial },
            { type: 'box', size: [2, 6, 2],       pos: [8, -25],   material: tallMaterial },

            // Medium crates - block movement, too tall to jump
            { type: 'box', size: [2.2, 2.5, 2.2], pos: [10, -5],   material: mediumMaterial },
            { type: 'box', size: [2, 3, 2],       pos: [-9, -13],  material: mediumMaterial },
            { type: 'box', size: [2.5, 2.2, 1.5], pos: [3, -22],   material: mediumMaterial },

            // Low obstacles - short enough to hop over
            { type: 'box',      size: [2, 0.7, 2],     pos: [0, -8],   material: lowMaterial },
            { type: 'box',      size: [3, 0.6, 1.5],   pos: [-4, -16], material: lowMaterial },
            { type: 'cylinder', radius: 1.0, height: 0.8,  pos: [4, -18],  material: lowMaterial },
            { type: 'cylinder', radius: 0.8, height: 0.55, pos: [-2, -23], material: lowMaterial },
            { type: 'box',      size: [1.6, 0.85, 1.6], pos: [7, -3],   material: lowMaterial }
        ];

        obstacleDefs.forEach(def => {
            let mesh;

            if (def.type === 'cylinder') {
                const geom = new THREE.CylinderGeometry(def.radius, def.radius, def.height, 20);
                mesh = new THREE.Mesh(geom, def.material);
                mesh.position.set(def.pos[0], def.height / 2, def.pos[1]);
            } else {
                const [w, h, d] = def.size;
                const geom = new THREE.BoxGeometry(w, h, d);
                mesh = new THREE.Mesh(geom, def.material);
                mesh.position.set(def.pos[0], h / 2, def.pos[1]);
            }

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);

            this.obstacleBoxes.push(new THREE.Box3().setFromObject(mesh));
        });
    }

    // Returns the list of static obstacle AABBs used for player collision detection.
    getObstacleBoxes() {
        return this.obstacleBoxes;
    }

    updatePlanetTextures(planetName) {
        const theme = this.getPlanetTheme(planetName);
        const path = theme.folder;

        const configureTexture = (texture) => {
            texture.wrapS = THREE.RepeatWrapping; 
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(150, 150); 
            texture.anisotropy = 16;
        };

        this.textureLoader.load(`${path}color.jpg`, (tex) => { configureTexture(tex); this.groundMaterial.map = tex; this.groundMaterial.needsUpdate = true; }, undefined, () => { this.groundMaterial.map = null; this.groundMaterial.needsUpdate = true; });
        this.textureLoader.load(`${path}normal.jpg`, (normalTex) => { configureTexture(normalTex); this.groundMaterial.normalMap = normalTex; this.groundMaterial.normalScale.set(2.0, 2.0); this.groundMaterial.needsUpdate = true; }, undefined, () => { this.groundMaterial.normalMap = null; this.groundMaterial.needsUpdate = true; });
        this.textureLoader.load(`${path}roughness.jpg`, (roughTex) => { configureTexture(roughTex); this.groundMaterial.roughnessMap = roughTex; this.groundMaterial.needsUpdate = true; }, undefined, () => { this.groundMaterial.roughness = 0.9; this.groundMaterial.roughnessMap = null; this.groundMaterial.needsUpdate = true; });
        
        
    }


    getPlanetTheme(planetName) {
        return this.themes[planetName] || this.themes.earth;
    }
}