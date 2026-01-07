    // Core OpenLayers
    import 'ol/ol.css';
    import { Map, View } from 'ol';
    import { fromLonLat } from 'ol/proj';
    import { get as getProjection } from 'ol/proj';
    import { defaults as defaultControls } from 'ol/control';
    import { platformModifierKeyOnly, altShiftKeysOnly, shiftKeyOnly, targetNotEditable } from 'ol/events/condition';
    import { defaults as defaultInteractions, MouseWheelZoom, DragPan, DragRotate, KeyboardZoom, KeyboardPan } from 'ol/interaction';
    
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


    //Controls
    import Control from 'ol/control/Control';

    //Attribution
    import Attribution from 'ol/control/Attribution';

    //LineString
    import { LineString } from 'ol/geom';

    //Icons
    import Icon from 'ol/style/Icon';
    
  
    





 //GEOSERVER_BASE
 //Set in .env.production or .env.development
 const GEOSERVER_BASE = import.meta.env.VITE_GEOSERVER_BASE;
//const GEOSERVER_BASE = 'https://geoserver.wilsonenv.nz/';




  //Window.onpageload to check for session information
  window.session_info=new Object; 

  window.onload = async function() {
    // Check if a session exists.

    const get_session=await fetch('/api/get_session', {
        method: 'GET'
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
        document.getElementById("username_field").innerHTML=`${data.username}`;
        //currentUser=data;  

        //Update map layers based on permissions
        ///Uses the same function as for other login/session actions
        reloadUserSettings(map,data.role);

        //Update Track Information panel user class
        if (typeof window.setUserClass === 'function') {
            window.setUserClass(data.role || 'public');
        }

        //Add to window object for session
        Object.assign(window.session_info,data);

      }).catch(error => {
        //Unsuccesful
        //alert("No existing session");


      });



}; //window.onLoad function
  
//DOMContextLoaded event listeners:
//Shows a context menu for all elements of the user-edit class
//user-edit class is assigned in the functions.sql EXTENSIONS for postgresql

document.addEventListener('DOMContentLoaded', function () {

    //Map reloads:
    const center = localStorage.getItem('map_center');
    const zoom = localStorage.getItem('map_zoom');
    if (center && zoom && typeof map !== 'undefined') {
        try {
            map.getView().setCenter(JSON.parse(center));
            map.getView().setZoom(Number(zoom));
        } catch (e) {
            // Ignore errors and use default view
        }
    }


    // Create the custom context menu
    const menu = document.createElement('div');
    menu.id = 'user-edit-context-menu';
    menu.style.position = 'absolute';
    menu.style.display = 'none';
    menu.style.background = '#fff';
    menu.style.border = '1px solid #ccc';
    menu.style.zIndex = 10000;
    menu.innerHTML = '<div id="user-edit-delete" style="padding: 8px; cursor: pointer;">Delete</div>';
    document.body.appendChild(menu);

    let targetElement = null;


    // Show menu on right click
    document.addEventListener('contextmenu', function (e) {
        if (e.target.classList.contains('user-edit')) {
            e.preventDefault();
            targetElement = e.target;
            menu.style.left = e.pageX + 'px';
            menu.style.top = e.pageY + 'px';
            menu.style.display = 'block';
        } else {
            menu.style.display = 'none';
        }
    });

        // Hide menu on click elsewhere
    document.addEventListener('click', function () {
        menu.style.display = 'none';
    });

    // Handle delete option
    document.getElementById('user-edit-delete').addEventListener('click', function () {
        if (targetElement) {
            targetElement.remove();
            menu.style.display = 'none';
        }
    });
});

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



const modal = document.getElementById("loginModal");
const loginBtn = document.getElementById("login");
const closeBtn = document.querySelector(".close");
const loginForm = document.getElementById("loginForm");
const loginSubmitButton = document.getElementById("login_submit_button");

// Account Management Modal
const accountModal = document.getElementById("accountModal");
const closeAccountModal = document.getElementById("closeAccountModal");
const manageAccountLink = document.getElementById("manage_account_link");

// Check for OAuth success on page load
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('oauth') === 'success') {
    alert('Login successful!');
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    // Reload session
    window.location.reload();
}

loginBtn.addEventListener("click", () => {
    modal.style.display = "block";
});

closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
});

closeAccountModal.addEventListener("click", () => {
    accountModal.style.display = "none";
});

manageAccountLink.addEventListener("click", (e) => {
    e.preventDefault();
    modal.style.display = "none";
    loadAccountManagement();
    accountModal.style.display = "block";
});

