'use strict';
/*===============================================================
  Whenever a "folder icon" is clicked, from the directory lists and the folder cards in the File List, the relative folder name will be added to the folder input form. This is a shorthand wait to add a sub-directory to the file designation as opposed to typing by hand.
===============================================================*/
function inputItemName (anchor) {

  !mobile && event ? event.preventDefault() : false;
  event ? event.stopPropagation() : false;
  
  if ($(FolderInput)[0].disabled === true || $('#mydirCheck').is(':checked')
  || $(this).hasClass('fa-house-user') && !$('#mydirCheck').is(':checked'))
  //Do not add to input if disabled, if "My Directory" is checked, or user is unchecking the "My Directory" option
    return false;

  let clickedFolder = $(this).next('a').attr('href')  //Basic folder-icon-links
  || $(this).siblings('a').attr('href') || $(anchor).closest('a').attr('href') || $(this).attr('href');

  clickedFolder = clickedFolder ? clickedFolder.replace(`/${Partition}`, '') : "";
  //Else every folder link begins with Partition name

  if ($(FolderInput)[0].value == clickedFolder && !$(this).closest('.current-directory')[0])
    return false;
  //No need if the clicked folder is already within input, and the user wasn't trying to reset input to current directory

  else {
    $(FolderInput).val(clickedFolder);
// -------------------------------------
    if ($(this).closest('td')[0]) {
      //Then it's clicking within primary directory listing, and more procedures are necessary, especially if we are within private directory
      if (Private) {
        clickedFolder = clickedFolder.slice(Username.length + 1); //Name and "/" are not needed for prime input
        $('#editPrime').text(clickedFolder);
        $('#primeDirectoryInput').attr('title', clickedFolder);
        $('#primeDirectoryInput').attr('path', Username);
      } else {
        $('#editPrime').text(clickedFolder);
        $('#primeDirectoryInput').attr('title', clickedFolder);
      }
    }
  }

  $('.view-dir').attr('href', `/${Partition + FolderInput[0].value}`);
  return false;
};


/*===============================================================
//Either we're searching through folder input, or in the file search. They both need a list to query through, and a view to display results on. File results are the file card elements, folder results are just anchor tags with the directory names.
===============================================================*/
async function startQuery (evt) {
  evt.preventDefault();
  evt.stopPropagation();
  clearTimeout(window.input);

  let query = filterInput(this.value ? this.value.toLowerCase() : '', 1);
  //Remove any bullshit "/" the user puts in folder input

  if (!query) {
    //If it was a blank search, reset everything and don't run function
    $(FileTable).children('*').removeClass('fadeout');
    $('li').removeClass('hide').show();
    $('.folder').prependTo(FileTable);
    return false;
  }
// ---------------------------------------------------------------------------
    if (this && this.id === 'FolderInput') { //If we're searching folder input

	  StagedFiles.unlist(StagedFiles.count.filter(file => !file.uploading), true);
      $(FolderInput).val(this.value);
      let autoInput = Private ? Username : `${UsersDirectory}/${Username}`;
      let queryCheck = this.value.slice(0, autoInput.length);

      if (Private && queryCheck !== autoInput || $('#mydirCheck').is(':checked')
      && queryCheck !== autoInput) {
        $(FolderInput).val(autoInput);
      }
      $('.view-dir').attr('href', `/${Partition + this.value}` || '/');

      $(folderSuggestions).empty(); //Clears any previous folder link search results
      window.input = await setTimeout( async () => { //Creates a small delay before posting, in case user is quickly typing input
        await axios.post(`/all`, {search: query}).then( async (res) => { //Makes the request to get the folder data
          if (await checkForServerError(res))
            return false;
          else return itemSearch(res.data || [], $(folderSuggestions), query, this);
        });
      }, 500);
    } else { //Then it's a file search, anything that's uploaded (and not selected) will be initially hidden
      $('.all-files li').not('.selected').hide();
      if (this.offsetParent === $('main')[0])
        $('.column, .folder').not('.selected').addClass('fadeout');
      //Hide all list items when searching, show matches later (or if input empty)

      const view = this.closest('ol') || FileTable;
      const list = $('.all-files').children('.uploaded');
      return itemSearch(list, view, query, this);
    }
}; //End of function


