
// Core OpenLayers
import 'ol/ol.css';
import { Map, View } from 'ol';
import { fromLonLat } from 'ol/proj';
import { get as getProjection } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import { platformModifierKeyOnly, altShiftKeysOnly, shiftKeyOnly, targetNotEditable } from 'ol/events/condition';
import { defaults as defaultInterctions, MouseWheelZoom, DragPan, DragRotate, KeyboardZoom, KeyboardPan } from 'ol/interaction';

//Layers
import './layers/layers.mjs';

//OTLB
// Browser prototype extensions
import 'oltb/src/oltb/js/browser-prototypes/json-cycle';
import 'oltb/src/oltb/js/browser-prototypes/string';
import 'oltb/src/oltb/js/browser-prototypes/slide-toggle';

// Core Toolbar
import 'oltb/src/oltb/scss/oltb.scss';


//import { Tile } from 'ol/layer';
//OGC ImageTile
import ImageTile from 'ol/source/ImageTile.js';

//Vector Tile Layer and VectorTileSource
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import MVT from 'ol/format/MVT.js'; //MapBox vector tiles, using PBF (Protocol Buffer Binary format for speed)

//Vector Layers
import VectorLayer from 'ol/layer/Vector.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import VectorSource from 'ol/source/Vector.js';

import { LayerManager } from 'oltb/src/oltb/js/toolbar-managers/layer-manager/layer-manager';

const topo50_layer=new Tile({
    source: new ImageTile({
        url: 'https://tiles-cdn.koordinates.com/services;key=20b10a680c3742798647ec56775918a4/tiles/v4/layer=50767/EPSG:3857/{z}/{x}/{y}.png',
         }),
    });
            
const pg_test= new VectorTileLayer({
    source: new VectorTileSource({
        format: new MVT(),
        url: 'http://localhost:7800/public.parcels_3857/{z}/{x}/{y}.pbf?filter=live=true',
        }),
});

const pg_test_geojson=new VectorLayer({
    source: new VectorSource({
        format: new GeoJSON(),
        url: 'http://localhost:9050/collections/public.parcels_3857/items.json?filter=live=true',
    }),    
});

/*Global variables - not ideal, but needed for now
*
*/
//Map click pixel holds the last clicked map pixel coordinates - used as a form of pseudo-state for the spatial location of any layer underneath the click
//This works even when the underlying layers change in the database and when the mouse moves, as only the mouse clicks on the map are stored in this variable. 
var map_click_pixel;

//Import layers



const map = new Map({
  layers: [topo50_layer, pg_test,pg_test_geojson],
  //layers: [pg_local_wdc_parcels_test],
  target: 'map',
  view: new View({
    center: [19194331.438878052,-5355299.9339601565],
    zoom: 4,
    //projection: getProjection(OLTB.ConfigManager.getConfig().projection.default)
  }),
});



//map.getView().setCenter(lonlat);
//map.getView().setZoom(zoom);

let select = null; // ref to currently selected interaction

const selected = new Style({
  fill: new Fill({
    color: '#eeeeee',
  }),
  stroke: new Stroke({
    color: 'rgba(255, 255, 255, 0.7)',
    width: 2,
  }),
});

function selectStyle(feature) {
  const color = feature.get('COLOR') || '#eeeeee';
  selected.getFill().setColor(color);
  return selected;
}

// select interaction working on "singleclick"
const selectSingleClick = new Select({style: selectStyle});

// select interaction working on "click"
const selectClick = new Select({
  condition: click,
  style: selectStyle,
});

// select interaction working on "pointermove"
const selectPointerMove = new Select({
  condition: pointerMove,
  style: selectStyle,
});

const selectAltClick = new Select({
  style: selectStyle,
  condition: function (mapBrowserEvent) {
    return click(mapBrowserEvent) && altKeyOnly(mapBrowserEvent);
  },
});


/** 
 * Code for clicking on a feature and getting information from it
*/

