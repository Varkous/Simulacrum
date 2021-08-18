
/*===============================================================
  Whenever a "folder icon" is clicked, from the directory lists and the folder cards in the File List, the relative folder name will be added to the folder input form. This is a shorthand wait to add a sub-directory to the file designation as opposed to typing by hand.
===============================================================*/
function inputItemName (anchor) {

  event.preventDefault();
  event.stopPropagation();
  if ($(FolderInput)[0].disabled === true
  || $(this).hasClass('fa-house-user') && !$('#mydirCheck').is(':checked'))
  //Do not add to input if disabled, or user is unchecking the "My Directory" option
    return false;

  let clickedFolder = $(this).next('a').attr('href')  //Basic folder-icon-links
  || $(this).siblings('a').attr('href') || $(anchor).closest('a').attr('href');

  clickedFolder ? clickedFolder = clickedFolder.replace(`/${Partition}`, '')
  : clickedFolder = "";
  //Else every folder link begins with Partition name

  if ($(FolderInput)[0].value == clickedFolder && !$(this).closest('.current-directory')[0])
    return false;
  //No need if the clicked folder is already within input, and the user wasn't trying to reset input to current directory

  else {
    $(FolderInput).val(clickedFolder);
// -------------------------------------
    if ($(this).closest('td')[0]) {
      //Then it's clicking within primary directory listing, and more procedures are necessary, especially if we are within private directory
      if (UserSession.home === UsersDirectory) {
        clickedFolder = clickedFolder.slice(UserSession.user.name.length + 1);
        $('#editPrime').text(clickedFolder);
        $('#primeDirectoryInput').attr('title', clickedFolder);
        $('#primeDirectoryInput').attr('path', UserSession.user.name);
      }  else {
        $('#editPrime').text(clickedFolder);
        $('#primeDirectoryInput').attr('title', clickedFolder);
      }
    }
  }

  $('.view-dir').attr('href', `/${Partition + FolderInput[0].value}`);
};


/*===============================================================
//Either we're searching through folder input, or in the file search. They both need a list to query through, and a view to display results on. File results are the file card elements, folder results are just anchor tags with the directory names.
===============================================================*/
async function itemSearch (evt) {
  this.value ? query = this.value.toLowerCase() : query = '';

  event.preventDefault();
  event.stopPropagation();
  if (!query) {
    //If it was a blank search, reset everything and don't run function
    $(FileTable).children('*').removeClass('fadeout');
    $('li').removeClass('hide').show();
    $('.folder').prependTo(FileTable);
    return false;
  }
  let finds = [];
  let list = $('.all-files').children('.uploaded');
// ---------------------------------------------------------------------------
    if (this && this.id === 'FolderInput') {
      StagedFiles.unlist(StagedFiles.count, true);
      $(FolderInput).val(this.value);
      $('.view-dir').attr('href', `/${Partition + this.value}` || '/');
      view = $(folderSuggestions);
      $(view).empty();
      const found = await axios.post(`/user/${UserSession.user.uid}`, {query: query});
      list = found.data.content;
    } else {
      $('.all-files li').not('.selected').hide();
      if (this.offsetParent === $('main')[0])
        $('.column, .folder').not('.selected').addClass('fadeout');
      //Hide all list items when searching, show matches later (or if input empty)

      view = this.closest('ol') || FileTable;
      list = $('.all-files').children('.uploaded');

    }
// ---------------------------------------------------------------------------
    for (let item of list) {
      item.title ? name = item.title.replace(Partition + '/', '') : name = item.replace(Partition + '/', '');
      //File card has ID so get name that way, otherwise folder listing is just text

      if (name.toLowerCase().includes(query)) {
      // if (name.toLowerCase().slice(0, query.length) === query) {

        if (this.id === 'FolderInput') {
          //Cleans up appearance of links before appension, that's all this is
          let i = Directory.layers[Directory.layers.length - 1]; //This directory
          let styled_link = name.replace(Partition, '').replaceAll('/', '<span class="search-result">/</span>').replace(i, `<span>${i}</span>`); //Find all directories, replace Partition name (don't need it), add a <span> with a slash for folder division clarity, and make current directory white with span as well
          result = `<a href="/${name}" class="search-result" onfocus="inputItemName(this)">${styled_link}</a>`;

          finds.push(result);
          // ----------------------------------------------
        } else finds.push(item); //This means its a file card
      };
    }; //---End of For loop

// ---------------------------------------------------------------------------
      if (this.id === 'FolderInput') {
        $(view).prepend([finds]);
        $(view).html($(view).html().replaceAll(',', ''));
        //Folder suggestions. The whole 'HTML' bit is abunch of links with "," in between, remove them
// ---------------------------------------------------------------------------
      } else {
        $(list).hide();
        $(finds).each( (i, ele) => {
          //5 milisecond timeout so re-population is smoother, instead of 1-2 second freeze before collective display of all elements

            setTimeout( () => {
              if (this.offsetParent === $('main')[0])
                $(`div[id="${ele.title}"]`).prependTo(FileTable).removeClass('fadeout');

                $(ele).show();
            }, 5);
        });
      }
// ---------------------------------------------------------------------------
}; //End of function


