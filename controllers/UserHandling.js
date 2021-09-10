'use strict';
const fs = require('fs-extra');
const {Hash, Verify} = require('./Hasher.js');
const {wrapAsync, sessionDuration} = require('../index.js');
let partition = process.env.partition;
const UsersDirectory = process.env.UsersDirectory || 'users';
const allowedPreferences = 5;

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
      users[i].cache = [];
    }
    return users;

  };
  // ===========================
  user(req) {
    if (req.session) {
      if (!req.session.user) {
        for (let i in this.users)
          if (this.users[i].name === req.body.name)
            return this.users[i];
      } else return this.users[`User${req.session.user.uid}`];
    }
  };

  // ===========================
  async refresh(req, fresh) {
    if (process.ServerTracker.status === 0)
      this.terminate(req);

    //Most important. Any request passed through a handler will trigger this, restarting the session timeout that tracks the user status, and also logs whatever action they commited.
    let user = this.user(req);
      if (user.log && user.log.length > 50) {
      //Log size must be limited else it will be excessive data to keep track of
        do user.log.shift();
        while (user.log.length > 50);
      }
    let log = user.log[user.log.length - 1] || ''; //Get the most recent log output
    let date = new Date();
    let basicTime = [` on ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`];
    let message;

    user.firstVisit = false;
    user.loggedIn = true;
    user.operation = req.body.operation ? {type: req.body.operation, size: 0, location: user.residing} : false;
// ----------------------------------------------------------------------- Basically all message data provided by log is designed for front-end, so we need to clear the <spans> and <hrs> from it so log isn't ugly and confusing
    if (user.log) {
      message = log.replace(/,/g, '').replace(/<span.*?>/g, '').replace(/<\/span.*?>/g, '\r\n'); //Remove the span  elements, intended only for front-end display
    }
    else if (fresh === true)
      message = 'Logged in:';
// ----------------------------------------------------------------------- If users' text file inevtably surpasses 100 KBs, clear it and start from beginning
    fs.stat(`${this.store}/${user.name}.txt`, (err, stats) => {
      if (err) throw err
      else if (stats.size >= 100000) {
        fs.writeFile(`${this.store}/${user.name}.txt`, message + basicTime, (err) => err ? console.log(err) : null);
      } else fs.appendFile(`${this.store}/${user.name}.txt`, message + basicTime, (err) => err ? console.log(err) : null);
    })

    //Add to log text file belonging to user
    this.countdown(req);
  };

  // =========================== Every user's session has a timer associated with them that kills their session after the given period of time. It is reset when the user commits any operation.
  countdown(req) {
  	//Each user request starts a unique timer for each session, alongside Express' natural session expiration timer
    clearTimeout(process.sessionTimers[req.session.user.name]);
    process.sessionTimers[req.session.user.name] = setTimeout( () => this.terminate(req), req.session.duration);
  };

  // ===========================
  async terminate(req) {

    if (req.session && req.session.user) {
      console.log('====== Terminated ======');
      for (let key in process.memoryUsage()) {
        console.log(`${key}: ${Math.round(process.memoryUsage()[key] / 1024 / 1024 * 100) / 100} MB`);
      }
      console.log ('======')
    //Whenever the timer expires, or user logs out
      let user = this.user(req);

      user.loggedIn = false;
      user.operation = null;
      user.home = req.session.home;
      req.session = null;

      let date = new Date(); //Just logging information to text file
      fs.appendFile(`${this.store}/${user.name}.txt`, `Logged out: ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`, (err) => err ? console.log(err) : null);

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

    process.sessionTimers[req.session.user ? req.session.user.name : 'Anonymous'] = setTimeout( () => req.session = null, req.session.duration);
    //Since the current session is stalled (blocked from logging in), set a 10 minute timeout before restoring it
  };
};
// ==========================================================================
const Sessions = new SessionStore(process.env.infodir, process.env.info_users);

