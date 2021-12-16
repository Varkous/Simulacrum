'use strict';

const {pathfinder, namefinder, getFileSize, checkModeType, parseHTML, accumulateSize} = helpers;
const allExtensions =  [
  '.bat','.apk','.com','.jpg','.jpeg','.exe','.doc','.docx','.docm','.rpp','.html','.z','.pkg','.jar','.py','.aif','.cda','.iff','.mid','.mp3','.flac','.wav','.wpl','.avi','.flv','.h264','.m4v','.mkv','.mov','.mp4','.mpg','.rm','.swf','.vob','.wmv','.3g2','.3gp','.doc','.odt','.msg','.pdf','.tex','.txt','.wpd','.ods','.xlr','.xls','.xls','.key','.odp','.pps','.ppt','.pptx','.accdb','.csv','.dat','.db','.log','.mdbdatabase','.pdb','.sql','.tar','.bak','.cabile','.cfg','.cpl','.cur','.dll','.dmp','.drve','.icns','.ico','.inile','.ini','.info','.lnk','.msi','.sys','.tmp','.cer','.ogg','.cfm','.cgi','.css','.htm','.js','.jsp','.part','.odb','.php','.rss','.xhtml','.ai','.bmp','.gif','.jpeg','.max','.obj','.png','.ps','.psd','.svg','.tif','.3ds','.3dm','.cpp','.h','.c','.C','.cs','.zip','.rar','.7z'
];
let alphabet = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz'.split('');
// -------------------------------------------------------
const imageFormats = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.ico', '.svg'];
const audioFormats = ['.mp3', '.wav', '.ogg', '.flac'];
const videoFormats = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv'];
const imageDocFormats = ['.pdf'];
const textDocFormats = ['.txt', '.cfg', '.rtf', '.ini', '.info'];
const compressedFormats = ['.7z', '.zip', '.rar', '.z', '.pkg', '.tar'];
// ----------------------------------------------------------------------
const Outbound = {size: 0, staged: [], transfers: [], delete: [], selected: []}; //This is an "intermission" variable that temporarily holds any submission content during a dialog prompt. If the user confirms, the data is retrieved from here and sent on request. If rejected, it is flushed.
const home = window.location.origin;
const maxfiles = mobile ? 100 : 500;
let redirect = false; //If false, this will "traverse" the directories and integrate/replace the page with their contents, by adding a query string onto the url. If true, the entire page will redirect and repopulate the page with new directory contents. Slower this way, but often less error prone and sometimes inevitable.
let firefox;
if (document.URL.includes(UserSession.home)) {
  redirect = true;
}
// -------------------------------------------------------
if (redirect && UserSession.preferences.smoothTransition) {
  let prevDir = document.referrer.replace(home, '').split('/').filter(Boolean).length;
  let nextDir = document.URL.replace(home, '').split('/').filter(Boolean).length;
  //Aesthetic purposes only. Checks how many 'folders in' a directory we are, to determine where main body will transition into screen (either from below, from the left, or from the right)
  if (prevDir < nextDir) $('main').css('transform', 'translateX(100%)');
  else if (prevDir > nextDir) $('main').css('transform', 'translateX(-100%)');
  else $('main').css('transform', 'translateY(100%)');
}
if (oversize) {
  $('#transferBtn').attr('disabled', true).hide();
  $('#submit').attr('disabled', true).hide();
  $('.file-label').css('background-image', 'linear-gradient( gray, black)');
  $('.file-input').attr('disabled', true);
}


/*========================================================*/
//Very crucial component. This is what updates file table and panel listing real-time to mimic the back-end file storage of the given directory. This adjusts list elements, file card elements, Directory.files object, and the count numbers within the button actions on basically every single user operation (selecting, renaming, transferring, deleting, and uploading)
/*========================================================*/
class File_Status_Adjuster {
  constructor(status, listings, count = []) {
    this.status = status;
    this.listings = listings;
    this.tag = '.' + $(this.listings).attr('class');
    this.count = count;
  } //End of Constructor

