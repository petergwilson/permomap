    // Core OpenLayers
    import 'ol/ol.css';
    import { Map, View } from 'ol';
    import { fromLonLat } from 'ol/proj';
    import { get as getProjection } from 'ol/proj';
    import { defaults as defaultControls } from 'ol/control';
    import { platformModifierKeyOnly, altShiftKeysOnly, shiftKeyOnly, targetNotEditable } from 'ol/events/condition';
    import { defaults as defaultInterctions, MouseWheelZoom, DragPan, DragRotate, KeyboardZoom, KeyboardPan } from 'ol/interaction';
    

    //NYT/ICE Editing library
    //NEED TO ATTRIBUTE
    import Ice from './ice.mjs';


    //OGC ImageTile
    import ImageTile from 'ol/source/ImageTile';
    import TileLayer from 'ol/layer/Tile';
    import OSM from 'ol/source/OSM';
    import TileWMS from 'ol/source/TileWMS';
    import XYZ from 'ol/source/XYZ';
    import Google from 'ol/source/Google';
    import Layer from 'ol/layer/WebGLTile';

    //Vector Tile Layer and VectorTileSource
    import VectorTileLayer from 'ol/layer/VectorTile';
    import VectorTileSource from 'ol/source/VectorTile';
    import MVT from 'ol/format/MVT'; //MapBox vector tiles, using PBF (Protocol Buffer Binary format for speed)

    //Vector Layers
    import VectorLayer from 'ol/layer/Vector';
    import GeoJSON from 'ol/format/GeoJSON';
    import VectorSource from 'ol/source/Vector';

    //Style
    import Style from 'ol/style/Style';

    //Fill
    import Fill from 'ol/style/Fill';

    //Stroke
    import Stroke from 'ol/style/Stroke';

    //Select
    import Select from 'ol/interaction/Select';

    //Snap
    import Snap from 'ol/interaction/Snap';

    //Draw and Modify
    import Draw from 'ol/interaction/Draw';
    import Modify from 'ol/interaction/Modify';

    //Interactions
    import {defaults as defaultInteractions} from 'ol/interaction/defaults';

    //Controls
    import Control from 'ol/control/Control';

    //Attribution
    import Attribution from 'ol/control/Attribution';

    //LineString
    import { LineString } from 'ol/geom';

    //Icons
    import Icon from 'ol/style/Icon';
    //import Style from 'ol/style/Style';

    //Import layers

  //Window.onpageload to check for session information
  //Session info is held on server

  window.onload = async function() {
    // Check if a session exists. 

    const session_exists=await fetch('/api/get_session', {
        METHOD: 'GET'
    }).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json(); // Parse the JSON response)
    }).then(data => {
        // Display session information
        console.log(data);
        //alert("Existing session");

        //Update username info
        document.getElementById("username_field").innerHTML=`User: ${data.username}`;  

        //Update map layers based on permissions
        ///Uses the same function as for other login/session actions
        reloadUserSettings(map,data.role);


      }).catch(error => {
        //Unsuccesful
        //alert("No existing session");


      });
    
  };
  
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
    role: '',

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

 // Example logout function
 async function logout() {
    const response = await fetch('/logout', {
        method: 'POST',
      });
      if (response.ok) {
        // Redirect to login page or update UI
      } else {
        // Handle logout error
      }
  }
  
  
  function isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

