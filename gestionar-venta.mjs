import AWS from 'aws-sdk';
import pkg from 'pg';
const { Client } = pkg;

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

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const DYNAMO_TABLE_NAME = "ventas_registradas";

const validateCard = (cardNumber) => {
    return cardNumber.startsWith('4') || cardNumber.startsWith('5');
};

export const handler = async (event) => {
    const body =JSON.parse(event.body);

    const { execution_id, card_number, nombre_evento } = body;
    
    if (!validateCard(card_number)) {
        return { statusCode: 400, body: "Tarjeta inválida." };
    }

    try {
        const dynamoParams = {
            TableName: DYNAMO_TABLE_NAME,
            Item: {
                execution_id: execution_id,
                timestamp: new Date().toISOString()
            },
            ConditionExpression: "attribute_not_exists(execution_id)",
        };

        try {
            await dynamoDB.put(dynamoParams).promise();
        } catch (error) {
            if (error.code === "ConditionalCheckFailedException") {
                return { statusCode: 400, body: "Ejecución duplicada." };
            }
            throw error;
        }

        const client = new Client(dbConfig);
        await client.connect();

        try {
            await client.query('BEGIN');

            const updateQuery = `
                UPDATE eventos
                SET entradas_disponibles = entradas_disponibles - 1
                WHERE nombre_evento = $1 AND entradas_disponibles > 0;
            `;
            const updateResult = await client.query(updateQuery, [nombre_evento]);

            if (updateResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return { statusCode: 400, body: "Entradas no disponibles o evento no encontrado." };
            }

            await client.query('COMMIT');
            return { statusCode: 200, body: "Venta completada." };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            await client.end();
        }
    } catch (error) {
        console.error("Error procesando la venta: ", error);
        return { statusCode: 500, body: `Error: ${error.message}` };
    }    
};