  /*========================================================*/
  //Adding is simply creating a list item of the given type (uploaded, staged, selected), adding an uploaded file requires a whole extra block of code since it has raw data references, staged/selected are just naming references
  /*========================================================*/
  async add(files, folder) {
   try {
    if (!Array.isArray(files))
      files = [files];

    for (let file of files) {

      if (this.count.includes(file))
        continue; //Then the file is already added/selected, no need

      this.count.push(file);
      const {name, path} = file;

      $(`[title="${name}"][path="${path}"]`).addClass(this.status);
      $(this.listings).append(`<li title="${name}" path="${path}" size="${file && file.stats ? file.stats.size : file.size || 0}" class="${this.status}"><span>${name}</span></li>`);

      let fileCard = getFileCard(file);
      $(fileCard).addClass(this.status);

      /*----- If folder argument is present, it means AllFiles is adding, thus a more sophisticated list item is needed. This below is not used by Staged or Selected Files-----------*/
      if (folder) {
        //This alone does not mean the "file" is a folder, it means it has a folder path.
    /*--------------------------------*/

        if (checkModeType(file.mode || file.stats.mode) === 'folder') {
          $(fileCard).removeClass(this.status);
          $(this.listings).children(`[title="${name}"][path="${path}"]`).html(`
          <i class="fa fa-folder" style="left: -40"></i>
          <a title="${path}/${name}" href="/${Partition + path}/${name}">${name}</a>
          <i onclick="makeEdit(this, $(this).prev('a')[0])" class="fa fa-edit hide"></i>`);
    /*--------------------------------*/
        } else {
          //Then it's a file
          $(this.listings).children(`[title="${name}"][path="${path}"]`).html(`
          <i class="fa fa-file-text" style="left: -40"></i>
          <a title="${path}/${name}" href="/${path}/${name}" download="${name}" class="darkcyan">${name}</a>
          <i onclick="makeEdit(this, $(this).prev('a')[0])" class="fa fa-edit hide"></i>`
          );
        }
    /*--------------------------------*/
      };
      $('.selected-count').text(`(${SelectedFiles.count.length})`);
      $('.staged-count').text(`(${StagedFiles.count.length})`);
      Directory.files ? $('.all-count').text(`${Directory.files.length || 0}`) : null;
    }; //End of For Loop
   } catch (err) { console.log(err)}
  }; //End of ADD function


  /*========================================================*/
  //Removes any stored file names, removes any list items with that file name AND path from Panel Header, and removes the associated class (.uploaded or .queued or .selected) from the file card with the same file name (also remove class from the other File Tracker list items, for SelectedFiles use only).
  /*========================================================*/
  async unlist(files, nodisplay) {
   try {

    !files ? files = this.count : files = files; //If no argument passed in, assume all items
    if (!Array.isArray(files))
      files = [files];

    for (let file of files) {

      let unselected = pathfinder(this.count, 'find', file);
      this.count = this.count.filter((listfile) => listfile !== unselected);
      //Very annoying, but this proved to be the most accurate retriever of the EXACT file (name and path) that was unselected.

      let fileCard = getFileCard(file);
      nodisplay ? $(fileCard).remove() : $(fileCard).removeClass(this.status);

      $(`[title="${file.name}"][path="${file.path}"]`).removeClass(this.status);
      //Any files that are "selected" will have their selected status removed
      $(this.tag).children(`[title="${file.name}"][path="${file.path}"]`).remove();
      //We remove all listings under the tag name rather than 'this.listings', as user may be editing it within modal viewport

    };

	$('.file-input').val('');
    $('.selected-count').text(`(${SelectedFiles.count.length})`);
    $('.staged-count').text(`(${StagedFiles.count.length})`);
   } catch (err) { console.log(err)}
  };
  /*========================================================*/
  /*========================================================*/
} //End of Class


/*========================================================*/
//Extension of File_Status_Adjuster, this is only used by 'AllFiles', since it pertains to actual file manipulation operations rather than just aesthetic updating, thus it is even more crucial to the page. This handles deletion and renaming
/*========================================================*/
class Uploaded_Status_Adjuster extends File_Status_Adjuster {
  constructor(status, listings, count = []) {
    super(status, listings, count);
  }

