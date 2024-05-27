import React, { useEffect, useState } from 'react';
import './App.css';
import { PubSubPlugin } from "@akord/akord-js-pubsub-plugin"
import { Akord, Auth } from "@akord/akord-js";

const USERNAME = 'dev@akord.com'
const PASSWORD = 'HuuugeOverflow'


function App() {
  
  const [akord, setAkord] = useState<Akord | null>()
  
  useEffect(() => {
    const init = async () => {
      const { wallet } = await Auth.signIn(USERNAME, PASSWORD);
      setAkord(new Akord(wallet, { plugins: [new PubSubPlugin()] }));
    }
    init();
  }, [])

  useEffect(() => {
    const subscribe = async () => {
      await akord!.zip.subscribe((notification) => alert("Received notification: " + JSON.stringify(notification)))
      console.log("Subscribed!")
    }
    
    if (akord) {
      console.log("subscribing")
      subscribe();
    }

    return () => {
      // if (akord) {
      //   akord.zip.unsubscribe();
      // }
    }
  }, [akord])
  
  const handleUpload = async (files: FileList | null) => {
    if (!akord) {
      throw new Error('Akord-js not initialized')
    }
    if (!files || !files.length) {
      throw new Error('Failed uploading the file')
    }
    const file = files[0]
    const vaults = await akord?.vault.list()
    if (!vaults.items || !vaults.items.length) {
      throw new Error('User does not have any vaults')
    }
    const vault = vaults.items.find(vault => vault.public)
    if (!vault) {
      throw new Error('User does not have any public vaults')
    }
    alert("Uploading file to vault: " + vault.name)
    const { sourceId } = await akord.zip.upload(vault.id, file)
    alert("Uploaded zip: " + sourceId)
    setAkord(null)
  }

  const uploadForm = () => {
    return <div className={'p-3'}>
      <h1 className="display-6 mb-3">Upload Zip</h1>
      <form>
        <input
          type="file"
          accept=".zip"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </form>
    </div>
  }


  return (
    <div className="App">
      <header>
        <title>AkordJS &lt;&gt; PubSub example</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </header>
      <main className="vh-100 d-flex justify-content-center align-items-center">
        {akord && uploadForm()}
      </main>
    </div>
  );
}

export default App;
