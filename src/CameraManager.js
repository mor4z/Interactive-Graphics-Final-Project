import * as THREE from 'three';

export class CameraManager {
    constructor(camera) {
        this.camera = camera;
        this.isFirstPerson = true;

        // Target offsets relative to the player position
        // First Person: right at eye level
        this.fpOffset = new THREE.Vector3(0, 0.5, -0.5);
        
        // Third Person: behind (+Z) and above (+Y)
        // We look down towards the character
        this.tpOffset = new THREE.Vector3(0, 2.5, 5.5);
    }

    toggleView() {
        this.isFirstPerson = !this.isFirstPerson;
    }

    // Now accepts the world's obstacle list to resolve camera collisions in
    // both view modes.
    update(playerPosition, yaw, pitch, obstacles = []) {
        if (this.isFirstPerson) {
            const rotatedFpOffset = this.fpOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
            const desiredFpPos = playerPosition.clone().add(rotatedFpOffset);

            const safeFpPos = this.resolveCameraCollision(playerPosition, desiredFpPos, obstacles, yaw, pitch, 0.15);
            this.camera.position.copy(safeFpPos);
            this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
        } else {
            const radius = 6.0;
            const baseHeight = 2.5;

            // How close to true ground level (world y=0) the orbiting camera is
            // allowed to get before we stop it from sinking further.
            const minGroundClearance = 0.4;

            // Solve for the maximum pitch (looking-up angle) that still keeps the
            // camera at or above minGroundClearance:
            //   cameraWorldY = playerPosition.y + baseHeight - radius*sin(pitch)
            //   playerPosition.y + baseHeight - radius*sin(pitch) >= minGroundClearance
            //   => sin(pitch) <= (playerPosition.y + baseHeight - minGroundClearance) / radius
            // This is recomputed every frame from the player's current height, so if
            // the player is standing on top of an obstacle (higher ground), the
            // allowed look-up angle automatically adjusts instead of using a fixed
            // constant that would be wrong at different elevations.
            const maxSinPitch = (playerPosition.y + baseHeight - minGroundClearance) / radius;
            const maxUpPitch = Math.asin(THREE.MathUtils.clamp(maxSinPitch, -1, 1));

            // Clamp ONLY the pitch value used here for the orbit math - this does not
            // touch mouseControls.pitch itself, so raw mouse tracking, first-person
            // view, and the throw direction (computed elsewhere from camera.quaternion)
            // are unaffected. It simply stops the third-person camera's vertical orbit
            // from continuing past the point where it would go below ground, so the
            // camera feels like it "hits" the terrain at that angle instead of clipping
            // through it, and moving the mouse further up has no additional effect
            // until you look back down.
            const clampedPitch = Math.min(pitch, maxUpPitch);

            const horizontalDist = radius * Math.cos(clampedPitch);
            const verticalShift = radius * Math.sin(clampedPitch);

            const offsetX = Math.sin(yaw) * horizontalDist;
            const offsetZ = Math.cos(yaw) * horizontalDist;
            const offsetY = baseHeight - verticalShift;

            const targetCamPos = playerPosition.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));

            const pivotOrigin = playerPosition.clone().add(new THREE.Vector3(0, baseHeight, 0));
            const safeCamPos = this.resolveCameraCollision(pivotOrigin, targetCamPos, obstacles, yaw, clampedPitch, 0.3);
            this.camera.position.copy(safeCamPos);

