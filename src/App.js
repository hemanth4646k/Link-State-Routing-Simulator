import React from 'react';
import './App.css';
import RouterSimulator from './components/RouterSimulator';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Link State Routing Simulator</h1>
      </header>
      <main>
        <RouterSimulator />
      </main>
    </div>
  );
}

export default App;
