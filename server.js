const express = require('express');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { CloudantV1 } = require('@ibm-cloud/cloudant');
const { IamAuthenticator } = require('ibm-cloud-sdk-core');
require('dotenv').config();

const ACCOUNT_NAME = process.env.CLOUDANT_ACCOUNT_NAME;
const API_KEY = process.env.CLOUDANT_API_KEY;

const authenticator = new IamAuthenticator({ apikey: API_KEY });
const cloudant = CloudantV1.newInstance({
  authenticator: authenticator,
  serviceName: ACCOUNT_NAME
});
cloudant.setServiceUrl(`https://${ACCOUNT_NAME}.cloudantnosqldb.appdomain.cloud`);

const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await fetchUserLogin(email);
    if (user) {
      const match = await bcrypt.compare(password, user.user_password);
      if (match) {
        req.session.user = { email: user.user_email };
        return res.redirect('/dashboard');
      } else {
        res.status(409).redirect('index.html?message=Incorrect%20password%20or%20email');
      }
    } else {
      res.status(404).send('No user found with the given email');
      res.status(409).redirect('index.html?message=Incorrect%20password%20or%20email');
    }
  } catch (err) {
    console.error('Error during login process:', err);
    res.status(409).redirect('index.html?message=Internal%20server%20error!');
  }
});

async function fetchUserLogin(email) {
  try {
    const databaseName = "medibot_db";
    const query = {
      selector: {
        user_email: email
      },
      fields: ["user_email", "user_password"]
    };

    const response = await cloudant.postFind({
      db: databaseName,
      selector: query.selector,
      fields: query.fields
    });

    if (response.result.docs.length > 0) {
      const user = response.result.docs[0];
      console.log(`User found: ${user.user_email}`);
      return user;
    } else {
      console.log(`No user found with email: ${email}`);
      return null;
    }
  } catch (err) {
    console.error('Error fetching user login:', err);
    throw err;
  }
}

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const verificationCode = Math.floor(Math.random() * 1000000);

  try {
    await sendVerificationEmail(email, verificationCode, password);
    setTimeout(() => {
      res.status(409).redirect('index.html?message=Incorrect%20password%20or%20email');
    }, 5000);
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(409).redirect('signup.html?message=Internal%20server%20error!');
  }
});

async function sendVerificationEmail(email, verificationCode, password) {
  let mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Email Verification',
    text: `Your verification code is: ${verificationCode}`
  };

  transporter.sendMail(mailOptions, async (error, info) => {
    if (error) {
      console.error('Error occurred while sending email:', error);
      throw error;
    }
    console.log('Email sent:', info.response);
    const hashedPassword = await bcrypt.hash(password, 10);
    await checkDatabaseAndCreateDocument(email, hashedPassword);
  });
}

async function sendResetEmail(email, verificationCode) {
  let mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Email Verification',
    text: `Hello, you requested to reset your password. Here is your verification code: ${verificationCode}`
  };

  transporter.sendMail(mailOptions, async (error, info) => {
    if (error) {
      console.error('Error occurred while sending email:', error);
      throw error;
    }
    console.log('Email sent:', info.response);
    await checkDatabaseAndCreateReset(email, verificationCode);
  });
}

async function checkDatabaseAndCreateDocument(email, hash) {
  try {
    const existingDbsResponse = await cloudant.getAllDbs();
    const existingDbs = existingDbsResponse.result;
    const databaseName = "medibot_db";
    const userId = Math.floor(Math.random() * 1000000).toString();

    if (!existingDbs.includes(databaseName)) {
      await cloudant.putDatabase({ db: databaseName });
      console.log(`The database '${databaseName}' has been created.`);
    }

    const jsonDocument = {
      "_id": userId,
      "user_email": email,
      "user_password": hash
    };

    const newDocumentResponse = await cloudant.postDocument({
      db: databaseName,
      document: jsonDocument
    });

    if (newDocumentResponse.result.ok) {
      console.log(`Document '${userId}' successfully created.`);
    } else {
      console.error(`Failed to create document '${userId}'.`);
    }
  } catch (err) {
    console.error('Error: ', err);
    throw err;
  }
}

