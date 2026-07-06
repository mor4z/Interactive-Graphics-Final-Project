export class Physics {
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

        // CONSTANT MUSCULAR FORCE: The astronaut always pushes off the ground 
        // with a constant initial vertical velocity (in m/s).
        // 4.2 m/s corresponds to a realistic ~0.9 meter high jump on Earth.
        this.constantJumpLaunchVelocity = 4.2;

        // Ground reference: the player's group/camera origin sits this many meters
        // above the feet when standing. Shared by updateGravity() and the collision
        // code below so both agree on where the player's feet/head actually are.
        // FIX: this was 1.8, but the actual character model (see Player.js:
        // createCharacterModel) has its feet (bottom of the leg meshes) 2.0m below
        // the group origin, not 1.8m. That 0.2m mismatch meant every landing
        // calculation (flat ground AND obstacle tops) placed the group origin 0.2m
        // too low, so the feet mesh visibly sank into whatever surface the player
        // stood on - most noticeable on obstacles, since their flat rigid tops make
        // the clipping obvious (on the displaced terrain it was masked by the
        // ground's own height variation).
        this.eyeLevelY = 2.0;
        // Approximate total character height (feet to top of head), used to check
        // whether a jump is high enough to clear a low obstacle.
        // FIX: matches the real model height (leg bottom at -2.0 to head top at +0.5
        // relative to the group origin = 2.5m tall), previously an unrelated 1.9.
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
    // that point - whichever is highest. This is what lets the player actually land
    // ON TOP of an obstacle after clearing it with a jump, instead of falling straight
    // through it down to the flat ground and ending up wedged inside its volume.
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

    // FIX: updateGravity now also accepts the world's obstacle list. Previously it only
    // ever resolved falls against the flat ground (eyeLevelY), so a player who jumped
    // onto a low obstacle would fall straight through its top surface and get stuck
    // wedged inside its collision box, unable to move at all. Now it checks the actual
    // support height under the player's feet each frame (ground OR an obstacle's top),
    // so jumping onto something means landing cleanly on top of it, and walking off the
    // edge correctly resumes falling toward whatever is below.
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

        // FIX ("entra dentro l'ostacolo su gravità diverse"): getSupportHeight() only
        // checks the surface directly under the player's feet, computed once per frame.
        // On planets with strong gravity the player falls fast (large velocity, larger
        // per-frame Y step), and on planets with weak gravity a jump carries them very
        // high/far - in both cases it's possible for a single physics step to move the
        // player's feet from clearly above an obstacle's top to clearly below/inside it
        // before the normal landing check above ever gets a chance to catch them exactly
        // at the surface ("tunneling"). As a safety net, after the normal fall/landing
        // resolution we scan ALL obstacles the player's body is currently overlapping in
        // 3D (not just the one directly under their feet) and, if any is found, pop the
        // player back up to stand on top of it instead of leaving them wedged inside.
        // This is gravity-independent, so it fixes the issue on every planet.
        this.resolveObstaclePenetration(playerPosition, obstacles);
    }

    // Safety-net collision correction: pushes the player up out of any obstacle their
    // body currently overlaps in 3D (X/Z footprint AND vertical range), regardless of
    // how they ended up there. See the comment in updateGravity() for why this is
    // needed in addition to the normal per-frame ground/support check.
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
    // the current planet's gravity. Lower gravity means less resistance holding you
    // down with each stride, so movement feels lighter/quicker to cover ground (as it
    // already looks in the walk animation's longer strides); higher gravity means each
    // step is heavier and slower. Uses the same 1/sqrt(gravity) relationship as the
    // walk cycle's stride length in Player.animateLimbs, so the visual stride and the
    // actual distance covered stay coherent with each other.
    // Clamped to keep low-gravity planets (Moon) from feeling too twitchy and
    // high-gravity ones (Jupiter) from feeling nearly frozen.
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

    // Small vertical tolerance used when deciding whether the player's feet are
    // "above" an obstacle's top. Without this, standing exactly on top of an obstacle
    // (feetY numerically equal, or off by a hair due to floating point drift, to
    // box.max.y) could still be classified as overlapping the obstacle's body, which
    // then blocked ALL horizontal movement - the player would climb on top and then
    // appear completely frozen, as if still stuck against the obstacle's wall.
    static GROUND_EPSILON = 0.05;

    // Resolves horizontal movement against a list of static obstacle AABBs so the
    // player can no longer walk/clip through them. Each axis is tested independently
    // (classic "slide" collision): if moving on X alone would cause an overlap, that
    // axis is simply not applied, but the other axis can still succeed - this lets the
    // player slide smoothly along a wall's surface instead of getting stuck dead when
    // approaching it at an angle.
    //
    // Obstacles are also checked vertically. `position.y` is the player's eye/group
    // height (see eyeLevelY), from which we derive the feet and head height in world
    // space. If the player's feet are at or above an obstacle's top (within
    // GROUND_EPSILON - i.e. standing/landed on it), or their whole body is below its
    // bottom, that obstacle no longer blocks horizontal movement. This is what lets the
    // player hop clean over low obstacles, and freely walk around on top of one once
    // landed, instead of being treated as if still colliding with a wall.
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