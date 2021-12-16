'use strict';
const fs = require('fs-extra');
const checkDiskSpace = require('check-disk-space').default
const {Hash, Verify} = require('./Hasher.js');
const {wrapAsync, sessionDuration} = require('../index.js');
const {getFileSize, parseHTML} = require('../scripts/Helpers.js');
let partition = process.env.partition;
const UsersDirectory = process.env.UsersDirectory || 'users';
const allowedPreferences = 5;
  /*===============================================================*/
  function GetFolderSize (req, directory, size) { //This function can call ITSELF and create a cascading call-return of whatever is passed in. It's used solely to get the size of all files in every directory and SUBDIRECTORY passed in, which can lead to calls upon calls upon calls.
    try {
      let directorySize = size || 0;
      let dirFiles = fs.readdirSync(directory);

      dirFiles.forEach( function (dirfile) {
        if (fs.statSync(`${directory}/${dirfile}`).isDirectory()) {
          //If one of the "files" of the directory is actually another directory, we just restart the process
          directorySize = GetFolderSize(req, `${directory}/${dirfile}`, directorySize);
        } else {
          directorySize += fs.statSync(`${directory}/${dirfile}`).size;
        }
      });
      return directorySize;
    } catch (error) { throw error;}
  }; //-------End of: Get folder size
  /*===============================================================*/
class SessionStore {
  constructor(store, users) {
  //Acquires all users from the "database", the store is the folder in which logs are kept
    this.users = this.filterInfo(JSON.parse(fs.readFileSync(`${store}/${users}`, 'utf8')));
    this.store = store;
  };

  // ===========================
  filterInfo(users) {
    //Remove sensitive or excessive information
    for (let i in users) {
      delete(users[i].password);
      users[i].residing = null;
      users[i].loggedIn = false;
      users[i].log = [];
    }
    return users;

  };
  // ===========================
  user(req, ses) {
  	const session = req.session ? req.session : ses //In case the session somehow expires during operation, we use the backup parameter
    if (session) {
      if (!session.user) {
        for (let i in this.users)
          if (this.users[i].name === req.body.name)
            return this.users[i];
      } else return this.users[`User${session.user.uid}`];
    }
  };

  // ===========================
  async refresh(req, fresh) {

    //Most important. Any request passed through a handler will trigger this, restarting the session timeout that tracks the user status, and also logs whatever action they commited.
    let user = this.user(req);
      if (user.log && user.log.length > 30 || user.log && user.log.join(' ').length > 4000) {
      //Log size must be limited else it will be excessive data to keep track of
        do user.log.shift();
        while (user.log.length > 30 || user.log.join(' ').length > 4000);
      }
<<<<<<< HEAD
      console.log(user);
=======
>>>>>>> 81c8018ee693d247bf53f63a32ed222c34e3e83f
    let log = user.log.length > 1 ? user.log.last() : ''; //Get the most recent log output
    let date = new Date();
    let basicTime = [` on ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`];
    let message;

    user.firstVisit = false;
    user.loggedIn = user.guest ? false : true;
    user.residing = req.session.user.residing;
    user.operation = req.headers.operation ? {type: req.headers.operation, location: user.residing} : false; //If any operations are in effect, store it.
// ----------------------------------------------------------------------- Basically all message data provided by log is designed for front-end, so we need to clear the <spans> and <hrs> from it before writing (it would be quite ugly)
    if (log)
      message = log.replace(/,/g, ', ').replace(/<span.*?>/g, '').replace(/<\/span.*?>/g, ' ');

// ----------------------------------------------------------------------- If users' text file inevtably surpasses 100 KBs, clear it and start from beginning
    fs.stat(`${this.store}/${user.name}.txt`, (err, stats) => { //Just writing to user's log with the report data message
      if (err) throw err
      else if (stats.size >= 100000 && message) {
        fs.writeFile(`${this.store}/${user.name}.txt`, message + basicTime, (err) => err ? console.log(err) : null);  //Add to log text file belonging to user
      } else if (message) fs.appendFile(`${this.store}/${user.name}.txt`, message + basicTime, (err) => err ? console.log(err) : null);
      //Just for readability after writing to log
    })

    delete(req.session.log);
    this.countdown(req, user);
  };

