/* ================================================= */
if (LoginAttempts.message)
alert(LoginAttempts.message);

if (LoginAttempts.count < 3) {

  for (let field of fieldsets)
    field.removeAttribute('disabled');

  document.querySelector('button').disabled = false;
  forms[0].hidden = false;
};
/* ================================================= */
newUserForm.onsubmit = async (evt) => {
  evt.preventDefault();
  evt.stopPropagation();

  const formData = new FormData(newUserForm);
  const newUser = {};

  for (let [key, value] of formData.entries()) {
    newUser[key] = value;
  };

  register.classList.add('active');
  register.disabled = true;
  axios({
    method: 'POST',
    url: '/new',
    data: newUser,
  }).then( (res) => {
    const {content, type} = res.data;
    register.classList.remove('active');
    register.disabled = false;

    if (type === 'success')
      setTimeout( () => window.location = `${document.URL}`, 4000);

    if (res.data.type && res.data.type !== 'warning') {
      confirmCode.disabled = false;
      codeForm.classList.remove('hide');
    }

    message.innerHTML = content;
    main.style.maxHeight = (main.offsetHeight + message.offsetHeight) + 'px';

  }).catch( (err) => {
    console.error(err);
  });

};
/* ================================================= */
mainForm.onsubmit = async (evt) => {

  if (LoginAttempts.count >= 2) {
    alert('Login attempts exceeded.');
    return false;
  }
  evt.preventDefault();

  document.querySelector('button').disabled = false;
  let currentTarget = event.target;
  main.style.transform = 'scale(0)';
  body.style.transform = 'scale(70%)';
  setTimeout( () => {
    currentTarget.submit();
  }, 300);
};
/* ================================================= */
window.onload = () => {
  if (Server.status === 1 || Server.countdown > 2) {
    main.style.transform = "scale(1.0)";
  } else alert('Server shutdown in less than two minutes. Check back later.')
}
/* ================================================= */
function showForm(btn, form) {
  if (form === newUserForm) {
    btn.parentNode.classList.add('slide-up');
  } else setTimeout( () => btn.parentNode.hidden = true, 1000);

  form.hidden = false;
  form.classList.remove('slide-up');
}
/* ================================================= */
if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent)) {
  body.style.background = "url('/staticglobe.gif')";
  // Take the user to a different screen here.
}
/* ================================================= */
const prefix = (Array.prototype.slice
  .call(window.getComputedStyle(document.documentElement, '')).filter( (style) => style.includes('-moz')));
