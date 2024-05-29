const pg = require("pg");

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "social-media-app",
  password: "1234",
  port: 5432,
});

module.exports = db;
