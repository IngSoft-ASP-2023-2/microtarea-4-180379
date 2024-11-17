import AWS from 'aws-sdk';
import pkg from 'pg';
const { Client } = pkg;


const s3 = new AWS.S3();

const dbConfig = {
    user: "postgres",
    password: "postgres",
    host: "database-microtarea4.ch6q2y4ymmc3.us-east-1.rds.amazonaws.com",
    database: "postgres",
    port: 5432,
    ssl: {
        rejectUnauthorized: false, 
    },
};

export const handler = async (event) => {
    try {
        const record = event.Records[0];
        const bucketName = record.s3.bucket.name;
        const objectKey = record.s3.object.key;

        const flyerUrl = `https://${bucketName}.s3.amazonaws.com/${objectKey}`;
        const eventName = objectKey.split('.')[0];

        const client = new Client(dbConfig);
        await client.connect();

        const query = `
            UPDATE eventos
            SET flyer = $1
            WHERE nombre_evento = $2
        `;
        const values = [flyerUrl, eventName];
        await client.query(query, values);

        await client.end();

        console.log(`Flyer actualizado para el evento: ${eventName}`);
        return { statusCode: 200, body: "Flyer insertado correctamente." };
    } catch (error) {
        console.error("Error procesando el evento S3:", error);
        return { statusCode: 500, body: `Error: ${error.message}` };
    }
};