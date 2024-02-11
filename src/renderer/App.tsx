import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { DatePicker } from 'antd';

function Hello() {
  return <DatePicker />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
