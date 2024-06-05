const { CloudantV1 } = require('@ibm-cloud/cloudant');
const { IamAuthenticator } = require('ibm-cloud-sdk-core');

const ACCOUNT_NAME = "1fdde7b7-127a-44e1-8179-742ac656bb75-bluemix";
const API_KEY = "QnbgTY3NNRWXGbxUOLPXeo7F2gzInC1xZW_XEKitqguM";

const authenticator = new IamAuthenticator({
    apikey: API_KEY
});

const cloudant = CloudantV1.newInstance({
    authenticator: authenticator,
    serviceName: ACCOUNT_NAME
});

cloudant.setServiceUrl(`https://${ACCOUNT_NAME}.cloudantnosqldb.appdomain.cloud`);

async function checkDatabaseAndCreateDocument() {
    try {
        const existingDbsResponse = await cloudant.getAllDbs();
        const existingDbs = existingDbsResponse.result;

        const databaseName = "medibot_db";

        if (existingDbs.includes(databaseName)) {
            console.log(`The database '${databaseName}' already exists.`);
        } else {
            console.log(`The database '${databaseName}' does not exist.`);
            await cloudant.putDatabase({ db: databaseName });
            console.log(`The database '${databaseName}' has been created.`);
        }

        const sampleData = [
            ["2", "levis", "alsinaarnele@gmail.com", "password", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N"]
        ];

        for (const document of sampleData) {
            const [
                id, user_name, email, password,
                Penicillin, Latex, Pollen, Nuts, Shellfish,
                Diabetes, Hypertension, Heart_Disease, Asthma,
                Cancer, Antihypertensives, Insulin, Anticoagulants,
                Asthma_Inhalers, Smoker, Non_Smoker, Alcohol_Consumption,
                Regular_Exercise, Vegetarian_Vegan_Diet
            ] = document;

            const jsonDocument = {
                "_id": id,
                "user_name": user_name,
                "user_email": email,
                "user_password": password,
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
    }
}

checkDatabaseAndCreateDocument();
