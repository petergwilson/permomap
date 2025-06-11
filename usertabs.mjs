/*usertabs.mjs
*Contains the HTML templates wrapped in Javascript for dynamic insertion
*into the main application depending on user role. 
*Thoughts:
*Three levels of primary access - 
*1) The public - they can see all moderated/public tracks, and have a track info page similar/same as Remote Huts. This will display the moderated
*info, but it also needs "hooks", to get the public interested in maybe walking a track, looking at it etc.
* NEED TO THINK ABOUT HOW TO GET THE PUBLIC TO CONTRIBUTE - ITS PROBABALY LITERALLY GET A USER ACCOUNT. THAT BARRIER  
********
*2) Users (anyone can request a user account, but they must sign onto community standards). They the public information with edit functions page
* So when they click on a track they see the information for that track and can edit it if they choose.
* Track cutters will have this level of access. They can also:
* -Upload GPX files and assign them to a track (within limits, there will be some basic checks and balance in the system to prevent things
*  from going way off track, using buffers and bounding boxes)
* -Upload photos
* -Highlight sections of track they've cut and what they haven't. This is an overlay geometry, not the primary geometry, so it can't break
*  or otherwise affect the primary track geometry. It's just spatial joins for track cutting layers with dates/times, areas. Literally a d
*  digital highlighter. 
* THIS SYSTEM NEEDS TO REMEMBER THEIR EDITS, SO IF PEOPLE REMEMBER SOMETHING AND GO BACK AND RESUBMIT IT THEY CAN. ITS NOT AN ESSAY YOU SEND OFF
* TO ANDREW ETC FOR MARKING, ONE AND DONE ETC. IT MAY BE ITERATIVE THIS NEEDS A BIT OF THOUGHT IN THE CONTEXT OF WHEN IS MODERATION FINAL?
* IN THINKING ABOUT THIS THE WAY THROUGH IS TO HAVE NO ACTUAL "SAVE" BUTTON THAT SENDS THINGS OFF.THINGS JUST SAVE AS WHEN WRITTEN AND
* MODERATORS CAN SIT BACK A BIT AND SEE HOW THINGS ARE GOING. IT MIGHT BE BETTER TO HAVE AN ASK FOR MODERATION BUTTON SOMEWHERE MORE DISCRETE?
* 
*3)Moderators - They see the public info with edits in line, the track cutting info, in a "tracked change" version approach, so they can see
   and compare the edits, then approve them if they are happy, or suggest changes themselves. Once moderators approve, it goes live. 
   CHANGE IMPLIES SOMETHING OF A TWO-WAY CONVERSATION BETWEEN MODERATORS AND USERS? HOW BEST TO FACILITATE THAT? 
   IT REALLY COMES DOWN TO THE VOLUME OF INFO - I'M NOT EXPECTING A LOT, BUT IT SHOULD BE BUILT FOR A LOT IF THE PLATFORM IS TO SCALE?
*/


var tracker = new ice.InlineChangeEditor({
    element: document.getElementById('mytextelement'),
    handleEvents: true,
    currentUser: { id: 1, name: 'User Name' },
    plugins: ['IceAddTitlePlugin', 'IceEmdashPlugin']
  }).startTracking();


const html = `
     <div class="user-card">
       <h3>Welcome, ${name}!</h3>
       <p>Some user information.</p>
     </div>
   `;