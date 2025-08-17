import * as THREE from 'three';

let renderer, scene, camera, rafId;
let container;
let characterGroup, body;
let quality = 'medium';
let armL, armR, legLGroup, legRGroup;

export function initCharacterStage(canvas, initialQuality = 'medium') {
  container = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

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

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
  scene.add(light);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(2, 3, 2);
  scene.add(dir);

  // Character (bean-like)
  characterGroup = new THREE.Group();
  scene.add(characterGroup);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffde3a,
    roughness: 0.4,
    metalness: 0.1,
  });

  // W Brand materials for eyes
  const eyeColors = {
    c1: new THREE.Color(0xF9E88B), // Left segment: #F9E88B
    c2: new THREE.Color(0x4AD0F6), // Middle segment: #4AD0F6
    c3: new THREE.Color(0xF6A8D9)  // Right segment: #F6A8D9
  };

  const gradientEyeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      c1: { value: eyeColors.c1 },
      c2: { value: eyeColors.c2 },
      c3: { value: eyeColors.c3 },
      gradientWidth: { value: 0.25 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 c1;
      uniform vec3 c2;
      uniform vec3 c3;
      uniform float gradientWidth;

      void main() {
        float u = vUv.x;
        vec3 color = c1;

        // Transition from c1 to c2
        float stop1 = 0.25;
        float t1 = smoothstep(stop1 - gradientWidth, stop1 + gradientWidth, u);
        color = mix(color, c2, t1);

        // Transition from c2 to c3
        float stop2 = 0.75;
        float t2 = smoothstep(stop2 - gradientWidth, stop2 + gradientWidth, u);
        color = mix(color, c3, t2);

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  // Body
  body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.5, 16, 32), bodyMat);
  body.position.y = 1.35;
  characterGroup.add(body);

  // Eyes (W-logo style)
  const faceRadius = 0.605; // Slightly larger than body radius to sit on top

  function createWPath(points, radius) {
    points.forEach(p => {
      const R = radius + 0.001; // Ensure it's on the surface
      p.z = -R + Math.sqrt(Math.max(0, R * R - p.x * p.x));
    });
    return new THREE.CatmullRomCurve3(points);
  }

  const eyeRadius = 0.04;
  const sphereGeom = new THREE.SphereGeometry(eyeRadius, 8, 8);

  // Define W points
  const p1 = new THREE.Vector3(-0.16, 0.1, 0);
  const p2 = new THREE.Vector3(-0.08, -0.1, 0);
  const p3 = new THREE.Vector3(0, 0.1, 0);
  const p4 = new THREE.Vector3(0.08, -0.1, 0);
  const p5 = new THREE.Vector3(0.16, 0.1, 0);

  // Project points onto face
  [p1, p2, p3, p4, p5].forEach(p => {
    const R = faceRadius + 0.001;
    p.z = -R + Math.sqrt(Math.max(0, R * R - p.x * p.x));
  });

  // Create tube geometries
  const leftGeom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p1, p2]), 20, eyeRadius, 8, false);
  const midGeom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p2, p3, p4]), 20, eyeRadius, 8, false);
  const rightGeom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p4, p5]), 20, eyeRadius, 8, false);
  
  function createEye() {
    const eyeGroup = new THREE.Group();
    
    // The gradient material is intended for the whole eye.
    // The previous individual materials (eyeLeftMat, etc.) were removed, causing an error.
    // We will use the gradientEyeMaterial for all parts.
    const eyeMat = gradientEyeMaterial || bodyMat; // Fallback to bodyMat if gradient material fails

    // Segments
    const segL = new THREE.Mesh(leftGeom, eyeMat);
    const segM = new THREE.Mesh(midGeom, eyeMat);
    const segR = new THREE.Mesh(rightGeom, eyeMat);
    eyeGroup.add(segL, segM, segR);
    
    // Rounded caps
    const cap1 = new THREE.Mesh(sphereGeom, eyeMat);
    cap1.position.copy(p1);
    
    const cap2 = new THREE.Mesh(sphereGeom, eyeMat);
    cap2.position.copy(p2);
    
    const cap3 = new THREE.Mesh(sphereGeom, eyeMat);
    cap3.position.copy(p3);
    
    const cap4 = new THREE.Mesh(sphereGeom, eyeMat);
    cap4.position.copy(p4);

    const cap5 = new THREE.Mesh(sphereGeom, eyeMat);
    cap5.position.copy(p5);
    
    eyeGroup.add(cap1, cap2, cap3, cap4, cap5);
    
    return eyeGroup;
  }

  const eyeL = createEye();
  const eyeR = createEye();
  
  eyeL.position.set(-0.25, 0.25, 0.58);
  eyeR.position.set(0.25, 0.25, 0.58);
  body.add(eyeL, eyeR);

  // Arms & Hands
  const armsGroup = new THREE.Group();
  characterGroup.add(armsGroup);
  const armGeom = new THREE.CapsuleGeometry(0.12, 0.6, 8, 16);
  armL = new THREE.Mesh(armGeom, bodyMat);
  armR = new THREE.Mesh(armGeom, bodyMat);
  armL.position.set(-0.55, 1.3, 0);
  armR.position.set(0.55, 1.3, 0);
  armL.rotation.z = Math.PI / 4;
  armR.rotation.z = -Math.PI / 4;
  armsGroup.add(armL, armR);

  const handGeom = new THREE.SphereGeometry(0.18, 16, 16);
  const handL = new THREE.Mesh(handGeom, bodyMat);
  const handR = new THREE.Mesh(handGeom, bodyMat);
  
  // Position hands at the end of the arms by parenting them
  // The capsule's total length is its height + 2 * radius. Half of that is the distance from center to tip.
  const armHalfLength = armGeom.parameters.height / 2 + armGeom.parameters.radius;
  handL.position.y = -armHalfLength;
  handR.position.y = -armHalfLength;
  armL.add(handL);
  armR.add(handR);

  // Legs & Feet
  const legs = new THREE.Group();
  characterGroup.add(legs);
  const legGeom = new THREE.CapsuleGeometry(0.2, 0.5, 8, 16);
  const footGeom = new THREE.CapsuleGeometry(0.25, 0.2, 8, 16);
  footGeom.rotateX(Math.PI / 16);
  
  // Left Leg Group
  legLGroup = new THREE.Group();
  const legL = new THREE.Mesh(legGeom, bodyMat);
  legL.position.y = legGeom.parameters.height / 2; // Position relative to group pivot
  const footL = new THREE.Mesh(footGeom, bodyMat);
  footL.position.z = 0.05;
  legLGroup.add(legL, footL);
  legLGroup.position.set(-0.28, 0.1, 0); // Position group pivot at the 'hip'
  legs.add(legLGroup);

  // Right Leg Group
  legRGroup = new THREE.Group();
  const legR = new THREE.Mesh(legGeom, bodyMat);
  legR.position.y = legGeom.parameters.height / 2;
  const footR = new THREE.Mesh(footGeom, bodyMat);
  footR.position.z = 0.05;
  legRGroup.add(legR, footR);
  legRGroup.position.set(0.28, 0.1, 0);
  legs.add(legRGroup);

  // Lighting add-on
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(-2, 1, -2);
  scene.add(rim);

  window.addEventListener('resize', onResize);
  onResize();

  setRendererQuality(initialQuality);
  animate();

  return { setQuality: setRendererQuality, destroy };
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

  // Gentle bobbing
  const bob = Math.sin(time * 2.5) * 0.06;
  characterGroup.position.y = bob;

  // Breathing effect
  const breath = Math.sin(time * 2.0) * 0.025;
  if (body) {
    body.scale.x = 1 + breath;
    body.scale.z = 1 + breath;
  }

  // Arm swing
  const armSwing = Math.sin(time * 2.5) * 0.25;
  if (armL) armL.rotation.z = Math.PI / 4 + armSwing;
  if (armR) armR.rotation.z = -Math.PI / 4 - armSwing;

  // Legs walk animation
  const legSwing = Math.sin(time * 5.0) * 0.4;
  if (legLGroup) legLGroup.rotation.x = legSwing - 0.2;
  if (legRGroup) legRGroup.rotation.x = -legSwing - 0.2;

  // Subtle continuous spin
  characterGroup.rotation.y += 0.003;

  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animate);
}

function destroy() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
}