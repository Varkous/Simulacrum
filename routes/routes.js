'use strict';
const {app, path, wrapAsync} = require('../index.js');
const {VerifyUser, ReportData, Sessions, CheckOperation} = require('../controllers/UserHandling.js');
const {AccessDirectory, UploadFiles, Archiver, ChildExec, Rename, IterateDelete} = require('../controllers/FileControllers.js');
const {Geodetect, CapArraySize} = require('../controllers/Utilities.js');
const {GetDirectory, GetAllItems} = require('../controllers/FolderProviders.js');

const fs = require('fs-extra');
const {Hash, Verify} = require('../controllers/Hasher.js');

let partition = process.env.partition || 'uploads';
const UsersDirectory = process.env.UsersDirectory || 'Users_1';

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
  First acquires location of user from req using rapidapi API. If valid IP, display login page
  ======================================= */
  loginPage: app.get('/login', Geodetect, wrapAsync( async (req, res, next) => {
    if (req.session) {
      if (req.session.loginAttempts >= 2) {
      //Technically it's 3, the first login attempt sets it to null (0) rather than 1 for some reason
        req.session.loginAttempts ++;

        Sessions.lock(req, req.body.name);
        return next( new Error("Login attempts exceeded. Get lost."));
      }
    }
    let LoginAttempts = {count: req.session.loginAttempts || 0, message: ''};
    return res.render('login', {LoginAttempts});
  })),

  /* ====================================
  Handler of posted login form data
  ======================================= */
  loginAttempt: app.post('/login', Geodetect, VerifyUser, wrapAsync( async (req, res, next) => {

    res.redirect(req.session.route || '/');
  })),

  /* ====================================
  Signs out posting user
  ======================================= */
  signout: app.get('/signout', wrapAsync( async (req, res, next) => {

    if (req.session.user) {
      Sessions.terminate(req);
      return res.redirect('/login');
    }

    res.redirect(req.session.route || '/');
  })),

  /* ====================================
  Temporary for creating new user accounts
  ======================================= */
  newUser: app.post('/new', Geodetect, wrapAsync( async (req, res, next) => {

    const answers = ["Now that's more like it, Mr. Wayne.",
        "Now that's more like it, Mister Wayne.",
        "Now that is more like it, Mr. Wayne.",
        "Now that is more like it, Mister Wayne."]

    req.session.loginAttempts ++;
    if (checkVariations(req.body.guess, answers)) {
      await Hash(req.body.password).then( (pw) => {

        let user = {
          name: req.body.name,
          password: pw,
          uid: 1,
          admin: false,
          note: req.body.note || '',
          firstVisit: true
        };

        fs.appendFileSync(`${process.env.infodir}/newusers.txt`, JSON.stringify(user), 'utf8');
        let LoginAttempts = {count: req.session.loginAttempts || 0, message: 'Correct. Sending request for new profile.'};
        return res.render('login', {LoginAttempts});
      });

    } else {
      return next(new Error('Nope, wrong answer'));
    }

  })),
}; //--------------- End of authentication routes

