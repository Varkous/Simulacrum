'use strict';

// ===========================================================
  document.onreadystatechange = async function (evt) { //Page starts loading
    /* ----------------------------------------- */

    if (document.readyState === 'interactive') { //When DOM scripts are available
    /* ----------------------------------------- */
      if (performance.navigation.type === performance.navigation.TYPE_RELOAD) { //If page was reloaded
        if (UserSession && UserSession.user.residing && UserSession.user.residing !== '/') {
          Directory.layers = UserSession.user.residing.split('/') || ['/'];
          CurrentFolder = UserSession.user.residing;
          let dirPath = '/' + Partition + CurrentFolder;
          dismissElement('main', 'Y', 'down', '50%', 600, true);
          await retrieveDirectory(window.location.origin + dirPath + '?fetch');
        }
      }
    }; //If interactive available

  }; //End of document state change


/*===============================================================
  This affects the element that is passed in with a transform relocation. Moving it up, down, left or right in the given direction specified by 'axis' and 'direction'. If 'hide' is true, don't rewind its position.
===============================================================*/
function dismissElement (element, axis, direction, duration = '60%', wait = 600, hide) {

  return new Promise ( (resolve, reject) => {
  duration = Math.abs(parseInt(duration) / 100);
  //Turns duration (which is a string of a number percentage) into an integer, divided into a 1.0 digit float number. The lower the percentage (and the number), the less or "quicker" the duration

  if (direction === 'down' || direction === 'right')  $(element).css('transform', `translate${axis}(125%)`);
  else if (direction === 'up' || direction === 'left') $(element).css('transform', `translate${axis}(-125%)`);
  //These simply decide where the element is sent (-% is down/right screen, regular is above/left screen)
// ----------------------------------------------
    if (hide) { //After going off screen, make element transition instant for quick follow-up relocation
      let moveSpeed = parseFloat($(element)[0].style.transitionDuration);

      setTimeout( () => {
        $(element).css('transition', 'none');
        resolve();
      }, Math.abs(moveSpeed * 1000));
    } else {
      //With 'hide' they simply remain hidden, otherwise we do this and return it to its origin at same speed
      setTimeout( () => {
        $(element).css({'transform': 'translate(0)', 'transition': `all ${duration}s ease-in-out`});
        resolve();
      }, wait);
    }
    // ----------------------------------------------
  }); //Return promise
};

