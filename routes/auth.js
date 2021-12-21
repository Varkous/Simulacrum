'use strict';
const nodemailer = require("nodemailer");

const {app, path, wrapAsync, fs} = require('../index.js');
const {emailMessage} = require('../utils/HTML-Components.js');
const {VerifyUser, Sessions} = require('../controllers/UserHandling.js');
const {ReportData} = require('../utils/RequestCheckers.js');
const {Geodetect} = require('../utils/Utilities.js');
const {Hash, Verify} = require('../controllers/Hasher.js');
const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

let partition = process.env.partition || 'public';
const UsersDirectory = process.env.UsersDirectory || 'users';

async function SendEmail(req, res, form) {
  req.session.code = RandomCode().toUpperCase();
  req.session.email = form.email;

  const transporter = nodemailer.createTransport({
    host: "smtp.mail.yahoo.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.email,
      pass: process.env.email_key,
    },
  });

  const info = await transporter.sendMail({
    from: `Simulacrum <${process.env.email}>`, // Sender address
    to: req.session.email, // Receiver
    subject: "Confirm account registration", // Subject line
    html: emailMessage({code: req.session.code}), // HTML text body
  });

  return info.messageId;
};
// ======================================
function RandomCode(code = '') {
  if (code.length < 5) {
    code = code;
    let bool = Math.round(Math.random() * 1);

    if (bool === 0) code += Math.round(Math.random() * 9);
    // If 0, we add a number to the code (between 0 and 9)

    else code += alphabet[Math.round(Math.random() * 25)];
    // If bool is 1, we add a LETTER to the code (between A and Z, case does not matter)

    return RandomCode(code);
  }
  else return code;
};


// return console.log (Sessions.users)
/*======================================================*/
module.exports = {

  /* ====================================
  First acquires location of user from req using rapidapi API. If valid IP, display login page. Lots of conditionals required to catch if session is fresh, expired, or populated with user content
  ======================================= */
  loginPage: app.get('/login', Geodetect, wrapAsync( async (req, res, next) => {

  	let Server = process.ServerTracker;
  	let LoginAttempts;

  	if (req.session) {
  	  if (req.session.loginAttempts && req.session.loginAttempts >= 2) {
  	  //Technically it's 3, the first login attempt sets it to null (0) rather than 1 for some reason
  	    req.session.loginAttempts ++;

  	    Sessions.lock(req, req.body.name);
  	    return next( new Error("Login attempts exceeded. Seek life elsewhere."));
  	  }

  	  if (req.session.loginAttempts)
  	    LoginAttempts = {count: req.session.loginAttempts, message: ''};
  	  else LoginAttempts = {count: 0, message: ''};

  	  if (req.session.user) {
  	  	req.session = null;
  	  	await Sessions.terminate(req);
  	  }

  	  return res.render('login', {LoginAttempts, Server});
  	}

  	return res.render('login', {LoginAttempts, Server});
  })),

  /* ====================================
  Handler of posted login form data
  ======================================= */
  loginAttempt: app.post('/login', Geodetect, VerifyUser, wrapAsync( async (req, res, next) => {
  	res.setHeader('set-cookie', [
  	  'simulacrum_session; SameSite=Strict; Secure',
  	  'simulacrum_session.sig; SameSite=Strict; Secure',
	  ]);

    return res.redirect(req.session.route || '/');
  })),

  /* ====================================
  Signs out posting user and terminates session
  ======================================= */
  signout: app.get('/signout', wrapAsync( async (req, res, next) => {

    if (req.session.user) {

      await Sessions.terminate(req);;
      return res.redirect('/login');
    }

    res.redirect(req.session.route || '/');
  })),

  /* ====================================
  For signing up
  ======================================= */
  register: app.post('/new', wrapAsync( async (req, res, next) => {

    if (req.session.user)
      return 'Home';

    let form = req.body;

    if (Sessions.user().find( u => u.email === form.email || u.name === form.name)) {
      return ReportData(req, res, false, {
        content: `<h4 style="color: orange">That username or email is already in use.</h4>`,
        type: 'warning'
      });
    }

    if (form.password.length < 6 || form.password === form.name || form.password.replace(/[a-zA-Z]/g, '').length < 2) {
      return ReportData(req, res, false, {
        content: `<h4 style="color: orange">Password not sufficient. Requires at least two non-alphabetical characters (like one number and/or one symbol), length must be more than 6, and cannot be the same as username</h4>`,
        type: 'warning'
      });
    } else if (!req.session.code || form.email !== req.session.email) {

      // send the message and get a callback with an error or details of the message that was sent
      await SendEmail(req, res, form).then( () => {
        return ReportData(req, res, false, {
          content: `<h4 style="color: cadetblue">Registered! Before you can access Simulacrum, input the code we sent to your email for confirmation.</h4>`,
          type: 'success'
        });
      }).catch( (err) => {
        return ReportData(req, res, false, {
          content: `<h4 style="color: orange">${err} Email not found</h4>`,
          type: 'error'
        });
      });

    } else if (form.code && req.session.code === form.code) {

        await Hash(form.password).then( async (pw) => {
          let highestID = Sessions.user().map(u => u.uid).sort( (a, b) => a - b).last() + 1; // Iterates all users in database, returns their IDs, sorts lowest to highest, picks the highest number and increments it by 1

          let NewUser = {
            name: form.name,
            password: pw,
            email: form.email,
            uid: highestID,
            admin: false,
            guest: true,
            log: [],
            residing: null,
            location: form.state || '',
            firstVisit: true
          };

          delete(req.session.code);
          delete(req.session.email);
          return await Sessions.new(req, res, NewUser);
        }).catch( err => { throw err });

      } else if (req.session.code && form.code !== req.session.code) {
        return ReportData(req, res, false, {
          content: `<h4 style="color: lightcoral">Invalid code, try again.</h4>`,
          type: 'error'
        });

      } else return res.send({content: `Login`, type: 'error'});

  })),
  /* ====================================
  Temporary for creating new user accounts
  ======================================= */
  //newUser: app.post('/new', wrapAsync( async (req, res, next) => {

  //  const answers = ["Now that's more like it, Mr. Wayne.",
  //      "Now that's more like it, Mister Wayne.",
  //      "Now that is more like it, Mr. Wayne.",
  //      "Now that is more like it, Mister Wayne."]

  //  req.session.loginAttempts ++;
  //  if (checkVariations(req.body.guess, answers)) {
     // await Hash(req.body.password).then( (pw) => {
     //
     //   let user = {
     //     name: req.body.name,
     //     password: pw,
     //     uid: 1,
     //     admin: false,
     //     note: req.body.note || '',
     //     firstVisit: true
     //   };
     //
     //   fs.appendFileSync(`${process.env.infodir}/newusers.txt`, JSON.stringify(user), 'utf8');
     //   let LoginAttempts = {count: req.session.loginAttempts || 0, message: 'Correct. Sending request for new profile.'};
     //   return res.render('login', {LoginAttempts});
     // });

  //  } else {
  //    return next(new Error('Nope, wrong answer'));
  //  }

  //})),
}; //--------------- End of authentication routes