module.exports.FileViewing = {
  /* ====================================
  Locates all folders/directories with the user ID passed in, and returns all the files in the response.
  ======================================= */
  allFilesFolders: app.post('/all/:folder', wrapAsync( async (req, res, next) => {

    const homedirectory = req.session.home === UsersDirectory
    ? `${req.session.home}/${req.session.user.name}` : req.session.home;

    if (req.params.folder !== 'undefined')
      homedirectory = homedirectory + `/${req.params.folder}`;


      let items;
      req.session.index = 0;

      if (req.body.query) {
        items = await GetAllItems(homedirectory, [], req.body.query, req);
        return res.send(items);
      }
      else items = await GetAllItems(homedirectory, [], false, req);

      console.log (req.session.index);
      let globalDirectory = {
        name: req.params.folder === 'undefined' ? undefined : req.params.folder,
        path: Sessions.user(req).residing,
        files: items,
        stats: fs.statSync(homedirectory),
        maxindex: Math.floor(req.session.index / 500),
        index: req.body.index
      };
      Sessions.user(req).cache = globalDirectory;
      req.session.index = 0;
      return res.send(globalDirectory);

  })),

  /* ====================================
  Locates all folders/directories with the user ID passed in, and returns all the files in the response.
  ======================================= */
  getNewHomeDirectory: app.get(`/home/:username`, VerifyUser, wrapAsync( async (req, res, next) => {

    req.session.home = req.session.home.includes(UsersDirectory) ? partition : UsersDirectory; //Get directory
    Sessions.user(req).residing = req.session.user.name;
    req.session.user.residing = Sessions.user(req).residing;
    res.redirect('/');

  })),

  /* ====================================
  Most utilized route. Sends the user to the next (or previous) nested folder. Gathers up all directories, their files and stats related to the given folder, and stores all of it within the "directory" object and sends it in the response.
  ======================================= */
  viewFolder: app.get(`/:partition/:folder*`, VerifyUser, wrapAsync( async (req, res, next) => {
    const folder = req.params.folder + req.params[0]; //Get directory
    // const folder = `${req.params.partition}/${req.params.folder}`;
    if (!fs.statSync(path.resolve(req.params.partition, folder)).isDirectory())
      return false;

    if (!req.originalUrl.includes(req.session.home)) return ReportData(req, res, false, {
      content: [`Partition or directory not found`, 'not found'],
      type: 'error',
      items: [folder]
    });

  	req.session.user.firstVisit = false;
  	res.locals.firstVisit = false;
// ----------------------------------------------------------------
    await GetDirectory(folder, req, res)
    .then( (directory) => {
      Sessions.user(req).log.push(`Loaded ${directory.name}`);
      res.locals.UserSession.log = Sessions.user(req).log; //Most recent activity
      // -------------------
      Sessions.user(req).residing = directory.name;
      req.session.user.residing = Sessions.user(req).residing; //What directory user is currently within
      // -------------------
      directory.maxindex = Math.floor(req.session.index / 500);
      directory.index = 0;
      if (Object.values(req.query).length) { //Very sneaky but important. If user simply clicked link a query will be sent within URL, and tell server to maintain "single-page-app" functionality by sending all the data needed for a new directory, and replace the page with that data ...
        return res.send({
          Directory: directory, //The directory found
          Server: process.ServerTracker, //Server status information in case of shut down
          Session: res.locals.UserSession, //UserSession uses SessionStore Class, not the actually request session
          PrimaryDirectories: res.locals.PrimaryDirectories, //All directories retrieved from 'app.use(*)' route handler
          rivals: res.locals.rivals //Very minor, just to warn users of neighboring users' location in case of conflict
        });
        //BUT if they manually typed in URL, load a new page with that data, this time with the URL containing directory input and not just the homepage, serving as a "new" page
      } else return res.render('directory', {directory});

    }).catch( (error) => {
      error.message = 'Directory not found. Check spelling, or refresh primary directory to verify its existence.';
      next(error);
    });
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
      // return await Archiver(req, res, files, userDir);
      return await ChildExec(req, res, files, userDir);
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

    if (!fs.existsSync(oldpath)) //Typo by user, or item was stealth-removed
      return await ReportData(req, res, false, {
        content: ["", "does not even exist, verify path"],
        type: 'error',
        items: [req.body.old]
      });

    else if (stats.uid !== req.session.user.uid) //Item belongs to another user
      return await ReportData(req, res, false, {
        content: ["You do not have permission to alter that item. It belongs to:"],
        type: 'error',
        items: [`<span style="color: green">${Sessions.user(req).name}</span>`]
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
  specificUpload: app.post(`/:partition/:folder*`, CheckOperation, VerifyUser, AccessDirectory, UploadFiles, wrapAsync( async (req, res, next) => {

    let newfolders = req.body.newfolders ? Array.from(req.body.newfolders) : '';
    //Turns into set, which automatically removes duplicates, but Spreads it, so it converts back into an array
    let uploaded = req.files.map( file => file.uploaded ? file.name : null).filter(Boolean);
    let failed = req.files.map( file => !file.uploaded ? file.name : null).filter(Boolean);
// --------------------------------------------------------------------------
    [uploaded, failed] = CapArraySize([uploaded, failed]); //Don't want to list the name of hundreds of files, so if it's more than 15, just get the number

    if (uploaded.length < 1) return ReportData (req, res, false, {
      content: ['Files failed to upload:'],
      type: 'error',
      items: failed || [],
      newfolders: newfolders || '',
    });
    else if (failed.length > 0) return ReportData (req, res, false, {
      content: [`Uploaded ${uploaded} ${newfolders.length ? `along with ${newfolders.length} folders` : ''}. Failed to upload: `],
      type: 'warning',
      items: failed || [],
      newfolders: newfolders || '',
    });
    // -------------------------------------------------
    else return ReportData (req, res, false, {
      content: ['Files uploaded:', newfolders.length ? `along with ${newfolders.length} folders` : ''],
      type: 'success',
      items: uploaded || [],
      newfolders: newfolders || '',
    });
    //The ternary operator values are for one purpose. If lots of files were uploaded/failed, just relay how many (the length). Otherwise, provide each file name.
  // -------------------------------------------------
  })),


  /* ====================================
  Attempts to delete the file(s) specified in req.body.files, checking user permission via middleware first, then we finally hit this route: .
  ======================================= */
  deleteFiles: app.delete(`/delete/:folder*`, VerifyUser, wrapAsync( async (req, res, next) => {

// ------------------------------------------------------------------------------
  let [succeeded, failed] = await IterateDelete(req, res, req.body.files);

    let failedMessage = `<hr>Either they do not exist, or you have no permission to remove them.`;
    if (failed && failed.length === 1) //Single item, just to seem less robotic
      failedMessage = `<hr>Either it does not exist, or you have no permission to delete it.`

    if (!succeeded.length) /*----*/ return ReportData(req, res, false, {
      content: [`Could not remove`, failedMessage],
      type: 'error',
      items: failed
    });
    else if (failed.length && succeeded.length) /*----*/ return ReportData(req, res, false, {
      content: [`${succeeded} deleted successfully.<hr>`, failedMessage],
      type: 'warning',
      items: failed
    });
    else /*----*/ return ReportData(req, res, false, {
      content: [`Deleted:`, ''],
      type: 'success',
      items: succeeded
    });

// ------------------------------------------------------------------------------
  })),
}; //--------------> End of file management/manipulation routes
