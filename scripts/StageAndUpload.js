'use strict';

/*===============================================================
Detects the user dragging any "thing" or "item" onto the browser window. If they are a type of "File", start a loop iteration of them -- and after a given time -- try to stage them.
===============================================================*/
async function fileDragger(evt) {
  evt.preventDefault();

  if (evt.dataTransfer && evt.dataTransfer.items && evt.type !== 'dragover' && !mobile) {
// ---------------------------------------------------------
    if (!evt.dataTransfer.files.length) return false;

    let i = 0;
    for (let item of evt.dataTransfer.items) {
      let entry = item.webkitGetAsEntry();

      if (!i && entry.isDirectory && UserSession.preferences.folderWarning) {
      	return dialogPrompt({
          warning: `Be warned. Folders staged through drag-and-drop have been found to occasionally miss files within. Make sure upload count matches number of files on disk. If not, just use the directory uploader above File Upload.`,
          responseType: 'confirm',
          proceedFunction: "Flash(['Confirmed, now try again'], 'success', [], 'dragwarning')",
        });
      }
// ---------------------------------------------------------
      traverseFileTree(entry, "");
      i++;
    };

  } else return false;

};


/*===============================================================
  If item is indeed a file, give it a path (subtle but important, without it the server won't know where to upload it, and errors will be caused), and store it within the files array for staging. If it's a folder, conatenate the path and start a self-call of this same function.
===============================================================*/
async function traverseFileTree(item, path = '') {
  path = path || "";

  if (item && item.isFile) {
    return await item.file( (data) => {
    //Very critical steps here. This produces the blob-file we can actually store in StagedFiles.
      data.path = path;
      Outbound.staged.push(data);
      Outbound.size += data.size || 0;
      //We push it to the global object 'Outbound'
      window.clearTimeout(window.uploadQueue);
      window.uploadQueue = setTimeout( () => {
      //uploadQueue timeout basically provides a time limit for the file buffers to be parsed, before sending it to be staged (dialogue prompt for warning of large size). This was very necessary as Javascript does not promsify file uploading, and would continue on and the files would never be staged. This basically ensures that -- as long as new files are flooding in to be parsed -- the timeout endlessly resets until no more files arrive to reset it.
// ----------------------------------------------------------------
        if (UserSession.preferences.uploadWarning && Outbound.staged.length > 50 || UserSession.preferences.uploadWarning && Outbound.size > 4e8) {
          dialogPrompt({
            warning: `Excessive amount (or size) of files being uploaded <span class="darkcyan">(${Outbound.staged.length})</span>. <br> Total size of <span class="dimblue">${getFileSize(Outbound.size)}.</span> <hr> Compression to zip file is advised.`,
            responseType: 'confirm',
            proceedFunction: "checkAndStageFiles(Outbound.staged)",
            preference: 'uploadWarning',
            storageType: 'staged'
          });
        } else checkAndStageFiles(Outbound.staged);
      }, 10);
    });
// ----------------------------------------------------------------
  } else if (item.isDirectory) {
      const dirReader = await item.createReader();
      dirReader.readEntries(async function (entries) {
        for (let entry of entries)
          //Start internal function call and continue the process until it circles back up.
          await traverseFileTree(entry, `${path}/${item.name}`);
          //Also important, is the path building with the item name. This basiaclly concatenates the current path with this new directory name. You see how this can build up if there are multiple sub-directories.
      });
  }
// ----------------------------------------------------------------
};


