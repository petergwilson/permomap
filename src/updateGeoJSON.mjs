import React, { useState, useEffect } from 'react';

function GeoJsonForm({ geoJson }) {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [formValues, setFormValues] = useState({});

  // Update form values when a feature is selected
  useEffect(() => {
    if (selectedFeature) {
      setFormValues(selectedFeature.properties);
    } else {
      setFormValues({});
    }
  }, [selectedFeature]);

  // Function to handle feature selection (e.g., on map click)
  const handleFeatureSelect = (feature) => {
    setSelectedFeature(feature);
  };

  // Function to handle input changes
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues({ ...formValues, [name]: value });
  };

  // Function to render the form
  const renderForm = () => {
    if (!selectedFeature || !selectedFeature.properties) {
      return <p>Select a feature to edit.</p>;
    }

    return Object.keys(selectedFeature.properties).map((key) => (
      <div key={key}>
        <label htmlFor={key}>{key}:</label>
        <input
          type="text"
          id={key}
          name={key}
          value={formValues[key] || ''}
          onChange={handleInputChange}
        />
      </div>
    ));
  };

  return (
    <div>
      <button onClick={() => handleFeatureSelect(geoJson.features[0])}>Select Feature</button> {/* Example feature selection */}
        {renderForm()}
      
    </div>
  );
}

export default GeoJsonForm;