'use strict';
const allExtensions =  [
  '.bat','.apk','.com','.jpg','.jpeg','.exe','.doc','.docx','.docm','.rpp','.html','.z','.pkg','.jar','.py','.aif','.cda','.iff','.mid','.mp3','.flac','.wav','.wpl','.avi','.flv','.h264','.m4v','.mkv','.mov','.mp4','.mpg','.rm','.swf','.vob','.wmv','.3g2','.3gp','.doc','.odt','.msg','.pdf','.tex','.txt','.wpd','.ods','.xlr','.xls','.xls','.key','.odp','.pps','.ppt','.pptx','.accdb','.csv','.dat','.db','.log','.mdbdatabase','.pdb','.sql','.tar','.bak','.cabile','.cfg','.cpl','.cur','.dll','.dmp','.drve','.icns','.ico','.inile','.ini','.info','.lnk','.msi','.sys','.tmp','.cer','.ogg','.cfm','.cgi','.css','.htm','.js','.jsp','.part','.odb','.php','.rss','.xhtml','.ai','.bmp','.gif','.jpeg','.max','.obj','.png','.ps','.psd','.svg','.tif','.3ds','.3dm','.cpp','.h','.c','.C','.cs','.zip','.rar','.7z'
];
let alphabet = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz'.split('');
const maxfiles = mobile ? 100 : 500;
let redirect = false; //If false, this will "fetch" the directories and integrate/replace the page with their contents, by adding a query string onto the url. If true, the entire page will redirect and repopulate the page with new directory contents. Slower this way, but often less error prone and sometimes inevitable.
const imageFormats = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.ico', '.svg'];
const audioFormats = ['.mp3', '.wav', '.ogg', '.flac'];
const videoFormats = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv'];
const imageDocFormats = ['.pdf'];
const textDocFormats = ['.txt', '.cfg', '.rtf', '.ini', '.info'];
const compressedFormats = ['.7z', '.zip', '.rar', '.z', '.pkg'];
const Outbound = {size: 0, staged: [], transfers: [], delete: [], selected: []}; //This is an "intermission" variable that temporarily holds any submission content during a dialog prompt. If the user confirms, the data is retrieved from here and sent on request.
// ----------------------------------------------------------------------


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
    if (!Array.isArray(files))
      files = [files];

    for (let file of files) {

      if (this.count.includes(file))
        continue; //Then the file is already added/selected, no need

      this.count.push(file);

      $(`[title="${file.name}"][path="${file.path}"]`).addClass(this.status);
      $(this.listings).append(`<li title="${file.name}" path="${file.path}" class="${this.status}">
      <span>${file.name}</span></li>`);

      let fileCard = getFileCard(file);
      $(fileCard).addClass(this.status);

      /*----- If folder argument is present, it means AllFiles is adding, thus a more sophisticated list item is needed. This below is not used by Staged or Selected Files-----------*/
      if (folder) {
        //This alone does not mean the "file" is a folder, it means it has a folder path.
    /*--------------------------------*/

        if (checkModeType(file.mode || file.stats.mode) === 'folder') {
          $(fileCard).removeClass(this.status);
          $(this.listings).children(`[title="${file.name}"][path="${file.path}"]`).html(`
          <i class="fa fa-folder" style="left: -40"></i>
          <a title="${file.path}/${file.name}" href="/${Partition + file.path}/${file.name}">${file.name}</a>
          <i onclick="makeEdit(this, $(this).prev('a')[0])" class="fa fa-edit hide"></i>`);
    /*--------------------------------*/
        } else {
          //Then it's a file
          $(this.listings).children(`[title="${file.name}"][path="${file.path}"]`).html(`
          <i class="fa fa-file-text" style="left: -40"></i>
          <a title="${file.path}/${file.name}" href="/${file.path}/${file.name}" download="${file.name}" class="darkcyan">${file.name}</a>
          <i onclick="makeEdit(this, $(this).prev('a')[0])" class="fa fa-edit hide"></i>`
          );
        }
    /*--------------------------------*/
      };
      $('.selected-count').text(`(${SelectedFiles.count.length})`);
      $('.staged-count').text(`(${StagedFiles.count.length})`);
      Directory.files ? $('.all-count').text(`${Directory.files.length || 0}`) : null;
    }; //End of For Loop
  }; //End of ADD function


  /*========================================================*/
  //Removes any stored file names, removes any list items with that file name AND path from Panel Header, and removes the associated class (.uploaded or .queued or .selected) from the file card with the same file name (also remove class from the other File Tracker list items, for SelectedFiles use only).
  /*========================================================*/
  async unlist(files, nodisplay) {

    !files ? files = this.count : files = files;
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

    $('.selected-count').text(`(${SelectedFiles.count.length})`);
    $('.staged-count').text(`(${StagedFiles.count.length})`);
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


    if (!Array.isArray(files))
      files = [files];

    for (let file of files) {
      this.unlist(file);
      let fileCard = getFileCard(file);
      fileCard ? $(fileCard).remove() : null;

      if (reallyDelete === true) {
        //If  true. We actually remove the file from the directory listing altogether, as this means the user wanted it deleted from the database, not just the page.
        let fileToDelete = pathfinder(Directory.files, 'find', file);
        fileToDelete ? Directory.files.splice(Directory.files.indexOf(fileToDelete), 1) : null;
        if (Directory.packs && Directory.packs[Directory.index].length < 1) {
          Directory.packs.splice(Directory.index, 1);
          findAllFiles(event, Directory.packs.length - 1 || 0);
        }
        //Then the pack is empty, do not use it any more, may cause errors

        StagedFiles.unlist(file);
        SelectedFiles.unlist(file);
        $('.all-count').text(Directory.files.length);
      }
      if (StagedFiles.count.length < 1) FolderInput.disabled = false;
    }
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

      // if (Directory === false) {
        //If it's the homepage, all files shown an h1-anchor within the file card designating its path, so need to adjust that
        let anchor = $(fileCard).find('a')[0]; //Download link of file card
        anchor.href === anchor.href.getSpaceChars().replace(regExp, file.new);
        anchor.download === anchor.download.getSpaceChars().replace(regExp, file.new);
      // }

      // --------- Now the li, just the title, no big deal
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

      };

      // --------- Not very necessary, but may cause bugs if we don't fix the browser file references
      if (file.directory === false)
      pathfinder(Directory.files, 'find', file).name = file.new;
      pathfinder(this.count, 'find', file).name = file.new;
    } catch (error) {
      Flash(error.message, 'error', [file.name]);
    }
  };