/*===============================================================
Triggered when the user selects files to upload. It's basically for aesthetic purposes. We do some validation checks to make sure it's a valid file, or if there were duplicate uploads. Primarily, we create a 'File Card' (div) which contains more information about the file (size, type), and that File Card is very essential for other functions, as it houses the media content once it is uploaded, and has an ID corresponding to that of the file name within, which is useful for identification purposes.
===============================================================*/
async function checkAndStageFiles (inputFiles) {

  clearDialog('staged');
  let input = $(FolderInput).val() || '';

  if (!input || !alphabet.find( (letter) => input.includes(letter) ))
    return Flash('Folder path input not valid (or empty), use a better name', 'error');
  if ($('#mydirCheck').is(':checked'))
    return Flash('Cannot submit items from public to private directory. Visit personal directory if you wish to upload there', 'error');
  input = filterInput(input, 0);

  const duplicateFiles = [];
  const badFiles = [];
  //These two arrays are for upload errors. If we upload duplicates or bad file types, these store the given files and error-flash their names at the end.

// -----------------------------------------------------------------
  const queuedFiles = Array.from(inputFiles).map( async (file) => {
    return new Promise( (resolve, reject) => {
    // ------------------------------------------------------------------
        if (!file.path) {
          file.webkitRelativePath //Then user uploaded a single directory
          ? file.path = `${input}/${file.webkitRelativePath.replace(`/${file.name}`, '')}`
          : file.path = input; //Then just a simple file targetting one directory
        } else file.path = `${input + file.path}`;
        //If a whole directory is uploaded, each file within contains a relative path (but also includes file name and an extra '/', which we don't want)

        if (pathfinder([StagedFiles.count, AllFiles.count], 'find', file)) {
          duplicateFiles.push(file.name);
          return reject(false);
        }
    // ------------------------------------------------------------------
        file.mode = 33256;
        file.stats = {mode: 33256, size: file.size || 1, lastModified: file.lastModified || Date.now()};
        // Silly, but created errors since mode is needed to determine what type of file card to create

        if (StagedFiles.count.length < 50 && file.path === CurrentFolder) {

          //Meaning, don't bother with this if the user uploaded dozens of files, overkill
          if (!$(`[id="${file.name}"][path="${file.path}"]`)[0]) { //If an uploaded file card does not already exist
            let fileCard = $(makeFileCard(file, 'queued'));
            $(fileCard).attr('path', file.path);
            $(FileTable).prepend(fileCard);
          }
        }

        StagedFiles.add(file);
        return resolve(true);
    });
  });
// -----------------------------------------------------------------
  await Promise.all(queuedFiles).then( () => {
  	$('.staged-files').children('li').find('i').remove();
    $('.staged-files').children('li').prepend(`<i class="fa fa-file-text" style="left: -40"></i>`);
    //Just to add the "file-text" Icon next to every staged file, annoying trying to wire it into the File Status Adjuster
  }).catch( err => { // Can only be one error, duplicate files
    if (duplicateFiles.length)
      return window.messageLog = Flash(['Already uploaded: ', 'To file queue'], 'error', duplicateFiles);
  });

  $(FileTable).children('.uploaded').removeClass('queued'); //Counter a bug that sometimes occurs
// ------------------------------------------------------------------
  if (StagedFiles.count.length >= 50) {
    $(FileTable).children('.queued').remove();
    if (window.messageLog) window.messageLog.then( () => {
	  window.messageLog = Flash(['Large number of files being uploaded: ', 'Compression to zip file before upload is advised'], 'warning', `${StagedFiles.count.length}`);
    });
  }
// ------------------------------------------------------------------
  //$(FolderInput).attr('disabled', 'true');
  checkForEmpty();
  $('.file-input').val('')
}; //----End of File Upload select function


/*===============================================================
Some random selections and options that must be verified before we submit. If there are choices that conflict with the conventional procedure of uploading, return some error.
===============================================================*/
async function checkSubmissionOptions(folderChoice) {
  clearDialog();

  if (StagedFiles.count.length) {
  	let operation = 'Upload';
  	if (await !showOperation(operation, StagedFiles.count))
      return false;
  }

  event.preventDefault();
  event.stopPropagation();
  // Halt conventional post request, and perform our own using axios futher below
  
  if ($('#mydirCheck').is(':checked')) {
    const userParameter = `${UsersDirectory}/${Username}`;
    if (folderChoice.slice(0, userParameter.length) !== userParameter) {
      return Flash([`Attempted submission to home directory, but input is incorrect:`, `Uncheck "My Directory" box`], 'error', [`<span class="dimblue">${folderChoice}</span>`])
    }
  }

  if ($('.checkbox').is(':checked')) UserSession.preferences.emptyDir = true;
  else if (!StagedFiles.count.length && !UserSession.preferences.emptyDir) {
    Flash('No files in queue', 'warning');
    return false;
  }

  return true;
};


/*===============================================================
Triggers when a user clicks SUBMIT. Halts default form submission, appends file data from our StagedFiles class (created by checkAndStageFiles function) to the FormData, and submits an extensive axios post request and evaluates user verification before official uploading of files. If successful, we subsequently link the official Files to the File Cards created by "checkAndStageFiles", so the user can see the media data live.
===============================================================*/
async function submitFiles (event) {
	
  let operation = StagedFiles.count.length ? 'Upload' : '';
  let folderChoice = $(FolderInput).val() || CurrentFolder;
  
  if (checkSubmissionOptions(folderChoice)) {
  // ------------------------------------------
    let formData = new FormData();

    for (let file of StagedFiles.count) {
      if (file.uploading) continue;
      else {
    	file.uploading = true;
    	formData.append('files', file, `${file.path}/${file.name}`);
      }
    }

    if ($('#mydirCheck').is(':checked'))
      formData.append('mydirectory', true);

    formData.append('preferences', JSON.stringify(UserSession.preferences));
    SelectedFiles.unlist();
  // ------------------------------------------
    await axios({
      method  : 'post',
      url : `/${Partition + folderChoice}`,
      data : formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        operation: operation,
      },
      cancelToken: new CancelToken( (c) => Requests.Upload = c), // So it can be cancelled by browser
      onUploadProgress: data => {
      	if ($(`.progress.Upload`)[0]) {
	      const {loaded, total} = data;
  	      if (data.lengthComputable) { //Update progress bar
            let progress = loaded / total * 100;
            $(`.progress.${operation}`).val(progress);
  	      }
      	}
	  }
    }).then( (res) => returnUploadedContent(res, operation))
    .catch( (error) => {
     Requests.cancel('Upload');
     if (axios.isCancel(error))
       Flash(operation + ' aborted', 'warning');
	 else Flash([error.message], 'error');
      return false;
    });
  }
