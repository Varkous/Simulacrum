'use strict';
const {ReportData, Sessions} = require('./UserHandling.js');
const {CapArraySize, CheckIfTransfer, EntryToHTML} = require('./Utilities.js');
const {GetFolderSize} = require('./FolderProviders');
const {checkModeType, getFileSize} = require('../scripts/Helpers.js');
const fs = require('fs-extra');
const path = require('path');
const child_process = require("child_process");
const {IncomingForm} = require('formidable');
const uploadOptions = {
  encoding: 'utf-8',
  uploadDir: path.resolve('temp'),
  multiples: true, // req.files to be arrays of files
  maxFileSize: 50000 * 1024 * 1024,
  maxFields: 0,
  keepExtensions: true,
};

const UsersDirectory = process.env.UsersDirectory || 'users';

module.exports = {

  /*===============================================================*/
  AccessDirectory: async function (req, res, next) {

    let directory = req.params.folder + req.params[0];
    let partition = req.session.home || process.env.partition;
    let user = req.session.user;
    let op = req.headers.operation || false;

    req.body.newfolders = req.body.newfolders || new Set();
    //This data is not relevant for any operations back-end, anything code related to 'newfolders' is used solely to create any new Folder Cards on the front-end display for user clarity

    if (req.session.home === UsersDirectory && directory.split('/')[0] !== user.name) {
      return ReportData(req, res, false, {
        content: ["Cannot transfer or submit to other private directories. Be sure to include", `as root of folder input while within your directory`],
        type: 'error',
        items: [user.name]
      });
    }
    partition = await CheckIfTransfer(req, res, directory);
    if (!partition) return false; //Checks if its a transfer, and if user is attempting transfer from public to private. If a conflict occured, partition will actually be "false", and therefore abort request.
// ------------------------------------------------------------------------------
      try {

        fs.access(`${partition}/${directory}`, fs.constants.R_OK | fs.constants.W_OK, async (error) => {
        // To check if the given directory already exists or not.\

          if (error) {
            fs.mkdir(`${partition}/${directory}`, {recursive: true}, (err, dir) => {
              if (err) return next(err);

              let relativeFolder = directory.replace(user.residing, '').replace('/', '').split('/')[0];
              //Simple code, but deceptive concept. The goal is to find any new directories created that are DIRECT children of the current posting directory (the folder the user is residing in), anything deeper should  be displayed, as page will only show relative directories
              // ------------------------------------------------------------------------------

              fs.chown(`${partition}/${directory}`, user.uid, 100);
              if (!op) {
                return ReportData(req, res, false, {
                  content: [`Directory`, `created`],
                  type: 'success',
                  items: [`<span style="color: ${process.env.folder_color};">${directory}</span>`],
                  newfolders: relativeFolder,
                });
              } else if (op === 'Transfer')
                return module.exports.SetupTransfer(req, res, partition);
              else return true;
            });
          }
          // ------------------------------------------------------------------------------
          else if (op && op === 'Transfer') {
            return module.exports.SetupTransfer(req, res, partition);
          }
          // ------------------------------------------------------------------------------
          else { //If no error, then user is trying to create new directory, check permission

            if (op) {
              return true;
            } else fs.stat(`${partition}/${directory}`, (err, stats) => {

              if (err)
                return ReportData (req, res, false, {
                  content: ["Could not find directory data. May have been deleted since query.", "Operation aborted"],
                  type: 'error'});

              else if (!op) {
                fs.readdir(`${partition}/${directory}`, (err, entries) => {
                  return ReportData (req, res, false, {
                    content: [`Directory already exists. ${entries.length ? 'Items within:' : 'Empty.'}`],
                    type: 'warning',
                    items: entries || '',
                  });
                });
              } else return next();
            });

          } //End of: Else if no error
        });//End of: Attempt to access folder
        // ------------------------------------------------------------------------------
      } catch (e) {
        return next(e);
      }
  }, //-------End of: Make Directory
/*===============================================================*/

/*===============================================================*/
  Upload: async function (req, res, next) {
    //Every operational post request (Upload, Transfer, New Directory) goes through this route. We do basic check below to determine how to route operation

    let op = req.headers.operation || false;

    if (!op || op === 'Transfer') {
      return await module.exports.AccessDirectory(req, res, next);
    }
// ------------------------------------------------------------------------------ If operation is an Upload, everything below is activated
      await module.exports.AccessDirectory(req, res, next); //To perform initial check of main directory permission
      let user = req.session.user;

      const Uploader = new IncomingForm(uploadOptions); // Options for handling form-data payload
      Uploader.parse(req, async (error, fields, files) => { //This will collect all multipart form data, and sends all uploaded files to the temporary directory with a random name, maintaining extension

        req.files = Object.values(files)[0]; // Object structure is weird, had to do this
        if (!Array.isArray(req.files))
          req.files = [req.files];

          const filesToWrite = req.files.map( async (file, i, arr) => { //Map over every uploaded file
            return new Promise( async (resolve, reject) => { //Promise allows for parallel operation, rather than waiting for each file subsequently
              let filename = file.name.substring(file.name.lastIndexOf('/')).replace('/', '');
              let newpath = path.resolve(req.session.home, file.name);

              const read = fs.createReadStream(file.path);
              const write = fs.createWriteStream(newpath);
              read.pipe(write); //Pipe buffer data from temp file path to new path specified in name

              read.on("error", (err) => {
                console.log (err.message);
                fs.unlink(file.path, err => false);
                return resolve({name: filename, uploaded: false});
              }).on("close", () => {
                fs.unlink(file.path, err => false);
                return resolve({name: filename, uploaded: true});
              });
            }); //End of Promise
          }); //End of file mapping
        // --------------------------------------------
        req.files = await Promise.all(filesToWrite); //After all file uploads have finished piping (or returned error)

        if (!req.files.length) return ReportData(req, res, false, {
            content: ["No files staged for upload"],
            type: 'error'
          });
        else return next(); //Report data is in req.files, so we move on to closing route handler
      });
// ------------------------------------------------------------------------------
      Uploader.on("file", async (field, file) => {
        let dirPath = file.name.substring(0, file.name.lastIndexOf('/')); //File name contains path, so we strip the actual file NAME out, so all we get is path
        if (!fs.existsSync(path.resolve(req.session.home, dirPath))) {
          //If the requested upload path (within name) does not exist, make the directory. This occurs while file data is still being parsed
          fs.mkdir(path.resolve(req.session.home, dirPath), {recursive: true}, (error) => {
            let relativeFolder = dirPath.replace(user.residing, '').replace('/', '').split('/')[0];
            //Simple code, but deceptive concept. The goal is to find any new directories created that are DIRECT children of the current posting directory (the folder the user is residing in), anything deeper should  be displayed, as page will only show relative directories
            // ------------------------------------------
            if (!req.body.newfolders.has(relativeFolder))
              req.body.newfolders.add(relativeFolder);
          });

        }
      });
// ------------------------------------------------------------------------------
      Uploader.on("field", async (field, property) => {
        if (field === 'preferences')
          req.session.preferences = JSON.parse(property);
      });
// ------------------------------------------------------------------------------
    Uploader.on('error', async (err) => {
      if (err.message.includes('maxFileSize')) {
        return ReportData(req, res, false, {
          content: [`Cannot upload more than`, `at a time`],
          type: 'error',
          items: [getFileSize(uploadOptions.maxFileSize)]
        });
      } else next(err);
    });
  },
/*===============================================================*/

/*===============================================================*/
ZipAndDownload: async function (req, res, files, userDir) {

  let stream;
  const filesToDownload = files.map( (file, i, arr) => {
    //Go through each file under a promise for parallel processing

    const src = path.resolve(req.session.home, file.path, file.name);
    const dest = `${userDir}/${file.name}`;
// ------------------------------------------------------------- If file is already copied, resolve true, if not, copy it, any errors reject file that caused it
    return new Promise( async function (resolve, reject) {
      if (!fs.existsSync(src)) { //If copied file doesn't exist, return it as missing
        return resolve({name: file.name, missing: true});
      } else if (fs.existsSync(dest)) {
        return resolve({name: file.name, copied: true});
      } //If the file is already present, skip
      else fs.copy(src, dest, async (err) => { //Copy to staging user staging directory
        if (err) return reject(err.message);
        else return resolve({name: file.name, copied: true});
      });
    });

  }); //End of file mapping
    // ------------------------------------------------------------- //When all files to be downloaded have finished
  await Promise.all(filesToDownload).then( async (files) => {
      if (files.filter( file => file.missing).length) {
        //If any files attempted to be extracted actually do not exist (failed to be copied), reject request with error report
        return ReportData(req, res, false, {
          content: ["Problem, some files selected for download: ", 'Do not exist in location, either deleted or moved already'],
          type: 'error',
          items: files.filter( file => file.missing).filter( file => file.name)
        });
      // ---------------------------------------------------------
    } else return new Promise( function (resolve, reject) {
// -x!*.zip
      let zipOptions;
        if (process.platform === 'win32') {
          zipOptions = fs.existsSync(`${userDir}/Files.zip`) //If the zip file already exists
          ? `u -mmt -sdel -uz0 -so -r -mx1 ${userDir}/Files.zip *` //Update archive
          // Update > Multithread > Delete after > Ignore if file already archive > Stream Output > Recursive > Compression LVl 1 > Zip Name > All Files
          :`a -mmt -sdel -so -r -mx1 ${userDir}/Files.zip *`; //Create new archive
          // Add > Multithread > (Rest of switches are same as above command)
        } else {
          zipOptions = fs.existsSync(`${userDir}/Files.zip`) //If the zip file already exists
          ? `-u -r -m -1 - *` //Update archive
          :`-r -m -1 - *`; //Create new archive
        }

        stream = child_process.spawn(process.platform === 'win32' ? '7z' : 'zip', zipOptions.split(' '), {cwd: userDir, detached: true, encoding: 'buffer'});

        res.setHeader('Bullshit', GetFolderSize(req, userDir, 0) * 75 / 100);
        //Begin streaming to client, 'Bullshit' header gives approximate time wait
        stream.stdout.pipe(res).on("finish", () => {
          fs.rmdir(userDir, {recursive: true, force: true}, (err) => err ? console.log (err) : null); //Delete archive after being sent to user
          let downloaded = CapArraySize(files.filter( file => file.copied).filter( file => file.name))
          Sessions.user(req).log.push(`Successfully downloaded ${downloaded}`);
          //Could not send usual Report Data, so needed to update these two properties manually
          Sessions.user(req).operation = false;
          return resolve('Compression complete');
        }).on("error", (err) => reject( ReportData(req, res, err))); //Error if problem on download stream

    }); //Promise for: After all files have been copied to staging
  }).catch( (err) => next(err)); //If there was an error thrown by file copying, crash server
},
/*===============================================================*/

/*===============================================================*/
  SetupTransfer: async function (req, res, partition) {

    const {destination} = req.body;

    if (fs.existsSync(`${partition}/${destination}`) === false)
      return ReportData(req, res, false, {
        content: [`Transfer aborted. Directory <span style="color: ${process.env.folder_color};">${destination}</span> was not found, or does not exist`],
        type: 'error'
      });
    let action = req.body.copy ? 'copied' : 'moved';
    req.body.transfers = await module.exports.TransferItems(req, res, partition);
    //After all is said and done, gather any successful/failed/already established items for front-end to display results report to user on browser

    let transfers = req.body.transfers.map( (item) => item.transferred ? EntryToHTML(item) : null).filter(Boolean);
    let paths = req.body.transfers.map( (item) => item.transferred ? item.path : null).filter(Boolean);
    let failed = req.body.transfers.map( (item) => item.failed ? EntryToHTML(item) : null).filter(Boolean);
    let already = req.body.transfers.map( (item) => item.already ? EntryToHTML(item) : null).filter(Boolean);

      [transfers = [], failed = [], already = []] = await CapArraySize([transfers, failed, already]);
// ------------------------------------------------------------------------------
        if (transfers.length && failed.length)
          return ReportData (req, res, false, {
            content: [`successfully ${action}`, `to <span style="color: ${process.env.folder_color};">${destination}</span>. <hr> <span style="color: #e0e082 !important;">${failed + already}</span> were not successful`], type: 'warning', items: transfers, incomplete: failed.concat(already), paths: paths
          });
// ------------------------------------------------------------------------------
        else if (failed.length > 0 && !transfers.length)
          return ReportData (req, res, false, {
            content: [`Failed to move`, `to <span style="color: ${process.env.folder_color};">${destination}</span>. Check permission, verify item location, or try copying instead.`], type: 'error', items: failed
          });
// ------------------------------------------------------------------------------
        else return ReportData (req, res, false, {
          content: [`${transfers ? `Successfully ${action}` : 'Cancelled.'}`, `${transfers ? `to <span style="color: ${process.env.folder_color};">${destination}</span>`: ''}<hr>${already.length ? [...already]  + ' already within that directory': ''}`],
          type: 'success', items: transfers, paths: paths, incomplete: already
        });

  }, //End of: Transfer function
/*===============================================================*/

/*===============================================================*/
TransferItems: async function (req, res, partition) {

  const {items, destination} = req.body;

  if (!Array.isArray(items)) items = [items];
  const itemsToTransfer = items.map( (item, i, arr) => {
    //The items could be either files or folders.
    return new Promise( (resolve, reject) => {

      let oldpath = path.resolve(req.session.home, item.path, item.name);
      let newpath = path.resolve(partition, destination, item.name);

      fs.stat(oldpath, async (err, stats) => {

        if (err) return resolve({name: item.name, color: item.color, failed: true});

        if (stats.isDirectory()) { // Diff colors for files/folders, just for looks
          item.color = process.env.folder_color;
        } else item.color = process.env.file_color;
  // -----------------------------------------------------------------------------  If copying the item
        if (fs.existsSync(newpath)) //Then don't override current item, as it may belong to another user
          return resolve({name: item.name, color: item.color, already: true});
          // --------------------------------------------
          if (req.body.copy) { //COPY item

            if (item.color === process.env.folder_color) {
              fs.copy(oldpath, newpath, async (error) => {
                  if (error) {
                    console.log ('file failed', error.message);
                    return resolve({name: item.name, color: item.color, failed: true});
                  }
                  else {
                    fs.chown(newpath, req.session.user.uid, 100);
                    return resolve({name: item.name, path: item.path, color: item.color, transferred: true});
                  }
              });
            } // --------------------------------------------
            else fs.copyFile(oldpath, newpath, async (error) => {
                if (error) {
                  console.log ('file failed', error.message);
                  return resolve({name: item.name, color: item.color, failed: true});
                }
                else {
                  fs.chown(newpath, req.session.user.uid, 100);
                  return resolve({name: item.name, path: item.path, color: item.color, transferred: true});
                }
            });

          } //End of if copy
          // ----------------------------------------------------------------------------- Simply MOVE the item to the destination folder, any error means item transfer failed
          else {
            if (stats.uid !== req.session.user.uid)
              return resolve({name: item.name, failed: true});

            fs.rename(oldpath, newpath, async (error) => {
              if (error) return resolve({name: item.name, color: item.color, failed: true});
              else return resolve({name: item.name, path: item.path, color: item.color, transferred: true});
            });

          }
      }); //End of stat/item existence check
// -----------------------------------------------------------------------------
    }); //End of Promise
  }); //End of file mapping
  return await Promise.all(itemsToTransfer);
},
/*===============================================================*/

/*===============================================================*/
  IterateDelete: async function (req, res, files) {

    let stats;
  // ------------------------------------------------------------------------------
    const filesToDelete = files.map( (file, i, arr) => {
      return new Promise( (resolve, reject) => {

        let fullpath = `${req.session.home}/${file.path}/${file.name}`;
        if (fs.existsSync(fullpath))
          stats = fs.statSync(fullpath);
        else return resolve({
          name: file.name,
          status: 'notFound',
          color: file.name.includes('.') ? process.env.file_color : process.env.folder_color
        });  //If item does not exist

        let mode = stats.mode.toString();
        // ------------------------------------------------------------------------------
        if (req.session.user.uid !== stats.uid && req.session.user.admin === false) //If user does not own the item
          return resolve({name: file.name, status: 'noPermission', color: 'yellow'});
        // ------------------------------------------------------------------------------
          //If there were no Auth' problems/specificity errors, we proceed to remove the targeted file.
          if (checkModeType(mode) === 'file') {
            fs.unlink(fullpath, async (err) => {
              if (err) return resolve({name: file.name, status: 'failed', color: process.env.file_color});
              else {
                await module.exports.DeleteFolderIfEmpty(req, `${req.session.home}/${file.path}`);
                return resolve({name: file.name, status: 'deleted', color: process.env.file_color});
              }
            });
          }
        // ------------------------------------------------------------------------------
          else if (checkModeType(mode) === 'folder') { //Then it's a folder, and we remove directory
            fs.rmdir(fullpath, { recursive: true }, async (err) => {
              if (err) return resolve({name: file.name, status: 'failed', color: process.env.folder_color});
              else {
                await module.exports.DeleteFolderIfEmpty(req, `${req.session.home}/${file.path}`);
                return resolve({name: file.name, status: 'deleted', color: process.env.folder_color});
              }
            });
          }
        // ------------------------------------------------------------------------------
      }); //End of Promise
    }); //End of item mapping
    return await Promise.all(filesToDelete); //No rejects, so each item will always return an object with a status property that may differ

  },
/*===============================================================*/

/*===============================================================*/
  DeleteFolderIfEmpty: async function (req, dirpath) {
    const user = req.session;
    fs.readdir(dirpath, async (error, items) => {
      if (error) throw error;
      if (!items || items.length === 0
      && dirpath !== `${UsersDirectory}/${user.user.name}`) {
        //If folder is empty after file deletion (and it doesn't happen to be the partition/home folder itself), remove directory as well
        try {
          fs.rmdirSync(path.resolve(dirpath));
        } catch (e) {
          return false;
        } finally {
          return true;
        }

      } else return false;
    });
  },
/*===============================================================*/

/*===============================================================*/
  Rename: async function (req, res, oldpath, newpath) {
    let color, problem;

    if (fs.statSync(oldpath).isDirectory()) {
      //Aesthetic purposes
      color = `${process.env.folder_color}`;
      req.body.directory = true;
    } else color = `${process.env.file_color}`;

    try {
      await fs.renameSync(oldpath, newpath);
    } catch (error) {
      error.message = error.message.replace(__dirname, '');
      problem = error;
    } finally {

      if (problem) return ReportData(req, res, false, {
          content: [`Could not rename: <span style="color: ${color}">${req.body.old}</span>.`, `Remove sub-directories first`],
          type: 'error',
        });

      else return ReportData(req, res, false, {
          content: ['Item:', `renamed to <span style="color: ${color}">${req.body.new}</span>`],
          type: 'success',
          items: [`<span style="color: ${color}">${req.body.old}</span>`],
          path: req.body,
        });
    };
  },
/*===============================================================*/

}; //----Modules export
