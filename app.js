require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const userRoutes = require("./routes/userRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const db = require("./config/dbConfig");

const app = express();
const port = process.env.PORT || 3000;

db.connect();

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api/authentication", userRoutes);
app.use("/api/application", applicationRoutes);

app.listen(port, (req, res) => {
  console.log("server is running ", port);
});
