'use strict';


/*===============================================================
  Returns a new div element with various children, known as a File Card on here. The appearance of the card is based on the "item input", which is usually a file. File cards are interacted with frequently so reading what it's composed of will clarify the intentions of many other blocks.
===============================================================*/
function makeFileCard(item, status) { //Important. Created upon staging/pre-loading a file, used as the bedrock for displaying media. The ID, "status" and title are used by the application to indentify the file's existence when deleting, transferring or downloading it.
    //33206 is code for 'file'
    if (!item.size && item.stats) //Size data is gathered from different properties depending on page load, or item upload
      item.size = item.stats.size;

    let filesize = getFileSize(item.size || 1);
      
    if (checkModeType(item.mode || item.stats.mode) === 'file')  {

      return `
       <div id="${item.name}" path="${item.path || ''}" size="${item.size}" class="column ${status}">
        <header class="filehead">
          <h1 title="${item.path}/${item.name}">
            <i class="fa fa-file-text"></i>${item.name}
          </h1>
        </header>
         <p style="align-self: center; color: darkgrey;">${filesize}</p>
       </div>`;
    // ==========================================================
    } else { //Then it's a folder
      return `
        <div id="${item.name}" path="${item.path || ''}" size="${item.size}" class="folder">
          <header class="filehead">
            <i class="fa fa-folder"></i>
            <a href="/${Partition + CurrentFolder}/${item.name}" title="${CurrentFolder}/${item.name}">${item.name}</a>
            <i class="fa fa-list-alt"></i>
          </header>
        </div>`;
    } //Path is the exact folder path it is within, title is the "full" path with folder name included, needed for access on back-end
};


/*===============================================================
  Used within info tab of Files/Folder items on the page. Just HTML aesthetics, non-essential.
===============================================================*/
function presentFileStats(item, stats, status) {
 
	let creationDate = new Date(stats.birthtimeMs || stats.lastModified || Date.now()); //Both depend on staged or uploaded type
	let children = ['<hr>'];
	item.date = creationDate.toLocaleDateString();
	item.creator = stats.creator || 'You'; //Both depend on staged or uploaded type
	item.size = getFileSize(stats.size);

	if (item.children) { // Folder stats. If it has files/subdirectories (children), list them as anchor tags
      for (let child of item.children.folders)
        children.push(`<a href="/${Partition + item.path}/${item.name}/${child}" class="dimblue">${child}</a><br>`);
      for (let child of item.children.files)
        children.push(`<a href="/${Partition + item.path}/${item.name}/${child}" download="${child}" class="darkcyan">${child}</a><br>`);
    };

	return `
	<div class="file-info folder-children fadein" style="word-break: break-word;" title="${item.name}/${item.path}">
	<span class="gray">Path: </span>${item.path}<br>
	<span class="gray">Size: </span>${item.size}<br>
	<span class="gray">Created By: </span>${item.creator}<br>
	<span class="gray">${status || 'Uploaded'}: </span>${item.date}<br>
	${children.join('')}</div>`; //A little info tab 
};


/*===============================================================
  Normally this wouldn't be necessary, but in the case that a User requests all files, and some files are duplicates, we would have problems. This will now check if the path AND name are the same, since both are impossible in traditional file systems.
===============================================================*/
function getFileCard(file) {
  //Find the element with the ID and path of the file name and path, respectively, or find by name if no path is present.

  if (!file.name) file = file[0]; //If by chance there is no name property, then it's most likely an array of one string (the file name).

  if ($(`div[id="${file.name || file}"]`).length > 1) {
    //If more than one file card is found with the same file name, they are the same file but within different directories, so we also search by path AND name, since there's no way they could both be the same with traditional file systems.
    return $(`div[id="${file.name}"][path="${file.path}"]`)[0] || document.getElementById(file.name || file);
  } else return document.getElementById(file.name || file);

};


