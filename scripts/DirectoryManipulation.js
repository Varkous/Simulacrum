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
  Collects and redirects any link/anchor location triggered by user to detect if its a "previous" or "next" page, and also turns redirect into a simple get request to retrieve data.
===============================================================*/
async function changeDirectory (evt, link) { //Upon clicking any link (leaving the page), dismiss the entire page body, sending it left or right depending on whether the user is going "forwards" through directories (send it left), or "backwards" (send page right).
try {


  if (this && this.download) return true;
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }
  let domain = window.location.origin;
  let href = filterInput(this ? this.href || link: link || domain, -1); //If 'this' does not refer to anchor link, there must be a link passed in

  if (href && !href.replace(domain, '').includes('#') && !$(this).hasClass('search-result')) {
  //If link is blank homepage (#) or search result anchor do not shift the page off screen

    let thisPage = Directory.layers || ['/'];
    let nextPage = getFolderLayers(href.replace(domain, ''));
    //Check function above for info. This returns an array to show how many "folders deep" client is traversing, and determines if it is lower/higher than previous page

    if (href === document.URL || thisPage.last() === nextPage.last()) window.moveMain = dismissElement('main', 'Y', 'down', '70%', 600, true); //Same page refresh, then start off below screen.
    else if (nextPage.length > thisPage.length) {
      window.moveMain = dismissElement('main', 'X', 'left', '50%', 700, true); // We're traversing directory, send left
    } else if (thisPage.length > nextPage.length)
      window.moveMain = dismissElement('main', 'X', 'right', '50%', 700, true); //Send it right, we're treading backwards in directory
      else if (thisPage.length === nextPage.length)
      window.moveMain = dismissElement('main', 'Y', 'up', '50%', 700, true); //Send it right, we're treading backwards in directory

    //Do this regardless
    dismissElement('.logo', 'Y', 'up', '60%');
    dismissElement('#panelHeader', 'Y', 'down', '60%');
    // dismissElement('.directory-stats', 'Y', 'down', '80%');
    dismissElement(MessageLog, 'Y', 'up', '60%');

    if (UserSession.home === UsersDirectory && nextPage.join('/') === `${UsersDirectory}/${UserSession.user.name}` || nextPage.join('/') === UserSession.user.name) { //If in private directory, attempts to visit the user folder will go to homepage, since that is presented as the "home" directory
      return setTimeout( () => window.location = domain, 300);
    }

    else if (href !== domain && !document.URL.includes(UserSession.home) && redirect === false) {
      console.log ('1');
      return await retrieveDirectory(href + '?fetch');
    } else if (redirect || document.URL.includes(UserSession.home)) {
      console.log ('2');
      return setTimeout( () => window.location = href, 300);
    } else {
      console.log ('tee heck');
      return setTimeout( () => window.location = domain, 300);
    }
  } else return false;
  return window.location = domain;
} catch (e) {
  console.log ('err')
  console.log (e)
}
};


/*===============================================================
  Briefly and interminently creates an anchor link, sets url, clicks it then removes it for an artificial redirect or download.
===============================================================*/
function triggerLink (url, download) {
  let link = document.createElement('a');
  link.href = url;
  link.click(); link.remove();
}


/*===============================================================
  Verifies every response received from the server to determine if it includes the 'login' URL, which means it was a failed request that the server tried to redirect to login. Often occurs on session expiration.
===============================================================*/
async function checkForServerError(res) {
  let req = res.request

    if (req.response.size || typeof(req.response.size) === 'number') { //Then it's a blob download request, can't do anything with response
      return false;
    } else if (req.responseURL.includes('/login')) { //Then session expired and redirect attempt to login was made
      setTimeout( () => triggerLink(req.responseURL), 28000);
      return true;
    }
    else if (typeof(res.response) === 'string' && req.response.includes('<!DOCTYPE html>')
    || typeof(res.data) === 'string' && res.data.includes('<head>')) { //Then redirect attempt to error page was made

      console.log (res, req, req.responseURL);
      /* ----------------------------------------- */
      let errorHTML = $(req.response || req.data); //Get error body
      let errorBody;
      $(errorHTML).each( (i, ele) => {
        if ($(ele).hasClass('cover-background'))
          return errorBody = ele;
      });
      if (!res.config.method.includes('get')) {
        dismissElement('main', 'X', 'left', '60%', 600, true);
      }
      $('.shadow-image').css('filter', 'hue-rotate(110deg)');
      $('.error-display').html($(errorBody));
      /* ----------------------------------------- */
      $('#reload').click(() => window.location = '/'); //Dismisses info messages (display directory stats and flash messages) on click
      return true;
    } else { //No more problems, remove error block and make CSS adjustments
      $('.error-display').empty();
      $('.shadow-image').css('filter', 'none');
      $('.fixed').hide();
      $(FS_Modal).find('progress').remove();
      return false;
    }
  return false;
};


/*===============================================================
  Clears current directory/page contents, sends request to retrieve new data and replaces the core variables that store that core data.
===============================================================*/
async function retrieveDirectory (link) {
  let res = await axios.get(link);

  if (await checkForServerError(res)) {
    console.log ('falsey?');
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
  console.log (res);
  AllFiles.delete(AllFiles.count);
  SelectedFiles.unlist();
  StagedFiles.unlist();
  Directory = res.data.Directory;
  UserSession = res.data.Session;
  Server = res.data.Server;
  PrimaryDirectories = res.data.PrimaryDirectories;
  rivals = res.data.rivals;

  revealNextDirectory(CurrentFolder || '/', Directory.name);
  setupDirectory();

  return res;
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
    if (UserSession.home === UsersDirectory) {
      partitionLink = `${UsersDirectory}/${UserSession.user.name}/`;
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
        .append(`<i class="fa fa-arrow-right"></i><a href="/${prevDirectory + layer}" style="color: white;" disabled>${layer}</a>`);
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
    let thisPage = getFolderLayers(prev || '/');
    let nextPage = getFolderLayers(next);

    if (next === prev) dismissElement('main', 'Y', 'down', '50%', 100); //Same page refresh, then start off below screen.
    else if (nextPage.length > thisPage.length) /**/ {
      window.moveMain.then( () => dismissElement('main', 'X', 'right', '60%', 50)) // Enter screen from right-side.
    } else if (nextPage.length === thisPage.length) /**/ {
      window.moveMain.then( () => dismissElement('main', 'Y', 'down', '60%', 50)) // Enter screen from right-side.
    } else window.moveMain.then( () => dismissElement('main', 'X', 'left', '60%', 50)) // Enter screen from right-side.
   /* ----------------------------------------- */
  }
};


/*===============================================================
  All declarations that had to wait for page content/elements/functions to load before execution. This integrates back-end variables such as Session data into the browser for manipulation of page elements.
===============================================================*/
async function setupDirectory() {

  if (UserSession.home === UsersDirectory) {
    $('td').attr('path', UserSession.user.name);
  }

  Directory.index = 0;
  if (Directory.name) {
    Flash(`<span style="color: #22a0f4;">${Directory.name}</span> loaded`, 'success');
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

    // if (Directory.files.length >= maxfiles)
      // Directory = divideDirectory(Directory);

    listDirectoryContents(event);
  }
  else if (UserSession.user.residing === '/' || UserSession.user.residing === null) {
    // Directory.layers = ['/'];
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
      $(FileTable).on('mouseover', '.column', (evt) => $(evt.target).find('.source-icons').show());
      $(FileTable).on('mouseleave', '.column', (evt) => $(evt.target).find('.source-icons').hide());  //Show
    }
/* ----------------------------------------- */
};
