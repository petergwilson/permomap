/*
*Permomap Server module
*Written initially by Peter Wilson, 2025
*Uses javascript express and pg modules
*Middleware routers are for the various api calls from the client application, putting together the
*SQL queries for the database based on the JSON/GeoJSON information sent by the client. Responses back
*to the client are also in GeoJSON.
*Session information
*WRITE THIS ONCE FINISHED
*/

import express from 'express';
import { Pool } from 'pg';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';

import cookieParser from 'cookie-parser';
import cors from 'cors';
//import multer from 'multer';

const app = express();

//Port for the application, either process.env.PORT variable or 3000
//process.env.PORT may be able to be set at run time, don't know
const PORT = process.env.PORT || 3000;

// PostgreSQL connection info
//Adjust if necessary if database parameters change
//FOR INSTANCE, production server database name is "postgres", testing version "gis"
//FIX THIS OR BRING IN DEPLOYMENT BUILD LOGIC
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gis',
});

//Session and cookie variables


//pgSession (postgresql session/state store)
app.use(cookieParser());

const PgSessionStore = connectPgSimple(session);

const store = new PgSessionStore({
  pool: pool,
  tableName: 'permomap_session', //pg table name for session information
});

const sessionMiddleware=session({
    secret: 'ForestServiceTracksAreBest', //hash completion secret PROBABLY SHOULDN'T BE HERE,
    store:store,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
});


//CORS for all routes
//Also this is CORS for all origins
app.use((req, res, next) => {
  res
      .header('Access-Control-Allow-Origin',
          '*');
  res
      .header('Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE');
  res
      .header('Access-Control-Allow-Headers',
          'Origin, X-Requested-With,Content-Type, Accept');
  next();
});

//Session middleware
app.use(sessionMiddleware);


// Middleware to parse JSON bodies
app.use(express.json({ type: 'application/json' }));


/*
*Login
*/



app.post('/api/login', async (req, res) => {
  console.log(JSON.stringify(req.body));

  //const { username, password } = req.body;
  //Get info from permomap_users table
  const user = await pool.query('SELECT username,password,role,userid FROM permomap_users WHERE username = $1', [req.body.username]);
  //Check to see if passwords match
  if (user.rows.length > 0 && req.body.password==user.rows[0].password) {
    //USER TABLE WILL NEED A USERID-NOT SAME AS USERNAME BUT COULD BE
    //Sets the session userId and username to that saved in the databasel 
    req.session.userid = user.rows[0].userid;
    req.session.username=user.rows[0].username;
    req.session.role=user.rows[0].role;

    const data={ 
      ok: true, 
      message: 'Login successful',
      username:user.rows[0].username,
      userid:user.rows[0].userid,
      role:user.rows[0].role,
      status:200, };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } else {
    res.status(401).json({ok:false, message: 'Invalid credentials' });
  }
});


app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
          return res.status(500).json({ok:false,message: 'Could not log out' });
        }
        res.status(200).json({ ok:true, message: 'Logged out successfully' });
      });
  });


// Example route to get session data
app.get('/api/get_session', (req, res) => {
  if (req.session.username) {
      res.status(200).json({ ok:true, username: `${req.session.username}`,userid: req.session.userid,role: req.session.role});
  } else {
    res.status(401).json({ok:false, message: 'Invalid credentials' });
  }
});



// Route to handle GeoJSON data
// Main saving logic
app.post('/api/save', async(req, res) => {
    var primary_key_sql,sql1,sql2,sql3,sql4,sql_final;
    primary_key_sql=sql1=sql2=sql3=sql4=sql_final='';
    var result,new_id;

    const geojsonData = req.body;
    console.log(req.body);
  
  
        try {
          var result_total;
          var new_id;

          const client = await pool.connect();
          sql1="/*START SAVE FEATURES*/ SELECT max(id)+1 as new_id FROM permolat_tracks;";
          const result1 = await client.query(sql1);

          client.release(); // release the client back to the pool

          console.log(result1.rows[0].new_id);

          new_id=result1.rows[0].new_id;

          //result_total=result1.rows; // Query result to object

          //Makes a new row entry with the updated features and geometry
          //

          sql2=`WITH feat AS (SELECT '${JSON.stringify(req.body)}'::json as data)
          INSERT INTO permolat_tracks (geom,id,trackname,layer_name,importance,tracktype,currentcon,custodian,next_id,prev_id,history,status)
          SELECT ST_SetSRID(ST_GeomFromGeoJSON(data->>'geometry'),3857),
          ${new_id}::int,
          data->'properties'->>'trackname',
          data->'properties'->>'layer_name',
          data->'properties'->>'importance',
          data->'properties'->>'tracktype',
          data->'properties'->>'currentcon',
          data->'properties'->>'custodian',
          null,
          (data->'properties'->>'id')::int,
          data->'properties'->>'history',
          'pending' --THIS STAYS AS PENDING UNTIL MODERATED, MODERATORS SEE THIS
          FROM feat;`;

          console.log("sql2: "+sql2);
          //const client2 = await pool.connect();

          //const result2 = await client2.query(sql2);

          //client2.release(); // release the client back to the pool

          //result_total=result_total+result2.rows; // Query result to object

          
          //Set the old object live=false, and next id as the object above
          //OLD LOGIC PRE MODERATION IS TO SET THE OLD ONE AS LIVE=FALSE IMMEDIATELY
          //MODERATION LOGIC WILL HAVE THIS SOMEWHERE ELSE
          
          //sql3=`WITH feat AS (SELECT '${JSON.stringify(req.body)}'::json as data)
          //UPDATE permolat_tracks SET live=false, next_id=${new_id}
          //FROM (SELECT (data->'properties'->>'id')::int old_id FROM feat) sub_query 
          //WHERE id=sub_query.old_id; /*END SAVE FEATURES*/`;
          
          //console.log("sql3: "+sql3);

          const client3 = await pool.connect();
        
          const result = await client3.query(sql2);

          client3.release(); // release the client back to the pool

          //result_total=result_total+result3.rows; // Query result to object
          
          res.status(201).json({ success: true,id: result.command});
          
        } catch (error) {
            console.error('Error fetching data:', error);
            res.status(500).json({ error: 'Database error'+error });
        }
    });
          
