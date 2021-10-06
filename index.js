if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}
const NEW = require('./@NodeExpressAppFrame/N.E.W.js');
const Website = new NEW();
//NEW stands for "Node Express Website". Contains all the fundamental libraries that express generally uses
module.exports = {app, express, path, wrapAsync} = Website;
const session = require('cookie-session');
const child_process = require('child_process');
const fs = require('fs-extra');
const compression = require('compression');
/*======================================================*/
let partition = process.env.partition || 'public';
const UsersDirectory = process.env.UsersDirectory || 'users';
process.sessionTimers = {};
process.ServerTracker = {status: 1, countdown: null, warning: 'None'}; //Default. Any major problems incur status of 0.
/*======================================================*/
// Array.prototype.last = function (index) {return index ? this.length - 1 : this[this.length - 1]};
const mobileTags = [ //Identifiers for mobile detection on request
/Android/i,
/webOS/i,
/iPhone/i,
/iPad/i,
/iPod/i,
/BlackBerry/i,
/Windows Phone/i
];
const allExtensions =  [
  '.bat','.apk','.com','.jpg','.jpeg','.exe','.doc','.docx','.docm','.ttf','woff2','.rpp', '.tar', '.html','.z','.pkg','.jar','.py','.aif','.cda','.iff','.mid','.mp3','.flac','.wav','.wpl','.avi','.flv','.h264','.m4v','.mkv','.mov','.mp4','.mpg','.rm','.swf','.vob','.wmv','.3g2','.3gp','.doc','.odt','.msg','.pdf','.tex','.txt','.wpd','.ods','.xlr','.xls','.xls','.key','.odp','.pps','.ppt','.pptx','.accdb','.csv','.dat','.db','.log','.mdbdatabase','.pdb','.sql','.tar','.bak','.cabile','.cfg','.cpl','.cur','.dll','.dmp','.drve','.icns','.ico','.inile','.ini','.info','.lnk','.msi','.sys','.tmp','.cer','.ogg','.cfm','.cgi','.css','.htm','.js','.jsp','.part','.odb','.php','.rss','.xhtml','.ai','.bmp','.gif','.jpeg','.max','.obj','.png','.ps','.psd','.svg','.tif','.3ds','.3dm','.cpp','.h','.c','.C','.cs','.zip','.rar','.7z'
];
module.exports.worthlessURLS = ['/fonts', '/favicon.ico', ...allExtensions];

/*======================================================*/
const {Sessions} = require('./controllers/UserHandling.js');
const {WriteLogFilter, CheckSessionAndURL, ClearTemp, ExitHandler, Compress, CloseServer} = require('./controllers/Utilities.js');
const {GetPrimaryDirectories} = require('./controllers/FolderProviders.js');
const {accumulateSize, getFileSize} = require('./scripts/Helpers.js');
/*======================================================*/

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

ClearTemp (path.resolve('temp'));
/*======================================================*/
app.use('*', CheckSessionAndURL, wrapAsync( async (req, res, next) => {

if (req.session) {
  let userAgent = JSON.stringify(req.headers['user-agent']);
  let op = req.headers.operation;
  req.mobile = mobileTags.some( (match) => userAgent.match(match)) ? true : false;
  req.session.mobile = true;  // Check if user is on mobile device

  res.locals.UserSession = req.session;
  res.locals.UsersDirectory = UsersDirectory;
  //User session and user directory info provided to browser
  res.locals.Server = process.ServerTracker;

}
  next();
}));
// ============================================================

// ============================================================
app.get('*', wrapAsync(async (req, res, next) => {

  if (!req.session)
    return res.redirect('/signout');

  const url = req.originalUrl;
// ----------
  if (url.includesAny(...module.exports.worthlessURLS))
    return false;

  if (req.session && req.session.user) {

    if (url.includes(req.session.home) || url === '/') {
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
		  res.locals.totalsize = res.locals.PrimaryDirectories.length > 1 ? res.locals.PrimaryDirectories.reduce(accumulateSize) : res.locals.PrimaryDirectories[0].size;
		  next();
		});
      } else next();
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
