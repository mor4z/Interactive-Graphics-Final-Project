import * as THREE from 'three';

export class MouseControls {
    constructor(renderer) {
        this.domElement = renderer.domElement;
        
        // Track visual rotation using Euler angles
        this.pitch = 0; // Look up/down
        this.yaw = 0;   // Look left/right
        
        // Mouse sensitivity multiplier
        this.sensitivity = 0.002;

        this.initPointerLock();
    }

    initPointerLock() {
        // Request pointer lock when the user clicks anywhere on the canvas
        this.domElement.addEventListener('click', () => {
            if (document.pointerLockElement !== this.domElement) {
                this.domElement.requestPointerLock();
            }
        });

        // Listen for raw mouse movements
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.domElement) {
                this.handleMouseMove(e.clientX, e.clientY, e.movementX, e.movementY);
            }
        });
    }

    handleMouseMove(clientX, clientY, movementX, movementY) {
        // Apply sensitivity to the mouse movement
        this.yaw -= movementX * this.sensitivity;
        this.pitch -= movementY * this.sensitivity;

        // Cap the vertical look (pitch) to prevent the camera from flipping upside down (-85 to +85 degrees)
        const maxPitch = Math.PI / 2 - 0.05; 
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    }
}