/*===============================================================
  Called whenever a text file is SUCCESFULLY uploaded. Converts it into a readable format that displays within an un-editable textbox <textarea>.
===============================================================*/
function createTextFile(fileCard, file) {
    // let textarea = $(fileCard).closest('textarea')[0];
    let fileReader = new FileReader();

    fileReader.onload = function (evt) {
      let textFile;
      if (file.name.includes('.rtf')) {
      	 textFile = evt.target.result.replace(/\\par[d]?/g, "").replace(/\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/g, "").replace(/\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/g, "").trim();
         //Lol, all this line does is just parse/replace the RTF encoding characters so we can render it as Plain Text
      } else textFile = evt.target.result;

      $(fileCard).closest('textarea').text(textFile);
      textFile.length >= 10000 ? $(fileCard).closest('textarea').hide() : $(fileCard).closest('textarea').show();
    };

    fileReader.onerror = () => Flash('Text file could not be read', 'error', fileReader.error);

    fileReader.readAsText(file);
    return fileCard;
  };


/*===============================================================
  Triggers after a user SUCCESFULLY uploads files through a post request, or loads a directory. It takes in a file name and renders the file's content into the file card using its source from the database. If its type is a folder it will return an anchor tag and an un-draggable 'folder card' instead.
===============================================================*/
async function createMedia(file, folder, fileCard) {

  let downloadLink = `<a title="${folder}/${file.name}" href="/${folder}/${file.name}" class="download" download="${file.name}" style="align-self: center; display:inline-block;">
    <i class="fa fa-download" aria-hidden="true"></i></a>`;
  let sourceLinks = `
  <div class="source-icons hide" style="transition: all 0.5s ease-in-out;">
	${downloadLink}
    <i class="fa fa-trash-alt gray remove" onclick="deleteSingle(this.parentNode.parentNode)"></i>
    <i onclick="makeEdit(this, $(this).parents('.column, .folder')[0])" class="fa fa-edit"></i>
  </div>`
// --------------------------------------------------------------

  mobile || oversize ? null : $(fileCard).draggable(dragItem);
  //Make the file-card draggable using the options defined within dragItem object-function. If mobile, don't use it at at all

  if (file.stats && checkModeType(file.stats.mode) === 'folder') {
    //Then it's a folder, and we're obviously in a directory so absolute path needed
    mobile || oversize ? null : $(fileCard).droppable(dropItem); //If folder make droppable, unless using mobile device
    sourceLinks = sourceLinks.replace(downloadLink, '');
    return sourceLinks + `<img src="/folder.png"><a title="${folder}/${file.name}" href="${folder}/${file.name}" class="hide">${file.name}</a>`;
  }
// --------------------------------------------------------------
    if (!CurrentFolder || CurrentFolder === Username) {
    //Then we are at the homepage, viewing all files from other directories.
    $(fileCard).find('header').append(`
      <h1 path="${folder}" style="font-size: 1.0rem">
        <i class="fa fa-folder white"></i><a href="/${Partition + folder}">/${folder}</a>
      </h1>`)
    } 
    if ('.'.isNotIn(file.name)) $(fileCard).addClass('faulty');
    /*Very rare, this means the file has no extension, but wasn't considered a folder either at the very start, so something's off*/
// --------------------------------------------------------------
  return getMediaType(file, folder, fileCard, sourceLinks);
};


