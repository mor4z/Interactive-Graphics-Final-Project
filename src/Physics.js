export class Physics {
    // Small vertical tolerance used when deciding whether the player's feet are "above" an obstacle's top.
    static GROUND_EPSILON = 0.05;

    constructor() {
        // Real solar system gravity values (m/s²)
        this.gravities = {
            mercury: 3.70,      
            venus: 8.87,
            earth: 9.81,      
            moon: 1.62,         
            mars: 3.72,
            jupiter: 24.79,     
            saturn: 10.44,
            uranus: 8.69,
            neptune: 11.15
        };

        // Start on Earth by default, but the player can switch to any planet's gravity
        this.currentGravity = this.gravities.earth;
        this.playerVelocityY = 0;
        this.isGrounded = true;

        // CONSTANT MUSCULAR FORCE: The astronaut always pushes off the ground with a constant initial vertical velocity (in m/s).
        // 4.2 m/s corresponds to a realistic ~0.9 meter high jump on Earth.
        this.constantJumpLaunchVelocity = 4.2;

        // Ground reference: the player's group/camera origin sits this many meters
        // above the feet when standing. Shared by updateGravity() and the collision
        // code below so both agree on where the player's feet/head actually are.
        this.eyeLevelY = 2.0;

        // Approximate total character height (feet to top of head), used to check
        // whether a jump is high enough to clear a low obstacle.
        this.playerHeight = 2.5;

        this.initUIListener();
    }

    initUIListener() {
        const planetSelect = document.getElementById('planet-select');
        if (planetSelect) {
            planetSelect.addEventListener('change', (e) => {
                const selectedPlanet = e.target.value;
                this.currentGravity = this.gravities[selectedPlanet] || this.gravities.earth;
                
                // Dispatch a custom event so the World module knows it needs to change appearance
                const event = new CustomEvent('planetChanged', { detail: selectedPlanet });
                window.dispatchEvent(event);
            });
        }
    }

    // Returns the height of whatever surface is directly below the given X/Z point:
    // either the flat ground (0) or the top of an obstacle whose footprint contains
    // that point - whichever is highest.
    getSupportHeight(x, z, obstacles) {
        let highest = 0; // flat ground level
        if (obstacles) {
            for (const box of obstacles) {
                if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) {
                    if (box.max.y > highest) highest = box.max.y;
                }
            }
        }
        return highest;
    }


    updateGravity(playerPosition, deltaTime, obstacles = []) {
        const dt = Math.min(deltaTime, 0.1);

        const supportHeight = this.getSupportHeight(playerPosition.x, playerPosition.z, obstacles);
        const supportEyeY = this.eyeLevelY + supportHeight;

        if (playerPosition.y > supportEyeY || this.playerVelocityY > 0) {
            this.playerVelocityY -= this.currentGravity * dt;
            this.isGrounded = false;
        }

        playerPosition.y += this.playerVelocityY * dt;

        if (playerPosition.y <= supportEyeY) {
            playerPosition.y = supportEyeY;
            this.playerVelocityY = 0;
            this.isGrounded = true;
        }

        this.resolveObstaclePenetration(playerPosition, obstacles);
    }

    // Safety-net collision correction: pushes the player up out of any obstacle their
    // body currently overlaps in 3D (X/Z footprint AND vertical range), regardless of
    // how they ended up there.
    resolveObstaclePenetration(playerPosition, obstacles, radius = 0.5) {
        if (!obstacles || obstacles.length === 0) return;

        const feetY = playerPosition.y - this.eyeLevelY;
        const headY = feetY + this.playerHeight;

        for (const box of obstacles) {
            const overlapsXZ = this.circleIntersectsBox(playerPosition.x, playerPosition.z, box, radius);
            const overlapsY = feetY < box.max.y && headY > box.min.y;

            if (overlapsXZ && overlapsY) {
                // Pop the player up to stand cleanly on this obstacle's top surface.
                playerPosition.y = this.eyeLevelY + box.max.y;
                this.playerVelocityY = 0;
                this.isGrounded = true;
            }
        }
    }

    // Returns how many times stronger/weaker the current planet's gravity is compared
    // to Earth's (1.0 = Earth, <1 = lighter gravity like the Moon, >1 = heavier like
    // Jupiter). Used by the Player's walk animation to make locomotion feel different
    // on each planet without that module needing to know about the raw gravity table.
    // Returns how much the player's ground movement speed should be scaled based on
    // the current planet's gravity.
    getMoveSpeedMultiplier() {
        const gRatio = Math.max(0.15, Math.min(2.5, this.getGravityRatio()));
        return Math.max(0.6, Math.min(1.8, 1 / Math.sqrt(gRatio)));
    }

    getGravityRatio() {
        return this.currentGravity / this.gravities.earth;
    }

    handleJump() {
        if (this.isGrounded) {
            // The muscles fire with the exact same power regardless of where you are!
            this.playerVelocityY = this.constantJumpLaunchVelocity;
            this.isGrounded = false;
        }
    }

    // Returns true if a circle of the given radius centered at (x, z) overlaps the
    // given axis-aligned bounding box on the X/Z plane.
    circleIntersectsBox(x, z, box, radius) {
        const closestX = Math.max(box.min.x, Math.min(x, box.max.x));
        const closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
        const dx = x - closestX;
        const dz = z - closestZ;
        return (dx * dx + dz * dz) < (radius * radius);
    }

    // Resolves horizontal movement against static obstacle AABBs so the
    // player can no longer walk/clip through them.
    resolveHorizontalCollision(position, deltaMove, obstacles, radius = 0.5) {
        let nextX = position.x + deltaMove.x;
        let nextZ = position.z + deltaMove.z;

        if (obstacles && obstacles.length > 0) {
            const feetY = position.y - this.eyeLevelY;
            const headY = feetY + this.playerHeight;

            const relevant = obstacles.filter(box => feetY < box.max.y - Physics.GROUND_EPSILON && headY > box.min.y);

            // Test X movement alone
            const blockedX = relevant.some(box => this.circleIntersectsBox(nextX, position.z, box, radius));
            if (blockedX) nextX = position.x;

            // Test Z movement alone (using the already-resolved X so corners feel right)
            const blockedZ = relevant.some(box => this.circleIntersectsBox(nextX, nextZ, box, radius));
            if (blockedZ) nextZ = position.z;
        }

        return { x: nextX, z: nextZ };
    }
}