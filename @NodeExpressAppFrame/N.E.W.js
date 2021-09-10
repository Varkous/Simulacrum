/*N.E.W stands for: Node Express Website. It contains the fundamental libraries/frameworks used for making any website with NodeJS and Express.
Simply import this file, and create a "new" of its class to utilize all these properties, as they will be stored on your new class. Destructure "app" from it for easier use*/

class NEW {

	constructor(){

		this.express = require('express'); //Our framework for handling web responses/requests, designed for NodeJS (a runtime environment/framework)
		this.app = this.express(); /*Never fully understood why, but we simply create "app" out of the "express" function, using the functionality of the express framework*/
		/*this.mongoose = require('mongoose'); Our ODM (Object Document Mapper) for making models. Utilized by the database MongoDB to store collections/documents*/
		this.path = require('path'); //For acknowledging directory/file paths relative to the server file (app.js)
		let {urlencoded} = require('express'); this.urlencoded = urlencoded; //To identify arrays/strings within request bodies
		this.methodOverride = require('method-override'); //So we can identify put/patch/delete request methods
		this.ejs = require('ejs'); //Well. So we can see data/information from our server on the pages?
		this.bodyParser = require('body-parser'); //Well. So we can see data/information from our server on the pages?
		this.session = require('express-session'); //Rather vague, but it's a library that establishes a session on each visit to the page. The session is found within "req.session", where cookies can be stored.
		this.flash = require('connect-flash'); //Dunno, uses session to carry and "flash" warnings/information carried from the previous route onto the next page.
		this.fs = require('fs');
		this.https = require('https');

		const browserTools = [
		this.urlencoded({extended: true}),
		this.methodOverride('_method'),
		this.bodyParser.json(),
		this.bodyParser.urlencoded({ extended: true }),
		//this.sessions({ name: 'sessions', store: store, session: 'sessions', secret: "wtf",  resave: false,  saveUninitialized: true, cookie: { secure: false,}}),
		//this.flash(),
		];
		this.app.use(browserTools);

	} //------------End of Constructor
	routes = {};


	success = (data) => console.log("Here ya go:", data);
	failure = (error) => console.log("Success.", error);

	wrapAsync (fn){
    	return function (req, res, next){
        	fn(req, res, next).catch(error => next(error));
    	}
	}

	makeBaseRoutes(PORT = 8080, homepage = 'homepage', errorpage = 'errorpage') {
		let {app, wrapAsync, fs, https} = this;
		let cert = fs.readFileSync('./ssl/RSA-cert.pem', 'utf8');
		let ca = fs.readFileSync('./ssl/RSA-chain.pem', 'utf8');
		let key = fs.readFileSync('./ssl/RSA-privkey.pem', 'utf8');
		return {
			//=================================
			// null: Invalid page request by user
			//=================================
			nullpage: app.get('/:error', wrapAsync(async (req, res, next) => {

			   let error = new Error("Directory not found. Does not exist, or input not correct.", 404);
				 let {message, status, stack} = error;
				return res.render('errorpage', {status, message, stack});
			})),
			//=================================
			// Main/Home page render
			//=================================
			homepage: app.get('/', wrapAsync(async (req, res, next) => {

			    res.render(homepage);
			})),

			//=================================
			// Error Handling
			//=================================
			errorpage: typeof errorpage === 'function' ? errorpage :
			app.use(async (err, req, res, next) => {
			   const {status = 401, message = "Sigh", stack} = err;

			   return res.render('errorpage', {status, message, stack});
			}),

			//=================================
			// Server Side response
			//=================================
			server: https.createServer({cert, ca, key}, app).listen(PORT, () => {
			    console.log("Listening on Port:", PORT);
			})
		};
	}; //-------------End of makeBaseRoutes
} //----------End of Class
module.exports = NEW;
