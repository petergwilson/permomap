    // Core OpenLayers
    import 'ol/ol.css';
    import { Map, View } from 'ol';
    import { fromLonLat } from 'ol/proj';
    import { get as getProjection } from 'ol/proj';
    import { defaults as defaultControls } from 'ol/control';
    import { platformModifierKeyOnly, altShiftKeysOnly, shiftKeyOnly, targetNotEditable } from 'ol/events/condition';
    import { defaults as defaultInterctions, MouseWheelZoom, DragPan, DragRotate, KeyboardZoom, KeyboardPan } from 'ol/interaction';
    
    //NZTM
    import { register } from 'ol/proj/proj4';
    import proj4 from 'proj4';

    //Layers
    import '../layers/layers.mjs';

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
    import TileLayer from 'ol/layer/Tile.js';
    import OSM from 'ol/source/OSM.js';
    import TileWMS from 'ol/source/TileWMS.js';
    import XYZ from 'ol/source/XYZ.js';
    import Google from 'ol/source/Google';
    import Layer from 'ol/layer/WebGLTile.js';

    //Vector Tile Layer and VectorTileSource
    import VectorTileLayer from 'ol/layer/VectorTile.js';
    import VectorTileSource from 'ol/source/VectorTile.js';
    import MVT from 'ol/format/MVT.js'; //MapBox vector tiles, using PBF (Protocol Buffer Binary format for speed)

    //Vector Layers
    import VectorLayer from 'ol/layer/Vector.js';
    import GeoJSON from 'ol/format/GeoJSON.js';
    import VectorSource from 'ol/source/Vector.js';

    //Style
    import Style from 'ol/style/Style.js';

    //Fill
    import Fill from 'ol/style/Fill.js';

    //Stroke
    import Stroke from 'ol/style/Stroke.js';

    //Select
    import Select from 'ol/interaction/Select.js';

    //Snap
    import Snap from 'ol/interaction/Snap.js';

    //Draw and Modify
    import Draw from 'ol/interaction/Draw.js';
    import Modify from 'ol/interaction/Modify.js';

    //Interactions
    import {defaults as defaultInteractions} from 'ol/interaction/defaults.js';

    //Controls
    import Control from 'ol/control/Control.js';

    //Attribution
    import Attribution from 'ol/control/Attribution.js';

    //LineString
    import { LineString } from 'ol/geom';

    //Icons
    import Icon from 'ol/style/Icon';
    //import Style from 'ol/style/Style';

    //Import layers

  //Assign info DOM element 
  const editorDiv = document.getElementById('info');
  
  //Assign modify DOM element
  //const modify_element=document.getElementById("modify").addEventListener('click',modify_click);

  //proj4.defs("EPSG:2193","+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
  //proj4.defs("EPSG:2193","+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs");
  
  //register(proj4);

//Global declarations for window login variables
//HACKY WILL FIX LATER

var geojson=new GeoJSON;

var login_details={
    name: '',
    email: '',

};
  

const modal = document.getElementById("loginModal");
const loginBtn = document.getElementById("login");
const closeBtn = document.querySelector(".close");
const loginForm = document.getElementById("loginForm");
const loginSubmitButton = document.getElementById("login_submit_button");

loginBtn.addEventListener("click", () => {
    modal.style.display = "block";
});

closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
});

window.addEventListener("click", (event) => {
    if (event.target === modal) {
        modal.style.display = "none";
    }
});

