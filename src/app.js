import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
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
		name: Joi.string().trim().required(),
	}),
	messagesPOST: Joi.object().keys({
		to: Joi.string().trim().required(),
		text: Joi.string().trim().required(),
		type: Joi.string().valid('message', 'private_message').required(),
	}),
};

const time = dayjs().format('HH:mm:ss');
const now = Date.now();

app.get('/participants', async (req, res) => {
	try {
		const participants = await db.collection('participants').find().toArray();
		return res.send(participants);
	} catch (err) {
		return res.status(500).send(err.message);
	}
});

app.post('/participants', async (req, res) => {
	const { value, error } = schema.participantsPOST.validate(req.body, {
		abortEarly: false,
	});
	if (error) {
		const message = error.details.map((detail) => detail.message).join(',');
		return res.status(422).send(message);
	}

	try {
		const nameExists = await db.collection('participants').findOne(value);
		if (nameExists) {
			return res.status(409).send('Nome de usuário já cadastrado!');
		}

		await db
			.collection('participants')
			.insertOne({ ...value, lastStatus: now });

		await db.collection('messages').insertOne({
			from: value.name,
			to: 'Todos',
			text: 'entra na sala...',
			type: 'status',
			time,
		});

		return res.sendStatus(201);
	} catch (err) {
		return res.status(500).send(err.message);
	}
});

app.get('/messages', async (req, res) => {
	const { user: from } = req.headers;
	const limit = Number(req.query.limit);

	try {
		const participant = await db
			.collection('participants')
			.findOne({ name: from });
		if (!participant) {
			return res.status(422).send('Usuário inválido!');
		}

		const messages = await db
			.collection('messages')
			.find({
				$or: [{ from }, { to: from }, { type: 'message' }, { type: 'status' }],
			})
			.toArray();

		if (!limit) {
			return res.send(messages);
		}

		return res.send(messages.slice(-limit));
	} catch (err) {
		return res.status(500).send(err.message);
	}
});

app.post('/messages', async (req, res) => {
	const { user: from } = req.headers;
	const { value, error } = schema.messagesPOST.validate(req.body, {
		abortEarly: false,
	});
	if (error) {
		const message = error.details.map((detail) => detail.message).join(',');
		return res.status(422).send(message);
	}

	try {
		const participant = await db
			.collection('participants')
			.findOne({ name: from });
		if (!participant) {
			return res.status(422).send('Usuário inválido!');
		}

		await db.collection('messages').insertOne({
			from,
			...value,
			time,
		});

		return res.sendStatus(201);
	} catch (err) {
		return res.status(500).send(err.message);
	}
});

app.put('/messages/:id', async (req, res) => {
	const { user: from } = req.headers;
	const { id } = req.params;
	const { value, error } = schema.messagesPOST.validate(req.body, {
		abortEarly: false,
	});
	if (error) {
		const message = error.details.map((detail) => detail.message).join(',');
		return res.status(422).send(message);
	}

	try {
		const participant = await db
			.collection('participants')
			.findOne({ name: from });
		if (!participant) {
			return res.status(422).send('Usuário inválido!');
		}

		const message = await db
			.collection('messages')
			.findOne({ _id: new ObjectId(id) });
		if (!message) {
			return res.status(404).send('Mensagem não encontrada!');
		}

		if (message.from !== from) {
			return res.status(401).send('Usuário inválido!');
		}

		await db
			.collection('messages')
			.updateOne({ _id: new ObjectId(id) }, { $set: value });

		return res.sendStatus(200);
	} catch (err) {
		return res.status(500).send(err.message);
	}
});

app.delete('/messages/:id', async (req, res) => {
	const { user: name } = req.headers;
	const { id } = req.params;

	try {
		const message = await db
			.collection('messages')
			.findOne({ _id: new ObjectId(id) });
		if (!message) {
			return res.status(404).send('Mensagem não encontrada!');
		}

		if (message.from !== name) {
			return res.status(401).send('Usuário inválido!');
		}

		await db.collection('messages').deleteOne({ _id: new ObjectId(id) });

		return res.sendStatus(200);
	} catch (err) {
		return res.status(500).send(err.message);
	}
});

app.post('/status', async (req, res) => {
	const { user: name } = req.headers;

	try {
		const participant = await db.collection('participants').findOne({ name });
		if (!participant) {
			return res.sendStatus(404);
		}

		await db
			.collection('participants')
			.updateOne({ name }, { $set: { lastStatus: now } });

		return res.sendStatus(201);
	} catch (err) {
		return res.status(500).send(err.message);
	}
});

function logOut(participants) {
	participants.forEach(async (participant) => {
		const inactive = now - participant.lastStatus > 10000;
		if (inactive) {
			try {
				await db.collection('participants').deleteOne({ _id: participant._id });

				await db.collection('messages').insertOne({
					from: participant.name,
					to: 'Todos',
					text: 'sai da sala...',
					type: 'status',
					time,
				});
				return console.log(
					`${participant.name} has been logged out by the server`
				);
			} catch (err) {
				return console.error(err.message);
			}
		}
	});
}

setInterval(async () => {
	try {
		const participants = await db.collection('participants').find().toArray();
		return logOut(participants);
	} catch (err) {
		return console.error(err.message);
	}
}, 15000);

app.listen(5000, () => console.log('Listening on port 5000'));