// ---------------------------------------------------------------------------------------
let dragItem;
let dropItem;
// ======================================================================================
if (mobile) {
  $('.background-logo').attr('src', '/staticglobe.gif');
  $('.info-list').empty();
  $('.info-list').prepend(`
  <li>Tap folder icons <i class="fa fa-folder"></i> to add their name/path to the folder designation input</li>  <hr>
  <li>Hold-touch on uploaded files within the panel listing to download them</li><hr>
  <li>Double-tap the file table or a panel listing to select/unselect any items within</li><hr>`);
  //Replacing the default desktop-oriented control tips in the header with mobile-use tips
} else {

  	/*===============================================================
  	  Allows files to be dragged in a "cool" fashion by adding/removing classes depending on whether it is being dragged, dropped or released. Added to every uploaded file. Holding control "clones" on dragging, without it the whole card is displaced
  	===============================================================*/
    dragItem = {
  	  start: function(evt, ui) {

  	    if (!event.buttons)
  	    	return false;
  	    //If the mouse is not being held down

  	    let pageWidth = document.body.clientWidth;

  	    let draggedInstance = $(this).draggable("instance");
  	    $('.ui-draggable-dragging').addClass("dragging");

  	    if (evt.ctrlKey) {
  	      $(evt.target).removeClass('hide');
  	      evt.target.copy = true;
  	      //This is used in the "transferFiles" function to determine if the file (and the file card) should remain in the current directory
  	    } else {
  	      $(evt.target).addClass('hide');
  	      evt.target.copy = false;
  	    }
  	    //Control key will "copy" file card, without it we hide card (since we're moving instead)

  	    draggedInstance.containment[2] = pageWidth; //Allows item to be dragged to/from the edges of screen
  	    draggedInstance.offset.click.left = 142;
  	    draggedInstance.offset.click.top = 135;
  	    //Weird, digged around draggable item properties, found these. With this pixel-X-Y configuration, this makes the file card shrink so the cursor is RIGHT in the middle rather than ANNOYINGLY outside it like before.

  	  },
  	  helper: 'clone',
  	  scroll: false,
  	  containment: 'body',
  	  revert: true,
  	  revertDuration: 350,
  	  distance: null,
  	  delay: 200,

  	  drag: function(evt, ui) {
  	    //Firefox needed this to proceed to "stop"
  	    if (!event.buttons)
  	      return false;
  	  },
  	  stop: function(evt, ui) {
  	    ui.helper.removeClass("dragging");
  	    $(evt.target).removeClass('hide');
  	  },
  	};


  	/*===============================================================
  	  Not even a function, but an object. This is used exclusively by ALL '.folder' elements, which makes them "droppable" and makes an entire POST request when an item is dropped on them. This process emulates the act of transfering or moving a file, by taking the HREF of the file dropped on the folder and sending it to the back-end.
  	===============================================================*/
      dropItem = {
  	    classes: {
  	      "ui-droppable-hover": "drop-ready",
  	    },
  	    accept: '.uploaded, .folder',
  	    tolerance: 'pointer',
  	    // greedy: false,
  	    drop: async function( evt, ui ) { // <----------------- Important one here
  	      const fileCardInstance = ui.helper;
  	      const fileCard = ui.draggable[0];
  	      //The ui.draggable is actually the element currently being dragged, which should always be a file of some sorts. Helper is the instance (item being dragged).
  	      let file = {name: fileCard.id, path: $(fileCard).attr('path')};
  	      const destinationFolder = `${CurrentFolder}/${evt.target.id.getSpaceChars()}`;

  	      await transferFiles([file], destinationFolder, fileCard.copy);

  	    }, //-----------All of this crap above happens if you drop an item on the given folder card
  	};


	/*===============================================================
	  This affects the element that is passed in with a transform relocation. Moving it up, down, left or right in the given direction specified by 'axis' and 'direction'. If 'hide' is true, don't rewind its position.
	===============================================================*/
	function startDrag (evt) {

	  if (event.target !== this) return false;
	  //Else clicking file cards will also trigger it

	  clearTimeout(window.startdrag);
	  //Only occurs in File List, clear previous drag function if already set

	  let topMouseDrag = event.offsetY + 'px';
	  let leftMouseDrag = event.offsetX + 'px';
	  //Has to be OFFSET position (which is current element).
	  window.startdrag = setTimeout( () => {
	    $(dragbox).css({
	      height: `0px`,
	      width: `0px`
	    });
	    $(dragbox).show().addClass('is-dragging');
	    CSSVariables.setProperty('--dragtop', topMouseDrag);
	    CSSVariables.setProperty('--dragleft', leftMouseDrag);
	  }, 200 - FileTable.children.length);
	//Show and relocate drag box, set its start point.
	};


	/*===============================================================
	  This affects the element that is passed in with a transform relocation. Moving it up, down, left or right in the given direction specified by 'axis' and 'direction'. If 'hide' is true, don't rewind its position.
	===============================================================*/
	async function resizeDragbox() {

	  if (event.buttons !== 1)
	    return $(dragbox).hide();

	  else {

	    let dragboxTop = $(dragbox).position().top;
	    let dragboxLeft = $(dragbox).position().left;
	    let heightAdjust = (event.pageY - dragboxTop - FileTable.offsetTop - 5);
	    let widthAdjust = (event.pageX - dragboxLeft - 25);
	    // Now we use PAGE position of element (since dragbox actually is a direct child of the HTML body, rather than FileTable) after top/left used offset (inside FileTable) to start the drag positioning. We want the initial Y/X to always be 0 regardless of relative position for easier calculation.

	    $(dragbox).css({
	      height: `${heightAdjust}px`,
	      width: `${widthAdjust}px`
	    });
	  }
	};


	/*===============================================================
	  This is just for the drag-select-box. Determine current Dragbox position and size when the user lets up on the mouse
	===============================================================*/
	$('html').on('mouseup', '*', function () {
	  //Dragbox official parent is actually the HTML document, so mouseup function must be derived from that.

	  if ($(dragbox).is(':hidden'))
	    return false;
	    // To avoid repeat calls to this function due to mouseup

	  //Then the user is not even drag-selecting, no reason to run this function
	  window.clearTimeout(window.startdrag);
	// --------------------------------------------------------
	    if ($(dragbox).hasClass('is-dragging') === true) {
	        $(dragbox).removeClass('is-dragging');

	  //And here's the juice. Basic geometric math. In order for the application to recognize elements are "within" the dragbox, we must compare their Top/Left positions with the dragbox Top/Left start, and if their locations overlap, we check if the height/width of Dragbox surpasses the file card elements, and if so, 'Select' them.
	      let drag_top = $(dragbox).position().top;

	      //Since dragbox original position is the top-left corner of the screen, the "pageY" includes all the scaling of elements above the FileTable, which we don't want. We subtract their height so the number approximately starts from the FileTable.
	// --------------------------------------------------------
	      let drag_height = parseInt($(dragbox).css('height'));
	      let drag_Y = drag_top + drag_height;
	      //Vertical position and height

	      let drag_left = $(dragbox).position().left;
	      let drag_width = parseInt($(dragbox).css('width'));
	      let drag_length = drag_left + parseInt($(dragbox).css('width'));
	      //Horizontal position and width

	// --------------------------------------------------------
	    for (let div of $(FileTable).children('.column, .folder')) {
	      let item_top = $(div).position().top;
	      let item_height = parseInt($(div).css('height'));
	      let item_Y = item_top + item_height;

	      // let item_left = ($(div).position().left + parseInt($(div).css('margin-left')) + 30);
	      let item_left = ($(div).position().left + parseInt($(div).css('margin-left')));
	      let item_width = parseInt($(div).css('width'));
	      let item_length = item_left + item_width;
	      //Similar to above, except we had to adjust position for the margin as well.

	// --------------------------------------------------------
	      if (drag_Y > item_top && item_Y > drag_top
	      && drag_length > item_left && item_length > drag_left) {
	        //The culmative calculation that detects if the file card's horizontal OR vertical position overlaps with the select box expansion
	        if ($(div).hasClass('selected') === false)
	          selectFiles(div);
	      }
	// --------------------------------------------------------
	    };
	  };
	  $(dragbox).hide();
	});
// ===========================================================
	window.addEventListener('load', async () => {
	  $('#FileTable').on('mousedown', startDrag);
	  $('html').on('mousemove', '#FileTable', resizeDragbox);
	  /* ----------------------------------------- */
	  $('#FileTable').on('mousemove', '.drag-select-box', resizeDragbox);
	});
};
/* ======================================================= */