/*===============================================================
  Self-explanatory. Brings up the overhead footer panel upon clicking the button. Reverses and sends it back down if clicked again.
===============================================================*/
async function bringUpPanel (evt) {

  if ($('footer').is(':hidden')) {
    $(FileTable).hide();
    $('footer, #exitPanel').show();
    $('#panelHeader').addClass('moveUp');
    $('#overheadPanel').hide();
    setTimeout( () => $('#panelHeader').removeClass('moveUp'), 950);
  //All animations/aesthetics for displaying the overhead panel, or hiding it
  }
  else {
    $('#panelHeader').addClass('moveDown');
    $('#exitPanel').hide();
    setTimeout( () => {
      $('#panelHeader').removeClass('moveDown');
      $('#FileTable').show();
      $('footer').hide();
    }, 950);
    $('#overheadPanel').show();
  }
};


/*===============================================================
  Self explanatory. Takes any given input value and resets it.
===============================================================*/
function clearInput(input) {
  $('.input').removeAttr('disabled').val('');

  if (StagedFiles.count)
  for (let file of StagedFiles.count)
    StagedFiles.unlist(file, true);
}


/*===============================================================
  Triggers whenever a user CTRL+Mouse-Clicks a File Card. This inserts it into the "SelectedFiles.count" array (so that any time a user clicks Delete or DeleteAll or Transfer, any File Cards with the ID of that selected file will be removed/transferred). This function itself though, just adds some CSS to indicate a file card been selected.
===============================================================*/
async function selectFiles (fileCard, all) {

  if (!all && event) { //If 'all' is true, we're on mobile device, and doing multi-file select with double-tap
    if (event.target.tagName === 'I' || event.target.tagName === 'A' || $(event.target).hasClass('changed'))
      return false; //If we're selecting icon within FileTable, downloading, or clicking anchor then no reason to select, could be annoying to user
  }

  let file = {name: fileCard.id || fileCard.title, path: $(fileCard).attr('path')};
  if (!file) return false;

    if (SelectedFiles.count.length && pathfinder(SelectedFiles.count, 'find', file))
      await SelectedFiles.unlist(file);
    //If the currently selected file was found, that means its already selected, which naturally means the user is attempting to UN-select it: So we remove its selection.

    else await SelectedFiles.add(file);
    $('.staged-count').text(`${StagedFiles.count.length || ''}`);

  return;
// ----------------------------------------
};


/*===============================================================

  Occurs when the user double-clicks within a panel-listing to select/unselect all items in that group.
===============================================================*/
async function selectAll (files, all) {

  if ($(event.target).parents('.uploaded')[0]) //Selecting file itself, then stop from propagating
    return false;

  if (mobile || all || event.shiftKey) {
    //"all" is for selecting all given items, regardless if the shift key was pressed
    if (SelectedFiles.count.length)
      return await SelectedFiles.unlist();
    else return await SelectedFiles.add(files);
  }
  if ($(event.target).hasClass('fa-layer-group'))
    return SelectedFiles.count.length ? SelectedFiles.unlist(files) : SelectedFiles.add(files)
};


