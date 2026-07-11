export class Input {
    constructor() {
        // Track the state of movement keys
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            toggleView: false,
            shoot: false
        };

        // Track mouse clicks for throwing objects
        this.click = false;

        this.initListeners();
    }

    initListeners() {
        window.addEventListener('keydown', (e) => {
            // Use e.code first, fallback to e.key for spacebar
            this.handleKey(e.code, e.key, true);
        });

        window.addEventListener('keyup', (e) => {
            this.handleKey(e.code, e.key, false);
        });

        window.addEventListener('mousedown', (e) => {
            // Only trigger if the pointer lock is active (game is focused)
            if (document.pointerLockElement !== null) {
                this.click = true; 
            }
        });
    }

    handleKey(code, key, isPressed) {
        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = isPressed;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = isPressed;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = isPressed;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = isPressed;
                break;
                case 'KeyV': 
            this.keys.toggleView = isPressed;
            break;
            case 'KeyF': 
                this.keys.shoot = isPressed;
                break;
        }

        // Explicit check for Spacebar to avoid browser compatibility quirks
        if (code === 'Space' || key === ' ' || key === 'Spacebar') {
            this.keys.jump = isPressed;
        }
    }

    // Reset single-click trigger after it has been processed
    resetClick() {
        this.click = false;
    }
}