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
  
  // Create skeleton structure
  const bones = [];
  
  // Root bone
  const rootBone = new THREE.Bone();
  rootBone.name = 'root';
  rootBone.position.set(0, 0, 0);
  bones.push(rootBone);
  
  // Spine bones
  const spineLower = new THREE.Bone();
  spineLower.name = 'spine_lower';
  spineLower.position.set(0, 0.4, 0);
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
  headBone.position.set(0, 0.4, 0);
  spineUpper.add(headBone);
  bones.push(headBone);
  
  // Left arm bones
  const leftShoulder = new THREE.Bone();
  leftShoulder.name = 'left_shoulder';
  leftShoulder.position.set(-0.6, 0.2, 0);
  spineUpper.add(leftShoulder);
  bones.push(leftShoulder);
  
  const leftUpperArm = new THREE.Bone();
  leftUpperArm.name = 'left_upper_arm';
  leftUpperArm.position.set(-0.1, -0.3, 0);
  leftShoulder.add(leftUpperArm);
  bones.push(leftUpperArm);
  
  const leftLowerArm = new THREE.Bone();
  leftLowerArm.name = 'left_lower_arm';
  leftLowerArm.position.set(0, -0.4, 0);
  leftUpperArm.add(leftLowerArm);
  bones.push(leftLowerArm);
  
  // Right arm bones
  const rightShoulder = new THREE.Bone();
  rightShoulder.name = 'right_shoulder';
  rightShoulder.position.set(0.6, 0.2, 0);
  spineUpper.add(rightShoulder);
  bones.push(rightShoulder);
  
  const rightUpperArm = new THREE.Bone();
  rightUpperArm.name = 'right_upper_arm';
  rightUpperArm.position.set(0.1, -0.3, 0);
  rightShoulder.add(rightUpperArm);
  bones.push(rightUpperArm);
  
  const rightLowerArm = new THREE.Bone();
  rightLowerArm.name = 'right_lower_arm';
  rightLowerArm.position.set(0, -0.4, 0);
  rightUpperArm.add(rightLowerArm);
  bones.push(rightLowerArm);
  
  // Left leg bones
  const leftHip = new THREE.Bone();
  leftHip.name = 'left_hip';
  leftHip.position.set(-0.25, -0.1, 0);
  rootBone.add(leftHip);
  bones.push(leftHip);
  
  const leftUpperLeg = new THREE.Bone();
  leftUpperLeg.name = 'left_upper_leg';
  leftUpperLeg.position.set(0, -0.4, 0);
  leftHip.add(leftUpperLeg);
  bones.push(leftUpperLeg);
  
  const leftLowerLeg = new THREE.Bone();
  leftLowerLeg.name = 'left_lower_leg';
  leftLowerLeg.position.set(0, -0.4, 0);
  leftUpperLeg.add(leftLowerLeg);
  bones.push(leftLowerLeg);
  
  // Right leg bones
  const rightHip = new THREE.Bone();
  rightHip.name = 'right_hip';
  rightHip.position.set(0.25, -0.1, 0);
  rootBone.add(rightHip);
  bones.push(rightHip);
  
  const rightUpperLeg = new THREE.Bone();
  rightUpperLeg.name = 'right_upper_leg';
  rightUpperLeg.position.set(0, -0.4, 0);
  rightHip.add(rightUpperLeg);
  bones.push(rightUpperLeg);
  
  const rightLowerLeg = new THREE.Bone();
  rightLowerLeg.name = 'right_lower_leg';
  rightLowerLeg.position.set(0, -0.4, 0);
  rightUpperLeg.add(rightLowerLeg);
  bones.push(rightLowerLeg);
  
  // Create skeleton
  const skeleton = new THREE.Skeleton(bones);
  
  // Create detailed character geometry
  const characterGeometry = createDetailedCharacterGeometry();
  
  // Create skin indices and weights for vertex skinning
  const position = characterGeometry.attributes.position;
  const vertex = new THREE.Vector3();
  
  const skinIndices = [];
  const skinWeights = [];
  
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    
    // Determine which bones influence this vertex based on position
    const weights = [0, 0, 0, 0];
    const indices = [0, 0, 0, 0];
    
    // Head region
    if (vertex.y > 1.2) {
      indices[0] = bones.findIndex(b => b.name === 'head');
      weights[0] = 1.0;
    }
    // Upper torso
    else if (vertex.y > 0.8) {
      indices[0] = bones.findIndex(b => b.name === 'spine_upper');
      indices[1] = bones.findIndex(b => b.name === 'head');
      weights[0] = 0.8;
      weights[1] = 0.2;
    }
    // Lower torso
    else if (vertex.y > 0.2) {
      indices[0] = bones.findIndex(b => b.name === 'spine_lower');
      indices[1] = bones.findIndex(b => b.name === 'spine_upper');
      weights[0] = 0.7;
      weights[1] = 0.3;
    }
    // Arms
    else if (vertex.y > 0.6 && Math.abs(vertex.x) > 0.4) {
      if (vertex.x < 0) {
        // Left arm
        if (vertex.y > 1.0) {
          indices[0] = bones.findIndex(b => b.name === 'left_shoulder');
          weights[0] = 1.0;
        } else if (vertex.y > 0.7) {
          indices[0] = bones.findIndex(b => b.name === 'left_upper_arm');
          weights[0] = 1.0;
        } else {
          indices[0] = bones.findIndex(b => b.name === 'left_lower_arm');
          weights[0] = 1.0;
        }
      } else {
        // Right arm
        if (vertex.y > 1.0) {
          indices[0] = bones.findIndex(b => b.name === 'right_shoulder');
          weights[0] = 1.0;
        } else if (vertex.y > 0.7) {
          indices[0] = bones.findIndex(b => b.name === 'right_upper_arm');
          weights[0] = 1.0;
        } else {
          indices[0] = bones.findIndex(b => b.name === 'right_lower_arm');
          weights[0] = 1.0;
        }
      }
    }
    // Legs
    else if (vertex.y < 0.2) {
      if (vertex.x < 0) {
        // Left leg
        if (vertex.y > -0.2) {
          indices[0] = bones.findIndex(b => b.name === 'left_upper_leg');
          weights[0] = 1.0;
        } else {
          indices[0] = bones.findIndex(b => b.name === 'left_lower_leg');
          weights[0] = 1.0;
        }
      } else {
        // Right leg
        if (vertex.y > -0.2) {
          indices[0] = bones.findIndex(b => b.name === 'right_upper_leg');
          weights[0] = 1.0;
        } else {
          indices[0] = bones.findIndex(b => b.name === 'right_lower_leg');
          weights[0] = 1.0;
        }
      }
    }
    // Default to root
    else {
      indices[0] = 0; // root bone
      weights[0] = 1.0;
    }
    
    skinIndices.push(indices[0], indices[1], indices[2], indices[3]);
    skinWeights.push(weights[0], weights[1], weights[2], weights[3]);
  }
  
  characterGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  characterGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  
  // Create materials
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xf0f0f0, 
    roughness: 0.4, 
    metalness: 0.1,
    flatShading: false
  });
  
  // Create skinned mesh
  const skinnedMesh = new THREE.SkinnedMesh(characterGeometry, bodyMaterial);
  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);
  
  group.add(skinnedMesh);
  
  // Create animation mixer and idle animation
  mixer = new THREE.AnimationMixer(skinnedMesh);
  
  // Create idle animation with arm movement
  const tracks = [];
  
  // Left shoulder rotation for arm swing
  const leftShoulderTimes = [0, 1, 2, 3, 4];
  const leftShoulderRotations = [
    0, 0, 0, 1,  // neutral
    0.1, 0, 0.1, Math.cos(0.05),  // forward
    0, 0, 0, 1,  // neutral
    -0.1, 0, -0.1, Math.cos(0.05),  // back
    0, 0, 0, 1   // back to neutral
  ];
  
  tracks.push(new THREE.QuaternionKeyframeTrack(
    'left_shoulder.quaternion',
    leftShoulderTimes,
    leftShoulderRotations
  ));
  
  // Right shoulder rotation (opposite of left)
  const rightShoulderRotations = [
    0, 0, 0, 1,  // neutral
    -0.1, 0, -0.1, Math.cos(0.05),  // back
    0, 0, 0, 1,  // neutral
    0.1, 0, 0.1, Math.cos(0.05),  // forward
    0, 0, 0, 1   // back to neutral
  ];
  
  tracks.push(new THREE.QuaternionKeyframeTrack(
    'right_shoulder.quaternion',
    leftShoulderTimes,
    rightShoulderRotations
  ));
  
  // Subtle spine movement
  const spineTimes = [0, 2, 4];
  const spineRotations = [
    0, 0, 0, 1,
    0.02, 0, 0, Math.cos(0.01),
    0, 0, 0, 1
  ];
  
  tracks.push(new THREE.QuaternionKeyframeTrack(
    'spine_upper.quaternion',
    spineTimes,
    spineRotations
  ));
  
  // Create animation clip
  const idleClip = new THREE.AnimationClip('idle', 4, tracks);
  const idleAction = mixer.clipAction(idleClip);
  idleAction.setLoop(THREE.LoopRepeat);
  idleAction.play();
  
  return group;
}