//function clickQuery() {
  //const mapTarget = map.getTargetElement();
  //mapTarget.addEventListener('click', showInfo);

  map.on('click', function (evt) {
    if (evt.dragging) {
      return;
    }
    showInfo(evt);
  });

  const info = document.getElementById('info');

  function showInfo(event) {
    const features = pg_local_wdc_parcels_test.getFeatures(event.pixel).then (function(features){
      //if (features.length == 0) {
        //info.innerText = '';
        //info.style.opacity = '0';
      //return;}

      //This global variable stores the pixel state - i.e. where has a user clicked - on the map
      //It is quasi-state for the application
      map_click_pixel=event.pixel;

      const properties = features[0].getProperties();
      //info.innerText = JSON.stringify(properties, null, 2);
      //info.style.opacity = '1';

      //Update the dynamic form
      generateFormFromJSON(properties,'info');

    })};
    
    
    /*Generate the dynamic forms for data entry based off the map feature JSON
    TO DO: Carrying over the GeoJSON in some form so it can be seen?
    */
    
    function generateFormFromJSON(jsonObject, containerId) {
      const form = document.createElement('form');
      form.id = 'dynamicForm';
      //form.method='POST';  
      //form.action='/api/submit';

      //Flags for setting visibility of rollforward and rollback buttons
      var key_flag_rollforward=false; 
      var key_flag_rollback=false; 

      for (const [key, value] of Object.entries(jsonObject).sort()) {
        const label = document.createElement('label');
        label.setAttribute('for', key);
        label.textContent = key + ': ';

        const input = document.createElement('input');
        input.type = 'text';
        input.name = key;
        input.id = key;
        input.value = value;

        if (label.textContent!='layer: ') {
          label.appendChild(input);
          form.appendChild(label);
        }  

        // Line break for readability
        form.appendChild(document.createElement('br'));

        //Key flag
        //If there is a next_id with a populated value, then the roll-forward button becomes visible
        if (key=='next_id' & value!=='') {key_flag_rollforward=true} 
        //If there is a previous_id with a populated value, then the roll-backward button becomes visible 
        if (key=='previous_id' & value!=='') {key_flag_rollback=true} 
      }

      // Submit buttons
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.textContent = 'Submit changes';
      
      const rollback = document.createElement('button');
      rollback.type = 'button';
      rollback.textContent = 'Roll back to previous';

      const rollforward = document.createElement('button');
      rollforward.type='button';
      rollforward.textContent='Roll forward to next';
      
      //Set visibility of the rollforward button based on the key_flags defined above
      if (key_flag_rollforward) {rollforward.style.visibility='visible';}
      else {rollforward.style.visibility='hidden';}

      //Set visibility of the rollback button based on the key_flags defined above
      if (key_flag_rollback) {rollback.style.visibility='visible';}
      else {rollback.style.visibility='hidden';}

      //Add buttons to the dynamic form

      form.appendChild(submit);
      form.appendChild(document.createElement('br'));
      form.appendChild(rollback);
      form.appendChild(document.createElement('br'));
      form.appendChild(rollforward);
      

      // Add to container
      const container = document.getElementById(containerId);
      container.innerHTML = ''; // Clear previous
      container.appendChild(form);

      // Handle submit
      form.onsubmit = async function(e) {
      e.preventDefault();
  
      try {
        const form = document.getElementById('dynamicForm');
        const formData = new FormData(form);

        if (!form) {
          console.error(`Form with ID not found.`);
          return;
        }
        
        const response = await fetch('/api/submit', {
          method: 'POST',
          body: formData,
          params: 'parcels_3857',
          //Uses default MIME types etc
        });
        const data = await response.json();
        //document.getElementById('info').textContent = data.success
        //Effectively reclick the same parcel to update the form with the new database record
        //Database maintaining state. 
        //showInfo(this.event)
        pg_local_wdc_parcels_test.getSource().refresh();

        //Hacky way of refreshing the form  
        generateFormFromJSON(map.getFeaturesAtPixel(map_click_pixel,pg_local_wdc_parcels_test.getSource()),'info');


          
      } catch (err) {
        alert('Error: '+err);
      }
    }

    // Handle button click for the rollback button
    rollback.onclick = async function(e) {
      e.preventDefault();
      
      try {
        const form = document.getElementById('dynamicForm');
        const formData = new FormData(form);
    
        if (!form) {
          console.error(`Form with ID not found.`);
          return;
        }
            
            const response = await fetch('/api/rollback', {
              method: 'POST',
              body: formData,
              params: 'parcels_3857',
              //Uses default MIME types etc
            }).then(response=> {
              if (response.ok) {
                //Refresh map
                pg_local_wdc_parcels_test.getSource().refresh();
                //Hacky way of refreshing the form using the global pixel variable - but it does work. 
                generateFormFromJSON(map.getFeaturesAtPixel(map_click_pixel,pg_local_wdc_parcels_test.getSource()),'info');
                return response.json(); 
              };
            }).catch (error=> {
              alert('Error: '+error);
            })
      }
      catch (err) {
        alert('Error'+err);
      }
    }
// Handle button click for the rollforward button
rollforward.onclick = async function(e) {
  e.preventDefault();
  
  try {
    const form = document.getElementById('dynamicForm');
    const formData = new FormData(form);

    if (!form) {
      console.error(`Form with ID not found.`);
      return;
    }
        
        const response = await fetch('/api/rollforward', {
          method: 'POST',
          body: formData,
          params: 'parcels_3857',
          //Uses default MIME types etc
        });
        const data = await response.json();
        //document.getElementById('info').textContent = data.success
        //Effectively reclick the same parcel to update the form with the new database record
        //Database maintaining state. 
        //showInfo(this.event)
        pg_local_wdc_parcels_test.getSource().refresh();

        //Hacky way of refreshing the form  
        //generateFormFromJSON(map.getFeaturesAtPixel(map_click_pixel,pg_local_wdc_parcels_test.getSource()),'info');

          
      } catch (err) {
        alert('Error: '+err);
      }
  }


  return; 

}

