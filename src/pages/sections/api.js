// sections/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api",
});

export { api };
