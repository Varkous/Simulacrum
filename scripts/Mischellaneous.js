'use strict';


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

        const link = getPreviousDirectory();
        $('.fs-modal-message').text(`Current folder ${CurrentFolder === Username || !CurrentFolder ? 'is partition' : 'being deleted'}, redirecting...`);
        $(FS_Modal).show();

        setTimeout( () => changeDirectory(event, link.href), 800);
      }
  //--------------------------------------------------------
  };
};


/*===============================================================
  If the user provides some bullshit folder path, like something with no alphabet letters, reject it.
  And just in case the user left a '/' (or more) at the end OR beginning of folder input, for some misguided reason. Remove them all.
===============================================================*/
function filterInput (input, position) {
  //If 'href' is true, it means we are filtering url not Folder Input

  if (position === 0 || position === -1) {
    while (input.slice(-1) === '/') {
      $(FolderInput).val(input.slice(0, -1));
      input = input === input.slice(0, -1) ? '' : input.slice(0, -1);
    }
  }
  if (position === 0 || position === 1) {
    while (input.slice(0, 1) === '/') {
      $(FolderInput).val(input.slice(1));
      input = input === input.slice(1) ? '' : input.slice(1);
    }
  }
  return input;
};


/*===============================================================
  This function is called when the user clicks the 'View' button above a text-File Card (which holds a <textarea>), or clicks 'View' within a Panel listing. Either one becomes the 'textcontent' which will be cloned and replicated onto the modal.
===============================================================*/
function viewTextInModal (textElement) {
  event.preventDefault();
  event.stopPropagation();
  $(FS_Modal).find('progress').remove();

  $('.modal-image').attr('src', '/upload.gif');
  $('.fs-modal-message').text('').removeClass('view-text view-listing');
  let textcontent = textElement;

  if (textElement.tagName === 'OL') {
    //Then the element is actually an entire panel listing
    $('.modal-image').attr('src', '/listing.png');
    $('ol li').show();
    $('footer').is(':visible') ? $('#overheadPanel').click() : null;
  } else {
    //Then it has to be a textarea element, likely from a textfile. Otherwise it's a PDF viewer object
    textcontent = $(textElement).find('textarea')[0] || $(textElement).find('object')[0] || textElement;
    $('.modal-image').attr('src', '/textdoc.png');
  }

    $('.fs-modal-message').text(textElement.title);
    $(textcontent).clone().show().appendTo('.fs-modal-message').addClass('view-text view-listing').removeClass('hide').css('min-height', '600px');
    //We simply copy the textcontent onto the modal (and remove it later if the modal closes)

    $(FS_Modal).show();
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
async function transferFiles (items, destinationFolder, copy) {

  if (!items) return Flash('Not a valid file', 'error');
  let operation = 'Transfer';

  const data = {
    items: items,
    destination: destinationFolder,
    mydirectory: $('#mydirCheck').is(':checked'),
    copy: copy, //Lets fs on back-end know the files being transferred should be copied
    preferences: JSON.stringify(UserSession.preferences)
  }
  showOperation(operation);

  return await axios({
    method  : 'post',
    url : `/${Partition + destinationFolder}`,
    data : data,
    headers: {
      'Content-Type': 'application/json',
      operation: operation,
    },
  }).then( async (res) => {
  	await checkForServerError(res);
    Flash(res.data.content, res.data.type, res.data.items);

    for (let field in res.data) {
      if (Array.isArray(res.data[field]))
        for (let entry = 0; entry < res.data[field].length; entry++)
          res.data[field][entry] = parseHTML(res.data[field][entry]);
    }; //Normally isn't needed, but the transfer operations actually reference the reported items, so we can't have HTML like <span> elements in there or the items will be useless, so parse them after Flashing them

    if (res.data.type === 'error' || res.data.items.includes('/') && res.data.items.length < 2)
      SelectedFiles.unlist(items);  //If the items have a "/" in them and there is only one item within, it means it was a directory created pre-transfer

    else {
      for (let i = 0; i < res.data.items.length; i++) {
        if (copy === false) {
        //If not copied, we don't want the file (i.e File Card) on the page as it is not within the current folder anymore obviously
        if (res.data.incomplete && namefinder(res.data.incomplete, 'find', res.data.items[i]))
          continue;

          let transfer = {name: res.data.items[i], path: res.data.paths[i]};

          if (CurrentFolder) {
            //If we are in a directory.
            let fileCard = getFileCard(transfer);
            !mobile ? $(fileCard).draggable( 'option', 'revert', false ) : null; //If mobile, drag-and-drop functionality does not exist, so don't bother
            $(fileCard).addClass('fadeout');
            AllFiles.delete(transfer, true);
          } else if (!$('#mydirCheck').is(':checked')) await setTimeout( () => findAllFiles(event, 0), 100); //Otherwise we're at the homepage, and transfers should not signal the deletion of anything, and should just adjust paths (unless user is transferring from public to private)

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
    Directory.files ? await selectAll(Directory.files, true) : null;
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
  Manipulates a preference according to the checkbox (the only input within the dialog box), and then removes all dialog elements and the temporary outbound data if any.
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

  if ($('.progress').val()) {
    $('.progress').show();
    $('.fixed').show();
  }

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
function hideOrShow(element, visible) {

  if (this && this !== window)
    element = this;

  if ($(element).is(':hidden') || visible === true) {
    $(element).show();
  } else $(element).hide();
};


/*===============================================================
  Self-explanatory. Called from within iFrame to hide it in parent, since we only view iframe in fullscreen
===============================================================*/
function closeIframe (evt) {
  $('#viewImage').hide().empty();
  this.parent.$('#viewImage').hide().empty();
  document.exitFullscreen();
}


/*===============================================================
  Changes <iframe> src url to the image that was clicked/touched, embedding the image within and enlarging it to max-width of the image up to the screen width.
===============================================================*/
// $(FileTable).on('mousedown', 'img', );

function viewImage (img) {
    $('#viewImage').empty().show().attr('src', img.src); //The iframe. Empty the contents, "show" it on page, and set url src to the image path on server

    let iFrameImageStyles = `
      width: 100%;
      max-width: ${img.naturalWidth}px;
      max-height: ${img.naturalHeight}px;
      display: block;
      margin: auto;
      overflow: scroll;` //Makes the image stay in center of iFrame screen

    setTimeout( () => { //Needed delay to give document time to render iFrame. Add two event listeners to close iFrame on any button press or mouse click
      $('#viewImage')[0].contentWindow.document.body.innerHTML = `<img src="${img.src}" style="${iFrameImageStyles}">`;
      const iframer = document.getElementById('viewImage');
      iframer.contentWindow.addEventListener('mouseup', closeIframe);
      iframer.contentWindow.addEventListener('keydown', closeIframe);
      iframer.contentWindow.addEventListener('touchend', closeIframe);
    }, 100);

    $('#viewImage')[0].requestFullscreen();
};
