import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('hello');
});

app.listen(5000, () => console.log('Listening on 5000'));