'use strict';

const {Hash, Verify} = require('./Hasher.js');
const {wrapAsync, sessionDuration, fs} = require('../index.js');
const {addString} = require('../scripts/Helpers.js');

let partition = process.env.partition;
const UsersDirectory = process.env.UsersDirectory || 'users';
const allowedPreferences = 5;
  /*===============================================================*/

class SessionStore {
  constructor(store, users) {
  //Acquires all users from the "database", the store is the folder in which logs are kept
    this.store = store;
    this.users = this.filterInfo(this.database());
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
    return Array.isArray(users) ? users[0] : users;
    //If only one User is being filtered, simply return that user instead of an array of one user

  };

  // ===========================
  user(req, ses) {

    if (!arguments.length)
      return Object.values(this.users);

  	const session = req && req.session ? req.session : ses //In case the session somehow expires during operation, we use the backup parameter

    if (session) {
      if (!session.user) {
        for (let i in this.users)
          if (req.body.name.matchesAny(this.users[i].name, this.users[i].email))
            return this.users[i];
      } else return this.users[`User${session.user.uid}`];
    }
  };

  // ===========================
  database(fn) {
    if (fn && typeof(fn) !== 'function')
      throw new Error('Argument for database must be a callback function');

    try {
      const users_file = JSON.parse(fs.readFileSync(`${this.store}/${process.env.info_users}`, 'UTF8'));
      // The "database" of users is just a JSON-themed text file with each user's profile information. We locate it, read it, parse it into an object, and ship it to the callback (if provided one), or just return it
      return fn ? fn(null, users_file) : users_file;
    } catch (err) {
      return fn ? fn(err) : err;
    };
  }

  // ===========================
  async new(req, res, user) {

    try {
      this.database( (err, user_collection) => {
      //Retrieve the database text file of users, store the new user, and re-write the file again
        if (err) throw err;

        user_collection[`User${user.uid}`] = user;
        let usersFile = JSON.stringify(user_collection);
        this.users[`User${user.uid}`] = this.filterInfo([user]);

        for (let u in this.users)
          usersFile = addString(usersFile, usersFile.indexOf(u) - 1, '\r');
          // Adding a new line before each User in text file to structure it, and make it readable

        usersFile = addString(usersFile, usersFile.length - 1, '\r'); // Add new line before last "}" as well
        fs.appendFile(`${this.store}/backupUsers.txt`, JSON.stringify(user), 'utf8'); // Store backup of profile
        fs.writeFileSync(`${this.store}/${process.env.info_users}`, usersFile); // Re-write database with new user
        fs.writeFileSync(`${this.store}/${user.name}.txt`, 'Profile created\r'); // Create user's log text file
        fs.mkdirSync(`${UsersDirectory}/${user.name}`); // Create their private directory
      });
    } catch (err) {
      console.log (err);
      return ReportData(req, res, false, {
        content: '<h4 style="color: lightcoral">Error. Profile info must be verified before access is provided. Check back later</h4>',
        type: 'error'
      });
    } finally {
      return ReportData(req, res, false, {
        content: '<h4 style="color: cadetblue">Profile verified! You may now log in.</h4>',
        type: 'success'
      });
    };
  };

  // ===========================
  async refresh(req, fresh) {

    //Most important. Any request passed through a handler will trigger this, restarting the session timeout that tracks the user status, and also logs whatever action they commited.
    let user = this.user(req);
    if (!user) throw new Error('User profile not found');
      if (user.log && user.log.length > 30 || user.log && user.log.join(' ').length > 4000) {
      //Log size must be limited else it will be excessive data to keep track of
        do user.log.shift();
        while (user.log.length > 30 || user.log.join(' ').length > 4000);
      }
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

      req.session = null; // Destroys the session

      let date = new Date(); //Just logging information to text file
      fs.appendFile(`${this.store}/${user.name}.txt`, `Logged out: ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`, (err) => err ? console.log(err) : null);
      fs.writeFileSync(path.resolve(this.store, 'backupUsers.txt'), JSON.stringify(Sessions.users));

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
        fs.appendFile(`${this.store}/log.txt`, `Locked user: ${specificUser}/${date.toLocaleTimeString()}\r\n`, (err) => err ? console.log(err) : null);
        break;
        return false;
      }
    };
  };
  // ===========================
}; //End of Class
// ==========================================================================
const Sessions = new SessionStore(process.env.infodir, process.env.info_users);
module.exports.Sessions = Sessions;

