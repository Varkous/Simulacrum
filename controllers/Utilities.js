'use strict';
const {ReportData, Sessions} = require('./UserHandling.js');
const {getFileSize} = require('../scripts/Helpers.js');
const {CloseServer, worthlessURLS} = require('../index.js');

const axios = require('axios');
const fs = require('fs-extra');
const find_local = require('local-devices');
const compression = require('compression');
const checkDiskSpace = require('check-disk-space').default;

const validRegions = ['Idaho', 'Utah', 'Washington', 'Oregon', 'North Carolina', 'Colorado', 'Montana', 'Ontario', 'Saskatchewan', 'Alberta', 'British Columbia', 'Québec'];
const UsersDirectory = process.env.UsersDirectory || 'users';
const partition = process.env.partition;
/*===============================================================*/
let LocalAddresses = [];
if (process.env.NODE_ENV === "production") {
  find_local().then( addresses => LocalAddresses = addresses);
}
/*===============================================================*/
process.checkPartitions = setInterval( async function () {
// Check disk space of Users and Public partitions and see if they have dropped to critical levels of space (50 gigabytes), trigger 1-minute-pending server shutdown if so

  let publicPartition = checkDiskSpace(path.resolve(partition)).then( (space) => {
    if (space.free < (50 * 1000 * 1000 * 1000)) { // Gigabytes
      clearInterval(process.checkPartitions);
      return module.exports.CloseServer('Public Partition reached critical levels of disk space, server shutting down for Director intervention', 180000);
    }
  });

  let usersPartition = checkDiskSpace(path.resolve(UsersDirectory)).then( (space) => {

    if (space.free < (50 * 1000 * 1000 * 1000)) { // Gigabytes
      clearInterval(process.checkPartitions);
      return module.exports.CloseServer('Users Partition reached critical levels of disk space, server shutting down for Director intervention', 60000);
    }
  });

}, 5000);

