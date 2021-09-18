'use strict';
/*===============================================================
  Had to create own method for just simply getting last element of given array.
===============================================================*/
Array.prototype.last = function (index) {return index ? this.length - 1 : this[this.length - 1]};
const {ReportData, Sessions} = require('./UserHandling.js');
const {CloseServer} = require('../index.js');
const axios = require('axios');
const fs = require('fs-extra');
const find_local = require('local-devices');
const compression = require('compression');

const validRegions = ['Idaho', 'Utah', 'Washington', 'Oregon', 'North Carolina', 'Colorado', 'Montana', 'Ontario', 'Saskatchewan', 'Alberta', 'British Columbia', 'Québec'];
const allExtensions =  [
  '.bat','.apk','.com','.jpg','.jpeg','.exe','.doc','.docx','.docm','.rpp','.html','.z','.pkg','.jar','.py','.aif','.cda','.iff','.mid','.mp3','.flac','.wav','.wpl','.avi','.flv','.h264','.m4v','.mkv','.mov','.mp4','.mpg','.rm','.swf','.vob','.wmv','.3g2','.3gp','.doc','.odt','.msg','.pdf','.tex','.txt','.wpd','.ods','.xlr','.xls','.xls','.key','.odp','.pps','.ppt','.pptx','.accdb','.csv','.dat','.db','.log','.mdbdatabase','.pdb','.sql','.tar','.bak','.cabile','.cfg','.cpl','.cur','.dll','.dmp','.drve','.icns','.ico','.inile','.ini','.info','.lnk','.msi','.sys','.tmp','.cer','.ogg','.cfm','.cgi','.css','.htm','.js','.jsp','.part','.odb','.php','.rss','.xhtml','.ai','.bmp','.gif','.jpeg','.max','.obj','.png','.ps','.psd','.svg','.tif','.3ds','.3dm','.cpp','.h','.c','.C','.cs','.zip','.rar','.7z'
];
const UsersDirectory = process.env.UsersDirectory || 'users';
const worthlessURLS = ['/fonts', '/favicon.ico', ...allExtensions];
let LocalAddresses;
if (process.env.NODE_ENV === "production") {
  find_local().then( addresses => LocalAddresses = addresses);
}

module.exports = {

  /*===============================================================*/
  Geodetect: function (req, res, next) {

    req.location = {ip: req.connection.remoteAddress.replace(/[:f]/g, '')};
    if (req.session.user) return next();

    else if (req.connection.localAddress === req.connection.remoteAddress
    || LocalAddresses.find( local => req.location.ip.includes(local.ip)))
    //If already logged in, or client is of a local ip address
      return next();
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
      if (location.data.country === 'United States' || 'Canada'
      && validRegions.find( (v_region) => v_region === location.data.region)) {
        req.location.country = location.data.country;
        req.location.region = location.data.region;
        return next();
      } else throw new Error('Your region is not permitted access to Simulacrum.');

    }).catch( (error) => {
      return next(error);
    });
// --------------------------------------------------------------
  },
  /*===============================================================*/

  /*===============================================================*/
  CapArraySize: function () {
    //Turns a large array (more that 25 entries) into an integer
    const arrays = arguments[0];

    for (let i = 0; i < arrays.length; i++) {
      if (arrays[i].length > 25)
        arrays[i] = `${arrays[i].length}`
      else if (!arrays[i].length)
        arrays[i] = '';
    }

    return arrays;
  },
  /*===============================================================*/

  /*===============================================================*/
    EntryToHTML: function (item, color) {
      return `<span style="color: ${item.color || color}">${item.name || item}</span>`;
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
  ExitHandler: function (err) {
    if (err)
      console.log((new Date).toUTCString() + ' uncaughtException:', err.message)

    for (let i in Sessions.users) {
      if (!Sessions.users[i].session_id) {
        Sessions.users[i].loggedIn = false;
        continue;
      } else process.sessionTimers[Sessions.users[i].session_id]._onTimeout();
    };
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

    // req.session.user = {name: 'Stroggon', uid: 0, admin: true, residing: 'Achelon'};
    // req.session.log = req.session.log || [];
    //   req.session.preferences = {
    //     outsideDir: false,
    //     emptyDir: false,
    //     smoothTransition: true,
    //     deleteCheck: true,
    //     uploadWarning: true,
    //   };
    // req.session.firstVisit = false;
    // req.session.home = process.env.partition;
    // req.session.loginAttempts = 0;
    const url = req.baseUrl;
// ----------
    if (worthlessURLS.find( skip_url => url.includes(skip_url)))
      return next();
    //These are unnecessary requests made by browser, dismiss them
// ----------
    if (url === '/login' || url === '/signout' || req.session && url === '/all/undefined' || req.session && url === '/all')
      return next();
// ----------
    if (!req.session || req.session.user && Sessions.user(req).loggedIn === false) {
      return res.redirect('/signout');
    }
    // -------------------------------------
    const partition = req.session.home || process.env.partition
    if (req.session && req.session.user) {
      Sessions.user(req).loggedIn = true;
      if (url === `/${partition}` || url === `/${partition}/${req.session.user.name}`) {
        req.session.user.residing = partition === UsersDirectory ? req.session.user.name : '/';
        //Homepage represents top-level partition, so redirect there if partition was input as url
      }
     return next();
    } else return res.redirect('/login');

  },
  /*===============================================================*/

}; //----Modules export
