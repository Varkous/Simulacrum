const messageTips = [
/* 0 */ {
      text: `Welcome to Simulacrum, a browser-based GUI file systems manager. You may search, view and interact with items from your private directory <span class="dimblue">${UserSession.user.name}</span>, or the public directory <span class="dimblue">${Partition}</span> from here<hr>
       Some rules of thumb: <br><span class="dimblue">1.</span> Do not upload any sensitive/confidential data that may expose your private info (like banking, home address, etc.)<br>
       <span class="dimblue">2.</span> If the items are only relevant to you, upload them to your private directory instead of the public one <br>
       <span class="dimblue">3.</span> Be reasonable. Avoid uploading 30-40 gigabyte programs, and if you have to upload massive files, please compress them to zip or rar file first.`,
      element: '.header',
    },
/* 1 */  {
    text: `The Navbar portal, which you may click to return home, or hover to view advanced controls for the page. You may also drag/readjust its position if needed.`,
    element: '#logoLink',
    otherElements: '.logo'
  },
/* 2 */  {
    text: `The Primary Directories list: These represent all top-level folders within the current home partition. They are meant to house more specific folders/sub-directories, and should be made as vague as possible.`,
    element: '#directoryList',
  },
/* 3 */  {
    text: `Select folders/files from your computer here to stage them for upload. You may also drag-and-drop items anywhere on the screen to upload.`,
    element: '#fileFolderInput',
    otherElements: '.folder-label, .file-label'
  },
/* 4 */  {
    text: `The folder designation input. Whatever you input here will be the destination of any uploads or transfers.`,
    element: '#folderInfo',
    otherElements: '#FolderInput'
  },
/* 5 */  {
    text: `The File Table. This houses any uploaded items within the current directory, (if on the homepage, it will list items that belong to you across all directories). You may view the video, audio, text or image content from the files themselves, and select, edit, transfer, download or delete them if you have permission.`,
    element: '#FileTable'
  },
/* 6 */  {
    text: `And finally the Overhead Panel. Pull this up to view a more condensed and bare-bones version of the current directory. This is recommended if using a mobile device, or browsing a large directory listing.`,
    element: '#panelHeader',
    otherElements: '#overheadPanel'
  }
];
if (mobile)
  messageTips[2].text += ' Tap them to view their properties, double-tap to visit them.'


/*===============================================================
  Called on page load and every time a file is submitted or deleted, to see if there are any files listed. If not, hide the panel header and buttons since they serve no purpose in an empty directory. If a directory becomes empty, we automatically delete and re-direct out.
===============================================================*/
async function checkForEmpty(canDelete, fileCard) {

  if (AllFiles.count.length || StagedFiles.count.length) {
    $(FileTable).children('p').text('');
    $('#panelHeader').show();
  } else {
    $(FileTable).children('p').text('No Files or Folders uploaded.');
    $('#panelHeader').hide();

      if (canDelete && $(fileCard).hasClass('queued') === false) {
        //If there was a delete request (not the usual page load check), and the recently deleted file card was not a staged file (the user may still want the folder).

        const link = document.createElement('a');
        const previousDirectory = document.URL.replace(Directory.layers.slice(-1), '');
        //The last element of 'Directory.layers' is always the current folder name

        $(link).attr('href', previousDirectory);
        if (Directory.layers.length < 2) /* Then --> */ link.href = window.location.origin;
        //Then only one layer is present, which de-facto means the "previous" directory is just the homepage, so redirect there

        $('.fs-modal-message').text(`Current folder ${CurrentFolder} being deleted, redirecting...`);
        $(FS_Modal).show();

        setTimeout( () => link.click(), 800);
      }
  //--------------------------------------------------------
  };
};


