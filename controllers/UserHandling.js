const fs = require('fs-extra');
const argon = require('argon2');
const {wrapAsync} = require('../index.js')
let partition = process.env.partition;
const UsersDirectory = process.env.UsersDirectory || 'Users_1';
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
      delete(users[i].log);
      users[i].residing = null;
    }
    return users;

  };
  // ===========================
  refresh(session, sesid, fresh) {
  //Most important. Any request passed through a handler will trigger this, restarting the session timeout that tracks the user status, and also logs whatever action they commited.
    let log = session.log[session.log.length - 1]; //Get the most recent log output
    let user = this.users[`User${session.user.uid}`];
    let date = new Date();
    let basicTime = [` on ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`];
    let message;

    user.session_id = sesid;
    user.loggedIn = true;
    user.residing = session.residing

// -----------------------------------------------------------------------
    if (log && log.length) {
      this.users[`User${session.user.uid}`].firstVisit = false;
      message = log.replaceAll(',', '').replace(/<span.*?>/g, '').replace(/<\/span.*?>/g, '\r\n'); //Remove the span elements, intended only for front-end display
    }
    if (fresh === true) {
      message = 'Logged in: ';
    }
// -----------------------------------------------------------------------
    fs.appendFileSync(`${this.store}/${user.name}.txt`, message + basicTime);
    //Add to log text file belonging to user
    this.countdown(session, sesid);
  };
  // ----------------------------------------------------------------------
  countdown(session, sesid) {
  //Each user request starts a unique timer for each session, alongside Express' session expiration timer
    clearTimeout(process.sessionTimers[sesid]);
    process.sessionTimers[sesid] = setTimeout( () => this.terminate(session), session.cookie.originalMaxAge);
  };
  // ===========================
  terminate(session) {
  //Whenever the timer expires, or user logs out
    let user = this.users[`User${session.user.uid}`];

    delete(user.session_id);
    user.loggedIn = false;
    user.home = session.home;
    user.residing = null;

    let date = new Date();
    fs.appendFileSync(`${this.store}/${user.name}.txt`, `Logged out: ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`);
    if (session.user)
      session.destroy( (error) => console.log (error));

  };
  // ===========================
  lock(specificUser, session) {

  //On suspicious login attempts
    for (let i in this.users) {
      if (this.users[i].name === specificUser) {
        this.users[i].locked = true;
        //Finds the user account with the given username attempted, and locks it
        fs.appendFileSync(`${process.env.infodir}/log.txt`, `Locked user: ${specificUser}/${date.toLocaleTimeString()}\r\n`);
        break;
        return false;
      }
    };
    process.sessionTimers[session.id] = setTimeout( () => session.regenerate( (error) => error), session.cookie.originalMaxAge);
    //Since the current session is stalled (blocked from logging in), set a 10 minute timeout before restoring it
  };
};
// ==========================================================================
const Sessions = new SessionStore(process.env.infodir, process.env.info_users);

