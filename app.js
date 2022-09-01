import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
	db = mongoClient.db('batepapo-uol-api');
});

app.get('/participants', (req, res) => {
	try {
		const participants = db.collection('batepapo-uol-api').find().toArray();
		res.send(participants);
	} catch (error) {
		console.log(error);
		res.sendStatus(500);
	}
});

app.post('/participants', (req, res) => {
	const { name } = req.body;

	res.sendStatus(201);
});

app.get('/messages', (req, res) => {
	const { user: name } = req.headers;
	const limit = Number(req.query.limit);

	if (!limit) {
		res.send('All messages');
	}

	res.send('messages');
});

app.post('messages', (req, res) => {
	const { user: from } = req.headers;
	const { to, text, type } = req.body;

	res.sendStatus(201);
});

app.post('/status', (req, res) => {
	const { user: name } = req.headers;

	res.sendStatus(201);
});

app.listen(5000, () => console.log('Listening on 5000'));
