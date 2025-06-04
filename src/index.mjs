import React from "react";
import ReactDOM from "react-dom";

import App from "./App";

//Gets root element of HTML document. 
const rootElement = document.getElementById("root");
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  rootElement
);
