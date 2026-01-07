/*editfunctions.mjs
* Contains the editing, peer-review, and moderation functions
*
*/
import Quill from 'quill';
import { Delta } from 'quill';
    // Or if you only need the core build
    // import { Delta } from 'quill/core';
    // Or const Delta = Quill.import('delta');

import Link from 'quill/formats/link';
    // Or const Link = Quill.import('formats/link');


//User colours
// Expand as needed
//PROBABLY NOT NEEDED
export const userColors = {
  "John Doe": "red",
  "Mary Roe": "blue",
  "Alex Lee": "green"
};
// Use in currentUser.color

    // Get initials
    function getInitials(name) {
        if (!name) return "??";
        //alert(name);
        let parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].slice(0,2).toUpperCase();
        } else {
            return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
        }
    }


/* 
*
*
*/
// Helper to get caret offset in entire contenteditable (all nodes)
export function getCaretCharacterOffsetWithin(element) {
  let caretOffset = 0;
  let sel = window.getSelection();
  if (sel.rangeCount && sel.anchorNode) {
    let range = sel.getRangeAt(0);
    let preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretOffset = preCaretRange.toString().length;
  }
  return caretOffset;
}

/*
*Wrap text with underline and bubble
*Use for additions
*/
export function wrapWithUnderlineAndBubble(editable,username, start,end) {
    let lastLength = 0;

    const initials = getInitials(username);
                        const range = document.createRange();
                        const sel = window.getSelection();
                        
                        // Bubble (could be an <img>, or as here a styled div with initials)
                        const bubble = document.createElement('div');
                        bubble.textContent = initials;
                        bubble.className = "author-bubble";
                        // Optionally, you could use a data-url image here for avatars

                        // Container span for bubble + strike
                        const span_element=document.createElement('span');
                        span_element.className = "underline-container";
                        span_element.style.position = "relative";

                        // Author/strike span (as before)
                        const underline_element = document.createElement('span');
                        underline_element.setAttribute('data-author', username);
                        underline_element.style.textDecoration = 'underline';

                        
                        // Traverse text nodes to find [start, end] offsets
                        let current = editable;
                        let pos = 0, foundStart = false;

                        function findTextNode(node) {
                            if (node.nodeType === Node.TEXT_NODE) {
                            let length = node.textContent.length;
                            if (!foundStart && pos + length >= start) {
                                foundStart = true;
                                let localStart = start - pos;
                                let localEnd = Math.min(length, end - pos);

                                // If end is in this node too, single node
                                range.setStart(node, localStart);
                                if (end - pos <= length) {
                                range.setEnd(node, localEnd);
                                } else {
                                // Otherwise, will continue on next nodes
                                range.setEnd(node, length);
                                }
                            } else if (foundStart && pos < end) {
                                let localEnd = Math.min(length, end - pos);
                                range.setEnd(node, localEnd);
                            }
                            pos += length;
                            if (pos >= end) return true; // done
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                            for (let i = 0; i < node.childNodes.length; i++) {
                                if (findTextNode(node.childNodes[i])) return true;
                            }
                            }
                            return false;
                        }
                        findTextNode(current);
                        const u = document.createElement('u');
                        range.surroundContents(u);
                        
                        // Move the selected text/nodes inside underline
                        //underline_element.appendChild(range);

                        // Bubble style -- absolute above underline
                        bubble.style.position = "absolute";
                        bubble.style.left = "0px";
                        bubble.style.top = "-1.8em"; // Above the text
                        bubble.style.background = "#444";
                        bubble.style.color = "#fff";
                        bubble.style.borderRadius = "16px";
                        bubble.style.width = "24px";
                        bubble.style.height = "24px";
                        bubble.style.display = "flex";
                        bubble.style.alignItems = "center";
                        bubble.style.justifyContent = "center";
                        bubble.style.fontSize = "12px";
                        bubble.style.fontWeight = "bold";
                        bubble.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";
                        bubble.style.userSelect = "none";
                        bubble.style.pointerEvents = "none";
                        bubble.style.zIndex = "10";
                        bubble.style.contenteditable='false';

                        // Append structure
                        span_element.appendChild(bubble);
                        span_element.appendChild(underline_element);

                        // Place in DOM
                        editable.insertNode(span_element);

                        //Insert a custom tag here with the author
                        //Set the data-author  
                        underline_element.setAttribute('data-author', username);
                        
                        //Set the edit-date
                        //MAKE SURE Javascript timestamps are compatible with postgresql timestamps
                        //CHECK MILLISECONDS
                        underline_element.setAttribute('edit-date', Date.now());
                        
                        underline_element.style.textDecoration = 'underline';
                        //strike.appendChild(range.extractContents()); // Move the selected text/nodes inside strike
                        //range.insertNode(strike);

                        // Move the caret after the strikethrough span
                        //text.setStartAfter(span_element);
                        //range.collapse(true);
                        //sel.removeAllRanges();
                        //sel.addRange(range);
    
}

