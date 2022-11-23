## Simulacrum
Simulacrum.
The purpose of this application is to supplement the given Cloud Drive's file systems manager with a more aesthetic user interface, and additional file manipulation options. This project was used primarily to provide a more interactive FSM to relatives, and for the author to practice intermediate Javascript (specifically NodeJS), asynchronous programming, FS library, array buffers, file streaming, OOP, and utilizing JQuery/CSS methods without any other front-end libraries.

# FEATURES
- Uploading, transferring, editing, deleting and downloading of files to/from the cloud drive storage
- Viewing of images, videos, and live sound of audio files
- Conversion of URLs of YouTube videos and other source videos into downloadable files
- Logging of user operations and actions in the FMS

# REQUIRES
- Permission from author to redistribute and deploy.
- Access to environment variables and back-end information files from "simulacrum-env" to work.

# THIRD-PARTY MODULE DEPENDENCIES
```js
const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");
const session = require('cookie-session');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const checkDiskSpace = require('check-disk-space').default
const {IncomingForm} = require('formidable');
const axios = require('axios');
const find_local = require('local-devices');
```
___________________________________________________________________________________
# @NodeExpressAppFrame 
Calls all the fundamental frameworks, and creates the server listener. It provides the Class which serves Express along with the routes object.

# index.js 
Holds the framework objects, core server functions, along with the checkpoint routers

# controllers 
Contains the back-end script files:
  * UserHandling deals with authentication/authorization, session checking, updating Session "store", and reporting results of file operations (including errors) back to the client
  * FileControllers handles all CRUD/file handling operations (Upload, Transfer, Rename, Delete, and Download). 
  * FolderProviders queries folder data and gathers certain properties to be referenced for various tasks depending on request type
  * Utilities contains an assortment of mischellaneous functions generally used for very specific tasks, or to mildly assist larger functions
  * Hasher is simply the crypto-hasher functionality for creating/comparing password info (copied most of this)

# routes 
"auth.js" directs all authentication route handlers (register, login, signout), "file-ops" holds all post routes for CRUD operations performed by the client, and "file-viewing" directs requests to view different directories, and returns the appropriate content.

# views 
Contains the HTML/EJS display templates. "directory" is the workbench for all file browsing that takes place, providing the application the core global variables, 
and allowing the "single-page-application" capability.

# styles
Contains all the CSS style-sheets, divided up throughout several files to represent portions of the "directory.ejs" page.

# fonts
All .ttf font files that are used by the front-end stylesheets.

# scripts
Contains 90% of all javascript functionality on the browser side. They are loaded in order of importance (with the exception of Aesthetics.js) within the "directory.ejs" file. 
Core, DirectoryControl, FileAlteration, and StageAndUpload are the most essential files for the front-end operations.

# base_images, fonts and filetype_images 
Are just image/aesthetic resources for the front-end.

