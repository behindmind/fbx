(function(require, _, VAPI, THREE, console, Math) {
/*
@vname Orbit Camera Controller
@vdescription A controller that allows a camera to easily orbit a target object.
@vfilter camera
@vcategory Camera Controllers
@vattr object targetObject { 
  default : null, 
  description : 'The object that the camera orbit point will be relative to.',
}
@vattr v3 targetOffset {
  'default' : {"x": 0.0, "y": 0.0, 'z': 0.0 },
  'description' : 'An offset relative to the target object. This will allow you to target a specific point on an object.',
}
@vattr float inertialDamping {
  'default': 0.40,
  'description': 'How quickly the camera stops moving when input stops.',
  "min" : 0.0,
  "max" : 1.0
}
@vattr bool invertX {
  'default': false,
  'description': 'Reverse the default direction that the camera moves horizontally.'
}
@vattr bool invertY {
  'default': false,
  'description': 'Reverse the default direction that the camera moves vertically.'
}
@vattr bool invertZoom {
  'default': false,
  'description': 'Reverse the default direction that the camera moves when zooming.'
}
@vattr float lookSpeed {
  'description' : 'The speed that the camera orbits the target',
  'default' : 1.0,
  'max' : 1000,
  'min' : 0.0001
}
@vattr float movementSpeed {
  'description' : 'The speed that the camera moves when panning',
  'default' : 8.0,
  'max' : 2000,
  'min' : 0.001
}
@vattr bool autoOrbit {
  'default': false,
  'description': 'Automatically orbit the camera when the user is not controlling it.'
}
@vattr float autoOrbitSpeed {
  'description' : 'The speed of the automatic orbit.',
  'default' : 1.0,
  'max' : 1000,
  'min' : 0.0001
}
@vattr float autoOrbitDelay {
  'description' : 'The period of time with no mouse input before the auto-orbit starts (in seconds).',
  'default' : 1.0,
  'max' : 1000,
  'min' : 0.0001
}
@vattr float orbitDistanceMin {
  'description' : 'The closest that the camera is allowed to get to the target.',
  'default' : 0.01,
  'max' : 1000,
  'min' : 0.001
}
@vattr float orbitDistanceMax {
  'description' : 'The furthest that the camera is allowed to get from the target.',
  'default' : 500.0,
  'max' : 10000,
  'min' : 1.0
}
@vattr Vector2 pitchAngleBounds {
  'description' : 'Allows you to set how far the camera can pitch (tilt) from horizontal. Defined in degrees with horizontal being 0.',
  'default': {"max": 75.0, "min": -75.0 },
  "max": { "max": 90.0, "min": 90.0 },
  "min": { "max": -90.0, "min": -90.001 } 
}
@vattr bool enablePan {
  'default': true,
  'description': 'Allow the user to pan side-to-side and up and down with the camera.'
}
@vattr bool enableZoom {
  'default': true,
  'description': 'Allow the user to zoom in and out with the camera.'
}
@vattr bool interpolation {
  'default': true,
  'description': 'When enabled, the camera will smoothly interpolate toward its desired state. e.g. If something else moves the camera, interpolation will cause the camera to smoothly focus on the target again. Otherwise, it will snap back.'
}
@vattr float interpSpeed {
  'description' : 'The speed at which the orbiting camera locks on to its target, if set to point away from it.',
  'default' : 0.5,
  'max' : 10.0,
  'min' : 0.01
}
@vattr bool usePointerLock {
  'default': false,
  'description': 'The mouse cursor will be hidden during camera control and won\'t move. Requires the user to accept pointer lock message in web browser.'
}

@vevent local enableOrbitCameraController {'scope' : 'local', 'action':true, 'category':'Orbit Camera', 'parameters' : []}
@vevent local disableOrbitCameraController {'scope' : 'local', 'action':true, 'category':'Orbit Camera', 'parameters' : []}
@vevent local toggleOrbitCameraController {'scope' : 'local', 'action':true, 'category':'Orbit Camera', 'parameters' : []}
@vevent local setOrbitDistance {'scope' : 'local', 'action':true, 'category':'Orbit Camera', 'parameters' : [
  {'name': 'newDistance', 'type': 'f', 'description': 'The new distance that the camera will orbit at.', 'default': 1.0},
]}
@vevent local setTarget {'scope' : 'local', 'description': 'Sets the camera to orbit the given object', 'action':true, 'category':'Orbit Camera', 'parameters' : [
  {'name': 'newTarget', 'type': 'object', 'description': 'The new target that the camera will orbit.', 'default': null},
  {'name': 'center', 'type': 'b', 'description': 'Whether or not to target the center of the object. If false, the camera will orbit the origin of the object.', 'default': true},
]}
@vevent local focusOnTarget {'scope' : 'local', 'description': 'Look at the center of the current target and zoom so that the object nicely fills the field of view.', 'action':true, 'category':'Orbit Camera', 'parameters' : []}

*/

var _ = require('underscore');

/* global VAPI */

/**
 * A custom component class.
 *
 * @class OrbitCamera
 */
function OrbitCamera() {
  this.isEditor = false;
  this._moveVector = new THREE.Vector3();
  this._tempVector = new THREE.Vector3();
  this._tempVector2 = new THREE.Vector3();
  this._tempVector4 = new THREE.Vector4();
  this._pivotWorldPos = new THREE.Vector3();
  this._tempMatrix4 = new THREE.Matrix4();
  //The point that the camera will orbit (using the targetObject and targetOffset)
  this.pivotPoint = new THREE.Object3D();
  this.targetObject = undefined;
  this.targetOffset = new THREE.Vector3();
  this.tempCamera = new THREE.PerspectiveCamera();
  this.tempEuler = new THREE.Euler(0,0,0, 'YXZ');
  this.tempQuaternion = new THREE.Quaternion();
  this.tempQuaternion2 = new THREE.Quaternion();
  this.currentOrbitDistance = 2.50;
  this.newOrbitDistance = 0.0;
  this.targetMoved = true;
  
  this.ellapsedTimeSinceInput = 0;
  this.enablePan = undefined;
  this.enableZoom = undefined;

  this.invertX = false;
  this.invertY = false;
  this.invertZoom = false;
  this.touchLast = new THREE.Vector2();
  this.touchLastPinchDist = 0.0;
  // this.touchYStart = 0.0;
  this.orbitMovement = new THREE.Vector2();
  this.linearMovementDelta = new THREE.Vector3();
  this.zoomDelta = 0.0;
  this.currentOrbitSpeed = new THREE.Vector2();
  this.currentMoveSpeed = new THREE.Vector2();
  this.currentZoomSpeed = 0.0;
  this.orbitMovementLength = 0.0;
  this.linearMovementDeltaLength = 0.0;

  this.moveStart = new THREE.Vector2();
  this.pan = false;
  this.look = false;
  this.zoom = false;
  this.isMouseDragging = false;
  this.autoOrbitOn = false;
    
  // this.positionStart = new THREE.Vector3();
  this.quaternionStart = new THREE.Quaternion();
  this.eulerStart = new THREE.Euler(0,0,0, 'YXZ');
  this.currentMousePosition = new THREE.Vector2();

  this.pitchAngleBoundsRadians = { max: 0.0, min: 0.0 };
  this.onMouseDown_PointerLock = this.onMouseDown_PointerLock.bind(this);
  this.onMouseUp_PointerLock = this.onMouseUp_PointerLock.bind(this);
  this.mouseControls = {
    panControl: "right",
    orbitControl: "left",
    zoomControl: "",
  };
}

OrbitCamera.prototype = new VAPI.VeroldComponent();

OrbitCamera.prototype.setMouseControls = function(newControls) {
  this.mouseControls = {
    panControl: newControls.panControl,
    orbitControl: newControls.orbitControl,
    zoomControl: newControls.zoomControl,
  };
};

OrbitCamera.prototype.editorInit = function() {
  // var that = this;
  this.isEditor = true;
  this.init();
  this.pivotPoint.add( 
    new THREE.Mesh( 
      new THREE.SphereGeometry( 0.025, 12, 12 ), 
      new THREE.MeshBasicMaterial({wireframe: true})
    ));
  this.pivotPoint.visible = false;
  this.getEngine().on( "update", this.editorUpdate, this );
  this.getEntity().on( "editorSelected", this.onSelected, this );
  this.getEntity().on( "editorUnselected", this.onUnselected, this );
  var that = this;
  VAPI.globalEvents.trigger('studioApp::isSelected', this.getEntity(), function( selected ) {
    if ( selected ) {
      that.onSelected();
    }
  });
};

OrbitCamera.prototype.editorShutdown = function() {
  this.shutdown();
  this.getEngine().off( "update", this.editorUpdate, this );
  this.getEntity().off( "editorSelected", this.onSelected, this );
  this.getEntity().off( "editorUnselected", this.onUnselected, this );
  this.getEntity().reset();
  if ( this.transformControls ) {
    this.transformControls.detach( this.pivotPoint );
    if ( this.transformControls.parent ) {
      this.transformControls.parent.remove( this.transformControls );
    }
    this.transformControls.destroy();
  }
  this.pivotPoint.visible = false;
};

OrbitCamera.prototype.onSelected = function() {
  var that = this;
  if ( !this.transformControls ) {
    var editorCamera;
    VAPI.globalEvents.trigger('studioApp::getCurrentCamera', function( camera ) {
      editorCamera = camera.threeData;
    });
    this.transformControls = new THREE.TransformControls( editorCamera, this.getEngine().canvas );
    this.transformControls.size = 0.75;
    // this.transformControls.addEventListener( 'change', function( gizmo ) {
    // });
    this.transformControls.addEventListener( 'change_final', function( gizmo ) {
      that.setAttribute('targetOffset', that.pivotPoint.position, { save: true } );
    });
    this.initTarget();
  }
  if ( this.isEnabled() ) {
    this.transformControls.attach( this.pivotPoint );
    this.pivotPoint.visible = true;
  }
};

OrbitCamera.prototype.onUnselected = function() {
  if ( this.isEnabled() ) {
    this.pivotPoint.visible = false;
    if ( this.transformControls ) {
      this.transformControls.detach( this.pivotPoint );
    }
    this.getEntity().reset();
  }
};

OrbitCamera.prototype.editorUpdate = function( delta ) {
  if ( this.isEnabled() && this.transformControls && this.pivotPoint.visible ) {
    this.transformControls.update();
    this.updateCamera( delta );

    var editorCamera;
    VAPI.globalEvents.trigger('studioApp::getCurrentCamera', function( camera ) {
      editorCamera = camera.threeData;
    });
    if ( this.pivotPoint.parent ) {
      this._tempVector.subVectors( this.pivotPoint.getWorldPosition(), editorCamera.getWorldPosition() );
      var distance = this._tempVector.length();
      this.pivotPoint.scale.copy( this.pivotPoint.parent.getWorldScale() );
      this.pivotPoint.scale.x = distance / this.pivotPoint.scale.x;
      this.pivotPoint.scale.y = distance / this.pivotPoint.scale.y;
      this.pivotPoint.scale.z = distance / this.pivotPoint.scale.z;
      
    }
  }
};

OrbitCamera.prototype.onEnable = function() {
  if ( this.isEditor ) {
    this.onSelected();
  }
  else {
    this.getEntity().reset();
    this.targetOffset = this.getAttribute( 'targetOffset' );
    this.attributesChanged( { targetOffset: this.targetOffset });
    this.currentMoveSpeed.set( 0, 0 );
    this.moveStart.copy( this.currentMousePosition );
  }
};

OrbitCamera.prototype.onDisable = function() {
  if ( this.isEditor ) {
    this.pivotPoint.visible = false;
    this.transformControls.detach( this.pivotPoint );
    this.getEntity().reset();
  }
  else {
    this.getEntity().reset();
  }
};

OrbitCamera.prototype.attributesChanged = function( changes ) {
  if ( changes.targetObject !== undefined ) {
    this.targetMoved = true;
    // if ( !(changes.targetOffset && changes.targetOffset.x !== undefined) ) {
    //   var that = this;
    //   var offset = { x: 0, y: 0, z: 0};
    //   that.setAttribute('targetOffset', offset, { save: true } );
    // }
    this.initTarget();
    
    if ( this.isEditor ) {
      this.pivotPoint.scale.copy( this.pivotPoint.parent.getWorldScale() );
      this.pivotPoint.scale.x = 1.0 / this.pivotPoint.scale.x;
      this.pivotPoint.scale.y = 1.0 / this.pivotPoint.scale.y;
      this.pivotPoint.scale.z = 1.0 / this.pivotPoint.scale.z;
    }
  }
  else if ( changes.targetOffset && changes.targetOffset.x !== undefined ) {
    this.setTargetOffset( changes.targetOffset );
  }
};

OrbitCamera.prototype.init = function() {
  
  var engine = this.getEngine();
  
  if ( this.usePointerLock ) {
    this.togglePointerLock( true );
  }
  this.pitchAngleBoundsRadians.max = Math.PI * this.pitchAngleBounds.max / 180.0;
  this.pitchAngleBoundsRadians.min = Math.PI * this.pitchAngleBounds.min / 180.0;

  this.getEntity().when('load_base', this.initTarget, this );
  this.on( 'enable', this.onEnable, this );
  this.on( 'disable', this.onDisable, this );
  
  if ( !this.isEditor ) {
    if ( window.VAPI.isMobile() ) {
      engine.on( 'touchStart', this.onTouchStart, this );
      engine.on( 'touchMove', this.onTouchMove, this );
      engine.on( 'touchEnd', this.onTouchEnd, this );
    }
    else {
      engine.on( 'mouseUp', this.onMouseUp, this );
      engine.on( 'mouseDown', this.onMouseDown, this );
      engine.on( 'mouseMove', this.onMouseMove, this );
      engine.on( 'mouseScroll', this.onMouseScroll, this );
    }
  }

  this.getEntity().on('enableOrbitCameraController', this.orbitCameraEnable, this);
  this.getEntity().on('disableOrbitCameraController', this.orbitCameraDisable, this);
  this.getEntity().on('toggleOrbitCameraController', this.orbitCameraToggle, this);
  this.getEntity().on('setOrbitDistance', this.setOrbitDistance, this);
  this.getEntity().on('setTarget', this.setTarget, this);
  this.getEntity().on('focusOnTarget', this.focusOnTarget, this);
};

OrbitCamera.prototype.shutdown = function() {
  // make sure to clean up any events or other bindings that you have created
  // to avoid memory leaks
  var engine = this.getEngine();
  this.off( 'enable', this.onEnable, this );
  this.off( 'disable', this.onDisable, this );

  if ( window.VAPI.isMobile() ) {
    engine.off( 'touchStart', this.onTouchStart, this );
    engine.off( 'touchMove', this.onTouchMove, this );
    engine.off( 'touchEnd', this.onTouchEnd, this );
  }
  else {
    engine.off( 'mouseUp', this.onMouseUp, this );
    engine.off( 'mouseDown', this.onMouseDown, this );
    engine.off( 'mouseMove', this.onMouseMove, this );
    engine.off( 'mouseScroll', this.onMouseScroll, this );
  }
  
  this.togglePointerLock( false );

  this.getEntity().off('enableOrbitCameraController', this.orbitCameraEnable, this);
  this.getEntity().off('disableOrbitCameraController', this.orbitCameraDisable, this);
  this.getEntity().off('toggleOrbitCameraController', this.orbitCameraToggle, this);
  this.getEntity().off('setOrbitDistance', this.setOrbitDistance, this);
  this.getEntity().off('setTarget', this.setTarget, this);
  this.getEntity().off('focusOnTarget', this.focusOnTarget, this);
};

OrbitCamera.prototype.objectCreated = function() {
  this.quaternionStart.copy( this.getThreeData().quaternion );
  this.eulerStart.setFromQuaternion( this.quaternionStart, 'YXZ' );
};

//Sets the orbit point to that defined by targetObject and targetOffset.
OrbitCamera.prototype.initTarget = function() {
  var that = this;

  // that._tempVector.set(0,0,0);
    
  this.getScene().when('load_hierarchy', function() {
    if ( that.targetObject && that.targetObject !== that.getEntity() ) {
      that.targetObject.threeData.add( that.pivotPoint );
      that.pivotPoint.position.copy( that.targetOffset );
    }
    else {
      that.getThreeScene().add( that.pivotPoint );
      that.pivotPoint.position.copy( that.targetOffset );
    }
    if ( that.isEditor && that.transformControls ) {
      that.getThreeScene().add( that.transformControls );
    }

  }, this );

};

OrbitCamera.prototype.setTargetOffset = function( newOffset, options ) {
  this.targetMoved = true;
  this.pivotPoint.position.copy( newOffset );
  var json = { x: newOffset.x, y: newOffset.y, z: newOffset.z };
  this.setAttribute('targetOffset', json, options );
};

OrbitCamera.prototype.setOrbitDistance = function( newDistance ) {
  this.newOrbitDistance = newDistance;
};

OrbitCamera.prototype.setTarget = function( newObjectId, center, options ) {
  if ( _.isString( newObjectId ) || !newObjectId ) {
    this.setAttribute('targetObject', newObjectId );
  }
  else if ( _.isObject( newObjectId ) && newObjectId.id ) {
    this.setAttribute('targetObject', newObjectId.id );
  }
  if ( center ) {
    this.lookAtCenter( options );
  }
};

OrbitCamera.prototype.lookAtCenter = function( options ) {
  this.targetMoved = true;
  var json = { x: 0, y: 0, z: 0 };
  if ( this.targetObject ) {
    var center = this.targetObject.getCenter();
    this.pivotPoint.position.copy( center );
    json = { x: center.x, y: center.y, z: center.z };
  }
  this.setAttribute('targetOffset', json, options );
};

OrbitCamera.prototype.focusOnTarget = function() {
  //adjust target offset to point to centre of object
  //call setOrbitDistance to cause the target to fill the field of view
  if ( this.targetObject ) {
    
    this.lookAtCenter();
    var newDistance;
    var bb = this.targetObject.getProperty("boundingbox");
    if ( bb ) {
      var dist = new THREE.Vector3();
      dist.set( bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
      var scale;
      if ( this.targetObject.threeData ) {
        this.targetObject.threeData.updateMatrixWorld();
        scale = new THREE.Vector3();
        scale.setFromMatrixScale( this.targetObject.threeData.matrixWorld );
      }
      else {
        scale = this.targetObject.getScale();
      }
      dist.multiply( scale );
      var size = dist.length();
      if ( this.getEntity().getProperty("type") === "PerspectiveCamera") {
        newDistance = Math.abs( size / (2.0 * Math.tan( this.getEntity().getProperty("fov") * Math.PI / 360.0 )) );
      }
      else {
        newDistance = 0.5 * (this.getEntity().getProperty("near") + this.getEntity().getProperty("far"));
      }
      
      newDistance = Math.max( Math.min( newDistance, this.orbitDistanceMax ), this.orbitDistanceMin );
    }
    else {
      this._tempVector.subVectors( this.getEntity().getPosition(), this.targetObject.getProperty("position") );
      newDistance = Math.max( Math.min( this._tempVector.length(), this.orbitDistanceMax ), this.orbitDistanceMin );
    }
    this.setOrbitDistance( newDistance );
  }
};


/**
 * Called per VeroldEngine update (per frame)
 * @param  {float} delta The number of seconds since the last call to `update`
 */
OrbitCamera.prototype.preUpdate = function( delta ) {

  if (this.hasThreeData() && this.isEnabled() ) {

    //Check WASD state and move camera appropriately
    //Also check for modifier keys like ctrl and cmd. If these are pressed,
    //don't move the camera.
    var input = this.getInput();
    var modKey = input.keyDown("ctrl") || input.keyDown("cmd");
    var forwardKey = input.keyDown("upArrow") || input.keyDown("W");
    var backwardKey = input.keyDown("downArrow") || input.keyDown("S");
    var leftKey = input.keyDown("leftArrow") || input.keyDown("A");
    var rightKey = input.keyDown("rightArrow") || input.keyDown("D");

    if ( !modKey && ( forwardKey || backwardKey || leftKey || rightKey ) ) {

      if ( this.enableZoom ) {
        if ( forwardKey ) {
          this.zoomDelta = -delta;
        }
        else if ( backwardKey ) {
          this.zoomDelta = delta;
        }
        // this.linearMovementDeltaLength = this.linearMovementDelta.length();
      }
      if ( this.enablePan ) {
        if ( rightKey ) {
          this.linearMovementDelta.x = -delta;
        }
        else if ( leftKey ) {
          this.linearMovementDelta.x = delta;
        }
        // this.linearMovementDeltaLength = this.linearMovementDelta.length();
      }
    }
    this.updateCamera( delta );

  }
};

OrbitCamera.prototype.postUpdate = function() {
  this.hasChanged = false;
};

OrbitCamera.prototype.updateCamera = function( delta ) {

  var input = this.getInput();
  
  //Handle speed modifier keys
  var speedMod = 1.0;
  if ( input.keyDown( "shift" ) ) {
    speedMod = 5.0;
  }
  // else if ( this.getInput().keyDown( "ctrl" ) ) {
  //   speedMod = 0.25;
  // }

  //If there is any user control, reset the ellapsed time.
  if ( this.isMouseDragging || this.zoomDelta ) {
    this.ellapsedTimeSinceInput = 0.0;
  }
  else {
    this.ellapsedTimeSinceInput += delta;
  }
  
  this.orbitMovement.copy( this.currentMousePosition );
  this.orbitMovement.sub( this.moveStart );
  this.orbitMovement.multiplyScalar( 6.0 * speedMod * this.lookSpeed );
  
  var threeData = this.getThreeData();
  var damping = Math.max( 0.0, Math.min( delta * 33.3 * this.inertialDamping, 1.0) );
  var oneMinusDamping = 1.0 - damping;
  var interpDistance = 0.0;
  
  //Handle inverting the controls
  if ( this.invertX ) {
    this.orbitMovement.x *= -1.0;
    this.linearMovementDelta.x *= -1.0;
  }
  if ( this.invertY ) {
    this.orbitMovement.y *= -1.0;
    this.linearMovementDelta.y *= -1.0;
  }
  if ( this.invertZoom ) {
    this.zoomDelta *= -1.0;
  }

  //Look at current angular movement since the start of control and clamp the min/max pitch.
  this.tempEuler.copy( this.eulerStart );
  this.tempEuler.x -= this.orbitMovement.y;
  this.tempEuler.y -= this.orbitMovement.x;
  if ( this.tempEuler.x > this.pitchAngleBoundsRadians.max ) {
    this.tempEuler.x = this.pitchAngleBoundsRadians.max;
  }
  else if ( this.tempEuler.x < this.pitchAngleBoundsRadians.min ) {
    this.tempEuler.x = this.pitchAngleBoundsRadians.min;
  }

  //Handle automatic orbiting when there has been to user input for a given amount of time.
  if ( this.autoOrbit && !this.isEditor && this.ellapsedTimeSinceInput > this.autoOrbitDelay ) {
    this.tempEuler.y += (this.autoOrbitSpeed * 0.1 * (this.ellapsedTimeSinceInput - this.autoOrbitDelay)) % (2.0 * Math.PI);
    this.autoOrbitOn = true;
  }
  
  // Handle panning of the camera
  this.linearMovementDelta.multiplyScalar( speedMod * this.movementSpeed );
  this.currentMoveSpeed.x = oneMinusDamping * this.currentMoveSpeed.x + damping * this.linearMovementDelta.x;
  this.currentMoveSpeed.y = oneMinusDamping * this.currentMoveSpeed.y + damping * this.linearMovementDelta.y;
  if ( Math.abs( this.currentMoveSpeed.y ) < 0.0001 && Math.abs( this.currentMoveSpeed.x ) < 0.0001 ) {
    this.currentMoveSpeed.set( 0, 0 );
  }
  
  if ( this.currentMoveSpeed.x || this.currentMoveSpeed.y ) {
    //If there is panning movement, shift the location of the pivot point.
    this._tempVector.set( -this.currentMoveSpeed.x, this.currentMoveSpeed.y, 0.0 );
    // this._tempVector.x *= -1.0;
    this._tempVector.applyQuaternion( threeData.quaternion );
    this._tempMatrix4.getInverse( this.pivotPoint.matrixWorld );
    this._tempVector4.set( this._tempVector.x, this._tempVector.y, this._tempVector.z, 0.0 );
    this._tempVector4.applyMatrix4( this._tempMatrix4 );
    
    this._tempVector.set( this._tempVector4.x, this._tempVector4.y, this._tempVector4.z );
    
    this.pivotPoint.position.add( this._tempVector );
    //Get the world-space position of the pivot point.
    this.pivotPoint.getWorldPosition( this._pivotWorldPos );
  }
  else {
    //Otherwise, just update the world-space position of the pivot point.
    this._pivotWorldPos.setFromMatrixPosition( this.pivotPoint.matrixWorld );
  }

  //Handle zoom
  //Calculate the distance to orbit at.
  this._tempVector.subVectors( this._pivotWorldPos, threeData.position );
  var currentDistance = this._tempVector.length();
  var targetDistance;
  //If the user is actively zooming or if no new target distance is set and the inertia of the camera is still moving it.
  if ( this.zoomDelta || !this.newOrbitDistance ) {
    this.newOrbitDistance = 0.0;
    this.currentZoomSpeed = oneMinusDamping * this.currentZoomSpeed + damping * speedMod * 0.1 * this.movementSpeed * this.zoomDelta;
    if ( Math.abs( this.currentZoomSpeed ) < 0.0001 ) {
      this.currentZoomSpeed = 0.0;
    }
    var newDistance = currentDistance + this.currentZoomSpeed * this.currentOrbitDistance;
    targetDistance = Math.min( this.orbitDistanceMax, Math.max( this.orbitDistanceMin, newDistance ));
    interpDistance = (targetDistance - currentDistance);
    this.currentOrbitDistance = targetDistance;
  }
  //If we still have a new orbit distance defined, we'll try to move to that.
  else {
    targetDistance = Math.min( this.orbitDistanceMax, Math.max( this.orbitDistanceMin, this.newOrbitDistance ));
    if ( this.interpolation ) {
      interpDistance = (targetDistance - currentDistance);
      this.currentOrbitDistance = interpDistance * 10.0 * this.interpSpeed * delta + currentDistance;
    }
    else {
      this.currentOrbitDistance = targetDistance;
    }
    if ( Math.abs( this.currentOrbitDistance - this.newOrbitDistance ) < 0.0001 ) {
      this.newOrbitDistance = 0.0;
    }
  }
  
  //If the camera is being controlled, use the current x,y rotation speed
  //to determine the new quaternion for the camera
  if ( this.isMouseDragging || this.zoomDelta || !this.targetMoved || this.autoOrbitOn ) {
    this.targetMoved = false;
    this.tempQuaternion.setFromEuler( this.tempEuler );
    threeData.quaternion.slerp( this.tempQuaternion, this.inertialDamping );
    threeData.position.set( 0, 0, this.currentOrbitDistance );
    threeData.position.applyQuaternion( threeData.quaternion );
    threeData.position.add( this._pivotWorldPos );
    threeData.lookAt( this._pivotWorldPos );
  }
  else {
    
    // //If the camera isn't being controlled by the user, continue interpolating to the desired position/orientation
    if ( this.interpolation ) {
      // lerp the current orientation towards the assigned pivot.
      this.tempCamera.position.copy( threeData.position );
      this.tempCamera.lookAt( this._pivotWorldPos );
      
      threeData.quaternion.slerp( this.tempCamera.quaternion, 0.1 * this.interpSpeed );

      //Set the camera's position using the orientation and orbit distance
      if ( interpDistance ) {
        this._tempVector.set( 0, 0, 1 );
        // this._tempVector.set( 0, 0, this.currentOrbitDistance );
        this._tempVector.applyQuaternion( this.tempCamera.quaternion );
        this._tempVector.multiplyScalar( interpDistance * 10.0 * this.interpSpeed * delta );

        threeData.position.add( this._tempVector );
      }
    }
    else {
      threeData.lookAt( this._pivotWorldPos );
      threeData.position.set( 0, 0, this.currentOrbitDistance );
      threeData.position.applyQuaternion( threeData.quaternion );
      threeData.position.add( this._pivotWorldPos );
    }
  }

  this.getEngine().needsRender = true;
  this.hasChanged = true;

  this.orbitMovement.set( 0.0, 0.0 );
  this.linearMovementDelta.set( 0.0, 0.0, 0.0 );
  this.zoomDelta = 0.0;

};


OrbitCamera.prototype.orbitCameraEnable = function( blendTime ) {
  this.enable();
};

OrbitCamera.prototype.orbitCameraDisable = function( ) {
  this.disable();
};

OrbitCamera.prototype.orbitCameraToggle = function( ) {
  if ( this.isEnabled() ) {
    this.disable();
  }
  else {
    this.enable();
  }
  if ( this.usePointerLock && !this.isEnabled() ) {
    document.exitPointerLock();
  }
};

OrbitCamera.prototype.getEulerAngles = function( outEuler ) {
  var returnVector = outEuler;
  if ( !outEuler ) {
    returnVector = new THREE.Euler();
  }
  returnVector.setFromQuaternion( this.getThreeData().quaternion, 'YXZ' );

  return returnVector;
};

OrbitCamera.prototype.setEulerAngles = function( euler ) {
  this.getThreeData().quaternion.setFromEuler( euler );
};

OrbitCamera.prototype.togglePointerLock = function( on ) {
  this.usePointerLock = on;

  if ( this.usePointerLock ) {
    this.getThreeRenderer().domElement.addEventListener( 'mousedown', this.onMouseDown_PointerLock );
   }
  else {
    this.getThreeRenderer().domElement.removeEventListener( 'mousedown', this.onMouseDown_PointerLock );
  }
};

OrbitCamera.prototype.onMouseDown = function( event ) {
  if ( this.isEnabled() ) {
    var input = this.getInput();
    // var rightButton = input.mouseButtonDown("right");
    // var leftButton = input.mouseButtonDown("left");
    var panButton = input.mouseButtonDown(this.mouseControls.panControl);
    var orbitButton = input.mouseButtonDown(this.mouseControls.orbitControl);
    var zoomButton = input.mouseButtonDown(this.mouseControls.zoomControl);
    this.pan = false;
    this.look = false;
    this.zoom = false;
    if ( ( panButton ) && this.enablePan ) {
      this.pan = true;
    }
    else if ( orbitButton ) {
      this.look = true;
    }
    else if ( zoomButton ) {
      this.zoom = true;
    }

    this.moveStart.x = event.scenePercentX;
    this.moveStart.y = event.scenePercentY;
    this.currentMousePosition.copy( this.moveStart );
    // this.positionStart.copy( this.getThreeData().position );
    this.quaternionStart.copy( this.getThreeData().quaternion );
    this.eulerStart.setFromQuaternion( this.quaternionStart, 'YXZ' );
  }
};

OrbitCamera.prototype.onMouseUp = function( event ) {
  if ( this.isEnabled() ) {
    var input = this.getInput();
    // var rightButton = input.mouseButtonDown("right");
    // var leftButton = input.mouseButtonDown("left");
    var panButton = input.mouseButtonDown(this.mouseControls.panControl);
    var orbitButton = input.mouseButtonDown(this.mouseControls.orbitControl);
    var zoomButton = input.mouseButtonDown(this.mouseControls.zoomControl);
    this.pan = false;
    this.look = false;
    this.zoom = false;
    
    if ( ( panButton ) && this.enablePan ) {
      this.pan = true;
    }
    else if ( orbitButton ) {
      this.look = true;
    }
    else if (zoomButton) {
      this.zoom = true;
    }
    else {
      this.isMouseDragging = false;
    }
    // this.moveStart.x = event.scenePercentX;
    // this.moveStart.y = event.scenePercentY;
    // this.positionStart.set( 0.0, 0.0, 0.0 );
    // this.quaternionStart.set( 0.0, 0.0, 0.0, 1.0 );
    // console.log("Mode is " + this.mode );
  }
};

OrbitCamera.prototype.onMouseDown_PointerLock = function( event ) {
  if ( this.isEnabled() && event.button === 0 || event.button === 2 ) {
    this.getThreeRenderer().domElement.requestPointerLock();

    this.getThreeRenderer().domElement.addEventListener( 'mouseup', this.onMouseUp_PointerLock );
  }
};

OrbitCamera.prototype.onMouseUp_PointerLock = function( event ) {
  if ( this.veroldEntity ) {
    if ( event.button === 2 && this.getInput().mouseButtonUp( "left" ) || event.button === 0 && this.getInput().mouseButtonUp( "right" ) ) {
      this.getThreeRenderer().domElement.removeEventListener( 'mouseup', this.onMouseUp_PointerLock );
      document.exitPointerLock();
    }
  }
};

OrbitCamera.prototype.onMouseMove = function( event ) {
  if ( this.isEnabled() ) {
    var input = this.getInput();
    // var rightButton = input.mouseButtonDown("right");
    // var leftButton = input.mouseButtonDown("left");
    var panButton = input.mouseButtonDown(this.mouseControls.panControl);
    var orbitButton = input.mouseButtonDown(this.mouseControls.orbitControl);
    var zoomButton = input.mouseButtonDown(this.mouseControls.zoomControl);

    if ( ( panButton ) && this.enablePan ) {
      this.isMouseDragging = true;
      this.linearMovementDelta.x = event.scenePercentDeltaX;
      this.linearMovementDelta.y = event.scenePercentDeltaY;
    }
    else if ( orbitButton ) {
      this.isMouseDragging = true;
      this.currentMousePosition.x = event.scenePercentX;
      this.currentMousePosition.y = event.scenePercentY;
    }
    else if ( zoomButton) {
      this.isMouseDragging = true;
      this.zoomDelta = -event.scenePercentDeltaY * 10;
    }
    // this.eulerEllapsed.add( event.scenePercentDeltaX, event.scenePercentDeltaY );
  }
};

OrbitCamera.prototype.onMouseScroll = function( delta ) {
  if ( this.isEnabled() && _.isNumber( delta ) && this.enableZoom ) {
    this.zoomDelta = -delta * 0.1;
  }
};

OrbitCamera.prototype.onTouchStart = function( event ) {

  if ( this.isEnabled() ) {

    var touches = event.touches;
    if ( !touches ) return;

    switch ( touches.length ) {

    case 1: // one-fingered touch: rotate
      this.touchLast.set( touches[ 0 ].scenePercentX, touches[ 0 ].scenePercentY );

      this.look = true;
      this.pan = false;
      this.zoom = false;
      
      break;

    case 2: // two-fingered touch: dolly
      
      this.look = false;
      this.pan = false;
      this.zoom = false;
      if ( this.enableZoom ) {
        this.zoom = true;
        var dx = touches[ 0 ].scenePercentX - touches[ 1 ].scenePercentX;
        var dy = touches[ 0 ].scenePercentY - touches[ 1 ].scenePercentY;
        var distance = Math.sqrt( dx * dx + dy * dy );

        this.touchLastPinchDist = distance;
        // this.touchYStart = touches[ 0 ].scenePercentY;
      }
      this.touchLast.set( touches[ 0 ].scenePercentX, touches[ 0 ].scenePercentY );
      break;

    case 3: // three-fingered touch: pan
      this.touchLast.set( touches[ 0 ].scenePercentX, touches[ 0 ].scenePercentY );
      this.look = false;
      this.pan = false;
      if ( this.enablePan ) {
        this.pan = true;
      }
      this.zoom = false;
      break;

    default:
      this.touchLast.set( touches[ 0 ].scenePercentX, touches[ 0 ].scenePercentY );
      this.touchLastPinchDist = -1;
    }

    this.moveStart.x = touches[ 0 ].scenePercentX;
    this.moveStart.y = touches[ 0 ].scenePercentY;
    this.currentMousePosition.copy( this.moveStart );
    // this.positionStart.copy( this.getThreeData().position );
    this.quaternionStart.copy( this.getThreeData().quaternion );
    this.eulerStart.setFromQuaternion( this.quaternionStart, 'YXZ' );

  }
};

OrbitCamera.prototype.onTouchMove = function( event ) {

  if ( this.isEnabled() ) {
    // this.touchInProgress = true;
    var touches = event.touches;
    if ( !touches ) return;
    // var speedMod = 0.3;
    var dx, dy;
    switch ( touches.length ) {

    case 1: // one-fingered touch: rotate
      this.look = true;
      this.pan = false;
      this.zoom = false;

      this.touchLast.x = touches[ 0 ].scenePercentX;
      this.touchLast.y = touches[ 0 ].scenePercentY;
      this.isMouseDragging = true;
      // this.ellapsedTimeSinceInput = 0;

      this.currentMousePosition.x = touches[ 0 ].scenePercentX;
      this.currentMousePosition.y = touches[ 0 ].scenePercentY;

      break;

    case 2: // two-fingered touch: dolly

      this.look = false;
      this.pan = false;
      this.zoom = false;
      if ( this.enableZoom ) {
        // this.isMouseDragging = true;
        this.zoom = true;
        dx = touches[ 0 ].scenePercentX - touches[ 1 ].scenePercentX;
        dy = touches[ 0 ].scenePercentY - touches[ 1 ].scenePercentY;
        var distance = Math.sqrt( dx * dx + dy * dy );

        var pinchChange = this.touchLastPinchDist - distance;
        var scrollChange = this.touchLast.y - touches[ 0 ].scenePercentY;
        // var scrollChange = 0;
        if ( Math.abs( pinchChange ) > Math.abs( scrollChange ) ) {
          this.zoomDelta = 20.0 * pinchChange;
        }
        else {
          this.zoomDelta = 20.0 * scrollChange;
        }
      
        this.touchLastPinchDist = distance;
      }
      this.touchLast.x = touches[ 0 ].scenePercentX;
      this.touchLast.y = touches[ 0 ].scenePercentY;

      break;

    case 3: // three-fingered touch: pan
      this.look = false;
      this.pan = false;
      this.zoom = false;
      if ( this.enablePan ) {
        this.isMouseDragging = true;
        this.pan = true;
        dx = touches[ 0 ].scenePercentX - this.touchLast.x;
        dy = touches[ 0 ].scenePercentY - this.touchLast.y;

        this.linearMovementDelta.x = dx;
        this.linearMovementDelta.y = dy;
      }

      this.touchLast.x = touches[ 0 ].scenePercentX;
      this.touchLast.y = touches[ 0 ].scenePercentY;

      break;
    }

  }
};

OrbitCamera.prototype.onTouchEnd = function( event ) {

  if ( this.isEnabled() ) {
    this.touchLast.set( -1.0, -1.0 );
    this.touchLastPinchDist = -1;
    var touches = event.touches;
    
    switch ( touches.length ) {

    case 0:
      this.isMouseDragging = false;
      this.look = false;
      this.pan = false;
      this.zoom = false;
      break;
    case 1: // one-fingered touch: rotate
      this.look = true;
      this.pan = false;
      this.zoom = false;
      
      this.touchLast.set( touches[ 0 ].scenePercentX, touches[ 0 ].scenePercentY );
      this.moveStart.x = touches[ 0 ].scenePercentX;
      this.moveStart.y = touches[ 0 ].scenePercentY;
      this.currentMousePosition.copy( this.moveStart );
      // this.positionStart.copy( this.getThreeData().position );
      this.quaternionStart.copy( this.getThreeData().quaternion );
      this.eulerStart.setFromQuaternion( this.quaternionStart, 'YXZ' );
      break;

    case 2: // two-fingered touch: dolly

      this.look = false;
      this.pan = false;
      this.zoom = false;
      if ( this.enableZoom ) {
        this.zoom = true;
        var dx = touches[ 0 ].scenePercentX - touches[ 1 ].scenePercentX;
        var dy = touches[ 0 ].scenePercentY - touches[ 1 ].scenePercentY;
        var distance = Math.sqrt( dx * dx + dy * dy );

        this.touchLastPinchDist = distance;
      }
      // this.touchYStart = touches[ 0 ].scenePercentY;
      this.touchLast.set( touches[ 0 ].scenePercentX, touches[ 0 ].scenePercentY );
      break;

    case 3: // three-fingered touch: pan
      this.look = false;
      this.pan = false;
      if ( this.enablePan ) {
        this.pan = true;
      }
      this.zoom = false;

      this.touchLast.set( touches[ 0 ].scenePercentX, touches[ 0 ].scenePercentY );
      break;

    default:

    }
  }
};

return OrbitCamera;
});