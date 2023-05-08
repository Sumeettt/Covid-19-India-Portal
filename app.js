const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//API 1 Login with 3 scenarios
app.post("/login/", async (request, response) => {
  const requestBody = request.body;
  const { username, password } = requestBody;
  const userSearchQuery = `
        SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(userSearchQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  }
  const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
  if (isPasswordMatched === false) {
    response.status(400);
    response.send("Invalid password");
  } else {
    const payload = { username: username };
    const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
    response.send({ jwtToken });
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//API 2 GET Returns a list of all states in the state table
app.get("/states/", authenticateToken, async (request, response) => {
  const getQuery = `
        SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population
        FROM state;
    `;
  const statesArr = await db.all(getQuery);
  response.send(statesArr);
});

module.exports = app;
