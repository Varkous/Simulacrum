'use strict';
const {ReportData, Sessions} = require('./UserHandling.js');
const {CapArraySize, CheckIfTransfer, CheckIfUpload, EntryToHTML} = require('./Utilities.js');
const {GetFolderSize} = require('./FolderProviders');
const fs = require('fs-extra');
const path = require('path');
const child_process = require("child_process");

const UsersDirectory = process.env.UsersDirectory || 'users';

module.exports = {

  /*===============================================================*/
  AccessDirectory: async function (req, res, next) {

    if (req.body.query)
      return res.end();

    if (req.files || req.body && req.body.files)
      Sessions.user(req).operation = {type: req.body.operation, size: 0, location: req.params.folder};

    let targetDir = req.params.folder + req.params[0];
    let user = req.session.user;

    if (req.session.home === UsersDirectory && targetDir.slice(0, user.name.length) !== user.name) {
      return next(new Error(`Cannot transfer or submit to other private directories. Be sure to include ${user.name} as root of folder input while within your directory`));
    }
    let partition = await CheckIfTransfer(req, res, targetDir);
    if (!partition) return false;


    //Checks if its a transfer, and if user is attempting transfer from public to private

    let paths = await CheckIfUpload(req, res, targetDir);
    //Needs to be an array regardless, for simplicity of operations

    req.body.newfolders = new Set();
     //This data is not relevant for any operations back-end, anything code related to 'newfolders' is used solely to create any new Folder Cards on the front-end display for user clarity
// ------------------------------------------------------------------------------
      for (let directory of paths) {
        let loop = false;

        fs.access(`${partition}/${directory}`, fs.constants.R_OK | fs.constants.W_OK, async (error) => {
        // To check if the given directory already exists or not.\

          if (error) {
            let newDirectory = fs.mkdirSync(`${partition}/${directory}`, {recursive: true});

            if (newDirectory) {
              fs.chown(newDirectory, user.uid, 100);

              let nextDir = directory.replace(user.residing || targetDir, '').replace('/', '').split('/')[0]
              //Simple code, but deceptive concept. The goal is to find any new directories created that are DIRECT children of the current posting directory (the folder the user is residing in), anything deeper should cannot be displayed, as page will only show relative directories

              if (!req.body.newfolders.has(nextDir))
                req.body.newfolders.add(nextDir);
            }

            if (paths.indexOf(directory) !== paths.length - 1)
              return loop = true;
              // Async pattern of 'fs.access' made this necessary. Start next iteration by setting "loop" to true and "continuing" if its true, since 'continue' could not be used WITHIN these functions, but "loop" could be recognized outside.

              else if (newDirectory && !req.files && !req.body.transfer) {

                return ReportData(req, res, false, {
                  content: [`Directory`, `created`],
                  type: 'success',
                  items: [`<span style="color: ${process.env.folder_color};">${directory}</span>`],
                  newfolders: Array.from(req.body.newfolders)
                });
              }
              //If the user was not trying to transfer, go ahead and move on through the routes
              else if (!req.body.transfer) return next();
          }
    // ------------------------------------------------------------------------------
          if (req.body.transfer) {

          //If no errors, and request was sent with the transfer property as "true", it means the user wants to transfer a file. Furthermore, we see if they wish to simply move it, or copy it within the function.
            let {destinationFolder, files} = req.body;

            if (fs.existsSync(`${partition}/${destinationFolder}`) === false)
              return ReportData(req, res, false, {
                content: [`Transfer aborted. Directory <span style="color: ${process.env.folder_color};">${destinationFolder}</span> was not found, or does not exist`],
                type: 'error'
              });

            module.exports.DirectoryTransfer(req, res, partition, req.body.files, destinationFolder);

          } //End of transferring files
   // ------------------------------------------------------------------------------
          else { //If no error, then user is trying to access directory, check permission

            fs.stat(`${partition}/${directory}`, (error, stats) => {

              if (error) return ReportData (req, res, false, {
                  content: ["Could not find directory data"],
                  type: 'error'
                });

              else if (!req.files) {
                  const entries = fs.readdirSync(`${partition}/${directory}`);
                  return ReportData (req, res, false, {
                    content: [`Directory already exists. ${entries.length ? 'Items within:' : 'Empty.'}`],
                    type: 'warning',
                    items: entries || '',
                  });
                }
              else if (paths.indexOf(directory) !== paths.length - 1) loop = true;
              //Same reason as the similar check made in the first statement.
              else return next();
            });

          }; //End of: Else if no error
        });//End of: Attempt to access folder

        if (loop) continue;
        else loop = false;
      }; //End of: Looping over all file paths

  // ------------------------------------------------------------------------------
  }, //-------End of: Make Directory
/*===============================================================*/

/*===============================================================*/
  UploadFiles: async function (req, res, next) {
    return console.log (req.files);
    if (!req.files) return ReportData(req, res, false, {
      content: ['No files sent for upload'],
      type: 'error'
    });


    else if (req.files) {

    //If there aren't, it means no files were uploaded. Not used by any other directory access calls.
      fs.readdir(path.resolve('temp'), async (error) => {
        const filesToWrite = req.files.files.map( (file, i, arr) => {
          Sessions.user(req).operation.size += file.size;
          //Absoluetly essential function to this application, it's how we upload data AND report the results without stalling the server.

            return new Promise( (resolve, reject) => {
            // Has to be a promise or route will just continue on without returning any data to user

              let src = file.tempFilePath;
              let read = fs.createReadStream(src);
              // Every uploaded file is put in a temp directory (the source)

              let dest = path.resolve(req.session.home, file.path, file.name);
              let write = fs.createWriteStream(dest);
              // every file is assigned a path on upload (destination), we start the writing

              read.on("open", () => read.pipe(write)) //Start the writing process from source to destination path
              .on("error", () => { //If there was a problem, delete file source regardless, and reject the upload if files are spread throughout multiple folders
                console.log ('failed');
                  fs.unlink(src);
                if (req.body.newfolders > 1) {
                  return reject({name: file.name, uploaded: false}); // 'Reject' will stop the upload
                } else return resolve({name: file.name, uploaded: false}); // Otherwise just inform user it wasn't uploaded
              }).on("end", () => {
                //After writing ends, delete source (temp file) regardless, and return the file completed
                fs.unlink(src);
                return resolve({name: file.name, uploaded: true});
              })
          }); //End of Promise
        }); //End of reading Temp directory

      req.files = await Promise.all(filesToWrite);
      next(); //Continue on to end of route when all files are ready to report
      }); //Read directory of temp

      // ------------------------------------------------------------------------------
    } else next(); //If there were files at all
  },
/*===============================================================*/

/*===============================================================*/
Archiver: async function (req, res, files, userDir) {
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });
    let zipSize = 0;

    for (let file of files) {
      const filepath = path.resolve(req.session.home, file.path, file.name);
      fs.statSync(filepath).isDirectory() ? zipSize = await GetFolderSize(req, filepath, zipSize)
      : zipSize += fs.statSync(filepath).size;
    }

    res.setHeader('Bullshit', zipSize * 2);
    archive.pipe(res);
  try {
    const filesToDownload = files.map( (file, i, arr) => {
      const filepath = path.resolve(req.session.home, file.path, file.name);
      return new Promise( function (resolve, reject) {
        fs.stat(filepath, (err, stats) => {

          if (err) return reject('Does not exist. Download aborted');

          archive.pipe(res).on('warning', async (err) => {
            if (err.code === 'ENOENT')
              return reject('Failed');
              throw err;
            }).on('error', async (err) => {
              return reject('Failed');
              throw err;
          }).on('finish', async (err, data) => {
            resolve('Good');
          })

          if (stats.isDirectory())
            archive.directory(filepath, file.name);
          else archive.file(filepath, {name: file.name});

          if (i === arr.length - 1) {
            archive.finalize();
          }
        }); //End of file existence check
      }); //End of promise
    }); //End of mapping

    await Promise.all(filesToDownload).then( async (data) => {
      Sessions.user(req).operation = false;
    }).catch( error => error);
  } catch (err) {
    next(err)
  };
},
/*===============================================================*/