  // =========================== Every user's session has a timer associated with them that kills their session after the given period of time. It is reset when the user commits any operation.
  countdown(req, user) {
  	//Each user request starts a unique timer for each session, alongside Express' natural session expiration timer
    clearTimeout(process.sessionTimers[user.name]);
    process.sessionTimers[user.name] = setTimeout( () => this.terminate(req, user), req.session.duration);
  };

  // ===========================
  async terminate(req, user) {

    if (req.session && req.session.user) {
       for (let key in process.memoryUsage()) {
         console.log(`${key}: ${Math.round(process.memoryUsage()[key] / 1024 / 1024 * 100) / 100} MB`);
       }
    //Whenever the timer expires, or user logs out
      user = user || this.user(req);

      user.operation = false;
      user.loggedIn = false;
      user.firstVisit = false;
      user.home = req.session.home;
      user.preferences = req.session.preferences;
      req.session = null;

      let date = new Date(); //Just logging information to text file
      fs.appendFile(`${this.store}/${user.name}.txt`, `Logged out: ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`, (err) => err ? console.log(err) : null);
      fs.writeFileSync(path.resolve('@_Info/backupUsers.txt'), JSON.stringify(Sessions.users));

      //Clearing the users' temp directory
      fs.exists(path.resolve('temp', user.name), (err) => {
        if (err) return false;
        fs.rm(path.resolve('temp', user.name), {recursive: true, force: true}, (err) => {
          if (err) console.log (err);
        });
      })
    } //If no user at all, then session is not active

  };

  // ===========================
  lock(req, specificUser) {

  //On suspicious login attempts
    for (let i in this.users) {
      if (this.users[i].name === specificUser) {
        this.users[i].locked = true;
        //Finds the user account with the given username attempted, and locks it
        fs.appendFile(`${process.env.infodir}/log.txt`, `Locked user: ${specificUser}/${date.toLocaleTimeString()}\r\n`, (err) => err ? console.log(err) : null);
        break;
        return false;
      }
    };
  };
  // ===========================
}; //End of Class
// ==========================================================================
const Sessions = new SessionStore(process.env.infodir, process.env.info_users);

