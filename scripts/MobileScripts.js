'use strict';
let Touch_Wait = 0;
let touchStart = 0;
let touchEnd = 0;
let Target;

/*===============================================================
  Selects all list items if double clicking/tapping on the same spot twice within half a second
===============================================================*/
function waitSelect(evt) {
  if (event.target === Target && Touch_Wait && new Date().getTime() - 500 < Touch_Wait) {
    //Like a homegrown timeout, compares current Time in milliseconds to Touch_Wait, which was set on previous touch, and if not within 500 milliseconds, it will not count as "double-tap"
    let items = AllFiles.count;
    if ($(this).hasClass('staged-files')) {
      items = StagedFiles.count;
    } else if ($(this).hasClass('selected-files'))
      items = SelectedFiles.count;

    selectAll(items, mobile);
  } else {
    Target = evt.target;
    Touch_Wait = new Date().getTime();
  }
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
      return await changeDirectory(evt, link.href);
    }
    else if (touchStart > touchEnd + 300 ) {
      //If client swipped LEFT more than 300 pixels, attempt to visit the input directory (doesn't necessarily mean "forward" though)
      let link = document.createElement('a');
      link.href = `${window.location.origin}/${Partition + $(FolderInput).val()}`;
      return await changeDirectory(evt, link.href);
    }
  }, 200);
};

// -------------------------------------------
$('#FileTable, ol').on('touchstart', waitSelect);
// -------------------------------------------
$('.taphover').on('touchstart', function (evt) {

    const link = $(this); //preselect the link
    if (link.hasClass('hover') || link.hasClass('folder-link')) {
      return true;
    } else {
        link.addClass('hover');
        $('.taphover').not(this).removeClass('hover');
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
$('body').on('touchstart', 'a', holdToDownload);
$('body').on('touchend', '*', () => clearTimeout(window.waitTrigger));
$('body').on('click touchstart', '.folder-link', inputItemName); //Tapping folder links adds their name to input.
