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
	messagesPOST: Joi.object().keys({
		to: Joi.string().required(),
		text: Joi.string().required(),
		type: Joi.string().valid('message', 'private_message').required(),
	}),
};
const time = dayjs().format('HH:mm:ss');

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

		await db.collection('messages').insertOne({
			from: value.name,
			to: 'Todos',
			text: 'entra na sala...',
			type: 'status',
			time,
		});

		return res.sendStatus(201);
	} catch (error) {
		console.log(error);
		return res.sendStatus(500);
	}
});

app.get('/messages', async (req, res) => {
	const { user: from } = req.headers;
	const limit = Number(req.query.limit);

	if (!from) {
		return res.status(400).send('headers inválida!');
	}

	try {
		const messages = await db
			.collection('messages')
			.find({
				$or: [{ from }, { to: from }, { type: 'message' }, { type: 'status' }],
			})
			.toArray();

		if (!limit) {
			return res.send(messages);
		}

		return res.send(messages.slice(0, limit));
	} catch (error) {
		console.log(error);
		return res.sendStatus(500);
	}
});

app.post('/messages', async (req, res) => {
	const { user: from } = req.headers;
	const { body } = req;

	if (!from) {
		return res.status(400).send('headers inválida!');
	}

	try {
		const { value, error } = schema.messagesPOST.validate(body);
		if (error) {
			const message = error.details.map((data) => data.message).join(',');
			return res.status(422).send(message);
		}

		const participants = await db.collection('participants').find().toArray();
		const fromON = participants.some(
			(participant) => participant.name === from
		);
		const toON = participants.some(
			(participant) => participant.name === value.to
		);
		if (!fromON || !toON) {
			return res.status(400).send('Usuário inexistente!');
		}

		await db.collection('messages').insertOne({
			from,
			to: body.to,
			text: body.text,
			type: body.type,
			time,
		});

		return res.sendStatus(201);
	} catch (error) {
		console.log(error);
		return res.sendStatus(500);
	}
});

app.post('/status', (req, res) => {
	const { user: name } = req.headers;

	res.sendStatus(201);
});

app.listen(5000, () => console.log('Listening on 5000'));
