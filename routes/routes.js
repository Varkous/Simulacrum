'use strict';
const {app, path, wrapAsync} = require('../index.js');
const fs = require('fs-extra');

const {VerifyUser, ReportData, Sessions, GetCreator} = require('../controllers/UserHandling.js');
const {AccessDirectory, Upload, ZipAndDownload, Rename, IterateDelete} = require('../controllers/FileControllers.js');
const {Geodetect, CapArraySize, EntryToHTML, CheckSessionAndURL} = require('../controllers/Utilities.js');
const {parseHTML, checkModeType} = require('../scripts/Helpers.js');
const {GetDirectory, GetAllItems, CreateItem} = require('../controllers/FolderProviders.js');
const {Hash, Verify} = require('../controllers/Hasher.js');

const axios = require('axios');
const child_process = require('child_process');
const ytdl = require('ytdl-core');
const mime = require('mime-types');


let partition = process.env.partition || 'public';
const UsersDirectory = process.env.UsersDirectory || 'users';

const checkVariations = (guess, answers) => {
  guess = guess.toLowerCase();

  for (let answer of answers) {
    answer = answer.toLowerCase();
    if (guess === answer || guess.replace(/[',.!?]/g,'') === answer.replace(/[',.!?]/g,'') || guess.includes(answer)) {
      return true;
      break;
    }
  };
 return false;
};
/*======================================================*/
module.exports.Authentication = {

  /* ====================================
  First acquires location of user from req using rapidapi API. If valid IP, display login page. Lots of conditionals required to catch if session is fresh, expired, or populated with user content
  ======================================= */
  loginPage: app.get('/login', Geodetect, wrapAsync( async (req, res, next) => {
	let Server = process.ServerTracker;
	let LoginAttempts;

	if (req.session) {
	  if (req.session.loginAttempts && req.session.loginAttempts >= 2) {
	  //Technically it's 3, the first login attempt sets it to null (0) rather than 1 for some reason
	    req.session.loginAttempts ++;

	    Sessions.lock(req, req.body.name);
	    return next( new Error("Login attempts exceeded. Seek life elsewhere."));
	  }

	  if (req.session.loginAttempts)
	    LoginAttempts = {count: req.session.loginAttempts, message: ''};
	  else LoginAttempts = {count: 0, message: ''};

	  if (req.session.user) {
	  	req.session = null;
	  	await Sessions.terminate(req);
	  } 

	  return res.render('login', {LoginAttempts, Server});
	}
	return res.render('login', {LoginAttempts, Server});
  })),

  /* ====================================
  Handler of posted login form data
  ======================================= */
  loginAttempt: app.post('/login', Geodetect, VerifyUser, wrapAsync( async (req, res, next) => {
  	res.setHeader('set-cookie', [
	  'simulacrum_session; SameSite=Strict; Secure',
	  'simulacrum_session.sig; SameSite=Strict; Secure',
	]);
    res.redirect(req.session.route || '/');
  })),

  /* ====================================
  Signs out posting user and terminates session
  ======================================= */
  signout: app.get('/signout', wrapAsync( async (req, res, next) => {

    if (req.session.user) {
      await Sessions.terminate(req);;
      return res.redirect('/login');
    }

    res.redirect(req.session.route || '/');
  })),

  /* ====================================
  Temporary for creating new user accounts
  ======================================= */
  //newUser: app.post('/new', wrapAsync( async (req, res, next) => {

  //  const answers = ["Now that's more like it, Mr. Wayne.",
  //      "Now that's more like it, Mister Wayne.",
  //      "Now that is more like it, Mr. Wayne.",
  //      "Now that is more like it, Mister Wayne."]

  //  req.session.loginAttempts ++;
  //  if (checkVariations(req.body.guess, answers)) {
  //    await Hash(req.body.password).then( (pw) => {

  //      let user = {
  //        name: req.body.name,
  //        password: pw,
  //        uid: 1,
  //        admin: false,
  //        note: req.body.note || '',
  //        firstVisit: true
  //      };

  //      fs.appendFileSync(`${process.env.infodir}/newusers.txt`, JSON.stringify(user), 'utf8');
  //      let LoginAttempts = {count: req.session.loginAttempts || 0, message: 'Correct. Sending request for new profile.'};
  //      return res.render('login', {LoginAttempts});
  //    });

  //  } else {
  //    return next(new Error('Nope, wrong answer'));
  //  }

  //})),
}; //--------------- End of authentication routes

