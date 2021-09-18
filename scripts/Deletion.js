'use strict';
/*===============================================================
  Triggered by either clicking the 'Trash bin' icon, clicking Delete, or Delete All. Target is the button, deleteCondition is to tell the function which delete method was requested by user.
  Very convoluted function, it is meant to deal with all instances of deletion even amidst user mismanagement. After completing any delete requests to the back-end, it removes the file cards that represent the file data as well.
===============================================================*/
async function deleteMultiple(condition) {

  clearDialog();
  $('.input').removeAttr('disabled');
  let canDelete = false, failedFiles = [];
  const uploadedFiles = SelectedFiles.count.filter( file => !pathfinder(StagedFiles.count, 'find', file));
  //Before sending it to back-end for deletion, remove any Staged Files from the submission. Can't "Delete" those obviously, as they are not uploaded. But the user still wants them removed from front-end, so leave them in Selected Files.

    if (uploadedFiles.length) {
      [canDelete, failedFiles] = await sendDeleteRequest(uploadedFiles);
    } else if (event.shiftKey || condition === 'ALL') {
        SelectedFiles.count = [];
        await selectAll(AllFiles.count, true);
        [canDelete, failedFiles] = await sendDeleteRequest(AllFiles.count);
    } else canDelete = true;

// --------------------------------------------------------------------------------
  if (canDelete === false) /*Then*/ return false;

      if (SelectedFiles.count.length >= 100 && !$('progress').val()) {
        return window.location.reload(); //No reason to overload page with mass file deletion, just reload directory, unless operation is in progress
      }

      SelectedFiles.count.map ( async (file, i, arr) => {
        let fileCardToRemove;
          if (failedFiles && failedFiles.includes(file.name))
           return false; /*If some files were not deleted in database, don't remove their cards on page (skip over them)*/

        if (arr.length < 50) { //Don't do all these aesthetics if large amount of files are affected
          fileCardToRemove = getFileCard(file);
          $(fileCardToRemove).addClass('fadeout');
          setTimeout( () => AllFiles.delete(file, canDelete), 800);
        } else AllFiles.delete(file, canDelete);

        if (i === arr.length - 1)  //At the end of iteration, check if directory empty and if its a staged file
          checkForEmpty(canDelete, fileCardToRemove);

        return true;
      });
// --------------------------------------------------------------------
}; //End of file deletion function


/*===============================================================
  Triggered by either clicking the 'Trash bin' icon, clicking Delete, or Delete All. Target is the button, deleteCondition is to tell the function which delete method was requested by user.
  Very convoluted function, it is meant to deal with all instances of deletion even amidst user mismanagement. After completing any delete requests to the back-end, it removes the file cards that represent the file data as well.
===============================================================*/
async function deleteSingle(fileCard) {
  clearDialog();
  let canDelete = false, failedFiles = [];

  if (fileCard.tagName == 'LI')
    fileCard = $(`div[id="${$(fileCard).attr('title')}"][path="${$(fileCard).attr('path')}"]`)[0];
    //Then we're clicking the LI within the panel, which does not have the ID (file name), but its "title" is the same as file card ID, so we can get the ACTUAL file card that way.
  let file = {name: fileCard.id, path: $(fileCard).attr('path')};
  $(FileTable).children().removeClass('move');

// --------------------------------------------------------------------------------
  if ($(fileCard).hasClass('uploaded') || $(fileCard).hasClass('folder')) {
    //Not all file cards are 'uploaded', but all 'folders' qualify as "Uploaded"
    [canDelete, failedFiles] = await sendDeleteRequest([file]);
  }

// --------------------------------------------------------------------------------
  if (failedFiles && failedFiles.includes(fileCard.id) || canDelete === false)
  /*Then*/ return false;

    if ($(FileTable).children().length < 30 && !mobile) {
      const otherFiles = $(fileCard).siblings('div');
      const leftMostFile = $(FileTable).children([0]); //This will always select the FIRST file card, which should always be on the left-side of screen

      if (leftMostFile == fileCard)
        CSSVariables.setProperty('--cardPosition', `-${$(leftMostFile).position().left - 10}px`);
      else
        CSSVariables.setProperty('--cardPosition', `-${($(fileCard).position().left + $(leftMostFile).position().left) - 25}px`);
      // We acquired the relative position of the left-most file card and the current one we're deleting. This is for the animations executed below. The other cards shift to the right, while the deleted card moves left (using the left-most card as a reference), and later zooms down never to be seen again.
      $(fileCard).css('animation', 'deleted 1s forwards');
      $(otherFiles).addClass('move');

    } else $(fileCard).addClass('fadeout');


    setTimeout( () => {
      AllFiles.delete(file, canDelete);
      $(FileTable).children('div').removeClass('move');
      checkForEmpty(canDelete, fileCard);
    }, 1000);
// --------------------------------------------------------------------------------
};


