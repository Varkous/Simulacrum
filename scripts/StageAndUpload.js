'use strict';
/*===============================================================
Detects the user dragging any "thing" or "item" onto the browser window. If they are a type of "File", start a loop iteration of them -- and after a given time -- try to stage them.
===============================================================*/
async function fileDragger(evt) {
  evt.preventDefault();

  if (evt.dataTransfer && evt.dataTransfer.items && evt.type !== 'dragover' && !mobile) {

  if (!evt.dataTransfer.files.length) return false;
    for (let item of evt.dataTransfer.items) {
      let entry = item.webkitGetAsEntry();
      await traverseFileTree(entry, "");
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
      //We push it to the global variable 'Outbound'
      window.clearTimeout(window.uploadQueue);
      window.uploadQueue = setTimeout( () => {
      //uploadQueue timeout basically provides a time limit for the file buffers to be parsed, before sending it to be staged (dialogue prompt for warning of large size). This was very necessary as Javascript does not promsify file uploading, and would continue on and the files would never be staged. This basically ensures that -- as long as new files are flooding in to be parsed -- the timeout endlessly resets until no more files arrive to reset it.
// ----------------------------------------------------------------
        if (UserSession.preferences.uploadWarning
        && Outbound.staged.length > 50 || Outbound.size > 4e8) {
          dialogPrompt({
            warning: `Excessive amount (or size) of files being uploaded <span class="darkcyan">(${Outbound.staged.length})</span>. <br> Total size of <span class="dimblue">${getFileSize(Outbound.size)}.</span> <hr> Compression to zip file is advised.`,
            responseType: 'confirm',
            proceedFunction: "checkAndStageFiles(Outbound.staged)",
            preference: 'uploadWarning',
            storageType: 'staged'
          });
        } else checkAndStageFiles(Outbound.staged);
      }, 50);
    });
// ----------------------------------------------------------------
  } else if (item.isDirectory) {
      const dirReader = item.createReader();
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
function checkAndStageFiles (inputFiles) {
  clearDialog('staged');
  let input = FolderInput[0].value || '';

  if (!input || !alphabet.find( (letter) => input.includes(letter) ))
    return Flash('Folder path input not valid, use a better name', 'error');
  if ($('#mydirCheck').is(':checked'))
    return Flash('Cannot submit items from public to private directory. Visit personal directory if you wish to upload there', 'error');
  input = filterInput(input, 0);


  const duplicateFiles = [];
  const badFiles = [];
  //These two arrays are for upload errors. If we upload duplicates or bad file types, these store the given files and error-flash their names at the end.

  const files = Array.from(inputFiles);
  files.forEach( async (file, index) => {
// ------------------------------------------------------------------
    if (!file.path) {
      file.webkitRelativePath //Then user uploaded a single directory
      ? file.path = `${input}/${file.webkitRelativePath.replace(`/${file.name}`, '')}`
      : file.path = input; //Then just a simple file targetting one directory
    } else file.path = `${input + file.path}`;
    //If a whole directory is uploaded, each file within contains a relative path (but also includes file name and an extra '/', which we don't want)

    if (pathfinder([StagedFiles.count, AllFiles.count], 'find', file)) {
      duplicateFiles.push(file.name);
      return file = null;
    }

    if (!file.name.includes('.'))
      return badFiles.push(file.name);
// ------------------------------------------------------------------
    file.mode = 33256;
    file.stats = {mode: 33256};

    if (StagedFiles.count.length < 50 && file.path === CurrentFolder) {

      //Meaning, don't bother with this if the user uploaded dozens of files, overkill
      if (!$(`[id="${file.name}"]`)[0]) { //If an uploaded file card does not already exist
        let fileCard = $(makeFileCard(file, 'queued'));
        $(fileCard).attr('path', file.path);
        $(FileTable).prepend(fileCard);
      }
    }

    StagedFiles.add(file);
  }); //----End of file for loop

  $(FileTable).children('.uploaded').removeClass('queued');
// ------------------------------------------------------------------
  if (StagedFiles.count.length >= 50) {
    $(FileTable).children('.queued').remove();

    window.clearTimeout(window.uploadWarning);
    window.uploadWarning = setTimeout( () => {
      Flash(['Large number of files being uploaded: ', 'Compression to zip file before upload is advised'], 'warning', `${StagedFiles.count.length}`);
    }, 4000);
  }
// ------------------------------------------------------------------
  $(FolderInput).attr('disabled', 'true');
  checkForEmpty();
  fileInput.value = '';

  if (badFiles.length) return Flash ('Incompatible file extensions on: ', 'error',
  badFiles.length >= 25 ? `${badFiles.length}` : badFiles);

  if (duplicateFiles.length) return Flash(['Already uploaded: ', 'To file queue'], 'error', duplicateFiles.length >= 25 ? `${duplicateFiles.length}` : duplicateFiles);

}; //----End of File Upload select function


/*===============================================================
Some random selections and options that must be verified before we submit. If there are choices that conflict with the conventional procedure of uploading, return some error.
===============================================================*/
function checkSubmissionOptions(folderChoice) {

  if ($('#mydirCheck').is(':checked')) {
    userParameter = `${UsersDirectory}/${UserSession.user.name}`;
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
  clearDialog();
  let operation = 'Upload';
  event.preventDefault();
  event.stopPropagation();
  // Halt conventional post request, and perform our own using axios futher below

  let folderChoice = FolderInput[0].value || CurrentFolder;
  if (checkSubmissionOptions(folderChoice)) {
  // ------------------------------------------
    let formData = new FormData();

    for (let file of StagedFiles.count) {
      formData.append('files', file, file.name);
      formData.append('paths', file.path || folderChoice);
      //Paths are used alongside the files back-end and will always have the same array length as eachother
    }
    if ($('#mydirCheck').is(':checked'))
      formData.append('mydirectory', true);

    formData.append('preferences', JSON.stringify(UserSession.preferences));
    formData.append('operation', operation);
    SelectedFiles.unlist();
    showOperation(operation);

  // ------------------------------------------
    await axios({
      method  : 'post',
      url : `/${Partition + folderChoice}`,
      data : formData,
      onUploadProgress: data => {
	    const {loaded, total} = data;
	    //Using local progress events
  	    if (data.lengthComputable) {
          let progress = loaded / total * 100;
          $('.progress').attr('value', progress);
  	    }
	    }
    }).then(returnUploadedContent)
    .catch( (error) => {
      if (StagedFiles.count.length >= 50)
        Flash(error.message, 'error');
        return false;
    });
  }
// ------------------------------------------
}; //---End of: Submit Files function


/*===============================================================
Receives the data/info after submitting a post request to upload files and/or create a folder. The staged File Card referenced by each created file's name is manipulated and populated with media content and updated in real-time for the user to view. Beforehand, we determine if a lot of files/folders were uploaded, whereas we trigger a page refresh.
===============================================================*/
async function returnUploadedContent (res) {
  await checkForServerError(res);
  // if (res.config.url === `/${Partition + CurrentFolder}`) { //If the Current Folder has changed by the time reponse has occured, don't try to display any files (as we're not in the directory those files belong to)

    Flash(...Object.values(res.data));
    $('.file-name').text('');

    if (!Directory.name || !res.config.url.includes(Partition) || !$(FolderInput).val().includes(CurrentFolder)) {
      //If we're not in a directory (a child of Partition anyway), re-direct to the target folder
      dismissElement('main', 'Y', 'down', '50%', 600, true);
      return changeDirectory(event, `${window.location.origin}/${Partition + $(FolderInput).val()}`);
    }

    if (res.data.newfolders) {
      // Special response data, as 'folders' is only returned when uploading files and new directory/directories were created in the process. Usually an array of arrays.
      let newfolders;
      typeof (res.data.newfolders) === 'string'
      ? newfolders = [res.data.newfolders]
      : newfolders = res.data.newfolders;
      console.log (res.data.newfolders);
      //Must always be an array OF arrays, since each 'array' element represents a directory created, and each element within those arrays how many sub-directories were created
      if (newfolders[0]) createFolderContent(newfolders);
    }; //End of: If new directories were created ---->

  // -----------------------------------------------------------------------------
    checkForEmpty();
    if (res.data.type !== 'error' && StagedFiles.count.length)   //If no errors, and files were uploaded successfully.
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
      continue;
    }
  // -----------------------------------------------------------------------------
      let newFolder = {
        name: folder,
        path: CurrentFolder,
        mode: 16822,
        stats: {mode: 16822}, // Both this and mode are bogus, did it so functions below would treat it as a legit "folder"
      };

      let fileCard = $(makeFileCard(newFolder));
      $(FileTable).prepend(fileCard);
      StagedFiles.add(newFolder);
  }; //Loop over folders, see how nested they are

};


