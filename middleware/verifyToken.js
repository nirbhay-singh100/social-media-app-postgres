const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const auth = async (req, res, next) => {
  try {
    const token = req.cookies.jwtoken;
    const verifyUser = jwt.verify(token, process.env.SECRET_KEY);

    req.user_id = verifyUser.user_id;

    next();
  } catch (err) {
    res.status(401).send("unauthorized user");
    console.log(err);
  }
};

module.exports = auth;
