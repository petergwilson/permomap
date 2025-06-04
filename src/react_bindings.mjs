import React, { useState } from 'react';




function GeoJSONBindings({component_render_type}) {
  
  
  
  
  
  
    

  const handleUpdateGeojson = () => {
    try {
      const parsedInput = JSON.parse(inputValue);
      setGeojson(parsedInput);
    } catch (error) {
      console.error('Invalid JSON input:', error);
    }
  };

  return (
    <div>
      <textarea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <button onClick={handleUpdateGeojson}>Update GeoJSON</button>
      <pre>{JSON.stringify(geojson, null, 2)}</pre>
    </div>
  );
}

export default GeoJSONBindings;