const fs = require('fs-extra');
const path = require('path');
const {ReportData} = require('./UserHandling.js');
const {CapArraySize, CheckIfUpload, CheckIfTransfer} = require('./Helpers.js');
const FileType = require('file-type');
const UsersDirectory = process.env.UsersDirectory || 'Users_1';

module.exports = {

/*===============================================================*/
  AccessDirectory: async function (req, res, next) {

    let maindir = req.params.folder + req.params[0];
    //Req.params.folder is the directory the user is currently in/posting from. When converted to array, the first element becomes the current directory. Relevant further down.

    let partition = await CheckIfTransfer(req, res, maindir);
    if (!partition) return false;
    //Checks if its a transfer, and if user is attempting transfer from public to private

    let paths = await CheckIfUpload(req, res, maindir);
    //Needs to be an array regardless, for simplicity of operations

    req.body.newfolders = new Set();
    //Everything related to this (newfolders) is for front-end aesthetics, back-end does not use it
// ------------------------------------------------------------------------------
      for (let directory of paths) {
        let loop = false;

        fs.access(`${partition}/${directory}`, fs.constants.R_OK | fs.constants.W_OK, async (error) => {
        // To check if the given directory already exists or not.\

          if (error) {
            let newDirectory = fs.mkdirSync(`${partition}/${directory}`, {recursive: true});

            let nextDir = directory.split('/')[1];
            //Simple code, but deceptive concept. The first element is the current directory (don't want that), second element is the newly created directory, and all other elements are sub-directories of the new directory, so don't want those either.
              if (!req.body.newfolders.has(nextDir)) {
                req.body.newfolders.add(nextDir);
                //Front-end will only create folders that are immediate relatives of the current directory, so we these off later after upload is complete
              }

              if (paths.indexOf(directory) !== paths.length - 1)
                return loop = true;
              // Async patterns made this necessary. Start next iteration by setting "loop" to true and "continuing" if its true, since 'continue' could not be used WITHIN these functions, but "loop" could be recognized outside.

              else if (newDirectory && !req.files && !req.body.transfer) {

                return ReportData(req, res, false, {
                  content: [`Directory`, `created`],
                  type: 'success',
                  items: [`<span style="color: #22a0f4;">${directory}</span>`],
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
                content: [`Transfer aborted. Directory <span style="color: #22a0f4;">${destinationFolder}</span> was not found, or does not exist`],
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
                  entries = fs.readdirSync(`${partition}/${directory}`);
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

    let i = 0; //Needed this to reassign an element of req.files.files, using "file" didn't work
      if (!req.files) return ReportData(req, res, false, {
        content: ['No files sent for upload'],
        type: 'error'
      });

      for (let file of req.files.files) {
        let filetype = await FileType.fromBuffer(file.data);

        // if (!filetype || !file.name.toLowerCase().includes(filetype.ext)) {
        //   req.files.files[i] = file.name; //If there was a problem, file data will not be used, but we keep the name so we can report the name of the file in the browser log
        // } else
        // fs.writeFileSync(path.join(__dirname, req.session.home, file.path, file.name), file.data, "UTF8");
        // fs.writeFileSync(path.resolve(req.session.home, file.path, file.name), file.data, "UTF8");
        fs.writeFile(path.resolve(req.session.home, file.path, file.name), file.data, "UTF8", function (error) {
          if (error) req.files.files[i] = file.name;

          i++;
        });
      };

    next();
  },
/*===============================================================*/

/*===============================================================*/
  DirectoryTransfer: async function (req, res, partition, items, destination) {
    let transfers = [], paths = [], failed = [], already = [];
    let color, stats, action = 'moved';

    //The items could be either files or folders.
    // ------------------------------------------------------------------------------
      for (let item of items) {

        oldpath = `${req.session.home}/${item.path}/${item.name}`;
        newpath = `${partition}/${destination}/${item.name}`;

        if (fs.existsSync(oldpath))
          stats = fs.statSync(oldpath);

        try {
          if (stats.isDirectory())
            color: '#22a0f4';

          if (oldpath === newpath) {
            already.push(item.name);
            continue;
          }

        // ------------------------------------------------------------------------------
          if (req.body.copy) {
            action = 'copied';
            //Simply copy the item (absolute path needed) to the destination folder, any error means file transfer failed.
            if (stats.isDirectory())
              fs.copySync(oldpath, newpath);
            else fs.copyFileSync(oldpath, newpath);

          }
        // ------------------------------------------------------------------------------
          else {
            if (stats.uid !== req.session.user.uid) {
              failed.push(item.name);
              continue;
            }
            fs.renameSync(oldpath, newpath, { overwrite: true, recursive: true });
            //Simply MOVE the item (absolute path needed) to the destination folder, any error means item transfer failed.

            // ------------------------------------------------------------------------------
            let remainingItems = fs.readdirSync(`${req.session.home}/${item.path}`);

              if (remainingItems.length < 1
              && `${partition}/${item.path}` !== `${UsersDirectory}/${req.session.user.name}`) {
                //If folder is empty after file deletion (and it doesn't happen to be the partition/home folder itself), remove directory as well)
                fs.rmdirSync(`${partition}/${item.path}`);
              }
          }

          transfers.push(item.name);
          paths.push(item.path);

        // ------------------------------------------------------------------------------
        } catch (error) { failed.push(item.name) };
      }; //End of For Loop

      [transfers = [], failed = [], already = []]
        = await CapArraySize([transfers, failed, already]);
// ------------------------------------------------------------------------------
        if (transfers.length && failed.length)
          return ReportData (req, res, false, {
            content: [`successfully ${action}`, `to <span style="color: #22a0f4;">${destination}</span>. <hr> <span style="color: #e0e082 !important;">${failed}</span> were not successful`], type: 'warning', items: transfers, paths: paths
          });
// ------------------------------------------------------------------------------
        else if (!failed.length && transfers.length > 0)
          return ReportData (req, res, false, {
            content: [`Successfully ${action}`, `to <span style="color: #22a0f4;">${destination}</span>`], type: 'success', items: transfers, paths: paths
          });
// ------------------------------------------------------------------------------
        else if (failed.length > 0 && !transfers.length)
          return ReportData (req, res, false, {
            content: [`Failed to move`, `to <span style="color: #22a0f4;">${destination}</span>. Check permission, verify item location, or try copying instead.`], type: 'error', items: failed
          });
// ------------------------------------------------------------------------------
        else return ReportData (req, res, false, {
          content: [`Transfer cancelled`, `already within target directory`],
          type: 'warning', items: already, paths: paths
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
      // if (!stats || req.session.user.uid !== stats.uid) {
      //   //If item does not exist, or user does not own the item
      //   failed.push(file.name);
      //   continue;
      // }
  // ------------------------------------------------------------------------------
        try {

        //If there were no Auth' problems/specificity errors, we proceed to remove the targeted file.
          if (stats.mode === 33206) {
            await fs.unlinkSync(fullpath)
            fs.existsSync(fullpath) ? failed.push(file.name) : await succeeded.push(file.name);
          }
          else if (stats.mode === 16822) { //Then it's a folder, and we remove directory

            await fs.rmdirSync(fullpath, { recursive: true });
            fs.existsSync(fullpath) ? failed.push(file.name) : await succeeded.push(`<span style="color: #22a0f4;">${file.name}</span>`);
          }
        } catch (error) {
          await failed.push(file.name);
        }
  // ------------------------------------------------------------------------------
        finally {

          await fs.readdir(`${req.session.home}/${file.path}`, async (error, items) => {
            user = req.session;
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
      color = '#22a0f4';
      req.body.directory = true;
    } else color = 'darkcyan';

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
