    import html2canvas from 'html2canvas';

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
    import CircleStyle from 'ol/style/Circle';
    
  
    





 //geoserver2_BASE
 //Set in .env.production or .env.development
 const geoserver2_BASE = import.meta.env.VITE_geoserver2_BASE;
//const geoserver2_BASE = 'https://geoserver2.wilsonenv.nz/';




  //Window.onpageload to check for session information
  window.session_info=new Object;

  // ─── Error Reporting System ─────────────────────────────────────────────────
  //
  // Captures console.error / console.warn output and unhandled JS errors so
  // that a logged-in user can attach recent diagnostics to a manual report.
  // The "Report Error" button (shown only when logged in) opens a modal where
  // the user writes a free-text description, optionally captures a screenshot
  // with html2canvas, and submits the bundle to POST /api/report-error.

  const MAX_LOG_ENTRIES = 30;
  window._errorLogBuffer = [];   // recent console.error / console.warn messages
  window._caughtErrors   = [];   // uncaught JS errors / unhandled rejections

  // --- intercept console.error and console.warn ---
  const _origConsoleError = console.error.bind(console);
  const _origConsoleWarn  = console.warn.bind(console);

  console.error = function (...args) {
      window._errorLogBuffer.push({
          level: 'error',
          message: args.map(a => (a instanceof Error ? a.stack || a.message : String(a))).join(' '),
          ts: new Date().toISOString()
      });
      if (window._errorLogBuffer.length > MAX_LOG_ENTRIES) window._errorLogBuffer.shift();
      _origConsoleError(...args);
  };

  console.warn = function (...args) {
      window._errorLogBuffer.push({
          level: 'warn',
          message: args.map(a => String(a)).join(' '),
          ts: new Date().toISOString()
      });
      if (window._errorLogBuffer.length > MAX_LOG_ENTRIES) window._errorLogBuffer.shift();
      _origConsoleWarn(...args);
  };

  // --- capture uncaught errors ---
  window.onerror = function (message, source, lineno, colno, error) {
      window._caughtErrors.push({
          message,
          source,
          lineno,
          colno,
          stack: error ? error.stack : null,
          ts: new Date().toISOString()
      });
      if (window._caughtErrors.length > 10) window._caughtErrors.shift();
      return false; // don't suppress
  };

  window.addEventListener('unhandledrejection', function (event) {
      const reason = event.reason;
      window._caughtErrors.push({
          message: reason instanceof Error ? reason.message : String(reason),
          stack:   reason instanceof Error ? reason.stack   : null,
          ts: new Date().toISOString()
      });
      if (window._caughtErrors.length > 10) window._caughtErrors.shift();
  });

  // --- show / hide the floating report-error button ---
  function setReportErrorButtonVisible(visible) {
      const btn = document.getElementById('report_error_btn');
      if (btn) btn.style.display = visible ? 'flex' : 'none';
  }

  // --- screenshot capture via html2canvas ---
  async function captureScreenshot() {
      try {
          // Attempt to capture the full page; fall back gracefully on errors.
          const canvas = await html2canvas(document.body, {
              scale: 0.6,
              logging: false,
              useCORS: true,
              allowTaint: true,
              ignoreElements: el => el.id === 'reportErrorModal'
          });
          return canvas.toDataURL('image/jpeg', 0.55);
      } catch (e) {
          _origConsoleWarn('html2canvas capture failed:', e);
          return null;
      }
  }

  // --- open the Report Error modal ---
  window.openReportErrorModal = async function (prefillMessage, prefillStack) {
      const modal = document.getElementById('reportErrorModal');
      if (!modal) return;

      // Reset state
      document.getElementById('reportErrorContent').style.display = 'block';
      document.getElementById('reportErrorSuccess').style.display = 'none';
      document.getElementById('error_description').value = '';
      document.getElementById('screenshot_status').textContent = '';
      document.getElementById('screenshot_preview_container').style.display = 'none';
      document.getElementById('screenshot_upload').value = '';
      window._reportErrorScreenshotData = null;

      // Pre-populate captured error details
      const errors = [...window._caughtErrors];
      if (prefillMessage) {
          errors.unshift({ message: prefillMessage, stack: prefillStack || null, ts: new Date().toISOString() });
      }
      const capturedSection = document.getElementById('captured_errors_section');
      const capturedDisplay = document.getElementById('captured_errors_display');
      if (errors.length > 0) {
          const latest = errors[errors.length - 1];
          capturedDisplay.textContent =
              (latest.message || '') +
              (latest.stack ? '\n\n' + latest.stack : '') +
              (latest.source ? '\n  at ' + latest.source + ':' + latest.lineno : '');
          capturedSection.style.display = 'block';
      } else {
          capturedSection.style.display = 'none';
      }

      modal.style.display = 'block';

      // Auto-capture screenshot in background
      const statusEl = document.getElementById('screenshot_status');
      statusEl.textContent = 'Capturing screenshot…';
      const dataUrl = await captureScreenshot();
      if (dataUrl) {
          window._reportErrorScreenshotData = dataUrl;
          const preview = document.getElementById('screenshot_preview');
          preview.src = dataUrl;
          document.getElementById('screenshot_preview_container').style.display = 'block';
          statusEl.textContent = 'Screenshot captured ✓';
      } else {
          statusEl.textContent = 'Auto-capture unavailable — please upload manually if needed.';
      }
  };

  // ─── End Error Reporting System ──────────────────────────────────────────────

  window.onload = async function() {
    // Check if a session exists.

    const get_session = await fetch('/api/get_session', {
        method: 'GET'
    }).then(response => response.json()).then(data => {
        if (data.ok) {
        // Display session information
        console.log(data);

        //Update username info
        document.getElementById("username_field").innerHTML=`${data.username}`;
        
        //Show settings button
        showSettingsButton(true);
        setReportErrorButtonVisible(true);
        
        //Update login button to show LOGOUT
        const loginBtn = document.getElementById("login");
        if (loginBtn) {
            loginBtn.innerHTML = "LOGOUT";
        }

        //Update map layers based on permissions
        ///Uses the same function as for other login/session actions
        reloadUserSettings(map,data.role);

        //Update Track Information panel user class
        if (typeof window.setUserClass === 'function') {
            window.setUserClass(data.role || 'public');
        }

        //Add to window object for session
        Object.assign(window.session_info,data);

        // Fix race condition: if a track was already selected before session loaded,
        // retroactively update save button visibility based on actual role
        if (window.lastSelectedFeature) {
            saveControlDiv.style.visibility = (data.role === 'user' || data.role === 'moderator') ? 'visible' : 'hidden';
        }

        } else {
        //No existing session, user is public/logged out
        console.log('No existing session, setting public role');
        
        //Set public role in session_info
        window.session_info.role = 'public';
        
        //Hide settings button for public users
        showSettingsButton(false);
        setReportErrorButtonVisible(false);
        
        //Ensure login button shows LOGIN
        const loginBtn = document.getElementById("login");
        if (loginBtn) {
            loginBtn.innerHTML = "LOGIN";
        }
        
        //Clear username display
        document.getElementById("username_field").innerHTML = '';
        
        //Set up public user layers and settings
        reloadUserSettings(map, 'public');
        
        //Update Track Information panel user class
        if (typeof window.setUserClass === 'function') {
            window.setUserClass('public');
        }
        }
      }).catch(error => {
        // Network error - treat as public
        console.log('Session check failed, setting public role:', error.message);
        window.session_info.role = 'public';
        showSettingsButton(false);
        setReportErrorButtonVisible(false);
        const loginBtn = document.getElementById("login");
        if (loginBtn) loginBtn.innerHTML = "LOGIN";
        document.getElementById("username_field").innerHTML = '';
        reloadUserSettings(map, 'public');
        if (typeof window.setUserClass === 'function') window.setUserClass('public');
      });



}; //window.onLoad function
  
//DOMContextLoaded event listeners:
//Shows a context menu for all elements of the user-edit class
//user-edit class is assigned in the functions.sql EXTENSIONS for postgresql