/*===============================================================
  Triggered by either clicking the 'Trash bin' icon, clicking Delete, or Delete All. Target is the button, deleteCondition is to tell the function which delete method was requested by user.
  Very convoluted function, it is meant to deal with all instances of deletion even amidst user mismanagement. After completing any delete requests to the back-end, it removes the file cards that represent the file data as well.
===============================================================*/
async function sendDeleteRequest(filesToDelete, refresh) {
// ---------------------------------------------------------
if (!Array.isArray(filesToDelete))
  filesToDelete = [filesToDelete];

  const operation = 'Delete';
  const data = {
    files: filesToDelete,
    preferences: JSON.stringify(UserSession.preferences),
  }

  showOperation(operation);
  let failedFiles = [];
// --------------------------------------------------------------------------------
  //Send user form information to verify permission for deleting the file(s) in question
  return await axios({
    method: 'DELETE',
    url: `/delete/${CurrentFolder || Partition}`,
    data: data,
    headers: {
      operation: operation,
    },
  })
  .then( async (res) => {
    $('.input').removeAttr('disabled');

    if (await checkForServerError(res))
      return false;


    Flash(...Object.values(res.data));
    if (res.data.type === 'error')
      throw new Error(res.data.content);

     else if (res.data.type === 'warning' && res.data.items) {
      typeof(res.data.items) === 'string'
      ? failedFiles = [res.data.items]
      : failedFiles = res.data.items;
    } //Make sure it's an array

    if (refresh) setTimeout( () => window.location = window.location, 300); //This is called when deleting a Primary Directory, not used for anything else
    return [true, failedFiles]; //Needs to be an array in this order. The first element represents whether to actually delete the file card/file references from the page
// --------------------------------------------------------------------------------
  })
  .catch( (error) => {
  	if (failedFiles.length)
      return [false, failedFiles];
    else return window.location = '/login';
  });
};


// ------------------------------------------------------------------------------
$('#deleteBtn').click( () => {
  const targetFiles = SelectedFiles.count.length ? SelectedFiles.count : AllFiles.count;

  if (targetFiles === AllFiles.count && !event.shiftKey)
    return Flash('No files selected for deletion.', 'warning');

  let totalSize = 0;
  for (let file of targetFiles) {
    if (totalSize >= 50000000) { // No need to keep counting if already past warning threshold
      break;
    } else if (pathfinder(StagedFiles.count, 'find', file)) continue;
    else {
      let found = pathfinder(AllFiles.count, 'find', file);
      totalSize += found ? found.size : 0;
    }
  };

  if (UserSession.preferences.deleteCheck && totalSize >= 50000000) {
    // If size is more than 50 MBs send a warning before deletion
    dialogPrompt({
      warning: `Delete <span class="dimblue">${targetFiles.length}</span> files (<span class="dimblue">${getFileSize(totalSize)}</span>)? This cannot be undone.`,
      responseType: 'boolean',
      proceedFunction: `deleteMultiple('${targetFiles === AllFiles.count ? 'ALL' : false}')`,
      preference: 'deleteCheck'
    });

  } else deleteMultiple();

})
