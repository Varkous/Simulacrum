'use strict';
const {app, path, wrapAsync, fs} = require('../index.js');
const {ReportData} = require('../utils/RequestCheckers.js');
const {VerifyUser, Sessions} = require('../controllers/UserHandling.js');
const {AccessDirectory, Upload, ZipAndDownload, Rename, IterateDelete} = require('../controllers/FileControllers.js');
const {GetCreator} = require('../controllers/FolderProviders.js');
const {CapArraySize, EntryToHTML} = require('../utils/Utilities.js');
const {checkModeType} = require('../scripts/Helpers.js');

const axios = require('axios');
const ytdl = require('ytdl-core');
const mime = require('mime-types');

let partition = process.env.partition || 'public';
const UsersDirectory = process.env.UsersDirectory || 'users';

module.exports = {

  /* ====================================
  Gathers all files (referenced by the anchor tag hrefs) on the file cards the user selected to download, and compiles them all into a zip before returning it as a download response to the sender/user.
  ======================================= */
  downloadFilesZip: app.post('/download', VerifyUser, wrapAsync( async (req, res, next) => {
    try {
      const files = req.body.files;
      const temp = path.resolve('temp'); //Temp directory where all files staged for download go
      const userDir = `${temp}/${req.session.user.name}`; //The user directory that holds THEIR staged files for download, don't want them mixed up with other user's download files
      fs.existsSync(userDir) ? 0 : fs.mkdirSync(userDir); //If user staging directory does not exist, create it
      return await ZipAndDownload(req, res, files, userDir);
      // ------------------------------------------------------------
    } catch (err) { //This is for development, to catch command line errors
      next(err);
    }
  })),

  /* ====================================
  Takes a folder or file submitted by user and attempts to rename it to the given 'new' input
  ======================================= */
  renameItem: app.post('/rename', VerifyUser, wrapAsync( async (req, res, next) => {
    if (req.body.path === partition)
      return  ReportData(req, res, false, {
        content: ["Cannot rename files within public directory"],
        type: 'error'
      });

    let oldpath = path.resolve(req.session.home, req.body.path, req.body.old);
    let newpath = path.resolve(req.session.home, req.body.path, req.body.new);
    let stats = fs.statSync(oldpath);
    let color = checkModeType(stats.mode) === 'folder' ? process.env.folder_color : process.env.file_color;

    if (!fs.existsSync(oldpath)) //Typo by user, or item was stealth-removed
      return await ReportData(req, res, false, {
        content: ["", "does not even exist, verify path"],
        type: 'error',
        items: [req.body.old]
      });

    else if (stats.uid !== req.session.user.uid && stats.uid !== 1024) //Item belongs to another user
      return await ReportData(req, res, false, {
        content: [`You do not have permission to alter <span class="${color}">${req.body.old}</span>. It belongs to:`],
        type: 'error',
        items: [`<span style="color: green">${await GetCreator(stats.uid)}</span>`]
      });

    else if (fs.existsSync(newpath)) //Name already in use
      return await ReportData(req, res, false, {
        content: ["", "is already in use, try something else"],
        type: 'error',
        items: [req.body.new]
      });
//---------------------------------------------------------------
    else return await Rename(req, res, oldpath, newpath);
  })),


  /* ====================================
  If user authentication was granted, and directory access was granted from posting to "/upload", this is the NEXT request, which uploads the files to the folder information stored in req.params.
  ======================================= */
  convertURL: app.post('/convert/:folder*', VerifyUser, wrapAsync( async (req, res, next) => {

   await AccessDirectory(req, req, next);
   let newfolders = req.body.newfolders ? Array.from(req.body.newfolders) : '';
   const {name, url} = req.body;
   const {folder} = req.params;
   let file = {name: name, path: folder};
   let dirpath = path.resolve(req.session.home, folder);


   fs.readdir(dirpath, (err, entries) => { // See if entry already exists
   	entries = entries.map( e => e.substring(e.indexOf('.'), 0)); // Remove extension from each entry, our new file does not have one
  	if (err) return false;
  	else if (entries.includes(file.name))
	  return ReportData(req, res, false, {
        content: [`${EntryToHTML(file, 'darkcyan')} already exists within ${EntryToHTML(folder, '#22a0f4')}, use different file name or different folder`],
        type: 'error'
      });

	// ---------------------------------------------------------------------------------
	new Promise( async (resolve, reject) => {

	  if (url.includesAny('youtube', 'youtu.be')) { //A vast majority of any conversion uploads will likely be from the site YouTube, which throttles data stream requests. Special module and conditions are setup to allow proper retrieval of data.

	    if (!ytdl.validateURL(url)) return reject(new Error(`Failed to acquire video ID from URL`));

	    let info = await ytdl.getInfo(url); // Lots of info indeed
	    file.name = file.name + '.mp4' ; // If user did not list as video, just load as audio data
	    let contentLength = await parseInt(info.formats[0].contentLength); // For browser progress bar

	    if (!contentLength) return reject(new Error(`File info could not be parsed, conversion rejected. Try using file address source, or a different URL`));

	    res.setHeader('content-type', 'application/octet-stream');
  		res.setHeader('content-length', contentLength);
  		res.setHeader('filename', file.name);

	    ytdl(url).pipe(fs.createWriteStream(`${dirpath}/${file.name}`)); // Create file at desginated location
	    ytdl(url).pipe(res) // And also send it to user for download
        .on("finish", () => {
          Sessions.user(req, req.session).operation = false;
          return resolve(true);
        }).on("error", (err) => reject(new Error(`Conversion failed. ${file.name} was not created/uploaded`)));
	 // ---------------------------------------------------------------------------------
	  } else { // This could be an image, some audio file, or video from various other sites.

	    axios.get(url, { responseType: 'stream'}).then( async (result) => {
	      let stream = result.data;

	      let approxLength = parseInt(stream.rawHeaders.get('Content-Length', 1)) || stream._readableState.buffer.head.data.length + stream._readableState.buffer.tail.data.length;
	      let mimetype = stream.rawHeaders.get('Content-Type', 1);
	      let ext = mime.extension(mimetype);

	      if (!ext || ext.includes('html')) return reject(new Error(`Source URL could not find a valid file. Try linking file address`));

	      file.name = `${name}.${ext}`;
	      res.setHeader('content-type', 'application/octet-stream');
	      res.setHeader('filename', file.name);
	      res.setHeader('approx-length', parseInt(approxLength));

	      stream.pipe(fs.createWriteStream(`${dirpath}/${file.name}`));
	      stream.pipe(res).on("finish", () => {
            Sessions.user(req, req.session).operation = false;
            return resolve(true);
          }).on("error", (err) => reject(new Error(`Conversion failed. ${file.name} was not created/uploaded`)));

	    }).catch( err => {
	    	Sessions.user(req, req.session).operation = false;
	    	if (err.response) {
	          err = err.response;
	          if (err.statusMessage = 'Bad Request' || err.rawHeaders.get('Content-Type', 1).includes('html'))
	            return ReportData(req, res, false, {
	              content: ["Invalid source or false URL. File not found", "Use link from file address/source content for URL"],
	              type: "error"
	            });
	    	}
	    	return reject(new Error(`Source not valid. File address must be referenced`));
	    });
	  } // End Of: If not a YouTube URL
  	}).then( (result) => {
  	  Sessions.user(req, req.session).operation = false;
  	}).catch( (err) => {
  		console.log('Promise error', err);
  	    return ReportData(req, res, err);
	}); // End Of: Main promise error
  }); // End Of: Reading targeted directory
  // ---------------------------------------------------------------------------------
  })),

  /* ====================================
  If user authentication was granted, and directory access was granted from posting to "/upload", this is the NEXT request, which uploads the files to the folder information stored in req.params.
  ======================================= */
  specificUpload: app.post(`/:partition/:folder*`, VerifyUser, Upload, wrapAsync( async (req, res, next) => {
  try {

    let newfolders = req.body.newfolders ? Array.from(req.body.newfolders) : '';
    //Turns into set, which automatically removes duplicates, but Spreads it, so it converts back into an array
    const uploaded = [], failed = [], denied = [];
    let filter = req.files.map( async (file) => {
    	if (file.uploaded) {
    	  let fullpath = path.resolve(req.session.home, file.path, file.name);
    	  fs.chown(fullpath, req.session.user.uid, 100, (err) => err ? console.log(err) : false);
    	  file.stats = fs.statSync(fullpath);
    	  return uploaded.push(file);
    	}
    	if (file.failed) return failed.push(EntryToHTML(file, 'red', '<br>'));
    	if (file.denied) return denied.push(EntryToHTML(file, 'yellow', '<br>'));
    })
    await Promise.all(filter).then( async () => {
	    // let uploadedNames = uploaded.length ? uploaded.map( file => file.name) : [];
	    let uploadedNames = Array.from(CapArraySize(uploaded.length ? uploaded.map( file => EntryToHTML(file, 'darkcyan', '<br>')): []));
	    let result = 'success';
	    if (failed.length || denied.length) result = uploaded.length ? 'warning' : 'error'
	    let conditionalMessage = `${uploadedNames.length ? 'Uploaded: ' + uploadedNames.join('') + '</span>' : ''} ${newfolders.length ? `along with ${newfolders.length} folders` : ''}<hr> ${denied.length ? denied.join('') + '<br>Was cancelled. Already exist under another user<hr>' : ''} ${failed.length ? failed.join('') + '</span> Failed to upload, may have been altered or do not exist<hr>' : ''}`
	// --------------------------------------------------------------------------
	    return ReportData (req, res, false, {
	      content: [conditionalMessage], //This giant mess of a content message is simply for aesthetic purposes and clarity on the client side. Depending on differing results between all file uploads, each outcome displays different message
	      type: result,
	      items: [],
	      newfolders: newfolders || '',
	      uploaded: uploaded || [],
	    });
    });
  // -------------------------------------------------
  } catch (err) { return next(err); res.redirect('/login');};
  })),


  /* ====================================
  Attempts to delete the file(s) specified in req.body.files, checking user permission via middleware first, then we finally hit this route: .
  ======================================= */
  deleteFiles: app.delete(`/delete/:folder*`, VerifyUser, wrapAsync( async (req, res, next) => {
   try {
// ------------------------------------------------------------------------------
    let results = await IterateDelete(req, res, req.body.files);
    let items = {deleted: [], failed: [], notFound: [], noPermission: []};
    let type = 'success';

    for (let result of results)
      items[result.status].push(EntryToHTML(result, 'white', '<br>')); //Each result will have a property that matches one of the four arrays above, so clever little trick. Convert each item to a span element with a representative color.

    if (items.failed.length || items.notFound.length || items.noPermission.length)
      type = 'warning' //Determine what theme of message to send

// ------------------------------------------------------------------------------
    let conditionalMessage = `${items.deleted.length ? "Deleted: " + items.deleted.join('') : ""}${items.noPermission.length ? "<hr>No permission to remove: " + items.noPermission.join('') : ""}${items.notFound.length ? "<hr>" + items.notFound.join('') + "Was either moved, or does not exist" : ""}${items.failed.length ? "<hr>Could not delete: <br>" + items.failed.join('') + "Still in use or being edited" : ""}` // Not necessary for functionality. The above is just to provide user with a better-than-shit explanation of what happened during deletion problems.

    return ReportData(req, res, false, {
      content: [conditionalMessage],
      type: type,
      items: results.filter( r => r.status !== 'deleted') || [],
      deleted: results.filter( r => r.status === 'deleted') || []
    });
   } catch (err) {console.log(err)};
// ------------------------------------------------------------------------------
  })),
}; //--------------> End of file management/manipulation routes
