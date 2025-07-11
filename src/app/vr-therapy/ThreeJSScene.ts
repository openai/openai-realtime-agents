import * as THREE from 'three';

interface AvatarConfig {
    name: string;
    color: number;
    position: THREE.Vector3;
    type: 'greeter' | 'therapist';
}

export class ThreeJSScene {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private avatars: Map<string, THREE.Group> = new Map();
    private currentAvatar: THREE.Group | null = null;
    private animationMixer: THREE.AnimationMixer | null = null;
    private clock: THREE.Clock;
    private isVRMode: boolean = false;

    constructor(canvas: HTMLCanvasElement) {
        this.clock = new THREE.Clock();

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        this.camera.position.set(0, 1.6, 3); // Eye level for VR

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // Lighting setup
        this.setupLighting();

        // Environment setup
        this.setupEnvironment();

        // Create avatars
        this.createAvatars();

        // Start animation loop
        this.animate();
    }

    private setupLighting() {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Main directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        this.scene.add(directionalLight);

        // Fill light for soft shadows
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 3, -5);
        this.scene.add(fillLight);
    }

    private setupEnvironment() {
        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0xf0f8ff });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Therapy room walls (subtle)
        const wallHeight = 4;
        const wallDistance = 8;

        // Back wall
        const backWallGeometry = new THREE.PlaneGeometry(16, wallHeight);
        const wallMaterial = new THREE.MeshLambertMaterial({
            color: 0xe6f3ff,
            transparent: true,
            opacity: 0.3
        });
        const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
        backWall.position.set(0, wallHeight / 2, -wallDistance);
        this.scene.add(backWall);
    }

    private createAvatars() {
        // Greeter avatar configuration
        const greeterConfig: AvatarConfig = {
            name: 'greeterTherapist',
            color: 0x4F46E5, // Indigo
            position: new THREE.Vector3(-2, 0, 0),
            type: 'greeter'
        };

        // Therapist avatar configuration  
        const therapistConfig: AvatarConfig = {
            name: 'virtualTherapist',
            color: 0x059669, // Emerald
            position: new THREE.Vector3(2, 0, 0),
            type: 'therapist'
        };

        // Create both avatars
        this.avatars.set(greeterConfig.name, this.createAvatar(greeterConfig));
        this.avatars.set(therapistConfig.name, this.createAvatar(therapistConfig));

        // Start with greeter visible
        this.switchToAvatar('greeterTherapist');
    }

    private createAvatar(config: AvatarConfig): THREE.Group {
        const avatarGroup = new THREE.Group();

        // Body (simple capsule shape)
        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: config.color });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        body.castShadow = true;
        avatarGroup.add(body);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac }); // Skin tone
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.7;
        head.castShadow = true;
        avatarGroup.add(head);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.08, 1.75, 0.2);
        avatarGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.08, 1.75, 0.2);
        avatarGroup.add(rightEye);

        // Mouth (for lip sync)
        const mouthGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const mouthMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, 1.65, 0.22);
        mouth.scale.set(1.5, 0.5, 0.5);
        mouth.name = 'mouth'; // For animation targeting
        avatarGroup.add(mouth);

        // Hair/characteristic feature based on agent type
        if (config.type === 'greeter') {
            // Professional hair for greeter
            const hairGeometry = new THREE.SphereGeometry(0.28, 16, 16);
            const hairMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const hair = new THREE.Mesh(hairGeometry, hairMaterial);
            hair.position.y = 1.85;
            hair.scale.set(1, 0.8, 1);
            avatarGroup.add(hair);
        } else {
            // Therapist glasses
            const glassesGeometry = new THREE.RingGeometry(0.08, 0.12, 16);
            const glassesMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

            const leftGlass = new THREE.Mesh(glassesGeometry, glassesMaterial);
            leftGlass.position.set(-0.08, 1.75, 0.23);
            avatarGroup.add(leftGlass);

            const rightGlass = new THREE.Mesh(glassesGeometry, glassesMaterial);
            rightGlass.position.set(0.08, 1.75, 0.23);
            avatarGroup.add(rightGlass);
        }

        // Position the avatar
        avatarGroup.position.copy(config.position);
        avatarGroup.visible = false; // Start hidden

        // Add floating animation
        avatarGroup.userData = {
            config,
            originalY: config.position.y,
            animationTime: 0,
            isSpeaking: false
        };

        this.scene.add(avatarGroup);
        return avatarGroup;
    }

    public switchToAvatar(agentName: string) {
        // Hide current avatar
        if (this.currentAvatar) {
            this.currentAvatar.visible = false;
        }

        // Show new avatar
        const newAvatar = this.avatars.get(agentName);
        if (newAvatar) {
            newAvatar.visible = true;
            this.currentAvatar = newAvatar;

            // Smooth camera transition to face the new avatar
            const targetPosition = newAvatar.position.clone();
            targetPosition.z += 3;
            targetPosition.y += 1.6;

            this.animateCameraTo(targetPosition);
        }
    }

    private animateCameraTo(targetPosition: THREE.Vector3) {
        // Simple camera animation
        const startPosition = this.camera.position.clone();
        const duration = 1000; // 1 second
        const startTime = Date.now();

        const animateCamera = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth easing
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            this.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        };

        animateCamera();
    }

    public startSpeaking() {
        if (this.currentAvatar) {
            this.currentAvatar.userData.isSpeaking = true;
        }
    }

    public stopSpeaking() {
        if (this.currentAvatar) {
            this.currentAvatar.userData.isSpeaking = false;
        }
    }

    public setVRMode(isVR: boolean) {
        this.isVRMode = isVR;
        if (isVR) {
            // Position avatars closer for VR
            this.avatars.forEach(avatar => {
                const config = avatar.userData.config;
                avatar.position.set(config.position.x * 0.5, config.position.y, config.position.z - 1);
            });
        } else {
            // Reset to normal positions
            this.avatars.forEach(avatar => {
                avatar.position.copy(avatar.userData.config.position);
            });
        }
    }

    private animate = () => {
        requestAnimationFrame(this.animate);

        const deltaTime = this.clock.getDelta();

        // Animate avatars
        this.avatars.forEach(avatar => {
            if (avatar.visible) {
                // Floating animation
                avatar.userData.animationTime += deltaTime;
                const floatOffset = Math.sin(avatar.userData.animationTime * 2) * 0.05;
                avatar.position.y = avatar.userData.originalY + floatOffset;

                // Speaking animation (mouth movement)
                if (avatar.userData.isSpeaking) {
                    const mouth = avatar.getObjectByName('mouth');
                    if (mouth) {
                        const speakIntensity = Math.sin(avatar.userData.animationTime * 10) * 0.3 + 0.7;
                        mouth.scale.y = 0.5 * speakIntensity;
                    }
                }

                // Gentle head bobbing
                const head = avatar.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry);
                if (head) {
                    head.rotation.y = Math.sin(avatar.userData.animationTime * 0.5) * 0.1;
                }
            }
        });

        // Update animation mixer if exists
        if (this.animationMixer) {
            this.animationMixer.update(deltaTime);
        }

        this.renderer.render(this.scene, this.camera);
    };

    public resize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    public dispose() {
        this.renderer.dispose();
        this.scene.clear();
    }

    public getRenderer(): THREE.WebGLRenderer {
        return this.renderer;
    }

    public getScene(): THREE.Scene {
        return this.scene;
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }
} 