/*===============================================================*/
ChildExec: async function (req, res, files, userDir) {

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
        return resolve({name: file.name, size: fs.statSync(dest).size});
      } //If the file is already present, skip
      else fs.copy(src, dest, async (err) => { //Copy to staging user staging directory
        if (err) return reject(err.message);
        else return resolve({name: file.name, size: fs.statSync(dest).size});
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

        const zipOptions = fs.existsSync(`${userDir}/Files.zip`) //If the zip file already exists
        ? `u -mmt -uz0 -so -r -mx1 ${userDir}/Files.zip * -x!*.zip` //Update archive
        // Update > Multithread > Ignore if file already archive > Stream Output > Recursive > Compression LVl 1 > Zip Name > All Files that are not a zip file
        :`a -mmt -sdel -so -r -mx1 ${userDir}/Files.zip *`; //Create new archive
        // Add > Multithread > Delete after > Stream Output > Recursive > Compression LVl 1 > Zip Name > All Files

        stream = child_process.spawn('7z', zipOptions.split(' '), {cwd: userDir, detached: true, encoding: 'buffer'});
        //Begin streaming to client, 'Bullshit' header gives approximate time wait
        res.setHeader('Bullshit', GetFolderSize(req, userDir, 0) * 50 / 100);

        stream.stdout.pipe(res).on("finish", () => {
          fs.rmdir(userDir, {recursive: true, force: true}, (err) => err ? console.log (err) : null); //Delete archive after being sent to user
          let downloaded = CapArraySize(files.filter( file => !file.missing).filter( file => file.name))
          Sessions.user(req).log.push(`Successfully downloaded ${downloaded}`);
          //Could not send usual Report Data, so needed to update these two properties manually
          Sessions.user(req).operation = false;
          return resolve('Compression complete');
        }).on("error", (err) => reject( ReportData(req, res, err))); //Error if problem on download stream

      Sessions.user(req).operation.size = files.reduce( (prev, next) => prev.size + next.size);
    }); //Promise for: After all files have been copied to staging
  }).catch( (err) => next(err)); //If there was an error thrown by file copying, crash server
},
/*===============================================================*/