/*===============================================================
  This function is called when the user clicks the 'View' button above a text-File Card (which holds a <textarea>), or clicks 'View' within a Panel listing. Either one becomes the 'textcontent' which will be cloned and replicated onto the modal.
===============================================================*/
function viewTextInModal (textElement) {
  event.preventDefault();
  event.stopPropagation();

  $('.modal-image').attr('src', '/upload.gif');
  $('.fs-modal-message').text('').removeClass('view-text view-listing');
  let textcontent;

  if (textElement.tagName === 'OL') {
    //Then the element is actually an entire panel listing
    $('.modal-image').attr('src', '/listing.png');
    $('ol li').show();
    $('#overheadPanel').click();
    textcontent = textElement;
  } else {
    //Then it has to be a textarea element, likely from a textfile
    textcontent = $(textElement).find('textarea')[0] || $(textElement).find('object')[0];
    $('.fs-modal-message').text(textElement.id);
    $('.modal-image').attr('src', '/textdoc.png');
  }
    $(textcontent).clone().appendTo('.fs-modal-message').addClass('view-text view-listing').removeClass('hide').css('min-height', '600px');
    //We simply copy the textcontent onto the modal (and remove it later if the modal closes)

    $(FS_Modal).show();
};


/*===============================================================
  Called whenever the User clicks Delete or Delete All, prompting them and passing in their answer to verify if it was roughly a "Yes" answer.
===============================================================*/
function userConfirmation(userAnswer){

  const confirmations = ['Y', 'Yes', 'Yea', 'Ya', 'Yeah', 'Yup', 'Yep', 'Aye', 'Ye', 'Yay', 'Obviously', 'Of Course', '1', 'Do It', 'Delete', 'Go', 'Yes!', 'Ya!', 'Yo', 'Yea!', 'True'];
  for (let answer of confirmations)
    if (userAnswer == answer || userAnswer == answer.toLowerCase() || userAnswer == answer.toUpperCase() || userAnswer === true)
      return true;

  return false;
};


/*===============================================================
  Whenever the user prompts/hovers over one of the general Directories, populate the "showDirectoryStats" div with information. This is mostly for aesthetic purposes, but also so more active users can find and identify nested directories easier without having to vist each one.
===============================================================*/
function displayDirectoryStats (evt) {

  clearTimeout(window.getStats);
  clearTimeout(window.displayStats);

  if (evt.type === "mouseleave") return false;
  //This code above is to mitigate the process-intensive scenario of the user rapidly hovering over different directories successively (2% extra CPU power on average). Limit the wait-time to about 500 ms, as both Timeouts combine for that duration.

// ----------------------------------------------------------------
  window.getStats = setTimeout( () => {
    let i = parseInt(this.id.replace('directory', '')); //Every anchor/directory link we hover has a unique number in its ID, so we can get it by just removing 'directory' from the ID name. We'll use it as the index number for each directory's stats object (it goes from 0 > onwards...).

    let childFolderLinks = [];

    for (let subfolder of PrimaryDirectories[i].folders) /*Get all sub-directories of the directory that was hovered over */  childFolderLinks.push(`<a href="${this.href}/${subfolder}" style="margin-left: 7px;">${subfolder}</a>`)


  $(directoryStats).removeClass('fadein').addClass('fadeout');
// ----------------------------------------------------------------
    window.displayStats = setTimeout( () => {

      $(directoryStats).html(
       `<div class="d-flex" style="justify-content: space-between">
           <a href="/${Partition + PrimaryDirectories[i].name}">${PrimaryDirectories[i].name}</a>
           <i class="fa fa-times"></i>
         </div>
        <hr>
        <p>
          Created By: <span>${PrimaryDirectories[i].stats.creator}</span> <br>
          Creation Date: <span>${PrimaryDirectories[i].stats.ctime}</span> <br>
          Size: <span>${getFileSize(PrimaryDirectories[i].stats.size)}</span> <br>
          Files: <span style="color: darkcyan; max-width: 300px; word-wrap: break-word;">
          ${PrimaryDirectories[i].files.join('<span>,</span> ')}
          </span>
        </p>
        <hr>
        <span style="color: aliceblue;">
          Sub-folders: ${childFolderLinks}
        </span>`
      );
      $(directoryStats).removeClass('fadeout').addClass('fadein');

    }, 200); //------------Second timeout

  }, 300); //------------First timeout

};


/*===============================================================
  Loops through the arrays of displayable file formats/extensions, and verifies the supported formats. Triggered when source media is loaded from the server and attempting to be displayed.
===============================================================*/
function checkFileType(file, formats) {

	for (let format of formats)
		if (file && file.name.includes(format) === true || file && file.name.includes(format.toUpperCase()) === true) return true;

	return false;
};