/*===============================================================
If any files were uploaded successfully, loop over all the staged files and (excluding those that failed to upload) we locate the divs/columns which reference each given file (could be a video, image, audio etc.) and insert this new source data into the file card so the user can view the media content, as is now provided by the server.
===============================================================*/
async function createFileContent(res) {
  if (StagedFiles.count.length) {
    for (let file of StagedFiles.count) {

      if (res.data.type === 'warning' && res.data.items.includes(file.name)) /*---->*/ continue;
      //Then some items were not uploaded, do not unstage those or attempt to display their content

      else { //Then all items were successful, display all of them.
        StagedFiles.unlist(file);
        // -----------------------------------------------------------------------------
        if (file.path !== CurrentFolder)
          continue; //If the file was uploaded outside current directory, don't bother displaying it.
        // -----------------------------------------------------------------------------
        let fileCard = getFileCard(file) ? getFileCard(file) : $(makeFileCard(file));

        $(fileCard).removeClass('queued').addClass('uploaded'); //Turn it darkcyan instead of orange
        await createMedia(file, $(FolderInput).val(), fileCard)
        .then( source => insertFileCard(source, fileCard, file));
        // -----------------------------------------------------------------------------
        let newfile = {name: file.name, path: file.path, stats: {mode: file.mode || file.stats.mode || 33206}}

        if (Directory.packs) {
          let pack = Directory.packs;
          if (pack.last().length >= maxfiles) { //More than max files that can be displayed
            Directory.packs.push([newfile]); //Make a new pack
          } else Directory.packs.last().push(newfile); //Any new uploaded files go in last pack
        }
        if (Directory.files) {
          Directory.files.push(newfile);
          // Directory.files.length < maxfiles ? Directory.files.push(newfile) : divideDirectory(Directory);
        }
        AllFiles.add(newfile, true);
      }; //End of: If no failed files
  // -----------------------------------------------------------------------------
    }; //End of: For loop going over staged files
    Directory.packs ? findAllFiles(event, Directory.packs.length -1) : null;
  }
};


/* ----------------------------------------- */
$(form).submit( (event) => {
  event.preventDefault();
  event.stopPropagation();

  if ($(FolderInput).val() !== Directory.name
    && UserSession.preferences.outsideDir === false
    && document.URL.includes(Partition) && StagedFiles.count.length) {
//If target folder is not current directory, user has not set preference, and we are not on the homepage
      dialogPrompt({
        warning: `You are currently submitting all staged files to a folder (<span class="dimblue">${$(FolderInput).val()}</span>) outside this directory (<span class="dimblue">${Directory.name || CurrentFolder}</span>).`,
        responseType: 'confirm',
        proceedFunction: "submitFiles(event)",
        preference: 'outsideDir'
      });
  } else submitFiles(event);
}); //Whenever the user clicks Submit, attempt to upload files
/* ----------------------------------------- */
