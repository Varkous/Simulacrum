const fs = require('fs-extra');
const {Sessions} = require('./UserHandling.js')

module.exports = {

  /*===============================================================*/
  GetDirectory: async function (folder, req, res) { //Collects the stats of the folder, its files, stores any child-folders/sub-directories within "layers" property, and stores the actual folder within the "name" property.
    let partition = req.session.home || process.env.partition;

    if (!folder) {
      partition = partition.split('/');
      folder = partition.pop();
      //It means the primary directory is likely mixed in with the partition name, at the end.
    }
// ----------------------------------------------
    const fullpath = `${partition}/${folder}`
    const stats = fs.statSync(`${fullpath}`); //Get stats from directory
    const files = fs.readdirSync(`${fullpath}`); //Read directory and retrieve all its files (their names anyway)

      for (let i = 0; i < files.length; i++) { //Create an object with each file that also holds the file's stats
        files[i] = {
          name: files[i],
          path: folder,
          stats: fs.statSync(`${fullpath}/${files[i]}`),
          children: await module.exports.GetChildren(`${fullpath}/${files[i]}`),
        };
        files[i].stats.creator = Sessions.users[`User${files[i].stats.uid}`].name || 'Admin';
      };
// ----------------------------------------------
      const directory = {
        name: folder,
        layers: [],
        stats: stats,
        files: files,
        get creator() {
          return Sessions.users[`User${this.stats.uid}`].name || 'Admin';
        }
      };
// ----------------------------------------------
      let folderStart = [0];
      for (let i = 0; i < folder.length; i++){
        if (folder[i] === '/') folderStart.push(i);
      };

      for (let i = 0; i < folderStart.length; i++)
        directory.layers.push(
          folder.slice(folderStart[i], folderStart[i + 1]).replace('/', '')
        ); //Gets each sub-directory of the parent folder (our current directory), store each one in a "layer" so we can determine how nested we are in a directory on front-end.

      return directory;
// ----------------------------------------------
  },
  /*===============================================================*/

  /*===============================================================*/
  GetAllItems: function (directory, stats, search, req) { //Very similar to GetFolderSize, except it stores all the stats rather than just "size", and disregards any folder/file that does have the given UID.
  //Also like the pre-mentioned function, it builds on itself, doing internal calls until all files/folders are filtered out and stored properly.
    let partition = req ? req.session.home : process.env.partition;
    let dirStats = stats || [];
    let dirFiles = fs.readdirSync(directory);

    for (let dirfile of dirFiles) {
      let path = `${directory}/${dirfile}`;
      // -------------------------------------------------------
      if (fs.statSync(path).isDirectory()) {
        if (path[0] === '@' || path[0] === '$') continue; //Then it's a hidden/reserved/special folder
        else if (search) {
          //If search is true, we're searching for folders, and don't want files
          if (path.toLowerCase().includes(search.toLowerCase()))
          //Lower case it, no need to be uptight here
            dirStats.push(path);

          dirStats = module.exports.GetAllItems(path, dirStats, search, req);
        }
        else dirStats = module.exports.GetAllItems(path, dirStats, false, req);
      // -------------------------------------------------------
      } else if (search) continue; //If not a directory and we're searching, continue, we don't want files
      // -------------------------------------------------------
      else {
        let item = {
          path: directory.replace(partition + '/', ''), //When its stored, partition path no longer needed
          name: dirfile,
          stats: fs.statSync(path)
        };
        item.stats.creator = Sessions.users[`User${item.stats.uid}`].name || 'Admin';
        dirStats.push(item);
      } //If it was actually a file, and not directory

      }; //End of For Loop
      // -------------------------------------------------------
    return dirStats;

  }, //-------End of: Get stats of User with given ID
  /*===============================================================*/

  /*===============================================================*/
  GetFolderSize: function (req, directory, size) { //This function can call ITSELF and create a cascading call-return of whatever is passed in. It's used solely to get the size of all files in every directory and SUBDIRECTORY passed in, which can lead to calls upon calls upon calls.
    let partition = req.session.home || process.env.partition;
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
  }
  catch (error) { throw error;}
  }, //-------End of: Get folder size
  /*===============================================================*/

  /*===============================================================*/
  GetChildren: async function (path) {
    if (fs.statSync(path).isDirectory()) {
      items = {files: [], folders: []};
      children = fs.readdirSync(path);
      for (let child of children) {
        fs.statSync(`${path}/${child}`).isDirectory()
        ? items.folders.push(child)
        : items.files.push(child);
      }
      return items;
    } else return null;

  },
  /*===============================================================*/

}; //----Modules export
