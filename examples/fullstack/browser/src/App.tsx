import React from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.css'

import { Akord, Auth } from '@akord/akord-js'
import { useState } from 'react'
import { AkordWallet } from '@akord/crypto';

function App() {

  const [akord, setAkord] = useState<Akord | null>()
  const [vaultId, setVaultId] = useState<string>('')
  const [backupPhrase, setBackupPhrase] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  const handleAccessRequest = async (event: any) => {
    event.preventDefault();
    setLoading(true);
    try {
      const wallet = await AkordWallet.create();
      setBackupPhrase(wallet.backupPhrase);
      const access = await fetch(
        `http://localhost:3223/access?${new URLSearchParams(
            { 
              publicKey: wallet.publicKey(), 
              signingPublicKey: wallet.signingPublicKey(),
              requestedStorageInMb: "10"
            }
          ).toString()}`,
        { method: 'post' }
      );
      setVaultId((await access.json()).vaultId);

      await Auth.signInWithWallet(wallet);
      setAkord(new Akord(wallet));
    } catch (e) {
      console.error(e)
    }
    setLoading(false);
  }


  const loginForm = () => {
    return <div className={'p-3'}>
      <h1 className="display-6 mb-3">Akord storage</h1>
        <button type="submit" className="btn btn-primary" disabled={!!loading} onClick={handleAccessRequest}>{loading ? "Loading..." : "Request 10mb"}</button>
    </div>
  }

  const handleUpload = async (files: FileList | null) => {
    if (!akord) {
      throw new Error('Akord-js not initialized')
    }
    if (!vaultId) {
      throw new Error('Vault-Id missing')
    }
    if (!files || !files.length) {
      throw new Error('Failed uploading the file')
    }
    setLoading(true) 
    try {
      const file = files[0]
      const vault = await akord.vault.get(vaultId)
      if (!vault) {
        throw new Error(`User is not a membeer of: ${vaultId}`)
      }
      alert("Uploading file to vault: " + vault.name)
      const { stackId } = await akord.stack.create(vault.id, file)
      alert("Created stack: " + stackId)
      prompt("Ctrl+C, Enter to copy the vault link", `https://v2.akord.com/vaults/active/${vaultId}/assets?wallet=${btoa(backupPhrase)}`)
      
    } catch (e) {
      console.error(e)
    }
    setLoading(false) 
    setAkord(null)
    setBackupPhrase('')
    setVaultId('')
  }

  const uploadForm = () => {
    return <div className={'p-3'}>
      <h1 className="display-6 mb-3">Upload</h1>
      <input
        type="file"
        onChange={(e) => handleUpload(e.target.files)}
        disabled={!!loading}
      />
    </div>
  }

  return (
    <div className="App">
      <header>
        <title>AkordJS &lt;&gt; Fullstack starter</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </header>
      <main className="vh-100 d-flex justify-content-center align-items-center">
        {akord ? uploadForm() : loginForm()}
      </main>
    </div>
  )
}

export default App;