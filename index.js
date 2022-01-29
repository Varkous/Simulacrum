if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}
const NEW = require('./@NodeExpressAppFrame/N.E.W.js');
const Website = new NEW();
//NEW stands for "Node Express Website". Contains all the fundamental libraries that express generally uses

module.exports = {app, express, path, wrapAsync, fs} = Website;

const session = require('cookie-session');
const child_process = require('child_process');
const compression = require('compression');
const cookieParser = require('cookie-parser');

/*======================================================*/
let partition = process.env.partition || 'public';
const UsersDirectory = process.env.UsersDirectory || 'users';
process.sessionTimers = {};
process.ServerTracker = {status: 1, countdown: null, warning: 'None'}; //Default. Any major problems incur status of 0.
/*======================================================*/


const mobileTags = [ //Identifiers for mobile detection on request
/Android/i,
/webOS/i,
/iPhone/i,
/iPad/i,
/iPod/i,
/BlackBerry/i,
/Windows Phone/i
];
/*======================================================*/
const {Sessions} = require('./controllers/UserHandling.js');
const {WriteLogFilter, ClearTemp, ExitHandler, Compress, CloseServer} = require('./utils/Utilities.js');
const {GetPrimaryDirectories} = require('./controllers/FolderProviders.js');
const {CheckSessionAndURL, worthlessURLS} = require('./utils/RequestCheckers.js');
const {accumulateSize} = require('./scripts/Helpers.js');
const uuid = require('uuid');
/*======================================================*/

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // trust first proxy
}
app.set('', path.join('views'));
app.set('view engine', 'ejs');
// ============================================================
const resourceFolders = [
  express.static(path.join(__dirname, 'base_images')),
  express.static(path.join(__dirname, 'styles')),
  express.static(path.join(__dirname, 'fonts')),
  express.static(path.join(__dirname, 'scripts')),
  express.static(path.join(__dirname, 'filetype_images')),
  express.static(path.join(__dirname, partition)),
  express.static(path.join(__dirname, UsersDirectory)),
] // Make all resources within these folders accessible from any url/directory without needing absolute path
// ============================================================
// console.log(parseInt(process.env.session_time));
const sessionUtilities = [
  cookieParser(),
  session({ //Establishing session prototype, adopted by every user session
      name: 'simulacrum_session',
      secret: process.env.secret,
      keys: [process.env.secret],
      saveUninitialized: true,
      resave: true,
      httpOnly: false,
      //domain: 'skeletonhill.com',
      secure: true,
      maxAge: parseInt(process.env.session_time),
      sameSite: 'strict',
      loginAttempts: 1,
      duration: parseInt(process.env.session_time),
      //duration: 1000 * 1000 * 1000,
    }),
  compression({ filter: Compress }), //Not really sure, but supposedly speeds up load time of pages
  express.json(),
]
// ============================================================
app.use(sessionUtilities);
app.use(resourceFolders);
app.use('/static', express.static(UsersDirectory));
app.use('/static', express.static(partition));


// =========================================================
app.get('/stop/:code', wrapAsync( async (req, res, next) => {
  if (req.params.code === process.env.exit_code) {
    let reason = req.query.reason;
    let time = req.query.time
    return CloseServer(reason, time);
  }

}));
// ----------------------------------------
process.on('uncaughtException', ExitHandler);
process.on('SIGINT', ExitHandler);
process.on('beforeExit', ExitHandler);
// ----------------------------------------


// CloseServer('Routine server refresh');
ClearTemp (path.resolve('temp'));

/*======================================================*/
app.use('*', CheckSessionAndURL, wrapAsync( async (req, res, next) => {

  if (req.session) {
    const {referer} = req.headers;
    let userAgent = JSON.stringify(req.headers['user-agent']);
    let op = req.headers.operation;
    req.mobile = mobileTags.some( (match) => userAgent.match(match)) ? true : false;
    req.session.mobile = true;  // Check if user is on mobile device

    res.locals.UserSession = req.session;
    res.locals.UsersDirectory = UsersDirectory;
    if (referer && res.locals.UserSession.user) {
     if ('login'.isNotIn(referer)) res.locals.UserSession.user.firstVisit = false;
    }

    //User session and user directory info provided to browser
    res.locals.Server = process.ServerTracker;
  }
  return next();
}));
// ============================================================

// ============================================================
app.get('*', wrapAsync(async (req, res, next) => {

  if (!req.session)
    return res.redirect('/signout');

  const url = req.originalUrl;
// ----------
  if (url.includesAny(worthlessURLS))
    return false; // Redundant server request

  if (req.session && req.session.user) {

    if (url.includes(req.session.home) || url === '/') { // Actual request to homepage or directory listing
 
    	const homedirectory = req.session.home.includes(UsersDirectory) ? `${req.session.home}/${req.session.user.name}` : req.session.home;
		//Whenever the user is browsing their own directory, restrict access to only folders that belong to them. We include their name and only search directories under that user name.
		// -----------------------------------------------------------------
		req.session.home === partition ? res.locals.partition = req.session.home + '/' : res.locals.partition = homedirectory + '/'; //If the public partition is the home, use it with no additions. If home is the user's private directory, add their name (by using homedirectory, see if-else condition at the top), so we aren't browsing the USERS directory, and instead just finding contents of ONE folder within Users directory for THIS user.

  		res.locals.rivals = Object.values(Sessions.users)
  		.map( user => user.loggedIn && user.name !== req.session.user.name ? {
  		  name: user.name,
  		  residing: user.residing,
  		  operating: user.operation
  		} : null).filter(Boolean) || [];
  		res.locals.firstVisit = req.session.user.firstVisit || false;
		//The parameter true is for "search", means we are just searching for directory names, not files

  		if (req.originalUrl === '/') res.locals.directory = false;

  		GetPrimaryDirectories(req, homedirectory).then( (primes) => {
  		  res.locals.PrimaryDirectories = primes.filter(Boolean);
  		  if (primes.length) res.locals.totalsize = res.locals.PrimaryDirectories.length > 1 ? res.locals.PrimaryDirectories.reduce(accumulateSize) : res.locals.PrimaryDirectories[0].size;
  		  else res.locals.totalsize = 1;

  		  if (req.session.home === partition) res.locals.UserSession.maxsize = 100e10; // 1 Terrabyte
  		  next();
  		}).catch( err => res.redirect('/login'));
    } else next();
//--------------------------------------------------
  } else next(); //If there was no user, go to next route
}));
// ============================================================

Website.routes.Authentication = require('./routes/auth.js');
Website.routes.FileViewing = require('./routes/file-viewing.js');
Website.routes.FileOperations = require('./routes/file-ops.js');

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
