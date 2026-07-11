import * as THREE from 'three';
import { World } from './World.js';
import { Input } from './Input.js';
import { Physics } from './Physics.js';
import { Player } from './Player.js';
import { CameraManager } from './CameraManager.js';
import { MouseControls } from './MouseControls.js';
import { WeaponSystem } from './WeaponSystem.js';
import { DayNightSystem } from './DayNightSystem.js';
import { SkyboxManager } from './SkyboxManager.js';

// Global variables
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

    // Generating camer and renderer
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Initial setup for early engine components
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015); // Global setup placeholder required by material binders

    world = new World(scene);
    dayNightSystem = new DayNightSystem(scene);
    skyboxManager = new SkyboxManager(scene); // Initialize the sky tracker component
    input = new Input();
    physics = new Physics();
    player = new Player(scene);
    cameraManager = new CameraManager(camera);
    mouseControls = new MouseControls(renderer);
    weaponSystem = new WeaponSystem(scene);

    // Dynamic planetary event listener updates all sub-modules synchronously
    window.addEventListener('planetChanged', (e) => {
    const theme = world.getPlanetTheme(e.detail);
    
    // Shift solar scales, coordinates and light values
    dayNightSystem.updateTheme(theme.sunColor, theme.sunIntensity, e.detail);
    
    // Process real-world atmospheric colors and star behaviors natively 
    skyboxManager.updateAtmosphere(e.detail);
    
    // Remap procedural ground floor textures safely
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

    // Speed and collision handling 
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

    // Shooting the object
    if (input.keys.shoot) {
        if (!shootDebounce) {
            const throwDirection = isMoving ? moveVector.clone().normalize() : new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const spawnPosition = player.group.position.clone();
            spawnPosition.y += 0.4; 

            weaponSystem.spawnProjectile(spawnPosition, throwDirection);
            player.triggerThrowAnimation(); 
            shootDebounce = true; 
        }
    } else {
        shootDebounce = false; 
    }

    weaponSystem.update(physics.currentGravity, deltaTime, world.getObstacleBoxes());

    // Update solar system orbit matrix calculations
    dayNightSystem.update(deltaTime, player.group.position, camera);

    // Calculate how high the sun is relative to its track center
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
    
    // Animation of the movement
    player.animateLimbs(deltaTime, isMoving, physics.isGrounded, physics.playerVelocityY, moveVector, yaw, physics.getGravityRatio(), cameraManager.isFirstPerson);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;