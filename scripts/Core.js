
const allExtensions =  [
  '.bat','.apk','.com','.jpg','.jpeg','.exe','.doc','.docx','.docm','.rpp','.html','.z','.pkg','.jar','.py','.aif','.cda','.iff','.mid','.mp3','.flac','.wav','.wpl','.avi','.flv','.h264','.m4v','.mkv','.mov','.mp4','.mpg','.rm','.swf','.vob','.wmv','.3g2','.3gp','.doc','.odt','.msg','.pdf','.tex','.txt','.wpd','.ods','.xlr','.xls','.xls','.key','.odp','.pps','.ppt','.pptx','.accdb','.csv','.dat','.db','.log','.mdbdatabase','.pdb','.sql','.tar','.bak','.cabile','.cfg','.cpl','.cur','.dll','.dmp','.drve','.icns','.ico','.inile','.ini','.info','.lnk','.msi','.sys','.tmp','.cer','.ogg','.cfm','.cgi','.css','.htm','.js','.jsp','.part','.odb','.php','.rss','.xhtml','.ai','.bmp','.gif','.jpeg','.max','.obj','.png','.ps','.psd','.svg','.tif','.3ds','.3dm','.cpp','.h','.c','.C','.cs','.zip','.rar','.7z'
];
let alphabet = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz'.split('');
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
  add(files, folder) {
    if (!Array.isArray(files))
      files = [files];

    for (let file of files) {

      if (this.count.includes(file))
        continue; //Then the file is already added/selected, no need

      this.count.push(file);

      $(`[title="${file.name}"][path="${file.path}"]`).addClass(this.status);
      $(this.listings).append(`<li title="${file.name}" path="${file.path}" onclick="selectFiles(this)" class="${this.status}">
      <span>${file.name}</span></li>`);

      let fileCard = getFileCard(file);
      $(fileCard).addClass(this.status);

      /*----- If folder argument is present, it means AllFiles is adding, thus a more sophisticated list item is needed. This below is not used by Staged or Selected Files-----------*/
      if (folder) {
        //This alone does not mean the "file" is a folder, it means it has a folder path.
    /*--------------------------------*/

        if (checkModeType(file.stats.mode) === 'folder') {
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
      $('.all-count').text(`${Directory.files.length || 0}`);
    }; //End of For Loop
  }; //End of ADD function


  /*========================================================*/
  //Removes any stored file names, removes any list items with that file name AND path from Panel Header, and removes the associated class (.uploaded or .queued or .selected) from the file card with the same file name (also remove class from the other File Tracker list items, for SelectedFiles use only).
  /*========================================================*/
  unlist(files, nodisplay) {

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
  delete(file, reallyDelete) {

    this.unlist(file);
    let fileCard = getFileCard(file);
    fileCard ? $(fileCard).remove() : null;

    if (reallyDelete === true) {
      //If  true. We actually remove the file from the directory listing altogether, as this means the user wanted it deleted from the database, not just the page.
      let fileToDelete = pathfinder(Directory.files, 'find', file);
      Directory.files.splice(Directory.files.indexOf(fileToDelete), 1);
      if (Directory.packs)
        Directory.packs[Directory.index].splice(Directory.files.indexOf(fileToDelete), 1);

      StagedFiles.unlist(file);
      SelectedFiles.unlist(file);
      $('.all-count').text(Directory.files.length);
    }
    if (StagedFiles.count.length < 1) FolderInput.disabled = false;

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


/*===============================================================
  Projects a nice little fadein/fadeout message box proceeding any interaction with the back-end. 'content' is the message itself, 'type' is either success/warning/error (green/yellow/red respectively), and 'items' are optional additions to emphasize the data of the message content (i.e file names, folder names etc.).
===============================================================*/
function Flash(content, type = 'warning', items, excess) {

  $(FS_Modal).hide();
  clearTimeout(window.messageLog);
  if (typeof (content) === 'string') content = [content];
  if (typeof (items) === 'string') items = [items];
  //Turn into array so we don't have to stir in more conditional code below

    let h1 = `
    <h1>${content[0]}
    <span><br>${items ? items.join('<br>') || items : '' }</span>
    <br>
    ${content[1] || ''}
    </h1>`;

    $(MessageLog).removeClass('success-box warning-box error-box fadeout hide')
    .addClass(`${type + '-box'}`).html(h1);
    dismissElement('#MessageLog', 'Y', 'down', '40%');
    //The "type" is always either: 'success', 'warning', or 'error'. We want any previous message type reset.

    if (UserSession.log) {
      logDisplay.value = '';
      for (let i = 0; i < UserSession.log.length; i++)
        logDisplay.value += `${i}: ${UserSession.log[i]}\n`;
      //Just listing log entry with number, and adding new line
    }
     window.messageLog = setTimeout( () =>
     dismissElement('#MessageLog', 'Y', 'down', '100%', true), 2000 + h1.length * 50);
     //The message display duration will always be at least 2 seconds, but increased based on the length of the message
};


/*===============================================================
  Triggered when the user clicks either Download or Download All. It sends a post request to /zip/<folder name> which creates a zip, finds every file within the given folder name requested, packages them INTO the zip, before returning it as a download response back to the user.
===============================================================*/
async function downloadFiles(fileCard) {

  if (SelectedFiles.count.length < 1 && event.shiftKey === false && !fileCard)
    return Flash('No files selected for download', 'warning');

  $(FS_Modal).show();
  $('.fs-modal-message').text('Zipping files for download...');
  let data;

  if (SelectedFiles.count.length && event.shiftKey === false) {
    data = SelectedFiles.count || [];
  } else if (event.shiftKey) data = AllFiles.count;
  else data = [{name: fileCard.id, path: $(fileCard).attr('path')}];
// ---------------------------------------------------------------------------------
  await axios({
    method: 'post',
    url: `/zip`,
    data: data,
    responseType: 'blob', //Receiving zip file, which qualifies as arraybuffer or blob

  	// responseType: 'arraybuffer', = Can do this, but would have to convert to blob anyway
    // responseType: 'stream', = Did not work, not valid type
    // responseType: 'buffer', = Did not work, not valid type
  })
// ---------------------------------------------------------------------------------
  .then( (res) => {
    $(FS_Modal).hide();
    // const downloadUrl = window.URL.createObjectURL(new Blob([res.data]));
    const downloadUrl = window.URL.createObjectURL(res.data);
    const link = document.createElement('a');
    $(link).attr({ href: downloadUrl, download: 'Files.zip' });
    document.body.appendChild(link); /*-->*/ link.click(); /*-->*/ link.remove();
    //Create a url link to raw data itself, and use 'download' attribute to receive it as a download link. We create the link, auto-click it, then remove it for user experience.

    SelectedFiles.unlist();
// ---------------------------------------------------------------------------------
  }).catch( (err) => Flash('Download request failed', 'error'));
};


/*===============================================================
  All declarations that had to wait for page content/elements/functions to load before execution. This integrates back-end variables such as Session data into the browser for manipulation of page elements.
===============================================================*/
async function populateDirectory() {
  /* ----------------------------------------- */
if (Directory.name) {
  /* If within a directory, list all files/folders of the directory and their media contents  */
  Flash(`<span style="color: #22a0f4;">${Directory.name}</span> loaded`, 'success');
  for (let rival of rivals) {
    if (rival.residing === Directory.layers[0]) {
      Flash([`<span style="color: green;">${rival.user}</span> is currently browsing within this primary directory <span style="color: #22a0f4;">${Directory.layers[0]}</span>.`,
      `Moving, renaming or deleting files within here is ill-advised`], 'warning');
      break;
    }
  };
  CurrentFolder = Directory.name.getSpaceChars();

  FolderInput[0].value = CurrentFolder;
  $('.view-dir').attr('href', `/${Partition + CurrentFolder}` || '/');
  await listDirectoryContents(event);

} else if (!CurrentFolder) {
  Directory.index = 0;
  Directory.layers = ['/'];
  await findAllFiles(event);
}

/* ----------------------------------------- */
if (UserSession.preferences.outsideDir)
  $('.my-dir').click();

if (UserSession.home === UsersDirectory) {
  $('td').attr('path', UserSession.user.name);
  if (!CurrentFolder && !Directory.name) {
    Directory.name = UserSession.user.name;
    CurrentFolder = UserSession.user.name;
  }
}

$('#tableOfDirectories').clone().appendTo('nav');
/* ----------------------------------------- */
//This crap below was a browser exception soley for Mozilla Firefox, which perpetuated nasty page jerking whenever any file card was hovered over. If we find the browser prefixes have no/hardly any Mozilla features, we apply a conventional hover/show behavior to the elements.
const prefix = (Array.prototype.slice
  .call(window.getComputedStyle(document.documentElement, '')).filter( (style) => style.includes('-moz')));

  if (!prefix || prefix.length < 10) {
    $('.ui-draggable').hover( function () {

      $(this).find('.source-icons').show();
      if (event.type === 'mouseout')
        $(this).find('.source-icons').hide();
    });
  }
/* ----------------------------------------- */
};


/* ----------------------------------------- */
$('.logo').hover( function (event) { //Displays Navbar and adds nice lighting effect

  if (event.type === 'mouseleave')
    return $('main, nav, #FileTable').removeClass('glow-right shift-over');

  $('main').addClass('glow-right');
  $(FileTable).addClass('glow-right');
  $('nav').addClass('shift-over');

});
/* ----------------------------------------- */
$('.logo').draggable({
  containment: 'body',
  revert: false,
  distance: 1,
  delay: 200,
  axis: 'x',
  appendTo: 'body',
  drag: function(evt, ui) {
    //Firefox needed this to proceed to "stop"
    if (!event.buttons)
      return false;
  },
});

// --------------------------------------------------------------------
window.addEventListener('load', async () => {

  if (firstVisit)
    return false;

  await populateDirectory();
});
// --------------------------------------------------------------------
window.addEventListener('pageshow', (evt) => {
  if (firstVisit) {
  // Just for first-time visitors. Page will transition into view much slowly to give elements time to hide themselves (see 'introductionTips' function for more info)
    introductionTips(0);
    $('main').css({
      'transform': 'translate(0)',
      'transition': 'all 2.5s ease-in-out',
    });
  } else $('main').css({
          'transform': 'translate(0)',
          'transition': 'all 0.7s ease-in-out',
        });
});
