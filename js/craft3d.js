function Craft3D(flightLog, canvas, propColors) {
    var 
        // Sets the distance between the center point and the center of the motor mount
        ARM_LENGTH = 1,
        
        NUM_PROP_LEVELS = 100,
        PROP_RADIUS = 0.5 * ARM_LENGTH,
        
        craftMaterial = new THREE.MeshLambertMaterial({ color : 0xA0A0A0 }),
        propMaterials = new Array(propColors),
        propShellMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, opacity: 0.20, transparent: true});
        
        numMotors = propColors.length;

    function buildPropGeometry() {
        var 
            props = new Array(NUM_PROP_LEVELS),
            extrudeSettings = {
                amount: 0.1 * PROP_RADIUS,
                steps: 1,
                bevelEnabled: false
            };
        
        for (var i = 0; i < NUM_PROP_LEVELS; i++) {
            if (i == 0) {
                props[i] = new THREE.Geometry();
            } else {
                var 
                    shape = new THREE.Shape();
                
                if (i == NUM_PROP_LEVELS - 1) {
                    //work around three.js bug that requires the initial point to be on the radius to complete a full circle
                    shape.moveTo(PROP_RADIUS, 0);
                    shape.absarc(0, 0, PROP_RADIUS, 0, Math.PI * 2 * i / (NUM_PROP_LEVELS - 1));
                } else {
                    shape.moveTo(0, 0);
                    shape.absarc(0, 0, PROP_RADIUS, 0, Math.PI * 2 * i / (NUM_PROP_LEVELS - 1));
                }

                props[i] = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            }
        }
        
        return props;
    }
    
    function buildCraft() {
        var
            path = new THREE.Path(),
            
            ARM_WIDTH_RADIANS = 0.15,
            
            HUB_RADIUS = 0.3,
            
            //How much wider is the motor mount than the arm
            MOTOR_MOUNT_WIDTH_RATIO = 2.0,
            
            //What portion of the arm length is motor mount
            MOTOR_MOUNT_LENGTH_RATIO = 0.1,
            
            //What portion of the arm length is the bevel at the beginning and end of the motor mount
            MOTOR_BEVEL_DEPTH_RATIO = 0.04,
            
            ARM_WIDTH = 2 * Math.sin(ARM_WIDTH_RADIANS) * HUB_RADIUS,
            
            CRAFT_DEPTH = ARM_LENGTH * 0.08;

        for (i = 0; i < numMotors; i++) {
            var 
                armStart = i / numMotors * Math.PI * 2 - ARM_WIDTH_RADIANS,
                armEnd = armStart + ARM_WIDTH_RADIANS * 2;
            
            if (i == 0) {
                path.moveTo(Math.cos(armStart) * HUB_RADIUS, Math.sin(armStart) * HUB_RADIUS);
            } else {
                path.lineTo(Math.cos(armStart) * HUB_RADIUS, Math.sin(armStart) * HUB_RADIUS);
            }
            
            var 
                // Unit vector pointing through the center of the arm
                armVectorX = Math.cos(armStart + ARM_WIDTH_RADIANS),
                armVectorY = Math.sin(armStart + ARM_WIDTH_RADIANS),
                
                // Vector at right angles scaled for the arm width
                crossArmX = -armVectorY * ARM_WIDTH * 0.5,
                crossArmY = armVectorX * ARM_WIDTH * 0.5,
                
                armPoints = [
                   // Make the first part of the arms parallel by spacing the ends the same amount as the beginnings
                   {length:1 - MOTOR_MOUNT_LENGTH_RATIO - MOTOR_BEVEL_DEPTH_RATIO, width:1},
                   {length:1 - MOTOR_MOUNT_LENGTH_RATIO, width:MOTOR_MOUNT_WIDTH_RATIO},
                   {length:1 + MOTOR_MOUNT_LENGTH_RATIO, width:MOTOR_MOUNT_WIDTH_RATIO},
                   // Bevel after end of motor mount
                   {length:1 + MOTOR_MOUNT_LENGTH_RATIO + MOTOR_BEVEL_DEPTH_RATIO, width: 1}
               ];
            
            armVectorX *= ARM_LENGTH;
            armVectorY *= ARM_LENGTH;
            
            // Draw one half of the arm:
            for (var j = 0; j < armPoints.length; j++) {
                var point = armPoints[j];
                path.lineTo(point.length * armVectorX - point.width * crossArmX, point.length * armVectorY - point.width * crossArmY);
            }

            // And flip the points to draw the other half:
            for (var j = armPoints.length - 1; j >= 0; j--) {
                var point = armPoints[j];
                path.lineTo(point.length * armVectorX + point.width * crossArmX, point.length * armVectorY + point.width * crossArmY);
            }
            
            path.lineTo(
                Math.cos(armEnd) * HUB_RADIUS, 
                Math.sin(armEnd) * HUB_RADIUS
            );
        }
        
        var 
            shape = path.toShapes(true, false),
            
            extrudeSettings = {
                amount: CRAFT_DEPTH,
                steps: 1,
                bevelEnabled: false
            },
            
            geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings),
        
            craftMesh = new THREE.Mesh(geometry, craftMaterial);
        
        return craftMesh;
    }
    
    var
        scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 0.1, 1000),
    
        renderer = new THREE.WebGLRenderer({canvas : canvas, alpha: true}),
    
        light = new THREE.HemisphereLight(0xd8d8ff, 0x304030, 1.1),
        
        craft = buildCraft(),
        propGeometry = buildPropGeometry(),
        
        props = new Array(numMotors),
        propShells = new Array(numMotors),
        
        motorOrder,
        sysInfo = flightLog.getSysConfig(),
        
        yawOffset;
    
    scene.add(craft);
    
    light.position.set(1, 1, 1).normalize();
    scene.add(light);

    camera.position.y = 0;
    camera.position.z = 5;
    
    if (numMotors == 3) {
        yawOffset = -Math.PI / 2;
    } else {
        yawOffset = Math.PI / 4; // Change from "plus" orientation to "X"
    }
    
    for (var i = 0; i < numMotors; i++) {
        propMaterials[i] = new THREE.MeshLambertMaterial({color: propColors[i]});

        var propShell = new THREE.Mesh(propGeometry[propGeometry.length - 1], propShellMaterial)
        
        propShells[i] = propShell;
        
        propShell.translateX(Math.cos(i / numMotors * Math.PI * 2) * ARM_LENGTH);
        propShell.translateY(Math.sin(i / numMotors * Math.PI * 2) * ARM_LENGTH);
        propShell.translateZ(0.10);
        
        craft.add(propShell);
    }
    
    // Motor numbering in counter-clockwise order starting from the 3 o'clock position
    switch (numMotors) {
        case 3:
            motorOrder = [0, 1, 2]; // Put motor 1 at the right
        break;
        case 4:
            motorOrder = [1, 3, 2, 0]; // Numbering for quad-plus
        break;
        default:
            motorOrder = new Array(numMotors);
            for (var i = 0; i < numMotors; i++) {
                motorOrder[i] = i;
            }
    }
    
    this.render = function(frame, frameFieldIndexes) {
        for (var i = 0; i < numMotors; i++) {
            if (props[i])
                propShells[i].remove(props[i]);
            
            var 
                throttlePos = Math.min(Math.max(frame[frameFieldIndexes["motor[" + motorOrder[i] + "]"]] - sysInfo.minthrottle, 0) / (sysInfo.maxthrottle - sysInfo.minthrottle), 1.0),
                propLevel = Math.round(throttlePos * (NUM_PROP_LEVELS - 1)),
                geometry = propGeometry[propLevel],
                prop = new THREE.Mesh(geometry, propMaterials[motorOrder[i]]);

            prop.scale.set(0.95, 0.95, 0.95);
            
            propShells[i].add(prop);
            
            props[i] = prop;
        }
        
        craft.rotation.x = -frame[flightLog.getMainFieldIndexByName('heading[1]')] /*- Math.PI / 2*/; // pitch
        craft.rotation.y = frame[flightLog.getMainFieldIndexByName('heading[0]')]; // roll
        craft.rotation.z = yawOffset;
        
        //craft.rotation.z -= frame[flightLog.getMainFieldIndexByName('heading[2]')]; // yaw
        
        renderer.render(scene, camera);
    };
}