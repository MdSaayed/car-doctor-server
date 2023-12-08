const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// midlewares
app.use(cors({
    origin: ['https://cheery-chebakia-29ff98.netlify.app', 'http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// own midlewares
const logger = async (req, res, next) => {
    console.log('called:', req.host, req.originalUrl);
    next();
}

// token varify
const varifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'Not authorized' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized' })
        }
        req.user = decode;
        next();
    })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dejlh8b.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // await client.connect();

        const servicesCollection = client.db("carsDoctor").collection('services');
        const bookingsCollection = client.db("carsDoctor").collection('bookings');


        // auth api
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'none'
                })
                .send({ success: true });
        })

        // delete cookie
        app.post('/logout', async (req, res) => {
            const user = req.body;
            res.clearCookie('token', { maxAge: 0 }).send({ message: 'success' })
        })

        // services api
        app.get('/services', logger, async (req, res) => {
            const filter = req.query;
            console.log(filter)
            const query = {
                price: {
                    $lte: parseInt(filter.min)
                },
                package_name: {
                    $regex: filter.search, $options: 'i'
                }
            };
            const options = {
                sort: { price: filter.sort === 'asc' ? 1 : -1 }
            }
            const cursor = servicesCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await servicesCollection.findOne(query);
            res.send(result);
        })

        // bookings
        app.post('/bookings', async (req, res) => {
            const bookig = req.body;
            const result = await bookingsCollection.insertOne(bookig);
            res.send(result);
        })

        // get bookings
        app.get('/bookings', logger, varifyToken, async (req, res) => {
            // console.log('token from get bookings api:', req.cookies.token);
            if (req.query?.email !== req.user.email) {
                return res.status(403).send({ message: 'Forbidden access.' })
            }
            let query = {}
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })

        // delete booking
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = bookingsCollection.deleteOne(query);
            res.send(result);
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close(); 
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Server is running now');
});

app.listen(port, () => {
    console.log(`My server is running now on port, ${port}`);
});



