/*===============================================================
  While holding shift, selects all elements between the current clicked list item, and the most recent previously selected list item
===============================================================*/
function shiftSelect(evt) {

  if (!evt) return false;

  evt.target.tagName !== 'I' ? $('.file-info').remove() : null //Close any displays from clicked file icons
  evt.preventDefault();
  evt.stopPropagation();
  if (!mobile && SelectedFiles.count.length > 1) {

    let lastSelected = SelectedFiles.count[SelectedFiles.count.length - 2]; // Basically only necessary when two files are selected, we need to get the first one before the one we just clicked
    let rootli = $(this).find(`li[title="${lastSelected.name}"]`)[0];
    if (evt.shiftKey) {
      let nextSelected = evt.target;

      for (let li of $(rootli).nextAll('li')) { //Any list items <li> in between last and root select
        if (li === nextSelected)
          break;
        else if ($(li).hasClass('selected'))
          continue;

        selectFiles(li);
      };

    }
  } else return false;
};


/*===============================================================
  Hides media content on "-" icon, redisplays it on "+" icon. Cheap and simple.
===============================================================*/
function resizeCards (zoom) {
  // let sizeIndex = parseInt($('.column').css('max-width'));
  if (zoom) {
    $('.folder img').css('max-width', '150px');
    $('.media-content').addClass('hide');
  }
  else if (!zoom) {
    $('.folder img').css('max-width', '300px');
    $('.media-content').removeClass('hide');
  }
  return false;
};


/*===============================================================
  When clicking the edit icon, turns it to 'changed' and makes it editable. This does not change until the user clicks the icon again to "complete" the change, whereas we call 'renameItem' and submit the edit. This is the only function where "AllFiles.rename" is utilized, which updates all elements and media content where the old name was referenced.
===============================================================*/
async function makeEdit (icon, anchor) {
  event.preventDefault();
  event.stopPropagation();

  let item = anchor; //Then it's a file card
  let li = $(anchor).closest('li')[0] || $(anchor).closest('td')[0];
// -------------------------------------------
  if (item.id && item.tagName !== 'A') {

    //If edit button is clicked in file card, pass task over to the list item in panel and replace elements accordingly (trick function into thinking li was clicked). Performing element mutation/editing within file card was too annoying.
    li = $(`li[title="${item.id}"][path="${$(item).attr('path')}"]`)[0];
    anchor = $(li).find('a')[0];
    icon = $(anchor).next('.fa-edit');

    if ($('#panelHeader').height() < 80)
      $('#overheadPanel').click();
      //If the panel is not already active, bring it up upon editing item
  }

// -------------------------------------------
  if (!$(icon).hasClass('changed')) {
    $(icon).addClass('changed');
    $(anchor).attr('contenteditable', 'true').focus();
    anchor.disabled = true;

// ------------------------------------------
  } else {
    await renameItem (li).then( (res) => {

      if (!res) return false;

      Flash(res.data.content, res.data.type, res.data.items);

      if (res.data.type === 'error') return false;
      if (li.id === 'primeDirectoryInput') return window.location.reload();
      //Then the renaming was through Primary Directories input, too complicated to find all refs, so just reload page
      else {
        res.data.path.name = res.data.path.old;
        //Need 'property' to satisfy file operation functions
        SelectedFiles.unlist(res.data.path);
        AllFiles.rename(res.data.path);
      }
// ------------------------------------------
    }).catch( error => Flash(error.message, 'error'));
    //And regardless...
    $(icon).removeClass('changed');
    $(li).removeClass('changed');
    $(anchor).attr('contenteditable', 'false').text(li.title);
    anchor.disabled = false;
  }
// ------------------------------------------
};


/*===============================================================
  The post request which takes the input provided by the user, finds the li they edited, takes the old naming and new naming and sends them the info for the back-end to deal with before returning the response.
===============================================================*/
async function renameItem (li) {
  event.preventDefault();
  event.stopPropagation();

  if (!$(li).attr('title'))
    return Flash('No item selected to rename', 'error');

  if ($(li).hasClass('changed')) {
    let file = {
      old: $(li).attr('title') || '',
      new: $(li).children('a').text() || '',
      path: $(li).attr('path') || '',
    };

    return await axios.post(`/rename`, file);

  } else return false;

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
