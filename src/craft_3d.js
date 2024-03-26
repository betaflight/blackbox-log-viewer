export function Craft3D(flightLog, canvas, propColors) {
    var 
        // Sets the distance between the center point and the center of the motor mount
        ARM_LENGTH = 1,
        NUM_PROP_LEVELS = 100,
        
        HUB_RADIUS = ARM_LENGTH * 0.3,

        CRAFT_DEPTH = ARM_LENGTH * 0.08,
        ARROW_DEPTH = CRAFT_DEPTH * 0.5;
        
    var customMix;
        
        if(userSettings != null) {
            customMix = userSettings.customMix;
        } else {
            customMix = null;            
        }

    var numMotors; 
        if(customMix===null) {
            numMotors = propColors.length;
        } else {
            numMotors = customMix.motorOrder.length;
        }       

    var
        propRadius = numMotors == 8 ? 0.37 * ARM_LENGTH : 0.5 * ARM_LENGTH,
        
        craftMaterial = new THREE.MeshLambertMaterial({ color : 0xA0A0A0 }),
        arrowMaterial = new THREE.MeshLambertMaterial({ color : 0x404040 }),
        
        propMaterials = new Array(propColors),
        propShellMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, opacity: 0.20, transparent: true});

    function buildPropGeometry() {
        var 
            props = new Array(NUM_PROP_LEVELS),
            extrudeSettings = {
                amount: 0.1 * propRadius,
                steps: 1,
                bevelEnabled: false
            };
        
        for (var i = 0; i < NUM_PROP_LEVELS; i++) {
            if (i === 0) {
                props[i] = new THREE.Geometry();
            } else {
                var 
                    shape = new THREE.Shape();
                
                if (i == NUM_PROP_LEVELS - 1) {
                    //work around three.js bug that requires the initial point to be on the radius to complete a full circle
                    shape.moveTo(propRadius, 0);
                    shape.absarc(0, 0, propRadius, 0, Math.PI * 2 * i / (NUM_PROP_LEVELS - 1));
                } else {
                    shape.moveTo(0, 0);
                    shape.absarc(0, 0, propRadius, 0, Math.PI * 2 * i / (NUM_PROP_LEVELS - 1));
                }

                props[i] = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            }
        }
        
        return props;
    }
    
    // Build a direction arrow to go on top of the craft
    function buildArrow() {
        var
            ARROW_STALK_RADIUS = HUB_RADIUS * 0.15,
            ARROW_STALK_LENGTH = HUB_RADIUS * 0.8,
            ARROW_HEAD_RADIUS = HUB_RADIUS * 0.55,
            ARROW_HEAD_LENGTH = HUB_RADIUS * 0.55,
            
            ARROW_LENGTH = ARROW_STALK_LENGTH + ARROW_HEAD_LENGTH;
        
        var 
            path = new THREE.Path(),
            offset = -ARROW_LENGTH / 2;
        
        path.moveTo(-ARROW_STALK_RADIUS, 0 + offset);
        path.lineTo(-ARROW_STALK_RADIUS, ARROW_STALK_LENGTH + offset);
        path.lineTo(-ARROW_HEAD_RADIUS, ARROW_STALK_LENGTH + offset);
        path.lineTo(0, ARROW_LENGTH + offset);
        path.lineTo(ARROW_HEAD_RADIUS, ARROW_STALK_LENGTH + offset);
        path.lineTo(ARROW_STALK_RADIUS, ARROW_STALK_LENGTH + offset);
        path.lineTo(ARROW_STALK_RADIUS, 0 + offset);
        
        var 
            shape = path.toShapes(true, false),
            
            extrudeSettings = {
                amount: ARROW_DEPTH,
                steps: 1,
                bevelEnabled: false
            },
            
            geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings),
        
            arrowMesh = new THREE.Mesh(geometry, arrowMaterial);

        return arrowMesh;
    }
    
    function buildCraft() {
        var
            path = new THREE.Path(),
            
            ARM_WIDTH_RADIANS = 0.15,
            
            //How much wider is the motor mount than the arm
            MOTOR_MOUNT_WIDTH_RATIO = 2.0,
            
            //What portion of the arm length is motor mount
            MOTOR_MOUNT_LENGTH_RATIO = 0.1,
            
            //What portion of the arm length is the bevel at the beginning and end of the motor mount
            MOTOR_BEVEL_DEPTH_RATIO = 0.04,
            
            ARM_WIDTH = 2 * Math.sin(ARM_WIDTH_RADIANS) * HUB_RADIUS;

        for (i = 0; i < numMotors; i++) {
            var 
                armStart = i / numMotors * Math.PI * 2 - ARM_WIDTH_RADIANS,
                armEnd = armStart + ARM_WIDTH_RADIANS * 2;
            
            if (i === 0) {
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
        camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000),
    
        renderer = new THREE.WebGLRenderer({canvas : canvas, alpha: true}),
    
        light = new THREE.HemisphereLight(0xe4e4ff, 0x405040, 1.1),
        
        craft = new THREE.Object3D(),
        craftParent = new THREE.Object3D(),
        
        craftMesh = buildCraft(),
        arrowMesh = buildArrow(),
        propGeometry = buildPropGeometry(),
        
        props = new Array(numMotors),
        propShells = new Array(numMotors),
        
        motorOrder,
        sysInfo = flightLog.getSysConfig(),        
        yawOffset;
    
    // The craft object will hold the props and craft body
    // We'll rotate this to bring the front direction of the model to the correct position
    craft.add(craftMesh);
    
    // We put that in a container that we'll rotate based on the craft attitude
    craftParent.add(craft);

    // This allows us to add a craft directional arrow that'll point the same way as the craftMesh
    arrowMesh.position.z = CRAFT_DEPTH;
    
    craftParent.add(arrowMesh);
    
    scene.add(craftParent);
    
    light.position.set(1, 1, 1).normalize();
    scene.add(light);

    camera.position.y = 0;
    camera.position.z = 5;

    for (var i = 0; i < propColors.length; i++) {
        propMaterials[i] = new THREE.MeshLambertMaterial({color: propColors[i]});
    }
    
    for (var i = 0; i < numMotors; i++) {

        var propShell = new THREE.Mesh(propGeometry[propGeometry.length - 1], propShellMaterial);
        
        propShells[i] = propShell;
        
        propShell.translateX(Math.cos(i / numMotors * Math.PI * 2) * ARM_LENGTH);
        propShell.translateY(Math.sin(i / numMotors * Math.PI * 2) * ARM_LENGTH);
        propShell.translateZ(0.10);
        
        craft.add(propShell);
    }
    
    // Motor numbering in counter-clockwise order starting from the 3 o'clock position
    if(customMix===null) {
        switch (numMotors) {
            case 3:
                motorOrder = [0, 1, 2]; // Put motor 1 at the right
                yawOffset = -Math.PI / 2;
            break;
            case 4:
                motorOrder = [1, 3, 2, 0]; // Numbering for quad-plus
                yawOffset = Math.PI / 4; // Change from "plus" orientation to "X"
            break;
            case 6:
                motorOrder = [4, 1, 3, 5, 2, 0];
                yawOffset = 0;
            break;
            case 8:
                motorOrder = [5, 1, 4, 0, 7, 3, 6, 2];
                yawOffset = Math.PI / 8; // Put two motors at the front
            break;
            default:
                motorOrder = new Array(numMotors);
                for (var i = 0; i < numMotors; i++) {
                    motorOrder[i] = i;
                }
                yawOffset = 0;
        }
    } else {
        motorOrder = customMix.motorOrder;
        yawOffset  = customMix.yawOffset;
    }
    
    // Rotate the craft mesh and props to bring the board's direction arrow to the right direction
    craft.rotation.z = yawOffset;
    
    this.render = function(frame, frameFieldIndexes) {
        for (var i = 0; i < numMotors; i++) {
            if (props[i])
                propShells[i].remove(props[i]);
            
            var 
                throttlePos = Math.min(Math.max(frame[frameFieldIndexes["motor[" + motorOrder[i] + "]"]] - sysInfo.motorOutput[0], 0) / (sysInfo.motorOutput[1] - sysInfo.motorOutput[0]), 1.0),
                propLevel = Math.round(throttlePos * (NUM_PROP_LEVELS - 1)),
                geometry = propGeometry[propLevel],
                prop = new THREE.Mesh(geometry, propMaterials[motorOrder[i]]);

            prop.scale.set(0.95, 0.95, 0.95);
            
            // Tricopter tail servo
            /*if (i == 0 && numMotors == 3 && frameFieldIndexes["servo[5]"] !== undefined) {
                propShells[i].rotation.x = -(frame[frameFieldIndexes["servo[5]"]] - 1500) / 1000 * Math.PI;
            }*/
            
            propShells[i].add(prop);
            
            props[i] = prop;
        }
        
        // Display the craft's attitude
        craftParent.rotation.x = -frame[frameFieldIndexes['heading[1]']] /*- Math.PI / 2*/; // pitch
        craftParent.rotation.y = frame[frameFieldIndexes['heading[0]']]; // roll
        
        //craftParent.rotation.z = -frame[frameFieldIndexes['heading[2]']]; // yaw
        
        renderer.render(scene, camera);
    };
    
    this.resize = function(width, height) {
        if (canvas.width != width || canvas.height != height) {
            canvas.width = width;
            canvas.height = height;
            
            renderer.setViewport(0, 0, width, height);

            camera.updateProjectionMatrix();
        }
    }
}