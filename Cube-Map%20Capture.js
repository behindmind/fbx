(function(require, _, VAPI, THREE, console, Math) {
/**
 * @author Mike Bond
 * A component to make rendering to a cube map easier.
 *
 * @class CubeMapCapture
 */
function CubeMapCapture() {
  this.framesElapsed = 0;

  this.near = 1.0;
  this.far = 12000.0;
  this.updateFrameInterval = 0.0;

  this.cubeMaterial = undefined;
  this.tempRenderTexture = undefined;

  this.cubeMaterialDef = {

    uniforms: { "tCube": { type: "t", value: null },
          "tFlip": { type: "f", value: 1 } },

    vertexShader: [

      "varying vec3 vWorldPosition;",

      THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],

      "void main() {",

      " vec4 worldPosition = vec4( position, 1.0 );",
      " vWorldPosition = worldPosition.xyz;",

      " gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

        THREE.ShaderChunk[ "logdepthbuf_vertex" ],

      "}"

    ].join("\n"),

    fragmentShader: [

      "uniform samplerCube tCube;",
      "uniform float tFlip;",

      "varying vec3 vWorldPosition;",

      THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

      "void main() {",
      // " vec3 poop = normalize(vWorldPosition);",
      " gl_FragColor = textureCube( tCube, vec3( tFlip * vWorldPosition.x, vWorldPosition.yz ) );",

        THREE.ShaderChunk[ "logdepthbuf_fragment" ],

      "}"

    ].join("\n")

  };
}

/*global VAPI*/
CubeMapCapture.prototype = new VAPI.VeroldComponent();

CubeMapCapture.prototype.init = function() {
  
  this.initCameras();
};

CubeMapCapture.prototype.editorInit = function() {
  this.init();
  this.veroldEntity.getParentAsset().once('load', this.initEditorObject, this );
  if ( this.veroldEntity.state_base === "loaded") {
    this.veroldEntity.load();
  }
  // this.getEngine().on( "preRenderView", this.preRenderView, this );
  this.getEngine().on( "preRender", this.preRender, this );
  this.getEngine().on( "postUpdate", this.postUpdate, this );
  this.getEntity().on( "editorSelected", this.onSelected, this );
  this.getEntity().on( "editorUnselected", this.onUnselected, this );
};

CubeMapCapture.prototype.shutdown = function() {
  // this.getEngine().globalEvents.trigger('renderer::unregisterPreRenderFn', "Reflection_" + this.reflectionActorId, this.preRenderPass, this );
};

CubeMapCapture.prototype.editorShutdown = function() {

  this.getEntity().off( "editorSelected", this.onSelected, this );
  this.getEntity().off( "editorUnselected", this.onUnselected, this );
  this.getEngine().off( "preRender", this.preRender, this );
  this.getEngine().off( "postUpdate", this.postUpdate, this );
  this.shutdown();
};

CubeMapCapture.prototype.onSelected = function() {
  this.cubeCamera.traverse( function( obj ) {
    if ( obj instanceof THREE.PerspectiveCamera ) {
      if ( !obj.cameraHelper ) {
        obj.cameraHelper = new THREE.CameraHelper( obj );
        obj.add( obj.cameraHelper );
      }
      obj.cameraHelper.visible = true;
    }
  });
};

CubeMapCapture.prototype.onUnselected = function() {
  this.cubeCamera.traverse( function( obj ) {
    if ( obj instanceof THREE.PerspectiveCamera ) {
      if ( obj.cameraHelper ) {
        obj.cameraHelper.visible = false;
      }
    }
  });
};

CubeMapCapture.prototype.objectCreated = function() {

  var threeObj = this.getThreeScene();
  threeObj.add( this.cubeCamera );
};

CubeMapCapture.prototype.initEditorObject = function() {
  this.objectCreated();

  this.boxGeometry = new THREE.BoxGeometry( 0.25, 0.25, 0.25, 1, 1, 1 );

  this.boxGeometry.dynamic = true;
  this.boxMesh = new THREE.Mesh( this.boxGeometry );
  this.boxMesh.castShadow = false;
  this.boxMesh.receiveShadow = false;
  this.boxMesh.name = "CubeMapCapturePlane";
  this.getThreeObject().add( this.boxMesh );
  this.getEngine().globalEvents.trigger( "studioApp::registerPickingObject", this.getEntity(), this.boxMesh );

  if ( !this.cubeTexture ) {
    this.createTempRenderTexture();
  }
  else {
    this.cubeTexture.load();
  }
  
  this.cubeMaterialDef.uniforms[ "tCube" ].value = this.cubeTexture ? this.cubeTexture.threeData : this.tempRenderTexture.threeData;
  this.cubeMaterial = new THREE.ShaderMaterial( this.cubeMaterialDef );
  this.boxMesh.material = this.cubeMaterial;
};

CubeMapCapture.prototype.createTempRenderTexture = function( changes ) {
  var that = this;
  this.getAssetRegistry().createAsset( { type: "renderTextureCube", id: "render_tex_cube", payload: {
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

CubeMapCapture.prototype.attributesChanged = function( changes ) {
  if ( changes.cubeTexture !== undefined ) {
    if ( this.cubeTexture ) {
      var that = this;
      this.cubeTexture.once( 'load', function() {
        if ( that.tempRenderTexture ) {
          that.tempRenderTexture.unload();
        }
        that.cubeMaterial.uniforms[ "tCube" ].value = that.cubeTexture.threeData;
      } );
      this.cubeTexture.load();
    }
    else if ( !this.tempRenderTexture ) {
      this.createTempRenderTexture();
      this.cubeMaterial.uniforms[ "tCube" ].value = this.tempRenderTexture.threeData;
    }
  }
  if ( changes.near || changes.far ) {
    this.cameraPX.near = this.near;
    this.cameraPX.far = this.far;
    this.cameraPX.updateProjectionMatrix();
    this.cameraNX.near = this.near;
    this.cameraNX.far = this.far;
    this.cameraNX.updateProjectionMatrix();
    this.cameraPY.near = this.near;
    this.cameraPY.far = this.far;
    this.cameraPY.updateProjectionMatrix();
    this.cameraNY.near = this.near;
    this.cameraNY.far = this.far;
    this.cameraNY.updateProjectionMatrix();
    this.cameraPZ.near = this.near;
    this.cameraPZ.far = this.far;
    this.cameraPZ.updateProjectionMatrix();
    this.cameraNZ.near = this.near;
    this.cameraNZ.far = this.far;
    this.cameraNZ.updateProjectionMatrix();
    this.cubeCamera.traverse( function( obj ) {
    if ( obj instanceof THREE.PerspectiveCamera ) {
      if ( obj.cameraHelper ) {
        obj.cameraHelper.update();
      }
    }
  });
  }
};

/**
 * Called immediately after after component creation
 */
CubeMapCapture.prototype.initCameras = function() {
  this.cubeCamera = new THREE.Object3D();
  this.cubeCamera.position.copy( this.getEntity().getPosition() );

  var fov = 90, aspect = 1;

  this.cameraPX = new THREE.PerspectiveCamera( fov, aspect, this.near, this.far );
  this.cameraPX.up.set( 0, - 1, 0 );
  this.cameraPX.lookAt( new THREE.Vector3( 1, 0, 0 ) );
  this.cameraPX.rotationAutoUpdate = false;
  this.cubeCamera.add( this.cameraPX );

  this.cameraNX = new THREE.PerspectiveCamera( fov, aspect, this.near, this.far );
  this.cameraNX.up.set( 0, - 1, 0 );
  this.cameraNX.lookAt( new THREE.Vector3( - 1, 0, 0 ) );
  this.cameraNX.rotationAutoUpdate = false;
  this.cubeCamera.add( this.cameraNX );

  this.cameraPY = new THREE.PerspectiveCamera( fov, aspect, this.near, this.far );
  this.cameraPY.up.set( 0, 0, 1 );
  this.cameraPY.lookAt( new THREE.Vector3( 0, 1, 0 ) );
  this.cameraPY.rotationAutoUpdate = false;
  this.cubeCamera.add( this.cameraPY );

  this.cameraNY = new THREE.PerspectiveCamera( fov, aspect, this.near, this.far );
  this.cameraNY.up.set( 0, 0, - 1 );
  this.cameraNY.lookAt( new THREE.Vector3( 0, - 1, 0 ) );
  this.cameraNY.rotationAutoUpdate = false;
  this.cubeCamera.add( this.cameraNY );

  this.cameraPZ = new THREE.PerspectiveCamera( fov, aspect, this.near, this.far );
  this.cameraPZ.up.set( 0, - 1, 0 );
  this.cameraPZ.lookAt( new THREE.Vector3( 0, 0, 1 ) );
  this.cameraPZ.rotationAutoUpdate = false;
  this.cubeCamera.add( this.cameraPZ );

  this.cameraNZ = new THREE.PerspectiveCamera( fov, aspect, this.near, this.far );
  this.cameraNZ.up.set( 0, - 1, 0 );
  this.cameraNZ.lookAt( new THREE.Vector3( 0, 0, - 1 ) );
  this.cameraNZ.rotationAutoUpdate = false;
  this.cubeCamera.add( this.cameraNZ );
};

CubeMapCapture.prototype.postUpdate = function( delta ) {
  if ( this.cubeCamera && this.hasThreeData() && this.isEnabled() ) {
    this.cubeCamera.position.setFromMatrixPosition( this.getThreeObject().matrixWorld );
  }
};

CubeMapCapture.prototype.preRender = function( delta ) {
  this.framesElapsed++;
  if ( this.framesElapsed >= this.updateFrameInterval && this.isEnabled() ) {
    this.framesElapsed = 0.0;
    var renderer = this.getRenderer();
    var scene = this.getScene().threeData;
    
    if ( this.cubeTexture || this.tempRenderTexture ) {

      var renderTarget = this.cubeTexture ? this.cubeTexture.threeData : this.tempRenderTexture.threeData;
      var generateMipmaps = renderTarget.generateMipmaps;

      renderTarget.generateMipmaps = false;

      if ( this.renderPosX ) {
        renderTarget.activeCubeFace = 0;
        renderer.renderView( scene, this.cameraPX, { renderTarget: renderTarget, clearColor: true } );
      }

      if ( this.renderNegX ) {
        renderTarget.activeCubeFace = 1;
        renderer.renderView( scene, this.cameraNX, { renderTarget: renderTarget, clearColor: true } );
      }

      if ( this.renderPosY ) {
        renderTarget.activeCubeFace = 2;
        renderer.renderView( scene, this.cameraPY, { renderTarget: renderTarget, clearColor: true } );
      }

      if ( this.renderNegY ) {
        renderTarget.activeCubeFace = 3;
        renderer.renderView( scene, this.cameraNY, { renderTarget: renderTarget, clearColor: true } );
      }

      if ( this.renderPosZ ) {
        renderTarget.activeCubeFace = 4;
        renderer.renderView( scene, this.cameraPZ, { renderTarget: renderTarget, clearColor: true } );
      }

      renderTarget.generateMipmaps = generateMipmaps;

      if ( this.renderNegZ ) {
        renderTarget.activeCubeFace = 5;
        renderer.renderView( scene, this.cameraNZ, { renderTarget: renderTarget, clearColor: true } );
      }
      renderTarget.needsUpdate = true;
    }
  }
};


return CubeMapCapture;
});