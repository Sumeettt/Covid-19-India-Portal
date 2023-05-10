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
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    }
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

//API 3 GET Returns a state based on the state ID
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `
        SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population
        FROM state
        WHERE state_id = ${stateId};
    `;
  const stateDetails = await db.get(getQuery);
  response.send(stateDetails);
});

//API 4 POST Create a district in the district table
app.post("/districts/", authenticateToken, async (request, response) => {
  const requestBody = request.body;
  console.log(requestBody);
  const { districtName, stateId, cases, cured, active, deaths } = requestBody;
  const postQuery = `
        INSERT INTO 
        district (district_name, state_id,cases,cured,active,deaths)
        VALUES(
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  const dbResponse = await db.run(postQuery);
  console.log(dbResponse.lastId);
  response.send("District Successfully Added");
});

//API 5 Returns a district based on the district ID
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `
        SELECT 
        district_id AS districtId,
        district_name AS districtName,
        state_id AS stateId,
        cases,
        cured,
        active,
        deaths
        FROM district
        WHERE district_id = ${districtId};
    `;
    const districtDetails = await db.get(getQuery);
    response.send(districtDetails);
  }
);

//API 6 Deletes a district from the district table based on the district ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
        DELETE FROM 
        district 
        WHERE
        district_id = ${districtId};
    `;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7 Updates the details of a specific district based on the district ID
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const requestBody = request.body;
    const { districtName, stateId, cases, cured, active, deaths } = requestBody;
    console.log(requestBody);
    const updateQuery = `
        UPDATE district
        SET 
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        
        WHERE district_id = ${districtId};
    `;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API 8 Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `
        SELECT
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
        FROM 
        district
        WHERE 
        state_id = ${stateId};
    `;

    const stats = await db.get(getQuery);
    response.send(stats);
  }
);

module.exports = app;
