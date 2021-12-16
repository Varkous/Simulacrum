# Simulacrum
The purpose of this application is to supplement the given Cloud Drive's file systems manager with a more aesthetic user interface, and additional file manipulation options. This project was used primarily to provide a more interactive FSM to relatives, and for the author to practice intermediate Javascript (specifically NodeJS), asynchronous programming, FS library, array buffers, file streaming, OOP, and utilizing JQuery/CSS methods without any other front-end libraries.

# index.js 
Holds the framework objects, core server functions, along with the checkpoint routers
# @NodeExpressAppFrame 
Calls all the fundamental frameworks, and creates the server listener. It provides the Class which serves Express along with the routes object.
# controllers 
Contains the back-end script files:
  * UserHandling deals with authentication/authorization, session checking, updating Session "store", and reporting results of file operations (including errors) back to the client
  * FileControllers handles all CRUD/file handling operations (Upload, Transfer, Rename, Delete, and Download). 
  * FolderProviders queries folder data and gathers certain properties to be referenced for various tasks depending on request type
  * Utilities contains an assortment of mischellaneous functions generally used for very specific tasks, or to mildly assist larger functions
  * Hasher is simply the crypto-hasher functionality for creating/comparing password info (copied most of this)
# routes 
Simply holds routes.js, the file responsible for all non-general route handlers 
# views 
Contains the HTML/EJS display templates. "directory" is the workbench for all file browsing that takes place, providing the application the core global variables, 
and allowing the "single-page-application" capability.
# styles
Contains all the CSS style-sheets, divided up throughout several files to represent portions of the "directory.ejs" page.
# scripts
Contains 90% of all javascript functionality on the browser side. They are loaded in order of importance (with the exception of Aesthetics.js) within the "directory.ejs" file. 
Core, DirectoryControl, FileAlteration, and StageAndUpload are the most essential files for the front-end operations.
# public, users, temp 
Are the root folders for all file operations that take place. The names matter, and are referenced by environment variables.
# base_images, fonts and filetype_images 
Are just image/aesthetic resources for the front-end.
# ssl 
Is just certificate info.
