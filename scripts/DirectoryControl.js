'use strict';
/*===============================================================
  Takes a URL, turns into array, removes any element/entry that is the partition name or homepage link
===============================================================*/
function getFolderLayers (url) {
  //Had to do this crap so we can just get the folder layers of current directory, removing the URL and the other nonsense, so we can just get simple folder names
  return url.split('/').filter( (layer) => layer !== "" && layer !== UserSession.home);
}


/*===============================================================
  Creates an artificial invisible anchor link, and creates an href out of the CurrentFolder location (opposite of 'getFolderLayers' above, and then returns link to caller)
===============================================================*/
function getPreviousDirectory() {
  let prevPage = ''
  if (CurrentFolder && Directory.layers) {
    prevPage = CurrentFolder.split('/').slice(0, Directory.layers.length - 1).join('/') || '';
  }
  let link = document.createElement('a');
  link.href = prevPage ? `${window.location.origin}/${Partition + prevPage}` : window.location.origin;
  return link;
}


/*===============================================================
  Any issue/unwanted cancellation that may arise from redirecting will triger this function.
===============================================================*/
function confirmRedirect(url) {
  return dialogPrompt({
    warning: `This will abort any ongoing operations (downloading/uploading). Continue?`,
    responseType: 'confirm',
    proceedFunction: `triggerLink('${url}')`,
  });
}


/*===============================================================
  Collects and redirects any link/anchor location triggered by user to detect if its a "previous" or "next" page, and also turns redirect into a simple get request to retrieve data. This contains multiple exceptions/conditions that may be confusing. Basically, this function determines if it's a download link, empty href, redirect link, or just a data request href, and decides how the current Window will respond do it.
===============================================================*/
async function changeDirectory (evt, link) { //Upon clicking any link (leaving the page), dismiss the entire page body, sending it left or right depending on whether the user is going "forwards" through directories (send it left), or "backwards" (send page right).
try {

  if (this && this.download) { // Download anchor that should trigger like normal
    evt.stopPropagation();
  	return true;
  }
  else if (evt) { // To prevent unwanted redirects/triggers that override this function
  	evt.preventDefault();
    evt.stopPropagation();
  	if (mobile && evt.target && $(evt.target).hasClass('folder-link')) {
    	return false;
    }
  }
// -----------------------------------------------------------------------------------
  let href = filterInput(this ? this.href || link : link || home, -1); //If 'this' does not refer to anchor link, there must be a link that was passed in. Removes end "/".

  if (href && !href.replace(home, '').includes('#') && !$(this).hasClass('search-result')) {
  //If link is blank homepage (#) or search result anchor do not shift the page off screen
    let thisPage = Directory.layers || [];
    let nextPage = getFolderLayers(href.replace(home, ''));
// ------------------------------------------------------ // This block below is for aesthetic purposes only. Determines which direction to dismiss <main> element
    if (UserSession.preferences.smoothTransition) {
      if (href === document.URL || thisPage.last() === nextPage.last())
        window.moveMain = dismissElement('main', 'Y', 'up', '70%', 600, true); //Same page refresh, then start off below screen.
      else if (nextPage.length > thisPage.length)
        window.moveMain = dismissElement('main', 'X', 'left', '50%', 700, true); // We're traversing directory, send left
      else if (thisPage.length > nextPage.length)
        window.moveMain = dismissElement('main', 'X', 'right', '50%', 700, true); //Send it right, we're treading backwards in directory
      else if (thisPage.length === nextPage.length)
        window.moveMain = dismissElement('main', 'Y', 'down', '50%', 1200, true); //Send it down, directory at same depth level
    }
    //Do this regardless
    dismissElement('.logo', 'Y', 'up', '60%', 700, true);
    dismissElement('#panelHeader', 'Y', 'down', '60%', 700, true);
    dismissElement('.directory-stats', 'Y', 'up', '60%', 700);
    dismissElement(MessageLog, 'Y', 'up', '60%', 700, true);
// ------------------------------------------------------ //More important stuff down here. This actually decides how request is handled.
      if (Private && nextPage.join('/') === `${UsersDirectory}/${Username}` || nextPage.join('/') === Username) { //If in private directory, attempts to visit the user folder will go to homepage, since that is presented as the "home" directory
        return $('.progress')[0] ? confirmRedirect(home) : window.location = home;
      }

      else if (href !== home && href !== `${home}/${UserSession.home}` && !document.URL.includes(UserSession.home) && redirect === false) { //If link is not domain homepage, link to partition, or user is not viewing folders through URLs, traverse new directory without redirecting (see retrieveDirectory function)
        document.body.style.overflow = 'hidden';
        return await retrieveDirectory(href + `?traverse=${nextPage.join('/')}`);
      }

      else if (redirect || document.URL.includes(UserSession.home)) {
        return $('.progress')[0] ? confirmRedirect(href) : window.location = href;
      } //If redirect or if partition is in URL, redirect page entirely
      else {
        return $('.progress')[0] ? confirmRedirect(home) : window.location = home;
      }
// ------------------------------------------------------
    } else return false; //Then it was a blank link or search result, cancel
  } catch (err) {
  	revealNextDirectory(CurrentFolder || '/', CurrentFolder);
    return false;
  };
};