  /*========================================================*/
  //This actually removes the content (File card), and 'reallyDelete' means it was removed from back-end, so all references should be terminated.
  /*========================================================*/
  async delete(files, reallyDelete) {
   try {

    if (!Array.isArray(files))
      files = [files];

      files.map ( async (file) => {
        this.unlist(file);
        let fileCard = getFileCard(file);
        fileCard ? $(fileCard).remove() : null;

        if (reallyDelete === true) {
          //If true. We actually remove the file from the directory listing altogether, as this means the user wanted it deleted from the database, not just the page.
          let fileToDelete = pathfinder(Directory.files, 'find', file);
          fileToDelete ? Directory.files.splice(Directory.files.indexOf(fileToDelete), 1) : null;

          StagedFiles.unlist(file);
          SelectedFiles.unlist(file);
          $('.all-count').text(Directory.files ? Directory.files.length : 0);
        }
        if (StagedFiles.count.length < 1) FolderInput.disabled = false;
        return true;
      });
  	} catch (err) { console.log(err)}
  };


  /*========================================================*/
  //Ultimately faster than doing another post request and deleting and replacing the file data reference. We instead find all references to the given name that was changed (lists, anchors, h1s, etc.) and adjust them
  /*========================================================*/
  rename (file) {
    try {

      // --------- Renaming all references on the file card
      let invalidChars = ['/', '\\', '?', '*', ':', '<', '>'];
      if (checkFileType(file, invalidChars))
        return Flash('Invalid characters within', 'error', file.old);

      let regExp = new RegExp(`${file.old.getSpaceChars()}*$`);
      //This Regex Expression, when applied to a string, finds the LAST occurence of the given value ('file.old', with space characters restored). This is necessary because in rare cases, a path might have duplicates of the same name, and the last one will always be the given item we're renaming

      let fileCard = getFileCard(file);
      $(fileCard).attr('id', file.new);

      let anchor = $(fileCard).find('a')[0]; //Download link of file card
      anchor.href === anchor.href.getSpaceChars().replace(regExp, file.new);
      anchor.download === anchor.download.getSpaceChars().replace(regExp, file.new);

      // --------- Now the li ref, just the title, no big deal
      $(`[title="${file.old}"][path="${file.path}"]`).attr('title', file.new);

      // --------- Big one, all anchor tag references, need to be adjusted for sure, these arbitrarily have a title with the path/name combined, so that every single anchor tag doesn't have to use a "path" attribute
      let nameRefs = $(`[title="${file.path}/${file.old}"]`).toArray();

      for (let ref of nameRefs) {
        ref.title = `${file.path}/${file.new}`;
        if (ref.innerText.includes(file.old)) ref.innerText = file.new;
        if (ref.href) {
          ref.download ? ref.download = ref.download.getSpaceChars().replace(regExp, file.new) : ''
          ref.href = ref.href.getSpaceChars().replace(regExp, file.new);
          ref.title.replace(regExp, file.new);
        }
      }; //End of loop

      pathfinder(this.count, 'find', file).name = file.new;

    } catch (err) {
      console.log(err)
      Flash(['Rename error occured with', 'Reload directory to avoid pathing error'], 'error', [file.name]);
    }
  };
//---------------------------------------------------------------
}; //End of Class