async function checkDatabaseAndCreateReset(email, verificationCode) {
  try {
    const databaseName = "medibot_reset";
    const id = `reset_${email}`;

    const existingDbsResponse = await cloudant.getAllDbs();
    const existingDbs = existingDbsResponse.result;
    if (!existingDbs.includes(databaseName)) {
      await cloudant.putDatabase({ db: databaseName });
      console.log(`The database '${databaseName}' has been created.`);
    }

    const jsonDocument = {
      _id: id,
      user_email: email,
      verification_code: verificationCode
    };

    try {
      const existingDoc = await cloudant.getDocument({
        db: databaseName,
        docId: id
      });

      jsonDocument._rev = existingDoc.result._rev;
      const updateDocumentResponse = await cloudant.putDocument({
        db: databaseName,
        docId: id,
        document: jsonDocument
      });

      if (updateDocumentResponse.result.ok) {
        console.log(`Document '${id}' successfully updated.`);
      } else {
        console.error(`Failed to update document '${id}'.`);
      }
    } catch (err) {
      if (err.status === 404) {
        const newDocumentResponse = await cloudant.postDocument({
          db: databaseName,
          document: jsonDocument
        });

        if (newDocumentResponse.result.ok) {
          console.log(`Document '${id}' successfully created.`);
        } else {
          console.error(`Failed to create document '${id}'.`);
        }
      } else {
        console.error('Error: ', err);
      }
    }
  } catch (err) {
    console.error('Error: ', err);
    throw err;
  }
}

app.post('/reset', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await fetchUserLogin(email);
    if (user) {
      const verificationCode = Math.floor(Math.random() * 1000000);
      await sendResetEmail(email, verificationCode);
      req.session.email = email;
      res.redirect('/resetpass');
    } else {
      res.status(409).redirect('index.html?message=Incorrect%20password%20or%20email');
    }
  } catch (err) {
    console.error('Error during password reset:', err);
    res.status(409).redirect('index.html?message=Internal%20server%20error!');
  }
});

app.post('/newpass', async (req, res) => {
  try {
    const { newPassword, code } = req.body;
    const email = req.session.email;
    const resetDatabaseName = "medibot_reset";
    const userDatabaseName = "medibot_db";

    if (!newPassword || !email || !code) {
      res.status(409).redirect('index.html?message=Invalid%20%verification%20%code!');
    }

    const resetQuery = {
      selector: {
        user_email: email,
        verification_code: parseInt(code)
      }
    };

    const resetResponse = await cloudant.postFind({
      db: resetDatabaseName,
      selector: resetQuery.selector
    });

    if (resetResponse.result.docs.length === 0) {
      return res.status(400).send('Invalid verification code');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const userQuery = {
      selector: {
        user_email: email
      },
      fields: ["_id", "user_email", "user_password", "_rev"]
    };

    const userResponse = await cloudant.postFind({
      db: userDatabaseName,
      selector: userQuery.selector,
      fields: userQuery.fields
    });

    if (userResponse.result.docs.length === 0) {
      res.status(409).redirect('index.html?message=No%20user%20found%20with%20the%20given%20email');
    }

    const user = userResponse.result.docs[0];
    user.user_password = hashedPassword;

    const updateResponse = await cloudant.putDocument({
      db: userDatabaseName,
      docId: user._id,
      document: user
    });

    if (updateResponse.result.ok) {
      res.status(409).redirect('index.html?message=Password%20reset%20successful');
    } else {
      res.status(409).redirect('index.html?message=Password%20reset%20failed');
    }
  } catch (err) {
    console.error('Error: ', err);
    res.status(409).redirect('index.html?message=An%20error%20occurred');
  }
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/reset', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset.html'));
});

app.get('/resetpass', (req, res) => {
  if (!req.session.email) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'newpass.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/tos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tos.html'));
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Failed to log out');
    }
    res.redirect('/login');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