//---------------------------------------------------------------
}; //End of Class


/*===============================================================
  Removes the weird parse-coding that replaces 'Spacebar' characters, and restores the original spacebar whitespace.
===============================================================*/
String.prototype.getSpaceChars = function () {return this.replaceAll('%20', ' ')};
Array.prototype.last = function (index) {return index ? this.length - 1 : this[this.length - 1]};


/*===============================================================
  Projects a nice little fadein/fadeout message box proceeding any interaction with the back-end. 'content' is the message itself, 'type' is either success/warning/error (green/yellow/red respectively), and 'items' are optional additions to emphasize the data of the message content (i.e file names, folder names etc.).
===============================================================*/
function Flash(content, type = 'warning', items, excess) {

  $(FS_Modal).hide();
  $('progress').val('0'); //Reset progress bar
  $('.progress-op').text('') //And remove progress bar operation name
  // CSSVariables.setProperty('--operation', ''); //And remove progress bar operation name
  clearTimeout(window.messageLog); //Any log on delay arrival will be erased
  if (typeof (content) === 'string') content = [content];
  if (typeof (items) === 'string') items = [items];
  //Turn into array so we don't have to stir in more conditional code below

    let h1 = `
    <h1>${content[0]}
    <span><br>${items ? items.join('<br>') || items : '' }</span>
    <br>
    ${content[1] || ''}
    </h1>`;
    // if (excess) {
    //   h1 = h1 + `<hr><span style="color: red">Warning: </span> <h3>${excess}</h3>`;
    // }

    $(MessageLog).removeClass('success-box warning-box error-box fadeout hide')
    .addClass(`${type + '-box'}`).html(h1);
    dismissElement('#MessageLog', 'Y', 'up', '40%');
    //The "type" is always either: 'success', 'warning', or 'error'. We want any previous message type reset.

    if (UserSession.log) {
      $('#logDisplay').val('');
      for (let i = 0; i < UserSession.log.length; i++)
        $('#logDisplay')[0].value += `${i}: ${UserSession.log[i]}\n`;
      //Just listing log entry with number, and adding new line
    }
     window.messageLog = setTimeout( () => {
       dismissElement('#MessageLog', 'Y', 'up', '100%', 300, true);
       $(MessageLog).find('h1').addClass('fadeout');
     }, 2000 + h1.length * 50);

     //The message display duration will always be at least 2 seconds, but increased based on the length of the message
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
  $('.fs-modal-message').text('Zipping files for download...');
  let data = {operation: operation};
  showOperation(operation);

  if (SelectedFiles.count.length && event.shiftKey === false) { //Some but not all
    data.files = SelectedFiles.count || [];
  } else if (event.shiftKey) data.files = AllFiles.count; //All items
  else data.files = {name: fileCard.id, path: $(fileCard).attr('path')}; //Single item
  data.files;
// ---------------------------------------------------------------------------------
if (mobile) {
  //If using mobile device
  await makeDownloadLinks(false, data);
} else await axios({
    method: 'post',
    url: `/download`,
    data: data,
    onDownloadProgress: progressEvent => {
      let approximateLength = progressEvent.srcElement.getResponseHeader('Bullshit'); //On downloading zip, archive size cannot be determined accurately, thus had to conceieve a bullshit fake "content-length" header based on collective pre-zip file size for approximation
      let percentCompleted = (progressEvent.loaded / approximateLength) * 100;
      $('progress').val(`${percentCompleted}`);
    },
    responseType: 'blob', //Receiving zip file, which qualifies as arraybuffer or blob
  }).then( makeDownloadLinks).catch( (error) => Flash(error.message, 'error', error.stack));
};


