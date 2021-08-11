if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}
const NEW = require('../@NodeExpressAppFrame/N.E.W.js');
const Website = new NEW();
//NEW stands for "Node Express Website". Contains all the fundamental libraries that express generally uses
module.exports = {app, express, sessions, path, wrapAsync} = Website;

app.set('', path.join('views'));
app.set('view engine', 'ejs');
const fs = require('fs-extra');
const FileUpload = require('express-fileupload');


const allExtensions =  [
  '.bat','.apk','.com','.jpg','.jpeg','.exe','.doc','.docx','.docm','.rpp','.html','.z','.pkg','.jar','.py','.aif','.cda','.iff','.mid','.mp3','.flac','.wav','.wpl','.avi','.flv','.h264','.m4v','.mkv','.mov','.mp4','.mpg','.rm','.swf','.vob','.wmv','.3g2','.3gp','.doc','.odt','.msg','.pdf','.tex','.txt','.wpd','.ods','.xlr','.xls','.xls','.key','.odp','.pps','.ppt','.pptx','.accdb','.csv','.dat','.db','.log','.mdbdatabase','.pdb','.sql','.tar','.bak','.cabile','.cfg','.cpl','.cur','.dll','.dmp','.drve','.icns','.ico','.inile','.ini','.info','.lnk','.msi','.sys','.tmp','.cer','.ogg','.cfm','.cgi','.css','.htm','.js','.jsp','.part','.odb','.php','.rss','.xhtml','.ai','.bmp','.gif','.jpeg','.max','.obj','.png','.ps','.psd','.svg','.tif','.3ds','.3dm','.cpp','.h','.c','.C','.cs','.zip','.rar','.7z'
];
const worthlessURLS = ['/fonts', '/favicon.ico', ...allExtensions];

/*======================================================*/
const {Sessions} = require('./controllers/UserHandling.js');
const {WriteLogFilter} = require('./controllers/Helpers.js');
const {GetDirectory, GetFolderSize, GetAllItems} = require('./controllers/FolderProviders.js');
/*======================================================*/


/*====== For uploading files (particularily images and videos) to a CDN or database =======*/
let partition = process.env.partition || 'public';
const UsersDirectory = process.env.UsersDirectory || 'users';
const AllDirectories = GetAllItems(process.env.partition, [], true);
process.sessionTimers = {};


// ============================================================
const resourceFolders = [
  sessions({
      name: 'user_session',
      secret: process.env.secret,
      saveUninitialized: true,
      resave: false,
      httpOnly: true,
      loginAttempts: 1,
      cookie: {
        path: '/',
        _expires: (10 * 60 * 1000), //Just manipulate the first number, which is set in minutes.
        originalMaxAge: (10 * 60 * 1000),
      },
    }),
  express.static(path.join(__dirname, 'base_images')),
  express.static(path.join(__dirname, 'styles')),
  express.static(path.join(__dirname, 'fonts')),
  express.static(path.join(__dirname, 'scripts')),
  express.static(path.join(__dirname, 'filetype_images')),
  express.static(path.join(__dirname, partition)),
  express.static(path.join(__dirname, UsersDirectory)),
]
app.use('/static', express.static(UsersDirectory));
app.use('/static', express.static(partition));
app.use(resourceFolders);
app.use(FileUpload());


/*======================================================*/
app.use('*', wrapAsync( async (req, res, next) => {

    // req.session.user = {name: 'Stroggon', uid: 0, admin: true};
    // req.session.log = req.session.log || [];
    //   req.session.preferences = {
    //     outsideDir: false,
    //     emptyDir: false,
    //     smoothTransition: true,
    //     deleteCheck: true,
    //     uploadWarning: true,
    //   };
    // req.session.home = partition;
    // req.session.loginAttempts = 0;

  const url = req.originalUrl;

  if (worthlessURLS.find( skip_url => url.includes(skip_url)))
    return next();
  //These are unnecessary requests made by browser, dismiss them unless we want the icons
  if (url === '/' + partition || url === '/' + UsersDirectory)
    return res.redirect('/');
  //Homepage represents top-level partition, so redirect there if they are input as url


  if (!req.session.user && url !== '/login') {
    //If no user session present and they aren't requesting to login, redirect them automatically
    req.session.route = url || '/';
    return res.redirect('/login');
  }
  req.session ? res.locals.UserSession = req.session : null;
  if (req.session.user) res.locals.UsersDirectory = UsersDirectory;
  else res.locals.UsersDirectory = null;
  //User session and user directory info provided to browser

  next();
}));
// ============================================================

