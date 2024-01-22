const express = require('express')
const cors = require("cors");
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');


app.use(cors());
app.use(express.json());
const port = 5000


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `${process.env.MONGO_URI}`;
const secretKey = `${process.env.SECRET_KEY}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        const userCollection = client.db("HouseHunter").collection("users");
        const houseCollection = client.db("HouseHunter").collection("houses");

        // POST NEW USER DATA TO DATABASE

        app.post("/userRegister", async (req, res) => {
            let userData = req.body;

            let userEmail = userData.email;
            let existingUser = await userCollection.findOne({ email: userEmail });

            if (existingUser) {
                return res.status(400).json({ message: 'User already exists' });
            }

            let result = await userCollection.insertOne(userData);

            let token = jwt.sign({ userEmail }, secretKey, { expiresIn: '24h' });
            res.cookie('accessToken', token, { httpOnly: true });
            res.status(200).json({ message: 'User registered successfully', token });
        })

        // API TO LOGIN USERS 
        app.post("/userLogin", async (req, res) => {
            let { email, password } = req.body;

            let user = await userCollection.findOne({ email });

            if (!user || user.password !== password) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            let token = jwt.sign({ email }, secretKey, { expiresIn: '24h' });

            res.cookie('accessToken', token, { httpOnly: true });
            res.status(200).json({ message: 'Login successful', token });
        });

        // GET USER DATA BY EMAIL 
        app.get('/userData/:email', async (req, res) => {
            const userEmail = req.params.email;

            try {
                const userData = await userCollection.findOne({ email: userEmail });

                if (!userData) {
                    return res.status(404).json({ message: 'User not found' });
                }

                res.status(200).json(userData);
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // POST HOUSE DATA 
        app.post("/houses", async (req, res) => {
            let houseDetails = req.body;
            let result = await houseCollection.insertOne(houseDetails);
            res.send(result);
        })

        // API TO GET HOUSES BY SPECIFIC USER 
        app.get("/myHouses", async (req, res) => {
            let ownerEmail = req.query.ownerEmail;
            console.log(ownerEmail);

            if (!ownerEmail) {
                return res.status(400).json({ error: 'Owner email Not Found' });
            }
            const result = await houseCollection.find({ ownerEmail }).toArray();
            res.send(result);
        });

        // API TO DELETE HOUSE
        app.delete("/deleteHouse/:id", async (req, res) => {
            let id = req.params.id;
            let query = { _id: new ObjectId(id) };
            let result = await houseCollection.deleteOne(query);
            res.send(result);
        })


        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('House Hunter Server!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})