const styles = {
  emailMessage: {
  	div: `
	  padding: 15px;
      background-image: linear-gradient(to right, rgba(0,0,0,0.5), #22a0f4);
      background-size: cover;
      background-position: center;
      color: white;
      border-radius: 15px;`,
    input: `
      background: black;
      border: 3px double gray;
      color: #22a0f4;
      border-radius: 15px;
      font-family: monospace;
      height: 150px;
      display: block;
      font-size: 1.5rem;
      text-align: center`,
    p: `
      color: invert;
      font-size: 1.0rem;`,
    img: `
      max-width: 300px;`,
    article: `
      font-size: 1.2rem;
      padding: 5px;
      border-radius: 10px;
      font-family: revert;
      border: 2px double lightblue;
      background: rgba(0,0,0,0.6);
      box-shadow: 2px 2px 15px 3px black;
      color: lightblue;`,
    article_header: `
      font-family: monospace`,
  },
};

// ====================================================
const {div, input, p, img, article, article_header} = styles.emailMessage;
module.exports = {
  emailMessage: function (refs) {
    return `
      <div style="${div}">
        <h4>(For Simulacrum Access)</h4>
        <p style="${p}">To complete profile creation and access Simulacrum, note the code below:</p>
        <hr>
        <input style="${input}" type="text" disabled value="${refs.code}">
        <hr>
        <p style="${p}">Copy and write it within the code input on the registration page, and hit 'Submit'. Your profile will then be officially activated.</p>
        <hr>
        <article style="${article}">
          <h1 style="${article_header}">Simulacrum Guidelines</h1>
          <p>Before performing any file operations on Simulacrum (like uploading files or converting URLs), a few things to be aware of:</p>
          <ol>
            <li>The Simulacrum cloud service is still a WIP. Quality-of-life features like loss prevention, data recovery, technical support, and advanced storage plans have not yet been implemented.</li>
            <li>Unless you registered with an administrative account (detected by Simulacrum), then you are considered a "Guest" user, and only granted 2 gigabytes (2000 MBs) of personal storage use.</li>
            <li>You may perform operations such as uploading, downloading, transferring, deleting and editing files. Avoid uploading excessively large files (anything over 500 MBs) at a time or it may be rejected.</li>
            <li>If you have any questions to pose or any features you'd like to request, contact <span style="lightblue">varkous@protonmail.com</span>.</li>
          </ol>
        </article>
      </div>`;
  },
};
