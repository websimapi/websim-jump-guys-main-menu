import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let renderer, scene, camera, rafId, clock;
let container;
let character;
let mixer; // Animation mixer
let quality = 'medium';

export function initCharacterStage(canvas, initialQuality = 'medium') {
  container = canvas;
  clock = new THREE.Clock();
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  // add gradient sky background inside the 3D scene
  const skyGeo = new THREE.SphereGeometry(50, 64, 64);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x3a73b8) },    // brighter night blue
      midColor: { value: new THREE.Color(0x1f4d86) },    // spotlight-ish
      bottomColor: { value: new THREE.Color(0x0b1e36) }  // deep blue
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      void main() {
        vec3 p = normalize(vWorldPos);
        float y = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
        float r = length(p.xz);
        float spotlight = smoothstep(0.8, 0.2, r + (0.65 - y)); // oval spotlight toward top
        float t = smoothstep(0.0, 1.0, pow(y, 0.85));
        vec3 c = mix(bottomColor, mix(midColor, topColor, t), t);
        c = mix(c, midColor, spotlight * 0.55);
        gl_FragColor = vec4(c, 1.0);
      }
    `
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4.2);

  const light = new THREE.HemisphereLight(0xffffff, 0xcccccc, 1.0);
  scene.add(light);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(2, 3, 2);
  scene.add(dir);

  // Create detailed rigged character
  character = createRiggedCharacter();
  character.position.y = -0.8; // Adjust position to stand on the "ground"
  scene.add(character);

  // Lighting add-on
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(-2, 1, -2);
  scene.add(rim);

  window.addEventListener('resize', onResize);
  onResize();

  setRendererQuality(initialQuality);
  animate();

  return { setQuality: setRendererQuality, destroy };
}

function createRiggedCharacter() {
  const bones = [];
  const boneData = [
    { name: 'root', parent: -1, pos: [0, 0, 0] },
    { name: 'spine_lower', parent: 0, pos: [0, 0.4, 0] },
    { name: 'spine_upper', parent: 1, pos: [0, 0.4, 0] },
    { name: 'neck', parent: 2, pos: [0, 0.4, 0] },
    { name: 'head', parent: 3, pos: [0, 0.15, 0] },
    { name: 'l_shoulder', parent: 2, pos: [-0.2, 0.3, 0] },
    { name: 'l_upper_arm', parent: 5, pos: [-0.3, 0, 0] },
    { name: 'l_lower_arm', parent: 6, pos: [-0.4, 0, 0] },
    { name: 'r_shoulder', parent: 2, pos: [0.2, 0.3, 0] },
    { name: 'r_upper_arm', parent: 8, pos: [0.3, 0, 0] },
    { name: 'r_lower_arm', parent: 9, pos: [0.4, 0, 0] },
    { name: 'l_hip', parent: 0, pos: [-0.15, 0, 0] },
    { name: 'l_upper_leg', parent: 11, pos: [0, -0.4, 0] },
    { name: 'l_lower_leg', parent: 12, pos: [0, -0.5, 0] },
    { name: 'r_hip', parent: 0, pos: [0.15, 0, 0] },
    { name: 'r_upper_leg', parent: 14, pos: [0, -0.4, 0] },
    { name: 'r_lower_leg', parent: 15, pos: [0, -0.5, 0] },
  ];

  boneData.forEach(data => {
    const bone = new THREE.Bone();
    bone.name = data.name;
    bone.position.set(...data.pos);
    bones.push(bone);
    if (data.parent !== -1) {
      bones[data.parent].add(bone);
    }
  });

  const skeleton = new THREE.Skeleton(bones);

  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.4 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.5 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6 }),
    eyes: new THREE.MeshStandardMaterial({ color: 0x111111 }),
  };

  const parts = [];
  const bodyPos = new THREE.Vector3(0, 0.8, 0);

  // Head
  const headGeom = new THREE.SphereGeometry(0.3, 32, 24);
  headGeom.translate(0, 1.35, 0);
  addSkinning(headGeom, skeleton, 'head');
  parts.push({ geom: headGeom, mat: materials.skin });

  // Eyes
  const eyeGeom = new THREE.SphereGeometry(0.05, 12, 8);
  const lEyeGeom = eyeGeom.clone().translate(-0.1, 1.4, 0.26);
  addSkinning(lEyeGeom, skeleton, 'head');
  parts.push({ geom: lEyeGeom, mat: materials.eyes });
  const rEyeGeom = eyeGeom.clone().translate(0.1, 1.4, 0.26);
  addSkinning(rEyeGeom, skeleton, 'head');
  parts.push({ geom: rEyeGeom, mat: materials.eyes });
  
  // Body
  const bodyGeom = new THREE.CylinderGeometry(0.3, 0.35, 0.9, 16);
  bodyGeom.translate(bodyPos.x, bodyPos.y, bodyPos.z);
  addSkinning(bodyGeom, skeleton, 'spine_lower', 'spine_upper');
  parts.push({ geom: bodyGeom, mat: materials.shirt });

  // Arms
  const armGeom = new THREE.CapsuleGeometry(0.1, 0.4, 8, 16);
  const lArmGeom = armGeom.clone().translate(-0.5, 1.0, 0);
  addSkinning(lArmGeom, skeleton, 'l_upper_arm', 'l_lower_arm');
  parts.push({ geom: lArmGeom, mat: materials.skin });
  const rArmGeom = armGeom.clone().translate(0.5, 1.0, 0);
  addSkinning(rArmGeom, skeleton, 'r_upper_arm', 'r_lower_arm');
  parts.push({ geom: rArmGeom, mat: materials.skin });

  // Legs
  const legGeom = new THREE.CapsuleGeometry(0.15, 0.9, 8, 16);
  const lLegGeom = legGeom.clone().translate(-0.15, 0.0, 0);
  addSkinning(lLegGeom, skeleton, 'l_upper_leg', 'l_lower_leg');
  parts.push({ geom: lLegGeom, mat: materials.pants });
  const rLegGeom = legGeom.clone().translate(0.15, 0.0, 0);
  addSkinning(rLegGeom, skeleton, 'r_upper_leg', 'r_lower_leg');
  parts.push({ geom: rLegGeom, mat: materials.pants });
  
  const finalGeom = mergeGeometries(parts.map(p => p.geom));
  const finalMat = parts.map(p => p.mat);

  const characterMesh = new THREE.SkinnedMesh(finalGeom, finalMat);
  characterMesh.bind(skeleton);
  
  mixer = new THREE.AnimationMixer(characterMesh);
  const idleClip = createIdleAnimation(skeleton.bones);
  mixer.clipAction(idleClip).play();

  return characterMesh;
}

function addSkinning(geometry, skeleton, boneName1, boneName2) {
    const bone1 = skeleton.getBoneByName(boneName1);
    const bone2 = boneName2 ? skeleton.getBoneByName(boneName2) : null;
    const boneIndex1 = skeleton.bones.indexOf(bone1);
    const boneIndex2 = bone2 ? skeleton.bones.indexOf(bone2) : 0;

    const skinIndices = [];
    const skinWeights = [];
    const position = geometry.attributes.position;
    
    const worldBone1 = new THREE.Vector3();
    const worldBone2 = new THREE.Vector3();
    bone1.getWorldPosition(worldBone1);
    if (bone2) bone2.getWorldPosition(worldBone2);

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        const vertex = new THREE.Vector3(x, y, z);

        if (!bone2) {
            skinIndices.push(boneIndex1, 0, 0, 0);
            skinWeights.push(1, 0, 0, 0);
        } else {
            const dist1 = vertex.distanceTo(worldBone1);
            const dist2 = vertex.distanceTo(worldBone2);
            const totalDist = dist1 + dist2;
            let weight1 = 1.0 - (dist1 / totalDist);
            let weight2 = 1.0 - (dist2 / totalDist);
            
            // Sharpen the blend
            weight1 = Math.pow(weight1, 1.5);
            weight2 = Math.pow(weight2, 1.5);
            
            const totalWeight = weight1 + weight2;
            weight1 /= totalWeight;
            weight2 /= totalWeight;
            
            skinIndices.push(boneIndex1, boneIndex2, 0, 0);
            skinWeights.push(weight1, weight2, 0, 0);
        }
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

function createIdleAnimation(bones) {
    const tracks = [];
    const duration = 4;
    const times = [0, duration / 2, duration];
    
    // Breathing
    const spineUpper = bones.find(b => b.name === 'spine_upper');
    const qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, 0, 0));
    const qMid = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, 0));
    tracks.push(new THREE.QuaternionKeyframeTrack('.bones[2].quaternion', times, [
        ...qStart.toArray(), ...qMid.toArray(), ...qStart.toArray()
    ]));

    // Arm swing
    const lShoulder = bones.find(b => b.name === 'l_shoulder');
    const rShoulder = bones.find(b => b.name === 'r_shoulder');
    const qArmStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.2));
    const qArmMid = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.2));
    const qArmStartInv = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.2));
    const qArmMidInv = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.2));
    tracks.push(new THREE.QuaternionKeyframeTrack('.bones[5].quaternion', times, [
        ...qArmStart.toArray(), ...qArmMid.toArray(), ...qArmStart.toArray()
    ]));
    tracks.push(new THREE.QuaternionKeyframeTrack('.bones[8].quaternion', times, [
        ...qArmStartInv.toArray(), ...qArmMidInv.toArray(), ...qArmStartInv.toArray()
    ]));
    
    // Head sway
    const neck = bones.find(b => b.name === 'neck');
    const qHeadStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.1, 0));
    const qHeadMid = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.1, 0));
    tracks.push(new THREE.QuaternionKeyframeTrack('.bones[3].quaternion', times, [
        ...qHeadStart.toArray(), ...qHeadMid.toArray(), ...qHeadStart.toArray()
    ]));
    
    return new THREE.AnimationClip('idle', duration, tracks);
}

export function setRendererQuality(q) {
  quality = q;
  const DPR = window.devicePixelRatio || 1;
  const scale = quality === 'low' ? 0.6 : quality === 'high' ? 1.0 : 0.85;
  renderer.setPixelRatio(Math.min(2, DPR * scale));
}

function onResize() {
  const rect = container.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height || 1;
  camera.updateProjectionMatrix();
}

function animate() {
  rafId = requestAnimationFrame(animate);
  const delta = clock.getDelta();
  
  if (mixer) {
    mixer.update(delta);
  }
  
  const time = clock.getElapsedTime();
  const idle = Math.sin(time * 1.2) * 0.02;
  if (character) {
    character.position.y = -0.8 + idle;
    character.rotation.y = Math.sin(time * 0.2) * 0.15;
  }

  renderer.render(scene, camera);
}

function destroy() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
}