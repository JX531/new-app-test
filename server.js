const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');


const app = express();
const upload = multer({dest: 'uploads/'});

const users = {'user1':'password1', 'user2':'password2'};

app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded bodies
app.use(session({
    secret: 'key',
    resave: false,
    saveUninitialized: true
}));

app.use(express.static('public'));

//check if login
app.get('/', (req, res) => {
    if (req.session.username) {
        res.sendFile(path.join(__dirname, 'public', 'encoding.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

//login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] === password) {
        req.session.username = username;
        res.redirect('/');
    } else {
        res.status(401).send('Invalid username or password');
        res.redirect('/');
    }
});

//logout
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error logging out.');
        }
        res.redirect('/');
    });
});

//encoding page
app.post('/upload', upload.single('video'), (req, res) => {
    const videoFilePath = req.file.path; //input file
    const format = req.body.format || 'mp4';
    const filename = `testoutput-video.${format}`;
    const outputFilePath = path.join(__dirname, 'encoded', filename ); //output location, output filename

    // Ensure the output directory exists
    fs.mkdirSync(path.join(__dirname, 'encoded'), { recursive: true });

    ffmpeg(videoFilePath)
        .output(outputFilePath)
        .videoCodec('libx265') // Using H.265 for higher compression
        .audioCodec('aac')
        .outputOptions('-crf 28')
        .outputOptions('-r 30') // Set the frame rate to 30 fps
        .on('end', () => {
            const metadata = {
                originalFileName: req.file.originalname,
                encodedFileName: filename,
                user: req.session.username
            };
            fs.appendFileSync('video_metadata.json', JSON.stringify(metadata) + '\n');
            
            res.download(outputFilePath, filename, () => {
                // Clean up the uploaded and encoded files after download
                fs.unlinkSync(videoFilePath);
                fs.unlinkSync(outputFilePath);
            });
        })
        .on('error', (err) => {
            console.error(err);
            res.status(500).send('Video encoding failed.');
        })
        .run();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
