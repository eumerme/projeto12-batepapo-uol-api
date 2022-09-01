import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import Joi from 'joi';
import dayjs from 'dayjs';
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

const schema = {
	participantsPOST: Joi.object().keys({
		name: Joi.string().required(),
	}),
};

app.get('/participants', async (req, res) => {
	try {
		const participants = await db.collection('participants').find().toArray();
		return res.send(participants);
	} catch (error) {
		console.log(error);
		return res.sendStatus(500);
	}
});

app.post('/participants', async (req, res) => {
	const { body } = req;

	try {
		const { value, error } = schema.participantsPOST.validate(body);
		if (error) {
			const message = error.details.map((data) => data.message).join(',');
			return res.status(422).send(message);
		}

		const participants = await db.collection('participants').find().toArray();
		const nameExists = participants.some(
			(participant) => participant.name === value.name
		);
		if (nameExists) {
			return res.status(409).send('Nome de usuário já cadastrado!');
		}

		await db
			.collection('participants')
			.insertOne({ ...value, lastStatus: Date.now() });

		const now = dayjs().format('HH:mm:ss');
		await db.collection('messages').insertOne({
			from: value.name,
			to: 'Todos',
			text: 'entra na sala...',
			type: 'status',
			time: now,
		});

		return res.sendStatus(201);
	} catch (error) {
		console.log(error);
		return res.sendStatus(500);
	}
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
