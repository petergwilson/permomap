// MapComponent.js
import React, { useEffect, useRef } from "react";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import "ol/ol.css";

function MapComponent() {
  const mapRef = useRef()

  //This react hook ensures that the map is created AFTER the component is mounted
  //The map has to be loaded this way to ensure that React adds it into its own Virtual DOM, rather than the
  //general web-browser DOM. This will make it far faster. 
  //I THINK ALL REACT COMPONENTS MUST BE LOADED INTO THE VIRTUAL DOM FOR IT TO WORK
  useEffect(() => {
    //Import layers

    	const topo50_layer=new TileLayer({
            source: new ImageTile({
            url: 'https://tiles-cdn.koordinates.com/services;key=20b10a680c3742798647ec56775918a4/tiles/v4/layer=50767/EPSG:3857/{z}/{x}/{y}.png',
            }),
        });
        /*            
        const pg_test= new VectorTileLayer({
            source: new VectorTileSource({
                format: new MVT(),
                url: 'http://localhost:7800/public.nz_primary_parcels/{z}/{x}/{y}.pbf',
                }),
        });
        */

        // Create a style function
        const stylefunction = (feature) => {
            return new Style({
                fill: new Fill({
                color: 'rgba(255,0,0,0.4)'
            }),
                stroke: new Stroke({
                color: 'rgba(0, 0, 255, 0.7)',
                width: 2,
                }), 
            });
        };

        //Feature Server Vector Layer for the Tracks

        const pg_test = new VectorLayer({
        // /background: 'white',
            source: new VectorSource({
            url: 'http://localhost:9050/collections/public.nz_primary_parcels/items.json?limit=1000',
            format: new GeoJSON(),
            projection : 'EPSG:4326',
            wrapX: false,
            }),
            style: stylefunction,
        });

        //Create the map

        const map = new Map({
            target: mapRef.current,
            layers: [topo50_layer, pg_test],
            view: new View({
                center: [0, 0],
                zoom: 0,
            }),
        })
        return () => map.setTarget(null)
    }, 
    []) //Looks odd, but ends the useEffect()

  return (
    <div
      style={{ height: "300px", width: "100%" }}
      ref={mapRef}
      className="map-container"
    />
  )
}

export default MapComponent