/*===============================================================
  Triggered whenever the user either drags a selected file card over a folder card, or clicks the Transfer button in the Panel Overhead to move/copy any files currently Selected. Any affected File Cards are given aesthetic classes/animations for clairvoyance.
===============================================================*/
async function transferFiles (files, destinationFolder, copy) {

  if (!files) return Flash('Not a valid file', 'error');

    const data = {
      files: files,
      destinationFolder: destinationFolder,
      mydirectory: $('#mydirCheck').is(':checked'),
      transfer: true, //Lets fs on back-end know the files being handled are to be transferred
      copy: copy, //Lets fs on back-end know the files being transferred should be copied
      preferences: JSON.stringify(UserSession.preferences)
    }

  $(FS_Modal).show();
  $('.fs-modal-message').text('Files being transferred...');

  return await axios.post(`/${Partition + destinationFolder}`, data)
  .then( async (res) => {
    Flash(res.data.content, res.data.type, res.data.items);

    if (res.data.type === 'error' || res.data.items.includes('/') && res.data.items.length < 2)
      //If the items have a "/" in them and there is only one item within, it means it was a directory created pre-transfer
      SelectedFiles.unlist(files);

    else {
      for (let i = 0; i < res.data.items.length; i++) {
        if (copy === false) {
        //If not copied, we don't want the file (i.e File Card) on the page as it is not within the current folder anymore obviously

        transfer = {name: res.data.items[i], path: res.data.paths[i]};

          if (CurrentFolder) {
            //If we are in a directory.
            let fileCard = getFileCard(transfer);
            !mobile ? $(fileCard).draggable( 'option', 'revert', false ) : null;
            $(fileCard).addClass('fadeout');
            AllFiles.delete(transfer, true);
          } else await setTimeout( () => findAllFiles(), 100); //Otherwise we're at the homepage, and transfers should not signal the deletion of anything, and should just adjust paths

        } //End of If Copy
        SelectedFiles.unlist();

      }; //End of: For Loop
    }; //If no errors
    checkForEmpty();
  })
  .catch( (error) => {
    Flash(error.message, 'error');
    throw error;
    return false;
  });
};


/*===============================================================
  Uses "transferFiles" to do the actual transfer, but this is only called when the user click the "Transfer" button and uses moves/copies the Selected Files. If there are no selected files or target folder specified, return error.
===============================================================*/
async function transferMultiple (evt) {
  evt.preventDefault();
  evt.stopPropagation();

  if (!SelectedFiles.count.length && event.shiftKey) //Then user wishes to select everything
    await selectAll(Directory.files, true);
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

  await transferFiles(SelectedFiles.count, FolderInput[0].value, mobile ? true : evt.ctrlKey);  //Every file uploaded -- Regardless of being in a Directory or on Main Page -- Will have a folder path attatched to it, and that's all we need back-end to acquire folder's current location.
};


/*===============================================================
  Activates when the user session has precautionary preferences set, and they make a request which sets it off (i.e, deleting or uploading large amount of files).
  With the object variables passed in, the function creates the dialog box, shows it to user, and blocks all actions until they click one of the two buttons (which equate to True or False).
===============================================================*/
async function dialogPrompt (operation) {
  const {
    warning, //  A warning message.
    responseType, // A type of response allowed to the user.
    proceedFunction, // The function that will execute on "Yes" or "Okay".
    preference, // The User Session preference that allowed this warning to occur.
    storageType // The genre of files the user is dealing with (staged, transferring, deleting).
  } = operation;

  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  //This box is created only for the intermission period before a request of some sort is executed. When either button is clicked, this element is destroyed by 'clearDialog'
  $('.dialog-box').html(`
  <p>${warning}</p>
  <button class="my-button light" type="button" onclick="${proceedFunction}"></button>
  <button class="my-button light" type="button" onclick="clearDialog('${storageType}')"></button>
  <hr>
  <div id="prefInput" style="font-family: Courier New; font-size: 1.0rem;">
    <label></label>
    <input id="${preference}" class="checkbox" type="checkbox">
  </div>
  `);

  let pref = $('.dialog-box').find('input')[0] || null;
  if (pref && pref.id !== 'none') {
    pref.checked = UserSession.preferences[`${pref.id}`];
    //Whatever the original preference was (true or false), set the checkbox condition equal to the same value
    if (pref.checked) $('#prefInput').children('label').text("Show this message again?");
    //If checked (TRUE), checkbox is filled showing the message again is encouraged
    else $('#prefInput').children('label').text("Don't remind me");
    //If unchecked (FALSE), checkbox is un-filled with option to choose no more reminders
  }

  $('.dialog-cover').show();

  if (responseType === 'boolean') {
    $('.dialog-box').children('button')[0].innerText = 'Yes';
    $('.dialog-box').children('button')[1].innerText = 'No';
  }
  // --------------------------------------------------------
  else if (responseType === 'confirm') {
    $('.dialog-box').children('button')[0].innerText = 'Okay';
    $('.dialog-box').children('button')[1].innerText = 'Cancel';
  }
};


