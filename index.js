
if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}
const NEW = require('./@NodeExpressAppFrame/N.E.W.js');
const Website = new NEW();
//NEW stands for "Node Express Website". Contains all the fundamental libraries that express generally uses
module.exports = {app, express, path, wrapAsync} = Website;
const session = require('cookie-session');
const fs = require('fs-extra');
const compression = require('compression');

/*======================================================*/
const {Sessions} = require('./controllers/UserHandling.js');
const {WriteLogFilter, CheckSessionAndURL, ClearTemp, ExitHandler, Compress} = require('./controllers/Utilities.js');
const {GetFolderSize} = require('./controllers/FolderProviders.js');
/*======================================================*/
'use strict';

let partition = process.env.partition || 'public';
const UsersDirectory = process.env.UsersDirectory || 'users';
process.sessionTimers = {};
process.ServerTracker = {status: 1, countdown: null, warning: 'None'}; //Default. Any major problems incur status of 0.
const mobileTags = [ //Identifiers for mobile detection on request
/Android/i,
/webOS/i,
/iPhone/i,
/iPad/i,
/iPod/i,
/BlackBerry/i,
/Windows Phone/i
]

// ============================================================
const resourceFolders = [
  session({ //Establishing session prototype, adopted by every user session
      name: 'simulacrum_session',
      secret: process.env.secret,
      saveUninitialized: true,
      resave: true,
      httpOnly: false,
      maxAge: parseInt(process.env.session_time),
      secure: true,
      loginAttempts: 1,
      duration: parseInt(process.env.session_time),
    }),
  express.static(path.join(__dirname, 'base_images')),
  express.static(path.join(__dirname, 'styles')),
  express.static(path.join(__dirname, 'fonts')),
  express.static(path.join(__dirname, 'scripts')),
  express.static(path.join(__dirname, 'filetype_images')),
  express.static(path.join(__dirname, partition)),
  express.static(path.join(__dirname, UsersDirectory)),
] // Make all resources within these folders accessible from any url/directory without needing absolute path
// ============================================================
app.use(compression({ filter: Compress })); //Not really sure, but supposedly speeds up load time of pages
app.set('', path.join('views'));
app.set('view engine', 'ejs');
app.use('/static', express.static(UsersDirectory));
app.use('/static', express.static(partition));
app.use(resourceFolders);

// =========================================================
app.get('/stop/:code', wrapAsync( async (req, res, next) => {

  if (req.params.code === process.env.exit_code) {
    let reason = 'Server shutting down for more maintenance';
    return module.exports.CloseServer(reason);
  }

}));
// ----------------------------------------
process.on('uncaughtException', ExitHandler);
process.on('SIGINT', ExitHandler);
process.on('beforeExit', ExitHandler);
// ----------------------------------------

ClearTemp (path.resolve('temp'));
/*======================================================*/
app.use('*', CheckSessionAndURL, wrapAsync( async (req, res, next) => {

if (req.session) {
 if (process.ServerTracker.status === 0) {
    let currentTime = Math.floor(new Date().getTime() / 60000);
    console.log (Math.abs(currentTime - process.ServerTracker.countdown));
    Math.abs(currentTime - process.ServerTracker.countdown) < 2 ? Sessions.terminate(req) : null;
    //If server is shutting down in less than 2 minutes, terminate user's session
  }
  let userAgent = JSON.stringify(req.headers['user-agent']);
  req.mobile = mobileTags.some( (match) => userAgent.match(match)) ? true : false;

    // req.session.preferences.smoothTransition = req.mobile ? false : true;
    res.locals.Server = process.ServerTracker;
    res.locals.UserSession = req.session;
    res.locals.UsersDirectory = UsersDirectory;
    //User session and user directory info provided to browser
}
  next();
}));
// ============================================================