/*===============================================================
  Used exclusively by "createMedia", this checks what type of content the media of the file suggests (image, text, audio, etc.), and returns the appropriate element tags to best represent it.
===============================================================*/
async function getMediaType (file, folder, fileCard, source) {

  if (checkFileType(file, imageFormats) === true) { //Image
    return `${source}<i class="fa fa-eye" style="align-self: center;" onclick="viewImage(this.nextSibling)"></i><img class="media-content" id="source" src="/${folder}/${file.name}" alt="">`
// --------------------------------------------------------------
  } else if (checkFileType(file, audioFormats) === true) { //Audio
    // const audio_image = mobile ? "/audio-icon.png" : "/audiocircle.gif"; //Don't use gifs on mobile
    const audio_image = "/audio-icon 2.png"; //Don't use gifs on mobile

     return `${source}
     <i class="fa fa-volume-up" style="align-self:center;"></i>
     <img class="media-content audio-pic" src="${audio_image}" class="audio-pic">
     <audio controls>
       <source id="source" src="/${folder}/${file.name}">
       Your browser does not support the audio element.
     </audio>`;
// --------------------------------------------------------------
  } else if (checkFileType(file, videoFormats) === true) { //Video
     return `${source}
     <video class="media-content" controls accept="video/*">
       <source id="source" src="/${folder}/${file.name}" draggable="true">
       Your browser does not support HTML video.
     </video>`;
// --------------------------------------------------------------
  } else if (checkFileType(file, textDocFormats) === true) { //Text document
      source = `${source}
       <button class="my-button blue" onclick="viewTextInModal(this.parentNode)">View</button>
       <textarea class="media-content" name="text" rows="12" cols="120" readonly></textarea>`;
       if (Directory) { // If we're in a directory, we'll have to fetch the text files again in order to use a file reader on them (to place in a text-area)
         await axios(`/${folder}/${file.name}`, {responseType: 'blob'})
         .then( (res) => {
          //Retrieve the actual blob file from back-end, create a new browser-side File out of it, and pass it in to the text-file reader before displaying it onto a <textarea> below.
          let textfile = new File([res.data], file.name);
          source = createTextFile($(source), textfile);
        }).catch( (error) => Flash(error.message, 'error'));

      } else source = createTextFile($(source), file); return source;
// --------------------------------------------------------------
  } else if (checkFileType(file, imageDocFormats) === true) { //Visual document
      return `${source}
      <button class="my-button blue" onclick="viewTextInModal(this.parentNode)">View</button>
      <object data='/${folder}/${file.name}' type="application/pdf" width="400" height="300"></object>`
// --------------------------------------------------------------
  } else { //In this case it could be any of the 1000 other formats out there, and 90% of the time it can't be rendered on the page as media content, so we'll just pass in a placeholder image to represent the file type and call it good
    let thisFileExt = file.name.slice(file.name.lastIndexOf('.'));
    let validExtension = allExtensions.filter( (ext) => ext === thisFileExt).join('').replace('.', '') || 'unknown';

    //We get the extension/format of the file, and compare it to all valid extensions the site uploading permits. If it passes, we use the given icon image that represents that file type, which will always be the name of the file extension itself (dll.png, mp3.png, exe.png, etc...), all stored in the back-end resources.
    return `${source}<img class="media-content" src="/${validExtension}.png" style="max-width: 80px !important; border: 0px solid black;"> `;
  }
};


/*===============================================================
  Uses 'source content', which may be an <img>, <video> or <audio> etc. and places it into the given file card. Prepends file card if it's a folder, appends if it's file.
===============================================================*/
function insertFileCard (source, fileCard, file) {
  $(source).insertAfter($(fileCard).children('header'));

  if ($(fileCard).hasClass('folder') || $('.file-search').val())
    $(FileTable).prepend(fileCard);
  else $(FileTable).append(fileCard);

  if (pathfinder(SelectedFiles.count, 'find', file))
    $(fileCard).addClass('selected');
  //Occasionally, the user may select files from the panel listing (which always shows every file in the directory), while the FileTable is only displaying a few. We need to update them to match the panel selectinos.
}


