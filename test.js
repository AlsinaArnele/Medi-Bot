async function checkDatabaseAndCreateReset(email, verificationCode) {
    try {
      const existingDbsResponse = await cloudant.getAllDbs();
      const existingDbs = existingDbsResponse.result;
      const databaseName = "medibot_db";
  
      if (!existingDbs.includes(databaseName)) {
        await cloudant.putDatabase({ db: databaseName });
        console.log(`The database '${databaseName}' has been created.`);
      }
  
      const id = `reset_${email}`;
  
      const jsonDocument = {
        "user_email": email,
        "verification_code": verificationCode
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
  

  checkDatabaseAndCreateReset("leviskibet2002@gmail.com", "1234");