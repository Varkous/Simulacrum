document.onkeydown = (event) => keydownActions(event); //Enforces the effects wanted on pressing CTRL/ SHIFT
/* ----------------------------------------- */
document.onkeyup = (event) => {

  if (Directory && event.ctrlKey === false || event.shiftKey === false) {
    $('.transfer').find('span')[0].innerText = '';
    $(moreFiles).children('span').text(`MORE FILES...`);
    $('.selected-count').text(`(${SelectedFiles.count.length})`);
  };

  if (event.keyCode === 46)
    $('#deleteBtn').click();
  if (event.keyCode === 27)
    $('.modal').is(':visible') ? closeModal() : SelectedFiles.unlist();


  return true;
};  //Checks if CTRL or SHIFT were "unpressed", and undos their effects

/*===============================================================
  Checks for all various events that should occur on certain keypresses, provided certain elements are in focus or active
===============================================================*/
function keydownActions (event) {
// ---------------------------------------------------------------
  if ($(FolderInput).is(':focus') && event.keyCode === 40) folderSuggestions.firstChild.focus();
  else if (!$(FolderInput).is(':focus') && !$('a:focus')[0] || event.keyCode === 27 || event.keyCode === 13) $(folderSuggestions).empty();

// If pressing down arrow, move to folder suggestions, while Backscape or ESC will close it
// ---------------------------------------------------------------

  if ($(folderSuggestions).children('a:focus')[0]) {
    event.stopPropagation();
    event.preventDefault();

    if (event.keyCode === 40 || event.keyCode === 9) {
      let focus = $(folderSuggestions).children('a:focus').next().focus();
      if (!focus[0]) $(folderSuggestions).children('a').first().focus();
    }
    if (event.keyCode === 38) {
      let focus = $(folderSuggestions).children('a:focus').prev().focus();
      if (!focus[0]) $(folderSuggestions).children('a').last().focus();
    }
    if (event.keyCode === 8) $(FolderInput).focus();
  }
// Cancel anchor link redirect, and allow arrow keys to traverse links (focusing)
// ---------------------------------------------------------------
  if (!Directory) return true; //Then no files even available, no reason to run this part

    if (event.ctrlKey && !$('input, a').is(':focus'))
      $('.transfer').find('span')[0].innerText = '(COPY)';

    if (event.shiftKey && !$('input, a').is(':focus') ) {
      $('.selected-count').text(`(All)`);
      $(moreFiles).find('span').text(`Show All Files (${Directory.files.length || 0})`);
    }

  return true;
// Change "More Files" and "Transfer" button names/info when Shift or CTRL is pressed
// ---------------------------------------------------------------
}
