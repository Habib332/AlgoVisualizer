import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage"; 
import VisualizePage from "./VisualizePage";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/visualize" element={<VisualizePage />} />
      </Routes>
    </BrowserRouter>
  );
}