/*===============================================================
  Self-explanatory. Brings up the overhead footer panel upon clicking the button. Reverses and sends it back down if clicked again.
===============================================================*/
async function itemSearch(list, view, query, searchInput) {
  let finds = [];
  // ---------------------------------------------------------------------------
  if (list.length) {
    for (let item of list) {
      item.title ? name = item.title.replace(Partition + '/', '') : name = item.replace(Partition + '/', '');
      //File card has ID so get name that way, otherwise folder listing is just text

      if (name.toLowerCase().includes(query)) {

        if (searchInput.id === 'FolderInput') {
          //Cleans up appearance of links before appension, that's all this is
          let i = Directory.layers ? Directory.layers.last() : '/'; //This directory
          let styled_link = name.replace(Partition, '').replaceAll('/', '<span class="search-result">/</span>').replace(i, `<span>${i}</span>`); //Find all directories, replace Partition name (don't need it), add a <span> with a slash for folder division clarity, and make current directory white with span as well
          let result = `<a href="/${name}" class="search-result" onclick="inputItemName(this)" onfocus="inputItemName(this)">${styled_link}</a>`;

          finds.push(result);
          // ----------------------------------------------
        } else finds.push(item); //This means its a file card
      }
    }; //---End of For loop

// ---------------------------------------------------------------------------
      if (searchInput.id === 'FolderInput') {
        $(view).prepend([finds]);
        $(view).html($(view).html().replaceAll(',', ''));
        //Folder suggestions. The whole 'HTML' bit is abunch of links with "," in between, remove them
// ---------------------------------------------------------------------------
      } else {
        $(list).hide();
        $(finds).each( (i, ele) => {
          //5 milisecond timeout so re-population is smoother, instead of 1-2 second freeze before collective display of all elements

          setTimeout( () => {
            if (searchInput.offsetParent === $('main')[0])
              $(`div[id="${ele.title}"]`).prependTo(FileTable).removeClass('fadeout');

              $(ele).show();
          }, 5);
        });
      }
    } else return false;
  // ---------------------------------------------------------------------------
}


/*===============================================================
  Self-explanatory. Brings up the overhead footer panel upon clicking the button. Reverses and sends it back down if clicked again.
===============================================================*/
async function bringUpPanel (evt) {

  if ($('footer').is(':hidden')) {
    $(FileTable).hide();
    $('footer, #exitPanel').show();
    $('body').css('overflow-y', 'hidden');
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
      $('body').css('overflow-y', 'auto');
      $('#FileTable').show();
      $('footer').hide();
    }, 950);

    $('#overheadPanel').show();
  }
};


/*======================================================f=========
  Triggers whenever a user clicks a File Card, Panel list item, or drag-selects over file Cards. This inserts it into the "SelectedFiles.count" array (so that any time a user clicks Delete or Transfer, any File Cards with the ID/Path of that selected file will be removed/transferred). This function itself though, just adds some CSS to indicate a file card been selected.
===============================================================*/
async function selectFiles (evt, all) {
  //Target to be selected will either be the event target, evt itself, or THIS
  
  if (firefox) { //Same bullshit padding fix, so screen isn't jostling around every time an item is selected (is scaled)
    $('main').css('padding', '1.1%');
    setTimeout( () => $('main').css('padding', '1%'), 500);    	
  }

  let target = evt.target ? evt.target : evt;
  target = target.getAttribute('size') ? target : this; //"size" attribute will only be present on File items, the elements we want

  if (!all && target) { //If 'all' is true, we're on mobile device, and doing multi-file select with double-tap
    if (target.tagName === 'I' || $(target).closest('a').attr('contenteditable') || $('.file-info').is(':visible'))
      return false; //If we're selecting icon within FileTable, downloading, clicking file-info, or clicking editable anchor then no reason to select, could be annoying to user
  }

  let name = target.id || target.title;
  let file = {name: name, path: $(target).attr('path'), size: $(target).attr('size') || 0}; //Sometimes 'this' refers to the given link clicked, other times it must use the event.target or event itself to find the item selected

  if (!file) return false;

    if (SelectedFiles.count.length && pathfinder(SelectedFiles.count, 'find', file)) 
      await SelectedFiles.unlist(file);
    else await SelectedFiles.add(file);
    //If the currently selected file was found, that means its already selected, which naturally means the user is attempting to UN-select it: So we remove its selection.
    
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
      let nextSelected = evt.target.tagName === 'LI' ? evt.target : $(evt.target).closest('li')[0];

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
  Any time file-icon is clicked, its parent will always be uploaded file card or LI. Find the given directory file with the name and path of that element, collect its essential stats, and place those into hover-display element for user
===============================================================*/
function showFileInfo (evt) {

  evt.preventDefault();
  evt.stopPropagation();

  let fileCard = $(this).parents('.queued')[0] || $(this).parents('.uploaded')[0] || $(this).parents('.folder')[0] // <LI> or File Card
  let status;
  let item = {
    name: fileCard.id || fileCard.title,
    path: $(fileCard).attr('path') || 'TBD'
  } //Name and path attribute is all we need
  
  if ($(`.file-info[title="${item.name}/${item.path}"]`)[0]) return $('.file-info').remove(); //Then info is already being displayed, close it (by returning and not continuing function)
  $('.file-info').remove(); //Remove any previous displays
// ---------------------------------------------------------- 
  if ($(fileCard).hasClass('queued')) { //Staged file
    item.stats = pathfinder(StagedFiles.count, 'find', item).stats;
    status = 'Last Modified';
  } else { // Uploaded file or folder
    item.stats = pathfinder(Directory.files, 'find', item).stats;
    item.children = pathfinder(AllFiles.count, 'find', item).children || null;
    status = 'Uploaded';
  }
  $(fileCard).prepend(presentFileStats(item, item.stats, status))

  return false;
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