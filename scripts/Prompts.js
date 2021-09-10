'use strict';
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
  messageTips[2].text += ' Tap them to view their properties, double-tap to visit them.'


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
  Called on upload, download, deletion or transfer requests, where the modal is displayed and progress bar tracks it.
===============================================================*/
function showOperation (op) {
  $(FS_Modal).show();
  $(FS_Modal).find('.progress').remove();
  $('.progress-op').text(op);
  $('.progress').clone().insertAfter('.fs-modal-message');
    if (op === 'Delete') op = 'Delet'
    if (op === 'Transfer') op = op + 'r'
    //Good grammar is some priority right?
  $('.fs-modal-message').text(`${op}ing files...`);
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
  //This box is created only for the intermission period before a request of some sort is executed. When either button is clicked, this element is destroyed by 'clearDialog' afterward
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
  Any time file-icon is clicked, its parent will always be uploaded file card or LI. Find the given directory file with the name and path of that element, collect its essential stats, and place those into hover-display element for user
===============================================================*/
function showFileInfo (evt) {

  $('.file-info').remove(); //Remove any previous displays

  let fileRef = $(this).parents('.uploaded')[0] // <LI> or File Card
  let file = {
    name: fileRef.id || fileRef.title,
    path: $(fileRef).attr('path')
  } //Name and path attribute is all we need
  let filedata = pathfinder(Directory.files, 'find', file).stats;
  let creationDate = new Date(filedata.birthtimeMs);

  file.date = creationDate.toLocaleDateString();
  file.creator = filedata.creator;
  file.size = getFileSize(filedata.size);

  $(fileRef).append(`
    <ul class="folder-children fadein file-info" style="background: black; padding: 3px;">
    <span>Path: </span>${file.path}<br>
    <span>Size: </span>${file.size}<br>
    <span>Created By: </span>${file.creator}<br>
    <span>Uploaded: </span>${file.date}<br>
    </ul>
  `);
};
