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

    // Updates all flying spheres, applying gravity and resolving collisions
    // against the floor AND against the world's static box obstacles.
    update(currentGravity, deltaTime, obstacles = []) {
        const dt = Math.min(deltaTime, 0.1);
        const maxLife = 5.0;
        const sphereRadius = 0.25;

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.lifeTime += dt;

            // 1. Apply gravity drop to the vertical velocity component (Y)
            p.velocity.y -= currentGravity * dt;

            // 2. Move the mesh in space based on its vector components
            p.mesh.position.addScaledVector(p.velocity, dt);

            // 3. Simple ground bounce collision detection
            const floorY = sphereRadius; // Sphere radius offset from ground
            if (p.mesh.position.y <= floorY) {
                p.mesh.position.y = floorY;
                p.velocity.y = -p.velocity.y * 0.4; // Bounce up with loss of energy
                p.velocity.x *= 0.8; // Apply ground friction
                p.velocity.z *= 0.8;
            }

            // 4. Bounce against static box obstacles instead of passing through them
            this.resolveObstacleBounce(p, obstacles, sphereRadius);

            // 5. Memory cleanup: delete old projectiles
            if (p.lifeTime > maxLife) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.projectiles.splice(i, 1);
            }
        }
    }

    // Checks a projectile against every obstacle box and, on overlap, pushes the
    // sphere out along the axis of least penetration and reflects the velocity
    // component on that axis (with energy loss), so it bounces off cubes instead
    // of passing through them.
    resolveObstacleBounce(p, obstacles, radius) {
        if (!obstacles || obstacles.length === 0) return;

        const pos = p.mesh.position;

        for (const box of obstacles) {
            // Closest point on the box to the sphere's center
            const closestX = Math.max(box.min.x, Math.min(pos.x, box.max.x));
            const closestY = Math.max(box.min.y, Math.min(pos.y, box.max.y));
            const closestZ = Math.max(box.min.z, Math.min(pos.z, box.max.z));

            const dx = pos.x - closestX;
            const dy = pos.y - closestY;
            const dz = pos.z - closestZ;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq >= radius * radius) continue; // no overlap with this box

            // Penetration depth on each axis (how much we need to push out)
            const penX = radius - Math.abs(dx) + (dx === 0 ? 0 : 0);
            // Use the overlap on each world axis between sphere bounds and box bounds
            const overlapX = Math.min(pos.x + radius - box.min.x, box.max.x - (pos.x - radius));
            const overlapY = Math.min(pos.y + radius - box.min.y, box.max.y - (pos.y - radius));
            const overlapZ = Math.min(pos.z + radius - box.min.z, box.max.z - (pos.z - radius));

            // Push out and reflect velocity along the axis with the smallest overlap
            const minOverlap = Math.min(overlapX, overlapY, overlapZ);
            const bounceFactor = 0.5; // energy retained after bounce
            const friction = 0.85;    // damping on the other two axes

            if (minOverlap === overlapX) {
                pos.x += (dx >= 0 ? 1 : -1) * overlapX;
                p.velocity.x = -p.velocity.x * bounceFactor;
                p.velocity.y *= friction;
                p.velocity.z *= friction;
            } else if (minOverlap === overlapY) {
                pos.y += (dy >= 0 ? 1 : -1) * overlapY;
                p.velocity.y = -p.velocity.y * bounceFactor;
                p.velocity.x *= friction;
                p.velocity.z *= friction;
            } else {
                pos.z += (dz >= 0 ? 1 : -1) * overlapZ;
                p.velocity.z = -p.velocity.z * bounceFactor;
                p.velocity.x *= friction;
                p.velocity.y *= friction;
            }
        }
    }
}