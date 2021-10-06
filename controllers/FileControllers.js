'use strict';
const {ReportData, Sessions} = require('./UserHandling.js');
const {CapArraySize, CheckIfTransfer, EntryToHTML, WriteLogFilter} = require('./Utilities.js');
const {GetFolderSize} = require('./FolderProviders');
const {checkModeType, getFileSize, accumulateSize} = require('../scripts/Helpers.js');
const fs = require('fs-extra');
const path = require('path');
const child_process = require("child_process");
const {IncomingForm} = require('formidable');
let uploadOptions = {
encoding: 'utf-8',
uploadDir: path.resolve('temp'),
multiples: true, // req.files to be arrays of files
maxFileSize: 10000 * 1000 * 1000, // 10 Gigabyte max upload
maxFields: 0,
keepExtensions: true,
};
const UsersDirectory = process.env.UsersDirectory || 'users';

module.exports = {

  /*===============================================================*/
  AccessDirectory: async function (req, res, next) {

	if (req.reject) return false;
    let directory = req.params.folder + req.params[0];
    let partition = req.session.home || process.env.partition;
    let user = req.session.user;
    let ses = req.session;
    let op = req.headers.operation || false;

    req.body.newfolders = req.body.newfolders || new Set();
    //This data is not relevant for any operations back-end, anything code related to 'newfolders' is used solely to create new Folder Cards on the front-end display for user clarity

    if (req.session.home === UsersDirectory && directory.split('/')[0] !== user.name) { //This occurs when attempting to transfer/submit outside your own private directory, while within private directory
      return ReportData(req, res, false, {
        content: ["Cannot transfer or submit to other private directories. Be sure to include", `as root of folder input while within your directory`],
        type: 'error',
        items: [user.name]
      });
    }
    partition = await CheckIfTransfer(req, res, directory);
    if (!partition) return false; //Checks if its a transfer, and if user is attempting transfer from public to private. If a conflict occured, partition will actually be "false", and therefore abort request
// ------------------------------------------------------------------------------
      try {

        fs.access(`${partition}/${directory}`, fs.constants.R_OK | fs.constants.W_OK, async (error) => {
        // To check if the given directory already exists or not

          if (error) {
            fs.mkdir(`${partition}/${directory}`, {recursive: true}, (err, dir) => {
              if (err) return next(err);


              let relativeFolder = directory.replace(user.residing, '').replace('/', '').split('/')[0];
    		  //Simple code, but deceptive concept. The goal is to find any new directories created that are DIRECT children of the current posting directory (the folder the user is residing in), anything deeper should  be displayed, as page will only show relative directories
              // ------------------------------------------------------------------------------
              if (!req.body.newfolders.has(relativeFolder))
                req.body.newfolders.add(relativeFolder);

              fs.chown(path.resolve(partition, directory), user.uid, 100, (err) => err ? console.log(err) : false);
              if (!op) { // If no operation, user was just creating a folder, and nothing else
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
                fs.readdir(`${partition}/${directory}`, {withFileTypes: true}, (err, entries) => {
                  if (err) return ReportData(req, res, err);
                  entries = entries.map( e => e.isDirectory() ? EntryToHTML(e.name, '#22a0f4', '<br>') : e.name);

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
    let user = req.session.user; //Ease of access
    let ses = req.session; //Ease of access
    let op = req.headers.operation || false;

    if (!op || op === 'Transfer') {
      return await module.exports.AccessDirectory(req, res, next);
    }
// ---------------------------------------------------------------------------- If operation is an Upload, everything below is activated
      await module.exports.AccessDirectory(req, res, next); //To perform initial check of main directory permission

      const filesToWrite = [];
      const Uploader = new IncomingForm(uploadOptions); // Options for handling form-data payload

      Uploader.parse(req, async (error) => { // This actually occurs before anything else, but the functionality within does not trigger until every file has been acquired from the upload stream

       if (!error) {
        req.files = await Promise.all(filesToWrite); //After all file uploads have finished piping (or returned error)
        if (!req.files.length) return ReportData(req, res, false, {
            content: ["No files staged for upload"],
            type: 'error'
          });
        else return next(); //Report data is in req.files, so we move on to closing route handler
       }
      }); //End of File Parse
// ------------------------------------------------------------------------------
    Uploader.on("fileBegin", async function (field, file) {
     try {
      	// ------------------------------------------------------------------------------
      let dirPath = file.name.substring(0, file.name.lastIndexOf('/')); //File name contains path, so we strip the actual file NAME out, so all we get is path
      let filename = file.name.replace(dirPath + '/', ''); //Opposite of above, just the file name
      let newpath = path.resolve(ses.home, file.name); //Neither of above (or both), gets full absolute path
// ------------------------------------------------------------------------------
		  if (fs.existsSync(newpath) && fs.statSync(newpath).uid !== user.uid) {
			return filesToWrite.push({name: filename, path: dirPath, denied: true});
		  } else {
	      file.path = newpath; // Important, this sets the targeted destination, else it goes to temp folder
	  	  file.name = filename;
		  }
// ------------------------------------------------------------------------------
    	filesToWrite.push(new Promise( async (resolve, reject) => { // For parallel processing
        let newfolder = path.resolve(ses.home, dirPath);
		  if (!fs.existsSync(newfolder)) {
		    // ------------------------------------------
		    fs.mkdirSync(newfolder, {recursive: true, force: true}) //If the requested upload path (within name) does not exist, make the directory. This occurs while file data is still being parsed
        fs.chown(newfolder, user.uid, 100, (err) => err ? console.log(err) : false);
        let relativeFolder = dirPath.replace(user.residing, '').replace('/', '').split('/')[0];
        //Simple code, but deceptive concept. The goal is to find any new directories created that are DIRECT children of the current posting directory (the folder the user is residing in), anything deeper should  be displayed, as page will only show relative directories

		    if (!req.body.newfolders.has(relativeFolder))
		      req.body.newfolders.add(relativeFolder);

		    return resolve({name: filename, path: dirPath, uploaded: true});
		  } else return resolve({name: filename, path: dirPath, uploaded: true});
// ------------------------------------------------------------------------------
		  }));
     } catch (err) {console.log(err)};
    });
// ------------------------------------------------------------------------------
      Uploader.on("field", async (field, property) => { // The usual 'req.body' is now locked away in the 'fields' object, and preferences would not get updated without this
        if (field === 'preferences')
          req.session.preferences = JSON.parse(property);
      });
// -----------------------------------------------------------------------------
      Uploader.on('aborted', async () => console.log('aborted'));
// -----------------------------------------------------------------------------
      Uploader.on('error', async (err) => {

      	WriteLogFilter(user.name, err.message);
        if (err.message && err.message.includes('maxFileSize')) { //Special error report if max size was exceeded. Otherwise send it through error handler
          return ReportData(req, res, false, {
            content: [`Cannot upload more than`, `at a time`],
            type: 'error',
            items: [getFileSize(uploadOptions.maxFileSize)]
          });
        } else next(err);
      });
// -----------------------------------------------------------------------------
  if (req.reject) { // If error occured prior to Upload parsing, reject will be true. This will inform the Uploader to emit error and cancel upload
   	Uploader.onPart = function (part) {
   	  this.emit('error', `Aborted. Upload would exceed your maximum (${getFileSize(req.session.maxsize)}) capacity. Remove files to free up space`);
	};
  }
// -----------------------------------------------------------------------------
  },
/*===============================================================*/

/*===============================================================*/
ZipAndDownload: async function (req, res, files, userDir) {
 try {
  const ses = req.session;
  const filesToDownload = files.map( (file, i, arr) => {
    //Go through each file under a promise for parallel processing
    const src = path.resolve(ses.home, file.path, file.name);
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
    // ------------------------------------------------------------- When all files to be downloaded have finished transfer
  await Promise.all(filesToDownload).then( async (files) => {
      if (files.filter( file => file.missing).length) {
        //If any files attempted to be extracted actually do not exist (failed to be copied), reject request with error report
        return ReportData(req, res, false, {
          content: ["Problem, some files selected for download: ", 'Do not exist in location, either deleted or moved already'],
          type: 'error',
          items: files.map( file => file.missing)
        });
      // ---------------------------------------------------------
    } else return new Promise( function (resolve, reject) {
          const zipOptions = fs.existsSync(`${userDir}/Files.tar`) //If the zip file already exists
          ? `u -sdel -uz0 -so -r -mx1 ${userDir}/Files.tar * -x!*.tar` //Update archive
          // Update > Delete after > Ignore if file already archive > Stream Output > Recursive > Compression LVl 1 > Zip Name > All Files > That are not a .tar file
          :`a -sdel -so -r -mx1 ${userDir}/Files.tar *`; //Create new archive
          // Add > (Rest of switches are same as above update command)

        const stream = child_process.spawn('7z', zipOptions.split(' '), {cwd: userDir, detached: true, encoding: 'buffer'});
        res.setHeader('Bullshit', GetFolderSize(req, userDir, 0) * 75 / 100); // This is basically bullshit, an approximation of the time it will take to complete download. Compression time could not be reliably streamed

        stream.stdout.pipe(res).on("finish", () => { // We never really create the zip back-end, we actually pipe the entire output/download it simultaneously
          let downloaded = CapArraySize(files.filter( file => file.copied).map( file => file.name))
          Sessions.user(req, ses).log.push(`Successfully downloaded ${downloaded}`);
          //Could not send usual Report Data, so needed to update these two properties manually
          Sessions.user(req, ses).operation = false;
          return resolve('Compression complete');
        }).on("close", () => fs.rmdir(userDir, {recursive: true, force: true}, (err) => err ? console.log (err) : null)) // Delete archive after request completed, whether it was aborted or completed
          .on("error", (err) => reject( ReportData(req, res, err))); //Error if problem on download stream

    }); //Promise for: After all files have been copied to staging
  }).catch( (err) => next(err)); //If there was an error thrown by file copying, crash server
 } catch (err) {WriteLogFilter(ses.user.name, err.message)};
},
/*===============================================================*/

/*===============================================================*/
  SetupTransfer: async function (req, res, partition) {
   try {
    const {destination} = req.body;

    if (fs.existsSync(`${partition}/${destination}`) === false)
      return ReportData(req, res, false, {
        content: [`Transfer aborted. Directory <span style="color: ${process.env.folder_color};">${destination}</span> was not found, or does not exist`],
        type: 'error'
      });
    let action = req.body.copy ? 'copied' : 'moved';
    req.body.transfers = await module.exports.TransferItems(req, res, partition);
    //After all is said and done, gather any successful/failed/already established items for front-end to display results report to user on browser. Each array holds the an object with the item name to be referenced, and a styled HTML entry for aesthetic clarity to be used on report data

    let transfers = req.body.transfers.map( (item) => item.transferred ? {name: item.name, styled: EntryToHTML(item, item.color)} : null).filter(Boolean) || [];
    let paths = req.body.transfers.map( (item) => item.transferred ? item.path : null).filter(Boolean);
    let failed = req.body.transfers.map( (item) => item.failed ? {name: item.name, styled: EntryToHTML(item, item.color)} : null).filter(Boolean);
    let already = req.body.transfers.map( (item) => item.already ? {name: item.name, styled: EntryToHTML(item, item.color)} : null).filter(Boolean);
    let target = `<span style="color: ${process.env.folder_color};">${destination}</span>`; //Destination folder with proper blue color
// ------------------------------------------------------------------------------
//Don't bother trying to decipher all the terinary string operators. They were necessary to account for all variations of transfer conflicts and provide appropriate coloring and segregation so user can adjust operations
        if (transfers.length && failed.length)
          return ReportData (req, res, false, {
            content: [`${transfers.length ? `Successfully ${action}` : 'Cancelled transfer.'}`, `to ${target} <hr>${failed.map(i => i.styled).join('<br>')} <br>were not successful`],
            type: 'warning',
            items: transfers.map( i => i.name) || [],
            incomplete: [...failed, ...already].map( i => i.name) || [],
            paths: paths
          });
// ------------------------------------------------------------------------------
        else if (failed.length > 0 && !transfers.length)
          return ReportData (req, res, false, {
            content: [`Failed to move`, `to ${target} . Check permission, verify item location, or try copying instead.`],
            type: 'error',
            items: failed.map( i => i.name),
            incomplete: failed.map( i => i.name)
          });
// ------------------------------------------------------------------------------
        else return ReportData (req, res, false, {
          content: [`${transfers.length ? `Successfully ${action}` : 'Cancelled.'}`, `${transfers.length ? `to ${target} <hr>`: '<hr>'}${already.length ? already.map(i => i.styled).join('<br>') + ' <br>already within that directory' : ''}`],
          type: already.length ? 'warning' : 'success',
          items: transfers.map( i => i.name) || [],
          paths: paths,
          incomplete: already.map( i => i.name)
        });
   } catch (err) { WriteLogFilter(req.session.user.name, err.message)}

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
                  if (error) { // Problem
                    console.log ('file failed', error.message);
                    return resolve({name: item.name, color: 'yellow', failed: true});
                  }
                  else { // Successful
                    fs.chown(newpath, req.session.user.uid, 100);
                    return resolve({name: item.name, path: item.path, color: item.color, transferred: true});
                  }
              });
            } // --------------------------------------------
            else fs.copyFile(oldpath, newpath, async (error) => {
                if (error) { // Problem
                  console.log ('file failed', error.message);
                  return resolve({name: item.name, color: 'yellow', failed: true});
                }
                else { // Successful
                  fs.chown(newpath, req.session.user.uid, 100);
                  return resolve({name: item.name, path: item.path, color: item.color, transferred: true});
                }
            });

          } //End of if copy
          // ----------------------------------------------------------------------------- Simply MOVE the item to the destination folder, any error means item transfer failed
          else {
            if (stats.uid !== req.session.user.uid && stats.uid !== 1024)
              return resolve({name: item.name, failed: true});

            fs.rename(oldpath, newpath, async (error) => {
              if (error) return resolve({name: item.name, color: 'yellow', failed: true});
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

/*===============================================================*/
  IterateDelete: async function (req, res, files) {

    let stats; //For checking mode/type, and uid
    let folderColor = process.env.folder_color; // Aesthetic purposes
    let fileColor = process.env.file_color; // Aesthetic purposes
  // ------------------------------------------------------------------------------
    const filesToDelete = files.map( (file, i, arr) => {
      return new Promise( (resolve, reject) => {

        let fullpath = path.resolve(req.session.home, file.path, file.name);
        if (fs.existsSync(fullpath))
          stats = fs.statSync(fullpath);
        else return resolve({
          name: file.name,
          status: 'notFound',
          color: file.name.includes('.') ? fileColor : folderColor
        });  //If item does not exist

        let mode = stats.mode.toString();
        // ------------------------------------------------------------------------------
        if (req.session.user.uid !== stats.uid && stats.uid !== 1024) //If user does not own the item
          return resolve({name: file.name, path: file.path, status: 'noPermission', color: checkModeType(mode) === 'file' ? fileColor : folderColor});
        // ------------------------------------------------------------------------------
          //If there were no Auth' problems/specificity errors, we proceed to remove the targeted file.
          if (checkModeType(mode) === 'file') {
            fs.unlink(fullpath, async (err) => {
              if (err) return resolve({name: file.name, path: file.path, status: 'failed', color: fileColor});
              else {
                await module.exports.DeleteFolderIfEmpty(req, `${req.session.home}/${file.path}`); // Check if root directory of operation is empty
                return resolve({name: file.name, path: file.path, status: 'deleted', color: fileColor});
              }
            });
          }
        // ------------------------------------------------------------------------------
          else if (checkModeType(mode) === 'folder') { //Then it's a folder, and we remove directory
            fs.rmdir(fullpath, { recursive: true }, async (err) => {
              if (err) return resolve({name: file.name, path: file.path, status: 'failed', color: folderColor});
              else {
                await module.exports.DeleteFolderIfEmpty(req, `${req.session.home}/${file.path}`);
                return resolve({name: file.name, path: file.path, status: 'deleted', color: folderColor});
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

}; //----Modules export
