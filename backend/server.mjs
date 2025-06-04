import express from 'express';
import { Pool } from 'pg';
//import multer from 'multer';

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection info
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gis',
});


// Middleware to parse JSON bodies
app.use(express.json({ type: 'application/json' }));

// Use multer to handle multi-part form data
// NOT USING AT PRESENT
//const upload=multer({storage: multer.memoryStorage()});

//Modify/upload new geometry
/*
*This is handled carefully, nothing is actually deleted, 
*MIME multipart/form-data type
*A new row is created (as with the other updates, with the new geometry added)
*For old rows, set live=false
*Can delete all the way back to the starting layer, cannot delete beyond this. 
*IT DOES MEAN NEEDING SOME BOUNDING BOX APPROACH BASED ON MAP WINDOW TO IDENTIFY DELETED/HIDDEN LAYERS
*/


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

          //Create the new object with the new values
          //NEED TO WORK OUT HOW TO HANDLE NULLS FOR next_id
          //This should move over the geometry regardless of if it has been edited or not

          sql2=`WITH feat AS (SELECT '${JSON.stringify(req.body)}'::json as data)
          INSERT INTO permolat_tracks (geom,id,trackname,layer_name,importance,tracktype,currentcon,custodian,next_id,prev_id,history,live)
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
          true
          FROM feat;`;

          console.log("sql2: "+sql2);
          //const client2 = await pool.connect();

          //const result2 = await client2.query(sql2);

          //client2.release(); // release the client back to the pool

          //result_total=result_total+result2.rows; // Query result to object

          
          //Set the old object live=false, and next id as the object above
          sql3=`WITH feat AS (SELECT '${JSON.stringify(req.body)}'::json as data)
          UPDATE permolat_tracks SET live=false, next_id=${new_id}
          FROM (SELECT (data->'properties'->>'id')::int old_id FROM feat) sub_query 
          WHERE id=sub_query.old_id; /*END SAVE FEATURES*/`;

          console.log("sql3: "+sql3);

          const client3 = await pool.connect();

          const result = await client3.query(sql2+sql3);

          client3.release(); // release the client back to the pool

          //result_total=result_total+result3.rows; // Query result to object
          
          res.status(201).json({ success: true,id: result.command});
          
        } catch (error) {
            console.error('Error fetching data:', error);
            res.status(500).json({ error: 'Database error'+error });
        }
    });
          
         
app.post('/api/rollback', async(req, res) => {
  var sql2,sql3,sql4;
  sql2=sql3=sql4="";

  const geojsonData = req.body;

  console.log(req.body.properties["history"]);
      
  try {
      //Set the live flag on the current parcel to false
      sql2=`/*START ROLLBACK*/ UPDATE permolat_tracks SET live=false WHERE id=${req.body.properties.id};`;
      //Set the live flag on the previous parcel in the chain to true
      //NEED SOMETHING ON HISTORY here. Not the creation, may need to record the history
      //ANY HISTORY function needs to read across all things in that area - can't be linked just to the layer because these can change
      //Could use a bounding box?
      sql3=`UPDATE permolat_tracks SET live=true WHERE id=${req.body.properties.prev_id};`;
      
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
  //Set the live flag on the current parcel to false
  sql2=`/*START ROLLFORWARD*/ UPDATE permolat_tracks SET live=false WHERE id=${req.body.properties.id};`;
  //Set the live flag on the next parcel in the chain to true
  //NEED SOMETHING ON HISTORY here. Not the creation, may need to record the history
  //ANY HISTORY function needs to read across all things in that area - can't be linked just to the layer because these can change
  //Could use a bounding box?
  sql3=`UPDATE permolat_tracks SET live=true WHERE id=${req.body.properties.next_id};`;
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
  sql2=`/*START SPATIAL STATS*/ SELECT round(cast(sum(ST_Length(geom)/1000) as numeric)) || ' km of NZ tramping tracks and routes under community management' as length FROM permolat_tracks WHERE live=true;`;
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



app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
