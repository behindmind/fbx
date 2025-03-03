(function(require, _, VAPI, THREE, console, Math) {
var _ = require( 'underscore' );

/**
 * A custom component class.
 *
 * @class Curve
 */
function Curve() {
  this.isEditor = false;
  this.controlPoints = undefined;
  this.prevControlPointsLength = 0;
  this.closed = false;
  
  //Editor
  this.cameraPosition = new THREE.Vector3();
  this.tempPosition = new THREE.Vector3();
  this.tempVector = new THREE.Vector3();
  this.tempVector4 = new THREE.Vector4();
  this.tempMatrix = new THREE.Matrix4();
  this.editorCurveColour = 0x222222;
  this.editorCurveSelectedColour = 0x0d56a6;
  this.orientationHelpers = [];
  this.canTryUpdateAgain = true;

  this.curveMaterial = undefined;
  this.curveGeometry = undefined;
  this.curveMesh = undefined;
  this.curveTesselation = 200;
  this.selected = false;
  this.updateStarted = false;

}

Curve.prototype = new VAPI.VeroldComponent();

Curve.prototype.init = function() {
  this.initCurve();
};

Curve.prototype.shutdown = function( ) {
};

Curve.prototype.onSelected = function( ) {
  this.selected = true;
  if ( this.curveMaterial ) {
    this.curveMaterial.color.setHex( this.editorCurveSelectedColour );
  }
  function show( obj ) {
    obj.visible = true;
  }
  for ( var i = 0; i < this.orientationHelpers.length; i++ ) {
    this.orientationHelpers[i].traverse( show );
  }
};

Curve.prototype.onUnselected = function( ) {
  this.selected = false;
  if ( this.curveMaterial ) {
    this.curveMaterial.color.setHex( this.editorCurveColour );
  }
  function hide( obj ) {
    obj.visible = false;
  }
  for ( var i = 0; i < this.orientationHelpers.length; i++ ) {
    this.orientationHelpers[i].traverse( hide );
  }
};

Curve.prototype.initCurve = function() {
  if ( !this.updateStarted && this.controlPoints && this.controlPoints.length ) {
    
    this.updateStarted = true;

    this.cleanupCurveMesh();
    this.cleanupOrientationHelpers();

    this.prevControlPointsLength = this.controlPoints.length;

    this.createCurve();
    
  }
};

Curve.prototype.isCurveInit = function() {
  return this.curve.points.length > 0;
};

Curve.prototype.createCurve = function() {
  for ( var i in this.controlPoints ) {
    if ( this.controlPoints[ i ] ) {
      this.controlPoints[ i ].entityModel.off('change:payload.position', this.updateCurve, this );
    }
  }

  if ( this.closed ) {
    this.curve = new THREE.ClosedSplineCurve3();
  }
  else {
    this.curve = new THREE.SplineCurve3();
  }

  // this.curve.points.push( this.getEntity().getPosition() );
  
  var that = this;
  var scene = this.getEntity().getParentAsset();
  scene.once( 'load_hierarchy', function( scene ) {
    scene.threeData.updateMatrixWorld( true );
    _.each( that.controlPoints, function( point ) {
      if ( point ) {
        // this.tempVector.copy( point.threeData.position );
        // this.tempVector.applyMatrix4( point.threeData.matrixWorld );
        // this.tempVector.setFromMatrixPosition( point.threeData.matrixWorld );
        var newPos = new THREE.Vector3();
        // newPos.copy( this.tempVector );
        this.curve.points.push( newPos );
        this.tempMatrix.makeRotationFromQuaternion( point.threeData.quaternion );
        var matArray = this.tempMatrix.toArray();
        this.tempVector.set( matArray[0], matArray[1], matArray[2] );
        this.orientationHelpers.push( new THREE.ArrowHelper( this.tempVector, newPos, 1, 0xff0000 ) );
        this.tempVector.set( matArray[4], matArray[5], matArray[6] );
        this.orientationHelpers.push( new THREE.ArrowHelper( this.tempVector, newPos, 1, 0x00ff00 ) );
        this.tempVector.set( matArray[8], matArray[9], matArray[10] );
        this.orientationHelpers.push( new THREE.ArrowHelper( this.tempVector, newPos, 1, 0x0000ff ) );
          
        point.entityModel.on('change:payload.position', that.updateCurve, that );
        point.entityModel.on('change:payload.orientation', that.updateOrientationHelpers, that );
      }
      else {
        this.tempVector.set(0,0,0);
        this.orientationHelpers.push( new THREE.ArrowHelper( this.tempVector, this.tempVector, 1, 0xff0000 ) );
        this.orientationHelpers.push( new THREE.ArrowHelper( this.tempVector, this.tempVector, 1, 0xff0000 ) );
        this.orientationHelpers.push( new THREE.ArrowHelper( this.tempVector, this.tempVector, 1, 0xff0000 ) );
      }
      
    }, that );

    that.updateCurve();

    that.updateStarted = false;
    if ( !this.selected ) {
      this.onUnselected();
    }
    that.trigger('curveInit');
    
  }, this );
  scene.load_hierarchy();
};

Curve.prototype.updateCurve = function() {
  
  var helperIndex = 0;
  var index = 0;
  var that = this;

  _.each( this.controlPoints, function( point ) {
    if ( point ) {
      if ( point.threeData.parent ) {
        point.getPosition( this.tempVector );
        this.tempVector4.set( this.tempVector.x, this.tempVector.y, this.tempVector.z, 1.0 );
        this.tempVector4.applyMatrix4( point.threeData.parent.matrixWorld );
        this.curve.points[ index ].set( this.tempVector4.x, this.tempVector4.y, this.tempVector4.z );
        
        index++;
      }
      else if ( this.canTryUpdateAgain ) {
        this.canTryUpdateAgain = false;
        setTimeout( function() {
          console.log("Trying again");
          that.updateCurve();
        }, 10 );
      }
    }
    
  }, this );
  
  if ( this.isEditor ) {
    this.cleanupCurveMesh();
    this.createCurveMesh();
  }
    
  this.canTryUpdateAgain = true;
};

Curve.prototype.cleanupCurveMaterial = function() {
  if ( this.curveMaterial ) {
    this.curveMaterial.dispose();
    this.curveMaterial = undefined;
  }
};

Curve.prototype.cleanupOrientationHelpers = function() {
  var i = 0;
  for ( i in this.controlPoints ) {
    if ( this.controlPoints[ i ] ) {
      this.controlPoints[ i ].entityModel.off('change:payload.orientation', this.updateOrientationHelpers, this );
    }
  }
  for ( var i in this.orientationHelpers ) {
    this.getThreeScene().remove( this.orientationHelpers[i] );
  }
  this.orientationHelpers = [];
};

Curve.prototype.cleanupCurveMesh = function() {
  
  if ( this.isEditor && this.curveMesh ) {
    this.getEngine().globalEvents.trigger( "studioApp::unregisterPickingObject", this.getEntity(), this.curveMesh );
    this.getThreeScene().remove( this.curveMesh );
    this.curveGeometry.dispose();
    this.curveMesh.material = undefined;
  }
};

Curve.prototype.createCurveMesh = function() {
  if ( !this.curveMaterial ) {
    this.curveMaterial = new THREE.MeshBasicMaterial( { color: this.editorCurveColour, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending } );
  }
  if ( this.curve.points.length ) {
    //this.curveGeometry = new THREE.Geometry();
    this.curveGeometry = new THREE.TubeGeometry( this.curve, this.curveTesselation, 0.05, 8, this.closed );
    //this.curveGeometry.vertices = this.curve.getPoints( this.curveTesselation );
    this.curveMesh = new THREE.Mesh( this.curveGeometry, this.curveMaterial );

    this.getScene().once( 'load_base', function() {
      this.getThreeScene().add( this.curveMesh );
      _.each( this.orientationHelpers, function( helper ) {
        this.getThreeScene().add( helper );
      }, this );
    }, this );

    this.getScene().once( 'load', function() {
      this.getEngine().globalEvents.trigger( "studioApp::registerPickingObject", this.getEntity(), this.curveMesh );
      VAPI.globalEvents.on( "studioApp::toggleEditorVisualization", this.toggleVisualization, this );
    }, this );
    
    this.getScene().load();

    this.updateOrientationHelpers();
  }
};


//Update arrow helpers when a control point's orientation changes
Curve.prototype.updateOrientationHelpers = function( ) {
  for ( var i in this.controlPoints ) {
    if ( this.controlPoints[i] ) {
      var obj = this.controlPoints[i].threeData;

      this.orientationHelpers[ i * 3 ].position.copy( this.curve.points[i] );
      this.orientationHelpers[ i * 3 + 1 ].position.copy( this.curve.points[i] );
      this.orientationHelpers[ i * 3 + 2 ].position.copy( this.curve.points[i] );
      this.tempMatrix.makeRotationFromQuaternion( obj.quaternion );
      var matArray = this.tempMatrix.toArray();
      this.tempVector.set( matArray[0], matArray[1], matArray[2] );
      this.orientationHelpers[ i * 3 ].setDirection( this.tempVector );
      this.tempVector.set( matArray[4], matArray[5], matArray[6] );
      this.orientationHelpers[ i * 3 + 1 ].setDirection( this.tempVector );
      this.tempVector.set( matArray[8], matArray[9], matArray[10] );
      this.orientationHelpers[ i * 3 + 2 ].setDirection( this.tempVector );
    }
  }
};

Curve.prototype.attributesChanged = function( changes ) {
  this.initCurve();
};

Curve.prototype.editorInit = function() {
  this.isEditor = true;
  this.init();

  this.getEngine().on( "update", this.editorUpdate, this );
  this.getEngine().on( "mouseUp", this.onMouseUp, this );
  this.getEntity().on( "editorSelected", this.onSelected, this );
  this.getEntity().on( "editorUnselected", this.onUnselected, this );
  
  var that = this;
  this.getEngine().globalEvents.trigger('studioApp::getCurrentCamera', function( camera ) {
    if ( camera ) {
      camera.once( 'load_base', function() {
        that.editorCamera = camera.threeData;
      }, that );
      camera.load_base();
    }
  });

  this.getEntity().entityModel.on('change:payload.position', that.initCurve, this );
  this.getEntity().entityModel.on('change:payload.orientation', that.initCurve, this );
  this.getEntity().entityModel.on('change:payload.scale', that.initCurve, this );
};

Curve.prototype.editorShutdown = function() {
  this.getEngine().off( "update", this.editorUpdate, this );
  this.getEngine().off( "mouseUp", this.onMouseUp, this );
  this.getEntity().off( "editorSelected", this.onSelected, this );
  this.getEntity().off( "editorUnselected", this.onUnselected, this );
  this.cleanupCurveMesh();
  this.cleanupOrientationHelpers();
  this.cleanupCurveMaterial();
  this.getEntity().entityModel.off('change:payload.position', this.initCurve, this );
  this.getEntity().entityModel.off('change:payload.orientation', this.initCurve, this );
  this.getEntity().entityModel.off('change:payload.scale', this.initCurve, this );
  VAPI.globalEvents.off( "studioApp::toggleEditorVisualization", this.toggleVisualization, this );
};

Curve.prototype.editorUpdate = function( delta ) {
  if ( this.editorCamera ) {
    this.cameraPosition.setFromMatrixPosition( this.editorCamera.matrixWorld );
    var scale = 1.0;
    for ( var i = 0; i < this.orientationHelpers.length; i++ ) {
      this.tempPosition.setFromMatrixPosition( this.orientationHelpers[ i ].matrixWorld );
      scale = this.tempPosition.distanceTo( this.cameraPosition ) / 12;
      this.orientationHelpers[ i ].scale.set( scale, scale, scale );
    }
  }
};

Curve.prototype.toggleVisualization = function() {
  var that = this;
  this.curveMesh.visible = !this.curveMesh.visible;
  
  function toggle( obj ) {
    obj.visible = that.selected && !obj.visible;
  }
  for ( var i = 0; i < this.orientationHelpers.length; i++ ) {
    this.orientationHelpers[i].traverse( toggle );
  }
};


return Curve;});