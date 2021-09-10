const stream = fs.createWriteStream(filepath);
stream.on('open', () => req.pipe(stream));
stream.on('drain', () => {
 // Calculate how much data has been piped yet
 const written = parseInt(stream.bytesWritten);
 const total = parseInt(headers['content-length']);
 const pWritten = (written / total * 100).toFixed(2)
 console.log(`Processing  ...  ${pWritten}% done`);
});

stream.on('close', () => {
if (error) req.files.files[i] = file.name;
else fs.chownSync(filepath, req.session.user.uid, 100);
 // Send a success response back to the client
 const msg = `Data uploaded to ${filePath}`;
 console.log('Processing  ...  100%');
 console.log(msg);
 res.status(200).send({ content: '', status: 'success', msg });
});

stream.on('error', err => {
 // Send an error message to the client
 console.error(err);
 res.status(500).send({ status: 'error', err });
});
