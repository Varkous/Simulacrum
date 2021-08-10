/*===============================================================
  Given file size is usually in bytes, which is a bloated number to read. This function uses Math to parse it into kilobytes/megabytes/gigabytes depending on amount of bytes of file.
===============================================================*/
function getFileSize(filesize) {
// If filesize is at least Delta digits and less than Gamma digits, read by kilobytes
     if (filesize > 999 && filesize < 1000000)//Divide filesize (bytes) by Delta
     filesize = Math.floor(filesize / 1000) + ' Kilobytes';

// If filesize is at least Gamma digits and less than Juliett digits, read by megabytes, which would cap at 999 megabytes
     else if (filesize > 999999 && filesize < 1000000000) //Divide filesize (bytes) by Gamma
     filesize = (filesize / 1000000).toFixed(1) + ' Megabytes';

// If filesize is Juliet digits or more, read by gigabytes
     else if (filesize > 999999999)  //Divide filesize (bytes) by Juliet
     filesize = (filesize / 1000000000).toFixed(1) + ' Gigabytes';

     else filesize = filesize + ' Bytes';

     return filesize;
  };


/*===============================================================
  Returns a new div element with various children, known as a File Card on here. The appearance of the card is based on the "item input", which is usually a file. File cards are interacted with frequently so reading what it's composed of will clarify the intentions of many other blocks.
===============================================================*/
function makeFileCard(item, status) {

//Important. Created upon staging/pre-loading a file, used as the bedrock for displaying media. The ID, "status" and title are used by the application to indentify the file's existence when deleting, transferring or downloading it.

    if (item.mode === 33206 || item.stats.mode === 33206)  {
      //33206 is code for 'file'
      if (!item.size && item.stats) //Size data is gathered from different properties depending on page load, or item upload
        item.size = item.stats.size;

      let filesize = getFileSize(item.size || 1);
      return `
       <div id="${item.name}" path="${item.path || ''}" class="column ${status}" onclick="selectFiles(this)">
        <header class="filehead">
          <h1 title="${item.path}/${item.name}">
            <i class="fa fa-file-text"></i>${item.name}
          </h1>
        </header>
         <p style="align-self: center; color: darkgrey;">${filesize}</p>
       </div>`;
    // ==========================================================
    } else { //Then it's a folder
      let folderChildren = [];
      if (item.children) {
        for (let child of item.children.folders)
          folderChildren.push(`<li class="dimblue">${child}</li>`);
        for (let child of item.children.files)
          folderChildren.push(`<li class="darkcyan">${child}</li>`);
      }

      return `
        <div id="${item.name}" path="${item.path || ''}" class="folder" onclick="selectFiles(this)">
          <header class="filehead">
            <i class="fa fa-folder"></i>
            <a href="/${Partition + CurrentFolder}/${item.name}" title="${CurrentFolder}/${item.name}">${item.name}</a>
            <i class="fa fa-list-alt"></i>
            <ol class="folder-children">
             ${folderChildren.join('')}
            </ol>
            <i class="fa fa-trash-alt gray remove" onclick="deleteSingle(this.parentNode.parentNode)"></i>
          </header>
        </div>`;
    } //Path is the exact folder path it is within, title is the "full" path with folder name included, needed for access on back-end
};


/*===============================================================
  Normally this wouldn't be necessary, but in the case that a User requests all files, and some files are duplicates, we would have problems. This will now check if the path AND name are the same, since both are impossible in traditional file systems.
===============================================================*/
function getFileCard(file) {
  //Find the element with the ID and path of the file name and path, respectively, or find by name if no path is present.

  if (!file.name) file = file[0]; //If by chance there is no name property, then it's most likely an array of one string (the file name).
  // if (file.path) file.path = file.path.replace(`/${file.name}`, ''); //We don't want file name in any path

  if ($(`div[id="${file.name || file}"]`).length > 1) {
    //If more than one file card is found with the same file name, they are the same file but within different directories, so we also search by path AND name, since there's no way they could both be the same with traditional file systems.
    return $(`div[id="${file.name}"][path="${file.path}"]`)[0] || document.getElementById(file.name || file);
  } else return document.getElementById(file.name || file);

}