module.exports = {
  Sessions: Sessions,

  /*======================================================*/
  VerifyUser: wrapAsync(async function (req, res, next) {
    try {
    //---------------------------------------------------------------- Limit signin attempts and log failed attempts
    if (req.session.loginAttempts >= 2) {
    //Technically it's 3, the first login attempt sets it to null (0) rather than 1 for some reason
      let date = new Date();
      req.session.loginAttempts ++;

      Sessions.lock(req, req.body.name);
      fs.appendFile(`${process.env.infodir}/log.txt`, `Suspicious log attempt with ${req.body.name} from ${req.location.ip} (${req.location.country}) on: ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`);
      return next( new Error("Login attempts exceeded. Get lost."));
    }
    //---------------------------------------------------------------- Retrieve user database and merge current user preferences with body object
    const usersJSON = await fs.readFileSync(`${process.env.infodir}/${process.env.info_users}`, 'utf8');
    const users = await JSON.parse(usersJSON);

    if (req.session.user) {
      req.session.user.firstVisit = false;
      if (req.body.preferences) {
        let clientPrefs = await JSON.parse(req.body.preferences);
        req.session.preferences = clientPrefs;
      };

      //---------------------------------------------------------------- Begins loop and first checks if any other users are performing operation, reject request if so
      let confirmed = false;

      for (let i in users) {
        let user = req.session.user;
        if (Sessions.users[i].operation && req.method !== 'GET') {
          req.clash = {
            user: Sessions.users[i].name,
            operation: Sessions.users[i].operation
          };
          // ------------------------------------------- This checks if another user is performing an operation within primary directory, and if so, rejects request with report of which is user is operating
          if (user.residing && user.residing.includes(req.clash.operation.location)
          || req.params.folder && req.params.folder.includes(req.clash.operation.location)) {
            return await module.exports.ReportData(req, res, false, {
              content: [`${req.clash.user === user.name ? 'You are' : req.clash.user + ' is'} currently performing a ${req.clash.operation.type} operation with that directory`, 'operation payload'],
              type: 'error',
              items: [getFileSize(req.clash.operation.size)]
            });
          }

        } //End of: If there was an operation to begin with
        //---------------------------------------------------------------- If user info matches, check for valid folder and continue on to find any "rival" users currently logged in
        if (user.name === users[i].name) {
          if (!confirmed) {
            confirmed = await module.exports.CheckForUserFolder(req, res, next);
          } else continue; //We need to make sure all logged-in users are passed in, so return response ('confirmed') later
        }
      //---------------------------------------------------------------- Refresh session and proceed to next route
      };
      Sessions.refresh(req);
      return confirmed;
    } //End of If a user is currently logged in
    else { //If not logged in, and one of the fields is missing
      if (!req.body.name || !req.body.password) {
        if (!req.session.user) return next(new Error("User information must be provided."));
        else return ReportData (req, res, false, {
          content: ['User information must be provided'],
          type: 'error'
        });

      }
    // ------------------------------------------------------------------------------
    //The big one that iterates over all users and compares data, if user found we proceed to next route.
    await module.exports.CompareInfo(req, res, next, users);
    };
  } catch (error) {
    console.error(error.message, error.stack);
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
            `Log in attempt failed: ${date.toLocaleDateString()}/${date.toLocaleTimeString()}.
            IP: ${req.connection.remoteAddress}\r\n`, (err) => err ? console.log(err) : null);

            return next( new Error("User found, but is currently logged in, or locked out."));
          }
          //Establish session with user info and essential info, update Sessions store, and return.
          req.session.user = users[i];
          delete(req.session.user.password);
          delete(req.session.user.log);
          req.session.duration = process.env.session_time;
          req.session.home = Sessions.user(req).home || partition;
          req.session.user.firstVisit = false;
          req.session.firstVisit = false;
            req.session.preferences = {
              outsideDir: false,
              emptyDir: false,
              smoothTransition: true,
              deleteCheck: true,
              uploadWarning: true
            };

          await Sessions.refresh(req, true);
          return next();
          break;
        };
    }; //End of For Loop over users

    req.session.loginAttempts += 1;
    return next( new Error("User information incorrect, or user does not exist."));
  },
  /*======================================================*/

  /*======================================================*/
  CheckOperation: async function (req, res, next) {

    if (req.body && process.ServerTracker.status === 0) {
      const op = req.body.operation || 'None';

      if (op === 'Upload' || op === 'Download') {

        res.type('html'); //This was necessary since download requsts expect 'Blob' content type, but we're not returning a blob here
        return module.exports.ReportData(req, res, false, {
          content: [`Server shutdown imminent. Cannot initiate ${op} during this time.`],
          type: 'error'
        });
      }

      else return next();
    } else return next();
  },
  /*======================================================*/

  /*======================================================*/
  ReportData: async function (req, res, error, report) {

    Sessions.user(req).operation = false;

    if (error) {
      Sessions.user(req).log.push(error.message);

      return res.send({
        content: [error.message],
        type: 'error',
        items: error.stack
      });
    } else {
      Sessions.user(req).log.push
      (parseHTML(`${report.content[0]} ${report.items ? [...report.items] : ''} ${report.content[1] || ''}`))
      // Sessions.user(req).log.push(. replace(/<span.*?>/g, '').replace(/<\/span.*?>/g, '').replace('<hr>', ''));
      //Quite ugly. The messages and report fields need to be separated accordingly, and also need any HTML parsed before being logged. Removes all <span> and <hr> elements and everything in between their arrow brackets

	  // req.body = null; req.files = null;
      if (process.ServerTracker.status === 0) {
        let currentTime = Math.floor(new Date().getTime() / 60000);
        report.warning = `<hr> <span style="color: red">Warning: </span> <h4 class="white">${process.ServerTracker.warning}: Occuring in ${Math.abs(currentTime - process.ServerTracker.countdown)} minutes</h4>`;
      }
      res.locals.UserSession = req.session;
      res.locals.UserSession.log = Sessions.user(req).log;

      return res.send(report);
    }
  },
  /*======================================================*/

}; //----Modules export
