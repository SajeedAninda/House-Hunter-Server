let express = require('express')
let cors = require("cors");
let app = express();
require('dotenv').config();
let jwt = require('jsonwebtoken');


app.use(cors());
app.use(express.json());
let port = 5000


let { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
let uri = `${process.env.MONGO_URI}`;
let secretKey = `${process.env.SECRET_KEY}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
let client = new MongoClient(uri, {
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
        let userCollection = client.db("HouseHunter").collection("users");
        let houseCollection = client.db("HouseHunter").collection("houses");
        let bookingCollections = client.db("HouseHunter").collection("houseBookings");

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
            let userEmail = req.params.email;

            try {
                let userData = await userCollection.findOne({ email: userEmail });

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

            if (!ownerEmail) {
                return res.status(400).json({ error: 'Owner email Not Found' });
            }
            let result = await houseCollection.find({ ownerEmail }).toArray();
            res.send(result);
        });

        // API TO DELETE HOUSE
        app.delete("/deleteHouse/:id", async (req, res) => {
            let id = req.params.id;
            let query = { _id: new ObjectId(id) };
            let result = await houseCollection.deleteOne(query);
            res.send(result);
        })

        // GET HOUSE DETAILS BY SPECIFIC HOUSE ID
        app.get("/houseDetails/:id", async (req, res) => {
            let id = req.params.id;
            let query = { _id: new ObjectId(id) };
            let result = await houseCollection.findOne(query);
            res.send(result);
        })

        // API TO UPDATE HOUSE DETAILS 
        app.patch("/updateHouse/:id", async (req, res) => {
            let id = req.params.id;
            let houseDetails = req.body;
            let filter = { _id: new ObjectId(id) };
            let options = { upsert: true };
            let updatedHouse = {
                $set: {
                    houseName: houseDetails.houseName,
                    address: houseDetails.address,
                    location: houseDetails.location,
                    totalBedrooms: houseDetails.totalBedrooms,
                    totalBathrooms: houseDetails.totalBathrooms,
                    roomSize: houseDetails.roomSize,
                    availableDate: houseDetails.availableDate,
                    rent: houseDetails.rent,
                    phoneNumber: houseDetails.phoneNumber,
                    description: houseDetails.description
                },
            };
            let result = await houseCollection.updateOne(
                filter,
                updatedHouse,
                options
            );
            res.send(result);
        });

        // API TO GET ALL HOUSES 
        app.get("/allHouses", async (req, res) => {
            let { rentMin, rentMax, city, bedRooms, bathRoom, minRoomSize, maxRoomSize, searchText } = req.query;
            let filter = {};

            if (rentMin && rentMax) {
                filter.rent = { $gte: parseFloat(rentMin), $lte: parseFloat(rentMax) };
            }

            if (minRoomSize && maxRoomSize) {
                filter.roomSize = { $gte: parseFloat(minRoomSize), $lte: parseFloat(maxRoomSize) };
            }

            if (city && city !== 'allCity') {
                filter.location = city;
            }

            if (bedRooms && bedRooms !== 'allRooms') {
                filter.totalBedrooms = bedRooms;
            }

            if (bathRoom && bathRoom !== 'allBathRooms') {
                filter.totalBathrooms = bathRoom;
            }

            if (searchText) {
                filter.$or = [
                    { houseName: { $regex: new RegExp(searchText, 'i') } }
                ];
            }

            let result = await houseCollection.find(filter).toArray();
            res.send(result);
        })

        // API TO GET SINGLE HOUSE DETAILS 
        app.get("/houseDetails/:id", async (req, res) => {
            let id = req.params.id;
            let query = { _id: new ObjectId(id) };
            let result = await houseCollection.findOne(query);
            res.send(result);
        })

        // API TO HANDLE HOUSE BOOKINGGS
        app.post('/houseBookings', async (req, res) => {
            let existingUserBookings = await bookingCollections.find({
                bookerEmail: req.body.bookerEmail,
            }).toArray();

            if (existingUserBookings.length >= 2) {
                return res.status(400).json({ error: 'Cannot book more than two houses.' });
            }

            let existingHouseBooking = await bookingCollections.findOne({
                houseId: req.body.houseId,
            });

            if (existingHouseBooking) {
                return res.status(400).json({ error: 'House already booked.' });
            }

            let result = await bookingCollections.insertOne(req.body);
            res.send(result);
        });

        // GET CURRENT HOUSE RENTER 
        app.get('/userHouseBookings', async (req, res) => {
            let currentUserEmail = req.query.email;
            let result = await bookingCollections.find({ bookerEmail: currentUserEmail }).toArray();
            res.send(result)
        });








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