// ============================================================
app.get('*', wrapAsync(async (req, res, next) => {
  const url = req.originalUrl;

  if (worthlessURLS.find( skip_url => url.includes(skip_url)))
    return false;

  if (req.session.user && req.originalUrl !== '/login') {
    const firstVisit = false;
    // const firstVisit = Sessions.users[`User${req.session.user.uid}`].firstVisit;
// -----------------------------------------------------------------
    req.session.home.includes(UsersDirectory) ?
    homedirectory = `${req.session.home}/${req.session.user.name}` :
    homedirectory = req.session.home;
    //Whenever the user is browsing their own directory, restrict access to only folders that belong to them. We include their name and only search directories under that user name.

    let requestPath = req.params[0].replace(`/${partition}/`, '');
    if (requestPath.includes('/'))
      requestPath = requestPath.substring(0, requestPath.indexOf('/'));
    //Finds the primary directory the current user is requesting/visiting by getting the first name up to the first "/" (after removing partition name from equation)


    //Very annoying, but this was need to acquire the Primary Directory name apart of the request path, which is in the middle of the string, behind the first "/" after we remove the partition from the equation

    const PrimaryDirectories = fs.readdirSync(homedirectory, {withFileTypes: true})
    .filter( dir => dir.isDirectory())
    .map(dir => dir.name);

    let i = 0;
// -----------------------------------------------------------------
    for (let directory of PrimaryDirectories) {

      if (directory[0] === '@' || directory[0] === '$') continue; //Then it's a hidden/reserved/special folder
      if (requestPath === directory)
        Sessions.users[`User${req.session.user.uid}`].residing = directory;
        //Whatever primary directory the user resides, store it for others to see

      let subfolders = [];
      //Grabbing sub-directories along with the stats and files within the given directory
      let stats = fs.statSync(`${homedirectory}/${directory}`);
      let files = fs.readdirSync(`${homedirectory}/${directory}`);
  // ------------------------------------------------ //
      for (let file of files) { /*Check every file*/

        filestats = fs.statSync(`${homedirectory}/${directory}/${file}`);
        stats.size += filestats.size;
        //Every file's stats are checked, and just their size is returned to be concatenated with the folderStats size (usually 0), so it will ultimately add up the sizes of all present files
        if (String(filestats.mode).slice(0, 2) === '16') /*Then it can't BE a file, so --*/ {
          let folder = file;
          subfolders.push(folder);
        };

      }; //End of second For Loop

      for (let subfolder of subfolders) { /*Remove it from files array*/
        files.splice(files.indexOf(subfolder), 1);
        stats.size += GetFolderSize(req, `${homedirectory}/${directory}/${subfolder}`, 0);
      } //End of third For Loop

  // ------------------------------------------------ //
      PrimaryDirectories[i] = {
        name: directory,
        stats: stats,
        files: files,
        folders: subfolders,
      };
      i++;
    }; //---- Looping through all directories: Ends

    // ------------------------------------------------ //
    req.session.home === partition ? res.locals.partition = req.session.home + '/' : res.locals.partition = homedirectory + '/';
    //If the public partition is the home, use it with no additions. If home is the user's private directory, add their name (by using homedirectory, see if-else condition at the top), so we aren't browsing the USERS directory, and instead just finding contents of ONE folder within Users directory for THIS user.

    res.locals.PrimaryDirectories = PrimaryDirectories;
    res.locals.AllDirectories = AllDirectories;
    // res.locals.GeneralHelpers = {namefinder, pathfinder, checkModeType, randomizeColor} = GeneralHelpers;
    res.locals.rivals = [];
    res.locals.firstVisit = firstVisit;
    //The parameter true is for "search", means we are just searching for directory names, not files

    if (req.originalUrl === '/') res.locals.directory = false;
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
Website.routes.BasePages = Website.makeBaseRoutes(process.env.PORT || 3001, 'directory',
//Normally just put "errorpage" as parameter to create error page, but instead had to pass in function to replace it with alternate functionality'
 app.use(async (err, req, res, next) => {

  const {status = 401, message = "Sigh", stack} = err;

    let anonymous = req.location ? req.location.country : 'Anonymous';
    let user;

    if (req.session)
      user = req.session.user ? req.session.user.name : anonymous;

     if (fs.statSync(`${process.env.infodir}/log.txt`).size < 100000) {
       //If the log file is less than 100 kilobytes, (or we aren't just reporting failed login attempts) continue to write errors to it.
       await WriteLogFilter(user, message)
     }

   return res.render('errorpage', {status, message, stack});
}));
