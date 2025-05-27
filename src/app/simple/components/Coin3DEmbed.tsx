"use client";

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useSimulation } from '../contexts/SimulationContext';
// presets are managed in SimulationContext

const Coin3DEmbed: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  // Get presets and selectedPreset from context
  const { presets, selectedPreset } = useSimulation();
  const preset = presets[selectedPreset] || presets['default'];
  
  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const { geometry: g, material: m, animation: a } = preset;
    const geometry = new THREE.CylinderGeometry(
      g.radiusTop, g.radiusBottom, g.height, g.radialSegments);
    const material = new THREE.MeshStandardMaterial({
      color: m.color,
      metalness: m.metalness,
      roughness: m.roughness,
      envMapIntensity: m.envMapIntensity
    });
    const coin = new THREE.Mesh(geometry, material);
    coin.rotation.x = Math.PI / 2;
    scene.add(coin);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      const t = clock.getElapsedTime();
      switch (a.type) {
        case 'spin':
          coin.rotation.z += a.speed || 0.02;
          break;
        case 'bounce':
          coin.position.y = (a.amplitude || 0.5) * Math.sin((a.frequency || 1) * t);
          break;
        case 'flip':
          coin.rotation.x = (t * (a.speed || Math.PI * 2)) % (Math.PI * 2);
          break;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Coin3DEmbed;