// ============================================================
app.get('*', wrapAsync(async (req, res, next) => {

  if (!req.session) {
    return res.redirect('/signout');
  }

  if (req.session && req.session.user) {
// -----------------------------------------------------------------
    req.session.home.includes(UsersDirectory) ?
    homedirectory = `${req.session.home}/${req.session.user.name}` :
    homedirectory = req.session.home;

    //Whenever the user is browsing their own directory, restrict access to only folders that belong to them. We include their name and only search directories under that user name.
// -----------------------------------------------------------------
    let PrimaryDirectories = fs.readdirSync(homedirectory, {withFileTypes: true})
    .filter( dir => dir.isDirectory())
    .map(dir => dir.name).map( directory => {
      return new Promise( function (resolve, reject) {

        if (directory[0] === '@' || directory[0] === '$' || directory[0] === '#')
          return resolve (false);
        //Then it's a hidden/reserved/special folder

        let subfolders = [];
        //Grabbing sub-directories along with the stats and items within the given directory
        let dirstats = fs.statSync(`${homedirectory}/${directory}`);
        fs.readdir(`${homedirectory}/${directory}`, async (err, items) => {
          for (let item of items) { /*Check every item*/

            filestats = fs.statSync(`${homedirectory}/${directory}/${item}`);
            dirstats.size += filestats.size;
            dirstats.creator = Sessions.users[`User${dirstats.uid}`].name || 'Admin';

            //Every item's stats are checked, and just their size is returned to be concatenated with the folderStats size (usually 0), so it will ultimately add up the sizes of all present items
            if (String(filestats.mode).slice(0, 2) === '16') /*Then it can't BE a file, so --*/ {
              let folder = item;
              subfolders.push(folder);
            };

          }; //End of second For Loop

          for (let subfolder of subfolders) { /*Remove it from items array*/
            items.splice(items.indexOf(subfolder), 1);
            dirstats.size += await GetFolderSize(req, `${homedirectory}/${directory}/${subfolder}`, 0);
          } //End of third For Loop

        // ------------------------------------------------ //
          return resolve({
            name: directory,
            stats: dirstats,
            files: items,
            folders: subfolders,
          });
          // ------------------------------------------------ //
        }); //Read directory
      }); //Return promise
    }); //Mapping cycle

    // ------------------------------------------------ //
    req.session.home === partition ? res.locals.partition = req.session.home + '/' : res.locals.partition = homedirectory + '/'; //If the public partition is the home, use it with no additions. If home is the user's private directory, add their name (by using homedirectory, see if-else condition at the top), so we aren't browsing the USERS directory, and instead just finding contents of ONE folder within Users directory for THIS user.
    res.locals.PrimaryDirectories = await Promise.all(PrimaryDirectories);
    res.locals.rivals = Object.values(Sessions.users)
    .map( user => user.loggedIn && user.name !== req.session.user.name ? {
      name: user.name,
      residing: user.residing,
      operating: user.operation
    } : null).filter(Boolean) || [];
    res.locals.firstVisit = req.session.user.firstVisit || false;
    //The parameter true is for "search", means we are just searching for directory names, not files

    if (req.originalUrl === '/')
      res.locals.directory = false;
    req.session.user.firstVisit = false;

    next();
//--------------------------------------------------
  } else next(); //If there was no user, go to next route
}));
// ============================================================

// ============================================================
const {Authentication, FileViewing, FileManagement} = require('./routes/routes.js');

Website.routes.Authentication = Authentication;
Website.routes.FileViewing = FileViewing;
Website.routes.FileManagement = FileManagement;
/*======================================================*/
Website.routes.BaseHandlers = Website.makeBaseRoutes(process.env.PORT || 3001, 'directory',
//Normally just put "errorpage" as parameter to create error page, but instead had to pass in function to replace it with alternate functionality'
 app.use(async (err, req, res, next) => {

  const {status = 401, message = "Sigh", stack} = err;

    let anonymous = req.location ? req.location.country : 'Anonymous';
    let user;

    if (req.session)
      user = req.session.user ? req.session.user.name : anonymous;

     if (fs.statSync(`${process.env.infodir}/log.txt`).size < 100000) {
       //If the log file is less than 100 kilobytes, (or we aren't just reporting failed login attempts) continue to write errors to it.
       WriteLogFilter(user, message + '\n\r' + stack)
     }
    return res.render('errorpage', {status, message, stack});
}));


  // =========================================================
  module.exports.CloseServer = async (reason = 'Felt like it', now) => {

    let shutdownTime = new Date().getTime() + parseInt(process.env.exit_time);
    if (now) shutdownTime = 1000;

    process.ServerTracker.status = 0;
    process.ServerTracker.countdown = Math.floor( shutdownTime / 60000); //Convert to minutes
    process.ServerTracker.warning = reason;

    process.shutdown = setTimeout( () => {
      process.exit(0);
      Website.routes.BaseHandlers.server.close( () => console.log ('Server terminated'));

    }, parseInt(process.env.exit_time));
  };
  // =========================================================
