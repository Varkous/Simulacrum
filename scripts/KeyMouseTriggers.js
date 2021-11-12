'use strict';

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
    }

  return true;
// Change "More Files" and "Transfer" button names/info when Shift or CTRL is pressed
// ---------------------------------------------------------------
};


/*===============================================================
  For the uploaded file listing anchors. When held down on touch or click, trigger download by creating a new download link and clicking to bypass the original download trigger (which was not working in some cases)
===============================================================*/
function holdToDownload (evt) {
  if (evt.target.download) {
  	$(evt.target).addClass('start-download');
    window.waitTrigger = setTimeout( () => triggerLink(evt.target.href, evt.target.download), 700);
  } else return false;
};


/* ----------------------------------------- */
document.onkeydown = (evt) => keydownActions(evt); //Enforces the effects wanted on pressing CTRL/ SHIFT
/* ----------------------------------------- */
document.onkeyup = (evt) => { //Checks if CTRL or SHIFT were "unpressed", and undos their effects
  $('#viewImage').hide().empty();

  if (Directory && evt.ctrlKey === false || evt.shiftKey === false) {
    $('.transfer').find('span')[0].innerText = '';
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
$('#myDir').click( (evt) => {
//Special href redirect. If attempting to switch between Private/Public directory, bypass all the 'changeDirectory' crap and redirect (else route won't even trigger)
    return $('.progress').val() ? confirmRedirect(`${home}/home/${Username}`) : window.location = `${home}/home/${Username}`;
});
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
$('#moreFiles').click( () => listDirectoryContents(event, true)); //Creates and displays more file cards
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
$(FolderInput).on('input', startQuery); //Any change to folder input prompts suggestions of like-name folders. Change is also reflected by current directory within overhead panel
$('div').on('input', '.file-search', startQuery);
/* ----------------------------------------- */
$('.message').click( function (evt) {
	window.messageLog = new Promise( (res, rej) => res());
	$('.closemodal').click();
	return $(this).removeClass('fadein').addClass('fadeout');
}); //Dismisses info messages (display directory stats and flash messages) on click
/* ----------------------------------------- */
$('.selected-files, .all-files').on('click', '.fa-layer-group', () => selectAll(SelectedFiles.count)); //When clicking on layer icon in panel lists, selects/unselects all files in that list without needing to double-click
// ------------------------------------
$('#cancel').click( () => $('main').css({
   'transform': 'translate(0)',
   'transition': 'all 0.7s ease-in-out',
  }));
// ------------------------------------  
$('#url').on('input', () => {
  $('#url').val() ? $('#url').nextAll('*').show() : $('#url').nextAll('*').hide();		
}); 
// ------------------------------------
$('body').on('mousedown', 'a', holdToDownload);
$('body').on('mouseup', '*', () => {
  clearTimeout(window.waitTrigger);
  $('.start-download').removeClass('start-download'); // The glow animation that was started on holding click on a download
  !$(FolderInput).val() ? $(FolderInput).val(CurrentFolder) : null;
  !$(event.target).hasClass('file-info') && event.target.tagName !== 'A' ? $('.file-info').remove() : null
  //If we click anywhere that is not one of the icons, remove any file-infos that are on hover display
  event.target.tagName !== 'A' ? $(folderSuggestions).empty() : false; //For clearing folder suggestion list if not clicking an anchor
});
/* ----------------------------------------- */
$('body').on('click', '#confirm', clearDialog);
/* ----------------------------------------- */
$('body').on('click', '.column, .folder, li', selectFiles);
/* ----------------------------------------- */
$('body').on('click', 'a', changeDirectory);
/* ----------------------------------------- */
$('body').on('click', '.fa-file-text, .fa-list-alt', showFileInfo);
/* ----------------------------------------- */
$('body').on('mouseenter mouseleave touchstart', '.folder-link', displayDirectoryStats);
/* ----------------------------------------- */
$('body').on('click', 'ol', shiftSelect);
/* ----------------------------------------- */
$('body').on('click', '.fa-folder', inputItemName); //Create this function after window load. Every time a folder icon is clicked, add its name to Folder Input. We use ".on" so any future icons will use this function.
/* ----------------------------------------- */
$('body').on('click', '.progress', function (evt) { //Whenever a progress bar is clicked, prompt user with option to abort the ongoing operation represented by that progress bar.
  for (let op of Object.keys(Requests)) {
    if ($(this).hasClass(op))
      return dialogPrompt({
            warning: `Cancel current ${op} operation?`,
            responseType: 'boolean',
            proceedFunction: `Requests.cancel('${op}')`,
          });
  }
});
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
/* ----------------------------------------- */
if (document.body.scrollHeight > window.innerHeight) { //If scrollbar is even visible
  document.addEventListener('scroll', function (event) { //This just detects if the scrollbar reached bottom of page (or within 10 pixels), if so, pagenate and show more files
	clearTimeout(window.listFiles);
    if (document.body.scrollHeight - ($('html').scrollTop() + window.innerHeight) <= 10
    && $(FileTable).children('.column')[0] && AllFiles.count.length > FileTable.children.length) { //This IF statement is making sure scrollbar is at bottom of screen, that there are any uploaded files below, and that there are more left to show
      window.listFiles = setTimeout( async () => await listDirectoryContents(event), 100);
    }
  });
}
/* ----------------------------------------- */
if (mobile) { //Creates <script> to load Mobile Functions from source if mobile device detected
  let mobileScript = document.createElement('script');
  $(mobileScript).attr('src', '/MobileScripts.js').attr('type', 'text/javascript');
  $('html').prepend(mobileScript);
  // $(mobileScript).remove();
}
