'use strict';
const fs = require('fs-extra');
const {Sessions, GetCreator} = require('./UserHandling.js')
const child_process = require('child_process');
const {checkModeType} = require('../scripts/Helpers.js');

module.exports = {

  /*===============================================================*/
  GetPrimaryDirectories: async function (req, home) {

	const PrimaryDirectories = fs.readdirSync(home, {withFileTypes: true})
	.filter( dir => dir.isDirectory())
	.map(dir => dir.name).map( async (directory) => {
	  return new Promise( function (resolve, reject) {

	    if (directory[0] === '@' || directory[0] === '$' || directory[0] === '#')
	      return resolve (false);
	    //Then it's a hidden/reserved/special folder
		const dirstats = fs.statSync(`${home}/${directory}`);
	    let subfolders = [];
	    //Grabbing sub-directories along with the stats and items within the given directory

	    fs.readdir(`${home}/${directory}`, async (err, items) => {
	      for (let i = 0; i < items.length; i++) { /*Check every item*/

	        const filestats = fs.statSync(`${home}/${directory}/${items[i]}`);
	        dirstats.creator = await GetCreator(dirstats.uid);

	        //Every item's stats are checked, and just their size is returned to be concatenated with the folderStats size (usually 0), so it will ultimately add up the sizes of all present items
	        if (checkModeType(filestats.mode) === 'folder') {
	 		  subfolders.push(items[i]);
	 		  items.splice(i, 1);
	        } /*Then it can't BE a file, so --*/

	      }; //End of second For Loop
	    // ------------------------------------------------ //
	      dirstats.size = module.exports.GetFolderSize(req, `${home}/${directory}`, 0) || 1;
	      return resolve({
	        name: directory,
	        stats: dirstats,
	        size: dirstats.size,
	        files: items,
	        folders: subfolders,
	      });
	      // ------------------------------------------------ //
	    }); //Read directory
	  }); //Return promise
	}); //Mapping cycle
	return await Promise.all(PrimaryDirectories);
  },
  /*===============================================================*/

  /*===============================================================*/
  CreateItem: async function (req, item, folder, fullpath) {

    item = {
     name: item,
     path: folder,
     stats: fs.statSync(`${fullpath}/${item}`),
     children: await module.exports.GetChildren(`${fullpath}/${item}`), //Finding sub-files/folders
    };

    item.stats.creator = await GetCreator(item.stats.uid);
    if (item.children) {
      item.stats.size = await module.exports.GetFolderSize(req, `${fullpath}/${item.name}`, 0); // Continues inward cycle of iterations
      item.size = item.stats.size;
      item.folder = 'true';
    } else item.file = true;

    return item;
  },
  /*===============================================================*/

  /*===============================================================*/
  GetDirectory: async function (folder, req, res) { //Collects the stats of the folder, its files, stores any child-folders/sub-directories within "layers" property, and stores the actual folder within the "name" property.
    let partition = req.session.home || process.env.partition;
	let maxfiles = req.mobile ? 100 : 500;
    req.session.index = 0; // Iteration of files

    if (!folder)  //It means the primary directory is likely mixed in with the partition name, at the end. Should never happen really
      folder = partition.split('/').last();

// ----------------------------------------------
    const fullpath = `${partition}/${folder}`;
    const stats = fs.statSync(`${fullpath}`); //Get stats from directory
    // const files = fs.readdirSync(fullpath); //Read directory and retrieve all its files (their names anyway)
    return new Promise(function(resolve, reject) {
      fs.readdir(fullpath, async (error, items) => { //Reads the directory requested and finds all children
// ----------------------------------------------------------------------------
        const dirItems = items.map( (item, i, arr) => { //Maps through each one
          return new Promise(async function (resolve, reject) { //Promise to wait for each item to be resolved
            if (i === maxfiles) {
              req.session.index = i;
              return resolve(false); //Don't collect any more than 500
            }
            return resolve(module.exports.CreateItem(req, item, folder, fullpath));
          });
        });
// ----------------------------------------------------------------------------
        await Promise.all(dirItems).then( async (items) => { //When all items are done mapping and file is retrieved
          return resolve({ //Create directory out of all items
            name: folder,
            layers: folder.split('/'), //Gets each sub-directory of the given folder, store each one in a "layer" so we can determine how nested we are in a directory on front-end.
            stats: stats,
            files: items.filter(Boolean),
            get creator() { //Add a new property
              return GetCreator(this.stats.uid);
            }
          });
        }).catch( error => console.log (error.message));
      }); //Compile and create directory out of file map promises
    }); //Return directory promise
  },
  /*===============================================================*/

  /*===============================================================*/
  GetAllItems: async function (directory, collected, searchfolder, req, all) { //Very similar to GetFolderSize, except it stores all the stats rather than just "size", and disregards any folder/file that does have the given UID.
  //Also like the pre-mentioned function, it builds on itself, doing internal calls until all files/folders are filtered out and stored properly.
    let partition = req ? req.session.home : process.env.partition;
    let moreItems = collected || []; //This builds with each call to this function ('GetAllItems')
    return new Promise( (resolve, reject) => { //After all items have been iterated (this may include self-calls that restart this process until no more directories can start new iterations), return this promise
      const items = fs.readdirSync(directory);
      const foundItems = items.map( (item, i, arr) => { //If the item was a directory, map through all its children
        // -------------------------------------------------------

        let dirPath = `${directory}/${item}`;
        return new Promise( (resolve, reject) => { //Ultimate promise, for every directory resolution
          //VERY important
          if (fs.statSync(dirPath).isDirectory()) {
            //If it's a directory, we will build on the previous directory and call this function again. All the way until (depending on parameters), we find a folder (searchfolder param), or we get an actual file (file search)
            if (dirPath[0] === '@' || dirPath[0] === '$' || dirPath[0] === '#')
              return resolve(false); //Then it's a hidden/reserved/special folder

            if (searchfolder) { //If searchfolder is true, we're querying for folders, and don't want files
              if (dirPath.toLowerCase().includes(searchfolder.toLowerCase()))//Lower case it, no need to be uptight here
                moreItems.push(dirPath);

              resolve(module.exports.GetAllItems(dirPath, moreItems, searchfolder, req));
            } else resolve(module.exports.GetAllItems(dirPath, moreItems, false, req)); //Both these resolves mean a new directory was found and needs to be iterated, so the promise returns ANOTHER promise, all the way until it gets the items it's looking for
          } else if (searchfolder) resolve(false); //If not a directory and we're searching, continue, we don't want files
          // -------------------------------------------------------
          else { //If not a directory and we're not searching/querying folders, we're looking for files
            let maxfiles = req.mobile ? 100 : 500;
            req.session.index += 1; //Every file iterated increments this
            if (req.body.index && req.session.index < req.body.index * maxfiles || moreItems.length === maxfiles) {
              return resolve(moreItems);
            } //The indexing is to locate which "bunch/set" of files to query. Each body index represents a new set of 500 files. 0 = the first 500, 1 = ignores first 500 uses next 500, 2 = ignores first 1000, etc.
            let file = {
              name: item,
              path: directory.replace(partition + '/', ''), //When its stored, partition path no longer needed
              stats: fs.statSync(dirPath)
            };
            file.stats.creator = GetCreator(file.stats.uid);

              moreItems.push(file);
              return resolve(moreItems);
          } //If it was actually a file, and not directory
          // -------------------------------------------------------
        });
      });

    return Promise.all(foundItems).then( () => {
      resolve(moreItems);
    });
  });

  }, //-------End of: Get stats of User with given ID
  /*===============================================================*/

  /*===============================================================*/
  GetFolderSize: function (req, directory, size) { //This function can call ITSELF and create a cascading call-return of whatever is passed in. It's used solely to get the size of all files in every directory and SUBDIRECTORY passed in, which can lead to calls upon calls upon calls.
    try {
      let directorySize = size || 0;
      let dirFiles = fs.readdirSync(directory);

      dirFiles.forEach( function (dirfile) {
        if (fs.statSync(`${directory}/${dirfile}`).isDirectory()) {
          //If one of the "files" of the directory is actually another directory, we just restart the process
          directorySize = module.exports.GetFolderSize(req, `${directory}/${dirfile}`, directorySize);
        } else {
          directorySize += fs.statSync(`${directory}/${dirfile}`).size;
        }
      });
      return directorySize;
    } catch (error) { throw error;}
  }, //-------End of: Get folder size
  /*===============================================================*/

  /*===============================================================*/
  GetChildren: function (dirPath) {
    if (fs.statSync(dirPath).isDirectory()) {
      const items = {files: [], folders: []};
      return new Promise( (resolve, reject) => {
        fs.readdir(dirPath, (error, children) => {
          for (let child of children) {
            fs.statSync(`${dirPath}/${child}`).isDirectory()
            ? items.folders.push(child)
            : items.files.push(child);
          }
          return resolve(items);
        });
      });
    } else return null;

  },
  /*===============================================================*/

}; //----Modules export
