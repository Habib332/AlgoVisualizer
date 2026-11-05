import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage"; // fix the path to wherever the file is

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}