//Login button
loginSubmitButton.addEventListener("click", async(event) =>{

    //GET LOGIN INPUT FIELDS
    
    var login_name_element=document.getElementById("login_name");
    var login_email_element=document.getElementById("login_email");
    var login_password_element=document.getElementById("login_password");

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({username: login_name_element.value, password:login_password_element.value}),
    }).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json(); // Parse the JSON response)
    }).then(data => {
        // Process the JSON data here
        console.log(data);
        alert("Login successful");
        document.getElementById("username_field").innerHTML=`User: ${data.username}`; 
  

        //Update map layers based on permissions
      }).catch(error => {
        //Unsuccesful
        alert("Login / password unsuccessful");
      });
           

      
    modal.style.display = "none";
  });
  
  

  //Assign login DOM element

  //const login_element=document.getElementById("login").addEventListener('click',login_click);

  //DOC Huts
  const iconStyle_hut = new Style({
    image: new Icon({
      src: './images/house-xxl.png', // Path to your icon image
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
      key: 'AIzaSyDkuLZf-kPmnunxBQYzszlHy6eYc4PcUYQ',
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

    //PENDING PERMOLAT STYLE
   
    var permolat_pending = new Style({
        stroke: new Stroke({
          color: 'rgba(2, 18, 246, 0.99)',
          width: 3,
          lineDash: [4,8],
          lineDashOffset: 6
        }),
        fill: new Fill({
            color: 'rgba(253, 249, 2, 0.99)', 
        }),
      });
    

    
        const pg_pending = new VectorLayer({
        // /background: 'white',
        source: new VectorSource({
            //ONLY ASK FOR SOME PROPERTIES TO AVOID FILLING UP FORMS
            //CAN BE CHANGED
            url: 'http://localhost:9050/collections/public.permolat_tracks/items.json?limit=1000&properties=lastcut,nextcut,geom,id,trackname,layer_name,importance,tracktype,currentcon,custodian,next_id,prev_id,history&filter=status=%27pending%27',
            format: new GeoJSON(),
            wrapX: false,
            name: 'permolat_tracks',
            //projection: 'EPSG:2193',
            ZIndex:10,
        }),
        style: [permolat_pending],
        });
   
   
   
   
   
   
   
   
   
    //BASE Permolat style

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
        url: 'http://localhost:9050/collections/public.permolat_tracks/items.json?limit=1000&properties=lastcut,nextcut,geom,id,trackname,layer_name,importance,tracktype,currentcon,custodian,next_id,prev_id,history&filter=status=%27live%27',
        format: new GeoJSON(),
        wrapX: false,
        name: 'permolat_tracks',
        ZIndex:7,
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

    // Select interaction for all layers
    //Except of course if the layer is turned off at the geoserver then it won't show to be clicked
    //THIS WAY MAY BE LESS CUMBERSOME THAN TURNING THEM ON AND OFF FOR EACH LAYER BASED ON A USER ROLE
    const selectInteraction= new Select({
        //Choose layers to select
        layers: [pg_test, pg_doc,pg_pending],
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
saveControlDiv.innerHTML = '<button>Save edits for moderating</button>';

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


    const map = new Map({
    //NEED FUNCTIONALITY AROUND TURNING OFF AND ON MODIFICATION

    //INTERACTIONS ARE CURRENTLY WRITTEN FOR EACH VECTOR LAYER
    
    interactions: defaultInteractions().extend([selectInteraction, modifyInteraction]),
    controls: defaultControls({attribution: false}).extend([new GoogleLogoControl()]).extend([attribution]).extend([new SaveControl]).extend([new RollForwardControl]).extend([new RollBackControl]),
    layers: [/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts, pg_test],
    //layers: [pg_local_wdc_parcels_test],
    target: 'map',
    //projection: 'EPSG:2193',
    view: new View({
        center: [19194331.438878052,-5355299.9339601565],
        zoom: 4,
        //projection: getProjection(OLTB.ConfigManager.getConfig().projection.default)
    }),
    });

 



  /*OnMouseUp event
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
        //alert("Logging here:");
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

    selectInteraction.on('select', on_select);
    
    
    //Select interaction main function
    //
    async function on_select(event)  {
        //event.preventDefault();

        const selectedFeature = event.selected[0];

        // Retrieve session info for Ice
        let sessionInfo = null;
        try {
            const resp = await fetch('/api/get_session', { METHOD: 'GET' });
            if (resp.ok) {
                sessionInfo = await resp.json();
            }
        } catch (err) {
            console.error('Failed to fetch session info', err);
        }

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
            var inputtype
            inputtype='text';
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
                            inputtype='date';
                            break;
                        case 'lastcut': 
                            label_content='Last Cut';
                            inputtype='date'; 
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
                    //input.type=inputtype; 
                    input.contentEditable = 'true';
                    input.style.border = '1px solid #ccc';
                    input.style.padding = '5px';
                    //Word wrap
                    input.style.whiteSpace = "pre-wrap";
                    input.style.overflowWrap = "break-word";
                    
                    //input.type = 'text';
                    input.textContent = properties[key];

                    // Initialize ICE editor for this input
                    if (sessionInfo) {
                        new Ice(input, {
                            username: sessionInfo.username,
                            email: sessionInfo.email,
                            role: sessionInfo.role
                        });
                    } else {
                        new Ice(input, {});
                    }

                    
                    // Determine session role from fetched session info
                    const session_role = sessionInfo ? sessionInfo.role : '';


                    //Key flag
                    //If there is a next_id with a populated value, AND USER IS A MODERATOR then the roll-forward button becomes visible
                    if (key=='next_id' && properties[key]!==null && session_role=='moderator') {
                        //alert("Fired " + key + " " + properties[key]);
                        key_flag_rollforward=true;
                    } 
                    //If there is a previous_id with a populated value, AND USER IS A MODERATOR then the roll-backward button becomes visible 
                    if (key=='prev_id' && properties[key]!==null && session_role=='moderator') {
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

    }//end select on.interaction    


    //Important function to reload the map at the current location
    //Acts as a refresh as openlayers refresh functionality doesn't really work natively
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

    //Important function to set the layers based on the user settings
    //Fires each time a session/login changes. 
    async function reloadUserSettings(map,role) {

        //Apply different layers depending on role
        //WILL ALSO NEED TO CHANGE SELECT FUNCTIONALITY


        switch(role) {
            case 'user': 
            //General users get basic map setup
                map.setLayers([/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts, pg_test]);
                 //Update select interactions to just the original layer
                 //selectInteraction.set('layers', [pg_test]);
                 //modifyInteraction.set('features',[pg_test]);
                break;
            case 'moderator': 
            //Moderators get to see existing tracks PLUS CHANGES IN ANOTHER COLOUR
            //Changes are the pending changes in the live=pending field. 
                map.setLayers([/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts, pg_test,pg_pending]);
                //Update select and modify interactions to include the pending layer

                //const currentLayers = selectInteraction.getLayers().getArray();
                //selectInteraction.set('layers', currentLayers.concat([pg_pending]));

                break;

        }


        
    }