            const lookAtTarget = playerPosition.clone().add(new THREE.Vector3(0, -0.2, 0));
            this.camera.lookAt(lookAtTarget);
        }
    }

    // Raycasts from `origin` toward `desiredPosition` against the world's static
    // obstacle boxes. If something is hit before reaching the desired point, the
    // camera is stopped short of it (minus `buffer`) instead of clipping through
    // or into the geometry. This is what keeps the camera always showing the
    // obstacle's surface rather than passing beyond it.
    resolveCameraCollision(origin, desiredPosition, obstacles, buffer = 0.3) {
        if (!obstacles || obstacles.length === 0) return desiredPosition;

        const direction = new THREE.Vector3().subVectors(desiredPosition, origin);
        const fullDistance = direction.length();
        if (fullDistance === 0) return desiredPosition;

        direction.normalize();
        const ray = new THREE.Ray(origin, direction);
        const hitPoint = new THREE.Vector3();

        let closestDistance = fullDistance;

        for (const box of obstacles) {
            const intersection = ray.intersectBox(box, hitPoint);
            if (intersection) {
                const dist = origin.distanceTo(intersection);
                if (dist < closestDistance) {
                    closestDistance = dist;
                }
            }
        }

        const safeDistance = Math.max(0, closestDistance - buffer);
        return origin.clone().add(direction.multiplyScalar(safeDistance));
    }

    // FIXED: Computes the 4 corner points of the camera's near plane in world space, given
    // where the camera would be positioned and which way it's looking. Testing
    // collision only against the camera's center point (a single ray) ignores the
    // fact that the camera actually "sees" a rectangle at the near plane - so an
    // obstacle edge could clip into that rectangle's corners even when the center
    // ray doesn't hit anything, causing the visible edge mismatch/flicker you're
    // seeing near obstacle corners.
    getNearPlaneCorners(camPosition, yaw, pitch) {
        const near = this.camera.near;
        const fov = THREE.MathUtils.degToRad(this.camera.fov);
        const aspect = this.camera.aspect;

        const halfHeight = Math.tan(fov / 2) * near;
        const halfWidth = halfHeight * aspect;

        // Build the camera's local basis vectors from yaw/pitch, matching the same
        // 'YXZ' rotation order already used to set camera.rotation elsewhere.
        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);
        const up = new THREE.Vector3(0, 1, 0).applyEuler(euler);

        const center = camPosition.clone().add(forward.clone().multiplyScalar(near));

        return [
            center.clone().add(right.clone().multiplyScalar(halfWidth)).add(up.clone().multiplyScalar(halfHeight)),
            center.clone().sub(right.clone().multiplyScalar(halfWidth)).add(up.clone().multiplyScalar(halfHeight)),
            center.clone().add(right.clone().multiplyScalar(halfWidth)).sub(up.clone().multiplyScalar(halfHeight)),
            center.clone().sub(right.clone().multiplyScalar(halfWidth)).sub(up.clone().multiplyScalar(halfHeight))
        ];
    }

    //  FIXED: Raycasts from `origin` toward `desiredPosition`, AND toward each of the
    // camera's near-plane corners at that same desired position, against the
    // world's obstacle boxes. Takes the closest hit distance across all of them,
    // so an obstacle clipping into the edge of the view (not just the exact
    // center) still pulls the camera back correctly - this is what keeps the
    // visible edge lined up with the obstacle's real edge instead of flickering.
    resolveCameraCollision(origin, desiredPosition, obstacles, yaw, pitch, buffer = 0.3) {
        if (!obstacles || obstacles.length === 0) return desiredPosition;

        const direction = new THREE.Vector3().subVectors(desiredPosition, origin);
        const fullDistance = direction.length();
        if (fullDistance === 0) return desiredPosition;
        direction.normalize();

        // Test the center point plus the 4 near-plane corners projected at the
        // desired camera position, so partial edge overlap is caught too.
        const testPoints = [desiredPosition, ...this.getNearPlaneCorners(desiredPosition, yaw, pitch)];

        const ray = new THREE.Ray();
        const hitPoint = new THREE.Vector3();
        let closestDistance = fullDistance;

        for (const point of testPoints) {
            const testDir = new THREE.Vector3().subVectors(point, origin).normalize();
            ray.set(origin, testDir);

            for (const box of obstacles) {
                const intersection = ray.intersectBox(box, hitPoint);
                if (intersection) {
                    const dist = origin.distanceTo(intersection);
                    if (dist < closestDistance) {
                        closestDistance = dist;
                    }
                }
            }
        }

        // Buffer must be at least the camera's near distance, otherwise the near
        // plane itself would clip into the surface even after pulling back.
        const safeBuffer = Math.max(buffer, this.camera.near + 0.05);
        const safeDistance = Math.max(0, closestDistance - safeBuffer);
        return origin.clone().add(direction.multiplyScalar(safeDistance));
    }
}