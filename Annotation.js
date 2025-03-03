(function(require, _, VAPI, THREE, console, Math) {
/*
@vname Annotation
@vdescription A way of putting notes or descriptions into your scenes. Places a pin and tag. Hides when obscured by other objects
@vfilter object
@vcategory Annotation
@vattr string Title { 
  default : 'Annotation Title', 
  description : 'Title to display on the annotation tag' 
}
@vattr string Description {
  'default' : 'A description for your Annotation',
  'description' : 'The description to display on your tag'
}
@vattr bool ShowDescription {
  'default': false,
  'description': 'whether or not we show the description for the tag'
}
@vattr bool ShowLine {
  'default': true,
  'description': 'Whether or not we show the line'
}
@vattr custom Pin {
  'description' : 'properties of the pin',
  'attributes' : {
    'visible' : { 'type' : 'b', 'name' : 'Visible', 'description' : 'If enabled, a pin object exists in the scene', 'default' : false },
    'autoScale' : { 'type' : 'b', 'name' : 'Visible', 'description' : 'If enabled, the pin will scale to always be easily selected', 'default' : true },
    'material' : { 'type': 'asset', 'name': 'Material', 'description': 'The material to color the pin with.', 'default': null, 'filter': { 'material': true } }
  }
}
@vattr custom Colors {
  'description' : 'Use some preset styles created by us, or use your own!',
  'attributes' : {
    'styles': {
      'type': 'dd',
      default: 2,
      'options': { 'Light 1': 0, 'Light 2': 1, 'Dark 1' : 2, 'Dark 2' : 3, 'Vibrant 1' : 4, 'Vibrant 2' : 5},
      'description': 'Pick the style you want the Annotation to use',
      'advanced': false
    },
  }
}
@vevent local showAnnotation {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local showAnnotationPin {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local showAnnotationLine {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local showAnnotationDescription {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local showAnnotationTag {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local hideAnnotation {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local hideAnnotationPin {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local hideAnnotationLine {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local hideAnnotationDescription {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local hideAnnotationTag {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local toggleAnnotation {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local enableAnnotation {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local disableAnnotation {'scope' : 'local', 'action':true, 'category':'Annotation', 'parameters' : []}
@vevent local changeAnnotationPinMaterial {'scope' : 'local', 'action':true, 'category':'Annotation', 
  'parameters' : [
      {'name': 'MaterialAsset', 'type': 'asset','description': 'The material to color the pin head with.','default': null, 'filter': { 'material': true } }
    ]
  }
*/
/* global VAPI */
function css (el, key, value) {
  // if args length is 3, then el, property, value
  if (!el || !el.style) {
    return;
  }

  if(typeof key !== 'string') {
    Object.keys(key).forEach(function(styleKey){
      el.style[styleKey] = key[styleKey]; 
    });
  }
  else {
    el.style[key] = value; 
  }
}

function addClass(el, className) {
  if (el.classList) {
    el.classList.add(className);
  } else {
    el.className += ' ' + className;
  }
}

function showEl(el, duration) {
  el.style.display = '';
}

function hideEl(el, duration) {
  el.style.display = 'none';
}

function toggleEl(el, duration) {
  el.style.display = el.style.display === '' ? 'none' : '';
}

//filter for use with intersects only!
function canHideFilter (obj){
  
  var visible = obj.object.visible;
  //also check material on object
  if(visible) {
    var mat = obj.object.material;
    //check for mesh face material
    if(mat instanceof THREE.MeshFaceMaterial){
      for(var i = 0; i<mat.materials.length; ++i){
        if(mat.materials[i].uniforms && mat.materials[i].uniforms.colorOpacity) {
          visible = mat.materials[i].uniforms.colorOpacity.value > 0.001;
        }
      }
    }
    else {
      if(mat.uniforms && mat.uniforms.colorOpacity) {
        visible = mat.uniforms.colorOpacity.value > 0.001;//this is our zero value clamp
      }
    }
  }
  //if STILL visible must traverse parents to check visibility, as well. :[
  if(visible) {
    obj.object.traverseAncestors(function(parent){
      if(!parent.visible) { 
        visible = false;
      }
    });
  }
  return visible;
}

function Annotation() {
  //how many steps we've made before we do a raycast
  this.nRaySteps = 0;
  this.bCreated = false;
  //if an object is in a selected state, do not show the labels!
  this.bObjectSelected = false;
  //used to update attributes
  this.bNeedsUpdate = false;

  this.pinObject = null;

  this.camera = null;
  this.tempVec = new THREE.Vector3();
  this.posVec = new THREE.Vector3();
  this.worldPosVec = new THREE.Vector3();
  this.tempMatrix = new THREE.Matrix4();
  //html elements to display
  this.el = null;
  this.desc = null;
  this.title = null;
  this.line = null;
  this.cap = null;

  this.bgColor = '#323232';

  this.Offset = new THREE.Vector2(0, 0.1);

  //renderer element reference for percentage based offsets!
  this.renderContainer = null;

  //for calculating offsets for dragging!
  this.bIsEditor = false;
  this.bDragging = false;
  this.vOffset = null;
  this.vWorldPos = null;

  this.m_bTagIsVisible = true;
  this.bSceneLoaded = false;//if in editor, this will be true
  this.bCanvasDrag = false;

  //keep track of these to stop recalculation of styles
  this.offsetWidth = 0;
  this.offsetHeight = 0;
  this.elOffsetWidth = 0;
  this.elOffsetHeight = 0;
  //check to see if lies in camera FOV
  this.isInFOV = true;
  //for css for line
  this.lineCSSObj = null;
  this.elCSSObj = null;

  this.intersects = [];

  this.tempWorldPos = new THREE.Vector3();
  this.camForward = new THREE.Vector3();

  this.DVP = window.devicePixelRatio || 1;

  this.dragStartX = 0;
  this.dragStartY = 0;
}

Annotation.EL_CSS = {
  'position': 'absolute',
  'left': 0,
  'top': 0,
  'padding': '8px',
  'border-radius': '5px',
  'font-family': 'proxima_nova_regular,Helvetica,Arial,sans-serif',
  'max-width' : '25%',
  'min-width' : '25px',
  'transition': 'opacity 0.1s ease-in-out, background 0.1s ease-in-out',
  'cursor' : 'pointer',
  'display' : 'none'
};

Annotation.TEXT_CSS = {
  'color': '#fff',
  'font-family': 'proxima_nova_regular,Helvetica,Arial,sans-serif',
  'word-wrap':'break-word',
  '-webkit-touch-callout': 'none',
  '-webkit-user-select': 'none',
  '-khtml-user-select': 'none',
  '-moz-user-select': 'none',
  '-ms-user-select': 'none',
  'user-select': 'none',
  'pointer-events' : 'none',
  'line-height' : '115%',
  'font-size' : '1.8vmin'  //1.8vmax for mobile, 1.8vmin for desktop
};

Annotation.LINE_CSS = {
  'height' : '1px',
  'position' : 'absolute',
  'border-radius': '10px',
  'pointer-events' : 'none',
  'transform-origin': '0 50%',
  'transition': 'opacity 0.1s ease-in-out',
  'border-left-style' : 'none',
  'display' : 'none',
  '-webkit-touch-callout': 'none',
  '-webkit-user-select': 'none',
  '-khtml-user-select': 'none',
  '-moz-user-select': 'none',
  '-ms-user-select': 'none',
  'user-select': 'none'
};

Annotation.CAP_CSS = {
  'transform-origin': '50% 50%',
  'padding': '2.5px',
  'border-radius': '3px',
  'pointer-events' : 'none',
  'position' : 'absolute',
  'left' : '-2.5px',
  'top' : '-2.5px',
  '-webkit-touch-callout': 'none',
  '-webkit-user-select': 'none',
  '-khtml-user-select': 'none',
  '-moz-user-select': 'none',
  '-ms-user-select': 'none',
  'user-select': 'none'
};

Annotation.ELLIPSE_CSS = {
  'position' : 'absolute',
  'right' : '10px',
  'top' : '0px',
  'font-size' : '18px',
  '-webkit-touch-callout': 'none',
  '-webkit-user-select': 'none',
  '-khtml-user-select': 'none',
  '-moz-user-select': 'none',
  '-ms-user-select': 'none',
  'user-select': 'none',
  'pointer-events' : 'none'
};

Annotation.StylePresets = [
  { 'bg': '#111', 'color': '#fff' },
  { 'bg': 'rgba(0,0,0,0.6)', 'color': '#fff' },
  { 'bg': '#111', 'color': '#59cfe4' },
  { 'bg': 'rgba(0,0,0,0.6)', 'color': '#59cfe4' },
  { 'bg': '#fff', 'color': '#222' },
  { 'bg': 'rgba(255,255,255,0.6)', 'color': '#222' }
];

Annotation.prototype = new VAPI.VeroldComponent();

Annotation.prototype.css = function (el, key, value) {
  // if args length is 3, then el, property, value
  if (!el || !el.style) {
    return;
  }

  if(typeof key !== 'string') {
    for(var styleKey in key){
      el.style[styleKey] = key[styleKey];
    }
  }
  else {
    el.style[key] = value; 
  }
};
/************   START EDITOR RELATED THINGS  *******************/
Annotation.prototype.editorInit = function() {

  this.bIsEditor = true;
  this.bSceneLoaded = true;

  if ( this.getThreeData() ) {
    this.objectCreated();
  }
  else {
    this.getEntity().once('load_base', this.objectCreated, this );
  }

  this.listenTo(this.getEngine(), 'preRenderView', this.preRenderView.bind(this));

  //hide and show lables on selection in the studio
  this.listenTo(this.getEngine().globalEvents, 'studioApp::selectObject', this.hideNote.bind(this, true));
  this.listenTo(this.getEngine().globalEvents, 'studioApp::clearSelection', this.showNote.bind(this, false));
};

Annotation.prototype.editorShutdown = function() {
  this.shutdown();
};

Annotation.prototype.editorStartDrag = function(event, ui){
  this.bDragging = true;
  this.dragStartX = this.el.offsetLeft - event.pageX;
  this.dragStartY = this.el.offsetTop - event.pageY;
};

//get offset percentages
Annotation.prototype.editorDrag = function(event, ui){
  //renderContainer
  var left = this.dragStartX + event.pageX,
      top = this.dragStartY + event.pageY;

  this.Offset.x = (left - this.vWorldPos.x + this.elOffsetWidth*0.5) / this.offsetWidth;
  this.Offset.y = (this.vWorldPos.y - top - this.elOffsetHeight*0.5) / this.offsetHeight;
};

Annotation.prototype.editorEndDrag = function(event, ui) {
  this.bDragging = false;

  var update = { components : {  } };
  update.components[this.getId()] = { componentData : { } };
  update.components[this.getId()].componentData.Offset = { x : this.Offset.x, y : this.Offset.y };
  
  this.getEntity().set(update, { save : true });
};
/**************** ***********************************************/

//events in here for the event handler stuff!
Annotation.prototype.init = function(){
  
  if(window.VAPI && window.VAPI.isMobile()){
    Annotation.TEXT_CSS['font-size'] = '1.8vmax';
  }
  //showing
  this.listenTo(this.getEntity(), 'showAnnotation', this.setAllVis.bind(this, true));
  this.listenTo(this.getEntity(), 'showAnnotationDescription', this.setDescriptionVis.bind(this, true));
  this.listenTo(this.getEntity(), 'showAnnotationLine', this.setLineVis.bind(this, true));
  this.listenTo(this.getEntity(), 'showAnnotationPin', this.setPinVis.bind(this, true));
  this.listenTo(this.getEntity(), 'showAnnotationTag', this.setTagVis.bind(this, true));
  //hiding
  this.listenTo(this.getEntity(), 'hideAnnotation', this.setAllVis.bind(this, false));
  this.listenTo(this.getEntity(), 'hideAnnotationDescription', this.setDescriptionVis.bind(this, false));
  this.listenTo(this.getEntity(), 'hideAnnotationLine', this.setLineVis.bind(this, false));
  this.listenTo(this.getEntity(), 'hideAnnotationPin', this.setPinVis.bind(this, false));
  this.listenTo(this.getEntity(), 'hideAnnotationTag', this.setTagVis.bind(this, false));
  //events to change some stuffs!
  this.listenTo(this.getEntity(), 'changeAnnotationPinMaterial', this.setPinMaterial.bind(this));
  this.listenTo(this.getEntity(), 'toggleAnnotation', this.toggleVisibility.bind(this));
  this.listenTo(this.getEntity(), 'enableAnnotation', this.onEnable.bind(this));
  this.listenTo(this.getEntity(), 'disableAnnotation', this.onDisable.bind(this));

  /*  TESTING   */
  this.listenTo(this.getEvents(), 'showAnnotation', this.setAllVis.bind(this, true));
  this.listenTo(this.getEvents(), 'showAnnotationDescription', this.setDescriptionVis.bind(this, true));
  this.listenTo(this.getEvents(), 'showAnnotationLine', this.setLineVis.bind(this, true));
  this.listenTo(this.getEvents(), 'showAnnotationPin', this.setPinVis.bind(this, true));
  this.listenTo(this.getEvents(), 'showAnnotationTag', this.setTagVis.bind(this, true));
  //hiding
  this.listenTo(this.getEvents(), 'hideAnnotation', this.setAllVis.bind(this, false));
  this.listenTo(this.getEvents(), 'hideAnnotationDescription', this.setDescriptionVis.bind(this, false));
  this.listenTo(this.getEvents(), 'hideAnnotationLine', this.setLineVis.bind(this, false));
  this.listenTo(this.getEvents(), 'hideAnnotationPin', this.setPinVis.bind(this, false));
  this.listenTo(this.getEvents(), 'hideAnnotationTag', this.setTagVis.bind(this, false));
  //events to change some stuffs!
  this.listenTo(this.getEvents(), 'changeAnnotationPinMaterial', this.setPinMaterial.bind(this));
  this.listenTo(this.getEvents(), 'toggleAnnotation', this.toggleVisibility.bind(this));
  this.listenTo(this.getEvents(), 'enableAnnotation', this.onEnable.bind(this));
  this.listenTo(this.getEvents(), 'disableAnnotation', this.onDisable.bind(this));
};

/************  events listener functions    *****************/
Annotation.prototype.setDescriptionVis = function(visible){
  this.ShowDescription = visible;
  this.bNeedsUpdate = true;
};

Annotation.prototype.setLineVis = function(visible){
  this.ShowLine = visible;
  this.bNeedsUpdate = true;
};

Annotation.prototype.setPinVis = function(visible){
  this.Pin.visible = visible;
  this.bNeedsUpdate = true;
};

Annotation.prototype.setTagVis = function(visible){
  this.setLineVis(visible);
  this.setTagVisibility(visible);
  this.bNeedsUpdate = true;
};

Annotation.prototype.setAllVis = function(visible){
  this.setTagVis(visible);
  this.setDescriptionVis(visible);
  this.setLineVis(visible);
  this.setPinVis(visible);
};

Annotation.prototype.setTagVisibility = function(visible){
  this.m_bTagIsVisible = visible;
  this.bNeedsUpdate = true;
};

Annotation.prototype.toggleVisibility = function(){
  this.setAllVis(!this.pinObject.visible);
};

//triggered from the external events system
Annotation.prototype.setPinMaterial = function(material){

  var mat = this.getAssetRegistry().getAssetById(material);

  if(mat && this.pinObject){
    this.listenToOnce(mat, 'load', function(){
      this.pinObject.children[0].material = mat.threeData.static;
      this.pinObject.children[1].material = mat.threeData.static;
    }.bind(this));
    mat.load();
  }
};

Annotation.prototype.onDisable = function(){
  this.disable();
  this.bNeedsUpdate = true;
};

Annotation.prototype.onEnable = function(){
  this.enable();
  this.bNeedsUpdate = true;
};
/****************************************************************/

Annotation.prototype.objectCreated = function() {

  window.setTimeout(this.createPrimPin.bind(this), 500);

  this.renderContainer = this.getThreeRenderer().domElement.parentElement;

  this.offsetWidth = this.renderContainer.offsetWidth;
  this.offsetHeight = this.renderContainer.offsetHeight;

  var zIndex = (this.renderContainer.style['z-index'] << 0) + (this.bIsEditor ? 1 : 0);

  //creation of elements for storing title and description
  this.el = document.createElement('div');
  addClass(this.el, 'annotation-el');
  this.css(this.el, Annotation.EL_CSS);
  this.css(this.el, 'z-index', zIndex);

  this.title = document.createElement('div');
  addClass(this.title, 'annotation-title');
  this.css(this.title, Annotation.TEXT_CSS);
  this.css(this.title, 'font-weight', 'bold');
  this.css(this.title, 'max-width', '200px');
  this.css(this.title, 'padding', '0 10px 0 5px');

  this.el.appendChild(this.title);

  this.desc = document.createElement('div');
  addClass(this.desc, 'annotation-desc');
  this.css(this.desc, Annotation.TEXT_CSS);
  this.css(this.desc, 'font-weight', 'normal');
  this.css(this.desc, 'max-width', '250px');
  this.css(this.desc, 'padding', '0 0 0 5px');

  this.el.appendChild(this.desc);

  //the line that draws to the pin, from the box
  this.line = document.createElement('div');
  addClass(this.line, 'annotation-line');
  this.css(this.line, Annotation.LINE_CSS);
  this.css(this.line, 'z-index', zIndex);

  this.renderContainer.appendChild(this.line);
  this.renderContainer.appendChild(this.el);

  //add cap to line!
  this.cap = document.createElement('div');
  addClass(this.cap, 'annotation-cap');
  this.css(this.cap, Annotation.CAP_CSS);
  this.css(this.cap, 'z-index', zIndex);
  this.line.appendChild(this.cap);

  this.bCreated = true;
  this.bNeedsUpdate = true;

  //create global annotation raycaster!
  if(!VAPI.AnnotationCaster){
    VAPI.AnnotationCaster = new THREE.Raycaster();
    VAPI.AnnotationCaster.STEPS = 15;
  }

  this.ellipsis = document.createElement('div');
  addClass(this.ellipsis, 'annotation-ellips');
  this.ellipsis.innerHTML = '...';
  this.css(this.ellipsis, Annotation.ELLIPSE_CSS);
  this.el.appendChild(this.ellipsis);


  this.onHoverIn = this.onHoverIn.bind(this);
  this.onHoverOut = this.onHoverOut.bind(this);

  this.el.addEventListener('mouseover', this.onHoverIn);
  this.el.addEventListener('mouseout', this.onHoverOut);

  //editor specifics
  if(this.bIsEditor){
    //for calculating smart offsets
    this.vWorldPos = new THREE.Vector2();
    //set drag for
    this.el.draggable = true;
    this.el.addEventListener('dragstart', this.editorStartDrag.bind(this));
    this.el.addEventListener('drag', this.editorDrag.bind(this));
    this.el.addEventListener('dragend', this.editorEndDrag.bind(this));


    this.el.addEventListener('click', this.onEditorPinClick.bind(this));
  }
  else {
    this.el.addEventListener('click', this.onTagClick.bind(this));
  }

  //disable mouse events when scrolling(zooming in/out)
  this.el.addEventListener('wheel', function() {
    this.css(this.el, 'pointer-events', 'none');
  }.bind(this));

  //stop it from eating events if mouse down never happened on it!
  this.renderContainer.addEventListener('mousedown', function(e){ 
    if( e.srcElement !== this.el ){
      this.css(this.el, 'pointer-events', 'none');
      this.bCanvasDrag = true;
    }
  }.bind(this));
  this.renderContainer.addEventListener('mouseup', function(e){
    this.css(this.el, 'pointer-events', 'auto');
    this.bCanvasDrag = false;
  }.bind(this));
};

Annotation.prototype.sceneLoaded = function(){
  this.bSceneLoaded = true;
  this.attributesChanged();
};

//when the pin cap hover and element is selected, select the node instead
Annotation.prototype.onEditorPinClick = function(e){
  if(!this.bDragging)window.verold.veroldEvents.trigger( 'studioApp::setSelectionFromPickData', this.getEntity().id, event.button );
};

Annotation.prototype.onTagClick = function(){
  if(this.desc.innerHTML.trim().length) {
    toggleEl(this.desc, 100);
  }
};

Annotation.prototype.onHoverIn = function(e){

  if( (this.desc.innerHTML.trim().length || this.bIsEditor) && !this.bObjectSelected){
    var color = this.shadeColor2(this.bgColor, 0.25);
    this.css(this.el, 'background', color);
    this.css(this.line, 'background', color);
    this.css(this.cap, 'background', color);
  }
};

Annotation.prototype.onHoverOut = function(e){
  if(!this.bObjectSelected){
    this.css(this.el, 'background', this.bgColor);
    this.css(this.line, 'background', this.bgColor);
    this.css(this.cap, 'background', this.bgColor);
  }
};

//@param bSelctionTriggered : was this triggered by a selection
Annotation.prototype.hideNote = function(bSelectionTriggered){

  this.onHoverOut();

  this.css(this.el, 'opacity', '0.0');
  this.css(this.line, 'opacity', '0.0');

  if(typeof bSelectionTriggered !== 'undefined') {
    this.bObjectSelected = bSelectionTriggered;
  }
  this.css(this.el, 'pointer-events', 'none');
};

Annotation.prototype.showNote = function(bSelectionTriggered){
  this.css(this.el, 'opacity', '1');
  this.css(this.line, 'background-color', this.bgColor);
  this.css(this.line, 'opacity', '1.0');
  this.css(this.cap, 'opacity', '1.0');
  if(typeof bSelectionTriggered !== 'undefined') {
    this.bObjectSelected = bSelectionTriggered;
  }
  if(!this.bCanvasDrag) {
    this.css(this.el, 'pointer-events', 'auto'  );
  }
};

Annotation.prototype.createPrimPin = function(){
  //node
  var node = new THREE.Object3D();
  //head
  var headGeom = new THREE.SphereGeometry(0.15, 12, 12);
  headGeom.computeVertexNormals();
  headGeom.computeTangents();
  var head = new THREE.Mesh(headGeom);
  head.name = 'Pin_Piece';
  //cylinder
  var bodyGeom = new THREE.CylinderGeometry(0.14, 0.0, 0.3, 12, 2);
  bodyGeom.computeVertexNormals();
  bodyGeom.computeTangents();
  var body = new THREE.Mesh(bodyGeom);
  body.position.y -= 0.2;
  body.name = 'Pin_Piece';

  node.add(head);
  node.add(body);

  this.getThreeData().add(node);

  //for studio picking
  this.getEngine().globalEvents.trigger( 'studioApp::registerPickingObject', this.getEntity(), head );
  this.getEngine().globalEvents.trigger( 'studioApp::registerPickingObject', this.getEntity(), body );
  //for runtime picking
  this.getEngine().globalEvents.trigger( 'registerPickingObject', this.getEntity(), head );
  this.getEngine().globalEvents.trigger( 'registerPickingObject', this.getEntity(), body );

  this.pinObject = node;

  this.bNeedsUpdate = true;

  this.loadMat(Annotation.editor_mat_json, function(mat){
    head.material = mat;
  }.bind(this));

  this.loadMat(Annotation.head_mat_json, function(mat){
    body.material = mat;
  }.bind(this));

  this.attributesChanged();
};

Annotation.prototype.loadMat = function(json, onload){
  var mat = this.getAssetRegistry().getAssetById(json.id);
  if(mat){
    this.listenToOnce(mat, 'load', function(){
      onload(mat.threeData.static);
    });
    mat.load();
  }
  else {
    //create head mat
    this.getAssetRegistry().createAsset(json, {
      success : function(asset){
        this.listenToOnce(asset, 'load', function(){
          onload(asset.threeData.static);
        });
        asset.load();
      }.bind(this)
    });
  }
};

Annotation.prototype.entityIsVisible = function() {

  var threeData = this.getThreeData();

  var isVisible = threeData.visible;

  //traverse ancestors
  threeData.traverseAncestors( function(parent){
    if( !parent.visible ) isVisible = false;
  } );


  return isVisible;
};

Annotation.prototype.preRenderView = function( scene, camera, options ) {

  //every once and a while, check parents and self to see if visibility broken
  if(!this.entityIsVisible()){
    this.hideNote();
    if( this.bIsEditor ) {
      this.css( this.line, 'opacity', '0.0' );
    }
    return;
  }

  if (this.hasThreeData() && this.bCreated && this.isEnabled()) {

    //positioning of annotation elements!
    var threeData = this.getThreeData();
    if ( threeData.parent ) {
      this.tempMatrix.copy( threeData.matrixWorld );
    }
    else {
      this.tempMatrix.identity();
    }
    this.worldPosVec.setFromMatrixPosition( this.tempMatrix );

    this.tempVec.copy(this.worldPosVec);
    var screenPos = this.worldToScreen( this.tempVec, camera );
    screenPos.x = (Math.round(screenPos.x));
    screenPos.y = (Math.round(screenPos.y));

    if(this.bIsEditor) {
      this.vWorldPos.set(screenPos.x, screenPos.y);
    }

    //annotation visiblity using raycaster
    if(this.isInFOV && !this.bObjectSelected && this.pinObject && this.nRaySteps > VAPI.AnnotationCaster.STEPS){

      this.pinObject.visible = false;

      this.tempVec.copy(this.worldPosVec);
      VAPI.AnnotationCaster.ray.origin.copy(camera.position);
      VAPI.AnnotationCaster.ray.direction.copy(this.tempVec.sub(camera.position).normalize());
      VAPI.AnnotationCaster.far = this.worldPosVec.distanceTo(camera.position);
     // VAPI.AnnotationCaster.ray.freePool();
      this.intersects.length = 0;

      var intersects = VAPI.AnnotationCaster.intersectObjects(scene.children, true).filter(canHideFilter);
      //var intersects = VAPI.AnnotationCaster.intersectObjects(scene.children, true, this.intersects).filter(canHideFilter);
      var show = intersects.length === 0;

      if(show){
        this.showNote();
      }
      else {
        this.hideNote();
      }

      this.nRaySteps = 0;

      this.pinObject.visible = this.Pin.visible || this.bIsEditor;

      //since this doesn't happen very often, we'll update offsets here, as well
      this.offsetWidth = this.renderContainer.offsetWidth;
      this.offsetHeight = this.renderContainer.offsetHeight;
      this.elOffsetWidth = this.el.offsetWidth;
      this.elOffsetHeight = this.el.offsetHeight;
    }
    else {

      //percentage based offsets in screen space
      var offsetX = this.Offset.x * this.offsetWidth;
      var offsetY = this.Offset.y * this.offsetHeight;

      if(!this.bDragging) {

        if(!this.elCSSObj) {
          this.elCSSObj = {
            'left': '',
            'top': '',
          };
        }

        this.elCSSObj.left = (screenPos.x + offsetX - this.elOffsetWidth * 0.5) + 'px';
        this.elCSSObj.top = (screenPos.y - offsetY - this.elOffsetHeight * 0.5) + 'px';

        this.css(this.el, this.elCSSObj);
      }

      this.tempVec.set((screenPos.x + offsetX), (screenPos.y - offsetY));
      var length = this.getLength(screenPos.x, this.tempVec.x, screenPos.y, this.tempVec.y);
      var angle  = this.getAngle(screenPos.x, this.tempVec.x, screenPos.y, this.tempVec.y);

      if(!this.lineCSSObj) {
        this.lineCSSObj = {
          'transform': '',
          'left': '',
          'top': '',
          'width': ''
        };
      }

      this.lineCSSObj.transform = 'rotate('+angle+'deg)';
      this.lineCSSObj.left = (screenPos.x << 0) + 'px';
      this.lineCSSObj.top = (screenPos.y << 0) + 'px';
      this.lineCSSObj.width = length + 'px';

      this.css(this.line, this.lineCSSObj);

    }

    this.nRaySteps++;


    //for ball scaling
    if(this.pinObject && this.Pin.autoScale && this.pinObject.visible){
      var scale = 0.0;
      this.tempVec.setFromMatrixScale( this.getThreeData().matrixWorld );
      var parentWorldScale = this.tempVec.x;
      this.tempVec.setFromMatrixPosition( this.pinObject.matrixWorld );
      scale = this.tempVec.distanceTo( camera.position ) / 12;

      this.pinObject.scale.x = this.pinObject.scale.y = this.pinObject.scale.z = scale/parentWorldScale;
    }
  }

  //if update and needs attributes changed run
  if(this.bNeedsUpdate){
    this.bNeedsUpdate = false;
    this.attributesChanged();
  }

};

Annotation.prototype.worldToScreen = function(worldPosition, camera ) {

  var halfWidth = (( this.offsetWidth * this.DVP ) / 2) << 0,
    halfHeight = (( this.offsetHeight * this.DVP ) / 2) << 0;

  this.tempVec.copy(worldPosition);

  //check to see if object lies in view angle
  this.camForward.set( 0, 0, -1 ).applyQuaternion( camera.quaternion ).normalize();
  this.tempWorldPos.copy(worldPosition).sub(camera.position).normalize();//test point
  var dot = this.camForward.dot(this.tempWorldPos);//going to get the unsigned value

  var liesInView = Math.cos(camera.fov*0.0174532922222222) < dot;
  if(!liesInView){
    this.posVec.set(0,-1000000,0);
  }
  else {
    this.tempVec.project( camera );
    this.posVec.x = Math.round(this.tempVec.x * halfWidth + halfWidth) / this.DVP;
    this.posVec.y = Math.round(-this.tempVec.y * halfHeight + halfHeight) / this.DVP;
  }
  this.isInFOV = liesInView;
  return this.posVec;
};

Annotation.prototype.getLength = function(x1, x2, y1, y2){
  return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
};

Annotation.prototype.getAngle = function(x1, x2, y1, y2){
  return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
};

Annotation.prototype.attributesChanged = function(){

  var color, textColor;

  var styleIndex = this.Colors.styles >= 0 ? this.Colors.styles : 0;//if style is set to custom, use the first style

  var style = Annotation.StylePresets[styleIndex];
  color = style.bg;
  textColor = style.color;


  this.bgColor = color;

  //title html attributes
  if(this.title) {
    this.css(this.title, 'color', textColor);
    this.title.innerHTML = VAPI.safeHTML( this.Title );
  }

  //description html attributes
  if(this.desc) {
    if(this.ShowDescription  && this.isEnabled()){
      showEl(this.desc, 100);
    }
    else {
      hideEl(this.desc, 100);
    }
    this.css(this.desc, 'color', textColor);
    this.desc.innerHTML = VAPI.safeHTML( this.Description );
  }

  if(this.line){
    this.css(this.line, 'display', this.ShowLine && this.isEnabled() ? 'block' : 'none');
    this.css(this.line, 'background', color);
    this.css(this.cap, 'background', color);
  }

  if(this.pinObject){
    this.pinObject.visible = (this.Pin.visible || this.bIsEditor) && this.isEnabled();//if in editor, just show it!

    if(!this.Pin.autoScale){
      this.pinObject.scale.set(0.3,0.3,0.3);
    }

    if(this.bIsEditor && !this.Pin.visible) {
      this.setPinMaterial(Annotation.editor_mat_json.id);
      this.pinObject.children[1].visible = false;
    }
    else if(this.Pin.material) {
      this.setPinMaterial(this.Pin.material.id);
      this.pinObject.children[1].visible = true;
    }
    else {
      this.setPinMaterial(Annotation.head_mat_json.id)
      this.pinObject.children[1].visible = true;
    }
  }

  this.css(this.ellipsis, 'color', this.shadeColor2(this.bgColor, 0.4));

  //hide or show annotation, depending if content is available
  if(this.el){
    var show = this.m_bTagIsVisible && this.isEnabled();
    if(show){
      showEl(this.el, 0);
    }
    else {
      hideEl(this.el, 0);
    }
    this.css(this.el, 'background', color);
  }

  //hide/show ellipses if a description exists
  if( this.Description ){
    showEl(this.ellipsis);
    this.css(this.title, 'padding-right', '40px');
  }
  else {
    hideEl(this.ellipsis);
    this.css(this.title, 'padding-right', '10px');
  }

  //if we've disabled the component, hide it!
  if( !this.isEnabled() || !this.bSceneLoaded ){
    this.hideNote(false);
  }
  else {
    this.showNote(false);
  }
};

//taken from this awesome post(it's my favorite)
//http://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
Annotation.prototype.shadeColor2 = function(color, percent) {
  if(color === '#fff' || color === '#ffffff')return color;
  var f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
  return '#'+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
};

Annotation.prototype.shutdown = function() {
  this.el.removeEventListener('mouseenter', this.onHoverIn);
  this.el.removeEventListener('mouseexit', this.onHoverOut);

  this.cap.remove();
  this.line.remove();
  this.title.remove();
  this.desc.remove();
  this.el.remove();

  if(this.pinObject){
    this.getThreeData().remove(this.pinObject);
    var children = this.pinObject.children;
    for(var child in children){
      if( children.hasOwnProperty( child ) ) {
        this.getEngine().globalEvents.trigger( 'studioApp::unregisterPickingObject', this.pinObject, children[child]);
        this.getEngine().globalEvents.trigger( 'unregisterPickingObject', this.pinObject, children[child]);
        children[child].geometry.dispose();
      }
    }
  }
};

Annotation.head_mat_json = {
  'id':'pin_head_material',
  'type':'material',
  'name':'Pin Head Material',
  'payload':{'polygonOffset':false,'depthTest':true,'fog':true,'depthWrite':true,'side':0,'blending':1,'diffuseColor':15344585, 'Features':{'Lighting':{'enabled':false},'Diffuse Color':{'enabled':true},'Rim Lighting':{'enabled':false},'Specular':{'enabled':false},'Reflections':{'enabled':false},'Emissive':{'enabled':false}},'visible':true,'materialType':'Simple','colorOpacity':1.0,'specularColor':16777215,'specularIntensity':9.565217391304348,'gloss':0.7739130434782608}
};

Annotation.editor_mat_json = {
  'id':'pin_editor_material',
  'type':'material',
  'name':'Pin Editor Material',
  'payload':{'polygonOffset':false,'depthTest':true,'fog':true,'depthWrite':true,'side':0,'blending':1,'diffuseColor':0xCAC1CC, 'Features':{'Lighting':{'enabled':true},'Diffuse Color':{'enabled':true},'Rim Lighting':{'enabled':false},'Specular':{'enabled':false},'Reflections':{'enabled':false},'Emissive':{'enabled':false}},'visible':true,'materialType':'Simple','colorOpacity':1.0,'specularColor':16777215,'specularIntensity':9.565217391304348,'gloss':0.7739130434782608}
};

THREE.Ray.prototype.at = function(){
  var vec3 = new THREE.Vector3();

  return function ( t, optionalTarget ) {

    var result = optionalTarget || vec3.set(0,0,0);

    return result.copy( this.direction ).multiplyScalar( t ).add( this.origin );

  };

}();

return Annotation;
});