/*===============================================================
  Manipulates a preference according to the checkbox (the only input within the dialog box), and then removes all dialog elements.
===============================================================*/
function clearDialog(fileStorage) {
  $('.steady-glow').removeClass('steady-glow');

  if (fileStorage) {
    Outbound[`${fileStorage}`] = [];
    Outbound.size = 0;
  }

  let pref = $('.dialog-box').find('input')[0] || null;
  if (pref)
    UserSession.preferences[`${pref.id}`] = $(pref).is(':checked');

  $('.dialog-cover').hide();
  $('.dialog-box').empty();
};


/*===============================================================
  Clears the modal, checks if user is viewing panel listing, and removes the text if the modal is being used to view a text file.
===============================================================*/
function closeModal() {

  if (!event)
    return false;

  if ($(event.target).hasClass('closemodal') || $(event.target).hasClass('modal') || event.keyCode === 27) {
      $('.fs-modal-message').text('').removeClass('view-text');
      //Clear any previous text content, else it stacks up
      $('.modal-image').attr('src', '/upload.gif');
      return $('.modal').hide();
  }
};


/*===============================================================
  General purpose function for hiding/displaying an element that is passed in depending on its current visibility state.
===============================================================*/
function hideOrShow(element) {
  if ($(element).is(':visible')) {
    $(element).hide();
  } else $(element).show();
};


/*===============================================================
  Called only once for a first-time user visit to homepage. Takes an index, finds the appropriate message with that index, and prompts the message before positioning it alongside a given element on the page, highlighting it (see messageTips array for details).
===============================================================*/
async function introductionTips(index) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  let target = messageTips[index];

  $('.steady-glow').removeClass('steady-glow');
  $('.high-index').removeClass('high-index');
  // 'high-index' class puts elements in "front" and ensures they're visible. We remove this privilege from any previous elements
  $('.message-tip').remove(); //Else it remains on page ever after

// =========================================================
  if (index !== false && index < messageTips.length) {
    //Remember arrays: The index number within starts from 0. So if 'index' passed in equals array LENGTH, then it does not exist.

    $('body').children('*').addClass('invisible');
    //All core elements should be invisible

    for (let i = 0; i < messageTips.length; i++ ) {
      if (i < index)
        $(messageTips[i].element).addClass('high-index').removeClass('invisible hide');
      // This finds all previous elements that were "introduced" (aside from the very first, which is <main> itself) and ensures they remain visible.
    };
    $(target.element).addClass('steady-glow high-index').show().removeClass('invisible hide').prepend(`
    <div class="message-tip">
      <p>${target.text}</p>
      <button class="my-button dark" style="color: #22a0f4" type="button" onclick="introductionTips(${index + 1})">Next</button>
      <button class="my-button dark" style="color: rgb(44, 166, 211)" type="button" onclick="introductionTips(${false})">Forget It</button>
    </div>`);
    $(target.otherElements).addClass('steady-glow high-index');
    // This stuff above creates the introduction messaage for target element and highlights it, makes it top-level z-index, and also highlights any related elements the message tip wants to reference

    $('html')[0].scrollTo({
      top: $(target.element).position().top - 80,
      behavior: 'smooth'
    });
    //After all content established, scroll to it on the page
  // =========================================================
  } else {
    $('svg, .header > h1').show();
    $('*').removeClass('invisible high-index');
    await populateDirectory();
    $('main').css('transition', 'all 0.7s ease-in-out');
  }
//If no more message tips are left to introduce, reveal everything on the page, remove the high index shenanigans, and allow them to be interacted with normally (mouse events)
};
