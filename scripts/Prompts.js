'use strict';
const messageTips = [
/* 0 */ {
    text: `Welcome to Simulacrum, a browser-based GUI file systems manager. You may search, view and interact with items from your private directory <span class="dimblue">${Username}</span>, or the public directory <span class="dimblue">${Partition}</span> from here<hr>
     Some rules of thumb: <br><span class="dimblue">1.</span> Do not upload any sensitive/confidential data that may expose your private info (like banking, home address, etc.)<br>
     <span class="dimblue">2.</span> If the items are only relevant to you, upload them to your private directory instead of the public one <br>
     <span class="dimblue">3.</span> Be reasonable. Avoid uploading 30-40 gigabyte programs and such, and if you have to upload massive files, please compress them to zip or rar file first.`,
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
    text: `The File Table. This houses any uploaded items within the current directory. You may view the video, audio, text or image content from the files themselves, and select, edit, transfer, download or delete them if you have permission. Hover or select items for manipulation options.`,
    element: '#FileTable'
  },
/* 6 */  {
    text: `And finally the Overhead Panel. Pull this up to view a more condensed and bare-bones version of the current directory. This is recommended if using a mobile device, or browsing a large directory listing.`,
    element: '#panelHeader',
    otherElements: '#overheadPanel'
  }
];
if (mobile)
  messageTips[2].text += ' Tap them to view their properties, where you may access their links.'


/*===============================================================
  Called only once for a first-time user visit to homepage. Takes an index, finds the appropriate message with that index, and prompts the message before positioning it alongside a given element on the page, highlighting it (see messageTips array for details).
===============================================================*/
async function introductionTips(index) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  let message = messageTips[index];

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
    $(message.element).addClass('steady-glow high-index').show().removeClass('invisible hide').prepend(`
    <div class="message-tip">
      <p>${message.text}</p>
      <button class="my-button dark dimblue" style="color: #22a0f4" type="button" onclick="introductionTips(${index + 1})">Next</button>
      <button class="my-button dark" type="button" onclick="introductionTips(${false})">Forget It</button>
    </div>`);
    $(message.otherElements).addClass('steady-glow high-index');
    // This stuff above creates the introduction messaage for message element and highlights it, makes it top-level z-index, and also highlights any related elements the message tip wants to reference

    $('html')[0].scrollTo({
      top: $(message.element).position().top - 80,
      behavior: 'smooth'
    });
    //After all content established, scroll to it on the page
  // =========================================================
  } else {
    $('.header > h1').show();
    $('*').removeClass('invisible high-index');
    setupDirectory();
    $('main').css('transition', 'all 0.7s ease-in-out');
    //So it fades out like normal
  }
//If no more message tips are left to introduce, reveal everything on the page, remove the high index shenanigans, and allow them to be interacted with normally (mouse events)
};


