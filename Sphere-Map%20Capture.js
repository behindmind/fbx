(function(require, _, VAPI, THREE, console, Math) {
/**
 * @author Mike Bond
 * A component to make rendering to a cube map easier.
 *
 * @class SphereMapCapture
 */
function SphereMapCapture() {
  this.framesElapsed = 0;

  this.near = 1.0;
  this.far = 12000.0;
  this.updateFrameInterval = 0.0;

  this.sphereMaterial = undefined;
  this.tempRenderTexture = undefined;

  this.sphereMaterialDef = {

    uniforms: { "tSphere": { type: "t", value: null }},

    vertexShader: [

      "varying vec4 vPositionVS;",
      "varying vec3 vNormal;",

      THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],

      "void main() {",

      // " vec4 worldPosition = vec4( position, 1.0 );",
      " vPositionVS = modelViewMatrix * vec4( position, 1.0 );",
      " vNormal = normalMatrix * normal;",

      " gl_Position = projectionMatrix * vPositionVS;",

        THREE.ShaderChunk[ "logdepthbuf_vertex" ],

      "}"

    ].join("\n"),

    fragmentShader: [

      "uniform sampler2D tSphere;",

      "varying vec4 vPositionVS;",
      "varying vec3 vNormal;",
      THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

      "void main() {",
      " vec3 eyeVector = normalize( vPositionVS.xyz - (viewMatrix * vec4( cameraPosition, 0.0 )).xyz );",
      " vec3 normal = normalize( vNormal );",
      " normal.xy = normal.xy * 0.5 + 0.5;",
      " normal.z = 0.0;",
      // " float VdotN = dot( eyeVector, normal );",
      // " vec3 poop = normalize(vPositionVS);",
      " vec4 reflectedColor = texture2D( tSphere, normal.xy );",
      // " gl_FragColor = textureCube( tSphere, vec3( vPositionVS.x, vPositionVS.yz ) );",
        "gl_FragColor = vec4( reflectedColor.xyz, 1.0 );",
        THREE.ShaderChunk[ "logdepthbuf_fragment" ],

      "}"

    ].join("\n")

  };
}

/*global VAPI*/
SphereMapCapture.prototype = new VAPI.VeroldComponent();

SphereMapCapture.prototype.init = function() {
  
  this.initCamera();
};

SphereMapCapture.prototype.editorInit = function() {
  this.init();
  this.veroldEntity.getParentAsset().once('load', this.initEditorObject, this );
  if ( this.veroldEntity.state_base === "loaded") {
    this.veroldEntity.load();
  }
  // this.getEngine().on( "preRenderView", this.preRenderView, this );
  this.getEngine().on( "preRenderView", this.preRenderView, this );
  this.getEngine().on( "postUpdate", this.postUpdate, this );
  this.getEntity().on( "editorSelected", this.onSelected, this );
  this.getEntity().on( "editorUnselected", this.onUnselected, this );
  this.getEngine().on( "update", this.update, this );
};

SphereMapCapture.prototype.shutdown = function() {
  // this.getEngine().globalEvents.trigger('renderer::unregisterPreRenderFn', "Reflection_" + this.reflectionActorId, this.preRenderPass, this );
};

SphereMapCapture.prototype.editorShutdown = function() {

  this.getEntity().off( "editorSelected", this.onSelected, this );
  this.getEntity().off( "editorUnselected", this.onUnselected, this );
  this.getEngine().off( "preRenderView", this.preRenderView, this );
  this.getEngine().off( "postUpdate", this.postUpdate, this );
  this.getEngine().off( "update", this.update, this );
  this.shutdown();
};

SphereMapCapture.prototype.onSelected = function() {
  this.sphereCamera.traverse( function( obj ) {
    if ( obj instanceof THREE.PerspectiveCamera ) {
      if ( !obj.cameraHelper ) {
        obj.cameraHelper = new THREE.CameraHelper( obj );
        obj.add( obj.cameraHelper );
      }
      obj.cameraHelper.visible = true;
    }
  });
};

SphereMapCapture.prototype.onUnselected = function() {
  this.sphereCamera.traverse( function( obj ) {
    if ( obj instanceof THREE.PerspectiveCamera ) {
      if ( obj.cameraHelper ) {
        obj.cameraHelper.visible = false;
      }
    }
  });
};

SphereMapCapture.prototype.objectCreated = function() {

  var threeObj = this.getThreeScene();
  threeObj.add( this.sphereCamera );
};

SphereMapCapture.prototype.initEditorObject = function() {
  this.objectCreated();

  this.sphereGeometry = new THREE.SphereGeometry( 0.25, 12, 12 );

  this.sphereGeometry.dynamic = true;
  this.sphereMesh = new THREE.Mesh( this.sphereGeometry );
  this.sphereMesh.castShadow = false;
  this.sphereMesh.receiveShadow = false;
  this.sphereMesh.name = "SphereMapCapturePlane";
  this.getThreeObject().add( this.sphereMesh );
  this.getEngine().globalEvents.trigger( "studioApp::registerPickingObject", this.getEntity(), this.sphereMesh );

  if ( !this.sphereTexture ) {
    this.createTempRenderTexture();
  }
  else {
    this.sphereTexture.load();
  }
  
  this.sphereMaterialDef.uniforms[ "tSphere" ].value = this.sphereTexture ? this.sphereTexture.threeData : this.tempRenderTexture.threeData;
  this.sphereMaterial = new THREE.ShaderMaterial( this.sphereMaterialDef );
  this.sphereMesh.material = this.sphereMaterial;
};

SphereMapCapture.prototype.createTempRenderTexture = function( changes ) {
  var that = this;
  this.getAssetRegistry().createAsset( { type: "renderTexture2D", id: "render_tex_sphere_map", payload: {
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

SphereMapCapture.prototype.attributesChanged = function( changes ) {
  if ( changes.sphereTexture !== undefined ) {
    if ( this.sphereTexture ) {
      var that = this;
      this.sphereTexture.once( 'load', function() {
        if ( that.tempRenderTexture ) {
          that.tempRenderTexture.unload();
        }
        that.sphereMaterial.uniforms[ "tSphere" ].value = that.sphereTexture.threeData;
      } );
      this.sphereTexture.load();
    }
    else if ( !this.tempRenderTexture ) {
      this.createTempRenderTexture();
      this.sphereMaterial.uniforms[ "tSphere" ].value = this.tempRenderTexture.threeData;
    }
  }
  if ( changes.near || changes.far ) {
    this.sphereCamera.near = this.near;
    this.sphereCamera.far = this.far;
    this.sphereCamera.updateProjectionMatrix();
   
    if ( this.sphereCamera.cameraHelper ) {
      this.sphereCamera.cameraHelper.update();
    }
  }
};

/**
 * Called immediately after after component creation
 */
SphereMapCapture.prototype.initCamera = function() {
  this.sphereCamera = new THREE.PerspectiveCamera( 179.0, 1.0, this.near, this.far );
  this.sphereCamera.position.copy( this.getEntity().getPosition() );
};

SphereMapCapture.prototype.postUpdate = function( delta ) {
  if ( this.sphereCamera && this.hasThreeData() ) {
    this.sphereCamera.position.setFromMatrixPosition( this.getThreeObject().matrixWorld );
  }
};

SphereMapCapture.prototype.update = function( delta ) {
  this.framesElapsed++;
  this.performRender = false;
  if ( this.framesElapsed >= this.updateFrameInterval ) {
    this.framesElapsed = 0.0;
    if ( this.sphereTexture || this.tempRenderTexture ) {
      this.performRender = true;
    }
  }
};

SphereMapCapture.prototype.preRenderView = function( scene, camera, options ) {
  if ( this.performRender ) {
    var renderer = this.getRenderer();
    this.sphereCamera.lookAt( camera.position );
    
    //This render needs to be done with a fish-eye distortion but we don't have a current way of enabling this for a single render pass...
    // #ifdef USE_FISHEYE
    //   vec4 tempPoint = modelViewMatrix * displacedPosition;
    //   gl_Position.xy = tempPoint.xy / length( tempPoint.xyz );
    // #endif
    var renderTarget = this.sphereTexture ? this.sphereTexture.threeData : this.tempRenderTexture.threeData;

    renderer.renderView( scene, this.sphereCamera, { renderTarget: renderTarget, clearColor: true } );
    
  }
};


return SphereMapCapture;
});