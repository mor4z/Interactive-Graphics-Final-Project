import * as THREE from 'three';

export class Player {
    constructor(scene) {
        this.scene = scene;

        // Core container moved by physics
        this.group = new THREE.Group();
        // Spawn Y must match Physics.eyeLevelY (distance from this origin down to the
        // feet) so the character starts with its feet exactly on the ground (y=0)
        // instead of floating or sinking on the very first frame.
        this.group.position.set(0, 2.0, 5); 
        this.scene.add(this.group);

        // Timer to control the throwing animation duration (in seconds)
        this.throwTimer = 0;

        // Visual orientation tracker for smooth body turning animations
        this.bodyRotationY = 0;

        this.createCharacterModel();
    }

    createCharacterModel() {
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.7, roughness: 0.3 });
        const visorMaterial = new THREE.MeshStandardMaterial({ color: 0x00a8ff, metalness: 0.9, roughness: 0.0 });

        // Torso
        this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.5), bodyMaterial);
        this.torso.castShadow = true;
        this.torso.receiveShadow = true;
        this.torso.position.set(0, -0.6, 0); 
        this.torsoBaseY = -0.6; // Resting local height of the torso, used as the anchor for the low-gravity walking bounce
        this.group.add(this.torso); 

        // Head & Visor
        this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), bodyMaterial);
        this.head.position.set(0, 0.85, 0);
        this.head.castShadow = true;
        this.torso.add(this.head); 

        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), visorMaterial);
        visor.position.set(0, 0.05, -0.26); // prova a modificare
        this.head.add(visor);

        // Limbs setup
        const armGeom = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        this.rightArmPivot = new THREE.Group(); this.rightArmPivot.position.set(0.55, 0.4, 0); this.torso.add(this.rightArmPivot);
        const rightArmMesh = new THREE.Mesh(armGeom, bodyMaterial); rightArmMesh.position.set(0, -0.3, 0); rightArmMesh.castShadow = true; this.rightArmPivot.add(rightArmMesh);

        this.leftArmPivot = new THREE.Group(); this.leftArmPivot.position.set(-0.55, 0.4, 0); this.torso.add(this.leftArmPivot);
        const leftArmMesh = new THREE.Mesh(armGeom, bodyMaterial); leftArmMesh.position.set(0, -0.3, 0); leftArmMesh.castShadow = true; this.leftArmPivot.add(leftArmMesh);

        const legGeom = new THREE.BoxGeometry(0.24, 0.8, 0.24);
        this.rightLegPivot = new THREE.Group(); this.rightLegPivot.position.set(0.22, -0.6, 0); this.torso.add(this.rightLegPivot);
        const rightLegMesh = new THREE.Mesh(legGeom, bodyMaterial); rightLegMesh.position.set(0, -0.4, 0); rightLegMesh.castShadow = true; this.rightLegPivot.add(rightLegMesh);

        this.leftLegPivot = new THREE.Group(); this.leftLegPivot.position.set(-0.22, -0.6, 0); this.torso.add(this.leftLegPivot);
        const leftLegMesh = new THREE.Mesh(legGeom, bodyMaterial); leftLegMesh.position.set(0, -0.4, 0); leftLegMesh.castShadow = true; this.leftLegPivot.add(leftLegMesh);
    }


       // Handling firstperson wiev
    updateFirstPersonVisibility(isFirstPerson) {
        if (isFirstPerson) {
            // hide head, show rest of body in firsti person
            this.head.visible = false;
            this.torso.visible = true;
        } else {
            // Show all body in third person
            this.head.visible = true;
            this.torso.visible = true;
        }
    }

   

    // Call this method whenever a projectile is fired to trigger the arm swing
    triggerThrowAnimation() {
        this.throwTimer = 0.3; // Animation will last 0.3 seconds
    }
    animateLimbs(deltaTime, isMoving, isGrounded, playerVelocityY, moveVector, yaw, gravityRatio = 1) {
        

        // Target angles for default state
        let rArmTargetX = 0;
        let rArmTargetZ = 0;
        let lArmTargetX = 0;
        let rLegTargetX = 0;
        let lLegTargetX = 0;

        // Clamp the ratio (currentGravity / earthGravity) so extreme planets (Jupiter's
        // 2.5x, the Moon's 0.16x) still produce a readable, non-glitchy animation instead
        // of an absurdly fast blur or an almost-frozen shuffle.
        const gRatio = Math.max(0.15, Math.min(2.5, gravityRatio));

        // 1. PHASE ONE: Baseline locomotive/environmental poses
        if (!isGrounded) {
            if (playerVelocityY > 0) {
                // JUMPING UP
                rArmTargetX = -Math.PI * 0.7;
                lArmTargetX = -Math.PI * 0.7;
                rLegTargetX = 0.3;
                lLegTargetX = -0.2;
            } else {
                // FALLING DOWN
                rArmTargetX = -Math.PI * 0.3;
                lArmTargetX = -Math.PI * 0.3;
                rLegTargetX = -0.2;
                lLegTargetX = 0.1;
            }
            // No footing while airborne: torso just rests at its base height.
            this.torso.position.y = this.torsoBaseY;
        } else if (isMoving) {
            // WALK ANIMATION: cadence and stride length now depend on the planet's gravity,
            // like a pendulum's period scales with sqrt(g). Heavier gravity (Jupiter) -> 
            // quicker, shorter, "heavier" looking steps. Lighter gravity (Moon, Mercury) ->
            // slower, floatier steps with a wider swing.
            const cadence = 0.012 * Math.sqrt(gRatio);
            const strideAmplitude = Math.min(1.1, 0.6 / Math.sqrt(gRatio));
            const time = Date.now() * cadence;
            const angle = Math.sin(time) * strideAmplitude;
            
            rArmTargetX = angle;
            lArmTargetX = -angle;
            rLegTargetX = -angle;
            lLegTargetX = angle;

            // Low-gravity "bunny hop" bounce: the lower the gravity, the more the torso
            // lifts with each stride (each footfall barely holds you down), while on
            // higher-gravity planets the bounce all but disappears and steps look flat
            // and grounded.
            const bounceStrength = 0.06 * Math.max(0, (1 / gRatio) - 1);
            const bounce = Math.max(0, Math.sin(time * 2)) * bounceStrength;
            this.torso.position.y = this.torsoBaseY + bounce;
        } else {
            // Standing still: settle back to the resting height.
            this.torso.position.y = this.torsoBaseY;
        }

        // --- CHARACTER MODEL TURNING LOGIC ---
        if (isMoving && moveVector && moveVector.lengthSq() > 0) {
            // Calculate movement vector angle relative to camera yaw direction
            const moveAngle = Math.atan2(moveVector.x, moveVector.z);
            // Add Math.PI to compensate for initial asset orientation looking backwards
            this.bodyRotationY = moveAngle - yaw + Math.PI;
        } else {
            // Reset rotation to align forward with view when stopped
            this.bodyRotationY = 0; 
        }

        // Smoothly interpolate torso rotation (Lerp) to prevent sudden snapping
        const rotationLerpSpeed = 10 * deltaTime;
        let angleDifference = this.bodyRotationY - this.torso.rotation.y;
        
        // Normalize angle differences between -PI and +PI to avoid the 360-degree flip bug
        angleDifference = Math.atan2(Math.sin(angleDifference), Math.cos(angleDifference));
        this.torso.rotation.y += angleDifference * rotationLerpSpeed;
        // -------------------------------------

        // 2. PHASE TWO: Overwrite right arm if THROW ANIMATION is active
        if (this.throwTimer > 0) {
            this.throwTimer -= deltaTime;
            rArmTargetX = -Math.PI / 1.2; 
            rArmTargetZ = -0.1; 
        }

        // 3. PHASE THREE: Smooth interpolation (Lerp) for organic transitions
        const lerpSpeed = (isGrounded ? 15 : 10) * deltaTime;
        
        this.rightArmPivot.rotation.x += (rArmTargetX - this.rightArmPivot.rotation.x) * lerpSpeed;
        this.leftArmPivot.rotation.x  += (lArmTargetX - this.leftArmPivot.rotation.x) * lerpSpeed;
        this.rightLegPivot.rotation.x += (rLegTargetX - this.rightLegPivot.rotation.x) * lerpSpeed;
        this.leftLegPivot.rotation.x  += (lLegTargetX - this.leftLegPivot.rotation.x) * lerpSpeed;
        this.rightArmPivot.rotation.z += (rArmTargetZ - this.rightArmPivot.rotation.z) * lerpSpeed;
    }


    getPosition() {
        return this.group.position;
    }
}