loginSubmitButton.addEventListener("click", (event) => {
    //event.preventDefault(); // Prevent actual form submission
    // Here you can add your login logic

    //Get login form info
    //HACKY BUT WORKS

    //GET LOGIN INPUT FIELDS
    
    var login_name_element=document.getElementById("login_name");
    var login_email_element=document.getElementById("login_email");
    var login_password_element=document.getElementById("login_password");

    //Check for blanks, if not blank, enter data
    //Including existing data
    //alert()

    //Populate input fields, if exist

    if (login_name_element.value!='' & login_password_element.value=='permolat_test') {   
        
        //Update global storage for login
        //REPLACE WITH COOKIES EVENTUALLY

        //alert(JSON.stringify(myLogin));

        //Object.assign(window.geojson,myLogin);

        //Login JSON
        login_details.name=login_name_element.value;
        login_details.email=login_email_element.value;

        //window.geojson["login_email"]=;
        //window.geojson["login_password"]=login_email_element.value;

        //Enable save, rollfoward, rollback buttons
        //ONLY WORKS FOR ROLLFORWARD AND ROLLBACK BUTTONS WHERE THEY ARE IN A FEATURE ALREADY OPEN
        //WHEN LOGIN CLICKED
        //OTHERWISE TEST FOR LOGIN WHEN THESE ARE LOADED
        //saveButton.disabled=false;
        //rollForward.disabled=false;
        //rollBack.disabled=false; 

        //add login info to geojson object
        //populate form with window.geojson.login_name 
        //login_name_element.value=window.geojson.login_name;
        //login_email_element.value=window.geojson.login_email;
        //login_password_element.value=window.geojson.login_password;

        document.getElementById("username_field").innerHTML="User: "+login_name_element.value+" Logged in";

        //Test login variables 
        //alert(window.geojson.login_name);

        alert("Login successful");

    } else {
        alert("Login / password unsuccessful");

    }
    
    modal.style.display = "none";


});

  //Assign login DOM element

  //const login_element=document.getElementById("login").addEventListener('click',login_click);

  //DOC Huts
  const iconStyle_hut = new Style({
    image: new Icon({
      src: '../images/house-xxl.png', // Path to your icon image
      anchor: [0.5, 1], // Anchor point of the icon (center bottom)
      scale: 1, // Scale of the icon
    }),
  });

  const pg_doc_huts = new VectorLayer({
    // /background: 'white',
    source: new VectorSource({
        //ONLY ASK FOR SOME PROPERTIES TO AVOID FILLING UP FORMS
        //CAN BE CHANGED
        url: 'http://localhost:9050/collections/public.doc_huts/items.json?limit=1000',
        format: new GeoJSON(),
        wrapX: false,
        name: 'DOC Huts',
        ZIndex:5,
        //projection: 'EPSG:2193',
    }),
    style: function (feature, resolution) {
        const scale = 2 / Math.pow(resolution, 1 / 3);
        iconStyle_hut.getImage().setScale(scale);
        return iconStyle_hut;
      }
    });

  //Google Aerial

  const googleLayer = new Layer({
    source: new Google({
      key: 'AIzaSyDU2yD_zlCijJd1j9vOenPfsUiF-zT5cM8',
      mapType: 'satellite', // or 'hybrid', 'terrain'
      scale: 'scaleFactor2x',
      highDpi: true,
      //projection: 'EPSG:2193',
    }),
    visible: true,
    name: 'Google Satellite',
  });

  //Google Image Control
  //NEEDS TO REMAIN HERE CONSISTENT WITH GOOGLE MAPS API LICENSE
  class GoogleLogoControl extends Control {
    constructor() {
      const element = document.createElement('img');
      element.style.pointerEvents = 'none';
      element.style.position = 'absolute';
      element.style.bottom = '5px';
      element.style.left = '5px';
      element.src =
        'https://developers.google.com/static/maps/documentation/images/google_on_white.png';
      super({
        element: element,
      });
    }
  }

  //Openlayers attribution control
  //Google Image Control
  //NEEDS TO REMAIN HERE CONSISTENT WITH GOOGLE MAPS API LICENSE
  const attribution = new Attribution({
    collapsible: true, // Or true for collapsible on small maps
    attributions: `<a href="https://openlayers.org"><img src="https://openlayers.org/theme/img/logo-dark.svg" alt="OpenLayers"> OpenLayers</a>
    <a href="http://www.doc.govt.nz"><img src="https://www.doc.govt.nz/static/doc-front-end/assets/resources/doc-main-logo-white-Bx_-BN86.svg" alt="Department of Conservation"> Department of Conservation</a>
    <em>Contains data sourced from the <a href="https://data.linz.govt.nz/" rel="nofollow noreferrer" class="ext" data-extlink="" aria-label="(link is external)">LINZ Data Service<span class="fa-ext extlink" role="img" aria-hidden="false"><span class="icon icon--external" data-extlink-placement="append"></span></span></a> licensed for reuse under <a href="https://creativecommons.org/licenses/by/4.0/" rel="nofollow noreferrer" class="ext" data-extlink="" aria-label="(link is external)">CC BY 4.0<span class="fa-ext extlink" role="img" aria-hidden="false"><span class="icon icon--external" data-extlink-placement="append"></span></span></a></em>
    `
  });

  //LINZ Aerial
  const linz_aerial=new TileLayer({
        source: new ImageTile({
            url: 'https://basemaps.linz.govt.nz/v1/tiles/aerial/3857/{z}/{x}/{y}.png?api=20b10a680c3742798647ec56775918a4'
        }),
        ZIndex:1,
  })


    const topo50_layer=new TileLayer({
        source: new ImageTile({
            url: 'https://tiles-cdn.koordinates.com/services;key=20b10a680c3742798647ec56775918a4/tiles/v4/layer=50767/EPSG:3857/{z}/{x}/{y}.png',
            }),
            ZIndex:1,
        });

       // Create a style function for DOC layer
       var lightStroke_doc = new Style({
        stroke: new Stroke({
          color: 'rgba(13, 255, 0, 0.99)',
          width: 3,
          lineDash: [4,8],
          lineDashOffset: 6
        })
      });
      
      var darkStroke_doc = new Style({
        stroke: new Stroke({
          color: 'rgba(244, 248, 6, 0.96)',
          width: 3,
          lineDash: [4,8]
        })
      });
      /*
       const pg_test_doc = (feature) => {
        return new Style({
            fill: new Fill({
            color: 'rgb(157, 255, 0)'
            }),
            stroke: new Stroke({
            color: 'rgba(246, 250, 6, 0.7)',
            width: 4,
            }), 
        });
        };
        */

    //DOC Tracks as an XYZ tilelayer
    //Harder to style and can't query them
    //However DOC don't show closed tracks.
    //LINZ do. 
    const doc_tracks=new TileLayer({
        source: new XYZ({
            url:'http://koordinates-tiles-{a-c}.global.ssl.fastly.net/services;key=185d27c950b846e4b3fcb63d6321930b/tiles/v4/layer=753/EPSG:2193/{z}/{x}/{y}.png',
            }),
        ZIndex:2,
        style: [lightStroke_doc, darkStroke_doc],
        name: 'doc_tracks',
        });
        
    //LINZ Topo50 tracks

        

    /*            
    const pg_test= new VectorTileLayer({
        source: new VectorTileSource({
            format: new MVT(),
            url: 'http://localhost:7800/public.nz_primary_parcels/{z}/{x}/{y}.pbf',
            }),
    });
    */
   //Permolat style

   var lightStroke_permolat = new Style({
    stroke: new Stroke({
      color: 'rgba(255, 255, 255, 0.99)',
      width: 3,
      lineDash: [4,8],
      lineDashOffset: 6
    })
  });
  
  var darkStroke_permolat = new Style({
    stroke: new Stroke({
      color: 'rgba(255, 0, 0, 0.99)',
      width: 3,
      lineDash: [4,8]
    })
  });

    // Create a style function
    /*
    const pg_test_stylefunction = (feature) => {
    return new Style({
        fill: new Fill({
        color: 'rgba(248, 2, 2, 0.99)'
        }),
        stroke: new Stroke({
        color: 'rgb(255, 255, 255)',
        width: 1,
        }), 
    });
    };
    */

    const pg_test = new VectorLayer({
    // /background: 'white',
    source: new VectorSource({
        //ONLY ASK FOR SOME PROPERTIES TO AVOID FILLING UP FORMS
        //CAN BE CHANGED
        url: 'http://localhost:9050/collections/public.permolat_tracks/items.json?limit=1000&properties=lastcut,nextcut,geom,id,trackname,layer_name,importance,tracktype,currentcon,custodian,next_id,prev_id,history&filter=live=true',
        format: new GeoJSON(),
        wrapX: false,
        name: 'permolat_tracks',
        //projection: 'EPSG:2193',
    }),
    style: [lightStroke_permolat, darkStroke_permolat],
    });

    const pg_doc = new VectorLayer({
        // /background: 'white',
        source: new VectorSource({
            url: 'http://localhost:9050/collections/public.doc_tracks/items.json?limit=1000',
            format: new GeoJSON(),
            wrapX: false,
            //projection: 'EPSG:2193',
        }),
        style: [lightStroke_doc, darkStroke_doc],
        });
    
    
    /*Global variables - not ideal, but needed for now
    *Map click pixel holds the last clicked map pixel coordinates - used as a form of pseudo-state for the spatial location of any layer underneath the click
    *This works even when the underlying layers change in the database and when the mouse moves, as only the mouse clicks on the map are stored in this variable. 
    */
    window.map_click_pixel=0;

    //Global variable for holding layerName
    window.layerName='';

    //Global variable for holding login information
    window.login_name='';
    window.login_email='';

    //Global variable for coordinates
    window.coordinates=0;
    window.zoomLevel=0;

    //Global boolean for drawing
    ///FLAG AS FALSE ON LOAD
    window.drawing=false; 
    window.draw=Object;
    


    //Simple spatial stats
    //Fetch from database
    fetch('/api/total_length') // Endpoint for the total_length query. 
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.success}`);
    }
    
    return response.json();
  })
  .then(response => {
    console.log('Data received:', response.data.length);
    //alert(JSON.stringify(data));
    // Process the data here
    const contentElement = document.getElementById('total_length'); // Replace with the ID of your HTML element
    contentElement.innerHTML=response.data.length;
  })
  .catch(error => {
    console.error('Fetch error:', error);
    // Handle errors here
  });
  

    async function savebutton_onclick(e) {
        //Will need something in here that stops saving unless select is clicked. 

        try {
        //Add login details to the geojson to send to the server

        Object.assign(window.geojson,login_details);

        //Send to server
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
              },
            body: JSON.stringify(window.geojson),
            //application/json
        
            //SEND LAYER NAME IN params for server handling
            params: JSON.stringify(layerName),
            //Uses default MIME types etc
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

        const responseData = await response.json();
        //alert(JSON.stringify(responseData));
        //Reclick/load layer
        
        //source.changed(); //Another way to redraw lauyer
        pg_test.getSource().changed(); // Redraw the layer
        pg_test.getSource().refresh(); // Redraw the layer
        reloadMapAtCurrentLocation(map);

        //reload map
        //map.render();

        return responseData;

        } catch (error) {
            console.error('Error during fetch operation:', error);
            throw error; // re-throw the error to be handled by the caller
        }
    
        //document.getElementById('info').textContent = data.success
        //Effectively reclick the same parcel to update the form with the new database record
        //Database maintaining state. 
        //showInfo(this.event)
        //pg_test.getSource().refresh();
    //}
    }//end saveButton

    //Click function for the rollback button
    async function rollback_onclick(e) {
        e.preventDefault();
        try {
            //Add login details to the geojson to send to the server

            Object.assign(window.geojson,login_details);

            const response = await fetch('/api/rollback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
              },
            body: JSON.stringify(window.geojson),
            //application/json
        
            //SEND LAYER NAME IN params for server handling
            params: JSON.stringify(layerName),
            //Uses default MIME types etc
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();

            //source.changed(); //Another way to redraw lauyer
            pg_test.getSource().changed(); // Redraw the layer
            pg_test.getSource().refresh(); // Redraw the layer
            reloadMapAtCurrentLocation(map);

            //Make rollforward div hidden
            rollbackControlDiv.style.visibility='hidden';

            return responseData;

        } catch (error) {
            console.error('Error during fetch operation:', error);
            throw error; // re-throw the error to be handled by the caller
        }
        
    }//end rollback

    // Handle button click for the rollforward button
   async function rollforward_onclick(e)  {
        e.preventDefault();

        //Add login details to the geojson to send to the server

        Object.assign(window.geojson,login_details);


        try {
            const response = await fetch('/api/rollforward', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
              },
            body: JSON.stringify(window.geojson),
            //application/json
        
            //SEND LAYER NAME IN params for server handling
            params: JSON.stringify(layerName),
            //Uses default MIME types etc
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();

            //source.changed(); //Another way to redraw lauyer
            pg_test.getSource().changed(); // Redraw the layer
            pg_test.getSource().refresh(); // Redraw the layer
            reloadMapAtCurrentLocation(map);

            //Make rollforward div hidden
            rollforwardControlDiv.style.visibility='hidden';


            //map.updateSize(); //update map

            return responseData;

        } catch (error) {
            console.error('Error during fetch operation:', error);
            throw error; // re-throw the error to be handled by the caller
        }
    }//end rollforward click function

    // Drawing
    const typeSelect = document.getElementById('type');


    /**
    * Handle change event.
    */
  

   //addInteraction();


    const selectStyle = new Style({
        fill: new Fill({
            color: '#FFFF00',
        }),
        stroke: new Stroke({
            color: 'rgb(251, 255, 0)',
            width: 3,
        }),
    });

    // select interaction working on "singleclick"
    const selectInteraction = new Select({
        //Choose layers to select
        layers: [pg_test, pg_doc],
        style: selectStyle});

    /*
    function selectStyle(feature) {
        const color = feature.get('COLOR') || '#eeeeee';
        selected.getFill().setColor(color);
        return selected;
    }
    */


    //ADD MODIFY
    //WILL NEED TO BE LINKED TO THE LOGIN FUNCTIONALITY


    const modifyInteraction = new Modify({
        features: selectInteraction.getFeatures(),
    });


    /*
    *Vanilla JS version
    */


//Add save control

// CSS for positioning the control
// 1. Create the Control Element
const saveControlDiv = document.createElement('div');
saveControlDiv.className = 'custom-save-control';
saveControlDiv.innerHTML = '<button>Save edits</button>';

// 2. Define the Control Class
class SaveControl extends Control {
  constructor(opt_options) {
    const options = opt_options || {};
    super({
      element: saveControlDiv,
      target: options.target,
    });

    // Add event listener to the button
    saveControlDiv.querySelector('button').addEventListener('click',savebutton_onclick);
  }
}

// CSS for positioning the control
const style_control_save = document.createElement('style');
style_control_save.innerHTML = `
  .custom-save-control {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: white;
    padding: 5px;
    border: 1px solid black;
    z-index: 1000; /* Ensure it's on top of the map */
    visibility:'hidden'; /* Hidden until turned on */
  }