/*===============================================================
  Called whenever a text file is SUCCESFULLY uploaded. Converts it into a readable format that displays within an un-editable textbox <textarea>.
===============================================================*/
function createTextFile(fileCard, file) {
    let textarea = $(fileCard).closest('textarea')[0];
    let fileReader = new FileReader();

    fileReader.onload = function (evt) {
      let textFile;
      if (file.name.includes('.rtf')) {
      	 textFile = evt.target.result.replace(/\\par[d]?/g, "").replace(/\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/g, "").replace(/\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/g, "").trim();
         //Lol, all this line does is just parse/replace the RTF encoding characters so we can render it as Plain Text
      } else textFile = evt.target.result;

      $(textarea).text(textFile);
    };

    fileReader.onerror = () => Flash('Text file could not be read', 'error', fileReader.error);

    fileReader.readAsText(file);
    return fileCard;
  };


/*===============================================================
  Triggers after a user SUCCESFULLY uploads files through a post request, or loads a directory. It takes in a file name and renders the file's content into the file card using its source from the database. If its type is a folder it will return an anchor tag and an un-draggable 'folder card' instead.
===============================================================*/
async function displayMedia(file, folder, fileCard) {

  let sourceLinks = `
  <div class="source-icons hide" style="transition: all 0.5s ease-in-out;">
    <a title="${folder}/${file.name}" href="/${folder}/${file.name}" download="${file.name}" style="align-self: center; display:inline-block;">
    <i class="fa fa-download" aria-hidden="true"></i></a>
    <i class="fa fa-trash-alt gray remove" onclick="deleteSingle(this.parentNode.parentNode)"></i>
    <i onclick="makeEdit(this, $(this).parents('.column')[0])" class="fa fa-edit"></i>
  </div>`
// --------------------------------------------------------------
  $(fileCard).draggable(draggableOptions); //Make the file-card draggable using the options defined within draggableOptions object-function near the top of this .js file
  if (file.stats && file.stats.mode === 16822) {
    //Then it's a folder, and we're obviously in a directory so absolute path needed
    $(fileCard).droppable(makeFoldersDroppable);
    let downloadFolder = `
    <div class="source-icons">
      <i class="fa fa-download" aria-hidden="true" onclick="downloadFiles(this.parentNode.parentNode)"></i>
      <i onclick="makeEdit(this, $(this).parents('.folder')[0])" class="fa fa-edit" style="right: 0"></i>
    </div>`
    return downloadFolder + `<img src="/folder.png"><a title="${folder}/${file.name}" href="${folder}/${file.name}" class="hide">${file.name}</a>`;
  }
// --------------------------------------------------------------
    if (!CurrentFolder) {
    //Then we are at the homepage, viewing all files from other directories.
    $(fileCard).find('header').append(`
      <h1 path="${folder}" style="font-size: 1.0rem">
        <i class="fa fa-folder white"></i><a href="/${Partition + folder}">/${folder}</a>
      </h1>`)
    } if (!file.name.includes('.'))
      $(fileCard).addClass('faulty');
      /*Very rare, this means the file has no extension, but wasn't considered a folder either at the very start, so something's off*/
// --------------------------------------------------------------
  return getMediaType(file, folder, fileCard, sourceLinks);
};


