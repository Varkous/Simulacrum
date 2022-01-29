'use strict';
const {app, path, wrapAsync, fs} = require('../index.js');
const {VerifyUser, Sessions} = require('../controllers/UserHandling.js');
const {ReportData, CheckSessionAndURL} = require('../utils/RequestCheckers.js');
const {EntryToHTML} = require('../utils/Utilities.js');
const {GetDirectory, GetAllItems, CreateItem} = require('../controllers/FolderProviders.js');

let partition = process.env.partition || 'public';
const UsersDirectory = process.env.UsersDirectory || 'users';

module.exports = {
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
      });
      
      if (ses.home.includes(partition)) {
      	req.session.home = UsersDirectory;
      	req.session.maxsize = ses.user.guest ? 3 * 1000 * 1000 : 10e10;
      } else {
      	req.session.home = partition;
      	req.session.maxsize = 100e10;
      }

      Sessions.user(req, req.backup).log.push(`Viewing ${EntryToHTML('Private', 'green')} directory`);
      res.locals.UserSession.user.log = Sessions.user(req, req.backup).log;
      console.log(req.session.home);
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
      res.locals.UserSession.user.residing = residing; // Directory user is currently within
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
