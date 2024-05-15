const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const path = require('path');
const app = express();
const nodemailer = require('nodemailer');

// MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'medibot'
});

let transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
      user: 'your_email@gmail.com', // Your email address
      pass: 'your_password' // Your email password
  }
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to database');
});

app.use(express.static(path.join(__dirname, 'public')));


// LOGIN HANDLING
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM users WHERE email = ?';

  connection.query(query, [email], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    if (results.length === 0) {
      res.status(401).send('Invalid email or password');
      return;
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (bcryptErr, bcryptRes) => {
      if (bcryptErr) {
        console.error('Error comparing passwords:', bcryptErr);
        res.status(500).send('Internal Server Error');
        return;
      }

      if (!bcryptRes) {
        res.status(401).send('Invalid email or password');
        return;
      }

      res.status(200).send('Login successful');
    });
  });
});


// REGISTER HANDLING
app.post('/register', (req, res) => {
  const { email, password } = req.body;

  const checkQuery = 'SELECT * FROM users WHERE email = ?';

  connection.query(checkQuery, [email], (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Error checking email:', checkErr);
      res.status(500).send('Internal Server Error');
      return;
    }

    if (checkResults.length > 0) {
      res.status(400).send('Email already registered');
      return;
    }

    bcrypt.hash(password, 10, (hashErr, hash) => {
      if (hashErr) {
        console.error('Error hashing password:', hashErr);
        res.status(500).send('Internal Server Error');
        return;
      }

      function sendVerificationEmail(email, verificationCode) {
        let mailOptions = {
            from: 'leviskibet2002@gmail.com',
            to: email,
            subject: 'Email Verification',
            text: `Your verification code is: ${verificationCode}`
        };
      
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log('Error occurred while sending email:', error);
            }
            console.log('Email sent:', info.response);
            const insertQuery = 'INSERT INTO users (email, password) VALUES (?, ?)';
            connection.query(insertQuery, [email, hash], (insertErr) => {
              if (insertErr) {
                console.error('Error inserting user:', insertErr);
                res.status(500).send('Internal Server Error');
                return;
              }
            
              res.status(201).send('User registered successfully');
            });
        });
      }

      sendVerificationEmail('recipient@example.com', '123456');

      

    });
  });
});


app.post('/reset', (req, res) => {
    // Handle password reset form submission
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