/*===============================================================*/
module.exports = {

  /*===============================================================*/
  Geodetect: function (req, res, next) {
  	let client = req.connection;
    req.location = {ip: client.remoteAddress.replace(/[:f]/g, '')};

    if (req.session.user) return next(); //If already logged in

    else if (client.localAddress === client.remoteAddress || req.location.ip.includesAny(...LocalAddresses)) {
    // Or client is of a local ip address
      return next();
    }
// --------------------------------------------------------------
    const options = {
      method: 'GET',
      url: 'https://ip-geolocation-ipwhois-io.p.rapidapi.com/json/',
      params: {ip: req.location.ip},
      headers: {
        'x-rapidapi-host': process.env.geohost,
        'x-rapidapi-key': process.env.geokey
      }
    };
    //The request data sent to the ipwhois API, using our key
// --------------------------------------------------------------
    axios.request(options).then( (location) => {
    //If successful, store the essential location data within the request object for later use

      if (location.data.country.includesAny('United States', 'Canada') && location.data.region.includesAny(...validRegions)) {
        req.location.country = location.data.country;
        req.location.region = location.data.region;
        return next();
      } else throw new Error('Your region is not permitted access to Simulacrum.');

    }).catch( (error) => {
      console.log(error)
      //return next(error);
      return next(error);
    });
// --------------------------------------------------------------
  },
  /*===============================================================*/

  /*===============================================================*/
  CapArraySize: function () {
    //The 'arguments' should always be arrays. Each iteration turns a large array (more that 25 entries) into an integer of its length. If only one array was passed, just return it instead of an array of arrays
    let arrays = [];
    for (let array of arguments) {
      if (array.length > 25)
        arrays.push(`${array.length}`);
      else arrays.push(array.length ? array : '');
    }

    return arrays.length > 1 ? arrays : arrays[0];
  },
  /*===============================================================*/

  /*===============================================================*/
    EntryToHTML: function (item, color = 'lightblue', divider = '') {
      return `<span style="color: ${item.color || color}">${item.name || item}</span>` + divider;
    },
  /*===============================================================*/

  /*===============================================================*/
    Compress: function (req, res) {
      if (req.headers['x-no-compression']) return false
      else return compression.filter(req, res)
    },
  /*===============================================================*/

  /*===============================================================*/
    CheckIfTransfer: async function (req, res, directory) {

      let target = directory.split('/')[0] + '/' + directory.split('/')[1];

      //First element should be Users Directory, second should be user's private directory/name
      let userpath = `${UsersDirectory}/${req.session.user.name}`;
      if (req.body.mydirectory && target !== userpath) {
        //If mydirectory selected but input is not correct.
        ReportData(req, res, false, {
          content: [`Requested transfer to private directory:`, `But input not correct. Check spelling, or disable private directory target by unchecking "User Directory" icon.`],
          type: 'error',
          items: userpath
        });
        return false;
      }
      else if (req.headers.operation !== 'Transfer' && req.body.mydirectory) {
        //Only transferring from public to private allowed, submission/uploading is not, because why not just do that within the private directory itself?
         ReportData(req, res, false, {
          content: ['Can only TRANSFER items from public to private directory'],
          type: 'error'
        });
        return false;
      } else if (req.body.mydirectory) return '.';

      return req.session.home || process.env.partition;
    },
  /*===============================================================*/

  /*===============================================================*/
  //Just writes the error to the general log. Barred by timeout so rapidly repeated requests of the same type (page refreshes) won't bloat up the log with duplicate info
  WriteLogFilter: async function  (user, message) {
    const date = new Date();

    clearTimeout(process.logWrite);
    process.logWrite = setTimeout( () => {
       fs.appendFile(`${process.env.infodir}/log.txt`, `(${user || 'Anonymous'}) -> ${message} ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`);
    }, 5000);
  },
  /*===============================================================*/

  /*===============================================================*/
  ExitHandler: function (error) {
    if (error)
      console.log((new Date).toUTCString() + ' uncaughtException:', error)

    for (let i in Sessions.users) {
      Sessions.users[i].loggedIn = false;
      Sessions.users[i].locked = false;
	  process.sessionTimers[Sessions.users[i].name] ? process.sessionTimers[Sessions.users[i].name]._onTimeout() : null;
    }

    module.exports.ClearTemp (path.resolve('temp'));
    process.exit(0, 'SIGTERM');
    return CloseServer('Server shutting down', true);
  },
  /*===============================================================*/

  /*===============================================================*/
  ClearTemp: async function (temp) {

    fs.readdir(temp, (err, files) => {
      if (err) throw err;

      for (const file of files) {
        let filepath = temp + `/${file}`
        if (fs.statSync(filepath).isDirectory()) {
          fs.rmdir(filepath, {recursive: true}, err => {
            if (err) throw err;
          });
        }
        else fs.unlink(filepath, err => err ? console.log (err) : null);
      }
    });
  },
  /*===============================================================*/

  /*===============================================================*/
  CheckSessionAndURL: async function (req, res, next) {

    const url = req.baseUrl;
// ----------
    if (url.includesAny(worthlessURLS))
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
      if (url === `/${partition}` || url === `/${partition}/${ses.user.name}`) {
        ses.user.residing = partition === UsersDirectory ? ses.user.name : '/';
        //Homepage represents top-level partition, so redirect there if partition was input as url
      }
     return next();
    } else return res.redirect('/login');

  },
  /*===============================================================*/

  /*===============================================================*/
  CloseServer: async (reason = 'Felt like it', time = process.env.exit_time) => {
    clearTimeout(process.shutdown);

    let shutdownTime = new Date().getTime() + parseInt(time);
    if (time === true) shutdownTime = 1000;

    process.ServerTracker.status = 0;
    process.ServerTracker.countdown = Math.floor( shutdownTime / 60000); //Convert to minutes
    process.ServerTracker.warning = reason;

    process.shutdown = setTimeout( () => {
      process.exit(0, 'SIGTERM');
      Website.routes.BaseHandlers.server.close( () => console.log ('Server terminated'));
    }, parseInt(time));
  },
  /*===============================================================*/

}; //----Modules export