/*===============================================================
  Projects a nice little fadein/fadeout message box proceeding any interaction with the back-end. 'content' is the message itself, 'type' is either success/warning/error (green/yellow/red respectively), and 'items' are optional additions to emphasize the data of the message content (i.e file names, folder names etc.).
===============================================================*/
function createReport(content = 'Report could not be retrieved', type = 'warning', items, excess) {
 return new Promise ( async (resolve, reject) => {
  excess === 'dragwarning' ? UserSession.preferences.folderWarning = false : null; //Ignore this, just doesn't matter

  if (content === '<' && type === '!') { //Then happens if operation was successful but back-end still threw an error (in this case, it would return the error page which begins with <!DOCTYPE html>), so we adjust the message
    content = 'Report error. Reload directory';
    type = 'error';
    items = [];
  }

  setTimeout( () => $('.closemodal').click(), 500);
  // CSSVariables.setProperty('--operation', ''); //And remove progress bar operation name
  if (typeof (content) === 'string') content = [content];
  if (typeof (items) === 'string') items = [items];
  //Turn into array so we don't have to stir in more conditional code below

// --------------------------------------------- Now this bit here is key. The first string of the 'content' element will be first, THEN any 'items', then the second/last element of 'content'. This creates enough flexibility to craft messages that are cohearent to the user
    let h1 = content ? `
    <h1>${content[0]}
    <span><br>${items ? items.join('<br>') || items : '' }</span>
    <br>
    ${content[1] || ''}
    </h1>` : 'Report could not be retrieved'; // Replace the element ',' with a new line

    $(MessageLog).removeClass('success-box warning-box error-box fadeout hide')
    .addClass(`${type + '-box'}`).html(h1);
    //The "type" is always either: 'success', 'warning', or 'error'. We want any previous message type reset.
    await dismissElement('#MessageLog', 'Y', 'up', '40%'); //Bring back into view (not really dismissing it)


    if (UserSession.user.log && UserSession.user.log.length) { // User Log will contain all previous messages
      $('#logDisplay').val('');
      for (let i = 0; i < UserSession.user.log.length; i++)
        $('#logDisplay')[0].value += `${i}: ${parseHTML(UserSession.user.log[i])}\n`;
      //Just listing log entry with number, and adding new line
    }
    return setTimeout( () => { //The message display duration will always be at least 5 seconds, but increased based on the length of the message
     dismissElement('#MessageLog', 'Y', 'up', '100%', 300, true);
     $('#MessageLog').find('h1').addClass('fadeout');
     return resolve();
   }, 5000 + (h1.length * 25));
 });
};


/*===============================================================
  Read above function. This binds the message to a global timer using window.messageLog, forcing other Flash messages to wait their turn.
===============================================================*/
async function Flash(content, type = 'warning', items, excess) {
  closeModal(true);
  //return window.messageLog ? window.messageLog.then( async () => window.messageLog = createReport(...arguments)) : window.messageLog = createReport(...arguments);
  return window.messageLog = createReport(...arguments);
};


/*===============================================================
  Slides navbar over or away upon hovering/touching logo.
===============================================================*/
function showNavbar (evt) { //Displays Navbar and adds nice lighting effect

  if (evt.type === 'mouseleave')
    return $('main, nav, #FileTable').removeClass('glow-right shift-over');

  $('main').addClass('glow-right');
  $(FileTable).addClass('glow-right');
  $('nav').addClass('shift-over');
};


/*===============================================================
  Triggered when the user clicks either Download or Download All. It sends a post request to /zip/<folder name> which creates a zip, finds every file within the given folder name requested, packages them INTO the zip, before returning it as a download response back to the user.
===============================================================*/
async function downloadFiles (fileCard) {

  if (SelectedFiles.count.length < 1 && event.shiftKey === false && !fileCard)
    return Flash('No files selected for download', 'warning');

  let operation = 'Download';
  let data = {};

  if (SelectedFiles.count.length && event.shiftKey === false) { //Some but not all
    data.files = SelectedFiles.count || [];
  } else if (event.shiftKey) data.files = AllFiles.count.filter( file => delete(file.stats)); //All items. Without stats, don't need to crowd up req body
  else data.files = {name: fileCard.id || fileCard.title, path: $(fileCard).attr('path')}; //Single item

  if (!showOperation(operation || '', data.files))
    return false;

// ---------------------------------------------------------------------------------
if (mobile) {
  //If using mobile device
  await activateDownloads(false, operation, data);
} else await axios({
    method: 'post',
    url: `/download`,
    data: data,
    headers: {
      operation: operation,
    },
    cancelToken: new CancelToken( (c) => Requests.Download = c),
    onDownloadProgress: progressEvent => {
      let approximateLength = progressEvent.srcElement.getResponseHeader('Bullshit'); //On downloading zip, archive size cannot be determined accurately, thus had to conceieve a bullshit fake "content-length" header based on collective pre-zip file size for approximation
      let percentCompleted = (progressEvent.loaded / approximateLength) * 100;
      percentCompleted !== Infinity ? $(`.progress.${operation}`).val(`${percentCompleted}`) : $(`.progress.${operation}`).val(0);
    },
    responseType: 'blob', //Receiving zip file, which qualifies as arraybuffer or blob
  }).then( (res) => activateDownloads(res, operation, data))
  .catch( (error) => {
     if (axios.isCancel(error))
       Flash(operation + ' aborted', 'warning');
	 else Flash([error.message], 'error');
      return false;
  });
};


