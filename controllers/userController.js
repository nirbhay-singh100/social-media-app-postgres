require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const db = require("../config/dbConfig");
const asyncHandler = require("express-async-handler");
const { generateAuthToken } = require("../config/generateToken");

const register = asyncHandler(async (req, res) => {
  const { username, fullName, password, confirmPassword } = req.body;

  if (!username || !fullName || !password || !confirmPassword) {
    res.status(400).send("Please fill all the details");

    throw new Error("please fill all the fields");
  }

  if (password !== confirmPassword) {
    res.status(400).send("Password do not match");

    throw new Error("password do not match");
  }

  const userExist = await db.query(
    "select username from userdetails where username=$1",
    [username]
  );

  if (userExist.rows.length === 1) {
    res.status(400).send("user already exist");

    throw new Error("user already exist");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await db.query(
    "insert into userdetails (username, full_name, password) values ($1,$2,$3) returning *",
    [username, fullName, hashedPassword]
  );

  const token = await generateAuthToken(result.rows[0].user_id);

  res.cookie("jwtoken", token, {
    expires: new Date(Date.now() + 50000000000000),
    httpOnly: true,
  });

  res.json(result.rows[0]);
});

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const userExist = await db.query(
    "select * from userdetails where username = $1 ",
    [username]
  );

  if (userExist.rows.length === 0) {
    res.status(400).send("user does not exist");

    throw new Error("Invalid user");
  }

  const isPasswordCorrect = await bcrypt.compare(
    password,
    userExist.rows[0].password
  );

  if (!isPasswordCorrect) {
    res.status(400).send("password incorrect");

    throw new Error("Password incorrect");
  }
  const token = await generateAuthToken(userExist.rows[0].user_id);

  res.cookie("jwtoken", token, {
    expires: new Date(Date.now() + 50000000000000),
    httpOnly: true,
  });

  res.json(userExist.rows[0]);
});

module.exports = { register, login };