// ------------------------------------------
}; //---End of: Submit Files function


/*===============================================================
Receives the data/info after submitting a post request to upload files and/or create a folder. The staged File Card referenced by each created file's name is manipulated and populated with media content and updated in real-time for the user to view. Beforehand, we determine if a lot of files/folders were uploaded, whereas we trigger a page refresh.
===============================================================*/
async function returnUploadedContent (res, op) {
	
  if (await checkForServerError(res, op))
    return Flash(...Object.values(res.data));

  if (res.config.url === `/${Partition + $(FolderInput).val()}`) { //If the Current Folder has changed by the time reponse has occured, don't try to display any files (as we're not in the directory those files belong to)

    Flash(...Object.values(res.data));
    $('.file-name').text('None');

    if (!Directory.name || !CurrentFolder || CurrentFolder.isNotIn(FolderInput[0].value) && res.data.type === 'success') {// If not in a directory or we uploaded outside current directory, redirect after completion
		return changeDirectory(event, `${home}/${Partition + $(FolderInput).val()}`);
    }
    if (res.data.newfolders) {
      // Special response data, as 'folders' is only returned when uploading files and new directory/directories were created in the process. Usually an array of arrays.
      let newfolders;
      typeof (res.data.newfolders) === 'string'
      ? newfolders = [res.data.newfolders]
      : newfolders = res.data.newfolders;
      //Must always be an array OF arrays, since each 'array' element represents a directory created, and each element within those arrays how many sub-directories were created

      if (newfolders[0]) createFolderContent(newfolders);
    }; //End of: If new directories were created ---->
	//Special response data, as 'newfolders' is only returned when uploading files and new directory/directories were created in the process. Usually an array of arrays. Must always be an array OF arrays, since each 'array' element represents a directory created, and each element within those arrays how many sub-directories were created
  }
   if (!CurrentFolder && res.data.type !== 'error' || res.data.uploaded && res.data.uploaded.length >= 100)

    return setTimeout( () => changeDirectory(event, `${home}/${Partition + $(FolderInput).val()}`), 1000);
  // -----------------------------------------------------------------------------

    if (res.data.type !== 'error' && StagedFiles.count.length)  //If no errors, and files were uploaded successfully.
      createFileContent(res);
    else Flash(...Object.values(res.data));
    //End of: major Else statement. If there was no server response errors.
    $('.input').removeAttr('disabled');
};


/*===============================================================
If a folder was created back-end after an upload/submission attempt, create a 'Folder Card' by referencing the data sent back from response, to determine how many folder cards to create.
===============================================================*/
async function createFolderContent(newfolders) {
  for (let folder of newfolders) {
    if (namefinder(AllFiles.count, 'find', folder)) {
      continue; //If that folder already exists in directory don't bother
    } else
    
    fetchFolder(folder);
  }; //Loop over folders, see how nested they are
  return true;
};


/*===============================================================
If any files were uploaded successfully, loop over all the staged files and (excluding those that failed to upload) we locate the divs/columns which reference each given file (could be a video, image, audio etc.) and insert this new source data into the file card so the user can view the media content, as is now provided by the server.
===============================================================*/
async function createFileContent(res) {
 try {
  const {uploaded} = res.data;

  if (StagedFiles.count.length) {

    for (let file of StagedFiles.count) {

	  delete(file.uploading);
      if (uploaded && !pathfinder(uploaded, 'find', file)) /*---->*/ continue;
      // If the given Staged File was not uploaded (failed) or staged during upload, do not unstage or attempt to display its content

      else { //Then all items were successful, display all of them.
        let newfile = uploaded ? pathfinder(uploaded, 'find', file) || file : file;
        StagedFiles.unlist(newfile); //New staged files may have been added during upload, so we reference the "newfile" to unlist
        // -----------------------------------------------------------------------------

        if (file.path !== CurrentFolder)
          continue; //If the file was uploaded outside current directory, don't bother displaying it.
        // -----------------------------------------------------------------------------


        let folderCard = getFileCard(newfile) ? getFileCard(newfile) : $(makeFileCard(newfile));

        $(folderCard).removeClass('queued').not('.folder').addClass('uploaded');
        createMedia(newfile, $(FolderInput).val(), folderCard).then( source => insertFileCard(source, folderCard, newfile));
        // -----------------------------------------------------------------------------

        newfile ? Directory.files.push(newfile) : false;
        newfile ? AllFiles.add(newfile, true) : false;
      }; //End of: If no failed files
  // -----------------------------------------------------------------------------
    }; //End of: For loop going over staged files
  } //End of: If any staged files at all
  checkForEmpty();
 } catch (err) {console.log(err)};
};
