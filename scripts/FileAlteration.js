'use strict';

let startFakeTransferProgress;
let transferMultiple;
let initiateTransfer;
let fetchFolder;
if (!Private || !oversize) { //This is only relevant for guest user, as other users have infinity maxsize

fetchFolder = async function (folder) {
  const failed = []
  axios.get(`${Partition + CurrentFolder}?fetch=${folder}`).then( (res) => {
// ----------------------------------------  	

    const subdirectory = res.data;
  	subdirectory.name = folder;
  	if (getFileCard(subdirectory)) 
  	  AllFiles.delete(subdirectory, true); 	

    let folderCard = $(makeFileCard(subdirectory));

    createMedia(subdirectory, CurrentFolder, folderCard).then( source => insertFileCard(source, folderCard, subdirectory));
    AllFiles.add(subdirectory, true); 
    Directory.files.push(subdirectory); 
         	
  }).catch( (err) => failed.push(folder)); 
 // ----------------------------------------
  setTimeout( () => {
    if (failed.length)
      Flash(['Failed to retrieve stats for', 'Refresh directory to get accurate information display'], 'warning', failed);
  }, 5000);
};

/*===============================================================
  Combines size of all items staged for transfer. For each 100 megabytes, create a 1-second-timeout that advances the transfer progress bar divided by how many seconds remain (3 seconds would advance it 33% each timeout).
===============================================================*/
startFakeTransferProgress = async function (items) {

  let totalSize = items.length > 1 ? items.reduce(accumulateSize) : items[0].size // p = "previous", n = "next". Gets cumulative file size of all items. Or if single item, no need for array.

    let secondsToTransfer = Math.floor(Math.round(totalSize / 1000000) / 15); //Determines how many times to trigger the Transfer movement (higher division number means less triggers)

    if (secondsToTransfer) //If not less than 200 megabytes, create an artificial "progress" tracker to approximate duration of transfer.
      for (let i = 1; i <= secondsToTransfer; i++) { //Will rarely be more than 10 seconds (which would be over 2 gigabytes)
        let progress = (totalSize * i) / secondsToTransfer / totalSize * 100; //Each iteration will increase first chunk (totalSize * i), which is ultimately divided by total size
        setTimeout( () => $('.Transfer') ? $('.progress.Transfer').val(progress) : false, i * 500)
      } 
}

/*===============================================================
  Uses "transferFiles" to do the actual transfer, but this is only called when the user click the "Transfer" button and uses moves/copies the Selected Files. If there are no selected files or target folder specified, return error.
===============================================================*/
transferMultiple = async function (evt) {
  evt.preventDefault();
  evt.stopPropagation();

  if (!SelectedFiles.count.length && event.shiftKey) //Then user wishes to select everything
    Directory.files ? await selectAll(Directory.files, true) : null;
  else if (!SelectedFiles.count.length)
    return Flash('No files selected for transfer', 'warning');

  for (let file of SelectedFiles.count) {

    if (pathfinder(StagedFiles.count, 'find', file))
      return Flash(`${file.name} is not uploaded yet, and could not be transferred`, 'error');
    else if (!FolderInput[0].value || FolderInput[0].value === CurrentFolder)
      return Flash('No folder path specified, or current directory targeted', 'warning');

    let fileCard = getFileCard(file);
    if (!fileCard) continue;
    else evt.ctrlKey ? fileCard.copy = true : fileCard.copy = mobile; //If using mobile, always copy
  };

  await initiateTransfer(SelectedFiles.count, FolderInput[0].value, mobile ? true : evt.ctrlKey);  //Every file uploaded -- Regardless of being in a Directory or on Main Page -- Will have a folder path attatched to it, and that's all we need back-end to acquire folder's current location.
};


/*===============================================================
  Triggered whenever the user either drags a selected file card over a folder card, or clicks the Transfer button in the Panel Overhead to move/copy any files currently Selected. Any affected File Cards are given aesthetic classes/animations for clairvoyance.
===============================================================*/
initiateTransfer = async function (items, destination, copy) {

  if (!items) return Flash('Not a valid file', 'error');
  let operation = 'Transfer';
  let contentSize = items[1] ? items.reduce(accumulateSize) : items[0].size; // If more than one file, combine sizes, if one item, just find its size property
  let subdirectory = {name: destination.split('/')[1] || null, path: destination.split('/')[0]};
  
  if (!showOperation(operation || '', items)) 
    return false;
  
  const data = {
    items,
    destination,
    mydirectory: $('#mydirCheck').is(':checked'),
    copy, //Lets fs on back-end know the files being transferred should be copied
    preferences: JSON.stringify(UserSession.preferences)
  }
// -----------------------------------------------------------------------
  startFakeTransferProgress(items); 
  return await axios({
    method  : 'post',
    url : `/${Partition + destination}`,
    data : data,
    headers: {
      'Content-Type': 'application/json',
      'Content-Size': contentSize,
      operation: operation
    },
    cancelToken: new CancelToken( (c) => Requests.Transfer = c),
  }).then( async (res) => {
// -----------------------------------------------------------------------
  	if (await checkForServerError(res, operation))
  	  return false;
  	
    Flash(...Object.values(res.data));
    let results = res.data;

    if (results.type === 'error' || results.items.includes('/') && results.items.length < 2)
      SelectedFiles.unlist(items);  //If the items have a "/" in them and there is only one item within, it means it was a directory created pre-transfer
// -----------------------------------------------------------------------    	
    else {

      for (let i = 0; i < results.items.length; i++) {
        if (copy === false) {
        //If not copied, we don't want the file (i.e File Card) on the page as it is not within the current folder anymore obviously
        if (results.incomplete && namefinder(results.incomplete, 'find', results.items[i]))
          continue;

          let transfer = {name: results.items[i], path: results.paths[i]};

          if (CurrentFolder) {
            //If we are in a directory.
            let fileCard = getFileCard(transfer);
            !mobile ? $(fileCard).draggable( 'option', 'revert', false ) : null; //If mobile, drag-and-drop functionality does not exist, so don't bother
            $(fileCard).addClass('fadeout');
            AllFiles.delete(transfer, true);
          } else if (!$('#mydirCheck').is(':checked')) await setTimeout( async () => findAllFiles(event, 0), 100); //Otherwise we're at the homepage, and transfers should not signal the deletion of anything, and should just adjust paths (unless user is transferring from public to private)

        } //End of If Copy
        SelectedFiles.unlist();

      }; //End of: For Loop
    }; //If no errors
// -----------------------------------------------------------------------

    if (pathfinder(AllFiles.count, 'find', subdirectory) && results.items.length) fetchFolder(subdirectory.name); //If there exists a folder on the page, attempt to update it by retrieving the new transfer-manipulated data from back-end
    checkForEmpty(true);
  })
  .catch( (error) => {
  	if (axios.isCancel(error)) 
      Flash(operation + ' aborted', 'warning');
	else Flash([error.message], 'error');
	  checkError(error);
      return false;
  });
};
}