`;
document.head.appendChild(style_control_save);


// ROLLFORWARD CONTROL
// CSS for positioning the control
// 1. Create the Control Element
const rollforwardControlDiv = document.createElement('div');
rollforwardControlDiv.className = 'custom-rollforward-control';
rollforwardControlDiv.innerHTML = '<button>Roll Forward</button>';

// 2. Define the Control Class
class RollForwardControl extends Control {
  constructor(opt_options) {
    const options = opt_options || {};
    super({
      element: rollforwardControlDiv,
      target: options.target,
    });

    // Add event listener to the button
    rollforwardControlDiv.querySelector('button').addEventListener('click',rollforward_onclick);


  }
}

// CSS for positioning the control
const style_control_rollforward = document.createElement('style');
style_control_rollforward.innerHTML = `
  .custom-rollforward-control {
    position: absolute;
    top: 60px;
    right: 10px;
    background-color: white;
    padding: 5px;
    border: 1px solid black;
    z-index: 1000; /* Ensure it's on top of the map */
    visibility:'hidden'; /* Hidden until turned on */
  }
`;
document.head.appendChild(style_control_rollforward);

// ROLLBACK CONTROL
// CSS for positioning the control
// 1. Create the Control Element
const rollbackControlDiv = document.createElement('div');
rollbackControlDiv.className = 'custom-rollback-control';
rollbackControlDiv.innerHTML = '<button>Roll Back</button>';

// 2. Define the Control Class
class RollBackControl extends Control {
  constructor(opt_options) {
    const options = opt_options || {};
    super({
      element: rollbackControlDiv,
      target: options.target,
    });

    // Add event listener to the button
    rollbackControlDiv.querySelector('button').addEventListener('click',rollback_onclick);
  }
}

// CSS for positioning the control
const style_control_rollback = document.createElement('style');
style_control_rollback.innerHTML = `
  .custom-rollback-control {
    position: absolute;
    top: 110px;
    right: 10px;
    background-color: white;
    padding: 5px;
    border: 1px solid black;
    z-index: 1000; /* Ensure it's on top of the map */
    visibility:'hidden'; /* Hidden until turned on */
  }
