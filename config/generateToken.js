require("dotenv").config();
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const generateAuthToken = async (user) => {
  const token = jwt.sign({ user_id: user.toString() }, process.env.SECRET_KEY);
  console.log(token);
  return token;
};

module.exports = { generateAuthToken };
