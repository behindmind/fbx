(function(require, _, VAPI, THREE, console, Math) {
/*
@vname Default Filters
@vdescription Stores the default filter settings that cameras will use when rendering.
@vfilter application
@vcategory Rendering
@vtype bloom {
  "attributes": {
    "enabled": { type: 'b', default: false },
    "strength": { type: 'f', default: 1.0, min: 0.1, max: 4.0, step: 0.001 },
    "sigma": { type: 'f', default: 4, min: 1, max: 8, step: 0.001, advanced: true },
    "resolution": { type: 'i', default: 256, min: 64, max: 1024, step: 1, advanced: true },
  }
}
@vtype toneMapping {
  "attributes": {
    "enabled": { type: 'b', default: false, description: 'Enable tone-mapping.' },
    "adaptive": { type: "b", "description": "Automatically adjusts the tone-mapping every frame based on the average luminance of the scene.",default: true },
    "adaptSpeed": { type: "f", "description": "The speed at which adaptive tone-mapping works. Higher number is faster.", default: 0.5, min: 0.1, max: 20.0 },
    "exposureBias":     { type: "f", "description": "Adjusts the overall brightness of the image. Use this to tweak the final result of tone-mapping.", default: 1.0, min: 0.0001, max: 5.0 },
    "maxLuminance":  { type: "f", "description": "Sets the maximum brightness reached before pixels become white after tone-mapping.", default: 6, min: 0.01, max: 16.0 },
    "luminance":  { type: "f", "description": "When the 'Adaptive' feature is turned off, this will set the scene luminance to be used by tone-mapping.", default: 1.0, min: 0.0001, max: 16.0 },
  },
}
@vtype fxaa {
  "attributes": {
    "enabled": { type: 'b', default: false },
  }
}
@vtype vignette {
  "attributes": {
    "enabled": { type: 'b', default: false },
    "offset": { type: 'f', default: 1.0, min: 0.0, max: 1.0, step: 0.001 },
    "darkness": { type: 'f', default: 1.0, min: 0.0, max: 5.0, step: 0.001 }
  }
}
@vtype ssao {
  "attributes": {
    "enabled": { type: 'b', default: false },
    "fogEnabled": { type: 'i', default: 1, advanced: true },
    "depthScale": { type: 'f', default: 40000.0, min: 100.0, max: 50000.0, step: 0.001, advanced: true },
    "onlyAO":       { type: "i", default: 0 },
    "aoClamp":      { type: "f", default: 0.75, advanced: true },
    "lumInfluence": { type: "f", default: 0.75, advanced: true },
    "noiseAmount": { type: "f", default: 0.0002 },
    "radius": { type: "f", default: 8.0 },
    "diffArea": { type: "f", default: 0.4, advanced: true },
    "gDisplace": { type: "f", default: 0.4, advanced: true }
  }
}
@vtype dof {
  "attributes": {
    "enabled": { type: 'b', default: false },
    "aspect": { type: 'f', default: 1.0, min: 0.0, max: 1.0, step: 0.001, advanced: true },
    "aperture": { type: 'f', default: 0.025, min: 0.0, max: 1.0, step: 0.001 },
    "focus": { type: 'f', default: 1.0, min: 0.0, max: 1.0, step: 0.001 },
  }
}
@vtype sepia {
  "attributes": {
    "enabled": { type: 'b', default: false },
    "amount": { type: 'f', default: 0.9, min: 0.0, max: 1.0, step: 0.001 }
  }
}
@vtype video {
  "attributes": {
    "enabled": { type: 'b', default: false },
    "nIntensity": { type: "f", default: 0.15 },
    "sIntensity": { type: "f", default: 0.05 },
    "sCount":     { type: "f", default: 512 },
    "grayscale":  { type: "b", default: false }
  },
}
@vattr bloom bloom { description: "" }
@vattr toneMapping toneMapping { description: "" }
@vattr fxaa fxaa { description: "" }
@vattr vignette vignette { description: "" }
@vattr ssao ssao { description: "" }
@vattr dof dof { description: "" }
@vattr sepia sepia { description: "" }
@vattr video video { description: "" }

*/
function DefaultFilters() {

}

DefaultFilters.prototype = new VAPI.VeroldComponent();

DefaultFilters.prototype.editorInit = function() {
  this.init();
  // this.getEngine().on( "preRenderView", this.preRenderView, this );
};

DefaultFilters.prototype.init = function() {
  // this.on( 'enable', this.onEnable, this );
  // this.on( 'disable', this.onDisable, this );
  // this.initComposer();
  // this.getEngine().on( 'resize', this.resize, this );
  this.getEngine().on( 'getDefaultFilters', this.getDefaultFilters, this );
  this.updateFilters();
};

DefaultFilters.prototype.editorShutdown = function() {
  // this.off( 'enable', this.onEnable, this );
  // this.off( 'disable', this.onDisable, this );
  this.shutdown();
  // this.getEngine().off( "preRenderView", this.preRenderView, this );
};

DefaultFilters.prototype.shutdown = function() {
  this.getEngine().off( 'getDefaultFilters', this.getDefaultFilters, this );

};

DefaultFilters.prototype.getDefaultFilters = function( callback ) {
  if ( _.isFunction( callback ) ) {
    return callback( this );
  }
};

DefaultFilters.prototype.onEnable = function() {
  this.composer.enabled = true;
  this.updateFilters();
};

DefaultFilters.prototype.onDisable = function() {
  this.updateFilters();
};

DefaultFilters.prototype.attributesChanged = function( changes ) {

  this.updateFilters( changes );
};


DefaultFilters.prototype.updateFilters = function( changes ) {

  var that = this;

  var toneMapping = this.toneMapping;
  if ( toneMapping && toneMapping.enabled && this.isEnabled() ) {

    setTimeout( function() {
      var renderer = that.getEntity().getComponentByScriptId("verold_renderer");
      if ( renderer ) {
        renderer.setAttribute( "gammaOutput", false );
      }
    }, 0 );
  }
  else {
    setTimeout( function() {
      var renderer = that.getEntity().getComponentByScriptId("verold_renderer");
      if ( renderer ) {
        renderer.setAttribute( "gammaOutput", true );
      }
    }, 0 );
  }

  this.getEngine().trigger('defaultFiltersChanged');

};


return DefaultFilters;
});