//ROLLBACKS AND ROLLFORWARDS MAY BE MODERATOR ONLY FUNCTIONS.
    
app.post('/api/rollback', async(req, res) => {
  var sql2,sql3,sql4;
  sql2=sql3=sql4="";

  const geojsonData = req.body;

  console.log(req.body.properties["history"]);
      
  try {
      //Set the status flag on the next parcel to old
      sql2=`/*START ROLLBACK*/ UPDATE permolat_tracks SET status='old' WHERE id=${req.body.properties.id};`;
      //Set the status flag on the previous parcel to live
      //NEED SOMETHING ON HISTORY here. Not the creation, may need to record the history
      //ANY HISTORY function needs to read across all things in that area - can't be linked just to the layer because these can change
      //Could use a bounding box?
      sql3=`UPDATE permolat_tracks SET status='live' WHERE id=${req.body.properties.prev_id};`;
      
      //Record some history
      //Get date
      const now = new Date();


      sql4=`UPDATE permolat_tracks SET history=history || '${req.body.name+':'+req.body.email} returned this to live on ${now.toLocaleString()}' WHERE id=${req.body.properties.prev_id};
      /*END ROLLBACK*/`;

      //sql_start="INSERT INTO parcels_3857  ";

      console.log(sql2+sql3+sql4);

      //sql_end=") WHERE id="+req.body.id+" RETURNING id";
      //Remove trailing comma
      //sql=sql_start+sql_middle.slice(0,-1)+sql_end; 
      //console.log(sql)
      const result = await pool.query(sql2+sql3+sql4);
      console.log(result);
      res.status(201).json({ success: true,id: result.command});
  } 
  catch (err) {
      console.error('DB error:', err);
      res.status(500).json({ error: 'Database error'+err });

  }
});

//ROLL FORWARD

app.post('/api/rollforward',async(req, res) => {
  var sql2,sql3,sql4;
  sql2=sql3=sql4="";

  
  try {
  //Set the flag on current parcel to old
  sql2=`/*START ROLLFORWARD*/ UPDATE permolat_tracks SET status='old' WHERE id=${req.body.properties.id};`;
  //Set the flag on the next parcel in the chain to live 
  //NEED SOMETHING ON HISTORY here. Not the creation, may need to record the history
  //ANY HISTORY function needs to read across all things in that area - can't be linked just to the layer because these can change
  //Could use a bounding box?
  sql3=`UPDATE permolat_tracks SET status='live' WHERE id=${req.body.properties.next_id};`;
  //Record some history
  //Get date
  const now = new Date();
  sql4=`UPDATE permolat_tracks SET history=history || '${req.body.name+':'+req.body.email} returned this to live on ${now.toLocaleString()}' WHERE id=${req.body.properties.next_id};
  /*END ROLLFORWARD*/`;

  //sql_start="INSERT INTO parcels_3857  ";

  console.log(sql2+sql3+sql4);

  //sql_end=") WHERE id="+req.body.id+" RETURNING id";
  //Remove trailing comma
  //sql=sql_start+sql_middle.slice(0,-1)+sql_end; 
  //console.log(sql)
  const result = await pool.query(sql2+sql3+sql4);
  console.log(result);
  res.status(201).json({ success: true,id: result.command});
  } 
  catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error'+err });

  }
});

app.get('/api/total_length',async(req, res) => {
  var sql2,sql3,sql4;
  sql2=sql3=sql4="";

  
  try {
  //Set the live flag on the current parcel to false
  sql2=`/*START SPATIAL STATS*/ SELECT round(cast(sum(ST_Length(geom)/1000) as numeric)) || ' km of NZ tramping tracks and routes under community management' as length FROM permolat_tracks WHERE status='live';`;
  //Set the live flag on the next parcel in the chain to true
  //NEED SOMETHING ON HISTORY here. Not the creation, may need to record the history
  //ANY HISTORY function needs to read across all things in that area - can't be linked just to the layer because these can change
  //Could use a bounding box?
  //sql3=`UPDATE permolat_tracks SET live=true WHERE id=${req.body.properties.next_id};`;
  //Record some history
  //Get date
  //const now = new Date();
  //sql4=`UPDATE permolat_tracks SET history=history || 'returned this to live on ${now.toLocaleString()}' WHERE id=${req.body.properties.next_id};
  /*END ROLLFORWARD*/;

  //sql_start="INSERT INTO parcels_3857  ";

  console.log(sql2+sql3+sql4);

  //sql_end=") WHERE id="+req.body.id+" RETURNING id";
  //Remove trailing comma
  //sql=sql_start+sql_middle.slice(0,-1)+sql_end; 
  //console.log(sql)
  const result = await pool.query(sql2+sql3+sql4);
  console.log(result);
  res.status(201).json({ success: true,data: result.rows[0]});
  } 
  catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error'+err });

  }
});


app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