/*===============================================================
  After clicking an edit icon, turn the relative anchor to 'changed' and makes it editable. .
===============================================================*/
function setAnchorEditable(icon, anchor, li) {

  $(icon).addClass('changed'); // Make anchor text brown
  $(li).addClass('changed'); // For indication
  $(anchor).attr('contenteditable', 'true'); //Editable text
  const setpos = document.createRange(); //Creates an arbitrary text-start range on any element 
  setpos.setStart(anchor.childNodes[0], $(anchor).text().length) //Sets it to the end of the target anchor text
  const set = window.getSelection(); //Finds focus target
  setpos.collapse(true); //Don't know
  set.removeAllRanges(); //Removes any previous ranges on give element
  set.addRange(setpos); //Set the new cursor/text-start position declared above on current element
  $(anchor).focus(); //Focus element
  anchor.disabled = true; //Disable it so clicking won't redirect	
}


/*===============================================================
  Calls above function upon first clicking icon. This does not change until the user clicks the icon again to "complete" the change, whereas we call 'renameItem' and submit the edit. This is the only function where "AllFiles.rename" is utilized, which updates all elements and media content where the old name was referenced.
===============================================================*/
async function makeEdit (icon, anchor) {
  event.preventDefault();
  event.stopPropagation();

  let item = anchor; //Then it's a file card
  let li = $(anchor).closest('li')[0] || $(anchor).parents('h1')[0];
// -------------------------------------------
  if (item && item.id && item.tagName !== 'A') {

    //If edit button is clicked in file card, pass task over to the list item in panel and replace elements accordingly (trick function into thinking li was clicked). Performing element mutation/editing within file card was too annoying.
    li = $(`li[title="${item.id}"][path="${$(item).attr('path')}"]`)[0];
    anchor = $(li).find('a')[0];
    icon = $(anchor).next('.fa-edit');

    if ($('#panelHeader').height() < 80)
      $('#overheadPanel').click();
      //If the panel is not already active, bring it up upon editing item
  }

// -------------------------------------------
  if (!$(icon).hasClass('changed')) 
  	setAnchorEditable(icon, anchor, li);
// ------------------------------------------
   else {

  	 if (Requests.Download || Requests.Transfer || Requests.Delete) { // Attempted rename of file undergoing operation could create errors, halt it
       let file = {name: $(li).attr('title') || '', path: $(li).attr('path') || ''};

       if (pathfinder(SelectedFiles.count, 'find', file)) {
         let foundFile = pathfinder(SelectedFiles.count, 'find', file);	
         return Flash([`Renaming attempt rejected`, `is currently undergoing a ${foundFile.status} operation`], 'error', [file.name]);
       }
    	 
     } 
// ------------------------------------------     
    await renameItem (li).then( async (res) => {
    	
      if (!res) return false;
   
      if (await checkForServerError(res))
  	    return false;
  	  
      Flash(...Object.values(res.data));

      if (res.data.type === 'error') return false;
      if (li.id === 'primeDirectoryInput') return window.location.reload();
      //Then the renaming was through Primary Directories input, too complicated to find all refs, so just reload page
      else {
        res.data.path.name = res.data.path.old;

        SelectedFiles.unlist(res.data.path);
        AllFiles.rename(res.data.path);
      }
// ------------------------------------------
    }).catch( error => {
      Flash(error.message, 'error'); 
      checkError(error); 
      return false;
    });
  // ------------------------------------------   
    //And regardless...
    $(icon).removeClass('changed');
    $(li).removeClass('changed');
    $(anchor).attr('contenteditable', 'false').text(li.title);
    anchor.disabled = false;
  }
};