/*===============================================================
  Briefly and interminently creates an anchor link, sets url, clicks it then removes it for an artificial redirect or download.
===============================================================*/
function triggerLink (url, download) {
  let link = document.createElement('a');
  link.href = url;
  if (download) link.download = download;
  link.click(); link.remove();
  Requests.cancel('All');
}


/*===============================================================
  Verifies every response received from the server to determine if it includes the 'login' URL, which means it was a failed request that the server tried to redirect to login. Often occurs on session expiration.
===============================================================*/
async function checkForServerError(res, op) {

  let req = res.request
  let problem = false;
  clearDialog();
  document.body.style.overflow = 'visible';
  SelectedFiles.count.filter( f => f.status === op ? delete(f.status) : false); //The current operation is completed, so remove the status indicator from the operand files so they are available for other operations
  $('.closemodal').click();

    if (req.responseURL.includes('/login')) { //Then session expired and redirect attempt to login was made
      triggerLink(req.responseURL);
      problem = true;
    }
    else if (req.response.size || typeof(req.response.size) === 'number') { //Then it's a blob download request, can't do anything with response
      problem = false;
    }
    else if (typeof(res.response) === 'string' && req.response.includes('<!DOCTYPE html>')
    || typeof(res.data) === 'string' && res.data.includes('<head>')) { //Then redirect attempt to error page was made

      /* ----------------------------------------- */
      closeModal(true);
      let errorHTML = $(req.response || res.data); //Get error body
      let errorBody;
      $(errorHTML).each( (i, ele) => {
        if ($(ele).hasClass('cover-background'))
          return errorBody = ele;
      });

      dismissElement('main', 'X', 'left', '60%', 600, true);
      dismissElement('#MessageLog', 'Y', 'up', '100%', 700, true);
      $('.shadow-image').css('filter', 'hue-rotate(110deg)');
      $('.error-display').html($(errorBody));
      document.body.style.overflow = 'hidden';
      document.body.scrollIntoView();

      /* ----------------------------------------- */
      $('#reload').click(() => window.location = '/'); //Dismisses info messages (display directory stats and flash messages) on click
      problem = true;
    } else { //No more problems, remove error block and make CSS adjustments
      $('.error-display').empty();
      $('.shadow-image').css('filter', 'none');
      document.body.style.overflow = 'visible';
      problem = false;
    }

  if (op) $(`.${op}`).remove();

  return problem;
};


