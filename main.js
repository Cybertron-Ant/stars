


var scene, camera, renderer;


// Setup the scene
function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.z = 50;
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000);

  //clock = new THREE.Clock();


  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', function() {
    var w = window.innerWidth,
      h = window.innerHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    renderer.setSize(w, h);
  }, false);

}



//global variables to use later
var particleGroup, emitter


// Create particle group and emitter
function initParticles() {
  particleGroup = new ShaderParticleGroup({
    texture: THREE.ImageUtils.loadTexture('./img/star.png'),
    maxAge: 2,
    blending: THREE.AdditiveBlending
  });

  emitter = new ShaderParticleEmitter({
    positionSpread: new THREE.Vector3(100, 100, 100),

    acceleration: new THREE.Vector3(0, 0, 10),

    velocity: new THREE.Vector3(0, 0, 10),

    colorStart: new THREE.Color('white'),
    colorEnd: new THREE.Color('White'),
    size: 2,
    sizeEnd: 2,
    opacityStart: 0,
    opacityMiddle: 1,
    opacityEnd: 0,

    particlesPerSecond: 2500
  });

  particleGroup.addEmitter(emitter);
  scene.add(particleGroup.mesh);

}





// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Lower time-step value to lower speed of moving stars
    render(0.016);
}

function render(dt) {
    particleGroup.tick(dt);
    renderer.render(scene, camera);
}


init()

initParticles()

// Start animation
setTimeout(animate, 0);
