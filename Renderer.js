(function(require, _, VAPI, THREE, console, Math) {
/**
 * A skybox component class.
 *
 * @class Component
 */
function DefaultRenderer() {

  this.threeRenderer = null;
  this.caps = {};

  //Attributes
  this.antialias = false;
  this.preserveDrawingBuffer = true;
  this.precision = "mediump";
  this.devicePixelRatio = 1.0;

  this.shadowMapEnabled = true;
  this.shadowMapEnabledMobile = false;
  this.shadowMapType = THREE.PCFSoftShadowMap;
  this.shadowMapCascade = false;
  this.shadowMapDebug = false;
  this.maxShadows = -1;
  this.maxPointLights = -1;
  this.maxDirLights = -1;
  this.maxSpotLights = -1;
  this.maxHemiLights = -1;

  this.clearColor = new THREE.Color();
  this.clearAlpha = 0.0;
  this.autoClear = false;
  this.autoClearColor = true;
  this.autoClearDepth = true;
  this.autoClearStencil = true;

  this.sortObjects = true;
  this.autoUpdateObjects = true;

  // this.gammaInput = true;
  // this.gammaOutput = false;

  this.preRenderFns = {};
  this.postRenderFns = {};
  this.renderPasses = [];

  this.renderOnDemand = false;
}

DefaultRenderer.prototype = new VAPI.VeroldComponent();

DefaultRenderer.prototype.editorInit = function() {
  this.preInit();
  this.objectCreated();
  this.applyRenderSettings();
};

DefaultRenderer.prototype.preInit = function() {
  this.canvas = this.getEngine().canvas;
  this.initDefaultRenderer();

  this.getEngine().on( 'resize', this.resize, this );

  this.caps = this.getEngine().getBaseRenderer().caps;

  this.getEngine().setBaseRenderer( this );

  //Init scene sceneComposer
  // var pars = { format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  var renderer = this.getThreeRenderer();
  renderer.hdrOutputEnabled = true;
  renderer.gammaInput = true;
  renderer.gammaOutput = true;
  
  var extensions = new THREE.WebGLExtensions( renderer.getContext() );
  if ( extensions.get('OES_texture_half_float_linear') && !VAPI.isMobile() ) {
    // pars.type = THREE.FloatType;
    renderer.hdrOutputType = THREE.HDRFull;
  }
  else {
    // renderer.hdrOutputType = THREE.HDRRGBM;
    renderer.hdrOutputEnabled = false;
  }
  
  // var renderTarget = new THREE.WebGLRenderTarget( this.getRenderer().getCanvasWidth(), this.getRenderer().getCanvasHeight(), pars );
  // renderTarget.name = "Main Render Target";
  // this.sceneComposer = new THREE.EffectComposer( this.getThreeRenderer(), renderTarget );
  // this.sceneComposer.enabled = false;

  // this.sceneComposer.setSize( this.getRenderer().getCanvasWidth(), this.getRenderer().getCanvasHeight() );
};

DefaultRenderer.prototype.init = function() {
  if ( this.renderOnDemand ) {
    this.getEngine().renderOnDemand = true;
  }
  if ( !this.shadowMapEnabledMobile ) {
    this.shadowMapEnabled = VAPI.isMobile() ? this.shadowMapEnabledMobile && this.shadowMapEnabled : this.shadowMapEnabled;
  }
  this.applyRenderSettings();
};
/**
 * Called when a verold object is destroyed or this component is removed
 * from a verold object.
 */
DefaultRenderer.prototype.shutdown = DefaultRenderer.prototype.editorShutdown = function() {

  this.getEngine().off( 'resize', this.resize, this );

  for ( var i = 0; i < this.renderPasses.length; i++ ) {
    this.renderPasses[ i ].pass = null;
    this.renderPasses[ i ].scene = null;
    this.renderPasses[ i ].camera = null;
  }
  // this.sceneComposer.dispose();

  this.threeRenderer.context = null;
  this.threeRenderer = null;
  this.canvas = undefined;
  //this.flags = undefined;
};

DefaultRenderer.prototype.objectCreated = function() {
  this.getEngine().trigger('resize');
};

DefaultRenderer.prototype.attributesChanged = function( changes ) {
  var rebuildMaterials = false;
  if ( changes.shadowMapEnabledMobile !== undefined ) {
    // this.shadowMapEnabledMobile = changes.shadowMapEnabledMobile;
    rebuildMaterials = true;
  }
  this.shadowMapEnabled = VAPI.isMobile() ? this.shadowMapEnabledMobile && this.shadowMapEnabled : this.shadowMapEnabled;
  this.applyRenderSettings();

  if ( changes.renderOnDemand ) {
    this.getEngine().renderOnDemand = true;
  }
  if ( changes.clearAlpha !== undefined ) {
    this.threeRenderer.setClearColor( this.clearColor, changes.clearAlpha );
  }
  if ( changes.clearColor !== undefined ) {
    this.threeRenderer.setClearColor( changes.clearColor, this.clearAlpha );
  }

  if ( changes.gammaOutput !== undefined ) {
    // this.gammaOutput = changes.gammaOutput;
    rebuildMaterials = true;
  }
  if ( changes.gammaInput !== undefined ) {
    // this.gammaInput = changes.gammaInput;
    rebuildMaterials = true;
  }
  if ( changes.shadowMapEnabled !== undefined ) {
    // this.shadowMapEnabled = changes.shadowMapEnabled;
    rebuildMaterials = true;
  }
  if ( changes.shadowMapDebug !== undefined ) {
    // this.shadowMapDebug = changes.shadowMapDebug;
    rebuildMaterials = true;
  }
  if ( changes.shadowMapCascade !== undefined ) {
    // this.shadowMapCascade = changes.shadowMapCascade;
    rebuildMaterials = true;
  }
  if ( changes.shadowMapType !== undefined ) {
    this.shadowMapType = parseInt( changes.shadowMapType, 10 );
    console.warn("TODO - need to recreate the shadow maps if the shadow filtering has changed because PCFSoftShadowMap reuires the shadowmap to be rendered with no filtering.");
    rebuildMaterials = true;
  }
  if ( changes.devicePixelRatio !== undefined ) {
    this.getEngine().trigger("resize");
  }

  if ( rebuildMaterials ) {
    //rebuild materials
    console.log("Rebuilding materials!!!");
    this.getEngine().trigger('rebuildMaterials');
  }
};

DefaultRenderer.prototype.initDefaultRenderer = function() {

  //TODO - fix devicePixelRatio on iOS.
  if ( VAPI.isIOS() ) {
    this.devicePixelRatio = 1.0;
  }
  // var context = this.getEngine().getBaseRenderer().threeRenderer.getContext();
  if( VAPI.browserCaps.isWebGLEnabled() ){
    this.threeRenderer = new THREE.WebGLRenderer({
      // context: context,
      canvas: this.canvas,
      antialias    : this.antialias,
      preserveDrawingBuffer  : this.preserveDrawingBuffer,
      alpha: true,
      precision : this.precision,
      logarithmicDepthBuffer: this.logarithmicDepthBuffer
    });
    this.threeRenderer.setPixelRatio( this.devicePixelRatio !== 0 ? this.devicePixelRatio : window.devicePixelRatio );
  }
  else{
    console.warn("WebGL not supported so falling back to canvas renderer.");
    this.threeRenderer = new THREE.CanvasRenderer();
  }
};

// DefaultRenderer.prototype.registerPreRenderFn = function( name, fn, context ) {
//   this.preRenderFns[ name ] = { renderFn: fn, context: context };
// };

// DefaultRenderer.prototype.unregisterPreRenderFn = function( name ) {
//   if ( this.preRenderFns[ name ] ) {
//     delete this.preRenderFns[ name ];
//   }
// };

// DefaultRenderer.prototype.registerPostRenderFn = function( name, fn, context ) {
//   this.postRenderFns[ name ] = { renderFn: fn, context: context };
// };

// DefaultRenderer.prototype.unregisterPostRenderFn = function( name ) {
//   if ( this.postRenderFns[ name ] ) {
//     delete this.postRenderFns[ name ];
//   }
// };

DefaultRenderer.prototype.addRenderPass = function( pass, priority ) {
  if ( priority < 0 ) {
    this.renderPasses.splice( 0, 0, { pass : pass, scene : pass.scene, camera: pass.camera } );
  }
  else {
    this.renderPasses.push( { pass : pass, scene : pass.scene, camera: pass.camera } );
  }
  // if ( priority < 0 ) {
  //   if ( this.sceneComposer && this.sceneComposer.passes.length >= this.renderPasses.length - 1 ) {
  //     this.sceneComposer.passes.splice( 0, 0, pass );
  //   }
  // }
  // else {
  //   if ( this.sceneComposer && this.sceneComposer.passes.length >= this.renderPasses.length - 1 ) {
  //     this.sceneComposer.passes.splice( this.renderPasses.length - 1, 0, pass );
  //   }
  // }
  for ( var i in this.renderPasses ) {
    this.renderPasses[i].pass.clear = false;
    // this.renderPasses[i].pass.clearColor = this.clearColor;
  }
  this.renderPasses[0].pass.clear = true;
  this.renderPasses[0].pass.clearColor = this.clearColor;
  this.renderPasses[0].pass.clearAlpha = this.clearAlpha;
};

DefaultRenderer.prototype.removeRenderPass = function( pass ) {
  var i, foundIndex = -1;
  for ( i = 0; i < this.renderPasses.length; i++ ) {
    if ( this.renderPasses[ i ].pass === pass ) {
      foundIndex = i;
      break;
    }
  }
  if ( foundIndex >= 0 ) {
    this.renderPasses.splice( foundIndex, 1 );
    // if ( this.sceneComposer && this.sceneComposer.passes.length >= this.renderPasses.length - 1 ) {
    //   this.sceneComposer.passes.splice( foundIndex, 1 );
    // }
  }
};

// DefaultRenderer.prototype.getComposer = function() {
//   return this.sceneComposer;
// };

DefaultRenderer.prototype.initRenderPasses = function() {
  // this.sceneComposer.passes = [];
  for ( var i = 0; i < this.renderPasses.length; i++ ) {
    this.renderPasses[i].pass.scene = this.renderPasses[i].scene;
    this.renderPasses[i].pass.camera = this.renderPasses[i].camera;
    // this.sceneComposer.addPass( this.renderPasses[i].pass );
  }
};

DefaultRenderer.prototype.applyRenderSettings = function() {
  if ( this.threeRenderer ) {
    _.each( this, function( value, key ) {
      if ( this.threeRenderer[ key ] !== undefined ) {
        this.threeRenderer[ key ] = value;
      }
    }, this );

    if ( this.devicePixelRatio === 0.0 ) {
      this.devicePixelRatio = window.devicePixelRatio;
      this.threeRenderer.setPixelRatio( window.devicePixelRatio );
    }
    else {
      this.threeRenderer.setPixelRatio( this.devicePixelRatio );
    }
    
    this.threeRenderer.setClearColor( this.clearColor, this.clearAlpha );

    //This is a temporary check to force a maximum number of lights if the hardware supports a very low number of uniforms
    if ( this.getGPUCapability("MAX_FRAGMENT_UNIFORM_VECTORS") < 29 || VAPI.isMobile() ) {
      this.threeRenderer.maxDirLights = Math.min( this.maxDirLights, 1 );
      this.threeRenderer.maxPointLights = Math.min( this.maxPointLights, 1 );
      this.threeRenderer.maxShadows = Math.min( this.maxShadows, 1 );
    }
  }

};

/**
 * Given the name of a GPU device capability (e.g. MAX_VERTEX_TEXTURE_IMAGE_UNITS ), return the current system's
 * value for this capability.
 * @param  {String} cap The capability name
 * @return {Integer}     The value of the capability
 */
DefaultRenderer.prototype.getGPUCapability = function( cap ) {
  return this.caps[ cap ];
};

DefaultRenderer.prototype.supportsCompressedTextureS3TC = function() {
  return this.caps.compressedTextureFormats["S3TC"];
};

DefaultRenderer.prototype.supportsCompressedTexturePVRTC = function() {
  return this.caps.compressedTextureFormats["PVRTC"];
};

DefaultRenderer.prototype.supportsCompressedTextureATC = function() {
  return this.caps.compressedTextureFormats["ATC"];
};

DefaultRenderer.prototype.preRender = function() {
  // this.newRenderStarted = true;
  this.threeRenderer.setRenderTarget( null );
  this.threeRenderer.clear( true, true, true );
};

DefaultRenderer.prototype.renderView = function( scene, camera, options ) {
  if ( !options ) {
    options = {};
  }
  var i = 0;
  if ( scene && camera ) {
    // if ( this.newRenderStarted ) {
    //   // this.threeRenderer.shadowMapAutoUpdate = true;
    //   options.clearColor = true;
    //   // this.threeRenderer.clear( options.clearColor, options.clearDepth, options.clearStencil );
    //   this.newRenderStarted = false;
    // }
    // else {
    //   // this.threeRenderer.shadowMapAutoUpdate = false;
    //   options.clearColor = false;
    // }
    if ( options.enablePreRenderFunctions ) {
      // _.each( this.preRenderFns, function( pass ) {
      //   pass.renderFn.call( pass.context, scene, camera, options );
      // }, this );
      this.getEngine().trigger("preRenderView", scene, camera, options );
    }
    for ( i = 0; i < this.renderPasses.length; i++ ) {
      this.renderPasses[i].pass.scene = this.renderPasses[i].scene ? this.renderPasses[i].scene : scene;
      this.renderPasses[i].pass.camera = this.renderPasses[i].camera ? this.renderPasses[i].camera : camera;
    }

    var viewPort = this.threeRenderer.getViewport();

    if ( options.composer && options.composer.passes.length ) {
      if ( options.composer.renderPassesNeedUpdate ) {
        var renderPasses = [];
        for ( i = 0; i < this.renderPasses.length; i++ ) {
          renderPasses[i] = this.renderPasses[i].pass;
        }
        options.composer.passes = renderPasses.concat( options.composer.passes );
        options.composer.renderPassesNeedUpdate = false;
      }
      //TODO - move this viewport stuff into RenderView?
      var lastPass = options.composer.passes[ options.composer.passes.length - 1 ];
      lastPass.viewPort = options.viewPort;
      if ( lastPass.uniforms && lastPass.uniforms.opacity ) {
        lastPass.uniforms.opacity.value = options.opacity !== undefined ? options.opacity : 1.0;
      }
      this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.x = 0.0;
      this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.y = 0.0;
      this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.z = this.getCanvasWidth();
      this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.w = this.getCanvasHeight();

      lastPass.renderToScreen = options.renderToScreen !== undefined ? options.renderToScreen : true;
      if ( options.renderTarget ) {
        lastPass.renderToTexture = options.renderTarget;
        lastPass.renderToScreen = false;
      }
      // this.sceneComposer.passes[ 0 ].needsSwap = options.needsSwap !== undefined ? options.needsSwap : false;
      // this.sceneComposer.passes[ 0 ].clearColor = options.clearColor ? ;
      // lastPass.clearDepth = options.clearDepth;
      options.composer.render( options.delta !== undefined ? options.delta : 0.0167 );
    }
    else {

      if ( options.opacity !== undefined && (!options.viewPort || options.viewPort.width === this.getWidth() && options.viewPort.height === this.getHeight() )) {
        if ( this.getCanvas().style.opacity != options.opacity ) {
          this.getCanvas().style.opacity = options.opacity;
        }
      }
      else if ( this.getCanvas().style.opacity != 1 ) {
        this.getCanvas().style.opacity = 1.0;
      }

      if ( !options.renderTarget ) {
        // var prevRenderTarget = this.threeRenderer.getRenderTarget();
        this.threeRenderer.setRenderTarget( null );
        this.threeRenderer.clear( options.clearColor, options.clearDepth, options.clearStencil );
      }
      else {
        this.threeRenderer.setRenderTarget( options.renderTarget );
        this.threeRenderer.clear( options.clearColor, options.clearDepth, options.clearStencil );
      }

      if ( options.viewPort ) {

        this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.x = options.viewPort.x;
        this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.y = options.viewPort.y;

        this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.z = options.viewPort.width * this.devicePixelRatio;
        this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.w = options.viewPort.height * this.devicePixelRatio;

        this.threeRenderer.setViewport( options.viewPort.x, options.viewPort.y, options.viewPort.width, options.viewPort.height );
      }

      var renderer = options.effect ? options.effect : this.threeRenderer;

      for ( i = 0; i < this.renderPasses.length; i++ ) {
        var prevOverrideMat = this.renderPasses[ i ].pass.scene.overrideMaterial;
        if ( this.renderPasses[ i ].pass.overrideMaterial ) {
          this.renderPasses[ i ].pass.scene.overrideMaterial = this.renderPasses[ i ].pass.overrideMaterial;
        }
        
        if ( options.renderTarget ) {
          // if ( i === 0 ) {
          //   renderer.clear( options.clearColor, options.clearDepth );
          // }
          renderer.render( this.renderPasses[ i ].pass.scene, this.renderPasses[ i ].pass.camera, options.renderTarget, false );
        }
        else {
          renderer.render( this.renderPasses[ i ].pass.scene, this.renderPasses[ i ].pass.camera );
        }

        if ( this.renderPasses[ i ].pass.overrideMaterial ) {
          this.renderPasses[ i ].pass.scene.overrideMaterial = prevOverrideMat;
        }
      }

      // this.threeRenderer.setRenderTarget( prevRenderTarget );
      if ( options.viewPort ) {
        this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.x = viewPort.x;
        this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.y = viewPort.y;
        this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.z = viewPort.width * this.devicePixelRatio;
        this.getAssetRegistry().Materials.sharedUniforms.screenDimensions.value.w = viewPort.height * this.devicePixelRatio;

        this.threeRenderer.setViewport( viewPort.x, viewPort.y, viewPort.width, viewPort.height );
      }
    }

    // if ( options.includePostRender ) {
      // _.each( this.postRenderFns, function( pass ) {
      //   pass.renderFn.call( pass.context, scene, camera );
      // }, this );
      this.getEngine().trigger("postRenderView", scene, camera, options );
    // }
  }
};

/**
 * Returns the size of the render target in device-independent pixels (dips)
 * @method getWidth
 * @return {Int} The width of the render target.
 */
DefaultRenderer.prototype.getWidth = function() {
  return this.canvas.clientWidth;
};

/**
 * Returns the size of the render target in device-independent pixels (dips)
 * @method getHeight
 * @return {Int} The height of the render target.
 */
DefaultRenderer.prototype.getHeight = function() {
  return this.canvas.clientHeight;
};

DefaultRenderer.prototype.getCanvasWidth = function() {
  return this.canvas.width;
};

DefaultRenderer.prototype.getCanvasHeight = function() {
  return this.canvas.height;
};

DefaultRenderer.prototype.getCanvas = function() {
  return this.threeRenderer.domElement;
};

DefaultRenderer.prototype.resize = function( ) {

  var w = this.canvas.parentElement.clientWidth;
  var h = this.canvas.parentElement.clientHeight;

  this.threeRenderer.setSize(w, h, true);

  // if ( this.sceneComposer ) {
  //   this.sceneComposer.setSize( this.getRenderer().getCanvasWidth(), this.getRenderer().getCanvasHeight() );
  // }
};

return DefaultRenderer;
});