/*===============================================================*/
  DirectoryTransfer: async function (req, res, partition, items, destination) {
    let action = req.body.copy ? 'copied' : 'moved';

    const itemsToTransfer = items.map( (item, i, arr) => {
      //The items could be either files or folders.
      return new Promise( (resolve, reject) => {
        let oldpath = `${req.session.home}/${item.path}/${item.name}`;
        let newpath = `${partition}/${destination}/${item.name}`;
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
              // if (stats.uid !== req.session.user.uid)
              //   return resolve({name: item.name, failed: true});

              fs.rename(oldpath, newpath, async (error) => {
                if (error) return resolve({name: item.name, color: item.color, failed: true});
                else return resolve({name: item.name, path: item.path, color: item.color, transferred: true});
              });

            }
          }); //End of stat/item existence check
// -----------------------------------------------------------------------------
      });
    });

    req.body.transfers = await Promise.all(itemsToTransfer).catch( (error) => ReportData(req, res, error));

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
  IterateDelete: async function (req, res, files) {

    let succeeded = [], failed = [], stats;
  // ------------------------------------------------------------------------------
    for (let file of files) {

      let fullpath = `${req.session.home}/${file.path}/${file.name}`;
      if (fs.existsSync(fullpath))
        stats = fs.statSync(fullpath);

  // ------------------------------------------------------------------------------
      if (!stats || req.session.user.uid !== stats.uid && req.session.user.admin === false) {
        //If item does not exist, or user does not own the item
        failed.push(file.name);
        continue;
      }
  // ------------------------------------------------------------------------------
        try {
         let mode = stats.mode.toString();

        //If there were no Auth' problems/specificity errors, we proceed to remove the targeted file.
          if (mode.slice(0,2) === '33') {
            await fs.unlinkSync(fullpath)
            fs.existsSync(fullpath) ? failed.push(file.name) : await succeeded.push(file.name);
          }
          else if (mode.slice(0,2) === '16') { //Then it's a folder, and we remove directory

            await fs.rmdirSync(fullpath, { recursive: true });
            fs.existsSync(fullpath) ? failed.push(file.name) : await succeeded.push(`<span style="color: ${process.env.folder_color};">${file.name}</span>`);
          }
        } catch (error) {
          await failed.push(file.name);
        }
  // ------------------------------------------------------------------------------
        finally {

          await fs.readdir(`${req.session.home}/${file.path}`, async (error, items) => {
            const user = req.session;
            if (error) throw error;
            if (!items || items.length === 0
            && `${user.home}/${file.path}` !== `${UsersDirectory}/${user.user.name}`)
              //If folder is empty after file deletion (and it doesn't happen to be the partition/home folder itself), remove directory as well
              await fs.rmdirSync(`${user.home}/${file.path}`);
            });
        };
// ------------------------------------------------------------------------------
      }; // --------- End of For Loop over all items

    return CapArraySize([succeeded, failed]);
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
