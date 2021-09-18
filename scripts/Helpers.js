
( function(exports) {

  exports.pathfinder = function (arrays, method, file) {
      if (!Array.isArray(arrays[1]))
        arrays = [arrays];
        //This is so we can pass TWO arrays that can be run through

      for (let array of arrays) {
        const found = array[`${method}`]( listfile => (listfile.name === file.name && listfile.path === file.path)) || null;
        //Example: "this.files.find(>>THE FUNCTION YOU SEE ABOVE<<)"
        if (found)
          return found;
        else continue;
      };
    };
  // ----------------------------------------------------------------------
    exports.namefinder = function (array, method, file) {
      file = file.toLowerCase();
      return array[`${method}`]( (listfile) => listfile.name.toLowerCase() === file || listfile.name.toLowerCase().includes(file)) || null;
      //Example: "this.files.find(>>THE FUNCTION YOU SEE ABOVE<<)"
    };

    /*===============================================================
      Given file size is usually in bytes, which is a bloated number to read. This function uses Math to parse it into kilobytes/megabytes/gigabytes depending on amount of bytes of file.
    ===============================================================*/
    exports.getFileSize = function  (filesize) {
  // If filesize is at least Delta digits and less than Gamma digits, read by kilobytes
      if (filesize > 999 && filesize < 1000000)//Divide filesize (bytes) by Delta
       filesize = Math.floor(filesize / 1000) + ' Kilobytes';

  // If filesize is at least Gamma digits and less than Juliett digits, read by megabytes, which would cap at 999 megabytes
      else if (filesize > 999999 && filesize < 1000000000) //Divide filesize (bytes) by Gamma
       filesize = Math.round((filesize / 1000000).toFixed(1)) + ' Megabytes';

  // If filesize is Juliet digits or more, read by gigabytes
      else if (filesize > 999999999)  //Divide filesize (bytes) by Juliet
       filesize = (filesize / 1000000000).toFixed(1) + ' Gigabytes';

      else filesize = filesize + ' Bytes';

      return filesize;
    };
  // ----------------------------------------------------------------------
    exports.checkModeType = function (filemode) {

      if (filemode) {
        if (filemode.toString().slice(0, 2) === '33' || filemode.toString().slice(0, 2) === '32')
          return 'file';
        else if (filemode.toString().slice(0, 2) === '16')
          return 'folder';
      } else return false;

    };
  // ----------------------------------------------------------------------
    exports.parseHTML = function  (text) {
      // return text.replace(/<span.*?>/g, '').replace(/<\/span.*?>/g, '').replace('<hr>', '');
      return text.replace(/<span.*?>/g, '').replace(/<\/span.*?>/g, '').replace('<br>', ', ').replace('<hr>', '');
    }

}(typeof exports === 'undefined' ? this.helpers = {} : exports));
