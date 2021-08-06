/*===============================================================
  Triggered by either clicking the 'Trash bin' icon, clicking Delete, or Delete All. Target is the button, deleteCondition is to tell the function which delete method was requested by user.
  Very convoluted function, it is meant to deal with all instances of deletion even amidst user mismanagement. After completing any delete requests to the back-end, it removes the file cards that represent the file data as well.
===============================================================*/
async function deleteMultiple(condition) {

  clearDialog();
  let canDelete = false, failedFiles = [];
  let selectedFiles = SelectedFiles.count;
  $('.input').removeAttr('disabled');

    if (SelectedFiles.count.length) {
      await selectAll(StagedFiles.count, true);
      SelectedFiles.count.length
      ? [canDelete, failedFiles] = await sendDeleteRequest(SelectedFiles.count)
      : canDelete = true;
    } else if (SelectedFiles.count.length < 1 && event.shiftKey || condition === 'ALL') {
        SelectedFiles.count = [];
        await selectAll(Directory.files, true);
        selectedFiles = SelectedFiles.count;
        [canDelete, failedFiles] = await sendDeleteRequest(Directory.files);
    } else canDelete = true;


// --------------------------------------------------------------------------------
  if (canDelete === false) /*Then*/ return false;

    for (let file of selectedFiles) {
      if (failedFiles && failedFiles.includes(file.name)) /*If some files were not deleted in database, don't remove their cards on page (skip over them)*/ continue;

      let fileCardToRemove = getFileCard(file);
      $(fileCardToRemove).addClass('fadeout');

      setTimeout( () => {
        AllFiles.delete(file, canDelete);
        StagedFiles.unlist(file, true);
        checkForEmpty(canDelete, fileCardToRemove);
      }, 1000);
    };
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

    if ($(FileTable).children().length < 30) {
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
      $('.input').removeAttr('disabled');
      $(FileTable).children('div').removeClass('move');
      AllFiles.delete(file, canDelete);
      $('.staged-count').text(`(${StagedFiles.count.length})`);
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

  const data = {
    files: filesToDelete,
    preferences: JSON.stringify(UserSession.preferences)
  }

  $(FS_Modal).show();
  $('.fs-modal-message').text('Deleting files...');
  let failedFiles = [];
// --------------------------------------------------------------------------------
  //Send user form information to verify permission for deleting the file(s) in question
  return await axios({
    method: 'delete',
    url: `/delete/${CurrentFolder || Partition}`,
    data: data,
  })
  .then( (res) => {
    Flash(...Object.values(res.data));
    if (res.data.type === 'error')
      throw new Error(res.data.content);

     else if (res.data.type === 'warning' && res.data.items) {
      typeof(res.data.items) === 'string'
      ? failedFiles = [res.data.items]
      : failedFiles = res.data.items;
      }

    //The server sends back a manufactured response with a message and "type" that our Flash uses to provide spoonful information to the page based on what happened server-side
    if (refresh) setTimeout( () => window.location = window.location, 300);
    return [true, failedFiles];
// --------------------------------------------------------------------------------
  })
  .catch( (error) => {
    return [false, failedFiles];
  });
};


// ------------------------------------------------------------------------------
$('#deleteBtn').click( () => {
  SelectedFiles.count.length
  ? targetedFiles = SelectedFiles.count.length
  : targetedFiles = 'ALL';

  if (targetedFiles === 'ALL' && !event.shiftKey)
    return Flash('No files selected for deletion.', 'warning');

  if (UserSession.preferences.deleteCheck) {
    dialogPrompt({
      warning: `Delete <span class="dimblue">${targetedFiles}</span> files? This cannot be undone.`,
      responseType: 'boolean',
      proceedFunction: `deleteMultiple('${targetedFiles}')`,
      preference: 'deleteCheck'
    });

  } else deleteMultiple();

})
