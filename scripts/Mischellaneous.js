'use strict';
const CancelToken = axios.CancelToken;
const Requests = {
	cancel: function (op, res) {
		if (this[op]) {
		  this[op]();
		  this[op] = false;
		  $('.' + op) ? $('.' + op).remove() : false; // Any progress bar of that operation
		  if (res && res.data && !res.data.uploaded) 
			StagedFiles.unlist(StagedFiles.count, true); // Only unlist staged files if a successful upload request was NOT returned (we still need the Staged Files for reference after upload)
		} else if (op === 'All') { // Halt all request operations
		    for (let op of Object.keys(this))
		      op !== 'cancel' ? this.cancel(op) : null;
		} else {
		  this[op] = false;
		  $('.' + op) ? $('.' + op).remove() : false; // Any progress bar of that operation
		}
	},
	Download: false,
	Upload: false,
	Transfer: false,
	Delete: false,
	Convert: false,
	General: false
};

/*===============================================================
  Called on page load and every time a file is submitted or deleted, to see if there are any files listed. If not, hide the panel header and buttons since they serve no purpose in an empty directory. If a directory becomes empty, we automatically delete and re-direct out.
===============================================================*/
async function checkForEmpty(canDelete) {

  if (AllFiles.count.length || StagedFiles.count.length) {
    $(FileTable).children('p').text('');
    $('#panelHeader').show();
  } else {
    $(FileTable).children('p').text('No Files or Folders uploaded.');
    $('#panelHeader').hide();

      if (canDelete && !$('.progress')[0]) {
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

  if (position === 0 || position === -1) { // Removes any "/" at the END of input string
    while (input.slice(-1) === '/') {
      $(FolderInput).val(input.slice(0, -1));
      input = input === input.slice(0, -1) ? '' : input.slice(0, -1);
    }
  }
// ----------------------------------  
  if (position === 0 || position === 1) { // Removes any "/" at the START of input string
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

  $('.modal-image').attr('src', '/upload.gif'); // Default
  $('.fs-modal-message').text('').removeClass('view-text view-listing');
  let textcontent = textElement; // Text element could be a textarea, panel listing, or the default upload pic + progress bar

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
  Determines if the error returned a 404, which means the request was rejected due to absence of Session (means it has expired, so we trigger login).
===============================================================*/
function checkError(error) {
 if (error && error.message && error.message.includes('404')) {
   Requests.cancel('All');
   return window.location = '/login';
 }
}
  

/*===============================================================
  Manipulates a preference according to the checkbox (the only input within the dialog box), and then removes all dialog elements and the temporary outbound data if any.
===============================================================*/
function clearDialog(fileStorage) {
  $('.steady-glow').removeClass('steady-glow');

  if (fileStorage) { // If any outbound data is currently stored, wipe it, will bloat up memory
    Outbound[`${fileStorage}`] = [];
    Outbound.size = 0;
  }

  let pref = $('.dialog-box').find('input')[0] || null;

  if (pref)
    UserSession.preferences[`${pref.id}`] = $(pref).is(':checked');

  $('.dialog-cover').hide();
  $('.dialog-box').empty();
  document.body.style.overflow = 'visible';
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
  Clears the modal, checks if user is viewing panel listing, and removes the text if the modal is being used to view a text file.
===============================================================*/
function closeModal(force) {

  if (!event && !force)
    return false;

  if ($('.progress').val()) { //For showing the fixed overhead progress bar if modal is cleared
    $('.progress').show();
    $('.fixed').show();
  }
  if (force && !event) return $('.modal').hide();
  
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
function viewImage (img) {
    // $('#viewImage').empty().show().attr('src', img.src); //The iframe. Empty the contents, "show" it on page, and set url src to the image path on server
    $('#viewImage').empty().show(); //The iframe. Empty the contents, "show" it on page, and set url src to the image path on server

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
      // All variations to close the Iframe, on some devices only one method works
    }, 100);

    $('#viewImage')[0].requestFullscreen();
};


/*===============================================================
  Sends URL to be parsed and transformed into stream on back-end. Creates file in given location, and also streams it to client for download upon completion.
===============================================================*/
  $('#convertForm').submit( async function (evt) {
   try {	
	evt.preventDefault();
    let operation = 'Convert';
    let folderChoice = $(FolderInput).val() || CurrentFolder;
 
    if (!folderChoice.length)
      return Flash('No folder targeted for upload destination, check input', 'error');
// ------------------------------------------------------
    else if (await showOperation(operation)) {

      let newfile = { // Form Data was not sufficient, difficulties sending to back-end
    	url: $(this).children('.input')[0].value,
    	name: $(this).children('.input')[1].value,
      }
// ------------------------------------------------------
      axios.post(`/convert/${folderChoice}`, newfile, {
        headers: {
          'Content-Type': 'application/json', // Else back-end does not recognize it
          operation,	
        },
        responseType: 'blob', // Expecting downloadable buffer
        accept: 'application/json', // In case of report message
        cancelToken: new CancelToken( (c) => Requests.Convert = c),
        onDownloadProgress: progress => {
          let total = progress.srcElement.getResponseHeader('content-length') || progress.srcElement.getResponseHeader('approx-length'); // Sometimes back-end content length will be off, need approximation for backup
	      let percentCompleted = (progress.loaded / total) * 100;
	      percentCompleted !== Infinity ? $(`.progress.${operation}`).val(`${percentCompleted}`) : $(`.progress.${operation}`).val(0);
	    }
      }).then( async (res) => {
        if (await checkForServerError(res, operation))	
          return false;
          
        if (res.data.type.includesAny('json', 'text', 'plain', 'html')) { // This means there was a report error
          let report = JSON.parse(await res.data.text()); // Blob is within data, so need to find report within text
      	  return Flash(...Object.values(report));
      	} else {
      	  let filename = res.headers.filename || newfile.name; // File name with extension sent as header from back-end
      	  Flash([`Successfully converted and uploaded <span class="darkcyan">${filename}</span> to <span class="dimblue">${folderChoice}</span>`, 'Reload directory to view it'], 'success');
          const downloadUrl = URL.createObjectURL(res.data); //Blob href
          triggerLink(downloadUrl, filename);
      	}
      })
      .catch( (error) => {
        Requests.cancel('Convert');
        if (axios.isCancel(error))
          Flash(operation + ' aborted', 'warning');
	    else Flash([error.message], 'error');
          return false;
      });
// ------------------------------------------------------
    } else return false;
   } catch (err) {console.log(err)}
  });