module.exports = {
  Sessions: Sessions,

  /*======================================================*/
  VerifyUser: wrapAsync(async function (req, res, next) {

   try {
      //---------------------------------------------------------------- Retrieve user database and merge current user preferences with body object
    const usersJSON = await fs.readFileSync(`${process.env.infodir}/${process.env.info_users}`, 'utf8');
    const users = await JSON.parse(usersJSON);
;
    if (req.session && req.session.user) { //Any preferences changed on front-end need to be reflected back-end

	  await module.exports.ProbeSessionDetails(req, res, next);
      //---------------------------------------------------------------- Retrieve user database and merge current user preferences with body object
      let confirmed = false; // Default response, this changes to "next()" if user is verified

      for (let i in users) { // ----------------------------------- Begins loop and first checks if any other users are performing operation, reject request if so
        let user = req.session.user;
        if (Sessions.users[i].operation && req.method !== 'GET') {
          req.clash = { //If another user is performing an operation
            user: Sessions.users[i].name,
            operation: Sessions.users[i].operation
          };

          // ------------------------------------------- This checks if another user is performing an operation within primary directory, and if so, rejects request with report of which is user is operating
          if (user.residing && user.residing.includes(req.clash.operation.location)
          || req.params.folder && req.params.folder.includes(req.clash.operation.location)) {
            return await module.exports.ReportData(req, res, false, {
              content: [`${req.clash.user === user.name ? 'You are' : req.clash.user + ' is'} currently performing a ${req.clash.operation.type} operation under the`, 'directory'],
              type: 'error',
              items: [`<span class="dimblue">${Sessions.users[i].residing || req.clash.operation.location}</span>`]
            });
          }

        } //End of: If there was an operation to begin with
        //---------------------------------------------------------------- If user info matches, check for valid folder and continue on to find any "rival" users currently logged in
        if (user.name === users[i].name) {
          if (!confirmed) {
            confirmed = await module.exports.CheckForUserFolder(req, res, next);
            Sessions.user(req).operation = {type: req.headers.operation, location: req.params.folder};
          } else continue; //We need to make sure all logged-in users are passed in, so return response ('confirmed') later
        }
      //---------------------------------------------------------------- Refresh session and proceed to next route
      };
      Sessions.refresh(req);
      res.locals.Log = Sessions.user(req, req.backup).log;
      req.backup = req.session; //In case the session reaches expiration during a 60 minute+ operation

      return confirmed;
    } //End of If a user is currently logged in
    else { //If not logged in, and one of the fields is missing
      if (!req.body.name || !req.body.password) {
        if (!req.session || !req.session.user) return next(new Error("User information must be provided."));
        else return ReportData (req, res, false, {
          content: ['User information must be provided'],
          type: 'error'
        });

      }

    //The big one that iterates over all users and compares data, if user found we proceed to next route.
    module.exports.CompareInfo(req, res, next, users);
    };
   } catch (err) {
  	console.log(err);
    return false;
   }
  }), //---------- VerifyUser function ends
  /*======================================================*/

  /*======================================================*/
  CheckForUserFolder: async function (req, res, next, folder) {
    const user = req.session.user.name;
    const url = req.originalUrl;
    const userHome = `/users/${user}`;

    if (req.method === 'GET' && req.session.home === UsersDirectory && url.slice(0, userHome.length) !== userHome && !url.includes(`/home/${user}`)) {
      //If user is viewing home/private directory, but did not include their folder (username) within the submission/viewing request, then reject request.
      if (!req.path.includes(user)) {
        return next(new Error('Cannot view any private directories outside your own.'));
      } else return next(new Error(`Can only submit/post items to your own directory ${user}.`, `Make sure to include it as the root in every folder/file submission while within private directory.`));
    } else return next();//If no submission parameters (folder input) matches the user name
  },
  /*======================================================*/

  /*======================================================*/
  CompareInfo: async function (req, res, next, users) {

    for (let i in users) {

      if (await Verify(users[i].password, req.body.password)
          && req.body.name === users[i].name) { //If authentication succeeded and user info matched

          if (Sessions.user(req).locked === true || Sessions.user(req).loggedIn === true) {
            //If user is logged in or locked out, log to their private text file and return error

            let date = new Date();
            fs.appendFile(`${process.env.infodir}/${users[i].name}.txt`,
            `Log in attempt failed: ${date.toLocaleDateString()}/${date.toLocaleTimeString()} <> IP: ${req.connection.remoteAddress}\r\n`, (err) => err ? console.log(err) : null);
            //This little chunk above is all just string data for readability when writing to the log
			req.session.loginAttempts += 1;
            return next( new Error("User found, but is currently logged in, or locked out."));
          } else {
	          //Establish session with user info and essential info, update Sessions store, and return.
	          let user = Sessions.users[i];
	          req.session.user = user;
	          delete(req.session.user.password); // Confidential

	          req.session.duration = parseInt(process.env.session_time); //The time until the Session store triggers termination
	          // --------------------------------------------------
	          if (user.name === 'guest') {
	            req.session.maxsize = 5 * 1000 * 1000 * 1000; //Gigabytes > Megabytes > Kilobytes > Bytes (5 Gigabytes) max upload size
	            req.session.home = UsersDirectory; //Always and only private directory for guest
	            req.session.guest = true; //Identifier
	          } else {
	            req.session.home = users[i].home || partition; // Last homedirectory they left off at
	            req.session.maxsize = 100 * 1000 * 1000 * 1000; // This is only relevant inside private directory. 100 Gigabyte limit.
	          }
	          // --------------------------------------------------
	          req.session.preferences = users.preferences || {
	            outsideDir: false,
	            emptyDir: false,
	            smoothTransition: true,
	            deleteCheck: true,
	            uploadWarning: true,
	            folderWarning: true
	          };
	          // --------------------------------------------------
			  user.log.push('Logged in');
			  delete(req.session.log);
	          await Sessions.refresh(req); //Refreshes session and writes any log data
	          req.session.user.firstVisit = true;
	          return next(); //Continues on to next handler
	          break;
         }
      };
    }; //End of For Loop over users

    req.session.loginAttempts += 1;
    return next( new Error("User information incorrect, or user does not exist."));
  },
  /*======================================================*/

  /*===============================================================*/
  ProbeSessionDetails: async function (req, res, next) {
  // -----------------------------------------------------
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
	    if ((payloadSize + totalsize) >= ses.maxsize && op && op.matchesAny('Upload', 'Transfer')) {
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

  /*===============================================================*/
  GetCreator: function (uid) {
		return Sessions.users[`User${uid}`] ? Sessions.users[`User${uid}`].name : 'Admin';
	},
  /*===============================================================*/

  /*======================================================*/
  ReportData: async function (req, res, error, report) {

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

      return res.send(report);
    }
  },
  /*======================================================*/

}; //----Modules export
