import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// scene
const scene = new THREE.Scene();
// scene.background = new THREE.Color();

// camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.z = 1;

// renderer
const renderer = new THREE.WebGLRenderer({ alpha: true });

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setClearAlpha(0); // transparent bg, but also put it as parameter in top

document.body.appendChild(renderer.domElement);

// controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// loader
const loader = new GLTFLoader();

// lights
const light1 = new THREE.DirectionalLight(0xffffff, 2);
light1.position.set(2, 4, 10);
scene.add(light1);

const light2 = new THREE.DirectionalLight(0xffffff, 1);
light2.position.set(-2, -1, -3);
scene.add(light2);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// load model
loader.load('./models/Donut.glb', (gltf) => {

    gltf.scene.scale.set(20, 20, 20); // x,y,z scale of the donut/model

    scene.add(gltf.scene);

});


// animation loop
function animate() {

    requestAnimationFrame(animate);

    // animate zoom out/in in ifelse only
    if (camera.position.z < 5) {
        camera.position.z += 0.05;
    }

    controls.update();
    renderer.render(scene, camera);

}

animate();
