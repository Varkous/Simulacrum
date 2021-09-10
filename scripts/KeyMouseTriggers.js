'use strict';
let Touch_Wait = 0;
let touchStart = 0;
let touchEnd = 0;
let target;


/*===============================================================
  Checks for all various events that should occur on certain keypresses, provided certain elements are in focus or active
===============================================================*/
function keydownActions (evt) {
  if ($(FolderInput).is(':focus') && evt.keyCode === 40) folderSuggestions.firstChild.focus();
  else if (!$(FolderInput).is(':focus') && !$('a:focus')[0] || evt.keyCode === 27 || evt.keyCode === 13) $(folderSuggestions).empty();

// If pressing down arrow, move to folder suggestions, while Backscape or ESC will close it
// ---------------------------------------------------------------

  if ($(folderSuggestions).children('a:focus')[0]) {
    evt.stopPropagation();
    evt.preventDefault();

    if (evt.keyCode === 40 || evt.keyCode === 9) {
      let focus = $(folderSuggestions).children('a:focus').next().focus();
      if (!focus[0]) $(folderSuggestions).children('a').first().focus();
    }
    if (evt.keyCode === 38) {
      let focus = $(folderSuggestions).children('a:focus').prev().focus();
      if (!focus[0]) $(folderSuggestions).children('a').last().focus();
    }
    if (evt.keyCode === 8) $(FolderInput).focus();
  }
// Cancel anchor link redirect, and allow arrow keys to traverse links (focusing)
// ---------------------------------------------------------------
  if (!Directory) return true; //Then no files even available, no reason to run this part

    if (evt.ctrlKey && !$('input, a').is(':focus'))
      $('.transfer').find('span')[0].innerText = '(COPY)';

    if (evt.shiftKey && !$('input, a').is(':focus') ) {
      $('.selected-count').text(`(All)`);
      $(moreFiles).find('span').text(`Show All Files (${Directory.files.length || 0})`);
    }

  return true;
// Change "More Files" and "Transfer" button names/info when Shift or CTRL is pressed
// ---------------------------------------------------------------
};


/*===============================================================
  Selects all list items if double clicking/tapping on the same spot twice within half a second
===============================================================*/
function waitSelect(evt) {
  if (event.target === target && Touch_Wait && new Date().getTime() - 500 < Touch_Wait) {
    //Like a homegrown timeout, compares current Time in milliseconds to Touch_Wait, which was set on previous touch, and if not within 500 milliseconds, it will not count as "double-tap"
    let items = AllFiles.count;
    if ($(this).hasClass('staged-files')) {
      items = StagedFiles.count;
    } else if ($(this).hasClass('selected-files'))
      items = SelectedFiles.count;

    selectAll(items, mobile);
  } else {
    target = evt.target;
    Touch_Wait = new Date().getTime();
  }
};


/*===============================================================
  For the uploaded file listing anchors. When held down on touch or click, trigger download by creating a new download link and clicking to bypass the original download trigger (which was not working in some cases)
===============================================================*/

function holdToDownload (evt) {
  if (evt.target.download) {
    window.waitTrigger = setTimeout( () => {

      let link = document.createElement('a');
      $(link).attr({ href: $(evt.target).attr('href'), download: $(evt.target).text()});
      link.click(); link.remove();
    }, 700);
  } else return false;
};


/*===============================================================
  Compares the time being the user's touchstart and touchend and detects if their touch location has moved either 300 pixels left or right since first touch (in other words, swipe distance). If so, go to previous or next directory (if there is one)
===============================================================*/
function detectSwipe (evt) {
  touchStart = Math.ceil(evt.changedTouches[0].pageX);
  touchEnd = Math.ceil(evt.changedTouches[0].pageX);
  clearTimeout(window.touchSwipe);
  //Reset values and touch distance monitoring function to avoid repeats
// ------------------------------------
  window.touchSwipe = setTimeout( async (evt) => {

    if (touchEnd - touchStart > 300 ) {
      //If client swipped RIGHT more than 300 pixels, they're trying to backtrack directories, so we create a URL out of the Directory layers (minus the current folder name), and start a directory change
      let link = await getPreviousDirectory();
      return await changeDirectory(evt, link);
    }
    else if (touchStart > touchEnd + 300 ) {
      //If client swipped LEFT more than 300 pixels, attempt to visit the input directory (doesn't necessarily mean "forward" though)
      let link = document.createElement('a');
      link.href = `${window.location.origin}/${Partition + $(FolderInput).val()}`;
      return await changeDirectory(evt, link);
    }
  }, 200);
};

