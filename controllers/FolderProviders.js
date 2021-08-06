const fs = require('fs-extra');

module.exports = {

  /*===============================================================*/
  GetDirectory: async function (folder, req, res) { //Collects the stats of the folder, its files, stores any child-folders/sub-directories within "layers" property, and stores the actual folder within the "name" property.
    let partition = req.session.home || process.env.partition;

    if (!folder) {
      partition = partition.split('/');
      folder = partition.pop();
      //It means the primary directory is likely mixed in with the partition name, at the end.
    }

    const fullpath = `${partition}/${folder}`
    const stats = fs.statSync(`${fullpath}`); //Get stats from directory
    const fileNames = fs.readdirSync(`${fullpath}`); //Read directory and retrieve all its files (their names anyway)

    let files = [];
      for (let file of fileNames) { //Create an object with each file that also holds the file's stats
        files.push({
          name: file,
          path: folder,
          stats: fs.statSync(`${fullpath}/${file}`),
          children: await module.exports.GetChildren(`${fullpath}/${file}`)
        });
      };
      const directory = {
        name: folder,
        layers: [],
        stats: stats,
        files: files,
      };

      let folderStart = [0];
      for (let i = 0; i < folder.length; i++){
        if (folder[i] === '/') folderStart.push(i);
      };

      for (let i = 0; i < folderStart.length; i++)
        directory.layers.push(
          folder.slice(folderStart[i], folderStart[i + 1]).replace('/', '')
        ); //Gets each sub-directory of the parent folder (our current directory), store each one in a "layer" so we can determine how nested we are in a directory on front-end.

      return directory;

  },
  /*===============================================================*/

  /*===============================================================*/
  GetUsersItems: function (directory, stats, search, req) { //Very similar to GetFolderSize, except it stores all the stats rather than just "size", and disregards any folder/file that does have the given UID.
  //Also like the pre-mentioned function, it builds on itself, doing internal calls until all files/folders are filtered out and stored properly.
    let partition = req.session.home || process.env.partition;
    let dirStats = stats || [];
    let dirFiles = fs.readdirSync(directory);

    for (let dirfile of dirFiles) {
      // -------------------------------------------------------
      if (fs.statSync(`${directory}/${dirfile}`).isDirectory()) {
        if (search) {
          dirStats.push(`${directory}/${dirfile}`);
          dirStats = module.exports.GetUsersItems(`${directory}/${dirfile}`, dirStats, true, req);
        }
        else dirStats = module.exports.GetUsersItems(`${directory}/${dirfile}`, dirStats, false, req);
      // -------------------------------------------------------
      }
      else if (search) continue; //If not a directory and we're searching, continue, we don't want files
      // -------------------------------------------------------
      else {
        if (fs.statSync(`${directory}/${dirfile}`).uid !== req.session.user.uid) continue;
        else dirStats.push({
          path: directory.replace(partition + '/', ''), //When its stored, partition path no longer needed
          name: dirfile,
          stats: fs.statSync(`${directory}/${dirfile}`)
        });
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