`;
document.head.appendChild(style_control_rollback);
/*
// ROLLBACK CONTROL
// CSS for positioning the control
// 1. Create the Control Element
const newControlDiv = document.createElement('div');
newControlDiv.className = 'custom-new-control';
newControlDiv.innerHTML = `<div class="row">
      <div class="col-auto">
        <span class="input-group">
          <label class="input-group-text" for="type">Geometry type:</label>
          <select class="form-select" id="type">
            <option value="Point">Point</option>
            <option value="LineString">LineString</option>
            <option value="Polygon">Polygon</option>
            <option value="Circle">Circle</option>
            <option value="None">None</option>
          </select>
          <input class="form-control" type="button" value="Undo" id="undo">
        </span>
      </div>
    </div>`;

// 2. Define the Control Class
class NewControl extends Control {
  constructor(opt_options) {
    const options = opt_options || {};
    super({
      element: newControlDiv,
      target: options.target,
    });

    // Add event listener to the button
    newControlDiv.querySelector('draw_type').addEventListener('change',  function() {
        map.removeInteraction(draw);
        //addInteraction();
    });

    newControlDiv.querySelector('undo').addEventListener('click', function () {
        draw.removeLastPoint();
    });
  }
}

// CSS for positioning the control
const style_control_new = document.createElement('style');
style_control_new.innerHTML = `
  .custom-new-control {
    position: absolute;
    top: 160px;
    right: 10px;
    background-color: white;
    padding: 5px;
    border: 1px solid black;
    z-index: 1000; /* Ensure it's on top of the map 
    visibility:'hidden';  Hidden until turned on 
  }
`;
document.head.appendChild(style_control_new);
*/

    const map = new Map({
    //NEED FUNCTIONALITY AROUND TURNING OFF AND ON MODIFICATION
    
    interactions: defaultInteractions().extend([selectInteraction, modifyInteraction]),
    controls: defaultControls({attribution: false}).extend([new GoogleLogoControl()]).extend([attribution]).extend([new SaveControl]).extend([new RollForwardControl]).extend([new RollBackControl]),
    layers: [googleLayer,/*topo50_layer,*/pg_doc, pg_doc_huts, pg_test],
    //layers: [pg_local_wdc_parcels_test],
    target: 'map',
    //projection: 'EPSG:2193',
    view: new View({
        center: [19194331.438878052,-5355299.9339601565],
        zoom: 4,
        //projection: getProjection(OLTB.ConfigManager.getConfig().projection.default)
    }),
    });

 


  /*
  *OnClick event
  *When user clicks on the map, other then dragging, which isn't implemented
  *It runs the showInfo function with the event information
  */
 /*
  map.on('click', function (evt) {
    if (evt.dragging) {
      return;
    }
    showInfo(evt);
  });
    */
    /*
  *OnMouseUp event
  *When user releases the mouse click, other then dragging, which isn't implemented
  *It runs the showInfo function
  *This differs from OnClick in when editing/modifying shapes, the mouseup event ensures that the new geometry is sent to the form module
  WONT BE NEEDED WITH A REACT APPROACH
  */

  //
  modifyInteraction.on('modifyend', function(event) {
    // Get modified features
    event.preventDefault();
    const modifiedFeatures = event.features.getArray();
    modifiedFeatures.forEach(feature => {
      console.log("Feature modified:", feature);
         //Update window feature
        const geojsonFormat=new GeoJSON();
        const geojsonObject = geojsonFormat.writeFeatureObject(feature);

        //Attach to the window
        window.geojson = geojsonObject;

        //Add login details to the geojson to send to the server

        Object.assign(window.geojson,login_details);

    });


    //alert('Modify end');
    // Logic to save the modified features

    //Update window feature
    //REALLY HACKY AS IT SAVES ALL FEATURES
    //const geojsonFormat=new GeoJSON();
    //const geojsonObject = geojsonFormat.writeFeatureObject(modifiedFeatures);

    //Attach to the window
    //window.geojson = geojsonObject;
    //return;

  });

  //Testing Coordinates:
 
  map.on('click', function(event) {
    //if (event.button === 1) {
      // Get the coordinates
      window.coordinates = map.getView().getCenter();
      window.zoomLevel = map.getView().getZoom();

      // Convert to EPSG:4326 (latitude and longitude) if needed
      //const wgs84Coordinate = ol.proj.toLonLat(coordinate);

      // Log the coordinates (or use them as needed)
      console.log('Coordinates:', window.coordinates, 'ZoomLevel: '+window.zoomLevel);
      // Prevent the default browser context menu
      //event.preventDefault();

     
     //Attach to the window
     //window.geojson = geojsonObject;
    //}
  });
  
  //Custom sort
  function sortObjectByKeys(obj, customSortOrder) {
    const keys = Object.keys(obj);
  
    keys.sort((a,b) => {
      const indexA = customSortOrder.indexOf(a);
      const indexB = customSortOrder.indexOf(b);
  
      if (indexA === -1 && indexB === -1) {
          return a.localeCompare(b); // Sort alphabetically if not in custom order
      } else if (indexA === -1) {
        return 1; // Put keys not in custom order last
      } else if (indexB === -1) {
        return -1; // Put keys not in custom order last
      }
      return indexA - indexB;
    });
  
    return keys.reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
  }  

  //CUSTOM ORDER FOR PEROMOLAT TRACKS
  const customOrder = ['trackname', 'importance', 'tracktype','lastcut','nextcut','currentcon','custodian'];

  //console.log(sortedObject);
  

  //Modify interaction - once it ends
  
  /*
  selectInteraction.on('selectend', function(e) {
    //Get modified feature
    //SAME APPROACH AS FOR SELECT INTERACTION

    e.preventDefault();

    alert('Modify end');

    modifiedFeature = e.selected[0];
    
     //Update window feature
     const geojsonFormat=new GeoJSON();
     const geojsonObject = geojsonFormat.writeFeatureObject(modifiedFeature);

     
     //Attach to the window
     window.geojson = geojsonObject;
     
     //alert(key+":"+input.textContent);
     //pg_test.changed(); // Redraw the layer

  });
  */

  //Select interactions. 

    selectInteraction.on('select', function(event)  {
        //event.preventDefault();

        const selectedFeature = event.selected[0];

        //const geojsonFormat=new GeoJSON();
        //const geojsonObject = geojsonFormat.writeFeatureObject(selectedFeature);

        //Attach to the window
        //window.geojson = geojsonObject;

        // Get the coordinates
        //window.coordinates = event.coordinate;
        //window.zoomLevel=event.zoomLevel;

        //console.log('Coordinates:', coordinate);

        //Flags for setting visibility of rollforward and rollback buttons
        var key_flag_rollforward=false; 
        var key_flag_rollback=false; 
        
        const titleDiv = document.getElementById('title');
        const controlDiv = document.getElementById('control');
        //TitleDiv style
        titleDiv.style.fontFamily = 'Arial, sans-serif';
        titleDiv.style.border = '1px solid #ccc';
        titleDiv.style.padding = '5px';
        // Set font weight to bold
        titleDiv.style.fontWeight = 'bold';
        // Set font size to 12px
        titleDiv.style.fontSize = '18px';
        
        editorDiv.innerHTML = ''; // Clear previous editor
        if (event.selected.length > 0) 
        {
          
            
            const properties = selectedFeature.getProperties();

            //map_click_pixel=map.getEventCoordinate;
            //alert(map_click_pixel);


            //console.log(geojsonString); // Output the GeoJSON string
            //Add layer_name to title div. 
            //Set global layer name variable
            
            if (properties['layer_name']=='permolat_tracks') {
                titleDiv.innerText='Permolat Tracks';
                layerName='Permolat Tracks';
            }
            if (properties['layer_name']=='doc_tracks') {
                titleDiv.innerText='DOC Tracks';
                layerName='DOC Tracks';
            }
        
        
            //console.log(selectedFeature);
            //Sort the properties array into desired order for editing
            const sortedObject = sortObjectByKeys(properties, customOrder);
            var label_content;

            for (const key in sortedObject) 
            {
                
                if (key!=='geometry' && key!=='layer_name' && key!=='id') 
                {
                    
                    switch (key) {
                        case 'trackname': 
                            label_content='Track Name';
                            break;
                        case 'importance': 
                            label_content='Importance';
                            break;
                        case 'tracktype': 
                            label_content='Track Type';
                            break;
                        case 'nextcut': 
                            label_content='Next Cut';
                            break;
                        case 'lastcut': 
                            label_content='Last Cut';
                            //half_size=true; 
                            break;
                        case 'currentcon': 
                            label_content='Current Condition';
                            break;
                        case 'custodian': 
                            label_content='Custodian';
                            break;
                        case 'history': 
                            label_content='History';
                            break;
                        default: 
                            label_content=key;
                    }
                    
                    const label = document.createElement(key);
                    label.textContent = label_content + ': ';
                    // Set font weight to bold
                    label.style.fontWeight = 'bold';

                    // Set font size to 12px
                    label.style.fontSize = '16px';

                    const input = document.createElement('div');
                    //Styling for the editable div
                    input.contentEditable = 'true';
                    input.style.border = '1px solid #ccc';
                    input.style.padding = '5px';
                    //Word wrap
                    input.style.whiteSpace = "pre-wrap";
                    input.style.overflowWrap = "break-word";
                    
                    //input.type = 'text';
                    input.textContent = properties[key];

                    //Key flag
                    //If there is a next_id with a populated value, then the roll-forward button becomes visible
                    if (key=='next_id' && properties[key]!==null) {
                        //alert("Fired " + key + " " + properties[key]);
                        key_flag_rollforward=true;
                    } 
                    //If there is a previous_id with a populated value, then the roll-backward button becomes visible 
                    if (key=='prev_id' && properties[key]!==null) {
                        //alert("Fired " + key + " " + properties[key]);
                        key_flag_rollback=true;
                    } 
                    

                    //Set uneditable fields
                    //IF THE FIELD IS CUSTODIAN AND THE CUSTODIAN IS NOT EMPTY
                    //DISABLE EDITING
                    //FOR TRACKS WITHOUT A CUSTODIAN, ENABLE EDITING. 
                    /*
                    if (key=='custodian' && properties[key]!='') {
                        input.disabled=true;
                        input.contentEditable = 'false';
                    }
                    */

                    //Use blur event
                    input.addEventListener('blur', function() {
                        selectedFeature.set(key, input.textContent);

                        //Update window feature
                        const geojsonFormat=new GeoJSON();
                        const geojsonObject = geojsonFormat.writeFeatureObject(selectedFeature);
            
                        
                        //Attach to the window
                        window.geojson = geojsonObject;
                        
                        //alert(key+":"+input.textContent);
                        //pg_test.getSource().changed(); // Redraw the layer
                    
                    });

                    editorDiv.appendChild(label);
                    editorDiv.appendChild(input);
                    editorDiv.appendChild(document.createElement('br'));

                }

                        //Update global GeoJSON

                        const geojsonFormat=new GeoJSON();
                        const geojsonObject = geojsonFormat.writeFeatureObject(selectedFeature);
            
                        
                        //Attach to the window
                        window.geojson = geojsonObject;

                        console.log(JSON.stringify(window.geojson));

                
            }
            //Add a save button
            /*
            const saveButton = document.createElement('button');
            saveButton.type = 'button';
            saveButton.textContent = 'Save changes';

            //Rollback button

            const rollback = document.createElement('button');
            rollback.type = 'button';
            rollback.textContent = 'Roll back to previous';

            //Rollforward button
      
            const rollforward = document.createElement('button');
            rollforward.type='button';
            rollforward.textContent='Roll forward to next';
            */

            //Set visibility of the rollforward button based on the key_flags defined above
            if (key_flag_rollforward) {rollforwardControlDiv.style.visibility='visible';}
            else {rollforwardControlDiv.style.visibility='hidden';}
      
            //Set visibility of the rollback button based on the key_flags defined above
            if (key_flag_rollback) {rollbackControlDiv.style.visibility='visible';}
            else {rollbackControlDiv.style.visibility='hidden';}
      
            //Add buttons to the dynamic form
            /*
            controlDiv.appendChild(saveButton);
            controlDiv.appendChild(document.createElement('br'));
            controlDiv.appendChild(rollback);
            controlDiv.appendChild(rollforward);
            */
            //Test

            //EASILY REFERENCE LOGIN HERE
            //IF LOGGED IN THEN ENABLE SAVE BUTTON
            /*
            if (window.login_email!='' && window.login_name!='') {
                saveButton.disabled=false;
            }
            else {
                alert('Not logged in');
                saveButton.disabled=true;
            }
            */

            

        }//end if test for no feature classes

    });//end select on.interaction
    
    
    async function reloadMapAtCurrentLocation(map) {
        try {
          //const coords = await getCurrentLocation();
          map.getView().setCenter(window.coordinates);
          map.getView().setZoom(window.zoomLevel); // Set your desired zoom level
          map.updateSize();
          //alert('map reloaded at: '+window.coordinates);
        } catch (error) {
          console.error("Error getting location:", error);
        }
      }

        //Get the features from the layer for saving
        //WILL NEED A LAYER TEST HERE
        //if (this.layerName='Permolat Test') {
            //var saveFeatures=selectedFeature;
        //} else if (this.layerName='DOC Tracks') {
            //var saveFeatures=doc_tracks.getSource().getFeatures();
        //}
        //else {
            //Cannot save without a layer clicked, return
            //return;
    

  /*
  function showInfo(event) {
    const features = pg_test.getFeatures(event.pixel).then (function(features){
      //if (features.length == 0) {
        //info.innerText = '';
        //info.style.opacity = '0';
      //return;}

      //This global variable stores the pixel state - i.e. where has a user clicked - on the map
      //It is quasi-state for the application
      map_click_pixel=event.pixel;

      //Hacky global variable assignation for the geojson object
      
      let currentState=features[0];

      const properties = features[0].getProperties();


      //THIS CAN ONLY WORK IN CURRENT FORMAT FOR A SINGLE FEATURE AT A TIME
      //DUE TO ARRAY[0] 
      //const properties_geojson = new GeoJSON().writeFeatureObject(features[0]);
      
      //info.innerText = JSON.stringify(properties, null, 2);
      //info.style.opacity = '1';

      
      
      //Update the dynamic form
      //WITH REACT, PROBABLY ONLY NEED TO DO THIS ONCE AT DOCUMENT LOAD RATHER THAN CONSTANTLY UPDATING THE DOM
      
      generateFormFromGeoJSON(properties,currentState,'info');
      
    })
  }
    
    /*Generate the dynamic forms for data entry based off the map feature JSON
    //Uses a hacky hidden form for the geometry as WKT
    TO DO: Carrying over the GeoJSON in some form so it can be seen?
    PROBABLY RUN IT OFF THE LAYER PROPERTIES AT FIRST LOAD TIME/REFRESH OF PAGE
    

    function generateFormFromGeoJSON(properties, currentState, containerId) 
    {
      
      const form = document.createElement('form');
      form.id = 'dynamicForm';
      //form.method='POST';  
      //form.action='/api/submit';

      //Flags for setting visibility of rollforward and rollback buttons
      var key_flag_rollforward=false; 
      var key_flag_rollback=false; 

      for (const [key, value] of Object.entries(properties).sort()) {
        const label = document.createElement('label');
        label.setAttribute('for', key);
        label.textContent = key + ': ';

        const input = document.createElement('input');
        input.type = 'text';
        input.name = key;
        input.id = key;
        input.value=value;

        //ANOTHER ATTEMPT AT A FUNCTION THAT WRITES THE CHANGE TO THE GEOJSON OBJECT
        input.onmouseleave=function(e) {


        }

        //USE THIS BASIC LOGIC TO TURN OFF FIELDS HOLDING NON EDITABLE INFO
        //MAKE THEM INVISIBLE BUT STILL ON THE FORM
        if (label.textContent=='layer: ' || label.textContent=='geometry: ' || label.textContent=='topology_t: ') {
          label.appendChild(input);
          form.appendChild(label);
          //Hidden
          label.style.visibility='hidden';
          label.style.display='none';
          // Line break for readability
          //form.appendChild(document.createElement('br'));
        } else {
            //Otherwise add the field
            label.appendChild(input);
            //label.style.visibility='hidden';
            form.appendChild(label);
            // Line break for readability
            form.appendChild(document.createElement('br'));
        }
        
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
  
        try 
        {
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
            pg_test.getSource().refresh();

            //Hacky way of refreshing the form  
            generateFormFromJSON(map.getFeaturesAtPixel(map_click_pixel,pg_test.getSource()),'info');
    
        } catch (err) {
            alert('Error: '+err);
        }
    }

    // Handle button click for the rollback button
    
    */