module.exports = {
  Sessions: Sessions,

  /*======================================================*/
  VerifyUser: wrapAsync(async function (req, res, next) {

    if (req.session.loginAttempts >= 2) {
    //Technically it's 3, the first login attempt sets it to null (0) rather than 1 for some reason
      let date = new Date();
      req.session.loginAttempts ++;

      Sessions.lock(req.body.name, req.session);
      fs.appendFile(`${process.env.infodir}/log.txt`, `Suspicious log attempt with ${req.body.name} from ${req.location.ip} (${req.location.country}) on: ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`);
      return next( new Error("Login attempts exceeded. Get lost."));
    }

    const usersJSON = await fs.readFileSync(`${process.env.infodir}/${process.env.info_users}`, 'utf8');
    const users = await JSON.parse(usersJSON);
    let confirmed = false;

    if (req.session.user) {
      Sessions.users[`User${req.session.user.uid}`].firstVisit = false;
      res.locals.firstVisit = false;
//----------------------------------------------------------------------------------
      if (req.body.preferences) {
        //On most post requests, preferences are sent from browser side so back-end session so we can make adjustments.
        let clientPrefs = await JSON.parse(req.body.preferences);
        req.session.preferences = clientPrefs;
      }; //End of If preferences
//----------------------------------------------------------------------------------
      for (let i in users) {

        if (req.session.user.name === users[i].name) {  //End of If user found
          let folder = req.params.folder || req.params.username || req.body.path || false;
          confirmed = await module.exports.CheckForUserFolder(req, res, next, folder);
          continue; //We need to make sure all logged-in users are passed in, so return response later
        }
        else if (Sessions.users[i].loggedIn)
          //Track any other users currently logged in besides you
          res.locals.rivals.push({user: Sessions.users[i].name, residing: Sessions.users[i].residing});
      // ----------------------------
      }; //End of For loop over users

        return confirmed;
//----------------------------------------------------------------------------------
      req.session.destroy( (error) => next(new Error('User not verified. Session terminated.')));
    } //End of If a user is currently logged in
    // ------------------------------------------------------------------------------
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
  }), //---------- VerifyUser function ends
  /*======================================================*/

  /*======================================================*/
  CheckForUserFolder: async function (req, res, next, folder) {
    user = req.session.user.name;

    if (req.session.home === UsersDirectory && folder !== user
    && folder.slice(0, user.length) !== user) {
      //If user is viewing home/private directory, but did not include their folder (username) within the submission/viewing request, then reject request.
      if (req.method === 'GET' && !req.path.includes(user)) {
        return next(new Error('Cannot view any private directories outside your own.'));
      } else return module.exports.ReportData(req, res, false, {
              content: [`Can only submit/view items within your own directory.`, `Make sure to include as the root in every folder/file submission.`],
              type: 'error',
              items: [user]
            });

    } //If no submission parameters (folder input) matches the user name
    return next();
  },
  /*======================================================*/

  /*======================================================*/
  CompareInfo: async function (req, res, next, users) {

    for (let i in users) {

      if (await argon.verify(users[i].password, req.body.password)
          && req.body.name === users[i].name)
        { //If authentication succeeded and user info matched
          if (Sessions.users[`User${users[i].uid}`].locked === true || Sessions.users[`User${users[i].uid}`].loggedIn === true) {
            //If user is logged in or locked out, log to their private text file and return error

            let date = new Date();
            fs.appendFileSync(`${process.env.infodir}/${users[i].name}.txt`,
            `Log in attempt failed: ${date.toLocaleDateString()}/${date.toLocaleTimeString()}.
            IP: ${req.connection.remoteAddress}\r\n`);

            return next( new Error("User found, but is currently logged in, or locked out."));
          }
          //Establish session with user info and essential info, update Sessions store, and return.
          req.session.user = users[i];
          delete(req.session.user.password);
          req.session.log = [];
            req.session.preferences = {
              outsideDir: false,
              emptyDir: false,
              smoothTransition: true,
              deleteCheck: true,
              uploadWarning: true
            };
          req.session.home = Sessions.users[`User${users[i].uid}`].home || partition;
          req.session.loginAttempts = 0;

          Sessions.refresh(req.session, req.session.id, true);
          return next();
          break;
        };
    }; //End of For Loop over users

    req.session.loginAttempts += 1;
    return next( new Error("User information incorrect, or user does not exist."));
  },
  /*======================================================*/

  /*======================================================*/
  ReportData: async function (req, res, error, report) {

    if (req.session.log.length > 100) {
    //Log size must be limited else it will be excessive data to keep track of
      do req.session.log.shift();
      while (req.session.log.length > 100);
    }

    if (error) {
      req.session.log.push(error.message);
      res.locals.UserSession = req.session;

      return res.send({
        content: [error.message],
        type: 'error',
      });
    }
    else {
      req.session.log.push(`${report.content[0]} ${report.items ? [...report.items] : ''} ${report.content[1] || ''}`.replace(/<span.*?>/g, '').replace(/<\/span.*?>/g, '').replace('<hr>', ''));
      //Very ugly. Since some messages displayed actually contain a <span> element with styling, we need to remove it before logging it to report log. So, we just replace "<span> and </span>" and anything within their arrows, so all we get is the content between them.

      Sessions.refresh(req.session, req.session.id);
      res.locals.UserSession = req.session;
      return res.send(report);
    }
  },
  /*======================================================*/

}; //----Modules export