/*===============================================================
  The post request which takes the input provided by the user, finds the li they edited, takes the old naming and new naming and sends them the info for the back-end to deal with before returning the response.
===============================================================*/
async function renameItem (li) {
  event.preventDefault();
  event.stopPropagation();

  if (!$(li).attr('title'))
    return Flash('No item selected to rename', 'error');

  if ($(li).hasClass('changed')) {
    let file = {
      old: $(li).attr('title') || '',
      new: $(li).children('a').text() || '',
      path: $(li).attr('path') || '',
    };

    return await axios.post(`/rename`, file);

  } else return false;
};


/*===============================================================
  Triggered by either clicking the 'Trash bin' icon, clicking Delete, or Delete All. Target is the button, deleteCondition is to tell the function which delete method was requested by user.
  Very convoluted function, it is meant to deal with all instances of deletion even amidst user mismanagement. After completing any delete requests to the back-end, it removes the file cards that represent the file data as well.
===============================================================*/
async function deleteMultiple(condition) {

  clearDialog();
  $('.input').removeAttr('disabled');
  let canDelete = false, failed = [], deleted = [];
  const uploadedFiles = SelectedFiles.count.filter( file => !pathfinder(StagedFiles.count, 'find', file));
  //Before sending it to back-end for deletion, remove any Staged Files from the submission. Can't "Delete" those obviously, as they are not uploaded. But the user still wants them removed from front-end, so leave them in Selected Files.

    if (uploadedFiles.length) {
      [canDelete, failed, deleted] = await sendDeleteRequest(uploadedFiles); //Will return three parameters
    } else if (event.shiftKey || condition === 'ALL') {
        SelectedFiles.unlist();
        await selectAll([...StagedFiles.count, ...AllFiles.count], true);
        [canDelete, failed, deleted] = await sendDeleteRequest(AllFiles.count);
    } else {
      deleted = SelectedFiles.count; //Then it's just Staged Files selected for deletion
      canDelete = true;
    }

// --------------------------------------------------------------------------------
  if (canDelete === false) /*Then*/ return false;

      if (deleted.length >= 200 && !$('.progress').val()) 
        return window.location.reload(); //No reason to overload page with mass file deletion, just reload directory, unless operation is in progress
      
      deleted.map( async (file, i, arr) => {
  		let staged = pathfinder(StagedFiles.count, 'find', file) || false;
		  if (staged && staged.uploading) failed.push(staged);
		
        let fileCardToRemove;
          if (failed && pathfinder(failed, 'find', file))
           return false; /*If some files were not deleted in database, don't remove their cards on page (skip over them)*/

        if (arr.length < 50) { //Don't do all these aesthetics if large amount of files are affected
          fileCardToRemove = getFileCard(file) || null;
          fileCardToRemove ? $(fileCardToRemove).addClass('fadeout') : false;

          setTimeout( () => AllFiles.delete(file, canDelete), 800);
        } else AllFiles.delete(file, canDelete);

        if (i === arr.length - 1)  //At the end of iteration, check if directory empty
          setTimeout( () => checkForEmpty(canDelete), 1000);
      });

// --------------------------------------------------------------------
}; //End of file deletion function


