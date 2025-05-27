"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { ShadowMesh } from "three/examples/jsm/objects/ShadowMesh.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadPresets, saveUserPresets } from "./presetsStorage";
// import post-processing passes (disabled for now)
// import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
// import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
// import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';

export default function ThreePage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const guiContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // attach canvas to mount element
    mountRef.current?.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemiLight.position.set(0, 5, 0);
    scene.add(hemiLight);

    // default coin mesh
    const coinGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.3 });
    const coin = new THREE.Mesh(coinGeometry, material);
    coin.castShadow = true;
    coin.receiveShadow = true;
    coin.rotation.x = Math.PI / 2;
    scene.add(coin);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    // Improve shadow quality and frustum
    directionalLight.shadow.mapSize.set(2048, 2048);
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 20;
    directionalLight.shadow.camera.left = -2;
    directionalLight.shadow.camera.right = 2;
    directionalLight.shadow.camera.top = 2;
    directionalLight.shadow.camera.bottom = -2;
    scene.add(directionalLight);

    // Ground plane for shadows
    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    // position plane slightly below coin base
    const planeY = -0.1;
    plane.position.y = planeY;
    plane.receiveShadow = true;
    scene.add(plane);
    // contact shadow projection mesh (stencil-based)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const shadowMesh = new ShadowMesh(coin);
    shadowMesh.material.opacity = 0.6;
    scene.add(shadowMesh);

    const config = {
      backgroundColor: "#000000",
      color: "#ffd700",
      ambientIntensity: ambientLight.intensity,
      directionalIntensity: directionalLight.intensity,
      // rotation speeds per axis
      rotationSpeedX: 0.0,
      rotationSpeedY: 0.01,
      rotationSpeedZ: 0.0,
      // oscillation
      enableOscillation: false,
      oscillationAmplitude: 0.5,
      oscillationFrequency: 1,
      // camera auto-rotate
      enableAutoRotate: false,
      autoRotateSpeed: 2,
      // animation action controls
      actionTimeScale: 1,
      actionLoopMode: 'LoopRepeat',
      // material parameters (initial coin)
      metalness: material.metalness,
      roughness: material.roughness,
      envMapIntensity: 1.0,
      shadowsEnabled: true,
      lightCastShadow: true,
      shadowBias: directionalLight.shadow.bias,
      
      exposure: 1.0,
      
      fogDensity: 0.05,
      
      hemiIntensity: 0.5,
      hemiSkyColor: "#ffffff",
      hemiGroundColor: "#444444",
      // post-processing parameters
      bloomStrength: 1.5,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
      ssaoKernelRadius: 16,
      // ground plane parameters
      planeColor: "#222222",
      planeRoughness: planeMaterial.roughness,
      planeMetalness: planeMaterial.metalness
    };
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = config.exposure;
    scene.fog = new THREE.FogExp2(config.backgroundColor, config.fogDensity);
    // initial scene background
    scene.background = new THREE.Color(config.backgroundColor);
    // load environment map for realistic reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const cubeLoader = new THREE.CubeTextureLoader();
    cubeLoader.setPath('https://threejs.org/examples/textures/cube/Bridge2/');
    const urls = ['posx.jpg','negx.jpg','posy.jpg','negy.jpg','posz.jpg','negz.jpg'];
    cubeLoader.load(urls, (cubeTexture) => {
      // in r150+ use colorSpace instead of encoding
      cubeTexture.colorSpace = THREE.SRGBColorSpace;
      const envMap = pmremGenerator.fromCubemap(cubeTexture).texture;
      scene.environment = envMap;
      material.envMap = envMap;
      material.envMapIntensity = config.envMapIntensity;
      pmremGenerator.dispose();
    });
    const clock = new THREE.Clock();

    scene.background = new THREE.Color(config.backgroundColor);

    let gui: any;
    let mixer: THREE.AnimationMixer | null = null;
    let action: THREE.AnimationAction | null = null;
    let flipAction: THREE.AnimationAction | null = null;
    (async () => {
      const { GUI } = await import('dat.gui');
      mixer = new THREE.AnimationMixer(coin);
      const times = [0, 1];
      const values = [0, 2 * Math.PI];
      const track = new THREE.NumberKeyframeTrack('.rotation[y]', times, values);
      const clip = new THREE.AnimationClip('rotateY', -1, [track]);
      action = mixer.clipAction(clip);
      action.play();
      // create flip animation (X-axis spin)
      const flipTimes = [0, 0.5, 1];
      const flipValues = [0, Math.PI * 4, 0];
      const flipTrack = new THREE.NumberKeyframeTrack('.rotation[x]', flipTimes, flipValues);
      const flipClip = new THREE.AnimationClip('flip', 1, [flipTrack]);
      flipAction = mixer.clipAction(flipClip);
      flipAction.clampWhenFinished = true;
      flipAction.setLoop(THREE.LoopOnce, 0);
      // initialize GUI inside custom container
      gui = new GUI({ autoPlace: false });
      // append gui to sidebar container
      guiContainerRef.current?.appendChild(gui.domElement);
      // ----- Coins management -----
      interface CoinConfig {
        geometry: { radiusTop: number; radiusBottom: number; height: number; radialSegments: number };
        material: { color: number; metalness: number; roughness: number; envMapIntensity?: number };
        animation: { rotationSpeedX: number; rotationSpeedY: number; rotationSpeedZ: number; enableOscillation: boolean; oscillationAmplitude: number; oscillationFrequency: number };
      }
      const defaultCoinConfig: CoinConfig = {
        geometry: { radiusTop:1, radiusBottom:1, height:0.2, radialSegments:32 },
        material: { color:0xffd700, metalness:1.0, roughness:0.3, envMapIntensity:1.0 },
        animation: { rotationSpeedX:0, rotationSpeedY:0.01, rotationSpeedZ:0, enableOscillation:false, oscillationAmplitude:0.5, oscillationFrequency:1 }
      };
      const coins: Array<{ mesh: THREE.Mesh; config: CoinConfig; mixer: THREE.AnimationMixer; action: THREE.AnimationAction }> = [];
      const coinsFolder = gui.addFolder('Coins');
      const addCoin = (cfg: CoinConfig = JSON.parse(JSON.stringify(defaultCoinConfig))) => {
        const geo = new THREE.CylinderGeometry(cfg.geometry.radiusTop, cfg.geometry.radiusBottom, cfg.geometry.height, cfg.geometry.radialSegments);
        const mat = new THREE.MeshStandardMaterial({ color: cfg.material.color, metalness: cfg.material.metalness, roughness: cfg.material.roughness, envMapIntensity: cfg.material.envMapIntensity });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.rotation.x = Math.PI/2;
        scene.add(mesh);
        const m = new THREE.AnimationMixer(mesh);
        const track = new THREE.NumberKeyframeTrack('.rotation[y]', [0,1],[0,2*Math.PI]);
        const clip = new THREE.AnimationClip('spin', -1, [track]);
        const action = m.clipAction(clip); action.play();
        const idx = coins.length;
        coins.push({ mesh, config: cfg, mixer: m, action });
        const f = coinsFolder.addFolder(`Coin ${idx+1}`);
        f.addColor(cfg.material, 'color').name('Color').onChange(v=> mat.color.set(v));
        f.add(cfg.material, 'metalness', 0,1).name('Metalness').onChange(v=> mat.metalness = v);
        f.add(cfg.material, 'roughness', 0,1).name('Roughness').onChange(v=> mat.roughness = v);
        f.add(cfg.animation, 'rotationSpeedY', 0,0.2).name('Spin Speed').onChange(v=> cfg.animation.rotationSpeedY = v);
        f.add(cfg.animation, 'enableOscillation').name('Enable Bounce');
        f.add(cfg.animation, 'oscillationAmplitude', 0,1).name('Bounce Amp');
        f.add(cfg.animation, 'oscillationFrequency', 0,5).name('Bounce Freq');
        f.add({ remove: () => { scene.remove(mesh); f.hide(); } }, 'remove').name('Remove');
        f.open();
      };
      coinsFolder.add({ addCoin }, 'addCoin').name('Add Coin');
      coinsFolder.open();
      // background color control
      gui.addColor(config, 'backgroundColor')
        .name('Background Color')
        .onChange((value: string) => {
          scene.background.set(value);
          if (scene.fog) scene.fog.color.set(value);
        });
      const lightFolder = gui.addFolder("Lights");
      // Movement and animation controls
      const moveFolder = gui.addFolder("Movement");
      moveFolder.add(config, 'rotationSpeedX', 0, 0.1).name('Rot Speed X');
      moveFolder.add(config, 'rotationSpeedY', 0, 0.1).name('Rot Speed Y');
      moveFolder.add(config, 'rotationSpeedZ', 0, 0.1).name('Rot Speed Z');
      moveFolder.add(config, 'enableOscillation').name('Enable Oscillation');
      moveFolder.add(config, 'oscillationAmplitude', 0, 5).name('Osc Amplitude');
      moveFolder.add(config, 'oscillationFrequency', 0, 5).name('Osc Frequency');
      moveFolder.add(config, 'enableAutoRotate').name('Cam Auto-Rotate')
        .onChange((v: boolean) => controls.autoRotate = v);
      moveFolder.add(config, 'autoRotateSpeed', 0, 10).name('Auto-Rotate Speed')
        .onChange((v: number) => controls.autoRotateSpeed = v);
      moveFolder.open();
      lightFolder.addColor({ ambientColor: "#ffffff" }, "ambientColor")
        .name("Ambient Color")
        .onChange((value: string) => ambientLight.color.set(value));
      lightFolder.add(config, "ambientIntensity", 0, 2)
        .name("Ambient Intensity")
        .onChange((value: number) => ambientLight.intensity = value);
      lightFolder.addColor({ directionalColor: "#ffffff" }, "directionalColor")
        .name("Directional Color")
        .onChange((value: string) => directionalLight.color.set(value));
      lightFolder.add(config, "directionalIntensity", 0, 2)
        .name("Directional Intensity")
        .onChange((value: number) => directionalLight.intensity = value);
      lightFolder.add(config, 'hemiIntensity', 0, 2)
        .name('Hemi Intensity')
        .onChange((v: number) => hemiLight.intensity = v);
      lightFolder.addColor(config, 'hemiSkyColor')
        .name('Hemi Sky Color')
        .onChange((v: string) => hemiLight.color.set(v));
      lightFolder.addColor(config, 'hemiGroundColor')
        .name('Hemi Ground Color')
        .onChange((v: string) => hemiLight.groundColor.set(v));
      lightFolder.add(config, 'shadowsEnabled')
        .name('Shadows Enabled')
        .onChange((v: boolean) => renderer.shadowMap.enabled = v);
      lightFolder.add(config, 'lightCastShadow')
        .name('Light Cast Shadow')
        .onChange((v: boolean) => directionalLight.castShadow = v);
      lightFolder.add(config, 'shadowBias', -0.01, 0.01)
        .name('Shadow Bias')
        .onChange((value: number) => directionalLight.shadow.bias = value);
      lightFolder.open();
      const envFolder = gui.addFolder('Environment');
      envFolder.add(config, 'exposure', 0, 2)
        .name('Exposure')
        .onChange((v: number) => renderer.toneMappingExposure = v);
      envFolder.add(config, 'fogDensity', 0, 0.1)
        .step(0.001)
        .name('Fog Density')
        .onChange((v: number) => { if (scene.fog && (scene.fog as THREE.FogExp2).density !== undefined) (scene.fog as THREE.FogExp2).density = v; });
      envFolder.open();

      const coinFolder = gui.addFolder("Coin");
      coinFolder.addColor(config, "color")
        .name("Coin Color")
        .onChange((value: string) => material.color.set(value));
      // animation action controls
      coinFolder.add({ play: () => action?.play() }, 'play').name('Play');
      coinFolder.add({ stop: () => action?.stop() }, 'stop').name('Stop');
      coinFolder.add({ flip: () => { flipAction?.reset(); flipAction?.play(); } }, 'flip').name('Flip Coin');
      coinFolder.add(config, 'actionTimeScale', 0, 5)
        .name('Playback Speed')
        .onChange((v: number) => action && (action.timeScale = v));
      coinFolder.add(config, 'actionLoopMode', ['LoopOnce', 'LoopRepeat', 'LoopPingPong'])
        .name('Loop Mode')
        .onChange((value: string) => {
          if (!action) return;
          switch (value) {
            case 'LoopOnce': action.setLoop(THREE.LoopOnce, 0); break;
            case 'LoopRepeat': action.setLoop(THREE.LoopRepeat, Infinity); break;
            case 'LoopPingPong': action.setLoop(THREE.LoopPingPong, Infinity); break;
          }
        });
      coinFolder.open();
      const materialFolder = gui.addFolder('Material');
      materialFolder.add(config, 'metalness', 0, 1)
        .name('Metalness')
        .onChange((v: number) => material.metalness = v);
      materialFolder.add(config, 'roughness', 0, 1)
        .name('Roughness')
        .onChange((v: number) => material.roughness = v);
      materialFolder.add(config, 'envMapIntensity', 0, 5)
        .name('EnvMap Intensity')
        .onChange((v: number) => material.envMapIntensity = v);
      materialFolder.open();
      // texture map controls
      // ground plane controls
      const groundFolder = gui.addFolder('Ground');
      groundFolder.addColor(config, 'planeColor')
        .name('Ground Color')
        .onChange((v: string) => planeMaterial.color.set(v));
      groundFolder.add(config, 'planeRoughness', 0, 1)
        .name('Ground Roughness')
        .onChange((v: number) => planeMaterial.roughness = v);
      groundFolder.add(config, 'planeMetalness', 0, 1)
        .name('Ground Metalness')
        .onChange((v: number) => planeMaterial.metalness = v);
      groundFolder.open();
      // Presets management
      const presets = loadPresets();
      const presetNames = Object.keys(presets);
      const presetParams: { presetName: string } = { presetName: 'default' };
      const presetController = gui.add(presetParams, 'presetName', presetNames)
        .name('Preset')
        .onChange((name: string) => {
          const p = presets[name] || presets['default'];
          // apply material
          material.color.set(p.material.color);
          material.metalness = p.material.metalness;
          material.roughness = p.material.roughness;
          if (p.material.envMapIntensity !== undefined) material.envMapIntensity = p.material.envMapIntensity;
          // apply animation config
          if (p.animation.type === 'spin') {
            config.rotationSpeedX = 0;
            config.rotationSpeedY = p.animation.speed || config.rotationSpeedY;
            config.rotationSpeedZ = 0;
            config.enableOscillation = false;
          } else if (p.animation.type === 'bounce') {
            config.rotationSpeedX = 0;
            config.rotationSpeedY = 0;
            config.rotationSpeedZ = 0;
            config.enableOscillation = true;
            config.oscillationAmplitude = p.animation.amplitude || config.oscillationAmplitude;
            config.oscillationFrequency = p.animation.frequency || config.oscillationFrequency;
          } else if (p.animation.type === 'flip') {
            config.rotationSpeedX = p.animation.speed || config.rotationSpeedX;
            config.rotationSpeedY = 0;
            config.rotationSpeedZ = 0;
            config.enableOscillation = false;
          }
        });
      gui.add({ savePreset: () => {
        const name = prompt('Nome do preset:');
        if (!name) return;
        const geo = geometry.parameters as any;
        const newPreset: any = {
          geometry: {
            radiusTop: geo.radiusTop,
            radiusBottom: geo.radiusBottom,
            height: geo.height,
            radialSegments: geo.radialSegments
          },
          material: {
            color: material.color.getHex(),
            metalness: material.metalness,
            roughness: material.roughness,
            envMapIntensity: material.envMapIntensity
          },
          animation: {
            type: config.enableOscillation ? 'bounce' : 'spin',
            speed: config.rotationSpeedY,
            amplitude: config.oscillationAmplitude,
            frequency: config.oscillationFrequency
          }
        };
        presets[name] = newPreset;
        saveUserPresets(presets);
        const names = Object.keys(presets);
        presetController.options(names);
        presetParams.presetName = name;
        presetController.setValue(name);
      } }, 'savePreset').name('Salvar Preset');
      gui.add({ deletePreset: () => {
        const name = presetParams.presetName;
        if (name === 'default') { alert('Não pode apagar default'); return; }
        delete presets[name];
        saveUserPresets(presets);
        const names = Object.keys(presets);
        presetController.options(names);
        presetParams.presetName = 'default';
        presetController.setValue('default');
      } }, 'deletePreset').name('Excluir Preset');
    })();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      // update AnimationMixer
      const delta = clock.getDelta();
      if (mixer) mixer.update(delta);
      // per-axis rotation
      coin.rotation.x += config.rotationSpeedX;
      coin.rotation.y += config.rotationSpeedY;
      coin.rotation.z += config.rotationSpeedZ;
      // oscillation
      if (config.enableOscillation) {
        const t = clock.getElapsedTime();
        coin.position.y = config.oscillationAmplitude * Math.sin(t * config.oscillationFrequency);
      }
      // camera auto-rotate handled by OrbitControls.autoRotate
      // update contact shadows projection
      shadowMesh.update(
        groundPlane,
        new THREE.Vector4(
          directionalLight.position.x,
          directionalLight.position.y,
          directionalLight.position.z,
          0
        )
      );
      // render scene
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const newWidth = mountRef.current.clientWidth;
      const newHeight = mountRef.current.clientHeight;
      renderer.setSize(newWidth, newHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      gui?.destroy();
    };
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px' }}>
      {/* Sidebar for controls */}
      <div
        ref={guiContainerRef}
        style={{
          width: '300px',
          height: '600px',
          overflowY: 'auto',
          background: '#222',
          padding: '10px',
          boxSizing: 'border-box',
          marginRight: '20px'
        }}
      />
      {/* 3D canvas area (fixed size) */}
      <div
        ref={mountRef}
        style={{
          width: '600px',
          height: '600px',
          background: '#000'
        }}
      />
    </div>
  );
}