/*===============================================================
  Called upon when download request is returned. Takes the response and creates object URLs out of the blob data received (if successful), if desktop: It will be a zip. If on mobile, don't even do a request, and instead use 'data'
  which references file names and download them individually from server. If response is an error, redirect from page.
===============================================================*/
async function makeDownloadLinks (res, data) {

  $(FS_Modal).hide();
  const downloadLinks = [], failed = [];

  if (res) {

  	if (await checkForServerError(res))
      return false;

      console.log (res);
    const type = res.data.type;
    if (type.includes('json') || type.includes('html') || type.includes('plain')) { // Then the 'blob' is actually a report message
      res.data = JSON.parse(await res.data.text()); // We find the text within the response data and parse it
      return Flash(...Object.values(res.data)); //This way we avoid any bogus download attempts
    }

    if (type === 'error')
      return Flash(...Object.values(res.data)); //This way we avoid any bogus download attempts

    const link = document.createElement('a');
    const downloadUrl = window.URL.createObjectURL(res.data);
    $(link).attr({ href: downloadUrl, download: 'Files.zip' });
    downloadLinks.push(link);
    //Create a url link to raw data itself, and use 'download' attribute to receive it as a download link.
  } else if (mobile && data)
      for (let file of data.files) {
        const link = document.createElement('a');

        if (StagedFiles.count.length && pathfinder(StagedFiles.count, 'find', file))
          continue; //Don't try to download staged
        else if (pathfinder(AllFiles.count, 'find', file).stats.mode.toString().slice(0, 2) === '16') {
          //Lol then it's a folder type, and mobile does not download those
          failed.push(`<span style="color: #22a0f4">${file.name}</span>`);
          continue;
        }
        $(link).attr({ href: `/${file.path}/${file.name}`, download: file.name });
        downloadLinks.push(link);
      };

  for (let link of downloadLinks) {
    document.body.appendChild(link); /*-->*/ link.click(); /*-->*/ link.remove();
    downloadLinks[downloadLinks.indexOf(link)] = link.download;
    // We create the link, auto-click it, then remove it unbeknownst to user.
  }
  if (failed.length)
    Flash([`Failed to upload`, `Folders can not be downloaded on mobile devices, files only.`], 'error', failed);
  else Flash([`Files downloaded: `, ``], 'success', downloadLinks);
  SelectedFiles.unlist();
// ---------------------------------------------------------------------------------
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
  setTimeout( () => {
    if (Server.status === 0) {
      let currentTime = Math.floor(new Date().getTime() / 60000);
      Flash(`<hr> <span style="color: red">Warning: </span> <h1>${Server.warning}: Occuring in ${Math.abs(currentTime - Server.countdown)} minutes</h1>`, 'warning');
    }
  }, 100);

  await setupDirectory();
  revealNextDirectory(CurrentFolder, CurrentFolder);
});

// --------------------------------------------------------------------
window.addEventListener('pageshow', (evt) => {

  dismissElement('#panelHeader', 'Y', 'down', '80%');
  // ------------------------------------
  if (firstVisit) {
  // Just for first-time visitors. Page will transition into view much more slowly to give elements time to hide themselves (see 'introductionTips' function for more info)
    introductionTips(0);
    $('main').css({
      'transform': 'translate(0)',
      'transition': 'all 1.3s ease-in-out',
    });
  } else $('main').css({
          'transform': 'translate(0)',
          'transition': 'all 0.7s ease-in-out',
        });
});
