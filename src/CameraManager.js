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

    // This runs inside the main animate loop to smoothly or rigidly bind the camera
   update(playerPosition, yaw, pitch) {
    if (this.isFirstPerson) {
        // 1. First Person Mode
        // FIX: fpOffset is defined in the PLAYER's local space (forward/up relative to
        // the direction the character is facing), but it was previously added to
        // playerPosition as-is, i.e. treated as a fixed WORLD-space vector. That meant
        // the "eye" point never rotated together with the character's facing direction:
        // as soon as you turned (changed yaw), the camera stayed offset along the old
        // world axes instead of staying glued to the head, making it look like the
        // camera wasn't rigidly attached to the body. We now rotate the offset around
        // the Y axis by the current yaw before applying it, exactly like third person
        // already does, so the camera always sits fixed relative to the character.
        const rotatedFpOffset = this.fpOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        this.camera.position.copy(playerPosition).add(rotatedFpOffset);
        
        // Apply both horizontal (yaw) and vertical (pitch) rotations directly to camera
        this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
    } else {
        // 2. Third Person Mode
        // Calculate camera position as an orbit offset behind the player using trigonometry
        const radius = 6.0;
        const height = 2.5;
        
        // Calculate dynamic offset based on the horizontal angle (yaw)
        const offsetX = Math.sin(yaw) * radius;
        const offsetZ = Math.cos(yaw) * radius;
        
        const targetCamPos = playerPosition.clone().add(new THREE.Vector3(offsetX, height, offsetZ));
        this.camera.position.copy(targetCamPos);
        
        // Force the camera to look directly at the player body core
        const lookAtTarget = playerPosition.clone().add(new THREE.Vector3(0, -0.2, 0));
        this.camera.lookAt(lookAtTarget);
    }
   }
}