const {ProbeSessionDetails, ReportData, CheckForUserFolder} = require('../utils/RequestCheckers.js');
/*======================================================*/
module.exports.VerifyUser = wrapAsync(async function (req, res, next) {
   try {
    // Retrieve user database and merge current user preferences with body object
    const users = Sessions.database();

    if (req.session && req.session.user) { //Any preferences changed on front-end need to be reflected back-end

	  await ProbeSessionDetails(req, res, next);
      let confirmed = false; // Default response, this changes to "next()" if user is verified

      for (let i in users) { // ----------------------------------- Begins loop and first checks if any other users are performing operation, reject request if so
        let user = req.session.user;
        if (Sessions.users[i].operation && req.method !== 'GET') {
          req.clash = { //If another user is performing an operation
            user: Sessions.users[i].name,
            operation: Sessions.users[i].operation
          };

          // -------------------------------- This checks if another user is performing an operation within primary directory, and if so, rejects request with report of which is user is operating
          if (user.residing && user.residing.includes(req.clash.operation.location)
          || req.params.folder && req.params.folder.includes(req.clash.operation.location)) {
            return await ReportData(req, res, false, {
              content: [`${req.clash.user === user.name ? 'You are' : req.clash.user + ' is'} currently performing a ${req.clash.operation.type} operation under the`, 'directory'],
              type: 'error',
              items: [`<span class="dimblue">${Sessions.users[i].residing || req.clash.operation.location}</span>`]
            });
          }

        } //End of: If there was an operation to begin with
        //----------------------------- If user info matches, check for valid folder and continue on to find any "rival" users currently logged in
        if (user.name === users[i].name || user.email === users[i].email) {
          if (!confirmed) {
            confirmed = await CheckForUserFolder(req, res, next);
            Sessions.user(req).operation = {type: req.headers.operation, location: req.params.folder};
          } else continue; //We need to make sure all logged-in users are passed in, so return response ('confirmed') later
        }
      //--------------------- Refresh session and proceed to next route
      };
      await Sessions.refresh(req).catch( err => res.redirect('/login'));
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
 }); //---------- VerifyUser function ends
  /*======================================================*/

  /*======================================================*/
  module.exports.CompareInfo = async function (req, res, next, users) {

    for (let i in users) {

      if (await Verify(users[i].password, req.body.password) && req.body.name.matchesAny(users[i].name, users[i].email)) { //If authentication succeeded and user info matched
        console.log (Sessions)
        console.log (Sessions.user(req))
        if (Sessions.user(req).locked === true || Sessions.user(req).loggedIn === true) {
          //If user is logged in or locked out, log to their private text file and return error

          let date = new Date();

          fs.appendFile(`${process.env.infodir}/${users[i].name}.txt`,
          `Log in attempt failed: ${date.toLocaleDateString()}/${date.toLocaleTimeString()} <> IP: ${req.connection.remoteAddress}\r\n`, (err) => err ? console.log(err) : null);
          //This little chunk above is all just string data for readability when writing to the log
		      req.session.loginAttempts += 1;

          return next( new Error("User found, but is currently logged in, or locked out."));
        } else return await module.exports.UserLogin(req, res, next, users[i]);
      }
    }; //End of For Loop over users

    req.session.loginAttempts += 1;
    return next( new Error("User information incorrect, or user does not exist."));
  };
  /*======================================================*/

  module.exports.UserLogin = async function (req, res, next, user) {
    //Establish session with user info and essential info, update Sessions store, and return.
    req.session.user = user;
    delete(req.session.user.password); // Confidential

    req.session.duration = parseInt(process.env.session_time); //The time until the Session store triggers termination
    // --------------------------------------------------
    if (user.guest) {
      req.session.maxsize = 3 * 1000 * 1000 * 1000; //Gigabytes > Megabytes > Kilobytes > Bytes (5 Gigabytes) max upload size
      req.session.home = UsersDirectory; //Always and only private directory for guest
      req.session.guest = true; //Identifier
    } else {
      req.session.home = user.home || partition; // Last homedirectory they left off at
      req.session.maxsize = 100 * 1000 * 1000 * 1000; // This is only relevant inside private directory. 100 Gigabyte limit.
    }
    // --------------------------------------------------
    req.session.preferences = user.preferences || {
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
  };
