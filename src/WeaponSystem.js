import * as THREE from 'three';

export class WeaponSystem {
    constructor(scene) {
        this.scene = scene;
        // Array to keep track of all flying objects in the scene
        this.projectiles = [];
    }

    // Spawns a new projectile with an initial position and directional velocity vector
    spawnProjectile(startPos, direction) {
        // Create a physical sphere geometry
        const geometry = new THREE.SphereGeometry(0.25, 16, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x00ff88, 
            metalness: 0.6, 
            roughness: 0.1,
            emissive: 0x003311 // Slight glow effect
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(startPos);
        mesh.castShadow = true;
        this.scene.add(mesh);

        // Initial throw speed multiplier
        const throwSpeed = 15;
        const velocity = direction.clone().multiplyScalar(throwSpeed);

        // Save projectile data for tracking
        this.projectiles.push({
            mesh: mesh,
            velocity: velocity,
            lifeTime: 0 // To delete it after a while and save memory
        });
    }

    // Updates all flying spheres, applying the specific planet's gravity to each
    update(currentGravity, deltaTime) {
        const dt = Math.min(deltaTime, 0.1);
        const maxLife = 5.0; // Seconds before the ball disappears

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.lifeTime += dt;

            // 1. Apply gravity drop to the vertical velocity component (Y)
            p.velocity.y -= currentGravity * dt;

            // 2. Move the mesh in space based on its vector components
            p.mesh.position.addScaledVector(p.velocity, dt);

            // 3. Simple ground bounce collision detection
            const floorY = 0.25; // Sphere radius offset from ground
            if (p.mesh.position.y <= floorY) {
                p.mesh.position.y = floorY;
                p.velocity.y = -p.velocity.y * 0.4; // Bounce up with loss of energy
                p.velocity.x *= 0.8; // Apply ground friction
                p.velocity.z *= 0.8;
            }

            // 4. Memory cleanup: delete old projectiles
            if (p.lifeTime > maxLife) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.projectiles.splice(i, 1);
            }
        }
    }
}