window.addEventListener("click", (event) => {
    if (event.target === modal) {
        modal.style.display = "none";
    }
    if (event.target === accountModal) {
        accountModal.style.display = "none";
    }
});

 // Example logout function
 async function logout() {
    const response = await fetch('/logout', {
        method: 'POST',
      });
      if (response.ok) {
        // Redirect to login page or update UI
           //Clear localStorage
           localStorage.clear();
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

    const loginInfo = await fetch('/api/login', {
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
        //console.log(data);
        alert("Login successful");
        document.getElementById("username_field").innerHTML=`${data.username}`; 
        
        //THIS IS NOT MULTI_TAB UPDATING
        //WILL NEED window.storage event
          localStorage.setItem('username', data.username);
          localStorage.setItem('initial', data.initial);
          localStorage.setItem('color', data.color);
       
        //Update Track Information panel user class
        if (typeof window.setUserClass === 'function') {
            window.setUserClass(data.role || 'user');
        }

        //Update session info
        Object.assign(window.session_info, data);

        //Update map layers based on permissions
      }).catch(error => {
        //Unsuccesful
        alert("Login / password unsuccessful"+error);
      });
           

      
    modal.style.display = "none";
  });
  
  // Account Management Functions
  
  async function loadAccountManagement() {
      try {
          const response = await fetch('/api/user/profile');
          if (!response.ok) {
              throw new Error('Not authenticated');
          }
          
          const data = await response.json();
          const user = data.user;
          
          document.getElementById('profileInfo').innerHTML = `
              <p><strong>Username:</strong> ${user.username}</p>
              <p><strong>Email:</strong> ${user.email || 'Not set'}</p>
              <p><strong>Role:</strong> ${user.role}</p>
              <p><strong>Account Type:</strong> ${user.oauth_provider ? user.oauth_provider.charAt(0).toUpperCase() + user.oauth_provider.slice(1) + ' OAuth' : 'Standard'}</p>
              <p><strong>Created:</strong> ${new Date(user.created_at).toLocaleDateString()}</p>
          `;
          
          // Hide password change for OAuth users
          if (user.oauth_provider) {
              document.getElementById('changePasswordBtn').style.display = 'none';
          } else {
              document.getElementById('changePasswordBtn').style.display = 'inline-block';
          }
          
          // Show main account content
          document.getElementById('accountContent').style.display = 'block';
          document.getElementById('editProfileForm').style.display = 'none';
          document.getElementById('changePasswordForm').style.display = 'none';
      } catch (error) {
          alert('Please log in first');
          accountModal.style.display = 'none';
          modal.style.display = 'block';
      }
  }
  
  // Edit Profile
  document.getElementById('editProfileBtn').addEventListener('click', async () => {
      const response = await fetch('/api/user/profile');
      const data = await response.json();
      const user = data.user;
      
      document.getElementById('edit_username').value = user.username;
      document.getElementById('edit_email').value = user.email || '';
      
      document.getElementById('accountContent').style.display = 'none';
      document.getElementById('editProfileForm').style.display = 'block';
  });
  
  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
      const username = document.getElementById('edit_username').value;
      const email = document.getElementById('edit_email').value;
      
      try {
          const response = await fetch('/api/user/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, email })
          });
          
          const data = await response.json();
          
          if (data.ok) {
              alert('Profile updated successfully!');
              loadAccountManagement();
              // Update displayed username
              document.getElementById("username_field").innerHTML = username;
          } else {
              alert('Error: ' + data.message);
          }
      } catch (error) {
          alert('Failed to update profile');
      }
  });
  
  document.getElementById('cancelEditBtn').addEventListener('click', () => {
      loadAccountManagement();
  });
  
  // Change Password
  document.getElementById('changePasswordBtn').addEventListener('click', () => {
      document.getElementById('accountContent').style.display = 'none';
      document.getElementById('changePasswordForm').style.display = 'block';
  });
  
  document.getElementById('savePasswordBtn').addEventListener('click', async () => {
      const currentPassword = document.getElementById('current_password').value;
      const newPassword = document.getElementById('new_password').value;
      const confirmPassword = document.getElementById('confirm_password').value;
      
      if (newPassword !== confirmPassword) {
          alert('New passwords do not match');
          return;
      }
      
      if (newPassword.length < 6) {
          alert('Password must be at least 6 characters');
          return;
      }
      
      try {
          const response = await fetch('/api/user/change-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentPassword, newPassword })
          });
          
          const data = await response.json();
          
          if (data.ok) {
              alert('Password changed successfully!');
              loadAccountManagement();
          } else {
              alert('Error: ' + data.message);
          }
      } catch (error) {
          alert('Failed to change password');
      }
  });
  
  document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
      loadAccountManagement();
  });
  
  // Delete Account
  document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
          return;
      }
      
      const password = prompt('Please enter your password to confirm account deletion:');
      
      try {
          const response = await fetch('/api/user/account', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password })
          });
          
          const data = await response.json();
          
          if (data.ok) {
              alert('Account deleted successfully');
              window.location.reload();
          } else {
              alert('Error: ' + data.message);
          }
      } catch (error) {
          alert('Failed to delete account');
      }
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
        url: GEOSERVER_BASE+'collections/public.doc_huts/items.json?limit=1000',
        format: new GeoJSON(),
        wrapX: false,
        name: 'DOC Huts',
        minZoom: 8, //minimum zoom level
        //projection: 'EPSG:2193',
    }),
    style: function (feature, resolution) {
        const scale = 2 / Math.pow(resolution, 1 / 3);
        iconStyle_hut.getImage().setScale(scale);
        return iconStyle_hut;
      }
    });
    pg_doc_huts.setMinZoom(8);
    pg_doc_huts.setZIndex(5);


  //Google Aerial
 /*
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
 */

  //Openlayers attribution control
  //Google Image Control
  //NEEDS TO REMAIN HERE CONSISTENT WITH GOOGLE MAPS API LICENSE
  /*
  const attribution = new Attribution({
    collapsible: true, // Or true for collapsible on small maps
    attributions: `<a href="https://openlayers.org"><img src="https://openlayers.org/theme/img/logo-dark.svg" alt="OpenLayers"> OpenLayers</a>
    <a href="http://www.doc.govt.nz"><img src="https://www.doc.govt.nz/static/doc-front-end/assets/resources/doc-main-logo-white-Bx_-BN86.svg" alt="Department of Conservation"> Department of Conservation</a>
    <em>Contains data sourced from the <a href="https://data.linz.govt.nz/" rel="nofollow noreferrer" class="ext" data-extlink="" aria-label="(link is external)">LINZ Data Service<span class="fa-ext extlink" role="img" aria-hidden="false"><span class="icon icon--external" data-extlink-placement="append"></span></span></a> licensed for reuse under <a href="https://creativecommons.org/licenses/by/4.0/" rel="nofollow noreferrer" class="ext" data-extlink="" aria-label="(link is external)">CC BY 4.0<span class="fa-ext extlink" role="img" aria-hidden="false"><span class="icon icon--external" data-extlink-placement="append"></span></span></a></em>
    `
  });
*/

  //LINZ Aerial
  const linz_aerial=new ImageTile({
        source: new XYZ({
            url: 'https://basemaps.linz.govt.nz/v1/tiles/aerial/3857/{z}/{x}/{y}.png?api=20b10a680c3742798647ec56775918a4'
        }),
        ZIndex:1,
  })


    const topo50_layer=new TileLayer({
        source: new ImageTile({
            url: 'https://tiles-cdn.koordinates.com/services;key=20b10a680c3742798647ec56775918a4/tiles/v4/layer=50767/EPSG:3857/{z}/{x}/{y}.png',
            }),
        });
      topo50_layer.setZIndex(1);

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
       const pg_public_doc = (feature) => {
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
    const pg_public= new VectorTileLayer({
        source: new VectorTileSource({
            format: new MVT(),
            url: 'http://localhost:7800/public.nz_primary_parcels/{z}/{x}/{y}.pbf',
            }),
    });
    */

    //PENDING PERMOLAT STYLE
    //This flashes on
    const pg_pending_flash_on_style=new Style({
        stroke: new Stroke({
          color: 'rgba(2, 18, 246, 0.99)',
          width: 3,
          lineDash: [4,8],
          lineDashOffset: 6
        }),
        fill: new Fill({
            color: 'rgba(253, 249, 2, 0.4)', 
        }),
      });
    
    //This flashes off
    const pg_pending_flash_off_style=new Style({
        stroke: new Stroke({
          color: 'rgba(2, 18, 246, 0.99)',
          width: 3,
          lineDash: [4,8],
          lineDashOffset: 6
        }),
        fill: new Fill({
            color: 'rgba(44, 2, 253, 0.4)', 
        }),
      });


    // blink settings
    const periodMs = 800;  // total cycle time
    const duty = 0.5;      // fraction visible (0..1)

    // style function: toggles based on time
    const blinkStyleFn = () => {
      const phase = (performance.now() % periodMs) / periodMs;      // 0..1
      const alpha = 0.3 + 0.7 * Math.abs(Math.sin(phase * Math.PI)); // 0.3..1.0
      onStyle.getStroke().setColor(`rgba(255,0,0,${alpha})`);
    return onStyle;
    };
   
    //pg_pending vector layer
        const pg_pending = new VectorLayer({
        // /background: 'white',
        source: new VectorSource({
            //ONLY ASK FOR SOME PROPERTIES TO AVOID FILLING UP FORMS
            //CAN BE CHANGED
            url: GEOSERVER_BASE+'collections/public.permolat_tracks_prod/items.json?limit=500&properties=lastcut,nextcut,geom,id,trackname,layer_name,importance,tracktype,currentcon,custodian&filter=current_version=true',
            format: new GeoJSON(),
            wrapX: false,
            name: 'permolat_tracks_pending',
            //projection: 'EPSG:2193',
            ZIndex:10,
        }),
        style: [pg_pending_flash_on_style,pg_pending_flash_off_style],
        });
        pg_pending.setMinZoom(8);
        //This z index is set to be above the Z index for pg_public to ensure the colours change for tracks that have been edited
        pg_pending.setZIndex(10);
  
   
   
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
    const pg_public_stylefunction = (feature) => {
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

    const pg_public = new VectorLayer({
    // /background: 'white',
    source: new VectorSource({
        //ONLY ASK FOR SOME PROPERTIES TO AVOID FILLING UP FORMS
        //CAN BE CHANGED
        url: GEOSERVER_BASE+'collections/public.permolat_tracks_prod/items.json?limit=500&properties=lastcut,nextcut,geom,id,trackname,layer_name,importance,tracktype,currentcon,custodians&filter=current_version=true',
        format: new GeoJSON(),
        wrapX: false,
        name: 'permolat_tracks',
        //projection: 'EPSG:2193',
    }),
    style: [lightStroke_permolat, darkStroke_permolat],
    });
    pg_public.setMinZoom(6);
    pg_public.setZIndex(10);


    const pg_doc = new VectorLayer({
        // /background: 'white',
        source: new VectorSource({
            url: GEOSERVER_BASE+'collections/public.doc_tracks/items.json?limit=1000',
            format: new GeoJSON(),
            wrapX: false,
            minZoom: 8, //minimum zoom level
            //projection: 'EPSG:2193',
        }),
        style: [lightStroke_doc, darkStroke_doc],
        });
    pg_doc.setMinZoom(8);
    pg_doc.setZIndex(7);
    
    
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
    //console.log('Data received:', response.data.length);
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
        //alert(localStorage.getItem('username'));

        Object.assign(window.geojson,{username: localStorage.getItem('username')});

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
        pg_public.getSource().changed(); // Redraw the layer
        pg_public.getSource().refresh(); // Redraw the layer
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
        //pg_public.getSource().refresh();
    //}
    }//end saveButton

    //Click function for the rollback button
    async function rollback_onclick(e) {
        e.preventDefault();
        try {
            //Add login details to the geojson to send to the server

            Object.assign(geojson,localStorage.getItem("username"));

            const response = await fetch('/api/rollback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
              },
            body: JSON.stringify(localStorage.getItem("username")),
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
            pg_public.getSource().changed(); // Redraw the layer
            pg_public.getSource().refresh(); // Redraw the layer
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

        Object.assign(geojson,localStorage.getItem("username"));


        try {
            const response = await fetch('/api/rollforward', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
              },
            body: JSON.stringify(geojson),
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
            pg_public.getSource().changed(); // Redraw the layer
            pg_public.getSource().refresh(); // Redraw the layer
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
        layers: [pg_public, pg_doc,pg_pending],
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
    controls: defaultControls({attribution: false}).extend([new SaveControl]).extend([new RollForwardControl]).extend([new RollBackControl]),
    layers: [/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts, pg_public],
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
      //console.log("Feature modified:", feature);
         //Update window feature
        const geojsonFormat=new GeoJSON();
        const geojsonObject = geojsonFormat.writeFeatureObject(feature);

        //Attach to the window
        geojson = geojsonObject;

        //Add login details to the geojson to send to the server

        Object.assign(geojson,localStorage.getItem("username"));

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
      //console.log('Coordinates:', window.coordinates, 'ZoomLevel: '+window.zoomLevel);
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
     //pg_public.changed(); // Redraw the layer

  });
  */

  //Select interactions. 

    selectInteraction.on('select', on_select);
    
    
    //Select interaction main function
    //
    async function on_select(event)  {
        //event.preventDefault();

        const selectedFeature = event.selected[0];
        
        // Store selected feature globally for maintenance functions
        window.lastSelectedFeature = selectedFeature;

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
            //MAY NEED A MAPPING OBJECT

            //PUT LOGIC FOR TABS IN HERE
            
            
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
                
                if (key!=='geometry' && key!=='layer_name' //&& key!=='id'
                  ) 
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

                    //const meta=document.createElement('span');
                    //meta.className='edit-meta';


                    //Editable input box
                    const input = document.createElement('div');
                    input.className='editable-field';
                    //Styling for the editable div
                    //input.type=inputtype;
                    //This class allows the tiptap/quill editor to attach itself to this div. 
                    //input.classList.add('editable'); 
                    input.contentEditable = 'true';
                    
                    input.style.border = '1px solid #ccc';
                    input.style.padding = '5px';
                    //Word wrap
                    input.style.whiteSpace = "pre-wrap";
                    input.style.overflowWrap = "break-word";
                    
                    //input.type = 'text';
                    //Set input innerHTML to properties of the layer
                    input.innerHTML = properties[key];

                    //Set input name - basically an ID for the state_locking
                    //Use editable-$[key] for this
                    input.name="editable-"+key;
                    //input.style.color='red';
                    //input.value=properties[key];

                    //alert(window.session_info.color);

                    //console.log(window.session_info);
                    
                    //Key flag
                    //If there is a next_id with a populated value, AND USER IS A MODERATOR then the roll-forward button becomes visible
                    if (key=='next_id' && properties[key]!==null && window.session_info.role=='moderator') {
                        //alert("Fired " + key + " " + properties[key]);
                        key_flag_rollforward=true;
                    } 
                    //If there is a previous_id with a populated value, AND USER IS A MODERATOR then the roll-backward button becomes visible 
                    if (key=='prev_id' && properties[key]!==null && window.session_info.role=='moderator') {
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
                     
                    // Each gets its own editor instance
                    /*
                    const initialContent =input.innerHTML;
                    const editor = new Editor({
                      element: input,
                      content: properties[key],
                      editable: true,
                      extensions: [
                        StarterKit,
                        CustomUnderline,
                        CustomStrike,
                      ],
                    });
                    */
                    /*Event listener for keydown */
                    
                    input.addEventListener('keydown', e => {
                      if (
                        e.key.length === 1 &&
                        !e.ctrlKey && !e.metaKey && !e.altKey
                      ) {
                        e.preventDefault();

                        // Create the colored <span>
                        const span = document.createElement("span");
                        span.style.color = localStorage.getItem("color");
                        span.textContent = e.key;

                        //HTML attributes with edit information
                        //span.setAttribute('username',     localStorage.getItem("username"));
                        //span.setAttribute('initial', localStorage.getItem("initial"));
                        //span.setAttribute('timestamp',    Date.now() / 1000); // Unix epoch seconds
                          // For milliseconds, use: Date.now()

                        // Insert at caret position
                        const sel = window.getSelection();
                        if (!sel.rangeCount) return;
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(span);

                        // Move cursor after the newly inserted span
                        range.setStartAfter(span);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                      }
                 
                    });
                    


                    //OnBlur event
                    //Merge the individual character
                    input.addEventListener('blur', function() 
                    {
                        
                        let node = input.firstChild;
                        let buffer = '';
                        let spanGroup = [];
                        let collecting = false;

                        function flushBuffer() {
                          if (spanGroup.length > 0) {
                            // Remove old spans from DOM
                            for (const s of spanGroup) s.remove();
                            // Insert merged span
                            const merged = document.createElement("span");
                            merged.style.color = localStorage.getItem("color");
                            //These attributes below must match the Postgresql functions for the html_diff function
                            //merged.setAttribute('data-username', localStorage.getItem("username"));
                            //merged.setAttribute('data-userinitials', localStorage.getItem("initial"));
                            //merged.setAttribute('data-timestamp', Math.floor(Date.now() / 1000));
                            merged.textContent = buffer;
                            // Insert before the first removed span's nextSibling (or at end)
                            const refNode = spanGroup[spanGroup.length-1].nextSibling;
                            input.insertBefore(merged, refNode);
                          }
                          buffer = '';
                          spanGroup = [];
                          collecting = false;
                        }

                        while (node) {
                          // Only consider spans inserted by this session: has color style and lacks attributes
                          if (
                            node.nodeType === 1 &&
                            node.tagName === 'SPAN' &&
                            node.style.color === localStorage.getItem("color") &&
                            !node.hasAttribute('username') &&
                            !node.hasAttribute('userinitials') &&
                            !node.hasAttribute('timestamp')
                          ) {
                            buffer += node.textContent;
                            spanGroup.push(node);
                            collecting = true;
                          } else {
                            // Any break: flush current buffer if collecting
                            if (collecting) flushBuffer();
                          }
                          node = node.nextSibling;
                        }
                        if (collecting) flushBuffer(); // flush at end of run
                      

                      //Update the global geoJSON object
                      //Update global GeoJSON
                      //SelectedFeature.set is critical - this assigns the innerText for the clicked feature fields to the geoJSON object
                      //Use innerHTML to get the attributes, currently no need to pass the innerHTML
                      //If text is passed, the server functions pick up the changes and add on the username who made them
                      selectedFeature.set(key, input.innerHTML);  
                      const geojsonFormat=new GeoJSON();
                      const geojsonObject = geojsonFormat.writeFeatureObject(selectedFeature);
                
                        
                      //Attach to the window
                      
                      window.geojson = geojsonObject;

                      console.log(JSON.stringify(window.geojson));
                  });
                
                    editorDiv.appendChild(label);
                    //editorDiv.appendChild(meta);
                    editorDiv.appendChild(input);
                    editorDiv.appendChild(document.createElement('br'));

                    //Update meta content
                  
                    updateEditMetaInfo();


                    
                
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
      


            

        }//end if test for no feature classes
   

    }

    // Handle user permission-based Track Information panels
    const activeButton = document.querySelector('.info-toggle-btn.active');
    if (activeButton) {
        const panelType = activeButton.dataset.info;
        const userClass = window.session_info?.role || 'public';
        
        // Get the appropriate content container
        let contentDiv = document.getElementById('info');
        
        // Add panel-specific content based on active button and user permissions
        if (panelType === 'basic') {
            // Basic information is already populated above
            contentDiv.classList.add('panel-basic');
            contentDiv.classList.remove('panel-detailed', 'panel-history', 'panel-moderation', 'panel-admin');
        } else if (panelType === 'detailed' && (userClass === 'user' || userClass === 'moderator')) {
            // Add detailed information for users and moderators
            contentDiv.classList.add('panel-detailed');
            contentDiv.classList.remove('panel-basic', 'panel-history', 'panel-moderation', 'panel-admin');
            
            const detailedDiv = document.createElement('div');
            detailedDiv.className = 'detailed-info';
            detailedDiv.innerHTML = `
                <h4>Detailed Information</h4>
                <div class="tech-details">
                    <p><strong>GPS Coordinates:</strong> ${feature_coordinates ? feature_coordinates.join(', ') : 'Not available'}</p>
                    <p><strong>Feature Type:</strong> ${selectedFeature.getGeometry().getType()}</p>
                    <p><strong>Last Survey:</strong> ${selectedFeatureProps['last_survey'] || 'Unknown'}</p>
                    <p><strong>Condition Assessment:</strong> ${selectedFeatureProps['condition'] || 'Not assessed'}</p>
                    <p><strong>Elevation:</strong> ${selectedFeatureProps['elevation'] || 'Unknown'}</p>
                    <p><strong>Difficulty Rating:</strong> ${selectedFeatureProps['difficulty'] || 'Not rated'}</p>
                </div>
            `;
            contentDiv.appendChild(detailedDiv);
        } else if (panelType === 'history' && (userClass === 'user' || userClass === 'moderator')) {
            // Add history information for users and moderators
            contentDiv.classList.add('panel-history');
            contentDiv.classList.remove('panel-basic', 'panel-detailed', 'panel-moderation', 'panel-admin');
            
            const historyDiv = document.createElement('div');
            historyDiv.className = 'history-info';
            historyDiv.innerHTML = `
                <h4>Track History</h4>
                <div class="history-details">
                    <p><strong>Created:</strong> ${selectedFeatureProps['created_date'] || 'Unknown'}</p>
                    <p><strong>Last Modified:</strong> ${selectedFeatureProps['last_modified'] || 'Unknown'}</p>
                    <p><strong>Total Edits:</strong> ${selectedFeatureProps['edit_count'] || '0'}</p>
                    <p><strong>Recent Changes:</strong> ${selectedFeatureProps['recent_changes'] || 'No recent changes'}</p>
                </div>
            `;
            contentDiv.appendChild(historyDiv);
        } else if (panelType === 'moderation' && userClass === 'moderator') {
            // Add moderation information for moderators only
            contentDiv.classList.add('panel-moderation');
            contentDiv.classList.remove('panel-basic', 'panel-detailed', 'panel-history', 'panel-admin');
            
            const moderationDiv = document.createElement('div');
            moderationDiv.className = 'moderation-info';
            moderationDiv.innerHTML = `
                <h4>Moderation Panel</h4>
                <div class="moderation-details">
                    <p><strong>Maintenance Schedule:</strong> ${selectedFeatureProps['maintenance_schedule'] || 'Not scheduled'}</p>
                    <p><strong>Last Maintenance:</strong> ${selectedFeatureProps['last_maintenance'] || 'Unknown'}</p>
                    <p><strong>Priority Level:</strong> ${selectedFeatureProps['priority'] || 'Standard'}</p>
                    <p><strong>Assigned Team:</strong> ${selectedFeatureProps['assigned_team'] || 'Unassigned'}</p>
                    <div class="moderation-actions">
                        <button onclick="scheduleMaintenanceTask('${selectedFeatureProps['id']}')">Schedule Task</button>
                        <button onclick="updateMaintenanceStatus('${selectedFeatureProps['id']}')">Update Status</button>
                    </div>
                </div>
            `;
            contentDiv.appendChild(moderationDiv);
        } else if (panelType === 'admin' && userClass === 'admin') {
            // Add admin information for admins only
            contentDiv.classList.add('panel-admin');
            contentDiv.classList.remove('panel-basic', 'panel-detailed', 'panel-history', 'panel-moderation');
            
            const adminDiv = document.createElement('div');
            adminDiv.className = 'admin-info';
            adminDiv.innerHTML = `
                <h4>Admin Panel</h4>
                <div class="admin-details">
                    <p><strong>System Status:</strong> Operational</p>
                    <p><strong>Database ID:</strong> ${selectedFeatureProps['id'] || 'Unknown'}</p>
                    <p><strong>Created By:</strong> ${selectedFeatureProps['created_by'] || 'Unknown'}</p>
                    <p><strong>Permissions:</strong> ${selectedFeatureProps['permissions'] || 'Default'}</p>
                    <div class="admin-actions">
                        <button onclick="deleteFeature('${selectedFeatureProps['id']}')">Delete Feature</button>
                        <button onclick="changePermissions('${selectedFeatureProps['id']}')">Change Permissions</button>
                    </div>
                </div>
            `;
            contentDiv.appendChild(adminDiv);
        }
    }

    }//end select on.interaction    


    // Call this function after you have rendered/updated the editorDiv content (e.g., at the end of on_select)
function updateEditMetaInfo() {

  
  // For each .editable-field inside #info
  document.querySelectorAll('#info .editable-field').forEach(editable => {
    // Find or create the .edit-meta span just before the editable div
    let meta = editable.previousSibling;
    if (!meta || !(meta.classList && meta.classList.contains('edit-meta'))) {
      meta = document.createElement('span');
      meta.className = 'edit-meta';
      editable.parentNode.insertBefore(meta, editable);
    }

    // Collect attribute info from child elements (e.g., spans inside editable)
    let info = [];
    // Find all child elements with data-username, data-userinitials, or data-timestamp
    editable.querySelectorAll('[data-username], [data-userinitials], [data-timestamp]').forEach(child => {
      let childInfo = [];
      if (child.hasAttribute('data-username')) {
        childInfo.push(`User: ${child.getAttribute('data-username')}`);
      }
      if (child.hasAttribute('data-userinitials')) {
        childInfo.push(`Initials: ${child.getAttribute('data-userinitials')}`);
      }
      if (child.hasAttribute('data-timestamp')) {
        const ts = child.getAttribute('data-timestamp');
        const date = ts ? new Date(Number(ts) * 1000) : null;
        if (date) childInfo.push(`Edited: ${date.toLocaleString()}`);
      }
      if (childInfo.length > 0) {
        info.push(childInfo.join(' | '));
      }
    });

    // If no attributes found in children, show a default
    /*
    if (info.length === 0) {
      info.push('No edit info');
    }
    */

    meta.textContent =info.join(' || ');
      });
    }

// Maintenance action functions for moderators
function scheduleMaintenanceTask(featureId) {
    if (window.session_info?.role !== 'moderator') {
        alert('Access denied. Moderator privileges required.');
        return;
    }
    
    const taskDate = prompt('Enter maintenance date (YYYY-MM-DD):');
    if (taskDate) {
        // Here you would typically send this to your backend
        console.log(`Scheduling maintenance task for feature ${featureId} on ${taskDate}`);
        alert(`Maintenance task scheduled for ${taskDate}`);
        
        // Update the feature properties locally
        if (window.lastSelectedFeature) {
            window.lastSelectedFeature.set('maintenance_schedule', taskDate);
        }
    }
}

function updateMaintenanceStatus(featureId) {
    if (window.session_info?.role !== 'moderator') {
        alert('Access denied. Moderator privileges required.');
        return;
    }
    
    const status = prompt('Enter maintenance status (completed, in-progress, pending):');
    if (status) {
        const today = new Date().toISOString().split('T')[0];
        console.log(`Updating maintenance status for feature ${featureId} to ${status}`);
        alert(`Maintenance status updated to: ${status}`);
        
        // Update the feature properties locally
        if (window.lastSelectedFeature) {
            window.lastSelectedFeature.set('maintenance_status', status);
            if (status === 'completed') {
                window.lastSelectedFeature.set('last_maintenance', today);
            }
        }
    }
}

// Admin action functions
function deleteFeature(featureId) {
    if (window.session_info?.role !== 'admin') {
        alert('Access denied. Admin privileges required.');
        return;
    }
    
    if (confirm('Are you sure you want to delete this feature? This action cannot be undone.')) {
        // Here you would typically send this to your backend
        console.log(`Deleting feature ${featureId}`);
        alert(`Feature ${featureId} has been marked for deletion`);
        
        // Remove the feature from the map
        if (window.lastSelectedFeature) {
            // You would typically remove from the vector source here
            console.log('Feature removed from map');
        }
    }
}

function changePermissions(featureId) {
    if (window.session_info?.role !== 'admin') {
        alert('Access denied. Admin privileges required.');
        return;
    }
    
    const permissions = prompt('Enter new permissions (public, private, restricted):');
    if (permissions && ['public', 'private', 'restricted'].includes(permissions)) {
        console.log(`Changing permissions for feature ${featureId} to ${permissions}`);
        alert(`Permissions updated to: ${permissions}`);
        
        // Update the feature properties locally
        if (window.lastSelectedFeature) {
            window.lastSelectedFeature.set('permissions', permissions);
        }
    } else if (permissions) {
        alert('Invalid permission level. Use: public, private, or restricted');
    }
}

// Make these functions globally available
window.scheduleMaintenanceTask = scheduleMaintenanceTask;
window.updateMaintenanceStatus = updateMaintenanceStatus;
window.deleteFeature = deleteFeature;
window.changePermissions = changePermissions;
window.on_select = on_select;


    //Important function to reload the map at the current location
    //Acts as a refresh as openlayers refresh functionality doesn't really work natively
    async function reloadMapAtCurrentLocation(map) {
        try {
          //const coords = await getCurrentLocation();
          map.getView().setCenter(window.coordinates);
          map.getView().setZoom(window.zoomLevel); // Set your desired zoom level

          //New logic which stores location and zoomlevel, then reloads the whole DOM
           // Store in localStorage
          localStorage.setItem('map_center', JSON.stringify(window.coordinates));
          localStorage.setItem('map_zoom', window.zoomLevel);
          // Reload the page
          window.location.reload();
         
          //Old logic for reloads, which didn't quite work
          //map.updateSize();
          //map.renderSync();
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

        //Update Track Information panel user class
        if (typeof window.setUserClass === 'function') {
            window.setUserClass(role || 'public');
        }

        switch(role) {
            case 'user': 
            //General users get basic map setup
                map.setLayers([/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts, pg_public]);
                 //Update select interactions to just the original layer
                 //selectInteraction.set('layers', [pg_public]);
                 //modifyInteraction.set('features',[pg_public]);
                editorDiv.style.lineHeight = '1.4'; // Default for other roles
                editorDiv.style.paddingTop = '4px';


                // For each line (split by <br> or newline), insert a .edit-meta span above it
                // We'll split the HTML by <br> tags and wrap each line
                const lines = input.innerHTML.split(/<br\s*\/?>|\n/);
                input.innerHTML = ''; // Clear current content

                lines.forEach((line, idx) => {
                    // Create the meta span
                    const metaSpan = document.createElement('span');
                    metaSpan.className = 'edit-meta';
                    metaSpan.textContent = 'No edit info'; // Or fill with info if available

                    // Create the line div/span
                    const lineDiv = document.createElement('div');
                    lineDiv.innerHTML = line;

                    // Append meta and line to input
                    input.appendChild(metaSpan);
                    input.appendChild(lineDiv);
                });

                break;
            case 'moderator': 
            //Moderators get to see existing tracks PLUS CHANGES IN ANOTHER COLOUR
            //Changes are the pending changes in the live=pending field. 
                map.setLayers([/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts,pg_public,
                  pg_pending
                ]);
                //Update select and modify interactions to include the pending layer

                //const currentLayers = selectInteraction.getLayers().getArray();
                //selectInteraction.set('layers', currentLayers.concat([pg_pending]));
                        //Run functions based on users?
                editorDiv.style.lineHeight = '2.5'; // Increased line padding for moderators
                editorDiv.style.paddingTop = '18px'; // Optional: extra space above line

                break;

        }


        
    }

