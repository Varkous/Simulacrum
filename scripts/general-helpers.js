
   function pathfinder (arrays, method, file) {
    if (!Array.isArray(arrays[1]))
      arrays = [arrays];
      //This is so we can pass TWO arrays that can be filtered

    for (let array of arrays) {
      found = array[`${method}`]( (listfile) => (listfile.name === file.name && listfile.path === file.path)) || null;
      //Example: "this.files.find(>>THE FUNCTION YOU SEE ABOVE<<)"
      if (found)
        return found;
      else continue;
    };
  };
// ----------------------------------------------------------------------
   function namefinder (array, method, file) {
    file = file.toLowerCase();
    return array[`${method}`]( (listfile) => listfile.name.toLowerCase() === file || listfile.name.toLowerCase().includes(file)) || null;
    //Example: "this.files.find(>>THE FUNCTION YOU SEE ABOVE<<)"
  };
   function checkModeType (filemode) {
    if (filemode) {
      if (filemode.toString().slice(0, 2) === '33')
        return 'file';
      else if (filemode.toString().slice(0, 2) === '16')
        return 'folder';
    } else return false;

  };
// ----------------------------------------------------------------------
   function randomizeColor (element, property, conditions) {
    let hue = [false, false, false];
    let pref = conditions.preference;
      if (pref.includes('red'))
        hue[0] = true;

      if (pref.includes('green'))
        hue[1] = true;

      if (pref.includes('blue'))
        hue[2] = true;

      if (conditions.alpha)
        hue[3] = true;

    conditions.lightness === 'light' ? shade = 255 : shade = 0;

    let rgb = [shade, shade, shade]
    conditions.alpha ? rgb.push(1) : null;
    for (let i = 0; i < rgb.length; i++) {

      if (hue[i] === false)
        continue;

      i === 3 ? rgb[i] = parseFloat(Math.random().toFixed(1))
      : rgb[i] = Math.floor(Math.random() * (255 + 1));
    }
    $(element).css(property, `rgb(${[...rgb]})`);
    console.log ([...rgb])
  };
// ----------------------------------------------------------------------
