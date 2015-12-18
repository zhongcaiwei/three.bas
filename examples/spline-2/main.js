var mContainer;
var mCamera, mRenderer;
var mControls;

var mScene;

var mParticleCount = 25000; // <-- change this number!
var mParticleSystem;

var mTime = 0.0;
var mTimeStep = (1/60);
var mDuration = 120;

window.onload = function () {
  init();
};

function init() {
  initTHREE();
  initControls();
  initParticleSystem();

  requestAnimationFrame(tick);
  window.addEventListener('resize', resize, false);
}

function initTHREE() {
  mRenderer = new THREE.WebGLRenderer({antialias: true});
  mRenderer.setSize(window.innerWidth, window.innerHeight);

  mContainer = document.getElementById('three-container');
  mContainer.appendChild(mRenderer.domElement);

  mCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
  mCamera.position.set(0, 0, 800);

  mScene = new THREE.Scene();

  var light;

  light = new THREE.PointLight(0xffffff, 4, 800, 2);
  light.position.set(0, 300, 0);
  mScene.add(light);
}

function initControls() {
  mControls = new THREE.OrbitControls(mCamera, mRenderer.domElement);
}

function initParticleSystem() {
  var prefabGeometry = new THREE.OctahedronGeometry(3);
  var bufferGeometry = new THREE.BAS.PrefabBufferGeometry(prefabGeometry, mParticleCount);

  bufferGeometry.createAttribute('aOffset', 1, function(index, count) {
    return index / count * mDuration;
  });

  bufferGeometry.createAttribute('aPivot', 3, (function() {
    var r = [];

    return function() {
      r[0] = THREE.Math.randFloat(0, 2);
      r[1] = THREE.Math.randFloat(0, 2);
      r[2] = THREE.Math.randFloat(0, 2);

      return r;
    }
  })());

  bufferGeometry.createAttribute('aAxisAngle', 4, (function() {
    var axis = new THREE.Vector3();
    var angle = 0;
    var r = [];

    return function () {
      axis.x = THREE.Math.randFloatSpread(2);
      axis.y = THREE.Math.randFloatSpread(2);
      axis.z = THREE.Math.randFloatSpread(2);
      axis.normalize();

      angle = Math.PI * THREE.Math.randInt(24, 32);

      r[0] = axis.x;
      r[1] = axis.y;
      r[2] = axis.z;
      r[3] = angle;

      return r;
    }
  })());

  bufferGeometry.createAttribute('color', 3, (function() {
    var color = new THREE.Color();
    var h, s, l;
    var r = [];

    return function(index, count) {
      h = index / count;
      s = THREE.Math.randFloat(0.5, 0.75);
      l = THREE.Math.randFloat(0.25, 0.5);
      color.setHSL(h, s, l);

      r[0] = color.r;
      r[1] = color.g;
      r[2] = color.b;

      return r;
    }
  })());

  // buffer spline (uniform)
  var pathArray = [];
  var radiusArray = [];
  var length = 14;

  // first point
  pathArray.push(-1000, 0, 0);
  radiusArray.push(2);

  for (var i = 1; i < length - 1; i++) {
    pathArray.push(
      THREE.Math.randFloatSpread(500),
      THREE.Math.randFloatSpread(500),
      THREE.Math.randFloatSpread(500)
    );

    radiusArray.push(
      THREE.Math.randFloat(1, 24)
    );
  }

  // last point
  pathArray.push(1000, 0, 0);
  radiusArray.push(2);

  var material = new THREE.BAS.PhongAnimationMaterial(
    // custom parameters & THREE.MeshPhongMaterial parameters
    {
      vertexColors: THREE.VertexColors,
      shading: THREE.FlatShading,
      side: THREE.DoubleSide,
      defines: {
        PATH_LENGTH:pathArray.length / 3
      },
      uniforms: {
        uTime: {type: 'f', value: 0},
        uDuration: {type: 'f', value: mDuration},
        uPath: {type: 'fv', value: pathArray},
        uRadius: {type: 'fv1', value: radiusArray}
      },
      shaderFunctions: [
        THREE.BAS.ShaderChunk['quaternion_rotation'],
        THREE.BAS.ShaderChunk['catmull-rom']
      ],
      shaderParameters: [
        'uniform float uTime;',
        'uniform float uDuration;',
        'uniform vec3 uPath[PATH_LENGTH];',
        'uniform float uRadius[PATH_LENGTH];',
        'attribute float aOffset;',
        'attribute vec3 aPivot;',
        'attribute vec4 aAxisAngle;'
      ],
      shaderVertexInit: [
        'float tProgress = mod((uTime + aOffset), uDuration) / uDuration;',

        'float angle = aAxisAngle.w * tProgress;',
        'vec4 tQuat = quatFromAxisAngle(aAxisAngle.xyz, angle);'
      ],
      shaderTransformNormal: [
        'objectNormal = rotateVector(tQuat, objectNormal);'
      ],
      shaderTransformPosition: [
        'float tMax = float(PATH_LENGTH - 1);',
        'float tPoint = tMax * tProgress;',
        'float tIndex = floor(tPoint);',
        'float tWeight = tPoint - tIndex;',

        'int i1 = int(tIndex);',
        'int i2 = int(min(tIndex + 1.0, tMax));',
        'vec3 p0 = uPath[int(max(0.0, tIndex - 1.0))];',
        'vec3 p1 = uPath[i1];',
        'vec3 p2 = uPath[i2];',
        'vec3 p3 = uPath[int(min(tIndex + 2.0, tMax))];',
        // calculate radius (pivot scale?) by linearly interpolating between path values
        'float radius = mix(uRadius[i1], uRadius[i2], tWeight);',
        // pivot before rotation
        'transformed += aPivot * radius;',
        // then rotation
        'transformed = rotateVector(tQuat, transformed);',
        // then use catmull rom interpolation to get position on path
        'transformed += catmullRom(p0, p1, p2, p3, tWeight);'
      ]
    },
    // THREE.MeshPhongMaterial uniforms
    {
      shininess: 16,
      specular: 0xffd700
    }
  );

  mParticleSystem = new THREE.Mesh(bufferGeometry, material);
  // because the bounding box of the particle system does not reflect its on-screen size
  // set this to false to prevent the whole thing from disappearing on certain angles
  mParticleSystem.frustumCulled = false;

  mScene.add(mParticleSystem);
}

function tick() {
  update();
  render();

  mTime += mTimeStep;
  mTime %= mDuration;

  requestAnimationFrame(tick);
}

function update() {
  mControls.update();

  mParticleSystem.material.uniforms['uTime'].value = mTime;
}

function render() {
  mRenderer.render(mScene, mCamera);
}

function resize() {
  mCamera.aspect = window.innerWidth / window.innerHeight;
  mCamera.updateProjectionMatrix();

  mRenderer.setSize(window.innerWidth, window.innerHeight);
}
