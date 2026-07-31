// Renders the Rotorflight helicopter 3D model (a real GLTF asset, not a procedurally-built mesh
// like the multirotor Craft3D), driven by the log's directly-logged `attitude[0..2]` fields.
// Ported from https://github.com/rotorflight/rotorflight-blackbox (js/craft_3d.js).

const MODEL_URL = "/resources/models/bell_cw.gltf";

/**
 * Whether the given flight log has the attitude fields this model needs to be driven by.
 */
export function heliModelHasAttitude(flightLog) {
  return (
    typeof flightLog.getMainFieldIndexByName("attitude[0]") === "number" &&
    typeof flightLog.getMainFieldIndexByName("attitude[1]") === "number" &&
    typeof flightLog.getMainFieldIndexByName("attitude[2]") === "number"
  );
}

export function Craft3DHeli(flightLog, canvas) {
  const attitudeFrameIndex = {
    x: flightLog.getMainFieldIndexByName("attitude[1]"),
    y: flightLog.getMainFieldIndexByName("attitude[2]"),
    z: flightLog.getMainFieldIndexByName("attitude[0]"),
  };

  let model = null;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    75,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000,
  );
  // Move the camera away from the model
  camera.position.z = 200;
  scene.add(camera);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
  directionalLight.position.set(0, 600, 800);
  scene.add(directionalLight);

  // modelWrapper adds an extra axis of rotation to avoid gimbal lock with the euler angles
  const modelWrapper = new THREE.Object3D();
  scene.add(modelWrapper);

  const render = () => {
    renderer.render(scene, camera);
  };

  const loader = new THREE.GLTFLoader();
  loader.load(MODEL_URL, (gltf) => {
    model = gltf.scene;
    modelWrapper.add(model);
    render();
  });

  const rotateTo = (x, y, z) => {
    if (!model) return;

    model.rotation.x = x;
    modelWrapper.rotation.y = y;
    model.rotation.z = z;
    render();
  };

  // Matches the Craft3D (multirotor) call signature so grapher.js doesn't need to special-case
  // this renderer at the call site.
  this.render = function (frame) {
    rotateTo(
      (-frame[attitudeFrameIndex.x] / 1800) * Math.PI,
      (-frame[attitudeFrameIndex.y] / 1800) * Math.PI,
      (-frame[attitudeFrameIndex.z] / 1800) * Math.PI,
    );
  };

  this.resize = function (width, height) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    }
  };
}