/*===============================================================
  Triggered by either clicking the 'Trash bin' icon, clicking Delete, or Delete All. Target is the button, deleteCondition is to tell the function which delete method was requested by user.
  Very convoluted function, it is meant to deal with all instances of deletion even amidst user mismanagement. After completing any delete requests to the back-end, it removes the file cards that represent the file data as well.
===============================================================*/
async function deleteSingle(fileCard) {
  clearDialog();
  let canDelete = false, failed = [];

  if (fileCard.tagName == 'LI')
    fileCard = $(`div[id="${$(fileCard).attr('title')}"][path="${$(fileCard).attr('path')}"]`)[0];
    //Then we're clicking the LI within the panel, which does not have the ID (file name), but its "title" is the same as file card ID, so we can get the ACTUAL file card that way.
  let file = {name: fileCard.id, path: $(fileCard).attr('path')};
  $(FileTable).children().removeClass('move');

// --------------------------------------------------------------------------------
  if ($(fileCard).hasClass('uploaded') || $(fileCard).hasClass('folder')) {
    //Not all file cards are 'uploaded', but all 'folders' qualify as "Uploaded"
    [canDelete, failed] = await sendDeleteRequest([file]);
  }

// --------------------------------------------------------------------------------
  if (failed && failed.includes(fileCard.id) || canDelete === false)
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
      checkForEmpty(canDelete);
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
  if (!showOperation(operation || '', filesToDelete)) 
    return [false, [], []];
    
  const data = {
    files: filesToDelete,
    preferences: JSON.stringify(UserSession.preferences),
  }
    
  let failed = [];
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
  	const report = res.data;
    $('.input').removeAttr('disabled');

    if (await checkForServerError(res, operation))
      return [false, [], []];

    Flash(report.content, report.type, []);
    if (report.type === 'error')
      throw new Error(report.content);

     else if (report.type === 'warning' && report.items) failed = report.items;
     //Make sure it's an array

    if (refresh) return setTimeout( () => window.location.reload(), 300); //This is called when deleting a Primary Directory, not used for anything else
    
    return [report.deleted.length ? true : false, failed, report.deleted || []]; //Needs to be an array in this order. The first element represents whether to actually delete the file card/file references from the page
// --------------------------------------------------------------------------------
  })
  .catch( (error) => {
  	if (failed.length)
      return [false, failed, []];
    else {
      checkError(error);
      Flash(error.message, 'error');
      return [false, [], []];
    }
  });
};
// --------------------------------------------------------------------------------