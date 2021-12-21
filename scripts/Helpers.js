( function(exports) {
  /*===============================================================
    Removes the weird parse-coding that replaces 'Spacebar' characters, and restores the original spacebar whitespace.
  ===============================================================*/
  String.prototype.getSpaceChars = function () {return this.replaceAll('%20', ' ')};

  /*===============================================================
    Not very necessary, did it for readability since "!includes(thing) can take a few glances".
  ===============================================================*/
  String.prototype.isNotIn = function (comparison) { return !comparison.includes(this)};

  /*===============================================================
    Compares a given string to any amount of string parameters for exact match, if a parameter is an array, loop over that as well.
  ===============================================================*/
  String.prototype.matchesAny = function () {
  	for (let str of arguments) {
  	  if (Array.isArray(str)) {
  	    for (let s of str) {
  	      if (this == s) return true;
  	    }
  	  } else if (this == str) return true;
    }
  }

  /*===============================================================
    Compares a given string to any amount of string parameters for rough match, if a parameter is an array, loop over that as well.
  ===============================================================*/
  String.prototype.includesAny = function () {
  	for (let str of arguments) {
  	  if (Array.isArray(str)) {
  	    for (let s of str) if (this.includes(str)) return true;
  	  } else if (this.includes(str)) return true;
    }
  }

  /*===============================================================
    Had to create own method for simply getting last element of given array without mutating.
  ===============================================================*/
  Array.prototype.last = function (index) {return index ? this.length - 1 : this[this.length - 1]};

  /*===============================================================
    For retrieving the exact element within array (short-hand for array[array.indexOf(<whatever>)].
  ===============================================================*/
  Array.prototype.get = function (element, offset = 0) {
  	if (typeof(element) === 'number')
  	  return this[element + offset];
  	else return element ? this[this.indexOf(element) + offset] : false;
  };
  /*===============================================================*/

  /*===============================================================*/
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
  /*===============================================================*/

  /*===============================================================*/
    exports.namefinder = function (array, method, file) {
      file = file.toLowerCase();
      return array[`${method}`]( (listfile) => listfile.name.toLowerCase() === file || listfile.name.toLowerCase().includes(file)) || null;
      //Example: "this.files.find(>>THE FUNCTION YOU SEE ABOVE<<)"
    };
  /*===============================================================*/


  /*===============================================================
  Another little helper used to scan through array of files that have a "size" property, combine them all into one number, and return it.
  ===============================================================*/
	exports.accumulateSize = function (n, p) {
	  if (p && p.stats) p.size = p.stats.size || p.size || p;
	  if (n && n.stats) n.size = n.stats.size || n.size || n;
	  const prevSize = p && p.size ? p.size : p || 0;
	  const nextSize = n && n.size ? n.size : n || 0;
	  return parseInt(prevSize) + parseInt(nextSize);
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
  /*===============================================================*/

  /*===============================================================*/
    exports.checkModeType = function (filemode) {

      if (filemode) {
        if (filemode.toString().slice(0, 2) === '33' || filemode.toString().slice(0, 2) === '32')
          return 'file';
        else if (filemode.toString().slice(0, 2) === '16')
          return 'folder';
      } else return false;

    };
  /*===============================================================*/

  /*===============================================================*/
    exports.parseHTML = function (text) {
      if (!text) return '';
      return text.replace(/<span.*?>/g, '').replace(/<\/span.*?>/g, '').replace(/<br>/g, ', ').replace(/<hr>/g, '').replace(/object Object/g, '').replace(/\[]/g, '').replace(/,/g, '');
      //Replace <spans> and <brs> and <hrs>, and any '[object Object' crap
    };
  /*===============================================================*/

  /*===============================================================*/
    exports.addString = function (string, index, addition) {
      return string.substring(0, index) + addition + string.substring(index, string.length);
    };
  /*===============================================================*/

}(typeof exports === 'undefined' ? this.helpers = {} : exports));