//clickQuery();

/*
const selectElement = document.getElementById('type');

const changeInteraction = function () {
  if (select !== null) {
    map.removeInteraction(select);
  }
  const value = selectElement.value;
  if (value == 'singleclick') {
    select = selectSingleClick;
  } else if (value == 'click') {
    select = selectClick;
  } else if (value == 'pointermove') {
    select = selectPointerMove;
  } else if (value == 'altclick') {
    select = selectAltClick;
  } else {
    select = null;
  }
  if (select !== null) {
    map.addInteraction(select);
    select.on('select', function (e) {
      document.getElementById('status').innerHTML =
        '&nbsp;' +
        e.target.getFeatures().getLength() +
        ' selected features (last operation selected ' +
        e.selected.length +
        ' and deselected ' +
        e.deselected.length +
        ' features)';
    });
  }
};

/**
 * onchange callback on the select element.
 
selectElement.onchange = changeInteraction;
changeInteraction();
*/
//NEEDS CODE TO TURN IT ON AND OFF BASED ON A SIDE PANEL
/*

const modify = new Modify({source: source});
map.addInteraction(modify);

let draw, snap; // global so we can remove them later
const typeSelect = document.getElementById('type');

function addInteractions() {
  draw = new Draw({
    source: source,
    type: typeSelect.value,
  });
  map.addInteraction(draw);
  snap = new Snap({source: source});
  map.addInteraction(snap);

  //Add drag and rotate
  //dragRotateAndZoom=new DragRotateAndZoom();
  map.addInteraction(new DragRotateAndZoom);
}

/**
 * Handle change event.
 */
/*
typeSelect.onchange = function () {
  map.removeInteraction(draw);
  map.removeInteraction(snap);
  addInteractions();
};

addInteractions();
*/