/*===============================================================
  Used exclusively by "displayMedia", this checks what type of content the media of the file suggests (image, text, audio, etc.), and returns the appropriate element tags to best represent it.
===============================================================*/
async function getMediaType (file, folder, fileCard, source) {

  if (checkFileType(file, imageFormats) === true) { //Image
    return `${source}<img class="media-content" id="source" src="/${folder}/${file.name}" alt="">`
// --------------------------------------------------------------
  } else if (checkFileType(file, audioFormats) === true) { //Audio
     return `${source}
     <i class="fa fa-volume-up" style="align-self:center;"></i>
     <img class="media-content audio-pic" src="/audiocircle.gif" class="audio-pic">
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
    let validExtension = allExtensions.filter( (ext) => ext === thisFileExt)
    .join('').replace('.', '') || 'unknown';

    //We get the extension/format of the file, and compare it to all valid extensions the site uploading permits. If it passes, we use the given icon image that represents that file type, which will always be the name of the file extension itself (dll.png, mp3.png, exe.png, etc...), all stored in the back-end resources.
    return `${source}<img class="media-content" src="/${validExtension}.png" style="max-width: 80px !important; border: 0px solid black;"> `;
  }
};


/*===============================================================
  Third most important function here. Whenever the page loads or a user requests all their OWN files, this function will be called on loading a directory, clicking "More Files", or clicking "View My Files". It basically lists the media content of every file, and displays every folder within a 'Card' element.
===============================================================*/
async function listDirectoryContents (evt, all) {
  clearDialog();

  if (AllFiles.count.length < Directory.files.length)
    await AllFiles.add(Directory.files.slice(0, 500), true);

  $('.file-search')[0].value
  ? filesToList = namefinder(Directory.files, 'filter', $('.file-search')[0].value)
  : filesToList = Directory.files.slice(0, 500);
  //If user has search input, only list files that contain the characters input

  let filesListed = 0;

  for (let file of filesToList) {

      if ($(FileTable).children('.ui-draggable').length > AllFiles.count.length || filesListed >= 10)
        break; /*Then we stop listing, to avoid overloading page*/
      else if ($(`div[id="${file.name}"][path="${file.path}"]`)[0] || file.path === 'uploads')
        continue; //Simple, if that file (file card) already exists, don't display it again obviously
      else if (file.stats.mode === 16822) /*Then it's a folder, should always display*/
        filesListed = filesListed;
      else filesListed += 1;

      if (evt && evt.shiftKey || all)
        filesListed --;
      //List all of them, 'filesListed' will remain at 0

      //Each iteration creates a file/folder card, gets any media content, and appends/displays it to the page. No more than 10-15 files are listed/displayd per function call, unless Shift is pressed when More Files is clicked.

      $(FileTable).append(makeFileCard(file, 'uploaded'));
      let fileCard = getFileCard(file);

      await displayMedia(file, file.path, fileCard).then( (fileSource) => {
      //Returns the anchor link and the media elements (IMG, AUDIO or VIDEO), before inserting into the static File Card.
        $(fileSource).insertAfter($(fileCard).children('header'));
        if ($(fileCard).hasClass('folder') || $('.file-search').val())
          $(FileTable).prepend(fileCard);

        if (pathfinder(SelectedFiles.count, 'find', file))
          $(fileCard).addClass('selected');
        //Occasionally, the user may select files from the panel listing (which always shows every file in the directory), while the FileTable is only displaying a few. We need to update them to match the panel selectinos.

      });

  }; //End of For loop going over files

  checkForEmpty();
};


/*===============================================================
//Intensive function. Sends a request, and finds ALL files that belong to the given user, and returns them to the browser to replace the current "Directory.files"
===============================================================*/
async function findAllFiles (evt) {

  await axios.post(`/user/${UserSession.user.uid}`).then( async (res) => {
    if (!res.data.content)
      return false;

    for (let file of AllFiles.count)
      await AllFiles.delete(file);

    if (!Directory.files) {
      //On homepage load, this will trigger.
      Directory.files = res.data.content;
      Directory.packs = [Directory.files.slice(0, 500)];

      for (let i = 0; i < Math.floor(Directory.files.length / 500); i++) {
        let nextindex = (Directory.packs[i].length * Directory.packs.length);
        Directory.packs.push(Directory.files.slice(nextindex, nextindex + 500));
      } //We wish to segregate files into "packs" of 500. The first pack is automatically initiated with the first 500 files, the loop acquires the previous packs length to know which index to begin slice from (incrementally)

      if (Directory.files.length >= 500)
        Flash(['Will not display more than 500 files at a time.', 'will be segregated into groups. Select [Next File Set] to cycle through them'], 'warning', [`${Directory.files.length -500}`]);

    } else {
      //Every SUBSEQUENT trigger of this axios function will put us here. The Directory index aligns with the current file pack index in the Directory, and each time the user selects "Next File Set", it will increment to display next pack.
      Directory.index ++;
      Directory.index = Directory.index % Directory.packs.length;
      //Index cannot surpass number of file packs within directory
      Directory.files = Directory.packs[Directory.index];
      $('#dirIndex').text(`(${Directory.index + 1}/${Directory.packs.length})`);
    }

    await listDirectoryContents(evt).then( () => {
      $('.all-count').text(Directory.files.length);
    })

  }).catch( (error) => Flash(error.message, 'error'));

};


/* ----------------------------------------- */
$('#myItems').click(findAllFiles);
