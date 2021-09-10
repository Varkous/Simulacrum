N.E.W stands for Node Express Website.
The only file you care about in here is N.E.W.js!

node_modules just contains -- you guessed it -- Modules that N.E.W.js calls/imports and utilizes.
"package" is just a guidance file with parameters that N.E.W.js uses to automatically update node_modules Module files.

Just write "const NEW = require('../NodeExpressAppFrame/N.E.W.js')" in any of your main/index files in any projects you make, and you will summon it
(as long as the directory they are in is within WebDevelopment).
Afterwards, just declare & initialize an instance class of NEW (which is itself a class of course) within your project. Call it whatever you want, 
preferably something like "website" or "application". Call <whatever you named it>.makeBaseRoutes to create the fundamental server listener,
homepage, and errorpage at the bottom of your project index file.