/*===============================================================
  Called upon when download request is returned. Takes the response and creates object URLs out of the blob data received (if successful), if desktop: It will be a zip. If on mobile, don't even do a request, and instead use 'data'
  which references file names and download them individually from server. If response is an error, redirect from page.
===============================================================*/
async function activateDownloads (res, op, data) {
 try {
  $(FS_Modal).hide();
  const downloads = [], failed = [];
// -----------------------------------------------------
  if (res) {
  	if (await checkForServerError(res, op))
      return false;

    const type = res.data.type;
    if (type.includes('json') || type.includes('plain')) { // Then the 'blob' is actually a report message
      res.data = JSON.parse(await res.data.text()); // We find the text within the response data and parse it
      return Flash(...Object.values(res.data)); //This way we avoid any bogus download attempts
    }

    if (type === 'error')
      return Flash(...Object.values(res.data)); //This way we avoid any bogus download attempts

    const downloadUrl = window.URL.createObjectURL(res.data);
    downloads.push([downloadUrl, 'Files.zip']); // First element is href, second element is the download attribute
    //Create a url link to raw data itself, and use 'download' attribute to receive it as a download link.
// -----------------------------------------------------
  } else if (mobile && data) { // On mobile device, we don't permit folder or zip downloads, so we just find the file from URL and download from source
      for (let file of data.files) {
        if (StagedFiles.count.length && pathfinder(StagedFiles.count, 'find', file))
          continue; //Don't try to download staged
        else if (AllFiles.count.length && checkModeType(pathfinder(AllFiles.count, 'find', file).stats.mode) === 'folder') {
          failed.push(`<span style="color: #22a0f4">${file.name}</span>`); // If the item is a folder, don't try
          continue;
        } else downloads.push([`/${file.path}/${file.name}`, file.name]); //First element is href, second element is the download attribute
      };
    }
// ----------------------------------------------------- After all links have been stored, iterated and activate them to trigger downloads
  for (let i = 0; i < downloads.length; i++)
  	triggerLink(...downloads[i]); // Spread is important. First element/argument is the href, second is the download tag/name to use

  if (failed.length)
    Flash([`Failed to download`, `Folders cannot be downloaded on mobile devices, files only.`], 'error', failed);
  else Flash([`Files downloaded: `, ``], 'success', downloads.map( l => l[1]));

  SelectedFiles.unlist(data.files);
// ---------------------------------------------------------------------------------
 } catch (err) {console.log(err)};
};

/* ----------------------------------------- */
$('.logo').hover(showNavbar);
$('.logo').on('touchstart', showNavbar);
/* ----------------------------------------- */

// --------------------------------------------------------------------
window.addEventListener('load', async () => {
  $('#tableOfDirectories').clone().appendTo('nav');

  if (firstVisit) {
    $('svg, .header > h1').hide();
    return false;
  }

  await setupDirectory();
  revealNextDirectory(CurrentFolder, CurrentFolder);
});

// --------------------------------------------------------------------
window.addEventListener('pageshow', (evt) => {

  dismissElement('#panelHeader', 'Y', 'down', '80%');

  if (firstVisit) {
  // Just for first-time visitors. Page will transition into view much more slowly to give elements time to hide themselves (see 'introductionTips' function for more info)
    introductionTips(0);
    $('main').css({
      'transform': 'translate(0)',
      'transition': 'all 1.3s ease-in-out',
    });
  }
  else $('main').css({
          'transform': 'translate(0)',
          'transition': 'all 0.7s ease-in-out',
        });
});
// --------------------------------------------------------------------
window.onbeforeunload = function() {
  if ($('.progress')[0]) {
    return 'Operation (upload/download/transfer) still in effect. Leaving page will abort. Continue?';
  }
 };