function createDetailedCharacterGeometry() {
  const geometries = [];
  
  // Head - more detailed sphere
  const headGeom = new THREE.SphereGeometry(0.45, 32, 32);
  headGeom.translate(0, 1.55, 0);
  geometries.push(headGeom);
  
  // Torso - custom shaped
  const torsoGeom = new THREE.CylinderGeometry(0.4, 0.5, 1.0, 16);
  torsoGeom.translate(0, 1.0, 0);
  geometries.push(torsoGeom);
  
  // Arms - more detailed
  const armGeom = new THREE.CapsuleGeometry(0.12, 0.6, 8, 16);
  const leftArmGeom = armGeom.clone();
  leftArmGeom.translate(-0.65, 1.1, 0);
  const rightArmGeom = armGeom.clone();
  rightArmGeom.translate(0.65, 1.1, 0);
  geometries.push(leftArmGeom, rightArmGeom);
  
  // Forearms
  const forearmGeom = new THREE.CapsuleGeometry(0.1, 0.5, 8, 12);
  const leftForearmGeom = forearmGeom.clone();
  leftForearmGeom.translate(-0.75, 0.6, 0);
  const rightForearmGeom = forearmGeom.clone();
  rightForearmGeom.translate(0.75, 0.6, 0);
  geometries.push(leftForearmGeom, rightForearmGeom);
  
  // Legs - more detailed
  const legGeom = new THREE.CapsuleGeometry(0.18, 0.6, 10, 16);
  const leftLegGeom = legGeom.clone();
  leftLegGeom.translate(-0.25, 0.3, 0);
  const rightLegGeom = legGeom.clone();
  rightLegGeom.translate(0.25, 0.3, 0);
  geometries.push(leftLegGeom, rightLegGeom);
  
  // Lower legs
  const lowerLegGeom = new THREE.CapsuleGeometry(0.15, 0.5, 8, 12);
  const leftLowerLegGeom = lowerLegGeom.clone();
  leftLowerLegGeom.translate(-0.25, -0.3, 0);
  const rightLowerLegGeom = lowerLegGeom.clone();
  rightLowerLegGeom.translate(0.25, -0.3, 0);
  geometries.push(leftLowerLegGeom, rightLowerLegGeom);
  
  // Eyes as separate details
  const eyeGeom = new THREE.SphereGeometry(0.08, 16, 16);
  const leftEyeGeom = eyeGeom.clone();
  leftEyeGeom.translate(-0.15, 1.65, 0.38);
  const rightEyeGeom = eyeGeom.clone();
  rightEyeGeom.translate(0.15, 1.65, 0.38);
  geometries.push(leftEyeGeom, rightEyeGeom);
  
  // Combine all geometries
  let combinedGeometry = new THREE.BufferGeometry();
  
  // Merge all geometries using BufferGeometryUtils would be ideal,
  // but for simplicity, let's create a combined geometry manually
  const positions = [];
  const normals = [];
  const uvs = [];
  
  geometries.forEach(geom => {
    const pos = geom.attributes.position.array;
    const norm = geom.attributes.normal.array;
    const uv = geom.attributes.uv.array;
    
    for (let i = 0; i < pos.length; i++) {
      positions.push(pos[i]);
    }
    for (let i = 0; i < norm.length; i++) {
      normals.push(norm[i]);
    }
    for (let i = 0; i < uv.length; i++) {
      uvs.push(uv[i]);
    }
  });
  
  combinedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  combinedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  combinedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  
  return combinedGeometry;
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
  
  // Update animation mixer
  if (mixer) {
    mixer.update(0.016); // roughly 60fps
  }
  
  // Subtle floating motion
  const idle = Math.sin(time * 1.5) * 0.015;
  if (characterGroup) {
    characterGroup.position.y = idle;
    characterGroup.rotation.y += 0.003; // subtle spin
  }

  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animate);
}

function destroy() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
}