document.addEventListener('DOMContentLoaded', function () {
    console.log('========================================')
    console.log('MAIN.JSX LOADED - GRID LAYOUT VERSION');
    console.log('========================================');

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

    // ─── Report Error Modal Wiring ───────────────────────────────────────────

    const reportErrorModal = document.getElementById('reportErrorModal');

    // Floating bug button
    document.getElementById('report_error_btn').addEventListener('click', () => {
        window.openReportErrorModal();
    });

    // Close button (×)
    document.getElementById('closeReportErrorModal').addEventListener('click', () => {
        reportErrorModal.style.display = 'none';
    });

    // Close on backdrop click
    window.addEventListener('click', (e) => {
        if (e.target === reportErrorModal) reportErrorModal.style.display = 'none';
    });

    // Cancel button
    document.getElementById('cancel_error_report_btn').addEventListener('click', () => {
        reportErrorModal.style.display = 'none';
    });

    // Close success view
    document.getElementById('close_error_success_btn').addEventListener('click', () => {
        reportErrorModal.style.display = 'none';
    });

    // "Capture Screenshot" button (re-capture)
    document.getElementById('capture_screenshot_btn').addEventListener('click', async () => {
        const statusEl = document.getElementById('screenshot_status');
        statusEl.textContent = 'Capturing…';
        const dataUrl = await captureScreenshot();
        if (dataUrl) {
            window._reportErrorScreenshotData = dataUrl;
            const preview = document.getElementById('screenshot_preview');
            preview.src = dataUrl;
            document.getElementById('screenshot_preview_container').style.display = 'block';
            statusEl.textContent = 'Screenshot captured ✓';
        } else {
            statusEl.textContent = 'Capture failed — please upload manually.';
        }
    });

    // Remove screenshot
    document.getElementById('remove_screenshot_btn').addEventListener('click', () => {
        window._reportErrorScreenshotData = null;
        document.getElementById('screenshot_preview').src = '';
        document.getElementById('screenshot_preview_container').style.display = 'none';
        document.getElementById('screenshot_upload').value = '';
        document.getElementById('screenshot_status').textContent = '';
    });

    // Manual file upload
    document.getElementById('screenshot_upload').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            document.getElementById('screenshot_status').textContent = 'Only image files are accepted.';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            window._reportErrorScreenshotData = e.target.result;
            document.getElementById('screenshot_preview').src = e.target.result;
            document.getElementById('screenshot_preview_container').style.display = 'block';
            document.getElementById('screenshot_status').textContent = 'Image uploaded ✓';
        };
        reader.readAsDataURL(file);
    });

    // Submit report
    document.getElementById('submit_error_report_btn').addEventListener('click', async () => {
        const description = document.getElementById('error_description').value.trim();
        if (!description) {
            alert('Please describe what happened before submitting.');
            return;
        }

        const submitBtn = document.getElementById('submit_error_report_btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting…';

        // Build error info from captured errors + console buffer
        const latestError = window._caughtErrors[window._caughtErrors.length - 1] || null;

        const payload = {
            error_type:       latestError ? (latestError.stack ? 'unhandled_rejection' : 'ui_error') : 'user_report',
            error_message:    latestError ? latestError.message : null,
            error_stack:      latestError ? latestError.stack   : null,
            user_description: description,
            page_url:         window.location.href,
            viewport_width:   window.innerWidth,
            viewport_height:  window.innerHeight,
            screenshot_data:  window._reportErrorScreenshotData || null,
            console_log_json: JSON.stringify(window._errorLogBuffer.slice(-20))
        };

        try {
            const response = await fetch('/api/report-error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.ok) {
                document.getElementById('reportErrorContent').style.display = 'none';
                document.getElementById('reportErrorSuccess').style.display = 'block';
                // Clear captured errors so next report starts fresh
                window._caughtErrors = [];
            } else {
                alert('Could not submit report: ' + (data.message || 'Unknown error'));
            }
        } catch (err) {
            alert('Network error submitting report. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Report';
        }
    });

    // ─── End Report Error Modal Wiring ───────────────────────────────────────
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
    // Check if user is logged in
    if (window.session_info && window.session_info.username) {
        // User is logged in, perform logout
        logout();
    } else {
        // User is not logged in, show login modal
        modal.style.display = "block";
    }
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
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
        });
        
        if (response.ok) {
            // Clear session info
            window.session_info = {};
            
            // Clear localStorage
            localStorage.clear();
            
            // Update UI immediately
            document.getElementById("username_field").innerHTML = "";
            const loginBtn = document.getElementById("login");
            if (loginBtn) {
                loginBtn.innerHTML = "LOGIN";
            }
            
            // Hide settings button
            showSettingsButton(false);
            setReportErrorButtonVisible(false);
            
            // Wait a moment for the session to be destroyed on the server
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Reload the page to reset everything
            window.location.reload();
        } else {
            // Handle logout error
            alert('Logout failed. Please try again.');
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
  }
  
  // Settings button - opens account management modal
  const settingsBtn = document.getElementById("settings_btn");
  
  // Show settings button when logged in
  function showSettingsButton(show) {
      if (settingsBtn) {
          settingsBtn.style.display = show ? "inline-block" : "none";
      }
  }
  
  // Settings button click handler - opens account management
  if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
          loadAccountManagement();
          accountModal.style.display = "block";
      });
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
        
        //Show settings button
        showSettingsButton(true);
        setReportErrorButtonVisible(true);
        
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

        // If a track is already selected, show the save button now that role is known
        if (window.lastSelectedFeature) {
            saveControlDiv.style.visibility = (data.role === 'user' || data.role === 'moderator') ? 'visible' : 'hidden';
        }

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
          
          // Load email preferences
          try {
              const settingsResponse = await fetch('/api/user/settings');
              if (settingsResponse.ok) {
                  const settingsData = await settingsResponse.json();
                  document.getElementById('pref_email_updates').checked = settingsData.settings.email_updates !== false;
                  document.getElementById('pref_email_newsletter').checked = settingsData.settings.email_newsletter !== false;
              }
          } catch (e) {
              console.log('Could not load email preferences');
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
      try {
          const response = await fetch('/api/user/profile');
          if (response.status === 401) {
              alert('Your session has expired. Please log in again.');
              accountModal.style.display = 'none';
              modal.style.display = 'block';
              return;
          }
          if (!response.ok) throw new Error('Failed to load profile');
          const data = await response.json();
          const user = data.user;
          
          document.getElementById('edit_username').value = user.username;
          document.getElementById('edit_email').value = user.email || '';
          
          document.getElementById('accountContent').style.display = 'none';
          document.getElementById('editProfileForm').style.display = 'block';
      } catch (error) {
          alert('Could not load profile. Please try again.');
      }
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
  
  // Save Email Preferences
  document.getElementById('saveEmailPrefsBtn').addEventListener('click', async () => {
      try {
          const emailUpdates = document.getElementById('pref_email_updates').checked;
          const emailNewsletter = document.getElementById('pref_email_newsletter').checked;
          
          const response = await fetch('/api/user/settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  email_updates: emailUpdates,
                  email_newsletter: emailNewsletter
              })
          });
          
          if (response.ok) {
              alert('Email preferences saved successfully!');
          } else {
              alert('Failed to save preferences');
          }
      } catch (error) {
          alert('Failed to save preferences');
      }
  });
  
  // Unsubscribe from All
  document.getElementById('unsubscribeAllBtn').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to unsubscribe from all email communications? This action will be recorded.')) {
          return;
      }
      
      try {
          const response = await fetch('/api/user/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  reason: 'User requested unsubscribe from account settings'
              })
          });
          
          if (response.ok) {
              document.getElementById('pref_email_updates').checked = false;
              document.getElementById('pref_email_newsletter').checked = false;
              alert('You have been unsubscribed from all email communications.');
          } else {
              alert('Failed to unsubscribe');
          }
      } catch (error) {
          alert('Failed to unsubscribe');
      }
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
      src: 'house-xxl.png', // Path to your icon image
      anchor: [0.5, 1], // Anchor point of the icon (center bottom)
      scale: 1, // Scale of the icon
      color: '#D32F2F', // Red tint applied to the icon
    }),
  });

  // Pre-built selected style (same src so image is already cached)
  const iconStyle_hut_selected = new Style({
    image: new Icon({
      src: 'house-xxl.png',
      anchor: [0.5, 1],
      scale: 1.3,
      color: '#FF6600',
    }),
  });

  const pg_doc_huts = new VectorLayer({
    // /background: 'white',
    source: new VectorSource({
        //ONLY ASK FOR SOME PROPERTIES TO AVOID FILLING UP FORMS
        //CAN BE CHANGED
        url: geoserver2_BASE+'collections/public.doc_huts/items.json?limit=1000',
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
    pg_doc_huts.setZIndex(40);


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

    // LINZ Aerial (optional fallback)
    const linz_aerial = new TileLayer({
        source: new XYZ({
            url: 'https://basemaps.linz.govt.nz/v1/tiles/aerial/3857/{z}/{x}/{y}.png?api=20b10a680c3742798647ec56775918a4',
            attributions: 'Sourced from LINZ. Crown Copyright reserved.',
            maxZoom: 19,
        }),
        visible: false,
    });
    linz_aerial.setZIndex(-110);

    // LINZ Topo50 base layer
    const topo50_layer = new TileLayer({
        source: new XYZ({
            url: 'https://tiles-cdn.koordinates.com/services;key=20b10a680c3742798647ec56775918a4/tiles/v4/layer=50767/EPSG:3857/{z}/{x}/{y}.png',
            attributions: 'Sourced from LINZ. Crown Copyright reserved.',
            maxZoom: 19,
        }),
        visible: true,
    });
    topo50_layer.getSource().on('tileloaderror', () => {
        console.warn('LINZ Topo50 tile failed to load. Check LINZ/Koordinates API key and layer ID.');
    });
    topo50_layer.setOpacity(1);
    topo50_layer.setZIndex(-100);

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
            url: geoserver2_BASE+'collections/public.permolat_tracks_prod/items.json?limit=500&properties=lastcut,nextcut,geom,id,trackname,layer_name,importance,tracktype,currentcon,custodian&filter=current_version=false',
            format: new GeoJSON(),
            wrapX: false,
            name: 'permolat_tracks_pending',
            //projection: 'EPSG:2193',
            ZIndex:10,
        }),
        style: [pg_pending_flash_on_style,pg_pending_flash_off_style],
        });
        pg_pending.setMinZoom(8);
        // Keep pending edits on top of all other overlays.
        pg_pending.setZIndex(50);
  
   
   
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
        url: geoserver2_BASE+'collections/public.permolat_tracks_prod/items.json?limit=1000&properties=lastcut,nextcut,geom,id,trackname,layer_name,importance,tracktype,currentcon,custodian&filter=current_version=true',
        format: new GeoJSON(),
        wrapX: false,
        name: 'permolat_tracks',
        //projection: 'EPSG:2193',
    }),
    style: [lightStroke_permolat, darkStroke_permolat],
    });
    pg_public.setMinZoom(6);
    pg_public.setZIndex(20);


    const pg_doc = new VectorLayer({
        // /background: 'white',
        source: new VectorSource({
            url: geoserver2_BASE+'collections/public.doc_tracks/items.json?limit=1000',
            format: new GeoJSON(),
            wrapX: false,
            minZoom: 8, //minimum zoom level
            //projection: 'EPSG:2193',
        }),
        style: [lightStroke_doc, darkStroke_doc],
        });
    pg_doc.setMinZoom(8);
    pg_doc.setZIndex(30);
    
    
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

            if (response.status === 401) {
                alert('Your session has expired. Please log in again to save changes.');
                document.getElementById('login').click();
                return;
            }

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

            if (response.status === 401) {
                alert('Your session has expired. Please log in again.');
                document.getElementById('login').click();
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();

            //source.changed(); //Another way to redraw lauyer
            pg_public.getSource().changed(); // Redraw the layer
            pg_public.getSource().refresh(); // Redraw the layer
            reloadMapAtCurrentLocation(map);

            return responseData;

        } catch (error) {
            console.error('Error during fetch operation:', error);
            throw error; // re-throw the error to be handled by the caller
        }
        
    }//end rollback

    // Fetch version count for a track and update badge
    async function fetchVersionCount(trackId, badgeElement) {
        try {
            const response = await fetch(`/api/track-versions/${trackId}`);
            if (!response.ok) return;
            
            const data = await response.json();
            if (!data.success) return;
            
            // Count pending versions
            const pendingCount = data.versions.filter(v => v.status === 'pending').length;
            const totalVersions = data.versions.length;
            
            if (totalVersions > 0) {
                badgeElement.style.display = 'inline';
                if (pendingCount > 0) {
                    badgeElement.textContent = `${pendingCount} pending`;
                    badgeElement.style.background = '#FF9800';
                } else {
                    badgeElement.textContent = `${totalVersions} edit${totalVersions !== 1 ? 's' : ''}`;
                    badgeElement.style.background = '#4CAF50';
                }
            }
        } catch (error) {
            console.log('Could not fetch version count:', error.message);
        }
    }

    // Handle button click for view track history
    async function view_track_history_onclick(e) {
        e.preventDefault();
        
        const diffPanel = document.getElementById('bottom-panel-diff');
        const geometryPanel = document.getElementById('bottom-panel-geometry');
        
        // Get the currently selected feature
        if (!window.lastSelectedFeature) {
            alert('No track selected. Please select a track first.');
            return;
        }
        
        const properties = window.lastSelectedFeature.getProperties();
        const trackId = properties.id;
        const trackName = properties.trackname || 'Unknown Track';
        
        console.log('Fetching track history for trackId:', trackId, 'trackName:', trackName);
        
        // Show loading message
        diffPanel.innerHTML = '<div style="padding: 10px; text-align: center; color: #333;"><h5>Loading track history...</h5></div>';
        geometryPanel.innerHTML = '<div style="padding: 10px; text-align: center; color: #333;"><h5>Loading geometries...</h5></div>';
        
        try {
            console.log('Making fetch request to:', `/api/track-versions/${trackId}`);
            const response = await fetch(`/api/track-versions/${trackId}`, {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });
            console.log('Response status:', response.status, 'ok:', response.ok);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response not OK. Status:', response.status, 'Body:', errorText);
                throw new Error('Failed to fetch track versions: ' + response.status);
            }
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (!data.success) {
                throw new Error(data.message || 'Unknown error');
            }
            
            // Handle case where there are no versions yet
            if (data.versions.length === 0) {
                diffPanel.innerHTML = `
                    <div style="padding: 10px; font-family: 'Courier New', monospace; color: #333;">
                        <div style="margin-bottom: 10px; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">
                            <h5 style="color: #1976d2; margin: 0; font-size: 12px;">📋 ${trackName}</h5>
                        </div>
                        <div style="text-align: center; padding: 20px 10px; color: #666;">
                            <p style="font-size: 12px; margin-bottom: 5px;">🌱 No edit history yet</p>
                            <p style="font-size: 11px;">Make changes and save to create the first version.</p>
                        </div>
                    </div>
                `;
                geometryPanel.innerHTML = '<div style="padding: 10px; text-align: center; color: #666; font-size: 11px;">No geometry versions</div>';
                return;
            }
            
            // Build the diff display HTML for the diff panel
            const versionsHtml = buildVersionDiffDisplay(data.versions, data.trackedFields, trackName);
            diffPanel.innerHTML = versionsHtml;
            
            // Load any existing comments into the diff panel
            await loadAllVersionComments();
            
            // Build the geometry versions panel
            const geometryHtml = buildGeometryVersionsPanel(data.versions, trackId, trackName);
            geometryPanel.innerHTML = geometryHtml;
            
        } catch (error) {
            console.error('Error fetching track history:', error);
            diffPanel.innerHTML = `<div style="padding: 10px; color: #d32f2f; font-size: 11px;">⚠️ Error: ${error.message}</div>`;
        }
    }

    // Build a git-like diff display for track versions
    function buildVersionDiffDisplay(versions, trackedFields, trackName) {
        // Field labels for display
        const fieldLabels = {
            trackname: 'Track Name',
            importance: 'Importance',
            tracktype: 'Track Type',
            currentcon: 'Current Condition',
            custodian: 'Custodian',
            lastcut: 'Last Cut',
            nextcut: 'Next Cut'
        };
        
        // Format date for display
        const formatDate = (timestamp) => {
            if (!timestamp) return 'N/A';
            const date = new Date(timestamp);
            return date.toLocaleString('en-NZ', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };
        
        // Format Unix timestamp (for lastcut/nextcut)
        const formatUnixDate = (val) => {
            if (!val) return 'Not set';
            // Check if it's already a timestamp number
            const timestamp = typeof val === 'number' ? val : parseFloat(val);
            if (isNaN(timestamp)) return String(val);
            const date = new Date(timestamp * 1000);
            return date.toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' });
        };
        
        // Build header - compact for quarter panel
        let html = `
            <div style="padding: 8px; font-family: 'Courier New', monospace; color: #333;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">
                    <h5 style="color: #1976d2; margin: 0; font-size: 11px;">📋 ${trackName}</h5>
                    <span style="color: #666; font-size: 10px;">${versions.length} ver.</span>
                </div>
        `;
        
        // Build version timeline (reversed to show newest first)
        const reversedVersions = [...versions].reverse();
        
        reversedVersions.forEach((version, idx) => {
            const isFirstVersion = version.isFirstVersion;
            const hasDiffs = Object.keys(version.diffs || {}).length > 0;
            
            // Version header styling
            const headerColor = version.status === 'approved' ? '#2196F3' : '#FF9800';
            const statusBadge = version.status || 'pending';
            const userId = window.session_info?.userid;
            const userRole = window.session_info?.role;
            const isLoggedIn = userId && userRole !== 'public';
            const canContactAuthor = isLoggedIn && version.added_by !== userId && version.added_by;
            
            html += `
                <div style="margin-bottom: 8px; background: #f9f9f9; border-radius: 4px; border-left: 3px solid ${headerColor}; overflow: hidden; border: 1px solid #ddd; font-size: 10px;">
                    <!-- Version Header -->
                    <div style="padding: 4px 6px; background: #e8e8e8; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-weight: bold; color: ${headerColor};">v${version.version_id}</span>
                            <span style="background: ${headerColor}; color: white; padding: 1px 4px; border-radius: 6px; font-size: 8px; text-transform: uppercase;">${statusBadge}</span>
                        </div>
                        <div style="font-size: 9px; color: #555;">${formatDate(version.added_timestamp)}</div>
                    </div>
                    
                    <!-- Author Info - compact with message button -->
                    <div style="padding: 3px 6px; background: #f0f0f0; font-size: 9px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="color: #1976d2;">👤 ${version.added_by_username || 'Unknown'}</span>
                            ${version.reviewed_by ? `<span style="color: #388e3c; margin-left: 8px;">✅</span>` : ''}
                            ${version.moderated_by ? `<span style="color: #7b1fa2; margin-left: 4px;">🛡️</span>` : ''}
                        </div>
                        ${canContactAuthor ? `<button onclick="window.contactVersionAuthor(${version.version_id}, '${version.added_by_username}')" 
                            style="background: #9C27B0; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 8px; cursor: pointer;">✉️ Message</button>` : ''}
                    </div>
                    
                    <!-- Diff Content -->
                    <div style="padding: 6px 8px;">
            `;
            
            if (hasDiffs) {
                // Show diffs with strikethrough for removed and underline for added
                html += `<div style="display: flex; flex-direction: column; gap: 4px;">`;
                
                Object.entries(version.diffs).forEach(([field, diff]) => {
                    const oldVal = (field === 'lastcut' || field === 'nextcut') ? formatUnixDate(diff.old) : (diff.old || '<em>empty</em>');
                    const newVal = (field === 'lastcut' || field === 'nextcut') ? formatUnixDate(diff.new) : (diff.new || '<em>empty</em>');
                    
                    html += `
                        <div style="background: #f5f5f5; border: 1px solid #ddd; border-radius: 3px; overflow: hidden; font-size: 10px;">
                            <div style="padding: 3px 6px; background: #e0e0e0; font-weight: 600; color: #333;">
                                ${fieldLabels[field] || field}
                            </div>
                            <div style="padding: 4px 6px; font-family: 'Courier New', monospace;">
                                <span style="color: #c62828; text-decoration: line-through; background: #ffcdd2; padding: 1px 3px; border-radius: 2px;">${oldVal}</span>
                                <span style="color: #666; margin: 0 4px;">→</span>
                                <span style="color: #2e7d32; text-decoration: underline; background: #c8e6c9; padding: 1px 3px; border-radius: 2px;">${newVal}</span>
                            </div>
                        </div>
                    `;
                });
                
                html += `</div>`;
            } else {
                html += `<div style="color: #666; font-style: italic; font-size: 10px;">No field changes</div>`;
            }
            
            // Comments - compact version
            if (version.comments && version.comments !== 'Original') {
                html += `
                    <div style="margin-top: 6px; padding: 4px 6px; background: #fff9e6; border-left: 2px solid #ffa726; border-radius: 2px; font-size: 10px;">
                        <span style="color: #333;">${version.comments}</span>
                    </div>
                `;
            }
            
            // Action buttons section
            const canReview = !version.reviewed_by && version.added_by !== userId && userRole && userRole !== 'public';
            const canModerate = version.status === 'pending' && (userRole === 'moderator' || userRole === 'sysadmin');
            
            if (canReview || canModerate || isLoggedIn) {
                html += `
                    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                `;
                
                if (canReview) {
                    html += `
                        <button onclick="window.submitPeerReview(${version.version_id})" 
                                style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            ✅ Peer Review
                        </button>
                    `;
                }
                
                if (canModerate) {
                    html += `
                        <button onclick="window.submitModeration(${version.version_id}, 'approve')" 
                                style="background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            🛡️ Approve
                        </button>
                        <button onclick="window.submitModeration(${version.version_id}, 'reject')" 
                                style="background: #F44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            ❌ Reject
                        </button>
                    `;
                }
                
                // Comment and contact buttons for all logged-in users
                if (isLoggedIn) {
                    html += `
                        <button onclick="window.addVersionComment(${version.version_id})" 
                                style="background: #607D8B; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            💬 Add Comment
                        </button>
                    `;
                    
                    if (canContactAuthor) {
                        html += `
                            <button onclick="window.contactVersionAuthor(${version.version_id}, '${version.added_by_username}')" 
                                    style="background: #9C27B0; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                ✉️ Contact Author
                            </button>
                        `;
                    }
                }
                
                html += `</div>`;
            }
            
            html += `
                    <!-- Comments for this version -->
                    <div id="comments-${version.version_id}" data-version-id="${version.version_id}" style="margin-top: 6px;"></div>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        return html;
    }

    // Build comments panel content
    function buildCommentsPanel(versions) {
        let html = `
            <div style="padding: 8px; font-family: 'Courier New', monospace; color: #333;">
                <div style="margin-bottom: 8px; border-bottom: 2px solid #607D8B; padding-bottom: 5px;">
                    <h5 style="color: #607D8B; margin: 0; font-size: 11px;">💬 Discussion & Actions</h5>
                </div>
        `;
        
        const reversedVersions = [...versions].reverse();
        
        reversedVersions.forEach((version) => {
            const userRole = window.session_info?.role;
            const userId = window.session_info?.userid;
            const canReview = !version.reviewed_by && version.added_by !== userId && userRole && userRole !== 'public';
            const canModerate = version.status === 'pending' && (userRole === 'moderator' || userRole === 'sysadmin');
            const isLoggedIn = userId && userRole !== 'public';
            const canContactAuthor = isLoggedIn && version.added_by !== userId && version.added_by;
            
            html += `
                <div style="margin-bottom: 8px; padding: 6px; background: #f5f5f5; border-radius: 4px; border: 1px solid #ddd; font-size: 10px;">
                    <div style="font-weight: bold; color: #333; margin-bottom: 4px;">v${version.version_id} - ${version.added_by_username || 'Unknown'}</div>
                    
                    <div id="comments-${version.version_id}" data-version-id="${version.version_id}" style="margin-bottom: 6px;">
                        <!-- Comments will be loaded here -->
                    </div>
                    
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            `;
            
            if (canReview) {
                html += `<button onclick="window.submitPeerReview(${version.version_id})" 
                        style="background: #4CAF50; color: white; border: none; padding: 3px 6px; border-radius: 3px; font-size: 9px; cursor: pointer;">✅ Review</button>`;
            }
            
            if (canModerate) {
                html += `<button onclick="window.submitModeration(${version.version_id}, 'approve')" 
                        style="background: #2196F3; color: white; border: none; padding: 3px 6px; border-radius: 3px; font-size: 9px; cursor: pointer;">🛡️ Approve</button>`;
                html += `<button onclick="window.submitModeration(${version.version_id}, 'reject')" 
                        style="background: #F44336; color: white; border: none; padding: 3px 6px; border-radius: 3px; font-size: 9px; cursor: pointer;">❌ Reject</button>`;
            }
            
            if (isLoggedIn) {
                html += `<button onclick="window.addVersionComment(${version.version_id})" 
                        style="background: #607D8B; color: white; border: none; padding: 3px 6px; border-radius: 3px; font-size: 9px; cursor: pointer;">💬 Comment</button>`;
                
                if (canContactAuthor) {
                    html += `<button onclick="window.contactVersionAuthor(${version.version_id}, '${version.added_by_username}')" 
                            style="background: #9C27B0; color: white; border: none; padding: 3px 6px; border-radius: 3px; font-size: 9px; cursor: pointer;">✉️ Contact</button>`;
                }
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        return html;
    }

    // Build geometry versions panel
    function buildGeometryVersionsPanel(versions, trackId, trackName) {
        let html = `
            <div style="padding: 8px; font-family: 'Courier New', monospace; color: #333;">
                <div style="margin-bottom: 8px; border-bottom: 2px solid #ff5722; padding-bottom: 5px;">
                    <h5 style="color: #ff5722; margin: 0; font-size: 11px;">🗺️ Geometry Versions</h5>
                </div>
                <div style="margin-bottom: 8px;">
                    <button onclick="window.clearGeometryOverlay()" 
                            style="background: #757575; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 10px; cursor: pointer; width: 100%;">
                        🗑️ Clear All Overlays
                    </button>
                </div>
        `;
        
        const reversedVersions = [...versions].reverse();
        
        // Color palette for different versions
        const colors = ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800', '#ff5722'];
        
        reversedVersions.forEach((version, idx) => {
            const color = colors[idx % colors.length];
            const hasGeometry = version.geom_wkt || version.has_geometry;
            
            html += `
                <div style="margin-bottom: 6px; padding: 6px; background: #f5f5f5; border-radius: 4px; border: 1px solid #ddd; border-left: 3px solid ${color}; font-size: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; color: #333;">v${version.version_id}</span>
                        <span style="color: #666; font-size: 9px;">${version.added_by_username || 'Unknown'}</span>
                    </div>
                    <div style="margin-top: 4px;">
                        <button onclick="window.showGeometryVersion(${version.version_id}, '${color}')" 
                                style="background: ${color}; color: white; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-right: 4px;">
                            👁️ Show on Map
                        </button>
                        <button onclick="window.hideGeometryVersion(${version.version_id})" 
                                style="background: #9e9e9e; color: white; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer;">
                            Hide
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        return html;
    }

    // Geometry overlay management
    window.geometryOverlays = {};
    
    // Show geometry version on map
    window.showGeometryVersion = async function(versionId, color) {
        try {
            // Fetch geometry for this version
            const response = await fetch(`/api/version-geometry/${versionId}`);
            const data = await response.json();
            
            if (!data.success || !data.geometry) {
                alert('No geometry available for this version');
                return;
            }
            
            // Remove existing overlay for this version if exists
            if (window.geometryOverlays[versionId]) {
                map.removeLayer(window.geometryOverlays[versionId]);
            }
            
            // Create GeoJSON format for OpenLayers
            const geojsonFormat = new GeoJSON();
            const feature = geojsonFormat.readFeature(data.geometry, {
                dataProjection: 'EPSG:3857',
                featureProjection: 'EPSG:3857'
            });
            
            // Create vector source and layer
            const vectorSource = new VectorSource({
                features: [feature]
            });
            
            const vectorLayer = new VectorLayer({
                source: vectorSource,
                style: new Style({
                    stroke: new Stroke({
                        color: color,
                        width: 4,
                        lineDash: [8, 4]
                    })
                }),
                zIndex: 100
            });
            
            // Add layer to map
            map.addLayer(vectorLayer);
            window.geometryOverlays[versionId] = vectorLayer;
            
            // Optionally zoom to feature
            const extent = vectorSource.getExtent();
            map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 16 });
            
        } catch (error) {
            console.error('Error showing geometry version:', error);
            alert('Error loading geometry: ' + error.message);
        }
    };
    
    // Hide specific geometry version
    window.hideGeometryVersion = function(versionId) {
        if (window.geometryOverlays[versionId]) {
            map.removeLayer(window.geometryOverlays[versionId]);
            delete window.geometryOverlays[versionId];
        }
    };
    
    // Clear all geometry overlays
    window.clearGeometryOverlay = function() {
        Object.keys(window.geometryOverlays).forEach(versionId => {
            map.removeLayer(window.geometryOverlays[versionId]);
        });
        window.geometryOverlays = {};
    };

    // Submit peer review for a track version
    window.submitPeerReview = async function(versionId) {
        const comments = prompt('Optional: Add review comments');
        
        try {
            const response = await fetch('/api/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version_id: versionId, comments: comments || '' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Peer review submitted successfully!');
                // Refresh the history display
                if (window.lastSelectedFeature) {
                    const fakeEvent = { preventDefault: () => {} };
                    view_track_history_onclick(fakeEvent);
                }
            } else {
                alert('Error: ' + (data.message || 'Failed to submit review'));
            }
        } catch (error) {
            console.error('Review error:', error);
            alert('Error submitting review: ' + error.message);
        }
    };

    // Submit moderation decision for a track version
    window.submitModeration = async function(versionId, action) {
        const actionText = action === 'approve' ? 'approve' : 'reject';
        if (!confirm(`Are you sure you want to ${actionText} this track version?`)) {
            return;
        }
        
        const comments = prompt(`Optional: Add ${actionText} comments`);
        
        try {
            const response = await fetch('/api/moderate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version_id: versionId, action: action, comments: comments || '' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(`Track version ${actionText}d successfully!`);
                // Refresh the history display
                if (window.lastSelectedFeature) {
                    const fakeEvent = { preventDefault: () => {} };
                    view_track_history_onclick(fakeEvent);
                }
            } else {
                alert('Error: ' + (data.message || `Failed to ${actionText} version`));
            }
        } catch (error) {
            console.error('Moderation error:', error);
            alert(`Error ${actionText}ing version: ` + error.message);
        }
    };

    // Add comment to a track version
    window.addVersionComment = async function(versionId) {
        const commentText = prompt('Enter your comment:');
        
        if (!commentText || commentText.trim() === '') {
            return;
        }
        
        try {
            const response = await fetch('/api/version-comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version_id: versionId, comment_text: commentText })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Comment added successfully!');
                // Refresh the full history panel so the new comment is visible
                if (window.lastSelectedFeature) {
                    const fakeEvent = { preventDefault: () => {} };
                    await view_track_history_onclick(fakeEvent);
                }
            } else {
                alert('Error: ' + (data.message || 'Failed to add comment'));
            }
        } catch (error) {
            console.error('Comment error:', error);
            alert('Error adding comment: ' + error.message);
        }
    };

    // Contact version author
    window.contactVersionAuthor = async function(versionId, authorUsername) {
        const message = prompt(`Send a message to ${authorUsername} about this edit:`);
        
        if (!message || message.trim() === '') {
            return;
        }
        
        try {
            const response = await fetch('/api/contact-author', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version_id: versionId, message: message })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(`Message sent to ${authorUsername}!`);
                // Reload comments to show the message
                await loadVersionComments(versionId);
            } else {
                alert('Error: ' + (data.message || 'Failed to send message'));
            }
        } catch (error) {
            console.error('Contact author error:', error);
            alert('Error sending message: ' + error.message);
        }
    };

    // Load comments for a specific version
    async function loadVersionComments(versionId) {
        try {
            const response = await fetch(`/api/version-comments/${versionId}`);
            const data = await response.json();
            
            if (data.success && data.comments.length > 0) {
                const commentsContainer = document.getElementById(`comments-${versionId}`);
                if (!commentsContainer) return;
                
                let html = '<div style="margin-top: 10px; padding: 10px; background: #fafafa; border-radius: 4px; border: 1px solid #e0e0e0;">';
                html += '<div style="font-weight: bold; color: #333; margin-bottom: 8px; font-size: 12px;">💬 Discussion:</div>';
                
                data.comments.forEach(comment => {
                    const isModerator = comment.is_moderator_comment;
                    const moderatorBadge = isModerator ? '<span style="background: #9C27B0; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-left: 5px;">MOD</span>' : '';
                    
                    html += `
                        <div style="margin-bottom: 8px; padding: 8px; background: white; border-left: 3px solid ${isModerator ? '#9C27B0' : '#607D8B'}; border-radius: 3px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 4px;">
                                <strong style="color: #333;">${comment.username}</strong>${moderatorBadge}
                                <span style="margin-left: 8px;">${new Date(comment.created_at).toLocaleString()}</span>
                            </div>
                            <div style="font-size: 12px; color: #333;">${escapeHtml(comment.comment_text)}</div>
                        </div>
                    `;
                });
                
                html += '</div>';
                commentsContainer.innerHTML = html;
            }
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Load comments for all versions after building the diff display
    async function loadAllVersionComments() {
        const commentContainers = document.querySelectorAll('[id^="comments-"]');
        for (const container of commentContainers) {
            const versionId = container.getAttribute('data-version-id');
            if (versionId) {
                await loadVersionComments(versionId);
            }
        }
    }

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


    // Style function: yellow circle highlight for hut points, yellow stroke for line features
    const selectStyle = function(feature) {
        const geomType = feature.getGeometry()?.getType();
        if (geomType === 'Point' || geomType === 'MultiPoint') {
            // Hut: use pre-built orange icon (image already cached)
            return iconStyle_hut_selected;
        }
        // Line / other features: yellow stroke highlight
        return new Style({
            fill: new Fill({ color: '#FFFF00' }),
            stroke: new Stroke({ color: 'rgb(251, 255, 0)', width: 3 }),
        });
    };

    // Select interaction for all layers
    //Except of course if the layer is turned off at the geoserver2 then it won't show to be clicked
    //THIS WAY MAY BE LESS CUMBERSOME THAN TURNING THEM ON AND OFF FOR EACH LAYER BASED ON A USER ROLE
    const selectInteraction= new Select({
        //Choose layers to select
        layers: [pg_public, pg_doc, pg_doc_huts, pg_pending],
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
saveControlDiv.style.visibility = 'hidden';

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


    const map = new Map({
    //NEED FUNCTIONALITY AROUND TURNING OFF AND ON MODIFICATION

    //INTERACTIONS ARE CURRENTLY WRITTEN FOR EACH VECTOR LAYER
    
    interactions: defaultInteractions().extend([selectInteraction, modifyInteraction]),
    controls: defaultControls({attribution: false}).extend([new SaveControl]),
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

    // DEBUG: Log initial layer stack
    console.log('=== MAP INITIALIZED ===');
    map.getLayers().forEach((layer, idx) => {
        console.log(`Layer ${idx}: ${layer.get('name') || 'unnamed'} | ZIndex: ${layer.getZIndex()} | Visible: ${layer.getVisible()} | Source: ${layer.getSource()?.constructor?.name || 'N/A'}`);
    });
    console.log('Topo50 layer details:', { visible: topo50_layer.getVisible(), zindex: topo50_layer.getZIndex(), opacity: topo50_layer.getOpacity() });







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
         //Update window feature
        const geojsonFormat=new GeoJSON();
        const geojsonObject = geojsonFormat.writeFeatureObject(feature);

        //Attach to the window
        window.geojson = geojsonObject;

    });

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
  const customOrder = ['trackname', 'tracktype', 'custodian', 'importance', 'lastcut','nextcut','currentcon'];

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
        console.log('===== ON_SELECT CALLED =====');
        console.log('Event:', event);
        console.log('Selected features:', event.selected);
        //event.preventDefault();

        const selectedFeature = event.selected[0];
        
        // Store selected feature globally for maintenance functions
        window.lastSelectedFeature = selectedFeature;

        if (!selectedFeature) return;

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
        
        // Clear the dateRowContainer for new feature selection
        window.dateRowContainer = null;
        
        // Apply CSS class based on user role for layout and placement of dynamic input boxes
        const userRole = window.session_info?.role || 'public';
        editorDiv.classList.remove('permomap_style_public', 'permomap_style_users', 'permomap_style_moderator', 'layer-permolat_tracks', 'layer-doc_tracks', 'layer-doc_huts');
        
        // Check if this is a DOC-managed layer (read-only for all users)
        const properties = selectedFeature.getProperties();
        let layerName = properties['layer_name'];
        const isDocLayer = layerName === 'doc_tracks' || layerName === 'doc_huts';
        
        // Force public styling for DOC layers (read-only), otherwise use user role
        if (isDocLayer) {
            editorDiv.classList.add('permomap_style_public');
        } else {
            switch(userRole) {
                case 'public':
                    editorDiv.classList.add('permomap_style_public');
                    break;
                case 'user':
                    editorDiv.classList.add('permomap_style_users');
                    break;
                case 'moderator':
                    editorDiv.classList.add('permomap_style_users', 'permomap_style_moderator');
                    break;
                default:
                    editorDiv.classList.add('permomap_style_public');
            }
        }
        
        console.log('Applied role class:', isDocLayer ? 'public (DOC layer)' : userRole, editorDiv.className);
        
        if (event.selected.length > 0) 
        {
          
            
            
            // Add layer-specific CSS class based on layer_name
            if (layerName) {
                editorDiv.classList.add('layer-' + layerName);
                console.log('Applied layer class: layer-' + layerName, editorDiv.className);
            }

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
            // Handle doc_huts layer - check for hut-specific properties
            if (!properties['layer_name'] && (properties['name'] || properties['hut_name'] || properties['hutname'])) {
                titleDiv.innerText='DOC Huts';
                layerName='DOC Huts';
                editorDiv.classList.add('layer-doc_huts');
            }
        
        
            //console.log(selectedFeature);
            //Sort the properties array into desired order for editing
            const sortedObject = sortObjectByKeys(properties, customOrder);
            console.log('=== SORTED OBJECT KEYS ===', Object.keys(sortedObject));
            var label_content;
            var inputtype
            inputtype='text';
            for (const key in sortedObject) 
            {
                console.log('Processing field key:', key, 'value:', sortedObject[key]);
                
                if (key!=='geometry' && key!=='layer_name' //&& key!=='id'
                  ) 
                {
                    
                    switch (key) {
                        case 'trackname': 
                            label_content='Track Name';
                            break;
                        case 'id':
                            // Skip id field - it's included in trackname label
                            continue;
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
                    
                    const label = document.createElement('label');
                    label.textContent = label_content;
                    // All styling handled by CSS classes - no inline styles

                    //const meta=document.createElement('span');
                    //meta.className='edit-meta';


                    //Editable input box
                    // Use native date input for date fields, contentEditable div for others
                    const isDateField = (key === 'lastcut' || key === 'nextcut');
                    const isCustodianField = (key === 'custodian');
                    const input = document.createElement(isDateField ? 'input' : 'div');
                    
                    // Use different class for date inputs to avoid contentEditable CSS conflicts
                    if (isDateField) {
                        input.className = 'date-field';
                    } else {
                        input.className = 'editable-field';
                    }
                    
                    if (isDateField) {
                        input.type = 'date';
                        
                        // Determine if date field should be editable based on user role and layer type
                        const canEditDate = !isDocLayer && (userRole === 'user' || userRole === 'moderator' || userRole === 'sysadmin');
                        
                        if (canEditDate) {
                            // Ensure date input is interactive
                            input.style.pointerEvents = 'auto';
                            input.style.cursor = 'pointer';
                            input.style.userSelect = 'auto';
                            input.style.webkitUserSelect = 'auto';
                        } else {
                            // Disable date input for public users or DOC layers
                            input.disabled = true;
                            input.style.pointerEvents = 'none';
                            input.style.cursor = 'default';
                            input.style.opacity = '1';
                        }
                        
                        console.log('Creating date input for:', key, 'Type:', input.type, 'Editable:', canEditDate);
                        
                        // Convert Unix timestamp to YYYY-MM-DD format
                        const unixTimestamp = properties[key];
                        if (unixTimestamp) {
                            const date = new Date(unixTimestamp * 1000); // Unix timestamp is in seconds
                            const yyyy = date.getFullYear();
                            const mm = String(date.getMonth() + 1).padStart(2, '0');
                            const dd = String(date.getDate()).padStart(2, '0');
                            input.value = `${yyyy}-${mm}-${dd}`;
                            console.log('Date input value set to:', input.value);
                        }
                    } else {
                        //This class allows the tiptap/quill editor to attach itself to this div. 
                        //input.classList.add('editable'); 
                        
                        // Determine if field should be editable based on user role and layer type
                        // Public users cannot edit, DOC layers are read-only for everyone
                        // Custodian field is read-only if already assigned
                        const canEdit = !isDocLayer && (userRole === 'user' || userRole === 'moderator' || userRole === 'sysadmin');
                        const isFieldEditable = canEdit && !isCustodianField;
                        
                        input.contentEditable = isFieldEditable ? 'true' : 'false';
                        //Set input innerHTML to properties of the layer
                        input.innerHTML = properties[key] || '';
                    }
                    
                    // Base styling is now handled by CSS classes
                    // Only set minimal inline styles if needed for specific cases
                    
                    //Set input name - basically an ID for the state_locking
                    //Use editable-$[key] for this
                    input.name="editable-"+key;
                    
                    // Set data-importance attribute for visual bar display
                    if (key === 'importance' && properties['layer_name'] === 'permolat_tracks') {
                        const rawValue = properties[key];
                        const importanceValue = parseInt(rawValue);
                        
                        console.log('=== IMPORTANCE FIELD DETECTED ===');
                        console.log('Raw value:', rawValue);
                        console.log('Parsed value:', importanceValue);
                        console.log('User Role:', userRole);
                        console.log('Layer Name:', properties['layer_name']);
                        
                        // Check if value is valid (1-5)
                        const isValidImportance = !isNaN(importanceValue) && importanceValue >= 1 && importanceValue <= 5;
                        
                        if (!isValidImportance) {
                            input.setAttribute('data-importance', 'unassigned');
                        } else {
                            input.setAttribute('data-importance', importanceValue.toString());
                        }
                        
                        // Transform into visual bar (same for all user roles)
                        console.log('*** TRANSFORMING IMPORTANCE TO BAR ***');
                        
                        // Transform input into visual bar - override flex styling
                        input.style.position = 'relative';
                        input.style.flex = 'none';
                        input.style.width = '120px';
                        input.style.height = '32px';
                        input.style.padding = '0';
                        input.style.border = '2px solid #B85450';
                        input.style.borderRadius = '16px';
                        input.style.overflow = 'hidden';
                        input.style.fontSize = '0';
                        input.style.boxShadow = '2px 2px 6px rgba(0,0,0,0.15)';
                        input.style.marginBottom = '8px';
                        
                        if (isValidImportance) {
                            // Valid importance: show filled bar
                            input.style.background = '#FDE8E7';
                            
                            // Calculate bar width based on importance (1=100%, 5=20%)
                            const barWidth = 120 - (importanceValue - 1) * 20;
                            const barPercent = (barWidth / 120) * 100;
                            
                            console.log('Bar width:', barPercent + '%', 'for importance:', importanceValue);
                            
                            // Create bar fill
                            const barFill = document.createElement('div');
                            barFill.style.position = 'absolute';
                            barFill.style.top = '0';
                            barFill.style.left = '0';
                            barFill.style.height = '100%';
                            barFill.style.width = barPercent + '%';
                            barFill.style.background = 'linear-gradient(90deg, #B85450 0%, #FFD700 100%)';
                            barFill.style.transition = 'width 0.3s ease';
                            barFill.style.pointerEvents = 'none';
                            
                            // Create text overlay
                            const barText = document.createElement('div');
                            barText.textContent = importanceValue + ' / 5';
                            barText.style.position = 'absolute';
                            barText.style.top = '50%';
                            barText.style.left = '50%';
                            barText.style.transform = 'translate(-50%, -50%)';
                            barText.style.color = 'white';
                            barText.style.fontSize = '11px';
                            barText.style.fontWeight = 'bold';
                            barText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                            barText.style.zIndex = '1';
                            barText.style.fontFamily = 'Courier New, monospace';
                            barText.style.letterSpacing = '1px';
                            barText.style.pointerEvents = 'none';
                            
                            // Clear input and add bar elements
                            input.innerHTML = '';
                            input.appendChild(barFill);
                            input.appendChild(barText);
                        } else {
                            // Invalid/null importance: show "Unassigned" badge
                            input.style.background = '#E0E0E0';
                            input.style.border = '2px dashed #999';
                            
                            const unassignedText = document.createElement('div');
                            unassignedText.textContent = 'UNASSIGNED';
                            unassignedText.style.position = 'absolute';
                            unassignedText.style.top = '50%';
                            unassignedText.style.left = '50%';
                            unassignedText.style.transform = 'translate(-50%, -50%)';
                            unassignedText.style.color = '#666';
                            unassignedText.style.fontSize = '9px';
                            unassignedText.style.fontWeight = 'bold';
                            unassignedText.style.fontFamily = 'Courier New, monospace';
                            unassignedText.style.letterSpacing = '1px';
                            unassignedText.style.pointerEvents = 'none';
                            
                            input.innerHTML = '';
                            input.appendChild(unassignedText);
                        }
                        
                        // Editability controlled by CSS classes, not inline styles
                        // Public users: read-only via CSS pointer-events
                        // User/Moderator: editable via CSS pointer-events
                        if (userRole === 'public' || isDocLayer) {
                            input.contentEditable = 'false';
                            input.style.cursor = 'default';
                            input.style.pointerEvents = 'none';
                        }
                        
                        console.log('Bar transformation complete for all roles');
                    } // END of if (key === 'importance' && properties['layer_name'] === 'permolat_tracks')
                    
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
                    
                    if (key=='custodian' && properties[key]!='') {
                        input.contentEditable = 'false';
                        // Styling is handled by CSS via [contenteditable="false"] selector
                    }
                    
                     
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
                    
                    // Skip keydown handler for date inputs - they need default behavior
                    if (!isDateField) {
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
                    } // End of if (!isDateField) for keydown handler
                    


                    //OnBlur event
                    //Merge the individual character
                    // Skip blur handler for date inputs - they don't use innerHTML
                    if (!isDateField) {
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
                      
                      // Handle date inputs differently - convert to Unix timestamp
                      if (input.type === 'date' && input.value) {
                          const date = new Date(input.value);
                          const unixTimestamp = Math.floor(date.getTime() / 1000);
                          selectedFeature.set(key, unixTimestamp);
                      } else {
                          const value = input.type === 'date' ? input.value : input.innerHTML;
                          selectedFeature.set(key, value);
                      }
                      
                      const geojsonFormat=new GeoJSON();
                      const geojsonObject = geojsonFormat.writeFeatureObject(selectedFeature);
                
                        
                      //Attach to the window
                      
                      window.geojson = geojsonObject;

                      console.log(JSON.stringify(window.geojson));
                  });
                  } // End of if (!isDateField) for blur handler
                  
                  // Add change event handler for date inputs
                  if (isDateField) {
                      input.addEventListener('change', function() {
                          // Convert date input to Unix timestamp
                          if (input.value) {
                              const date = new Date(input.value);
                              const unixTimestamp = Math.floor(date.getTime() / 1000);
                              selectedFeature.set(key, unixTimestamp);
                              
                              const geojsonFormat = new GeoJSON();
                              const geojsonObject = geojsonFormat.writeFeatureObject(selectedFeature);
                              window.geojson = geojsonObject;
                              
                              console.log('Date changed:', key, input.value, 'Unix:', unixTimestamp);
                              console.log(JSON.stringify(window.geojson));
                          }
                      });
                  }
                
                    // Flexbox layout for all fields: label on left, input on right
                    // Exception: importance, lastcut, nextcut use column layout (label above input) and arranged horizontally
                    const flexContainer = document.createElement('div');
                    // Apply same field ordering for all roles - group importance with date fields for permolat_tracks
                    const isImportanceBar = (key === 'importance' && properties['layer_name'] === 'permolat_tracks');
                    // isDateField already declared above
                    const useColumnLayout = isImportanceBar || isDateField;
                    const flexDirection = useColumnLayout ? 'column' : 'row';
                    
                    // Group importance, lastcut, nextcut in horizontal row for all roles on permolat_tracks
                    if (isImportanceBar) {
                        // Create horizontal wrapper to hold importance, lastcut, nextcut
                        window.dateRowContainer = window.dateRowContainer || document.createElement('div');
                        window.dateRowContainer.style.display = 'flex';
                        window.dateRowContainer.style.flexDirection = 'row';
                        window.dateRowContainer.style.gap = '12px';
                        window.dateRowContainer.style.marginBottom = '8px';
                        window.dateRowContainer.style.alignItems = 'flex-start';
                    }
                    
                    flexContainer.style.display = 'flex';
                    flexContainer.style.flexDirection = flexDirection;
                    flexContainer.style.alignItems = 'flex-start';
                    if (useColumnLayout) {
                        flexContainer.style.gap = '4px';
                    } else {
                        flexContainer.style.gap = '12px';
                    }
                    if (!isDateField) {
                        flexContainer.style.marginBottom = '8px';
                    }
                    
                    console.log('Creating flex container for field:', key);
                    
                    // Labels styled by CSS classes - only set content
                    label.textContent = label_content + ':';
                    
                    // Add ID to trackname label
                    if (key === 'trackname' && properties['id']) {
                        label.innerHTML = label_content + ':';
                        const idSpan = document.createElement('span');
                        idSpan.textContent = ' (ID: ' + properties['id'] + ')';
                        idSpan.className = 'track-id-label';
                        label.appendChild(idSpan);
                    }
                    
                    flexContainer.appendChild(label);
                    flexContainer.appendChild(input);
                    
                    // Add avatar after custodian input
                    if (key === 'custodian' && properties[key]) {
                        const custodianName = properties[key];
                        const avatar = document.createElement('div');
                        const initials = custodianName.split(' ').map(word => word.charAt(0).toUpperCase()).join('').substring(0, 2);
                        avatar.textContent = initials;
                        avatar.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #B85450 0%, #FFD700 100%); color: white; font-size: 11px; font-weight: bold; font-family: Courier New, monospace; box-shadow: 0 2px 4px rgba(0,0,0,0.2); flex-shrink: 0;';
                        avatar.title = 'Custodian: ' + custodianName;
                        flexContainer.appendChild(avatar);
                    }
                    
                    // Add separator line after custodian
                    if (key === 'custodian') {
                        flexContainer.style.borderBottom = '2px solid #FFD700';
                        flexContainer.style.paddingBottom = '12px';
                        flexContainer.style.marginBottom = '12px';
                    }
                    
                    // Handle horizontal layout for importance + date fields
                    if (isImportanceBar) {
                        window.dateRowContainer.appendChild(flexContainer);
                        editorDiv.appendChild(window.dateRowContainer);
                    } else if (isDateField && window.dateRowContainer && window.dateRowContainer.parentNode) {
                        // Append date fields to the existing dateRowContainer that's already in the DOM
                        window.dateRowContainer.appendChild(flexContainer);
                    } else {
                        // Regular field - just append normally (don't clear dateRowContainer)
                        editorDiv.appendChild(flexContainer);
                    }
                    
                    console.log('Flex container appended for:', key);
                    //editorDiv.appendChild(meta);

                    //Update meta content
                  
                    updateEditMetaInfo();


                    
                
            }
            
            // Close the for loop here
            }
            
            // Add unobtrusive View Track History link after all fields (outside for loop)
            // Only show for permolat_tracks, not for DOC layers
            if (!isDocLayer && properties['layer_name'] === 'permolat_tracks') {
                // Also fetch version count to show badge
                const historyLinkContainer = document.createElement('div');
                historyLinkContainer.style.cssText = 'margin-top: 15px; padding-top: 10px; border-top: 1px solid #e0e0e0; text-align: center;';
                
                const historyLink = document.createElement('a');
                historyLink.textContent = '📋 View Track History';
                historyLink.href = '#';
                historyLink.id = 'track-history-link';
                historyLink.style.cssText = 'color: #666; font-size: 12px; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;';
                historyLink.onmouseover = function() { this.style.color = '#4CAF50'; this.style.textDecoration = 'underline'; };
                historyLink.onmouseout = function() { this.style.color = '#666'; this.style.textDecoration = 'none'; };
                historyLink.onclick = function(e) {
                    e.preventDefault();
                    view_track_history_onclick(e);
                };
                
                // Add version count badge (will be updated async)
                const versionBadge = document.createElement('span');
                versionBadge.id = 'version-count-badge';
                versionBadge.style.cssText = 'display: none; background: #FF9800; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;';
                historyLink.appendChild(versionBadge);
                
                historyLinkContainer.appendChild(historyLink);
                editorDiv.appendChild(historyLinkContainer);
                
                // Async fetch version count for badge display
                if (properties['id'] && window.session_info?.role) {
                    fetchVersionCount(properties['id'], versionBadge);
                }
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

            // Save button visibility: only for users and moderators, not for public
            if (userRole === 'user' || userRole === 'moderator') {
                saveControlDiv.style.visibility = 'visible';
            } else {
                saveControlDiv.style.visibility = 'hidden';
            }

        }//end if test for no feature classes
   
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
        } else if (panelType === 'admin' && userClass === 'sysadmin') {
            // Add admin information for sysadmins only
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
    if (window.session_info?.role !== 'sysadmin') {
        alert('Access denied. System administrator privileges required.');
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
    if (window.session_info?.role !== 'sysadmin') {
        alert('Access denied. System administrator privileges required.');
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

        console.log('=== RELOAD USER SETTINGS: role=' + role + ' ===');

        switch(role) {
            case 'public':
            //Public users get read-only view with basic layers
                map.setLayers([/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts, pg_public]);
                console.log('Public role: layer stack set');
                editorDiv.style.lineHeight = '1.4';
                editorDiv.style.paddingTop = '4px';
                break;
                
            case 'user': 
            //General users get basic map setup with editing capabilities
                map.setLayers([/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts, pg_public, pg_pending]);
                console.log('User role: layer stack set with pending');
                 //Update select interactions to just the original layer
                 //selectInteraction.set('layers', [pg_public]);
                 //modifyInteraction.set('features',[pg_public]);
                editorDiv.style.lineHeight = '1.4'; // Default for other roles
                editorDiv.style.paddingTop = '4px';
                break;
            case 'moderator': 
            //Moderators get to see existing tracks PLUS CHANGES IN ANOTHER COLOUR
            //Changes are the pending changes in the live=pending field. 
                map.setLayers([/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts,pg_public,
                  pg_pending
                ]);
                console.log('Moderator role: layer stack set with pending');
                //Update select and modify interactions to include the pending layer

                //const currentLayers = selectInteraction.getLayers().getArray();
                //selectInteraction.set('layers', currentLayers.concat([pg_pending]));
                        //Run functions based on users?
                editorDiv.style.lineHeight = '2.5'; // Increased line padding for moderators
                editorDiv.style.paddingTop = '18px'; // Optional: extra space above line

                break;
            
            default:
            //Default to public view for any unrecognized roles
                map.setLayers([/*googleLayer,*/topo50_layer,pg_doc, pg_doc_huts, pg_public]);
                console.log('Default role: layer stack set');
                editorDiv.style.lineHeight = '1.4';
                editorDiv.style.paddingTop = '4px';
                break;

        }

        // DEBUG: Log final layer stack after role application
        setTimeout(() => {
            console.log('=== FINAL LAYER STACK after setLayers ===');
            map.getLayers().forEach((layer, idx) => {
                console.log(`Layer ${idx}: ${layer.get('name') || 'unnamed'} | ZIndex: ${layer.getZIndex()} | Visible: ${layer.getVisible()} | Opacity: ${layer.getOpacity()}`);
            });
            console.log('Topo50 state:', { visible: topo50_layer.getVisible(), zindex: topo50_layer.getZIndex(), opacity: topo50_layer.getOpacity(), inMap: map.getLayers().getArray().includes(topo50_layer) });
        }, 100);

        
    }

