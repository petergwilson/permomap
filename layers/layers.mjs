import { Tile } from 'ol/layer';
//OGC ImageTile
import ImageTile from 'ol/source/ImageTile.js';

//Vector Tile Layer and VectorTileSource
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import MVT from 'ol/format/MVT.js'; //MapBox vector tiles, using PBF (Protocol Buffer Binary format for speed)

//Vector Layers
import VectorLayer from 'ol/layer/Vector.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import VectorSource from 'ol/source/Vector.js';

import { LayerManager } from 'oltb/src/oltb/js/toolbar-managers/layer-manager/layer-manager';

LayerManager.addMapLayers([
    {
        id: '1',
        name: 'LINZ Topo50',
        sortIndex:2,
        layer: new Tile({
            source: new ImageTile({
                url: 'https://tiles-cdn.koordinates.com/services;key=20b10a680c3742798647ec56775918a4/tiles/v4/layer=50767/EPSG:3857/{z}/{x}/{y}.png',
            }),
            visible: true
        })
    },
    {
        id: '2',
        name: 'Vector Base Layer',
        sortIndex:3,
        layer: new VectorTileLayer({
            source: new VectorTileSource({
                format: new MVT(),
                url: 'http://localhost:7800/public.nz_primary_parcels/{z}/{x}/{y}.pbf',
            }),
        visible: true
        })
   // },
   /*
    {
        id: '3',
        name: 'WDC Parcels',
        sortIndex:5,
        layer: new VectorLayer({
            source: new VectorSource({
                format: new GeoJSON(),
                url: 'http://localhost:9050/collections/public.nz_primary_parcels/items.json',
            }),
        visible: true
        })
    */
    }],

    {isSilent:true});

LayerManager.addFeatureLayer([
    {
        id: '3',
        name: 'WDC Parcels',
        sortIndex:5,
        layer: new VectorLayer({
            source: new VectorSource({
                format: new GeoJSON(),
                url: 'http://localhost:9050/collections/public.parcels_3857/items.json?filter=live=true',
            }),
        visible: true
        })
    }], 
    {isSilent: true});


