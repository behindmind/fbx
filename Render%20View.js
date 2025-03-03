(function(require, _, VAPI, THREE, console, Math) {
/**
 *
 * @class RenderView
 */
function RenderView() {
  this.renderEventName = "render";
  this.enablePostProcess = true;
  this.enableShadows = true;
  this.enablePreRenderFunctions = true;
  this.opacity = 1.0;
  this.currentRenderContext = this;
  this.renderTarget;
}

/*global VAPI*/
RenderView.prototype = new VAPI.VeroldComponent();

RenderView.prototype.init = function() {
  
  var renderEvent = parseInt( this.renderGroup, 10 );
  if ( renderEvent ) {
    this.renderEventName += "Group" + renderEvent;
  }
  this.getEngine().on( this.renderEventName, this.renderView, this );
  this.getEngine().on( "resize", this.resize, this );
  this.resize();

  this.listenTo( this.getEntity(), 'enableRenderView', this.enableRenderView );
  this.listenTo( this.getEntity(), 'disableRenderView', this.disableRenderView );
  this.listenTo( this.getEntity(), 'toggleRenderView', this.toggleRenderView );
  this.listenTo( this.getEntity(), 'setViewport', this.setViewport );
};

RenderView.prototype.shutdown = function() {
  this.getEngine().off( this.renderEventName, this.renderView, this );
  this.getEngine().off( "resize", this.resize, this );
};

RenderView.prototype.componentsLoaded = function() {
  this.filters = this.getEntity().getComponentByScriptId('camera_filters_script');
};

RenderView.prototype.enableRenderView = function( fade ) {
  this.enable();
  if ( fade ) {
    this.fadeOutTime = 0.0
    this.fadeInTime = fade;
    this.opacityTime = 0.0;
    this.opacity = 0.0;
  }
  else {
    this.opacity = 1.0;
  }
};

RenderView.prototype.disableRenderView = function( fade ) {
  if ( fade ) {
    this.fadeInTime = 0.0;
    this.opacityTime = fade;
    this.fadeOutTime = fade;
    this.opacity = 1.0;
  }
  else {
    this.disable();
    this.opacity = 0.0;
  }
};

RenderView.prototype.toggleRenderView = function( fade ) {
  if ( this.isEnabled() ) {
    this.disableRenderView( fade );
  }
  else {
    this.enableRenderView( fade );
  }
};

RenderView.prototype.setViewport = function( x, y, width, height, animationTime ) {
  this.viewportLeft = x;
  this.viewportBottom = y;
  this.viewportWidth = width;
  this.viewportHeight = height;
  
  if ( !animationTime ) {
    this.resize();
    this.animationTotalTime = 0;
  }
  else {
    this.animationTotalTime = animationTime;
    this.animationTime = 0;
    this.oldX = this._x;
    this.oldY = this._y;
    this.oldWidth = this._width;
    this.oldHeight = this._height;

    this.updateViewport();

    this.targetX = this._x;
    this.targetY = this._y;
    this.targetWidth = this._width;
    this.targetHeight = this._height;

    this._x = this.oldX;
    this._y = this.oldY;
    this._width = this.oldWidth;
    this._height = this.oldHeight;
  }
};

RenderView.prototype.updateViewport = function() {
  var cWidth, cHeight, percent;
  cWidth = this.getEngine().getBaseRenderer().getWidth();
  cHeight = this.getEngine().getBaseRenderer().getHeight();

  if ( this.viewportBottom.slice( -1 ) === "%" ) {
    percent = parseFloat(this.viewportBottom.slice( 0, -1)) * 0.01;
    this._y = parseInt(percent * cHeight, 10);
  }
  else {
    this._y = parseInt(this.viewportBottom);
  }
  if ( this.viewportLeft.slice( -1 ) === "%" ) {
    percent = parseFloat(this.viewportLeft.slice( 0, -1)) * 0.01;
    this._x = parseInt(percent * cWidth, 10);
  }
  else {
    this._x = parseInt(this.viewportLeft);
  }
  if ( this.viewportWidth.slice( -1 ) === "%" ) {
    percent = parseFloat(this.viewportWidth.slice( 0, -1)) * 0.01;
    this._width = parseInt(percent * cWidth, 10);
  }
  else {
    this._width = parseInt(this.viewportWidth);
  }
  this._width = Math.min( this._width, cWidth - this._x );

  if ( this.viewportHeight.slice( -1 ) === "%" ) {
    percent = parseFloat(this.viewportHeight.slice( 0, -1)) * 0.01;
    this._height = parseInt(percent * cHeight, 10);
  }
  else {
    this._height = parseInt(this.viewportHeight);
  }
  this._height = Math.min( this._height, cHeight - this._y );

  if ( this._x < 0 ) {
    this._x += cWidth;
  }
  if ( this._y < 0 ) {
    this._y += cHeight;
  }
};

RenderView.prototype.updateCameraProjection = function() {
  var camera = this.getThreeData();
  if ( camera ) {
    camera.aspect = this._width / this._height;
    camera.updateProjectionMatrix();
  }
};

RenderView.prototype.resize = function() {
  this.updateViewport();
  this.updateCameraProjection();
};

RenderView.prototype.setRenderOverride = function( fn, context ) {

  this.getEngine().off( this.renderEventName, this.renderView, this.currentRenderContext );
  if ( fn ) {
    this.getEngine().on( this.renderEventName, fn, context );
    this.currentRenderContext = context;
  }
  else {
    this.getEngine().on( this.renderEventName, this.renderView, this );
  }
};

RenderView.prototype.renderView = function(delta) {
  if ( this.isEnabled() ) {
    var scene = this.getScene();
    var renderTarget = null;
    if ( this.renderTarget ) {
      if ( !this.renderTarget.threeData ) {
        return;
      }
      else {
        renderTarget = this.renderTarget.threeData;
      }
    }
    if (this.hasThreeData() && scene && scene.threeData ) {
      if ( this.fadeInTime ) {
        this.getEngine().needsRender = true;
        this.opacityTime += delta;
        this.opacity = this.opacityTime * this.opacityTime / this.fadeInTime;
        if ( this.opacity > 1.0 ) {
          this.opacity = 1.0;
          this.fadeInTime = 0.0;
          this.opacityTime = 0.0;
        }
      }
      else if ( this.fadeOutTime ) {
        this.getEngine().needsRender = true;
        if ( this.opacityTime === -1.0 ) {
          this.disable();
          this.opacity = 0;
          this.fadeOutTime = 0.0;
          this.opacityTime = 0.0;
          this.disable();
        }
        else {
          this.opacityTime -= delta;
          if ( this.opacityTime <= 0.0 ) {
            this.opacity = 0.0001;
            this.opacityTime = -1.0;
          }
          else {
            this.opacity = this.opacityTime / this.fadeOutTime;
            // this.opacity = Math.min( this.opacity, 1.0 );
          }
        }
      }
      if ( this.animationTotalTime > 0 ) {
        this.getEngine().needsRender = true;
        this.animationTime += delta;
        var animationProgress = this.animationTime / this.animationTotalTime;
        if ( animationProgress >= 1.0 ) {
          this.animationTotalTime = 0;
          animationProgress = 1.0;
        }

        this._x = (1.0 - animationProgress) * this.oldX + animationProgress * this.targetX;
        this._y = (1.0 - animationProgress) * this.oldY + animationProgress * this.targetY;
        this._width = (1.0 - animationProgress) * this.oldWidth + animationProgress * this.targetWidth;
        this._height = (1.0 - animationProgress) * this.oldHeight + animationProgress * this.targetHeight;

        this.updateCameraProjection();
      }

      // this.getThreeRenderer().clear( this.clearColor, this.clearDepth, true );
      // this.getThreeRenderer().setViewport( this._x, this._y, this._width, this._height );
      this.getRenderer().renderView( scene.threeData, this.getThreeData(), {
        viewPort: { x: this._x, y: this._y, width: this._width, height: this._height},
        enablePreRenderFunctions: this.enablePreRenderFunctions,
        composer: this.filters ? this.filters.composer : null,
        enableShadows: this.enableShadows,
        clearColor: this.clearColor,
        clearDepth: this.clearDepth,
        delta: delta,
        opacity: this.opacity,
        renderTarget: renderTarget } );
    }
  } 
};

return RenderView;
});