/*===============================================================
  Whenever the user prompts/hovers over one of the general Directories, populate the "showDirectoryStats" div with information. This is mostly for aesthetic purposes, but also so more active users can find and identify nested directories easier without having to vist each one.
===============================================================*/
function displayDirectoryStats (evt) {

  clearTimeout(window.getStats);
  clearTimeout(window.displayStats);

  if (evt.type === 'mouseleave') return false;
  //This code above is to mitigate the process-intensive scenario of the user rapidly hovering over different directories successively (2% extra CPU power on average). Limit the wait-time to about 500 ms, as both Timeouts combine for that duration.

// ----------------------------------------------------------------
  window.getStats = setTimeout( () => {
    let i = parseInt(this.id.replace('directory', '')); //Every anchor/directory link we hover has a unique number in its ID, so we can get it by just removing 'directory' from the ID name. We'll use it as the index number for each directory's stats object (it goes from 0 > onwards...).

    let childFolderLinks = [];

    for (let subfolder of PrimaryDirectories[i].folders) /*Get all sub-directories of the directory that was hovered over */
      childFolderLinks.push(`<a href="${this.href}/${subfolder}" style="margin-left: 7px;">${subfolder}</a>`)

    $(directoryStats).removeClass('fadein').addClass('fadeout');
// ----------------------------------------------------------------
    window.displayStats = setTimeout( () => {

	  let dir = PrimaryDirectories[i];
      $(directoryStats).html(
       `<div class="d-flex" style="justify-content: space-between">
           <a href="/${Private ? Partition + `${Username}/${dir.name}` : Partition + dir.name}" style="font-size: 1.4rem; margin: auto;">${dir.name}</a>
           <i class="fa fa-times"></i>
         </div>
        <hr>
        <p>
          Created By: <span>${dir.stats.creator || 'admin'}</span> <br>
          Creation Date: <span>${new Date(PrimaryDirectories[0].stats.birthtimeMs).toLocaleString()}</span> <br>
          Size: <span>${getFileSize(dir.stats.size)}</span> <br>
          Files: <span style="color: white; max-width: 300px; word-wrap: break-word;">
          <span class="dir-stat-file">${dir.files.join('</span><br><span class="dir-stat-file">')}
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
  Called on upload, download, deletion or transfer requests, where the modal is displayed and progress bar tracks it.
===============================================================*/
function showOperation (op, operands = []) {
 try {
  const inEffect = []

  if ($('.progress')[0] && $('.progress').hasClass(op)) {
    Flash(`<span class="green">${op}</span> operation already in effect. Reload directory to cancel it`, 'error');
    return false;
  }
  if (operands) {
    for (let file of operands)
      if (pathfinder(SelectedFiles.count, 'find', file) && pathfinder(SelectedFiles.count, 'find', file).status)
        inEffect.push(file.name);

    if (inEffect.length) {
      Flash(['Halted. Targeted files: ', 'Are currently under effect of another operation, please wait'], 'warning', inEffect);
      return false;
    }
    operands.forEach( async (file, i, arr) => pathfinder(SelectedFiles.count, 'find', file) ? pathfinder(SelectedFiles.count, 'find', file).status = op : false);
  }
// ----------------------------------------------------------------
  $(FS_Modal).show();
  let progressElements = $('.fixed').find('.progress').length;
  let gerund = op;

  let newProgress = `<progress class="progress ${op}" value="0" max="100" height=30></progress>`;

  $('.operation-status').prepend(newProgress);
    if (op === 'Delete') gerund = 'Delet'
    if (op === 'Transfer') gerund = op + 'r'
    //Good grammar is some priority right?
   $('.fs-modal-message').append(newProgress + `<div class="${op}"><br>${gerund}ing files...<hr></div>`);
   $(`.progress.${op}`).attr('data-before', op);
   return true;
 } catch (err) {console.log(err) };
};


/*=====================================
==========================
  Activates when the user session has precautionary preferences set, and they make a request which sets it off (i.e, deleting or uploading large amount of files).
  With the object variables passed in, the function creates the dialog box, shows it to user, and blocks all actions until they click one of the two buttons (which equate to True or False).
===============================================================*/
function dialogPrompt (operation) {
  document.body.style.overflow = 'hidden';
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
  //This box is created only for the intermission period before a request of some sort is executed. When either button is clicked, this element SHOULD be destroyed by 'clearDialog' afterward
  $('.dialog-box').html(`
  <p>${warning}</p>
  <button id="confirm" class="my-button light" type="button" onclick="${proceedFunction}"></button>
  <button id="cancel" class="my-button light" type="button" onclick="clearDialog('${storageType}')"></button>
  <hr>
  <div id="prefInput" style="font-family: Courier New; font-size: 1.0rem;">
    <label></label>
  </div>
  `);

	if (preference) {
	  $('#prefInput').append(`<input id="${preference}" class="checkbox" type="checkbox">`);
	  let pref = $('.dialog-box').find('input')[0] || null;
	  if (pref && pref.id !== 'none') {
	    pref.checked = UserSession.preferences[`${pref.id}`];
	    //Whatever the original preference was (true or false), set the checkbox condition equal to the same value
	    if (pref.checked) $('#prefInput').children('label').text("Show this message again?");
	    //If checked (TRUE), checkbox is filled showing the message again is encouraged
	    else $('#prefInput').children('label').text("Don't remind me");
	    //If unchecked (FALSE), checkbox is un-filled with option to choose no more reminders
	  }
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


/* ----------------------------------------- */
$('#fileFolderInput').submit( (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (StagedFiles.count.length) {
	const uploadSize = StagedFiles.count.length > 1 ? StagedFiles.count.reduce(accumulateSize) : StagedFiles.count[0].size;
    if ($(FolderInput).val() !== Directory.name && UserSession.preferences.outsideDir === false && document.URL.includes(Partition)) {
      //If target folder is not current directory, user has not set preference, and we are not on the homepage
        dialogPrompt({
          warning: `You are currently submitting all staged files to a folder (<span class="dimblue">${$(FolderInput).val()}</span>) outside this directory (<span class="dimblue">${Directory.name || CurrentFolder}</span>).`,
          responseType: 'confirm',
          proceedFunction: "submitFiles(event)",
          preference: 'outsideDir'
        });
    } else if (Private && (uploadSize + totalsize) > UserSession.maxsize)
        return Flash(['Upload would exceed maximum capacity of your private folder:', 'Remove files to free up space'], 'error', getFileSize(UserSession.maxsize)); //Guest has file size limit, verify it does not exceed max
    else submitFiles(event);
  } else submitFiles(event);
}); //Whenever the user clicks Submit, attempt to upload files
/* ----------------------------------------- */


/*===============================================================
  Determines if user wants to delete selected files, or all of them (if shift key pressed). Calculates size and sends warning for user to confirm deletion.
===============================================================*/
function verifyDeletion() {
 try {
  const targetFiles = event.shiftKey && !SelectedFiles.count.length ? AllFiles.count : SelectedFiles.count;

  if (!targetFiles.length)
    return Flash('No files selected for deletion', 'warning');

  let size = 0;
  for (let file of targetFiles) {
    if (size >= 50000000) { // No need to keep counting if already past warning threshold
      break;
    } else if (pathfinder(StagedFiles.count, 'find', file)) continue;
    else size += parseInt(file.size);
  };

  if (UserSession.preferences.deleteCheck && size >= 50000000) {
    // If size is more than 50 MBs send a warning before deletion
    dialogPrompt({
      warning: `Delete <span class="dimblue">${targetFiles.length}</span> files (<span class="dimblue">${getFileSize(size)}</span>)? This cannot be undone. (All staged files will be removed as well)`,
      responseType: 'boolean',
      proceedFunction: `deleteMultiple('${targetFiles === AllFiles.count ? 'ALL' : false}')`,
      preference: 'deleteCheck'
    });

  } else deleteMultiple();
} catch (err) {
   console.log(err);
 }
};
