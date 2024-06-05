const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
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
      const passwordMatch = await bcrypt.compare(password, user.user_password);
      if (passwordMatch) {
        req.session.user = { email: user.user_email };
        res.status(200).send('User logged in successfully');
      } else {
        res.status(401).send('Incorrect password');
      }
    } else {
      res.status(404).send('No user found with the given email');
    }
  } catch (err) {
    console.error('Error during login process:', err);
    res.status(500).send('Internal server error');
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

app.post('/register', (req, res) => {
  const { email, password } = req.body;

  bcrypt.hash(password, 10, async (hashErr, hash) => {
    if (hashErr) {
      console.error('Error hashing password:', hashErr);
      res.status(500).send('Internal Server Error');
      return;
    }

    var verificationCode = Math.floor(Math.random() * 1000000);
    try {
      await sendVerificationEmail(email, verificationCode, hash);
      res.status(201).send('User registered successfully');
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });
});

async function sendVerificationEmail(email, verificationCode, hash) {
  let mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Email Verification',
    text: `Your verification code is: ${verificationCode}`
  };

  transporter.sendMail(mailOptions, async (error, info) => {
    if (error) {
      console.log('Error occurred while sending email:', error);
      throw error;
    }
    console.log('Email sent:', info.response);
    await checkDatabaseAndCreateDocument(email, hash);
  });
}

async function checkDatabaseAndCreateDocument(email, hash) {
  try {
    const existingDbsResponse = await cloudant.getAllDbs();
    const existingDbs = existingDbsResponse.result;
    const databaseName = "medibot_db";

    if (!existingDbs.includes(databaseName)) {
      await cloudant.putDatabase({ db: databaseName });
      console.log(`The database '${databaseName}' has been created.`);
    }

    const sampleData = [
      ["2", "levis", email, hash, "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N"]
    ];

    for (const document of sampleData) {
      const [
        id, user_name, user_email, user_password, Penicillin, Latex, Pollen, Nuts, Shellfish,
        Diabetes, Hypertension, Heart_Disease, Asthma, Cancer, Antihypertensives, Insulin, Anticoagulants,
        Asthma_Inhalers, Smoker, Non_Smoker, Alcohol_Consumption, Regular_Exercise, Vegetarian_Vegan_Diet
      ] = document;

      const jsonDocument = {
        "_id": id,
        "user_name": user_name,
        "user_email": user_email,
        "user_password": user_password,
        "Penicillin": Penicillin,
        "Latex": Latex,
        "Pollen": Pollen,
        "Nuts": Nuts,
        "Shellfish": Shellfish,
        "Diabetes": Diabetes,
        "Hypertension": Hypertension,
        "Heart Disease": Heart_Disease,
        "Asthma": Asthma,
        "Cancer": Cancer,
        "Antihypertensives": Antihypertensives,
        "Insulin": Insulin,
        "Anticoagulants": Anticoagulants,
        "Asthma Inhalers": Asthma_Inhalers,
        "Smoker": Smoker,
        "Non-Smoker": Non_Smoker,
        "Alcohol Consumption": Alcohol_Consumption,
        "Regular Exercise": Regular_Exercise,
        "Vegetarian/Vegan Diet": Vegetarian_Vegan_Diet
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
    }
  } catch (err) {
    console.error('Error: ', err);
    throw err;
  }
}

app.post('/reset', (req, res) => {
  // Handle password reset form submission
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Unauthorized');
  }
  res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Failed to log out');
    }
    res.status(200).send('Logged out successfully');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
