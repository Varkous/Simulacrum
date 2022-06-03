'use strict';

const {getFileSize, parseHTML} = require('../scripts/Helpers.js');
const {Sessions} = require('../controllers/UserHandling.js');
const {GetFolderSize} = require('../controllers/DirectoryOperations.js');
const {wrapAsync, sessionDuration, fs} = require('../index.js');

let partition = process.env.partition;
const UsersDirectory = process.env.UsersDirectory || 'users';
const allExtensions =  [
  '.bat','.apk','.com','.jpg','.jpeg','.exe','.doc','.docx','.docm','.ttf','woff2','.rpp', '.tar', '.html','.z','.pkg','.jar','.py','.aif','.cda','.iff','.mid','.mp3','.flac','.wav','.wpl','.avi','.flv','.h264','.m4v','.mkv','.mov','.mp4','.mpg','.rm','.swf','.vob','.wmv','.3g2','.3gp','.doc','.odt','.msg','.pdf','.tex','.txt','.wpd','.ods','.xlr','.xls','.xls','.key','.odp','.pps','.ppt','.pptx','.accdb','.csv','.dat','.db','.log','.mdbdatabase','.pdb','.sql','.tar','.bak','.cabile','.cfg','.cpl','.cur','.dll','.dmp','.drve','.icns','.ico','.inile','.ini','.info','.lnk','.msi','.sys','.tmp','.cer','.ogg','.cfm','.cgi','.css','.htm','.js','.jsp','.part','.odb','.php','.rss','.xhtml','.ai','.bmp','.gif','.jpeg','.max','.obj','.png','.ps','.psd','.svg','.tif','.3ds','.3dm','.cpp','.h','.c','.C','.cs','.zip','.rar','.7z'
];

module.exports = {

  /*===============================================================*/
  CheckSessionAndURL: async function (req, res, next) {

    const url = req.baseUrl;
// ----------
    if (url.includesAny(module.exports.worthlessURLS))
      return false;
    //These are unnecessary requests made by browser, dismiss them
// ----------
    if (url.includesAny('/login', '/signout', '/new') || req.session && url.includesAny('/all', '/all/undefined'))
      return next(); // These URLs do not use the data below, and need redirection to avoid sidetracking to login
// ----------
    if (!req.session)
      return res.redirect('/signout');

    // -------------------------------------
    const partition = req.session.home || process.env.partition

    if (req.session && req.session.user) {

    	const ses = req.session;
      if (url === `/${partition}` || url === `/${partition}/${ses.user.name}`) //Homepage represents top-level partition, so redirect there if partition was input as url
        ses.user.residing = partition === UsersDirectory ? ses.user.name : '/';

      return next();
    } else return res.redirect('/login');

  },
  /*===============================================================*/

  /*===============================================================*/
  ProbeSessionDetails: async function (req, res, next) {

    if (req.session) {
      let ses = req.session;
      let op = req.headers.operation;

      if (process.ServerTracker.status === 0) {

        if (op && op.matchesAny('Upload', 'Download') && process.ServerTracker.countdown < 4) { // Too long to perform a lot of operations
          const report = {
             content: [`<span style="color: green">${op}</span> aborted`, `${process.ServerTracker.countdown} minutes remain before shutdown, and operation could be compromised`],
             type: 'error',
           };
           if (op === 'Download') { // Download operation normally expects Blob response type, so need to adjust headers and response data
             res.setHeader('responseType', 'application/json');
             res.setHeader('content-type', 'application/json');
           }
          return res.send(report);
        }

        res.locals.Server.remaining < 2 ? Sessions.terminate(req) : null;
        //If server is shutting down in less than 2 minutes, terminate user's session
      }
// -----------------------------------------------------
    let payloadSize = parseInt(req.headers['content-size']) || parseInt(req.headers['content-length']) || 0;
    if (ses.home === UsersDirectory) { // More than 5 gigabytes
  
      let totalsize = await GetFolderSize(req, `${ses.home}/${ses.user.name}`, 0);
      if ((payloadSize + totalsize) >= ses.maxsize && op && op.matchesAny('Upload', 'Transfer', 'Convert')) {
        req.reject = true;
        const report = {
           content: [`<span style="color: green">${op}</span> aborted`, `Maximum upload capacity (${getFileSize(ses.maxsize)}) reached`],
           type: 'error',
         };
        return res.send(report); // Does not actually end request unfortunately
      }
    }
    //---------------------------------------------------------------- Limit signin attempts and log failed attempts
    if (req.session.loginAttempts >= 2) {
    //Technically it's 3, the first login attempt sets it to null (0) rather than 1 for some reason
      let date = new Date();
      req.session.loginAttempts ++;

      await Sessions.lock(req, req.body.name);
      fs.appendFile(`${process.env.infodir}/log.txt`, `Suspicious log attempt with ${req.body.name} from ${req.location.ip} (${req.location.country}) on: ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`);
      return next( new Error("Login attempts exceeded. Seek life elsewhere."));
    }
    //---------------------------------------------------------------- Retrieve user database and merge current user preferences with body object
      if (req.body.preferences) {
        let clientPrefs = await JSON.parse(req.body.preferences);
        req.session.preferences = clientPrefs;
      };

      return true;
    }
  },
  /*===============================================================*/

  /*======================================================*/
  ReportData: async function (req, res, error, report) {
    if (req.session.user) {
      Sessions.user(req, req.backup || null).operation = false; //Other users will no longer be blocked from operation

      if (error) {
        !error.message ? error.message = error : false;
        Sessions.user(req, req.backup || null).log.push(error.message);

        return res.send({
          content: [error.message],
          type: 'error',
        });
      // --------------------------------------------------
      } else {
        Sessions.user(req, req.backup || null).log.push
        (parseHTML(`${report.content[0]} ${report.items ? [...report.items] : ''} ${report.content[1] || ''}`))
        //Quite ugly. The messages and report fields need to be separated accordingly, and also need any HTML parsed before being logged. Removes all <span> and <hr> elements and everything in between their arrow brackets

        if (process.ServerTracker.status === 0) { //If the server is about to shut down
          let currentTime = Math.floor(new Date().getTime() / 60000);
          report.warning = `<hr> <span style="color: red">Warning: </span> <h4 class="white">${process.ServerTracker.warning}: Occuring in ${Math.abs(currentTime - process.ServerTracker.countdown)} minutes</h4>`;
        }
        res.locals ? res.locals.UserSession = req.session : false;
        //Refresh locals
      }
    }
    return res.send(report);
  },
  /*======================================================*/

  /*======================================================*/
  //Checking to ensure -- if a user is browsing their private directory -- that they cannot view or post to another private directory outside their own
  CheckForUserFolder: async function (req, res, next) {
    const user = req.session.user.name;
    const url = req.originalUrl;
    const userHome = `/${UsersDirectory}/${user}`;
  

    if (req.method === 'GET' && req.session.home === UsersDirectory && url.slice(0, userHome.length) !== userHome && !url.includes(`/home/${user}`)) {
    	  console.log(user, url, userHome);
      //If user is viewing home/private directory, but did not include their folder (username) within the submission/viewing request, then reject request.
      if (!req.path.includes(user)) {
        return next(new Error('Cannot view any private directories outside your own.'));
      } else return next(new Error(`Can only submit/post items to your own directory ${user}.`, `Make sure to include it as the root in every folder/file submission while within private directory.`));
    } else return next();//If no submission parameters (folder input) matches the user name
  },
  /*======================================================*/

  /*===============================================================*/
  worthlessURLS: ['/fonts', '/favicon.ico', ...allExtensions],
  /*===============================================================*/
};
