/*===============================================================
  This affects the element that is passed in with a transform relocation. Moving it up, down, left or right in the given direction specified by 'axis' and 'direction'. If 'hide' is true, don't rewind its position.
===============================================================*/
function dismissElement (element, axis, direction, duration = '60%', hide) {

  duration = Math.abs(parseInt(duration) / 100);
  //Turns duration (which is a string of a number percentage) into an integer, divided into a 1.0 digit float number. The lower the percentage (and the number), the less or "quicker" the duration

  if (direction === 'down') {
    $(element).css('transform', `translate${axis}(-125%)`)
  }
  else if (direction === 'up') {
    $(element).css('transform', `translate${axis}(125%)`);
  }
  //These simply decide where the element starts off (-% is above screen, regular is below)

  if (!hide) {
      //With 'hide' they simply remain hidden, otherwise we do this and return it to its origin
    setTimeout( () => {
      $(element).css({
        'transform': 'translate(0)',
        'transition': `all ${duration}s ease-in-out`,
      });
    }, 700);
  };
};

let dragItem;
let dropItem;
let mobile = false;
// ======================================================================================
if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent)) mobile = true;

if (mobile) {
  $('.background-logo').attr('src', '/staticglobe.gif');
  $('.info-list').empty();
  $('.info-list').prepend(`
  <li>Tap folder icons <i class="fa fa-folder"></i> to add their name/path to the folder designation input</li>  <hr>
  <li>Hold-touch on uploaded files within the panel listing to download them</li><hr>
  <li>Double-tap Transfer button to copy selected item(s), rather than moving</li><hr>
  <li>And once more, holding touch/tap will select/unselect any items in the given file View</li>`);
  //Replacing the default desktop-oriented control tips in the header with mobile-use tips
} else {

  	/*===============================================================
  	  Similar to below except much less complex as it only serves aesthetic purposes. Allows files to be dragged in a "cool" fashion by adding/removing classes depending on whether it is being dragged, dropped or released. Added to every uploaded file.
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
  	  Not even a function, but an object. This is used exclusively by ALL '.folder' elements, which makes them "droppable" and makes an entire POST request when an item is dropped on them. This process emulates the act of transfering or moving a file, by taking the HREF of the file dropped on the folder, sending it to the back-end, and initiating a file-transfer with the FS module before returning here to remove the element and complete the process.
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
/* ----------------------------------------- */
	if (UserSession && UserSession.preferences.smoothTransition === true) {

	  let thisPage = document.URL.replace(window.location.origin, '').split('/').filter( (ele) => ele !== "");
	  thisPage === '/' ? thisPage = thisPage.split('') : thisPage = thisPage;
	  let prevPage = document.referrer.replace(window.location.origin, '').split('/').filter( (ele) => ele !== "");
	  //Had to do all this crap so we can just get the folder layers of current directory, removing the URL and the other nonsense. And if it's the homepage, make sure the array still has a length of One (one element that is "/")

	  if (performance.navigation.type !== performance.navigation.TYPE_RELOAD) {
	    //If the page was not refreshed/reloaded. Otherwise we don't do any of these animations.
	    if (document.referrer === document.URL) dismissElement('main', 'Y', 'up');
	     //Same page refresh, then start off below screen.
	    else if (prevPage.length >= thisPage.length) /**/ dismissElement('main', 'X', 'down');
	    //We backpeddaled directory, enter screen from left-side.
	    else /**/ dismissElement('main', 'X', 'up');
	    //We traversed directories, enter screen from right-size.

	    dismissElement('.logo', 'Y', 'down');
	  };

	/* ======================================================= */
	  $('body').on('click', 'a', function (evt) { //Upon clicking any link (leaving the page), dismiss the entire page body, sending it left or right depending on whether the user is going "forwards" through directories (send it left), or "backwards" (send page right).
	    if (this.download) return true;

	    evt.preventDefault();
	    evt.stopPropagation();

	    let domain = window.location.origin;

	    if (this.href && !this.href.replace(domain, '').includes('#')
	    && !$(this).hasClass('search-result') && !this.download) {
	    //If link is homepage, search result anchor, or download icon, do not shift the page off screen

	      let nextPage = this.href.replace(domain, '').split('/').filter( (ele) => ele !== "");
	      let thisPage = window.location.href.replace(domain, '').split('/').filter( (ele) => ele !== "");
	      //Had to do all this crap so we can just get the folder layers of current directory, removing the URL and the other nonsense, and get the next directory's "length"

	      if (window.location.href === this.href) {
	        //If the user wants to reload/refresh the same page, send the body-page downward off-screen.
	        if (confirm('Redirect to current page?')) $('main').css('transform', 'translateY(100%)');
	        else return false;

	        //Traversing directory, then retreat back to LEFT-side-screen.
	      } else if (nextPage.length >= thisPage.length) {
	        $('main').css('transform', 'translateX(-110%)');
	        //Send it left if next page is deeper in directory, or is a relative directory (same depth as current directory)
	      } else if (nextPage.length < thisPage.length) $('main').css('transform', 'translateX(110%)');
	      //Send it right if we're treading backwards in directory

	      dismissElement('.logo', 'Y', 'down', '40%', true);
	      dismissElement('#panelHeader', 'Y', 'up', '40%', true);
	      dismissElement('.directory-stats', 'Y', 'down', '40%', true);
	      dismissElement(MessageLog, 'Y', 'down', '40%', true);

	      if (UserSession.home === UsersDirectory && nextPage.join('/') === `${UsersDirectory}/${UserSession.user.name}`) { //If in private directory, attempts to visit the user folder will go to homepage, since that is presented as the "home" directory
	        window.location = domain;
	      } else window.location = this.href;
	      //THEN do the redirect
	    }
	  });
	// =============================================================
	};


	/*===============================================================
	  This affects the element that is passed in with a transform relocation. Moving it up, down, left or right in the given direction specified by 'axis' and 'direction'. If 'hide' is true, don't rewind its position.
	===============================================================*/
	function startDrag (evt) {

	  if (event.target !== this) return false;
	  let dragbox = $('.drag-select-box');
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

	  let dragbox = $('.drag-select-box');
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

	  if ($('.drag-select-box').is(':hidden'))
	    return false;
	    // To avoid repeat calls to this function due to mouseup

	  //Then the user is not even drag-selecting, no reason to run this function
	  window.clearTimeout(window.startdrag);
	// --------------------------------------------------------
	  let dragbox = $('.drag-select-box');
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

	window.addEventListener('load', async () => {
	  $('#FileTable').on('mousedown', startDrag);
	  $('html').on('mousemove', '#FileTable', resizeDragbox);
	  /* ----------------------------------------- */
	  $('#FileTable').on('mousemove', '.drag-select-box', resizeDragbox);
	});
};
