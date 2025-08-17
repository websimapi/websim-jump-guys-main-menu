import * as THREE from 'three';

let renderer, scene, camera, rafId;
let container;
let characterGroup;
let mixer; // Animation mixer
let quality = 'medium';

export function initCharacterStage(canvas, initialQuality = 'medium') {
  container = canvas;
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
  characterGroup = createRiggedCharacter();
  scene.add(characterGroup);

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
  const group = new THREE.Group();
  
  // Create skeleton structure with better proportions
  const bones = [];
  
  // Root bone
  const rootBone = new THREE.Bone();
  rootBone.name = 'root';
  rootBone.position.set(0, 0, 0);
  bones.push(rootBone);
  
  // Spine bones with better spacing
  const spineLower = new THREE.Bone();
  spineLower.name = 'spine_lower';
  spineLower.position.set(0, 0.8, 0);
  rootBone.add(spineLower);
  bones.push(spineLower);
  
  const spineUpper = new THREE.Bone();
  spineUpper.name = 'spine_upper';
  spineUpper.position.set(0, 0.6, 0);
  spineLower.add(spineUpper);
  bones.push(spineUpper);
  
  // Head bone
  const headBone = new THREE.Bone();
  headBone.name = 'head';
  headBone.position.set(0, 0.5, 0);
  spineUpper.add(headBone);
  bones.push(headBone);
  
  // Left arm bones with better positioning
  const leftShoulder = new THREE.Bone();
  leftShoulder.name = 'left_shoulder';
  leftShoulder.position.set(-0.7, 0.3, 0);
  spineUpper.add(leftShoulder);
  bones.push(leftShoulder);
  
  const leftUpperArm = new THREE.Bone();
  leftUpperArm.name = 'left_upper_arm';
  leftUpperArm.position.set(0, -0.4, 0);
  leftShoulder.add(leftUpperArm);
  bones.push(leftUpperArm);
  
  const leftLowerArm = new THREE.Bone();
  leftLowerArm.name = 'left_lower_arm';
  leftLowerArm.position.set(0, -0.5, 0);
  leftUpperArm.add(leftLowerArm);
  bones.push(leftLowerArm);
  
  // Right arm bones
  const rightShoulder = new THREE.Bone();
  rightShoulder.name = 'right_shoulder';
  rightShoulder.position.set(0.7, 0.3, 0);
  spineUpper.add(rightShoulder);
  bones.push(rightShoulder);
  
  const rightUpperArm = new THREE.Bone();
  rightUpperArm.name = 'right_upper_arm';
  rightUpperArm.position.set(0, -0.4, 0);
  rightShoulder.add(rightUpperArm);
  bones.push(rightUpperArm);
  
  const rightLowerArm = new THREE.Bone();
  rightLowerArm.name = 'right_lower_arm';
  rightLowerArm.position.set(0, -0.5, 0);
  rightUpperArm.add(rightLowerArm);
  bones.push(rightLowerArm);
  
  // Left leg bones
  const leftHip = new THREE.Bone();
  leftHip.name = 'left_hip';
  leftHip.position.set(-0.3, 0, 0);
  rootBone.add(leftHip);
  bones.push(leftHip);
  
  const leftUpperLeg = new THREE.Bone();
  leftUpperLeg.name = 'left_upper_leg';
  leftUpperLeg.position.set(0, -0.5, 0);
  leftHip.add(leftUpperLeg);
  bones.push(leftUpperLeg);
  
  const leftLowerLeg = new THREE.Bone();
  leftLowerLeg.name = 'left_lower_leg';
  leftLowerLeg.position.set(0, -0.5, 0);
  leftUpperLeg.add(leftLowerLeg);
  bones.push(leftLowerLeg);
  
  // Right leg bones
  const rightHip = new THREE.Bone();
  rightHip.name = 'right_hip';
  rightHip.position.set(0.3, 0, 0);
  rootBone.add(rightHip);
  bones.push(rightHip);
  
  const rightUpperLeg = new THREE.Bone();
  rightUpperLeg.name = 'right_upper_leg';
  rightUpperLeg.position.set(0, -0.5, 0);
  rightHip.add(rightUpperLeg);
  bones.push(rightUpperLeg);
  
  const rightLowerLeg = new THREE.Bone();
  rightLowerLeg.name = 'right_lower_leg';
  rightLowerLeg.position.set(0, -0.5, 0);
  rightUpperLeg.add(rightLowerLeg);
  bones.push(rightLowerLeg);

  // Create character parts separately with different materials
  const materials = {
    head: new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.3, metalness: 0.1 }), // skin tone
    body: new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.4, metalness: 0.0 }), // blue shirt
    arms: new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.3, metalness: 0.1 }), // skin tone
    legs: new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5, metalness: 0.0 }), // dark pants
    eyes: new THREE.MeshStandardMaterial({ color: 0x000000 })
  };

  // Head
  const headGeom = new THREE.SphereGeometry(0.35, 32, 32);
  const headMesh = new THREE.SkinnedMesh(headGeom, materials.head);
  headMesh.position.set(0, 1.85, 0);
  addSimpleSkinning(headMesh, bones, 'head');
  group.add(headMesh);

  // Eyes
  const eyeGeom = new THREE.SphereGeometry(0.06, 16, 16);
  const leftEyeMesh = new THREE.SkinnedMesh(eyeGeom, materials.eyes);
  leftEyeMesh.position.set(-0.12, 1.9, 0.3);
  addSimpleSkinning(leftEyeMesh, bones, 'head');
  group.add(leftEyeMesh);

  const rightEyeMesh = new THREE.SkinnedMesh(eyeGeom, materials.eyes);
  rightEyeMesh.position.set(0.12, 1.9, 0.3);
  addSimpleSkinning(rightEyeMesh, bones, 'head');
  group.add(rightEyeMesh);

  // Body
  const bodyGeom = new THREE.CylinderGeometry(0.4, 0.5, 1.2, 16);
  const bodyMesh = new THREE.SkinnedMesh(bodyGeom, materials.body);
  bodyMesh.position.set(0, 1.2, 0);
  addSimpleSkinning(bodyMesh, bones, 'spine_upper');
  group.add(bodyMesh);

  // Arms
  const armGeom = new THREE.CapsuleGeometry(0.1, 0.7, 4, 16);
  
  const leftArmMesh = new THREE.SkinnedMesh(armGeom, materials.arms);
  leftArmMesh.position.set(-0.6, 1.1, 0);
  addSimpleSkinning(leftArmMesh, bones, 'left_upper_arm');
  group.add(leftArmMesh);

  const rightArmMesh = new THREE.SkinnedMesh(armGeom, materials.arms);
  rightArmMesh.position.set(0.6, 1.1, 0);
  addSimpleSkinning(rightArmMesh, bones, 'right_upper_arm');
  group.add(rightArmMesh);

  const forearmGeom = new THREE.CapsuleGeometry(0.08, 0.6, 4, 12);
  
  const leftForearmMesh = new THREE.SkinnedMesh(forearmGeom, materials.arms);
  leftForearmMesh.position.set(-0.6, 0.5, 0);
  addSimpleSkinning(leftForearmMesh, bones, 'left_lower_arm');
  group.add(leftForearmMesh);

  const rightForearmMesh = new THREE.SkinnedMesh(forearmGeom, materials.arms);
  rightForearmMesh.position.set(0.6, 0.5, 0);
  addSimpleSkinning(rightForearmMesh, bones, 'right_lower_arm');
  group.add(rightForearmMesh);

  // Legs
  const legGeom = new THREE.CapsuleGeometry(0.15, 0.8, 8, 16);
  
  const leftLegMesh = new THREE.SkinnedMesh(legGeom, materials.legs);
  leftLegMesh.position.set(-0.25, 0.3, 0);
  addSimpleSkinning(leftLegMesh, bones, 'left_upper_leg');
  group.add(leftLegMesh);

  const rightLegMesh = new THREE.SkinnedMesh(legGeom, materials.legs);
  rightLegMesh.position.set(0.25, 0.3, 0);
  addSimpleSkinning(rightLegMesh, bones, 'right_upper_leg');
  group.add(rightLegMesh);

  const lowerLegGeom = new THREE.CapsuleGeometry(0.12, 0.7, 6, 12);
  
  const leftLowerLegMesh = new THREE.SkinnedMesh(lowerLegGeom, materials.legs);
  leftLowerLegMesh.position.set(-0.25, -0.4, 0);
  addSimpleSkinning(leftLowerLegMesh, bones, 'left_lower_leg');
  group.add(leftLowerLegMesh);

  const rightLowerLegMesh = new THREE.SkinnedMesh(lowerLegGeom, materials.legs);
  rightLowerLegMesh.position.set(0.25, -0.4, 0);
  addSimpleSkinning(rightLowerLegMesh, bones, 'right_lower_leg');
  group.add(rightLowerLegMesh);

  // Add skeleton to group
  const skeleton = new THREE.Skeleton(bones);
  group.add(rootBone);
  
  // Create animation mixer
  mixer = new THREE.AnimationMixer(group);
  
  // Create improved idle animation
  const tracks = [];
  
  // More pronounced arm swinging
  const times = [0, 1, 2, 3, 4];
  
  // Left shoulder - swinging motion
  const leftShoulderRotations = [
    0, 0, 0.3, 0.95,    // forward swing
    0, 0, 0, 1,         // neutral
    0, 0, -0.2, 0.98,   // back swing  
    0, 0, 0, 1,         // neutral
    0, 0, 0.3, 0.95     // back to start
  ];
  
  tracks.push(new THREE.QuaternionKeyframeTrack(
    'left_shoulder.quaternion',
    times,
    leftShoulderRotations
  ));
  
  // Right shoulder - opposite motion
  const rightShoulderRotations = [
    0, 0, -0.2, 0.98,   // back swing
    0, 0, 0, 1,         // neutral
    0, 0, 0.3, 0.95,    // forward swing
    0, 0, 0, 1,         // neutral
    0, 0, -0.2, 0.98    // back to start
  ];
  
  tracks.push(new THREE.QuaternionKeyframeTrack(
    'right_shoulder.quaternion',
    times,
    rightShoulderRotations
  ));
  
  // Subtle head bobbing
  const headTimes = [0, 2, 4];
  const headPositions = [
    0, 0, 0,
    0, 0.05, 0,
    0, 0, 0
  ];
  
  tracks.push(new THREE.VectorKeyframeTrack(
    'head.position',
    headTimes,
    headPositions
  ));
  
  // Create and play animation
  const idleClip = new THREE.AnimationClip('idle', 4, tracks);
  const idleAction = mixer.clipAction(idleClip);
  idleAction.setLoop(THREE.LoopRepeat);
  idleAction.play();
  
  return group;
}

// Helper function for simple skinning
function addSimpleSkinning(mesh, bones, primaryBoneName) {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  
  const skinIndices = [];
  const skinWeights = [];
  
  const primaryBoneIndex = bones.findIndex(b => b.name === primaryBoneName);
  
  for (let i = 0; i < position.count; i++) {
    skinIndices.push(primaryBoneIndex, 0, 0, 0);
    skinWeights.push(1, 0, 0, 0);
  }
  
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  
  // Bind skeleton
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
}

function createDetailedCharacterGeometry() {
  // This function is no longer needed as we create parts separately
  return new THREE.BoxGeometry(1, 1, 1);
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

function animate(t = 0) {
  const time = t / 1000;
  
  // Update animation mixer with proper delta time
  if (mixer) {
    mixer.update(0.016);
  }
  
  // Subtle floating motion
  const idle = Math.sin(time * 1.2) * 0.02;
  if (characterGroup) {
    characterGroup.position.y = idle;
    // Slower, more subtle rotation
    characterGroup.rotation.y = time * 0.1;
  }

  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animate);
}

function destroy() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
}