/*
*Wrap text with strikethrough and bubble
*Use for deletions
*/
export function wrapWithStrikethroughAndBubble(username, range) {
    const initials = getInitials(username);
                        
                          // Bubble (could be an <img>, or as here a styled div with initials)
                        const bubble = document.createElement('div');
                        bubble.textContent = initials;
                        bubble.className = "author-bubble";
                        // Optionally, you could use a data-url image here for avatars

                        // Container span for bubble + strike
                        const span_element=document.createElement('span');
                        span_element.className = "strike-container";
                        span_element.style.position = "relative";

                        // Author/strike span (as before)
                        const strike_element = document.createElement('span');
                        strike_element.setAttribute('data-author', username);
                        strike_element.style.textDecoration = 'line-through';

                        // Move the selected text/nodes inside strike
                        strike_element.appendChild(range.extractContents());

                        // Bubble style -- absolute above strikethrough
                        bubble.style.position = "absolute";
                        bubble.style.left = "0px";
                        bubble.style.top = "-1.8em"; // Above the text
                        bubble.style.background = "#444";
                        bubble.style.color = "#fff";
                        bubble.style.borderRadius = "16px";
                        bubble.style.width = "24px";
                        bubble.style.height = "24px";
                        bubble.style.display = "flex";
                        bubble.style.alignItems = "center";
                        bubble.style.justifyContent = "center";
                        bubble.style.fontSize = "12px";
                        bubble.style.fontWeight = "bold";
                        bubble.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";
                        bubble.style.userSelect = "none";
                        bubble.style.pointerEvents = "none";
                        bubble.style.zIndex = "10";
                        bubble.style.contenteditable='false';

                        // Append structure
                        span_element.appendChild(bubble);
                        span_element.appendChild(strike_element);

                        // Place in DOM
                        range.insertNode(span_element);

                        //Insert a custom tag here with the author
                        //Set the data-author  
                        strike_element.setAttribute('data-author', username);
                        
                        //Set the edit-date
                        //MAKE SURE Javascript timestamps are compatible with postgresql timestamps
                        //CHECK MILLISECONDS
                        strike_element.setAttribute('edit-date', Date.now());
                        
                        strike_element.style.textDecoration = 'line-through';
                        //strike.appendChild(range.extractContents()); // Move the selected text/nodes inside strike
                        //range.insertNode(strike);

                        // Move the caret after the strikethrough span
                        range.setStartAfter(span_element);
                        range.collapse(true);
                        //sel.removeAllRanges();
                        //sel.addRange(range);

}

/*Custom quill functions
*
*/

const Inline = Quill.import('blots/inline');

// Insertion Blot
class UserInsBlot extends Inline {
  static create(value) {
    let node = super.create();
    node.setAttribute('data-user', value.user);
    node.setAttribute('data-initials', value.initials);
    node.setAttribute('data-timestamp', value.timestamp);
    node.setAttribute('class', `ql-user-ins ql-color-${value.color}`);
    return node;
  }
  static formats(node) {
    return {
      user: node.getAttribute('data-user'),
      initials: node.getAttribute('data-initials'),
      timestamp: node.getAttribute('data-timestamp'),
      color: (node.className.match(/ql-color-([a-z]+)/) || [])[1]
    };
  }
}
UserInsBlot.blotName = 'user-ins';
UserInsBlot.tagName = 'u';
Quill.register(UserInsBlot);

// Deletion Blot
class UserDelBlot extends Inline {
  static create(value) {
    let node = super.create();
    node.setAttribute('data-user', value.user);
    node.setAttribute('data-initials', value.initials);
    node.setAttribute('data-timestamp', value.timestamp);
    node.setAttribute('class', `ql-user-del ql-color-${value.color}`);
    return node;
  }
  static formats(node) {
    return {
      user: node.getAttribute('data-user'),
      initials: node.getAttribute('data-initials'),
      timestamp: node.getAttribute('data-timestamp'),
      color: (node.className.match(/ql-color-([a-z]+)/) || [])[1]
    };
  }
}
UserDelBlot.blotName = 'user-del';
UserDelBlot.tagName = 'del';
Quill.register(UserDelBlot);

//Function for saving
/*
document.getElementById('save-html').onclick = function() {
  // Clean up the Quill-generated DOM to the desired HTML output
  // (u/del tags with data-user, data-initials, data-timestamp)
  let html = quill.root.innerHTML;
  alert(html);  // or send to your backend
};
*/



