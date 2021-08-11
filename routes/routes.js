const {app, path, wrapAsync, AllDirectories} = require('../index.js');
let partition = process.env.partition || 'uploads';
const UsersDirectory = process.env.UsersDirectory || 'Users_1';

const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const {Hash, Verify} = require('../controllers/Hasher.js');

const {VerifyUser, ReportData, Sessions} = require('../controllers/UserHandling.js');
const {AccessDirectory, UploadFiles, Rename, IterateDelete} = require('../controllers/FileControllers.js');
const {Geodetect, CapArraySize} = require('../controllers/Helpers.js');
const {GetDirectory, GetFolderSize, GetAllItems} = require('../controllers/FolderProviders.js');

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

    if (req.session.user) {
      //Then user deliberately made request to login, which means they were attempting to signout
      Sessions.terminate(req.session);
      return res.redirect('/login');
    }
    if (req.session.loginAttempts >= 2) {
    //Technically it's 3, the first login attempt sets it to null (0) rather than 1 for some reason
      req.session.loginAttempts ++;

      Sessions.lock(req.body.name, req.session);
      return next( new Error("Login attempts exceeded. Get lost."));
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
  allFilesFolders: app.post('/user/:uid', wrapAsync( async (req, res, next) => {

    if (req.params.uid != req.session.user.uid) return ReportData(req, res, false, {
      content: ['User ID not correct'],
      type: 'error'
    });

    req.session.home === UsersDirectory
    ? homedirectory = `${req.session.home}/${req.session.user.name}`
    : homedirectory = req.session.home;


    req.body.query ? items = await GetAllItems(homedirectory, [], req.body.query, req)
    : items = await GetAllItems(homedirectory, [], false, req);


    return res.send({content: items})
  })),

  /* ====================================
  Locates all folders/directories with the user ID passed in, and returns all the files in the response.
  ======================================= */
  getNewHomeDirectory: app.get(`/home/:username`, VerifyUser, wrapAsync( async (req, res, next) => {

    if (req.session.home.includes(UsersDirectory)) homefolder = partition;
    else homefolder = UsersDirectory; //Get directory

    req.session.home = homefolder;
    res.redirect('/');

  })),

  /* ====================================
  Most utilized route. Sends the user to the next (or previous) nested folder. Gathers up all directories, their files and stats related to the given folder, and stores all of it within the "directory" object and sends it in the response.
  ======================================= */
  viewFolder: app.get(`/:partition/:folder*`, VerifyUser, wrapAsync( async (req, res, next) => {
    const folder = req.params.folder + req.params[0]; //Get directory

    if (!fs.statSync(`${req.session.home}/${folder}`).isDirectory())
      return false;

// ----------------------------------------------------------------
    await GetDirectory(folder, req, res)
    .then( (directory) => {
      req.session.log.push(`Loaded ${folder}`);
      return res.render('directory', {directory});
    })
    .catch( (error) => {
      error.message = 'Directory not found. Check spelling, or refresh primary directory to verify its existence.';
      next(error);
    });
  })),
}; //--------------- End of File Viewing Routes


module.exports.FileManagement = {
  /* ====================================
  Gathers all files (referenced by the anchor tag hrefs) on the file cards the user selected to download, and compiles them all into a zip before returning it as a download response to the sender/user.
  ======================================= */
  downloadFilesZip: app.post('/zip', wrapAsync( async (req, res, next) => {

    const files = req.body;
    const zip = new AdmZip();

    for (let file of files) {
      filepath = `${req.session.home}/${file.path}/${file.name}`;

      if (fs.statSync(filepath).isDirectory())
        zip.addLocalFolder(filepath);

      else zip.addLocalFile(filepath);
    }

    // zip.writeZip('uploads/output.zip');
    let zipFile = zip.toBuffer();
    res.contentType('blob');
    res.write(zipFile);
    res.end();
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
        items: [`<span style="color: green">${Sessions.users[`User${stats.uid}`].name}</span>`]
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
  specificUpload: app.post(`/:partition/:folder*`, VerifyUser, AccessDirectory, UploadFiles, wrapAsync( async (req, res, next) => {

    let uploaded = [];
    let failed = [];
    let newfolders = Array.from(req.body.newfolders);
    //Turns into set, which automatically removes duplicates, but Spreads it, so it converts back into an array

    newfolders.length < 15
    ? newfolders = newfolders
    : newfolders = `${newfolders.length}`;

    if (req.files.files) {
      //-------
      for (let file of req.files.files) {
        if (!file.name) failed.push(file);
        else uploaded.push(file.name);
      }
      //-------
    }
// --------------------------------------------------------------------------
    [uploaded, failed] = CapArraySize([uploaded, failed]);

    if (uploaded.length < 1) return ReportData (req, res, false, {
      content: ['Files failed to upload:'],
      type: 'error',
      items: failed,
      newfolders: newfolders || '',
    });
    else if (failed.length > 0) return ReportData (req, res, false, {
      content: [`Uploaded ${uploaded}. Failed to upload: `],
      type: 'warning',
      items: failed,
      newfolders: newfolders || '',
    });
    // -------------------------------------------------
    else return ReportData (req, res, false, {
      content: ['Files uploaded:'],
      type: 'success',
      items: uploaded,
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
