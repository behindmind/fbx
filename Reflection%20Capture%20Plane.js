(function(require, _, VAPI, THREE, console, Math) {
// var reflectionActorNumber = 0;
/**
 * @author Mike Bond
 * A component to make rendering a planar reflection easier.
 * Based largely on Slayvin's (http://slayvin.net) THREE.Mirror class
 *
 * @class ReflectionCapture
 */
function ReflectionCapture() {
  this.framesElapsed = 0;
  this.perspectiveCamera = null;
  this.orthoCamera = null;
  this.reflectionNormal = new THREE.Vector3( 0, 1, 0 );
  this.reflectionPlane = new THREE.Plane();
  this.clipPlane = new THREE.Vector4();

  this.reflectionPosition = new THREE.Vector3();
  this.cameraWorldPosition = new THREE.Vector3();
  this.rotationMatrix = new THREE.Matrix4();
  this.lookAtPosition = new THREE.Vector3(0, 0, -1);
  this.up = new THREE.Vector3(0, 1, 0);

  // reflectionActorNumber++;
  // this.reflectionActorId = reflectionActorNumber;
}

ReflectionCapture.prototype = new VAPI.VeroldComponent();

ReflectionCapture.prototype.init = function() {
  // this.getEngine().on( "resize", this.resizeCamera, this );
};

ReflectionCapture.prototype.editorInit = function() {
  this.veroldEntity.getParentAsset().when('load', this.sceneLoadedEditor, this );
  
  this.getEngine().on( "preRenderView", this.preRenderView, this );
  this.inEditor = true;
};

ReflectionCapture.prototype.shutdown = function() {
  // this.getEngine().off( "resize", this.resizeCamera, this );
};

ReflectionCapture.prototype.editorShutdown = function() {

  this.getEngine().off( "preRenderView", this.preRenderView, this );
  var renderer = this.getThreeRenderer();
  if ( renderer ) {
    if ( this.reflectionTexture && this.reflectionTexture.threeData ) {
      this.getThreeRenderer().setRenderTarget( this.reflectionTexture.threeData );
      this.getThreeRenderer().clear();
    }
    else if ( this.tempRenderTexture && this.tempRenderTexture.threeData ) {
      this.getThreeRenderer().setRenderTarget( this.tempRenderTexture.threeData );
      this.getThreeRenderer().clear();
    }
  }
  if ( this.tempRenderTexture ) {
    this.tempRenderTexture.destroy();
  }
  if ( this.reflectionMaterial ) {
    this.reflectionMaterial.destroy();
  }
  this.shutdown();
};

/**
 * Called once the data is available is available
 */
ReflectionCapture.prototype.sceneLoadedEditor = function() {
  var that = this;
  that.initEditorObject();
  window.verold.veroldEvents.trigger( 'studioApp::getCurrentCamera', function( camera ) {
    console.log("Reflection Actor - Assigning editor camera to be used. ", camera );
    that.editorCamera = camera;
    //that.sceneCamera = camera;
    that.initCameras();
    // that.getEngine().globalEvents.trigger('renderer::registerPreRenderFn', "Reflection_" + that.reflectionActorId, that.preRenderPass, that );
    // that.objectReady = true;
    // if ( that.cameraReady ) {
    //   that.initialized = true;
    // }
    // that.getEngine().on( "preRender", that.preRender, that );
    // that.getEngine().on( "resize", that.resizeCamera, that );
  });
};

ReflectionCapture.prototype.objectCreated = function() {
  var that = this;
  that.initCameras();
  //that.objectReady = true;
  // this.getEngine().globalEvents.trigger('renderer::registerPreRenderFn', "Reflection_" + that.reflectionActorId, this.preRenderPass, this );
  // if ( that.cameraReady ) {
  //   that.initialized = true;
  // }
};

ReflectionCapture.prototype.initEditorObject = function() {
  var that = this;
  this.planeGeometry = new THREE.PlaneBufferGeometry( 0.5, 0.5, 1, 1 );
  //this.planeGeometry = new THREE.BoxGeometry( 0.5, 0.5, 0.5, 1, 1, 1 );
  this.planeGeometry.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );
  this.planeGeometry.computeTangents();
  this.planeGeometry.computeVertexNormals();
//   this.planeGeometry.computeFaceNormals();
  this.planeGeometry.dynamic = true;
  this.planeMesh = new THREE.Mesh( this.planeGeometry );
  this.planeMesh.castShadow = false;
  this.planeMesh.receiveShadow = false;
  this.planeMesh.name = "ReflectionCapturePlane";
  this.getThreeObject().add( this.planeMesh );
  this.getEngine().globalEvents.trigger( "studioApp::registerPickingObject", this.getEntity(), this.planeMesh );

  if ( !this.reflectionTexture ) {
    this.createTempRenderTexture();
  }

  this.getAssetRegistry().createAsset( { type: "material", id: "reflection_material", payload: {
    materialType: "Simple",
    diffuseColor: 0x000000,
    gloss: 1.0,
    //diffuseTexture: that.reflectionTexture.id,
    // environmentMappingType : 2,
    environmentTexture2D: that.reflectionTexture ? that.reflectionTexture.id : that.tempRenderTexture.id,
    reflectionBias: 1
  }}, {
    success: function( mat ) {
      mat.load();
      mat.enableFeature( "Reflections", undefined, true );
      mat.setProperty("environmentMappingType", 2);

      that.reflectionMaterial = mat;
      that.planeMesh.material = mat.threeData.static;
    }
  });
};

ReflectionCapture.prototype.createTempRenderTexture = function( changes ) {
  var that = this;
  this.getAssetRegistry().createAsset( { type: "renderTexture2D", id: "render_tex_reflection", payload: {
      width: 512,
      height: 512,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    }}, {
    success: function( tex ) {
      that.tempRenderTexture = tex;
      tex.load();
    }
  });
};

// ReflectionCapture.prototype.onEnable = function() {
// };

// ReflectionCapture.prototype.onEnable = function() {
// };

ReflectionCapture.prototype.attributesChanged = function( changes ) {
  if ( changes.reflectionTexture !== undefined ) {
    if ( this.reflectionTexture ) {
      var that = this;
      this.reflectionTexture.once( 'load', function() {
        if ( that.tempRenderTexture ) {
          that.tempRenderTexture.unload();
        }
        that.planeMesh.material.uniforms.environmentTexture2D.value = that.reflectionTexture.threeData;
      } );
      this.reflectionTexture.load();
    }
    else {
      this.createTempRenderTexture();
      this.planeMesh.material.uniforms.environmentTexture2D.value = this.tempRenderTexture.threeData;
    }
  }
  // if ( changes.sceneCamera !== undefined ) {
  //   if ( this.inEditor ) {
  //     this.sceneCamera = this.editorCamera;
  //   }
  // }
};

/**
 * Called immediately after after component creation
 */
ReflectionCapture.prototype.initCameras = function() {
  if ( this.reflectionTexture ) {
    this.reflectionTexture.load();
  }

  this.perspectiveCamera = new THREE.PerspectiveCamera();
  this.orthoCamera = new THREE.OrthographicCamera();
};

ReflectionCapture.prototype.updateReflection = function( scene, camera ) {
  if ( this.isEnabled() ) {
    var sign = function( num ) {
      return num < 0 ? -1 : 1;
    }
    this.veroldEntity.threeData.updateMatrixWorld();
    // this.sceneCamera.threeData.updateMatrixWorld();

    this.reflectionPosition.setFromMatrixPosition( this.veroldEntity.threeData.matrixWorld );
    this.cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

    this.rotationMatrix.extractRotation(  this.veroldEntity.threeData.matrixWorld );

    this.reflectionNormal.set( 0, 1, 0 );
    this.reflectionNormal.applyMatrix4( this.rotationMatrix );

    var view = this.reflectionPosition.clone().sub( this.cameraWorldPosition );
    var reflectView = view.reflect( this.reflectionNormal ).negate();
    reflectView.add( this.reflectionPosition );

    this.rotationMatrix.extractRotation( camera.matrixWorld );

    this.lookAtPosition.set(0, 0, -1);
    this.lookAtPosition.applyMatrix4( this.rotationMatrix );
    this.lookAtPosition.add( this.cameraWorldPosition );

    var target = this.reflectionPosition.clone().sub( this.lookAtPosition );
    var reflectTarget = target.reflect( this.reflectionNormal ).negate();
    reflectTarget.add( this.reflectionPosition );

    this.up.set( 0, -1, 0 );
    this.up.applyMatrix4( this.rotationMatrix );
    var reflectUp = this.up.reflect( this.reflectionNormal ).negate();

    if ( camera instanceof THREE.PerspectiveCamera && this.perspectiveCamera ) {
      this.perspectiveCamera.aspect = camera.aspect;
      this.perspectiveCamera.fov = camera.fov;
      this.reflectionCamera = this.perspectiveCamera;
    }
    else if ( this.orthoCamera ) {
      this.orthoCamera.left = camera.left;
      this.orthoCamera.right = camera.right;
      this.orthoCamera.top = camera.top;
      this.orthoCamera.bottom = camera.bottom;
      this.reflectionCamera = this.orthoCamera;
    }
    else {
      return;
    }
    this.reflectionCamera.position.copy( reflectView );
    this.reflectionCamera.up = reflectUp;
    this.reflectionCamera.lookAt( reflectTarget );


    this.reflectionCamera.updateProjectionMatrix();
    this.reflectionCamera.updateMatrixWorld();
    this.reflectionCamera.matrixWorldInverse.getInverse( this.reflectionCamera.matrixWorld );

    // Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
    // Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
    this.reflectionPlane.setFromNormalAndCoplanarPoint( this.reflectionNormal, this.reflectionPosition );
    this.reflectionPlane.applyMatrix4( this.reflectionCamera.matrixWorldInverse );

    this.clipPlane.set( this.reflectionPlane.normal.x,
                       this.reflectionPlane.normal.y,
                       this.reflectionPlane.normal.z,
                       this.reflectionPlane.constant );

    var q = new THREE.Vector4();
    var projectionMatrix = this.reflectionCamera.projectionMatrix;

    q.x = ( sign(this.clipPlane.x) + projectionMatrix.elements[8] ) / projectionMatrix.elements[0];
    q.y = ( sign(this.clipPlane.y) + projectionMatrix.elements[9] ) / projectionMatrix.elements[5];
    q.z = - 1.0;
    q.w = ( 1.0 + projectionMatrix.elements[10] ) / projectionMatrix.elements[14];

    // Calculate the scaled plane vector
    var c = new THREE.Vector4();
    c = this.clipPlane.multiplyScalar( 2.0 / this.clipPlane.dot(q) );

    // Replacing the third row of the projection matrix
    projectionMatrix.elements[2] = c.x;
    projectionMatrix.elements[6] = c.y;
    projectionMatrix.elements[10] = c.z + 1.0 - this.clipBias;
    projectionMatrix.elements[14] = c.w;
  }
};

ReflectionCapture.prototype.preRenderView = function( scene, camera, options ) {
  if ( this.isEnabled() ) {
    if ( this.framesElapsed >= this.updateFrameInterval ) {
      this.updateReflection( scene, camera );
      //render reflection
      // Render the mirrored view of the current scene into the target texture
      //var scene = this.veroldEntity.getParentAsset();
      if ( scene && camera ) {
        //this.getThreeRenderer().setRenderTarget( this.reflectionTexture.threeData );
        var viewport = this.getThreeRenderer().getViewport();
        if ( this.reflectionTexture && this.reflectionTexture.threeData ) {
          this.getRenderer().renderView( scene, this.reflectionCamera, {
            viewPort: { x:0,y:0, width: this.reflectionTexture.getWidth() , height: this.reflectionTexture.getHeight()  },
            renderTarget: this.reflectionTexture.threeData,
            clearColor: true,
            clearDepth: true,
            // enablePostEffects: false,
            enableShadows: false,
            enablePreRenderFunctions: false });
        }
        else if ( this.tempRenderTexture ) {
          this.getRenderer().renderView( scene, this.reflectionCamera, {
            viewPort: { x:0,y:0, width: this.tempRenderTexture.getWidth() , height: this.tempRenderTexture.getHeight()  },
            renderTarget: this.tempRenderTexture.threeData,
            clearColor: true,
            clearDepth: true,
            // enablePostEffects: false,
            enableShadows: false,
            enablePreRenderFunctions: false });
        }
      }
      this.framesElapsed = 0;
    }
    else {
      this.framesElapsed++;
    }
  }
};

return ReflectionCapture;
});