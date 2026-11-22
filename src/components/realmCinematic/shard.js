import * as THREE from "three";
import { glowTexture } from "@/components/glacialArchive/Cutscene";

/* A soul-shard: a faceted crystal with a burning core and a soft halo.
   Shared by the Cinder and Void cinematics. */
export default function createSoulShard({ size = 2.4, color = 0xffd7a3, coreColor = 0xfff3d0 } = {}) {
  const group = new THREE.Group();

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.55,
    roughness: 0.08,
    metalness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.9,
    envMapIntensity: 2.4,
  });
  const shell = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), shellMaterial);
  shell.scale.set(0.72, 1.28, 0.72);
  group.add(shell);

  const coreMaterial = new THREE.MeshBasicMaterial({ color: coreColor });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(size * 0.42, 0), coreMaterial);
  core.scale.set(0.7, 1.3, 0.7);
  group.add(core);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,232,200"),
      color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(size * 5.2);
  group.add(halo);

  const light = new THREE.PointLight(color, 26, size * 26, 2);
  group.add(light);

  group.userData.update = (time) => {
    shell.rotation.y = time * 0.45;
    core.rotation.y = -time * 0.72;
    core.rotation.x = Math.sin(time * 0.5) * 0.3;
    const pulse = 0.86 + 0.14 * Math.sin(time * 2.1);
    coreMaterial.color.setHex(coreColor);
    coreMaterial.color.multiplyScalar(pulse * 1.5);
    halo.material.opacity = 0.55 + 0.18 * Math.sin(time * 1.7);
    light.intensity = 22 + 8 * Math.sin(time * 2.4);
  };

  return group;
}