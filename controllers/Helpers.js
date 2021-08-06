const UsersDirectory = process.env.UsersDirectory || 'Users_1';
const {ReportData} = require('./UserHandling.js');
const axios = require('axios');
const fs = require('fs-extra');
// const { networkInterfaces } = require('os');
const find_local = require('local-devices');
const validRegions = ['Idaho', 'Utah', 'Washington', 'Oregon', 'North Carolina', 'Colorado', 'Montana', 'Ontario', 'Saskatchewan', 'Alberta', 'British Columbia', 'Québec'];
let LocalAddresses;
find_local().then( addresses => LocalAddresses = addresses);

module.exports = {

  /*======================================================*/
  Geodetect: function (req, res, next) {

    if (req.session.user) return next();
    req.location = {ip: req.connection.remoteAddress.replaceAll(':', '').replaceAll('f', '')};
    //Remove worthless characters from address string

    if (req.session.user || req.connection.localAddress === req.connection.remoteAddress
    || LocalAddresses.find( local => local.ip === req.location.ip))
    //If already logged in, or client is of a local ip address
      return next();
// --------------------------------------------------------------
    const options = {
      method: 'GET',
      url: 'https://ip-geolocation-ipwhois-io.p.rapidapi.com/json/',
      params: {ip: req.location},
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
  /*======================================================*/

  /*======================================================*/
  CapArraySize: function () {
    //Turns a large array (more that 25 entries) into an integer
    arrays = arguments[0];

    for (let i = 0; i < arrays.length; i++) {
      if (arrays[i].length > 25)
        arrays[i] = `${arrays[i].length}`
      else if (!arrays[i].length)
        arrays[i] = '';
    }

    return arrays;
  },
  /*======================================================*/


  /*===============================================================*/
    CheckIfUpload: async function (req, res, maindir) {
    if (req.body.paths && req.files) {
    //If there aren't, it means no files were uploaded. Not used by any other directory access calls.

      if (!req.files.files || !req.files.files[1]) {
        /*If only one file was uploaded, turn them into arrays*/
        req.files.files = [req.files.files];
        req.body.paths = [req.body.paths];
      }
      for (let i = 0; i < req.files.files.length; i++) //We store the file paths, as they will be referenced within the official "Upload" function next up
        req.files.files[i].path = req.body.paths[i];

      req.body.paths.unshift(maindir); //Make sure the posted directory path is there as well

      return req.body.paths.filter( (value, index) => req.body.paths.indexOf(value) === index);
      //Upon multi-folder uploads, there are often several files with the same folder paths. As we don't need 10-20 iteration attempts at creating one directory path, we filter any duplicates out.

    } else return [maindir];
  },
  /*===============================================================*/

  /*===============================================================*/
    CheckIfTransfer: async function (req, res, maindir) {

      let path = maindir.split('/')[0] + '/' + maindir.split('/')[1];

      //First element should be Users Directory, second should be user's private directory/name
      let userpath = `${UsersDirectory}/${req.session.user.name}`;
      if (req.body.mydirectory && path !== userpath) {
        //If mydirectory selected but input is not correct.
        ReportData(req, res, false, {
          content: [`Requested transfer to private directory:`, `But input not correct. Check spelling, or disable private directory target by unchecking "My Directory" icon.`],
          type: 'error',
          items: userpath
        });
        return false;
      }
      else if (!req.body.transfer && req.body.mydirectory) {
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
       fs.appendFile(`${process.env.infodir}/log.txt`, `(${user}) -> ${message} ${date.toLocaleDateString()}/${date.toLocaleTimeString()}\r\n`);
    }, 5000);
  },
  /*===============================================================*/
}; //----Modules export
