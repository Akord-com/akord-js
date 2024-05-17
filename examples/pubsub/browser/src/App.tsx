import React, { useEffect, useRef } from 'react';
import logo from './logo.svg';
import './App.css';
import { PubSubPlugin } from "@akord/akord-js-pubsub-plugin"
import { Akord, Auth } from "@akord/akord-js";

function App() {
  
  const akord = useRef<Akord | null>(null)
  
  useEffect(() => {
    const init = async () => {
      const { wallet } = await Auth.signIn(process.env.REACT_APP_USERNAME!, process.env.REACT_APP_PASSWORD!);
      akord.current = new Akord(wallet, { plugins: [new PubSubPlugin()] });
      await akord.current.zip.subscribe((notification) => console.log(notification))
    }
    
    if (!akord.current) {
      init();
    }

    return () => {
      if (akord.current) {
        akord.current.zip.unsubscribe();
      }
    }
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