module.exports.FileViewing = {
  /* ====================================
  Locates all folders/directories with the user ID passed in, and returns all the files in the response.
  ======================================= */
  allFilesFolders: app.post('/all', CheckSessionAndURL, wrapAsync( async (req, res, next) => {
  try {
    let homedirectory = req.session.home === UsersDirectory
    ? `${req.session.home}/${req.session.user.name}` : req.session.home;

      let items;
      req.session.index = 0; //How many files have been looped

      let maxfiles = req.mobile ? 100 : 500; //If mobile device is detected, limit max retrievable files to 100. Otherwise, 500 will do.

      if (req.body.search) {
        items = await GetAllItems(homedirectory, [], req.body.search, req);
        return res.send(items); //Will be sending folder items directly as array
      }
      else items = await GetAllItems(homedirectory, [], false, req);

      let globalDirectory = {
        name: '/',
        path: Sessions.user(req).residing,
        files: items,
        stats: fs.statSync(homedirectory),
        maxindex: Math.floor(req.session.index / maxfiles), //Each number represents another file pack available to query
        index: req.body.index
      };
      req.session.index = 0; //Reset it
      req.session.user.residing = req.session.home === UsersDirectory ? req.session.user.name : '/';
      return res.send(globalDirectory);
  } catch(e) {
	console.log(e);
  }

  })),

  /* ====================================
  Locates all folders/directories with the user ID passed in, and returns all the files in the response.
  ======================================= */
  getNewHomeDirectory: app.get(`/home/:username`, VerifyUser, wrapAsync( async (req, res, next) => {
  	let ses = req.session;
    if (ses && ses.user) {
      if (ses.guest) return ReportData(req, res, false, {
        content: ["Cannot access Public directory as a Guest user"],
        type: 'error'
      })
      if (ses.home.includes(UsersDirectory)) {
      	req.session.home = UsersDirectory;
      	req.session.maxsize = 10e10;
      } else {
      	req.session.home = partition;
      	req.session.maxsize = 100e10;
      }
 
      Sessions.user(req, req.backup).log.push(`Viewing ${EntryToHTML('Private', 'green')} directory`);
      res.locals.UserSession.user.log = Sessions.user(req, req.backup).log;
      return res.redirect('/');
    }

  })),

  /* ====================================
  Most utilized route. Sends the user to the next (or previous) nested folder. Gathers up all directories, their files and stats related to the given folder, and stores all of it within the "directory" object before shipping it to the response.
  ======================================= */
  viewFolder: app.get(`/:partition/:folder*`, VerifyUser, wrapAsync( async (req, res, next) => {
  	const folder = req.params.folder + req.params[0]; //Get directory
  	const fullpath = `${req.session.home}/${folder}`;
    const {query} = req;
// ----------------------------------------------------------------
   try {
   	if (!fs.statSync(path.resolve(fullpath)).isDirectory()) return false;

    if (!req.originalUrl.includes(req.session.home)) return ReportData(req, res, false, {
      content: [`Partition or directory`, 'not found'],
      type: 'error',
      items: [folder]
    });

  	if (query.fetch) return res.send(await CreateItem(req, query.fetch, folder, fullpath));
// ----------------------------------------------------------------
    await GetDirectory(folder, req, res)
    .then( (directory) => {
    	let {log, residing} = Sessions.user(req, req.backup); // Get log from session store (NOT RELIABLE) along with residing location

    	log = !log.length ? res.locals.UserSession.user.log || [] : log || []; // The local variable of Log is always out of sync with the Session store log, so if one was cleared, use the other
      log.push(directory.files.length > 500 ?
      `${directory.name} exceeds the stable file capacity (${EntryToHTML(500, 'darkcyan')}). Listing all items is not advised. Relocate files to sub-directories if possible`
      : `${EntryToHTML(directory.name, '#22a0f4')} loaded `);  // Warn the user of current directory size if large, otherwise normal statement
      // -------------------
      residing = directory.name;
      req.session.user.residing = residing; // Separate from UserSession sent to locals
      res.locals.UserSession.user.residing = residing; // What directory user is currently within
      res.locals.UserSession.user.firstVisit = false; // Should only occur once
      res.locals.UserSession.user.log = log; // Actual session cannot maintain this, ends up exceeding the 4000 KB limit
      // -------------------
      if (query.traverse) { //Very sneaky but important. If user simply clicked link, a query will be sent within URL, and tell server to maintain "single-page-app" functionality by sending all the data needed for a new directory, and replace the page with that data ...
        return res.send({
          Directory: directory, //The directory found
          Server: process.ServerTracker, //Server status information in case of shut down
          Session: res.locals.UserSession, //UserSession uses SessionStore Class, not the actual request session
          PrimaryDirectories: res.locals.PrimaryDirectories, //All directories retrieved from 'app.use(*)' route handler
          rivals: res.locals.rivals, //Very minor, just to warn client of neighboring users' location in case of conflict
          totalsize: res.locals.totalsize //Very minor, just to warn client of neighboring users' location in case of conflict
        });
        //BUT if they manually typed in URL, load a new page with that data, this time with the URL containing directory input and not just the homepage, serving as a "new" page. Call this a "redirect".
      } else return res.render('directory', {directory});

    }).catch( (error) => {
    	console.log(error);
      error.message = 'Directory not found. Check spelling, or refresh primary directory to verify its existence.';
      next(error);
    });
  } catch (err) { next(new Error('Directory not found. Was renamed, moved or does not exist'))}
  })),
}; //--------------- End of File Viewing Routes


module.exports.FileManagement = {

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
