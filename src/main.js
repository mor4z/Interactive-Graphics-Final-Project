import * as THREE from 'three';
import { World } from './World.js';
import { Input } from './Input.js';
import { Physics } from './Physics.js';
import { Player } from './Player.js';
import { CameraManager } from './CameraManager.js';
import { MouseControls } from './MouseControls.js';
import { WeaponSystem } from './WeaponSystem.js';
import { DayNightSystem } from './DayNightSystem.js';
import { SkyboxManager } from './SkyboxManager.js'; // Import new module

let scene, camera, renderer;
let world, input, physics, player, cameraManager, mouseControls, weaponSystem, dayNightSystem, skyboxManager;
let clock;

const moveSpeed = 5;
let viewDebounce = false;
let shootDebounce = false;
let jumpDebounce = false;


function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Initial setup for early engine components
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015); // Global setup placeholder required by material binders

    world = new World(scene);
    dayNightSystem = new DayNightSystem(scene);
    skyboxManager = new SkyboxManager(scene); // Initialize the new sky tracker component
    input = new Input();
    physics = new Physics();
    player = new Player(scene);
    cameraManager = new CameraManager(camera);
    mouseControls = new MouseControls(renderer);
    weaponSystem = new WeaponSystem(scene);

    // Dynamic planetary event listener updates all sub-modules synchronously
   window.addEventListener('planetChanged', (e) => {
    const theme = world.getPlanetTheme(e.detail);
    
    // 1. Shift solar scales, coordinates and light values
    dayNightSystem.updateTheme(theme.sunColor, theme.sunIntensity, e.detail);
    
    // 2. Process real-world atmospheric colors and star behaviors natively 
    skyboxManager.updateAtmosphere(e.detail);
    
    // 3. Remap procedural ground floor textures safely
    world.updatePlanetTextures(e.detail); 
    });

    // Fire baseline configuration to set Earth properties on startup cleanly
    skyboxManager.updateAtmosphere( 'earth');

    window.addEventListener('resize', onWindowResize);
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    const isMoving = input.keys.forward || input.keys.backward || input.keys.left || input.keys.right;

    const yaw = mouseControls.yaw;
    const pitch = mouseControls.pitch;

    player.group.rotation.y = yaw;

    // Translation controls
    const moveVector = new THREE.Vector3();
    if (input.keys.forward)  moveVector.z -= 1;
    if (input.keys.backward) moveVector.z += 1;
    if (input.keys.left)     moveVector.x -= 1;
    if (input.keys.right)    moveVector.x += 1;

    moveVector.normalize();
    moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    // Collision check: resolve the desired horizontal movement against the world's
    // static obstacles before actually moving the player, so boxes can no longer be
    // walked/clipped through. Player is treated as a ~0.5m radius circle (matches the
    // torso width) on the X/Z plane; vertical movement (jump/gravity) is untouched.
    // Ground speed is scaled by the current planet's gravity (lighter gravity ->
    // quicker, longer-strided movement; heavier gravity -> slower, heavier steps),
    // matching the same feel already applied to the walk animation.
    const effectiveMoveSpeed = moveSpeed * physics.getMoveSpeedMultiplier();
    const desiredMove = moveVector.clone().multiplyScalar(effectiveMoveSpeed * deltaTime);
    const resolvedXZ = physics.resolveHorizontalCollision(
        player.group.position,
        desiredMove,
        world.getObstacleBoxes(),
        0.5
    );
    player.group.position.x = resolvedXZ.x;
    player.group.position.z = resolvedXZ.z;

    if (input.keys.jump) {
        if (!jumpDebounce) {
            physics.handleJump();
            jumpDebounce = true;
        }
    } else {
        jumpDebounce = false;
    }

    physics.updateGravity(player.group.position, deltaTime, world.getObstacleBoxes());

    if (input.keys.shoot) {
        if (!shootDebounce) {
            // previously the throw direction always came from camera.quaternion,
            // i.e. purely from where the mouse/camera was pointing, completely ignoring
            // WASD input. Meanwhile the character's torso visually rotates to face
            // moveVector (see Player.js bodyRotationY), so while strafing/moving
            // diagonally the body looked turned one way but the ball always flew off
            // "straight" according to the camera instead. Now, whenever the player is
            // actually moving, we throw along moveVector (already normalized and
            // rotated into world space by yaw on the lines above) so the projectile
            // matches the direction the character is visibly heading. When standing
            // still, moveVector is a zero vector, so we fall back to the camera's
            // facing direction as before (aim with the camera while stationary).
            const throwDirection = isMoving
                ? moveVector.clone().normalize()
                : new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const spawnPosition = player.group.position.clone();
            spawnPosition.y += 0.4; 

            weaponSystem.spawnProjectile(spawnPosition, throwDirection);
            player.triggerThrowAnimation(); 
            shootDebounce = true; 
        }
    } else {
        shootDebounce = false; 
    }

    weaponSystem.update(physics.currentGravity, deltaTime);

    // Update solar system orbit matrix calculations
    dayNightSystem.update(deltaTime, player.group.position, camera);

    // EXTRACTION: Calculate how high the sun is relative to its track center (normalized value between -1.0 and 1.0)
    // We check the sun's actual Y offset position minus player anchor height, then divide by orbit height scaling profiles
    const sunNormalizedY = (dayNightSystem.sunGroup.position.y - player.group.position.y) / 450;

    // Keep the procedural star skybox center locked dynamically onto the player tracking coordinates
    skyboxManager.update(player.group.position, deltaTime, sunNormalizedY);

    if (input.keys.toggleView) {
        if (!viewDebounce) {
            cameraManager.toggleView();
            viewDebounce = true;
        }
    } else {
        viewDebounce = false;
    }

    cameraManager.update(player.group.position, yaw, pitch);
    player.updateFirstPersonVisibility(cameraManager.isFirstPerson);
    // Pass the current planet's gravity ratio so the walk cycle (cadence, stride
    // length, low-gravity bounce) reflects wherever the player currently is.
    player.animateLimbs(deltaTime, isMoving, physics.isGrounded, physics.playerVelocityY, moveVector, yaw, physics.getGravityRatio());
    if (typeof TWEEN !== 'undefined') TWEEN.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;