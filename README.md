# Simulacrum
The purpose of this application is to supplement the given Cloud Drive's file systems manager with a more aesthetic user interface, and additional file manipulation options.
  This project was used primarily by the author to practice intermediate Javascript/JQuery/CSS methods.

The index file holds the framework objects, core server functions, and along the checkpoint routers
@NodeExpressAppFrame calls all the fundamental frameworks, and creates the server listener. It provides the Class which serves Express, and all the routes.
The "Controllers" folder contains the back-end script files:
  UserHandling deals with authentication/authorization, session checking, updating Session "store", and reporting results of file operations (including errors) back to the client
  FileControllers handles all file operations (Upload, Transfer, Rename, Delete, and Download). 
  FolderProviders queries folder data and compiles certain properties to be referenced for various tasks
  Utilities contains "random" mischellaneous functions generally used for specific circumstances, or to mildly assist bigger functions
  Hasher is simply the crypto-hasher functionality for creating/comparing password info
"routes" folder simply holds routes.js, the file responsible for all non-general route handlers 

"views" contains the html/ejs display templates. "directory" is the workbench for all file browsing that takes place, providing the application the core global variables, 
and allowing the "single-page-application" capability.
"styles" folder contains all the CSS style-sheets, divided up throughout several files to segregate portions of the page.
"scripts" folder contains 90% of all javascript functionality on the browser side. They are loaded in order of importance (with the exception of Aesthetics.js) .
within the directory.ejs file. Core, DirectoryControl, FileAlteration, and StageAndUpload are the most essential files for the front-end operations.
"public, users, temp" are the root folders for all operations that take place. The names matter, and are referenced by environment variables.
"base_images, fonts and filetype_images" are just image/aesthetic resources.
"ssl" is just certificate info.