/*===============================================================
  Third most important function here. Whenever the page loads or a user requests all their OWN files, this function will be called on loading a directory, clicking "More Files", or clicking "View My Files". It basically lists the media content of every file, and displays every folder within a 'Card' element.
===============================================================*/
async function listDirectoryContents (evt, all) {
  clearDialog();

  if (Directory.files && AllFiles.count.length < Directory.files.length)
    // await AllFiles.add(Directory.files.slice(0, maxfiles), true);
    await AllFiles.add(Directory.files, true);
  if ($(FileTable).children('div').length > AllFiles.count.length)
     return false; /*Then we stop listing, to avoid overloading page*/
    

  //If user has search input, only list files that contain the characters input
  const filesToList = $('.file-search')[0].value
    ? namefinder(Directory.files, 'filter', $('.file-search')[0].value)
    : Directory.files;
  let filesListed = 0;

  for (let file of filesToList) {
      if ($(`div[id="${file.name}"][path="${file.path}"]`)[1]) {
      	$(`div[id="${file.name}"][path="${file.path}"]`)[1].remove();
      	continue;
      }
 

      if ($(FileTable).children('div').length > AllFiles.count.length || filesListed >= 10)
        break; /*Then we stop listing, to avoid overloading page*/

      else if ($(`div[id="${file.name}"][path="${file.path}"]`)[0] || file.path === Partition.replace('/', ''))
        continue; //Simple, if that file (file card) already exists, don't display it again obviously

      else if (checkModeType(file.mode || file.stats.mode) === 'folder') /*Then it's a folder, should always display*/ {
        filesListed = filesListed;
      }

      else filesListed += 1;

      if (evt && evt.shiftKey || all)
        filesListed --;
      //List all of them, 'filesListed' will remain at 0

      //Each iteration creates a file/folder card, gets any media content, and appends/displays it to the page. No more than 10-15 files are listed/displayd per function call, unless Shift is pressed when More Files is clicked.
      let fileCard = $(makeFileCard(file, 'uploaded'));
      setTimeout( () => {
        createMedia(file, file.path, fileCard)
        .then( (source) => insertFileCard(source, fileCard, file));
      }, 10);

  }; //End of For loop going over files
  
  if (firefox) {
    $('main').css('padding', '1.1%'); //Resets Main's padding. This is for Firefox, for whenever new items are shown, the Main padding gets all messed up.
    setTimeout( () => $('main').css('padding', '1%'), 500);  	
  }

  checkForEmpty();
};


/*===============================================================
//Intensive function. Sends a request, and finds ALL files that belong to the given user, and returns them to the browser to replace the current "Directory.files"
===============================================================*/
async function findAllFiles (evt, index) {
	
  if (UserSession.home !== UsersDirectory && CurrentFolder)
    return triggerLink('/'); //Trying to activate this function while within a directory will redirect.
    
  if (Directory && typeof(Directory) !== 'string') {
    if (!Directory.files || index !== undefined) { //Then we are not in a directory
    	
      Directory.index = Math.min(Math.max(index !== undefined ? index : Directory.index, 0), Directory.maxindex || 1); //Directory index cannot go below 0, or surpass the maxindex
	  $('.fetch-files').hide();
	  
	  
	  // --------------------------------------------------------------------
      axios({
      	method: 'post',
      	url: '/all',
      	data: {index: Directory.index, folder: Directory.name},
      	cancelToken: new CancelToken( (c) => Requests.General = c),
      }).then( async (res) => {

		$('.fetch-files').show();
        if (await checkForServerError(res) || Directory.creator) //If server error, or if user switched to a directory when response arrives
          return false;

        Directory = res.data;

        if (Directory.files.length >= maxfiles) {
          Flash([`Will not display more than`, `files at a time. Request next file set in navbar to retrieve more. This will replace the current file set`], 'warning', [maxfiles]);
          $('.fetch-files').show();
        } else if (!Directory.maxindex) {
          $('.fetch-files').hide();
        }
 
        Directory.index === Directory.maxindex && Directory.index > 0 ? $('.next-all').hide() : $('.next-all').show(); //If current index (last file pack) matches last index
        Directory.index === 0 ? $('.prev-all').hide() : $('.prev-all').show(); // If it's 0, there's no "previous" to go back to

        listDirectoryContents(event);
// --------------------------------------------------------------------
      }).catch( (error) => {
         Requests.cancel('General');
         if (axios.isCancel(error)) 
           Flash('Request timed out, all files not retrieved', 'warning');
	     else Flash([error.message], 'error');
           return false;
      });
      setTimeout( () => { //If request has not returned in 5 seconds (there would be files available), cancel the request altogether
	    if (!Directory.files) 	
	      return Requests.cancel('General');	
	  }, 5000); 

      AllFiles.delete(AllFiles.count);
    }
  }
};
