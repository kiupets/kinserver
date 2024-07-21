const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI;

// ("mongodb+srv://kiupets:julietaygonzalo2023@cluster0.cpgytzo.mongodb.net/db-name?retryWrites=true&w=majority");
// const MONGO_URI =
//   "mongodb+srv://kiupets:julietaygonzalo2023@cluster0.cpgytzo.mongodb.net/db-name?retryWrites=true&w=majority";

mongoose
  .connect(
    "mongodb+srv://kiupets:julietaygonzalo2023@cluster0.cpgytzo.mongodb.net/db-name?retryWrites=true&w=majority",
    // MONGO_URI,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