/*===============================================================
  Clears current directory/page contents, sends request to retrieve new data and replaces the core variables that store that core data.
===============================================================*/
async function retrieveDirectory (link) {
try {

  let res = await axios.get(link);

  if (await checkForServerError(res)) {
  	if (event) {
      event.preventDefault();
      event.stopPropagation();
  	}
    return false;
  }
  clearTimeout(window.messageLog);
  document.body.style.overflow = 'visible';
  $('.operation-status').show(); // In case user switches directory while operation in effect
  $('#fetchFiles').hide(); // This should only show if no directory is being retrieved
  AllFiles.delete(AllFiles.count);
  StagedFiles.unlist();
  SelectedFiles.unlist();
  $(FileTable).children('.column, .folder').remove();
  const {data} = res;
  Directory = data.Directory;
  UserSession = data.Session;
  Server = data.Server;
  PrimaryDirectories = data.PrimaryDirectories;
  rivals = data.rivals;
  totalsize = data.totalsize;

  await revealNextDirectory(CurrentFolder || '/', Directory.name); //Brings page into view, populates Primary Directory and "Current Directory" depth
  setupDirectory(); //Establishes basic necessary info, flashes report, and then lists all contents of directory

  return res;
} catch (err) {
	console.log(err);
	await revealNextDirectory(CurrentFolder || '/', CurrentFolder);
}
};


/*===============================================================
  Aesthetic purposes only. Displays info showing current directory depth/layers, and returns main elements to view
===============================================================*/
async function revealNextDirectory (prev, next) {

  if (Directory.layers) {

    //-----------------------------------------------------
    $('.current-directory').empty();
    $('.dir-depth').removeClass('dir-depth'); //Any highlighted primary directory
    $('tr').empty(); //Remove all primary directory links
    let prevDirectory = Partition, partitionLink = Partition, topDirectory = Directory.layers.slice(0, 1);
    if (Private) {
      partitionLink = `${UsersDirectory}/${Username}/`;
      topDirectory = Directory.layers.slice(1, 2);
    }
    //Link must include user name (as user folder) if private directory

    for (let i = 0; i < PrimaryDirectories.length; i++) {
      $('tr').append(`
        <td title="${PrimaryDirectories[i].name}">
          <i class="fa fa-folder"></i>
          <a id="directory${i}" class="folder-link taphover" href="/${partitionLink + PrimaryDirectories[i].name}">${PrimaryDirectories[i].name}</a>
        </td>`);
    }
    let parentDirectory = $('tr').children(`[title="${topDirectory}"]`).find('a').addClass('dir-depth');
    //Finds the given primary directory that is parent of current directory
    let directoryDepth = '';
    //-----------------------------------------------------
    let i = 0;
    for (let layer of Directory.layers) { //Final layer is current directory
      if (layer === Directory.layers.last() && layer !== Directory.layers[i + 1]) { //If the current layer equals final layer (and not the next one in case duplicate name)
        $('.current-directory')
        .append(`<i class="fa fa-arrow-right"><i class="fa fa-folder"></i></i><a href="/${prevDirectory + layer}" style="color: white;" disabled>${layer}</a>`);
        // Last index will always be the current directory, if so, self-link and highlight white
      } else {
      $('.current-directory')
      .append(`<i class="fa fa-folder"></i><a href="/${prevDirectory + layer}">${layer}</a>`);
      // Absolute path necessary. All layers minus the current directory will always be the previous folder. UserSession home necessary since "partition" is not accurate when viewing User home
      }
      i++;
      prevDirectory += `${layer}/`; //Each layer is next folder, build on it with previous
      directoryDepth += '.'; //Each '.' represents another layer deep within parent folder/primary directory
    };
    //-----------------------------------------------------
    $(parentDirectory).attr('data-before', directoryDepth);

    //-----------------------------------------------------
    if (UserSession.preferences.smoothTransition) {
      let thisPage = getFolderLayers(prev || '/');
      let nextPage = getFolderLayers(next);


      if (window.moveMain) {

        if (next === prev) window.moveMain = dismissElement('main', 'Y', 'down', '50%', 100); //Same page refresh, then start off below screen.
        else if (nextPage.length > thisPage.length) /**/ {
          window.moveMain.then( () => dismissElement('main', 'X', 'right', '60%', 50)) // Enter screen from right-side.
        } else if (nextPage.length === thisPage.length) /**/ {
          window.moveMain.then( () => dismissElement('main', 'Y', 'down', '60%', 50)) // Enter screen from right-side.
        } else window.moveMain.then( () => dismissElement('main', 'X', 'left', '60%', 50)) // Enter screen from right-side.
      }
     /* ----------------------------------------- */
    }

    dismissElement('.logo', 'Y', 'up', '60%', 700);
    dismissElement('#panelHeader', 'Y', 'down', '60%', 700);
  }
};