/* ----------------------------------------- */
document.onkeydown = (evt) => keydownActions(evt); //Enforces the effects wanted on pressing CTRL/ SHIFT
/* ----------------------------------------- */
document.onkeyup = (evt) => { //Checks if CTRL or SHIFT were "unpressed", and undos their effects
  $('#viewImage').hide().empty();

  if (Directory && evt.ctrlKey === false || evt.shiftKey === false) {
    $('.transfer').find('span')[0].innerText = '';
    $(moreFiles).children('span').text(`MORE FILES...`);
    $('.selected-count').text(`(${SelectedFiles.count.length})`);
  };

  if (evt.keyCode === 46)
    $('#deleteBtn').click();
  if (evt.keyCode === 27) {
    $('.modal').is(':visible') ? closeModal() : SelectedFiles.unlist();
  }


  return true;
};
// ------------------------------------
$('body').on('mousedown', 'a', holdToDownload);
$('body').on('mouseup', '*', () => clearTimeout(window.waitTrigger));
$('body').on('touchstart', 'a', holdToDownload);
$('body').on('touchend', '*', () => clearTimeout(window.waitTrigger));
/* ----------------------------------------- */
$('#overheadPanel').click(bringUpPanel); // Animations/CSS, brings up the overhead panel
$('.hide-lists').click( function (evt) {
  evt.stopPropagation();
  const panel_list = $(this).next();

  if ($(panel_list).height() < 80 && $(panel_list).children('li')[0])
    $(panel_list).animate({
      height: '180px',
    }, 100, () => $(this).addClass('fa-arrow-circle-up').removeClass('fa-arrow-circle-down'));

  else
  $(panel_list).animate({
    height: '0px',
  }, 100, () => $(this).addClass('fa-arrow-circle-down').removeClass('fa-arrow-circle-up'));


}); // Animations/CSS, folds/unfolds lists within the overhead panel
$('#moreFiles').click(listDirectoryContents); //Creates and displays more file cards
$('.show-modal').click( function () {
  if ($(this).next().is(':hidden')) $(this).next().show();
}); // When the user clicks on the button, open the modal
$('.closemodal').click(closeModal);
$('.modal').click(closeModal); // When the user clicks anywhere outside of the modal, close it
$('.main-staged-count').click( () => viewTextInModal($('.staged-files')[0])); //Clicking staged count number shows staged clipboard in modal
$('#inputQuestion').click( () => hideOrShow('#questionMessage')); // Resizes/displays message hidden beneath info icon
// -------------------------------------------------------------------------------------
$('*').on('input', 'a', function (evt) {$(this).closest('li, td').addClass('changed')}); //When an anchor has its text edited from within an li or td
/* ----------------------------------------- */
$(FolderInput).on('input', itemSearch); //Any change to folder input prompts suggestions of like-name folders. Change is also reflected by current directory within overhead panel
$('div').on('input', '.file-search', itemSearch);
/* ----------------------------------------- */
$('.selected-files, .all-files').on('click', '.fa-layer-group', () => selectAll(SelectedFiles.count)); //When clicking on layer icon in panel lists, selects/unselects all files in that list without needing to double-click
/* ----------------------------------------- */
$('body').on('click', '.column, .folder, li', selectFiles);
/* ----------------------------------------- */
$('.message').click( function (evt) {return $(this).removeClass('fadein').addClass('fadeout')}); //Dismisses info messages (display directory stats and flash messages) on click
/* ----------------------------------------- */
$('body').on('click touchstart', 'a', changeDirectory);
/* ----------------------------------------- */
$('body').on('click touchstart', '.fa-file-text', showFileInfo);
/* ----------------------------------------- */
$('body').on('touchstart', '.folder-link', displayDirectoryStats);
$('body').on('mouseenter mouseleave', '.folder-link', displayDirectoryStats);
/* ----------------------------------------- */
$('body').click( function (evt) {
  !$(FolderInput).val() ? $(FolderInput).val(CurrentFolder) : null;
  evt.target.tagName !== 'I' ? $('.file-info').remove() : null
  //If we click anywhere that is not one of the icons, remove any file-infos that are on hover display
  if (evt.target === folderSuggestions || $(evt.target).hasClass('search-result')) {
    evt.stopPropagation();
    evt.preventDefault();
  } else $(folderSuggestions).empty();
  //This is to prevent anchor redirect when clicking on anchors in folder suggestions, and clearing it also
}); //For clearing folder suggestion list
/* ----------------------------------------- */
$('body').on('click', 'ol', shiftSelect);
/* ----------------------------------------- */
$('body').on('click', '.fa-folder', inputItemName); //Create this function after window load. Every time a folder icon is clicked, add its name to Folder Input. We use ".on" so any future icons will use this function.
// ------------------------------------
if (mobile) {
  $('#FileTable, ol').on('touchstart', waitSelect);
  // -------------------------------------------
  $('.taphover').on('touchstart', function (evt) {

      const link = $(this); //preselect the link
      if (link.hasClass('hover')) {
        return true;
      } else {
          link.addClass('hover');
          $('.taphover').not(this).removeClass('hover');
          evt.preventDefault();
          return false; //extra, and to make sure the function has consistent return points
      }
  });
// ------------------------------------
  $('*').not('.taphover').on('mousedown', () => $('*').removeClass('glow-right shift-over hover'));
  //Any elements clicked that are NOT hoverable/tappable will remove any hover effects from other elements, since they should not be active if not hovered obviously
// ------------------------------------
  window.addEventListener('touchstart', detectSwipe);
// ------------------------------------
  window.addEventListener('touchend', (evt) => touchEnd = Math.ceil(evt.changedTouches[0].pageX)); //And collects the end distance

} // -- On mobile devices

/* ----------------------------------------- */
window.addEventListener('load', async () => {

  $('.logo').draggable({
    containment: 'body',
    revert: false,
    distance: 1,
    delay: 200,
    axis: 'x',
    appendTo: 'body',
    drag: function(evt, ui) {
      //Firefox needed this to proceed to "stop"
      if (!event.buttons)
        return false;
    },
  });
});