/*===============================================================
  All declarations that had to wait for page content/elements/functions to load before execution. This integrates back-end variables such as Session data into the browser for manipulation of page elements.
===============================================================*/
async function setupDirectory() {

  $('.progress')[0] ? $('.fixed').show() : $('.fixed').hide();
  if (Private) {
    $('td').attr('path', Username);
    !CurrentFolder ? CurrentFolder = Username : null;
  }

  Directory.index = 0;
  if (Directory.name) {
    Flash(UserSession.log.last() || `<span style="color: #22a0f4;">${Directory.name}</span> loaded`, 'success');
    // If within a directory, list all files/folders of the directory and their media contents

    for (let rival of rivals) {
      if (rival.residing === Directory.layers[0]) {
        Flash([`<span style="color: green;">${rival.name}</span> is currently browsing within this primary directory <span style="color: #22a0f4;">${Directory.layers[0]}</span>.`,
        `Moving, renaming or deleting files within here is ill-advised`], 'warning');
        break;
      }
    };
    CurrentFolder = Directory.name.getSpaceChars();

    $(FolderInput).val(CurrentFolder);
    $('.view-dir').attr('href', `/${Partition + CurrentFolder}` || '/');
    $('#fetchFiles').hide(); // This should only show if no directory is being retrieved

    if (Server.status === 0) {
      //Just gets shut down timer of Server to warn user
      let currentTime = Math.floor(new Date().getTime() / 60000);
      setTimeout( () => {
        Flash(`<hr> <span style="color: red">Warning: </span> <h1>${Server.warning}: Occuring in ${Math.abs(currentTime - Server.countdown)} minutes</h1>`, 'warning');
      }, 1000);
      //If hardly any time, just redirect them (which will basically log them out)
      if (Math.abs(currentTime - Server.countdown) < 2)
        return window.location = domain;
    }
    listDirectoryContents(event);
  }
  // else if (UserSession.user.residing === '/' || !UserSession.user.residing || !CurrentFolder) {
  else if (UserSession.user.residing === '/' || !UserSession.user.residing || !CurrentFolder
  || Private && CurrentFolder === Username) {
    //If we are at the home partition directory, find all files across all directories (up to max files anyway)
    findAllFiles(event);
  }

  /* ----------------------------------------- */
  if (UserSession.preferences.outsideDir)
    $('.my-dir').click();

/* ----------------------------------------- */
//This crap below was a browser exception soley for Mozilla Firefox, which perpetuated nasty page jerking whenever any file card was hovered over. If we find the browser prefixes have no/hardly any Mozilla features, we apply a conventional hover/show behavior for the file card elements that displays delete/edit/download icons.
  const prefix = (Array.prototype.slice
    .call(window.getComputedStyle(document.documentElement, '')).filter( (style) => style.includes('-moz')));

    if (!prefix || prefix.length < 10) {
      firefox = false;
      $(FileTable).on('mouseover', '.column, .folder', (evt) => $(evt.target).find('.source-icons').show());
      $(FileTable).on('mouseleave', '.column, .folder', (evt) => $(evt.target).find('.source-icons').hide());  //Show
    } else firefox = true;
/* ----------------------------------------- */
};
